# DEPLOY.md — Render 一键部署指南（海云AI 法规问答）

> 适用对象：没用过 Render、想把这个「药品研发质量体系法规问答」网站部署到公网的人。
> 仓库：`tangwave/cde20`（GitHub，分支 `master`）。Render 通过 GitHub 拉取代码。

---

## 一、部署前要知道的三件事

1. **代码已经在 GitHub 上**：`tangwave/cde20`，分支 `master`。Render 只支持 GitHub / GitLab / Bitbucket，**不支持 Gitee**，所以走 GitHub 这路（Gitee 是国内的镜像仓，可不用管）。
2. **法规库随代码一起进了仓库**：`kb.sqlite`（约 243MB）已 gzip 后按 40MB 切成 4 个分卷 `00_索引/kb.sqlite.gz.00~.03`（约 138MB）入库。构建时 `scripts/download_kb.sh` 会**自动合并解压还原成 `kb.sqlite`**，你**不需要**提供任何下载直链。
3. **大模型后端默认已配好 OpenRouter**：`deepseek/deepseek-v4-flash`，标准 OpenAI 兼容接口。你只需要填一把 API Key（见第三节）。

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
| `LLM_MODEL` | `deepseek/deepseek-v4-flash` | 已填好，别改 |
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
- **OpenRouter** 是标准 OpenAI 兼容网关，支持 `deepseek/deepseek-v4-flash`，不受此限制，直接可用。
- 也试过原生 **DeepSeek `/responses` 联网检索**：它走 DeepSeek 私有接口、且**不回吐可展示的来源链接**，对「法规问答需展示权威出处」是硬伤，故未作为默认。

### 完整配置项（已在 render.yaml 预填，你只需填 Key）
```
LLM_PROVIDER=openai                  # 务必是 openai，不是 deepseek！
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=deepseek/deepseek-v4-flash
LLM_API_KEY=sk-or-v1-xxxxxxxx        # 在 Render 控制台填，sync:false
```
> ⚠️ **`LLM_PROVIDER` 必须保持 `openai`**。本项目的代码里，只有 `provider=deepseek` 且模型含 `v4` 才会走 DeepSeek 私有的 `/responses` 路径；OpenRouter 是通用 `/chat/completions`，设成 `deepseek` 会误走私有接口而报错。

### 想换别的 OpenAI 兼容代理？
同理：把 `LLM_BASE_URL` / `LLM_MODEL` 改成你的代理地址和模型名，`LLM_PROVIDER` 保持 `openai` 即可。例如换 DeepSeek 直连：`LLM_BASE_URL=https://api.deepseek.com/v1`、`LLM_MODEL=deepseek-chat`（此时若用 `deepseek-v4-flash` 想走原生联网，才需要 `provider=deepseek`）。

---

## 四、环境变量全表

| 变量 | 默认值（仓库内） | 说明 |
|------|------------------|------|
| `LLM_PROVIDER` | `openai` | LLM 接入方式；OpenRouter/通用代理用 `openai` |
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | OpenAI 兼容基址（不含 `/chat/completions`） |
| `LLM_MODEL` | `deepseek/deepseek-v4-flash` | 模型名 |
| `LLM_API_KEY` | （空，控制台填） | API Key，`sync:false` 不进仓库 |
| `LLM_TIMEOUT` | `120` | 请求超时（秒） |
| `QA_DEFAULT_MODE` | `local` | 初始默认问答模式：`local`=法规库RAG / `web`=内置联网 / `review`=本地+云端复核（Render 无本地模型，该模式不可用） |
| `KB_SQLITE_URL` | （空） | 法规库公网直链；**留空**，分卷随代码自动还原 |
| `PORT` | （自动） | Render 注入，`sync:false` |
| `PYTHON_VERSION` | `3.11` | Python 版本 |

---

## 五、问答模式怎么选

默认 `QA_DEFAULT_MODE=local`：用共享法规库做 RAG 检索问答，最稳、有出处。
你也可以不改成环境变量，直接在前端网页里点模式切换：
- **📚 法规库（local）**：本地共享法规库检索 + LLM 作答，权威、有引用。
- **🌐 AI 联网（web）**：内置 DuckDuckGo/Wikipedia 等联网检索，能出来源链接（不是用 OpenRouter 的联网，是 app 自带的检索）。
- **🔍 复核（review）**：本地模型 + 云端复核。**Render 上没有本地模型，此模式不可用**，别选。

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
