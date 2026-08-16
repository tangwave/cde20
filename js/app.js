/**
 * 海云AI · 药品研发生产 QA 专家 - 主应用逻辑 (v3.0)
 * 数据结构：categories → varieties → stages
 */

/**
 * 合并导航配置：以 化学药 / 生物制品 / 中药 为根。
 *  reg     —— 注册分类子节点（code 对应 DRUG_CLASSIFICATION 子项）
 *  special —— 产品类型 / 特殊品种子节点（code 对应 CLASS_REQUIREMENTS.specials）
 */
const CLASS_NAV = {
  chemo: { name: '化学药', icon: '💊', reg: ['1', '2.1', '2.2', '2.3', '2.4', '3.1', '3.2', '3.3', '3.4', '4', '5.1', '5.2'], special: ['radio', 'sterile', 'api', 'oral'] },
  bio:   { name: '生物制品', icon: '🧬', reg: ['T1', 'T2', 'T3', 'T4', 'P1', 'P2', 'P3'], special: ['mab', 'adc', 'recomb', 'cell', 'gene', 'blood', 'vaccine'] },
  tcm:   { name: '中药', icon: '🌿', reg: ['1.1', '1.2', '1.3', '2', '3.1', '3.2', '4'], special: ['tcm_form', 'tcm_yinp'] }
};
const CAT_MAP = { chemo: 'chemical', bio: 'biological', tcm: 'tcm' };

/**
 * 特殊子类 → 品种三重点 映射（用于「按产品类型(三重点)」节点点击直达三重点）。
 * 同一品种可对应多个特殊子类（如 生物制品 ← mab/adc/recomb；细胞与基因治疗产品 ← cell/gene）。
 * 反向映射 VARIETY_TO_SPECIALS 由 buildVarietyToSpecials() 运行时生成。
 */
const SPECIAL_TO_VARIETY = {
  chemo: { radio: 'radiopharm', sterile: 'sterile', api: 'api', oral: 'oral_solid' },
  bio:   { mab: 'biological', adc: 'biological', recomb: 'biological', cell: 'cell_gene', gene: 'cell_gene', blood: 'blood', vaccine: 'vaccine' },
  tcm:   { tcm_form: 'tcm_prep', tcm_yinp: 'tcm_pieces' }
};

function buildVarietyToSpecials() {
  const map = {};
  Object.keys(SPECIAL_TO_VARIETY).forEach(mc => {
    const grp = SPECIAL_TO_VARIETY[mc] || {};
    Object.keys(grp).forEach(code => {
      const vid = grp[code];
      map[vid] = map[vid] || [];
      map[vid].push({ mainClass: mc, code });
    });
  });
  return map;
}

const App = {
  state: {
    currentCategoryId: null,
    currentVarietyId: null,
    currentStageId: null,
    viewMode: 'detail', // 'detail' | 'matrix'
    bookmarks: [],
    notes: [],
    regulationPanelOpen: false,
    regLibOpen: false,     // 法规原文库是否打开
    regCat: 'all',         // 法规库分类筛选
    regQuery: '',          // 法规库搜索词
    currentRegId: null,    // 当前阅读的法规 id
    regLang: 'orig',        // 法规阅读语言：orig=原文, zh=中文翻译版
    preSub: 'overview',    // 临床前研究子板块：overview | cmc | pk | safety | tox | formulation | ind
    matrixLens: 'qs',       // 矩阵视图分类维度：qs=质量体系分类（9 类药品）, reg=注册分类（化药/生物/中药 子类）
    view: 'panorama',       // 当前主视图：panorama=全景总览, framework=知识框架, caselibrary=案例库, glossary=术语表, kb=常规知识库, classification=研发要求体系
    currentReqCat: null,   // 当前研发要求体系主类 chemo/bio/tcm
    currentReqCode: '',    // 当前研发要求体系子节点 code（''=总览）
    currentTopicId: null,  // 当前知识框架主题词 id
    currentCaseId: null,   // 当前案例库案例 id
    caseDomain: null,      // 案例库领域筛选
    classLens: 'reg',      // 药品分类视图镜头：reg=按注册分类, prod=按产品分类·生产工艺
    classProdForm: null,   // 产品分类镜头下选中的具体类型 entry id（null=显示产品分类树）
    classProdRoute: null   // 产品分类镜头下技术路线筛选（null=全部；synth/ferment/formulation/cm/culture/blood/paozhi/modern-ext/radio-syn）
  },

  /**
   * 初始化应用
   */
  init() {
    this.loadBookmarks();
    this.loadNotes();
    Penetrator.init();            // 穿透引擎
    this.renderSidebar();
    this.renderStageTabs();
    this.renderTopbarStats();
    this.bindEvents();
    this.initPenCard();           // 术语悬浮卡
    this.initSelectionAI();       // 选中文字 → AI 解释（覆盖所有界面）
    this.initRegLibrary();        // 法规原文库
    this.initQaAi();            // 法规问答 · 海云AI
    SearchEngine.init();

    // 默认进入「全景总览」（识林式整体认识入口）
    this.renderPanorama();
  },

  /* ============ 数据辅助方法 ============ */

  /**
   * 获取所有品种（扁平化）
   */
  getAllVarieties() {
    const list = [];
    KB_DATA.categories.forEach(cat => {
      cat.varieties.forEach(v => list.push(v));
    });
    return list;
  },

  /**
   * 根据 id 查找品种
   */
  findVarietyById(id) {
    for (const cat of KB_DATA.categories) {
      const v = cat.varieties.find(x => x.id === id);
      if (v) return v;
    }
    return null;
  },

  /**
   * 根据 id 查找分类
   */
  findCategoryById(id) {
    return KB_DATA.categories.find(c => c.id === id) || null;
  },

  /* ============ 书签 / 笔记 ============ */

  loadBookmarks() {
    try {
      const stored = localStorage.getItem('kb_bookmarks');
      this.state.bookmarks = stored ? JSON.parse(stored) : [];
    } catch (e) {
      this.state.bookmarks = [];
    }
  },

  saveBookmarks() {
    try {
      localStorage.setItem('kb_bookmarks', JSON.stringify(this.state.bookmarks));
    } catch (e) {
      console.error('保存书签失败:', e);
    }
  },

  loadNotes() {
    try {
      const stored = localStorage.getItem('kb_notes');
      this.state.notes = stored ? JSON.parse(stored) : [];
    } catch (e) {
      this.state.notes = [];
    }
  },

  saveNotes() {
    try {
      localStorage.setItem('kb_notes', JSON.stringify(this.state.notes));
    } catch (e) {
      console.error('保存笔记失败:', e);
    }
  },

  getNotesForCurrentPage() {
    if (!this.state.currentVarietyId || !this.state.currentStageId) return [];
    return this.state.notes.filter(n =>
      n.varietyId === this.state.currentVarietyId &&
      n.stageId === this.state.currentStageId
    );
  },

  addNote() {
    if (!this.state.currentVarietyId || !this.state.currentStageId) return;

    const textarea = document.getElementById('noteInput');
    if (!textarea) return;

    const content = textarea.value.trim();
    if (!content) {
      this.showToast('请输入笔记内容', 'warning');
      return;
    }

    const note = {
      id: 'note_' + Date.now(),
      varietyId: this.state.currentVarietyId,
      stageId: this.state.currentStageId,
      content: content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.state.notes.push(note);
    this.saveNotes();
    this.renderNotesSection();
    this.renderSidebar();
    this.showToast('笔记已保存', 'success');
    textarea.value = '';
  },

  deleteNote(noteId) {
    const idx = this.state.notes.findIndex(n => n.id === noteId);
    if (idx >= 0) {
      this.state.notes.splice(idx, 1);
      this.saveNotes();
      this.renderNotesSection();
      this.renderSidebar();
      this.showToast('笔记已删除', 'warning');
    }
  },

  editNote(noteId) {
    const note = this.state.notes.find(n => n.id === noteId);
    if (!note) return;
    const display = document.getElementById('noteDisplay_' + noteId);
    const editor = document.getElementById('noteEditor_' + noteId);
    if (display && editor) {
      display.style.display = 'none';
      editor.style.display = '';
      const textarea = editor.querySelector('textarea');
      if (textarea) textarea.focus();
    }
  },

  saveEditedNote(noteId) {
    const note = this.state.notes.find(n => n.id === noteId);
    if (!note) return;
    const editor = document.getElementById('noteEditor_' + noteId);
    if (!editor) return;
    const textarea = editor.querySelector('textarea');
    if (!textarea) return;

    const content = textarea.value.trim();
    if (!content) {
      this.showToast('笔记内容不能为空', 'warning');
      return;
    }
    note.content = content;
    note.updatedAt = new Date().toISOString();
    this.saveNotes();
    this.renderNotesSection();
    this.renderSidebar();
    this.showToast('笔记已更新', 'success');
  },

  cancelEditNote(noteId) {
    const display = document.getElementById('noteDisplay_' + noteId);
    const editor = document.getElementById('noteEditor_' + noteId);
    if (display && editor) {
      display.style.display = '';
      editor.style.display = 'none';
    }
  },

  renderNotesSection() {
    if (!this.state.currentVarietyId || !this.state.currentStageId) return;

    const notesContainer = document.getElementById('notesSection');
    if (!notesContainer) return;

    const notes = this.getNotesForCurrentPage();
    const variety = this.findVarietyById(this.state.currentVarietyId);
    const stage = KB_DATA.stages.find(s => s.id === this.state.currentStageId);
    if (!variety || !stage) return;

    let html = `
      <div class="detail-section notes-section" data-section="notes">
        <div class="detail-section-header">
          <span class="detail-section-header-icon">📝</span>
          <span class="detail-section-title">我的笔记</span>
          <span class="notes-count-badge">${notes.length}</span>
          <span class="detail-section-toggle">▼</span>
        </div>
        <div class="detail-section-body">
          <div class="note-input-area">
            <textarea id="noteInput" class="note-textarea" placeholder="在此记录您对 ${variety.name} · ${stage.name} 的学习笔记、审计要点或个人理解..." rows="3"></textarea>
            <button class="note-add-btn" id="noteAddBtn">💾 保存笔记</button>
          </div>
          <div class="notes-list">
    `;

    if (notes.length === 0) {
      html += '<div class="notes-empty">暂无笔记，在上方添加您的第一条笔记</div>';
    } else {
      notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      notes.forEach(note => {
        const date = new Date(note.updatedAt);
        const dateStr = date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const escapedContent = note.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        html += `
          <div class="note-item">
            <div id="noteDisplay_${note.id}" class="note-display">
              <div class="note-content">${escapedContent}</div>
              <div class="note-meta">
                <span class="note-date">📅 ${dateStr}</span>
                <div class="note-actions">
                  <button class="note-action-btn" onclick="App.editNote('${note.id}')" title="编辑">✏️</button>
                  <button class="note-action-btn" onclick="App.deleteNote('${note.id}')" title="删除">🗑️</button>
                </div>
              </div>
            </div>
            <div id="noteEditor_${note.id}" class="note-editor" style="display:none;">
              <textarea class="note-textarea note-edit-textarea" rows="3">${note.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
              <div class="note-editor-actions">
                <button class="note-save-btn" onclick="App.saveEditedNote('${note.id}')">✓ 保存</button>
                <button class="note-cancel-btn" onclick="App.cancelEditNote('${note.id}')">✗ 取消</button>
              </div>
            </div>
          </div>
        `;
      });
    }

    html += '</div></div></div>';
    notesContainer.innerHTML = html;

    const addBtn = document.getElementById('noteAddBtn');
    if (addBtn) addBtn.addEventListener('click', () => this.addNote());

    const noteInput = document.getElementById('noteInput');
    if (noteInput) {
      noteInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          this.addNote();
        }
      });
    }
  },

  /* ============ 顶部统计 ============ */

  renderTopbarStats() {
    const statsEl = document.getElementById('topbarStats');
    if (!statsEl) return;
    const varietyCount = this.getAllVarieties().length;
    const regCount = (globalThis.REG_KB_FULL || []).length;
    statsEl.innerHTML =
      '<span class="topbar-stats-item">📄 法规原文: ' + regCount + '</span>' +
      '<span class="topbar-stats-item">💊 品种: ' + varietyCount + '</span>' +
      '<span class="topbar-stats-item">📅 更新: ' + (KB_DATA.meta.lastUpdated || '') + '</span>';
  },

  /* ============ 侧边栏（2级：分类 → 品种） ============ */

  renderSidebar() {
    const navEl = document.getElementById('sidebarNav');
    if (!navEl) return;

    let html = '';

    // ===== 知识门户（识林式：全景 / 框架 / 案例 / 术语） =====
    html += '<div class="sidebar-portal">';
    html += '<div class="sidebar-section-title">🧭 知识门户</div>';
    const portalItems = [
      { name: '全景总览', icon: '🗺️', key: 'panorama' },
      { name: '知识框架', icon: '📚', key: 'framework' },
      { name: '案例库', icon: '🧭', key: 'caselibrary' },
      { name: '术语表', icon: '🔤', key: 'glossary' }
    ];
    portalItems.forEach(p => {
      const act = (this.state.view === p.key) ? ' active' : '';
      html += '<div class="sidebar-portal-item' + act + '" data-portal="' + p.key + '">' + p.icon + ' ' + p.name + '</div>';
    });
    html += '</div>';

    // ===== 合并导航：以 化学药 / 生物制品 / 中药 为根 =====
    const CR = globalThis.CLASS_REQUIREMENTS;
    const DC = globalThis.DRUG_CLASSIFICATION;
    const MAIN_ORDER = ['chemo', 'bio', 'tcm'];
    const MAIN_ICON = { chemo: '💊', bio: '🧬', tcm: '🌿' };

    MAIN_ORDER.forEach(mainClass => {
      const navCfg = CLASS_NAV[mainClass];
      const mainName = (navCfg && navCfg.name) || (CR && CR.mains[mainClass] ? CR.mains[mainClass].name : mainClass);
      html += '<div class="sidebar-category merged-cat">';
      html += '<div class="sidebar-category-title req-cat-title" data-req-cat="' + mainClass + '">' + MAIN_ICON[mainClass] + ' ' + mainName + '</div>';

      // —— 研发要求体系 ——
      html += '<div class="merged-group">';
      html += '<div class="merged-group-title">研发要求体系</div>';
      html += '<div class="req-node req-node-overview' + (this.state.view === 'classification' && !this.state.currentReqCode ? ' active' : '') + '" data-req-cat="' + mainClass + '" data-req-code="">'
        + '<span class="req-node-name">' + mainName + ' · 全部研发要求</span></div>';

      const regCodes = (navCfg && navCfg.reg) || [];
      if (regCodes.length) {
        html += '<div class="merged-subtitle">按注册分类</div>';
        regCodes.forEach(code => {
          const sub = this.findClassSub(mainClass, code);
          const nm = sub ? sub.name : code;
          const act = (this.state.view === 'classification' && this.state.currentReqCat === mainClass && (this.state.currentReqCode || '') === code) ? ' active' : '';
          html += '<div class="req-node' + act + '" data-req-cat="' + mainClass + '" data-req-code="' + this._esc(code) + '">'
            + '<span class="req-node-code">' + this._esc(code) + '</span>'
            + '<span class="req-node-name">' + this.pen(nm) + '</span></div>';
        });
      }
      const spCodes = (navCfg && navCfg.special) || [];
      if (spCodes.length) {
        html += '<div class="merged-subtitle">按产品类型(三重点)</div>';
        spCodes.forEach(code => {
          const vid = (SPECIAL_TO_VARIETY[mainClass] && SPECIAL_TO_VARIETY[mainClass][code]) || '';
          const sp = (CR && CR.specials[mainClass] && CR.specials[mainClass][code]) || null;
          const nm = sp ? sp.subName : (this.findClassSub(mainClass, code) ? this.findClassSub(mainClass, code).name : code);
          const active = (this.state.view !== 'classification' && this.state.currentVarietyId === vid) ? ' active' : '';
          html += '<div class="req-node-special' + active + '" data-variety-id="' + this._esc(vid) + '" data-special-code="' + this._esc(code) + '">'
            + '<span class="req-node-name">' + this.pen(nm) + '</span>'
            + '<span class="req-node-badge req-node-badge-3pt">三重点</span></div>';
        });
      }
      html += '</div>';
    });

    // 书签区
    html += '<div class="sidebar-section">';
    html += '<div class="sidebar-section-title">📑 书签</div>';
    if (this.state.bookmarks.length === 0) {
      html += '<div class="bookmark-empty">暂无书签，点击详情页⭐收藏</div>';
    } else {
      this.state.bookmarks.forEach(bm => {
        const v = this.findVarietyById(bm.varietyId);
        const stage = KB_DATA.stages.find(s => s.id === bm.stageId);
        if (v && stage) {
          html += `
            <div class="bookmark-item" data-variety-id="${bm.varietyId}" data-stage-id="${bm.stageId}">
              <span class="bookmark-icon">⭐</span>
              <span class="bookmark-item-text">${v.icon} ${v.name} · ${stage.name}</span>
              <button class="bookmark-item-remove" data-variety-id="${bm.varietyId}" data-stage-id="${bm.stageId}">×</button>
            </div>
          `;
        }
      });
    }
    html += '</div>';

    // 笔记区
    html += '<div class="sidebar-section">';
    html += '<div class="sidebar-section-title">📝 笔记</div>';
    if (this.state.notes.length === 0) {
      html += '<div class="bookmark-empty">暂无笔记，在详情页添加</div>';
    } else {
      const recentNotes = [...this.state.notes].sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
      ).slice(0, 8);
      recentNotes.forEach(note => {
        const v = this.findVarietyById(note.varietyId);
        const stage = KB_DATA.stages.find(s => s.id === note.stageId);
        if (v && stage) {
          const preview = note.content.substring(0, 40) + (note.content.length > 40 ? '...' : '');
          html += `
            <div class="note-sidebar-item" data-variety-id="${note.varietyId}" data-stage-id="${note.stageId}">
              <span class="note-sidebar-icon">📝</span>
              <span class="note-sidebar-text">${v.icon} ${v.name} · ${stage.name}</span>
              <div class="note-sidebar-preview">${preview}</div>
            </div>
          `;
        }
      });
      if (this.state.notes.length > 8) {
        html += `<div class="notes-more-hint">还有 ${this.state.notes.length - 8} 条笔记...</div>`;
      }
    }
    html += '</div>';

    navEl.innerHTML = html;

    // 合并导航交互
    navEl.querySelectorAll('.req-cat-title').forEach(t => {
      t.addEventListener('click', () => this.openClassReq(t.dataset.reqCat, ''));
    });
    navEl.querySelectorAll('.req-node').forEach(n => {
      n.addEventListener('click', () => this.openClassReq(n.dataset.reqCat, n.dataset.reqCode || ''));
    });

    navEl.querySelectorAll('.req-node-special').forEach(n => {
      n.addEventListener('click', () => this.selectVariety(n.dataset.varietyId));
    });

    navEl.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('bookmark-item-remove')) return;
        this.selectVariety(item.dataset.varietyId);
        setTimeout(() => this.selectStage(item.dataset.stageId), 50);
      });
    });

    navEl.querySelectorAll('.bookmark-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeBookmark(btn.dataset.varietyId, btn.dataset.stageId);
      });
    });

    navEl.querySelectorAll('.note-sidebar-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectVariety(item.dataset.varietyId);
        setTimeout(() => this.selectStage(item.dataset.stageId), 50);
      });
    });
  },

  /* ============ 研发要求体系：辅助查询 ============ */

  findClassSub(mainClass, code) {
    const DC = globalThis.DRUG_CLASSIFICATION;
    if (!DC) return null;
    const cat = DC.categories.find(c => c.id === mainClass);
    if (!cat) return null;
    const items = (cat.items || []).concat(
      (cat.groups || []).reduce((a, g) => a.concat(g.items || []), [])
    );
    return items.find(s => String(s.code) === String(code)) || null;
  },

  findRegById(rid) {
    return (globalThis.REG_INDEX || []).find(r => r.id === rid) || null;
  },

  _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  /* ============ 阶段标签页 ============ */

  renderStageTabs() {
    const tabsEl = document.getElementById('stageTabs');
    if (!tabsEl) return;

    let html = '';
    KB_DATA.stages.forEach(stage => {
      html += `
        <button class="stage-tab ${this.state.currentStageId === stage.id ? 'active' : ''}" data-stage-id="${stage.id}">
          <span class="stage-tab-icon">${stage.icon}</span>
          <span class="stage-tab-text">
            <span class="stage-tab-name">${stage.name}</span>
            <span class="stage-tab-en">${stage.enName}</span>
          </span>
        </button>
      `;
    });
    tabsEl.innerHTML = html;

    tabsEl.querySelectorAll('.stage-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.selectStage(tab.dataset.stageId);
      });
    });
  },

  /* ============ 选择逻辑 ============ */

  selectVariety(varietyId) {
    const variety = this.findVarietyById(varietyId);
    if (!variety) return;
    if (this.state.regLibOpen) this._exitRegLib();
    this._exitClassViewIfOpen();
    this._exitPortalIfOpen();

    this.state.currentCategoryId = variety.categoryId || null;
    this.state.currentVarietyId = varietyId;
    this.state.currentStageId = null;
    this.state.viewMode = 'detail';

    this.renderSidebar();
    this.renderStageTabs();
    this.renderBreadcrumb();
    this.renderVarietyOverview();
    this.hideMatrixView();
    this.showDetailLayout();
  },

  selectStage(stageId) {
    if (!this.state.currentVarietyId) return;
    if (this.state.regLibOpen) this._exitRegLib();
    this._exitClassViewIfOpen();
    this.state.currentStageId = stageId;
    this.state.viewMode = 'detail';

    this.renderStageTabs();
    this.renderBreadcrumb();
    this.renderDetailView();
    this.hideMatrixView();
    this.showDetailLayout();
  },

  toggleMatrixView() {
    if (this.state.regLibOpen) this._exitRegLib();
    if (this.state.viewMode === 'matrix') {
      this.state.viewMode = 'detail';
      this.hideMatrixView();
      this.showDetailLayout();
      if (this.state.currentVarietyId) {
        if (this.state.currentStageId) {
          this.renderDetailView();
        } else {
          this.renderVarietyOverview();
        }
      } else {
        this.renderEmptyState();
      }
    } else {
      this.state.viewMode = 'matrix';
      this.showMatrixView();
      this.hideDetailLayout();
      this.renderMatrixView();
    }
    const btn = document.getElementById('matrixToggleBtn');
    if (btn) btn.classList.toggle('active', this.state.viewMode === 'matrix');
  },

  showDetailLayout() {
    const el = document.getElementById('detailLayout');
    if (el) el.style.display = '';
  },

  hideDetailLayout() {
    const el = document.getElementById('detailLayout');
    if (el) el.style.display = 'none';
  },

  showMatrixView() {
    const el = document.getElementById('matrixView');
    if (el) el.style.display = '';
  },

  hideMatrixView() {
    const el = document.getElementById('matrixView');
    if (el) el.style.display = 'none';
  },

  /* ============ 面包屑 ============ */

  renderBreadcrumb() {
    const bcEl = document.getElementById('breadcrumb');
    if (!bcEl) return;

    let html = '<span class="breadcrumb-item">首页</span>';

    if (this.state.currentVarietyId) {
      const v = this.findVarietyById(this.state.currentVarietyId);
      const cat = this.findCategoryById(this.state.currentCategoryId);
      html += '<span class="breadcrumb-sep">/</span>';
      if (cat) html += `<span class="breadcrumb-item">${cat.name}</span><span class="breadcrumb-sep">/</span>`;

      if (this.state.currentStageId) {
        html += `<span class="breadcrumb-item variety-breadcrumb" data-variety-id="${v.id}">${v.name}</span>`;
        const stage = KB_DATA.stages.find(s => s.id === this.state.currentStageId);
        html += '<span class="breadcrumb-sep">/</span>';
        html += `<span class="breadcrumb-item current">${stage.name}</span>`;
      } else {
        html += `<span class="breadcrumb-item current">${v.name}</span>`;
      }
    }

    bcEl.innerHTML = html;

    const vBc = bcEl.querySelector('.variety-breadcrumb');
    if (vBc) {
      vBc.style.cursor = 'pointer';
      vBc.addEventListener('click', () => {
        this.selectVariety(vBc.dataset.varietyId);
      });
    }
  },

  /* ============ 品种概览 ============ */

  renderVarietyOverview() {
    const contentEl = document.getElementById('content');
    if (!contentEl || !this.state.currentVarietyId) return;

    const v = this.findVarietyById(this.state.currentVarietyId);
    if (!v) return;
    const cat = this.findCategoryById(v.categoryId);

    let html = `
      <div class="overview-header" style="border-left-color: ${v.color}">
        <div class="overview-title-row">
          <div class="overview-icon" style="background: ${v.color}15">${v.icon}</div>
          <div>
            <div class="overview-title">${v.name}</div>
            <div class="overview-subtitle">${v.enName || ''}</div>
          </div>
          <span class="overview-gmp-badge">📋 ${v.gmpAppendix || ''}</span>
        </div>
        <div class="overview-description">${v.description || ''}</div>
        ${cat ? `<div class="overview-category-chip">所属分类：${cat.name}</div>` : ''}
        <div class="detail-risks">
          ${(v.keyRisks || []).map(r => `<span class="risk-badge">${r}</span>`).join('')}
        </div>
      </div>

      <div class="overview-grid">
        <div class="overview-card">
          <div class="overview-card-title"><span class="overview-card-title-icon">📂</span> 子类别</div>
          <div class="overview-subcategories">
            ${(v.subCategories || []).map(s => `<span class="subcategory-tag">${s}</span>`).join('')}
          </div>
        </div>
        <div class="overview-card">
          <div class="overview-card-title"><span class="overview-card-title-icon">⚠️</span> 关键风险领域</div>
          <div>
            ${(v.keyRisks || []).map(r => `<span class="key-risk-badge">${r}</span>`).join('')}
          </div>
        </div>
      </div>

      <h3 style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: var(--spacing-md); display: flex; align-items: center; gap: 8px;">
        <span>🚀</span> 快速导航 - 选择研发阶段查看详细质量要求
      </h3>
      <div class="overview-stages">
    `;

    KB_DATA.stages.forEach(stage => {
      html += `
        <div class="overview-stage-card" data-stage-id="${stage.id}">
          <div class="overview-stage-icon">${stage.icon}</div>
          <div class="overview-stage-name">${stage.name}</div>
          <div class="overview-stage-timeline">${stage.timeline || ''}</div>
        </div>
      `;
    });

    html += '</div>';
    html += this.renderSpecialClassSections(v);
    contentEl.innerHTML = html;

    contentEl.querySelectorAll('.overview-stage-card').forEach(card => {
      card.addEventListener('click', () => this.selectStage(card.dataset.stageId));
    });
  },

  /* ============ 特殊子类：研发要求差异 + 阶段级实施案例 ============ */

  renderSpecialClassSections(v) {
    const V2S = buildVarietyToSpecials();
    const specs = V2S[v.id] || [];
    if (!specs.length) return '';
    const CR = globalThis.CLASS_REQUIREMENTS;
    const CASES = globalThis.SPECIAL_CASES || {};
    const stageList = (CR && CR.stages) ? CR.stages.map(s => s.id) : ['discovery', 'preclinical', 'clinical', 'nda', 'commercial', 'postmarket'];
    const stageNames = (CR && CR.stages) ? CR.stages.reduce((a, s) => (a[s.id] = s.name, a), {}) : {};
    const dimList = (CR && CR.dims) ? CR.dims.map(d => d.id) : ['rnd', 'process', 'quality', 'qm'];
    const dimNames = (CR && CR.dims) ? CR.dims.reduce((a, d) => (a[d.id] = d.name, a), {}) : {};
    const STAGE_ALIAS = {
      radio_supply: '放射性物料与短半衰期供应链',
      adc_payload: 'ADC 载荷（Payload）供应与安全管理',
      cell_chain: '供者细胞采集与冷链时效管理',
      gene_vector: '基因治疗载体生产与放行',
      vacc_lot: '疫苗批签发'
    };

    let html = '<h3 class="special-section-title"><span>🧪</span> 特殊子类研发要求差异与阶段级实施案例</h3>';

    specs.forEach(({ mainClass, code }) => {
      const sp = (CR && CR.specials[mainClass] && CR.specials[mainClass][code]) || null;
      const caseGrp = (CASES[mainClass] && CASES[mainClass][code] && CASES[mainClass][code].cases) || [];
      const subName = sp ? sp.subName : (this.findClassSub(mainClass, code) ? this.findClassSub(mainClass, code).name : code);
      if (!sp && !caseGrp.length) return;

      const extra = (sp && sp.extraStages) ? sp.extraStages : [];
      const stagesToShow = stageList.slice();
      extra.forEach(es => { if (!stagesToShow.includes(es.id)) stagesToShow.push(es.id); });
      caseGrp.map(c => c.stage).forEach(sid => { if (!stagesToShow.includes(sid)) stagesToShow.push(sid); });

      const hasAny = stagesToShow.some(sid => {
        const ov = (sp && sp.override && sp.override[sid]) || null;
        const es = extra.find(e => e.id === sid) || null;
        const hasOv = ov && dimList.some(d => ov[d] && ((ov[d].requirement && ov[d].requirement.length) || (ov[d].technique && ov[d].technique.length)));
        const hasEs = es && es.dims && dimList.some(d => es.dims[d] && ((es.dims[d].requirement && es.dims[d].requirement.length) || (es.dims[d].technique && es.dims[d].technique.length)));
        return hasOv || hasEs || caseGrp.some(c => c.stage === sid);
      });
      if (!hasAny) return;

      html += '<details class="special-class-block" open>';
      html += '<summary class="special-class-head"><span class="special-class-icon">🧪</span>'
        + '<span class="special-class-title">' + this.pen(subName) + '</span>'
        + '<span class="special-class-tag">研发要求差异 + 阶段级实施案例</span></summary>';
      html += '<div class="special-class-note">本品种属「' + (CR && CR.mains[mainClass] ? CR.mains[mainClass].name : mainClass) + '」下的特殊子类；未标注单元格继承主类要求。</div>';

      stagesToShow.forEach(sid => {
        const ov = (sp && sp.override && sp.override[sid]) || null;
        const es = extra.find(e => e.id === sid) || null;
        const stageCases = caseGrp.filter(c => c.stage === sid);
        const hasOv = ov && dimList.some(d => ov[d] && ((ov[d].requirement && ov[d].requirement.length) || (ov[d].technique && ov[d].technique.length)));
        const hasEs = es && es.dims && dimList.some(d => es.dims[d] && ((es.dims[d].requirement && es.dims[d].requirement.length) || (es.dims[d].technique && es.dims[d].technique.length)));
        if (!hasOv && !hasEs && !stageCases.length) return;

        const sname = stageNames[sid] || (es ? es.name : (STAGE_ALIAS[sid] || sid));
        html += '<details class="special-stage">';
        html += '<summary class="special-stage-head"><span class="special-stage-name">' + this.pen(sname) + '</span>'
          + (stageCases.length ? '<span class="special-stage-badge">📌' + stageCases.length + '</span>' : '') + '</summary>';

        if (ov) {
          dimList.forEach(did => {
            const cell = ov[did];
            if (!cell || !((cell.requirement && cell.requirement.length) || (cell.technique && cell.technique.length))) return;
            html += '<div class="special-dim">';
            html += '<div class="special-dim-head">' + (dimNames[did] || did) + ' <span class="special-dim-diff">↳ 与主类差异</span></div>';
            if (cell.requirement && cell.requirement.length)
              html += '<div class="special-block-title special-req">要求</div><ul class="special-list special-list-req">' + cell.requirement.map(r => '<li>' + this.pen(r) + '</li>').join('') + '</ul>';
            if (cell.technique && cell.technique.length)
              html += '<div class="special-block-title special-tech">实施技巧</div><ul class="special-list special-list-tech">' + cell.technique.map(t => '<li>' + this.pen(t) + '</li>').join('') + '</ul>';
            if (cell.note) html += '<div class="special-diff-note">' + this.pen(cell.note) + '</div>';
            html += '</div>';
          });
        }
        if (es && es.dims) {
          dimList.forEach(did => {
            const cell = es.dims[did];
            if (!cell || !((cell.requirement && cell.requirement.length) || (cell.technique && cell.technique.length))) return;
            html += '<div class="special-dim special-dim-extra">';
            html += '<div class="special-dim-head">' + (dimNames[did] || did) + ' <span class="special-dim-extra-tag">特有阶段</span></div>';
            if (cell.requirement && cell.requirement.length)
              html += '<div class="special-block-title special-req">要求</div><ul class="special-list special-list-req">' + cell.requirement.map(r => '<li>' + this.pen(r) + '</li>').join('') + '</ul>';
            if (cell.technique && cell.technique.length)
              html += '<div class="special-block-title special-tech">实施技巧</div><ul class="special-list special-list-tech">' + cell.technique.map(t => '<li>' + this.pen(t) + '</li>').join('') + '</ul>';
            if (cell.note) html += '<div class="special-diff-note">' + this.pen(cell.note) + '</div>';
            html += '</div>';
          });
        }
        if (stageCases.length) {
          html += '<div class="special-cases"><div class="special-cases-title">📌 阶段级实施案例 / 模板</div>';
          stageCases.forEach(c => {
            html += '<div class="case-card">';
            html += '<div class="case-card-title">' + this.pen(c.title || '实施案例') + '</div>';
            if (c.dim) html += '<span class="case-dim-tag">' + (dimNames[c.dim] || c.dim) + '</span>';
            if (c.scenario) html += '<div class="case-field"><span class="case-field-label">案例背景</span><span class="case-field-body">' + this.pen(c.scenario) + '</span></div>';
            if (c.template) html += '<div class="case-field"><span class="case-field-label">实施模板 / 要点</span><span class="case-field-body">' + this.pen(c.template) + '</span></div>';
            if (c.points && c.points.length)
              html += '<div class="case-field"><span class="case-field-label">关键要点</span><ul class="case-points">' + c.points.map(p => '<li>' + this.pen(p) + '</li>').join('') + '</ul></div>';
            html += '</div>';
          });
          html += '</div>';
        }
        html += '</details>';
      });
      html += '</details>';
    });
    return html;
  },

  /* ============ 详细视图 ============ */

  renderDetailView() {
    const contentEl = document.getElementById('content');
    if (!contentEl || !this.state.currentVarietyId || !this.state.currentStageId) return;

    const v = this.findVarietyById(this.state.currentVarietyId);
    const stage = KB_DATA.stages.find(s => s.id === this.state.currentStageId);
    if (!v || !stage) return;

    const stageData = v.stages[stage.id];
    if (!stageData) {
      contentEl.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">暂无数据</div>
        <div class="empty-state-desc">该品种在此阶段的质量体系数据尚在建设中。</div>
      </div>`;
      return;
    }

    const preBoard = (stage.id === 'preclinical') ? this.getCurrentPreSub(v) : null;
    const isBookmarked = this.isBookmarked(v.id, stage.id);

    let html = `
      <div class="detail-header">
        <div class="detail-header-top">
          <div class="detail-header-icon" style="background: ${v.color}15">${v.icon}</div>
          <div class="detail-header-info">
            <div class="detail-header-title">${v.name} · ${stage.name}</div>
            <div class="detail-header-meta">${v.enName || ''} / ${stage.enName} · ${v.gmpAppendix || ''} · ${stage.timeline || ''}</div>
          </div>
          <div class="detail-header-actions">
            <button class="detail-bookmark-btn ${isBookmarked ? 'active' : ''}" id="bookmarkBtn" title="添加书签">
              ${isBookmarked ? '⭐' : '☆'}
            </button>
            <button class="detail-bookmark-btn" id="regulationPanelBtn" title="法规快速链接">📎</button>
            <button class="detail-bookmark-btn" id="printBtn" title="打印">🖨️</button>
          </div>
        </div>
    <div class="detail-summary">${stageData.summary || '暂无摘要'}</div>
    ${v.keyRisks ? `<div class="detail-risks">${v.keyRisks.map(r => `<span class="risk-badge">${r}</span>`).join('')}</div>` : ''}
  </div>
`;
    // 临床前研究子板块导航（CMC/药代/安全药理/毒理/制剂/IND）
    if (stage.id === 'preclinical') { html += this.renderPreclinicalSubNav(v); }

    if (!preBoard) {
    // 工艺研究重点（可展开卡片：详细描述 + 实施方案）
    if (stageData.process_focus && stageData.process_focus.length > 0) {
      html += this.renderQualityMgmtSection('process_focus', '🔬', '工艺研究重点', stageData.process_focus, 'focus-process');
    }
    // 质量研究重点（可展开卡片：详细描述 + 实施方案）
    if (stageData.quality_focus && stageData.quality_focus.length > 0) {
      html += this.renderQualityMgmtSection('quality_focus', '🔍', '质量研究重点', stageData.quality_focus, 'focus-quality');
    }
    // 质量管理要求（可展开卡片：详细描述 + 实施方案）
    if (stageData.quality_mgmt && stageData.quality_mgmt.length > 0) {
      html += this.renderQualityMgmtSection('quality_mgmt', '📋', '质量管理要求', stageData.quality_mgmt, 'focus-mgmt');
    }

    // 阶段主体：国内/国际要求、实施指导、案例、陷阱（提取为复用方法）
    html += this.renderSectionDomestic(stageData.domestic);
    html += this.renderSectionInternational(stageData.international);
    html += this.renderSectionGuidance(stageData.guidance);
    html += this.renderSectionCases(stageData.cases);
    html += this.renderSectionPitfalls(stageData.pitfalls);
    } else {
      html += this.renderPreclinicalBoard(preBoard);
    }

    // 法规更新
    const relatedChangelog = (KB_DATA.changelog || []).filter(c =>
      c.relatedDrugTypes && c.relatedDrugTypes.includes(v.id)
    );
    if (relatedChangelog.length > 0) {
      html += `
        <div class="changelog-section">
          <div class="changelog-title">📜 法规更新动态</div>
          <div class="changelog-list">
            ${relatedChangelog.map(c => `
              <div class="changelog-item ${c.impact}">
                <span class="changelog-date">${c.date}</span>
                <div class="changelog-content">
                  <div class="changelog-item-title">
                    ${c.title}
                    <span class="changelog-tag ${c.type}">${c.type === 'new' ? '新增' : '更新'}</span>
                  </div>
                  <div class="changelog-item-desc">${c.description}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    html += '<div id="notesSection"></div>';
    contentEl.innerHTML = html;

    // 折叠事件
    contentEl.querySelectorAll('.detail-section-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('collapsed');
      });
    });

    // 质量管理要求卡片展开/收起
    contentEl.querySelectorAll('.qm-card-header').forEach(h => {
      const toggle = () => {
        const card = h.parentElement;
        const expanded = card.classList.toggle('expanded');
        h.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      };
      h.addEventListener('click', toggle);
      h.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });

    const bookmarkBtn = document.getElementById('bookmarkBtn');
    if (bookmarkBtn) bookmarkBtn.addEventListener('click', () => this.toggleBookmark(v.id, stage.id));

    const regBtn = document.getElementById('regulationPanelBtn');
    if (regBtn) regBtn.addEventListener('click', () => this.toggleRegulationPanel());

    const printBtn = document.getElementById('printBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    // 临床前研究子板块切换
    contentEl.querySelectorAll('.pre-subtab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.preSub = btn.dataset.sub || 'overview';
        this.renderDetailView();
      });
    });

    this.renderRegulationPanel(v, stage, stageData);
    this.renderNotesSection();
  },

  /**
   * 渲染工艺/质量/管理三分区（带独立滚动）
   */
  esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  renderFocusSection(key, icon, title, items, extraClass) {
    const list = items.map(item => {
      const text = (item && typeof item === 'object') ? item.text : item;
      const guidance = (item && typeof item === 'object' && item.guidance) ? item.guidance : '';
      return `
        <li class="focus-item">
          <span class="focus-bullet">▶</span>
          <div class="focus-item-body">
            <span class="focus-text">${this.pen(text)}</span>
            ${guidance ? `<div class="focus-guidance"><span class="focus-guidance-icon">💡</span><span class="focus-guidance-text">${this.pen(guidance)}</span></div>` : ''}
          </div>
        </li>`;
    }).join('');
    return `
      <div class="detail-section focus-section ${extraClass}" data-section="${key}">
        <div class="detail-section-header">
          <span class="detail-section-header-icon">${icon}</span>
          <span class="detail-section-title">${title}</span>
          <span class="focus-count-badge">${items.length}</span>
          <span class="detail-section-toggle">▼</span>
        </div>
        <div class="detail-section-body">
          <ul class="focus-list">${list}</ul>
        </div>
      </div>
    `;
  },

  /**
   * 渲染质量管理要求：可展开卡片（详细描述 + 实施方案）
   */
  renderQualityMgmtSection(key, icon, title, items, extraClass) {
    const list = items.map(item => {
      const text = (item && typeof item === 'object') ? item.text : item;
      const guidance = (item && typeof item === 'object' && item.guidance) ? item.guidance : '';
      const detail = (item && typeof item === 'object' && item.detail) ? item.detail : '';
      const plan = (item && typeof item === 'object' && Array.isArray(item.plan)) ? item.plan : [];
      const planHtml = plan.length
        ? `<ol class="qm-plan">${plan.map(p => `<li>${this.pen(p)}</li>`).join('')}</ol>`
        : '';
      return `
        <li class="qm-card">
          <div class="qm-card-header" role="button" tabindex="0" aria-expanded="false">
            <span class="qm-bullet">▶</span>
            <div class="qm-card-head-body">
              <span class="qm-text">${this.pen(text)}</span>
              ${guidance ? `<div class="qm-guidance"><span class="qm-guidance-icon">💡</span><span class="qm-guidance-text">${this.pen(guidance)}</span></div>` : ''}
            </div>
            <span class="qm-expand-icon">▸</span>
          </div>
          <div class="qm-card-body">
            ${detail ? `<div class="qm-block">
              <div class="qm-block-title"><span class="qm-block-icon">📖</span>详细描述</div>
              <div class="qm-detail">${this.pen(detail)}</div>
            </div>` : ''}
            ${planHtml ? `<div class="qm-block">
              <div class="qm-block-title"><span class="qm-block-icon">🛠</span>实施方案</div>
              ${planHtml}
            </div>` : ''}
          </div>
        </li>`;
    }).join('');
    return `
      <div class="detail-section focus-section ${extraClass}" data-section="${key}">
        <div class="detail-section-header">
          <span class="detail-section-header-icon">${icon}</span>
          <span class="detail-section-title">${title}</span>
          <span class="focus-count-badge">${items.length}</span>
          <span class="detail-section-toggle">▼</span>
        </div>
        <div class="detail-section-body">
          <ul class="qm-list">${list}</ul>
          <div class="qm-hint">点击任意卡片可展开「详细描述 / 实施方案」</div>
        </div>
      </div>
    `;
  },

  /* ============ 矩阵视图（药品分类 · 双体系整合矩阵） ============ */

  // 6 个标准研发阶段（与 CLASS_REQUIREMENTS 对齐），同时映射 KB_DATA 的 9 阶段
  _matrixPhases() {
    return [
      { id: 'discovery',  name: '药物发现与立项', icon: '🎯', crId: 'discovery',  kbStages: ['target_discovery', 'lead_discovery', 'compound_optimization', 'candidate_selection'], clickStage: 'target_discovery', level: 'green' },
      { id: 'preclinical', name: '临床前研究',     icon: '⚗️', crId: 'preclinical', kbStages: ['preclinical'], clickStage: 'preclinical', level: 'red' },
      { id: 'clinical',   name: '临床试验',       icon: '🏥', crId: 'clinical',   kbStages: ['clinical_trial'], clickStage: 'clinical_trial', level: 'red' },
      { id: 'nda',        name: '上市申请',       icon: '📄', crId: 'nda',        kbStages: ['nda_filing'], clickStage: 'nda_filing', level: 'red' },
      { id: 'commercial', name: '商业化生产',     icon: '🏭', crId: 'commercial', kbStages: ['approval_launch'], clickStage: 'approval_launch', level: 'yellow' },
      { id: 'postmarket', name: '上市后监测',     icon: '🔄', crId: 'postmarket', kbStages: ['post_market'], clickStage: 'post_market', level: 'yellow' }
    ];
  },

  // 品种 id → 注册分类大类（用于行内交叉跳转）
  _varietyRegMap() {
    return { sterile: 'chemo', api: 'chemo', radiopharm: 'chemo', oral_solid: 'chemo', medical_gas: 'chemo', biological: 'bio', blood: 'bio', cell_gene: 'bio', tcm_prep: 'tcm', tcm_pieces: 'tcm' };
  },

  // 将注册分类子类的要点（特殊要求/考量/申报资料）按关键词归集到研发阶段（仅导航用）
  _classifyBulletToPhase(text) {
    const t = String(text || '');
    const rules = [
      ['discovery',  /立题|立项|靶点|筛选|结构明确|活性成份|已知活性|专利|知识产权|成药|苗头|先导|构效|候选药物|境内外均未上市|创新药|全新/],
      ['clinical',   /临床|试验|GCP|受试者|疗效|耐受|给药|I期|II期|III期|期临床/],
      ['nda',        /申报|上市|NDA|BLA|CTD|模块|资料|审评|批准|注册|证书|批件|申报资料/],
      ['commercial', /生产|商业化|GMP|工艺验证|批生产|车间|厂房|设备|无菌保证|批签发|放行/],
      ['postmarket', /上市后|变更|再注册|药物警戒|IV期|不良反应|监测|追溯|抽检|再评价/],
      ['preclinical',/非临床|毒理|药代|GLP|安全性|IND|CMC|晶型|盐型|杂质|稳定性|制剂|质量研究|结构确证|工艺|对照品|溶出|释放|表征|细胞库|病毒安全|免疫原性|效价/]
    ];
    for (const [ph, re] of rules) if (re.test(t)) return ph;
    return 'preclinical';
  },

  // 切换矩阵视图的分类维度（qs=质量体系分类 / reg=注册分类）
  setMatrixLens(lens) {
    if (this.state.matrixLens === lens) return;
    this.state.matrixLens = lens;
    if (this.state.viewMode === 'matrix') this.renderMatrixView();
  },

  // 从任意视图返回矩阵视图
  openMatrixView() {
    if (this.state.regLibOpen) this._exitRegLib();
    this._exitClassViewIfOpen();
    this._exitPortalIfOpen();
    this.state.view = 'kb';
    this.state.viewMode = 'matrix';
    ['breadcrumb', 'stageTabs', 'detailLayout'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    this.showMatrixView();
    this.renderMatrixView();
    const b = document.getElementById('matrixToggleBtn'); if (b) b.classList.add('active');
  },

  renderMatrixView() {
    const matrixEl = document.getElementById('matrixView');
    if (!matrixEl) return;
    this.state.qsGmpOpen = false;
    const DC = globalThis.DRUG_CLASSIFICATION;
    const lens = this.state.matrixLens || 'qs';
    const phases = this._matrixPhases();
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const vReg = this._varietyRegMap();
    const regLabel = { chemo: '化药', bio: '生物', tcm: '中药' };

    // ---- 顶部：两套分类体系整合指南 ----
    const regCats = DC ? DC.categories.map(c => {
      const items = (c.groups || [{ items: c.items }]).flatMap(g => g.items || []);
      return { id: c.id, name: c.name, icon: c.icon, count: items.length };
    }) : [];
    const regTotal = regCats.reduce((a, c) => a + c.count, 0);
    const qsVarieties = this.getAllVarieties();
    const guide = `
      <div class="mx-guide">
        <div class="mx-guide-head">
          <span class="mx-guide-title">🧭 药品分类矩阵 · 一图整合两套分类体系</span>
          <span class="mx-guide-sub">注册分类决定申报路径与资料要求；质量体系分类决定 GMP 符合性要点与跨阶段控制策略——两者互补，覆盖药品全生命周期。</span>
        </div>
        <div class="mx-guide-cols">
          <div class="mx-guide-card reg">
            <div class="mx-guide-card-title">🗂️ 注册分类（按 NMPA 2020 注册分类及申报资料要求）</div>
            <div class="mx-guide-chips">
              ${regCats.map(c => `<span class="mx-guide-chip" data-regcat="${c.id}" title="查看${esc(c.name)}注册分类">${c.icon} ${esc(c.name)} <b>${c.count}</b></span>`).join('')}
            </div>
            <button class="mx-guide-btn" data-action="open-reg">打开注册分类全书 →</button>
          </div>
          <div class="mx-guide-card qs">
            <div class="mx-guide-card-title">🧪 质量体系分类（按 GMP 附录 / 产品特性，覆盖 ${qsVarieties.length} 类）</div>
            <div class="mx-guide-chips">
              ${qsVarieties.map(v => `<span class="mx-guide-chip" data-variety="${v.id}" title="查看${esc(v.name)}质量体系矩阵">${v.icon || '●'} ${esc(v.name)}</span>`).join('')}
            </div>
            <button class="mx-guide-btn" data-action="open-qs">定位本矩阵（质量体系） →</button>
          </div>
        </div>
      </div>
    `;

    // ---- 维度切换 ----
    const lensBar = `
      <div class="mx-lens-bar">
        <span class="mx-lens-label">分类维度：</span>
        <button class="mx-lens-btn ${lens === 'qs' ? 'active' : ''}" data-lens="qs">质量体系分类（${qsVarieties.length} 类药品）</button>
        <button class="mx-lens-btn ${lens === 'reg' ? 'active' : ''}" data-lens="reg">注册分类（${regTotal} 子类）</button>
        <span class="mx-lens-hint">${lens === 'reg' ? '单元格按子类要点关键词自动归集到研发阶段，仅用于导航；点击查看完整分类与分阶段要求体系' : '点击单元格下钻到该品种 × 阶段的完整要求体系'}</span>
      </div>
    `;

    // ---- 图例 ----
    const legend = `
      <div class="matrix-legend">
        <span style="font-weight:600; color:var(--text-primary);">${lens === 'qs' ? `质量体系分类矩阵：${qsVarieties.length} 类药品 × 6 个研发阶段` : `注册分类矩阵：${regTotal} 个子类 × 6 个研发阶段`}</span>
        <span class="matrix-legend-item"><span class="matrix-legend-dot" style="background:#4CAF50"></span> 要求明确</span>
        <span class="matrix-legend-item"><span class="matrix-legend-dot" style="background:#FFC107"></span> 部分要求</span>
        <span class="matrix-legend-item"><span class="matrix-legend-dot" style="background:#F44336"></span> 关键/复杂</span>
        <span class="matrix-legend-item"><span class="matrix-legend-dot" style="background:#1565C0"></span> 🔗 可下钻</span>
      </div>
    `;

    // ---- 表头 ----
    const head = `<thead><tr><th class="mx-rown">${lens === 'qs' ? '药品分类 \\ 研发阶段' : '注册分类 \\ 研发阶段'}</th>${phases.map(p => `<th>${p.icon}<br>${esc(p.name)}</th>`).join('')}</tr></thead>`;

    let body = '<tbody>';
    if (lens === 'qs') {
      // 行 = 9 类药品（按 KB_DATA 分类分组）
      KB_DATA.categories.forEach(cat => {
        const vs = cat.varieties || [];
        if (!vs.length) return;
        body += `<tr class="mx-cat-row"><th class="mx-cat-th" colspan="${phases.length + 1}">${cat.icon || ''} ${esc(cat.name)} <span class="mx-cat-sub">（${vs.length} 类）</span></th></tr>`;
        vs.forEach(v => {
          const regCat = vReg[v.id] || '';
          body += `<tr><th class="mx-rowhead"><span class="matrix-drug-icon">${v.icon || '●'}</span><span class="mx-rowname">${esc(v.name)}</span><button class="mx-gmp-btn" data-variety-gmp="${v.id}" title="查看${esc(v.name)}的 GMP 要求卡片（工艺流程图 + 共线/交叉污染评估）">🔬 GMP 卡片</button>${regCat ? `<span class="mx-regtag" data-regcat="${regCat}" title="查看对应注册分类">↗ ${regLabel[regCat]}</span>` : ''}</th>`;
          phases.forEach(p => {
            let txt = '';
            p.kbStages.forEach(sid => { if (v.stages && v.stages[sid] && v.stages[sid].summary) txt += (txt ? '\n' : '') + v.stages[sid].summary; });
            if (txt) {
              const plain = txt.length > 96 ? txt.substring(0, 96) + '…' : txt;
              body += `<td class="mx-cell" data-lens="qs" data-variety-id="${v.id}" data-stage-id="${p.clickStage}"><span class="matrix-cell-indicator ${p.level}"></span><div class="matrix-cell-text">${this.pen(plain)}</div></td>`;
            } else {
              body += `<td class="mx-cell empty"><span class="matrix-cell-text">—</span></td>`;
            }
          });
          body += '</tr>';
        });
      });
    } else {
      // 行 = 注册分类子类（按 DC 三大类分组）
      if (DC) {
        DC.categories.forEach(cat => {
          const groups = cat.groups || [{ name: '', items: cat.items || [] }];
          const flat = groups.flatMap(g => (g.items || []).map(it => ({ g: g.name, it })));
          body += `<tr class="mx-cat-row"><th class="mx-cat-th" colspan="${phases.length + 1}">${cat.icon} ${esc(cat.name)} <span class="mx-cat-sub">（${flat.length} 子类）</span></th></tr>`;
          flat.forEach(({ g, it }) => {
            const bullets = [].concat(it.special || [], it.considerations || [], it.dossier || []);
            const counts = {}; phases.forEach(p => counts[p.id] = 0);
            const firstByPhase = {};
            bullets.forEach(b => { const ph = this._classifyBulletToPhase(b); counts[ph] = (counts[ph] || 0) + 1; if (!firstByPhase[ph]) firstByPhase[ph] = b; });
            body += `<tr><th class="mx-rowhead"><span class="mx-rowcode">${esc(it.code)}</span><span class="mx-rowname">${esc(it.name)}</span>${g ? `<span class="mx-reggroup">${esc(g)}</span>` : ''}</th>`;
            phases.forEach(p => {
              const c = counts[p.id] || 0;
              if (c > 0) {
                const snip = firstByPhase[p.id] || '';
                const plain = snip.length > 60 ? snip.substring(0, 60) + '…' : snip;
                body += `<td class="mx-cell" data-lens="reg" data-cat="${cat.id}" data-code="${esc(it.code)}"><span class="matrix-cell-indicator red"></span><span class="mx-badge">${c}</span><div class="matrix-cell-text">${this.pen(plain)}</div></td>`;
              } else {
                body += `<td class="mx-cell empty"><span class="matrix-cell-text">—</span></td>`;
              }
            });
            body += '</tr>';
          });
        });
      } else {
        body += `<tr><td class="mx-cell empty" colspan="${phases.length + 1}">注册分类数据未加载</td></tr>`;
      }
    }
    body += '</tbody>';
    matrixEl.innerHTML = guide + lensBar + legend + `<div class="matrix-container"><table class="matrix-table mx-table">${head}${body}</table></div>`;

    // ---- 事件绑定 ----
    matrixEl.querySelectorAll('.mx-lens-btn').forEach(b => b.addEventListener('click', () => this.setMatrixLens(b.dataset.lens)));
    matrixEl.querySelectorAll('.mx-guide-chip[data-regcat]').forEach(c => c.addEventListener('click', () => this.openClassification(c.dataset.regcat)));
    matrixEl.querySelectorAll('.mx-guide-chip[data-variety]').forEach(c => c.addEventListener('click', () => { this.setMatrixLens('qs'); setTimeout(() => this.selectVariety(c.dataset.variety), 30); }));
    matrixEl.querySelectorAll('.mx-guide-btn[data-action="open-reg"]').forEach(b => b.addEventListener('click', () => this.openClassification()));
    matrixEl.querySelectorAll('.mx-guide-btn[data-action="open-qs"]').forEach(b => b.addEventListener('click', () => this.setMatrixLens('qs')));
    matrixEl.querySelectorAll('.mx-regtag').forEach(t => t.addEventListener('click', (e) => { e.stopPropagation(); this.openClassification(t.dataset.regcat); }));
    matrixEl.querySelectorAll('td[data-lens="qs"]').forEach(td => { td.style.cursor = 'pointer'; td.addEventListener('click', () => { this.selectVariety(td.dataset.varietyId); setTimeout(() => this.selectStage(td.dataset.stageId), 50); }); });
    matrixEl.querySelectorAll('td[data-lens="reg"]').forEach(td => { td.style.cursor = 'pointer'; td.addEventListener('click', () => this.openClassification(td.dataset.cat, td.dataset.code)); });
    matrixEl.querySelectorAll('[data-variety-gmp]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.openQSGmpCard(b.dataset.varietyGmp); }));
  },

  /* ============ 质量体系分类 · 品种 GMP 要求卡片（下钻） ============ */

  // 打开某品种的 GMP 要求卡片（典型工艺流程图 + 共线/交叉污染评估）
  openQSGmpCard(varietyId) {
    const v = this.findVarietyById(varietyId);
    if (!v) return;
    const detail = (globalThis.QS_GMP_DETAIL && QS_GMP_DETAIL[varietyId]) || {};
    if (this.state.regLibOpen) this._exitRegLib();
    this._exitClassViewIfOpen();
    this._exitPortalIfOpen();
    this.state.currentVarietyId = varietyId;
    this.state.currentCategoryId = v.categoryId || null;
    this.state.qsGmpOpen = true;
    this.hideDetailLayout();
    const el = document.getElementById('matrixView');
    if (!el) return;
    el.style.display = '';
    el.innerHTML = this._renderQSGmpCard(v, detail);
    const back = el.querySelector('[data-action="back-matrix"]');
    if (back) back.addEventListener('click', () => this.renderMatrixView());
    const am = el.querySelector('[data-action="open-stage-matrix"]');
    if (am) am.addEventListener('click', () => this.selectVariety(varietyId));
    el.querySelectorAll('.qs-gmp-item-header').forEach(h => {
      const toggle = () => { const item = h.closest('.qs-gmp-item'); if (item) item.classList.toggle('open'); };
      h.addEventListener('click', toggle);
      h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
  },

  // 渲染品种 GMP 要求卡片 HTML
  _renderQSGmpCard(v, detail) {
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cat = this.findCategoryById(v.categoryId);
    const appendix = detail.gmpAppendix || v.gmpAppendix || '—';
    const intro = detail.intro || v.description || '';
    const keyRisks = (v.keyRisks || []).map(esc).join('、') || '—';

    const gmpItems = (detail.gmpItems || []).map((it, i) => `
      <li class="qs-gmp-item">
        <div class="qs-gmp-item-header" role="button" tabindex="0" aria-expanded="false">
          <span class="qs-gmp-item-idx">${i + 1}</span>
          <span class="qs-gmp-item-text">${this.pen(it.text)}</span>
          <span class="qs-gmp-item-basis">${esc(it.basis || '')}</span>
          <span class="qs-gmp-item-toggle">▸</span>
        </div>
        <div class="qs-gmp-item-body">
          <div class="qs-gmp-item-detail">${this.pen(it.detail || '')}</div>
        </div>
      </li>`).join('');

    const flowSvg = (globalThis.QS_FLOW_SVG && detail.process) ? globalThis.QS_FLOW_SVG(detail.process.steps) : '';
    const flowNote = (detail.process && detail.process.note) ? `<p class="qs-gmp-flow-note">${this.pen(detail.process.note)}</p>` : '';

    const co = detail.coLine || { applicable: false };
    let coHtml = '';
    if (co.applicable) {
      const riskMap = { high: ['极高', 'qs-risk-high'], medium: ['中', 'qs-risk-med'], low: ['低', 'qs-risk-low'] };
      const rm = riskMap[co.risk] || riskMap.medium;
      const factors = (co.factors || []).map(f => `<li>${this.pen(f)}</li>`).join('');
      const strategy = (co.strategy || []).map(s => `<li>${this.pen(s)}</li>`).join('');
      const dedicated = (co.dedicated && co.dedicated.length)
        ? `<div class="qs-coline-dedicated"><span class="qs-coline-dedicated-label">⚠ 需专用设施 / 区域：</span><ul>${co.dedicated.map(d => `<li>${this.pen(d)}</li>`).join('')}</ul></div>`
        : '';
      coHtml = `
      <section class="qs-gmp-block qs-gmp-coline">
        <div class="qs-gmp-block-head">
          <h3>🧫 共线 / 交叉污染评估</h3>
          <span class="qs-risk-badge ${rm[1]}">风险等级：${rm[0]}</span>
        </div>
        <p class="qs-coline-summary">${this.pen(co.summary || '')}</p>
        <div class="qs-coline-cols">
          <div class="qs-coline-col">
            <div class="qs-coline-col-title">🔻 主要污染风险因素</div>
            <ul class="qs-coline-list">${factors}</ul>
          </div>
          <div class="qs-coline-col">
            <div class="qs-coline-col-title">🛡 控制策略</div>
            <ul class="qs-coline-list">${strategy}</ul>
          </div>
        </div>
        ${dedicated}
      </section>`;
    } else {
      coHtml = `<section class="qs-gmp-block qs-gmp-coline"><div class="qs-gmp-block-head"><h3>🧫 共线 / 交叉污染评估</h3></div><p class="qs-coline-summary">该品种共线生产的交叉污染风险较低，常规清洁验证与阶段性生产即可满足要求。</p></section>`;
    }

    const qms = detail.qmsFocus || [];
    let qmsHtml = '';
    if (qms.length) {
      const cards = qms.map(q => `
        <div class="qs-qms-card">
          <div class="qs-qms-area">${esc(q.area || '')}</div>
          <ul class="qs-qms-list">${(q.points || []).map(p => `<li>${this.pen(p)}</li>`).join('')}</ul>
        </div>`).join('');
      qmsHtml = `
      <section class="qs-gmp-block qs-gmp-qms">
        <div class="qs-gmp-block-head"><h3>🎯 质量管理关注要点</h3><span class="qs-qms-count">${qms.length} 个管理域</span></div>
        <div class="qs-qms-grid">${cards}</div>
      </section>`;
    }

    return `
    <div class="qs-gmp-card">
      <div class="qs-gmp-head">
        <button class="qs-gmp-back" data-action="back-matrix">← 返回质量体系矩阵</button>
        <div class="qs-gmp-titlerow">
          <span class="qs-gmp-icon" style="background:${v.color || '#1565C0'}">${v.icon || '●'}</span>
          <div>
            <div class="qs-gmp-title">${esc(v.name)} · GMP 要求卡片</div>
            <div class="qs-gmp-meta">GMP 依据：<b>${esc(appendix)}</b> ｜ 所属分类：${esc(cat ? cat.name : '')} ｜ 关键风险：${keyRisks}</div>
          </div>
        </div>
      </div>
      <p class="qs-gmp-intro">${this.pen(intro)}</p>
      <div class="qs-gmp-grid">
        <section class="qs-gmp-block qs-gmp-flow">
          <h3>🏭 典型工艺流程图</h3>
          <div class="qs-flow-wrap">${flowSvg}</div>
          ${flowNote}
        </section>
        <section class="qs-gmp-block qs-gmp-reqs">
          <h3>📋 GMP 符合性要点</h3>
          <ul class="qs-gmp-list">${gmpItems || '<li class="qs-gmp-empty">该品种 GMP 要求数据建设中</li>'}</ul>
        </section>
      </div>
      ${coHtml}
      ${qmsHtml}
      <div class="qs-gmp-actions">
        <button class="qs-gmp-act-btn" data-action="open-stage-matrix">查看「${esc(v.name)} × 各研发阶段」完整要求体系 →</button>
      </div>
    </div>`;
  },

  /* ============ 空状态 ============ */

  renderEmptyState() {
    const contentEl = document.getElementById('content');
    const breadcrumbEl = document.getElementById('breadcrumb');
    if (contentEl) {
      const varietyCount = this.getAllVarieties().length;
      contentEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💊</div>
          <div class="empty-state-title">海云AI · 药品研发生产 QA 专家</div>
          <div class="empty-state-desc">
            请从左侧选择药品品种（化药 / 生物药 / 中药 / 其他），或点击顶部"矩阵视图"按钮查看全览。<br>
            知识库覆盖 ${varietyCount} 个品种 × ${KB_DATA.stages.length} 个研发阶段的全生命周期质量体系要求。
          </div>
        </div>
      `;
    }
    if (breadcrumbEl) {
      breadcrumbEl.innerHTML = '<span class="breadcrumb-item">首页</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-item">请选择药品品种</span>';
    }
  },

  /* ============ 法规面板 ============ */

  renderRegulationPanel(variety, stage, stageData) {
    const panelBody = document.getElementById('regulationPanelBody');
    if (!panelBody) return;

    let html = '';

    if (stageData.domestic && stageData.domestic.regulations && stageData.domestic.regulations.length > 0) {
      html += '<div class="regulation-panel-group">';
      html += '<div class="regulation-panel-group-title">🇨🇳 国内法规</div>';
      html += '<div class="regulation-list">';
      stageData.domestic.regulations.forEach(reg => {
        html += `
          <a class="regulation-item" href="${reg.url}" target="_blank" rel="noopener noreferrer">
            <span class="regulation-item-icon">📄</span>
            <div class="regulation-item-info">
              <div class="regulation-item-title">${reg.title}</div>
              ${reg.path ? `<div class="regulation-item-path">${reg.path}</div>` : ''}
            </div>
            <span class="regulation-item-source">NMPA</span>
          </a>
        `;
      });
      html += '</div></div>';
    }

    if (stageData.international && stageData.international.regulations && stageData.international.regulations.length > 0) {
      html += '<div class="regulation-panel-group">';
      html += '<div class="regulation-panel-group-title">🌍 国际法规</div>';
      html += '<div class="regulation-list">';
      stageData.international.regulations.forEach(reg => {
        html += `
          <a class="regulation-item" href="${reg.url}" target="_blank" rel="noopener noreferrer">
            <span class="regulation-item-icon">📄</span>
            <div class="regulation-item-info">
              <div class="regulation-item-title">${reg.title}</div>
            </div>
            <span class="regulation-item-source">${reg.source || '国际'}</span>
          </a>
        `;
      });
      html += '</div></div>';
    }

    if (!html) html = '<div class="bookmark-empty">暂无相关法规链接</div>';
    panelBody.innerHTML = html;
  },

  toggleRegulationPanel() {
    const panel = document.getElementById('regulationPanel');
    if (!panel) return;
    panel.classList.toggle('visible');
  },

  /* ============ 临床前研究子板块（识林式穿透 + 6 板块） ============ */

  // 返回当前品种、当前子板块对象（无则返回 null → 显示总览）
  getCurrentPreSub(v) {
    const PS = globalThis.PRECLINICAL_SUBSECTIONS;
    if (!PS || !PS[v.id]) return null;
    const id = this.state.preSub;
    if (!id || id === 'overview') return null;
    return PS[v.id][id] || null;
  },

  // 子板块导航（总览 + CMC/药代/安全药理/毒理/制剂/IND）
  renderPreclinicalSubNav(v) {
    const PS = globalThis.PRECLINICAL_SUBSECTIONS;
    if (!PS || !PS[v.id]) return '';
    const cur = this.state.preSub || 'overview';
    const tabs = [{ id: 'overview', name: '总览', icon: '📊' }]
      .concat(['cmc', 'pk', 'safety', 'tox', 'formulation', 'ind'].map(sid => ({
        id: sid, name: PS[v.id][sid].name, icon: PS[v.id][sid].icon
      })));
    return `<div class="pre-subnav">` +
      tabs.map(t => `<button class="pre-subtab ${t.id === cur ? 'active' : ''}" data-sub="${t.id}" title="${t.name}">${t.icon} ${t.name}</button>`).join('') +
      `</div>`;
  },

  // 渲染单个子板块（三重点 + 国内/国际/指导/案例/陷阱）
  renderPreclinicalBoard(board) {
    let html = '';
    if (board.summary) {
      html += `<div class="detail-summary pre-board-summary">${this.pen(board.summary)}</div>`;
    }
    html += this.renderQualityMgmtSection('process_focus', '🔬', board.colTitles[0] || '工艺研究重点', board.process_focus, 'focus-process');
    html += this.renderQualityMgmtSection('quality_focus', '🔍', board.colTitles[1] || '质量研究重点', board.quality_focus, 'focus-quality');
    html += this.renderQualityMgmtSection('quality_mgmt', '📋', board.colTitles[2] || '质量管理要求', board.quality_mgmt, 'focus-mgmt');
    html += this.renderSectionDomestic(board.domestic);
    html += this.renderSectionInternational(board.international);
    html += this.renderSectionGuidance(board.guidance);
    html += this.renderSectionCases(board.cases);
    html += this.renderSectionPitfalls(board.pitfalls);
    return html;
  },

  /* ============ 药品分类布局（化药/生物制品/中药 三大类） ============ */

  // 若当前处于分类视图，退出以回到常规知识库视图
  _exitClassViewIfOpen() {
    if (this.state.view === 'classification') {
      this.state.view = 'kb';
      this.state.currentReqCat = null;
      this.state.currentReqCode = '';
      const btn = document.getElementById('classifyBtn');
      if (btn) btn.classList.remove('active');
      ['breadcrumb', 'stageTabs', 'detailLayout'].forEach(id => {
        const e = document.getElementById(id); if (e) e.style.display = '';
      });
    }
  },

  openClassification(focusCat, focusCode) {
    if (this.state.regLibOpen) this._exitRegLib();
    this._exitPortalIfOpen();
    this.state.view = 'classification';
    this.state.classLens = 'reg';
    this.state.classProdForm = null;
    ['breadcrumb', 'stageTabs', 'matrixView'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    const dl = document.getElementById('detailLayout'); if (dl) dl.style.display = '';
    const c = document.getElementById('content');
    if (c) {
      c.innerHTML = this.renderDrugClassification(focusCat, focusCode);
      const sc = c.parentElement; if (sc) sc.scrollTop = 0;
      this._bindClassification(c);
      if (focusCat) {
        const el = c.querySelector('.class-sub[data-cat="' + focusCat + '"][data-code="' + (focusCode || '') + '"]');
        const catEl = focusCode ? el : c.querySelector('.class-cat.cat-' + focusCat);
        const target = el || catEl;
        if (target) {
          if (target.classList.contains('class-sub')) target.classList.add('open', 'focus');
          const sc2 = c.parentElement;
          if (sc2) sc2.scrollTop = target.offsetTop - 12;
        }
      }
    }
    const btn = document.getElementById('classifyBtn');
    if (btn) btn.classList.add('active');
  },

  /* 重新渲染药品分类视图（镜头切换 / 产品类型下钻时复用，不丢失镜头状态） */
  _repaintClassification() {
    const c = document.getElementById('content');
    if (!c) return;
    c.innerHTML = this.renderDrugClassification();
    const sc = c.parentElement; if (sc) sc.scrollTop = 0;
    this._bindClassification(c);
  },

  /* 药品分类视图事件绑定（数据属性驱动） */
  _bindClassification(c) {
    c.querySelectorAll('.cls-lens-btn').forEach(b => b.addEventListener('click', () => {
      const lens = b.dataset.clsLens;
      this.state.classLens = lens;
      this.state.classProdForm = null;
      this.state.classProdRoute = null;
      this._repaintClassification();
    }));
    c.querySelectorAll('[data-cls-prod-jump]').forEach(b => b.addEventListener('click', () => {
      this.state.classLens = 'prod';
      this.state.classProdForm = null;
      this._repaintClassification();
    }));
    c.querySelectorAll('[data-cls-lens-jump]').forEach(b => b.addEventListener('click', () => {
      this.state.classLens = b.dataset.clsLensJump;
      this.state.classProdForm = null;
      this.state.classProdRoute = null;
      this._repaintClassification();
    }));
    c.querySelectorAll('[data-cls-qs-jump]').forEach(b => b.addEventListener('click', () => {
      this.openMatrixView();
    }));
    c.querySelectorAll('[data-cls-req-jump]').forEach(b => b.addEventListener('click', () => {
      this.openClassReq(b.dataset.clsReqJump || 'chemo', '');
    }));
    c.querySelectorAll('[data-cls-prod-entry]').forEach(card => card.addEventListener('click', () => {
      this.state.classLens = 'prod';
      this.state.classProdForm = card.dataset.clsProdEntry;
      this._repaintClassification();
    }));
    c.querySelectorAll('[data-cls-prod-back]').forEach(b => b.addEventListener('click', () => {
      this.state.classProdForm = null;
      this._repaintClassification();
    }));
    c.querySelectorAll('[data-cls-route]').forEach(chip => chip.addEventListener('click', () => {
      const rid = chip.dataset.clsRoute;
      this.state.classProdRoute = (rid === '__all__') ? null : rid;
      this._repaintClassification();
    }));
    c.querySelectorAll('[data-open-req]').forEach(btn => btn.addEventListener('click', () => {
      const parts = btn.dataset.openReq.split('::');
      this.openClassReq(parts[0], parts[1] || '');
    }));
    c.querySelectorAll('.class-sub-head').forEach(h => h.addEventListener('click', () => {
      const sub = h.closest('.class-sub');
      if (sub) this.openClassReq(sub.dataset.cat, sub.dataset.code || '');
    }));
    c.querySelectorAll('.class-sub .reg-link').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      if (a.dataset.rid) this.openRegulation(a.dataset.rid);
    }));
    c.querySelectorAll('.class-back-btn').forEach(b => b.addEventListener('click', () => this.openMatrixView()));
  },

  closeClassification() {
    this.state.view = 'kb';
    const btn = document.getElementById('classifyBtn');
    if (btn) btn.classList.remove('active');
    ['breadcrumb', 'stageTabs'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = '';
    });
    const dl = document.getElementById('detailLayout'); if (dl) dl.style.display = '';
    this.renderEmptyState();
  },

  /* ============ 研发要求体系（合并导航的深度视图） ============ */

  openClassReq(mainClass, subCode) {
    if (this.state.regLibOpen) this._exitRegLib();
    if (this.state.view !== 'classification') this._exitClassViewIfOpen();
    this._exitPortalIfOpen();
    this.state.view = 'classification';
    this.state.currentReqCat = mainClass;
    this.state.currentReqCode = subCode || '';
    this.state.currentVarietyId = null;
    ['breadcrumb', 'stageTabs', 'matrixView'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    const dl = document.getElementById('detailLayout'); if (dl) dl.style.display = '';
    const c = document.getElementById('content');
    if (c) {
      c.innerHTML = this.renderClassReqView(mainClass, subCode || '');
      const sc = c.parentElement; if (sc) sc.scrollTop = 0;
      c.querySelectorAll('.reg-link').forEach(a => a.addEventListener('click', (e) => {
        e.preventDefault();
        if (a.dataset.rid) this.openRegulation(a.dataset.rid);
      }));
    }
    const btn = document.getElementById('classifyBtn');
    if (btn) btn.classList.add('active');
    this.renderSidebar();
  },

  renderClassReqView(mainClass, subCode) {
    const CR = globalThis.CLASS_REQUIREMENTS;
    if (!CR || !CR.mains[mainClass]) return '<div class="bookmark-empty">研发要求数据未加载</div>';
    const main = CR.mains[mainClass];
    const isSpecial = !!(subCode && CR.specials[mainClass] && CR.specials[mainClass][subCode]);
    const sp = isSpecial ? CR.specials[mainClass][subCode] : null;
    const regSub = (!isSpecial && subCode) ? this.findClassSub(mainClass, subCode) : null;

    const MAIN_ICON = { chemo: '💊', bio: '🧬', tcm: '🌿' };
    const scope = subCode ? (sp ? sp.subName : (regSub ? regSub.name : subCode)) : (main.name + ' · 全部研发要求');

    let html = '<div class="req-view">';
    html += '<div class="req-header">';
    html += '<h1 class="req-title">' + MAIN_ICON[mainClass] + ' ' + this.pen(scope) + '</h1>';
    if (isSpecial) html += '<span class="req-scope-badge diff">特殊品种 · 与主类差异已高亮标注</span>';
    else if (regSub) html += '<span class="req-scope-badge reg">注册分类</span>';
    html += '<div class="req-sub">覆盖全部研发阶段，按「药品研发 / 生产相关工艺研究 / 质量研究 / 质量管理」四维度给出要求（⚠）与实施技巧（🛠）；每个维度另附「质量研究 / 工艺基准」与「实施要点」。</div>';
    if (!subCode) html += '<button class="req-ic-btn" data-ic="' + mainClass + '">📖 查看「' + this._esc(main.name) + '」整体研发案例 →</button>';
    html += '</div>';

    if (regSub) html += this.renderClassSubSummary(regSub);
    if (subCode) html += this.renderSubClassDetail(mainClass, subCode);
    if (isSpecial) {
      const ovStages = Object.keys(sp.override || {});
      const extra = (sp.extraStages || []).map(e => e.name);
      html += '<div class="req-special-note">本特殊品种在以下阶段 / 维度相对主类存在差异化要求（正文中以高亮标注）：'
        + (ovStages.length ? this._esc(ovStages.join('、')) : '通用要求')
        + (extra.length ? '；特有阶段：' + this._esc(extra.join('、')) : '') + '。</div>';
    }

    CR.stages.forEach(st => {
      html += this.renderReqStage(mainClass, subCode, st.id, st.name);
    });
    if (isSpecial && sp.extraStages) {
      sp.extraStages.forEach(es => {
        html += '<section class="req-stage">';
        html += '<div class="req-stage-head"><span class="req-stage-name">' + this.pen(es.name) + '</span><span class="req-stage-tag extra">特有阶段</span></div>';
        html += '<div class="req-dims">';
        CR.dims.forEach(d => {
          const ed = (es.dims && es.dims[d.id]) || {};
          html += this.renderReqDim(d, { requirement: ed.requirement || [], technique: ed.technique || [], special: false, extra: true });
        });
        html += '</div></section>';
      });
    }
    html += '</div>';
    return html;
  },

  renderReqStage(mainClass, subCode, stageId, stageName) {
    const CR = globalThis.CLASS_REQUIREMENTS;
    const layout = (CR && CR.stageDims && CR.stageDims[stageId]) || (CR.dims.map(d => d.id));
    if (layout === 'steps') {
      if (stageId === 'preclinical') return this.renderPreclinicalSteps(mainClass, subCode, stageId, stageName);
      return this.renderDiscoverySteps(mainClass, subCode, stageId, stageName);
    }
    let html = '<section class="req-stage">';
    html += '<div class="req-stage-head"><span class="req-stage-name">' + this.pen(stageName) + '</span></div>';
    html += '<div class="req-dims">';
    const DET = (globalThis.CLASS_REQ_DETAIL && globalThis.CLASS_REQ_DETAIL[mainClass] && globalThis.CLASS_REQ_DETAIL[mainClass][stageId]) || null;
    layout.forEach(dimId => {
      const d = CR.dims.find(x => x.id === dimId);
      if (!d) return;
      const detailCell = DET ? DET[dimId] : null;
      html += this.renderReqDim(d, this.getReqCell(mainClass, subCode, stageId, dimId), detailCell);
    });
    html += '</div></section>';
    return html;
  },

  renderReqStepCard(st, idx) {
    let h = '<div class="req-substep">';
    h += '<div class="req-substep-head"><span class="req-substep-idx">' + idx + '</span>'
      + '<span class="req-substep-name">' + this.pen(st.name) + '</span></div>';
    if (st.desc) h += '<div class="req-substep-desc">' + this.pen(st.desc) + '</div>';
    h += '<div class="req-block"><div class="req-block-title req">⚠ 要求</div><ul class="req-list req-list-req">';
    (st.requirement || []).forEach(s => h += '<li>' + this.pen(s) + '</li>');
    h += '</ul></div>';
    h += '<div class="req-block"><div class="req-block-title tech">🛠 实施技巧</div><ul class="req-list req-list-tech">';
    (st.technique || []).forEach(s => h += '<li>' + this.pen(s) + '</li>');
    h += '</ul></div>';
    if (st.sub && st.sub.length) {
      h += '<div class="req-subsub">';
      st.sub.forEach((ss, j) => {
        h += '<div class="req-subsub-card">';
        h += '<div class="req-subsub-head"><span class="req-subsub-idx">' + (j + 1) + '</span>'
          + '<span class="req-subsub-name">' + this.pen(ss.name) + '</span></div>';
        if (ss.desc) h += '<div class="req-subsub-desc">' + this.pen(ss.desc) + '</div>';
        h += '<div class="req-block"><div class="req-block-title req">⚠ 要求</div><ul class="req-list req-list-req">';
        (ss.requirement || []).forEach(s => h += '<li>' + this.pen(s) + '</li>');
        h += '</ul></div>';
        h += '<div class="req-block"><div class="req-block-title tech">🛠 实施技巧</div><ul class="req-list req-list-tech">';
        (ss.technique || []).forEach(s => h += '<li>' + this.pen(s) + '</li>');
        h += '</ul></div>';
        h += '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  },

  renderStageQmBlock(mainClass, stageId) {
    const QM = (globalThis.STAGE_QM && globalThis.STAGE_QM[mainClass] && globalThis.STAGE_QM[mainClass][stageId]) || null;
    if (!QM || ((!QM.requirement || QM.requirement.length === 0) && (!QM.technique || QM.technique.length === 0))) return '';
    let h = '<div class="req-qm-block">';
    h += '<div class="req-qm-head">📋 质量管理要点</div>';
    h += '<div class="req-block"><div class="req-block-title req">⚠ 要求</div><ul class="req-list req-list-req">';
    (QM.requirement || []).forEach(s => h += '<li>' + this.pen(s) + '</li>');
    h += '</ul></div>';
    h += '<div class="req-block"><div class="req-block-title tech">🛠 实施技巧</div><ul class="req-list req-list-tech">';
    (QM.technique || []).forEach(s => h += '<li>' + this.pen(s) + '</li>');
    h += '</ul></div>';
    h += '</div>';
    return h;
  },

  renderDiscoverySteps(mainClass, subCode, stageId, stageName) {
    const DS = globalThis.DISCOVERY_STEPS;
    const steps = (DS && DS[mainClass]) || [];
    let html = '<section class="req-stage req-stage-steps">';
    html += '<div class="req-stage-head"><span class="req-stage-name">' + this.pen(stageName) + '</span>'
      + '<span class="req-stage-tag steps">按研究步骤细分</span></div>';
    html += '<div class="req-substeps">';
    steps.forEach((st, i) => { html += this.renderReqStepCard(st, i + 1); });
    html += '</div>';
    const qm = this.renderStageQmBlock(mainClass, 'discovery');
    if (qm) html += qm;
    html += '</section>';
    return html;
  },

  renderPreclinicalSteps(mainClass, subCode, stageId, stageName) {
    const PS = globalThis.PRECLINICAL_STEPS;
    const steps = (PS && PS[mainClass]) || [];
    let html = '<section class="req-stage req-stage-steps">';
    html += '<div class="req-stage-head"><span class="req-stage-name">' + this.pen(stageName) + '</span>'
      + '<span class="req-stage-tag steps">按研究模块细分（CMC / 药代 / 安全药理 / 毒理 / 制剂 / IND，IND 进一步拆为 CMC包 / 非临床包 / 沟通会议）</span></div>';
    html += '<div class="req-substeps">';
    steps.forEach((st, i) => { html += this.renderReqStepCard(st, i + 1); });
    html += '</div>';
    const qm = this.renderStageQmBlock(mainClass, 'preclinical');
    if (qm) html += qm;
    html += '</section>';
    return html;
  },

  getReqCell(mainClass, subCode, stage, dim) {
    const CR = globalThis.CLASS_REQUIREMENTS;
    const main = CR.mains[mainClass];
    const base = (main.matrix[stage] && main.matrix[stage][dim]) || { requirement: [], technique: [] };
    // 工艺研究补充：部分阶段原先未含"生产相关工艺研究"，依据 NMPA/ICH 全生命周期要求补充
    const ADD = (globalThis.CLASS_REQ_PROCESS && globalThis.CLASS_REQ_PROCESS[mainClass] && globalThis.CLASS_REQ_PROCESS[mainClass][stage] && globalThis.CLASS_REQ_PROCESS[mainClass][stage][dim]) || null;
    let src = base;
    if ((!base.requirement || base.requirement.length === 0) && (!base.technique || base.technique.length === 0) && ADD) {
      src = ADD;
    }
    if (subCode && CR.specials[mainClass] && CR.specials[mainClass][subCode]) {
      const ov = CR.specials[mainClass][subCode].override || {};
      if (ov[stage] && ov[stage][dim]) {
        const o = ov[stage][dim];
        return {
          requirement: (o.requirement && o.requirement.length) ? o.requirement : base.requirement,
          technique: (o.technique && o.technique.length) ? o.technique : base.technique,
          note: o.note || '',
          special: true
        };
      }
    }
    return { requirement: src.requirement, technique: src.technique, special: false };
  },

  renderReqDim(d, cell, detailCell) {
    let html = '<div class="req-dim' + (cell.special ? ' req-dim-diff' : '') + (cell.extra ? ' req-dim-extra' : '') + '">';
    html += '<div class="req-dim-head"><span class="req-dim-name">' + this.pen(d.name) + '</span></div>';
    html += '<div class="req-block"><div class="req-block-title req">⚠ 要求</div><ul class="req-list req-list-req">';
    (cell.requirement || []).forEach(s => html += '<li>' + this.pen(s) + '</li>');
    html += '</ul></div>';
    html += '<div class="req-block"><div class="req-block-title tech">🛠 实施技巧</div><ul class="req-list req-list-tech">';
    (cell.technique || []).forEach(s => html += '<li>' + this.pen(s) + '</li>');
    html += '</ul></div>';
    if (detailCell) {
      if (detailCell.benchmarks && detailCell.benchmarks.length) {
        html += '<div class="req-block req-bench"><div class="req-block-title bench">📐 质量研究 / 工艺基准</div><ul class="req-list req-list-bench">';
        detailCell.benchmarks.forEach(b => html += '<li>' + this.pen(b) + '</li>');
        html += '</ul></div>';
      }
      if (detailCell.keyPoints && detailCell.keyPoints.length) {
        html += '<div class="req-block req-kp"><div class="req-block-title kp">🎯 实施要点</div><ul class="req-list req-list-kp">';
        detailCell.keyPoints.forEach(k => html += '<li>' + this.pen(k) + '</li>');
        html += '</ul></div>';
      }
      if (detailCell.diagram) html += this.renderDiagram(detailCell.diagram);
    }
    if (cell.special && cell.note) html += '<div class="req-diff-note">↳ 与主类差异：' + this.pen(cell.note) + '</div>';
    html += '</div>';
    return html;
  },

  renderClassSubSummary(sub) {
    let html = '<div class="req-regsum">';
    html += '<div class="req-regsum-title">📋 注册分类特殊要求（NMPA 2020）</div>';
    if (sub.desc) html += '<div class="req-regsum-desc">' + this.pen(sub.desc) + '</div>';
    if (sub.special && sub.special.length) {
      html += '<div class="class-block"><div class="class-block-title req">⚠ 特殊要求</div><ul class="class-list req-list">';
      sub.special.forEach(s => html += '<li>' + this.pen(s) + '</li>');
      html += '</ul></div>';
    }
    if (sub.considerations && sub.considerations.length) {
      html += '<div class="class-block"><div class="class-block-title cons">💡 考量</div><ul class="class-list cons-list">';
      sub.considerations.forEach(s => html += '<li>' + this.pen(s) + '</li>');
      html += '</ul></div>';
    }
    if (sub.dossier && sub.dossier.length) {
      html += '<div class="class-block"><div class="class-block-title dos">📑 申报资料要求</div><ul class="class-list dos-list">';
      sub.dossier.forEach(s => html += '<li>' + this.pen(s) + '</li>');
      html += '</ul></div>';
    }
    if (sub.regs && sub.regs.length) {
      html += '<div class="class-block"><div class="class-block-title reg">🔗 关联法规原文</div><div class="regulation-list">';
      sub.regs.forEach(rid => {
        const reg = this.findRegById(rid);
        if (!reg) return;
        html += '<div class="regulation-item reg-link" data-rid="' + reg.id + '" title="点击进入法规原文库">'
          + '<span class="regulation-item-icon">📄</span>'
          + '<div class="regulation-item-info"><div class="regulation-item-title">' + this.pen(reg.title) + '</div></div>'
          + '<span class="regulation-item-source">' + (reg.issuer || '法规') + '</span>'
          + '<span class="regulation-item-external">↗</span></div>';
      });
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  },

  renderSubClassDetail(mainClass, subCode) {
    const SCD = globalThis.SUBCLASS_DETAIL;
    if (!SCD || !SCD[mainClass]) return '';
    // 注册分类树使用带点的编码(如 2.1)，而子分类详情键使用下划线(2_1)，做兼容归一
    const key = (subCode || '').replace(/\./g, '_');
    const sc = SCD[mainClass][subCode] || SCD[mainClass][key];
    if (!sc) return '';
    const CR = globalThis.CLASS_REQUIREMENTS;
    const stageName = id => {
      const s = (CR && CR.stages) ? CR.stages.find(x => x.id === id) : null;
      return s ? s.name : id;
    };
    let html = '<div class="scd">';

    if (sc.terms && sc.terms.length) {
      html += '<section class="scd-block scd-terms">';
      html += '<div class="scd-block-title">📖 关键术语</div>';
      html += '<div class="scd-terms-grid">';
      sc.terms.forEach(t => {
        html += '<div class="scd-term"><span class="scd-term-t">' + this.pen(t.t) + '</span>'
          + '<span class="scd-term-d">' + this.pen(t.d) + '</span></div>';
      });
      html += '</div></section>';
    }

    if (sc.diff) {
      html += '<section class="scd-block scd-diff">';
      html += '<div class="scd-block-title">🔀 与主类研发要求差异</div>';
      html += '<div class="scd-diff-desc">' + this.pen(sc.diff) + '</div>';
      html += '</section>';
    }

    if (sc.stageCases) {
      const order = (CR && CR.stages) ? CR.stages.map(s => s.id)
        : ['discovery', 'preclinical', 'clinical', 'nda', 'commercial', 'postmarket'];
      const stageKeys = order.filter(id => sc.stageCases[id] && sc.stageCases[id].length);
      if (stageKeys.length) {
        html += '<section class="scd-block scd-stages">';
        html += '<div class="scd-block-title">🧪 各阶段研发实施案例</div>';
        stageKeys.forEach(sid => {
          html += '<div class="scd-stage">';
          html += '<div class="scd-stage-name">' + this.pen(stageName(sid)) + '</div>';
          html += '<ul class="scd-case-list">';
          sc.stageCases[sid].forEach(c => {
            html += '<li class="scd-case"><span class="scd-case-title">' + this.pen(c.title) + '</span>';
            if (c.desc) html += '<span class="scd-case-desc">' + this.pen(c.desc) + '</span>';
            html += '</li>';
          });
          html += '</ul></div>';
        });
        html += '</section>';
      }
    }

    html += '</div>';
    return html;
  },

  renderDrugClassification(focusCat, focusCode) {
    const DC = globalThis.DRUG_CLASSIFICATION;
    if (!DC) return '<div class="bookmark-empty">药品分类数据未加载</div>';

    let html = '<div class="class-view">';
    html += '<div class="class-header">';
    html += '<h1 class="class-title">🗂️ ' + this.pen(DC.meta.title) + ' · 体系整合视图</h1>';
    html += '<div class="class-meta">依据：' + this.pen(DC.meta.basis) + '</div>';
    html += '<div class="class-note">' + this.pen(DC.meta.note) + '</div>';
    html += '<button class="class-back-btn" data-action="matrix" title="返回整合后的药品分类矩阵">← 返回分类矩阵</button>';
    html += '</div>';

    /* 三镜头切换条 */
    const lens = this.state.classLens || 'reg';
    html += '<div class="cls-lens-bar">';
    html += '<span class="cls-lens-label">分类视角：</span>';
    html += '<button class="cls-lens-btn' + (lens === 'map' ? ' active' : '') + '" data-cls-lens="map">🗺️ 分类地图（体系总览）</button>';
    html += '<button class="cls-lens-btn' + (lens === 'reg' ? ' active' : '') + '" data-cls-lens="reg">📋 按注册分类（化药/生物/中药）</button>';
    html += '<button class="cls-lens-btn' + (lens === 'prod' ? ' active' : '') + '" data-cls-lens="prod">🏭 按产品分类 · 生产工艺</button>';
    html += '<span class="cls-lens-hint">四套体系互通：注册分类定申报路径，产品分类×生产工艺定 GMP 符合性，质量体系分类定品种合规，研发要求体系定各阶段技术门槛。</span>';
    html += '</div>';

    if (lens === 'map') {
      html += this._renderClassMapLens();
    } else if (lens === 'prod') {
      html += this._renderClassProductLens();
    } else {
      html += this._renderClassRegLens(DC, focusCat, focusCode);
    }

    html += '</div>';
    return html;
  },

  /* ---- 镜头零：分类地图（四体系互通总览） ---- */
  _renderClassMapLens() {
    let html = '<div class="cls-map">';
    html += '<div class="cls-map-tip">🗺️ 四类药品分类体系相互关联，可点击下方任一体系卡片进入对应视图。横轴为「申报路径 → 生产合规 → 品种合规 → 研发门槛」的逻辑链路。</div>';

    html += '<div class="cls-map-flow">';
    html += '<div class="cls-map-node cls-map-reg" data-cls-lens-jump="reg">';
    html += '<div class="cls-map-node-ico">📋</div><div class="cls-map-node-title">注册分类</div>';
    html += '<div class="cls-map-node-sub">化药 1~5 类 · 生物制品 T1~T4/单抗/ADC · 中药 1~4 类</div>';
    html += '<div class="cls-map-node-desc">决定「怎么申报、走哪条路径、交什么资料」</div></div>';
    html += '<div class="cls-map-arrow">→</div>';

    html += '<div class="cls-map-node cls-map-prod" data-cls-lens-jump="prod">';
    html += '<div class="cls-map-node-ico">🏭</div><div class="cls-map-node-title">产品分类 · 生产工艺</div>';
    html += '<div class="cls-map-node-sub">原料药/片剂/注射/冻干 · 单抗/疫苗/CGT/血液 · 饮片/提取 · 放射性</div>';
    html += '<div class="cls-map-node-desc">决定「怎么生产、工艺与质控怎么控、适用哪类 GMP」</div></div>';
    html += '<div class="cls-map-arrow">→</div>';

    html += '<div class="cls-map-node cls-map-qs" data-cls-qs-jump="1">';
    html += '<div class="cls-map-node-ico">🛡️</div><div class="cls-map-node-title">质量体系分类</div>';
    html += '<div class="cls-map-node-sub">无菌/原料药/生物/血液/中药/气体/放射性/细胞基因 等 9 类</div>';
    html += '<div class="cls-map-node-desc">决定「品种合规边界与质量体系归属」（见矩阵视图）</div></div>';
    html += '<div class="cls-map-arrow">→</div>';

    html += '<div class="cls-map-node cls-map-req" data-cls-req-jump="chemo">';
    html += '<div class="cls-map-node-ico">📐</div><div class="cls-map-node-title">研发要求体系</div>';
    html += '<div class="cls-map-node-sub">化学药 / 生物制品 / 中药 三大主线 × 6 阶段 × 4 维度</div>';
    html += '<div class="cls-map-node-desc">决定「各研发阶段工艺/质量/质量管理门槛」</div></div>';
    html += '</div>';

    /* 四体系 → 具体类型 的快捷入口网格 */
    html += '<div class="cls-map-legend">💡 进入任一体系后，均可下钻到「具体药品类型」并查看其<strong>生产工艺（工序/CPP/CQA/中控）</strong>与<strong>质量控制要点</strong>。</div>';

    html += '<div class="cls-map-grid">';
    const MK = globalThis.MANUFACTURE_KB || {};
    const CLASSES = MK.CLASSES || [];
    CLASSES.forEach(cl => {
      let entries = (MK.ENTRIES || []).filter(x => x.cls === cl.id);
      if (cl.id === 'chem') {
        const radio = (MK.ENTRIES || []).find(x => x.id === 'radio-syn');
        if (radio) entries = entries.concat([Object.assign({}, radio, { _radioTag: true })]);
      }
      html += '<div class="cls-map-group">';
      html += '<div class="cls-map-group-head"><span class="cls-map-group-ico">' + cl.icon + '</span>' + this.pen(cl.name) + '</div>';
      html += '<div class="cls-map-chips">';
      entries.forEach(e => {
        html += '<button class="cls-map-chip" data-cls-prod-entry="' + e.id + '">' + this.pen(e.name)
          + (e._radioTag ? ' ☢️' : '') + '</button>';
      });
      html += '</div></div>';
    });
    html += '</div>';

    html += '</div>';
    return html;
  },

  /* ---- 镜头一：按注册分类（化药/生物/中药 子类 + 特殊要求/考量/申报资料/法规） ---- */
  _renderClassRegLens(DC, focusCat, focusCode) {
    let html = '<div class="cls-reg-lens">';
    html += '<div class="cls-lens-tip">📋 按国家药监局 2020 年注册分类梳理：每一子类给出<strong>特殊要求 / 考量 / 申报资料清单 / 关联法规</strong>；点击子类标题可下钻「研发要求体系」（各阶段工艺·质量·GMP）。右下「🏭 查看生产工艺」可跳到产品分类视角看对应生产工艺。</div>';
    DC.categories.forEach(cat => {
      html += '<section class="class-cat cat-' + cat.accent + '">';
      html += '<div class="class-cat-head">';
      html += '<span class="class-cat-icon">' + cat.icon + '</span>';
      html += '<div class="class-cat-titles"><h2>' + this.pen(cat.name) + '</h2>';
      html += '<span class="class-cat-en">' + this.pen(cat.enName) + '</span></div>';
      html += '</div>';
      html += '<p class="class-cat-desc">' + this.pen(cat.desc) + '</p>';

      const groups = cat.groups || [{ name: '', items: cat.items || [] }];
      groups.forEach(g => {
        if (g.name) html += '<div class="class-group-title">' + this.pen(g.name) + '</div>';
        html += '<div class="class-subs">';
        (g.items || []).forEach(sub => {
          const isOpen = (focusCode && sub.code === focusCode) ? ' open focus' : '';
          html += '<div class="class-sub' + isOpen + '" data-cat="' + cat.id + '" data-code="' + sub.code + '">';
          html += '<div class="class-sub-head">';
          html += '<span class="class-sub-code">' + this.pen(sub.code) + '</span>';
          html += '<span class="class-sub-name">' + this.pen(sub.name) + '</span>';
          html += '<span class="class-sub-toggle">▼</span>';
          html += '</div>';
          if (sub.desc) html += '<div class="class-sub-desc">' + this.pen(sub.desc) + '</div>';
          html += '<div class="class-sub-body">';
          if (sub.special && sub.special.length) {
            html += '<div class="class-block">';
            html += '<div class="class-block-title req">⚠ 特殊要求</div>';
            html += '<ul class="class-list req-list">';
            sub.special.forEach(s => { html += '<li>' + this.pen(s) + '</li>'; });
            html += '</ul></div>';
          }
          if (sub.considerations && sub.considerations.length) {
            html += '<div class="class-block">';
            html += '<div class="class-block-title cons">💡 考量</div>';
            html += '<ul class="class-list cons-list">';
            sub.considerations.forEach(s => { html += '<li>' + this.pen(s) + '</li>'; });
            html += '</ul></div>';
          }
          if (sub.dossier && sub.dossier.length) {
            html += '<div class="class-block">';
            html += '<div class="class-block-title dos">📑 申报资料要求清单</div>';
            html += '<ul class="class-list dos-list">';
            sub.dossier.forEach(s => { html += '<li>' + this.pen(s) + '</li>'; });
            html += '</ul></div>';
          }
          if (sub.regs && sub.regs.length) {
            html += '<div class="class-block">';
            html += '<div class="class-block-title reg">🔗 关联法规原文</div>';
            html += '<div class="regulation-list">';
            sub.regs.forEach(rid => {
              const reg = (globalThis.REG_INDEX || []).find(r => r.id === rid);
              if (!reg) return;
              html += '<div class="regulation-item reg-link" data-rid="' + reg.id + '" title="点击进入法规原文库">'
                + '<span class="regulation-item-icon">📄</span>'
                + '<div class="regulation-item-info"><div class="regulation-item-title">' + this.pen(reg.title) + '</div></div>'
                + '<span class="regulation-item-source">' + (reg.issuer || '法规') + '</span>'
                + '<span class="regulation-item-external">↗</span></div>';
            });
            html += '</div></div>';
          }
          html += '<div class="class-sub-foot">';
          html += '<button class="cls-prod-jump" data-cls-prod-jump="' + cat.id + '">🏭 按产品分类查看生产工艺 →</button>';
          html += '</div>';
          html += '</div></div>';
        });
        html += '</div>';
      });
      html += '</section>';
    });
    html += '</div>';
    return html;
  },

  /* 产品类型 → 研发要求体系节点映射（id → [主类, 特殊品种code]） */
  _entryReqRef(e) {
    const MAP = {
      'chem-api-synth': ['chemo', 'api'], 'chem-api-ferment': ['chemo', 'api'], 'chemo-cm': ['chemo', 'api'],
      'chemo-solid-tablet': ['chemo', 'oral'], 'chemo-solid-capsule': ['chemo', 'oral'], 'chemo-solid-granule': ['chemo', 'oral'],
      'chemo-liq-oral': ['chemo', null], 'chemo-inj-solution': ['chemo', 'sterile'], 'chemo-inj-freeze': ['chemo', 'sterile'],
      'chemo-semi-ointment': ['chemo', null], 'radio-syn': ['chemo', 'radio'],
      'bio-mab': ['bio', 'mab'], 'bio-bsab': ['bio', 'mab'], 'bio-adc': ['bio', 'adc'],
      'bio-recombin': ['bio', 'recombin'], 'bio-vaccine': ['bio', 'vaccine'], 'bio-cgt': ['bio', 'cell'], 'bio-blood': ['bio', 'blood'],
      'tcm-decoction': ['tcm', 'tcm-slice'], 'tcm-extract': ['tcm', 'tcm-prep'], 'tcm-gran': ['tcm', 'tcm-prep'],
      'tcm-inj': ['tcm', null], 'tcm-ferment': ['tcm', null]
    };
    const ref = MAP[e.id];
    if (ref) return { mainClass: ref[0], subCode: ref[1] };
    const clsMap = { chem: 'chemo', bio: 'bio', tcm: 'tcm', radio: 'chemo' };
    return { mainClass: clsMap[e.cls] || 'chemo', subCode: null };
  },

  /* ---- 镜头二：按产品分类 · 生产工艺（复用 MANUFACTURE_KB） ---- */
  _renderClassProductLens() {
    const MK = globalThis.MANUFACTURE_KB;
    if (!MK || !MK.CLASSES) return '<div class="bookmark-empty">生产工艺知识库未加载（MANUFACTURE_KB 缺失）</div>';
    const CLASSES = MK.CLASSES, ENTRIES = MK.ENTRIES || [], OVERVIEW = MK.CLASS_OVERVIEW || {};

    // 选中的具体类型 → 渲染生产工艺详情
    if (this.state.classProdForm) {
      const e = ENTRIES.find(x => x.id === this.state.classProdForm);
      if (e) return this._renderClassProdDetail(e, CLASSES);
    }

    // 产品分类树：化学药额外纳入放射性药品（radio-syn），满足"化药所有类型+剂型+放射性药品"
    let html = '<div class="cls-prod-lens">';
    html += '<div class="cls-lens-tip">🏭 按「药品类型 → 具体类型（含剂型）」组织，<strong>生产工艺 × 分类</strong>已整合到每一具体类型：点击任一类型查看其<strong>生产工序（目的→怎么做）/ 工艺特点 / 质量控制要点 / 主要依据</strong>，并可直接展开该类型的<strong>研发要求体系</strong>。化学药下已纳入全部类型、剂型及放射性药品。</div>';

    // 技术路线筛选栏（合成 / 发酵 / 制剂 / 连续制造 / 细胞培养 / 血液 / 炮制 / 现代提取 / 放射性合成）
    const ROUTES = MK.ROUTE_CHIPS || [];
    if (ROUTES.length) {
      html += '<div class="cls-route-bar"><span class="cls-route-bar-label">🔧 技术路线筛选</span>';
      html += '<button class="cls-route-chip' + (this.state.classProdRoute ? '' : ' active') + '" data-cls-route="__all__">全部</button>';
      ROUTES.forEach(r => {
        const cnt = ENTRIES.filter(x => (x.routes || []).indexOf(r.id) !== -1).length;
        if (!cnt) return;
        const act = this.state.classProdRoute === r.id ? ' active' : '';
        html += '<button class="cls-route-chip' + act + '" data-cls-route="' + r.id + '">' + this.pen(r.name) + '</button>';
      });
      html += '</div>';
    }

    CLASSES.forEach(cl => {
      // 收集该类的生产工艺条目；化药额外并入放射性药品
      let entries = ENTRIES.filter(x => x.cls === cl.id);
      if (cl.id === 'chem') {
        const radio = ENTRIES.find(x => x.id === 'radio-syn');
        if (radio) { entries = entries.concat([Object.assign({}, radio, { _radioTag: true })]); }
      }
      // 技术路线过滤
      if (this.state.classProdRoute) {
        entries = entries.filter(x => (x.routes || []).indexOf(this.state.classProdRoute) !== -1);
      }
      html += '<section class="cls-prod-class">';
      html += '<div class="cls-prod-class-head"><span class="cls-prod-class-ico">' + cl.icon + '</span>'
        + '<h3>' + this.pen(cl.name) + '</h3>'
        + (cl.id === 'chem' ? '<span class="cls-prod-class-badge">已含全部类型 · 剂型 · 放射性药品</span>' : '')
        + '</div>';
      const ov = OVERVIEW[cl.id];
      if (ov) {
        html += '<div class="cls-prod-ov">'
          + '<span class="cls-prod-ov-k">🔬 ' + this.pen(ov.rnd) + '</span>'
          + '<span class="cls-prod-ov-k">⚠ ' + this.pen(ov.diff) + '</span>'
          + '</div>';
      }
      html += '<div class="cls-prod-grid">';
      entries.forEach(e => {
        const routes = (e.routes || []).map(id => {
          const r = (MK.ROUTE_CHIPS || []).find(x => x.id === id);
          return r ? r.name : id;
        }).map(n => '<span class="cls-prod-tag">' + this.pen(n) + '</span>').join('');
        html += '<div class="cls-prod-entry" data-cls-prod-entry="' + e.id + '">';
        html += '<div class="cls-prod-entry-h"><span class="cls-prod-entry-name">' + this.pen(e.name) + '</span>'
          + (e._radioTag ? '<span class="cls-prod-entry-radio">☢️ 放射性药品</span>' : '') + '</div>';
        html += '<div class="cls-prod-entry-tags">' + routes + '</div>';
        html += '<div class="cls-prod-entry-sum">' + this.pen(e.summary || '') + '</div>';
        html += '</div>';
      });
      html += '</div></section>';
    });
    html += '</div>';
    return html;
  },

  /* 生产工艺条目详情（工序 / 特点 / 质控 / 依据） */
  _renderClassProdDetail(e, CLASSES) {
    const MK = globalThis.MANUFACTURE_KB || {};
    const CLS_NAME = {};
    (CLASSES || []).forEach(cl => { CLS_NAME[cl.id] = cl.name; });
    const FORM_MAP = {};
    (CLASSES || []).forEach(cl => (cl.forms || []).forEach(f => { FORM_MAP[f.id] = f.name; }));

    const steps = (e.steps || []).map((s, i) => {
      return '<div class="cls-pd-step"><div class="cls-pd-step-no">' + (i + 1) + '</div>'
        + '<div class="cls-pd-step-body"><div class="cls-pd-step-name">' + this.pen(s.n) + '</div>'
        + '<div class="cls-pd-step-why"><span class="cls-pd-tag why">目的</span>' + this.pen(s.purpose || '') + '</div>'
        + '<div class="cls-pd-step-how"><span class="cls-pd-tag how">怎么做</span>' + this.pen(s.detail || '') + '</div></div></div>';
    }).join('');
    const feats = (e.features || []).map(f => '<li>' + this.pen(f) + '</li>').join('');

    // 关联注册分类（与"按注册分类"体系打通）
    const regCat = (e.reg_cat || []).map(r => '<span class="cls-pd-regcat">' + this.pen(r) + '</span>').join('');
    const regCatHtml = regCat
      ? '<div class="cls-pd-section cls-pd-regsys"><div class="cls-pd-sec-title">📋 关联注册分类</div><div class="cls-pd-regcats">' + regCat + '</div></div>'
      : '';
    // 适用 GMP 附录 / 关键规范
    const gmp = (e.gmp || []).map(g => '<span class="cls-pd-gmp">' + this.pen(g) + '</span>').join('');
    const gmpHtml = gmp
      ? '<div class="cls-pd-section cls-pd-regsys"><div class="cls-pd-sec-title">🛡️ 适用 GMP 附录 / 关键规范</div><div class="cls-pd-regcats">' + gmp + '</div></div>'
      : '';

    // 关键质量属性 CQA
    const cqa = (e.cqa || []).map(a =>
      '<tr><td class="cls-pd-cqa-a">' + this.pen(a.a) + '</td>'
      + '<td class="cls-pd-cqa-t">' + this.pen(a.target || '') + '</td>'
      + '<td class="cls-pd-cqa-m">' + this.pen(a.method || '') + '</td>'
      + '<td class="cls-pd-cqa-w">' + this.pen(a.why || '') + '</td></tr>'
    ).join('');
    const cqaHtml = cqa
      ? '<div class="cls-pd-section"><div class="cls-pd-sec-title">🎯 关键质量属性（CQA）</div>'
        + '<div class="cls-pd-sub">决定产品安全性与有效性的核心属性，是工艺确认与放行关注重点</div>'
        + '<table class="cls-pd-table cls-pd-cqa-table"><thead><tr><th>质量属性</th><th>目标 / 限度</th><th>检测方法</th><th>为什么是关键</th></tr></thead>'
        + '<tbody>' + cqa + '</tbody></table></div>'
      : '';

    // 关键工艺参数 CPP
    const cpp = (e.cpp || []).map(p =>
      '<li class="cls-pd-cpp-item"><span class="cls-pd-cpp-p">' + this.pen(p.p) + '</span>'
      + '<span class="cls-pd-cpp-r">范围：' + this.pen(p.range || '') + '</span>'
      + '<span class="cls-pd-cpp-w">' + this.pen(p.why || '') + '</span></li>'
    ).join('');
    const cppHtml = cpp
      ? '<div class="cls-pd-section"><div class="cls-pd-sec-title">⚙️ 关键工艺参数（CPP）</div>'
        + '<div class="cls-pd-sub">对 CQA 有显著影响、须受控的工艺参数（QbD 核心）</div>'
        + '<ul class="cls-pd-cpp-list">' + cpp + '</ul></div>'
      : '';

    // 中控策略
    const pc = (e.process_control || []).map(p =>
      '<tr><td class="cls-pd-pc-s">' + this.pen(p.stage || '') + '</td>'
      + '<td class="cls-pd-pc-c">' + this.pen(p.check || '') + '</td>'
      + '<td class="cls-pd-pc-m">' + this.pen(p.method || '') + '</td>'
      + '<td class="cls-pd-pc-l">' + this.pen(p.limit || '') + '</td></tr>'
    ).join('');
    const pcHtml = pc
      ? '<div class="cls-pd-section"><div class="cls-pd-sec-title">🔬 中控策略（过程控制）</div>'
        + '<div class="cls-pd-sub">生产工序间的过程控制点，保障批内/批间一致</div>'
        + '<table class="cls-pd-table cls-pd-pc-table"><thead><tr><th>工序</th><th>中控项目</th><th>方法</th><th>限度</th></tr></thead>'
        + '<tbody>' + pc + '</tbody></table></div>'
      : '';

    const qc = (e.qc_points || []).map(p =>
      '<tr><td class="cls-pd-qcp-t">' + this.pen(p.t) + '</td>'
      + '<td class="cls-pd-qcp-m">' + this.pen(p.m) + '</td>'
      + '<td class="cls-pd-qcp-s">' + this.pen(p.s) + '</td></tr>'
    ).join('');
    const qcNote = (e.qc_note || []).map(n =>
      '<li class="cls-pd-qcn-item"><span class="cls-pd-qcn-t">🔎 ' + this.pen(n.t) + '</span>'
      + '<span class="cls-pd-qcn-w">' + this.pen(n.why || '') + '</span></li>'
    ).join('');
    const qcHtml = qc
      ? '<div class="cls-pd-section"><div class="cls-pd-sec-title">🧪 质量控制要点（检验项目 · 方法 · 限度）</div>'
        + '<table class="cls-pd-table"><thead><tr><th>检验项目</th><th>方法 / 检测手段</th><th>标准 · 可接受限度</th></tr></thead>'
        + '<tbody>' + qc + '</tbody></table>'
        + (qcNote ? '<div class="cls-pd-qcn"><div class="cls-pd-sub">重点控制项「为什么控」解读</div><ul class="cls-pd-qcn-list">' + qcNote + '</ul></div>' : '')
        + '</div>'
      : '';
    const regs = (e.regs || []).map(r => '<span class="cls-pd-reg">' + this.pen(r) + '</span>').join('');
    const routes = (e.routes || []).map(id => {
      const r = (MK.ROUTE_CHIPS || []).find(x => x.id === id);
      return r ? r.name : id;
    }).map(n => '<span class="cls-pd-tag route">' + this.pen(n) + '</span>').join('');

    const isRadio = !!(e._radioTag || e.id === 'radio-syn');
    let html = '<div class="cls-prod-detail">';
    html += '<button class="cls-prod-detail-back" data-cls-prod-back>← 返回产品分类</button>';
    html += '<div class="cls-pd-head">';
    html += '<div class="cls-pd-cls">' + (CLS_NAME[e.cls] || e.cls)
      + (isRadio ? ' · ☢️ 放射性药品' : '') + '</div>';
    html += '<h1 class="cls-pd-title">' + this.pen(e.name) + '</h1>';
    html += '<div class="cls-pd-summary">' + this.pen(e.summary || '') + '</div>';
    html += '<div class="cls-pd-routes">' + routes + '</div>';
    html += '</div>';
    html += '<div class="cls-pd-section"><div class="cls-pd-sec-title">🔧 生产工序（目的 → 怎么做）</div><div class="cls-pd-steps">' + steps + '</div></div>';
    html += regCatHtml + gmpHtml;
    html += cqaHtml + cppHtml + pcHtml;
    html += '<div class="cls-pd-section"><div class="cls-pd-sec-title">✨ 工艺特点</div><ul class="cls-pd-feat">' + feats + '</ul></div>';
    html += qcHtml;
    html += '<div class="cls-pd-section"><div class="cls-pd-sec-title">📜 主要依据 · 指导原则</div><div class="cls-pd-regs">' + regs + '</div></div>';

    // 研发要求体系速览（按 6 个标准研发阶段，合并特殊品种 override）
    const reqRef = this._entryReqRef(e);
    const CR = globalThis.CLASS_REQUIREMENTS;
    if (CR && CR.mains[reqRef.mainClass]) {
      const main = CR.mains[reqRef.mainClass];
      const sp = reqRef.subCode && CR.specials[reqRef.mainClass] && CR.specials[reqRef.mainClass][reqRef.subCode];
      const scopeLabel = reqRef.subCode ? (sp ? sp.subName : reqRef.subCode) : (main.name + ' · 全部研发要求');
      html += '<div class="cls-pd-section cls-pd-req">';
      html += '<div class="cls-pd-sec-title">📐 研发要求体系（按阶段速览）</div>';
      html += '<div class="cls-pd-req-scope">所属研发要求体系：<strong>' + this.pen(scopeLabel) + '</strong> · 按「药品研发 / 生产相关工艺研究 / 质量研究 / 质量管理」四维度给出要求</div>';
      html += '<ul class="cls-pd-req-list">';
      (CR.stages || []).forEach(st => {
        let tip = '';
        if (typeof this.getReqCell === 'function') {
          const cell = this.getReqCell(reqRef.mainClass, reqRef.subCode || '', st.id, 'rnd')
                   || this.getReqCell(reqRef.mainClass, reqRef.subCode || '', st.id, 'process');
          if (cell && cell.requirement && cell.requirement.length) tip = cell.requirement[0];
        }
        const tipShown = tip ? (tip.length > 56 ? tip.substring(0, 56) + '…' : tip) : '（与主类通用要求一致）';
        html += '<li class="cls-pd-req-item"><span class="cls-pd-req-stage">' + this.pen(st.name) + '</span>'
          + '<span class="cls-pd-req-tip">' + this.pen(tipShown) + '</span></li>';
      });
      html += '</ul>';
      html += '<button class="cls-pd-req-open" data-open-req="' + reqRef.mainClass + '::' + (reqRef.subCode || '') + '">↗ 查看完整研发要求体系（' + this.pen(scopeLabel) + '）</button>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  },

  /* ---- 阶段主体各区块复用渲染器（总览与子板块共用） ---- */

  renderSectionDomestic(d) {
    if (!d) return '';
    let html = `
      <div class="detail-section" data-section="domestic">
        <div class="detail-section-header">
          <span class="detail-section-header-icon">🇨🇳</span>
          <span class="detail-section-title">国内要求 (NMPA)</span>
          <span class="detail-section-toggle">▼</span>
        </div>
        <div class="detail-section-body">
    `;
    if (d.requirements && d.requirements.length > 0) {
      html += '<h4 style="font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:12px;">质量体系要求清单</h4>';
      html += '<ul class="requirement-list">';
      d.requirements.forEach((req, idx) => {
        const reqText = typeof req === 'string' ? req : req.text;
        const reqGuidance = (typeof req === 'object' && req.guidance) ? req.guidance : '';
        html += `<li class="requirement-item" data-idx="${idx}">
          <span class="requirement-check">✓</span>
          <div class="requirement-content">
            <span class="requirement-text">${this.pen(reqText)}</span>
            ${reqGuidance ? `<div class="requirement-guidance"><span class="guidance-tag">指导</span><span class="guidance-detail">${this.pen(reqGuidance)}</span></div>` : ''}
          </div>
        </li>`;
      });
      html += '</ul>';
    }
    if (d.regulations && d.regulations.length > 0) {
      html += '<h4 style="font-size:13px; font-weight:600; color:var(--text-primary); margin:16px 0 12px;">相关法规文件</h4>';
      html += '<div class="regulation-list">';
      d.regulations.forEach(reg => {
        html += `
          <a class="regulation-item" href="${reg.url}" target="_blank" rel="noopener noreferrer">
            <span class="regulation-item-icon">📄</span>
            <div class="regulation-item-info">
              <div class="regulation-item-title">${reg.title}</div>
              ${reg.path ? `<div class="regulation-item-path">${reg.path}</div>` : ''}
            </div>
            <span class="regulation-item-source">NMPA</span>
            <span class="regulation-item-external">↗</span>
          </a>
        `;
      });
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  },

  renderSectionInternational(i) {
    if (!i) return '';
    let html = `
      <div class="detail-section" data-section="international">
        <div class="detail-section-header">
          <span class="detail-section-header-icon">🌍</span>
          <span class="detail-section-title">国际要求 (FDA/EMA/WHO/ICH)</span>
          <span class="detail-section-toggle">▼</span>
        </div>
        <div class="detail-section-body">
    `;
    if (i.requirements && i.requirements.length > 0) {
      html += '<div class="international-group">';
      html += '<div class="international-group-title">各监管机构要求</div>';
      html += '<ul class="requirement-list">';
      i.requirements.forEach((req, idx) => {
        const reqText = typeof req === 'string' ? req : req.text;
        const reqGuidance = (typeof req === 'object' && req.guidance) ? req.guidance : '';
        html += `<li class="requirement-item" data-idx="${idx}">
          <span class="requirement-check" style="border-color:var(--primary); color:var(--primary)">✓</span>
          <div class="requirement-content">
            <span class="requirement-text">${this.pen(reqText)}</span>
            ${reqGuidance ? `<div class="requirement-guidance"><span class="guidance-tag">指导</span><span class="guidance-detail">${this.pen(reqGuidance)}</span></div>` : ''}
          </div>
        </li>`;
      });
      html += '</ul></div>';
    }
    if (i.regulations && i.regulations.length > 0) {
      html += '<h4 style="font-size:13px; font-weight:600; color:var(--text-primary); margin:16px 0 12px;">国际法规与指南</h4>';
      html += '<div class="regulation-list">';
      i.regulations.forEach(reg => {
        html += `
          <a class="regulation-item" href="${reg.url}" target="_blank" rel="noopener noreferrer">
            <span class="regulation-item-icon">📄</span>
            <div class="regulation-item-info">
              <div class="regulation-item-title">${reg.title}</div>
            </div>
            <span class="regulation-item-source">${reg.source || '国际'}</span>
            <span class="regulation-item-external">↗</span>
          </a>
        `;
      });
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  },

  renderSectionGuidance(g) {
    if (!g || !g.length) return '';
    return `
      <div class="detail-section" data-section="guidance">
        <div class="detail-section-header">
          <span class="detail-section-header-icon">💡</span>
          <span class="detail-section-title">实施指导建议</span>
          <span class="detail-section-toggle">▼</span>
        </div>
        <div class="detail-section-body">
          <ul class="guidance-list">
            ${g.map(x => `<li class="guidance-item">${this.pen(x)}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  },

  renderSectionCases(c) {
    if (!c || !c.length) return '';
    return `
      <div class="detail-section" data-section="cases">
        <div class="detail-section-header">
          <span class="detail-section-header-icon">📋</span>
          <span class="detail-section-title">案例研究</span>
          <span class="detail-section-toggle">▼</span>
        </div>
        <div class="detail-section-body">
          ${c.map(x => `
            <div class="case-card">
              <div class="case-card-title">${x.title}</div>
              <div class="case-card-description">${x.description}</div>
              <div class="case-card-lesson"><strong>经验教训：</strong>${x.lesson}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  renderSectionPitfalls(p) {
    if (!p || !p.length) return '';
    return `
      <div class="detail-section" data-section="pitfalls">
        <div class="detail-section-header">
          <span class="detail-section-header-icon">⚠️</span>
          <span class="detail-section-title">常见问题与陷阱</span>
          <span class="detail-section-toggle">▼</span>
        </div>
        <div class="detail-section-body">
          <div class="pitfalls-box">
            <div class="pitfalls-title">⚠ 需要特别注意的问题</div>
            <ul class="pitfalls-list">
              ${p.map(x => `<li class="pitfall-item">${this.pen(x)}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;
  },

  /* ============ 书签 ============ */

  isBookmarked(varietyId, stageId) {
    return this.state.bookmarks.some(bm => bm.varietyId === varietyId && bm.stageId === stageId);
  },

  toggleBookmark(varietyId, stageId) {
    const v = this.findVarietyById(varietyId);
    const stage = KB_DATA.stages.find(s => s.id === stageId);
    if (!v || !stage) return;

    const idx = this.state.bookmarks.findIndex(bm => bm.varietyId === varietyId && bm.stageId === stageId);
    if (idx >= 0) {
      this.state.bookmarks.splice(idx, 1);
      this.showToast(`已移除书签：${v.name} · ${stage.name}`, 'warning');
    } else {
      this.state.bookmarks.push({ varietyId: varietyId, stageId: stageId });
      this.showToast(`已添加书签：${v.name} · ${stage.name}`, 'success');
    }
    this.saveBookmarks();
    this.renderSidebar();
    this.renderDetailView();
  },

  removeBookmark(varietyId, stageId) {
    const idx = this.state.bookmarks.findIndex(bm => bm.varietyId === varietyId && bm.stageId === stageId);
    if (idx >= 0) {
      this.state.bookmarks.splice(idx, 1);
      this.saveBookmarks();
      this.renderSidebar();
      if (this.state.currentVarietyId === varietyId && this.state.currentStageId === stageId) {
        this.renderDetailView();
      }
      this.showToast('已移除书签', 'warning');
    }
  },

  /* ============ Toast ============ */

  showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  },

  /* ============ 事件绑定 ============ */

  bindEvents() {
    const matrixBtn = document.getElementById('matrixToggleBtn');
    if (matrixBtn) matrixBtn.addEventListener('click', () => this.toggleMatrixView());

    const closeBtn = document.getElementById('regulationPanelClose');
    if (closeBtn) closeBtn.addEventListener('click', () => this.toggleRegulationPanel());

    const classifyBtn = document.getElementById('classifyBtn');
    if (classifyBtn) classifyBtn.addEventListener('click', () => {
      if (this.state.view === 'classification') this.closeClassification();
      else this.openClassification();
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        this.toggleMatrixView();
      }
    });
  },

  /* ============ 海云AI 智能问答 ============
   * 纯 AI 推理：所有回答均由大模型 RAG 生成，不再做离线条文检索回退。
   * REG_QA_FAQ 仅用于渲染「常见问题」建议列表（点击后统一走 AI 推理）。
   */
  initQaAi() {
    const btn = document.getElementById('qaAiBtn');
    if (btn) btn.addEventListener('click', () => {
      this.state.qaOpen ? this.closeQaAi() : this.openQaAi();
    });
    const closeBtn = document.getElementById('qa9Close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeQaAi());
    const input = document.getElementById('qa9Input');
    if (input) {
      input.addEventListener('input', () => this._autoGrowInput());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendQaMessage(); }
      });
    }
    const sbtn = document.getElementById('qa9SendBtn');
    if (sbtn) sbtn.addEventListener('click', () => this.sendQaMessage());
    const clearBtn = document.getElementById('qa9Clear');
    if (clearBtn) clearBtn.addEventListener('click', () => this._resetQaChat());
    // 「延伸问题」气泡 + 「AI 拓展此回答」：事件委托（消息体是动态 innerHTML，无法逐个绑定）
    const msgs = document.getElementById('qa9Msgs');
    if (msgs) msgs.addEventListener('click', (e) => {
      const chip = e.target && e.target.closest ? e.target.closest('.qa9-followup') : null;
      if (chip && chip.dataset.q) { this.sendQaMessage(chip.dataset.q); return; }
      const exp = e.target && e.target.closest ? e.target.closest('.qa9-expand-btn') : null;
      if (exp) { this._qaExpandAnswer(exp); return; }
    });
    this.qaApiBase = this._readQaApiBase();
    this._renderQaMode();
    this._initModelPanel();
    this.loadInlineModels();
    this.updateConnBadge();   // 启动时检测当前模型连接状态并展示徽标
    this._qaMode = 'local';
    this._initModeSeg();
    this._applyDefaultModeFromHealth();
    this._initQaChat();
  },

  // 读取实时后端地址（优先级：meta[name=qa-api-base] > globalThis.QA_API_BASE）
  _readQaApiBase() {
    const meta = document.querySelector('meta[name="qa-api-base"]');
    let base = (meta && meta.getAttribute('content') ? meta.getAttribute('content') : '').trim();
    if (!base && globalThis.QA_API_BASE) base = String(globalThis.QA_API_BASE).trim();
    if (!base) return '';                 // 空 = 静态快照模式
    // 同域实时：前端与后端由同一后端托管（如 Render/VPS 同域部署），
    // 设 content="/" 或 "same-origin" 即前端用相对 /api/qa，免 CORS。
    if (base === '/' || base === './' || base === '.' || base.toLowerCase() === 'same-origin')
      return window.location.origin;
    return base.replace(/\/api\/?$/, '').replace(/\/+$/, '');  // 归一，避免 /api/api/qa
  },

  // 模式文案（三档：本地法规库 / 联网搜索 / 深度融合）
  _modeLabel(m) {
    if (m === 'web') return '联网搜索';
    if (m === 'hybrid') return '深度融合';
    return '本地法规库';
  },

  _renderQaMode() {
    const el = document.getElementById('qa9Mode'); if (!el) return;
    const modeTxt = this._modeLabel(this._qaMode);
    if (this.qaApiBase) {
      el.textContent = '🤖 ' + modeTxt + ' · 在线';
      el.className = 'qa9-mode live';
    } else {
      el.textContent = '🤖 ' + modeTxt + ' · 未连接';
      el.className = 'qa9-mode snap';
    }
  },

  openQaAi() {
    this.state.qaOpen = true;
    if (this.state.regLibOpen) this.closeRegulationLibrary();
    ['breadcrumb', 'stageTabs', 'detailLayout', 'matrixView', 'regulationLibrary'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    const p = document.getElementById('qaAiPanel'); if (p) p.style.display = 'flex';
    const btn = document.getElementById('qaAiBtn'); if (btn) btn.classList.add('active');
  },

  closeQaAi() {
    this.state.qaOpen = false;
    const p = document.getElementById('qaAiPanel'); if (p) p.style.display = 'none';
    const btn = document.getElementById('qaAiBtn'); if (btn) btn.classList.remove('active');
    if (this.state.view === 'classification') {
      const bc = document.getElementById('breadcrumb'); if (bc) bc.style.display = 'none';
      const st = document.getElementById('stageTabs'); if (st) st.style.display = 'none';
      const dl = document.getElementById('detailLayout'); if (dl) dl.style.display = '';
    } else {
      const bc = document.getElementById('breadcrumb'); if (bc) bc.style.display = '';
      const st = document.getElementById('stageTabs'); if (st) st.style.display = '';
      if (this.state.viewMode === 'matrix') {
        const mv = document.getElementById('matrixView'); if (mv) mv.style.display = '';
      } else {
        const dl = document.getElementById('detailLayout'); if (dl) dl.style.display = '';
      }
    }
  },

  async runQaSearch() {
    return this.sendQaMessage();
  },

  async showQaAnswer(idx) {
    const QA = globalThis.REG_QA_FAQ || [];
    const item = QA[idx]; if (!item) return;
    return this.sendQaMessage(item.q);
  },

  /* ---- 实时后端（FastAPI /api/qa）适配器 ---- */
  // 效力层级排序：法律 > 行政法规 > 部门规章 > 技术指导原则 > 行业共识 > 规范性文件
  // （与药品法规专家「区分层级」原则一致；tier 仅区分时效，分类决定效力高低）
  catRank(c) {
    const m = { '01_法律': 0, '02_行政法规': 1, '03_部门规章': 2, '04_技术指导原则': 3, '05_行业共识': 4, '06_国际': 5, '07_规范性文件': 6, '08_其他': 7 };
    for (const k in m) if ((c || '').indexOf(k) === 0) return m[k];
    return 9;
  },

  // 统一排序：先按效力层级，再按时效档位（现行有效优先于已废止）
  _sortCites(list) {
    if (!list || !list.length) return list || [];
    return list.slice().sort((a, b) => {
      const ca = this.catRank(a.c), cb = this.catRank(b.c);
      if (ca !== cb) return ca - cb;
      return (a.tier == null ? 3 : a.tier) - (b.tier == null ? 3 : b.tier);
    });
  },

  // 取首句（用于【结论】的原文摘录）
  _firstSent(s, max) {
    s = (s || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    const m = s.match(/^.{0,160}?[。；;！!？?\n]/);
    let r = m ? m[0] : s.slice(0, 160);
    if (max && r.length > max) r = r.slice(0, max) + '…';
    return r.replace(/^[>\s]+/, '');
  },

  _clip(s, n) {
    s = (s || '').replace(/\s+/g, ' ').trim();
    if (s.length > n) return s.slice(0, n) + '…';
    return s;
  },

  // 镜像 kb_query.st_tier（后端未返回 tier 时前端兜底）
  stTier(st) {
    st = (st || '').trim();
    if (!st) return 3;
    if (/废止|失效|作废/.test(st)) return 9;
    if (st.indexOf('征求意见') >= 0) return st.indexOf('截止') >= 0 ? 5 : 4;
    if (st.indexOf('尚未生效') >= 0) return 2;
    if (st.indexOf('试行') >= 0 || st.indexOf('暂行') >= 0) return 1;
    if (st.startsWith('现行有效') || st === '有效' || st === '现行') return 0;
    if (st.indexOf('参考') >= 0) return 3;
    return 3;
  },

  /* ============ 对话模式：聊天式回复 ============ */

  // 初始化对话（仅在尚无消息时添加欢迎语，避免重复初始化清空进行中的会话）
  _initQaChat() {
    const box = document.getElementById('qa9Msgs');
    if (!box || box.children.length) return;
    this._resetQaChat();
  },

  // 真正清空并重置对话（"清空对话"按钮调用）→ 渲染紧凑「快速提问」面板（研发/注册高频问题 + 换一批）
  _resetQaChat() {
    this._qaMid = 0;
    this._qaQuickIdx = 0;
    const box = document.getElementById('qa9Msgs'); if (!box) return;
    box.innerHTML = '';
    const welcome =
      '<div class="qa9-quick">' +
        '<div class="qa9-quick-greet">你好，我是 <b>海云AI</b> —— 专注药品研发生产与注册申报的 QA 助手。点击下方高频问题直接提问，也可以直接在下方输入你的问题：</div>' +
        '<div class="qa9-quick-head">' +
          '<span class="qa9-quick-title">💡 快速提问 · 研发 / 注册高频</span>' +
          '<button type="button" class="qa9-quick-refresh" id="qa9QuickRefresh">🔄 换一批</button>' +
        '</div>' +
        '<div class="qa9-quick-chips" id="qa9QuickChips"></div>' +
      '</div>';
    const wrap = document.createElement('div');
    wrap.className = 'qa9-msg bot welcome';
    wrap.innerHTML = '<div class="qa9-bubble">' + welcome + '</div>';
    box.appendChild(wrap);
    this._renderQuickBatch();
    const refresh = document.getElementById('qa9QuickRefresh');
    if (refresh) refresh.addEventListener('click', () => { this._qaQuickIdx++; this._renderQuickBatch(); });
  },

  // 研发 / 注册相关的预设高频问题池（"换一批"在池中循环切片）
  _buildQuickQuestions() {
    return [
      // —— 药物研发 ——
      'IND 申报需要哪些非临床研究资料？',
      '化学药 1 类与 2 类的注册分类区别？',
      '创新药临床试验申请（IND）流程是怎样的？',
      '药物非临床研究质量管理规范（GLP）适用范围？',
      '原料药与制剂关联审评怎么操作？',
      '生物制品注册分类及申报路径？',
      '中药注册分类有哪些？',
      '药物临床试验（GCP）核心要求？',
      '药理毒理研究一般包括哪些内容？',
      '药代动力学（ADME）研究要求？',
      // —— 注册申报 ——
      'NDA 上市许可申请资料要求？',
      'MAH（药品上市许可持有人）制度要点？',
      '加快上市注册程序有哪些（突破性/优先审评/附条件）？',
      '药品注册发补常见问题与应对策略？',
      '申报资料 CTD 格式要求？',
      'Pre-IND 沟通交流会议怎么申请？',
      '境外已上市境内未上市药品（5.1 类）如何申报？',
      '药品生产工艺信息表填写要求？',
      '药品注册检验流程与时限？',
      '注册申报资料真实性核查要点？',
      // —— 质量体系 ——
      'GMP 基本要求与现场检查要点？',
      '变更管理（CMC 变更）如何分类？',
      '偏差与 CAPA 管理要求？',
      '供应商审计与物料管理要求？',
      '数据完整性（ALCOA+）原则是什么？',
      '质量风险管理（QRM）如何实施？',
      '共线生产风险评估要点？',
      // —— 通用 / 其他 ——
      '仿制药质量和疗效一致性评价要求？',
      '专利链接与专利期补偿制度？',
      '处方药与非处方药（OTC）转换要求？',
      '药品说明书与标签管理规定？'
    ];
  },

  // 渲染当前批次的快速提问（每批 8 条，换一批循环）
  _renderQuickBatch() {
    const el = document.getElementById('qa9QuickChips'); if (!el) return;
    const pool = this._qaQuickPool || (this._qaQuickPool = this._buildQuickQuestions());
    const per = 8, total = pool.length;
    const start = (this._qaQuickIdx * per) % total;
    const batch = [];
    for (let i = 0; i < per; i++) batch.push(pool[(start + i) % total]);
    el.innerHTML = batch.map(q =>
      '<button type="button" class="qa9-quick-chip" data-q="' + Penetrator.esc(q) + '">' + Penetrator.esc(q) + '</button>'
    ).join('');
    el.querySelectorAll('.qa9-quick-chip').forEach(b => b.addEventListener('click', () => this.sendQaMessage(b.dataset.q)));
  },

  // 发送一条消息（对话模式主入口）—— 仅走大模型 RAG（纯 AI 推理），彻底移除离线条文检索回退
  async sendQaMessage(text) {
    text = (text || '').trim();
    if (!text) {
      const inp = document.getElementById('qa9Input');
      text = (inp ? inp.value : '').trim();
    }
    if (!text) return;
    const input = document.getElementById('qa9Input'); if (input) { input.value = ''; this._autoGrowInput(); }
    this._appendMsg('user', Penetrator.esc(text));
    const ovEl = document.getElementById('qa9OnlyValid');
    const ov = ovEl ? ovEl.checked : true;
    const mode = this._qaMode || 'local';
    const thinkTxt = (mode === 'hybrid')
      ? '海云AI 正在并行调阅本地法规原文与实时网络资料，交叉核验中…'
      : (mode === 'web' ? '海云AI 正在实时联网检索并推理…'
        : '海云AI 正在检索法规库并深度推理…');
    const typingId = this._appendMsg('bot', '<span class="qa9-typing"><span class="qa9-dot"></span>' + thinkTxt + '</span>', true);
    try {
      if (!this.qaApiBase) {
        this._updateMsg(typingId,
          '<div class="qa9-reply-intro">⚠️ AI 模型尚未配置，暂无法作答。请点击右上角「⚙️ AI 模型」选择服务商并填入 API Key 后重试。</div>');
        this._scrollMsgs();
        return;
      }
      const rag = await this.qaRag(text, { onlyValid: ov, mode: mode });
      if (rag && !rag.fallback && rag['结论']) {
        const blocks = {
          abstract: rag['结论'] || '',
          thinking: rag['思考分析'] || '',
          points:   rag['要点解析'] || [],
          tips:     rag['适用提示'] || '',
          risk:     rag['风险提示'] || '',
          timeNote: rag['时效说明'] || '',
          followUps: rag['延伸问题'] || []
        };
        const intros = {
          web:    '海云AI 已实时联网检索并综合作答：',
          hybrid: '海云AI 已交叉核验「本地法规原文 + 实时网络资料」后作答：',
          local:  '海云AI 基于以下法规材料深度分析后作答：'
        };
        const intro = intros[rag.source] || intros[mode] || intros.local;
        const html = this._buildRagReply({ intro: intro, blocks: blocks, rag: rag, source: 'rag', query: text });
        this._updateMsg(typingId, html);
        this._scrollMsgs();
        return;
      }
      // RAG 未返回有效结论：限流 / 出错 / 未配置等，给出透明提示（不再回退离线条文检索）
      let tip;
      if (rag && rag.error === 'llm_rate_limited')
        tip = '⚠️ 当前 AI 模型限流（免费额度）。请稍后重试，或在「⚙️ AI 模型」中切换为其他服务商 / 付费模型。';
      else if (rag && rag.error)
        tip = '⚠️ AI 推理暂时不可用（' + String(rag.error) + '）。请稍后重试或检查模型配置。';
      else
        tip = '⚠️ AI 未返回有效结论，请换一种问法重试，或检查「⚙️ AI 模型」中的配置。';
      this._updateMsg(typingId, '<div class="qa9-reply-intro">' + tip + '</div>');
    } catch (e) {
      this._updateMsg(typingId, '<div class="qa9-reply-intro">⚠️ 推理出错，请稍后重试。</div>');
    }
    this._scrollMsgs();
  },

  _appendMsg(role, html, isTyping) {
    const box = document.getElementById('qa9Msgs'); if (!box) return '';
    const mid = 'm' + (++this._qaMid);
    const wrap = document.createElement('div');
    wrap.className = 'qa9-msg ' + role + (isTyping ? ' typing' : '');
    wrap.dataset.mid = mid;
    if (role === 'bot') {
      wrap.innerHTML = '<div class="qa9-avatar">🔍</div><div class="qa9-bubble">' + html + '</div>';
    } else {
      wrap.innerHTML = '<div class="qa9-bubble">' + html + '</div>';
    }
    box.appendChild(wrap);
    this._scrollMsgs();
    return mid;
  },

  _updateMsg(mid, html) {
    const box = document.getElementById('qa9Msgs'); if (!box) return;
    const wrap = box.querySelector('[data-mid="' + mid + '"]');
    if (!wrap) return;
    wrap.classList.remove('typing');
    const bubble = wrap.querySelector('.qa9-bubble');
    if (bubble) bubble.innerHTML = html;
    this._scrollMsgs();
  },

  _scrollMsgs() {
    const box = document.getElementById('qa9Msgs'); if (!box) return;
    box.scrollTop = box.scrollHeight;
  },

  // 调用后端 /api/qa-rag 做真·问答（大模型 RAG）。失败/未配置返回 {fallback:true}
  async qaRag(text, opts) {
    if (!this.qaApiBase) return { fallback: true };
    const base = (this.qaApiBase === '/' || this.qaApiBase === 'same-origin') ? '' : this.qaApiBase;
    const url = base + '/api/qa-rag';
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, only_valid: opts && opts.onlyValid !== false, mode: (opts && opts.mode) || 'local', speed: !!(opts && opts.speed) || !!(document.getElementById('qa9Speed') && document.getElementById('qa9Speed').checked) })
      });
      if (!resp.ok) return { fallback: true };
      return await resp.json();
    } catch (e) {
      return { fallback: true };
    }
  },

  // ---------------- AI 模型切换（多服务商，免重启） ----------------

  _initModelPanel() {
    const btn = document.getElementById('qa9ModelBtn');
    if (btn) btn.addEventListener('click', () => this.openModelModal());
    const close = document.getElementById('qa9ModelClose');
    if (close) close.addEventListener('click', () => this.closeModelModal());
    const save = document.getElementById('qa9ModelSave');
    if (save) save.addEventListener('click', () => this.saveModelConfig());
    const testBtn = document.getElementById('qa9TestConn');
    if (testBtn) testBtn.addEventListener('click', () => this.testConnection());
    const prov = document.getElementById('qa9Provider');
    if (prov) prov.addEventListener('change', () => this.onProviderChange());
    const modal = document.getElementById('qa9ModelModal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) this.closeModelModal(); });
    const inline = document.getElementById('qa9ModelInline');
    if (inline) inline.addEventListener('change', () => this.onInlineModelChange());
    const pAdd = document.getElementById('qa9PresetAdd');
    if (pAdd) pAdd.addEventListener('click', () => this.addPreset());
    const pSave = document.getElementById('qa9PresetSave');
    if (pSave) pSave.addEventListener('click', () => this.savePreset());
    const pCancel = document.getElementById('qa9PresetCancel');
    if (pCancel) pCancel.addEventListener('click', () => this._hidePresetForm());
  },

  // 加载内置模型到输入框下方的切换下拉（按服务商分组）
  async loadInlineModels() {
    try {
      const r = await fetch(this._apiBase() + '/api/llm-presets');
      if (!r.ok) return;
      const j = await r.json();
      const presets = (j && j.presets) || [];
      this._presets = presets;
      const sel = document.getElementById('qa9ModelInline');
      if (!sel) return;
      let html = '';
      presets.forEach(p => {
        if (p.custom) {
          html += '<option value="custom::' + Penetrator.esc(p.id) + '">' + Penetrator.esc(p.name) + '</option>';
        } else {
          (p.models || []).forEach(m => {
            html += '<option value="' + Penetrator.esc(p.id) + '::' + Penetrator.esc(m) + '">' +
              Penetrator.esc(p.name) + ' · ' + Penetrator.esc(m) + '</option>';
          });
        }
      });
      sel.innerHTML = html;
      const cfg = await this._loadCurrentModel();
      if (cfg && sel) {
        const val = (cfg.provider || '') + '::' + (cfg.model || '');
        let found = false;
        for (const o of sel.options) { if (o.value === val) { o.selected = true; found = true; break; } }
        if (!found && cfg.model) {
          const opt = document.createElement('option');
          opt.value = val; opt.textContent = Penetrator.esc((cfg.provider || '') + ' · ' + cfg.model) + '（当前）';
          opt.selected = true; sel.appendChild(opt);
        }
      }
    } catch (e) { /* 忽略 */ }
  },

  async _loadCurrentModel() {
    try {
      const r = await fetch(this._apiBase() + '/api/llm-config');
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  },

  // 输入框下方切换模型：沿用该服务商已保存的 Key；若该服务商未配置 Key，则打开设置弹窗预选
  async onInlineModelChange() {
    const sel = document.getElementById('qa9ModelInline');
    if (!sel || !sel.value) return;
    const parts = sel.value.split('::');
    const provider = parts[0], model = parts[1] || '';
    const preset = (this._presets || []).find(p => p.id === provider) || {};
    try {
      const r = await fetch(this._apiBase() + '/api/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider, model: model, api_key: '' })
      });
      const j = await r.json();
      if (j && j.ok) {
        this._toast('已切换至 ' + (j.provider_name || provider) + ' / ' + j.model);
        this._renderQaMode();
        this.updateConnBadge();   // 切换后自动检测新模型连接状态
      } else if (j && j.error && j.error.indexOf('API Key') >= 0) {
        this.openModelModal();
        const prov = document.getElementById('qa9Provider');
        if (prov) { for (const o of prov.options) { if (o.value === provider) { o.selected = true; break; } } this.onProviderChange(); }
        const key = document.getElementById('qa9ApiKey');
        if (key) { key.value = ''; key.focus(); }
        const status = document.getElementById('qa9ModelStatus');
        if (status) { status.className = 'qa9-model-status warn'; status.textContent = '「' + (preset.name || provider) + '」尚未配置 API Key，请粘贴后保存。'; }
      } else {
        this._toast('切换失败：' + (j && j.error || '未知错误'));
      }
    } catch (e) {
      this._toast('网络错误，请重试');
    }
  },

  _toast(msg) {
    let t = document.getElementById('qa9Toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'qa9Toast'; t.className = 'qa9-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  },

  _autoGrowInput() {
    const el = document.getElementById('qa9Input'); if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  },

  _apiBase() {
    if (!this.qaApiBase || this.qaApiBase === '/' || this.qaApiBase === 'same-origin') return '';
    return this.qaApiBase;
  },

  openModelModal() {
    const m = document.getElementById('qa9ModelModal');
    if (m) m.style.display = 'flex';
    const msg = document.getElementById('qa9ModelMsg');
    if (msg) { msg.textContent = ''; msg.className = 'qa9-model-msg'; }
    this.loadModelPresets();
    this.loadModelConfig();
    this.loadPresetManage();
  },

  closeModelModal() {
    const m = document.getElementById('qa9ModelModal');
    if (m) m.style.display = 'none';
  },

  async loadModelPresets() {
    try {
      const r = await fetch(this._apiBase() + '/api/llm-presets');
      if (!r.ok) return;
      const j = await r.json();
      const presets = (j && j.presets) || [];
      this._presets = presets;
      const sel = document.getElementById('qa9Provider');
      if (sel) {
        sel.innerHTML = presets.map(p =>
          '<option value="' + Penetrator.esc(p.id) + '">' + Penetrator.esc(p.name) + '</option>').join('');
      }
    } catch (e) { /* 忽略 */ }
  },

  async loadModelConfig() {
    try {
      const r = await fetch(this._apiBase() + '/api/llm-config');
      if (!r.ok) return;
      const j = await r.json();
      const prov = document.getElementById('qa9Provider');
      if (prov && j.provider) {
        for (const o of prov.options) { if (o.value === j.provider) { o.selected = true; break; } }
      }
      this.onProviderChange();
      const modelSel = document.getElementById('qa9Model');
      if (modelSel && j.model) {
        let found = false;
        for (const o of modelSel.options) { if (o.value === j.model) { o.selected = true; found = true; break; } }
        if (!found) {
          const opt = document.createElement('option');
          opt.value = j.model; opt.textContent = j.model + '（当前）'; opt.selected = true;
          modelSel.appendChild(opt);
        }
      }
      const key = document.getElementById('qa9ApiKey');
      if (key) {
        key.value = '';
        key.placeholder = j.key_set
          ? ('当前已设置：' + (j.api_key_masked || '****') + '（留空则保持不变）')
          : '粘贴你的 API Key';
      }
      const custom = document.getElementById('qa9CustomWrap');
      const baseUrlInput = document.getElementById('qa9BaseUrl');
      if (custom && j.provider === 'custom') {
        if (baseUrlInput && j.base_url) baseUrlInput.value = j.base_url;
        const mt = document.getElementById('qa9ModelText');
        if (mt && j.model) mt.value = j.model;
      } else if (baseUrlInput) {
        // 非 custom：也回填 URL 输入框（preset 默认或上次自定义的）
        baseUrlInput.value = j.base_url || '';
      }
      const status = document.getElementById('qa9ModelStatus');
      if (status) {
        if (j.configured) {
          status.className = 'qa9-model-status ok';
          status.textContent = '✅ 当前已配置：' + (j.provider || '') + ' / ' + (j.model || '');
        } else {
          status.className = 'qa9-model-status warn';
          status.textContent = '⚠️ 尚未配置 AI 模型：粘贴 API Key 并保存即可启用。';
        }
      }
      // 打开弹窗时先清空连接测试态；若已配置则自动复测一次，通过即可直接保存
      this._resetConnTest();
      if (j.configured) this.testConnection();
    } catch (e) { /* 忽略 */ }
  },

  onProviderChange() {
    const prov = document.getElementById('qa9Provider');
    const modelSel = document.getElementById('qa9Model');
    const customWrap = document.getElementById('qa9CustomWrap');
    const baseUrlInput = document.getElementById('qa9BaseUrl');
    if (!prov || !modelSel) return;
    const pid = prov.value;
    const preset = (this._presets || []).find(p => p.id === pid) || { models: [] };
    // 始终显示 URL 输入框，并填入当前预设的默认 base_url（可让用户自由覆盖）
    if (baseUrlInput) {
      baseUrlInput.value = preset.base_url || '';
    }
    if (preset.custom) {
      if (customWrap) customWrap.style.display = '';
      modelSel.style.display = 'none';
    } else {
      if (customWrap) customWrap.style.display = 'none';
      modelSel.style.display = '';
      modelSel.innerHTML = (preset.models || []).map(m =>
        '<option value="' + Penetrator.esc(m) + '">' + Penetrator.esc(m) + '</option>').join('');
    }
    // 切换服务商后，之前的连接测试结果失效，需重新测试
    this._resetConnTest();
  },

  // 根据是否通过连接测试，启用/禁用「保存并应用」按钮
  _applySaveEnabled() {
    const s = document.getElementById('qa9ModelSave');
    if (!s) return;
    if (this._connVerifiedSig) {
      s.disabled = false;
      s.title = '';
    } else {
      s.disabled = true;
      s.title = '请先点击【测试连接】确认可连通后再保存';
    }
  },

  // 切换服务商 / 改动字段 / 打开弹窗时，令先前的测试结果失效
  _resetConnTest() {
    this._connVerifiedSig = null;
    const msg = document.getElementById('qa9TestResult');
    if (msg) { msg.className = 'qa9-test-result'; msg.textContent = '填写完成后点【测试连接】，确认可连通后再保存。'; }
    this._applySaveEnabled();
  },

  // 连接测试：用当前填写的 provider/api_key/model/base_url 发起一次极短调用，
  // 成功后置位 _connVerifiedSig（保存时据此放行），失败则给出明确原因。
  async testConnection() {
    const msg = document.getElementById('qa9TestResult');
    const prov = document.getElementById('qa9Provider');
    const key = document.getElementById('qa9ApiKey');
    const baseUrlInput = document.getElementById('qa9BaseUrl');
    const pid = prov ? prov.value : '';
    const preset = (this._presets || []).find(p => p.id === pid) || {};
    const base_url = baseUrlInput ? baseUrlInput.value.trim() : '';
    let model = '';
    if (preset.custom) {
      const mt = document.getElementById('qa9ModelText');
      model = mt ? mt.value.trim() : '';
    } else {
      const ms = document.getElementById('qa9Model');
      model = ms ? ms.value : '';
    }
    const apiKey = key ? key.value.trim() : '';
    // 签名 = 实际生效的「服务商|模型|URL|是否带新Key」，仅当测试态与此一致时才放行保存
    const sig = pid + '|' + model + '|' + base_url + '|' + (apiKey ? '1' : '0');
    this._connVerifiedSig = null;
    this._applySaveEnabled();
    if (msg) { msg.className = 'qa9-test-result testing'; msg.textContent = '🔌 正在测试连接…'; }
    try {
      const r = await fetch(this._apiBase() + '/api/llm-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: pid, model: model, base_url: base_url, api_key: apiKey })
      });
      const j = await r.json();
      if (j && j.ok) {
        this._connVerifiedSig = sig;
        this._applySaveEnabled();
        if (msg) {
          msg.className = 'qa9-test-result ok';
          msg.textContent = '✅ 连接成功（' + (j.latency_ms || 0) + 'ms）· 模型 ' + (j.model || model) + ' —— 可以保存并应用';
        }
      } else {
        if (msg) { msg.className = 'qa9-test-result err'; msg.textContent = '❌ 连接失败：' + ((j && j.error) || '未知错误') + ' —— 请检查填写内容后重试'; }
      }
    } catch (e) {
      if (msg) { msg.className = 'qa9-test-result err'; msg.textContent = '❌ 网络错误，请重试'; }
    }
  },

  // 输入框下方模型切换后，用当前生效配置测一次，并把结果体现在状态徽标上
  async updateConnBadge() {
    const badge = document.getElementById('qa9ConnBadge');
    if (!badge) return;
    const cfg = await this._loadCurrentModel();
    if (!cfg || !cfg.configured) {
      badge.className = 'qa9-conn-badge none';
      badge.innerHTML = '⚪ 未配置';
      badge.title = '尚未配置 AI 模型，点 ⚙️ 设置';
      return;
    }
    badge.className = 'qa9-conn-badge testing';
    badge.innerHTML = '🔌 连接测试…';
    badge.title = '正在测试当前模型连接…';
    try {
      const r = await fetch(this._apiBase() + '/api/llm-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: cfg.provider, model: cfg.model, base_url: cfg.base_url })
      });
      const j = await r.json();
      if (j && j.ok) {
        badge.className = 'qa9-conn-badge ok';
        badge.innerHTML = '✅ 已连接 <span class="qa9-lat">' + (j.latency_ms || 0) + 'ms</span>';
        badge.title = '当前模型 ' + (j.model || cfg.model) + ' 连接正常（' + (j.latency_ms || 0) + 'ms）';
      } else {
        badge.className = 'qa9-conn-badge err';
        badge.innerHTML = '❌ 未连接';
        badge.title = '连接失败：' + ((j && j.error) || '未知错误');
      }
    } catch (e) {
      badge.className = 'qa9-conn-badge err';
      badge.innerHTML = '❌ 网络错误';
      badge.title = '无法联系后端，请刷新重试';
    }
  },

  async saveModelConfig() {
    const msg = document.getElementById('qa9ModelMsg');
    const prov = document.getElementById('qa9Provider');
    const key = document.getElementById('qa9ApiKey');
    const baseUrlInput = document.getElementById('qa9BaseUrl');
    const pid = prov ? prov.value : '';
    const preset = (this._presets || []).find(p => p.id === pid) || {};
    // 所有 provider 均读取 URL 输入框（非 custom 时可能覆盖 preset 默认）
    const base_url = baseUrlInput ? baseUrlInput.value.trim() : '';
    let model = '';
    if (preset.custom) {
      const mt = document.getElementById('qa9ModelText');
      model = mt ? mt.value.trim() : '';
    } else {
      const ms = document.getElementById('qa9Model');
      model = ms ? ms.value : '';
    }
    const apiKey = key ? key.value.trim() : '';
    const payload = { provider: pid, model: model, base_url: base_url, api_key: apiKey };
    // 必须先通过连接测试（针对当前填写签名）才允许保存，落实「测试成功后再确认」
    const sig = pid + '|' + model + '|' + base_url + '|' + (apiKey ? '1' : '0');
    if (this._connVerifiedSig !== sig) {
      if (msg) { msg.className = 'qa9-model-msg err'; msg.textContent = '请先点击【测试连接】确认可连通后再保存。'; }
      return;
    }
    if (msg) { msg.textContent = '保存中…'; msg.className = 'qa9-model-msg'; }
    try {
      const r = await fetch(this._apiBase() + '/api/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (msg) {
        if (j.ok) {
          msg.className = 'qa9-model-msg ok';
          msg.textContent = '✅ 已切换至 ' + (j.provider_name || j.provider) + ' / ' + j.model;
          this.loadInlineModels();
          this._renderQaMode();
        } else {
          msg.className = 'qa9-model-msg err';
          msg.textContent = '❌ ' + (j.error || '保存失败');
        }
      }
      if (j.ok) setTimeout(() => this.closeModelModal(), 1000);
    } catch (e) {
      if (msg) { msg.className = 'qa9-model-msg err'; msg.textContent = '❌ 网络错误，请重试'; }
    }
  },

  // ---------------- 问答模式切换（本地数据库 / AI 联网搜索） ----------------
  _initModeSeg() {
    const seg = document.getElementById('qa9ModeSeg');
    if (!seg) return;
    seg.querySelectorAll('.qa9-seg-btn').forEach(b => {
      b.addEventListener('click', () => this._setMode(b.dataset.mode));
    });
  },

  _setMode(mode) {
    if (mode !== 'web' && mode !== 'local' && mode !== 'hybrid') mode = 'local';
    this._qaMode = mode;
    const seg = document.getElementById('qa9ModeSeg');
    if (seg) seg.querySelectorAll('.qa9-seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    // 「仅现行有效」只对涉及本地库的模式生效
    const ovWrap = document.getElementById('qa9OnlyValidWrap');
    if (ovWrap) ovWrap.style.display = (mode === 'web') ? 'none' : '';
    this._renderQaMode();
    const tips = {
      web: '已切换：🌐 联网搜索（实时检索网络，不依赖本地库）',
      hybrid: '已切换：🧠 深度融合（本地法规原文 + 实时联网并行交叉核验，用时略长）',
      local: '已切换：📚 本地法规库（3096 篇全文，引用可溯源）'
    };
    this._toast(tips[mode] || tips.local);
  },

  // 外网部署：用后端 /api/health 的 qa_default_mode 覆盖前端硬编码默认（如设为 local）
  _applyDefaultModeFromHealth() {
    const base = this._apiBase();
    if (!base) return;
    fetch(base + '/api/health', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const m = (j && j.qa_default_mode) || '';
        if (m === 'web' || m === 'local' || m === 'hybrid') {
          this._setMode(m);
        }
      })
      .catch(() => {});
  },

  // ---------------- 内置模型管理（新增 / 修改 / 删除） ----------------
  async loadPresetManage() {
    const list = document.getElementById('qa9PresetList');
    if (!list) return;
    try {
      const r = await fetch(this._apiBase() + '/api/llm-presets');
      if (!r.ok) return;
      const j = await r.json();
      const presets = (j && j.presets) || [];
      this._presets = presets;
      if (!presets.length) { list.innerHTML = '<div class="qa9-empty">暂无预设</div>'; return; }
      list.innerHTML = presets.map(p => {
        const editable = p.id !== 'custom';
        return '<div class="qa9-preset-item" data-id="' + Penetrator.esc(p.id) + '">' +
          '<div class="qa9-preset-meta"><span class="qa9-preset-name">' + Penetrator.esc(p.name) + '</span>' +
          '<span class="qa9-preset-id">' + Penetrator.esc(p.id) + (p.custom ? ' · 自定义' : '') + '</span></div>' +
          '<div class="qa9-preset-ops">' +
            (editable ? '<button type="button" class="qa9-mini-btn" data-act="edit">编辑</button>' : '') +
            (editable ? '<button type="button" class="qa9-mini-btn danger" data-act="del">删除</button>'
                      : '<span class="qa9-preset-locked">内置保护</span>') +
          '</div></div>';
      }).join('');
      list.querySelectorAll('.qa9-preset-item').forEach(it => {
        const id = it.dataset.id;
        const edit = it.querySelector('[data-act="edit"]');
        const del = it.querySelector('[data-act="del"]');
        if (edit) edit.addEventListener('click', () => this.editPreset(id));
        if (del) del.addEventListener('click', () => this.deletePreset(id));
      });
    } catch (e) { /* 忽略 */ }
  },

  addPreset() {
    this._showPresetForm(null);
  },

  editPreset(id) {
    const p = (this._presets || []).find(x => x.id === id);
    this._showPresetForm(p || null);
  },

  _showPresetForm(p) {
    const form = document.getElementById('qa9PresetForm');
    if (!form) return;
    const msg = document.getElementById('qa9PresetMsg');
    if (msg) { msg.textContent = ''; msg.className = 'qa9-model-msg'; }
    const idEl = document.getElementById('qa9PId');
    const nameEl = document.getElementById('qa9PName');
    const baseEl = document.getElementById('qa9PBase');
    const modelsEl = document.getElementById('qa9PModels');
    const defEl = document.getElementById('qa9PDefault');
    const customEl = document.getElementById('qa9PCustom');
    if (idEl) { idEl.value = p ? p.id : ''; idEl.readOnly = !!p; idEl.style.opacity = p ? '0.6' : '1'; }
    if (nameEl) nameEl.value = p ? p.name : '';
    if (baseEl) baseEl.value = p ? (p.base_url || '') : '';
    if (modelsEl) modelsEl.value = p ? (p.models || []).join(', ') : '';
    if (defEl) defEl.value = p ? (p.default_model || '') : '';
    if (customEl) customEl.checked = p ? !!p.custom : false;
    form.style.display = '';
    if (idEl && !p) idEl.focus();
  },

  _hidePresetForm() {
    const form = document.getElementById('qa9PresetForm');
    if (form) form.style.display = 'none';
  },

  async savePreset() {
    const msg = document.getElementById('qa9PresetMsg');
    const idEl = document.getElementById('qa9PId');
    const nameEl = document.getElementById('qa9PName');
    const baseEl = document.getElementById('qa9PBase');
    const modelsEl = document.getElementById('qa9PModels');
    const defEl = document.getElementById('qa9PDefault');
    const customEl = document.getElementById('qa9PCustom');
    const pid = idEl ? idEl.value.trim() : '';
    if (!pid) { if (msg) { msg.className = 'qa9-model-msg err'; msg.textContent = '❌ 请填写标识 ID'; } return; }
    if (!/^[A-Za-z0-9_\-]+$/.test(pid)) { if (msg) { msg.className = 'qa9-model-msg err'; msg.textContent = '❌ ID 仅含字母数字 _ -'; } return; }
    const models = modelsEl ? modelsEl.value.split(',').map(s => s.trim()).filter(Boolean) : [];
    const custom = customEl ? customEl.checked : false;
    const payload = {
      id: pid,
      name: nameEl ? nameEl.value.trim() : pid,
      base_url: baseEl ? baseEl.value.trim() : '',
      models: models,
      default_model: defEl ? defEl.value.trim() : (models[0] || ''),
      custom: custom,
    };
    if (msg) { msg.textContent = '保存中…'; msg.className = 'qa9-model-msg'; }
    try {
      const r = await fetch(this._apiBase() + '/api/llm-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (msg) {
        if (j.ok) {
          msg.className = 'qa9-model-msg ok';
          msg.textContent = '✅ 已保存：' + ((j.preset && j.preset.name) || pid);
          this._hidePresetForm();
          this.loadPresetManage();
          this.loadInlineModels();
          this.loadModelPresets();
        } else {
          msg.className = 'qa9-model-msg err';
          msg.textContent = '❌ ' + (j.error || '保存失败');
        }
      }
    } catch (e) {
      if (msg) { msg.className = 'qa9-model-msg err'; msg.textContent = '❌ 网络错误，请重试'; }
    }
  },

  async deletePreset(id) {
    if (!window.confirm('确定删除内置模型「' + id + '」？此操作不可撤销。')) return;
    try {
      const r = await fetch(this._apiBase() + '/api/llm-presets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      });
      const j = await r.json();
      if (j.ok) {
        this.loadPresetManage();
        this.loadInlineModels();
        this.loadModelPresets();
        this._toast('已删除预设：' + id);
      } else {
        this._toast('删除失败：' + (j.error || '未知错误'));
      }
    } catch (e) {
      this._toast('网络错误，请重试');
    }
  },

  // 渲染海云AI 回复（优化版：结论先行、要点为辅、依据/补充折叠，告别厚重八段式）
  _buildRagReply(o) {
    const B = o.blocks || {};
    const rag = o.rag || {};
    const src = rag.source || 'rag';
    let html = '';
    if (o.intro) html += '<div class="qa9-reply-intro">' + Penetrator.esc(o.intro).replace(/\n/g, '<br>') + '</div>';

    // 段落化：把 \n 拆成 <p>，并把「· / 1. / - 」开头的行渲染为列表项样式
    const lines = (s) => (s || '').split('\n').map(l => {
      const t = l.trim();
      if (!t) return '';
      const isLi = /^([·•\-—*]|\d+[.)、])\s*/.test(t);
      return isLi
        ? '<p class="qa9-li">' + Penetrator.esc(t.replace(/^([·•\-—*]|\d+[.)、])\s*/, '')) + '</p>'
        : '<p>' + Penetrator.esc(t) + '</p>';
    }).join('');

    // ① 结论 —— 作为主回答自然呈现（不再用沉重【结论】盒子）
    if (B.abstract) {
      html += '<div class="qa9-ans">' + lines(B.abstract) + '</div>';
    }
    // ② 要点解析 —— 干净的要点列表
    const pts = B.points || [];
    if (pts.length) {
      html += '<div class="qa9-pts"><div class="qa9-pts-h">要点</div><ol class="qa9-point-list">';
      pts.forEach((p) => {
        const t = (p && (p['要点'] || p.title)) || '';
        const d = (p && (p['说明'] || p.detail)) || (typeof p === 'string' ? p : '');
        if (!d) return;
        html += '<li class="qa9-point">' +
                (t ? '<span class="qa9-point-t">' + Penetrator.esc(t) + '</span>' : '') +
                '<span class="qa9-point-d">' + Penetrator.esc(d) + '</span></li>';
      });
      html += '</ol></div>';
    }
    // ③ 法规依据 / 检索来源（折叠，按需展开，节省首屏空间）
    if (src === 'local' || src === 'rag' || src === 'hybrid') {
      html += '<details class="qa9-supp"><summary>📚 法规依据</summary>' + this._citeBlock(rag) + '</details>';
    }
    if (src === 'web' || src === 'hybrid') {
      html += '<details class="qa9-supp"><summary>🌐 检索来源</summary>' + this._webBlock(rag) + '</details>';
    }
    // ④ 推理过程（折叠，默认收起）
    if (B.thinking) {
      html += '<details class="qa9-think"><summary class="qa9-think-sum">💡 推理过程<span class="qa9-think-hint">（点击展开）</span></summary>' +
              '<div class="qa9-think-body">' + lines(B.thinking) + '</div></details>';
    }
    // ⑤ 适用提示 + 风险提示 + 时效说明 —— 合并为一个「补充说明」折叠块
    const suppParts = [];
    if (B.tips) suppParts.push('<div class="qa9-supp-item"><span class="qa9-supp-k">适用提示</span><div class="qa9-supp-v">' + lines(B.tips) + '</div></div>');
    if (B.risk) suppParts.push('<div class="qa9-supp-item qa9-supp-risk"><span class="qa9-supp-k">风险提示</span><div class="qa9-supp-v">' + lines(B.risk) + '</div></div>');
    if (B.timeNote) suppParts.push('<div class="qa9-supp-item"><span class="qa9-supp-k">时效说明</span><div class="qa9-supp-v">' + lines(B.timeNote) + '</div></div>');
    if (suppParts.length) {
      html += '<details class="qa9-supp"><summary>📌 补充说明</summary><div class="qa9-supp-body">' + suppParts.join('') + '</div></details>';
    }
    // ⑥ 延伸问题（可点击继续追问）
    const fu = B.followUps || [];
    if (fu.length) {
      html += '<div class="qa9-followups"><div class="qa9-followups-h">🔎 你可能还想问</div><div class="qa9-followup-row">';
      fu.forEach((q) => {
        html += '<button type="button" class="qa9-followup" data-q="' + Penetrator.esc(q) + '">' +
                Penetrator.esc(q) + '</button>';
      });
      html += '</div></div>';
    }
    // ⑦ AI 拓展（低调内联，不再独占一段）
    html += '<div class="qa9-expand-inline"><button type="button" class="qa9-expand-btn" data-expand="1">🤖 AI 拓展此回答</button></div>';
    return html;
  },

  // 【法规依据】内容（折叠块内复用，仅返回内部列表）
  _citeBlock(rag) {
    const hits = rag.kb_hits || [];
    const note = hits.length
      ? '本次调阅本地法规原文 ' + hits.length + ' 篇（3096 篇全文库），由大模型解读'
      : '依据来自海云AI 本地法规库 + 大模型解读';
    let html = '<div class="qa9-src-note">' + Penetrator.esc(note) + '</div>';
    html += this._sqHtml(rag.search_queries, '📚 本地库检索式');
    html += '<div class="qa9-cite-list">';
    const basis = rag['法规依据'] || [];
    if (basis.length) basis.forEach((c, i) => { html += this.ragCardHtml(c, i + 1); });
    else if (hits.length) hits.forEach((c, i) => { html += this.ragCardHtml(c, i + 1); });
    else html += '<div class="qa9-empty">未检索到明确依据。</div>';
    return html + '</div>';
  },

  // 【实时检索来源】内容（折叠块内复用，仅返回内部列表）
  _webBlock(rag) {
    const ws = rag.web_sources || [];
    let html = '<div class="qa9-src-note">以下为实时网络检索结果（点击可跳转原文）</div>';
    if (rag.source !== 'hybrid') html += this._sqHtml(rag.search_queries, '🔍 AI 提炼的检索式');
    html += '<div class="qa9-web-src-list">';
    if (ws.length) ws.forEach((s, i) => { html += this.webSrcHtml(s, i + 1); });
    else html += '<div class="qa9-empty">本次未检索到外部来源（可能当前网络受限，可切换网络后重试）。</div>';
    return html + '</div>';
  },

  // 检索式标签行：展示「AI 决定搜什么」，让思考过程可见
  _sqHtml(sq, label) {
    if (!sq || !sq.length) return '';
    return '<div class="qa9-sq">' + label + '：' +
           sq.slice(0, 8).map(s => '<span class="qa9-sq-tag">' + Penetrator.esc(s) + '</span>').join('') +
           '</div>';
  },

  // 渲染 RAG 返回的法规依据卡片（字段：标题/引用原文/本地路径/来源/文号/发布日期/状态）
  ragCardHtml(c, n) {
    const st = c['状态'] || '';
    const tier = this.stTier(st);
    let badge, bcls;
    if (tier === 0) { badge = '现行有效'; bcls = 'valid'; }
    else if (tier === 1) { badge = '试行'; bcls = 'trial'; }
    else if (tier === 2) { badge = '尚未生效'; bcls = 'pending'; }
    else if (tier === 3) { badge = '参考'; bcls = 'ref'; }
    else if (tier <= 5) { badge = '征求意见'; bcls = 'draft'; }
    else { badge = '已废止'; bcls = 'repealed'; }
    const title = (n ? n + '. ' : '') + '《' + (c['标题'] || '') + '》';
    const metaParts = [c['发布机构'], c['文号'], c['发布日期'], st].filter(Boolean).map(x => Penetrator.esc(x));
    const meta = metaParts.length ? '（' + metaParts.join('，') + '）' : '';
    const quote = c['引用原文']
      ? '<div class="qa9-card-hit">原文摘录：' + Penetrator.esc(this._clip(c['引用原文'], 400)) + '</div>'
      : '';
    const local = c['本地路径']
      ? '<div class="qa9-card-local">本地：' + Penetrator.esc(c['本地路径']) + '</div>'
      : '';
    const src = c['来源'] ? '<a class="qa9-src" href="' + Penetrator.esc(c['来源']) + '" target="_blank" rel="noopener">🔗 官方来源 ↗</a>' : '';
    return '<div class="qa9-card ' + bcls + '">' +
      '<div class="qa9-card-top"><span class="qa9-badge ' + bcls + '">' + badge + '</span>' +
      '<span class="qa9-card-title">' + Penetrator.esc(title) + '</span></div>' +
      '<div class="qa9-card-meta">' + meta + '</div>' +
      quote + local + src + '</div>';
  },

  // 渲染联网搜索返回的实时检索来源卡片（标题可点击跳转原文 + 摘要）
  webSrcHtml(s, n) {
    const title = (n ? n + '. ' : '') + (s['标题'] || s.title || '来源');
    const url = s['url'] || s.URL || '';
    const snippet = s['摘要'] || s.snippet || s.content || '';
    const host = (() => { try { return new URL(url).hostname; } catch (e) { return ''; } })();
    const titleHtml = url
      ? '<a class="qa9-web-src-title" href="' + Penetrator.esc(url) + '" target="_blank" rel="noopener">' + Penetrator.esc(title) + ' ↗</a>'
      : '<span class="qa9-web-src-title">' + Penetrator.esc(title) + '</span>';
    const meta = host ? '<div class="qa9-web-src-host">🔗 ' + Penetrator.esc(host) + '</div>' : '';
    const snip = snippet ? '<div class="qa9-web-src-snippet">' + Penetrator.esc(this._clip(snippet, 220)) + '</div>' : '';
    return '<div class="qa9-web-src">' + titleHtml + meta + snip + '</div>';
  },

  qaCardHtml(d, n) {
    const tier = d.tier == null ? 3 : d.tier;
    let badge, bcls;
    if (tier === 0) { badge = '现行有效'; bcls = 'valid'; }
    else if (tier === 1) { badge = '试行'; bcls = 'trial'; }
    else if (tier === 2) { badge = '尚未生效'; bcls = 'pending'; }
    else if (tier === 3) { badge = '参考'; bcls = 'ref'; }
    else if (tier <= 5) { badge = '征求意见'; bcls = 'draft'; }
    else { badge = '已废止'; bcls = 'repealed'; }
    // 统一引用格式：《标题》（发布机构，文号，发布日期，状态）
    const title = (n ? n + '. ' : '') + '《' + (d.t || '') + '》';
    const metaParts = [d.i, d.d, d.p, d.st].filter(Boolean).map(x => Penetrator.esc(x));
    const meta = metaParts.length ? '（' + metaParts.join('，') + '）' : '';
    const hit = d._hit
      ? '<div class="qa9-card-hit">原文摘录：' + Penetrator.esc(this._clip(d._hit, 160)) + '</div>'
      : (d.m ? '<div class="qa9-card-hit">摘要：' + Penetrator.esc(this._clip(d.m, 160)) + '</div>' : '');
    const local = d.local
      ? '<div class="qa9-card-local">本地：' + Penetrator.esc(d.local) + '</div>'
      : '';
    const src = d.u ? '<a class="qa9-src" href="' + Penetrator.esc(d.u) + '" target="_blank" rel="noopener">🔗 官方来源 ↗</a>' : '';
    return '<div class="qa9-card ' + bcls + '">' +
      '<div class="qa9-card-top"><span class="qa9-badge ' + bcls + '">' + badge + '</span>' +
      '<span class="qa9-card-title">' + Penetrator.esc(title) + '</span></div>' +
      '<div class="qa9-card-meta">' + meta + '</div>' +
      hit + local + src +
      '</div>';
  }
};

// 暴露为全局属性，供全局委托点击（knowledge-portal.js）与内联 onclick 处理器访问
globalThis.App = App;
if (typeof window !== 'undefined') window.App = App;

// 兼容旧搜索调用名
App.selectDrugType = function (id) { this.selectVariety(id); };

/* ============================================================
 * Penetrator —— 识林式「穿透」引擎
 *   1) 术语穿透：正文/卡片中的关键术语（首次出现）→ 悬浮卡（释义+来源法规）
 *   2) 法规互引穿透：《XX法》《XX办法》引用 → 跳转应用内该法规原文
 * ============================================================ */
const Penetrator = {
  terms: [],
  byWord: null,
  re: null,
  ready: false,

  init() {
    const T = globalThis.PEN_TERMS || [];
    this.terms = T.map((t, i) => Object.assign({ id: i }, t));
    const words = [];
    this.terms.forEach(t => {
      words.push([t.t, t.id]);
      (t.a || []).forEach(a => words.push([a, t.id]));
    });
    const seen = new Set();
    const uniq = [];
    words.forEach(([w, id]) => { if (w && !seen.has(w)) { seen.add(w); uniq.push([w, id]); } });
    uniq.sort((a, b) => b[0].length - a[0].length); // 长词优先，避免部分覆盖
    this.byWord = new Map(uniq);
    const alt = uniq.map(([w]) => this.escRe(w)).join('|');
    this.re = alt ? new RegExp('《[^《》\\n]{2,40}》|' + alt, 'g') : /《[^《》\n]{2,40}》/g;
    this.ready = true;
  },

  escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); },
  esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
  termById(id) { return this.terms[+id]; },

  regIdForTerm(t) {
    if (!t || !t.r) return null;
    const R = globalThis.REG_INDEX || [];
    const hit = R.find(x => x.title.includes(t.r)) || R.find(x => x.file.includes(t.r)) || R.find(x => x.sub && x.sub.includes(t.r));
    return hit ? hit.id : null;
  },

  regIdByCitation(name) {
    const R = globalThis.REG_INDEX || [];
    const n = name.replace(/^《|》$/g, '').trim();
    if (n.length < 3) return null;
    let hit = R.find(x => x.title === n)
      || R.find(x => x.title.includes(n))
      || R.find(x => { const base = x.title.replace(/[（(].*?[)）]/g, '').trim(); return base.length > 4 && (n.includes(base) || base.includes(n)); });
    return hit ? hit.id : null;
  },

  /** 原始文本 → 转义后的 HTML（带穿透链接）。opts.used 为跨文本块去重的 Set。 */
  penetrate(raw, opts) {
    opts = opts || {};
    const used = opts.used || new Set();
    const text = String(raw == null ? '' : raw);
    if (!this.ready || !text) return this.esc(text);
    let out = '', last = 0, m;
    this.re.lastIndex = 0;
    while ((m = this.re.exec(text))) {
      const idx = m.index, matched = m[0];
      if (matched.length === 0) { this.re.lastIndex++; continue; }
      out += this.esc(text.slice(last, idx));
      if (matched[0] === '《') {
        const rid = this.regIdByCitation(matched);
        out += rid
          ? '<a class="pen-reg" data-rid="' + rid + '" title="查看应用内原文">' + this.esc(matched) + '</a>'
          : this.esc(matched);
      } else {
        const id = this.byWord.get(matched);
        if (id != null && !used.has(id)) {
          used.add(id);
          out += '<a class="pen-term" data-tid="' + id + '" tabindex="0">' + this.esc(matched) + '</a>';
        } else {
          out += this.esc(matched);
        }
      }
      last = idx + matched.length;
    }
    out += this.esc(text.slice(last));
    return out;
  }
};
globalThis.Penetrator = Penetrator;

/* ============================================================
 * App 扩展：穿透辅助 + 术语悬浮卡 + 法规原文库 + Markdown 渲染
 * ============================================================ */
Object.assign(App, {

  /** 卡片/清单文本穿透（首次出现去重按单条文本） */
  pen(text) {
    return (globalThis.Penetrator && Penetrator.ready) ? Penetrator.penetrate(text) : Penetrator.esc(text);
  },

  /* ---------- 术语悬浮卡 ---------- */
  initPenCard() {
    if (this._penCard) return;
    const card = document.createElement('div');
    card.id = 'penCard';
    card.className = 'pen-card';
    card.style.display = 'none';
    document.body.appendChild(card);
    this._penCard = card;

    let hideT = null;
    const scheduleHide = () => { hideT = setTimeout(() => { card.style.display = 'none'; }, 200); };
    const cancelHide = () => { if (hideT) { clearTimeout(hideT); hideT = null; } };
    card.addEventListener('mouseenter', cancelHide);
    card.addEventListener('mouseleave', scheduleHide);

    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest && e.target.closest('.pen-term');
      if (t) { cancelHide(); this.showPenCard(t); }
    });
    document.addEventListener('mouseout', (e) => {
      const t = e.target.closest && e.target.closest('.pen-term');
      if (t) scheduleHide();
    });
    document.addEventListener('focusin', (e) => {
      const t = e.target.closest && e.target.closest('.pen-term');
      if (t) { cancelHide(); this.showPenCard(t); }
    });

    document.addEventListener('click', (e) => {
      const term = e.target.closest && e.target.closest('.pen-term');
      if (term) { e.preventDefault(); cancelHide(); this.showPenCard(term); return; }
      const aiBtn = e.target.closest && e.target.closest('.pen-card-ai');
      if (aiBtn) { e.preventDefault(); cancelHide(); this._penAiExplain(aiBtn.dataset.term, card); return; }
      const srcBtn = e.target.closest && e.target.closest('.pen-card-source');
      if (srcBtn) { e.preventDefault(); card.style.display = 'none'; if (srcBtn.dataset.rid) this.openRegulation(srcBtn.dataset.rid); return; }
      const reg = e.target.closest && e.target.closest('.pen-reg');
      if (reg) { e.preventDefault(); if (reg.dataset.rid) this.openRegulation(reg.dataset.rid); return; }
    });
  },

  showPenCard(el) {
    const t = Penetrator.termById(el.dataset.tid);
    if (!t) return;
    const rid = Penetrator.regIdForTerm(t);
    const reg = rid != null ? (globalThis.REG_INDEX || []).find(r => r.id === rid) : null;
    const aliases = (t.a && t.a.length) ? '<div class="pen-card-alias">' + t.a.map(a => Penetrator.esc(a)).join(' · ') + '</div>' : '';
    const aiBtn = '<button type="button" class="pen-card-ai" data-term="' + Penetrator.esc(t.t) + '">🤖 AI 深入解释</button>';
    const src = (reg ? '<button class="pen-card-source" data-rid="' + reg.id + '">📖 来源法规《' + Penetrator.esc(reg.title) + '》 →</button>' : '') + aiBtn;
    this._penCard.innerHTML =
      '<div class="pen-card-head"><span class="pen-card-term">' + Penetrator.esc(t.t) + '</span><span class="pen-card-cat">' + Penetrator.esc(t.c) + '</span></div>' +
      aliases +
      '<div class="pen-card-def">' + Penetrator.esc(t.d) + '</div>' +
      src;
    const card = this._penCard;
    card.style.display = 'block';
    const r = el.getBoundingClientRect();
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let left = r.left, top = r.bottom + 8;
    if (left + cw > window.innerWidth - 12) left = window.innerWidth - cw - 12;
    if (left < 12) left = 12;
    if (top + ch > window.innerHeight - 12) top = r.top - ch - 8;
    if (top < 12) top = 12;
    card.style.left = left + 'px';
    card.style.top = top + 'px';
  },

  /** 对已渲染的 DOM 子树做文本节点穿透（用于法规原文阅读器） */
  penetrateDom(root) {
    if (!Penetrator.ready || !root) return;
    const used = new Set();
    const skip = { A: 1, CODE: 1, PRE: 1, SCRIPT: 1, STYLE: 1, BUTTON: 1, H1: 0 };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        let p = n.parentNode;
        while (p && p !== root) {
          if (skip[p.nodeName]) return NodeFilter.FILTER_REJECT;
          if (p.classList && (p.classList.contains('pen-term') || p.classList.contains('pen-reg'))) return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const targets = [];
    let node;
    while ((node = walker.nextNode())) targets.push(node);
    targets.forEach(n => {
      const html = Penetrator.penetrate(n.nodeValue, { used });
      if (html.indexOf('<a') === -1) return;
      const tmp = document.createElement('span');
      tmp.innerHTML = html;
      const frag = document.createDocumentFragment();
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      n.parentNode.replaceChild(frag, n);
    });
  },

  /* ---------- 法规原文库 ---------- */
  initRegLibrary() {
    const btn = document.getElementById('regLibBtn');
    if (btn) btn.addEventListener('click', () => {
      this.state.regLibOpen ? this.closeRegulationLibrary() : this.openRegulationLibrary();
    });
    const closeBtn = document.getElementById('regLibClose');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeRegulationLibrary());
    const search = document.getElementById('regSearchInput');
    if (search) search.addEventListener('input', () => {
      this.state.regQuery = search.value || '';
      this.renderRegDocList();
    });
  },

  _exitRegLib() {
    this.state.regLibOpen = false;
    const lib = document.getElementById('regulationLibrary');
    if (lib) lib.style.display = 'none';
    const btn = document.getElementById('regLibBtn');
    if (btn) btn.classList.remove('active');
    const bc = document.getElementById('breadcrumb'); if (bc) bc.style.display = '';
    const st = document.getElementById('stageTabs'); if (st) st.style.display = '';
  },

  openRegulationLibrary() {
    this.state.regLibOpen = true;
    ['breadcrumb', 'stageTabs', 'detailLayout', 'matrixView'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    const lib = document.getElementById('regulationLibrary'); if (lib) lib.style.display = 'flex';
    const btn = document.getElementById('regLibBtn'); if (btn) btn.classList.add('active');
    this.renderRegCatFilters();
    this.renderRegDocList();
    if (this.state.currentRegId) this.openRegulation(this.state.currentRegId);
  },

  closeRegulationLibrary() {
    this.state.regLibOpen = false;
    const lib = document.getElementById('regulationLibrary'); if (lib) lib.style.display = 'none';
    const btn = document.getElementById('regLibBtn'); if (btn) btn.classList.remove('active');
    if (this.state.view === 'classification') {
      const bc = document.getElementById('breadcrumb'); if (bc) bc.style.display = 'none';
      const st = document.getElementById('stageTabs'); if (st) st.style.display = 'none';
      const dl = document.getElementById('detailLayout'); if (dl) dl.style.display = '';
    } else {
      const bc = document.getElementById('breadcrumb'); if (bc) bc.style.display = '';
      const st = document.getElementById('stageTabs'); if (st) st.style.display = '';
      if (this.state.viewMode === 'matrix') {
        const mv = document.getElementById('matrixView'); if (mv) mv.style.display = '';
      } else {
        const dl = document.getElementById('detailLayout'); if (dl) dl.style.display = '';
      }
    }
  },

  renderRegCatFilters() {
    const el = document.getElementById('regCatFilters'); if (!el) return;
    const R = this._regList();
    const order = ['法律', '行政法规', '部门规章', '技术指导原则', '规范性文件', '行业共识', '更新日志'];
    const counts = {}; R.forEach(r => { const c = r.cat || '其他'; counts[c] = (counts[c] || 0) + 1; });
    const cats = order.filter(c => counts[c]).concat(Object.keys(counts).filter(c => order.indexOf(c) < 0));
    let html = '<button class="reg-cat-btn ' + (this.state.regCat === 'all' ? 'active' : '') + '" data-cat="all">全部 ' + R.length + '</button>';
    cats.forEach(c => { html += '<button class="reg-cat-btn ' + (this.state.regCat === c ? 'active' : '') + '" data-cat="' + Penetrator.esc(c) + '">' + Penetrator.esc(c) + ' ' + counts[c] + '</button>'; });
    el.innerHTML = html;
    el.querySelectorAll('.reg-cat-btn').forEach(b => b.addEventListener('click', () => {
      this.state.regCat = b.dataset.cat;
      this.renderRegCatFilters();
      this.renderRegDocList();
    }));
  },

  renderRegDocList() {
    const el = document.getElementById('regDocList'); if (!el) return;
    const q = (this.state.regQuery || '').trim().toLowerCase();
    const R = this._regList();
    let list = R.filter(r => this.state.regCat === 'all' || r.cat === this.state.regCat);
    if (q) list = list.filter(r =>
      r.title.toLowerCase().includes(q) ||
      (r.summary && r.summary.toLowerCase().includes(q)) ||
      (r.issuer && r.issuer.toLowerCase().includes(q))
    );
    list.sort((a, b) => (a.tier - b.tier) || a.title.localeCompare(b.title, 'zh'));
    let html = '';
    if (!list.length) {
      html = '<div class="reg-doc-empty">无匹配法规</div>';
    } else {
      const order = ['法律', '行政法规', '部门规章', '技术指导原则', '规范性文件', '行业共识', '更新日志'];
      const groups = {};
      list.forEach(r => { const c = r.cat || '其他'; (groups[c] = groups[c] || []).push(r); });
      const catOrder = order.filter(c => groups[c]).concat(Object.keys(groups).filter(c => order.indexOf(c) < 0));
      catOrder.forEach(cat => {
        const items = groups[cat];
        html += '<div class="reg-doc-group-title">' + Penetrator.esc(cat) + ' <span>' + items.length + '</span></div>';
        items.forEach(r => {
          const tierBadge = r.tier === 9 ? '<span class="reg-doc-badge seed">废止/征求</span>'
                           : r.tier === 0 ? '<span class="reg-doc-badge full">现行</span>'
                           : '<span class="reg-doc-badge zh">其他</span>';
          html += '<div class="reg-doc-item ' + (this.state.currentRegId === r.id ? 'active' : '') + '" data-id="' + Penetrator.esc(r.id) + '">' +
            '<div class="reg-doc-item-title">' + Penetrator.esc(r.title) + '</div>' +
            '<div class="reg-doc-item-meta">' + tierBadge +
            (r.issuer ? '<span class="reg-doc-sub">' + Penetrator.esc(r.issuer) + '</span>' : '') +
            (r.effective ? '<span class="reg-doc-date">' + Penetrator.esc(r.effective) + '</span>' : '') +
            '</div></div>';
        });
      });
    }
    el.innerHTML = html;
    el.querySelectorAll('.reg-doc-item').forEach(it => it.addEventListener('click', () => this.openRegulation(it.dataset.id)));
  },

  openRegulation(idOrPath, lang) {
    if (typeof lang === 'string') this.state.regLang = lang;
    if (!this.state.regLibOpen) this.openRegulationLibrary();
    this._regList();
    const reg = this._resolveRegId(idOrPath) || (this._regByPath && this._regByPath[idOrPath]) || null;
    if (!reg) return;
    this.state.currentRegId = reg.id;
    const list = document.getElementById('regDocList');
    if (list) {
      list.querySelectorAll('.reg-doc-item').forEach(it => it.classList.toggle('active', it.dataset.id === reg.id));
      const act = list.querySelector('.reg-doc-item.active');
      if (act) act.scrollIntoView({ block: 'nearest' });
    }
    const reader = document.getElementById('regReader'); if (!reader) return;
    reader.innerHTML = '<div class="reg-reader-loading">正在载入《' + Penetrator.esc(reg.title) + '》…</div>';
    const url = this._apiUrl('/api/reg?path=') + encodeURIComponent(reg.path);
    fetch(url, { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        const meta = (d && d.meta) || reg;
        const body = (d && d.body) || '';
        const bodyHtml = body ? this.mdToHtml(body)
          : (meta.summary ? this.mdToHtml(meta.summary)
            : '<p class="reg-reader-empty">该法规正文暂未入库，请点击下方官方来源查看权威全文。</p>');
        const issuer = meta.issuer || reg.issuer || '';
        const eff = meta.effective_date || meta.effective || reg.effective || '';
        const status = meta.status || reg.status || '';
        const metaLine = [issuer, eff ? ('施行 ' + eff) : '', status].filter(Boolean).map(x => Penetrator.esc(x)).join(' · ');
        const src = (meta.source_url || reg.url)
          ? '<a class="reg-official-link" href="' + Penetrator.esc(meta.source_url || reg.url) + '" target="_blank" rel="noopener">🔗 官方来源全文 ↗</a>' : '';
        const aiBtn = '<button type="button" class="reg-ai-btn" id="regAiExpandBtn" title="让 海云AI 拓展解读本条法规">🤖 AI 拓展解读</button>';
        reader.innerHTML =
          '<div class="reg-reader-inner">' +
          '<div class="reg-reader-head">' +
          '<div class="reg-reader-cat">' + Penetrator.esc(reg.cat || '') + '</div>' +
          '<h1 class="reg-reader-title">' + Penetrator.esc(reg.title) + '</h1>' +
          '<div class="reg-reader-meta">' + metaLine + '</div>' + src + aiBtn +
          '</div>' +
          '<div class="reg-tabs">' +
            '<button type="button" class="reg-tab active" data-tab="origin">📜 原文</button>' +
            '<button type="button" class="reg-tab" data-tab="terms">🔤 术语表<span class="reg-tab-badge" id="regTermsBadge"></span></button>' +
            '<button type="button" class="reg-tab" data-tab="rel">🔗 关系网络<span class="reg-tab-badge" id="regRelBadge"></span></button>' +
            '<button type="button" class="reg-tab" data-tab="prod">🧬 适用产品<span class="reg-tab-badge" id="regProdBadge"></span></button>' +
          '</div>' +
          '<div class="reg-tab-panel" id="regTabOrigin" style="display:block;">' +
            '<div class="reg-reader-body">' + bodyHtml + '</div>' +
            '<div class="reg-ai-box" id="regAiBox" style="display:none;"></div>' +
          '</div>' +
          '<div class="reg-tab-panel" id="regTabTerms" style="display:none;"></div>' +
          '<div class="reg-tab-panel" id="regTabRel" style="display:none;"></div>' +
          '<div class="reg-tab-panel" id="regTabProd" style="display:none;"></div>' +
          '</div>';
        const ab = reader.querySelector('#regAiExpandBtn');
        if (ab) ab.addEventListener('click', () => this._regAiExpand(reg));
        const bodyEl = reader.querySelector('#regTabOrigin .reg-reader-body');
        if (bodyEl) this.penetrateDom(bodyEl);
        // 计算徽标数量（术语 / 关系 / 产品）
        const terms = this._regFindTerms(body);
        const relArr = (globalThis.REG_RELATIONS && globalThis.REG_RELATIONS.byPath[reg.path]) || [];
        const prodArr = (globalThis.REG_PRODUCTS && globalThis.REG_PRODUCTS.byPath[reg.path]) || [];
        const tb = id => reader.querySelector(id);
        if (tb('#regTermsBadge')) tb('#regTermsBadge').textContent = terms.length ? terms.length : '';
        if (tb('#regRelBadge')) tb('#regRelBadge').textContent = relArr.length ? relArr.length : '';
        if (tb('#regProdBadge')) tb('#regProdBadge').textContent = prodArr.length ? prodArr.length : '';
        const panelMap = { origin: 'regTabOrigin', terms: 'regTabTerms', rel: 'regTabRel', prod: 'regTabProd' };
        reader.querySelectorAll('.reg-tab').forEach(btn => btn.addEventListener('click', () => {
          const tab = btn.dataset.tab;
          reader.querySelectorAll('.reg-tab').forEach(x => x.classList.toggle('active', x === btn));
          Object.keys(panelMap).forEach(k => {
            const p = reader.querySelector('#' + panelMap[k]);
            if (p) p.style.display = (k === tab) ? 'block' : 'none';
          });
          if (tab === 'terms' && tb('#regTabTerms') && !tb('#regTabTerms').dataset.done) this._renderRegTerms(reader, terms);
          if (tab === 'rel' && tb('#regTabRel') && !tb('#regTabRel').dataset.done) this._renderRegRelations(reader, reg.path);
          if (tab === 'prod' && tb('#regTabProd') && !tb('#regTabProd').dataset.done) this._renderRegProducts(reader, reg.path);
        }));
        reader.scrollTop = 0;
      })
      .catch(err => {
        reader.innerHTML = '<div class="reg-reader-loading">载入失败（' + Penetrator.esc(String(err)) + '）。' +
          (reg.url ? '可点击 <a href="' + Penetrator.esc(reg.url) + '" target="_blank" rel="noopener">官方来源</a> 查看。' : '') + '</div>';
      });
  },

  // 在法规正文中查找命中的穿透术语（去重）
  _regFindTerms(body) {
    const PEN = globalThis.PEN_TERMS || [];
    if (!body) return [];
    const found = [], seen = new Set();
    PEN.forEach(t => {
      if (!t || seen.has(t.t)) return;
      const names = [t.t].concat(t.a || []);
      if (names.some(n => n && body.indexOf(n) >= 0)) { seen.add(t.t); found.push(t); }
    });
    return found;
  },

  _renderRegTerms(reader, terms) {
    const panel = reader.querySelector('#regTabTerms');
    if (!panel) return;
    panel.dataset.done = '1';
    if (!terms || !terms.length) { panel.innerHTML = '<div class="reg-panel-empty">本法规正文未命中术语库术语。</div>'; return; }
    let html = '<div class="reg-term-list">';
    terms.forEach(t => {
      const alias = (t.a && t.a.length) ? ('（' + t.a.join('、') + '）') : '';
      html += '<div class="reg-term-card">' +
        '<div class="reg-term-head"><span class="reg-term-name">' + Penetrator.esc(t.t) + '</span>' +
        '<span class="reg-term-cat">' + Penetrator.esc(t.c || '') + '</span>' +
        (alias ? '<span class="reg-term-alias">' + Penetrator.esc(alias) + '</span>' : '') + '</div>' +
        '<p class="reg-term-desc">' + Penetrator.esc(t.d || '') + '</p>' +
        (t.r ? '<div class="reg-term-rel">来源关联：' + Penetrator.esc(t.r) + '</div>' : '') +
        '</div>';
    });
    html += '</div>';
    panel.innerHTML = html;
  },

  _renderRegRelations(reader, path) {
    const panel = reader.querySelector('#regTabRel');
    if (!panel) return;
    panel.dataset.done = '1';
    const arr = (globalThis.REG_RELATIONS && globalThis.REG_RELATIONS.byPath[path]) || [];
    if (!arr.length) { panel.innerHTML = '<div class="reg-panel-empty">暂无关联法规（本库内未建立与该法规的层级／引用关系）。</div>'; return; }
    const typeLabel = { parent: '上位法', child: '下位／配套', supersede: '替代', related: '相关' };
    let html = '<div class="reg-rel-list">';
    arr.forEach(e => {
      const dirTxt = e.dir === 'in' ? '← 被引用' : '→ 引用';
      html += '<div class="reg-rel-item">' +
        '<span class="reg-rel-type ' + Penetrator.esc(e.type) + '">' + (typeLabel[e.type] || e.type) + '</span>' +
        '<span class="reg-rel-title" data-path="' + Penetrator.esc(e.target) + '">' + Penetrator.esc(e.targetTitle) + '</span>' +
        '<span class="reg-rel-dir">' + dirTxt + '</span>' +
        (e.note ? '<span class="reg-rel-note">' + Penetrator.esc(e.note) + '</span>' : '') +
        '</div>';
    });
    html += '</div>';
    panel.innerHTML = html;
    panel.querySelectorAll('.reg-rel-title[data-path]').forEach(el => {
      el.addEventListener('click', () => { const p = el.dataset.path; if (p) this.openRegulation(p); });
    });
  },

  _renderRegProducts(reader, path) {
    const panel = reader.querySelector('#regTabProd');
    if (!panel) return;
    panel.dataset.done = '1';
    const arr = (globalThis.REG_PRODUCTS && globalThis.REG_PRODUCTS.byPath[path]) || [];
    if (!arr.length) { panel.innerHTML = '<div class="reg-panel-empty">本法规暂无关联产品（质量体系知识库中未引用该法规）。</div>'; return; }
    const groups = {};
    arr.forEach(e => {
      const c = e.category || '其他', v = e.variety || '通用';
      groups[c] = groups[c] || {};
      groups[c][v] = groups[c][v] || [];
      groups[c][v].push(e);
    });
    let html = '';
    Object.keys(groups).forEach(cat => {
      html += '<div class="reg-prod-group"><div class="reg-prod-group-title">' + Penetrator.esc(cat) + '</div><div class="reg-prod-cards">';
      Object.keys(groups[cat]).forEach(v => {
        const items = groups[cat][v];
        html += '<div class="reg-prod-card"><div class="reg-prod-variety">' + Penetrator.esc(v) + '</div><div class="reg-prod-stages">';
        items.forEach(e => {
          const cls = e.refType === 'quality_mgmt' ? 'reg-prod-chip qm' : 'reg-prod-chip';
          const tag = e.refType === 'quality_mgmt' ? '·质管' : '';
          html += '<span class="' + cls + '">' + Penetrator.esc(e.stageName || e.stage) + tag + '</span>';
        });
        html += '</div>';
        if (items[0] && !items[0].resolved) html += '<div class="reg-prod-unresolved">（该法规未在原文库收录，仅记录于质量体系关联）</div>';
        html += '</div>';
      });
      html += '</div></div>';
    });
    panel.innerHTML = html;
  },

  // 法规原文库统一数据源：直接来自知识库（REG_KB_FULL，kb.sqlite 导出的全量索引，与知识库数量一致）
  _regList() {
    const FULL = globalThis.REG_KB_FULL || [];
    if (this._regListCache) return this._regListCache;
    const list = FULL.map(d => ({
      id: d.path,
      title: d.t || '',
      issuer: d.i || '',
      cat: (d.c || '').replace(/^\d+_/, ''),
      category: d.c || '',
      publish: d.p || '',
      effective: d.e || '',
      status: d.st || '',
      url: d.u || '',
      summary: d.m || '',
      path: d.path || '',
      tier: (typeof d.tier === 'number') ? d.tier : 9
    }));
    this._regByPath = {};
    this._titleToPath = {};
    this._titleNormToPath = {};
    const norm = s => (s || '').replace(/[（）()\s]/g, '');
    list.forEach(r => {
      if (r.path) this._regByPath[r.path] = r;
      if (r.title) { this._titleToPath[r.title] = r.path; this._titleNormToPath[norm(r.title)] = r.path; }
    });
    this._regListCache = list;
    return list;
  },

  // 兼容旧调用：术语卡 / 分类关联法规传入的是 REG_INDEX 的 id（reg_XXX），需解析成 path
  _resolveRegId(idOrPath) {
    if (!idOrPath) return null;
    if (idOrPath.indexOf('reg_') === 0) {
      const ri = (globalThis.REG_INDEX || []).find(r => r.id === idOrPath);
      if (ri) {
        const n = (ri.title || '').replace(/[（）()\s]/g, '');
        const path = this._titleToPath[ri.title] || (n && this._titleNormToPath[n]);
        if (path) return this._regByPath[path] || null;
      }
      return null;
    }
    return this._regByPath[idOrPath] || null;
  },

  _apiUrl(p) {
    const base = (this.qaApiBase === '/' || this.qaApiBase === 'same-origin' || !this.qaApiBase) ? '' : this.qaApiBase;
    return base + p;
  },

  // 通用 AI 拓展 / 术语解释（POST /api/explain）
  async explainText(text, context) {
    const url = this._apiUrl('/api/explain');
    if (!url) return { fallback: true, error: 'no backend' };
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, context: context || '' })
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        return { fallback: true, error: j.error || resp.status };
      }
      return await resp.json();
    } catch (e) { return { fallback: true, error: String(e) }; }
  },

  // 法规阅读器中的「🤖 AI 拓展解读」
  async _regAiExpand(reg) {
    const box = document.getElementById('regAiBox'); if (!box) return;
    if (box.dataset.loading === '1') return;
    box.dataset.loading = '1';
    box.style.display = 'block';
    box.innerHTML = '<div class="reg-ai-loading">🤖 海云AI 正在拓展解读《' + Penetrator.esc(reg.title) + '》…</div>';
    const ctx = '标题：' + reg.title + (reg.summary ? '\n要点：' + reg.summary : '');
    try {
      const resp = await this.explainText(reg.title, ctx);
      if (resp && resp.fallback) {
        box.innerHTML = '<div class="reg-ai-res">⚠️ 当前未配置 AI 模型或调用受限，无法生成拓展解读。请在「AI 模型设置」中配置后重试。</div>';
      } else if (resp && resp.explain) {
        box.innerHTML = '<div class="reg-ai-res"><div class="reg-ai-res-h">🤖 AI 拓展解读</div>' + this.mdToHtml(resp.explain) + '</div>';
        const el = box.querySelector('.reg-ai-res'); if (el) this.penetrateDom(el);
      } else {
        box.innerHTML = '<div class="reg-ai-res">未获取到解读内容。</div>';
      }
    } catch (e) {
      box.innerHTML = '<div class="reg-ai-res">拓展解读失败：' + Penetrator.esc(String(e)) + '</div>';
    } finally {
      box.dataset.loading = '0';
    }
  },

  // 术语悬浮卡中的「🤖 AI 深入解释」
  async _penAiExplain(term, card) {
    if (!card) card = this._penCard;
    if (!card) return;
    if (card.dataset.aiLoading === '1') return;
    card.dataset.aiLoading = '1';
    let resEl = card.querySelector('.pen-card-ai-res');
    if (!resEl) {
      resEl = document.createElement('div');
      resEl.className = 'pen-card-ai-res pen-loading';
      card.appendChild(resEl);
    } else {
      resEl.className = 'pen-card-ai-res pen-loading';
    }
    resEl.textContent = '🤖 正在生成解释…';
    try {
      const resp = await this.explainText(term, '');
      if (resp && resp.fallback) {
        resEl.className = 'pen-card-ai-res';
        resEl.textContent = '⚠️ 未配置 AI 模型，无法生成解释。';
      } else {
        resEl.className = 'pen-card-ai-res';
        resEl.innerHTML = '<b>🤖 AI 解释</b><br>' + this.mdToHtml(resp && resp.explain ? resp.explain : '');
        this.penetrateDom(resEl);
      }
    } catch (e) {
      resEl.className = 'pen-card-ai-res';
      resEl.textContent = '解释失败：' + e;
    } finally {
      card.dataset.aiLoading = '0';
    }
  },

  // 全局：选中文字 → 浮动「🤖 AI 解释」按钮（覆盖所有界面，含 QA 回答）
  initSelectionAI() {
    if (this._selAiInited) return; this._selAiInited = true;
    const self = this;
    const btn = document.createElement('button');
    btn.id = 'selAiBtn'; btn.className = 'sel-ai-btn'; btn.type = 'button';
    btn.textContent = '🤖 AI 解释'; btn.style.display = 'none';
    document.body.appendChild(btn);
    const hide = () => { btn.style.display = 'none'; };
    document.addEventListener('mouseup', (e) => {
      if (e.target.closest && e.target.closest('.sel-ai-btn')) return;
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel && sel.toString().trim();
        if (!text || text.length < 2) { hide(); return; }
        let rect = null;
        try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (_) {}
        if (!rect || (rect.width === 0 && rect.height === 0)) { hide(); return; }
        btn.style.display = 'block';
        let left = rect.left + rect.width / 2 - 34;
        let top = rect.top - 38;
        if (top < 8) top = rect.bottom + 8;
        if (left < 8) left = 8;
        if (left + 88 > window.innerWidth - 8) left = window.innerWidth - 96;
        btn.style.left = left + 'px'; btn.style.top = top + 'px';
        btn.dataset.text = text.slice(0, 600);
      }, 10);
    });
    document.addEventListener('mousedown', (e) => {
      if (e.target.closest && e.target.closest('.sel-ai-btn')) return;
      const sel = window.getSelection();
      if (!sel || !sel.toString().trim()) hide();
    });
    btn.addEventListener('click', async () => {
      const text = btn.dataset.text || ''; if (!text) return;
      btn.textContent = '⏳ 生成中…'; btn.disabled = true;
      const resp = await self.explainText(text, '');
      btn.disabled = false; btn.textContent = '🤖 AI 解释';
      hide();
      if (resp && resp.fallback) {
        self._toast ? self._toast('未配置 AI 模型或调用受限，无法生成解释。') : alert('当前未配置 AI 模型或调用受限，无法生成解释。');
      } else {
        self._showSelAiPopover(text, resp && resp.explain ? resp.explain : '');
      }
    });
  },

  _showSelAiPopover(text, explain) {
    let pop = document.getElementById('selAiPop');
    if (!pop) { pop = document.createElement('div'); pop.id = 'selAiPop'; pop.className = 'sel-ai-pop'; document.body.appendChild(pop); }
    pop.innerHTML =
      '<div class="sel-ai-pop-h">🤖 AI 拓展解释<button type="button" class="sel-ai-pop-x" id="selAiPopX">×</button></div>' +
      '<div class="sel-ai-pop-q">“' + Penetrator.esc(text.slice(0, 140)) + '”</div>' +
      '<div class="sel-ai-pop-body">' + this.mdToHtml(explain || '（无内容）') + '</div>';
    pop.style.display = 'block';
    pop.style.left = Math.max(12, window.innerWidth / 2 - 250) + 'px';
    pop.style.top = Math.max(12, window.innerHeight / 2 - 170) + 'px';
    const x = pop.querySelector('#selAiPopX');
    if (x) x.addEventListener('click', () => { pop.style.display = 'none'; });
    const el = pop.querySelector('.sel-ai-pop-body'); if (el) this.penetrateDom(el);
  },

  // QA 回答底部「🤖 AI 拓展此回答」
  async _qaExpandAnswer(btn) {
    const msg = btn.closest('.qa9-msg'); if (!msg) return;
    const body = msg.querySelector('.qa9-msg-body') || msg.querySelector('.qa9-bubble');
    if (!body) return;
    const clone = body.cloneNode(true);
    clone.querySelectorAll('button').forEach(b => b.remove());
    const text = (clone.innerText || clone.textContent || '').trim().slice(0, 1200);
    if (!text) return;
    const box = document.createElement('div');
    box.className = 'qa9-expand-box';
    if (btn.parentNode) btn.parentNode.insertBefore(box, btn.nextSibling);
    box.innerHTML = '<div class="qa9-ai-loading">🤖 正在拓展解读…</div>';
    btn.disabled = true;
    try {
      const resp = await this.explainText(text, '');
      if (resp && resp.fallback) box.innerHTML = '<div class="qa9-ai-res">⚠️ 未配置 AI 模型，无法拓展。</div>';
      else box.innerHTML = '<div class="qa9-ai-res"><b>🤖 AI 拓展</b><br>' + this.mdToHtml(resp.explain || '') + '</div>';
      const el = box.querySelector('.qa9-ai-res'); if (el) this.penetrateDom(el);
    } catch (e) {
      box.innerHTML = '<div class="qa9-ai-res">拓展失败：' + Penetrator.esc(String(e)) + '</div>';
    } finally { btn.disabled = false; }
  },

  /* ---------- 轻量 Markdown 渲染 ---------- */
  mdToHtml(md) {
    const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = s => {
      let t = escH(s);
      t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, a, b) => '<a href="' + b.replace(/"/g, '%22') + '" target="_blank" rel="noopener">' + a + '</a>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      return t;
    };
    const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
    const n = lines.length;
    const isTableSep = s => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(s);
    const isBlockStart = s => /^(#{1,6}\s|\s*>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(s) || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(s);
    // 抢救被爬虫压平的单行表格（政府文件元数据条：| | | --- | --- | | 索引号 | … | 标题 | … |）
    // 解析为干净的「项目 / 内容」两列表格，避免原文显示成一长串 | 与 --- 乱码。
    const salvageFlatTable = raw => {
      let cells = raw.split('|').map(x => x.trim());
      while (cells.length && cells[0] === '') cells.shift();
      while (cells.length && cells[cells.length - 1] === '') cells.pop();
      let sep = -1;
      for (let k = 0; k < cells.length; k++) { if (/^:?-{2,}:?$/.test(cells[k])) { sep = k; break; } }
      const data = (sep >= 0 ? cells.slice(sep + 1) : cells).filter(x => x !== '');
      if (data.length < 2) return null;
      const rows = [];
      for (let k = 0; k + 1 < data.length; k += 2) rows.push([data[k], data[k + 1]]);
      if (!rows.length) return null;
      let h = '<table class="reg-table"><thead><tr><th>项目</th><th>内容</th></tr></thead><tbody>';
      rows.forEach(r => { h += '<tr><td>' + inline(r[0]) + '</td><td>' + inline(r[1]) + '</td></tr>'; });
      return h + '</tbody></table>';
    };
    let out = '', i = 0;
    while (i < n) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      const hm = line.match(/^(#{1,6})\s+(.*)$/);
      if (hm) { const lv = hm[1].length; out += '<h' + lv + '>' + inline(hm[2].trim()) + '</h' + lv + '>'; i++; continue; }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out += '<hr>'; i++; continue; }
      // 压平的单行表格：本行内嵌 | --- | 分隔符（无论是否以 | 起头）→ 抢救为表格
      if (/\|\s*:?-{2,}:?\s*\|/.test(line)) {
        const ft = salvageFlatTable(line.trim());
        if (ft) { out += ft; i++; continue; }
        // 抢救失败（如孤立的 | --- | 分隔行，或 |…---…| 前缀后接正文）：
        // 剥离前导表格残片，余下正文照常渲染；整行皆是 | 与 - 则视为分隔线。
        const stripped = line.replace(/^\s*\|[\s|:-]*/, '').replace(/[\s|:-]*\|$/, '').trim();
        if (stripped) { out += '<p>' + inline(stripped) + '</p>'; i++; continue; }
        out += '<hr>'; i++; continue;
      }
      if (line.indexOf('|') >= 0 && i + 1 < n && isTableSep(lines[i + 1])) {
        const splitRow = s => { const c = s.split('|').map(x => x.trim()); if (c.length && c[0] === '') c.shift(); if (c.length && c[c.length - 1] === '') c.pop(); return c; };
        const header = splitRow(line); i += 2; const rows = [];
        while (i < n && lines[i].indexOf('|') >= 0 && lines[i].trim()) { rows.push(splitRow(lines[i])); i++; }
        out += '<table class="reg-table"><thead><tr>' + header.map(h => '<th>' + inline(h) + '</th>').join('') + '</tr></thead><tbody>';
        rows.forEach(r => { out += '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>'; });
        out += '</tbody></table>';
        continue;
      }
      if (/^\s*>/.test(line)) {
        const buf = [];
        while (i < n && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        out += '<blockquote>' + buf.map(b => b.trim() ? '<p>' + inline(b) + '</p>' : '').join('') + '</blockquote>';
        continue;
      }
      if (/^\s*[-*+]\s+/.test(line)) {
        const buf = [];
        while (i < n && /^\s*[-*+]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++; }
        out += '<ul>' + buf.map(b => '<li>' + inline(b) + '</li>').join('') + '</ul>';
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(line)) {
        const buf = [];
        while (i < n && /^\s*\d+[.)]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
        out += '<ol>' + buf.map(b => '<li>' + inline(b) + '</li>').join('') + '</ol>';
        continue;
      }
      const buf = [line]; i++;
      while (i < n && lines[i].trim() && !isBlockStart(lines[i]) && !(lines[i].indexOf('|') >= 0 && i + 1 < n && isTableSep(lines[i + 1]))) { buf.push(lines[i]); i++; }
      out += '<p>' + inline(buf.join(' ')) + '</p>';
    }
    return out;
  }
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
