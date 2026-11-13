// Bandeja de WhatsApp del número de la empresa (Plan 5 v2 F2): los chats que
// guarda whatsapp-webhook, atendidos a mano por el asesor. La RLS decide qué ve
// cada quien (admin todo; asesor solo los chats de sus leads). Envía por la EF
// whatsapp-enviar: texto/imagen/documento con la ventana de 24 h abierta, si no,
// solo plantilla aprobada. En vivo por Realtime; CSS propio mínimo (prefijo wb-).
import { crearCampanasWa } from './wa-campanas.js';
import { crearGrabadorVoz } from './voz-grabar.js';
const VENTANA_MS = 24 * 60 * 60 * 1000;
export const ventanaWaAbierta = c => !!c?.ultimo_entrante_at && Date.now() - Date.parse(c.ultimo_entrante_at) < VENTANA_MS;
const TICK = { enviando: '🕓', enviado: '✓', entregado: '✓✓', leido: '✓✓', fallido: '!' };
const ERRORES = {
  ventana_cerrada: 'Pasaron más de 24 h desde el último mensaje del cliente: solo se puede mandar una plantilla',
  contacto_dado_de_baja: 'Este cliente pidió no recibir más mensajes',
  cuenta_pausada: 'El número está pausado',
  no_configurado: 'Falta conectar el número con Meta (token)',
  sin_acceso: 'Este chat no es tuyo',
  archivo_muy_grande: 'El archivo pesa demasiado (imagen hasta 5 MB, documento hasta 16 MB)',
  imagen_no_soportada: 'Solo fotos JPG o PNG',
  audio_no_soportado: 'Este navegador grabó un formato que WhatsApp no acepta',
  meta_rechazo: 'WhatsApp rechazó el mensaje',
};
// Nota de voz estilo WhatsApp, compartida con la vista de Zernio (app.js). El <audio> va oculto
// adentro y conserva el atributo de fuente de cada vista: el reuso de adjuntos entre re-pintados
// mueve ese mismo nodo a la burbuja nueva, y vozSync le pinta el estado (sigue sonando).
const VOZ_BARRAS = 32, VOZ_VEL = [1, 1.5, 2];
const vozTiempo = s => !Number.isFinite(s) || s < 0 ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function vozOnda(clave) {
  let h = 2166136261;
  for (const ch of String(clave)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let out = '';
  for (let i = 0; i < VOZ_BARRAS; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const alto = 22 + ((h >>> 0) % 78);
    out += `<b style="height:${Math.round(i < 2 || i > VOZ_BARRAS - 3 ? alto * .45 : alto)}%"></b>`;
  }
  return out;
}
export function vozHtml(fuente, clave) {
  instalarVoz();
  return `<div class="wa-voz"><button type="button" class="wa-voz-play" aria-label="Reproducir nota de voz"><i class="fas fa-play"></i></button>`
    + `<div class="wa-voz-cuerpo"><div class="wa-voz-onda" role="slider" tabindex="0" aria-label="Posición del audio" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${vozOnda(clave)}<i></i></div>`
    + `<div class="wa-voz-pie"><span class="wa-voz-t">0:00</span><button type="button" class="wa-voz-vel" aria-label="Velocidad">1×</button></div></div>`
    + `<audio class="wa-audio" preload="metadata" ${fuente}></audio></div>`;
}
export function vozSync(a) {
  const caja = a?.closest?.('.wa-voz');
  if (!caja) return;
  const dur = a.duration, fin = Number.isFinite(dur) && dur > 0, p = fin ? Math.min(1, a.currentTime / dur) : 0;
  const sonando = !a.paused && !a.ended;
  caja.querySelector('.wa-voz-play').innerHTML = `<i class="fas fa-${sonando ? 'pause' : 'play'}"></i>`;
  caja.querySelector('.wa-voz-play').setAttribute('aria-label', sonando ? 'Pausar' : 'Reproducir nota de voz');
  const onda = caja.querySelector('.wa-voz-onda');
  onda.style.setProperty('--p', `${p * 100}%`);
  onda.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  onda.querySelectorAll('b').forEach((b, i) => b.classList.toggle('on', (i + .5) / VOZ_BARRAS <= p));
  caja.querySelector('.wa-voz-t').textContent = vozTiempo(sonando || a.currentTime > 0 ? a.currentTime : dur);
  caja.querySelector('.wa-voz-vel').textContent = `${a.playbackRate}×`;
}
let vozInstalada = false;
function instalarVoz() {
  if (vozInstalada) return;
  vozInstalada = true;
  const audioDe = el => el.closest('.wa-voz')?.querySelector('audio');
  const tocar = a => {
    document.querySelectorAll('.wa-voz audio').forEach(x => x !== a && !x.paused && x.pause());
    if (!a.getAttribute('src') || a.readyState < 1) {
      a.closest('.wa-voz').querySelector('.wa-voz-play').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      a.dataset.vozPend = '1';
      if (a.getAttribute('src')) a.load();
      return;
    }
    a.play().catch(() => a.closest('.wa-voz')?.classList.add('error'));
  };
  const buscar = (onda, x) => {
    const a = audioDe(onda), r = onda.getBoundingClientRect();
    if (!a || !Number.isFinite(a.duration) || !r.width) return;
    a.currentTime = Math.max(0, Math.min(1, (x - r.left) / r.width)) * a.duration;
    vozSync(a);
  };
  ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'durationchange', 'ratechange'].forEach(ev => document.addEventListener(ev, e => {
    const a = e.target;
    if (a.tagName !== 'AUDIO' || !a.closest('.wa-voz')) return;
    if (ev === 'loadedmetadata') {
      a.closest('.wa-voz').classList.remove('cargando');
      if (a.dataset.vozPend) { delete a.dataset.vozPend; tocar(a); }
    }
    if (ev === 'ended') a.currentTime = 0;
    vozSync(a);
  }, true));
  document.addEventListener('error', e => {
    const caja = e.target.tagName === 'AUDIO' && e.target.closest('.wa-voz');
    if (caja && e.target.getAttribute('src')) { caja.classList.remove('cargando'); caja.classList.add('error'); }
  }, true);
  document.addEventListener('click', e => {
    const play = e.target.closest('.wa-voz-play'), vel = e.target.closest('.wa-voz-vel');
    if (!play && !vel) return;
    const a = audioDe(e.target);
    if (!a) return;
    if (vel) { a.playbackRate = VOZ_VEL[(VOZ_VEL.indexOf(a.playbackRate) + 1) % VOZ_VEL.length]; vozSync(a); return; }
    if (a.paused) tocar(a); else a.pause();
  });
  document.addEventListener('pointerdown', e => {
    const onda = e.target.closest('.wa-voz-onda');
    if (!onda || e.button > 0) return;
    e.preventDefault();
    buscar(onda, e.clientX);
    const mover = ev => buscar(onda, ev.clientX), soltar = () => { removeEventListener('pointermove', mover); removeEventListener('pointerup', soltar); };
    addEventListener('pointermove', mover); addEventListener('pointerup', soltar);
  });
  document.addEventListener('keydown', e => {
    const onda = e.target.closest?.('.wa-voz-onda'), a = onda && audioDe(onda);
    if (!a || !Number.isFinite(a.duration)) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); a.currentTime = Math.max(0, Math.min(a.duration, a.currentTime + (e.key === 'ArrowRight' ? 5 : -5))); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (a.paused) tocar(a); else a.pause(); }
  });
}
// Eliminar = ocultar en el CRM: WhatsApp no deja borrar un mensaje para el cliente por API.
export const borrarHtml = id => `<button type="button" class="wa-borrar" data-wa-borrar="${id}" title="Eliminar del CRM" aria-label="Eliminar mensaje"><i class="fas fa-trash-can"></i></button>`;
export function enlazarBorrar(log, alBorrar) {
  if (log._borrarEnlazado) return;
  log._borrarEnlazado = true;
  log.addEventListener('click', e => {
    const b = e.target.closest('[data-wa-borrar]');
    if (b) { e.stopPropagation(); alBorrar(b.dataset.waBorrar, b.closest('.chat-msg')); return; }
    if (!matchMedia('(hover:none)').matches) return;
    const msg = e.target.closest('.chat-msg');
    if (!msg || e.target.closest('a,button,img,video,.wa-voz,.msg-doc')) return;
    log.querySelectorAll('.chat-msg.sel').forEach(x => x !== msg && x.classList.remove('sel'));
    msg.classList.toggle('sel');
  });
}
const CSS = `
.wb-badge{margin-left:auto}
.wb-acciones{display:contents}
.wb-ventana{font-size:11.5px;color:var(--muted)}
.wb-ventana.cerrada{color:var(--amber)}
.wb-compose{display:flex;gap:8px;align-items:flex-end;padding:10px;border-top:1px solid var(--line)}
.wb-compose textarea{flex:1;resize:none;max-height:140px;min-height:42px;padding:10px 12px;border-radius:20px;border:1px solid var(--line2);background:var(--bg2);color:var(--txt);font:inherit}
.wb-ico,.wb-send{width:42px;height:42px;flex-shrink:0;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px}
.wb-ico{background:transparent;color:var(--muted)}
.wb-send{background:var(--wa);color:#fff}
.wb-send:disabled{opacity:.5;cursor:default}
.wb-plantilla{padding:10px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px}
.wb-plantilla select,.wb-plantilla input{padding:9px 11px;border-radius:10px;border:1px solid var(--line2);background:var(--bg2);color:var(--txt);font:inherit}
.wb-plantilla-cuerpo{font-size:13px;color:var(--muted);white-space:pre-wrap}
.wb-fallido{color:var(--danger)}
.wb-por{font-weight:700}
.wb-comp{margin-top:6px;padding:8px 10px;border-radius:10px;background:var(--bg2);border:1px solid var(--line2);font-size:12.5px;color:var(--txt)}
.wb-comp-ia{display:block;font-size:11px;color:var(--muted);margin-bottom:2px}
.wb-comp-alerta{color:var(--amber);margin-top:4px}
.wb-comp-acc{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
.wb-comp-acc button{padding:5px 9px;border-radius:8px;border:1px solid var(--line2);background:transparent;color:var(--txt);font:inherit;font-size:12px;cursor:pointer}
.wb-comp-acc .wb-comp-reserva{font-weight:700}
#wb-pdf-previa{flex:none;display:flex;flex-direction:column;gap:8px;padding:10px;border-top:1px solid var(--line);background:var(--panel-solid);color:var(--txt);font-size:14px}
#wb-pdf-previa header{display:flex;align-items:flex-start;gap:10px}
#wb-pdf-previa header>i{margin-top:3px;color:var(--danger)}
#wb-pdf-previa header>div{flex:1;min-width:0}
#wb-pdf-previa header b{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:600}
#wb-pdf-previa header small{display:block;color:var(--muted);font-size:12.5px}
#wb-pdf-previa button{font:inherit;color:inherit;cursor:pointer}
#wb-pdf-previa header button{flex:none;width:36px;height:36px;border:0;border-radius:10px;background:transparent;font-size:18px}
#wb-pdf-previa .wb-pv-pags{max-height:min(44dvh,420px);overflow:auto;display:grid;gap:8px;overscroll-behavior:contain}
#wb-pdf-previa canvas{display:block;width:100%;height:auto;border-radius:6px;background:#fff}
#wb-pdf-previa .wb-pv-nota{margin:12px 0;text-align:center;color:var(--muted);font-size:13px}
#wb-pdf-previa footer{display:flex;justify-content:flex-end;gap:8px}
#wb-pdf-previa footer button{min-width:0;min-height:40px;padding:8px 14px;border-radius:10px;border:1px solid var(--line2);background:transparent}
#wb-pdf-previa footer .wb-pv-enviar{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;border-color:transparent;background:var(--wa);color:#fff;font-weight:600}
`;

export function crearBandejaWa({ sb, esc, rol, textoConEnlaces, etiquetaDia, fmtHoraChat, fmtHoraMsg, initials, openLightbox, abrirLead, cotizarLead, puedeLlamar, llamarLead, crearReserva, cargarPdfjs, confirmar, ok, error, navPush, navConsume }) {
  let convs = [];
  let actual = null, grabador = null;
  let navWb = null;
  let mensajes = [];
  let comprobantes = new Map();
  let plantillas = null;
  const plantillasPor = new Map();
  let canalLista = null;
  let canalChat = null;
  let recarga = null;
  let gen = 0;
  const urls = new Map();
  const fotos = new Map(), fotosPedidas = new Set();
  const $ = id => document.getElementById(id);

  const ventanaAbierta = ventanaWaAbierta;
  function textoVentana(c) {
    if (!ventanaAbierta(c)) return '<span class="wb-ventana cerrada"><i class="fas fa-lock"></i> Ventana cerrada: solo plantilla</span>';
    const h = Math.max(0, Math.floor((VENTANA_MS - (Date.now() - Date.parse(c.ultimo_entrante_at))) / 3600000));
    return `<span class="wb-ventana"><i class="far fa-clock"></i> Ventana abierta · quedan ${h ? h + ' h' : 'minutos'}</span>`;
  }

  async function cargarLista(forzar) {
    const { data, error: e } = await sb.from('whatsapp_conversaciones')
      .select('id,nombre,wa_id,no_leidos,ultimo_mensaje_at,ultimo_entrante_at,lead_id,asesor,phone_number_id')
      .neq('phone_number_id', '__gate_pnid')
      .order('ultimo_mensaje_at', { ascending: false, nullsFirst: false }).limit(300);
    if (e) { $('wb-inbox').innerHTML = '<div class="msg-empty">No se pudieron cargar los chats</div>'; return; }
    convs = data || [];
    if (actual) actual = convs.find(c => c.id === actual.id) || actual;
    if (forzar === true || listaVisible()) pintarLista();
    pintarBadge();
    cargarFotos();
  }
  // Meta Cloud API no entrega la foto de perfil: wa_fotos_perfil la guarda cuando el mismo
  // número aparece en un chat de Zernio (whatsapp-inbox). Se pide una vez por número.
  async function cargarFotos() {
    const faltan = [...new Set(convs.map(c => c.wa_id))].filter(t => t && !fotosPedidas.has(t));
    if (!faltan.length) return;
    faltan.forEach(t => fotosPedidas.add(t));
    const { data } = await sb.from('wa_fotos_perfil').select('telefono,foto').in('telefono', faltan);
    if (!data?.length) return;
    data.forEach(f => fotos.set(f.telefono, f.foto));
    if (listaVisible()) pintarLista();
    if (actual && fotos.has(actual.wa_id)) pintarAvatar();
  }
  const avatarHtml = c => fotos.get(c.wa_id) ? `<img src="${esc(fotos.get(c.wa_id))}" alt="" loading="lazy" decoding="async" onerror="this.replaceWith(document.createTextNode(this.dataset.ini||''))" data-ini="${esc(initials(c.nombre || '#'))}">` : esc(initials(c.nombre || '#'));
  function pintarAvatar() {
    const el = $('wb-avatar'), foto = fotos.get(actual.wa_id);
    el.innerHTML = avatarHtml(actual);
    el.classList.toggle('wa-ver-foto', !!foto);
    el.title = foto ? 'Ver foto de perfil' : '';
  }
  // Fuera de la sección solo hace falta el contador: no se repintan 300 filas por cada cambio.
  const listaVisible = () => !document.hidden && !!$('wb-inbox')?.offsetParent;
  const recargarLista = () => { clearTimeout(recarga); recarga = setTimeout(cargarLista, listaVisible() ? 400 : 5000); };

  function pintarBadge() {
    const n = convs.reduce((s, c) => s + (c.no_leidos > 0 ? 1 : 0), 0), el = $('nav-wab-count');
    // El badge visible lo maneja app.js (waPintarAvisos, chats sin leer del número compartido).
    if (el) el.dataset.wb = String(n);
  }

  function pintarLista() {
    const q = ($('wb-buscar').value || '').trim().toLowerCase();
    const lista = q ? convs.filter(c => `${c.nombre || ''} ${c.wa_id}`.toLowerCase().includes(q)) : convs;
    const cont = $('wb-inbox');
    if (!lista.length) { cont.innerHTML = `<div class="msg-empty"><i class="fa-brands fa-whatsapp"></i><br>${q ? 'Sin resultados' : 'Sin chats todavía'}</div>`; return; }
    cont.innerHTML = lista.map(c => `
      <div class="msg-inbox-row${actual?.id === c.id ? ' on' : ''}" data-wb="${c.id}">
        <div class="msg-avatar dm-avatar" data-canal="whatsapp">${avatarHtml(c)}</div>
        <div class="msg-inbox-body">
          <div class="msg-inbox-top">
            <div class="msg-inbox-nombre">${esc(c.nombre || '+' + c.wa_id)}</div>
            ${c.ultimo_mensaje_at ? `<div class="msg-inbox-hora">${fmtHoraMsg(c.ultimo_mensaje_at)}</div>` : ''}
          </div>
          <div class="msg-inbox-preview"><span>+${esc(c.wa_id)}</span>${c.no_leidos > 0 ? `<span class="msg-inbox-badge wb-badge">${c.no_leidos}</span>` : ''}</div>
          <div class="wa-lead-linea">${c.lead_id ? `<i class="fas fa-user-check"></i> Lead${rol() === 'admin' && c.asesor ? ' · ' + esc(c.asesor) : ''}` : 'sin lead'}${ventanaAbierta(c) ? '' : ' · <i class="fas fa-lock"></i>'}</div>
        </div>
      </div>`).join('');
  }

  async function abrir(c) {
    cierraPrevia?.(); grabador?.cancelar();
    const g = ++gen;
    actual = c;
    if (!navWb && matchMedia('(max-width:760px)').matches) { navWb = { type: 'wb-conv' }; navPush?.(navWb); }
    $('wb-shell').classList.add('ver-chat');
    $('wb-vacio').hidden = true;
    ['wb-head', 'wb-log'].forEach(id => $(id).hidden = false);
    $('wb-titulo').textContent = c.nombre || '+' + c.wa_id;
    pintarAvatar();
    $('wb-ver-lead').style.display = c.lead_id ? '' : 'none';
    $('wb-cotizar').style.display = c.lead_id && ['admin', 'asesor'].includes(rol()) ? '' : 'none';
    $('wb-llamar').style.display = c.lead_id && puedeLlamar() ? '' : 'none';
    $('wb-acciones').style.display = c.lead_id ? '' : 'none';
    pintarCabecera();
    pintarCompositor();
    $('wb-log').innerHTML = '<div class="msg-empty"><i class="fas fa-spinner fa-spin"></i></div>';
    document.querySelectorAll('#wb-inbox [data-wb]').forEach(r => r.classList.toggle('on', Number(r.dataset.wb) === c.id));
    const { data, error: e } = await sb.from('whatsapp_mensajes')
      .select('wamid,direccion,tipo,texto,enviado_en,estado,error,enviado_por,plantilla,media_id,media_mime,media_path,transcripcion')
      .eq('conversacion_id', c.id).is('eliminado_en', null).order('enviado_en', { ascending: false }).limit(150);
    if (g !== gen) return;
    if (e) { $('wb-log').innerHTML = '<div class="msg-empty">No se pudieron cargar los mensajes</div>'; return; }
    mensajes = (data || []).reverse();
    comprobantes = new Map();
    pintarMensajes(true);
    suscribirChat(c.id);
    cargarComprobantes(c.id, g);
    if (c.no_leidos > 0) {
      c.no_leidos = 0; pintarLista(); pintarBadge();
      sb.rpc('wa_marcar_leida', { p_conversacion: c.id }).then(({ error: e2 }) => e2 && console.warn('wa_marcar_leida', e2.message));
    }
  }

  function cerrar(desdeNav) {
    cierraPrevia?.(); grabador?.cancelar();
    if (desdeNav !== true && navWb) navConsume?.();
    navWb = null;
    gen++;
    actual = null; mensajes = []; comprobantes = new Map();
    if (canalChat) { sb.removeChannel(canalChat); canalChat = null; }
    $('wb-shell').classList.remove('ver-chat');
    $('wb-vacio').hidden = false;
    ['wb-head', 'wb-log', 'wb-compose', 'wb-plantilla'].forEach(id => $(id).hidden = true);
    pintarLista();
  }

  function pintarCabecera() {
    $('wb-sub').innerHTML = `+${esc(actual.wa_id)} · ${textoVentana(actual)}`;
  }

  function pintarCompositor() {
    const abierta = ventanaAbierta(actual);
    $('wb-compose').hidden = !abierta;
    $('wb-plantilla').hidden = abierta;
    if (!abierta) pintarPlantillas();
  }

  function adjuntoHtml(m) {
    if (!m.media_id && !m.media_path) return '';
    const fuente = m.media_path ? `data-wb-media="${esc(m.media_path)}"` : '';
    if (!m.media_path) return `<div class="msg-doc"><i class="fas fa-paperclip"></i><div><div class="msg-doc-nombre">Adjunto (${esc(m.tipo)}) · aún no descargado</div></div></div>`;
    if (m.tipo === 'image' || m.tipo === 'sticker') return `<img class="msg-img" ${fuente} alt="Foto">`;
    // transcripcion: la escribe whatsapp-webhook al bajar la nota de voz (mismo bloque que Meta DM).
    if (m.tipo === 'audio') return `${vozHtml(fuente, m.media_path)}${m.transcripcion ? `<div class="wa-transcripcion"><i class="fas fa-microphone"></i><span>${esc(m.transcripcion)}</span></div>` : ''}`;
    if (m.tipo === 'video') return `<video class="msg-img" controls preload="metadata" ${fuente}></video>`;
    return `<div class="msg-doc" ${fuente} data-wb-doc="1"><i class="fas fa-file"></i><div><div class="msg-doc-nombre">${esc(etiquetaDoc(m))}</div></div></div>`;
  }
  function etiquetaDoc(m) {
    const mime = (m.media_mime || '').toLowerCase();
    if (mime.includes('pdf')) return 'Documento PDF';
    if (mime.includes('sheet') || mime.includes('excel')) return 'Hoja de cálculo';
    if (mime.includes('word') || mime.includes('msword') || mime.includes('opendocument.text')) return 'Documento';
    return 'Archivo';
  }

  const atributosTick = m => `class="msg-tick${m.estado === 'leido' ? ' leido' : ''}${m.estado === 'fallido' ? ' wb-fallido' : ''}" title="${esc(m.error || m.estado || '')}"`;
  function pintarTick(m) {
    document.querySelectorAll('#wb-log [data-wbm]').forEach(el => {
      if (el.dataset.wbm !== m.wamid) return;
      el.className = 'msg-tick' + (m.estado === 'leido' ? ' leido' : '') + (m.estado === 'fallido' ? ' wb-fallido' : '');
      el.title = m.error || m.estado || '';
      el.textContent = TICK[m.estado] || '';
    });
  }

  // Lo que la IA leyó de una imagen de pago. Solo sugiere: la persona registra el abono en la ficha.
  async function cargarComprobantes(id, g) {
    const { data } = await sb.from('wa_comprobantes').select('id,wamid,datos,estado,duplicado_de')
      .eq('conversacion_id', id).neq('estado', 'no_comprobante');
    if (g !== gen || actual?.id !== id) return;
    comprobantes = new Map((data || []).map(x => [x.wamid, x]));
    if (comprobantes.size) pintarMensajes(false);
  }
  function comprobanteHtml(m) {
    const c = comprobantes.get(m.wamid);
    if (!c) return '';
    const d = c.datos || {};
    const monto = d.monto != null ? `${d.moneda === 'VES' ? 'Bs ' : '$'}${Number(d.monto).toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : 'monto no legible';
    const partes = [d.metodo, d.referencia && `Ref. ${d.referencia}`, monto, d.fecha].filter(Boolean).map(esc).join(' · ');
    const dup = c.duplicado_de ? `<div class="wb-comp-alerta"><i class="fas fa-triangle-exclamation"></i> Esta referencia ya aparece ${c.duplicado_de.startsWith('abono:') ? 'en un abono registrado' : 'en otro comprobante de este número'}: revisa antes de registrar</div>` : '';
    const cierre = c.estado === 'registrado' ? '<div class="wb-ventana">Registrado</div>' : c.estado === 'descartado' ? '<div class="wb-ventana">Descartado</div>'
      : `<div class="wb-comp-acc">${actual?.lead_id && ['admin', 'asesor', 'administrativo'].includes(rol()) ? `<button class="wb-comp-reserva" data-wb-reserva="${c.id}"><i class="fas fa-plus"></i> Crear reserva</button>` : ''}<button data-wb-comp="${c.id}" data-wb-est="registrado">Ya lo registré</button><button data-wb-comp="${c.id}" data-wb-est="descartado">Descartar</button></div>`;
    return `<div class="wb-comp"><span class="wb-comp-ia"><i class="fas fa-wand-magic-sparkles"></i> Lo leyó la IA, verifícalo con el banco</span><b>${partes || 'Sin datos legibles'}</b>${dup}${cierre}</div>`;
  }
  async function eliminarMensaje(wamid) {
    const id = actual?.id;
    if (!id || !(await confirmar({ titulo: '¿Eliminar este mensaje?', detalle: 'Se quita del CRM para todo el equipo. WhatsApp no permite borrarlo del teléfono del cliente: él lo sigue viendo.', textoOk: 'Eliminar', destructivo: true }))) return;
    const { error: e } = await sb.rpc('wa_eliminar_mensaje', { p_wamid: wamid });
    if (e) { error(e.message?.includes('no_autorizado') ? 'Este chat no es tuyo' : 'No se pudo eliminar el mensaje'); return; }
    if (actual?.id !== id) return;
    mensajes = mensajes.filter(x => x.wamid !== wamid);
    pintarMensajes(false);
    ok('Mensaje eliminado del CRM');
  }
  async function marcarComprobante(id, estado) {
    const { error: e } = await sb.from('wa_comprobantes').update({ estado }).eq('id', id);
    if (e) { error('No se pudo actualizar el comprobante'); return; }
    for (const c of comprobantes.values()) if (c.id === id) c.estado = estado;
    pintarMensajes(false);
  }

  async function reservaDeComprobante(id) {
    const c = [...comprobantes.values()].find(x => x.id === id), leadId = actual?.lead_id;
    if (!c || !leadId) return;
    const path = mensajes.find(x => x.wamid === c.wamid)?.media_path;
    crearReserva(leadId, c, path ? await urlFirmada(path) : null);
  }

  function pintarMensajes(alFinal) {
    const log = $('wb-log');
    const abajo = alFinal || log.scrollTop + log.clientHeight >= log.scrollHeight - 40;
    let html = '', dia = null;
    mensajes.forEach((m, i) => {
      const sale = m.direccion !== 'entrante', f = new Date(m.enviado_en), key = f.toDateString(), prev = mensajes[i - 1], sig = mensajes[i + 1];
      if (key !== dia) { html += `<div class="msg-date-chip">${etiquetaDia(f)}</div>`; dia = key; }
      const mismo = x => x && (x.direccion !== 'entrante') === sale && new Date(x.enviado_en).toDateString() === key;
      const quien = sale ? (m.direccion === 'saliente_app' ? 'Teléfono' : (m.enviado_por || 'CRM')) : '';
      const tick = sale ? `<span data-wbm="${esc(m.wamid)}" ${atributosTick(m)}>${TICK[m.estado] || ''}</span>` : '';
      const meta = !mismo(sig) ? `<div class="msg-meta">${quien ? `<span class="wb-por">${esc(quien)}</span>` : ''}<span>${fmtHoraChat(m.enviado_en)}</span>${tick}</div>` : '';
      const adj = adjuntoHtml(m);
      const texto = m.texto ? `<div>${m.plantilla ? '<i class="fas fa-file-lines"></i> ' : ''}${textoConEnlaces(m.texto)}</div>` : (adj ? '' : `<div><i>(${esc(m.tipo)})</i></div>`);
      html += `<div class="chat-msg ${sale ? 'mine' : 'other'}${mismo(prev) ? ' grouped' : ''}${!mismo(sig) ? ' tail' : ''}${adj ? ' adjunto' : ''}">${m._tmp ? '' : borrarHtml(esc(m.wamid))}${adj}${texto}${comprobanteHtml(m)}${meta}</div>`;
    });
    // Las fotos/audios ya cargados se reusan: recrearlos dejaba cajas en 0 px hasta la URL firmada
    // (la lista saltaba) y cortaba el audio que se estaba escuchando.
    const previos = new Map([...log.querySelectorAll('[data-wb-media][src]')].map(el => [el.dataset.wbMedia, el]));
    log.innerHTML = html || '<div class="msg-empty">Sin mensajes</div>';
    log.querySelectorAll('[data-wb-media]').forEach(el => {
      const v = previos.get(el.dataset.wbMedia);
      if (v && v.tagName === el.tagName) { previos.delete(el.dataset.wbMedia); el.replaceWith(v); vozSync(v); } else cargarMedia(el);
    });
    if (abajo) log.scrollTop = log.scrollHeight;
  }

  // La URL firmada dura 1 h: se renueva a los 55 min y un fallo (null) no se guarda.
  function urlFirmada(path) {
    const c = urls.get(path);
    if (c && c.hasta > Date.now()) return c.p;
    const p = sb.storage.from('whatsapp-media').createSignedUrl(path, 3600).then(({ data }) => data?.signedUrl || null, () => null);
    const ent = { p, hasta: Date.now() + 55 * 60_000 };
    urls.set(path, ent);
    p.then(u => { if (!u && urls.get(path) === ent) urls.delete(path); });
    return p;
  }
  async function cargarMedia(el) {
    const url = await urlFirmada(el.dataset.wbMedia);
    if (!url) return;
    if (el.dataset.wbDoc) { el.addEventListener('click', () => window.open(url, '_blank', 'noopener')); return; }
    const log = $('wb-log'), pegado = log.scrollTop + log.clientHeight >= log.scrollHeight - 60;
    el.addEventListener(el.tagName === 'VIDEO' ? 'loadedmetadata' : 'load', () => { if (pegado) log.scrollTop = log.scrollHeight; }, { once: true });
    el.src = url;
    if (el.tagName === 'IMG') el.addEventListener('click', () => openLightbox([url], 0));
  }

  function suscribirChat(id) {
    if (canalChat) sb.removeChannel(canalChat);
    canalChat = sb.channel(`wb-chat-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_mensajes', filter: `conversacion_id=eq.${id}` }, ({ eventType, new: m }) => {
        if (!m?.wamid || actual?.id !== id) return;
        const i = mensajes.findIndex(x => x.wamid === m.wamid);
        if (m.eliminado_en) {
          if (i >= 0) { mensajes.splice(i, 1); pintarMensajes(false); }
          return;
        }
        if (i >= 0) {
          const antes = mensajes[i];
          mensajes[i] = { ...antes, ...m };
          // Un cambio de estado (✓✓) solo toca el tick: re-pintar todo cortaría un audio en reproducción.
          if (antes.texto === m.texto && antes.media_path === m.media_path && antes.media_id === m.media_id && antes.transcripcion === m.transcripcion) pintarTick(mensajes[i]);
          else pintarMensajes(false);
          return;
        }
        if (eventType !== 'INSERT') return;
        mensajes = mensajes.filter(x => !(x._tmp && x.texto === m.texto && m.direccion === 'saliente_api'));
        mensajes.push(m);
        pintarMensajes(false);
        if (m.direccion === 'entrante') sb.rpc('wa_marcar_leida', { p_conversacion: id }).then(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_comprobantes', filter: `conversacion_id=eq.${id}` }, ({ new: c }) => {
        if (!c?.wamid || actual?.id !== id) return;
        if (c.estado === 'no_comprobante') comprobantes.delete(c.wamid); else comprobantes.set(c.wamid, c);
        pintarMensajes(false);
      })
      .subscribe();
  }

  async function invocar(body, accion) {
    const { data, error: e } = await sb.functions.invoke(accion ? `whatsapp-enviar?accion=${accion}` : 'whatsapp-enviar', { body });
    if (e) {
      let det = null;
      try { det = await e.context?.json(); } catch {}
      return det || { ok: false, error: e.message };
    }
    return data;
  }
  const mensajeError = r => ERRORES[r?.error] || (r?.detalle ? `WhatsApp: ${r.detalle}` : 'No se pudo enviar');

  async function enviarTexto() {
    const ta = $('wb-texto'), texto = ta.value.trim();
    if (!texto || !actual) return;
    ta.value = ''; autoAlto();
    ta.focus({ preventScroll: true });
    const tmp = { wamid: 'tmp-' + Date.now(), _tmp: true, direccion: 'saliente_api', tipo: 'text', texto, enviado_en: new Date().toISOString(), estado: 'enviando' };
    mensajes.push(tmp); pintarMensajes(true);
    const r = await invocar({ conversacion_id: actual.id, tipo: 'texto', texto });
    const i = mensajes.indexOf(tmp);
    if (r?.ok) { if (i >= 0 && !mensajes.some(x => x.wamid === r.mensaje.wamid)) mensajes[i] = r.mensaje; else if (i >= 0) mensajes.splice(i, 1); }
    else {
      if (i >= 0) mensajes[i] = { ...tmp, estado: 'fallido', error: mensajeError(r) };
      error(mensajeError(r));
      if (r?.error === 'ventana_cerrada') { actual.ultimo_entrante_at = null; pintarCabecera(); pintarCompositor(); }
    }
    pintarMensajes(false);
  }

  async function enviarArchivo(file) {
    if (!file || !actual) return;
    const tipo = /^image\/(jpeg|png)$/.test(file.type) ? 'imagen' : 'documento';
    const fd = new FormData();
    fd.append('conversacion_id', String(actual.id));
    fd.append('tipo', tipo);
    fd.append('archivo', file, file.name);
    const pie = $('wb-texto').value.trim();
    if (pie) { fd.append('texto', pie); $('wb-texto').value = ''; autoAlto(); }
    const tmp = { wamid: 'tmp-' + Date.now(), _tmp: true, direccion: 'saliente_api', tipo: tipo === 'imagen' ? 'image' : 'document', texto: pie || `📎 ${file.name}`, enviado_en: new Date().toISOString(), estado: 'enviando' };
    mensajes.push(tmp); pintarMensajes(true);
    await enviarForm(fd, tmp);
  }
  async function enviarForm(fd, tmp) {
    const r = await invocar(fd);
    const i = mensajes.indexOf(tmp);
    if (r?.ok) { if (i >= 0 && !mensajes.some(x => x.wamid === r.mensaje.wamid)) mensajes[i] = r.mensaje; else if (i >= 0) mensajes.splice(i, 1); }
    else {
      if (i >= 0) mensajes[i] = { ...tmp, estado: 'fallido', error: mensajeError(r) };
      error(mensajeError(r));
      if (r?.error === 'ventana_cerrada') { actual.ultimo_entrante_at = null; pintarCabecera(); pintarCompositor(); }
    }
    pintarMensajes(false);
  }
  async function enviarVoz(file, { voz }) {
    if (!actual) return;
    const fd = new FormData();
    fd.append('conversacion_id', String(actual.id));
    fd.append('tipo', 'audio');
    fd.append('voz', voz ? '1' : '0');
    fd.append('archivo', file, file.name);
    const tmp = { wamid: 'tmp-' + Date.now(), _tmp: true, direccion: 'saliente_api', tipo: 'audio', texto: '🎤 Nota de voz', enviado_en: new Date().toISOString(), estado: 'enviando' };
    mensajes.push(tmp); pintarMensajes(true);
    await enviarForm(fd, tmp);
  }

  // PDF de una cotización a la vista en el chat de su cliente. Se descarta al cambiar de chat, para que no le llegue a otro.
  let cierraPrevia = null;
  function verPdf(file) {
    const u = URL.createObjectURL(file);
    if (!window.open(u, '_blank')) { const a = document.createElement('a'); a.href = u; a.download = file.name; a.click(); }
    setTimeout(() => URL.revokeObjectURL(u), 60_000);
  }
  async function pintarPaginasPdf(file, caja) {
    try {
      const lib = await cargarPdfjs();
      const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const total = Math.min(doc.numPages, 6), ancho = Math.min(caja.clientWidth || 360, 640) * Math.min(devicePixelRatio || 1, 2);
      caja.innerHTML = '';
      for (let n = 1; n <= total && caja.isConnected; n++) {
        const pag = await doc.getPage(n), vp = pag.getViewport({ scale: ancho / pag.getViewport({ scale: 1 }).width });
        const c = document.createElement('canvas');
        c.width = Math.round(vp.width); c.height = Math.round(vp.height); c.setAttribute('aria-label', `Página ${n} de ${doc.numPages}`);
        caja.appendChild(c);
        await pag.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      }
      if (doc.numPages > total && caja.isConnected) caja.insertAdjacentHTML('beforeend', `<p class="wb-pv-nota">Y ${doc.numPages - total} página${doc.numPages - total === 1 ? '' : 's'} más: usa «Ver PDF».</p>`);
      doc.destroy();
    } catch (e) {
      console.warn('vista previa del PDF', e);
      if (caja.isConnected) caja.innerHTML = '<p class="wb-pv-nota">No se pudo mostrar la vista previa. Ábrelo con «Ver PDF» antes de enviarlo.</p>';
    }
  }
  async function pdfEnChat(c, file) {
    await abrir(c);
    if (actual?.id !== c.id) return;
    cierraPrevia?.();
    const titulo = c.nombre || '+' + c.wa_id, p = document.createElement('section');
    p.id = 'wb-pdf-previa'; p.setAttribute('aria-label', `Vista previa del PDF para ${titulo}`);
    p.innerHTML = `<header><i class="fas fa-file-pdf" aria-hidden="true"></i><div><b title="${esc(file.name)}">${esc(file.name)}</b><small>Nada se envía hasta que toques Enviar. El texto de abajo va como pie del PDF.</small></div><button type="button" data-a="x" aria-label="Quitar PDF">×</button></header>
      <div class="wb-pv-pags"><p class="wb-pv-nota">Cargando vista previa…</p></div>
      <footer><button type="button" data-a="ver">Ver PDF</button><button type="button" data-a="enviar" class="wb-pv-enviar"><i class="fas fa-paper-plane" aria-hidden="true"></i> Enviar a ${esc(titulo)}</button></footer>`;
    const cierra = () => { p.remove(); cierraPrevia = null; };
    p.addEventListener('click', e => {
      const a = e.target.closest('button[data-a]')?.dataset.a;
      if (a === 'x') cierra();
      else if (a === 'ver') verPdf(file);
      else if (a === 'enviar') {
        cierra();
        if (ventanaAbierta(actual)) enviarArchivo(file); else error(ERRORES.ventana_cerrada);
      }
    });
    cierraPrevia = cierra;
    $('wb-compose').before(p);
    pintarPaginasPdf(file, p.querySelector('.wb-pv-pags'));
  }

  async function pintarPlantillas() {
    const sel = $('wb-pl-sel'), c = actual, c0 = plantillasPor.get(c.phone_number_id);
    if (c0 && c0.hasta > Date.now()) plantillas = c0.lista;
    else {
      plantillas = null; pintarVariables();
      sel.innerHTML = '<option value="">Cargando plantillas…</option>';
      const r = await invocar({ conversacion_id: c.id }, 'plantillas');
      if (r?.ok) plantillasPor.set(c.phone_number_id, { lista: r.plantillas || [], hasta: Date.now() + 10 * 60_000 });
      if (actual?.id !== c.id) return;
      if (!r?.ok) { sel.innerHTML = `<option value="">${esc(mensajeError(r))}</option>`; return; }
      plantillas = r.plantillas || [];
    }
    sel.innerHTML = plantillas.length
      ? '<option value="">Elegir plantilla…</option>' + plantillas.map((p, i) => `<option value="${i}">${esc(p.nombre)} (${esc(p.idioma)})</option>`).join('')
      : '<option value="">No hay plantillas aprobadas todavía</option>';
    pintarVariables();
  }
  function pintarVariables() {
    const p = plantillas?.[Number($('wb-pl-sel').value)];
    $('wb-pl-cuerpo').textContent = p ? p.cuerpo : '';
    $('wb-pl-vars').innerHTML = p ? Array.from({ length: p.variables }, (_, i) => `<input type="text" data-wb-var="${i}" placeholder="Valor de {{${i + 1}}}" maxlength="200">`).join('') : '';
    $('wb-pl-enviar').disabled = !p;
  }
  async function enviarPlantilla() {
    const p = plantillas?.[Number($('wb-pl-sel').value)];
    if (!p || !actual) return;
    const variables = [...document.querySelectorAll('#wb-pl-vars [data-wb-var]')].map(el => el.value.trim());
    if (variables.some(v => !v)) { error('Completa todas las variables'); return; }
    $('wb-pl-enviar').disabled = true;
    const r = await invocar({ conversacion_id: actual.id, tipo: 'plantilla', plantilla: { nombre: p.nombre, idioma: p.idioma, variables } });
    $('wb-pl-enviar').disabled = false;
    if (!r?.ok) { error(mensajeError(r)); return; }
    ok('Plantilla enviada');
    if (!mensajes.some(x => x.wamid === r.mensaje.wamid)) { mensajes.push(r.mensaje); pintarMensajes(true); }
  }

  function autoAlto() {
    const ta = $('wb-texto');
    const movil = matchMedia('(max-width:760px)').matches;
    ta.style.height = 'auto';
    ta.style.height = (movil ? (ta.value ? Math.min(ta.scrollHeight + 2, 140) : 44) : Math.min(ta.scrollHeight, 140)) + 'px';
  }

  function enlazar() {
    if (!document.getElementById('wb-css')) {
      const st = document.createElement('style'); st.id = 'wb-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    $('wb-buscar').addEventListener('input', pintarLista);
    $('wb-recargar').addEventListener('click', cargarLista);
    if (rol() === 'admin') {
      $('wb-recargar').insertAdjacentHTML('beforebegin', '<button class="chat-tool-btn" id="wb-campanas" type="button" aria-label="Campañas" title="Campañas"><i class="fas fa-bullhorn"></i></button>');
      const campanas = crearCampanasWa({ sb, esc, ok, error });
      $('wb-campanas').addEventListener('click', campanas.abrir);
    }
    $('wb-inbox').addEventListener('click', ev => {
      const row = ev.target.closest('[data-wb]');
      const c = row && convs.find(x => x.id === Number(row.dataset.wb));
      if (c) abrir(c);
    });
    $('wb-back').addEventListener('click', () => cerrar());
    $('wb-log').addEventListener('click', ev => {
      const b = ev.target.closest('[data-wb-comp]');
      if (b) marcarComprobante(Number(b.dataset.wbComp), b.dataset.wbEst);
      const r = ev.target.closest('[data-wb-reserva]');
      if (r) reservaDeComprobante(Number(r.dataset.wbReserva));
    });
    $('wb-ver-lead').addEventListener('click', () => actual?.lead_id && abrirLead(actual.lead_id));
    $('wb-cotizar').addEventListener('click', () => actual?.lead_id && cotizarLead(actual.lead_id));
    $('wb-llamar').addEventListener('click', () => actual?.lead_id && llamarLead(actual));
    enlazarBorrar($('wb-log'), eliminarMensaje);
    $('wb-avatar').addEventListener('click', () => { const f = actual && fotos.get(actual.wa_id); if (f) openLightbox([f], 0); });
    if (matchMedia('(max-width:760px)').matches) $('wb-texto').placeholder = 'Mensaje';
    $('wb-texto').addEventListener('input', autoAlto);
    $('wb-texto').addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey && !matchMedia('(pointer:coarse)').matches) { ev.preventDefault(); enviarTexto(); } });
    $('wb-enviar').addEventListener('mousedown', ev => ev.preventDefault());
    $('wb-enviar').addEventListener('click', enviarTexto);
    $('wb-adjuntar').addEventListener('click', () => $('wb-archivo').click());
    grabador = crearGrabadorVoz({ compose: $('wb-compose'), antesDe: $('wb-enviar'), claseBoton: 'wb-ico', htmlVoz: vozHtml, puede: () => !!actual && !$('wb-compose').hidden, contexto: () => actual?.id, alEnviar: enviarVoz, error });
    $('wb-archivo').addEventListener('change', ev => { const f = ev.target.files?.[0]; ev.target.value = ''; enviarArchivo(f); });
    $('wb-pl-sel').addEventListener('change', pintarVariables);
    $('wb-pl-enviar').addEventListener('click', enviarPlantilla);
    // La ventana de 24 h vence sola: refrescar el reloj cada minuto.
    setInterval(() => { if (actual && !$('wb-head').hidden) { pintarCabecera(); if (!ventanaAbierta(actual) && !$('wb-compose').hidden) pintarCompositor(); } }, 60_000);
  }

  async function abrirSeccion() {
    if (!canalLista) {
      canalLista = sb.channel('wb-lista')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversaciones' }, ({ new: c }) => {
          if (actual && c?.id === actual.id) {
            const antes = actual.ultimo_entrante_at;
            Object.assign(actual, c);
            if (antes !== c.ultimo_entrante_at) { pintarCabecera(); pintarCompositor(); }
          }
          recargarLista();
        })
        .subscribe();
    }
    await cargarLista(true);
  }

  return { enlazar, abrirSeccion, cerrar, contar: cargarLista, marcarComprobante, pdfEnChat };
}
