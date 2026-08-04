# 海云AI 法规问答 · 一键镜像（Gitee 原生，无需 GitHub）
# 构建时按需下载 kb.sqlite（约 212MB，避免塞进 git）；运行时同域托管前端 + /api/qa
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PORT=8000 \
    KB_SQLITE_URL="" \
    KB_QUERY_PY=""

WORKDIR /app

# 仅复制依赖清单先装包，利用 Docker 层缓存
COPY api/requirements.txt /app/api/requirements.txt
RUN pip install --no-cache-dir -r /app/api/requirements.txt

# 复制全部代码
COPY . /app

# 构建期下载法规库（若提供 KB_SQLITE_URL）；不提供则运行时 start.sh 再下载
RUN if [ -n "$KB_SQLITE_URL" ]; then \
      mkdir -p /app/00_索引 && \
      (command -v curl >/dev/null && curl -fsSL "$KB_SQLITE_URL" -o /app/00_索引/kb.sqlite || \
       command -v wget >/dev/null && wget -q "$KB_SQLITE_URL" -O /app/00_索引/kb.sqlite) && \
      echo "kb.sqlite downloaded at build" || echo "KB_SQLITE_URL 未设置，将在运行时下载（或挂载卷）"; \
    fi

EXPOSE 8000

# start.sh 负责：必要时下载 kb.sqlite → 启动 uvicorn（同域托管前端 + /api/qa）
CMD ["/app/start.sh"]
