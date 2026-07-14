/* FairPlay — 页面通用引导(所有页面共用,改一处全生效) */
window.FairPlay = window.FairPlay || {};

/* Service Worker 注册 */
window.FairPlay.registerSW = function (path) {
  if ("serviceWorker" in navigator) {
    addEventListener("load", function () { navigator.serviceWorker.register(path).catch(function () {}); });
  }
};

/* 置顶栏:i18n 文本 + 占位符绑定 + 右侧版本号 */
window.FairPlay.initTopbar = function () {
  var L = (window.I18N && window.I18N.en) || {};
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    var t = L[el.getAttribute("data-i18n")];
    if (t != null) el.textContent = t;
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
    var t = L[el.getAttribute("data-i18n-ph")];
    if (t != null) el.placeholder = t;
  });
  /* 图标按钮无可见文字,用 aria-label 供读屏(键名同 data-i18n) */
  document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
    var t = L[el.getAttribute("data-i18n-aria")];
    if (t != null) el.setAttribute("aria-label", t);
  });
  var ver = document.getElementById("ver");
  if (ver && self.FAIRPLAY_VERSION) ver.textContent = "v" + self.FAIRPLAY_VERSION.replace(/^fairplay\./, "");
};
