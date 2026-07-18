/* FairPlay — match3 专属语言包。本文件装该页全部语种(每语种一个 I18N.<lang> 块)。
   通用置顶栏文本来自上级 ../index.lang.js(游戏页先加载它,再加载本文件)。 */
window.I18N = window.I18N || {};
window.I18N.en = Object.assign(window.I18N.en || {}, {
  m3_timeup: "Time's up!",
  m3_rules: "Swap two adjacent dishes to line up 3 or more of a kind — they clear and score. Longer chains score more. Clear as much as you can before the timer runs out.",
  /* 目录条目(i18n 键 = 注册表 key):home 渲染用。name = 显示名唯一来源;时长由按钮/角标表达,不进文案 */
  match3: { name: "Dish Duty", desc: "Clear the board" }
});
window.I18N.zh = Object.assign(window.I18N.zh || {}, {
  m3_timeup: "时间到!",
  m3_rules: "交换相邻的两个碗碟,凑成 3 个及以上同款即可消除得分;连锁越长分越高。在时间用完前尽量多消。",
  match3: { name: "今天谁洗碗", desc: "清空棋盘" }
});
