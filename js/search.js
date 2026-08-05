/**
 * 海云AI - 搜索功能 (v3.0)
 * 数据结构：categories → varieties → stages
 */

const SearchEngine = {
  results: [],
  searchTimeout: null,

  init() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    if (!searchInput || !searchResults) return;

    searchInput.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.search(e.target.value.trim());
      }, 200);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          this.search(query);
          const firstResult = searchResults.querySelector('.search-result-item');
          if (firstResult) firstResult.click();
        }
      }
      if (e.key === 'Escape') {
        this.hideResults();
        searchInput.blur();
      }
    });

    document.addEventListener('click', (e) => {
      if (!searchResults.contains(e.target) && e.target !== searchInput) {
        this.hideResults();
      }
    });
  },

  search(query) {
    if (!query || query.length < 2) {
      this.hideResults();
      return;
    }

    const results = [];
    const lowerQuery = query.toLowerCase();

    // 遍历 分类 → 品种
    KB_DATA.categories.forEach(category => {
      category.varieties.forEach(variety => {
        // 搜索名称
        if (
          variety.name.toLowerCase().includes(lowerQuery) ||
          (variety.enName && variety.enName.toLowerCase().includes(lowerQuery)) ||
          (variety.gmpAppendix && variety.gmpAppendix.toLowerCase().includes(lowerQuery))
        ) {
          results.push({
            type: 'variety',
            varietyId: variety.id,
            varietyName: variety.name,
            title: `${variety.icon} ${variety.name} (${variety.enName || ''})`,
            context: variety.gmpAppendix || category.name,
            contextBadge: '品种'
          });
        }

        // 搜索子类别
        if (variety.subCategories) {
          variety.subCategories.forEach(sub => {
            if (sub.toLowerCase().includes(lowerQuery)) {
              results.push({
                type: 'variety',
                varietyId: variety.id,
                varietyName: variety.name,
                title: `${variety.icon} ${sub}`,
                context: `${variety.name} - 子类别`,
                contextBadge: '子类别'
              });
            }
          });
        }

        // 搜索关键风险
        if (variety.keyRisks) {
          variety.keyRisks.forEach(risk => {
            if (risk.toLowerCase().includes(lowerQuery)) {
              results.push({
                type: 'variety',
                varietyId: variety.id,
                varietyName: variety.name,
                title: `${variety.icon} ${risk}`,
                context: `${variety.name} - 关键风险`,
                contextBadge: '关键风险'
              });
            }
          });
        }

        // 搜索各阶段内容
        if (variety.stages) {
          Object.keys(variety.stages).forEach(stageId => {
            const stageData = variety.stages[stageId];
            const stage = KB_DATA.stages.find(s => s.id === stageId);
            const stageName = stage ? stage.name : stageId;

            // 搜索摘要
            if (stageData.summary && stageData.summary.toLowerCase().includes(lowerQuery)) {
              results.push({
                type: 'detail',
                varietyId: variety.id,
                varietyName: variety.name,
                stageId: stageId,
                stageName: stageName,
                title: `${variety.icon} ${variety.name} - ${stageName}`,
                context: this.highlightSnippet(stageData.summary, query),
                contextBadge: '摘要'
              });
            }

            // 工艺/质量/管理三重点（含指导意见、详细描述与实施方案）
            ['process_focus', 'quality_focus', 'quality_mgmt'].forEach(focusKey => {
              if (stageData[focusKey]) {
                stageData[focusKey].forEach(item => {
                  const text = (item && typeof item === 'object') ? item.text : item;
                  const guidance = (item && typeof item === 'object' && item.guidance) ? item.guidance : '';
                  const detail = (item && typeof item === 'object' && item.detail) ? item.detail : '';
                  const plan = (item && typeof item === 'object' && Array.isArray(item.plan)) ? item.plan.join(' ') : '';
                  if (String(text).toLowerCase().includes(lowerQuery) ||
                      guidance.toLowerCase().includes(lowerQuery) ||
                      detail.toLowerCase().includes(lowerQuery) ||
                      plan.toLowerCase().includes(lowerQuery)) {
                    const label = focusKey === 'process_focus' ? '工艺研究' : focusKey === 'quality_focus' ? '质量研究' : '质量管理';
                    const snippets =
                      this.highlightSnippet(text, query) +
                      (guidance.toLowerCase().includes(lowerQuery) ? ' …💡 ' + this.highlightSnippet(guidance, query) : '') +
                      (detail.toLowerCase().includes(lowerQuery) ? ' …📖 ' + this.highlightSnippet(detail, query) : '') +
                      (plan.toLowerCase().includes(lowerQuery) ? ' …🛠 ' + this.highlightSnippet(plan, query) : '');
                    results.push({
                      type: 'detail',
                      varietyId: variety.id,
                      varietyName: variety.name,
                      stageId: stageId,
                      stageName: stageName,
                      title: `${variety.icon} ${variety.name} - ${stageName}`,
                      context: snippets,
                      contextBadge: label
                    });
                  }
                });
              }
            });

            // 搜索国内要求
            if (stageData.domestic && stageData.domestic.requirements) {
              stageData.domestic.requirements.forEach(req => {
                const reqText = typeof req === 'string' ? req : (req.text || '');
                const reqGuidance = typeof req === 'object' && req.guidance ? req.guidance : '';
                if (reqText.toLowerCase().includes(lowerQuery) ||
                  (reqGuidance && reqGuidance.toLowerCase().includes(lowerQuery))) {
                  results.push({
                    type: 'detail',
                    varietyId: variety.id,
                    varietyName: variety.name,
                    stageId: stageId,
                    stageName: stageName,
                    title: `${variety.icon} ${variety.name} - ${stageName}`,
                    context: this.highlightSnippet(reqText, query),
                    contextBadge: '国内要求'
                  });
                }
              });
            }

            // 搜索国内法规
            if (stageData.domestic && stageData.domestic.regulations) {
              stageData.domestic.regulations.forEach(reg => {
                if (reg.title.toLowerCase().includes(lowerQuery)) {
                  results.push({
                    type: 'detail',
                    varietyId: variety.id,
                    varietyName: variety.name,
                    stageId: stageId,
                    stageName: stageName,
                    title: `${variety.icon} ${reg.title}`,
                    context: `${variety.name} - ${stageName} - 国内法规`,
                    contextBadge: '法规'
                  });
                }
              });
            }

            // 搜索国际要求
            if (stageData.international && stageData.international.requirements) {
              stageData.international.requirements.forEach(req => {
                const reqText = typeof req === 'string' ? req : (req.text || '');
                const reqGuidance = typeof req === 'object' && req.guidance ? req.guidance : '';
                if (reqText.toLowerCase().includes(lowerQuery) ||
                  (reqGuidance && reqGuidance.toLowerCase().includes(lowerQuery))) {
                  results.push({
                    type: 'detail',
                    varietyId: variety.id,
                    varietyName: variety.name,
                    stageId: stageId,
                    stageName: stageName,
                    title: `${variety.icon} ${variety.name} - ${stageName}`,
                    context: this.highlightSnippet(reqText, query),
                    contextBadge: '国际要求'
                  });
                }
              });
            }

            // 搜索国际法规
            if (stageData.international && stageData.international.regulations) {
              stageData.international.regulations.forEach(reg => {
                if (reg.title.toLowerCase().includes(lowerQuery) ||
                  (reg.source && reg.source.toLowerCase().includes(lowerQuery))) {
                  results.push({
                    type: 'detail',
                    varietyId: variety.id,
                    varietyName: variety.name,
                    stageId: stageId,
                    stageName: stageName,
                    title: `${variety.icon} ${reg.title}`,
                    context: `${variety.name} - ${stageName} - ${reg.source || '国际法规'}`,
                    contextBadge: reg.source || '法规'
                  });
                }
              });
            }

            // 搜索指导建议
            if (stageData.guidance) {
              stageData.guidance.forEach(g => {
                if (g.toLowerCase().includes(lowerQuery)) {
                  results.push({
                    type: 'detail',
                    varietyId: variety.id,
                    varietyName: variety.name,
                    stageId: stageId,
                    stageName: stageName,
                    title: `${variety.icon} ${variety.name} - ${stageName}`,
                    context: this.highlightSnippet(g, query),
                    contextBadge: '指导建议'
                  });
                }
              });
            }

            // 搜索案例
            if (stageData.cases) {
              stageData.cases.forEach(c => {
                if (
                  c.title.toLowerCase().includes(lowerQuery) ||
                  (c.description && c.description.toLowerCase().includes(lowerQuery)) ||
                  (c.lesson && c.lesson.toLowerCase().includes(lowerQuery))
                ) {
                  results.push({
                    type: 'detail',
                    varietyId: variety.id,
                    varietyName: variety.name,
                    stageId: stageId,
                    stageName: stageName,
                    title: `${variety.icon} ${c.title}`,
                    context: this.highlightSnippet(c.description || c.lesson || '', query),
                    contextBadge: '案例'
                  });
                }
              });
            }

            // 搜索常见问题
            if (stageData.pitfalls) {
              stageData.pitfalls.forEach(p => {
                if (p.toLowerCase().includes(lowerQuery)) {
                  results.push({
                    type: 'detail',
                    varietyId: variety.id,
                    varietyName: variety.name,
                    stageId: stageId,
                    stageName: stageName,
                    title: `${variety.icon} ${variety.name} - ${stageName}`,
                    context: this.highlightSnippet(p, query),
                    contextBadge: '常见问题'
                  });
                }
              });
            }
          });
        }
      });
    });

    // 去重（保留前50条）
    const seen = new Set();
    const uniqueResults = results.filter(r => {
      const key = r.title + r.context;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 50);

    this.results = uniqueResults;
    this.renderResults(query);
  },

  highlightSnippet(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text.length > 80 ? text.substring(0, 80) + '...' : text;

    const start = Math.max(0, idx - 30);
    const end = Math.min(text.length, idx + query.length + 50);
    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return snippet.replace(regex, '<span class="search-highlight">$1</span>');
  },

  renderResults(query) {
    const container = document.getElementById('searchResults');
    if (!container) return;

    if (this.results.length === 0) {
      container.innerHTML = `<div class="search-no-results">未找到与"${this.escapeHtml(query)}"相关的内容</div>`;
      container.classList.add('visible');
      return;
    }

    let html = `<div class="search-results-header">找到 ${this.results.length} 条结果</div>`;
    this.results.forEach((r, idx) => {
      html += `
        <div class="search-result-item" data-index="${idx}">
          <div class="search-result-title">${r.title}</div>
          <div class="search-result-context">
            <span class="badge">${r.contextBadge}</span>
            <span>${r.context}</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    container.classList.add('visible');

    container.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index);
        this.navigateResult(this.results[idx]);
      });
    });
  },

  navigateResult(result) {
    this.hideResults();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    if (result.type === 'variety') {
      App.selectVariety(result.varietyId);
    } else if (result.type === 'detail' && result.stageId) {
      App.selectVariety(result.varietyId);
      setTimeout(() => {
        App.selectStage(result.stageId);
      }, 50);
    }
  },

  hideResults() {
    const container = document.getElementById('searchResults');
    if (container) container.classList.remove('visible');
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
