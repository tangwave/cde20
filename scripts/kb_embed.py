#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
kb_embed.py — 给本地法规库 kb.sqlite 的 docs 表补一列语义向量（vec）。

用途：让检索从「纯关键词 BM25」升级为「BM25 + 向量语义」混合召回，
弥补 FTS5 trigram 无法做近义/同义匹配的短板（如「BE试验豁免」→
《人体生物等效性试验豁免指导原则》）。

实现：
  · 用本机 Ollama 的 nomic-embed-text 模型对每篇文档
    （标题 + 摘要 + 正文前 1500 字，加 nomic 的 search_document: 前缀）生成向量；
  · 结果以 float32 小端字节存进 docs.vec（紧凑，约 3101×768×4 ≈ 9.5MB）；
  · server.py 在检索时加载全部向量到内存，与查询向量做余弦召回。

用法：
  python scripts/kb_embed.py                 # 仅补嵌「尚未有向量」的文档
  python scripts/kb_embed.py --force         # 全量重嵌（模型换了/文本更新了时）
  python scripts/kb_embed.py --model bge-m3  # 用其它 Ollama 嵌入模型
  EMBED_BASE=http://127.0.0.1:11434 python scripts/kb_embed.py

注意：脚本只新增/更新 vec 列，不改动任何既有字段；kb.sqlite 本就 gitignore。
"""
import argparse
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kb_common as C  # noqa: E402

DB = os.path.join(C.KB, "00_索引", "kb.sqlite")
EMBED_BASE = (os.environ.get("EMBED_BASE") or "http://127.0.0.1:11434").rstrip("/")
EMBED_MODEL = os.environ.get("EMBED_MODEL") or "nomic-embed-text"
BATCH = 32
DOC_CAP = 1500


def ensure_col(con):
    cols = [r[1] for r in con.execute("PRAGMA table_info(docs)")]
    if "vec" not in cols:
        con.execute("ALTER TABLE docs ADD COLUMN vec BLOB")
        con.commit()
        print("[kb_embed] 已新增 docs.vec 列")
    else:
        print("[kb_embed] docs.vec 列已存在")


def embed(texts):
    """批量调用 Ollama /api/embed，返回 list[list[float]]。失败抛异常。"""
    payload = {
        "model": EMBED_MODEL,
        "input": ["search_document: " + t for t in texts],
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        EMBED_BASE + "/api/embed",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        j = json.loads(r.read().decode("utf-8"))
    embs = j.get("embeddings") or []
    if len(embs) != len(texts):
        raise RuntimeError("embed 返回数量不匹配：%d != %d" % (len(embs), len(texts)))
    return embs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="全量重嵌（忽略已有向量）")
    ap.add_argument("--model", default=None, help="覆盖嵌入模型名")
    ap.add_argument("--base", default=None, help="覆盖 Ollama 地址")
    args = ap.parse_args()

    if args.model:
        global EMBED_MODEL
        EMBED_MODEL = args.model
    if args.base:
        global EMBED_BASE
        EMBED_BASE = args.base.rstrip("/")

    if not os.path.isfile(DB):
        print("索引不存在：%s\n请先准备 kb.sqlite（构建/下载/挂载）。" % DB)
        return 1

    print("[kb_embed] 模型=%s  Ollama=%s  batch=%d" % (EMBED_MODEL, EMBED_BASE, BATCH))

    # 探一下模型是否可用 + 维度
    try:
        probe = embed(["探针"])
        dim = len(probe[0])
        print("[kb_embed] 嵌入维度 = %d" % dim)
    except Exception as e:
        print("[kb_embed] ✗ 无法连接 Ollama 嵌入模型：%s" % e)
        print("          请确认 Ollama 已启动且已拉取模型：ollama pull %s" % EMBED_MODEL)
        return 2

    con = sqlite3.connect(DB)
    ensure_col(con)

    where = "" if args.force else "WHERE d.vec IS NULL"
    sql = (
        "SELECT d.path, d.title, d.summary, f.body FROM docs d "
        "JOIN ftsmap mp ON mp.docid = d.id "
        "JOIN fts f ON f.rowid = mp.rowid_ " + where
    )
    rows = con.execute(sql).fetchall()
    total = len(rows)
    if total == 0:
        print("[kb_embed] 所有文档均已向量化，无需处理。")
        con.close()
        return 0
    print("[kb_embed] 待嵌入文档数 = %d" % total)

    done = 0
    t0 = time.time()
    for i in range(0, total, BATCH):
        batch = rows[i:i + BATCH]
        texts = []
        for (path, title, summ, body) in batch:
            text = (title or "")
            if summ:
                text += "\n" + summ
            if body:
                text += "\n" + body[:DOC_CAP]
            texts.append(text.strip())
        try:
            embs = embed(texts)
        except Exception as e:
            print("[kb_embed] ✗ 批次 %d 嵌入失败：%s（已跳过，可重跑补嵌）"
                  % (i // BATCH, e))
            continue
        for (path, _t, _s, _b), e in zip(batch, embs):
            arr = np.asarray(e, dtype=np.float32)
            blob = arr.tobytes()
            con.execute("UPDATE docs SET vec=? WHERE path=?", (blob, path))
        done += len(batch)
        con.commit()
        if (i // BATCH) % 10 == 0 or done == total:
            el = time.time() - t0
            print("  … %d/%d  (%.1fs)" % (done, total, el))

    con.close()
    print("[kb_embed] ✅ 完成：本次新增/更新 %d 篇向量，耗时 %.1fs"
          % (done, time.time() - t0))
    return 0


if __name__ == "__main__":
    sys.exit(main())
