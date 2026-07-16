/* FairPlay — mathdoku 游戏本体(从 mmDoku/docs/index.html 的游戏区移植,去 QR/ExCode/相机/复制粘贴/辅助区/自动新局)。
   种子来自 ?p=<param>(对手同题复现)。gamepage 只能凭邀请码进:无 ?p / 校验不过 = 回主页。
   计时:performance.now 净时钟(切后台停表);罚时另计,总用时 = 净时钟 + 罚时。
   Phase A:仅核心对弈,不含 9×9 笼分解助手(💡)。 */
(function () {
  "use strict";

  var codec = window.FAIRPLAY_CODECS && window.FAIRPLAY_CODECS.mathdoku;
  var L = (window.FairPlay && FairPlay.L()) || (window.I18N && window.I18N.en) || {};

  /* ---- 取种子:无 ?p / 解码失败 → 回主页 ---- */
  var p = new URLSearchParams(location.search).get("p");
  var dec = (p && codec) ? codec.decode(p) : null;
  if (!dec) { location.replace("../"); return; }
  var seedParam = p;

  var N = dec.N;
  var SAVE_KEY = "fairplay.mathdoku." + seedParam;
  var OP_SYM = { '+': '+', '-': '−', '*': '×', '/': '÷', '=': '' };

  /* ============ 笼四色染色(DSATUR 顺序 + 4 色回溯,平面图必成)============ */
  function cellCageGrid(n, cages) {
    var g = [], r, c, i, k;
    for (r = 0; r < n; r++) { g[r] = []; for (c = 0; c < n; c++) g[r][c] = -1; }
    for (i = 0; i < cages.length; i++) {
      var cs = cages[i].cells;
      for (k = 0; k < cs.length; k++) g[cs[k][0]][cs[k][1]] = i;
    }
    return g;
  }
  function colorCages(n, cages) {
    var c2c = cellCageGrid(n, cages);
    var adj = [], i, r, c;
    for (i = 0; i < cages.length; i++) adj[i] = {};
    function link(a, b) { if (a !== b) { adj[a][b] = 1; adj[b][a] = 1; } }
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) {
      var id = c2c[r][c];
      if (c < n - 1) link(id, c2c[r][c + 1]);
      if (r < n - 1) link(id, c2c[r + 1][c]);
    }
    function deg(x) { var t = 0, u; for (u in adj[x]) t++; return t; }
    var order = [];
    for (i = 0; i < cages.length; i++) order.push(i);
    order.sort(function (a, b) { return deg(b) - deg(a); });
    var color = [];
    for (i = 0; i < cages.length; i++) color[i] = -1;
    function bt(k) {
      if (k === order.length) return true;
      var v = order[k], used = {}, u;
      for (u in adj[v]) if (color[u] >= 0) used[color[u]] = 1;
      for (var col = 0; col < 4; col++) {
        if (used[col]) continue;
        color[v] = col;
        if (bt(k + 1)) return true;
        color[v] = -1;
      }
      return false;
    }
    if (!bt(0)) {                       // 兜底贪心(平面图理论到不了)
      for (var oi = 0; oi < order.length; oi++) {
        var v = order[oi], used = {}, u;
        for (u in adj[v]) if (color[u] >= 0) used[color[u]] = 1;
        var col = 0; while (used[col]) col++;
        color[v] = col;
      }
    }
    return color;
  }

  /* ============ 状态 ============ */
  var G = {
    values: null, notes: null, sel: null, mode: 'input',
    hist: [], redo: [], elapsedMs: 0,
    solved: false, mistakes: 0,
    cellEls: null, cellCage: null, cageColor: null, conflicts: null
  };

  /* 计时归 control(时钟),阶段/遮盖归 control;active=对局中(可输入)。 */
  var stageEl, boardEl, numpadEl, funcpadEl, modeBtn, scoreEl, timeBox, ctl, active = false;

  function zeros() { var a = [], r, c; for (r = 0; r < N; r++) { a[r] = []; for (c = 0; c < N; c++) a[r][c] = 0; } return a; }
  function emptyNotes() { var a = [], r, c; for (r = 0; r < N; r++) { a[r] = []; for (c = 0; c < N; c++) a[r][c] = {}; } return a; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  /* 笔记用普通对象充当 Set(v -> true),便于 JSON 存档 */
  function noteHas(o, v) { return !!o[v]; }
  function noteToggle(o, v) { if (o[v]) delete o[v]; else o[v] = true; }
  function noteClear(o) { for (var k in o) delete o[k]; }
  function noteEmpty(o) { for (var k in o) return false; return true; }
  function noteList(o) { var a = []; for (var k in o) a.push(+k); return a; }
  function noteFromList(a) { var o = {}; if (a) for (var i = 0; i < a.length; i++) o[a[i]] = true; return o; }

  /* ============ 计时归 control;罚时加进 control 时钟 ============ */
  function totalMs() { return ctl ? ctl.elapsed() : (G.elapsedMs || 0); }   // control 时钟(已含罚时)
  function penaltySec(n) { return n * 6 * N; }   // 第 n 次警告罚 n×(6×N) 秒
  function registerWarning() {                    // 一次红色警告:失误+1,罚时加进 control 时钟 + 成绩框失误数
    G.mistakes = (G.mistakes || 0) + 1;
    if (ctl) ctl.addPenalty(penaltySec(G.mistakes) * 1000);
    paintScore();
    if (timeBox) { timeBox.classList.add('pen'); setTimeout(function () { timeBox.classList.remove('pen'); }, 600); }
  }

  /* ============ 存档(localStorage,try/catch)============ */
  function saveGame() {
    try {
      var notes = [], r, c;
      for (r = 0; r < N; r++) { notes[r] = []; for (c = 0; c < N; c++) notes[r][c] = noteList(G.notes[r][c]); }
      var playElapsed = totalMs();
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        values: G.values, notes: notes, mode: G.mode,
        elapsedMs: Math.round(playElapsed),   // 已含罚时(control 时钟)
        mistakes: G.mistakes, solved: G.solved
      }));
    } catch (e) {}
  }
  function loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
  }

  function initState(s) {
    G.cellCage = cellCageGrid(N, dec.cages);
    G.cageColor = colorCages(N, dec.cages);
    G.hist = []; G.redo = []; G.sel = null;
    if (s) {
      G.values = (s.values && s.values.length === N) ? s.values : zeros();
      G.notes = emptyNotes();
      if (s.notes) for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (s.notes[r] && s.notes[r][c]) G.notes[r][c] = noteFromList(s.notes[r][c]);
      G.mode = s.mode || 'input';
      G.elapsedMs = s.elapsedMs || 0;   // 已含罚时(供 control startElapsed 续玩)
      G.mistakes = s.mistakes || 0; G.solved = !!s.solved;
    } else {
      G.values = zeros(); G.notes = emptyNotes(); G.mode = 'input';
      G.elapsedMs = 0; G.mistakes = 0; G.solved = false;
    }
  }

  /* ============ 棋盘渲染 ============ */
  function buildBoard() {
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = 'repeat(' + N + ',1fr)';
    boardEl.style.gridTemplateRows = 'repeat(' + N + ',1fr)';
    G.cellEls = []; for (var r = 0; r < N; r++) G.cellEls[r] = [];
    var anchorMap = {}, i;
    for (i = 0; i < dec.cages.length; i++) { var cg = dec.cages[i]; anchorMap[cg.anchor] = { op: cg.op, target: cg.target }; }
    var cageVar = function (id) { return 'var(--cage' + (G.cageColor[id] % 4) + ')'; };
    var thick = '3px', thin = '1px';
    for (r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      (function (r, c) {
        var cell = document.createElement('div'); cell.className = 'md_cell';
        var id = G.cellCage[r][c], col = cageVar(id);
        var edge = function (other) { return other !== id; };
        // 异笼边界=彩色粗边(本格笼色);同笼内部=细线(中性)
        cell.style.borderTopWidth = (r === 0 || edge(G.cellCage[r - 1][c])) ? thick : thin;
        cell.style.borderLeftWidth = (c === 0 || edge(G.cellCage[r][c - 1])) ? thick : thin;
        cell.style.borderRightWidth = (c === N - 1 || edge(G.cellCage[r][c + 1])) ? thick : thin;
        cell.style.borderBottomWidth = (r === N - 1 || edge(G.cellCage[r + 1][c])) ? thick : thin;
        cell.style.borderTopColor = (r === 0 || edge(G.cellCage[r - 1][c])) ? col : 'var(--line)';
        cell.style.borderLeftColor = (c === 0 || edge(G.cellCage[r][c - 1])) ? col : 'var(--line)';
        cell.style.borderRightColor = (c === N - 1 || edge(G.cellCage[r][c + 1])) ? col : 'var(--line)';
        cell.style.borderBottomColor = (r === N - 1 || edge(G.cellCage[r + 1][c])) ? col : 'var(--line)';
        var hl = document.createElement('div'); hl.className = 'md_hlbg'; cell.appendChild(hl);
        // 目标数栏(仅笼锚点、非单格):"12+" / "3-" / "6*" → 用 OP_SYM
        var clue = document.createElement('div'); clue.className = 'md_clue';
        var a = anchorMap[r * N + c];
        if (a && a.op !== '=') clue.textContent = a.target + OP_SYM[a.op];
        cell.appendChild(clue);
        var main = document.createElement('div'); main.className = 'md_main';
        var val = document.createElement('div'); val.className = 'md_val'; main.appendChild(val);
        var notes = document.createElement('div'); notes.className = 'md_notes';
        for (var v = 1; v <= 9; v++) { var sp = document.createElement('span'); sp.setAttribute('data-v', v); notes.appendChild(sp); }
        main.appendChild(notes); cell.appendChild(main);
        // 单格已知格:预填 target、不可改(但可选中)
        if (a && a.op === '=') { cell.classList.add('given', 'filled'); val.textContent = a.target; G.values[r][c] = a.target; }
        cell.addEventListener('click', function () { selectCell(r, c); });
        boardEl.appendChild(cell); G.cellEls[r][c] = cell;
      })(r, c);
    }
  }

  function buildNumpad() {
    numpadEl.innerHTML = '';
    for (var i = 1; i <= 9; i++) {
      var k = document.createElement('button');
      if (i <= N) {
        k.className = 'md_key md_numkey'; k.setAttribute('data-v', i);
        k.innerHTML = '<span class="md_num">' + i + '</span><span class="md_rem"></span>';
        (function (v) { k.addEventListener('click', function () { pressNum(v); }); })(i);
      } else { k.className = 'md_key blank'; }
      numpadEl.appendChild(k);
    }
  }

  function renderAll() { var r, c; for (r = 0; r < N; r++) for (c = 0; c < N; c++) renderCell(r, c); computeConflicts(); renderHighlights(); updateRemaining(); }
  function renderCell(r, c) {
    var cell = G.cellEls[r][c]; if (cell.classList.contains('given')) return;
    var v = G.values[r][c], val = cell.querySelector('.md_val');
    if (v) { cell.classList.add('filled'); val.textContent = v; } else { cell.classList.remove('filled'); val.textContent = ''; }
    var set = G.notes[r][c], spans = cell.querySelectorAll('.md_notes span');
    for (var i = 0; i < spans.length; i++) { var nv = +spans[i].getAttribute('data-v'); spans[i].textContent = (!v && nv <= N && noteHas(set, nv)) ? nv : ''; }
  }
  function renderHighlights() {
    var r, c;
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) G.cellEls[r][c].classList.remove('hl-line', 'hl-cage', 'selected', 'same-num');
    var sel = G.sel; if (!sel) return;
    var sr = sel.r, sc = sel.c, selVal = G.values[sr][sc], selCage = G.cellCage[sr][sc];
    for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
      var cell = G.cellEls[i][j];
      if (i === sr || j === sc) cell.classList.add('hl-line');
      if (G.cellCage[i][j] === selCage) cell.classList.add('hl-cage');
      if (selVal && G.values[i][j] === selVal) cell.classList.add('same-num');
    }
    G.cellEls[sr][sc].classList.add('selected');
  }
  function updateRemaining() {
    var used = [], i, r, c; for (i = 0; i <= N; i++) used[i] = 0;
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) { var v = G.values[r][c]; if (v) used[v]++; }
    var keys = numpadEl.querySelectorAll('.md_numkey');
    for (i = 0; i < keys.length; i++) {
      var k = keys[i], v = +k.getAttribute('data-v'), rem = N - used[v];
      k.querySelector('.md_rem').textContent = rem;
      if (rem <= 0) k.classList.add('dim'); else k.classList.remove('dim');
    }
  }

  /* ============ 冲突(红):① 同行/同列已出现该数;② 笼已不可能凑出目标 ============ */
  function computeConflicts() {
    var bad = [], r, c, i;
    for (r = 0; r < N; r++) { bad[r] = []; for (c = 0; c < N; c++) bad[r][c] = false; }
    for (r = 0; r < N; r++) { var seen = {}; for (c = 0; c < N; c++) { var v = G.values[r][c]; if (!v) continue; if (seen[v] !== undefined) { bad[r][c] = true; bad[r][seen[v]] = true; } else seen[v] = c; } }
    for (c = 0; c < N; c++) { var seen2 = {}; for (r = 0; r < N; r++) { var v2 = G.values[r][c]; if (!v2) continue; if (seen2[v2] !== undefined) { bad[r][c] = true; bad[seen2[v2]][c] = true; } else seen2[v2] = r; } }
    for (i = 0; i < dec.cages.length; i++) {
      var cg = dec.cages[i]; if (cg.op === '=') continue;
      var filled = [], k, rem = 0;
      for (k = 0; k < cg.cells.length; k++) { var rc = cg.cells[k], vv = G.values[rc[0]][rc[1]]; if (vv) filled.push(vv); else rem++; }
      var impossible = false, j;
      if (rem === 0) {
        var val;
        if (cg.op === '+') { val = 0; for (j = 0; j < filled.length; j++) val += filled[j]; }
        else if (cg.op === '*') { val = 1; for (j = 0; j < filled.length; j++) val *= filled[j]; }
        else if (cg.op === '-') { val = Math.max.apply(null, filled) - Math.min.apply(null, filled); }
        else { val = Math.max.apply(null, filled) / Math.min.apply(null, filled); }
        if (val !== cg.target) impossible = true;
      } else {
        var s = 0, pr = 1; for (j = 0; j < filled.length; j++) { s += filled[j]; pr *= filled[j]; }
        if (cg.op === '+') { if (s + rem > cg.target || s + rem * N < cg.target) impossible = true; }
        else if (cg.op === '*') { if (pr > cg.target || cg.target % pr !== 0) impossible = true; }
      }
      if (impossible) for (k = 0; k < cg.cells.length; k++) { var rc2 = cg.cells[k]; if (G.values[rc2[0]][rc2[1]]) bad[rc2[0]][rc2[1]] = true; }
    }
    G.conflicts = bad;
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) G.cellEls[r][c].classList.toggle('conflict', bad[r][c]);
    return bad;
  }
  function hasNewRed(old, bad) {   // bad 中是否有格由「非红」变「红」
    if (!old) return false;
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (bad[r][c] && !(old[r] && old[r][c])) return true;
    return false;
  }
  function isComplete() {
    var r, c;
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) if (!G.values[r][c]) return false;
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) if (G.conflicts[r][c]) return false;
    return true;
  }

  /* ============ 选择 / 操作(无限撤销重做)============ */
  function selectCell(r, c) { if (!active) return; G.sel = { r: r, c: c }; renderHighlights(); }

  function snapshot(r, c) { return { r: r, c: c, v: G.values[r][c], n: noteList(G.notes[r][c]) }; }
  function pushHist(snap) { G.hist.push(snap); G.redo.length = 0; }
  function applyChange(r, c, fn) { var before = snapshot(r, c); fn(); pushHist(before); afterChange(); }
  function afterChange() {
    renderCell(G.sel.r, G.sel.c);
    var before = G.conflicts, bad = computeConflicts();
    updateRemaining(); renderHighlights();
    if (active && !G.solved && hasNewRed(before, bad)) registerWarning();  // 撤销/重做/装载不算
    saveGame();
    if (!G.solved && isComplete()) endGame();
  }
  function pressNum(v) {
    if (!active || !G.sel || G.solved) return;
    var r = G.sel.r, c = G.sel.c;
    if (G.cellEls[r][c].classList.contains('given')) return;
    if (G.mode === 'note') {
      if (G.values[r][c]) return;
      applyChange(r, c, function () { noteToggle(G.notes[r][c], v); });
    } else {
      applyChange(r, c, function () { if (G.values[r][c] === v) { G.values[r][c] = 0; } else { G.values[r][c] = v; noteClear(G.notes[r][c]); } });
    }
  }
  function delCell() {
    if (!active || !G.sel || G.solved) return;
    var r = G.sel.r, c = G.sel.c;
    if (G.cellEls[r][c].classList.contains('given')) return;
    if (!G.values[r][c] && noteEmpty(G.notes[r][c])) return;
    applyChange(r, c, function () { G.values[r][c] = 0; noteClear(G.notes[r][c]); });
  }
  function restoreSnap(snap) {
    G.values[snap.r][snap.c] = snap.v; G.notes[snap.r][snap.c] = noteFromList(snap.n);
    G.sel = { r: snap.r, c: snap.c };
    renderCell(snap.r, snap.c); computeConflicts(); updateRemaining(); renderHighlights(); saveGame();
  }
  function undo() { if (!G.hist.length) return; var snap = G.hist.pop(); G.redo.push(snapshot(snap.r, snap.c)); restoreSnap(snap); }
  function redo() { if (!G.redo.length) return; var snap = G.redo.pop(); G.hist.push(snapshot(snap.r, snap.c)); restoreSnap(snap); }
  function move(dr, dc) {
    if (!active) return;
    if (!G.sel) { selectCell(0, 0); return; }
    selectCell((G.sel.r + dr + N) % N, (G.sel.c + dc + N) % N);
  }
  function setMode(m) {
    G.mode = m; var on = m === 'note';
    modeBtn.classList.toggle('on', on); modeBtn.textContent = on ? '📝' : '✏️';  // 📝 / ✏️
    stageEl.classList.toggle('note', on); saveGame();
  }

  /* ============ 控制栏接线:run/pause/成绩/结束 ============ */
  function finalScore() { var BASE = (N <= 5 ? 600 : 3600); return Math.max(0, BASE - Math.round(totalMs() / 1000)); }
  function paintScore() {   // 对局中显失误数,通关后显最终分(成绩框 = 游戏输出口)
    if (!scoreEl) return;
    scoreEl.textContent = G.solved ? String(finalScore()) : ("✗ " + (G.mistakes || 0));
  }
  function onRun() { active = true; saveGame(); }                                       // ▶ 开始/继续(棋盘由 control 揭盖)
  function onPause() { active = false; G.sel = null; renderHighlights(); saveGame(); }  // ⏸/焦点丢失:屏蔽输入

  function endGame() {   // 通关 → 结束:禁用按钮 + stage 级分享结果
    if (ctl && ctl.phase() === 'ended') return;
    G.solved = true; active = false;
    paintScore(); saveGame();
    var sc = finalScore();
    var line = (L.game_share || "{nick} scored {score} in {game} # {code}")
      .replace("{nick}", FairPlay.getNickname()).replace("{score}", sc)
      .replace("{game}", (L.game_name || "MathDoku") + " " + dec.N).replace("{code}", seedParam.slice(-4));
    ctl.end("done", { title: L.md_win || "Solved!", shareText: (L.logo || "FairPlay") + "\n" + line });
  }

  /* ============ 装配 UI(时间/成绩在控制栏,开始/暂停遮盖由 control 统一)============ */
  function rulesText() {
    return (L.md_rules || "Fill the {N}×{N} grid with 1–{N}, no repeats in any row or column. Colored borders mark cages; the corner shows a target and operator to combine the cage's numbers into. Single given cells are locked. A number turns red only if it repeats in its row/column or its cage can no longer reach the target. Each warning adds penalty time. Fill the grid with no red to win.").replace(/\{N\}/g, N);
  }
  function buildUI() {
    stageEl = document.getElementById('mathdoku_stage');
    stageEl.innerHTML =
      '<div id="md_playzone">' +
        '<div id="md_board"></div>' +
        '<div id="md_input">' +
          '<div id="md_numpad"></div>' +
          '<div id="md_funcpad">' +
            '<button class="md_key md_fkey" id="md_mode" aria-label="' + esc(L.md_note || "Notes") + '">✏️</button>' +
            '<button class="md_key md_fkey" id="md_erase" aria-label="' + esc(L.md_erase || "Erase") + '">🗑️</button>' +
            '<button class="md_key md_fkey" id="md_undo" aria-label="' + esc(L.md_undo || "Undo") + '">↩️</button>' +
            '<button class="md_key md_fkey" id="md_redo" aria-label="' + esc(L.md_redo || "Redo") + '">↪️</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    boardEl = document.getElementById('md_board');
    numpadEl = document.getElementById('md_numpad');
    funcpadEl = document.getElementById('md_funcpad');
    modeBtn = document.getElementById('md_mode');
  }

  function bindEvents() {
    modeBtn.addEventListener('click', function () { setMode(G.mode === 'input' ? 'note' : 'input'); });
    document.getElementById('md_erase').addEventListener('click', delCell);
    document.getElementById('md_undo').addEventListener('click', undo);
    document.getElementById('md_redo').addEventListener('click', redo);

    document.addEventListener('keydown', function (e) {
      var t = e.target;   // 焦点在可编辑处时键盘留给它,不投给棋盘
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable || (t.closest && t.closest('[contenteditable="true"]')))) return;
      if (e.key >= '1' && e.key <= String(Math.min(9, N))) { pressNum(+e.key); e.preventDefault(); }
      else if (e.key === 'Backspace' || e.key === 'Delete') { delCell(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { move(-1, 0); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { move(1, 0); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { move(0, -1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { move(0, 1); e.preventDefault(); }
      else if (e.key === 'p' || e.key === 'P') { setMode(G.mode === 'input' ? 'note' : 'input'); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { if (e.shiftKey) redo(); else undo(); e.preventDefault(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { redo(); e.preventDefault(); }
    });
  }

  /* ============ 启动 ============ */
  function boot() {
    buildUI();
    var saved = loadSave();
    initState(saved);
    buildBoard(); buildNumpad(); renderAll();
    setMode(G.mode);
    bindEvents();
    ctl = window.FairPlay.control.init({    // 控制栏:时钟(续玩用 startElapsed)+ ▶/⏸ + 遮盖/结果
      stage: '#mathdoku_stage',
      rules: rulesText(),
      startElapsed: G.elapsedMs || 0,
      onRun: onRun, onPause: onPause
    });
    ctl.setTimer({ mode: "up" });   // 正计、无限(通关由游戏逻辑判;罚时走 addPenalty)
    scoreEl = document.getElementById('app_ctl_score');
    timeBox = document.getElementById('app_ctl_time');
    paintScore();
    if (G.solved) endGame();   // 已通关的存档 → 直接出结果(禁用按钮)
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
