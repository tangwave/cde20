# -*- coding: utf-8 -*-
"""
auth.py — 用户登录模块（全站鉴权 + 多用户 + 审计日志）

设计要点
--------
1. 双后端：设了 DATABASE_URL 走 PostgreSQL（psycopg2）；否则回退 SQLite，仅供本地开发。
   ⚠ Render 文件系统易失，正式环境**必须**配置 DATABASE_URL，否则每次部署账号会被清空。
2. 口令散列：优先 bcrypt(rounds=12)；不可用时回退标准库 PBKDF2-HMAC-SHA256(600k 轮)。
3. 会话：随机 32 字节 token 存库，Cookie 走 HttpOnly + Secure + SameSite=Lax，可服务端吊销。
4. 审计：登录/登出/改密/建账号等动作写入 audit_log，保留操作人与 IP，便于追溯。

环境变量
--------
DATABASE_URL      Postgres 连接串；未设置则回退 SQLite
AUTH_DB_PATH      SQLite 路径（回退时用），默认 <APP_DIR>/users.db
SESSION_TTL_HOURS 会话有效期（小时），默认 72
AUTH_ENABLED      置 "0"/"false" 可临时关闭全站鉴权（排障用），默认开启
SESSION_COOKIE    Cookie 名，默认 kb_session
"""
import hashlib
import hmac
import os
import secrets
import sqlite3
import time
from datetime import datetime, timedelta

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATABASE_URL = (os.environ.get("DATABASE_URL") or "").strip()
AUTH_DB_PATH = (os.environ.get("AUTH_DB_PATH")
                or os.path.join(APP_DIR, "users.db"))
SESSION_TTL_HOURS = int(os.environ.get("SESSION_TTL_HOURS", "72") or 72)
SESSION_COOKIE = (os.environ.get("SESSION_COOKIE") or "kb_session").strip()


def auth_enabled():
    return (os.environ.get("AUTH_ENABLED", "1").strip().lower()
            not in ("0", "false", "no", "off"))


def using_postgres():
    return bool(DATABASE_URL)


# ---------------------------------------------------------------- 口令散列
try:
    import bcrypt as _bcrypt
except Exception:
    _bcrypt = None

_PBKDF2_ROUNDS = 600_000


def hash_password(plain):
    """生成口令散列。返回带算法前缀的字符串，便于日后无痛升级算法。"""
    raw = (plain or "").encode("utf-8")
    if _bcrypt is not None:
        return "bcrypt$" + _bcrypt.hashpw(raw, _bcrypt.gensalt(rounds=12)).decode()
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", raw, salt, _PBKDF2_ROUNDS)
    return "pbkdf2$%d$%s$%s" % (_PBKDF2_ROUNDS, salt.hex(), dk.hex())


def verify_password(plain, stored):
    """校验口令。用 hmac.compare_digest 做定长比较，降低时序侧信道风险。"""
    if not stored:
        return False
    raw = (plain or "").encode("utf-8")
    try:
        if stored.startswith("bcrypt$"):
            if _bcrypt is None:
                return False
            return _bcrypt.checkpw(raw, stored[7:].encode("utf-8"))
        if stored.startswith("pbkdf2$"):
            _, rounds, salt_hex, dk_hex = stored.split("$", 3)
            dk = hashlib.pbkdf2_hmac("sha256", raw, bytes.fromhex(salt_hex),
                                     int(rounds))
            return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False
    return False


# ---------------------------------------------------------------- 数据库连接
def _connect():
    if using_postgres():
        import psycopg2
        url = DATABASE_URL
        # Supabase / Neon 等托管库强制要求 SSL
        low = url.lower()
        if "sslmode=" not in low and any(
                k in low for k in ("supabase", "neon", "amazonaws", "heroku")):
            url += ("&" if "?" in url else "?") + "sslmode=require"
        return psycopg2.connect(url)
    con = sqlite3.connect(AUTH_DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def _ph():
    """参数占位符：Postgres 用 %s，SQLite 用 ?"""
    return "%s" if using_postgres() else "?"


def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


_DDL = {
    "pg": [
        """CREATE TABLE IF NOT EXISTS users(
             id SERIAL PRIMARY KEY,
             username TEXT UNIQUE NOT NULL,
             pw_hash TEXT NOT NULL,
             display_name TEXT DEFAULT '',
             role TEXT DEFAULT 'user',
             is_active SMALLINT DEFAULT 1,
             created_at TEXT,
             last_login_at TEXT)""",
        """CREATE TABLE IF NOT EXISTS sessions(
             token TEXT PRIMARY KEY,
             user_id INTEGER NOT NULL,
             created_at TEXT,
             expires_at TEXT,
             ip TEXT DEFAULT '',
             ua TEXT DEFAULT '')""",
        """CREATE TABLE IF NOT EXISTS audit_log(
             id SERIAL PRIMARY KEY,
             ts TEXT,
             username TEXT DEFAULT '',
             action TEXT,
             detail TEXT DEFAULT '',
             ip TEXT DEFAULT '')""",
        "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts)",
    ],
    "sqlite": [
        """CREATE TABLE IF NOT EXISTS users(
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             username TEXT UNIQUE NOT NULL,
             pw_hash TEXT NOT NULL,
             display_name TEXT DEFAULT '',
             role TEXT DEFAULT 'user',
             is_active INTEGER DEFAULT 1,
             created_at TEXT,
             last_login_at TEXT)""",
        """CREATE TABLE IF NOT EXISTS sessions(
             token TEXT PRIMARY KEY,
             user_id INTEGER NOT NULL,
             created_at TEXT,
             expires_at TEXT,
             ip TEXT DEFAULT '',
             ua TEXT DEFAULT '')""",
        """CREATE TABLE IF NOT EXISTS audit_log(
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             ts TEXT,
             username TEXT DEFAULT '',
             action TEXT,
             detail TEXT DEFAULT '',
             ip TEXT DEFAULT '')""",
        "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts)",
    ],
}

_initialized = False


def init_db():
    """建表（幂等）。返回 True 表示成功。"""
    global _initialized
    if _initialized:
        return True
    try:
        con = _connect()
        cur = con.cursor()
        for sql in _DDL["pg" if using_postgres() else "sqlite"]:
            cur.execute(sql)
        con.commit()
        con.close()
        _initialized = True
        if not using_postgres():
            print("[auth] 警告：未配置 DATABASE_URL，账号存于本地 SQLite，"
                  "部署到 Render 后每次重新部署都会丢失！", flush=True)
        else:
            print("[auth] 已连接 PostgreSQL，账号持久化存储。", flush=True)
        return True
    except Exception as e:
        print("[auth] 初始化失败：%s" % e, flush=True)
        return False


def _rows(cur):
    """把游标结果统一成 dict 列表（屏蔽 sqlite.Row / psycopg2 tuple 差异）。"""
    if using_postgres():
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]
    return [dict(r) for r in cur.fetchall()]


def _one(cur):
    rs = _rows(cur)
    return rs[0] if rs else None


# ---------------------------------------------------------------- 用户管理
def create_user(username, password, display_name="", role="user"):
    """管理员开通账号。返回 (ok, msg)。"""
    username = (username or "").strip()
    if not username or not password:
        return False, "用户名与口令不能为空"
    if len(password) < 8:
        return False, "口令至少 8 位"
    init_db()
    try:
        con = _connect()
        cur = con.cursor()
        cur.execute("SELECT id FROM users WHERE username=" + _ph(), (username,))
        if _one(cur):
            con.close()
            return False, "用户名已存在"
        cur.execute(
            "INSERT INTO users(username,pw_hash,display_name,role,is_active,created_at)"
            " VALUES(" + ",".join([_ph()] * 6) + ")",
            (username, hash_password(password), display_name or username,
             role or "user", 1, _now()))
        con.commit()
        con.close()
        log_action(username, "create_user", "role=%s" % (role or "user"), "")
        return True, "已创建用户 %s" % username
    except Exception as e:
        return False, "创建失败：%s" % e


def list_users():
    init_db()
    try:
        con = _connect()
        cur = con.cursor()
        cur.execute("SELECT id,username,display_name,role,is_active,created_at,"
                    "last_login_at FROM users ORDER BY id")
        rs = _rows(cur)
        con.close()
        return rs
    except Exception:
        return []


def set_user_active(username, active):
    init_db()
    con = _connect()
    cur = con.cursor()
    cur.execute("UPDATE users SET is_active=" + _ph() + " WHERE username=" + _ph(),
                (1 if active else 0, username))
    con.commit()
    con.close()
    log_action(username, "set_active", "active=%s" % bool(active), "")
    return True


def set_password(username, new_password):
    if len(new_password or "") < 8:
        return False, "口令至少 8 位"
    init_db()
    con = _connect()
    cur = con.cursor()
    cur.execute("UPDATE users SET pw_hash=" + _ph() + " WHERE username=" + _ph(),
                (hash_password(new_password), username))
    con.commit()
    con.close()
    log_action(username, "change_password", "", "")
    return True, "口令已更新"


# ---------------------------------------------------------------- 会话
def authenticate(username, password, ip="", ua=""):
    """校验凭据并建会话。成功返回 user dict（含 token），失败返回 None。"""
    init_db()
    try:
        con = _connect()
        cur = con.cursor()
        cur.execute("SELECT * FROM users WHERE username=" + _ph(),
                    ((username or "").strip(),))
        u = _one(cur)
        if not u or not u.get("is_active"):
            con.close()
            log_action(username, "login_failed", "用户不存在或已停用", ip)
            return None
        if not verify_password(password or "", u["pw_hash"]):
            con.close()
            log_action(username, "login_failed", "口令错误", ip)
            return None
        token = secrets.token_urlsafe(32)
        exp = (datetime.now() + timedelta(hours=SESSION_TTL_HOURS)).strftime(
            "%Y-%m-%d %H:%M:%S")
        cur.execute(
            "INSERT INTO sessions(token,user_id,created_at,expires_at,ip,ua)"
            " VALUES(" + ",".join([_ph()] * 6) + ")",
            (token, u["id"], _now(), exp, ip or "", (ua or "")[:200]))
        cur.execute("UPDATE users SET last_login_at=" + _ph() + " WHERE id=" + _ph(),
                    (_now(), u["id"]))
        con.commit()
        con.close()
        log_action(u["username"], "login", "", ip)
        return {"id": u["id"], "username": u["username"],
                "display_name": u.get("display_name") or u["username"],
                "role": u.get("role") or "user", "token": token,
                "expires_at": exp}
    except Exception as e:
        print("[auth] 登录异常：%s" % e, flush=True)
        return None


def get_session_user(token):
    """凭 token 取用户；过期或不存在返回 None。"""
    if not token:
        return None
    init_db()
    try:
        con = _connect()
        cur = con.cursor()
        cur.execute(
            "SELECT u.id,u.username,u.display_name,u.role,s.expires_at "
            "FROM sessions s JOIN users u ON u.id=s.user_id "
            "WHERE s.token=" + _ph(), (token,))
        r = _one(cur)
        if not r:
            con.close()
            return None
        if (r.get("expires_at") or "") < _now():
            cur.execute("DELETE FROM sessions WHERE token=" + _ph(), (token,))
            con.commit()
            con.close()
            return None
        con.close()
        return {"id": r["id"], "username": r["username"],
                "display_name": r.get("display_name") or r["username"],
                "role": r.get("role") or "user"}
    except Exception:
        return None


def destroy_session(token):
    if not token:
        return
    try:
        init_db()
        con = _connect()
        cur = con.cursor()
        cur.execute("SELECT u.username FROM sessions s JOIN users u ON u.id=s.user_id "
                    "WHERE s.token=" + _ph(), (token,))
        r = _one(cur)
        cur.execute("DELETE FROM sessions WHERE token=" + _ph(), (token,))
        con.commit()
        con.close()
        if r:
            log_action(r["username"], "logout", "", "")
    except Exception:
        pass


def purge_expired_sessions():
    """清理过期会话，避免表无限增长。"""
    try:
        init_db()
        con = _connect()
        cur = con.cursor()
        cur.execute("DELETE FROM sessions WHERE expires_at < " + _ph(), (_now(),))
        con.commit()
        con.close()
    except Exception:
        pass


# ---------------------------------------------------------------- 审计
def log_action(username, action, detail="", ip=""):
    try:
        init_db()
        con = _connect()
        cur = con.cursor()
        cur.execute(
            "INSERT INTO audit_log(ts,username,action,detail,ip) VALUES("
            + ",".join([_ph()] * 5) + ")",
            (_now(), username or "", action, (detail or "")[:300], ip or ""))
        con.commit()
        con.close()
    except Exception:
        pass


def recent_audit(limit=100):
    try:
        init_db()
        con = _connect()
        cur = con.cursor()
        if using_postgres():
            cur.execute("SELECT ts,username,action,detail,ip FROM audit_log "
                        "ORDER BY id DESC LIMIT " + _ph(), (limit,))
        else:
            cur.execute("SELECT ts,username,action,detail,ip FROM audit_log "
                        "ORDER BY id DESC LIMIT ?", (limit,))
        rs = _rows(cur)
        con.close()
        return rs
    except Exception:
        return []
