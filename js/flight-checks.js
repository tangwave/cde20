/* =====================================================================
 * 飞行检查板块 (flight-checks.js)
 * 展示国家局 + 重点省份「药品生产飞行检查 / 监督检查通报」，
 * 支持按 省份 / 年份 / 药品类型 / 缺陷类型 筛选，并可下钻到药品分类。
 * 数据：data/flight_checks.json（由 scripts/crawl_flight_checks.py 生成）
 * ===================================================================== */
(function () {
  const TYPE_MAP = { '化学药': 'chemo', '生物制品': 'bio', '中药': 'tcm' };
  const TYPE_LABEL = { chemo: '化学药', bio: '生物制品', tcm: '中药' };
  let DATA = null;          // { meta, items:[...] }
  let LOADING = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  async function ensureData() {
    if (DATA) return DATA;
    if (LOADING) return null;
    LOADING = true;
    try {
      const r = await fetch('data/flight_checks.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      DATA = await r.json();
    } catch (e) {
      DATA = { meta: { note: '数据加载失败：' + e.message }, items: [] };
    } finally {
      LOADING = false;
    }
    return DATA;
  }

  function uniq(arr) {
    return Array.from(new Set(arr.filter(Boolean)));
  }

  function stats(items) {
    const prov = {}, yr = {}, dt = {}, df = {};
    items.forEach(it => {
      prov[it.province || '未标注'] = (prov[it.province || '未标注'] || 0) + 1;
      if (it.year) yr[it.year] = (yr[it.year] || 0) + 1;
      (it.drug_types || []).forEach(d => dt[d] = (dt[d] || 0) + 1);
      (it.defect_categories || []).forEach(d => df[d] = (df[d] || 0) + 1);
    });
    return { prov, yr, dt, df };
  }

  function filterItems(items, f) {
    return items.filter(it => {
      if (f.prov && f.prov !== '全部' && (it.province || '未标注') !== f.prov) return false;
      if (f.year && f.year !== '全部' && String(it.year) !== f.year) return false;
      if (f.type && f.type !== '全部' && !(it.drug_types || []).includes(TYPE_LABEL[f.type])) return false;
      if (f.defect && f.defect !== '全部' && !(it.defect_categories || []).includes(f.defect)) return false;
      if (f.q) {
        const q = f.q.toLowerCase();
        const hay = (it.title + ' ' + (it.companies || []).join(' ') + ' ' + (it.summary || '') + ' ' + (it.check_scope || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function chipClassForType(t) {
    const id = TYPE_MAP[t];
    return id ? 'fc-type-' + id : 'fc-type-other';
  }

  function renderList(items, f) {
    if (!items.length) return '<div class="fc-empty">没有符合条件的飞行检查通报。</div>';
    return '<div class="fc-list">' + items.map(it => {
      const types = (it.drug_types || []).map(t =>
        `<span class="fc-chip ${chipClassForType(t)}" data-fc-type="${esc(t)}">${esc(t)}</span>`).join('');
      const defects = (it.defect_categories || []).map(d =>
        `<span class="fc-chip fc-defect">${esc(d)}</span>`).join('');
      const comps = (it.companies || []).slice(0, 4).map(c => esc(c)).join('、');
      const compMore = (it.companies || []).length > 4 ? ' 等' + it.companies.length + '家' : '';
      return `<div class="fc-card" data-fc-id="${esc(it.id)}">
        <div class="fc-card-head">
          <div class="fc-card-title">${esc(it.title)}</div>
          <div class="fc-card-meta">${esc(it.date || '')} ｜ ${esc(it.agency || '')} ｜ ${esc(it.province || '')}</div>
        </div>
        <div class="fc-card-types">${types}${defects}</div>
        <div class="fc-card-companies">🏭 ${comps}${compMore}</div>
        <div class="fc-card-sum">${esc((it.summary || '').slice(0, 120))}${(it.summary || '').length > 120 ? '…' : ''}</div>
        ${it.measures ? `<div class="fc-card-meas" style="margin-top:7px;font-size:12px;color:#0e7a4e;background:#eef7f1;border-left:3px solid #0e9f6e;padding:4px 8px;border-radius:6px"><b>处理措施：</b>${esc(it.measures)}</div>` : ''}
      </div>`;
    }).join('') + '</div>';
  }

  function renderDetail(it) {
    const types = (it.drug_types || []).map(t => {
      const id = TYPE_MAP[t];
      const attr = id ? `data-class-cat="${id}" data-class-code=""` : '';
      return `<a class="fc-chip ${chipClassForType(t)}" ${attr} style="cursor:pointer">${esc(t)} ↗</a>`;
    }).join('');
    const defects = (it.defect_categories || []).map(d => `<span class="fc-chip fc-defect">${esc(d)}</span>`).join('');
    const comps = (it.companies || []).map(c => `<li>${esc(c)}</li>`).join('');
    return `<div class="fc-detail">
      <button class="fc-back" data-fc-back>← 返回列表</button>
      <h2 class="fc-detail-title">${esc(it.title)}</h2>
      <div class="fc-detail-meta">📅 ${esc(it.date || '')} ｜ 🏛️ ${esc(it.agency || '')} ｜ 📍 ${esc(it.province || '')} ｜ 🔖 ${esc(it.doc_no || '—')}</div>
      <div class="fc-detail-chips">${types}${defects}</div>
      <section class="fc-sec"><h3>涉及企业</h3><ul class="fc-comp-list">${comps || '<li>—</li>'}</ul></section>
      <section class="fc-sec"><h3>检查范围</h3><p>${esc(it.check_scope || '未标注')}</p></section>
      <section class="fc-sec"><h3>缺陷级别</h3><p>${esc(it.defect_level || '未标注')}</p></section>
      <section class="fc-sec"><h3>处理措施</h3><p>${esc(it.measures || '详见通报')}</p></section>
      <section class="fc-sec"><h3>处置状态</h3><p>${esc(it.status || '—')}</p></section>
      <section class="fc-sec"><h3>通报摘要</h3><p class="fc-summary">${esc(it.summary || '')}</p></section>
      ${it.url ? `<section class="fc-sec"><h3>来源</h3><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.url)}</a></section>` : ''}
    </div>`;
  }

  async function renderFlightChecks(initialFilter) {
    const c = document.getElementById('content');
    if (!c) return;
    App._exitPortalIfOpen && App._exitPortalIfOpen();
    App._markPortalActive && App._markPortalActive('flightchecks');
    const data = await ensureData();
    const items = (data.items || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const s = stats(items);
    const f = Object.assign({ prov: '全部', year: '全部', type: '全部', defect: '全部', q: '' }, initialFilter || {});

    const provBtns = ['全部'].concat(Object.keys(s.prov)).map(p =>
      `<button class="fc-fbtn ${f.prov === p ? 'on' : ''}" data-fc-prov="${esc(p)}">${esc(p)}<i>${s.prov[p]}</i></button>`).join('');
    const yearBtns = ['全部'].concat(Object.keys(s.yr).sort().reverse()).map(y =>
      `<button class="fc-fbtn ${f.year === y ? 'on' : ''}" data-fc-year="${esc(y)}">${esc(y)}<i>${s.yr[y]}</i></button>`).join('');
    const typeBtns = ['全部', 'chemo', 'bio', 'tcm'].map(t =>
      `<button class="fc-fbtn ${f.type === t ? 'on' : ''}" data-fc-type-f="${esc(t)}">${t === '全部' ? '全部' : esc(TYPE_LABEL[t])}</button>`).join('');
    const defectKeys = Object.keys(s.df).sort((a, b) => s.df[b] - s.df[a]);
    const defectBtns = ['全部'].concat(defectKeys).map(d =>
      `<button class="fc-fbtn ${f.defect === d ? 'on' : ''}" data-fc-defect="${esc(d)}">${esc(d)}<i>${s.df[d] || ''}</i></button>`).join('');

    const filtered = filterItems(items, f);

    c.innerHTML = `<div class="fc-board">
      <div class="fc-header">
        <div class="fc-header-title">✈️ 药品飞行检查通报</div>
        <div class="fc-header-sub">国家局 + 重点省份药品生产飞行检查 / 监督检查通报（仅药品）｜ 共 ${items.length} 条 ｜ 数据范围：${esc((data.meta && data.meta.note) || '公开可查')}</div>
      </div>
      <div class="fc-toolbar">
        <input class="fc-search" id="fcSearch" placeholder="搜索企业 / 品种 / 关键词…" value="${esc(f.q)}" />
      </div>
      <div class="fc-filters">
        <div class="fc-frow"><span class="fc-flabel">省份</span><div class="fc-fbtns">${provBtns}</div></div>
        <div class="fc-frow"><span class="fc-flabel">年份</span><div class="fc-fbtns">${yearBtns}</div></div>
        <div class="fc-frow"><span class="fc-flabel">药品类型</span><div class="fc-fbtns">${typeBtns}</div></div>
        <div class="fc-frow"><span class="fc-flabel">缺陷类型</span><div class="fc-fbtns">${defectBtns}</div></div>
      </div>
      <div class="fc-count">匹配 ${filtered.length} 条</div>
      <div id="fcListWrap">${renderList(filtered, f)}</div>
    </div>`;

    // 事件绑定
    c.querySelector('#fcSearch').addEventListener('input', e => {
      f.q = e.target.value.trim();
      c.querySelector('#fcListWrap').innerHTML = renderList(filterItems(items, f), f);
    });
    c.querySelectorAll('[data-fc-prov]').forEach(b => b.addEventListener('click', () => {
      f.prov = b.dataset.fcProv; renderFlightChecks(f);
    }));
    c.querySelectorAll('[data-fc-year]').forEach(b => b.addEventListener('click', () => {
      f.year = b.dataset.fcYear; renderFlightChecks(f);
    }));
    c.querySelectorAll('[data-fc-type-f]').forEach(b => b.addEventListener('click', () => {
      f.type = b.dataset.fcTypeF; renderFlightChecks(f);
    }));
    c.querySelectorAll('[data-fc-defect]').forEach(b => b.addEventListener('click', () => {
      f.defect = b.dataset.fcDefect; renderFlightChecks(f);
    }));
    c.querySelectorAll('.fc-card').forEach(card => card.addEventListener('click', () => {
      const it = items.find(x => x.id === card.dataset.fcId);
      if (it) c.querySelector('#fcListWrap').innerHTML = renderDetail(it);
    }));
    c.querySelectorAll('[data-fc-back]').forEach(b => b.addEventListener('click', () => {
      c.querySelector('#fcListWrap').innerHTML = renderList(filtered, f);
    }));
    // 药品类型下钻
    c.querySelectorAll('[data-class-cat]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      if (App.openClassification) App.openClassification(a.dataset.classCat, '');
    }));
    if (c.parentElement) c.parentElement.scrollTop = 0;
  }

  // 挂载 + 拦截 openPortal
  Object.assign(globalThis.App, { renderFlightChecks: renderFlightChecks });
  const _orig = globalThis.App.openPortal ? globalThis.App.openPortal.bind(globalThis.App) : function () {};
  globalThis.App.openPortal = function (name) {
    if (name === 'flightchecks') { renderFlightChecks(); return; }
    return _orig(name);
  };
})();
