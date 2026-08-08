# 药品研发质量体系知识库 · 海云AI 法规问答（一键部署仓库）

把「药品研发质量知识库前端」+「海云AI 法规问答实时后端」打包成一个可一键部署的 Git 仓库。
**Git 主仓使用 Gitee**；后端 FastAPI 同源托管前端静态站 + `/api/qa` 检索接口，调用本地 `kb.sqlite`（约 3096 篇法规）。

> **海云AI 深度推理输出结构**（8 段式）：
> 【思考分析】→【结论】→【要点解析】→【法规依据】→【适用提示】→【风险提示】→【时效说明】→【延伸问题】。
> 引用格式为《标题》（发布机构，文号，发布日期，状态）> 原文摘录 本地：路径 来源：URL，
> 并按效力层级（法律 > 行政法规 > 部门规章 > 规范性文件 > 技术指导原则 > ICH > 国外参考）排序、自动做时效核验。
>
> **三种作答模式**：
> - 📚 **本地法规库**（`mode=local`）：标题 IDF 语义扫描 + FTS5 全文检索混合召回，引用可溯源；
> - 🌐 **联网搜索**（`mode=web`）：AI 提炼检索式 → 必应 RSS 实时检索 → 相关性过滤 → 综合作答；
> - 🧠 **深度融合**（`mode=hybrid`）：本地原文与实时网络**并行**检索，交叉核验后作答（最完整）。

## 目录结构（仓库根即 KB 根）

```
pharma-kb-render/
├── index.html              # 前端入口（meta[qa-api-base]="/" → 同域实时）
├── css/  js/               # 前端资源
├── api/
│   ├── server.py           # FastAPI：静态托管 + /api/qa + /api/qa-rag + /api/llm-* + /api/health + SPA 回退
│   └── requirements.txt    # fastapi, uvicorn, beautifulsoup4, markdownify
├── scripts/
│   ├── kb_query.py         # 本地 SQLite 检索（被 server.py 以子进程调用）
│   ├── kb_common.py        # kb_query 依赖
│   ├── download_kb.sh      # 构建阶段拉取 kb.sqlite（KB_SQLITE_URL）
│   └── sync_to_github.sh   # Gitee → GitHub 镜像（Render 部署用）
├── 00_索引/                # 放 kb.sqlite（默认 .gitignore，构建时下载）
├── regulations/            # 法规正文（可选，前端穿透阅读用）
├── Dockerfile              # 容器化部署（Gitee 原生，推荐）
├── docker-compose.yml      # 一键 compose 启动
├── render.yaml             # Render Blueprint（经 GitHub 镜像后一键部署）
├── Procfile                # 非 Blueprint 部署备用
├── start.sh                # 本地/VPS/Docker 启动（含运行时下载 kb.sqlite）
├── .gitignore  .gitattributes  .dockerignore
└── README.md
```

## 0. 推到 Gitee（主仓）

```bash
cd pharma-kb-render
git init && git add -A && git commit -m "pharma-kb-render: 海云AI 实时问答 + 对话式前端"
git remote add gitee <你的 Gitee 仓库 SSH/HTTPS 地址>
git push -u gitee main        # 或 master，按 Gitee 默认分支
```

`kb.sqlite`（约 212MB，超过 Gitee 单文件 100MB 限制）已写入 `.gitignore`，**不会进 git**。
部署时再下载（见下方两种方式的 `KB_SQLITE_URL`）或挂载卷。

---

## 方式一（推荐，Gitee 原生）：Docker 自托管

适用于任意能 `git clone` Gitee 的云主机 / VPS（腾讯云、阿里云、1 核 2G 即可）。
**不受 Gitee 不被 Render 支持的限制**，且常驻稳定。

```bash
# 1) 拉取代码
git clone <你的 Gitee 仓库> pharma-kb-render && cd pharma-kb-render

# 2) 准备法规库（二选一）
#    a) 构建时下载：在 .env 填入 KB_SQLITE_URL（一个 kb.sqlite 的直链）
#       echo "KB_SQLITE_URL=https://xxxx/kb.sqlite" > .env
#       docker compose up -d --build
#    b) 宿主机先放好 kb.sqlite，再挂载卷（更快、可复用）：
#       mkdir -p 00_索引 && curl -fsSL <直链> -o 00_索引/kb.sqlite
#       docker compose up -d

# 3) 访问
#    http://<服务器IP>:8000   （云端需放行 8000 端口；绑定域名可前置 Nginx/Caddy）
```

- 容器内 `start.sh` 负责：必要时下载 `kb.sqlite` → 启动 uvicorn（同源托管前端 + `/api/qa`）。
- 前端 `meta[qa-api-base]="/"` → 同域实时，`fetch('/api/qa')` 免 CORS。
- 进程挂掉自动 `restart: unless-stopped`；配合云厂商「开机自启 / 监控自愈」即常驻。

> 想用 Nginx 反代 + HTTPS（域名）：在 Nginx 把 `/` 反代到 `127.0.0.1:8000`，
> 前端 `meta` 仍为 `"/"`（同域）。无需改 `server.py`。

---

## 方式二：Render 一键部署（需先把 Gitee 镜像到 GitHub）

Render **原生只支持 GitHub / GitLab / Bitbucket，不支持 Gitee**。
因此用 `sync_to_github.sh` 把 Gitee 代码镜像到 GitHub，再由 Render 拉取：

```bash
# 1) GitHub 新建同名空仓库，拿到地址
export GITHUB_REMOTE="git@github.com:<你>/pharma-kb-render.git"
# 2) 一键镜像（首次会添加 github remote 并强推当前分支）
bash scripts/sync_to_github.sh
# 3) Render 控制台 → New → Blueprint → 导入该 GitHub 仓库
#    Environment 设 KB_SQLITE_URL（kb.sqlite 直链）；其余 render.yaml 已配好
# 4) 部署完得到域名，前端已 "/"，同域实时，零改配置
```

之后在 Gitee 更新代码后，重跑 `bash scripts/sync_to_github.sh` 即可触发 Render 重新部署。

---

## 本地 / 自有 VPS 直接运行（无 Docker）

```bash
pip install -r api/requirements.txt
PORT=8000 bash start.sh          # start.sh 会在缺库时按 KB_SQLITE_URL 下载
# 或：uvicorn api.server:app --host 0.0.0.0 --port 8000
```

打开 `http://localhost:8000`。`server.py` 自动向上查找 `scripts/kb_query.py`（KB 根）
与 `index.html`（静态根），**嵌套布局与本扁平仓库布局都能跑**，无需改路径。

## 前端实时 / 快照 切换

`index.html` 的 `<meta name="qa-api-base" content="...">`：

| content 值            | 行为                                                         |
|-----------------------|--------------------------------------------------------------|
| `""`（空）            | 静态快照：随站分发 3096 篇元数据，纯前端检索，零后端         |
| `"/"` 或 `same-origin`| 同域实时：前端与 api 同源，`fetch('/api/qa')` 免 CORS（本仓库默认）|
| `https://api.x.com`   | 跨域实时：后端已开 CORS `*`，前端跨域调用                     |

实时接口不可用时，前端**自动回退快照**，不会白屏。

## 持久化 / 开机自启（常驻后端，Windows）

仓库 `scripts/` 下提供 Windows 常驻包（`start_backend.ps1` / `.bat` / `install_autostart.ps1` / `pharma-kb-task.xml`），
可注册为「登录时自启」任务或 nssm 服务。公网可达三方案对比：

- **Docker 自托管（方式一）**：最稳、常驻、地址固定（自有域名），推荐用于长期对外服务。
- **localhost.run 临时隧道**（脚本默认）：零账号、HTTPS、地址随机且随会话失效 → 仅临时演示。
- **自有 VPS + autossh**：稳定域名、持久，需一台 VPS 与域名。

> Gitee 主仓 + Docker 自托管 = 既可 `git clone` 直接拉最新代码，又能稳定对外提供 海云AI 实时问答。

## 安全要点

- `/api/qa` 仅暴露白名单参数 `q/cat/topic/issuer/status/since/until/only_valid/n`；
  严禁 `--path`/`--full`，参数以列表传入子进程，无 shell 注入。
- `n` 钳制 1–30，`q` 长度 1–200，超时 25s。
- SPA 回退对 `api/*` 返回 404，不泄露内部文件。

## 进阶：从「实时引用」到「真·问答」（已内置 RAG 后端）

当前后端已内置 `POST /api/qa-rag`：**多轮检索 → 从 `kb.sqlite` 取命中全文 → 调用
OpenAI 兼容大模型，按海云AI 八段式（思考分析 / 结论 / 要点解析 / 法规依据 / 适用提示 / 风险提示 / 时效说明 / 延伸问题）合成答案**，
并逐字摘录原文、标注本地路径与来源。前端对自由提问默认走该接口，与 WorkBuddy 内
主流大模型的回答质量对齐；**未配置大模型时自动回退**到原有「模板检索」模式，站点不会白屏。

> **默认即智谱 BigModel GLM-4.7-Flash**：`server.py` 已内置 `LLM_BASE_URL` 与 `LLM_MODEL` 默认值，
> 因此你只需在 `.env` 填入 `LLM_API_KEY`（形如 `id.secret`）即可，无需改其它项。
> 免费额度存在速率限制（HTTP 429 / 错误码 1302）：站点会**透明提示「AI 限流」**并自动回退到检索摘要；
> 同一问题 1 小时内命中缓存、不再调用模型，可节省额度。

### 启用 / 更换大模型

**方式 A（推荐，免重启，在网页里操作）：** 打开 海云AI 对话 → 点右上角 **⚙️ AI 模型**
→ 选择服务商（智谱 / DeepSeek / 通义千问 / OpenAI / Kimi / 混元 / 火山方舟 / 自定义）
→ 粘贴 API Key → **保存并应用**。配置立即生效，并写入服务端 `llm_config.json`
（已 `.gitignore`，仅存本机），下次启动自动沿用，**无需重启**。

- 内置服务商：选好后模型下拉会自动列出可选模型，通常**只需粘贴 API Key** 即可使用。
- 切换模型但不想重填 Key：Key 留空即沿用当前已配置的 Key。
- 自定义：选「自定义」后手填 Base URL 与模型名，可接任意 OpenAI 兼容端点。

**方式 B（编辑 `.env`，需重启）：**

```bash
cp .env.example .env        # 然后填入下面三项（默认已指向智谱，通常只填 LLM_API_KEY）
```

| 变量 | 说明 | 默认 / 示例 |
|---|---|---|
| `LLM_BASE_URL` | OpenAI 兼容的 API 基址（不含 `/chat/completions`） | `https://open.bigmodel.cn/api/paas/v4/` |
| `LLM_API_KEY` | 你的 API Key（智谱形如 `id.secret`） | `5d8c7367....QCO4oPW....` |
| `LLM_MODEL` | 模型名 | `glm-4.7-flash` / `deepseek-v3-lite` / `qwen-plus` / `gemini-2.5-flash` / `llama-3.3-70b-versatile` |
| `LLM_TIMEOUT` | 可选，默认 60 秒 | `60` |

支持 DeepSeek / 通义千问 / 智谱 GLM / OpenAI 等任意 OpenAI 兼容端点。
方式 B 填好后**重启服务**即生效（`/api/health` 的 `llm_configured` 会变为 `true`）。

**相关接口（供前端/运维使用）：**
- `GET /api/llm-presets`：返回内置服务商预设（含 base_url 与模型列表）。
- `GET /api/llm-config`：返回当前生效配置（不回传明文 Key，仅给掩码与 `configured` 标记）。
- `POST /api/llm-config`：`{provider, api_key, model, base_url?}` 运行时切换模型（免重启）。

> 注意：知识库全文取自 `kb.sqlite`（`fts.body`），**不依赖外部 `.md` 文件**；
> 因此即使部署仓库不含法规原文目录，RAG 也能读到全文。
