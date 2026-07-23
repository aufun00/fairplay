/* FairPlay — 通用编码模块(种子 / QR 载荷等复用)
   base58(标准比特币字母表:去掉 0 O I l 四个最易混的)→ URL 安全、给人念不易错。
   大数任意进制编解码 + 1 位校验(防手抄/传坏,不防作弊)。 */
window.FairPack = (function () {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; // 58
  const BASE = BigInt(ALPHABET.length);

  /* BigInt → 字符串(变长,无前导填充) */
  function encode(n) {
    if (n < 0n) return null;
    if (n === 0n) return ALPHABET[0];
    let s = "";
    while (n > 0n) { s = ALPHABET[Number(n % BASE)] + s; n = n / BASE; }
    return s;
  }

  /* 字符串 → BigInt(含非法字符则 null) */
  function decode(str) {
    if (typeof str !== "string" || !str) return null;
    let n = 0n;
    for (const ch of str) {
      const v = ALPHABET.indexOf(ch);
      if (v < 0) return null;
      n = n * BASE + BigInt(v);
    }
    return n;
  }

  /* 1 位校验字符:位置加权和 mod 58(能抓单字符错和多数换位) */
  function checkChar(str) {
    let s = 0;
    for (let i = 0; i < str.length; i++) {
      s += (ALPHABET.indexOf(str[i]) + 1) * (i + 1);
    }
    return ALPHABET[s % 58];
  }

  /* 追加校验位 */
  function addCheck(str) { return str + checkChar(str); }

  /* 校验并去掉校验位;非法/校验不过 → null */
  function stripCheck(full) {
    if (typeof full !== "string" || full.length < 2) return null;
    const body = full.slice(0, -1);
    for (const ch of body) if (ALPHABET.indexOf(ch) < 0) return null;
    if (checkChar(body) !== full.slice(-1)) return null;
    return body;
  }

  /* Fisher-Yates 均匀洗牌(创建端,Math.random;原地改并返回) */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ---- 确定性 PRNG(mulberry32,纯 32 位整数运算 → 跨引擎/CPU/OS 逐位一致)。
     同 seed 在任何终端产出同一条流;序列路径不碰浮点/时间,故公平可复现。 ---- */
  function rng(seed) {
    var a = seed >>> 0;
    function next() {                                   // → 0 .. 2^32-1
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) >>> 0;
    }
    function int(n) {                                   // 无偏 [0,n):拒绝采样去掉尾巴
      if (n <= 1) return 0;
      var lim = 0x100000000 - (0x100000000 % n);        // 不做 >>>0(保留 2^32);n | 2^32 整除时 lim=2^32,永不拒绝
      var r; do { r = next(); } while (r >= lim);
      return r % n;
    }
    function shuffle(arr) {                              // Fisher-Yates(原地),随机源 = 本 PRNG
      for (var i = arr.length - 1; i > 0; i--) {
        var j = int(i + 1), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
    return { next: next, int: int, shuffle: shuffle };
  }

  /* ---- 邀请码 seed 载荷:把 (durIdx, seed) 打进一个 base58 码(校验位罩住,~7 字符)。
     n = seed × DUR_RADIX + durIdx;durIdx 藏在 32 位 seed 编码的天然余量里(码长不变)。
     encodeSeed 创建端用 Math.random 掷 32 位 seed(此后全程确定性);decodeSeed 反解。 ---- */
  var DUR_RADIX = 8;                                     // 预留 8 档时长(2³²×8 ≤ 58⁶ → 6 位封顶)
  var SEED_WIDTH = 6;                                    // 定长 6 位主体(左填 ALPHABET[0])+ 1 校验 = 恒 7 字符
  function encodeSeed(durIdx) {
    var seed = Math.floor(Math.random() * 0x100000000) >>> 0;
    var n = BigInt(seed) * BigInt(DUR_RADIX) + BigInt((durIdx | 0) % DUR_RADIX);
    var body = encode(n);
    while (body.length < SEED_WIDTH) body = ALPHABET[0] + body;   // 左填充 → 恒定长度
    return addCheck(body);
  }
  function decodeSeed(str) {
    if (typeof str !== "string") return null;
    var body = stripCheck(str.trim());
    if (body === null) return null;
    var n = decode(body);
    if (n === null) return null;
    var durIdx = Number(n % BigInt(DUR_RADIX));
    var seed = n / BigInt(DUR_RADIX);
    if (seed > 0xFFFFFFFFn) return null;                 // 越界(老格式长码等)= 非法
    return { seed: Number(seed) >>> 0, durIdx: durIdx };
  }

  /* ---- 成绩载荷:非负整数分数 → base58 + 校验(挂邀请链接 ?o=,供对手匀速对抗)。
     ~7 位数(≤9,999,999)约 5 字符;非法/缺失 → decodeScore 返回 null(调用方当 0)。 ---- */
  function encodeScore(n) {
    n = Math.floor(Number(n) || 0);
    if (n < 0) n = 0;
    return addCheck(encode(BigInt(n)));
  }
  function decodeScore(str) {
    if (typeof str !== "string") return null;
    var body = stripCheck(str.trim());
    if (body === null) return null;
    var n = decode(body);
    return n === null ? null : Number(n);
  }

  /* digits(每位 0..base-1)→ 当 base 进制大数 → base58 + 校验 */
  function packBase(digits, base) {
    const b = BigInt(base);
    let n = 0n;
    for (let i = 0; i < digits.length; i++) n = n * b + BigInt(digits[i]);
    return addCheck(encode(n));
  }

  /* 反解:base58+校验 → count 个 digit(0..base-1);非法/校验不过/超长 → null */
  function unpackBase(str, count, base) {
    const body = stripCheck(str);
    if (body === null) return null;
    let n = decode(body);
    if (n === null) return null;
    const b = BigInt(base), out = new Array(count);
    for (let i = count - 1; i >= 0; i--) { out[i] = Number(n % b); n = n / b; }
    if (n !== 0n) return null;
    return out;
  }

  return {
    ALPHABET: ALPHABET, encode: encode, decode: decode,
    addCheck: addCheck, stripCheck: stripCheck,
    shuffle: shuffle, packBase: packBase, unpackBase: unpackBase,
    rng: rng, encodeSeed: encodeSeed, decodeSeed: decodeSeed,
    encodeScore: encodeScore, decodeScore: decodeScore
  };
})();
