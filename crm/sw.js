// Service worker del CRM. Fase 1: solo cachea el shell estatico para que la PWA sea instalable.
// Bump CACHE_VERSION en cada deploy que deba invalidar el shell cacheado.
const CACHE_VERSION = 'lotus-crm-shell-v1';
const SHELL_FILES = [
  './index.html',
  './app.js',
  './manifest.json',
  './logolotus.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase/CDN externos: siempre red

  // app.js/index.html: stale-while-revalidate (mostrar shell cacheado ya, actualizar en segundo plano)
  const isCoreShell = url.pathname.endsWith('/app.js') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/crm/');
  if (isCoreShell) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Resto de estaticos propios (iconos, manifest, logo): cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

// Notificaciones de asistencia (asistencia-recordatorio). El payload viene
// como JSON: {title, body, url, critico}.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Lotus 360 CRM', {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: data.url || './index.html?accion=marcar-asistencia' },
    tag: data.critico ? 'asistencia-critico' : 'asistencia',
    requireInteraction: !!data.critico,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || './index.html?accion=marcar-asistencia';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
