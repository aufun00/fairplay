/* FairPlay — blockfit 专属语言包。通用置顶栏 + 成绩分享(score/game_share*)来自 ../index.lang.js。
   目录条目 i18n 键 = 注册表 key(blockfit)。name = 显示名唯一来源;时长由按钮/角标表达,不进文案。 */
window.I18N = window.I18N || {};
window.I18N.en = Object.assign(window.I18N.en || {}, {
  bf_timeup: "Time's up!",
  bf_over: "No room left!",
  bf_rules: "Place all three pieces on the 8×8 board (no rotation). Fill a whole row or column to clear it. Clear more at once — and on back-to-back moves — for exponential bonuses. It ends when the timer runs out or none of your pieces fit.",
  blockfit: { name: "Block Fit", desc: "Fill & clear" }
});
window.I18N.zh = Object.assign(window.I18N.zh || {}, {
  bf_timeup: "时间到!",
  bf_over: "放不下了!",
  bf_rules: "把三块都摆到 8×8 棋盘上(不可旋转)。填满整行或整列即消除。一步多消、连续消(连消)有指数加成。时间耗尽或手上的块都放不下即结束。",
  blockfit: { name: "方块填格", desc: "填格消行" }
});
