/* FairPlay — blockfit 专属语言包。通用置顶栏 + 成绩分享(score/game_share*)来自 ../index.lang.js。
   dsp_dsc_idx(blockfit830/890/8inf)指向的 name/desc = 三档显示名/说明的唯一来源。名字纯显示、时间只进 desc。 */
window.I18N = window.I18N || {};
window.I18N.en = Object.assign(window.I18N.en || {}, {
  bf_timeup: "Time's up!",
  bf_over: "No room left!",
  bf_rules: "Place all three pieces on the 8×8 board (no rotation). Fill a whole row or column to clear it. Clear more at once — and on back-to-back moves — for exponential bonuses. It ends when the timer runs out or none of your pieces fit.",
  /* 目录条目(dsp_dsc_idx 指向此):home 渲染 L3 用。三档同名,靠 desc 区分时间 */
  blockfit830: { name: "Block Fit", desc: "Fill & clear · 30s dash" },
  blockfit890: { name: "Block Fit", desc: "Fill & clear · 90s" },
  blockfit8inf: { name: "Block Fit", desc: "Fill & clear · endless" }
});
window.I18N.zh = Object.assign(window.I18N.zh || {}, {
  bf_timeup: "时间到!",
  bf_over: "放不下了!",
  bf_rules: "把三块都摆到 8×8 棋盘上(不可旋转)。填满整行或整列即消除。一步多消、连续消(连消)有指数加成。时间耗尽或手上的块都放不下即结束。",
  blockfit830: { name: "方块填格", desc: "填格消行 · 30 秒冲刺" },
  blockfit890: { name: "方块填格", desc: "填格消行 · 90 秒" },
  blockfit8inf: { name: "方块填格", desc: "填格消行 · 无限" }
});
