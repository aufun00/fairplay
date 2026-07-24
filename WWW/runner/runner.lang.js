/* FairPlay — runner 专属语言包。通用置顶栏 + 成绩分享(score/game_share*)来自 ../index.lang.js。
   目录条目 i18n 键 = 注册表 key(runner)。name = 显示名唯一来源;时长由按钮/角标表达,不进文案。 */
window.I18N = window.I18N || {};
window.I18N.en = Object.assign(window.I18N.en || {}, {
  rn_crash: "Crashed!",
  rn_finish: "You made it!",
  rn_rules: "Swipe left/right (or use ← →) to switch lanes. Dodge the obstacles and grab coins. One hit — or a fall — ends your run, so get as far as you can before time runs out. Score = distance + coins.",
  runner: { name: "Runner", desc: "Dodge & dash" }
});
window.I18N.zh = Object.assign(window.I18N.zh || {}, {
  rn_crash: "撞毁!",
  rn_finish: "坚持到底!",
  rn_rules: "左右滑动(或按 ← →)换道。躲开障碍、捡起金币。撞到或掉落即结束,所以在时间耗尽前尽量跑远。得分 = 距离 + 金币。",
  runner: { name: "跑酷", desc: "躲闪冲刺" }
});
