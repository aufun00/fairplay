/* FairPlay — Stacker 专属语言包。通用置顶栏 + 成绩分享(score/game_share*)来自 ../index.lang.js。
   目录条目 i18n 键 = 注册表 key(stacker)。name = 显示名唯一来源。 */
window.I18N = window.I18N || {};
window.I18N.en = Object.assign(window.I18N.en || {}, {
  st_miss: "Missed!",
  st_timeup: "Time's up!",
  st_rules: "Tap anywhere to drop the block sliding above the tower. Whatever hangs over the edge is sliced off, so line it up to stay wide. Rare hollow shapes (frame, cross, corners) are worth far more the smaller they are. A total miss — or the timer — ends the run.",
  stacker: { name: "Stacker", desc: "Stack & align" }
});
window.I18N.zh = Object.assign(window.I18N.zh || {}, {
  st_miss: "没叠上!",
  st_timeup: "时间到!",
  st_rules: "点屏幕任意处,把在塔顶来回滑动的方块落下。伸出边缘的部分会被削掉,所以尽量对齐、别越叠越窄。稀有的镂空块(边框、十字、四角)越小越值钱。完全没叠上、或时间耗尽即结束。",
  stacker: { name: "叠塔", desc: "对齐堆叠" }
});
