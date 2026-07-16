/* FairPlay — match3 专属语言包。本文件装该页全部语种(每语种一个 I18N.<lang> 块)。
   通用置顶栏文本来自上级 ../index.lang.js(游戏页先加载它,再加载本文件)。 */
window.I18N = window.I18N || {};
window.I18N.en = Object.assign(window.I18N.en || {}, {
  game_name: "Match-3",           /* 成绩分享 {game} 用;score/game_share* 在 ../index.lang.js 共享 */
  m3_timeup: "Time's up!",
  m3_rules: "Swap two adjacent fruits to line up 3 or more of a kind — they clear and score. Longer chains score more. Clear as much as you can before the timer runs out.",
  /* 目录条目(inf):home 渲染 L3 用 */
  match3x86: { name: "Match-3", desc: "Clear the board" }
});
window.I18N.zh = Object.assign(window.I18N.zh || {}, {
  game_name: "三消",
  m3_timeup: "时间到!",
  m3_rules: "交换相邻的两个水果,凑成 3 个及以上同色即可消除得分;连锁越长分越高。在时间用完前尽量多消。",
  match3x86: { name: "三消", desc: "清空棋盘" }
});
