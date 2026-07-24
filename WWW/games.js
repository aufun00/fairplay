/* 游戏目录(home 据此生成)。通用 typed 树:每个节点 node_type = "dir"(分类,可下钻)
   或 "game"(叶子游戏)。面包屑/浏览按 node_type 自适应,层级随意挂;当前全挂根(平铺)。
   game 节点字段(其余按约定推导,不重复存):
     key   项目名 → dir=key+"/"、html=dir+key+".html"、lang=dir+key+".lang.js"
     id    稳定唯一,邀请码 ?g=<id> 用;只增不改不复用
     icon  sprite 图标 id(<use href="#ic_<icon>">)
     board 棋盘尺寸(游戏内在参数)
     durs  可选时长(秒)数组;首页每档一个按钮/角标,选中的 durIdx 打进邀请码 ?p
   显示名/说明:i18n 键 = key(在该游戏 lang 里 { name, desc })。
   邀请码:?g=<id> 路由到游戏;?p=<code> 内含 (durIdx, seed),由 FairPack.decodeSeed 解。
   查表统一走 window.FairCatalog(见文件末)——递归、认 dir,别再各写平铺查找。 */
window.GAMES = [
  { node_type:"game", key:"match3",   id:1, icon:"match3",   board:8, durs:[30, 60] },
  { node_type:"game", key:"blockfit", id:4, icon:"blockfit", board:8, durs:[30, 60] },
  { node_type:"game", key:"runner",   id:5, icon:"runner",   board:3, durs:[30, 60] },
  { node_type:"game", key:"2048",     id:6, icon:"2048",     board:5, durs:[30, 60] },
];

/* ---- 目录查询 API(唯一实现,全站共用:游戏页 ?g 查自己、首页扁平渲染、路由器分发)。
   typed 树递归:game = 叶子(node_type==="game" 或带 id);dir = 分类,子节点在 children/subs/games。
   当前全挂根(平铺),但 find/collect 递归,故日后加 dir 分类无需改任何调用方。 ---- */
window.FairCatalog = (function () {
  var TREE = window.GAMES || [];
  function isGame(node) { return !!(node && (node.node_type === "game" || node.id != null)); }
  function childrenOf(node) { return node ? (node.children || node.subs || node.games || []) : TREE; }
  /* 递归收集全部 game 叶子(供扁平渲染 / 按 id 查找);root 省略 = 整棵树 */
  function collect(root, out) {
    out = out || [];
    (root || TREE).forEach(function (n) {
      if (isGame(n)) out.push(n);
      else childrenOf(n).forEach(function (c) { collect([c], out); });
    });
    return out;
  }
  /* 按 id 查 game 叶子;找不到 → null。id 非数字(NaN)也安全落空 */
  function find(id, root) {
    var gs = collect(root || TREE, []);
    for (var i = 0; i < gs.length; i++) if (gs[i].id === id) return gs[i];
    return null;
  }
  return { tree: TREE, isGame: isGame, childrenOf: childrenOf, collect: collect, find: find };
})();
