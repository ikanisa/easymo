// EasyMO Admin PWA Service Worker - Aurora Theme v4
// Production-ready with advanced caching strategies

const SW_VERSION = 'v4-aurora';
const SHELL_CACHE = `easymo-shell-${SW_VERSION}`;
const RUNTIME_CACHE = `easymo-runtime-${SW_VERSION}`;
const STATIC_CACHE = `easymo-static-${SW_VERSION}`;
const IMAGE_CACHE = `easymo-images-${SW_VERSION}`;
const FONT_CACHE = `easymo-fonts-${SW_VERSION}`;

// Critical assets to precache
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

// Cache size limits
const CACHE_LIMITS = {
  runtime: 100,
  images: 50,
  fonts: 20,
};

// URL patterns for different caching strategies
const STATIC_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icons\//,
  /^\/fonts\//,
];

const NETWORK_FIRST_PATTERNS = [
  /^\/_next\/data\//,
  /^\/api\//,
  /^\/dashboard/,
  /^\/users/,
  /^\/marketplace/,
];

const STALE_WHILE_REVALIDATE_PATTERNS = [
  /^\/_next\/image/,
  /^\/screenshots\//,
];

// Background sync configuration
const SYNC_TAG = 'admin-offline-sync';
const BG_SYNC_DB = 'admin-offline-queue';
const BG_SYNC_STORE = 'requests';
const OFFLINE_POST_TARGETS = [
  /^\/api\/notifications/,
  /^\/api\/users/,
  /^\/api\/settings/,
];

// ============================================
// INSTALL EVENT
// ============================================
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing ${SW_VERSION}`);
  
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    
    try {
      await cache.addAll(PRECACHE_URLS);
      console.log('[SW] Precache complete');
    } catch (error) {
      console.warn('[SW] Precache failed:', error);
    }
    
    await self.skipWaiting();
  })());
});

// ============================================
// ACTIVATE EVENT
// ============================================
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating ${SW_VERSION}`);
  
  event.waitUntil((async () => {
    const cacheKeys = await caches.keys();
    const currentCaches = [SHELL_CACHE, RUNTIME_CACHE, STATIC_CACHE, IMAGE_CACHE, FONT_CACHE];
    
    await Promise.all(
      cacheKeys
        .filter((key) => !currentCaches.includes(key))
        .map((key) => {
          console.log(`[SW] Deleting old cache: ${key}`);
          return caches.delete(key);
        })
    );
    
    await self.clients.claim();
    
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ 
        type: 'SW_ACTIVATED',
        version: SW_VERSION,
      });
    }
    
    console.log('[SW] Activation complete');
  })());
});

// ============================================
// FETCH EVENT
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (url.origin !== self.location.origin) {
    return;
  }
  
  if (request.method === 'POST' && shouldQueueRequest(request)) {
    event.respondWith(handleOfflinePost(request));
    return;
  }
  
  if (request.method !== 'GET') {
    return;
  }
  
  const strategy = getCachingStrategy(url.pathname);
  
  switch (strategy) {
    case 'cache-first':
      event.respondWith(cacheFirst(request));
      break;
    case 'network-first':
      event.respondWith(networkFirst(request));
      break;
    case 'stale-while-revalidate':
      event.respondWith(staleWhileRevalidate(request));
      break;
    case 'network-only':
      break;
    default:
      if (request.mode === 'navigate') {
        event.respondWith(navigationHandler(request));
      }
  }
});

// ============================================
// MESSAGE EVENT
// ============================================
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'SW_FLUSH_QUEUE':
      event.waitUntil(replayQueuedRequests());
      break;
      
    case 'CACHE_URLS':
      event.waitUntil(cacheUrls(payload?.urls || []));
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(clearCache(payload?.cacheName));
      break;
      
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: SW_VERSION });
      break;
  }
});

// ============================================
// SYNC EVENT (Background Sync)
// ============================================
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(replayQueuedRequests());
  }
});

// ============================================
// PUSH EVENT (Future: Push Notifications)
// ============================================
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'New notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: true,
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'EasyMO Admin', options)
  );
});

// ============================================
// NOTIFICATION CLICK
// ============================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/dashboard';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ============================================
// CACHING STRATEGIES
// ============================================

function getCachingStrategy(pathname) {
  if (PRECACHE_URLS.includes(pathname)) {
    return 'cache-first';
  }
  
  if (STATIC_PATTERNS.some(pattern => pattern.test(pathname))) {
    return 'cache-first';
  }
  
  if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(pathname))) {
    return 'network-first';
  }
  
  if (STALE_WHILE_REVALIDATE_PATTERNS.some(pattern => pattern.test(pathname))) {
    return 'stale-while-revalidate';
  }
  
  return 'default';
}

async function cacheFirst(request) {
  const cacheName = getCacheNameForRequest(request);
  const cache = await caches.open(cacheName);
  
  try {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[SW] Cache-first failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      await limitCacheSize(RUNTIME_CACHE, CACHE_LIMITS.runtime);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    
    if (request.headers.get('accept')?.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'offline', message: 'You are offline.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
        limitCacheSize(IMAGE_CACHE, CACHE_LIMITS.images);
      }
      return response;
    })
    .catch(() => null);
  
  return cached || await fetchPromise || new Response('', { status: 503 });
}

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    
    const shellCache = await caches.open(SHELL_CACHE);
    const offlinePage = await shellCache.match('/offline.html');
    if (offlinePage) {
      return offlinePage;
    }
    
    return new Response('Offline. Please reconnect and refresh.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getCacheNameForRequest(request) {
  const url = new URL(request.url);
  
  if (PRECACHE_URLS.includes(url.pathname)) {
    return SHELL_CACHE;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    return STATIC_CACHE;
  }
  if (url.pathname.startsWith('/_next/image') || url.pathname.includes('/screenshots/')) {
    return IMAGE_CACHE;
  }
  if (url.pathname.startsWith('/fonts/')) {
    return FONT_CACHE;
  }
  return RUNTIME_CACHE;
}

async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    const deleteCount = keys.length - maxItems;
    await Promise.all(
      keys.slice(0, deleteCount).map((key) => cache.delete(key))
    );
  }
}

async function cacheUrls(urls) {
  const cache = await caches.open(RUNTIME_CACHE);
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
      }
    } catch (error) {
      console.warn(`[SW] Failed to cache ${url}:`, error);
    }
  }
}

async function clearCache(cacheName) {
  if (cacheName) {
    await caches.delete(cacheName);
  } else {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

// ============================================
// OFFLINE POST HANDLING (Background Sync)
// ============================================

function shouldQueueRequest(request) {
  const url = new URL(request.url);
  return OFFLINE_POST_TARGETS.some((pattern) => pattern.test(url.pathname));
}

async function handleOfflinePost(request) {
  try {
    return await fetch(request.clone());
  } catch (error) {
    const id = await queueRequest(request);
    
    if ('sync' in self.registration) {
      try {
        await self.registration.sync.register(SYNC_TAG);
      } catch (syncError) {
        console.warn('[SW] Sync registration failed:', syncError);
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
        requestId: id,
        message: 'Request saved. Will retry when online.',
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function openQueueDb() {
  return new Promise((resolve, reject) => {
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
    console.warn('[SW] Failed to read request body:', error);
  }
  
  const record = {
    id,
    url: request.url,
    method: request.method,
    headers: Array.from(request.headers.entries()),
    body,
    credentials: request.credentials,
    timestamp: Date.now(),
  };
  
  store.put(record);
  
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }).catch((error) => console.warn('[SW] Queue transaction failed:', error));
  
  db.close();
  return id;
}

async function replayQueuedRequests() {
  const db = await openQueueDb();
  const tx = db.transaction(BG_SYNC_STORE, 'readonly');
  const store = tx.objectStore(BG_SYNC_STORE);
  
  const items = await new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
  
  db.close();
  
  if (!items.length) return;
  
  console.log(`[SW] Replaying ${items.length} queued requests`);
  
  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: new Headers(item.headers || []),
        body: item.body,
        credentials: item.credentials,
      });
      
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
      console.warn('[SW] Replay failed:', error);
    }
  }
}

async function removeQueuedRequest(id) {
  const db = await openQueueDb();
  const tx = db.transaction(BG_SYNC_STORE, 'readwrite');
  tx.objectStore(BG_SYNC_STORE).delete(id);
  
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  }).catch(() => {});
  
  db.close();
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage(message);
  }
}

console.log(`[SW] Service Worker ${SW_VERSION} loaded`);
