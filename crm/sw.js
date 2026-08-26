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
const CACHE_VERSION = 'lotus-crm-shell-v145';
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
  './icons/icon-maskable-192.png',
  './icons/badge-72.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    // `cache: 'reload'` obliga a ir a la red por cada archivo del shell,
    // salteando el caché HTTP del navegador.
    //
    // Sin esto el arreglo del incidente del 2026-08-03 quedaba a medias: el
    // `addAll` es atómico entre sí, pero si el navegador tiene el `app.js`
    // anterior todavía fresco en su caché HTTP, `addAll` guarda ESE junto con
    // el `index.html` nuevo -- y vuelve a quedar el shell mezclado que dejó el
    // CRM inutilizable, solo que ahora entrando por la otra puerta.
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(SHELL_FILES.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION && k !== CACHE_IDENTIDAD).map((k) => caches.delete(k)))
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

  // El shell (index.html + app.js) se sirve del cache, pero NUNCA se
  // reescribe desde acá.
  //
  // Incidente real (2026-08-03): antes esto era stale-while-revalidate y cada
  // archivo revalidaba por su cuenta, escribiendo el resultado en el cache con
  // `cache.put`. index.html y app.js son DOS pedidos independientes que
  // terminan en momentos distintos, así que quedaba una ventana en la que el
  // cache tenía el app.js NUEVO junto al index.html VIEJO. Con esa mezcla, el
  // app.js nuevo buscaba elementos de una sección que el HTML viejo todavía no
  // tenía, reventaba en el arranque y el CRM quedaba inutilizable.
  //
  // Estos dos archivos SIEMPRE tienen que venir de la misma publicación. La
  // única escritura del shell es el `cache.addAll` del install, que es atómico:
  // o entran los dos archivos nuevos, o no entra ninguno. Si el cache no lo
  // tiene, se va a la red, pero no se guarda -- guardarlo es justo lo que
  // rompía la atomicidad. El shell nuevo entra cuando el service worker nuevo
  // instala y activa (skipWaiting + clients.claim), los dos archivos juntos.
  const isCoreShell = url.pathname.endsWith('/app.js') || url.pathname === '/' || url.pathname.endsWith('/crm/');
  if (isCoreShell) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        return fetch(request).catch(() => cache.match('./offline.html'));
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

// ---------------------------------------------------------------------------
//  Notificaciones push
// ---------------------------------------------------------------------------
// Emisores: asistencia-recordatorio*, notificar_lead, push-prueba. Payload
// JSON: {title, body, url, critico?, actions?, tag?, tipo?, envio?}.
// `actions` son los botones nativos (ej. Atender/No puedo) -- Android/Chrome/
// Edge los muestran, iOS Safari los ignora sin más (limitación real de WebKit,
// no hay forma de arreglarlo desde acá: ahí solo queda tocar la notificación
// entera, por eso los títulos que manda el backend son autosuficientes).
//
// El SW no puede leer la sesión de supabase-js: vive en localStorage, que un
// worker no ve. Por eso las dos cosas que necesita escribir en la base van por
// RPCs que no piden JWT y que solo pueden tocar una fila que YA existe:
// rotar_suscripcion_push (protegida por token_rotacion) y marcar_push_evento
// (protegida por el token del propio envío, que viaja cifrado en el payload).
// La llave publishable es la misma que ya está a la vista en app.js.
const SB_URL = 'https://begbjhrdbsqftbbleecb.supabase.co';
const SB_KEY = 'sb_publishable_M7Ms9DLwpNSCXZNCDhYtbQ_LhMYeLxk';
// Misma llave que app.js:VAPID_PUBLIC_KEY -- si cambia una, cambiar las dos.
const VAPID_PUBLIC_KEY = 'BA80pP1UGb4OaMkTh3dfioglbWmYs4lbSf2jmUUDM1LKwz3INE7U8Ia7R7qP6oLZnXRr8zfVqVzrzaQ60XjR8WQ';
// Sobrevive a la purga del activate: la identidad no es parte del shell y
// perderla dejaría al SW sin poder rotar la suscripción tras cada deploy.
const CACHE_IDENTIDAD = 'lotus-push-id';

function sbRpc(nombre, args) {
  return fetch(SB_URL + '/rest/v1/rpc/' + nombre, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
    body: JSON.stringify(args),
  }).catch(() => null);
}

function b64aBytes(base64String) {
  const base64 = (base64String + '='.repeat((4 - (base64String.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from([...atob(base64)].map((c) => c.charCodeAt(0)));
}

// La página deja acá {endpoint, token} tras cada registro (guardarIdentidadPush
// en app.js). Cache Storage es el único almacén que página y worker comparten:
// localStorage no lo ve un worker, e IndexedDB sería mucha maquinaria para dos
// campos.
async function leerIdentidad() {
  try {
    const res = await (await caches.open(CACHE_IDENTIDAD)).match('/__identidad');
    return res ? await res.json() : null;
  } catch { return null; }
}
async function guardarIdentidad(datos) {
  try {
    await (await caches.open(CACHE_IDENTIDAD)).put('/__identidad', new Response(JSON.stringify(datos)));
  } catch { /* modo privado / sin cuota: lo rehace la página al próximo arranque */ }
}

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  const envio = data.envio;
  event.waitUntil((async () => {
    // Mensajes del chat interno: si la persona ya tiene ESA conversación
    // abierta y con foco, ya lo está viendo en vivo por el canal realtime
    // (mensajes-badge, app.js) -- una notificación de sistema encima es
    // ruido puro. Solo aplica a tipo 'mensaje': para lead/asistencia se
    // mantiene el comportamiento de siempre (avisar igual).
    let suprimir = false;
    if (data.tipo === 'mensaje' && data.url) {
      try {
        const convId = new URL(data.url, self.location.origin).searchParams.get('conversacion');
        if (convId) {
          const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          suprimir = clientes.some((c) => c.focused && new URL(c.url).searchParams.get('conversacion') === convId);
        }
      } catch (e) { console.warn('chequeo de foco de mensaje', e); }
    }

    const tareas = [];
    if (!suprimir) {
      tareas.push(self.registration.showNotification(data.title || 'Destino y Eventos Lotus 360 CRM', {
        body: data.body || '',
        icon: './icons/icon-192.png',
        badge: './icons/badge-72.png',
        data: { url: data.url || './?accion=marcar-asistencia', envio },
        // Sin tag propio, todo caía en 'asistencia' y dos avisos distintos se
        // pisaban entre sí en la bandeja del SO. El colapso ahora se pide
        // explícito desde el backend (tag por lead, por fecha de asistencia);
        // el default es único justamente para que NO colapse nada por accidente.
        tag: data.critico ? 'asistencia-critico' : (data.tag || 'lotus-' + (data.timestamp || Date.now())),
        // Un lead sin atender no debería desaparecer solo de la bandeja.
        requireInteraction: !!data.critico || data.tipo === 'lead',
        renotify: true,
        vibrate: data.critico ? [120, 50, 120, 50, 120] : [80, 40, 80],
        timestamp: data.timestamp || Date.now(),
        lang: 'es',
        dir: 'ltr',
        silent: false,
        actions: data.actions || undefined,
      }));
    }
    // Se marca entregado aunque se haya suprimido la notificación visual: el
    // push SÍ llegó y el service worker lo procesó -- lo que mide esta marca
    // es que el dispositivo lo recibió, no que se haya dibujado un aviso del
    // sistema. Sin esto, cada mensaje suprimido por foco sumaría un "ok sin
    // entregar nunca" y el diagnóstico marcaría como fantasma una suscripción
    // sana.
    if (envio) tareas.push(sbRpc('marcar_push_evento', { p_id: envio.id, p_token: envio.token, p_evento: 'entregado' }));
    await Promise.all(tareas);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const datos = event.notification.data || {};
  let url = datos.url || './?accion=marcar-asistencia';
  // Botón de acción nativo tocado (ver notificarNuevoLeadPush): se agrega
  // ?accion=<action> a la URL del lead para que la página, ya con sesión,
  // ejecute lo mismo que el botón del inbox (manejarDeepLinkLeadAccion).
  if (event.action === 'atender' || event.action === 'no_puedo') {
    url += (url.includes('?') ? '&' : '?') + 'accion=' + event.action;
  }
  event.waitUntil((async () => {
    if (datos.envio) {
      await sbRpc('marcar_push_evento', { p_id: datos.envio.id, p_token: datos.envio.token, p_evento: 'click' });
    }
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) {
      // navigate() rechaza si el cliente no está en un estado navegable (pasa
      // con la PWA recién despertada). Sin este catch el toque no hacía nada:
      // la excepción cortaba el waitUntil y nunca se llegaba a openWindow.
      try { await c.navigate(url); return await c.focus(); }
      catch { /* probar el siguiente cliente y, si no hay, ventana nueva */ }
    }
    return self.clients.openWindow(url);
  })());
});

self.addEventListener('notificationclose', (event) => {
  console.info('Notificación descartada', event.notification.tag);
});

// El push service rota el endpoint por su cuenta (actualización del navegador,
// limpieza de datos del sitio, reinstalación). Sin este handler la suscripción
// moría en silencio: el backend recibía un 410, daba la fila por vencida, y la
// persona se quedaba sin avisos para siempre sin enterarse. Causa raíz
// principal de "dejaron de llegar de la nada".
//
// OJO: Chrome no lo dispara en todas las expiraciones y Safari no lo garantiza,
// así que este handler NO es la red de seguridad -- la red de seguridad es
// sincronizarSuscripcionPush() en app.js, que reconcilia en cada arranque.
// Esto es lo que cubre a quien no abre el CRM en varios días.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const ident = await leerIdentidad();
    const endpointViejo = (event.oldSubscription && event.oldSubscription.endpoint) || (ident && ident.endpoint);
    let nueva;
    try {
      nueva = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: (event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey) || b64aBytes(VAPID_PUBLIC_KEY),
      });
    } catch (e) {
      console.error('pushsubscriptionchange: no se pudo resuscribir', e);
      return;
    }
    if (endpointViejo && ident && ident.token) {
      const r = await sbRpc('rotar_suscripcion_push', {
        p_endpoint_viejo: endpointViejo,
        p_token: ident.token,
        p_subscription: nueva.toJSON(),
      });
      // El RPC devuelve false (con 200) si el endpoint viejo ya no está o el
      // token no coincide: eso NO es rotación exitosa, hay que dejarlo
      // pendiente para que lo repare la página.
      const rotada = r && r.ok && await r.json().then((v) => v === true).catch(() => false);
      if (rotada) {
        await guardarIdentidad({ ...ident, endpoint: nueva.endpoint, pendiente: false });
        return;
      }
    }
    // Sin identidad, sin token o sin red: queda marcada como pendiente y la
    // levanta sincronizarSuscripcionPush() la próxima vez que se abra el CRM.
    await guardarIdentidad({ ...(ident || {}), endpoint: nueva.endpoint, pendiente: true });
  })());
});
