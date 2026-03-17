const CACHE_NAME = 'clock-app-v3.3.3';

// Ativa imediatamente sem esperar por abas abertas
self.addEventListener('install', () => {
    self.skipWaiting();
});

// Limpa caches antigos e toma controle de todas as abas
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

// Network-first strategy: tenta a rede primeiro, cai pro cache se offline
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Ignora requests não-GET (POST, etc)
    if (request.method !== 'GET') return;

    // Ignora requests para URLs externas ou chrome-extension
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                // Resposta da rede ok: cacheia e retorna
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Rede falhou: tenta servir do cache
                return caches.match(request);
            })
    );
});
