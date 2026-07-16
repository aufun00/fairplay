/* FairPlay — mathdoku 邀请码编解码(从 mmDoku/_dev/core.mjs 移植,去 ES module、包进 IIFE)。
   模型:一致性靠「把幻方(拉丁方解)+ 笼形/运算 打进 param(ShareCode)」,不靠种子。
     encode(cfg="N,difficulty"):freshSeed 造 rng → generate 造题 → encodeShareCode 打包。种子一次性、每次不同、不存。
     decode(param):decodeShareCode 纯整数还原 { N, difficulty, solution, cages };非法/校验不过 → null。
   注:colorCages/decompose 属渲染/提示,做游戏本体那步再补,这里只管编解码 + 造题。 */
(function () {
  "use strict";

  /* ---- 每次 encode 的一次性随机种子(优先真随机,保证每次不同)---- */
  function freshSeed() {
    if (self.crypto && self.crypto.getRandomValues) return self.crypto.getRandomValues(new Uint32Array(1))[0];
    return (Math.random() * 0x100000000) >>> 0;   // 兜底
  }

  /* ============ RNG (mulberry32) ============ */
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(rng, n) { return Math.floor(rng() * n); }
  function shuffle(rng, arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randInt(rng, i + 1);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function wpick(rng, weights) {
    var entries = Object.entries(weights);
    var tot = 0, i;
    for (i = 0; i < entries.length; i++) tot += entries[i][1];
    var x = rng() * tot;
    for (i = 0; i < entries.length; i++) { x -= entries[i][1]; if (x < 0) return entries[i][0]; }
    return entries[entries.length - 1][0];
  }

  /* ============ LatinSquare (随机拉丁方,回溯 + 随机候选) ============ */
  function latinSquare(N, rng) {
    var g = Array.from({ length: N }, function () { return Array(N).fill(0); });
    var rowU = Array(N).fill(0), colU = Array(N).fill(0);
    function bt(pos) {
      if (pos === N * N) return true;
      var r = (pos / N) | 0, c = pos % N;
      var cand = [];
      for (var v = 1; v <= N; v++) { var b = 1 << v; if (!(rowU[r] & b) && !(colU[c] & b)) cand.push(v); }
      shuffle(rng, cand);
      for (var k = 0; k < cand.length; k++) {
        var vv = cand[k], bb = 1 << vv;
        g[r][c] = vv; rowU[r] |= bb; colU[c] |= bb;
        if (bt(pos + 1)) return true;
        rowU[r] &= ~bb; colU[c] &= ~bb;
      }
      g[r][c] = 0; return false;
    }
    bt(0);
    return g;
  }

  /* ============ Solver (回溯数解个数) ============
     cages: [{cells:[[r,c],...], op:'='|'+'|'-'|'*'|'/', target}] */
  function countSolutions(N, cages, limit) {
    limit = limit || 2;
    var cellCage = Array.from({ length: N }, function () { return Array(N).fill(-1); });
    cages.forEach(function (cg, i) { cg.cells.forEach(function (rc) { cellCage[rc[0]][rc[1]] = i; }); });
    var rowU = Array(N).fill(0), colU = Array(N).fill(0);
    var cnt = cages.map(function () { return 0; }), sum = cages.map(function () { return 0; }),
        prod = cages.map(function () { return 1; }), vals = cages.map(function () { return []; });
    var count = 0;

    function feasible(ci) {
      var cg = cages[ci];
      if (cg.op === '=') return true;
      var full = cnt[ci] === cg.cells.length;
      var remaining = cg.cells.length - cnt[ci];
      if (full) {
        if (cg.op === '+') return sum[ci] === cg.target;
        if (cg.op === '*') return prod[ci] === cg.target;
        if (cg.op === '-') return Math.abs(vals[ci][0] - vals[ci][1]) === cg.target;
        if (cg.op === '/') { var a = vals[ci][0], b = vals[ci][1]; return a === b * cg.target || b === a * cg.target; }
      } else {
        if (cg.op === '+') { if (sum[ci] + remaining > cg.target) return false; if (sum[ci] + remaining * N < cg.target) return false; }
        if (cg.op === '*') { if (cg.target % prod[ci] !== 0) return false; if (prod[ci] > cg.target) return false; }
      }
      return true;
    }
    function bt(pos) {
      if (count >= limit) return;
      if (pos === N * N) { count++; return; }
      var r = (pos / N) | 0, c = pos % N, ci = cellCage[r][c], cg = cages[ci];
      for (var v = 1; v <= N; v++) {
        var b = 1 << v;
        if ((rowU[r] & b) || (colU[c] & b)) continue;
        if (cg.op === '=' && v !== cg.target) continue;
        rowU[r] |= b; colU[c] |= b;
        cnt[ci]++; sum[ci] += v; prod[ci] *= v; vals[ci].push(v);
        if (feasible(ci)) bt(pos + 1);
        cnt[ci]--; sum[ci] -= v; prod[ci] /= v; vals[ci].pop();
        rowU[r] &= ~b; colU[c] &= ~b;
        if (count >= limit) return;
      }
    }
    bt(0);
    return count;
  }

  /* ============ Generator ============ */
  var DIFF = {
    1: { sizes: { 1: 3, 2: 5 }, ops2: { '+': 4, '-': 4 }, opsM: { '+': 1 } },
    2: { sizes: { 1: 2, 2: 5, 3: 2 }, ops2: { '+': 4, '-': 3, '*': 1 }, opsM: { '+': 2, '*': 1 } },
    3: { sizes: { 1: 1, 2: 4, 3: 3 }, ops2: { '+': 3, '-': 3, '*': 3, '/': 2 }, opsM: { '+': 2, '*': 2 } },
    4: { sizes: { 1: 1, 2: 3, 3: 3, 4: 2 }, ops2: { '+': 2, '-': 2, '*': 3, '/': 3 }, opsM: { '+': 1, '*': 2 } },
    5: { sizes: { 2: 2, 3: 4, 4: 3 }, ops2: { '+': 1, '-': 1, '*': 4, '/': 3 }, opsM: { '+': 1, '*': 3 } }
  };

  function partition(N, rng, sizeWeights) {
    var assigned = Array.from({ length: N }, function () { return Array(N).fill(false); });
    var unassigned = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) unassigned.push([r, c]);
    var cages = [];
    var nbr = function (rc) {
      var a = rc[0], b = rc[1];
      return [[a - 1, b], [a + 1, b], [a, b - 1], [a, b + 1]].filter(function (p) { return p[0] >= 0 && p[0] < N && p[1] >= 0 && p[1] < N; });
    };
    while (unassigned.length) {
      var si = randInt(rng, unassigned.length);
      var seed = unassigned[si];
      var target = parseInt(wpick(rng, sizeWeights), 10);
      target = Math.min(target, unassigned.length);
      var region = [seed];
      var inRegion = new Set([seed[0] * N + seed[1]]);
      assigned[seed[0]][seed[1]] = true;
      var frontier = nbr(seed).filter(function (p) { return !assigned[p[0]][p[1]]; });
      while (region.length < target && frontier.length) {
        var fi = randInt(rng, frontier.length);
        var pick = frontier.splice(fi, 1)[0], a = pick[0], b = pick[1];
        if (assigned[a][b]) continue;
        assigned[a][b] = true;
        region.push([a, b]); inRegion.add(a * N + b);
        nbr([a, b]).forEach(function (xy) { if (!assigned[xy[0]][xy[1]] && !inRegion.has(xy[0] * N + xy[1])) frontier.push(xy); });
      }
      cages.push(region);
      for (var k = unassigned.length - 1; k >= 0; k--) if (assigned[unassigned[k][0]][unassigned[k][1]]) unassigned.splice(k, 1);
    }
    return cages;
  }

  function anchorOf(cells, N) {
    return cells.reduce(function (m, rc) { return Math.min(m, rc[0] * N + rc[1]); }, Infinity);
  }

  function assignCage(cells, solution, rng, diff, N) {
    var vals = cells.map(function (rc) { return solution[rc[0]][rc[1]]; });
    var anchor = anchorOf(cells, N);
    if (cells.length === 1) return { cells: cells, op: '=', target: vals[0], anchor: anchor };
    if (cells.length === 2) {
      var a = vals[0], b = vals[1], hi = Math.max(a, b), lo = Math.min(a, b);
      var allowed = {};
      Object.entries(diff.ops2).forEach(function (ow) {
        var op = ow[0], w = ow[1];
        if (op === '/' && hi % lo !== 0) return;
        allowed[op] = w;
      });
      if (!Object.keys(allowed).length) allowed['+'] = 1;
      var op2 = wpick(rng, allowed), target2;
      if (op2 === '+') target2 = a + b;
      else if (op2 === '-') target2 = hi - lo;
      else if (op2 === '*') target2 = a * b;
      else target2 = hi / lo;
      return { cells: cells, op: op2, target: target2, anchor: anchor };
    }
    var op = wpick(rng, diff.opsM);
    var target = op === '+' ? vals.reduce(function (s, v) { return s + v; }, 0) : vals.reduce(function (s, v) { return s * v; }, 1);
    return { cells: cells, op: op, target: target, anchor: anchor };
  }

  function buildCages(N, solution, rng, diff) {
    var regions = partition(N, rng, diff.sizes);
    return regions.map(function (cells) { return assignCage(cells, solution, rng, diff, N); });
  }

  function isConnected(cells, N) {
    if (cells.length <= 1) return true;
    var set = new Set(cells.map(function (rc) { return rc[0] * N + rc[1]; }));
    var seen = new Set();
    var stack = [cells[0]];
    seen.add(cells[0][0] * N + cells[0][1]);
    while (stack.length) {
      var rc = stack.pop(), r = rc[0], c = rc[1];
      [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(function (p) {
        var k = p[0] * N + p[1];
        if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push(p); }
      });
    }
    return seen.size === cells.length;
  }

  /* 把某个多格笼子拆出一格成单格笼(保证唯一性的兜底) */
  function splitOne(cages, solution, N, rng) {
    var multi = cages.map(function (c, i) { return [c, i]; }).filter(function (ci) { return ci[0].cells.length > 1; });
    if (!multi.length) return false;
    var chosen = multi[randInt(rng, multi.length)], cage = chosen[0], idx = chosen[1];
    var cell = cage.cells[randInt(rng, cage.cells.length)];
    var rest = cage.cells.filter(function (c) { return !(c[0] === cell[0] && c[1] === cell[1]); });
    if (!isConnected(rest, N)) return splitOne(cages, solution, N, rng);
    var r = cell[0], c = cell[1];
    cages[idx] = assignCage(rest, solution, rng, DIFF[3], N);
    cages.push({ cells: [cell], op: '=', target: solution[r][c], anchor: anchorOf([cell], N) });
    return true;
  }

  function generate(N, difficulty, rng, opts) {
    opts = opts || {};
    var diff = DIFF[difficulty] || DIFF[3];
    var maxAttempts = opts.maxAttempts || 300;
    var solution = latinSquare(N, rng);
    var cages = null;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0 && attempt % 25 === 0) solution = latinSquare(N, rng);
      cages = buildCages(N, solution, rng, diff);
      if (countSolutions(N, cages, 2) === 1) return { N: N, difficulty: difficulty, solution: solution, cages: cages };
    }
    var guard = 0;
    while (countSolutions(N, cages, 2) !== 1 && guard++ < N * N) {
      if (!splitOne(cages, solution, N, rng)) break;
    }
    return { N: N, difficulty: difficulty, solution: solution, cages: cages };
  }

  /* ============ ShareCode (版本化编码表 + 打包解棋盘/笼子) ============ */
  var ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz_=+^$!()';
  var VERSION = 1;
  var OPS2 = ['+', '-', '*', '/'];
  var FACT = (function () { var f = [1]; for (var i = 1; i <= 12; i++) f[i] = f[i - 1] * i; return f; })();

  function bitsForCount(count) { return count <= 1 ? 0 : Math.ceil(Math.log2(count)); }
  function rankPerm(arr) {
    var avail = Array.from({ length: arr.length }, function (_, i) { return i + 1; });
    var rank = 0;
    for (var i = 0; i < arr.length; i++) {
      var idx = avail.indexOf(arr[i]);
      rank = rank * avail.length + idx;
      avail.splice(idx, 1);
    }
    return rank;
  }
  function unrankPerm(rank, N) {
    var avail = Array.from({ length: N }, function (_, i) { return i + 1; });
    var res = [];
    for (var i = 0; i < N; i++) {
      var f = FACT[N - 1 - i];
      var idx = Math.floor(rank / f); rank %= f;
      res.push(avail.splice(idx, 1)[0]);
    }
    return res;
  }

  function BitWriter() { this.bits = []; }
  BitWriter.prototype.write = function (value, n) { for (var i = n - 1; i >= 0; i--) this.bits.push((value >> i) & 1); };
  BitWriter.prototype.toChars = function () {
    var out = [];
    for (var i = 0; i < this.bits.length; i += 6) {
      var v = 0;
      for (var j = 0; j < 6; j++) v = (v << 1) | (this.bits[i + j] || 0);
      out.push(ALPHABET[v]);
    }
    return out.join('');
  };
  function BitReader(chars) {
    this.bits = [];
    for (var idx = 0; idx < chars.length; idx++) {
      var v = ALPHABET.indexOf(chars[idx]);
      for (var j = 5; j >= 0; j--) this.bits.push((v >> j) & 1);
    }
    this.pos = 0;
  }
  BitReader.prototype.read = function (n) { var v = 0; for (var i = 0; i < n; i++) v = (v << 1) | (this.bits[this.pos++] || 0); return v; };

  function cellCageGrid(N, cages) {
    var g = Array.from({ length: N }, function () { return Array(N).fill(-1); });
    cages.forEach(function (cg, i) { cg.cells.forEach(function (rc) { g[rc[0]][rc[1]] = i; }); });
    return g;
  }
  function checksumChar(s) {
    var sum = 0;
    for (var i = 0; i < s.length; i++) sum = (sum + ALPHABET.indexOf(s[i])) % 64;
    return ALPHABET[sum];
  }

  function encodeShareCode(puzzle) {
    var N = puzzle.N, difficulty = puzzle.difficulty, solution = puzzle.solution, cages = puzzle.cages;
    var w = new BitWriter();
    w.write(N, 4);
    w.write(difficulty, 3);
    var cg = cellCageGrid(N, cages);
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      if (c < N - 1) w.write(cg[r][c] === cg[r][c + 1] ? 1 : 0, 1);
      if (r < N - 1) w.write(cg[r][c] === cg[r + 1][c] ? 1 : 0, 1);
    }
    var sorted = cages.slice().sort(function (a, b) { return a.anchor - b.anchor; });
    sorted.forEach(function (cage) {
      var sz = cage.cells.length;
      if (sz === 1) return;
      if (sz === 2) w.write(OPS2.indexOf(cage.op), 2);
      else w.write(cage.op === '+' ? 0 : 1, 1);
    });
    var solBits = bitsForCount(FACT[N]);
    for (var rr = 0; rr < N; rr++) w.write(rankPerm(solution[rr]), solBits);
    var payload = w.toChars();
    var head = ALPHABET[VERSION] + payload;
    return head + checksumChar(head);
  }

  function UF(n) { this.p = Array.from({ length: n }, function (_, i) { return i; }); }
  UF.prototype.find = function (x) { while (this.p[x] !== x) { this.p[x] = this.p[this.p[x]]; x = this.p[x]; } return x; };
  UF.prototype.union = function (a, b) { this.p[this.find(a)] = this.find(b); };

  function decodeShareCode(code) {
    if (typeof code !== 'string' || code.length < 3) throw new Error('交换码无效');
    for (var i = 0; i < code.length; i++) if (ALPHABET.indexOf(code[i]) < 0) throw new Error('交换码无效');
    var head = code.slice(0, -1);
    if (checksumChar(head) !== code[code.length - 1]) throw new Error('交换码无效');
    var version = ALPHABET.indexOf(code[0]);
    if (version !== VERSION) throw new Error('交换码版本不支持');
    var r = new BitReader(head.slice(1));
    var N = r.read(4);
    if (N < 3 || N > 9) throw new Error('交换码无效');
    var difficulty = r.read(3);
    var uf = new UF(N * N);
    for (var rr = 0; rr < N; rr++) for (var c = 0; c < N; c++) {
      if (c < N - 1) { if (r.read(1)) uf.union(rr * N + c, rr * N + c + 1); }
      if (rr < N - 1) { if (r.read(1)) uf.union(rr * N + c, (rr + 1) * N + c); }
    }
    var groups = new Map();
    for (var r2 = 0; r2 < N; r2++) for (var c2 = 0; c2 < N; c2++) {
      var root = uf.find(r2 * N + c2);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push([r2, c2]);
    }
    var cages = Array.from(groups.values()).map(function (cells) { return { cells: cells, anchor: anchorOf(cells, N) }; });
    cages.sort(function (a, b) { return a.anchor - b.anchor; });
    cages.forEach(function (cage) {
      var sz = cage.cells.length;
      if (sz === 1) cage.op = '=';
      else if (sz === 2) cage.op = OPS2[r.read(2)];
      else cage.op = r.read(1) ? '*' : '+';
    });
    var solBits = bitsForCount(FACT[N]);
    var solution = [];
    for (var r3 = 0; r3 < N; r3++) solution.push(unrankPerm(r.read(solBits), N));
    cages.forEach(function (cage) {
      var vs = cage.cells.map(function (rc) { return solution[rc[0]][rc[1]]; });
      if (cage.op === '=') cage.target = vs[0];
      else if (cage.op === '+') cage.target = vs.reduce(function (s, v) { return s + v; }, 0);
      else if (cage.op === '*') cage.target = vs.reduce(function (s, v) { return s * v; }, 1);
      else if (cage.op === '-') cage.target = Math.max.apply(null, vs) - Math.min.apply(null, vs);
      else cage.target = Math.max.apply(null, vs) / Math.min.apply(null, vs);
    });
    return { N: N, difficulty: difficulty, solution: solution, cages: cages };
  }

  /* ---- FairPlay codec ---- */
  window.FAIRPLAY_CODECS = window.FAIRPLAY_CODECS || {};
  window.FAIRPLAY_CODECS.mathdoku = {
    encode: function (cfg) {
      var parts = String(cfg == null ? "" : cfg).split(",");
      var N = parseInt(parts[0], 10) || 5;
      var difficulty = parseInt(parts[1], 10) || 3;
      var puzzle = generate(N, difficulty, makeRng(freshSeed()));
      return encodeShareCode(puzzle);
    },
    decode: function (param) {
      try { return decodeShareCode(param); } catch (e) { return null; }
    }
  };
})();
