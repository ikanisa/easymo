// Scaffolded service worker for the admin offline roadmap. Detailed caching and
// background sync policies will be finalised during Phase 7.
// Bump SW_VERSION to invalidate previous caches on deploy
const SW_VERSION = "v3";
const SHELL_CACHE = `easymo-shell-${SW_VERSION}`;
const RUNTIME_CACHE = `easymo-runtime-${SW_VERSION}`;
const STATIC_CACHE = `easymo-static-${SW_VERSION}`;
const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

const STATIC_PREFIXES = ["/_next/static/", "/icons/", "/screenshots/", "/fonts/"];
const NETWORK_FIRST_PATTERNS = [/^\/_next\/data\//, /^\/api\//, /^\/notifications/, /^\/settings/];
const SYNC_TAG = "admin-offline-sync";
const BG_SYNC_DB = "admin-offline-queue";
const BG_SYNC_STORE = "requests";
const OFFLINE_POST_TARGETS = [/^\/api\/notifications/];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => ![SHELL_CACHE, RUNTIME_CACHE, STATIC_CACHE].includes(key)).map((key) =>
        caches.delete(key)
      ),
    );
    await self.clients.claim();

    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: "SW_ACTIVATED" });
    }
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "SW_FLUSH_QUEUE") {
    event.waitUntil(replayQueuedRequests());
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === "POST" && shouldQueue(request)) {
    event.respondWith(handleOfflinePost(event, request));
    return;
  }

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  if (STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
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
    return;
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(replayQueuedRequests());
  }
});

async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Avoid referencing process.env in SW context
    try { console.warn('sw.cache_first_failed', error); } catch (_) {}
    return new Response("", { status: 503 });
  }
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
      // Serve offline fallback page when navigation fails
      const shell = await caches.open(SHELL_CACHE);
      const offline = await shell.match('/offline.html');
      if (offline) return offline;
      return new Response("Offline. Please reconnect and refresh.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    if (request.headers.get("accept")?.includes("application/json")) {
      return new Response(
        JSON.stringify({ error: "offline", message: "Request queued while offline." }),
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

function shouldQueue(request) {
  return OFFLINE_POST_TARGETS.some((pattern) => pattern.test(new URL(request.url).pathname));
}

async function handleOfflinePost(event, request) {
  try {
    return await fetch(request.clone());
  } catch (_error) {
    // Queue request for retry even if Background Sync is unavailable
    const id = await queueRequest(request);
    if ('sync' in self.registration) {
      try {
        await self.registration.sync.register(SYNC_TAG);
      } catch (syncError) {
        try { console.warn('sw.sync_register_failed', syncError); } catch (_) {}
      }
    }
    await notifyClients({
      type: 'SW_BACKGROUND_SYNC_QUEUED',
      requestId: id,
      url: request.url,
      method: request.method,
    });

    return new Response(
      JSON.stringify({
        queued: true,
        message: 'Request saved offline and will retry automatically when connectivity is restored.',
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

async function openQueueDb() {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(BG_SYNC_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(BG_SYNC_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function queueRequest(request) {
  const db = await openQueueDb();
  const tx = db.transaction(BG_SYNC_STORE, 'readwrite');
  const store = tx.objectStore(BG_SYNC_STORE);
  const id = crypto.randomUUID();
  const cloned = request.clone();
  let body = null;
  try {
    body = await cloned.text();
  } catch (error) {
    console.warn('sw.queue_body_read_failed', error);
  }
  const headers = Array.from(request.headers.entries());
  const record = {
    id,
    url: request.url,
    method: request.method,
    headers,
    body,
    credentials: request.credentials,
    timestamp: Date.now(),
  };
  store.put(record);
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }).catch((error) => console.warn('sw.queue_transaction_failed', error));
  db.close();
  return id;
}

async function readQueuedRequests() {
  const db = await openQueueDb();
  const tx = db.transaction(BG_SYNC_STORE, 'readonly');
  const store = tx.objectStore(BG_SYNC_STORE);
  const items = await store.getAll();
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }).catch((error) => console.warn('sw.queue_read_failed', error));
  db.close();
  return items ?? [];
}

async function removeQueuedRequest(id) {
  const db = await openQueueDb();
  const tx = db.transaction(BG_SYNC_STORE, 'readwrite');
  const store = tx.objectStore(BG_SYNC_STORE);
  store.delete(id);
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }).catch((error) => console.warn('sw.queue_delete_failed', error));
  db.close();
}

async function replayQueuedRequests() {
  const items = await readQueuedRequests();
  if (!items.length) return;

  for (const item of items) {
    const headers = new Headers(item.headers ?? []);
    const init = {
      method: item.method,
      headers,
      body: item.body,
      credentials: item.credentials,
    };
    try {
      const response = await fetch(item.url, init);
      if (response.ok) {
        await removeQueuedRequest(item.id);
        await notifyClients({
          type: 'SW_BACKGROUND_SYNC_SUCCESS',
          requestId: item.id,
          status: response.status,
        });
      } else if (response.status >= 500) {
        await notifyClients({
          type: 'SW_BACKGROUND_SYNC_RETRY',
          requestId: item.id,
          status: response.status,
        });
      } else {
        await removeQueuedRequest(item.id);
        await notifyClients({
          type: 'SW_BACKGROUND_SYNC_DROPPED',
          requestId: item.id,
          status: response.status,
        });
      }
    } catch (error) {
      console.warn('sw.queue_replay_failed', error);
    }
  }
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage(message);
  }
}
