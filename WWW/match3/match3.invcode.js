/* FairPlay — match3 邀请码编解码(骨架)
   encode:当前时间 → 参数(后续换成 布局+成绩)
   decode:参数 → 创建时刻 { ts, time:"HH:MM:SS" } */
(function () {
  window.FAIRPLAY_CODECS = window.FAIRPLAY_CODECS || {};
  window.FAIRPLAY_CODECS.match3 = {
    encode: function () {
      return Date.now().toString(36);
    },
    decode: function (param) {
      var ms = parseInt(param, 36);
      var d = new Date(ms);
      var p2 = function (n) { return String(n).padStart(2, "0"); };
      return { ts: ms, time: p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds()) };
    },
  };
})();
