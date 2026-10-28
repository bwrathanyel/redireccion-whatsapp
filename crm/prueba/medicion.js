/* Medición de la práctica: qué toca cada persona, cuánto tarda por misión, dónde se traba.
   Carga ANTES que prueba-mock.js para quedarse con el fetch real (el mock lo reemplaza).
   Única salida permitida por el gate del build: la Edge Function prueba-telemetria. */
(() => {
  'use strict';
  const URL_TELEMETRIA = 'https://begbjhrdbsqftbbleecb.supabase.co/functions/v1/prueba-telemetria';
  const fetchReal = window.fetch.bind(window);
  // prueba-mock.js parchea Storage.prototype con el prefijo 'prueba:': se guardan los métodos sin parche.
  const { getItem, setItem } = Storage.prototype;
  const ss = (k, v) => { try { return v === undefined ? getItem.call(sessionStorage, k) : setItem.call(sessionStorage, k, v); } catch { return null; } };
  const nombre = () => ss('prueba:prueba:nombre') || '';
  const rol = () => ss('prueba:prueba:rol') || '';
  const uuid = () => crypto.randomUUID?.() || '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
  // Otra persona u otro cargo en la misma pestaña = sesión nueva; si no, se mezclarían en la sección Inducción.
  let sesion = null;
  const sesionActual = () => {
    const quien = nombre() + '|' + rol();
    if (!sesion || ss('prueba:medicion:quien') !== quien) {
      sesion = ss('prueba:medicion:quien') === quien && ss('prueba:medicion:sesion') || uuid();
      ss('prueba:medicion:sesion', sesion); ss('prueba:medicion:quien', quien);
    }
    return sesion;
  };

  let cola = [], seccion = null, apagado = false, ultimoMov = Date.now(), quieto = false;
  const mision = () => window.__pruebaMision?.() || null;
  const corta = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  function anota(tipo, detalle, extra = {}) {
    if (apagado || !nombre() || !rol() || cola.length >= 300) return;
    cola.push({ tipo, ts: Date.now(), seccion: extra.seccion ?? seccion, mision: extra.mision !== undefined ? extra.mision : mision(), detalle: detalle || undefined });
    if (cola.length >= 100) manda();
  }
  function cuerpo(lote, fin) { return JSON.stringify({ sesion: sesionActual(), nombre: nombre(), rol: rol(), eventos: lote, fin }); }
  async function manda() {
    if (apagado || !cola.length || !nombre() || !rol()) return;
    const lote = cola.splice(0, 100);
    try {
      const r = await fetchReal(URL_TELEMETRIA, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: cuerpo(lote, false), keepalive: true });
      // 4xx/429 = la sesión llegó a su tope o la forma no pasa: no tiene sentido seguir insistiendo.
      if (r.status === 429 || r.status === 400 || r.status === 403 || r.status === 413) apagado = true;
      else if (!r.ok) cola.unshift(...lote.slice(0, 300 - cola.length));
    } catch { cola.unshift(...lote.slice(0, 300 - cola.length)); }
  }
  function despide() {
    if (apagado || !nombre() || !rol()) return;
    const lote = cola.splice(0, 100);
    try { navigator.sendBeacon(URL_TELEMETRIA, new Blob([cuerpo(lote, true)], { type: 'text/plain' })); } catch { /* sin beacon */ }
  }
  setInterval(manda, 10000);
  addEventListener('pagehide', despide);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') manda(); });

  /* Lo que avisa misiones.js: inicio/fin/salto/reinicio de cada misión y cambio de sección. */
  addEventListener('prueba:medir', e => {
    const d = e.detail || {};
    if (d.tipo === 'seccion') { seccion = d.seccion || null; return anota('seccion', null, { seccion }); }
    anota(d.tipo, null, { mision: d.mision ?? null });
  });
  /* Lo que pasa por el backend simulado. El login ya se anota con el nombre y el cargo. */
  addEventListener('prueba:accion', e => {
    const d = e.detail || {};
    if (d.tipo === 'login') return anota('inicio', { rol: rol() });
    if (d.tipo !== 'rpc' && d.tipo !== 'fn') return;
    anota('accion', { [d.tipo]: corta(d.nombre, 60), ...(d.error ? { error: corta(d.error, 120) } : {}) });
  });
  addEventListener('error', e => anota('error', { msg: corta(e.message, 160) }));
  addEventListener('unhandledrejection', e => anota('error', { msg: corta(e.reason?.message || e.reason, 160) }));

  /* Clics: selector corto + texto visible, sin coordenadas. */
  const selector = el => {
    if (!el || el === document.body) return '';
    if (el.id) return '#' + el.id;
    const cls = [...el.classList].slice(0, 2).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  document.addEventListener('click', e => {
    const el = e.target.closest?.('button,a,[role="tab"],[data-sec],summary,label,input,select,tr,li,.card,[onclick]') || e.target;
    if (el?.closest?.('#prueba-panel')) {
      const b = el.closest('button[data-acc]');
      return anota('clic', { el: 'panel:' + (b?.dataset.acc || 'cabecera') });
    }
    if (el?.closest?.('#lyra-sugs')) anota('lyra', { texto: corta(el.textContent, 300), sugerencia: true });
    anota('clic', { el: selector(el), txt: corta(el?.textContent || el?.value || el?.getAttribute?.('aria-label'), 40) || undefined });
  }, true);

  /* Preguntas a Lyra y búsquedas: el texto se lee antes de que la app vacíe el campo. */
  const preguntaLyra = () => { const t = corta(document.getElementById('lyra-input')?.value, 300); if (t) anota('lyra', { texto: t }); };
  document.addEventListener('click', e => { if (e.target.closest?.('#lyra-send')) preguntaLyra(); }, true);
  document.addEventListener('keydown', e => { if (e.target.id === 'lyra-input' && e.key === 'Enter' && !e.shiftKey) preguntaLyra(); }, true);
  let busca = null;
  document.addEventListener('input', e => {
    const t = e.target;
    if (!t?.matches?.('input[type="search"],#tar-search,[id*="search"],[id*="buscar"]')) return;
    clearTimeout(busca);
    busca = setTimeout(() => { const v = corta(t.value, 100); if (v.length > 1) anota('busqueda', { texto: v, campo: t.id || undefined }); }, 1200);
  }, true);

  /* Tiempo quieto: más de 30 s sin tocar nada se anota al volver, con los segundos. */
  const mueve = () => {
    const ahora = Date.now();
    if (quieto) { quieto = false; anota('inactivo', { seg: Math.round((ahora - ultimoMov) / 1000) }); }
    ultimoMov = ahora;
  };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(t => document.addEventListener(t, mueve, { capture: true, passive: true }));
  setInterval(() => { if (!quieto && Date.now() - ultimoMov > 30000 && document.visibilityState === 'visible') quieto = true; }, 5000);
})();
