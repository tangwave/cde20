#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
药品研发QA合规管理台 —— 集成测试（针对合并到知识库 server.py 后的同源服务）
契约与前端 v4 (qa-workbench.html) 严格一致：
- 注册/登录: {name, password} -> {token, workspace}
- bootstrap: GET /api/bootstrap -> {server_time, records:[{id,module,data(JSON str),version,updated_at,deleted}]}
- sync:      GET /api/sync?since= -> {server_time, changes:[同上]}
- 创建/更新: {record:{id,fields,updated_at,version}, baseVersion} -> {id,version,updated_at}; 冲突 409
- 删除:      DELETE /api/{module}/records/{rid} -> {ok, deleted_at}（软删除）
"""
import json
import time
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"

def call(method, path, body=None, token=None):
    url = BASE + path
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8") or "{}")
        except Exception:
            return e.code, {}

passed = 0
failed = 0
def check(name, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  [PASS] {name}")
    else:
        failed += 1
        print(f"  [FAIL] {name}  {extra}")

print("=== 1. 工作台路由健康检查 ===")
st, body = call("GET", "/api/qa-wb-health")
check("qa-wb-health 200", st == 200, str(body))
check("modules=22", body.get("modules") == 22, str(body))

print("=== 2. 注册 workspace ===")
WS = "int_test_ws_%d" % int(time.time())
PW = "test_pw_123"
st, body = call("POST", "/api/register", {"name": WS, "password": PW})
check("register 200", st == 200, str(body))
tok = body.get("token", "")
check("register 返回 token", bool(tok), str(body))

print("=== 3. 重复注册应失败(409) ===")
st, body = call("POST", "/api/register", {"name": WS, "password": PW})
check("重复注册 409", st == 409, str(body))

print("=== 4. 登录 ===")
st, body = call("POST", "/api/login", {"name": WS, "password": PW})
check("login 200", st == 200, str(body))
tok = body.get("token", "")
check("login 返回 token", bool(tok))
check("TokenResp 含 workspace", body.get("workspace") == WS, str(body))

print("=== 5. 错误密码登录失败(401) ===")
st, body = call("POST", "/api/login", {"name": WS, "password": "wrong"})
check("错误密码 401", st == 401, str(body))

print("=== 6. 全量拉取（初始空）===")
st, body = call("GET", "/api/bootstrap", token=tok)
check("bootstrap 200", st == 200, str(body))
check("bootstrap 含 records 数组", isinstance(body.get("records"), list), str(body))
check("初始无记录", len(body.get("records", [])) == 0, str(body))
check("bootstrap 含 server_time", bool(body.get("server_time")), str(body))

print("=== 7. 创建记录（deviation 模块）===")
ts = int(time.time() * 1000)
rec_obj = {"id": "dev-001", "fields": {"title": "灌装线偏差", "level": "重大", "status": "调查中"},
           "updated_at": ts, "version": 1}
st, body = call("POST", "/api/deviation/records", {"record": rec_obj, "baseVersion": None}, token=tok)
check("create 200", st == 200, str(body))
check("create 返回 version=1", body.get("version") == 1, str(body))
create_st = body.get("updated_at", "")

print("=== 8. 增量同步（since=0）===")
st, body = call("GET", "/api/sync?since=0", token=tok)
check("sync 200", st == 200, str(body))
changes = body.get("changes", [])
check("sync 含 1 条", len(changes) == 1, str(body))
if changes:
    ch = changes[0]
    check("change.module=deviation", ch.get("module") == "deviation", str(ch))
    check("change.id=dev-001", ch.get("id") == "dev-001", str(ch))
    check("change.data 为 JSON 字符串", isinstance(ch.get("data"), str), str(ch))
    check("change.deleted=false", ch.get("deleted") is False, str(ch))
    # 验证 data 内容可解析
    try:
        parsed = json.loads(ch["data"])
        check("data 可解析且含 title", parsed.get("fields", {}).get("title") == "灌装线偏差", str(parsed))
    except Exception as e:
        check("data 可解析", False, str(e))

print("=== 9. 更新记录（乐观锁）===")
ts2 = int(time.time() * 1000)
rec_obj2 = {"id": "dev-001", "fields": {"title": "灌装线偏差", "level": "重大", "status": "已关闭"},
            "updated_at": ts2, "version": 2}
st, body = call("PUT", "/api/deviation/records/dev-001", {"record": rec_obj2, "baseVersion": 1}, token=tok)
check("update 200", st == 200, str(body))
check("update 返回 version=2", body.get("version") == 2, str(body))
upd_st = body.get("updated_at", "")

print("=== 9b. 乐观锁冲突（旧版本应 409）===")
st, body = call("PUT", "/api/deviation/records/dev-001", {"record": rec_obj2, "baseVersion": 1}, token=tok)
check("旧 baseVersion 触发 409", st == 409, str((st, body)))

print("=== 10. 增量同步（since=创建时间）===")
st, body = call("GET", "/api/sync?since=" + create_st, token=tok)
changes = body.get("changes", [])
upd = [c for c in changes if c.get("id") == "dev-001"]
check("更新已同步", bool(upd), str(body))
if upd:
    parsed = json.loads(upd[0]["data"])
    check("更新后 status=已关闭", parsed["fields"].get("status") == "已关闭", str(parsed))

print("=== 11. 非法模块被拒(400) ===")
st, body = call("POST", "/api/not_a_module/records", {"record": rec_obj, "baseVersion": None}, token=tok)
check("非法模块 400", st == 400, str(body))

print("=== 12. 软删除 + 同步删除标记 ===")
st, body = call("DELETE", "/api/deviation/records/dev-001", token=tok)
check("delete 200", st == 200, str(body))
del_st = body.get("deleted_at", "")
st, body = call("GET", "/api/sync?since=" + del_st, token=tok)
changes = body.get("changes", [])
delc = [c for c in changes if c.get("id") == "dev-001" and c.get("deleted") is True]
check("删除以软删除形式同步", bool(delc), str(body))

print("=== 13. 无 token 访问受保护接口应 401 ===")
st, body = call("GET", "/api/bootstrap")
check("无 token bootstrap 401", st == 401, str((st, body)))

print("=== 14. QA工作台页面可访问 ===")
try:
    with urllib.request.urlopen(BASE + "/qa-workbench.html", timeout=10) as r:
        html = r.read().decode("utf-8")
    check("qa-workbench.html 200", r.status == 200)
    check("页面含合规管理台标识", ("QA" in html and "合规" in html) or "M{" in html, "len=%d" % len(html))
    check("页面含 22 模块(ORDER)", html.count("deviation") > 0 and html.count("mgmt_review") > 0, "module count check")
except Exception as e:
    check("qa-workbench.html 可访问", False, str(e))

print("=== 15. 现有 RAG 问答 /api/qa 不被破坏 ===")
st, body = call("POST", "/api/qa", {"q": "GMP 是什么"})
check("/api/qa 仍可访问 (非 404/500)", st not in (404, 500), str((st, str(body)[:120])))

print()
print(f"=== 结果: 通过 {passed} / 失败 {failed} ===")
import sys
sys.exit(1 if failed else 0)
