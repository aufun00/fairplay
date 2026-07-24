/* FairPlay — runner(跑酷,2.5D)。凭邀请码进:?g 定游戏(board=车道数 / durs),?p 解出 {seed,durIdx}。
   赛道由 seed 派生的整数 PRNG 确定性生成(物件的车道/位置/稀有度,全走同一条 rng 流 → 同码逐段一致、跨端同题)。
   渲染由公共 p3d.js 负责(纯显示层,不碰公平序列)。限时倒计时;撞黄黑路障=死→ctl.expire()(剩余归零)。
   速度「对象驱动」:起步 baseSpeed,之后只被压到的物件加减(累积不衰减、无上限);计分/加速全在 TYPES 表里按金币基准成比例。 */
(function () {
  /* ============ 可调参数:手感 / 难度 / 计分 —— 直接改这里(本地 Ctrl-F5 硬刷即可,不用 bump)============ */
  var CFG = {
    // —— 速度(对象驱动、无上限:压到金币/加速带越多越快越难,直到撞死)——
    baseSpeed:    1600,   // 起步速度(世界单位/秒)
    minSpeed:     800,    // 速度下限(减速带压不到停)
    // —— 计分 / 加速基准(去金币化:各对象 = 倍数 × 基准)——
    scoreBase:    25,     // 加分基准(各对象 scoreMul × 它)
    speedBase:    80,    // 加速基准(各对象 spdMul × 它)
    // —— 赛道难度(seed 确定性生成)——
    startClear:   18,     // 开局无障碍空段数(越小越早遇险)
    gapMin:       8,      // 两处险之间最少空段
    gapRand:      11,     // 额外随机空段(实际间隔 = gapMin + 0..gapRand-1;越大越稀疏)
    coinTrailMin: 2,      // 金币串最短
    coinTrailRand:3,      // 金币串随机增量
    diamondRarity:10,     // 金币变钻石概率 = 1/该值
    boostEvery:   3,      // 约 1/该值 的险后出一条加速带
    slowEvery:    3,      // 约 1/该值 的险后出一条减速带
    // —— 操作手感 ——
    laneLerp:     0.25,   // 换道平滑(0~1,越大越快贴到目标道;1=瞬移)
    swipeMinPx:   24,     // 触屏判定为「滑动换道」的最小水平位移(px)
    // —— 场景视觉(伪 3D)——
    fovDeg:       100,    // 视野角(越大越广、透视越夸张)
    cameraHeight: 1000,   // 相机高度
    drawDistance: 150,    // 可见段数(越大看得越远,略耗性能)
    segmentLength:200,    // 每段长度(世界单位)
    roadWidth:    1000    // 路面半宽
  };

  /* ============ 赛道物件表:加分 = scoreMul×scoreBase;加速 = spdMul×speedBase;lethal=撞到即死。
     加新物件 = 加一行 + 一个 draw 函数(见下方)。改数或加类型都不用动主逻辑。============ */
  var TYPES = {
    segment: { lethal: false, scoreMul: 1,  spdMul: .1                    }, // 每越过一段:无关车道、不绘制(spdMul=0 可关掉距离被动加速)
    coin:    { lethal: false, scoreMul: 1,  spdMul: 1,  draw: drawCoin    }, // 吃到:+1 分单位、+1 速度单位(基准)
    diamond: { lethal: false, scoreMul: 10, spdMul: 1,  draw: drawDiamond }, // 稀有(金币的 1/diamondRarity):10×分、1×速
    block:   { lethal: true,  scoreMul: 2,  spdMul: 0,  draw: drawBlock   }, // 黄黑路障:撞=死;躲过 +2 分单位
    slow:    { lethal: false, scoreMul: 0,  spdMul: -8, draw: drawSlow    }, // 减速带:-8 速度单位
    boost:   { lethal: false, scoreMul: 3,  spdMul: 6,  draw: drawBoost   }  // 加速带:+3 分单位、+6 速度单位
  };

  /* ---- 凭邀请码进 ---- */
  var q = new URLSearchParams(location.search);
  var dec = FairPlay.requireSeed(q.get("p"));
  if (!dec) return;
  var node = FairCatalog.find(parseInt(q.get("g"), 10));
  var LANES = (node && node.board) || 3;
  var durs = (node && node.durs) || [30];
  var LIMIT = durs[dec.durIdx] || durs[0];
  function L() { return (window.FairPlay && FairPlay.L()) || {}; }
  function gameName() { var LL = L(); return (LL.runner && LL.runner.name) || "runner"; }

  /* ---- 伪 3D 场景 ---- */
  var SEG = CFG.segmentLength, ROADW = CFG.roadWidth, CAMH = CFG.cameraHeight;
  var canvas = document.getElementById("rn_canvas");
  var road = P3D.create(canvas, {
    roadWidth: ROADW, segmentLength: SEG, cameraHeight: CAMH,
    drawDistance: CFG.drawDistance, lanes: LANES, fovDeg: CFG.fovDeg
  });
  var PLAYER_DZ = CAMH * (1 / Math.tan((CFG.fovDeg * Math.PI / 180) / 2));   // 玩家离相机深度 → 定屏底
  function lhw(s) { return s.w / LANES; }                                    // 该深度下「一车道」屏幕半宽
  window.addEventListener("resize", function () { road.resize(); draw(); });

  /* ---- 确定性赛道:全部随机取自同一条 rng 流(同码逐段一致)---- */
  var rng = FairPack.rng(dec.seed);
  var TRACK_LEN = 6000;
  var TRACK = [];
  for (var z = 0; z < TRACK_LEN; z++) TRACK.push({ items: [] });
  function laneFree(seg, ln) {
    var its = TRACK[seg].items;
    for (var k = 0; k < its.length; k++) if (its[k].lane === ln) return false;
    return true;
  }
  (function genTrack() {
    var i = CFG.startClear;
    while (i < TRACK_LEN) {
      i += CFG.gapMin + rng.int(CFG.gapRand);
      if (i >= TRACK_LEN) break;
      var order = []; for (var l = 0; l < LANES; l++) order.push(l);
      rng.shuffle(order);
      var block = 1 + rng.int(LANES - 1);                          // 封 1..LANES-1 道,必留 ≥1 空
      for (var b = 0; b < block; b++) TRACK[i].items.push({ lane: order[b], type: "block" });
      var freeLane = order[LANES - 1];                             // 洗后末位 = 必不封的空道
      var trail = CFG.coinTrailMin + rng.int(CFG.coinTrailRand);   // 空道上一串金币(险之前),1/N 变钻石
      for (var t = 1; t <= trail; t++) {
        var ci = i - 3 - t;
        if (ci > CFG.startClear && laneFree(ci, freeLane))
          TRACK[ci].items.push({ lane: freeLane, type: (rng.int(CFG.diamondRarity) === 0) ? "diamond" : "coin" });
      }
      if (rng.int(CFG.boostEvery) === 0) {                         // 偶发加速带(险之后随机车道)
        var bl = rng.int(LANES), bi = i + 3 + rng.int(4);
        if (bi < TRACK_LEN && laneFree(bi, bl)) TRACK[bi].items.push({ lane: bl, type: "boost" });
      }
      if (rng.int(CFG.slowEvery) === 0) {                          // 偶发减速带
        var sl = rng.int(LANES), si = i + 3 + rng.int(4);
        if (si < TRACK_LEN && laneFree(si, sl)) TRACK[si].items.push({ lane: sl, type: "slow" });
      }
    }
  })();

  /* ---- 状态 ---- */
  var lane = Math.floor(LANES / 2);
  var playerX = road.laneX(lane);
  var cameraZ = 0, lastSeg = -1, bonus = 0, score = 0;
  var speed = CFG.baseSpeed, lastPerf = null;                      // 速度=累积状态量;dt 基准
  var crashed = false, ended = false, ctl = null;

  /* ---- 结束 ---- */
  function finish() {
    if (ended) return; ended = true;
    var LL = L();
    ctl.end(crashed ? "crash" : "timeout", {
      title: (crashed ? LL.rn_crash : LL.rn_finish) || (crashed ? "Crashed!" : "You made it!"),
      gameName: gameName(), score: score
    });
  }
  function crash() { if (ended) return; crashed = true; ctl.expire(); }

  /* ---- 到达某段:先判死,再结算奖励/速度效果 ---- */
  function processSeg(s) {
    var seg = TYPES.segment;                                          // 每段先结算 segment(无关车道)
    bonus += seg.scoreMul * CFG.scoreBase; speed += seg.spdMul * CFG.speedBase;
    var items = TRACK[s].items;
    if (items.length) {
      for (var k = 0; k < items.length; k++)
        if (TYPES[items[k].type].lethal && items[k].lane === lane) { crash(); return; }
      for (var j = 0; j < items.length; j++) {
        var it = items[j], t = TYPES[it.type];
        if (it.lane === lane && !t.lethal) { bonus += t.scoreMul * CFG.scoreBase; speed += t.spdMul * CFG.speedBase; }
        else if (it.lane !== lane && t.lethal) { bonus += t.scoreMul * CFG.scoreBase; }   // 躲过奖励
      }
    }
    if (speed < CFG.minSpeed) speed = CFG.minSpeed;
  }

  /* ---- 输入:左右滑 / ←→ 换道(仅运行中)---- */
  function move(dir) { if (ctl && ctl.phase() === "running") lane = Math.max(0, Math.min(LANES - 1, lane + dir)); }
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") move(-1); else if (e.key === "ArrowRight") move(1);
  });
  var touchX = null;
  canvas.addEventListener("pointerdown", function (e) { touchX = e.clientX; });
  canvas.addEventListener("pointerup", function (e) {
    if (touchX == null) return; var dx = e.clientX - touchX; touchX = null;
    if (Math.abs(dx) > CFG.swipeMinPx) move(dx > 0 ? 1 : -1);
  });

  /* ---- 画法(每个 TYPES 一个;加物件就加一个)---- */
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawCoin(ctx, s) {
    var r = lhw(s) * 0.30; if (r < 0.6) return;
    ctx.beginPath(); ctx.arc(s.x, s.y - r * 3.2, r, 0, Math.PI * 2);
    ctx.fillStyle = "#e0a63b"; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.25); ctx.strokeStyle = "#fff3c4"; ctx.stroke();
  }
  function drawDiamond(ctx, s) {
    var r = lhw(s) * 0.42; if (r < 0.8) return;
    var cx = s.x, cy = s.y - r * 3.0;
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.8, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.8, cy); ctx.closePath();
    ctx.fillStyle = "#5fd0e0"; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.22); ctx.strokeStyle = "#e8fbff"; ctx.stroke();
  }
  function drawBlock(ctx, s) {                                    // 黄黑斜纹路障
    var hw = lhw(s) * 0.9, h = hw * 2.0, x = s.x - hw, y = s.y - h, w = hw * 2;
    if (hw < 1) return;
    ctx.save();
    roundRect(ctx, x, y, w, h, Math.min(4, hw * 0.3)); ctx.fillStyle = "#f2c400"; ctx.fill();
    ctx.clip();
    ctx.fillStyle = "#1a1a1a";
    var sw = hw * 0.55;
    for (var d = -h; d < w + h; d += sw * 2) {
      ctx.beginPath();
      ctx.moveTo(x + d, y); ctx.lineTo(x + d + sw, y); ctx.lineTo(x + d + sw - h, y + h); ctx.lineTo(x + d - h, y + h);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function drawStrip(ctx, s, color, up) {                        // 贴地色条 + 方向三角(加速上/减速下)
    var hw = lhw(s) * 0.95, h = Math.max(3, hw * 0.55), x = s.x - hw, y = s.y - h;
    if (hw < 1) return;
    roundRect(ctx, x, y, hw * 2, h, 2); ctx.fillStyle = color; ctx.fill();
    var t = Math.min(hw * 0.5, h * 0.7), cy = y + h / 2;
    ctx.fillStyle = "#fff"; ctx.beginPath();
    if (up) { ctx.moveTo(s.x, cy - t * 0.6); ctx.lineTo(s.x + t, cy + t * 0.5); ctx.lineTo(s.x - t, cy + t * 0.5); }
    else { ctx.moveTo(s.x, cy + t * 0.6); ctx.lineTo(s.x + t, cy - t * 0.5); ctx.lineTo(s.x - t, cy - t * 0.5); }
    ctx.closePath(); ctx.fill();
  }
  function drawSlow(ctx, s) { drawStrip(ctx, s, "#e5484d", false); }
  function drawBoost(ctx, s) { drawStrip(ctx, s, "#3ba55d", true); }
  function drawPlayer(ctx, s) {                                  // 摩托背影(车尾+尾灯+骑手背+头盔+把手)
    var hw = lhw(s) * 0.8, cx = s.x, base = s.y;
    if (hw < 2) return;
    var wheelW = hw * 0.7, wheelH = hw * 1.5;
    ctx.fillStyle = "#15181e"; roundRect(ctx, cx - wheelW / 2, base - wheelH, wheelW, wheelH, wheelW * 0.35); ctx.fill();
    var bw = hw * 1.35, bh = hw * 1.3, by = base - wheelH - bh * 0.45;
    ctx.fillStyle = "#4a9eff"; roundRect(ctx, cx - bw / 2, by, bw, bh, bw * 0.25); ctx.fill();
    ctx.fillStyle = "#e5484d"; roundRect(ctx, cx - bw * 0.20, by + bh * 0.55, bw * 0.40, bh * 0.22, 2); ctx.fill(); // 尾灯
    ctx.strokeStyle = "#20242c"; ctx.lineWidth = Math.max(1, hw * 0.14);                                           // 把手
    ctx.beginPath();
    ctx.moveTo(cx - bw * 0.45, by + bh * 0.15); ctx.lineTo(cx - bw * 0.72, by - bh * 0.15);
    ctx.moveTo(cx + bw * 0.45, by + bh * 0.15); ctx.lineTo(cx + bw * 0.72, by - bh * 0.15); ctx.stroke();
    var rw = hw * 1.0, rh = hw * 1.5, ry = by - rh * 0.72;                                                         // 骑手背
    ctx.fillStyle = "#2b303a"; roundRect(ctx, cx - rw / 2, ry, rw, rh, rw * 0.35); ctx.fill();
    ctx.fillStyle = "#e8eaed"; ctx.beginPath(); ctx.arc(cx, ry, rw * 0.42, 0, Math.PI * 2); ctx.fill();            // 头盔
  }

  function draw() {
    var ents = [], baseSeg = Math.floor(cameraZ / SEG);
    for (var n = 0; n < CFG.drawDistance; n++) {
      var sIdx = baseSeg + n; if (sIdx < 0 || sIdx >= TRACK_LEN) continue;
      var items = TRACK[sIdx].items; if (!items.length) continue;
      var zc = sIdx * SEG;
      for (var k = 0; k < items.length; k++) ents.push({ z: zc, x: road.laneX(items[k].lane), draw: TYPES[items[k].type].draw });
    }
    ents.push({ z: cameraZ + PLAYER_DZ, x: playerX, draw: drawPlayer });
    road.render(cameraZ, ents);
  }

  /* ---- 主循环:速度=累积状态量,cameraZ 逐帧积分;逐段结算;换道插值 ---- */
  function frame() {
    requestAnimationFrame(frame);
    if (ctl && ctl.phase() === "running") {
      var now = performance.now();
      var dt = (lastPerf == null) ? 0 : Math.min(0.05, (now - lastPerf) / 1000);
      lastPerf = now;
      cameraZ += speed * dt;
      var pSeg = Math.floor((cameraZ + PLAYER_DZ) / SEG);
      for (var s = lastSeg + 1; s <= pSeg && !ended; s++) { if (s >= 0 && s < TRACK_LEN) processSeg(s); }
      lastSeg = pSeg;
      playerX += (road.laneX(lane) - playerX) * CFG.laneLerp;
      score = bonus;                                                 // 纯累加器:距离(segment)+ 各物件都已进 bonus
      ctl.setScore(score);
    } else { lastPerf = null; }
    draw();
  }

  /* ---- 启动 ---- */
  function boot() {
    road.resize();
    ctl = window.FairPlay.control.init({
      stage: "#runner_stage",
      rules: L().rn_rules || "Swipe left/right to switch lanes. Grab coins, dodge the barriers. One hit ends your run.",
      onRun: function () { road.resize(); }, onPause: function () {}
    });
    ctl.setTimer({ mode: "down", duration: LIMIT * 1000, onTimeout: finish });
    ctl.setScore(0);
    frame();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
