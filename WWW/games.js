/* 游戏目录(home 据此生成)。通用 typed 树:每个节点 node_type = "dir"(分类,可下钻)
   或 "game"(叶子游戏)。面包屑/浏览按 node_type 自适应,层级随意挂;当前全挂根(平铺)。
   game 节点字段(其余按约定推导,不重复存):
     key   项目名 → dir=key+"/"、html=dir+key+".html"、lang=dir+key+".lang.js"
     id    稳定唯一,邀请码 ?g=<id> 用;只增不改不复用
     icon  sprite 图标 id(<use href="#ic_<icon>">)
     board 棋盘尺寸(游戏内在参数)
     durs  可选时长(秒)数组;首页每档一个按钮/角标,选中的 durIdx 打进邀请码 ?p
   显示名/说明:i18n 键 = key(在该游戏 lang 里 { name, desc })。
   邀请码:?g=<id> 路由到游戏;?p=<code> 内含 (durIdx, seed),由 FairPack.decodeSeed 解。 */
window.GAMES = [
  { node_type:"game", key:"match3",   id:1, icon:"match3",   board:8, durs:[30, 60] },
  { node_type:"game", key:"blockfit", id:4, icon:"blockfit", board:8, durs:[30, 60] },
];
