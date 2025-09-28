self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// TODO Phase 7: implement offline cache strategy and background sync
self.addEventListener("fetch", () => {
  // network-first placeholder
});
