const CACHE_NAME = 'clock-app-v2.2.0';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/main.js',
    '/manifest.json',
    '/icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Cache hit - retorna a resposta
            if (response) {
                return response;
            }
            return fetch(event.request).then((response) => {
                // Checa se recebeu uma resposta valida
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                // Clona a resposta
                const responseToCache = response.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return response;
            });
        })
    );
});
