/**
 * 思维导图门户 - 药品注册与质量管理思维导图总览
 */
(function () {
  'use strict';

  /* 加载上传结果 */
  let MINDMAP_DATA = [];
  try {
    MINDMAP_DATA = (globalThis.MINDMAP_RESULTS || []);
  } catch (e) {
    // 静默处理
  }

  /* 按类型分组 */
  function groupMindmaps() {
    const grouped = { chemo: [], bio: [], tcm: [] };
    MINDMAP_DATA.forEach(item => {
      if (!item.imgUrl) return;
      if (item.file.startsWith('mindmap_chemo_')) {
        grouped.chemo.push(item);
      } else if (item.file.startsWith('mindmap_bio_')) {
        grouped.bio.push(item);
      } else if (item.file.startsWith('mindmap_tcm_')) {
        grouped.tcm.push(item);
      }
    });
    return grouped;
  }

  /* 渲染思维导图门户 */
  function renderMindmapPortal() {
    const grouped = groupMindmaps();
    const total = grouped.chemo.length + grouped.bio.length + grouped.tcm.length;

    let html = '<div class="mindmap-portal">';
    html += '<div class="mindmap-portal-header">';
    html += '<h2>🧠 药品注册与质量管理思维导图</h2>';
    html += '<p class="mindmap-portal-desc">基于国家药监局 2020 年《药品注册分类及申报资料要求》，覆盖 ' + total + ' 个药品子类的注册分类、核心术语、全生命周期案例与申报资料要求。</p>';
    html += '</div>';

    html += '<div class="mindmap-portal-summary">';
    html += '<span class="summary-item"><strong>化学药</strong>: ' + grouped.chemo.length + ' 个</span>';
    html += '<span class="summary-item"><strong>生物制品</strong>: ' + grouped.bio.length + ' 个</span>';
    html += '<span class="summary-item"><strong>中药</strong>: ' + grouped.tcm.length + ' 个</span>';
    html += '<span class="summary-item total">共 ' + total + ' 个</span>';
    html += '</div>';

    // 化学药
    html += renderMindmapGroup('化学药', '💊', grouped.chemo, '#f59e0b');
    // 生物制品
    html += renderMindmapGroup('生物制品', '🧬', grouped.bio, '#8b5cf6');
    // 中药
    html += renderMindmapGroup('中药', '🌿', grouped.tcm, '#10b981');

    html += '</div>';
    return html;
  }

  function renderMindmapGroup(title, icon, items, color) {
    if (!items || items.length === 0) return '';

    let html = '<div class="mindmap-group">';
    html += '<div class="mindmap-group-header" style="border-left: 3px solid ' + color + ';">';
    html += '<span class="mindmap-group-icon">' + icon + '</span>';
    html += '<span class="mindmap-group-title">' + title + '</span>';
    html += '<span class="mindmap-group-count">' + items.length + ' 个</span>';
    html += '</div>';
    html += '<div class="mindmap-grid">';

    items.forEach(item => {
      const name = item.title.replace(/[🧬💊🌿]/g, '').trim();
      html += '<div class="mindmap-card">';
      html += '<div class="mindmap-card-img">';
      html += '<img src="' + item.imgUrl + '" alt="' + name + '" loading="lazy" />';
      html += '</div>';
      html += '<div class="mindmap-card-body">';
      html += '<div class="mindmap-card-name">' + name + '</div>';
      html += '<div class="mindmap-card-links">';
      html += '<a href="' + item.visitUrl + '" target="_blank" class="mindmap-link-edit" title="在 ProcessOn 中编辑">📝 编辑</a>';
      html += '<a href="' + item.imgUrl + '" target="_blank" class="mindmap-link-view" title="查看图片">👁️ 查看</a>';
      html += '</div>';
      html += '</div>';
      html += '</div>';
    });

    html += '</div></div>';
    return html;
  }

  /* 挂载到 App */
  Object.assign(globalThis.App, { renderMindmapPortal: renderMindmapPortal });

  /* 拦截 openPortal */
  const _origOpenPortal = globalThis.App.openPortal ? globalThis.App.openPortal.bind(globalThis.App) : function () {};
  globalThis.App.openPortal = function (name) {
    if (name === 'mindmap') {
      if (globalThis.App._exitPortalIfOpen) globalThis.App._exitPortalIfOpen();
      if (globalThis.App._markPortalActive) globalThis.App._markPortalActive('mindmap');
      const content = document.getElementById('content');
      if (content) {
        content.innerHTML = renderMindmapPortal();
        globalThis.App.state.view = 'mindmap';
      }
      return;
    }
    return _origOpenPortal(name);
  };

  /* 添加导航项 */
  if (globalThis.App && globalThis.App.state) {
    const navEl = document.getElementById('sidebarNav');
    if (navEl) {
      const portalSection = navEl.querySelector('.sidebar-portal');
      if (portalSection) {
        const items = portalSection.querySelectorAll('.sidebar-portal-item');
        const existing = Array.from(items).find(i => i.dataset.portal === 'mindmap');
        if (!existing) {
          const newItem = document.createElement('div');
          newItem.className = 'sidebar-portal-item';
          newItem.dataset.portal = 'mindmap';
          newItem.innerHTML = '🧠 思维导图';
          portalSection.appendChild(newItem);
        }
      }
    }
  }

})();
