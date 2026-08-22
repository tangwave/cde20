#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
海云AI 法规问答 · 实时后端（FastAPI）

设计要点
--------
1. 一个进程同时托管前端静态站点（quality-system-app）与 /api/qa 检索接口，
   免 CORS：把后端部署到某域名根路径，前端用同域 /api/qa 即可。
2. /api/qa 实时查询 kb.sqlite（经 scripts/kb_query.py），返回最新法规引用；
   命中片段改由本服务直接从 fts.body 取真实正文摘录（不依赖外部 .md 文件）。
3. /api/qa-rag：真·问答，三种模式（mode=local | web | hybrid）——
   · local  本地法规库 RAG：多路检索改写 → SQLite FTS5 直查 + 向量语义召回 + 重排 → 全文喂模型；
   · web    AI 联网搜索：AI 提炼检索式 → Bing RSS 等多源检索 → 相关性过滤 → 综合作答；
   · hybrid 深度融合：本地权威原文 + 实时网络材料并行取回，交叉核验后作答。
   统一输出「海云AI 深度推理」结构化 JSON（思考分析/结论/要点解析/法规依据/适用提示/风险提示/
   时效说明/延伸问题）；前端以「结论先行 + 要点列表 + 依据/补充折叠」的精简版式呈现，告别厚重八段式。
   需配置 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL；未配置时优雅回退。
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
import xml.etree.ElementTree as ET
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
# llm_config.json 里明确写下的模型。仅在文件与环境都未指定时，
# 才回退到对应服务商的 default_model。API Key 不写死在本文件，请从 .env 或环境变量注入。

# ---------------------------------------------------------------- 多模型预设（免重启切换）
# 内置多家 OpenAI 兼容服务商；用户只需选 provider + 粘贴 API Key 即可使用，
# 模型列表由预设提供（自定义 provider 允许手填 base_url / model）。
# 种子预设：首次运行时写入 llm_presets.json；之后以文件为准（用户可增/改/删）。
# 2026-08 全量梳理「当前可免费/低成本使用的 AI 模型」：覆盖国内外 13 家 OpenAI 兼容服务商，
# 每家给出 base_url 与免费（或免费起步）模型清单；用户只需在网页里选服务商 + 粘贴 API Key 即可用。
# 免费形态分两类：(1) 真·免费无需付费 Key（OpenRouter :free、智谱/通义/混元/千帆的免费档、
#   Gemini/Groq 免费层、Ollama 本地无需 Key）；(2) 免费额度/代金券起步（Kimi 15 元代金券、
#   硅基流动 2000 万 token、DeepSeek 注册额度）。
# 注意：免费模型 ID 与额度随官方调整，以各平台文档实时为准；新增服务商会被自动并入老用户的
# llm_presets.json（_load_presets 的缺失项补齐逻辑），无需手动改文件。
LLM_PRESETS_DEFAULT = [
    {"id": "openrouter", "name": "OpenRouter（免费模型聚合 · 无需付费 Key）",
     "base_url": "https://openrouter.ai/api/v1",
     "models": [
        "nvidia/nemotron-3-ultra-550b-a55b:free",           # 真免费，Nemotron 3 Ultra 550B 超大模型（中文药学质量最佳，默认）
        "nvidia/nemotron-3-super-120b-a12b:free",           # 真免费，Nemotron 3 Super 120B 强模型
        "nvidia/nemotron-3-nano-30b-a3b:free",              # 真免费，Nemotron 3 Nano 30B A3B
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", # 真免费，Nemotron 3 Nano Omni 多模态推理
        "nvidia/nemotron-3.5-lightning:free",               # 真免费，Nemotron 3.5 极速
        "nvidia/nemotron-3.5-content-safety:free",          # 真免费，Nemotron 3.5 内容安全
        "nvidia/nemotron-nano-9b-v2:free",                   # 真免费，Nemotron Nano 9B
        "dots-studio/dots-3-note-preview:free",             # 真免费，Dots 3 Note 预览（长上下文/笔记场景）
        "thinkingmachines/inkling:free",                    # 真免费，Thinking Machines Lab Inkling
        "thinkingmachines/inkling-small:free",              # 真免费，Thinking Machines Lab Inkling Small
        "cohere/north-mini-code:free",                      # 真免费，代码生成小模型
        "liquid/lfm-2.5-2.6b:free",                         # 真免费，LiquidAI LFM2.5 2.6B 轻量
        "openrouter/free",                                   # 真免费，OpenRouter 免费模型路由器（自动分发到免费档）
     ],
     "default_model": "nvidia/nemotron-3-ultra-550b-a55b:free"},
    {"id": "chatanywhere", "name": "ChatAnywhere（GitHub 免费 Key · GPT/DeepSeek 免费额度）",
     "base_url": "https://api.chatanywhere.tech/v1",
     "models": [
        "gpt-4o-mini",          # 免费 100 次/天，平衡之选（默认）
        "gpt-3.5-turbo",        # 免费 100 次/天
        "gpt-4.1-mini",         # 免费 100 次/天
        "gpt-5-mini",           # 免费 100 次/天
        "gpt-5-nano",           # 免费 100 次/天
        "deepseek-r1",          # 免费 30 次/天，强推理
     ],
     "default_model": "gpt-4o-mini"},
    {"id": "zhipu", "name": "智谱 GLM（glm-4.7-flash / glm-4-flash 永久免费）",
     "base_url": "https://open.bigmodel.cn/api/paas/v4",
     "models": ["glm-4.7-flash", "glm-4-flash", "glm-5.1"], # glm-4.7/4-flash 永久免费 / glm-5.1 旗舰付费
     "default_model": "glm-4.7-flash"},
    {"id": "qwen", "name": "通义千问 Qwen（阿里云百炼 · qwen-turbo 永久免费）",
     "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
     "models": ["qwen-plus", "qwen-turbo", "qwen-long", "qwen2.5-72b-instruct"],
     "default_model": "qwen-plus"},                         # qwen-plus 每日 100 万免费；qwen-turbo 永久免费
    {"id": "kimi", "name": "Kimi（月之暗面 · 15 元永久代金券起步）",
     "base_url": "https://api.moonshot.cn/v1",
     "models": ["kimi-k3", "kimi-k2.7-code", "kimi-k2.6"],  # K3 旗舰(1M 上下文)/K2.7 编码/K2.6 通用
     "default_model": "kimi-k2.6"},
    {"id": "volcengine", "name": "火山方舟 豆包（doubao-lite 每日 200 万免费）",
     "base_url": "https://ark.cn-beijing.volces.com/api/v3",
     "models": ["doubao-lite-32k", "doubao-pro-32k", "doubao-pro-128k"],
     "default_model": "doubao-lite-32k"},                   # doubao-lite 每日 200 万 token 免费
    {"id": "hunyuan", "name": "腾讯混元（hunyuan-lite 永久免费不限量）",
     "base_url": "https://api.hunyuan.cloud.tencent.com/v1",
     "models": ["hunyuan-lite", "hunyuan-turbo-s", "hunyuan-t1"],
     "default_model": "hunyuan-lite"},                       # hunyuan-lite 永久免费不限量
    {"id": "qianfan", "name": "百度千帆（ERNIE-Speed/Lite 永久免费不限量）",
     "base_url": "https://qianfan.baidubce.com/v2",
     "models": ["ernie-speed-8k", "ernie-lite-8k", "ernie-3.5-8k", "ernie-4.5-turbo-128k"],
     "default_model": "ernie-speed-8k"},                     # ERNIE-Speed/Lite/3.5 永久免费不限量
    {"id": "siliconflow", "name": "硅基流动 SiliconFlow（2000 万免费 · 轻量模型永久免费）",
     "base_url": "https://api.siliconflow.cn/v1",
     "models": ["Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1"],
     "default_model": "Qwen/Qwen2.5-7B-Instruct"},           # Qwen2.5-7B 永久免费；其余有免费额度
    {"id": "deepseek", "name": "DeepSeek（V3-Lite 永久免费 · V4 极廉价）",
     "base_url": "https://api.deepseek.com/v1",
     "models": ["deepseek-v3-lite", "deepseek-v4-flash", "deepseek-v4-pro"],
     "default_model": "deepseek-v3-lite"},                   # V3-Lite 永久免费不限量(200万上下文)
    {"id": "gemini", "name": "Google Gemini（gemini-2.5-flash 免费 · 无需信用卡）",
     "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
     "models": ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemma-3-12b-it"],
     "default_model": "gemini-2.5-flash"},                   # gemini-2.5-flash 免费层 500 RPD / 1M 上下文
    {"id": "groq", "name": "Groq（LPU 超快 · 无需信用卡）",
     "base_url": "https://api.groq.com/openai/v1",
     "models": ["llama-3.3-70b-versatile", "llama-4-scout-17b-16e-instruct", "qwen3-32b", "gpt-oss-120b"],
     "default_model": "llama-3.3-70b-versatile"},
    {"id": "mistral", "name": "Mistral AI（La Plateforme 实验计划 · 免信用卡）",
     "base_url": "https://api.mistral.ai/v1",
     "models": ["mistral-small-4", "mistral-medium-3", "mistral-large-3", "mistral-nemo", "codestral", "ministral-8b"],
     "default_model": "mistral-small-4"},                   # 实验计划免费 ~1B tokens/月, OpenAI 兼容, 无需信用卡(需手机验证)
    {"id": "ollama", "name": "Ollama（本地部署 · 无需 API Key）",
     "base_url": "http://localhost:11434/v1",
     "models": ["qwen2.5:7b", "llama3.1", "deepseek-r1:7b"],
     "default_model": "qwen2.5:7b"},                         # 本地运行，数据不出机；Key 可留空
    {"id": "githubmodels", "name": "GitHub Models（GitHub 账号免费 · GPT-4.1/GPT-4o/o3/o4-mini）",
     "base_url": "https://models.inference.ai.azure.com",
     "models": ["gpt-4.1", "gpt-4o", "gpt-4o-mini", "o3-mini", "o4-mini", "Meta-Llama-3.3-70B-Instruct", "Phi-4"],
     "default_model": "gpt-4.1"},                            # 免费层：GitHub 细粒度 PAT(需 Models 权限)，无需信用卡
    {"id": "nvidia_nim", "name": "NVIDIA NIM（nvapi Key · DeepSeek V4 Flash 1M 上下文免费）",
     "base_url": "https://integrate.api.nvidia.com/v1",
     "models": ["deepseek-ai/deepseek-v4-flash", "meta/llama-3.3-70b-instruct",
                "nvidia/llama-3.3-nemotron-super-49b-v1.5", "qwen/qwen3.5-122b-a10b",
                "minimaxai/minimax-m2.7", "z-ai/glm-5.1"],
     "default_model": "deepseek-ai/deepseek-v4-flash"},      # 免费 1000-5000 积分(永不过期)/40 RPM，无需信用卡
    {"id": "cerebras", "name": "Cerebras（全球最快推理 · 1M tokens/天免费）",
     "base_url": "https://api.cerebras.ai/v1",
     "models": ["llama-3.3-70b", "llama3.1-70b", "gpt-oss-120b", "qwen-3-32b", "gemma-4-31b"],
     "default_model": "llama-3.3-70b"},                      # 免费 1M TPD/30 RPM，无需信用卡；免费档上下文 8K
    {"id": "agnes", "name": "Agnes AI（agnes-2.5-flash · 中文优化 · 编码专项）",
     "base_url": "https://api.agnes-ai.cn/v1",
     "models": ["agnes-2.5-flash", "agnes-2.0-flash"],        # 2.5 Flash 全量升级：编码、Agent、多模态
     "default_model": "agnes-2.5-flash"},                     # 512K 上下文 / 65K 输出，中文药学质量优
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
                existing = next((p for p in out if p["id"] == d["id"]), None)
                if existing is None:
                    out.append(dict(d))
                    added = True
                else:
                    # 合并默认项里「既有服务商内新增的模型」（如 OpenRouter 免费模型扩容），
                    # 不覆盖用户对已有模型的自定义编辑，但确保新模型对老用户立即可见。
                    emodels = set(existing.get("models") or [])
                    missing = [m for m in (d.get("models") or []) if m not in emodels]
                    if missing:
                        existing["models"] = list(emodels) + missing
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
            # 用户已在 env / llm_config.json 里明确设置了 base_url，保留；
            # 仅当 base_url 为空时才回退到 preset 默认值（保持向后兼容）
            if not base_url:
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

# 语义向量检索配置（BM25 + 向量混合召回，弥补 FTS5 近义/同义盲区）
EMBED_BASE = (os.environ.get("EMBED_BASE") or "http://127.0.0.1:11434").rstrip("/")
EMBED_MODEL = os.environ.get("EMBED_MODEL") or "nomic-embed-text"
KB_SEMANTIC = (os.environ.get("KB_SEMANTIC") or "1") not in ("0", "false", "False", "")
_VEC_WEIGHT = 25.0           # 向量相似度在重排中的权重（cosine 0.x → +x）
QA_DEFAULT_MODE = (os.environ.get("QA_DEFAULT_MODE") or "").strip().lower()  # 外网部署可设为 local/web/hybrid，覆盖前端硬编码默认


app = FastAPI(title="海云AI 法规问答 API", version="2.0.0")

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


# ---- 片段去噪：清洗markdown表格/标题/引用/分隔线，使检索片段可读 ----
_SEP_LINE = re.compile(r'^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$')
_HEADING = re.compile(r'^#{1,6}\s+(.*)$')
_BQUOTE = re.compile(r'^\s*>')
_TABLE_ROW = re.compile(r'^\s*\|.*\|\s*$')


def _clean_for_snippet(body):
    """把正文化简为去噪文本：表格单元合并、去 # /> /--- 噪声，便于截取干净片段。"""
    out = []
    for ln in (body or "").split("\n"):
        s = ln.rstrip()
        if not s.strip():
            continue
        if _SEP_LINE.match(s):
            continue
        if _TABLE_ROW.match(s):
            cells = [c.strip() for c in s.strip().strip("|").split("|")]
            cells = [c for c in cells if c and not _SEP_LINE.match(c)]
            if cells:
                out.append(" ".join(cells))
            continue
        m = _HEADING.match(s)
        if m:
            out.append(m.group(1).strip())
            continue
        if _BQUOTE.match(s):
            out.append(re.sub(r'^\s*>\s?', "", s))
            continue
        out.append(re.sub(r'^[#>\s]+', "", s))
    return "\n".join(out)


def _snippet_from_db(rel, terms, width=120, maxn=2):
    body = _read_kb_body(rel, cap=20000)
    if not body:
        return []
    clean = _clean_for_snippet(body)
    outs = []
    for t in terms:
        i = clean.find(t)
        if i < 0:
            continue
        s = max(0, i - width // 2)
        e = min(len(clean), i + len(t) + width // 2)
        frag = clean[s:e].replace("\n", " ").strip()
        frag = frag.replace("|", " ").replace("#", "").replace(">", " ")
        frag = re.sub(r"\s+", " ", frag).strip()
        outs.append(("…" if s > 0 else "") + frag + ("…" if e < len(clean) else ""))
        if len(outs) >= maxn:
            break
    return outs


def _llm_configured():
    # 本地模型（如 Ollama）无需 API Key；只要 base_url + model 齐备即视为已配置
    return bool(LLM_CFG.get("base_url") and LLM_CFG.get("model"))


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
        "kb_semantic": KB_SEMANTIC and bool(_vec_index().get("ready")),
        "python": PY,
        "qa_default_mode": QA_DEFAULT_MODE or "",
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

# ================================================================ 海云AI 深度推理提示词体系
# 设计目标：让回答达到主流大模型（GPT-4o / Claude / DeepSeek-R1 级）的专家问答水准——
# 先真思考、再分层作答；本地 / 联网 / 融合三模式共用同一套人格、思考框架与输出 schema，
# 保证前端渲染一致、答案风格统一。

_PERSONA = """你是「海云AI」，一位在药品研发与生产领域深耕数十年的质量（QA）专家，
兼具质量体系搭建、GMP 合规与药品注册申报的实战经验，长期为药企提供从立项到
上市及上市后全周期的合规与申报顾问。

你精通药品全生命周期的法律法规与技术要求：
《药品管理法》《疫苗管理法》及其实施条例、《药品注册管理办法》《药品生产监督管理办法》
《药品上市后变更管理办法》、GXP 体系（GMP/GCP/GLP/GSP）、NMPA/CDE 技术指导原则、
ICH 指导原则（Q/S/E/M 多系列），并熟悉中国、美国、欧盟监管路径与审评口径差异。

你对各项注册申报要求了如指掌：从创新药/仿制药的 IND、NDA、ANDA，
到补充申请、再注册、一致性评价、境外生产药品境内上市许可，
能讲清每类申报的资料要求、关键节点、常见发补与避坑要点，以及质量体系如何支撑申报。

你的回答必须达到「资深 QA 专家当面答疑」的水准，而不是搜索摘要或模板填空：
- 先判断提问者真正的处境与诉求（哪类品种、哪个阶段、什么角色、要做什么决策）；
- 给出明确的专业判断与可执行的注册 / 质量路径，而不是罗列条文让对方自己拼；
- 主动讲出「用户没问、但不知道就会踩坑」的关键点（合规红线、检查缺陷高发项、发补重灾区）；
- 有把握处斩钉截铁，无把握处明确划出边界，绝不含糊其辞或编造。"""


_THINKING_RULES = """【作答前必须真实完成的五步思考，并把过程写入「思考分析」字段】
1. 意图还原：用户真正要解决什么？隐含的品种类型 / 研发阶段 / 角色 / 决策场景是什么？
2. 问题拆解：该问题在法规上可拆成哪几个子问题？哪个是关键、哪个是次要？
3. 材料研判：下方材料哪些真正相关？效力层级如何？彼此是否存在版本差异、口径冲突或适用范围差异？
4. 判断形成：综合后你的专业判断是什么？依据链条是什么？哪些是确定结论、哪些是合理推断？
5. 盲区识别：哪些部分材料不足以支撑？哪些需提示以官方最新发布或与审评机构沟通为准？

【严禁】把五步思考写成空话套话（如「经分析材料相关」「综合判断如下」）；
必须写出具体的判断内容与理由，让读者看到真实的推理链。"""


_QUALITY_RULES = """【回答质量硬要求】
- 结论必须是「能直接拿去用」的判断，不是「视情况而定」式敷衍；需分情况时把情况穷举清楚。
- 要点解析要有信息增量：解释为什么这样规定、实操中怎么做、与相邻制度的区别，而非复述条文。
- 涉及数字（时限、批数、样本量、限度、有效期、比例）必须写明具体数值与出处；不确定则明说。
- 严格区分效力层级：法律 > 行政法规 > 部门规章 > 规范性文件 > 技术指导原则（推荐性）> 行业共识。
  技术指导原则除非被规章 / 公告强制引用，不得表述为强制要求；上下位冲突时以上位法为准并点明。
- 国外参考（FDA / EMA / WHO / ICH 未转化部分）不是中国法定依据，仅作对照参考并明示。
- 医疗器械 / 化妆品 / 诊疗服务问题：说明超出药品法规范围，并指出正确的对口依据方向。
- 表述精炼：在依据完整、判断明确、要点足够的前提下，杜绝套话、重复与空泛铺陈；能用一句说清的不用两句，单句以 30-50 字为度；思考分析与要点解析紧扣本问题，不展开无关子题。
- 严禁编造文号、发布日期、条款号、机构名；不确定就写「未在材料中确认」。"""


_SCHEMA = """【输出格式】只输出如下 JSON，不要任何额外文字、解释或 markdown 代码块标记：
{
 "思考分析":"2-3 句，呈现真实推理链：用户实际关心 X → 材料显示 Y（注意 Z 处差异）→ 故判断为 W。具体、有见地。",
 "结论":"直接完整地回答问题，2-3 句。先给核心判断，再补必要限定条件。禁止一句话敷衍，禁止写成『需具体分析』。",
 "要点解析":[{"要点":"简短小标题（6-14 字）","说明":"该要点的具体展开，1-2 句，须有实操信息量"}],
 "法规依据":[{"标题":"","引用原文":"关键条款摘录（本地材料逐字摘录；联网材料用 [n] 标注编号；凭自身知识须注明『依据通用知识，以官方发布为准』）","本地路径":"","来源":"","文号":"","发布日期":"","状态":""}],
 "适用提示":"实操落地：怎么做、找谁、备什么、关键时间节点。1-2 句。",
 "风险提示":"常见误区、易被发补 / 现场检查缺陷项、合规处罚风险。确无则写空字符串。",
 "时效说明":"现行有效性、同名多版本关系、施行日期、修订趋势；不确定写『以官方最新发布为准』。",
 "延伸问题":["用户接下来最可能追问的 2-3 个具体问题，每条不超过 24 字"]
}
「要点解析」至少 2 条、至多 3 条；「延伸问题」须与本次问题强相关，不得泛泛而谈。
- 整体作答精炼为上：中文正文控制在 500-800 字，要点齐全但不铺陈；能用一句说清的不用两句，单句以 30-50 字为度。"""

_SPEED_APPEND = """

【极速模式·强制精简】严格按下列字数上限作答，绝不展开：结论 1-2 句（≤60字）；思考分析 1 句（≤40字）；要点解析 至多 2 条、每条说明 1 句（≤40字）；法规依据 至多 2 条、引用原文 限 25 字以内；适用提示 1 句（≤40字）；风险提示 / 时效说明各 1 句或空；延伸问题 2 条。整段正文（不含字段名）总计不超过 350 字。宁可短而准，绝不铺陈。"""


_RAG_SYSTEM = _PERSONA + """

【当前模式：📚 本地法规库】
下方「法规材料」来自本地权威法规知识库（NMPA / CDE / ICH / 国务院等 3000+ 篇全文），
已按相关度与效力层级排序，是你作答的第一依据。

""" + _THINKING_RULES + """

【本模式专属规则】
- 优先严格依据下方法规正文；正文能回答的部分，「引用原文」须逐字摘录，不得改写或概括。
- 材料未覆盖但属于法规常识框架的部分，可用你的专业知识补充，但该条依据的「引用原文」
  必须以「依据通用知识，以官方发布为准：」开头，严禁伪造成材料原文。
- 时效核验（强制）：逐条查看材料的「状态」字段。
  · 现行有效 / 现行有效（试行）→ 可直接引用；
  · 现行有效（尚未生效）→ 引用须标注施行日期；
  · 征求意见（含已截止）→ 仅作趋势参考，须明示「尚未生效，仅供参考」；
  · 已废止 → 不得作为依据；涉及沿革时说明废止情况并指向替代文件；
  · 同名多版本（GCP / GMP 多版等）→ 取最新现行版，并在时效说明中点出版本关系。
- 每条依据尽量带齐 本地路径 + 来源 + 文号 + 发布日期 + 状态（取自材料，缺失写「—」）。
- 若材料确实完全未覆盖该问题：结论中说明本地库未收录，给出你基于通用知识的谨慎判断，
  并在适用提示中指向 NMPA（www.nmpa.gov.cn）/ CDE（www.cde.org.cn）对应栏目核实。

""" + _QUALITY_RULES + "\n\n" + _SCHEMA


# —— 小模型（如 Qwen3-8B）专用精简提示词分支 ——
# 8B 级模型在复杂 8 段式 + 严格引用约束下容易「脑补用户意图」「从无关文档拼凑答案」，
# 故单独给一套更短、更克制、强调『只答字面问题 + 库未覆盖就明说』的提示词。
_RAG_SYSTEM_SMALL = (
    "你是「海云AI」药品法规 QA 助手。请严格遵循：\n"
    "1) 只回答用户『字面问题』，不要自行改写、扩展或猜测用户未说明的意图；"
    "简单定义题（如『XX 是什么』）直接给定义，不要扯到无关子话题。\n"
    "2) 下方「法规材料」若与问题无关、或本地库未收录该问题的专门条文，"
    "必须明确说明『本地库未收录相关专门条文』，并仅基于通用知识给谨慎提示，"
    "严禁从无关文档拼凑答案或伪造引用原文。\n"
    "3) 引用原文须逐字摘录；材料无法回答时不要用材料凑数。\n\n"
    + _QUALITY_RULES + "\n\n" + _SCHEMA
)


# —— 检索相关性兜底：命中偏低时提示模型诚实声明「库未覆盖」 ——
_STOP = {"什么", "如何", "怎样", "怎么", "是否", "可以", "需要", "请问", "请", "关于",
         "以及", "还有", "哪些", "我们", "你们", "他们", "为什么", "条件", "的", "了", "是"}

_SMALL_MODEL_HINT = re.compile(r"8b|7b|3b|1\.5b|0\.5b|mini|qwen3-?8b|qwen2\.5-?7b", re.I)


def _is_small_model():
    """判断当前激活模型是否为小模型（需更克制的提示词）。"""
    if os.environ.get("LLM_SMALL_MODEL"):
        return True
    return bool(_SMALL_MODEL_HINT.search((LLM_CFG.get("model") or "")))


def _retrieval_low_confidence(q, rows):
    """若命中文档与问题核心实体基本不相关，判定为低置信（库 likely 未覆盖）。"""
    if not rows:
        return False
    canon = _domain_queries(q)
    tops = rows[:3]
    blob = " ".join(((r.get("标题", "") or "") + " " + (r.get("摘要", "") or "")) for r in tops)
    for c in canon:                      # 具体领域规范名出现在 top 文档 -> 高置信
        if c and c in blob:
            return False
    qcn = {t for t in re.findall(r"[一-龥]{2,}", q or "") if t not in _STOP}
    if qcn and not any(t in blob for t in qcn):
        return True
    return False


# （「本地 + 云端复核 / review」模式已于 2026-08 移除：该模式依赖本地 Qwen3 先答 +
#  云端 Agnes 复核，与当前部署形态（云端无本地模型）不符。现仅保留 local / web / hybrid
#  三种作答模式，见 _rag_query 与前端 _modeLabel。）



_WEB_SYSTEM = _PERSONA + """

【当前模式：🌐 AI 联网搜索】
系统已按 AI 提炼的检索式实时检索公开网络，结果见下方「检索材料」（带 [n] 编号）。
检索材料可能包含噪音、旧版本或非权威转载，你必须自行甄别，不得照单全收。

""" + _THINKING_RULES + """

【本模式专属规则】
- 甄别来源权威性：nmpa.gov.cn / cde.org.cn / gov.cn / ich.org 等官方来源 > 行业媒体 > 百科 / 论坛。
  发现材料与你已知的法规常识矛盾时，以更权威者为准并在思考分析中说明取舍理由。
- 结论与依据中引用检索材料须用 [1]、[2] 对应编号；凭自身知识补充的内容必须显式注明
  「依据通用知识，以官方发布为准」，严禁把通用知识包装成检索到的原文。
- 严禁只复述检索片段——必须做专业综合、交叉验证、归因与判断。
- 若检索材料整体与问题无关或质量很差，直接说明「本次检索未获取到有效权威材料」，
  转而基于你的专业知识审慎作答，并提示以官方发布为准。

""" + _QUALITY_RULES + "\n\n" + _SCHEMA


_HYBRID_SYSTEM = _PERSONA + """

【当前模式：🧠 深度融合（本地法规库 + 实时联网）】
下方同时提供两类材料：
  A.「法规材料」——本地权威法规库检索出的法规正文（准确、可逐字引用、含状态与文号）；
  B.「检索材料」——实时网络检索结果（时效新，但需甄别权威性，带 [n] 编号）。

""" + _THINKING_RULES + """

【本模式专属规则（融合是本模式的核心价值，务必做到）】
- 以 A 类本地法规正文作为法定依据主干（逐字引用、标注状态 / 文号 / 发布日期）；
  以 B 类实时检索作为时效补充（最新修订、新政解读、官方问答、实施动态）。
- 交叉核验：若 B 类显示某文件已被修订 / 废止 / 有新版，而 A 类为旧版，必须在
  「时效说明」中明确指出版本关系与以何者为准，并在思考分析中写明这一发现。
- 若两类材料口径冲突：先看效力层级，再看时间新旧，最后看来源权威性；
  结论中给出你的取舍判断与理由，不要含糊并列。
- 引用规范：本地依据填写「本地路径」；网络依据在「引用原文」中用 [n] 标注编号并填「来源」。
- 本模式下答案的深度要求最高：要点解析不少于 3 条，且须体现法规原文与最新动态的结合。

""" + _QUALITY_RULES + "\n\n" + _SCHEMA


class _RateLimited(Exception):
    """大模型调用被限流（如免费额度耗尽）。"""
    pass


_RAG_CACHE = {}            # (q, only_valid) -> (timestamp, answer)
_RAG_CACHE_TTL = 3600     # 1 小时


def _build_llm_request(system, user, strip_json, max_tokens=None):
    """构造 OpenAI 兼容 chat/completions 请求。strip_json=True 时去掉
    response_format / temperature（部分免费模型不支持，会返回 400）。
    max_tokens 可显式限定输出长度（仅作安全上限，不强制填满）；
    缺省取 LLM_MAX_TOKENS 环境变量（默认 1800），避免 8 段式冗长拖慢响应。"""
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
    # 深度作答需要一定发散：温度过低会退化成条文复读；0.35 兼顾严谨与见地。
    if not no_json:
        if max_tokens is None:
            max_tokens = int(os.environ.get("LLM_MAX_TOKENS", "1800") or "1800")
        payload["max_tokens"] = max_tokens
    if not no_json and not strip_json:
        payload["temperature"] = float(os.environ.get("LLM_TEMP", "0.35") or "0.35")
        payload["response_format"] = {"type": "json_object"}
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if key:  # 本地模型（Ollama 等）无需鉴权，省略 Authorization
        headers["Authorization"] = "Bearer " + key
    return urllib.request.Request(url, data=data, headers=headers)


def _call_llm(system, user, attempts=2, max_tokens=None):
    """调用 OpenAI 兼容 chat/completions。未配置返回 None；限流抛 _RateLimited。"""
    base = LLM_CFG.get("base_url", "").strip()
    key = LLM_CFG.get("api_key", "").strip()
    model = LLM_CFG.get("model", "").strip()
    if not (base and model):  # 本地模型（Ollama 等）允许空 Key
        return None
    return _call_llm_ex(system, user, attempts=attempts, max_tokens=max_tokens)[0]


def _call_llm_ex(system, user, attempts=2, max_tokens=None):
    """同 _call_llm，但额外返回 citations（Perplexity 等会返回联网引用 URL 列表）。

    返回 (content_or_None, [citation_url, ...])。兼容策略：
    - 限流（429）抛 _RateLimited；
    - 部分免费模型不支持 response_format/temperature（400），自动去掉后重试一次；
    - 其余异常按 attempts 重试。"""
    base = LLM_CFG.get("base_url", "").strip()
    key = LLM_CFG.get("api_key", "").strip()
    model = LLM_CFG.get("model", "").strip()
    if not (base and model):  # 本地模型（Ollama 等）允许空 Key
        return None, []
    req = _build_llm_request(system, user, False, max_tokens=max_tokens)
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
                req = _build_llm_request(system, user, True, max_tokens=max_tokens)
                continue
            if attempt < attempts - 1:
                time.sleep(6)
        except Exception:
            if attempt < attempts - 1:
                time.sleep(6)
    return None, []


def _test_llm_connection(base_url, api_key, model):
    """对指定端点做最小连通性测试：发一条极短消息，能拿到回复即视为成功。
    不改动任何全局配置（LLM_CFG / LLM_KEYS），仅用于「保存前自检」与「切换后状态提示」。
    返回 (ok, model, latency_ms, error)。"""
    base = (base_url or "").strip().rstrip("/")
    key = (api_key or "").strip()
    model = (model or "").strip()
    if not base:
        return False, model, 0, "缺少 API Base URL"
    if not model:
        return False, model, 0, "缺少模型名称"
    url = base + "/chat/completions"
    # 极简 payload：不强制 response_format / temperature，避免部分免费模型直接 400。
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 8,
        "stream": False,
    }
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if key:  # 本地模型（Ollama 等）允许空 Key
        headers["Authorization"] = "Bearer " + key
    req = urllib.request.Request(url, data=data, headers=headers)
    timeout = min(int(os.environ.get("LLM_TIMEOUT", "60") or "60"), 30)
    try:
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "ignore")
        latency = int((time.time() - t0) * 1000)
        j = json.loads(raw)
        content = (((j.get("choices") or [{}])[0] or {}).get("message") or {}).get("content")
        if content is None:
            content = ""
        return True, model, latency, ""
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", "ignore")
        except Exception:
            body = ""
        if e.code in (401, 403):
            return False, model, 0, "鉴权失败（API Key 无效或无权访问该模型）"
        if e.code == 404:
            return False, model, 0, "模型或端点不存在（HTTP 404），请确认 Base URL 与模型名"
        if e.code == 429:
            return False, model, 0, "请求被限流（HTTP 429），稍后重试或检查免费额度是否耗尽"
        return False, model, 0, "HTTP %d：%s" % (e.code, (body[:200] if body else ""))
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", e)
        return False, model, 0, "无法连接（地址/网络错误）：%s" % reason
    except Exception as e:
        return False, model, 0, "连接测试异常：%s" % str(e)


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
    """把自然语言问题改写成一组本地库检索式（Query Rewriting）。

    背景：kb.sqlite 用 FTS5 + trigram 分词，长自然语言句召回极差，
    但「法规全称 / 精确实体名词」命中率接近 100%。故按优先级派生：
      ① 领域术语确定性映射（_DOMAIN_TERMS，如 “BE豁免” → 人体生物等效性试验豁免指导原则）
      ② 术语规范化（缩写扩写 + 剥离尾部泛化词，_normalize_query）
      ③ 英文缩写单独成条（GLP / GMP / ICH…）
      ④ 去停用词后的中文核心串 + 前缀 n-gram 兜底
    e.g. 'GLP适用于哪些非临床研究？'
         -> ['药物非临床研究质量管理规范','GLP','非临床研究',...]
    """
    q = (q or "").strip()
    if not q:
        return []
    cands = []

    def _add(x):
        x = (x or "").strip()
        if x and x not in cands:
            cands.append(x)

    # ① 领域法规全称（最高命中率，放最前）
    for d in _domain_queries(q):
        _add(d)
    # ② 术语规范化后的整句
    _add(_normalize_query(q))
    # ③ 英文缩写
    for a in [x.upper() for x in re.findall(r"[A-Za-z]{2,}", q)]:
        _add(a)
        exp = _normalize_query(a)
        if exp and exp != a:
            _add(exp)
    # ④ 中文核心串（去英文/标点 + 去停用词）
    cn = re.sub(r"[A-Za-z0-9？?。\.，,、；;：:！!\s（）()《》\"']+", "", q)
    cn = re.sub(r"(哪些|如何|怎样|怎么|什么|是否|可以|需要|请问|请|关于|以及|还有|"
                r"呢|吗|的|了|与|和|及|对|进行|问题|指的|含义|定义|说明|介绍|概括|"
                r"具体|相关|方面|内容|我们|我|你|有|在|要|会|能)", "", cn).strip()
    if cn:
        _add(cn)
        for k in (6, 4, 3):
            if len(cn) > k:
                _add(cn[:k])
    _add(q)          # 原句垫底
    return cands[:8]


def _fts_escape(s):
    """FTS5 查询串转义：剔除会被当作语法的字符，整体加双引号作短语匹配。

    注意 kb.sqlite 用 trigram 分词，短语长度须 >= 3 字符，否则永远匹配不到。"""
    s = re.sub(r"[\"'()*:^\-+~]", " ", s or "").strip()
    s = re.sub(r"\s+", " ", s)
    return ('"%s"' % s) if s else ""


# ------------------------------------------------ 标题 IDF 语义扫描（本地召回主力）
# 背景：FTS5 trigram 只能做「连续子串」匹配——问「化学药品仿制药BE试验豁免」时，
# 目标文件《人体生物等效性试验豁免指导原则》因标题不含连续子串而完全召不回。
# 因此增加一层对全部 3000+ 篇标题的 2-gram + IDF 加权相似度扫描（纯内存，~20ms），
# 让「问题词 ≈ 法规名」这一法规问答最常见的情形能稳定命中。

_TITLE_INDEX = None


def _title_index():
    """构建（并缓存）标题倒排索引：行数据 + 2-gram 文档频率。"""
    global _TITLE_INDEX
    if _TITLE_INDEX is not None:
        return _TITLE_INDEX
    rows, df = [], {}
    db = _db_path()
    if not os.path.isfile(db):
        _TITLE_INDEX = {"rows": [], "df": {}, "N": 1}
        return _TITLE_INDEX
    try:
        con = sqlite3.connect(db)
        cur = con.execute(
            "SELECT path, title, type, issuer, publish_date, effective_date,"
            " source_url, status, category, topic, doc_no FROM docs")
        for r in cur:
            title = r[1] or ""
            g = set(_bigrams(re.sub(r"[《》()（）\[\]【】\s]", "", title)))
            if not g:
                continue
            rows.append((r, g))
            for x in g:
                df[x] = df.get(x, 0) + 1
        con.close()
    except Exception:
        rows, df = [], {}
    _TITLE_INDEX = {"rows": rows, "df": df, "N": max(len(rows), 1)}
    return _TITLE_INDEX


def _kb_title_scan(q, only_valid=True, n=6, min_score=0.18):
    """按 2-gram + IDF 加权的覆盖率扫描全部法规标题，返回最相关的若干篇。

    score = Σ idf(命中 gram) / Σ idf(问题全部 gram)，取值 0~1，
    再对超长标题做轻微惩罚，避免「大而全」的长标题靠字数取胜。"""
    import math
    idx = _title_index()
    if not idx["rows"]:
        return []
    s = _normalize_query(q) or q
    s = re.sub(r"[A-Za-z0-9]+", "", s)
    s = re.sub(r"(是什么|有什么|为什么|怎么样|哪些|如何|怎么|怎样|请问|需要|是否|"
               r"可以|能否|的条件|的要求|的规定|呢|吗|啊|吧|我想|帮我|告诉我)", "", s)
    s = re.sub(r"[^\w\u4e00-\u9fff]", "", s)
    qg = set(_bigrams(s))
    if not qg:
        return []
    # 领域术语映射出的「法规全称」同样参与打分，取各查询的最高分：
    # 这样「BE 试验豁免」也能直接锁定《人体生物等效性试验豁免指导原则》。
    variants = [qg]
    for c in _domain_queries(q):
        g = set(_bigrams(re.sub(r"[^\w\u4e00-\u9fff]", "", c)))
        if g:
            variants.append(g)
    N = idx["N"]
    df = idx["df"]
    # 用 idf² 加权：让「豁免 / 批签发 / 关联审评」这类稀有专业词主导相似度，
    # 避免「化学 / 药品 / 研究」等高频通用词把泛泛相关的长标题顶上来。
    allg = set()
    for v in variants:
        allg |= v
    idf = {g: math.log(1.0 + N / (1.0 + df.get(g, 0))) ** 2 for g in allg}
    denoms = [(sum(idf[g] for g in v) or 1.0) for v in variants]
    scored = []
    for r, g in idx["rows"]:
        best = 0.0
        for v, dn in zip(variants, denoms):
            inter = v & g
            if not inter:
                continue
            sc = sum(idf[x] for x in inter) / dn
            if len(g) > 18:                   # 超长标题轻微惩罚
                sc *= 18.0 / len(g)
            if sc > best:
                best = sc
        if best >= min_score:
            scored.append((best, r))
    if not scored:
        return []
    scored.sort(key=lambda x: -x[0])
    out = []
    for sc, r in scored[:n * 5]:
        (path, title, typ, issuer, pd, ed, url, status, cat, topic, dno) = r
        if only_valid and not (str(status).startswith("现行有效")
                               or status in ("有效", "现行")):
            continue
        out.append({
            "标题": title or "", "类型": typ or "", "发布机构": issuer or "",
            "发布日期": pd or "", "生效日期": ed or "", "状态": status or "",
            "分类": (cat or "") + ("/" + topic if topic else ""),
            "文号": dno or "", "本地路径": path or "", "来源": url or "",
            "_score": 0.0, "_cat": cat or "", "_title_score": round(sc, 4),
        })
        if len(out) >= n:
            break
    return out


_CAT_WEIGHT = {          # 效力层级加权（越大越优先）
    "01_法律": 60, "02_行政法规": 50, "03_部门规章": 40,
    "07_规范性文件": 30, "04_技术指导原则": 25,
    "05_ICH": 20, "06_国外参考": 8, "08_行业共识": 6,
}


def _kb_fts(query, only_valid=True, n=8):
    """直连 kb.sqlite 的 FTS5 检索（替代 subprocess 调 kb_query.py）。

    收益：单次 ~0.15s（子进程方式每次 >1s，8 个候选式即 8s+），且排序可控——
    bm25 列权重 标题×8 > 文号×2 > 正文×1，再叠加效力层级与状态档位重排。
    返回与 kb_query.py 完全一致的中文键名，调用方与提示词无需改动。"""
    m = _fts_escape(query)
    if not m or len(re.sub(r"[^\w\u4e00-\u9fff]", "", m)) < 2:
        return []
    db = _db_path()
    if not os.path.isfile(db):
        return []
    try:
        con = sqlite3.connect(db)
        sql = ("SELECT d.path, d.title, d.type, d.issuer, d.publish_date, d.effective_date,"
               " d.source_url, d.status, d.category, d.topic, d.doc_no,"
               " bm25(fts, 8.0, 1.0, 2.0, 1.0) AS score"
               " FROM fts JOIN ftsmap mp ON mp.rowid_ = fts.rowid"
               " JOIN docs d ON d.id = mp.docid WHERE fts MATCH ?")
        params = [m]
        if only_valid:
            sql += " AND (d.status LIKE '现行有效%' OR d.status IN ('有效','现行'))"
        sql += " ORDER BY score LIMIT ?"
        params.append(int(n) * 4)
        rows = con.execute(sql, params).fetchall()
        con.close()
    except Exception:
        return []
    out = []
    for r in rows:
        (path, title, typ, issuer, pd, ed, url, status, cat, topic, dno, score) = r
        out.append({
            "标题": title or "", "类型": typ or "", "发布机构": issuer or "",
            "发布日期": pd or "", "生效日期": ed or "", "状态": status or "",
            "分类": (cat or "") + ("/" + topic if topic else ""),
            "文号": dno or "", "本地路径": path or "", "来源": url or "",
            "_score": float(score or 0), "_cat": cat or "",
        })
    return out


# ------------------------------------------------ 语义向量召回（BM25 的混合补强）
# 背景：FTS5 trigram / 标题 2-gram 都只能做「字面/子串」匹配，对近义同义
# （「BE试验豁免」↔《人体生物等效性试验豁免指导原则》）无能为力。向量召回补上这一环：
# docs.vec 由 scripts/kb_embed.py 用 Ollama nomic-embed-text 离线生成（float32 字节）。

_VEC_INDEX = None
_embed_cache = {}


def _vec_index():
    """懒加载并缓存：全部文档向量（L2 归一化矩阵）+ 元数据。

    语义关闭 / 库无 vec 列 / 加载失败时返回 ready=False，调用方自动回退纯 BM25。"""
    global _VEC_INDEX
    if _VEC_INDEX is not None:
        return _VEC_INDEX
    empty = {"ready": False, "paths": [], "mats": None, "meta": {}}
    if not KB_SEMANTIC:
        _VEC_INDEX = empty
        return _VEC_INDEX
    db = _db_path()
    if not os.path.isfile(db):
        _VEC_INDEX = empty
        return _VEC_INDEX
    try:
        import numpy as np
        con = sqlite3.connect(db)
        rows = con.execute(
            "SELECT path, title, type, issuer, publish_date, effective_date,"
            " source_url, status, category, topic, doc_no, vec FROM docs"
        ).fetchall()
        con.close()
        paths, vecs, meta = [], [], {}
        for (path, title, typ, issuer, pd, ed, url, status, cat, topic,
             dno, vec) in rows:
            if not vec:
                continue
            arr = np.frombuffer(vec, dtype=np.float32)
            if arr.size == 0:
                continue
            nrm = np.linalg.norm(arr)
            if nrm < 1e-9:
                continue
            paths.append(path)
            vecs.append(arr / nrm)
            meta[path] = {
                "标题": title or "", "类型": typ or "",
                "发布机构": issuer or "", "发布日期": pd or "",
                "生效日期": ed or "", "状态": status or "",
                "分类": (cat or "") + ("/" + topic if topic else ""),
                "文号": dno or "", "本地路径": path or "",
                "来源": url or "",
            }
        if not paths:
            _VEC_INDEX = empty
            return _VEC_INDEX
        _VEC_INDEX = {"ready": True, "paths": paths,
                      "mats": np.stack(vecs), "meta": meta}
    except Exception as e:
        print("[vec] 向量索引加载失败，回退纯 BM25：%s" % e)
        _VEC_INDEX = empty
    return _VEC_INDEX


def _embed_query(q):
    """查询文本 → 向量（带缓存）。Ollama 不可用/失败返回 None → 调用方降级。"""
    if not KB_SEMANTIC:
        return None
    key = (q or "").strip()
    if key in _embed_cache:
        return _embed_cache[key]
    try:
        payload = {"model": EMBED_MODEL, "input": "search_query: " + key}
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            EMBED_BASE + "/api/embed",
            data=data,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            j = json.loads(r.read().decode("utf-8"))
        emb = (j.get("embeddings") or [None])[0]
        _embed_cache[key] = emb if emb else None
        return _embed_cache[key]
    except Exception as e:
        print("[vec] 查询向量化失败，回退纯 BM25：%s" % e)
        _embed_cache[key] = None
        return None


def _kb_vector_scan(q, only_valid=True, n=8, limit=8):
    """向量语义召回：查询向量与全部文档向量做余弦相似度，取 top。"""
    import numpy as np
    idx = _vec_index()
    if not idx.get("ready"):
        return []
    qv = _embed_query(q)
    if qv is None:
        return []
    qv = np.asarray(qv, dtype=np.float32)
    nrm = np.linalg.norm(qv)
    if nrm < 1e-9:
        return []
    qv = qv / nrm
    sims = idx["mats"].dot(qv)            # (N,)
    order = np.argsort(-sims)
    out = []
    for i in order[: limit * 3]:
        p = idx["paths"][i]
        m = idx["meta"].get(p)
        if not m:
            continue
        if only_valid and not (str(m.get("状态", "")).startswith("现行有效")
                                or m.get("状态") in ("有效", "现行")):
            continue
        row = dict(m)
        row["_score"] = 0.0
        row["_cat"] = (m.get("分类", "") or "").split("/")[0]
        row["_title_score"] = 0.0
        row["_vec_score"] = round(float(sims[i]), 4)
        out.append(row)
        if len(out) >= n:
            break
    return out


def _kb_rank(q, rows):
    """本地检索结果重排：标题命中 + 效力层级 + 状态档位 + bm25。分越大越靠前。"""
    qn = _normalize_query(q) or q
    keys = set()
    for s in (q, qn):
        s2 = re.sub(r"[^\w\u4e00-\u9fff]", "", s or "")
        for k in range(3, min(len(s2), 10) + 1):
            for i in range(0, len(s2) - k + 1):
                keys.add(s2[i:i + k])
    keys = sorted(keys, key=len, reverse=True)[:300]
    for r in rows:
        title = r.get("标题", "") or ""
        hit = 0
        for k in keys:
            if len(k) <= hit:
                break
            if k in title:
                hit = len(k)
        score = hit * 12.0                                   # 标题连续子串命中
        score += float(r.get("_title_score", 0)) * 220.0     # 标题 IDF 语义相似度（主力信号）
        score += _CAT_WEIGHT.get(r.get("_cat", ""), 10)      # 效力层级
        score -= st_tier(r.get("状态", "")) * 8              # 现行有效优先
        score += max(0.0, 12.0 + float(r.get("_score", 0)))  # bm25（负值，越小越好）
        score += float(r.get("_vec_score", 0) or 0) * _VEC_WEIGHT  # 向量语义相似度
        r["_rank"] = round(score, 2)
    rows.sort(key=lambda x: -x.get("_rank", 0))
    return rows


def _kb_retrieve(q, only_valid, limit=8):
    """本地库混合召回：标题 IDF 语义扫描 + 多检索式 FTS5 正文检索 → 去重 → 综合重排。

    两路互补：
      · 标题扫描解决「问题词 ≈ 法规名」（FTS trigram 连续子串匹配不到的情形）；
      · FTS 正文检索解决「答案藏在条文里、标题看不出来」的情形。
    先严格「仅现行有效」；命中不足时放宽（含试行 / 征求意见 / 已废止），
    交由模型在时效核验环节甄别。两路都空时回退 subprocess（兼容旧路径）。"""
    cands = _derive_queries(q)
    merged, seen = [], set()

    def _add(r):
        p = (r.get("本地路径") or "") if isinstance(r, dict) else ""
        if not p:
            return
        if p in seen:                     # 已存在则保留更高的标题相似度
            for e in merged:
                if e.get("本地路径") == p:
                    e["_title_score"] = max(float(e.get("_title_score", 0)),
                                            float(r.get("_title_score", 0)))
                    if not e.get("_score") and r.get("_score"):
                        e["_score"] = r["_score"]
                    if not e.get("_vec_score") and r.get("_vec_score"):
                        e["_vec_score"] = r["_vec_score"]
                    break
            return
        seen.add(p)
        merged.append(r)

    # ① 标题 IDF 语义扫描（召回主力）
    for r in _kb_title_scan(q, True, n=limit):
        _add(r)
    # ② 多检索式 FTS5 正文检索
    for cq in cands:
        for r in _kb_fts(cq, True, limit):
            _add(r)
        if len(merged) >= limit * 3:
            break
    # ③ 命中不足则放宽状态过滤
    if len(merged) < 4:
        for r in _kb_title_scan(q, False, n=limit):
            _add(r)
        for cq in cands:
            for r in _kb_fts(cq, False, limit):
                _add(r)
            if len(merged) >= limit * 2:
                break
    if not merged:                       # 兜底：老路径（子进程）
        for cq in cands[:3]:
            for r in _kb_one(cq, bool(only_valid)):
                _add(r)
            if merged:
                break
    # ④ 语义向量召回（近义/同义补强，BM25 够强时影响很小，但能救回字面漏召）
    if KB_SEMANTIC:
        try:
            for r in _kb_vector_scan(q, bool(only_valid), n=limit):
                _add(r)
        except Exception as e:
            print("[vec] 向量召回异常，忽略：%s" % e)
    return _kb_rank(q, merged)[:limit]


def _fmt_kb_materials(docs_ctx, cap=2600, start=1):
    """把本地法规正文格式化成提示词材料段。"""
    lines = []
    for i, d in enumerate(docs_ctx, start):
        m = d["meta"]
        lines.append("%d. 《%s》（%s，%s，%s，状态：%s，分类：%s）" % (
            i, m.get("标题", ""), m.get("发布机构", "") or "—",
            m.get("文号") or "—", m.get("发布日期") or "—",
            m.get("状态", "") or "—", m.get("分类", "") or "—"))
        lines.append("   本地路径：%s　原文链接：%s"
                     % (m.get("本地路径", ""), m.get("来源", "") or "—"))
        body = (d["body"] or "").strip()
        if len(body) > cap:
            body = body[:cap] + "\n…(正文较长，已截断)"
        lines.append(body or "（本条未取到正文，请仅依据上方元数据谨慎引用）")
        lines.append("")
    return lines


def _build_rag_prompt(q, docs_ctx, queries=None, small=False):
    lines = ["【用户问题】\n%s\n" % q]
    if queries:
        lines.append("【本次本地库实际使用的检索式】" + " ｜ ".join(queries) + "\n")
    lines.append("【法规材料】（本地权威法规库检索结果，已按相关度 + 效力层级 + 时效排序）\n")
    lines += _fmt_kb_materials(docs_ctx)
    lines.append("请严格按系统提示的五步思考与 JSON 结构作答。")
    return (_RAG_SYSTEM_SMALL if small else _RAG_SYSTEM), "\n".join(lines)


_ANSWER_KEYS = ("思考分析", "结论", "要点解析", "法规依据",
                "适用提示", "风险提示", "时效说明", "延伸问题")


def _normalize_answer(ans):
    """补齐 schema 字段并做类型纠偏，避免模型少写字段导致前端渲染缺块。"""
    if not isinstance(ans, dict):
        return {k: ([] if k in ("要点解析", "法规依据", "延伸问题") else "")
                for k in _ANSWER_KEYS}
    for k in _ANSWER_KEYS:
        if k not in ans or ans[k] is None:
            ans[k] = [] if k in ("要点解析", "法规依据", "延伸问题") else ""
    # 要点解析：容忍模型写成 ["xxx","yyy"] 或 [{"标题":..,"内容":..}]
    pts = ans.get("要点解析")
    if isinstance(pts, dict):
        pts = [{"要点": k, "说明": v} for k, v in pts.items()]
    if not isinstance(pts, list):
        pts = []
    norm = []
    for p in pts:
        if isinstance(p, str):
            t = p.split("：", 1)
            norm.append({"要点": t[0][:20], "说明": t[1] if len(t) > 1 else p})
        elif isinstance(p, dict):
            norm.append({
                "要点": str(p.get("要点") or p.get("标题") or p.get("title") or "").strip(),
                "说明": str(p.get("说明") or p.get("内容") or p.get("detail") or "").strip(),
            })
    ans["要点解析"] = [p for p in norm if p.get("说明")][:5]
    fu = ans.get("延伸问题")
    if isinstance(fu, str):
        fu = [x for x in re.split(r"[\n；;｜|]+", fu) if x.strip()]
    ans["延伸问题"] = [str(x).strip()[:40] for x in (fu or []) if str(x).strip()][:3]
    if not isinstance(ans.get("法规依据"), list):
        ans["法规依据"] = []
    return ans


def _enrich_citations(ans, docs_ctx):
    """为模型漏填标题／文号等的法规依据，从已检索法规正文反查补全元数据。

    模型偶发只写「引用原文」不写「标题」；此时按本地路径精确匹配，或按
    「引用原文」片段在法规正文中定位来源，回填标题／文号／发布日期／状态／
    本地路径／来源，避免前端出现「标题: None」的空引用。"""
    ba = ans.get("法规依据")
    if not isinstance(ba, list) or not docs_ctx:
        return
    for c in ba:
        if not isinstance(c, dict):
            continue
        if (c.get("标题") or "").strip():
            continue
        raw = (c.get("引用原文") or "").strip()
        if not raw:
            continue
        lp = (c.get("本地路径") or "").replace("\\", "/").strip()
        hit = None
        for d in docs_ctx:
            m = d.get("meta") or {}
            if lp and m.get("本地路径", "").replace("\\", "/").strip() == lp:
                hit = m
                break
        if not hit and len(raw) >= 12:
            frag = raw[:40]
            for d in docs_ctx:
                if frag in (d.get("body") or ""):
                    hit = d.get("meta") or {}
                    break
        if hit:
            c["标题"] = hit.get("标题", "") or c.get("标题", "")
            c["本地路径"] = hit.get("本地路径", "") or c.get("本地路径", "")
            c["来源"] = hit.get("来源", "") or c.get("来源", "")
            c["文号"] = hit.get("文号", "") or c.get("文号", "")
            c["发布日期"] = hit.get("发布日期", "") or c.get("发布日期", "")
            c["状态"] = hit.get("状态", "") or c.get("状态", "")


def _parse_llm_json(raw):
    raw = (raw or "").strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw)
    for cand in (raw, ):
        try:
            return _normalize_answer(json.loads(cand))
        except Exception:
            pass
    m = re.search(r"\{.*\}", raw, re.S)
    if m:
        try:
            return _normalize_answer(json.loads(m.group(0)))
        except Exception:
            pass
    return _normalize_answer({"结论": raw or "（模型未返回有效内容）"})


def _rag_query(q, only_valid, mode="local", speed=False):
    if mode == "web":
        return _web_query(q, speed=speed)
    if mode == "hybrid":
        return _hybrid_query(q, only_valid, speed=speed)
    cache_key = (q, bool(only_valid), bool(speed))
    now = time.time()
    cached = _RAG_CACHE.get(cache_key)
    if cached and now - cached[0] < _RAG_CACHE_TTL:
        ans = dict(cached[1])
        ans["source"] = "rag"
        ans["cached"] = True
        return ans
    queries = _derive_queries(q)
    rows = _kb_retrieve(q, only_valid)
    if not rows:
        return {
            "结论": "本地法规库未检索到与「%s」直接匹配的条文。建议换用更规范的法规表述"
                    "（如 GMP → 药品生产质量管理规范），或切换「🌐 AI 联网搜索」"
                    "/「🧠 深度融合」模式。" % q,
            "思考分析": "", "要点解析": [], "法规依据": [], "适用提示": "",
            "风险提示": "", "时效说明": "", "延伸问题": [],
            "search_queries": queries, "source": "rag", "empty": True,
        }
    docs_ctx = []
    _ndocs = 3 if speed else 5
    _dcap = 600 if speed else 1500
    for r in rows[:_ndocs]:
        rel = r.get("本地路径", "")
        docs_ctx.append({"meta": r, "body": _read_kb_body(rel, cap=_dcap)})
    small = _is_small_model()
    sys_p, usr_p = _build_rag_prompt(q, docs_ctx, queries, small=small)
    try:
        sys_p_eff = sys_p + (_SPEED_APPEND if speed else "")
        if _retrieval_low_confidence(q, rows):
            note = ("\n\n【检索相关性提示】本次本地检索命中文档与问题相关度偏低"
                "（很可能未收录该问题的专门条文）。若材料无法回答，请如实说明"
                "『本地库未收录相关专门条文』，并仅作谨慎通用提示，"
                "严禁从无关文档拼凑答案或伪造引用。")
            sys_p_eff += note
            usr_p += note
        raw = _call_llm(sys_p_eff, usr_p, max_tokens=1200 if speed else 1500)
    except _RateLimited:
        return {"error": "llm_rate_limited", "fallback": True}
    if not raw:
        return {"error": "llm_not_configured", "fallback": True}
    ans = _parse_llm_json(raw)
    ans["source"] = "rag"
    ans["search_queries"] = queries
    ans["kb_hits"] = [{"标题": r.get("标题", ""), "状态": r.get("状态", ""),
                       "分类": r.get("分类", ""), "本地路径": r.get("本地路径", "")}
                      for r in rows[:6]]
    _enrich_citations(ans, docs_ctx)
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
        req = urllib.request.Request(url, headers={"User-Agent": "HaiyunAI/1.0"})
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


def _search_bing_rss(query, n, host="www.bing.com"):
    """必应 RSS 检索（keyless 主力源）。

    相比抓 HTML，RSS 输出稳定得多：HTML 页面在无 Cookie 时经常被必应返回
    随机缓存的无关 SERP（实测会串到完全不相干的内容），而 RSS 始终返回与
    查询对应的结构化 item（title / link / description / pubDate）。"""
    try:
        url = ("https://" + host + "/search?q=" + urllib.parse.quote(query)
               + "&format=rss&count=" + str(max(n, 8)) + "&setlang=zh-CN")
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            "Accept-Language": "zh-CN,zh;q=0.9",
        })
        with urllib.request.urlopen(req, timeout=8) as r:
            xml = r.read().decode("utf-8", "ignore")
    except Exception:
        return []
    out = []
    try:
        root = ET.fromstring(xml)
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            desc = (item.findtext("description") or "").strip()
            date = (item.findtext("pubDate") or "").strip()
            if title and link:
                out.append({"title": title, "url": link, "snippet": desc, "date": date})
            if len(out) >= n:
                break
    except Exception:
        return []
    return out


def _search_bing(query, n, host="www.bing.com"):
    """必应搜索（HTML 解析，作为 RSS 源的备用）。"""
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


_REFINE_SYSTEM = """你是搜索策略专家，服务于中国药品法规问答。用户会给你一个自然语言问题，
请提炼出 2-3 个**用于搜索引擎的精炼检索式**。

要求：
1. 只保留专业名词与关键限定词，**删除**「是什么 / 如何 / 怎么 / 哪些 / 请问 / 需要 / 的条件 / 吗 / 呢」等疑问与口语词。
2. 每个检索式 4-14 个字，词与词之间用空格分隔；不要整句、不要标点。
3. 覆盖不同角度：如①核心概念词 ②法规/指导原则名称 ③监管机构限定（NMPA、CDE、药审中心）。
4. 使用中国药监领域的**规范术语**（例如「BE 试验」写成「生物等效性试验」，「一致性评价」保留原词）。
5. **每个检索式必须足够具体**：必须保留问题里最独特的专业词（如「上市许可持有人」「生物等效性豁免」），
   严禁产出「药品监管」「创新药申报」「非临床研究」这类只有两三个泛化字、会被搜索引擎退化成百科或
   完全跑题结果的宽泛词。
6. **强烈优先输出法规 / 指导原则的完整规范名称**（这是命中率最高的检索式形式），例如：
   「药物非临床研究质量管理规范」「人体生物等效性试验豁免指导原则」「药品注册管理办法」
   「药品上市许可持有人落实药品质量安全主体责任监督管理规定」。
   至少有 1 条检索式应当是这种「法规全称」形式。

只输出 JSON，不要任何额外文字：{"检索式":["...","...","..."]}"""

# 自然语言问句中应从检索式里剔除的疑问 / 口语 / 虚词
_STOPWORDS = [
    "是什么", "有什么", "为什么", "怎么样", "怎么办", "哪些", "如何", "怎么", "怎样",
    "请问", "麻烦", "帮我", "我想", "想知道", "告诉我", "介绍一下", "详细说明",
    "的条件", "的要求", "的规定", "的流程", "的区别", "的注意事项",
    "需要注意", "有没有", "可不可以", "能不能", "是否", "呢", "吗", "啊", "吧",
    "？", "?", "。", "，", ",", "、", "！", "!", "；", ";", "：", ":",
]


# 行业缩写 / 俗称 → 规范术语（检索引擎对规范术语的召回明显更准）
_TERM_MAP = [
    ("BE试验", "生物等效性"), ("BE研究", "生物等效性"), ("BE豁免", "生物等效性豁免"),
    ("BCS分类", "生物药剂学分类系统"),
    ("IND申报", "新药临床试验申请"), ("IND", "新药临床试验申请"),
    ("ANDA", "仿制药申请"), ("NDA", "药品上市许可申请"),
    ("MAH", "药品上市许可持有人"),
    ("GMP", "药品生产质量管理规范"), ("GCP", "药物临床试验质量管理规范"),
    ("GLP", "药物非临床研究质量管理规范"),
    ("CTD", "通用技术文档"), ("CDE", "药品审评中心"),
]
# 检索式尾部的泛化修饰词。实测必应对中文只认「精确实体名词」：
# 「药品上市许可持有人」能命中官方文件，而「药品上市许可持有人 主体责任」会退化成百科。
_TAIL_NOISE = ("条件", "要求", "规定", "流程", "标准", "办法", "细则", "说明", "问题",
               "主体责任", "责任", "义务", "职责", "内容", "范围", "程序", "方式",
               "区别", "影响", "情形", "时限", "资料")


def _normalize_query(s):
    """把缩写扩成规范术语，并剥掉尾部泛化词，提升搜索引擎召回精度。"""
    out = (s or "").strip()
    for a, b in _TERM_MAP:
        if a in out and b not in out:
            out = out.replace(a, b)
    out = re.sub(r"\s+", " ", out).strip()
    for w in _TAIL_NOISE:                # 仅剥尾部，避免破坏中间语义
        if out.endswith(w) and len(out) > len(w) + 2:
            out = out[: -len(w)].strip()
    return out


# 领域术语 → 检索命中率最高的「规范全称」。
# 实测必应对法规全称的召回近乎精确（如「药物非临床研究质量管理规范」相关度 1.00），
# 而大模型提炼的检索式质量并不稳定，因此用这张表做确定性兜底。
_DOMAIN_TERMS = [
    # (问题中出现的触发词, 用于检索的规范全称)
    ("生物等效性豁免", "人体生物等效性试验豁免指导原则"),
    ("BE豁免", "人体生物等效性试验豁免指导原则"),
    ("试验豁免", "人体生物等效性试验豁免指导原则"),
    ("BE试验豁免", "人体生物等效性试验豁免指导原则"),
    ("BE试验", "生物等效性豁免"),
    ("生物等效性", "生物等效性豁免"),
    ("一致性评价", "仿制药质量和疗效一致性评价"),
    ("上市许可持有人", "药品上市许可持有人"),
    ("MAH", "药品上市许可持有人"),
    ("非临床研究", "药物非临床研究质量管理规范"),
    ("GLP", "药物非临床研究质量管理规范"),
    ("临床试验质量管理", "药物临床试验质量管理规范"),
    ("GCP", "药物临床试验质量管理规范"),
    ("生产质量管理", "药品生产质量管理规范"),
    ("GMP", "药品生产质量管理规范"),
    ("经营质量管理", "药品经营质量管理规范"),
    ("注册管理", "药品注册管理办法"),
    ("药品注册", "药品注册管理办法"),
    ("不良反应", "药品不良反应报告和监测管理办法"),
    ("药品召回", "药品召回管理办法"),
    ("疫苗", "疫苗管理法"),
    ("说明书", "药品说明书和标签管理规定"),
    ("优先审评", "药品优先审评审批"),
    ("附条件批准", "附条件批准上市申请"),
    ("突破性治疗", "突破性治疗药物审评审批"),
    ("关联审评", "原料药辅料和包装材料关联审评审批"),
    ("变更", "已上市药品变更管理"),
    ("稳定性", "原料药和制剂稳定性试验指导原则"),
    ("溶出度", "溶出度试验指导原则"),
    ("杂质", "药品杂质研究指导原则"),
    ("IND", "新药临床试验申请"),
    ("补充申请", "药品补充申请"),
    ("药品管理法", "中华人民共和国药品管理法"),
    ("委托生产", "药品上市许可持有人委托生产"),
    ("质量协议", "药品上市许可持有人委托生产质量协议"),
    ("委托生产检查", "药品上市许可持有人委托生产现场检查指南"),
    ("主体责任", "药品上市许可持有人主体责任"),
]


def _domain_queries(q):
    """从用户问题里识别领域术语，直接产出高命中率的「法规全称」检索式。

    这是不依赖大模型的确定性兜底：即使模型提炼失败或产出宽泛词，
    只要问题命中术语表，就仍能检索到权威原文。"""
    s = (q or "")
    hits, seen = [], set()
    for trig, canonical in _DOMAIN_TERMS:
        if trig in s and canonical not in seen:
            seen.add(canonical)
            hits.append((len(trig), canonical))
    hits.sort(key=lambda x: -x[0])        # 触发词越长越具体，优先使用
    return [c for _, c in hits][:3]


def _refine_queries(q):
    """把用户的自然语言问题提炼成 1-3 个精炼检索式（AI 主动思考「该搜什么」）。

    背景：必应对长自然语言中文句子的召回极差——实测「化学药品仿制药BE试验豁免的
    条件是什么」会退化成「化学」的泛化结果，而精炼成「生物等效性豁免」即可直接
    命中《人体生物等效性试验豁免指导原则》。因此检索前必须先做 query rewriting。

    优先用大模型提炼；模型未配置 / 失败时回退到规则法（剔除停用词）。
    返回列表，首项始终保证非空。"""
    q = (q or "").strip()
    if not q:
        return []
    # 0) 确定性兜底：问题里命中的领域术语 → 法规全称（命中率最高，始终参与检索）
    domain = _domain_queries(q)
    # 1) 大模型提炼（最准，能补充规范术语与机构限定）
    try:
        raw = _call_llm(_REFINE_SYSTEM, q, attempts=1, max_tokens=800)
        if raw:
            data = _parse_llm_json(raw)
            qs = data.get("检索式") or data.get("queries") or []
            out = []
            for s in qs:
                s = re.sub(r"\s+", " ", str(s or "").strip())
                if 2 <= len(s) <= 40 and s not in out:
                    out.append(s)
            if out:
                # 领域术语放最前：先用权威全称检索，再用模型提炼的角度补充
                return _augment_queries(domain + out)
    except Exception:
        pass
    # 2) 规则兜底：剔除疑问词 / 标点，压缩空白
    s = q
    for w in _STOPWORDS:
        s = s.replace(w, " ")
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > 30:                      # 过长仍会被搜索引擎泛化，截断到核心部分
        s = s[:30].strip()
    return _augment_queries(domain + [s or q])


def _augment_queries(queries):
    """为每个检索式追加更易命中的变体。

    实测必应对中文的召回高度依赖「精确实体名词」，修饰词越多越容易退化成
    百科兜底结果。因此除原式外，额外追加两类变体：
    - 术语规范化 + 剥离尾部泛化修饰（BE试验豁免条件 → 生物等效性豁免）；
    - 多词检索式的首个词组（药品上市许可持有人 主体责任 → 药品上市许可持有人）。
    """
    out = []

    def _push(s):
        s = re.sub(r"\s+", " ", (s or "").strip())
        if len(s) >= 3 and s not in out:
            out.append(s)

    for s in queries:
        _push(s)
        _push(_normalize_query(s))
        head = (s or "").split(" ")[0].strip()      # 首个词组通常就是核心实体
        if len(head) >= 5:
            _push(head)
            _push(_normalize_query(head))
    return out[:5]


def _bigrams(s):
    """中文按字符 2-gram、英文按单词切分，用于粗粒度相关性度量（无需分词依赖）。"""
    s = re.sub(r"[\s\u3000]+", "", (s or "").lower())
    grams = set(re.findall(r"[a-z0-9]{2,}", s))
    zh = re.sub(r"[^\u4e00-\u9fa5]", "", s)
    grams.update(zh[i:i + 2] for i in range(len(zh) - 1))
    return grams


def _relevance(query, item):
    """检索结果与查询的相关度（0~1）。

    必应对「无精确匹配」的词组会退化成首个分词的泛化结果（实测
    「生物等效性试验豁免」会返回「生物_百度百科」）。这里用字符 2-gram
    重合率把这类噪音过滤掉。"""
    qg = _bigrams(query)
    if not qg:
        return 1.0
    dg = _bigrams((item.get("title") or "") + " " + (item.get("snippet") or ""))
    return len(qg & dg) / float(len(qg))


_MIN_RELEVANCE = 0.34       # 低于此重合率视为搜索引擎的泛化噪音

_AUTHORITATIVE = ("nmpa.gov.cn", "cde.org.cn", "gov.cn", "chinamab.org",
                  "ich.org", "who.int", "fda.gov", "ema.europa.eu")


# 百科 / 字典 / 问答类站点：常被搜索引擎当作泛化兜底结果，专业性弱，排到最后
_GENERIC_HOSTS = ("baike.baidu.com", "zhidao.baidu.com", "wenku.baidu.com",
                  "baike.so.com", "zdic.net", "hanyu", "zidian", "cidian",
                  "wikipedia.org", "wiki")


def _authority_rank(url):
    """权威域优先：官方来源排前面，百科 / 字典类排最后，便于模型优先采信。"""
    u = (url or "").lower()
    for i, d in enumerate(_AUTHORITATIVE):
        if d in u:
            return i
    if any(g in u for g in _GENERIC_HOSTS):
        return len(_AUTHORITATIVE) + 1
    return len(_AUTHORITATIVE)


def _web_search_multi(queries, max_results=6, original=""):
    """对多个精炼检索式分别检索、过滤泛化噪音后合并去重，官方来源优先。

    - 每条结果需与「所属检索式」或「用户原问题」有足够 2-gram 重合，否则丢弃；
    - 官方来源（NMPA / CDE / gov.cn / ICH 等）排前，便于模型优先采信；
    - 全部被过滤时退回未过滤结果，保证「联网检索」不至于空手而归。"""
    merged, seen, raw_all = [], set(), []
    for qq in queries:
        for it in _web_search(qq, max_results=max_results):
            u = (it.get("url") or "").strip()
            if not u or u in seen:
                continue
            seen.add(u)
            raw_all.append(it)
            score = max(_relevance(qq, it),
                        _relevance(original, it) if original else 0.0)
            if score >= _MIN_RELEVANCE:
                it["_score"] = score
                merged.append(it)
        if len(merged) >= max_results * 2:
            break
    if merged:
        # 正常路径：官方来源优先，同级按相关度降序
        merged.sort(key=lambda r: (_authority_rank(r.get("url")), -r.get("_score", 0)))
    else:
        # 降级路径：全部低于阈值时按相关度择优，但仍丢弃几乎无关的结果。
        # 必应在泛化时会返回完全跑题的内容（实测出现过游戏维基、软件破解贴），
        # 与其把这类噪音喂给模型，不如返回空、让模型基于通用知识谨慎作答。
        for it in raw_all:
            it["_score"] = max(_relevance(original, it) if original else 0.0,
                               max((_relevance(qq, it) for qq in queries), default=0.0))
        merged = [it for it in raw_all if it["_score"] >= 0.12]
        merged.sort(key=lambda r: -r.get("_score", 0))
    for r in merged:
        r.pop("_score", None)
    return merged[:max_results]


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
    # 2) Bing RSS 主力源先行（结构化、稳定、命中率最高），够了就直接返回
    _add(_search_bing_rss(query, max_results))
    if len(results) >= max_results:
        return results[:max_results]
    # 3) 其余 keyless 源并行补充
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
    # 4) 兜底：若 www 被区域拦截，再试 cn.bing.com（RSS 优先）
    if not results:
        _add(_search_bing_rss(query, max_results, host="cn.bing.com"))
        _add(_search_bing(query, max_results, host="cn.bing.com"))
    return results[:max_results]


def _call_responses_web(system, user, max_tokens=1800):
    """调 DeepSeek Responses API（/responses），启用 web_search 工具做服务端联网检索。
    返回 (text_or_None, [web_source, ...])。若该端点不支持 json_object 格式则去掉重试。"""
    base = LLM_CFG.get("base_url", "").strip()
    key = LLM_CFG.get("api_key", "").strip()
    model = LLM_CFG.get("model", "").strip()
    if not (base and model):
        return None, []
    url = base.rstrip("/")
    if url.endswith("/v1"):
        url = url[:-3]
    url = url + "/responses"
    payload = {
        "model": model,
        "instructions": system,
        "input": user,
        "tools": [{"type": "web_search"}],
        "text": {"format": {"type": "json_object"}},
    }

    def _do(use_fmt):
        p = dict(payload)
        if not use_fmt:
            p.pop("text", None)
        data = json.dumps(p).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if key:
            headers["Authorization"] = "Bearer " + key
        req = urllib.request.Request(url, data=data, headers=headers)
        timeout = int(os.environ.get("LLM_TIMEOUT", "60") or "60")
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8")

    for attempt in range(2):
        try:
            raw = _do(use_fmt=True)
            return _parse_responses(raw)
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", "ignore")
            except Exception:
                pass
            if e.code == 429 or "rate" in body.lower():
                raise _RateLimited(body or "rate limited")
            if e.code == 400 and attempt == 0 and ("format" in body.lower() or "text" in body.lower()):
                # 该端点不支持 json_object：去掉后重试一次
                try:
                    raw = _do(use_fmt=False)
                    return _parse_responses(raw)
                except urllib.error.HTTPError as e2:
                    b2 = ""
                    try:
                        b2 = e2.read().decode("utf-8", "ignore")
                    except Exception:
                        pass
                    if e2.code == 429 or "rate" in b2.lower():
                        raise _RateLimited(b2 or "rate limited")
                    return None, []
            if attempt < 1:
                time.sleep(6)
        except _RateLimited:
            raise
        except Exception:
            if attempt < 1:
                time.sleep(6)
    return None, []


def _parse_responses(raw):
    """解析 DeepSeek Responses API 返回：抽取最终文本与 web_search_call 的检索来源。"""
    try:
        j = json.loads(raw)
    except Exception:
        return "", []
    items = j.get("output", []) or []
    text = ""
    sources = []
    for it in items:
        t = it.get("type")
        if t == "message":
            for c in it.get("content", []) or []:
                if c.get("type") == "output_text":
                    text += c.get("text", "")
        elif t == "web_search_call":
            action = it.get("action") or {}
            for q in (action.get("queries") or []):
                sources.append({"title": "检索式: " + str(q), "url": "", "snippet": "", "query": str(q)})
            for res in (action.get("results") or action.get("sources") or []):
                if isinstance(res, dict):
                    sources.append({"title": res.get("title") or res.get("url") or "",
                                    "url": res.get("url") or "",
                                    "snippet": res.get("snippet") or res.get("content") or "",
                                    "query": ""})
    seen = set()
    uniq = []
    for s in sources:
        k = (s.get("url"), s.get("title"))
        if k in seen:
            continue
        seen.add(k)
        uniq.append(s)
    return text, uniq


def _web_query_responses(q, speed=False):
    """DeepSeek Responses API 原生联网增强档（v4-flash + web_search）。
    服务端执行检索、无需第三方搜索 key；黑盒检索不回吐原文，来源以检索式/URL 展示。"""
    cache_key = ("web-ds", q, bool(speed))
    now = time.time()
    cached = _RAG_CACHE.get(cache_key)
    if cached and now - cached[0] < _RAG_CACHE_TTL:
        ans = dict(cached[1])
        ans["source"] = "web"
        ans["cached"] = True
        return ans
    system = _WEB_SYSTEM + (_SPEED_APPEND if speed else "")
    try:
        raw, sources = _call_responses_web(system, q, max_tokens=1300 if speed else 1800)
    except _RateLimited:
        return {"error": "llm_rate_limited", "fallback": True, "web_sources": [], "source": "web"}
    if not raw:
        return {"结论": "（当前 DeepSeek 模型未配置或不可用，无法使用原生联网检索）",
                "思考分析": "", "要点解析": [], "法规依据": [], "适用提示": "",
                "风险提示": "", "时效说明": "", "延伸问题": [],
                "web_sources": sources, "search_queries": [], "source": "web", "llm_error": True}
    ans = _parse_llm_json(raw)
    ans["web_sources"] = sources
    ans["search_queries"] = [s.get("query") or s.get("title") for s in sources if s.get("url")]
    ans["source"] = "web"
    _RAG_CACHE[cache_key] = (now, ans)
    return ans


def _web_query(q, speed=False):
    """AI 联网搜索模式：先实时检索公开网络，再交给大模型综合作答并带 [n] 引用。

    - 检索：DuckDuckGo / Wikipedia（keyless）+ 可选 Tavily/Brave（免费 Key）。
    - 综合：把检索结果作为上下文喂给大模型，要求按 [1][2] 引用来源。
    - 若所选模型本身具备原生联网（如 Perplexity sonar），则直接利用其返回的真实
      citations 作为来源（更权威）。
    - 降级：大模型未配置/不可用时，仍返回真实检索结果，保证「联网检索」可用。"""
    # DeepSeek v4 支持 Responses API 原生联网（web_search 工具，服务端执行检索）：
    # 选了 v4 模型且 provider 为 deepseek 时，走原生联网档，免去第三方搜索 key。
    if LLM_CFG.get("provider", "") == "deepseek" and re.search(r"v4", LLM_CFG.get("model", "") or "", re.I) and _llm_configured():
        return _web_query_responses(q, speed=speed)
    cache_key = ("web", q, bool(speed))
    now = time.time()
    cached = _RAG_CACHE.get(cache_key)
    if cached and now - cached[0] < _RAG_CACHE_TTL:
        ans = dict(cached[1])
        ans["source"] = "web"
        ans["cached"] = True
        return ans
    # 第 1 步：AI 先思考「该搜什么」，把自然语言问题提炼成精炼检索式
    queries = _refine_queries(q)
    # 第 2 步：按多个检索式检索并合并，官方来源优先
    results = _web_search_multi(queries, max_results=6, original=q)
    provider = LLM_CFG.get("provider", "")
    # 第 3 步：构造提示，有检索结果则作为上下文；否则请模型凭通用知识作答
    if results:
        ctx = ["【检索材料】（实时网络检索结果，编号对应下方来源）",
               "本次实际使用的检索式：" + " ｜ ".join(queries), ""]
        for i, r in enumerate(results, 1):
            ctx.append("[%d] 《%s》\nURL: %s\n发布: %s\n摘要: %s"
                       % (i, r["title"], r["url"], r.get("date", "") or "未标注",
                          r.get("snippet", "")))
        ctx.append("")
        ctx.append("用户问题：" + q)
        user_p = "\n".join(ctx)
    else:
        user_p = q
    try:
        if provider == "perplexity":
            raw, native_cites = _call_llm_ex(_WEB_SYSTEM + (_SPEED_APPEND if speed else ""), user_p, max_tokens=1300 if speed else 1800)
            # 合并原生引用（真实 URL）到检索来源
            for c in native_cites:
                if c and c not in [r["url"] for r in results]:
                    results.append({"title": c, "url": c, "snippet": ""})
        else:
            raw = _call_llm(_WEB_SYSTEM + (_SPEED_APPEND if speed else ""), user_p, max_tokens=1300 if speed else 1800)
    except _RateLimited:
        return {"error": "llm_rate_limited", "fallback": True,
                "web_sources": results, "source": "web"}
    if not raw:
        # 模型未配置/不可用：仍返回真实检索结果，保证联网检索可用
        return {"结论": "（当前 AI 模型未配置或不可用，已为你检索到以下实时网络结果）",
                "思考分析": "", "要点解析": [], "法规依据": [], "适用提示": "",
                "风险提示": "", "时效说明": "", "延伸问题": [],
                "web_sources": results, "search_queries": queries,
                "source": "web", "llm_error": True}
    ans = _parse_llm_json(raw)
    ans["web_sources"] = results
    ans["search_queries"] = queries
    ans["source"] = "web"
    _RAG_CACHE[cache_key] = (now, ans)
    return ans


def _hybrid_query(q, only_valid=True, speed=False):
    """🧠 深度融合：本地权威法规原文 + 实时联网检索并行取回，交叉核验后综合作答。

    这是三种模式里深度最高的一档：
      · 本地库给「准确、可逐字引用、带状态/文号」的法定依据；
      · 联网给「最新修订、新政解读、官方问答」的时效补充；
      · 提示词强制模型做版本交叉核验，冲突时给出取舍判断。
    两路检索并行执行（线程池），总耗时≈max(本地, 联网)，不叠加。"""
    cache_key = ("hybrid", q, bool(only_valid), bool(speed))
    now = time.time()
    cached = _RAG_CACHE.get(cache_key)
    if cached and now - cached[0] < _RAG_CACHE_TTL:
        ans = dict(cached[1])
        ans["source"] = "hybrid"
        ans["cached"] = True
        return ans

    kb_queries = _derive_queries(q)

    def _local():
        try:
            return _kb_retrieve(q, only_valid, limit=6)
        except Exception:
            return []

    def _online():
        try:
            wq = _refine_queries(q)
            return wq, _web_search_multi(wq, max_results=5, original=q)
        except Exception:
            return [], []

    rows, web_queries, results = [], [], []
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
            f1, f2 = ex.submit(_local), ex.submit(_online)
            rows = f1.result(timeout=40) or []
            web_queries, results = f2.result(timeout=40)
    except Exception:
        if not rows:
            rows = _local()

    docs_ctx = []
    for r in rows[:5]:
        docs_ctx.append({"meta": r, "body": _read_kb_body(r.get("本地路径", ""), cap=(600 if speed else 1500))})

    lines = ["【用户问题】\n%s\n" % q]
    lines.append("【本地库检索式】" + (" ｜ ".join(kb_queries) or "—"))
    lines.append("【联网检索式】" + (" ｜ ".join(web_queries) or "—") + "\n")
    if docs_ctx:
        lines.append("【A. 法规材料】（本地权威法规库全文，可逐字引用，已按相关度+效力层级排序）\n")
        lines += _fmt_kb_materials(docs_ctx, cap=(600 if speed else 1500))
    else:
        lines.append("【A. 法规材料】本次本地库未命中相关条文。\n")
    if results:
        lines.append("【B. 检索材料】（实时网络检索结果，编号对应来源列表，需自行甄别权威性）")
        for i, r in enumerate(results, 1):
            lines.append("[%d] 《%s》\nURL: %s\n发布: %s\n摘要: %s"
                         % (i, r["title"], r["url"], r.get("date", "") or "未标注",
                            r.get("snippet", "")))
        lines.append("")
    else:
        lines.append("【B. 检索材料】本次联网未获取到有效结果，请以 A 类法规原文为准。\n")
    lines.append("请严格按系统提示完成五步思考与 A/B 两类材料的交叉核验，再按 JSON 结构作答。")
    user_p = "\n".join(lines)

    try:
        raw = _call_llm(_HYBRID_SYSTEM + (_SPEED_APPEND if speed else ""), user_p, max_tokens=1400 if speed else 2000)
    except _RateLimited:
        return {"error": "llm_rate_limited", "fallback": True,
                "web_sources": results, "source": "hybrid"}
    if not raw:
        return {"error": "llm_not_configured", "fallback": True,
                "web_sources": results, "source": "hybrid"}
    ans = _parse_llm_json(raw)
    _enrich_citations(ans, docs_ctx)
    ans["web_sources"] = results
    ans["search_queries"] = (kb_queries[:3] + web_queries)[:6]
    ans["kb_hits"] = [{"标题": r.get("标题", ""), "状态": r.get("状态", ""),
                       "分类": r.get("分类", ""), "本地路径": r.get("本地路径", "")}
                      for r in rows[:5]]
    ans["source"] = "hybrid"
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
        speed = bool(body.get("speed", False))
    else:
        q = request.query_params.get("q", "")
        only_valid = request.query_params.get("only_valid", "true") != "false"
        mode = (request.query_params.get("mode") or "local").strip()
    if not q or not q.strip():
        return JSONResponse({"error": "missing q"}, status_code=400)
    try:
        return _rag_query(q.strip(), only_valid, mode, speed=speed)
    except Exception as e:
        return JSONResponse({"error": str(e), "fallback": True}, status_code=500)


# ---------------------------------------------------------------- /api/reg（法规原文：按 path 从 kb.sqlite 取正文）
@app.get("/api/reg")
def api_reg(path: str = ""):
    """按 docs.path 返回法规元数据 + 正文（来自 kb.sqlite fts.body）。仅允许库中存在的路径。"""
    if not path or not path.strip():
        return JSONResponse({"error": "missing path"}, status_code=400)
    p = path.strip().replace("\\", "/")
    db = _db_path()
    if not os.path.isfile(db):
        return JSONResponse({"error": "kb not ready"}, status_code=503)
    try:
        con = sqlite3.connect(db)
        row = con.execute(
            "SELECT path,title,type,issuer,publish_date,effective_date,source_url,status,category,topic,doc_no,summary "
            "FROM docs WHERE path=?", (p,)
        ).fetchone()
        con.close()
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    if not row:
        return JSONResponse({"error": "not found"}, status_code=404)
    meta = dict(zip(
        ["path", "title", "type", "issuer", "publish_date", "effective_date",
         "source_url", "status", "category", "topic", "doc_no", "summary"], row))
    body = _read_kb_body(p, cap=20000)
    return JSONResponse({"meta": meta, "body": body, "source": "kb"})


# ---------------------------------------------------------------- /api/explain（AI 拓展解释 / 术语解释）
_EXPLAIN_SYSTEM = """你是中国药品监管（NMPA/CDE/CFDI）、GMP 与药品研发注册领域的资深法规专家。
用户会给出一个术语、法规名称或一段内容，请你用中文进行清晰、有深度的解释或拓展：
- 先给出准确的定义/含义，再说明其在实际研发、生产、注册或质量体系中的意义；
- 若涉及具体法规，只引用法规名称与核心要求，严禁编造文号、条款号、发布日期；
- 表述精炼、条理清楚，3-6 句话，必要时用「·」分点；
- 若内容超出法规常识框架，明确说明「以官方发布为准」。
- 直接输出纯文本解释，不要使用 JSON 或代码块包裹。"""


def _normalize_explain(raw):
    """把模型可能返回的 JSON 包裹（如 {"answer":"..."}）或代码块还原为纯文本。
    兼容本地模型（如 Qwen3）习惯性把解释包成任意 JSON 的情况：退化收集所有字符串叶子拼成可读文本。"""
    if not raw:
        return ""
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n?", "", s)
        s = re.sub(r"\n?```$", "", s).strip()
    try:
        j = json.loads(s)
        if isinstance(j, dict):
            for k in ("answer", "explanation", "解释", "内容", "text", "result"):
                if isinstance(j.get(k), str) and j[k].strip():
                    s = j[k].strip()
                    break
            else:
                # 退化：递归收集所有字符串叶子，拼成一个可读解释
                parts = []
                def _collect(o):
                    if isinstance(o, str) and o.strip():
                        parts.append(o.strip())
                    elif isinstance(o, dict):
                        for v in o.values():
                            _collect(v)
                    elif isinstance(o, list):
                        for v in o:
                            _collect(v)
                _collect(j)
                if parts:
                    s = "\n".join(parts)
        elif isinstance(j, str):
            s = j.strip()
    except Exception:
        pass
    return s


@app.post("/api/explain")
async def api_explain(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    text = (body.get("text") or "").strip()
    context = (body.get("context") or "").strip()
    if not text:
        return JSONResponse({"error": "missing text"}, status_code=400)
    if not _llm_configured():
        return JSONResponse({"error": "llm not configured", "fallback": True}, status_code=503)
    usr = "待解释/拓展的内容：\n" + text
    if context:
        usr += "\n\n参考语境（仅供理解，不要照抄）：\n" + context[:1500]
    try:
        raw = _call_llm(_EXPLAIN_SYSTEM, usr)
    except _RateLimited:
        return JSONResponse({"error": "rate limited", "fallback": True}, status_code=429)
    except Exception as e:
        return JSONResponse({"error": str(e), "fallback": True}, status_code=500)
    explain = _normalize_explain(raw)
    if not explain:
        return JSONResponse({"error": "empty response", "fallback": True}, status_code=502)
    return JSONResponse({"text": text, "explain": explain, "source": "llm"})


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
        # 本地模型（Ollama 等）允许空 Key，故 configured 不要求 key
        "configured": bool(LLM_CFG.get("base_url") and LLM_CFG.get("model")),
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


@app.post("/api/llm-test")
async def llm_test_post(request: Request):
    """连接测试：先验证，再保存。不写盘、不改全局配置，仅用当前填写的
    provider / api_key / model / base_url（或已保存的 Key / 预设默认）发起一次
    极短调用，确认可连通后前端才允许「保存并应用」。
    返回 {ok, model, latency_ms, error}；鉴权 / 网络 / 404 / 限流均有明确错误文案。"""
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
    # 解析实际要测试的 base_url / key / model（不写盘，不影响当前生效配置）
    keys = dict(LLM_KEYS)
    if not api_key and provider in keys:
        api_key = keys[provider]            # 没新填 Key 时，复用已保存的（对「切换后状态提示」更友好）
    if preset.get("custom"):
        custom = LLM_CUSTOM or {}
        if not base_url:
            base_url = custom.get("base_url", "")
        if not model:
            model = custom.get("model", "")
    else:
        if not base_url:
            base_url = preset.get("base_url", "")
        if not model:
            model = preset.get("default_model", "")
    missing = []
    if not model:
        missing.append("模型")
    if preset.get("custom") and not base_url:
        missing.append("Base URL")
    if missing:
        return JSONResponse({"ok": False, "error": "请填写：" + "、".join(missing)},
                            status_code=400)
    ok, mdl, latency, err = _test_llm_connection(base_url, api_key, model)
    if ok:
        return {"ok": True, "provider": provider, "model": mdl, "latency_ms": latency}
    return JSONResponse({"ok": False, "error": err or "连接失败"}, status_code=200)


# ---------------------------------------------------------------- SPA 回退

@app.get("/{full_path:path}")
def spa(full_path: str):
    if full_path.startswith("api/"):
        return JSONResponse({"error": "not found"}, status_code=404)
    f = os.path.join(STATIC, full_path)
    if os.path.isfile(f):
        return FileResponse(f)
    # 对明显带扩展名的静态资源（.md/.json/.txt 等）缺失时返回真 404，
    # 避免回退成 index.html 被前端当成“法规原文”渲染成网页源码。
    if os.path.splitext(full_path)[1]:
        return JSONResponse({"error": "not found"}, status_code=404)
    return FileResponse(os.path.join(STATIC, "index.html"))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
