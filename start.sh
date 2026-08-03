#!/usr/bin/env bash
# 本地 / VPS / Docker 一键启动（同源托管前端 + /api/qa）。
# 用法：  bash start.sh            # 默认 0.0.0.0:8000
#        PORT=8090 bash start.sh   # 指定端口
# 说明：  若 00_索引/kb.sqlite 不存在，会尝试用 $KB_SQLITE_URL 下载（部署时可设环境变量）。
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8000}"

DB_DIR="00_索引"
DB="$DB_DIR/kb.sqlite"
if [ ! -f "$DB" ]; then
  URL="${KB_SQLITE_URL:-}"
  if [ -n "$URL" ]; then
    echo "[start] 未找到 $DB，正在从 KB_SQLITE_URL 下载…"
    mkdir -p "$DB_DIR"
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL "$URL" -o "$DB"
    elif command -v wget >/dev/null 2>&1; then
      wget -q "$URL" -O "$DB"
    else
      echo "[start] 错误：未找到 curl/wget，且 $DB 不存在。请手动放置法规库或设置 KB_SQLITE_URL。" >&2
      exit 1
    fi
    echo "[start] 法规库下载完成：$(du -h "$DB" | cut -f1)"
  else
    echo "[start] 警告：$DB 不存在，且未设置 KB_SQLITE_URL。/api/qa 将返回空结果，前端自动回退静态快照。" >&2
  fi
fi

echo "[start] 启动 9527 法规问答后端（同源托管前端 + /api/qa），端口 $PORT"
exec uvicorn api.server:app --host 0.0.0.0 --port "$PORT"
