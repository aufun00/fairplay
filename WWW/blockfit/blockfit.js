/* FairPlay — blockfit(方块填格):BOARD×BOARD 空盘,一次发 3 块(19 种、不旋转),摆满整行/整列即消。
   双结束:限时到点 or 手上 3 块全无处可放。计分见 resolveClears()。
   设计立意:base 方向 + 指数系数,平衡「布局流(憋大消/连消)」与「手速流(走量/抢时间)」。
   凭邀请码进:?g=<id> 定游戏(查注册表拿 board/durs),?p=<code> 经 FairPack.decodeSeed 解出 {seed, durIdx}。
   序列:seed → 确定性 PRNG(FairPack.rng)洗一袋 [1..19]、发完再洗 = 均匀 19-bag(同 seed 同题,跨端逐位一致)。 */
(function () {
  /* ---- 凭邀请码进 + 查注册表 + 时长(统一入口 FairPlay.enterGame)---- */
  var G = FairPlay.enterGame(); if (!G) return;
  var node = G.node;
  var BOARD = (node && node.board) || 8;
  var LIMIT = G.limit;                                  // 秒(30/60,均限时)

  /* ---- 19 种块(单元格偏移 [row,col]),不旋转 ---- */
  var PIECES = {
    1:[[0,0]],
    2:[[0,0],[0,1]], 3:[[0,0],[1,0]],
    4:[[0,0],[0,1],[0,2]], 5:[[0,0],[1,0],[2,0]],
    6:[[0,0],[0,1],[0,2],[0,3]], 7:[[0,0],[1,0],[2,0],[3,0]],
    8:[[0,0],[0,1],[0,2],[0,3],[0,4]], 9:[[0,0],[1,0],[2,0],[3,0],[4,0]],
    10:[[0,0],[0,1],[1,0],[1,1]],
    11:[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
    12:[[0,0],[1,0],[1,1]], 13:[[0,0],[0,1],[1,0]], 14:[[0,0],[0,1],[1,1]], 15:[[0,1],[1,0],[1,1]],
    16:[[0,0],[1,0],[2,0],[2,1],[2,2]], 17:[[0,0],[0,1],[0,2],[1,0],[2,0]],
    18:[[0,0],[0,1],[0,2],[1,2],[2,2]], 19:[[0,2],[1,2],[2,0],[2,1],[2,2]]
  };
  function colorFor(v) { return "hsl(" + ((v * 47) % 360) + " 62% 56%)"; }

  /* ---- 确定性 19-bag:PRNG 洗 [1..19]、发完再洗(每块每轮恰一次,均匀且跨端同序)---- */
  var rng = FairPack.rng(G.seed);
  var bag = [], bagIdx = 0;
  function refillBag() { bag = []; for (var v = 1; v <= 19; v++) bag.push(v); rng.shuffle(bag); bagIdx = 0; }
  function nextBlock() { if (bagIdx >= bag.length) refillBag(); return bag[bagIdx++]; }

  /* ---- 状态 ---- */
  var board = [];                                       // BOARD*BOARD,0=空,否则块 idx(用于上色)
  for (var z = 0; z < BOARD * BOARD; z++) board.push(0);
  var tray = [0, 0, 0];                                 // 当前 3 块(0=已放/空槽)
  var score = 0, combo = 0, ended = false;
  var ctl, cells = [], slots = [], boardEl = null, drag = null;

  function deal() { tray = [nextBlock(), nextBlock(), nextBlock()]; }

  /* ---- 放置合法性 ---- */
  function canPlace(pc, r, c) {
    for (var i = 0; i < pc.length; i++) {
      var rr = r + pc[i][0], cc = c + pc[i][1];
      if (rr < 0 || cc < 0 || rr >= BOARD || cc >= BOARD || board[rr*BOARD+cc]) return false;
    }
    return true;
  }
  function anyFits(pc) {
    for (var r = 0; r < BOARD; r++) for (var c = 0; c < BOARD; c++) if (canPlace(pc, r, c)) return true;
    return false;
  }

  /* ---- 消除 + 计分 ----
     每次消除得分 = base × 2^(lines-1) × 2^(combo-1)
       base = 剩余倒计时(剩余 ms/100,30s 峰值 300);lines = 该步同时消的行+列数;combo = 连消计数 */
  function timeBase() { return ctl.remaining(); }       // 剩余 0.1s 数(control 统一提供)
  function resolveClears() {
    var rows = [], cols = [], r, c, full;
    for (r = 0; r < BOARD; r++) { full = true; for (c = 0; c < BOARD; c++) if (!board[r*BOARD+c]) { full = false; break; } if (full) rows.push(r); }
    for (c = 0; c < BOARD; c++) { full = true; for (r = 0; r < BOARD; r++) if (!board[r*BOARD+c]) { full = false; break; } if (full) cols.push(c); }
    var lines = rows.length + cols.length;
    if (lines > 0) {
      rows.forEach(function (rr) { for (var cc = 0; cc < BOARD; cc++) board[rr*BOARD+cc] = 0; });
      cols.forEach(function (cc) { for (var rr = 0; rr < BOARD; rr++) board[rr*BOARD+cc] = 0; });
      combo++;
      score += timeBase() * Math.pow(2, lines - 1) * Math.pow(2, combo - 1);
    } else {
      combo = 0;
    }
    paintScore();
  }

  /* ---- 放一块 → 消除 → 补发/续判 ---- */
  function place(i, r, c) {
    var v = tray[i], pc = PIECES[v];
    for (var t = 0; t < pc.length; t++) board[(r + pc[t][0]) * BOARD + (c + pc[t][1])] = v;
    tray[i] = 0;
    resolveClears();
    if (tray[0] === 0 && tray[1] === 0 && tray[2] === 0) deal();   // 3 块放完 → 补发
    render();
    var rem = tray.filter(function (x) { return x > 0; });
    if (rem.length && rem.every(function (x) { return !anyFits(PIECES[x]); })) endGame("nofit");
  }

  /* ---- 交互:从托盘拖块到棋盘(虚影跟手 + 棋盘落点绿/红预览)---- */
  function pieceBounds(pc) { var mr = 0, mc = 0; pc.forEach(function (o) { if (o[0] > mr) mr = o[0]; if (o[1] > mc) mc = o[1]; }); return { rows: mr + 1, cols: mc + 1 }; }
  function startDrag(i, ev) {
    if (!ctl || ctl.phase() !== "running" || !tray[i] || drag) return;
    ev.preventDefault();
    var v = tray[i], pc = PIECES[v], b = pieceBounds(pc);
    var step = boardEl.getBoundingClientRect().width / BOARD, cell = Math.max(6, step - 2);
    var occ = {}; pc.forEach(function (o) { occ[o[0] * b.cols + o[1]] = 1; });
    var ghost = document.createElement("div"); ghost.className = "bf-ghost";
    ghost.style.gridTemplateColumns = "repeat(" + b.cols + "," + cell + "px)"; ghost.style.gridAutoRows = cell + "px";
    for (var r = 0; r < b.rows; r++) for (var c = 0; c < b.cols; c++) {
      var d = document.createElement("div");
      if (occ[r * b.cols + c]) { d.className = "gcell"; d.style.background = colorFor(v); }
      ghost.appendChild(d);
    }
    document.body.appendChild(ghost);
    drag = { i: i, v: v, ghost: ghost, brows: b.rows, bcols: b.cols, r: -99, c: -99, valid: false };
    document.addEventListener("pointermove", moveDrag);
    document.addEventListener("pointerup", endDrag);
    moveDrag(ev);
  }
  function moveDrag(ev) {
    if (!drag) return;
    var rect = boardEl.getBoundingClientRect(), step = rect.width / BOARD;
    var gl = ev.clientX - step * drag.bcols / 2;                 // 虚影水平居中于手指
    var gt = ev.clientY - step * drag.brows - step * 0.5;        // 底边离手指约半格 → 块浮在手指上方
    drag.ghost.style.left = gl + "px"; drag.ghost.style.top = gt + "px";
    drag.c = Math.round((gl - rect.left) / step);
    drag.r = Math.round((gt - rect.top) / step);
    drag.valid = canPlace(PIECES[drag.v], drag.r, drag.c);
    render();
  }
  function endDrag() {
    document.removeEventListener("pointermove", moveDrag);
    document.removeEventListener("pointerup", endDrag);
    var d = drag; drag = null;
    if (d && d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
    if (d && d.valid) place(d.i, d.r, d.c); else render();
  }
  function cancelDrag() {
    if (!drag) return;
    document.removeEventListener("pointermove", moveDrag);
    document.removeEventListener("pointerup", endDrag);
    if (drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
    drag = null;
  }

  /* ---- 渲染 ---- */
  function paintScore() { if (ctl) ctl.setScore(score); }   // 成绩写入 control(显示/对抗由 control 时钟统一驱动)
  function render() {
    var prev = {};                                   // 拖拽落点预览:该块真实落格 → 绿(合法)/红(非法)
    if (drag) {
      var pc = PIECES[drag.v];
      for (var t = 0; t < pc.length; t++) {
        var rr = drag.r + pc[t][0], cc = drag.c + pc[t][1];
        if (rr >= 0 && cc >= 0 && rr < BOARD && cc < BOARD) prev[rr * BOARD + cc] = drag.valid ? "gok" : "gbad";
      }
    }
    for (var k = 0; k < cells.length; k++) {
      var v = board[k], pv = prev[k], el = cells[k];
      el.className = "bc" + (v ? " fill" : "") + (pv ? " " + pv : "");
      el.style.background = pv ? (pv === "gok" ? "rgba(59,165,93,.38)" : "rgba(229,72,77,.38)") : "";   // 落盘灰底由 .bc.fill 给
    }
    for (var i = 0; i < 3; i++) renderSlot(i);
  }
  function renderSlot(i) {
    var s = slots[i]; s.innerHTML = "";
    var v = tray[i];
    if (!v || (drag && drag.i === i)) { s.classList.add("empty"); return; }   // 空槽 / 正被拖起的块 → 留空
    s.classList.remove("empty");
    var pc = PIECES[v], b = pieceBounds(pc), N = 5;                         // 固定 5×5 网格(5=最大块尺寸)→ 各块单元格大小一致
    var offR = Math.floor((N - b.rows) / 2), offC = Math.floor((N - b.cols) / 2);   // 块居中
    var occ = {}; pc.forEach(function (o) { occ[(o[0] + offR) * N + (o[1] + offC)] = 1; });
    var pg = document.createElement("div"); pg.className = "pg";
    pg.style.gridTemplateColumns = "repeat(" + N + ",1fr)";
    pg.style.gridTemplateRows = "repeat(" + N + ",1fr)";                    // 显式行高 → 单元格正方
    for (var k = 0; k < N * N; k++) {
      var d = document.createElement("div");
      if (occ[k]) { d.className = "pc"; d.style.background = colorFor(v); } else d.className = "pc e";
      pg.appendChild(d);
    }
    s.appendChild(pg);
  }

  /* ---- 结束(双条件都走这里)---- */
  function endGame(kind) {
    if (ended) return; ended = true;
    ctl.end(kind, {
      title: (kind === "timeout" ? FairPlay.L().bf_timeup : FairPlay.L().bf_over) || "Game over",
      gameName: FairPlay.gameName(node), score: score
    });
  }

  function onRun() { render(); }
  function onPause() { cancelDrag(); render(); }

  /* ---- 启动 ---- */
  function buildUI() {
    var stage = document.getElementById("blockfit_stage");
    boardEl = document.createElement("div"); boardEl.id = "bf_board";
    boardEl.style.gridTemplateColumns = "repeat(" + BOARD + ",1fr)";
    for (var k = 0; k < BOARD * BOARD; k++) {
      var el = document.createElement("div"); el.className = "bc"; boardEl.appendChild(el); cells.push(el);
    }
    var trayEl = document.createElement("div"); trayEl.id = "bf_tray";
    for (var i = 0; i < 3; i++) {
      var s = document.createElement("div"); s.className = "slot";
      (function (ii) { s.addEventListener("pointerdown", function (ev) { startDrag(ii, ev); }); })(i);
      trayEl.appendChild(s); slots.push(s);
    }
    stage.appendChild(boardEl); stage.appendChild(trayEl);
  }

  function boot() {
    buildUI();
    deal();
    ctl = window.FairPlay.control.init({
      stage: "#blockfit_stage",
      rules: FairPlay.L().bf_rules || "Place all three pieces. Fill a row or column to clear it.",
      onRun: onRun, onPause: onPause
    });
    ctl.setTimer({ mode: "down", duration: LIMIT * 1000, onTimeout: function () { endGame("timeout"); } });
    render(); paintScore();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
