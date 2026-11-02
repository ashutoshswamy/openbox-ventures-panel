// Installable-app shell. Deliberately caches NO pages or API data (everything is behind login):
// only hashed build assets + one offline page.
const VERSION = "v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll([OFFLINE, "/android-chrome-192x192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
  } else if (url.origin === location.origin && url.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(request, copy));
      return res;
    })));
  }
});
