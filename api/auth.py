# -*- coding: utf-8 -*-
"""
auth.py — 用户登录模块（全站鉴权 + 多用户 + 审计日志）

设计要点
--------
1. 三种用户源，按优先级自动选择：
   a) database — 设了 DATABASE_URL 走 PostgreSQL（psycopg2）；否则 SQLite，仅供本地开发。
   b) env      — 设了 AUTH_USERS_JSON，账号直接编码在环境变量里。
                 Render 的环境变量是持久的（不随部署丢失），因此无需外部数据库即可
                 保住账号。适合 5~20 人的小团队，零成本、无冷启动。
   c) none     — 两者都没配，此时默认**关闭**鉴权，避免把所有人挡在登录页外。
2. 口令散列：优先 bcrypt(rounds=12)；不可用时回退标准库 PBKDF2-HMAC-SHA256(600k 轮)。
3. 会话两种模式，随用户源自动切换：
   - database 模式：随机 32 字节 token 存库，可服务端精确吊销。
   - env 模式：**无状态签名会话**（HMAC-SHA256 签名 cookie），不落库，
     因此重新部署后登录态依然保持——这正是放弃外部数据库的关键补偿。
     吊销手段：jti 进程内黑名单（单点登出）+ AUTH_REVOKE_BEFORE（全局吊销）。
4. 审计：数据库模式写 audit_log 表；env 模式写 stdout（Render 日志保留 7 天）。

环境变量
--------
DATABASE_URL      Postgres 连接串；设置后账号存库（优先级最高）
AUTH_USERS_JSON   账号清单。JSON 数组，或 "b64:" + base64(该 JSON)
                  元素字段：username / pw_hash / display_name / role / is_active
AUTH_SECRET       会话签名密钥（env 模式必需）。由 create_user.py 生成，务必一并配置，
                  否则每次进程重启登录态都会失效
AUTH_REVOKE_BEFORE  早于该 Unix 时间戳签发的会话全部作废（应急全局吊销）
AUTH_DB_PATH      SQLite 路径（database 模式回退时用），默认 <APP_DIR>/users.db
SESSION_TTL_HOURS 会话有效期（小时），默认 72
AUTH_ENABLED      置 "0"/"false" 可临时关闭全站鉴权（排障用）
SESSION_COOKIE    Cookie 名，默认 kb_session
"""
import base64
import hashlib
import hmac
import json
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
AUTH_USERS_JSON = (os.environ.get("AUTH_USERS_JSON") or "").strip()


def auth_enabled():
    """是否启用全站鉴权。

    显式配置 AUTH_ENABLED 时以其为准；未配置时按「有没有可用的用户源」推断：
    既没接外部数据库、也没有 AUTH_USERS_JSON 时，说明一个账号都没有，
    此时默认**关闭**鉴权，避免把所有人（包括管理员）挡在登录页外导致站点不可用。
    """
    v = (os.environ.get("AUTH_ENABLED") or "").strip().lower()
    if v in ("0", "false", "no", "off"):
        return False
    if v in ("1", "true", "yes", "on"):
        return True
    # 未显式配置：有任意一种用户源才默认开启
    return user_source() != "none"


def user_source():
    """当前用户源：'postgres' | 'sqlite' | 'env' | 'none'"""
    if using_postgres():
        return "postgres"
    if AUTH_USERS_JSON:
        return "env"
    # 没有环境变量账号时，才考虑本地 SQLite（仅本地开发用）
    if os.path.exists(AUTH_DB_PATH):
        return "sqlite"
    return "none"


def using_postgres():
    return bool(DATABASE_URL)


def using_env_users():
    """账号是否来自环境变量（此时会话必须无状态，否则部署即丢登录态）。"""
    return user_source() == "env"


def using_db_users():
    return user_source() in ("postgres", "sqlite")


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


# ------------------------------------------------- 环境变量用户源（AUTH_USERS_JSON）
def _env_users():
    """解析 AUTH_USERS_JSON。

    支持两种写法：
      - 原始 JSON 数组
      - "b64:" + base64(JSON)   —— 推荐，可避开环境变量里的引号/换行转义问题
    解析失败时返回 []，绝不抛异常（否则会让鉴权整体失效）。
    """
    raw = AUTH_USERS_JSON
    if not raw:
        return []
    try:
        if raw.startswith("b64:"):
            # urlsafe_b64decode 同时兼容标准 base64 的 +/ 与 urlsafe 的 -_
            raw = base64.urlsafe_b64decode(raw[4:]).decode("utf-8")
        data = json.loads(raw)
        if isinstance(data, dict):          # 也允许 {"users":[...]} 形式
            data = data.get("users") or []
        if not isinstance(data, list):
            return []
        out = []
        for i, u in enumerate(data, 1):
            if not isinstance(u, dict):
                continue
            uname = (u.get("username") or u.get("u") or "").strip()
            if not uname:
                continue
            out.append({
                "id": u.get("id") or i,
                "username": uname,
                "pw_hash": u.get("pw_hash") or u.get("p") or "",
                "display_name": u.get("display_name") or u.get("dn") or uname,
                "role": u.get("role") or u.get("r") or "user",
                "is_active": 1 if (u.get("is_active", 1) in (1, True, "1", "true")) else 0,
            })
        return out
    except Exception as e:
        print("[auth] AUTH_USERS_JSON 解析失败：%s" % e, flush=True)
        return []


def _env_find_user(username):
    u = (username or "").strip()
    for r in _env_users():
        if r["username"] == u:
            return r
    return None


# ------------------------------------------------- 无状态签名会话（env 模式专用）
def _secret():
    """会话签名密钥。

    未配置 AUTH_SECRET 时**不**做持久化猜测，而是生成进程级随机密钥并在日志中告警：
    这样最坏情况只是「重启后需重新登录」，不会引入可预测的弱密钥。
    """
    s = (os.environ.get("AUTH_SECRET") or "").strip()
    if s:
        return s.encode("utf-8")
    if not hasattr(_secret, "_ephemeral"):
        _secret._ephemeral = secrets.token_bytes(32)
        print("[auth] ⚠ 未配置 AUTH_SECRET，已使用临时随机密钥："
              "进程重启后所有登录态失效。请由 create_user.py 生成并写入该变量。",
              flush=True)
    return _secret._ephemeral


def _b64e(b):
    return base64.urlsafe_b64encode(b).decode("ascii").rstrip("=")


def _b64d(s):
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _sign(payload):
    return hmac.new(_secret(), payload.encode("ascii"),
                    hashlib.sha256).hexdigest()


def mint_session_token(user):
    """签发无状态会话 token：base64url(payload).hex(hmac)。

    payload 内含 exp，签名保证不可篡改；不落库，因此跨部署保持有效。
    """
    now = int(time.time())
    payload = {
        "u": user["username"],
        "dn": user.get("display_name") or user["username"],
        "r": user.get("role") or "user",
        "iat": now,
        "exp": now + SESSION_TTL_HOURS * 3600,
        "jti": secrets.token_hex(8),
    }
    body = _b64e(json.dumps(payload, separators=(",", ":"),
                            ensure_ascii=False).encode("utf-8"))
    return body + "." + _sign(body)


# 已吊销的 jti（进程内）。重启即失，但足以覆盖「用户主动登出」这一场景。
_REVOKED_JTI = set()
_REVOKED_MAX = 10000
_REVOKE_BEFORE = int(os.environ.get("AUTH_REVOKE_BEFORE") or 0)


def verify_session_token(token):
    """校验无状态会话。通过返回 user dict，否则 None。"""
    if not token or "." not in token:
        return None
    body, _, sig = token.rpartition(".")
    if not body or not sig:
        return None
    if not hmac.compare_digest(_sign(body), sig):
        return None
    try:
        p = json.loads(_b64d(body).decode("utf-8"))
    except Exception:
        return None
    if int(p.get("exp") or 0) < int(time.time()):
        return None
    if _REVOKE_BEFORE and int(p.get("iat") or 0) < _REVOKE_BEFORE:
        return None
    if p.get("jti") in _REVOKED_JTI:
        return None
    # 账号可能已被移除或停用，仍要复核一次
    u = _env_find_user(p.get("u"))
    if not u or not u["is_active"]:
        return None
    return {"id": u["id"], "username": u["username"],
            "display_name": u.get("display_name") or u["username"],
            "role": u.get("role") or "user",
            "jti": p.get("jti"), "exp": p.get("exp")}


def revoke_session_token(token):
    """把该 token 的 jti 加入黑名单（登出用）。"""
    if not token or "." not in token:
        return
    body = token.rpartition(".")[0]
    try:
        p = json.loads(_b64d(body).decode("utf-8"))
        jti = p.get("jti")
        if not jti:
            return
        if len(_REVOKED_JTI) >= _REVOKED_MAX:
            _REVOKED_JTI.clear()
        _REVOKED_JTI.add(jti)
    except Exception:
        pass


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
_ENV_READONLY_MSG = (
    "当前账号来自环境变量 AUTH_USERS_JSON（只读）。"
    "请在本机用 `python scripts/create_user.py` 重新生成该变量并更新到部署环境后重新部署。"
)


def create_user(username, password, display_name="", role="user"):
    """管理员开通账号。返回 (ok, msg)。"""
    username = (username or "").strip()
    if not username or not password:
        return False, "用户名与口令不能为空"
    if len(password) < 8:
        return False, "口令至少 8 位"
    if using_env_users():
        return False, _ENV_READONLY_MSG
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
    if using_env_users():
        # 不返回 pw_hash，避免口令散列经接口泄露
        return [{"id": u["id"], "username": u["username"],
                 "display_name": u["display_name"], "role": u["role"],
                 "is_active": u["is_active"],
                 "created_at": "", "last_login_at": "",
                 "source": "env"} for u in _env_users()]
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
    if using_env_users():
        return False, _ENV_READONLY_MSG
    init_db()
    con = _connect()
    cur = con.cursor()
    cur.execute("UPDATE users SET is_active=" + _ph() + " WHERE username=" + _ph(),
                (1 if active else 0, username))
    con.commit()
    con.close()
    log_action(username, "set_active", "active=%s" % bool(active), "")
    return True, "状态已更新"


def set_password(username, new_password):
    if len(new_password or "") < 8:
        return False, "口令至少 8 位"
    if using_env_users():
        return False, _ENV_READONLY_MSG
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
    """校验凭据并建会话。成功返回 user dict（含 token），失败返回 None。

    环境变量用户源走无状态签名会话；数据库用户源走存库会话。
    """
    if using_env_users():
        u = _env_find_user(username)
        if not u or not u["is_active"]:
            log_action(username, "login_failed", "用户不存在或已停用", ip)
            return None
        if not verify_password(password or "", u["pw_hash"]):
            log_action(username, "login_failed", "口令错误", ip)
            return None
        token = mint_session_token(u)
        log_action(u["username"], "login", "", ip)
        return {"id": u["id"], "username": u["username"],
                "display_name": u["display_name"], "role": u["role"],
                "token": token,
                "expires_at": time.strftime(
                    "%Y-%m-%d %H:%M:%S",
                    time.localtime(int(time.time()) + SESSION_TTL_HOURS * 3600))}

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
    if using_env_users():
        return verify_session_token(token)
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
    if using_env_users():
        u = verify_session_token(token)
        revoke_session_token(token)
        if u:
            log_action(u["username"], "logout", "", "")
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
# env 模式下的内存审计缓冲（进程内保留最近若干条，重启即失）
_AUDIT_BUF = []
_AUDIT_BUF_MAX = 200


def log_action(username, action, detail="", ip=""):
    ts, uname = _now(), (username or "")
    det, ipp = (detail or "")[:300], (ip or "")
    if using_env_users():
        # 无库可写：落 stdout（Render / 多数 PaaS 会收集并保留日志），
        # 同时在进程内留一份，供 /api/auth/audit 查看近期动作。
        print("[audit] %s | %s | %s | %s | %s" % (ts, uname, action, det, ipp),
              flush=True)
        _AUDIT_BUF.append({"ts": ts, "username": uname, "action": action,
                           "detail": det, "ip": ipp})
        if len(_AUDIT_BUF) > _AUDIT_BUF_MAX:
            del _AUDIT_BUF[:len(_AUDIT_BUF) - _AUDIT_BUF_MAX]
        return
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
    if using_env_users():
        return list(reversed(_AUDIT_BUF[-limit:]))
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
