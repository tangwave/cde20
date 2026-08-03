#!/usr/bin/env bash
# 准备 kb.sqlite：构建阶段调用（render.yaml buildCommand 已引用）。
# 三种来源，按优先级选择其一：
#   1. 环境变量 KB_SQLITE_URL 指向的可下载地址（推荐，避免大文件入库）
#   2. 本地已存在 kb.sqlite（如用 Git LFS 纳入仓库，克隆后已就位）
#   3. 以上皆无 → 报错并给出清晰指引（避免静默部署出不可用实例）
set -euo pipefail

DEST="00_索引/kb.sqlite"
mkdir -p "$(dirname "$DEST")"

if [ -s "$DEST" ]; then
  echo "[download_kb] kb.sqlite 已存在（$(du -h "$DEST" | cut -f1)），跳过下载"
  exit 0
fi

URL="${KB_SQLITE_URL:-}"

if [ -z "$URL" ]; then
  echo "⚠️  未设置 KB_SQLITE_URL，且本地无 kb.sqlite。" >&2
  echo "   请在 Render 环境变量中设置 KB_SQLITE_URL，指向 kb.sqlite 的可下载地址，" >&2
  echo "   或将 kb.sqlite 通过 Git LFS 纳入仓库（见 README 的「kb.sqlite 处理」）。" >&2
  exit 1
fi

echo "[download_kb] 从 $URL 下载 kb.sqlite ..."
curl -fL "$URL" -o "$DEST.tmp"
mv "$DEST.tmp" "$DEST"
echo "[download_kb] 完成：$(du -h "$DEST" | cut -f1)"
