#!/usr/bin/env bash
# 准备 kb.sqlite：构建阶段调用（render.yaml buildCommand 已引用）。
# 四种来源，按优先级选择其一：
#   1. 本地已存在 kb.sqlite（直接复用，跳过）
#   2. 仓库内置「分卷 gzip」：kb.sqlite.gz.00 / .01 / ...（每卷 40MB，规避 GitHub 100MB 限制）
#      —— 合并后经 gzip 解压还原为 kb.sqlite
#   3. 仓库内置「单个 gzip」：kb.sqlite.gz（可选）
#   4. 环境变量 KB_SQLITE_URL 指向的可下载地址（推荐，避免大文件入库）
set -euo pipefail

DEST="00_索引/kb.sqlite"
DIR="$(dirname "$DEST")"
mkdir -p "$DIR"

if [ -s "$DEST" ]; then
  echo "[download_kb] kb.sqlite 已存在（$(du -h "$DEST" | cut -f1)），跳过"
  exit 0
fi

# 情况 2：分卷 gzip（仓库内置，随 git 拉取，无需外网下载）
SHARDS=$(ls "$DIR"/kb.sqlite.gz.[0-9]* 2>/dev/null | sort)
if [ -n "$SHARDS" ]; then
  echo "[download_kb] 发现分卷 kb.sqlite.gz.*（$(echo "$SHARDS" | wc -l | tr -d ' ') 卷），合并并解压..."
  # shellcheck disable=SC2086
  cat $SHARDS | gzip -d > "$DEST.tmp"
  mv "$DEST.tmp" "$DEST"
  echo "[download_kb] 完成：$(du -h "$DEST" | cut -f1)"
  exit 0
fi

# 情况 3：单个 gzip（仓库内置，可选）
if [ -s "$DIR/kb.sqlite.gz" ]; then
  echo "[download_kb] 解压 kb.sqlite.gz ..."
  gzip -d < "$DIR/kb.sqlite.gz" > "$DEST.tmp"
  mv "$DEST.tmp" "$DEST"
  echo "[download_kb] 完成：$(du -h "$DEST" | cut -f1)"
  exit 0
fi

# 情况 4：外部下载
URL="${KB_SQLITE_URL:-}"
if [ -z "$URL" ]; then
  echo "⚠️  未设置 KB_SQLITE_URL，且本地无 kb.sqlite / 分卷 / 单 gzip。" >&2
  echo "   仓库已内置分卷 kb.sqlite.gz.*（合并解压即可），一般无需设置该变量。" >&2
  echo "   仅在需要覆盖内置库时才设置 KB_SQLITE_URL，指向 kb.sqlite 的可下载地址。" >&2
  exit 1
fi

echo "[download_kb] 从 $URL 下载 kb.sqlite ..."
curl -fL "$URL" -o "$DEST.tmp"
mv "$DEST.tmp" "$DEST"
echo "[download_kb] 完成：$(du -h "$DEST" | cut -f1)"
