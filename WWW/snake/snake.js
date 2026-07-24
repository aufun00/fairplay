/* FairPlay — Snake(贪吃蛇,经典)。凭邀请码进(FairPlay.enterGame)。
   公平:食物位置由 seed 派生的整数 PRNG 从「当前空格」里选(1 次 draw / 每颗,永不落蛇身)→ 同 seed + 同走位 = 各端同一串食物。
   实时走格(tick 与渲染解耦,间隔=1/速度);撞墙/撞自己 = 死 → ctl.expire()(剩余归零,走超时同一出口)。
   计分:每吃一颗 += scoreMul ×(剩余 0.1s 数 × scoreCoef),越早吃越值钱。速度对象驱动(吃一颗加速),累积无上限 → 越吃越快直到撞死。 */
(function () {
  /* ============ 可调参数:直接改这里(本地 Ctrl-F5 硬刷即可)============ */
  var CFG = {
    board:      15,     // 棋盘 N×N(自适应渲染)
    baseSpeed:  6,      // 起步速度(格/秒)
    speedBase:  0.4,    // 加速基准(spdMul × 它,格/秒)
    scoreCoef:  1,      // 计分系数:每颗 += scoreMul ×(剩余 0.1s 数 × 此)
    startLen:   3,      // 开局蛇长
    edgeChance:  .5,    // 食物允许落在「边」(外圈非角)的概率;0=只内区,1=总允许
    cornerChance: 0,    // 食物允许落在「角」(四角)的概率;0=平时绝不出,只有别无空位才被迫出(角最难)
    swipeMinPx: 24      // 触屏滑动判定的最小位移(px)
  };
  /* 物件表(单食物;step=每走一格的钩子,默认关)。加分=scoreMul×(remaining×scoreCoef);加速=spdMul×speedBase */
  var TYPES = {
    step: { scoreMul: 0, spdMul: 0 },                                 // 每走一格(默认不加分不加速,留作时距/时间加速钩子)
    food: { scoreMul: 1, grow: 1, spdMul: 1, color: "#e0a63b" }       // 唯一食物:+分、长+1、加速
  };

  /* ---- 凭邀请码进 + 查注册表 + 时长(统一入口)---- */
  var G = FairPlay.enterGame(); if (!G) return;
  var node = G.node;
  var LIMIT = G.limit;                                  // 秒
  var N = CFG.board;
  var rng = FairPack.rng(G.seed);

  /* ---- 状态 ---- */
  var snake = [];                                       // 格号数组,snake[0]=头
  var dir = { dx: 1, dy: 0 }, nextDir = { dx: 1, dy: 0 };
  var food = -1, growth = 0, speed = CFG.baseSpeed, score = 0;
  var dead = false, ended = false, ctl = null;
  var boardEl, cells = [];

  function timeVal() { return ctl.remaining() * CFG.scoreCoef; }   // 剩余 0.1s 数 × 系数

  /* ---- 种子化出食物:空格按 内区/边/角 分类,掷 edge/corner 概率组池,再选(全走 rng、定序,永不落蛇身)---- */
  function spawnFood() {
    var occ = {}; for (var i = 0; i < snake.length; i++) occ[snake[i]] = 1;
    var interior = [], edge = [], corner = [];
    for (var k = 0; k < N * N; k++) {
      if (occ[k]) continue;
      var r = Math.floor(k / N), c = k % N, onEdge = (r === 0 || r === N - 1 || c === 0 || c === N - 1);
      if (!onEdge) interior.push(k);
      else if ((r === 0 || r === N - 1) && (c === 0 || c === N - 1)) corner.push(k);
      else edge.push(k);
    }
    var er = rng.int(1000), cr = rng.int(1000);          // 两掷:恒消耗、定序(边、角各一)
    var pool = interior.slice();
    if (er < CFG.edgeChance * 1000) pool = pool.concat(edge);
    if (cr < CFG.cornerChance * 1000) pool = pool.concat(corner);
    if (!pool.length) pool = interior.concat(edge);      // 退:内区+边
    if (!pool.length) pool = corner;                     // 非不得已才出角
    if (!pool.length) { food = -1; return; }             // 满盘(通关)
    food = pool[rng.int(pool.length)];
  }

  /* ---- 死亡 / 结束 ---- */
  function die() { if (ended) return; dead = true; ctl.expire(); }
  function finish() {
    if (ended) return; ended = true;
    var LL = FairPlay.L();
    ctl.end(dead ? "dead" : "timeout", {
      title: (dead ? LL.sn_dead : LL.sn_timeup) || (dead ? "Crashed!" : "Time's up!"),
      gameName: FairPlay.gameName(node), score: Math.floor(score)
    });
  }

  /* ---- 一步 ---- */
  function step() {
    dir = nextDir;                                       // 提交缓冲方向
    var head = snake[0], hr = Math.floor(head / N), hc = head % N;
    var nr = hr + dir.dy, nc = hc + dir.dx;
    if (nc < 0 || nc >= N || nr < 0 || nr >= N) { die(); return; }   // 撞墙
    var nh = nr * N + nc;
    var willGrow = (growth > 0) || (nh === food);
    for (var i = 0; i < snake.length; i++) {             // 撞自己(尾格本步空出,除非在长)
      if (i === snake.length - 1 && !willGrow) continue;
      if (snake[i] === nh) { die(); return; }
    }
    score += TYPES.step.scoreMul * timeVal(); speed += TYPES.step.spdMul * CFG.speedBase;   // 每格钩子
    snake.unshift(nh);
    if (nh === food) {
      var t = TYPES.food;
      score += t.scoreMul * timeVal(); speed += t.spdMul * CFG.speedBase; growth += t.grow;
      spawnFood();
    }
    if (growth > 0) growth--; else snake.pop();
    ctl.setScore(score);
    render();
  }

  /* ---- 方向:D-pad + 全屏 swipe + 方向键统一走公共控件 FairPlay.dirPad(boot 里挂)→ setDir。
     禁 180° 回头;倒计时期间也可预置方向 ---- */
  function setDir(dx, dy) {
    var ph = ctl && ctl.phase();
    if (ph !== "running" && ph !== "counting") return;
    if (dx === -nextDir.dx && dy === -nextDir.dy) return;   // 不许直接回头
    nextDir = { dx: dx, dy: dy };
  }

  /* ---- 渲染 ---- */
  function render() {
    for (var i = 0; i < cells.length; i++) { cells[i].className = "cell"; cells[i].style.background = ""; }
    if (food >= 0) { cells[food].className = "cell food"; cells[food].style.background = TYPES.food.color; }
    for (var j = 0; j < snake.length; j++) cells[snake[j]].className = "cell " + (j === 0 ? "head" : "body");
  }

  /* ---- 主循环:累加器,间隔=1/速度(与渲染解耦),phase 门控 ---- */
  var lastPerf = null, acc = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (ctl && ctl.phase() === "running") {
      var now = performance.now();
      if (lastPerf == null) lastPerf = now;
      acc += now - lastPerf; lastPerf = now;
      var interval = 1000 / speed, guard = 0;
      while (acc >= interval && !dead && ctl.phase() === "running" && guard < 4) {
        step(); acc -= interval; interval = 1000 / speed; guard++;
      }
    } else { lastPerf = null; }
  }

  /* ---- 启动 ---- */
  function buildUI() {
    var stage = document.getElementById("snake_stage");
    boardEl = document.createElement("div"); boardEl.id = "snake_board"; boardEl.style.setProperty("--n", N);
    for (var k = 0; k < N * N; k++) { var c = document.createElement("div"); c.className = "cell"; boardEl.appendChild(c); cells.push(c); }
    stage.appendChild(boardEl);
  }
  function initSnake() {
    var cr = Math.floor(N / 2); snake = [];
    for (var i = 0; i < CFG.startLen; i++) snake.push(cr * N + (cr - i));   // 头在正中,身向左
    dir = { dx: 1, dy: 0 }; nextDir = { dx: 1, dy: 0 };
    spawnFood();
  }
  function boot() {
    buildUI(); initSnake();
    ctl = window.FairPlay.control.init({
      stage: "#snake_stage", countdown: 3,
      rules: FairPlay.L().sn_rules || "Swipe (or arrow keys) to steer. Eat food to grow and score. Don't hit the walls or yourself.",
      onRun: render, onPause: function () {}
    });
    ctl.setTimer({ mode: "down", duration: LIMIT * 1000, onTimeout: finish });
    ctl.setScore(0);
    FairPlay.dirPad({ onDir: setDir, swipeMinPx: CFG.swipeMinPx });   // 方向输入:D-pad + 全屏 swipe + 方向键
    render(); frame();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
