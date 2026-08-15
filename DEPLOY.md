# DEPLOY.md — Render 一键部署指南（海云AI 法规问答）

> 适用对象：没用过 Render、想把这个「药品研发质量体系法规问答」网站部署到公网的人。
> 仓库：`tangwave/cde20`（GitHub，分支 `master`）。Render 通过 GitHub 拉取代码。

---

## 一、部署前要知道的三件事

1. **代码已经在 GitHub 上**：`tangwave/cde20`，分支 `master`。Render 只支持 GitHub / GitLab / Bitbucket，**不支持 Gitee**，所以走 GitHub 这路（Gitee 是国内的镜像仓，可不用管）。
2. **法规库随代码一起进了仓库**：`kb.sqlite`（约 243MB）已 gzip 后按 40MB 切成 4 个分卷 `00_索引/kb.sqlite.gz.00~.03`（约 138MB）入库。构建时 `scripts/download_kb.sh` 会**自动合并解压还原成 `kb.sqlite`**，你**不需要**提供任何下载直链。
3. **大模型后端默认已配好 OpenRouter 免费模型**：`openai/gpt-oss-20b:free`（标准 OpenAI 兼容接口，无需付费 Key；2026-08 起 `inclusionai/ling-3.0-tiny:free` 已退出免费档，故切换默认）。网页内也可一键切换到 ChatAnywhere（GitHub 免费 Key）/ 智谱 GLM（glm-4.7-flash 永久免费）/ 通义千问 / Kimi / 火山方舟 / 腾讯混元 / 百度千帆 / 硅基流动 / DeepSeek（V3-Lite 永久免费）/ Google Gemini / Groq / Mistral AI（实验计划免费）/ Ollama（本地）等内置服务商（见第三、四节及下方对照表）。

---

## 二、部署步骤（照着点）

### 1. 准备 OpenRouter API Key
- 打开 https://openrouter.ai/keys → 登录 → **Create Key** → 复制那串 `sk-or-v1-...`。
- ⚠️ 用一把**有额度/可用**的 key，否则问答会全部失败。

### 2. 登录 Render
- 打开 https://dashboard.render.com
- 第一次点 **Sign up with GitHub**，用 GitHub 账号登录最省事（顺带授权 Render 读你的仓库）。

### 3. 用 Blueprint 导入仓库
- 登录后点左上角 **New +** → 选 **Blueprint**。
- 在仓库列表里找到 **`tangwave/cde20`**（owner 是 `tangwave`）。
  - 如果列表里看不到：点旁边的 **Configure account / Update permissions**，把 `cde20` 的访问权限勾上，再刷新回来。

### 4. 填环境变量（几乎全自动）
Render 读 `render.yaml` 后会显示要创建的服务 `pharma-qa-9527`，并列出环境变量。重点关注：

| 变量 | 值 | 你要做 |
|------|----|--------|
| `LLM_API_KEY` | 空（待填） | ✅ **必填**，把第 1 步的 OpenRouter key 粘进去 |
| `LLM_PROVIDER` | `openai` | 已填好，别改 |
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | 已填好，别改 |
| `LLM_MODEL` | `openai/gpt-oss-20b:free` | 已填好，别改 |
| `QA_DEFAULT_MODE` | `local` | 已填好，别改 |
| `KB_SQLITE_URL` | 空 | **留空不用管**（法规库分卷随代码自动还原） |
| `PORT` / `PYTHON_VERSION` | `（自动）` / `3.11` | 自动，别改 |

> 说明：`LLM_API_KEY` 在 `render.yaml` 里是 `sync: false`，**不会进 Git 仓库**，只存在 Render 控制台，安全。

### 5. 创建服务
- 拉到最下面点 **Apply / Create Web Service**。
- 状态从 `Build in progress` → `Live` 即成功（约几分钟）。

### 6. 打开网站
- 点页面上的蓝色域名 **`https://pharma-qa-9527.onrender.com`** 即可使用。
- 前端已设为同域访问（`meta[qa-api-base]="/"`），无需额外配置。

---

## 三、OpenRouter 配置说明（重点）

### 为什么用 OpenRouter 而不是别的？
- 本项目最早试过 **Cline 的 `deepseek-v4-flash`**（`https://api.cline.bot/api/v1`），但实测返回
  `403: deepseek/deepseek-v4-flash is only available via Cline product surfaces` ——
  该模型被限制在 **Cline 自家产品（VS Code 插件）里调用**，不能当通用接口给第三方应用用，所以走不通。
- **OpenRouter** 是标准 OpenAI 兼容网关，是本项目免费模型的汇聚入口（默认 `openai/gpt-oss-20b:free`，无需付费 Key；免费目录随官方调整，以 openrouter.ai 实时列表为准）。
- 也试过原生 **DeepSeek `/responses` 联网检索**：它走 DeepSeek 私有接口、且**不回吐可展示的来源链接**，对「法规问答需展示权威出处」是硬伤，故未作为默认。

### OpenRouter 真·免费模型一览（手动切换对照）

> 免费目录随官方调整，**以 [openrouter.ai/api/v1/models](https://openrouter.ai/api/v1/models) 实时列表（pricing 双 0）为准**。以下为 2026-08-15 实测真免费（共 **16** 个，均 `:free` 后缀且 prompt / completion 价格均为 0）。
> ⚠️ 注意：`inclusionai/ling-3.0-tiny:free` 已于 2026-08 从 OpenRouter 免费档移除，本项目默认模型已切换为 `openai/gpt-oss-20b:free`。

| 模型 ID（填进 `LLM_MODEL`） | 类型 / 定位 | 适合场景 | 备注 |
|---|---|---|---|
| **`openai/gpt-oss-20b:free`**（默认） | OpenAI 开放权重 20B 通用模型 | **默认推荐**：常规法规问答、长文摘要 | 通用能力强、稳定 |
| `dots-studio/dots-3-note-preview:free` | Dots 3 Note 预览（长上下文） | 笔记 / 长文摘要、法规要点梳理 | 长上下文 |
| `google/gemma-4-31b-it:free` | Gemma 4 31B 通用强模型 | 法规问答、中文理解 | 综合均衡 |
| `google/gemma-4-26b-a4b-it:free` | Gemma 4 26B（A4B 激活） | 长文处理、摘要 | 高效 |
| `nvidia/nemotron-3-super-120b-a12b:free` | Nemotron 3 Super 120B 强模型 | 复杂推理、深度问答 | 大体量 |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | Nemotron 3 Ultra 550B 超大模型 | 高难任务、最强能力 | 体量最大 |
| `nvidia/nemotron-3-nano-30b-a3b:free` | Nemotron 3 Nano 30B（A3B 激活） | 均衡、低延迟 | 高效 |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | Nemotron 3 Nano Omni 多模态推理 | 推理 + 多模态 | 推理向 |
| `nvidia/nemotron-3.5-lightning:free` | Nemotron 3.5 极速 | 低延迟问答 | 速度快 |
| `nvidia/nemotron-3.5-content-safety:free` | Nemotron 3.5 内容安全 | 安全过滤场景 | 专项 |
| `nvidia/nemotron-nano-12b-v2-vl:free` | Nemotron Nano 12B（视觉） | 图文多模态 | 支持视觉 |
| `nvidia/nemotron-nano-9b-v2:free` | Nemotron Nano 9B | 轻量通用 | 小模型 |
| `liquid/lfm-2.5-2.6b:free` | LiquidAI LFM2.5 2.6B 端侧小模型 | 端侧 / 低资源 | 极小 |
| `poolside/laguna-s-2.1:free` | 代码 / 推理向 | 代码示例、技术文档生成 | 偏代码 |
| `poolside/laguna-xs-2.1:free` | 超轻量代码模型 | 代码补全 / 低延迟 | 体量更小 |
| `cohere/north-mini-code:free` | 代码生成模型 | 代码片段生成 | 偏代码 |

切换方式（任选其一）：
1. **网页内**：设置 → 服务商选 `OpenRouter` → 模型下拉里直接选；
2. **环境变量 / render.yaml**：把 `LLM_MODEL` 改成上表任一 ID 即可，其余（`LLM_PROVIDER=openai`、`LLM_BASE_URL`）不变。

> 💡 本项目是「药品法规问答」，默认 `openai/gpt-oss-20b:free` 最稳；Nemotron 3 系列适合复杂/深度问答，Gemma 4 适合中文，其余偏代码，`liquid/lfm-2.5` 适合端侧低资源。

### 全部 17 家内置服务商对照（base_url + 免费模型）

> 以下为 2026-08 实测「可免费 / 低成本使用」的模型清单，覆盖国内外 17 家主流 OpenAI 兼容服务商。
> 网页内：设置 → 选服务商 → 粘贴 API Key（各服务商 Key 独立保存）→ 选模型即可，**无需改代码**。
> 免费额度与模型 ID 随各平台调整，以官方文档为准；新增服务商会自动并入老用户的 `llm_presets.json`。

| # | 服务商 | `base_url`（已内置） | 免费模型（**加粗=默认**） | 免费形态 | 备注 |
|---|--------|----------------------|---------------------------|----------|------|
| 1 | OpenRouter | `https://openrouter.ai/api/v1` | **`openai/gpt-oss-20b:free`**(默认)、`google/gemma-4-31b-it:free`、`google/gemma-4-26b-a4b-it:free`、`nvidia/nemotron-3-super-120b-a12b:free`、`nvidia/nemotron-3-ultra-550b-a55b:free`、`nvidia/nemotron-3-nano-30b-a3b:free`、`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`、`nvidia/nemotron-3.5-lightning:free`、`nvidia/nemotron-3.5-content-safety:free`、`nvidia/nemotron-nano-12b-v2-vl:free`(视觉)、`nvidia/nemotron-nano-9b-v2:free`、`liquid/lfm-2.5-2.6b:free`、`poolside/laguna-s-2.1:free`、`poolside/laguna-xs-2.1:free`、`cohere/north-mini-code:free`（共 15 个） | 真免费·无需付费 Key | 免费目录随官方调整（pricing 双 0）；2026-08-14 更新：移除已下架 ling-3.0-tiny，新增 Nemotron 3 系列 / LFM2.5 共 7 个真免费模型 |
| 2 | ChatAnywhere | `https://api.chatanywhere.tech/v1` | **`gpt-4o-mini`**、`gpt-3.5-turbo`、`gpt-4.1-mini`、`gpt-5-mini`、`gpt-5-nano`、`deepseek-r1` | GitHub 免费 Key·每日额度 | 绑定 GitHub 领 Key；gpt-4o-mini/3.5/4.1-mini/5-mini/5-nano 各 100 次/天，deepseek-r1 30 次/天，gpt-5/4.1 仅 5 次/天；国内 `api.chatanywhere.tech`，国外 `api.chatanywhere.org` |
| 3 | 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | **`glm-4.7-flash`**（永久免费）、`glm-4-flash`（永久免费）、`glm-5.1` | glm-4.7/4-flash 永久免费 | 新用户赠 2000 万 token |
| 4 | 通义千问 Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` | **`qwen-plus`**（每日 100 万免费）、`qwen-turbo`（永久免费）、`qwen-long`、`qwen2.5-72b-instruct` | qwen-turbo 永久免费 | 阿里云百炼 |
| 5 | Kimi（月之暗面） | `https://api.moonshot.cn/v1` | **`kimi-k2.6`**、`kimi-k3`（旗舰 1M 上下文）、`kimi-k2.7-code` | 15 元永久代金券起步 | 超长上下文，免费起步 |
| 6 | 火山方舟 豆包 | `https://ark.cn-beijing.volces.com/api/v3` | **`doubao-lite-32k`**（每日 200 万免费）、`doubao-pro-32k`、`doubao-pro-128k` | doubao-lite 每日 200 万免费 | 火山引擎方舟 |
| 7 | 腾讯混元 | `https://api.hunyuan.cloud.tencent.com/v1` | **`hunyuan-lite`**（永久免费不限量）、`hunyuan-turbo-s`、`hunyuan-t1` | hunyuan-lite 永久免费 | 通用包 1 年有效 |
| 8 | 百度千帆 | `https://qianfan.baidubce.com/v2` | **`ernie-speed-8k`**（永久免费）、`ernie-lite-8k`、`ernie-3.5-8k`、`ernie-4.5-turbo-128k` | ERNIE-Speed/Lite/3.5 永久免费 | 50 QPS 不限量 |
| 9 | 硅基流动 | `https://api.siliconflow.cn/v1` | **`Qwen/Qwen2.5-7B-Instruct`**（永久免费）、`deepseek-ai/DeepSeek-V3`、`deepseek-ai/DeepSeek-R1` | 2000 万 token + 轻量模型永久免费 | 聚合多开源模型 |
| 10 | DeepSeek | `https://api.deepseek.com/v1` | **`deepseek-v3-lite`**（永久免费）、`deepseek-v4-flash`、`deepseek-v4-pro` | V3-Lite 永久免费不限量 | 选 v4 模型走原生联网 |
| 11 | Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | **`gemini-2.5-flash`**（免费层 500 RPD）、`gemini-2.5-flash-lite`、`gemma-3-12b-it` | gemini-2.5-flash 免费·无需信用卡 | 1M 上下文 |
| 12 | Groq | `https://api.groq.com/openai/v1` | **`llama-3.3-70b-versatile`**、`llama-4-scout-17b-16e-instruct`、`qwen3-32b`、`gpt-oss-120b` | 免费层·无需信用卡 | LPU 超快推理 |
| 13 | Mistral AI | `https://api.mistral.ai/v1` | **`mistral-small-4`**（实验计划免费）、`mistral-medium-3`、`mistral-large-3`、`mistral-nemo`、`codestral`、`ministral-8b` | 实验计划免费·免信用卡 | La Plateforme；~1B tokens/月，需手机验证 |
| 14 | Ollama（本地） | `http://localhost:11434/v1` | **`qwen2.5:7b`**、`llama3.1`、`deepseek-r1:7b` | 本地部署·无需 Key | 数据不出机，合规友好 |
| 15 | GitHub Models | `https://models.inference.ai.azure.com` | **`gpt-4.1`**、`gpt-4o`、`gpt-4o-mini`、`o3-mini`、`o4-mini`、`Meta-Llama-3.3-70B-Instruct`、`Phi-4` | GitHub 账号免费·无需信用卡 | 用 GitHub 细粒度 PAT（需 Models 权限）；GPT-4.1/o3/o4-mini 等官方旗舰免费 |
| 16 | NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | **`deepseek-ai/deepseek-v4-flash`**（1M 上下文）、`meta/llama-3.3-70b-instruct`、`nvidia/llama-3.3-nemotron-super-49b-v1.5`、`qwen/qwen3.5-122b-a10b`、`minimaxai/minimax-m2.7`、`z-ai/glm-5.1` | nvapi 免费积分·无需信用卡 | 注册送 1000–5000 积分（永不过期）/40 RPM；DeepSeek V4 Flash 长上下文免费 |
| 17 | Cerebras | `https://api.cerebras.ai/v1` | **`llama-3.3-70b`**、`llama3.1-70b`、`gpt-oss-120b`、`qwen-3-32b`、`gemma-4-31b` | 1M tokens/天免费·无需信用卡 | 全球最快推理（LPU）；免费档上下文 8K，付费档可更长 |
| — | 自定义 | （自填） | （自填） | 任意 OpenAI 兼容 | 填入 base_url / model 即可 |

> 选型建议：国内中文法规问答首选 **智谱 glm-4.7-flash / 通义 qwen-plus / 腾讯 hunyuan-lite / 百度 ernie-speed**（均永久免费）；
> 想要零 Key 且数据不出机用 **Ollama 本地**；想要多模型聚合零付费用 **OpenRouter**；
> 想要超快英文/代码用 **Groq**；想要长上下文多模态用 **Gemini / Kimi**；
> 想要免信用卡直接用官方 GPT/DeepSeek 免费额度，去 **ChatAnywhere** 绑 GitHub 领免费 Key（gpt-4o-mini 等 100 次/天，deepseek-r1 30 次/天）。

### 完整配置项（已在 render.yaml 预填，你只需填 Key）
```
LLM_PROVIDER=openai                  # 务必是 openai，不是 deepseek！
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openai/gpt-oss-20b:free
LLM_API_KEY=sk-or-v1-xxxxxxxx        # 在 Render 控制台填，sync:false
```
> ⚠️ **`LLM_PROVIDER` 必须保持 `openai`**。本项目的代码里，只有 `provider=deepseek` 且模型含 `v4` 才会走 DeepSeek 私有的 `/responses` 路径；OpenRouter 是通用 `/chat/completions`，设成 `deepseek` 会误走私有接口而报错。

### 想换别的 OpenAI 兼容代理？
同理：把 `LLM_BASE_URL` / `LLM_MODEL` 改成你的代理地址和模型名，`LLM_PROVIDER` 保持 `openai` 即可。例如换 DeepSeek 直连：`LLM_BASE_URL=https://api.deepseek.com/v1`、`LLM_MODEL=deepseek-v3-lite`（V3-Lite 永久免费；若用 `deepseek-v4-flash`/`deepseek-v4-pro` 则本项目会在 `provider=deepseek` 且模型含 `v4` 时自动走原生 `/responses` 联网路径）。

---

## 四、环境变量全表

| 变量 | 默认值（仓库内） | 说明 |
|------|------------------|------|
| `LLM_PROVIDER` | `openai` | LLM 接入方式；OpenRouter/通用代理用 `openai` |
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | OpenAI 兼容基址（不含 `/chat/completions`） |
| `LLM_MODEL` | `openai/gpt-oss-20b:free` | 模型名 |
| `LLM_API_KEY` | （空，控制台填） | API Key，`sync:false` 不进仓库 |
| `LLM_TIMEOUT` | `120` | 请求超时（秒） |
| `QA_DEFAULT_MODE` | `local` | 初始默认问答模式：`local`=法规库RAG / `web`=内置联网 / `hybrid`=本地+联网深度融合 |
| `KB_SQLITE_URL` | （空） | 法规库公网直链；**留空**，分卷随代码自动还原 |
| `PORT` | （自动） | Render 注入，`sync:false` |
| `PYTHON_VERSION` | `3.11` | Python 版本 |

---

## 五、问答模式怎么选

默认 `QA_DEFAULT_MODE=local`：用共享法规库做 RAG 检索问答，最稳、有出处。
你也可以不改成环境变量，直接在前端网页里点模式切换：
- **📚 法规库（local）**：本地共享法规库检索 + LLM 作答，权威、有引用。
- **🌐 AI 联网（web）**：内置 DuckDuckGo/Wikipedia 等联网检索，能出来源链接（不是用 OpenRouter 的联网，是 app 自带的检索）。
- **🧠 深度融合（hybrid）**：本地法规原文 + 实时联网并行检索，交叉核验后作答，答案最完整。

---

## 六、运维与排错

- **免费实例会「睡觉」**：一段时间无人访问后实例休眠，第一次打开要等 **30~60 秒冷启动**，之后正常。要稳定：服务页 → Settings → Change plan 升到 Starter（约 $7/月）。
- **构建报磁盘不足（Disk quota）**：免费盘较小，升 Starter 即可。
- **改了配置想重新部署**：Render 服务页 → Environment → 改完点 Save，会自动重新构建部署；或 push 新代码到 GitHub 也会触发。
- **看日志定位问题**：服务页 → Logs，重点看 `download_kb.sh`（合并分卷是否成功）和 `uvicorn` 启动行。
- **health 自检**：访问 `https://<你的域名>/api/health`，返回里 `llm_configured:true`、`kb_sqlite_present:true`、`kb_semantic:true` 即正常。

---

## 七、本地运行（可选，不走 Render）

```bash
cd pharma-kb-render
python -m venv .venv && .venv\Scripts\activate    # Windows；Linux/Mac 用 source .venv/bin/activate
pip install -r api/requirements.txt
# 编辑 .env，确认 LLM_* 指向 OpenRouter（见第三节），LLM_API_KEY 填上
python api/server.py                               # 或双击 start_haiyun.bat
# 浏览器打开 http://127.0.0.1:8000
```
> 注意：如果本机系统环境变量里残留了旧的 `LLM_MODEL=qwen3:8b` 之类，`start_haiyun.bat` 已显式传参覆盖；直接用 `python api/server.py` 时若发现配置不对，请改用 `start_haiyun.bat` 或显式传环境变量启动。

---

## 八、安全要点

- **密钥只放在两处**：Render 控制台的环境变量（同步 `false`）、或被 git 忽略的本地 `.env`。**绝不**把明文 key 写进会提交的文件（如 `.bat`、`.yaml` 正文）。
- **GitHub 密钥扫描**：一旦提交含密钥的文件，GitHub 会**直接拒绝推送**（secret scanning），且可能记录。本项目 `start_haiyun.bat` 已从被忽略的 `.env` 读 key，仓库里无明文。
- **key 泄露处理**：若 key 曾出现在仓库/Gitee，立刻去 OpenRouter 后台 **轮换/重新生成**，旧 key 作废。
- **法规库可共享**：`kb.sqlite` 分卷已随仓库公开（用户确认非机密），无需额外加密。
