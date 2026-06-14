const CACHE_NAME = "success-planner-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg"
];

// Install event - pre-cache critical shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching app shell");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Clearing stale cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network-first with cache fallback for HTML, CSS, JS; bypass Firestore/Auth APIs
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Avoid intercepting third-party API keys, Firebase Auth, Google Firestore, metadata JSON, or POST/PUT operations
  if (
    event.request.method !== "GET" ||
    url.origin.includes("googleapis.com") ||
    url.origin.includes("firebaseapp.com") ||
    url.origin.includes("identitytoolkit") ||
    url.pathname.includes("/api/") ||
    url.pathname.endsWith(".json")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Guard checking that response is valid and from same origin/static CDN before caching
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.origin === self.location.origin || url.href.startsWith("https://fonts."))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fall back to cache if network is completely offline
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If searching for index.html or root subpages, return root shell
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
        });
      })
  );
});
