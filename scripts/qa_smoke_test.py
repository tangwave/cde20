# -*- coding: utf-8 -*-
"""海云AI 问答冒烟测试 —— 对运行中的后端逐题发问并打印 8 段式结构。

用法：
    python scripts/qa_smoke_test.py                # 跑默认题组（local）
    python scripts/qa_smoke_test.py hybrid         # 指定模式：local | web | hybrid
    python scripts/qa_smoke_test.py local "自定义问题"
"""
import json
import sys
import time
import urllib.request

URL = "http://127.0.0.1:8000/api/qa-rag"


def ask(q, mode="local", only_valid=True, timeout=240):
    body = json.dumps({"q": q, "only_valid": only_valid, "mode": mode}).encode("utf-8")
    req = urllib.request.Request(URL, data=body,
                                 headers={"Content-Type": "application/json"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=timeout) as r:
        j = json.loads(r.read().decode("utf-8"))
    return j, time.time() - t0


def show(q, mode, j, dt):
    print("=" * 78)
    print("[%s] %s  (%.1fs)" % (mode, q, dt))
    if j.get("error"):
        print("  !! error:", j.get("error"))
        return
    print("  source=%s  kb_hits=%d  web=%d  queries=%s" % (
        j.get("source"), len(j.get("kb_hits") or []),
        len(j.get("web_sources") or []), (j.get("search_queries") or [])[:4]))
    print("  --思考分析--", (j.get("思考分析") or "")[:220])
    print("  --结论--", (j.get("结论") or "")[:320])
    pts = j.get("要点解析") or []
    print("  --要点解析(%d)--" % len(pts))
    for p in pts[:5]:
        print("     *", p.get("要点"), "|", (p.get("说明") or "")[:110])
    ba = j.get("法规依据") or []
    print("  --法规依据(%d)--" % len(ba))
    for c in ba[:5]:
        print("     -", c.get("标题"), "|", c.get("状态"),
              "|", (c.get("引用原文") or "")[:70])
    ws = j.get("web_sources") or []
    if ws:
        print("  --检索来源(%d)--" % len(ws))
        for s in ws[:4]:
            print("     ~", (s.get("标题") or "")[:60], "|", (s.get("url") or "")[:70])
    print("  --适用提示--", (j.get("适用提示") or "")[:200])
    print("  --风险提示--", (j.get("风险提示") or "")[:200])
    print("  --时效说明--", (j.get("时效说明") or "")[:160])
    print("  --延伸问题--", j.get("延伸问题"))


DEFAULT_QS = [
    "化学药品仿制药BE试验豁免的条件是什么",
    "MAH 需要承担哪些主体责任？如果委托生产，责任如何划分？",
    "无菌药品生产的洁净区级别怎么划分？A/B/C/D 级分别对应哪些操作？",
    "创新药 IND 申报，60 日默示许可是怎么计算的？",
]


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "local"
    qs = sys.argv[2:] or DEFAULT_QS
    for q in qs:
        try:
            j, dt = ask(q, mode)
            show(q, mode, j, dt)
        except Exception as e:  # noqa: BLE001
            print("=" * 78)
            print("[%s] %s  -> EXCEPTION: %r" % (mode, q, e))


if __name__ == "__main__":
    main()
