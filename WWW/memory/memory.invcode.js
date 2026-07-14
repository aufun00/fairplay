/* FairPlay — memory(记忆翻牌)邀请码编解码(依赖 ../pack.js)
   种子 = 12 张牌的排列(6 对,值 1~6 各两张)。
   encode:[1,1,2,2,3,3,4,4,5,5,6,6] → Fisher-Yates 洗牌 → 12 个 6 进制位 → base58 + 校验
   decode:校验+还原 → { cards: number[12] }(每张 1~6);非法/校验不过 → null。~7 字符。 */
(function () {
  const N = 12;

  function packCards(cards) {
    let n = 0n;
    for (let i = 0; i < N; i++) n = n * 6n + BigInt(cards[i] - 1);
    return window.FairPack.addCheck(window.FairPack.encode(n));
  }

  function unpackCards(param) {
    const body = window.FairPack.stripCheck(param);
    if (body === null) return null;
    let n = window.FairPack.decode(body);
    if (n === null) return null;
    const cards = new Array(N);
    for (let i = N - 1; i >= 0; i--) { cards[i] = Number(n % 6n) + 1; n = n / 6n; }
    if (n !== 0n) return null;
    return cards;
  }

  window.FAIRPLAY_CODECS = window.FAIRPLAY_CODECS || {};
  window.FAIRPLAY_CODECS.memory = {
    encode: function () {
      const cards = [];
      for (let v = 1; v <= 6; v++) { cards.push(v); cards.push(v); }   // 6 对
      for (let i = N - 1; i > 0; i--) {                                // Fisher-Yates
        const j = Math.floor(Math.random() * (i + 1));
        const t = cards[i]; cards[i] = cards[j]; cards[j] = t;
      }
      return packCards(cards);
    },
    decode: function (param) {
      if (typeof param !== "string") return null;
      const cards = unpackCards(param.trim());
      return cards ? { cards: cards } : null;
    }
  };
})();
