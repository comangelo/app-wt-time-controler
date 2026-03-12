const CACHE_NAME = "wt-timer-cache-v3";

// App shell mínimo (para que sea instalable)
const APP_SHELL = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Precarga mínima. Si falla alguna ruta, no rompe la instalación.
            return cache.addAll(APP_SHELL).catch(() => {});
        })
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            // Limpia caches viejos
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

self.addEventListener("fetch", (event) => {
    const req = event.request;

    // Solo GET
    if (req.method !== "GET") return;

    // Evitar romper por esquemas raros (chrome-extension, data, blob, etc)
    let url;
    try {
        url = new URL(req.url);
    } catch {
        return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;

    // No cachear llamadas al backend /api
    if (url.pathname.startsWith("/api")) return;

    // No cachear recursos de extensiones o scripts externos (emergent, posthog, etc)
    // (y de paso evitamos CORS/opaque responses raras)
    const isSameOrigin = url.origin === self.location.origin;
    if (!isSameOrigin) return;

    // No cachear cosas que suelen cambiar o causar problemas
    if (
        url.pathname.startsWith("/sockjs-node") ||
        url.pathname.includes("hot-update") ||
        url.pathname.endsWith(".map")
    ) {
        return;
    }

    // Estrategia: Network-first para HTML; Cache-first para assets
    const isHTML =
        req.mode === "navigate" ||
        (req.headers.get("accept") || "").includes("text/html");

    if (isHTML) {
        event.respondWith(networkFirst(req));
        return;
    }

    event.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const fresh = await fetch(req);

        // Solo cachea respuestas buenas y del mismo origen
        if (fresh && fresh.ok && fresh.type !== "opaque") {
            cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
    } catch (e) {
        const cached = await cache.match(req);
        if (cached) return cached;

        // fallback a index (SPA)
        const fallback = await cache.match("/index.html");
        if (fallback) return fallback;

        throw e;
    }
}

async function cacheFirst(req) {
    const cache = await caches.open(CACHE_NAME);

    const cached = await cache.match(req);
    if (cached) return cached;

    const fresh = await fetch(req);
    if (fresh && fresh.ok && fresh.type !== "opaque") {
        cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
}

// Listen for the message from the app to skip waiting and activate the new service worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
