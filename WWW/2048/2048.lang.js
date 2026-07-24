/* FairPlay — 2048 专属语言包。通用置顶栏 + 成绩分享(score/game_share*)来自 ../index.lang.js。
   目录条目 i18n 键 = 注册表 key(2048)。name = 显示名唯一来源;时长由按钮/角标表达,不进文案。 */
window.I18N = window.I18N || {};
window.I18N.en = Object.assign(window.I18N.en || {}, {
  g2_timeup: "Time's up!",
  g2_stuck: "No moves left!",
  g2_rules: "Swipe (or use arrow keys) to slide every tile; two equal tiles merge into one. Everyone plays the exact same board — merge as much as you can before time runs out, and earlier merges are worth more. It ends when the timer runs out or no move is left.",
  "2048": { name: "2048", desc: "Merge to 2048" }
});
window.I18N.zh = Object.assign(window.I18N.zh || {}, {
  g2_timeup: "时间到!",
  g2_stuck: "无处可动!",
  g2_rules: "滑动(或方向键)让所有方块移动,两个相同的合成一个。人人同一局——在时间耗尽前尽量多合,且越早合越高分。时间到或无路可动即结束。",
  "2048": { name: "2048", desc: "合成 2048" }
});
