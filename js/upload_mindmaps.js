/**
 * 批量上传思维导图到ProcessOn
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const KB_ROOT = 'F:/AI/WORKBUDDY/知识库/知识库/pharma-kb-render';
const MINDMAPS_DIR = path.join(KB_ROOT, 'js', 'mindmaps');
const SCRIPT_DIR = 'C:/Users/tangw/.workbuddy/skills/processon-mindmap-generator__skillhub/scripts';
const PYTHON = 'python';

// 读取所有mindmap文件
const files = fs.readdirSync(MINDMAPS_DIR)
  .filter(f => f.startsWith('mindmap_') && f.endsWith('.md'))
  .sort();

console.log(`找到 ${files.length} 个思维导图文件`);

const results = [];
const tempDir = path.join(KB_ROOT, 'js', '.temp_upload');
fs.mkdirSync(tempDir, { recursive: true });

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

files.forEach((file, idx) => {
  const filePath = path.join(MINDMAPS_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // 提取标题
  const titleMatch = content.match(/^# (.+)/m);
  const title = titleMatch ? titleMatch[1].replace(' — 药品注册与质量管理思维导图', '') : file.replace('mindmap_', '').replace('.md', '');

  // 保存到临时文件
  const tempFile = path.join(tempDir, `temp_${idx}.md`);
  fs.writeFileSync(tempFile, content, 'utf8');

  console.log(`[${idx + 1}/${files.length}] 上传: ${title}`);

  try {
    const cmd = `${PYTHON} "${path.join(SCRIPT_DIR, 'processon_mindmap_client.py')}" --title "${title}" --theme "极简黑白" --structure "mind_free" --markdown-file "${tempFile}" --cleanup-markdown-file`;
    const result = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    const data = JSON.parse(result);

    if (data.ok) {
      console.log(`  ✅ ${data.data.imgUrl}`);
      results.push({ file, title, imgUrl: data.data.imgUrl, visitUrl: data.data.visitUrl });
    } else {
      console.log(`  ⚠️  失败: ${data.message}`);
      results.push({ file, title, error: data.message });
    }
  } catch (e) {
    console.log(`  ❌ 错误: ${e.message}`);
    results.push({ file, title, error: e.message });
  }

  // 等待间隔避免频率限制 (Windows兼容)
  if (idx < files.length - 1) {
    const waitMs = 3000 + Math.random() * 2000;
    console.log(`  ⏳ 等待 ${Math.round(waitMs/1000)} 秒...`);
    sleep(waitMs);
  }
});

// 保存结果
const resultFile = path.join(KB_ROOT, 'js', 'mindmap_results.json');
fs.writeFileSync(resultFile, JSON.stringify(results, null, 2), 'utf8');
console.log(`\n📊 上传完成: ${results.filter(r => r.imgUrl).length}/${files.length} 成功`);
console.log(`📄 结果已保存到: ${resultFile}`);
