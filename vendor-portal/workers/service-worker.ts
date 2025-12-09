/// <reference lib="webworker" />

/**
 * Service Worker for Ibimina Staff Console PWA
 *
 * This service worker implements a comprehensive caching strategy to ensure
 * the application works offline and provides optimal performance.
 *
 * Caching Strategies:
 * - Precaching: Critical app shell resources are cached at install time
 * - Stale-While-Revalidate (SWR): For static assets that can be served from cache
 *   while being updated in the background
 * - Network-First: For pages and API data to ensure fresh content when online
 * - Cache-First: For fonts and icons that rarely change
 *
 * Accessibility: Includes offline fallback page that adheres to WCAG 2.1 AA standards
 *
 * @see https://developer.chrome.com/docs/workbox/
 */

import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches, type PrecacheEntry } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { syncQueuedOnboarding } from "../lib/offline/onboarding-queue";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry>;
};

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev-build";
const OFFLINE_URL = "/offline";
const OFFLINE_PAGES = [OFFLINE_URL, "/offline/help", "/offline/snapshots"];
const BG_SYNC_TAG = "ibimina-offline-sync";

let lastQueueCount = 0;
let authScopeHash = "guest";
const AUTH_SCOPED_CACHE_PREFIXES = ["app-shell", "api-routes"];

async function broadcast(message: Record<string, unknown>) {
  const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clientList) {
    client.postMessage(message);
  }
}

async function clearAuthScopedCaches() {
  try {
    const cacheNames = await caches.keys();
    const deletions = cacheNames.filter((name) =>
      AUTH_SCOPED_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix))
    );
    await Promise.all(deletions.map((cacheName) => caches.delete(cacheName)));
  } catch (error) {
    console.warn("sw.auth_cache_clear_failed", error);
  }
}

// Immediately activate the service worker and take control of all clients
self.skipWaiting();
clientsClaim();

// Precache critical app shell resources
// The workbox plugin injects the manifest at build time via __WB_MANIFEST
precacheAndRoute(
  [...(self.__WB_MANIFEST ?? []), ...OFFLINE_PAGES.map((url) => ({ url, revision: BUILD_ID }))],
  {
    // Ignore common tracking parameters that don't affect content
    ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
  }
);

// Remove outdated caches from previous versions
cleanupOutdatedCaches();

/**
 * Cache Strategy: Stale-While-Revalidate (SWR) for Next.js static assets
 *
 * These assets (JS, CSS) are hashed and immutable. We serve from cache first
 * for instant loading while revalidating in the background.
 *
 * WCAG 2.1 AA Compliance: Fast loading improves accessibility for users
 * with cognitive disabilities or slow connections.
 */
registerRoute(
  ({ url }) => url.pathname.startsWith("/_next/static/"),
  new StaleWhileRevalidate({
    cacheName: "next-static-assets",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 128,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

/**
 * Cache Strategy: Cache-First for fonts
 *
 * Fonts rarely change and should be served from cache first
 * for optimal performance. This captures font requests via the
 * standard request.destination property.
 *
 * Note: For CDN-hosted fonts, additional URL pattern matching
 * may be needed in a separate route.
 */
registerRoute(
  ({ request }) => request.destination === "font",
  new CacheFirst({
    cacheName: "fonts",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 32,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        purgeOnQuotaError: true,
      }),
    ],
  })
);

/**
 * Helper: Check if request is for an icon
 */
const isIconRequest = ({ request, url }: { request: Request; url: URL }) => {
  return request.destination === "image" && url.pathname.startsWith("/icons/");
};

/**
 * Cache Strategy: Cache-First for icons
 *
 * Application icons should be served from cache for instant loading.
 */
registerRoute(
  isIconRequest,
  new CacheFirst({
    cacheName: "icons",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 32,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        purgeOnQuotaError: true,
      }),
    ],
  })
);

/**
 * Cache Strategy: Stale-While-Revalidate for CSS and other style resources
 *
 * Serve styles from cache for immediate rendering while updating in background.
 */
registerRoute(
  ({ request }) => request.destination === "style",
  new StaleWhileRevalidate({
    cacheName: "static-resources",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 64,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

/**
 * Cache Strategy: Network-First for page navigation
 *
 * For HTML pages, always try the network first to get fresh content.
 * Falls back to cache if network is unavailable (offline mode).
 *
 * This ensures users always see the latest content when online while
 * maintaining offline functionality.
 */
registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "app-shell",
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 32, purgeOnQuotaError: true }),
    ],
  })
);

/**
 * Cache Strategy: Network-First for API routes and data
 *
 * API calls should prioritize fresh data from the network.
 * Short-term caching (60 seconds) provides a fallback for offline use
 * and reduces repeated identical requests.
 */
registerRoute(
  ({ url }) =>
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/supabase"),
  new NetworkFirst({
    cacheName: "api-routes",
    networkTimeoutSeconds: 6,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200, 204] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 }),
    ],
  })
);

/**
 * Offline Fallback Handler
 *
 * When all caching strategies fail (e.g., user is offline and resource
 * is not cached), this handler provides a graceful fallback.
 *
 * For document requests, serves the offline page which includes:
 * - Clear messaging about offline status
 * - WCAG 2.1 AA compliant design (contrast ratios, focus indicators)
 * - Actionable options to retry or navigate to cached pages
 */
setCatchHandler(async ({ event }) => {
  const fetchEvent = event as FetchEvent;
  if (fetchEvent.request?.destination === "document") {
    const cached = await caches.match(OFFLINE_URL);
    if (cached) {
      return cached;
    }
  }

  return Response.error();
});

/**
 * Service Worker Message Handler
 *
 * Listens for messages from the client (main app) to control
 * service worker behavior.
 *
 * SKIP_WAITING: Allows the client to force activation of a new service worker
 * version without waiting for all tabs to close.
 */
self.addEventListener("message", (event) => {
  const { data } = event;
  if (!data || typeof data !== "object") {
    return;
  }

  switch (data.type) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;
    case "OFFLINE_QUEUE_REGISTER":
      event.waitUntil(
        broadcast({
          type: "SW_QUEUE_STATUS",
          count: lastQueueCount,
          scope: authScopeHash,
          timestamp: Date.now(),
        })
      );
      break;
    case "OFFLINE_QUEUE_UPDATED":
      lastQueueCount = typeof data.count === "number" ? data.count : 0;
      event.waitUntil(
        broadcast({
          type: "SW_QUEUE_STATUS",
          count: lastQueueCount,
          scope: authScopeHash,
          timestamp: Date.now(),
        })
      );
      break;
    case "OFFLINE_QUEUE_PROCESS":
      event.waitUntil(
        (async () => {
          try {
            await syncQueuedOnboarding();
          } catch (error) {
            console.warn("sw.onboarding_queue.sync_failed", error);
          }
          await broadcast({
            type: "OFFLINE_QUEUE_PROCESS",
            reason: data.reason ?? "manual",
          });
        })()
      );
      break;
    case "AUTH_SCOPE_UPDATE":
      authScopeHash = typeof data.hash === "string" ? data.hash : authScopeHash;
      break;
    case "AUTH_CACHE_RESET":
      authScopeHash = "guest";
      event.waitUntil(
        (async () => {
          await clearAuthScopedCaches();
          await broadcast({
            type: "AUTH_CACHE_RESET",
          });
        })()
      );
      break;
    default:
      break;
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === BG_SYNC_TAG) {
    event.waitUntil(
      (async () => {
        try {
          await syncQueuedOnboarding();
        } catch (error) {
          console.warn("sw.onboarding_queue.sync_failed", error);
        }
        await broadcast({
          type: "OFFLINE_QUEUE_PROCESS",
          reason: "background-sync",
        });
      })()
    );
  }
});
