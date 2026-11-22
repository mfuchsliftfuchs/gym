// Offline: serve from cache, refresh in background so new versions arrive on the next start.
// shortcut: files refresh one by one, so a start right after a release can mix old and new files once; bump CACHE if a release changes how files fit together.
const CACHE = "gym-v2";
const FILES = ["./", "index.html", "style.css", "app.js", "logic.js", "exercises.js", "manifest.webmanifest", "icon-180.png", "icon-512.png"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const net = fetch(e.request).then(async (r) => {
    if (r.ok || r.type === "opaque") await (await caches.open(CACHE)).put(e.request, r.clone());
    return r;
  });
  e.waitUntil(net.catch(() => {})); // keep the worker alive until the cache is updated
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || net));
});
