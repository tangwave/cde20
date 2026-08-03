#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
9527 法规问答 · 实时后端（FastAPI）

设计要点
--------
1. 一个进程同时托管前端静态站点（quality-system-app）与 /api/qa 检索接口，
   免 CORS：把后端部署到某域名根路径，前端用同域 /api/qa 即可。
2. /api/qa 实时查询 kb.sqlite（经 scripts/kb_query.py），返回最新法规引用；
   命中片段改由本服务直接从 fts.body 取真实正文摘录（不依赖外部 .md 文件）。
3. /api/qa-rag：真·问答（Level-B RAG）——多轮检索 → 从 fts.body 取命中全文
   → 调用 OpenAI 兼容大模型，按 9527 技能四段式（结论/法规依据/适用提示/时效说明）
   合成答案。需配置 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL；未配置时优雅回退。
4. 安全白名单：/api/qa 仅暴露 query/cat/topic/issuer/status/since/until/only_valid/n；
   严禁 --path/--full（避免任意文件读取）。RAG 的全文读取在服务器内部、仅限 kb.sqlite。
"""
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request

from fastapi import FastAPI, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

HERE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(HERE)                       # 包含 api/ 的目录


def _load_dotenv():
    """载入仓库根 .env（不覆盖已存在的环境变量），不抛出。"""
    p = os.path.join(APP_DIR, ".env")
    if not os.path.isfile(p):
        return
    try:
        with open(p, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass


_load_dotenv()

# 默认大模型：智谱 BigModel GLM-4.7-Flash（OpenAI 兼容）。
# 仅当未通过环境变量 / .env 指定时才生效；API Key 不写死在本文件，
# 请从仓库根 .env（已 gitignore）或环境变量注入，避免泄露到 git 历史。
os.environ.setdefault("LLM_BASE_URL", "https://open.bigmodel.cn/api/paas/v4/")
os.environ.setdefault("LLM_MODEL", "glm-4.7-flash")

# ---------------------------------------------------------------- 多模型预设（免重启切换）
# 内置多家 OpenAI 兼容服务商；用户只需选 provider + 粘贴 API Key 即可使用，
# 模型列表由预设提供（自定义 provider 允许手填 base_url / model）。
LLM_PRESETS = [
    {"id": "zhipu", "name": "智谱 BigModel（GLM）",
     "base_url": "https://open.bigmodel.cn/api/paas/v4/",
     "models": ["glm-4.7-flash", "glm-4-plus", "glm-4", "glm-4-air", "glm-4-flash", "glm-4-long"],
     "default_model": "glm-4.7-flash"},
    {"id": "deepseek", "name": "DeepSeek",
     "base_url": "https://api.deepseek.com/v1",
     "models": ["deepseek-chat", "deepseek-reasoner"],
     "default_model": "deepseek-chat"},
    {"id": "qwen", "name": "通义千问（阿里云 DashScope）",
     "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
     "models": ["qwen-plus", "qwen-max", "qwen-turbo", "qwen-long", "qwen2.5-72b-instruct"],
     "default_model": "qwen-plus"},
    {"id": "openai", "name": "OpenAI",
     "base_url": "https://api.openai.com/v1",
     "models": ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "gpt-4.1-mini", "gpt-3.5-turbo"],
     "default_model": "gpt-4o-mini"},
    {"id": "moonshot", "name": "月之暗面 Kimi（Moonshot）",
     "base_url": "https://api.moonshot.cn/v1",
     "models": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
     "default_model": "moonshot-v1-8k"},
    {"id": "hunyuan", "name": "腾讯混元（Hunyuan）",
     "base_url": "https://api.hunyuan.cloud.tencent.com/v1",
     "models": ["hunyuan-turbo", "hunyuan-pro", "hunyuan-standard", "hunyuan-lite"],
     "default_model": "hunyuan-turbo"},
    {"id": "doubao", "name": "火山方舟 Doubao（字节）",
     "base_url": "https://ark.cn-beijing.volces.com/api/v3",
     "models": ["doubao-seed-1.6-250615", "doubao-pro-32k-241028",
                "doubao-pro-256k-241115", "doubao-lite-32k-240828"],
     "default_model": "doubao-seed-1.6-250615"},
    {"id": "custom", "name": "自定义（兼容 OpenAI）",
     "base_url": "", "models": [], "default_model": "", "custom": True},
]

LLM_CFG_FILE = os.path.join(APP_DIR, "llm_config.json")
LLM_CFG = {}            # 运行时生效配置：{provider, base_url, api_key, model}


def _provider_of(base_url):
    bu = (base_url or "").rstrip("/")
    for p in LLM_PRESETS:
        if p.get("base_url") and bu and bu == p["base_url"].rstrip("/"):
            return p["id"]
    return "custom"


def _load_llm_cfg():
    """配置优先级：.env / 环境变量  >  llm_config.json（运行时保存，免重启覆盖）。"""
    cfg = {
        "provider": os.environ.get("LLM_PROVIDER", "").strip(),
        "base_url": os.environ.get("LLM_BASE_URL", "").strip(),
        "api_key": os.environ.get("LLM_API_KEY", "").strip(),
        "model": os.environ.get("LLM_MODEL", "").strip(),
    }
    if os.path.isfile(LLM_CFG_FILE):
        try:
            with open(LLM_CFG_FILE, encoding="utf-8") as f:
                d = json.load(f)
            if isinstance(d, dict):
                for k in ("provider", "base_url", "api_key", "model"):
                    if d.get(k):
                        cfg[k] = d[k]
        except Exception:
            pass
    if not cfg.get("provider") and cfg.get("base_url"):
        cfg["provider"] = _provider_of(cfg["base_url"])
    return cfg


def _save_llm_cfg(cfg):
    """把运行时配置写入 llm_config.json（已 gitignore），使下次启动仍生效。"""
    try:
        with open(LLM_CFG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


LLM_CFG = _load_llm_cfg()


def _find_root(start, *markers):
    """从 start 向上查找第一个同时满足所有 markers（相对路径）的目录。"""
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


app = FastAPI(title="9527 法规问答 API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "OPTIONS", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- 工具

def _db_path():
    return os.path.join(KB_ROOT, "00_索引", "kb.sqlite")


def _read_kb_body(rel, cap=4000):
    """从 kb.sqlite 的 fts.body 取某法规正文（按路径）。返回字符串或空。"""
    if not rel:
        return ""
    db = _db_path()
    if not os.path.isfile(db):
        return ""
    try:
        con = sqlite3.connect(db)
        row = con.execute(
            """SELECT f.body FROM fts f
               JOIN ftsmap mp ON mp.rowid_ = f.rowid
               JOIN docs d ON d.id = mp.docid
               WHERE d.path = ? LIMIT 1""",
            (rel.replace("\\", "/"),),
        ).fetchone()
        con.close()
        if row and row[0]:
            t = row[0]
            return t if len(t) <= cap else t[:cap] + "\n…(正文较长，已截断)"
    except Exception:
        return ""
    return ""


def _snippet_from_db(rel, terms, width=120, maxn=2):
    body = _read_kb_body(rel, cap=20000)
    if not body:
        return []
    outs = []
    for t in terms:
        i = body.find(t)
        if i < 0:
            continue
        s = max(0, i - width // 2)
        e = min(len(body), i + len(t) + width // 2)
        frag = body[s:e].replace("\n", " ").strip()
        frag = re.sub(r"\s+", " ", frag)
        outs.append(("…" if s > 0 else "") + frag + ("…" if e < len(body) else ""))
        if len(outs) >= maxn:
            break
    return outs


def _llm_configured():
    return bool(LLM_CFG.get("base_url") and LLM_CFG.get("api_key")
                and LLM_CFG.get("model"))


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


# ---------------------------------------------------------------- /api/qa（实时检索）

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
    i = text.find("[")
    if i < 0:
        note = (out.stderr or text or "无结果").strip()[:300]
        return {"results": [], "count": 0, "note": note}
    try:
        rows = json.loads(text[i:])
    except Exception:
        return {"results": [], "count": 0, "note": "JSON 解析失败"}
    if not isinstance(rows, list):
        return {"results": [], "count": 0, "note": "格式异常"}
    # 为每个结果补算档位 tier
    terms = [t for t in re.findall(r'"([^"]+)"|(\S+)', q or "")]
    terms = [a or b for a, b in terms]
    for r in rows:
        if isinstance(r, dict):
            if "tier" not in r:
                r["tier"] = st_tier(r.get("状态"))
            # 命中片段为空时（部署仓库无 .md 原文），改从 fts.body 取真实摘录
            if not r.get("命中片段") and r.get("本地路径"):
                try:
                    r["命中片段"] = _snippet_from_db(r["本地路径"], terms)
                except Exception:
                    pass
    return {"results": rows, "count": len(rows), "source": "live"}


@app.get("/api/health")
def health():
    kb_sqlite = _db_path()
    return {
        "ok": True,
        "kb_root": KB_ROOT,
        "static_root": STATIC,
        "kb_query": KB_QUERY,
        "kb_sqlite_present": os.path.isfile(kb_sqlite),
        "llm_configured": _llm_configured(),
        "llm_provider": LLM_CFG.get("provider", "") or _provider_of(LLM_CFG.get("base_url", "")),
        "llm_model": LLM_CFG.get("model", ""),
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


# ---------------------------------------------------------------- /api/qa-rag（真·问答）

_RAG_SYSTEM = """你是中国药品法规专家「9527」。只依据下面提供的法规正文作答，不得凭记忆编造条款。

工作流：
1. 检索已由系统完成（下方「法规材料」是知识库检索结果，已按相关度+效力层级排序）。
2. 时效核验（强制）：逐条看其「状态」。
   - 现行有效 / 现行有效（试行）：可直接引用。
   - 现行有效（尚未生效）/（YYYY-MM-DD 起施行）：引用须标注施行日期。
   - 征求意见 / 征求意见（已截止）：只能作趋势参考，须明示「尚未生效，仅供参考」。
   - 已废止：不得作为依据；若问历史沿革，可说明废止情况并指向替代文件。
   - 同名多版本（如 GCP 2026 修订版 vs 2020 版、GMP 多版）须取最新现行版。
3. 分层引用：法律 > 行政法规 > 部门规章 > 技术指导原则 > 规范性文件 > 行业共识。
   上位法与下位文件冲突时，以上位法为准并明确指出冲突。
4. 输出严格 JSON，结构：
{
 "结论":"一句话直答（基于材料）",
 "法规依据":[{"标题":"","引用原文":"逐字摘录关键条款，不改写","本地路径":"","来源":"","文号":"","发布日期":"","状态":""}],
 "适用提示":"实操要点 / 常见误区 / 例外",
 "时效说明":"生效与废止 / 同名版本情况；无则写『以上均为现行有效文件』"
}

硬性规则：
- 引用原文须逐字摘录，不要概括；每条依据须带 本地路径 + 来源 + 文号 + 发布日期 + 状态（取自材料）。
- 区分层级：技术指导原则是推荐性，除非被规章/公告强制引用，不得说成强制要求。
- 国外参考（WTO/FDA/EMA 译文）不是中国法定依据，仅对照参考并明示。
- 医疗器械 / 化妆品问题：本库聚焦药品，须说明超出范围。
- 材料未收录该问题：结论写「知识库未收录，建议前往官网核实」，并给出官网栏目地址。
- 只输出 JSON，不要任何额外文字或 markdown 代码块标记。"""


class _RateLimited(Exception):
    """大模型调用被限流（如免费额度耗尽）。"""
    pass


_RAG_CACHE = {}            # (q, only_valid) -> (timestamp, answer)
_RAG_CACHE_TTL = 3600     # 1 小时


def _call_llm(system, user, attempts=2):
    """调用 OpenAI 兼容 chat/completions。未配置返回 None；限流抛 _RateLimited。"""
    base = LLM_CFG.get("base_url", "").strip()
    key = LLM_CFG.get("api_key", "").strip()
    model = LLM_CFG.get("model", "").strip()
    if not (base and key and model):
        return None
    url = base.rstrip("/") + "/chat/completions"
    # 部分推理模型（deepseek-reasoner / o1 / r1 等）不支持 response_format 与自定义 temperature
    no_json = bool(re.search(r"reasoner|o1|o3|o4|r1|deepseek-reasoner", model, re.I))
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    if not no_json:
        payload["temperature"] = 0.2
        payload["response_format"] = {"type": "json_object"}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json",
                 "Authorization": "Bearer " + key},
    )
    timeout = int(os.environ.get("LLM_TIMEOUT", "60") or "60")
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                j = json.loads(r.read().decode("utf-8"))
            return j["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode("utf-8", "ignore")
            except Exception:
                body = ""
            if e.code == 429 or "1302" in body or "rate" in body.lower():
                raise _RateLimited(body or "rate limited")
            if attempt < attempts - 1:
                time.sleep(6)
        except Exception:
            if attempt < attempts - 1:
                time.sleep(6)
    return None


def _kb_one(q, only_valid):
    """Run kb_query.py for a single query string; returns list of rows."""
    cmd = [PY, KB_QUERY, q, "--json", "-n", "8"]
    if only_valid:
        cmd += ["--only-valid"]
    try:
        out = subprocess.run(cmd, cwd=KB_ROOT, capture_output=True,
                             text=True, timeout=25)
    except Exception:
        return []
    t = out.stdout or ""
    i = t.find("[")
    if i < 0:
        return []
    try:
        rows = json.loads(t[i:])
    except Exception:
        return []
    return rows if isinstance(rows, list) else []


def _derive_queries(q):
    """Derive candidate search strings from a natural-language question.

    背景：kb.sqlite 的 FTS 对中文不做分词，长串（如『化学药1类』）往往搜不到，
    但短关键词（『化学药』『注册分类』）能命中。故派生多组候选：英文缩写优先，
    再补中文前缀 n-gram，逐组检索并去重合并。
    e.g. 'GLP适用于哪些非临床研究？' -> ['原句','GLP','GLP 非临床研究','非临床研究','非临床',...]
         '化学药1类是怎么定义的？'   -> ['原句','化学药1类','化学药1','化学药','化学']
    """
    q = (q or "").strip()
    if not q:
        return []
    acros = [a.upper() for a in re.findall(r"[A-Za-z]{2,}", q)]
    # 清洗：去掉英文/标点/空格，保留中文与数字（如「1类」）
    cn = re.sub(r"[A-Za-z？?。\.，,\s]+", "", q)
    cn = re.sub(r"(哪些|如何|怎样|怎么|什么|是|的|吗|呢|适用于|适用|需要|请|问|关于|可以|是否|与|和|及|对|进行|要求|问题|指|定义|含义|说明|介绍|概括|指的|制度|规定|内容|方面|相关|具体)", "", cn).strip()
    cands = [q]
    # 英文缩写最具体，优先
    if acros:
        cands.append(" ".join(acros))
        if cn:
            for a in acros:
                cands.append((a + " " + cn)[:16])
    # 中文：原串 + 前缀 n-gram（4/3/2），缓解不分词导致的漏检
    if cn:
        cands.append(cn)
        for k in (4, 3, 2):
            if len(cn) >= k:
                cands.append(cn[:k])
    return cands


def _kb_retrieve(q, only_valid):
    """多轮检索：主查询；结果偏少时再做一次「含废止/征求」的放宽查询并去重合并。"""
    """Multi-pass retrieve: original + derived keywords, dedup merge;
    if too few hits, broaden (incl. repealed/draft)."""
    cands = _derive_queries(q)
    merged, seen = [], set()

    def _add(r):
        p = (r.get("本地路径") or "") if isinstance(r, dict) else ""
        if p and p not in seen:
            seen.add(p)
            merged.append(r)

    for cq in cands:
        for r in _kb_one(cq, True):
            _add(r)
        if len(merged) >= 6:
            break
    if len(merged) < 4:
        for cq in cands:
            for r in _kb_one(cq, False):
                _add(r)
            if len(merged) >= 6:
                break
    return merged[:8]


def _build_rag_prompt(q, docs_ctx):
    lines = ["问题：%s\n" % q, "法规材料（按相关度排序，已附状态）：\n"]
    for i, d in enumerate(docs_ctx, 1):
        m = d["meta"]
        head = "%d. 《%s》（%s，%s，%s，状态：%s）" % (
            i, m.get("标题", ""), m.get("发布机构", ""),
            m.get("文号") or "—", m.get("发布日期") or "—", m.get("状态", ""))
        lines.append(head)
        lines.append("   本地：%s　来源：%s" % (m.get("本地路径", ""), m.get("来源", "")))
        body = (d["body"] or "").strip()
        if len(body) > 3500:
            body = body[:3500] + "\n…(正文较长，已截断)"
        lines.append(body)
        lines.append("")
    return _RAG_SYSTEM, "\n".join(lines)


def _parse_llm_json(raw):
    raw = (raw or "").strip()
    try:
        return json.loads(raw)
    except Exception:
        pass
    m = re.search(r"\{.*\}", raw, re.S)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return {"结论": raw or "（模型未返回有效内容）",
            "法规依据": [], "适用提示": "", "时效说明": ""}


def _rag_query(q, only_valid):
    cache_key = (q, bool(only_valid))
    now = time.time()
    cached = _RAG_CACHE.get(cache_key)
    if cached and now - cached[0] < _RAG_CACHE_TTL:
        ans = dict(cached[1])
        ans["source"] = "rag"
        ans["cached"] = True
        return ans
    rows = _kb_retrieve(q, only_valid)
    if not rows:
        return {
            "结论": "知识库未检索到与「%s」直接匹配的法规条文。建议换用更规范的表述"
                    "（如 GMP / 生产质量管理规范），或前往官网核实。" % q,
            "法规依据": [], "适用提示": "", "时效说明": "",
            "source": "rag", "empty": True,
        }
    docs_ctx = []
    for r in rows[:6]:
        rel = r.get("本地路径", "")
        docs_ctx.append({"meta": r, "body": _read_kb_body(rel)})
    sys_p, usr_p = _build_rag_prompt(q, docs_ctx)
    try:
        raw = _call_llm(sys_p, usr_p)
    except _RateLimited:
        return {"error": "llm_rate_limited", "fallback": True}
    if not raw:
        return {"error": "llm_not_configured", "fallback": True}
    ans = _parse_llm_json(raw)
    ans["source"] = "rag"
    _RAG_CACHE[cache_key] = (now, ans)
    return ans


@app.get("/api/qa-rag")
@app.post("/api/qa-rag")
async def api_qa_rag(request: Request):
    q, only_valid = "", True
    if request.method == "POST":
        try:
            body = await request.json()
        except Exception:
            body = {}
        if not isinstance(body, dict):
            body = {}
        q = (body.get("q") or "")
        only_valid = body.get("only_valid", True)
    else:
        q = request.query_params.get("q", "")
        only_valid = request.query_params.get("only_valid", "true") != "false"
    if not q or not q.strip():
        return JSONResponse({"error": "missing q"}, status_code=400)
    try:
        return _rag_query(q.strip(), only_valid)
    except Exception as e:
        return JSONResponse({"error": str(e), "fallback": True}, status_code=500)


# ---------------------------------------------------------------- /api/llm-*（模型切换，免重启）

@app.get("/api/llm-presets")
def llm_presets():
    """返回内置服务商预设（含 base_url 与可选模型）。"""
    return {"presets": LLM_PRESETS, "configurable": True}


@app.get("/api/llm-config")
def llm_config_get():
    """返回当前生效配置（不回传明文 key，仅给掩码与是否已设置标记）。"""
    key = LLM_CFG.get("api_key", "")
    masked = (key[:6] + "…" + key[-4:]) if len(key) > 10 else (key or "")
    return {
        "provider": LLM_CFG.get("provider", "") or _provider_of(LLM_CFG.get("base_url", "")),
        "base_url": LLM_CFG.get("base_url", ""),
        "model": LLM_CFG.get("model", ""),
        "configured": _llm_configured(),
        "key_set": bool(key),
        "api_key_masked": masked,
    }


@app.post("/api/llm-config")
async def llm_config_post(request: Request):
    """运行时设置模型：选 provider + 粘贴 API Key 即可；自定义还需填 base_url/model。
    保存后写入 llm_config.json，立即生效且下次启动保留（免重启）。"""
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    provider = (body.get("provider") or "").strip()
    api_key = (body.get("api_key") or "").strip()
    model = (body.get("model") or "").strip()
    base_url = (body.get("base_url") or "").strip()
    # 空 API Key 表示沿用当前已配置的 key（便于仅切换模型/服务商，无需重复粘贴）
    if not api_key and LLM_CFG.get("api_key"):
        api_key = LLM_CFG["api_key"]
    preset = next((p for p in LLM_PRESETS if p["id"] == provider), None)
    if not preset:
        return JSONResponse({"ok": False, "error": "未知的服务商 provider"}, status_code=400)
    if not preset.get("custom"):
        # 内置服务商：base_url 固定取自预设；model 为空则用默认模型
        base_url = preset["base_url"]
        if not model:
            model = preset.get("default_model", "")
    if not (base_url and api_key and model):
        missing = []
        if not api_key:
            missing.append("API Key")
        if not model:
            missing.append("模型" if preset.get("custom") else "模型")
        if preset.get("custom") and not base_url:
            missing.append("Base URL")
        return JSONResponse({"ok": False,
                             "error": "请填写：" + "、".join(missing)},
                            status_code=400)
    cfg = {"provider": provider, "base_url": base_url,
           "api_key": api_key, "model": model}
    LLM_CFG.clear()
    LLM_CFG.update(cfg)
    _save_llm_cfg(cfg)
    return {"ok": True, "provider": provider, "provider_name": preset["name"],
            "model": model, "base_url": base_url}


# ---------------------------------------------------------------- SPA 回退

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
