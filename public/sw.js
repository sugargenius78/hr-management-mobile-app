self.addEventListener('install', (event) => {
    console.log('PWA Service Worker installed');
});

self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});