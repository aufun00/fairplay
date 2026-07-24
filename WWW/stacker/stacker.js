/* FairPlay — Stacker(叠塔,等距伪 3D)。凭邀请码进(FairPlay.enterGame)。
   ★ 核心状态 = 一个浮点矩形「切割面」(塔顶)。每块 = 1~4 个 box(形状的比例子矩形)。
   滑动:整块按浮点 offset 平移;落地:切割面 = bounding 连续交(细切、只缩不长,永远矩形→可玩);
     各 box 裁到新切割面 → 保留 box(变小/消失),这层就重画成这些 box。异形可连续。
   计分:保留 box 总面积 × TYPES.scoreMul ×(剩余 0.1s × scoreCoef)。切割面 0 面积 = 未命中 → ctl.expire()。
   渲染:2D canvas 手搓等距立方体(无 3D 库);每层 ≤4 box、只留窗口内的层 → 手机也省。 */
(function () {
  /* ============ 可调参数(Ctrl-F5 硬刷即看)============ */
  var CFG = {
    baseSize:   6,     // 满 footprint 世界尺寸(纯比例基准)
    baseSpeed:  2.8,   // 起步滑动速度(世界单位/秒)
    speedBase:  0.25,  // 每放一块加速(spdMul × 它)
    scoreCoef:  0.5,   // 保留面积 × scoreMul ×(剩余 0.1s × 此)
    minSize:    1.2    // 切割面任一边 < 此即结束(太小滑动看不出;满尺寸=baseSize)
  };
  /* 形状块表:shape=box 集生成;scoreMul 面积越小越高;weight=seed 掷的稀有度;spdMul=放置后加速 */
  var TYPES = {
    solid:  { weight:10, scoreMul: 1, spdMul: 1, shape: "full"    },  // 满格(常见、稳)
    frame:  { weight: 5, scoreMul: 2, spdMul: .8, shape: "border"  },  // 边框(4 box)
    cross:  { weight: 3, scoreMul: 3, spdMul: .5, shape: "cross"   },  // 十字(3 box)
    corner: { weight: 1, scoreMul: 5, spdMul: .1, shape: "corners" }   // 四角(4 box,最小最难最高分)
  };

  var G = FairPlay.enterGame(); if (!G) return;
  var node = G.node, LIMIT = G.limit;
  var rng = FairPack.rng(G.seed);
  var BASE = CFG.baseSize;

  var canvas = document.getElementById("st_canvas"), ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1, SX = 0, SY = 0, LH = 0;
  var plane = { x0: 0, x1: BASE, z0: 0, z1: BASE };        // ★ 切割面(浮点矩形)= 唯一结构状态
  var layers = [], placedCount = 0, block = null;
  var speed = CFG.baseSpeed, score = 0, dead = false, ended = false, ctl = null, lastPerf = null;
  var VIS = 14, EPS = 1e-4;

  function timeVal() { return ctl.remaining() * CFG.scoreCoef; }

  /* ---- 形状 → box 集(基于给定切割面 p 的比例子矩形)---- */
  function shapeBoxes(kind, p) {
    var w = p.x1 - p.x0, d = p.z1 - p.z0, t = Math.min(w, d) * 0.28;
    if (kind === "full") return [{ x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1 }];
    if (kind === "border") return [
      { x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z0 + t },
      { x0: p.x0, x1: p.x1, z0: p.z1 - t, z1: p.z1 },
      { x0: p.x0, x1: p.x0 + t, z0: p.z0 + t, z1: p.z1 - t },
      { x0: p.x1 - t, x1: p.x1, z0: p.z0 + t, z1: p.z1 - t }
    ];
    if (kind === "cross") {
      var cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2, cz0 = cz - t / 2, cz1 = cz + t / 2;
      return [                                              // 3 个不重叠 box:横带全宽 + 上下两截竖
        { x0: p.x0, x1: p.x1, z0: cz0, z1: cz1 },
        { x0: cx - t / 2, x1: cx + t / 2, z0: p.z0, z1: cz0 },
        { x0: cx - t / 2, x1: cx + t / 2, z0: cz1, z1: p.z1 }
      ];
    }
    var cw = w * 0.34, cd = d * 0.34;                      // corners
    return [
      { x0: p.x0, x1: p.x0 + cw, z0: p.z0, z1: p.z0 + cd },
      { x0: p.x1 - cw, x1: p.x1, z0: p.z0, z1: p.z0 + cd },
      { x0: p.x0, x1: p.x0 + cw, z0: p.z1 - cd, z1: p.z1 },
      { x0: p.x1 - cw, x1: p.x1, z0: p.z1 - cd, z1: p.z1 }
    ];
  }

  function pickType() {
    var keys = Object.keys(TYPES), total = 0, i;
    for (i = 0; i < keys.length; i++) total += TYPES[keys[i]].weight || 0;
    var r = rng.int(total), acc = 0;
    for (i = 0; i < keys.length; i++) { acc += TYPES[keys[i]].weight || 0; if (r < acc) return keys[i]; }
    return keys[0];
  }
  function spawnBlock() {
    var type = pickType();
    var axis = (placedCount % 2 === 1) ? "x" : "z";
    var M = (axis === "x") ? (plane.x1 - plane.x0) : (plane.z1 - plane.z0);
    var side = rng.int(2) ? 1 : -1;
    block = { type: type, axis: axis, boxes: shapeBoxes(TYPES[type].shape, plane), offset: side * M, dir: -side, M: M };
  }

  /* ---- 落块:切割面连续裁 + box 裁到新面重画 ---- */
  function drop() {
    if (!ctl || ctl.phase() !== "running" || !block) return;
    var o = block.offset, ax = block.axis;                 // ★ 浮点,不 round
    var np = { x0: plane.x0, x1: plane.x1, z0: plane.z0, z1: plane.z1 };
    if (ax === "x") { np.x0 = Math.max(plane.x0, plane.x0 + o); np.x1 = Math.min(plane.x1, plane.x1 + o); }
    else { np.z0 = Math.max(plane.z0, plane.z0 + o); np.z1 = Math.min(plane.z1, plane.z1 + o); }
    if (np.x1 - np.x0 <= EPS || np.z1 - np.z0 <= EPS) { die(); return; }   // 未命中
    var ret = [], area = 0;
    for (var i = 0; i < block.boxes.length; i++) {
      var b = block.boxes[i];
      var sx0 = b.x0 + (ax === "x" ? o : 0), sx1 = b.x1 + (ax === "x" ? o : 0);
      var sz0 = b.z0 + (ax === "z" ? o : 0), sz1 = b.z1 + (ax === "z" ? o : 0);
      var cx0 = Math.max(sx0, np.x0), cx1 = Math.min(sx1, np.x1), cz0 = Math.max(sz0, np.z0), cz1 = Math.min(sz1, np.z1);
      if (cx1 - cx0 > EPS && cz1 - cz0 > EPS) { ret.push({ x0: cx0, x1: cx1, z0: cz0, z1: cz1 }); area += (cx1 - cx0) * (cz1 - cz0); }
    }
    var t = TYPES[block.type];
    score += area * t.scoreMul * timeVal();
    speed += t.spdMul * CFG.speedBase;
    if (speed < CFG.baseSpeed) speed = CFG.baseSpeed;      // 托底:不低于起始速度
    ctl.setScore(score);
    layers.push({ boxes: ret, hue: (placedCount * 14) % 360, idx: placedCount });
    if (layers.length > VIS) layers.shift();               // 只留窗口内的层
    plane = np; placedCount++;
    if (Math.min(plane.x1 - plane.x0, plane.z1 - plane.z0) < CFG.minSize) { die(); return; }   // 切割面太小 → 结束
    spawnBlock();
  }

  function die() { if (ended) return; dead = true; ctl.expire(); }
  function finish() {
    if (ended) return; ended = true;
    var LL = FairPlay.L();
    ctl.end(dead ? "miss" : "timeout", {
      title: (dead ? LL.st_miss : LL.st_timeup) || (dead ? "Missed!" : "Time's up!"),
      gameName: FairPlay.gameName(node), score: Math.floor(score)
    });
  }

  /* ---- 等距渲染 ---- */
  function layout() {
    dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    SX = (W * 0.42) / BASE; SY = SX * 0.5; LH = SX * 1.15;
  }
  function proj(x, z, idx) {
    var xC = x - BASE / 2, zC = z - BASE / 2;
    return [W / 2 + (xC - zC) * SX, H * 0.6 + (xC + zC) * SY + (placedCount - idx) * LH];
  }
  function corners(b, idx) { return [proj(b.x0, b.z0, idx), proj(b.x1, b.z0, idx), proj(b.x1, b.z1, idx), proj(b.x0, b.z1, idx)]; }
  function sides(b, idx, hue) {                            // 一个 box 的四竖面(背 -x/-z 先、前 +x/+z 后)
    var q = corners(b, idx), A = q[0], B = q[1], C = q[2], D = q[3];
    var xc = "hsl(" + hue + " 60% 40%)", zc = "hsl(" + hue + " 60% 30%)";
    function face(P, Q, col) {
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(P[0], P[1]); ctx.lineTo(Q[0], Q[1]); ctx.lineTo(Q[0], Q[1] + LH); ctx.lineTo(P[0], P[1] + LH); ctx.closePath(); ctx.fill();
    }
    face(A, D, xc); face(A, B, zc); face(B, C, xc); face(D, C, zc);
  }
  function top(b, idx, hue) {
    var q = corners(b, idx);
    ctx.fillStyle = "hsl(" + hue + " 60% 58%)";
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.lineTo(q[3][0], q[3][1]); ctx.closePath(); ctx.fill();
  }
  function byDepth(a, b) { return (a.x1 + a.z1) - (b.x1 + b.z1); }   // 按前角排序,后→前
  /* 两遍:先所有 box 的侧面(后→前),再统一所有顶面 → 顶面不会被别的 box 侧墙盖住,层内拼接正确 */
  function drawLayer(boxes, idx, hue) {
    var bs = boxes.slice().sort(byDepth), k;
    for (k = 0; k < bs.length; k++) sides(bs[k], idx, hue);
    for (k = 0; k < bs.length; k++) top(bs[k], idx, hue);
  }
  function render() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < layers.length; i++) drawLayer(layers[i].boxes, layers[i].idx, layers[i].hue);
    if (block) {                                           // 当前块:镂空、悬 placedCount 层、按浮点 offset 平滑滑动
      var hue = (placedCount * 14) % 360, o = block.offset, ax = block.axis, sb = [];
      for (var k = 0; k < block.boxes.length; k++) {
        var b = block.boxes[k];
        sb.push({ x0: b.x0 + (ax === "x" ? o : 0), x1: b.x1 + (ax === "x" ? o : 0), z0: b.z0 + (ax === "z" ? o : 0), z1: b.z1 + (ax === "z" ? o : 0) });
      }
      drawLayer(sb, placedCount, hue);
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    var ph = ctl && ctl.phase();
    if ((ph === "running" || ph === "counting") && block) {
      var now = performance.now(); if (lastPerf == null) lastPerf = now;
      var dt = Math.min(0.05, (now - lastPerf) / 1000); lastPerf = now;
      block.offset += block.dir * speed * dt;
      if (block.offset > block.M) { block.offset = block.M; block.dir = -1; }
      if (block.offset < -block.M) { block.offset = -block.M; block.dir = 1; }
    } else lastPerf = null;
    render();
  }

  function boot() {
    layout();
    plane = { x0: 0, x1: BASE, z0: 0, z1: BASE };
    layers = [{ boxes: shapeBoxes("full", plane), hue: 0, idx: 0 }];   // 地基层
    placedCount = 1;
    spawnBlock();
    ctl = window.FairPlay.control.init({
      stage: "#stacker_stage",
      rules: FairPlay.L().st_rules || "Tap anywhere to drop the sliding block. Overhang is sliced off — align to stay wide. A total miss ends the run.",
      onRun: function () { layout(); }, onPause: function () {}
    });
    ctl.setTimer({ mode: "down", duration: LIMIT * 1000, onTimeout: finish });
    ctl.setScore(0);
    document.getElementById("stacker_stage").addEventListener("pointerdown", function (e) { e.preventDefault(); drop(); });
    window.addEventListener("resize", function () { layout(); render(); });
    render(); frame();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
