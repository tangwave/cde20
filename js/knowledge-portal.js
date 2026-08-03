/**
 * 知识门户（识林式主题词框架 / 全景总览 / 案例库 / 术语表）
 * 挂载渲染方法到 App，并提供全局委托点击导航。
 *
 * 依赖（脚本加载顺序）：data.js → ... → knowledge-framework.js → cases-library.js
 *          → app.js → knowledge-portal.js （本文件必须位于 app.js 之后，
 *          以便 App 已定义；且须在 DOMContentLoaded 之前，以便注入术语到穿透引擎）。
 */
(function () {
  'use strict';

  /* ---------- 1) 将主题词注入穿透引擎术语库（识林式悬浮卡） ---------- */
  function stripParen(s) {
    return String(s || '').replace(/[（(][^()（）]*[)）]/g, '').replace(/\s+/g, ' ').trim();
  }
  function regTitle(id) {
    const r = (globalThis.REG_INDEX || []).find(x => x.id === id);
    return r ? r.title : '';
  }
  function injectGlossaryTerms() {
    const KF = globalThis.KNOWLEDGE_FRAMEWORK;
    if (!KF || !KF.groups) return;
    const base = (globalThis.PEN_TERMS || []).map(t => t.t)
      .concat((globalThis.PEN_TERMS || []).flatMap(t => t.a || []));
    const seen = new Set(base.map(x => stripParen(x)));
    const add = [];
    KF.groups.forEach(g => (g.topics || []).forEach(tp => {
      const term = stripParen(tp.term);
      if (term && !seen.has(term)) {
        seen.add(term);
        add.push({
          t: term,
          c: tp.cat || '主题词',
          d: (tp.def || '') + (tp.summary ? ' ' + tp.summary : ''),
          r: (tp.relatedRegs && tp.relatedRegs[0]) ? regTitle(tp.relatedRegs[0]) : ''
        });
      }
    }));
    globalThis.PEN_TERMS = (globalThis.PEN_TERMS || []).concat(add);
  }
  injectGlossaryTerms();

  /* ---------- 主题词 / 案例 → 流程图 映射 ---------- */
  const TOPIC_DIAGRAM = {
    pv: 'gmp', sterile: 'gmp', api: 'gmp', coc: 'gmp', change: 'change-control',
    devi: 'change-control', capa: 'capa', methodval: 'method-validation',
    stability: 'stability', impurity: 'impurity', spec: 'method-validation',
    sp_bio: 'batch-release', sp_vaccine: 'batch-release', sp_radio: 'batch-release',
    sp_cellgene: 'batch-release', sp_sterile: 'batch-release', qms: 'gmp', rm: 'capa',
    glp: 'clinical-flow', gcp: 'clinical-flow', ind: 'clinical-flow', nda: 'clinical-flow'
  };
  const CASE_DIAGRAM = {
    case_pv: 'gmp', case_sterile_pv: 'gmp', case_coc: 'gmp', case_change: 'change-control',
    case_deviation: 'change-control', case_capa: 'capa', case_di: 'capa',
    case_methodval: 'method-validation', case_stability: 'stability', case_impurity: 'impurity',
    case_comparability: 'batch-release', case_vaccine: 'batch-release', case_radio: 'batch-release',
    case_cell: 'batch-release', case_adc: 'batch-release', case_qms: 'gmp', case_q10: 'gmp'
  };

  /* ---------- 2) 渲染方法挂载到 App ---------- */
  Object.assign(App, {

    /* 离开门户视图时清理状态（在 selectVariety / openClassReq 中调用） */
    _exitPortalIfOpen() {
      if (['panorama', 'framework', 'caselibrary', 'glossary', 'ic'].includes(this.state.view)) {
        this.state.view = 'kb';
      }
      this.state.currentTopicId = null;
      this.state.currentCaseId = null;
      this.state.caseDomain = null;
      this.state.currentIC = null;
      document.querySelectorAll('[data-portal]').forEach(b => b.classList.remove('active'));
    },

    /* 流程图渲染（调用全局 DIAGRAMS 注册表） */
    renderDiagram(key) {
      const D = globalThis.DIAGRAMS;
      if (!D || !key || !D[key]) return '';
      try {
        return '<div class="diagram-wrap"><div class="diagram-cap">📊 流程示意图</div>' + D[key]() + '</div>';
      } catch (e) { return ''; }
    },

    _markPortalActive(name) {
      document.querySelectorAll('[data-portal]').forEach(b => {
        b.classList.toggle('active', b.dataset.portal === name);
      });
    },

    _findTopic(id) {
      const KF = globalThis.KNOWLEDGE_FRAMEWORK;
      if (!KF) return null;
      for (const g of KF.groups) {
        const t = (g.topics || []).find(x => x.id === id);
        if (t) return t;
      }
      return null;
    },

    _findCase(id) {
      const CL = globalThis.CASE_LIBRARY;
      if (!CL) return null;
      return (CL.cases || []).find(c => c.id === id) || null;
    },

    _portalChip(kind, id, label) {
      if (kind === 'class') {
        const [cat, code] = String(id).split(':');
        return '<a class="portal-link portal-link-class" data-class-cat="' + this._esc(cat) +
          '" data-class-code="' + this._esc(code || '') + '">' + this._esc(label) + '</a>';
      }
      const map = { topic: 'data-topic', case: 'data-case', variety: 'data-variety-id', reg: 'data-reg' };
      const attr = map[kind];
      if (!attr) return this._esc(label);
      return '<a class="portal-link portal-link-' + kind + '" ' + attr + '="' + this._esc(id) + '">' + this._esc(label) + '</a>';
    },

    _portalCrossLinks(t) {
      const parts = [];
      (t.relatedTopics || []).forEach(id => {
        const x = this._findTopic(id);
        if (x) parts.push(this._portalChip('topic', id, x.term));
      });
      (t.relatedVarieties || []).forEach(id => {
        const v = this.findVarietyById(id);
        if (v) parts.push(this._portalChip('variety', id, v.icon + ' ' + v.name));
      });
      (t.relatedRegs || []).forEach(id => {
        const r = this.findRegById(id);
        if (r) parts.push(this._portalChip('reg', id, '《' + r.title + '》'));
      });
      (t.relatedCases || []).forEach(id => {
        const c = this._findCase(id);
        if (c) parts.push(this._portalChip('case', id, c.title));
      });
      if (!parts.length) return '';
      return '<div class="portal-xref"><div class="portal-xref-title">🔗 关联导航</div>' +
        '<div class="portal-xref-list">' + parts.join('') + '</div></div>';
    },

    /* ============ 全景总览 ============ */
    renderPanorama() {
      this._exitPortalIfOpen();
      this.state.view = 'panorama';
      const b = document.getElementById('breadcrumb');
      if (b) b.innerHTML = '<span class="breadcrumb-item">首页</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-item">全景总览</span>';
      const st = document.getElementById('stageTabs'); if (st) st.style.display = 'none';
      const dl = document.getElementById('detailLayout'); if (dl) dl.style.display = '';
      const c = document.getElementById('content');
      if (!c) return;

      const CR = globalThis.CLASS_REQUIREMENTS || {};
      const MAIN_ORDER = ['chemo', 'bio', 'tcm'];
      const MAIN_ICON = { chemo: '💊', bio: '🧬', tcm: '🌿' };
      const MAIN_NAME = { chemo: '化学药', bio: '生物制品', tcm: '中药' };
      const OV = {
        chemo: {
          rnd: '以小分子合成与制剂为核心，强调工艺路线、杂质谱与质量源于设计（QbD）。',
          prod: '无菌 / 口服 / 原料药生产须符合 GMP，重点关注共线风险与清洁验证。',
          advice: '尽早组建 CMC 团队，锁定关键质量属性（CQA）与关键工艺参数（CPP）。',
          diff: '基因毒杂质（M7）、残留溶剂（Q3C）、元素杂质（Q3D）控制是重难点。'
        },
        bio: {
          rnd: '以细胞培养 / 发酵与纯化为核心，结构复杂、批间差异大，可比性研究关键。',
          prod: '无菌生物制品生产，病毒安全（Q5A）、批签发为重点。',
          advice: '建立从细胞库到原液 / 制剂的一体化质量体系，重视工艺表征与中控策略。',
          diff: '病毒安全性、糖基化等翻译后修饰、ADC 偶联均一是重难点。'
        },
        tcm: {
          rnd: '以药材基原、炮制与物质基础辨析为核心，质量均一性挑战大。',
          prod: '中药制剂生产关注提取转移率、浸膏得率与批间稳定。',
          advice: '推动中药材规范化基地（GAP 理念）与饮片标准化，建立特征 / 指纹图谱。',
          diff: '药材资源可持续、农残 / 重金属、复方量效关系是重难点。'
        }
      };

      let html = '<div class="panorama">';
      html += '<div class="panorama-hero">' +
        '<h1 class="panorama-title">🗺️ 药品研发与生产质量体系 · 全景总览</h1>' +
        '<p class="panorama-sub">从「化学药 / 生物制品 / 中药」三大类出发，建立对研发、生产管理要求与实施建议的整体认识；点击卡片进入对应分类的研发要求体系，或通过「知识框架 / 案例库」深度学习。</p>' +
        '<div class="panorama-quick">' +
        '<button class="portal-quick-btn" data-portal="framework">📚 知识框架（主题词）</button>' +
        '<button class="portal-quick-btn" data-portal="caselibrary">🧭 案例库（如何开展）</button>' +
        '<button class="portal-quick-btn" data-portal="glossary">🔤 术语表</button>' +
        '</div></div>';

      html += '<div class="panorama-cards">';
      MAIN_ORDER.forEach(mc => {
        const m = (CR.mains && CR.mains[mc]) || null;
        const nm = m ? m.name : MAIN_NAME[mc];
        const ov = OV[mc];
        html += '<div class="panorama-card">' +
          '<div class="panorama-card-head">' + MAIN_ICON[mc] + ' ' + this.pen(nm) + '</div>' +
          '<div class="panorama-row"><span class="panorama-row-k">研发要求</span><span class="panorama-row-v">' + this.pen(ov.rnd) + '</span></div>' +
          '<div class="panorama-row"><span class="panorama-row-k">生产管理</span><span class="panorama-row-v">' + this.pen(ov.prod) + '</span></div>' +
          '<div class="panorama-row"><span class="panorama-row-k">实施建议</span><span class="panorama-row-v">' + this.pen(ov.advice) + '</span></div>' +
          '<div class="panorama-row panorama-row-diff"><span class="panorama-row-k">重难点</span><span class="panorama-row-v">' + this.pen(ov.diff) + '</span></div>' +
          '<button class="panorama-enter" data-class-cat="' + mc + '" data-class-code="">进入 ' + this._esc(nm) + ' 研发要求体系 →</button>' +
          '<button class="panorama-ic" data-ic="' + mc + '">📖 ' + this._esc(nm) + ' 整体研发案例</button>' +
          '</div>';
      });
      html += '</div>';

      const KF = globalThis.KNOWLEDGE_FRAMEWORK;
      if (KF) {
        const hot = ['gmp', 'rm', 'pv', 'change', 'impurity', 'mah', 'sp_bio', 'sp_radio'];
        html += '<div class="panorama-themes"><div class="panorama-themes-title">🔥 热门主题词</div><div class="panorama-themes-list">';
        hot.forEach(id => {
          const t = this._findTopic(id);
          if (t) html += '<a class="panorama-theme-chip" data-topic="' + this._esc(id) + '">' + this._esc(t.term) + '</a>';
        });
        html += '</div><div class="panorama-themes-more"><a class="portal-link portal-link-topic" data-portal="framework">查看全部主题词知识框架 →</a></div></div>';
      }
      html += '</div>';

      c.innerHTML = html;
      this._markPortalActive('panorama');
    },

    /* ============ 知识框架（主题词） ============ */
    renderFrameworkView(topicId) {
      this._exitPortalIfOpen();
      this.state.view = 'framework';
      this.state.currentTopicId = topicId || null;
      const b = document.getElementById('breadcrumb');
      if (b) {
        const t = topicId ? this._findTopic(topicId) : null;
        b.innerHTML = '<span class="breadcrumb-item">首页</span><span class="breadcrumb-sep">/</span>' +
          '<a class="breadcrumb-item" data-portal="framework">知识框架</a>' +
          (t ? '<span class="breadcrumb-sep">/</span><span class="breadcrumb-item">' + this._esc(t.term) + '</span>' : '');
      }
      const st = document.getElementById('stageTabs'); if (st) st.style.display = 'none';
      const dl = document.getElementById('detailLayout'); if (dl) dl.style.display = '';
      const c = document.getElementById('content');
      if (!c) return;

      const KF = globalThis.KNOWLEDGE_FRAMEWORK;
      if (!KF) { c.innerHTML = '<div class="bookmark-empty">知识框架数据未加载</div>'; return; }

      let html = '<div class="kf">';
      if (!topicId) {
        html += '<div class="kf-head"><h1>📚 主题词知识框架</h1>' +
          '<p class="kf-sub">以识林式主题词组织核心概念，覆盖基础通用、研发注册、生产制造、质量管理、质量研究、特殊品类六大板块；点击主题词查看释义、要点、重难点与关联导航。</p></div>';
        KF.groups.forEach(g => {
          html += '<div class="kf-group"><div class="kf-group-head">' + (g.icon || '📌') + ' ' + this.pen(g.name) +
            (g.desc ? ' <span class="kf-group-desc">' + this._esc(g.desc) + '</span>' : '') + '</div><div class="kf-topics">';
          (g.topics || []).forEach(t => {
            html += '<a class="kf-topic-chip" data-topic="' + this._esc(t.id) + '">' + this._esc(t.term) + '</a>';
          });
          html += '</div></div>';
        });
      } else {
        const t = this._findTopic(topicId);
        if (!t) { c.innerHTML = '<div class="bookmark-empty">未找到该主题词</div>'; return; }
        html += '<div class="kf-detail">';
        html += '<div class="kf-detail-head"><span class="kf-detail-cat">' + this._esc(t.cat || '') + '</span>' +
          '<h1 class="kf-detail-term">' + this.pen(t.term) + '</h1></div>';
        html += '<div class="kf-detail-def">' + this.pen(t.def || '') + '</div>';
        if (t.summary) html += '<div class="kf-detail-summary">' + this.pen(t.summary) + '</div>';
        if (t.keyPoints && t.keyPoints.length) {
          html += '<div class="kf-section"><div class="kf-section-title">✅ 核心要点</div><ul class="kf-points">' +
            t.keyPoints.map(p => '<li>' + this.pen(p) + '</li>').join('') + '</ul></div>';
        }
        if (t.difficulties && t.difficulties.length) {
          html += '<div class="kf-section"><div class="kf-section-title kf-section-diff">⚠ 重难点</div><ul class="kf-points kf-points-diff">' +
            t.difficulties.map(p => '<li>' + this.pen(p) + '</li>').join('') + '</ul></div>';
        }
        html += this._portalCrossLinks(t);
        const tdk = TOPIC_DIAGRAM[t.id];
        if (tdk) html += this.renderDiagram(tdk);
        html += '<div class="kf-back"><a class="portal-link portal-link-topic" data-portal="framework">← 返回知识框架</a>' +
          ' · <a class="portal-link portal-link-topic" data-portal="panorama">返回全景总览</a></div>';
        html += '</div>';
      }
      html += '</div>';
      c.innerHTML = html;
      this._markPortalActive('framework');
    },

    /* ============ 案例库（如何开展...） ============ */
    renderCaseLibrary(domain, caseId) {
      this._exitPortalIfOpen();
      this.state.view = 'caselibrary';
      this.state.caseDomain = domain || null;
      this.state.currentCaseId = caseId || null;
      const b = document.getElementById('breadcrumb');
      if (b) {
        const cc = caseId ? this._findCase(caseId) : null;
        b.innerHTML = '<span class="breadcrumb-item">首页</span><span class="breadcrumb-sep">/</span>' +
          '<a class="breadcrumb-item" data-portal="caselibrary">案例库</a>' +
          (cc ? '<span class="breadcrumb-sep">/</span><span class="breadcrumb-item">' + this._esc(cc.title) + '</span>' : '');
      }
      const st = document.getElementById('stageTabs'); if (st) st.style.display = 'none';
      const dl = document.getElementById('detailLayout'); if (dl) dl.style.display = '';
      const c = document.getElementById('content');
      if (!c) return;

      const CL = globalThis.CASE_LIBRARY;
      if (!CL) { c.innerHTML = '<div class="bookmark-empty">案例库数据未加载</div>'; return; }

      let html = '<div class="cl">';
      // 领域筛选
      html += '<div class="cl-domains">';
      html += '<button class="cl-domain-btn ' + (!domain ? 'active' : '') + '" data-cl-domain="">全部</button>';
      (CL.domains || []).forEach(d => {
        html += '<button class="cl-domain-btn ' + (domain === d ? 'active' : '') + '" data-cl-domain="' + this._esc(d) + '">' + this._esc(d) + '</button>';
      });
      html += '</div>';

      if (!caseId) {
        html += '<div class="cl-head"><h1>🧭 案例库 · 如何开展相关工作</h1>' +
          '<p class="cl-sub">按领域筛选，点击案例查看场景、目标、分步实施方法、关键要点与常见误区。</p></div>';
        const list = (CL.cases || []).filter(x => !domain || x.domain === domain);
        html += '<div class="cl-list">';
        list.forEach(x => {
          html += '<a class="cl-card" data-case="' + this._esc(x.id) + '">' +
            '<span class="cl-card-domain">' + this._esc(x.domain || '') + '</span>' +
            '<span class="cl-card-title">' + this._esc(x.title) + '</span>' +
            '<span class="cl-card-scenario">' + this._esc((x.scenario || '').slice(0, 60)) + (x.scenario && x.scenario.length > 60 ? '…' : '') + '</span>' +
            '</a>';
        });
        html += '</div>';
      } else {
        const x = this._findCase(caseId);
        if (!x) { c.innerHTML = '<div class="bookmark-empty">未找到该案例</div>'; return; }
        html += '<div class="cl-detail">';
        html += '<div class="cl-detail-head"><span class="cl-detail-domain">' + this._esc(x.domain || '') + '</span>' +
          '<h1 class="cl-detail-title">' + this._esc(x.title) + '</h1></div>';
        if (x.scenario) html += '<div class="cl-field"><div class="cl-field-k">🎯 应用场景</div><div class="cl-field-v">' + this.pen(x.scenario) + '</div></div>';
        if (x.objective) html += '<div class="cl-field"><div class="cl-field-k">🏁 目标</div><div class="cl-field-v">' + this.pen(x.objective) + '</div></div>';
        if (Array.isArray(x.steps) && x.steps.length) {
          html += '<div class="cl-field"><div class="cl-field-k">🪜 实施步骤</div><div class="cl-steps">';
          x.steps.forEach((s, i) => {
            html += '<div class="cl-step"><div class="cl-step-no">' + (i + 1) + '</div>' +
              '<div class="cl-step-body"><div class="cl-step-title">' + this._esc(s.title || '') + '</div>' +
              '<div class="cl-step-detail">' + this.pen(s.detail || '') + '</div>';
            if (Array.isArray(s.regs) && s.regs.length) {
              html += '<div class="cl-step-regs">' + s.regs.map(r => {
                const rr = this.findRegById(r);
                return this._portalChip('reg', r, '《' + (rr ? rr.title : r) + '》');
              }).join('') + '</div>';
            }
            html += '</div></div>';
          });
          html += '</div></div>';
        }
        if (x.keyPoints && x.keyPoints.length) {
          html += '<div class="cl-field"><div class="cl-field-k">✅ 关键要点</div><ul class="cl-points">' +
            x.keyPoints.map(p => '<li>' + this.pen(p) + '</li>').join('') + '</ul></div>';
        }
        if (x.pitfalls && x.pitfalls.length) {
          html += '<div class="cl-field"><div class="cl-field-k cl-field-diff">⚠ 常见误区 / 风险</div><ul class="cl-points cl-points-diff">' +
            x.pitfalls.map(p => '<li>' + this.pen(p) + '</li>').join('') + '</ul></div>';
        }
        // 关联
        const xref = this._portalCrossLinks({
          relatedTopics: x.relatedTopics, relatedVarieties: x.relatedVarieties,
          relatedRegs: x.relatedRegs, relatedCases: x.relatedCases
        });
        if (xref) html += xref;
        const cdk = CASE_DIAGRAM[x.id];
        if (cdk) html += this.renderDiagram(cdk);
        html += '<div class="kf-back"><a class="portal-link portal-link-case" data-portal="caselibrary">← 返回案例库</a>' +
          ' · <a class="portal-link portal-link-case" data-portal="panorama">返回全景总览</a></div>';
        html += '</div>';
      }
      html += '</div>';
      c.innerHTML = html;
      this._markPortalActive('caselibrary');
      // 领域筛选按钮
      c.querySelectorAll('.cl-domain-btn').forEach(btn => {
        btn.addEventListener('click', () => this.renderCaseLibrary(btn.dataset.clDomain || null, null));
      });
    },

    /* ============ 术语表 ============ */
    renderGlossary() {
      this._exitPortalIfOpen();
      this.state.view = 'glossary';
      const b = document.getElementById('breadcrumb');
      if (b) b.innerHTML = '<span class="breadcrumb-item">首页</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-item">术语表</span>';
      const st = document.getElementById('stageTabs'); if (st) st.style.display = 'none';
      const dl = document.getElementById('detailLayout'); if (dl) dl.style.display = '';
      const c = document.getElementById('content');
      if (!c) return;
      const KF = globalThis.KNOWLEDGE_FRAMEWORK;
      if (!KF) { c.innerHTML = '<div class="bookmark-empty">知识框架数据未加载</div>'; return; }

      let html = '<div class="glossary"><div class="glossary-head"><h1>🔤 术语表（主题词索引）</h1>' +
        '<p class="glossary-sub">汇总知识框架全部主题词与释义；在应用正文 / 卡片中，主题词首次出现时会以悬浮卡形式提示释义与来源法规。点击词条可查看完整知识框架条目。</p></div>';
      KF.groups.forEach(g => {
        html += '<div class="glossary-group"><div class="glossary-group-title">' + (g.icon || '📌') + ' ' + this._esc(g.name) + '</div>';
        (g.topics || []).forEach(t => {
          html += '<div class="glossary-item"><a class="glossary-term" data-topic="' + this._esc(t.id) + '">' + this._esc(t.term) + '</a>' +
            '<div class="glossary-def">' + this._esc(t.def || '') + '</div></div>';
        });
        html += '</div>';
      });
      html += '</div>';
      c.innerHTML = html;
      this._markPortalActive('glossary');
    },

    /* ============ 整体研发案例（每大类一个端到端案例） ============ */
    renderIntegratedCase(cat) {
      this._exitPortalIfOpen();
      this.state.view = 'ic';
      this.state.currentIC = cat;
      const IC = globalThis.INTEGRATED_CASES;
      const data = IC && IC[cat];
      const MAIN_ICON = { chemo: '💊', bio: '🧬', tcm: '🌿' };
      const MAIN_NAME = { chemo: '化学药', bio: '生物制品', tcm: '中药' };
      const STAGE_NAMES = {
        discovery: '药物发现与立项', preclinical: '临床前研究', clinical: '临床试验',
        nda: '上市申请（NDA/BLA）', commercial: '商业化生产与工艺验证', postmarket: '上市后监测与变更'
      };
      const b = document.getElementById('breadcrumb');
      if (b) b.innerHTML = '<span class="breadcrumb-item">首页</span><span class="breadcrumb-sep">/</span>' +
        '<a class="breadcrumb-item" data-portal="panorama">全景总览</a><span class="breadcrumb-sep">/</span>' +
        '<span class="breadcrumb-item">' + this._esc(MAIN_NAME[cat] || cat) + ' 整体研发案例</span>';
      const st = document.getElementById('stageTabs'); if (st) st.style.display = 'none';
      const dl = document.getElementById('detailLayout'); if (dl) dl.style.display = '';
      const c = document.getElementById('content');
      if (!c) return;
      if (!data) { c.innerHTML = '<div class="bookmark-empty">未找到该整体研发案例</div>'; return; }

      let html = '<div class="ic">';
      html += '<div class="ic-head"><span class="ic-icon">' + (MAIN_ICON[cat] || '📦') + '</span>' +
        '<h1 class="ic-title">' + this.pen(data.title) + '</h1></div>';
      if (data.overview) html += '<div class="ic-overview">' + this.pen(data.overview) + '</div>';
      html += this.renderDiagram('rd-lifecycle');
      html += '<div class="ic-timeline-title">🧭 全生命周期关键把控（工艺 / 质量研究 / 质量管理）</div>';
      html += '<div class="ic-timeline">';
      (data.timeline || []).forEach(t => {
        html += '<div class="ic-stage"><div class="ic-stage-name">' + this.pen(STAGE_NAMES[t.stage] || t.stage) + '</div>';
        if (t.focus) html += '<div class="ic-stage-focus">' + this.pen(t.focus) + '</div>';
        if (t.points && t.points.length) html += '<ul class="ic-stage-pts">' + t.points.map(p => '<li>' + this.pen(p) + '</li>').join('') + '</ul>';
        html += '</div>';
      });
      html += '</div>';
      if (data.keyControlPoints && data.keyControlPoints.length) {
        html += '<div class="ic-section"><div class="ic-section-title ic-kp">🎯 关键把控点</div><ul class="ic-points">' +
          data.keyControlPoints.map(p => '<li>' + this.pen(p) + '</li>').join('') + '</ul></div>';
      }
      if (data.lessons && data.lessons.length) {
        html += '<div class="ic-section"><div class="ic-section-title ic-lesson">📘 经验与踩坑</div><ul class="ic-points ic-points-lesson">' +
          data.lessons.map(p => '<li>' + this.pen(p) + '</li>').join('') + '</ul></div>';
      }
      html += this._portalCrossLinks({
        relatedTopics: data.relatedTopics, relatedVarieties: data.relatedVarieties,
        relatedRegs: data.relatedRegs, relatedCases: data.relatedCases
      });
      html += '<div class="kf-back"><a class="portal-link portal-link-case" data-portal="panorama">← 返回全景总览</a>' +
        ' · <a class="portal-link portal-link-case" data-class-cat="' + this._esc(cat) + '" data-class-code="">查看' +
        this._esc(MAIN_NAME[cat] || cat) + ' 研发要求体系 →</a></div>';
      html += '</div>';
      c.innerHTML = html;
      document.querySelectorAll('[data-portal]').forEach(b => b.classList.remove('active'));
    },

    /* 门户总入口 */
    openPortal(name) {
      if (name === 'panorama') this.renderPanorama();
      else if (name === 'framework') this.renderFrameworkView();
      else if (name === 'caselibrary') this.renderCaseLibrary();
      else if (name === 'glossary') this.renderGlossary();
    }
  });

  /* ---------- 3) 全局委托点击导航（数据属性驱动） ---------- */
  document.addEventListener('click', function (e) {
    if (!globalThis.App) return;
    const el = e.target.closest && e.target.closest('[data-portal],[data-topic],[data-case],[data-variety-id],[data-reg],[data-class-cat],[data-ic]');
    if (!el) return;
    if (el.dataset.portal) { e.preventDefault(); App.openPortal(el.dataset.portal); return; }
    if (el.dataset.topic) { e.preventDefault(); App.renderFrameworkView(el.dataset.topic); return; }
    if (el.dataset.case) { e.preventDefault(); App.renderCaseLibrary(null, el.dataset.case); return; }
    if (el.dataset.varietyId) { e.preventDefault(); App.selectVariety(el.dataset.varietyId); return; }
    if (el.dataset.reg) { e.preventDefault(); App.openRegulation(el.dataset.reg); return; }
    if (el.dataset.classCat) { e.preventDefault(); App.openClassReq(el.dataset.classCat, el.dataset.classCode || ''); return; }
    if (el.dataset.ic) { e.preventDefault(); App.renderIntegratedCase(el.dataset.ic); return; }
  });
})();
