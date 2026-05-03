/* DocVault PWA Service Worker
 *
 * Minimal service worker — installs the PWA as a desktop / mobile app
 * (Chrome, Edge, Safari iOS "Add to Home Screen", etc.) and provides a
 * basic offline shell so the app can at least show a friendly screen
 * when the network is flaky.
 *
 * We intentionally do NOT cache API responses — data must always be
 * fresh for a multi-tenant document app. Only the HTML shell + static
 * assets are cached.
 */

const CACHE_VERSION = "docvault-shell-v1";
const CORE_ASSETS = [
  "/api/web/",
  "/api/web/index.html",
  "/api/web/favicon.png",
  "/api/web/logo.png",
  "/api/web/logo.svg",
  "/api/web/apple-touch-icon.png",
  "/api/web/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((c) =>
        // Don't fail the whole install if one asset is missing
        Promise.all(
          CORE_ASSETS.map((u) => c.add(u).catch(() => undefined)),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION && k.startsWith("docvault-"))
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // NEVER touch API calls, WebSocket upgrades, or non-GET — fresh data only.
  if (req.method !== "GET") return;
  if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/web/")) return;
  if (req.headers.get("upgrade") === "websocket") return;

  // For the static /api/web/ shell & assets → stale-while-revalidate.
  if (url.pathname.startsWith("/api/web/")) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
