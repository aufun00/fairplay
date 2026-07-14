/* FairPlay — 通用结果页 + 分享(所有游戏结束共用,改一处全生效)
   FairPlay.showResult({ title, score, scoreLabel, shareText, shareLabel, homeLabel, homeHref })
   FairPlay.share(text) —— 只发文本(无原生分享则复制) */
window.FairPlay = window.FairPlay || {};

window.FairPlay.share = function (text) {
  try {
    if (navigator.share) { navigator.share({ text: text }).catch(function () {}); }
    else if (navigator.clipboard) { navigator.clipboard.writeText(text); }
  } catch (e) {
    if (navigator.clipboard) navigator.clipboard.writeText(text);
  }
};

window.FairPlay.showResult = function (opts) {
  opts = opts || {};
  var ov = document.createElement("div");
  ov.className = "fp-overlay";
  ov.innerHTML =
    '<div class="rcard">' +
      '<div class="rtitle"></div>' +
      '<div class="rscore"></div>' +
      '<div class="rbtns">' +
        '<button class="rhome"></button>' +
        '<button class="rshare"></button>' +
      '</div>' +
    '</div>';
  ov.querySelector(".rtitle").textContent = opts.title || "";
  ov.querySelector(".rscore").textContent = (opts.scoreLabel || "Score") + ": " + opts.score;

  var home = ov.querySelector(".rhome");
  home.textContent = opts.homeLabel || "Home";
  home.addEventListener("click", function () { location.href = opts.homeHref || "../"; });

  var share = ov.querySelector(".rshare");
  share.textContent = opts.shareLabel || "Share";
  share.addEventListener("click", function () { window.FairPlay.share(opts.shareText || ""); });

  (document.getElementById("frame") || document.body).appendChild(ov);
  return ov;
};
