// Interfaz propia del modo Prueba: burbuja movible (tareas y niveles), Lyra solo en el menú lateral
// y entrega de PDF (descargar, o compartir a un chat de la bandeja). Requiere prueba-mock.js cargado antes.
(() => {
  'use strict';
  const g = window, P = g.__PRUEBA;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

  /* ---------- Burbuja movible ---------- */
  // Se suelta contra el borde más cercano; lado + altura relativa sobreviven a recargas y a girar el teléfono.
  // left/top van divididos por el zoom del body (el CRM vive en body{zoom:.9}).
  const MARGEN = 10, BOLA = 52, CLAVE = 'burbuja';
  const clamp = (n, a, b) => Math.min(Math.max(a, n), Math.max(a, b));
  const zoomBody = () => parseFloat(getComputedStyle(document.body).zoom) || 1;
  const altoLibre = () => innerHeight - (parseFloat(getComputedStyle(document.body).getPropertyValue('--bi-h')) || 0);
  const leePos = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; } };
  g.__pruebaBurbuja = (el, { asa, alMover } = {}) => {
    let a = null, saltaClick = false;
    function ubica() {
      if (!el.isConnected || a?.vivo) return;
      const { lado = 'der', y = .72 } = leePos(), z = zoomBody(), w = el.offsetWidth * z, h = el.offsetHeight * z, H = altoLibre();
      const left = lado === 'der' ? innerWidth - w - MARGEN : MARGEN;
      const top = clamp(MARGEN + y * (H - 2 * MARGEN - BOLA), MARGEN, H - h - MARGEN);
      el.dataset.lado = lado;
      Object.assign(el.style, { left: left / z + 'px', top: top / z + 'px', right: 'auto', bottom: 'auto', transform: 'none' });
    }
    el.dataset.burbuja = '';
    el.__ubica = ubica;
    el.addEventListener('pointerdown', e => {
      if (e.button) return;
      if (!el.classList.contains('pb-bola') && (!e.target.closest(asa) || e.target.closest('button,a,input,textarea,select,summary'))) return;
      const r = el.getBoundingClientRect();
      a = { id: e.pointerId, x0: e.clientX, y0: e.clientY, left: r.left, top: r.top, w: r.width, h: r.height, vivo: false, raf: 0 };
    });
    const mueve = () => {
      a.raf = 0;
      const z = zoomBody();
      a.x = clamp(a.left + a.dx, MARGEN, innerWidth - a.w - MARGEN); a.y = clamp(a.top + a.dy, MARGEN, altoLibre() - a.h - MARGEN);
      Object.assign(el.style, { left: a.x / z + 'px', top: a.y / z + 'px' });
      alMover?.();
    };
    el.addEventListener('pointermove', e => {
      if (!a || e.pointerId !== a.id) return;
      // El mouse salió y soltó fuera antes del umbral: ese arrastre ya no existe.
      if (!e.buttons) { a = null; return; }
      a.dx = e.clientX - a.x0; a.dy = e.clientY - a.y0;
      // Umbral de 6 px: un toque con temblor de dedo no se convierte en arrastre.
      if (!a.vivo) {
        if (Math.hypot(a.dx, a.dy) < 6) return;
        a.vivo = true; el.classList.add('pb-arrastra'); el.setPointerCapture(a.id);
      }
      if (!a.raf) a.raf = requestAnimationFrame(mueve);
    });
    const suelta = e => {
      if (!a || e.pointerId !== a.id) return;
      const b = a; a = null; cancelAnimationFrame(b.raf);
      if (!b.vivo) return;
      el.classList.remove('pb-arrastra');
      if (e.type === 'pointerup') {
        const x = clamp(b.left + b.dx, MARGEN, innerWidth - b.w - MARGEN), y = clamp(b.top + b.dy, MARGEN, altoLibre() - b.h - MARGEN);
        try { localStorage.setItem(CLAVE, JSON.stringify({ lado: x + b.w / 2 > innerWidth / 2 ? 'der' : 'izq', y: clamp((y - MARGEN) / Math.max(1, altoLibre() - 2 * MARGEN - BOLA), 0, 1) })); } catch { /* sin storage: vuelve a su lugar */ }
        saltaClick = true; setTimeout(() => { saltaClick = false; }, 300);
      }
      ubica(); alMover?.();
    };
    el.addEventListener('pointerup', suelta); el.addEventListener('pointercancel', suelta);
    // El click que sigue a un arrastre no cuenta como toque.
    el.addEventListener('click', e => { if (saltaClick) { saltaClick = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    new ResizeObserver(ubica).observe(el);
    return { ubica };
  };
  addEventListener('resize', () => document.querySelectorAll('[data-burbuja]').forEach(el => el.__ubica?.()), { passive: true });

  /* ---------- Lyra: una opción más del menú lateral, sin círculo flotante ---------- */
  function lyraLateral() {
    const dock = $('lyra-dock'), pie = document.querySelector('.side-foot-row');
    if (!dock || !pie) return;
    dock.classList.remove('lyra-dock-mini');
    pie.before(dock);
    // Fase de captura: el menú del celular se cierra antes de que Lyra registre su hoja en el historial.
    dock.addEventListener('click', () => g.__pruebaCerrarMenu?.(), true);
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', lyraLateral); else lyraLateral();

  /* ---------- PDF: descargar y compartir a un chat de la bandeja ---------- */
  const pdfs = new Map();
  const esPdf = b => b instanceof Blob && (b.type === 'application/pdf' || /\.pdf$/i.test(b.name || ''));
  const comoFile = (b, nombre) => b instanceof File && b.name ? b : new File([b], nombre || 'documento.pdf', { type: 'application/pdf' });
  const crear = URL.createObjectURL.bind(URL), revocar = URL.revokeObjectURL.bind(URL), abrir = g.open.bind(g);
  URL.createObjectURL = o => { const u = crear(o); if (esPdf(o)) pdfs.set(u, o); return u; };
  URL.revokeObjectURL = u => { pdfs.delete(u); revocar(u); };

  function descargar(file) {
    const u = crear(file), a = document.createElement('a');
    a.href = u; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => revocar(u), 1000);
  }
  function ver(file) {
    const u = crear(file);
    if (!abrir(u, '_blank')) descargar(file);
    setTimeout(() => revocar(u), 60000);
  }
  async function irAlChat(id) {
    if ($('wb-buscar')) $('wb-buscar').value = '';
    g.__pruebaMisiones?.vista('wa-bandeja');
    if (!$('sec-wa-bandeja')?.classList.contains('active')) g.__pruebaIr?.('wa-bandeja');
    for (let i = 0; i < 40; i++) {
      const fila = document.querySelector(`#wb-inbox [data-wb="${id}"]`);
      if (fila) { fila.click(); return true; }
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }

  // Aviso que acompaña a todo PDF que sale del CRM: desde acá siempre se puede compartir.
  let avisoT = 0;
  function aviso(html, acciones) {
    $('pp-pdf-aviso')?.remove();
    clearTimeout(avisoT);
    const t = document.createElement('div');
    t.id = 'pp-pdf-aviso'; t.setAttribute('role', 'status');
    t.innerHTML = `${html}<span class="ppa-acc">${Object.entries(acciones).map(([k, { texto, ppal }]) => `<button type="button" data-a="${k}"${ppal ? ' class="ppa-ppal"' : ''}>${texto}</button>`).join('')}<button type="button" data-a="x" aria-label="Cerrar">×</button></span>`;
    t.addEventListener('click', e => {
      const b = e.target.closest('button[data-a]'); if (!b) return;
      t.remove(); clearTimeout(avisoT);
      acciones[b.dataset.a]?.fn();
    });
    document.body.appendChild(t);
    avisoT = setTimeout(() => t.remove(), 15000);
  }
  function avisoPdf(file, { conVer = true, conBajar = true } = {}) {
    aviso(`<i class="fas fa-file-pdf" aria-hidden="true"></i><b title="${esc(file.name)}">${esc(file.name)}</b>`, {
      ...(conVer ? { ver: { texto: 'Ver', fn: () => ver(file) } } : {}),
      ...(conBajar ? { bajar: { texto: 'Descargar', fn: () => descargar(file) } } : {}),
      compartir: { texto: '<i class="fas fa-share-nodes" aria-hidden="true"></i> Compartir', ppal: true, fn: () => hoja(file).catch(() => {}) },
    });
  }

  const ventanaAbierta = c => !!c.ultimo_entrante_at && Date.now() - Date.parse(c.ultimo_entrante_at) < 24 * 3600e3;
  async function enviar(c, file) {
    const fd = new FormData();
    fd.append('conversacion_id', String(c.id)); fd.append('tipo', 'documento'); fd.append('archivo', file, file.name);
    const r = await fetch('https://fn.demo.invalid/whatsapp-enviar', { method: 'POST', body: fd }).then(x => x.json()).catch(() => null);
    return !!r?.ok;
  }
  // Se resuelve al enviar o descargar y rechaza con AbortError al cerrar: el mismo contrato que navigator.share.
  function hoja(file) {
    return new Promise((resuelve, rechaza) => {
      $('pp-pdf-hoja')?.remove();
      const h = document.createElement('div');
      h.id = 'pp-pdf-hoja'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-label', 'Compartir PDF');
      const tecla = e => { if (e.key === 'Escape') { e.stopPropagation(); cancela(); } };
      const cierra = () => { h.remove(); removeEventListener('keydown', tecla, true); };
      const cancela = () => { cierra(); rechaza(new DOMException('Cancelado', 'AbortError')); };
      const chats = () => [...(P.m.tablas.whatsapp_conversaciones || [])].sort((a, b) => String(b.ultimo_mensaje_at || '').localeCompare(String(a.ultimo_mensaje_at || '')));
      h.innerHTML = `<div class="pph-caja"><header><div><b>¿A qué cliente se lo mandas?</b><small title="${esc(file.name)}">${esc(file.name)}</small></div><button type="button" data-a="x" aria-label="Cerrar">×</button></header>
        <input type="search" placeholder="Buscar en la bandeja" aria-label="Buscar cliente en la bandeja">
        <div class="pph-lista"></div><p class="pph-error" role="alert" hidden></p>
        <footer><button type="button" data-a="ver">Ver PDF</button><button type="button" data-a="bajar"><i class="fas fa-download" aria-hidden="true"></i> Descargar</button></footer></div>`;
      const lista = h.querySelector('.pph-lista'), q = h.querySelector('input');
      const pintaLista = () => {
        const t = q.value.trim().toLowerCase(), todas = chats(), filas = todas.filter(c => !t || `${c.nombre} ${c.wa_id}`.toLowerCase().includes(t));
        lista.innerHTML = filas.map(c => {
          const abierta = ventanaAbierta(c), ini = String(c.nombre || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
          return `<button type="button" class="pph-fila" data-c="${esc(c.id)}"${abierta ? '' : ' disabled'}><span class="pph-ava">${esc(ini)}</span><span class="pph-txt"><b>${esc(c.nombre || c.wa_id)}</b><small>${abierta ? '+' + esc(c.wa_id) : 'Ventana cerrada: solo plantilla'}</small></span><i class="fas fa-paper-plane" aria-hidden="true"></i></button>`;
        }).join('') || `<p class="pph-vacio">${todas.length ? 'Ningún cliente coincide.' : 'Todavía no hay clientes en la bandeja.'}</p>`;
      };
      q.addEventListener('input', pintaLista);
      h.addEventListener('click', async e => {
        if (e.target === h) return cancela();
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.a === 'x') return cancela();
        if (b.dataset.a === 'ver') return ver(file);
        if (b.dataset.a === 'bajar') { descargar(file); cierra(); resuelve(); return; }
        const c = chats().find(x => String(x.id) === b.dataset.c); if (!c) return;
        h.querySelectorAll('button').forEach(x => { x.disabled = true; });
        if (await enviar(c, file)) {
          cierra(); resuelve();
          aviso(`<i class="fas fa-circle-check" aria-hidden="true"></i><b>Enviado a ${esc(c.nombre)}</b>`, { chat: { texto: 'Ver chat', ppal: true, fn: () => irAlChat(c.id) } });
          return;
        }
        const err = h.querySelector('.pph-error'); err.textContent = 'No se pudo enviar. Intenta de nuevo.'; err.hidden = false;
        pintaLista(); h.querySelectorAll('footer button,header button').forEach(x => { x.disabled = false; });
      });
      addEventListener('keydown', tecla, true);
      pintaLista();
      document.body.appendChild(h);
      if (matchMedia('(pointer:fine)').matches) q.focus();
    });
  }

  /* ---------- Compartir con lead vinculado: el chat simulado que le falta (la previa es la del CRM real) ---------- */
  function chatDelLead(lead) {
    const T = P.m.tablas, convs = T.whatsapp_conversaciones ||= [], msgs = T.whatsapp_mensajes ||= [];
    const previo = convs.find(c => c.lead_id === lead.id);
    if (previo) return previo;
    const wa = String(lead.telefono || '').replace(/\D/g, '');
    if (!wa) return null;
    // Casi ningún lead sembrado tiene chat: se simula que ya escribió, para que la ventana de 24 h esté abierta.
    const t = new Date().toISOString(), sig = (l, base) => Math.max(base, ...l.map(x => x.id).filter(Number.isInteger)) + 1;
    const conv = { id: sig(convs, 499), nombre: lead.nombre, wa_id: wa, no_leidos: 0, ultimo_mensaje_at: t, ultimo_entrante_at: t, lead_id: lead.id, asesor: lead.asesor, phone_number_id: 'prueba' };
    convs.push(conv);
    msgs.push({ id: sig(msgs, 69999), conversacion_id: conv.id, wamid: `prueba-lead-${lead.id}`, direccion: 'entrante', tipo: 'text', texto: 'Hola, ¿me envías la cotización por aquí?', enviado_en: t, estado: null, error: null, enviado_por: null, plantilla: null, media_id: null, media_mime: null, media_path: null, transcripcion: null });
    return conv;
  }
  g.__pruebaChatDelLead = leadId => { const lead = (P.m.tablas.leads || []).find(l => l.id === leadId); if (lead) chatDelLead(lead); };

  // Todo PDF del CRM pasa por una de estas salidas; ninguna toca el código de cada módulo.
  const alBajar = a => { const b = pdfs.get(a.href); if (b && a.download) avisoPdf(comoFile(b, a.download), { conBajar: false }); };
  const clickA = HTMLAnchorElement.prototype.click, despacha = EventTarget.prototype.dispatchEvent;
  HTMLAnchorElement.prototype.click = function () { alBajar(this); return clickA.call(this); };
  // doc.save() de jsPDF no llama a click(): despacha un MouseEvent sobre un <a> fuera del DOM.
  HTMLAnchorElement.prototype.dispatchEvent = function (ev) { if (ev.type === 'click') alBajar(this); return despacha.call(this, ev); };

  const share0 = navigator.share?.bind(navigator), can0 = navigator.canShare?.bind(navigator);
  const pdfDe = d => (d?.files || []).find(esPdf);
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: d => !!pdfDe(d) || !!can0?.(d) });
  Object.defineProperty(navigator, 'share', { configurable: true, value: async d => {
    const f = pdfDe(d);
    if (f) return hoja(comoFile(f, d.title));
    if (share0) return share0(d);
    await navigator.clipboard?.writeText(d?.url || d?.text || '');
  } });

  g.open = (url, ...resto) => {
    const u = String(url ?? '');
    if (pdfs.has(u)) { const w = abrir(u, ...resto); avisoPdf(comoFile(pdfs.get(u)), { conVer: !w }); return w; }
    if (!/\/\/demo\.invalid\/storage\//.test(u)) return abrir(url, ...resto);
    if (/prueba-blob\//.test(u)) return abrir(P.fotoLocal(u), ...resto);
    // Archivo del Storage simulado: demo.invalid no existe como página, se entrega desde el mock.
    const nombre = decodeURIComponent(u.split(/[?#]/)[0].split('/').pop()) || 'documento.pdf';
    fetch(u).then(x => x.blob()).then(b => { if (esPdf(b)) avisoPdf(comoFile(b, nombre)); else abrir(crear(b), '_blank'); }).catch(() => {});
    return null;
  };

  /* ---------- Estilos ---------- */
  const css = document.createElement('style');
  css.textContent = `
[data-burbuja]{position:fixed;transition:left .24s cubic-bezier(.22,1,.36,1),top .24s cubic-bezier(.22,1,.36,1)}
[data-burbuja].pb-arrastra{transition:none;cursor:grabbing;scale:1.06}
[data-burbuja].pb-bola{cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
#lyra-fab,#lyra-globo{display:none!important}
#lyra-dock{flex:none;width:auto;margin:0 12px 8px;padding:6px 10px 6px 6px;gap:10px;border-radius:12px}
#lyra-dock .lyra-orb{--s:32px;animation:none}
#lyra-dock.nuevo::after{top:4px;left:30px}
#pp-pdf-aviso{position:fixed;left:50%;bottom:calc(16px + var(--bi-h,0px) + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:99990;display:flex;align-items:center;gap:10px;width:max-content;max-width:calc(100vw - 24px);padding:8px 8px 8px 14px;border-radius:14px;background:var(--panel-solid,#1b1b1f);border:1px solid var(--line2,rgba(255,255,255,.14));box-shadow:0 16px 36px -14px rgba(0,0,0,.65);color:var(--txt,#eee);font:13px/1.35 system-ui,sans-serif}
#pp-pdf-aviso b{min-width:0;flex:1 1 auto;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:600}
#pp-pdf-aviso .ppa-acc{display:flex;flex:none;align-items:center;gap:4px}
#pp-pdf-aviso button{font:inherit;min-height:36px;padding:6px 10px;border:0;border-radius:10px;background:transparent;color:inherit;cursor:pointer}
#pp-pdf-aviso button.ppa-ppal{background:#ffb020;color:#1a1200;font-weight:600}
#pp-pdf-hoja{position:fixed;inset:0;z-index:99991;display:grid;place-items:center;padding:16px;background:rgba(8,8,12,.6);color:var(--txt,#eee);font:14px/1.4 system-ui,sans-serif}
#pp-pdf-hoja .pph-caja{display:flex;flex-direction:column;gap:10px;width:min(420px,100%);max-height:min(78dvh,600px);padding:16px;border-radius:18px;background:var(--panel-solid,#1b1b1f);border:1px solid var(--line2,rgba(255,255,255,.14));box-shadow:0 30px 60px -20px rgba(0,0,0,.8)}
#pp-pdf-hoja header{display:flex;align-items:flex-start;gap:10px}
#pp-pdf-hoja header>div{flex:1;min-width:0}
#pp-pdf-hoja header small{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--muted,#aaa);font-size:12.5px}
#pp-pdf-hoja button{font:inherit;color:inherit;cursor:pointer}
#pp-pdf-hoja header button{width:36px;height:36px;border:0;border-radius:10px;background:transparent;font-size:18px}
#pp-pdf-hoja input{box-sizing:border-box;width:100%;min-height:42px;padding:9px 12px;border-radius:12px;border:1px solid var(--line2,rgba(255,255,255,.2));background:rgba(255,255,255,.04);color:inherit;font:inherit}
#pp-pdf-hoja .pph-lista{flex:1;min-height:120px;overflow:auto;display:grid;align-content:start;gap:4px;overscroll-behavior:contain}
#pp-pdf-hoja .pph-fila{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:7px 10px;border:0;border-radius:12px;background:transparent;text-align:left}
#pp-pdf-hoja .pph-fila:hover:not(:disabled),#pp-pdf-hoja .pph-fila:focus-visible{background:rgba(255,176,32,.1)}
#pp-pdf-hoja .pph-fila:disabled{opacity:.5;cursor:default}
#pp-pdf-hoja .pph-fila>i{color:var(--muted,#aaa);font-size:13px}
#pp-pdf-hoja .pph-ava{flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#25d366;color:#05301a;font-weight:700;font-size:13px}
#pp-pdf-hoja .pph-txt{flex:1;min-width:0}
#pp-pdf-hoja .pph-txt b,#pp-pdf-hoja .pph-txt small{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#pp-pdf-hoja .pph-txt small{color:var(--muted,#aaa);font-size:12px}
#pp-pdf-hoja .pph-vacio{margin:18px 0;text-align:center;color:var(--muted,#aaa)}
#pp-pdf-hoja .pph-error{margin:0;color:#ff8a7a;font-size:13px}
#pp-pdf-hoja footer{display:flex;justify-content:flex-end;gap:8px}
#pp-pdf-hoja footer button{min-height:40px;padding:8px 14px;border-radius:10px;border:1px solid var(--line2,rgba(255,255,255,.14));background:transparent}
@media(max-width:760px){body.lyra-on #lyra-dock{display:flex}#lyra-dock{min-height:48px}#lyra-dock .lyra-dock-k{display:none}
  #pp-pdf-aviso{left:12px;right:12px;width:auto;transform:none}
  #pp-pdf-hoja{place-items:end stretch;padding:0}
  #pp-pdf-hoja .pph-caja{width:100%;max-height:82dvh;box-sizing:border-box;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px));border-radius:18px 18px 0 0}
  #pp-pdf-hoja input{font-size:16px}}
@media(prefers-reduced-motion:reduce){[data-burbuja]{transition:none}}`;
  document.head.appendChild(css);
})();
