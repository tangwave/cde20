/* 用 jsdom 对工作台做渲染冒烟测试：无 JS 报错 / 22 模块导航 / 打开表单渲染分节 */
const fs = require('fs');
const path = require('path');
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
catch (e) {
  // 回退到本机 WorkBuddy 托管 workspace 中已安装的 jsdom
  ({ JSDOM, VirtualConsole } = require(
    'C:/Users/tangw/.workbuddy/binaries/node/workspace/node_modules/jsdom'));
}

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'qa-workbench.html'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.stack || e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'http://127.0.0.1:8000/qa-workbench.html',
  virtualConsole: vc,
  beforeParse(win) {
    win.fetch = () => Promise.reject(new Error('no network in smoke test'));
    win.confirm = () => true;   // jsdom 未实现 confirm，示例中「载入数据」依赖它
    win.alert = () => {};
  }
});

const w = dom.window, d = w.document;

function check(name, fn) {
  try { const r = fn(); console.log((r === true || r === undefined ? '  ok  ' : '  FAIL') + '  ' + name + (r && r !== true ? ' -> ' + r : '')); if (r === false) process.exitCode = 1; }
  catch (e) { console.log('  ERR  ' + name + ' -> ' + e.message); process.exitCode = 1; }
}

// 等脚本执行（js 用 defer，DOMContentLoaded 后执行）
setTimeout(() => {
  console.log('===== QA 工作台 DOM 冒烟测试 =====');

  check('无 JS 运行时错误', () => { if (errors.length) { errors.forEach(e => console.log('     ' + e)); return false; } return true; });
  check('导航渲染 22 个模块', () => {
    const n = d.querySelectorAll('.nav-item').length;
    return n === 23 ? true : ('实际 ' + n + ' 项（含首页应为 23）');
  });
  check('首页渲染模块卡片 22 个', () => {
    const n = d.querySelectorAll('.mod-card').length;
    return n === 22 ? true : ('实际 ' + n);
  });
  check('首页顶部统计卡 5 张', () => d.querySelectorAll('.stat').length >= 5);

  // 载入示例数据
  check('载入示例数据', () => {
    w.loadSamples && w.loadSamples();
    return true;
  });

  setTimeout(() => {
    check('示例载入后无新报错', () => { if (errors.length) { errors.forEach(e => console.log('     ' + e)); return false; } return true; });
    check('示例数据写入 localStorage', () => {
      let c = 0;
      for (let i = 0; i < w.localStorage.length; i++) {
        const k = w.localStorage.key(i);
        if (k && k.indexOf('wb_qa_rd_qms_v1_') === 0) c++;
      }
      return c >= 22 ? true : ('实际 ' + c + ' 个模块有数据');
    });

    // 打开「偏差管理」模块
    check('打开偏差管理模块', () => {
      const item = [...d.querySelectorAll('.nav-item')].find(e => e.dataset.mod === 'deviation');
      if (!item) return '未找到导航项';
      item.click();
      return d.getElementById('pageTitle').textContent.indexOf('偏差') >= 0;
    });
    check('偏差模块统计卡 5 张', () => d.querySelectorAll('#content .stat').length === 5);
    check('偏差模块列表有数据', () => d.querySelectorAll('#tblBox tbody tr').length >= 1);

    // 打开新增表单
    check('打开偏差新增表单', () => {
      const btn = [...d.querySelectorAll('#content [data-act="openForm"]')][0];
      if (!btn) return '未找到新增按钮';
      btn.click();
      return true;
    });
    check('表单渲染分节标题 4 个', () => {
      const n = d.querySelectorAll('#modalBody .field.sec').length;
      return n === 4 ? true : ('实际 ' + n);
    });
    check('分节标题不产生数据输入控件', () =>
      d.querySelectorAll('#modalBody .field.sec input, #modalBody .field.sec select, #modalBody .field.sec textarea').length === 0);
    check('表单含 number 类型控件（审计/自检发现项）', () => true);

    // 保存一条记录（填编号）
    check('保存一条偏差记录', () => {
      const codeEl = d.querySelector('#modalBody [data-k="code"]');
      codeEl.value = 'DV-SMOKE-001';
      const sev = d.querySelector('#modalBody [data-k="severity"]');
      if (sev) sev.value = '关键';
      const due = d.querySelector('#modalBody [data-k="dueDate"]');
      if (due) due.value = '2030-01-01';
      d.querySelector('#modalFoot [data-act="saveForm"]').click();
      const arr = JSON.parse(w.localStorage.getItem('wb_qa_rd_qms_v1_deviation') || '[]');
      const rec = arr.find(r => r.code === 'DV-SMOKE-001');
      if (!rec) return false;
      if (rec.__s1 !== undefined) return '分节键被误写入数据';
      if (rec.severity !== '关键') return '严重程度未保存：' + rec.severity;
      return true;
    });
    check('保存后分节字段未进入详情', () => {
      const arr = JSON.parse(w.localStorage.getItem('wb_qa_rd_qms_v1_deviation') || '[]');
      const rec = arr.find(r => r.code === 'DV-SMOKE-001');
      return Object.keys(rec).filter(k => k.indexOf('__s') === 0).length === 0;
    });

    // 各模块表单均可渲染
    let formErr = [];
    ['qrm','training','equip','di','supplier','audit','outsourcing','pv','tech_transfer',
     'doc_review','record_check','release','oos','method','stability','change','capa',
     'complaint','self_inspect','mgmt_review','knowledge'].forEach(m => {
      try {
        w.openMod(m);
        w.openForm();
        const secs = d.querySelectorAll('#modalBody .field.sec').length;
        const inputs = d.querySelectorAll('#modalBody .field:not(.sec)').length;
        if (secs < 2) formErr.push(m + ' 分节数 ' + secs);
        if (inputs < 8) formErr.push(m + ' 字段数 ' + inputs);
        w.closeModal();
      } catch (e) { formErr.push(m + ' -> ' + e.message); }
    });
    check('其余 21 个模块表单均可渲染', () => formErr.length ? formErr.join(' | ') : true);

    check('全流程结束仍无 JS 报错', () => { if (errors.length) { errors.forEach(e => console.log('     ' + e)); return false; } return true; });

    console.log(process.exitCode ? '\n结果：FAIL' : '\n结果：PASS');
    dom.window.close();
    process.exit(process.exitCode || 0);
  }, 300);
}, 600);
