/* frontend/public/sw.js */

const CACHE_NAME = "wt-timer-cache-v4";

// App shell mínimo (lo básico para que sea instalable sin romper cosas)
const APP_SHELL = [
    "/",
    "/index.html",
    "/manifest.json",
];

// INSTALL: toma control rápido
self.addEventListener("install", (event) => {
    self.skipWaiting();

    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            await cache.addAll(APP_SHELL);
        })()
    );
});

// ACTIVATE: aquí es donde BORRAMOS caches antiguos
self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();

            await Promise.all(
                keys
                    .filter((k) => k.startsWith("wt-timer-cache-") && k !== CACHE_NAME)
                    .map((k) => caches.delete(k))
            );

            await self.clients.claim();
        })()
    );
});

// FETCH: cache-first SOLO para GET http/https (y NO cachea backend)
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Ignorar esquemas raros como chrome-extension://
    if (url.protocol !== "http:" && url.protocol !== "https:") return;

    // Muy importante: NO cachear tu backend (Render)
    if (url.hostname.includes("onrender.com")) return;

    // No cachear POST/PUT/etc
    if (event.request.method !== "GET") return;

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME);

            // Si existe en cache, úsalo
            const cached = await cache.match(event.request);
            if (cached) return cached;

            // Si no, baja de red y guarda
            const response = await fetch(event.request);
            if (response && response.ok) {
                await cache.put(event.request, response.clone());
            }
            return response;
        })()
    );
});
