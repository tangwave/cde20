@echo off
REM 海云AI 法规问答后端启动器
REM 双击即常驻；或交给 Windows 计划任务「登录时」运行，实现开机自启。
setlocal
cd /d "%~dp0"
set PORT=8000
REM 大模型：OpenRouter 代理的 DeepSeek v4-flash（OpenAI 兼容 /chat/completions）
REM 非密钥项显式传入，避免被系统/用户环境变量（如 LLM_MODEL=qwen3:8b）覆盖 .env
set LLM_PROVIDER=openai
set LLM_BASE_URL=https://openrouter.ai/api/v1
set LLM_MODEL=deepseek/deepseek-v4-flash
set LLM_TIMEOUT=120
set LLM_TEMP=0.3
REM 密钥从被 git 忽略的 .env 读取（不写进本文件，避免泄露到仓库）
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  if /i "%%A"=="LLM_API_KEY" set "LLM_API_KEY=%%B"
)
if not defined LLM_API_KEY (
  echo [WARN] 未在 .env 中找到 LLM_API_KEY，请在 .env 填入 OpenRouter key 后重试
)
"C:\Users\tangw\.workbuddy\binaries\python\envs\default\Scripts\python.exe" api\server.py
endlocal
