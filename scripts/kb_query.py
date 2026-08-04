#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
kb_query.py — 药品法规知识库检索工具（海云AI 的检索底座）。

用法示例：
  python kb_query.py "临床试验 数据管理"           # 多词 AND 检索
  python kb_query.py "GMP" --cat 03_部门规章 -n 20
  python kb_query.py "药物警戒" --status 现行有效
  python kb_query.py "细胞治疗" --since 2023 --full
  python kb_query.py --title "药品注册管理办法"     # 精确标题查找
  python kb_query.py --path 01_法律/药品管理法.md   # 直接读取原文
  python kb_query.py --list-cat                    # 查看所有分类
"""
import argparse
import json
import os
import re
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kb_common as C  # noqa: E402

DB = os.path.join(C.KB, "00_索引", "kb.sqlite")

# 状态优先级：现行有效 > 试行 > 参考 > 征求意见 > 已废止
# 注意：库内状态有 12+ 种表述变体（「现行有效（含修订）」「现行有效（中国已适用）」
# 「有效」等），必须按语义归一，不能用固定字典 get(默认值) —— 否则合法的现行有效
# 变体会被判为未知状态而排到征求意见之后。
ST_ORDER = {"现行有效": 0, "现行有效（试行）": 1, "现行有效（尚未生效）": 2,
            "征求意见（征集中）": 3, "征求意见": 4,
            "征求意见（已截止）": 5, "已废止": 9}


def st_tier(st):
    """状态 → 排序档位（越小越优先）。按语义归一，容纳所有表述变体。"""
    st = (st or "").strip()
    if not st:
        return 3
    if re.search(r"废止|失效|作废", st):
        return 9
    if "征求意见" in st:
        return 5 if "截止" in st else 4
    if "尚未生效" in st:
        return 2
    if "试行" in st or "暂行" in st:
        return 1
    if st.startswith("现行有效") or st in ("有效", "现行"):
        return 0
    if "参考" in st:
        return 3
    return 3


def esc(s):
    """FTS5 查询串转义：用双引号包裹，内部双引号翻倍。"""
    return '"' + str(s).replace('"', '""') + '"'


def build_match(q):
    """把 '临床试验 数据管理' 转成 FTS5 AND 查询。支持 OR / 引号短语。"""
    q = (q or "").strip()
    if not q:
        return ""
    if " OR " in q:
        return " OR ".join(esc(t.strip()) for t in q.split(" OR ") if t.strip())
    toks = re.findall(r'"([^"]+)"|(\S+)', q)
    terms = [a or b for a, b in toks if (a or b)]
    return " AND ".join(esc(t) for t in terms)


def snippet_of(body, terms, width=110, maxn=3):
    """在正文中截取包含关键词的片段。"""
    outs = []
    low = body
    for t in terms:
        i = low.find(t)
        if i < 0:
            continue
        s = max(0, i - width // 2)
        e = min(len(body), i + len(t) + width // 2)
        frag = body[s:e].replace("\n", " ").strip()
        frag = re.sub(r"\s+", " ", frag)
        outs.append(("…" if s > 0 else "") + frag + ("…" if e < len(body) else ""))
        if len(outs) >= maxn:
            break
    return outs


def read_body(rel):
    fp = os.path.join(C.KB, rel)
    try:
        txt = open(fp, "r", encoding="utf-8").read()
    except Exception:
        return ""
    if txt.startswith("---"):
        e = txt.find("\n---", 3)
        if e > 0:
            txt = txt[e + 4:]
    return txt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("query", nargs="?", default="")
    ap.add_argument("-n", "--num", type=int, default=10)
    ap.add_argument("--cat", default="", help="分类前缀，如 07_规范性文件")
    ap.add_argument("--topic", default="", help="主题子目录，如 注册审评")
    ap.add_argument("--status", default="", help="状态，如 现行有效")
    ap.add_argument("--issuer", default="")
    ap.add_argument("--since", default="", help="发布日期起，如 2020")
    ap.add_argument("--until", default="")
    ap.add_argument("--title", default="", help="按标题模糊查找")
    ap.add_argument("--doc-no", default="", help="按文号查找")
    ap.add_argument("--path", default="", help="直接输出该文件正文")
    ap.add_argument("--full", action="store_true", help="输出完整正文")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--list-cat", action="store_true")
    ap.add_argument("--include-repealed", action="store_true",
                    help="包含已废止（默认排在最后但不剔除）")
    ap.add_argument("--only-valid", action="store_true", help="仅现行有效")
    args = ap.parse_args()

    if args.path:
        print(read_body(args.path.replace("\\", "/")))
        return

    if not os.path.exists(DB):
        print("索引不存在，请先运行：python scripts/kb_index.py")
        return
    con = sqlite3.connect(DB)

    if args.list_cat:
        print("=== 分类 / 主题 ===")
        for c, t, n in con.execute(
                "SELECT category, topic, COUNT(*) n FROM docs "
                "GROUP BY category, topic ORDER BY category, n DESC"):
            print(f"  {n:5d}  {c}{'/' + t if t else ''}")
        return

    where, params = [], []
    if args.cat:
        where.append("d.category LIKE ?")
        params.append(args.cat + "%")
    if args.topic:
        where.append("d.topic LIKE ?")
        params.append("%" + args.topic + "%")
    if args.status:
        where.append("d.status LIKE ?")
        params.append("%" + args.status + "%")
    if args.only_valid:
        where.append("d.status LIKE '现行有效%'")
    if args.issuer:
        where.append("d.issuer LIKE ?")
        params.append("%" + args.issuer + "%")
    if args.since:
        where.append("d.publish_date >= ?")
        params.append(args.since)
    if args.until:
        where.append("d.publish_date <= ?")
        params.append(args.until + "\uffff")
    if args.title:
        where.append("d.title LIKE ?")
        params.append("%" + args.title + "%")
    if args.doc_no:
        where.append("(d.doc_no LIKE ? OR d.title LIKE ?)")
        params += ["%" + args.doc_no + "%"] * 2

    cols = ("d.path,d.title,d.type,d.issuer,d.publish_date,d.effective_date,"
            "d.source_url,d.status,d.category,d.topic,d.doc_no,d.summary")

    if args.query:
        # 列权重：标题 > 文号 > 正文 > 机构
        sql = (f"SELECT {cols}, bm25(fts, 14.0, 1.0, 8.0, 0.4) rk FROM fts "
               f"JOIN ftsmap m ON m.rowid_ = fts.rowid "
               f"JOIN docs d ON d.id = m.docid "
               f"WHERE fts MATCH ? ")
        if where:
            sql += " AND " + " AND ".join(where)
        sql += " ORDER BY rk LIMIT ?"
        lim = max(args.num * 8, 80)

        def _run(m):
            try:
                return con.execute(sql, [m] + params + [lim]).fetchall()
            except Exception:
                return []

        match = build_match(args.query)
        rows = _run(match)
        # 多词 AND 无结果时逐级降级：去尾词 -> OR 组合，避免"未命中"假阴性
        if not rows:
            toks = re.findall(r'"([^"]+)"|(\S+)', args.query or "")
            terms = [a or b for a, b in toks if (a or b)]
            if len(terms) > 1:
                for k in range(len(terms) - 1, 0, -1):
                    rows = _run(" AND ".join(esc(x) for x in terms[:k]))
                    if rows:
                        print("（%d 词严格匹配无果，已放宽为「%s」）"
                              % (len(terms), " ".join(terms[:k])))
                        break
                if not rows:
                    rows = _run(" OR ".join(esc(x) for x in terms))
                    if rows:
                        print("（严格匹配无果，已改用任意词匹配）")
    else:
        sql = f"SELECT {cols}, 0 rk FROM docs d"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY d.publish_date DESC LIMIT ?"
        rows = con.execute(sql, params + [args.num * 2]).fetchall()

    terms = [t for t in re.findall(r'"([^"]+)"|(\S+)', args.query or "")]
    terms = [a or b for a, b in terms]

    # 效力层级权重（法律 > 行政法规 > 部门规章 > 技术指导原则 > 规范性文件）
    CAT_W = {"01_法律": -3.0, "02_行政法规": -2.4, "03_部门规章": -1.8,
             "04_技术指导原则": -1.2, "07_规范性文件": -0.4, "05_行业共识": 0.0}

    def norm(s):
        """归一化标题用于精确比对：去书名号、括号注记、空白。"""
        s = re.sub(r"[《》〈〉\"'\s]", "", s or "")
        s = re.sub(r"[（(【\[].*?[）)】\]]", "", s)
        return s

    qn = norm(args.query or "")

    def key(r):
        base = st_tier(r[7])
        # 已废止/征求意见 硬性靠后；其余用综合分排序
        tier = 0 if base <= 2 else base
        score = float(r[12] or 0)          # bm25（越小越相关）
        score += CAT_W.get(r[8] or "", 0)  # 效力层级加权
        title = r[1] or ""
        tn = norm(title)
        # 标题即查询主体（如查「药物非临床研究质量管理规范」命中该规范正文），
        # 应压倒性优先于「关于实施《XX》的通知」这类衍生文件
        if qn and tn == qn:
            score -= 40.0
        elif qn and len(qn) >= 6 and tn.startswith(qn):
            score -= 20.0
        for t in terms:                    # 标题命中强加权
            if t and t in title:
                score -= 6.0
        try:                               # 近 5 年轻微加权
            yr = int((r[4] or "0")[:4])
            if yr >= 2020:
                score -= 0.6
        except ValueError:
            pass
        return (tier, score)
    rows = sorted(rows, key=key)[:args.num]

    out = []
    for r in rows:
        (path, title, typ, issuer, pd, ed, url, status, cat, topic,
         dno, summ, _rk) = r
        item = {"标题": title, "类型": typ, "发布机构": issuer,
                "发布日期": pd, "生效日期": ed, "状态": status,
                "分类": cat + ("/" + topic if topic else ""),
                "文号": dno, "本地路径": path, "来源": url,
                "摘要": summ}
        if terms:
            body = read_body(path)
            item["命中片段"] = snippet_of(body, terms)
            if args.full:
                item["正文"] = body
        elif args.full:
            item["正文"] = read_body(path)
        out.append(item)

    if args.json:
        print(json.dumps(out, ensure_ascii=False, indent=1))
        return

    if not out:
        print("未命中。可放宽条件或改用同义词（如 GMP / 生产质量管理规范）。")
        return
    print(f"命中 {len(out)} 条：\n")
    for i, it in enumerate(out, 1):
        flag = "✅" if it["状态"].startswith("现行有效") else \
               ("⚠️" if "征求意见" in it["状态"] else "❌")
        print(f"{i}. {flag} {it['标题']}")
        print(f"   {it['分类']} ｜ {it['发布机构']} ｜ 发布 {it['发布日期'] or '—'}"
              f" ｜ 状态 {it['状态']}")
        if it["文号"]:
            print(f"   文号：{it['文号']}")
        for s in it.get("命中片段", [])[:2]:
            print(f"   › {s}")
        print(f"   本地：{it['本地路径']}")
        if it["来源"]:
            print(f"   原文：{it['来源']}")
        if args.full and it.get("正文"):
            print("   " + "-" * 56)
            print(it["正文"][:4000])
        print()


if __name__ == "__main__":
    main()
