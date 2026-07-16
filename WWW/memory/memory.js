/* FairPlay — memory(记忆翻牌)
   种子来自 ?p(对手同题复现);无 ?p / 校验不过 → 回主页。
   3 列 × 4 行 = 12 张(6 对)。翻两张:配对消失加分;不成对合上。
   每张首次合上不扣分,之后每合一次扣分递增。全配对 → 成绩 → 分享(只发文本)。 */
(function () {
  var COLS = 3, ROWS = 4, N = 12, PAIRS = 6;
  var MATCH_POINTS = 100, PENALTY_STEP = 10;
  var FRUITS = ["", "🍎", "🍊", "🍋", "🍇", "🍉", "🫐"]; // 1..6

  var codec = window.FAIRPLAY_CODECS && window.FAIRPLAY_CODECS.memory;
  var L = (window.FairPlay && FairPlay.L()) || (window.I18N && window.I18N.en) || {};

  /* ---- 种子:只能凭邀请码进 ---- */
  var p = new URLSearchParams(location.search).get("p");
  var dec = (p && codec) ? codec.decode(p) : null;
  if (!dec) { location.replace("../"); return; }
  var seedParam = p, cards = dec.cards;

  /* ---- 状态 ---- */
  var faceUp = new Array(N).fill(false);
  var matched = new Array(N).fill(false);
  var closeCount = new Array(N).fill(0);   // 每张被合上的次数
  var first = -1, second = -1;
  var score = 0, matchedPairs = 0, busy = false, ended = false;

  /* ---- UI ---- */
  /* 注:memory 暂未迁到 app_control 框架(等 match3/mathdoku 定型、总结规则后再接入);仍用自带 HUD + result.js。 */
  var boardEl, pairsEl, scoreEl, cells = [];
  function buildUI() {
    var stage = document.getElementById("memory_stage");
    stage.innerHTML =
      '<div id="memory_hud"><div id="memory_pairs">0/' + PAIRS + '</div><div id="memory_score">0</div></div>' +
      '<div id="memory_board"></div>';
    boardEl = document.getElementById("memory_board");
    pairsEl = document.getElementById("memory_pairs");
    scoreEl = document.getElementById("memory_score");
    for (var i = 0; i < N; i++) {
      (function (i) {
        var d = document.createElement("div"); d.className = "card down";
        d.addEventListener("click", function () { onTap(i); });
        boardEl.appendChild(d); cells.push(d);
      })(i);
    }
  }

  function render() {
    for (var i = 0; i < N; i++) {
      cells[i].className = "card " + (matched[i] ? "matched" : (faceUp[i] ? "up" : "down"));
      cells[i].textContent = (faceUp[i] && !matched[i]) ? FRUITS[cards[i]] : "";
    }
    if (scoreEl) scoreEl.textContent = score;
    if (pairsEl) pairsEl.textContent = matchedPairs + "/" + PAIRS;
  }

  /* ---- 交互 ---- */
  function onTap(i) {
    if (busy || ended) return;
    if (matched[i] || faceUp[i]) return;
    faceUp[i] = true; render();
    if (first === -1) { first = i; return; }
    second = i; busy = true;
    if (cards[first] === cards[second]) {
      score += MATCH_POINTS; render();
      setTimeout(resolveMatch, 450);
    } else {
      setTimeout(resolveMismatch, 850);
    }
  }
  function resolveMatch() {
    matched[first] = matched[second] = true;
    matchedPairs++; first = second = -1; busy = false;
    render();
    if (matchedPairs === PAIRS) endGame();
  }
  function resolveMismatch() {
    [first, second].forEach(function (i) {
      closeCount[i]++;
      score -= (closeCount[i] - 1) * PENALTY_STEP;   // 首次合 =0,之后递增
    });
    if (score < 0) score = 0;
    faceUp[first] = faceUp[second] = false;
    first = second = -1; busy = false;
    render();
  }

  /* ---- 结束 → 通用结果页 ---- */
  function endGame() {
    if (ended) return; ended = true;
    var line = (L.game_share || "{nick} scored {score} in {game} # {code}")
      .replace("{nick}", FairPlay.getNickname()).replace("{score}", score)
      .replace("{game}", L.game_name || "").replace("{code}", seedParam.slice(-4));
    window.FairPlay.showResult({
      title: L.mem_done || "All matched!",
      score: score,
      scoreLabel: L.score || "Score",
      shareText: (L.logo || "FairPlay") + "\n" + line,   // 只发文本,不发链接
      shareLabel: L.game_share_btn || "Share result",
      homeLabel: L.home || "Home",
      homeHref: "../"
    });
  }

  function boot() { buildUI(); render(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
