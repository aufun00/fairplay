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
      '<symbol id="ic_exit" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
        '<polyline points="16 17 21 12 16 7"/>' +
        '<line x1="21" y1="12" x2="9" y2="12"/>' +
      '</symbol>' +
      '<symbol id="ic_lang" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="10"/>' +
        '<line x1="2" y1="12" x2="22" y2="12"/>' +
        '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' +
      '</symbol>' +
      '<symbol id="ic_share" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="18" cy="5" r="3"/>' +
        '<circle cx="6" cy="12" r="3"/>' +
        '<circle cx="18" cy="19" r="3"/>' +
        '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>' +
        '<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>' +
      '</symbol>' +
      /* 首页模式开关(线性,sliders 推子):new 引导页 ↔ pro 一屏页 */
      '<symbol id="ic_mode" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/>' +
        '<line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/>' +
        '<line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/>' +
        '<line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/>' +
      '</symbol>' +
      /* 游戏控件(实心,fill=currentColor):播放/暂停 */
      '<symbol id="ic_play" viewBox="0 0 24 24" fill="currentColor" stroke="none">' +
        '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z"/>' +
      '</symbol>' +
      '<symbol id="ic_pause" viewBox="0 0 24 24" fill="currentColor" stroke="none">' +
        '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>' +
      '</symbol>' +

      /* ===== 目录图标(线性,stroke=currentColor;草稿,可迭代)===== */
      /* L1 大类 */
      '<symbol id="ic_flash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M13 2 3 14 12 14 11 22 21 10 12 10z"/>' +   // 闪电:<1m
      '</symbol>' +
      '<symbol id="ic_quick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h15v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/>' +   // 咖啡杯:1~5m
        '<path d="M7 2v2M11 2v2M15 2v2"/>' +
      '</symbol>' +
      '<symbol id="ic_deep" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 2h12M6 22h12M7 2v3l5 5 5-5V2M7 22v-3l5-5 5 5v3"/>' +   // 沙漏:长考
      '</symbol>' +
      '<symbol id="ic_party" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 21l4.5-11 6.5 6.5z"/><path d="M14 10c1-2 3-3 5-2M15 5v-2M19 9l2-1M12 3l1 1"/>' +   // 派对喷筒 + 彩屑
      '</symbol>' +
      /* L2 小类 */
      '<symbol id="ic_arcade" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="2" y="8" width="20" height="9" rx="4.5"/><path d="M7 11v3M5.5 12.5h3"/>' +   // 手柄 + 十字键
        '<circle cx="15.5" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/>' +
      '</symbol>' +
      '<symbol id="ic_puzzle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M10 4a2 2 0 1 1 4 0v1h4v4a2 2 0 1 1 0 4v4h-4v1a2 2 0 1 1-4 0v-1H6v-4a2 2 0 1 0 0-4V5h4z"/>' +   // 拼图块
      '</symbol>' +
      '<symbol id="ic_board" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>' +   // 棋盘 3×3
      '</symbol>' +
      '<symbol id="ic_match" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 9.8 8.2 12 6 14.2 3.8 12z"/><path d="M12 9.8 14.2 12 12 14.2 9.8 12z"/><path d="M18 9.8 20.2 12 18 14.2 15.8 12z"/>' +   // 三连宝石(消除)
      '</symbol>' +
      '<symbol id="ic_card" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M12 8 14 11 12 14 10 11z"/>' +   // 牌 + 方块花色
      '</symbol>' +
      '<symbol id="ic_word" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 15l2.5-6 2.5 6M9 13h3"/>' +   // 字母牌 A
      '</symbol>' +
      '<symbol id="ic_number" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 3.5 7.5 20.5M16.5 3.5 15 20.5M4 9h16M3 15h16"/>' +   // # 数字号
      '</symbol>' +
      /* 游戏 */
      '<symbol id="ic_match3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M5 2v4M7 2v4M9 2v4"/><path d="M5 6h4"/><path d="M7 6v16"/>' +   // 叉子:三齿 + 齿根 + 柄
        '<path d="M16 2c3 2 3 9 0 11"/><path d="M16 13v9"/>' +                     // 刀:弯刃 + 柄
      '</symbol>' +
      '<symbol id="ic_mathdoku" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16M4 12h16"/><path d="M6.5 7.5h3M8 6v3"/>' +   // 数格 + 加号
      '</symbol>' +
      /* mathdoku 变体:数格 + 右下格填尺寸数字(区分 5×5 / 9×9,小尺寸也一眼分) */
      '<symbol id="ic_mathdoku5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 2.5v7M2.5 6h7"/>' +                          // ↖ +
        '<path d="M14.5 2.5 21.5 9.5M21.5 2.5 14.5 9.5"/>' +      // ↗ ×
        '<path d="M2.5 18h7M6 14.3h.01M6 21.7h.01"/>' +           // ↙ ÷
        '<text x="18" y="22.8" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="800" fill="currentColor" stroke="none">5</text>' +  // ↘ 尺寸
      '</symbol>' +
      '<symbol id="ic_mathdoku9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 2.5v7M2.5 6h7"/>' +
        '<path d="M14.5 2.5 21.5 9.5M21.5 2.5 14.5 9.5"/>' +
        '<path d="M2.5 18h7M6 14.3h.01M6 21.7h.01"/>' +
        '<text x="18" y="22.8" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="800" fill="currentColor" stroke="none">9</text>' +
      '</symbol>' +
      '<symbol id="ic_memory" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="6" width="10" height="14" rx="1.6"/><rect x="11" y="4" width="10" height="14" rx="1.6"/>' +   // 两张牌
      '</symbol>' +
    '</svg>';

  function inject() {
    if (document.getElementById("ic_sprite")) return;   // 去重(多次加载/多页无副作用)
    var wrap = document.createElement("div");
    wrap.id = "ic_sprite";
    wrap.style.display = "none";
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = SPRITE;
    document.body.insertBefore(wrap, document.body.firstChild);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject);
  else inject();
})();
