/* eslint-disable no-restricted-globals */

// ⬇️ Sube este número cuando publiques cambios importantes
const CACHE_VERSION = "v4";

const CACHE_NAME = `wt-timer-cache-${CACHE_VERSION}`;

// App shell mínimo (NO metas /static/* porque CRA ya se gestiona distinto)
// Esto hace que sea instalable sin romper nada.
const APP_SHELL = [
    "/",
    "/index.html",
    "/manifest.json",
];

// Detectar backend (ajusta si cambias dominio)
const BACKEND_HOSTS = new Set([
    "app-wt-time-controler.onrender.com",
]);

function isHttpRequest(request) {
    try {
        const url = new URL(request.url);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function isBackendRequest(request) {
    try {
        const url = new URL(request.url);

        // Si tu frontend llama a /api/... en el mismo dominio (proxy), también lo excluimos
        if (url.pathname.startsWith("/api/")) return true;

        // Si llama directo a Render por hostname, lo excluimos
        if (BACKEND_HOSTS.has(url.hostname)) return true;

        return false;
    } catch {
        return false;
    }
}

self.addEventListener("install", (event) => {
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL);
        })
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            // Borra caches antiguos
            const keys = await caches.keys();
            await Promise.all(
                keys.map((key) => {
                    if (key.startsWith("wt-timer-cache-") && key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                    return Promise.resolve();
                })
            );

            await self.clients.claim();
        })()
    );
});

// Estrategia:
// - Navegación (HTML): Network-first con fallback a cache (para SPA)
// - Assets GET (mismo dominio): Stale-while-revalidate
// - Backend/API: SIEMPRE network (sin cache)
self.addEventListener("fetch", (event) => {
    const req = event.request;

    // Ignora esquemas raros: chrome-extension:// etc.
    if (!isHttpRequest(req)) return;

    // No cacheamos nada que no sea GET
    if (req.method !== "GET") return;

    // No cachear backend / api
    if (isBackendRequest(req)) return;

    const url = new URL(req.url);

    // 1) Navegación (cuando cambias de vista en la SPA o recargas)
    if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
        event.respondWith(
            (async () => {
                try {
                    const fresh = await fetch(req);
                    // opcional: actualiza cache del index
                    const cache = await caches.open(CACHE_NAME);
                    cache.put("/index.html", fresh.clone());
                    return fresh;
                } catch (err) {
                    const cache = await caches.open(CACHE_NAME);
                    const cached = await cache.match("/index.html");
                    return cached || Response.error();
                }
            })()
        );
        return;
    }

    // 2) Assets en el mismo dominio: stale-while-revalidate
    // (css/js/icons/imagenes)
    if (url.origin === self.location.origin) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(CACHE_NAME);
                const cached = await cache.match(req);

                const fetchPromise = fetch(req)
                    .then((fresh) => {
                        if (fresh && fresh.ok) cache.put(req, fresh.clone());
                        return fresh;
                    })
                    .catch(() => null);

                // devuelve cache si existe, si no, espera red
                return cached || (await fetchPromise) || Response.error();
            })()
        );
    }
});
