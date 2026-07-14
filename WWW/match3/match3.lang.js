/* FairPlay — match3 专属语言包。本文件装该页全部语种(每语种一个 I18N.<lang> 块)。
   通用置顶栏文本来自上级 ../index.lang.js(游戏页先加载它,再加载本文件)。 */
window.I18N = window.I18N || {};
window.I18N.en = Object.assign(window.I18N.en || {}, {
  score: "Score",
  m3_start: "Start",
  m3_timeup: "Time's up!",
  m3_share_btn: "Share result",
  m3_share: "{nick} scored {score} in #{code}"
});
window.I18N.zh = Object.assign(window.I18N.zh || {}, {
  score: "分数",
  m3_start: "开始",
  m3_timeup: "时间到!",
  m3_share_btn: "分享成绩",
  m3_share: "{nick} 在 #{code} 得了 {score} 分"
});
