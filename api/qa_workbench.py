#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
药品研发QA合规管理台 —— 云端同步 API（独立 Router，挂载到知识库网页 server.py）
- 轻量 workspace 认证 + 增量轮询同步 + 乐观锁冲突检测
- 使用独立数据库文件 qa_workbench.db，不触碰法规库 kb.sqlite
- 由 server.py 通过 importlib 加载并 include_router，加载失败不影响主服务
"""
import os
import json
import sqlite3
import hashlib
import secrets
import datetime as dt
from pathlib import Path
from typing import Optional, List, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# 基础配置
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = os.environ.get("QA_WB_DB_PATH", str(BASE_DIR / "qa_workbench.db"))
ALLOWED_MODULES = {
    "doc_review", "record_check", "change", "deviation", "capa", "qrm",
    "supplier", "audit", "outsourcing", "oos", "method", "stability",
    "equip", "di", "training", "knowledge", "pv", "tech_transfer",
    "release", "complaint", "self_inspect", "mgmt_review",
}
TOKEN_TTL_HOURS = 24 * 30  # token 有效期 30 天

router = APIRouter()


# ---------------------------------------------------------------------------
# 数据库
# ---------------------------------------------------------------------------
def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_qa_db():
    conn = get_conn()
    try:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS workspaces (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            name      TEXT UNIQUE NOT NULL,
            pw_hash   TEXT NOT NULL,
            salt      TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token      TEXT PRIMARY KEY,
            ws_id      INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS records (
            id          TEXT PRIMARY KEY,
            ws_id       INTEGER NOT NULL,
            module      TEXT NOT NULL,
            data_json   TEXT NOT NULL,
            version     INTEGER NOT NULL DEFAULT 1,
            updated_at  TEXT NOT NULL,
            deleted_at  TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_qa_records_ws ON records(ws_id);
        CREATE INDEX IF NOT EXISTS idx_qa_records_upd ON records(updated_at);
        CREATE INDEX IF NOT EXISTS idx_qa_sessions_ws ON sessions(ws_id);
        """)
        conn.commit()
    finally:
        conn.close()


def pw_hash(password: str, salt: str) -> str:
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# 认证
# ---------------------------------------------------------------------------
def auth_ws(authorization: Optional[str] = Header(None)) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="缺少认证令牌")
    token = authorization[7:].strip()
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT ws_id, expires_at FROM sessions WHERE token=?", (token,)
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="令牌无效")
    if row["expires_at"] < now_iso():
        raise HTTPException(status_code=401, detail="令牌已过期，请重新登录")
    return row["ws_id"]


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------
class AuthReq(BaseModel):
    name: str
    password: str


class TokenResp(BaseModel):
    token: str
    workspace: str


class RecordIn(BaseModel):
    record: Dict[str, Any]
    baseVersion: Optional[int] = None


# ---------------------------------------------------------------------------
# 认证接口
# ---------------------------------------------------------------------------
@router.post("/api/register", response_model=TokenResp)
def register(req: AuthReq):
    name = req.name.strip()
    if not name or len(req.password) < 4:
        raise HTTPException(status_code=400, detail="工作区名称不能为空，密码至少4位")
    conn = get_conn()
    try:
        exist = conn.execute("SELECT id FROM workspaces WHERE name=?", (name,)).fetchone()
        if exist:
            raise HTTPException(status_code=409, detail="工作区已存在，请直接登录")
        salt = secrets.token_hex(8)
        ph = pw_hash(req.password, salt)
        cur = conn.execute(
            "INSERT INTO workspaces(name,pw_hash,salt,created_at) VALUES(?,?,?,?)",
            (name, ph, salt, now_iso()),
        )
        ws_id = cur.lastrowid
        conn.commit()
        token = _issue_token(conn, ws_id)
        conn.commit()
        return TokenResp(token=token, workspace=name)
    finally:
        conn.close()


@router.post("/api/login", response_model=TokenResp)
def login(req: AuthReq):
    name = req.name.strip()
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT id,pw_hash,salt FROM workspaces WHERE name=?", (name,)
        ).fetchone()
        if not row or row["pw_hash"] != pw_hash(req.password, row["salt"]):
            raise HTTPException(status_code=401, detail="工作区名称或密码错误")
        token = _issue_token(conn, row["id"])
        conn.commit()
        return TokenResp(token=token, workspace=name)
    finally:
        conn.close()


def _issue_token(conn: sqlite3.Connection, ws_id: int) -> str:
    token = secrets.token_hex(24)
    created = now_iso()
    expires = (dt.datetime.now(dt.timezone.utc)
               + dt.timedelta(hours=TOKEN_TTL_HOURS)).isoformat()
    conn.execute(
        "INSERT INTO sessions(token,ws_id,created_at,expires_at) VALUES(?,?,?,?)",
        (token, ws_id, created, expires),
    )
    return token


@router.get("/api/qa-wb-health")
def wb_health():
    return {"status": "ok", "service": "qa-workbench", "modules": len(ALLOWED_MODULES)}


# ---------------------------------------------------------------------------
# 同步接口
# ---------------------------------------------------------------------------
def _row_to_change(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "module": row["module"],
        "data": row["data_json"],
        "version": row["version"],
        "updated_at": row["updated_at"],
        "deleted": bool(row["deleted_at"]),
    }


@router.get("/api/bootstrap")
def bootstrap(ws_id: int = Depends(auth_ws)):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM records WHERE ws_id=? AND deleted_at IS NULL ORDER BY updated_at",
            (ws_id,),
        ).fetchall()
    finally:
        conn.close()
    return {
        "server_time": now_iso(),
        "records": [_row_to_change(r) for r in rows],
    }


@router.get("/api/sync")
def sync(since: str = "0", ws_id: int = Depends(auth_ws)):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM records WHERE ws_id=? AND updated_at >= ? ORDER BY updated_at",
            (ws_id, since),
        ).fetchall()
    finally:
        conn.close()
    return {
        "server_time": now_iso(),
        "changes": [_row_to_change(r) for r in rows],
    }


# ---------------------------------------------------------------------------
# 单模块 CRUD
# ---------------------------------------------------------------------------
@router.get("/api/{module}/records")
def list_records(module: str, ws_id: int = Depends(auth_ws)):
    if module not in ALLOWED_MODULES:
        raise HTTPException(status_code=400, detail="未知模块")
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM records WHERE ws_id=? AND module=? AND deleted_at IS NULL ORDER BY updated_at",
            (ws_id, module),
        ).fetchall()
    finally:
        conn.close()
    return [json.loads(r["data_json"]) for r in rows]


@router.post("/api/{module}/records")
def create_record(module: str, body: RecordIn, ws_id: int = Depends(auth_ws)):
    if module not in ALLOWED_MODULES:
        raise HTTPException(status_code=400, detail="未知模块")
    rec = body.record
    rid = str(rec.get("id") or secrets.token_hex(8))
    data_json = json.dumps(rec, ensure_ascii=False)
    ts = now_iso()
    conn = get_conn()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO records(id,ws_id,module,data_json,version,updated_at,deleted_at) "
            "VALUES(?,?,?,?,?,?,NULL)",
            (rid, ws_id, module, data_json, 1, ts),
        )
        conn.commit()
    finally:
        conn.close()
    return {"id": rid, "version": 1, "updated_at": ts}


@router.put("/api/{module}/records/{rid}")
def update_record(module: str, rid: str, body: RecordIn, ws_id: int = Depends(auth_ws)):
    if module not in ALLOWED_MODULES:
        raise HTTPException(status_code=400, detail="未知模块")
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT version FROM records WHERE id=? AND ws_id=? AND module=?",
            (rid, ws_id, module),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="记录不存在")
        base = body.baseVersion
        if base is not None and base < row["version"]:
            raise HTTPException(
                status_code=409,
                detail=f"记录已被他人修改（服务器版本 {row['version']}，您的版本 {base}）。请刷新后重试。",
            )
        rec = body.record
        rec["id"] = rid
        data_json = json.dumps(rec, ensure_ascii=False)
        ts = now_iso()
        new_ver = row["version"] + 1
        conn.execute(
            "UPDATE records SET data_json=?, version=?, updated_at=?, deleted_at=NULL WHERE id=? AND ws_id=?",
            (data_json, new_ver, ts, rid, ws_id),
        )
        conn.commit()
    finally:
        conn.close()
    return {"id": rid, "version": new_ver, "updated_at": ts}


@router.delete("/api/{module}/records/{rid}")
def delete_record(module: str, rid: str, ws_id: int = Depends(auth_ws)):
    if module not in ALLOWED_MODULES:
        raise HTTPException(status_code=400, detail="未知模块")
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT version FROM records WHERE id=? AND ws_id=? AND module=? AND deleted_at IS NULL",
            (rid, ws_id, module),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="记录不存在或已删除")
        ts = now_iso()
        conn.execute(
            "UPDATE records SET deleted_at=?, version=?, updated_at=? WHERE id=? AND ws_id=?",
            (ts, row["version"] + 1, ts, rid, ws_id),
        )
        conn.commit()
    finally:
        conn.close()
    return {"ok": True, "deleted_at": ts}


# 模块加载时初始化数据库（importlib exec_module 会执行此处）
init_qa_db()
