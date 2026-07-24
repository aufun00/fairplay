/* FairPlay Service Worker
   版本号 = 缓存名,唯一来源在 version.js(importScripts 进来)。
   导航/HTML = network-first(联网拿最新,离线回退缓存);静态资源 = cache-first */
importScripts("./version.js");
const VERSION = self.FAIRPLAY_VERSION;

const SHELL = [
  "./",
  "./index.html",
  "./index.new.html",
  "./index.pro.html",
  "./common.css",
  "./assets/icons.js",
  "./assets/qr.js",
  "./version.js",
  "./app.js",
  "./topbar.js",
  "./home-core.js",
  "./control.js",
  "./p3d.js",
  "./pad.js",
  "./pack.js",
  "./games.js",
  "./index.lang.js",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./icon.svg",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./match3/match3.html",
  "./match3/match3.lang.js",
  "./match3/match3.js",
  "./blockfit/blockfit.html",
  "./blockfit/blockfit.lang.js",
  "./blockfit/blockfit.js",
  "./runner/runner.html",
  "./runner/runner.lang.js",
  "./runner/runner.js",
  "./2048/2048.html",
  "./2048/2048.lang.js",
  "./2048/2048.js",
  "./snake/snake.html",
  "./snake/snake.lang.js",
  "./snake/snake.js",
  "./stacker/stacker.html",
  "./stacker/stacker.lang.js",
  "./stacker/stacker.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const isNav = req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isNav) {
    // 导航/HTML:network-first
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        // 离线兜底:ignoreSearch 让带 ?g/?p 的导航命中干净路径缓存(如 match3/match3.html),
        // 否则带 query 必 miss、一律回退 index.html → 路由器再跳 → 相对路径越套越深 = 死循环
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
    );
  } else {
    // 静态资源:cache-first
    e.respondWith(
      caches.match(req).then((r) => r || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }))
    );
  }
});
