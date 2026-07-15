/* 游戏目录树(home 据此自动生成)。三层:L1 时长 → L2 类型 → 游戏(变体)。
   L1 时长:flash <1m / short 1~5m / deep 5m+ / party 聚会
   L2 类型:puzzle 益智 / match 消除 / arcade 动作 / board 棋 / card 牌 / word 文字 / number 数字
   游戏字段(其余按约定推导,不重复存):
     key   项目名 → dir=key+"/"、html=dir+key+".html"、lang=dir+key+".lang.js"、codec=编解码表[key]
     id    稳定唯一,邀请码 ?g=<id> 用;只增不改不复用
     inf   去该游戏 lang 查 display name / desc 的键
     cfg   配置串(大小/难度);启动 html?c=<cfg> 再 append p=<seed>;空=无配置
     icon  sprite 图标 id */
window.GAMES = [
  { key:"flash", icon:"flash", subs:[            // <1m
    { key:"puzzle", icon:"puzzle", games:[] },
    { key:"match",  icon:"match",  games:[ {key:"match3", id:1, inf:"match3x86", cfg:"", icon:"match3"} ] },
    { key:"arcade", icon:"arcade", games:[] },
    { key:"board",  icon:"board",  games:[] },
    { key:"card",   icon:"card",   games:[] },
    { key:"word",   icon:"word",   games:[] },
    { key:"number", icon:"number", games:[] },
  ]},
  { key:"short", icon:"short", subs:[            // 1~5m
    { key:"puzzle", icon:"puzzle", games:[ {key:"mathdoku", id:2, inf:"mathdoku5", cfg:"5", icon:"mathdoku"} ] },
    { key:"match",  icon:"match",  games:[ /* {key:"match3", id:11, inf:"match3x88", cfg:"8,8", icon:"match3"} */ ] },
    { key:"arcade", icon:"arcade", games:[] },
    { key:"board",  icon:"board",  games:[] },
    { key:"card",   icon:"card",   games:[ {key:"memory", id:3, inf:"memory6", icon:"memory"} ] },
    { key:"word",   icon:"word",   games:[] },
    { key:"number", icon:"number", games:[] },
  ]},
  { key:"deep", icon:"deep", subs:[              // 5m+
    { key:"puzzle", icon:"puzzle", games:[] }, { key:"match", icon:"match", games:[] },
    { key:"arcade", icon:"arcade", games:[] }, { key:"board", icon:"board", games:[] },
    { key:"card",   icon:"card",   games:[] }, { key:"word",  icon:"word",  games:[] },
    { key:"number", icon:"number", games:[] },
  ]},
  { key:"party", icon:"party", subs:[            // 聚会
    { key:"puzzle", icon:"puzzle", games:[] }, { key:"match", icon:"match", games:[] },
    { key:"arcade", icon:"arcade", games:[] }, { key:"board", icon:"board", games:[] },
    { key:"card",   icon:"card",   games:[] }, { key:"word",  icon:"word",  games:[] },
    { key:"number", icon:"number", games:[] },
  ]},
];
