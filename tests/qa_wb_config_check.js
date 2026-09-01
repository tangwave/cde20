/* 模块配置自检：字段/统计/列/示例数据一致性 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const FILE = path.join(__dirname, '..', 'js', 'qa-workbench.js');
const src = fs.readFileSync(FILE, 'utf8');

function slice(startMark, endMark) {
  const i = src.indexOf(startMark);
  const j = src.indexOf(endMark);
  if (i < 0 || j < 0 || j <= i) throw new Error('marker not found: ' + startMark);
  return src.slice(i, j);
}

// 0. 先取真实的常量（法规依据 / 核查原则），避免误报
vm.createContext({});
const constSrc = slice('const BASIS=[', '/* AI 核查后端地址');
const cctx = { console };
vm.createContext(cctx);
vm.runInContext(constSrc + '\n;this.BASIS=BASIS;this.VD=VERIFY_PRINCIPLES_DOC;this.VC=VERIFY_PRINCIPLES_CHK;', cctx);

// 1. 模块配置
const cfg = slice('const GROUPS=[', 'function isOverdue');
const ctx = {
  BASIS: cctx.BASIS, VERIFY_PRINCIPLES_DOC: cctx.VD, VERIFY_PRINCIPLES_CHK: cctx.VC,
  console
};
vm.createContext(ctx);
vm.runInContext(cfg + '\n;this.M=M;this.GROUPS=GROUPS;this.ORDER=ORDER;', ctx);
const M = ctx.M, GROUPS = ctx.GROUPS, ORDER = ctx.ORDER;

// 2. 示例数据 S
const sIdx = src.indexOf('  const S={\n');
const eIdx = src.indexOf('  ORDER.forEach(m=>{if(S[m]){');
const sSrc = src.slice(sIdx, eIdx).trim().replace(/^const S=/, '');
ctx.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
ctx.today = () => new Date().toISOString().slice(0, 10);
vm.runInContext('this.S=' + sSrc + ';', ctx);
const S = ctx.S;

let err = [], warn = [], info = [];
const GRADE_OK = true;

// 22 模块完整性
if (ORDER.length !== 22) err.push('模块数量应为 22，实际 ' + ORDER.length);
const inGroup = [];
GROUPS.forEach(g => g.mods.forEach(m => inGroup.push(m)));
if (inGroup.length !== new Set(inGroup).size) err.push('GROUPS 中存在重复模块');
ORDER.forEach(m => { if (!M[m]) err.push('ORDER 引用了未定义模块: ' + m); });
Object.keys(M).forEach(m => { if (!ORDER.includes(m)) err.push('定义了但未纳入导航: ' + m); });

ORDER.forEach(m => {
  const d = M[m];
  if (!d.name || !d.ic) err.push(`[${m}] 缺少 name/ic`);
  if (!Array.isArray(d.fields) || !d.fields.length) err.push(`[${m}] 缺少 fields`);
  if (!Array.isArray(d.cols) || !d.cols.length) err.push(`[${m}] 缺少 cols`);
  if (!Array.isArray(d.stats) || d.stats.length < 4) err.push(`[${m}] stats 少于 4 个`);

  const keys = new Set(), dataKeys = new Set();
  d.fields.forEach(f => {
    if (keys.has(f.key)) err.push(`[${m}] 字段 key 重复: ${f.key}`);
    keys.add(f.key);
    if (f.type !== 'section') dataKeys.add(f.key);
    const okTypes = ['text', 'textarea', 'select', 'multiselect', 'date', 'number', 'files', 'section'];
    if (!okTypes.includes(f.type)) err.push(`[${m}.${f.key}] 未知字段类型 ${f.type}`);
    if ((f.type === 'select' || f.type === 'multiselect') && (!Array.isArray(f.options) || !f.options.length))
      err.push(`[${m}.${f.key}] ${f.type} 缺少 options`);
  });

  // cols 必须都是真实字段（非分节）
  d.cols.forEach(c => { if (!dataKeys.has(c)) err.push(`[${m}] cols 引用了不存在的字段: ${c}`); });

  // stats where 键必须存在
  d.stats.forEach(s => {
    if (s[1] === 'where') {
      Object.keys(s[2] || {}).forEach(k => { if (!dataKeys.has(k)) err.push(`[${m}] stats where 引用不存在字段: ${k}`); });
    } else if (!['count', 'open', 'overdue'].includes(s[1])) {
      err.push(`[${m}] 未知统计口径: ${s[1]}`);
    }
  });

  // status 字段与 done 值一致
  const st = d.fields.find(f => f.key === 'status');
  if (!st) err.push(`[${m}] 缺少 status 字段`);
  else {
    if (st.type !== 'select') err.push(`[${m}] status 应为 select`);
    (d.done || []).forEach(v => { if (!st.options.includes(v)) err.push(`[${m}] done 值「${v}」不在 status 选项内`); });
    if ((d.done || []).length === 0) warn.push(`[${m}] done 为空 → 所有记录均视为未闭环（请确认是否符合预期）`);
  }
  if (!d.fields.some(f => f.key === 'owner')) warn.push(`[${m}] 无 owner 字段`);
  if (!d.fields.some(f => f.key === 'dueDate')) warn.push(`[${m}] 无 dueDate 字段（首页「今日/逾期」统计不到）`);
  if (!d.fields.some(f => f.type === 'section')) warn.push(`[${m}] 未做表单分节`);
});

// 示例数据校验
Object.keys(S).forEach(m => {
  if (!M[m]) { err.push(`示例数据引用未定义模块: ${m}`); return; }
  const st = M[m].fields.find(f => f.key === 'status');
  const fmap = {};
  M[m].fields.forEach(f => { if (f.type !== 'section') fmap[f.key] = f; });
  S[m].forEach(r => {
    if (!r.code) err.push(`示例 [${m}] 缺 code`);
    if (st && r.status && !st.options.includes(r.status))
      err.push(`示例 [${m}.${r.code}] status「${r.status}」不在选项内（选项：${st.options.join('/')}）`);
    Object.keys(r).forEach(k => {
      if (k === 'id') return;
      if (!fmap[k]) { err.push(`示例 [${m}.${r.code}] 字段「${k}」已不存在于新配置`); return; }
      const f = fmap[k];
      if ((f.type === 'select') && r[k] && !f.options.includes(r[k]))
        err.push(`示例 [${m}.${r.code}] ${k}「${r[k]}」不在选项内（${f.type}）`);
      if ((f.type === 'multiselect') && Array.isArray(r[k]))
        r[k].forEach(v => { if (!f.options.includes(v)) err.push(`示例 [${m}.${r.code}] ${k} 选项「${v}」不在选项内`); });
    });
  });
});
ORDER.forEach(m => { if (!S[m]) warn.push(`模块 [${m}] 无示例数据`); });

// 汇总输出
console.log('===== QA 工作台模块配置自检 =====');
console.log('模块数：' + ORDER.length + '   示例数据模块数：' + Object.keys(S).length);
ORDER.forEach(m => {
  const d = M[m];
  const sec = d.fields.filter(f => f.type === 'section').length;
  info.push(`  ${d.ic} ${d.name.padEnd(12, '　')} 字段 ${String(d.fields.length - sec).padStart(2)} + ${sec}节   列 ${d.cols.length}   统计 ${d.stats.length}`);
});
console.log(info.join('\n'));
console.log('\n--- 警告 (' + warn.length + ') ---');
warn.forEach(w => console.log('  ! ' + w));
console.log('--- 错误 (' + err.length + ') ---');
err.forEach(e => console.log('  x ' + e));
console.log(err.length ? '\n结果：FAIL' : '\n结果：PASS');
process.exit(err.length ? 1 : 0);
