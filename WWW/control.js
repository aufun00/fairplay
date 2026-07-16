/* FairPlay 控制栏(游戏页第二区,唯一来源)—— 时间/成绩框 + ▶/⏸ + 统一时钟 + run/pause/end 接口。
   游戏页在 topbar 与 stage 之间留空壳 <div id="app_control"></div>;本文件注入内容并暴露 FairPlay.control.init()。
   归属:时间归控制栏(时钟驱动 #app_ctl_time,游戏只给 formatTime);成绩框 #app_ctl_score = 游戏输出口(游戏直接写)。
   暂停/结果弹窗只盖 stage(openModal mount=stage);焦点丢失自动暂停;结束禁用按钮。
   接口:FairPlay.control.init({ stage, rules, onRun, onPause, onTick, formatTime }) → { run, pause, end, elapsed, phase } */
(function () {
  window.FairPlay = window.FairPlay || {};
  window.FairPlay.control = window.FairPlay.control || {};

  window.FairPlay.control.init = function (opts) {
    opts = opts || {};
    var stage = opts.stage;
    if (typeof stage === "string") stage = document.querySelector(stage);
    if (!stage) return null;

    /* ---- 控制栏内容(左时间框 · 中 ▶/⏸ · 右成绩框)---- */
    var bar = document.getElementById("app_control");
    if (bar) {
      bar.innerHTML =
        '<div class="ctl-side"><div id="app_ctl_time" class="ctl-box">0.0</div></div>' +
        '<button type="button" id="app_ctl_run" class="ctl-run" aria-label="Start">' +
          '<svg class="ic" aria-hidden="true"><use href="#ic_play"/></svg>' +
        '</button>' +
        '<div class="ctl-side"><div id="app_ctl_score" class="ctl-box"></div></div>';
    }
    var runBtn = document.getElementById("app_ctl_run");
    var runUse = runBtn ? runBtn.querySelector("use") : null;
    var timeEl = document.getElementById("app_ctl_time");

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
    function tick() {
      paintTime();
      if (timer.mode === "down" && !timer.fired && elapsed() >= timer.duration) {   // 超时:停表 + 通知游戏
        timer.fired = true; stopClock();
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
      paintBtn(); paintTime();
      showResult(o || {});
    }

    if (runBtn) runBtn.addEventListener("click", function () { if (phase === "running") pause(); else run(); });

    /* 焦点丢失(切后台 / 失焦)运行中 → 自动暂停(pause 内部已判 running) */
    document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("blur", function () { pause(); });

    /* ---- stage 级结果弹窗:只放分享(ic_share,同首页;时间/成绩在控制栏、home 在 topbar,均未被遮)---- */
    function showResult(o) {
      if (!(window.FairPlay && FairPlay.openModal)) return;
      FairPlay.openModal({
        mount: stage, dismissible: false, cardClass: "res",
        build: function (card) {
          card.innerHTML =
            '<div class="res-title"></div>' +
            '<button type="button" class="res-share" aria-label="Share">' +
              '<svg class="ic" aria-hidden="true"><use href="#ic_share"/></svg>' +
            '</button>';
          card.querySelector(".res-title").textContent = o.title || "";
          card.querySelector(".res-share").addEventListener("click", function () {
            if (window.FairPlay && FairPlay.share) FairPlay.share(o.shareText || "");
          });
        }
      });
    }

    paintBtn(); paintTime();
    return { run: run, pause: pause, end: end, elapsed: elapsed, phase: function () { return phase; }, setTimer: setTimer, addPenalty: addPenalty };
  };
})();
