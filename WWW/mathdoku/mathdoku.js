/* FairPlay — mathdoku 游戏本体(从 mmDoku/docs/index.html 的游戏区移植,去 QR/ExCode/相机/复制粘贴/辅助区/自动新局)。
   种子来自 ?p=<param>(对手同题复现)。gamepage 只能凭邀请码进:无 ?p / 校验不过 = 回主页。
   计时:performance.now 净时钟(切后台停表);罚时另计,总用时 = 净时钟 + 罚时。
   Phase A:仅核心对弈,不含 9×9 笼分解助手(💡)。 */
(function () {
  "use strict";

  var codec = window.FAIRPLAY_CODECS && window.FAIRPLAY_CODECS.mathdoku;
  var L = (window.FairPlay && FairPlay.L()) || (window.I18N && window.I18N.en) || {};

  /* ---- 取种子:无 ?p / 解码失败 → 回主页。N(尺寸)来自 cfg(?c=N,难度),不在码里 ---- */
  var q = new URLSearchParams(location.search);
  var p = q.get("p");
  var N = parseInt((q.get("c") || "").split(",")[0], 10);
  var dec = (p && codec && N >= 3 && N <= 9) ? codec.decode(p, N) : null;
  if (!dec) { location.replace("../"); return; }
  var seedParam = p;

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
  /* 辅助区(分解助手):桌面侧栏,够宽才有;仅 9×9。 */
  var AUX_W = 340, auxEl = null, auxBtn = null, auxOpen = false;
  var AX = { cages: {}, segments: [], notes: '', curCage: -1, sel: null };   // 分解助手状态(随本局存)
  var auxValueEl, auxCountEl, auxExecEl, auxMaskEl, auxDecompEl, auxNotesEl;

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
        mistakes: G.mistakes, solved: G.solved, auxOpen: auxOpen,
        aux: auxEl ? auxSerialize() : null
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
  function selectCell(r, c) {
    if (!active) return;
    G.sel = { r: r, c: c };
    if (auxEl && AX.sel) { AX.sel = null; auxApplySel(); }   // 点棋盘 → 取消结果区选中(清笼花纹)
    renderHighlights();
    if (auxEl) auxOnSelect();                                 // 刷新辅助区控制区(回填当前笼)
  }

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

  /* ============ 辅助区(分解助手)—— 桌面右侧栏,够宽才有;9×9 专属。此步:壳 + 💡 宽度门,step2 灌逻辑 ============ */
  function frameW() { return Math.min(window.innerWidth, window.innerHeight / 1.8); }
  function auxAvailable() { return N === 9 && window.innerWidth >= frameW() + AUX_W + 16; }   // 放得下 画框 + 辅助区
  function buildAux(savedAux) {
    auxEl = document.createElement('div');
    auxEl.id = 'app_aux'; auxEl.hidden = true;
    auxEl.innerHTML =
      '<div id="aux-decomp"></div>' +
      '<div id="aux-ctrl">' +
        '<div id="aux-left">' +
          '<div id="aux-top">' +
            '<input id="aux-value" type="number" inputmode="numeric" aria-label="value">' +
            '<select id="aux-count" aria-label="count"></select>' +
            '<button id="aux-exec">×</button>' +
          '</div>' +
          '<div id="aux-mask"></div>' +
        '</div>' +
        '<button id="aux-strike" aria-label="strike"><span class="aux-strike-g">S</span></button>' +
      '</div>' +
      '<div id="aux-notes" contenteditable="true" spellcheck="false"></div>';
    document.body.appendChild(auxEl);
    auxValueEl = document.getElementById('aux-value'); auxCountEl = document.getElementById('aux-count');
    auxExecEl = document.getElementById('aux-exec'); auxMaskEl = document.getElementById('aux-mask');
    auxDecompEl = document.getElementById('aux-decomp'); auxNotesEl = document.getElementById('aux-notes');
    auxMaskEl.style.gridTemplateColumns = 'repeat(' + N + ',1fr)';   // 1..N 屏蔽格
    for (var v = 1; v <= N; v++) {
      (function (v) {
        var b = document.createElement('button'); b.textContent = v; b.setAttribute('data-v', v);
        b.addEventListener('pointerdown', function (e) { e.preventDefault(); auxToggleMask(v); });
        auxMaskEl.appendChild(b);
      })(v);
    }
    auxExecEl.onclick = auxExec;
    auxValueEl.addEventListener('input', function () { var idx = AX.curCage; if (idx >= 0) { var v = parseInt(auxValueEl.value, 10); auxCage(idx).value = isFinite(v) ? v : null; saveGame(); } });
    auxCountEl.addEventListener('change', function () { var idx = AX.curCage; if (idx >= 0) { auxCage(idx).count = +auxCountEl.value; saveGame(); } });
    document.getElementById('aux-strike').addEventListener('pointerdown', function (e) { e.preventDefault(); auxNoteStrike(); });
    auxNotesEl.addEventListener('input', function () { AX.notes = auxNotesEl.innerHTML; saveGame(); });
    auxInitState(savedAux);
    auxNotesEl.innerHTML = AX.notes || '';
    auxRenderResult();
  }

  /* ---- 分解助手逻辑(从 mmDoku 忠实移植;以 Cage 为单位,随本局存)---- */
  function auxCage(idx) { if (!AX.cages[idx]) AX.cages[idx] = { masked: [], value: null, count: null }; return AX.cages[idx]; }
  function auxCurIdx() { if (!G.sel) return -1; var idx = G.cellCage[G.sel.r][G.sel.c]; return dec.cages[idx].op === '=' ? -2 : idx; }   // -2 单格笼,-1 无
  function auxOnSelect() { if (!auxOpen) return; AX.curCage = auxCurIdx(); auxRenderCtrl(); }   // 结果区不随选格变,只刷新控制区回填
  function auxRenderCtrl() {
    var idx = AX.curCage, val = auxValueEl, cnt = auxCountEl, ex = auxExecEl;
    var masks = auxMaskEl.querySelectorAll('button');
    if (idx < 0) {
      val.value = ''; val.disabled = true; cnt.innerHTML = ''; cnt.disabled = true; ex.disabled = true; ex.textContent = '—';
      masks.forEach(function (b) { b.classList.remove('masked'); b.disabled = true; }); return;
    }
    var cg = dec.cages[idx], st = auxCage(idx), op = cg.op, nCells = cg.cells.length, twoOnly = (op === '-' || op === '/');
    val.disabled = false; ex.disabled = false; ex.textContent = OP_SYM[op] || '?';
    val.value = (st.value == null ? cg.target : st.value);
    cnt.innerHTML = ''; var hi = twoOnly ? 2 : nCells;
    for (var k = 2; k <= hi; k++) { var o = document.createElement('option'); o.value = k; o.textContent = k; cnt.appendChild(o); }
    var cv = (st.count == null ? (twoOnly ? 2 : nCells) : st.count); cv = Math.max(2, Math.min(hi, cv)); cnt.value = String(cv); cnt.disabled = twoOnly;
    masks.forEach(function (b) { var v = +b.getAttribute('data-v'); b.disabled = false; b.classList.toggle('masked', st.masked.indexOf(v) >= 0); });
  }
  function auxFmt(op, r, value) {
    if (op === '*') return r.join('×') + 'Σ' + r.reduce(function (a, b) { return a + b; }, 0);
    if (op === '+') return r.join('+') + '=' + value;
    if (op === '-') return r[0] + '−' + r[1] + '=' + value;
    return r[0] + '÷' + r[1] + '=' + value;
  }
  function auxAnchor(ci) { var cells = dec.cages[ci].cells, b = cells[0]; for (var i = 0; i < cells.length; i++) { var cc = cells[i]; if (cc[0] < b[0] || (cc[0] === b[0] && cc[1] < b[1])) b = cc; } return b; }
  function auxIdxLabel(ci) { var a = auxAnchor(ci); return String.fromCharCode(65 + a[1]) + (a[0] + 1); }   // 字母=列、数字=行
  function auxIsSel(si, row) { return !!AX.sel && AX.sel.seg === si && AX.sel.row === row; }
  function auxUpdateLinked() {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) G.cellEls[r][c].classList.remove('cage-linked');
    if (AX.sel) { var ci = AX.segments[AX.sel.seg].cageIdx; dec.cages[ci].cells.forEach(function (rc) { G.cellEls[rc[0]][rc[1]].classList.add('cage-linked'); }); }
  }
  function auxSegBtn(txt, disabled, fn) {
    var b = document.createElement('button'); b.className = 'seg-btn'; b.textContent = txt;
    if (disabled) b.disabled = true; else b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    return b;
  }
  function auxRowBtns(si, row) {
    var g = document.createElement('span'); g.className = 'seg-btns';
    if (row === -1) g.append(auxSegBtn('🔼', si === 0, function () { auxMoveSeg(si, -1); }), auxSegBtn('🔽', si === AX.segments.length - 1, function () { auxMoveSeg(si, 1); }), auxSegBtn('🗑️', false, function () { auxDelSeg(si); }));
    else g.appendChild(auxSegBtn('🗑️', false, function () { auxDelRow(si, row); }));
    return g;
  }
  function auxApplySel() {   // 就地更新选中(不重建 DOM,保住结果行 dblclick)
    var box = auxDecompEl;
    box.querySelectorAll('.sel').forEach(function (el) { el.classList.remove('sel'); var g = el.querySelector('.seg-btns'); if (g) g.remove(); });
    var s = AX.sel;
    if (s) { var el = box.querySelector('[data-seg="' + s.seg + '"][data-row="' + s.row + '"]'); if (el) { el.classList.add('sel'); el.appendChild(auxRowBtns(s.seg, s.row)); } }
    auxUpdateLinked();
  }
  function auxToggleSel(si, row) { AX.sel = auxIsSel(si, row) ? null : { seg: si, row: row }; auxApplySel(); saveGame(); }
  function auxMoveSeg(si, dir) { var j = si + dir, segs = AX.segments; if (j < 0 || j >= segs.length) return; var t = segs[si]; segs[si] = segs[j]; segs[j] = t; AX.sel = { seg: j, row: -1 }; auxRenderResult(); saveGame(); }
  function auxDelSeg(si) { AX.segments.splice(si, 1); AX.sel = null; auxRenderResult(); saveGame(); }
  function auxDelRow(si, ri) { var sg = AX.segments[si]; sg.results.splice(ri, 1); sg.struck = sg.struck.filter(function (x) { return x !== ri; }).map(function (x) { return x > ri ? x - 1 : x; }); AX.sel = null; auxRenderResult(); saveGame(); }
  function auxToggleStruck(si, ri) { var sg = AX.segments[si]; var p = sg.struck.indexOf(ri); if (p < 0) sg.struck.push(ri); else sg.struck.splice(p, 1); auxRenderResult(); saveGame(); }
  function auxRenderResult() {
    var box = auxDecompEl; box.innerHTML = ''; var segs = AX.segments;
    if (!segs.length) { box.innerHTML = '<div class="aux-hint">' + esc(L.md_aux_hint || "Pick a cell, then decompose in the panel below — results collect here.") + '</div>'; auxUpdateLinked(); return; }
    segs.forEach(function (sg, si) {
      var wrap = document.createElement('div'); wrap.className = 'seg';
      var h = document.createElement('div'); h.className = 'seg-h'; h.setAttribute('data-seg', si); h.setAttribute('data-row', -1);
      var cgi = dec.cages[sg.cageIdx];
      var hi = document.createElement('span'); hi.className = 'seg-h-txt';
      hi.textContent = auxIdxLabel(sg.cageIdx) + ' · ' + cgi.target + (OP_SYM[sg.op] || '') + ' · ' + sg.value + ' ×' + sg.count; h.appendChild(hi);
      h.addEventListener('click', function () { auxToggleSel(si, -1); }); wrap.appendChild(h);
      if (!sg.results.length) { var e = document.createElement('div'); e.className = 'aux-empty'; e.textContent = (L.md_aux_none || "no solution"); wrap.appendChild(e); }
      else sg.results.forEach(function (r, ri) {
        var d = document.createElement('div'); d.className = 'ln' + (sg.struck.indexOf(ri) >= 0 ? ' struck' : ''); d.setAttribute('data-seg', si); d.setAttribute('data-row', ri);
        var tx = document.createElement('span'); tx.className = 'ln-txt'; tx.textContent = auxFmt(sg.op, r, sg.value); d.appendChild(tx);
        d.addEventListener('click', function () { auxToggleSel(si, ri); }); d.addEventListener('dblclick', function () { auxToggleStruck(si, ri); }); wrap.appendChild(d);
      });
      box.appendChild(wrap);
    });
    auxApplySel();
  }
  function auxToggleMask(v) {
    var idx = AX.curCage; if (idx < 0) return; var st = auxCage(idx); var p = st.masked.indexOf(v);
    if (p < 0) st.masked.push(v); else st.masked.splice(p, 1);
    var b = auxMaskEl.querySelector('button[data-v="' + v + '"]'); if (b) b.classList.toggle('masked'); saveGame();   // 只影响下次分解,不动历史段
  }
  /* 分解器(从 core.mjs 移植):op×÷ 两数、+* 非减多重集;masked 排除、maxV=N */
  function decompose(op, value, count, masked, maxV) {
    maxV = maxV || 9;
    var mset = {}, mi; if (masked) for (mi = 0; mi < masked.length; mi++) mset[masked[mi]] = 1;
    var allowed = [], v; for (v = 1; v <= maxV; v++) if (!mset[v]) allowed.push(v);
    var out = [], a, b, big, small;
    if (op === '-') {
      for (a = 0; a < allowed.length; a++) for (b = 0; b < allowed.length; b++) { big = allowed[a]; small = allowed[b]; if (big > small && big - small === value) out.push([big, small]); }
      return out;
    }
    if (op === '/') {
      for (a = 0; a < allowed.length; a++) for (b = 0; b < allowed.length; b++) { big = allowed[a]; small = allowed[b]; if (big === small * value) out.push([big, small]); }
      return out;
    }
    var add = op === '+';
    function rec(startIdx, remain, acc, cur) {
      if (remain === 0) { if (cur === value) out.push(acc.slice()); return; }
      for (var i = startIdx; i < allowed.length; i++) {
        var vv = allowed[i], nv = add ? cur + vv : cur * vv;
        if (nv > value) break;
        acc.push(vv); rec(i, remain - 1, acc, nv); acc.pop();
      }
    }
    rec(0, count, [], add ? 0 : 1);
    return out;
  }
  function auxExec() {
    var idx = AX.curCage; if (idx < 0) return; var cg = dec.cages[idx], st = auxCage(idx);
    var value = parseInt(auxValueEl.value, 10), count = parseInt(auxCountEl.value, 10);
    if (!isFinite(value) || value < 1) return;
    st.value = value; st.count = count;
    var results = decompose(cg.op, value, count, st.masked, N);
    AX.segments.push({ cageIdx: idx, op: cg.op, value: value, count: count, results: results, struck: [] });   // 追加到尾部
    auxRenderResult(); saveGame();
  }
  function noteFirstStruck() {
    var sel = window.getSelection(); if (!sel.rangeCount) return false; var r = sel.getRangeAt(0); var node = r.startContainer; var el = node.nodeType === 3 ? node.parentElement : node;
    while (el && el !== auxNotesEl) { if (/^(S|STRIKE|DEL)$/.test(el.tagName)) return true; var td = (getComputedStyle(el).textDecorationLine || getComputedStyle(el).textDecoration || ''); if (td.indexOf('line-through') >= 0) return true; el = el.parentElement; }
    return false;
  }
  function auxNoteStrike() {
    var sel = window.getSelection(); if (!sel.rangeCount || sel.isCollapsed) return;
    var want = !noteFirstStruck(); document.execCommand('strikeThrough'); if (document.queryCommandState('strikeThrough') !== want) document.execCommand('strikeThrough');
    AX.notes = auxNotesEl.innerHTML; saveGame();
  }
  function auxSerialize() {
    var cages = {}; for (var k in AX.cages) { var c = AX.cages[k]; cages[k] = { masked: c.masked, value: c.value, count: c.count }; }
    var segments = AX.segments.map(function (s) { return { cageIdx: s.cageIdx, op: s.op, value: s.value, count: s.count, results: s.results, struck: s.struck }; });
    return { cages: cages, segments: segments, notes: AX.notes };
  }
  function auxInitState(a) {
    AX = { cages: {}, segments: [], notes: '', curCage: -1, sel: null };
    if (a) {
      AX.notes = a.notes || '';
      for (var k in (a.cages || {})) { var c = a.cages[k]; AX.cages[k] = { masked: c.masked || [], value: (c.value == null ? null : c.value), count: (c.count == null ? null : c.count) }; }
      if (Array.isArray(a.segments)) AX.segments = a.segments.map(function (s) { return { cageIdx: s.cageIdx, op: s.op, value: s.value, count: s.count, results: (s.results || []).map(function (r) { return r.slice(); }), struck: (s.struck || []).slice() }; });
    }
  }

  function applyAux() {
    var open = auxOpen && auxAvailable();
    if (auxEl) auxEl.hidden = !open;
    document.body.classList.toggle('aux-open', open);
    if (auxBtn) auxBtn.classList.toggle('on', open);
  }
  function toggleAux() { auxOpen = !auxOpen; applyAux(); saveGame(); }
  function refreshAux() { if (auxBtn) auxBtn.hidden = !auxAvailable(); applyAux(); }   // 窗口变窄:藏 💡 + 收面板

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
    ctl.end("done", { title: L.md_win || "Solved!", gameName: (L.game_name || "MathDoku") + " " + N, score: finalScore() });
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
            (N === 9 ? '<span class="md_key blank"></span><button class="md_key md_fkey" id="md_aux" aria-label="' + esc(L.md_aux || "Helper") + '">💡</button>' : '') +   // 第3行第2列:弹出/收回辅助区
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
    if (document.getElementById('md_aux')) document.getElementById('md_aux').addEventListener('click', toggleAux);
    window.addEventListener('resize', refreshAux);

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
    auxOpen = !!(saved && saved.auxOpen);
    if (N === 9) {                          // 辅助区仅 9×9
      buildAux(saved && saved.aux);
      auxBtn = document.getElementById('md_aux');
      refreshAux();                         // 按宽度显/隐 💡 + 应用存档的开合
    }
    paintScore();
    if (G.solved) endGame();   // 已通关的存档 → 直接出结果(禁用按钮)
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
