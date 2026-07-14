/* FairPlay — match3 邀请码编解码(依赖 ../pack.js 的 FairPack)
   种子 = 6×6 格(每格 1~6,恰好每色 6 个)。
   encode:6 行填 1~6 → Fisher-Yates 均匀洗牌(创建端,允许 Math.random,只存结果)
           → 36 个值当 6 进制大数 → FairPack.encode(base58)→ 加 1 位校验
   decode:校验+去校验位 → base58→大数 → 拆出 36 个 6 进制位 → { grid: number[36] }(1~6);非法/校验不过返回 null
   打包 ~16 字符 + 1 校验位。变换取流器(按行列交换读种子)属游戏引擎,不在此文件。 */
(function () {
  const N = 36;

  function packGrid(grid) {
    let n = 0n;                                  // grid[i]∈1..6 → 6 进制大数
    for (let i = 0; i < N; i++) n = n * 6n + BigInt(grid[i] - 1);
    return window.FairPack.addCheck(window.FairPack.encode(n));
  }

  function unpackGrid(param) {
    const body = window.FairPack.stripCheck(param);   // 校验+去校验位
    if (body === null) return null;
    let n = window.FairPack.decode(body);             // base58 → 大数
    if (n === null) return null;
    const grid = new Array(N);
    for (let i = N - 1; i >= 0; i--) {                // 低位回填,不足 36 位高位为 0(→色 1)
      grid[i] = Number(n % 6n) + 1;
      n = n / 6n;
    }
    if (n !== 0n) return null;                        // 超过 36 位 = 不是合法种子
    return grid;
  }

  window.FAIRPLAY_CODECS = window.FAIRPLAY_CODECS || {};
  window.FAIRPLAY_CODECS.match3 = {
    encode: function () {
      const grid = [];
      for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) grid.push(c + 1); // 每行 1~6
      for (let i = N - 1; i > 0; i--) {              // Fisher-Yates(均匀无偏,35 次交换)
        const j = Math.floor(Math.random() * (i + 1));
        const t = grid[i]; grid[i] = grid[j]; grid[j] = t;
      }
      return packGrid(grid);
    },
    decode: function (param) {
      if (typeof param !== "string") return null;
      const grid = unpackGrid(param.trim());
      return grid ? { grid: grid } : null;
    }
  };
})();
