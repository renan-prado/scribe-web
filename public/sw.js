// Minimal service worker. Its only job is to satisfy the browser's
// installability requirements so users can add Scriba to the home screen
// (Android/Chrome/Edge). We intentionally do NOT cache anything — the app is
// data-heavy and stale caches would silently break live transcription.
//
// If we ever want offline support or background sync, extend here.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Presence of a fetch handler is what marks the SW as "controlling" in the
// eyes of the install-prompt heuristic — even if we just let the network do
// its thing.
self.addEventListener("fetch", () => {
  // no-op — default browser fetch handling
});
