/* FairPlay 置顶栏 —— 结构与内容的唯一来源。
   各页只留空壳 <header id="topbar"></header>(CSS 已给固定高度,不产生布局跳动),
   本文件同步注入完整 markup。样式在 common.css(#topbar…),文案走 window.I18N,
   图标来自 assets/icons.js 的雪碧图(#exit/#lang)。
   翻译由各页随后的 FairPlay.applyI18n() 统一处理(整页 data-i18n 扫描)。
   logo 的根链接 (./ 或 ../) 由本脚本自己的 src 自动推断,无需每页配置。 */
(function () {
  var script = document.currentScript;
  var src = script ? (script.getAttribute("src") || "") : "";
  var base = src.indexOf("../") === 0 ? "../" : "./";   // 游戏页在子目录 → 根为 ../

  var TOPBAR_HTML =
    '<a class="logo" data-i18n="logo" href="' + base + '">FairPlay</a>' +
    /* nickname 无 data-i18n:由 mount() 用 getNickname() 填,免得被 applyI18n 覆盖 */
    '<span class="nickname" role="button" tabindex="0"></span>' +
    '<span class="spacer"></span>' +
    '<button type="button" class="iconbtn langbtn" data-i18n-aria="lang" aria-label="Language">' +
      '<svg class="ic" aria-hidden="true"><use href="#lang"/></svg>' +
      '<span class="lang-code"></span>' +
    '</button>' +
    '<span class="version" id="ver"></span>' +
    /* exit 放最后(版本之后) */
    '<button type="button" class="iconbtn" data-i18n-aria="exit" aria-label="Exit">' +
      '<svg class="ic" aria-hidden="true"><use href="#exit"/></svg>' +
    '</button>';

  /* 点昵称 → 弹出编辑窗(输入 + 免责声明 + 已读确认 + 保存/取消)。文案取自当前语言 */
  function openNicknameModal(nickEl) {
    if (!(window.FairPlay && FairPlay.openModal)) return;
    var L = FairPlay.L();
    FairPlay.openModal({
      dismissible: true,
      cardClass: "nk",
      build: function (card, close) {
        card.innerHTML =
          '<div class="nk-title"></div>' +
          '<input class="nk-input" type="text" maxlength="24">' +
          '<p class="nk-note"></p>' +
          '<label class="nk-ack"><input type="checkbox" class="nk-ackbox"><span></span></label>' +
          '<div class="nk-btns">' +
            '<button type="button" class="nk-cancel"></button>' +
            '<button type="button" class="nk-ok" disabled></button>' +
          '</div>';
        card.querySelector(".nk-title").textContent = L.nick_title || "Nickname";
        card.querySelector(".nk-note").textContent = L.nick_note || "";
        card.querySelector(".nk-ack span").textContent = L.nick_ack || "";
        card.querySelector(".nk-cancel").textContent = L.nick_cancel || "Cancel";
        var ok = card.querySelector(".nk-ok"); ok.textContent = L.nick_save || "Save";
        var input = card.querySelector(".nk-input");
        input.placeholder = L.nick_ph || L.nickname || "Guest";
        input.value = FairPlay.getNickname();
        var ack = card.querySelector(".nk-ackbox");
        ack.addEventListener("change", function () { ok.disabled = !ack.checked; });
        card.querySelector(".nk-cancel").addEventListener("click", close);
        ok.addEventListener("click", function () {
          if (!ack.checked) return;
          FairPlay.setNickname(input.value.trim());
          nickEl.textContent = FairPlay.getNickname();
          close();
        });
        input.focus();
      }
    });
  }

  /* 点地球 → 语言菜单(English / 中文,当前项高亮);选择即切换刷新 */
  function openLangModal() {
    if (!(window.FairPlay && FairPlay.openModal)) return;
    var L = FairPlay.L();
    var cur = FairPlay.getLang();
    var langs = [{ code: "en", name: "English" }, { code: "zh", name: "中文" }];
    FairPlay.openModal({
      dismissible: true,
      cardClass: "lang",
      build: function (card, close) {
        var h = '<div class="nk-title">' + (L.lang || "Language") + '</div><div class="lang-list">';
        langs.forEach(function (x) {
          h += '<button type="button" class="lang-item' + (x.code === cur ? " on" : "") + '" data-lang="' + x.code + '">' + x.name + '</button>';
        });
        card.innerHTML = h + '</div>';
        card.querySelectorAll(".lang-item").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var l = btn.getAttribute("data-lang");
            close();                              /* 先关弹窗 */
            if (l !== cur) FairPlay.setLang(l);   /* 再就地切换(不刷新) */
          });
        });
      }
    });
  }

  /* 点退出 → 确认窗:确认则尽力清缓存/存储、注销 SW,再关闭页面 */
  function openExitModal() {
    if (!(window.FairPlay && FairPlay.openModal)) return;
    var L = FairPlay.L();
    FairPlay.openModal({
      dismissible: true,
      cardClass: "nk",
      build: function (card, close) {
        card.innerHTML =
          '<div class="nk-title"></div>' +
          '<p class="nk-note"></p>' +
          '<div class="nk-btns">' +
            '<button type="button" class="nk-cancel"></button>' +
            '<button type="button" class="nk-ok"></button>' +
          '</div>';
        card.querySelector(".nk-title").textContent = L.exit_title || "Exit";
        card.querySelector(".nk-note").textContent = L.exit_note || "";
        card.querySelector(".nk-cancel").textContent = L.exit_cancel || "Cancel";
        card.querySelector(".nk-ok").textContent = L.exit_confirm || "Confirm";
        card.querySelector(".nk-cancel").addEventListener("click", close);
        card.querySelector(".nk-ok").addEventListener("click", function () { close(); doExit(); });
      }
    });
  }

  /* 尽浏览器所能删干净,再关闭页面(普通标签页 close 常被拦,兜底跳 about:blank) */
  function doExit() {
    var tasks = [];
    if (window.caches && caches.keys) {
      tasks.push(caches.keys().then(function (ks) {
        return Promise.all(ks.map(function (k) { return caches.delete(k); }));
      }).catch(function () {}));
    }
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      tasks.push(navigator.serviceWorker.getRegistrations().then(function (rs) {
        return Promise.all(rs.map(function (r) { return r.unregister(); }));
      }).catch(function () {}));
    }
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    Promise.all(tasks).catch(function () {}).then(function () {
      try { window.open("", "_self"); window.close(); } catch (e) {}
      location.replace("about:blank");
    });
  }

  function mount() {
    var header = document.getElementById("topbar");
    if (!header) return;
    header.innerHTML = TOPBAR_HTML;
    var nick = header.querySelector(".nickname");
    if (nick && window.FairPlay && FairPlay.getNickname) {
      nick.textContent = FairPlay.getNickname();
      var open = function () { openNicknameModal(nick); };
      nick.addEventListener("click", open);
      nick.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    }
    var langBtn = header.querySelector('[data-i18n-aria="lang"]');
    if (langBtn) {
      var code = langBtn.querySelector(".lang-code");
      if (code && window.FairPlay) code.textContent = FairPlay.L().lang_short || FairPlay.getLang();
      langBtn.addEventListener("click", openLangModal);
    }
    var exitBtn = header.querySelector('[data-i18n-aria="exit"]');
    if (exitBtn) exitBtn.addEventListener("click", openExitModal);
  }

  /* 语言就地切换:logo/aria 由 applyI18n 管;缩略字与 nickname 非 data-i18n,这里手动刷新 */
  window.addEventListener("fairplay:langchange", function () {
    if (!window.FairPlay) return;
    var code = document.querySelector("#topbar .lang-code");
    if (code) code.textContent = FairPlay.L().lang_short || FairPlay.getLang();
    var nick = document.querySelector("#topbar .nickname");
    if (nick) nick.textContent = FairPlay.getNickname();
  });

  /* 脚本置于 shell 之后 → 同步注入;万一被放到 head,退回 DOMContentLoaded */
  if (document.getElementById("topbar")) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
