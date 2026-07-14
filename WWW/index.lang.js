/* FairPlay — 主页语言包 + 通用置顶栏文本(全站共享,游戏页也加载本文件)。
   本文件装该页全部语种:每语种一个 I18N.<lang> 块,加语种就往下追加即可(无需改 HTML / SW)。 */
window.I18N = window.I18N || {};
window.I18N.en = Object.assign(window.I18N.en || {}, {
  /* 通用置顶栏(全站共享) */
  logo: "FairPlay",
  nickname: "Guest",
  exit: "Exit",
  lang: "Language",
  lang_short: "En",
  home: "Home",

  /* exit 确认弹窗(尽力清缓存/本地数据后关闭页面) */
  exit_title: "Exit & clear",
  exit_note: "FairPlay is anonymous and stores nothing about you. This clears all caches and local data your browser allows, then closes the page — leaving no trace. Opening it again may take a moment longer.",
  exit_confirm: "Confirm",
  exit_cancel: "Cancel",

  /* 昵称编辑弹窗(全站共享,游戏页也加载本文件) */
  nick_title: "Nickname",
  nick_ph: "Guest",
  nick_note: "Your nickname is included in the invite and result text you share, so it may appear on social platforms and be seen by others. Please keep it appropriate and follow each platform's rules.",
  nick_ack: "I understand my nickname may be shared publicly.",
  nick_save: "Save",
  nick_cancel: "Cancel",

  /* 主页 · history / recent */
  share_btn: "Share invite",
  qr_open: "↗ New tab",
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

window.I18N.zh = Object.assign(window.I18N.zh || {}, {
  /* 通用置顶栏 */
  logo: "FairPlay",
  nickname: "游客",
  exit: "退出",
  lang: "语言",
  lang_short: "中",
  home: "首页",

  /* exit 确认弹窗 */
  exit_title: "退出并清除",
  exit_note: "FairPlay 匿名、不保存任何关于你的信息。此操作会在浏览器允许的范围内尽量清除所有缓存与本地数据,然后关闭页面——不留痕迹。下次打开可能需要稍等片刻。",
  exit_confirm: "确认",
  exit_cancel: "取消",

  /* 昵称编辑弹窗 */
  nick_title: "昵称",
  nick_ph: "游客",
  nick_note: "你的昵称会包含在你分享的邀请和成绩文本里,因此可能出现在社交平台上、被他人看到。请使用得体的内容,并遵守各平台的规定。",
  nick_ack: "我知悉我的昵称可能被公开分享。",
  nick_save: "保存",
  nick_cancel: "取消",

  /* 主页 · history / recent */
  share_btn: "分享邀请",
  qr_open: "↗ 新标签",
  share_msg: "{nick} 邀请你来 {site} 玩 #{code}",
  share_empty: "请先选择或创建一个邀请",
  pick_empty: "还没有邀请",
  inv_created: "创建",
  memo_ph: "备注",
  sec_recent: "最近",
  ph_recent: "— 敬请期待 —",

  /* 主页 · 游戏说明 */
  game_match3_desc: "三消 · 清空棋盘",
  game_mathdoku_desc: "MathDoku · 逻辑方格",
  game_memory_desc: "记忆 · 配对翻牌",
});
