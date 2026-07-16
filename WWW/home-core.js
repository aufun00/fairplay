/* FairPlay 首页核心(home-core)—— index.new / index.pro 两页共用的逻辑。
   两页 UI 不同(new=引导式 .gcard/showView;pro=一屏 tab/矩阵),但状态与行为一致:
   history 模型、#hm_invite 的 QR/param/memo/分享、recent MRU、开局 startRound、目录查找。
   本文件只管这些;各页只留自己的列表/视图渲染,通过 cfg 的 hook 接回来。

   用法(页面):
     var H = FairPlay.Home({ getL, base, catalog, codecs,
                             onHistory, onRecent, onRoundStarted, onMemoInput, onDocClick });
     H.initInvite();                       // 挂 #hm_invite 的一次性事件(DOM 需就绪)
     // 页面自己的 renderPickInv / renderRecent 用 H.history / H.selectEntry / H.icoSvg 等
   cfg hook:
     getL()          → 返回当前语言文案表(随 langchange 变,故用函数不用值)
     onHistory()     → 重渲染本页 history 列表(core 改动 history/selected 后调用)
     onRecent()      → 重渲染本页 recent 列表
     onRoundStarted()→ 开完一局后(new:showView("invite");pro:空)
     onMemoInput(lbl)→ memo 编辑时就地更新选中卡片第二行(选择器各页不同)
     onDocClick(e)   → 文档级点击附加处理(pro 用于取消长按删除确认;new 不传) */
window.FairPlay = window.FairPlay || {};
window.FairPlay.Home = function (cfg) {
  var getL = cfg.getL || function () { return {}; };
  var base = cfg.base;
  var catalog = cfg.catalog || [];
  var codecs = cfg.codecs || {};
  var onHistory = cfg.onHistory || function () {};
  var onRecent = cfg.onRecent || function () {};
  var onRoundStarted = cfg.onRoundStarted || function () {};

  var HKEY = "fairplay.history", RKEY = "fairplay.recent";
  function loadHistory() { try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch (e) { return []; } }
  function saveHistory() { try { localStorage.setItem(HKEY, JSON.stringify(H.history)); } catch (e) {} }
  function loadRecent() { try { return JSON.parse(localStorage.getItem(RKEY)) || []; } catch (e) { return []; } }
  function saveRecent() { try { localStorage.setItem(RKEY, JSON.stringify(H.recent)); } catch (e) {} }

  var H = {
    history: loadHistory(),
    recent: loadRecent(),
    selected: null,
    lastLongPress: 0    // 最近一次长按触发时刻(吞掉长按松手的那次 click;QR 与 pro 的 history 长按共用)
  };

  /* ---- 目录辅助 ---- */
  function icoSvg(id) { return '<svg class="ic" aria-hidden="true"><use href="#ic_' + id + '"/></svg>'; }
  function l2Full(l2) { return l2.games && l2.games.length > 0; }
  function l1Full(l1) { return l1.subs.some(l2Full); }
  function firstL2(l1) { for (var i = 0; i < l1.subs.length; i++) if (l2Full(l1.subs[i])) return i; return -1; }
  function findGame(id) {
    for (var i = 0; i < catalog.length; i++)
      for (var j = 0; j < catalog[i].subs.length; j++) {
        var gs = catalog[i].subs[j].games;
        for (var k = 0; k < gs.length; k++) if (gs[k].id === id) return gs[k];
      }
    return null;
  }
  function gamePlayUrl(game) {
    var url = game.key + "/" + game.key + ".html";
    if (game.cfg) url += "?c=" + encodeURIComponent(game.cfg);
    return url;
  }
  function inviteLink(item) { return base + "?g=" + item.gameId + "&p=" + encodeURIComponent(item.param); }

  /* ---- 条目展示辅助 ---- */
  function entryTime(item) {
    if (!item.ts) return "";
    var d = new Date(item.ts);
    var p2 = function (n) { return String(n).padStart(2, "0"); };
    return p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds()) + " " + (getL().inv_created || "created");
  }
  function entryLabel(item) { return item.memo || entryTime(item); }   // 有 memo 显 memo,否则显创建时刻

  /* ---- 长按(QR 打开新标签 / pro 的 history 删除确认共用)---- */
  function attachLongPress(el, onLong) {
    var timer = null;
    var start = function () { timer = setTimeout(function () { timer = null; onLong(); }, 600); };
    var cancel = function () { if (timer) { clearTimeout(timer); timer = null; } };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", cancel);
    el.addEventListener("touchmove", cancel);
    el.addEventListener("mousedown", start);
    el.addEventListener("mouseup", cancel);
    el.addEventListener("mouseleave", cancel);
    return function suppressClickIfHandled() { return timer === null; };
  }

  /* ---- #hm_invite 区(两页结构相同):QR / param / memo / share ---- */
  var qrEl, qrOpenBtn, paramEl, memoEl, invfields, shareEl;
  function renderQR(text) {
    var render = qrEl.querySelector(".qr-render");
    render.innerHTML = "";
    if (text && window.FairPlay && FairPlay.QR) {
      try { render.appendChild(FairPlay.QR.toCanvas(text, { ecc: "M" })); qrEl.classList.add("has-qr"); return; } catch (e) {}
    }
    qrEl.classList.remove("has-qr");
  }
  function syncSquares() {
    var s = invfields.offsetHeight + "px";
    qrEl.style.width = s; qrEl.style.height = s;
    if (shareEl) { shareEl.style.width = s; shareEl.style.height = s; }
  }
  function openQRModal(item) {
    if (!(window.FairPlay && FairPlay.openModal && FairPlay.QR)) return;
    FairPlay.openModal({
      dismissible: true, cardClass: "qrbig",
      build: function (card) {
        var cv = null;
        try { cv = FairPlay.QR.toCanvas(inviteLink(item), { ecc: "M", quiet: 4, scale: 10 }); } catch (e) {}
        if (cv) { cv.className = "qr-big"; card.appendChild(cv); }
        var cap = document.createElement("div");
        cap.className = "qr-big-cap";
        cap.textContent = "#" + item.param.slice(-4);
        card.appendChild(cap);
      }
    });
  }

  /* ---- 状态动作 ---- */
  function selectEntry(item) {
    H.selected = item;
    qrEl.classList.remove("confirm");
    paramEl.value = item.param;
    memoEl.value = item.memo || "";
    memoEl.placeholder = item.memo ? (getL().memo_ph || "memo") : (entryTime(item) || (getL().memo_ph || "memo"));
    renderQR(inviteLink(item));
    onHistory();
  }
  function deleteAt(idx) {
    var item = H.history[idx];
    var wasSel = (H.selected === item);
    H.history.splice(idx, 1);
    saveHistory();
    if (wasSel && H.history.length) {
      selectEntry(H.history[Math.max(0, idx - 1)]);
    } else {
      if (wasSel) {                 /* 删空:清 param / memo / QR */
        H.selected = null;
        paramEl.value = ""; memoEl.value = "";
        memoEl.placeholder = (getL().memo_ph || "memo");
        renderQR(null);
      }
      onHistory();
    }
  }
  /* 最近玩过:MRU 提最前(经 FairPlay.pushRecent 写盘,再回读同步内存),重渲染 */
  function touchRecent(gameId) {
    if (window.FairPlay && FairPlay.pushRecent) FairPlay.pushRecent(gameId);
    H.recent = loadRecent();
    onRecent();
  }
  /* 开一局:codec.encode(cfg 空则不传)→ history 最前插一条 → 选中显 QR → 记入 recent */
  function startRound(game) {
    var codec = codecs[game.key];
    var param = codec ? (game.cfg ? codec.encode(game.cfg) : codec.encode()) : String(Date.now());
    H.history.unshift({ gameId: game.id, param: param, memo: "", ts: Date.now() });
    saveHistory();
    selectEntry(H.history[0]);
    touchRecent(game.id);
    onRoundStarted();
  }

  /* 一次性把 #hm_invite 的 DOM 引用取好并挂事件;页面在 DOM 就绪后调用一次 */
  function initInvite() {
    qrEl = document.querySelector("#hm_invite .qr");
    qrOpenBtn = qrEl.querySelector(".qr-open");
    paramEl = document.querySelector("#hm_invite .param");
    memoEl = document.querySelector("#hm_invite .memo");
    invfields = document.querySelector("#hm_invite .invfields");
    shareEl = document.querySelector("#hm_invite .share");

    if (window.ResizeObserver) { new ResizeObserver(syncSquares).observe(invfields); }
    window.addEventListener("resize", syncSquares);

    /* memo 编辑:input 改模型 + 就地更新选中卡片第二行(选择器各页不同,交回页面),change 存盘 */
    memoEl.addEventListener("input", function () {
      if (!H.selected) return;
      H.selected.memo = memoEl.value;
      if (cfg.onMemoInput) cfg.onMemoInput(entryLabel(H.selected));
    });
    memoEl.addEventListener("change", function () { if (H.selected) saveHistory(); });

    /* QR 长按 → 确认「新标签打开游戏」;确认按钮点击 = 用当前邀请码开新标签(离线入口) */
    attachLongPress(qrEl, function () {
      if (!H.selected) return;
      H.lastLongPress = Date.now();
      qrEl.classList.add("confirm");
    });
    qrOpenBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (Date.now() - H.lastLongPress < 500) return;
      if (!H.selected) return;
      var g = findGame(H.selected.gameId);
      if (g) { var u = gamePlayUrl(g); u += (u.indexOf("?") >= 0 ? "&" : "?") + "p=" + encodeURIComponent(H.selected.param); window.open(u, "_blank"); }
      qrEl.classList.remove("confirm");
    });
    /* QR 短按 → 放大二维码弹窗(便于扫描) */
    qrEl.addEventListener("click", function () {
      if (Date.now() - H.lastLongPress < 500) return;
      if (qrEl.classList.contains("confirm")) return;
      if (H.selected) openQRModal(H.selected);
    });
    /* 点别处取消 QR 确认态;pro 借 onDocClick 再取消长按删除确认 */
    document.addEventListener("click", function (e) {
      if (Date.now() - H.lastLongPress < 500) return;
      if (qrEl.classList.contains("confirm") && !qrEl.contains(e.target)) qrEl.classList.remove("confirm");
      if (cfg.onDocClick) cfg.onDocClick(e);
    });

    /* 分享按钮:{nick} … {game} # {code} + 邀请链接;走 FairPlay.share */
    shareEl.addEventListener("click", function () {
      var L = getL();
      if (!H.selected) { alert(L.share_empty || "Pick or create an invite first"); return; }
      var nick = FairPlay.getNickname();
      var g = findGame(H.selected.gameId) || {};
      var gname = (g.inf && L[g.inf] && L[g.inf].name) || g.key || "";
      var line = (L.share_msg || "{nick} invites you to play {game} # {code}")
        .replace("{nick}", nick).replace("{game}", gname).replace("{code}", H.selected.param.slice(-4));
      FairPlay.share(line, inviteLink(H.selected));
    });
  }

  /* ---- 暴露给页面 ---- */
  H.findGame = findGame;
  H.gamePlayUrl = gamePlayUrl;
  H.icoSvg = icoSvg;
  H.l1Full = l1Full;
  H.l2Full = l2Full;
  H.firstL2 = firstL2;
  H.inviteLink = inviteLink;
  H.entryTime = entryTime;
  H.entryLabel = entryLabel;
  H.attachLongPress = attachLongPress;
  H.selectEntry = selectEntry;
  H.deleteAt = deleteAt;
  H.startRound = startRound;
  H.touchRecent = touchRecent;
  H.openQRModal = openQRModal;
  H.renderQR = renderQR;
  H.syncSquares = syncSquares;
  H.saveHistory = saveHistory;
  H.saveRecent = saveRecent;
  H.loadRecent = loadRecent;
  H.initInvite = initInvite;
  return H;
};
