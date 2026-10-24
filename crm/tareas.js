// Tareas v2 (2026-10-23): «Mi día» del trabajador. Los pasos se marcan solos por los detectores
// de la base (triggers tareas_det_*); acá solo se muestran, se abre la herramienta con «Hacer
// ahora» y el tiempo real trae el ✓. Plan: ~/.claude/plans/vamos-a-hacer-un-kind-donut.md.
// Clases .tk-* en index.html; lo del teléfono va en su media query.

const TZ = 'America/Caracas';
const DET = {
  wa_enviado: ['fa-brands fa-whatsapp', 'WhatsApp enviado'],
  estado_lead: ['fas fa-flag', 'Cliente avanza de estado'],
  cotizacion_enviada: ['fas fa-file-invoice-dollar', 'Cotización enviada'],
  llamada: ['fas fa-phone', 'Llamada registrada'],
  proxima_accion: ['fas fa-calendar-check', 'Próxima acción agendada'],
  reserva_creada: ['fas fa-suitcase', 'Reserva creada'],
  abono_registrado: ['fas fa-money-bill-wave', 'Abono registrado'],
  documento_subido: ['fas fa-file-arrow-up', 'Documento subido'],
  reserva_facturada: ['fas fa-receipt', 'Reserva facturada'],
  manual: ['fas fa-hand-pointer', 'Lo marcas tú'],
  evidencia: ['fas fa-camera', 'Evidencia'],
};
const DE_RESERVA = ['abono_registrado', 'documento_subido', 'reserva_facturada'];
const ESTADO = {
  pendiente: ['Pendiente', 'var(--muted)'], en_proceso: ['En curso', 'var(--blue)'], en_revision: ['En revisión', 'var(--amber)'],
  bloqueada: ['Con problema', 'var(--danger)'], completada: ['Hecha', 'var(--green)'], cerrada: ['Cerrada', 'var(--green)'],
  cancelada: ['Cancelada', 'var(--muted2)'],
};
const PRIO = { alta: ['Alta', 'var(--amber)'], urgente: ['Urgente', 'var(--danger)'] };
const MOTIVOS = [['bloqueado_por_terceros', 'Depende de otra persona'], ['falta_info', 'Me falta información'],
  ['sobrecarga', 'No me da el tiempo'], ['problema_tecnico', 'Falla del CRM'], ['otro', 'Otro']];
// whatsapp_mensajes sigue vacía hasta que el WhatsApp propio esté vivo: un paso wa_enviado nunca se
// cumpliría y no tiene «Listo» manual, así que no se ofrece en el constructor.
const WA_DETECTA = false;
const RANGO_LEAD = { 'POR ATENDER': 0, 'SIN GESTIONAR': 0, ATENDIDO: 1, 'CLIENTE CONTACTADO': 2, 'COTIZACION ENVIADA': 3,
  'EN ESPERA DE PAGO': 4, 'PAGO REALIZADO': 5, GANADO: 5, 'VENTA COMPLETA': 6 };
const ESTADOS_META = ['ATENDIDO', 'CLIENTE CONTACTADO', 'COTIZACION ENVIADA', 'EN ESPERA DE PAGO', 'PAGO REALIZADO'];
const SUGERIDOS = [
  [['estado_lead', 'Atenderlo', { estado: 'ATENDIDO' }], ['proxima_accion', 'Agendar la próxima acción']],
  [['cotizacion_enviada', 'Enviar la cotización'], ['proxima_accion', 'Agendar la próxima acción']],
  [['cotizacion_enviada', 'Enviar la cotización'], ['proxima_accion', 'Agendar la próxima acción']],
  [['llamada', 'Llamar para el seguimiento'], ['proxima_accion', 'Agendar la próxima acción']],
  [['abono_registrado', 'Registrar el abono']],
  [['reserva_creada', 'Crear la reserva']],
];
const ATN = {
  problema: ['fas fa-life-ring', 'var(--danger)', 'Reportó un problema'], revision: ['fas fa-magnifying-glass', 'var(--amber)', 'Espera tu revisión'],
  asignado_inactivo: ['fas fa-user-slash', 'var(--danger)', 'Asignada a alguien inactivo'], cliente_borrado: ['fas fa-user-xmark', 'var(--danger)', 'El cliente fue borrado'],
  cliente_perdido: ['fas fa-user-xmark', 'var(--amber)', 'El cliente está PERDIDO'], vencida: ['far fa-clock', 'var(--danger)', 'Vencida'],
  cliente_reasignado: ['fas fa-right-left', 'var(--amber)', 'El cliente ahora es de otro asesor'], sin_abrir: ['far fa-envelope', 'var(--blue)', 'Sin abrir hace más de 4 h'],
  estancada: ['fas fa-hourglass-half', 'var(--amber)', 'Sin avance hace más de 3 h'],
};
const ACCIONES_ATN = {
  problema: [['Responder', 'responder', 1], ['Reasignar', 'reasignar']], revision: [['Aprobar', 'aprobar', 1], ['Devolver', 'devolver']],
  asignado_inactivo: [['Reasignar', 'reasignar', 1], ['Cancelar', 'cancelar']], cliente_borrado: [['Cancelar', 'cancelar', 1], ['Ver', 'ver']],
  cliente_perdido: [['Ver', 'ver', 1], ['Cancelar', 'cancelar']], cliente_reasignado: [['Reasignar', 'reasignar', 1], ['Ver', 'ver']],
};
const FEED_ICO = { creada: ['fas fa-plus', 'var(--blue)'], vista: ['far fa-eye', 'var(--muted)'], paso: ['fas fa-check', 'var(--green)'],
  accion: ['fas fa-arrow-right', 'var(--blue)'], comentario: ['far fa-comment', 'var(--purple)'], evidencia: ['fas fa-camera', 'var(--purple)'],
  problema: ['fas fa-life-ring', 'var(--danger)'], resuelto: ['fas fa-circle-check', 'var(--green)'], aprobada: ['fas fa-check-double', 'var(--green)'],
  devuelta: ['fas fa-rotate-left', 'var(--amber)'], reasignada: ['fas fa-right-left', 'var(--blue)'], editada: ['fas fa-pen', 'var(--muted)'],
  alerta: ['fas fa-triangle-exclamation', 'var(--amber)'], estado: ['fas fa-flag', 'var(--blue)'] };
const ROLES = { admin: 'Admin', administrativo: 'Administrativo', asesor: 'Asesor', marketing: 'Marketing', boleteria: 'Boletería', freelancer: 'Freelancer' };
const ABIERTOS = ['pendiente', 'en_proceso', 'bloqueada', 'en_revision'];

const diaCcs = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const horaCcs = d => d.toLocaleTimeString('es-VE', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const iniciales = s => String(s || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '?';
const leerLocal = (k, def) => { try { return localStorage.getItem(k) ?? def; } catch { return def; } };
const guardarLocal = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export function crearTareas({ sb, esc, rol, miId, irA, abrirLead, abrirReserva, hayOverlayAbierto, navPush, navConsume, navQuitar }) {
  let datos = null, cargando = false, fallo = false, gen = 0;
  let abierta = null, detalle = null, enviando = false, verHechas = false;
  let canal = null, intentos = 0, timerRe = null, timerRecarga = null, cerrando = false;
  let raiz = null, panelMovil = null, navLateral = null, enlazado = false, vivo = false;
  // Admin y administrativo: pestañas Mi día / Equipo / Lista / Plantillas sobre tablero_tareas_admin.
  const gestor = () => ['admin', 'administrativo'].includes(rol());
  let vista = leerLocal('tk-vista', ''), tablero = null, falloTab = false, genTab = 0, timerTab = null, tabSucio = false;
  let filtros = {}, plantillas = null, gruposAbiertos = new Set(), progPrev = new Map(), feedVisto = 0, timerBusca = null;
  let bloque = null, C = null;
  const offset = { ms: 0 };
  const ahora = () => new Date(Date.now() + offset.ms);

  // ── Datos ────────────────────────────────────────────────────────────────────
  const rpc = async (fn, args) => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) {
      const m = String(error.message || '');
      if (/jwt|token/i.test(m)) throw new Error('Tu sesión venció: vuelve a entrar');
      throw new Error(error.code === '42501' ? 'No tienes permiso para esto'
        : /^(listar|tablero|tareas_de|tarea_detalle)/.test(fn) ? 'No se pudo cargar, reintenta' : 'No se pudo guardar, reintenta');
    }
    if (data && data.ok === false) throw new Error(data.mensaje || 'No se pudo guardar, reintenta');
    return data;
  };
  async function cargar() {
    const g = ++gen;
    cargando = !datos; fallo = false; pintar();
    try {
      const d = await rpc('listar_mis_tareas_v2');
      if (g !== gen) return;
      datos = d; offset.ms = d.ahora ? new Date(d.ahora).getTime() - Date.now() : 0;
    } catch (e) { if (g === gen) fallo = e.message; }
    cargando = false; pintar(); refrescarBadge();
  }
  const recargarPronto = () => {
    clearTimeout(timerRecarga);
    timerRecarga = setTimeout(() => { cargar(); if (bloque?.el.isConnected) pintarBloque(); }, 350);
  };
  async function cargarTablero() {
    if (!gestor()) return;
    const g = ++genTab; falloTab = false; tabSucio = false;
    try {
      const d = await rpc('tablero_tareas_admin', { p_filtros: filtros });
      if (g !== genTab) return;
      tablero = d;
    } catch (e) { if (g === genTab) falloTab = e.message; }
    pintar();
  }
  const verEquipo = () => raiz?.isConnected && raiz.offsetParent !== null && vista !== 'mi' && !document.hidden;
  const tableroPronto = () => {
    if (!gestor()) return;
    if (!verEquipo() && ![...document.querySelectorAll('[data-tk-hoy]')].some(el => el.offsetParent)) { tabSucio = true; return; }
    clearTimeout(timerTab); timerTab = setTimeout(cargarTablero, 1200);
  };
  async function cargarPlantillas() {
    try { plantillas = (await rpc('listar_tarea_plantillas')).plantillas || []; } catch (e) { plantillas = []; toast(e.message, true); }
    pintar();
  }

  // ── Grupos de «Mi día» ───────────────────────────────────────────────────────
  function agrupar(lista) {
    const hoy = diaCcs(ahora()), en7 = diaCcs(new Date(ahora().getTime() + 6 * 864e5));
    const g = { vencidas: [], hoy: [], semana: [], despues: [], esperando: [], hechas: [] };
    for (const t of lista) {
      if (t.estado === 'completada') { if (t.completada_at && diaCcs(new Date(t.completada_at)) === hoy) g.hechas.push(t); continue; }
      if (t.estado === 'en_revision' || t.estado === 'bloqueada' || t.problema) { g.esperando.push(t); continue; }
      const v = t.vence_at ? new Date(t.vence_at) : null;
      if (v && v < ahora()) g.vencidas.push(t);
      else if (v && diaCcs(v) === hoy) g.hoy.push(t);
      else if (v && diaCcs(v) <= en7) g.semana.push(t);
      else g.despues.push(t);
    }
    return g;
  }
  function vence(t) {
    if (!t.vence_at) return null;
    const v = new Date(t.vence_at), n = ahora(), min = Math.round((v - n) / 6e4);
    if (min < 0) {
      const h = Math.round(-min / 60);
      return { txt: -min < 60 ? `vencida hace ${-min} min` : h < 24 ? `vencida hace ${h} h` : `vencida hace ${Math.round(h / 24)} d`, mal: true };
    }
    const dv = diaCcs(v), dh = diaCcs(n), manana = diaCcs(new Date(n.getTime() + 864e5));
    if (min < 60) return { txt: `vence en ${min} min`, mal: min <= 15 };
    if (dv === dh) return { txt: `hoy ${horaCcs(v)}` };
    if (dv === manana) return { txt: `mañana ${horaCcs(v)}` };
    return { txt: v.toLocaleDateString('es-VE', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + horaCcs(v) };
  }

  // ── Pintado ──────────────────────────────────────────────────────────────────
  const anillo = (p, tam = 64) => {
    const r = tam / 2 - 5, c = 2 * Math.PI * r;
    return `<div class="tk-ring" style="width:${tam}px;height:${tam}px" role="img" aria-label="${p}% del día hecho">
      <svg viewBox="0 0 ${tam} ${tam}"><circle class="tk-ring-bg" cx="${tam / 2}" cy="${tam / 2}" r="${r}"/>
      <circle class="tk-ring-fg" cx="${tam / 2}" cy="${tam / 2}" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - p / 100)).toFixed(1)}"/></svg>
      <span>${p}%</span></div>`;
  };
  const segs = (total, hechos) => `<div class="tk-segs">${Array.from({ length: Math.max(total, 1) },
    (_, i) => `<span class="tk-seg"${i < hechos ? ' data-st="hecho"' : ''}></span>`).join('')}</div>`;
  const chipLead = l => !l ? '' : `<span class="tk-cli"><span class="tk-av">${esc(iniciales(l.nombre))}</span><span>${esc(l.nombre || 'Cliente')}</span>${
    l.eliminado ? '<span class="tk-est" style="--c:var(--danger)">BORRADO</span>' : l.estado ? `<span class="tk-est" style="--c:${/PERDIDO/.test(l.estado) ? 'var(--danger)' : 'var(--purple)'}">${esc(l.estado)}</span>` : ''}</span>`;

  const esperaDe = t => t.estado === 'en_revision' ? 'En revisión: administración la está viendo'
    : (t.estado === 'bloqueada' || t.problema) ? 'Reportaste un problema: esperando respuesta' : '';
  const botonPaso = (t, px = t.proximo) => !px || esperaDe(t) ? '' : px.detector === 'manual'
    ? `<button class="tk-btn tk-btn-sm tk-btn-pri" data-net data-tk-listo="${t.id}" data-paso="${px.id}"><i class="fas fa-check"></i> Listo</button>`
    : px.detector === 'evidencia' ? `<button class="tk-btn tk-btn-sm" data-tk-open="${t.id}">Enviar evidencia</button>`
    : `<button class="tk-btn tk-btn-sm tk-btn-pri" data-net data-tk-hacer="${t.id}" data-paso="${px.id}">Hacer ahora <i class="fas fa-arrow-right"></i></button>`;
  function tarjeta(t) {
    const v = vence(t), p = PRIO[t.prioridad], px = t.proximo, d = px && DET[px.detector];
    const esperando = esperaDe(t), boton = botonPaso(t);
    return `<article class="tk-card${v?.mal ? ' is-late' : ''}${abierta === t.id ? ' is-sel' : ''}" data-tk-open="${t.id}" tabindex="0">
      <div class="tk-card-top">${t.visto_at ? '' : '<span class="tk-unread" title="Nueva"></span>'}<h3>${esc(t.titulo)}</h3>${p ? `<span class="tk-prio" style="--c:${p[1]}">${p[0]}</span>` : ''}</div>
      <div class="tk-meta">${t.personal ? '<span class="tk-tag">Recordatorio</span>' : t.creador ? `<span><i class="fas fa-user"></i>De ${esc(t.creador)}</span>` : ''}${
        v ? `<span${v.mal ? ' class="is-bad"' : ''}><i class="far fa-clock"></i>${esc(v.txt)}</span>` : ''}</div>
      ${chipLead(t.lead)}
      ${t.pasos_total > 1 ? `<div class="tk-prog">${segs(t.pasos_total, t.pasos_hechos)}<span>${t.pasos_hechos}/${t.pasos_total}</span></div>` : ''}
      ${esperando ? `<div class="tk-wait"><i class="fas fa-hourglass-half"></i><span>${esperando}</span></div>`
        : px ? `<div class="tk-next"><div class="tk-next-l"><span class="tk-ico"><i class="${d ? d[0] : 'fas fa-circle'}"></i></span><div><small>Próximo paso</small>${esc(px.titulo)}</div></div>${boton}</div>` : ''}
    </article>`;
  }
  const grupo = (clave, titulo, lista) => !lista.length ? '' : `<section class="tk-group"><div class="tk-group-h" data-g="${clave}">${titulo} <em>${lista.length}</em></div>
    <div class="tk-list">${lista.map(tarjeta).join('')}</div></section>`;

  function htmlMiDia() {
    if (cargando) return `<div class="tk-day"><div>${'<div class="tk-skel" style="height:118px"></div>'.repeat(4)}</div></div>`;
    if (fallo && !datos) return `<div class="tk-empty" style="--c:var(--danger)"><div class="tk-empty-ico"><i class="fas fa-triangle-exclamation"></i></div>
      <h3>No se pudieron cargar tus tareas</h3><p>${esc(fallo)}</p><button class="tk-btn" data-tk-reintentar>Reintentar</button></div>`;
    const lista = datos?.tareas || [], g = agrupar(lista), lote = datos?.lote || {};
    const porHacer = g.vencidas.length + g.hoy.length, hechasHoy = g.hechas.length;
    const pct = porHacer + hechasHoy ? Math.round(100 * hechasHoy / (porHacer + hechasHoy)) : 0;
    const totalLote = (lote.pendientes || 0) + (lote.hechas_hoy || 0);
    const cola = totalLote ? `<button class="tk-cola" data-tk-cola><span class="tk-cola-ico"><i class="fas fa-user-clock"></i></span>
      <span class="tk-cola-b"><b>Clientes de hoy</b><small>Tu cola diaria: se marcan solos al contactarlos</small>${segs(Math.min(totalLote, 30), Math.round(Math.min(totalLote, 30) * (lote.hechas_hoy || 0) / totalLote))}</span>
      <span class="tk-cola-n">${lote.hechas_hoy || 0}<small>/${totalLote}</small></span></button>` : '';
    const abiertas = g.vencidas.length + g.hoy.length + g.semana.length + g.despues.length + g.esperando.length;
    const vacio = !abiertas && !hechasHoy ? `<div class="tk-empty" style="--c:var(--green)"><div class="tk-empty-ico"><i class="fas fa-mug-hot"></i></div>
      <h3>Nada pendiente</h3><p>Cuando administración te asigne algo aparece acá al instante. Puedes crearte un recordatorio.</p>
      <button class="tk-btn tk-btn-pri" data-tk-recordatorio><i class="fas fa-plus"></i> Recordatorio</button></div>` : '';
    const hechas = !hechasHoy ? '' : `<section class="tk-group"><button class="tk-group-h" data-tk-hechas aria-expanded="${verHechas}">Hechas hoy <em>${hechasHoy}</em><i class="fas fa-chevron-down tk-chev"></i></button>
      ${verHechas ? `<div class="tk-list">${g.hechas.map(t => `<div class="tk-done" data-tk-open="${t.id}"><i class="fas fa-circle-check"></i><span>${esc(t.titulo)}</span><small>${t.completada_at ? horaCcs(new Date(t.completada_at)) : ''}</small></div>`).join('')}</div>` : ''}</section>`;
    return `<header class="tk-head"><div><h1>Mi día</h1><div class="tk-head-sub">Hoy · <b>${porHacer}</b> por hacer${g.vencidas.length ? ` · <span class="is-bad">${g.vencidas.length} vencida${g.vencidas.length > 1 ? 's' : ''}</span>` : ''}</div></div>
        <div class="tk-head-ring">${anillo(pct, 52)}</div>
        <div class="tk-head-acts"><button class="tk-btn tk-btn-pri" data-net data-tk-recordatorio><i class="fas fa-plus"></i> Recordatorio</button></div></header>
      <div class="tk-day"><div>${cola}${vacio}${grupo('vencidas', 'Vencidas', g.vencidas)}${grupo('hoy', 'Hoy', g.hoy)}${grupo('semana', 'Esta semana', g.semana)}${
        grupo('despues', 'Más adelante', g.despues)}${grupo('esperando', 'Esperando', g.esperando)}${hechas}</div>
      <aside class="tk-aside"><div class="tk-box"><div class="tk-box-h">Tu avance de hoy</div><div class="tk-ring-box">${anillo(pct)}
        <div class="tk-stats"><span><b>${hechasHoy}</b>hechas</span><span><b>${porHacer}</b>por hacer</span>${g.vencidas.length ? `<span class="is-bad"><b>${g.vencidas.length}</b>vencidas</span>` : ''}</div></div></div>
        <div class="tk-box"><div class="tk-tip"><i class="fas fa-wand-magic-sparkles"></i><span>No hace falta marcar nada: cuando envías la cotización, registras la llamada o creas la reserva, <b>el paso se marca solo</b>.</span></div></div></aside></div>`;
  }

  // Tarjeta de la sección Hoy: avance del día + las tres más urgentes con su próximo paso.
  function htmlHoy() {
    if (!datos) return '';
    const g = agrupar(datos.tareas || []), porHacer = g.vencidas.length + g.hoy.length, hechasHoy = g.hechas.length;
    const top = [...g.vencidas, ...g.hoy, ...g.semana].slice(0, 3), lote = datos.lote || {};
    const totalLote = (lote.pendientes || 0) + (lote.hechas_hoy || 0), atn = gestor() ? (tablero?.atencion || []).length : 0;
    if (!top.length && !porHacer && !hechasHoy && !g.esperando.length && !totalLote && !atn) return '';
    const pct = porHacer + hechasHoy ? Math.round(100 * hechasHoy / (porHacer + hechasHoy)) : 0;
    return `<section class="tk-hoy"><button class="tk-hoy-h" data-tk-ir>${anillo(pct, 44)}<span class="tk-hoy-t"><b>Tus tareas</b><small>${porHacer} por hacer hoy${
        g.vencidas.length ? ` · <span class="is-bad">${g.vencidas.length} vencida${g.vencidas.length > 1 ? 's' : ''}</span>` : ''}${g.esperando.length ? ` · ${g.esperando.length} esperando` : ''}</small></span><i class="fas fa-chevron-right"></i></button>
      ${top.map(t => { const v = vence(t); return `<div class="tk-hoy-i" data-tk-open="${t.id}" role="button" tabindex="0">${t.visto_at ? '' : '<span class="tk-unread" title="Nueva"></span>'}<div><b>${esc(t.titulo)}</b><small>${
        v ? `<span${v.mal ? ' class="is-bad"' : ''}>${esc(v.txt)}</span>` : 'sin fecha'}${t.proximo ? ' · ' + esc(t.proximo.titulo) : ''}</small></div>${botonPaso(t)}</div>`; }).join('')}
      ${totalLote ? `<button class="tk-hoy-i" data-tk-cola><span class="tk-cola-ico"><i class="fas fa-user-clock"></i></span><div><b>Clientes de hoy ${lote.hechas_hoy || 0}/${totalLote}</b><small>Tu cola diaria</small></div><i class="fas fa-chevron-right"></i></button>` : ''}
      ${atn ? `<button class="tk-hoy-i" data-tk-equipo><span class="tk-cola-ico" style="--c:var(--amber)"><i class="fas fa-users"></i></span><div><b>Equipo: ${atn} necesita${atn > 1 ? 'n' : ''} tu atención</b><small>Problemas, revisiones y vencidas</small></div><i class="fas fa-chevron-right"></i></button>` : ''}</section>`;
  }

  // ── Admin: pestañas, equipo, lista y plantillas ────────────────────────────────
  const VISTAS = [['mi', 'Mi día'], ['equipo', 'Equipo'], ['lista', 'Lista'], ['plantillas', 'Plantillas']];
  const htmlVistas = () => `<nav class="tk-vistas"><div class="tk-tabs" role="tablist">${VISTAS.map(([k, l]) =>
    `<button role="tab" aria-selected="${vista === k}" data-tk-vista="${k}">${l}${k === 'equipo' && tablero?.atencion?.length ? ` <em class="tk-tab-n">${tablero.atencion.length}</em>` : ''}</button>`).join('')}</div></nav>`;
  const headEquipo = () => `<header class="tk-head"><div><h1>Tareas del equipo</h1><div class="tk-head-sub">${vivo ? '<span class="tk-live">En vivo</span> · ' : ''}${
      ahora().toLocaleDateString('es-VE', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
    <div class="tk-head-acts"><button class="tk-btn tk-btn-pri" data-net data-tk-nueva><i class="fas fa-plus"></i> Nueva tarea</button></div></header>`;
  const errorTab = () => `<div class="tk-empty" style="--c:var(--danger)"><div class="tk-empty-ico"><i class="fas fa-triangle-exclamation"></i></div>
    <h3>No se pudo cargar el tablero</h3><p>${esc(falloTab)}</p><button class="tk-btn" data-tk-reintentar-tab>Reintentar</button></div>`;
  const skelTab = () => `<div class="tk-kpis">${'<div class="tk-skel" style="height:74px;margin:0"></div>'.repeat(4)}</div>${'<div class="tk-skel" style="height:64px"></div>'.repeat(4)}`;
  function presencia(iso) {
    if (!iso) return ['off', 'no entró hoy'];
    const d = new Date(iso), min = (ahora() - d) / 6e4;
    if (min < 5) return ['on', 'en línea'];
    if (min < 30) return ['idle', `hace ${Math.round(min)} min`];
    return ['off', diaCcs(d) === diaCcs(ahora()) ? `visto ${horaCcs(d)}` : 'no entró hoy'];
  }
  function itemAtn(a) {
    const m = ATN[a.motivo] || ATN.vencida, v = a.motivo === 'vencida' ? vence(a) : null;
    const rep = a.reporte ? (MOTIVOS.find(x => x[0] === a.reporte.motivo) || [, a.reporte.motivo])[1] + (a.reporte.descripcion ? ': ' + a.reporte.descripcion : '') : '';
    const sub = [esc(a.asesor), rep ? esc(rep) : m[2], v ? esc(v.txt) : '', a.lead ? esc(a.lead.nombre) : ''].filter(Boolean).join(' · ');
    let acts = ACCIONES_ATN[a.motivo] || [['Ver', 'ver', 1], ['Reasignar', 'reasignar']];
    if (a.asesor_id === miId()) acts = [['Ver', 'ver', 1]];
    return `<div class="tk-atn-i"><span class="tk-atn-ico" style="--c:${m[1]}"><i class="${m[0]}"></i></span><div data-tk-open="${a.id}" role="button" tabindex="0"><div class="tk-atn-t">${esc(a.titulo)}</div><div class="tk-atn-s">${sub}</div></div>
      <div class="tk-atn-a">${acts.map(([l, k, pri]) => `<button class="tk-btn tk-btn-sm${pri ? ' tk-btn-pri' : ''}"${k === 'ver' ? '' : ' data-net'} data-tk-atn="${k}" data-id="${a.id}" data-v="${a.version}" data-asesor="${a.asesor_id}">${l}</button>`).join('')}</div></div>`;
  }
  function persona(p) {
    const [pr, prT] = presencia(p.ultima_presencia), c = p.en_curso, lote = p.lote || {}, tl = (lote.pendientes || 0) + (lote.hechas_hoy || 0);
    const antes = progPrev.get(p.id), sube = c && antes && antes.id === c.id && (c.progreso || 0) > antes.p;
    return `<div class="tk-person${sube ? ' is-flash' : ''}" data-tk-persona="${p.id}" role="button" tabindex="0">
      <span class="tk-av tk-av-lg" data-pres="${p.inactivo ? 'off' : pr}">${esc(iniciales(p.nombre))}</span>
      <div class="tk-person-who"><b>${esc(p.nombre)}</b><small>${esc(ROLES[p.rol] || p.rol || '')} · ${p.inactivo ? 'inactivo' : prT}</small>
        ${tl ? `<div class="tk-cola-mini"><span>Clientes ${lote.hechas_hoy || 0}/${tl}</span><span class="tk-bar is-cola"><span style="width:${Math.round(100 * (lote.hechas_hoy || 0) / tl)}%"></span></span></div>` : ''}</div>
      <div class="tk-person-cur">${c ? `<small>En curso · ${c.progreso || 0}%</small><span class="tk-ell">${esc(c.titulo)}</span><div class="tk-bar"><span${sube ? ' class="is-grow"' : ''} style="width:${c.progreso || 0}%;--from:${sube ? antes.p : c.progreso || 0}%"></span></div>` : '<small>Sin tarea en curso</small>'}</div>
      <div class="tk-person-n"><span><b>${p.abiertas}</b>abiertas</span><span class="${p.vencidas ? 'is-bad' : ''}"><b>${p.vencidas}</b>vencidas</span><span><b>${p.hechas_hoy}</b>hechas</span></div></div>`;
  }
  function htmlEquipo() {
    if (!tablero) return falloTab ? errorTab() : skelTab();
    const per = tablero.personas || [], atn = tablero.atencion || [], feed = tablero.feed || [], parte = tablero.parte;
    const sum = k => per.reduce((a, p) => a + (p[k] || 0), 0), rev = atn.filter(a => a.motivo === 'revision').length;
    const html = `<div class="tk-kpis"><div class="tk-kpi"><b>${sum('abiertas')}</b><span>Abiertas</span></div><div class="tk-kpi" data-c="danger"><b>${sum('vencidas')}</b><span>Vencidas</span></div>
      <div class="tk-kpi" data-c="green"><b>${sum('hechas_hoy')}</b><span>Hechas hoy</span></div><div class="tk-kpi" data-c="amber"><b>${rev}</b><span>En revisión</span></div></div>
      <div class="tk-admin"><div>
        <div class="tk-sec-h" style="margin-top:0">Necesita tu atención <b>${atn.length}</b></div><div class="tk-atn">${atn.length ? atn.map(itemAtn).join('')
          : '<div class="tk-atn-ok"><i class="fas fa-circle-check"></i> Nada pendiente de tu lado. El sistema cierra solo lo que se verifica.</div>'}</div>
        <div class="tk-sec-h">Por persona <b>${per.length}</b></div><div class="tk-people">${per.map(persona).join('') || '<div class="tk-note">Sin personas activas.</div>'}</div>
      </div><div class="tk-aside" style="display:flex">
        <div class="tk-box"><div class="tk-box-h" style="display:flex">Lo último ${vivo ? '<span class="tk-live" style="margin-left:auto">En vivo</span>' : ''}</div><ul class="tk-feed">${feed.map(f => {
          const ic = FEED_ICO[f.tipo] || FEED_ICO.estado, ic2 = f.tipo === 'estado' && f.a_estado === 'completada' ? FEED_ICO.aprobada : ic;
          return `<li class="${feedVisto && f.id > feedVisto ? 'is-new' : ''}" data-tk-open="${f.task_id}"><span class="tk-feed-ico" style="--c:${ic2[1]}"><i class="${ic2[0]}"></i></span><div><b>${esc(f.asesor || '')}</b> · ${esc(textoEvento(f))}<br><span class="tk-ell">${esc(f.titulo || '')}</span><time>${horaCcs(new Date(f.created_at))}</time></div></li>`;
        }).join('') || '<li><div class="tk-note">Sin movimiento en los últimos 3 días.</div></li>'}</ul></div>
        ${parte ? `<div class="tk-box tk-parte"><div class="tk-box-h">Parte del ${esc(new Date(parte.fecha + 'T12:00:00-04:00').toLocaleDateString('es-VE', { timeZone: TZ, weekday: 'short', day: 'numeric' }))}</div>
          ${parte.texto ? `<p>${esc(parte.texto)}</p>` : ''}${parte.modelo ? '<small><i class="fas fa-wand-magic-sparkles"></i> Resumen escrito por IA</small>' : ''}</div>` : ''}
      </div></div>`;
    progPrev = new Map(per.filter(p => p.en_curso).map(p => [p.id, { id: p.en_curso.id, p: p.en_curso.progreso || 0 }]));
    feedVisto = Math.max(feedVisto, ...feed.map(f => f.id), 0);
    return html;
  }
  function htmlLista() {
    if (!tablero) return falloTab ? errorTab() : skelTab();
    const per = tablero.personas || [], lista = tablero.lista || [];
    const sel = (k, ops, todos) => `<select class="tk-input tk-fsel" data-tk-f="${k}" aria-label="${todos}"><option value="">${todos}</option>${ops.map(([v, l]) =>
      `<option value="${esc(v)}"${String(filtros[k] || '') === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const fila = (t, cls = '') => {
      const e = ESTADO[t.estado] || ESTADO.pendiente, v = ABIERTOS.includes(t.estado) ? vence(t) : null;
      return `<div class="tk-row${cls}" data-tk-open="${t.id}" role="button" tabindex="0"><div class="tk-row-t"><b>${esc(t.titulo)}</b><small>${t.lead ? esc(t.lead.nombre) : t.personal ? 'Recordatorio' : 'Sin cliente'}<span class="tk-only-m"> · ${esc(t.asesor)}${v ? ' · ' + esc(v.txt) : ''}</span></small></div>
        <div class="tk-hide-m">${esc(t.asesor)}</div><div><span class="tk-est" style="--c:${e[1]}">${e[0]}</span></div><div class="tk-hide-m${v?.mal ? ' is-bad' : ''}">${v ? esc(v.txt) : '—'}</div><div class="tk-hide-m" style="font-weight:800">${t.progreso || 0}%</div></div>`;
    };
    const grupos = new Map();
    for (const t of lista) if (t.grupo_id) grupos.set(t.grupo_id, [...(grupos.get(t.grupo_id) || []), t]);
    const vistos = new Set(), filas = [];
    for (const t of lista) {
      const hs = t.grupo_id && grupos.get(t.grupo_id);
      if (!hs || hs.length < 2) { filas.push(fila(t)); continue; }
      if (vistos.has(t.grupo_id)) continue;
      vistos.add(t.grupo_id);
      const abierto = gruposAbiertos.has(t.grupo_id), hechas = hs.filter(x => x.estado === 'completada').length;
      filas.push(`<div class="tk-row is-group" data-tk-grupo="${t.grupo_id}" role="button" tabindex="0" aria-expanded="${abierto}"><div class="tk-row-t"><b><i class="fas fa-chevron-${abierto ? 'down' : 'right'}" style="color:var(--muted);margin-right:7px"></i>${esc(t.titulo)}</b><small>${hechas}/${hs.length} personas</small></div>
        <div class="tk-hide-m">${hs.length} personas</div><div><span class="tk-est" style="--c:var(--blue)">Grupo</span></div><div class="tk-hide-m">${ABIERTOS.includes(t.estado) && vence(t) ? esc(vence(t).txt) : '—'}</div><div class="tk-hide-m" style="font-weight:800">${Math.round(hs.reduce((a, x) => a + (x.progreso || 0), 0) / hs.length)}%</div></div>`);
      if (abierto) filas.push(...hs.map(x => fila(x, ' is-child')));
    }
    return `<div class="tk-filters"><label class="tk-search"><i class="fas fa-magnifying-glass"></i><input class="tk-input" id="tk-f-q" value="${esc(filtros.q || '')}" placeholder="Buscar tarea o cliente" aria-label="Buscar"></label>
        ${sel('asesor_id', per.map(p => [p.id, p.nombre]), 'Todas las personas')}${sel('estado', Object.entries(ESTADO).map(([k, e]) => [k, e[0]]), 'Abiertas y recientes')}
        ${sel('vence', [['hoy', 'Vencen hoy'], ['vencidas', 'Vencidas'], ['semana', 'Esta semana'], ['sin_fecha', 'Sin fecha']], 'Cualquier fecha')}
        ${sel('tipo', [['lead', 'Cliente'], ['postventa', 'Reserva'], ['administrativa', 'Administrativa'], ['contenido', 'Contenido'], ['otra', 'Otra']], 'Todos los tipos')}
        <label class="tk-chip"><input type="checkbox" data-tk-f="incluir_lote"${filtros.incluir_lote ? ' checked' : ''}> Cola diaria</label></div>
      <div class="tk-rows"><div class="tk-row tk-row-h"><div>Tarea</div><div>Persona</div><div>Estado</div><div>Vence</div><div>Avance</div></div>${filas.join('') || '<div class="tk-row"><div class="tk-note">Sin tareas con estos filtros.</div></div>'}</div>`;
  }
  // Días ISO como los guarda la recurrencia: 1 = lunes … 7 = domingo.
  const DIAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const textoRec = r => !r ? '' : `${r.frecuencia === 'diaria' ? 'Días hábiles' : r.frecuencia === 'semanal' ? (r.dias || []).map(d => DIAS[d % 7] ?? d).join(' ') : `Día ${r.dia_mes} de cada mes`} · ${r.hora}`;
  function htmlPlantillas() {
    if (!plantillas) return '<div class="tk-tpl-grid">' + '<div class="tk-skel" style="height:150px"></div>'.repeat(3) + '</div>';
    return `<div class="tk-tpl-grid">${plantillas.map(p => `<div class="tk-box tk-tpl"${p.activa ? '' : ' style="opacity:.6"'}><h3>${esc(p.titulo)}</h3><p>${esc(p.descripcion || 'Sin indicaciones')}</p>
      <div class="tk-tpl-steps">${(p.pasos || []).map(s => `<span class="tk-ico" title="${esc(s.titulo)}"><i class="${(DET[s.detector] || DET.manual)[0]}"></i></span>`).join('')}</div>
      <div class="tk-tpl-f"><small>${p.recurrencia ? '<i class="fas fa-repeat"></i> ' + esc(textoRec(p.recurrencia)) + (p.activa ? '' : ' · en pausa') : esc(p.creador ? 'De ' + p.creador : '')}</small>
        ${p.recurrencia ? `<button class="tk-btn tk-btn-sm" data-net data-tk-tpl-pausa="${p.id}" data-activa="${p.activa ? 0 : 1}">${p.activa ? 'Pausar' : 'Reanudar'}</button>` : ''}
        <button class="tk-btn tk-btn-sm" data-tk-tpl-editar="${p.id}">Editar</button><button class="tk-btn tk-btn-sm tk-btn-pri" data-tk-tpl-usar="${p.id}">Usar</button></div></div>`).join('')}
      <button class="tk-box tk-tpl" data-tk-tpl-nueva style="align-items:center;justify-content:center;border-style:dashed;color:var(--muted);min-height:150px"><i class="fas fa-plus"></i><b>Nueva plantilla</b></button></div>`;
  }

  function pintar() {
    const off = navigator.onLine ? '' : '<div class="tk-offline"><i class="fas fa-wifi"></i> Sin conexión: las acciones vuelven al reconectar</div>';
    if (raiz?.isConnected) {
      const enfoque = document.activeElement?.id === 'tk-f-q' ? document.activeElement.selectionStart : null;
      raiz.innerHTML = off + (!gestor() ? htmlMiDia() : htmlVistas() + (vista === 'mi' ? htmlMiDia()
        : headEquipo() + (vista === 'lista' ? htmlLista() : vista === 'plantillas' ? htmlPlantillas() : htmlEquipo())));
      raiz.classList.toggle('is-offline', !navigator.onLine);
      if (enfoque != null) { const q = document.getElementById('tk-f-q'); q?.focus(); q?.setSelectionRange(enfoque, enfoque); }
    }
    const pb = panelMovil?.querySelector('.tk-panel-b');
    if (pb?.isConnected) { pb.innerHTML = off + htmlMiDia(); pb.classList.toggle('is-offline', !navigator.onLine); }
    const hoy = document.querySelectorAll('[data-tk-hoy]');
    if (hoy.length) { const h = htmlHoy(); hoy.forEach(el => { el.innerHTML = h; }); }
  }

  // ── Detalle ──────────────────────────────────────────────────────────────────
  async function abrirTarea(id, { silencioso = false } = {}) {
    abierta = Number(id);
    if (!silencioso) { detalle = null; pintarDetalle(); }
    try {
      const d = await rpc('tarea_detalle', { p_id: abierta });
      if (abierta !== Number(id)) return;
      const antes = detalle;
      detalle = d; pintarDetalle(antes);
      if (!d.tarea.visto_at && d.puede?.trabajar) rpc('tarea_marcar_vista', { p_id: abierta }).then(recargarPronto).catch(() => {});
    } catch (e) { toast(e.message, true); if (!silencioso) cerrarDetalle(); }
  }
  function cerrarDetalle() {
    abierta = null; detalle = null;
    document.getElementById('tk-detalle')?.remove();
    pintar();
  }
  const ultimoEvento = (tipo) => [...(detalle?.eventos || [])].reverse().find(e => e.tipo === tipo);

  function paso(p, i, actualId, puede) {
    const d = DET[p.detector] || DET.manual;
    const st = p.estado === 'hecho' ? 'hecho' : p.estado === 'en_revision' ? 'revision' : p.id === actualId ? 'actual' : 'pend';
    const cuando = p.hecho_at ? horaCcs(new Date(p.hecho_at)) : '';
    const sub = p.estado === 'hecho' ? `✓ ${p.origen === 'previo' ? 'ya estaba hecho' : p.origen === 'auto' ? `detectado ${cuando}` : p.origen === 'ia' ? `revisado por IA ${cuando}`
        : p.origen === 'admin' ? `aprobado ${cuando}` : `marcado ${cuando}`}${p.hecho_por ? ` · ${esc(p.hecho_por)}` : ''}`
      : p.estado === 'en_revision' ? 'En revisión' : p.estado === 'rechazado' ? `Devuelto: ${p.nota ? esc(p.nota) : 'revisa y vuelve a enviarlo'}` : p.estado === 'omitido' ? 'Omitido' : p.requerido ? 'Pendiente' : 'Opcional';
    const est = p.detector === 'estado_lead' && p.params?.estado ? `Cliente en ${p.params.estado}` : d[1];
    const ev = p.detector === 'evidencia' ? (detalle?.evidencia || []).filter(e => e.paso_id === p.id).at(-1) : null;
    const conArchivo = ['foto', 'archivo'].includes(p.params?.tipo);
    let acc = '';
    if (st === 'actual' && puede.trabajar && p.estado !== 'hecho') {
      if (p.detector === 'manual') acc = `<button class="tk-btn tk-btn-sm tk-btn-pri" data-net data-tk-listo="${abierta}" data-paso="${p.id}"><i class="fas fa-check"></i> Listo</button>`;
      else if (p.detector === 'evidencia') acc = `${conArchivo ? `<label class="tk-btn tk-btn-sm tk-btn-pri tk-foto"><i class="fas fa-camera"></i> ${p.params.tipo === 'foto' ? 'Tomar o subir foto' : 'Subir archivo'}
            <input type="file" accept="${p.params.tipo === 'foto' ? 'image/*' : 'image/*,application/pdf'}" data-tk-foto="${p.id}" hidden></label>` : ''}
          <div class="tk-compose" style="margin-top:9px"><input class="tk-input" id="tk-evid" maxlength="2000" placeholder="${p.params?.tipo === 'nota' ? 'Escribe la nota' : conArchivo ? 'O pega un enlace / escribe una nota' : 'Pega el enlace o describe lo que hiciste'}">
          <button class="tk-btn${conArchivo ? '' : ' tk-btn-pri'}" data-net data-tk-evid="${p.id}">Enviar</button></div>`;
      else acc = `<button class="tk-btn tk-btn-sm tk-btn-pri" data-net data-tk-hacer="${abierta}" data-paso="${p.id}">Hacer ahora <i class="fas fa-arrow-right"></i></button>`;
    }
    const evHtml = !ev ? '' : `<div class="tk-ev">${ev.tipo === 'archivo' ? `<button class="tk-btn tk-btn-sm" data-net data-tk-ver-ev="${ev.id}"><i class="fas fa-${/\.pdf$/i.test(ev.contenido) ? 'file-pdf' : 'image'}"></i> Ver ${/\.pdf$/i.test(ev.contenido) ? 'archivo' : 'foto'}</button>`
        : ev.tipo === 'enlace' && /^https?:\/\//i.test(ev.contenido) ? `<a href="${esc(ev.contenido)}" target="_blank" rel="noopener"><i class="fas fa-link"></i> ${esc(ev.contenido.slice(0, 60))}</a>` : `<q>${esc(String(ev.contenido).slice(0, 300))}</q>`}
      ${ev.veredicto === 'dudoso' ? '<small><i class="fas fa-wand-magic-sparkles"></i> La IA tiene dudas: lo revisa administración</small>' : ''}</div>`;
    return `<li class="tk-step" data-st="${st}" data-paso-id="${p.id}"><span class="tk-mark">${st === 'hecho' ? '<i class="fas fa-check"></i>' : i + 1}</span>
      <div><div class="tk-step-t">${esc(p.titulo)}</div><div class="tk-step-s">${sub}</div>
      ${!['manual', 'evidencia'].includes(p.detector) ? `<span class="tk-det"><i class="${d[0]}"></i>Se marca solo: ${esc(est)}</span>` : ''}${evHtml}${acc}</div></li>`;
  }

  function pintarDetalle(antes) {
    let caja = document.getElementById('tk-detalle');
    if (!caja) {
      caja = document.createElement('div'); caja.id = 'tk-detalle'; caja.className = 'tk-overlay';
      document.body.appendChild(caja);
    }
    if (!detalle) {
      caja.innerHTML = `<div class="tk-scrim is-dim" data-tk-cerrar></div><aside class="tk-panel" role="dialog" aria-modal="true" aria-label="Tarea"><div class="tk-grab"></div>
        <div class="tk-panel-b">${'<div class="tk-skel" style="height:64px"></div>'.repeat(5)}</div></aside>`;
      return;
    }
    const t = detalle.tarea, pu = detalle.puede || {}, pasos = detalle.pasos || [], e = ESTADO[t.estado] || ESTADO.pendiente;
    const req = pasos.filter(p => p.requerido && p.estado !== 'omitido'), hechos = req.filter(p => p.estado === 'hecho').length;
    const actual = pasos.find(p => ['pendiente', 'rechazado'].includes(p.estado));
    const v = vence(t), l = detalle.lead, prob = (detalle.reportes || []).find(r => r.estado === 'abierto');
    const devuelta = t.estado !== 'completada' && ultimoEvento('devuelta');
    const banners = [
      devuelta && (!ultimoEvento('paso') || ultimoEvento('paso').id < devuelta.id) ? ['var(--amber)', 'fas fa-rotate-left', `Te la devolvieron${devuelta.nota ? ': ' + esc(devuelta.nota) : ''}`] : null,
      prob ? ['var(--danger)', 'fas fa-life-ring', `Reportaste: ${esc((MOTIVOS.find(m => m[0] === prob.motivo) || [, prob.motivo])[1])}${prob.descripcion ? ' · ' + esc(prob.descripcion) : ''}. Administración ya lo vio.`] : null,
      l?.eliminado ? ['var(--danger)', 'fas fa-user-slash', 'El cliente fue borrado del CRM'] : null,
      l && /PERDIDO/.test(l.estado || '') ? ['var(--danger)', 'fas fa-user-xmark', 'El cliente está PERDIDO'] : null,
    ].filter(Boolean).map(([c, i, txt]) => `<div class="tk-banner" style="--c:${c}"><i class="${i}"></i><span>${txt}</span></div>`).join('');
    const coment = (detalle.comentarios || []).map(c => `<div class="tk-msg${c.autor_id === miId() ? ' is-me' : ''}"><span class="tk-av">${esc(iniciales(c.autor))}</span>
      <div class="tk-msg-b"><div class="tk-msg-m">${esc(c.autor || '')} · ${horaCcs(new Date(c.created_at))}</div>${esc(c.cuerpo)}</div></div>`).join('');
    const hist = [...(detalle.eventos || [])].reverse().map(ev => `<li><time>${new Date(ev.created_at).toLocaleString('es-VE', { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time>${esc(textoEvento(ev))}</li>`).join('');
    const abiertaT = !['completada', 'cerrada', 'cancelada'].includes(t.estado);
    const acc = (k, l, pri) => `<button class="tk-btn${pri ? ' tk-btn-pri' : ''}" data-net data-tk-atn="${k}" data-id="${t.id}" data-v="${t.version}" data-asesor="${t.asesor_id}">${l}</button>`;
    const gest = !abiertaT ? [] : pu.aprobar ? [t.estado === 'en_revision' ? acc('aprobar', '<i class="fas fa-check-double"></i> Aprobar', 1) + acc('devolver', 'Devolver') : '',
        prob ? acc('responder', 'Responder', 1) : '', acc('editar', 'Editar'), acc('reasignar', 'Reasignar'), acc('cancelar', 'Cancelar')]
      : pu.gestionar && t.personal ? [acc('cancelar', 'Borrar recordatorio')] : [];
    const trab = pu.trabajar && abiertaT ? [prob ? '' : '<button class="tk-btn" data-net data-tk-problema><i class="fas fa-life-ring"></i> Tengo un problema</button>',
      actual && !['manual', 'evidencia'].includes(actual.detector) ? `<button class="tk-btn tk-btn-pri" data-net data-tk-hacer="${t.id}" data-paso="${actual.id}">Hacer ahora <i class="fas fa-arrow-right"></i></button>` : ''] : [];
    const pieHtml = [...gest, ...trab].join('');
    const pie = pieHtml ? `<div class="tk-panel-f">${pieHtml}</div>` : '';
    caja.innerHTML = `<div class="tk-scrim is-dim" data-tk-cerrar></div>
      <aside class="tk-panel" role="dialog" aria-modal="true" aria-label="${esc(t.titulo)}"><div class="tk-grab"></div>
      <div class="tk-panel-h"><span class="tk-estado" style="--c:${e[1]}">${e[0]}</span>${PRIO[t.prioridad] ? `<span class="tk-prio" style="--c:${PRIO[t.prioridad][1]}">${PRIO[t.prioridad][0]}</span>` : ''}<span style="flex:1"></span>
        <button class="tk-icon-btn" data-tk-cerrar aria-label="Cerrar"><i class="fas fa-xmark"></i></button></div>
      <div class="tk-panel-b"><h2>${esc(t.titulo)}</h2>
        <div class="tk-meta">${t.personal ? '<span class="tk-tag">Recordatorio · lo ve administración</span>' : detalle.creador ? `<span><i class="fas fa-user"></i>De ${esc(detalle.creador.nombre)}</span>` : ''}${
          v ? `<span${v.mal ? ' class="is-bad"' : ''}><i class="far fa-clock"></i>${esc(v.txt)}</span>` : ''}${detalle.asignado && detalle.asignado.id !== miId() ? `<span><i class="fas fa-user-check"></i>Para ${esc(detalle.asignado.nombre)}</span>` : ''}</div>
        ${t.descripcion ? `<div class="tk-desc">${esc(t.descripcion)}</div>` : ''}
        ${l ? `<div class="tk-cli-card"><span class="tk-av tk-av-lg">${esc(iniciales(l.nombre))}</span><div><b>${esc(l.nombre || 'Cliente')}</b><small>${esc(l.estado || '')}${l.asesor ? ' · ' + esc(l.asesor) : ''}</small></div>
          ${l.eliminado ? '' : `<button class="tk-btn tk-btn-sm" data-tk-lead="${l.id}">Abrir ficha</button>`}</div>` : ''}
        ${banners}
        <section class="tk-sec"><div class="tk-sec-h">Pasos <b>${hechos}/${req.length}</b></div>
          ${pasos.some(p => !['manual', 'evidencia'].includes(p.detector)) ? '<div class="tk-help"><i class="fas fa-wand-magic-sparkles"></i><span>Se marcan solos cuando lo haces en el CRM. Toca «Hacer ahora» y al volver ya está.</span></div>' : ''}
          <ol class="tk-steps">${pasos.map((p, i) => paso(p, i, actual?.id, pu)).join('')}</ol></section>
        <section class="tk-sec"><div class="tk-sec-h">Conversación</div>${coment || '<div class="tk-note">Sin mensajes. Escribe si necesitas algo de administración.</div>'}
          <div class="tk-compose" style="margin-top:9px"><input class="tk-input" id="tk-coment" maxlength="2000" placeholder="Escribe un mensaje"><button class="tk-btn" data-net data-tk-comentar aria-label="Enviar"><i class="fas fa-paper-plane"></i></button></div></section>
        <details class="tk-hist"><summary>Historial</summary><ul>${hist}</ul></details>
      </div>${pie}</aside>`;
    // Paso nuevo detectado mientras estaba abierto: check animado + aviso.
    if (antes?.pasos) {
      const viejos = new Map(antes.pasos.map(p => [p.id, p.estado]));
      const nuevos = pasos.filter(p => p.estado === 'hecho' && viejos.get(p.id) && viejos.get(p.id) !== 'hecho');
      for (const p of nuevos) caja.querySelector(`[data-paso-id="${p.id}"]`)?.classList.add('is-new');
      if (nuevos.length) toast(`✓ ${nuevos[0].titulo}`);
      if (!nuevos.length && (antes.tarea.titulo !== t.titulo || antes.tarea.descripcion !== t.descripcion || antes.tarea.vence_at !== t.vence_at)) toast('La tarea cambió: la recargamos');
    }
    caja.querySelector('.tk-panel')?.focus?.();
  }
  function textoEvento(ev) {
    const d = ev.detalle || {}, a = ev.actor || 'Sistema';
    switch (ev.tipo) {
      case 'creada': return `${a} creó la tarea`;
      case 'vista': return `${a} la abrió`;
      case 'paso': return `✓ ${d.titulo || 'Paso'} (${d.origen === 'auto' ? 'detectado' : 'marcado'}${ev.actor ? ' · ' + ev.actor : ''})`;
      case 'accion': return `${a} tocó «Hacer ahora»`;
      case 'comentario': return `${a} escribió`;
      case 'evidencia': return `${a} envió evidencia`;
      case 'problema': return `${a} reportó un problema`;
      case 'resuelto': return `${a} resolvió el problema`;
      case 'aprobada': return `${a} la aprobó`;
      case 'devuelta': return `${a} la devolvió${ev.nota ? ': ' + ev.nota : ''}`;
      case 'reasignada': return `${a} la reasignó`;
      case 'editada': return `${a} la editó`;
      case 'alerta': return `Aviso: ${d.motivo === 'abono_anulado' ? 'se anuló el abono' : d.motivo === 'documento_anulado' ? 'se anuló el documento' : d.motivo || ''}`;
      case 'estado': return `${ESTADO[ev.a_estado]?.[0] || ev.a_estado}${ev.actor ? ' · ' + ev.actor : ''}`;
      default: return ev.tipo;
    }
  }

  // ── Hojas: recordatorio y problema ─────────────────────────────────────────────
  function hoja(id, titulo, cuerpo, pie, grande = false) {
    document.getElementById(id)?.remove();
    const c = document.createElement('div'); c.id = id; c.className = 'tk-overlay tk-hoja';
    c.innerHTML = `<div class="tk-scrim is-dim" data-tk-cerrar-hoja></div><div class="tk-modal${grande ? '' : ' is-sm'}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="tk-modal-h"><h2>${esc(titulo)}</h2><button class="tk-icon-btn" data-tk-cerrar-hoja aria-label="Cerrar"><i class="fas fa-xmark"></i></button></div>
      <div class="tk-modal-b">${cuerpo}</div><div class="tk-modal-f">${pie}</div></div>`;
    document.body.appendChild(c);
    c.querySelector('input,textarea')?.focus();
    return c;
  }
  const HORAS = [['1h', 'En 1 hora'], ['17', 'Hoy 5 pm'], ['m9', 'Mañana 9 am'], ['', 'Sin hora']];
  function venceDe(k, otra = '') {
    const n = ahora();
    if (k === '1h') return new Date(n.getTime() + 36e5).toISOString();
    if (k === 'otra') return otra ? new Date(`${otra}:00-04:00`).toISOString() : null;
    if (k === 'vie') {
      const dow = new Date(`${diaCcs(n)}T12:00:00-04:00`).getUTCDay(), hora = Number(n.toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }));
      const dias = (5 - dow + 7) % 7 || (hora < 10 ? 0 : 7);
      return new Date(`${diaCcs(new Date(n.getTime() + dias * 864e5))}T10:00:00-04:00`).toISOString();
    }
    if (!k) return null;
    const dia = k === 'm9' ? diaCcs(new Date(n.getTime() + 864e5)) : diaCcs(n);
    return new Date(`${dia}T${k === 'm9' ? '09' : '17'}:00:00-04:00`).toISOString();
  }
  function nuevoRecordatorio({ leadId = null, leadNombre = '' } = {}) {
    const c = hoja('tk-hoja-rec', 'Nuevo recordatorio', `
      <div class="tk-field"><label class="tk-label" for="tk-rec-t">Qué tienes que hacer</label><input class="tk-input" id="tk-rec-t" maxlength="200" placeholder="Ej.: llamar a la posada para confirmar"></div>
      <div class="tk-field"><span class="tk-label">Cuándo</span><div class="tk-chips" role="group">${HORAS.map(([k, t], i) => `<button class="tk-chip" data-tk-hora="${k}" aria-pressed="${i === 0}">${t}</button>`).join('')}</div></div>
      ${leadId ? `<div class="tk-sel"><span class="tk-av">${esc(iniciales(leadNombre))}</span><div><b>${esc(leadNombre || 'Cliente')}</b><small>Cliente de este recordatorio</small></div></div>` : ''}
      <div class="tk-note"><i class="fas fa-eye"></i> Administración también lo ve.</div>`,
      `<button class="tk-btn tk-btn-ghost" data-tk-cerrar-hoja>Cancelar</button><button class="tk-btn tk-btn-pri" data-net data-tk-rec-guardar>Guardar</button>`);
    c.dataset.lead = leadId || '';
    c.dataset.token = crypto.randomUUID();
  }
  function hojaProblema() {
    hoja('tk-hoja-prob', 'Tengo un problema', `
      <div class="tk-field"><span class="tk-label">Qué pasa</span><div class="tk-chips" role="group">${MOTIVOS.map(([k, t]) => `<button class="tk-chip" data-tk-motivo="${k}" aria-pressed="false">${t}</button>`).join('')}</div></div>
      <div class="tk-field"><label class="tk-label" for="tk-prob-d">Cuéntalo (opcional)</label><textarea class="tk-input" id="tk-prob-d" maxlength="1000"></textarea></div>
      <div class="tk-note"><i class="fas fa-shield-heart"></i> Avisar un problema no cuenta en tu contra: administración lo resuelve contigo.</div>`,
      `<button class="tk-btn tk-btn-ghost" data-tk-cerrar-hoja>Cancelar</button><button class="tk-btn tk-btn-pri" data-net data-tk-prob-enviar>Enviar</button>`);
  }

  // ── Crear tarea y plantillas (admin / administrativo) ────────────────────────────
  const destinatarios = () => (tablero?.personas || []).filter(p => !p.inactivo);
  const corto = s => String(s || '').trim().split(/\s+/).slice(0, 2).join(' ');
  const rangoLead = () => C?.lead ? RANGO_LEAD[String(C.lead.estado || '').toUpperCase()] ?? -1 : -1;
  const yaCumple = p => p.detector === 'estado_lead' && rangoLead() >= 0 && rangoLead() >= (RANGO_LEAD[p.params?.estado] ?? 99);
  const siguienteEstado = () => ESTADOS_META.find(e => RANGO_LEAD[e] > rangoLead()) || 'ATENDIDO';
  const pasoNuevo = (k, titulo, params) => ({ detector: k, titulo: titulo || (k === 'estado_lead' ? `Llevarlo a ${params?.estado}` : k === 'manual' ? 'Hacerlo y tocar «Listo»'
    : k === 'evidencia' ? 'Enviar la evidencia' : DET[k][1]), params: params || (k === 'evidencia' ? { tipo: 'nota' } : {}), requerido: true });
  async function crearTarea({ lead = null, plantilla = null, modo = 'tarea' } = {}) {
    if (!gestor()) return nuevoRecordatorio({ leadId: lead?.id, leadNombre: lead?.nombre });
    if (!tablero) await cargarTablero();
    if (!tablero) return toast(falloTab || 'No se pudo cargar el equipo', true);
    const dest = plantilla?.destinatarios || {};
    C = { modo, plantillaId: modo === 'plantilla' ? plantilla?.id ?? null : null, usarPlantilla: modo === 'tarea' ? plantilla?.id ?? null : null, tplNueva: null,
      para: new Set(dest.ids || []), rol: dest.rol || null, titulo: plantilla?.titulo || '', lead,
      pasos: (plantilla?.pasos || []).map(p => pasoNuevo(p.detector, p.titulo, p.params)), prio: plantilla?.prioridad || 'media',
      vence: '17', otra: '', aprob: !!plantilla?.requiere_aprobacion, cat: false, res: [], token: crypto.randomUUID() };
    const rec = modo === 'plantilla' ? plantilla?.recurrencia : null;
    Object.assign(C, { rep: rec?.frecuencia || 'no', repDias: new Set(rec?.dias || [1, 2, 3, 4, 5]), repDia: Number(rec?.dia_mes) || 1, repHora: rec?.hora || '09:00' });
    hoja('tk-hoja-crear', modo === 'plantilla' ? (C.plantillaId ? 'Editar plantilla' : 'Nueva plantilla') : 'Nueva tarea', `<div class="tk-crear"><div>
      <div class="tk-field" data-c="para"></div>
      <div class="tk-field"><label class="tk-label" for="tk-c-t">Título</label><input class="tk-input" id="tk-c-t" maxlength="200" value="${esc(C.titulo)}" placeholder="Ej.: enviar la cotización de Los Roques"></div>
      <div class="tk-field"><label class="tk-label" for="tk-c-d">Indicaciones (opcional)</label><textarea class="tk-input" id="tk-c-d" maxlength="2000" placeholder="Lo que necesita saber para hacerla">${esc(plantilla?.descripcion || '')}</textarea></div>
      ${modo === 'tarea' ? '<div class="tk-field" data-c="cliente"></div>' : ''}
      <div class="tk-field" data-c="pasos"></div><div class="tk-field" data-c="prio"></div><div class="tk-field" data-c="rep"></div>${modo === 'tarea' ? '<div class="tk-field" data-c="vence"></div>' : ''}
      <div class="tk-switch-row" data-c="aprob"></div></div><div class="tk-preview" data-c="prev"></div></div>`, '', true);
    pintarCrear();
  }
  function pintarCrear(...partes) {
    const c = document.getElementById('tk-hoja-crear');
    if (!c || !C) return;
    const put = (k, html) => {
      if (partes.length && !partes.includes(k)) return;
      const el = k === 'pie' ? c.querySelector('.tk-modal-f') : c.querySelector(`[data-c="${k}"]`);
      if (el) el.innerHTML = html;
    };
    const per = destinatarios(), sel = C.rol ? per.filter(p => p.rol === C.rol) : per.filter(p => C.para.has(p.id));
    const sinEntrar = sel.filter(p => presencia(p.ultima_presencia)[1] === 'no entró hoy');
    const chips = (k, ops) => `<div class="tk-chips" role="group">${ops.map(([v, l]) => `<button class="tk-chip" data-tkc-${k}="${v}" aria-pressed="${C[k] === v}">${l}</button>`).join('')}</div>`;
    put('para', `<span class="tk-label">Para${C.modo === 'plantilla' ? ' (opcional)' : ''}</span><div class="tk-chips">${per.map(p => `<button class="tk-chip" data-tkc-para="${p.id}" aria-pressed="${!C.rol && C.para.has(p.id)}"><span class="tk-av" data-pres="${presencia(p.ultima_presencia)[0]}">${esc(iniciales(p.nombre))}</span>${esc(corto(p.nombre))}</button>`).join('')}${
      rol() === 'admin' ? `<button class="tk-chip" data-tkc-rol="asesor" aria-pressed="${C.rol === 'asesor'}"><i class="fas fa-users"></i> Todos los asesores</button>` : ''}</div>
      ${C.modo === 'tarea' && sinEntrar.length ? `<p class="tk-note is-warn" style="margin-top:9px"><i class="fas fa-circle-info"></i> ${sinEntrar.length > 3 ? `${sinEntrar.length} personas no han`
        : esc(sinEntrar.map(p => corto(p.nombre)).join(', ')) + (sinEntrar.length > 1 ? ' no han' : ' no ha')} entrado hoy: la verán al entrar.</p>` : ''}`);
    const repite = C.rep !== 'no';
    put('cliente', repite ? '<span class="tk-label">Cliente</span><p class="tk-note"><i class="fas fa-repeat"></i> Las tareas que se repiten no llevan cliente.</p>'
      : `<span class="tk-label">Cliente (opcional)</span>${C.lead ? `<div class="tk-sel"><span class="tk-av">${esc(iniciales(C.lead.nombre))}</span><div><b>${esc(C.lead.nombre || 'Cliente')}${
        C.lead.estado ? ` <span class="tk-est" style="--c:var(--purple)">${esc(C.lead.estado)}</span>` : ''}</b><small>${C.lead.asesor ? 'Asesor: ' + esc(C.lead.asesor) : 'Sin asesor'}</small></div>
        <button class="tk-icon-btn" data-tkc-sin-lead aria-label="Quitar cliente"><i class="fas fa-xmark"></i></button></div>`
      : `<label class="tk-search"><i class="fas fa-magnifying-glass"></i><input class="tk-input" id="tk-c-buscar" placeholder="Nombre, teléfono o #id" autocomplete="off" aria-label="Buscar cliente"></label><div class="tk-c-res" data-c="res"></div>`}`);
    const rango = rangoLead(), sug = C.modo === 'tarea' && C.lead && !C.pasos.length && rango >= 0 ? SUGERIDOS[Math.min(rango, 5)] : null;
    const sinCliente = k => (repite || (C.modo === 'tarea' && !C.lead)) && !['manual', 'evidencia'].includes(k);
    put('pasos', `<span class="tk-label">Pasos</span>
      ${sug ? `<div class="tk-suggest"><i class="fas fa-lightbulb"></i><span>Para un cliente en ${esc(C.lead.estado)} se suele usar: ${sug.map(s => esc(s[1].toLowerCase())).join(' y ')}.</span><button class="tk-btn tk-btn-sm" data-tkc-sug>Usar</button></div>` : ''}
      ${C.pasos.map((p, i) => { const d = DET[p.detector] || DET.manual;
        return `<div class="tk-pstep"><span class="tk-ico"><i class="${d[0]}"></i></span><div><input class="tk-input" data-tkc-paso="${i}" maxlength="200" value="${esc(p.titulo)}" aria-label="Paso ${i + 1}">
          ${p.detector === 'estado_lead' ? `<select class="tk-input tk-fsel" data-tkc-estado="${i}" aria-label="Estado al que debe llegar">${ESTADOS_META.map(e => `<option${p.params?.estado === e ? ' selected' : ''}>${e}</option>`).join('')}</select>` : ''}
          ${p.detector === 'evidencia' ? `<select class="tk-input tk-fsel" data-tkc-evtipo="${i}" aria-label="Qué evidencia pide">${[['foto', 'Foto'], ['nota', 'Nota o enlace'], ['archivo', 'Foto o PDF']].map(([v, l]) =>
            `<option value="${v}"${(p.params?.tipo || 'nota') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>` : ''}
          ${yaCumple(p) ? '<small class="is-warn"><i class="fas fa-circle-info"></i> Ya se cumple: quedará como «ya estaba hecho»</small>'
            : `<small>${p.detector === 'manual' ? 'Lo marca la persona' : p.detector === 'evidencia' ? 'La envía la persona y se revisa antes de cerrar' : 'Se marca solo · ' + d[1]}</small>`}</div>
          <button class="tk-icon-btn" data-tkc-quitar="${i}" aria-label="Quitar paso"><i class="fas fa-xmark"></i></button></div>`; }).join('')}
      ${C.pasos.length < 12 ? `<button class="tk-btn tk-btn-sm" data-tkc-cat aria-expanded="${C.cat}"><i class="fas fa-${C.cat ? 'minus' : 'plus'}"></i> Agregar paso</button>` : ''}
      ${C.cat ? `<div class="tk-cat">${Object.entries(DET).filter(([k]) => k !== 'documento_subido' && (k !== 'wa_enviado' || WA_DETECTA)).map(([k, d]) =>
        `<button data-tkc-add="${k}"${sinCliente(k) ? ' disabled' : ''}><span class="tk-ico"><i class="${d[0]}"></i></span><span>${k === 'manual' ? 'Lo marca la persona' : d[1]}<small>${
          sinCliente(k) ? (repite ? 'No va en tareas que se repiten' : 'Elige un cliente primero') : k === 'manual' ? 'Toca «Listo»' : k === 'evidencia' ? 'Foto, nota o enlace' : 'Se detecta solo'}</small></span></button>`).join('')}</div>` : ''}
      <p class="tk-note" style="margin-top:9px"><i class="fas fa-circle-info"></i> Sin pasos, la persona solo toca «Listo».</p>`);
    put('prio', `<span class="tk-label">Prioridad</span>${chips('prio', [['baja', 'Baja'], ['media', 'Normal'], ['alta', 'Alta'], ['urgente', 'Urgente']])}`);
    put('rep', `<span class="tk-label">Repetir</span>${chips('rep', [['no', 'No se repite'], ['diaria', 'Cada día hábil'], ['semanal', 'Cada semana'], ['mensual', 'Cada mes']])}
      ${repite ? `<div class="tk-rep">${C.rep === 'semanal' ? `<div class="tk-chips" role="group" aria-label="Qué días">${[1, 2, 3, 4, 5, 6, 7].map(d =>
          `<button class="tk-chip" data-tkc-dia="${d}" aria-pressed="${C.repDias.has(d)}" aria-label="${['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][d]}">${DIAS[d % 7]}</button>`).join('')}</div>` : ''}
        <div class="tk-rep-row">${C.rep === 'mensual' ? `<label>Día<select class="tk-input tk-fsel" id="tk-c-dmes">${Array.from({ length: 28 }, (_, i) =>
          `<option${C.repDia === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></label>` : ''}
          <label>Se crea a las<input class="tk-input" type="time" id="tk-c-hora" value="${esc(C.repHora)}"></label></div>
        <p class="tk-note"><i class="fas fa-repeat"></i> Vence al cierre del horario. Si la anterior sigue abierta, no se apila.</p></div>` : ''}`);
    put('vence', repite ? '<span class="tk-label">Vence</span><p class="tk-note">Cada una vence al cierre del horario de ese día.</p>'
      : `<span class="tk-label">Vence</span>${chips('vence', [['17', 'Hoy 5 pm'], ['m9', 'Mañana 9 am'], ['vie', 'Viernes 10 am'], ['otra', 'Elegir fecha'], ['', 'Sin fecha']])}
      ${C.vence === 'otra' ? `<input class="tk-input" type="datetime-local" id="tk-c-fecha" value="${esc(C.otra)}" style="margin-top:9px" aria-label="Fecha y hora de Caracas">` : ''}`);
    put('aprob', `<div>Requiere mi aprobación al terminar<small>Si no, se cierra sola cuando todo se verifica.</small></div><button class="tk-switch" role="switch" aria-checked="${C.aprob}" data-tkc-aprob aria-label="Requiere aprobación"></button>`);
    const pasos = C.pasos.length ? C.pasos : [pasoNuevo('manual', 'Marcar como hecha')], px = pasos.find(p => !yaCumple(p));
    const prev = { id: 0, titulo: C.titulo || 'Título de la tarea', prioridad: C.prio, vence_at: C.modo === 'tarea' && !repite ? venceDe(C.vence, C.otra) : null, creador: 'administración',
      visto_at: null, estado: 'pendiente', lead: C.lead, pasos_total: pasos.length, pasos_hechos: pasos.filter(yaCumple).length, proximo: px ? { id: 0, detector: px.detector, titulo: px.titulo } : null };
    put('prev', `<span class="tk-label">Así la verá ${esc(sel.length === 1 ? corto(sel[0].nombre) : sel.length ? sel.length + ' personas' : 'la persona')}</span><div inert>${tarjeta(prev)}</div>
      <small>${C.modo === 'tarea' ? 'Si son varias personas, cada una ve la suya.' : 'Al usar la plantilla eliges el cliente y para cuándo.'}</small>`);
    put('pie', C.modo === 'plantilla' ? '<button class="tk-btn tk-btn-ghost" data-tk-cerrar-hoja>Cancelar</button><button class="tk-btn tk-btn-pri" data-net data-tkc-guardar-tpl>Guardar plantilla</button>'
      : repite ? `<button class="tk-btn tk-btn-ghost" data-tk-cerrar-hoja>Cancelar</button><button class="tk-btn tk-btn-pri" data-net data-tkc-ok${sel.length ? '' : ' disabled'}><i class="fas fa-repeat"></i> Programar</button>`
      : `<button class="tk-btn tk-btn-ghost" data-net data-tkc-guardar-tpl>Guardar como plantilla</button><button class="tk-btn tk-btn-pri" data-net data-tkc-ok${sel.length ? '' : ' disabled'}>Asignar${sel.length > 1 ? ` a ${sel.length} personas` : ''}</button>`);
  }
  function datosCrear() {
    const c = document.getElementById('tk-hoja-crear');
    C.titulo = c.querySelector('#tk-c-t').value.trim();
    if (!C.titulo) throw new Error('Escribe un título');
    return { titulo: C.titulo, descripcion: c.querySelector('#tk-c-d').value.trim(), prioridad: C.prio, requiere_aprobacion: C.aprob,
      pasos: C.pasos.map(p => ({ detector: p.detector, titulo: p.titulo.trim() || pasoNuevo(p.detector, '', p.params).titulo, params: p.params || {}, requerido: true })) };
  }
  function recurrencia() {
    if (C.rep === 'no') return null;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(C.repHora || '')) throw new Error('Elige a qué hora se crea');
    if (C.rep === 'semanal' && !C.repDias.size) throw new Error('Elige al menos un día');
    return { frecuencia: C.rep, hora: C.repHora, ...(C.rep === 'semanal' ? { dias: [...C.repDias].sort((a, b) => a - b) } : {}),
      ...(C.rep === 'mensual' ? { dia_mes: C.repDia } : {}) };
  }
  async function enviarCrear() {
    const d = datosCrear();
    if (C.rep !== 'no') {
      Object.assign(d, { destinatarios: C.rol ? { rol: C.rol } : { ids: [...C.para] }, recurrencia: recurrencia() });
      await rpc('tarea_plantilla_guardar', { p_id: C.tplNueva, p_datos: d });
      document.getElementById('tk-hoja-crear')?.remove(); C = null;
      toast(`Programada · ${textoRec(d.recurrencia)}. La crea el sistema solo.`);
      plantillas = null;
      if (vista === 'plantillas') cargarPlantillas();
      return;
    }
    if (C.vence === 'otra' && !C.otra) throw new Error('Elige la fecha');
    Object.assign(d, { vence_at: venceDe(C.vence, C.otra), lead_id: C.lead?.id || null, cliente_token: C.token, plantilla_id: C.usarPlantilla });
    if (C.rol) d.rol = C.rol; else d.destinatarios = [...C.para];
    const r = await rpc('tarea_crear', { p_datos: d }), n = (r.ids || []).length, avisos = r.avisos || [];
    document.getElementById('tk-hoja-crear')?.remove(); C = null;
    toast(r.repetida ? 'Ya estaba asignada' : `Asignada${n > 1 ? ` a ${n} personas` : ''}${r.previos ? ` · ${r.previos} paso${r.previos > 1 ? 's ya estaban hechos' : ' ya estaba hecho'}` : ''}`);
    if (avisos.length) toast(avisos.length > 1 ? `${avisos.length} personas no han entrado hoy: la verán al entrar` : avisos[0].mensaje);
    cargarTablero(); recargarPronto();
  }
  async function guardarPlantilla() {
    const d = { ...datosCrear(), destinatarios: C.rol ? { rol: C.rol } : { ids: [...C.para] }, recurrencia: recurrencia() }, editando = C.modo === 'plantilla';
    const r = await rpc('tarea_plantilla_guardar', { p_id: editando ? C.plantillaId : C.tplNueva, p_datos: d });
    if (editando) { document.getElementById('tk-hoja-crear')?.remove(); C = null; } else C.tplNueva = r.id;
    toast(editando ? 'Plantilla guardada' : 'Guardada como plantilla');
    plantillas = null;
    if (vista === 'plantillas') cargarPlantillas();
  }
  function buscarLead(q) {
    clearTimeout(timerBusca);
    const t = String(q || '').replace(/[,()*%\\:"']/g, ' ').trim(), res = document.querySelector('#tk-hoja-crear [data-c="res"]');
    if (!res) return;
    if (t.length < 2) { res.innerHTML = ''; return; }
    timerBusca = setTimeout(async () => {
      const n = Number(t.replace(/^#/, '')), f = ['nombre', 'telefono'].map(c => `${c}.ilike.*${t}*`);
      if (Number.isInteger(n) && n > 0) f.push(`id.eq.${n}`);
      const { data, error } = await sb.from('leads').select('id,nombre,telefono,estado,asesor').is('eliminado_at', null).or(f.join(',')).order('id', { ascending: false }).limit(6);
      const r = document.querySelector('#tk-hoja-crear [data-c="res"]');
      if (!C || !r) return;
      C.res = data || [];
      r.innerHTML = error ? '<div class="tk-note" style="color:var(--danger)">No se pudo buscar, reintenta</div>' : !C.res.length ? '<div class="tk-note">Sin resultados</div>'
        : C.res.map((l, i) => `<button class="tk-c-op" data-tkc-lead="${i}"><span class="tk-av">${esc(iniciales(l.nombre))}</span><span><b>${esc(l.nombre || 'Sin nombre')}</b><small>${esc(l.estado || '')}${l.asesor ? ' · ' + esc(l.asesor) : ''}</small></span></button>`).join('');
    }, 300);
  }
  function clicCrear(ds) {
    if (ds.tkcPara) { C.rol = null; if (!C.para.delete(ds.tkcPara)) C.para.add(ds.tkcPara); return pintarCrear('para', 'prev', 'pie'); }
    if (ds.tkcRol) { C.rol = C.rol ? null : ds.tkcRol; if (C.rol) C.para.clear(); return pintarCrear('para', 'prev', 'pie'); }
    if ('tkcPrio' in ds) { C.prio = ds.tkcPrio; return pintarCrear('prio', 'prev'); }
    if ('tkcVence' in ds) { C.vence = ds.tkcVence; return pintarCrear('vence', 'prev'); }
    if ('tkcAprob' in ds) { C.aprob = !C.aprob; return pintarCrear('aprob'); }
    if ('tkcRep' in ds) {
      C.rep = ds.tkcRep;
      if (C.rep !== 'no') { C.lead = null; C.pasos = C.pasos.filter(p => ['manual', 'evidencia'].includes(p.detector)); }
      return pintarCrear('rep', 'cliente', 'pasos', 'vence', 'prev', 'pie');
    }
    if (ds.tkcDia) { const d = Number(ds.tkcDia); if (!C.repDias.delete(d)) C.repDias.add(d); return pintarCrear('rep'); }
    if ('tkcCat' in ds) { C.cat = !C.cat; return pintarCrear('pasos'); }
    if (ds.tkcAdd) {
      C.pasos.push(ds.tkcAdd === 'estado_lead' ? pasoNuevo('estado_lead', '', { estado: siguienteEstado() }) : pasoNuevo(ds.tkcAdd));
      C.cat = false; return pintarCrear('pasos', 'prev');
    }
    if (ds.tkcQuitar) { C.pasos.splice(Number(ds.tkcQuitar), 1); return pintarCrear('pasos', 'prev'); }
    if ('tkcSug' in ds) { C.pasos = SUGERIDOS[Math.min(rangoLead(), 5)].map(([k, t, p]) => pasoNuevo(k, t, p)); return pintarCrear('pasos', 'prev'); }
    if ('tkcSinLead' in ds) { C.lead = null; C.pasos = C.pasos.filter(p => ['manual', 'evidencia'].includes(p.detector)); return pintarCrear('cliente', 'pasos', 'prev'); }
    if (ds.tkcLead) { C.lead = C.res[Number(ds.tkcLead)] || null; return pintarCrear('cliente', 'pasos', 'prev'); }
    return false;
  }

  // ── Acciones del admin: devolver, responder, reasignar, cancelar ─────────────────
  const HOJA_ACC = { devolver: ['Devolver la tarea', 'Qué tiene que corregir', 'Devolver', true, 'Le llega con tu motivo y un paso «Corregir».'],
    responder: ['Responder el problema', 'Tu respuesta', 'Responder', false, 'La tarea vuelve a quedar activa.'],
    cancelar: ['Cancelar la tarea', 'Motivo (opcional)', 'Cancelar tarea', false, ''], reasignar: ['Reasignar la tarea', 'Motivo (opcional)', 'Reasignar', false, 'Los pasos hechos se conservan.'] };
  // Editar título, indicaciones, prioridad, vence y aprobación. Los pasos no se tocan acá (se conservan).
  function hojaEditar(id) {
    const t = detalle?.tarea;
    if (!t || t.id !== id) return;
    const local = t.vence_at ? new Date(t.vence_at).toLocaleString('sv-SE', { timeZone: TZ }).slice(0, 16).replace(' ', 'T') : '';
    hoja('tk-hoja-edit', 'Editar tarea', `
      <div class="tk-field"><label class="tk-label" for="tk-e-t">Título</label><input class="tk-input" id="tk-e-t" maxlength="200" value="${esc(t.titulo)}"></div>
      <div class="tk-field"><label class="tk-label" for="tk-e-d">Indicaciones</label><textarea class="tk-input" id="tk-e-d" maxlength="2000">${esc(t.descripcion || '')}</textarea></div>
      <div class="tk-field"><span class="tk-label">Prioridad</span><div class="tk-chips" role="group">${[['baja', 'Baja'], ['media', 'Normal'], ['alta', 'Alta'], ['urgente', 'Urgente']].map(([v, l]) =>
        `<button class="tk-chip" data-tked-prio="${v}" aria-pressed="${t.prioridad === v}">${l}</button>`).join('')}</div></div>
      <div class="tk-field"><label class="tk-label" for="tk-e-v">Vence (hora de Caracas; vacío = sin fecha)</label><input class="tk-input" type="datetime-local" id="tk-e-v" value="${local}"></div>
      <div class="tk-switch-row"><div>Requiere mi aprobación al terminar</div><button class="tk-switch" role="switch" aria-checked="${!!t.requiere_aprobacion}" data-tked-aprob aria-label="Requiere aprobación"></button></div>
      <div class="tk-note"><i class="fas fa-circle-info"></i> La persona ve el cambio al instante; los pasos hechos se conservan.</div>`,
      `<button class="tk-btn tk-btn-ghost" data-tk-cerrar-hoja>Cancelar</button><button class="tk-btn tk-btn-pri" data-net data-tked-ok="${id}" data-v="${t.version}">Guardar</button>`);
  }
  async function guardarEdicion(b) {
    const c = document.getElementById('tk-hoja-edit'), id = Number(b.dataset.tkedOk), titulo = c.querySelector('#tk-e-t').value.trim(), v = c.querySelector('#tk-e-v').value;
    if (!titulo) throw new Error('Escribe un título');
    const datos = { titulo, descripcion: c.querySelector('#tk-e-d').value.trim(), vence_at: v ? new Date(`${v}:00-04:00`).toISOString() : '',
      prioridad: c.querySelector('[data-tked-prio][aria-pressed="true"]')?.dataset.tkedPrio || detalle?.tarea?.prioridad || 'media',
      requiere_aprobacion: c.querySelector('[data-tked-aprob]').getAttribute('aria-checked') === 'true' };
    try {
      await rpc('tarea_editar', { p_id: id, p_version: Number(b.dataset.v), p_datos: datos });
      toast('Tarea actualizada');
    } catch (err) {
      if (!/cambió/.test(err.message)) throw err;
      toast(err.message, true);
    }
    c.remove();
    if (abierta === id) abrirTarea(id, { silencioso: true });
    trasAccion(id);
  }
  function hojaAccion(tipo, id, version, asesorId) {
    const T = HOJA_ACC[tipo], per = destinatarios().filter(p => p.id !== asesorId);
    const c = hoja('tk-hoja-acc', T[0], `${tipo === 'reasignar' ? `<div class="tk-field"><span class="tk-label">Para</span><div class="tk-chips" role="group">${per.map(p =>
        `<button class="tk-chip" data-tk-acc-para="${p.id}" aria-pressed="false"><span class="tk-av" data-pres="${presencia(p.ultima_presencia)[0]}">${esc(iniciales(p.nombre))}</span>${esc(corto(p.nombre))}</button>`).join('')}</div></div>` : ''}
      <div class="tk-field"><label class="tk-label" for="tk-acc-t">${T[1]}</label><textarea class="tk-input" id="tk-acc-t" maxlength="1000"></textarea></div>
      ${T[4] ? `<div class="tk-note"><i class="fas fa-circle-info"></i> ${T[4]}</div>` : ''}`,
      `<button class="tk-btn tk-btn-ghost" data-tk-cerrar-hoja>Volver</button><button class="tk-btn tk-btn-pri" data-net data-tk-acc-ok>${T[2]}</button>`);
    Object.assign(c.dataset, { tipo, id, version: version || '', req: T[3] ? '1' : '' });
  }
  async function enviarAccion(c) {
    const tipo = c.dataset.tipo, id = Number(c.dataset.id), txt = c.querySelector('#tk-acc-t').value.trim();
    if (c.dataset.req && !txt) throw new Error('Escribe el motivo');
    if (tipo === 'devolver') await rpc('tarea_devolver', { p_id: id, p_motivo: txt });
    else if (tipo === 'responder') await rpc('tarea_resolver_problema', { p_id: id, p_respuesta: txt || null });
    else if (tipo === 'cancelar') await rpc('tarea_cancelar', { p_id: id, p_motivo: txt || null });
    else {
      const para = c.querySelector('[data-tk-acc-para][aria-pressed="true"]')?.dataset.tkAccPara;
      if (!para) throw new Error('Elige a quién');
      await rpc('tarea_reasignar', { p_id: id, p_version: Number(c.dataset.version), p_asesor_id: para, p_motivo: txt || null });
    }
    c.remove();
    toast({ devolver: 'Devuelta', responder: 'Respondido', cancelar: 'Cancelada', reasignar: 'Reasignada' }[tipo]);
    trasAccion(id);
  }
  function trasAccion(id) {
    cargarTablero(); recargarPronto();
    if (abierta === id) abrirTarea(id, { silencioso: true });
  }

  // ── Ficha del lead: tareas sobre este cliente ──────────────────────────────────────
  function bloqueLead(el, lead) {
    if (!el || !lead?.id) return;
    bloque = { el, lead };
    el.innerHTML = '<div class="tk-skel" style="height:46px;margin:0"></div>';
    pintarBloque();
  }
  async function pintarBloque() {
    const b = bloque;
    if (!b?.el.isConnected) return;
    let html;
    try {
      const ts = (await rpc('tareas_de_lead', { p_lead_id: Number(b.lead.id) })).tareas || [];
      html = !ts.length ? '<div class="tk-note">Sin tareas sobre este cliente.</div>' : `<div class="tk-lt">${ts.slice(0, 8).map(t => {
        const e = ESTADO[t.estado] || ESTADO.pendiente, v = ABIERTOS.includes(t.estado) ? vence(t) : null;
        return `<div class="tk-lt-i" data-tk-open="${t.id}" role="button" tabindex="0"><div><b>${esc(t.titulo)}</b><small>${esc(t.asesor || '')}${
          v ? ` · <span${v.mal ? ' class="is-bad"' : ''}>${esc(v.txt)}</span>` : ''}${t.en_lote ? ' · cola diaria' : ''}</small></div><span class="tk-est" style="--c:${e[1]}">${e[0]}</span></div>`;
      }).join('')}</div>`;
    } catch (e) { html = `<div class="tk-note" style="color:var(--danger)">${esc(e.message)}</div>`; }
    if (bloque !== b || !b.el.isConnected) return;
    b.el.innerHTML = html + `<button class="tk-btn tk-btn-sm" data-tk-nueva-lead style="margin-top:9px"><i class="fas fa-plus"></i> ${gestor() ? 'Nueva tarea' : 'Recordatorio'}</button>`;
  }

  // ── Acciones ─────────────────────────────────────────────────────────────────
  // Foto del teléfono: se achica a 1600 px en JPEG antes de subir (una foto de cámara pesa 4-8 MB).
  async function comprimir(file, max = 1600) {
    const bmp = typeof createImageBitmap === 'function' ? await createImageBitmap(file).catch(() => null) : null;
    if (!bmp) return file;
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close?.();
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.8));
    return blob && blob.size < file.size ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
  }
  async function subirFoto(pasoId, input) {
    const file = input.files?.[0], lbl = input.closest('label');
    if (!file || enviando) return;
    if (!navigator.onLine) { input.value = ''; return toast('Sin conexión: vuelve a intentarlo cuando vuelva', true); }
    enviando = true; lbl?.classList.add('is-busy');
    try {
      const cuerpo = file.type.startsWith('image/') ? await comprimir(file) : file;
      if (!/^image\/(jpeg|png|webp)$|^application\/pdf$/.test(cuerpo.type)) throw new Error('Solo fotos (JPG, PNG, WebP) o PDF');
      if (cuerpo.size > 6 * 1024 * 1024) throw new Error('El archivo pesa más de 6 MB');
      const fd = new FormData();
      fd.append('task_id', String(abierta)); fd.append('paso_id', String(pasoId)); fd.append('archivo', cuerpo, cuerpo.name || 'foto.jpg');
      const { data, error } = await sb.functions.invoke('tareas-evidencia', { body: fd });
      if (error || !data?.ok) throw new Error(data?.mensaje || 'No se pudo subir, reintenta');
      toast('Foto enviada'); abrirTarea(abierta, { silencioso: true }); recargarPronto();
    } catch (err) { toast(err.message || 'No se pudo subir, reintenta', true); }
    finally { enviando = false; lbl?.classList.remove('is-busy'); input.value = ''; }
  }
  async function conBoton(btn, fn) {
    if (enviando || btn?.disabled) return;
    enviando = true; if (btn) btn.disabled = true;
    try { await fn(); } catch (e) { toast(e.message, true); } finally { enviando = false; if (btn?.isConnected) btn.disabled = false; }
  }
  async function hacerAhora(btn, id, pasoId) {
    await conBoton(btn, async () => {
      const r = await rpc('tarea_registrar_accion', { p_id: Number(id), p_paso_id: Number(pasoId) });
      const p = r.paso || {};
      cerrarPanelMovil('ir'); cerrarDetalle();
      if (DE_RESERVA.includes(p.detector) && p.reserva_id && abrirReserva) abrirReserva(p.reserva_id, p.lead_id);
      else if (p.lead_id) abrirLead(p.lead_id);
      else abrirTarea(id);
    });
  }
  function clic(e) {
    const b = e.target.closest('button,[data-tk-open],[data-tk-cerrar],[data-tk-cerrar-hoja],[data-tk-persona],[data-tk-grupo]');
    if (!b) return;
    const ds = b.dataset;
    if ('tkCerrar' in ds) return cerrarDetalle();
    if ('tkCerrarHoja' in ds) { if (b.closest('#tk-hoja-crear')) C = null; return b.closest('.tk-overlay')?.remove(); }
    if (C && b.closest('#tk-hoja-crear') && clicCrear(ds) !== false) return;
    if ('tkcOk' in ds) return conBoton(b, enviarCrear);
    if ('tkcGuardarTpl' in ds) return conBoton(b, guardarPlantilla);
    if (ds.tkAccPara) { b.parentElement.querySelectorAll('[aria-pressed]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); return; }
    if ('tkAccOk' in ds) return conBoton(b, () => enviarAccion(b.closest('.tk-overlay')));
    if (ds.tkedPrio) { b.parentElement.querySelectorAll('[aria-pressed]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); return; }
    if ('tkedAprob' in ds) { b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true')); return; }
    if (ds.tkedOk) return conBoton(b, () => guardarEdicion(b));
    if (ds.tkAtn) {
      e.stopPropagation();
      const k = ds.tkAtn, id = Number(ds.id);
      if (k === 'ver') return abrirTarea(id);
      if (k === 'editar') return hojaEditar(id);
      if (k === 'aprobar') return conBoton(b, async () => { await rpc('tarea_aprobar', { p_id: id }); toast('Aprobada'); trasAccion(id); });
      return (async () => { if (k === 'reasignar' && !tablero) await cargarTablero(); hojaAccion(k, id, ds.v, ds.asesor); })();
    }
    if (ds.tkVista) {
      vista = ds.tkVista; guardarLocal('tk-vista', vista);
      if (vista !== 'mi' && (!tablero || tabSucio)) cargarTablero();
      if (vista === 'plantillas' && !plantillas) cargarPlantillas();
      return pintar();
    }
    if (ds.tkPersona) { filtros = { ...filtros, asesor_id: ds.tkPersona }; vista = 'lista'; guardarLocal('tk-vista', vista); pintar(); return cargarTablero(); }
    if (ds.tkGrupo) { if (!gruposAbiertos.delete(ds.tkGrupo)) gruposAbiertos.add(ds.tkGrupo); return pintar(); }
    if ('tkNueva' in ds) return crearTarea();
    if ('tkNuevaLead' in ds) return bloque && (gestor() ? crearTarea({ lead: bloque.lead }) : nuevoRecordatorio({ leadId: bloque.lead.id, leadNombre: bloque.lead.nombre }));
    if (ds.tkTplPausa) return conBoton(b, async () => {
      await rpc('tarea_plantilla_guardar', { p_id: Number(ds.tkTplPausa), p_datos: { activa: ds.activa === '1' } });
      toast(ds.activa === '1' ? 'Vuelve a crearse sola' : 'En pausa: no se crea hasta que la reanudes');
      plantillas = null; cargarPlantillas();
    });
    if (ds.tkTplUsar || ds.tkTplEditar) {
      const p = (plantillas || []).find(x => String(x.id) === (ds.tkTplUsar || ds.tkTplEditar));
      return p && crearTarea({ plantilla: p, modo: ds.tkTplEditar ? 'plantilla' : 'tarea' });
    }
    if ('tkTplNueva' in ds) return crearTarea({ modo: 'plantilla' });
    if ('tkIr' in ds) { cerrarPanelMovil('ir'); return irA('tareas'); }
    if ('tkEquipo' in ds) { vista = 'equipo'; guardarLocal('tk-vista', vista); return irA('tareas'); }
    if ('tkReintentarTab' in ds) return cargarTablero();
    if (ds.tkHacer) { e.stopPropagation(); return hacerAhora(b, ds.tkHacer, ds.paso); }
    if (ds.tkListo) {
      e.stopPropagation();
      return conBoton(b, async () => { await rpc('tarea_paso_listo', { p_id: Number(ds.tkListo), p_paso_id: Number(ds.paso) }); toast('✓ Listo'); recargarPronto(); if (abierta) abrirTarea(abierta, { silencioso: true }); });
    }
    if (ds.tkVerEv) {
      if (enviando || b.disabled) return;
      // La ventana se abre en el mismo toque: después del await el navegador la bloquearía.
      const w = window.open('about:blank', '_blank');
      return conBoton(b, async () => {
        try {
          const { data, error } = await sb.functions.invoke(`tareas-evidencia?evidencia_id=${Number(ds.tkVerEv)}`, { method: 'GET' });
          if (error || !data?.ok) throw new Error(data?.mensaje || 'No se pudo abrir el archivo');
          if (w) w.location.href = data.url; else location.href = data.url;
        } catch (err) { w?.close(); throw err; }
      });
    }
    if (ds.tkEvid) return conBoton(b, async () => {
      const txt = document.getElementById('tk-evid')?.value.trim();
      if (!txt) throw new Error('Escribe la nota o pega el enlace');
      await rpc('tarea_enviar_evidencia', { p_id: abierta, p_paso_id: Number(ds.tkEvid), p_tipo: /^https?:\/\//i.test(txt) ? 'enlace' : 'nota', p_contenido: txt });
      toast('Evidencia enviada'); abrirTarea(abierta, { silencioso: true }); recargarPronto();
    });
    if ('tkComentar' in ds) return conBoton(b, async () => {
      const inp = document.getElementById('tk-coment'), txt = inp?.value.trim();
      if (!txt) return;
      await rpc('tarea_comentar', { p_id: abierta, p_cuerpo: txt });
      abrirTarea(abierta, { silencioso: true });
    });
    if ('tkProblema' in ds) return hojaProblema();
    if ('tkMotivo' in ds || 'tkHora' in ds) {
      b.parentElement.querySelectorAll('[aria-pressed]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      return;
    }
    if ('tkProbEnviar' in ds) return conBoton(b, async () => {
      const c = b.closest('.tk-overlay'), m = c.querySelector('[data-tk-motivo][aria-pressed="true"]')?.dataset.tkMotivo;
      if (!m) throw new Error('Elige qué pasa');
      await rpc('tarea_reportar_problema', { p_id: abierta, p_motivo: m, p_descripcion: c.querySelector('#tk-prob-d').value });
      c.remove(); toast('Avisamos a administración'); abrirTarea(abierta, { silencioso: true }); recargarPronto();
    });
    if ('tkRecordatorio' in ds) return nuevoRecordatorio();
    if ('tkRecGuardar' in ds) return conBoton(b, async () => {
      const c = b.closest('.tk-overlay'), titulo = c.querySelector('#tk-rec-t').value.trim();
      if (!titulo) throw new Error('Escribe qué tienes que hacer');
      const k = c.querySelector('[data-tk-hora][aria-pressed="true"]')?.dataset.tkHora ?? '';
      const r = await rpc('tarea_crear', { p_datos: { titulo, vence_at: venceDe(k), destinatarios: [miId()], lead_id: c.dataset.lead || null,
        cliente_token: c.dataset.token, pasos: [{ titulo, detector: 'manual' }] } });
      c.remove(); toast(r.repetida ? 'Ya estaba guardado' : 'Recordatorio guardado'); recargarPronto();
    });
    if ('tkLead' in ds) { const id = Number(ds.tkLead); cerrarPanelMovil('ir'); cerrarDetalle(); return abrirLead(id); }
    if ('tkCola' in ds) { cerrarPanelMovil('ir'); return irA('clientes-asignados'); }
    if ('tkHechas' in ds) { verHechas = !verHechas; return pintar(); }
    if ('tkReintentar' in ds) return cargar();
    if (ds.tkOpen) return abrirTarea(ds.tkOpen);
  }
  // Texto en «input»; select y checkbox en «change» (si no, cada cambio de filtro carga dos veces).
  function cambio(e) {
    const el = e.target, discreto = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'file';
    if ((e.type === 'change') !== discreto || !el.closest?.('.tk-root,.tk-overlay')) return;
    if (el.dataset.tkF) { filtros = { ...filtros, [el.dataset.tkF]: el.type === 'checkbox' ? (el.checked || '') : el.value }; return cargarTablero(); }
    if (el.id === 'tk-f-q') {
      clearTimeout(timerBusca);
      timerBusca = setTimeout(() => { filtros = { ...filtros, q: el.value.trim() }; cargarTablero(); }, 350);
      return;
    }
    if (el.dataset.tkFoto) return subirFoto(Number(el.dataset.tkFoto), el);
    if (!C) return;
    if (el.id === 'tk-c-buscar') return buscarLead(el.value);
    if (el.id === 'tk-c-t') { C.titulo = el.value; return pintarCrear('prev'); }
    if (el.id === 'tk-c-fecha') { C.otra = el.value; return pintarCrear('prev'); }
    if (el.id === 'tk-c-hora') { C.repHora = el.value; return; }
    if (el.id === 'tk-c-dmes') { C.repDia = Number(el.value); return; }
    if (el.dataset.tkcPaso) { C.pasos[Number(el.dataset.tkcPaso)].titulo = el.value; return pintarCrear('prev'); }
    if (el.dataset.tkcEvtipo) { C.pasos[Number(el.dataset.tkcEvtipo)].params = { tipo: el.value }; return pintarCrear('prev'); }
    if (el.dataset.tkcEstado) {
      const p = C.pasos[Number(el.dataset.tkcEstado)];
      p.params = { estado: el.value }; p.titulo = `Llevarlo a ${el.value}`;
      return pintarCrear('pasos', 'prev');
    }
  }

  // ── Tiempo real ──────────────────────────────────────────────────────────────
  function conectar() {
    if (canal || !miId()) return;
    cerrando = false;
    let ch = sb.channel(`tk-mias-${miId()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `asesor_id=eq.${miId()}` }, payload => {
        recargarPronto();
        if (abierta && payload.new?.id === abierta) abrirTarea(abierta, { silencioso: true });
      });
    // Admin/administrativo: todo lo que su RLS deja ver mueve el tablero (con espera, la cola diaria llega en ráfaga).
    if (gestor()) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
      if (abierta && payload.new?.id === abierta && payload.new?.asesor_id !== miId()) abrirTarea(abierta, { silencioso: true });
      tableroPronto();
    });
    canal = ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_eventos' }, payload => {
        if (abierta && payload.new?.task_id === abierta && payload.new?.tipo === 'comentario') abrirTarea(abierta, { silencioso: true });
        tableroPronto();
      })
      .subscribe(estado => {
        vivo = estado === 'SUBSCRIBED';
        if (vivo) { if (intentos) { cargar(); cargarTablero(); } intentos = 0; return; }
        if (cerrando) return;
        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(estado)) reconectar();
      });
  }
  function reconectar() {
    if (timerRe) return;
    const c = canal; canal = null; cerrando = true;
    if (c) sb.removeChannel(c).catch(() => {});
    const espera = Math.min(30000, 1000 * 2 ** intentos++);
    timerRe = setTimeout(() => { timerRe = null; conectar(); }, espera);
  }

  // ── Panel del teléfono: swipe desde el borde derecho ───────────────────────────
  const esMovil = () => matchMedia('(max-width:760px)').matches;
  function abrirPanelMovil() {
    if (panelMovil?.isConnected) return;
    panelMovil = document.createElement('div'); panelMovil.className = 'tk-overlay tk-lateral';
    panelMovil.innerHTML = `<div class="tk-scrim is-dim" data-tk-cerrar-lateral></div><aside class="tk-panel tk-panel-lateral" role="dialog" aria-modal="true" aria-label="Mis tareas">
      <div class="tk-panel-h"><b style="flex:1;font-size:15px">Tareas</b><button class="tk-btn tk-btn-sm" data-tk-ver-todo>Ver sección</button>
      <button class="tk-icon-btn" data-tk-cerrar-lateral aria-label="Cerrar"><i class="fas fa-xmark"></i></button></div><div class="tk-panel-b tk-root"></div></aside>`;
    document.body.appendChild(panelMovil);
    panelMovil.addEventListener('click', e => {
      if (e.target.closest('[data-tk-cerrar-lateral]')) return cerrarPanelMovil();
      if (e.target.closest('[data-tk-ver-todo]')) { cerrarPanelMovil('ir'); return irA('tareas'); }
      clic(e);
    });
    document.body.classList.add('tk-lock');
    navLateral = { type: 'tk-panel', cerrar: () => cerrarPanelMovil('nav') };
    navPush?.(navLateral);
    arrastreCierre(panelMovil);
    pintar(); cargar(); conectar();
  }
  // modo 'nav': lo cerró el «atrás» del sistema (la entrada ya salió del historial).
  // modo 'ir': se cierra para navegar a otra pantalla; history.back() sería asíncrono y
  // se comería la entrada que esa navegación empuja, así que solo se saca de la pila.
  function cerrarPanelMovil(modo) {
    const p = panelMovil;
    if (!p) return;
    panelMovil = null;
    document.body.classList.remove('tk-lock');
    if (modo === 'ir') navQuitar?.(navLateral); else if (modo !== 'nav') navConsume?.();
    navLateral = null;
    const aside = p.querySelector('.tk-panel-lateral'), scrim = p.querySelector('.tk-scrim');
    p.style.pointerEvents = 'none';
    if (modo === 'ir' || !aside) return p.remove();
    aside.style.transition = 'transform .2s var(--ease-salida,ease-out)'; aside.style.transform = 'translateX(105%)';
    if (scrim) { scrim.style.transition = 'opacity .2s linear'; scrim.style.opacity = '0'; }
    setTimeout(() => p.remove(), 220);
  }
  // Deslizar a la derecha desde cualquier punto del panel lo cierra; el panel sigue al dedo.
  function arrastreCierre(ov) {
    const aside = ov.querySelector('.tk-panel-lateral'), scrim = ov.querySelector('.tk-scrim');
    let x0 = 0, y0 = 0, t0 = 0, dx = 0, eje = null, raf = 0;
    const zoom = () => parseFloat(getComputedStyle(document.body).zoom) || 1;
    const aplicar = () => { raf = 0; aside.style.transform = `translateX(${dx}px)`; if (scrim) scrim.style.opacity = String(1 - Math.min(1, dx / aside.offsetWidth)); };
    const soltar = () => { aside.style.transition = 'transform .2s var(--ease-salida,ease-out)'; aside.style.transform = ''; if (scrim) { scrim.style.transition = 'opacity .2s linear'; scrim.style.opacity = ''; } };
    ov.addEventListener('touchstart', e => {
      eje = null; dx = 0;
      if (e.touches.length !== 1 || e.target.closest('input,textarea,select') || scrollX(e.target)) { eje = 'no'; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
      aside.style.transition = ''; if (scrim) scrim.style.transition = '';
    }, { passive: true });
    ov.addEventListener('touchmove', e => {
      if (eje === 'no' || eje === 'y' || !panelMovil) return;
      const mx = (e.touches[0].clientX - x0) / zoom(), my = (e.touches[0].clientY - y0) / zoom();
      if (!eje) {
        if (Math.abs(mx) + Math.abs(my) < 8) return;
        eje = mx > 0 && Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y';
        if (eje === 'y') return;
      }
      e.preventDefault();
      dx = Math.max(0, mx);
      if (!raf) raf = requestAnimationFrame(aplicar);
    }, { passive: false });
    ov.addEventListener('touchend', () => {
      if (eje !== 'x') return;
      eje = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      const v = dx / Math.max(1, Date.now() - t0);
      if (dx > aside.offsetWidth * 0.3 || (v > 0.5 && dx > 30)) cerrarPanelMovil(); else soltar();
    }, { passive: true });
    ov.addEventListener('touchcancel', () => { if (eje === 'x') soltar(); eje = null; }, { passive: true });
  }
  // Zona ancha como MENU_BORDE del menú izquierdo: el borde exacto es el gesto «atrás» del sistema y el toque nunca llega.
  const BORDE = 150;
  const scrollX = el => { for (; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true; } return false; };
  function gestoBorde() {
    let x0 = 0, y0 = 0, activo = false;
    document.addEventListener('touchstart', e => {
      activo = false;
      if (!esMovil() || e.touches.length !== 1 || panelMovil || document.querySelector('.tk-overlay') || document.body.classList.contains('menu-abierto') || hayOverlayAbierto?.()) return;
      const t = e.touches[0];
      if (t.clientX < innerWidth - BORDE || e.target.closest?.('input,textarea,select') || scrollX(e.target)) return;
      x0 = t.clientX; y0 = t.clientY; activo = true;
    }, { passive: true });
    document.addEventListener('touchend', e => {
      if (!activo) return;
      activo = false;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (dx < -60 && Math.abs(dy) < Math.abs(dx) * 0.7) abrirPanelMovil();
    }, { passive: true });
  }

  // ── Avisos ───────────────────────────────────────────────────────────────────
  function toast(txt, malo = false) {
    let caja = document.getElementById('tk-toasts');
    if (!caja) { caja = document.createElement('div'); caja.id = 'tk-toasts'; caja.className = 'tk-toasts'; caja.setAttribute('aria-live', 'polite'); document.body.appendChild(caja); }
    const t = document.createElement('div'); t.className = 'tk-toast';
    t.innerHTML = `<i class="fas ${malo ? 'fa-circle-exclamation' : 'fa-circle-check'}"${malo ? ' style="color:var(--danger)"' : ''}></i><span>${esc(txt)}</span>`;
    caja.appendChild(t);
    setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 300); }, malo ? 4200 : 2600);
  }
  function refrescarBadge() {
    const el = document.getElementById('nav-tareas-v2-count');
    if (!el || !datos) return;
    const n = (datos.tareas || []).filter(t => !['completada', 'en_revision', 'bloqueada'].includes(t.estado)
      && (!t.vence_at || diaCcs(new Date(t.vence_at)) <= diaCcs(ahora()))).length;
    el.textContent = String(n); el.style.display = n ? '' : 'none';
  }

  // ── API ──────────────────────────────────────────────────────────────────────
  function enlazar() {
    if (enlazado) return;
    enlazado = true;
    document.addEventListener('click', e => { if (e.target.closest('.tk-overlay:not(.tk-lateral),#sec-tareas .tk-root,[data-tk-hoy],#d-tareas,[data-tk-ir]')) clic(e); });
    document.addEventListener('input', cambio);
    document.addEventListener('change', cambio);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const hojaAbierta = [...document.querySelectorAll('.tk-hoja')].pop();
        if (hojaAbierta) { if (hojaAbierta.id === 'tk-hoja-crear') C = null; return hojaAbierta.remove(); }
        if (abierta) return cerrarDetalle();
        if (panelMovil) return cerrarPanelMovil();
      }
      if (e.key === 'Enter' && e.target.id === 'tk-coment') document.querySelector('[data-tk-comentar]')?.click();
      if (e.key === 'Enter' && e.target.matches?.('.tk-card,.tk-person,.tk-row[role="button"],.tk-hoy-i,.tk-lt-i,.tk-atn-i [data-tk-open]')) e.target.click();
    });
    addEventListener('online', () => { pintar(); cargar(); cargarTablero(); if (!canal) conectar(); });
    addEventListener('offline', pintar);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (datos) recargarPronto();
      if (tabSucio) tableroPronto();
    });
    gestoBorde();
    conectar();
    cargar();
    cargarTablero();
  }
  function abrirSeccion(id) {
    raiz = document.querySelector('#sec-tareas .tk-root');
    if (!VISTAS.some(([k]) => k === vista)) vista = rol() === 'admin' ? 'equipo' : 'mi';
    pintar(); cargar(); conectar();
    if (gestor()) { cargarTablero(); if (vista === 'plantillas' && !plantillas) cargarPlantillas(); }
    if (id) abrirTarea(id);
  }
  return { enlazar, abrirSeccion, abrirTarea, nuevoRecordatorio, crearTarea, bloqueLead, abrirPanelMovil, recargar: cargar, rol };
}
