// Minimal service worker for installable PWA
// Caches the app shell; allows the browser to show the "Install" prompt
// and lets the installed app open even with a brief connection hiccup.

const CACHE = "docvault-shell-v1";
const SHELL = ["/", "/manifest.json", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Never cache API calls — always go to network for fresh data
  if (req.url.includes("/api/")) {
    return;
  }

  // Stale-while-revalidate for static assets
  if (req.method === "GET" && req.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE).then((cache) => cache.put(req, clone));
            }
            return networkResponse;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
