/// <reference lib="WebWorker" />

export {};

type PushAction = {
  action: string;
  title: string;
  icon?: string;
};

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{
    revision?: string | null;
    url: string;
  }>;
};

const isWindowClient = (client: Client): client is WindowClient => 'navigate' in client;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));

      await self.clients.claim();

      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      await Promise.allSettled(
        windowClients
          .filter(isWindowClient)
          .filter((client) => client.url.startsWith(self.location.origin))
          .map((client) => client.navigate(client.url)),
      );
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

void self.__WB_MANIFEST;

self.addEventListener('push', (event) => {
  let data: {
    title?: string;
    body?: string;
    url?: string;
    actions?: PushAction[];
  } = {
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

  const options: NotificationOptions = {
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

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client && 'navigate' in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }

      return undefined;
    }),
  );
});
