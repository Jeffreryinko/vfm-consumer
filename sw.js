/* 화면 파일은 저장해 두고(빠르게), 자료(data/)는 늘 새로 받되 끊기면 저장본을 씀 */
const V = "cs-v1";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(V).then(c => c.addAll(["./", "index.html", "assets/app.css?v=1", "assets/app.js?v=1", "assets/joy.js?v=1", "assets/ask.js?v=1"]).catch(() => {}))); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.includes("/data/")) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(m => { const f = fetch(e.request).then(r => { caches.open(V).then(x => x.put(e.request, r.clone())); return r; }).catch(() => m); return m || f; }));
  }
});
