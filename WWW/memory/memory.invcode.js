/* FairPlay — memory(记忆翻牌)邀请码编解码(依赖 ../pack.js 的 FairPack)
   种子 = 12 张牌(6 对,值 1~6 各两张)。encode:成对填 → 洗牌 → 打包(~7 字符)。
   decode:param → { cards: number[12] }(1~6);非法/校验不过 → null。 */
(function () {
  var FP = window.FairPack, N = 12, BASE = 6;

  window.FAIRPLAY_CODECS = window.FAIRPLAY_CODECS || {};
  window.FAIRPLAY_CODECS.memory = {
    encode: function () {
      var cards = [];
      for (var v = 1; v <= 6; v++) { cards.push(v); cards.push(v); }             // 6 对
      FP.shuffle(cards);
      return FP.packBase(cards.map(function (v) { return v - 1; }), BASE);
    },
    decode: function (param) {
      if (typeof param !== "string") return null;
      var d = FP.unpackBase(param.trim(), N, BASE);
      return d ? { cards: d.map(function (x) { return x + 1; }) } : null;
    }
  };
})();
