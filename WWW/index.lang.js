/* FairPlay — 主页语言包 + 通用置顶栏文本(全站共享,游戏页也加载本文件)。
   本文件装该页全部语种:每语种一个 I18N.<lang> 块,加语种就往下追加即可(无需改 HTML / SW)。 */
window.I18N = window.I18N || {};
window.I18N.en = Object.assign(window.I18N.en || {}, {
  /* 通用置顶栏(全站共享) */
  logo: "FairPlay",
  nickname: "Guest",
  exit: "Exit",
  lang: "Language",
  home: "Home",

  /* 主页 · history / recent */
  share_btn: "Share invite",
  share_msg: "{nick} invites you to play on {site} #{code}",
  share_empty: "Pick or create an invite first",
  pick_empty: "No invites yet",
  inv_created: "created",
  memo_ph: "memo",
  sec_recent: "Recent",
  ph_recent: "— coming soon —",

  /* 主页 · 游戏说明(键名 = 注册表 descKey) */
  game_match3_desc: "Match-3 · clear the board",
  game_mathdoku_desc: "MathDoku · logic grid",
  game_memory_desc: "Memory · match the pairs",
});
