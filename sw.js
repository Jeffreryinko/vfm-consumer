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

/* 알림 (수파베이스가 보냄) */
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "뷰티·폰게임 자판기", {
    body: d.body || "", tag: d.tag || "cs", data: { url: d.url || "./" },
    icon: "./assets/icon-192.png", badge: "./assets/icon-192.png", renotify: !!d.tag,
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.split("#")[0] === url.split("#")[0] && "focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
