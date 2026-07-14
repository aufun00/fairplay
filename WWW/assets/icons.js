/* FairPlay UI 图标 sprite —— 单一来源,运行时内联注入到页面。
   为什么内联而非外链 .svg:
     · Chrome 对外链 <use> 的 currentColor 只在加载时取色,不随 :hover 的 color 变化重绘;
     · file:// 下外链 <use> 被当跨源静默拒绝。
   内联后用同文档 <use href="#id">,currentColor / hover 在各浏览器都正常,file:// 也能显示。
   线性图标(24×24,stroke=currentColor):随按钮文字色/主题变色,尺寸由 CSS .ic 控。
   新增图标:往 SPRITE 里加一个 <symbol id="…">;别删已用的 id。 */
(function () {
  var SPRITE =
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">' +
      '<symbol id="exit" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
        '<polyline points="16 17 21 12 16 7"/>' +
        '<line x1="21" y1="12" x2="9" y2="12"/>' +
      '</symbol>' +
      '<symbol id="lang" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="10"/>' +
        '<line x1="2" y1="12" x2="22" y2="12"/>' +
        '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' +
      '</symbol>' +
    '</svg>';

  function inject() {
    if (document.getElementById("fp-sprite")) return;   // 去重(多次加载/多页无副作用)
    var wrap = document.createElement("div");
    wrap.id = "fp-sprite";
    wrap.style.display = "none";
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = SPRITE;
    document.body.insertBefore(wrap, document.body.firstChild);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject);
  else inject();
})();
