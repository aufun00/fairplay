/* FairPlay QR 库 —— 自包含、零依赖的二维码编解码器 + canvas 渲染。
   源自 mmDoku/_dev/qr.mjs(经测试与线上验证),移植为浏览器全局 window.FairPlay.QR:
     encode(text,{ecc})      -> { size, modules }   (生成)
     toCanvas(text,{ecc,...}) -> <canvas>            (生成并渲染:quiet zone、白底黑块)
     decodeMatrix(modules)    -> string              (从理想 0/1 矩阵解码)
     decodeImage(gray,w,h)    -> string|null         (从灰度图扫码,best-effort)
   —— 本轮只接生成(toCanvas);扫码留待相机功能。 */
(function () {
// qr.mjs — self-contained, dependency-free QR code codec (byte mode, versions 1..10).
//
// Exports:
//   qrEncode(text, opts)             -> { size, modules }  (modules: size×size 0/1, 1=dark)
//   qrDecodeMatrix(modules)          -> decoded string (throws on failure)
//   qrDecodeImage(gray, w, h)        -> decoded string, or null on failure (never throws)
//
// Pure computation only — no DOM/Canvas, no Node-only APIs on runtime paths.
// The browser caller supplies grayscale pixel data to qrDecodeImage.
//
// To inline into an HTML file: replace `function` with `function` and expose a
// `QR = { qrEncode, qrDecodeMatrix, qrDecodeImage }` object.

// ============================================================================
// GF(256) arithmetic — primitive polynomial 0x11d, generator α = 2
// ============================================================================
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint16Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}
function gfInverse(a) {
  // a != 0
  return GF_EXP[255 - GF_LOG[a]];
}
// gf_pow(2, p) with possibly-negative p, using α = 2 (log[2] = 1)
function gfPow2(p) {
  let m = p % 255;
  if (m < 0) m += 255;
  return GF_EXP[m];
}

// ---- polynomial helpers (index 0 = highest-degree coefficient) ----
function gfPolyScale(p, x) {
  const r = new Array(p.length);
  for (let i = 0; i < p.length; i++) r[i] = gfMul(p[i], x);
  return r;
}
function gfPolyAdd(p, q) {
  const r = new Array(Math.max(p.length, q.length)).fill(0);
  for (let i = 0; i < p.length; i++) r[i + r.length - p.length] = p[i];
  for (let i = 0; i < q.length; i++) r[i + r.length - q.length] ^= q[i];
  return r;
}
function gfPolyMul(p, q) {
  const r = new Array(p.length + q.length - 1).fill(0);
  for (let j = 0; j < q.length; j++)
    for (let i = 0; i < p.length; i++)
      r[i + j] ^= gfMul(p[i], q[j]);
  return r;
}
function gfPolyEval(p, x) {
  let y = p[0];
  for (let i = 1; i < p.length; i++) y = gfMul(y, x) ^ p[i];
  return y;
}
function gfPolyDiv(dividend, divisor) {
  const out = dividend.slice();
  const n = dividend.length - (divisor.length - 1);
  for (let i = 0; i < n; i++) {
    const coef = out[i];
    if (coef !== 0) {
      for (let j = 1; j < divisor.length; j++)
        if (divisor[j] !== 0) out[i + j] ^= gfMul(divisor[j], coef);
    }
  }
  const sep = out.length - (divisor.length - 1);
  return [out.slice(0, sep), out.slice(sep)];
}

// ============================================================================
// Reed–Solomon encode / decode over GF(256)  (Berlekamp–Massey + Forney)
// (Faithful port of the well-known "RS for coders" algorithm.)
// ============================================================================
function rsGeneratorPoly(nsym) {
  let g = [1];
  for (let i = 0; i < nsym; i++) g = gfPolyMul(g, [1, gfPow2(i)]);
  return g;
}
function rsEncode(msgIn, nsym) {
  const gen = rsGeneratorPoly(nsym);
  const out = msgIn.concat(new Array(gen.length - 1).fill(0));
  for (let i = 0; i < msgIn.length; i++) {
    const coef = out[i];
    if (coef !== 0)
      for (let j = 1; j < gen.length; j++) out[i + j] ^= gfMul(gen[j], coef);
  }
  return msgIn.concat(out.slice(msgIn.length));
}
function rsCalcSyndromes(msg, nsym) {
  const s = [0];
  for (let i = 0; i < nsym; i++) s.push(gfPolyEval(msg, gfPow2(i)));
  return s; // length nsym+1, s[0] = 0
}
function rsFindErrorLocator(synd, nsym) {
  let errLoc = [1];
  let oldLoc = [1];
  const syndShift = synd.length - nsym; // = 1 here
  for (let i = 0; i < nsym; i++) {
    const K = i + syndShift;
    let delta = synd[K];
    for (let j = 1; j < errLoc.length; j++)
      delta ^= gfMul(errLoc[errLoc.length - 1 - j], synd[K - j]);
    oldLoc = oldLoc.concat([0]);
    if (delta !== 0) {
      if (oldLoc.length > errLoc.length) {
        const newLoc = gfPolyScale(oldLoc, delta);
        oldLoc = gfPolyScale(errLoc, gfInverse(delta));
        errLoc = newLoc;
      }
      errLoc = gfPolyAdd(errLoc, gfPolyScale(oldLoc, delta));
    }
  }
  // strip leading zeros
  while (errLoc.length && errLoc[0] === 0) errLoc.shift();
  const errs = errLoc.length - 1;
  if (errs * 2 > nsym) throw new Error("Too many errors to correct");
  return errLoc;
}
function rsFindErrors(errLocRev, nmess) {
  const errs = errLocRev.length - 1;
  const errPos = [];
  for (let i = 0; i < nmess; i++)
    if (gfPolyEval(errLocRev, gfPow2(i)) === 0) errPos.push(nmess - 1 - i);
  if (errPos.length !== errs) throw new Error("Could not locate errors");
  return errPos;
}
function rsFindErrataLocator(coefPos) {
  let eLoc = [1];
  for (const p of coefPos) eLoc = gfPolyMul(eLoc, gfPolyAdd([1], [gfPow2(p), 0]));
  return eLoc;
}
function rsFindErrorEvaluator(synd, errLoc, nsym) {
  const divisor = [1].concat(new Array(nsym + 1).fill(0)); // x^(nsym+1)
  const [, rem] = gfPolyDiv(gfPolyMul(synd, errLoc), divisor);
  return rem;
}
function rsCorrectErrata(msg, synd, errPos) {
  const coefPos = errPos.map((p) => msg.length - 1 - p);
  const errLoc = rsFindErrataLocator(coefPos);
  const syndRev = synd.slice().reverse();
  const errEval = rsFindErrorEvaluator(syndRev, errLoc, errLoc.length - 1).reverse();
  const X = [];
  for (let i = 0; i < coefPos.length; i++) {
    const l = 255 - coefPos[i];
    X.push(gfPow2(-l));
  }
  const E = new Array(msg.length).fill(0);
  for (let i = 0; i < X.length; i++) {
    const Xi = X[i];
    const XiInv = gfInverse(Xi);
    let errLocPrime = 1;
    for (let j = 0; j < X.length; j++)
      if (j !== i) errLocPrime = gfMul(errLocPrime, 1 ^ gfMul(XiInv, X[j]));
    let y = gfPolyEval(errEval.slice().reverse(), XiInv);
    y = gfMul(Xi, y);
    if (errLocPrime === 0) throw new Error("Forney denominator zero");
    E[errPos[i]] = gfMul(y, gfInverse(errLocPrime));
  }
  return gfPolyAdd(msg, E);
}
// Correct a full RS block (data + ec), return corrected full block (same length).
function rsCorrectMsg(msgIn, nsym) {
  let msg = msgIn.slice();
  const synd = rsCalcSyndromes(msg, nsym);
  let maxS = 0;
  for (const s of synd) if (s > maxS) maxS = s;
  if (maxS === 0) return msg; // no errors
  const errLoc = rsFindErrorLocator(synd, nsym);
  const errPos = rsFindErrors(errLoc.slice().reverse(), msg.length);
  msg = rsCorrectErrata(msg, synd, errPos);
  const synd2 = rsCalcSyndromes(msg, nsym);
  let maxS2 = 0;
  for (const s of synd2) if (s > maxS2) maxS2 = s;
  if (maxS2 !== 0) throw new Error("RS decode failed to converge");
  return msg;
}

// ============================================================================
// QR spec tables (versions 1..10)
// EC_TABLE[version][ecc] = [ecCodewordsPerBlock, [[numBlocks, dataPerBlock], ...]]
// ============================================================================
const EC_TABLE = {
  1: { L: [7, [[1, 19]]], M: [10, [[1, 16]]], Q: [13, [[1, 13]]], H: [17, [[1, 9]]] },
  2: { L: [10, [[1, 34]]], M: [16, [[1, 28]]], Q: [22, [[1, 22]]], H: [28, [[1, 16]]] },
  3: { L: [15, [[1, 55]]], M: [26, [[1, 44]]], Q: [18, [[2, 17]]], H: [22, [[2, 13]]] },
  4: { L: [20, [[1, 80]]], M: [18, [[2, 32]]], Q: [26, [[2, 24]]], H: [16, [[4, 9]]] },
  5: { L: [26, [[1, 108]]], M: [24, [[2, 43]]], Q: [18, [[2, 15], [2, 16]]], H: [22, [[2, 11], [2, 12]]] },
  6: { L: [18, [[2, 68]]], M: [16, [[4, 27]]], Q: [24, [[4, 19]]], H: [28, [[4, 15]]] },
  7: { L: [20, [[2, 78]]], M: [18, [[4, 31]]], Q: [18, [[2, 14], [4, 15]]], H: [26, [[4, 13], [1, 14]]] },
  8: { L: [24, [[2, 97]]], M: [22, [[2, 38], [2, 39]]], Q: [22, [[4, 18], [2, 19]]], H: [26, [[4, 14], [2, 15]]] },
  9: { L: [30, [[2, 116]]], M: [22, [[3, 36], [2, 37]]], Q: [20, [[4, 16], [4, 17]]], H: [24, [[4, 12], [4, 13]]] },
  10: { L: [18, [[2, 68], [2, 69]]], M: [26, [[4, 43], [1, 44]]], Q: [24, [[6, 19], [2, 20]]], H: [28, [[6, 15], [2, 16]]] },
};

// Alignment pattern center positions per version (empty for v1).
const ALIGN_POS = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

// ECC 2-bit format value: L=01, M=00, Q=11, H=10
const ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
const ECC_FROM_FORMAT = { 1: "L", 0: "M", 3: "Q", 2: "H" };

function dataCodewordsFor(version, ecc) {
  const [, blocks] = EC_TABLE[version][ecc];
  let n = 0;
  for (const [cnt, dpb] of blocks) n += cnt * dpb;
  return n;
}
function blockStructure(version, ecc) {
  const [ecPerBlock, blocks] = EC_TABLE[version][ecc];
  const list = [];
  for (const [cnt, dpb] of blocks)
    for (let i = 0; i < cnt; i++) list.push(dpb);
  return { ecPerBlock, dataLens: list };
}

// ============================================================================
// UTF-8 (self-contained; ASCII payloads pass through unchanged)
// ============================================================================
function utf8Encode(str) {
  const out = [];
  for (const ch of str) {
    let cp = ch.codePointAt(0);
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return out;
}
function utf8Decode(bytes) {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) out += String.fromCodePoint(b);
    else if ((b >> 5) === 0x6) out += String.fromCodePoint(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    else if ((b >> 4) === 0xe) {
      const b1 = bytes[i++], b2 = bytes[i++];
      out += String.fromCodePoint(((b & 0xf) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
    } else {
      const b1 = bytes[i++], b2 = bytes[i++], b3 = bytes[i++];
      out += String.fromCodePoint(((b & 0x7) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
    }
  }
  return out;
}

// ============================================================================
// Format & version information (BCH)
// ============================================================================
function encodeFormatBits(ecc, mask) {
  const data = (ECC_FORMAT_BITS[ecc] << 3) | mask; // 5 bits
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  return ((data << 10) | (rem & 0x3ff)) ^ 0x5412; // 15 bits
}
function encodeVersionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25);
  return (version << 12) | (rem & 0xfff); // 18 bits
}
const bit = (x, i) => (x >> i) & 1;

// ============================================================================
// Data-mask patterns
// ============================================================================
function maskFn(mask, r, c) {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
  return false;
}

// ============================================================================
// Matrix construction (function patterns + reserved map)
// ============================================================================
function newMatrix(size, fill) {
  const m = new Array(size);
  for (let i = 0; i < size; i++) m[i] = new Array(size).fill(fill);
  return m;
}

// Build base matrix with all function patterns placed and reserved[] marking
// every module that data placement must skip (function + format + version areas).
function buildBaseMatrix(version) {
  const size = version * 4 + 17;
  const m = newMatrix(size, 0);
  const reserved = newMatrix(size, false);

  function placeFinder(r0, c0) {
    for (let dr = -1; dr <= 7; dr++)
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        reserved[r][c] = true;
        const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        let dark = false;
        if (inside) {
          const border = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const center = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          dark = border || center;
        }
        m[r][c] = dark ? 1 : 0;
      }
  }
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) { m[6][i] = i % 2 === 0 ? 1 : 0; reserved[6][i] = true; }
    if (!reserved[i][6]) { m[i][6] = i % 2 === 0 ? 1 : 0; reserved[i][6] = true; }
  }

  // Alignment patterns
  const pos = ALIGN_POS[version];
  const maxPos = size - 7;
  for (const r of pos)
    for (const c of pos) {
      if ((r === 6 && c === 6) || (r === 6 && c === maxPos) || (r === maxPos && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          const rr = r + dr, cc = c + dc;
          reserved[rr][cc] = true;
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          m[rr][cc] = dark ? 1 : 0;
        }
    }

  // Dark module
  m[size - 8][8] = 1;
  reserved[size - 8][8] = true;

  // Reserve format info areas
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) { reserved[8][i] = true; reserved[i][8] = true; }
  }
  reserved[8][7] = true; // (already covered by i<=8 loop except skip 6) — safe
  for (let i = 0; i < 8; i++) reserved[size - 1 - i][8] = true;
  for (let i = 0; i < 8; i++) reserved[8][size - 1 - i] = true;

  // Reserve + draw version info (v >= 7)
  if (version >= 7) {
    const vbits = encodeVersionBits(version);
    for (let i = 0; i < 18; i++) {
      const b = bit(vbits, i);
      const a = i % 3;
      const d = Math.floor(i / 3);
      // bottom-left block
      m[size - 11 + a][d] = b;
      reserved[size - 11 + a][d] = true;
      // top-right block
      m[d][size - 11 + a] = b;
      reserved[d][size - 11 + a] = true;
    }
  }

  return { size, m, reserved };
}

// Zig-zag data module placement order (skips reserved modules).
function moduleSequence(size, reserved) {
  const seq = [];
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5; // skip vertical timing column
    for (let i = 0; i < size; i++) {
      const row = up ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (!reserved[row][c]) seq.push([row, c]);
      }
    }
    up = !up;
  }
  return seq;
}

// ============================================================================
// Interleaving
// ============================================================================
function interleaveCodewords(dataBlocks, ecBlocks) {
  const out = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++)
    for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  const maxEc = Math.max(...ecBlocks.map((b) => b.length));
  for (let i = 0; i < maxEc; i++)
    for (const b of ecBlocks) if (i < b.length) out.push(b[i]);
  return out;
}

// ============================================================================
// Penalty scoring (N1=3, N2=3, N3=40, N4=10)
// ============================================================================
function computePenalty(m, size) {
  let penalty = 0;
  // N1: runs of >=5 in rows and columns
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) {
      if (m[r][c] === m[r][c - 1]) { run++; if (run === 5) penalty += 3; else if (run > 5) penalty += 1; }
      else run = 1;
    }
  }
  for (let c = 0; c < size; c++) {
    let run = 1;
    for (let r = 1; r < size; r++) {
      if (m[r][c] === m[r - 1][c]) { run++; if (run === 5) penalty += 3; else if (run > 5) penalty += 1; }
      else run = 1;
    }
  }
  // N2: 2x2 blocks of same color
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) penalty += 3;
    }
  // N3: finder-like patterns 10111010000 or 00001011101 in rows and columns
  const p1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const p2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matchAt = (get, i) => {
    let m1 = true, m2 = true;
    for (let k = 0; k < 11; k++) {
      const v = get(i + k);
      if (v !== p1[k]) m1 = false;
      if (v !== p2[k]) m2 = false;
    }
    return (m1 ? 1 : 0) + (m2 ? 1 : 0);
  };
  for (let r = 0; r < size; r++)
    for (let c = 0; c <= size - 11; c++)
      penalty += 40 * matchAt((x) => m[r][x], c);
  for (let c = 0; c < size; c++)
    for (let r = 0; r <= size - 11; r++)
      penalty += 40 * matchAt((x) => m[x][c], r);
  // N4: dark proportion
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += m[r][c];
  const ratio = (dark * 100) / (size * size);
  penalty += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return penalty;
}

// ============================================================================
// ENCODE
// ============================================================================
function qrEncode(text, opts = {}) {
  const ecc = opts.ecc || "M";
  if (!ECC_FORMAT_BITS.hasOwnProperty(ecc)) throw new Error("Bad ecc: " + ecc);
  const bytes = utf8Encode(String(text));

  // Pick smallest version 1..10 that fits.
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const countBits = v <= 9 ? 8 : 16;
    const needBits = 4 + countBits + 8 * bytes.length;
    const cap = dataCodewordsFor(v, ecc) * 8;
    if (needBits <= cap) { version = v; break; }
  }
  if (version === 0) throw new Error("Data too long for version <= 10 at ECC " + ecc);

  const dataCW = dataCodewordsFor(version, ecc);
  const countBits = version <= 9 ? 8 : 16;

  // Build bit stream.
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4); // byte mode
  push(bytes.length, countBits);
  for (const b of bytes) push(b, 8);
  const capBits = dataCW * 8;
  push(0, Math.min(4, capBits - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(0);
  const padBytes = [0xec, 0x11];
  let pi = 0;
  while (bits.length < capBits) push(padBytes[pi++ % 2], 8);

  // Bits -> data codewords.
  const dataCodewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
    dataCodewords.push(v);
  }

  // Split into blocks, compute EC per block.
  const { ecPerBlock, dataLens } = blockStructure(version, ecc);
  const dataBlocks = [];
  const ecBlocks = [];
  let off = 0;
  for (const dl of dataLens) {
    const blk = dataCodewords.slice(off, off + dl);
    off += dl;
    dataBlocks.push(blk);
    const full = rsEncode(blk, ecPerBlock);
    ecBlocks.push(full.slice(dl));
  }
  const allCW = interleaveCodewords(dataBlocks, ecBlocks);

  // Place data bits into base matrix.
  const { size, m: base, reserved } = buildBaseMatrix(version);
  const seq = moduleSequence(size, reserved);
  // Flatten codewords to bit list.
  const dataBits = [];
  for (const cw of allCW) for (let k = 7; k >= 0; k--) dataBits.push((cw >> k) & 1);

  const filled = base.map((row) => row.slice());
  for (let i = 0; i < seq.length; i++) {
    const [r, c] = seq[i];
    filled[r][c] = i < dataBits.length ? dataBits[i] : 0; // remainder bits = 0
  }

  // Try all 8 masks, choose lowest penalty.
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const cand = filled.map((row) => row.slice());
    for (const [r, c] of seq) if (maskFn(mask, r, c)) cand[r][c] ^= 1;
    drawFormatBits(cand, size, ecc, mask);
    const p = computePenalty(cand, size);
    if (best === null || p < best.penalty) best = { penalty: p, mask, modules: cand };
  }
  return { size, modules: best.modules };
}

function drawFormatBits(m, size, ecc, mask) {
  const f = encodeFormatBits(ecc, mask);
  for (let i = 0; i < 15; i++) {          // 标准位序(ISO 18004):bit i 的落点,竖(第8列)+横(第8行)两副本
    const b = bit(f, i);
    if (i < 6) m[i][8] = b; else if (i < 8) m[i + 1][8] = b; else m[size - 15 + i][8] = b;      // 竖:第 8 列
    if (i < 8) m[8][size - i - 1] = b; else if (i < 9) m[8][7] = b; else m[8][15 - i - 1] = b;   // 横:第 8 行
  }
  m[size - 8][8] = 1; // dark module
}

// ============================================================================
// DECODE from an ideal 0/1 matrix
// ============================================================================
function qrDecodeMatrix(modules) {
  const size = modules.length;
  if (size < 21 || (size - 17) % 4 !== 0) throw new Error("Bad matrix size: " + size);
  const version = (size - 17) / 4;
  if (version < 1 || version > 10) throw new Error("Unsupported version: " + version);

  // Read format info (vertical copy, col 8) — standard bit positions — and error-correct against all 32 candidates.
  let read = 0;
  for (let i = 0; i < 15; i++) {
    const r = i < 6 ? i : i < 8 ? i + 1 : size - 15 + i;
    read |= (modules[r][8] & 1) << i;
  }

  let bestEcc = null, bestMask = -1, bestDist = 99;
  for (const eccName of ["L", "M", "Q", "H"])
    for (let mask = 0; mask < 8; mask++) {
      const cand = encodeFormatBits(eccName, mask);
      let d = 0, x = cand ^ read;
      while (x) { d += x & 1; x >>= 1; }
      if (d < bestDist) { bestDist = d; bestEcc = eccName; bestMask = mask; }
    }
  if (bestDist > 3) throw new Error("Format info unrecoverable");
  const ecc = bestEcc, mask = bestMask;

  // Rebuild reserved map and read data modules (unmasking as we go).
  const { reserved } = buildBaseMatrix(version);
  const seq = moduleSequence(size, reserved);
  const dataBits = [];
  for (const [r, c] of seq) {
    let v = modules[r][c] & 1;
    if (maskFn(mask, r, c)) v ^= 1;
    dataBits.push(v);
  }

  // Bits -> codewords (total codewords for version).
  const totalCW = countTotalCodewords(version);
  const stream = [];
  for (let i = 0; i < totalCW; i++) {
    let v = 0;
    for (let k = 0; k < 8; k++) v = (v << 1) | (dataBits[i * 8 + k] || 0);
    stream.push(v);
  }

  // De-interleave into blocks.
  const { ecPerBlock, dataLens } = blockStructure(version, ecc);
  const numBlocks = dataLens.length;
  const totalData = dataLens.reduce((a, b) => a + b, 0);
  const dataStream = stream.slice(0, totalData);
  const ecStream = stream.slice(totalData);

  const blockData = dataLens.map(() => []);
  const maxData = Math.max(...dataLens);
  let idx = 0;
  for (let i = 0; i < maxData; i++)
    for (let b = 0; b < numBlocks; b++)
      if (i < dataLens[b]) blockData[b].push(dataStream[idx++]);

  const blockEc = dataLens.map(() => []);
  idx = 0;
  for (let i = 0; i < ecPerBlock; i++)
    for (let b = 0; b < numBlocks; b++) blockEc[b].push(ecStream[idx++]);

  // RS-correct each block, gather corrected data codewords.
  const corrected = [];
  for (let b = 0; b < numBlocks; b++) {
    const full = blockData[b].concat(blockEc[b]);
    const fixed = rsCorrectMsg(full, ecPerBlock);
    for (let i = 0; i < dataLens[b]; i++) corrected.push(fixed[i]);
  }

  // Parse byte-mode payload.
  return parsePayload(corrected, version);
}

function countTotalCodewords(version) {
  // total codewords = data + ec (independent of ecc): use L structure sum
  const [ecPerBlock, blocks] = EC_TABLE[version]["L"];
  let n = 0;
  for (const [cnt, dpb] of blocks) n += cnt * (dpb + ecPerBlock);
  return n;
}

function parsePayload(codewords, version) {
  // Bit reader over codewords.
  const allBits = [];
  for (const cw of codewords) for (let k = 7; k >= 0; k--) allBits.push((cw >> k) & 1);
  let p = 0;
  const readBits = (n) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | (allBits[p++] || 0); return v; };

  const mode = readBits(4);
  if (mode !== 0b0100) throw new Error("Unsupported mode indicator: " + mode);
  const countBits = version <= 9 ? 8 : 16;
  const len = readBits(countBits);
  const bytes = [];
  for (let i = 0; i < len; i++) bytes.push(readBits(8));
  return utf8Decode(bytes);
}

// ============================================================================
// DECODE from a photographed / rendered grayscale image (best-effort)
// ============================================================================
function qrDecodeImage(gray, width, height) {
  try {
    const bin = otsuBinarize(gray, width, height); // 1 = dark
    const finders = findFinderPatterns(bin, width, height);
    if (finders.length < 3) return null;

    // Choose the 3 strongest finder clusters.
    finders.sort((a, b) => b.count - a.count);
    const cand = finders.slice(0, Math.min(6, finders.length));

    // Try combinations of 3 to find a decodable arrangement.
    const combos = choose3(cand.length);
    for (const [i, j, k] of combos) {
      const res = tryDecodeWithFinders(bin, width, height, cand[i], cand[j], cand[k]);
      if (res !== null) return res;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function choose3(n) {
  const out = [];
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++) out.push([a, b, c]);
  return out;
}

function otsuBinarize(gray, width, height) {
  const hist = new Array(256).fill(0);
  const total = width * height;
  for (let i = 0; i < total; i++) hist[gray[i] | 0]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, maxVar = -1, thresh = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) { maxVar = between; thresh = t; }
  }
  const bin = new Uint8Array(total);
  for (let i = 0; i < total; i++) bin[i] = gray[i] <= thresh ? 1 : 0; // dark=1
  return bin;
}

// Scan rows and columns for the 1:1:3:1:1 finder ratio; return clustered centers.
function findFinderPatterns(bin, width, height) {
  const get = (x, y) => bin[y * width + x];
  const candidates = [];

  const checkRatios = (counts) => {
    // counts: 5 run lengths of alternating dark-light-dark-light-dark
    const total = counts[0] + counts[1] + counts[2] + counts[3] + counts[4];
    if (total < 7) return false;
    const modSize = total / 7;
    const tol = modSize / 2 + 0.5;
    return (
      Math.abs(counts[0] - modSize) < tol &&
      Math.abs(counts[1] - modSize) < tol &&
      Math.abs(counts[2] - 3 * modSize) < 3 * tol &&
      Math.abs(counts[3] - modSize) < tol &&
      Math.abs(counts[4] - modSize) < tol
    );
  };

  // Horizontal scan (ZXing-style rolling 5-run window).
  for (let y = 0; y < height; y++) {
    const counts = [0, 0, 0, 0, 0];
    let state = 0; // even = dark run, odd = light run
    for (let x = 0; x < width; x++) {
      const v = get(x, y);
      if (v === 1) { // dark pixel
        if ((state & 1) === 1) state++; // transition light -> dark
        counts[state]++;
      } else { // light pixel
        if ((state & 1) === 0) { // was dark run
          if (state === 4) {
            // Completed dark-light-dark-light-dark; current pixel starts trailing light.
            if (checkRatios(counts)) {
              const total = counts[0] + counts[1] + counts[2] + counts[3] + counts[4];
              const cx = x - counts[4] - counts[3] - counts[2] / 2;
              candidates.push({ x: cx, y: y + 0.5, mod: total / 7, count: 1 });
            }
            // Roll window: keep last dark-light-dark as new first three runs.
            counts[0] = counts[2];
            counts[1] = counts[3];
            counts[2] = counts[4];
            counts[3] = 1; // current light pixel
            counts[4] = 0;
            state = 3;
          } else {
            state++;
            counts[state]++;
          }
        } else {
          counts[state]++; // continue light run
        }
      }
    }
  }

  // Cluster candidates that are close together.
  const clusters = [];
  for (const c of candidates) {
    let merged = false;
    for (const cl of clusters) {
      if (Math.abs(cl.x - c.x) < cl.mod * 2 && Math.abs(cl.y - c.y) < cl.mod * 2) {
        cl.x = (cl.x * cl.count + c.x) / (cl.count + 1);
        cl.y = (cl.y * cl.count + c.y) / (cl.count + 1);
        cl.mod = (cl.mod * cl.count + c.mod) / (cl.count + 1);
        cl.count++;
        merged = true;
        break;
      }
    }
    if (!merged) clusters.push({ x: c.x, y: c.y, mod: c.mod, count: 1 });
  }

  // Verify each cluster with a vertical run through its center.
  const verified = [];
  for (const cl of clusters) {
    if (verifyFinderVertical(bin, width, height, Math.round(cl.x), Math.round(cl.y), cl.mod))
      verified.push(cl);
  }
  return verified.length >= 3 ? verified : clusters;
}

function verifyFinderVertical(bin, width, height, cx, cy, mod) {
  if (cx < 0 || cx >= width || cy < 0 || cy >= height) return false;
  const get = (y) => bin[y * width + cx];
  if (get(cy) !== 1) return false;
  // count center dark run
  let up = 0, down = 0;
  for (let y = cy; y >= 0 && get(y) === 1; y--) up++;
  for (let y = cy + 1; y < height && get(y) === 1; y++) down++;
  const center = up + down;
  if (center < mod || center > 5 * mod) return false;
  return true;
}

// Given three finder clusters, identify orientation, sample grid, decode.
function tryDecodeWithFinders(bin, width, height, f0, f1, f2) {
  try {
    const pts = [f0, f1, f2];
    // Top-left = vertex whose angle is ~90°.
    let tlIdx = 0, bestCos = 2;
    for (let i = 0; i < 3; i++) {
      const a = pts[(i + 1) % 3], b = pts[(i + 2) % 3], o = pts[i];
      const v1x = a.x - o.x, v1y = a.y - o.y, v2x = b.x - o.x, v2y = b.y - o.y;
      const dot = v1x * v2x + v1y * v2y;
      const cos = dot / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) + 1e-9);
      if (Math.abs(cos) < bestCos) { bestCos = Math.abs(cos); tlIdx = i; }
    }
    const tl = pts[tlIdx];
    let a = pts[(tlIdx + 1) % 3], b = pts[(tlIdx + 2) % 3];
    // Cross product to decide which is top-right vs bottom-left.
    // In image coords (x right, y down): (TR-TL) × (BL-TL) > 0.
    const cross = (a.x - tl.x) * (b.y - tl.y) - (a.y - tl.y) * (b.x - tl.x);
    let tr, bl;
    if (cross > 0) { tr = a; bl = b; } else { tr = b; bl = a; }

    const modSize = (tl.mod + tr.mod + bl.mod) / 3;
    const distTR = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const distBL = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    const dim = Math.round((distTR + distBL) / 2 / modSize) + 7;
    // Snap to nearest valid QR size 4v+17.
    let size = dim;
    if ((size - 17) % 4 !== 0) size = Math.round((size - 17) / 4) * 4 + 17;
    const version = (size - 17) / 4;
    if (version < 1 || version > 10) return null;

    // Finder centers correspond to module coords (3,3),(3,size-4),(size-4,3).
    // Estimate bottom-right center via parallelogram.
    const brx = tr.x + bl.x - tl.x;
    const bry = tr.y + bl.y - tl.y;

    // Bilinear map module(r,c) center -> image pixel.
    const span = size - 7; // module distance between finder centers
    const sample = (r, c) => {
      const u = (c - 3) / span;
      const v = (r - 3) / span;
      const x = (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + (1 - u) * v * bl.x + u * v * brx;
      const y = (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + (1 - u) * v * bl.y + u * v * bry;
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || xi >= width || yi < 0 || yi >= height) return 0;
      return bin[yi * width + xi] & 1;
    };

    const m = newMatrix(size, 0);
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) m[r][c] = sample(r, c);

    return qrDecodeMatrix(m);
  } catch (e) {
    return null;
  }
}

// ============================================================================
// 渲染:文本 -> canvas(白底黑模块,含 quiet zone;image-rendering:pixelated 由 CSS 控)
// ============================================================================
function toCanvas(text, opts) {
  opts = opts || {};
  var ecc = opts.ecc || "M";
  var quiet = opts.quiet == null ? 2 : opts.quiet;
  var scale = opts.scale || 6;
  var res = qrEncode(text, { ecc: ecc });
  var size = res.size, modules = res.modules;
  var dim = size + quiet * 2, px = dim * scale;
  var cv = document.createElement("canvas");
  cv.width = px; cv.height = px;
  var ctx = cv.getContext("2d");
  ctx.fillStyle = opts.light || "#fff"; ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = opts.dark || "#000";
  for (var r = 0; r < size; r++)
    for (var c = 0; c < size; c++)
      if (modules[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
  return cv;
}

  window.FairPlay = window.FairPlay || {};
  window.FairPlay.QR = {
    encode: qrEncode,
    toCanvas: toCanvas,
    decodeMatrix: qrDecodeMatrix,
    decodeImage: qrDecodeImage
  };
})();
