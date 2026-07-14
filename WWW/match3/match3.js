/* FairPlay — match3 游戏(先走通流程的通用三消)
   种子来自 ?p=<param>(对手同题复现)或无参时现生成(自己开一局)。
   种子 6×6 → 确定性取流器(行列交换读)→ 铺满 8×8 + 掉落流(同种子=同一局)。
   30.0s 倒计时(performance.now,切后台停表)→ 到点显示成绩 → 分享。 */
(function () {
  var SIZE = 8, DURATION = 30000;
  var FRUITS = ["", "🍎", "🍊", "🍋", "🍇", "🍉", "🫐"]; // 1..6

  var codec = window.FAIRPLAY_CODECS && window.FAIRPLAY_CODECS.match3;
  var L = (window.FairPlay && FairPlay.L()) || (window.I18N && window.I18N.en) || {};

  /* ---- 取种子:gamepage 只能凭邀请码进。无 ?p / 校验不过 = 非正常流程 → 回主页 ---- */
  var p = new URLSearchParams(location.search).get("p");
  var dec = (p && codec) ? codec.decode(p) : null;
  if (!dec) { location.replace("../"); return; }
  var seedParam = p, seedGrid = dec.grid;

  /* ---- 确定性取流器:6×6 → 无限颜色流(每读 36 个换一次行列,配平保持)---- */
  function makeStream(seed) {
    var g = seed.slice(), seg = 0, idx = 0;
    function swapRows(a, b) { for (var c = 0; c < 6; c++) { var i = a * 6 + c, j = b * 6 + c, t = g[i]; g[i] = g[j]; g[j] = t; } }
    function swapCols(a, b) { for (var r = 0; r < 6; r++) { var i = r * 6 + a, j = r * 6 + b, t = g[i]; g[i] = g[j]; g[j] = t; } }
    function permute(s) {
      var a = s % 6, b = (s * 2 + 1) % 6; if (b === a) b = (b + 1) % 6;
      var c = (s * 3 + 2) % 6, d = (s + 4) % 6; if (d === c) d = (d + 1) % 6;
      swapRows(a, b); swapCols(c, d);
    }
    return function next() {
      if (idx === 36) { seg++; permute(seg); idx = 0; }
      return g[idx++];
    };
  }
  var stream = makeStream(seedGrid);

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
  var boardEl, clockEl, scoreEl, cells = [];
  var selected = null, score = 0, busy = true, ended = false;

  function buildUI() {
    var stage = document.getElementById("stage");
    stage.innerHTML =
      '<div id="hud"><div id="clock">30.0s</div><div id="score">0</div></div>' +
      '<div id="board"></div>' +
      '<div id="start" class="fp-overlay"><div class="fp-card">' +
        '<div class="rtitle">#' + seedParam.slice(-4) + '</div>' +
        '<button id="startbtn">' + (L.m3_start || "Start") + '</button>' +
      '</div></div>';
    boardEl = document.getElementById("board");
    clockEl = document.getElementById("clock");
    scoreEl = document.getElementById("score");
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
      cells[k].textContent = v ? FRUITS[v] : "";
      cells[k].className = "cell" + (v ? " c" + v : "") +
        ((selected && selected.r === r && selected.c === c) ? " sel" : "");
    }
    if (scoreEl) scoreEl.textContent = score;
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

  /* ---- 计时(净时钟:performance.now,切后台停表)---- */
  var startT = 0, pauseAt = 0, timerId = null;
  function startTimer() {
    startT = performance.now();
    timerId = setInterval(updateClock, 100);
    updateClock();
  }
  function updateClock() {
    if (document.hidden) return;
    var remain = Math.max(0, DURATION - (performance.now() - startT));
    clockEl.textContent = (remain / 1000).toFixed(1) + "s";
    if (remain <= 0) endGame();
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pauseAt = performance.now();
    else if (pauseAt) { startT += performance.now() - pauseAt; pauseAt = 0; }
  });

  /* ---- 结束 → 成绩 → 分享 ---- */
  function endGame() {
    if (ended) return; ended = true;
    clearInterval(timerId);
    busy = true; selected = null; render();
    clockEl.textContent = "0.0s";
    var line = (L.m3_share || "{nick} scored {score} in #{code}")
      .replace("{nick}", FairPlay.getNickname()).replace("{score}", score).replace("{code}", seedParam.slice(-4));
    window.FairPlay.showResult({
      title: L.m3_timeup || "Time's up!",
      score: score,
      scoreLabel: L.score || "Score",
      shareText: (L.logo || "FairPlay") + "\n" + line,   // 只发文本,不发链接
      shareLabel: L.m3_share_btn || "Share result",
      homeLabel: L.home || "Home",
      homeHref: "../"
    });
  }

  /* ---- 启动:先画空棋盘 + Start(不画棋子、不计时,防提前规划)---- */
  function boot() {
    buildUI();  // 棋盘为空;busy=true 屏蔽输入
    document.getElementById("startbtn").addEventListener("click", begin);
  }
  /* 点 Start → 揭示棋子(掉落动画)→ 开局自动消 → 计时+放开输入 */
  function begin() {
    var s = document.getElementById("start");
    if (s) s.hidden = true;
    render();
    boardEl.classList.add("dropin");
    setTimeout(function () { boardEl.classList.remove("dropin"); }, 400);
    stepResolve(false, function () { busy = false; startTimer(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
