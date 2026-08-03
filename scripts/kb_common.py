#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
kb_common.py — 药品法规知识库抓取管线公共模块
提供：请求会话、正文转 Markdown、YAML frontmatter 生成、
      去重指纹、时效性（现行/废止/征求意见）判定、分类路由、安全文件名。
"""
import hashlib
import json
import os
import re
import unicodedata
from datetime import date, datetime

import requests
from bs4 import BeautifulSoup
from markdownify import markdownify as md

KB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(KB, "scripts", ".raw_cache")
os.makedirs(RAW_DIR, exist_ok=True)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

DEFAULT_HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


def new_session(cookies=None, extra_headers=None):
    s = requests.Session()
    s.headers.update(DEFAULT_HEADERS)
    if extra_headers:
        s.headers.update(extra_headers)
    if cookies:
        for k, v in cookies.items():
            s.cookies.set(k, v)
    s.verify = False
    requests.packages.urllib3.disable_warnings()
    return s


# ────────────────────────── 文本清洗 ──────────────────────────

def clean_text(t):
    if not t:
        return ""
    t = unicodedata.normalize("NFKC", t)
    t = t.replace("\u3000", " ").replace("\xa0", " ")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def html_to_markdown(html):
    """把正文 HTML 片段转成整洁 Markdown。"""
    if not html:
        return ""
    soup = BeautifulSoup(html, "lxml")
    for bad in soup(["script", "style", "iframe", "noscript"]):
        bad.decompose()
    text = md(str(soup), heading_style="ATX", strip=["a"] if False else None,
              bullets="-")
    return clean_text(text)


SAFE_RE = re.compile(r'[\\/:*?"<>|\r\n\t]')


def safe_filename(title, maxlen=70):
    t = SAFE_RE.sub("", title or "").strip()
    t = re.sub(r"\s+", "", t)
    t = t.replace("《", "").replace("》", "").replace("、", "")
    t = t.strip(".")
    if len(t) > maxlen:
        t = t[:maxlen]
    return t or "untitled"


# ────────────────────────── 去重指纹 ──────────────────────────

_NOISE = re.compile(r"[《》（）()\[\]【】\s，,。.、:：;；\-—_'\"“”‘’]+")


def title_fingerprint(title):
    """标题规范化指纹：去标点空白、去常见后缀，用于跨源去重。"""
    t = (title or "").strip()
    t = re.sub(r"^(关于)?(发布|印发|公开征求)?", "", t)
    t = _NOISE.sub("", t)
    t = re.sub(r"(的通告|的公告|的通知|意见的通知|征求意见稿)$", "", t)
    return hashlib.md5(t.encode("utf-8")).hexdigest()[:16]


def doc_number(text):
    """从标题/正文提取文号，如 2026年第42号 / 国药监药管〔2026〕15号。"""
    if not text:
        return ""
    pats = [
        r"[\u4e00-\u9fa5]{2,10}〔\d{4}〕\s*\d+\s*号",
        r"\d{4}\s*年\s*第\s*\d+\s*号",
        r"第\s*\d+\s*号公告",
    ]
    for p in pats:
        m = re.search(p, text)
        if m:
            return re.sub(r"\s+", "", m.group(0))
    return ""


# ────────────────────── 时效性 / 状态判定 ──────────────────────

REPEAL_PAT = re.compile(
    # NMPA/CFDI 官网在**标题**中用「【废止】」标注失效文件，正文往往仍是原文，
    # 必须优先按标题标记判定，否则会把已废止规章标成现行有效。
    r"([【\[（(]\s*(?:已)?废止\s*[】\]）)]|[【\[]\s*失效\s*[】\]]|"
    r"予以废止|同时废止|自本(公告|通告|办法)?施行之日起废止|已?失效|"
    r"宣布废止|决定废止|废止清单|不再执行|自动失效)")
DRAFT_PAT = re.compile(r"(征求意见稿|公开征求.{0,12}意见|意见反馈|反馈意见)")
TRIAL_PAT = re.compile(r"(试行|暂行)")


def parse_date(s):
    if not s:
        return ""
    s = str(s)
    # 紧凑格式 YYYYMMDD（CDE 详情页用）
    m = re.fullmatch(r"\s*(19|20)(\d{2})(\d{2})(\d{2})\s*", s)
    if m:
        try:
            return date(int(m.group(1) + m.group(2)), int(m.group(3)),
                        int(m.group(4))).isoformat()
        except ValueError:
            pass
    m = re.search(r"(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})", s)
    if m:
        y, mo, d = m.groups()
        try:
            return date(int(y), int(mo), int(d)).isoformat()
        except ValueError:
            return ""
    m = re.search(r"(\d{4})[-/年.](\d{1,2})", s)
    if m:
        y, mo = m.groups()
        try:
            return date(int(y), int(mo), 1).isoformat()
        except ValueError:
            return ""
    return ""


def extract_effective_date(text):
    """提取施行/实施日期。"""
    if not text:
        return ""
    pats = [
        r"自\s*(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)\s*起?\s*(?:施行|实施|执行|生效)",
        r"于\s*(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)\s*起?\s*(?:施行|实施|执行)",
        r"(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)\s*起(?:施行|实施|执行)",
    ]
    for p in pats:
        m = re.search(p, text)
        if m:
            return parse_date(m.group(1))
    if re.search(r"自\s*(发布|印发|公布)之日起\s*(施行|实施|执行|生效)", text):
        return "发布之日"
    return ""


def extract_comment_deadline(text):
    """提取征求意见截止日期。"""
    if not text:
        return ""
    pats = [
        r"(?:截止|截至|反馈意见.{0,8}截止)(?:日期|时间)?[为：:]*\s*(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)",
        r"于\s*(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)\s*前.{0,10}(?:反馈|回复|发送|提交)",
        r"(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)\s*前.{0,6}(?:反馈|回复|将意见)",
    ]
    for p in pats:
        m = re.search(p, text)
        if m:
            return parse_date(m.group(1))
    return ""


def judge_status(title, body, publish_date=""):
    """
    返回 (status, effective_date, comment_deadline)
    status ∈ 已废止 / 征求意见（进行中|已截止）/ 现行有效（试行）/ 现行有效（未生效）/ 现行有效
    """
    txt = f"{title}\n{body[:4000]}"
    eff = extract_effective_date(txt)
    dl = ""

    if DRAFT_PAT.search(title or "") or DRAFT_PAT.search(body[:1500] or ""):
        dl = extract_comment_deadline(txt)
        if dl:
            try:
                over = date.fromisoformat(dl) < date.today()
            except ValueError:
                over = False
            return ("征求意见（已截止）" if over else "征求意见（征集中）"), eff, dl
        return "征求意见", eff, dl

    if REPEAL_PAT.search(title or ""):
        return "已废止", eff, dl

    if eff and eff != "发布之日":
        try:
            if date.fromisoformat(eff) > date.today():
                return "现行有效（尚未生效）", eff, dl
        except ValueError:
            pass

    if TRIAL_PAT.search(title or ""):
        return "现行有效（试行）", eff, dl

    return "现行有效", eff, dl


# ────────────────────────── 分类路由 ──────────────────────────

def core_title(title):
    """
    从「XX局关于发布《药物临床试验质量管理规范》的公告（2026年第50号）」
    中剥离出真正的文件名「药物临床试验质量管理规范」，用于准确分类。
    """
    t = title or ""
    m = re.findall(r"《([^《》]{4,80})》", t)
    if m:
        # 取最长的书名号内容（通常是主文件名）
        return max(m, key=len)
    t2 = re.sub(r"^.*?关于(发布|印发|公布)", "", t)
    t2 = re.sub(r"的(公告|通告|通知|决定)[（(].*?[)）]?$", "", t2)
    t2 = re.sub(r"的(公告|通告|通知|决定)$", "", t2)
    return t2.strip() or t


# ── 规范性文件主题路由（按药品全生命周期）──────────────────
TOPIC_RULES = [
    ("说明书与标签", r"说明书|标签|包装规格|药品规格|标示|"
                    r"内标签|外标签|包装标识"),
    ("OTC与分类管理", r"非处方药|处方药.{0,6}转换|转换为.{0,6}处方药|OTC|"
                     r"双跨|分类管理.{0,6}(工作|规划|目录)|处方药与非处方药"),
    ("注册审评", r"注册|申报|审评|审批|临床试验|上市许可|持有人|MAH|变更|"
                 r"补充申请|一致性评价|优先审评|突破性治疗|附条件批准|"
                 r"关联审评|受理|技术转让|再注册|仿制药|参比制剂|"
                 r"生物等效|BE试验|新药|进口药|批准文号|品种目录|"
                 r"批准.{0,25}上市|规程转正|地标升国标|换发|"
                 r"药品标准.{0,6}(提高|转正)"),
    ("生产质量", r"GMP|生产质量管理|生产监督|委托生产|放行|无菌|洁净|"
                 r"工艺验证|变更管理|质量受权|物料|车间|生产许可|"
                 r"数据可靠性|计算机化系统"),
    ("经营流通", r"GSP|经营质量|经营许可|零售|批发|网络销售|配送|"
                 r"追溯|流通|连锁|药店|供应保障|短缺药|"
                 r"进口备案|退运|口岸|通关|广告|基本药物|物流|"
                 r"集中采购|价格"),
    ("上市后监管", r"不良反应|药物警戒|PSUR|召回|再评价|说明书修订|"
                  r"风险管理|安全性信息|监测|上市后研究|定期安全"),
    ("中药民族药", r"中药|中医|民族药|饮片|配方颗粒|经典名方|"
                  r"中成药|药材|炮制|保护品种"),
    ("生物制品", r"疫苗|生物制品|血液制品|批签发|细胞治疗|基因治疗|"
                r"抗体|胰岛素|生物类似药|CGT|干细胞|血浆"),
    ("特殊药品", r"麻醉药品|精神药品|毒性药品|放射性药品|易制毒|"
                r"兴奋剂|药品类易制毒|特殊管理"),
    ("检查执法", r"检查|稽查|处罚|飞行检查|GLP|GCP|有因检查|"
                r"违法|查处|信用|黑名单|责任约谈|监督抽检"),
    ("标准药典", r"药典|标准|对照品|质量标准|命名|编码|通用名称|"
                r"标准物质|检验方法|国家标准"),
]


def route_normative(t):
    """规范性文件主题细分。"""
    for name, pat in TOPIC_RULES:
        if re.search(pat, t):
            return f"07_规范性文件/{name}"
    return "07_规范性文件/综合管理"


# 真部门规章：局令 / 总局令 / 委令 / 部令
ORDER_PAT = re.compile(
    r"(局令|总局令|部令|委令|监督管理局令|国家药品监督管理局令|"
    r"卫生部令|国家食品药品监督管理总局令)\s*第?\s*\d+\s*号|"
    r"第\s*\d+\s*号令")
# 公文文种（规范性文件）
DOCTYPE_PAT = re.compile(
    r"(公告|通告|通知|批复|复函|函|决定|公示|意见|答复|说明|"
    r"征求意见稿|意见稿)\s*[（(]?")


def route_category(title, issuer="", src=""):
    """返回 (相对目录, type 字段)。优先用书名号内的真实文件名判定。"""
    raw = title or ""
    t = core_title(raw)
    # 1) 法律
    if re.search(r"^中华人民共和国.{2,20}法(（.*?）)?$", t) or \
       re.search(r"^(药品管理法|疫苗管理法|中医药法|生物安全法|专利法)", t) or \
       re.search(r"^全国人民代表大会.*?关于修改.*?法", raw):
        return "01_法律", "法律"
    # 2) 行政法规
    if re.search(r"条例(（.*?）)?$|实施条例|国务院令|国务院关于", t):
        return "02_行政法规", "行政法规"
    # 2.5) 部门规章：带「局令第X号」的一律归 03
    if ORDER_PAT.search(raw):
        return "03_部门规章", "部门规章"
    # 3) ICH
    if re.search(r"\bICH\b|^(M|E|Q|S)\d{1,2}[A-Z]?(\(R\d\))?[：:（(\s]", t):
        return "04_技术指导原则/ICH_转化", "ICH指导原则"
    # 4) 检查/核查类（CFDI 主战场）
    if re.search(r"检查要点|判定原则|检查指南|核查要点|现场检查|检查细则|"
                 r"检查工作程序|检查标准|评定标准|检查指导原则", t):
        return "04_技术指导原则/CFDI_检查指南", "检查指南"
    # 5) 部门规章 / 规范性文件（管理办法、规定、规范、GxP 正文）
    if re.search(r"管理办法(（.*?）)?$|管理规定(（.*?）)?$|监督管理办法|"
                 r"质量管理规范|管理规范(（.*?）)?$|实施办法|工作程序|"
                 r"若干规定|专门规定|局令|管理制度|监督管理规定", t) \
            and "指导原则" not in t:
        return "03_部门规章", "部门规章"
    # 6) 技术指导原则
    if re.search(r"指导原则|技术要求|技术指南|技术规范|申报资料要求|"
                 r"研究技术|评价技术|指南(（.*?）)?$", t):
        if "CDE" in src or "药品审评中心" in issuer or "药审中心" in raw:
            return "04_技术指导原则/CDE_指导原则", "技术指导原则"
        if "CFDI" in src or "核查中心" in issuer:
            return "04_技术指导原则/CFDI_检查指南", "技术指导原则"
        return "04_技术指导原则/NMPA_指导原则", "技术指导原则"
    # 7) 行业共识 / 团体标准
    if re.search(r"团体标准|行业共识|专家共识|^T/|共识$", t):
        return "05_行业共识", "行业共识"
    # 8) 公文文种 → 规范性文件（按主题细分）
    if DOCTYPE_PAT.search(raw) or re.search(
            r"(公告|通告|通知|批复|复函|决定|公示|意见)$", raw):
        return route_normative(raw), "规范性文件"
    # 9) 兜底：按发布源
    if "CFDI" in src or "核查中心" in issuer:
        return "04_技术指导原则/CFDI_检查指南", "规范性文件"
    if "CDE" in src:
        return "04_技术指导原则/CDE_指导原则", "规范性文件"
    return route_normative(raw), "规范性文件"


# ────────────────────── Markdown 落盘 ──────────────────────

def yaml_escape(s):
    s = str(s or "").replace('"', "'").replace("\n", " ")
    return s


def build_markdown(meta, body_md):
    fm = [
        "---",
        f'title: "{yaml_escape(meta.get("title"))}"',
        f'type: {yaml_escape(meta.get("type"))}',
        f'issuer: {yaml_escape(meta.get("issuer"))}',
        f'publish_date: {yaml_escape(meta.get("publish_date"))}',
        f'effective_date: {yaml_escape(meta.get("effective_date"))}',
        f'source_url: {yaml_escape(meta.get("source_url"))}',
        f'status: {yaml_escape(meta.get("status"))}',
        f'category: {yaml_escape(meta.get("category"))}',
        f'summary: "{yaml_escape(meta.get("summary"))}"',
    ]
    if meta.get("doc_no"):
        fm.append(f'doc_no: {yaml_escape(meta["doc_no"])}')
    if meta.get("comment_deadline"):
        fm.append(f'comment_deadline: {yaml_escape(meta["comment_deadline"])}')
    for k in ("scope", "discipline", "keywords"):
        if meta.get(k):
            fm.append(f'{k}: {yaml_escape(meta[k])}')
    if meta.get("attachments"):
        fm.append("attachments:")
        for a in meta["attachments"]:
            # 各爬虫的附件既有 "名称 | URL" 字符串，也有 {name, url} 字典，
            # 统一规范为 "名称 | URL"，避免 frontmatter 里出现 dict repr。
            if isinstance(a, dict):
                a = f'{a.get("name", "") or "附件"} | {a.get("url", "")}'
            fm.append(f'  - "{yaml_escape(a)}"')
    fm.append(f'crawled_at: {datetime.now().strftime("%Y-%m-%d")}')
    fm.append("---")
    fm.append("")
    fm.append(f'# {meta.get("title")}')
    fm.append("")
    fm.append(f'> **发布机构**：{meta.get("issuer")}　|　**发布日期**：{meta.get("publish_date")}'
              f'　|　**状态**：{meta.get("status")}')
    if meta.get("doc_no"):
        fm.append(f'> **文号**：{meta["doc_no"]}')
    fm.append(f'> **来源**：{meta.get("source_url")}')
    fm.append("")
    fm.append("---")
    fm.append("")
    fm.append(body_md)
    return "\n".join(fm) + "\n"


def make_summary(title, body, limit=160):
    b = re.sub(r"\s+", "", body or "")
    b = re.sub(r"^[#>*\-\|]+", "", b)
    s = b[:limit]
    return s if s else (title or "")[:limit]


# ────────────────────────── 状态存储 ──────────────────────────

class State:
    def __init__(self, path):
        self.path = path
        self.data = {"visited": {}, "saved": {}, "fingerprints": {}}
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    self.data.update(json.load(f))
            except Exception:
                pass

    def save(self):
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=1)
        os.replace(tmp, self.path)

    def seen(self, key):
        return key in self.data["visited"]

    def mark(self, key, val=1):
        self.data["visited"][key] = val

    def has_fp(self, fp):
        return fp in self.data["fingerprints"]

    def add_fp(self, fp, path):
        self.data["fingerprints"][fp] = path


def load_existing_fingerprints():
    """扫描现有知识库，建立标题指纹 → 文件 映射，用于防重。"""
    fps = {}
    for root, _dirs, files in os.walk(KB):
        if any(x in root for x in (".git", "node_modules", "quality-system-app",
                                   "scripts", ".workbuddy")):
            continue
        for fn in files:
            if not fn.endswith(".md"):
                continue
            p = os.path.join(root, fn)
            try:
                with open(p, "r", encoding="utf-8") as f:
                    head = f.read(1200)
            except Exception:
                continue
            m = re.search(r'^title:\s*"?(.+?)"?\s*$', head, re.M)
            title = m.group(1) if m else os.path.splitext(fn)[0]
            fps[title_fingerprint(title)] = os.path.relpath(p, KB)
            u = re.search(r'^source_url:\s*"?(\S+?)"?\s*$', head, re.M)
            if u:
                fps["url:" + u.group(1).rstrip("/")] = os.path.relpath(p, KB)
    return fps
