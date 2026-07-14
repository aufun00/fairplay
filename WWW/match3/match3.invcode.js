/* FairPlay — match3 邀请码编解码(依赖 ../pack.js 的 FairPack)
   种子 = 6×6 格(每格 1~6,恰好每色 6 个)。encode:6 行填 1~6 → 洗牌 → 打包(~16+校验)。
   decode:param → { grid: number[36] }(1~6);非法/校验不过 → null。 */
(function () {
  var FP = window.FairPack, N = 36, BASE = 6;

  window.FAIRPLAY_CODECS = window.FAIRPLAY_CODECS || {};
  window.FAIRPLAY_CODECS.match3 = {
    encode: function () {
      var grid = [];
      for (var r = 0; r < 6; r++) for (var c = 0; c < 6; c++) grid.push(c + 1); // 每行 1~6
      FP.shuffle(grid);
      return FP.packBase(grid.map(function (v) { return v - 1; }), BASE);        // 1~6 → 0~5
    },
    decode: function (param) {
      if (typeof param !== "string") return null;
      var d = FP.unpackBase(param.trim(), N, BASE);
      return d ? { grid: d.map(function (x) { return x + 1; }) } : null;          // 0~5 → 1~6
    }
  };
})();
