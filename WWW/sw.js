/* FairPlay Service Worker
   版本号 = 缓存名(唯一来源):fairplay.major.minor.patch
   导航/HTML = network-first(联网拿最新,离线回退缓存);静态资源 = cache-first */
const VERSION = "fairplay.0.0.2";

const SHELL = [
  "./",
  "./index.html",
  "./common.css",
  "./pack.js",
  "./games.js",
  "./index.lang.en.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./match3/match3.html",
  "./match3/match3.lang.en.js",
  "./match3/match3.invcode.js",
  "./match3/match3.js",
  "./mathdoku/mathdoku.html",
  "./mathdoku/mathdoku.lang.en.js",
  "./mathdoku/mathdoku.invcode.js"
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
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
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
