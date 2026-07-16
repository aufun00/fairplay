/* FairPlay — blockfit 邀请码编解码(依赖 ../pack.js 的 FairPack)
   种子 = 5×5 格,每格是 1~25 的一个排列(洗牌)。读流时 1~19→块、20~25→跳过 = 均匀 19-bag。
   encode:填 1~25 → 洗牌 → 打包(25 位 25 进制 + 校验,~21 字符)。
   decode:param → { grid: number[25] }(1~25);非法/校验不过 → null。 */
(function () {
  var FP = window.FairPack, N = 25, BASE = 25;

  window.FAIRPLAY_CODECS = window.FAIRPLAY_CODECS || {};
  window.FAIRPLAY_CODECS.blockfit = {
    encode: function () {
      var grid = [];
      for (var v = 1; v <= 25; v++) grid.push(v);                                   // 1~25 各一个
      FP.shuffle(grid);                                                             // 创建端洗牌(Math.random)
      return FP.packBase(grid.map(function (x) { return x - 1; }), BASE);           // 1~25 → 0~24
    },
    decode: function (param) {
      if (typeof param !== "string") return null;
      var d = FP.unpackBase(param.trim(), N, BASE);
      return d ? { grid: d.map(function (x) { return x + 1; }) } : null;            // 0~24 → 1~25
    }
  };
})();
