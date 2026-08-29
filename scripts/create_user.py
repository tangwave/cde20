#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
create_user.py — 账号管理命令行工具（管理员开通账号用）

账号不开放自助注册，统一由管理员通过本脚本或 /api/auth/users 接口开通。

两套账号存储方式，命令前缀不同：

【A. 环境变量模式（env-*，推荐，无需外部数据库）】
账号编码在 AUTH_USERS_JSON 里。Render 的环境变量持久保存，重新部署不丢；
会话改用 HMAC 签名 cookie，登录态同样跨部署保持。

    python scripts/create_user.py gen-secret           # 生成 AUTH_SECRET（会话签名密钥）
    python scripts/create_user.py env-init             # 交互式建首个管理员，输出待配置的环境变量值
    python scripts/create_user.py env-add <用户名> <口令> [--name 姓名] [--role admin|user]
    python scripts/create_user.py env-passwd <用户名> <新口令>
    python scripts/create_user.py env-del <用户名>
    python scripts/create_user.py env-list             # 列出 AUTH_USERS_JSON 中的账号
    python scripts/create_user.py env-export           # 只输出待配置的两条环境变量值

    ⚠ env-* 命令基于当前 shell 里的 AUTH_USERS_JSON 读改写，因此追加账号时必须先设好它：
        set AUTH_USERS_JSON=b64:xxxx          (Windows CMD)
        $env:AUTH_USERS_JSON="b64:xxxx"       (PowerShell)
      每执行一次 env-add / env-passwd / env-del，都会输出新的完整值，需覆盖回部署环境。

【B. 数据库模式（无前缀）】
账号存 PostgreSQL（设 DATABASE_URL）或本地 SQLite。改账号即时生效，无需重新部署。

    python scripts/create_user.py init                 # 建表 + 创建首个管理员
    python scripts/create_user.py add  <用户名> <口令> [--name 姓名] [--role admin|user]
    python scripts/create_user.py list                 # 列出所有账号
    python scripts/create_user.py passwd <用户名> <新口令>
    python scripts/create_user.py enable <用户名>      # 启用
    python scripts/create_user.py disable <用户名>     # 停用
    python scripts/create_user.py audit [条数]         # 查看审计日志

环境变量：
    DATABASE_URL      Postgres 连接串；设置了就用数据库模式
    AUTH_USERS_JSON   账号清单（env 模式）；JSON 数组或 "b64:"+base64
    AUTH_SECRET       会话签名密钥（env 模式必需）
    AUTH_DB_PATH      SQLite 路径（数据库模式本地回退，默认 <仓库根>/users.db）
"""
import base64
import getpass
import json
import os
import secrets
import sys

# 本文件位于 <repo>/scripts/，仓库根 = 再上一层，auth 模块在 <repo>/api/
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_REPO_ROOT, "api"))

try:
    import auth
except Exception as e:
    print("无法导入 api/auth.py：%s" % e)
    sys.exit(1)


def _info():
    print("存储后端：%s" % ("PostgreSQL（持久化）" if auth.using_postgres()
                           else "SQLite（本地回退，部署会丢失！）"))


# ------------------------------------------------- 环境变量模式（AUTH_USERS_JSON）
# 多数 PaaS 对单条环境变量有长度上限，超过就该改用数据库模式
_ENV_LEN_WARN = 3500


def _env_dump(users):
    """把账号列表序列化成 'b64:' + base64(JSON)。"""
    payload = []
    for u in users:
        payload.append({
            "username": u["username"],
            "pw_hash": u["pw_hash"],
            "display_name": u.get("display_name") or u["username"],
            "role": u.get("role") or "user",
            "is_active": int(u.get("is_active", 1)),
        })
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    # urlsafe：避免 +  /  在环境变量/复制粘贴时被转义或截断
    b64 = base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")
    return "b64:" + b64, b64


def _show_env(users, secret=None):
    val, b64 = _env_dump(users)
    print()
    print("=" * 74)
    print(" 把下面两条填进 Render → Environment，然后重新部署：")
    print("=" * 74)
    print()
    print("AUTH_USERS_JSON=%s" % val)
    if secret:
        print()
        print("AUTH_SECRET=%s" % secret)
    print()
    print("账号 %d 个，AUTH_USERS_JSON 长度 %d 字符。" % (len(users), len(b64)))
    if len(b64) > _ENV_LEN_WARN:
        print("⚠ 已接近部分平台的环境变量长度上限，建议改用数据库模式。")
    if not secret:
        print("⚠ AUTH_SECRET 请沿用之前的值；重新生成会让所有人立即掉线。")
    print()
    return 0


def cmd_gen_secret():
    """生成会话签名密钥。"""
    s = secrets.token_urlsafe(48)
    print()
    print("AUTH_SECRET=%s" % s)
    print()
    print("请连同 AUTH_USERS_JSON 一起配置。重新生成会让所有已登录用户掉线。")
    print()
    return 0


def cmd_env_init():
    """交互式创建首个管理员，并生成配套的 AUTH_SECRET。"""
    print("\n环境变量模式：创建首个管理员")
    username = input("  用户名: ").strip()
    if not username:
        print("  已取消")
        return 1
    while True:
        pw = getpass.getpass("  口令(至少8位,不回显): ")
        pw2 = getpass.getpass("  再输一次: ")
        if pw != pw2:
            print("  两次不一致，重来")
            continue
        if len(pw) < 8:
            print("  口令至少 8 位")
            continue
        break
    name = input("  姓名(可留空): ").strip() or username
    users = [{"username": username, "pw_hash": auth.hash_password(pw),
              "display_name": name, "role": "admin", "is_active": 1}]
    return _show_env(users, secrets.token_urlsafe(48))


def _env_parse_args(args):
    username = args[0] if len(args) > 0 else ""
    password = args[1] if len(args) > 1 else ""
    name, role = "", "user"
    for i, a in enumerate(args):
        if a == "--name" and i + 1 < len(args):
            name = args[i + 1]
        if a == "--role" and i + 1 < len(args):
            role = args[i + 1]
    if role not in ("admin", "user"):
        role = "user"
    return username, password, name, role


def cmd_env_add(args):
    username, password, name, role = _env_parse_args(args)
    if not username or not password:
        print("用法: env-add <用户名> <口令> [--name 姓名] [--role admin|user]")
        return 1
    if len(password) < 8:
        print("口令至少 8 位")
        return 1
    users = auth._env_users()
    if not auth.AUTH_USERS_JSON:
        print("提示：当前未设 AUTH_USERS_JSON，将从空列表开始新建（会覆盖部署环境的旧值）。")
    if any(u["username"] == username for u in users):
        print("用户名已存在：%s" % username)
        return 1
    users.append({"username": username, "pw_hash": auth.hash_password(password),
                  "display_name": name or username, "role": role, "is_active": 1})
    print("已追加 %s（%s）" % (username, role))
    return _show_env(users)


def cmd_env_passwd(args):
    if len(args) < 2:
        print("用法: env-passwd <用户名> <新口令>")
        return 1
    username, password = args[0], args[1]
    if len(password) < 8:
        print("口令至少 8 位")
        return 1
    users = auth._env_users()
    hit = [u for u in users if u["username"] == username]
    if not hit:
        print("用户不存在：%s" % username)
        return 1
    hit[0]["pw_hash"] = auth.hash_password(password)
    print("已更新 %s 的口令" % username)
    return _show_env(users)


def cmd_env_del(args):
    if not args:
        print("用法: env-del <用户名>")
        return 1
    username = args[0]
    users = auth._env_users()
    left = [u for u in users if u["username"] != username]
    if len(left) == len(users):
        print("用户不存在：%s" % username)
        return 1
    print("已移除 %s" % username)
    return _show_env(left)


def cmd_env_list():
    users = auth._env_users()
    if not users:
        print("（AUTH_USERS_JSON 未设置，或解析不到任何账号）")
        return 0
    print("\n%-16s %-14s %-8s %-6s" % ("用户名", "姓名", "角色", "状态"))
    print("-" * 52)
    for u in users:
        print("%-16s %-14s %-8s %-6s" % (
            u["username"], u.get("display_name") or "", u.get("role") or "user",
            "启用" if u.get("is_active") else "停用"))
    print()
    print("共 %d 个账号" % len(users))
    return 0


def cmd_env_export():
    users = auth._env_users()
    if not users:
        print("（AUTH_USERS_JSON 未设置，无内容可导出）")
        return 1
    val, b64 = _env_dump(users)
    print(val)
    print("\n长度 %d 字符，账号 %d 个" % (len(b64), len(users)), file=sys.stderr)
    return 0


def cmd_init():
    if not auth.init_db():
        print("建表失败")
        return 1
    _info()
    print("\n创建首个管理员账号：")
    username = input("  用户名: ").strip()
    if not username:
        print("  已取消")
        return 1
    while True:
        pw = getpass.getpass("  口令(至少8位,不回显): ")
        pw2 = getpass.getpass("  再输一次: ")
        if pw != pw2:
            print("  两次不一致，重来")
            continue
        if len(pw) < 8:
            print("  口令至少 8 位")
            continue
        break
    name = input("  姓名(可留空): ").strip()
    ok, msg = auth.create_user(username, pw, name or username, "admin")
    print("  %s" % msg)
    return 0 if ok else 1


def cmd_add(args):
    username = args[0] if len(args) > 0 else ""
    password = args[1] if len(args) > 1 else ""
    name, role = "", "user"
    for i, a in enumerate(args):
        if a == "--name" and i + 1 < len(args):
            name = args[i + 1]
        if a == "--role" and i + 1 < len(args):
            role = args[i + 1]
    if not username or not password:
        print("用法: add <用户名> <口令> [--name 姓名] [--role admin|user]")
        return 1
    auth.init_db()
    ok, msg = auth.create_user(username, password, name or username, role)
    print(msg)
    return 0 if ok else 1


def cmd_list():
    auth.init_db()
    _info()
    rows = auth.list_users()
    if not rows:
        print("（无账号）")
        return 0
    print("\n%-4s %-16s %-14s %-8s %-6s %s" %
          ("ID", "用户名", "姓名", "角色", "状态", "最后登录"))
    print("-" * 74)
    for r in rows:
        print("%-4s %-16s %-14s %-8s %-6s %s" % (
            r["id"], r["username"], r.get("display_name") or "",
            r.get("role") or "user",
            "启用" if r.get("is_active") else "停用",
            r.get("last_login_at") or "-"))
    return 0


def cmd_passwd(args):
    if len(args) < 2:
        print("用法: passwd <用户名> <新口令>")
        return 1
    ok, msg = auth.set_password(args[0], args[1])
    print(msg)
    return 0 if ok else 1


def _toggle(args, active):
    if not args:
        print("用法: %s <用户名>" % ("enable" if active else "disable"))
        return 1
    ok, msg = auth.set_user_active(args[0], active)
    print(msg)
    return 0 if ok else 1


def cmd_audit(args):
    n = int(args[0]) if args and args[0].isdigit() else 50
    rows = auth.recent_audit(n)
    if not rows:
        print("（无记录）")
        return 0
    for r in rows:
        print("%s  %-14s %-18s %-24s %s" % (
            r["ts"], r.get("username") or "", r.get("action") or "",
            r.get("detail") or "", r.get("ip") or ""))
    return 0


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 0
    cmd, rest = args[0], args[1:]
    # —— 环境变量模式 ——
    if cmd == "gen-secret":
        return cmd_gen_secret()
    if cmd == "env-init":
        return cmd_env_init()
    if cmd == "env-add":
        return cmd_env_add(rest)
    if cmd == "env-passwd":
        return cmd_env_passwd(rest)
    if cmd == "env-del":
        return cmd_env_del(rest)
    if cmd == "env-list":
        return cmd_env_list()
    if cmd == "env-export":
        return cmd_env_export()
    # —— 数据库模式 ——
    if cmd == "init":
        return cmd_init()
    if cmd == "add":
        return cmd_add(rest)
    if cmd == "list":
        return cmd_list()
    if cmd == "passwd":
        return cmd_passwd(rest)
    if cmd == "enable":
        return _toggle(rest, True)
    if cmd == "disable":
        return _toggle(rest, False)
    if cmd == "audit":
        return cmd_audit(rest)
    print("未知命令：%s\n" % cmd)
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main())
