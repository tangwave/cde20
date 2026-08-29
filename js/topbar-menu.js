/* 顶部导航分组下拉交互（抽离为外链脚本，兼容严格 CSP script-src 'self'） */
(function () {
  var menus = Array.prototype.slice.call(document.querySelectorAll('.topbar-menu'));
  if (!menus.length) return;
  function closeAll() { menus.forEach(function (m) { m.classList.remove('open'); }); }
  function items(m) { return Array.prototype.slice.call(m.querySelectorAll('.topbar-menu-list .topbar-btn')); }
  menus.forEach(function (m) {
    var btn = m.querySelector('.topbar-menu-btn');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var wasOpen = m.classList.contains('open');
      closeAll();
      if (!wasOpen) m.classList.add('open');
    });
    // 分组按钮：↓ 展开并聚焦首项，Esc 收起
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        if (e.key === 'ArrowDown') e.preventDefault();
        if (!m.classList.contains('open')) { closeAll(); m.classList.add('open'); }
        var it = items(m); if (it.length) it[0].focus();
      } else if (e.key === 'Escape') { closeAll(); }
    });
    items(m).forEach(function (b) {
      // 点击后收起（不阻止冒泡，保证 data-portal 委托仍生效）
      b.addEventListener('click', closeAll);
      // 菜单内 ↑↓ 移动焦点、Esc 收起并回焦分组按钮、Tab 移出即收起
      b.addEventListener('keydown', function (e) {
        var it = items(m), idx = it.indexOf(b);
        if (e.key === 'ArrowDown') { e.preventDefault(); if (it[idx + 1]) it[idx + 1].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (idx > 0) it[idx - 1].focus(); else btn.focus(); }
        else if (e.key === 'Escape') { e.stopPropagation(); closeAll(); btn.focus(); }
        else if (e.key === 'Tab') { closeAll(); }
      });
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('.topbar-menu')) closeAll();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });
})();
