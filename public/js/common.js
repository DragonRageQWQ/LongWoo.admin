/**
 * LongWoo 公共脚本
 * 提供跨页面共享的功能：session 检查、底部导航高亮
 */

// ===== Session 检查：已登录用户替换登录按钮 =====
(function() {
  fetch('/api/session-check', { credentials: 'include' })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.loggedIn) {
        var loginLink = document.querySelector('a[href="/login"]');
        if (loginLink) {
          loginLink.href = '/profile';
          loginLink.textContent = '个人中心';
        }
      }
    })
    .catch(function() {});
})();

// ===== 底部导航高亮（根据当前页面自动标记 active） =====
(function() {
  var path = window.location.pathname;
  var navItems = document.querySelectorAll('.bottom-nav .nav-item');
  navItems.forEach(function(item) {
    var href = item.getAttribute('href');
    if (href && path.endsWith(href)) {
      item.classList.add('active');
      var svg = item.querySelector('svg');
      if (svg) svg.setAttribute('stroke', 'var(--color-primary)');
    }
  });
})();
