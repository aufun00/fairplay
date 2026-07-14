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
    shuffle: shuffle, packBase: packBase, unpackBase: unpackBase
  };
})();
