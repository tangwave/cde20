#!/usr/bin/env bash
# 将 Gitee 仓库镜像到 GitHub（Render 一键部署需要 GitHub；Gitee 本身不被 Render 原生支持）。
# 首次使用：
#   1) 在 GitHub 新建一个同名空仓库（如 pharma-kb-render），拿到 git@github.com:<你>/pharma-kb-render.git
#   2) 取消下面 GITHUB_REMOTE 注释并填好
#   3) 运行：bash scripts/sync_to_github.sh
# 之后每次在 Gitee 更新后，再跑一次本脚本即可把代码推到 GitHub（Render 自动重新部署）。
set -euo pipefail
cd "$(dirname "$0")/.."

GITHUB_REMOTE="${GITHUB_REMOTE:-git@github.com:<你的用户名>/pharma-kb-render.git}"
# 注意：kb.sqlite（约 212MB）已 gitignore，不会进入镜像；Render 端用 build 时的 KB_SQLITE_URL 下载。

echo "[sync] 拉取 Gitee 最新（origin）…"
git pull --rebase origin main || git pull --rebase origin master || true

echo "[sync] 推送到 GitHub 镜像（$GITHUB_REMOTE）…"
if ! git remote | grep -q '^github$'; then
  git remote add github "$GITHUB_REMOTE"
fi
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git push github "$BRANCH" --force

echo "[sync] 完成。请在 Render 导入该 GitHub 仓库，按 README 配置 KB_SQLITE_URL 与 startCommand：uvicorn api.server:app --host 0.0.0.0 --port \$PORT"
