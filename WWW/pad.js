/* FairPlay — 公共方向输入控件 dirPad(唯一来源)。
   把三种方向输入统一成一个回调:① 屏上常驻 D-pad(半透明、底部居中,拇指可及)
   ② 全屏 swipe(挂 app_frame,任意处滑都算,阈值低)③ 方向键。
   方向合法性(如贪吃蛇禁 180° 回头)由调用方在 onDir 里判——本控件只负责「报方向」。
   用法:FairPlay.dirPad({ onDir:function(dx,dy){…}, axes:"4"|"x"|"y", swipeMinPx:24 });
   dx/dy ∈ {-1,0,1}:左=(-1,0) 右=(1,0) 上=(0,-1) 下=(0,1)。 */
window.FairPlay = window.FairPlay || {};
window.FairPlay.dirPad = function (opts) {
  opts = opts || {};
  var onDir = opts.onDir || function () {};
  var axes = opts.axes || "4";
  var minPx = opts.swipeMinPx || 24;
  var host = document.getElementById("app_frame") || document.body;
  var allowX = (axes === "4" || axes === "x");
  var allowY = (axes === "4" || axes === "y");
  function emit(dx, dy) {
    if (dx && !allowX) return;
    if (dy && !allowY) return;
    onDir(dx, dy);
  }

  /* ---- 屏上 D-pad(常驻)---- */
  var pad = document.createElement("div");
  pad.className = "fp-dpad axes-" + axes;
  var defs = [];
  if (allowY) defs.push(["u", "▲", 0, -1]);
  if (allowX) defs.push(["l", "◀", -1, 0], ["r", "▶", 1, 0]);
  if (allowY) defs.push(["d", "▼", 0, 1]);
  defs.forEach(function (b) {
    var el = document.createElement("button");
    el.type = "button"; el.className = "ar " + b[0]; el.textContent = b[1];
    el.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    el.addEventListener("click", function (e) { e.stopPropagation(); emit(b[2], b[3]); });
    pad.appendChild(el);
  });
  host.appendChild(pad);

  /* ---- 全屏 swipe(容器 pointer-events:none,故按钮外的滑动都落到这里)---- */
  var sx = null, sy = null;
  host.addEventListener("pointerdown", function (e) { sx = e.clientX; sy = e.clientY; });
  host.addEventListener("pointerup", function (e) {
    if (sx == null) return;
    var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < minPx) return;
    if (Math.abs(dx) > Math.abs(dy)) emit(dx > 0 ? 1 : -1, 0);
    else emit(0, dy > 0 ? 1 : -1);
  });

  /* ---- 方向键 ---- */
  document.addEventListener("keydown", function (e) {
    var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d) { e.preventDefault(); emit(d[0], d[1]); }
  });

  return { el: pad };
};
