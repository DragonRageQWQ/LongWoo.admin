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

// ===== 图片版权保护：禁止用户保存网页内图片 =====
// 覆盖：右键菜单保存、拖拽到桌面/文件夹、Ctrl+S/Ctrl+Shift+S 保存页面、
//       移动端长按保存菜单（配合 theme.css 的 -webkit-touch-callout:none）
(function() {
  'use strict';

  /** 判断事件目标是否为图片（或包含图片的元素） */
  function isImageTarget(target) {
    if (!target || target.nodeType !== 1) return false;
    if (target.tagName === 'IMG') return true;
    return !!target.querySelector('img');
  }

  // 1) 图片上禁止右键菜单（防止"图片另存为"）
  document.addEventListener('contextmenu', function(e) {
    if (isImageTarget(e.target)) {
      e.preventDefault();
      return false;
    }
  }, true);

  // 2) 图片禁止拖拽（防止拖到桌面/文件夹保存）
  document.addEventListener('dragstart', function(e) {
    if (isImageTarget(e.target)) {
      e.preventDefault();
      return false;
    }
  }, true);

  // 3) 图片禁止以文本形式被拖放复制
  document.addEventListener('drop', function(e) {
    if (e.target && e.target.closest && e.target.closest('img')) {
      e.preventDefault();
      return false;
    }
  }, true);

  // 4) 拦截 Ctrl+S / Ctrl+Shift+S（浏览器保存页面会连带保存图片资源）
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);
})();
