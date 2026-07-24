/* FairPlay 控制栏(游戏页第二区,唯一来源)—— 5 格:时间 · ▶/⏸ · 我的成绩 · 对抗条 · 对手成绩 + 统一时钟。
   游戏页在 topbar 与 stage 之间留空壳 <div id="app_control"></div>;本文件注入内容并暴露 FairPlay.control.init()。
   归属:成绩全归控制栏——游戏只调 setScore(n) 喂原始分,显示/对手匀速对抗/拔河条均由本文件的时钟统一驱动。
     对手最终分从邀请链接 ?o= 读(FairPack.decodeScore,缺失=0);假设匀速获得 → oppNow=oppFinal×(已用/时长)。
   暂停/结果弹窗只盖 stage(openModal mount=stage);焦点丢失自动暂停;结束禁用按钮。
   接口:FairPlay.control.init({ stage, rules, onRun, onPause }) → { run, pause, end, elapsed, phase, setTimer, addPenalty, setScore } */
(function () {
  window.FairPlay = window.FairPlay || {};
  window.FairPlay.control = window.FairPlay.control || {};

  window.FairPlay.control.init = function (opts) {
    opts = opts || {};
    var stage = opts.stage;
    if (typeof stage === "string") stage = document.querySelector(stage);
    if (!stage) return null;

    /* ---- 控制栏内容(5 格:时间 · ▶/⏸ · 我 · 对抗条 · 对手)---- */
    var bar = document.getElementById("app_control");
    if (bar) {
      bar.innerHTML =
        '<div id="app_ctl_time" class="ctl-num">0.0</div>' +
        '<button type="button" id="app_ctl_run" class="ctl-run" aria-label="Start">' +
          '<svg class="ic" aria-hidden="true"><use href="#ic_play"/></svg>' +
        '</button>' +
        '<div id="app_ctl_score" class="ctl-num">0</div>' +
        '<div class="ctl-vs"><div class="ctl-vs-fill"></div><i class="ctl-vs-spark"></i></div>' +
        '<div id="app_ctl_opp" class="ctl-num">0</div>';
    }
    var runBtn = document.getElementById("app_ctl_run");
    var runUse = runBtn ? runBtn.querySelector("use") : null;
    var timeEl = document.getElementById("app_ctl_time");
    var scoreEl = document.getElementById("app_ctl_score");
    var oppEl = document.getElementById("app_ctl_opp");
    var vsBar = bar ? bar.querySelector(".ctl-vs") : null;
    var vsFill = bar ? bar.querySelector(".ctl-vs-fill") : null;
    var vsSpark = bar ? bar.querySelector(".ctl-vs-spark") : null;

    /* 对抗:myScore 由游戏经 setScore 写;对手最终分从 ?o= 读一次(缺失=0),匀速爬升由时钟算 */
    var myScore = 0;
    var oppFinal = (window.FairPack && FairPack.decodeScore(new URLSearchParams(location.search).get("o"))) || 0;

    /* ---- stage 级遮盖 + 规则/帮助卡(开始/暂停用,不透明防偷看)---- */
    var cover = document.createElement("div");
    cover.className = "ctl-cover";
    cover.innerHTML = '<div class="ctl-rules"></div>';
    cover.querySelector(".ctl-rules").textContent = opts.rules || "";
    stage.appendChild(cover);

    /* ---- 统一时钟(可暂停;performance.now;startElapsed 供续玩预置)---- */
    var elapsedMs = opts.startElapsed || 0, startTs = 0, running = false, tickId = null, phase = "idle";
    var timer = { mode: "up", duration: 0, onTimeout: null, fired: false };   // up=正计 / down=倒计
    function elapsed() { return elapsedMs + (running ? performance.now() - startTs : 0); }
    function fmt(ms) {   // 统一显示格式 分:秒.十(不满 1 分省略分)—— 显示归 control
      var t = Math.floor(ms / 100), d = t % 10, s = Math.floor(t / 10), sec = s % 60, min = Math.floor(s / 60);
      return (min > 0 ? min + ":" + (sec < 10 ? "0" : "") + sec : sec) + "." + d;
    }
    function shownMs() { return timer.mode === "down" ? Math.max(0, timer.duration - elapsed()) : elapsed(); }
    function paintTime() { if (timeEl) timeEl.textContent = fmt(shownMs()); }
    /* 对手匀速现值:仅倒计时有时长基准时按比例爬升(无基准 = 对手未开始 → 0);到点/越界钳到 oppFinal */
    function oppNow() {
      if (!(timer.mode === "down" && timer.duration > 0)) return 0;
      var f = elapsed() / timer.duration; if (f < 0) f = 0; if (f > 1) f = 1;
      return Math.round(oppFinal * f);
    }
    /* 画我/对手成绩框 + 战线(我方占比 my/(my+对手现值);双 0 → 居中 50%)+ 战线处爆闪跟随 */
    function paintVersus() {
      var opp = oppNow();
      if (scoreEl) scoreEl.textContent = myScore;
      if (oppEl) oppEl.textContent = opp;
      var total = myScore + opp, pct = total > 0 ? (myScore / total * 100) : 50;
      if (vsFill) vsFill.style.width = pct + "%";
      if (vsSpark) vsSpark.style.left = pct + "%";
      if (vsBar) vsBar.classList.toggle("behind", myScore < opp);   // 落后 → 领先/落后色两侧互换
    }
    function setScore(n) { myScore = Math.max(0, Math.floor(Number(n) || 0)); paintVersus(); }
    function tick() {
      paintTime(); paintVersus();
      if (timer.mode === "down" && !timer.fired && elapsed() >= timer.duration) {   // 超时:停表 + 定格对手最终分 + 通知游戏
        timer.fired = true; stopClock(); paintVersus();
        if (timer.onTimeout) timer.onTimeout();
      }
    }
    function startClock() { if (running) return; running = true; startTs = performance.now(); tickId = setInterval(tick, 100); }
    function stopClock() { if (!running) return; elapsedMs += performance.now() - startTs; running = false; clearInterval(tickId); tickId = null; }
    /* 计时显示方式 + 超时响应(游戏 boot 时声明);罚时 = 直接加进 control 时钟 */
    function setTimer(o) { o = o || {}; timer.mode = (o.mode === "down") ? "down" : "up"; timer.duration = o.duration || 0; timer.onTimeout = o.onTimeout || null; timer.fired = false; paintTime(); }
    function addPenalty(ms) { elapsedMs += ms; paintTime(); }

    function label() {
      var L = (window.FairPlay && FairPlay.L && FairPlay.L()) || {};
      return phase === "running" ? (L.pause || "Pause") : (L.play || "Start");
    }
    function paintBtn() {
      if (!runBtn) return;
      runBtn.disabled = (phase === "ended");
      if (runUse) runUse.setAttribute("href", phase === "running" ? "#ic_pause" : "#ic_play");
      runBtn.setAttribute("aria-label", label());
    }

    function run() {
      if (phase === "ended") return;
      phase = "running"; cover.hidden = true;
      startClock(); paintBtn(); paintTime();
      if (opts.onRun) opts.onRun();
    }
    function pause() {
      if (phase !== "running") return;
      stopClock(); phase = "paused"; cover.hidden = false;
      paintBtn();
      if (opts.onPause) opts.onPause();
    }
    function end(kind, o) {
      stopClock(); phase = "ended"; cover.hidden = true;
      paintBtn(); paintTime(); paintVersus();   // 定格最终对抗态(对手现值按结束时刻的已用时长)
      showResult(o || {});
    }
    /* 死亡(撞死/掉落)= 剩余时间归零 → 走与自然超时同一出口(游戏在 onTimeout 里算分收尾)。
       只对倒计时有意义:把 elapsed 顶到 duration。现有限时游戏不调用,零影响。 */
    function expire() {
      if (running) stopClock();
      if (timer.mode === "down") elapsedMs = timer.duration;
      paintTime(); paintVersus();
      if (!timer.fired) { timer.fired = true; if (timer.onTimeout) timer.onTimeout(); }
    }

    if (runBtn) runBtn.addEventListener("click", function () { if (phase === "running") pause(); else run(); });

    /* 焦点丢失(切后台 / 失焦)运行中 → 自动暂停(pause 内部已判 running) */
    document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("blur", function () { pause(); });

    /* ---- stage 级结果弹窗:三出口(留在游戏内快速传播 + 一条引流)。
       游戏只传 { title, gameName, score };id/param 由本函数从自身 URL 读,
       新挑战码由 FairPack.encodeSeed 现掷(保留当前局时长 durIdx),邀请链接拼站点根(index.html 路由器)。 ---- */
    function showResult(o) {
      if (!(window.FairPlay && FairPlay.openModal)) return;
      var L = (window.FairPlay && FairPlay.L && FairPlay.L()) || {};
      var q = new URLSearchParams(location.search);
      var id = q.get("g"), seedParam = q.get("p") || "";
      var root = new URL("../", location.href).href;               // 站点根 = 路由器入口
      var gameName = o.gameName || "";
      function link(param) { return root + "?g=" + id + "&p=" + encodeURIComponent(param); }
      function scoreText() {
        return (L.game_share || "{nick} scored {score} in {game} # {code}")
          .replace("{nick}", FairPlay.getNickname()).replace("{score}", o.score)
          .replace("{game}", gameName).replace("{code}", seedParam.slice(-4));
      }
      function challengeText(param) {
        return (L.share_msg || "{nick} invites you to play {game} # {code}")
          .replace("{nick}", FairPlay.getNickname()).replace("{game}", gameName)
          .replace("{code}", param.slice(-4));
      }
      FairPlay.openModal({
        mount: stage, dismissible: false, cardClass: "res",
        build: function (card) {
          card.innerHTML =
            '<div class="res-title"></div>' +
            '<div class="res-btns">' +
              '<button type="button" class="res-b res-score"></button>' +
              '<button type="button" class="res-b res-new"></button>' +
              '<button type="button" class="res-b res-more"></button>' +
            '</div>';
          card.querySelector(".res-title").textContent = o.title || "";
          card.querySelector(".res-score").textContent = L.res_share_score || "Share my score";
          card.querySelector(".res-new").textContent = L.res_new_challenge || "Start my challenge";
          card.querySelector(".res-more").textContent = L.res_more_games || "See other games";
          /* ① 发布我成绩:当前局 iCode + 分数打包进链接 &o=(base58,不显示)→ 对手匀速对抗;分享后停留 */
          card.querySelector(".res-score").addEventListener("click", function () {
            var withScore = link(seedParam) + "&o=" + FairPack.encodeScore(o.score);
            FairPlay.share(scoreText(), withScore);
          });
          /* ② 发起我的挑战:现掷新 seed(同当前局时长)→ 存 history → 分享,停留 */
          card.querySelector(".res-new").addEventListener("click", function () {
            if (!window.FairPack) return;
            var d = FairPack.decodeSeed(seedParam);
            var newP = FairPack.encodeSeed(d ? d.durIdx : 0);
            if (FairPlay.pushHistory) FairPlay.pushHistory({ gameId: +id, param: newP, memo: "", ts: Date.now() });
            FairPlay.share(challengeText(newP), link(newP));
          });
          /* ③ 看看其它游戏:引流到引导页(经路由器,新人默认落引导) */
          card.querySelector(".res-more").addEventListener("click", function () { location.href = "../"; });
        }
      });
    }

    paintBtn(); paintTime(); paintVersus();
    return { run: run, pause: pause, end: end, expire: expire, elapsed: elapsed, phase: function () { return phase; }, setTimer: setTimer, addPenalty: addPenalty, setScore: setScore };
  };
})();
