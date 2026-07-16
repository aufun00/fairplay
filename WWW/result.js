/* FairPlay — 旧版全窗结果页(memory 暂用;match3/mathdoku 已迁到 app_control 的 stage 级结果)。
   FairPlay.showResult({ title, score, scoreLabel, shareText, shareLabel, homeLabel, homeHref })
   分享入口 FairPlay.share() 已上移到 app.js。 */
window.FairPlay = window.FairPlay || {};

window.FairPlay.showResult = function (opts) {
  opts = opts || {};
  return window.FairPlay.openModal({
    dismissible: false,   /* 结果页不允许点背板关,必须选 Home / Share */
    build: function (card) {
      card.innerHTML =
        '<div class="rtitle"></div>' +
        '<div class="rscore"></div>' +
        '<div class="rbtns">' +
          '<button class="rhome"></button>' +
          '<button class="rshare"></button>' +
        '</div>';
      card.querySelector(".rtitle").textContent = opts.title || "";
      card.querySelector(".rscore").textContent = (opts.scoreLabel || "Score") + ": " + opts.score;

      var home = card.querySelector(".rhome");
      home.textContent = opts.homeLabel || "Home";
      home.addEventListener("click", function () { location.href = opts.homeHref || "../"; });

      var share = card.querySelector(".rshare");
      share.textContent = opts.shareLabel || "Share";
      share.addEventListener("click", function () { window.FairPlay.share(opts.shareText || ""); });
    }
  });
};
