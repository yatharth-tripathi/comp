/**
 * SalesContent AI — Service Worker.
 *
 * Strategy: Network-first with offline fallback.
 *
 * On install: cache the app shell (offline page, key assets).
 * On fetch: try network first. If network fails AND we have a cached
 * version, serve it. For navigation requests (HTML), serve the offline
 * fallback page if the network is down.
 *
 * We intentionally do NOT cache API responses — stale data in a CRM is
 * worse than no data. The offline page explains that the agent needs
 * connectivity for real-time features and offers to retry.
 */

const CACHE_NAME = "salescontent-v1";
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
];

// Install — precache the offline shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// Fetch — network-first, offline fallback for navigations
self.addEventListener("fetch", (event) => {
  // Skip non-GET and cross-origin
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Skip API calls — we never serve stale API data
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful navigation responses for offline
        if (response.ok && event.request.mode === "navigate") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        // Network failed — try cache, then offline fallback
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (event.request.mode === "navigate") {
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) return offlinePage;
        }

        return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
      }),
  );
});
