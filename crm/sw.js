// Service worker del CRM. Fase 1: solo cachea el shell estatico para que la PWA sea instalable.
// Bump CACHE_VERSION en cada deploy que deba invalidar el shell cacheado.
//
// Hallazgo real (2026-07-19): './index.html' redirige (308) a './' en el
// servidor (comportamiento estandar de Cloudflare Pages con "clean URLs").
// cache.addAll() sigue el redirect y cachea la respuesta final, pero la
// marca internamente como "redirected" -- Chrome/Chromium RECHAZA servir una
// Response con redirected=true como respuesta a una navegación
// (net::ERR_FAILED), aunque el body sea válido. La PWA instalada (start_url
// apuntando a index.html) siempre pegaba ese camino roto; una pestaña normal
// del navegador no, porque pedía '/' directo. Se cachea './' en vez de
// './index.html' para no arrastrar el redirect.
const CACHE_VERSION = 'lotus-crm-shell-v10';
const SHELL_FILES = [
  './',
  './app.js',
  './manifest.json',
  './logolotus.png',
  './logolotus-integrado.png',
  './offline.html',
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

  // Chrome/Chromium rechaza (net::ERR_FAILED) cualquier respuesta con
  // redirected=true para una navegación -- ver hallazgo real arriba. Instalaciones
  // viejas de la PWA (manifest cacheado con start_url=index.html) pueden seguir
  // pidiendo esta ruta un tiempo; se responde con un redirect explícito y limpio
  // en vez de dejar pasar el 308 del servidor ya "consumido" por un fetch normal.
  if (request.mode === 'navigate' && url.pathname.endsWith('/index.html')) {
    event.respondWith(Response.redirect(url.origin + url.pathname.replace(/index\.html$/, ''), 302));
    return;
  }

  // app.js: stale-while-revalidate (mostrar shell cacheado ya, actualizar en segundo plano)
  const isCoreShell = url.pathname.endsWith('/app.js') || url.pathname === '/' || url.pathname.endsWith('/crm/');
  if (isCoreShell) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        }).catch(() => cached || cache.match('./offline.html'));
        return cached || network;
      })
    );
    return;
  }

  // Navegaciones (ej. deep link directo, refresh): si no hay cache ni red, mostrar offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).catch(() => caches.match('./offline.html')))
    );
    return;
  }

  // Resto de estaticos propios (iconos, manifest, logo): cache-first, cacheando oportunisticamente en el miss
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const res = await fetch(request);
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
  );
});

// Notificaciones push (asistencia-recordatorio*, notificar_lead). Payload
// JSON: {title, body, url, critico?, actions?}. `actions` son los botones
// nativos (ej. Atender/No puedo) -- Android/Chrome/Edge los muestran, iOS
// Safari los ignora sin más (limitación real de WebKit, no hay forma de
// arreglarlo desde acá: ahí solo queda tocar la notificación entera).
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Destino y Eventos Lotus 360 CRM', {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: data.url || './?accion=marcar-asistencia' },
    tag: data.critico ? 'asistencia-critico' : (data.tag || 'asistencia'),
    requireInteraction: !!data.critico,
    actions: data.actions || undefined,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let url = event.notification.data?.url || './?accion=marcar-asistencia';
  // Botón de acción nativo tocado (ver notificarNuevoLeadPush): se agrega
  // ?accion=<action> a la URL del lead para que la página, ya con sesión,
  // ejecute lo mismo que el botón del inbox (manejarDeepLinkLeadAccion).
  if (event.action === 'atender' || event.action === 'no_puedo') {
    url += (url.includes('?') ? '&' : '?') + 'accion=' + event.action;
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
