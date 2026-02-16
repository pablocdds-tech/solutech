const CACHE_NAME = "vitaliano-erp-v1";
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  "/",
  "/dashboard",
  "/login",
  "/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Ignore cache errors during install
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL).then((response) =>
          response || new Response("Offline", { status: 503 })
        )
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request)
    )
  );
});
