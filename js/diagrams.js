/* 流程示意图注册表（内联 SVG，浅色主题）
 * 由 App.renderDiagram(key) 调用；不依赖外部资源。
 */
(function () {
  'use strict';
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function defs() {
    return '<defs><marker id="ar" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">' +
      '<path d="M0,0 L8,3 L0,6 Z" fill="#5b8def"/></marker></defs>';
  }
  function box(x, y, w, h, label, fill, stroke, fs) {
    fs = fs || 11;
    var pad = 6, max = Math.max(2, Math.floor((w - 2 * pad) / fs));
    var chars = String(label).split(''), lines = [], cur = '';
    for (var i = 0; i < chars.length; i++) { if (cur.length >= max) { lines.push(cur); cur = ''; } cur += chars[i]; }
    if (cur) lines.push(cur); if (!lines.length) lines = [''];
    var lh = fs + 3, startY = y + h / 2 - (lines.length - 1) * lh / 2;
    var tsp = lines.map(function (ln, i) { return '<tspan x="' + (x + w / 2) + '" dy="' + (i === 0 ? 0 : lh) + '">' + esc(ln) + '</tspan>'; }).join('');
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" fill="' + (fill || '#eaf1ff') + '" stroke="' + (stroke || '#3b6fd4') + '" stroke-width="1.5"/>' +
      '<text x="' + (x + w / 2) + '" y="' + startY + '" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,\'Microsoft YaHei\',sans-serif" font-size="' + fs + '" fill="#1f2d3d">' + tsp + '</text>';
  }
  function arrow(x1, y1, x2, y2) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#5b8def" stroke-width="1.6" marker-end="url(#ar)"/>';
  }
  function hline(items, opt) {
    opt = opt || {};
    var w = opt.w || 74, h = opt.h || 46, gap = opt.gap || 6, y = opt.y || 150, x0 = opt.x0 || 20, fs = opt.fs || 10;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 360">' + defs();
    var x = x0;
    items.forEach(function (it, i) {
      svg += box(x, y, w, h, it.l, it.f, it.s, fs);
      if (i < items.length - 1) svg += arrow(x + w + 1, y + h / 2, x + w + gap - 1, y + h / 2);
      x += w + gap;
    });
    svg += '</svg>';
    return svg;
  }
  function vline(items, opt) {
    opt = opt || {};
    var w = opt.w || 170, h = opt.h || 44, gap = opt.gap || 28, x = opt.x || 255, y0 = opt.y0 || 36, fs = opt.fs || 12;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 360">' + defs();
    var y = y0;
    items.forEach(function (it, i) {
      svg += box(x, y, w, h, it.l, it.f, it.s, fs);
      if (i < items.length - 1) svg += arrow(x + w / 2, y + h, x + w / 2, y + h + gap);
      y += h + gap;
    });
    svg += '</svg>';
    return svg;
  }

  var D = {};

  D['rd-lifecycle'] = function () {
    return hline([
      { l: '药物发现', f: '#eaf1ff' }, { l: '临床前', f: '#eaf1ff' }, { l: 'I期临床', f: '#e7f7ec' },
      { l: 'II期临床', f: '#e7f7ec' }, { l: 'III期临床', f: '#e7f7ec' }, { l: '上市申请', f: '#fff3d6' },
      { l: '商业化', f: '#eaf1ff' }, { l: '上市后', f: '#fdeaea' }
    ], { w: 74, h: 46, gap: 6, fs: 10, x0: 18, y: 150 });
  };

  D['gmp'] = function () {
    return hline([
      { l: '质量体系(Q10)', f: '#e7f7ec' }, { l: '厂房设施', f: '#eaf1ff' }, { l: '物料/供应商', f: '#eaf1ff' },
      { l: '生产操作', f: '#eaf1ff' }, { l: '质量控制QC', f: '#eaf1ff' }, { l: '放行', f: '#fff3d6' },
      { l: '储存发运', f: '#eaf1ff' }, { l: '自检改进', f: '#eaf1ff' }
    ], { w: 74, h: 46, gap: 6, fs: 10, x0: 18, y: 150 });
  };

  D['change-control'] = function () {
    return hline([
      { l: '变更申请', f: '#eaf1ff' }, { l: '影响评估', f: '#eaf1ff' }, { l: '变更分类', f: '#fff3d6' },
      { l: '批准', f: '#e7f7ec' }, { l: '实施/验证', f: '#eaf1ff' }, { l: '文件更新', f: '#eaf1ff' },
      { l: '关闭评估', f: '#e7f7ec' }
    ], { w: 84, h: 46, gap: 6, fs: 9.5, x0: 16, y: 150 });
  };

  D['capa'] = function () {
    return hline([
      { l: '问题/偏差识别', f: '#fdeaea' }, { l: '根本原因调查', f: '#eaf1ff' }, { l: 'CAPA计划', f: '#fff3d6' },
      { l: '实施', f: '#eaf1ff' }, { l: '有效性确认', f: '#e7f7ec' }
    ], { w: 110, h: 48, gap: 12, fs: 10, x0: 20, y: 150 });
  };

  D['method-validation'] = function () {
    return hline([
      { l: '专属性', f: '#eaf1ff' }, { l: '准确度', f: '#eaf1ff' }, { l: '精密度', f: '#eaf1ff' },
      { l: '线性/范围', f: '#eaf1ff' }, { l: '检测/定量限', f: '#eaf1ff' }, { l: '耐用性', f: '#eaf1ff' },
      { l: '确认完成', f: '#e7f7ec' }
    ], { w: 84, h: 46, gap: 6, fs: 9.5, x0: 16, y: 150 });
  };

  D['stability'] = function () {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 360">' + defs();
    svg += box(40, 40, 190, 250, '稳定性考察项目：\n性状/溶液颜色\npH/溶出度\n含量/降解产物\n微生物限度\n（按 ICH Q1A）', '#f6f9ff', '#3b6fd4', 12);
    svg += box(300, 40, 170, 44, '影响因素试验', '#eaf1ff', '#3b6fd4', 12);
    svg += arrow(385, 84, 385, 112);
    svg += box(300, 116, 170, 44, '加速试验(6个月)', '#eaf1ff', '#3b6fd4', 12);
    svg += arrow(385, 160, 385, 188);
    svg += box(300, 192, 170, 44, '长期试验(12/24/36月)', '#eaf1ff', '#3b6fd4', 12);
    svg += arrow(470, 162, 498, 162);
    svg += box(500, 138, 165, 50, '标签/有效期\n拟定依据', '#fff3d6', '#d99a00', 12);
    svg += '</svg>';
    return svg;
  };

  D['impurity'] = function () {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 360">' + defs();
    svg += box(260, 28, 170, 42, '杂质控制策略', '#e7f7ec', '#2e9e57', 13);
    var kids = [
      { l: '有机杂质(工艺/降解)', f: '#eaf1ff', s: '#3b6fd4', x: 16 },
      { l: '基因毒杂质(M7)', f: '#eaf1ff', s: '#3b6fd4', x: 196 },
      { l: '残留溶剂(Q3C)', f: '#eaf1ff', s: '#3b6fd4', x: 376 },
      { l: '元素杂质(Q3D)', f: '#eaf1ff', s: '#3b6fd4', x: 556 }
    ];
    kids.forEach(function (k) {
      svg += arrow(345, 70, k.x + 75, 110);
      svg += box(k.x, 110, 150, 46, k.l, k.f, k.s, 11);
    });
    svg += box(16, 190, 648, 120, '控制方式：① 源头控制（起始物料/工艺设计） ② 过程控制（中控/在线） ③ 终端控制（质量标准/限度）\n有机杂质按 Q3A/B 报告/鉴定/界定限度；基因毒杂质按 TTC/限度法（0.015%）；残留溶剂 Class 1 禁用、Class 2/3 限值控制；元素杂质按 PDE 控制。', '#f6f9ff', '#3b6fd4', 12);
    svg += '</svg>';
    return svg;
  };

  D['batch-release'] = function () {
    return hline([
      { l: '生产', f: '#eaf1ff' }, { l: '中间控制', f: '#eaf1ff' }, { l: 'QC检验', f: '#eaf1ff' },
      { l: 'OOS/OOT处理', f: '#fdeaea' }, { l: 'QP审核放行', f: '#e7f7ec' }, { l: '批签发(生物)', f: '#fff3d6' }
    ], { w: 96, h: 46, gap: 6, fs: 10, x0: 18, y: 150 });
  };

  D['clinical-flow'] = function () {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 360">' + defs();
    svg += box(20, 140, 145, 56, 'I期(健康受试者)\n安全性/药代', '#e7f7ec', '#2e9e57', 12);
    svg += arrow(165, 168, 189, 168);
    svg += box(193, 140, 145, 56, 'II期(患者)\n初步疗效/剂量', '#eaf1ff', '#3b6fd4', 12);
    svg += arrow(338, 168, 362, 168);
    svg += box(366, 140, 145, 56, 'III期(扩大)\n确证疗效', '#eaf1ff', '#3b6fd4', 12);
    svg += arrow(511, 168, 535, 168);
    svg += box(539, 140, 125, 56, 'NDA/BLA\n申报', '#fff3d6', '#d99a00', 12);
    svg += box(193, 250, 318, 40, '全过程遵循 GCP 与伦理审查', '#f6f9ff', '#3b6fd4', 12);
    svg += '</svg>';
    return svg;
  };

  globalThis.DIAGRAMS = D;
  if (typeof module !== 'undefined') module.exports = D;
})();
