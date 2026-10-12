const CACHE_NAME = 'clock-app-v3.3.6';

// Activate immediately without waiting for open tabs
self.addEventListener('install', () => {
    self.skipWaiting();
});

// Clear old caches and take control of all tabs
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Network-first strategy: try the network first, fall back to the cache if offline
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Ignore non-GET requests (POST, etc)
    if (request.method !== 'GET') return;

    // Ignore requests to external URLs or chrome-extension
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                // Network response ok: cache it and return
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Network failed: try to serve from the cache
                return caches.match(request);
            })
    );
});
