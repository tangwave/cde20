/* ============================================================================
 * qa9-chat.js — 海云AI 智能问答 · 便携组件（单文件、可挂载于任意页面）
 * ----------------------------------------------------------------------------
 * 从 app.js 的海云AI 子系统忠实移植，去除对 Penetrator / App 的依赖，
 * 作为独立全局组件工作。组件会自动注入对话面板与模型设置弹窗；若页面自身
 * 没有 #qaAiBtn（顶部入口），则注入一个固定在右上角的悬浮按钮。
 *
 * 用法：在页面引入 <script src="js/qa9-chat.js"></script> 即可，组件自挂载。
 * 后端地址：读取 <meta name="qa-api-base"> 或 globalThis.QA_API_BASE；
 *   设为 "same-origin"（推荐，部署在同域时）即使用相对 /api/* 调用。
 * ==========================================================================*/
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------------- 注入用的 HTML 片段（与 index.html 一致） ---------------- */
  var PANEL_HTML = [
    '<div id="qaAiPanel" class="qa9-panel" style="display:none;">',
    '  <div class="qa9-main">',
    '    <div class="qa9-chat-head">',
    '      <div class="qa9-head-left">',
    '        <span class="qa9-title">💬 海云AI 智能问答</span>',
    '        <span id="qa9Mode" class="qa9-mode"></span>',
    '      </div>',
    '      <div class="qa9-head-right">',
    '        <button id="qa9ModelBtn" class="qa9-head-btn" title="模型设置（API Key / 自定义）">⚙️ 设置</button>',
    '        <button id="qa9Clear" class="qa9-head-btn">清空对话</button>',
    '        <button id="qa9Close" class="qa9-head-btn qa9-close" title="关闭" aria-label="关闭智能问答">×</button>',
    '      </div>',
    '    </div>',
    '    <div id="qa9Msgs" class="qa9-msgs"></div>',
    '    <div class="qa9-composer">',
    '      <div class="qa9-composer-box">',
    '        <textarea id="qa9Input" class="qa9-input" rows="1" placeholder="向 海云AI 提问，例如：IND 申报需要哪些非临床研究资料？"></textarea>',
    '        <button id="qa9SendBtn" class="qa9-send-btn" title="发送 (Enter)">➤</button>',
    '      </div>',
    '      <div class="qa9-composer-toolbar">',
    '        <div class="qa9-tool-left">',
    '          <div class="qa9-mode-seg" id="qa9ModeSeg">',
    '            <button type="button" class="qa9-seg-btn active" data-mode="local" title="仅基于本地 3096 篇法规全文推理，引用可溯源">📚 本地法规库</button>',
    '            <button type="button" class="qa9-seg-btn" data-mode="web" title="实时联网检索后综合作答，不依赖本地库">🌐 联网搜索</button>',
    '            <button type="button" class="qa9-seg-btn" data-mode="hybrid" title="本地法规原文 + 实时联网并行检索，交叉核验后深度作答（最慢但最完整）">🧠 深度融合</button>',
    '          </div>',
    '          <span class="qa9-model-pick">',
    '            <span class="qa9-model-ico">🧠</span>',
    '            <select id="qa9ModelInline" class="qa9-model-select" title="切换内置 AI 模型"></select>',
    '            <span id="qa9ConnBadge" class="qa9-conn-badge none" title="当前模型连接状态">⚪ 未检测</span>',
    '          </span>',
    '          <label class="qa9-onlyvalid" id="qa9OnlyValidWrap"><input type="checkbox" id="qa9OnlyValid" checked /> 仅现行有效</label>',
    '          <label class="qa9-onlyvalid" id="qa9SpeedWrap" title="极致精简作答（中文约 500 字以内），更快出结果；默认关闭以保留完整深度推理"><input type="checkbox" id="qa9Speed" /> ⚡ 极速</label>',
    '        </div>',
    '        <span class="qa9-composer-hint">Enter 发送 · Shift+Enter 换行</span>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');

  var MODAL_HTML = [
    '<div id="qa9ModelModal" class="qa9-modal" style="display:none;">',
    '  <div class="qa9-modal-box">',
    '    <div class="qa9-modal-head">',
    '      <span>⚙️ AI 模型设置</span>',
    '      <button id="qa9ModelClose" class="qa9-close" title="关闭" aria-label="关闭模型设置">×</button>',
    '    </div>',
    '    <div class="qa9-modal-body">',
    '      <p class="qa9-modal-tip">已内置 25 家免费/低成本服务商（含 Hugging Face / Cloudflare / ModelScope / 讯飞星火 / Together / Cohere / Reka 等免信用卡免费档），选服务商 + 粘贴 Key 即用；各服务商 Key 独立保存、不重复填写。下方可直接切换内置模型，或点「+ 新增」自定义（任意 OpenAI 兼容）。</p>',
    '      <div class="qa9-free-legend">',
    '        <div class="qa9-fl-head">🆓 真正免费（无需付费 Key 即可用）</div>',
    '        <div class="qa9-fl-grid">',
    '          <span class="qa9-fl-chip ok">OpenRouter · 15 个已验证 :free 模型（Nemotron 3·3.5 系列 / Dots 3 / LFM 2.5 / Cohere / Thinking Machines Inkling / MiniMax 中文 / 智谱 GLM-5.2 中文 / 免费路由器；默认 Nemotron 3 Ultra 550B）</span>',
    '          <span class="qa9-fl-chip ok">智谱 GLM · glm-4.7-flash</span>',
    '          <span class="qa9-fl-chip ok">通义千问 · qwen-turbo</span>',
    '          <span class="qa9-fl-chip ok">腾讯混元 · hunyuan-lite</span>',
    '          <span class="qa9-fl-chip ok">百度千帆 · ERNIE-Speed</span>',
    '          <span class="qa9-fl-chip ok">Google Gemini · 2.5-flash</span>',
    '          <span class="qa9-fl-chip ok">Groq · LPU 超快</span>',
    '          <span class="qa9-fl-chip ok">Ollama · 本地无需 Key</span>',
    '          <span class="qa9-fl-chip ok">GitHub Models · GPT-4.1 免费</span>',
    '          <span class="qa9-fl-chip ok">NVIDIA NIM · DeepSeek V4 Flash</span>',
    '          <span class="qa9-fl-chip ok">Cerebras · LPU 超快推理</span>',
    '        </div>',
    '        <div class="qa9-fl-head">🎁 免费额度起步 / 极廉价</div>',
    '        <div class="qa9-fl-grid">',
    '          <span class="qa9-fl-chip">Kimi · 15 元代金券</span>',
    '          <span class="qa9-fl-chip">火山方舟 豆包 · 每日 200 万</span>',
    '          <span class="qa9-fl-chip">硅基流动 · 2000 万额度</span>',
    '          <span class="qa9-fl-chip">DeepSeek · V3-Lite 免费</span>',
    '          <span class="qa9-fl-chip">ChatAnywhere · 绑 GitHub 免费 Key</span>',
    '          <span class="qa9-fl-chip">Mistral AI · 免信用卡</span>',
    '        </div>',
    '        <div class="qa9-fl-note">选「真正免费」档的服务商后粘贴对应 Key（Ollama 连本地、OpenRouter :free 无需付费 Key）即可直接问答；其余为注册送额度或极廉价、按量计费。详见 DEPLOY.md 对照表。</div>',
    '      </div>',
    '      <div id="qa9ModelStatus" class="qa9-model-status"></div>',
    '      <label class="qa9-field-label">服务商（Provider）</label>',
    '      <select id="qa9Provider" class="qa9-select"></select>',
    '      <label class="qa9-field-label">API Base URL</label>',
    '      <input id="qa9BaseUrl" class="qa9-input-full" type="text" placeholder="https://.../v1（可自定义覆盖默认端点）" autocomplete="off" />',
    '      <label class="qa9-field-label">模型（Model）</label>',
    '      <select id="qa9Model" class="qa9-select"></select>',
    '      <div id="qa9CustomWrap" class="qa9-custom" style="display:none;">',
    '        <label class="qa9-field-label">自定义模型名称</label>',
    '        <input id="qa9ModelText" class="qa9-input-full" type="text" placeholder="如 deepseek-chat / gpt-4o-mini" autocomplete="off" />',
    '      </div>',
    '      <label class="qa9-field-label">API Key</label>',
    '      <input id="qa9ApiKey" class="qa9-input-full" type="password" placeholder="粘贴你的 API Key" autocomplete="off" />',
    '      <div class="qa9-modal-actions">',
    '        <button id="qa9TestConn" class="qa9-send-btn qa9-btn-ghost" type="button">🔌 测试连接</button>',
    '        <button id="qa9ModelSave" class="qa9-send-btn" type="button" disabled>保存并应用</button>',
    '        <span id="qa9ModelMsg" class="qa9-model-msg"></span>',
    '      </div>',
    '      <div id="qa9TestResult" class="qa9-test-result">填写完成后点【测试连接】，确认可连通后再保存。</div>',
    '      <p class="qa9-modal-foot">Key 仅保存在本机服务端 <code>llm_config.json</code>（已 gitignore），不会上传任何第三方。</p>',
    '      <div class="qa9-manage">',
    '        <div class="qa9-manage-head">',
    '          <span>🛠️ 内置模型管理（可新增 / 修改 / 删除）</span>',
    '          <button type="button" id="qa9PresetAdd" class="qa9-link-btn">+ 新增</button>',
    '        </div>',
    '        <div id="qa9PresetList" class="qa9-preset-list"></div>',
    '        <div id="qa9PresetForm" class="qa9-preset-form" style="display:none;">',
    '          <div class="qa9-form-row"><label>标识 ID</label><input id="qa9PId" class="qa9-input-full" type="text" placeholder="如 myllm（字母数字，唯一）" autocomplete="off" /></div>',
    '          <div class="qa9-form-row"><label>名称</label><input id="qa9PName" class="qa9-input-full" type="text" placeholder="如 我的模型" autocomplete="off" /></div>',
    '          <div class="qa9-form-row"><label>Base URL</label><input id="qa9PBase" class="qa9-input-full" type="text" placeholder="https://.../v1" autocomplete="off" /></div>',
    '          <div class="qa9-form-row"><label>模型（逗号分隔）</label><input id="qa9PModels" class="qa9-input-full" type="text" placeholder="model-a, model-b" autocomplete="off" /></div>',
    '          <div class="qa9-form-row"><label>默认模型</label><input id="qa9PDefault" class="qa9-input-full" type="text" placeholder="如 model-a" autocomplete="off" /></div>',
    '          <div class="qa9-form-row qa9-form-check"><label><input type="checkbox" id="qa9PCustom" /> 自定义（不提供模型列表，使用方手填模型名）</label></div>',
    '          <div class="qa9-modal-actions">',
    '            <button type="button" id="qa9PresetSave" class="qa9-send-btn">保存模型</button>',
    '            <button type="button" id="qa9PresetCancel" class="qa9-link-btn">取消</button>',
    '            <span id="qa9PresetMsg" class="qa9-model-msg"></span>',
    '          </div>',
    '        </div>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');

  var FAB_HTML = '<button id="qaAiBtn" class="qa9-fab" type="button" title="海云AI 智能问答">💬 海云AI</button>';

  /* ============================ 组件本体 ============================ */
  var QaAi = {
    _mounted: false,
    qaApiBase: '',
    _qaOpen: false,
    _qaMode: 'local',
    _qaMid: 0,
    _qaQuickIdx: 0,
    _presets: [],
    _connVerifiedSig: null,
    _toastTimer: null,
    _selAiInited: false,

    mount: function () {
      if (this._mounted) return;
      this._mounted = true;
      this.qaApiBase = this._readQaApiBase();

      // 注入对话面板 + 模型设置弹窗（若不存在）
      if (!document.getElementById('qaAiPanel')) {
        var wrap = document.createElement('div');
        wrap.innerHTML = PANEL_HTML + MODAL_HTML;
        while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
      }
      // 顶部入口：页面已有 #qaAiBtn 则复用，否则注入右上角悬浮按钮
      if (!document.getElementById('qaAiBtn')) {
        var fab = document.createElement('div');
        fab.innerHTML = FAB_HTML;
        document.body.appendChild(fab.firstChild);
      }

      this.initQaAi();
      this.initSelectionAI();
    },

    /* ---- 后端地址 ---- */
    _readQaApiBase: function () {
      var meta = document.querySelector('meta[name="qa-api-base"]');
      var base = (meta && meta.getAttribute('content') ? meta.getAttribute('content') : '').trim();
      if (!base && globalThis.QA_API_BASE) base = String(globalThis.QA_API_BASE).trim();
      if (!base) return '';
      if (base === '/' || base === './' || base === '.' || base.toLowerCase() === 'same-origin')
        return window.location.origin;
      return base.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    },
    _apiBase: function () {
      if (!this.qaApiBase || this.qaApiBase === '/' || this.qaApiBase === 'same-origin') return '';
      return this.qaApiBase;
    },
    _apiUrl: function (p) {
      var base = (this.qaApiBase === '/' || this.qaApiBase === 'same-origin' || !this.qaApiBase) ? '' : this.qaApiBase;
      return base + p;
    },

    /* ---- 模式 ---- */
    _modeLabel: function (m) {
      if (m === 'web') return '联网搜索';
      if (m === 'hybrid') return '深度融合';
      return '本地法规库';
    },
    _renderQaMode: function () {
      var el = document.getElementById('qa9Mode'); if (!el) return;
      var modeTxt = this._modeLabel(this._qaMode);
      if (this.qaApiBase) {
        el.textContent = '🤖 ' + modeTxt + ' · 在线';
        el.className = 'qa9-mode live';
      } else {
        el.textContent = '🤖 ' + modeTxt + ' · 未连接';
        el.className = 'qa9-mode snap';
      }
    },

    /* ---- 打开 / 关闭 ---- */
    openQaAi: function () {
      this._qaOpen = true;
      var p = document.getElementById('qaAiPanel'); if (p) p.style.display = 'flex';
      var b = document.getElementById('qaAiBtn'); if (b) b.classList.add('active');
    },
    closeQaAi: function () {
      this._qaOpen = false;
      var p = document.getElementById('qaAiPanel'); if (p) p.style.display = 'none';
      var b = document.getElementById('qaAiBtn'); if (b) b.classList.remove('active');
    },

    /* ============ 海云AI 智能问答（对话模式） ============ */
    initQaAi: function () {
      var self = this;
      var btn = document.getElementById('qaAiBtn');
      if (btn) btn.addEventListener('click', function () {
        self._qaOpen ? self.closeQaAi() : self.openQaAi();
      });
      var closeBtn = document.getElementById('qa9Close');
      if (closeBtn) closeBtn.addEventListener('click', function () { self.closeQaAi(); });
      var input = document.getElementById('qa9Input');
      if (input) {
        input.addEventListener('input', function () { self._autoGrowInput(); });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); self.sendQaMessage(); }
        });
      }
      var sbtn = document.getElementById('qa9SendBtn');
      if (sbtn) sbtn.addEventListener('click', function () { self.sendQaMessage(); });
      var clearBtn = document.getElementById('qa9Clear');
      if (clearBtn) clearBtn.addEventListener('click', function () { self._resetQaChat(); });
      var msgs = document.getElementById('qa9Msgs');
      if (msgs) msgs.addEventListener('click', function (e) {
        var chip = e.target && e.target.closest ? e.target.closest('.qa9-followup') : null;
        if (chip && chip.dataset.q) { self.sendQaMessage(chip.dataset.q); return; }
        var exp = e.target && e.target.closest ? e.target.closest('.qa9-expand-btn') : null;
        if (exp) { self._qaExpandAnswer(exp); return; }
      });
      this._renderQaMode();
      this._initModelPanel();
      this.loadInlineModels();
      this.updateConnBadge();
      this._qaMode = 'local';
      this._initModeSeg();
      this._applyDefaultModeFromHealth();
      this._initQaChat();
    },

    _autoGrowInput: function () {
      var el = document.getElementById('qa9Input'); if (!el) return;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 180) + 'px';
    },

    _initQaChat: function () {
      var box = document.getElementById('qa9Msgs');
      if (!box || box.children.length) return;
      this._resetQaChat();
    },

    _resetQaChat: function () {
      this._qaMid = 0;
      this._qaQuickIdx = 0;
      var box = document.getElementById('qa9Msgs'); if (!box) return;
      box.innerHTML = '';
      var welcome =
        '<div class="qa9-quick">' +
          '<div class="qa9-quick-greet">你好，我是 <b>海云AI</b> —— 专注药品研发生产与注册申报的 QA 助手。点击下方高频问题直接提问，也可以直接在下方输入你的问题：</div>' +
          '<div class="qa9-quick-head">' +
            '<span class="qa9-quick-title">💡 快速提问 · 研发 / 注册高频</span>' +
            '<button type="button" class="qa9-quick-refresh" id="qa9QuickRefresh">🔄 换一批</button>' +
          '</div>' +
          '<div class="qa9-quick-chips" id="qa9QuickChips"></div>' +
        '</div>';
      var wrap = document.createElement('div');
      wrap.className = 'qa9-msg bot welcome';
      wrap.innerHTML = '<div class="qa9-bubble">' + welcome + '</div>';
      box.appendChild(wrap);
      this._renderQuickBatch();
      var refresh = document.getElementById('qa9QuickRefresh');
      if (refresh) refresh.addEventListener('click', function () { this._qaQuickIdx++; this._renderQuickBatch(); }.bind(this));
    },

    _buildQuickQuestions: function () {
      return [
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
        'GMP 基本要求与现场检查要点？',
        '变更管理（CMC 变更）如何分类？',
        '偏差与 CAPA 管理要求？',
        '供应商审计与物料管理要求？',
        '数据完整性（ALCOA+）原则是什么？',
        '质量风险管理（QRM）如何实施？',
        '共线生产风险评估要点？',
        '仿制药质量和疗效一致性评价要求？',
        '专利链接与专利期补偿制度？',
        '处方药与非处方药（OTC）转换要求？',
        '药品说明书与标签管理规定？'
      ];
    },

    _renderQuickBatch: function () {
      var el = document.getElementById('qa9QuickChips'); if (!el) return;
      var pool = this._qaQuickPool || (this._qaQuickPool = this._buildQuickQuestions());
      var per = 8, total = pool.length;
      var start = (this._qaQuickIdx * per) % total;
      var batch = [];
      for (var i = 0; i < per; i++) batch.push(pool[(start + i) % total]);
      var self = this;
      el.innerHTML = batch.map(function (q) {
        return '<button type="button" class="qa9-quick-chip" data-q="' + esc(q) + '">' + esc(q) + '</button>';
      }).join('');
      el.querySelectorAll('.qa9-quick-chip').forEach(function (b) {
        b.addEventListener('click', function () { self.sendQaMessage(b.dataset.q); });
      });
    },

    sendQaMessage: function (text) {
      var self = this;
      text = (text || '').trim();
      if (!text) {
        var inp = document.getElementById('qa9Input');
        text = (inp ? inp.value : '').trim();
      }
      if (!text) return;
      var input = document.getElementById('qa9Input'); if (input) { input.value = ''; this._autoGrowInput(); }
      this._appendMsg('user', esc(text));
      var ovEl = document.getElementById('qa9OnlyValid');
      var ov = ovEl ? ovEl.checked : true;
      var mode = this._qaMode || 'local';
      var thinkTxt = (mode === 'hybrid')
        ? '海云AI 正在并行调阅本地法规原文与实时网络资料，交叉核验中…'
        : (mode === 'web' ? '海云AI 正在实时联网检索并推理…'
          : '海云AI 正在检索法规库并深度推理…');
      var typingId = this._appendMsg('bot', '<span class="qa9-typing"><span class="qa9-dot"></span>' + thinkTxt + '</span>', true);
      this.qaRag(text, { onlyValid: ov, mode: mode }).then(function (rag) {
        if (rag && !rag.fallback && rag['结论']) {
          var blocks = {
            abstract: rag['结论'] || '',
            thinking: rag['思考分析'] || '',
            points: rag['要点解析'] || [],
            tips: rag['适用提示'] || '',
            risk: rag['风险提示'] || '',
            timeNote: rag['时效说明'] || '',
            followUps: rag['延伸问题'] || []
          };
          var intros = {
            web: '海云AI 已实时联网检索并综合作答：',
            hybrid: '海云AI 已交叉核验「本地法规原文 + 实时网络资料」后作答：',
            local: '海云AI 基于以下法规材料深度分析后作答：'
          };
          var intro = intros[rag.source] || intros[mode] || intros.local;
          var html = self._buildRagReply({ intro: intro, blocks: blocks, rag: rag, source: 'rag', query: text });
          self._updateMsg(typingId, html);
          self._scrollMsgs();
          return;
        }
        var tip;
        if (rag && rag.error === 'llm_rate_limited')
          tip = '⚠️ 当前 AI 模型限流（免费额度）。请稍后重试，或在「⚙️ AI 模型」中切换为其他服务商 / 付费模型。';
        else if (rag && rag.error)
          tip = '⚠️ AI 推理暂时不可用（' + String(rag.error) + '）。请稍后重试或检查模型配置。';
        else
          tip = '⚠️ AI 未返回有效结论，请换一种问法重试，或检查「⚙️ AI 模型」中的配置。';
        self._updateMsg(typingId, '<div class="qa9-reply-intro">' + tip + '</div>');
        self._scrollMsgs();
      }).catch(function () {
        self._updateMsg(typingId, '<div class="qa9-reply-intro">⚠️ 推理出错，请稍后重试。</div>');
        self._scrollMsgs();
      });
    },

    _appendMsg: function (role, html, isTyping) {
      var box = document.getElementById('qa9Msgs'); if (!box) return '';
      var mid = 'm' + (++this._qaMid);
      var wrap = document.createElement('div');
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
    _updateMsg: function (mid, html) {
      var box = document.getElementById('qa9Msgs'); if (!box) return;
      var wrap = box.querySelector('[data-mid="' + mid + '"]');
      if (!wrap) return;
      wrap.classList.remove('typing');
      var bubble = wrap.querySelector('.qa9-bubble');
      if (bubble) bubble.innerHTML = html;
      this._scrollMsgs();
    },
    _scrollMsgs: function () {
      var box = document.getElementById('qa9Msgs'); if (!box) return;
      box.scrollTop = box.scrollHeight;
    },

    /* ---- RAG 调用 ---- */
    qaRag: function (text, opts) {
      var self = this;
      if (!this.qaApiBase) return Promise.resolve({ fallback: true });
      var base = (this.qaApiBase === '/' || this.qaApiBase === 'same-origin') ? '' : this.qaApiBase;
      var url = base + '/api/qa-rag';
      var speedEl = document.getElementById('qa9Speed');
      var speed = !!(opts && opts.speed) || !!(speedEl && speedEl.checked);
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          only_valid: opts && opts.onlyValid !== false,
          mode: (opts && opts.mode) || 'local',
          speed: speed
        })
      }).then(function (r) { return r.ok ? r.json() : { fallback: true }; })
        .catch(function () { return { fallback: true }; });
    },

    /* ============ AI 模型切换（多服务商，免重启） ============ */
    _initModelPanel: function () {
      var self = this;
      var btn = document.getElementById('qa9ModelBtn');
      if (btn) btn.addEventListener('click', function () { self.openModelModal(); });
      var close = document.getElementById('qa9ModelClose');
      if (close) close.addEventListener('click', function () { self.closeModelModal(); });
      var save = document.getElementById('qa9ModelSave');
      if (save) save.addEventListener('click', function () { self.saveModelConfig(); });
      var testBtn = document.getElementById('qa9TestConn');
      if (testBtn) testBtn.addEventListener('click', function () { self.testConnection(); });
      var prov = document.getElementById('qa9Provider');
      if (prov) prov.addEventListener('change', function () { self.onProviderChange(); });
      var modal = document.getElementById('qa9ModelModal');
      if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) self.closeModelModal(); });
      var inline = document.getElementById('qa9ModelInline');
      if (inline) inline.addEventListener('change', function () { self.onInlineModelChange(); });
      var pAdd = document.getElementById('qa9PresetAdd');
      if (pAdd) pAdd.addEventListener('click', function () { self.addPreset(); });
      var pSave = document.getElementById('qa9PresetSave');
      if (pSave) pSave.addEventListener('click', function () { self.savePreset(); });
      var pCancel = document.getElementById('qa9PresetCancel');
      if (pCancel) pCancel.addEventListener('click', function () { self._hidePresetForm(); });
    },

    loadInlineModels: function () {
      var self = this;
      return fetch(this._apiBase() + '/api/llm-presets').then(function (r) {
        if (!r.ok) return;
        return r.json();
      }).then(function (j) {
        if (!j) return;
        var presets = j.presets || [];
        self._presets = presets;
        var sel = document.getElementById('qa9ModelInline');
        if (!sel) return;
        var html = '';
        presets.forEach(function (p) {
          if (p.custom) {
            html += '<option value="custom::' + esc(p.id) + '">' + esc(p.name) + '</option>';
          } else {
            (p.models || []).forEach(function (m) {
              html += '<option value="' + esc(p.id) + '::' + esc(m) + '">' + esc(p.name) + ' · ' + esc(m) + '</option>';
            });
          }
        });
        sel.innerHTML = html;
        return self._loadCurrentModel().then(function (cfg) {
          if (cfg && sel) {
            var val = (cfg.provider || '') + '::' + (cfg.model || '');
            var found = false;
            for (var k = 0; k < sel.options.length; k++) {
              if (sel.options[k].value === val) { sel.options[k].selected = true; found = true; break; }
            }
            if (!found && cfg.model) {
              var opt = document.createElement('option');
              opt.value = val; opt.textContent = esc((cfg.provider || '') + ' · ' + cfg.model) + '（当前）';
              opt.selected = true; sel.appendChild(opt);
            }
          }
        });
      }).catch(function () { /* 忽略 */ });
    },

    _loadCurrentModel: function () {
      return fetch(this._apiBase() + '/api/llm-config').then(function (r) {
        return r.ok ? r.json() : null;
      }).catch(function () { return null; });
    },

    onInlineModelChange: function () {
      var self = this;
      var sel = document.getElementById('qa9ModelInline');
      if (!sel || !sel.value) return;
      var parts = sel.value.split('::');
      var provider = parts[0], model = parts[1] || '';
      var preset = this._presets.find(function (p) { return p.id === provider; }) || {};
      return fetch(this._apiBase() + '/api/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider, model: model, api_key: '' })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) {
          self._toast('已切换至 ' + (j.provider_name || provider) + ' / ' + j.model);
          self._renderQaMode();
          self.updateConnBadge();
        } else if (j && j.error && j.error.indexOf('API Key') >= 0) {
          self.openModelModal();
          var prov = document.getElementById('qa9Provider');
          if (prov) { for (var k = 0; k < prov.options.length; k++) { if (prov.options[k].value === provider) { prov.options[k].selected = true; break; } } self.onProviderChange(); }
          var key = document.getElementById('qa9ApiKey');
          if (key) { key.value = ''; key.focus(); }
          var status = document.getElementById('qa9ModelStatus');
          if (status) { status.className = 'qa9-model-status warn'; status.textContent = '「' + (preset.name || provider) + '」尚未配置 API Key，请粘贴后保存。'; }
        } else {
          self._toast('切换失败：' + (j && j.error || '未知错误'));
        }
      }).catch(function () { self._toast('网络错误，请重试'); });
    },

    _toast: function (msg) {
      var t = document.getElementById('qa9Toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'qa9Toast'; t.className = 'qa9-toast';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
    },

    openModelModal: function () {
      var m = document.getElementById('qa9ModelModal');
      if (m) m.style.display = 'flex';
      var msg = document.getElementById('qa9ModelMsg');
      if (msg) { msg.textContent = ''; msg.className = 'qa9-model-msg'; }
      this.loadModelPresets();
      this.loadModelConfig();
      this.loadPresetManage();
    },
    closeModelModal: function () {
      var m = document.getElementById('qa9ModelModal');
      if (m) m.style.display = 'none';
    },

    loadModelPresets: function () {
      var self = this;
      return fetch(this._apiBase() + '/api/llm-presets').then(function (r) {
        return r.ok ? r.json() : null;
      }).then(function (j) {
        if (!j) return;
        var presets = j.presets || [];
        self._presets = presets;
        var sel = document.getElementById('qa9Provider');
        if (sel) sel.innerHTML = presets.map(function (p) {
          return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>';
        }).join('');
      }).catch(function () { /* 忽略 */ });
    },

    loadModelConfig: function () {
      var self = this;
      return fetch(this._apiBase() + '/api/llm-config').then(function (r) {
        return r.ok ? r.json() : null;
      }).then(function (j) {
        if (!j) return;
        var prov = document.getElementById('qa9Provider');
        if (prov && j.provider) {
          for (var k = 0; k < prov.options.length; k++) { if (prov.options[k].value === j.provider) { prov.options[k].selected = true; break; } }
        }
        self.onProviderChange();
        var modelSel = document.getElementById('qa9Model');
        if (modelSel && j.model) {
          var found = false;
          for (var m = 0; m < modelSel.options.length; m++) { if (modelSel.options[m].value === j.model) { modelSel.options[m].selected = true; found = true; break; } }
          if (!found) {
            var opt = document.createElement('option');
            opt.value = j.model; opt.textContent = j.model + '（当前）'; opt.selected = true;
            modelSel.appendChild(opt);
          }
        }
        var key = document.getElementById('qa9ApiKey');
        if (key) {
          key.value = '';
          key.placeholder = j.key_set ? ('当前已设置：' + (j.api_key_masked || '****') + '（留空则保持不变）') : '粘贴你的 API Key';
        }
        var custom = document.getElementById('qa9CustomWrap');
        var baseUrlInput = document.getElementById('qa9BaseUrl');
        if (custom && j.provider === 'custom') {
          if (baseUrlInput && j.base_url) baseUrlInput.value = j.base_url;
          var mt = document.getElementById('qa9ModelText');
          if (mt && j.model) mt.value = j.model;
        } else if (baseUrlInput) {
          baseUrlInput.value = j.base_url || '';
        }
        var status = document.getElementById('qa9ModelStatus');
        if (status) {
          if (j.configured) {
            status.className = 'qa9-model-status ok';
            status.textContent = '✅ 当前已配置：' + (j.provider || '') + ' / ' + (j.model || '');
          } else {
            status.className = 'qa9-model-status warn';
            status.textContent = '⚠️ 尚未配置 AI 模型：粘贴 API Key 并保存即可启用。';
          }
        }
        self._resetConnTest();
        if (j.configured) self.testConnection();
      }).catch(function () { /* 忽略 */ });
    },

    onProviderChange: function () {
      var prov = document.getElementById('qa9Provider');
      var modelSel = document.getElementById('qa9Model');
      var customWrap = document.getElementById('qa9CustomWrap');
      var baseUrlInput = document.getElementById('qa9BaseUrl');
      if (!prov || !modelSel) return;
      var pid = prov.value;
      var preset = this._presets.find(function (p) { return p.id === pid; }) || { models: [] };
      if (baseUrlInput) baseUrlInput.value = preset.base_url || '';
      if (preset.custom) {
        if (customWrap) customWrap.style.display = '';
        modelSel.style.display = 'none';
      } else {
        if (customWrap) customWrap.style.display = 'none';
        modelSel.style.display = '';
        modelSel.innerHTML = (preset.models || []).map(function (m) {
          return '<option value="' + esc(m) + '">' + esc(m) + '</option>';
        }).join('');
      }
      this._resetConnTest();
    },

    _applySaveEnabled: function () {
      var s = document.getElementById('qa9ModelSave');
      if (!s) return;
      if (this._connVerifiedSig) { s.disabled = false; s.title = ''; }
      else { s.disabled = true; s.title = '请先点击【测试连接】确认可连通后再保存'; }
    },
    _resetConnTest: function () {
      this._connVerifiedSig = null;
      var msg = document.getElementById('qa9TestResult');
      if (msg) { msg.className = 'qa9-test-result'; msg.textContent = '填写完成后点【测试连接】，确认可连通后再保存。'; }
      this._applySaveEnabled();
    },

    testConnection: function () {
      var self = this;
      var msg = document.getElementById('qa9TestResult');
      var prov = document.getElementById('qa9Provider');
      var key = document.getElementById('qa9ApiKey');
      var baseUrlInput = document.getElementById('qa9BaseUrl');
      var pid = prov ? prov.value : '';
      var preset = this._presets.find(function (p) { return p.id === pid; }) || {};
      var base_url = baseUrlInput ? baseUrlInput.value.trim() : '';
      var model = '';
      if (preset.custom) {
        var mt = document.getElementById('qa9ModelText');
        model = mt ? mt.value.trim() : '';
      } else {
        var ms = document.getElementById('qa9Model');
        model = ms ? ms.value : '';
      }
      var apiKey = key ? key.value.trim() : '';
      var sig = pid + '|' + model + '|' + base_url + '|' + (apiKey ? '1' : '0');
      this._connVerifiedSig = null;
      this._applySaveEnabled();
      if (msg) { msg.className = 'qa9-test-result testing'; msg.textContent = '🔌 正在测试连接…'; }
      return fetch(this._apiBase() + '/api/llm-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: pid, model: model, base_url: base_url, api_key: apiKey })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) {
          self._connVerifiedSig = sig;
          self._applySaveEnabled();
          if (msg) { msg.className = 'qa9-test-result ok'; msg.textContent = '✅ 连接成功（' + (j.latency_ms || 0) + 'ms）· 模型 ' + (j.model || model) + ' —— 可以保存并应用'; }
        } else {
          if (msg) { msg.className = 'qa9-test-result err'; msg.textContent = '❌ 连接失败：' + ((j && j.error) || '未知错误') + ' —— 请检查填写内容后重试'; }
        }
      }).catch(function () {
        if (msg) { msg.className = 'qa9-test-result err'; msg.textContent = '❌ 网络错误，请重试'; }
      });
    },

    updateConnBadge: function () {
      var self = this;
      var badge = document.getElementById('qa9ConnBadge');
      if (!badge) return;
      return this._loadCurrentModel().then(function (cfg) {
        if (!cfg || !cfg.configured) {
          badge.className = 'qa9-conn-badge none';
          badge.innerHTML = '⚪ 未配置';
          badge.title = '尚未配置 AI 模型，点 ⚙️ 设置';
          return;
        }
        badge.className = 'qa9-conn-badge testing';
        badge.innerHTML = '🔌 连接测试…';
        badge.title = '正在测试当前模型连接…';
        return fetch(self._apiBase() + '/api/llm-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: cfg.provider, model: cfg.model, base_url: cfg.base_url })
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.ok) {
            badge.className = 'qa9-conn-badge ok';
            badge.innerHTML = '✅ 已连接 <span class="qa9-lat">' + (j.latency_ms || 0) + 'ms</span>';
            badge.title = '当前模型 ' + (j.model || cfg.model) + ' 连接正常（' + (j.latency_ms || 0) + 'ms）';
          } else {
            badge.className = 'qa9-conn-badge err';
            badge.innerHTML = '❌ 未连接';
            badge.title = '连接失败：' + ((j && j.error) || '未知错误');
          }
        }).catch(function () {
          badge.className = 'qa9-conn-badge err';
          badge.innerHTML = '❌ 网络错误';
          badge.title = '无法联系后端，请刷新重试';
        });
      });
    },

    saveModelConfig: function () {
      var self = this;
      var msg = document.getElementById('qa9ModelMsg');
      var prov = document.getElementById('qa9Provider');
      var key = document.getElementById('qa9ApiKey');
      var baseUrlInput = document.getElementById('qa9BaseUrl');
      var pid = prov ? prov.value : '';
      var preset = this._presets.find(function (p) { return p.id === pid; }) || {};
      var base_url = baseUrlInput ? baseUrlInput.value.trim() : '';
      var model = '';
      if (preset.custom) {
        var mt = document.getElementById('qa9ModelText');
        model = mt ? mt.value.trim() : '';
      } else {
        var ms = document.getElementById('qa9Model');
        model = ms ? ms.value : '';
      }
      var apiKey = key ? key.value.trim() : '';
      var payload = { provider: pid, model: model, base_url: base_url, api_key: apiKey };
      var sig = pid + '|' + model + '|' + base_url + '|' + (apiKey ? '1' : '0');
      if (this._connVerifiedSig !== sig) {
        if (msg) { msg.className = 'qa9-model-msg err'; msg.textContent = '请先点击【测试连接】确认可连通后再保存。'; }
        return;
      }
      if (msg) { msg.textContent = '保存中…'; msg.className = 'qa9-model-msg'; }
      return fetch(this._apiBase() + '/api/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (msg) {
          if (j.ok) {
            msg.className = 'qa9-model-msg ok';
            msg.textContent = '✅ 已切换至 ' + (j.provider_name || j.provider) + ' / ' + j.model;
            self.loadInlineModels();
            self._renderQaMode();
          } else {
            msg.className = 'qa9-model-msg err';
            msg.textContent = '❌ ' + (j.error || '保存失败');
          }
        }
        if (j.ok) setTimeout(function () { self.closeModelModal(); }, 1000);
      }).catch(function () {
        if (msg) { msg.className = 'qa9-model-msg err'; msg.textContent = '❌ 网络错误，请重试'; }
      });
    },

    /* ---- 问答模式切换 ---- */
    _initModeSeg: function () {
      var self = this;
      var seg = document.getElementById('qa9ModeSeg');
      if (!seg) return;
      seg.querySelectorAll('.qa9-seg-btn').forEach(function (b) {
        b.addEventListener('click', function () { self._setMode(b.dataset.mode); });
      });
    },
    _setMode: function (mode) {
      if (mode !== 'web' && mode !== 'local' && mode !== 'hybrid') mode = 'local';
      this._qaMode = mode;
      var seg = document.getElementById('qa9ModeSeg');
      if (seg) seg.querySelectorAll('.qa9-seg-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.mode === mode);
      });
      var ovWrap = document.getElementById('qa9OnlyValidWrap');
      if (ovWrap) ovWrap.style.display = (mode === 'web') ? 'none' : '';
      this._renderQaMode();
      var tips = {
        web: '已切换：🌐 联网搜索（实时检索网络，不依赖本地库）',
        hybrid: '已切换：🧠 深度融合（本地法规原文 + 实时联网并行交叉核验，用时略长）',
        local: '已切换：📚 本地法规库（3096 篇全文，引用可溯源）'
      };
      this._toast(tips[mode] || tips.local);
    },
    _applyDefaultModeFromHealth: function () {
      var self = this;
      var base = this._apiBase();
      if (!base) return;
      fetch(base + '/api/health', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var m = (j && j.qa_default_mode) || '';
          if (m === 'web' || m === 'local' || m === 'hybrid') self._setMode(m);
        }).catch(function () { /* 忽略 */ });
    },

    /* ---- 内置模型管理 ---- */
    loadPresetManage: function () {
      var self = this;
      var list = document.getElementById('qa9PresetList');
      if (!list) return;
      return fetch(this._apiBase() + '/api/llm-presets').then(function (r) {
        return r.ok ? r.json() : null;
      }).then(function (j) {
        if (!j) return;
        var presets = j.presets || [];
        self._presets = presets;
        if (!presets.length) { list.innerHTML = '<div class="qa9-empty">暂无预设</div>'; return; }
        list.innerHTML = presets.map(function (p) {
          var editable = p.id !== 'custom';
          return '<div class="qa9-preset-item" data-id="' + esc(p.id) + '">' +
            '<div class="qa9-preset-meta"><span class="qa9-preset-name">' + esc(p.name) + '</span>' +
            '<span class="qa9-preset-id">' + esc(p.id) + (p.custom ? ' · 自定义' : '') + '</span></div>' +
            '<div class="qa9-preset-ops">' +
              (editable ? '<button type="button" class="qa9-mini-btn" data-act="edit">编辑</button>' : '') +
              (editable ? '<button type="button" class="qa9-mini-btn danger" data-act="del">删除</button>'
                        : '<span class="qa9-preset-locked">内置保护</span>') +
            '</div></div>';
        }).join('');
        list.querySelectorAll('.qa9-preset-item').forEach(function (it) {
          var id = it.dataset.id;
          var edit = it.querySelector('[data-act="edit"]');
          var del = it.querySelector('[data-act="del"]');
          if (edit) edit.addEventListener('click', function () { self.editPreset(id); });
          if (del) del.addEventListener('click', function () { self.deletePreset(id); });
        });
      }).catch(function () { /* 忽略 */ });
    },
    addPreset: function () { this._showPresetForm(null); },
    editPreset: function (id) {
      var p = this._presets.find(function (x) { return x.id === id; });
      this._showPresetForm(p || null);
    },
    _showPresetForm: function (p) {
      var form = document.getElementById('qa9PresetForm');
      if (!form) return;
      var msg = document.getElementById('qa9PresetMsg');
      if (msg) { msg.textContent = ''; msg.className = 'qa9-model-msg'; }
      var idEl = document.getElementById('qa9PId');
      var nameEl = document.getElementById('qa9PName');
      var baseEl = document.getElementById('qa9PBase');
      var modelsEl = document.getElementById('qa9PModels');
      var defEl = document.getElementById('qa9PDefault');
      var customEl = document.getElementById('qa9PCustom');
      if (idEl) { idEl.value = p ? p.id : ''; idEl.readOnly = !!p; idEl.style.opacity = p ? '0.6' : '1'; }
      if (nameEl) nameEl.value = p ? p.name : '';
      if (baseEl) baseEl.value = p ? (p.base_url || '') : '';
      if (modelsEl) modelsEl.value = p ? (p.models || []).join(', ') : '';
      if (defEl) defEl.value = p ? (p.default_model || '') : '';
      if (customEl) customEl.checked = p ? !!p.custom : false;
      form.style.display = '';
      if (idEl && !p) idEl.focus();
    },
    _hidePresetForm: function () { var f = document.getElementById('qa9PresetForm'); if (f) f.style.display = 'none'; },
    savePreset: function () {
      var self = this;
      var msg = document.getElementById('qa9PresetMsg');
      var idEl = document.getElementById('qa9PId');
      var nameEl = document.getElementById('qa9PName');
      var baseEl = document.getElementById('qa9PBase');
      var modelsEl = document.getElementById('qa9PModels');
      var defEl = document.getElementById('qa9PDefault');
      var customEl = document.getElementById('qa9PCustom');
      var pid = idEl ? idEl.value.trim() : '';
      if (!pid) { if (msg) { msg.className = 'qa9-model-msg err'; msg.textContent = '❌ 请填写标识 ID'; } return; }
      if (!/^[A-Za-z0-9_\-]+$/.test(pid)) { if (msg) { msg.className = 'qa9-model-msg err'; msg.textContent = '❌ ID 仅含字母数字 _ -'; } return; }
      var models = modelsEl ? modelsEl.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
      var custom = customEl ? customEl.checked : false;
      var payload = {
        id: pid, name: nameEl ? nameEl.value.trim() : pid,
        base_url: baseEl ? baseEl.value.trim() : '',
        models: models, default_model: defEl ? defEl.value.trim() : (models[0] || ''),
        custom: custom
      };
      if (msg) { msg.textContent = '保存中…'; msg.className = 'qa9-model-msg'; }
      return fetch(this._apiBase() + '/api/llm-presets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (msg) {
          if (j.ok) {
            msg.className = 'qa9-model-msg ok';
            msg.textContent = '✅ 已保存：' + ((j.preset && j.preset.name) || pid);
            self._hidePresetForm();
            self.loadPresetManage(); self.loadInlineModels(); self.loadModelPresets();
          } else { msg.className = 'qa9-model-msg err'; msg.textContent = '❌ ' + (j.error || '保存失败'); }
        }
      }).catch(function () {
        if (msg) { msg.className = 'qa9-model-msg err'; msg.textContent = '❌ 网络错误，请重试'; }
      });
    },
    deletePreset: function (id) {
      var self = this;
      if (!window.confirm('确定删除内置模型「' + id + '」？此操作不可撤销。')) return;
      return fetch(this._apiBase() + '/api/llm-presets', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.ok) { self.loadPresetManage(); self.loadInlineModels(); self.loadModelPresets(); self._toast('已删除预设：' + id); }
        else self._toast('删除失败：' + (j.error || '未知错误'));
      }).catch(function () { self._toast('网络错误，请重试'); });
    },

    /* ---- 渲染海云AI 回复 ---- */
    _buildRagReply: function (o) {
      var B = o.blocks || {};
      var rag = o.rag || {};
      var src = rag.source || 'rag';
      var self = this;
      var html = '';
      if (o.intro) html += '<div class="qa9-reply-intro">' + esc(o.intro).replace(/\n/g, '<br>') + '</div>';
      var lines = function (s) {
        return (s || '').split('\n').map(function (l) {
          var t = l.trim();
          if (!t) return '';
          var isLi = /^([·•\-—*]|\d+[.)、])\s*/.test(t);
          return isLi
            ? '<p class="qa9-li">' + esc(t.replace(/^([·•\-—*]|\d+[.)、])\s*/, '')) + '</p>'
            : '<p>' + esc(t) + '</p>';
        }).join('');
      };
      if (B.abstract) html += '<div class="qa9-ans">' + lines(B.abstract) + '</div>';
      var pts = B.points || [];
      if (pts.length) {
        html += '<div class="qa9-pts"><div class="qa9-pts-h">要点</div><ol class="qa9-point-list">';
        pts.forEach(function (p) {
          var t = (p && (p['要点'] || p.title)) || '';
          var d = (p && (p['说明'] || p.detail)) || (typeof p === 'string' ? p : '');
          if (!d) return;
          html += '<li class="qa9-point">' +
            (t ? '<span class="qa9-point-t">' + esc(t) + '</span>' : '') +
            '<span class="qa9-point-d">' + esc(d) + '</span></li>';
        });
        html += '</ol></div>';
      }
      if (src === 'local' || src === 'rag' || src === 'hybrid') {
        html += '<details class="qa9-supp"><summary>📚 法规依据</summary>' + self._citeBlock(rag) + '</details>';
      }
      if (src === 'web' || src === 'hybrid') {
        html += '<details class="qa9-supp"><summary>🌐 检索来源</summary>' + self._webBlock(rag) + '</details>';
      }
      if (B.thinking) {
        html += '<details class="qa9-think"><summary class="qa9-think-sum">💡 推理过程<span class="qa9-think-hint">（点击展开）</span></summary>' +
          '<div class="qa9-think-body">' + lines(B.thinking) + '</div></details>';
      }
      var suppParts = [];
      if (B.tips) suppParts.push('<div class="qa9-supp-item"><span class="qa9-supp-k">适用提示</span><div class="qa9-supp-v">' + lines(B.tips) + '</div></div>');
      if (B.risk) suppParts.push('<div class="qa9-supp-item qa9-supp-risk"><span class="qa9-supp-k">风险提示</span><div class="qa9-supp-v">' + lines(B.risk) + '</div></div>');
      if (B.timeNote) suppParts.push('<div class="qa9-supp-item"><span class="qa9-supp-k">时效说明</span><div class="qa9-supp-v">' + lines(B.timeNote) + '</div></div>');
      if (suppParts.length) {
        html += '<details class="qa9-supp"><summary>📌 补充说明</summary><div class="qa9-supp-body">' + suppParts.join('') + '</div></details>';
      }
      var fu = B.followUps || [];
      if (fu.length) {
        html += '<div class="qa9-followups"><div class="qa9-followups-h">🔎 你可能还想问</div><div class="qa9-followup-row">';
        fu.forEach(function (q) {
          html += '<button type="button" class="qa9-followup" data-q="' + esc(q) + '">' + esc(q) + '</button>';
        });
        html += '</div></div>';
      }
      html += '<div class="qa9-expand-inline"><button type="button" class="qa9-expand-btn" data-expand="1">🤖 AI 拓展此回答</button></div>';
      return html;
    },
    _citeBlock: function (rag) {
      var hits = rag.kb_hits || [];
      var note = hits.length
        ? '本次调阅本地法规原文 ' + hits.length + ' 篇（3096 篇全文库），由大模型解读'
        : '依据来自海云AI 本地法规库 + 大模型解读';
      var html = '<div class="qa9-src-note">' + esc(note) + '</div>';
      html += this._sqHtml(rag.search_queries, '📚 本地库检索式');
      html += '<div class="qa9-cite-list">';
      var basis = rag['法规依据'] || [];
      if (basis.length) basis.forEach(function (c, i) { html += this.ragCardHtml(c, i + 1); }, this);
      else if (hits.length) hits.forEach(function (c, i) { html += this.ragCardHtml(c, i + 1); }, this);
      else html += '<div class="qa9-empty">未检索到明确依据。</div>';
      return html + '</div>';
    },
    _webBlock: function (rag) {
      var ws = rag.web_sources || [];
      var html = '<div class="qa9-src-note">以下为实时网络检索结果（点击可跳转原文）</div>';
      if (rag.source !== 'hybrid') html += this._sqHtml(rag.search_queries, '🔍 AI 提炼的检索式');
      html += '<div class="qa9-web-src-list">';
      if (ws.length) ws.forEach(function (s, i) { html += this.webSrcHtml(s, i + 1); }, this);
      else html += '<div class="qa9-empty">本次未检索到外部来源（可能当前网络受限，可切换网络后重试）。</div>';
      return html + '</div>';
    },
    _sqHtml: function (sq, label) {
      if (!sq || !sq.length) return '';
      return '<div class="qa9-sq">' + label + '：' +
        sq.slice(0, 8).map(function (s) { return '<span class="qa9-sq-tag">' + esc(s) + '</span>'; }).join('') + '</div>';
    },
    ragCardHtml: function (c, n) {
      var st = c['状态'] || '';
      var tier = this.stTier(st);
      var badge, bcls;
      if (tier === 0) { badge = '现行有效'; bcls = 'valid'; }
      else if (tier === 1) { badge = '试行'; bcls = 'trial'; }
      else if (tier === 2) { badge = '尚未生效'; bcls = 'pending'; }
      else if (tier === 3) { badge = '参考'; bcls = 'ref'; }
      else if (tier <= 5) { badge = '征求意见'; bcls = 'draft'; }
      else { badge = '已废止'; bcls = 'repealed'; }
      var title = (n ? n + '. ' : '') + '《' + (c['标题'] || '') + '》';
      var metaParts = [c['发布机构'], c['文号'], c['发布日期'], st].filter(Boolean).map(function (x) { return esc(x); });
      var meta = metaParts.length ? '（' + metaParts.join('，') + '）' : '';
      var quote = c['引用原文']
        ? '<div class="qa9-card-hit">原文摘录：' + esc(this._clip(c['引用原文'], 400)) + '</div>'
        : '';
      var local = c['本地路径']
        ? '<div class="qa9-card-local">本地：' + esc(c['本地路径']) + '</div>'
        : '';
      var src = c['来源'] ? '<a class="qa9-src" href="' + esc(c['来源']) + '" target="_blank" rel="noopener">🔗 官方来源 ↗</a>' : '';
      return '<div class="qa9-card ' + bcls + '">' +
        '<div class="qa9-card-top"><span class="qa9-badge ' + bcls + '">' + badge + '</span>' +
        '<span class="qa9-card-title">' + esc(title) + '</span></div>' +
        '<div class="qa9-card-meta">' + meta + '</div>' +
        quote + local + src + '</div>';
    },
    webSrcHtml: function (s, n) {
      var title = (n ? n + '. ' : '') + (s['标题'] || s.title || '来源');
      var url = s['url'] || s.URL || '';
      var snippet = s['摘要'] || s.snippet || s.content || '';
      var host = (function () { try { return new URL(url).hostname; } catch (e) { return ''; } })();
      var titleHtml = url
        ? '<a class="qa9-web-src-title" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(title) + ' ↗</a>'
        : '<span class="qa9-web-src-title">' + esc(title) + '</span>';
      var meta = host ? '<div class="qa9-web-src-host">🔗 ' + esc(host) + '</div>' : '';
      var snip = snippet ? '<div class="qa9-web-src-snippet">' + esc(this._clip(snippet, 220)) + '</div>' : '';
      return '<div class="qa9-web-src">' + titleHtml + meta + snip + '</div>';
    },
    qaCardHtml: function (d, n) {
      var tier = d.tier == null ? 3 : d.tier;
      var badge, bcls;
      if (tier === 0) { badge = '现行有效'; bcls = 'valid'; }
      else if (tier === 1) { badge = '试行'; bcls = 'trial'; }
      else if (tier === 2) { badge = '尚未生效'; bcls = 'pending'; }
      else if (tier === 3) { badge = '参考'; bcls = 'ref'; }
      else if (tier <= 5) { badge = '征求意见'; bcls = 'draft'; }
      else { badge = '已废止'; bcls = 'repealed'; }
      var title = (n ? n + '. ' : '') + '《' + (d.t || '') + '》';
      var metaParts = [d.i, d.d, d.p, d.st].filter(Boolean).map(function (x) { return esc(x); });
      var meta = metaParts.length ? '（' + metaParts.join('，') + '）' : '';
      var hit = d._hit
        ? '<div class="qa9-card-hit">原文摘录：' + esc(this._clip(d._hit, 160)) + '</div>'
        : (d.m ? '<div class="qa9-card-hit">摘要：' + esc(this._clip(d.m, 160)) + '</div>' : '');
      var local = d.local ? '<div class="qa9-card-local">本地：' + esc(d.local) + '</div>' : '';
      var src = d.u ? '<a class="qa9-src" href="' + esc(d.u) + '" target="_blank" rel="noopener">🔗 官方来源 ↗</a>' : '';
      return '<div class="qa9-card ' + bcls + '">' +
        '<div class="qa9-card-top"><span class="qa9-badge ' + bcls + '">' + badge + '</span>' +
        '<span class="qa9-card-title">' + esc(title) + '</span></div>' +
        '<div class="qa9-card-meta">' + meta + '</div>' + hit + local + src + '</div>';
    },
    catRank: function (c) {
      var m = { '01_法律': 0, '02_行政法规': 1, '03_部门规章': 2, '04_技术指导原则': 3, '05_行业共识': 4, '06_国际': 5, '07_规范性文件': 6, '08_其他': 7 };
      for (var k in m) if ((c || '').indexOf(k) === 0) return m[k];
      return 9;
    },
    _sortCites: function (list) {
      if (!list || !list.length) return list || [];
      return list.slice().sort(function (a, b) {
        var ca = this.catRank(a.c), cb = this.catRank(b.c);
        if (ca !== cb) return ca - cb;
        return (a.tier == null ? 3 : a.tier) - (b.tier == null ? 3 : b.tier);
      });
    },
    _firstSent: function (s, max) {
      s = (s || '').replace(/\s+/g, ' ').trim();
      if (!s) return '';
      var mm = s.match(/^.{0,160}?[。；;！!？?\n]/);
      var r = mm ? mm[0] : s.slice(0, 160);
      if (max && r.length > max) r = r.slice(0, max) + '…';
      return r.replace(/^[>\s]+/, '');
    },
    _clip: function (s, n) {
      s = (s || '').replace(/\s+/g, ' ').trim();
      if (s.length > n) return s.slice(0, n) + '…';
      return s;
    },
    stTier: function (st) {
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

    /* ============ 通用 AI 拓展 / 术语解释（POST /api/explain） ============ */
    explainText: function (text, context) {
      var url = this._apiUrl('/api/explain');
      if (!url) return Promise.resolve({ fallback: true, error: 'no backend' });
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, context: context || '' })
      }).then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { return { fallback: true, error: j.error || r.status }; });
        return r.json();
      }).catch(function (e) { return { fallback: true, error: String(e) }; });
    },

    /* ===== 全局：选中文字 → 浮动「🤖 AI 解释」按钮（覆盖所有界面） ===== */
    initSelectionAI: function () {
      if (this._selAiInited) return; this._selAiInited = true;
      var self = this;
      var btn = document.createElement('button');
      btn.id = 'selAiBtn'; btn.className = 'sel-ai-btn'; btn.type = 'button';
      btn.textContent = '🤖 AI 解释'; btn.style.display = 'none';
      document.body.appendChild(btn);
      var hide = function () { btn.style.display = 'none'; };
      document.addEventListener('mouseup', function (e) {
        if (e.target.closest && e.target.closest('.sel-ai-btn')) return;
        setTimeout(function () {
          var sel = window.getSelection();
          var text = sel && sel.toString().trim();
          if (!text || text.length < 2) { hide(); return; }
          var rect = null;
          try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (_) {}
          if (!rect || (rect.width === 0 && rect.height === 0)) { hide(); return; }
          btn.style.display = 'block';
          var left = rect.left + rect.width / 2 - 34;
          var top = rect.top - 38;
          if (top < 8) top = rect.bottom + 8;
          if (left < 8) left = 8;
          if (left + 88 > window.innerWidth - 8) left = window.innerWidth - 96;
          btn.style.left = left + 'px'; btn.style.top = top + 'px';
          btn.dataset.text = text.slice(0, 600);
        }, 10);
      });
      document.addEventListener('mousedown', function (e) {
        if (e.target.closest && e.target.closest('.sel-ai-btn')) return;
        var sel = window.getSelection();
        if (!sel || !sel.toString().trim()) hide();
      });
      btn.addEventListener('click', function () {
        var text = btn.dataset.text || ''; if (!text) return;
        btn.textContent = '⏳ 生成中…'; btn.disabled = true;
        self.explainText(text, '').then(function (resp) {
          btn.disabled = false; btn.textContent = '🤖 AI 解释';
          hide();
          if (resp && resp.fallback) {
            self._toast('未配置 AI 模型或调用受限，无法生成解释。');
          } else {
            self._showSelAiPopover(text, resp && resp.explain ? resp.explain : '');
          }
        });
      });
    },
    _showSelAiPopover: function (text, explain) {
      var pop = document.getElementById('selAiPop');
      if (!pop) { pop = document.createElement('div'); pop.id = 'selAiPop'; pop.className = 'sel-ai-pop'; document.body.appendChild(pop); }
      pop.innerHTML =
        '<div class="sel-ai-pop-h">🤖 AI 拓展解释<button type="button" class="sel-ai-pop-x" id="selAiPopX">×</button></div>' +
        '<div class="sel-ai-pop-q">“' + esc(text.slice(0, 140)) + '”</div>' +
        '<div class="sel-ai-pop-body">' + this.mdToHtml(explain || '（无内容）') + '</div>';
      pop.style.display = 'block';
      pop.style.left = Math.max(12, window.innerWidth / 2 - 250) + 'px';
      pop.style.top = Math.max(12, window.innerHeight / 2 - 170) + 'px';
      var x = pop.querySelector('#selAiPopX');
      if (x) x.addEventListener('click', function () { pop.style.display = 'none'; });
    },

    /* ===== QA 回答底部「🤖 AI 拓展此回答」 ===== */
    _qaExpandAnswer: function (btn) {
      var self = this;
      var msg = btn.closest('.qa9-msg'); if (!msg) return;
      var body = msg.querySelector('.qa9-msg-body') || msg.querySelector('.qa9-bubble');
      if (!body) return;
      var clone = body.cloneNode(true);
      clone.querySelectorAll('button').forEach(function (b) { b.remove(); });
      var text = (clone.innerText || clone.textContent || '').trim().slice(0, 1200);
      if (!text) return;
      var box = document.createElement('div');
      box.className = 'qa9-expand-box';
      if (btn.parentNode) btn.parentNode.insertBefore(box, btn.nextSibling);
      box.innerHTML = '<div class="qa9-ai-loading">🤖 正在拓展解读…</div>';
      btn.disabled = true;
      this.explainText(text, '').then(function (resp) {
        if (resp && resp.fallback) box.innerHTML = '<div class="qa9-ai-res">⚠️ 未配置 AI 模型，无法拓展。</div>';
        else box.innerHTML = '<div class="qa9-ai-res"><b>🤖 AI 拓展</b><br>' + self.mdToHtml(resp.explain || '') + '</div>';
      }).catch(function () {
        box.innerHTML = '<div class="qa9-ai-res">拓展失败。</div>';
      }).then(function () { btn.disabled = false; });
    },

    /* ===== 轻量 Markdown 渲染（无依赖） ===== */
    mdToHtml: function (md) {
      var escH = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
      var inline = function (s) {
        var t = escH(s);
        t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, a, b) { return '<a href="' + b.replace(/"/g, '%22') + '" target="_blank" rel="noopener">' + a + '</a>'; });
        t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
        return t;
      };
      var lines = String(md).replace(/\r\n?/g, '\n').split('\n');
      var n = lines.length;
      var isTableSep = function (s) { return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(s); };
      var isBlockStart = function (s) { return /^(#{1,6}\s|\s*>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(s) || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(s); };
      var salvageFlatTable = function (raw) {
        var cells = raw.split('|').map(function (x) { return x.trim(); });
        while (cells.length && cells[0] === '') cells.shift();
        while (cells.length && cells[cells.length - 1] === '') cells.pop();
        var sep = -1;
        for (var k = 0; k < cells.length; k++) { if (/^:?-{2,}:?$/.test(cells[k])) { sep = k; break; } }
        var data = (sep >= 0 ? cells.slice(sep + 1) : cells).filter(function (x) { return x !== ''; });
        if (data.length < 2) return null;
        var rows = [];
        for (var k2 = 0; k2 + 1 < data.length; k2 += 2) rows.push([data[k2], data[k2 + 1]]);
        if (!rows.length) return null;
        var h = '<table class="reg-table"><thead><tr><th>项目</th><th>内容</th></tr></thead><tbody>';
        rows.forEach(function (r) { h += '<tr><td>' + inline(r[0]) + '</td><td>' + inline(r[1]) + '</td></tr>'; });
        return h + '</tbody></table>';
      };
      var out = ''; var i = 0;
      while (i < n) {
        var line = lines[i];
        if (!line.trim()) { i++; continue; }
        var hm = line.match(/^(#{1,6})\s+(.*)$/);
        if (hm) { var lv = hm[1].length; out += '<h' + lv + '>' + inline(hm[2].trim()) + '</h' + lv + '>'; i++; continue; }
        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out += '<hr>'; i++; continue; }
        if (/\|\s*:?-{2,}:?\s*\|/.test(line)) {
          var ft = salvageFlatTable(line.trim());
          if (ft) { out += ft; i++; continue; }
          var stripped = line.replace(/^\s*\|[\s|:-]*/, '').replace(/[\s|:-]*\|$/, '').trim();
          if (stripped) { out += '<p>' + inline(stripped) + '</p>'; i++; continue; }
          out += '<hr>'; i++; continue;
        }
        if (line.indexOf('|') >= 0 && i + 1 < n && isTableSep(lines[i + 1])) {
          var splitRow = function (s) { var c = s.split('|').map(function (x) { return x.trim(); }); if (c.length && c[0] === '') c.shift(); if (c.length && c[c.length - 1] === '') c.pop(); return c; };
          var header = splitRow(line); i += 2; var rows = [];
          while (i < n && lines[i].indexOf('|') >= 0 && lines[i].trim()) { rows.push(splitRow(lines[i])); i++; }
          out += '<table class="reg-table"><thead><tr>' + header.map(function (h) { return '<th>' + inline(h) + '</th>'; }).join('') + '</tr></thead><tbody>';
          rows.forEach(function (r) { out += '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; });
          out += '</tbody></table>';
          continue;
        }
        if (/^\s*>/.test(line)) {
          var buf = [];
          while (i < n && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
          out += '<blockquote>' + buf.map(function (b) { return b.trim() ? '<p>' + inline(b) + '</p>' : ''; }).join('') + '</blockquote>';
          continue;
        }
        if (/^\s*[-*+]\s+/.test(line)) {
          var buf2 = [];
          while (i < n && /^\s*[-*+]\s+/.test(lines[i])) { buf2.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++; }
          out += '<ul>' + buf2.map(function (b) { return '<li>' + inline(b) + '</li>'; }).join('') + '</ul>';
          continue;
        }
        if (/^\s*\d+[.)]\s+/.test(line)) {
          var buf3 = [];
          while (i < n && /^\s*\d+[.)]\s+/.test(lines[i])) { buf3.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
          out += '<ol>' + buf3.map(function (b) { return '<li>' + inline(b) + '</li>'; }).join('') + '</ol>';
          continue;
        }
        var buf4 = [line]; i++;
        while (i < n && lines[i].trim() && !isBlockStart(lines[i]) && !(lines[i].indexOf('|') >= 0 && i + 1 < n && isTableSep(lines[i + 1]))) { buf4.push(lines[i]); i++; }
        out += '<p>' + inline(buf4.join(' ')) + '</p>';
      }
      return out;
    }
  };

  window.QaAi = QaAi;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { QaAi.mount(); });
  } else {
    QaAi.mount();
  }
})();
