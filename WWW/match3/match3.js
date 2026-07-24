/* FairPlay — match3 游戏(通用三消:今天谁洗碗)。
   凭邀请码进:?g=<id> 定游戏(查注册表拿 board/durs),?p=<code> 经 FairPack.decodeSeed 解出 {seed, durIdx}。
   seed → 确定性 PRNG(FairPack.rng)→ 洗一袋均衡颜色、发完再洗 = 无限均匀色流(同 seed 同局,跨端逐位一致)。
   倒计时时长 = durs[durIdx](30/60s)→ 到点显示成绩 → 分享。 */
(function () {
  var DISHES = ["", "🍽️", "🥣", "☕", "🍵", "🍴", "🥄"]; // 1..6(餐具:盘/碗/杯/茶/叉勺/勺)
  var COLORS = 6;
  var L = (window.FairPlay && FairPlay.L()) || (window.I18N && window.I18N.en) || {};

  /* ---- 凭邀请码进 + 查注册表 + 时长(统一入口 FairPlay.enterGame)---- */
  var G = FairPlay.enterGame(); if (!G) return;
  var node = G.node;
  var SIZE = (node && node.board) || 8;
  var DURATION = G.limit * 1000;

  /* ---- 确定性色流:PRNG 洗一袋(每色 COLORS 个)→ 发完再洗 = 无限均匀,跨端同流 ---- */
  var rng = FairPack.rng(G.seed);
  function makeStream() {
    var bag = [], idx = 0;
    function refill() {
      bag = [];
      for (var v = 1; v <= COLORS; v++) for (var k = 0; k < COLORS; k++) bag.push(v);
      rng.shuffle(bag); idx = 0;
    }
    refill();
    return function next() { if (idx >= bag.length) refill(); return bag[idx++]; };
  }
  var stream = makeStream();

  /* ---- 棋盘 ---- */
  var board = new Array(SIZE * SIZE);
  for (var k = 0; k < SIZE * SIZE; k++) board[k] = stream();
  function at(r, c) { return board[r * SIZE + c]; }
  function swapCells(r1, c1, r2, c2) {
    var i = r1 * SIZE + c1, j = r2 * SIZE + c2, t = board[i]; board[i] = board[j]; board[j] = t;
  }

  function findMatches() {
    var mark = {};
    for (var r = 0; r < SIZE; r++) {
      var run = 1;
      for (var c = 1; c <= SIZE; c++) {
        if (c < SIZE && at(r, c) === at(r, c - 1) && at(r, c) !== 0) run++;
        else { if (run >= 3) for (var x = c - run; x < c; x++) mark[r * SIZE + x] = 1; run = 1; }
      }
    }
    for (var c = 0; c < SIZE; c++) {
      var run = 1;
      for (var r = 1; r <= SIZE; r++) {
        if (r < SIZE && at(r, c) === at(r - 1, c) && at(r, c) !== 0) run++;
        else { if (run >= 3) for (var x = r - run; x < r; x++) mark[x * SIZE + c] = 1; run = 1; }
      }
    }
    return Object.keys(mark).map(Number);
  }

  function collapseAndRefill() {
    for (var c = 0; c < SIZE; c++) {
      var stack = [];
      for (var r = SIZE - 1; r >= 0; r--) { var v = at(r, c); if (v !== 0) stack.push(v); } // stack[0]=底
      for (var r = SIZE - 1, i = 0; r >= 0; r--, i++) board[r * SIZE + c] = (i < stack.length) ? stack[i] : stream();
    }
  }

  /* 分步消除(带动画):清除→渲染→塌落补充→渲染→再来。onDone(得分) */
  function stepResolve(scoring, onDone) {
    var step = 0, gained = 0;
    (function tick() {
      var m = findMatches();
      if (!m.length) { onDone(gained); return; }
      step++;
      for (var i = 0; i < m.length; i++) board[m[i]] = 0;
      if (scoring) gained += m.length * 10 * step;  // 连锁越深倍数越高
      render();
      setTimeout(function () { collapseAndRefill(); render(); setTimeout(tick, 110); }, 110);
    })();
  }

  /* ---- 渲染 ---- */
  var boardEl, cells = [];
  var selected = null, score = 0, busy = true, ended = false, started = false, ctl = null;

  function buildUI() {
    var stage = document.getElementById("match3_stage");
    stage.innerHTML = '<div id="match3_board"></div>';   // HUD/开始遮盖已移到控制栏/control.js
    boardEl = document.getElementById("match3_board");
    for (var k = 0; k < SIZE * SIZE; k++) {
      (function (k) {
        var d = document.createElement("div"); d.className = "cell";
        var r = Math.floor(k / SIZE), c = k % SIZE;
        d.addEventListener("click", function () { onCellTap(r, c); });
        boardEl.appendChild(d); cells.push(d);
      })(k);
    }
  }

  function render() {
    for (var k = 0; k < SIZE * SIZE; k++) {
      var v = board[k], r = Math.floor(k / SIZE), c = k % SIZE;
      cells[k].textContent = v ? DISHES[v] : "";
      cells[k].className = "cell" + (v ? " c" + v : "") +
        ((selected && selected.r === r && selected.c === c) ? " sel" : "");
    }
    if (ctl) ctl.setScore(score);   // 成绩写入 control(显示/对抗由 control 时钟统一驱动)
  }

  /* ---- 输入 ---- */
  function onCellTap(r, c) {
    if (busy || ended) return;
    if (!selected) { selected = { r: r, c: c }; render(); return; }
    if (selected.r === r && selected.c === c) { selected = null; render(); return; }
    if (Math.abs(selected.r - r) + Math.abs(selected.c - c) === 1) {
      var a = selected; selected = null; trySwap(a.r, a.c, r, c);
    } else { selected = { r: r, c: c }; render(); }
  }

  function trySwap(r1, c1, r2, c2) {
    busy = true;
    swapCells(r1, c1, r2, c2); render();
    if (!findMatches().length) {                 // 无效:换回
      setTimeout(function () { swapCells(r1, c1, r2, c2); render(); busy = false; }, 160);
      return;
    }
    setTimeout(function () {
      stepResolve(true, function (g) { score += g; render(); busy = false; });
    }, 120);
  }

  /* ---- 控制栏接线(时钟/显示/超时/开始暂停/结束由 control 统一;倒计 30s → onTimeout)---- */
  function onRun() {                     // ▶:首次揭盘 + 开局自动消;恢复只放开输入(棋盘/时钟由 control 管)
    if (!started) {
      started = true; render();
      boardEl.classList.add("dropin");
      setTimeout(function () { boardEl.classList.remove("dropin"); }, 400);
      stepResolve(false, function () { busy = false; });
    } else { busy = false; }
  }
  function onPause() { busy = true; selected = null; }   // ⏸/焦点丢失:屏蔽输入(棋盘已被 cover 遮盖)

  function finish() {                    // 超时 → 结束:禁用按钮 + stage 级分享结果
    if (ended) return; ended = true;
    busy = true; selected = null; render();
    ctl.end("timeout", { title: L.m3_timeup || "Time's up!", gameName: FairPlay.gameName(node), score: score });
  }

  function boot() {
    buildUI();   // 空盘;busy=true。棋盘揭示/时钟/开始 均由 control 驱动
    ctl = window.FairPlay.control.init({
      stage: "#match3_stage",
      rules: L.m3_rules || "Swap adjacent fruits to line up 3 or more. Chains score higher. Clear as much as you can before time runs out.",
      onRun: onRun, onPause: onPause
    });
    ctl.setTimer({ mode: "down", duration: DURATION, onTimeout: finish });   // 倒计 30s,超时 finish
    ctl.setScore(score);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
