/* FairPlay — memory(记忆翻牌)
   种子来自 ?p(对手同题复现);无 ?p / 校验不过 → 回主页。
   3 列 × 4 行 = 12 张(6 对)。翻两张:配对消失加分;不成对合上。
   每张首次合上不扣分,之后每合一次扣分递增。全配对 → 成绩 → 分享(只发文本)。 */
(function () {
  var COLS = 3, ROWS = 4, N = 12, PAIRS = 6;
  var MATCH_POINTS = 100, PENALTY_STEP = 10;
  var FRUITS = ["", "🍎", "🍊", "🍋", "🍇", "🍉", "🫐"]; // 1..6

  var codec = window.FAIRPLAY_CODECS && window.FAIRPLAY_CODECS.memory;
  var L = (window.I18N && window.I18N.en) || {};

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
  var boardEl, pairsEl, scoreEl, cells = [];
  function buildUI() {
    var stage = document.getElementById("stage");
    stage.innerHTML =
      '<div id="hud"><div id="pairs">0/' + PAIRS + '</div><div id="score">0</div></div>' +
      '<div id="board"></div>' +
      '<div id="result" hidden></div>';
    boardEl = document.getElementById("board");
    pairsEl = document.getElementById("pairs");
    scoreEl = document.getElementById("score");
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

  /* ---- 结束 → 成绩 → 分享(只发文本)---- */
  function endGame() {
    if (ended) return; ended = true;
    showResult(score);
  }
  function doShare() {
    var nick = L.nickname || "Guest";
    var line = (L.mem_share || "{nick} scored {score} in #{code}")
      .replace("{nick}", nick).replace("{score}", score).replace("{code}", seedParam.slice(-4));
    var msg = (L.logo || "FairPlay") + "\n" + line;
    try {
      if (navigator.share) { navigator.share({ text: msg }).catch(function () {}); }
      else if (navigator.clipboard) { navigator.clipboard.writeText(msg); }
    } catch (e) {
      if (navigator.clipboard) navigator.clipboard.writeText(msg);
    }
  }
  function showResult(sc) {
    var el = document.getElementById("result");
    el.hidden = false;
    el.innerHTML =
      '<div class="rcard">' +
      '<div class="rtitle">' + (L.mem_done || "All matched!") + '</div>' +
      '<div class="rscore">' + (L.score || "Score") + ': ' + sc + '</div>' +
      '<button id="rshare">' + (L.mem_share_btn || "Share result") + '</button>' +
      '</div>';
    document.getElementById("rshare").addEventListener("click", doShare);
  }

  function boot() { buildUI(); render(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
