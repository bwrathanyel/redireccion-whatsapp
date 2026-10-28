// Modo Prueba: presentación interactiva para enseñar el CRM (cargo «Presentación» de la pantalla de inicio).
// Cada diapositiva abre la parte real del sandbox y resalta el elemento; sirve en vivo (flechas, PageUp/PageDown de un
// presentador) y para que un asesor la repase solo. Entra como asesor con los datos de LEADS_ASESOR (María, Ricardo).
(() => {
  'use strict';
  const G = window.__pruebaGuia;
  if (!window.__PRUEBA || !G?.presentando()) return;
  const ss = (k, v) => { try { return v === undefined ? sessionStorage.getItem(k) : v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { return null; } };
  const CLAVE = 'prueba:diapo';

  // portada: pantalla grande que abre cada tema. sec: sección a abrir; abre: texto a tocar antes (ej. abrir la ficha);
  // sel o foco: lo que se resalta (selector CSS o comienzo del texto visible).
  const DIAPOS = [
    { tema: 'Leads y atender', portada: true, icono: '👥', titulo: 'Leads y atender', texto: 'Cómo llega un cliente al CRM y qué haces en los primeros minutos.' },
    { tema: 'Leads y atender', titulo: 'Tu bandeja de leads', sec: 'leads', sel: '#sec-leads', texto: 'Cada persona que escribe por Instagram, Facebook o la web cae aquí, ya asignada a un asesor. Tú ves solo los tuyos.' },
    { tema: 'Leads y atender', titulo: 'Leads nuevos por atender', sec: 'leads', sel: '#inbox-grid', texto: 'Los nuevos esperan arriba hasta que alguien los toma. Si nadie los toca a tiempo, el CRM se los pasa solo a otro asesor.' },
    { tema: 'Leads y atender', titulo: 'Atender', sec: 'leads', foco: 'Atender', texto: 'Lo tomas tú: queda <b>ATENDIDO</b> y en el CRM real se abre su WhatsApp. Escríbele en ese momento, no después.' },
    { tema: 'Leads y atender', titulo: 'No puedo', sec: 'leads', foco: 'No puedo', texto: 'Si de verdad no puedes atenderlo, se lo pasas a otro asesor (te pide confirmar). Úsalo poco: el cliente está esperando.' },
    { tema: 'Leads y atender', titulo: 'La ficha del cliente', sec: 'leads', abre: 'María González', sel: '#drawer', texto: 'Tocando el nombre se abre su ficha: datos, historial y notas. Las acciones están en los tres puntitos <b>⋯</b>.' },
    { tema: 'Leads y atender', titulo: 'Los estados', sec: 'pipeline', sel: '#sec-pipeline', texto: '<b>POR ATENDER → ATENDIDO → COTIZACIÓN ENVIADA → EN ESPERA DE PAGO → PAGO REALIZADO</b>, y <b>PERDIDO</b> si no compra. Mantenlo al día: así todo el equipo sabe en qué va cada cliente.' },
    { tema: 'Cotizar y tarifario', portada: true, icono: '🏨', titulo: 'Cotizar y tarifario', texto: 'Dónde están los precios y cómo dejas registrado lo que le ofreciste al cliente.' },
    { tema: 'Cotizar y tarifario', titulo: 'El Tarifario', sec: 'tarifario', sel: '#tar-tabs', texto: 'Todos los hoteles, paquetes y precios para cotizar, con fotos. Las pestañas separan hoteles, paquetes y lo demás.' },
    { tema: 'Cotizar y tarifario', titulo: 'Buscar un hotel', sec: 'tarifario', sel: '#tar-search', texto: 'Escribe un destino o un hotel, por ejemplo <b>Margarita</b>. Con la varita (o Enter) le preguntas a la IA en palabras normales; el precio siempre sale de la ficha real.' },
    { tema: 'Cotizar y tarifario', titulo: 'El botón que te guía', sec: 'leads', abre: 'María González', sel: '#e-a-cta', texto: 'Arriba de la ficha, el botón grande te dice el próximo paso y cambia solo: <b>Atender → Cotizar → Crear reserva → Ver reservas</b>.' },
    { tema: 'Cotizar y tarifario', titulo: 'Cotizar', sec: 'leads', abre: 'María González', sel: '#e-a-cta', texto: '<b>Cotizar</b> arma el PDF con el viaje y el precio. Al generarlo, el CRM pasa solo al cliente a <b>COTIZACIÓN ENVIADA</b>: no tienes que registrar nada más.' },
    { tema: 'Cotizar y tarifario', titulo: 'Si cotizaste por WhatsApp', sec: 'leads', abre: 'María González', sel: '#dacc-estado', texto: 'Si el precio se lo escribiste directo por WhatsApp, cambia aquí el estado a <b>Cotización enviada</b>. Así nadie lo da por olvidado.' },
    { tema: 'Ventas y abonos', portada: true, icono: '💰', titulo: 'Ventas y abonos', texto: 'Lo que ya vendiste, lo que te falta cobrar y cómo anotas cada pago.' },
    { tema: 'Ventas y abonos', titulo: 'Mis Ventas', sec: 'mis-ventas', sel: '#mv-kpis', texto: 'Arriba, tus números: cuánto vendiste y cuánto falta por cobrar.' },
    { tema: 'Ventas y abonos', titulo: 'Cada venta', sec: 'mis-ventas', sel: '#mv-cards', texto: 'Una tarjeta por venta. Ricardo Díaz ya pagó la mitad de su viaje y le quedan <b>$325</b> por pagar.' },
    { tema: 'Ventas y abonos', titulo: 'Registrar un abono', sec: 'mis-ventas', foco: 'Registrar abono', texto: 'Cada pago parcial se anota aquí: un monto menor o igual al saldo, y ves cuánto <b>quedará</b> antes de confirmar. Administración revisa el comprobante; recién ahí cuenta.' },
    { tema: 'Lyra y tareas', portada: true, icono: '✨', titulo: 'Lyra y tareas', texto: 'Tu asistente y tu lista del día.' },
    { tema: 'Lyra y tareas', titulo: 'Lyra', sec: 'lyra', texto: 'Pídele cosas con palabras normales: «¿cómo va la reserva de María González?» o «deja una nota a María». Se abre con este círculo o con <b>Ctrl+Z</b> fuera de un campo.' },
    { tema: 'Lyra y tareas', titulo: 'Tareas', sec: 'tareas', sel: '#sec-tareas', texto: 'Lo que te asignaron y tus recordatorios. Empieza el día por aquí.' },
    { tema: 'Fin', portada: true, icono: '🏁', titulo: 'Ahora tú', texto: 'Repite el caso completo: atiende a un cliente, cotízale, ciérrale la venta y registra su pago. Si te trabas, pregúntale a Lyra.', practicar: true },
  ];
  const TEMAS = [...new Set(DIAPOS.map(d => d.tema))].filter(t => t !== 'Fin');

  const css = document.createElement('style');
  css.textContent = `
#prueba-pres{position:fixed;left:16px;bottom:16px;z-index:99980;width:min(400px,calc(100vw - 32px));color:var(--txt,#eee);background:var(--panel-solid,#1b1b1f);border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:16px;box-shadow:0 18px 40px -16px rgba(0,0,0,.7);font:15px/1.5 system-ui,sans-serif;overflow:hidden}
#prueba-pres header{display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;user-select:none;font-size:13px;color:var(--muted,#aaa)}
#prueba-pres header b{flex:1;color:var(--txt,#eee);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#prueba-pres .pr-barra{height:4px;background:var(--line2,rgba(255,255,255,.1))}
#prueba-pres .pr-barra i{display:block;height:100%;background:#ffb020;transition:width .3s}
#prueba-pres .pr-cuerpo{padding:14px 16px 16px}
#prueba-pres h4{margin:0 0 6px;font-size:19px;line-height:1.25}
#prueba-pres p{margin:0 0 14px;color:var(--muted,#bbb)}
#prueba-pres .pr-temas{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
#prueba-pres .pr-temas button{padding:3px 10px;font-size:12px;border-radius:999px}
#prueba-pres .pr-temas button.on{border-color:#ffb020;color:#ffb020}
#prueba-pres .pr-acc{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#prueba-pres button,#prueba-portada button{font:inherit;font-size:14px;border-radius:10px;padding:8px 14px;cursor:pointer;border:1px solid var(--line2,rgba(255,255,255,.14));background:transparent;color:inherit}
#prueba-pres button.pr-ir,#prueba-portada button.pr-ir{background:#ffb020;color:#1a1200;border-color:#ffb020;font-weight:600}
#prueba-pres button:disabled{opacity:.4;cursor:default}
#prueba-pres .pr-mas{margin-left:auto;border-color:transparent;color:var(--muted,#aaa);text-decoration:underline;padding:8px 6px}
#prueba-pres .pr-teclas{margin:12px 0 0;font-size:12px;color:var(--muted,#888)}
#prueba-pres.plegado .pr-cuerpo{display:none}
#prueba-portada{position:fixed;inset:0;z-index:99985;display:flex;overflow:auto;padding:max(24px,env(safe-area-inset-top)) 24px max(24px,env(safe-area-inset-bottom));background:var(--bg,#0e0e12);color:var(--txt,#eee);font:18px/1.5 system-ui,sans-serif}
#prueba-portada .pp-caja{width:min(760px,100%);margin:auto;text-align:center}
#prueba-portada .pp-ico{font-size:clamp(56px,10vw,96px);line-height:1;margin-bottom:18px}
#prueba-portada small{display:block;margin-bottom:8px;color:#ffb020;font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:14px}
#prueba-portada h2{margin:0 0 14px;font-size:clamp(32px,6vw,56px);line-height:1.1}
#prueba-portada p{margin:0 auto 28px;max-width:34em;color:var(--muted,#bbb);font-size:clamp(17px,2.4vw,22px)}
#prueba-portada .pp-acc{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
#prueba-portada button{font-size:16px;padding:12px 22px;min-height:48px}
body:has(#prueba-portada) #prueba-pres{display:none}
@media (max-width:760px){
  #prueba-pres{left:10px;right:10px;width:auto;bottom:calc(10px + env(safe-area-inset-bottom));font-size:14px}
  #prueba-pres header{min-height:44px;padding:0 12px}
  #prueba-pres h4{font-size:17px}
  #prueba-pres button{min-height:44px}
  #prueba-pres .pr-teclas{display:none}
  body:has(#prueba-pres:not(.plegado)) .main{padding-bottom:calc(260px + env(safe-area-inset-bottom))}
  body:is(.menu-abierto,.chat-abierto) #prueba-pres,body:has(input:focus,textarea:focus) #prueba-pres{display:none}
}`;
  document.head.appendChild(css);

  let i = Math.min(Math.max(parseInt(ss(CLAVE), 10) || 0, 0), DIAPOS.length - 1);
  let plegado = false, panel = null, ultimaAccion = -1;

  const espera = (busca, intentos = 15) => new Promise(ok => {
    const prueba = n => { const x = busca(); if (x || !n) return ok(x || null); setTimeout(() => prueba(n - 1), 300); };
    prueba(intentos);
  });
  const visible = el => el && (el.offsetParent || el.getClientRects().length) ? el : null;
  function cierraFicha() {
    if (document.getElementById('drawer')?.classList.contains('open')) document.getElementById('drawerBg')?.click();
  }
  async function muestra(d) {
    if (d.portada || G.enLogin()) return;
    if (!d.abre) cierraFicha();
    // El botón de Lyra abre y cierra: solo se toca para cambiar de estado.
    const lyraAbierta = document.body.classList.contains('lyra-abierta');
    if ((d.sec === 'lyra') !== lyraAbierta) { const fab = document.getElementById('lyra-fab'); (fab?.offsetParent ? fab : document.getElementById('lyra-dock'))?.click(); }
    if (d.sec && d.sec !== 'lyra') G.destaca(d.sec, true);
    if (d.sec === 'lyra') G.destaca('lyra', false);
    if (d.abre && !document.getElementById('drawer')?.classList.contains('open')) {
      const x = await espera(() => G.buscaTexto(d.abre));
      x?.click();
    }
    if (d.foco) return setTimeout(() => G.enfoca(d.foco), 350);
    if (d.sel) {
      const x = await espera(() => visible(document.querySelector(d.sel)));
      if (x) { x.scrollIntoView({ block: x.offsetHeight > innerHeight * 0.7 ? 'start' : 'center', behavior: 'smooth' }); G.brilla(x); }
    }
  }

  function ir(n) {
    i = Math.min(Math.max(n, 0), DIAPOS.length - 1);
    ss(CLAVE, String(i));
    pinta();
  }
  function salir() {
    ['prueba:modo', 'prueba:rol', CLAVE].forEach(k => ss(k, null));
    location.reload();
  }
  function practicar() {
    ss('prueba:modo', null); ss(CLAVE, null); ss('misiones', null);
    location.reload();
  }

  function pinta() {
    const d = DIAPOS[i];
    document.getElementById('prueba-portada')?.remove();
    if (G.enLogin()) { panel?.remove(); panel = null; return; }
    if (d.portada) {
      const p = document.createElement('div');
      p.id = 'prueba-portada'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-label', d.titulo);
      const n = TEMAS.indexOf(d.tema);
      p.innerHTML = `<div class="pp-caja"><div class="pp-ico" aria-hidden="true">${d.icono}</div>${n >= 0 ? `<small>Tema ${n + 1} de ${TEMAS.length}</small>` : ''}<h2>${d.titulo}</h2><p>${d.texto}</p>
        <div class="pp-acc">${i ? '<button data-pr="atras">← Atrás</button>' : ''}${d.practicar
          ? '<button class="pr-ir" data-pr="practicar">Practicar con misiones</button><button data-pr="inicio">Volver al principio</button><button data-pr="salir">Salir</button>'
          : '<button class="pr-ir" data-pr="sig">Empezar →</button>'}</div></div>`;
      document.body.appendChild(p);
      p.querySelector('.pr-ir').focus();
    }
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'prueba-pres'; panel.setAttribute('aria-live', 'polite');
      document.body.appendChild(panel);
    }
    const temaActual = d.tema;
    panel.classList.toggle('plegado', plegado);
    panel.innerHTML = `<header data-pr="plegar"><span aria-hidden="true">🎤</span><b>${plegado ? `${i + 1}/${DIAPOS.length} · ${d.titulo}` : temaActual}</b><span>${i + 1}/${DIAPOS.length} ${plegado ? '▴' : '▾'}</span></header>
      <div class="pr-barra"><i style="width:${(i + 1) / DIAPOS.length * 100}%"></i></div>
      <div class="pr-cuerpo"><div class="pr-temas">${TEMAS.map(t => `<button data-tema="${t}"${t === temaActual ? ' class="on"' : ''}>${t}</button>`).join('')}</div>
        <h4>${d.titulo}</h4><p>${d.texto}</p>
        <div class="pr-acc"><button data-pr="atras"${i ? '' : ' disabled'}>←</button><button class="pr-ir" data-pr="sig"${i < DIAPOS.length - 1 ? '' : ' disabled'}>Siguiente →</button><button data-pr="mostrar">Mostrar otra vez</button>
          <button class="pr-mas" data-pr="reiniciar" title="Vuelve a cargar los datos de ejemplo sin perder la diapositiva">Reiniciar datos</button><button class="pr-mas" data-pr="salir">Salir</button></div>
        <p class="pr-teclas">Teclado: ← → o PageUp/PageDown · Inicio/Fin · M muestra · H oculta</p></div>`;
    if (ultimaAccion !== i) { ultimaAccion = i; setTimeout(() => muestra(d), 150); }
  }

  const ACCIONES = {
    sig: () => ir(i + 1), atras: () => ir(i - 1), inicio: () => ir(0), salir, practicar,
    plegar: () => { plegado = !plegado; pinta(); },
    mostrar: () => muestra(DIAPOS[i]),
    reiniciar: () => location.reload(),
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('#prueba-pres [data-pr],#prueba-pres [data-tema],#prueba-portada [data-pr]'); if (!b) return;
    if (b.dataset.tema) return ir(DIAPOS.findIndex(d => d.tema === b.dataset.tema));
    ACCIONES[b.dataset.pr]?.();
  });
  addEventListener('keydown', e => {
    if (G.enLogin() || e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target, escribe = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    // Los presentadores inalámbricos mandan PageUp/PageDown: esos valen aunque el foco quedó en un campo.
    const k = { PageDown: 'sig', PageUp: 'atras' }[e.key] || (!escribe && { ArrowRight: 'sig', ArrowLeft: 'atras', Home: 'inicio', End: 'fin', m: 'mostrar', M: 'mostrar', h: 'plegar', H: 'plegar' }[e.key]);
    if (!k || (escribe && t.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    if (k === 'fin') return ir(DIAPOS.length - 1);
    ACCIONES[k]();
  }, true);

  // El login del mock termina después de cargar: se espera a estar dentro para pintar y abrir la primera sección.
  const arranca = setInterval(() => { if (!G.enLogin()) { clearInterval(arranca); pinta(); } }, 400);
})();
