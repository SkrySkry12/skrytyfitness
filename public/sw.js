const CACHE = 'skr-fitness-v8';
const CORE = ['/', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Network first, cache fallback. API calls are never cached; only successful responses are stored.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(response => response || (event.request.mode === 'navigate' ? caches.match('/') : undefined)))
  );
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* plain text payload */ }
  event.waitUntil(self.registration.showNotification(data.title || 'SkrySkry Fitness', {
    body: data.body || 'Czas na zaplanowany posiłek.',
    icon: '/icon.svg', badge: '/icon.svg', tag: 'skry-meal-reminder',
    renotify: true, data: { url: data.url || '/' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    for (const client of windows) {
      if ('focus' in client) { client.navigate(target); return client.focus(); }
    }
    return clients.openWindow(target);
  }));
});
