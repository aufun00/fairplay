/* FairPlay — 游戏注册表(路由 + 主页矩阵共用的唯一来源)
   GameID 数字键:1=match3, 2=mathdoku
   entry:相对 WWW 根的入口页;cat/type/icon 供主页分类与展示 */
window.FAIRPLAY_GAMES = Object.assign(window.FAIRPLAY_GAMES || {}, {
  1: { id:1, slug:"match3",   entry:"match3/match3.html",     icon:"🍬", cat:"⚡", type:"📱", descKey:"game_match3_desc" },
  2: { id:2, slug:"mathdoku", entry:"mathdoku/mathdoku.html", icon:"🔢", cat:"🧠", type:"🃏", descKey:"game_mathdoku_desc" },
});
