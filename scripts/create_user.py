#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
create_user.py — 账号管理命令行工具（管理员开通账号用）

账号不开放自助注册，统一由管理员通过本脚本或 /api/auth/users 接口开通。

用法（在仓库根目录执行）：
    python scripts/create_user.py init                 # 建表 + 创建首个管理员
    python scripts/create_user.py add  <用户名> <口令> [--name 姓名] [--role admin|user]
    python scripts/create_user.py list                 # 列出所有账号
    python scripts/create_user.py passwd <用户名> <新口令>
    python scripts/create_user.py enable <用户名>      # 启用
    python scripts/create_user.py disable <用户名>     # 停用
    python scripts/create_user.py audit [条数]         # 查看审计日志

环境变量：
    DATABASE_URL  Postgres 连接串（生产环境必配，否则 Render 重新部署会丢账号）
    AUTH_DB_PATH  SQLite 路径（本地回退，默认 <仓库根>/users.db）
"""
import getpass
import os
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
    auth.set_user_active(args[0], active)
    print("已%s：%s" % ("启用" if active else "停用", args[0]))
    return 0


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
