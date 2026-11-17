// Minimal hand-rolled service worker — no next-pwa/serwist dependency, kept
// deliberately simple (this is an e-commerce site: correctness of live
// prices/stock matters more than offline support). Its only real jobs are
// (1) satisfy the browser's installability requirement (a fetch handler
// must exist) and (2) speed up repeat loads of Next's hashed static assets.
//
// Nothing under /api/* is ever cached (prices/stock/cart must always be
// live), and HTML navigations always go to the network — Next.js's own
// routing/SSR/streaming needs a real request, and a stale cached shell would
// be actively misleading for a storefront.
const CACHE_NAME = "az-static-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Known-static files under /public worth caching. Deliberately an allow
// list, not a deny list: Next.js also serves RSC payloads (?_rsc=... query)
// and prefetch data through plain same-origin GETs that don't start with
// /api/ or carry request.mode "navigate" — those carry real product/price
// data and must never be cached, so anything not explicitly listed here
// just falls through to the network untouched.
const STATIC_FILES = new Set([
  "/icon.png",
  "/apple-icon.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/favicon.ico",
  "/hero-logo.png",
  "/manifest.webmanifest",
]);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for Next's content-hashed build output — safe because the
  // filename itself changes whenever the content does.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (STATIC_FILES.has(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? fetchPromise;
}
