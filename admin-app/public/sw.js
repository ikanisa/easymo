const SHELL_CACHE = "easymo-shell-v1";
const RUNTIME_CACHE = "easymo-runtime-v1";
const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

const STATIC_PREFIXES = ["/_next/static/", "/icons/", "/screenshots/", "/fonts/"];
const NETWORK_FIRST_PATTERNS = [
  /^\/_next\/data\//,
  /^\/api\//,
  /^\/notifications/,
  /^\/settings/,
  /^\/vouchers/,
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE).map((key) =>
        caches.delete(key)
      ),
    );
    await self.clients.claim();

    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    for (const client of clients) {
      client.postMessage({ type: "SW_ACTIVATED" });
    }
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (SHELL_ASSETS.includes(url.pathname) || STATIC_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix)
  )) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (NETWORK_FIRST_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith("/_next/image")) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (_error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await caches.match("/");
      if (shell) return shell;
    }
    if (request.headers.get("accept")?.includes("application/json")) {
      return new Response(
        JSON.stringify({ error: "offline", message: "Request intercepted offline." }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return new Response("", { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedPromise = cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  const cached = await cachedPromise;
  return cached ?? await networkPromise ?? new Response("", { status: 503 });
}
