const fs = require('fs');

const r = JSON.parse(fs.readFileSync('F:/AI/WORKBUDDY/知识库/知识库/pharma-kb-render/js/mindmap_results.json', 'utf8'));
const grouped = { chemo: [], bio: [], tcm: [] };

r.filter(x => x.imgUrl).forEach(x => {
  if (x.file.startsWith('mindmap_chemo_')) grouped.chemo.push(x);
  else if (x.file.startsWith('mindmap_bio_')) grouped.bio.push(x);
  else if (x.file.startsWith('mindmap_tcm_')) grouped.tcm.push(x);
});

let md = '# 药品注册与质量管理思维导图汇总\n\n';
md += '> 共 32 个药品子类思维导图，基于国家药监局 2020 年《药品注册分类及申报资料要求》\n\n';
md += '## 💊 化学药\n\n';
grouped.chemo.forEach(x => {
  const name = x.title.replace(/[🧬💊🌿]/g, '').trim();
  md += `- [${name}](${x.visitUrl})\n`;
});
md += '\n## 🧬 生物制品\n\n';
grouped.bio.forEach(x => {
  const name = x.title.replace(/[🧬💊🌿]/g, '').trim();
  md += `- [${name}](${x.visitUrl})\n`;
});
md += '\n## 🌿 中药\n\n';
grouped.tcm.forEach(x => {
  const name = x.title.replace(/[🧬💊🌿]/g, '').trim();
  md += `- [${name}](${x.visitUrl})\n`;
});
md += '\n---\n\n## 本地文件\n\n';
md += '- 生成脚本: `js/gen_all_mindmaps.js`\n';
md += '- Markdown 源文件: `js/mindmaps/`\n';
md += '- 上传记录: `js/mindmap_results.json`\n';

fs.writeFileSync('F:/AI/WORKBUDDY/知识库/知识库/pharma-kb-render/js/mindmaps/README.md', md, 'utf8');
console.log('更新后:', grouped.chemo.length + grouped.bio.length + grouped.tcm.length, '个思维导图链接');
