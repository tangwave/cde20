#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
9527 法规问答 · 实时后端（FastAPI）

设计要点
--------
1. 一个进程同时托管前端静态站点（quality-system-app）与 /api/qa 检索接口，
   免 CORS：把后端部署到某域名根路径，前端用同域 /api/qa 即可。
2. /api/qa 实时查询 kb.sqlite（经 scripts/kb_query.py），返回最新法规引用，
   不再依赖导出的静态快照。
3. 安全白名单：仅暴露 query / cat / topic / issuer / status / since / until /
   only_valid / n；严禁 --path / --full（避免任意文件读取）。
4. 若需要「真·问答」（撰写【结论】等解读），见 README 的 Level-B（RAG）扩展。

本地运行
--------
  pip install -r requirements.txt
  python api/server.py            # 默认 http://0.0.0.0:8000
  或 uvicorn api.server:app --port 8000
"""
import json
import os
import re
import subprocess
import sys

from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

HERE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(HERE)                       # 包含 api/ 的目录


def _find_root(start, *markers):
    """从 start 向上查找第一个同时满足所有 markers（相对路径）的目录。

    兼容两种目录结构：
      A. 嵌套（本机开发）：知识库/
                        ├─ scripts/kb_query.py, 00_索引/kb.sqlite   (KB_ROOT)
                        └─ quality-system-app/
                             ├─ index.html, js/, css/               (STATIC)
                             └─ api/server.py
      B. 扁平（Render 仓库）：repo/
                        ├─ index.html, js/, css/, scripts/, 00_索引/
                        └─ api/server.py        (KB_ROOT == STATIC == repo)
    """
    cur = os.path.abspath(start)
    for _ in range(6):
        if all(os.path.exists(os.path.join(cur, m)) for m in markers):
            return cur
        parent = os.path.dirname(cur)
        if parent == cur:
            break
        cur = parent
    return None


# KB_ROOT：包含 scripts/kb_query.py 的目录（即知识库根）
KB_ROOT = _find_root(HERE, os.path.join("scripts", "kb_query.py")) or APP_DIR
# STATIC：包含 index.html 的目录（前端静态站根）
STATIC = _find_root(HERE, "index.html") or APP_DIR
# 调用 kb_query.py 所用的 Python 解释器：
# 默认用「运行本服务的同一个解释器」（部署到 Render/VPS 时即自动正确），
# 如需覆盖（如指定虚拟环境），设环境变量 KB_QUERY_PY。
PY = os.environ.get("KB_QUERY_PY") or sys.executable or "python3"
KB_QUERY = os.path.join(KB_ROOT, "scripts", "kb_query.py")

app = FastAPI(title="9527 法规问答 API", version="1.0.0")

# 若前端跨域部署（独立后端 + 静态站点分属不同域），开启 CORS；
# 同域托管时前端可不设 QA_API_BASE，无需 CORS。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


def _run_query(q, cat, topic, issuer, status, since, until, only_valid, n):
    """调用 kb_query.py（参数以列表传递，无 shell 注入风险）。"""
    cmd = [PY, KB_QUERY, q, "--json", "-n", str(min(max(int(n), 1), 30))]
    if cat:
        cmd += ["--cat", cat]
    if topic:
        cmd += ["--topic", topic]
    if issuer:
        cmd += ["--issuer", issuer]
    if status:
        cmd += ["--status", status]
    if since:
        cmd += ["--since", since]
    if until:
        cmd += ["--until", until]
    if only_valid:
        cmd += ["--only-valid"]
    try:
        out = subprocess.run(cmd, cwd=KB_ROOT, capture_output=True,
                             text=True, timeout=25)
    except Exception as e:  # 超时 / 进程异常
        return {"results": [], "count": 0, "error": "query_failed: %s" % e}
    text = out.stdout or ""
    # kb_query 在降级时可能先打印提示行再输出 JSON，截取首个 '['
    i = text.find("[")
    if i < 0:
        note = (out.stderr or text or "无结果").strip()[:300]
        return {"results": [], "count": 0, "note": note}
    try:
        rows = json.loads(text[i:])
    except Exception:
        return {"results": [], "count": 0, "note": "JSON 解析失败"}
    # 为每个结果补算档位 tier，前端可直接用于状态徽标（单一来源，避免双端重复逻辑）
    for r in rows:
        if isinstance(r, dict) and "tier" not in r:
            r["tier"] = st_tier(r.get("状态"))
    # 标注数据来源为实时库（供前端区分实时/快照）
    return {"results": rows, "count": len(rows), "source": "live"}


def st_tier(st):
    """状态字符串 → 排序档位（镜像 kb_query.st_tier，越小越优先）。"""
    st = (st or "").strip()
    if not st:
        return 3
    if re.search(r"废止|失效|作废", st):
        return 9
    if "征求意见" in st:
        return 5 if "截止" in st else 4
    if "尚未生效" in st:
        return 2
    if "试行" in st or "暂行" in st:
        return 1
    if st.startswith("现行有效") or st in ("有效", "现行"):
        return 0
    if "参考" in st:
        return 3
    return 3


@app.get("/api/health")
def health():
    import os as _os
    kb_sqlite = _os.path.join(KB_ROOT, "00_索引", "kb.sqlite")
    return {
        "ok": True,
        "kb_root": KB_ROOT,
        "static_root": STATIC,
        "kb_query": KB_QUERY,
        "kb_sqlite_present": _os.path.isfile(kb_sqlite),
        "python": PY,
    }


@app.get("/api/qa")
def api_qa(
    q: str = Query(..., min_length=1, max_length=200),
    cat: str = "",
    topic: str = "",
    issuer: str = "",
    status: str = "",
    since: str = "",
    until: str = "",
    only_valid: bool = True,
    n: int = 20,
):
    try:
        return _run_query(q, cat, topic, issuer, status, since, until, only_valid, n)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# 兜底：SPA 路由 —— 有文件返回文件，否则回退 index.html
@app.get("/{full_path:path}")
def spa(full_path: str):
    if full_path.startswith("api/"):
        return JSONResponse({"error": "not found"}, status_code=404)
    f = os.path.join(STATIC, full_path)
    if os.path.isfile(f):
        return FileResponse(f)
    return FileResponse(os.path.join(STATIC, "index.html"))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
