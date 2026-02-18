const CACHE_NAME = "wt-timer-cache-v1";

// App shell mínimo (lo básico para que sea instalable sin romper cosas)
const APP_SHELL = [
    "/",
    "/index.html",
    "/manifest.json",
];

self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Ignorar esquemas raros como chrome-extension://
    if (url.protocol !== "http:" && url.protocol !== "https:") return;

    // Muy importante: NO cachear tu backend
    if (event.request.method !== "GET") return;

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            try {
                const response = await fetch(event.request);
                if (response && response.ok) {
                    await cache.put(event.request, response.clone());
                }
                return response;
            } catch (e) {
                const cached = await cache.match(event.request);
                if (cached) return cached;
                throw e;
            }
        })
    );
});
