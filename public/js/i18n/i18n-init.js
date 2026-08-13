/**
 * LW-I18N 全局语言切换基础设施（静态页专用）
 *
 * 工作方式：
 *   1. 语言检测优先级：URL 参数 ?lang=zh|en → localStorage(lw_lang) → 默认 zh
 *   2. 非 zh 语言时加载对应字典（/js/i18n/en.js → window.LW_I18N_DICTS.en）
 *   3. 按 [data-i18n] 等标记替换页面文本（textContent / placeholder / title / html / document.title）
 *
 * 上线开关：
 *   CONFIG.enabled = false（当前）：切换器不注入页面，用户不可见；
 *   但 ?lang=en 参数仍可生效，便于开发与回归预览。
 *   全站语言功能整体上线时改为 true，切换器将自动出现在 [data-lang-slot] 容器内。
 */
(function () {
  'use strict';

  var CONFIG = {
    enabled: true, // 语言切换功能已实装：静态页切换器显示；如需回退到未上线状态改回 false
    storageKey: 'lw_lang',
    defaultLang: 'zh',
    supported: ['zh', 'en'],
    dictScripts: {
      en: '/js/i18n/en.js',
    },
  };

  var LOADED_DICT = null;

  function getUrlLang() {
    var m = location.search.match(/[?&]lang=(zh|en)/i);
    return m ? m[1].toLowerCase() : null;
  }

  function getStoredLang() {
    try {
      var v = localStorage.getItem(CONFIG.storageKey);
      return CONFIG.supported.indexOf(v) > -1 ? v : null;
    } catch (e) {
      return null;
    }
  }

  function detectLang() {
    return getUrlLang() || getStoredLang() || CONFIG.defaultLang;
  }

  function currentLang() {
    var l = detectLang();
    return l === 'en' ? 'en' : 'zh';
  }

  function t(key, dict) {
    if (!dict || !key) return null;
    return dict[key] !== undefined && dict[key] !== null ? dict[key] : null;
  }

  function loadDict(lang, cb) {
    if (lang === CONFIG.defaultLang) { LOADED_DICT = null; cb(null); return; }
    if (window.LW_I18N_DICTS && window.LW_I18N_DICTS[lang]) { LOADED_DICT = window.LW_I18N_DICTS[lang]; cb(LOADED_DICT); return; }
    var url = CONFIG.dictScripts[lang];
    if (!url) { LOADED_DICT = null; cb(null); return; }
    var s = document.createElement('script');
    s.src = url;
    s.onload = function () {
      LOADED_DICT = (window.LW_I18N_DICTS && window.LW_I18N_DICTS[lang]) || null;
      cb(LOADED_DICT);
    };
    s.onerror = function () { LOADED_DICT = null; cb(null); };
    document.head.appendChild(s);
  }

  function applyDict(dict) {
    var lang = currentLang();
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';

    if (!dict) return; // 中文默认，无需替换（页面源文本即中文）

    // 元素文本
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n'), dict);
      if (v !== null) el.textContent = v;
    });
    // placeholder
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n-ph'), dict);
      if (v !== null) el.setAttribute('placeholder', v);
    });
    // title / alt
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n-title'), dict);
      if (v !== null) el.setAttribute('title', v);
    });
    // 受信任 HTML 替换（仅允许字典内的受控内容）
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n-html'), dict);
      if (v !== null) el.innerHTML = v;
    });
    // 文档标题
    var docKey = document.body.getAttribute('data-i18n-doc-title');
    if (docKey) {
      var tv = t(docKey, dict);
      if (tv) document.title = tv;
    }
    // meta description 双语（meta[name=description][data-i18n-meta]）
    var metaDesc = document.querySelector('meta[name="description"][data-i18n-meta]');
    if (metaDesc) {
      var mv = t(metaDesc.getAttribute('data-i18n-meta'), dict);
      if (mv) metaDesc.setAttribute('content', mv);
    }
    // 切换器状态
    var sw = document.getElementById('lw-lang-switcher');
    if (sw) sw.setAttribute('data-lang', lang);
  }

  /**
   * 全局 i18n 接口（供页面内联 JS 的动态文本使用）
   * 用法：LW_I18N.t('key') 返回当前语言文本；LW_I18N.lang() 返回当前语言。
   * 页面内联脚本需在 DOMContentLoaded 之后调用（字典可能异步加载完成）。
   */
  function exposeGlobal() {
    window.LW_I18N = {
      lang: function () { return currentLang(); },
      t: function (key) { return t(key, LOADED_DICT); },
    };
  }

  function switchLang(lang) {
    if (CONFIG.supported.indexOf(lang) === -1) lang = CONFIG.defaultLang;
    try { localStorage.setItem(CONFIG.storageKey, lang); } catch (e) {}
    var url = new URL(location.href);
    url.searchParams.set('lang', lang);
    location.href = url.toString();
  }

  // 切换器注入（未上线时不注入）
  function injectSwitcher() {
    if (!CONFIG.enabled) return;
    var slots = document.querySelectorAll('[data-lang-slot]');
    if (!slots.length) return;
    var lang = currentLang();
    slots.forEach(function (slot) {
      var div = document.createElement('div');
      div.className = 'lw-lang-switcher';
      div.id = 'lw-lang-switcher';
      div.setAttribute('data-lang', lang);
      div.innerHTML =
        '<button type="button" class="lw-lang-btn" data-lang-val="zh">中</button>' +
        '<span class="lw-lang-sep">/</span>' +
        '<button type="button" class="lw-lang-btn" data-lang-val="en">EN</button>';
      div.querySelectorAll('[data-lang-val]').forEach(function (btn) {
        btn.addEventListener('click', function () { switchLang(btn.getAttribute('data-lang-val')); });
      });
      slot.appendChild(div);
    });
  }

  function init() {
    exposeGlobal();
    injectSwitcher();
    var lang = currentLang();
    loadDict(lang, applyDict);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
