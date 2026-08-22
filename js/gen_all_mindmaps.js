/**
 * 生成各分类药品思维导图
 * 为每个药品子类（化学药/生物制品/中药）生成独立思维导图
 * 数据结构：
 *   - drug-classification.js: DRUG_CLASSIFICATION（注册分类 + 申报资料要求）
 *   - subclass-detail.js: SUBCLASS_DETAIL（核心术语、差异化、生命周期案例）
 *   - class-requirements.js: CLASS_REQUIREMENTS（全生命周期要求矩阵）
 */
const fs = require('fs');
const path = require('path');

const KB_ROOT = 'F:/AI/WORKBUDDY/知识库/知识库/pharma-kb-render';
const OUTPUT_DIR = path.join(KB_ROOT, 'js', 'mindmaps');

function loadJS(filename, globalVar) {
  const src = fs.readFileSync(path.join(KB_ROOT, 'js', filename), 'utf8');
  const withoutComments = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const fn = new Function('globalThis', withoutComments + '\nreturn ' + globalVar + ';');
  return fn(globalThis);
}

const classification = loadJS('drug-classification.js', 'DRUG_CLASSIFICATION');
const subclassDetail = loadJS('subclass-detail.js', 'SUBCLASS_DETAIL');
const requirements = loadJS('class-requirements.js', 'CLASS_REQUIREMENTS');

// 建立 subclassDetail 映射
const detailMap = {};
['chemo', 'bio', 'tcm'].forEach(type => {
  if (subclassDetail[type]) {
    detailMap[type] = subclassDetail[type];
  }
});

// 阶段映射
const STAGE_MAP = {
  'discovery': '药物发现与立项',
  'preclinical': '临床前研究',
  'clinical': '临床试验',
  'nda': '上市申请',
  'commercial': '商业化生产',
  'postmarket': '上市后监测'
};

// 维度映射
const DIM_MAP = {
  'rnd': '研发要求',
  'process': '工艺要求',
  'quality': '质量要求',
  'qm': '质量管理'
};

// 确保输出目录存在
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// 生成单个子类思维导图
function generateMindmap(subtype, code, detail, regItem, matrixData) {
  const lines = [];
  const icon = subtype === 'chemo' ? '💊' : subtype === 'bio' ? '🧬' : '🌿';

  lines.push(`# ${icon} ${detail.name} — 药品注册与质量管理思维导图`);
  lines.push('');
  lines.push(`> ${regItem ? regItem.name : detail.name} | 基于国家药监局 2020 年《药品注册分类及申报资料要求》`);
  lines.push('');

  // 一、基本信息
  lines.push('## 一、基本信息');
  lines.push('');
  if (regItem && regItem.desc) {
    lines.push(`### 定义`);
    lines.push(`- ${regItem.desc}`);
    lines.push('');
  }
  if (detail.diff && detail.diff.length > 50) {
    lines.push('### 差异化特征');
    lines.push(`- ${detail.diff}`);
    lines.push('');
  }

  // 二、核心术语
  if (detail.terms && detail.terms.length > 0) {
    lines.push('## 二、核心术语');
    lines.push('');
    detail.terms.forEach(term => {
      lines.push(`- **${term.t}**：${term.d}`);
    });
    lines.push('');
  }

  // 三、全生命周期案例
  if (detail.stageCases) {
    lines.push('## 三、全生命周期案例');
    lines.push('');
    Object.keys(STAGE_MAP).forEach(stageId => {
      const cases = detail.stageCases[stageId];
      if (cases && cases.length > 0) {
        lines.push(`### ${STAGE_MAP[stageId]}`);
        lines.push('');
        cases.forEach(c => {
          lines.push(`- **${c.title}**：${c.desc}`);
        });
        lines.push('');
      }
    });
  }

  // 四、研发要求
  const discoveryData = matrixData?.discovery?.rnd;
  if (discoveryData && discoveryData.requirement) {
    lines.push('## 四、药物发现与立项要求');
    lines.push('');
    discoveryData.requirement.forEach(req => {
      lines.push(`- ${req}`);
    });
    if (discoveryData.technique && discoveryData.technique.length > 0) {
      lines.push('');
      lines.push('- **技术要点**：' + discoveryData.technique.join('；'));
    }
    lines.push('');
  }

  // 五、申报资料要求
  if (regItem && regItem.dossier && regItem.dossier.length > 0) {
    lines.push('## 五、申报资料要求');
    lines.push('');
    regItem.dossier.forEach(doc => {
      lines.push(`- ${doc}`);
    });
    lines.push('');
  }

  // 六、特殊要求
  if (regItem && regItem.special && regItem.special.length > 0) {
    lines.push('## 六、特殊要求');
    lines.push('');
    regItem.special.forEach(s => {
      lines.push(`- ${s}`);
    });
    lines.push('');
  }

  // 七、考量要点
  if (regItem && regItem.considerations && regItem.considerations.length > 0) {
    lines.push('## 七、考量要点');
    lines.push('');
    regItem.considerations.forEach(c => {
      lines.push(`- ${c}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// 收集所有子类
const allSubclasses = [];

// 化学药
const chemoCat = classification.categories.find(c => c.id === 'chemo');
if (chemoCat && chemoCat.items) {
  chemoCat.items.forEach(item => {
    const key = item.code;
    const detail = detailMap.chemo?.[key];
    if (detail) {
      allSubclasses.push({
        type: 'chemo',
        code: key,
        name: item.name,
        detail: detail,
        regItem: item,
        icon: '💊'
      });
    }
  });
}

// 生物制品 - 治疗用
const bioCat = classification.categories.find(c => c.id === 'bio');
if (bioCat && bioCat.groups) {
  bioCat.groups.forEach(group => {
    if (group.items) {
      group.items.forEach(item => {
        const key = item.code;
        const detail = detailMap.bio?.[key];
        if (detail) {
          allSubclasses.push({
            type: 'bio',
            code: key,
            name: item.name,
            detail: detail,
            regItem: item,
            icon: '🧬',
            groupName: group.name
          });
        }
      });
    }
  });
}

// 中药
const tcmCat = classification.categories.find(c => c.id === 'tcm');
if (tcmCat && tcmCat.items) {
  tcmCat.items.forEach(item => {
    const key = item.code;
    const detail = detailMap.tcm?.[key];
    if (detail) {
      allSubclasses.push({
        type: 'tcm',
        code: key,
        name: item.name,
        detail: detail,
        regItem: item,
        icon: '🌿'
      });
    }
  });
}

console.log(`✅ 找到 ${allSubclasses.length} 个药品子类`);
allSubclasses.forEach(s => console.log(`  ${s.icon} ${s.type}/${s.code}: ${s.name}`));

// 生成所有思维导图
const results = [];
allSubclasses.forEach(sub => {
  const markdown = generateMindmap(sub.type, sub.code, sub.detail, sub.regItem, requirements.mains[sub.type]?.matrix);
  const filename = `mindmap_${sub.type}_${sub.code}.md`;
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, markdown, 'utf8');
  console.log(`📄 生成: ${filename} (${markdown.split('\n').length} 行, ${markdown.length} 字)`);
  results.push({
    filename,
    filepath,
    type: sub.type,
    code: sub.code,
    name: sub.name,
    icon: sub.icon,
    groupName: sub.groupName || ''
  });
});

// 生成汇总索引
const indexLines = [];
indexLines.push('# 药品注册与质量管理思维导图汇总');
indexLines.push('');
indexLines.push('> 共 32 个药品子类思维导图，基于国家药监局 2020 年《药品注册分类及申报资料要求》');
indexLines.push('');

// 按类型分组
['chemo', 'bio', 'tcm'].forEach(type => {
  const typeMap = { chemo: '化学药', bio: '生物制品', tcm: '中药' };
  const iconMap = { chemo: '💊', bio: '🧬', tcm: '🌿' };
  const typeResults = results.filter(r => r.type === type);
  if (typeResults.length === 0) return;

  indexLines.push(`## ${iconMap[type]} ${typeMap[type]}（${typeResults.length} 个子类）`);
  indexLines.push('');
  typeResults.forEach(r => {
    indexLines.push(`- [${r.icon} ${r.name}](./${r.filename})`);
  });
  indexLines.push('');
});

// 生物制品按组分组
const bioResults = results.filter(r => r.type === 'bio');
if (bioResults.length > 0) {
  indexLines.push('### 生物制品分组');
  indexLines.push('');
  const groups = {};
  bioResults.forEach(r => {
    const g = r.groupName || '其他';
    if (!groups[g]) groups[g] = [];
    groups[g].push(r);
  });
  Object.keys(groups).forEach(g => {
    indexLines.push(`**${g}**`);
    groups[g].forEach(r => {
      indexLines.push(`- ${r.icon} [${r.name}](./${r.filename})`);
    });
  });
  indexLines.push('');
}

indexLines.push('---');
indexLines.push('');
indexLines.push('## 使用说明');
indexLines.push('');
indexLines.push('1. 点击每个子类链接可打开对应思维导图 Markdown 文件');
indexLines.push('2. 可使用 ProcessOn 等工具在线查看和编辑');
indexLines.push('3. 思维导图包含：基本信息、核心术语、全生命周期案例、研发要求、申报资料要求');
indexLines.push('');

const indexPath = path.join(OUTPUT_DIR, 'README.md');
fs.writeFileSync(indexPath, indexLines.join('\n'), 'utf8');
console.log(`\n✅ 汇总索引: ${indexPath}`);
console.log(`📊 共生成 ${results.length} 个思维导图文件`);
