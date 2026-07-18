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
  op_mode: "Home mode",
  op_new: "New",
  op_pro: "Pro",
  home: "Home",
  play: "Start",         /* topbar 游戏控件 ▶ 的 aria */
  pause: "Pause",        /* topbar 游戏控件 ⏸ 的 aria */

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
  share_msg: "{nick} invites you to play {game} # {code}",
  share_empty: "Pick or create an invite first",
  pick_empty: "No invites yet",
  inv_created: "created",
  memo_ph: "memo",

  /* 主页 · 引导式 onboarding(L0 选择屏 + ③ 面包屑) */
  onb_q: "Want to publish a challenge?",
  onb_existing: "Reshare an existing challenge",
  onb_recent: "Pick from recently played",
  onb_list: "Pick from the games list",
  onb_note1: "FairPlay stores nothing about you — no account, no sign-in, no tracking.",
  onb_note2: "Your nickname is only used to build the invite and result text you choose to share.",
  onb_note3: "Same invite, same puzzle — everyone plays fair and scores compare.",
  recent_empty: "No recent games yet",
  /* 分类文案(键 = games.js 的 key;L1 有 name/desc,L2 有 name) */
  cat: {
    flash: { name: "Flash", desc: "Quick challenges under a minute" },
    quick: { name: "Quick", desc: "A casual few-minute challenge" },
    deep:  { name: "Deep",  desc: "Longer, tougher challenges" },
    party: { name: "Party", desc: "Great for group play" },
    puzzle: { name: "Puzzle" }, match: { name: "Match" }, arcade: { name: "Arcade" },
    board: { name: "Board" }, card: { name: "Card" }, word: { name: "Word" }, number: { name: "Number" },
  },

  /* 游戏结束 · 成绩分享(全站共享,各游戏页复用;{game}=游戏显示名) */
  score: "Score",
  game_share_btn: "Share result",
  game_share: "{nick} scored {score} in {game} # {code}",
  /* 结果页三出口(control.js):留在游戏内传播 + 引流 */
  res_share_score: "Share my score",
  res_new_challenge: "Start my challenge",
  res_more_games: "See other games",

  /* 主页 · 游戏说明(键名 = 注册表 descKey) */
  game_match3_desc: "Match-3 · clear the board",
});

window.I18N.zh = Object.assign(window.I18N.zh || {}, {
  /* 通用置顶栏 */
  logo: "FairPlay",
  nickname: "游客",
  exit: "退出",
  lang: "语言",
  lang_short: "中",
  op_mode: "首页模式",
  op_new: "新",
  op_pro: "熟",
  home: "首页",
  play: "开始",
  pause: "暂停",

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
  share_msg: "{nick} 邀请你玩 {game} # {code}",
  share_empty: "请先选择或创建一个邀请",
  pick_empty: "还没有邀请",
  inv_created: "创建",
  memo_ph: "备注",

  /* 主页 · 引导式 onboarding(L0 选择屏 + ③ 面包屑) */
  onb_q: "你想发布一个挑战吗？",
  onb_existing: "发布一个已存在的挑战",
  onb_recent: "从最近玩过的游戏中选择",
  onb_list: "从游戏列表中选择",
  onb_note1: "FairPlay 不记录任何关于你的信息——无账号、无登录、无追踪。",
  onb_note2: "称呼只用来生成你要分享的邀请与成绩文本。",
  onb_note3: "同一个邀请 = 同一道题,人人公平、成绩可比。",
  recent_empty: "还没有玩过的游戏",
  /* 分类文案(键 = games.js 的 key;L1 有 name/desc,L2 有 name) */
  cat: {
    flash: { name: "闪玩", desc: "1 分钟以内的快速挑战" },
    quick: { name: "快玩", desc: "几分钟的一般挑战" },
    deep:  { name: "深玩", desc: "耗时较长的困难挑战" },
    party: { name: "聚会", desc: "适合聚会的游戏" },
    puzzle: { name: "益智" }, match: { name: "消除" }, arcade: { name: "动作" },
    board: { name: "棋类" }, card: { name: "牌类" }, word: { name: "文字" }, number: { name: "数字" },
  },

  /* 游戏结束 · 成绩分享(全站共享;{game}=游戏显示名) */
  score: "分数",
  game_share_btn: "分享成绩",
  game_share: "{nick} 得了 {score} 分 在 {game} # {code}",
  /* 结果页三出口(control.js):留在游戏内传播 + 引流 */
  res_share_score: "发布我的成绩",
  res_new_challenge: "发起我的挑战",
  res_more_games: "看看其它游戏",

  /* 主页 · 游戏说明 */
  game_match3_desc: "三消 · 清空棋盘",
});
