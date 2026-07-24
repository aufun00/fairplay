/* FairPlay — Snake 专属语言包。通用置顶栏 + 成绩分享(score/game_share*)来自 ../index.lang.js。
   目录条目 i18n 键 = 注册表 key(snake)。name = 显示名唯一来源;时长由按钮/角标表达,不进文案。 */
window.I18N = window.I18N || {};
window.I18N.en = Object.assign(window.I18N.en || {}, {
  sn_dead: "Crashed!",
  sn_timeup: "Time's up!",
  sn_rules: "Swipe (or use arrow keys) to steer the snake. Eat food to grow and score — earlier bites are worth more, and you speed up as you eat. Everyone gets the same food sequence. Hitting a wall or yourself ends the run.",
  snake: { name: "Snake", desc: "Eat & grow" }
});
window.I18N.zh = Object.assign(window.I18N.zh || {}, {
  sn_dead: "撞死了!",
  sn_timeup: "时间到!",
  sn_rules: "滑动(或方向键)控制蛇。吃食物变长并得分——越早吃越高分,越吃越快。人人同一串食物。撞墙或撞到自己即结束。",
  snake: { name: "贪吃蛇", desc: "吃食变长" }
});
