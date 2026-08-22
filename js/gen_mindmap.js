/**
 * 提取药品知识库数据生成思维导图 Markdown
 */
const fs = require('fs');
const path = require('path');

const KB_ROOT = 'F:/AI/WORKBUDDY/知识库/知识库/pharma-kb-render';

function loadJS(filename, globalVar) {
  const src = fs.readFileSync(path.join(KB_ROOT, 'js', filename), 'utf8');
  const withoutComments = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const fn = new Function('globalThis', withoutComments + '\nreturn ' + globalVar + ';');
  return fn(globalThis);
}

const classification = loadJS('drug-classification.js', 'DRUG_CLASSIFICATION');
const requirements = loadJS('class-requirements.js', 'CLASS_REQUIREMENTS');

const DIM_MAP = { 'rnd': '药品研发', 'process': '工艺研究', 'quality': '质量研究', 'qm': '质量管理' };
const STAGE_MAP = {
  'discovery': '药物发现与立项',
  'preclinical': '临床前研究',
  'clinical': '临床试验',
  'nda': '上市申请',
  'commercial': '商业化生产',
  'postmarket': '上市后监测'
};
const TYPE_MAP = { 'chemo': '化学药', 'bio': '生物制品', 'tcm': '中药' };
const ICONS = {
  'chemo': '💊', 'bio': '🧬', 'tcm': '🌿',
  'discovery': '🔬', 'preclinical': '🧪', 'clinical': '⚕️',
  'nda': '📋', 'commercial': '🏭', 'postmarket': '📊',
  'rnd': '🎯', 'process': '⚙️', 'quality': '🔍', 'qm': '📜'
};

const lines = [];
lines.push('# 药品注册与质量管理要求体系');
lines.push('');
lines.push('> 基于国家药监局 2020 年《药品注册分类及申报资料要求》与全生命周期要求矩阵');
lines.push('');

// 一、注册分类概览
lines.push('## 一、注册分类概览');
lines.push('');
lines.push('### 💊 化学药（1-5 类，共 12 子项）');
lines.push('- 创新药（1 类）：全新活性成分，需完整 CTD 全套资料');
lines.push('- 改良型新药（2.1-2.4）：新剂型/新晶型/新复方/新适应症，须证明临床优势');
lines.push('- 仿制药（3.1-3.4、4 类）：BE 一致性评价为核心');
lines.push('- 境外上市药品（5.1-5.2）：境内桥接与人种差异评估');
lines.push('');
lines.push('### 🧬 生物制品（治疗用 + 预防用，含技术类型分类）');
lines.push('- 治疗用：创新型/改良型/境外上市/境内上市；含单抗、ADC、细胞治疗、基因治疗、血液制品');
lines.push('- 预防用：创新型疫苗/改良型/境外上市，强调免疫原性与保护效力');
lines.push('- 技术类型差异化：细胞库（MCB/WCB）、病毒安全、聚集体控制、DAR 分布');
lines.push('');
lines.push('### 🌿 中药（1-4 类）');
lines.push('- 中药创新药（1.1-1.3）：复方/单一提取物/新药材，强调中医药理论与人用经验');
lines.push('- 中药改良型新药（2 类）：改途径/剂型/适应症，须证明临床优势');
lines.push('- 古代经典名方（3.1-3.2）：目录内可免临床试验，以关键信息为准');
lines.push('- 同名同方药（4 类）：质量与疗效不低于对照药');
lines.push('');

// 二、全生命周期要求矩阵
lines.push('## 二、全生命周期要求矩阵');
lines.push('');

const stages = [
  { id: 'discovery', dims: ['rnd'] },
  { id: 'preclinical', dims: ['rnd', 'process', 'quality', 'qm'] },
  { id: 'clinical', dims: ['process', 'quality', 'qm'] },
  { id: 'nda', dims: ['process', 'quality', 'qm'] },
  { id: 'commercial', dims: ['process', 'quality', 'qm'] },
  { id: 'postmarket', dims: ['process', 'quality', 'qm'] }
];

for (const stage of stages) {
  lines.push(`### ${ICONS[stage.id] || '📌'} ${STAGE_MAP[stage.id]}`);
  lines.push('');
  for (const dim of stage.dims) {
    lines.push(`#### ${ICONS[dim] || '📌'} ${DIM_MAP[dim]}`);
    lines.push('');
    for (const type of ['chemo', 'bio', 'tcm']) {
      const data = requirements.mains[type]?.matrix[stage.id]?.[dim];
      if (!data || !data.requirement?.length) continue;
      const typeIcon = ICONS[type];
      lines.push(`- **${TYPE_MAP[type]}**：${data.requirement[0].substring(0, 35)}…`);
      if (data.technique?.length) {
        lines.push(`  - 技术要点：${data.technique.slice(0, 2).join('；')}`);
      }
    }
    lines.push('');
  }
}

// 三、关键质量体系
lines.push('## 三、关键质量体系要点');
lines.push('');
lines.push('### 🔍 质量研究');
lines.push('- 原料药：晶型/盐型筛选、杂质谱（ICH M7 遗传毒性）、元素杂质（ICH Q3D）');
lines.push('- 制剂：溶出度、稳定性（加速+长期）、容器密封完整性（CCI）');
lines.push('- 生物制品：细胞库检定、病毒安全（LRV≥4）、效价方法、聚集体与电荷异质性');
lines.push('- 中药：指纹图谱/特征图谱、浸出物、农药残留、重金属与黄曲霉毒素');
lines.push('');
lines.push('### ⚙️ 工艺研究');
lines.push('- 化学药：合成路线优化、关键工艺参数（CPP）、技术转移、放大效应');
lines.push('- 生物制品：细胞培养条件（DO₂/pH/渗透压）、纯化工艺、病毒清除验证');
lines.push('- 中药：提取/浓缩/干燥参数、制剂成型、批次间一致性');
lines.push('');
lines.push('### 📜 质量管理');
lines.push('- 数据完整性：ALCOA+ 原则（可归因、清晰、同步、原始、准确）');
lines.push('- 偏差管理与 CAPA：根本原因分析、纠正预防措施闭环');
lines.push('- 变更控制：与可比性研究联动，重大变更须桥接临床');
lines.push('- 年度质量回顾（APR）：趋势分析、OOS/OOT 调查');
lines.push('- 供应商审计：原料/包材/外包服务分级管理');
lines.push('');

// 四、法规依据
lines.push('## 四、核心法规与指导原则');
lines.push('');
lines.push('- 《药品注册管理办法》（2020 年第 27 号令）');
lines.push('- 《化学药/生物制品/中药注册分类及申报资料要求》（NMPA 2020 年第 44/43/68 号公告）');
lines.push('- ICH Q 系列（质量）/S 系列（非临床）/E 系列（临床）');
lines.push('- 《药品生产质量管理规范》（GMP 2010 年修订）及配套附录');
lines.push('- 《疫苗管理法》《药品管理法》');
lines.push('');

const markdown = lines.join('\n');
console.log('✅ Markdown 生成完成，总行数:', lines.length, '| 字数:', markdown.length);

// 保存到两个位置：持久位置 + 临时位置
const persistentPath = path.join(KB_ROOT, 'js', 'mindmap_output.md');
const tempPath = path.join(KB_ROOT, '.agents', 'cache', 'mindmap_input.md');
fs.writeFileSync(persistentPath, markdown, 'utf8');
fs.mkdirSync(path.dirname(tempPath), { recursive: true });
fs.writeFileSync(tempPath, markdown, 'utf8');
console.log('📄 持久文件:', persistentPath);
console.log('📄 临时文件:', tempPath);
