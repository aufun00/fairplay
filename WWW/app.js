/* FairPlay — 页面通用引导(所有页面共用,改一处全生效) */
window.FairPlay = window.FairPlay || {};

/* Service Worker 注册 */
window.FairPlay.registerSW = function (path) {
  if ("serviceWorker" in navigator) {
    addEventListener("load", function () { navigator.serviceWorker.register(path).catch(function () {}); });
  }
};

/* 当前语言:localStorage 优先 → 浏览器语言(zh* 且有 zh 包则中文)→ 兜底 en。
   仅返回 I18N 里存在的语种。全站读文案都过它。 */
window.FairPlay.getLang = function () {
  var avail = window.I18N || {};
  try { var s = localStorage.getItem("fairplay.lang"); if (s && avail[s]) return s; } catch (e) {}
  var nav = (navigator.language || "en").toLowerCase();
  if (nav.indexOf("zh") === 0 && avail.zh) return "zh";
  return "en";
};
/* 切换语言 = 存储 + 就地重译(不刷新页面,保住游戏计时器/棋盘等运行时状态)。
   所有语种已随 lang 文件全量载入,切换无需联网/刷新:
   applyI18n() 重扫全页 data-i18n;langchange 事件让各页重渲染"按 L 动态生成"的部分。 */
window.FairPlay.setLang = function (l) {
  try { localStorage.setItem("fairplay.lang", l); } catch (e) {}
  window.FairPlay.applyI18n();
  window.dispatchEvent(new Event("fairplay:langchange"));
};
/* 当前语言的文案表 */
window.FairPlay.L = function () { return (window.I18N && window.I18N[window.FairPlay.getLang()]) || {}; };

/* 整页 i18n:全页 data-i18n / -ph / -aria 扫描 + <html lang> + 版本号。
   各页加载末尾调用一次(名字曾叫 initTopbar,实为整页处理,已更名)。 */
window.FairPlay.applyI18n = function () {
  var L = window.FairPlay.L();
  document.documentElement.lang = window.FairPlay.getLang();
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    var t = L[el.getAttribute("data-i18n")];
    if (t != null) el.textContent = t;
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
    var t = L[el.getAttribute("data-i18n-ph")];
    if (t != null) el.placeholder = t;
  });
  /* 图标按钮无可见文字,用 aria-label 供读屏(键名同 data-i18n) */
  document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
    var t = L[el.getAttribute("data-i18n-aria")];
    if (t != null) el.setAttribute("aria-label", t);
  });
  var ver = document.getElementById("app_ver");
  if (ver && self.FAIRPLAY_VERSION) ver.textContent = "v" + self.FAIRPLAY_VERSION.replace(/^fairplay\./, "");
};

/* 昵称:localStorage 持久化;空则回退 i18n 的 nickname / "Guest"。全站分享文本都用它 */
window.FairPlay.getNickname = function () {
  try { var v = localStorage.getItem("fairplay.nickname"); if (v != null && v !== "") return v; } catch (e) {}
  return window.FairPlay.L().nickname || "Guest";
};
window.FairPlay.setNickname = function (v) {
  try { localStorage.setItem("fairplay.nickname", v == null ? "" : String(v)); } catch (e) {}
};

/* 首页模式(op_mode):localStorage 持久化,默认 "new"(引导页);"pro" = 一屏全展开页。
   index.html 路由器据此分流到 index.<mode>.html。纯存储,导航由调用方(topbar)处理。 */
window.FairPlay.getOpMode = function () {
  try { var v = localStorage.getItem("fairplay.mode"); if (v) return v; } catch (e) {}
  return "new";
};
window.FairPlay.setOpMode = function (m) {
  try { localStorage.setItem("fairplay.mode", m == null ? "new" : String(m)); } catch (e) {}
};

/* 最近玩过(MRU):把 id 提到最前(已存在先摘出),写 localStorage。纯数据、无渲染。
   首页开一局、以及通过邀请码 ?g 直接进游戏(index.html 路由器)都调它,故放通用层。 */
window.FairPlay.pushRecent = function (id) {
  try {
    var arr = JSON.parse(localStorage.getItem("fairplay.recent")) || [];
    var i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
    arr.unshift(id);
    localStorage.setItem("fairplay.recent", JSON.stringify(arr));
  } catch (e) {}
};

/* 通用弹窗原语:造 .fp-overlay 背板 + .fp-card 卡片,调用方用 build(card, close) 填内容。
   opts: { dismissible=true(点背板关闭), cardClass, build, html,
           mount:element|selector —— 挂载点决定覆盖范围:默认 #app_frame=全窗(topbar 域);
                                      传 stage(.app_stage,position:relative)=只盖 stage(app_control 域) }
   → 返回 { overlay, card, close } */
window.FairPlay.openModal = function (opts) {
  opts = opts || {};
  var ov = document.createElement("div");
  ov.className = "fp-overlay";
  var card = document.createElement("div");
  card.className = "fp-card" + (opts.cardClass ? " " + opts.cardClass : "");
  ov.appendChild(card);
  function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
  if (opts.dismissible !== false) {
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });   /* 点背板关闭 */
  }
  var mount = opts.mount;
  if (typeof mount === "string") mount = document.querySelector(mount);
  (mount || document.getElementById("app_frame") || document.body).appendChild(ov);  /* 先入 DOM,便于 build 里 focus */
  if (typeof opts.build === "function") opts.build(card, close);
  else if (opts.html != null) card.innerHTML = opts.html;
  return { overlay: ov, card: card, close: close };
};

/* 分享(唯一入口,topbar 域):文本+链接合成一条(link 折进 text,不用单独 url 字段——
   很多 App 拿到 {text,url} 会只显示 url、丢掉 text)。有原生分享用原生,否则复制。首页与各游戏结果都调它 */
window.FairPlay.share = function (text, url) {
  var msg = url ? (text + "\n" + url) : text;
  try { if (navigator.share) { navigator.share({ text: msg }).catch(function () {}); return; } } catch (e) {}
  try { if (navigator.clipboard) navigator.clipboard.writeText(msg); } catch (e) {}
};
