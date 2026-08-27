#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""多设备共享工作区同步测试：设备A创建 -> 设备B拉取看到；设备B创建 -> 设备A增量同步看到。"""
import json
import time
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"

def get(token, path):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + path, headers=h, method="GET")
    try:
        r = urllib.request.urlopen(req, timeout=10)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def post(token, path, body):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers=h, method="POST")
    try:
        r = urllib.request.urlopen(req, timeout=10)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def call(method, path, body=None, token=None, raw=False):
    if method == "GET":
        st, b = get(token, path)
    else:
        st, b = post(token, path, body)
    if raw:
        return st, b
    try:
        return st, json.loads(b or "{}")
    except Exception:
        return st, {}

OK = 0
FAIL = 0
def chk(name, cond, extra=""):
    global OK, FAIL
    if cond:
        OK += 1
        print("  [PASS]", name)
    else:
        FAIL += 1
        print("  [FAIL]", name, extra)

WS = "multi_dev_%d" % int(time.time())
PW = "pw_12345"

print("=== 设备A 注册 ===")
st, body = call("POST", "/api/register", {"name": WS, "password": PW})
tokA = body.get("token", "")
chk("设备A 注册", st == 200 and tokA, str((st, body)))

print("=== 设备A 创建 deviation 记录 ===")
ts = int(time.time() * 1000)
rec = {"id": "m-001", "fields": {"title": "设备A创建", "status": "开放"}, "updated_at": ts, "version": 1}
st, body = call("POST", "/api/deviation/records", {"record": rec, "baseVersion": None}, tokA)
chk("设备A 创建记录", st == 200, str((st, body)))

print("=== 设备B 登录同一工作区（模拟另一终端）===")
st, body = call("POST", "/api/login", {"name": WS, "password": PW})
tokB = body.get("token", "")
chk("设备B 登录同工作区", st == 200 and tokB, str((st, body)))

print("=== 设备B 全量拉取应看到设备A数据 ===")
st, body = call("GET", "/api/bootstrap", token=tokB, raw=True)
print("  [raw] bootstrap tokB status=", st, "body=", body[:300])
bjson = json.loads(body) if st == 200 else {}
recs = bjson.get("records", [])
seen = [json.loads(r["data"]) for r in recs if r["id"] == "m-001"]
chk("设备B 拉取到设备A数据", bool(seen) and seen[0]["fields"]["title"] == "设备A创建", str(seen))

print("=== 设备B 创建 capa 记录 ===")
ts2 = int(time.time() * 1000)
rec2 = {"id": "m-002", "fields": {"title": "设备B创建", "status": "调查中"}, "updated_at": ts2, "version": 1}
st, body = call("POST", "/api/capa/records", {"record": rec2, "baseVersion": None}, tokB)
chk("设备B 创建记录", st == 200, str((st, body)))

print("=== 设备A 增量同步应看到设备B数据 ===")
st, body = call("GET", "/api/sync?since=0", token=tokA, raw=True)
print("  [raw] sync tokA status=", st, "body=", body[:300])
bjson = json.loads(body) if st == 200 else {}
chg = [json.loads(c["data"]) for c in bjson.get("changes", []) if c["id"] == "m-002"]
chk("设备A 增量同步看到设备B数据", bool(chg) and chg[0]["fields"]["title"] == "设备B创建", str(chg))

print()
print(f"=== 多设备同步: 通过 {OK} / 失败 {FAIL} ===")
import sys
sys.exit(1 if FAIL else 0)
