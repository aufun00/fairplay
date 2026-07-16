/* 游戏目录树(home 据此自动生成)。三层:L1 时长 → L2 类型 → 游戏(变体)。
   L1 时长:flash <1m / quick 1~5m / deep 5m+ / party 聚会
   L2 类型:puzzle 益智 / match 消除 / arcade 动作 / board 棋 / card 牌 / word 文字 / number 数字
   游戏字段(其余按约定推导,不重复存):
     key   项目名 → dir=key+"/"、html=dir+key+".html"、lang=dir+key+".lang.js"、codec=编解码表[key]
     id    稳定唯一,邀请码 ?g=<id> 用;只增不改不复用
     dsp_dsc_idx  在该游戏 lang 里查这条配置的 dsp(显示名)/dsc(说明)的键;
                  值是任意标签(如 match3x86),只作索引用,与 id / 尺寸无关
     cfg   配置串(大小/难度);启动 html?c=<cfg> 再 append p=<seed>;空=无配置
     icon  sprite 图标 id */
window.GAMES = [
  { key:"flash", icon:"flash", subs:[            // <1m
    { key:"puzzle", icon:"puzzle", games:[ {key:"blockfit", id:4, dsp_dsc_idx:"blockfit830", cfg:"8,30", icon:"blockfit30", resume:false} ] },
    { key:"match",  icon:"match",  games:[ {key:"match3", id:1, dsp_dsc_idx:"match3x86", cfg:"", icon:"match3"} ] },
    { key:"arcade", icon:"arcade", games:[] },
    { key:"board",  icon:"board",  games:[] },
    { key:"card",   icon:"card",   games:[] },
    { key:"word",   icon:"word",   games:[] },
    { key:"number", icon:"number", games:[] },
  ]},
  { key:"quick", icon:"quick", subs:[            // 1~5m
    { key:"puzzle", icon:"puzzle", games:[ {key:"mathdoku", id:2, dsp_dsc_idx:"mathdoku54", cfg:"5,4", icon:"mathdoku5"}, {key:"blockfit", id:5, dsp_dsc_idx:"blockfit890", cfg:"8,90", icon:"blockfit90", resume:true} ] },
    { key:"match",  icon:"match",  games:[ /* {key:"match3", id:11, dsp_dsc_idx:"match3x88", cfg:"8,8", icon:"match3"} */ ] },
    { key:"arcade", icon:"arcade", games:[] },
    { key:"board",  icon:"board",  games:[] },
    { key:"card",   icon:"card",   games:[ {key:"memory", id:3, dsp_dsc_idx:"memory6", icon:"memory"} ] },
    { key:"word",   icon:"word",   games:[] },
    { key:"number", icon:"number", games:[] },
  ]},
  { key:"deep", icon:"deep", subs:[              // 5m+
    { key:"puzzle", icon:"puzzle", games:[ {key:"mathdoku", id:21, dsp_dsc_idx:"mathdoku94", cfg:"9,4", icon:"mathdoku9"}, {key:"blockfit", id:6, dsp_dsc_idx:"blockfit8inf", cfg:"8,0", icon:"blockfitinf", resume:true} ] },
    { key:"match", icon:"match", games:[] },
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
