self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));

      await self.clients.claim();

      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      await Promise.allSettled(
        clients
          .filter((client) => 'navigate' in client && client.url.startsWith(self.location.origin))
          .map((client) => client.navigate(client.url)),
      );
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Network-first for HTML and JS/CSS assets to avoid stale-bundle errors
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' || /\.(html|js|css)$/.test(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
  }
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'Versa',
    body: 'New notification!',
    url: '/',
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (error) {
    console.error('Error parsing push data:', error);
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Versa', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  const absoluteUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          // Tell the SPA to navigate via React Router (works in iOS PWA where client.navigate is flaky)
          try { client.postMessage({ type: 'NAVIGATE', url }); } catch {}
          try { if ('navigate' in client) await client.navigate(absoluteUrl); } catch {}
          if ('focus' in client) return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteUrl);
      }

      return undefined;
    }),
  );
});