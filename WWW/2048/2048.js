/* FairPlay — 2048(合并)。凭邀请码进:?g 定游戏 / durs,?p 解出 {seed,durIdx}。
   出块由 seed 派生的整数 PRNG 确定性生成(开局 startTiles 块 + 每次有效移动后 1 块,全走同一条 rng 流)
   → 同 seed + 同一串操作 = 各端完全相同的一局,纯比技术。限时倒计时;满盘无路 = 卡死。
   计分:每次有效移动 += 本次合并值之和 × 剩余时间系数(越早合越值钱)。
   渲染:背景空格层 + 绝对定位 tile 层(transform 滑动动画),纯显示层,不碰公平序列。 */
(function () {
  /* ============ 可调参数:直接改这里(本地 Ctrl-F5 硬刷即可)============ */
  var CFG = {
    board:      5,      // 棋盘 N×N(自适应渲染;休闲些用 5,越小越挤越快卡死)
    startTiles: 2,      // 开局初始块数
    spawnFour:  0.1,    // 新块为 4 的概率(否则 2)
    scoreCoef:  .5,     // 计分系数:每步得分 = 合并值 × (剩余 0.1s 数 × 此)。越大分越高、越早合越值钱
    swipeMinPx: 24      // 触屏滑动判定的最小位移(px);小于此 = 点选(浮现方向箭头)
  };
  var ANIM_MS = 120, PAD = 7, GAP = 7;   // 动画时长(与 CSS transition 对齐)/ 棋盘内边距 / 格间距

  /* ---- 凭邀请码进 + 查注册表 + 时长(统一入口 FairPlay.enterGame)---- */
  var G = FairPlay.enterGame(); if (!G) return;
  var node = G.node;
  var LIMIT = G.limit;

  var N = CFG.board;
  var rng = FairPack.rng(G.seed);

  /* ---- 状态 ---- */
  var tiles = [];                        // { val, r, c, el, 及临时标记 targetCell/absorbed/mergedThisMove }
  var cellMap = new Array(N * N);        // 格号 → 当前该格的 tile(或 undefined)
  var score = 0, ended = false, stuck = false, busy = false, ctl = null;
  var boardEl, tilesEl, dpad, cell = 0, step = 0;

  /* ---- 四向「行」索引(travel 序,目标边在前),棋盘固定,预算一次 ---- */
  var LINES = (function () {
    var Ls = { left: [], right: [], up: [], down: [] };
    for (var a = 0; a < N; a++) {
      var l = [], r = [], u = [], d = [];
      for (var b = 0; b < N; b++) { l.push(a * N + b); r.push(a * N + (N - 1 - b)); u.push(b * N + a); d.push((N - 1 - b) * N + a); }
      Ls.left.push(l); Ls.right.push(r); Ls.up.push(u); Ls.down.push(d);
    }
    return Ls;
  })();

  function rebuildCellMap() { cellMap = new Array(N * N); for (var i = 0; i < tiles.length; i++) cellMap[tiles[i].r * N + tiles[i].c] = tiles[i]; }
  function canMoveAny() {
    for (var i = 0; i < N * N; i++) if (!cellMap[i]) return true;
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var v = cellMap[r * N + c].val;
      if (c + 1 < N && cellMap[r * N + c + 1].val === v) return true;
      if (r + 1 < N && cellMap[(r + 1) * N + c].val === v) return true;
    }
    return false;
  }

  /* ---- 显示:≥1024 用 K/M/G/T(值恒为 2 的幂,除 1024 后仍为整数)---- */
  function fmt(v) { if (v < 1024) return "" + v; var u = ["K", "M", "G", "T"], i = -1; while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; } return v + u[i]; }
  var COLORS = {
    2: "#eee4da", 4: "#ede0c8", 8: "#f2b179", 16: "#f59563", 32: "#f67c5f", 64: "#f65e3b",
    128: "#edcf72", 256: "#edcc61", 512: "#edc850", 1024: "#edc53f", 2048: "#edc22e"
  };
  function paintTile(t) { t.el.textContent = fmt(t.val); t.el.style.background = COLORS[t.val] || "#3c3a32"; t.el.style.color = t.val <= 4 ? "#776e65" : "#f9f6f2"; }

  /* ---- 布局(px):从棋盘实际宽度算格子大小;animate=false 时不走过渡(创建/resize)---- */
  function layout() { var inner = boardEl.clientWidth - 2 * PAD; cell = (inner - (N - 1) * GAP) / N; step = cell + GAP; for (var i = 0; i < tiles.length; i++) positionTile(tiles[i], false); }
  function positionTile(t, animate) {
    var el = t.el;
    if (!animate) el.style.transition = "none";
    el.style.width = cell + "px"; el.style.height = cell + "px"; el.style.fontSize = (cell * 0.36) + "px";
    el.style.transform = "translate(" + (t.c * step) + "px," + (t.r * step) + "px)";
    if (!animate) { el.getBoundingClientRect(); el.style.transition = ""; }   // 强制重排后恢复过渡,避免从原点滑入
  }
  function makeTile(val, ci) {
    var t = { val: val, r: Math.floor(ci / N), c: ci % N, el: document.createElement("div") };
    t.el.className = "tile"; tilesEl.appendChild(t.el);
    paintTile(t); positionTile(t, false); tiles.push(t); return t;
  }

  /* ---- 种子化出块:空格里第几个 + 值(2/4),全取自共享 rng ---- */
  function spawn() {
    var empties = []; for (var i = 0; i < N * N; i++) if (!cellMap[i]) empties.push(i);
    if (!empties.length) return;
    var ci = empties[rng.int(empties.length)];
    var val = (rng.int(1000) < Math.round(CFG.spawnFour * 1000)) ? 4 : 2;
    var t = makeTile(val, ci);
    t.el.classList.add("new"); t.el.classList.add("spawn");
    (function (el) { setTimeout(function () { el.classList.remove("spawn"); }, ANIM_MS + 40); })(t.el);
  }

  function timeMul() { return ctl.remaining() * CFG.scoreCoef; }   // 剩余 0.1s 数 × scoreCoef(control 统一提供)

  function finish() {
    if (ended) return; ended = true;
    var LL = FairPlay.L();
    ctl.end(stuck ? "stuck" : "timeout", {
      title: (stuck ? LL.g2_stuck : LL.g2_timeup) || (stuck ? "No moves left!" : "Time's up!"),
      gameName: FairPlay.gameName(node), score: Math.floor(score)
    });
  }

  /* ---- 一步:算滑动+合并 → 有效则动画滑动,落定后移除被吞块/合并翻倍/出新块/判卡死 ---- */
  function move(dir) {
    if (busy || !ctl || ctl.phase() !== "running") return;
    for (var i = 0; i < tiles.length; i++) { var t = tiles[i]; t.el.classList.remove("new"); t.mergedThisMove = false; t.absorbed = false; t.targetCell = t.r * N + t.c; }
    var lines = LINES[dir], moved = false, gained = 0;
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li], lineTiles = [];
      for (var k = 0; k < line.length; k++) { var tt = cellMap[line[k]]; if (tt) lineTiles.push(tt); }
      var slot = 0, last = null;
      for (var m = 0; m < lineTiles.length; m++) {
        var cur = lineTiles[m];
        if (last && !last.mergedThisMove && last.val === cur.val) {          // 合并到 last
          cur.targetCell = last.targetCell; cur.absorbed = true;
          last.val *= 2; last.mergedThisMove = true; gained += last.val; moved = true;
        } else {
          cur.targetCell = line[slot];
          if (cur.targetCell !== cur.r * N + cur.c) moved = true;
          last = cur; slot++;
        }
      }
    }
    if (!moved) return;
    hideDpad(); busy = true;
    score += gained * timeMul(); ctl.setScore(score);
    for (var j = 0; j < tiles.length; j++) { var q2 = tiles[j]; q2.r = Math.floor(q2.targetCell / N); q2.c = q2.targetCell % N; positionTile(q2, true); }
    setTimeout(function () {
      var kept = [];
      for (var a = 0; a < tiles.length; a++) { var t2 = tiles[a]; if (t2.absorbed) { if (t2.el.parentNode) t2.el.parentNode.removeChild(t2.el); } else kept.push(t2); }
      tiles = kept;
      for (var b = 0; b < tiles.length; b++) if (tiles[b].mergedThisMove) { paintTile(tiles[b]); (function (el) { el.classList.add("merged"); setTimeout(function () { el.classList.remove("merged"); }, 180); })(tiles[b].el); }
      rebuildCellMap();
      spawn(); rebuildCellMap();
      if (!canMoveAny()) { stuck = true; busy = false; ctl.expire(); return; }
      busy = false;
    }, ANIM_MS);
  }

  /* ---- 输入:滑动(指针捕获,滑出棋盘松手也算)/ 点选浮现箭头 / 方向键 / 点箭头 ---- */
  function showDpad() { if (dpad) dpad.classList.add("show"); }
  function hideDpad() { if (dpad) dpad.classList.remove("show"); }
  document.addEventListener("keydown", function (e) {
    var d = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[e.key];
    if (d) { e.preventDefault(); hideDpad(); move(d); }
  });

  function buildUI() {
    var stage = document.getElementById("g2048_stage");
    boardEl = document.createElement("div"); boardEl.id = "g2048_board"; boardEl.style.setProperty("--n", N);
    var bg = document.createElement("div"); bg.className = "g2048-bg";
    for (var k = 0; k < N * N; k++) { var c = document.createElement("div"); c.className = "cell"; bg.appendChild(c); }
    tilesEl = document.createElement("div"); tilesEl.className = "g2048-tiles";
    dpad = document.createElement("div"); dpad.className = "g2048-dpad";
    var pad = document.createElement("div"); pad.className = "pad";
    var arrows = [["u", "▲", "up"], ["l", "◀", "left"], ["r", "▶", "right"], ["d", "▼", "down"]];
    arrows.forEach(function (a) {
      var el = document.createElement("div"); el.className = "ar " + a[0]; el.textContent = a[1];
      el.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      el.addEventListener("click", function (e) { e.stopPropagation(); hideDpad(); move(a[2]); });
      pad.appendChild(el);
    });
    dpad.appendChild(pad);
    boardEl.appendChild(bg); boardEl.appendChild(tilesEl); boardEl.appendChild(dpad);
    stage.appendChild(boardEl);

    var tsx = null, tsy = null;
    boardEl.addEventListener("pointerdown", function (e) { tsx = e.clientX; tsy = e.clientY; try { boardEl.setPointerCapture(e.pointerId); } catch (_) {} });
    boardEl.addEventListener("pointerup", function (e) {
      if (tsx == null) return; var dx = e.clientX - tsx, dy = e.clientY - tsy; tsx = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < CFG.swipeMinPx) { dpad.classList.toggle("show"); return; }   // 点选 → 切换箭头
      hideDpad();
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left"); else move(dy > 0 ? "down" : "up");
    });
    window.addEventListener("resize", layout);
  }

  function boot() {
    buildUI(); layout();
    for (var s = 0; s < CFG.startTiles; s++) spawn();                 // 开局块(种子决定)
    rebuildCellMap();
    for (var i = 0; i < tiles.length; i++) tiles[i].el.classList.remove("new");   // 起始块不标「新」
    ctl = window.FairPlay.control.init({
      stage: "#g2048_stage",
      rules: FairPlay.L().g2_rules || "Swipe (or arrow keys) to slide tiles; equal tiles merge. Merge as much as you can before time runs out — earlier merges score more.",
      onRun: function () { layout(); }, onPause: hideDpad
    });
    ctl.setTimer({ mode: "down", duration: LIMIT * 1000, onTimeout: finish });
    ctl.setScore(0);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
