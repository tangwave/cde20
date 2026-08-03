const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const DATA_FILE = path.join(HERE, 'data.js');
const KB_FILE = path.join(HERE, 'guidance-kb.json');

const GUARD = `if (typeof module !== 'undefined' && module.exports) {
  module.exports = KB_DATA;
}`;

// 1) 读取 data.js，用 eval 载入对象（兼容尾部 module.exports 守卫）
const src = fs.readFileSync(DATA_FILE, 'utf8');
const mod = { exports: {} };
const fn = new Function('module', 'exports', src + '\nreturn (typeof KB_DATA !== "undefined") ? KB_DATA : (module.exports);');
const KB_DATA = fn(mod, mod.exports);

const KB = JSON.parse(fs.readFileSync(KB_FILE, 'utf8'));

// 类型 -> 知识库字段
const TYPE_FIELD = { process_focus: 'p', quality_focus: 'q', quality_mgmt: 'm' };
const TYPE_LABEL = { process_focus: '工艺研究重点', quality_focus: '质量研究重点', quality_mgmt: '质量管理要求' };

const FALLBACK = {
  p: '结合品种与所处研发阶段，制定具体工艺研究方案并经QA审核；关键工艺参数纳入工艺验证与变更控制，确保工艺稳健可重现。',
  q: '建立相应质量研究方法与可接受标准，经方法学验证后纳入质量标准，并定期开展趋势分析以支持质量持续可控。',
  m: '将该要求纳入质量管理体系文件(SOP/管理规程)，明确责任、流程与记录要求，开展人员培训并定期自查与持续改进。'
};

function matchGuidance(text, type) {
  const field = TYPE_FIELD[type];
  const t = String(text).toLowerCase();
  let best = null, bestScore = 0;
  for (const entry of KB) {
    let score = 0;
    for (const k of entry.keys) {
      if (t.includes(k.toLowerCase())) score += k.length >= 2 ? 2 : 1; // 长关键词权重更高
    }
    if (score > bestScore) { bestScore = score; best = entry; }
  }
  if (best && bestScore > 0) {
    return best[field] || best.a || FALLBACK[field];
  }
  return FALLBACK[field];
}

// 2) 遍历，转换三条重点数组 -> {text, guidance}
let converted = 0, withGuidance = 0, fallbackUsed = 0;
const fields = ['process_focus', 'quality_focus', 'quality_mgmt'];

KB_DATA.categories.forEach(cat => {
  cat.varieties.forEach(v => {
    KB_DATA.stages.forEach(stage => {
      const sd = v.stages[stage.id];
      if (!sd) return;
      fields.forEach(f => {
        if (!Array.isArray(sd[f])) return;
        sd[f] = sd[f].map(item => {
          let text;
          if (item && typeof item === 'object' && typeof item.text === 'string') {
            text = item.text;
          } else {
            text = String(item);
          }
          const guidance = matchGuidance(text, f);
          converted++; withGuidance++;
          return { text, guidance };
        });
      });
    });
  });
});

// 3) 重新序列化
const out = 'const KB_DATA = ' + JSON.stringify(KB_DATA, null, 2) + ';\n\n' + GUARD + '\n';
fs.writeFileSync(DATA_FILE, out, 'utf8');

console.log('总计处理重点条目:', converted);
console.log('已注入指导意见:', withGuidance);
console.log('使用兜底指导:', fallbackUsed);
console.log('data.js 已更新, 行数:', out.split('\n').length);

// 抽样校验
const sampleV = KB_DATA.categories[0].varieties[0];
const s0 = sampleV.stages[KB_DATA.stages[0].id];
console.log('\n抽样[' + sampleV.name + '/' + KB_DATA.stages[0].name + '] process_focus[0]:');
console.log('  text:', s0.process_focus[0].text);
console.log('  guidance:', s0.process_focus[0].guidance);
