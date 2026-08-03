// 通用生成引擎：为指定字段（process_focus / quality_focus）注入 detail + plan
// 用法: node gen-focus.js process_focus process-focus-kb.json
//       node gen-focus.js quality_focus quality-focus-kb.json
const fs = require('fs');
const path = require('path');

const FIELD = process.argv[2];
const KB_FILE = process.argv[3];
if (!FIELD || !KB_FILE) {
  console.error('用法: node gen-focus.js <field> <kb.json>');
  process.exit(1);
}

const HERE = __dirname;
const DATA_FILE = path.join(HERE, 'data.js');
const GUARD = `if (typeof module !== 'undefined' && module.exports) {
  module.exports = KB_DATA;
}`;

const src = fs.readFileSync(DATA_FILE, 'utf8');
const mod = { exports: {} };
const fn = new Function('module', 'exports', src + '\nreturn (typeof KB_DATA !== "undefined") ? KB_DATA : (module.exports);');
const KB_DATA = fn(mod, mod.exports);

const KB = JSON.parse(fs.readFileSync(path.join(HERE, KB_FILE), 'utf8'));

const FALLBACK = {
  detail: '该研究/工艺重点应基于对产品关键质量属性（CQA）与关键工艺参数（CPP）的理解，结合品种特性与所处研发/生产阶段制定研究方案，明确目的、方法、判定标准与记录要求，数据经QA审核并纳入质量标准/工艺控制策略与持续改进。',
  plan: [
    '明确该重点的研究目的、范围与判定/接受标准',
    '制定研究/开发方案，选择经验证的方法与代表性样品',
    '执行研究并完整记录数据，做必要的趋势/统计分析',
    '将结论纳入质量标准或工艺控制策略并经QA审核',
    '随数据积累与工艺放大/变更定期复评与持续改进'
  ]
};

function match(text) {
  const t = String(text).toLowerCase();
  let best = null, bestScore = 0, bestKey = '';
  for (const entry of KB) {
    let score = 0, hitKey = '';
    for (const k of entry.keys) {
      if (t.includes(k.toLowerCase())) { score += k.length >= 4 ? 3 : (k.length >= 2 ? 2 : 1); hitKey = k; }
    }
    if (score > bestScore) { bestScore = score; best = entry; bestKey = hitKey; }
  }
  if (best && bestScore > 0) return { detail: best.detail, plan: best.plan, matched: bestKey, score: bestScore };
  return { detail: FALLBACK.detail, plan: FALLBACK.plan, matched: '(fallback)', score: 0 };
}

let converted = 0;
const seen = {};
KB_DATA.categories.forEach(cat => cat.varieties.forEach(v => KB_DATA.stages.forEach(stage => {
  const sd = v.stages[stage.id];
  if (!sd || !Array.isArray(sd[FIELD])) return;
  sd[FIELD] = sd[FIELD].map(item => {
    let text, guidance;
    if (item && typeof item === 'object') { text = item.text; guidance = item.guidance || ''; }
    else { text = String(item); guidance = ''; }
    const m = match(text);
    converted++;
    if (!seen[text]) seen[text] = m.matched + ' (score ' + m.score + ')';
    return { text, guidance, detail: m.detail, plan: m.plan };
  });
})));

const out = 'const KB_DATA = ' + JSON.stringify(KB_DATA, null, 2) + ';\n\n' + GUARD + '\n';
fs.writeFileSync(DATA_FILE, out, 'utf8');

console.log(`字段 ${FIELD} 处理条目:`, converted, '| data.js 行数:', out.split('\n').length);
const keys = Object.keys(seen).sort();
const fb = keys.filter(t => seen[t].includes('(fallback)'));
console.log('去重文本数:', keys.length, '| 兜底数:', fb.length);
if (fb.length) fb.forEach(t => console.log('  兜底:', t));
