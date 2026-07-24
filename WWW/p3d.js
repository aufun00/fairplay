/* FairPlay — 通用伪 3D 引擎 p3d.js(零依赖,canvas 2D)。
   segment 直道投影 + 近大远小,供跑酷等 2.5D 游戏复用。
   渲染是纯显示层(可用浮点/随帧率),不参与公平序列——赛道数据由游戏用整数 PRNG 生成后传进来。
   当前只做「直道 + 车道」这一形态(runner 所需),不预先泛化弯道/坡道。

   用法:
     var road = P3D.create(canvas, opts);   // opts 见下
     road.resize();                          // 画布尺寸变化后调
     road.laneX(i);                          // 第 i 车道中心的世界横坐标 x
     road.roadWidth;                         // 路面半宽(世界单位),游戏据此换算精灵尺寸
     road.render(cameraZ, entities);         // cameraZ=相机沿路深度;entities=[{z,x,draw(ctx,s)}]
        entity.draw 收到投影结果 s = {x,y,w,scale}(x,y 屏幕坐标,w=该深度路面半宽像素,scale=缩放) */
window.P3D = (function () {
  function create(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var roadW = opts.roadWidth || 1000;                 // 路面半宽(世界单位)
    var segLen = opts.segmentLength || 200;             // 每段长度
    var drawDist = opts.drawDistance || 140;            // 可见段数
    var camH = opts.cameraHeight || 1000;               // 相机高度
    var lanes = opts.lanes || 3;
    var fov = (opts.fovDeg || 100) * Math.PI / 180;
    var camDepth = 1 / Math.tan(fov / 2);
    var c = opts.colors || {};
    var C = {
      sky:     c.sky     || "#0e1116",
      grass1:  c.grass1  || "#1b2130",
      grass2:  c.grass2  || "#161b27",
      road1:   c.road1   || "#3a3f4b",
      road2:   c.road2   || "#31363f",
      rumble1: c.rumble1 || "#c8ccd4",
      rumble2: c.rumble2 || "#e5484d",
      lane:    c.lane    || "#9aa0aa"
    };
    var W = 0, H = 0, dpr = 1;

    function resize() {
      dpr = window.devicePixelRatio || 1;
      W = canvas.clientWidth || canvas.width; H = canvas.clientHeight || canvas.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* 第 i 车道中心的世界横坐标(路面横跨 -roadW..+roadW,相机 x 固定 0)*/
    function laneX(i) { return -roadW + roadW * (2 * i + 1) / lanes; }

    /* 世界点(x 横,y 高,z 相对相机深度>0)→ 屏幕。x=0 在屏幕水平中线(相机居中) */
    function project(x, y, z) {
      var scale = camDepth / z;
      return {
        x: W / 2 + scale * x * W / 2,
        y: H / 2 - scale * (y - camH) * H / 2,
        w: scale * roadW * W / 2,
        scale: scale
      };
    }

    function poly(x1, y1, x2, y2, x3, y3, x4, y4, col) {
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
      ctx.closePath(); ctx.fill();
    }

    function render(cameraZ, entities) {
      ctx.fillStyle = C.sky; ctx.fillRect(0, 0, W, H);
      var base = Math.floor(cameraZ / segLen);
      /* 远→近画段:近段后画 → 盖住远段(处理重叠) */
      for (var n = drawDist; n >= 0; n--) {
        var seg = base + n;
        if (seg < 0) continue;
        var zNear = seg * segLen - cameraZ;
        var zFar = zNear + segLen;
        if (zNear < 1) continue;                        // 相机后/贴脸,跳过
        var p1 = project(0, 0, zNear);                  // 近边(下)
        var p2 = project(0, 0, zFar);                   // 远边(上)
        var dark = (seg % 2) === 0;
        // 草地(整行)
        ctx.fillStyle = dark ? C.grass1 : C.grass2;
        ctx.fillRect(0, p2.y, W, Math.ceil(p1.y - p2.y) + 1);
        // 路面梯形
        poly(p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, dark ? C.road1 : C.road2);
        // 两侧路肩(rumble)
        var rw1 = p1.w * 0.13, rw2 = p2.w * 0.13, rc = dark ? C.rumble1 : C.rumble2;
        poly(p1.x - p1.w, p1.y, p1.x - p1.w + rw1, p1.y, p2.x - p2.w + rw2, p2.y, p2.x - p2.w, p2.y, rc);
        poly(p1.x + p1.w, p1.y, p1.x + p1.w - rw1, p1.y, p2.x + p2.w - rw2, p2.y, p2.x + p2.w, p2.y, rc);
        // 车道分隔线(仅暗段画,形成虚线)
        if (dark) {
          for (var l = 1; l < lanes; l++) {
            var lx = -roadW + roadW * 2 * l / lanes;    // 分隔线世界 x
            var s1 = p1.x + (lx / roadW) * p1.w, s2 = p2.x + (lx / roadW) * p2.w;
            var lw1 = p1.w * 0.015, lw2 = p2.w * 0.015;
            poly(s1 - lw1, p1.y, s1 + lw1, p1.y, s2 + lw2, p2.y, s2 - lw2, p2.y, C.lane);
          }
        }
      }
      // 精灵:远→近,近的后画(正确遮挡)
      if (entities && entities.length) {
        var list = [];
        for (var i = 0; i < entities.length; i++) {
          var dz = entities[i].z - cameraZ;
          if (dz > 1 && dz < drawDist * segLen) list.push(entities[i]);
        }
        list.sort(function (a, b) { return b.z - a.z; });
        for (var k = 0; k < list.length; k++) {
          var e = list[k];
          e.draw(ctx, project(e.x || 0, 0, e.z - cameraZ));
        }
      }
    }

    resize();
    return { resize: resize, laneX: laneX, project: project, render: render, roadWidth: roadW, lanes: lanes };
  }
  return { create: create };
})();
