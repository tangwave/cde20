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
import concurrent.futures
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

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

# 配置优先级（见 _load_llm_cfg）：环境变量 / .env  >  llm_config.json（文件）  >  预设默认模型。
# 注意：不再用 os.environ.setdefault 注入「默认模型」，否则该隐式默认值会盖过用户在
# llm_config.json 里明确写下的模型（如自定义的 Agnes-2.5-Flash）。仅在文件与环境都未指定时，
# 才回退到对应服务商的 default_model。API Key 不写死在本文件，请从 .env 或环境变量注入。

# ---------------------------------------------------------------- 多模型预设（免重启切换）
# 内置多家 OpenAI 兼容服务商；用户只需选 provider + 粘贴 API Key 即可使用，
# 模型列表由预设提供（自定义 provider 允许手填 base_url / model）。
# 种子预设：首次运行时写入 llm_presets.json；之后以文件为准（用户可增/改/删）。
LLM_PRESETS_DEFAULT = [
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
    {"id": "agnes", "name": "Agnes AI",
     "base_url": "https://api.agnes-ai.cn/v1",
     "models": ["AGNES"], "default_model": "AGNES"},
    # ---- 以下为免费 / 免费额度服务商（OpenAI 兼容，仅需粘贴对应平台的免费 Key 即可用）----
    {"id": "google", "name": "Google Gemini（免费额度）",
     "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
     "models": ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash"],
     "default_model": "gemini-2.5-flash"},
    {"id": "groq", "name": "Groq（免费 · 极速）",
     "base_url": "https://api.groq.com/openai/v1",
     "models": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant",
                "mixtral-8x7b-32768", "gemma2-9b-it"],
     "default_model": "llama-3.3-70b-versatile"},
    {"id": "openrouter", "name": "OpenRouter（含免费模型）",
     "base_url": "https://openrouter.ai/api/v1",
     "models": ["meta-llama/llama-3.3-70b-instruct:free", "google/gemini-flash-1.5:free",
                "deepseek/deepseek-r1-distill-llama-70b:free", "qwen/qwen2.5-72b-instruct:free",
                "mistralai/mistral-7b-instruct:free"],
     "default_model": "meta-llama/llama-3.3-70b-instruct:free"},
    {"id": "mistral", "name": "Mistral（免费额度）",
     "base_url": "https://api.mistral.ai/v1",
     "models": ["mistral-small-latest", "open-mistral-7b", "mistral-large-latest"],
     "default_model": "mistral-small-latest"},
    {"id": "perplexity", "name": "Perplexity（原生联网搜索）",
     "base_url": "https://api.perplexity.ai",
     "models": ["sonar", "sonar-reasoning", "sonar-pro"], "default_model": "sonar"},
    {"id": "siliconflow", "name": "硅基流动 SiliconFlow（含免费）",
     "base_url": "https://api.siliconflow.cn/v1",
     "models": ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct",
                "meta-llama/Llama-3.1-8B-Instruct", "THUDM/glm-4-9b-chat"],
     "default_model": "deepseek-ai/DeepSeek-V3"},
    {"id": "together", "name": "Together AI（免费额度）",
     "base_url": "https://api.together.xyz/v1",
     "models": ["meta-llama/Llama-3.3-70B-Instruct-Turbo",
                "Qwen/Qwen2.5-72B-Instruct-Turbo", "deepseek-ai/DeepSeek-V3"],
     "default_model": "meta-llama/Llama-3.3-70B-Instruct-Turbo"},
    {"id": "github", "name": "GitHub Models（免费）",
     "base_url": "https://models.inference.ai.azure.com",
     "models": ["gpt-4o-mini", "gpt-4o", "Phi-3.5-mini-instruct", "Meta-Llama-3.1-405B-Instruct"],
     "default_model": "gpt-4o-mini"},
    {"id": "custom", "name": "自定义（兼容 OpenAI）",
     "base_url": "", "models": [], "default_model": "", "custom": True},
]

LLM_PRESETS_FILE = os.path.join(APP_DIR, "llm_presets.json")
LLM_PRESETS = []            # 运行时生效预设（来自 llm_presets.json，缺省用种子）


def _load_presets():
    """加载内置模型预设：优先 llm_presets.json（用户增删改后的持久化结果）；
    文件不存在/损坏则用 LLM_PRESETS_DEFAULT 种子并写盘。

    合并策略：以文件内容为准；若种子默认项中有「文件里缺失的 id」（例如升级后
    新增的免费模型），则自动补齐并写回，使新模型对老用户立即可见，且不会覆盖
    用户对已有模型的自定义编辑。"""
    data = None
    if os.path.isfile(LLM_PRESETS_FILE):
        try:
            with open(LLM_PRESETS_FILE, encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = None
    if isinstance(data, list) and data:
        out = []
        for p in data:
            if not isinstance(p, dict) or not p.get("id"):
                continue
            out.append({
                "id": str(p["id"]),
                "name": p.get("name", p["id"]),
                "base_url": p.get("base_url", ""),
                "models": p.get("models") or [],
                "default_model": p.get("default_model", ""),
                "custom": bool(p.get("custom")),
            })
        if out:
            # 补齐缺失的默认项（新增免费模型等），避免老用户看不到
            ids = {p["id"] for p in out}
            added = False
            for d in LLM_PRESETS_DEFAULT:
                if d["id"] not in ids:
                    out.append(dict(d))
                    added = True
            if added:
                try:
                    with open(LLM_PRESETS_FILE, "w", encoding="utf-8") as f:
                        json.dump(out, f, ensure_ascii=False, indent=2)
                except Exception:
                    pass
            return out
    # 用种子写盘，便于后续编辑
    try:
        with open(LLM_PRESETS_FILE, "w", encoding="utf-8") as f:
            json.dump(LLM_PRESETS_DEFAULT, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    return [dict(p) for p in LLM_PRESETS_DEFAULT]


def _save_presets(presets):
    """写回 llm_presets.json 并同步运行时全局。"""
    global LLM_PRESETS
    LLM_PRESETS = presets
    try:
        with open(LLM_PRESETS_FILE, "w", encoding="utf-8") as f:
            json.dump(presets, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


LLM_PRESETS = _load_presets()

LLM_CFG_FILE = os.path.join(APP_DIR, "llm_config.json")
LLM_CFG = {}            # 运行时生效配置（effective）：{provider, base_url, api_key, model}
LLM_KEYS = {}           # 每个服务商独立保存的 API Key：{provider_id: api_key}
LLM_CUSTOM = {}         # 自定义服务商配置：{base_url, model}


def _provider_of(base_url):
    bu = (base_url or "").rstrip("/")
    for p in LLM_PRESETS:
        if p.get("base_url") and bu and bu == p["base_url"].rstrip("/"):
            return p["id"]
    return "custom"


def _load_llm_cfg():
    """配置优先级：.env / 环境变量  >  llm_config.json（运行时保存，免重启覆盖）。
    支持『每个服务商独立保存 API Key』（llm_config.json 的 keys 字典），
    这样在前端下拉框里切换模型/服务商时无需重复粘贴 Key。旧版单 Key 格式自动兼容。"""
    global LLM_KEYS, LLM_CUSTOM
    LLM_KEYS = {}
    LLM_CUSTOM = {}
    raw = {}
    if os.path.isfile(LLM_CFG_FILE):
        try:
            with open(LLM_CFG_FILE, encoding="utf-8") as f:
                raw = json.load(f) or {}
        except Exception:
            raw = {}
    if not isinstance(raw, dict):
        raw = {}
    provider = (os.environ.get("LLM_PROVIDER") or raw.get("provider") or "").strip()
    # 文件中的 base_url / model 优先于（可能存在的）隐式环境默认值；真实环境变量仍会胜出
    base_url = (raw.get("base_url") or os.environ.get("LLM_BASE_URL") or "").strip()
    model = (raw.get("model") or os.environ.get("LLM_MODEL") or "").strip()
    # 每个服务商独立的 API Key
    keys = {}
    if isinstance(raw.get("keys"), dict):
        keys = {str(k): str(v) for k, v in raw["keys"].items() if v}
    elif raw.get("api_key"):
        p0 = provider or _provider_of(base_url)
        if p0:
            keys[p0] = raw["api_key"]
    env_key = os.environ.get("LLM_API_KEY", "").strip()
    if env_key:
        p0 = provider or _provider_of(base_url)
        if p0:
            keys[p0] = env_key
    custom = raw.get("custom") if isinstance(raw.get("custom"), dict) else {}
    LLM_KEYS = keys
    LLM_CUSTOM = custom
    if not provider and base_url:
        provider = _provider_of(base_url)
    if provider:
        preset = next((p for p in LLM_PRESETS if p["id"] == provider), None)
        if preset and not preset.get("custom"):
            base_url = preset["base_url"]
            if not model:
                model = preset.get("default_model", "")
    effective = keys.get(provider, "")
    return {"provider": provider, "base_url": base_url,
            "api_key": effective, "model": model}


def _save_llm_cfg(cfg):
    """把运行时配置写入 llm_config.json（已 gitignore），使下次启动仍生效。
    持久化 provider / model / 各服务商 keys / 自定义项；敏感 Key 仅本地保存，不回传前端。"""
    try:
        out = {
            "provider": cfg.get("provider", ""),
            "model": cfg.get("model", ""),
            "keys": LLM_KEYS,
        }
        if LLM_CUSTOM:
            out["custom"] = LLM_CUSTOM
        with open(LLM_CFG_FILE, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
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


_WEB_SYSTEM = """你是中国药品法规 AI 助手「Agnes AI」。你正在使用「AI 联网搜索」模式：系统已为你实时检索了公开网络结果（见下方「检索材料」），请综合这些信息回答用户关于药品注册、GLP/GCP/GMP/GVP、MAH、上市后变更等法规问题；若检索材料不足以完全覆盖，可结合你的通用知识补充，但需注明。

要求：
1. 以四段式 JSON 作答：
{
 "结论":"一句话直答",
 "法规依据":[{"标题":"","引用原文":"关键条款摘录（来自检索材料请标注编号如 [1]；来自自身记忆请注明，切勿编造文号/日期","来源":"","发布日期":"","状态":""}],
 "适用提示":"实操要点 / 常见误区",
 "时效说明":"当前是否有效、是否有更新趋势；不确定请注明『以官方最新发布为准』"
}
2. 引用规范：对检索材料中的信息，在结论 / 依据里用 [1]、[2] 等编号对应下方来源；务必保证编号与「检索材料」列表顺序一致。
3. 不依赖本地知识库；凡引用法规尽量给出准确发布机构、文号、发布日期与状态；若不确定请明确说明，不要编造。
4. 医疗器械 / 化妆品问题：本库聚焦药品，须说明超出范围。
5. 只输出 JSON，不要任何额外文字或 markdown 代码块标记。"""


class _RateLimited(Exception):
    """大模型调用被限流（如免费额度耗尽）。"""
    pass


_RAG_CACHE = {}            # (q, only_valid) -> (timestamp, answer)
_RAG_CACHE_TTL = 3600     # 1 小时


def _build_llm_request(system, user, strip_json):
    """构造 OpenAI 兼容 chat/completions 请求。strip_json=True 时去掉
    response_format / temperature（部分免费模型不支持，会返回 400）。"""
    base = LLM_CFG.get("base_url", "").strip()
    key = LLM_CFG.get("api_key", "").strip()
    model = LLM_CFG.get("model", "").strip()
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
    if not no_json and not strip_json:
        payload["temperature"] = 0.2
        payload["response_format"] = {"type": "json_object"}
    data = json.dumps(payload).encode("utf-8")
    return urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json",
                 "Authorization": "Bearer " + key},
    )


def _call_llm(system, user, attempts=2):
    """调用 OpenAI 兼容 chat/completions。未配置返回 None；限流抛 _RateLimited。"""
    base = LLM_CFG.get("base_url", "").strip()
    key = LLM_CFG.get("api_key", "").strip()
    model = LLM_CFG.get("model", "").strip()
    if not (base and key and model):
        return None
    return _call_llm_ex(system, user, attempts=attempts)[0]


def _call_llm_ex(system, user, attempts=2):
    """同 _call_llm，但额外返回 citations（Perplexity 等会返回联网引用 URL 列表）。

    返回 (content_or_None, [citation_url, ...])。兼容策略：
    - 限流（429）抛 _RateLimited；
    - 部分免费模型不支持 response_format/temperature（400），自动去掉后重试一次；
    - 其余异常按 attempts 重试。"""
    base = LLM_CFG.get("base_url", "").strip()
    key = LLM_CFG.get("api_key", "").strip()
    model = LLM_CFG.get("model", "").strip()
    if not (base and key and model):
        return None, []
    req = _build_llm_request(system, user, False)
    timeout = int(os.environ.get("LLM_TIMEOUT", "60") or "60")
    retried = False
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read().decode("utf-8")
            j = json.loads(raw)
            content = j["choices"][0]["message"]["content"]
            cites = j.get("citations") or []
            if not isinstance(cites, list):
                cites = []
            return content, [str(c) for c in cites if c]
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode("utf-8", "ignore")
            except Exception:
                body = ""
            if e.code == 429 or "1302" in body or "rate" in body.lower():
                raise _RateLimited(body or "rate limited")
            # 部分免费模型不支持 response_format/temperature：去掉后重试一次
            if e.code == 400 and not retried:
                retried = True
                req = _build_llm_request(system, user, True)
                continue
            if attempt < attempts - 1:
                time.sleep(6)
        except Exception:
            if attempt < attempts - 1:
                time.sleep(6)
    return None, []


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


def _rag_query(q, only_valid, mode="local"):
    if mode == "web":
        return _web_query(q)
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


# ---------------------------------------------------------------- 联网检索（AI 联网搜索模式）
# 默认走 keyless 的 DuckDuckGo / Wikipedia；若配置了 TAVILY_API_KEY / BRAVE_API_KEY
# 环境变量，则优先使用对应的免费搜索 API（更稳定、返回结构化结果）。

def _search_tavily(query, n):
    """Tavily 搜索（需 TAVILY_API_KEY 环境变量；有免费额度）。"""
    key = os.environ.get("TAVILY_API_KEY", "").strip()
    if not key:
        return []
    try:
        payload = json.dumps({"api_key": key, "query": query,
                              "max_results": n, "search_depth": "basic"}).encode("utf-8")
        req = urllib.request.Request("https://api.tavily.com/search", data=payload,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as r:
            j = json.loads(r.read().decode("utf-8", "ignore"))
        out = []
        for it in j.get("results", []) or []:
            out.append({"title": (it.get("title") or "").strip(),
                        "url": (it.get("url") or "").strip(),
                        "snippet": re.sub(r"<[^>]+>", "", str(it.get("content", ""))).strip()})
        return out
    except Exception:
        return []


def _search_brave(query, n):
    """Brave Search API（需 BRAVE_API_KEY 环境变量；有免费额度）。"""
    key = os.environ.get("BRAVE_API_KEY", "").strip()
    if not key:
        return []
    try:
        url = ("https://api.search.brave.com/res/v1/web/search?q="
               + urllib.parse.quote(query) + "&count=" + str(n))
        req = urllib.request.Request(url, headers={
            "Accept": "application/json",
            "X-Subscription-Token": key,
        })
        with urllib.request.urlopen(req, timeout=10) as r:
            j = json.loads(r.read().decode("utf-8", "ignore"))
        out = []
        for it in (j.get("web", {}) or {}).get("results", []) or []:
            out.append({"title": (it.get("title") or "").strip(),
                        "url": (it.get("url") or "").strip(),
                        "snippet": re.sub(r"<[^>]+>", "", str(it.get("description", ""))).strip()})
        return out
    except Exception:
        return []


def _search_ddg(query, n):
    """DuckDuckGo HTML（keyless，尽力解析结果）。"""
    try:
        data = urllib.parse.urlencode({"q": query, "kl": "cn-zh"}).encode("utf-8")
        req = urllib.request.Request("https://html.duckduckgo.com/html/", data=data, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            "Content-Type": "application/x-www-form-urlencoded",
        })
        with urllib.request.urlopen(req, timeout=5) as r:
            html = r.read().decode("utf-8", "ignore")
    except Exception:
        return []
    titles = re.findall(r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, re.S)
    snips = re.findall(r'class="result__snippet"[^>]*>(.*?)</a>', html, re.S)
    out = []
    for i, (href, title) in enumerate(titles):
        title = re.sub(r"<[^>]+>", "", title).strip()
        snippet = re.sub(r"<[^>]+>", "", snips[i]).strip() if i < len(snips) else ""
        m = re.search(r"uddg=([^&]+)", href)
        real = urllib.parse.unquote(m.group(1)) if m else href
        if real.startswith("//"):
            real = "https:" + real
        if title and real:
            out.append({"title": title, "url": real, "snippet": snippet})
        if len(out) >= n:
            break
    return out


def _search_wiki(query, n):
    """Wikipedia 搜索 API（keyless，适合概念 / 术语类问题）。"""
    try:
        url = ("https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch="
               + urllib.parse.quote(query) + "&format=json&srlimit=" + str(n))
        req = urllib.request.Request(url, headers={"User-Agent": "AgnesAI/1.0"})
        with urllib.request.urlopen(req, timeout=5) as r:
            j = json.loads(r.read().decode("utf-8", "ignore"))
        out = []
        for it in (j.get("query", {}) or {}).get("search", []) or []:
            title = (it.get("title") or "").strip()
            snippet = re.sub(r"<[^>]+>", "", str(it.get("snippet", ""))).strip()
            out.append({"title": title,
                        "url": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
                        "snippet": snippet})
        return out
    except Exception:
        return []


class _BingParser(HTMLParser):
    """用标准库解析 Bing 结果页，正确应对 <li class="b_algo" ...> 带额外属性
    以及块内嵌套 </li> 的情况（正则非贪婪匹配会提前截断，导致取不到标题链接）。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.results = []
        self.block = None
        self.stack = []          # b_algo 块内已打开的标签栈（用于匹配嵌套 </li>）
        self.in_h2 = False
        self.in_a_h2 = False
        self.in_p = False
        self.a_buf = []
        self.p_buf = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "li":
            cls = (d.get("class") or "")
            if "b_algo" in cls.split():
                self.block = {"title": "", "url": "", "snippet": ""}
                self.stack = ["li"]
                return
            if self.block is not None:
                self.stack.append(tag)
        if self.block is None:
            return
        if tag == "h2":
            self.in_h2 = True
        elif tag == "a" and self.in_h2 and not self.block["url"]:
            href = d.get("href", "")
            if (href.startswith("http") and "bing.com/ck/a" not in href
                    and "bing.com/aclick" not in href):
                self.block["url"] = href
                self.in_a_h2 = True
                self.a_buf = []
        elif tag == "p" and not self.block["snippet"]:
            self.in_p = True
            self.p_buf = []

    def handle_endtag(self, tag):
        if self.block is None:
            return
        if tag == "a" and self.in_a_h2:
            self.block["title"] = re.sub(r"\s+", " ", "".join(self.a_buf)).strip()
            self.in_a_h2 = False
            self.a_buf = []
        if tag == "h2":
            self.in_h2 = False
        if tag == "p" and self.in_p:
            self.block["snippet"] = re.sub(r"\s+", " ", "".join(self.p_buf)).strip()
            self.in_p = False
            self.p_buf = []
        if tag == "li":
            if self.stack and self.stack[-1] == "li":
                self.stack.pop()
                if not self.stack:
                    b = self.block
                    if b["title"] and b["url"]:
                        self.results.append(b)
                    self.block = None
            elif self.stack:
                self.stack.pop()

    def handle_data(self, data):
        if self.block is None:
            return
        if self.in_a_h2:
            self.a_buf.append(data)
        elif self.in_p:
            self.p_buf.append(data)


def _search_bing(query, n, host="www.bing.com"):
    """必应搜索（keyless，中国大陆可访问，作为主力免费检索源）。"""
    try:
        url = ("https://" + host + "/search?q=" + urllib.parse.quote(query)
               + "&setlang=zh-CN&ensearch=0")
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            "Accept-Language": "zh-CN,zh;q=0.9",
        })
        with urllib.request.urlopen(req, timeout=8) as r:
            html = r.read().decode("utf-8", "ignore")
    except Exception:
        return []
    p = _BingParser()
    try:
        p.feed(html)
    except Exception:
        return []
    return p.results[:n]


def _web_search(query, max_results=6):
    """实时联网检索：聚合多个免费来源，去重返回 [{title,url,snippet}]。

    优先级：Tavily/Brave（若配置了环境变量 Key，结果最结构化）> 并行抓取
    Bing（国内容易访问）/ DuckDuckGo / Wikipedia（keyless）。全部失败则返回空列表。
    关键源并行执行，把总耗时收敛到单个超时上限，避免串行累加导致前端长时间等待。"""
    results, seen = [], set()

    def _add(items):
        for it in items:
            u = (it.get("url") or "").strip()
            if u and u not in seen and len(results) < max_results:
                seen.add(u)
                results.append({"title": (it.get("title") or "").strip(),
                                "url": u,
                                "snippet": (it.get("snippet") or "").strip()})

    # 1) 先快速试「需 Key 的优质源」（无 Key 立即返回空，不耗时）
    _add(_search_tavily(query, max_results))
    _add(_search_brave(query, max_results))
    if len(results) >= max_results:
        return results[:max_results]
    # 2) keyless 源并行抓取（Bing 为主力，DDG/Wiki 补充）
    keyless = [_search_bing, _search_ddg, _search_wiki]
    ex = concurrent.futures.ThreadPoolExecutor(max_workers=len(keyless))
    try:
        futs = {ex.submit(fn, query, max_results): fn for fn in keyless}
        for fut in concurrent.futures.as_completed(futs):
            try:
                _add(fut.result() or [])
            except Exception:
                pass
            if len(results) >= max_results:
                break
    finally:
        # 不阻塞等待：DDG/Wiki 在某些环境会超时，Bing 已先行返回即可立即返回
        ex.shutdown(wait=False)
    # 3) Bing 主源兜底：若 www 被区域拦截，再试 cn.bing.com
    if not results:
        _add(_search_bing(query, max_results, host="cn.bing.com"))
    return results[:max_results]


def _web_query(q):
    """AI 联网搜索模式：先实时检索公开网络，再交给大模型综合作答并带 [n] 引用。

    - 检索：DuckDuckGo / Wikipedia（keyless）+ 可选 Tavily/Brave（免费 Key）。
    - 综合：把检索结果作为上下文喂给大模型，要求按 [1][2] 引用来源。
    - 若所选模型本身具备原生联网（如 Perplexity sonar），则直接利用其返回的真实
      citations 作为来源（更权威）。
    - 降级：大模型未配置/不可用时，仍返回真实检索结果，保证「联网检索」可用。"""
    cache_key = ("web", q)
    now = time.time()
    cached = _RAG_CACHE.get(cache_key)
    if cached and now - cached[0] < _RAG_CACHE_TTL:
        ans = dict(cached[1])
        ans["source"] = "web"
        ans["cached"] = True
        return ans
    results = _web_search(q, max_results=6)
    provider = LLM_CFG.get("provider", "")
    # 构造提示：有检索结果则作为上下文；否则请模型凭通用知识作答
    if results:
        ctx = ["【检索材料】（实时网络检索结果，编号对应下方来源）", ""]
        for i, r in enumerate(results, 1):
            ctx.append("[%d] 《%s》\nURL: %s\n摘要: %s" % (i, r["title"], r["url"], r.get("snippet", "")))
        ctx.append("")
        ctx.append("用户问题：" + q)
        user_p = "\n".join(ctx)
    else:
        user_p = q
    try:
        if provider == "perplexity":
            raw, native_cites = _call_llm_ex(_WEB_SYSTEM, user_p)
            # 合并原生引用（真实 URL）到检索来源
            for c in native_cites:
                if c and c not in [r["url"] for r in results]:
                    results.append({"title": c, "url": c, "snippet": ""})
        else:
            raw = _call_llm(_WEB_SYSTEM, user_p)
    except _RateLimited:
        return {"error": "llm_rate_limited", "fallback": True,
                "web_sources": results, "source": "web"}
    if not raw:
        # 模型未配置/不可用：仍返回真实检索结果，保证联网检索可用
        return {"结论": "（当前 AI 模型未配置或不可用，已为你检索到以下实时网络结果）",
                "法规依据": [], "适用提示": "", "时效说明": "",
                "web_sources": results, "source": "web", "llm_error": True}
    ans = _parse_llm_json(raw)
    ans["web_sources"] = results
    ans["source"] = "web"
    _RAG_CACHE[cache_key] = (now, ans)
    return ans


@app.get("/api/qa-rag")
@app.post("/api/qa-rag")
async def api_qa_rag(request: Request):
    q, only_valid, mode = "", True, "local"
    if request.method == "POST":
        try:
            body = await request.json()
        except Exception:
            body = {}
        if not isinstance(body, dict):
            body = {}
        q = (body.get("q") or "")
        only_valid = body.get("only_valid", True)
        mode = (body.get("mode") or "local").strip()
    else:
        q = request.query_params.get("q", "")
        only_valid = request.query_params.get("only_valid", "true") != "false"
        mode = (request.query_params.get("mode") or "local").strip()
    if not q or not q.strip():
        return JSONResponse({"error": "missing q"}, status_code=400)
    try:
        return _rag_query(q.strip(), only_valid, mode)
    except Exception as e:
        return JSONResponse({"error": str(e), "fallback": True}, status_code=500)


# ---------------------------------------------------------------- /api/llm-*（模型切换，免重启）

@app.get("/api/llm-presets")
def llm_presets():
    """返回内置服务商预设（含 base_url 与可选模型）。"""
    return {"presets": LLM_PRESETS, "configurable": True}


@app.post("/api/llm-presets")
async def llm_presets_post(request: Request):
    """新增或更新一个内置模型预设（按 id 覆盖；不存在则新增）。"""
    global LLM_PRESETS
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        return JSONResponse({"ok": False, "error": "请求体应为 JSON 对象"}, status_code=400)
    pid = (body.get("id") or "").strip()
    if not pid:
        return JSONResponse({"ok": False, "error": "缺少 id（服务商标识）"}, status_code=400)
    name = (body.get("name") or "").strip() or pid
    base_url = (body.get("base_url") or "").strip()
    models = body.get("models") or []
    if isinstance(models, str):
        models = [m.strip() for m in models.split(",") if m.strip()]
    models = [str(m) for m in models]
    default_model = (body.get("default_model") or "").strip()
    if not default_model and models:
        default_model = models[0]
    custom = bool(body.get("custom"))
    preset = {"id": pid, "name": name, "base_url": base_url,
              "models": models, "default_model": default_model, "custom": custom}
    new_list = [p for p in LLM_PRESETS if p["id"] != pid]
    new_list.append(preset)
    _save_presets(new_list)
    return {"ok": True, "preset": preset, "presets": LLM_PRESETS}


@app.delete("/api/llm-presets")
async def llm_presets_delete(request: Request):
    """删除一个内置模型预设（custom 受保护不可删；删除当前生效服务商时会重置配置）。"""
    global LLM_PRESETS, LLM_CFG
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    pid = (body.get("id") or "").strip()
    if not pid:
        return JSONResponse({"ok": False, "error": "缺少 id"}, status_code=400)
    target = next((p for p in LLM_PRESETS if p["id"] == pid), None)
    if not target:
        return JSONResponse({"ok": False, "error": "预设不存在"}, status_code=404)
    if target.get("custom"):
        return JSONResponse({"ok": False, "error": "自定义项不可删除"}, status_code=400)
    new_list = [p for p in LLM_PRESETS if p["id"] != pid]
    _save_presets(new_list)
    # 若删除的是当前生效服务商，重置配置避免悬空
    if LLM_CFG.get("provider") == pid:
        LLM_CFG.clear()
        LLM_KEYS.pop(pid, None)
        LLM_CFG.update({"provider": "", "base_url": "", "api_key": "", "model": ""})
        _save_llm_cfg(LLM_CFG)
    return {"ok": True, "presets": LLM_PRESETS}


@app.get("/api/llm-config")
def llm_config_get():
    """返回当前生效配置（不回传明文 key，仅给掩码与是否已设置标记）。"""
    provider = LLM_CFG.get("provider", "") or _provider_of(LLM_CFG.get("base_url", ""))
    key = LLM_KEYS.get(provider, "")
    masked = (key[:6] + "…" + key[-4:]) if len(key) > 10 else (key or "")
    return {
        "provider": provider,
        "base_url": LLM_CFG.get("base_url", ""),
        "model": LLM_CFG.get("model", ""),
        "configured": bool(LLM_CFG.get("base_url") and key and LLM_CFG.get("model")),
        "key_set": bool(key),
        "api_key_masked": masked,
    }


@app.post("/api/llm-config")
async def llm_config_post(request: Request):
    """运行时设置模型：选 provider + 粘贴 API Key 即可；自定义还需填 base_url/model。
    每个服务商的 Key 独立保存（keys 字典），切换时无需重复粘贴。
    保存后写入 llm_config.json，立即生效且下次启动保留（免重启）。"""
    global LLM_KEYS, LLM_CUSTOM
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
    preset = next((p for p in LLM_PRESETS if p["id"] == provider), None)
    if not preset:
        return JSONResponse({"ok": False, "error": "未知的服务商 provider"}, status_code=400)
    # 仅更新当前服务商的 Key；空 Key 表示沿用该服务商已保存的 Key
    keys = dict(LLM_KEYS)
    if api_key:
        keys[provider] = api_key
    if preset.get("custom"):
        if not base_url:
            base_url = (LLM_CUSTOM.get("base_url") or "")
        if not model:
            model = (LLM_CUSTOM.get("model") or "")
    else:
        base_url = preset["base_url"]
        if not model:
            model = preset.get("default_model", "")
    effective = keys.get(provider, "")
    missing = []
    if not effective:
        missing.append("API Key")
    if not model:
        missing.append("模型")
    if preset.get("custom") and not base_url:
        missing.append("Base URL")
    if missing:
        return JSONResponse({"ok": False,
                             "error": "请填写：" + "、".join(missing)},
                            status_code=400)
    LLM_KEYS = keys
    if preset.get("custom"):
        LLM_CUSTOM = {"base_url": base_url, "model": model}
    LLM_CFG.clear()
    LLM_CFG.update({"provider": provider, "base_url": base_url,
                    "api_key": effective, "model": model})
    _save_llm_cfg(LLM_CFG)
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
