const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const DATA_FILE = path.join(HERE, 'data.js');
const KB_FILE = path.join(HERE, 'quality-mgmt-kb.json');

const GUARD = `if (typeof module !== 'undefined' && module.exports) {
  module.exports = KB_DATA;
}`;

// 读取 data.js
const src = fs.readFileSync(DATA_FILE, 'utf8');
const mod = { exports: {} };
const fn = new Function('module', 'exports', src + '\nreturn (typeof KB_DATA !== "undefined") ? KB_DATA : (module.exports);');
const KB_DATA = fn(mod, mod.exports);

const KB = JSON.parse(fs.readFileSync(KB_FILE, 'utf8'));

const FALLBACK = {
  detail: '该质量管理要求应纳入企业质量管理体系文件，明确责任部门、流程节点、记录要求与考核指标，结合品种特性与所处研发/生产阶段制定实施细则，并经QA审核与定期自查持续改进。',
  plan: [
    '将该要求写入对应SOP/管理规程，明确责任、流程与记录模板',
    '开展相关人员培训并保留培训与资质记录',
    '按既定频率/时机执行并记录，数据纳入趋势分析',
    '定期自查与审计，发现偏差启动CAPA并闭环',
    '纳入年度回顾与管理评审，持续改进'
  ]
};

function matchQM(text) {
  const t = String(text).toLowerCase();
  let best = null, bestScore = 0, bestKey = '';
  for (const entry of KB) {
    let score = 0; let hitKey = '';
    for (const k of entry.keys) {
      if (t.includes(k.toLowerCase())) { score += k.length >= 4 ? 3 : (k.length >= 2 ? 2 : 1); hitKey = k; }
    }
    if (score > bestScore) { bestScore = score; best = entry; bestKey = hitKey; }
  }
  if (best && bestScore > 0) {
    return { detail: best.detail, plan: best.plan, matched: bestKey, score: bestScore };
  }
  return { detail: FALLBACK.detail, plan: FALLBACK.plan, matched: '(fallback)', score: 0 };
}

// 遍历注入
let converted = 0;
const seen = {};
KB_DATA.categories.forEach(cat => {
  cat.varieties.forEach(v => {
    KB_DATA.stages.forEach(stage => {
      const sd = v.stages[stage.id];
      if (!sd || !Array.isArray(sd.quality_mgmt)) return;
      sd.quality_mgmt = sd.quality_mgmt.map(item => {
        let text, guidance;
        if (item && typeof item === 'object') {
          text = item.text; guidance = item.guidance || '';
        } else { text = String(item); guidance = ''; }
        const m = matchQM(text);
        converted++;
        // 诊断去重文本
        if (!seen[text]) seen[text] = m.matched + ' (score ' + m.score + ')';
        return { text, guidance, detail: m.detail, plan: m.plan };
      });
    });
  });
});

// 序列化
const out = 'const KB_DATA = ' + JSON.stringify(KB_DATA, null, 2) + ';\n\n' + GUARD + '\n';
fs.writeFileSync(DATA_FILE, out, 'utf8');

console.log('总计处理 quality_mgmt 条目:', converted);
console.log('data.js 已更新, 行数:', out.split('\n').length);
console.log('\n==== 诊断：去重文本 -> 匹配到的 KB 键 ====');
const keys = Object.keys(seen).sort();
keys.forEach(t => console.log(`[${seen[t]}] ${t}`));
const fb = keys.filter(t => seen[t].includes('(fallback)'));
console.log('\n使用兜底条数:', fb.length);
if (fb.length) fb.forEach(t => console.log('  兜底:', t));
