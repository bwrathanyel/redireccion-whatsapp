import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/+esm';

const SUPABASE_URL = 'https://begbjhrdbsqftbbleecb.supabase.co';
const FOTOS_BASE = SUPABASE_URL + '/storage/v1/object/public/tarifario-fotos/';
// Miniaturas pregeneradas (_d/<ancho>/<ruta_original>.jpg) -- servir el
// original para pintar un thumb de 56px reventó la cuota de egress de Supabase.
// Los 4 tamaños existen siempre, no hace falta fallback.
//
// Se piden a un Worker propio con R2 detrás (CRM/workers/fotos), no a Supabase:
// R2 no cobra egress, así que cada foto sale de Supabase UNA vez y después es
// gratis. Las fotos nuevas se siguen SUBIENDO a Supabase -- el Worker las copia
// sola la primera vez que alguien las mira.
const CDN_FOTOS = 'https://fotos.destinoyeventoslotus360.com/';
const DERIVADOS_ANCHOS = [256, 384, 640, 1280];
const rutaDerivado = (storagePath, ancho) => `_d/${ancho}/${storagePath}.jpg`;
// Las miniaturas se sirven con `max-age=31536000, immutable`, así que cambiar el
// archivo en el origen NO alcanza: el navegador que ya lo tiene no vuelve a
// pedirlo en un año, ni siquiera para revalidar. La única forma de forzar la
// bajada es cambiar la URL.
//
// Subir este número cuando cambie el CONTENIDO de las fotos sin cambiar su
// ruta. v=2: 2026-07-31, se devolvieron 504 fotos a su versión sin el relleno
// espejado (ver workers/fotos). La query no toca la clave de R2 -- el Worker
// solo mira el pathname -- así que no invalida la caché del servidor.
const FOTOS_VERSION = '?v=2';
const fotoMini = (storagePath, ancho) => CDN_FOTOS + rutaDerivado(storagePath, ancho) + FOTOS_VERSION;
// Los consumidores piden el derivado sin fallback, así que una foto sin sus
// miniaturas se ve rota. Se generan acá, en el navegador, al subir una foto
// nueva, porque Canvas decodifica WebP y la librería del backend
// (imagescript) no.
async function generarDerivados(file) {
  const salidas = [];
  let origen;
  try {
    let anchoOriginal, altoOriginal;
    if (typeof createImageBitmap === 'function') {
      origen = await createImageBitmap(file);
      anchoOriginal = origen.width; altoOriginal = origen.height;
    } else {
      const url = URL.createObjectURL(file);
      origen = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      anchoOriginal = origen.naturalWidth; altoOriginal = origen.naturalHeight;
      URL.revokeObjectURL(url);
    }
    for (const ancho of DERIVADOS_ANCHOS) {
      try {
        const anchoFinal = Math.min(ancho, anchoOriginal);
        const altoFinal = Math.round(altoOriginal * (anchoFinal / anchoOriginal));
        const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(anchoFinal, altoFinal) : document.createElement('canvas');
        canvas.width = anchoFinal; canvas.height = altoFinal;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, anchoFinal, altoFinal);
        ctx.drawImage(origen, 0, 0, anchoFinal, altoFinal);
        const blob = canvas.convertToBlob ? await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.78 }) : await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.78));
        if (blob) salidas.push({ ancho, blob });
      } catch (e) { /* un tamaño fallido no debe tumbar los demás */ }
    }
  } catch (e) { /* sin derivados generados, la subida del original sigue igual */ }
  if (origen?.close) origen.close();
  return salidas;
}
// Best-effort a propósito: el original ya subió, y un derivado que falte se
// regenera después con scripts/generar_derivados_fotos.py. Si esto tirara, la
// foto quedaría subida pero sin registrar en la tabla.
async function subirDerivados(storagePath, file) {
  try {
    const derivados = await generarDerivados(file);
    for (const { ancho, blob } of derivados) {
      await sb.storage.from('tarifario-fotos').upload(rutaDerivado(storagePath, ancho), blob, { contentType: 'image/jpeg', upsert: true });
    }
  } catch (e) { console.warn('derivados', e); }
}
const SUPABASE_KEY = 'sb_publishable_M7Ms9DLwpNSCXZNCDhYtbQ_LhMYeLxk';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { params: { eventsPerSecond: 40 } } });

const fmt = n => (n ?? 0).toLocaleString('es-VE');
const tiempoRelativo = iso => {
  if (!iso) return '—';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h}h` : `hace ${Math.round(h / 24)}d`;
};
const tiempoSeguimiento = iso => {
  if (!iso) return 'Sin próximo seguimiento';
  const fecha = new Date(iso).getTime();
  if (Number.isNaN(fecha)) return 'Fecha inválida';
  const minutos = Math.round((fecha - Date.now()) / 60000);
  if (minutos < 0) return `Vencido ${tiempoRelativo(iso)}`;
  if (minutos < 1) return 'Ahora mismo';
  if (minutos < 60) return `En ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `En ${horas}h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? 'Mañana' : `En ${dias} días`;
};
const money = n => '$' + (Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fullMonth = k => { const [y, m] = k.split('-'); return MESL[+m - 1] + ' ' + y; };
const ESTADOS = ['POR ATENDER', 'ATENDIDO', 'CLIENTE CONTACTADO', 'COTIZACION ENVIADA', 'EN ESPERA DE PAGO', 'PAGO REALIZADO', 'PERDIDO', 'NUMERO INVALIDO', 'Sin gestionar'];
const ESTADOS_EDIT = ESTADOS;
const ESTADO_COLORS = { 'POR ATENDER': '#ff9100', 'ATENDIDO': '#4a9eff', 'CLIENTE CONTACTADO': '#4a9eff', 'COTIZACION ENVIADA': '#a06bff', 'EN ESPERA DE PAGO': '#f5b544', 'PAGO REALIZADO': '#10b981', 'PERDIDO': '#ef4444', 'NUMERO INVALIDO': '#94a3b8', 'Sin gestionar': '#5f677f' };
const PRIORIDAD_IA_ICONOS = { alta: '🔥', media: '●', baja: '○' };
// Usa .chip-prioridad + .alta/.media/.baja (index.html:164-168) -- ya
// existían en el CSS pero nadie las consumía, esto rendía un glyph con color
// inline suelto en vez de la píldora.
function badgePrioridadIA(l) {
  if (!l.prioridad_ia || !PRIORIDAD_IA_ICONOS[l.prioridad_ia]) return '';
  return ` <span class="chip-prioridad ${l.prioridad_ia}" title="${esc(l.prioridad_ia_razon || '')}">${PRIORIDAD_IA_ICONOS[l.prioridad_ia]}</span>`;
}
function badgeNombreDudoso(l) {
  if (!l.nombre_dudoso) return '';
  return ` <span style="color:#f59e0b" title="No parece un Nombre propio, cuando tengas su nombre, edítalo">❓</span>`;
}
function badgeLeadRescatado(l) {
  if (!l.es_lead_rescatado) return '';
  return ` <span class="badge-st" style="color:#2dd4bf;background:#0f766e2e" title="Respondió al seguimiento final de la IA y compartió un teléfono válido"><i class="fas fa-life-ring"></i> Rescatado</span>`;
}
// Contacto directo (ver plan "ves-buena-idea-que-misty-wadler"): el lead pidió
// el WhatsApp de su asesor en vez de dar el suyo -- sin teléfono a propósito,
// no por un error. Sin este badge un "—" en la columna Teléfono se ve igual
// que un dato faltante por fallo real.
function badgeContactoDirecto(l) {
  if (!l.contacto_directo_enviado_at) return '';
  return ` <span class="badge-st" style="color:#a78bfa;background:#7c3aed2e" title="Se le entregó el WhatsApp del asesor -- sin teléfono propio hasta que la IA lo consiga"><i class="fas fa-share-square"></i> Contacto directo</span>`;
}
function textoTelefonoLead(l) {
  if (l.telefono) return esc(l.telefono);
  return l.contacto_directo_enviado_at ? 'Contacto directo (sin teléfono)' : 'Sin teléfono';
}
// Ciclo de flechitas prev/next en la ficha del lead -- excluye 'Sin gestionar'
// (fallback legacy, no es un paso real del pipeline al que se quiera navegar).
const ESTADOS_CICLO = ESTADOS.filter(e => e !== 'Sin gestionar');
const SERVICIOS = ['Vuelos', 'Full Day', 'Hospedaje', 'Paquete Todo Incluido', 'Hotel', 'Tour', 'Evento', 'Otro'];
const VENTA = 'PAGO REALIZADO';
const CANAL_CLASS = { 'Instagram': 'ig', 'Facebook': 'fb', 'Ambos': 'am', 'Desconocido': '' };
const ADV_COLORS = ['#ff9100', '#4a9eff', '#10b981', '#a06bff', '#f5b544', '#ff5c8a'];
const CLIENT_ICONS = ['fa-umbrella-beach', 'fa-plane-departure', 'fa-suitcase-rolling', 'fa-compass', 'fa-earth-americas', 'fa-camera-retro', 'fa-map-location-dot', 'fa-sun', 'fa-water', 'fa-mountain-sun', 'fa-passport', 'fa-glasses'];
const CLIENT_COLORS = ['#ff9100', '#4a9eff', '#10b981', '#a06bff', '#f5b544', '#ff5c8a', '#22c1c3', '#7c93ff'];
const seedHash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const clientAvatar = l => { const h = seedHash(l.id ?? l.telefono ?? l.nombre); return { icon: CLIENT_ICONS[h % CLIENT_ICONS.length], color: CLIENT_COLORS[(h >> 3) % CLIENT_COLORS.length] }; };
const TITLES = { hoy: ['Hoy', 'Tu resumen del día'], dashboard: ['Dashboard', 'Resumen general · Destino y Eventos Lotus 360'], leads: ['Leads', 'Base de datos de clientes y prospectos'], 'mis-notas': ['Mis Notas', 'Tu libreta: lo que te cuesta, para repasarlo'], 'clientes-asignados': ['Clientes Asignados', 'Los clientes que te asignaron para atender'], ranking: ['Ranking de asesores', 'Desempeño del equipo comercial'], pipeline: ['Pipeline', 'Ciclo de vida del lead'], postventa: ['Postventa', 'Cobros, reservas, documentos y seguimiento del viaje'], facturacion: ['Facturación', 'Facturas, comisiones y % por asesor'], 'mis-comisiones': ['Mis Comisiones', 'Tus comisiones sobre ventas pagadas'], 'informe-diario': ['Informe Diario', 'Resumen de cierre de jornada de cada asesor'], tarifario: ['Tarifario', 'Destinos, hoteles, paquetes y promociones vigentes'], cotizador: ['Cotizador IA', 'Cotiza con el tarifario vigente como base'], galeria: ['Galería', 'Fotos de promociones, hoteles, paquetes y guías/tours'], redes: ['Redes', 'Métricas de Instagram y análisis con IA'], mensajes: ['Mensajes', 'Chat interno del equipo — individual y grupo Comunidad'], voucher: ['Voucher', 'Generá el voucher de hospedaje en PDF para el cliente'],
  tareas: ['Tareas', 'Tus tareas activas'],
  boleteria: ['Boletería', 'Rutas, aerolíneas, precios y requisitos de vuelo'],
  'gestion-personal': ['Gestión de Personal', 'Equipo, asistencia, freelancers, postulaciones, reasignaciones y métricas -- todo en un solo lugar'],
  'cerebro-ia': ['Cerebro IA', 'Las reglas que la IA obedece al vender -- valen para Instagram, Facebook y la web'],
  'rendimiento-ia': ['Rendimiento IA', 'Ventas, calidad, velocidad y costos de la IA comercial'],
  'ia-atencion': ['Prospectos de IA', 'Posadas y apartamentos que pidieron el asistente desde la página'],
  'consultor-ia': ['Consultor IA', 'Preguntale sobre arquitectura, decisiones y el estado del CRM ahora mismo -- sin gastar Claude Code'],
  'voz-ia': ['Voz IA', 'Probá la voz clonada de la jefa y controlá la muestra de referencia que usa la IA'],
  'web-reasignados': ['Web y Reasignados', 'Los leads que entraron por la página o se reasignaron -- los dos orígenes por los que cobrás comisión'],
  'stop-sales': ['Stop Sales', 'Disponibilidad de hoteles que manda BT Travel -- cargá el PDF y confirmá antes de publicar'],
  manual: ['Manual del CRM', 'Guía completa, por secciones -- cómo usar cada parte del sistema'],
  actualizaciones: ['Actualizaciones', 'Todo lo que se agregó y mejoró en el CRM, con fecha'] };
const initials = s => (s || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
function pintarAvatar(el, url, nombre) {
  if (!el) return;
  if (url) { el.style.backgroundImage = `url('${url}')`; el.textContent = ''; }
  else { el.style.backgroundImage = ''; el.textContent = initials(nombre); }
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Las descripciones/requisitos/precios del tarifario vienen del PDF original
// como un párrafo denso (varias oraciones/datos corridos). Acá NUNCA se
// toca el texto guardado — solo se corta en oraciones (separador real:
// ". "/"; " seguido de mayúscula, así "USD 40.000" o "a.m." no disparan un
// corte falso) para que se lea como líneas cortas en vez de un bloque, y se
// resaltan montos/porcentajes ya presentes en el texto. Cero información
// nueva, cero texto perdido — mismo contenido, mejor separado.
const resaltarNumeros = textoEscapado => textoEscapado.replace(/(?:USD|US\$|EUR|\$)\s?[\d.,]+|\b\d+(?:[.,]\d+)?%/g, m => `<b class="dfv-num">${m}</b>`);
// Abreviaturas comunes en el tarifario que terminan en "." pero NO cierran
// oración (ej. "aprox. 230 USD", "Edo. Miranda") — sin esto el corte por
// oración las trataba como fin de frase real.
const ABREV_RE = /\b(?:aprox|Edo|Sr|Sra|Dr|Dra|Ing|Lic|Av|Cra|etc|núm|art|pág|No|Nro)\.$/i;
function formatearTexto(texto) {
  if (!texto) return '';
  const partes = String(texto).split(/(?<=[.;])\s+(?=[A-ZÁÉÍÓÚÑÜ0-9])/).map(s => s.trim()).filter(Boolean);
  const oraciones = [];
  for (const parte of partes) {
    if (oraciones.length && ABREV_RE.test(oraciones[oraciones.length - 1])) oraciones[oraciones.length - 1] += ' ' + parte;
    else oraciones.push(parte);
  }
  if (oraciones.length <= 1) return `<p>${resaltarNumeros(esc(texto))}</p>`;
  return oraciones.map(o => `<p>${resaltarNumeros(esc(o))}</p>`).join('');
}
const val = id => document.getElementById(id).value;
const niceEstado = v => (v === (v || '').toUpperCase() && (v || '').includes(' ')) ? v.charAt(0) + v.slice(1).toLowerCase() : v;
const sortEntries = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]);

let STATS = {}, page = 1, PER = 25, totalFiltered = 0, genCarga = 0;
let activeMonth = null, activeDestino = null, currentLead = null;
// Conflicto en el lead abierto (falla #4 del plan de rediseño): si otra
// sesión edita el mismo lead mientras alguien lo tiene abierto acá, guardar
// mandaba el formulario entero y "último que guarda gana" sin aviso.
// camposSuciosLead trackea qué inputs tocó el usuario -- esos NO se
// sobreescriben cuando llega un UPDATE ajeno, el resto sí se refresca solo.
let camposSuciosLead = new Set(), conflictoLeadPendiente = false;
const FIELD_IDS_LEAD = ['e-estado', 'e-asesor', 'e-servicio', 'e-monto', 'e-comprado', 'e-nombre', 'e-telefono', 'e-canal', 'e-destino', 'e-personas', 'e-fecha-estimada', 'e-destino-consulta', 'e-monto-completo', 'e-monto-inicial', 'e-restante-pago', 'e-fecha'];
const FIELD_LABELS_LEAD = { 'e-estado': 'Estado', 'e-asesor': 'Asesor asignado', 'e-servicio': 'Servicio de interés', 'e-monto': 'Monto de la venta', 'e-comprado': 'Servicios comprados', 'e-nombre': 'Nombre', 'e-telefono': 'Teléfono', 'e-canal': 'Canal', 'e-destino': 'Destino de interés', 'e-personas': 'Personas', 'e-fecha-estimada': 'Fecha de viaje', 'e-destino-consulta': 'Consulta original', 'e-monto-completo': 'Monto completo', 'e-monto-inicial': 'Monto inicial', 'e-restante-pago': 'Restante de pago', 'e-fecha': 'Fecha de captación' };
let SELECTED_LEADS = new Set(), deleteMode = 'single';
let trendKeys = [], canalKeys = [], destKeys = [], trendMap = {};
let previewSel = null, charts = {};
let ACTIVOS = [];
let leadsView = 'lista', rgView = 'lista';
let INBOX_LEADS = [], INBOX_TEL_LEAD_ID = null;
let POSTVENTA = [], PV_ACTUAL = null, PV_ETAPA = '', PV_SEARCH_TIMER = null;

/* ---------- Periodos ---------- */
function periodo(kind) {
  const now = new Date(); let d = new Date(now);
  if (kind === 'hoy') { d.setHours(0, 0, 0, 0); return [d, addD(d, 1)]; }
  if (kind === 'semana') { const w = new Date(now); const day = (w.getDay() + 6) % 7; w.setDate(w.getDate() - day); w.setHours(0, 0, 0, 0); return [w, addD(w, 7)]; }
  if (kind === 'mes') { const m = new Date(now.getFullYear(), now.getMonth(), 1); return [m, new Date(now.getFullYear(), now.getMonth() + 1, 1)]; }
  if (kind === 'anio') { return [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear() + 1, 0, 1)]; }
  if (kind === '7d') { return [addD(now, -7), addD(now, 1)]; }
  if (kind === '3m') { const t = new Date(now); t.setMonth(t.getMonth() - 3); return [t, addD(now, 1)]; }
  return [addD(now, -30), addD(now, 1)];
}
const addD = (dt, n) => { const x = new Date(dt); x.setDate(x.getDate() + n); return x; };
const iso = dt => dt.toISOString();

/* ---------- Auth ---------- */
const EMAIL_DOMINIO = 'lotus360.local';
const RESET_FN_URL = 'https://begbjhrdbsqftbbleecb.functions.supabase.co/reset-password';
const CLAIM_FN_URL = 'https://begbjhrdbsqftbbleecb.functions.supabase.co/claim-account';
const OVERLAYS = ['login', 'setup', 'forgot', 'marketing-placeholder', 'claim-list', 'claim-form'];
let booted = false, ROL = null, MI_NOMBRE = null, MI_USERNAME = null, MI_USUARIO_ID = null, JORNADA_ACTIVA = false, MI_AVATAR_URL = null, MI_PREFERENCIAS = {}, MI_VE_INFORME_DIARIO = false, MI_ES_FREELANCER = false, MI_BLOQUEADO = false;
// Rol REAL del usuario logueado -- distinto de ROL cuando hay una vista
// previa activa (ver "Vista previa de rol" más abajo). ROL_REAL nunca
// cambia con la vista previa: el switcher lo usa para decidir si mostrarse
// (solo admin), y assert_rol/current_rol() del lado del servidor siguen
// leyendo el rol real de auth -- esto NUNCA toca permisos, solo lo que
// se renderiza en pantalla.
let ROL_REAL = null;
const VISTA_ROL_KEY = 'vista_rol_preview';
const overlay = id => document.getElementById(id);
const showOverlay = id => { OVERLAYS.forEach(o => overlay(o).classList.toggle('show', o === id)); if (id === 'login') cargarUsuariosLogin(); };
// Se recarga cada vez que se muestra el login (no solo una vez al abrir la
// página) para que un usuario recién reclamado en esta misma sesión ya
// aparezca sin necesitar refrescar.
async function cargarUsuariosLogin() {
  const sel = document.getElementById('loginUser');
  const previo = sel.value;
  const { data, error } = await sb.rpc('listar_usuarios_activos');
  if (error || !data) return;
  sel.innerHTML = '<option value="">Selecciona tu usuario</option>' + data.map(u => `<option value="${esc(u.username)}">${esc(u.nombre)}</option>`).join('');
  if (previo && [...sel.options].some(o => o.value === previo)) sel.value = previo;
}

initAuth();
async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) await afterLogin(); else showOverlay('login');
}

async function cargarUsuario() {
  const { data: { user } } = await sb.auth.getUser();
  const { data, error } = await sb.from('usuarios').select('id,username,nombre,rol,debe_cambiar_password,avatar_url,preferencias,ve_informe_diario,es_freelancer,bloqueado').eq('id', user?.id).single();
  if (error || !data) {
    await sb.auth.signOut();
    showOverlay('login');
    document.getElementById('loginErr').textContent = 'Cuenta sin configurar, contacta a un administrador';
    return null;
  }
  return data;
}

const VISTA_ROL_OPCIONES = ['admin', 'asesor', 'marketing', 'boleteria'];
const VISTA_ROL_LABEL = { admin: 'Administrador', asesor: 'Asesor comercial', marketing: 'Marketing', boleteria: 'Boletería' };

/** Activa la vista previa de un rol y recarga -- recargar (en vez de mutar
 *  ROL en caliente) reusa TODO el flujo normal de login (los ~25 puntos del
 *  código que ramifican por ROL, no solo las clases CSS), así la vista
 *  previa queda fiel a lo que ese rol realmente ve, sin duplicar lógica de
 *  arranque a mano. Nunca toca `usuarios.rol` en la base -- assert_rol()
 *  del servidor sigue viendo al admin real, así que las acciones que se
 *  hagan durante la vista previa se ejecutan con permisos de admin de
 *  verdad (el banner lo aclara para no confundir "lo que se ve" con "lo
 *  que se puede hacer"). */
function activarVistaPreviaRol(rolFalso) {
  if (ROL_REAL !== 'admin' || !VISTA_ROL_OPCIONES.includes(rolFalso)) return;
  if (rolFalso === 'admin') sessionStorage.removeItem(VISTA_ROL_KEY);
  else sessionStorage.setItem(VISTA_ROL_KEY, rolFalso);
  location.reload();
}
function salirVistaPreviaRol() {
  sessionStorage.removeItem(VISTA_ROL_KEY);
  location.reload();
}
function pintarBannerVistaPrevia() {
  let banner = document.getElementById('vista-previa-banner');
  if (ROL_REAL !== 'admin' || ROL === ROL_REAL) {
    banner?.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'vista-previa-banner';
    document.body.appendChild(banner);
  }
  banner.innerHTML = `<i class="fas fa-eye"></i> Viendo el CRM como <b>${esc(VISTA_ROL_LABEL[ROL] || ROL)}</b> -- las acciones que hagas se ejecutan igual con tus permisos reales de admin. <button type="button" id="vista-previa-salir">Volver a mi vista</button>`;
  document.getElementById('vista-previa-salir').onclick = salirVistaPreviaRol;
}

async function afterLogin() {
  const u = await cargarUsuario();
  if (!u) return;
  ROL_REAL = u.rol;
  // Vista previa de rol (solo admin, ver openPerfilDrawer): sessionStorage
  // -- no localStorage -- para que nunca sobreviva a cerrar la pestaña ni
  // se filtre a otra sesión/dispositivo. Si el override quedó pegado de
  // una sesión vieja con OTRO usuario real (ej. se deslogueó del admin y
  // entró un asesor en la misma pestaña), se ignora: la vista previa es
  // exclusiva de admin.
  const previa = sessionStorage.getItem(VISTA_ROL_KEY);
  MI_NOMBRE = u.nombre; ROL = (u.rol === 'admin' && VISTA_ROL_OPCIONES.includes(previa)) ? previa : u.rol;
  MI_USERNAME = u.username; MI_USUARIO_ID = u.id;
  MI_AVATAR_URL = u.avatar_url; MI_PREFERENCIAS = u.preferencias || {}; MI_VE_INFORME_DIARIO = !!u.ve_informe_diario;
  MI_ES_FREELANCER = !!u.es_freelancer; MI_BLOQUEADO = !!u.bloqueado;
  if (u.debe_cambiar_password) { showOverlay('setup'); return; }
  await entrarSegunRol();
}

async function entrarSegunRol() {
  document.body.classList.toggle('rol-asesor', ROL === 'asesor');
  document.body.classList.toggle('rol-marketing', ROL === 'marketing');
  document.body.classList.toggle('rol-boleteria', ROL === 'boleteria');
  // Rol boleteria vive siempre en modo Boletería -- se aplica acá, antes de
  // startApp(), para que no haya un parpadeo de colores normales al cargar.
  if (ROL === 'boleteria') { modoBoleteria = true; document.body.classList.add('modo-boleteria'); }
  document.body.classList.toggle('es-freelancer', MI_ES_FREELANCER);
  pintarBannerVistaPrevia();
  overlay('login').classList.remove('show');
  overlay('setup').classList.remove('show');
  const rolLabelUi = ROL === 'admin' ? 'Administrador' : ROL === 'marketing' ? 'Marketing' : ROL === 'boleteria' ? 'Boletería' : 'Asesor comercial';
  document.getElementById('side-un').textContent = MI_NOMBRE;
  document.getElementById('side-ue').textContent = rolLabelUi;
  pintarAvatar(document.getElementById('side-avatar'), MI_AVATAR_URL, MI_NOMBRE);
  document.getElementById('side-un-m').textContent = MI_NOMBRE;
  document.getElementById('side-ue-m').textContent = rolLabelUi;
  pintarAvatar(document.getElementById('side-avatar-m'), MI_AVATAR_URL, MI_NOMBRE);
  document.querySelectorAll('.solo-admin-borrar').forEach(el => el.style.display = ROL === 'admin' ? '' : 'none');
  aplicarPreferencias();
  renderJornadaUI();
  handleCheckIn();
  // La navegación externa solo se procesa cuando ya terminó el arranque que
  // aplica rol, módulos disponibles y sección inicial. Así `?seccion=` no
  // puede adelantar ni anular los permisos del usuario autenticado.
  await startApp();
  if (MI_ES_FREELANCER) {
    setupHeartbeatFreelancer();
    subscribeMiUsuarioLive();
    if (MI_BLOQUEADO) mostrarBloqueoOverlay();
  }
  setupLatidoPresencia();
  renderRecordatoriosUI();
  manejarDeepLinkAsistencia();
  // Antes de manejarDeepLinkSeccion: ese maneja "?ir=leads" con un
  // history.replaceState(null,'',location.pathname) que borra TODA la query
  // string, incluido "&accion=&lead=" -- si corriera primero, los botones
  // nativos de la notificación de lead nunca dispararían nada (accion ya no
  // estaría en la URL para cuando se leyera acá).
  manejarDeepLinkLeadAccion();
  manejarDeepLinkSeccion();
  registrarPushNativo();
  // Primera vez del usuario: se abre solo el menú de capítulos (no un
  // capítulo al azar) -- guardarPreferencia() marca tutorial_visto al
  // cerrarlo, así no vuelve a abrirse solo. marketing queda afuera del
  // auto-open (el pedido original era admin/asesor), pero el ítem de nav
  // sigue disponible para abrirlo a mano.
  if (!MI_PREFERENCIAS.tutorial_visto && (ROL === 'admin' || ROL === 'asesor')) activateSection('manual');
}

/* ---------- Mi Perfil (Bloque 8) — cada asesor edita solo lo propio ---------- */
const AVATAR_LIMITE = 3 * 1024 * 1024, AVATAR_MIME = ['image/png', 'image/jpeg', 'image/webp'];
function openPerfilDrawer() {
  document.getElementById('drawerContent').innerHTML = `
    <div class="dhead"><div class="dava" id="perfil-avatar-preview"></div>
      <div><div class="dn">${esc(MI_NOMBRE)}</div>
      <div class="dm">${VISTA_ROL_LABEL[ROL] || 'Asesor comercial'} · @${esc(MI_USERNAME)}</div></div></div>
    <div class="edit-box" style="margin-top:16px">
      <div class="eb-title"><i class="fas fa-image"></i> Foto de perfil</div>
      <button class="dbtn gh" id="perfil-avatar-btn" type="button"><i class="fas fa-camera"></i> Cambiar foto</button>
      <input type="file" id="perfil-avatar-file" accept="image/png,image/jpeg,image/webp" style="display:none">
    </div>
    <div class="edit-box" style="margin-top:16px">
      <div class="eb-title"><i class="fas fa-sliders"></i> Personalización</div>
      <label class="fl">Tema</label>
      <div class="seg-group" id="perfil-tema" style="margin-bottom:0">
        <button type="button" data-v="dark" class="seg${(MI_PREFERENCIAS.tema || 'dark') === 'dark' ? ' on' : ''}"><i class="fas fa-moon"></i> Oscuro</button>
        <button type="button" data-v="light" class="seg${MI_PREFERENCIAS.tema === 'light' ? ' on' : ''}"><i class="fas fa-sun"></i> Claro</button>
      </div>
      <label class="fl" style="margin-top:12px">Tamaño de letra</label>
      <div class="seg-group" id="perfil-fuente" style="margin-bottom:0">
        <button type="button" data-v="chico" class="seg${MI_PREFERENCIAS.fuente === 'chico' ? ' on' : ''}">Chico</button>
        <button type="button" data-v="normal" class="seg${(MI_PREFERENCIAS.fuente || 'normal') === 'normal' ? ' on' : ''}">Normal</button>
        <button type="button" data-v="grande" class="seg${MI_PREFERENCIAS.fuente === 'grande' ? ' on' : ''}">Grande</button>
      </div>
    </div>
    ${ROL_REAL === 'admin' ? `
    <div class="edit-box" style="margin-top:16px">
      <div class="eb-title"><i class="fas fa-eye"></i> Vista previa de rol</div>
      <div style="font-size:11.5px;color:var(--muted);margin-bottom:8px">Ver el CRM como lo ve otro rol, para revisar y corregir errores. No cambia tus permisos reales -- seguís pudiendo hacer todo como admin mientras la usás.</div>
      <div class="seg-group" id="perfil-vista-rol" style="margin-bottom:0;flex-wrap:wrap">
        ${VISTA_ROL_OPCIONES.map(r => `<button type="button" data-v="${r}" class="seg${ROL === r ? ' on' : ''}">${esc(VISTA_ROL_LABEL[r])}</button>`).join('')}
      </div>
    </div>` : ''}
    ${bnEditorHtml()}
    ${puedeRecibirLeads() || puedeRecibirAsistencia() ? `
    <div class="edit-box" style="margin-top:16px">
      <div class="eb-title"><i class="fas fa-bell"></i> Notificaciones</div>
      ${puedeRecibirLeads() ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:${puedeRecibirAsistencia() ? '12px' : '0'}">
        <span style="font-size:13px">Leads nuevos<small style="display:block;color:var(--muted);margin-top:2px">Cuando te asignan un lead</small></span>
        <button type="button" class="tas-toggle" id="perfil-notif-leads"></button>
      </div>` : ''}
      ${puedeRecibirAsistencia() ? `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <span style="font-size:13px">Recordatorios de asistencia<small style="display:block;color:var(--muted);margin-top:2px">Recordatorio de entrada y salida</small></span>
        <button type="button" class="tas-toggle" id="perfil-notif-asistencia"></button>
      </div>
      ` : ''}
    </div>` : ''}
    <div class="edit-box" id="perfil-instalar-app" style="margin-top:16px;display:none">
      <div class="eb-title"><i class="fas fa-mobile-screen-button"></i> App Lotus 360</div>
      <div id="perfil-instalar-texto" style="font-size:12px;color:var(--muted);line-height:1.45;margin-bottom:10px"></div>
      <button class="dbtn gh" id="perfil-instalar-btn" type="button">Instalar la app</button>
    </div>
    <div style="font-size:11px;color:var(--muted2);margin-top:14px;text-align:center">Solo tú puedes ver y editar tu propio perfil</div>`;
  // Avatar seteado vía DOM (pintarAvatar), no interpolado en el template de
  // innerHTML -- MI_AVATAR_URL termina en un style.backgroundImage por API,
  // no en un string HTML, así que no hay forma de inyectar CSS/HTML por ahí.
  pintarAvatar(document.getElementById('perfil-avatar-preview'), MI_AVATAR_URL, MI_NOMBRE);
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBg').classList.add('open');
  navPush({ type: 'drawer' });
  document.getElementById('perfil-avatar-btn').onclick = () => document.getElementById('perfil-avatar-file').click();
  document.getElementById('perfil-avatar-file').onchange = e => { if (e.target.files[0]) subirAvatar(e.target.files[0]); e.target.value = ''; };
  document.querySelectorAll('#perfil-tema button').forEach(b => b.onclick = () => guardarPreferencia('tema', b.dataset.v, 'perfil-tema'));
  document.querySelectorAll('#perfil-fuente button').forEach(b => b.onclick = () => guardarPreferencia('fuente', b.dataset.v, 'perfil-fuente'));
  document.querySelectorAll('#perfil-vista-rol button').forEach(b => b.onclick = () => activarVistaPreviaRol(b.dataset.v));
  bnEditorWire();
  actualizarTogglesNotif();
  renderInstalacionPwa();
}
function aplicarPreferencias() {
  document.documentElement.dataset.theme = MI_PREFERENCIAS.tema === 'light' ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', MI_PREFERENCIAS.tema === 'light' ? '#f4f5f9' : '#080b16');
  document.body.classList.toggle('fsize-chico', MI_PREFERENCIAS.fuente === 'chico');
  document.body.classList.toggle('fsize-grande', MI_PREFERENCIAS.fuente === 'grande');
  // Cache local para que el script inline en <head> (ver index.html) pueda
  // aplicar tema/tamaño ANTES del primer paint en la próxima carga -- sin
  // esto, un usuario con tema claro ve un flash oscuro en cada refresh
  // mientras se resuelve sesión+perfil por red.
  try { localStorage.setItem('lotus_prefs', JSON.stringify({ tema: MI_PREFERENCIAS.tema, fuente: MI_PREFERENCIAS.fuente })); } catch (_e) { /* localStorage puede fallar en modo privado -- solo se pierde el cache, no rompe nada */ }
}
async function guardarPreferencia(clave, valor, grupoId) {
  const anterior = MI_PREFERENCIAS;
  MI_PREFERENCIAS = { ...MI_PREFERENCIAS, [clave]: valor };
  aplicarPreferencias();
  document.querySelectorAll(`#${grupoId} button`).forEach(b => b.classList.toggle('on', b.dataset.v === valor));
  const { error } = await sb.rpc('actualizar_mi_perfil', { p_preferencias: MI_PREFERENCIAS });
  if (error) {
    // Rollback -- si no se pudo guardar, no dejar la UI mostrando algo
    // que un refresh (que relee de la DB) va a revertir sin avisar.
    MI_PREFERENCIAS = anterior;
    aplicarPreferencias();
    const valorPrevio = anterior[clave] ?? (grupoId === 'perfil-tema' ? 'dark' : 'normal');
    document.querySelectorAll(`#${grupoId} button`).forEach(b => b.classList.toggle('on', b.dataset.v === valorPrevio));
    errToast('No se pudo guardar: ' + error.message);
  }
}
async function actualizarTogglesNotif() {
  [['perfil-notif-leads', 'notificaciones_leads', 'Leads nuevos'], ['perfil-notif-asistencia', 'notificaciones_asistencia', 'Recordatorios']].forEach(([id, clave, nombre]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const activo = MI_PREFERENCIAS[clave] !== false;
    btn.classList.toggle('on', activo);
    btn.onclick = async () => {
      btn.disabled = true;
      const anterior = MI_PREFERENCIAS;
      MI_PREFERENCIAS = { ...MI_PREFERENCIAS, [clave]: !activo };
      const { error } = await sb.rpc('actualizar_mi_perfil', { p_preferencias: MI_PREFERENCIAS });
      if (error) { MI_PREFERENCIAS = anterior; errToast('No se pudo guardar: ' + error.message); }
      else if (!activo && !await activarNotificaciones(nombre)) {
        MI_PREFERENCIAS = anterior;
        await sb.rpc('actualizar_mi_perfil', { p_preferencias: MI_PREFERENCIAS });
      }
      else if (MI_PREFERENCIAS.notificaciones_leads === false && MI_PREFERENCIAS.notificaciones_asistencia === false) await desactivarSuscripcionPush();
      btn.disabled = false;
      actualizarTogglesNotif();
    };
  });
}
async function desactivarSuscripcionPush() {
  // Solo la suscripción web de ESTE navegador -- activarRecordatorios()
  // también es web-only (chequea 'serviceWorker' in navigator), mismo
  // alcance. Filtrar solo por usuario_id borraría la suscripción de
  // OTROS dispositivos del mismo asesor (ej. si tiene el CRM abierto en
  // el teléfono y en la compu), apagándoles los avisos sin que se enteren.
  if (!('serviceWorker' in navigator)) { errToast('Este navegador no soporta notificaciones push'); return; }
  const { data: { user } } = await sb.auth.getUser();
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const { error } = await sb.from('push_subscriptions').delete().eq('usuario_id', user.id).eq('subscription_json->>endpoint', sub.endpoint);
      if (error) { errToast('No se pudo desactivar: ' + error.message); return; }
      await sub.unsubscribe();
    }
  } catch (e) {
    console.error('desactivarSuscripcionPush', e);
    errToast('No se pudieron desactivar las notificaciones');
    return;
  }
  okToast('Notificaciones desactivadas');
  renderRecordatoriosUI();
}
async function subirAvatar(file) {
  if (!AVATAR_MIME.includes(file.type)) { errToast('Formato no válido — solo PNG, JPG o WEBP'); return; }
  if (file.size > AVATAR_LIMITE) { errToast('La imagen pesa más de 3MB'); return; }
  const btn = document.getElementById('perfil-avatar-btn');
  btn.disabled = true; btn.innerHTML = 'Subiendo... <i class="fas fa-spinner fa-spin"></i>';
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '.jpg';
  const path = `${MI_USUARIO_ID}/avatar-${Date.now()}${ext}`;
  const { error: eUpload } = await sb.storage.from('avatares').upload(path, file, { contentType: file.type });
  if (eUpload) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-camera"></i> Cambiar foto'; errToast('No se pudo subir la imagen: ' + eUpload.message); return; }
  const { data: pub } = sb.storage.from('avatares').getPublicUrl(path);
  const nuevaUrl = pub.publicUrl;
  const { error: eRpc } = await sb.rpc('actualizar_mi_perfil', { p_avatar_url: nuevaUrl });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-camera"></i> Cambiar foto';
  if (eRpc) { errToast('No se pudo guardar la foto: ' + eRpc.message); return; }
  const avatarViejo = MI_AVATAR_URL;
  MI_AVATAR_URL = nuevaUrl;
  pintarAvatar(document.getElementById('side-avatar'), MI_AVATAR_URL, MI_NOMBRE);
  pintarAvatar(document.getElementById('side-avatar-m'), MI_AVATAR_URL, MI_NOMBRE);
  pintarAvatar(document.getElementById('perfil-avatar-preview'), MI_AVATAR_URL, MI_NOMBRE);
  okToast('Foto de perfil actualizada');
  // Limpieza del avatar viejo (misma carpeta propia, política avatar_delete_propio).
  if (avatarViejo) {
    const vieja = avatarViejo.split('/avatares/')[1];
    if (vieja) sb.storage.from('avatares').remove([vieja]);
  }
}

/* ---------- Freelancer: heartbeat de ACTIVIDAD ----------
   Solo lo manda un freelancer, y solo ante un gesto real (mouse, teclado,
   toque). De acá sale el bloqueo a los 15 minutos y la medición de trabajo
   real vs inactivo -- por eso NO puede dispararse con un temporizador: si lo
   hiciera, nadie se bloquearía nunca y la regla quedaría muerta en silencio.
   Para saber quién está presente existe el latido aparte de más abajo. */
let ultimoHeartbeat = 0;
function setupHeartbeatFreelancer() {
  const enviar = () => {
    if (!MI_ES_FREELANCER || !JORNADA_ACTIVA || MI_BLOQUEADO) return;
    const ahora = Date.now();
    if (ahora - ultimoHeartbeat < 20000) return;
    ultimoHeartbeat = ahora;
    sb.rpc('registrar_actividad'); // fire-and-forget, no bloquea la UI
  };
  ['mousemove', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, enviar, { passive: true }));
}
/* ---------- Latido de PRESENCIA (todo el equipo) ----------
   Cada minuto mientras la pestaña esté visible y haya jornada abierta. Alimenta
   "Conectados ahora" en Gestión de Personal. Es una señal distinta de la
   actividad del freelancer a propósito: acá alguien leyendo una ficha sin mover
   el mouse SÍ está presente. */
function setupLatidoPresencia() {
  const enviar = () => {
    if (document.hidden) return;
    // No se chequea JORNADA_ACTIVA acá: handleCheckIn() todavía puede estar en
    // vuelo cuando esto arranca, y el primer latido se perdería. El criterio de
    // "conectado" exige jornada abierta del lado de la base
    // (personal_resumen), así que marcar presencia sin jornada no cuenta a
    // nadie de más.
    Promise.resolve(sb.rpc('registrar_presencia')).catch(() => {});
  };
  enviar();
  setInterval(enviar, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) enviar(); });
}

function subscribeMiUsuarioLive() {
  sb.channel('mi-usuario-live')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'usuarios', filter: `id=eq.${MI_USUARIO_ID}` }, payload => {
      MI_BLOQUEADO = !!payload.new.bloqueado;
      MI_BLOQUEADO ? mostrarBloqueoOverlay() : ocultarBloqueoOverlay();
    })
    .subscribe();
}
function mostrarBloqueoOverlay() {
  document.getElementById('bloqueo-overlay')?.classList.add('show');
}
function ocultarBloqueoOverlay() {
  document.getElementById('bloqueo-overlay')?.classList.remove('show');
}

/* ---------- Tareas (freelancer) ----------
   Tablero de 3 columnas sobre listar_mis_tareas() -- filosofía del spec:
   un clic para avanzar, reportar problema siempre visible y nunca genera
   strike, mismo dato que ve el admin sobre uno (transparencia). */
let TAREAS_CACHE = [], REPORTE_TASK_ID = null;
function tiempoRelativoTarea(iso) {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const horas = abs / 3600000;
  let texto;
  if (horas < 1) texto = Math.round(abs / 60000) + ' min';
  else if (horas < 24) texto = Math.round(horas) + 'h';
  else texto = Math.round(horas / 24) + 'd';
  return diffMs < 0 ? `vencida hace ${texto}` : `vence en ${texto}`;
}
async function loadTareas() {
  const { data, error } = await sb.rpc('listar_mis_tareas');
  if (error) { errToast('No se pudieron cargar tus tareas'); return; }
  TAREAS_CACHE = data || [];
  renderTareas();
}
function renderTareas() {
  const hoy = new Date().toISOString().slice(0, 10);
  const urgente = [], proximas = [], esperando = [];
  TAREAS_CACHE.forEach(t => {
    if (['bloqueada', 'en_revision'].includes(t.estado)) { esperando.push(t); return; }
    const venceHoy = t.vence_at && t.vence_at.slice(0, 10) === hoy;
    if (venceHoy || t.prioridad === 'urgente' || t.prioridad === 'alta') urgente.push(t); else proximas.push(t);
  });
  const orden = (a, b) => (a.vence_at || '9999') < (b.vence_at || '9999') ? -1 : 1;
  document.getElementById('tareas-col-urgente').innerHTML = tarjetasHtml(urgente.sort(orden));
  document.getElementById('tareas-col-proximas').innerHTML = tarjetasHtml(proximas.sort(orden));
  document.getElementById('tareas-col-esperando').innerHTML = tarjetasHtml(esperando.sort(orden));

  const completadasSemana = TAREAS_CACHE.filter(t => t.estado === 'completada').length;
  const aTiempo = TAREAS_CACHE.filter(t => t.estado === 'completada' && (!t.vence_at || new Date(t.completada_at) <= new Date(t.vence_at))).length;
  // Sin `go`: el tablero de tareas son 3 columnas fijas (urgente/próximas/
  // esperando) y ninguna de estas cifras se corresponde con una de ellas.
  pintarKPIs('tareas-resumen', [
    { t: 'Completadas', v: fmt(completadasSemana), i: 'fa-check', c: 'var(--green)' },
    { t: 'A tiempo', v: fmt(aTiempo), i: 'fa-clock', c: 'var(--accent)' },
    { t: 'En curso', v: fmt(TAREAS_CACHE.filter(t => t.estado === 'en_proceso').length), i: 'fa-spinner', c: 'var(--blue)' },
    { t: 'Reportes abiertos', v: fmt(TAREAS_CACHE.filter(t => t.reporte_abierto).length), i: 'fa-flag', c: '#ef4444' },
  ]);
}
function tarjetasHtml(filas) {
  if (!filas.length) return '<div class="tareas-empty">Nada por acá</div>';
  return filas.map(t => {
    const venc = tiempoRelativoTarea(t.vence_at);
    const vencida = venc && venc.startsWith('vencida');
    const vaDirectoACompletada = t.auto_cierre && !t.requiere_evidencia;
    const btnPrimario = t.estado === 'pendiente'
      ? `<button class="btn-sm" onclick="cambiarEstadoTareaUI(${t.id},'en_proceso')">Empezar</button>`
      : t.estado === 'en_proceso'
      ? `<button class="btn-sm" onclick="cambiarEstadoTareaUI(${t.id},'${vaDirectoACompletada ? 'completada' : 'en_revision'}')">${vaDirectoACompletada ? 'Marcar completada' : 'Mandar a revisión'}</button>`
      : t.estado === 'bloqueada'
      ? `<button class="btn-sm" onclick="cambiarEstadoTareaUI(${t.id},'en_proceso')">Retomar</button>`
      : '';
    return `<div class="tarea-card" data-id="${t.id}">
      <div class="tc-top"><span class="tc-titulo">${esc(t.titulo)}</span><span class="chip-prioridad ${esc(t.prioridad)}">${esc(t.prioridad)}</span></div>
      ${t.descripcion ? `<div class="muted" style="font-size:12px;margin-bottom:8px">${esc(t.descripcion)}</div>` : ''}
      ${venc ? `<div class="tc-venc ${vencida ? 'vencida' : ''}">${esc(venc)}</div>` : ''}
      ${t.reporte_abierto ? '<div class="tc-venc" style="color:#ef4444"><i class="fas fa-flag"></i> Reporte esperando respuesta</div>' : ''}
      <div class="tc-actions">
        ${btnPrimario}
        ${!['completada', 'cerrada', 'cancelada'].includes(t.estado) ? `<button class="btn-sm" onclick="abrirReportarProblemaUI(${t.id})">Reportar problema</button>` : ''}
      </div>
    </div>`;
  }).join('');
}
window.cambiarEstadoTareaUI = async (taskId, nuevoEstado) => {
  const { data, error } = await sb.rpc('cambiar_estado_tarea', { p_task_id: taskId, p_nuevo_estado: nuevoEstado });
  if (error || !data?.ok) { errToast('No se pudo actualizar: ' + (error?.message || data?.error || '')); return; }
  okToast('Actualizado');
  loadTareas();
};
window.abrirReportarProblemaUI = (taskId) => {
  REPORTE_TASK_ID = taskId;
  document.getElementById('reporte-motivo').value = 'bloqueado_por_terceros';
  document.getElementById('reporte-descripcion').value = '';
  document.getElementById('reporte-error').textContent = '';
  openSheet('reporte-sheet');
};
function setupTareas() {
  document.getElementById('reporte-cancelar')?.addEventListener('click', () => closeSheet('reporte-sheet'));
  document.getElementById('reporte-confirmar')?.addEventListener('click', async () => {
    const motivo = val('reporte-motivo'), descripcion = val('reporte-descripcion');
    const btn = document.getElementById('reporte-confirmar');
    btn.disabled = true; const previo = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    const { data, error } = await sb.rpc('reportar_problema_tarea', { p_task_id: REPORTE_TASK_ID, p_motivo: motivo, p_descripcion: descripcion || null });
    btn.disabled = false; btn.innerHTML = previo;
    if (error || !data?.ok) { document.getElementById('reporte-error').textContent = 'No se pudo enviar: ' + (error?.message || data?.error || ''); return; }
    closeSheet('reporte-sheet');
    okToast('Reporte enviado');
    loadTareas();
  });
}

/* ---------- Freelancers (admin) ----------
   Pestaña "Equipo" (jornadas/strikes/leads, listar_freelancers) + pestaña
   "Tareas" (tablero admin sobre listar_tareas_admin, cola de reportes
   abiertos). Ver spec sección 8 -- frecuencia de reportes se muestra como
   señal de diagnóstico, nunca como demérito. */
let FRL_CACHE = [], FRL_TAREAS_CACHE = [], frlTab = 'equipo';
function setupFreelancers() {
  document.querySelectorAll('#frl-tabs .seg').forEach(btn => btn.addEventListener('click', () => {
    frlTab = btn.dataset.frlTab;
    document.querySelectorAll('#frl-tabs .seg').forEach(b => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.frl-tab-panel').forEach(p => p.style.display = p.dataset.frlPanel === frlTab ? '' : 'none');
    if (frlTab === 'tareas') loadTareasAdmin();
  }));
  document.getElementById('frl-tareas-freelancer')?.addEventListener('change', renderTareasAdminTabla);
  document.getElementById('frl-tareas-estado')?.addEventListener('change', renderTareasAdminTabla);
  document.getElementById('nt-cancelar')?.addEventListener('click', () => closeSheet('nueva-tarea-sheet'));
  document.getElementById('nt-confirmar')?.addEventListener('click', confirmarNuevaTarea);
  document.getElementById('frl-personal-dias')?.addEventListener('change', () => loadPersonalTiempo(true));
  document.getElementById('frl-personal-nuevo')?.addEventListener('click', () => abrirAltaPersona(true));
}
// La pestaña Freelancers usa las mismas tarjetas que Personal, filtradas a
// es_freelancer. FRL_CACHE se sigue cargando porque los selectores de Tareas
// ("asignar a...") lo necesitan.
async function loadFreelancers() {
  loadPersonalTiempo(true);
  const { data, error } = await sb.rpc('listar_freelancers');
  if (error) return;
  FRL_CACHE = data || [];
  const sel = document.getElementById('frl-tareas-freelancer');
  if (sel) sel.innerHTML = '<option value="">Todos los freelancers</option>' + FRL_CACHE.map(f => `<option value="${f.id}">${esc(f.nombre)}</option>`).join('');
  const selNt = document.getElementById('nt-freelancer');
  if (selNt) selNt.innerHTML = FRL_CACHE.map(f => `<option value="${f.id}">${esc(f.nombre)}</option>`).join('');
}
window.desbloquearFreelancerUI = async (usuarioId) => {
  const { data, error } = await sb.rpc('desbloquear_freelancer', { p_usuario_id: usuarioId });
  if (error || !data?.ok) { errToast('No se pudo desbloquear: ' + (error?.message || data?.error || '')); return; }
  okToast('Freelancer desbloqueado');
  loadPersonalTiempo(personalSoloFreelancers);
};
window.abrirDetalleFreelancerUI = async (usuarioId) => {
  const f = FRL_CACHE.find(x => x.id === usuarioId);
  document.getElementById('drawerContent').innerHTML = `
    <div class="dhead"><div><div class="dn">${esc(f?.nombre || '')}</div><div class="dm">Historial de jornadas y strikes</div></div></div>
    <div class="edit-box" style="margin-top:16px">
      <div class="eb-title"><i class="fas fa-clock"></i> Jornadas</div>
      <div id="frl-detalle-jornadas"><i class="fas fa-spinner fa-spin"></i></div>
    </div>
    <div class="edit-box" style="margin-top:16px">
      <div class="eb-title"><i class="fas fa-triangle-exclamation"></i> Strikes</div>
      <div id="frl-detalle-strikes"><i class="fas fa-spinner fa-spin"></i></div>
    </div>`;
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBg').classList.add('open');
  navPush({ type: 'drawer' });

  const [{ data: sesiones }, { data: strikes }] = await Promise.all([
    sb.from('agent_sessions').select('hora_entrada,hora_salida,estado_actual').eq('asesor_id', usuarioId).order('hora_entrada', { ascending: false }).limit(20),
    sb.from('freelancer_strikes').select('creado_en,motivo,desbloqueado_en').eq('usuario_id', usuarioId).order('creado_en', { ascending: false }).limit(20),
  ]);
  document.getElementById('frl-detalle-jornadas').innerHTML = (sesiones || []).map(s => `
    <div class="strike-row"><span>${esc(fmtFechaHoraCaracas(s.hora_entrada))}</span><span class="muted">${s.hora_salida ? esc(fmtFechaHoraCaracas(s.hora_salida)) : 'En curso'}</span></div>
  `).join('') || '<div class="muted" style="font-size:12px">Sin jornadas registradas</div>';
  document.getElementById('frl-detalle-strikes').innerHTML = (strikes || []).map(s => `
    <div class="strike-row"><span>${esc(fmtFechaHoraCaracas(s.creado_en))}</span><span class="muted">${s.desbloqueado_en ? 'Desbloqueado' : 'Sigue bloqueado'}</span></div>
  `).join('') || '<div class="muted" style="font-size:12px">Sin strikes -- ningún bloqueo por inactividad hasta ahora</div>';
};
async function loadTareasAdmin() {
  const { data, error } = await sb.rpc('listar_tareas_admin', {
    p_asesor_id: val('frl-tareas-freelancer') || null,
    p_estado: val('frl-tareas-estado') || null,
  });
  if (error) { errToast('No se pudieron cargar las tareas'); return; }
  FRL_TAREAS_CACHE = data || [];
  renderTareasAdminTabla();
  document.getElementById('frl-reportes-abiertos').innerHTML = FRL_TAREAS_CACHE.filter(t => t.reporte_abierto).map(t => `
    <div class="strike-row"><span>${esc(t.asesor_nombre)} · ${esc(t.titulo)}</span><span class="chip-prioridad ${esc(t.prioridad)}">${esc(t.prioridad)}</span></div>
  `).join('') || '<div class="muted" style="font-size:12px">Sin reportes abiertos</div>';
}
function renderTareasAdminTabla() {
  const asesorSel = val('frl-tareas-freelancer'), estadoSel = val('frl-tareas-estado');
  const filas = FRL_TAREAS_CACHE.filter(t =>
    (!asesorSel || String(t.asesor_id) === asesorSel) && (!estadoSel || t.estado === estadoSel));
  document.getElementById('frl-tareas-tbody').innerHTML = filas.map(t => `
    <tr>
      <td class="td-name">${esc(t.asesor_nombre)}</td>
      <td data-label="Tarea">${esc(t.titulo)}${t.reporte_abierto ? ' <i class="fas fa-flag" style="color:#ef4444" title="Reporte abierto"></i>' : ''}</td>
      <td data-label="Prioridad"><span class="chip-prioridad ${esc(t.prioridad)}">${esc(t.prioridad)}</span></td>
      <td data-label="Estado"><span class="chip">${esc(t.estado)}</span></td>
      <td data-label="Vence" class="muted">${t.vence_at ? esc(fmtFechaHoraCaracas(t.vence_at)) : '—'}</td>
      <td class="td-acciones">${t.estado === 'en_revision' ? `<button class="btn-sm" onclick="aprobarTareaUI(${t.id})">Aprobar</button>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="6">Sin tareas</td></tr>';
}
window.aprobarTareaUI = async (taskId) => {
  const { data, error } = await sb.rpc('cambiar_estado_tarea', { p_task_id: taskId, p_nuevo_estado: 'completada' });
  if (error || !data?.ok) { errToast('No se pudo aprobar: ' + (error?.message || data?.error || '')); return; }
  okToast('Tarea aprobada');
  loadTareasAdmin();
};
window.abrirNuevaTareaUI = () => {
  document.getElementById('nt-titulo').value = '';
  document.getElementById('nt-descripcion').value = '';
  document.getElementById('nt-prioridad').value = 'media';
  document.getElementById('nt-vence').value = '';
  document.getElementById('nt-requiere-evidencia').checked = false;
  document.getElementById('nt-error').textContent = '';
  openSheet('nueva-tarea-sheet');
};
async function confirmarNuevaTarea() {
  const err = document.getElementById('nt-error');
  const titulo = val('nt-titulo');
  if (!titulo || !titulo.trim()) { err.textContent = 'El título es obligatorio.'; return; }
  const asesorId = val('nt-freelancer');
  if (!asesorId) { err.textContent = 'Elegí un freelancer.'; return; }
  const venceInput = val('nt-vence');
  const btn = document.getElementById('nt-confirmar');
  btn.disabled = true; const previo = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';
  const { data, error } = await sb.rpc('crear_tarea', {
    p_asesor_id: asesorId, p_titulo: titulo.trim(), p_descripcion: val('nt-descripcion') || null,
    p_prioridad: val('nt-prioridad'), p_vence_at: venceInput ? new Date(venceInput).toISOString() : null,
    p_requiere_evidencia: document.getElementById('nt-requiere-evidencia').checked,
  });
  btn.disabled = false; btn.innerHTML = previo;
  if (error || !data?.ok) { err.textContent = 'No se pudo crear: ' + (error?.message || data?.error || ''); return; }
  closeSheet('nueva-tarea-sheet');
  okToast('Tarea creada');
  loadTareasAdmin();
}

/* ---------- Control de asistencia (agent_sessions) ---------- */
// agent_check_in/agent_check_out son RPC security definer: el check-in
// cierra cualquier sesión "activo" vieja del mismo asesor antes de abrir una
// nueva, así un refresh de página o un cierre de pestaña sin logout nunca
// deja 2 sesiones activas ni una activa huérfana para siempre.
async function handleCheckIn() {
  if (ROL !== 'admin' && ROL !== 'asesor') return;
  const { error } = await sb.rpc('agent_check_in');
  if (error) { console.error('check-in', error); return; }
  JORNADA_ACTIVA = true;
  renderJornadaUI();
}
// Finalizar jornada exige resumen (Bloque 14): el click en "Finalizar" solo
// abre el sheet, sin tocar el backend todavía -- agent_check_out(p_resumen)
// cierra la sesión y guarda el informe en un único viaje transaccional, así
// que si se cancela el sheet la jornada sigue activa (nunca queda cerrada
// sin informe).
const JORNADA_CAMPOS = ['jornada-como-me-fue', 'jornada-que-aprendi', 'jornada-que-se-complico', 'jornada-bloqueos'];
function abrirResumenJornada() {
  if (ROL !== 'admin' && ROL !== 'asesor') return;
  JORNADA_CAMPOS.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('jornada-resumen-ok').disabled = true;
  openSheet('jornada-resumen-sheet');
}
// Solo las dos primeras respuestas habilitan el cierre; las otras dos son opcionales.
function validarResumenJornada() {
  const ok = ['jornada-como-me-fue', 'jornada-que-aprendi']
    .every(id => (document.getElementById(id)?.value || '').trim().length > 0);
  document.getElementById('jornada-resumen-ok').disabled = !ok;
}
JORNADA_CAMPOS.forEach(id => document.getElementById(id)?.addEventListener('input', validarResumenJornada));
document.getElementById('jornada-resumen-cancelar')?.addEventListener('click', (e) => {
  if (e.currentTarget.disabled) return; // envío en curso -- no se puede cancelar a mitad de camino
  closeSheet('jornada-resumen-sheet');
});
document.getElementById('jornada-resumen-ok')?.addEventListener('click', async () => {
  const btn = document.getElementById('jornada-resumen-ok');
  const cancelarBtn = document.getElementById('jornada-resumen-cancelar');
  const comoMeFue = document.getElementById('jornada-como-me-fue').value.trim();
  const queAprendi = document.getElementById('jornada-que-aprendi').value.trim();
  if (!comoMeFue || !queAprendi) return;
  btn.disabled = true; cancelarBtn.disabled = true; btn.innerHTML = 'Enviando... <i class="fas fa-spinner fa-spin"></i>';
  const { error } = await sb.rpc('agent_check_out', {
    p_como_me_fue: comoMeFue,
    p_que_aprendi: queAprendi,
    p_que_se_complico: document.getElementById('jornada-que-se-complico').value.trim() || null,
    p_bloqueos: document.getElementById('jornada-bloqueos').value.trim() || null
  });
  btn.innerHTML = '<i class="fas fa-check"></i> Finalizar jornada';
  cancelarBtn.disabled = false;
  if (error) { btn.disabled = false; errToast('No se pudo cerrar la jornada: ' + error.message); return; }
  JORNADA_ACTIVA = false;
  renderJornadaUI();
  closeSheet('jornada-resumen-sheet');
  if (document.getElementById('jornada-guardar-nota')?.checked) {
    const { error: eNota } = await sb.rpc('guardar_nota', {
      p_id: null,
      p_titulo: 'Aprendido el ' + new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'long' }),
      p_cuerpo: queAprendi, p_etiquetas: ['aprendizajes'], p_me_cuesta: true
    });
    if (!eNota) okToast('Guardado también en Mis Notas'); else errToast('La jornada se cerró, pero la nota no se pudo guardar.');
  }
  okToast('Jornada finalizada — informe enviado');
});
window.toggleJornada = async () => { JORNADA_ACTIVA ? abrirResumenJornada() : await handleCheckIn(); };
function renderJornadaUI() {
  ['-d', '-m'].forEach(sfx => {
    const dot = document.getElementById('jornada-dot' + sfx), text = document.getElementById('jornada-text' + sfx), btn = document.getElementById('jornada-btn' + sfx);
    if (!dot) return;
    dot.classList.toggle('on', JORNADA_ACTIVA);
    text.textContent = JORNADA_ACTIVA ? 'Jornada activa' : 'Jornada inactiva';
    btn.textContent = JORNADA_ACTIVA ? 'Finalizar' : 'Comenzar';
    btn.classList.toggle('on', JORNADA_ACTIVA);
  });
}

/* ---------- Notificaciones de asistencia (Web Push + FCM nativo) ---------- */
const VAPID_PUBLIC_KEY = 'BA80pP1UGb4OaMkTh3dfioglbWmYs4lbSf2jmUUDM1LKwz3INE7U8Ia7R7qP6oLZnXRr8zfVqVzrzaQ60XjR8WQ';
const GERENCIA_USERNAMES = ['luisrueda', 'andric'];
// Ambar Arévalo queda excluida del flujo de recordatorios/strikes (ver
// USERNAME_EXCLUIDOS en la Edge Function asistencia-recordatorio) — no tiene
// sentido ofrecerle un botón que nunca le va a disparar nada.
const ASISTENCIA_USERNAMES_EXCLUIDOS = ['ambar'];

// Leads y asistencia comparten una suscripción push, pero no la preferencia:
// una persona puede recibir leads aunque no participe del control de asistencia.
function puedeRecibirLeads() {
  return ROL === 'asesor' || ROL === 'admin';
}
function puedeRecibirAsistencia() {
  return (ROL === 'asesor' && !ASISTENCIA_USERNAMES_EXCLUIDOS.includes(MI_USERNAME)) || (ROL === 'admin' && GERENCIA_USERNAMES.includes(MI_USERNAME));
}
let instalacionPwaPendiente = null;
const pwaInstalada = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
function setupInstalacionPwa() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalacionPwaPendiente = e; renderInstalacionPwa(); });
  window.addEventListener('appinstalled', () => { instalacionPwaPendiente = null; renderInstalacionPwa(); okToast('App instalada'); });
}
function renderInstalacionPwa() {
  const box = document.getElementById('perfil-instalar-app'), texto = document.getElementById('perfil-instalar-texto'), btn = document.getElementById('perfil-instalar-btn');
  if (!box || !texto || !btn) return;
  if (pwaInstalada()) { box.style.display = 'none'; return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!instalacionPwaPendiente && !ios) { box.style.display = 'none'; return; }
  box.style.display = '';
  texto.textContent = ios ? 'En Safari: Compartir → Añadir a pantalla de inicio.' : 'Instalala para recibir notificaciones con la identidad de Lotus 360.';
  btn.style.display = ios ? 'none' : '';
  btn.onclick = async () => {
    if (!instalacionPwaPendiente) return;
    instalacionPwaPendiente.prompt();
    await instalacionPwaPendiente.userChoice;
    instalacionPwaPendiente = null;
    renderInstalacionPwa();
  };
}
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
async function activarNotificaciones(nombre) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { errToast('Este navegador no soporta notificaciones push'); return false; }
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') { errToast('Permiso de notificaciones denegado'); return false; }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from('push_subscriptions').insert({ usuario_id: user.id, platform: 'web', subscription_json: sub.toJSON() });
    if (error && error.code !== '23505') { errToast('No se pudo activar: ' + error.message); return false; }
    okToast(`${nombre} activados`);
  } catch (e) {
    console.error('activarNotificaciones', e);
    errToast(`No se pudieron activar ${nombre.toLowerCase()}`); return false;
  }
  renderRecordatoriosUI();
  return true;
}
window.activarRecordatorios = async () => {
  if (MI_PREFERENCIAS.notificaciones_asistencia === false) {
    const anterior = MI_PREFERENCIAS;
    MI_PREFERENCIAS = { ...MI_PREFERENCIAS, notificaciones_asistencia: true };
    const { error } = await sb.rpc('actualizar_mi_perfil', { p_preferencias: MI_PREFERENCIAS });
    if (error) { MI_PREFERENCIAS = anterior; errToast('No se pudo guardar: ' + error.message); return false; }
  }
  return activarNotificaciones('Recordatorios');
};
window.ocultarRecordatoriosBanner = () => {
  sessionStorage.setItem('recordatorios_banner_oculto', '1');
  renderRecordatoriosUI();
};
async function renderRecordatoriosUI() {
  if (!puedeRecibirAsistencia() || MI_PREFERENCIAS.notificaciones_asistencia === false) return;
  const { data, error } = await sb.rpc('mi_asistencia_hoy');
  if (error) return;
  const mostrar = data && !data.tiene_recordatorios && !sessionStorage.getItem('recordatorios_banner_oculto');
  const texto = ROL === 'admin' ? 'Activá los avisos de asistencia del equipo' : 'Activá los recordatorios de asistencia';
  ['-d', '-m'].forEach(sfx => {
    const el = document.getElementById('recordatorios-banner' + sfx);
    if (!el) return;
    el.style.display = mostrar ? 'flex' : 'none';
    const span = el.querySelector('span');
    if (span) span.textContent = texto;
  });
}

// Deep-link desde el click de una notificación (?accion=marcar-asistencia):
// en mobile el widget de Jornada vive dentro de la hoja "Más", así que hay
// que abrirla; en desktop ya está siempre visible en el sidebar, solo se
// resalta con un pulso breve.
function manejarDeepLinkAsistencia() {
  const params = new URLSearchParams(location.search);
  if (params.get('accion') !== 'marcar-asistencia') return;
  history.replaceState(null, '', location.pathname);
  if (window.matchMedia('(max-width:760px)').matches) {
    openSheet('more-sheet');
  } else {
    const w = document.getElementById('jornada-widget-d');
    if (w) { w.classList.add('jornada-pulse'); setTimeout(() => w.classList.remove('jornada-pulse'), 2400); }
  }
}

// Puente de navegación para la beta. La lista es cerrada y no incluye
// Proyecto Constructor: pertenece a plataforma-crm y jamás se comparte desde
// Lotus. `ir` se conserva por compatibilidad con los shortcuts ya instalados.
const IR_SECCIONES = [
  'hoy', 'dashboard', 'leads', 'clientes-asignados', 'mis-notas', 'pipeline', 'postventa',
  'web-reasignados', 'cotizador', 'tarifario', 'galeria', 'stop-sales',
  'facturacion', 'voucher', 'mis-comisiones', 'ranking', 'boleteria',
  'mensajes', 'tareas', 'gestion-personal', 'informe-diario', 'cerebro-ia',
  'rendimiento-ia', 'ia-atencion', 'consultor-ia', 'voz-ia', 'redes',
  'manual', 'actualizaciones'
];
function seccionInicialPermitida() {
  if (ROL === 'marketing') return 'tarifario';
  if (ROL === 'boleteria') return 'boleteria';
  return ROL === 'asesor' ? 'leads' : 'dashboard';
}
function usuarioPuedeAbrirSeccion(sec) {
  if (sec === 'hoy') return true;
  const item = document.querySelector(`#sidebar-nav > .nav-item[data-sec="${sec}"]`);
  return !!item && getComputedStyle(item).display !== 'none';
}
function manejarDeepLinkSeccion() {
  const params = new URLSearchParams(location.search);
  const seccion = params.get('seccion') || params.get('ir');
  if (!seccion) return;
  const destino = IR_SECCIONES.includes(seccion) && usuarioPuedeAbrirSeccion(seccion)
    ? seccion
    : seccionInicialPermitida();
  params.delete('seccion');
  params.delete('ir');
  const queryRestante = params.toString();
  history.replaceState(null, '', location.pathname + (queryRestante ? `?${queryRestante}` : ''));
  activateSection(destino);
}

// Deep-link desde los botones de acción de la notificación push de "lead
// nuevo" (?accion=atender|no_puedo&lead=<id>) -- el service worker no puede
// llamar a Supabase autenticado por su cuenta (no tiene la sesión de la
// página), así que abre la app con esto y la página ya logueada ejecuta la
// MISMA acción que los botones del inbox (reuso total, ver sw.js).
async function manejarDeepLinkLeadAccion() {
  const params = new URLSearchParams(location.search);
  const accion = params.get('accion'), leadId = Number(params.get('lead'));
  if (!['atender', 'no_puedo'].includes(accion) || !Number.isFinite(leadId)) return;
  history.replaceState(null, '', location.pathname);
  if (ROL !== 'asesor') return;
  const { data: l, error } = await sb.from('leads').select('*').eq('id', leadId).single();
  if (error || !l) { errToast('No se pudo cargar ese lead'); return; }
  if (accion === 'atender') await atenderInboxLead(l); else await noPuedoInboxLead(l);
}

// Android nativo (Capacitor): sin import, el plugin se consume vía el
// puente global window.Capacitor -- el proyecto no usa bundler, el paquete
// npm @capacitor/push-notifications solo hace falta instalado para que
// `cap sync` copie el módulo nativo al proyecto Gradle.
//
// En una instalación nueva sin sesión guardada, este boot corre ANTES del
// login -- el listener 'registration' de más abajo pide el usuario logueado
// y si todavía no hay ninguno, descarta el token sin guardarlo. registrarPushNativo()
// se llama de nuevo desde entrarSegunRol() (ya con sesión resuelta) para
// forzar un segundo evento 'registration' que esta vez sí encuentra usuario.
function registrarPushNativo() {
  const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;
  if (!window.Capacitor?.isNativePlatform?.() || !PushNotifications) return;
  PushNotifications.register();
}
(function initPushNativo() {
  const cap = window.Capacitor;
  const PushNotifications = cap?.Plugins?.PushNotifications;
  if (!cap?.isNativePlatform?.() || !PushNotifications) return;
  PushNotifications.requestPermissions().then(r => { if (r.receive === 'granted') PushNotifications.register(); });
  PushNotifications.addListener('registration', async (token) => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { error } = await sb.from('push_subscriptions').insert({ usuario_id: user.id, platform: 'fcm', fcm_token: token.value });
    if (error && error.code !== '23505') console.error('fcm insert', error);
  });
  PushNotifications.addListener('registrationError', (err) => console.error('FCM registration error', err));
  PushNotifications.addListener('pushNotificationActionPerformed', (n) => {
    location.href = n.notification?.data?.url || 'index.html?accion=marcar-asistencia';
  });
})();

/* ---------- Sección Asistencia (admin) ---------- */
const hoyCaracas = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
// timestamptz (con offset) -> hora local Caracas. Reusado por Asistencia e Informe Diario.
const fmtHoraCaracas = iso => iso ? new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—';
// timestamptz -> "dd/mm hh:mm" en hora de Caracas. Bug real (2026-07-21): varias
// tarjetas mostraban el timestamp crudo (`iso.slice(0,16).replace('T',' ')`), que es
// UTC sin convertir -- un lead creado a las 10am Venezuela se veía como "14:00"
// (offset de 4h, UTC-4). Reusar SIEMPRE esta función en vez de recortar el string.
const fmtFechaHoraCaracas = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  const fecha = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit' }).format(d);
  const hora = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' }).format(d);
  return `${fecha} ${hora}`;
};
// `date` de Postgres (ej. "2026-07-11", SIN hora/offset) -- a propósito no pasa por
// Date()/timeZone: un date puro interpretado como hora local del navegador puede
// correrse un día en timezones lejanos a Caracas (ej. UTC+9 lo lee como el día
// anterior al reformatearlo). Se formatea directo de los componentes del string.
const fmtFechaSolo = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
/* ---------- Gestión de Personal (admin) -- junta Personal/Asistencia/Asesores/
   Freelancers/Postulaciones en una sola sección con pestañas, pedido del dueño
   (2026-07-26), más Reasignaciones y Métricas (2026-07-27). Cada pestaña sigue
   usando su loader original sin tocar su lógica -- esto solo cambia cómo se
   navega hacia ellas. Ojo: el setup de Reasignaciones y Métricas (view switcher,
   date pickers, listeners de periodo) sigue corriendo en startApp; acá solo
   cambió dónde vive su DOM. */
let gpTab = 'personal';
function setupGestionPersonal() {
  document.querySelectorAll('#gp-tabs .seg').forEach(btn => btn.addEventListener('click', () => {
    if (gpTab === 'asesores' && btn.dataset.gpTab !== 'asesores' && (repartoDirty.domestico || repartoDirty.internacional) && !confirm('Hay cambios sin guardar en el reparto. ¿Salir de todas formas?')) return;
    gpTab = btn.dataset.gpTab;
    document.querySelectorAll('#gp-tabs .seg').forEach(b => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.gp-tab-panel').forEach(p => p.style.display = p.dataset.gpPanel === gpTab ? '' : 'none');
    cargarTabGestionPersonal(gpTab);
  }));
  document.getElementById('gp-personal-dias')?.addEventListener('change', () => loadPersonalTiempo(false));
  document.getElementById('gp-personal-nuevo')?.addEventListener('click', () => abrirAltaPersona(false));
  setupKPIsPersonal();
  setupAsesoresPrueba();
  setupReparto();
}
function cargarTabGestionPersonal(tab) {
  if (tab === 'personal') { loadPersonalTiempo(false); loadAsistenciaExtras(); }
  else if (tab === 'asesores') loadAsesoresPeriodo();
  else if (tab === 'prueba') loadAsesoresPruebaTab();
  else if (tab === 'freelancers') loadFreelancers();
  else if (tab === 'postulaciones') loadPostulaciones();
  else if (tab === 'reasignaciones') loadReasignaciones();
  else if (tab === 'metricas') loadMetricas();
}

/* ---------- Asesores de prueba (A4 + B1 + B2) ---------- */
let AP_CANDIDATOS_SEL = null;
// Grupo de etiquetas seleccionables. Un solo helper para los cuatro grupos del
// panel (asesor, estados, destino, plazo): `multi` decide si conviven varias
// marcadas o si marcar una desmarca al resto.
function renderChipGroup(contenedorId, opciones, { multi = true, seleccion = [], onChange } = {}) {
  const cont = document.getElementById(contenedorId);
  if (!cont) return;
  cont.innerHTML = opciones.map(o => {
    const marcado = seleccion.includes(o.valor);
    return `<button type="button" class="ap-chip${marcado ? ' on' : ''}" data-valor="${esc(o.valor)}" aria-pressed="${marcado}" title="${esc(o.titulo || o.etiqueta)}">${esc(o.etiqueta)}</button>`;
  }).join('');
  cont.querySelectorAll('.ap-chip').forEach(btn => btn.addEventListener('click', e => {
    e.preventDefault();
    if (multi) btn.classList.toggle('on');
    else { cont.querySelectorAll('.ap-chip').forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }); btn.classList.add('on'); }
    btn.setAttribute('aria-pressed', btn.classList.contains('on'));
    onChange?.(chipGroupValores(contenedorId));
  }));
}
function chipGroupValores(contenedorId) {
  return [...(document.getElementById(contenedorId)?.querySelectorAll('.ap-chip.on') || [])].map(b => b.dataset.valor);
}
function apFiltros() {
  const antiguedadRaw = document.getElementById('ap-antiguedad').value;
  const desdeRaw = document.getElementById('ap-desde').value;
  const hastaRaw = document.getElementById('ap-hasta').value;
  return {
    p_antiguedad_dias: antiguedadRaw ? parseInt(antiguedadRaw, 10) : null,
    p_estados: chipGroupValores('ap-estados-chips'),
    p_fecha_desde: desdeRaw ? new Date(desdeRaw + 'T00:00:00').toISOString() : null,
    p_fecha_hasta: hastaRaw ? new Date(hastaRaw + 'T00:00:00').toISOString() : null,
    p_destinos: chipGroupValores('ap-destinos-chips')
  };
}
// El plazo se elige como etiqueta y se traduce a fecha recien al asignar.
// "Sin limite" manda vence_at null, que el RPC ahora acepta a proposito.
const AP_SLA_OPCIONES = [
  { valor: '24h', etiqueta: 'Atender en 24 h', horas: 24 },
  { valor: '48h', etiqueta: 'Atender en 48 h', horas: 48 },
  { valor: '72h', etiqueta: 'Atender en 72 h', horas: 72 },
  { valor: 'sin_limite', etiqueta: 'Sin límite', horas: null }
];
function apVenceAt() {
  const sel = chipGroupValores('ap-sla-chips')[0];
  if (!sel) return undefined; // nada elegido todavía
  const horas = AP_SLA_OPCIONES.find(o => o.valor === sel)?.horas ?? null;
  return horas ? new Date(Date.now() + horas * 3600 * 1000).toISOString() : null;
}
function apInvalidar() {
  document.getElementById('ap-asignar').disabled = true;
  document.getElementById('ap-conteo').textContent = '';
  document.getElementById('ap-preview-wrap').innerHTML = '';
  AP_CANDIDATOS_SEL = null;
}
function setupAsesoresPrueba() {
  renderChipGroup('ap-estados-chips', ESTADOS_EDIT.map(e => ({ valor: e, etiqueta: niceEstado(e) })),
    { seleccion: [...ESTADOS_EDIT], onChange: apInvalidar });
  renderChipGroup('ap-sla-chips', AP_SLA_OPCIONES.map(o => ({ valor: o.valor, etiqueta: o.etiqueta })),
    { multi: false, seleccion: ['48h'] });
  document.getElementById('ap-contar')?.addEventListener('click', contarLotePrueba);
  document.getElementById('ap-preview-btn')?.addEventListener('click', previewLotePrueba);
  document.getElementById('ap-asignar')?.addEventListener('click', asignarLotePrueba);
  ['ap-antiguedad', 'ap-desde', 'ap-hasta', 'ap-cantidad'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', apInvalidar);
  });
  document.querySelectorAll('[data-chips-todos],[data-chips-ninguno]').forEach(b => b.addEventListener('click', e => {
    e.preventDefault();
    const id = b.dataset.chipsTodos || b.dataset.chipsNinguno;
    const encender = !!b.dataset.chipsTodos;
    document.getElementById(id)?.querySelectorAll('.ap-chip').forEach(chip => {
      chip.classList.toggle('on', encender);
      chip.setAttribute('aria-pressed', encender);
    });
    apInvalidar();
  }));
}
async function cargarDestinosLotePrueba() {
  const { data, error } = await sb.rpc('top_destinos_periodo', {});
  if (error) return;
  renderChipGroup('ap-destinos-chips', Object.keys(data || {}).sort().map(d => ({ valor: d, etiqueta: d })),
    { onChange: apInvalidar });
}
let asesorPruebaSeleccionado = null;
async function loadAsesoresPruebaTab() {
  const container = document.getElementById('ap-usuario-chips');
  if (container) {
    const asesores = personalCache.filter(u => u.rol === 'asesor');
    if (asesores.length) {
      renderChipGroup('ap-usuario-chips',
        asesores.map(u => ({ valor: String(u.usuario_id), etiqueta: `${u.nombre} (@${u.username || ''})` })),
        { multi: false, onChange: vals => { asesorPruebaSeleccionado = vals[0] || null; apInvalidar(); } });
      asesorPruebaSeleccionado = null;
    } else {
      container.innerHTML = '<span style="color:var(--muted);font-size:12px">No hay asesores comerciales dados de alta</span>';
      asesorPruebaSeleccionado = null;
    }
  }
  await cargarDestinosLotePrueba();
  await cargarProgresoLotesPrueba();
}
async function contarLotePrueba() {
  const err = document.getElementById('ap-err'); err.textContent = '';
  if (!asesorPruebaSeleccionado) { err.textContent = 'Elegí un asesor.'; return; }
  const f = apFiltros();
  if (!f.p_estados.length) { err.textContent = 'Elegí al menos un estado.'; return; }
  const { data, error } = await sb.rpc('contar_lote_prueba', { p_usuario_id: asesorPruebaSeleccionado, ...f, p_estados: f.p_estados, p_destinos: f.p_destinos.length ? f.p_destinos : null });
  if (error || !data?.ok) { err.textContent = error?.message || 'No se pudo contar.'; return; }
  document.getElementById('ap-conteo').textContent = `${data.cantidad} lead(s) matchean el filtro.`;
  document.getElementById('ap-asignar').disabled = data.cantidad < 1;
}
async function previewLotePrueba() {
  const err = document.getElementById('ap-err'); err.textContent = '';
  const f = apFiltros();
  if (!f.p_estados.length) { err.textContent = 'Elegí al menos un estado.'; return; }
  const { data, error } = await sb.rpc('listar_candidatos_lote_prueba', { ...f, p_destinos: f.p_destinos.length ? f.p_destinos : null });
  const wrap = document.getElementById('ap-preview-wrap');
  if (error) { err.textContent = error.message || 'No se pudo listar.'; return; }
  const leads = data || [];
  if (!leads.length) { wrap.innerHTML = '<div class="pc-vacio">Ningún lead matchea el filtro.</div>'; document.getElementById('ap-asignar').disabled = true; return; }
  wrap.innerHTML = `<div style="max-height:320px;overflow:auto;margin-top:10px"><table>
    <thead><tr><th></th><th>Nombre</th><th>Destino</th><th>Estado</th><th>Fecha</th></tr></thead>
    <tbody>${leads.map(l => `<tr>
      <td><input type="checkbox" data-ap-lead="${l.id}" checked></td>
      <td>${esc(l.nombre || '')}</td><td>${esc(l.destino || '')}</td><td>${esc(l.estado || '')}</td>
      <td>${esc((l.fecha_creacion || '').slice(0, 10))}</td>
    </tr>`).join('')}</tbody></table></div>`;
  AP_CANDIDATOS_SEL = leads.map(l => l.id);
  document.getElementById('ap-conteo').textContent = `${leads.length} lead(s) en la lista (destildá los que no querés incluir).`;
  document.getElementById('ap-asignar').disabled = false;
}
async function asignarLotePrueba() {
  const err = document.getElementById('ap-err'); err.textContent = '';
  if (!asesorPruebaSeleccionado) { err.textContent = 'Elegí un asesor.'; return; }
  const venceAt = apVenceAt();
  if (venceAt === undefined) { err.textContent = 'Elegí el plazo para contactarlos.'; return; }
  const f = apFiltros();
  const cantidad = parseInt(document.getElementById('ap-cantidad').value, 10);
  if (isNaN(cantidad) || cantidad < 1) { err.textContent = 'Elegí una cantidad válida (mínimo 1).'; return; }
  if (!(await confirmarSheet({ titulo: '¿Asignar este lote?', detalle: `${cantidad} lead(s) pasan a ser del asesor elegido, con tarea de contacto por cada uno.`, textoOk: 'Asignar' }))) return;
  const btn = document.getElementById('ap-asignar'); btn.disabled = true;
  const body = { p_usuario_id: asesorPruebaSeleccionado, p_cantidad: cantidad, ...f, p_destinos: f.p_destinos.length ? f.p_destinos : null, p_vence_at: venceAt };
  const { data, error } = await sb.rpc('asignar_lote_prueba', body);
  if (error || !data?.ok) { err.textContent = error?.message || data?.error || 'No se pudo asignar.'; btn.disabled = false; return; }
  okToast(`Lote asignado: ${data.cantidad} lead(s)`);
  apInvalidar();
  await cargarProgresoLotesPrueba();
}
async function cargarProgresoLotesPrueba() {
  const wrap = document.getElementById('ap-progreso-wrap');
  const { data, error } = await sb.rpc('resumen_lotes_prueba');
  if (error || !wrap) return;
  if (!data?.length) { wrap.innerHTML = '<div class="pc-vacio">Todavía no hay asesores con lotes asignados.</div>'; return; }
  wrap.innerHTML = data.map(r => `
    <div class="card" style="margin-top:12px">
      <div class="dhead"><div><div class="dn">${esc(r.nombre)}</div><div class="dm">@${esc(r.username || '')}</div></div></div>
      <div class="pc-cifras" style="margin-top:10px">
        <div class="pc-cifra"><span class="pc-cifra-v">${r.total}</span><span class="pc-cifra-t">Total</span></div>
        <div class="pc-cifra"><span class="pc-cifra-v">${r.contactados}</span><span class="pc-cifra-t">Contactados</span></div>
        <div class="pc-cifra"><span class="pc-cifra-v">${r.pendientes}</span><span class="pc-cifra-t">Pendientes</span></div>
        <div class="pc-cifra"><span class="pc-cifra-v">${r.vencidos}</span><span class="pc-cifra-t">Vencidos</span></div>
      </div>
      ${r.ultimas_notas?.length ? '<div style="margin-top:10px;font-size:12px;color:var(--muted2)">' + r.ultimas_notas.map(n => `Lead #${n.lead_id}: ${esc(n.nota)}`).join('<br>') + '</div>' : ''}
    </div>`).join('');
}
async function loadGestionPersonal() {
  cargarResumenPersonalKPIs();
  cargarTabGestionPersonal(gpTab);
}
async function cargarResumenPersonalKPIs() {
  const { count: postSinRevisar } = await sb.from('postulaciones_empleo')
    .select('id', { count: 'exact', head: true }).eq('revisado', false);
  document.getElementById('gp-kpi-postulaciones').textContent = postSinRevisar ?? 0;
  const badge = document.getElementById('gp-postulaciones-count');
  if (badge) { badge.textContent = postSinRevisar ?? 0; badge.style.display = postSinRevisar ? '' : 'none'; }
  pintarKPIsPersonal();
}

// Los dos primeros KPIs salen de personalCache, la MISMA fuente que las
// tarjetas: si contaran aparte, el número de arriba y lo que se ve abajo
// podrían no coincidir (que es justo lo que pasaba antes).
function pintarKPIsPersonal() {
  const conectados = personalCache.filter(u => u.conectado_ahora).length;
  const kc = document.getElementById('gp-kpi-conectados');
  const ke = document.getElementById('gp-kpi-equipo');
  if (kc) kc.textContent = personalCache.length ? conectados : '—';
  if (ke) ke.textContent = personalCache.length || '—';
}

/* ---------- Filtro por KPI ----------
   Tocar una tarjeta de arriba filtra la lista de abajo, en vez de ser un
   número decorativo. "Miembros de equipo" limpia el filtro. */
let personalFiltro = null;   // null = todos | 'conectados'
function setupKPIsPersonal() {
  document.getElementById('gp-kpi-card-conectados')?.addEventListener('click', () => {
    aplicarFiltroPersonal(personalFiltro === 'conectados' ? null : 'conectados');
  });
  document.getElementById('gp-kpi-card-equipo')?.addEventListener('click', () => aplicarFiltroPersonal(null));
  document.getElementById('gp-kpi-card-postulaciones')?.addEventListener('click', () => {
    document.querySelector('#gp-tabs .seg[data-gp-tab="postulaciones"]')?.click();
  });
}
function aplicarFiltroPersonal(filtro) {
  personalFiltro = filtro;
  // Si estabas en otra pestaña, el filtro no se ve: hay que llevarte a Personal.
  if (gpTab !== 'personal') document.querySelector('#gp-tabs .seg[data-gp-tab="personal"]')?.click();
  document.getElementById('gp-kpi-card-conectados')?.classList.toggle('kpi-on', filtro === 'conectados');
  document.getElementById('gp-kpi-card-equipo')?.classList.toggle('kpi-on', !filtro);
  renderPersonalCards();
}
const ROL_LABEL_GP = { admin: 'Administrador', asesor: 'Asesor', marketing: 'Marketing', boleteria: 'Boletería' };
function formatDuracionLarga(ms) {
  if (!ms) return 'Sin registro';
  const horasTotales = Math.floor(ms / 3600000);
  const dias = Math.floor(horasTotales / 24);
  const horas = horasTotales % 24;
  const minutos = Math.floor((ms % 3600000) / 60000);
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horasTotales > 0) return `${horasTotales}h ${minutos}min`;
  return `${minutos}min`;
}
// Un icono y un color por ROL -- a diferencia de clientAvatar (que es
// aleatorio por hash del nombre), acá el icono significa algo: el mismo rol se
// ve igual siempre.
const ROL_ICONO = {
  admin:     { i: 'fa-crown',    c: '#f59e0b' },
  asesor:    { i: 'fa-headset',  c: '#3b82f6' },
  marketing: { i: 'fa-bullhorn', c: '#a855f7' },
  boleteria: { i: 'fa-ticket',   c: '#22c55e' },
};
const ROL_ICONO_FREELANCE = { i: 'fa-user-clock', c: '#14b8a6' };
// El cargo manda sobre el rol cuando dice algo más específico: Sistemas y
// Editor de Redes son admins en la base pero no hacen trabajo de jefe.
const CARGO_ICONO = [
  [/sistema|dev|técnic/i,            { i: 'fa-code',            c: '#38bdf8' }],
  [/editor|redes|social|contenido/i, { i: 'fa-photo-film',      c: '#ec4899' }],
  [/jefe|due[nñ]/i,                  { i: 'fa-crown',           c: '#f59e0b' }],
  [/gerente|administrativ/i,         { i: 'fa-briefcase',       c: '#f97316' }],
  [/boleter/i,                       { i: 'fa-plane-departure', c: '#22c55e' }],
  [/contab|finanz|factur/i,          { i: 'fa-calculator',      c: '#84cc16' }],
];
function iconoDePersona(u) {
  if (u.cargo) { for (const [re, ico] of CARGO_ICONO) if (re.test(u.cargo)) return ico; }
  if (u.es_freelancer) return ROL_ICONO_FREELANCE;
  return ROL_ICONO[u.rol] || { i: 'fa-user', c: '#94a3b8' };
}

const fmtDiaCorto = dia => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(dia + 'T12:00:00Z'));
function fmtMinutos(min) {
  if (!min) return '0min';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? h + 'h ' + m + 'min' : h + 'h') : m + 'min';
}
const fmtFechaLarga = iso => {
  const p = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'long' }).formatToParts(new Date(iso));
  const dia = p.find(x => x.type === 'day')?.value, mes = p.find(x => x.type === 'month')?.value;
  return `${dia} de ${mes}`;
};

let personalCache = [], personalMeta = null, personalBaja = [];
// La pestaña Freelancers reusa exactamente esta misma vista, filtrada: son la
// misma entidad (una fila de usuarios), lo único que cambia es qué se resalta.
let personalSoloFreelancers = false;

async function loadPersonalTiempo(soloFreelancers) {
  personalSoloFreelancers = !!soloFreelancers;
  const pre = personalSoloFreelancers ? 'frl' : 'gp';
  const grid = document.getElementById(pre + '-personal-grid');
  const load = document.getElementById(pre + '-personal-loading');
  const dias = Number(document.getElementById(pre + '-personal-dias')?.value) || 7;
  if (!grid) return;
  if (load) load.style.display = '';
  grid.innerHTML = '';
  const { data, error } = await sb.rpc('personal_resumen', { p_dias: dias });
  if (load) load.style.display = 'none';
  if (error) { console.error('personal_resumen:', error); grid.innerHTML = '<div class="pc-vacio">No se pudo cargar el equipo.</div>'; return; }
  personalMeta = data || null;
  personalCache = (data?.personas || []);
  personalBaja = data?.de_baja || [];
  pintarKPIsPersonal();
  renderPersonalCards();
}

function personalVisibles() {
  let out = personalSoloFreelancers ? personalCache.filter(u => u.es_freelancer) : personalCache;
  if (!personalSoloFreelancers && personalFiltro === 'conectados') out = out.filter(u => u.conectado_ahora);
  return out;
}

function renderPersonalCards() {
  const pre = personalSoloFreelancers ? 'frl' : 'gp';
  const grid = document.getElementById(pre + '-personal-grid');
  if (!grid) return;
  const visibles = personalVisibles();
  const cont = document.getElementById(pre + '-personal-count');
  if (cont) {
    cont.innerHTML = visibles.length + (visibles.length === 1 ? ' persona' : ' personas')
      + (personalFiltro === 'conectados' && !personalSoloFreelancers
        ? ' <button class="btn-sm" id="gp-quitar-filtro" type="button">Ver todos</button>' : '');
    document.getElementById('gp-quitar-filtro')?.addEventListener('click', () => aplicarFiltroPersonal(null));
  }
  // El contador arranca en la fecha de corte (app_config.horas_crm_desde): hasta
  // el 26/07/2026 el CRM abría una sesión nueva en cada recarga y esos totales
  // no significan nada. Se dice de dónde arranca en vez de mostrar un número
  // que nadie puede interpretar.
  const aviso = document.getElementById(pre + '-personal-aviso');
  if (aviso) {
    aviso.innerHTML = 'El contador arranca el <b>' + (personalMeta?.desde ? fmtFechaLarga(personalMeta.desde) : 'inicio')
      + '</b>. Mide <b>tiempo con el CRM abierto</b>, no horas trabajadas. Los días con ⚠ tienen sesiones que nadie cerró: ese total es aproximado.';
  }
  if (!visibles.length) {
    grid.innerHTML = '<div class="pc-vacio">' + (personalSoloFreelancers ? 'No hay freelancers cargados.' : 'Sin datos del equipo todavía.') + '</div>';
  } else {
    grid.innerHTML = visibles.map(cardPersonaHtml).join('');
  }
  const bajaBox = document.getElementById(pre + '-personal-baja');
  if (bajaBox) {
    bajaBox.innerHTML = personalBaja.length
      ? '<details class="pc-dias"><summary><i class="fas fa-user-slash"></i> Dados de baja (' + personalBaja.length + ')</summary>'
        + personalBaja.map(u => '<div class="pc-dia"><div class="pc-dia-h"><span class="pc-dia-f">' + esc(u.nombre || '')
          + '</span><button class="btn-sm" data-reactivar="' + u.usuario_id + '">Reactivar</button></div>'
          + '<div class="pc-dia-s">' + (ROL_LABEL_GP[u.rol] || esc(u.rol || '')) + (u.cargo ? ' · ' + esc(u.cargo) : '') + '</div></div>').join('')
        + '</details>'
      : '';
    bajaBox.querySelectorAll('[data-reactivar]').forEach(b => {
      b.onclick = () => bajaPersonal(b.dataset.reactivar, true);
    });
  }
  grid.querySelectorAll('[data-editar]').forEach(b => { b.onclick = () => abrirEditorPersona(b.dataset.editar); });
  grid.querySelectorAll('[data-desbloquear]').forEach(b => { b.onclick = () => desbloquearFreelancerUI(b.dataset.desbloquear); });
  grid.querySelectorAll('[data-exentar]').forEach(b => { b.onclick = () => exceptuarHoy(b.dataset.exentar); });
  grid.querySelectorAll('[data-timeline]').forEach(b => { b.onclick = () => abrirTimelineAsesor(b.dataset.timeline, b.dataset.timelineNombre); });
}

/* ---------- Timeline del día por asesor (admin, Gestión de Personal) ---------- */
const TIMELINE_ICONOS = { jornada: 'fa-right-to-bracket', lead: 'fa-arrow-right-arrow-left', tarea: 'fa-list-check', informe: 'fa-file-lines' };
let timelineAsesorId = null;
function abrirTimelineAsesor(usuarioId, nombre) {
  timelineAsesorId = usuarioId;
  document.getElementById('timeline-titulo').textContent = nombre || 'Timeline';
  document.getElementById('timeline-fecha').value = hoyCaracas();
  openSheet('timeline-asesor-sheet');
  cargarTimelineAsesor();
}
async function cargarTimelineAsesor() {
  const wrap = document.getElementById('timeline-list');
  if (!wrap || !timelineAsesorId) return;
  wrap.innerHTML = '<div class="es-s">Cargando…</div>';
  const fecha = document.getElementById('timeline-fecha').value || hoyCaracas();
  const { data, error } = await sb.rpc('timeline_asesor', { p_asesor_id: timelineAsesorId, p_dia: fecha });
  if (error || !data?.ok) { wrap.innerHTML = '<div class="es-s">No se pudo cargar el timeline.</div>'; return; }
  document.getElementById('timeline-resumen').innerHTML =
    '<span class="chip">' + fmtMinutos(data.minutos_presencia) + ' de presencia</span>'
    + (data.tiene_informe ? '<span class="chip ok">Dejó su informe</span>' : '<span class="chip am">Sin informe ese día</span>');
  const eventos = data.eventos || [];
  wrap.innerHTML = eventos.length
    ? eventos.map(e => '<div class="tl-ev"><div class="tl-ev-hora">' + fmtHoraCaracas(e.en) + '</div>'
        + '<div class="tl-ev-ico"><i class="fas ' + (e.icono || TIMELINE_ICONOS[e.tipo] || 'fa-circle-dot') + '"></i></div>'
        + '<div class="tl-ev-txt">' + esc(e.texto) + '</div></div>').join('')
    : '<div class="es-s">Sin actividad registrada ese día.</div>';
}
document.getElementById('timeline-fecha')?.addEventListener('change', cargarTimelineAsesor);
document.getElementById('timeline-cerrar')?.addEventListener('click', () => closeSheet('timeline-asesor-sheet'));

function cardPersonaHtml(u) {
  const ico = iconoDePersona(u);
  const chips = (u.es_freelancer ? '<span class="pc-chip">Freelance</span>' : '')
    + (u.bloqueado ? '<span class="pc-chip pc-chip-rojo">Bloqueado</span>' : '');
  const cargo = u.cargo ? esc(u.cargo) : '<span class="pc-cargo-vacio">Sin cargo asignado</span>';
  const dias = (u.dias || []).map(diaPersonaHtml).join('');
  const detalle = dias
    ? '<details class="pc-dias"><summary><i class="fas fa-calendar-days"></i> Ver día por día (' + (u.dias || []).length + ')</summary>' + dias + '</details>'
    : '<div class="pc-vacio">Todavía no se conectó desde que arrancó el contador.</div>';

  // Asistencia de hoy: antes era una pestaña aparte. Acá vive donde importa,
  // en la tarjeta de la persona.
  const asist = u.exento_hoy
    ? '<span class="pc-asist exento">Exento hoy</span>'
    : u.marco_hoy
      ? '<span class="pc-asist ok">Marcó hoy</span>'
      : '<span class="pc-asist no">No marcó hoy</span>';
  const strikes = u.strikes_mes ? '<span class="pc-asist strike">' + u.strikes_mes + ' strike' + (u.strikes_mes === 1 ? '' : 's') + ' este mes</span>' : '';
  const exentarBtn = (!u.exento_hoy && !u.marco_hoy)
    ? '<button class="btn-sm" data-exentar="' + u.usuario_id + '">Exceptuar hoy</button>' : '';

  // Bloque freelance: activo vs idle. Solo tiene sentido para freelancers --
  // son los únicos con latido de actividad y con bloqueo a los 15 min.
  const a = u.actividad || {};
  const frlBloque = u.es_freelancer
    ? '<div class="pc-frl">'
      + '<div class="pc-frl-r"><span>Trabajo real hoy</span><b>' + fmtMinutos(a.activo_hoy || 0) + '</b></div>'
      + '<div class="pc-frl-r"><span>Inactivo hoy</span><b class="pc-idle">' + fmtMinutos(a.idle_hoy || 0) + '</b></div>'
      + '<div class="pc-frl-r"><span>Semana (real / inactivo)</span><b>' + fmtMinutos(a.activo_semana || 0) + ' / ' + fmtMinutos(a.idle_semana || 0) + '</b></div>'
      + (u.strikes_freelancer ? '<div class="pc-frl-r"><span>Bloqueos por inactividad</span><b>' + u.strikes_freelancer + '</b></div>' : '')
      + '</div>'
    : '';
  const desbloquear = (u.es_freelancer && u.bloqueado)
    ? '<button class="dbtn save pc-desbloq" data-desbloquear="' + u.usuario_id + '"><i class="fas fa-unlock"></i> Desbloquear</button>' : '';

  return '<div class="pc' + (u.bloqueado ? ' pc-bloq' : '') + '">'
    + '<div class="pc-top">'
      + '<div class="pc-ico" style="background:' + ico.c + '1f;color:' + ico.c + '"><i class="fas ' + ico.i + '"></i></div>'
      + '<div class="pc-id">'
        + '<div class="pc-nombre">' + esc(u.nombre || 'Sin nombre') + (u.conectado_ahora ? '<span class="pc-online" title="Conectado ahora"></span>' : '') + chips + '</div>'
        + '<div class="pc-rol">' + (ROL_LABEL_GP[u.rol] || esc(u.rol || '')) + (u.username ? ' · @' + esc(u.username) : '') + '</div>'
        + '<div class="pc-cargo">' + cargo + '</div>'
      + '</div>'
      + '<button class="pc-edit" type="button" data-editar="' + u.usuario_id + '" title="Editar"><i class="fas fa-pen"></i></button>'
      + (u.rol === 'asesor' ? '<button class="pc-edit" type="button" data-timeline="' + u.usuario_id + '" data-timeline-nombre="' + esc(u.nombre || '') + '" title="Ver el día"><i class="fas fa-timeline"></i></button>' : '')
    + '</div>'
    + '<div class="pc-asist-row">' + asist + strikes + exentarBtn + '</div>'
    + '<div class="pc-cifras" title="Tiempo con el CRM abierto y a la vista. No cuenta la pestaña en segundo plano ni la jornada que quedó sin cerrar.">'
    + '<div class="pc-cifra"><span class="pc-cifra-v">' + fmtMinutos(u.minutos_hoy) + '</span><span class="pc-cifra-t">Presente hoy</span></div>'
    + '<div class="pc-cifra"><span class="pc-cifra-v">' + fmtMinutos(u.minutos_semana) + '</span><span class="pc-cifra-t">Esta semana</span></div></div>'
    + frlBloque
    + desbloquear
    + detalle
  + '</div>';
}

function diaPersonaHtml(d) {
  // Horarios reales registrados (hecho verificable), hasta 6 por día: un día
  // con 80 sesiones encadenadas sería ilegible.
  const ses = (d.sesiones || []).map(s => s.abierta
    ? fmtHoraCaracas(s.entrada) + ' &rarr; <span style="color:var(--green)">en curso</span>'
    : fmtHoraCaracas(s.entrada) + '&ndash;' + fmtHoraCaracas(s.salida));
  const ocultas = (d.cant_sesiones || 0) - ses.length;
  if (ocultas > 0) ses.push('+' + ocultas + ' más');
  const warn = d.tiene_anomala ? ' <span class="pc-dia-warn" title="Quedó una jornada sin cerrar. No afecta los minutos (salen del tiempo presente), pero el horario de salida de ese día no se registró.">⚠</span>' : '';
  return '<div class="pc-dia">'
    + '<div class="pc-dia-h"><span class="pc-dia-f">' + fmtDiaCorto(d.dia) + warn + '</span>'
    + '<span class="pc-dia-m">' + fmtMinutos(d.minutos) + '</span></div>'
    + '<div class="pc-dia-s">' + (ses.join(' · ') || '—') + '</div>'
  + '</div>';
}

/* ---------- Alta / edición / baja ---------- */
function abrirEditorPersona(usuarioId) {
  const u = personalCache.find(x => String(x.usuario_id) === String(usuarioId));
  if (!u) return;
  document.getElementById('drawerContent').innerHTML = `
    <div class="dhead"><div><div class="dn">${esc(u.nombre)}</div><div class="dm">@${esc(u.username || '')}</div></div></div>
    <div class="edit-box" style="margin-top:16px">
      <div class="eb-title"><i class="fas fa-id-card"></i> Datos</div>
      <label class="fl">Nombre</label>
      <input id="pe-nombre" class="ei" type="text" value="${esc(u.nombre || '')}">
      <label class="fl">Usuario (con el que inicia sesión)</label>
      <input id="pe-username" class="ei" type="text" autocapitalize="off" autocorrect="off" value="${esc(u.username || '')}">
      <label class="fl">Cargo</label>
      <input id="pe-cargo" class="ei" type="text" placeholder="Ej: Ejecutivo de Boletería · Gerente Administrativo" value="${esc(u.cargo || '')}">
      <label class="fl">Rol</label>
      <select id="pe-rol" class="ei">
        ${['asesor', 'admin', 'marketing', 'boleteria'].map(r => `<option value="${r}"${u.rol === r ? ' selected' : ''}>${VISTA_ROL_LABEL[r] || ROL_LABEL_GP[r] || r}</option>`).join('')}
      </select>
      ${u.rol === 'asesor' ? `
      <label class="fl">Teléfono</label>
      <input id="pe-whatsapp" class="ei" type="tel" placeholder="Ej: +58 412 1234567" value="${esc(u.whatsapp || '')}">
      <label class="fl">Grupo de Telegram</label>
      <input id="pe-telegram" class="ei" type="text" placeholder="ID del grupo o chat" value="${esc(u.telegram_chat_id || '')}">` : ''}
      <label class="pe-check" style="margin-top:12px"><input type="checkbox" id="pe-freelancer"${u.es_freelancer ? ' checked' : ''}> Es freelancer (se bloquea a los 15 min sin actividad)</label>
      <label class="pe-check" style="margin-top:10px"><input type="checkbox" id="pe-boleteria"${u.es_boleteria ? ' checked' : ''}> Es agente de boletería (atiende la cola de solicitudes de vuelos)</label>
      <label class="pe-check" style="margin-top:10px"><input type="checkbox" id="pe-voucher"${u.ve_voucher ? ' checked' : ''}> Ve vouchers</label>
      <label class="pe-check" style="margin-top:10px"><input type="checkbox" id="pe-informe"${u.ve_informe_diario ? ' checked' : ''}> Ve informe diario</label>
      <label class="pe-check" style="margin-top:10px"><input type="checkbox" id="pe-bloqueado"${u.bloqueado ? ' checked' : ''}> Bloqueado (sin acceso, sin darlo de baja)</label>
      <div class="edit-err" id="pe-err"></div>
      <button class="dbtn save" id="pe-guardar" type="button"><i class="fas fa-check"></i> Guardar</button>
      <label class="fl" style="margin-top:14px">Nueva contraseña (opcional)</label>
      <input id="pe-password" class="ei" type="password" minlength="12" placeholder="Mínimo 12 caracteres">
      <div class="form-hint">Si la dejás vacía, se genera una temporal y se pedirá cambiarla al entrar.</div>
      <button class="dbtn gh" id="pe-restablecer" type="button"><i class="fas fa-key"></i> Restablecer acceso</button>
      <button class="dbtn gh" id="pe-baja" type="button" style="color:#ef4444"><i class="fas fa-user-slash"></i> Dar de baja</button>
      <div style="font-size:11px;color:var(--muted2);margin-top:10px;line-height:1.5">Dar de baja le quita el acceso al instante y lo saca de las listas, pero <b>no borra su historial</b> de asistencia, leads ni comisiones. Se puede reactivar.</div>
    </div>`;
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBg').classList.add('open');
  navPush({ type: 'drawer' });
  document.getElementById('pe-guardar').onclick = () => guardarPersona(usuarioId);
  document.getElementById('pe-restablecer').onclick = () => restablecerAcceso(usuarioId);
  document.getElementById('pe-baja').onclick = () => bajaPersonal(usuarioId, false);
}

async function restablecerAcceso(usuarioId) {
  const u = personalCache.find(x => String(x.usuario_id) === String(usuarioId));
  const password = val('pe-password');
  if (password && password.length < 12) { document.getElementById('pe-err').textContent = 'La contraseña debe tener al menos 12 caracteres.'; return; }
  if (!u || !(await confirmarSheet({ titulo: `¿Restablecer el acceso de ${u.nombre}?`, detalle: password ? 'La contraseña elegida por el administrador quedará activa de inmediato.' : 'Vas a recibir una contraseña temporal para pasársela una sola vez. La persona deberá cambiarla al entrar.', textoOk: 'Restablecer' }))) return;
  const { data, error } = await sb.functions.invoke('restablecer-acceso', { body: { usuario_id: usuarioId, password: password || undefined } });
  if (error || !data?.ok) { errToast('No se pudo restablecer el acceso.'); return; }
  document.getElementById('drawerContent').innerHTML = `
    <div class="dhead"><div><div class="dn">Acceso restablecido</div><div class="dm">${esc(u.nombre)}</div></div></div>
    <div class="edit-box" style="margin-top:16px;border-color:rgba(34,197,94,.4)">
      <div style="font-size:13px;line-height:1.6">Pasale esta contraseña por un canal privado.${password ? ' Fue definida por el administrador.' : ' <b>Se muestra una sola vez</b> y deberá cambiarla al iniciar sesión.'}</div>
      <div class="pn-cred"><span>Usuario</span><b>${esc(data.username)}</b></div>
      <div class="pn-cred"><span>Contraseña temporal</span><b>${esc(data.password_temporal)}</b></div>
      <button class="dbtn gh" id="pe-copiar-reset" type="button"><i class="fas fa-copy"></i> Copiar</button>
    </div>`;
  document.getElementById('pe-copiar-reset').onclick = () => navigator.clipboard.writeText(`Usuario: ${data.username}\nContraseña temporal: ${data.password_temporal}`)
    .then(() => okToast('Copiado')).catch(() => errToast('No se pudo copiar'));
}

async function guardarPersona(usuarioId) {
  const btn = document.getElementById('pe-guardar');
  const err = document.getElementById('pe-err');
  const nombre = val('pe-nombre').trim();
  if (nombre.length < 3) { err.textContent = 'El nombre es muy corto.'; return; }
  btn.disabled = true;
  const rol = val('pe-rol');
  const { data, error } = await sb.rpc('admin_actualizar_personal', {
    p_usuario_id: usuarioId,
    p_nombre: nombre,
    p_cargo: val('pe-cargo').trim(),
    p_rol: rol,
    p_es_freelancer: document.getElementById('pe-freelancer').checked,
    p_es_boleteria: document.getElementById('pe-boleteria').checked,
    p_username: val('pe-username').trim() || null,
    p_ve_voucher: document.getElementById('pe-voucher').checked,
    p_ve_informe_diario: document.getElementById('pe-informe').checked,
    p_bloqueado: document.getElementById('pe-bloqueado').checked,
  });
  if (error || !data?.ok) {
    btn.disabled = false;
    err.textContent = ERR_PERSONAL[data?.error] || error?.message || 'No se pudo guardar.';
    return;
  }
  if (rol === 'asesor' && (document.getElementById('pe-whatsapp') || document.getElementById('pe-telegram'))) {
    await sb.rpc('admin_vincular_asesor', {
      p_usuario_id: usuarioId,
      p_nombre: nombre,
      p_whatsapp: val('pe-whatsapp').trim() || null,
      p_telegram_chat_id: val('pe-telegram').trim() || null,
    });
  }
  btn.disabled = false;
  window.closeDrawer();
  okToast('Datos actualizados');
  loadPersonalTiempo(personalSoloFreelancers);
}

const ERR_PERSONAL = {
  no_podes_cambiar_tu_propio_rol: 'No podés cambiarte el rol a vos mismo — pedíselo a otro admin.',
  no_podes_darte_de_baja_a_vos_mismo: 'No podés darte de baja a vos mismo.',
  es_el_ultimo_admin: 'Es el único admin que queda. Nombrá otro antes de darlo de baja.',
  rol_invalido: 'Ese rol no existe.',
  no_existe: 'Esa persona ya no está en el sistema.',
  username_ocupado: 'Ese usuario ya está en uso.',
  username_invalido: 'El usuario solo puede tener letras, números, punto, guion y guion bajo (3 a 32).',
  nombre_invalido: 'El nombre es muy corto.',
  password_invalido: 'La contraseña debe tener al menos 8 caracteres.',
  no_autorizado: 'Tu sesión expiró. Recargá la página y volvé a entrar.',
  no_se_pudo_crear_la_cuenta: 'No se pudo crear la cuenta de acceso. Reintentá en unos segundos.',
  no_se_pudo_registrar_en_el_crm: 'La cuenta se creó pero no se pudo guardar en el CRM. Avisale a Sistemas.',
};

async function bajaPersonal(usuarioId, reactivar) {
  const u = [...personalCache, ...personalBaja].find(x => String(x.usuario_id) === String(usuarioId));
  if (!reactivar && !(await confirmarSheet({ titulo: `¿Dar de baja a ${u?.nombre || 'esta persona'}?`, detalle: 'Pierde el acceso al CRM al instante. Su historial de asistencia, leads y comisiones NO se borra, y podés reactivarla cuando quieras.', textoOk: 'Dar de baja', destructivo: true }))) return;
  const { data, error } = await sb.rpc('admin_baja_personal', { p_usuario_id: usuarioId, p_reactivar: !!reactivar });
  if (error || !data?.ok) { errToast(ERR_PERSONAL[data?.error] || error?.message || 'No se pudo aplicar'); return; }
  window.closeDrawer();
  okToast(reactivar ? 'Persona reactivada' : 'Persona dada de baja');
  loadPersonalTiempo(personalSoloFreelancers);
}

function abrirAltaPersona(comoFreelancer) {
  document.getElementById('drawerContent').innerHTML = `
    <div class="dhead"><div><div class="dn">${comoFreelancer ? 'Nuevo freelancer' : 'Nuevo miembro del equipo'}</div><div class="dm">Se crea su cuenta de acceso al CRM</div></div></div>
    <div class="edit-box" style="margin-top:16px">
      <label class="fl">Nombre y apellido</label>
      <input id="pn-nombre" class="ei" type="text" placeholder="Ej: María Pérez">
      <label class="fl">Usuario (con el que inicia sesión)</label>
      <input id="pn-username" class="ei" type="text" placeholder="Ej: maria" autocapitalize="off" autocorrect="off">
      <label class="fl">Cargo (opcional)</label>
      <input id="pn-cargo" class="ei" type="text" placeholder="Ej: Ejecutiva de Boletería">
      <label class="fl">Rol</label>
      <select id="pn-rol" class="ei">
        <option value="asesor">Asesor</option>
        <option value="admin">Administrador</option>
        <option value="marketing">Marketing</option>
        <option value="boleteria">Boletería</option>
      </select>
      <div id="pn-datos-asesor">
        <label class="fl">Teléfono</label>
        <input id="pn-whatsapp" class="ei" type="tel" placeholder="Ej: +58 412 1234567">
        <label class="fl">Grupo de Telegram</label>
        <input id="pn-telegram" class="ei" type="text" placeholder="ID del grupo o chat">
        <label class="fl">Contraseña</label>
        <input id="pn-password" class="ei" type="password" minlength="8" placeholder="Mínimo 8 caracteres">
        <div class="form-hint">Si la dejás vacía se genera una temporal y se pide cambiarla al entrar.</div>
      </div>
      <label class="pe-check" style="margin-top:12px"><input type="checkbox" id="pn-freelancer"${comoFreelancer ? ' checked' : ''}> Es freelancer (se bloquea a los 15 min sin actividad)</label>
      <div class="edit-err" id="pn-err"></div>
      <button class="dbtn save" id="pn-crear" type="button"><i class="fas fa-user-plus"></i> Crear cuenta</button>
      <div id="pn-listo"></div>
    </div>`;
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBg').classList.add('open');
  navPush({ type: 'drawer' });
  const ajustarDatosAsesor = () => {
    const esAsesor = val('pn-rol') === 'asesor';
    document.getElementById('pn-datos-asesor').style.display = esAsesor ? '' : 'none';
  };
  document.getElementById('pn-rol').onchange = ajustarDatosAsesor;
  ajustarDatosAsesor();
  document.getElementById('pn-crear').onclick = crearPersona;
}

async function crearPersona() {
  const btn = document.getElementById('pn-crear');
  const err = document.getElementById('pn-err');
  err.textContent = '';
  btn.disabled = true; btn.innerHTML = 'Creando... <i class="fas fa-spinner fa-spin"></i>';
  const { data, error } = await sb.functions.invoke('crear-personal', {
    body: {
      nombre: val('pn-nombre').trim(),
      username: val('pn-username').trim().toLowerCase(),
      cargo: val('pn-cargo').trim(),
      rol: val('pn-rol'),
      es_freelancer: document.getElementById('pn-freelancer').checked,
      password: val('pn-password'),
    },
  });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Crear cuenta';
  if (error || !data?.ok) {
    err.textContent = ERR_PERSONAL[data?.error] || data?.detalle || error?.message || 'No se pudo crear la cuenta.';
    return;
  }
  if (val('pn-rol') === 'asesor') {
    const { error: vinculoError } = await sb.rpc('admin_vincular_asesor', {
      p_usuario_id: data.usuario_id,
      p_nombre: val('pn-nombre').trim(),
      p_whatsapp: val('pn-whatsapp').trim() || null,
      p_telegram_chat_id: val('pn-telegram').trim() || null,
    });
    if (vinculoError) errToast('La cuenta se creó, pero falta vincularla al reparto: ' + vinculoError.message);
  }
  // La contraseña temporal se muestra UNA sola vez: no queda guardada en
  // ningún lado en texto plano, así que si se cierra sin copiarla hay que
  // resetearla.
  btn.style.display = 'none';
  document.getElementById('pn-listo').innerHTML = `
    <div class="edit-box" style="margin-top:14px;border-color:rgba(34,197,94,.4)">
      <div class="eb-title" style="color:var(--green)"><i class="fas fa-circle-check"></i> Cuenta creada</div>
      <div style="font-size:13px;line-height:1.6">Pasale estos datos por WhatsApp o Telegram. <b>La contraseña se muestra una sola vez</b> — si cerrás esta ventana sin copiarla, hay que resetearla.</div>
      <div class="pn-cred"><span>Usuario</span><b>${esc(data.username)}</b></div>
      <div class="pn-cred"><span>Contraseña temporal</span><b>${esc(data.password_temporal)}</b></div>
      <div style="font-size:11.5px;color:var(--muted);margin-top:8px">${val('pn-password') ? 'La contraseña fue definida por el administrador.' : 'Se la va a pedir cambiar en el primer ingreso.'}</div>
      <button class="dbtn gh" id="pn-copiar" type="button"><i class="fas fa-copy"></i> Copiar</button>
    </div>`;
  document.getElementById('pn-copiar').onclick = () => {
    navigator.clipboard.writeText(`Usuario: ${data.username}\nContraseña temporal: ${data.password_temporal}`)
      .then(() => okToast('Copiado')).catch(() => errToast('No se pudo copiar'));
  };
  loadPersonalTiempo(personalSoloFreelancers);
}

// La pestaña Asistencia se retiró (2026-07-27): el estado de hoy, los strikes
// del mes y el botón de exceptuar viven en la tarjeta de cada persona dentro de
// Personal. Acá queda solo lo histórico -- strikes del mes y el listado de
// entradas/salidas -- que no cabe en una tarjeta.
async function loadAsistenciaExtras() {
  const [{ data: hoy }, { data: strikes }] = await Promise.all([
    sb.rpc('asistencia_admin_hoy'),
    sb.rpc('asistencia_strikes_mes'),
  ]);
  const activos = (strikes || []).filter(s => !s.anulado_at);
  const wrap = document.getElementById('asist-strikes-wrap');
  if (wrap) {
    wrap.innerHTML = activos.length
      ? activos.map(s => `<div class="strike-row"><span>${esc(s.nombre)} — ${s.fecha}</span><button class="btn-sm" onclick="anularStrikeUI(${s.id})">Anular</button></div>`).join('')
      : '<div class="es-s">Sin strikes este mes</div>';
  }
  const selAsesor = document.getElementById('asist-hist-asesor');
  if (selAsesor) {
    const prevSel = selAsesor.value;
    selAsesor.innerHTML = '<option value="">Todos los asesores</option>' + (hoy || []).map(a => `<option value="${a.usuario_id}">${esc(a.nombre)}</option>`).join('');
    if (prevSel && [...selAsesor.options].some(o => o.value === prevSel)) selAsesor.value = prevSel;
  }
  setupAsistenciaHistorial();
  loadAsistenciaHistorial();
}
let asistHistSetup = false;
function setupAsistenciaHistorial() {
  if (asistHistSetup) return; asistHistSetup = true;
  initDateRangePicker('asist-hist');
  ['asist-hist-asesor', 'asist-hist-desde', 'asist-hist-hasta'].forEach(id => document.getElementById(id).addEventListener('change', loadAsistenciaHistorial));
}
async function loadAsistenciaHistorial() {
  const fa = val('asist-hist-asesor') || null, fd = val('asist-hist-desde') || null, fh = val('asist-hist-hasta') || null;
  const { data, error } = await sb.rpc('asistencia_historial', { p_asesor_id: fa, p_desde: fd, p_hasta: fh });
  if (error) { errToast('No se pudo cargar el historial de asistencia'); return; }
  const fmtFecha = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date(iso));
  document.getElementById('asist-hist-tbody').innerHTML = (data || []).map(s => `
    <tr>
      <td data-label="Asesor">${esc(s.nombre)}</td>
      <td data-label="Fecha" class="muted">${fmtFecha(s.hora_entrada)}</td>
      <td data-label="Entrada">${fmtHoraCaracas(s.hora_entrada)}</td>
      <td data-label="Salida" class="muted">${fmtHoraCaracas(s.hora_salida)}</td>
    </tr>`).join('') || '<tr><td colspan="4">Sin registros</td></tr>';
}

/* ---------- Informe Diario (Bloque 14 — solo Luis Rueda) ---------- */
async function loadInformeDiario() {
  const { data, error } = await sb.rpc('informes_diarios_listado');
  if (error) { console.error(error); errToast('No se pudo cargar el Informe Diario'); return; }
  document.getElementById('informe-diario-tbody').innerHTML = (data || []).map(f => `
    <tr>
      <td data-label="Fecha" class="muted">${fmtFechaSolo(f.fecha)}</td>
      <td data-label="Asesor">${esc(f.nombre)}</td>
      <td data-label="Hora salida">${f.tiene_informe ? fmtHoraCaracas(f.hora_salida) : '<span class="asist-badge off">Sin informe</span>'}</td>
      <td data-label="Resumen">${f.tiene_informe ? renderInformeCampos(f) : '—'}</td>
    </tr>`).join('') || '<tr><td colspan="4">Sin registros</td></tr>';
}
// Informes viejos (previos al 2026-08-19) solo tienen `resumen`; los nuevos
// traen las cuatro respuestas separadas. Se muestran distinto sin romper el histórico.
function renderInformeCampos(f) {
  if (!f.como_me_fue && !f.que_aprendi) return esc(f.resumen || '—');
  const bloque = (etiqueta, valor) => valor
    ? `<div style="margin-bottom:6px"><b style="color:var(--muted2);font-size:11px;text-transform:uppercase">${etiqueta}</b><br>${esc(valor)}</div>`
    : '';
  return bloque('Cómo le fue', f.como_me_fue)
    + bloque('Qué aprendió', f.que_aprendi)
    + bloque('Qué se le complicó', f.que_se_complico)
    + bloque('Bloqueos', f.bloqueos);
}
window.exceptuarHoy = async (asesorId) => {
  const motivo = prompt('Motivo (opcional):');
  const { error } = await sb.rpc('exceptuar_asistencia', { p_asesor_id: asesorId, p_fecha: hoyCaracas(), p_motivo: motivo || null });
  if (error) { errToast('No se pudo exceptuar: ' + error.message); return; }
  okToast('Asesor exceptuado hoy');
  loadPersonalTiempo(personalSoloFreelancers);
};
window.anularStrikeUI = async (strikeId) => {
  const motivo = prompt('Motivo de la anulación (obligatorio):');
  if (!motivo || !motivo.trim()) return;
  const { error } = await sb.rpc('anular_strike', { p_strike_id: strikeId, p_motivo: motivo.trim() });
  if (error) { errToast('No se pudo anular: ' + error.message); return; }
  okToast('Strike anulado');
  loadAsistenciaExtras();
};

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn'), errEl = document.getElementById('loginErr');
  const username = val('loginUser').trim().toLowerCase();
  errEl.textContent = ''; btn.disabled = true; btn.innerHTML = 'Entrando... <i class="fas fa-spinner fa-spin"></i>';
  const { error } = await sb.auth.signInWithPassword({ email: `${username}@${EMAIL_DOMINIO}`, password: document.getElementById('loginPwd').value });
  btn.disabled = false; btn.innerHTML = 'Entrar <i class="fas fa-arrow-right"></i>';
  if (error) { errEl.textContent = 'Usuario o contraseña incorrectos'; document.getElementById('loginPwd').select(); return; }
  await afterLogin();
});

document.getElementById('setupForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('setupBtn'), errEl = document.getElementById('setupErr');
  const p1 = val('setupPwd'), p2 = val('setupPwd2'), pregunta = val('setupPregunta').trim(), respuesta = val('setupRespuesta').trim();
  errEl.textContent = '';
  if (p1.length < 12) { errEl.textContent = 'La contraseña debe tener al menos 12 caracteres'; return; }
  if (p1 !== p2) { errEl.textContent = 'Las contraseñas no coinciden'; return; }
  if (pregunta.length < 8 || respuesta.length < 8 || /^\d+$/.test(respuesta)) { errEl.textContent = 'Usa una pregunta y respuesta de al menos 8 caracteres; la respuesta no puede ser sólo números'; return; }
  btn.disabled = true; btn.innerHTML = 'Guardando... <i class="fas fa-spinner fa-spin"></i>';
  const { error: e1 } = await sb.auth.updateUser({ password: p1 });
  const { error: e2 } = e1 ? { error: null } : await sb.rpc('set_pregunta_seguridad', { p_pregunta: pregunta, p_respuesta: respuesta });
  btn.disabled = false; btn.innerHTML = 'Guardar y entrar <i class="fas fa-arrow-right"></i>';
  const err = e1 || e2;
  if (err) { errEl.textContent = 'No se pudo guardar: ' + err.message; return; }
  const u = await cargarUsuario(); if (!u) return;
  ROL_REAL = u.rol; // ver afterLogin -- sin esto, un admin recién configurado pierde el switcher de vista previa hasta refrescar
  MI_NOMBRE = u.nombre; ROL = u.rol; MI_USERNAME = u.username; MI_USUARIO_ID = u.id;
  MI_AVATAR_URL = u.avatar_url; MI_PREFERENCIAS = u.preferencias || {}; MI_VE_INFORME_DIARIO = !!u.ve_informe_diario;
  entrarSegunRol();
});

document.getElementById('forgotLink').addEventListener('click', e => {
  e.preventDefault();
  errToast('Pedile a un administrador que restablezca tu acceso desde Gestión de Personal.');
});

/* ---------- Configurar usuario (reclamar cuenta, sin contraseña previa) ---------- */
const ROL_LABEL = { admin: 'Admin', asesor: 'Asesor', marketing: 'Marketing', boleteria: 'Boletería' };
let claimUsername = null;

document.getElementById('claimLink').addEventListener('click', e => { e.preventDefault(); abrirListaClaim(); });
document.getElementById('claimBackToLogin').addEventListener('click', e => { e.preventDefault(); showOverlay('login'); });
document.getElementById('claimFormBack').addEventListener('click', e => { e.preventDefault(); abrirListaClaim(); });

async function abrirListaClaim() {
  showOverlay('claim-list');
  const box = document.getElementById('claimListItems'), errEl = document.getElementById('claimListErr');
  errEl.textContent = ''; box.innerHTML = '<div class="claim-empty">Cargando...</div>';
  const { data, error } = await sb.rpc('listar_usuarios_disponibles');
  if (error) { box.innerHTML = ''; errEl.textContent = 'No se pudo cargar la lista, intenta de nuevo'; return; }
  if (!data || !data.length) { box.innerHTML = '<div class="claim-empty">Todos los usuarios ya están configurados.</div>'; return; }
  box.innerHTML = data.map(u => `<div class="claim-item" data-u="${esc(u.username)}"><span class="cn">${esc(u.nombre)}</span><span class="cr">${ROL_LABEL[u.rol] || u.rol}</span></div>`).join('');
  box.querySelectorAll('.claim-item').forEach(el => el.onclick = () => abrirFormClaim(el.dataset.u, el.querySelector('.cn').textContent));
}

function abrirFormClaim(username, nombre) {
  claimUsername = username;
  document.getElementById('claimFormTitle').textContent = 'Hola, ' + nombre;
  document.getElementById('claimForm').reset();
  document.getElementById('claimFormErr').textContent = '';
  showOverlay('claim-form');
}

document.getElementById('claimForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('claimFormBtn'), errEl = document.getElementById('claimFormErr');
  const p1 = val('claimPwd'), p2 = val('claimPwd2'), pregunta = val('claimPregunta').trim(), respuesta = val('claimRespuesta').trim();
  errEl.textContent = '';
  if (p1.length < 12) { errEl.textContent = 'La contraseña debe tener al menos 12 caracteres'; return; }
  if (p1 !== p2) { errEl.textContent = 'Las contraseñas no coinciden'; return; }
  if (pregunta.length < 8 || respuesta.length < 8 || /^\d+$/.test(respuesta)) { errEl.textContent = 'Usa una pregunta y respuesta de al menos 8 caracteres; la respuesta no puede ser sólo números'; return; }
  btn.disabled = true; btn.innerHTML = 'Creando... <i class="fas fa-spinner fa-spin"></i>';
  try {
    const r = await fetch(CLAIM_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: claimUsername, password: p1, pregunta, respuesta }) });
    const data = await r.json();
    btn.disabled = false; btn.innerHTML = 'Crear mi acceso <i class="fas fa-arrow-right"></i>';
    if (!data.ok) { errEl.textContent = data.error === 'usuario_invalido' ? 'Ese usuario ya está configurado' : 'No se pudo crear el acceso, intenta de nuevo'; return; }
    okToast('Usuario configurado, ya puedes entrar');
    document.getElementById('loginUser').value = claimUsername;
    showOverlay('login');
  } catch (_e) {
    btn.disabled = false; btn.innerHTML = 'Crear mi acceso <i class="fas fa-arrow-right"></i>';
    errEl.textContent = 'Error de conexión, intenta de nuevo';
  }
});

// Ya no cierra la jornada acá (agent_check_out ahora exige resumen, Bloque 14)
// -- si queda activa, agent_check_in ya la cierra sola en el próximo login
// (mismo criterio que un refresh/cierre de pestaña sin logout, ver comentario
// arriba de agent_check_in).
window.cerrarSesion = async () => {
  // Sin esto, una vista previa activa quedaba en sessionStorage y se le
  // pegaba al PRÓXIMO admin que loguee en la misma pestaña (compu
  // compartida) -- sessionStorage sobrevive a un logout, solo se limpia al
  // cerrar la pestaña.
  sessionStorage.removeItem(VISTA_ROL_KEY);
  await sb.auth.signOut();
  location.reload();
};

/* Corre cada inicialización por separado y aislada: si una revienta, se anota
   en la consola y las demás siguen.

   Incidente real (2026-08-03): la sección nueva "Consultor IA" agregaba su
   HTML y su JS en la misma publicación, pero el service worker llegó a servir
   el app.js nuevo contra el index.html viejo (ver sw.js). El setup de la
   sección buscó un elemento que todavía no existía, tiró TypeError, y como
   todas las inicializaciones iban seguidas en la misma cadena, se llevó puesto
   todo lo que venía después -- Voucher, Tareas, Freelancers, Destinos. El CRM
   quedó inutilizable por una sección que ni siquiera se estaba usando.

   La causa de fondo (el shell mezclado) está arreglada en sw.js; esto es la
   segunda línea de defensa: que un solo elemento faltante nunca más pueda
   apagar funciones que no tienen nada que ver. */
function arrancar(...pasos) {
  for (const paso of pasos) {
    try { paso(); }
    catch (err) { console.error('CRM: falló la inicialización de', paso.name || '(anónima)', err); }
  }
}

async function startApp() {
  if (booted) return; booted = true;
  arrancar(
    renderNavItems, aplicarOrdenSidebar, renderFrecuentes, ocultarHeadersVaciosMenu, setupNav, renderBottomNav, setupSwipeSecciones, setupPullToRefresh, setupLongPressSeleccion,
    setupTarifarioTabs, setupLightbox, setupChat, setupMensajes, setupRedes,
    setupPostventa, setupTutorial, setupManual, registrarServiceWorkerConAviso, setupInstalacionPwa,
    setupHoy, setupConsultorIA, setupBoleteriaSeccion, setupMisNotas,
  );
  if (ROL === 'marketing') {
    // Voz IA se abrió a marketing (2026-08-13) -- el nav-item ya se ve
    // (nav-marketing-ok en index.html) pero setupVozIA vive en el SEGUNDO
    // arrancar() de abajo, que nunca corre para este rol porque el return de
    // acá lo corta antes de llegar. Sin esto, la sección se ve pero está
    // muerta: ningún botón hace nada, nada carga (bug real, encontrado por
    // code-review). El resto del segundo arrancar() (métricas, facturación,
    // gestión de personal...) sigue sin correr para marketing a propósito.
    arrancar(setupVozIA);
    activateSection('tarifario');
    return;
  }
  if (ROL === 'boleteria') { entrarModoBoleteria(); return; }
  // Restaura la última sección visitada por este usuario (admin/asesor,
  // ver guardarUltimaSeccion) -- marketing/boleteria arriba se quedan
  // siempre en su única sección fija, no aplica. En mobile el punto de
  // entrada por default pasa a ser 'hoy' (bottom-nav de 5 zonas); desktop
  // sigue entrando por leads/dashboard como siempre, sin cambios.
  const esMobile = window.matchMedia('(max-width:760px)').matches;
  const seccionGuardada = MI_PREFERENCIAS.ultima_seccion;
  const seccionValida = seccionGuardada && document.getElementById('sec-' + seccionGuardada);
  if (ROL === 'asesor') {
    const destino = seccionValida ? seccionGuardada : (esMobile ? 'hoy' : 'leads');
    activateSection(destino);
    // Si el destino restaurado no es 'leads', activateSection no dispara
    // loadInboxLeads() -- hace falta igual para el badge de pendientes
    // (y 'hoy' además la necesita para su lista "Necesitan tu atención").
    if (destino !== 'leads') loadInboxLeads();
  }
  await loadStats();
  ACTIVOS = Object.keys(STATS.by_advisor || {});
  // by_advisor solo trae asesores que YA tienen leads; los recién agregados
  // (ej. Luis Silva, Maryori Sandoval) no aparecen y quedaban fuera del selector
  // de "Asesor asignado" y de los filtros. Se completa con listar_asesores_activos()
  // (tabla `asesores` con activo=true), la fuente de verdad de quién puede recibir.
  try {
    const { data, error } = await sb.rpc('listar_asesores_activos');
    if (!error && Array.isArray(data)) {
      ACTIVOS = [...new Set([...ACTIVOS, ...data.map(a => a.nombre)])];
    }
  } catch (_) { /* sin permisos (asesor) o fallo de red: se conserva by_advisor */ }
  if (ROL === 'admin') activateSection(seccionValida ? seccionGuardada : (esMobile ? 'hoy' : 'dashboard'));
  renderHoy();
  renderAll();
  setupFilters();
  await loadTable();
  // No se llama loadInboxLeads() acá de nuevo -- activateSection('leads')
  // (arriba, para asesor) ya la dispara; llamarla dos veces corría 2 fetches
  // del mismo query en paralelo sin orden garantizado de resolución.
  arrancar(
    setupMetricas, setupRanking, setupReasignaciones, setupAsesoresPeriodo,
    setupFacturacion, setupGestionPersonal, setupLeadsTabs,
    setupBuscadorIATarifario, setupCerebroIA, setupVozIA, setupRendimientoIA, setupWebReasignados, setupStopSales,
    setupDestPeriodo, loadDestPeriodo,
    setupVoucher, actualizarBadgeVoucher,
    setupTareas, setupFreelancers,
    cargarNotasRepaso,
    subscribeRealtime,
  );
}
async function renderAll() { renderKPIs(); renderPipe('pipe'); renderPipe('pipe2'); renderAdvisors(); await ensureChart(); renderTrend(); renderCanal(); }

async function loadStats() {
  const { data, error } = await sb.rpc('dashboard_stats');
  if (error) { console.error('stats', error.message || error); errToast('No se pudieron cargar las estadísticas'); return; }
  STATS = data;
  trendMap = {}; (STATS.trend || []).forEach(x => trendMap[x.mes] = x.total);
  // Para asesor el badge de Leads muestra pendientes del inbox (actualizarBadgeLeads),
  // no el total histórico -- no pisarlo acá.
  if (ROL !== 'asesor') document.getElementById('nav-lead-count').textContent = Number.isFinite(STATS.total) ? (STATS.total / 1000).toFixed(1).replace('.0', '') + 'k' : '—';
}

/* ---------- KPIs ---------- */
// Pintor único de tarjetas KPI. Con `go` sale un <button> real (navegable con
// teclado, no un div con onclick); sin `go`, un div sin cursor de mano para no
// prometer un click que no hace nada.
// Ojo: <button> NO hereda el color del texto, hay que forzarlo -- lo hace
// .kpi-btn en index.html. Sin eso el número sale negro sobre panel oscuro.
// Fase 6 -- los KPIs cuentan hasta su valor la PRIMERA vez que se ven en la
// sesión (una card ya vista no vuelve a contar en cada refresh, se pinta
// directo). Clave = id del contenedor + título, no hay otro identificador
// estable entre los ~15 lugares que llaman pintarKPIs.
const KPIS_ANIMADOS = new Set();
function contarKPI(el, valorFinal) {
  // k.v ya viene formateado (fmt()/money(), con separadores y a veces "$" o
  // texto alrededor) -- se anima solo la parte numérica y se reconstruye
  // con el mismo prefijo/sufijo, no se reinventa el formato acá.
  const m = String(valorFinal).match(/^(\D*)([\d.,]+)(\D*)$/);
  if (!m || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) { el.textContent = valorFinal; return; }
  const [, prefijo, numStr, sufijo] = m;
  const num = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
  if (!isFinite(num) || num <= 0) { el.textContent = valorFinal; return; }
  const dur = 600, t0 = performance.now();
  function cuadro(t) {
    // Clamp de los dos lados -- el primer callback de requestAnimationFrame
    // puede traer un timestamp apenas ANTERIOR al t0 capturado antes de
    // pedirlo (orden de eventos del navegador, no un error nuestro), lo que
    // daba p negativo y una cifra negativa de un frame antes de empezar a
    // subir (bug real, visto en la verificación de esta misma fase).
    const p = Math.max(0, Math.min(1, (t - t0) / dur));
    const actual = Math.round(num * (1 - Math.pow(1 - p, 3)));
    el.textContent = prefijo + fmt(actual) + sufijo;
    if (p < 1) requestAnimationFrame(cuadro); else el.textContent = valorFinal;
  }
  requestAnimationFrame(cuadro);
}
function pintarKPIs(box, cards) {
  if (typeof box === 'string') box = document.getElementById(box);
  if (!box) return;
  const boxId = box.id || '';
  box.innerHTML = cards.map(k => {
    const tag = k.go ? 'button' : 'div';
    // `key` es opcional: solo lo usan pantallas que necesitan resaltar cuál
    // KPI corresponde al filtro activo (ver wrActualizarKpiOn) -- el resto de
    // los llamados a pintarKPIs no lo pasa y no cambia nada para ellos.
    return `<${tag} class="kpi${k.go ? ' kpi-btn' : ''}${k.on ? ' kpi-on' : ''}" style="--kc:${k.c}${k.go ? '' : ';cursor:default'}" data-kpi-key="${esc(k.key || '')}"`
      + (k.go ? ` type="button"${k.tt ? ` title="${esc(k.tt)}"` : ''}` : '')
      + `><div class="kt"><i class="fas ${k.i}"></i> ${k.t}</div><div class="kv">${k.v}</div>`
      + (k.d ? `<div class="kd">${k.d}</div>` : '')
      + (k.go ? '<i class="fas fa-arrow-right kgo"></i>' : '')
      + `</${tag}>`;
  }).join('');
  [...box.children].forEach((el, i) => {
    if (cards[i].go) el.addEventListener('click', cards[i].go);
    const clave = boxId + '|' + cards[i].t;
    if (!KPIS_ANIMADOS.has(clave)) { KPIS_ANIMADOS.add(clave); contarKPI(el.querySelector('.kv'), cards[i].v); }
  });
}
function renderKPIs() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const cards = [
    { t: 'Leads totales', v: fmt(STATS.total), d: 'Histórico 2022–2026', i: 'fa-users', c: 'var(--accent)', go: () => drillClear() },
    { t: 'Leads en 2026', v: fmt(STATS.anio_actual), d: `<b>+${fmt(STATS.by_canal?.Facebook || 0)}</b> por Facebook`, i: 'fa-calendar-day', c: 'var(--blue)', go: () => drillAnio('2026') },
    { t: 'Nuevos este mes', v: fmt(STATS.mes_actual), d: fullMonth(thisMonth), i: 'fa-bolt', c: 'var(--green)', go: () => drillMonth(thisMonth) },
    { t: 'Por atender', v: fmt(STATS.por_atender), d: 'Requieren primer contacto', i: 'fa-bell', c: 'var(--amber)', go: () => drillEstado('POR ATENDER') },
    { t: 'Vouchers este mes', v: fmt(STATS.vouchers_mes || 0), d: 'Generados por todo el equipo', i: 'fa-file-invoice', c: 'var(--purple)', go: () => activateSection('voucher') },
  ];
  pintarKPIs('kpis', cards);
}

/* ---------- Charts (dashboard) ---------- */
// Chart.js se carga on-demand (no bloquea el shell/login) — se pide la primera
// vez que algo necesita dibujar un gráfico real (Dashboard/Métricas). El rol
// marketing nunca llama a renderAll/loadDestPeriodo/loadMetricas, así que
// para ese rol Chart.js no se descarga nunca.
let chartLoadPromise = null;
function ensureChart() {
  if (window.Chart) return Promise.resolve();
  if (chartLoadPromise) return chartLoadPromise;
  chartLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    s.onload = () => {
      Chart.defaults.color = '#8b93ad'; Chart.defaults.font.family = 'Inter'; Chart.defaults.font.size = 11;
      resolve();
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return chartLoadPromise;
}
function mk(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart(document.getElementById(id), cfg); }
const pointer = (e, el) => { e.native.target.style.cursor = el.length ? 'pointer' : 'default'; };

function renderTrend() {
  const t = (STATS.trend || []).slice().sort((a, b) => a.mes.localeCompare(b.mes));
  trendKeys = t.map(x => x.mes);
  const labels = t.map(x => { const [y, m] = x.mes.split('-'); return MES3[+m - 1] + " '" + y.slice(2); });
  mk('chTrend', {
    type: 'bar', data: { labels, datasets: [{ data: t.map(x => x.total), backgroundColor: t.map(x => x.mes === activeMonth ? '#ffc266' : 'rgba(255,145,0,.72)'), hoverBackgroundColor: '#ffc266', borderRadius: 5, maxBarThickness: 30 }] },
    options: { responsive: true, maintainAspectRatio: false, onClick: (e, el) => { if (el.length) { const k = trendKeys[el[0].index]; chartPreview('month', k, fullMonth(k), 'fa-calendar-day', trendMap[k]); } }, onHover: pointer, plugins: { legend: { display: false }, tooltip: { callbacks: { title: it => fullMonth(trendKeys[it[0].dataIndex]), label: c => fmt(c.raw) + ' leads' } } }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }, y: { grid: { color: 'rgba(255,255,255,.05)' }, beginAtZero: true } } }
  });
}
function renderCanal() {
  const e = sortEntries(STATS.by_canal); canalKeys = e.map(x => x[0]);
  mk('chCanal', { type: 'doughnut', data: { labels: canalKeys, datasets: [{ data: e.map(x => x[1]), backgroundColor: ['#ff5c8a', '#a06bff', '#4a9eff', '#5f677f'], borderColor: '#0d1224', borderWidth: 3, hoverOffset: 8 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '64%', onClick: (e, el) => { if (el.length) { const k = canalKeys[el[0].index]; chartPreview('canal', k, k, 'fa-share-nodes', STATS.by_canal[k]); } }, onHover: pointer, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 12 } } }, tooltip: { callbacks: { label: c => c.label + ': ' + fmt(c.raw) } } } } });
}
function renderDest(datosPeriodo) {
  const src = datosPeriodo || STATS.top_destinos;
  const e = sortEntries(src).slice(0, 8); destKeys = e.map(x => x[0]);
  mk('chDest', { type: 'bar', data: { labels: destKeys, datasets: [{ data: e.map(x => x[1]), backgroundColor: 'rgba(74,158,255,.75)', hoverBackgroundColor: '#4a9eff', borderRadius: 6, barThickness: 16 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, onClick: (e, el) => { if (el.length) { const k = destKeys[el[0].index]; chartPreview('destino', k, k, 'fa-location-dot', src[k]); } }, onHover: pointer, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmt(c.raw) + ' leads' } } }, scales: { x: { grid: { color: 'rgba(255,255,255,.05)' }, beginAtZero: true }, y: { grid: { display: false } } } } });
}

/* ---------- Filtro de periodo en Destinos más solicitados ---------- */
let destPeriodo = 'mes';
function setupDestPeriodo() {
  document.querySelectorAll('#dest-periodo .seg').forEach(b => b.onclick = () => {
    document.querySelectorAll('#dest-periodo .seg').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); destPeriodo = b.dataset.p; loadDestPeriodo();
  });
}
async function loadDestPeriodo() {
  await ensureChart();
  let desde = null, hasta = null;
  if (destPeriodo !== 'historico') { const [d, h] = periodo(destPeriodo === 'dia' ? 'hoy' : destPeriodo); desde = iso(d); hasta = iso(h); }
  if (destPeriodo === 'historico') { renderDest(); }
  else {
    const { data, error } = await sb.rpc('top_destinos_periodo', { p_desde: desde, p_hasta: hasta });
    if (error) { console.error(error); errToast('No se pudieron cargar los destinos del periodo'); }
    else renderDest(data || {});
  }
  cargarConversionDestino(desde, hasta);
}

/* ---------- Conversión a venta por destino ---------- */
function colorPctConversion(pct) {
  if (pct >= 15) return '#10b981';
  if (pct >= 7) return '#f5b544';
  return '#ef4444';
}
async function cargarConversionDestino(desde, hasta) {
  const box = document.getElementById('destConversion');
  if (!box) return;
  const { data, error } = await sb.rpc('conversion_por_destino', { p_desde: desde, p_hasta: hasta });
  if (error) { console.error(error); box.innerHTML = '<div class="muted" style="font-size:12.5px">No se pudo cargar</div>'; return; }
  const entries = Object.entries(data || {}).sort((a, b) => b[1].pct - a[1].pct);
  if (!entries.length) { box.innerHTML = '<div class="muted" style="font-size:12.5px">Sin datos en el periodo</div>'; return; }
  box.innerHTML = entries.map(([destino, v]) => {
    const c = colorPctConversion(v.pct);
    return `<div class="dc-row"><span class="dn" title="${esc(destino)}">${esc(destino)}</span><div class="track"><div class="fill" style="width:${Math.min(v.pct, 100)}%;background:${c}"></div></div><span class="dv">${v.pct}%</span></div>`;
  }).join('');
}
function renderPipe(id) {
  const be = STATS.by_estado || {}; const shown = ESTADOS.filter(k => (be[k] || 0) > 0 || ['POR ATENDER', 'PAGO REALIZADO'].includes(k));
  const max = Math.max(...shown.map(k => be[k] || 0), 1);
  document.getElementById(id).innerHTML = shown.map(k => {
    const v = be[k] || 0, w = Math.max((v / max) * 100, 2);
    return `<div class="pstep" data-est="${k}"><div class="pl">${niceEstado(k)}</div><div class="pbar"><div class="pfill" style="width:${w}%;background:${ESTADO_COLORS[k] || '#5f677f'}">${v > max * 0.12 ? fmt(v) : ''}</div></div><div class="pv">${fmt(v)}</div></div>`;
  }).join('');
  document.querySelectorAll('#' + id + ' .pstep').forEach(el => el.onclick = () => { const k = el.dataset.est; chartPreview('estado', k, niceEstado(k), 'fa-diagram-project', be[k] || 0); });
}

/* ---------- Postventa: cobro, reserva, documentos y viaje ---------- */
const PV_ETAPAS = {
  COBRO_PENDIENTE: ['Cobro pendiente', 'fa-wallet'],
  CONFIRMACION_RESERVA: ['Confirmar reserva', 'fa-ticket'],
  DOCUMENTACION: ['Documentación', 'fa-folder-open'],
  LISTO_PARA_VIAJAR: ['Listo para viajar', 'fa-suitcase-rolling'],
  EN_VIAJE: ['En viaje', 'fa-plane-departure'],
  SEGUIMIENTO_POSTVIAJE: ['Seguimiento', 'fa-heart'],
  CERRADO: ['Cerrado', 'fa-circle-check'],
};
const PV_DOCS = {
  comprobante_pago: 'Comprobante de pago', reserva_emitida: 'Reserva emitida',
  voucher_hotel: 'Voucher de hotel', boletos: 'Boletos', seguro: 'Seguro',
  itinerario_entregado: 'Itinerario entregado',
};
function setupPostventa() {
  document.querySelectorAll('#pv-stagebar .pv-stage').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#pv-stagebar .pv-stage').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); PV_ETAPA = b.dataset.etapa || ''; loadPostventa();
  }));
  document.getElementById('pv-refresh')?.addEventListener('click', loadPostventa);
  document.getElementById('pv-search')?.addEventListener('input', () => {
    clearTimeout(PV_SEARCH_TIMER); PV_SEARCH_TIMER = setTimeout(loadPostventa, 280);
  });
}
async function loadPostventa() {
  const grid = document.getElementById('pv-grid');
  if (!grid || ROL === 'marketing') return;
  grid.innerHTML = '<div class="pv-empty"><i class="fas fa-circle-notch fa-spin"></i>Cargando postventa...</div>';
  const busqueda = document.getElementById('pv-search')?.value.trim() || null;
  const [resumen, bandeja] = await Promise.all([
    sb.rpc('postventa_resumen'),
    sb.rpc('postventa_bandeja', { p_etapa: PV_ETAPA || null, p_busqueda: busqueda }),
  ]);
  if (resumen.error || bandeja.error) {
    console.error('postventa', resumen.error || bandeja.error);
    grid.innerHTML = '<div class="pv-empty"><i class="fas fa-triangle-exclamation"></i>No se pudo cargar postventa</div>';
    errToast('No se pudo cargar la bandeja de postventa');
    return;
  }
  POSTVENTA = bandeja.data || [];
  renderPostventaKPIs(resumen.data || {});
  renderPostventa();
  const badge = document.getElementById('nav-postventa-count');
  const pendientes = Number(resumen.data?.total || 0);
  if (badge) { badge.textContent = pendientes; badge.style.display = pendientes > 0 ? '' : 'none'; }
}
function renderPostventaKPIs(r) {
  const cards = [
    ['Casos de postventa', fmt(r.total || 0), 'fa-handshake-angle', 'var(--blue)'],
    ['Cobros', fmt(r.cobros_pendientes || 0), 'fa-wallet', 'var(--amber)'],
    ['Documentación', fmt(r.documentacion || 0), 'fa-folder-open', 'var(--purple)'],
    ['Viajes en 14 días', fmt(r.viajes_proximos || 0), 'fa-plane-departure', 'var(--green)'],
    ['Seguimientos vencidos', fmt(r.seguimientos_vencidos || 0), 'fa-clock', '#fb7185'],
    ['Saldo por cobrar', money(r.saldo_pendiente || 0), 'fa-coins', 'var(--accent)'],
  ];
  document.getElementById('pv-kpis').innerHTML = cards.map(c => `<div class="kpi pv-kpi" style="--kc:${c[3]}"><div class="kt"><i class="fas ${c[2]}"></i>${c[0]}</div><div class="kv">${c[1]}</div></div>`).join('');
}
function renderPostventa() {
  const grid = document.getElementById('pv-grid');
  if (!POSTVENTA.length) {
    grid.innerHTML = '<div class="pv-empty"><i class="fas fa-circle-check"></i><b>Todo al día</b><br>No hay casos con este filtro</div>';
    return;
  }
  const ahora = Date.now();
  grid.innerHTML = POSTVENTA.map(c => {
    const etapa = PV_ETAPAS[c.etapa] || [c.etapa, 'fa-circle'];
    const total = Number(c.monto_total || 0), pagado = Number(c.monto_pagado || 0);
    const pct = total > 0 ? Math.min(100, Math.round(pagado / total * 100)) : 0;
    const docs = c.documentos || {}, docsListos = Object.keys(PV_DOCS).filter(k => docs[k] === true).length;
    const vencido = c.proximo_seguimiento_at && new Date(c.proximo_seguimiento_at).getTime() < ahora && c.etapa !== 'CERRADO';
    const wa = String(c.telefono || '').replace(/\D/g, '');
    return `<article class="pv-card" data-id="${c.lead_id}">
      <div class="pv-card-top"><span class="pv-chip"><i class="fas ${etapa[1]}"></i>${esc(etapa[0])}</span><span class="pv-prio ${esc(c.prioridad)}">${esc(c.prioridad)}</span></div>
      <div class="pv-name">${esc(c.nombre || 'Sin nombre')}</div><div class="pv-dest"><i class="fas fa-location-dot"></i> ${esc(c.destino || c.servicio || 'Destino sin definir')}</div>
      <div class="pv-money-row"><span>Pagado <b>${money(pagado)}</b></span><span>Saldo <b>${money(c.saldo_pendiente)}</b></span></div>
      <div class="pv-progress"><span style="width:${pct}%"></span></div>
      <div class="pv-meta"><span><i class="fas fa-calendar"></i>${c.fecha_viaje_inicio ? pvFecha(c.fecha_viaje_inicio) : 'Viaje sin fecha'}</span><span class="pv-docs"><i class="fas fa-file-circle-check"></i>${docsListos}/6 docs</span></div>
      <div class="pv-meta"><span class="${vencido ? 'overdue' : ''}"><i class="fas fa-bell"></i>${tiempoSeguimiento(c.proximo_seguimiento_at)}</span>${c.incidencia_abierta ? '<span class="overdue"><i class="fas fa-triangle-exclamation"></i>Incidencia</span>' : ''}</div>
      <div class="pv-card-foot">${wa ? `<button class="pv-btn wa" data-pv-wa="${wa}" type="button"><i class="fab fa-whatsapp"></i> WhatsApp</button>` : '<span></span>'}<button class="pv-btn primary" data-pv-open="${c.lead_id}" type="button">Gestionar <i class="fas fa-arrow-right"></i></button></div>
    </article>`;
  }).join('');
  grid.querySelectorAll('[data-pv-open]').forEach(b => b.onclick = () => abrirPostventa(POSTVENTA.find(c => c.lead_id === Number(b.dataset.pvOpen))));
  grid.querySelectorAll('[data-pv-wa]').forEach(b => b.onclick = () => window.open(`https://wa.me/${b.dataset.pvWa}`, '_blank', 'noopener'));
}
function pvFecha(iso) {
  if (!iso) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
}
function pvDateTimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function abrirPostventa(c) {
  if (!c) return; PV_ACTUAL = c;
  const opt = (obj, sel) => Object.entries(obj).map(([v, t]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${esc(Array.isArray(t) ? t[0] : t)}</option>`).join('');
  const docs = c.documentos || {};
  document.getElementById('drawerContent').innerHTML = `
    <div class="dhead"><div class="dava" style="background:var(--accent-soft);color:var(--accent)"><i class="fas fa-handshake-angle"></i></div><div><div class="dn">${esc(c.nombre)}</div><div class="dm">${esc(c.destino || c.servicio || 'Postventa')} · ${esc(c.asesor || 'Sin asignar')}</div></div></div>
    <div class="edit-box"><div class="eb-title"><i class="fas fa-route"></i> Operación</div>
      <label class="fl">Etapa</label><select class="ei" id="pv-e-etapa">${opt(PV_ETAPAS, c.etapa)}</select>
      <label class="fl">Prioridad</label><select class="ei" id="pv-e-prioridad">${opt({ BAJA:'Baja', NORMAL:'Normal', ALTA:'Alta', URGENTE:'Urgente' }, c.prioridad)}</select>
      <div class="pv-balance">Mantén el monto total y lo abonado al día. El saldo se calcula automáticamente.</div>
      <label class="fl">Monto total (USD)</label><input class="ei" id="pv-e-total" type="number" min="0" step="0.01" value="${Number(c.monto_total || 0)}">
      <label class="fl">Monto pagado (USD)</label><input class="ei" id="pv-e-pagado" type="number" min="0" step="0.01" value="${Number(c.monto_pagado || 0)}">
      <div class="eb-title" style="margin-top:17px"><i class="fas fa-plane"></i> Viaje y reserva</div>
      <label class="fl">Inicio del viaje</label><input class="ei" id="pv-e-inicio" type="date" value="${esc(c.fecha_viaje_inicio || '')}">
      <label class="fl">Fin del viaje</label><input class="ei" id="pv-e-fin" type="date" value="${esc(c.fecha_viaje_fin || '')}">
      <label class="fl">Proveedor</label><input class="ei" id="pv-e-proveedor" value="${esc(c.proveedor || '')}" placeholder="Hotel, aerolínea u operador">
      <label class="fl">Costo neto (USD) <span style="font-weight:400;color:var(--muted2)">— lo que le pagamos al proveedor</span></label><input class="ei" id="pv-e-costo-neto" type="number" min="0" step="0.01" value="${c.costo_neto ?? ''}" placeholder="Sin definir">
      <label class="fl">Localizador / reserva</label><input class="ei" id="pv-e-localizador" value="${esc(c.localizador_reserva || '')}" placeholder="Código de confirmación">
      <div class="eb-title" style="margin-top:17px"><i class="fas fa-list-check"></i> Documentos</div>
      <div class="pv-doc-grid">${Object.entries(PV_DOCS).map(([k, t]) => `<label class="pv-doc"><input type="checkbox" data-pv-doc="${k}" ${docs[k] === true ? 'checked' : ''}>${esc(t)}</label>`).join('')}</div>
      <div class="eb-title" style="margin-top:17px"><i class="fas fa-bell"></i> Seguimiento</div>
      <label class="fl">Próxima acción</label><input class="ei" id="pv-e-seguimiento" type="datetime-local" value="${pvDateTimeInput(c.proximo_seguimiento_at)}">
      <label class="fl">Satisfacción (postviaje)</label><select class="ei" id="pv-e-satisfaccion"><option value="">Sin medir</option>${[1,2,3,4,5].map(n => `<option value="${n}" ${Number(c.satisfaccion) === n ? 'selected' : ''}>${n} / 5</option>`).join('')}</select>
      <label class="pv-doc" style="margin-top:10px"><input type="checkbox" id="pv-e-incidencia" ${c.incidencia_abierta ? 'checked' : ''}>Hay una incidencia que requiere atención</label>
      <label class="fl">Notas internas</label><textarea class="ei" id="pv-e-notas" rows="4" placeholder="Acuerdos, pendientes y próximo paso...">${esc(c.notas || '')}</textarea>
      <div class="edit-err" id="pv-e-error"></div>
      <button class="dbtn save" id="pv-e-guardar" type="button"><i class="fas fa-floppy-disk"></i> Guardar postventa</button>
      ${c.estado_lead !== 'PAGO REALIZADO' ? '<button class="dbtn gh" id="pv-e-pago" type="button" style="margin-top:9px"><i class="fas fa-circle-check"></i> Registrar pago completo</button>' : ''}
    </div>`;
  document.getElementById('pv-e-guardar').onclick = () => guardarPostventa(false);
  document.getElementById('pv-e-pago')?.addEventListener('click', () => {
    document.getElementById('pv-e-pagado').value = document.getElementById('pv-e-total').value;
    guardarPostventa(true);
  });
  document.getElementById('drawer').classList.add('open'); document.getElementById('drawerBg').classList.add('open'); navPush({ type: 'drawer' });
}
async function guardarPostventa(marcarPagado) {
  if (!PV_ACTUAL) return;
  const btn = document.getElementById(marcarPagado ? 'pv-e-pago' : 'pv-e-guardar');
  const err = document.getElementById('pv-e-error');
  const total = Number(val('pv-e-total') || 0), pagado = Number(val('pv-e-pagado') || 0);
  const inicio = val('pv-e-inicio') || null, fin = val('pv-e-fin') || null;
  const costoNetoRaw = val('pv-e-costo-neto');
  const costoNeto = costoNetoRaw === '' ? null : Number(costoNetoRaw);
  if (total < 0 || pagado < 0 || pagado > total) { err.textContent = 'El monto pagado no puede superar el total.'; return; }
  if (costoNeto !== null && costoNeto < 0) { err.textContent = 'El costo neto no puede ser negativo.'; return; }
  if (marcarPagado && total <= 0) { err.textContent = 'Define un monto total mayor a cero antes de registrar el pago.'; return; }
  if (inicio && fin && fin < inicio) { err.textContent = 'La fecha de fin no puede ser anterior al inicio.'; return; }
  const documentos = {}; document.querySelectorAll('[data-pv-doc]').forEach(x => documentos[x.dataset.pvDoc] = x.checked);
  const seguimiento = val('pv-e-seguimiento');
  err.textContent = ''; btn.disabled = true; const previo = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  const { data, error } = await sb.rpc('guardar_postventa', {
    p_lead_id: PV_ACTUAL.lead_id, p_etapa: val('pv-e-etapa'), p_prioridad: val('pv-e-prioridad'),
    p_monto_total: total, p_monto_pagado: pagado, p_fecha_viaje_inicio: inicio, p_fecha_viaje_fin: fin,
    p_proveedor: val('pv-e-proveedor').trim() || null, p_localizador_reserva: val('pv-e-localizador').trim() || null,
    p_documentos: documentos, p_proximo_seguimiento_at: seguimiento ? new Date(seguimiento).toISOString() : null,
    p_notas: val('pv-e-notas').trim() || null, p_incidencia_abierta: document.getElementById('pv-e-incidencia').checked,
    p_satisfaccion: val('pv-e-satisfaccion') ? Number(val('pv-e-satisfaccion')) : null, p_marcar_pagado: marcarPagado,
    p_costo_neto: costoNeto,
  });
  btn.disabled = false; btn.innerHTML = previo;
  if (error || !data?.ok) { err.textContent = 'No se pudo guardar: ' + (error?.message || data?.error || 'error desconocido'); return; }
  window.closeDrawer();
  // Si lo cerró un asesor, guardar_postventa lo manda a verificación en vez
  // de a PAGO REALIZADO directo (ver 20260728000000_blindar_cierre_venta.sql)
  // -- avisar con un toast distinto para que no piense que ya generó factura.
  const pendienteVerificar = data.estado_lead === 'VENTA PENDIENTE DE VERIFICAR';
  okToast(!marcarPagado ? 'Postventa actualizada' : pendienteVerificar ? 'Enviado a verificar -- un admin tiene que confirmarlo' : 'Pago registrado y postventa actualizada');
  await Promise.all([loadPostventa(), loadStats()]); renderAll();
}

function renderAdvisors(datosPeriodo) {
  const src = datosPeriodo || STATS.by_advisor;
  const e = sortEntries(src), max = Math.max(...e.map(x => x[1]), 1);
  aseAbierto = null;
  const filaHistorico = datosPeriodo ? '' : `<div class="arow" style="opacity:.6"><div class="ava" style="background:#39415c">H</div><div class="ai"><div class="an"><span>Históricos / inactivos</span><span class="anv">${fmt(STATS.historico_inactivo)} leads</span></div><div class="track"><div class="fill" style="width:100%;background:#39415c"></div></div></div></div>`;
  document.getElementById('advList').innerHTML = e.map(([name, v], i) => { const c = ADV_COLORS[i % ADV_COLORS.length]; return `<div class="arow adv-click" data-adv="${esc(name)}"><div class="ava" style="background:${c}">${initials(name)}</div><div class="ai"><div class="an"><span>${esc(name)}</span><span class="anv">${fmt(v)} leads</span></div><div class="track"><div class="fill" style="width:${(v / max) * 100}%;background:${c}"></div></div></div><i class="fas fa-chevron-right arow-chev"></i></div>`; }).join('') + filaHistorico;
  document.querySelectorAll('.adv-click').forEach(el => el.onclick = () => toggleAsesorLeads(el, el.dataset.adv));
  document.querySelector('#advList').closest('.card').querySelector('.csub').textContent = datosPeriodo ? `Toca un asesor para ver sus leads · ${e.length} con actividad en el periodo` : `Toca un asesor para ver sus leads · ${e.length} activos`;
}

/* ---------- Lista de leads individuales por asesor (expandible, dentro de Asesores) ---------- */
let aseAbierto = null;
async function toggleAsesorLeads(rowEl, nombre) {
  const yaAbierto = rowEl.classList.contains('expanded');
  if (aseAbierto && aseAbierto !== rowEl) {
    aseAbierto.classList.remove('expanded');
    aseAbierto.nextElementSibling?.classList.contains('al-panel') && aseAbierto.nextElementSibling.remove();
  }
  if (yaAbierto) {
    rowEl.classList.remove('expanded');
    rowEl.nextElementSibling?.classList.contains('al-panel') && rowEl.nextElementSibling.remove();
    aseAbierto = null;
    return;
  }
  rowEl.classList.add('expanded');
  aseAbierto = rowEl;
  const panel = document.createElement('div');
  panel.className = 'al-panel';
  panel.innerHTML = '<div class="al-state"><i class="fas fa-spinner fa-spin"></i> Cargando leads...</div>';
  rowEl.insertAdjacentElement('afterend', panel);
  await renderAsesorLeads(panel, nombre);
}
// Día/Semana: recién llegados primero (orden inverso). Mes/Año/Histórico: orden
// cronológico normal — se piden los 40 más recientes y, en ese caso, se
// invierten para mostrarlos del más viejo al más nuevo dentro de esa ventana.
async function renderAsesorLeads(panel, nombre) {
  let q = sb.from('leads').select('id,nombre,telefono,fecha_creacion,estado,destino').eq('asesor', nombre).order('fecha_creacion', { ascending: false }).limit(40);
  if (asePeriodo !== 'historico') {
    const [d, h] = periodo(asePeriodo);
    q = q.gte('fecha_creacion', iso(d)).lt('fecha_creacion', iso(h));
  }
  const { data, error } = await q;
  if (!panel.isConnected) return;
  if (error) { panel.innerHTML = '<div class="al-state">No se pudieron cargar los leads</div>'; return; }
  let rows = data || [];
  if (!rows.length) { panel.innerHTML = '<div class="al-state">Sin leads en este periodo</div>'; return; }
  if (asePeriodo === 'mes' || asePeriodo === 'anio' || asePeriodo === 'historico') rows = rows.slice().reverse();
  panel.innerHTML = rows.map(l => {
    const av = clientAvatar(l);
    // Forzado a America/Caracas (no al huso horario del navegador/dispositivo)
    // -- ver fmtFechaHoraCaracas, mismo bug real de horas corridas.
    const fechaTxt = l.fecha_creacion ? fmtFechaHoraCaracas(l.fecha_creacion).replace(' ', ' · ') : '—';
    const col = ESTADO_COLORS[l.estado] || '#5f677f';
    return `<div class="al-row"><div class="al-ava" style="background:${av.color}22;color:${av.color}"><i class="fas ${av.icon}"></i></div><div class="al-info"><div class="al-nombre">${esc(l.nombre)}</div><div class="al-meta">${esc(l.destino || 'Sin destino')}</div></div><div class="al-right"><span class="al-badge" style="background:${col}22;color:${col}">${esc(niceEstado(l.estado))}</span><div class="al-fecha">${fechaTxt}</div></div></div>`;
  }).join('') + `<a class="al-more">Ver todos en Leads <i class="fas fa-arrow-right"></i></a>`;
  panel.querySelector('.al-more').onclick = () => chartPreview('asesor', nombre, nombre, 'fa-user-tie', rows.length);
}

/* ---------- Filtros de periodo en Asesores ---------- */
let asePeriodo = 'semana';
function setupAsesoresPeriodo() {
  document.querySelectorAll('#ase-periodo .seg').forEach(b => b.onclick = () => {
    if ((repartoDirty.domestico || repartoDirty.internacional) && !confirm('Hay cambios sin guardar en el reparto. ¿Cambiar de periodo de todas formas?')) return;
    document.querySelectorAll('#ase-periodo .seg').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); asePeriodo = b.dataset.p; loadAsesoresPeriodo();
  });
}
async function loadAsesoresPeriodo() {
  if (asePeriodo === 'historico') { renderAdvisors(); }
  else {
    const [d, h] = periodo(asePeriodo);
    const { data, error } = await sb.rpc('carga_asesores', { p_desde: iso(d), p_hasta: iso(h) });
    if (error) { console.error(error); errToast('No se pudo cargar la carga por asesor'); }
    else renderAdvisors(data || {});
  }
  cargarRendimientoAsesores();
  cargarReparto();
}

/* ---------- Rendimiento por asesor: % perdido por timeout + opinión calculada ---------- */
// Sin llamar a un modelo -- frase armada por reglas sobre el % real contra el
// promedio del equipo en el mismo periodo. Pedido explícito del dueño
// (2026-08-06): más rápido, sin costo, y se actualiza al instante.
function opinionAsesor(pct, promedio) {
  if (pct === 0) return 'Sin pérdidas por timeout en el periodo.';
  if (pct > promedio * 2) return 'Rebote elevado -- revisar disponibilidad.';
  if (pct > promedio) return 'Por encima del resto del equipo.';
  return 'Dentro de lo normal.';
}
function colorPctPerdido(pct) {
  if (pct > 30) return '#ef4444';
  if (pct > 15) return '#f5b544';
  return '#10b981';
}
async function cargarRendimientoAsesores() {
  const box = document.getElementById('rendList');
  if (!box) return;
  let desde = null, hasta = null;
  if (asePeriodo !== 'historico') { const [d, h] = periodo(asePeriodo); desde = iso(d); hasta = iso(h); }
  const { data, error } = await sb.rpc('rendimiento_asesores', { p_desde: desde, p_hasta: hasta });
  if (error) { console.error(error); box.innerHTML = '<div class="muted" style="font-size:12.5px">No se pudo cargar el rendimiento</div>'; return; }
  renderRendimiento(data || {});
}
function renderRendimiento(datos) {
  const box = document.getElementById('rendList');
  if (!box) return;
  const entries = Object.entries(datos).filter(([, v]) => v.asignados + v.perdidos > 0);
  if (!entries.length) { box.innerHTML = '<div class="muted" style="font-size:12.5px">Sin actividad en el periodo</div>'; return; }
  const promedio = entries.reduce((s, [, v]) => s + v.pct_perdido, 0) / entries.length;
  entries.sort((a, b) => b[1].pct_perdido - a[1].pct_perdido);
  box.innerHTML = entries.map(([nombre, v]) => {
    const c = colorPctPerdido(v.pct_perdido);
    const chips = (v.top_destinos_perdidos || []).map(d => `<span class="destchip">${esc(d.destino)} (${d.c})</span>`).join('');
    return `<div class="arow"><div class="ava" style="background:${c}">${initials(nombre)}</div><div class="ai">
      <div class="an"><span>${esc(nombre)}</span><span class="anv">${v.pct_perdido}% perdido</span></div>
      <div class="track"><div class="fill" style="width:${Math.min(v.pct_perdido, 100)}%;background:${c}"></div></div>
      <div class="op">${v.asignados} asignados, ${v.perdidos} perdidos por timeout -- ${opinionAsesor(v.pct_perdido, promedio)}</div>
      ${chips ? `<div class="destchips">${chips}</div>` : ''}
    </div></div>`;
  }).join('');
}

/* ---------- Reparto objetivo: editor de pesos que siempre suma 100% ----------
   Dos pools independientes (domestico/internacional), auto-balance en vivo
   (mover una barra reajusta proporcionalmente al resto, salvo los fijados con
   candado), y guardado atómico vía admin_guardar_reparto -- reemplazó al
   guardado de a uno (admin_actualizar_peso_asesor) porque no garantizaba que
   la suma diera 100 ni reseteaba el estado del round-robin. */
let repartoPool = 'domestico';
let repartoAsesores = []; // todos los activos: {nombre, peso_asignacion, peso_internacional}
let repartoDraft = { domestico: [], internacional: [] }; // [{nombre, peso, fijo}]
let repartoDirty = { domestico: false, internacional: false };

function draftDesdeAsesores(pool) {
  const col = pool === 'domestico' ? 'peso_asignacion' : 'peso_internacional';
  return repartoAsesores.filter(a => a[col] !== null).map(a => ({ nombre: a.nombre, peso: Number(a[col]), fijo: false }));
}
async function cargarReparto() {
  const box = document.getElementById('repRows');
  if (!box) return;
  const { data, error } = await sb.from('asesores').select('nombre,peso_asignacion,peso_internacional').eq('activo', true).order('nombre');
  if (error) { box.innerHTML = '<div class="muted" style="font-size:12.5px">No se pudo cargar</div>'; return; }
  repartoAsesores = data || [];
  repartoDraft.domestico = draftDesdeAsesores('domestico');
  repartoDraft.internacional = draftDesdeAsesores('internacional');
  repartoDirty.domestico = false; repartoDirty.internacional = false;
  renderReparto();
}
function repartoSuma(pool) { return repartoDraft[pool].reduce((s, a) => s + a.peso, 0); }

// Auto-balance: clampea el valor editado al espacio libre (100 - fijados) y
// reparte el resto proporcionalmente entre los no fijados distintos del
// editado, redondeando por mayor residuo para que la suma quede exacta en 100.
function rebalancear(pool, indice, nuevoValor) {
  const filas = repartoDraft[pool];
  const fila = filas[indice];
  const sumaFijos = filas.reduce((s, a, i) => s + (i !== indice && a.fijo ? a.peso : 0), 0);
  const libre = Math.max(0, 100 - sumaFijos);
  const valor = Math.max(0, Math.min(nuevoValor, libre));
  const ajustables = filas.map((a, i) => i).filter(i => i !== indice && !filas[i].fijo);
  const restante = libre - valor;

  if (!ajustables.length) { fila.peso = libre; return; }

  const sumaAjustablesActual = ajustables.reduce((s, i) => s + filas[i].peso, 0);
  const brutos = ajustables.map(i => {
    const proporcion = sumaAjustablesActual > 0 ? filas[i].peso / sumaAjustablesActual : 1 / ajustables.length;
    return { i, exacto: restante * proporcion };
  });
  let asignado = 0;
  brutos.forEach(b => { const piso = Math.floor(b.exacto); filas[b.i].peso = piso; asignado += piso; });
  let sobrante = restante - asignado;
  brutos.sort((a, b) => (b.exacto - Math.floor(b.exacto)) - (a.exacto - Math.floor(a.exacto)));
  for (const b of brutos) { if (sobrante <= 0) break; filas[b.i].peso += 1; sobrante--; }
  fila.peso = valor;
}
function repartoQuitar(pool, indice) {
  const filas = repartoDraft[pool];
  if (filas.length <= 1) { errToast('Un reparto no puede quedar vacío'); return; }
  const liberado = filas[indice].peso;
  filas.splice(indice, 1);
  const destino = filas.findIndex(a => !a.fijo);
  if (liberado > 0 && destino !== -1) rebalancear(pool, destino, filas[destino].peso + liberado);
  repartoDirty[pool] = true;
  renderReparto();
}
function repartoAgregar(pool, nombre) {
  const filas = repartoDraft[pool];
  if (!filas.length) { filas.push({ nombre, peso: 100, fijo: false }); }
  else { filas.push({ nombre, peso: 0, fijo: false }); }
  repartoDirty[pool] = true;
  renderReparto();
}
function repartoBarHtml(pool) {
  const filas = repartoDraft[pool];
  return filas.map((a, i) => `<span style="flex-grow:${Math.max(a.peso, 0.01)};background:${ADV_COLORS[i % ADV_COLORS.length]}" title="${esc(a.nombre)}: ${a.peso}%"></span>`).join('');
}
function repartoRowHtml(pool, a, i) {
  const c = ADV_COLORS[i % ADV_COLORS.length];
  return `<div class="rep-row" data-i="${i}">
    <span class="rep-dot" style="background:${c}"></span>
    <span class="rep-nombre" title="${esc(a.nombre)}">${esc(a.nombre)}</span>
    <input type="range" min="0" max="100" step="1" value="${a.peso}" ${a.fijo ? 'disabled' : ''} data-rep-slider>
    <div class="rep-actions-row">
      <span class="rep-num"><input type="number" min="0" max="100" step="1" value="${a.peso}" ${a.fijo ? 'disabled' : ''} data-rep-num><span class="rep-pct">%</span></span>
      <button type="button" class="${a.fijo ? 'on' : ''}" data-rep-fijo title="${a.fijo ? 'Desbloquear' : 'Fijar (no se mueve al reajustar)'}"><i class="fas fa-${a.fijo ? 'lock' : 'lock-open'}"></i></button>
      <button type="button" class="rep-quitar" data-rep-quitar title="Quitar del reparto"><i class="fas fa-xmark"></i></button>
    </div>
  </div>`;
}
function renderReparto() {
  const rowsBox = document.getElementById('repRows');
  const barBox = document.getElementById('repBar');
  const totalChip = document.getElementById('repTotal');
  const saveWrap = document.getElementById('repGuardarWrap');
  const selectAgregar = document.getElementById('repAgregar');
  if (!rowsBox) return;
  const filas = repartoDraft[repartoPool];

  rowsBox.innerHTML = filas.map((a, i) => repartoRowHtml(repartoPool, a, i)).join('') || '<div class="muted" style="font-size:12.5px">Sin asesores en este reparto</div>';
  barBox.innerHTML = repartoBarHtml(repartoPool);
  const total = repartoSuma(repartoPool);
  totalChip.textContent = total + '%';
  totalChip.className = 'rep-total ' + (total === 100 ? 'ok' : 'bad');
  saveWrap.style.display = repartoDirty[repartoPool] ? 'flex' : 'none';

  const col = repartoPool === 'domestico' ? 'peso_asignacion' : 'peso_internacional';
  const enPool = new Set(filas.map(f => f.nombre));
  const disponibles = repartoAsesores.filter(x => x[col] === null && !enPool.has(x.nombre));
  selectAgregar.innerHTML = '<option value="">+ Añadir asesor…</option>' + disponibles.map(x => `<option value="${esc(x.nombre)}">${esc(x.nombre)}</option>`).join('');

  rowsBox.querySelectorAll('[data-rep-slider]').forEach(el => el.oninput = () => {
    const i = Number(el.closest('.rep-row').dataset.i);
    rebalancear(repartoPool, i, Number(el.value));
    repartoDirty[repartoPool] = true;
    renderReparto();
  });
  rowsBox.querySelectorAll('[data-rep-num]').forEach(el => el.onchange = () => {
    const i = Number(el.closest('.rep-row').dataset.i);
    rebalancear(repartoPool, i, Number(el.value) || 0);
    repartoDirty[repartoPool] = true;
    renderReparto();
  });
  rowsBox.querySelectorAll('[data-rep-fijo]').forEach(el => el.onclick = () => {
    const i = Number(el.closest('.rep-row').dataset.i);
    repartoDraft[repartoPool][i].fijo = !repartoDraft[repartoPool][i].fijo;
    renderReparto();
  });
  rowsBox.querySelectorAll('[data-rep-quitar]').forEach(el => el.onclick = () => {
    const i = Number(el.closest('.rep-row').dataset.i);
    repartoQuitar(repartoPool, i);
  });
}
function setupReparto() {
  document.querySelectorAll('#repPool .seg').forEach(b => b.onclick = () => {
    if (repartoPool === b.dataset.pool) return;
    if (repartoDirty[repartoPool] && !confirm('Hay cambios sin guardar en este reparto. ¿Cambiar de pestaña de todas formas?')) return;
    repartoPool = b.dataset.pool;
    document.querySelectorAll('#repPool .seg').forEach(x => x.classList.toggle('on', x === b));
    renderReparto();
  });
  document.getElementById('repAgregar')?.addEventListener('change', e => {
    if (e.target.value) { repartoAgregar(repartoPool, e.target.value); e.target.value = ''; }
  });
  document.getElementById('repDescartar')?.addEventListener('click', () => {
    repartoDraft[repartoPool] = draftDesdeAsesores(repartoPool);
    repartoDirty[repartoPool] = false;
    renderReparto();
  });
  document.getElementById('repGuardar')?.addEventListener('click', guardarReparto);
}
async function guardarReparto() {
  const pool = repartoPool;
  const total = repartoSuma(pool);
  if (total !== 100) { errToast('El reparto tiene que sumar 100% (va en ' + total + '%)'); return; }
  const btn = document.getElementById('repGuardar');
  btn.disabled = true;
  const p_pesos = repartoDraft[pool].map(a => ({ nombre: a.nombre, peso: a.peso }));
  const { data, error } = await sb.rpc('admin_guardar_reparto', { p_pool: pool, p_pesos });
  btn.disabled = false;
  if (error || !data?.ok) {
    const msgs = { pool_vacio: 'El reparto no puede quedar vacío', suma_invalida: 'La suma no dio 100%', peso_invalido: 'Hay un peso inválido', no_existe: 'Algún asesor ya no existe o está inactivo', pool_invalido: 'Pool inválido' };
    errToast('No se pudo guardar: ' + (msgs[data?.error] || data?.error || error?.message || ''));
    return;
  }
  okToast('Reparto guardado');
  await cargarReparto();
}

/* ---------- Preview + Drill ---------- */
function chartPreview(type, key, label, icon, count) {
  if (previewSel && previewSel.type === type && previewSel.key === key) { enterDrill(type, key); return; }
  previewSel = { type, key };
  const p = document.getElementById('preview-pill');
  p.innerHTML = `<div class="pp-info"><i class="fas ${icon}"></i><div><div class="pp-label">${esc(label)}</div><div class="pp-count">${fmt(count)} leads</div></div></div><button class="pp-btn">Ver leads <i class="fas fa-arrow-right"></i></button><button class="pp-close"><i class="fas fa-times"></i></button>`;
  p.classList.add('show');
  p.querySelector('.pp-btn').onclick = () => enterDrill(type, key);
  p.querySelector('.pp-close').onclick = () => { previewSel = null; p.classList.remove('show'); if (type === 'month') renderTrend(); };
  if (type === 'month') renderTrend();
}
function enterDrill(type, key) { previewSel = null; document.getElementById('preview-pill').classList.remove('show'); ({ month: drillMonth, canal: drillCanal, estado: drillEstado, asesor: drillAsesor, destino: drillDestino }[type])(key); }
function clearFiltersQuiet() { ['f-canal', 'f-estado', 'f-asesor', 'f-anio', 'f-servicio'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); document.getElementById('global-search').value = ''; activeMonth = null; activeDestino = null; }
function drillTo(apply) { clearFiltersQuiet(); apply(); activateSection('leads'); page = 1; loadTable(); renderChips(); }
const drillMonth = m => drillTo(() => { activeMonth = m; });
const drillCanal = c => drillTo(() => { document.getElementById('f-canal').value = c; });
const drillEstado = e => drillTo(() => { document.getElementById('f-estado').value = e; });
const drillAsesor = a => drillTo(() => { document.getElementById('f-asesor').value = a; });
const drillDestino = d => drillTo(() => { activeDestino = d; });
const drillAnio = y => drillTo(() => { document.getElementById('f-anio').value = y; });
const drillClear = () => drillTo(() => { });

/* ---------- Filtros + Tabla ---------- */
function setupFilters() {
  fill('f-canal', Object.keys(STATS.by_canal || {}));
  fill('f-estado', ESTADOS);
  fill('f-asesor', ACTIVOS.concat(['Sin asignar']));
  fill('f-servicio', SERVICIOS);
  fill('f-anio', Object.keys(STATS.by_anio || {}).sort().reverse());
  ['f-canal', 'f-estado', 'f-asesor', 'f-anio', 'f-servicio', 'f-desde', 'f-hasta'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('change', () => { page = 1; loadTable(); renderChips(); }); });
  let deb; document.getElementById('global-search').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => { page = 1; loadTable(); renderChips(); }, 300); });
  initDateRangePicker('f');
  leadsView = initViewSwitcher('leads-view-switch', 'leads', 'tarjetas', v => { leadsView = v; applyLeadsView(); });
}

/* ---------- Selector de rango de fechas (Leads + Reasignaciones) ---------- */
function initDateRangePicker(prefix) {
  const btn = document.getElementById(`drp-${prefix}-btn`);
  const panel = document.getElementById(`drp-${prefix}-panel`);
  const label = document.getElementById(`drp-${prefix}-label`);
  const desde = document.getElementById(`${prefix}-desde`);
  const hasta = document.getElementById(`${prefix}-hasta`);
  const fmtCorta = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y.slice(2)}`; };
  const updateLabel = () => {
    if (desde.value && hasta.value) label.textContent = `${fmtCorta(desde.value)} – ${fmtCorta(hasta.value)}`;
    else if (desde.value) label.textContent = `Desde ${fmtCorta(desde.value)}`;
    else if (hasta.value) label.textContent = `Hasta ${fmtCorta(hasta.value)}`;
    else label.textContent = 'Rango de fechas';
  };
  btn.onclick = e => { e.stopPropagation(); panel.classList.toggle('open'); };
  document.addEventListener('click', e => { if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open'); });
  [desde, hasta].forEach(el => el.addEventListener('change', updateLabel));
  panel.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
    const hoy = new Date(); const iso = d => d.toISOString().slice(0, 10);
    const preset = b.dataset.preset;
    if (preset === 'todo') { desde.value = ''; hasta.value = ''; }
    else if (preset === 'hoy') { desde.value = iso(hoy); hasta.value = iso(hoy); }
    else if (preset === '7d') { desde.value = iso(addD(hoy, -6)); hasta.value = iso(hoy); }
    else if (preset === 'mes') { desde.value = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); hasta.value = iso(hoy); }
    else if (preset === 'anio') { desde.value = iso(new Date(hoy.getFullYear(), 0, 1)); hasta.value = iso(hoy); }
    desde.dispatchEvent(new Event('change'));
    updateLabel();
    panel.classList.remove('open');
  });
  updateLabel();
}
function fill(id, arr) { const s = document.getElementById(id); if (!s) return; [...s.querySelectorAll('option:not([value=""])')].forEach(o => o.remove()); arr.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = niceEstado(v); s.appendChild(o); }); }

/* ---------- Selector de vista estándar (fichas / tarjetas / lista) ---------- */
const VISTAS_BTN = {
  fichas: ['fa-id-card', 'Vista de fichas'],
  tarjetas: ['fa-table-cells-large', 'Vista de tarjetas'],
  lista: ['fa-list', 'Vista de lista'],
  // Solo Stop Sales: "qué pasa tal día" vs "cómo está tal hotel".
  calendario: ['fa-calendar-days', 'Vista de calendario'],
  hoteles: ['fa-hotel', 'Vista por hotel'],
};
// `vistas` permite que cada sección ofrezca solo las que tienen sentido para
// ella (Postulaciones no tiene vista de fichas, por ejemplo).
function initViewSwitcher(containerId, key, defaultView, onChange, vistas = ['fichas', 'tarjetas', 'lista']) {
  const bar = document.getElementById(containerId);
  const guardada = localStorage.getItem('view_' + key);
  const saved = vistas.includes(guardada) ? guardada : defaultView;
  if (!bar) return saved;
  bar.innerHTML = vistas.map(v => `<button class="vs-btn" data-v="${v}" title="${VISTAS_BTN[v][1]}"><i class="fas ${VISTAS_BTN[v][0]}"></i></button>`).join('');
  const setActive = v => bar.querySelectorAll('.vs-btn').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  setActive(saved);
  bar.querySelectorAll('.vs-btn').forEach(b => b.onclick = () => {
    localStorage.setItem('view_' + key, b.dataset.v);
    setActive(b.dataset.v);
    onChange(b.dataset.v);
  });
  return saved;
}

function renderChips() {
  const box = document.getElementById('active-filters'); if (!box) return;
  const chips = [];
  const push = (label, clr) => chips.push([label, clr]);
  if (val('f-canal')) push('Canal: ' + val('f-canal'), () => setDrop('f-canal', ''));
  if (val('f-estado')) push('Estado: ' + niceEstado(val('f-estado')), () => setDrop('f-estado', ''));
  if (val('f-asesor')) push('Asesor: ' + val('f-asesor'), () => setDrop('f-asesor', ''));
  if (val('f-servicio')) push('Servicio: ' + val('f-servicio'), () => setDrop('f-servicio', ''));
  if (val('f-anio')) push('Año: ' + val('f-anio'), () => setDrop('f-anio', ''));
  if (val('f-desde')) push('Desde: ' + val('f-desde'), () => setDrop('f-desde', ''));
  if (val('f-hasta')) push('Hasta: ' + val('f-hasta'), () => setDrop('f-hasta', ''));
  if (activeMonth) push('Mes: ' + fullMonth(activeMonth), () => { activeMonth = null; refresh(); });
  if (activeDestino) push('Destino: ' + activeDestino, () => { activeDestino = null; refresh(); });
  const qs = val('global-search').trim(); if (qs) push('Buscar: ' + qs, () => { document.getElementById('global-search').value = ''; refresh(); });
  // En móvil el botón de filtros es solo un ícono: sin este puntito no habría
  // forma de saber que hay filtros puestos sin abrir la hoja.
  document.getElementById('leads-mfs-trigger')?.classList.toggle('con-filtros', chips.length > 0);
  if (!chips.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<span class="chips-label">Filtros:</span>` + chips.map((c, i) => `<span class="fchip">${esc(c[0])} <b data-ci="${i}">✕</b></span>`).join('') + `<button class="clear-all" id="clearAll"><i class="fas fa-times"></i> Limpiar</button>`;
  chips.forEach((c, i) => box.querySelector(`b[data-ci="${i}"]`).onclick = c[1]);
  document.getElementById('clearAll').onclick = () => { clearFiltersQuiet(); refresh(); };
}
function setDrop(id, v) { const el = document.getElementById(id); el.value = v; if (id.endsWith('-desde') || id.endsWith('-hasta')) el.dispatchEvent(new Event('change')); refresh(); }
function refresh() { page = 1; loadTable(); renderChips(); }
document.getElementById('leads-reload-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('leads-reload-btn');
  btn.disabled = true; const html0 = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recargar';
  await loadTable();
  btn.disabled = false; btn.innerHTML = html0;
});

// Las posadas interesadas en el asistente comparten tabla con los clientes de
// viaje, pero no son lo mismo y no se trabajan igual. La RLS ya se las esconde
// a los asesores (entran sin asesor); acá se excluyen también para el admin,
// que sí las vería, y viven en su propia sección: IA Atención al Cliente.
const SERVICIO_POSADA_IA = 'Asistente IA (posada)';

function buildQuery(forCount) {
  let q = sb.from('leads').select('*', forCount ? { count: 'exact' } : {})
    // El valor va entre comillas porque tiene paréntesis y espacios, que
    // PostgREST usa como sintaxis dentro de un `or`. La rama `is.null` hace
    // falta porque `neq` sobre un NULL da NULL y escondería esos leads.
    .is('eliminado_at', null).or(`servicio.is.null,servicio.neq."${SERVICIO_POSADA_IA}"`);
  const fc = val('f-canal'), fe = val('f-estado'), fa = val('f-asesor'), fy = val('f-anio'), fs = val('f-servicio'), fd = val('f-desde'), fh = val('f-hasta'), qs = val('global-search').trim();
  if (fc) q = q.eq('canal', fc);
  if (fe) q = q.eq('estado', fe);
  if (fa) q = q.eq('asesor', fa);
  if (fy) q = q.eq('anio', +fy);
  if (fs) q = q.eq('servicio', fs);
  if (fd) q = q.gte('fecha_creacion', fd);
  if (fh) q = q.lte('fecha_creacion', fh + 'T23:59:59');
  if (activeDestino) q = q.ilike('destino', `%${activeDestino}%`);
  if (activeMonth) { const [y, m] = activeMonth.split('-').map(Number); const nm = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; q = q.gte('fecha_creacion', activeMonth + '-01').lt('fecha_creacion', nm + '-01'); }
  if (qs) { const qsSafe = qs.replace(/[,()%]/g, ''); q = q.or(`nombre.ilike.%${qsSafe}%,telefono.ilike.%${qsSafe}%`); }
  return q;
}
async function loadTable() {
  const gen = ++genCarga;
  const loading = document.getElementById('tbl-loading'), empty = document.getElementById('tbl-empty'), wrap = document.getElementById('tbl-wrap');
  empty.classList.remove('show'); loading.classList.add('show'); wrap.style.opacity = '.4';
  const from = (page - 1) * PER;
  const { data, count, error } = await buildQuery(true).order('fecha_creacion', { ascending: false, nullsFirst: false }).range(from, from + PER - 1);
  if (gen !== genCarga) return;
  loading.classList.remove('show'); wrap.style.opacity = '1';
  if (error) { console.error(error); errToast('No se pudieron cargar los leads'); return; }
  totalFiltered = count ?? 0;
  document.getElementById('t-count').textContent = `${fmt(totalFiltered)} leads`;
  if (!data.length) { empty.classList.add('show'); document.getElementById('tbody').innerHTML = ''; document.getElementById('leads-cards').innerHTML = ''; document.getElementById('pager').innerHTML = ''; return; }
  document.getElementById('tbody').innerHTML = data.map(l => {
    const cc = CANAL_CLASS[l.canal] ?? '', wa = l.telefono ? l.telefono.replace(/\D/g, '') : '', av = clientAvatar(l);
    return `<tr>
      <td class="solo-admin-borrar"><input type="checkbox" class="lead-check" data-id="${l.id}" ${SELECTED_LEADS.has(l.id) ? 'checked' : ''}></td>
      <td class="td-name"><div class="lead-name"><div class="ln-ava" style="background:${av.color}22;color:${av.color}"><i class="fas ${av.icon}"></i></div>${esc(l.nombre)}${badgePrioridadIA(l)}${badgeNombreDudoso(l)}${badgeLeadRescatado(l)}${badgeContactoDirecto(l)}${l.es_prueba ? ' <span class="chip-prueba">PRUEBA</span>' : ''}</div></td>
      <td data-label="Teléfono" class="muted">${textoTelefonoLead(l)}${l.requiere_revision_telefono ? ' <i class="fas fa-flag" style="color:#ef4444" title="Número marcado para revisión"></i>' : ''}${l.telefono_colision_revision ? ' <i class="fas fa-triangle-exclamation" style="color:#f59e0b" title="Este teléfono coincide con otro lead abierto -- revisar antes de fusionar"></i>' : ''}</td>
      <td data-label="Destino">${esc(l.destino)}</td>
      <td data-label="Canal"><span class="chip ${cc}">${esc(l.canal)}</span></td>
      <td data-label="Asesor">${l.asesor_activo ? esc(l.asesor) : '<span class="muted">' + esc(l.asesor) + '</span>'}</td>
      <td data-label="Estado"><span class="badge-st" style="color:${ESTADO_COLORS[l.estado] || '#8b93ad'};background:${(ESTADO_COLORS[l.estado] || '#8b93ad')}2e">${esc(niceEstado(l.estado))}</span></td>
      <td data-label="Fecha" class="muted">${l.fecha_creacion ? l.fecha_creacion.slice(0, 10) : '—'}</td>
      <td class="td-wa">${wa ? `<a class="wa-btn" href="https://wa.me/${wa}" target="_blank" title="Abrir WhatsApp" aria-label="Abrir WhatsApp" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i></a>` : '<span class="muted">—</span>'}</td>
    </tr>`;
  }).join('');
  [...document.querySelectorAll('#tbody tr')].forEach((tr, i) => tr.addEventListener('click', () => openDrawer(data[i])));
  const cardsEl = document.getElementById('leads-cards');
  cardsEl.innerHTML = data.map(leadCardHtml).join('');
  // Entrada escalonada (Fase 6) SOLO en esta carga completa -- se saca la
  // clase después de que termina la última tarjeta con delay (12 * 40ms +
  // duración) para que un parche en vivo posterior (parcharLeadLive) no la
  // vuelva a disparar sobre una tarjeta que solo cambió de estado.
  cardsEl.classList.add('entrada-lista');
  clearTimeout(cardsEl._entradaLista);
  cardsEl._entradaLista = setTimeout(() => cardsEl.classList.remove('entrada-lista'), 800);
  // Caché de la página para resolver el lead al soltarlo en una pestaña
  // (arrastrar-y-soltar). Se rearma en cada render.
  LEADS_PAGINA = {};
  data.forEach(l => { LEADS_PAGINA[l.id] = l; });
  const dndDesktop = window.matchMedia('(min-width:761px)').matches;
  [...document.querySelectorAll('#leads-cards .entity-card')].forEach((el, i) => {
    el.addEventListener('click', () => openDrawer(data[i]));
    if (dndDesktop && (ROL === 'asesor' || ROL === 'admin')) wireLeadDrag(el, data[i].id);
    el.querySelectorAll('.estado-arrow').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      moverEstadoLead(data[i], Number(btn.dataset.dir));
    }));
    el.querySelector('[data-atender-id]')?.addEventListener('click', e => {
      e.stopPropagation();
      atenderInboxLead(data[i]);
    });
    el.querySelector('[data-facturar-id]')?.addEventListener('click', e => {
      e.stopPropagation();
      abrirEnviarFacturacionSheet(data[i]);
    });
  });
  wireLeadChecks();
  document.querySelectorAll('.solo-admin-borrar').forEach(el => el.style.display = ROL === 'admin' ? '' : 'none');
  applyLeadsView();
  renderPager(Math.max(Math.ceil(totalFiltered / PER), 1));
}
let colaLeadsLive = new Map(), timerLeadsLive = null, inicioLoteLeads = 0, loteLeadsEnCurso = Promise.resolve(), genLeadLive = new Map();
function wireLeadCardLive(el, lead) {
  el.addEventListener('click', () => openDrawer(lead));
  if (window.matchMedia('(min-width:761px)').matches && (ROL === 'asesor' || ROL === 'admin')) wireLeadDrag(el, lead.id);
  el.querySelectorAll('.estado-arrow').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); moverEstadoLead(lead, Number(btn.dataset.dir)); }));
  el.querySelector('[data-atender-id]')?.addEventListener('click', e => { e.stopPropagation(); atenderInboxLead(lead); });
  el.querySelector('[data-facturar-id]')?.addEventListener('click', e => { e.stopPropagation(); abrirEnviarFacturacionSheet(lead); });
}
function mostrarLeadsNuevos(n) {
  if (!window.matchMedia('(max-width:760px)').matches) return;
  let chip = document.getElementById('leads-live-chip');
  if (!chip) {
    chip = document.createElement('button'); chip.id = 'leads-live-chip'; chip.type = 'button';
    chip.style.cssText = 'position:fixed;right:16px;bottom:76px;z-index:65;border:0;border-radius:999px;background:var(--accent);color:#fff;padding:11px 15px;font:600 13px inherit;box-shadow:0 8px 22px #0005';
    chip.onclick = () => { chip.remove(); page = 1; loadTable(); };
    document.body.appendChild(chip);
  }
  const total = Number(chip.dataset.n || 0) + n;
  chip.dataset.n = String(total);
  chip.textContent = `${total} lead${total === 1 ? '' : 's'} nuevo${total === 1 ? '' : 's'} — Ver`;
}
async function parcharLeadLive(evento) {
  if (leadsView === 'lista') { await loadTable(); return; }
  const gen = evento.gen;
  const { data: lead, error } = await buildQuery(false).eq('id', evento.new.id).maybeSingle();
  if (genLeadLive.get(evento.new.id) !== gen) return;
  if (error) { console.error('parcharLeadLive', error); return; }
  const cards = document.getElementById('leads-cards');
  const card = cards?.querySelector(`[data-lead-id="${evento.new.id}"]`);
  if (!lead) { if (card) { card.remove(); delete LEADS_PAGINA[evento.new.id]; totalFiltered = Math.max(0, totalFiltered - 1); document.getElementById('t-count').textContent = `${fmt(totalFiltered)} leads`; renderPager(Math.max(Math.ceil(totalFiltered / PER), 1)); } return; }
  if (!card && (page !== 1 || evento.eventType !== 'INSERT')) { if (evento.eventType === 'INSERT') mostrarLeadsNuevos(1); return; }
  const tmp = document.createElement('div'); tmp.innerHTML = leadCardHtml(lead);
  const nuevo = tmp.firstElementChild;
  LEADS_PAGINA[lead.id] = lead;
  if (card) card.replaceWith(nuevo); else { cards.prepend(nuevo); totalFiltered++; document.getElementById('t-count').textContent = `${fmt(totalFiltered)} leads`; }
  wireLeadCardLive(nuevo, lead);
  nuevo.classList.add('lead-actualizado'); setTimeout(() => nuevo.classList.remove('lead-actualizado'), 1200);
  if (currentLead?.id === lead.id) {
    const drawerAbierto = document.getElementById('drawer')?.classList.contains('open') && document.getElementById('e-estado');
    if (drawerAbierto) aplicarActualizacionLeadAbierto(lead); else currentLead = lead;
  }
}
// Valor que iría en cada input del drawer para un lead dado -- usado SOLO
// para comparar/refrescar campos no tocados cuando llega un UPDATE ajeno
// mientras el drawer está abierto (openDrawer arma el HTML inicial por su
// cuenta con la misma lógica; si se agrega un campo nuevo al drawer hay que
// sumarlo acá también, no hay una única fuente de verdad para esto).
function valorLeadParaCampo(id, l) {
  switch (id) {
    case 'e-estado': return ESTADOS_EDIT.includes(l.estado) ? l.estado : 'POR ATENDER';
    case 'e-asesor': return ROL === 'asesor' ? MI_NOMBRE : (ACTIVOS.includes(l.asesor) ? l.asesor : 'Sin asignar');
    case 'e-servicio': return l.servicio || '';
    case 'e-monto': return l.monto ?? '';
    case 'e-comprado': return l.servicios_comprados || '';
    case 'e-nombre': return l.nombre || '';
    case 'e-telefono': return l.telefono || '';
    case 'e-canal': return l.canal || '';
    case 'e-destino': return l.destino || '';
    case 'e-personas': return l.personas || '';
    case 'e-fecha-estimada': return l.fecha_estimada || '';
    case 'e-destino-consulta': return l.destino_consulta || '';
    case 'e-monto-completo': return l.monto_completo ?? '';
    case 'e-monto-inicial': return l.monto_inicial ?? '';
    case 'e-restante-pago': return l.restante_pago ?? '';
    case 'e-fecha': return l.fecha_creacion ? l.fecha_creacion.slice(0, 10) : '';
    default: return null;
  }
}
// Aplica un UPDATE ajeno al drawer abierto: refresca los campos que el
// usuario NO tocó, conserva tal cual los que sí (camposSuciosLead), y avisa.
function aplicarActualizacionLeadAbierto(lead) {
  const actualizados = [], conflictivos = [];
  FIELD_IDS_LEAD.forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.disabled) return;
    const nuevo = valorLeadParaCampo(id, lead);
    if (nuevo === null || String(el.value) === String(nuevo)) return;
    if (camposSuciosLead.has(id)) { conflictivos.push(id); return; }
    el.value = nuevo;
    actualizados.push(id);
  });
  document.getElementById('venta-box')?.classList.toggle('show', document.getElementById('e-estado').value === VENTA);
  currentLead = lead;
  if (actualizados.length || conflictivos.length) mostrarConflictoLead(actualizados, conflictivos);
}
function mostrarConflictoLead(actualizados, conflictivos) {
  const bar = document.getElementById('lead-conflict-bar');
  if (!bar) return;
  conflictoLeadPendiente = conflictivos.length > 0;
  const nombres = ids => ids.map(id => FIELD_LABELS_LEAD[id]).join(', ');
  bar.innerHTML = conflictivos.length
    ? `<i class="fas fa-triangle-exclamation"></i> <span>Este lead cambió mientras lo editabas.${actualizados.length ? ' Se actualizaron solos: ' + esc(nombres(actualizados)) + '.' : ''} <b>Conflicto en: ${esc(nombres(conflictivos))}</b> — se conservó lo que escribiste, revisá antes de guardar.</span>`
    : `<i class="fas fa-arrows-rotate"></i> <span>Este lead cambió mientras lo tenías abierto. Se actualizó solo: ${esc(nombres(actualizados))}.</span>`;
  bar.style.display = 'flex';
}
function encolarLeadLive(evento) {
  evento.gen = (genLeadLive.get(evento.new.id) || 0) + 1;
  genLeadLive.set(evento.new.id, evento.gen);
  colaLeadsLive.set(evento.new.id, evento);
  if (!inicioLoteLeads) inicioLoteLeads = Date.now();
  clearTimeout(timerLeadsLive);
  const espera = Math.min(400, Math.max(0, 1000 - (Date.now() - inicioLoteLeads)));
  timerLeadsLive = setTimeout(() => {
    const lote = [...colaLeadsLive.values()]; colaLeadsLive.clear(); inicioLoteLeads = 0;
    loteLeadsEnCurso = loteLeadsEnCurso.then(async () => { for (const e of lote) await parcharLeadLive(e); await reconciliarLoteLive(lote.map(e => e.new.id)); });
  }, espera);
}
async function reconciliarLoteLive(ids) {
  if (leadsView === 'lista') { await loadTable(); return; }
  const { data, error } = await buildQuery(false).in('id', [...new Set(ids)]);
  if (error) { console.error('reconciliarLoteLive', error); return; }
  const recibidos = new Set((data || []).map(lead => String(lead.id)));
  for (const id of new Set(ids.map(String))) {
    if (recibidos.has(id)) continue;
    const card = document.querySelector(`#leads-cards [data-lead-id="${id}"]`);
    if (card) { card.remove(); delete LEADS_PAGINA[id]; totalFiltered = Math.max(0, totalFiltered - 1); document.getElementById('t-count').textContent = `${fmt(totalFiltered)} leads`; renderPager(Math.max(Math.ceil(totalFiltered / PER), 1)); }
  }
  for (const lead of data || []) {
    const card = document.querySelector(`#leads-cards [data-lead-id="${lead.id}"]`);
    if (!card) continue;
    const html = leadCardHtml(lead);
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    if (card.outerHTML === tmp.firstElementChild.outerHTML) continue;
    const nuevo = tmp.firstElementChild; LEADS_PAGINA[lead.id] = lead; card.replaceWith(nuevo); wireLeadCardLive(nuevo, lead);
  }
}
/* ---------- Arrastrar un lead a una pestaña (solo escritorio) ----------
   Soltar una tarjeta sobre "Boletería" o "En facturación" abre el mismo
   formulario precargado que el botón de cada acción -- no crea nada solo,
   porque falta la ruta/datos de venta. En móvil no se activa (el arrastre choca
   con el scroll); ahí siguen los botones. */
let LEADS_PAGINA = {};
function wireLeadDrag(el, leadId) {
  el.draggable = true;
  el.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/lead-id', String(leadId));
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
    document.body.classList.add('arrastrando-lead'); // resalta las pestañas-destino
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    document.body.classList.remove('arrastrando-lead');
  });
}
// data-drop = qué acción dispara cada pestaña al recibir una tarjeta.
const LEADS_DROP = {
  boleteria:   id => abrirSolicitudBoleteria(LEADS_PAGINA[id]),
  facturacion: id => abrirEnviarFacturacionSheet(LEADS_PAGINA[id]),
};
function setupLeadsDropTargets() {
  document.querySelectorAll('#leads-tabs .seg[data-leads-tab]').forEach(tab => {
    const accion = LEADS_DROP[tab.dataset.leadsTab];
    if (!accion) return; // solo Boletería y En facturación son destinos
    tab.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes('text/lead-id')) return;
      e.preventDefault();               // habilita el drop
      tab.classList.add('drop-ok');
    });
    tab.addEventListener('dragleave', () => tab.classList.remove('drop-ok'));
    tab.addEventListener('drop', e => {
      e.preventDefault();
      tab.classList.remove('drop-ok');
      const id = Number(e.dataTransfer.getData('text/lead-id'));
      const lead = LEADS_PAGINA[id];
      if (lead) accion(id);
    });
  });
}
function wireLeadChecks() {
  document.querySelectorAll('.lead-check').forEach(cb => {
    cb.addEventListener('click', e => e.stopPropagation());
    cb.addEventListener('change', () => {
      const id = +cb.dataset.id;
      if (cb.checked) SELECTED_LEADS.add(id); else SELECTED_LEADS.delete(id);
      updateBulkBar();
    });
  });
  updateBulkBar();
}
function updateBulkBar() {
  const bar = document.getElementById('bulk-bar'), count = document.getElementById('bulk-count');
  const n = SELECTED_LEADS.size;
  if (bar) bar.style.display = (n > 0 && ROL === 'admin') ? 'flex' : 'none';
  if (count) count.textContent = `${n} seleccionado${n === 1 ? '' : 's'}`;
  const ids = [...document.querySelectorAll('.lead-check')].map(cb => +cb.dataset.id);
  const selectAll = document.getElementById('th-select-all');
  if (selectAll) selectAll.checked = ids.length > 0 && ids.every(id => SELECTED_LEADS.has(id));
}
function clearSelection() { SELECTED_LEADS.clear(); updateBulkBar(); document.querySelectorAll('.lead-check').forEach(cb => cb.checked = false); }
function leadCardHtml(l) {
  const cc = CANAL_CLASS[l.canal] ?? '', wa = l.telefono ? l.telefono.replace(/\D/g, '') : '', av = clientAvatar(l);
  const detalle = leadsView === 'fichas' ? `
    <div class="ec-row"><i class="fas fa-comment-dots"></i> ${esc(l.destino_consulta || 'Sin consulta registrada')}</div>
    <div class="ec-row"><i class="fas fa-users"></i> ${esc(l.personas || '—')} persona(s)</div>` : '';
  // "Sin atender" es dato (rol + estado + sin fecha_primer_contacto), no
  // presentación -- antes se calculaba con matchMedia() EN EL MOMENTO DEL
  // RENDER, así que si el teléfono rotaba después, la tarjeta ya impresa
  // quedaba mostrando la versión vieja hasta el próximo refresh. Ahora la
  // condición de datos siempre se evalúa igual, y es el CSS (.tiene-sin-atender
  // dentro de @media(max-width:760px)) el que decide qué se ve -- reacciona
  // solo a la rotación, sin volver a tocar el DOM.
  const sinAtenderDatos = ROL === 'asesor' && l.estado === 'POR ATENDER' && !l.fecha_primer_contacto;
  // Fallback único (antes #5f677f acá y #8b93ad en el badge -- mismo estado
  // desconocido pintado de dos grises distintos en la misma tarjeta).
  const FALLBACK_COLOR = '#8b93ad';
  const estadoColor = ESTADO_COLORS[l.estado] || FALLBACK_COLOR;
  // Los botones se arman aparte para poder omitir el contenedor `.ec-actions`
  // cuando no queda ninguno: un div vacío igual sumaría el borde y dejaría un
  // hueco muerto abajo de la tarjeta.
  const acciones = [
    (ROL === 'asesor' || ROL === 'admin') && !['PAGO REALIZADO', 'VENTA PENDIENTE DE VERIFICAR'].includes(l.estado)
      ? `<button type="button" class="fact-btn" data-facturar-id="${l.id}" title="Enviar a facturación" aria-label="Enviar a facturación" onclick="event.stopPropagation()"><i class="fas fa-paper-plane"></i></button>` : '',
    wa ? `<a class="wa-btn" href="https://wa.me/${wa}" target="_blank" title="Abrir WhatsApp" aria-label="Abrir WhatsApp" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i></a>` : '',
  ].filter(Boolean).join('');
  return `<div class="entity-card ${sinAtenderDatos ? 'tiene-sin-atender' : ''}" data-lead-id="${l.id}" style="position:relative;border-left:4px solid ${estadoColor}">
    <input type="checkbox" class="lead-check solo-admin-borrar" data-id="${l.id}" ${SELECTED_LEADS.has(l.id) ? 'checked' : ''} style="position:absolute;top:10px;right:10px;width:18px;height:18px">
    <div class="ec-top">
      <div class="ec-ava" style="background:${av.color}22;color:${av.color}"><i class="fas ${av.icon}"></i></div>
      <div class="ec-headtext">
        <div class="ec-nombre">${esc(l.nombre)}${badgePrioridadIA(l)}${badgeNombreDudoso(l)}${badgeLeadRescatado(l)}${badgeContactoDirecto(l)}${l.es_prueba ? ' <span class="chip-prueba">PRUEBA</span>' : ''}</div>
        <div class="ec-destino"><i class="fas fa-location-dot"></i> ${esc(l.destino) || 'Sin destino'}</div>
      </div>
    </div>
    <div class="ec-row"><i class="fas fa-phone"></i> ${textoTelefonoLead(l)}</div>
    <div class="ec-estado-row">
      ${sinAtenderDatos ? `<span class="badge-st sin-atender-movil" style="color:var(--accent);background:var(--accent-soft)">Sin atender</span>` : ''}
      <span class="estado-stepper" data-id="${l.id}">
        <button type="button" class="estado-arrow" data-dir="-1" title="Estado anterior" aria-label="Estado anterior"><i class="fas fa-chevron-left"></i></button>
        <span class="badge-st" style="color:${estadoColor};background:${estadoColor}2e">${esc(niceEstado(l.estado))}</span>
        <button type="button" class="estado-arrow" data-dir="1" title="Siguiente estado" aria-label="Siguiente estado"><i class="fas fa-chevron-right"></i></button>
      </span>
    </div>
    <div class="ec-context">
      <span class="chip ${cc}">${esc(l.canal)}</span>
      <span class="ec-dot">·</span>
      <span>${l.asesor_activo ? esc(l.asesor) : '<span class="muted">' + esc(l.asesor) + '</span>'}</span>
      <span class="ec-dot">·</span>
      <span>${esc(tiempoRelativo(l.fecha_creacion))}</span>
    </div>
    ${detalle}
    ${acciones ? `<div class="ec-foot"><div class="ec-actions">${acciones}</div></div>` : ''}
    ${sinAtenderDatos ? `<button type="button" class="inbox-btn atender atender-movil" style="width:100%;margin-top:9px" data-atender-id="${l.id}"><i class="fas fa-check"></i> Atender</button>` : ''}
  </div>`;
}
// Flechitas del stepper de estado en la ficha del lead -- avanza/retrocede
// dentro de ESTADOS_CICLO sin abrir el drawer completo. Si el estado actual
// es 'Sin gestionar' (legacy, fuera del ciclo), la flecha lo manda al primer
// paso real del pipeline en vez de fallar.
async function moverEstadoLead(l, dir) {
  const i = ESTADOS_CICLO.indexOf(l.estado);
  const siguiente = i === -1 ? ESTADOS_CICLO[0] : ESTADOS_CICLO[Math.min(ESTADOS_CICLO.length - 1, Math.max(0, i + dir))];
  if (siguiente === l.estado) return;
  const { data, error } = await sb.rpc('actualizar_lead', { p_lead_id: l.id, p_estado: siguiente });
  if (error || !data?.ok) { errToast('No se pudo cambiar el estado: ' + (error?.message || data?.error || '')); return; }
  l.estado = siguiente;
  loadTable();
}
function applyLeadsView() {
  const table = document.getElementById('tbl-wrap'), cards = document.getElementById('leads-cards');
  table.classList.toggle('hide', leadsView !== 'lista');
  cards.classList.toggle('show', leadsView !== 'lista');
  cards.classList.toggle('fichas', leadsView === 'fichas');
}
function renderPager(pages) {
  document.getElementById('pager').innerHTML = `<button ${page <= 1 ? 'disabled' : ''} id="pprev"><i class="fas fa-chevron-left"></i></button><span class="pinfo">Página ${fmt(page)} de ${fmt(pages)}</span><button ${page >= pages ? 'disabled' : ''} id="pnext"><i class="fas fa-chevron-right"></i></button>`;
  const pv = document.getElementById('pprev'), nx = document.getElementById('pnext');
  if (pv) pv.onclick = () => { page--; loadTable(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  if (nx) nx.onclick = () => { page++; loadTable(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
}

/* ---------- Inbox de leads estilo Telegram (solo rol asesor) ----------
   Reemplaza la dependencia de Telegram para el flujo Atender/No puedo/Avisar
   número: mismos datos, mismas 3 acciones, pero sobre las RPC ya existentes
   (actualizar_lead, reasignar_lead) + reportar_telefono_incorrecto (nueva). */
async function loadInboxLeads() {
  if (ROL !== 'asesor') return;
  document.getElementById('inbox-loading').classList.add('show');
  const { data, error } = await sb.from('leads').select('*')
    .eq('estado', 'POR ATENDER').is('fecha_primer_contacto', null).is('eliminado_at', null)
    .order('fecha_creacion', { ascending: false });
  document.getElementById('inbox-loading').classList.remove('show');
  if (error) { console.error('inbox', error); errToast('No se pudo cargar el inbox de leads'); return; }
  INBOX_LEADS = data || [];
  renderInbox();
  renderHoyAsesor();
}
function renderInbox() {
  const grid = document.getElementById('inbox-grid'), empty = document.getElementById('inbox-empty');
  document.getElementById('inbox-count').textContent = INBOX_LEADS.length;
  empty.classList.toggle('show', INBOX_LEADS.length === 0);
  grid.innerHTML = INBOX_LEADS.map(inboxCardHtml).join('');
  [...grid.querySelectorAll('.inbox-card')].forEach((el, i) => {
    const l = INBOX_LEADS[i];
    el.addEventListener('click', () => openDrawer(l));
    el.querySelector('.inbox-btn.atender').addEventListener('click', e => { e.stopPropagation(); atenderInboxLead(l); });
    el.querySelector('.inbox-btn.nopuedo')?.addEventListener('click', e => { e.stopPropagation(); noPuedoInboxLead(l); });
    el.querySelector('.inbox-btn.avisar').addEventListener('click', e => { e.stopPropagation(); abrirAvisarTelefono(l); });
  });
  actualizarBadgeLeads(INBOX_LEADS.length);
}
function inboxCardHtml(l) {
  const av = clientAvatar(l);
  return `<div class="entity-card inbox-card" data-id="${l.id}">
    <div class="ec-top"><div class="ec-ava" style="background:${av.color}22;color:${av.color}"><i class="fas ${av.icon}"></i></div><div class="ec-nombre">${esc(l.nombre)}${badgePrioridadIA(l)}${badgeNombreDudoso(l)}</div></div>
    <div class="ec-row"><i class="fas fa-phone"></i> ${esc(l.telefono) || 'Sin teléfono'}</div>
    <div class="ec-row"><i class="fas fa-location-dot"></i> ${esc(l.destino) || '—'}</div>
    ${l.destino_consulta ? `<div class="ec-row"><i class="fas fa-comment-dots"></i> ${esc(l.destino_consulta)}</div>` : ''}
    ${l.personas ? `<div class="ec-row"><i class="fas fa-users"></i> ${esc(l.personas)} persona(s)</div>` : ''}
    <div class="ec-row"><i class="fas fa-clock"></i> ${tiempoRelativo(l.fecha_creacion)}</div>
    ${l.no_reasignar ? `<div class="ec-row" style="color:var(--muted2)"><i class="fas fa-lock"></i> Llegó directo por WhatsApp -- no se reasigna</div>` : ''}
    <div class="inbox-actions">
      <button type="button" class="inbox-btn atender"><i class="fas fa-check"></i> Atender</button>
      ${l.no_reasignar ? '' : `<button type="button" class="inbox-btn nopuedo"><i class="fas fa-xmark"></i> No puedo</button>`}
      <button type="button" class="inbox-btn avisar" title="Avisar número incorrecto"><i class="fas fa-flag"></i></button>
    </div>
  </div>`;
}
async function atenderInboxLead(l) {
  // window.open ANTES del await -- si va después, ya no corre dentro del
  // gesto síncrono del click y Chrome/Firefox lo bloquean como popup. Si de
  // todos modos vuelve null (ej. llamado async desde manejarDeepLinkLeadAccion
  // al tocar el botón nativo de una notificación push -- ahí no hay gesto vivo
  // para heredar), se ofrece el link a mano en vez de fallar en silencio.
  const wa = l.telefono ? l.telefono.replace(/\D/g, '') : '';
  const winRef = wa ? window.open(`https://wa.me/${wa}`, '_blank') : null;
  const { data, error } = await sb.rpc('actualizar_lead', { p_lead_id: l.id, p_estado: 'ATENDIDO' });
  if (error || !data?.ok) { errToast('No se pudo marcar como atendido: ' + (error?.message || data?.error || '')); return; }
  quitarDeInbox(l.id);
  okToast('Lead marcado como atendido');
  if (wa && !winRef) linkToast(`El navegador bloqueó la apertura automática -- <a href="https://wa.me/${wa}" target="_blank" rel="noopener">tocá acá para abrir WhatsApp</a>`);
  loadTable();
}

/* ---------- Hoy (mobile-only, punto de entrada del bottom-nav) ----------
   Reusa datos/renderers que ya existen (INBOX_LEADS+inboxCardHtml del inbox
   de leads, STATS del dashboard, renderPipe del embudo) -- no duplica lógica
   de negocio, solo arma una vista resumen. Desktop nunca entra a 'hoy'
   (sidebar sigue apuntando a dashboard/leads como siempre). */
function renderHoy() {
  if (!document.getElementById('sec-hoy')) return;
  const esAsesor = ROL === 'asesor';
  document.getElementById('hoy-asesor').style.display = esAsesor ? '' : 'none';
  document.getElementById('hoy-admin').style.display = esAsesor ? 'none' : '';
  if (esAsesor) renderHoyAsesor(); else renderHoyAdmin();
}
function renderHoyAsesor() {
  const saludo = document.getElementById('hoy-saludo');
  if (!saludo) return; // sec-hoy no montada todavía
  saludo.textContent = 'Buen día' + (MI_NOMBRE ? ', ' + MI_NOMBRE.split(' ')[0] : '');
  document.getElementById('hoy-resumen').textContent = `${INBOX_LEADS.length} lead(s) esperan respuesta`;
  document.getElementById('hoy-urgent-count').textContent = INBOX_LEADS.length;
  const box = document.getElementById('hoy-urgent');
  const top = INBOX_LEADS.slice(0, 4);
  box.innerHTML = top.length ? top.map(inboxCardHtml).join('')
    : '<div class="tbl-state show"><i class="fas fa-circle-check"></i><div class="es-t">Al día</div><div class="es-s">No tenés leads nuevos esperando respuesta</div></div>';
  [...box.querySelectorAll('.inbox-card')].forEach((el, i) => {
    const l = top[i];
    el.addEventListener('click', () => openDrawer(l));
    el.querySelector('.inbox-btn.atender').addEventListener('click', e => { e.stopPropagation(); atenderInboxLead(l); });
    el.querySelector('.inbox-btn.nopuedo')?.addEventListener('click', e => { e.stopPropagation(); noPuedoInboxLead(l); });
    el.querySelector('.inbox-btn.avisar').addEventListener('click', e => { e.stopPropagation(); abrirAvisarTelefono(l); });
  });
  const stats = document.getElementById('hoy-stats');
  if (STATS && Object.keys(STATS).length) {
    const mes = new Date().toISOString().slice(0, 7);
    pintarKPIs(stats, [
      { t: 'Por atender', v: fmt(STATS.por_atender), i: 'fa-bell', c: 'var(--amber)', tt: 'Ver los leads por atender', go: () => drillEstado('POR ATENDER') },
      { t: 'Nuevos este mes', v: fmt(STATS.mes_actual), i: 'fa-bolt', c: 'var(--green)', tt: 'Ver los leads de este mes', go: () => drillMonth(mes) },
      { t: 'Leads totales', v: fmt(STATS.total), i: 'fa-users', c: 'var(--accent)', tt: 'Ver todos los leads, sin filtros', go: () => drillClear() },
    ]);
  }
}
function renderHoyAdmin() {
  if (!STATS || !Object.keys(STATS).length) return; // loadStats todavía no resolvió
  renderPipe('hoy-pipe');
  const mes = new Date().toISOString().slice(0, 7);
  pintarKPIs('hoy-kpis', [
    { t: 'Leads en 2026', v: fmt(STATS.anio_actual), i: 'fa-calendar-day', c: 'var(--blue)', tt: 'Ver los leads de 2026', go: () => drillAnio('2026') },
    { t: 'Nuevos este mes', v: fmt(STATS.mes_actual), i: 'fa-bolt', c: 'var(--green)', tt: 'Ver los leads de este mes', go: () => drillMonth(mes) },
    { t: 'Por atender', v: fmt(STATS.por_atender), i: 'fa-bell', c: 'var(--amber)', tt: 'Ver los leads por atender', go: () => drillEstado('POR ATENDER') },
    { t: 'Vouchers este mes', v: fmt(STATS.vouchers_mes || 0), i: 'fa-file-invoice', c: 'var(--purple)', tt: 'Ir a Vouchers', go: () => activateSection('voucher') },
  ]);
}
function setupHoy() {
  document.getElementById('hoy-nuevo-lead-btn')?.addEventListener('click', () => document.getElementById('nl-abrir-btn')?.click());
  document.getElementById('hoy-cotizador-btn')?.addEventListener('click', () => activateSection('cotizador'));
  document.getElementById('hoy-ver-dashboard-btn')?.addEventListener('click', () => activateSection('dashboard'));
}
async function noPuedoInboxLead(l) {
  // Vía Edge Function reasignar-lead (no RPC directo): además de reasignar
  // (misma reasignar_lead(), mismo check de ownership) dispara el push al
  // asesor nuevo -- si se llamara la RPC directo desde acá, ese aviso nunca
  // salía (solo lo disparan telegram-webhook/timeout-leads hoy).
  const { data, error } = await sb.functions.invoke('reasignar-lead', { body: { p_lead_id: l.id } });
  if (error) { errToast('No se pudo reasignar: ' + error.message); return; }
  if (data?.motivo === 'fuera_de_horario') { errToast('No se reasignan leads entre 9pm y 9am -- el lead sigue contigo'); return; }
  if (data?.motivo === 'no_reasignable') { errToast('Este lead llegó directo por WhatsApp -- no se puede reasignar'); return; }
  if (!data?.ok) { errToast('No se pudo reasignar: ' + (data?.motivo || data?.error || 'error desconocido')); return; }
  if (data.pool_agotado) { errToast('No hay más asesores disponibles por ahora -- el lead sigue contigo'); return; }
  quitarDeInbox(l.id);
  okToast('Lead reasignado a otro asesor');
}
function quitarDeInbox(leadId) {
  INBOX_LEADS = INBOX_LEADS.filter(x => x.id !== leadId);
  renderInbox();
  renderHoyAsesor();
}
function abrirAvisarTelefono(l) {
  INBOX_TEL_LEAD_ID = l.id;
  document.getElementById('inbox-telefono-input').value = '';
  openSheet('inbox-telefono-sheet');
}
document.getElementById('inbox-telefono-invalido')?.addEventListener('click', () => guardarTelefonoIncorrecto(null));
document.getElementById('inbox-telefono-guardar')?.addEventListener('click', () => {
  const v = document.getElementById('inbox-telefono-input').value.trim();
  if (!v) { errToast('Escribí el número corregido, o usá "Marcar inválido"'); return; }
  guardarTelefonoIncorrecto(v);
});
async function guardarTelefonoIncorrecto(telefonoCorregido) {
  if (!INBOX_TEL_LEAD_ID) return;
  const { error } = await sb.rpc('reportar_telefono_incorrecto', { p_lead_id: INBOX_TEL_LEAD_ID, p_telefono_corregido: telefonoCorregido });
  if (error) { errToast('No se pudo guardar: ' + error.message); return; }
  closeSheet('inbox-telefono-sheet');
  okToast(telefonoCorregido ? 'Número corregido' : 'Marcado para revisión de gestión');
  // El lead sigue pendiente (esto no toca estado/fecha_primer_contacto) --
  // se actualiza el teléfono en memoria para que la card ya lo refleje sin
  // esperar el próximo reload/realtime.
  const l = INBOX_LEADS.find(x => x.id === INBOX_TEL_LEAD_ID);
  if (l && telefonoCorregido) l.telefono = telefonoCorregido;
  if (l) renderInbox();
  INBOX_TEL_LEAD_ID = null;
}
// Badge de "Leads" para rol asesor: pendientes del inbox, no el total histórico (ver loadStats).
// setAppBadge/clearAppBadge: puntito de conteo en el ícono de la PWA instalada (feature-detected,
// Safari/iOS y navegadores viejos no lo soportan -- no rompe nada donde falta).
let BN_LEADS_PENDIENTES = 0;
function actualizarBadgeLeads(pendientes) {
  BN_LEADS_PENDIENTES = pendientes || 0;
  const d = document.getElementById('nav-lead-count'), m = document.getElementById('nav-lead-count-m');
  if (d) d.textContent = pendientes > 0 ? String(pendientes) : '—';
  if (m) { m.textContent = pendientes > 9 ? '9+' : String(pendientes); m.classList.toggle('show', pendientes > 0); }
  if ('setAppBadge' in navigator) { (pendientes > 0 ? navigator.setAppBadge(pendientes) : navigator.clearAppBadge()).catch(() => {}); }
}

/* ---------- Drawer editable ---------- */
function openDrawer(l) {
  currentLead = l;
  camposSuciosLead = new Set(); conflictoLeadPendiente = false;
  CONV_CACHE = null; ACTIVIDAD_CACHE = null; // se recargan por lead, ver cargarConversacionLead/cargarActividadLead
  const wa = l.telefono ? l.telefono.replace(/\D/g, '') : '';
  const av = clientAvatar(l);
  const sinAtender = l.estado === 'POR ATENDER' && !l.fecha_primer_contacto;
  const opt = (arr, sel) => arr.map(v => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(niceEstado(v))}</option>`).join('');
  const estColor = ESTADO_COLORS[l.estado] || '#8b93ad';
  // campo(): cada input con su etiqueta en una celda de la grilla, para que la
  // ficha se lea en dos columnas en vez de una tira vertical infinita.
  const campo = (etiqueta, html, full) => `<div class="fcol ${full ? 'f-full' : ''}"><label class="fl">${etiqueta}</label>${html}</div>`;
  const seccion = (id, icono, titulo, cuerpo, abierta) => `
    <details class="dsec" ${abierta ? 'open' : ''} data-dsec="${id}">
      <summary><i class="fas ${icono} dsec-ic"></i> ${titulo} <i class="fas fa-chevron-down dsec-arrow"></i></summary>
      <div class="dsec-body">${cuerpo}</div>
    </details>`;
  document.getElementById('drawerContent').innerHTML = `
    <div class="dhead"><div class="dava" style="background:${av.color}22;color:${av.color}"><i class="fas ${av.icon}"></i></div>
      <div class="dhead-info"><div class="dn">${esc(l.nombre)}</div>
      <div class="dm">${textoTelefonoLead(l)} · ${esc(l.canal)}</div>
      <span class="badge-st" style="color:${estColor};background:${estColor}2e">${esc(niceEstado(l.estado))}</span>${badgeLeadRescatado(l)}${badgeContactoDirecto(l)}</div></div>

    ${sinAtender ? `<button type="button" class="inbox-btn atender" id="e-a-atender" style="width:100%;margin-bottom:12px"><i class="fas fa-check"></i> Atender este lead</button>` : ''}

    <div class="dquick">
      ${wa ? `<a class="dq wa" href="https://wa.me/${wa}" target="_blank"><i class="fab fa-whatsapp"></i><span>WhatsApp</span></a>` : ''}
      ${(ROL === 'asesor' || ROL === 'admin') && l.external_id ? `<button class="dq" id="e-a-tomar-ia" type="button"><i class="fas fa-hand"></i><span>Tomar conversación</span></button>` : ''}
      ${(ROL === 'asesor' || ROL === 'admin') ? `<button class="dq" id="e-a-boleteria" type="button"><i class="fas fa-plane-departure"></i><span>Boletería</span></button>` : ''}
      ${(ROL === 'asesor' || ROL === 'admin') ? `<button class="dq" id="e-a-cotizacion" type="button" ${l.fecha_cotizacion_enviada ? 'disabled' : ''}><i class="fas fa-file-circle-check"></i><span>${l.fecha_cotizacion_enviada ? 'Cotización registrada' : 'Registrar cotización'}</span></button>` : ''}
      ${(ROL === 'asesor' || ROL === 'admin') && !['PAGO REALIZADO', 'VENTA PENDIENTE DE VERIFICAR'].includes(l.estado) ? `<button class="dq" id="e-a-facturar" type="button"><i class="fas fa-paper-plane"></i><span>Facturación</span></button>` : ''}
    </div>

    <div class="lead-tabs">
      <button type="button" class="lead-tab-btn active" data-tab="resumen">Ficha</button>
      <button type="button" class="lead-tab-btn" data-tab="notas">Notas</button>
      <button type="button" class="lead-tab-btn" data-tab="conversacion">Chat</button>
      <button type="button" class="lead-tab-btn" data-tab="actividad">Actividad</button>
    </div>

    <div class="lead-tab-panel active" data-tab="resumen">
    <div class="lead-conflict-bar" id="lead-conflict-bar" style="display:none"></div>
    ${seccion('gestion', 'fa-sliders', 'Gestión', `
      <div class="dgrid">
        ${campo('Estado', `<select id="e-estado" class="ei">${opt(ESTADOS_EDIT, ESTADOS_EDIT.includes(l.estado) ? l.estado : 'POR ATENDER')}</select>`, true)}
        ${campo('Asesor asignado', `<select id="e-asesor" class="ei" ${ROL === 'asesor' ? 'disabled' : ''}>${ROL === 'asesor' ? opt([MI_NOMBRE], MI_NOMBRE) : opt(['Sin asignar', ...ACTIVOS], ACTIVOS.includes(l.asesor) ? l.asesor : 'Sin asignar')}</select>`)}
        ${campo('Servicio de interés', `<select id="e-servicio" class="ei"><option value="">— sin definir —</option>${opt(SERVICIOS, l.servicio)}</select>`)}
        <div class="fcol f-full">
          <button class="dbtn gh" id="e-servicio-ia" type="button" style="width:100%;padding:9px;font-size:12px;margin-top:9px"><i class="fas fa-wand-magic-sparkles"></i> Detectar servicio con IA</button>
          <div class="e-servicio-razon" id="e-servicio-razon">${l.servicio_ia_razon ? '<i class="fas fa-robot"></i> ' + esc(l.servicio_ia_razon) : ''}</div>
        </div>
      </div>
      <div id="venta-box" class="venta-box ${l.estado === VENTA ? 'show' : ''}">
        <div class="dgrid">
          ${campo('Monto de la venta (USD)', `<input id="e-monto" class="ei" type="number" min="0" step="1" placeholder="0" value="${l.monto ?? ''}">`, true)}
          ${campo('Servicios / paquetes comprados', `<input id="e-comprado" class="ei" type="text" placeholder="Ej: Vuelo + Hotel 3 noches" value="${esc(l.servicios_comprados || '')}">`, true)}
        </div>
      </div>`, true)}

    ${seccion('datos', 'fa-user-pen', 'Datos del cliente', `
      <div class="dgrid">
        ${campo('Nombre', `<input id="e-nombre" class="ei" type="text" value="${esc(l.nombre || '')}">`, true)}
        ${campo('Teléfono', `<input id="e-telefono" class="ei" type="text" value="${esc(l.telefono || '')}">`)}
        ${campo('Canal', `<input id="e-canal" class="ei" type="text" value="${esc(l.canal || '')}">`)}
        ${campo('Destino de interés', `<input id="e-destino" class="ei" type="text" value="${esc(l.destino || '')}">`)}
        ${campo('Personas', `<input id="e-personas" class="ei" type="text" value="${esc(l.personas || '')}">`)}
        ${campo('Fecha de viaje (aprox.)', `<input id="e-fecha-estimada" class="ei" type="text" placeholder="Ej: 15 de agosto, o del 10 al 15/09" value="${esc(l.fecha_estimada || '')}">`, true)}
        ${campo('Consulta original', `<input id="e-destino-consulta" class="ei" type="text" value="${esc(l.destino_consulta || '')}">`, true)}
      </div>`, true)}

    ${seccion('pagos', 'fa-dollar-sign', 'Pagos y captación', `
      <div class="dgrid">
        ${campo('Monto completo (USD)', `<input id="e-monto-completo" class="ei" type="number" min="0" step="1" placeholder="Sin definir" value="${l.monto_completo ?? ''}">`)}
        ${campo('Monto inicial (USD)', `<input id="e-monto-inicial" class="ei" type="number" min="0" step="1" placeholder="Sin definir" value="${l.monto_inicial ?? ''}">`)}
        ${campo('Restante de pago (USD)', `<input id="e-restante-pago" class="ei" type="number" min="0" step="1" placeholder="Sin definir" value="${l.restante_pago ?? ''}">`)}
        ${campo('Fecha de captación', `<input id="e-fecha" class="ei" type="date" value="${l.fecha_creacion ? l.fecha_creacion.slice(0, 10) : ''}">`)}
      </div>`, false)}

    <div class="edit-err" id="edit-err"></div>
    <div class="dsave"><button class="dbtn save" id="e-save"><i class="fas fa-floppy-disk"></i> Guardar cambios</button></div>
    <div class="did"><span>ID: ${esc(l.external_id || l.id)}</span><button type="button" id="e-copiar-id" title="Copiar ID"><i class="fas fa-copy"></i></button></div>
    </div>

    <div class="lead-tab-panel" data-tab="notas">
      <label class="fl">Notas internas — solo las ve el equipo, nunca el cliente</label>
      <textarea id="e-notas" class="ei" rows="10" placeholder="Qué se habló, qué quedó pendiente, próximo paso...">${esc(l.notas || '')}</textarea>
      <button class="dbtn save" id="e-notas-save" type="button"><i class="fas fa-floppy-disk"></i> Guardar notas</button>
      <div class="dnotas-meta" id="e-notas-meta"></div>
    </div>

    <div class="lead-tab-panel" data-tab="conversacion">
      <div style="font-size:11px;color:var(--muted2);background:rgba(255,255,255,.03);border-radius:10px;padding:9px 11px;margin-bottom:12px;line-height:1.5">
        <i class="fas fa-paperclip"></i> Extracto de la conversación gestionada por la IA en ${esc(l.canal || 'el canal')} (ManyChat) — solo lectura.
      </div>
      <div id="conv-body"><i class="fas fa-circle-notch fa-spin"></i> Cargando conversación...</div>
    </div>

    <div class="lead-tab-panel" data-tab="actividad">
      <div id="act-body"><i class="fas fa-circle-notch fa-spin"></i> Cargando actividad...</div>
    </div>`;

  document.getElementById('e-estado').onchange = e => document.getElementById('venta-box').classList.toggle('show', e.target.value === VENTA);
  FIELD_IDS_LEAD.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const marcar = () => camposSuciosLead.add(id);
    el.addEventListener('input', marcar);
    el.addEventListener('change', marcar);
  });
  document.getElementById('e-save').onclick = guardarLead;
  document.getElementById('e-notas-save').onclick = guardarNotasLead;
  document.getElementById('e-servicio-ia').onclick = detectarServicioDelLead;
  document.getElementById('e-copiar-id').onclick = async () => {
    try { await navigator.clipboard.writeText(String(l.external_id || l.id)); okToast('ID copiado'); }
    catch { errToast('El navegador no dejó copiar'); }
  };
  document.getElementById('e-a-atender')?.addEventListener('click', () => atenderInboxLead(l));
  document.getElementById('e-a-facturar')?.addEventListener('click', () => abrirEnviarFacturacionSheet(l));
  document.getElementById('e-a-cotizacion')?.addEventListener('click', () => registrarCotizacionEnviada(l));
  document.getElementById('e-a-tomar-ia')?.addEventListener('click', () => tomarConversacionIA(l));
  document.getElementById('e-a-boleteria')?.addEventListener('click', () => { window.closeDrawer(); abrirSolicitudBoleteria(l); });
  document.querySelectorAll('.lead-tab-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.lead-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.lead-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === btn.dataset.tab));
    if (btn.dataset.tab === 'conversacion') cargarConversacionLead(l);
    if (btn.dataset.tab === 'actividad') cargarActividadLead(l);
  }));
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBg').classList.add('open');
  navPush({ type: 'drawer' });
}

async function tomarConversacionIA(l) {
  const btn = document.getElementById('e-a-tomar-ia');
  if (!btn || btn.disabled || !l?.id) return;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span>Tomando...</span>';
  const { data, error } = await sb.rpc('tomar_conversacion_ia', { p_lead_id: l.id, p_motivo: 'intervencion_humana_crm' });
  if (error || !data?.ok) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-hand"></i><span>Tomar conversación</span>';
    errToast(error?.message || data?.error || 'No se pudo tomar la conversación');
    return;
  }
  btn.innerHTML = '<i class="fas fa-user-check"></i><span>Atención humana activa</span>';
  okToast('La IA quedó silenciada y se cancelaron sus seguimientos pendientes');
}

async function registrarCotizacionEnviada(l) {
  const btn = document.getElementById('e-a-cotizacion');
  if (!btn || btn.disabled || !l?.id) return;
  btn.disabled = true;
  const anterior = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span>Registrando...</span>';
  const { data, error } = await sb.rpc('registrar_cotizacion_enviada', { p_lead_id: l.id });
  if (error || !data?.ok) {
    btn.disabled = false; btn.innerHTML = anterior;
    errToast(error?.message || data?.error || 'No se pudo registrar la cotización');
    return;
  }
  l.estado = data.estado || 'COTIZACION ENVIADA';
  l.fecha_cotizacion_enviada = data.fecha_cotizacion_enviada;
  if (currentLead?.id === l.id) Object.assign(currentLead, l);
  btn.innerHTML = '<i class="fas fa-file-circle-check"></i><span>Cotización registrada</span>';
  ACTIVIDAD_CACHE = null;
  okToast(data.ya_registrada ? 'La cotización ya estaba registrada' : 'Cotización enviada registrada');
  await loadStats(); renderAll(); loadTable(); loadDestPeriodo();
}

/* ---------- Conversación/Actividad del registro de lead (Fase 3, tabs
   mobile-only -- ver .lead-tabs en el CSS). Carga perezosa: solo se pide al
   backend la primera vez que se toca cada pestaña (en desktop, sin tab bar
   visible, nunca se llega a llamar esto). ---------- */
let CONV_CACHE = null, ACTIVIDAD_CACHE = null;
async function cargarConversacionLead(l) {
  const box = document.getElementById('conv-body');
  if (!box) return;
  if (CONV_CACHE) { box.innerHTML = CONV_CACHE; return; }
  const { data, error } = await sb.from('manychat_ia_sesiones').select('historial').eq('lead_id', l.id).order('updated_at', { ascending: false }).limit(1);
  if (error) { box.innerHTML = '<div class="muted">No se pudo cargar la conversación</div>'; return; }
  const historial = data?.[0]?.historial || [];
  if (!historial.length) { CONV_CACHE = '<div class="muted">Sin conversación registrada con la IA para este lead</div>'; box.innerHTML = CONV_CACHE; return; }
  CONV_CACHE = historial.map(m => `<div class="conv-msg ${m.rol === 'ia' ? 'ia' : 'lead'}"><div class="conv-who">${m.rol === 'ia' ? 'Lotus IA' : 'Cliente'}</div>${esc(m.texto)}</div>`).join('');
  box.innerHTML = CONV_CACHE;
}
async function cargarActividadLead(l) {
  const box = document.getElementById('act-body');
  if (!box) return;
  if (ACTIVIDAD_CACHE) { box.innerHTML = ACTIVIDAD_CACHE; return; }
  const [eventos, reasignaciones] = await Promise.all([
    sb.from('lead_eventos').select('tipo,estado_de,estado_a,asesor,detalle,created_at').eq('lead_id', l.id).order('created_at', { ascending: false }),
    sb.from('reasignaciones').select('asesor_anterior,asesor_nuevo,motivo,created_at').eq('lead_id', l.id).order('created_at', { ascending: false }),
  ]);
  const filas = [
    // contacto_duplicado: el mismo cliente volvió a escribir por otro canal y
    // NO se creó un lead nuevo (ver ingest_lead_v2). El asesor tiene que verlo
    // acá, si no le queda invisible que el cliente insistió.
    ...(eventos.data || []).map(e => e.tipo === 'contacto_duplicado'
      ? { hora: e.created_at, texto: `🔁 Volvió a escribir por <b>${esc(e.detalle?.canal || 'otro canal')}</b>${e.detalle?.destino && e.detalle.destino !== e.detalle?.destino_previo ? `, preguntando por <b>${esc(e.detalle.destino)}</b>` : ''} — no se creó un lead nuevo` }
      : e.tipo === 'cotizacion_enviada'
      ? { hora: e.created_at, texto: `📄 ${e.asesor ? '<b>' + esc(e.asesor) + '</b> registró' : 'Se registró'} la cotización como enviada` }
      : { hora: e.created_at, texto: `${e.asesor ? esc(e.asesor) + ': ' : ''}cambió de <b>${esc(niceEstado(e.estado_de))}</b> a <b>${esc(niceEstado(e.estado_a))}</b>` }),
    // reasignaciones: RLS es admin-only -- para asesor esta consulta vuelve
    // vacía en silencio (no es un error), la Actividad les queda sin este
    // renglón, comportamiento esperado del modelo de permisos actual.
    ...(reasignaciones.data || []).map(r => ({ hora: r.created_at, texto: `Reasignado de <b>${esc(r.asesor_anterior || '—')}</b> a <b>${esc(r.asesor_nuevo || 'sin asignar')}</b> (${esc(r.motivo)})` })),
    { hora: l.fecha_creacion, texto: 'Lead creado' },
  ].filter(f => f.hora).sort((a, b) => new Date(b.hora) - new Date(a.hora));
  ACTIVIDAD_CACHE = filas.map(f => `<div class="act-row"><div class="act-txt">${f.texto}</div><div class="act-hora">${esc(fmtFechaHoraCaracas(f.hora))}</div></div>`).join('');
  box.innerHTML = ACTIVIDAD_CACHE;
}
function abrirConfirmarEliminar(modo) {
  deleteMode = modo;
  const desc = document.getElementById('confirm-delete-lead-desc');
  const input = document.getElementById('confirm-delete-lead-input');
  const ok = document.getElementById('confirm-delete-lead-ok');
  desc.textContent = modo === 'bulk'
    ? `Vas a eliminar ${SELECTED_LEADS.size} lead(s) seleccionados. Van a desaparecer de la tabla, el pipeline y las métricas. La acción queda registrada y es recuperable solo desde la base de datos — no desde el CRM.`
    : 'Este lead va a desaparecer de la tabla, el pipeline y las métricas. La acción queda registrada y es recuperable solo desde la base de datos — no desde el CRM.';
  input.value = '';
  ok.disabled = true; ok.style.opacity = '.5';
  openSheet('confirm-delete-lead-sheet');
  setTimeout(() => input.focus(), 50);
}
document.getElementById('confirm-delete-lead-input')?.addEventListener('input', e => {
  const ok = document.getElementById('confirm-delete-lead-ok');
  const listo = e.target.value.trim().toLowerCase() === 'eliminar';
  ok.disabled = !listo; ok.style.opacity = listo ? '1' : '.5';
});
document.getElementById('confirm-delete-lead-cancel')?.addEventListener('click', () => closeSheet('confirm-delete-lead-sheet'));
document.getElementById('confirm-delete-lead-ok')?.addEventListener('click', async () => {
  if (deleteMode === 'single' && !currentLead) return;
  if (deleteMode === 'bulk' && !SELECTED_LEADS.size) return;
  const btn = document.getElementById('confirm-delete-lead-ok');
  btn.disabled = true; btn.innerHTML = 'Eliminando... <i class="fas fa-spinner fa-spin"></i>';
  const ids = deleteMode === 'bulk' ? [...SELECTED_LEADS] : [currentLead.id];
  const resultados = await Promise.all(ids.map(id => sb.rpc('eliminar_lead', { p_lead_id: id })));
  const fallidos = resultados.filter(r => r.error || !r.data?.ok);
  btn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
  if (fallidos.length) errToast(`No se pudieron eliminar ${fallidos.length} de ${ids.length} lead(s): ${fallidos[0].error?.message || fallidos[0].data?.error || ''}`);
  // La hoja de confirmación quedó apilada arriba del drawer (openSheet
  // empujó su propia entrada de historial) — se descarta esa entrada a
  // mano en vez de sumar un history.back() extra, así el cierre de
  // ambos overlays consume un solo history.back() (el del drawer).
  if (NAV_STACK[NAV_STACK.length - 1]?.type === 'sheet') NAV_STACK.pop();
  closeSheet('confirm-delete-lead-sheet', true);
  if (deleteMode === 'single') { window.closeDrawer(); if (!fallidos.length) okToast('Lead eliminado'); }
  else { clearSelection(); if (!fallidos.length) okToast(`${ids.length} lead(s) eliminados`); }
  await loadStats(); renderAll(); loadTable(); loadDestPeriodo();
});
document.getElementById('bulk-clear')?.addEventListener('click', clearSelection);
document.getElementById('bulk-eliminar')?.addEventListener('click', () => abrirConfirmarEliminar('bulk'));
document.getElementById('bulk-servicio-ia')?.addEventListener('click', detectarServicioSeleccionados);
document.getElementById('th-select-all')?.addEventListener('change', e => {
  document.querySelectorAll('.lead-check').forEach(cb => {
    cb.checked = e.target.checked;
    const id = +cb.dataset.id;
    if (e.target.checked) SELECTED_LEADS.add(id); else SELECTED_LEADS.delete(id);
  });
  updateBulkBar();
});
async function guardarLead() {
  const btn = document.getElementById('e-save'), err = document.getElementById('edit-err');
  // Conflicto real pendiente (falla #4): otra sesión cambió un campo que
  // el usuario también está editando acá mismo. Se manda igual el
  // formulario completo si confirma -- sus valores pisan los del servidor,
  // como ya hacía el guardado normal, pero ahora al menos avisa antes.
  if (conflictoLeadPendiente && !(await confirmarSheet({ titulo: 'Este lead cambió mientras lo editabas', detalle: 'Hay campos en conflicto. ¿Guardar igual con tus valores?', textoOk: 'Guardar igual' }))) return;
  // Vista previa de rol activa (admin real viendo como asesor): el select de
  // "Asesor asignado" queda deshabilitado con el NOMBRE DEL ADMIN adentro
  // (mismo render que ve un asesor real, ver campo() más arriba) -- sin este
  // guard, guardar cualquier lead ajeno mientras se previsualiza "asesor" le
  // reasignaría el lead al admin en silencio (el admin real puede abrir
  // cualquier lead, a diferencia de un asesor real). Se manda el asesor que
  // el lead YA tenía, sin tocarlo.
  const enVistaPreviaNoAdmin = ROL_REAL === 'admin' && ROL !== ROL_REAL;
  const estado = val('e-estado'), asesor = enVistaPreviaNoAdmin ? currentLead.asesor : val('e-asesor'), servicio = val('e-servicio');
  const montoRaw = val('e-monto').trim();
  if (estado === VENTA && (!montoRaw || !(parseFloat(montoRaw) > 0))) { err.textContent = 'Ingresa el monto de la venta (debe ser mayor a 0)'; return; }
  const nombre = val('e-nombre').trim();
  if (!nombre) { err.textContent = 'El nombre no puede quedar vacío'; return; }
  const monto = estado === VENTA ? parseFloat(montoRaw) : null;
  const comprado = estado === VENTA ? val('e-comprado').trim() : null;
  const fechaVal = val('e-fecha');
  const montoCompletoRaw = val('e-monto-completo').trim();
  const montoInicialRaw = val('e-monto-inicial').trim();
  const restantePagoRaw = val('e-restante-pago').trim();
  err.textContent = ''; btn.disabled = true; btn.innerHTML = 'Guardando... <i class="fas fa-spinner fa-spin"></i>';
  const { data, error } = await sb.rpc('actualizar_lead', {
    p_lead_id: currentLead.id, p_estado: estado, p_asesor: asesor, p_monto: monto, p_servicio: servicio, p_servicios_comprados: comprado,
    p_nombre: nombre, p_telefono: val('e-telefono').trim(), p_canal: val('e-canal').trim(),
    p_destino: val('e-destino').trim(), p_destino_consulta: val('e-destino-consulta').trim(), p_personas: val('e-personas').trim(),
    // Bug real (2026-07-21): esto se mandaba SIEMPRE que se guardaba el drawer,
    // aunque el admin no hubiera tocado el campo "Fecha de captación" -- como el
    // input solo tiene fecha (sin hora), cada guardado reescribía fecha_creacion
    // a las 12:00 en punto, borrando la hora REAL de creación del lead cada vez
    // que se editaba cualquier otra cosa (estado, asesor, etc). Ahora solo se
    // manda si la fecha visible realmente cambió respecto a la que ya tenía el
    // lead -- si no cambió, se manda null y el RPC (coalesce) deja la hora real intacta.
    p_fecha_creacion: fechaVal && fechaVal !== (currentLead.fecha_creacion ? currentLead.fecha_creacion.slice(0, 10) : '')
      ? new Date(fechaVal + 'T12:00:00').toISOString()
      : null,
    p_fecha_estimada: val('e-fecha-estimada').trim(),
    p_monto_completo: montoCompletoRaw ? parseFloat(montoCompletoRaw) : null,
    p_monto_inicial: montoInicialRaw ? parseFloat(montoInicialRaw) : null,
    p_restante_pago: restantePagoRaw ? parseFloat(restantePagoRaw) : null,
  });
  if (error || !data?.ok) {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar cambios';
    err.textContent = 'No se pudo guardar: ' + (error?.message || data?.error || ''); return;
  }
  // Check animado (Fase 6) en vez de cerrar de una -- el botón muestra el
  // éxito un instante antes de que el drawer desaparezca, no solo el toast
  // que ya se lee después de que la pantalla cambió.
  btn.classList.add('guardado-ok');
  btn.innerHTML = '<i class="fas fa-check"></i> Guardado';
  okToast('Lead actualizado');
  await loadStats(); renderAll(); loadTable(); loadDestPeriodo();
  setTimeout(() => { btn.classList.remove('guardado-ok'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar cambios'; window.closeDrawer(); }, 450);
}

/* ---------- Revisión de vigencias del tarifario (admin) ----------
   Reemplaza el chequeo que se hacía a mano leyendo SQL. Es 100% determinista
   -- fechas, no criterio -- así que no pasa por ninguna IA: sale más barato,
   es instantáneo y no se equivoca. El RPC revisar_vigencias_tarifario hace
   todo el trabajo; acá solo se agrupa y se pinta. */
const VIG_GRUPOS = [
  { k: 'venta_cerrada', t: 'Ya no se puede vender', grave: true,
    d: 'El período de VENTA cerró, aunque el viaje sea más adelante. El bot las sigue ofreciendo hasta que se retiren.' },
  { k: 'vencida', t: 'Vencidas', grave: true,
    d: 'La fecha de fin ya pasó y siguen apareciendo en el catálogo.' },
  { k: 'venta_cierra_pronto', t: 'La venta cierra esta semana', grave: false,
    d: 'Todavía se venden, pero quedan pocos días. Avisale al equipo antes de que se caigan solas.' },
  { k: 'vence_pronto', t: 'Vencen esta semana', grave: false,
    d: 'Fecha de fin dentro de los próximos 7 días.' },
  { k: 'sin_fecha_con_pista', t: 'Sin fecha de fin, pero el texto la tiene', grave: false,
    d: 'El campo de fecha está vacío, así que se ofrecen para siempre — pero la vigencia está escrita en el texto. Poné la fecha y el filtro vuelve a funcionar solo.' },
  { k: 'dos_ventanas', t: 'Dos temporadas en la misma vigencia', grave: false,
    d: 'El texto declara dos rangos y el campo guarda solo el último: el hueco del medio no lo filtra nadie.' },
  { k: 'sin_fecha', t: 'Sin fecha de fin', grave: false,
    d: 'Se ofrecen para siempre. Puede estar bien (temporada abierta) o ser un olvido de carga.' },
];
let VIG_FILAS = [];

async function abrirRevisionVigencias() {
  openSheet('vigencias-sheet');
  const cuerpo = document.getElementById('vig-cuerpo');
  cuerpo.innerHTML = '<div class="tbl-state skel show"><div class="skel-bar"></div><div class="skel-bar"></div></div>';
  const { data, error } = await sb.rpc('revisar_vigencias_tarifario', { p_dias_aviso: 7 });
  if (error) { cuerpo.innerHTML = `<div class="vig-vacio">No se pudo revisar: ${esc(error.message)}</div>`; return; }
  VIG_FILAS = data || [];
  renderRevisionVigencias();
}

function renderRevisionVigencias() {
  const cuerpo = document.getElementById('vig-cuerpo');
  if (!VIG_FILAS.length) {
    cuerpo.innerHTML = '<div class="vig-vacio"><i class="fas fa-circle-check"></i><b>Todo en orden</b><div style="font-size:12.5px;margin-top:6px">No hay nada vencido ni por vencer en los próximos 7 días.</div></div>';
    return;
  }
  const porGrupo = k => VIG_FILAS.filter(f => f.problema === k);
  const paraRetirar = VIG_FILAS.filter(f => (f.problema === 'venta_cerrada' || f.problema === 'vencida') && !f.deja_sin_precio);
  const urgentes = porGrupo('venta_cerrada').length + porGrupo('vencida').length;
  const huerfanos = porGrupo('venta_cerrada').concat(porGrupo('vencida')).filter(f => f.deja_sin_precio).length;
  const proximos = porGrupo('venta_cierra_pronto').length + porGrupo('vence_pronto').length;
  const sinFecha = porGrupo('sin_fecha_con_pista').length + porGrupo('sin_fecha').length;

  const item = f => {
    const grave = f.problema === 'vencida' || f.problema === 'venta_cerrada';
    // La fecha que ya viene en el texto se ofrece precargada: es el arreglo de
    // raíz (llenar el campo) en vez de solo retirar el item de hoy.
    const sugerida = f.problema === 'sin_fecha_con_pista' ? (fechaSugeridaDeTexto(f.vigencia_texto) || '') : '';
    const cuando = [];
    if (f.fecha_venta) cuando.push(`venta hasta ${esc(fmtDiaCorto(f.fecha_venta))}`);
    if (f.fecha_fin) cuando.push(`fin ${esc(fmtDiaCorto(f.fecha_fin))}`);
    if (f.dias != null) cuando.push(f.dias < 0 ? `<b>hace ${Math.abs(f.dias)} día(s)</b>` : `en ${f.dias} día(s)`);
    return `<div class="vig-item ${grave ? 'grave' : ''}">
      <div class="vig-top">
        <div class="vig-nombre">${esc(f.nombre)}</div>
        <span class="vig-tipo">${f.tipo === 'promocion' ? 'Promo' : 'Tarifa'}</span>
      </div>
      ${f.precio_texto ? `<div class="vig-texto">${esc(f.precio_texto)}</div>` : ''}
      ${f.vigencia_texto ? `<div class="vig-texto">${esc(f.vigencia_texto)}</div>` : ''}
      ${cuando.length ? `<div class="vig-fechas">${cuando.join(' · ')}</div>` : ''}
      ${f.deja_sin_precio ? '<div class="vig-huerfano"><i class="fas fa-triangle-exclamation"></i> Es el único precio de este hotel: si lo retirás queda incotizable. Cargá el precio nuevo antes.</div>' : ''}
      <div class="vig-acc">
        ${grave ? '' : `<input type="date" class="ei" value="${esc(sugerida)}" data-vig-fecha="${f.tipo}:${f.item_id}">
        <button class="dbtn gh" data-vig-fijar="${f.tipo}:${f.item_id}"><i class="fas fa-calendar-day"></i> Poner fecha</button>`}
        <button class="dbtn peligro" data-vig-retirar="${f.tipo}:${f.item_id}"><i class="fas fa-eye-slash"></i> Retirar</button>
      </div>
    </div>`;
  };

  cuerpo.innerHTML = `
    <div class="vig-resumen">
      <div class="vig-kpi ${urgentes ? 'grave' : ''}"><b>${urgentes}</b><span>Retirar ya</span></div>
      <div class="vig-kpi ${proximos ? 'aviso' : ''}"><b>${proximos}</b><span>Esta semana</span></div>
      <div class="vig-kpi"><b>${sinFecha}</b><span>Sin fecha</span></div>
    </div>
    ${paraRetirar.length ? `<button class="dbtn peligro" id="vig-retirar-todo" type="button" style="width:100%;margin-bottom:${huerfanos ? '6' : '16'}px"><i class="fas fa-eye-slash"></i> Retirar los ${paraRetirar.length} que ya no se venden</button>` : ''}
    ${huerfanos ? `<div class="vig-grupo-d" style="margin-bottom:16px"><i class="fas fa-triangle-exclamation" style="color:var(--accent)"></i> ${huerfanos} quedan afuera del retiro masivo porque son el único precio de su hotel — revisalos uno por uno más abajo.</div>` : ''}
    ${VIG_GRUPOS.map(g => {
      const filas = porGrupo(g.k);
      if (!filas.length) return '';
      return `<div class="vig-grupo">
        <div class="vig-grupo-t">${esc(g.t)} <span class="vig-tipo">${filas.length}</span></div>
        <div class="vig-grupo-d">${esc(g.d)}</div>
        ${filas.map(item).join('')}
      </div>`;
    }).join('')}`;

  cuerpo.querySelectorAll('[data-vig-retirar]').forEach(b => b.addEventListener('click', () => retirarItemVigencia(b.dataset.vigRetirar, b)));
  cuerpo.querySelectorAll('[data-vig-fijar]').forEach(b => b.addEventListener('click', () => fijarFechaVigencia(b.dataset.vigFijar, b)));
  document.getElementById('vig-retirar-todo')?.addEventListener('click', retirarTodosLosVencidos);
}

// Primera fecha del texto que sea de hoy en adelante; si todas ya pasaron, la
// última. Es solo una sugerencia precargada -- el admin la revisa antes de
// guardarla, por eso no se aplica sola.
function fechaSugeridaDeTexto(texto) {
  const encontradas = [...String(texto || '').matchAll(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/g)].map(m => {
    const anio = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : new Date().getFullYear();
    const d = new Date(Date.UTC(anio, Number(m[2]) - 1, Number(m[1])));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }).filter(Boolean).sort();
  if (!encontradas.length) return '';
  const hoy = new Date().toISOString().slice(0, 10);
  return encontradas.find(f => f >= hoy) || encontradas[encontradas.length - 1];
}

function vigPartes(clave) { const [tipo, id] = clave.split(':'); return { tipo, id: Number(id) }; }

async function retirarItemVigencia(clave, btn) {
  const { tipo, id } = vigPartes(clave);
  btn.disabled = true;
  const { data, error } = await sb.rpc('retirar_item_tarifario', { p_tipo: tipo, p_id: id });
  if (error || !data?.ok) { btn.disabled = false; errToast('No se pudo retirar: ' + (error?.message || data?.error || '')); return; }
  VIG_FILAS = VIG_FILAS.filter(f => !(f.tipo === tipo && f.item_id === id));
  renderRevisionVigencias();
  okToast('Retirado del catálogo');
}

async function fijarFechaVigencia(clave, btn) {
  const { tipo, id } = vigPartes(clave);
  const input = btn.parentElement.querySelector('[data-vig-fecha]');
  const fecha = input?.value;
  if (!fecha) { errToast('Elegí la fecha de fin primero'); return; }
  btn.disabled = true;
  const { data, error } = await sb.rpc('fijar_fecha_fin_tarifario', { p_tipo: tipo, p_id: id, p_fecha: fecha });
  btn.disabled = false;
  if (error || !data?.ok) { errToast('No se pudo guardar: ' + (error?.message || data?.error || '')); return; }
  okToast('Fecha guardada');
  abrirRevisionVigencias();
}

async function retirarTodosLosVencidos() {
  // Nunca en bulk los que dejarían al hotel sin ningún precio: eso lo vuelve
  // incotizable y tiene que ser una decisión mirada, no un click.
  const objetivo = VIG_FILAS.filter(f => (f.problema === 'vencida' || f.problema === 'venta_cerrada') && !f.deja_sin_precio);
  if (!objetivo.length) return;
  const detalle = objetivo.slice(0, 6).map(f => `• ${f.nombre}`).join('\n');
  if (!(await confirmarSheet({ titulo: `Vas a retirar ${objetivo.length} item(s) del catálogo`, detalle: `${detalle}${objetivo.length > 6 ? `\n• ...y ${objetivo.length - 6} más` : ''}\n\nDejan de verse en el CRM, en la web y para el bot. Se pueden volver a activar a mano.`, textoOk: 'Retirar', destructivo: true }))) return;
  const btn = document.getElementById('vig-retirar-todo');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Retirando...';
  const res = await Promise.all(objetivo.map(f => sb.rpc('retirar_item_tarifario', { p_tipo: f.tipo, p_id: f.item_id })));
  const fallidos = res.filter(r => r.error || !r.data?.ok).length;
  (fallidos ? errToast : okToast)(fallidos ? `${objetivo.length - fallidos} retirados, ${fallidos} fallaron` : `${objetivo.length} retirados del catálogo`);
  await abrirRevisionVigencias();
  loadTarifario();
}

/* ---------- Actualizador de Tarifario (2026-07-30) ----------
   Tres cosas que antes no tenían pantalla: confirmar lo que la IA publicó,
   correr la actualización sin esperar al cron de cada 2 horas, y ver qué entró.

   La cola de revisión existe porque la ruta de imagen (flyers) publica todo con
   necesita_revision=true a propósito: Qwen3-VL lee bien los precios pero marcó
   necesita_revision_humana=false en los 4 flyers medidos, incluido uno con dos
   vigencias que se contradicen. Esa bandera del modelo no es señal de nada
   todavía, así que el filtro real lo pone una persona acá. */
let ACT_PENDIENTES = [];

async function abrirActualizadorTarifario(pestana) {
  openSheet('actualizador-sheet');
  actCambiarTab(pestana || 'revisar');
}

function actCambiarTab(clave) {
  document.querySelectorAll('#act-tabs .act-tab').forEach(b => b.classList.toggle('on', b.dataset.atab === clave));
  document.querySelectorAll('#actualizador-sheet .act-panel').forEach(p => p.classList.toggle('on', p.dataset.apanel === clave));
  // La pestaña Proceso se refresca sola: es lo único que muestra que la cadena
  // automática sigue viva. Se corta al salir para no dejar un timer huérfano.
  if (clave !== 'proceso') actPararRefresco();
  if (clave === 'revisar') cargarRevisionTarifario();
  else if (clave === 'proceso') cargarPanelProceso();
  else if (clave === 'portadas') cargarPanelPortadas();
  else if (clave === 'correr') cargarPanelCorrer();
  else if (clave === 'historial') cargarHistorialTarifario();
  // 'guia' es contenido estático ya pintado en index.html: no carga nada.
}

function actSkel(id) {
  document.getElementById(id).innerHTML = '<div class="tbl-state skel show"><div class="skel-bar"></div><div class="skel-bar"></div></div>';
}

/* --- Pestaña 1: por revisar --- */
async function cargarRevisionTarifario() {
  actSkel('act-panel-revisar');
  const { data, error } = await sb.rpc('revision_tarifario_pendientes');
  const cont = document.getElementById('act-panel-revisar');
  if (error) { cont.innerHTML = `<div class="vig-vacio">No se pudo cargar: ${esc(error.message)}</div>`; return; }
  ACT_PENDIENTES = data || [];
  actPintarPill();
  if (!ACT_PENDIENTES.length) {
    cont.innerHTML = '<div class="vig-vacio"><i class="fas fa-circle-check"></i><b>Nada por confirmar</b><div style="font-size:12.5px;margin-top:6px">Todo lo que publicó la IA ya está revisado.</div></div>';
    return;
  }
  const etiqueta = { promocion: 'Promo', tarifa: 'Tarifa', producto: 'Producto' };
  cont.innerHTML = `
    <div class="vig-grupo-d">Estos ${ACT_PENDIENTES.length} item(s) los publicó la IA y están esperando tu confirmación. Ya se ven en el catálogo — confirmarlos solo los saca de esta lista.</div>
    ${ACT_PENDIENTES.map(f => {
      const clave = `${f.tipo}:${f.item_id}`;
      const editable = f.tipo !== 'producto';
      return `<div class="act-rev" data-act-item="${clave}">
        <div class="act-rev-top">
          <div class="act-rev-nom">${esc(f.nombre || '(sin nombre)')}</div>
          <span class="vig-tipo">${etiqueta[f.tipo] || f.tipo}</span>
        </div>
        ${f.precio_texto ? `<div class="act-rev-precio">${esc(f.precio_texto)}</div>` : ''}
        ${f.vigencia_texto ? `<div class="act-rev-vig">${esc(f.vigencia_texto)}</div>` : ''}
        ${f.nota_revision ? `<div class="act-rev-nota"><i class="fas fa-triangle-exclamation"></i> ${esc(f.nota_revision)}</div>` : ''}
        <div class="act-rev-src"><i class="fas fa-file-lines"></i>${esc(f.fuente_archivo || 'sin archivo')}</div>
        <div class="act-rev-acc">
          <button class="dbtn primary" data-act-ok="${clave}"><i class="fas fa-check"></i> Está bien</button>
          ${editable ? `<button class="dbtn" data-act-edit="${clave}"><i class="fas fa-pen"></i> Corregir precio</button>` : ''}
          <button class="dbtn" data-act-quitar="${clave}"><i class="fas fa-eye-slash"></i> Quitar</button>
        </div>
        ${editable ? `<div class="act-rev-edit" data-act-editrow="${clave}">
          <input class="ei" data-act-precio type="text" value="${esc(f.precio_texto || '')}" placeholder="Precio corregido">
          <button class="dbtn primary" data-act-guardar="${clave}">Guardar</button>
        </div>` : ''}
      </div>`;
    }).join('')}`;
}

function actPintarPill() {
  const pill = document.getElementById('act-pill-rev');
  if (!pill) return;
  pill.textContent = ACT_PENDIENTES.length;
  pill.hidden = !ACT_PENDIENTES.length;
}

function actPartes(clave) {
  const [tipo, id] = clave.split(':');
  return { tipo, id: Number(id) };
}

async function actAprobar(clave, btn) {
  const { tipo, id } = actPartes(clave);
  btn.disabled = true;
  const { data, error } = await sb.rpc('aprobar_item_tarifario', { p_tipo: tipo, p_id: id });
  if (error || !data?.ok) { btn.disabled = false; errToast('No se pudo confirmar: ' + (error?.message || data?.error || '')); return; }
  okToast('Confirmado');
  await cargarRevisionTarifario();
}

async function actGuardarPrecio(clave, btn) {
  const { tipo, id } = actPartes(clave);
  const input = document.querySelector(`[data-act-editrow="${clave}"] [data-act-precio]`);
  const precio = input?.value?.trim();
  if (!precio) { errToast('Escribí el precio corregido'); return; }
  btn.disabled = true;
  const { data, error } = await sb.rpc('corregir_precio_tarifario', { p_tipo: tipo, p_id: id, p_precio_texto: precio });
  if (error || !data?.ok) { btn.disabled = false; errToast('No se pudo guardar: ' + (error?.message || data?.error || '')); return; }
  okToast('Precio corregido');
  await cargarRevisionTarifario();
  loadTarifario();
}

async function actQuitar(clave, btn) {
  const { tipo, id } = actPartes(clave);
  const item = ACT_PENDIENTES.find(f => `${f.tipo}:${f.item_id}` === clave);
  if (tipo === 'producto') { errToast('Los productos se ocultan desde el panel de configuración del tarifario'); return; }
  if (!(await confirmarSheet({ titulo: `Quitar "${item?.nombre || 'este item'}" del catálogo`, detalle: 'Deja de verse en el CRM, en la web y para el bot. Se puede volver a activar a mano.', textoOk: 'Quitar', destructivo: true }))) return;
  btn.disabled = true;
  const { data, error } = await sb.rpc('retirar_item_tarifario', { p_tipo: tipo, p_id: id });
  if (error || !data?.ok) { btn.disabled = false; errToast('No se pudo quitar: ' + (error?.message || data?.error || '')); return; }
  okToast('Quitado del catálogo');
  await cargarRevisionTarifario();
  loadTarifario();
}

/* ================= CEREBRO IA: las reglas de venta =========================
   Hasta el 01/08/2026, "para Madrid ofrecé primero el vuelo de $999" era una
   línea escrita a mano dentro de un prompt de 1.500 líneas: cada cambio pedía
   una sesión de programación. Peor: el prompt estaba duplicado entre Instagram
   y la web, así que una regla podía quedar aplicada en un canal y no en el otro
   sin que nada avisara. Acá son datos, y valen para los 3 canales a la vez.

   La regla se guarda como TEXTO libre, no como una lista ordenada de hoteles,
   porque las reglas reales tienen matices que una lista no aguanta ("solo si el
   lead deja claro que quiere un hotel de verdad, no cabañas"). El editor
   redacta el caso simple por vos e inserta la marca [hotel#N] con un botón. */
let CE_REGLAS = [];
let CE_DESTINOS = [];
let CE_EDITANDO = null;
let CE_AUDIO_CANALES = [];

async function loadCerebroIA() {
  const cont = document.getElementById('ce-lista');
  const { data, error } = await sb.rpc('reglas_venta_listar');
  if (error || !data?.ok) {
    cont.innerHTML = `<div class="vig-vacio">No se pudieron cargar las reglas: ${esc(error?.message || data?.error || '')}</div>`;
    return;
  }
  CE_REGLAS = data.reglas || [];
  CE_DESTINOS = data.destinos || [];
  document.getElementById('ce-destinos').innerHTML =
    CE_DESTINOS.map(d => `<option value="${esc(d)}">`).join('');
  cePintarLista();
  cePintarPrevia();
  await cargarAudioCanales();
}

async function cargarAudioCanales() {
  const { data, error } = await sb.rpc('config_audio_canal_listar');
  if (error || !data?.ok) return;
  CE_AUDIO_CANALES = data.canales || [];
  cePintarAudioCanales();
}

const AUDIO_CANAL_LABEL = { web: 'Web', manychat: 'Instagram/Facebook' };

function cePintarAudioCanales() {
  document.querySelectorAll('#ce-audio-canales [data-audio-canal]').forEach(btn => {
    const canal = btn.dataset.audioCanal;
    const fila = CE_AUDIO_CANALES.find(c => c.canal === canal);
    const activo = !!fila?.activo;
    btn.classList.toggle('on', activo);
    btn.innerHTML = `<i class="fas fa-toggle-${activo ? 'on' : 'off'}"></i> ${AUDIO_CANAL_LABEL[canal] || canal}`;
  });
}

async function toggleAudioCanal(canal, btn) {
  const fila = CE_AUDIO_CANALES.find(c => c.canal === canal);
  const activoNuevo = !fila?.activo;
  btn.disabled = true;
  const { data, error } = await sb.rpc('config_audio_canal_set', { p_canal: canal, p_activo: activoNuevo });
  btn.disabled = false;
  if (error || !data?.ok) { errToast('No se pudo cambiar: ' + (error?.message || data?.error || '')); return; }
  okToast(activoNuevo ? 'Notas de voz activadas para ese canal' : 'Notas de voz apagadas para ese canal');
  await cargarAudioCanales();
}

function cePintarLista() {
  const cont = document.getElementById('ce-lista');
  if (!CE_REGLAS.length) {
    cont.innerHTML = `<div class="vig-vacio"><i class="fas fa-brain"></i><b>Todavía no hay reglas</b>
      <div style="font-size:12.5px;margin-top:6px">La IA vende con su criterio general: primero la promo más económica, después todo incluido.</div></div>`;
    return;
  }
  // Agrupadas igual que como las lee la IA: primero las que valen siempre,
  // después cada destino. El orden de la pantalla ES el orden del prompt.
  const generales = CE_REGLAS.filter(r => r.ambito === 'general');
  const porDestino = new Map();
  for (const r of CE_REGLAS.filter(r => r.ambito === 'destino')) {
    if (!porDestino.has(r.destino)) porDestino.set(r.destino, []);
    porDestino.get(r.destino).push(r);
  }
  const grupo = (titulo, reglas, icono) => `
    <div class="ce-grupo">
      <div class="ce-grupo-t"><i class="fas fa-${icono}"></i> ${titulo}</div>
      ${reglas.map(ceCardHtml).join('')}
    </div>`;
  cont.innerHTML =
    (generales.length ? grupo('Siempre, en cualquier destino', generales, 'globe') : '') +
    [...porDestino.entries()].map(([d, rs]) =>
      grupo(`Solo para <span class="ce-dest">${esc(d)}</span>`, rs, 'location-dot')).join('');
}

function ceCardHtml(r, i) {
  const prods = (r.productos || []).map(p => p.foto
    ? `<span class="ce-prod${p.activo ? '' : ' roto'}"><img src="${esc(fotoMini(p.foto, 256))}" alt="" loading="lazy"><span>${esc(p.nombre)}</span></span>`
    : `<span class="ce-prod${p.activo ? '' : ' roto'}"><span class="ce-prod-sf"><i class="fas fa-hotel"></i></span><span>${esc(p.nombre)}</span></span>`).join('');
  // Un hotel nombrado que ya no está en el catálogo hace que la regla mande a
  // ofrecer algo que no existe. Se avisa acá y no en la vista previa, que casi
  // nadie abre.
  const rotos = (r.productos || []).filter(p => !p.activo).length;
  const vig = r.vence_el
    ? `<span class="ce-vig${r.vencida ? ' vencida' : ''}"><i class="fas fa-${r.vencida ? 'circle-xmark' : 'calendar-day'}"></i>
        ${r.vencida ? 'Venció el' : 'Hasta el'} ${fmtFechaSolo(r.vence_el)}${r.vencida ? ' — la IA ya no la usa' : ''}</span>`
    : `<span class="ce-vig eterna"><i class="fas fa-infinity"></i> Sin fecha de fin</span>`;
  return `<div class="ce-card${r.activa && !r.vencida ? '' : ' apagada'}" data-ce-id="${r.id}">
    <div class="ce-card-top">
      <div class="ce-orden">${i + 1}</div>
      <div class="ce-texto">${esc(r.texto)}</div>
    </div>
    ${prods ? `<div class="ce-prods">${prods}</div>` : ''}
    ${rotos ? `<div class="ce-ayuda" style="color:#fca5a5"><i class="fas fa-triangle-exclamation"></i>
       ${rotos === 1 ? 'Un hotel que nombra esta regla ya no está en el catálogo' : `${rotos} hoteles que nombra esta regla ya no están en el catálogo`}: la IA va a ofrecer algo que no existe.</div>` : ''}
    <div class="ce-pie">
      ${vig}
      <div class="ce-acc">
        <button class="ce-mini${r.activa ? ' on' : ''}" data-ce-toggle="${r.id}">
          <i class="fas fa-${r.activa ? 'toggle-on' : 'toggle-off'}"></i> ${r.activa ? 'Activa' : 'Apagada'}</button>
        <button class="ce-mini" data-ce-editar="${r.id}"><i class="fas fa-pen"></i> Editar</button>
        <button class="ce-mini peligro" data-ce-borrar="${r.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  </div>`;
}

// La vista previa se arma en el navegador con las MISMAS reglas que devolvió el
// RPC, no con otra consulta: si mostrara algo distinto a lo que se acaba de
// editar, sería peor que no mostrar nada.
function cePintarPrevia() {
  const hoy = new Date().toISOString().slice(0, 10);
  const vivas = CE_REGLAS
    .filter(r => r.activa && (!r.vence_el || r.vence_el >= hoy))
    .sort((a, b) => (a.ambito === 'general' ? 0 : 1) - (b.ambito === 'general' ? 0 : 1)
      || a.orden - b.orden || a.id - b.id);
  document.getElementById('ce-previa-txt').textContent =
    vivas.map(r => r.texto).join('\n') || '(sin reglas activas)';
}

function ceAbrirEditor(regla) {
  CE_EDITANDO = regla;
  document.getElementById('ce-editor-titulo').innerHTML =
    `<i class="fas fa-brain"></i> ${regla ? 'Editar regla' : 'Nueva regla'}`;
  document.getElementById('ce-ambito').value = regla?.ambito || 'destino';
  document.getElementById('ce-destino').value = regla?.destino || '';
  document.getElementById('ce-texto').value = regla?.texto || '';
  document.getElementById('ce-vence').value = regla?.vence_el || '';
  ceMostrarCampoDestino();
  ceLlenarSelectorProductos();
  openSheet('ce-editor-sheet');
}

function ceMostrarCampoDestino() {
  const esDestino = document.getElementById('ce-ambito').value === 'destino';
  document.getElementById('ce-campo-destino').style.display = esDestino ? '' : 'none';
}

// El selector se llena del tarifario ya cargado. Si el usuario entró directo a
// esta sección sin pasar por Tarifario, se pide una vez.
async function ceLlenarSelectorProductos() {
  const sel = document.getElementById('ce-prod-sel');
  if (sel.dataset.lleno) return;
  const { data } = await sb.from('productos').select('id,nombre,destino')
    .eq('activo', true).order('destino').order('nombre');
  sel.innerHTML = '<option value="">Nombrar un hotel…</option>' +
    (data || []).map(p => `<option value="${p.id}">${esc(p.nombre)}${p.destino ? ` — ${esc(p.destino)}` : ''}</option>`).join('');
  sel.dataset.lleno = '1';
}

function ceInsertarProducto() {
  const sel = document.getElementById('ce-prod-sel');
  if (!sel.value) { errToast('Elegí un hotel de la lista'); return; }
  const nombre = sel.options[sel.selectedIndex].text.split(' — ')[0];
  const ta = document.getElementById('ce-texto');
  // Se inserta donde está el cursor, no al final: la referencia casi siempre va
  // en medio de la frase ("ofrecé primero el X porque...").
  const ini = ta.selectionStart ?? ta.value.length;
  const fin = ta.selectionEnd ?? ta.value.length;
  const marca = `${nombre} [hotel#${sel.value}]`;
  ta.value = ta.value.slice(0, ini) + marca + ta.value.slice(fin);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = ini + marca.length;
  sel.value = '';
}

async function ceGuardar(btn) {
  const ambito = document.getElementById('ce-ambito').value;
  const destino = document.getElementById('ce-destino').value.trim();
  const texto = document.getElementById('ce-texto').value.trim();
  const vence = document.getElementById('ce-vence').value || null;
  if (!texto) { errToast('Escribí la instrucción'); return; }
  if (ambito === 'destino' && !destino) { errToast('Elegí el destino'); return; }
  // Avisar, no bloquear: un destino nuevo puede ser legítimo (un producto que
  // se carga mañana), pero un typo silencioso deja la regla sin aplicarse nunca.
  if (ambito === 'destino' && CE_DESTINOS.length && !CE_DESTINOS.includes(destino)
      && !(await confirmarSheet({ titulo: `"${destino}" no coincide con ningún destino del tarifario`, detalle: 'La regla se guarda igual, pero no se va a aplicar hasta que exista un producto con ese destino escrito igual.', textoOk: 'Guardar de todos modos' }))) return;

  btn.disabled = true;
  const { data, error } = await sb.rpc('regla_venta_guardar', {
    p_id: CE_EDITANDO?.id ?? null, p_ambito: ambito,
    p_destino: ambito === 'destino' ? destino : null,
    p_texto: texto, p_orden: CE_EDITANDO?.orden ?? 100, p_vence_el: vence,
  });
  btn.disabled = false;
  if (error || !data?.ok) { errToast('No se pudo guardar: ' + (error?.message || data?.error || '')); return; }
  okToast(CE_EDITANDO ? 'Regla actualizada' : 'Regla creada');
  closeSheet('ce-editor-sheet');
  await loadCerebroIA();
}

async function ceToggle(id, btn) {
  const r = CE_REGLAS.find(x => x.id === Number(id));
  btn.disabled = true;
  const { data, error } = await sb.rpc('regla_venta_activar', { p_id: Number(id), p_activa: !r.activa });
  btn.disabled = false;
  if (error || !data?.ok) { errToast('No se pudo cambiar: ' + (error?.message || data?.error || '')); return; }
  okToast(r.activa ? 'Regla apagada — la IA deja de usarla' : 'Regla activa — la IA ya la está usando');
  await loadCerebroIA();
}

async function ceBorrar(id, btn) {
  const r = CE_REGLAS.find(x => x.id === Number(id));
  if (!(await confirmarSheet({ titulo: 'Borrar esta regla para siempre', detalle: `"${(r?.texto || '').slice(0, 120)}…"\n\nSi solo querés que la IA deje de usarla, mejor apagala: así la podés volver a prender.`, textoOk: 'Borrar', destructivo: true }))) return;
  btn.disabled = true;
  const { data, error } = await sb.rpc('regla_venta_borrar', { p_id: Number(id) });
  btn.disabled = false;
  if (error || !data?.ok) { errToast('No se pudo borrar: ' + (error?.message || data?.error || '')); return; }
  okToast('Regla borrada');
  await loadCerebroIA();
}

/* --- Probar: qué contestaría la IA -----------------------------------------
   Antes de esto, probar un cambio en cómo vende la IA era desplegar una función
   descartable, llamarla, leer el JSON crudo y borrarla -- lo podía hacer una
   sola persona. Acá lo hace cualquier admin en el momento de escribir la regla.
   La función de atrás NO escribe nada: ni leads, ni sesiones, ni avisos. */
const CP_SUGERENCIAS = [
  'hola, cuánto sale ir a Margarita en agosto para 2 personas?',
  'quiero ir a Madrid, qué tienen?',
  'vi un reel de ustedes con otro precio, por qué me lo cambian?',
  'info de Canaima porfa',
  'están contratando?',
];

function cpPintarSugerencias() {
  const cont = document.getElementById('cp-sugerencias');
  if (!cont || cont.dataset.pintado) return;
  cont.innerHTML = CP_SUGERENCIAS.map(s => `<button class="ce-sug" type="button" data-cp-sug="${esc(s)}">${esc(s)}</button>`).join('');
  cont.dataset.pintado = '1';
}

async function cpProbar(btn) {
  const mensaje = document.getElementById('cp-mensaje').value.trim();
  if (!mensaje) { errToast('Escribí el mensaje del cliente'); return; }
  const canal = document.getElementById('cp-canal').value;
  const salida = document.getElementById('cp-resultado');
  btn.disabled = true;
  salida.innerHTML = `<div class="cp-pensando"><i class="fas fa-circle-notch fa-spin"></i> Preguntándole a la IA con el tarifario de este momento…</div>`;

  const cerebro_id = Number(document.getElementById('cp-cerebro')?.value) || null;
  const { data, error } = await sb.functions.invoke('probar-cerebro-ia', { body: { mensaje, canal, cerebro_id } });
  btn.disabled = false;

  if (error || !data?.ok) {
    // El detalle del modelo importa: un timeout y una regla mal escrita se
    // arreglan de formas muy distintas.
    const motivo = data?.detalle || data?.error || error?.message || 'error desconocido';
    salida.innerHTML = `<div class="vig-vacio" style="text-align:left">
      <b>No se pudo probar.</b><div style="font-size:12.5px;margin-top:6px">${esc(motivo)}</div></div>`;
    return;
  }

  const c = data.contexto || {};
  const precio = data.precio_citado;
  salida.innerHTML = `
    <div class="cp-chat">
      <div class="cp-burbuja cp-cliente"><div class="cp-quien">El cliente</div>${esc(mensaje)}</div>
      <div class="cp-burbuja cp-ia"><div class="cp-quien">La IA responde</div>${esc(data.respuesta || '(vacío)')}</div>
    </div>
    <div class="cp-meta">
      ${precio ? `<span class="cp-tag precio"><i class="fas fa-tag"></i> Cotizó $${esc(String(precio.monto))}</span>` : ''}
      <span class="cp-tag">${c.reglas_aplicadas || 0} línea(s) de reglas</span>
      <span class="cp-tag">${c.productos || 0} hoteles · ${c.promociones || 0} promos</span>
      ${c.cerebro_id ? `<span class="cp-tag"><i class="fas fa-sitemap"></i> ${esc(CB_ARBOL.find(n => n.id === c.cerebro_id)?.nombre || '')}</span>` : ''}
    </div>
    ${data.verificacion ? `<details class="cp-verif"><summary>Por qué contestó eso</summary><p>${esc(data.verificacion)}</p></details>` : ''}`;
}

/* --- Cargar flyer: de la captura al tarifario -------------------------------
   Dos pasos SIEMPRE, nunca uno: la IA lee y muestra, la persona corrige y
   confirma. El 31/07/2026 el modelo leyó bien un flyer de Chichiriviche y la
   respuesta al cliente igual salió mal, porque el precio quedó enterrado al
   final de una línea larga -- leer bien no alcanza, hay que ver cómo queda. */
let FL_ITEM = null, FL_NOMBRE = '';

// La imagen se achica acá y no en el servidor: subir 4 MB de captura para que
// el modelo mire 1280px es pagar egress y esperar por nada.
function flAchicar(file, maxLado = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      // JPEG siempre: el modelo no gana nada con PNG y pesa el triple.
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('No se pudo abrir la imagen')); };
    img.src = URL.createObjectURL(file);
  });
}

async function flLeer(file) {
  const drop = document.getElementById('fl-drop');
  const salida = document.getElementById('fl-resultado');
  FL_NOMBRE = file.name || 'flyer';
  drop.classList.add('cargando');
  salida.innerHTML = `<div class="cp-pensando"><i class="fas fa-circle-notch fa-spin"></i> Leyendo el flyer…</div>`;

  let dataUrl;
  try { dataUrl = await flAchicar(file); }
  catch (e) { drop.classList.remove('cargando'); salida.innerHTML = ''; errToast(e.message); return; }
  document.getElementById('fl-previa').innerHTML = `<img class="fl-mini" src="${dataUrl}" alt="" style="width:120px;border-radius:12px;border:1px solid var(--line2);margin-top:14px">`;

  const { data, error } = await sb.functions.invoke('flyer-a-tarifario', {
    body: { accion: 'leer', imagen_base64: dataUrl.split(',')[1], mime_type: 'image/jpeg', nombre_archivo: FL_NOMBRE },
  });
  drop.classList.remove('cargando');
  if (error || !data?.ok) {
    salida.innerHTML = `<div class="vig-vacio" style="text-align:left"><b>No se pudo leer el flyer.</b>
      <div style="font-size:12.5px;margin-top:6px">${esc(data?.detalle || data?.error || error?.message || '')}</div></div>`;
    return;
  }
  FL_ITEM = data.item;
  flPintarRevision(data.modelo);
}

function flPintarRevision(modelo) {
  const it = FL_ITEM || {};
  const esPromo = it.clase === 'promocion';
  const tarifa = (it.tarifas || [])[0] || {};
  const precio = esPromo ? (it.promocion?.precio_texto || '') : (tarifa.precio_texto || '');
  const vigencia = esPromo ? (it.promocion?.vigencia_texto || '') : (tarifa.vigencia_texto || '');
  document.getElementById('fl-resultado').innerHTML = `
    <div class="fl-rev">
      <div class="fl-rev-t"><i class="fas fa-eye"></i> Esto entendió — corregilo antes de publicar</div>
      ${it.clase === 'no_aplica' ? `<div class="fl-alerta"><i class="fas fa-triangle-exclamation"></i>
        La IA no reconoció una promoción en esta imagen. Si igual querés cargarla, completá los campos a mano.</div>` : ''}
      ${it.nota_revision ? `<div class="fl-alerta"><i class="fas fa-circle-info"></i> ${esc(it.nota_revision)}</div>` : ''}
      <div class="ce-campo">
        <label class="ce-lbl">¿Qué es?</label>
        <select class="ei" id="fl-clase">
          <option value="promocion"${esPromo ? ' selected' : ''}>Una promoción de un hotel que ya existe</option>
          <option value="producto"${!esPromo ? ' selected' : ''}>Un hotel o paquete nuevo</option>
        </select>
      </div>
      <div class="ce-campo">
        <label class="ce-lbl">Nombre del hotel</label>
        <input class="ei" id="fl-nombre" type="text" value="${esc(it.nombre || '')}">
        <div class="ce-ayuda">Si el hotel ya existe, escribilo IGUAL que en el tarifario: así la promo se le engancha en vez de crear uno repetido.</div>
      </div>
      <div class="ce-campo">
        <label class="ce-lbl">Destino</label>
        <input class="ei" id="fl-destino" type="text" value="${esc(it.destino || '')}">
      </div>
      <div class="ce-campo">
        <label class="ce-lbl">Precio, tal cual se lo va a decir al cliente</label>
        <textarea class="ei" id="fl-precio" rows="3">${esc(precio)}</textarea>
        <div class="ce-ayuda">Poné adelante el dato que el cliente vio en la publicación. Si el reel dice "$18 por persona",
          que esa frase esté al principio y no al final: la IA lee de arriba hacia abajo y lo que queda enterrado lo pasa por alto.</div>
      </div>
      <div class="ce-campo">
        <label class="ce-lbl">Vigencia</label>
        <input class="ei" id="fl-vigencia" type="text" value="${esc(vigencia)}" placeholder="Ej. Del 01/08 al 15/09">
      </div>
      <div class="ce-campo">
        <label class="ce-lbl">Qué incluye / descripción</label>
        <textarea class="ei" id="fl-descripcion" rows="3">${esc(it.descripcion || '')}</textarea>
      </div>
      <div class="fl-acc">
        <button class="dbtn gh" id="fl-cancelar">Descartar</button>
        <button class="dbtn primary" id="fl-publicar"><i class="fas fa-check"></i> Publicar al tarifario</button>
      </div>
      ${modelo ? `<div style="font-size:11px;color:var(--muted2);margin-top:12px;text-align:center">Leído con ${esc(modelo)}</div>` : ''}
    </div>`;
  document.getElementById('fl-publicar').addEventListener('click', (e) => flPublicar(e.currentTarget));
  document.getElementById('fl-cancelar').addEventListener('click', flLimpiar);
}

function flLimpiar() {
  FL_ITEM = null;
  document.getElementById('fl-resultado').innerHTML = '';
  document.getElementById('fl-previa').innerHTML = '';
  document.getElementById('fl-file').value = '';
}

async function flPublicar(btn) {
  const clase = document.getElementById('fl-clase').value;
  const nombre = document.getElementById('fl-nombre').value.trim();
  const precio = document.getElementById('fl-precio').value.trim();
  if (!nombre) { errToast('Falta el nombre del hotel'); return; }
  if (!precio) { errToast('Falta el precio'); return; }
  if (!(await confirmarSheet({ titulo: 'Publicar al tarifario', detalle: `${nombre}\n${precio.slice(0, 140)}\n\nSe va a ver en la web y la IA lo va a poder cotizar. Queda marcado "por revisar" en el Actualizador.`, textoOk: 'Publicar' }))) return;

  const vigencia = document.getElementById('fl-vigencia').value.trim() || null;
  const item = {
    clase,
    tipo_producto: clase === 'producto' ? (FL_ITEM?.tipo_producto || 'hotel') : null,
    nombre,
    destino: document.getElementById('fl-destino').value.trim() || null,
    descripcion: document.getElementById('fl-descripcion').value.trim() || null,
    requisitos: FL_ITEM?.requisitos || null,
    tarifas: clase === 'producto' ? [{ precio_texto: precio, vigencia_texto: vigencia, moneda: 'USD' }] : [],
    promocion: clase === 'promocion' ? { precio_texto: precio, vigencia_texto: vigencia, moneda: 'USD' } : null,
    nota_revision: 'Cargado a mano desde un flyer en el CRM.',
  };
  btn.disabled = true;
  const { data, error } = await sb.functions.invoke('flyer-a-tarifario', {
    body: { accion: 'publicar', item, nombre_archivo: FL_NOMBRE },
  });
  btn.disabled = false;
  if (error || !data?.ok) { errToast('No se pudo publicar: ' + (data?.error || error?.message || '')); return; }

  // El salto de precio contra lo que ya había es la señal más útil de que el
  // modelo leyó mal un número. Se avisa fuerte, no en un toast que se va solo.
  if (data.precio_alerta) {
    document.getElementById('fl-resultado').innerHTML = `<div class="fl-rev">
      <div class="fl-alerta"><i class="fas fa-triangle-exclamation"></i>
        <b>Publicado, pero revisalo.</b> El precio quedó ${data.precio_delta_pct > 0 ? 'un ' + Math.round(data.precio_delta_pct) + '% más alto' : 'un ' + Math.abs(Math.round(data.precio_delta_pct)) + '% más bajo'}
        que el que había para este hotel. Si el flyer decía otra cosa, corregilo en el Actualizador.</div></div>`;
  } else {
    okToast('Publicado al tarifario — quedó marcado por revisar');
    flLimpiar();
  }
  delete tarCache[tarTab];
}

/* --- Ramas del cerebro: ver de dónde sale cada pedazo del prompt ------------
   Esta pantalla existe por un incidente concreto: el 01/08 el prompt terminó
   duplicado y la IA sirvió 2.693 precios retirados durante un día. Nadie lo vio
   leyendo el código -- se vio comparando el texto GENERADO. Así que acá se
   muestra el texto generado, no las tablas que lo arman, y cada edición
   contesta primero "qué cambió" antes de guardarse. */
let CB_ARBOL = [], CB_SEL = null, CB_BLOQUES = [], CB_PROMPT = '';

const cbCanal = () => document.getElementById('cb-canal')?.value || 'instagram';
const cbTexto = () => CB_BLOQUES.map(b => b.texto).join('\n');

async function loadCerebroRamas() {
  const cont = document.getElementById('cb-arbol');
  const { data, error } = await sb.rpc('cerebro_arbol');
  if (error) {
    cont.innerHTML = `<div class="vig-vacio">No se pudo cargar el árbol: ${esc(error.message)}</div>`;
    return;
  }
  CB_ARBOL = data || [];
  if (!CB_SEL || !CB_ARBOL.some(n => n.id === CB_SEL)) {
    CB_SEL = (CB_ARBOL.find(n => !n.padre_id) || CB_ARBOL[0])?.id ?? null;
  }
  cbPintarArbol();
  cbPintarSelectorPrueba();
  await cbCargarBloques();
}

function cbPintarArbol() {
  document.getElementById('cb-arbol').innerHTML = CB_ARBOL.map(n => {
    const esBase = !n.padre_id;
    const sub = esBase
      ? 'Personalidad, honestidad y escalada. La heredan todas las ramas.'
      : `${n.productos} hotel(es) propios · ${n.catalogo_publico ? 'catálogo publicado en la web' : 'catálogo privado'}`;
    // Las acciones van fuera del botón del nodo: un <button> dentro de otro no
    // es HTML válido y el navegador lo desarma por su cuenta.
    return `<div class="cb-fila ${esBase ? '' : 'hijo'}">
      <button class="cb-nodo ${n.id === CB_SEL ? 'on' : ''}" data-cb-nodo="${n.id}">
        <span class="cb-ico"><i class="fas ${esBase ? 'fa-brain' : 'fa-store'}"></i></span>
        <span class="cb-nom">${esc(n.nombre)}${n.activo ? '' : ' (apagada)'}
          <div class="cb-sub">${esc(sub)} · ${n.bloques_propios} bloque(s) propios</div></span>
      </button>
      ${esBase ? '' : `<span class="cb-acc">
        <button class="ce-mini" data-cb-activar="${n.id}" data-cb-a="${n.activo ? '0' : '1'}">${n.activo ? 'Apagar' : 'Prender'}</button>
        <button class="ce-mini peligro" data-cb-borrar="${n.id}">Borrar</button>
      </span>`}
    </div>`;
  }).join('');
}

function cbFormAlta(abrir) {
  const caja = document.getElementById('cb-alta');
  caja.style.display = abrir ? '' : 'none';
  if (!abrir) return;
  document.getElementById('cb-nombre').value = '';
  document.getElementById('cb-slug').value = '';
  document.getElementById('cb-padre').innerHTML = CB_ARBOL.filter(n => n.activo)
    .map(n => `<option value="${n.id}"${n.padre_id ? '' : ' selected'}>${esc(n.nombre)}${n.padre_id ? '' : ' (la Base)'}</option>`).join('');
  document.getElementById('cb-nombre').focus();
}

// El identificador se propone solo a partir del nombre, pero se puede corregir:
// escribirlo a mano es la parte más fácil de equivocar y la más cara de cambiar
// después (queda enganchado al enrutado de los mensajes).
const cbSlugificar = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);

async function cbCrear(btn) {
  const nombre = document.getElementById('cb-nombre').value.trim();
  const slug = document.getElementById('cb-slug').value.trim();
  const padre = Number(document.getElementById('cb-padre').value) || null;
  if (!nombre) { errToast('Ponele el nombre de la posada'); return; }
  btn.disabled = true;
  const { data, error } = await sb.rpc('crear_rama_cerebro', { p_nombre: nombre, p_slug: slug || cbSlugificar(nombre), p_padre_id: padre });
  btn.disabled = false;
  if (error || !data?.ok) { errToast(data?.error || error?.message || 'No se pudo crear'); return; }
  okToast(`Rama "${nombre}" creada. Hereda todo lo de la Base y todavía no tiene catálogo.`);
  CB_SEL = data.cerebro_id;
  cbFormAlta(false);
  await loadCerebroRamas();
}

async function cbActivar(id, activo, btn) {
  btn.disabled = true;
  const { data, error } = await sb.rpc('activar_rama_cerebro', { p_cerebro_id: Number(id), p_activo: activo });
  btn.disabled = false;
  if (error || !data?.ok) { errToast(data?.error || error?.message || 'No se pudo cambiar'); return; }
  await loadCerebroRamas();
}

async function cbBorrar(id, btn) {
  const nodo = CB_ARBOL.find(n => n.id === Number(id));
  if (!(await confirmarSheet({ titulo: `¿Borrar la rama "${nodo?.nombre ?? id}"?`, detalle: 'Solo se puede si nunca se le cargó catálogo.', textoOk: 'Borrar', destructivo: true }))) return;
  btn.disabled = true;
  const { data, error } = await sb.rpc('borrar_rama_cerebro', { p_cerebro_id: Number(id) });
  btn.disabled = false;
  if (error || !data?.ok) { errToast(data?.error || error?.message || 'No se pudo borrar'); return; }
  okToast('Rama borrada.');
  CB_SEL = null;
  await loadCerebroRamas();
}

function cbPintarSelectorPrueba() {
  const sel = document.getElementById('cp-cerebro');
  if (!sel) return;
  const previo = sel.value;
  sel.innerHTML = CB_ARBOL.map(n =>
    `<option value="${n.id}">${esc(n.nombre)}${n.padre_id ? '' : ' (lienzo en blanco)'}</option>`).join('');
  if (previo && CB_ARBOL.some(n => String(n.id) === previo)) sel.value = previo;
  else sel.value = String(CB_ARBOL.find(n => n.padre_id)?.id ?? CB_ARBOL[0]?.id ?? '');
}

async function cbCargarBloques() {
  const cont = document.getElementById('cb-prompt');
  cont.innerHTML = `<div class="tbl-state skel show"><div class="skel-bar"></div><div class="skel-bar"></div></div>`;
  const { data, error } = await sb.rpc('cerebro_bloques_resueltos', { p_cerebro_id: CB_SEL, p_canal: cbCanal() });
  if (error) {
    cont.innerHTML = `<div class="vig-vacio">No se pudo componer el prompt: ${esc(error.message)}</div>`;
    return;
  }
  CB_BLOQUES = data || [];
  CB_PROMPT = cbTexto();
  cbPintarBloques();
}

function cbPintarBloques() {
  const propios = CB_BLOQUES.filter(b => b.propio).length;
  const anulan = CB_BLOQUES.filter(b => b.anula).length;
  const cont = document.getElementById('cb-prompt');
  cont.innerHTML = `<div class="cb-resumen">
      El modelo recibe <b>${CB_BLOQUES.length} bloque(s)</b> · <b>${(CB_PROMPT.length).toLocaleString('es')}</b> caracteres.
      ${propios} de esta rama, ${CB_BLOQUES.length - propios} heredados${anulan ? `, ${anulan} reemplazan uno de la Base` : ''}.
    </div>` + CB_BLOQUES.map(b => {
    const marca = b.tipo !== 'texto';
    const clase = marca ? 'marca' : b.anula ? 'anula' : b.propio ? 'propio' : 'heredado';
    const etiqueta = marca ? 'Se rellena con su catálogo'
      : b.anula ? 'Reemplaza lo de la Base' : b.propio ? 'De esta rama' : 'Heredado';
    return `<div class="cb-bloque ${clase}" data-cb-bloque="${b.bloque_id}">
      <div class="cb-cab">
        <span>${esc(b.clave)}</span>
        <span class="cb-chip cb-${clase}">${etiqueta}</span>
        <span class="cb-de">viene de ${esc(b.origen_nombre)}</span>
        ${marca ? '' : `<button class="ce-mini" style="margin-left:auto" data-cb-editar="${b.bloque_id}">
          ${b.propio ? 'Editar' : 'Cambiar solo acá'}</button>`}
      </div>
      <div class="cb-txt">${esc(marca ? `(acá entra el catálogo del cliente de esta rama, al momento de responder)` : b.texto)}</div>
    </div>`;
  }).join('');
}

/* Diff por líneas del prompt COMPLETO, no del bloque editado: el modo de falla
   que importa es que un cambio chico mueva o duplique algo lejos de donde se
   estaba mirando. LCS clásica -- el prompt ronda las 900 líneas, así que la
   tabla cuadrática es irrelevante en tiempo. */
function cbDiffLineas(antes, despues) {
  const a = antes.split('\n'), b = despues.split('\n');
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push(['=', a[i]]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { out.push(['-', a[i]]); i++; }
    else { out.push(['+', b[j]]); j++; }
  }
  while (i < n) out.push(['-', a[i++]]);
  while (j < m) out.push(['+', b[j++]]);
  return out.filter(([s]) => s !== '=');
}

function cbAbrirEditor(bloqueId) {
  const b = CB_BLOQUES.find(x => String(x.bloque_id) === String(bloqueId));
  if (!b) return;
  const caja = document.querySelector(`[data-cb-bloque="${bloqueId}"]`);
  if (!caja || caja.querySelector('textarea')) return;
  const aviso = b.propio
    ? 'Se guarda en esta rama. Antes de guardar vas a ver qué cambia en el texto completo.'
    : `Este bloque hoy lo hereda de <b>${esc(b.origen_nombre)}</b>. Al guardarlo se crea una versión propia de esta rama que lo reemplaza — la Base no se toca.`;
  caja.insertAdjacentHTML('beforeend', `<div class="ce-campo" style="margin-top:11px">
      <div class="ce-ayuda" style="margin-bottom:7px">${aviso}</div>
      <textarea class="ei" rows="8" data-cb-txt>${esc(b.texto)}</textarea>
      <div class="ce-barra" style="margin:10px 0 0">
        <button class="dbtn save" data-cb-guardar="${bloqueId}">Ver qué cambia y guardar</button>
        <button class="ce-mini" data-cb-cancelar>Cancelar</button>
      </div>
      <div data-cb-diff></div>
    </div>`);
}

async function cbGuardar(bloqueId, btn) {
  const b = CB_BLOQUES.find(x => String(x.bloque_id) === String(bloqueId));
  const caja = document.querySelector(`[data-cb-bloque="${bloqueId}"]`);
  const nuevo = caja.querySelector('[data-cb-txt]').value;
  if (!b || nuevo === b.texto) { errToast('No cambiaste nada'); return; }

  // El diff se calcula ANTES de escribir, contra el prompt que el modelo está
  // recibiendo en este momento, y hay que confirmarlo. Guardar primero y
  // mostrar después sería contar lo que ya pasó.
  const antes = CB_PROMPT;
  const despues = CB_BLOQUES.map(x => x.bloque_id === b.bloque_id ? nuevo : x.texto).join('\n');
  const cambios = cbDiffLineas(antes, despues);
  const caja2 = caja.querySelector('[data-cb-diff]');
  if (!caja2.dataset.confirmado) {
    caja2.dataset.confirmado = '1';
    caja2.innerHTML = `<div class="cb-resumen" style="margin-top:12px">
        Cambian <b>${cambios.length}</b> línea(s) del texto que recibe el modelo
        (${antes.length.toLocaleString('es')} → ${despues.length.toLocaleString('es')} caracteres).
        Volvé a tocar el botón para guardar.</div>
      <pre style="max-height:280px;overflow:auto;font-size:11.5px;line-height:1.5">${cambios.slice(0, 200).map(([s, t]) =>
        `<span style="color:${s === '+' ? '#86efac' : '#fca5a5'}">${s} ${esc(t)}</span>`).join('\n')}</pre>`;
    return;
  }

  btn.disabled = true;
  let error;
  if (b.propio) {
    ({ error } = await sb.from('cerebro_bloques').update({ texto: nuevo }).eq('id', b.bloque_id));
  } else {
    // Anular un heredado = declarar uno propio con la MISMA clave y el mismo
    // orden: así queda donde estaba y no se mueve de lugar en el prompt.
    ({ error } = await sb.from('cerebro_bloques').insert({
      cerebro_id: CB_SEL, clave: b.clave, orden: b.orden, tipo: b.tipo,
      canales: b.canales, texto: nuevo,
    }));
  }
  btn.disabled = false;
  if (error) { errToast('No se pudo guardar: ' + error.message); return; }
  okToast('Guardado. La IA lo usa en el próximo mensaje que le llegue.');
  await loadCerebroRamas();
}

function cpCambiarTab(tab) {
  document.querySelectorAll('#ce-tabs .seg').forEach(b => b.classList.toggle('on', b.dataset.ceTab === tab));
  document.querySelectorAll('#sec-cerebro-ia .ce-panel').forEach(p => {
    p.style.display = p.dataset.cePanel === tab ? '' : 'none';
  });
  if (tab === 'probar') { cpPintarSugerencias(); if (!CB_ARBOL.length) loadCerebroRamas(); }
  if (tab === 'ramas' && !CB_ARBOL.length) loadCerebroRamas();
}

function setupCerebroIA() {
  document.getElementById('ce-tabs')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ce-tab]');
    if (b) cpCambiarTab(b.dataset.ceTab);
  });
  document.getElementById('cp-enviar')?.addEventListener('click', (e) => cpProbar(e.currentTarget));
  document.getElementById('fl-file')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) flLeer(f);
  });
  document.getElementById('cp-sugerencias')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cp-sug]');
    if (b) document.getElementById('cp-mensaje').value = b.dataset.cpSug;
  });
  document.getElementById('cb-recargar')?.addEventListener('click', loadCerebroRamas);
  document.getElementById('cb-canal')?.addEventListener('change', cbCargarBloques);
  document.getElementById('cb-arbol')?.addEventListener('click', (e) => {
    const act = e.target.closest('[data-cb-activar]');
    if (act) return cbActivar(act.dataset.cbActivar, act.dataset.cbA === '1', act);
    const bor = e.target.closest('[data-cb-borrar]');
    if (bor) return cbBorrar(bor.dataset.cbBorrar, bor);
    const b = e.target.closest('[data-cb-nodo]');
    if (!b) return;
    CB_SEL = Number(b.dataset.cbNodo);
    cbPintarArbol();
    cbCargarBloques();
  });
  document.getElementById('cb-nueva')?.addEventListener('click', () => cbFormAlta(true));
  document.getElementById('cb-cancelar-alta')?.addEventListener('click', () => cbFormAlta(false));
  document.getElementById('cb-crear')?.addEventListener('click', (e) => cbCrear(e.currentTarget));
  document.getElementById('cb-nombre')?.addEventListener('input', (e) => {
    const slug = document.getElementById('cb-slug');
    if (!slug.dataset.tocado) slug.value = cbSlugificar(e.target.value);
  });
  document.getElementById('cb-slug')?.addEventListener('input', (e) => { e.target.dataset.tocado = '1'; });
  document.getElementById('cb-prompt')?.addEventListener('click', (e) => {
    const ed = e.target.closest('[data-cb-editar]');
    if (ed) return cbAbrirEditor(ed.dataset.cbEditar);
    const gu = e.target.closest('[data-cb-guardar]');
    if (gu) return cbGuardar(gu.dataset.cbGuardar, gu);
    if (e.target.closest('[data-cb-cancelar]')) cbPintarBloques();
  });
  document.getElementById('ia-recargar')?.addEventListener('click', loadIaAtencion);
  document.getElementById('ia-tabs')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ia-tab]');
    if (b) iaCambiarTab(b.dataset.iaTab);
  });
  document.getElementById('ia-lista')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ia-convertir]');
    if (b) iaConvertir(b.dataset.iaConvertir, b);
  });
  document.getElementById('cl-recargar')?.addEventListener('click', loadClientesIA);
  document.getElementById('cl-periodo')?.addEventListener('change', loadClientesIA);
  document.getElementById('cl-lista')?.addEventListener('click', (e) => {
    const p = e.target.closest('[data-cl-plan]');
    if (p) return clAbrirPlan(p.dataset.clPlan);
    const co = e.target.closest('[data-cl-cobro]');
    if (co) return clMarcarCobro(co.dataset.clCobro, co.dataset.clPagado === '1', co);
  });
  document.getElementById('cl-plan')?.addEventListener('change', (e) => {
    clPintarTiers(e.target.value, Number(document.getElementById('cl-tier').value));
    const sug = clPrecioSugerido();
    if (sug != null) document.getElementById('cl-precio').value = sug;
  });
  document.getElementById('cl-tier')?.addEventListener('change', () => {
    const sug = clPrecioSugerido();
    if (sug != null) document.getElementById('cl-precio').value = sug;
  });
  document.getElementById('cl-guardar')?.addEventListener('click', (e) => clGuardarPlan(e.currentTarget));
  document.querySelectorAll('[data-cerrar-sheet]').forEach(b =>
    b.addEventListener('click', () => closeSheet(b.dataset.cerrarSheet)));
  document.getElementById('ce-nueva')?.addEventListener('click', () => ceAbrirEditor(null));
  document.getElementById('ce-recargar')?.addEventListener('click', loadCerebroIA);
  document.getElementById('ce-ambito')?.addEventListener('change', ceMostrarCampoDestino);
  document.getElementById('ce-prod-insertar')?.addEventListener('click', ceInsertarProducto);
  document.getElementById('ce-guardar')?.addEventListener('click', (e) => ceGuardar(e.currentTarget));
  document.getElementById('ce-lista')?.addEventListener('click', (e) => {
    const t = e.target.closest('[data-ce-toggle],[data-ce-editar],[data-ce-borrar]');
    if (!t) return;
    if (t.dataset.ceToggle) return ceToggle(t.dataset.ceToggle, t);
    if (t.dataset.ceBorrar) return ceBorrar(t.dataset.ceBorrar, t);
    ceAbrirEditor(CE_REGLAS.find(x => x.id === Number(t.dataset.ceEditar)));
  });
  document.getElementById('ce-audio-canales')?.addEventListener('click', (e) => {
    const t = e.target.closest('[data-audio-canal]');
    if (!t) return;
    toggleAudioCanal(t.dataset.audioCanal, t);
  });
}

/* --- Rendimiento de la IA comercial -------------------------------------
   El panel consume exclusivamente agregados admin-only. Los hashes de contacto
   no salen de la RPC y el navegador nunca recibe chats, nombres o telÃ©fonos. */
let RIA_DIAS = 7;
const RIA_CACHE = new Map();
const RIA_COSTO_ENTRADA = 0.14 / 1e6;
const RIA_COSTO_CACHE = 0.014 / 1e6;
const RIA_COSTO_SALIDA = 0.28 / 1e6;

function riaRango(dias) {
  const hasta = new Date();
  const desde = new Date(hasta);
  if (dias === 1) desde.setHours(0, 0, 0, 0);
  else desde.setTime(hasta.getTime() - dias * 86400000);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

async function riaConsultar(dias, forzar = false) {
  const guardado = RIA_CACHE.get(dias);
  if (!forzar && guardado && Date.now() - guardado.en < 60000) return guardado.data;
  const rango = riaRango(dias);
  const [general, piloto, reactivacion] = await Promise.all([
    sb.rpc('panel_rendimiento_ia', { p_cliente_slug: 'lotus', p_desde: rango.desde, p_hasta: rango.hasta }),
    sb.rpc('panel_piloto_ia', { p_cliente_slug: 'lotus', p_desde: rango.desde, p_hasta: rango.hasta }),
    sb.rpc('panel_reactivacion_ia', { p_desde: rango.desde, p_hasta: rango.hasta }),
  ]);
  if (general.error) throw general.error;
  if (piloto.error) throw piloto.error;
  if (reactivacion.error) throw reactivacion.error;
  const data = { ...general.data, piloto: piloto.data, reactivacion: reactivacion.data };
  RIA_CACHE.set(dias, { en: Date.now(), data });
  return data;
}

const riaNum = n => Number(n || 0);
const riaPct = (n, total) => total ? Math.round(riaNum(n) * 1000 / riaNum(total)) / 10 : 0;
const riaDinero = n => '$' + riaNum(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const riaHora = iso => iso ? new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin actividad';
function riaCambio(actual, anterior) {
  actual = riaNum(actual); anterior = riaNum(anterior);
  if (!anterior) return actual ? 'Sin base comparable' : 'Sin cambios';
  const p = Math.round((actual - anterior) * 100 / anterior);
  return `${p >= 0 ? '+' : ''}${p}% frente al período anterior`;
}

function riaEstadoInfo(data) {
  const estado = data?.salud?.estado || 'sin_datos';
  const r = data?.resumen || {}, s = data?.salud || {};
  if (estado === 'bien') return { estado, titulo: 'Funcionando sin incidentes visibles', texto: `Última actividad: ${riaHora(s.ultima_actividad)}. No se detectaron errores críticos en las respuestas medidas.` };
  if (estado === 'critico') return { estado, titulo: 'Requiere revisión inmediata', texto: `${riaNum(s.incidentes_criticos)} incidente(s) crítico(s) o ${riaNum(r.duplicados)} contacto(s) con leads duplicados.` };
  if (estado === 'atencion') return { estado, titulo: 'Hay puntos para revisar', texto: `${riaNum(s.errores_tecnicos)} error(es) técnico(s) y ${riaNum(r.oportunidades_sin_lead)} oportunidad(es) completa(s) sin lead.` };
  return { estado, titulo: 'Sin conversaciones en este período', texto: 'Esto no significa que la IA esté caída; solo conviene investigarlo si esperabas tráfico.' };
}

function riaPintarDashboard(data) {
  const r = data?.resumen || {}, salud = riaEstadoInfo(data);
  const alertas = riaNum(data?.salud?.incidentes_criticos) + riaNum(data?.salud?.errores_tecnicos) + riaNum(r.oportunidades_sin_lead) + riaNum(r.duplicados);
  document.getElementById('ria-db-conversaciones').textContent = fmt(riaNum(r.conversaciones));
  document.getElementById('ria-db-telefonos').textContent = fmt(riaNum(r.telefonos));
  document.getElementById('ria-db-leads').textContent = fmt(riaNum(r.leads_calificados));
  document.getElementById('ria-db-conversion').textContent = riaPct(r.leads_calificados, r.conversaciones) + '%';
  document.getElementById('ria-db-incidentes').textContent = fmt(alertas);
  document.getElementById('ria-db-estado').innerHTML = `<span class="ria-estado ${salud.estado}">${esc(salud.titulo)}</span>`;
}

async function loadResumenIADashboard(forzar = false) {
  if (ROL !== 'admin' || !document.getElementById('ria-dashboard')) return;
  try { riaPintarDashboard(await riaConsultar(1, forzar)); }
  catch (e) {
    console.error('rendimiento IA dashboard', e);
    document.getElementById('ria-db-estado').textContent = 'No se pudo cargar el resumen';
  }
}

function riaPintarPanel(data) {
  const r = data.resumen || {}, ant = data.anterior || {}, op = data.operacion || {}, ventas = data.ventas || {};
  const salud = riaEstadoInfo(data), estado = document.getElementById('ria-estado');
  estado.className = `ria-estado ${salud.estado}`; estado.textContent = salud.titulo;
  document.getElementById('ria-estado-texto').innerHTML = `${esc(salud.texto)} <b>${esc(riaCambio(r.leads_calificados, ant.leads_calificados))}</b>`;
  document.getElementById('ria-actualizado').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

  const gruposPiloto = new Map((data.piloto?.grupos || []).map(g => [g.experimento_grupo, g]));
  const control = gruposPiloto.get('control') || {}, tratamiento = gruposPiloto.get('tratamiento') || {};
  const delta = riaNum(tratamiento.conversion_telefono_pct) - riaNum(control.conversion_telefono_pct);
  document.getElementById('ria-piloto').innerHTML = `<div class="ria-cal-head"><span>Grupo</span><span>Contactos</span><span>Teléfono</span></div>
    ${[['Control 80%', control], ['Tratamiento 20%', tratamiento]].map(([n,g]) => `<div class="ria-cal-fila"><span>${n}</span><b>${fmt(riaNum(g.contactos))}</b><b>${riaNum(g.conversion_telefono_pct).toFixed(2)}%</b></div>`).join('')}
    <div class="ria-lista" style="margin-top:10px"><div class="ria-fila"><span>Diferencia tratamiento vs. control</span><b class="${delta < -0.5 ? 'ria-malo' : 'ria-bien'}">${delta >= 0 ? '+' : ''}${delta.toFixed(2)} pp</b></div>
    <div class="ria-fila"><span>Tratamiento con CTA ausente</span><b>${fmt(riaNum(tratamiento.con_cta_ausente))}</b></div><div class="ria-fila"><span>Tratamiento con fallo visible</span><b class="${riaNum(tratamiento.con_fallo_visible) ? 'ria-malo' : 'ria-bien'}">${fmt(riaNum(tratamiento.con_fallo_visible))}</b></div></div>`;

  const reactivacion = data.reactivacion || {};
  const gruposReactivacion = new Map((reactivacion.grupos || []).map(g => [g.grupo_experimental, g]));
  const rg = gruposReactivacion.get('tratamiento') || {};
  const entrega = reactivacion.entrega || {};
  document.getElementById('ria-reactivacion').innerHTML = `<div class="ria-lista">
    <div class="ria-fila"><span>Conversaciones elegibles</span><b>${fmt(riaNum(rg.elegibles))}</b></div>
    <div class="ria-fila"><span>Seguimientos enviados</span><b>${fmt(riaNum(rg.enviadas))}</b></div>
    <div class="ria-fila"><span>Clientes que volvieron</span><b>${fmt(riaNum(rg.respondidas))}</b></div>
    <div class="ria-fila"><span>Leads rescatados</span><b class="${riaNum(rg.rescatadas) ? 'ria-bien' : ''}">${fmt(riaNum(rg.rescatadas))}</b></div>
    <div class="ria-fila"><span>Cancelados por seguridad</span><b>${fmt(riaNum(rg.canceladas))}</b></div>
    <div class="ria-fila"><span>Personas que pidieron no contacto</span><b>${fmt(riaNum(reactivacion.no_contactar))}</b></div>
  </div>`;
  const callbackPct = riaPct(entrega.callbacks, entrega.turnos);
  document.getElementById('ria-entrega').innerHTML = `<div class="ria-lista">
    <div class="ria-fila"><span>Respuestas con comprobante</span><b>${fmt(riaNum(entrega.turnos))}</b></div>
    <div class="ria-fila"><span>Flujo confirmado</span><b class="${riaNum(entrega.turnos) && callbackPct < 99.5 ? 'ria-malo' : 'ria-bien'}">${callbackPct.toFixed(1)}%</b></div>
    <div class="ria-fila"><span>Silencios reintentados</span><b>${fmt(riaNum(entrega.reintentos))}</b></div>
    <div class="ria-fila"><span>Requieren atención humana</span><b class="${riaNum(entrega.requieren_atencion) ? 'ria-malo' : 'ria-bien'}">${fmt(riaNum(entrega.requieren_atencion))}</b></div>
  </div><div class="ce-ayuda">El vigilante de silencios solo se activa cuando la confirmación del flujo supera 99,5%; así no duplica mensajes legítimos.</div>`;

  pintarKPIs('ria-kpis', [
    { t: 'Conversaciones', v: fmt(riaNum(r.conversaciones)), d: riaCambio(r.conversaciones, ant.conversaciones), i: 'fa-comments', c: 'var(--blue)' },
    { t: 'Teléfonos', v: fmt(riaNum(r.telefonos)), d: `${riaPct(r.telefonos, r.conversaciones)}% de conversaciones`, i: 'fa-phone', c: 'var(--accent)' },
    { t: 'Leads calificados', v: fmt(riaNum(r.leads_calificados)), d: `${riaPct(r.leads_calificados, r.conversaciones)}% de conversión`, i: 'fa-user-check', c: 'var(--green)' },
    { t: 'Oportunidades sin lead', v: fmt(riaNum(r.oportunidades_sin_lead)), d: 'Teléfono + destino + intención', i: 'fa-triangle-exclamation', c: riaNum(r.oportunidades_sin_lead) ? '#ef4444' : 'var(--green)' },
    { t: 'Errores técnicos', v: fmt(riaNum(data.salud?.errores_tecnicos)), d: 'Fallos del modelo o proveedor', i: 'fa-plug-circle-xmark', c: riaNum(data.salud?.errores_tecnicos) ? '#ef4444' : 'var(--green)' },
  ]);

  const pasos = [['Conversaciones', r.conversaciones], ['Destino', r.destinos], ['Teléfono', r.telefonos], ['Intención real', r.intenciones], ['Lead creado', r.leads_calificados]];
  document.getElementById('ria-embudo').innerHTML = `<div class="ria-funnel">${pasos.map(([n, v]) => `<div class="ria-paso"><span>${esc(n)}</span><div class="ria-bar"><i style="width:${Math.min(100, riaPct(v, r.conversaciones))}%"></i></div><b>${fmt(riaNum(v))}</b></div>`).join('')}</div>`;

  const colabs = data.colaboraciones || {};
  const porCampania = colabs.por_campania || [];
  const nombreColab = c => c === 'vulcanost' ? 'Posada Vulcanost' : c === 'casa_playa_sur' ? 'Casa Vacacional Playa del Sur' : c;
  document.getElementById('ria-colaboraciones').innerHTML = `<div class="ria-lista">
    <div class="ria-fila"><span>Escaladas directo al colaborador</span><b>${fmt(riaNum(colabs.total))}</b></div>
    ${porCampania.map(c => `<div class="ria-fila"><span>${esc(nombreColab(c.campania))}</span><b>${fmt(riaNum(c.conversaciones))}</b></div>`).join('')}
  </div>${porCampania.length ? '' : '<div class="ria-vacio">Sin colaboraciones en este período.</div>'}`;

  document.getElementById('ria-ventas').innerHTML = `<div class="ria-lista">
    <div class="ria-fila"><span>Leads entregados</span><b>${fmt(riaNum(r.leads_calificados))}</b></div>
    <div class="ria-fila"><span>Esperando primer contacto</span><b class="${riaNum(ventas.esperando_primer_contacto) ? 'ria-malo' : 'ria-bien'}">${fmt(riaNum(ventas.esperando_primer_contacto))}</b></div>
    <div class="ria-fila"><span>Ventas confirmadas</span><b>${fmt(riaNum(ventas.ventas_confirmadas))}</b></div>
    <div class="ria-fila"><span>Facturación atribuida</span><b>${riaDinero(ventas.facturacion_atribuida)}</b></div>
    <div class="ria-fila"><span>Leads duplicados</span><b class="${riaNum(r.duplicados) ? 'ria-malo' : 'ria-bien'}">${fmt(riaNum(r.duplicados))}</b></div>
  </div>`;

  const cal = data.calidad || {}, modelo = cal.modelo || {}, visible = cal.visible || {};
  const salidaMedida = riaNum(op.salidas_finales_medidas) > 0;
  const fallos = [['Precio sin respaldo', 'precio_invalido'], ['Dato inventado', 'dato_inventado'], ['Pregunta repetida', 'pregunta_repetida'], ['Teléfono perdido', 'telefono_perdido'], ['Mala interpretación', 'mala_interpretacion'], ['Respuesta extensa', 'respuesta_extensa'], ['Escalamiento tardío', 'escalamiento_tardio']];
  document.getElementById('ria-calidad').innerHTML = `<div class="ria-cal-head"><span>Control</span><span>Intentos</span><span>Visible</span></div>${fallos.map(([n, k]) => `<div class="ria-cal-fila"><span>${esc(n)}</span><b>${fmt(riaNum(modelo[k]))}</b><b class="${riaNum(visible[k]) ? 'ria-malo' : 'ria-bien'}">${salidaMedida ? fmt(riaNum(visible[k])) : '—'}</b></div>`).join('')}<div class="ce-ayuda">${salidaMedida ? `${fmt(op.salidas_finales_medidas)} respuestas finales medidas.` : 'La medición de salida visible comienza con esta versión; el historial anterior no se presenta como cero.'}</div>`;

  const canales = data.por_canal || [];
  document.getElementById('ria-canales').innerHTML = canales.length ? `<div class="ria-lista">${canales.map(c => `<div class="ria-fila"><span><b>${c.canal === 'instagram' ? 'Instagram' : 'Web'}</b><br>${fmt(riaNum(c.telefonos))} teléfonos · ${fmt(riaNum(c.leads_calificados))} leads</span><b>${fmt(riaNum(c.conversaciones))}<small style="display:block;color:var(--muted);font-weight:500">${riaNum(c.latencia_promedio_ms) ? (riaNum(c.latencia_promedio_ms) / 1000).toFixed(1) + ' s' : '—'}</small></b></div>`).join('')}</div>` : '<div class="ria-vacio">Sin actividad por canal en este período.</div>';

  const sinCache = Math.max(0, riaNum(op.tokens_entrada) - riaNum(op.tokens_cache));
  const costo = sinCache * RIA_COSTO_ENTRADA + riaNum(op.tokens_cache) * RIA_COSTO_CACHE + riaNum(op.tokens_salida) * RIA_COSTO_SALIDA;
  document.getElementById('ria-operacion').innerHTML = `<div class="ria-lista">
    <div class="ria-fila"><span>Última actividad</span><b>${esc(riaHora(op.ultima_actividad))}</b></div>
    <div class="ria-fila"><span>Latencia promedio</span><b>${riaNum(op.latencia_promedio_ms) ? (riaNum(op.latencia_promedio_ms) / 1000).toFixed(2) + ' s' : '—'}</b></div>
    <div class="ria-fila"><span>Latencia p95</span><b>${riaNum(op.latencia_p95_ms) ? (riaNum(op.latencia_p95_ms) / 1000).toFixed(2) + ' s' : '—'}</b></div>
    <div class="ria-fila"><span>Tokens entrada / salida</span><b>${fmt(riaNum(op.tokens_entrada))} / ${fmt(riaNum(op.tokens_salida))}</b></div>
    <div class="ria-fila"><span>Entrada atendida por caché</span><b>${riaPct(op.tokens_cache, op.tokens_entrada)}%</b></div>
    <div class="ria-fila"><span>Costo estimado del modelo</span><b>${riaDinero(costo)}</b></div>
  </div><div class="ce-ayuda">No incluye el costo fijo de ManyChat. El cálculo usa las tarifas configuradas actualmente para entrada, caché y salida.</div>`;

  const versiones = data.versiones || [];
  document.getElementById('ria-versiones').innerHTML = versiones.length ? `<div class="ria-lista">${versiones.map(v => `<div class="ria-fila"><span><b>${esc(v.nombre_version || 'Cerebro sin versión')}</b><br>${esc(v.motor_version)} · ${esc(v.estado_version || 'sin estado')}</span><b>${fmt(riaNum(v.conversaciones))}<small style="display:block;color:var(--muted);font-weight:500">${fmt(riaNum(v.leads_calificados))} leads</small></b></div>`).join('')}</div>` : '<div class="ria-vacio">Sin versiones con actividad en este período.</div>';
}

async function loadRendimientoIA(forzar = false) {
  if (ROL !== 'admin' || !document.getElementById('ria-kpis')) return;
  document.getElementById('ria-actualizado').textContent = 'Cargando…';
  try {
    const data = await riaConsultar(RIA_DIAS, forzar);
    riaPintarPanel(data);
  } catch (e) {
    console.error('rendimiento IA', e);
    document.getElementById('ria-actualizado').textContent = 'No se pudo cargar';
    errToast('No se pudo cargar Rendimiento IA');
  }
}

function setupRendimientoIA() {
  if (ROL !== 'admin') return;
  document.getElementById('ria-dashboard')?.addEventListener('click', () => activateSection('rendimiento-ia'));
  document.getElementById('ria-recargar')?.addEventListener('click', () => { RIA_CACHE.clear(); loadRendimientoIA(true); loadResumenIADashboard(true); });
  document.getElementById('ria-periodos')?.addEventListener('click', e => {
    const b = e.target.closest('[data-ria-dias]'); if (!b) return;
    RIA_DIAS = Number(b.dataset.riaDias);
    document.querySelectorAll('[data-ria-dias]').forEach(x => x.classList.toggle('on', x === b));
    loadRendimientoIA();
  });
  loadResumenIADashboard();
}

/* --- Prospectos de IA ----------------------------------------------------
   Posadas y apartamentos que entraron por destinoyeventoslotus360.com/ia-planes,
   armaron el asistente y dejaron sus datos. Viven en `leads` pero sin asesor y
   con `servicio = 'Asistente IA (posada)'` -- eso es lo que las mantiene fuera
   de la vista de los asesores, y `posadas_interesadas` exige rol admin. */
async function loadIaAtencion() {
  const cont = document.getElementById('ia-lista');
  const { data, error } = await sb.rpc('posadas_interesadas');
  if (error || !data?.ok) {
    cont.innerHTML = `<div class="vig-vacio">No se pudo cargar: ${esc(error?.message || data?.error || '')}</div>`;
    document.getElementById('ia-conteo').textContent = '';
    return;
  }
  const posadas = data.posadas || [];
  // Qué solicitudes ya tienen su rama creada, para no ofrecer crearla dos veces.
  const { data: yaClientes } = await sb.from('clientes').select('id,lead_id').not('lead_id', 'is', null);
  IA_CONVERTIDOS = new Map((yaClientes || []).map(c => [c.lead_id, c.id]));
  document.getElementById('ia-conteo').textContent =
    posadas.length ? `${posadas.length} ${posadas.length === 1 ? 'posada interesada' : 'posadas interesadas'}` : '';
  if (!posadas.length) {
    cont.innerHTML = `<div class="vig-vacio"><i class="fas fa-headset"></i><b>Todavía no entró ninguna</b>
      <div style="font-size:12.5px;margin-top:6px">Acá van a aparecer las posadas que completen el recorrido en la página, con el plan que eligieron.</div></div>`;
    return;
  }
  window.__iaPosadas = posadas;
  cont.innerHTML = posadas.map(iaCard).join('');
}

function iaCard(p) {
  const wa = String(p.telefono || '').replace(/\D/g, '');
  // El texto que dejó la página trae la configuración línea por línea. La
  // línea del plan sube a badge; el resto se muestra tal cual vino, sin
  // reinterpretar nada: si la página cambia sus opciones, esto no se rompe.
  const lineas = String(p.consulta || '').split('\n').map(s => s.trim()).filter(Boolean);
  const linPlan = lineas.find(l => /^plan:/i.test(l)) || '';
  const esFull = /completo/i.test(linPlan);
  const resto = lineas.filter(l => l !== linPlan);
  const cuerpo = resto.map(l => {
    const i = l.indexOf(':');
    return i > 0 ? `<b>${esc(l.slice(0, i))}:</b>${esc(l.slice(i + 1))}` : esc(l);
  }).join('<br>');
  return `<div class="ia-card">
    <div class="ia-top">
      <div class="ia-nom">${esc(p.nombre || 'Sin nombre')}</div>
      <div class="ia-fecha">${pvFecha(p.created_at)}</div>
    </div>
    ${linPlan ? `<span class="ia-plan ${esFull ? 'full' : 'basico'}"><i class="fas fa-${esFull ? 'star' : 'circle-half-stroke'}"></i> ${esc(linPlan.replace(/^plan:\s*/i, 'Plan '))}</span>` : ''}
    <div class="ia-datos">
      ${wa ? `<a class="ia-dato" href="https://wa.me/${wa}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> ${esc(p.telefono)}</a>`
           : `<span class="ia-dato"><i class="fas fa-phone-slash"></i> Sin teléfono</span>`}
      ${p.destino ? `<span class="ia-dato"><i class="fas fa-location-dot"></i> ${esc(p.destino)}</span>` : ''}
      <span class="ia-dato"><i class="fas fa-flag"></i> ${esc(p.estado || '—')}</span>
    </div>
    ${cuerpo ? `<div class="ia-cfg">${cuerpo}</div>` : ''}
    <div class="ce-pie">
      ${IA_CONVERTIDOS.has(p.id)
        ? `<span class="ce-vig"><i class="fas fa-circle-check" style="color:#86efac"></i> Ya es cliente, con su rama creada</span>`
        : `<span class="ce-vig"><i class="fas fa-hand-sparkles"></i> Todavía es solo una solicitud</span>
           <span class="ce-acc"><button class="ce-mini on" data-ia-convertir="${p.id}">Crear su rama</button></span>`}
    </div>
  </div>`;
}

let IA_CONVERTIDOS = new Map();

/* Convertir una solicitud en cliente: crea su rama del cerebro heredando la
   Base y deja anotado de qué solicitud salió. No le pone plan ni precio -- eso
   se carga después desde la pestaña Clientes, cuando se sepa qué contrató. */
async function iaConvertir(leadId, btn) {
  const p = (window.__iaPosadas || []).find(x => String(x.id) === String(leadId));
  const nombre = (p?.nombre || '').trim();
  if (!nombre) { errToast('Esa solicitud no tiene nombre; creá la rama a mano desde Cerebro IA › Ramas'); return; }
  const slug = cbSlugificar(nombre);
  if (!(await confirmarSheet({ titulo: `¿Crear la rama de "${nombre}"?`, detalle: `Identificador: ${slug}\n\nHereda toda la Base y nace sin catálogo ni plan.`, textoOk: 'Crear' }))) return;
  btn.disabled = true;
  const { data, error } = await sb.rpc('crear_rama_cerebro',
    { p_nombre: nombre, p_slug: slug, p_padre_id: null, p_lead_id: Number(leadId) });
  btn.disabled = false;
  if (error || !data?.ok) { errToast(data?.error || error?.message || 'No se pudo crear'); return; }
  okToast(`Rama de "${nombre}" creada. Cargale el plan en la pestaña Clientes.`);
  CB_ARBOL = [];
  await loadIaAtencion();
}

/* --- Clientes de la IA: consumo del mes y cobro ----------------------------
   La página /ia-planes vende planes por MENSAJES, pero ManyChat nos cobra por
   CONTACTOS ACTIVOS (personas distintas que escriben en el mes). Con nuestros
   propios números son 2,2 mensajes por contacto, así que un plan de 2.000
   mensajes ya se pasa de los 500 contactos que cuestan $15. Por eso la tarjeta
   muestra las dos barras: la que le vendiste y la que te cuesta. */
let CL_DATOS = [], CL_EDITANDO = null;

// Copia de la escalera de precios de pagina-web-next/components/posadas/datos.ts.
// Son dos repos distintos y no hay forma de importar de allá; si cambian los
// precios hay que tocar los dos lados, y el comentario está en ambos.
const CL_TIERS = [
  { mensajes: 500, basico: 59, pro: null },
  { mensajes: 2000, basico: 69, pro: null },
  { mensajes: 5000, basico: 79, pro: 109 },
  { mensajes: 10000, basico: 89, pro: 129 },
];
// Lo que ManyChat cobra sin escalar. Pasarse de acá es lo único que mueve el costo.
const CL_CONTACTOS_INCLUIDOS = 500;
// $0,14 por millón de tokens de entrada, $0,28 por millón de salida. El acierto
// de caché se cobra ~10x más barato, por eso se descuenta aparte -- y no es un
// detalle: medido con tráfico real el 02/08, el 97,7% de los tokens de entrada
// entran por caché. Contarlos a precio lleno multiplicaría el costo por 10.
const CL_USD_ENTRADA = 0.14 / 1e6, CL_USD_CACHE = 0.014 / 1e6, CL_USD_SALIDA = 0.28 / 1e6;
const CL_MANYCHAT = 15;

const clPeriodo = () => (document.getElementById('cl-periodo')?.value || '') + '-01';
const clPct = (usado, tope) => tope ? Math.min(100, Math.round(usado * 100 / tope)) : 0;

function clCostoModelo(c) {
  const sinCache = Math.max(0, Number(c.tokens_entrada || 0) - Number(c.tokens_cache || 0));
  return sinCache * CL_USD_ENTRADA + Number(c.tokens_cache || 0) * CL_USD_CACHE
       + Number(c.tokens_salida || 0) * CL_USD_SALIDA;
}

async function loadClientesIA() {
  const cont = document.getElementById('cl-lista');
  const per = document.getElementById('cl-periodo');
  if (!per.value) per.value = new Date().toISOString().slice(0, 7);
  const { data, error } = await sb.rpc('clientes_ia_panel', { p_periodo: clPeriodo() });
  if (error) {
    cont.innerHTML = `<div class="vig-vacio">No se pudo cargar: ${esc(error.message)}</div>`;
    return;
  }
  CL_DATOS = data || [];
  cont.innerHTML = CL_DATOS.length
    ? CL_DATOS.map(clCard).join('')
    : `<div class="vig-vacio"><i class="fas fa-store"></i><b>Todavía no hay clientes</b>
       <div style="font-size:12.5px;margin-top:6px">Cuando le crees la rama a una posada en Cerebro IA › Ramas, aparece acá.</div></div>`;
}

function clCard(c) {
  const tope = c.tier_mensajes || 0;
  const pctMsg = clPct(c.mensajes, tope);
  const pctCon = clPct(c.contactos, CL_CONTACTOS_INCLUIDOS);
  const costoModelo = clCostoModelo(c);
  const costo = costoModelo + CL_MANYCHAT;
  const precio = Number(c.precio_mensual || 0);
  const margen = precio - costo;
  const siguiente = CL_TIERS.find(t => t.mensajes > tope);
  const precioSiguiente = siguiente ? (c.plan === 'pro' ? siguiente.pro : siguiente.basico) : null;
  // Sin tokens medidos el costo del modelo es 0 y el margen mentiría por lo
  // alto. Se dice, en vez de mostrar un número que parece exacto.
  const sinMedir = !Number(c.tokens_entrada || 0);

  const avisos = [];
  if (tope && pctMsg >= 100) {
    avisos.push(`Se pasó del plan.${precioSiguiente ? ` El de ${siguiente.mensajes.toLocaleString('es')} mensajes cuesta $${precioSiguiente}.` : ''} No se cortó nada.`);
  } else if (tope && pctMsg >= 80) {
    avisos.push(`Va por el ${pctMsg}% de sus mensajes.${precioSiguiente ? ` El plan siguiente cuesta $${precioSiguiente}.` : ''}`);
  }
  if (c.contactos > CL_CONTACTOS_INCLUIDOS) {
    avisos.push(`Pasó los ${CL_CONTACTOS_INCLUIDOS} contactos de ManyChat: el costo real de este mes es mayor al estimado.`);
  }

  return `<div class="ia-card cl-card">
    <div class="ia-top">
      <div class="ia-nom">${esc(c.nombre)}
        <div class="cl-sub">${esc(c.slug)} · ${c.productos} en su catálogo</div></div>
      <span class="cl-estado ${esc(c.estado_comercial)}">${clEstadoTexto(c.estado_comercial)}</span>
    </div>

    <div class="cl-barras">
      <div class="cl-medida">
        <div class="cl-medida-t"><span>Mensajes</span>
          <b>${Number(c.mensajes).toLocaleString('es')}${tope ? ` / ${tope.toLocaleString('es')}` : ''}</b></div>
        <div class="cl-barra"><i class="${pctMsg >= 100 ? 'lleno' : pctMsg >= 80 ? 'alto' : ''}" style="width:${pctMsg}%"></i></div>
      </div>
      <div class="cl-medida">
        <div class="cl-medida-t"><span>Contactos activos</span>
          <b>${Number(c.contactos).toLocaleString('es')} / ${CL_CONTACTOS_INCLUIDOS}</b></div>
        <div class="cl-barra"><i class="${pctCon >= 100 ? 'lleno' : pctCon >= 80 ? 'alto' : ''}" style="width:${pctCon}%"></i></div>
      </div>
    </div>

    ${avisos.map(a => `<div class="cl-aviso"><i class="fas fa-triangle-exclamation"></i> ${esc(a)}</div>`).join('')}

    <div class="cl-nums">
      <span class="cl-num"><b>${precio ? '$' + precio : '—'}</b>${c.plan ? ` plan ${c.plan === 'pro' ? 'Pro' : 'Básico'}` : ' sin plan'}</span>
      <span class="cl-num"><b>${sinMedir ? '—' : '$' + costo.toFixed(2)}</b> nos cuesta</span>
      <span class="cl-num ${!sinMedir && margen < 0 ? 'malo' : ''}"><b>${sinMedir || !precio ? '—' : '$' + margen.toFixed(2)}</b> de ganancia</span>
    </div>
    ${sinMedir ? `<div class="ce-ayuda">Sin tokens medidos todavía en este mes: el costo aparece cuando entren mensajes nuevos.</div>` : ''}

    <div class="ce-pie">
      <span class="ce-vig">${c.cobro_id
        ? (c.cobro_estado === 'pagado'
            ? `<i class="fas fa-circle-check" style="color:#86efac"></i> Cobrado $${Number(c.cobro_monto).toFixed(2)}`
            : `<i class="fas fa-clock"></i> Pendiente $${Number(c.cobro_monto).toFixed(2)}`)
        : '<i class="fas fa-minus"></i> Sin cobro registrado este mes'}</span>
      <span class="ce-acc">
        <button class="ce-mini" data-cl-plan="${c.cliente_id}">Plan</button>
        ${c.cobro_estado === 'pagado'
          ? `<button class="ce-mini" data-cl-cobro="${c.cliente_id}" data-cl-pagado="0">Marcar pendiente</button>`
          : `<button class="ce-mini on" data-cl-cobro="${c.cliente_id}" data-cl-pagado="1">Marcar pagado</button>`}
      </span>
    </div>
  </div>`;
}

const clEstadoTexto = (e) => ({ prueba: 'En prueba', activo: 'Activo', pausado: 'Pausado', baja: 'De baja' }[e] || e);

function clAbrirPlan(id) {
  const c = CL_DATOS.find(x => String(x.cliente_id) === String(id));
  if (!c) return;
  CL_EDITANDO = c.cliente_id;
  document.getElementById('cl-plan-titulo').textContent = `Plan de ${c.nombre}`;
  document.getElementById('cl-plan').value = c.plan || '';
  document.getElementById('cl-estado').value = c.estado_comercial || 'prueba';
  document.getElementById('cl-inicio').value = c.inicio_servicio || '';
  document.getElementById('cl-instalacion').checked = !!c.instalacion_pagada;
  document.getElementById('cl-precio').value = c.precio_mensual ?? '';
  clPintarTiers(c.plan || '', c.tier_mensajes);
  openSheet('cl-plan-sheet');
}

function clPintarTiers(plan, elegido) {
  const sel = document.getElementById('cl-tier');
  const disponibles = CL_TIERS.filter(t => !plan || t[plan] != null);
  sel.innerHTML = disponibles.map(t =>
    `<option value="${t.mensajes}"${t.mensajes === elegido ? ' selected' : ''}>${t.mensajes.toLocaleString('es')} mensajes${plan ? ` — $${t[plan]}` : ''}</option>`).join('');
  document.getElementById('cl-tier-ayuda').textContent = plan === 'pro'
    ? 'El Pro arranca en 5.000 mensajes.'
    : 'Como referencia: 2,2 mensajes por contacto, y ManyChat cobra aparte pasando los 500 contactos.';
}

function clPrecioSugerido() {
  const plan = document.getElementById('cl-plan').value;
  const tier = Number(document.getElementById('cl-tier').value);
  const t = CL_TIERS.find(x => x.mensajes === tier);
  return plan && t && t[plan] != null ? t[plan] : null;
}

async function clGuardarPlan(btn) {
  const plan = document.getElementById('cl-plan').value || null;
  btn.disabled = true;
  const { data, error } = await sb.rpc('guardar_plan_cliente', {
    p_cliente_id: CL_EDITANDO,
    p_plan: plan,
    p_tier_mensajes: Number(document.getElementById('cl-tier').value) || null,
    p_precio_mensual: document.getElementById('cl-precio').value === '' ? null : Number(document.getElementById('cl-precio').value),
    p_estado: document.getElementById('cl-estado').value,
    p_inicio: document.getElementById('cl-inicio').value || null,
    p_instalacion_pagada: document.getElementById('cl-instalacion').checked,
  });
  btn.disabled = false;
  if (error || !data?.ok) { errToast(data?.error || error?.message || 'No se pudo guardar'); return; }
  closeSheet('cl-plan-sheet');
  okToast('Plan guardado.');
  await loadClientesIA();
}

async function clMarcarCobro(id, pagado, btn) {
  const c = CL_DATOS.find(x => String(x.cliente_id) === String(id));
  // El monto se congela con el cobro: si mañana le cambiás el precio, los meses
  // ya cobrados tienen que seguir diciendo lo que se cobró de verdad.
  const monto = c?.cobro_monto ?? c?.precio_mensual;
  if (monto == null) { errToast('Ponele primero un precio mensual en Plan'); return; }
  btn.disabled = true;
  const { data, error } = await sb.rpc('marcar_cobro_cliente', {
    p_cliente_id: Number(id), p_periodo: clPeriodo(), p_monto: Number(monto), p_pagado: pagado,
  });
  btn.disabled = false;
  if (error || !data?.ok) { errToast(data?.error || error?.message || 'No se pudo guardar'); return; }
  await loadClientesIA();
}

function iaCambiarTab(tab) {
  document.querySelectorAll('#ia-tabs .seg').forEach(b => b.classList.toggle('on', b.dataset.iaTab === tab));
  document.querySelectorAll('#sec-ia-atencion .ia-panel').forEach(p => {
    p.style.display = p.dataset.iaPanel === tab ? '' : 'none';
  });
  if (tab === 'clientes') loadClientesIA();
}

/* --- Pestaña Proceso: qué está haciendo la cadena automática ---------------
   La actualización del tarifario corre sola cada 3 minutos y hasta acá no se
   veía desde ningún lado. El modo de falla que importa no es que algo explote
   -- eso deja rastro -- sino que algo DEJE DE CORRER en silencio, así que lo
   primero de la pantalla es cuándo corrió cada proceso por última vez. */
let ACT_REFRESCO = null;
let ACT_PANEL_DATA = null;

function actPararRefresco() {
  if (ACT_REFRESCO) { clearInterval(ACT_REFRESCO); ACT_REFRESCO = null; }
}

// Cada cuánto DEBERÍA correr cada proceso, en minutos. Se marca en rojo al
// triplicar ese número: un salteo puede ser un pico de carga, tres seguidos no.
const ACT_ESPERADO = {
  'tarifario-maestro': 3,
  'tarifario-drive-scan': 30,
  'tarifario-extraer-publicar': 120,
  'tarifario-revisor-ia': 1440,
  'tarifario-curador-fotos': 1440,
};

const ACT_NOMBRES = {
  'tarifario-maestro': 'Actualización del tarifario',
  'tarifario-drive-scan': 'Búsqueda de archivos en Drive',
  'tarifario-extraer-publicar': 'Flyers y fichas sueltas',
  'tarifario-revisor-ia': 'Revisor automático',
  'tarifario-curador-fotos': 'Lectura de fotos',
};

async function cargarPanelProceso() {
  const cont = document.getElementById('act-panel-proceso');
  if (!cont.dataset.pintado) actSkel('act-panel-proceso');
  const { data, error } = await sb.rpc('panel_tarifario');
  if (error) {
    cont.innerHTML = `<div class="vig-vacio">No se pudo cargar: ${esc(error.message)}</div>`;
    return;
  }
  cont.dataset.pintado = '1';
  ACT_PANEL_DATA = data || {};
  cont.innerHTML = actProcesoHtml(ACT_PANEL_DATA);
  actPintarPillProceso(data || {});
  actPararRefresco();
  ACT_REFRESCO = setInterval(() => {
    // Si la hoja se cerró o cambiaron de pestaña, el timer se apaga solo.
    const viva = document.getElementById('actualizador-sheet')?.classList.contains('open')
      && document.querySelector('#actualizador-sheet .act-panel[data-apanel="proceso"]')?.classList.contains('on');
    if (!viva) return actPararRefresco();
    cargarPanelProceso();
  }, 20000);
}

function actProcesoHtml(d) {
  return actBannerHtml(d) + actCargaHtml(d) + actPuertasHtml(d) + actSaludHtml(d.salud || []) + actColaHtml(d);
}

// Resumen de una línea arriba del panel: qué está pasando, sin leer el detalle.
function actBannerHtml(d) {
  const carga = d.carga;
  const puertas = d.puertas || [];
  const salud = d.salud || [];
  const vivo = (d.ultimas_cargas || []).find(c => c.estado === 'activa');
  const puertaMal = puertas.some(p => !p.ok);
  const cronMal = salud.some(s => {
    const esperado = ACT_ESPERADO[s.proceso] || 60;
    const nuevo = s.minutos === null && s.activo;
    const parado = !nuevo && (!s.activo || s.minutos === null || s.minutos > esperado * 3);
    return parado || s.resultado_ok === false;
  });
  if (cronMal) {
    return `<div class="act-banner mal"><i class="fas fa-triangle-exclamation"></i><div><b>Un proceso dejó de correr</b><div>Mirá "Procesos automáticos" abajo: hay algo en rojo.</div></div></div>`;
  }
  if (carga && ['extrayendo', 'verificando', 'lista'].includes(carga.estado)) {
    return `<div class="act-banner curso"><i class="fas fa-arrows-rotate"></i><div><b>Actualizando el tarifario</b><div>${esc(carga.archivo)} — se publica solo al terminar.</div></div></div>`;
  }
  if (puertaMal) {
    const primera = puertas.find(p => !p.ok);
    return `<div class="act-banner aviso"><i class="fas fa-hand"></i><div><b>Frenado, esperando una persona</b><div>${esc(primera?.nombre || '')}: ${esc(primera?.detalle || '')}</div></div></div>`;
  }
  if (carga && carga.estado === 'borrador') {
    return `<div class="act-banner ok"><i class="fas fa-rocket"></i><div><b>Tarifario nuevo listo</b><div>Pasó las tres puertas y se publica solo.</div></div></div>`;
  }
  return `<div class="act-banner ok"><i class="fas fa-circle-check"></i><div><b>Todo automático y al día</b><div>${vivo ? `Catálogo vivo: ${esc(vivo.archivo)}` : 'Sin cargas en curso ni nada que revisar.'}</div></div></div>`;
}

function actCargaHtml(d) {
  const c = d.carga;
  if (!c) {
    const ultima = (d.ultimas_cargas || [])[0];
    return `<div class="act-blk">
      <div class="act-blk-t">Ahora mismo</div>
      <div class="act-vacio" style="padding:16px 8px">
        <i class="fas fa-circle-check"></i><b>Sin cargas en curso</b>
        <div style="margin-top:6px">El sistema está mirando Drive. Cuando suban un tarifario nuevo, entra solo.</div>
        ${ultima ? `<div style="margin-top:9px;font-size:11.5px;color:var(--muted2)">Última: ${esc(ultima.archivo)} · ${ultima.activadas ?? 0} precios nuevos, ${ultima.retiradas ?? 0} retirados</div>` : ''}
      </div></div>`;
  }
  const t = c.tandas || {};
  const hechas = (t.ok || 0) + (t.dividido || 0) + (t.error || 0);
  const pct = t.total ? Math.round(hechas / t.total * 100) : 0;
  const paso = {
    extrayendo: ['Leyendo el archivo', 'tibio'],
    verificando: ['Verificando', 'tibio'],
    lista: ['Verificada, preparando borrador', 'tibio'],
    borrador: ['Borrador listo, sin publicar', 'ok'],
  }[c.estado] || [c.estado, 'tibio'];

  return `<div class="act-blk">
    <div class="act-blk-t">Ahora mismo</div>
    <div class="act-est">
      <div class="act-est-nom">${esc(c.archivo)}</div>
      <span class="act-chip ${paso[1]}">${esc(paso[0])}</span>
    </div>
    ${t.total ? `<div class="act-prog">
      <div class="act-prog-top"><span class="act-prog-pct">${pct}%</span><span class="act-prog-sub">${hechas} de ${t.total} tandas · ${c.paginas} páginas${t.error ? ` · <b style="color:#fca5a5">${t.error} con error</b>` : ''}</span></div>
      <div class="act-barra"><div class="act-barra-int" style="width:${pct}%"></div></div>
    </div>` : ''}
    <div class="act-sub" style="margin-top:6px;color:var(--muted2)">Nada de esto se ve en el catálogo hasta que pase las tres puertas.</div>
  </div>`;
}

function actPuertasHtml(d) {
  const p = d.puertas || [];
  if (!p.length) return '';
  const todas = p.every(x => x.ok);
  const filas = p.map(x => `
    <div class="act-puerta ${x.ok ? '' : 'frenada'}">
      <div class="act-puerta-ico ${x.ok ? 'act-puerta-ok' : 'act-puerta-mal'}"><i class="fas fa-${x.ok ? 'circle-check' : 'circle-exclamation'}"></i></div>
      <div style="flex:1;min-width:0">
        <div class="act-puerta-nom">${esc(x.nombre)}</div>
        <div class="act-puerta-det">${esc(x.detalle || '')}</div>
        ${(x.pares || []).length ? `<div class="act-puerta-det" style="margin-top:4px;color:#ffd595">${(x.pares || []).map(q => esc(`${q.a} ↔ ${q.b}`)).join('<br>')}</div>` : ''}
      </div>
    </div>`).join('');

  const mov = ((d.carga?.informe?.precios || {}).saltos_fuertes || []).slice(0, 8);
  return `<div class="act-blk">
    <div class="act-blk-t">Puertas para publicar</div>
    ${filas}
    ${mov.length ? `<div class="act-blk-t" style="margin:13px 0 7px">Los que más se mueven</div>
      ${mov.map(m => `<div class="act-mov">
        <div class="act-mov-nom">${esc(m.hotel)}</div>
        <div class="act-sub" style="white-space:nowrap">$${m.viejo} → $${m.nuevo}</div>
        <div class="act-mov-delta ${Number(m.delta_pct) >= 0 ? 'sube' : 'baja'}">${Number(m.delta_pct) >= 0 ? '+' : ''}${m.delta_pct}%</div>
      </div>`).join('')}` : ''}
    <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:12px">
      <button class="dbtn ${todas ? 'primary' : ''}" id="act-activar" type="button" style="flex:none;width:auto;padding:9px 14px;font-size:12.5px">
        <i class="fas fa-rocket"></i> Publicar ahora</button>
      <button class="dbtn" id="act-revertir" type="button" style="flex:none;width:auto;padding:9px 14px;font-size:12.5px">
        <i class="fas fa-rotate-left"></i> Descartar borrador</button>
    </div>
    ${todas ? '<div class="act-sub" style="margin-top:8px">Pasó las tres. Se publica sola en la próxima corrida; el botón solo la adelanta.</div>'
            : '<div class="act-sub" style="margin-top:8px;color:#ffd595">No se va a publicar sola hasta que resuelvas lo de arriba.</div>'}
  </div>`;
}

function actSaludHtml(salud) {
  if (!salud.length) return '';
  const filas = salud.map(s => {
    const esperado = ACT_ESPERADO[s.proceso] || 60;
    const m = s.minutos;
    // Dos señales distintas y las dos importan: el reloj puede estar corriendo
    // al día mientras la función falla en cada corrida.
    // Un job recién programado todavía no tiene corrida: eso no es una falla,
    // es que no le tocó. Rojo ahí gastaría la alarma que sí importa.
    const nuevo = m === null && s.activo;
    const parado = !nuevo && (!s.activo || m === null || m > esperado * 3);
    const fallando = s.resultado_ok === false;
    const estado = parado || fallando ? 'mal' : nuevo ? 'tibio' : m > esperado * 1.5 ? 'tibio' : 'ok';
    const cuando = m === null ? (nuevo ? 'todavía no le toca' : 'nunca corrió')
                 : m < 1 ? 'recién' : m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`;
    return `<div class="act-salud" style="align-items:flex-start">
      <span class="act-punto ${estado}" style="margin-top:5px"></span>
      <div class="act-salud-nom">
        ${esc(ACT_NOMBRES[s.proceso] || s.proceso)}
        ${parado ? '<span style="color:#fca5a5"> · dejó de correr</span>' : ''}
        ${s.resultado ? `<div class="act-sub" style="margin-top:2px;${fallando ? 'color:#fca5a5' : ''}">${esc(s.resultado)}</div>` : ''}
      </div>
      <div class="act-salud-t" style="margin-top:1px">${esc(cuando)}</div>
    </div>`;
  }).join('');
  return `<div class="act-blk"><div class="act-blk-t">Procesos automáticos</div>${filas}
    <div class="act-sub" style="margin-top:9px;color:var(--muted2)">Debajo de cada uno está lo que contestó la última vez. Rojo es que dejó de correr, o que corre y falla.</div></div>`;
}

function actColaHtml(d) {
  const cola = d.cola_drive || [];
  if (!cola.length) return '';
  return `<div class="act-blk"><div class="act-blk-t">Esperando en Drive</div>
    ${cola.map(a => `<div class="act-salud">
      <div class="act-salud-nom">${esc(a.archivo)}</div>
      <div class="act-salud-t">${a.camino === 'maestro' ? 'tarifario completo' : 'archivo suelto'}</div>
    </div>`).join('')}</div>`;
}

// Punto rojo en la pestaña cuando algo necesita una persona: una carga frenada
// o un proceso que dejó de correr.
function actPintarPillProceso(d) {
  const pill = document.getElementById('act-pill-proc');
  if (!pill) return;
  const puertaMal = (d.puertas || []).some(p => !p.ok);
  const cronMal = (d.salud || []).some(s => {
    const esperado = ACT_ESPERADO[s.proceso] || 60;
    if (s.minutos === null && s.activo) return false; // programado, sin corrida todavía
    return !s.activo || s.minutos === null || s.minutos > esperado * 3 || s.resultado_ok === false;
  });
  pill.hidden = !(puertaMal || cronMal);
}

async function actActivarCarga() {
  const d = ACT_PANEL_DATA;
  if (!d?.carga?.id) return;
  const puertasMal = (d.puertas || []).filter(p => !p.ok);
  const detalleAviso = puertasMal.length
    ? `Hay ${puertasMal.length} puerta(s) sin pasar:\n\n${puertasMal.map(p => `• ${p.nombre}: ${p.detalle}`).join('\n')}`
    : '';
  if (!(await confirmarSheet({ titulo: '¿Publicar el tarifario nuevo ahora?', detalle: detalleAviso, textoOk: 'Publicar' }))) return;
  const { data, error } = await sb.rpc('activar_carga_maestra', { p_carga_id: d.carga.id });
  if (error) return errToast(error.message);
  okToast(`Publicado: ${data?.tarifas_activadas ?? 0} precios nuevos`);
  cargarPanelProceso();
  loadTarifario();
}

async function actRevertirCarga() {
  const d = ACT_PANEL_DATA;
  if (!d?.carga?.id) return;
  if (!(await confirmarSheet({ titulo: '¿Descartar el borrador?', detalle: 'El catálogo queda como está ahora.', textoOk: 'Descartar', destructivo: true }))) return;
  const { error } = await sb.rpc('revertir_carga_maestra', { p_carga_id: d.carga.id });
  if (error) return errToast(error.message);
  okToast('Borrador descartado');
  cargarPanelProceso();
}

/* --- Pestaña: portadas propuestas por el curador ---
   `cola_portadas()` compara la primera foto que ve el cliente contra la mejor
   que ya está cargada. Solo propone: cambiar la portada lo hace una persona
   acá, porque es visible para todo el mundo en el instante en que se aplica. */
let ACT_PORTADAS = [];

async function cargarPanelPortadas() {
  const cont = document.getElementById('act-panel-portadas');
  if (!cont.dataset.pintado) actSkel('act-panel-portadas');
  const { data, error } = await sb.rpc('cola_portadas');
  if (error) {
    cont.innerHTML = `<div class="vig-vacio">No se pudo cargar: ${esc(error.message)}</div>`;
    return;
  }
  cont.dataset.pintado = '1';
  ACT_PORTADAS = data || [];
  const pill = document.getElementById('act-pill-port');
  pill.textContent = ACT_PORTADAS.length;
  pill.hidden = !ACT_PORTADAS.length;
  cont.innerHTML = ACT_PORTADAS.length
    ? ACT_PORTADAS.map((p, i) => portadaCardHtml(p, i)).join('')
    : `<div class="act-vacio"><i class="fas fa-image"></i>Ninguna portada para cambiar.<br>La primera foto de cada ficha es una foto del lugar.</div>`;
}

const PF_CLASES = {
  lugar: 'foto del lugar', texto: 'captura de texto', collage: 'montaje de varias fotos',
  plano: 'plano o mapa', logo: 'logo', persona: 'gente posando', otro: 'no identificada',
};

function portadaCardHtml(p, i) {
  const lado = (f, cap, elegida) => `
    <div class="pf-lado${elegida ? ' elegida' : ''}">
      <div class="pf-cap">${cap}</div>
      <div class="pf-img" style="background-image:url('${esc(fotoMini(f.storage_path, 384))}')"></div>
      <span class="pf-clase${f.clase === 'lugar' && f.portada >= 7 ? ' lugar' : ''}">${esc(PF_CLASES[f.clase] || f.clase)}${f.portada ? ` · ${f.portada}/10` : ''}</span>
      <div class="pf-motivo">${esc(f.motivo || '')}</div>
    </div>`;
  return `
    <div class="act-blk">
      <div class="act-blk-t">${esc(p.entidad || 'Sin nombre')}${p.destino ? ` · ${esc(p.destino)}` : ''}</div>
      <div class="pf-par">
        ${lado(p.actual, 'Se ve hoy', false)}
        <div class="pf-flecha"><i class="fas fa-arrow-right"></i></div>
        ${lado(p.propuesta, 'Propuesta', true)}
      </div>
      <div class="pf-acciones">
        <button class="dbtn" type="button" onclick="portadaDescartar(${i})">Dejar como está</button>
        <button class="dbtn save" type="button" onclick="portadaAplicar(${i})"><i class="fas fa-check"></i> Cambiar portada</button>
      </div>
    </div>`;
}

// app.js es un módulo: lo que llama un onclick del HTML tiene que colgar de
// window a mano.
window.portadaAplicar = async (i) => {
  const p = ACT_PORTADAS[i];
  if (!p) return;
  const { data, error } = await sb.rpc('aplicar_portada', { p_tabla: p.tabla, p_foto_id: p.propuesta.id });
  if (error) return errToast(error.message);
  if (!data?.ok) return errToast(data?.error || 'No se pudo');
  okToast(`Portada cambiada en ${p.entidad}`);
  cargarPanelPortadas();
};

// Descartar es solo visual: la propuesta vuelve a aparecer en la próxima
// apertura. Marcarla como "vista" para siempre necesitaría otra tabla, y todavía
// no sabemos cuántas propuestas se rechazan de verdad.
window.portadaDescartar = (i) => {
  ACT_PORTADAS.splice(i, 1);
  const cont = document.getElementById('act-panel-portadas');
  cont.innerHTML = ACT_PORTADAS.length
    ? ACT_PORTADAS.map((p, n) => portadaCardHtml(p, n)).join('')
    : `<div class="act-vacio"><i class="fas fa-image"></i>No queda ninguna propuesta pendiente.</div>`;
  const pill = document.getElementById('act-pill-port');
  pill.textContent = ACT_PORTADAS.length;
  pill.hidden = !ACT_PORTADAS.length;
};

/* --- Pestaña 2: correr la actualización --- */
async function cargarPanelCorrer() {
  const cont = document.getElementById('act-panel-correr');
  const { data, error } = await sb.rpc('estado_cola_tarifario');
  const e = error ? {} : (data || {});
  cont.innerHTML = `
    <div class="vig-resumen">
      <div class="vig-kpi ${e.pendientes ? 'aviso' : ''}"><b>${e.pendientes ?? '—'}</b><span>En cola</span></div>
      <div class="vig-kpi"><b>${e.procesando ?? '—'}</b><span>Procesando</span></div>
      <div class="vig-kpi ${e.con_error ? 'grave' : ''}"><b>${e.con_error ?? '—'}</b><span>Con error</span></div>
      <div class="vig-kpi ${e.por_revisar ? 'aviso' : ''}"><b>${e.por_revisar ?? '—'}</b><span>Por revisar</span></div>
    </div>
    <div class="act-run">
      <h4>Buscar y actualizar</h4>
      <p>Revisa las carpetas de Drive, extrae los archivos nuevos y los publica en el catálogo.<br>Tarda unos minutos; podés cerrar esta pantalla mientras corre.</p>
      <button class="dbtn primary" id="act-correr-btn"><i class="fas fa-arrows-rotate"></i> Actualizar ahora</button>
      <div class="act-estado" id="act-correr-estado">
        ${e.ultima_corrida ? `Última actualización: <b>${esc(fmtFechaHoraCaracas(e.ultima_corrida))}</b>` : 'Sin corridas registradas todavía.'}
        <br>${e.procesados ?? 0} archivo(s) procesados en total.
      </div>
    </div>`;
  document.getElementById('act-correr-btn').addEventListener('click', correrActualizacionTarifario);
}

async function correrActualizacionTarifario() {
  const btn = document.getElementById('act-correr-btn');
  const estado = document.getElementById('act-correr-estado');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Corriendo...';
  const { data, error } = await sb.rpc('disparar_actualizacion_tarifario');
  if (error || !data?.ok) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-arrows-rotate"></i> Actualizar ahora';
    errToast('No se pudo disparar: ' + (error?.message || data?.error || ''));
    return;
  }
  okToast('Actualización lanzada');
  // El pipeline es asíncrono: el botón no puede saber cuándo terminó, así que
  // en vez de mentir con un spinner eterno se refresca el estado al rato.
  estado.innerHTML = 'Corriendo en segundo plano. El resultado aparece en el Historial en unos minutos.';
  setTimeout(() => { if (document.getElementById('act-correr-btn')) cargarPanelCorrer(); }, 45000);
}

/* --- Pestaña 3: historial --- */
async function cargarHistorialTarifario() {
  actSkel('act-panel-historial');
  const { data, error } = await sb.rpc('historial_tarifario', { p_limite: 60 });
  const cont = document.getElementById('act-panel-historial');
  if (error) { cont.innerHTML = `<div class="vig-vacio">No se pudo cargar: ${esc(error.message)}</div>`; return; }
  const filas = data || [];
  if (!filas.length) { cont.innerHTML = '<div class="vig-vacio"><i class="fas fa-clock-rotate-left"></i><b>Sin historial</b></div>'; return; }
  cont.innerHTML = filas.map(f => {
    const nombreCorto = (f.fuente_archivo || '').split('/').pop() || f.fuente_archivo || '(sin archivo)';
    const detalle = f.ok
      ? (f.titulos ? esc(f.titulos) : `${f.filas} fila(s) publicada(s)`)
      : esc(f.error || 'error sin detalle');
    return `<div class="act-h">
      <div class="act-h-ic ${f.ok ? 'ok' : 'err'}"><i class="fas ${f.ok ? 'fa-check' : 'fa-xmark'}"></i></div>
      <div class="act-h-body">
        <div class="act-h-file">${esc(nombreCorto)}</div>
        <div class="act-h-det">${detalle}</div>
        <div class="act-h-meta">
          <span class="act-h-modelo">${esc(f.modelo || 'n/a')}</span>
          ${f.ok ? `${f.filas} fila(s)` : ''}
          ${f.precio_alerta ? ' · <span style="color:#ff6b6b">cambio de precio grande</span>' : ''}
          ${f.necesita_revision ? ' · pendiente de revisión' : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ---------- Servicio de interés detectado por IA ----------
   El campo estaba vacío en el 99,8% de los leads: nadie lo llenaba a mano y la
   ingesta no lo mandaba. Desde el 2026-07-30 los leads nuevos entran ya
   clasificados (_shared/servicio_ia.ts) y estos dos botones -- uno en la ficha,
   otro en la barra de selección -- sirven para los que ya estaban cargados.
   La Edge Function acepta hasta 25 por llamada; el bulk manda de a 10 para que
   cada tanda vuelva rápido y la barra de progreso se mueva de verdad. */
const SERVICIO_IA_LOTE = 10;

async function clasificarServicioLeads(ids) {
  const { data, error } = await sb.functions.invoke('clasificar-servicio-lead', { body: { lead_ids: ids } });
  if (error) return { error: error.message || 'No se pudo conectar con la IA' };
  if (!data?.ok) return { error: data?.error || 'La IA no pudo procesar el lote' };
  return data;
}

async function detectarServicioDelLead() {
  const btn = document.getElementById('e-servicio-ia'), razon = document.getElementById('e-servicio-razon');
  const html0 = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';
  const res = await clasificarServicioLeads([currentLead.id]);
  btn.disabled = false; btn.innerHTML = html0;
  if (res.error) { razon.textContent = 'No se pudo analizar: ' + res.error; return; }
  const r = res.resultados?.[0];
  if (!r?.servicio) {
    razon.innerHTML = '<i class="fas fa-circle-question"></i> La IA no encontró datos suficientes para decidir el servicio. Podés elegirlo a mano.';
    return;
  }
  document.getElementById('e-servicio').value = r.servicio;
  currentLead.servicio = r.servicio;
  currentLead.servicio_ia_razon = r.razon;
  razon.innerHTML = '<i class="fas fa-robot"></i> ' + esc(r.razon || '');
  okToast('Servicio detectado: ' + r.servicio);
  loadTable();
}

async function detectarServicioSeleccionados() {
  const ids = [...SELECTED_LEADS];
  if (!ids.length) return;
  const btn = document.getElementById('bulk-servicio-ia');
  const html0 = btn.innerHTML;
  btn.disabled = true;
  let guardados = 0, sinDecidir = 0, fallidos = 0;
  for (let i = 0; i < ids.length; i += SERVICIO_IA_LOTE) {
    const lote = ids.slice(i, i + SERVICIO_IA_LOTE);
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${Math.min(i + lote.length, ids.length)}/${ids.length}`;
    const res = await clasificarServicioLeads(lote);
    if (res.error) { fallidos += lote.length; continue; }
    guardados += res.guardados || 0;
    sinDecidir += res.sin_decidir || 0;
  }
  btn.disabled = false; btn.innerHTML = html0;
  const partes = [`${guardados} con servicio detectado`];
  if (sinDecidir) partes.push(`${sinDecidir} sin datos suficientes`);
  if (fallidos) partes.push(`${fallidos} con error`);
  (fallidos ? errToast : okToast)(partes.join(' · '));
  clearSelection();
  loadTable();
}

// Las notas se guardan solas, sin pasar por actualizar_lead: no son parte del
// pipeline (no disparan eventos ni tocan métricas) y así el asesor puede
// anotar sin arrastrar el resto del formulario. Va por RPC porque leads no
// tiene grant de UPDATE para authenticated -- todo escribe vía security definer.
async function guardarNotasLead() {
  const btn = document.getElementById('e-notas-save'), meta = document.getElementById('e-notas-meta');
  const notas = val('e-notas').trim();
  btn.disabled = true; btn.innerHTML = 'Guardando... <i class="fas fa-spinner fa-spin"></i>';
  const { data, error } = await sb.rpc('guardar_notas_lead', { p_lead_id: currentLead.id, p_notas: notas });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar notas';
  if (error || !data?.ok) { meta.textContent = 'No se pudieron guardar: ' + (error?.message || data?.error || ''); return; }
  currentLead.notas = notas || null;
  meta.textContent = 'Guardado ' + fmtHoraCaracas(new Date().toISOString());
  okToast('Notas guardadas');
}

// Abre el drawer de edición completo de un lead/cliente desde Facturación
// (Ventas/Cuentas por Pagar) -- reusa openDrawer, mismo formulario que Leads.
window.abrirClienteDesdeFacturacion = async (leadId) => {
  const { data, error } = await sb.from('leads').select('*').eq('id', leadId).single();
  if (error || !data) { errToast('No se pudo cargar el cliente'); return; }
  openDrawer(data);
};

/* ---------- Enviar a facturación (asesor/admin, desde el drawer de un lead) ---------- */
// El botón manda el lead Y los datos de la venta. Antes iba pelado y el admin
// tenía que perseguir por chat cédula, qué se vendió, cuándo viaja y cuánto
// pagó -- se piden acá, que es el momento en que el asesor los tiene a mano.
let EF_LEAD_ACTUAL = null;
let efTipo = 'hospedaje';

const EF_ERRORES = {
  ya_facturado: 'Este cliente ya tiene una factura',
  falta_cedula: 'Falta la cédula del cliente',
  falta_hotel: 'Falta el hotel o posada',
  falta_ruta_vuelo: 'Falta de dónde a dónde es el vuelo',
  falta_fecha_viaje: 'Falta la fecha del viaje',
  regreso_antes_de_ida: 'La fecha de regreso es anterior a la de ida',
  falta_metodo_pago: 'Falta el método de pago',
  falta_monto_pagado: 'Falta el monto que pagó',
  pagado_mayor_que_total: 'El monto pagado es mayor que el total de la venta',
  lead_no_disponible: 'Este lead ya no está disponible',
};

async function abrirEnviarFacturacionSheet(l) {
  EF_LEAD_ACTUAL = l;
  document.getElementById('ef-err').textContent = '';
  document.getElementById('ef-cliente').innerHTML =
    `<i class="fas fa-user"></i> Facturando a <b>${esc(l.nombre || 'Sin nombre')}</b>${l.telefono ? ' · ' + esc(l.telefono) : ''}`;

  ['ef-cedula', 'ef-hotel', 'ef-vuelo-origen', 'ef-vuelo-destino', 'ef-fecha-viaje',
   'ef-fecha-regreso', 'ef-personas', 'ef-referencia', 'ef-monto-pagado',
   'ef-monto-total', 'ef-notas'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  document.getElementById('ef-metodo').value = '';
  document.getElementById('ef-abono').className = 'ef-abono';
  // El destino del lead suele ser la ciudad a la que viaja: sirve de arranque
  // para la ruta del vuelo, pero se deja editable porque no siempre coincide.
  if (l.destino) document.getElementById('ef-vuelo-destino').value = l.destino;
  efSetTipo('hospedaje');

  const sel = document.getElementById('ef-admin');
  sel.innerHTML = '<option value="">Luis Rueda (por defecto)</option>';
  const { data, error } = await sb.rpc('usuarios_chat');
  if (!error && data) {
    (data || []).filter(u => u.rol === 'admin').forEach(u => {
      sel.innerHTML += `<option value="${esc(u.id)}">${esc(u.nombre)}</option>`;
    });
  }
  openSheet('enviar-facturacion-sheet');
}

function efSetTipo(tipo) {
  efTipo = tipo;
  document.querySelectorAll('#ef-tipos .ef-tipo').forEach(b => b.classList.toggle('on', b.dataset.efTipo === tipo));
  // Un paquete puede llevar hotel y vuelo a la vez; "otro" no pide ninguno de
  // los dos pero sigue exigiendo fecha, método y monto.
  document.getElementById('ef-campo-hotel').style.display = (tipo === 'hospedaje' || tipo === 'paquete') ? '' : 'none';
  document.getElementById('ef-campo-vuelo').style.display = (tipo === 'boleteria' || tipo === 'paquete') ? '' : 'none';
  document.getElementById('ef-lbl-fecha').textContent = tipo === 'hospedaje' ? 'Fecha de entrada' : 'Fecha del viaje';
  document.getElementById('ef-lbl-regreso').innerHTML = (tipo === 'hospedaje' ? 'Fecha de salida' : 'Fecha de regreso') + ' <span class="ef-opc">(opcional)</span>';
}
document.getElementById('ef-tipos')?.addEventListener('click', e => {
  const b = e.target.closest('.ef-tipo'); if (b) efSetTipo(b.dataset.efTipo);
});

// Aviso en vivo de abono vs total: que el asesor vea el saldo antes de mandar,
// no que se entere el admin al facturar.
function efPintarAbono() {
  const pagado = parseFloat(val('ef-monto-pagado'));
  const total = parseFloat(val('ef-monto-total'));
  const box = document.getElementById('ef-abono');
  if (!Number.isFinite(pagado) || !Number.isFinite(total) || total <= 0) { box.className = 'ef-abono'; return; }
  if (pagado > total) {
    box.className = 'ef-abono show malo';
    box.textContent = 'Pagó más que el total de la venta. Revisá los dos montos antes de enviar.';
  } else if (pagado < total) {
    box.className = 'ef-abono show';
    box.textContent = `Es un abono: queda un saldo de ${money(total - pagado)}.`;
  } else {
    box.className = 'ef-abono show';
    box.textContent = 'Pago completo.';
  }
}
['ef-monto-pagado', 'ef-monto-total'].forEach(id =>
  document.getElementById(id)?.addEventListener('input', efPintarAbono));

document.getElementById('ef-cancelar')?.addEventListener('click', () => closeSheet('enviar-facturacion-sheet'));
document.getElementById('ef-enviar')?.addEventListener('click', async () => {
  if (!EF_LEAD_ACTUAL) return;
  const btn = document.getElementById('ef-enviar'), err = document.getElementById('ef-err');
  const num = id => { const v = parseFloat(val(id)); return Number.isFinite(v) ? v : null; };
  const ent = id => { const v = parseInt(val(id), 10); return Number.isFinite(v) ? v : null; };
  err.textContent = ''; btn.disabled = true; btn.innerHTML = 'Enviando... <i class="fas fa-spinner fa-spin"></i>';
  const { data, error } = await sb.rpc('enviar_a_facturacion', {
    p_lead_id: EF_LEAD_ACTUAL.id,
    p_admin_destino_id: val('ef-admin') || null,
    p_cedula: val('ef-cedula'),
    p_tipo_venta: efTipo,
    p_hotel_posada: val('ef-hotel'),
    p_vuelo_origen: val('ef-vuelo-origen'),
    p_vuelo_destino: val('ef-vuelo-destino'),
    p_fecha_viaje: val('ef-fecha-viaje') || null,
    p_fecha_regreso: val('ef-fecha-regreso') || null,
    p_personas: ent('ef-personas'),
    p_metodo_pago: val('ef-metodo'),
    p_referencia_pago: val('ef-referencia'),
    p_monto_pagado: num('ef-monto-pagado'),
    p_monto_total: num('ef-monto-total'),
    p_notas_venta: val('ef-notas'),
  });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar';
  if (error || !data?.ok) {
    const clave = data?.error;
    err.textContent = 'No se pudo enviar: ' + (EF_ERRORES[clave] || error?.message || clave || '');
    return;
  }
  closeSheet('enviar-facturacion-sheet');
  okToast(`Enviado a ${data.admin_destino}`);
  if (typeof loadLeadsEnFacturacion === 'function') loadLeadsEnFacturacion();
});

/* ---------- Bandeja de Entrada de Facturación (admin) ---------- */
let FACT_BANDEJA_CACHE = [];
async function loadBandejaFacturacion() {
  if (ROL !== 'admin') return;
  const loading = document.getElementById('fact-bandeja-loading'), empty = document.getElementById('fact-bandeja-empty');
  loading?.classList.add('show');
  const { data, error } = await sb.rpc('listar_bandeja_facturacion');
  loading?.classList.remove('show');
  if (error) { console.error('bandeja_facturacion', error); return; }
  FACT_BANDEJA_CACHE = data || [];
  document.getElementById('fact-bandeja-count').textContent = FACT_BANDEJA_CACHE.length;
  empty?.classList.toggle('show', FACT_BANDEJA_CACHE.length === 0);
  const grid = document.getElementById('fact-bandeja-grid');
  grid.innerHTML = FACT_BANDEJA_CACHE.map(b => {
    // Los datos que cargó el asesor al enviar. Se muestran acá para no tener
    // que abrir el lead ni preguntarle nada por chat antes de facturar.
    const meta = LF_TIPO[b.tipo_venta];
    const queSeVendio = [meta?.t, lfDetalleVenta(b)].filter(Boolean).join(' · ');
    const fechas = [b.fecha_viaje && fmtDiaCorto(b.fecha_viaje), b.fecha_regreso && fmtDiaCorto(b.fecha_regreso)]
      .filter(Boolean).join(' → ');
    const pagado = b.monto_pagado != null ? Number(b.monto_pagado) : null;
    const total = b.monto_total != null ? Number(b.monto_total) : null;
    const fila = (icono, texto) => texto ? `<div class="ec-row"><i class="fas ${icono}"></i> ${texto}</div>` : '';
    return `
    <div class="entity-card inbox-card" data-id="${b.lead_id}">
      <div class="ec-top"><div class="ec-nombre">${esc(b.nombre)}</div></div>
      <div class="ec-row"><i class="fas fa-phone"></i> ${esc(b.telefono) || 'Sin teléfono'}</div>
      ${fila('fa-id-card', esc(b.cedula || ''))}
      ${queSeVendio ? fila(meta?.i || 'fa-tag', esc(queSeVendio)) : `<div class="ec-row"><i class="fas fa-location-dot"></i> ${esc(b.destino) || '—'}</div>`}
      ${fila('fa-calendar-day', esc(fechas) + (b.personas != null ? ` · ${b.personas} pers.` : ''))}
      ${fila('fa-dollar-sign', pagado != null ? `Pagó ${money(pagado)}${total != null ? ` de ${money(total)}` : ''}${(total != null && total > pagado) ? ` · <b style="color:var(--amber)">saldo ${money(total - pagado)}</b>` : ''}` : '')}
      ${fila('fa-credit-card', esc([b.metodo_pago, b.referencia_pago].filter(Boolean).join(' · ')))}
      ${fila('fa-note-sticky', esc(b.notas_venta || ''))}
      <div class="ec-row"><i class="fas fa-user"></i> Enviado por ${esc(b.enviado_por)}</div>
      <div class="ec-row"><i class="fas fa-clock"></i> ${tiempoRelativo(b.creado_en)}</div>
      <div class="inbox-actions">
        <button type="button" class="inbox-btn atender" data-bandeja-lead-id="${b.lead_id}"><i class="fas fa-file-invoice-dollar"></i> Facturar</button>
      </div>
    </div>`;
  }).join('');
  grid.querySelectorAll('[data-bandeja-lead-id]').forEach(btn => btn.addEventListener('click', () => {
    const item = FACT_BANDEJA_CACHE.find(x => String(x.lead_id) === btn.dataset.bandejaLeadId);
    if (item) window.abrirNuevoClienteFacturacion(item);
  }));
}

/* ---------- Ventas por verificar (admin) -- ventas que un asesor cerró
   solo, blindaje contra monto/comisión inflada sin verificación
   independiente (ver 20260728000000_blindar_cierre_venta.sql) ---------- */
let FACT_VERIFICAR_CACHE = [];
async function loadVentasPendientesVerificar() {
  if (ROL !== 'admin') return;
  const loading = document.getElementById('fact-verificar-loading'), empty = document.getElementById('fact-verificar-empty');
  loading?.classList.add('show');
  const { data, error } = await sb.rpc('listar_ventas_pendientes_verificar');
  loading?.classList.remove('show');
  if (error) { console.error('ventas_pendientes_verificar', error); return; }
  FACT_VERIFICAR_CACHE = data || [];
  document.getElementById('fact-verificar-count').textContent = FACT_VERIFICAR_CACHE.length;
  empty?.classList.toggle('show', FACT_VERIFICAR_CACHE.length === 0);
  const grid = document.getElementById('fact-verificar-grid');
  grid.innerHTML = FACT_VERIFICAR_CACHE.map(v => `
    <div class="entity-card inbox-card" data-id="${v.lead_id}">
      <div class="ec-top"><div class="ec-nombre">${esc(v.nombre)}</div></div>
      <div class="ec-row"><i class="fas fa-phone"></i> ${esc(v.telefono) || 'Sin teléfono'}</div>
      <div class="ec-row"><i class="fas fa-user"></i> Cerrada por ${esc(v.asesor) || 'Sin asignar'}</div>
      <div class="ec-row"><i class="fas fa-dollar-sign"></i> ${money(v.monto_total)}${v.costo_neto != null ? ` · costo ${money(v.costo_neto)}` : ''}${v.proveedor ? ` · ${esc(v.proveedor)}` : ''}</div>
      <div class="ec-row"><i class="fas fa-clock"></i> ${tiempoRelativo(v.actualizado_en)}</div>
      <div class="inbox-actions">
        <button type="button" class="inbox-btn atender" data-confirmar-lead-id="${v.lead_id}"><i class="fas fa-check"></i> Confirmar</button>
        <button type="button" class="inbox-btn nopuedo" data-rechazar-lead-id="${v.lead_id}"><i class="fas fa-xmark"></i> Rechazar</button>
      </div>
    </div>`).join('');
  grid.querySelectorAll('[data-confirmar-lead-id]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true;
    const { data, error } = await sb.rpc('confirmar_venta', { p_lead_id: Number(btn.dataset.confirmarLeadId) });
    if (error || !data?.ok) { errToast('No se pudo confirmar: ' + (error?.message || data?.error || '')); btn.disabled = false; return; }
    okToast('Venta confirmada -- factura y comisión generadas');
    loadVentasPendientesVerificar();
    loadFacturas();
  }));
  grid.querySelectorAll('[data-rechazar-lead-id]').forEach(btn => btn.addEventListener('click', async () => {
    const motivo = prompt('Motivo del rechazo (opcional):');
    if (motivo === null) return; // canceló el prompt
    btn.disabled = true;
    const { data, error } = await sb.rpc('rechazar_venta', { p_lead_id: Number(btn.dataset.rechazarLeadId), p_motivo: motivo });
    if (error || !data?.ok) { errToast('No se pudo rechazar: ' + (error?.message || data?.error || '')); btn.disabled = false; return; }
    okToast('Venta rechazada -- vuelve a En espera de pago');
    loadVentasPendientesVerificar();
  }));
}

/* ---------- Nuevo lead manual (botón "Nuevo lead" en Leads, admin + asesor) /
   Nuevo cliente de Facturación (mismo sheet, modo distinto) ---------- */
let NL_MODO_FACTURACION = false, NL_BANDEJA_LEAD_ID = null, NL_BUSCAR_DEBOUNCE = null;

async function poblarAsesoresSheetNuevoLead() {
  const sel = document.getElementById('nl-asesor');
  sel.innerHTML = '<option value="">Sin asignar</option>';
  const { data, error } = await sb.rpc('listar_asesores_activos');
  if (!error && data) sel.innerHTML += data.map(a => `<option value="${esc(a.nombre)}">${esc(a.nombre)}</option>`).join('');
}

function resetSheetNuevoCliente() {
  document.getElementById('nl-lead-id-existente').value = '';
  document.getElementById('nl-nombre').value = '';
  document.getElementById('nl-nombre').readOnly = false;
  document.getElementById('nl-telefono').value = '';
  document.getElementById('nl-telefono').readOnly = false;
  document.getElementById('nl-destino').value = '';
  document.getElementById('nl-personas').value = '';
  document.getElementById('nl-fecha').value = '';
  document.getElementById('nl-es-prueba').checked = false;
  document.getElementById('nl-precio-venta').value = '';
  document.getElementById('nl-costo-neto').value = '';
  document.getElementById('nl-proveedor').value = '';
  document.getElementById('nl-buscar-cliente').value = '';
  document.getElementById('nl-buscar-resultados').style.display = 'none';
  document.getElementById('nl-buscar-resultados').innerHTML = '';
  document.getElementById('nl-buscar-seleccionado').style.display = 'none';
  document.getElementById('nl-buscar-cliente').style.display = '';
  document.getElementById('nl-err').textContent = '';
}

document.getElementById('nl-abrir-btn')?.addEventListener('click', async () => {
  resetSheetNuevoCliente();
  NL_MODO_FACTURACION = false; NL_BANDEJA_LEAD_ID = null;
  document.getElementById('nl-titulo').innerHTML = '<i class="fas fa-user-plus"></i> Nuevo lead';
  document.getElementById('nl-crear').innerHTML = '<i class="fas fa-floppy-disk"></i> Crear lead';
  document.getElementById('nl-buscar-box').style.display = 'none';
  document.getElementById('nl-fact-box').style.display = 'none';
  document.getElementById('nl-prueba-label').style.display = '';
  if (ROL === 'admin') await poblarAsesoresSheetNuevoLead();
  openSheet('nuevo-lead-sheet');
});

// Abre el mismo sheet en modo "Nuevo cliente" de Facturación -- con datos de
// venta (precio/costo/proveedor) y buscador de clientes existentes. Si viene
// de la Bandeja de Entrada, `bandejaItem` trae lead_id/nombre/telefono ya
// resueltos y precargados de solo lectura (no se puede "crear otro cliente"
// desde ahí, ya existe).
window.abrirNuevoClienteFacturacion = async (bandejaItem) => {
  resetSheetNuevoCliente();
  NL_MODO_FACTURACION = true;
  NL_BANDEJA_LEAD_ID = bandejaItem ? bandejaItem.lead_id : null;
  document.getElementById('nl-titulo').innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Nuevo cliente';
  document.getElementById('nl-crear').innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar y facturar';
  document.getElementById('nl-fact-box').style.display = '';
  document.getElementById('nl-prueba-label').style.display = 'none';
  await poblarAsesoresSheetNuevoLead();
  if (bandejaItem) {
    document.getElementById('nl-buscar-box').style.display = '';
    document.getElementById('nl-buscar-cliente').style.display = 'none';
    document.getElementById('nl-buscar-seleccionado').style.display = '';
    document.getElementById('nl-lead-id-existente').value = bandejaItem.lead_id;
    document.getElementById('nl-nombre').value = bandejaItem.nombre || '';
    document.getElementById('nl-nombre').readOnly = true;
    document.getElementById('nl-telefono').value = bandejaItem.telefono || '';
    document.getElementById('nl-telefono').readOnly = true;
    document.getElementById('nl-destino').value = bandejaItem.destino || '';
    if (bandejaItem.asesor && [...document.getElementById('nl-asesor').options].some(o => o.value === bandejaItem.asesor)) {
      document.getElementById('nl-asesor').value = bandejaItem.asesor;
    }
    // Lo que cargó el asesor al enviar entra precargado, editable: el admin
    // verifica contra el comprobante en vez de volver a tipearlo. El precio de
    // venta es el total, no lo abonado -- si solo hay abono se deja vacío
    // para que nadie facture una inicial como si fuera la venta completa.
    if (bandejaItem.monto_total != null) document.getElementById('nl-precio-venta').value = bandejaItem.monto_total;
    if (bandejaItem.hotel_posada) document.getElementById('nl-proveedor').value = bandejaItem.hotel_posada;
  } else {
    document.getElementById('nl-buscar-box').style.display = '';
  }
  openSheet('nuevo-lead-sheet');
};

document.getElementById('fact-nuevo-cliente-btn')?.addEventListener('click', () => window.abrirNuevoClienteFacturacion());

document.getElementById('nl-buscar-cliente')?.addEventListener('input', (e) => {
  clearTimeout(NL_BUSCAR_DEBOUNCE);
  const q = e.target.value.trim();
  const box = document.getElementById('nl-buscar-resultados');
  if (q.length < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
  NL_BUSCAR_DEBOUNCE = setTimeout(async () => {
    // ,()% son operadores del filtro .or() de PostgREST -- se sacan del texto
    // libre para que no se interprete como sintaxis de filtro (mismo patrón
    // que buildQuery() usa para el buscador de Leads).
    const qSafe = q.replace(/[,()%]/g, '');
    const { data, error } = await sb.from('leads').select('id,nombre,telefono,destino,asesor,estado')
      .or(`nombre.ilike.%${qSafe}%,telefono.ilike.%${qSafe}%,telefono_2.ilike.%${qSafe}%`)
      .is('eliminado_at', null).limit(15);
    if (error) { box.style.display = 'none'; return; }
    if (!data || !data.length) { box.innerHTML = '<div style="padding:10px;font-size:12.5px;color:var(--muted)">Sin resultados</div>'; box.style.display = ''; return; }
    box.innerHTML = data.map(l => `
      <div class="nl-buscar-row" data-lead-id="${l.id}" style="padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border,#333);font-size:13px">
        <b>${esc(l.nombre)}</b> <span style="color:var(--muted)">${esc(l.telefono || 'sin teléfono')}</span>
        <div style="font-size:11.5px;color:var(--muted2)">${esc(l.asesor || 'Sin asignar')} · ${esc(niceEstado(l.estado))}</div>
      </div>`).join('');
    box.style.display = '';
    box.querySelectorAll('.nl-buscar-row').forEach(row => row.addEventListener('click', () => {
      const l = data.find(x => String(x.id) === row.dataset.leadId);
      if (!l) return;
      document.getElementById('nl-lead-id-existente').value = l.id;
      document.getElementById('nl-nombre').value = l.nombre || '';
      document.getElementById('nl-nombre').readOnly = true;
      document.getElementById('nl-telefono').value = l.telefono || '';
      document.getElementById('nl-telefono').readOnly = true;
      document.getElementById('nl-destino').value = l.destino || '';
      if (l.asesor && [...document.getElementById('nl-asesor').options].some(o => o.value === l.asesor)) {
        document.getElementById('nl-asesor').value = l.asesor;
      }
      document.getElementById('nl-buscar-cliente').style.display = 'none';
      box.style.display = 'none'; box.innerHTML = '';
      document.getElementById('nl-buscar-seleccionado').style.display = '';
    }));
  }, 300);
});
document.getElementById('nl-buscar-limpiar')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('nl-lead-id-existente').value = '';
  document.getElementById('nl-nombre').value = ''; document.getElementById('nl-nombre').readOnly = false;
  document.getElementById('nl-telefono').value = ''; document.getElementById('nl-telefono').readOnly = false;
  document.getElementById('nl-buscar-cliente').value = '';
  document.getElementById('nl-buscar-cliente').style.display = '';
  document.getElementById('nl-buscar-seleccionado').style.display = 'none';
});

document.getElementById('nl-aleatorio-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('nl-aleatorio-btn'), err = document.getElementById('nl-err');
  err.textContent = ''; btn.disabled = true;
  const { data, error } = await sb.rpc('sortear_asesor_manual', { p_destino: val('nl-destino').trim() });
  btn.disabled = false;
  if (error || !data?.ok) { err.textContent = 'No se pudo sortear: ' + (error?.message || data?.motivo || ''); return; }
  const sel = document.getElementById('nl-asesor');
  if ([...sel.options].some(o => o.value === data.asesor)) sel.value = data.asesor;
  okToast(`Asignado aleatoriamente a ${data.asesor}`);
});
document.getElementById('nl-cancelar')?.addEventListener('click', () => closeSheet('nuevo-lead-sheet'));
document.getElementById('nl-crear')?.addEventListener('click', async () => {
  const btn = document.getElementById('nl-crear'), err = document.getElementById('nl-err');
  const nombre = val('nl-nombre').trim();
  if (!nombre) { err.textContent = 'El nombre no puede quedar vacío'; return; }

  if (!NL_MODO_FACTURACION) {
    err.textContent = ''; btn.disabled = true; btn.innerHTML = 'Creando... <i class="fas fa-spinner fa-spin"></i>';
    const { data, error } = await sb.rpc('crear_lead_manual', {
      p_nombre: nombre, p_telefono: val('nl-telefono').trim(), p_destino: val('nl-destino').trim(),
      p_personas: val('nl-personas').trim(), p_asesor: ROL === 'admin' ? (val('nl-asesor') || null) : null,
      p_fecha_estimada: val('nl-fecha').trim(),
      p_es_prueba: document.getElementById('nl-es-prueba').checked,
    });
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Crear lead';
    if (error || !data?.ok) { err.textContent = 'No se pudo crear: ' + (error?.message || data?.error || ''); return; }
    closeSheet('nuevo-lead-sheet');
    okToast('Lead creado');
    // El INSERT ya dispara el canal 'leads-live' (subscribeRealtime) que
    // refresca stats/tabla/inbox solo -- no hace falta duplicar esa recarga acá.
    return;
  }

  // ---------- Modo Facturación: crear/reusar lead + venta + postventa,
  // encadenando 3 RPCs ya existentes (crear_lead_manual, actualizar_lead,
  // guardar_postventa con p_marcar_pagado:true) -- ver diseño en
  // vivid-bubbling-bachman.md. Genera factura+comisión+cuenta por pagar
  // automáticamente vía los triggers ya existentes, sin RPC nuevo. ----------
  const precioVenta = Number(val('nl-precio-venta') || 0);
  if (precioVenta <= 0) { err.textContent = 'Definí un precio de venta mayor a cero'; return; }
  const costoNetoRaw = val('nl-costo-neto');
  const costoNeto = costoNetoRaw === '' ? null : Number(costoNetoRaw);
  if (costoNeto !== null && costoNeto < 0) { err.textContent = 'El costo neto no puede ser negativo'; return; }
  const asesorSel = ROL === 'admin' ? (val('nl-asesor') || null) : null;

  err.textContent = ''; btn.disabled = true; btn.innerHTML = 'Guardando... <i class="fas fa-spinner fa-spin"></i>';
  let leadId = val('nl-lead-id-existente') || null;
  if (!leadId) {
    const { data, error } = await sb.rpc('crear_lead_manual', {
      p_nombre: nombre, p_telefono: val('nl-telefono').trim(), p_destino: val('nl-destino').trim(),
      p_personas: val('nl-personas').trim(), p_asesor: asesorSel,
    });
    if (error || !data?.ok) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar y facturar'; err.textContent = 'No se pudo crear el cliente: ' + (error?.message || data?.error || ''); return; }
    leadId = data.lead_id;
  }

  const upd = await sb.rpc('actualizar_lead', { p_lead_id: leadId, p_estado: 'EN ESPERA DE PAGO', p_asesor: asesorSel, p_monto: precioVenta });
  if (upd.error || !upd.data?.ok) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar y facturar'; err.textContent = 'No se pudo actualizar el lead: ' + (upd.error?.message || upd.data?.error || ''); return; }

  const pv = await sb.rpc('guardar_postventa', {
    p_lead_id: leadId, p_etapa: 'COBRO_PENDIENTE', p_prioridad: 'NORMAL',
    p_monto_total: precioVenta, p_monto_pagado: precioVenta,
    p_proveedor: val('nl-proveedor').trim() || null, p_costo_neto: costoNeto,
    p_marcar_pagado: true,
  });
  if (pv.error || !pv.data?.ok) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar y facturar'; err.textContent = 'No se pudo facturar: ' + (pv.error?.message || pv.data?.error || ''); return; }

  if (NL_BANDEJA_LEAD_ID) {
    const marc = await sb.rpc('marcar_bandeja_procesada', { p_lead_id: NL_BANDEJA_LEAD_ID });
    // La factura/comisión ya se generaron -- esto NO revierte nada si falla,
    // solo avisa que la tarjeta puede seguir viéndose en la Bandeja aunque
    // ya esté facturada (se puede volver a facturar sin duplicar, guardar_postventa
    // es idempotente vía on conflict, así que no rompe nada, es solo prolijidad).
    if (marc.error || !marc.data?.ok) console.error('marcar_bandeja_procesada', marc.error || marc.data);
  }

  btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar y facturar';
  closeSheet('nuevo-lead-sheet');
  okToast('Cliente facturado');
  loadFacturacion();
  loadBandejaFacturacion();
});
window.closeDrawer = (fromNav) => {
  const notas = document.getElementById('tar-notas');
  if (notas && notas.value.trim() !== (notas.dataset.original || '').trim() && !confirm('Hay notas sin guardar. ¿Cerrar de todas formas?')) return;
  document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerBg').classList.remove('open'); if (!fromNav) navConsume();
};
document.getElementById('dClose').onclick = () => window.closeDrawer();
document.getElementById('drawerBg').onclick = () => window.closeDrawer();

/* ---------- Métricas ---------- */
let metPeriodo = 'mes';
function setupMetricas() {
  document.querySelectorAll('#met-periodo .seg').forEach(b => b.onclick = () => { document.querySelectorAll('#met-periodo .seg').forEach(x => x.classList.remove('on')); b.classList.add('on'); metPeriodo = b.dataset.p; loadMetricas(); });
}
async function loadMetricas() {
  await ensureChart();
  const [d, h] = periodo(metPeriodo);
  const { data, error } = await sb.rpc('metricas', { p_desde: iso(d), p_hasta: iso(h) });
  if (error) { console.error(error); errToast('No se pudieron cargar las métricas'); return; }
  const conv = data.nuevos ? ((data.ventas / data.nuevos) * 100).toFixed(1) : '0';
  const cards = [
    { t: 'Clientes nuevos', v: fmt(data.nuevos), i: 'fa-user-plus', c: 'var(--blue)' },
    { t: 'Atendidos', v: fmt(data.atendidos), i: 'fa-headset', c: 'var(--accent)' },
    { t: 'Ventas cerradas', v: fmt(data.ventas), i: 'fa-circle-check', c: 'var(--green)' },
    { t: 'Ingresos', v: money(data.monto), i: 'fa-dollar-sign', c: '#34d399' },
    { t: 'Conversión', v: conv + '%', i: 'fa-percent', c: 'var(--purple)' },
  ];
  // Sin `go`: estas cifras son del período elegido acá arriba y la tabla de
  // Leads no filtra por rango de fechas, así que no hay a dónde mandar el click
  // sin mostrar un conjunto distinto al que dice la tarjeta.
  pintarKPIs('met-kpis', cards);
  const s = data.serie || [];
  mk('chSerie', { type: 'line', data: { labels: s.map(x => x.dia.slice(8) + '/' + x.dia.slice(5, 7)), datasets: [{ label: 'Nuevos', data: s.map(x => x.nuevos), borderColor: '#4a9eff', backgroundColor: 'rgba(74,158,255,.1)', fill: true, tension: .35, borderWidth: 2, pointRadius: 0 }, { label: 'Ventas', data: s.map(x => x.ventas), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.12)', fill: true, tension: .35, borderWidth: 2, pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } }, y: { grid: { color: 'rgba(255,255,255,.05)' }, beginAtZero: true } } } });
  const se = sortEntries(data.por_servicio);
  mk('chServicio', { type: 'bar', data: { labels: se.map(x => x[0]), datasets: [{ data: se.map(x => x[1]), backgroundColor: '#a06bff', borderRadius: 6, barThickness: 18 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,.05)' }, beginAtZero: true }, y: { grid: { display: false } } } } });
  document.getElementById('met-servicio-empty').style.display = se.length ? 'none' : 'flex';
}

/* ---------- Ranking ---------- */
let rankPeriodo = 'mes', rankSort = 'ventas';
function setupRanking() {
  document.querySelectorAll('#rank-periodo .seg').forEach(b => b.onclick = () => { document.querySelectorAll('#rank-periodo .seg').forEach(x => x.classList.remove('on')); b.classList.add('on'); rankPeriodo = b.dataset.p; loadRanking(); });
}
async function loadRanking() {
  const [d, h] = periodo(rankPeriodo);
  const { data, error } = await sb.rpc('ranking_asesores', { p_desde: iso(d), p_hasta: iso(h) });
  if (error) { console.error(error); errToast('No se pudo cargar el ranking'); return; }
  const rows = (data || []).slice().sort((a, b) => (b[rankSort] || 0) - (a[rankSort] || 0));
  const medal = ['🥇', '🥈', '🥉'];
  document.getElementById('rank-body').innerHTML = rows.map((r, i) => `
    <tr>
      <td class="td-name"><div class="lead-name"><div class="ln-ava" style="background:${ADV_COLORS[i % ADV_COLORS.length]};color:#0a0a0a">${initials(r.asesor)}</div>${i < 3 ? medal[i] + ' ' : ''}${esc(r.asesor)}</div></td>
      <td data-label="Nuevos" class="muted">${fmt(r.nuevos)}</td>
      <td data-label="Atendidos">${fmt(r.atendidos)}</td>
      <td data-label="Ventas"><b style="color:var(--green)">${fmt(r.ventas)}</b></td>
      <td data-label="Ingresos"><b>${money(r.monto)}</b></td>
      <td data-label="Resp. prom." class="muted">${r.horas_respuesta != null ? r.horas_respuesta + 'h' : '—'}</td>
    </tr>`).join('');
  const tot = rows.reduce((a, r) => ({ ventas: a.ventas + (+r.ventas || 0), monto: a.monto + (+r.monto || 0), atendidos: a.atendidos + (+r.atendidos || 0) }), { ventas: 0, monto: 0, atendidos: 0 });
  document.getElementById('rank-tot').innerHTML = `<span>${fmt(tot.atendidos)} atendidos</span><span>${fmt(tot.ventas)} ventas</span><span>${money(tot.monto)} en ingresos</span>`;
}

async function loadLeadsColaboraciones() {
  const { data, error } = await sb.from('leads_colaboraciones').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); errToast('No se pudo cargar Leads Colaboraciones'); return; }
  document.getElementById('leads-colab-body').innerHTML = (data || []).map((r) => `
    <tr>
      <td data-label="Nombre">${esc(r.nombre)}</td>
      <td data-label="Teléfono" class="muted">${r.telefono ? esc(r.telefono) : '—'}</td>
      <td data-label="Campaña">${esc(r.campania)}</td>
      <td data-label="Destino" class="muted">${r.destino ? esc(r.destino) : '—'}</td>
      <td data-label="Canal" class="muted">${r.canal ? esc(r.canal) : '—'}</td>
      <td data-label="Contacto directo">${r.contacto_directo ? `<a href="${esc(r.contacto_directo)}" target="_blank" rel="noopener">${esc(r.contacto_directo)}</a>` : '—'}</td>
      <td data-label="Fecha" class="muted">${r.created_at ? new Date(r.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
    </tr>`).join('') || `<tr><td colspan="7" class="muted">Sin leads de colaboraciones todavía.</td></tr>`;
}

/* ---------- Postulaciones (candidatos de "Trabaja con nosotros", solo admin) ---------- */
// Cuatro niveles, de mayor a menor. El orden de las claves es el que usan el
// dropdown de la ficha y el orden de la tabla, así que no reordenar sin querer.
const CALIDAD_PROSPECTO_LABEL = { excelente: 'Excelente', bueno: 'Bueno', debil: 'Débil', descartado: 'Descartado' };
const CALIDAD_PROSPECTO_COLOR = { excelente: '#a855f7', bueno: '#22c55e', debil: '#f59e0b', descartado: '#ef4444' };
let postCache = [], postDrawerActual = null, postSearchDeb, postView = 'lista';
const SELECTED_POST = new Set();
// Las fotos viven en un bucket privado (son dato personal), así que hay que
// firmar cada URL. Se firman TODAS de una en vez de una por tarjeta, y se
// cachean: 30 tarjetas serían 30 round-trips.
const postFotoUrls = new Map();
async function firmarFotosPostulaciones(filas) {
  const faltan = [...new Set(filas.map(p => p.foto_storage_path).filter(x => x && !postFotoUrls.has(x)))];
  if (!faltan.length) return;
  const { data } = await sb.storage.from('postulaciones-cv').createSignedUrls(faltan, 3600);
  (data || []).forEach(d => { if (d.signedUrl) postFotoUrls.set(d.path, d.signedUrl); });
}
const postFotoHtml = (p, clase) => {
  const url = p.foto_storage_path && postFotoUrls.get(p.foto_storage_path);
  return url
    ? `<img class="${clase}" src="${esc(url)}" alt="">`
    : `<div class="${clase} post-foto-vacia"><i class="fas fa-user"></i></div>`;
};
const GENERO_LABEL = { femenino: 'Femenino', masculino: 'Masculino', otro: 'Otro' };
async function loadPostulaciones() {
  document.getElementById('post-loading')?.classList.add('show');
  const { data, error } = await sb.from('postulaciones_empleo').select('*').order('created_at', { ascending: false });
  if (error) { document.getElementById('post-loading')?.classList.remove('show'); console.error(error); errToast('No se pudo cargar Postulaciones'); return; }
  postCache = data || [];
  postMostrar = TECHO_LISTA;
  await firmarFotosPostulaciones(postCache);
  document.getElementById('post-loading')?.classList.remove('show');
  renderPostulaciones();
}
function postCardHtml(p) {
  const datos = [
    p.edad ? `${p.edad} años` : null,
    p.genero ? GENERO_LABEL[p.genero] : null,
    p.anios_experiencia != null ? `${p.anios_experiencia} años de exp.` : null,
  ].filter(Boolean);
  return `<div class="post-card" data-id="${p.id}">
    <div class="post-card-top">
      ${postFotoHtml(p, 'post-foto')}
      <div style="min-width:0;flex:1">
        <div style="font-weight:600;font-size:14.5px;overflow:hidden;text-overflow:ellipsis">${esc(p.nombre)}</div>
        <div class="muted" style="font-size:12.5px">${esc(p.rol_interes || (p.modalidad === 'presencial' ? 'Presencial' : 'Freelance'))}</div>
        <div class="muted" style="font-size:12px;margin-top:2px">${esc(p.telefono)}</div>
      </div>
      ${p.revisado ? '<i class="fas fa-circle-check" style="color:#22c55e" title="Revisado"></i>' : ''}
    </div>
    ${datos.length ? `<div class="post-card-datos">${datos.map(d => `<span class="post-dato">${esc(d)}</span>`).join('')}</div>` : ''}
    ${p.estudios ? `<div class="muted" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><i class="fas fa-graduation-cap"></i> ${esc(p.estudios)}</div>` : ''}
    <div style="display:flex;gap:6px;align-items:center;margin-top:auto;flex-wrap:wrap">
      ${p.calidad_prospecto ? `<span class="badge-st" style="color:${CALIDAD_PROSPECTO_COLOR[p.calidad_prospecto]};background:${CALIDAD_PROSPECTO_COLOR[p.calidad_prospecto]}2e">${CALIDAD_PROSPECTO_LABEL[p.calidad_prospecto]}</span>` : '<span class="muted" style="font-size:12px">Sin calificar</span>'}
      <span class="badge-st" style="color:${p.estado_llamada === 'llamado' ? '#22c55e' : '#e0a030'};background:${p.estado_llamada === 'llamado' ? '#22c55e2e' : '#e0a0302e'}">${p.estado_llamada === 'llamado' ? 'Llamado' : 'Pendiente'}</span>
      ${p.cv_storage_path ? '<span class="post-dato"><i class="fas fa-file-pdf"></i> CV</span>' : ''}
    </div>
  </div>`;
}
// Techo de filas visibles en el render (Fase 4 -- "100 facturas ≈ 1.000
// filas visuales en móvil"). El FETCH sigue trayendo todo (postCache
// completo) porque el filtro/búsqueda de arriba es 100% cliente -- pedirle
// al backend solo una página rompería la búsqueda para cualquier registro
// fuera de esa página, sin avisar. Solo se recorta lo que se pinta.
const TECHO_LISTA = 50;
let postMostrar = TECHO_LISTA;
function cargarMasPostulaciones() { postMostrar += TECHO_LISTA; renderPostulaciones(); }
window.cargarMasPostulaciones = cargarMasPostulaciones;
function renderPostulaciones() {
  const q = val('post-search').trim().toLowerCase();
  const fModalidad = val('post-f-modalidad'), fLlamada = val('post-f-llamada'), fCalidad = val('post-f-calidad');
  const soloSinRevisar = document.getElementById('post-f-sin-revisar').checked;
  const filtered = postCache.filter(p => {
    if (q && !(p.nombre || '').toLowerCase().includes(q) && !(p.telefono || '').toLowerCase().includes(q)) return false;
    if (fModalidad && p.modalidad !== fModalidad) return false;
    if (fLlamada && p.estado_llamada !== fLlamada) return false;
    if (fCalidad === 'sin_calificar' && p.calidad_prospecto) return false;
    if (fCalidad && fCalidad !== 'sin_calificar' && p.calidad_prospecto !== fCalidad) return false;
    if (soloSinRevisar && p.revisado) return false;
    return true;
  });
  document.getElementById('post-empty').classList.toggle('show', filtered.length === 0);
  const visibles = filtered.slice(0, postMostrar);
  const pager = document.getElementById('post-pager');
  if (pager) pager.style.display = filtered.length > postMostrar ? '' : 'none';
  document.getElementById('post-tbody').innerHTML = visibles.map(p => `<tr data-id="${p.id}">
    <td><input type="checkbox" class="post-check" data-id="${p.id}" ${SELECTED_POST.has(p.id) ? 'checked' : ''}></td>
    <td>${p.revisado ? '<i class="fas fa-circle-check" style="color:#22c55e" title="Revisado"></i>' : '<i class="fas fa-circle" style="color:#5f677f" title="Sin revisar"></i>'}</td>
    <td data-label="Nombre">${esc(p.nombre)}</td>
    <td data-label="Modalidad"><span class="chip">${p.modalidad === 'presencial' ? 'Presencial' : 'Freelance'}</span></td>
    <td data-label="Rol" class="muted">${esc(p.rol_interes || '—')}</td>
    <td data-label="Teléfono" class="muted">${esc(p.telefono)}</td>
    <td data-label="Llamada"><span class="badge-st" style="color:${p.estado_llamada === 'llamado' ? '#22c55e' : '#e0a030'};background:${p.estado_llamada === 'llamado' ? '#22c55e2e' : '#e0a0302e'}">${p.estado_llamada === 'llamado' ? 'Llamado' : 'Pendiente'}</span></td>
    <td data-label="Prospecto">${p.calidad_prospecto ? `<span class="badge-st" style="color:${CALIDAD_PROSPECTO_COLOR[p.calidad_prospecto]};background:${CALIDAD_PROSPECTO_COLOR[p.calidad_prospecto]}2e">${CALIDAD_PROSPECTO_LABEL[p.calidad_prospecto]}</span>` : '<span class="muted">Sin calificar</span>'}</td>
    <td data-label="Fecha" class="muted">${esc(fmtFechaHoraCaracas(p.created_at))}</td>
  </tr>`).join('');
  const grid = document.getElementById('post-vista-tarjetas');
  grid.innerHTML = postView === 'tarjetas' ? visibles.map(postCardHtml).join('') : '';
  grid.style.display = postView === 'tarjetas' ? '' : 'none';
  document.getElementById('post-vista-lista').style.display = postView === 'tarjetas' ? 'none' : '';

  document.querySelectorAll('#post-tbody tr, #post-vista-tarjetas .post-card').forEach(el => el.onclick = () => {
    const p = postCache.find(x => String(x.id) === el.dataset.id);
    if (p) abrirPostulacionDrawer(p);
  });
  wirePostChecks();
  const pendientes = postCache.filter(p => !p.revisado).length;
  const badge = document.getElementById('gp-postulaciones-count');
  if (badge) { badge.textContent = pendientes; badge.style.display = pendientes ? '' : 'none'; }
}
function wirePostChecks() {
  document.querySelectorAll('.post-check').forEach(cb => {
    cb.addEventListener('click', e => e.stopPropagation());
    cb.addEventListener('change', () => {
      const id = +cb.dataset.id;
      if (cb.checked) SELECTED_POST.add(id); else SELECTED_POST.delete(id);
      updatePostBulkBar();
    });
  });
  updatePostBulkBar();
}
function updatePostBulkBar() {
  const bar = document.getElementById('post-bulk-bar'), count = document.getElementById('post-bulk-count');
  const n = SELECTED_POST.size;
  if (bar) bar.style.display = n > 0 ? 'flex' : 'none';
  if (count) count.textContent = `${n} seleccionado${n === 1 ? '' : 's'}`;
  const ids = [...document.querySelectorAll('.post-check')].map(cb => +cb.dataset.id);
  const selectAll = document.getElementById('post-th-select-all');
  if (selectAll) selectAll.checked = ids.length > 0 && ids.every(id => SELECTED_POST.has(id));
}
function clearPostSelection() { SELECTED_POST.clear(); updatePostBulkBar(); document.querySelectorAll('.post-check').forEach(cb => cb.checked = false); }
document.getElementById('post-th-select-all')?.addEventListener('change', e => {
  document.querySelectorAll('.post-check').forEach(cb => {
    cb.checked = e.target.checked;
    const id = +cb.dataset.id;
    if (e.target.checked) SELECTED_POST.add(id); else SELECTED_POST.delete(id);
  });
  updatePostBulkBar();
});
document.getElementById('post-bulk-clear')?.addEventListener('click', clearPostSelection);
document.getElementById('post-bulk-eliminar')?.addEventListener('click', () => {
  if (!SELECTED_POST.size) return;
  const desc = document.getElementById('confirm-delete-post-desc');
  const input = document.getElementById('confirm-delete-post-input');
  const ok = document.getElementById('confirm-delete-post-ok');
  desc.textContent = `Vas a eliminar ${SELECTED_POST.size} postulación(es) seleccionadas. Van a desaparecer de la lista. La acción es recuperable solo desde la base de datos -- no desde el CRM.`;
  input.value = ''; ok.disabled = true; ok.style.opacity = '.5';
  openSheet('confirm-delete-post-sheet');
  setTimeout(() => input.focus(), 50);
});
document.getElementById('confirm-delete-post-input')?.addEventListener('input', e => {
  const ok = document.getElementById('confirm-delete-post-ok');
  const listo = e.target.value.trim().toLowerCase() === 'eliminar';
  ok.disabled = !listo; ok.style.opacity = listo ? '1' : '.5';
});
document.getElementById('confirm-delete-post-cancel')?.addEventListener('click', () => closeSheet('confirm-delete-post-sheet'));
document.getElementById('confirm-delete-post-ok')?.addEventListener('click', async () => {
  if (!SELECTED_POST.size) return;
  const btn = document.getElementById('confirm-delete-post-ok');
  btn.disabled = true; btn.innerHTML = 'Eliminando... <i class="fas fa-spinner fa-spin"></i>';
  const ids = [...SELECTED_POST];
  const { error } = await sb.from('postulaciones_empleo').delete().in('id', ids);
  btn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
  if (error) errToast('No se pudieron eliminar: ' + error.message);
  closeSheet('confirm-delete-post-sheet', true);
  clearPostSelection();
  if (!error) okToast(`${ids.length} postulación(es) eliminada(s)`);
  loadPostulaciones();
});
// Se muestra plegado: cuando el análisis ya se leyó una vez, lo que interesa
// del drawer es llamar y calificar, no volver a leer el informe entero.
// Estado vacío explícito: una pestaña en blanco no dice si el candidato no
// tiene análisis o si algo se rompió.
function analisisPanelHtml(a) {
  if (!a) {
    return `<div class="muted" style="text-align:center;padding:26px 10px;font-size:13px">
      <i class="fas fa-wand-magic-sparkles" style="font-size:22px;display:block;margin-bottom:8px;color:var(--muted2)"></i>
      Este candidato no tiene análisis de IA.<br>Se genera al cargar su CV desde el botón "Cargar CV".
    </div>`;
  }
  return `
    ${a.resumen ? `<div class="dfv" style="margin-bottom:14px;white-space:pre-wrap">${esc(a.resumen)}</div>` : ''}
    ${a.fortalezas?.length ? `<div class="pf-bloque"><label class="fl">Dónde destaca</label>${listaHtml(a.fortalezas, '#22c55e')}</div>` : ''}
    ${a.debilidades?.length ? `<div class="pf-bloque"><label class="fl">Dónde flojea o falta preguntar</label>${listaHtml(a.debilidades, '#e0a030')}</div>` : ''}
    ${a.banderas?.length ? `<div class="pf-bloque"><label class="fl">Para mirar con lupa</label>${listaHtml(a.banderas, '#ef4444')}</div>` : ''}
    <div class="muted" style="font-size:11.5px;margin-top:6px">Generado por IA a partir del CV. Revisá antes de decidir.</div>`;
}
function abrirPostulacionDrawer(p, tab) {
  postDrawerActual = p;
  const pestana = tab || 'perfil';
  const cal = p.calidad_prospecto;
  // Los datos vacíos se muestran igual, con un guion: esconderlos hacía que
  // pareciera que el sistema no los había leído, cuando en realidad el CV no
  // los traía.
  const dato = (lbl, valor, ancho) =>
    `<div class="pf-dato${ancho ? ' pf-ancho' : ''}">
      <div class="pf-dato-lbl">${lbl}</div>
      <div class="pf-dato-val${valor ? '' : ' vacio'}">${valor ? esc(String(valor)) : '—'}</div>
    </div>`;

  document.getElementById('post-d-body').innerHTML = `
    <div class="pf-head">
      ${postFotoHtml(p, 'post-foto-ficha')}
      <div class="pf-head-txt">
        <div class="pf-nombre">${esc(p.nombre)}</div>
        <div class="pf-rol">${p.modalidad === 'presencial' ? 'Presencial' : 'Freelance'}${p.rol_interes ? ' · ' + esc(p.rol_interes) : ''}</div>
        <div style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap">
          ${cal ? `<span class="badge-st" style="color:${CALIDAD_PROSPECTO_COLOR[cal]};background:${CALIDAD_PROSPECTO_COLOR[cal]}2e">${CALIDAD_PROSPECTO_LABEL[cal]}</span>` : ''}
          <span class="badge-st" style="color:${p.estado_llamada === 'llamado' ? '#22c55e' : '#e0a030'};background:${p.estado_llamada === 'llamado' ? '#22c55e2e' : '#e0a0302e'}">${p.estado_llamada === 'llamado' ? 'Llamado' : 'Pendiente'}</span>
          ${p.revisado ? '<span class="badge-st" style="color:#22c55e;background:#22c55e2e">Revisado</span>' : ''}
        </div>
      </div>
      <button class="pf-cerrar" type="button" id="pf-cerrar" title="Cerrar"><i class="fas fa-xmark"></i></button>
    </div>

    <div class="pf-tabs">
      <button class="pf-tab${pestana === 'perfil' ? ' on' : ''}" data-tab="perfil" type="button">Perfil</button>
      <button class="pf-tab${pestana === 'analisis' ? ' on' : ''}" data-tab="analisis" type="button">Análisis IA</button>
      <button class="pf-tab${pestana === 'gestion' ? ' on' : ''}" data-tab="gestion" type="button">Gestión</button>
    </div>

    <div class="pf-cuerpo">
      <div class="pf-panel" data-panel="perfil" style="display:${pestana === 'perfil' ? '' : 'none'}">
        <div class="pf-datos">
          ${dato('Edad', p.edad ? p.edad + ' años' : null)}
          ${dato('Género', p.genero ? GENERO_LABEL[p.genero] : null)}
          ${dato('Experiencia', p.anios_experiencia != null ? p.anios_experiencia + ' años' : null)}
          ${dato('Teléfono', p.telefono)}
          ${dato('Email', p.email, true)}
          ${dato('Estudios', p.estudios, true)}
        </div>
        <div class="pf-acciones">
          ${p.cv_storage_path ? '<button class="btn-sm" type="button" id="post-d-ver-cv"><i class="fas fa-file-pdf"></i> Ver CV</button>' : ''}
          ${p.cv_storage_path
            ? '<button class="btn-sm" type="button" id="post-d-reanalizar" title="Vuelve a evaluar el CV con el criterio actual. No toca el nombre, teléfono ni email."><i class="fas fa-wand-magic-sparkles"></i> Re-analizar CV</button>'
            : '<button class="btn-sm" type="button" disabled title="Hace falta un CV adjunto para poder re-analizar"><i class="fas fa-wand-magic-sparkles"></i> Re-analizar CV</button>'}
          <button class="btn-sm" type="button" id="post-d-adjuntar-cv"><i class="fas fa-paperclip"></i> ${p.cv_storage_path ? 'Reemplazar CV' : 'Adjuntar CV'}</button>
          <button class="btn-sm" type="button" id="post-d-adjuntar-foto"><i class="fas fa-camera"></i> ${p.foto_storage_path ? 'Cambiar foto' : 'Adjuntar foto'}</button>
          <input type="file" id="post-d-cv-input" accept="application/pdf" style="display:none">
          <input type="file" id="post-d-foto-input" accept="image/jpeg,image/png" style="display:none">
        </div>
        ${p.mensaje ? `<div class="pf-bloque"><label class="fl">Mensaje del candidato</label><div class="dfv" style="white-space:pre-wrap">${esc(p.mensaje)}</div></div>` : ''}
        <details style="border:1px solid var(--line2);border-radius:12px;padding:9px 11px">
          <summary style="cursor:pointer;font-size:13px;font-weight:600">Corregir datos</summary>
          <div style="margin-top:10px">
            <div style="display:flex;gap:8px">
              <div style="flex:1"><label class="fl">Edad</label><input class="ei" id="post-d-edad" type="number" min="14" max="99" value="${p.edad ?? ''}" placeholder="—"></div>
              <div style="flex:1"><label class="fl">Años exp.</label><input class="ei" id="post-d-anios" type="number" min="0" max="60" step="0.5" value="${p.anios_experiencia ?? ''}" placeholder="—"></div>
            </div>
            <label class="fl" style="margin-top:8px">Género</label>
            <select class="ei" id="post-d-genero">
              <option value=""${!p.genero ? ' selected' : ''}>Sin especificar</option>
              <option value="femenino"${p.genero === 'femenino' ? ' selected' : ''}>Femenino</option>
              <option value="masculino"${p.genero === 'masculino' ? ' selected' : ''}>Masculino</option>
              <option value="otro"${p.genero === 'otro' ? ' selected' : ''}>Otro</option>
            </select>
            <label class="fl" style="margin-top:8px">Estudios</label>
            <input class="ei" id="post-d-estudios" value="${esc(p.estudios || '')}" placeholder="—">
            <div class="muted" style="font-size:11.5px;margin-top:8px">Se guardan con el botón de la pestaña Gestión.</div>
          </div>
        </details>
      </div>

      <div class="pf-panel" data-panel="analisis" style="display:${pestana === 'analisis' ? '' : 'none'}">
        ${analisisPanelHtml(p.analisis_ia)}
      </div>

      <div class="pf-panel" data-panel="gestion" style="display:${pestana === 'gestion' ? '' : 'none'}">
        <label class="fl">Estado de llamada</label>
        <select class="ei" id="post-d-llamada">
          <option value="pendiente"${p.estado_llamada === 'pendiente' ? ' selected' : ''}>Pendiente de llamar</option>
          <option value="llamado"${p.estado_llamada === 'llamado' ? ' selected' : ''}>Llamado</option>
        </select>
        <label class="fl" style="margin-top:10px">Calificación</label>
        <select class="ei" id="post-d-calidad">
          <option value=""${!p.calidad_prospecto ? ' selected' : ''}>Sin calificar</option>
          ${Object.entries(CALIDAD_PROSPECTO_LABEL).map(([v, t]) =>
            `<option value="${v}"${p.calidad_prospecto === v ? ' selected' : ''}>${t}</option>`).join('')}
        </select>
        <label class="fl" style="margin-top:10px">Notas internas</label>
        <textarea class="ei" id="post-d-notas" rows="4" placeholder="Notas propias, no visibles para el candidato...">${esc(p.notas_admin || '')}</textarea>
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13.5px;cursor:pointer">
          <input type="checkbox" id="post-d-revisado"${p.revisado ? ' checked' : ''}> Marcar perfil como revisado
        </label>
        <div class="edit-err" id="post-d-err"></div>
        <button class="dbtn save" id="post-d-save" type="button" style="margin-top:14px"><i class="fas fa-floppy-disk"></i> Guardar cambios</button>
      </div>
    </div>`;

  // Cambiar de pestaña no re-renderiza: si lo hiciera, se perderían los
  // cambios a medio escribir en los campos de las otras pestañas.
  document.querySelectorAll('#post-d-body .pf-tab').forEach(b => b.onclick = () => {
    document.querySelectorAll('#post-d-body .pf-tab').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('#post-d-body .pf-panel').forEach(pane => {
      pane.style.display = pane.dataset.panel === b.dataset.tab ? '' : 'none';
    });
  });

  document.getElementById('pf-cerrar').onclick = () => closeSheet('post-drawer-sheet');
  document.getElementById('post-d-save').onclick = guardarPostulacion;
  document.getElementById('post-d-ver-cv')?.addEventListener('click', () => verCVPostulacion(p.cv_storage_path));
  document.getElementById('post-d-reanalizar')?.addEventListener('click', () => reanalizarUnaPostulacion(p));
  document.getElementById('post-d-adjuntar-cv')?.addEventListener('click', () => document.getElementById('post-d-cv-input').click());
  document.getElementById('post-d-cv-input')?.addEventListener('change', e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) adjuntarCVaPostulacion(p, f);
  });
  document.getElementById('post-d-adjuntar-foto')?.addEventListener('click', () => document.getElementById('post-d-foto-input').click());
  document.getElementById('post-d-foto-input')?.addEventListener('change', e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) adjuntarFotoAPostulacion(p, f);
  });
  openSheet('post-drawer-sheet');
}
async function adjuntarFotoAPostulacion(p, file) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) { errToast('La foto debe ser JPG o PNG'); return; }
  if (file.size > 3 * 1024 * 1024) { errToast('La foto no puede pesar más de 3MB'); return; }
  const btn = document.getElementById('post-d-adjuntar-foto');
  btn.disabled = true; btn.innerHTML = 'Subiendo... <i class="fas fa-spinner fa-spin"></i>';

  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `fotos/${p.id}-${Date.now()}.${ext}`;
  const anterior = p.foto_storage_path;
  const { error: eUp } = await sb.storage.from('postulaciones-cv').upload(path, file, { contentType: file.type });
  if (eUp) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-camera"></i> Adjuntar foto'; errToast('No se pudo subir la foto: ' + eUp.message); return; }

  const { error: eDb } = await sb.from('postulaciones_empleo').update({ foto_storage_path: path }).eq('id', p.id);
  if (eDb) {
    await sb.storage.from('postulaciones-cv').remove([path]);
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-camera"></i> Adjuntar foto';
    errToast('No se pudo guardar la foto en la ficha: ' + eDb.message);
    return;
  }
  if (anterior && anterior !== path) {
    await sb.storage.from('postulaciones-cv').remove([anterior]);
    postFotoUrls.delete(anterior);
  }

  p.foto_storage_path = path;
  const enCache = postCache.find(x => x.id === p.id);
  if (enCache) enCache.foto_storage_path = path;
  await firmarFotosPostulaciones([p]);
  okToast('Foto adjuntada');
  abrirPostulacionDrawer(p);
  renderPostulaciones();
}

async function adjuntarCVaPostulacion(p, file) {
  if (file.type !== 'application/pdf') { errToast('El CV debe ser un PDF'); return; }
  if (file.size > 5 * 1024 * 1024) { errToast('El PDF no puede pesar más de 5MB'); return; }
  const btn = document.getElementById('post-d-adjuntar-cv');
  btn.disabled = true; btn.innerHTML = 'Subiendo... <i class="fas fa-spinner fa-spin"></i>';

  const anterior = p.cv_storage_path;
  const { path, error } = await subirCVPostulacion(file);
  if (error) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paperclip"></i> Adjuntar CV'; errToast('No se pudo subir el CV: ' + error); return; }

  const { error: eDb } = await sb.from('postulaciones_empleo').update({ cv_storage_path: path }).eq('id', p.id);
  if (eDb) {
    // La fila no quedó apuntando al archivo nuevo, así que ese archivo no le
    // sirve a nadie: se borra para no dejar basura en el bucket.
    await sb.storage.from('postulaciones-cv').remove([path]);
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-paperclip"></i> Adjuntar CV';
    errToast('No se pudo guardar el CV en la ficha: ' + eDb.message);
    return;
  }

  // Recién ahora se borra el anterior: si se borrara antes y fallara algo,
  // el candidato quedaría sin ningún CV.
  if (anterior && anterior !== path) await sb.storage.from('postulaciones-cv').remove([anterior]);

  p.cv_storage_path = path;
  const enCache = postCache.find(x => x.id === p.id);
  if (enCache) enCache.cv_storage_path = path;
  okToast('CV adjuntado');
  abrirPostulacionDrawer(p);
}

async function guardarPostulacion() {
  if (!postDrawerActual) return;
  const btn = document.getElementById('post-d-save'), err = document.getElementById('post-d-err');
  btn.disabled = true; btn.innerHTML = 'Guardando... <i class="fas fa-spinner fa-spin"></i>'; err.textContent = '';
  const numeroONull = id => { const v = val(id).trim(); return v === '' ? null : Number(v); };
  const cambios = {
    estado_llamada: val('post-d-llamada'),
    calidad_prospecto: val('post-d-calidad') || null,
    notas_admin: val('post-d-notas').trim() || null,
    revisado: document.getElementById('post-d-revisado').checked,
    edad: numeroONull('post-d-edad'),
    genero: val('post-d-genero') || null,
    anios_experiencia: numeroONull('post-d-anios'),
    estudios: val('post-d-estudios').trim() || null,
  };
  const { error } = await sb.from('postulaciones_empleo').update(cambios).eq('id', postDrawerActual.id);
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar cambios';
  if (error) { err.textContent = 'No se pudo guardar: ' + error.message; return; }
  Object.assign(postDrawerActual, cambios);
  okToast('Postulación actualizada');
  renderPostulaciones();
  closeSheet('post-drawer-sheet');
}
async function verCVPostulacion(path) {
  const { data, error } = await sb.storage.from('postulaciones-cv').createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) { errToast('No se pudo generar el link del CV'); return; }
  window.open(data.signedUrl, '_blank');
}
document.getElementById('post-reanalizar-todas')?.addEventListener('click', reanalizarTodasLasPostulaciones);
postView = initViewSwitcher('post-view-switch', 'postulaciones', 'lista', v => { postView = v; renderPostulaciones(); }, ['tarjetas', 'lista']);
document.getElementById('post-search')?.addEventListener('input', () => { clearTimeout(postSearchDeb); postSearchDeb = setTimeout(() => { postMostrar = TECHO_LISTA; renderPostulaciones(); }, 200); });
document.querySelectorAll('#post-f-modalidad,#post-f-llamada,#post-f-calidad,#post-f-sin-revisar').forEach(el => el.addEventListener('change', () => { postMostrar = TECHO_LISTA; renderPostulaciones(); }));

/* ---------- Cargar un CV y analizarlo con IA ----------
   Para los CVs que llegan por correo (corporativo.lotus360@gmail.com está
   publicado en la web): en vez de leer el PDF y tipear los datos a mano, la IA
   los saca y evalúa el perfil con la misma vara que la entrevista de la web.
   El resultado SIEMPRE pasa por una pantalla de revisión antes de guardarse --
   la IA puede leer mal un teléfono y nadie lo verifica antes de llamar. */
const PDFJS_VER = '4.7.76';
const CV_ANALISIS_FN = 'https://begbjhrdbsqftbbleecb.functions.supabase.co/analizar-cv-postulacion';
let cvAnalizado = null;

// pdf.js se carga a demanda, no en el arranque del CRM: son ~350KB que solo
// hacen falta cuando alguien va a cargar un CV.
let pdfjsLib = null;
async function cargarPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import(`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}/build/pdf.min.mjs`);
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}/build/pdf.worker.min.mjs`;
  return pdfjsLib;
}

async function textoDelPdf(file) {
  const lib = await cargarPdfjs();
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const partes = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const contenido = await (await doc.getPage(i)).getTextContent();
    partes.push(contenido.items.map(it => it.str).join(' '));
  }
  return partes.join('\n').replace(/\s+/g, ' ').trim();
}

/** Sube un PDF al bucket de CVs. Devuelve {path} o {error} con el motivo --
 *  nunca falla en silencio, un CV que no se guardó tiene que ser visible. */
async function subirCVPostulacion(file) {
  const nombreLimpio = slugArchivo(file.name.replace(/\.[^.]+$/, ''));
  const path = `crm-manual/${Date.now()}-${nombreLimpio}.pdf`;
  const { error } = await sb.storage.from('postulaciones-cv').upload(path, file, { contentType: 'application/pdf' });
  return error ? { path: null, error: error.message } : { path, error: null };
}

const archivoABase64 = file => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(file);
});

async function cargarCVPostulacion(file) {
  if (file.type !== 'application/pdf') { errToast('El CV debe ser un PDF'); return; }
  if (file.size > 5 * 1024 * 1024) { errToast('El PDF no puede pesar más de 5MB'); return; }

  cvAnalizado = null;
  document.getElementById('post-cv-title').textContent = 'Analizando CV...';
  document.getElementById('post-cv-body').innerHTML = '<div class="muted" style="padding:18px 2px"><i class="fas fa-spinner fa-spin"></i> Leyendo el PDF y evaluando el perfil. Puede tardar unos segundos.</div>';
  openSheet('post-cv-sheet');

  try {
    const texto = await textoDelPdf(file).catch(() => '');
    // Poco texto = PDF escaneado (una foto del CV). Ese caso lo resuelve el
    // backend con un modelo que lee PDF nativo, así que se manda el archivo.
    const cuerpo = texto.length >= 250 ? { texto_cv: texto } : { pdf_base64: await archivoABase64(file) };

    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(CV_ANALISIS_FN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`,
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify(cuerpo),
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.ok) {
      const msg = out?.error === 'cv_sin_texto' ? 'No se pudo leer ese PDF. Probá con otro archivo.'
        : out?.error === 'no_autorizado' ? 'Solo un administrador puede analizar CVs.'
        : 'No se pudo analizar el CV. Intentá de nuevo en un momento.';
      document.getElementById('post-cv-body').innerHTML = `<div class="edit-err" style="display:block">${esc(msg)}</div>`;
      document.getElementById('post-cv-title').textContent = 'No se pudo analizar';
      return;
    }

    const { path: storagePath, error: eUp } = await subirCVPostulacion(file);
    // Si el archivo no se pudo guardar hay que decirlo: antes esto era
    // silencioso y la postulación quedaba sin CV sin que nadie se enterara.
    if (eUp) errToast('El análisis salió bien, pero el PDF no se pudo guardar: ' + eUp);
    cvAnalizado = { analisis: out.analisis, motor: out.motor, cvPath: storagePath };
    await revisarCVAnalizado();
  } catch (e) {
    console.error('analisis de CV', e);
    document.getElementById('post-cv-title').textContent = 'No se pudo analizar';
    document.getElementById('post-cv-body').innerHTML = '<div class="edit-err" style="display:block">Falló la lectura del PDF. Probá con otro archivo.</div>';
  }
}

/* ---------- Re-análisis con el criterio vigente ----------
   Existe porque el criterio de evaluación cambió (2026-07-30: de 2 niveles a 4,
   y más exigente), así que los análisis viejos quedaron calificados con otra
   vara y no se pueden comparar con los nuevos.

   REGLA CLAVE: el re-análisis pisa SOLO el juicio -- calificación, resumen,
   fortalezas, debilidades, banderas. NUNCA el nombre, teléfono, email, edad,
   género ni estudios. Esos datos ya pasaron por revisión humana (y se pueden
   haber corregido a mano desde la ficha); dejar que la IA los vuelva a leer y
   los sobrescriba significaría perder la corrección y llamar a un número mal
   transcrito. */

/** Baja el PDF del bucket, lo manda a analizar y devuelve {analisis} o {error}.
 *  No escribe nada: el que llama decide qué hacer con el resultado. */
async function analizarCVGuardado(p) {
  if (!p.cv_storage_path) return { error: 'sin CV adjunto' };
  const { data: firmada, error: eFirma } = await sb.storage
    .from('postulaciones-cv').createSignedUrl(p.cv_storage_path, 300);
  if (eFirma || !firmada?.signedUrl) return { error: 'no se pudo abrir el CV guardado' };

  const resp = await fetch(firmada.signedUrl);
  if (!resp.ok) return { error: `no se pudo bajar el CV (HTTP ${resp.status})` };
  const blob = await resp.blob();
  const file = new File([blob], 'cv.pdf', { type: 'application/pdf' });

  const texto = await textoDelPdf(file).catch(() => '');
  const cuerpo = texto.length >= 250 ? { texto_cv: texto } : { pdf_base64: await archivoABase64(file) };

  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(CV_ANALISIS_FN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify(cuerpo),
  });
  const out = await res.json().catch(() => null);
  if (!res.ok || !out?.ok) {
    return { error: out?.error === 'no_autorizado' ? 'solo un administrador puede analizar CVs'
      : out?.error === 'cv_sin_texto' ? 'el PDF guardado no se pudo leer'
      : `falló el análisis${out?.error ? ' (' + out.error + ')' : ''}` };
  }
  return { analisis: out.analisis, motor: out.motor };
}

/** Guarda solo los campos de juicio. Devuelve {error} si la escritura falla.
 *  `mensaje` queda intacto a propósito: la ficha lo muestra como "Mensaje del
 *  candidato" y en las postulaciones del formulario web guarda lo que escribió
 *  la persona (ver postular-empleo). El resumen nuevo de la IA ya viaja dentro
 *  de analisis_ia, que es de donde lo lee la ficha. */
async function guardarReanalisis(p, analisis) {
  // Lista blanca contra CALIDAD_PROSPECTO_LABEL: un nivel que no exista entra
  // como null ("Sin calificar") en vez de reventar el CHECK de la tabla.
  const nivel = CALIDAD_PROSPECTO_LABEL[analisis.calidad_prospecto] ? analisis.calidad_prospecto : null;
  const { error } = await sb.from('postulaciones_empleo').update({
    calidad_prospecto: nivel,
    analisis_ia: analisis,
    analisis_ia_at: new Date().toISOString(),
  }).eq('id', p.id);
  return { error: error?.message || null, nivel };
}

async function reanalizarUnaPostulacion(p) {
  const btn = document.getElementById('post-d-reanalizar');
  const previo = p.calidad_prospecto;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...'; }
  try {
    const { analisis, error } = await analizarCVGuardado(p);
    if (error) { errToast('No se pudo re-analizar: ' + error); return; }
    const { error: eDb, nivel } = await guardarReanalisis(p, analisis);
    if (eDb) { errToast('Se analizó, pero no se pudo guardar: ' + eDb); return; }
    const antes = CALIDAD_PROSPECTO_LABEL[previo] || 'Sin calificar';
    const ahora = CALIDAD_PROSPECTO_LABEL[nivel] || 'Sin calificar';
    okToast(antes === ahora ? `Re-analizado: sigue en ${ahora}` : `Re-analizado: ${antes} → ${ahora}`);
    await loadPostulaciones();
    const fresco = postCache.find(x => x.id === p.id);
    if (fresco) abrirPostulacionDrawer(fresco, 'perfil');
  } catch (e) {
    console.error('re-analisis de CV', e);
    errToast('Falló el re-análisis. Revisá la consola.');
  } finally {
    if (btn && document.body.contains(btn)) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Re-analizar CV';
    }
  }
}

/** Re-analiza en lote. Secuencial a propósito: son llamadas a un modelo que se
 *  pagan por uso, y en serie se puede cortar a mitad sin haber disparado 16
 *  pedidos en paralelo que igual se cobran. */
async function reanalizarTodasLasPostulaciones() {
  const conCV = postCache.filter(p => p.cv_storage_path);
  const sinCV = postCache.length - conCV.length;
  if (!conCV.length) { errToast('Ninguna postulación tiene CV adjunto para re-analizar'); return; }
  const detalleReanalisis = `${sinCV ? `${sinCV} se saltan por no tener CV adjunto.\n\n` : ''}Esto gasta créditos de IA (una llamada por CV) y sobrescribe la calificación anterior.\nLos datos de contacto no se tocan.`;
  if (!(await confirmarSheet({ titulo: `Se van a re-analizar ${conCV.length} postulacion(es) con el criterio actual`, detalle: detalleReanalisis, textoOk: 'Re-analizar' }))) return;

  const btn = document.getElementById('post-reanalizar-todas');
  const original = btn?.innerHTML;
  let ok = 0, fallos = [], cambios = 0;
  for (let i = 0; i < conCV.length; i++) {
    const p = conCV[i];
    if (btn) btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${i + 1} de ${conCV.length}...`;
    const { analisis, error } = await analizarCVGuardado(p);
    if (error) { fallos.push(`${p.nombre}: ${error}`); continue; }
    const { error: eDb, nivel } = await guardarReanalisis(p, analisis);
    if (eDb) { fallos.push(`${p.nombre}: ${eDb}`); continue; }
    ok++;
    if (nivel !== p.calidad_prospecto) cambios++;
  }
  if (btn) { btn.disabled = false; btn.innerHTML = original; }
  await loadPostulaciones();
  if (fallos.length) {
    console.warn('re-analisis masivo, fallos:', fallos);
    errToast(`${ok} re-analizadas (${cambios} cambiaron de nivel). ${fallos.length} fallaron -- detalle en la consola.`);
  } else {
    okToast(`${ok} re-analizadas, ${cambios} cambiaron de nivel.`);
  }
}

/** Busca si el candidato ya está en postulaciones antes de crear otra fila.
 *  El teléfono es el identificador real acá; el email es secundario porque
 *  muchos CVs no lo traen. */
async function buscarPostulacionExistente(analisis) {
  const filtros = [];
  const tel = (analisis.telefono || '').replace(/\D/g, '');
  if (tel.length >= 7) filtros.push(`telefono.ilike.%${tel.slice(-7)}%`);
  if (analisis.email) filtros.push(`email.ilike.${analisis.email.trim()}`);
  if (!filtros.length) return null;
  const { data } = await sb.from('postulaciones_empleo').select('*').or(filtros.join(',')).limit(1);
  return data?.[0] || null;
}

function listaHtml(items, color) {
  if (!items?.length) return '<div class="muted" style="margin-bottom:10px">—</div>';
  return `<ul style="margin:0 0 10px;padding-left:18px">${items.map(x => `<li style="margin-bottom:4px;color:${color}">${esc(x)}</li>`).join('')}</ul>`;
}

async function revisarCVAnalizado() {
  const a = cvAnalizado.analisis;
  const existente = await buscarPostulacionExistente(a);
  cvAnalizado.existente = existente;

  const cal = a.calidad_prospecto;
  document.getElementById('post-cv-title').textContent = a.nombre || 'CV analizado';
  document.getElementById('post-cv-body').innerHTML = `
    ${existente ? `<div style="padding:10px 12px;margin-bottom:12px;background:#e0a03014;border:1px solid #e0a03040;border-radius:10px;font-size:13.5px">
      <b><i class="fas fa-triangle-exclamation" style="color:#e0a030"></i> Ya existe una postulación de esta persona</b><br>
      <span class="muted">${esc(existente.nombre)} · ${esc(existente.telefono)} · ${esc(fmtFechaHoraCaracas(existente.created_at))}</span>
    </div>` : ''}

    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span class="badge-st" style="color:${CALIDAD_PROSPECTO_COLOR[cal]};background:${CALIDAD_PROSPECTO_COLOR[cal]}2e">${CALIDAD_PROSPECTO_LABEL[cal] || cal}</span>
      <span class="muted" style="font-size:12px">Analizado con ${cvAnalizado.motor === 'claude' ? 'lectura de PDF escaneado' : 'DeepSeek'}</span>
    </div>
    <div class="dfv" style="margin-bottom:12px;white-space:pre-wrap">${esc(a.resumen || '')}</div>

    <label class="fl">Nombre</label>
    <input class="ei" id="cv-nombre" value="${esc(a.nombre || '')}" placeholder="Nombre y apellido">
    <label class="fl" style="margin-top:8px">Teléfono</label>
    <input class="ei" id="cv-telefono" value="${esc(a.telefono || '')}" placeholder="Si el CV no lo trae, completalo a mano">
    <label class="fl" style="margin-top:8px">Email</label>
    <input class="ei" id="cv-email" value="${esc(a.email || '')}" placeholder="Opcional">
    <label class="fl" style="margin-top:8px">Modalidad</label>
    <select class="ei" id="cv-modalidad">
      <option value="presencial"${a.modalidad !== 'freelance' ? ' selected' : ''}>Presencial</option>
      <option value="freelance"${a.modalidad === 'freelance' ? ' selected' : ''}>Freelance</option>
    </select>
    <label class="fl" style="margin-top:8px">Rol que mejor calza</label>
    <input class="ei" id="cv-rol" value="${esc(a.rol_interes || '')}">
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
      <div style="flex:1;min-width:90px"><label class="fl">Edad</label><input class="ei" id="cv-edad" type="number" min="14" max="99" value="${a.edad ?? ''}" placeholder="—"></div>
      <div style="flex:1;min-width:110px"><label class="fl">Años exp.</label><input class="ei" id="cv-anios" type="number" min="0" max="60" step="0.5" value="${a.anios_experiencia ?? ''}" placeholder="—"></div>
    </div>
    <label class="fl" style="margin-top:8px">Género <span class="muted" style="font-weight:400">(solo si el CV lo dice)</span></label>
    <select class="ei" id="cv-genero">
      <option value=""${!a.genero ? ' selected' : ''}>Sin especificar</option>
      <option value="femenino"${a.genero === 'femenino' ? ' selected' : ''}>Femenino</option>
      <option value="masculino"${a.genero === 'masculino' ? ' selected' : ''}>Masculino</option>
      <option value="otro"${a.genero === 'otro' ? ' selected' : ''}>Otro</option>
    </select>
    <label class="fl" style="margin-top:8px">Estudios</label>
    <input class="ei" id="cv-estudios" value="${esc(a.estudios || '')}" placeholder="—">

    <label class="fl" style="margin-top:14px">Dónde destaca</label>
    ${listaHtml(a.fortalezas, '#22c55e')}
    <label class="fl">Dónde flojea o falta preguntar</label>
    ${listaHtml(a.debilidades, '#e0a030')}
    ${a.banderas?.length ? `<label class="fl">Para mirar con lupa</label>${listaHtml(a.banderas, '#ef4444')}` : ''}
    ${a.anios_experiencia != null ? `<label class="fl">Años de experiencia relevante</label><div class="dfv" style="margin-bottom:10px">${esc(String(a.anios_experiencia))}</div>` : ''}

    <div class="edit-err" id="cv-err"></div>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      <button class="dbtn save" id="cv-guardar" type="button"><i class="fas fa-floppy-disk"></i> ${existente ? 'Crear otra postulación' : 'Guardar postulación'}</button>
      ${existente ? '<button class="dbtn" id="cv-actualizar" type="button"><i class="fas fa-rotate"></i> Actualizar la existente</button>' : ''}
    </div>`;

  document.getElementById('cv-guardar').onclick = () => guardarCVAnalizado(false);
  document.getElementById('cv-actualizar')?.addEventListener('click', () => guardarCVAnalizado(true));
}

async function guardarCVAnalizado(actualizar) {
  const err = document.getElementById('cv-err');
  const nombre = val('cv-nombre').trim(), telefono = val('cv-telefono').trim();
  if (!nombre || !telefono) { err.textContent = 'Nombre y teléfono son obligatorios — completalos si el CV no los traía.'; err.style.display = 'block'; return; }

  const a = cvAnalizado.analisis;
  const fila = {
    nombre, telefono,
    email: val('cv-email').trim() || null,
    modalidad: val('cv-modalidad'),
    rol_interes: val('cv-rol').trim() || null,
    calidad_prospecto: a.calidad_prospecto,
    edad: val('cv-edad').trim() === '' ? null : Number(val('cv-edad')),
    genero: val('cv-genero') || null,
    estudios: val('cv-estudios').trim() || null,
    anios_experiencia: val('cv-anios').trim() === '' ? null : Number(val('cv-anios')),
    analisis_ia: {
      resumen: a.resumen, fortalezas: a.fortalezas, debilidades: a.debilidades,
      banderas: a.banderas, anios_experiencia: a.anios_experiencia, motor: cvAnalizado.motor,
    },
    analisis_ia_at: new Date().toISOString(),
  };
  if (cvAnalizado.cvPath) fila.cv_storage_path = cvAnalizado.cvPath;

  const btn = document.getElementById(actualizar ? 'cv-actualizar' : 'cv-guardar');
  btn.disabled = true; btn.innerHTML = 'Guardando... <i class="fas fa-spinner fa-spin"></i>';

  const { error } = actualizar
    ? await sb.from('postulaciones_empleo').update(fila).eq('id', cvAnalizado.existente.id)
    : await sb.from('postulaciones_empleo').insert({ ...fila, origen: 'cv_crm', estado_llamada: 'pendiente', revisado: false });

  btn.disabled = false;
  if (error) { err.textContent = 'No se pudo guardar: ' + error.message; err.style.display = 'block'; return; }
  okToast(actualizar ? 'Postulación actualizada con el CV' : 'Postulación creada desde el CV');
  closeSheet('post-cv-sheet');
  cvAnalizado = null;
  loadPostulaciones();
}

document.getElementById('post-cargar-cv')?.addEventListener('click', () => document.getElementById('post-cv-input').click());
document.getElementById('post-cv-input')?.addEventListener('change', e => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (f) cargarCVPostulacion(f);
});

/* ---------- Redes (Instagram + TikTok) ---------- */
let redesPeriodo = '30d', redesRed = 'instagram', redesChatHistory = [];
function setupRedes() {
  document.querySelectorAll('#redes-red-tabs .seg').forEach(b => b.onclick = () => {
    document.querySelectorAll('#redes-red-tabs .seg').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    redesRed = b.dataset.red;
    document.getElementById('redes-ig-panel').style.display = redesRed === 'instagram' ? '' : 'none';
    document.getElementById('redes-tiktok-panel').style.display = redesRed === 'tiktok' ? '' : 'none';
    cargarRedActual();
  });
  document.querySelectorAll('#redes-periodo .seg').forEach(b => b.onclick = () => { document.querySelectorAll('#redes-periodo .seg').forEach(x => x.classList.remove('on')); b.classList.add('on'); redesPeriodo = b.dataset.p; cargarRedActual(); });
  const input = document.getElementById('redes-chat-input');
  document.getElementById('redes-chat-send').onclick = enviarChatRedes;
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarChatRedes(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  addChatBubbleRedes('bot', 'Hola, soy el analista de redes. Preguntame sobre el alcance, los posts con mejor desempeño o las historias del período seleccionado.');
}
function cargarRedActual() { redesRed === 'tiktok' ? loadRedesTikTok() : loadRedes(); }
async function loadRedes() {
  await ensureChart();
  const [d, h] = periodo(redesPeriodo);
  const { data, error } = await sb.rpc('redes_metricas_resumen', { p_desde: iso(d), p_hasta: iso(h) });
  if (error) { console.error(error); errToast('No se pudieron cargar las métricas de redes'); return; }
  const cards = [
    { t: 'Publicaciones', v: fmt(data.publicaciones), i: 'fa-images', c: 'var(--blue)' },
    { t: 'Historias', v: fmt(data.historias), i: 'fa-circle-play', c: 'var(--purple)' },
    { t: 'Alcance total', v: fmt(data.reach_total), i: 'fa-eye', c: 'var(--accent)' },
    { t: 'Interacciones', v: fmt(data.interacciones_total), i: 'fa-heart', c: '#ff5c8a' },
    { t: 'Alcance prom. historias', v: fmt(data.reach_prom_historias), i: 'fa-chart-simple', c: '#34d399' },
  ];
  pintarKPIs('redes-kpis', cards);
  const s = data.serie || [];
  mk('chSerieRedes', { type: 'line', data: { labels: s.map(x => x.dia.slice(8) + '/' + x.dia.slice(5, 7)), datasets: [{ label: 'Alcance', data: s.map(x => x.reach), borderColor: '#4a9eff', backgroundColor: 'rgba(74,158,255,.1)', fill: true, tension: .35, borderWidth: 2, pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } }, y: { grid: { color: 'rgba(255,255,255,.05)' }, beginAtZero: true } } } });
  const te = sortEntries(data.por_tipo);
  mk('chTipoRedes', { type: 'bar', data: { labels: te.map(x => x[0]), datasets: [{ data: te.map(x => x[1]), backgroundColor: '#a06bff', borderRadius: 6, barThickness: 18 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,.05)' }, beginAtZero: true }, y: { grid: { display: false } } } } });
  const top = data.top_posts || [];
  document.getElementById('redes-top-body').innerHTML = top.length ? top.map(p => `
    <tr>
      <td class="td-name">${p.permalink ? `<a href="${esc(p.permalink)}" target="_blank" rel="noopener">${esc(p.caption || p.id)}</a>` : esc(p.caption || p.id)}</td>
      <td data-label="Tipo" class="muted">${esc(p.tipo)}</td>
      <td data-label="Alcance">${fmt(p.reach)}</td>
      <td data-label="Interacciones">${fmt(p.interacciones)}</td>
    </tr>`).join('') : '<tr><td colspan="4" class="muted">Sin publicaciones en este período</td></tr>';
}
async function loadRedesTikTok() {
  await ensureChart();
  const [d, h] = periodo(redesPeriodo);
  const { data, error } = await sb.rpc('redes_tiktok_resumen', { p_desde: iso(d), p_hasta: iso(h) });
  if (error) { console.error(error); errToast('No se pudieron cargar las métricas de TikTok'); return; }
  const cards = [
    { t: 'Videos publicados', v: fmt(data.publicaciones), i: 'fa-video', c: 'var(--blue)' },
    { t: 'Vistas totales', v: fmt(data.reach_total), i: 'fa-eye', c: 'var(--accent)' },
    { t: 'Interacciones', v: fmt(data.interacciones_total), i: 'fa-heart', c: '#ff5c8a' },
  ];
  pintarKPIs('redes-tiktok-kpis', cards);
  const s = data.serie || [];
  mk('chSerieRedesTikTok', { type: 'line', data: { labels: s.map(x => x.dia.slice(8) + '/' + x.dia.slice(5, 7)), datasets: [{ label: 'Vistas', data: s.map(x => x.reach), borderColor: '#4a9eff', backgroundColor: 'rgba(74,158,255,.1)', fill: true, tension: .35, borderWidth: 2, pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } }, y: { grid: { color: 'rgba(255,255,255,.05)' }, beginAtZero: true } } } });
  const top = data.top_posts || [];
  document.getElementById('redes-tiktok-top-body').innerHTML = top.length ? top.map(p => `
    <tr>
      <td class="td-name">
        <div class="tt-row">
          <img class="tt-thumb" src="https://begbjhrdbsqftbbleecb.functions.supabase.co/redes-tiktok-cover?id=${encodeURIComponent(p.id)}" alt="" loading="lazy" onerror="this.style.display='none'">
          <div class="tt-title">${p.share_url ? `<a href="${esc(p.share_url)}" target="_blank" rel="noopener">${esc(p.titulo || p.id)}</a>` : esc(p.titulo || p.id)}</div>
        </div>
      </td>
      <td data-label="Vistas">${fmt(p.reach)}</td>
      <td data-label="Interacciones">${fmt(p.interacciones)}</td>
    </tr>`).join('') : '<tr><td colspan="3" class="muted">Sin videos en este período</td></tr>';
}
async function enviarChatRedes() {
  const input = document.getElementById('redes-chat-input'), btn = document.getElementById('redes-chat-send');
  const texto = input.value.trim();
  if (!texto || btn.disabled) return;
  addChatBubbleRedes('user', texto);
  redesChatHistory.push({ role: 'user', content: texto });
  input.value = ''; input.style.height = 'auto';
  btn.disabled = true;
  const loadingEl = addChatBubbleRedes('bot', 'Pensando...', true);
  const [d, h] = periodo(redesPeriodo);
  const { data, error } = await sb.functions.invoke('redes-analista-chat', { body: { messages: redesChatHistory, periodo: { desde: iso(d), hasta: iso(h) } } });
  loadingEl.remove();
  btn.disabled = false;
  if (error || !data?.respuesta) { addChatBubbleRedes('bot', 'No pude conectar con el analista, intenta de nuevo en un momento.'); return; }
  addChatBubbleRedes('bot', data.respuesta);
  redesChatHistory.push({ role: 'assistant', content: data.respuesta });
}
function addChatBubbleRedes(who, texto, loading) {
  const log = document.getElementById('redes-chat-log');
  const div = document.createElement('div');
  div.className = `chat-msg ${who}${loading ? ' loading' : ''}`;
  if (who === 'bot' && !loading) div.innerHTML = renderBotText(texto);
  else div.textContent = texto;
  let el = div;
  if (who === 'bot') {
    const row = document.createElement('div');
    row.className = 'chat-row';
    row.innerHTML = '<span class="chat-avatar"><i class="fa-brands fa-instagram"></i></span>';
    row.appendChild(div);
    log.appendChild(row);
    el = row;
  } else {
    log.appendChild(div);
  }
  log.scrollTop = log.scrollHeight;
  return el;
}

/* ---------- Consultor IA (2026-08-11) ----------------------------------
   Chat de solo consulta contra crm-consultor-chat: arquitectura/decisiones
   (CLAUDE.md, HANDOFFs, memoria de Claude) + estado operativo en vivo
   (leads de hoy, pendientes de timeout, última corrida de cada cron). Nunca
   edita ni ejecuta nada -- para eso está Claude Code, ver aviso en el propio
   HTML de la sección. Mismo patrón de chat que Redes (enviarChatRedes),
   reusando las mismas clases CSS (chat-wrap/chat-log/chat-inputbar). */
let consultorChatHistory = [];
function setupConsultorIA() {
  const input = document.getElementById('consultor-chat-input');
  document.getElementById('consultor-chat-send').onclick = enviarChatConsultor;
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarChatConsultor(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  if (!consultorChatHistory.length) {
    addChatBubbleConsultor('bot', 'Hola, soy el consultor técnico del proyecto. Preguntame cómo está armado algo, qué se decidió y por qué, o cómo va el CRM ahora mismo (leads de hoy, quién va atrasado).');
  }
}
async function enviarChatConsultor() {
  const input = document.getElementById('consultor-chat-input'), btn = document.getElementById('consultor-chat-send');
  const texto = input.value.trim();
  if (!texto || btn.disabled) return;
  addChatBubbleConsultor('user', texto);
  consultorChatHistory.push({ role: 'user', content: texto });
  input.value = ''; input.style.height = 'auto';
  btn.disabled = true;
  const loadingEl = addChatBubbleConsultor('bot', 'Pensando...', true);
  const { data, error } = await sb.functions.invoke('crm-consultor-chat', { body: { messages: consultorChatHistory } });
  loadingEl.remove();
  btn.disabled = false;
  if (error || !data?.respuesta) { addChatBubbleConsultor('bot', 'No pude conectar con el consultor, intenta de nuevo en un momento.'); return; }
  addChatBubbleConsultor('bot', data.respuesta);
  consultorChatHistory.push({ role: 'assistant', content: data.respuesta });
}
function addChatBubbleConsultor(who, texto, loading) {
  const log = document.getElementById('consultor-chat-log');
  const div = document.createElement('div');
  div.className = `chat-msg ${who}${loading ? ' loading' : ''}`;
  if (who === 'bot' && !loading) div.innerHTML = renderBotText(texto);
  else div.textContent = texto;
  let el = div;
  if (who === 'bot') {
    const row = document.createElement('div');
    row.className = 'chat-row';
    row.innerHTML = '<span class="chat-avatar"><i class="fas fa-user-tie"></i></span>';
    row.appendChild(div);
    log.appendChild(row);
    el = row;
  } else {
    log.appendChild(div);
  }
  log.scrollTop = log.scrollHeight;
  return el;
}

/* ---------- Voz IA (2026-08-12, ver plan "vamos-a-empezar-a-unified-kay") ---
   Panel de prueba de la voz clonada + gestión de muestras + sliders de
   prosodia (Fish Audio directo -- OpenRouter no aplica esos parámetros,
   probado en vivo). Dos modos independientes ("mensajes" / "video de
   Instagram"), elegidos con el toggle de arriba -- las dos tabs de abajo
   siempre operan sobre el modo activo. */
const VOZ_IA_REF_FN = 'https://begbjhrdbsqftbbleecb.functions.supabase.co/voz-ia-referencia';
const VI_TIPOS_OK = ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/webm'];
const VI_MAX_BYTES = 20 * 1024 * 1024;
// Pisos de calidad (2026-08-12 -- diagnóstico de la primera prueba robótica:
// era una nota de WhatsApp, 10,8s a 18 kbps, sin nada arriba de 8 kHz).
// Debajo del mínimo se bloquea, entre mínimo e ideal se deja subir con
// advertencia. El servidor repite el chequeo del mínimo con los bytes reales.
const VI_MIN_DURACION = 8, VI_MIN_BITRATE = 32;
const VI_IDEAL_DURACION = 25, VI_IDEAL_BITRATE = 64;
let viModo = 'mensajes';

function setupVozIA() {
  // El nav-item es nav-admin-only/nav-marketing-ok (index.html) -- un asesor
  // real nunca ve esta sección, pero SÍ llega a este setup (arrancar() de
  // startApp incluye setupVozIA en el bloque compartido admin/asesor, ver
  // startApp más arriba). Sin este guard, cada login de asesor disparaba
  // igual las 3 RPCs de "Voces de Redes" (viCambiarTab('redes') más abajo),
  // que rechazan con assert_rol(['admin','marketing']) -- 3 errToast rojos
  // en cada login de asesor, para una sección que ni siquiera puede abrir.
  // También hace que la vista previa de rol "asesor" (ver activarVistaPreviaRol)
  // se comporte igual que un asesor real: sin esta sección.
  if (ROL !== 'admin' && ROL !== 'marketing') return;
  document.getElementById('vi-modo')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vi-modo]');
    if (!b) return;
    viModo = b.dataset.viModo;
    document.querySelectorAll('#vi-modo .seg').forEach(x => x.classList.toggle('on', x === b));
    document.getElementById('vi-resultado').innerHTML = '';
    if (document.querySelector('#vi-tabs .seg.on')?.dataset.viTab === 'referencia') viCargarReferencia();
    else viCargarProsodia();
  });
  document.getElementById('vi-tabs')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vi-tab]');
    if (b) viCambiarTab(b.dataset.viTab);
  });
  document.getElementById('vi-generar')?.addEventListener('click', viGenerar);
  document.getElementById('vi-guardar-prosodia')?.addEventListener('click', viGuardarProsodia);
  ['temperatura', 'top_p', 'velocidad'].forEach(k => {
    document.getElementById(`vi-sl-${k}`)?.addEventListener('input', viActualizarSliderLabel);
  });
  document.getElementById('vi-ref-entrenar')?.addEventListener('click', viEntrenar);
  document.getElementById('vi-ref-subir')?.addEventListener('click', () => document.getElementById('vi-ref-file').click());
  document.getElementById('vi-ref-file')?.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) viSubirReferencia(f);
    e.target.value = '';
  });
  document.getElementById('vi-ref-lista')?.addEventListener('click', (e) => {
    const borrar = e.target.closest('[data-vi-borrar]');
    if (borrar) return viBorrarMuestra(borrar.dataset.viBorrar);
    const guardar = e.target.closest('[data-vi-guardar-trans]');
    if (guardar) return viGuardarTranscripcion(guardar.dataset.viGuardarTrans);
  });
  document.getElementById('vr-voz-nueva')?.addEventListener('click', () => vrAbrirVozNueva());
  document.getElementById('vr-voces-lista')?.addEventListener('click', (e) => {
    const editar = e.target.closest('[data-vr-editar-voz]');
    if (editar) return vrAbrirVozEditar(editar.dataset.vrEditarVoz);
    const cancelar = e.target.closest('[data-vr-cancelar-voz]');
    if (cancelar) return vrCargarVoces();
    const guardar = e.target.closest('[data-vr-guardar-voz]');
    if (guardar) return vrGuardarVoz(guardar.dataset.vrGuardarVoz);
    const eliminar = e.target.closest('[data-vr-eliminar-voz]');
    if (eliminar) return vrEliminarVoz(eliminar.dataset.vrEliminarVoz);
    const probar = e.target.closest('[data-vr-probar-voz]');
    if (probar) return vrProbarVoz(probar.dataset.vrProbarVoz);
    const generar = e.target.closest('[data-vr-probar-generar]');
    if (generar) return vrGenerarPrueba(generar.dataset.vrProbarGenerar);
  });
  document.getElementById('vr-perfil-nuevo')?.addEventListener('click', () => vrAbrirDetallePerfil('nuevo'));
  document.getElementById('vr-perfiles-lista')?.addEventListener('click', (e) => {
    // Eliminar va ANTES que abrir: el botón de basura vive DENTRO de la
    // tarjeta clickeable, así que closest() encontraría igual la tarjeta si
    // se chequeara después -- este orden es lo que evita que borrar también
    // abra el detalle del perfil que se acaba de borrar.
    const eliminar = e.target.closest('[data-vr-eliminar-perfil]');
    if (eliminar) return vrEliminarPerfil(eliminar.dataset.vrEliminarPerfil);
    const abrir = e.target.closest('[data-vr-abrir-perfil]');
    if (abrir) return vrAbrirDetallePerfil(abrir.dataset.vrAbrirPerfil);
  });
  document.getElementById('vr-vista-detalle')?.addEventListener('click', (e) => {
    if (e.target.closest('#vr-detalle-volver')) return vrVolverALista();
    if (e.target.closest('#vr-detalle-avatar-btn')) return vrTogglePicker();
    const emoji = e.target.closest('[data-vr-elegir-emoji]');
    if (emoji) return vrElegirEmoji(emoji.dataset.vrElegirEmoji);
    if (e.target.closest('#vr-detalle-guardar')) return vrGuardarDetalle();
    if (e.target.closest('#vr-detalle-eliminar')) return vrEliminarDetalle();
    if (e.target.closest('#vr-detalle-generar')) return vrGenerarDetalle();
    if (e.target.closest('#vr-detalle-puntuar')) return vrArreglarPuntuacion();
    if (e.target.closest('#vr-detalle-deshacer-puntuar')) return vrDeshacerPuntuacion();
    const borrarHist = e.target.closest('[data-vr-borrar-historial]');
    if (borrarHist) return vrBorrarHistorial(borrarHist.dataset.vrBorrarHistorial);
    const compartir = e.target.closest('[data-vr-compartir]');
    if (compartir) return vrCompartirAudio(compartir.dataset.vrCompartir);
    const preset = e.target.closest('[data-vr-elegir-preset]');
    if (preset) return vrElegirPresetDetalle(preset.dataset.vrElegirPreset);
  });
  // Cambiar la voz asignada invalida el preset elegido (los valores efectivos
  // dependen de la voz, ver vrProsodiaEfectiva) -- sin esto se podría generar
  // con un preset calibrado para OTRA voz sin darse cuenta.
  document.getElementById('vr-vista-detalle')?.addEventListener('change', (e) => {
    if (e.target.id === 'vr-detalle-voz') { vrPresetSeleccionadoDetalle = null; vrPintarChipsDetalle(); }
  });
  document.getElementById('vr-tutorial-abrir')?.addEventListener('click', () => vrToggleTutorial(true));
  document.getElementById('vr-tutorial-cerrar')?.addEventListener('click', () => vrToggleTutorial(false));

  // ---- Buscador de Fish Audio -------------------------------------------
  document.getElementById('vr-fish-buscar')?.addEventListener('click', () => vrFishBuscar());
  document.getElementById('vr-fish-q')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') vrFishBuscar(); });
  document.getElementById('vr-fish-resultados')?.addEventListener('click', (e) => {
    const agregar = e.target.closest('[data-vr-fish-agregar]');
    if (agregar) return vrFishAgregar(agregar.dataset.vrFishAgregar);
  });

  // ---- Presets globales ---------------------------------------------------
  document.getElementById('vr-preset-nuevo')?.addEventListener('click', () => { vrEditandoPreset = 'nueva'; vrPintarPresets(); });
  document.getElementById('vr-presets-lista')?.addEventListener('click', (e) => {
    const editar = e.target.closest('[data-vr-preset-editar]');
    if (editar) { vrEditandoPreset = editar.dataset.vrPresetEditar; return vrPintarPresets(); }
    const cancelar = e.target.closest('[data-vr-preset-cancelar]');
    if (cancelar) { vrEditandoPreset = null; return vrPintarPresets(); }
    const guardar = e.target.closest('[data-vr-preset-guardar]');
    if (guardar) return vrGuardarPreset(guardar.dataset.vrPresetGuardar);
    const eliminar = e.target.closest('[data-vr-preset-eliminar]');
    if (eliminar) return vrEliminarPreset(eliminar.dataset.vrPresetEliminar);
  });

  // ---- Panel "Ajustar presets" por voz + swatches de color/emoji del form -
  document.getElementById('vr-voces-lista')?.addEventListener('click', (e) => {
    const ajustar = e.target.closest('[data-vr-presets-voz]');
    if (ajustar) return vrTogglePanelPresetsVoz(ajustar.dataset.vrPresetsVoz);
    const guardarOv = e.target.closest('[data-vr-override-guardar]');
    if (guardarOv) return vrGuardarOverride(guardarOv.dataset.vrOverrideGuardar);
    const resetOv = e.target.closest('[data-vr-override-reset]');
    if (resetOv) return vrResetOverride(resetOv.dataset.vrOverrideReset);
    const swatch = e.target.closest('[data-vr-voz-color]');
    if (swatch) return vrElegirColorVoz(swatch.closest('[data-vr-form-suf]').dataset.vrFormSuf, swatch.dataset.vrVozColor);
    const emojiBtn = e.target.closest('[data-vr-voz-emoji-btn]');
    if (emojiBtn) return vrToggleEmojiVoz(emojiBtn.dataset.vrVozEmojiBtn);
    const emojiOp = e.target.closest('[data-vr-voz-emoji-elegir]');
    if (emojiOp) return vrElegirEmojiVoz(emojiOp.closest('[data-vr-form-suf]').dataset.vrFormSuf, emojiOp.dataset.vrVozEmojiElegir);
  });

  viActualizarSliderLabel();
  viCargarProsodia(); // precarga la config de "Probar" aunque no sea la tab activa -- así ya está lista si se entra a esa tab después
  viCambiarTab('redes'); // "Voces de Redes" es lo principal de la sección -- entra directo ahí en vez de "Probar"
}
function viCambiarTab(tab) {
  document.querySelectorAll('#vi-tabs .seg').forEach(b => b.classList.toggle('on', b.dataset.viTab === tab));
  document.querySelectorAll('#sec-voz-ia .ce-panel').forEach(p => { p.style.display = p.dataset.viPanel === tab ? '' : 'none'; });
  // El toggle mensajes/video no aplica a "Voces de Redes" -- son voces de
  // terceros sin relación con esos dos modos clonados.
  const modoGroup = document.getElementById('vi-modo');
  if (modoGroup) modoGroup.style.display = tab === 'redes' ? 'none' : '';
  if (tab === 'referencia') viCargarReferencia();
  else if (tab === 'redes') {
    // Si se había quedado en el detalle de un perfil y se cambió de tab,
    // siempre vuelve a la lista al reentrar -- nunca abrir "de arranque"
    // en el detalle de lo último que se miró.
    vrPerfilDetalleId = null;
    const lista = document.getElementById('vr-vista-lista');
    const detalle = document.getElementById('vr-vista-detalle');
    if (lista) lista.style.display = '';
    if (detalle) detalle.style.display = 'none';
    // Secuencial, no en paralelo: vrTarjetaPerfil busca la voz asignada en
    // VR_VOCES para pintar su color -- si vrCargarPerfiles ganara la carrera
    // contra vrCargarVoces, todas las tarjetas de perfil quedarían con el
    // color naranja por defecto (VR_VOCES vacío) sin que nada las repinte
    // después.
    // Presets y voces no dependen entre sí -- en paralelo. Perfiles sí tiene
    // que esperar a que VR_VOCES esté poblado (vrTarjetaPerfil busca ahí el
    // color de la voz asignada).
    Promise.all([vrCargarPresets(), vrCargarVoces()]).then(() => vrCargarPerfiles());
    if (!localStorage.getItem('vr_tutorial_visto')) vrToggleTutorial(true);
  }
}
function viActualizarSliderLabel() {
  document.getElementById('vi-sl-temp-val').textContent = Number(document.getElementById('vi-sl-temperatura').value).toFixed(2);
  document.getElementById('vi-sl-topp-val').textContent = Number(document.getElementById('vi-sl-top_p').value).toFixed(2);
  document.getElementById('vi-sl-vel-val').textContent = Number(document.getElementById('vi-sl-velocidad').value).toFixed(2) + 'x';
}
function viLeerSliders() {
  return {
    temperatura: Number(document.getElementById('vi-sl-temperatura').value),
    top_p: Number(document.getElementById('vi-sl-top_p').value),
    velocidad: Number(document.getElementById('vi-sl-velocidad').value),
  };
}
// Carga los valores guardados como predeterminados en los sliders al entrar
// o cambiar de modo -- sin esto, el slider siempre arrancaría en 0.7/0.7/1.0
// aunque ya se hubiera guardado otra cosa para ese modo.
async function viCargarProsodia() {
  const { data: { session } } = await sb.auth.getSession();
  try {
    const res = await fetch(`${VOZ_IA_REF_FN}?modo=${viModo}`, {
      headers: { Authorization: `Bearer ${session?.access_token || ''}`, apikey: SUPABASE_KEY },
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.ok) return;
    document.getElementById('vi-sl-temperatura').value = out.temperatura ?? 0.7;
    document.getElementById('vi-sl-top_p').value = out.top_p ?? 0.7;
    document.getElementById('vi-sl-velocidad').value = out.velocidad ?? 1.0;
    viActualizarSliderLabel();
  } catch (e) { /* se queda con lo que había en pantalla */ }
}
async function viGuardarProsodia() {
  const btn = document.getElementById('vi-guardar-prosodia');
  btn.disabled = true; btn.innerHTML = 'Guardando... <i class="fas fa-spinner fa-spin"></i>';
  const { data: { session } } = await sb.auth.getSession();
  try {
    const res = await fetch(`${VOZ_IA_REF_FN}?modo=${viModo}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}`, apikey: SUPABASE_KEY },
      body: JSON.stringify(viLeerSliders()),
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.ok) { errToast('No se pudo guardar: ' + (out?.error || res.status)); return; }
    okToast('Guardado como predeterminado -- así va a sonar la voz real de ahora en más');
  } catch (e) {
    errToast('No se pudo guardar: ' + e.message);
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar como predeterminado';
  }
}
async function viGenerar() {
  const btn = document.getElementById('vi-generar');
  const texto = document.getElementById('vi-texto').value.trim();
  if (!texto) { errToast('Escribí un texto primero'); return; }
  btn.disabled = true; btn.innerHTML = 'Generando... <i class="fas fa-spinner fa-spin"></i>';
  const { data, error } = await sb.functions.invoke('voz-ia-probar', { body: { texto, modo: viModo, ...viLeerSliders() } });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Generar audio';
  const out = document.getElementById('vi-resultado');
  if (error || !data?.ok) { errToast('No se pudo generar el audio: ' + (await msgErrorFn(error, data))); out.innerHTML = ''; return; }
  out.innerHTML = `
    <div class="muted" style="font-size:12.5px;margin-bottom:8px"><b>Guion pulido:</b> ${esc(data.texto_mejorado)}</div>
    <audio controls style="width:100%" src="data:audio/mpeg;base64,${data.audio_base64}"></audio>`;
}
async function viCargarReferencia() {
  const estado = document.getElementById('vi-ref-estado');
  const lista = document.getElementById('vi-ref-lista');
  estado.textContent = 'Cargando...';
  lista.innerHTML = '';
  const { data: { session } } = await sb.auth.getSession();
  try {
    const res = await fetch(`${VOZ_IA_REF_FN}?modo=${viModo}`, {
      headers: { Authorization: `Bearer ${session?.access_token || ''}`, apikey: SUPABASE_KEY },
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.ok) { estado.innerHTML = 'No se pudieron cargar las muestras.'; return; }
    estado.innerHTML = out.entrenado
      ? `<i class="fas fa-circle-check" style="color:var(--ok,#10b981)"></i> Voz entrenada con ${out.muestras.length} muestra(s)`
      : `<i class="fas fa-triangle-exclamation" style="color:var(--warn,#f5b544)"></i> Todavía sin entrenar -- las muestras de abajo no afectan la voz hasta apretar "Entrenar"`;
    if (!out.muestras.length) {
      lista.innerHTML = `<div class="muted" style="font-size:12.5px">Todavía no hay muestras para ${viModo === 'mensajes' ? 'mensajes' : 'videos de Instagram'}.</div>`;
      return;
    }
    lista.innerHTML = out.muestras.map(m => `
      <div class="card" style="padding:12px" data-vi-muestra-id="${m.id}">
        <div class="muted" style="font-size:12px;margin-bottom:6px">${m.duracion_seg ? m.duracion_seg.toFixed(1) + 's · ' : ''}${m.bitrate_kbps ? m.bitrate_kbps + ' kbps' : ''}</div>
        ${m.url ? `<audio controls style="width:100%" src="${esc(m.url)}"></audio>` : '<div class="muted">Sin reproducir</div>'}
        <textarea class="ei" rows="2" style="width:100%;margin-top:8px;resize:vertical" id="vi-trans-${m.id}">${esc(m.transcripcion || '')}</textarea>
        <div style="margin-top:6px;display:flex;gap:8px">
          <button class="dbtn gh" style="padding:6px 10px;font-size:12.5px" data-vi-guardar-trans="${m.id}"><i class="fas fa-floppy-disk"></i> Guardar texto</button>
          <button class="dbtn gh" style="padding:6px 10px;font-size:12.5px" data-vi-borrar="${m.id}"><i class="fas fa-trash"></i> Borrar</button>
        </div>
      </div>`).join('');
  } catch (e) {
    estado.innerHTML = 'No se pudieron cargar las muestras.';
  }
}
// Mide duración real decodificando el audio -- el bitrate efectivo sale de
// tamaño/duración. Es lo que permite avisar ANTES de subir en vez de que el
// servidor rechace después de que ya se esperó la subida completa.
async function viMedirAudio(file) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const duracion = buf.duration;
    return { duracion, bitrateKbps: (file.size * 8) / duracion / 1000 };
  } finally {
    ctx.close();
  }
}
async function viSubirReferencia(file) {
  if (!VI_TIPOS_OK.includes(file.type)) { errToast('Formato no soportado. Usá MP3, OGG, WAV, M4A o WebM.'); return; }
  if (file.size > VI_MAX_BYTES) { errToast(`El archivo pesa ${(file.size / 1e6).toFixed(1)} MB. Máximo 20 MB.`); return; }

  let duracion, bitrateKbps;
  try {
    ({ duracion, bitrateKbps } = await viMedirAudio(file));
  } catch (e) {
    errToast('No se pudo leer el archivo de audio -- probá con otro formato.');
    return;
  }

  if (duracion < VI_MIN_DURACION || bitrateKbps < VI_MIN_BITRATE) {
    errToast(
      `No se puede usar: ${duracion.toFixed(1)}s a ${bitrateKbps.toFixed(0)} kbps. ` +
      `Es calidad de nota de WhatsApp, la voz clonada va a sonar metálica. ` +
      `Grabá con la app de notas de voz del teléfono (nunca por WhatsApp), 30-60s, en un cuarto silencioso.`
    );
    return;
  }
  if (duracion < VI_IDEAL_DURACION || bitrateKbps < VI_IDEAL_BITRATE) {
    const seguir = await confirmarSheet({
      titulo: '¿Subir igual?',
      detalle: `Calidad ajustada: ${duracion.toFixed(1)}s a ${bitrateKbps.toFixed(0)} kbps. Es probable que la voz clonada suene un poco metálica. Lo ideal es 25-60s y más de 64 kbps.`,
      textoOk: 'Subir igual',
    });
    if (!seguir) return;
  }

  const btn = document.getElementById('vi-ref-subir');
  btn.disabled = true; btn.innerHTML = 'Subiendo... <i class="fas fa-spinner fa-spin"></i>';
  const { data: { session } } = await sb.auth.getSession();
  try {
    const res = await fetch(`${VOZ_IA_REF_FN}?modo=${viModo}`, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        Authorization: `Bearer ${session?.access_token || ''}`,
        apikey: SUPABASE_KEY,
        'x-duracion-seg': String(duracion),
      },
      body: file,
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.ok) { errToast('No se pudo subir la muestra: ' + (out?.error || res.status)); return; }
    okToast('Muestra agregada -- apretá "Entrenar voz" para que afecte lo que suena');
    viCargarReferencia();
  } catch (e) {
    errToast('No se pudo subir la muestra: ' + e.message);
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload"></i> Agregar muestra';
  }
}
async function viBorrarMuestra(id) {
  if (!(await confirmarSheet({ titulo: '¿Borrar esta muestra?', detalle: 'Hay que entrenar de nuevo para que el cambio se aplique a la voz.', textoOk: 'Borrar', destructivo: true }))) return;
  const { data: { session } } = await sb.auth.getSession();
  try {
    const res = await fetch(`${VOZ_IA_REF_FN}?modo=${viModo}&id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token || ''}`, apikey: SUPABASE_KEY },
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.ok) { errToast('No se pudo borrar: ' + (out?.error || res.status)); return; }
    okToast('Muestra borrada');
    viCargarReferencia();
  } catch (e) {
    errToast('No se pudo borrar: ' + e.message);
  }
}
async function viGuardarTranscripcion(id) {
  const texto = document.getElementById(`vi-trans-${id}`)?.value.trim();
  if (!texto) { errToast('La transcripción no puede quedar vacía'); return; }
  const { data: { session } } = await sb.auth.getSession();
  try {
    const res = await fetch(`${VOZ_IA_REF_FN}?modo=${viModo}&id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}`, apikey: SUPABASE_KEY },
      body: JSON.stringify({ transcripcion: texto }),
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.ok) { errToast('No se pudo guardar: ' + (out?.error || res.status)); return; }
    okToast('Transcripción guardada -- entrená de nuevo para que la use el modelo');
  } catch (e) {
    errToast('No se pudo guardar: ' + e.message);
  }
}
async function viEntrenar() {
  if (!(await confirmarSheet({ titulo: `Se va a entrenar la voz de "${viModo === 'mensajes' ? 'mensajes' : 'videos de Instagram'}"`, detalle: 'Con todas las muestras cargadas. Puede tardar unos segundos.', textoOk: 'Entrenar' }))) return;
  const btn = document.getElementById('vi-ref-entrenar');
  btn.disabled = true; btn.innerHTML = 'Entrenando... <i class="fas fa-spinner fa-spin"></i>';
  const { data: { session } } = await sb.auth.getSession();
  try {
    const res = await fetch(`${VOZ_IA_REF_FN}?modo=${viModo}&accion=entrenar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token || ''}`, apikey: SUPABASE_KEY },
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.ok) { errToast('No se pudo entrenar: ' + (out?.error || res.status)); return; }
    okToast(`Voz entrenada con ${out.muestras_usadas} muestra(s)`);
    viCargarReferencia();
  } catch (e) {
    errToast('No se pudo entrenar: ' + e.message);
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-brain"></i> Entrenar voz con estas muestras';
  }
}

/* ---------- Voces de Redes (2026-08-13, rediseño de tarjetas) -----------
   Subsección de Voz IA: catálogo de voces de terceros (biblioteca pública de
   Fish Audio, no clonadas) para voz en off de videos de redes, más perfiles
   (una cuenta de Instagram que maneja la agencia) con una voz por defecto y
   un ícono (emoji) para identificarlos de un vistazo. Entrar a un perfil
   (click en su tarjeta) abre una vista de detalle -- ahí se cambia la voz,
   se escribe el guion y se genera el audio de prueba, todo junto.
   Sin relación con el toggle mensajes/video de arriba -- ver viCambiarTab. */
let VR_VOCES = [];
let VR_PERFILES = [];
let vrEditandoVoz = null;      // null | 'nueva' | "<id>" -- edición inline en la lista de voces
let vrPerfilDetalleId = null;  // null | 'nuevo' | "<id>" -- qué perfil está abierto en la vista de detalle
let vrPerfilDetalleAvatar = null; // emoji elegido en la vista de detalle, todavía no guardado
let vrTextoAntesDePuntuar = null; // texto previo a "Arreglar puntuación", null = nada que deshacer
let VR_HISTORIAL = [];
const VR_EMOJIS = ['🎙️','📸','🎬','✈️','🏖️','🌴','🗺️','📱','💬','🎉','😀','😎','🔥','💃','🕺','🎵','📺','🎥','⭐','🌟','🚀','🏝️','🍹','🧳'];

// Paleta de acento por voz (2026-08-14, dirección visual armada con
// google/gemini-3.7-flash vía OpenRouter -- ver plan
// "en-voces-de-redes-quizzical-locket"). `naranja` es el color de marca,
// el resto se eligió para leerse bien en fondo oscuro Y claro. Se aplica
// como variable CSS inline (--v-rgb) en vez de una clase por color -- el
// color vive en el dato (voces_catalogo.color), no hardcodeado en CSS.
const VR_COLORES = {
  naranja:   { nombre: 'Naranja',   rgb: '255,145,0' },
  coral:     { nombre: 'Coral',     rgb: '255,51,102' },
  cian:      { nombre: 'Cian',      rgb: '0,194,203' },
  violeta:   { nombre: 'Violeta',   rgb: '139,92,246' },
  esmeralda: { nombre: 'Esmeralda', rgb: '16,185,129' },
  azul:      { nombre: 'Azul',      rgb: '59,130,246' },
};
function vrColorRgb(key) { return VR_COLORES[key]?.rgb || VR_COLORES.naranja.rgb; }

let VR_PRESETS = [];    // [{id,nombre,emoji,descripcion,temperatura,top_p,velocidad,orden,activo}]
let VR_OVERRIDES = [];  // [{voz_id,preset_id,temperatura,top_p,velocidad}]
let vrPresetAbiertoVoz = null; // id de voz con el panel de "ajustar presets" abierto, o null
let vrPresetSeleccionadoDetalle = null; // preset_id elegido en el detalle de perfil, o null (prosodia base)
let vrEditandoPreset = null;   // null | 'nuevo' | "<id>"

function vrOverrideDe(vozId, presetId) {
  return VR_OVERRIDES.find(o => o.voz_id === vozId && o.preset_id === presetId) || null;
}
function vrProsodiaEfectiva(voz, presetId) {
  if (!presetId) return { temperatura: voz.temperatura, top_p: voz.top_p, velocidad: voz.velocidad, nombre: null };
  const preset = VR_PRESETS.find(p => p.id === presetId);
  if (!preset) return { temperatura: voz.temperatura, top_p: voz.top_p, velocidad: voz.velocidad, nombre: null };
  const ov = vrOverrideDe(voz.id, presetId);
  return {
    temperatura: ov?.temperatura ?? preset.temperatura,
    top_p: ov?.top_p ?? preset.top_p,
    velocidad: ov?.velocidad ?? preset.velocidad,
    nombre: preset.nombre,
  };
}

async function vrCargarVoces() {
  const { data, error } = await sb.rpc('voces_catalogo_listar');
  if (error || !data?.ok) { errToast('No se pudieron cargar las voces: ' + (error?.message || data?.error || '')); return; }
  VR_VOCES = data.voces || [];
  vrEditandoVoz = null;
  vrPintarVoces();
}

function vrAbrirVozNueva() { vrEditandoVoz = 'nueva'; vrPintarVoces(); }
function vrAbrirVozEditar(id) { vrEditandoVoz = String(id); vrPintarVoces(); }

function vrSwatchesColor(suf, colorSel) {
  return Object.entries(VR_COLORES).map(([key, c]) =>
    `<div class="vr-swatch${key === colorSel ? ' on' : ''}" style="--sw-rgb:${c.rgb}" data-vr-voz-color="${key}" title="${esc(c.nombre)}"></div>`
  ).join('');
}

function vrFilaVozForm(voz) {
  const id = voz?.id ?? '';
  const suf = id || 'nueva';
  const colorSel = voz?.color || 'naranja';
  const emojiSel = voz?.emoji || '🎙️';
  return `
    <div class="card" style="padding:12px" data-vr-form-suf="${suf}">
      <div style="display:flex;gap:10px;align-items:flex-start">
        <div style="text-align:center;flex-shrink:0">
          <button class="dbtn gh" id="vr-voz-emoji-btn-${suf}" data-vr-voz-emoji-btn="${suf}" style="font-size:22px;padding:8px 12px;line-height:1">${esc(emojiSel)}</button>
          <input type="hidden" id="vr-voz-emoji-${suf}" value="${esc(emojiSel)}">
          <div id="vr-voz-emoji-picker-${suf}" style="display:none;margin-top:6px;position:absolute;z-index:5"></div>
        </div>
        <div style="flex:1;min-width:180px">
          <label class="ce-lbl">Nombre</label>
          <input class="ei" id="vr-voz-nombre-${suf}" style="width:100%" value="${esc(voz?.nombre || '')}" placeholder="Ej: Valentina - cálida">
        </div>
      </div>
      <label class="ce-lbl" style="margin-top:10px">Descripción corta</label>
      <input class="ei" id="vr-voz-descripcion-${suf}" style="width:100%" value="${esc(voz?.descripcion || '')}" placeholder="Ej: cálida y cercana, ideal para storytime">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
        <div>
          <label class="ce-lbl">Género</label>
          <select class="ei" id="vr-voz-genero-${suf}" style="width:100%">
            <option value="" ${!voz?.genero ? 'selected' : ''}>Sin especificar</option>
            <option value="femenina" ${voz?.genero === 'femenina' ? 'selected' : ''}>Femenina</option>
            <option value="masculina" ${voz?.genero === 'masculina' ? 'selected' : ''}>Masculina</option>
          </select>
        </div>
        <div>
          <label class="ce-lbl">ID de voz de Fish</label>
          <input class="ei" id="vr-voz-fishid-${suf}" style="width:100%" value="${esc(voz?.fish_model_id || '')}" placeholder="reference_id">
        </div>
      </div>
      <label class="ce-lbl" style="margin-top:10px">Color</label>
      <input type="hidden" id="vr-voz-color-${suf}" value="${colorSel}">
      <div class="vr-swatches">${vrSwatchesColor(suf, colorSel)}</div>
      <div style="margin-top:12px;display:grid;gap:10px">
        <div>
          <label class="ce-lbl" style="display:flex;justify-content:space-between"><span>Expresividad</span><span id="vr-voz-temp-val-${suf}" class="muted">${Number(voz?.temperatura ?? 0.65).toFixed(2)}</span></label>
          <input type="range" id="vr-voz-temp-${suf}" min="0" max="1" step="0.05" value="${voz?.temperatura ?? 0.65}" style="width:100%" oninput="document.getElementById('vr-voz-temp-val-${suf}').textContent=Number(this.value).toFixed(2)">
        </div>
        <div>
          <label class="ce-lbl" style="display:flex;justify-content:space-between"><span>Variación</span><span id="vr-voz-topp-val-${suf}" class="muted">${Number(voz?.top_p ?? 0.75).toFixed(2)}</span></label>
          <input type="range" id="vr-voz-topp-${suf}" min="0" max="1" step="0.05" value="${voz?.top_p ?? 0.75}" style="width:100%" oninput="document.getElementById('vr-voz-topp-val-${suf}').textContent=Number(this.value).toFixed(2)">
        </div>
        <div>
          <label class="ce-lbl" style="display:flex;justify-content:space-between"><span>Velocidad</span><span id="vr-voz-vel-val-${suf}" class="muted">${Number(voz?.velocidad ?? 1.08).toFixed(2)}x</span></label>
          <input type="range" id="vr-voz-vel-${suf}" min="0.5" max="2" step="0.05" value="${voz?.velocidad ?? 1.08}" style="width:100%" oninput="document.getElementById('vr-voz-vel-val-${suf}').textContent=Number(this.value).toFixed(2)+'x'">
        </div>
      </div>
      <label style="margin-top:10px;display:flex;align-items:center;gap:6px;font-size:12.5px">
        <input type="checkbox" id="vr-voz-activo-${suf}" ${voz?.activo !== false ? 'checked' : ''}> Activa (visible para asignar a perfiles)
      </label>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="dbtn gh" data-vr-guardar-voz="${id}"><i class="fas fa-floppy-disk"></i> Guardar</button>
        <button class="dbtn gh" data-vr-cancelar-voz><i class="fas fa-xmark"></i> Cancelar</button>
      </div>
    </div>`;
}

// Chips de preset -- reutilizados en la tarjeta de "probar" de una voz y en
// el detalle de perfil. `seleccionado` es el preset_id activo (o null =
// prosodia base de la voz). Devuelve también el chip "Base" para volver.
function vrChipsPresets(vozId, seleccionado, dataAttr) {
  const voz = VR_VOCES.find(v => v.id === vozId);
  const base = `<button type="button" class="vr-preset${seleccionado ? '' : ' on'}" ${dataAttr}="">Base</button>`;
  const chips = VR_PRESETS.filter(p => p.activo).map(p =>
    `<button type="button" class="vr-preset${seleccionado === p.id ? ' on' : ''}" ${dataAttr}="${p.id}">${esc(p.emoji)} ${esc(p.nombre)}</button>`
  ).join('');
  const efectiva = voz ? vrProsodiaEfectiva(voz, seleccionado) : null;
  const valores = efectiva && seleccionado
    ? `<div class="vr-preset-valores">Exp ${Number(efectiva.temperatura).toFixed(2)} · Var ${Number(efectiva.top_p).toFixed(2)} · Vel ${Number(efectiva.velocidad).toFixed(2)}x</div>`
    : '';
  return `<div style="display:flex;gap:6px;flex-wrap:wrap">${base}${chips}</div>${valores}`;
}

function vrFilaVoz(voz) {
  const rgb = vrColorRgb(voz.color);
  const generoTxt = voz.genero === 'femenina' ? 'Femenina' : voz.genero === 'masculina' ? 'Masculina' : null;
  return `
    <div class="vr-card" style="--v-rgb:${rgb};padding:14px${voz.activo ? '' : ';opacity:.55'}">
      <div style="display:flex;align-items:center;gap:10px;position:relative">
        <div class="vr-avatar">${esc(voz.emoji || '🎙️')}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(voz.nombre)}</div>
          ${voz.descripcion ? `<div class="muted" style="font-size:11px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(voz.descripcion)}</div>` : ''}
        </div>
      </div>
      ${voz.activo ? '' : '<div class="muted" style="font-size:10.5px;margin-top:6px">(inactiva)</div>'}
      <div style="display:flex;gap:5px;margin-top:10px;flex-wrap:wrap">
        <span class="vr-chip vr-chip-color">${esc(VR_COLORES[voz.color]?.nombre || 'Naranja')}</span>
        ${generoTxt ? `<span class="vr-chip">${generoTxt}</span>` : ''}
        <span class="vr-chip">Exp ${Number(voz.temperatura).toFixed(2)}</span>
        <span class="vr-chip">Var ${Number(voz.top_p).toFixed(2)}</span>
        <span class="vr-chip">Vel ${Number(voz.velocidad).toFixed(2)}x</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="dbtn gh" style="padding:5px 9px;font-size:11.5px;flex:1" data-vr-probar-voz="${voz.id}" title="Probar"><i class="fas fa-play"></i></button>
        <button class="dbtn gh" style="padding:5px 9px;font-size:11.5px;flex:1" data-vr-editar-voz="${voz.id}" title="Editar"><i class="fas fa-pen"></i></button>
        <button class="dbtn gh" style="padding:5px 9px;font-size:11.5px;flex:1" data-vr-presets-voz="${voz.id}" title="Ajustar presets"><i class="fas fa-sliders"></i></button>
        <button class="dbtn gh" style="padding:5px 9px;font-size:11.5px" data-vr-eliminar-voz="${voz.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
      </div>
      <div id="vr-voz-probar-${voz.id}"></div>
      <div id="vr-voz-presets-${voz.id}"></div>
    </div>`;
}

function vrPintarVoces() {
  const cont = document.getElementById('vr-voces-lista');
  if (!cont) return;
  let html = '';
  if (vrEditandoVoz === 'nueva') html += vrFilaVozForm(null);
  html += VR_VOCES.map(v => vrEditandoVoz === String(v.id) ? vrFilaVozForm(v) : vrFilaVoz(v)).join('');
  cont.innerHTML = html || '<div class="muted" style="font-size:12.5px">Todavía no hay voces en el catálogo.</div>';
}

async function vrGuardarVoz(id) {
  const suf = id || 'nueva';
  const nombre = document.getElementById(`vr-voz-nombre-${suf}`)?.value.trim();
  const fishId = document.getElementById(`vr-voz-fishid-${suf}`)?.value.trim();
  if (!nombre) { errToast('Ponele un nombre a la voz'); return; }
  if (!fishId) { errToast('Falta el ID de voz de Fish'); return; }
  const payload = {
    p_id: id ? Number(id) : null,
    p_nombre: nombre,
    p_fish_model_id: fishId,
    p_temperatura: Number(document.getElementById(`vr-voz-temp-${suf}`).value),
    p_top_p: Number(document.getElementById(`vr-voz-topp-${suf}`).value),
    p_velocidad: Number(document.getElementById(`vr-voz-vel-${suf}`).value),
    p_activo: document.getElementById(`vr-voz-activo-${suf}`).checked,
    p_descripcion: document.getElementById(`vr-voz-descripcion-${suf}`)?.value.trim() || null,
    p_genero: document.getElementById(`vr-voz-genero-${suf}`)?.value || null,
    p_emoji: document.getElementById(`vr-voz-emoji-${suf}`)?.value || null,
    p_color: document.getElementById(`vr-voz-color-${suf}`)?.value || null,
  };
  const { data, error } = await sb.rpc('voces_catalogo_guardar', payload);
  if (error || !data?.ok) { errToast('No se pudo guardar: ' + (error?.message || data?.error || '')); return; }
  okToast('Voz guardada');
  await vrCargarVoces();
  // perfiles_voz_listar denormaliza voz_nombre -- sin esto, renombrar una voz
  // deja el nombre viejo pegado en la tarjeta del perfil hasta salir y volver
  // a entrar a la pestaña.
  await vrCargarPerfiles();
}

async function vrEliminarVoz(id) {
  const perfilesEnUso = VR_PERFILES.filter(p => p.voz_id === Number(id)).length;
  if (!(await confirmarSheet({
    titulo: perfilesEnUso > 0 ? '¿Eliminar de todos modos?' : '¿Eliminar esta voz del catálogo?',
    detalle: perfilesEnUso > 0 ? `${perfilesEnUso} perfil(es) tienen esta voz asignada -- van a quedar "sin voz".` : '',
    textoOk: 'Eliminar', destructivo: true,
  }))) return;
  const { data, error } = await sb.rpc('voces_catalogo_eliminar', { p_id: Number(id), p_forzar: perfilesEnUso > 0 });
  if (error || !data?.ok) { errToast('No se pudo eliminar: ' + (error?.message || data?.error || '')); return; }
  okToast('Voz eliminada');
  await vrCargarVoces();
  await vrCargarPerfiles();
}

function vrToggleEmojiVoz(suf) {
  const cont = document.getElementById(`vr-voz-emoji-picker-${suf}`);
  if (!cont) return;
  const abrir = cont.style.display === 'none';
  if (abrir) {
    cont.innerHTML = `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;background:var(--panel-solid);border:1px solid var(--line);border-radius:10px;padding:8px;max-width:210px;box-shadow:0 10px 30px rgba(0,0,0,.25)">${
      VR_EMOJIS.map(e => `<button type="button" class="dbtn gh" style="padding:6px;font-size:17px" data-vr-voz-emoji-elegir="${e}">${e}</button>`).join('')
    }</div>`;
  }
  cont.style.display = abrir ? '' : 'none';
}
function vrElegirEmojiVoz(suf, emoji) {
  const hidden = document.getElementById(`vr-voz-emoji-${suf}`);
  const btn = document.getElementById(`vr-voz-emoji-btn-${suf}`);
  if (hidden) hidden.value = emoji;
  if (btn) btn.textContent = emoji;
  vrToggleEmojiVoz(suf);
}
function vrElegirColorVoz(suf, colorKey) {
  const hidden = document.getElementById(`vr-voz-color-${suf}`);
  if (hidden) hidden.value = colorKey;
  document.querySelectorAll(`[data-vr-form-suf="${suf}"] .vr-swatch`).forEach(s => s.classList.toggle('on', s.dataset.vrVozColor === colorKey));
}

// ---- Probar una voz del catálogo (con selector de preset) ----------------

let vrPresetProbar = {}; // { [vozId]: presetId|null } -- preset elegido en el mini panel "Probar" de cada voz

async function vrProbarVoz(id) {
  const vozId = Number(id);
  const cont = document.getElementById(`vr-voz-probar-${id}`);
  if (!cont) return;
  if (cont.dataset.abierto === '1') { cont.innerHTML = ''; cont.dataset.abierto = '0'; return; }
  cont.dataset.abierto = '1';
  vrPresetProbar[vozId] = vrPresetProbar[vozId] ?? null;
  cont.innerHTML = `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line)">
      <textarea class="ei" id="vr-probar-texto-${id}" rows="2" style="width:100%;resize:vertical" placeholder="Escribí un texto corto para escuchar esta voz..."></textarea>
      <div id="vr-probar-presets-${id}" style="margin-top:8px" data-vr-probar-presets="${id}">${vrChipsPresets(vozId, vrPresetProbar[vozId], 'data-vr-probar-preset-el')}</div>
      <button class="dbtn gh" style="margin-top:8px;padding:6px 10px;font-size:12.5px" data-vr-probar-generar="${id}"><i class="fas fa-wand-magic-sparkles"></i> Generar</button>
      <div id="vr-probar-resultado-${id}" style="margin-top:8px"></div>
    </div>`;
  // Delegación local: los chips de preset de ESTE panel viven dentro de
  // `cont`, que se reescribe entero cada vez que se abre/cierra -- un
  // listener por apertura no acumula (se pierde con el innerHTML de arriba).
  cont.querySelector(`[data-vr-probar-presets="${id}"]`)?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-vr-probar-preset-el]');
    if (!chip) return;
    vrPresetProbar[vozId] = chip.dataset.vrProbarPresetEl ? Number(chip.dataset.vrProbarPresetEl) : null;
    document.getElementById(`vr-probar-presets-${id}`).innerHTML = vrChipsPresets(vozId, vrPresetProbar[vozId], 'data-vr-probar-preset-el');
  });
}

async function vrGenerarPrueba(id) {
  const texto = document.getElementById(`vr-probar-texto-${id}`)?.value.trim();
  if (!texto) { errToast('Escribí un texto primero'); return; }
  const btn = document.querySelector(`[data-vr-probar-generar="${id}"]`);
  const out = document.getElementById(`vr-probar-resultado-${id}`);
  btn.disabled = true; btn.innerHTML = `<span class="vr-wave"><span></span><span></span><span></span><span></span></span> Generando...`;
  const presetId = vrPresetProbar[Number(id)];
  const body = { voz_id: Number(id), texto };
  if (presetId) body.preset_id = presetId;
  const { data, error } = await sb.functions.invoke('voz-perfil-probar', { body });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Generar';
  if (error || !data?.ok) { errToast('No se pudo generar: ' + (await msgErrorFn(error, data))); return; }
  out.innerHTML = `<audio controls autoplay style="width:100%" src="${esc(data.audio_url)}"></audio>`;
}

// ---- Panel "Ajustar presets" por voz (override de prosodia) --------------

function vrTogglePanelPresetsVoz(id) {
  const vozId = Number(id);
  const cont = document.getElementById(`vr-voz-presets-${id}`);
  if (!cont) return;
  if (vrPresetAbiertoVoz === vozId) { cont.innerHTML = ''; vrPresetAbiertoVoz = null; return; }
  vrPresetAbiertoVoz = vozId;
  document.querySelectorAll('[id^="vr-voz-presets-"]').forEach(c => { if (c !== cont) c.innerHTML = ''; });
  cont.innerHTML = vrPanelPresetsVoz(vozId);
}

function vrPanelPresetsVoz(vozId) {
  if (!VR_PRESETS.length) return `<div class="muted" style="font-size:12px;margin-top:10px">Todavía no hay presets creados.</div>`;
  const filas = VR_PRESETS.filter(p => p.activo).map(p => {
    const ov = vrOverrideDe(vozId, p.id);
    const suf = `${vozId}-${p.id}`;
    return `
      <div style="border-top:1px solid var(--line);padding:8px 0">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12.5px;font-weight:700">${esc(p.emoji)} ${esc(p.nombre)}${ov ? ' <span class="muted" style="font-weight:400">(calibrado)</span>' : ''}</span>
          ${ov ? `<button class="dbtn gh" style="padding:2px 7px;font-size:10px" data-vr-override-reset="${vozId}:${p.id}">Restablecer</button>` : ''}
        </div>
        <div style="display:grid;gap:6px;margin-top:6px">
          <div><label class="ce-lbl" style="display:flex;justify-content:space-between;font-size:10.5px"><span>Exp</span><span id="vr-ov-temp-val-${suf}">${Number(ov?.temperatura ?? p.temperatura).toFixed(2)}</span></label>
            <input type="range" id="vr-ov-temp-${suf}" min="0" max="1" step="0.05" value="${ov?.temperatura ?? p.temperatura}" style="width:100%" oninput="document.getElementById('vr-ov-temp-val-${suf}').textContent=Number(this.value).toFixed(2)"></div>
          <div><label class="ce-lbl" style="display:flex;justify-content:space-between;font-size:10.5px"><span>Var</span><span id="vr-ov-topp-val-${suf}">${Number(ov?.top_p ?? p.top_p).toFixed(2)}</span></label>
            <input type="range" id="vr-ov-topp-${suf}" min="0" max="1" step="0.05" value="${ov?.top_p ?? p.top_p}" style="width:100%" oninput="document.getElementById('vr-ov-topp-val-${suf}').textContent=Number(this.value).toFixed(2)"></div>
          <div><label class="ce-lbl" style="display:flex;justify-content:space-between;font-size:10.5px"><span>Vel</span><span id="vr-ov-vel-val-${suf}">${Number(ov?.velocidad ?? p.velocidad).toFixed(2)}x</span></label>
            <input type="range" id="vr-ov-vel-${suf}" min="0.5" max="2" step="0.05" value="${ov?.velocidad ?? p.velocidad}" style="width:100%" oninput="document.getElementById('vr-ov-vel-val-${suf}').textContent=Number(this.value).toFixed(2)+'x'"></div>
        </div>
        <button class="dbtn gh" style="margin-top:6px;padding:4px 9px;font-size:11px" data-vr-override-guardar="${vozId}:${p.id}"><i class="fas fa-floppy-disk"></i> Guardar calibración</button>
      </div>`;
  }).join('');
  return `<div style="margin-top:10px">${filas}</div>`;
}

async function vrGuardarOverride(claveCombinada) {
  const [vozId, presetId] = claveCombinada.split(':').map(Number);
  const suf = `${vozId}-${presetId}`;
  const payload = {
    p_voz_id: vozId, p_preset_id: presetId,
    p_temperatura: Number(document.getElementById(`vr-ov-temp-${suf}`).value),
    p_top_p: Number(document.getElementById(`vr-ov-topp-${suf}`).value),
    p_velocidad: Number(document.getElementById(`vr-ov-vel-${suf}`).value),
  };
  const { data, error } = await sb.rpc('voz_preset_override_guardar', payload);
  if (error || !data?.ok) { errToast('No se pudo guardar la calibración: ' + (error?.message || data?.error || '')); return; }
  okToast('Calibración guardada para esta voz');
  await vrCargarPresets();
  vrRepintarPanelPresetsVoz(vozId);
}

async function vrResetOverride(claveCombinada) {
  const [vozId, presetId] = claveCombinada.split(':').map(Number);
  const { data, error } = await sb.rpc('voz_preset_override_guardar', { p_voz_id: vozId, p_preset_id: presetId, p_temperatura: null, p_top_p: null, p_velocidad: null });
  if (error || !data?.ok) { errToast('No se pudo restablecer: ' + (error?.message || data?.error || '')); return; }
  await vrCargarPresets();
  vrRepintarPanelPresetsVoz(vozId);
}

// Repinta el panel de UNA voz directo, sin depender de vrPresetAbiertoVoz --
// a diferencia de vrTogglePanelPresetsVoz (que abre/cierra), esto no le
// importa si el panel estaba abierto de otra voz: siempre deja `vozId`
// abierto con datos frescos.
function vrRepintarPanelPresetsVoz(vozId) {
  document.querySelectorAll('[id^="vr-voz-presets-"]').forEach(c => { c.innerHTML = ''; });
  const cont = document.getElementById(`vr-voz-presets-${vozId}`);
  if (!cont) return;
  vrPresetAbiertoVoz = vozId;
  cont.innerHTML = vrPanelPresetsVoz(vozId);
}

// ---- Presets globales (card "Presets") ------------------------------------

async function vrCargarPresets() {
  const { data, error } = await sb.rpc('voz_presets_listar');
  if (error || !data?.ok) { errToast('No se pudieron cargar los presets: ' + (error?.message || data?.error || '')); return; }
  VR_PRESETS = data.presets || [];
  VR_OVERRIDES = data.overrides || [];
  vrPintarPresets();
}

function vrFilaPresetForm(preset) {
  const id = preset?.id ?? '';
  const suf = id || 'nueva';
  return `
    <div class="card" style="padding:12px;width:100%">
      <div style="display:flex;gap:8px">
        <input class="ei" id="vr-preset-emoji-${suf}" style="width:56px;text-align:center;font-size:16px" value="${esc(preset?.emoji || '🎬')}" maxlength="4">
        <input class="ei" id="vr-preset-nombre-${suf}" style="flex:1" value="${esc(preset?.nombre || '')}" placeholder="Ej: Reel enérgico">
      </div>
      <input class="ei" id="vr-preset-descripcion-${suf}" style="width:100%;margin-top:8px" value="${esc(preset?.descripcion || '')}" placeholder="Para qué sirve (opcional)">
      <div style="display:grid;gap:8px;margin-top:8px">
        <div><label class="ce-lbl" style="display:flex;justify-content:space-between"><span>Expresividad</span><span id="vr-preset-temp-val-${suf}" class="muted">${Number(preset?.temperatura ?? 0.65).toFixed(2)}</span></label>
          <input type="range" id="vr-preset-temp-${suf}" min="0" max="1" step="0.05" value="${preset?.temperatura ?? 0.65}" style="width:100%" oninput="document.getElementById('vr-preset-temp-val-${suf}').textContent=Number(this.value).toFixed(2)"></div>
        <div><label class="ce-lbl" style="display:flex;justify-content:space-between"><span>Variación</span><span id="vr-preset-topp-val-${suf}" class="muted">${Number(preset?.top_p ?? 0.75).toFixed(2)}</span></label>
          <input type="range" id="vr-preset-topp-${suf}" min="0" max="1" step="0.05" value="${preset?.top_p ?? 0.75}" style="width:100%" oninput="document.getElementById('vr-preset-topp-val-${suf}').textContent=Number(this.value).toFixed(2)"></div>
        <div><label class="ce-lbl" style="display:flex;justify-content:space-between"><span>Velocidad</span><span id="vr-preset-vel-val-${suf}" class="muted">${Number(preset?.velocidad ?? 1.08).toFixed(2)}x</span></label>
          <input type="range" id="vr-preset-vel-${suf}" min="0.5" max="2" step="0.05" value="${preset?.velocidad ?? 1.08}" style="width:100%" oninput="document.getElementById('vr-preset-vel-val-${suf}').textContent=Number(this.value).toFixed(2)+'x'"></div>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="dbtn gh" data-vr-preset-guardar="${id}"><i class="fas fa-floppy-disk"></i> Guardar</button>
        <button class="dbtn gh" data-vr-preset-cancelar><i class="fas fa-xmark"></i> Cancelar</button>
      </div>
    </div>`;
}

function vrChipPreset(preset) {
  return `
    <div class="vr-preset" style="cursor:default;flex-direction:column;align-items:flex-start;gap:2px" title="${esc(preset.descripcion || '')}">
      <div style="display:flex;align-items:center;gap:6px">
        <span>${esc(preset.emoji)} ${esc(preset.nombre)}</span>
        <button class="dbtn gh" style="padding:1px 6px;font-size:10px" data-vr-preset-editar="${preset.id}"><i class="fas fa-pen"></i></button>
        <button class="dbtn gh" style="padding:1px 6px;font-size:10px" data-vr-preset-eliminar="${preset.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
}

function vrPintarPresets() {
  const cont = document.getElementById('vr-presets-lista');
  if (!cont) return;
  let html = '';
  if (vrEditandoPreset === 'nueva') html += vrFilaPresetForm(null);
  html += VR_PRESETS.map(p => vrEditandoPreset === String(p.id) ? vrFilaPresetForm(p) : vrChipPreset(p)).join('');
  cont.innerHTML = html || '<div class="muted" style="font-size:12.5px">Todavía no hay presets.</div>';
}

async function vrGuardarPreset(id) {
  const suf = id || 'nueva';
  const nombre = document.getElementById(`vr-preset-nombre-${suf}`)?.value.trim();
  if (!nombre) { errToast('Ponele un nombre al preset'); return; }
  const payload = {
    p_id: id ? Number(id) : null,
    p_nombre: nombre,
    p_emoji: document.getElementById(`vr-preset-emoji-${suf}`)?.value.trim() || '🎬',
    p_descripcion: document.getElementById(`vr-preset-descripcion-${suf}`)?.value.trim() || null,
    p_temperatura: Number(document.getElementById(`vr-preset-temp-${suf}`).value),
    p_top_p: Number(document.getElementById(`vr-preset-topp-${suf}`).value),
    p_velocidad: Number(document.getElementById(`vr-preset-vel-${suf}`).value),
    p_orden: 0,
    p_activo: true,
  };
  const { data, error } = await sb.rpc('voz_presets_guardar', payload);
  if (error || !data?.ok) { errToast('No se pudo guardar: ' + (error?.message || data?.error || '')); return; }
  okToast('Preset guardado');
  vrEditandoPreset = null;
  await vrCargarPresets();
}

async function vrEliminarPreset(id) {
  if (!(await confirmarSheet({ titulo: '¿Eliminar este preset?', textoOk: 'Eliminar', destructivo: true }))) return;
  const { data, error } = await sb.rpc('voz_presets_eliminar', { p_id: Number(id) });
  if (error || !data?.ok) { errToast('No se pudo eliminar: ' + (error?.message || data?.error || '')); return; }
  okToast('Preset eliminado');
  await vrCargarPresets();
}

// ---- Buscador de Fish Audio ------------------------------------------------

let VR_FISH_RESULTADOS = [];

async function vrFishBuscar() {
  const q = document.getElementById('vr-fish-q')?.value.trim();
  const cont = document.getElementById('vr-fish-resultados');
  const btn = document.getElementById('vr-fish-buscar');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
  const { data, error } = await sb.functions.invoke('voz-fish-buscar', { body: { q } });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-magnifying-glass"></i> Buscar';
  if (error || !data?.ok) { errToast('No se pudo buscar: ' + (await msgErrorFn(error, data))); return; }
  VR_FISH_RESULTADOS = data.voces || [];
  cont.innerHTML = VR_FISH_RESULTADOS.length
    ? VR_FISH_RESULTADOS.map((v, i) => `
        <div class="vr-fish-resultado">
          <div style="font-weight:700;font-size:13px">${esc(v.titulo)}</div>
          ${v.descripcion ? `<div class="muted" style="font-size:11px">${esc(v.descripcion.slice(0, 90))}</div>` : ''}
          ${v.muestra_url ? `<audio controls style="width:100%;height:32px" src="${esc(v.muestra_url)}"></audio>` : '<div class="muted" style="font-size:11px">Sin muestra disponible</div>'}
          <button class="dbtn gh" style="font-size:11.5px;padding:5px 9px" data-vr-fish-agregar="${i}"><i class="fas fa-plus"></i> Agregar al catálogo</button>
        </div>`).join('')
    : '<div class="muted" style="font-size:12.5px">Sin resultados -- probá con otro término.</div>';
}

function vrFishAgregar(indice) {
  const v = VR_FISH_RESULTADOS[Number(indice)];
  if (!v) return;
  vrEditandoVoz = 'nueva';
  vrPintarVoces();
  // Precarga el nombre + ID de Fish en el form recién abierto -- el resto
  // (color/emoji/prosodia) el admin lo elige a mano al confirmar.
  const nombreInput = document.getElementById('vr-voz-nombre-nueva');
  const fishInput = document.getElementById('vr-voz-fishid-nueva');
  const descInput = document.getElementById('vr-voz-descripcion-nueva');
  if (nombreInput) nombreInput.value = v.titulo;
  if (fishInput) fishInput.value = v.fish_model_id;
  if (descInput) descInput.value = v.descripcion || '';
  document.getElementById('vr-voz-nueva')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  okToast('Precargado -- revisá color/emoji y guardá para agregarla al catálogo');
}

async function vrCargarPerfiles() {
  const { data, error } = await sb.rpc('perfiles_voz_listar');
  if (error || !data?.ok) { errToast('No se pudieron cargar los perfiles: ' + (error?.message || data?.error || '')); return; }
  VR_PERFILES = data.perfiles || [];
  vrPintarPerfiles();
}

function vrOpcionesVoces(vozIdSeleccionada) {
  // La voz ya asignada se lista SIEMPRE, aunque esté inactiva -- si no, editar
  // un perfil cuya voz se desactivó mostraría el select vacío y guardar sin
  // querer le borraría la asignación (nadie tocó el select a propósito).
  const idSel = Number(vozIdSeleccionada) || null;
  const visibles = VR_VOCES.filter(v => v.activo || v.id === idSel);
  return `<option value="">Sin voz asignada</option>` + visibles.map(v =>
    `<option value="${v.id}" ${idSel === v.id ? 'selected' : ''}>${esc(v.nombre)}${v.activo ? '' : ' (inactiva)'}</option>`
  ).join('');
}

// Tarjeta de perfil en la lista -- click en cualquier parte abre el detalle,
// salvo el botón de basura (chequeado ANTES en la delegación, ver setupVozIA).
function vrTarjetaPerfil(perfil) {
  const voz = VR_VOCES.find(v => v.id === perfil.voz_id);
  const rgb = vrColorRgb(voz?.color);
  return `
    <div class="vr-card" style="--v-rgb:${rgb};padding:14px;text-align:center;cursor:pointer;position:relative${perfil.activo ? '' : ';opacity:.55'}" data-vr-abrir-perfil="${perfil.id}">
      <button class="dbtn gh" style="position:absolute;top:8px;right:8px;padding:3px 7px;font-size:10.5px" data-vr-eliminar-perfil="${perfil.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
      <div style="font-size:36px;line-height:1;margin-top:6px">${esc(perfil.avatar || '🎙️')}</div>
      <div style="margin-top:9px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(perfil.nombre)}</div>
      <div class="vr-chip vr-chip-color" style="margin-top:6px;display:inline-flex">${perfil.voz_nombre ? esc(perfil.voz_nombre) : 'Sin voz asignada'}</div>
      ${perfil.activo ? '' : '<div class="muted" style="font-size:10px;margin-top:3px">(inactivo)</div>'}
    </div>`;
}

function vrPintarPerfiles() {
  const cont = document.getElementById('vr-perfiles-lista');
  if (!cont) return;
  cont.innerHTML = VR_PERFILES.map(vrTarjetaPerfil).join('') ||
    '<div class="muted" style="font-size:12.5px">Todavía no hay perfiles -- creá el primero con "Nuevo perfil".</div>';
}

// ---- Vista de detalle: entrar a un perfil ------------------------------

function vrAbrirDetallePerfil(id) {
  vrPerfilDetalleId = String(id);
  const perfil = id === 'nuevo' ? null : VR_PERFILES.find(p => String(p.id) === String(id));
  vrPerfilDetalleAvatar = perfil?.avatar || '🎙️';
  vrTextoAntesDePuntuar = null;
  vrPresetSeleccionadoDetalle = null;
  VR_HISTORIAL = [];
  document.getElementById('vr-vista-lista').style.display = 'none';
  document.getElementById('vr-vista-detalle').style.display = '';
  vrPintarDetalle();
  if (id !== 'nuevo') vrCargarHistorial();
}

function vrVolverALista() {
  vrPerfilDetalleId = null;
  vrPerfilDetalleAvatar = null;
  vrTextoAntesDePuntuar = null;
  document.getElementById('vr-vista-lista').style.display = '';
  document.getElementById('vr-vista-detalle').style.display = 'none';
  vrCargarPerfiles();
}

function vrPintarDetalle() {
  const cont = document.getElementById('vr-vista-detalle');
  if (!cont) return;
  const esNuevo = vrPerfilDetalleId === 'nuevo';
  const perfil = esNuevo ? null : VR_PERFILES.find(p => String(p.id) === vrPerfilDetalleId);
  if (!esNuevo && !perfil) { vrVolverALista(); return; } // se borró en otro lado mientras se miraba
  const vozActual = VR_VOCES.find(v => v.id === perfil?.voz_id);
  const rgb = vrColorRgb(vozActual?.color);
  cont.innerHTML = `
    <button class="dbtn gh" id="vr-detalle-volver" style="padding:6px 10px;font-size:12.5px;margin-bottom:14px"><i class="fas fa-arrow-left"></i> Perfiles</button>
    <div class="vr-hero" style="--v-rgb:${rgb}">
      <div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap">
        <div style="text-align:center">
          <button class="dbtn gh vr-hero-avatar" id="vr-detalle-avatar-btn">${esc(vrPerfilDetalleAvatar)}</button>
          <div class="muted" style="font-size:11px;margin-top:5px">Cambiar ícono</div>
          <div id="vr-emoji-picker" style="display:none;margin-top:8px;position:absolute;z-index:5"></div>
        </div>
        <div style="flex:1;min-width:220px">
          <label class="ce-lbl">Nombre del perfil</label>
          <input class="ei" id="vr-detalle-nombre" style="width:100%" value="${esc(perfil?.nombre || '')}" placeholder="Ej: Cuenta Turismo Mérida">
          <label class="ce-lbl" style="margin-top:10px">Voz por defecto</label>
          <select class="ei" id="vr-detalle-voz" style="width:100%">${vrOpcionesVoces(perfil?.voz_id)}</select>
          <label style="margin-top:10px;display:flex;align-items:center;gap:6px;font-size:12.5px">
            <input type="checkbox" id="vr-detalle-activo" ${perfil?.activo !== false ? 'checked' : ''}> Activo
          </label>
          <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="dbtn" id="vr-detalle-guardar" style="background:var(--accent);border-color:var(--accent);color:#1a1000"><i class="fas fa-floppy-disk"></i> ${esNuevo ? 'Crear perfil' : 'Guardar cambios'}</button>
            ${esNuevo ? '' : '<button class="dbtn gh" id="vr-detalle-eliminar"><i class="fas fa-trash"></i> Eliminar</button>'}
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="padding:18px;margin-top:14px">
      <b style="font-size:14px"><i class="fas fa-wand-magic-sparkles"></i> Generar voz en off</b>
      <div class="muted" style="font-size:12px;margin-top:4px">Sintetiza con la voz elegida arriba (guardada o no) -- probá antes de confirmar si querés.</div>
      <textarea class="ei" id="vr-detalle-texto" rows="3" style="width:100%;resize:vertical;margin-top:10px" placeholder="Escribí el guion del video..."></textarea>
      <div id="vr-detalle-presets" style="margin-top:10px"></div>
      <div class="vr-accion-bar" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="dbtn gh" id="vr-detalle-puntuar" style="min-height:44px"><i class="fas fa-quote-right"></i> Arreglar puntuación</button>
        <button class="dbtn gh" id="vr-detalle-deshacer-puntuar" style="min-height:44px;display:none"><i class="fas fa-rotate-left"></i> Deshacer</button>
        <button class="dbtn" id="vr-detalle-generar" style="min-height:44px;background:var(--accent);border-color:var(--accent);color:#1a1000"><i class="fas fa-play"></i> Generar audio</button>
      </div>
      <div id="vr-detalle-audio" style="margin-top:10px"></div>
    </div>

    <div class="card" style="padding:18px;margin-top:14px">
      <b style="font-size:14px"><i class="fas fa-clock-rotate-left"></i> Historial de audios</b>
      <div class="muted" style="font-size:12px;margin-top:4px">Lo que ya generaste para este perfil -- reescuchá o descargá sin volver a generar.</div>
      <div id="vr-detalle-historial" style="margin-top:10px">${esNuevo ? '<div class="muted" style="font-size:12.5px">Guardá el perfil primero para que quede historial.</div>' : '<div class="muted" style="font-size:12.5px">Cargando...</div>'}</div>
    </div>`;
  vrPintarChipsDetalle();
}

// Chips de preset de la card "Generar voz en off" -- separado de
// vrPintarDetalle para poder refrescar solo esto cuando cambia la voz o el
// preset elegido, sin repintar (y perder el foco de) el resto del detalle.
function vrPintarChipsDetalle() {
  const cont = document.getElementById('vr-detalle-presets');
  if (!cont) return;
  const vozId = Number(document.getElementById('vr-detalle-voz')?.value);
  if (!vozId) { cont.innerHTML = ''; return; }
  cont.innerHTML = vrChipsPresets(vozId, vrPresetSeleccionadoDetalle, 'data-vr-elegir-preset');
}
function vrElegirPresetDetalle(presetId) {
  vrPresetSeleccionadoDetalle = presetId ? Number(presetId) : null;
  vrPintarChipsDetalle();
}

function vrFilaHistorial(item) {
  const fecha = new Date(item.creado_en);
  const fechaTxt = fecha.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) + ' ' + fecha.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
  const url = `https://fotos.destinoyeventoslotus360.com/${item.storage_path}`;
  const previa = item.texto.length > 60 ? item.texto.slice(0, 60) + '…' : item.texto;
  return `
    <div class="card" style="padding:10px 12px;margin-top:8px">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap">
        <div style="font-size:12px;color:var(--muted)">${esc(fechaTxt)} · ${esc(item.voz_nombre)}${item.preset_nombre ? ` · <span class="vr-chip" style="padding:1px 7px">${esc(item.preset_nombre)}</span>` : ''}</div>
        <button class="dbtn gh" style="padding:3px 8px;font-size:11px" data-vr-borrar-historial="${item.id}"><i class="fas fa-trash"></i></button>
      </div>
      <div style="font-size:12.5px;margin-top:4px">${esc(previa)}</div>
      <audio controls style="width:100%;margin-top:8px;height:36px" src="${esc(url)}"></audio>
      <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
        <a class="dbtn gh" style="padding:6px 10px;font-size:12px;min-height:36px" href="${esc(url)}" download="voz-redes-${item.id}.mp3"><i class="fas fa-download"></i> Descargar</a>
        ${navigator.share ? `<button class="dbtn gh" style="padding:6px 10px;font-size:12px;min-height:36px" data-vr-compartir="${esc(url)}"><i class="fas fa-share-nodes"></i> Compartir</button>` : ''}
      </div>
    </div>`;
}

async function vrCargarHistorial() {
  const cont = document.getElementById('vr-detalle-historial');
  if (!cont) return;
  const { data, error } = await sb.rpc('voz_redes_historial_listar', { p_perfil_id: Number(vrPerfilDetalleId) });
  if (error || !data?.ok) { cont.innerHTML = '<div class="muted" style="font-size:12.5px">No se pudo cargar el historial.</div>'; return; }
  VR_HISTORIAL = data.historial;
  cont.innerHTML = VR_HISTORIAL.length
    ? VR_HISTORIAL.map(vrFilaHistorial).join('')
    : '<div class="muted" style="font-size:12.5px">Todavía no generaste audio para este perfil.</div>';
}

async function vrBorrarHistorial(id) {
  const { data, error } = await sb.rpc('voz_redes_historial_eliminar', { p_id: Number(id) });
  if (error || !data?.ok) { errToast('No se pudo eliminar: ' + (error?.message || data?.error || '')); return; }
  vrCargarHistorial();
}

async function vrArreglarPuntuacion() {
  const textarea = document.getElementById('vr-detalle-texto');
  const texto = textarea?.value.trim();
  if (!texto) { errToast('Escribí un texto primero'); return; }
  const btn = document.getElementById('vr-detalle-puntuar');
  btn.disabled = true; btn.innerHTML = 'Arreglando... <i class="fas fa-spinner fa-spin"></i>';
  const { data, error } = await sb.functions.invoke('voz-texto-puntuar', { body: { texto } });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-quote-right"></i> Arreglar puntuación';
  if (error || !data?.ok) { errToast('No se pudo arreglar la puntuación: ' + (await msgErrorFn(error, data))); return; }
  if (data.sin_cambios) { okToast('El texto ya estaba bien puntuado, no hizo falta cambiar nada'); return; }
  vrTextoAntesDePuntuar = texto;
  textarea.value = data.texto_puntuado;
  document.getElementById('vr-detalle-deshacer-puntuar').style.display = '';
}

function vrDeshacerPuntuacion() {
  if (vrTextoAntesDePuntuar === null) return;
  const textarea = document.getElementById('vr-detalle-texto');
  if (textarea) textarea.value = vrTextoAntesDePuntuar;
  vrTextoAntesDePuntuar = null;
  document.getElementById('vr-detalle-deshacer-puntuar').style.display = 'none';
}

function vrToggleTutorial(mostrar) {
  const cont = document.getElementById('vr-tutorial');
  if (cont) cont.style.display = mostrar ? '' : 'none';
  if (mostrar) localStorage.setItem('vr_tutorial_visto', '1');
}

function vrTogglePicker() {
  const cont = document.getElementById('vr-emoji-picker');
  if (!cont) return;
  const abrir = cont.style.display === 'none';
  if (abrir) {
    cont.innerHTML = `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px;max-width:210px">${
      VR_EMOJIS.map(e => `<button class="dbtn gh" style="padding:6px;font-size:17px" data-vr-elegir-emoji="${e}">${e}</button>`).join('')
    }</div>`;
  }
  cont.style.display = abrir ? '' : 'none';
}

function vrElegirEmoji(emoji) {
  vrPerfilDetalleAvatar = emoji;
  const btn = document.getElementById('vr-detalle-avatar-btn');
  if (btn) btn.textContent = emoji;
  vrTogglePicker(); // cierra el picker
}

async function vrGuardarDetalle() {
  const nombre = document.getElementById('vr-detalle-nombre')?.value.trim();
  if (!nombre) { errToast('Ponele un nombre al perfil'); return; }
  const vozSel = document.getElementById('vr-detalle-voz').value;
  const btn = document.getElementById('vr-detalle-guardar');
  btn.disabled = true;
  const payload = {
    p_id: vrPerfilDetalleId === 'nuevo' ? null : Number(vrPerfilDetalleId),
    p_nombre: nombre,
    p_voz_id: vozSel ? Number(vozSel) : null,
    p_activo: document.getElementById('vr-detalle-activo').checked,
    p_avatar: vrPerfilDetalleAvatar || '🎙️',
  };
  const { data, error } = await sb.rpc('perfiles_voz_guardar', payload);
  btn.disabled = false;
  if (error || !data?.ok) { errToast('No se pudo guardar: ' + (error?.message || data?.error || '')); return; }
  okToast('Perfil guardado');
  await vrCargarPerfiles();
  vrPerfilDetalleId = String(data.id); // si era "nuevo", ya queda como existente
  vrPintarDetalle();
  vrCargarHistorial(); // si era "nuevo" recién ahora tiene id real -- sin esto el historial se queda en "Cargando..." para siempre
}

async function vrEliminarDetalle() {
  if (!(await confirmarSheet({ titulo: '¿Eliminar este perfil?', textoOk: 'Eliminar', destructivo: true }))) return;
  const { data, error } = await sb.rpc('perfiles_voz_eliminar', { p_id: Number(vrPerfilDetalleId) });
  if (error || !data?.ok) { errToast('No se pudo eliminar: ' + (error?.message || data?.error || '')); return; }
  okToast('Perfil eliminado');
  vrVolverALista();
}

async function vrEliminarPerfil(id) {
  if (!(await confirmarSheet({ titulo: '¿Eliminar este perfil?', textoOk: 'Eliminar', destructivo: true }))) return;
  const { data, error } = await sb.rpc('perfiles_voz_eliminar', { p_id: Number(id) });
  if (error || !data?.ok) { errToast('No se pudo eliminar: ' + (error?.message || data?.error || '')); return; }
  okToast('Perfil eliminado');
  await vrCargarPerfiles();
}

async function vrGenerarDetalle() {
  const vozId = document.getElementById('vr-detalle-voz')?.value;
  if (!vozId) { errToast('Elegí una voz primero'); return; }
  const texto = document.getElementById('vr-detalle-texto')?.value.trim();
  if (!texto) { errToast('Escribí un texto primero'); return; }
  const btn = document.getElementById('vr-detalle-generar');
  const out = document.getElementById('vr-detalle-audio');
  btn.disabled = true; btn.innerHTML = `<span class="vr-wave"><span></span><span></span><span></span><span></span></span> Generando...`;
  const body = { voz_id: Number(vozId), texto };
  if (vrPerfilDetalleId !== 'nuevo') body.p_perfil_id = Number(vrPerfilDetalleId);
  if (vrPresetSeleccionadoDetalle) body.preset_id = vrPresetSeleccionadoDetalle;
  const { data, error } = await sb.functions.invoke('voz-perfil-probar', { body });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> Generar audio';
  if (error || !data?.ok) { errToast('No se pudo generar: ' + (await msgErrorFn(error, data))); return; }
  out.innerHTML = `
    <audio controls autoplay style="width:100%" src="${esc(data.audio_url)}"></audio>
    ${data.preset_nombre ? `<div class="vr-chip" style="margin-top:8px;display:inline-flex">${esc(data.preset_nombre)}</div>` : ''}
    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
      <a class="dbtn gh" style="padding:6px 10px;font-size:12.5px;min-height:44px" href="${esc(data.audio_url)}" download="voz-redes.mp3"><i class="fas fa-download"></i> Descargar</a>
      ${navigator.share ? `<button class="dbtn gh" style="padding:6px 10px;font-size:12.5px;min-height:44px" data-vr-compartir="${esc(data.audio_url)}"><i class="fas fa-share-nodes"></i> Compartir</button>` : ''}
    </div>`;
  if (vrPerfilDetalleId !== 'nuevo') vrCargarHistorial();
}

async function vrCompartirAudio(url) {
  try { await navigator.share({ url, title: 'Nota de voz' }); } catch (e) { /* usuario canceló, no es error */ }
}

/* ---------- Web y Reasignados (comisiones del dueño por origen del lead) ----
   Los dos orígenes por los que cobra comisión, juntos. Un lead que entró por la
   web Y además se reasignó aparece UNA vez marcado "Ambos": contarlo en las dos
   listas inflaría el total justo en la pantalla que se usa para cobrar. */
let WR_DATOS = null, wrFiltro = 'todos', wrBusqueda = '', wrView = 'lista';
// Selección para el marcado masivo -- Set aparte de SELECTED_LEADS (la de
// Leads) porque son dos pantallas y dos acciones distintas conviviendo en el
// mismo momento no deberían pisarse. Compartida entre las dos vistas (tabla y
// tarjetas): cambiar de vista no debe perder lo ya tildado.
const WR_SELECTED = new Set();

const WR_ORIGEN = {
  web:        { txt: 'Web',       clase: 'ig' },
  reasignado: { txt: 'Reasignado', clase: 'fb' },
  ambos:      { txt: 'Ambos',     clase: 'am' },
  rescatado:  { txt: 'Rescatado', clase: 'am' },
};

function setupWebReasignados() {
  document.getElementById('wr-recargar').onclick = loadWebReasignados;
  document.getElementById('wr-guardar-pct').onclick = wrGuardarPct;
  document.querySelectorAll('[data-wr-filtro]').forEach(b => b.onclick = () => wrIrAFiltro(b.dataset.wrFiltro));
  document.getElementById('wr-buscar').addEventListener('input', e => {
    wrBusqueda = e.target.value.trim().toLowerCase();
    wrPintarTabla();
  });
  // Móvil arranca en tarjetas (mismo criterio que Leads: una tabla angosta a
  // fuerza de columnas apretadas se lee peor que una ficha por cliente).
  wrView = initViewSwitcher('wr-view-switch', 'web-reasignados', window.innerWidth <= 760 ? 'tarjetas' : 'lista', v => {
    wrView = v;
    applyWrView();
  }, ['tarjetas', 'lista']);
  document.getElementById('wr-select-all').addEventListener('change', e => {
    const visibles = wrFilasVisibles().map(f => f.id);
    visibles.forEach(id => e.target.checked ? WR_SELECTED.add(id) : WR_SELECTED.delete(id));
    wrPintarTabla();
  });
  document.getElementById('wr-bulk-clear').onclick = () => { WR_SELECTED.clear(); wrPintarTabla(); };
  document.getElementById('wr-bulk-agregar').onclick = () => wrMarcar([...WR_SELECTED], true);
  document.getElementById('wr-bulk-quitar').onclick = () => wrMarcar([...WR_SELECTED], false);
}

// Botón de filtro Y KPI clickeable llevan a la misma pestaña -- un solo lugar
// que decide el filtro, para que las dos entradas nunca queden desincronizadas.
function wrIrAFiltro(clave) {
  document.querySelectorAll('[data-wr-filtro]').forEach(x => x.classList.toggle('on', x.dataset.wrFiltro === clave));
  document.querySelectorAll('#wr-kpis [data-kpi-key]').forEach(x => x.classList.toggle('kpi-on', x.dataset.kpiKey === clave));
  wrFiltro = clave;
  wrPintarTabla();
  document.getElementById('wr-tbl-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function wrFilasVisibles() {
  const todas = WR_DATOS?.filas || [];
  const q = wrBusqueda;
  return todas.filter(f => {
    const pasaFiltro =
      wrFiltro === 'todos' ? true
      : wrFiltro === 'vendidos' ? f.monto_total != null
      : wrFiltro === 'comisiones' ? f.en_manual
      // "Solo web" y "Solo reasignados" incluyen a los que son ambos: quien filtra
      // por web quiere ver todo lo que entró por la web, no lo que entró por la
      // web y encima nunca se reasignó.
      : wrFiltro === 'web' ? (f.origen === 'web' || f.origen === 'ambos')
      : wrFiltro === 'reasignado' ? (f.origen === 'reasignado' || f.origen === 'ambos')
      : f.rescatado === true;
    if (!pasaFiltro) return false;
    if (!q) return true;
    return (f.nombre || '').toLowerCase().includes(q) || (f.telefono || '').toLowerCase().includes(q);
  });
}

function applyWrView() {
  const tabla = document.getElementById('wr-tbl-wrap'), cards = document.getElementById('wr-cards');
  tabla.classList.toggle('hide', wrView !== 'lista');
  cards.classList.toggle('show', wrView !== 'lista');
}

async function loadWebReasignados() {
  const body = document.getElementById('wr-body');
  body.innerHTML = '<tr><td colspan="8" class="muted">Cargando…</td></tr>';
  const { data, error } = await sb.rpc('comisiones_origen_panel');
  if (error || !data) {
    body.innerHTML = `<tr><td colspan="8" class="muted">No se pudo cargar: ${esc(error?.message || '')}</td></tr>`;
    return;
  }
  WR_DATOS = data;
  document.getElementById('wr-pct').value = data.pct ?? 5;
  const r = data.resumen || {};
  // Las 3 primeras llevan a su pestaña equivalente (mismo filtro que el botón
  // de arriba); "Vendido"/"Mi comisión" son montos, no un subconjunto propio
  // (son el mismo grupo que "Ya vendidos"), así que no tienen acción aparte.
  pintarKPIs('wr-kpis', [
    { t: 'Leads en total', v: fmt(r.total || 0), d: `${fmt(r.web || 0)} web · ${fmt(r.reasignados || 0)} reasignados · ${fmt(r.rescatados || 0)} rescatados`, i: 'fa-users', c: 'var(--blue)', go: () => wrIrAFiltro('todos'), key: 'todos', on: wrFiltro === 'todos' },
    { t: 'Rescatados por IA', v: fmt(r.rescatados || 0), d: 'Respondieron al seguimiento final con teléfono válido', i: 'fa-life-ring', c: '#14b8a6', go: () => wrIrAFiltro('rescatados'), key: 'rescatados', on: wrFiltro === 'rescatados' },
    { t: 'Ya vendidos', v: fmt(r.vendidos || 0), d: r.vendidos ? 'Con factura emitida' : 'Todavía ninguno cerró', i: 'fa-circle-check', c: 'var(--green)', go: () => wrIrAFiltro('vendidos'), key: 'vendidos', on: wrFiltro === 'vendidos' },
    { t: 'Vendido', v: '$' + fmt(r.monto_vendido || 0), d: 'Suma de las facturas', i: 'fa-receipt', c: 'var(--purple)' },
    { t: 'Mi comisión', v: '$' + fmt(r.mi_comision_total || 0), d: `Al ${data.pct}% de lo vendido`, i: 'fa-hand-holding-dollar', c: 'var(--accent)' },
    { t: 'Comisiones Bwrathanyel', v: fmt(r.comisiones_bwrathanyel || 0), d: 'Marcados a mano', i: 'fa-star', c: 'var(--yellow, #eab308)', go: () => wrIrAFiltro('comisiones'), key: 'comisiones', on: wrFiltro === 'comisiones' },
  ]);
  // Un lead sacado de la lista mientras estaba seleccionado (o vendido/filtrado
  // fuera) no debe seguir contando para la barra de selección.
  const idsVigentes = new Set((data.filas || []).map(f => f.id));
  [...WR_SELECTED].forEach(id => { if (!idsVigentes.has(id)) WR_SELECTED.delete(id); });
  wrPintarTabla();
}

// Tarjeta para la vista "tarjetas" -- mismo lenguaje visual que las fichas de
// Leads (.entity-card/.ec-*), pensado para mobile: toda la info del cliente
// en un bloque solo, sin scroll horizontal ni columnas apretadas. El checkbox
// y la estrella cortan la propagación del click para no abrir la ficha por
// error al tildar/marcar.
function wrCardHtml(f) {
  const o = WR_ORIGEN[f.origen] || WR_ORIGEN.web;
  const vendido = f.monto_total != null;
  return `<div class="entity-card wr-card" data-wr-id="${f.id}" style="position:relative">
    <input type="checkbox" class="wr-check" data-id="${f.id}" ${WR_SELECTED.has(f.id) ? 'checked' : ''}
      style="position:absolute;top:12px;right:12px;width:18px;height:18px" onclick="event.stopPropagation()">
    <div class="ec-top"><div class="ec-nombre">${esc(f.nombre || 'Sin nombre')}</div></div>
    ${f.telefono ? `<div class="ec-row"><i class="fas fa-phone"></i> ${esc(f.telefono)}</div>` : ''}
    <div class="ec-row"><i class="fas fa-location-dot"></i> ${esc(f.destino || '—')}</div>
    <div class="ec-row"><i class="fas fa-user-tie"></i> ${esc(f.asesor || '—')}</div>
    <div class="ec-row"><i class="fas fa-flag"></i> ${esc(f.estado || '—')}</div>
    <div class="ec-foot ec-foot-cols">
      <div class="ec-badges">
        <span class="chip ${o.clase}">${o.txt}</span>${f.rescatado ? ' <span class="badge-st" style="color:#2dd4bf;background:#0f766e2e" title="Respondió al seguimiento final de la IA y compartió un teléfono válido"><i class="fas fa-life-ring"></i> Lead rescatado</span>' : ''}
        ${vendido ? `<span class="badge-st" style="color:#10b981;background:#10b9812e">$${fmt(f.monto_total)} vendido</span>
          <span class="badge-st" style="color:var(--accent);background:var(--accent-soft)">$${fmt(f.mi_comision)} mi comisión</span>` : ''}
      </div>
      <div class="ec-actions" style="align-self:flex-end">
        <button type="button" class="ce-mini wr-marcar" data-id="${f.id}" data-en="${f.en_manual ? '1' : '0'}" onclick="event.stopPropagation()"
          title="${f.en_manual ? 'Sacar de Comisiones Bwrathanyel' : 'Mandar a Comisiones Bwrathanyel'}">
          <i class="fas ${f.en_manual ? 'fa-star' : 'fa-star-half-stroke'}"></i></button>
      </div>
    </div>
  </div>`;
}

function wrPintarTabla() {
  const body = document.getElementById('wr-body');
  const cardsBox = document.getElementById('wr-cards');
  const todas = WR_DATOS?.filas || [];
  const filas = wrFilasVisibles();

  if (!filas.length) {
    const vacio = todas.length ? 'Ningún lead con ese filtro/búsqueda.' : 'Todavía no hay leads de estos dos orígenes.';
    body.innerHTML = `<tr><td colspan="8" class="muted">${vacio}</td></tr>`;
    cardsBox.innerHTML = `<div class="vig-vacio" style="grid-column:1/-1">${vacio}</div>`;
    wrActualizarBulkBar();
    return;
  }
  body.innerHTML = filas.map(f => {
    const o = WR_ORIGEN[f.origen] || WR_ORIGEN.web;
    const vendido = f.monto_total != null;
    return `<tr class="wr-row" data-wr-id="${f.id}">
      <td><input type="checkbox" class="wr-check" data-id="${f.id}" ${WR_SELECTED.has(f.id) ? 'checked' : ''}></td>
      <td class="td-name" style="cursor:pointer">${esc(f.nombre || 'Sin nombre')}
        ${f.telefono ? `<small class="muted" style="display:block">${esc(f.telefono)}</small>` : ''}</td>
      <td data-label="Origen"><span class="chip ${o.clase}">${o.txt}</span>${f.rescatado ? ' <span class="badge-st" style="color:#2dd4bf;background:#0f766e2e" title="Respondió al seguimiento final de la IA y compartió un teléfono válido">Rescatado</span>' : ''}</td>
      <td data-label="Destino" class="muted">${esc(f.destino || '—')}</td>
      <td data-label="Estado">${esc(f.estado || '—')}</td>
      <td data-label="Asesor" class="muted">${esc(f.asesor || '—')}</td>
      <td data-label="Venta">${vendido ? '$' + fmt(f.monto_total) : '<span class="muted">—</span>'}</td>
      <td data-label="Mi comisión">${vendido ? `<b>$${fmt(f.mi_comision)}</b>` : '<span class="muted">—</span>'}</td>
      <td><button type="button" class="ce-mini wr-marcar" data-id="${f.id}" data-en="${f.en_manual ? '1' : '0'}"
        title="${f.en_manual ? 'Sacar de Comisiones Bwrathanyel' : 'Mandar a Comisiones Bwrathanyel'}">
        <i class="fas ${f.en_manual ? 'fa-star' : 'fa-star-half-stroke'}"></i></button></td>
    </tr>`;
  }).join('');
  cardsBox.innerHTML = filas.map(wrCardHtml).join('');

  // Abre la ficha completa del cliente, mismo drawer que usan Leads y
  // Facturación -- reusa abrirClienteDesdeFacturacion porque acá tampoco hay
  // ya cargada la fila completa de `leads` (comisiones_origen_panel solo trae
  // los campos que necesita el panel, no la ficha entera). En la tabla, solo
  // la celda del nombre abre la ficha; en la tarjeta, toda la tarjeta (el
  // checkbox y la estrella cortan la propagación en su propio onclick).
  document.querySelectorAll('#wr-body .wr-row .td-name').forEach(td => {
    td.addEventListener('click', () => window.abrirClienteDesdeFacturacion(Number(td.closest('tr').dataset.wrId)));
  });
  document.querySelectorAll('#wr-cards .wr-card').forEach(card => {
    card.addEventListener('click', () => window.abrirClienteDesdeFacturacion(Number(card.dataset.wrId)));
  });
  document.querySelectorAll('#wr-body .wr-check, #wr-cards .wr-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = Number(cb.dataset.id);
      if (cb.checked) WR_SELECTED.add(id); else WR_SELECTED.delete(id);
      // Las dos vistas comparten la misma selección: si el mismo id aparece en
      // ambas (tabla oculta + tarjeta visible), la casilla gemela tiene que
      // reflejar el cambio aunque no esté a la vista ahora mismo.
      document.querySelectorAll(`[data-id="${id}"].wr-check`).forEach(otro => { otro.checked = cb.checked; });
      wrActualizarBulkBar();
    });
  });
  document.querySelectorAll('#wr-body .wr-marcar, #wr-cards .wr-marcar').forEach(btn => {
    btn.addEventListener('click', () => wrMarcar([Number(btn.dataset.id)], btn.dataset.en !== '1'));
  });
  wrActualizarBulkBar();
  applyWrView();
}

function wrActualizarBulkBar() {
  const bar = document.getElementById('wr-bulk-bar');
  const n = WR_SELECTED.size;
  bar.style.display = n > 0 ? 'flex' : 'none';
  document.getElementById('wr-bulk-count').textContent = `${n} seleccionado${n === 1 ? '' : 's'}`;
  // Dentro de la pestaña "Comisiones Bwrathanyel" lo que se hace con lo
  // seleccionado es sacarlo, no volver a agregarlo -- en cualquier otra
  // pestaña es al revés.
  document.getElementById('wr-bulk-agregar').style.display = wrFiltro === 'comisiones' ? 'none' : '';
  document.getElementById('wr-bulk-quitar').style.display = wrFiltro === 'comisiones' ? '' : 'none';
  const ids = wrFilasVisibles().map(f => f.id);
  const selectAll = document.getElementById('wr-select-all');
  if (selectAll) selectAll.checked = ids.length > 0 && ids.every(id => WR_SELECTED.has(id));
}

async function wrMarcar(ids, activo) {
  if (!ids.length) return;
  const { error } = await sb.rpc('comisiones_manuales_set', { p_lead_ids: ids, p_activo: activo });
  if (error) { errToast('No se pudo actualizar: ' + error.message); return; }
  okToast(activo
    ? `${ids.length} lead${ids.length === 1 ? '' : 's'} marcado${ids.length === 1 ? '' : 's'} en Comisiones Bwrathanyel`
    : `${ids.length} lead${ids.length === 1 ? '' : 's'} sacado${ids.length === 1 ? '' : 's'} de Comisiones Bwrathanyel`);
  ids.forEach(id => WR_SELECTED.delete(id));
  loadWebReasignados();
}

async function wrGuardarPct() {
  const pct = parseFloat(document.getElementById('wr-pct').value);
  if (!(pct >= 0 && pct <= 100)) { errToast('El porcentaje tiene que estar entre 0 y 100'); return; }
  const { error } = await sb.rpc('guardar_comision_origen_pct', { p_pct: pct });
  if (error) { errToast('No se pudo guardar: ' + error.message); return; }
  okToast(`Comisión guardada en ${pct}%`);
  loadWebReasignados();
}

/* ---------- Stop Sales (disponibilidad de hoteles, BT Travel) ----------
   Dos pasos SIEMPRE, nunca uno solo (mismo principio que "Cargar flyer"): el
   PDF se lee y se muestra, una persona lo revisa y recién ahí se confirma.
   La lectura no usa IA -- lee directo el color de cada celda del PDF (ver
   supabase/functions/_shared/stop_sales_parser.ts), así que lo único que puede
   fallar es el cruce de nombres BT -> hotel real, que por eso queda a mano. */
let SS_DATA = null;          // último resultado de 'leer', sin publicar todavía
let SS_MAPEOS = {};          // bt_nombre -> producto_id elegido en ESTA carga (null = "no lo tengo")
let SS_PRODUCTOS_CACHE = null;
let SS_ARCHIVO_ACTUAL = null; // el File tal cual se eligió -- se sube al bucket recién al publicar, no al leer
let SS_PDF_ACTUAL = null;    // { storage_path, creado_en, creado_por } del último PDF publicado, cacheado

function setupStopSales() {
  // Cargar/mapear/publicar sigue siendo solo admin (decidido 2026-08-06: la
  // lectura de "vigentes hoy" se abrió a todo rol, la escritura no). La
  // sección en sí ya no es nav-admin-only -- se esconde acá adentro, no en el
  // menú, para que cualquier rol pueda entrar y ver los bloqueos vigentes.
  const adminBox = document.getElementById('ss-admin-box');
  if (adminBox) adminBox.style.display = ROL === 'admin' ? '' : 'none';

  document.getElementById('ss-file').addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) ssLeer(f);
    e.target.value = '';
  });
  document.getElementById('ss-vig-buscar')?.addEventListener('input', () => ssRenderVigentes());
  document.getElementById('ss-ver-pdf')?.addEventListener('click', ssVerPdfOriginal);
}

// El botón "Ver PDF original" es para TODO rol (no vive dentro de
// #ss-admin-box) -- es justo lo que permite confiar en lo que el parser leyó
// sin tener que ser admin ni pedirle el archivo a nadie por WhatsApp.
async function ssCargarPdfActual() {
  const btn = document.getElementById('ss-ver-pdf');
  const meta = document.getElementById('ss-pdf-meta');
  if (!btn) return;
  const { data, error } = await sb.rpc('stop_sales_pdf_actual');
  const fila = !error && Array.isArray(data) ? data[0] : null;
  SS_PDF_ACTUAL = fila || null;
  btn.disabled = !SS_PDF_ACTUAL;
  meta.textContent = SS_PDF_ACTUAL
    ? `Última carga: ${fmtDiaCorto(SS_PDF_ACTUAL.creado_en.slice(0, 10))}${SS_PDF_ACTUAL.creado_por ? ` — ${SS_PDF_ACTUAL.creado_por}` : ''}`
    : 'Todavía no se cargó ningún PDF.';
}

async function ssVerPdfOriginal() {
  if (!SS_PDF_ACTUAL) return;
  const btn = document.getElementById('ss-ver-pdf');
  btn.disabled = true;
  // Bucket privado -- URL firmada de corta duración, mismo patrón que
  // verVoucherPdf (no getPublicUrl, que serviría el archivo para siempre a
  // cualquiera con el link).
  const { data, error } = await sb.storage.from('stop-sales-pdfs').createSignedUrl(SS_PDF_ACTUAL.storage_path, 60);
  btn.disabled = false;
  if (error || !data?.signedUrl) { errToast('No se pudo abrir el PDF: ' + (error?.message || '')); return; }
  window.open(data.signedUrl, '_blank');
}

async function ssProductosHotel() {
  if (SS_PRODUCTOS_CACHE) return SS_PRODUCTOS_CACHE;
  const { data, error } = await sb.from('productos').select('id,nombre,destino').eq('tipo', 'hotel').eq('activo', true).order('nombre');
  if (error) { errToast('No se pudo cargar la lista de hoteles: ' + error.message); return []; }
  SS_PRODUCTOS_CACHE = data || [];
  return SS_PRODUCTOS_CACHE;
}

async function ssLeer(file) {
  SS_ARCHIVO_ACTUAL = file;
  const drop = document.getElementById('ss-drop');
  const preview = document.getElementById('ss-preview');
  const mapeoBox = document.getElementById('ss-mapeo');
  const alertaBox = document.getElementById('ss-alerta');
  document.getElementById('ss-publicar-box').style.display = 'none';
  mapeoBox.innerHTML = ''; alertaBox.innerHTML = '';
  drop.classList.add('cargando');
  preview.innerHTML = `<div class="cp-pensando"><i class="fas fa-circle-notch fa-spin"></i> Leyendo el PDF…</div>`;

  let base64;
  try { base64 = await archivoABase64(file); }
  catch (e) { drop.classList.remove('cargando'); preview.innerHTML = ''; errToast('No se pudo leer el archivo: ' + e.message); return; }

  const { data, error } = await sb.functions.invoke('stop-sales-leer', {
    body: { accion: 'leer', pdf_base64: base64, nombre_archivo: file.name },
  });
  drop.classList.remove('cargando');
  if (error || !data?.ok) {
    preview.innerHTML = `<div class="vig-vacio" style="text-align:left"><b>No se pudo leer el PDF.</b>
      <div style="font-size:12.5px;margin-top:6px">${esc(data?.detalle || data?.error || error?.message || '')}</div></div>`;
    return;
  }

  SS_DATA = data;
  SS_MAPEOS = {};
  for (const bt of data.sin_mapear) SS_MAPEOS[bt] = undefined; // undefined = todavía sin elegir

  if (data.alerta_cobertura) {
    alertaBox.innerHTML = `<div class="vig-vacio" style="text-align:left;border-color:#f59e0b66;background:#f59e0b14">
      <i class="fas fa-triangle-exclamation" style="color:#f59e0b"></i> <b>${esc(data.alerta_cobertura)}</b></div>`;
  }

  if (data.sin_mapear.length) await ssPintarMapeo();
  ssPintarPreview();
  ssActualizarBotonPublicar();
}

// Badge de color semántico real (no la coincidencia forzada de .chip.fb/.chip.am
// que se usaba antes -- esas clases son de Facebook/Ads en otro contexto). Mismo
// tono rojo que ESTADO_COLORS.PERDIDO para stop_sale, ámbar para on_request.
function ssBadge(estado) {
  const stop = estado === 'stop_sale';
  const color = stop ? '#ef4444' : '#e0a030';
  return `<span class="badge-st" style="color:${color};background:${color}2e">${stop ? 'Stop sale' : 'On request'}</span>`;
}

// Días restantes hasta fecha_hasta (redondeado al día, sin hora) -- solo para
// dar urgencia visual ("termina mañana"), no necesita precisión de huso horario.
function ssDiasRestantes(fechaHasta) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaHasta + 'T00:00:00');
  return Math.round((fin - hoy) / 86400000);
}

function ssTextoCuando(dias) {
  if (dias <= 0) return 'termina hoy';
  if (dias === 1) return 'termina mañana';
  return `termina en ${dias} día(s)`;
}

async function ssPintarMapeo() {
  const box = document.getElementById('ss-mapeo');
  const hoteles = await ssProductosHotel();
  box.innerHTML = `<div class="card" style="margin-top:12px">
    <h2><i class="fas fa-link"></i> Hoteles nuevos -- confirmá a qué hotel del tarifario corresponde cada uno</h2>
    <div class="csub">Se recuerda para la próxima carga. "No lo tengo" también se recuerda, así no se vuelve a preguntar por un hotel que no vendemos.</div>
    <div id="ss-mapeo-filas" style="margin-top:12px;display:flex;flex-direction:column;gap:10px"></div>
  </div>`;
  const filas = document.getElementById('ss-mapeo-filas');
  filas.innerHTML = SS_DATA.sin_mapear.map((bt) => {
    const candidatos = SS_DATA.candidatos[bt] || [];
    const idsCandidatos = new Set(candidatos.map((c) => c.producto_id));
    const opciones = [
      `<option value="">— elegí un hotel —</option>`,
      ...candidatos.map((c) => `<option value="${c.producto_id}">★ ${esc(c.nombre)}${c.destino ? ` (${esc(c.destino)})` : ''}</option>`),
      candidatos.length ? `<option disabled>──────────</option>` : '',
      ...hoteles.filter((h) => !idsCandidatos.has(h.id)).map((h) => `<option value="${h.id}">${esc(h.nombre)}${h.destino ? ` (${esc(h.destino)})` : ''}</option>`),
      `<option disabled>──────────</option>`,
      `<option value="ninguno">No lo tengo / no corresponde a ningún hotel nuestro</option>`,
    ].join('');
    return `<div class="vig-item">
      <div class="vig-top"><div class="vig-nombre">${esc(bt)}</div><span class="vig-tipo">Sin mapear</span></div>
      <select class="ei" data-ss-mapeo="${esc(bt)}" style="margin-top:8px">${opciones}</select>
    </div>`;
  }).join('');
  filas.querySelectorAll('[data-ss-mapeo]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const bt = sel.dataset.ssMapeo;
      SS_MAPEOS[bt] = sel.value === '' ? undefined : sel.value === 'ninguno' ? null : Number(sel.value);
      ssActualizarBotonPublicar();
    });
  });
}

// Agrupa filas sueltas (de cualquier fuente: previa del PDF o vigentes en base)
// por el nombre de hotel, ordena cada grupo por fecha y decide el "peor" estado
// del grupo (si tiene algún stop_sale, el grupo entero se trata como grave aunque
// también tenga rangos on_request) -- mismo criterio en previa y en vigentes, para
// que las dos pantallas se lean igual.
function ssAgruparPorHotel(filas, campoNombre) {
  const mapa = new Map();
  for (const f of filas) {
    const nombre = f[campoNombre];
    if (!mapa.has(nombre)) mapa.set(nombre, []);
    mapa.get(nombre).push(f);
  }
  return [...mapa.entries()].map(([nombre, rangos]) => {
    rangos.sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde));
    return {
      nombre, rangos,
      peor: rangos.some((r) => r.estado === 'stop_sale') ? 'stop_sale' : 'on_request',
      urgente: rangos.some((r) => ssDiasRestantes(r.fecha_hasta) <= 1),
    };
  }).sort((a, b) => (a.peor === b.peor ? a.nombre.localeCompare(b.nombre) : a.peor === 'stop_sale' ? -1 : 1));
}

// Tarjeta desplegable de un hotel para la PREVIA del PDF (antes de publicar):
// resumen visible aunque esté plegada (nombre + cantidad + peor estado en el
// ícono), y abierta por defecto si tiene algún stop_sale -- así una carga con
// varios hoteles no es un muro de texto, pero lo urgente salta a la vista.
function ssTarjetaHotelPreview(g) {
  const grave = g.peor === 'stop_sale';
  return `<details class="dsec" ${grave ? 'open' : ''} style="margin-bottom:8px">
    <summary><i class="fas ${grave ? 'fa-ban' : 'fa-clock'} dsec-ic" style="color:${grave ? '#ef4444' : '#e0a030'}"></i> ${esc(g.nombre)}
      <span class="vig-tipo">${g.rangos.length}</span>
      <i class="fas fa-chevron-down dsec-arrow"></i></summary>
    <div class="dsec-body">
      ${g.rangos.map((r) => `<div class="vig-texto" style="display:flex;align-items:center;gap:8px;padding:3px 0;flex-wrap:wrap">
        ${ssBadge(r.estado)}<span>${fmtDiaCorto(r.fecha_desde)} → ${fmtDiaCorto(r.fecha_hasta)}</span>
        ${r.problemas?.length ? `<i class="fas fa-triangle-exclamation" style="color:#f59e0b" title="${esc(r.problemas.join(', '))}"></i>` : ''}
      </div>`).join('')}
    </div>
  </details>`;
}

function ssPintarPreview() {
  const box = document.getElementById('ss-preview');
  const filas = SS_DATA.paginas.flatMap((p) => p.filas);
  const grupos = ssAgruparPorHotel(filas, 'hotel');
  const hotelesStop = grupos.filter((g) => g.peor === 'stop_sale').length;
  const hotelesOnRequest = grupos.length - hotelesStop;

  box.innerHTML = `<div class="card" style="margin-top:12px">
    <h2><i class="fas fa-table-cells"></i> Lo que se leyó del PDF</h2>
    <div class="csub">Compará contra el PDF original antes de confirmar. Tocá un hotel para ver sus fechas.</div>
    <div class="vig-resumen" style="margin-top:12px">
      <div class="vig-kpi"><b>${filas.length}</b><span>Bloqueo(s)</span></div>
      <div class="vig-kpi ${hotelesStop ? 'grave' : ''}"><b>${hotelesStop}</b><span>Hoteles en stop sale</span></div>
      <div class="vig-kpi ${hotelesOnRequest ? 'aviso' : ''}"><b>${hotelesOnRequest}</b><span>Hoteles en on request</span></div>
    </div>
    <div style="margin-top:14px">${grupos.map(ssTarjetaHotelPreview).join('')}</div>
  </div>`;
}

function ssActualizarBotonPublicar() {
  const faltan = SS_DATA.sin_mapear.filter((bt) => SS_MAPEOS[bt] === undefined);
  const box = document.getElementById('ss-publicar-box');
  const btn = document.getElementById('ss-publicar');
  box.style.display = SS_DATA ? '' : 'none';
  if (faltan.length) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-hourglass-half"></i> Faltan ${faltan.length} hotel(es) por confirmar arriba`;
  } else {
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-check"></i> Confirmar y publicar`;
  }
}

document.getElementById('ss-publicar')?.addEventListener('click', ssPublicar);

async function ssPublicar() {
  if (!SS_DATA) return;
  const btn = document.getElementById('ss-publicar');
  btn.disabled = true; btn.innerHTML = 'Publicando... <i class="fas fa-spinner fa-spin"></i>';

  // 1) Confirmar los mapeos nuevos de esta carga (incluye "no lo tengo" = null).
  for (const bt of SS_DATA.sin_mapear) {
    const pid = SS_MAPEOS[bt];
    const { error } = await sb.rpc('stop_sales_mapeo_confirmar', { p_bt_nombre: bt, p_producto_id: pid });
    if (error) { errToast(`No se pudo confirmar "${bt}": ` + error.message); btn.disabled = false; ssActualizarBotonPublicar(); return; }
  }

  // 2) Resolver producto_id final por fila (mapeo ya existente + lo recién
  //    confirmado) y armar las filas a publicar -- las de hoteles marcados
  //    "no lo tengo" (producto_id null) se excluyen, no se inventan.
  const mapeoTotal = { ...SS_DATA.mapeo_existente, ...SS_MAPEOS };
  const filas = [];
  for (const p of SS_DATA.paginas) {
    for (const f of p.filas) {
      const pid = mapeoTotal[f.hotel];
      if (pid == null) continue;
      filas.push({ producto_id: pid, fecha_desde: f.fecha_desde, fecha_hasta: f.fecha_hasta, estado: f.estado });
    }
  }

  const cargaId = crypto.randomUUID();

  // 3) Guardar el PDF original en el bucket ANTES de publicar -- así, si la
  //    subida falla, no se escribe nada en stop_sales (falla cerrado). Si
  //    publicar falla después de subir bien, queda un PDF huérfano en el
  //    bucket -- inofensivo, mismo criterio de tolerancia que el resto del
  //    proyecto (ver reemplazarFoto/subirAvatar). Sirve para que cualquier
  //    usuario pueda abrir el archivo fuente y comparar contra lo leído --
  //    pedido real (2026-08-06): "por si no confían la pestaña los primeros
  //    días".
  let storagePath = null;
  if (SS_ARCHIVO_ACTUAL) {
    storagePath = `${cargaId}.pdf`;
    const { error: eUpload } = await sb.storage.from('stop-sales-pdfs').upload(storagePath, SS_ARCHIVO_ACTUAL, { contentType: 'application/pdf' });
    if (eUpload) { errToast('No se pudo guardar el PDF original: ' + eUpload.message); btn.disabled = false; ssActualizarBotonPublicar(); return; }
  }

  const { data, error } = await sb.rpc('stop_sales_publicar', { p_filas: filas, p_carga_id: cargaId, p_storage_path: storagePath });
  btn.disabled = false;
  if (error) { errToast('No se pudo publicar: ' + error.message); ssActualizarBotonPublicar(); return; }

  okToast(`Publicado: ${data.insertados} bloqueo(s) en ${new Set(filas.map((f) => f.producto_id)).size} hotel(es)`);
  SS_DATA = null; SS_MAPEOS = {}; SS_ARCHIVO_ACTUAL = null; SS_PDF_ACTUAL = null;
  document.getElementById('ss-preview').innerHTML = '';
  document.getElementById('ss-mapeo').innerHTML = '';
  document.getElementById('ss-alerta').innerHTML = '';
  document.getElementById('ss-publicar-box').style.display = 'none';
  loadStopSalesVigentes();
  ssCargarPdfActual();
}

/* ---------- "Bloqueos vigentes hoy": calendario + vista por hotel ----------
   Dos preguntas distintas, dos vistas: el calendario contesta "¿qué tengo
   bloqueado el 15?" y la de hoteles "¿cómo está el Wyndham?". El selector es el
   mismo initViewSwitcher del resto del CRM, así que la elección se recuerda. */
let SS_VIGENTES_DATA = null;
let ssView = 'calendario';
let ssFiltro = 'todos';
let ssHotelSel = null; // nombre exacto del hotel elegido en los chips, o null = todos
let SS_MES = null;       // 'YYYY-MM' que se está mostrando
let SS_DIA_ABIERTO = null;
// fecha ISO -> [{nombre, estado, fecha_desde, fecha_hasta}], ya expandido día por
// día. Se rearma en cada render del calendario porque los filtros cambian el
// conjunto de rangos; con 27 filas eso es gratis. Si algún día el horizonte
// creciera a miles de rangos, esto es lo primero que habría que memoizar por
// (filtro + búsqueda), no por mes: el mes se lee de este mapa, no lo construye.
let SS_POR_DIA = new Map();

const SS_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ssMesLargo = (mes) => { const [a, m] = mes.split('-'); return `${SS_MESES[+m - 1]} ${a}`; };
// Las fechas de la base son `date` puro. `new Date('2026-08-14')` las lee como
// UTC y en Venezuela (UTC-4) devuelve el día anterior -- de ahí el 'T00:00:00',
// igual que en ssDiasRestantes.
const ssFecha = (iso) => new Date(iso + 'T00:00:00');
const ssISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function ssDiasBloqueados(filas) {
  const mapa = new Map();
  for (const f of filas) {
    const fin = ssFecha(f.fecha_hasta);
    for (const d = ssFecha(f.fecha_desde); d <= fin; d.setDate(d.getDate() + 1)) {
      const clave = ssISO(d);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push(f);
    }
  }
  return mapa;
}

// Meses (de los que tienen bloqueo) ordenados, para saber a dónde saltar con las
// flechas sin recorrer meses vacíos de a uno hasta mayo de 2027.
function ssMesesConDatos() {
  return [...new Set([...SS_POR_DIA.keys()].map((f) => f.slice(0, 7)))].sort();
}

function ssCalendarioHtml(mes) {
  const [anio, m] = mes.split('-').map(Number);
  const primero = new Date(anio, m - 1, 1);
  const diasEnMes = new Date(anio, m, 0).getDate();
  // getDay() da 0=domingo; acá la semana arranca el lunes, como el calendario
  // que usa cualquiera en Venezuela.
  const offset = (primero.getDay() + 6) % 7;
  const hoyISO = ssISO(new Date());
  const meses = ssMesesConDatos();
  const previos = meses.filter((x) => x < mes);
  const siguientes = meses.filter((x) => x > mes);

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push('<div class="ss-dia vacio"></div>');
  for (let d = 1; d <= diasEnMes; d++) {
    const iso = `${anio}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hoteles = SS_POR_DIA.get(iso) || [];
    const clases = ['ss-dia'];
    if (iso === hoyISO) clases.push('hoy');
    if (iso === SS_DIA_ABIERTO) clases.push('sel');
    if (hoteles.length) {
      const soloRequest = hoteles.every((h) => h.estado === 'on_request');
      clases.push('hay', soloRequest ? 'req' : hoteles.length >= 3 ? 'n3' : hoteles.length === 2 ? 'n2' : 'n1');
      const q = hoteles.length === 1 ? '1 hotel' : `${hoteles.length} hoteles`;
      celdas.push(`<button type="button" class="${clases.join(' ')}" data-ss-dia="${iso}" title="${q} ${soloRequest ? 'a confirmar' : 'sin cupo'} — tocá para ver cuáles">${d}</button>`);
    } else {
      celdas.push(`<div class="${clases.join(' ')}">${d}</div>`);
    }
  }

  const proximo = siguientes[0] || previos[previos.length - 1];
  return `<div class="ss-cal-nav">
      <button type="button" class="ss-nav-btn" data-ss-mes="${previos[previos.length - 1] || ''}" ${previos.length ? '' : 'disabled'} title="Mes anterior con bloqueos"><i class="fas fa-chevron-left"></i></button>
      <b>${ssMesLargo(mes)}</b>
      <button type="button" class="ss-nav-btn" data-ss-mes="${siguientes[0] || ''}" ${siguientes.length ? '' : 'disabled'} title="Mes siguiente con bloqueos"><i class="fas fa-chevron-right"></i></button>
    </div>
    <div class="ss-cal">
      ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x) => `<div class="ss-dow">${x}</div>`).join('')}
      ${celdas.join('')}
    </div>
    <div class="ss-leyenda">
      <span><i style="background:rgba(239,68,68,.22)"></i> 1 hotel</span>
      <span><i style="background:rgba(239,68,68,.4)"></i> 2 hoteles</span>
      <span><i style="background:rgba(239,68,68,.65)"></i> 3 o más</span>
      <span><i style="background:rgba(224,160,48,.2);border:1px dashed rgba(224,160,48,.55)"></i> Solo a confirmar</span>
    </div>
    ${!ssMesesConDatos().includes(mes) && proximo ? `<div class="ss-cal-nota">Sin bloqueos en ${ssMesLargo(mes)}. El más cercano es en ${ssMesLargo(proximo)}.</div>` : ''}
    <div id="ss-detalle"></div>`;
}

function ssPintarDetalleDia() {
  const box = document.getElementById('ss-detalle');
  if (!box) return;
  if (!SS_DIA_ABIERTO) { box.innerHTML = ''; return; }
  const hoteles = SS_POR_DIA.get(SS_DIA_ABIERTO) || [];
  box.innerHTML = `<div class="ss-detalle">
    <div class="ss-detalle-t">${fmtDiaCorto(SS_DIA_ABIERTO)} — ${hoteles.length === 1 ? '1 hotel' : `${hoteles.length} hoteles`}</div>
    ${hoteles.map((h) => `<div class="vig-item">
      <div class="vig-top"><div class="vig-nombre">${esc(h.nombre)}</div>${ssBadge(h.estado)}</div>
      <div class="vig-texto">${fmtDiaCorto(h.fecha_desde)} → ${fmtDiaCorto(h.fecha_hasta)}
        <span class="muted">(${ssTextoCuando(ssDiasRestantes(h.fecha_hasta))})</span></div>
    </div>`).join('')}
  </div>`;
}

// Tira de un mes: un segmento por día. Da la FORMA del bloqueo (dónde cae, qué
// tan largo es) sin tener que leer fechas; los rangos exactos van igual debajo.
function ssTiraMes(rangos, mes) {
  const [anio, m] = mes.split('-').map(Number);
  const diasEnMes = new Date(anio, m, 0).getDate();
  const segmentos = [];
  for (let d = 1; d <= diasEnMes; d++) {
    const iso = `${anio}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const r = rangos.find((x) => x.fecha_desde <= iso && iso <= x.fecha_hasta);
    segmentos.push(r
      ? `<i class="${r.estado === 'stop_sale' ? 'st' : 'rq'}" title="${fmtDiaCorto(r.fecha_desde)} → ${fmtDiaCorto(r.fecha_hasta)}"></i>`
      : '<i></i>');
  }
  return `<div class="ss-tira-fila"><span class="ss-tira-mes">${SS_MESES[m - 1].slice(0, 3)}</span><div class="ss-tira">${segmentos.join('')}</div></div>`;
}

// Tarjeta de un hotel: se resalta en rojo (misma clase .grave de vig-item) si
// algún rango vence hoy o mañana -- da la urgencia real de un vistazo sin tener
// que leer la fecha exacta.
function ssTarjetaVigente(g) {
  const meses = [...new Set(g.rangos.map((r) => r.fecha_desde.slice(0, 7)))].sort().slice(0, 3);
  return `<div class="vig-item ${g.urgente ? 'grave' : ''}">
    <div class="vig-top"><div class="vig-nombre">${esc(g.nombre)}</div><span class="vig-tipo">${g.rangos.length}</span></div>
    ${meses.map((m) => ssTiraMes(g.rangos, m)).join('')}
    <div style="margin-top:7px">
      ${g.rangos.map((r) => `<div class="vig-texto" style="display:flex;align-items:center;gap:8px;padding:2px 0;flex-wrap:wrap">
        ${ssBadge(r.estado)}<span>${fmtDiaCorto(r.fecha_desde)} → ${fmtDiaCorto(r.fecha_hasta)}</span>
        <span class="muted" style="font-size:11px">(${ssTextoCuando(ssDiasRestantes(r.fecha_hasta))})</span>
      </div>`).join('')}
    </div>
  </div>`;
}

async function loadStopSalesVigentes() {
  const cont = document.getElementById('ss-vigentes');
  cont.innerHTML = '<div class="muted" style="padding:14px 2px">Cargando…</div>';
  const { data, error } = await sb.rpc('stop_sales_vigentes');
  if (error) { cont.innerHTML = `<div class="vig-vacio">No se pudo cargar: ${esc(error.message)}</div>`; return; }
  SS_VIGENTES_DATA = data || [];
  ssView = initViewSwitcher('ss-view-switch', 'stop-sales', 'calendario', (v) => { ssView = v; SS_DIA_ABIERTO = null; ssRenderVigentes(); }, ['calendario', 'hoteles']);
  ssRenderVigentes();
}

// Un solo lugar sincroniza el KPI activo y repinta -- mismo patrón que
// wrIrAFiltro en Web y Reasignados.
function ssIrAFiltro(clave) {
  ssFiltro = ssFiltro === clave ? 'todos' : clave;
  SS_DIA_ABIERTO = null;
  ssRenderVigentes();
}

function ssFilasVisibles() {
  const filtro = (document.getElementById('ss-vig-buscar')?.value || '').trim().toLowerCase();
  return SS_VIGENTES_DATA.filter((f) => {
    if (filtro && !f.nombre.toLowerCase().includes(filtro)) return false;
    if (ssHotelSel && f.nombre !== ssHotelSel) return false;
    if (ssFiltro === 'stop_sale') return f.estado === 'stop_sale';
    if (ssFiltro === 'on_request') return f.estado === 'on_request';
    if (ssFiltro === 'semana') return ssDiasRestantes(f.fecha_hasta) <= 7;
    return true;
  });
}

// Chips de hotel: uno por hotel con bloqueo vigente, tocarlo filtra el
// calendario a ese hotel puntual (2026-08-06, pedido del dueño). Mismo color
// que ssBadge -- rojo si tiene algún rango sin cupo, ámbar si todos sus
// rangos son solo "a confirmar".
function ssChipsHoteles() {
  const porNombre = new Map();
  for (const f of SS_VIGENTES_DATA) {
    porNombre.set(f.nombre, (porNombre.get(f.nombre) || 0) + 1);
  }
  // Color por hotel, no por estado -- acá TODO es stop sale, así que
  // rojo/ámbar no distingue nada y quedaba muy monocromático. Mismo
  // ADV_COLORS que "Carga por asesor" (app.js:122).
  return [...porNombre.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nombre, n], i) => {
      const color = ADV_COLORS[i % ADV_COLORS.length];
      const on = ssHotelSel === nombre;
      return `<button type="button" class="ss-hotel-chip${on ? ' on' : ''}" data-ss-hotel="${esc(nombre)}" style="--c:${color}">${esc(nombre)} <span>${n}</span></button>`;
    }).join('');
}

function ssIrAHotel(nombre) {
  ssHotelSel = ssHotelSel === nombre ? null : nombre;
  SS_DIA_ABIERTO = null;
  if (ssHotelSel && ssView !== 'calendario') {
    ssView = 'calendario';
    localStorage.setItem('view_stop-sales', 'calendario');
    document.querySelectorAll('#ss-view-switch .vs-btn').forEach((b) => b.classList.toggle('on', b.dataset.v === 'calendario'));
  }
  ssRenderVigentes();
}

function ssRenderVigentes() {
  const cont = document.getElementById('ss-vigentes');
  if (!SS_VIGENTES_DATA) return;
  if (!SS_VIGENTES_DATA.length) {
    cont.innerHTML = '<div class="vig-vacio"><i class="fas fa-circle-check"></i><b>Sin bloqueos vigentes</b></div>';
    return;
  }
  const filas = ssFilasVisibles();
  const nStop = new Set(SS_VIGENTES_DATA.filter((f) => f.estado === 'stop_sale').map((f) => f.nombre)).size;
  const nReq = new Set(SS_VIGENTES_DATA.filter((f) => f.estado === 'on_request').map((f) => f.nombre)).size;
  const nSemana = SS_VIGENTES_DATA.filter((f) => ssDiasRestantes(f.fecha_hasta) <= 7).length;

  cont.innerHTML = `<div id="ss-kpis" class="kpis kpis-3" style="margin-bottom:14px"></div>
    <div id="ss-chips-hotel" style="margin-bottom:14px"></div>
    <div id="ss-calendario" class="${ssView === 'calendario' ? 'show' : ''}"></div>
    <div id="ss-hoteles" class="${ssView === 'hoteles' ? 'show' : ''}"></div>`;

  pintarKPIs('ss-kpis', [
    { t: 'Sin cupo', v: nStop, d: 'hoteles en stop sale', i: 'fa-ban', c: '#ef4444', key: 'stop_sale', on: ssFiltro === 'stop_sale', tt: 'Ver solo los bloqueos sin cupo', go: () => ssIrAFiltro('stop_sale') },
    { t: 'A confirmar', v: nReq, d: 'hoteles on request', i: 'fa-clock', c: '#e0a030', key: 'on_request', on: ssFiltro === 'on_request', tt: 'Ver solo los que hay que confirmar', go: () => ssIrAFiltro('on_request') },
    { t: 'Se liberan pronto', v: nSemana, d: 'terminan en 7 días o menos', i: 'fa-calendar-check', c: 'var(--green)', key: 'semana', on: ssFiltro === 'semana', tt: 'Ver los que se liberan esta semana', go: () => ssIrAFiltro('semana') },
  ]);

  const chipsBox = document.getElementById('ss-chips-hotel');
  chipsBox.innerHTML = ssChipsHoteles();
  chipsBox.querySelectorAll('[data-ss-hotel]').forEach((b) => b.addEventListener('click', () => ssIrAHotel(b.dataset.ssHotel)));

  if (!filas.length) {
    const donde = ssView === 'calendario' ? 'ss-calendario' : 'ss-hoteles';
    document.getElementById(donde).innerHTML = '<div class="vig-vacio">Ningún bloqueo coincide con lo que buscás.</div>';
    return;
  }

  if (ssView === 'calendario') {
    SS_POR_DIA = ssDiasBloqueados(filas);
    const meses = ssMesesConDatos();
    const mesHoy = ssISO(new Date()).slice(0, 7);
    // Si el mes que se estaba viendo se quedó sin datos por un filtro, saltar al
    // primero que sí tenga en vez de mostrar una grilla vacía sin explicación.
    if (!SS_MES || !meses.includes(SS_MES)) SS_MES = meses.includes(mesHoy) ? mesHoy : (meses.find((m) => m >= mesHoy) || meses[0]);
    const box = document.getElementById('ss-calendario');
    box.innerHTML = ssCalendarioHtml(SS_MES);
    ssPintarDetalleDia();
    box.querySelectorAll('[data-ss-mes]').forEach((b) => b.addEventListener('click', () => {
      if (!b.dataset.ssMes) return;
      SS_MES = b.dataset.ssMes; SS_DIA_ABIERTO = null; ssRenderVigentes();
    }));
    box.querySelectorAll('[data-ss-dia]').forEach((b) => b.addEventListener('click', () => {
      SS_DIA_ABIERTO = SS_DIA_ABIERTO === b.dataset.ssDia ? null : b.dataset.ssDia;
      ssRenderVigentes();
    }));
  } else {
    document.getElementById('ss-hoteles').innerHTML = ssAgruparPorHotel(filas, 'nombre').map(ssTarjetaVigente).join('');
  }
}

/* ---------- Reasignaciones ---------- */
let rgPage = 1;
const MOTIVO_LABEL = { timeout_no_respuesta: 'Timeout', manual_no_puedo: 'No puedo' };
function setupReasignaciones() {
  fill('rg-asesor', ACTIVOS);
  ['rg-asesor', 'rg-motivo', 'rg-desde', 'rg-hasta'].forEach(id => document.getElementById(id).addEventListener('change', () => { rgPage = 1; loadReasignaciones(); }));
  initDateRangePicker('rg');
  rgView = initViewSwitcher('rg-view-switch', 'reasignaciones', 'lista', v => { rgView = v; applyRgView(); });
}
function filtrarReasigPorMotivo(motivo) {
  const sel = document.getElementById('rg-motivo');
  if (!sel) return;
  sel.value = motivo;
  sel.dispatchEvent(new Event('change')); // reusa el listener que ya resetea la página y recarga
}
function reasignFiltered(q) {
  const fa = val('rg-asesor'), fd = val('rg-desde'), fh = val('rg-hasta');
  if (fa) q = q.eq('asesor_anterior', fa);
  if (fd) q = q.gte('created_at', fd);
  if (fh) q = q.lte('created_at', fh + 'T23:59:59');
  return q;
}
function buildReasignQuery() {
  let q = reasignFiltered(sb.from('reasignaciones').select('*, leads(nombre,telefono,destino)', { count: 'exact' }));
  const fm = val('rg-motivo');
  if (fm) q = q.eq('motivo', fm);
  return q;
}

/* ---------- Reasignaciones: editar y eliminar a mano (admin) ----------
   Sirve para corregir un traspaso mal registrado sin tener que entrar a la
   base. Borrar acá es DEFINITIVO: la fila de reasignaciones es el historial de
   quién le pasó qué cliente a quién, no hay papelera. */
let REASIG_CACHE = [];
function abrirEditorReasignacion(id) {
  const r = REASIG_CACHE.find(x => x.id === id);
  if (!r) return;
  const l = r.leads || {};
  const nombres = [...new Set([...(ACTIVOS || []), r.asesor_anterior, r.asesor_nuevo].filter(Boolean))].sort();
  const opciones = nombres.map(a => esc(a));
  const sel = (valor) => `<select class="ei">${['<option value="">Sin asesor</option>', ...opciones.map(a => `<option value="${a}"${a === valor ? ' selected' : ''}>${a}</option>`)].join('')}</select>`;
  document.getElementById('drawerContent').innerHTML = `
    <div class="dhead"><div><div class="dn">${esc(l.nombre || 'Lead ' + r.lead_id)}</div><div class="dm">Reasignación del ${esc(fmtFechaHoraCaracas(r.created_at))}</div></div></div>
    <div class="edit-box" style="margin-top:16px">
      <label class="fl">De (asesor anterior)</label>
      <div id="re-de">${sel(r.asesor_anterior)}</div>
      <label class="fl">A (asesor nuevo)</label>
      <div id="re-a">${sel(r.asesor_nuevo)}</div>
      <label class="fl">Motivo</label>
      <select id="re-motivo" class="ei">
        <option value="timeout_no_respuesta"${r.motivo === 'timeout_no_respuesta' ? ' selected' : ''}>Timeout (sin respuesta)</option>
        <option value="manual_no_puedo"${r.motivo === 'manual_no_puedo' ? ' selected' : ''}>Manual (No puedo)</option>
        <option value="correccion_admin"${r.motivo === 'correccion_admin' ? ' selected' : ''}>Corrección de administración</option>
      </select>
      <div class="edit-err" id="re-err"></div>
      <button class="dbtn save" id="re-guardar" type="button"><i class="fas fa-check"></i> Guardar</button>
      <button class="dbtn gh" id="re-borrar" type="button" style="color:#ef4444"><i class="fas fa-trash"></i> Eliminar este registro</button>
      <div style="font-size:11px;color:var(--muted2);margin-top:10px;line-height:1.5">Esto edita el <b>registro histórico</b> de la reasignación. No cambia a qué asesor está asignado el lead hoy — eso se hace desde la ficha del lead.</div>
    </div>`;
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBg').classList.add('open');
  navPush({ type: 'drawer' });
  document.getElementById('re-guardar').onclick = async () => {
    const { data, error } = await sb.rpc('admin_actualizar_reasignacion', {
      p_id: id,
      p_asesor_anterior: document.querySelector('#re-de select').value,
      p_asesor_nuevo: document.querySelector('#re-a select').value,
      p_motivo: val('re-motivo'),
    });
    if (error || !data?.ok) { document.getElementById('re-err').textContent = error?.message || 'No se pudo guardar.'; return; }
    window.closeDrawer(); okToast('Reasignación actualizada'); loadReasignaciones();
  };
  document.getElementById('re-borrar').onclick = () => borrarReasignacion(id);
}

async function borrarReasignacion(id) {
  const r = REASIG_CACHE.find(x => x.id === id);
  const quien = r ? `${r.asesor_anterior || '—'} → ${r.asesor_nuevo || 'sin asesor'}` : 'este registro';
  if (!(await confirmarSheet({ titulo: `¿Eliminar la reasignación ${quien}?`, detalle: 'Es el historial de quién le pasó el cliente a quién. No se puede deshacer desde el CRM.', textoOk: 'Eliminar', destructivo: true }))) return;
  const { data, error } = await sb.rpc('admin_eliminar_reasignacion', { p_id: id });
  if (error || !data?.ok) { errToast(error?.message || 'No se pudo eliminar'); return; }
  window.closeDrawer(); okToast('Reasignación eliminada'); loadReasignaciones();
}

async function loadReasignaciones() {
  const loading = document.getElementById('rg-loading'), empty = document.getElementById('rg-empty'), wrap = document.getElementById('rg-wrap');
  empty.classList.remove('show'); loading.classList.add('show'); wrap.style.opacity = '.4';
  const from = (rgPage - 1) * PER;
  const fa = val('rg-asesor') || null, fd = val('rg-desde') || null, fh = val('rg-hasta') ? val('rg-hasta') + 'T23:59:59' : null;
  const [{ data, count, error }, { data: kpis, error: kpisErr }] = await Promise.all([
    buildReasignQuery().order('created_at', { ascending: false }).range(from, from + PER - 1),
    sb.rpc('reasignaciones_kpis', { p_asesor: fa, p_desde: fd, p_hasta: fh }),
  ]);
  loading.classList.remove('show'); wrap.style.opacity = '1';
  if (error) { console.error(error); errToast('No se pudieron cargar las reasignaciones'); return; }
  if (kpisErr) console.error(kpisErr);
  const total = count ?? 0;
  document.getElementById('rg-count').textContent = `${fmt(total)} reasignaciones`;
  const kpi = kpis || {};
  const kAgotados = kpi.agotados ?? 0;
  pintarKPIs('reasig-kpis', [
    { t: 'Total reasignaciones', v: fmt(total), i: 'fa-shuffle', c: 'var(--accent)', tt: 'Quitar el filtro de motivo', go: () => filtrarReasigPorMotivo('') },
    { t: 'Por timeout', v: fmt(kpi.timeout ?? 0), i: 'fa-clock', c: 'var(--blue)', tt: 'Ver solo las reasignadas por timeout', go: () => filtrarReasigPorMotivo('timeout_no_respuesta') },
    { t: 'Manual (No puedo)', v: fmt(kpi.manual ?? 0), i: 'fa-hand', c: 'var(--purple)', tt: 'Ver solo las reasignadas a mano', go: () => filtrarReasigPorMotivo('manual_no_puedo') },
    // "Sin asesor disponible" no es un motivo, es el resultado de no encontrar a
    // quién pasársela: no hay filtro que lo aísle, así que no se hace clickeable.
    { t: 'Sin asesor disponible', v: fmt(kAgotados), i: 'fa-triangle-exclamation', c: kAgotados > 0 ? '#ef4444' : 'var(--green)' },
  ]);
  if (!data.length) { empty.classList.add('show'); document.getElementById('rg-tbody').innerHTML = ''; document.getElementById('rg-cards').innerHTML = ''; document.getElementById('rg-pager').innerHTML = ''; return; }
  document.getElementById('rg-tbody').innerHTML = data.map(r => {
    const l = r.leads || {}, av = clientAvatar({ id: r.lead_id, telefono: l.telefono, nombre: l.nombre });
    const sinAsesor = !r.asesor_nuevo;
    return `<tr${sinAsesor ? ' style="background:rgba(239,68,68,.06)"' : ''}>
      <td class="td-name"><div class="lead-name"><div class="ln-ava" style="background:${av.color}22;color:${av.color}"><i class="fas ${av.icon}"></i></div>${esc(l.nombre || 'Sin nombre')}</div></td>
      <td data-label="Teléfono" class="muted">${esc(l.telefono) || '—'}</td>
      <td data-label="Destino">${esc(l.destino) || '—'}</td>
      <td data-label="De → A"><span class="rg-flujo"><b>${esc(r.asesor_anterior || '—')}</b><i class="fas fa-arrow-right"></i>${sinAsesor ? '<span style="color:#ef4444">Sin asesor disponible</span>' : `<b>${esc(r.asesor_nuevo)}</b>`}</span></td>
      <td data-label="Motivo"><span class="chip">${MOTIVO_LABEL[r.motivo] || esc(r.motivo)}</span></td>
      <td data-label="Tiempo" class="muted">${r.minutos_transcurridos != null ? r.minutos_transcurridos + ' min' : '—'}</td>
      <td data-label="Fecha" class="muted">${esc(fmtFechaHoraCaracas(r.created_at))}</td>
      <td class="rg-acc"><button class="btn-sm" data-rg-editar="${r.id}" title="Editar"><i class="fas fa-pen"></i></button><button class="btn-sm" data-rg-borrar="${r.id}" title="Eliminar"><i class="fas fa-trash"></i></button></td>
    </tr>`;
  }).join('');
  document.getElementById('rg-cards').innerHTML = data.map(reasignCardHtml).join('');
  REASIG_CACHE = data;
  document.querySelectorAll('#rg-tbody [data-rg-editar]').forEach(b => { b.onclick = () => abrirEditorReasignacion(Number(b.dataset.rgEditar)); });
  document.querySelectorAll('#rg-tbody [data-rg-borrar]').forEach(b => { b.onclick = () => borrarReasignacion(Number(b.dataset.rgBorrar)); });
  applyRgView();
  renderReasignPager(Math.max(Math.ceil(total / PER), 1));
}
function reasignCardHtml(r) {
  const l = r.leads || {}, av = clientAvatar({ id: r.lead_id, telefono: l.telefono, nombre: l.nombre });
  const sinAsesor = !r.asesor_nuevo;
  const detalle = rgView === 'fichas' ? `
    <div class="ec-row"><i class="fas fa-arrow-right-arrow-left"></i> ${esc(r.asesor_anterior)} → ${sinAsesor ? '<span style="color:#ef4444">sin asesor disponible</span>' : esc(r.asesor_nuevo)}</div>
    <div class="ec-row"><i class="fas fa-clock"></i> ${r.minutos_transcurridos != null ? r.minutos_transcurridos + ' min transcurridos' : 'Sin dato de tiempo'}</div>` : '';
  return `<div class="entity-card">
    <div class="ec-top"><div class="ec-ava" style="background:${av.color}22;color:${av.color}"><i class="fas ${av.icon}"></i></div><div class="ec-nombre">${esc(l.nombre || 'Sin nombre')}</div></div>
    <div class="ec-row"><i class="fas fa-phone"></i> ${esc(l.telefono) || '—'}</div>
    <div class="ec-row"><i class="fas fa-location-dot"></i> ${esc(l.destino) || '—'}</div>
    ${detalle}
    <div class="ec-foot">
      <span class="chip">${MOTIVO_LABEL[r.motivo] || esc(r.motivo)}</span>
      <span class="muted" style="font-size:11px">${esc(fmtFechaHoraCaracas(r.created_at))}</span>
    </div>
  </div>`;
}
function applyRgView() {
  const table = document.getElementById('rg-wrap'), cards = document.getElementById('rg-cards');
  table.classList.toggle('hide', rgView !== 'lista');
  cards.classList.toggle('show', rgView !== 'lista');
  cards.classList.toggle('fichas', rgView === 'fichas');
}
function renderReasignPager(pages) {
  document.getElementById('rg-pager').innerHTML = `<button ${rgPage <= 1 ? 'disabled' : ''} id="rgprev"><i class="fas fa-chevron-left"></i></button><span class="pinfo">Página ${fmt(rgPage)} de ${fmt(pages)}</span><button ${rgPage >= pages ? 'disabled' : ''} id="rgnext"><i class="fas fa-chevron-right"></i></button>`;
  const pv = document.getElementById('rgprev'), nx = document.getElementById('rgnext');
  if (pv) pv.onclick = () => { rgPage--; loadReasignaciones(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  if (nx) nx.onclick = () => { rgPage++; loadReasignaciones(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
}

/* ---------- Facturación (Ventas / Comisiones / Cuentas por Pagar / Asesores) ----------
   Cada tabla se guarda en memoria (FACT_*_CACHE) para poder filtrar/ordenar
   en el cliente sin volver a pedirle nada al backend -- ver ordenarYFiltrar. */
let FACT_ASESORES_CACHE = [], CXP_CACHE = [], FACT_VENTAS_CACHE = [], FACT_COMISIONES_CACHE = [], factTab = 'ventas';
const FACT_LAST = {}; // últimas filas renderizadas (post filtro/búsqueda/orden) por tabla -- exportar CSV/PDF usa esto, así "exportar por cliente" es solo filtrar y exportar
const FACT_COLS = {
  ventas: [['numero_factura', 'N°'], ['cliente', 'Cliente'], ['asesor', 'Asesor'], ['monto_total', 'Precio venta'], ['costo_neto', 'Costo neto'], ['margen', 'Margen'], ['proveedor', 'Proveedor'], ['estado', 'Estado'], ['fecha_emision', 'Fecha']],
  comisiones: [['asesor', 'Asesor'], ['monto_venta', 'Monto venta'], ['porcentaje', '%'], ['monto_comision', 'Comisión'], ['estado', 'Estado']],
  cxp: [['proveedor', 'Proveedor'], ['cliente', 'Cliente'], ['monto_a_transferir', 'A transferir'], ['monto_abonado', 'Abonado'], ['saldo_pendiente', 'Saldo'], ['estado', 'Estado']],
  asesores: [['nombre', 'Asesor'], ['porcentaje_comision', '% Comisión']],
};
const FACT_MONEY_COLS = new Set(['monto_total', 'costo_neto', 'margen', 'monto_venta', 'monto_comision', 'monto_a_transferir', 'monto_abonado', 'saldo_pendiente']);
function formatCeldaExport(col, row) {
  const v = row[col];
  if (v == null) return '';
  if (col === 'fecha_emision') return fmtFechaHoraCaracas(v);
  if (FACT_MONEY_COLS.has(col)) return money(v);
  if (col === 'porcentaje' || col === 'porcentaje_comision') return v + '%';
  return String(v);
}
window.exportarCSV = (tabla) => {
  const filas = FACT_LAST[tabla] || [];
  const cols = FACT_COLS[tabla];
  const lineas = [cols.map(c => c[1]), ...filas.map(f => cols.map(c => formatCeldaExport(c[0], f)))];
  const csv = lineas.map(fila => fila.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${tabla}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
window.toggleExportMenu = (ev, tabla) => {
  ev.stopPropagation();
  const menu = document.getElementById(`export-menu-${tabla}`);
  const abierto = menu.classList.contains('show');
  document.querySelectorAll('.export-dd-menu.show').forEach(m => m.classList.remove('show'));
  if (!abierto) menu.classList.add('show');
};
document.addEventListener('click', () => document.querySelectorAll('.export-dd-menu.show').forEach(m => m.classList.remove('show')));
window.exportarXLSX = (tabla, titulo) => {
  if (typeof XLSX === 'undefined') { errToast('La librería de Excel no cargó todavía, probá de nuevo en un segundo'); return; }
  const filas = FACT_LAST[tabla] || [];
  const cols = FACT_COLS[tabla];
  const aoa = [cols.map(c => c[1]), ...filas.map(f => cols.map(c => formatCeldaExport(c[0], f)))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 31));
  XLSX.writeFile(wb, `${tabla}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
window.exportarPDF = (tabla, titulo) => {
  const filas = FACT_LAST[tabla] || [];
  const cols = FACT_COLS[tabla];
  const filasHtml = filas.map(f => `<tr>${cols.map(c => `<td>${esc(String(formatCeldaExport(c[0], f)))}</td>`).join('')}</tr>`).join('');
  const win = window.open('', '_blank');
  if (!win) { errToast('El navegador bloqueó la ventana de impresión'); return; }
  win.document.write(`<html><head><title>${esc(titulo)}</title><style>
    body{font-family:Arial,sans-serif;padding:20px}
    h1{font-size:18px;margin-bottom:2px}
    p{color:#666;font-size:12px;margin-top:0}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
    th{background:#f2f2f2}
  </style></head><body>
    <h1>${esc(titulo)}</h1>
    <p>Generado ${new Date().toLocaleString('es-VE')}</p>
    <table><thead><tr>${cols.map(c => `<th>${esc(c[1])}</th>`).join('')}</tr></thead><tbody>${filasHtml || `<tr><td colspan="${cols.length}">Sin datos</td></tr>`}</tbody></table>
  </body></html>`);
  win.document.close();
  win.focus();
  win.print();
};
// Mismo motivo que postMostrar (ver comentario junto a TECHO_LISTA): las 3
// RPC de Facturación devuelven jsonb_agg (un blob, no setof/table), así que
// PostgREST no puede paginar con .range() -- habría que sumarles
// p_limit/p_offset, que es tocar el esquema/RPC fuera de lo que autoriza
// esta fase. Se recorta el render, no el fetch.
let factVentasMostrar = TECHO_LISTA, factComMostrar = TECHO_LISTA, cxpMostrar = TECHO_LISTA;
const FACT_SORT = {
  ventas: { col: 'numero_factura', dir: 1 }, comisiones: { col: null, dir: 1 },
  cxp: { col: null, dir: 1 }, asesores: { col: 'nombre', dir: 1 },
};
const FACT_RENDERERS = { ventas: renderVentas, comisiones: renderComisiones, cxp: renderCuentasPorPagar, asesores: renderAsesoresComision };
// Único lugar que aplica un orden -- lo llaman tanto el click en <th
// class="th-sort"> (thead, oculto en móvil) como la hoja "Ordenar" (Fase
// 4.1, segunda puerta de entrada). Nunca duplicar esta lógica en el sheet.
function aplicarOrdenTabla(tabla, col) {
  const spec = FACT_SORT[tabla];
  spec.dir = (spec.col === col) ? -spec.dir : 1;
  spec.col = col;
  document.querySelectorAll(`.th-sort[data-sort-tbl="${tabla}"]`).forEach(h => h.querySelector('.sort-arrow')?.remove());
  document.querySelector(`.th-sort[data-sort-tbl="${tabla}"][data-sort-col="${col}"]`)
    ?.insertAdjacentHTML('beforeend', `<span class="sort-arrow">${spec.dir === 1 ? '▲' : '▼'}</span>`);
  FACT_RENDERERS[tabla]();
}
function abrirOrdenarSheet(tabla) {
  const spec = FACT_SORT[tabla];
  const ths = [...document.querySelectorAll(`.th-sort[data-sort-tbl="${tabla}"]`)];
  document.getElementById('ordenar-sheet-lista').innerHTML = ths.map(th => {
    const col = th.dataset.sortCol;
    // childNodes[0] es el texto del encabezado -- childNodes[1] (si existe)
    // es el <span class="sort-arrow"> que insertAdjacentHTML ya haya puesto.
    const label = th.childNodes[0].textContent.trim();
    const activo = spec.col === col;
    return `<button type="button" class="ordenar-op ${activo ? 'on' : ''}" data-col="${col}">${esc(label)} <span class="oo-arrow">${activo ? (spec.dir === 1 ? '▲' : '▼') : ''}</span></button>`;
  }).join('');
  document.querySelectorAll('#ordenar-sheet-lista .ordenar-op').forEach(btn => btn.onclick = () => {
    aplicarOrdenTabla(tabla, btn.dataset.col);
    closeSheet('ordenar-sheet');
  });
  openSheet('ordenar-sheet');
}
window.abrirOrdenarSheet = abrirOrdenarSheet;
function ordenarYFiltrar(cache, campos, searchVal, sortSpec) {
  let out = cache;
  if (searchVal && searchVal.trim()) {
    const q = searchVal.trim().toLowerCase();
    out = out.filter(row => campos.some(c => String(row[c] ?? '').toLowerCase().includes(q)));
  }
  if (sortSpec.col) {
    out = [...out].sort((a, b) => {
      let va = a[sortSpec.col], vb = b[sortSpec.col];
      if (typeof va === 'string' || typeof vb === 'string') { va = String(va ?? '').toLowerCase(); vb = String(vb ?? '').toLowerCase(); }
      else { va = va ?? -Infinity; vb = vb ?? -Infinity; }
      return va < vb ? -sortSpec.dir : va > vb ? sortSpec.dir : 0;
    });
  }
  return out;
}
function setupFacturacion() {
  document.getElementById('fact-estado').addEventListener('change', loadFacturas);
  document.getElementById('fact-mes').addEventListener('change', () => { factVentasMostrar = TECHO_LISTA; renderVentas(); });
  document.getElementById('fact-asesor').addEventListener('change', () => { factVentasMostrar = TECHO_LISTA; renderVentas(); });
  document.querySelectorAll('#fact-tabs .seg').forEach(btn => btn.addEventListener('click', () => {
    factTab = btn.dataset.factTab;
    document.querySelectorAll('#fact-tabs .seg').forEach(b => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.fact-tab-panel').forEach(p => p.style.display = p.dataset.factPanel === factTab ? '' : 'none');
    if (factTab === 'bandeja') loadBandejaFacturacion();
    if (factTab === 'verificar') loadVentasPendientesVerificar();
  }));
  document.querySelectorAll('.th-sort').forEach(th => th.addEventListener('click', () => aplicarOrdenTabla(th.dataset.sortTbl, th.dataset.sortCol)));
  document.getElementById('fact-ventas-search').addEventListener('input', () => { factVentasMostrar = TECHO_LISTA; renderVentas(); });
  document.getElementById('fact-com-search').addEventListener('input', () => { factComMostrar = TECHO_LISTA; renderComisiones(); });
  document.getElementById('cxp-search').addEventListener('input', () => { cxpMostrar = TECHO_LISTA; renderCuentasPorPagar(); });
  document.getElementById('fact-asesores-search').addEventListener('input', renderAsesoresComision);
  document.getElementById('monto-sheet-cancelar').addEventListener('click', () => closeSheet('monto-sheet'));
  document.getElementById('monto-sheet-confirmar').addEventListener('click', confirmarMontoSheet);
  // Flechita del orden por defecto (numero_factura asc en Ventas) visible
  // desde el primer render, no solo después de tocar un encabezado.
  Object.entries(FACT_SORT).forEach(([tabla, spec]) => {
    if (!spec.col) return;
    const th = document.querySelector(`.th-sort[data-sort-tbl="${tabla}"][data-sort-col="${spec.col}"]`);
    th?.insertAdjacentHTML('beforeend', `<span class="sort-arrow">${spec.dir === 1 ? '▲' : '▼'}</span>`);
  });
}
async function loadFacturacion() {
  loadFacturacionKpis();
  loadAsesoresComision();
  loadBandejaFacturacion();
  loadVentasPendientesVerificar();
  await loadCuentasPorPagar(); // CXP_CACHE poblado antes: loadFacturas lo usa para costo neto/proveedor/margen
  loadFacturas();
  loadComisionesAdmin();
}
async function loadFacturacionKpis() {
  const { data, error } = await sb.rpc('resumen_facturacion');
  if (error) { errToast('No se pudo cargar el resumen de facturación'); return; }
  const r = data || {};
  const sinConfigurar = r.comisiones_sin_configurar ?? 0;
  const irA = tab => () => document.querySelector(`#fact-tabs .seg[data-fact-tab="${tab}"]`)?.click();
  pintarKPIs('fact-kpis', [
    { t: 'Total facturado', v: money(r.total_facturado), i: 'fa-sack-dollar', c: 'var(--green)', tt: 'Ver las ventas', go: irA('ventas') },
    { t: 'Facturas pagadas', v: fmt(r.facturas_pagadas ?? 0), i: 'fa-file-invoice-dollar', c: 'var(--accent)', tt: 'Ver las ventas', go: irA('ventas') },
    { t: 'Facturas anuladas', v: fmt(r.facturas_anuladas ?? 0), i: 'fa-ban', c: 'var(--muted)', tt: 'Ver las ventas', go: irA('ventas') },
    { t: 'Comisiones sin configurar', v: fmt(sinConfigurar), i: 'fa-triangle-exclamation', c: sinConfigurar > 0 ? '#ef4444' : 'var(--green)', tt: 'Configurar la comisión de cada asesor', go: irA('asesores') },
    { t: 'Comisiones pendientes', v: money(r.comisiones_pendientes_monto), i: 'fa-clock', c: 'var(--blue)', tt: 'Ver las comisiones', go: irA('comisiones') },
    { t: 'Comisiones pagadas', v: money(r.comisiones_pagadas_monto), i: 'fa-check', c: 'var(--green)', tt: 'Ver las comisiones', go: irA('comisiones') },
  ]);
}
async function loadAsesoresComision() {
  const { data, error } = await sb.rpc('listar_asesores_comision');
  if (error) { errToast('No se pudo cargar la comisión de asesores'); return; }
  FACT_ASESORES_CACHE = data || [];
  renderAsesoresComision();
}
function renderAsesoresComision() {
  const filas = ordenarYFiltrar(FACT_ASESORES_CACHE, ['nombre'], val('fact-asesores-search'), FACT_SORT.asesores);
  FACT_LAST.asesores = filas;
  document.getElementById('fact-asesores-tbody').innerHTML = filas.map(a => `
    <tr>
      <td class="td-name">${esc(a.nombre)}</td>
      <td data-label="% Comisión">${a.porcentaje_comision != null ? a.porcentaje_comision + '%' : '<span class="asist-badge off">Sin configurar</span>'}</td>
      <td class="td-acciones"><button class="btn-sm" onclick="editarPorcentajeComision(${a.id})">Editar %</button></td>
    </tr>`).join('') || '<tr><td colspan="3">Sin asesores</td></tr>';
}
async function loadFacturas() {
  document.getElementById('fact-ventas-loading')?.classList.add('show');
  const { data, error } = await sb.rpc('listar_facturas', { p_estado: val('fact-estado') || null });
  document.getElementById('fact-ventas-loading')?.classList.remove('show');
  if (error) { errToast('No se pudieron cargar las facturas'); return; }
  const cxpPorLead = new Map(CXP_CACHE.map(c => [c.lead_id, c]));
  FACT_VENTAS_CACHE = (data || []).map(f => {
    const cxp = cxpPorLead.get(f.lead_id);
    const costo_neto = cxp ? cxp.monto_a_transferir : null;
    return { ...f, costo_neto, proveedor: cxp ? cxp.proveedor : null, margen: costo_neto != null ? f.monto_total - costo_neto : null };
  });
  poblarFiltrosVentas();
  factVentasMostrar = TECHO_LISTA;
  renderVentas();
}
function poblarFiltrosVentas() {
  const selMes = document.getElementById('fact-mes'), selAsesor = document.getElementById('fact-asesor');
  const mesPrevio = selMes.value, asesorPrevio = selAsesor.value;
  const meses = [...new Set(FACT_VENTAS_CACHE.map(f => (f.fecha_emision || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  const asesores = [...new Set(FACT_VENTAS_CACHE.map(f => f.asesor).filter(Boolean))].sort();
  const nombreMes = ym => new Date(ym + '-02').toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
  selMes.innerHTML = '<option value="">Todos los meses</option>' + meses.map(ym => `<option value="${ym}">${nombreMes(ym)}</option>`).join('');
  selAsesor.innerHTML = '<option value="">Todos los asesores</option>' + asesores.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  selMes.value = meses.includes(mesPrevio) ? mesPrevio : '';
  selAsesor.value = asesores.includes(asesorPrevio) ? asesorPrevio : '';
}
function renderVentas() {
  const mes = val('fact-mes'), asesor = val('fact-asesor');
  let base = FACT_VENTAS_CACHE;
  if (mes) base = base.filter(f => (f.fecha_emision || '').slice(0, 7) === mes);
  if (asesor) base = base.filter(f => f.asesor === asesor);
  const filas = ordenarYFiltrar(base, ['cliente', 'asesor', 'proveedor'], val('fact-ventas-search'), FACT_SORT.ventas);
  FACT_LAST.ventas = filas;
  // Los totales se calculan sobre TODAS las filas filtradas, no solo las
  // visibles -- si no, "Total facturado" mentiría apenas hubiera más de
  // TECHO_LISTA facturas (mostraría la suma de la página, no la real).
  let sumaVenta = 0, sumaCosto = 0, sumaMargen = 0;
  filas.forEach(f => { if (f.estado === 'pagada') { sumaVenta += f.monto_total; if (f.costo_neto != null) { sumaCosto += f.costo_neto; sumaMargen += f.margen; } } });
  document.getElementById('fact-sum-venta').textContent = money(sumaVenta);
  document.getElementById('fact-sum-costo').textContent = money(sumaCosto);
  document.getElementById('fact-sum-margen').textContent = money(sumaMargen);
  const visibles = filas.slice(0, factVentasMostrar);
  const pager = document.getElementById('fact-ventas-pager');
  if (pager) pager.style.display = filas.length > factVentasMostrar ? '' : 'none';
  document.getElementById('fact-tbody').innerHTML = visibles.map(f => `<tr>
      <td data-label="N° Factura">${fmt(f.numero_factura)}</td>
      <td class="td-name">${esc(f.cliente || ('#' + fmt(f.lead_id)))}</td>
      <td data-label="Asesor">${esc(f.asesor || 'Sin asesor')}</td>
      <td data-label="Monto">${money(f.monto_total)}</td>
      <td data-label="Costo neto">${f.costo_neto != null ? money(f.costo_neto) : '<span class="muted">Sin definir</span>'}</td>
      <td data-label="Margen">${f.margen != null ? money(f.margen) : '—'}</td>
      <td data-label="Proveedor">${f.proveedor ? esc(f.proveedor) : '<span class="muted">—</span>'}</td>
      <td data-label="Estado"><span class="chip">${esc(f.estado)}</span></td>
      <td data-label="Fecha" class="muted">${esc(fmtFechaHoraCaracas(f.fecha_emision))}</td>
      <td class="td-acciones">
        <button class="btn-sm" onclick="abrirClienteDesdeFacturacion(${f.lead_id})">Editar cliente</button>
        ${f.estado === 'pagada' ? `<button class="btn-sm" onclick="anularFacturaUI(${f.id})">Anular</button>` : ''}
      </td>
    </tr>`).join('') || '<tr><td colspan="10">Sin facturas</td></tr>';
}
function cargarMasVentas() { factVentasMostrar += TECHO_LISTA; renderVentas(); }
window.cargarMasVentas = cargarMasVentas;
async function loadComisionesAdmin() {
  document.getElementById('fact-com-loading')?.classList.add('show');
  const { data, error } = await sb.rpc('listar_comisiones');
  document.getElementById('fact-com-loading')?.classList.remove('show');
  if (error) { errToast('No se pudieron cargar las comisiones'); return; }
  FACT_COMISIONES_CACHE = data || [];
  factComMostrar = TECHO_LISTA;
  renderComisiones();
}
function renderComisiones() {
  const filas = ordenarYFiltrar(FACT_COMISIONES_CACHE, ['asesor'], val('fact-com-search'), FACT_SORT.comisiones);
  FACT_LAST.comisiones = filas;
  const visibles = filas.slice(0, factComMostrar);
  const pager = document.getElementById('fact-com-pager');
  if (pager) pager.style.display = filas.length > factComMostrar ? '' : 'none';
  document.getElementById('fact-com-tbody').innerHTML = visibles.map(c => `
    <tr>
      <td class="td-name">${esc(c.asesor)}</td>
      <td data-label="Monto venta">${money(c.monto_venta)}</td>
      <td data-label="%">${c.porcentaje != null ? c.porcentaje + '%' : '—'}</td>
      <td data-label="Comisión">${c.monto_comision != null ? money(c.monto_comision) : '—'}</td>
      <td data-label="Estado"><span class="chip">${esc(c.estado)}</span></td>
      <td class="td-acciones">
        ${['sin_configurar', 'pendiente'].includes(c.estado) ? `<button class="btn-sm" onclick="abrirEditarComisionUI(${c.id}, ${c.porcentaje ?? 'null'})">Editar %</button>` : ''}
        ${c.estado === 'pendiente' ? `<button class="btn-sm" onclick="marcarComisionPagadaUI(${c.id})">Marcar pagada</button>` : ''}
      </td>
    </tr>`).join('') || '<tr><td colspan="6">Sin comisiones</td></tr>';
}
function cargarMasComisiones() { factComMostrar += TECHO_LISTA; renderComisiones(); }
window.cargarMasComisiones = cargarMasComisiones;
async function loadCuentasPorPagar() {
  document.getElementById('cxp-loading')?.classList.add('show');
  const { data, error } = await sb.rpc('listar_cuentas_por_pagar');
  document.getElementById('cxp-loading')?.classList.remove('show');
  if (error) { errToast('No se pudieron cargar las cuentas por pagar'); return; }
  CXP_CACHE = data || [];
  cxpMostrar = TECHO_LISTA;
  renderCuentasPorPagar();
}
function renderCuentasPorPagar() {
  const filas = ordenarYFiltrar(CXP_CACHE, ['proveedor', 'cliente'], val('cxp-search'), FACT_SORT.cxp);
  FACT_LAST.cxp = filas;
  // Igual que en Ventas: los totales suman TODAS las filas filtradas, el
  // recorte de abajo es solo para lo que se pinta.
  let sumaTransferir = 0, sumaAbonado = 0, sumaSaldo = 0;
  filas.forEach(c => { sumaTransferir += c.monto_a_transferir; sumaAbonado += c.monto_abonado; sumaSaldo += c.saldo_pendiente; });
  document.getElementById('cxp-sum-transferir').textContent = money(sumaTransferir);
  document.getElementById('cxp-sum-abonado').textContent = money(sumaAbonado);
  document.getElementById('cxp-sum-saldo').textContent = money(sumaSaldo);
  const visibles = filas.slice(0, cxpMostrar);
  const pager = document.getElementById('cxp-pager');
  if (pager) pager.style.display = filas.length > cxpMostrar ? '' : 'none';
  document.getElementById('cxp-tbody').innerHTML = visibles.map(c => `<tr>
      <td class="td-name">${esc(c.proveedor)}</td>
      <td data-label="Cliente">${esc(c.cliente)}</td>
      <td data-label="A transferir">${money(c.monto_a_transferir)}</td>
      <td data-label="Abonado">${money(c.monto_abonado)}</td>
      <td data-label="Saldo">${money(c.saldo_pendiente)}</td>
      <td data-label="Estado"><span class="chip ${c.estado === 'pagado' ? 'ok' : ''}">${esc(c.estado)}</span></td>
      <td class="td-acciones">
        <button class="btn-sm" onclick="abrirClienteDesdeFacturacion(${c.lead_id})">Editar cliente</button>
        ${c.estado === 'pendiente' ? `<button class="btn-sm" onclick="abrirRegistrarAbonoUI(${c.id}, ${c.saldo_pendiente})">Registrar abono</button>` : ''}
      </td>
    </tr>`).join('') || '<tr><td colspan="7">Sin cuentas por pagar</td></tr>';
}
function cargarMasCxp() { cxpMostrar += TECHO_LISTA; renderCuentasPorPagar(); }
window.cargarMasCxp = cargarMasCxp;

/* ---------- Hoja genérica de un solo monto (reusada por Editar % de
   comisión y Registrar abono de cuentas por pagar) ---------- */
let MONTO_SHEET_ACCION = null;
window.abrirEditarComisionUI = (comisionId, porcentajeActual) => {
  MONTO_SHEET_ACCION = { tipo: 'comision', id: comisionId };
  document.getElementById('monto-sheet-title').textContent = 'Editar % de esta venta';
  document.getElementById('monto-sheet-label').textContent = 'Porcentaje (0-100)';
  const input = document.getElementById('monto-sheet-input');
  input.min = 0; input.max = 100; input.step = 0.01; input.value = porcentajeActual ?? '';
  document.getElementById('monto-sheet-error').textContent = '';
  openSheet('monto-sheet');
};
window.abrirRegistrarAbonoUI = (cxpId, saldoPendiente) => {
  MONTO_SHEET_ACCION = { tipo: 'abono', id: cxpId, saldoPendiente };
  document.getElementById('monto-sheet-title').textContent = 'Registrar abono al proveedor';
  document.getElementById('monto-sheet-label').textContent = `Monto a abonar (saldo: ${money(saldoPendiente)})`;
  const input = document.getElementById('monto-sheet-input');
  input.min = 0; input.max = saldoPendiente; input.step = 0.01; input.value = '';
  document.getElementById('monto-sheet-error').textContent = '';
  openSheet('monto-sheet');
};
async function confirmarMontoSheet() {
  if (!MONTO_SHEET_ACCION) return;
  const err = document.getElementById('monto-sheet-error');
  const valor = Number(document.getElementById('monto-sheet-input').value);
  if (!Number.isFinite(valor) || valor <= 0) { err.textContent = 'Ingresá un monto válido.'; return; }
  const btn = document.getElementById('monto-sheet-confirmar');
  btn.disabled = true; const previo = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  let resultado;
  if (MONTO_SHEET_ACCION.tipo === 'comision') {
    if (valor > 100) { err.textContent = 'El porcentaje no puede superar 100.'; btn.disabled = false; btn.innerHTML = previo; return; }
    resultado = await sb.rpc('editar_comision_manual', { p_comision_id: MONTO_SHEET_ACCION.id, p_porcentaje: valor });
  } else {
    if (valor > MONTO_SHEET_ACCION.saldoPendiente) { err.textContent = 'El abono no puede superar el saldo pendiente.'; btn.disabled = false; btn.innerHTML = previo; return; }
    resultado = await sb.rpc('registrar_abono_proveedor', { p_cxp_id: MONTO_SHEET_ACCION.id, p_monto: valor });
  }
  btn.disabled = false; btn.innerHTML = previo;
  const { data, error } = resultado;
  if (error || !data?.ok) { err.textContent = 'No se pudo guardar: ' + (error?.message || data?.error || ''); return; }
  closeSheet('monto-sheet');
  okToast('Guardado');
  if (MONTO_SHEET_ACCION.tipo === 'comision') { loadComisionesAdmin(); loadFacturacionKpis(); }
  else { await loadCuentasPorPagar(); loadFacturacionKpis(); }
  MONTO_SHEET_ACCION = null;
}
window.editarPorcentajeComision = async (asesorId) => {
  const a = FACT_ASESORES_CACHE.find(x => x.id === asesorId);
  if (!a) return;
  const input = prompt(`% de comisión para ${a.nombre} (0-100):`, a.porcentaje_comision ?? '');
  if (input === null) return;
  const porcentaje = Number(input);
  if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) { errToast('Porcentaje inválido'); return; }
  const { data, error } = await sb.rpc('establecer_porcentaje_comision', { p_asesor_id: asesorId, p_porcentaje: porcentaje });
  if (error || !data?.ok) { errToast('No se pudo actualizar: ' + (error?.message || data?.error || '')); return; }
  okToast(`Comisión de ${a.nombre} actualizada a ${porcentaje}%`);
  loadAsesoresComision(); loadComisionesAdmin(); loadFacturacionKpis();
};
window.anularFacturaUI = async (facturaId) => {
  const motivo = prompt('Motivo de la anulación (obligatorio):');
  if (!motivo || !motivo.trim()) return;
  const { error } = await sb.rpc('anular_factura', { p_factura_id: facturaId, p_motivo: motivo.trim() });
  if (error) { errToast('No se pudo anular: ' + error.message); return; }
  okToast('Factura anulada');
  loadFacturas(); loadComisionesAdmin(); loadFacturacionKpis();
};
window.marcarComisionPagadaUI = async (comisionId) => {
  if (!(await confirmarSheet({ titulo: '¿Marcar esta comisión como pagada?', textoOk: 'Marcar pagada' }))) return;
  const { error } = await sb.rpc('marcar_comision_pagada', { p_comision_id: comisionId });
  if (error) { errToast('No se pudo marcar como pagada: ' + error.message); return; }
  okToast('Comisión marcada como pagada');
  loadComisionesAdmin(); loadFacturacionKpis();
};
async function loadMisComisiones() {
  const { data, error } = await sb.rpc('listar_comisiones');
  if (error) { errToast('No se pudieron cargar tus comisiones'); return; }
  document.getElementById('miscom-tbody').innerHTML = (data || []).map(c => `
    <tr>
      <td data-label="Monto venta">${money(c.monto_venta)}</td>
      <td data-label="%">${c.porcentaje != null ? c.porcentaje + '%' : '—'}</td>
      <td data-label="Comisión">${c.monto_comision != null ? money(c.monto_comision) : 'Sin configurar'}</td>
      <td data-label="Estado"><span class="chip">${esc(c.estado)}</span></td>
      <td data-label="Fecha de pago" class="muted">${esc(fmtFechaHoraCaracas(c.fecha_pago))}</td>
    </tr>`).join('') || '<tr><td colspan="5">Sin comisiones todavía</td></tr>';
}

/* ---------- Tarifario ---------- */
let tarTab = 'hotsale', tarCache = {}, tarInfo = null, tarView = 'tarjetas';
const tarDestinosAbiertos = new Set();
const tarHotelesAbiertos = new Set();
const TAR_TAB_LABEL = { destino: 'Guías/Tours', hotel: 'Hotel', paquete: 'Paquete', promo: 'Promoción', hotsale: 'Hot Sale', boleteria: 'Boletería' };
function setupTarifarioTabs() {
  fill('tar-f-destino', ['Margarita', 'Coche', 'Los Roques', 'Mérida', 'Falcón', 'Canaima', 'Caracas']);
  const mesSel = document.getElementById('tar-f-mes');
  const mesActual = new Date().getMonth() + 1;
  mesSel.innerHTML = '<option value="">Cualquier mes</option>'
    + `<option value="${mesActual}">Este mes (${MESL[mesActual - 1]})</option>`
    + MESL.map((m, i) => `<option value="${i + 1}">${m.charAt(0).toUpperCase() + m.slice(1)}</option>`).join('');
  document.querySelectorAll('#tar-tabs .seg').forEach(b => b.onclick = () => {
    document.querySelectorAll('#tar-tabs .seg').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); tarTab = b.dataset.tab;
    actualizarVisibilidadFiltrosTarifario();
    loadTarifario();
  });
  actualizarVisibilidadFiltrosTarifario();
  let deb; document.getElementById('tar-search').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(renderTarifario, 200); });
  document.querySelectorAll('.tar-f').forEach(el => el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => renderTarifario()));
  tarView = initViewSwitcher('tar-view-switch', 'tarifario', 'tarjetas', v => { tarView = v; renderTarifario(); });
  tabsOcultasListo = cargarTabsOcultas();
  // Delegado sobre el contenedor: las tarjetas se repintan en cada filtro, así
  // que engancharlas una por una las dejaría sin listener al primer render.
  document.getElementById('tf-guardar')?.addEventListener('click', (e) => tarGuardarFicha(e.currentTarget));
  document.getElementById('tp-guardar')?.addEventListener('click', (e) => tarGuardarPromo(e.currentTarget));
  document.getElementById('tp-fecha-fin')?.addEventListener('change', tpAvisoFecha);
  setupTarAdmin();
}

/* ---------- Configuración de visibilidad de Tarifario (solo admin) ---------- */
const TAR_TAB_META = [
  { key: 'hotsale', label: 'Hot Sales' },
  { key: 'promo', label: 'Promociones' },
  { key: 'destino', label: 'Guías/Tours' },
  { key: 'hotel', label: 'Hoteles' },
  { key: 'paquete', label: 'Paquetes' },
  { key: 'boleteria', label: 'Boletería' },
];
let tabsOcultas = [], tabsOcultasListo = null;
async function cargarTabsOcultas() {
  const { data, error } = await sb.from('tarifario_config').select('value').eq('key', 'tabs_ocultas').single();
  tabsOcultas = (!error && Array.isArray(data?.value)) ? data.value : [];
  aplicarTabsOcultas();
}
function aplicarTabsOcultas() {
  document.querySelectorAll('#tar-tabs .seg').forEach(b => {
    const oculto = tabsOcultas.includes(b.dataset.tab);
    if (ROL === 'admin') b.classList.toggle('tab-oculta', oculto);
    else b.style.display = oculto ? 'none' : '';
  });
  if (ROL !== 'admin') {
    const activo = document.querySelector('#tar-tabs .seg.on');
    if (activo && tabsOcultas.includes(activo.dataset.tab)) {
      const primera = [...document.querySelectorAll('#tar-tabs .seg')].find(b => !tabsOcultas.includes(b.dataset.tab));
      primera?.click();
    }
  }
}
function setupTarAdmin() {
  const btn = document.getElementById('tar-admin-btn');
  if (!btn) return;
  btn.onclick = () => { openSheet('tar-admin-sheet'); renderTasTabs(); cargarTasItems(); };
  document.getElementById('tar-vigencias-btn')?.addEventListener('click', abrirRevisionVigencias);
  document.getElementById('tar-actualizador-btn')?.addEventListener('click', () => abrirActualizadorTarifario());
  document.getElementById('act-tabs')?.addEventListener('click', ev => {
    const t = ev.target.closest('.act-tab');
    if (t) actCambiarTab(t.dataset.atab);
  });
  // Delegado: las tarjetas de revisión se repintan enteras en cada acción, así
  // que enganchar listeners por tarjeta se perdería en el primer refresco.
  document.getElementById('actualizador-sheet')?.addEventListener('click', ev => {
    const ok = ev.target.closest('[data-act-ok]');
    if (ok) return actAprobar(ok.dataset.actOk, ok);
    const edit = ev.target.closest('[data-act-edit]');
    if (edit) return document.querySelector(`[data-act-editrow="${edit.dataset.actEdit}"]`)?.classList.toggle('on');
    const guardar = ev.target.closest('[data-act-guardar]');
    if (guardar) return actGuardarPrecio(guardar.dataset.actGuardar, guardar);
    const quitar = ev.target.closest('[data-act-quitar]');
    if (quitar) return actQuitar(quitar.dataset.actQuitar, quitar);
    const det = ev.target.closest('.act-h-det');
    if (det) det.classList.toggle('abierto');
    if (ev.target.closest('#act-activar')) return actActivarCarga();
    if (ev.target.closest('#act-revertir')) return actRevertirCarga();
  });
  document.getElementById('tas-close').onclick = () => closeSheet('tar-admin-sheet');
  let debTas; document.getElementById('tas-search').addEventListener('input', () => { clearTimeout(debTas); debTas = setTimeout(renderTasList, 200); });
}
function renderTasTabs() {
  document.getElementById('tas-tabs').innerHTML = TAR_TAB_META.map(t => {
    const oculto = tabsOcultas.includes(t.key);
    return `<div class="tas-tab-row"><span>${esc(t.label)}</span><button class="tas-toggle${oculto ? '' : ' on'}" data-tab="${t.key}"></button></div>`;
  }).join('');
  document.querySelectorAll('#tas-tabs .tas-toggle').forEach(b => b.onclick = () => toggleTabOculta(b.dataset.tab));
}
async function toggleTabOculta(key) {
  tabsOcultas = tabsOcultas.includes(key) ? tabsOcultas.filter(k => k !== key) : [...tabsOcultas, key];
  const { error } = await sb.from('tarifario_config').update({ value: tabsOcultas, updated_at: new Date().toISOString() }).eq('key', 'tabs_ocultas');
  if (error) { errToast('No se pudo guardar'); return; }
  renderTasTabs();
  aplicarTabsOcultas();
}
let tasItemsCache = null;
async function cargarTasItems() {
  const [{ data: prods }, { data: promos }] = await Promise.all([
    sb.from('productos').select('id,tipo,nombre,activo').neq('tipo', 'info').order('tipo').order('nombre'),
    sb.from('promociones').select('id,titulo,revisado').order('titulo'),
  ]);
  tasItemsCache = [
    ...(prods || []).map(p => ({ id: p.id, tabla: 'productos', campo: 'activo', tipo: p.tipo, nombre: p.nombre, visible: p.activo })),
    ...(promos || []).map(p => ({ id: p.id, tabla: 'promociones', campo: 'revisado', tipo: 'promo', nombre: p.titulo, visible: p.revisado })),
  ];
  renderTasList();
}
function renderTasList() {
  const q = val('tas-search').trim().toLowerCase();
  const items = (tasItemsCache || []).filter(x => !q || x.nombre.toLowerCase().includes(q));
  document.getElementById('tas-list').innerHTML = items.map(x => `<div class="tas-row"><span class="tas-row-tipo">${esc(TAR_TAB_LABEL[x.tipo] || x.tipo)}</span><span class="tas-row-nombre${x.visible ? '' : ' oculto'}">${esc(x.nombre)}</span><button class="tas-toggle${x.visible ? ' on' : ''}" data-id="${x.id}" data-tabla="${x.tabla}" data-campo="${x.campo}"></button></div>`).join('');
  document.querySelectorAll('#tas-list .tas-toggle').forEach(b => b.onclick = () => toggleTasItem(b));
}
async function toggleTasItem(btn) {
  const { id, tabla, campo } = btn.dataset;
  const item = tasItemsCache.find(x => String(x.id) === id && x.tabla === tabla);
  const nuevo = !item.visible;
  const { error } = await sb.from(tabla).update({ [campo]: nuevo }).eq('id', id);
  if (error) { errToast('No se pudo guardar'); return; }
  item.visible = nuevo;
  renderTasList();
  tarCache = {};
}
function actualizarVisibilidadFiltrosTarifario() {
  document.querySelectorAll('[data-tabs]').forEach(el => {
    el.toggleAttribute('data-hidden', !el.dataset.tabs.split(',').includes(tarTab));
  });
}

/* Chips de filtros activos (2026-08-19). En móvil el botón de filtros pasó a ser
   solo un ícono: sin estos chips no habría forma de saber qué filtros hay
   puestos, ni de sacar uno suelto, sin abrir la hoja entera. Mismo patrón que
   renderChips() en Leads, incluido el puntito naranja sobre el ícono. */
function tarChips() {
  const box = document.getElementById('tar-chips');
  if (!box) return;
  const g = id => document.getElementById(id);
  // Cada filtro solo aplica a algunas pestañas (data-tabs); si está oculto para
  // la pestaña abierta no debe contarse aunque tenga un valor viejo guardado.
  const visible = id => { const el = g(id); if (!el) return false; const c = el.closest('[data-tabs]'); return !c || !c.hasAttribute('data-hidden'); };
  const reset = (id, v) => { const el = g(id); if (!el) return; if (el.type === 'checkbox') el.checked = v; else el.value = v; renderTarifario(); };
  const chips = [];
  const push = (label, limpiar) => chips.push([label, limpiar]);
  if (visible('tar-f-destino') && val('tar-f-destino')) push('Destino: ' + val('tar-f-destino'), () => reset('tar-f-destino', ''));
  if (visible('tar-f-tipo') && val('tar-f-tipo')) push('Plan: ' + (TAG_LABEL[val('tar-f-tipo')] || val('tar-f-tipo')), () => reset('tar-f-tipo', ''));
  if (visible('tar-f-mes') && val('tar-f-mes')) push('Mes: ' + (MESL[Number(val('tar-f-mes')) - 1] || val('tar-f-mes')), () => reset('tar-f-mes', ''));
  if (visible('tar-f-precio') && val('tar-f-precio')) push('Hasta $' + val('tar-f-precio'), () => reset('tar-f-precio', ''));
  if (visible('tar-f-ninos') && g('tar-f-ninos')?.checked) push('Con niños gratis', () => reset('tar-f-ninos', false));
  // "Solo vigentes" viene marcado por defecto: lo que hay que avisar es cuando
  // se DESmarcó, porque ahí la lista trae cosas vencidas sin que se note.
  if (visible('tar-f-vigente') && g('tar-f-vigente') && !g('tar-f-vigente').checked) push('Incluye vencidas', () => reset('tar-f-vigente', true));
  g('tar-mfs-trigger')?.classList.toggle('con-filtros', chips.length > 0);
  if (!chips.length) { box.innerHTML = ''; return; }
  box.innerHTML = chips.map((c, i) => `<span class="fchip">${esc(c[0])} <b data-ci="${i}">✕</b></span>`).join('')
    + '<button class="clear-all" id="tar-chips-clear" type="button"><i class="fas fa-times"></i> Limpiar</button>';
  chips.forEach((c, i) => { box.querySelector(`b[data-ci="${i}"]`).onclick = c[1]; });
  g('tar-chips-clear').onclick = () => {
    ['tar-f-destino', 'tar-f-tipo', 'tar-f-mes', 'tar-f-precio'].forEach(id => { const el = g(id); if (el) el.value = ''; });
    const n = g('tar-f-ninos'); if (n) n.checked = false;
    const v = g('tar-f-vigente'); if (v) v.checked = true;
    renderTarifario();
  };
}
async function loadTarifario() {
  loadTarifarioInfo();
  if (tarCache[tarTab]) { renderTarifario(); return; }
  const loading = document.getElementById('tar-loading'), empty = document.getElementById('tar-empty'), grid = document.getElementById('tar-grid');
  empty.classList.remove('show'); loading.classList.add('show'); grid.style.display = 'none';
  // Boletería no es un `tipo`: los vuelos siguen siendo 'paquete' para que el
  // catálogo público los rutee igual. Se filtran por la bandera es_boleteria,
  // y por eso esta pestaña necesita su propio filtro en vez de .eq('tipo', ...).
  const selProductos = '*, tarifas(*), promociones(titulo,precio_texto,precio_desde_usd,vigencia_texto,fecha_fin_estimada,incluye_tags,ninos_gratis_cantidad,resumen_ia), producto_fotos(storage_path,orden,es_principal,activo)';
  const q = (tarTab === 'promo' || tarTab === 'hotsale')
    ? sb.from('promociones').select('*, promocion_fotos(storage_path,orden,es_principal,activo), productos(nombre,destino,producto_fotos(storage_path,orden,es_principal,activo))').order('titulo')
    : tarTab === 'boleteria'
    ? sb.from('productos').select(selProductos).eq('es_boleteria', true).order('nombre')
    : sb.from('productos').select(selProductos).eq('tipo', tarTab).eq('es_boleteria', false).order('nombre');
  const { data, error } = await q;
  loading.classList.remove('show'); grid.style.display = 'grid';
  if (error) { console.error(error); errToast('No se pudo cargar el tarifario'); return; }
  // Un paquete puede heredar las fotos de su hotel vinculado (productos.hotel_id)
  // — PostgREST no resuelve bien el embed self-join `productos!hotel_id` (siempre
  // devuelve la dirección "hijos", no el padre), así que se resuelve aparte con
  // un segundo fetch normal (sin ambigüedad de auto-relación) y se cuelga como
  // x.hotel para que fotosDe() lo use igual que si viniera embebido.
  if (tarTab === 'paquete') {
    const hotelIds = [...new Set(data.filter(x => x.hotel_id).map(x => x.hotel_id))];
    if (hotelIds.length) {
      const { data: hoteles } = await sb.from('productos').select('id, destino, producto_fotos(storage_path,orden,es_principal,activo)').in('id', hotelIds);
      const porId = Object.fromEntries((hoteles || []).map(h => [h.id, h]));
      data.forEach(x => { if (x.hotel_id) x.hotel = porId[x.hotel_id]; });
    }
  }
  tarCache[tarTab] = data;
  renderTarifario();
}
const TAG_LABEL = { todo_incluido: 'Todo incluido', solo_desayuno: 'Solo desayuno', media_pension: 'Media pensión', pension_completa: 'Pensión completa', ninos_gratis: 'Niños gratis', '2x1': '2x1', descuento: 'Descuento' };
const tagsHtml = tags => (tags || []).length ? `<div class="tar-tags">${tags.map(t => `<span class="tar-tag">${esc(TAG_LABEL[t] || t)}</span>`).join('')}</div>` : '';
// Fotos propias del ítem; si no tiene, hereda las de su hotel vinculado
// (promociones.producto_id o productos.hotel_id, ver push_to_supabase.py
// HOTEL_ALIASES) — nunca se inventa una foto para algo sin vínculo real.
// activo=false son reemplazadas (Bloque 7) -- se guardan como histórico en
// storage pero no deben volver a mostrarse. es_principal (Bloque 4) manda
// sobre el orden normal cuando el admin eligió una a mano.
const ordenarFotos = arr => (arr || []).filter(f => f.activo !== false).slice()
  .sort((a, b) => (b.es_principal ? 1 : 0) - (a.es_principal ? 1 : 0) || a.orden - b.orden);
// Propias si tiene, si no hereda del hotel vinculado -- mismo fallback en
// los dos casos reales (paquete/promo -> hotel), a diferencia de `a || b`
// que NO sirve acá porque un array vacío es truthy en JS.
const fotosRaw = x => {
  const propias = ordenarFotos(x.producto_fotos || x.promocion_fotos || []);
  if (propias.length) return propias;
  return ordenarFotos(x.productos?.producto_fotos || x.hotel?.producto_fotos || []);
};
const fotosDe = (x, ancho) => fotosRaw(x).map(f => ancho ? fotoMini(f.storage_path, ancho) : FOTOS_BASE + f.storage_path);
const tieneFotoPrincipalPropia = x => fotosRaw(x).some(f => f.es_principal);
// Cuando un hotel tiene varias promos, todas partían del mismo set de fotos
// en el mismo orden — se veían idénticas en portada. Se le asigna a cada
// promo del mismo hotel un índice de arranque distinto (0, 1, 2...) dentro
// de su propio set, así la portada varía sin inventar ni recortar fotos —
// el carrusel/lightbox de cada una sigue mostrando el set completo, solo
// empieza por una foto distinta.
function asignarPortadas(promos) {
  const porHotel = {};
  promos.forEach(x => { if (x.producto_id != null) (porHotel[x.producto_id] ??= []).push(x); });
  Object.values(porHotel).forEach(grupo => grupo.forEach((x, i) => { x._portadaIdx = i; }));
}
function fotosRotadas(x, ancho) {
  const fotos = fotosDe(x, ancho);
  if (!fotos.length) return fotos;
  // Si el admin marcó una foto principal a mano, esa decisión manda siempre
  // como portada -- no se rota cosméticamente por encima de ella.
  if (tieneFotoPrincipalPropia(x)) return fotos;
  const idx = (x._portadaIdx || 0) % fotos.length;
  return idx ? [...fotos.slice(idx), ...fotos.slice(0, idx)] : fotos;
}

/* ---------- Carrusel de fotos al hover (hoteles/promos/paquetes vinculados) ---------- */
const carruselPrecargadas = new Set();
// En conexión lenta/con ahorro de datos no tiene sentido precargar el set
// completo de fotos de una tarjeta con solo pasar el mouse — se limita a las
// primeras 2 (la siguiente se ve al toque/scroll natural del carrusel).
function conexionLenta() {
  const c = navigator.connection;
  if (!c) return false;
  return !!c.saveData || c.effectiveType === '2g' || c.effectiveType === 'slow-2g';
}
function precargarFotos(fotos) {
  const lista = conexionLenta() ? fotos.slice(0, 2) : fotos;
  lista.forEach(u => { if (!carruselPrecargadas.has(u)) { new Image().src = u; carruselPrecargadas.add(u); } });
}
// Cada renderTarifario() reemplaza #tar-grid entero (innerHTML) — si el mouse
// queda "adentro" de una tarjeta justo cuando eso pasa, el mouseleave de esa
// tarjeta ya removida nunca dispara y el setInterval quedaría corriendo para
// siempre sobre un nodo desconectado. Se trackean los timers activos acá para
// poder apagarlos todos de una vez al principio de cada render.
let carruselTimers = new Set();
function detenerCarruseles() { carruselTimers.forEach(t => clearInterval(t)); carruselTimers.clear(); }
// Sin mouse no hay hover — en touch (celular/tablet) el carrusel se controla
// con swipe (con dots visibles siempre, no solo al interactuar) en vez de
// auto-rotar solo. Auto-rotar 50 tarjetas a la vez en una grilla de celular
// sería pesado en gama media (pedido explícito de cuidar performance); swipe
// es más liviano y más "a propósito" que animar todo sin que nadie lo pida.
const esTouch = matchMedia('(hover: none)').matches;
function attachHoverCarousel(cardEl, mediaEl, fotos, setFoto, dotsEl) {
  if (dotsEl) dotsEl.innerHTML = fotos && fotos.length > 1 ? fotos.map((_, idx) => `<span class="carrusel-dot${idx === 0 ? ' on' : ''}"></span>`).join('') : '';
  if (!mediaEl || !fotos || fotos.length < 2) return;
  let timer = null, i = 0;
  // Crossfade real: clona el estado actual como "fantasma" fijo encima (mismo
  // rect en pantalla) que se desvanece mientras la foto nueva aparece debajo,
  // en vez de fundir a opacity:0 y recién ahí cambiar la foto (eso dejaba un
  // parpadeo al color de fondo entre una foto y otra, se sentía como corte).
  const crossfade = n => {
    i = (n + fotos.length) % fotos.length;
    const rect = mediaEl.getBoundingClientRect();
    const ghost = mediaEl.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.querySelector('.carrusel-dots')?.remove();
    Object.assign(ghost.style, { position: 'fixed', top: rect.top + 'px', left: rect.left + 'px', width: rect.width + 'px', height: rect.height + 'px', margin: '0', zIndex: '5', pointerEvents: 'none', transition: 'none', opacity: '1' });
    document.body.appendChild(ghost);
    setFoto(fotos[i]);
    mediaEl.style.transition = 'none';
    mediaEl.style.opacity = '0';
    // Fuerza al navegador a "fijar" opacity:1 (fantasma) y opacity:0 (foto
    // nueva) antes de animar — si no, ambos cambios de estilo quedan en el
    // mismo lote y la transición nunca llega a pintarse (salto instantáneo).
    void ghost.offsetWidth;
    void mediaEl.offsetWidth;
    requestAnimationFrame(() => {
      ghost.style.transition = 'opacity .35s ease';
      mediaEl.style.transition = 'opacity .35s ease';
      mediaEl.style.opacity = '1';
      ghost.style.opacity = '0';
    });
    setTimeout(() => ghost.remove(), 380);
    if (dotsEl) [...dotsEl.children].forEach((d, idx) => d.classList.toggle('on', idx === i));
  };
  if (esTouch) {
    let startX = null;
    mediaEl.addEventListener('touchstart', e => { precargarFotos(fotos); startX = e.touches[0].clientX; }, { passive: true });
    mediaEl.addEventListener('touchend', e => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 30) crossfade(i + (dx < 0 ? 1 : -1));
      startX = null;
    }, { passive: true });
    return;
  }
  cardEl.addEventListener('mouseenter', () => {
    precargarFotos(fotos);
    i = 0;
    timer = setInterval(() => crossfade(i + 1), 1100);
    carruselTimers.add(timer);
  });
  cardEl.addEventListener('mouseleave', () => {
    clearInterval(timer); carruselTimers.delete(timer); timer = null;
    if (i !== 0) crossfade(0);
  });
}
const DESTINO_ORDEN = ['Margarita', 'Coche', 'Los Roques', 'Mérida', 'Falcón', 'Canaima', 'Caracas'];
// Divide un párrafo de descripción en oraciones para mostrarlo como lista —
// parte en los espacios que siguen a . ! ? (nunca dentro de un número como
// "$150.000" porque ahí no hay espacio después del punto), así ningún
// caracter del texto original se pierde ni se reescribe.
function resumenBullets(texto) {
  if (!texto) return [];
  return texto.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
}
// Destino de un ítem del Tarifario según la pestaña: hotel lo trae directo,
// paquete/promo lo heredan del hotel vinculado (producto_id/hotel_id) cuando
// no tienen uno propio -- misma resolución para filtrar y para agrupar.
function destinoDe(x) {
  if (tarTab === 'promo' || tarTab === 'hotsale') return x.productos?.destino || null;
  if (tarTab === 'paquete') return x.destino || x.hotel?.destino || null;
  return x.destino || null;
}
// Nombre de hotel para agrupar Promociones -- si la promo está vinculada a
// un producto (hotel), usa su nombre; si no, cae al título de la propia
// promo (única señal de "hotel" que tiene una promo suelta sin vínculo).
function hotelDe(x) { return x.productos?.nombre || x.titulo || 'Otros'; }
// Mismo criterio "Hot Sale" que la página web (lib/promociones/hotSales.ts):
// entre las promos vigentes/revisadas, una por hotel (la más barata, porque
// ya llegan ordenadas por precio) y que tenga al menos 2 fotos -- si no,
// no hay material para destacarla. Nunca se inventa una etiqueta en la DB,
// se deriva igual en los dos lados.
function promosHotSales(promos) {
  const vistos = new Set(), out = [];
  promos.forEach(x => {
    if (x.revisado === false) return;
    const clave = x.producto_id != null ? x.producto_id : `promo:${x.id}`;
    if (vistos.has(clave)) return;
    if (fotosDe(x).length < 2) return;
    vistos.add(clave);
    out.push(x);
  });
  return out;
}
const hoy = () => new Date().toISOString().slice(0, 10);
const promoVigente = p => !p.fecha_fin_estimada || p.fecha_fin_estimada >= hoy();
// No hay fecha de INICIO de promo en el tarifario (solo fecha_fin_estimada) —
// "disponible en el mes X" se interpreta igual que el filtro de fechas del
// Cotizador: sigue vigente al menos hasta el primer día de ese mes. Sin fecha
// de fin registrada, se asume siempre disponible (nunca se inventa un rango).
function promoDisponibleEnMes(p, mesNum) {
  if (!p.fecha_fin_estimada) return true;
  const anio = new Date().getFullYear();
  const primerDia = `${anio}-${String(mesNum).padStart(2, '0')}-01`;
  return p.fecha_fin_estimada >= primerDia;
}

// Para hoteles: agrega datos de sus promos vinculadas (precio mínimo, tags, niños gratis, vigencia).
function agregarHotel(x) {
  const promos = x.promociones || [];
  const precios = promos.map(p => p.precio_desde_usd).filter(v => v != null);
  return {
    tags: [...new Set(promos.flatMap(p => p.incluye_tags || []))],
    precioMin: precios.length ? Math.min(...precios) : null,
    ninosMax: Math.max(0, ...promos.map(p => p.ninos_gratis_cantidad || 0)),
    algunaVigente: promos.length ? promos.some(promoVigente) : true,
  };
}

function renderTarifario() {
  detenerCarruseles();
  const q = val('tar-search').trim().toLowerCase();
  const data = tarCache[tarTab] || [];
  const fDestino = val('tar-f-destino'), fTipo = val('tar-f-tipo');
  const fPrecio = val('tar-f-precio') ? Number(val('tar-f-precio')) : null;
  const fMes = val('tar-f-mes') ? Number(val('tar-f-mes')) : null;
  const fNinos = document.getElementById('tar-f-ninos').checked;
  const fVigente = document.getElementById('tar-f-vigente').checked;

  let filtered = data.filter(x => {
    if (q && !(x.nombre || x.titulo || '').toLowerCase().includes(q) && !(x.destino || '').toLowerCase().includes(q)) return false;
    if (tarTab === 'hotel') {
      if (fDestino && x.destino !== fDestino) return false;
      const ag = agregarHotel(x);
      if (fTipo && !ag.tags.includes(fTipo)) return false;
      if (fPrecio != null && ag.precioMin != null && ag.precioMin > fPrecio) return false;
      if (fNinos && ag.ninosMax < 1) return false;
      if (fVigente && !ag.algunaVigente) return false;
    } else if (tarTab === 'promo') {
      if (fDestino && destinoDe(x) !== fDestino) return false;
      if (fTipo && !(x.incluye_tags || []).includes(fTipo)) return false;
      if (fPrecio != null && x.precio_desde_usd != null && x.precio_desde_usd > fPrecio) return false;
      if (fNinos && !(x.ninos_gratis_cantidad > 0)) return false;
      if (fVigente && !promoVigente(x)) return false;
      if (fMes != null && !promoDisponibleEnMes(x, fMes)) return false;
    } else if (tarTab === 'hotsale') {
      if (fDestino && destinoDe(x) !== fDestino) return false;
      if (fVigente && !promoVigente(x)) return false;
    } else if (tarTab === 'paquete') {
      if (fDestino && destinoDe(x) !== fDestino) return false;
      if (fPrecio != null) {
        const precioTarifa = (x.tarifas || [])[0]?.precio_desde_usd;
        if (precioTarifa != null && precioTarifa > fPrecio) return false;
      }
    } else if (fPrecio != null) {
      const precioTarifa = (x.tarifas || [])[0]?.precio_desde_usd;
      if (precioTarifa != null && precioTarifa > fPrecio) return false;
    }
    return true;
  });
  // Orden por defecto de Promociones: más económicas primero. Sin precio
  // numérico parseado (solo texto libre tipo "Consultar") va al final, no
  // se le inventa un valor para ordenarlo.
  if (tarTab === 'promo' || tarTab === 'hotsale') {
    filtered.sort((a, b) => {
      if (a.precio_desde_usd == null && b.precio_desde_usd == null) return 0;
      if (a.precio_desde_usd == null) return 1;
      if (b.precio_desde_usd == null) return -1;
      return a.precio_desde_usd - b.precio_desde_usd;
    });
    asignarPortadas(filtered);
  }
  if (tarTab === 'hotsale') filtered = promosHotSales(filtered);

  document.getElementById('tar-count').textContent = `${fmt(filtered.length)} ítems`;
  tarChips();
  document.getElementById('tar-empty').classList.toggle('show', filtered.length === 0);
  const grid = document.getElementById('tar-grid');
  if (tarTab === 'hotel') {
    // Contraídas por defecto (pedido explícito) -- son ~7 destinos con
    // decenas de hoteles cada uno, todas abiertas de arranque era una
    // pantalla larguísima de scroll antes de ver nada útil. renderTarifario()
    // se llama de nuevo en cada tecla del buscador/cambio de filtro y
    // reconstruye todo el innerHTML -- sin guardar qué destinos tenía
    // abiertos el usuario, cada re-render los cerraría todos de vuelta.
    const porDestino = {};
    filtered.forEach(x => (porDestino[destinoDe(x) || 'Otros'] ??= []).push(x));
    const destinos = [...new Set([...DESTINO_ORDEN, ...Object.keys(porDestino)])].filter(d => porDestino[d]?.length);
    grid.innerHTML = destinos.map(d => `<details class="tar-destino-block" data-destino="${esc(d)}"${tarDestinosAbiertos.has(d) ? ' open' : ''}>
      <summary class="tar-destino-header"><i class="fas fa-location-dot"></i> ${esc(d)} <span>${porDestino[d].length}</span><i class="fas fa-chevron-down tar-destino-caret"></i></summary>
      ${tarItemsWrapHtml(porDestino[d])}
    </details>`).join('');
    grid.querySelectorAll('.tar-destino-block').forEach(det => det.addEventListener('toggle', () => {
      const d = det.dataset.destino;
      if (det.open) tarDestinosAbiertos.add(d); else tarDestinosAbiertos.delete(d);
    }));
  } else if (tarTab === 'promo') {
    // Agrupado por hotel (no por destino): varias promos del mismo hotel
    // ya no aparecen sueltas mezcladas en el scroll -- quedan juntas bajo
    // su hotel, en <details> igual que la pestaña Hoteles (contraídas por
    // defecto, mismo motivo: decenas de hoteles de una vez es demasiado
    // scroll antes de ver algo útil).
    const porHotel = {};
    filtered.forEach(x => (porHotel[hotelDe(x)] ??= []).push(x));
    const hoteles = Object.keys(porHotel).sort((a, b) => {
      const pa = porHotel[a][0]?.precio_desde_usd, pb = porHotel[b][0]?.precio_desde_usd;
      if (pa == null && pb == null) return a.localeCompare(b, 'es');
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pa - pb;
    });
    grid.innerHTML = hoteles.map(h => `<details class="tar-destino-block" data-hotel="${esc(h)}"${tarHotelesAbiertos.has(h) ? ' open' : ''}>
      <summary class="tar-destino-header"><i class="fas fa-hotel"></i> ${esc(h)} <span>${porHotel[h].length}</span><i class="fas fa-chevron-down tar-destino-caret"></i></summary>
      ${tarItemsWrapHtml(porHotel[h])}
    </details>`).join('');
    grid.querySelectorAll('.tar-destino-block').forEach(det => det.addEventListener('toggle', () => {
      const h = det.dataset.hotel;
      if (det.open) tarHotelesAbiertos.add(h); else tarHotelesAbiertos.delete(h);
    }));
  } else if (tarTab === 'paquete') {
    const porDestino = {};
    filtered.forEach(x => (porDestino[destinoDe(x) || 'Otros'] ??= []).push(x));
    const destinos = [...new Set([...DESTINO_ORDEN, ...Object.keys(porDestino)])].filter(d => porDestino[d]?.length);
    grid.innerHTML = destinos.map(d => `<div class="tar-destino-header"><i class="fas fa-location-dot"></i> ${esc(d)} <span>${porDestino[d].length}</span></div>${tarItemsWrapHtml(porDestino[d])}`).join('');
  } else if (tarTab === 'destino') {
    // Nacionales primero (prioridad visual pedida), Internacionales después.
    // Un ítem sin region clasificada (no debería pasar, los 13 ya están
    // todos clasificados) cae en "Otros" al final en vez de desaparecer.
    const REGION_LABEL = { nacional: 'Nacionales', internacional: 'Internacionales' };
    const porRegion = {};
    filtered.forEach(x => (porRegion[x.region || 'otros'] ??= []).push(x));
    const orden = ['nacional', 'internacional', 'otros'].filter(r => porRegion[r]?.length);
    grid.innerHTML = orden.map(r => `<div class="tar-destino-header"><i class="fas fa-earth-americas"></i> ${esc(REGION_LABEL[r] || 'Otros')} <span>${porRegion[r].length}</span></div>${tarItemsWrapHtml(porRegion[r])}`).join('');
  } else {
    grid.innerHTML = tarItemsWrapHtml(filtered);
  }
  [...document.querySelectorAll('#tar-grid .tar-item')].forEach(el => {
    const x = filtered.find(x => String(x.id) === el.dataset.id);
    el.onclick = () => openProductoDrawer(x);
    // La policy RLS deja al admin ver también lo que él mismo ocultó (para
    // poder revertirlo) — sin esta marca se vería idéntico a lo visible y
    // parecería que ocultar no hizo nada.
    if (ROL === 'admin' && ((tarTab === 'promo' || tarTab === 'hotsale') ? x.revisado === false : x.activo === false)) {
      el.classList.add('tar-oculto-admin');
      el.insertAdjacentHTML('afterbegin', '<span class="tar-oculto-badge">Oculto</span>');
    }
    const fotos = fotosRotadas(x, 256);
    if (tarView === 'fichas') {
      const media = el.querySelector('.tf-media');
      if (media) attachHoverCarousel(el, media, fotos, url => { media.style.backgroundImage = `url('${url}')`; }, media.querySelector('.carrusel-dots'));
    } else if (tarView === 'tarjetas') {
      const media = el.querySelector('.tc-thumb');
      const dots = el.querySelector('.carrusel-dots');
      if (media && media.tagName === 'IMG') attachHoverCarousel(el, media, fotos, url => { media.src = url; }, dots);
    } else {
      const media = el.querySelector('.thr-thumb');
      if (media && media.tagName === 'IMG') attachHoverCarousel(el, media, fotos, url => { media.src = url; });
    }
  });
}
function tarItemsWrapHtml(items) {
  const html = items.map(x => tarView === 'lista' ? tarRowHtml(x) : tarView === 'fichas' ? tarFichaHtml(x) : tarCardHtml(x)).join('');
  const cls = tarView === 'lista' ? 'tar-hotel-list' : tarView === 'fichas' ? 'tar-fichas-grid' : 'tar-grid-sub';
  return `<div class="${cls}">${html}</div>`;
}
function tarRowHtml(x) {
  const esPromo = tarTab === 'promo' || tarTab === 'hotsale';
  const nombre = esPromo ? x.titulo : x.nombre;
  const foto = fotosRotadas(x, 256)[0];
  let tags = [], precioTxt = null, promosCount = 0;
  if (tarTab === 'hotel') {
    const ag = agregarHotel(x);
    tags = ag.tags; precioTxt = ag.precioMin != null ? `Desde $${ag.precioMin}` : null;
    promosCount = x.promociones?.length || 0;
  } else if (esPromo) {
    tags = x.incluye_tags || []; precioTxt = x.precio_texto || null;
  } else {
    precioTxt = (x.tarifas || [])[0]?.precio_texto || null;
  }
  return `<div class="tar-item tar-hotel-row" data-id="${x.id}">
    ${foto ? `<img class="thr-thumb" src="${esc(foto)}" alt="" loading="lazy">` : `<div class="thr-thumb thr-thumb-vacio"><i class="fas fa-${esPromo ? 'tag' : 'image'}"></i></div>`}
    <div class="thr-nombre">${esc(nombre)}</div>
    ${tags.length ? tagsHtml(tags) : '<span></span>'}
    ${promosCount ? `<div class="tc-promos"><i class="fas fa-tag"></i> ${promosCount} promo${promosCount > 1 ? 's' : ''}</div>` : ''}
    <div class="thr-precio${precioTxt == null ? ' sin-precio' : ''}">${precioTxt != null ? esc(precioTxt) : 'Consultar precio'}</div>
    <i class="fas fa-chevron-right"></i>
  </div>`;
}
function tarCardThumbHtml(foto, esPromo, destino) {
  const media = foto
    ? `<img class="tc-thumb" src="${esc(foto)}" alt="" loading="lazy">`
    : `<div class="tc-thumb tc-thumb-vacio"><i class="fas fa-${esPromo ? 'tag' : 'image'}"></i></div>`;
  // El destino va como chip sobre la foto y no como renglón del cuerpo: libera
  // una línea de texto y deja el dato donde el ojo ya está mirando.
  const chip = destino ? `<div class="tc-destino-chip"><i class="fas fa-location-dot"></i>${esc(destino)}</div>` : '';
  return `<div class="tc-media-wrap">${media}<div class="tc-media-scrim"></div>${chip}<div class="carrusel-dots"></div></div>`;
}

/* vigencia_texto es prosa cargada a mano ("Fecha de venta 4 de Junio al 15 de
   Septiembre; Fecha de disfrute 1 Agosto al 15 de Septiembre") y en la tarjeta
   se comía tres renglones corridos. Se parte en sus dos mitades con el MISMO
   criterio que ya usa fecha_venta_fin() en SQL (migración 20260730180000): el
   tramo de venta llega hasta que el texto empieza a hablar de disfrute.
   Si no se puede partir se devuelve tal cual -- nunca se pierde información por
   no poder parsearla, solo se muestra sin etiquetas. */
function vigenciaPartes(texto) {
  if (!texto) return [];
  const t = String(texto).trim();
  if (!t) return [];
  const corte = t.match(/(?:fechas?\s+de\s+|per[ií]odos?\s+de\s+)?disfrute\s*:?\s*/i);
  if (!corte) return [['', t]];
  const limpiar = s => s
    .replace(/^(?:fechas?\s+de\s+|per[ií]odos?\s+de\s+)?venta\s*:?\s*/i, '')
    .replace(/^[\s:;.,-]+|[\s;.,-]+$/g, '')
    .trim();
  const partes = [];
  const venta = limpiar(t.slice(0, corte.index));
  if (venta) partes.push(['Venta', venta]);
  const disfrute = limpiar(t.slice(corte.index + corte[0].length));
  if (disfrute) partes.push(['Disfrute', disfrute]);
  return partes.length ? partes : [['', t]];
}
function vigenciaHtml(texto) {
  const partes = vigenciaPartes(texto);
  if (!partes.length) return '';
  return `<div class="tc-fechas">${partes.map(([k, v]) =>
    `<div class="tc-fecha${k ? '' : ' tcf-crudo'}">${k ? `<span class="tcf-k">${esc(k)}</span>` : ''}<span class="tcf-v">${esc(v)}</span></div>`).join('')}</div>`;
}
function tarCardHtml(x) {
  if (tarTab === 'promo' || tarTab === 'hotsale') {
    // resumen_ia: descripción normalizada al mismo largo por IA (la misma que
    // usa la web pública). Por diseño NUNCA contiene precios -- el precio real
    // sale siempre de precio_texto, tal cual está cargado.
    return `<div class="tar-item tar-card" data-id="${x.id}">
      ${tarCardThumbHtml(fotosRotadas(x, 256)[0], true, destinoDe(x))}
      <div class="tc-body">
        <div class="tc-nombre">${esc(x.titulo)}</div>
        ${x.resumen_ia ? `<div class="tc-resumen-ia">${esc(x.resumen_ia)}</div>` : ''}
      </div>
      <div class="tc-pie">
        ${x.precio_texto ? `<div class="tc-precio">${esc(x.precio_texto)}</div>` : ''}
        ${vigenciaHtml(x.vigencia_texto)}
        ${tagsHtml(x.incluye_tags)}
      </div></div>`;
  }
  const tarifa = (x.tarifas || [])[0];
  const promos = x.promociones || [];
  const tagsHotel = [...new Set(promos.flatMap(p => p.incluye_tags || []))];
  const bullets = resumenBullets(x.descripcion);
  return `<div class="tar-item tar-card" data-id="${x.id}">
    ${tarCardThumbHtml(fotosDe(x, 256)[0], false, destinoDe(x))}
    <div class="tc-body">
      <div class="tc-nombre">${esc(x.nombre)}</div>
      ${bullets.length ? `<ul class="tc-resumen">${bullets.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
    </div>
    <div class="tc-pie">
      ${tarifa ? `<div class="tc-precio">${esc(tarifa.precio_texto)}</div>` : ''}
      ${vigenciaHtml(tarifa?.vigencia_texto)}
      ${promos.length ? `<div class="tc-promos"><i class="fas fa-tag"></i> ${promos.length} promoción${promos.length > 1 ? 'es' : ''} activa${promos.length > 1 ? 's' : ''}</div>` : ''}
      ${tagsHtml(tagsHotel)}
    </div></div>`;
}
function tarFichaHtml(x) {
  const esPromo = tarTab === 'promo' || tarTab === 'hotsale';
  const nombre = esPromo ? x.titulo : x.nombre;
  const foto = fotosRotadas(x, 256)[0];
  const tarifa = !esPromo ? (x.tarifas || [])[0] : null;
  const precio = esPromo ? x.precio_texto : tarifa?.precio_texto;
  const vigencia = esPromo ? x.vigencia_texto : tarifa?.vigencia_texto;
  const promos = !esPromo ? (x.promociones || []) : [];
  const tags = esPromo ? (x.incluye_tags || []) : [...new Set(promos.flatMap(p => p.incluye_tags || []))];
  return `<div class="tar-item tar-ficha" data-id="${x.id}">
    <div class="tf-media"${foto ? ` style="background-image:url('${esc(foto)}')"` : ''}>${!foto ? `<i class="fas fa-${esPromo ? 'tag' : 'image'}"></i>` : ''}<div class="carrusel-dots"></div></div>
    <div class="tf-body">
      <div class="tc-nombre">${esc(nombre)}</div>
      ${x.destino ? `<div class="tc-destino"><i class="fas fa-location-dot"></i> ${esc(x.destino)}</div>` : ''}
      ${!esPromo && x.descripcion ? `<ul class="tc-resumen tc-resumen-ficha">${resumenBullets(x.descripcion).map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      ${precio ? `<div class="tc-precio">${esc(precio)}</div>` : ''}
      ${vigenciaHtml(vigencia)}
      ${promos.length ? `<div class="tc-promos"><i class="fas fa-tag"></i> ${promos.length} promoción${promos.length > 1 ? 'es' : ''} activa${promos.length > 1 ? 's' : ''}</div>` : ''}
      ${tagsHtml(tags)}
    </div>
  </div>`;
}

/* ---------- Corregir la ficha (nombre, destino, descripción) ----------------
   El Tarifario era de solo lectura: arreglar el `destino` de Casa Vacacional
   Playa del Sur --que decía el nombre del propio hotel, y por eso no aparecía
   al filtrar por destino-- necesitó una migración a mano el 31/07/2026. Un
   error de tipeo no debería necesitar un programador.
   No toca precios: esos siguen saliendo del tarifario cargado. */
let TAR_EDIT_ID = null;

function tarAbrirEditorFicha(id) {
  const p = (tarCache[tarTab] || []).find(x => x.id === Number(id));
  if (!p) { errToast('No se encontró esa ficha'); return; }
  TAR_EDIT_ID = p.id;
  document.getElementById('tf-nombre').value = p.nombre || '';
  document.getElementById('tf-destino').value = p.destino || '';
  document.getElementById('tf-descripcion').value = p.descripcion || '';
  document.getElementById('tf-destinos').innerHTML =
    [...new Set((tarCache[tarTab] || []).map(x => x.destino).filter(Boolean))].sort()
      .map(d => `<option value="${esc(d)}">`).join('');
  window.closeDrawer(true);
  openSheet('tar-ficha-sheet');
}

/* ---------- Editar una promoción -------------------------------------------
   Las promociones son lo que más cambia --son las que se publican en reels e
   historias-- y eran lo único que no se podía tocar desde acá: para productos
   estaba "Corregir ficha", y para el precio de una promo solo el "Corregir
   precio" del Actualizador, que aparece unicamente si quedó marcada por
   revisar. Todo lo demás había que pedirlo.

   La fecha de fin es el campo que más importa y el que nadie ve: sin ella la
   promo se ofrece para siempre, y con ella se retira sola. */
let TAR_PROMO_ID = null;

function tarAbrirEditorPromo(id) {
  const p = (tarCache[tarTab] || []).find(x => x.id === Number(id));
  if (!p) { errToast('No se encontró esa promoción'); return; }
  TAR_PROMO_ID = p.id;
  document.getElementById('tp-titulo').value = p.titulo || '';
  document.getElementById('tp-precio').value = p.precio_texto || '';
  document.getElementById('tp-vigencia').value = p.vigencia_texto || '';
  document.getElementById('tp-fecha-fin').value = p.fecha_fin_estimada || '';
  document.getElementById('tp-moneda').value = p.moneda || 'USD';
  document.getElementById('tp-tags').value = (p.incluye_tags || []).join(', ');
  tpAvisoFecha();
  // El panel de detalle queda detrás mostrando los datos de antes: se cierra
  // para que no compitan en pantalla y para que al guardar no haya que cerrarlo.
  window.closeDrawer(true);
  openSheet('tar-promo-sheet');
}

// El margen de 7 días es una regla de negocio real (pedido del 19/07): una promo
// que se acaba en dos días genera falsa urgencia. Si la fecha cae adentro de ese
// margen, la promo deja de ofrecerse aunque técnicamente siga vigente -- y eso
// sorprende a cualquiera que no lo sepa, así que se avisa mientras se escribe.
function tpAvisoFecha() {
  const v = document.getElementById('tp-fecha-fin').value;
  const aviso = document.getElementById('tp-aviso-fecha');
  if (!v) {
    aviso.innerHTML = `<i class="fas fa-infinity"></i> Sin fecha, se ofrece hasta que alguien la baje a mano.`;
    aviso.className = 'ce-ayuda';
    return;
  }
  const dias = Math.round((new Date(v + 'T12:00:00') - new Date()) / 86400000);
  if (dias < 0) {
    aviso.innerHTML = `<i class="fas fa-circle-xmark"></i> Esa fecha ya pasó: la IA no la va a ofrecer.`;
    aviso.className = 'ce-ayuda';
    aviso.style.color = '#fca5a5';
  } else if (dias <= 7) {
    aviso.innerHTML = `<i class="fas fa-triangle-exclamation"></i> Faltan ${dias} día(s). La IA deja de ofrecer una promo cuando le quedan 7 o menos, así que esta no se va a mostrar.`;
    aviso.className = 'ce-ayuda';
    aviso.style.color = 'var(--amber)';
  } else {
    aviso.innerHTML = `<i class="fas fa-calendar-check"></i> Se va a ofrecer ${dias - 7} día(s) más y después se retira sola.`;
    aviso.className = 'ce-ayuda';
    aviso.style.color = '';
  }
}

async function tarGuardarPromo(btn) {
  const titulo = document.getElementById('tp-titulo').value.trim();
  const precio = document.getElementById('tp-precio').value.trim();
  if (!titulo) { errToast('El título no puede quedar vacío'); return; }
  if (!precio) { errToast('El precio no puede quedar vacío'); return; }
  const tags = document.getElementById('tp-tags').value
    .split(',').map(s => s.trim()).filter(Boolean);
  btn.disabled = true;
  const { data, error } = await sb.rpc('editar_promocion', {
    p_id: TAR_PROMO_ID,
    p_titulo: titulo,
    p_precio_texto: precio,
    p_vigencia_texto: document.getElementById('tp-vigencia').value.trim(),
    // Cadena vacía = quitarle la fecha de fin; el RPC distingue eso de "no tocar".
    p_fecha_fin: document.getElementById('tp-fecha-fin').value,
    p_incluye_tags: tags,
    p_moneda: document.getElementById('tp-moneda').value,
  });
  btn.disabled = false;
  if (error || !data?.ok) { errToast('No se pudo guardar: ' + (error?.message || data?.error || '')); return; }
  okToast('Promoción actualizada — la IA la usa desde el próximo mensaje');
  closeSheet('tar-promo-sheet');
  delete tarCache[tarTab];
  loadTarifario();
}

async function tarGuardarFicha(btn) {
  const nombre = document.getElementById('tf-nombre').value.trim();
  if (!nombre) { errToast('El nombre no puede quedar vacío'); return; }
  btn.disabled = true;
  const { data, error } = await sb.rpc('editar_ficha_producto', {
    p_id: TAR_EDIT_ID, p_nombre: nombre,
    p_destino: document.getElementById('tf-destino').value.trim(),
    p_descripcion: document.getElementById('tf-descripcion').value.trim(),
  });
  btn.disabled = false;
  if (error || !data?.ok) { errToast('No se pudo guardar: ' + (error?.message || data?.error || '')); return; }
  okToast('Ficha corregida — ya se ve así en la web y para la IA');
  closeSheet('tar-ficha-sheet');
  // El tarifario se cachea por pestaña: sin invalidar, la tarjeta seguiría
  // mostrando el valor viejo aunque la base ya tenga el nuevo.
  delete tarCache[tarTab];
  loadTarifario();
}
/* ---------- Galería (4 carpetas desplegables, mismo orden/categorías que Tarifario) ---------- */
// Bloque 6: antes solo cubría Hoteles. Ahora son 4 carpetas <details> (una
// por TAR_TAB_META) que arrancan cerradas -- una carpeta cerrada no dispara
// NINGÚN fetch de fotos hasta que se abre (ontoggle), así una carpeta con
// muchos ítems no carga de arranque junto con las otras 3. Dentro de cada
// carpeta se mantiene la paginación de a GAL_PER que ya evitaba el problema
// original (147 requests de fotos en un solo acceso, ver docs/pwa-audit).
const GAL_PER = 6;
const GAL_ICONS = { promo: 'fa-tag', destino: 'fa-map-location-dot', hotel: 'fa-hotel', paquete: 'fa-suitcase-rolling' };
const galEstado = {};
TAR_TAB_META.forEach(t => { galEstado[t.key] = { cargada: false, page: 0, total: 0 }; });
let galArmada = false;
async function loadGaleria() {
  if (galArmada) return;
  galArmada = true;
  // Espera a que termine de cargar tabs_ocultas (arranca en [] y se llena
  // async desde setupTarifarioTabs) -- si no, una carpeta que el admin
  // ocultó en Tarifario podría verse igual acá si Galería se abre primero.
  await tabsOcultasListo;
  const list = document.getElementById('gal-list');
  const cats = TAR_TAB_META.filter(t => !tabsOcultas.includes(t.key));
  if (!cats.length) { list.innerHTML = '<div class="tbl-state"><i class="fas fa-images"></i><div class="es-t">Sin categorías visibles</div></div>'; return; }
  list.innerHTML = cats.map(t => `
    <details class="gal-folder" data-cat="${t.key}">
      <summary><i class="fas ${GAL_ICONS[t.key]}"></i> ${esc(t.label)}<i class="fas fa-chevron-down gal-folder-caret"></i></summary>
      <div class="gal-folder-body">
        <div class="tbl-state skel-grid" id="gal-loading-${t.key}"><div class="skel-card"></div><div class="skel-card"></div><div class="skel-card"></div></div>
        <div class="tbl-state" id="gal-empty-${t.key}" style="display:none"><i class="fas fa-images"></i><div class="es-t">Sin fotos todavía en esta categoría</div></div>
        <div id="gal-cat-list-${t.key}"></div>
        <div class="pager" id="gal-pager-${t.key}"><button data-cat="${t.key}" class="gal-more-btn">Cargar más</button></div>
      </div>
    </details>`).join('');
  list.querySelectorAll('.gal-folder').forEach(det => det.addEventListener('toggle', () => {
    const key = det.dataset.cat;
    if (det.open && !galEstado[key].cargada) cargarGaleriaCategoria(key);
  }));
  list.querySelectorAll('.gal-more-btn').forEach(btn => btn.onclick = () => cargarGaleriaCategoria(btn.dataset.cat, true));
}
// Mismo shape de consulta que usa loadTarifario() por tab (incluida la
// herencia de fotos de paquete->hotel y promo->hotel vía fotosDe()), para no
// duplicar la lógica de vínculo -- reusa fotosDe/fotosRotadas ya probados.
async function fetchGaleriaPagina(key, from) {
  if (key === 'promo') {
    const { data, count, error } = await sb.from('promociones')
      .select('id, titulo, promocion_fotos(storage_path,orden,es_principal,activo), productos(producto_fotos(storage_path,orden,width,height,es_principal,activo))', { count: 'exact' })
      .order('titulo').range(from, from + GAL_PER - 1);
    return { data, count, error, nombreDe: x => x.titulo };
  }
  const q = sb.from('productos').select('id, nombre, hotel_id, producto_fotos(storage_path,orden,width,height,es_principal,activo)', { count: 'exact' }).eq('tipo', key).eq('activo', true).order('nombre').range(from, from + GAL_PER - 1);
  const { data, count, error } = await q;
  if (!error && key === 'paquete') {
    const hotelIds = [...new Set((data || []).filter(x => x.hotel_id && !x.producto_fotos?.length).map(x => x.hotel_id))];
    if (hotelIds.length) {
      const { data: hoteles } = await sb.from('productos').select('id, producto_fotos(storage_path,orden,width,height,es_principal,activo)').in('id', hotelIds);
      const porId = Object.fromEntries((hoteles || []).map(h => [h.id, h]));
      data.forEach(x => { if (x.hotel_id && porId[x.hotel_id]) x.hotel = porId[x.hotel_id]; });
    }
  }
  return { data, count, error, nombreDe: x => x.nombre };
}
async function cargarGaleriaCategoria(key, append) {
  const st = galEstado[key];
  const loading = document.getElementById(`gal-loading-${key}`), empty = document.getElementById(`gal-empty-${key}`),
    list = document.getElementById(`gal-cat-list-${key}`), pager = document.getElementById(`gal-pager-${key}`);
  if (!append) { st.page = 0; list.innerHTML = ''; empty.style.display = 'none'; }
  loading.classList.add('show');
  const from = st.page * GAL_PER;
  const { data, count, error, nombreDe } = await fetchGaleriaPagina(key, from);
  loading.classList.remove('show');
  if (error) { console.error(error); errToast('No se pudo cargar esta categoría de la galería'); return; }
  st.total = count ?? 0;
  const conFotos = (data || []).filter(x => fotosRaw(x).length);
  // cargada=true y page++ SIEMPRE, incluso si esta página en particular no
  // trajo ningún ítem con fotos -- si no, reabrir la carpeta la reintenta
  // desde la página 0 por siempre (ítems sin foto al principio del orden
  // alfabético la dejarían atascada, sin poder llegar nunca a los que sí
  // tienen). El botón "Cargar más" es lo que avanza a través de eso.
  st.cargada = true;
  st.page++;
  const hayMas = st.page * GAL_PER < st.total;
  if (!conFotos.length) {
    if (!append && !list.children.length && !hayMas) empty.style.display = '';
    pager.classList.toggle('show', hayMas);
    return;
  }
  empty.style.display = 'none';
  list.insertAdjacentHTML('beforeend', conFotos.map(x => {
    const fotos = fotosRaw(x);
    return `<div class="gal-hotel"><h2><i class="fas ${GAL_ICONS[key]}"></i> ${esc(nombreDe(x))}</h2>
      <div class="gal-masonry">${fotos.map(f => {
        const url = FOTOS_BASE + f.storage_path;
        const thumbUrl = fotoMini(f.storage_path, 640);
        const dims = f.width && f.height ? ` width="${f.width}" height="${f.height}"` : '';
        return `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(thumbUrl)}" alt="${esc(nombreDe(x))}" loading="lazy"${dims}></a>`;
      }).join('')}</div>
    </div>`;
  }).join(''));
  pager.classList.toggle('show', hayMas);
}
async function loadTarifarioInfo() {
  if (tarInfo) return;
  tarInfo = [];
  const { data, error } = await sb.from('productos').select('*').eq('tipo', 'info').order('nombre');
  if (error || !data || !data.length) return;
  tarInfo = data;
  const box = document.getElementById('tar-info-box'), list = document.getElementById('tar-info-list');
  box.style.display = '';
  list.innerHTML = data.map(x => `<div class="tar-info-item"><b>${esc(x.nombre)}</b>${esc(x.descripcion || '')}</div>`).join('');
}
function openProductoDrawer(x) {
  const esPromo = tarTab === 'promo' || tarTab === 'hotsale';
  const nombre = esPromo ? x.titulo : x.nombre;
  const tarifa = !esPromo ? (x.tarifas || [])[0] : null;
  const precio = esPromo ? x.precio_texto : tarifa?.precio_texto;
  const vigencia = esPromo ? x.vigencia_texto : tarifa?.vigencia_texto;
  const fotos = fotosRotadas(x, 256);
  const fotosOrig = fotosRotadas(x);
  document.getElementById('drawerContent').innerHTML = `
    <div class="dhead">${fotos[0] ? `<div class="dava" style="background-image:url('${esc(fotos[0])}')"></div>` : `<div class="dava" style="background:${ADV_COLORS[0]}22;color:${ADV_COLORS[0]}"><i class="fas fa-book-open"></i></div>`}<div><div class="dn">${esc(nombre)}</div>
      <div class="dm">${esc(x.destino || TAR_TAB_LABEL[tarTab])}</div></div></div>
    ${fotos.length ? `<div class="dgallery">${fotos.map((f, i) => `<img src="${esc(f)}" alt="" loading="lazy" data-drawer-foto="${i}">`).join('')}</div>` : ''}
    ${precio ? `<div class="dfield"><div class="dfi"><i class="fas fa-tag"></i></div><div><div class="dfl">Precio</div><div class="dfv dfv-rich">${formatearTexto(precio)}</div></div></div>` : ''}
    ${vigencia ? `<div class="dfield"><div class="dfi"><i class="fas fa-clock"></i></div><div><div class="dfl">Vigencia</div><div class="dfv dfv-rich">${formatearTexto(vigencia)}</div></div></div>` : ''}
    ${!esPromo && x.descripcion ? `<div class="dfield"><div class="dfi"><i class="fas fa-circle-info"></i></div><div><div class="dfl">Descripción</div><div class="dfv dfv-rich">${formatearTexto(x.descripcion)}</div></div></div>` : ''}
    ${!esPromo && x.requisitos ? `<div class="dfield"><div class="dfi"><i class="fas fa-triangle-exclamation"></i></div><div><div class="dfl">Requisitos</div><div class="dfv dfv-rich">${formatearTexto(x.requisitos)}</div></div></div>` : ''}
    ${esPromo ? tagsHtml(x.incluye_tags) : ''}
    ${!esPromo && (x.promociones || []).length ? `<div class="dfield"><div class="dfi"><i class="fas fa-gift"></i></div><div><div class="dfl">Promociones activas</div><div class="dfv" style="font-weight:500">${x.promociones.map(p => `<div style="margin-bottom:10px"><b>${esc(p.titulo)}</b>${p.precio_texto ? `<div class="dfv-rich" style="margin-top:4px">${formatearTexto(p.precio_texto)}</div>` : ''}${p.vigencia_texto ? `<div class="dfv-rich" style="margin-top:2px;color:var(--amber)">Vigencia: ${formatearTexto(p.vigencia_texto)}</div>` : ''}${tagsHtml(p.incluye_tags)}</div>`).join('')}</div></div></div>` : ''}
    ${ROL === 'admin' ? `
    <div class="edit-box" style="margin-top:16px">
      <div class="eb-title"><i class="fas fa-note-sticky"></i> Notas internas (solo admin)</div>
      <textarea id="tar-notas" class="ei" rows="3" placeholder="Notas propias, no vienen del tarifario automático..." data-original="${esc(x.notas || '')}">${esc(x.notas || '')}</textarea>
      <button class="dbtn save" id="tar-notas-save" type="button" style="margin-top:8px"><i class="fas fa-floppy-disk"></i> Guardar notas</button>
      <div class="eb-title" style="margin-top:16px"><i class="fas fa-images"></i> Fotos (solo admin)</div>
      <div id="tar-fotos-admin"><div class="muted" style="font-size:12.5px">Cargando...</div></div>
      ${!esPromo ? `
      <div class="eb-title" style="margin-top:16px"><i class="fas fa-video"></i> Video (piloto, solo admin)</div>
      <div id="tar-video-admin"><div class="muted" style="font-size:12.5px">Cargando...</div></div>` : ''}
      ${esPromo
        ? `<button class="dbtn gh" id="tar-editar-promo" type="button" style="margin-top:16px"><i class="fas fa-pen"></i> Editar esta promoción</button>`
        : `<button class="dbtn gh" id="tar-editar-ficha" type="button" style="margin-top:16px"><i class="fas fa-pen"></i> Corregir nombre, destino o descripción</button>`}
    </div>` : ''}
    <div class="dactions"><button class="dbtn gh" id="dCotizador"><i class="fas fa-comments"></i> Ir al Cotizador</button></div>
    <div style="font-size:11px;color:var(--muted2);margin-top:14px;text-align:center">Fuente: ${esc(x.fuente_archivo)}</div>`;
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBg').classList.add('open');
  navPush({ type: 'drawer' });
  document.getElementById('dCotizador').onclick = () => irAlCotizadorConOpcion(esPromo ? 'promociones' : 'productos', x.id, nombre);
  document.getElementById('tar-editar-ficha')?.addEventListener('click', () => tarAbrirEditorFicha(x.id));
  document.getElementById('tar-editar-promo')?.addEventListener('click', () => tarAbrirEditorPromo(x.id));
  document.querySelectorAll('[data-drawer-foto]').forEach(el => el.addEventListener('click', () => openLightbox(fotosOrig, +el.dataset.drawerFoto)));
  if (ROL === 'admin') {
    document.getElementById('tar-notas-save').onclick = () => guardarNotasTarifario(esPromo ? 'promociones' : 'productos', x.id);
    cargarFotosAdmin(esPromo ? 'promocion_fotos' : 'producto_fotos', esPromo ? 'promocion_id' : 'producto_id', x.id, esPromo ? 'promos' : 'hoteles');
    if (!esPromo) cargarVideoAdmin(x.id, x.video_url || null);
  }
}
// Piloto de video (ver docs/superpowers/specs/2026-08-06-mifafi-video-piloto-design.md):
// sube directo al Worker de fotos vía la Edge Function producto-video-subir,
// que valida rol admin y guarda productos.video_url. Un solo video por
// producto -- subir otro reemplaza al anterior.
const TAR_VIDEO_LIMITE = 25 * 1024 * 1024, TAR_VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm'];
const VIDEO_SUBIR_FN = 'https://begbjhrdbsqftbbleecb.functions.supabase.co/producto-video-subir';
function cargarVideoAdmin(productoId, videoUrl) {
  const box = document.getElementById('tar-video-admin');
  if (!box) return;
  box.innerHTML = `
    ${videoUrl ? `<video src="${esc(videoUrl)}" controls style="width:100%;border-radius:10px;max-height:220px;background:#000"></video>` : `<div class="muted" style="font-size:12.5px">Esta opción no tiene video cargado todavía.</div>`}
    <button type="button" class="dbtn gh" id="tar-video-agregar" style="margin-top:10px;width:100%"><i class="fas fa-plus"></i> ${videoUrl ? 'Reemplazar video' : 'Subir video'}</button>
    <input type="file" id="tar-video-file" accept="video/mp4,video/quicktime,video/webm" style="display:none">`;
  document.getElementById('tar-video-agregar').onclick = () => {
    const input = document.getElementById('tar-video-file');
    input.onchange = () => { if (input.files[0]) subirVideoProducto(productoId, input.files[0]); input.value = ''; };
    input.click();
  };
}
async function subirVideoProducto(productoId, file) {
  if (!TAR_VIDEO_MIME.includes(file.type)) { errToast('Formato no soportado. Usá MP4, MOV o WebM.'); return; }
  if (file.size > TAR_VIDEO_LIMITE) { errToast(`El video pesa ${(file.size / 1e6).toFixed(1)} MB. Máximo 25 MB (límite de Meta para adjuntos).`); return; }
  const btn = document.getElementById('tar-video-agregar');
  if (btn) { btn.disabled = true; btn.innerHTML = 'Subiendo... <i class="fas fa-spinner fa-spin"></i>'; }
  const { data: { session } } = await sb.auth.getSession();
  try {
    const res = await fetch(VIDEO_SUBIR_FN, {
      method: 'POST',
      headers: {
        'Content-Type': file.type,
        Authorization: `Bearer ${session?.access_token || ''}`,
        apikey: SUPABASE_KEY,
        'x-producto-id': String(productoId),
        'x-nombre-archivo': slugArchivo(file.name.replace(/\.[^.]+$/, '')) + (file.name.match(/\.[^.]+$/)?.[0] || '.mp4'),
      },
      body: file,
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.ok) { errToast('No se pudo subir el video: ' + (out?.error || res.status)); cargarVideoAdmin(productoId, null); return; }
    okToast('Video subido');
    delete tarCache[tarTab];
    cargarVideoAdmin(productoId, out.video_url);
  } catch (e) {
    errToast('No se pudo subir el video: ' + e.message);
    cargarVideoAdmin(productoId, null);
  }
}
async function guardarNotasTarifario(tabla, id) {
  const btn = document.getElementById('tar-notas-save');
  const notas = document.getElementById('tar-notas').value.trim();
  btn.disabled = true; btn.innerHTML = 'Guardando... <i class="fas fa-spinner fa-spin"></i>';
  const { error } = await sb.from(tabla).update({ notas: notas || null }).eq('id', id);
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar notas';
  if (error) { errToast('No se pudieron guardar las notas: ' + error.message); return; }
  okToast('Notas guardadas');
  document.getElementById('tar-notas').dataset.original = notas;
  delete tarCache[tarTab];
}
const TAR_FOTOS_LIMITE = 5 * 1024 * 1024, TAR_FOTOS_MIME = ['image/png', 'image/jpeg', 'image/webp'];
function slugArchivo(nombre) {
  return nombre.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'foto';
}
async function cargarFotosAdmin(tabla, fk, entidadId, prefijo) {
  const box = document.getElementById('tar-fotos-admin');
  const { data, error } = await sb.from(tabla).select('id,storage_path,orden,es_principal,origen').eq(fk, entidadId).eq('activo', true).order('es_principal', { ascending: false }).order('orden');
  if (!box) return; // el drawer se pudo haber cerrado mientras esto cargaba
  if (error) { box.innerHTML = '<div class="muted" style="font-size:12.5px">No se pudieron cargar las fotos</div>'; return; }
  // Antes, si la opción no tenía NINGUNA foto todavía, esto cortaba acá con
  // solo el mensaje y ni un botón -- "reemplazar" solo existe por cada foto
  // ya cargada, así que una opción nueva (0 fotos) no tenía ninguna forma de
  // subir la primera. Ahora "Agregar foto" siempre está, tenga 0 o más.
  const grid = data.length ? `<div class="tar-fotos-admin-grid">${data.map(f => `
    <div class="tfa-item" data-foto-id="${f.id}">
      <div class="tfa-img" style="background-image:url('${esc(fotoMini(f.storage_path, 256))}')">${f.es_principal ? '<span class="tfa-principal-badge"><i class="fas fa-star"></i> Principal</span>' : ''}${f.origen === 'ia_referencial' ? '<span class="tfa-principal-badge" style="left:auto;right:4px;background:rgba(139,92,246,.92)"><i class="fas fa-wand-magic-sparkles"></i> IA referencial</span>' : ''}</div>
      <div class="tfa-actions">
        ${f.es_principal ? '' : `<button type="button" class="tfa-btn" data-accion="principal" title="Marcar como principal"><i class="fas fa-star"></i></button>`}
        <button type="button" class="tfa-btn" data-accion="reemplazar" title="Reemplazar imagen"><i class="fas fa-rotate"></i></button>
        <button type="button" class="tfa-btn" data-accion="eliminar" title="Eliminar foto"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('')}</div>` : `<div class="muted" style="font-size:12.5px">${tabla === 'promocion_fotos' ? 'Esta promoción no tiene fotos propias — arriba se muestran las del hotel vinculado.' : 'Esta opción no tiene fotos cargadas todavía.'}</div>`;
  box.innerHTML = `${grid}
    <button type="button" class="dbtn gh" id="tar-foto-agregar" style="margin-top:10px;width:100%"><i class="fas fa-plus"></i> Agregar foto</button>
    <input type="file" id="tar-foto-file" accept="image/png,image/jpeg,image/webp" style="display:none">`;
  box.querySelectorAll('[data-accion="principal"]').forEach(btn => btn.onclick = () => marcarFotoPrincipal(tabla, fk, entidadId, +btn.closest('.tfa-item').dataset.fotoId, prefijo));
  box.querySelectorAll('[data-accion="reemplazar"]').forEach(btn => btn.onclick = () => {
    const fotoId = +btn.closest('.tfa-item').dataset.fotoId;
    const input = document.getElementById('tar-foto-file');
    input.onchange = () => { if (input.files[0]) reemplazarFoto(tabla, fk, entidadId, fotoId, prefijo, input.files[0]); input.value = ''; };
    input.click();
  });
  box.querySelectorAll('[data-accion="eliminar"]').forEach(btn => btn.onclick = () => {
    const fotoId = +btn.closest('.tfa-item').dataset.fotoId;
    const eraPrincipal = data.find(f => f.id === fotoId)?.es_principal ?? false;
    eliminarFoto(tabla, fk, entidadId, fotoId, prefijo, eraPrincipal);
  });
  document.getElementById('tar-foto-agregar').onclick = () => {
    const input = document.getElementById('tar-foto-file');
    input.onchange = () => { if (input.files[0]) agregarFoto(tabla, fk, entidadId, prefijo, data.length, input.files[0]); input.value = ''; };
    input.click();
  };
}
async function eliminarFoto(tabla, fk, entidadId, fotoId, prefijo, eraPrincipal) {
  if (!(await confirmarSheet({ titulo: '¿Eliminar esta foto?', detalle: 'No se puede deshacer desde aquí.', textoOk: 'Eliminar', destructivo: true }))) return;
  const box = document.getElementById('tar-fotos-admin');
  box.style.opacity = '.5';
  // Baja lógica, mismo patrón que reemplazarFoto -- nunca se borra el
  // archivo real de Storage, así que siempre queda forma de recuperarla a
  // mano desde la tabla si hiciera falta.
  const { error } = await sb.from(tabla).update({ activo: false, reemplazada_en: new Date().toISOString() }).eq('id', fotoId);
  if (error) {
    box.style.opacity = '1';
    errToast('No se pudo eliminar la foto: ' + error.message);
    return;
  }
  // Si la que se borró era la principal, la siguiente foto activa (por
  // orden) pasa a ser principal -- si no, la opción se queda sin ninguna
  // foto marcada como principal aunque le queden fotos activas.
  if (eraPrincipal) {
    const { data: siguiente } = await sb.from(tabla).select('id').eq(fk, entidadId).eq('activo', true).order('orden').limit(1).maybeSingle();
    if (siguiente) await sb.from(tabla).update({ es_principal: true }).eq('id', siguiente.id);
  }
  box.style.opacity = '1';
  okToast('Foto eliminada');
  delete tarCache[tarTab];
  cargarFotosAdmin(tabla, fk, entidadId, prefijo);
}
async function agregarFoto(tabla, fk, entidadId, prefijo, ordenSiguiente, file) {
  if (!TAR_FOTOS_MIME.includes(file.type)) { errToast('Formato no válido — solo PNG, JPG o WEBP'); return; }
  if (file.size > TAR_FOTOS_LIMITE) { errToast('La imagen pesa más de 5MB'); return; }
  const box = document.getElementById('tar-fotos-admin');
  box.style.opacity = '.5';
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.jpg';
  const storagePath = `${prefijo}/${entidadId}/manual-${Date.now()}-${slugArchivo(file.name.replace(/\.[^.]+$/, ''))}${ext.toLowerCase()}`;
  const { error: eUpload } = await sb.storage.from('tarifario-fotos').upload(storagePath, file, { contentType: file.type });
  if (eUpload) { box.style.opacity = '1'; errToast('No se pudo subir la imagen: ' + eUpload.message); return; }
  await subirDerivados(storagePath, file);
  // La primera foto que se agrega a una opción queda como principal
  // automáticamente (nadie eligió otra todavía); de ahí en adelante, no.
  const { error: eInsert } = await sb.from(tabla).insert({ [fk]: entidadId, storage_path: storagePath, orden: ordenSiguiente, es_principal: ordenSiguiente === 0, origen: 'manual' });
  if (eInsert) {
    box.style.opacity = '1';
    await sb.storage.from('tarifario-fotos').remove([storagePath, ...DERIVADOS_ANCHOS.map(a => rutaDerivado(storagePath, a))]);
    errToast('No se pudo registrar la imagen: ' + eInsert.message);
    return;
  }
  box.style.opacity = '1';
  okToast('Foto agregada');
  delete tarCache[tarTab];
  cargarFotosAdmin(tabla, fk, entidadId, prefijo);
}
async function marcarFotoPrincipal(tabla, fk, entidadId, fotoId, prefijo) {
  const box = document.getElementById('tar-fotos-admin');
  box.style.opacity = '.5';
  await sb.from(tabla).update({ es_principal: false }).eq(fk, entidadId).eq('es_principal', true);
  const { error } = await sb.from(tabla).update({ es_principal: true }).eq('id', fotoId);
  box.style.opacity = '1';
  if (error) { errToast('No se pudo marcar como principal: ' + error.message); return; }
  okToast('Foto principal actualizada');
  delete tarCache[tarTab];
  cargarFotosAdmin(tabla, fk, entidadId, prefijo);
}
async function reemplazarFoto(tabla, fk, entidadId, fotoIdViejo, prefijo, file) {
  if (!TAR_FOTOS_MIME.includes(file.type)) { errToast('Formato no válido — solo PNG, JPG o WEBP'); return; }
  if (file.size > TAR_FOTOS_LIMITE) { errToast('La imagen pesa más de 5MB'); return; }
  const box = document.getElementById('tar-fotos-admin');
  box.style.opacity = '.5';
  const { data: vieja, error: eVieja } = await sb.from(tabla).select('orden,es_principal').eq('id', fotoIdViejo).single();
  if (eVieja) { box.style.opacity = '1'; errToast('No se pudo leer la foto a reemplazar: ' + eVieja.message); return; }
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.jpg';
  const storagePath = `${prefijo}/${entidadId}/manual-${Date.now()}-${slugArchivo(file.name.replace(/\.[^.]+$/, ''))}${ext.toLowerCase()}`;
  const { error: eUpload } = await sb.storage.from('tarifario-fotos').upload(storagePath, file, { contentType: file.type });
  if (eUpload) { box.style.opacity = '1'; errToast('No se pudo subir la imagen: ' + eUpload.message); return; }
  await subirDerivados(storagePath, file);
  // La vieja se desactiva Y pierde es_principal ANTES de insertar la nueva —
  // el índice único parcial (una sola es_principal por producto/promoción)
  // rechaza el insert si las dos filas quedan marcadas principal a la vez.
  const { error: eDesactivar } = await sb.from(tabla).update({ activo: false, reemplazada_en: new Date().toISOString(), es_principal: false }).eq('id', fotoIdViejo);
  if (eDesactivar) {
    box.style.opacity = '1';
    await sb.storage.from('tarifario-fotos').remove([storagePath, ...DERIVADOS_ANCHOS.map(a => rutaDerivado(storagePath, a))]);
    errToast('No se pudo desactivar la imagen anterior: ' + eDesactivar.message);
    return;
  }
  const { error: eInsert } = await sb.from(tabla).insert({ [fk]: entidadId, storage_path: storagePath, orden: vieja.orden, es_principal: vieja.es_principal, origen: 'manual' });
  if (eInsert) {
    box.style.opacity = '1';
    await sb.storage.from('tarifario-fotos').remove([storagePath, ...DERIVADOS_ANCHOS.map(a => rutaDerivado(storagePath, a))]);
    // Best-effort: restaurar la vieja tal como estaba, para no dejar la
    // opción sin ninguna foto activa si el insert de la nueva falló.
    await sb.from(tabla).update({ activo: true, reemplazada_en: null, es_principal: vieja.es_principal }).eq('id', fotoIdViejo);
    errToast('No se pudo registrar la imagen nueva: ' + eInsert.message);
    return;
  }
  box.style.opacity = '1';
  okToast('Foto reemplazada');
  delete tarCache[tarTab];
  cargarFotosAdmin(tabla, fk, entidadId, prefijo);
}
// Deja al filtro "opción de Tarifario" del Cotizador ya elegida, con el
// chat enfocado y un mensaje sugerido, para no obligar a re-seleccionar
// lo mismo que ya se estaba viendo en el drawer del Tarifario.
function irAlCotizadorConOpcion(tabla, id, nombre) {
  window.closeDrawer(true);
  activateSection('cotizador');
  const sel = document.getElementById('cot-f-opcion');
  const valor = `${tabla}:${id}`;
  const aplicar = () => { if ([...sel.options].some(o => o.value === valor)) { sel.value = valor; return true; } return false; };
  if (!aplicar()) cargarOpcionesTarifario().then(aplicar);
  const input = document.getElementById('chat-input');
  input.value = `Cuéntame más sobre ${nombre}`;
  input.dispatchEvent(new Event('input'));
  input.focus();
}

/* ---------- Lightbox de fotos (drawer de producto + Galería) ---------- */
let lbFotos = [], lbIndex = 0, lbScale = 1, lbTX = 0, lbTY = 0;
const lbEl = () => document.getElementById('lightbox');
const lbImgEl = () => document.getElementById('lbImg');
function openLightbox(fotos, index) {
  if (!fotos || !fotos.length) return;
  lbFotos = fotos; lbIndex = Math.max(0, index);
  lbScale = 1; lbTX = 0; lbTY = 0;
  renderLightbox();
  lbEl().classList.add('open');
  document.body.classList.add('lb-lock');
  navPush({ type: 'lightbox' });
}
function closeLightbox(fromNav) {
  lbEl().classList.remove('open');
  document.body.classList.remove('lb-lock');
  if (!fromNav) navConsume();
}
function renderLightbox() {
  const img = lbImgEl();
  img.src = lbFotos[lbIndex];
  img.classList.toggle('zoomed', lbScale > 1);
  img.style.transform = `translate(${lbTX}px,${lbTY}px) scale(${lbScale})`;
  const multi = lbFotos.length > 1;
  document.getElementById('lbCounter').textContent = multi ? `${lbIndex + 1} / ${lbFotos.length}` : '';
  document.getElementById('lbCounter').style.display = multi ? '' : 'none';
  document.getElementById('lbPrev').style.display = multi ? '' : 'none';
  document.getElementById('lbNext').style.display = multi ? '' : 'none';
}
function lbNext() { if (lbFotos.length < 2) return; lbIndex = (lbIndex + 1) % lbFotos.length; lbScale = 1; lbTX = 0; lbTY = 0; renderLightbox(); }
function lbPrev() { if (lbFotos.length < 2) return; lbIndex = (lbIndex - 1 + lbFotos.length) % lbFotos.length; lbScale = 1; lbTX = 0; lbTY = 0; renderLightbox(); }
function setupLightbox() {
  const img = lbImgEl(), stage = document.getElementById('lbStage');
  document.getElementById('lbClose').onclick = () => closeLightbox();
  document.getElementById('lbNext').onclick = lbNext;
  document.getElementById('lbPrev').onclick = lbPrev;
  stage.addEventListener('click', e => { if (e.target === stage) closeLightbox(); });
  document.addEventListener('keydown', e => {
    if (!lbEl().classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') lbNext();
    else if (e.key === 'ArrowLeft') lbPrev();
  });

  // Zoom: doble click/doble tap alterna, rueda incrementa (desktop)
  img.addEventListener('dblclick', e => {
    e.preventDefault();
    lbScale = lbScale > 1 ? 1 : 2.4; lbTX = 0; lbTY = 0;
    renderLightbox();
  });
  img.addEventListener('wheel', e => {
    e.preventDefault();
    lbScale = Math.min(4, Math.max(1, lbScale + (e.deltaY < 0 ? 0.25 : -0.25)));
    if (lbScale === 1) { lbTX = 0; lbTY = 0; }
    renderLightbox();
  }, { passive: false });

  // Paniar con mouse cuando hay zoom
  let dragging = false, dragX = 0, dragY = 0, startTX = 0, startTY = 0;
  img.addEventListener('mousedown', e => {
    if (lbScale <= 1) return;
    dragging = true; dragX = e.clientX; dragY = e.clientY; startTX = lbTX; startTY = lbTY;
    img.classList.add('panning');
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    lbTX = startTX + (e.clientX - dragX); lbTY = startTY + (e.clientY - dragY);
    img.style.transform = `translate(${lbTX}px,${lbTY}px) scale(${lbScale})`;
  });
  window.addEventListener('mouseup', () => { dragging = false; img.classList.remove('panning'); });

  // Touch: 1 dedo sin zoom = swipe entre fotos; 1 dedo con zoom = paniar; 2 dedos = pinch-zoom
  let touchMode = null, pinchStartDist = 0, pinchStartScale = 1, touchStartX = 0, touchStartY = 0, panStartTX = 0, panStartTY = 0;
  const dist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  stage.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      touchMode = 'pinch'; pinchStartDist = dist(e.touches[0], e.touches[1]); pinchStartScale = lbScale;
    } else if (e.touches.length === 1) {
      touchMode = lbScale > 1 ? 'pan' : 'swipe';
      panStartTX = lbTX; panStartTY = lbTY;
      touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });
  stage.addEventListener('touchmove', e => {
    if (touchMode === 'pinch' && e.touches.length === 2) {
      e.preventDefault();
      lbScale = Math.min(4, Math.max(1, pinchStartScale * (dist(e.touches[0], e.touches[1]) / pinchStartDist)));
      img.classList.toggle('zoomed', lbScale > 1);
      img.style.transform = `translate(${lbTX}px,${lbTY}px) scale(${lbScale})`;
    } else if (touchMode === 'pan' && e.touches.length === 1) {
      e.preventDefault();
      lbTX = panStartTX + (e.touches[0].clientX - touchStartX);
      lbTY = panStartTY + (e.touches[0].clientY - touchStartY);
      img.style.transform = `translate(${lbTX}px,${lbTY}px) scale(${lbScale})`;
    }
  }, { passive: false });
  stage.addEventListener('touchend', e => {
    if (touchMode === 'swipe' && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStartX, dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) dx < 0 ? lbNext() : lbPrev();
    }
    if (touchMode === 'pinch' && lbScale <= 1.02) { lbScale = 1; lbTX = 0; lbTY = 0; renderLightbox(); }
    touchMode = null;
  });

  document.getElementById('drawerContent').addEventListener('click', e => {
    const a = e.target.closest('.dgallery a');
    if (!a) return;
    e.preventDefault();
    const fotos = [...a.parentElement.querySelectorAll('a')].map(x => x.href);
    openLightbox(fotos, fotos.indexOf(a.href));
  });
  document.getElementById('gal-list').addEventListener('click', e => {
    const a = e.target.closest('.gal-masonry a');
    if (!a) return;
    e.preventDefault();
    const fotos = [...a.closest('.gal-masonry').querySelectorAll('a')].map(x => x.href);
    openLightbox(fotos, fotos.indexOf(a.href));
  });
}

/* ---------- Dictado por voz (Bloque 9) — Web Speech API nativa, sin costo.
   Un solo helper para los 3 chats (Cotizador IA, Mensajes, Extractor IA) --
   cada uno solo pasa su botón y su campo de texto. ---------- */
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
// Lock compartido entre los 3 botones (no uno por closure) -- la mayoría de
// los navegadores solo permiten UNA sesión de reconocimiento de voz activa
// por vez en todo el sistema. Sin este lock, arrancar el mic de un chat
// mientras el de otro sigue escuchando (posible: cambiar de sección no para
// el reconocimiento en curso) podía matar la primera sesión por debajo sin
// que ese botón se enterara, dejándolo trabado en "escuchando" para siempre.
let vozActiva = null; // { rec, btn }
function attachVoiceInput(btn, campo) {
  if (!btn) return;
  if (!SpeechRecognitionCtor) { btn.style.display = 'none'; return; } // sin soporte -- no mostrar un botón que siempre falla
  btn.onclick = () => {
    if (vozActiva) {
      const eraEsteBoton = vozActiva.btn === btn;
      vozActiva.rec.stop();
      vozActiva = null;
      if (eraEsteBoton) return; // toggle: tocar de nuevo el mismo botón corta
    }
    const rec = new SpeechRecognitionCtor();
    rec.lang = 'es-419';
    rec.continuous = false; // el navegador corta solo tras el silencio -- sin timer propio
    rec.interimResults = false;
    vozActiva = { rec, btn };
    btn.classList.add('on');
    rec.onresult = e => {
      const texto = e.results[0]?.[0]?.transcript?.trim();
      if (!texto) return;
      const actual = campo.value.trim();
      campo.value = actual ? `${actual} ${texto}` : texto;
      // Dispara 'input' real -- cualquier listener ya existente en el campo
      // (auto-resize, contador de caracteres, etc.) reacciona solo, sin
      // que este helper necesite saber qué campo es ni qué hace cada uno.
      campo.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        errToast('Necesitamos permiso de micrófono para dictar — habilitalo en la configuración del navegador');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        errToast('No se pudo escuchar — intentá de nuevo');
      }
    };
    rec.onend = () => { btn.classList.remove('on'); if (vozActiva?.btn === btn) vozActiva = null; };
    try { rec.start(); } catch (_e) { btn.classList.remove('on'); if (vozActiva?.btn === btn) vozActiva = null; }
  };
}

/* ---------- Cotizador IA ---------- */
let chatHistory = [], chatActualId = null;
function setupChat() {
  const input = document.getElementById('chat-input');
  document.getElementById('chat-send').onclick = enviarChat;
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarChat(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  attachVoiceInput(document.getElementById('chat-mic-btn'), input);
  fill('cot-f-destino', DESTINO_ORDEN);
  cargarOpcionesTarifario();
  document.getElementById('cot-f-clear').onclick = () => {
    ['cot-f-destino', 'cot-f-tipo', 'cot-f-plan', 'cot-f-opcion', 'cot-f-precio', 'cot-f-desde', 'cot-f-hasta'].forEach(id => { document.getElementById(id).value = ''; });
  };
  document.getElementById('chat-history-btn').onclick = openChatsDrawer;
  document.getElementById('chat-new-btn').onclick = nuevoChat;
  if (!chatHistory.length) addChatBubble('bot', '¡Hola! Soy el Cotizador IA de Destino y Eventos Lotus 360. Estoy aquí para ayudarte con tus cotizaciones.');
}
function nuevoChat() {
  chatHistory = []; chatActualId = null;
  document.getElementById('chat-log').innerHTML = '';
  addChatBubble('bot', '¡Hola! Soy el Cotizador IA de Destino y Eventos Lotus 360. Estoy aquí para ayudarte con tus cotizaciones.');
}
/* ---------- Chats guardados del Cotizador IA (mis conversaciones) ---------- */
async function guardarChatIA() {
  if (chatActualId) {
    const { error } = await sb.from('chats_ia').update({ mensajes: chatHistory, updated_at: new Date().toISOString() }).eq('id', chatActualId);
    if (error) console.error('guardarChatIA update', error);
    return;
  }
  const primerMensaje = chatHistory.find(m => m.role === 'user')?.content || 'Conversación';
  const titulo = primerMensaje.length > 40 ? primerMensaje.slice(0, 40) + '…' : primerMensaje;
  const { data, error } = await sb.from('chats_ia').insert({ usuario_id: MI_USUARIO_ID, titulo, mensajes: chatHistory }).select('id').single();
  if (!error && data) chatActualId = data.id;
}
async function openChatsDrawer() {
  const box = document.getElementById('drawerContent');
  box.innerHTML = `<div class="dhead"><div class="dava" style="background:var(--accent-soft);color:var(--accent)"><i class="fas fa-clock-rotate-left"></i></div><div><div class="dn">Mis conversaciones</div><div class="dm">Cotizador IA</div></div></div><div id="chats-mine-list" class="es-s" style="padding:14px 0">Cargando...</div>`;
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBg').classList.add('open');
  navPush({ type: 'drawer' });
  const { data, error } = await sb.from('chats_ia').select('id,titulo,updated_at').eq('usuario_id', MI_USUARIO_ID).order('updated_at', { ascending: false });
  const list = document.getElementById('chats-mine-list');
  if (error) { list.textContent = 'No se pudieron cargar tus conversaciones'; return; }
  if (!data.length) { list.textContent = 'Todavía no guardaste ninguna conversación'; return; }
  list.className = '';
  list.innerHTML = data.map(c => `<div class="strike-row" data-id="${c.id}" style="cursor:pointer"><span>${esc(c.titulo || 'Conversación')}<br><span class="muted" style="font-size:11px">${esc(fmtFechaHoraCaracas(c.updated_at))}</span></span><i class="fas fa-chevron-right"></i></div>`).join('');
  list.querySelectorAll('[data-id]').forEach(el => el.addEventListener('click', () => abrirChatGuardado(Number(el.dataset.id))));
}
async function abrirChatGuardado(id) {
  const { data, error } = await sb.from('chats_ia').select('id,mensajes').eq('id', id).single();
  if (error || !data) { errToast('No se pudo abrir esa conversación'); return; }
  chatActualId = data.id;
  chatHistory = data.mensajes || [];
  const log = document.getElementById('chat-log');
  log.innerHTML = '';
  chatHistory.forEach(m => addChatBubble(m.role === 'user' ? 'user' : 'bot', m.content));
  window.closeDrawer(true);
  activateSection('cotizador');
}
// Lista de cada hotel/paquete/promo/guía-tour individual, agrupada por
// categoría, para el filtro "opción de Tarifario" del Cotizador. Solo
// ítems visibles (activo/revisado) — un ítem que el admin ocultó no
// debe poder pedirse ni desde acá aunque el rol pueda verlo en Tarifario.
async function cargarOpcionesTarifario() {
  const sel = document.getElementById('cot-f-opcion');
  if (!sel) return;
  const [{ data: prods }, { data: promos }] = await Promise.all([
    sb.from('productos').select('id,tipo,nombre').neq('tipo', 'info').eq('activo', true).order('nombre'),
    sb.from('promociones').select('id,titulo').eq('revisado', true).order('titulo'),
  ]);
  const grupos = { promo: [], destino: [], hotel: [], paquete: [] };
  (prods || []).forEach(p => grupos[p.tipo]?.push({ value: `productos:${p.id}`, label: p.nombre }));
  (promos || []).forEach(p => grupos.promo.push({ value: `promociones:${p.id}`, label: p.titulo }));
  const previo = sel.value;
  // "Hot Sales" (TAR_TAB_META) no es una categoría propia de la DB -- es un
  // subconjunto derivado de promociones (ver promosHotSales) -- no tiene
  // bucket en `grupos`, se salta con optional chaining en vez de agregarle
  // un grupo fantasma vacío al Cotizador.
  sel.innerHTML = '<option value="">Cualquier opción de Tarifario</option>' + TAR_TAB_META.map(t => grupos[t.key]?.length ? `<optgroup label="${esc(t.label)}">${grupos[t.key].map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</optgroup>` : '').join('');
  if (previo && [...sel.options].some(o => o.value === previo)) sel.value = previo;
}
// Filtros elegidos en la interfaz (no en texto libre) — se mandan como
// parámetros estructurados al Cotizador, que los aplica ANTES de dejar que
// la IA razone sobre el pedido en lenguaje natural del cliente.
function leerFiltrosCotizador() {
  const opcion = val('cot-f-opcion');
  const [opcionTabla, opcionId] = opcion ? opcion.split(':') : [null, null];
  return {
    destino: val('cot-f-destino') || null,
    tipo: val('cot-f-tipo') || null,
    plan: val('cot-f-plan') || null,
    opcionTabla: opcionTabla || null,
    opcionId: opcionId ? Number(opcionId) : null,
    precioMax: val('cot-f-precio') ? Number(val('cot-f-precio')) : null,
    fechaDesde: val('cot-f-desde') || null,
    fechaHasta: val('cot-f-hasta') || null,
  };
}
async function enviarChat() {
  const input = document.getElementById('chat-input'), btn = document.getElementById('chat-send');
  const histBtn = document.getElementById('chat-history-btn'), newBtn = document.getElementById('chat-new-btn');
  const texto = input.value.trim();
  if (!texto || btn.disabled) return;
  addChatBubble('user', texto);
  chatHistory.push({ role: 'user', content: texto });
  input.value = ''; input.style.height = 'auto';
  // Bloquea "Mis chats"/"Nuevo chat" mientras se espera la respuesta: si el
  // usuario cambia de conversación a mitad de una espera, chatHistory se
  // reasigna por debajo y la respuesta que llega después se cuelga en el
  // chat equivocado (o corrompe uno guardado que ni siquiera es este).
  btn.disabled = true; histBtn.disabled = true; newBtn.disabled = true;
  const loadingEl = addChatBubble('bot', 'Pensando...', true);
  const { data, error } = await sb.functions.invoke('cotizador-chat', { body: { messages: chatHistory, filtros: leerFiltrosCotizador() } });
  loadingEl.remove();
  btn.disabled = false; histBtn.disabled = false; newBtn.disabled = false;
  if (error || !data?.respuesta) { addChatBubble('bot', await mensajeErrorCotizador(data, error)); return; }
  // El prompt puede pedirle al modelo separar una intro corta de un bloque
  // de datos con "---BLOQUE---" (ver REGLA DURA #3 en cotizador-chat) --
  // cada parte se muestra como su propia burbuja en vez de un solo mensaje
  // largo, sin necesitar tool-calling ni turnos extra del modelo.
  const partes = data.respuesta.split('---BLOQUE---').map(p => p.trim()).filter(Boolean);
  (partes.length ? partes : [data.respuesta]).forEach(parte => addChatBubble('bot', parte));
  if (data.opciones?.length) addChatOpcionesCards(data.opciones);
  if (data.voucher_datos) addChatVoucherSuggestion(data.voucher_datos);
  chatHistory.push({ role: 'assistant', content: data.respuesta });
  await guardarChatIA();
}
// Botón que aparece cuando el Cotizador IA ya tiene los datos principales del
// cliente y el asesor confirmó que cerró (ver REGLA DURA #4 en cotizador-chat)
// -- prellena el formulario de Voucher ya existente, el asesor completa lo
// que falte (documento, forma de pago) y genera el PDF con el flujo de siempre.
function addChatVoucherSuggestion(datos) {
  const log = document.getElementById('chat-log');
  const row = document.createElement('div');
  row.className = 'chat-row';
  row.innerHTML = '<span class="chat-avatar"><i class="fas fa-wand-magic-sparkles"></i></span>';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-sm';
  btn.style.marginLeft = '8px';
  btn.innerHTML = '<i class="fas fa-file-pdf"></i> Prellenar Voucher';
  btn.onclick = () => prellenarVoucherDesdeChat(datos);
  row.appendChild(btn);
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
}
function prellenarVoucherDesdeChat(datos) {
  activateSection('voucher');
  const MAPA = {
    cliente_nombre: 'vc-cliente-nombre', destino_hospedaje: 'vc-destino',
    fecha_entrada: 'vc-fecha-entrada', fecha_salida: 'vc-fecha-salida',
    modalidad: 'vc-modalidad', total_dias: 'vc-total-dias',
    adultos: 'vc-adultos', ninos: 'vc-ninos', total_general: 'vc-total-general',
  };
  for (const [campo, id] of Object.entries(MAPA)) {
    const el = document.getElementById(id);
    if (el && datos[campo] != null && datos[campo] !== '') el.value = datos[campo];
  }
  okToast('Voucher prellenado, revisá y completá lo que falte');
}
// Tarjetas de comparación (máx 2, hoteles distintos -- ver
// fotosParaOpcionesComparadas en cotizador-chat) con foto real del tarifario,
// mismas clases visuales que la grilla del Tarifario (tc-thumb/tc-nombre/tc-precio).
function addChatOpcionesCards(opciones) {
  const log = document.getElementById('chat-log');
  const row = document.createElement('div');
  row.className = 'chat-row';
  row.innerHTML = '<span class="chat-avatar"><i class="fas fa-wand-magic-sparkles"></i></span>';
  const wrap = document.createElement('div');
  wrap.className = 'cot-cards';
  wrap.innerHTML = opciones.map(op => {
    // op.foto llega de cotizador-chat (edge function) como URL completa al
    // original (FOTOS_BASE + storage_path) -- se reescribe acá al derivado
    // chico en vez de tocar esa función, mismo motivo que fotoMini arriba.
    const fotoMiniOp = op.foto && op.foto.startsWith(FOTOS_BASE) ? fotoMini(op.foto.slice(FOTOS_BASE.length), 256) : op.foto;
    return `
    <div class="cot-card">
      ${fotoMiniOp ? `<img class="tc-thumb" src="${esc(fotoMiniOp)}" alt="" loading="lazy">` : `<div class="tc-thumb tc-thumb-vacio"><i class="fas fa-${op.tipo === 'promocion' ? 'tag' : 'image'}"></i></div>`}
      <div class="tc-nombre">${esc(op.titulo)}</div>
      ${op.precio_texto ? `<div class="tc-precio">${esc(op.precio_texto)}</div>` : ''}
    </div>
  `;
  }).join('');
  row.appendChild(wrap);
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
}
// Cuando el status no es 2xx, supabase-js deja `data` en null y el body real
// queda en `error.context`.
async function mensajeErrorCotizador(data, error) {
  let code = data?.error;
  if (!code && error?.context?.json) {
    try { code = (await error.context.json())?.error; } catch { /* body no era JSON, se usa el mensaje genérico */ }
  }
  const MSG = {
    timeout_ia: 'El cotizador tardó demasiado en responder, intenta de nuevo.',
    error_ia: 'No se pudo conectar con la IA, intenta de nuevo en un momento.',
    error_tarifario: 'No se pudo consultar el tarifario, intenta de nuevo.',
    sin_respuesta: 'La IA no devolvió una respuesta, intenta de nuevo.',
    no_autenticado: 'Tu sesión expiró, volvé a iniciar sesión.',
    no_configurado: 'El cotizador no está disponible en este momento.',
    body_invalido: 'Ocurrió un error inesperado, intenta de nuevo.',
    sin_mensajes: 'Escribe un mensaje antes de enviar.',
  };
  return MSG[code] || 'No pude conectar con el cotizador, intenta de nuevo en un momento.';
}
// Red de seguridad visual: aunque el prompt le pide a Gemini no usar markdown
// pesado, a veces igual manda **negritas** o encabezados con #. En vez de
// mostrarlos literales (feo, símbolos sueltos), se limpian/convierten acá.
function renderBotText(texto) {
  return esc(texto)
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/^[*•]\s+/gm, '- ');
}
function addChatBubble(who, texto, loading) {
  const log = document.getElementById('chat-log');
  const div = document.createElement('div');
  div.className = `chat-msg ${who}${loading ? ' loading' : ''}`;
  if (who === 'bot' && !loading) div.innerHTML = renderBotText(texto);
  else div.textContent = texto;
  let el = div;
  if (who === 'bot') {
    const row = document.createElement('div');
    row.className = 'chat-row';
    row.innerHTML = '<span class="chat-avatar"><i class="fas fa-wand-magic-sparkles"></i></span>';
    row.appendChild(div);
    log.appendChild(row);
    el = row;
  } else {
    log.appendChild(div);
  }
  log.scrollTop = log.scrollHeight;
  return el;
}

/* ---------- Mensajes (chat interno del staff) ---------- */
const ADJUNTO_LIMITE = 20 * 1024 * 1024;
const ICONO_EXT = { pdf: 'fa-file-pdf', doc: 'fa-file-word', docx: 'fa-file-word', xls: 'fa-file-excel', xlsx: 'fa-file-excel', ppt: 'fa-file-powerpoint', pptx: 'fa-file-powerpoint', zip: 'fa-file-zipper', rar: 'fa-file-zipper' };
const fmtHoraChat = iso => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
let msgConversaciones = [];
let msgActual = null;
let msgMensajes = [];
let msgLecturasPorMensaje = {};
let msgParticipantesActual = [];
let msgUrlsAdjuntos = {};
let msgUsuariosStaff = null;
let msgChannelConv = null;

function setupMensajes() {
  document.getElementById('msg-nuevo-btn').addEventListener('click', abrirPickerNuevoChat);
  document.getElementById('msg-conv-back').addEventListener('click', () => cerrarConversacion());
  document.getElementById('msg-attach-btn').addEventListener('click', () => openSheet('msg-attach-sheet'));
  document.getElementById('msg-attach-foto').addEventListener('click', () => { closeSheet('msg-attach-sheet'); document.getElementById('msg-file-foto').click(); });
  document.getElementById('msg-attach-doc').addEventListener('click', () => { closeSheet('msg-attach-sheet'); document.getElementById('msg-file-doc').click(); });
  document.getElementById('msg-file-foto').addEventListener('change', e => { if (e.target.files[0]) subirAdjunto(e.target.files[0]); e.target.value = ''; });
  document.getElementById('msg-file-doc').addEventListener('change', e => { if (e.target.files[0]) subirAdjunto(e.target.files[0]); e.target.value = ''; });
  const input = document.getElementById('msg-input');
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensajeTexto(); } });
  attachVoiceInput(document.getElementById('msg-mic-btn'), input);
  document.getElementById('msg-send-btn').addEventListener('click', enviarMensajeTexto);
  sb.channel('mensajes-badge').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, () => cargarBandeja(true)).subscribe();
}

async function cargarUsuariosStaff() {
  if (msgUsuariosStaff) return msgUsuariosStaff;
  const { data, error } = await sb.rpc('usuarios_chat');
  msgUsuariosStaff = error ? [] : (data || []);
  return msgUsuariosStaff;
}
function nombreUsuario(id) { return (msgUsuariosStaff || []).find(u => u.id === id)?.nombre || 'Alguien'; }

async function cargarBandeja(soloBadge) {
  const { data, error } = await sb.rpc('mis_conversaciones');
  if (error) { if (!soloBadge) errToast('No se pudieron cargar los mensajes'); return; }
  msgConversaciones = data || [];
  const noLeidos = msgConversaciones.reduce((a, c) => a + (c.no_leidos || 0), 0);
  const badge = document.getElementById('nav-msg-count');
  badge.textContent = noLeidos > 99 ? '99+' : String(noLeidos);
  badge.style.display = noLeidos ? '' : 'none';
  if (!soloBadge) renderBandeja();
}
function fmtHoraMsg(iso) {
  const d = new Date(iso), hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return fmtHoraChat(iso);
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit' }).format(d);
}
const MSG_PREVIEW_ICONO = { imagen: '📷 Foto', video: '🎥 Video', documento: '📄 Documento' };
function renderBandeja() {
  const cont = document.getElementById('msg-inbox');
  if (!msgConversaciones.length) { cont.innerHTML = '<div class="msg-empty"><i class="fas fa-comments"></i><br>Sin conversaciones todavía</div>'; return; }
  cont.innerHTML = msgConversaciones.map(c => {
    const esGrupo = c.tipo === 'grupo', um = c.ultimo_mensaje;
    const cuerpo = !um ? 'Sin mensajes todavía' : (um.tipo === 'texto' ? esc(um.contenido || '') : (MSG_PREVIEW_ICONO[um.tipo] || ''));
    const preview = um?.es_mio ? 'Tú: ' + cuerpo : cuerpo;
    return `
    <div class="msg-inbox-row ${esGrupo ? 'grupo' : ''}" data-conv="${c.conversacion_id}">
      <div class="msg-avatar ${esGrupo ? 'grupo' : ''}">${esGrupo ? '<i class="fas fa-users"></i>' : esc(initials(c.nombre))}</div>
      <div class="msg-inbox-body">
        <div class="msg-inbox-top">
          <div class="msg-inbox-nombre">${esc(c.nombre || 'Sin nombre')}</div>
          ${um ? `<div class="msg-inbox-hora">${fmtHoraMsg(um.created_at)}</div>` : ''}
        </div>
        <div class="msg-inbox-preview"><span>${preview}</span></div>
      </div>
      ${c.no_leidos ? `<div class="msg-inbox-badge">${c.no_leidos}</div>` : ''}
    </div>`;
  }).join('');
  cont.querySelectorAll('.msg-inbox-row').forEach(row => row.addEventListener('click', () => {
    const c = msgConversaciones.find(x => x.conversacion_id === Number(row.dataset.conv));
    if (c) abrirConversacion(c);
  }));
}

async function abrirPickerNuevoChat() {
  const lista = await cargarUsuariosStaff();
  const candidatos = lista.filter(u => u.id !== MI_USUARIO_ID);
  document.getElementById('msg-picker-list').innerHTML = candidatos.map(u => `
    <div class="msg-picker-row" data-uid="${u.id}">
      <div class="msg-avatar">${esc(initials(u.nombre))}</div>
      <div><div class="msg-picker-nombre">${esc(u.nombre)}</div><div class="msg-picker-rol">${esc(u.rol)}</div></div>
    </div>`).join('') || '<div class="msg-empty">No hay contactos disponibles</div>';
  document.querySelectorAll('#msg-picker-list .msg-picker-row').forEach(row => row.addEventListener('click', async () => {
    closeSheet('msg-nuevo-sheet');
    const { data: convId, error } = await sb.rpc('obtener_o_crear_conversacion_directa', { p_otro_usuario_id: row.dataset.uid });
    if (error) { errToast('No se pudo iniciar el chat'); return; }
    const u = candidatos.find(x => x.id === row.dataset.uid);
    await cargarBandeja();
    abrirConversacion({ conversacion_id: convId, tipo: 'directo', nombre: u.nombre, otro_usuario_id: u.id });
  }));
  openSheet('msg-nuevo-sheet');
}

// miGen/msgAbrirGen: si el usuario abre una conversación y vuelve atrás antes
// de que resuelvan sus awaits, cerrarConversacion incrementa msgAbrirGen y esta
// llamada en vuelo se aborta en vez de pisar el estado de lo que se ve ahora
// (o marcar como leídos mensajes que el usuario nunca llegó a ver).
let msgAbrirGen = 0;
async function abrirConversacion(c) {
  const miGen = ++msgAbrirGen;
  msgActual = c;
  document.getElementById('msg-conv-titulo').textContent = c.nombre || 'Sin nombre';
  document.getElementById('msg-conv-sub').textContent = c.tipo === 'grupo' ? 'Grupo · todo el staff' : 'Chat individual';
  const soloLectura = c.tipo === 'grupo' && ROL !== 'admin';
  document.getElementById('msg-inputbar').style.display = soloLectura ? 'none' : 'flex';
  document.getElementById('msg-readonly-note').style.display = soloLectura ? 'flex' : 'none';
  document.getElementById('msg-conv').classList.add('open');
  navPush({ type: 'msg-conv' });

  await cargarUsuariosStaff();
  const [{ data: participantes }, { data: mensajes }] = await Promise.all([
    sb.from('conversacion_participantes').select('usuario_id').eq('conversacion_id', c.conversacion_id),
    sb.from('mensajes').select('*').eq('conversacion_id', c.conversacion_id).order('created_at'),
  ]);
  const ids = (mensajes || []).map(m => m.id);
  const lecturasRes = ids.length ? await sb.from('mensaje_lecturas').select('mensaje_id,usuario_id').in('mensaje_id', ids) : { data: [] };
  await cargarUrlsAdjuntos((mensajes || []).filter(m => m.storage_path));
  if (miGen !== msgAbrirGen) return; // se cerró/cambió de conversación mientras esto cargaba

  msgParticipantesActual = (participantes || []).map(p => p.usuario_id);
  msgMensajes = mensajes || [];
  msgLecturasPorMensaje = {};
  (lecturasRes.data || []).forEach(l => { (msgLecturasPorMensaje[l.mensaje_id] ??= []).push(l.usuario_id); });
  renderConversacion();
  marcarMensajesAjenosComoLeidos();
  suscribirConversacion(c.conversacion_id);
}
function cerrarConversacion(fromNav) {
  msgAbrirGen++; // invalida cualquier abrirConversacion() todavía en vuelo
  document.getElementById('msg-conv').classList.remove('open');
  if (msgChannelConv) { sb.removeChannel(msgChannelConv); msgChannelConv = null; }
  msgActual = null;
  if (!fromNav) navConsume();
  cargarBandeja();
}
function suscribirConversacion(conversacionId) {
  if (msgChannelConv) sb.removeChannel(msgChannelConv);
  msgChannelConv = sb.channel('mensajes-conv-' + conversacionId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `conversacion_id=eq.${conversacionId}` }, async payload => {
      if (msgMensajes.some(m => m.id === payload.new.id)) return;
      msgMensajes.push(payload.new);
      if (payload.new.storage_path) await cargarUrlsAdjuntos([payload.new]);
      renderConversacion();
      if (payload.new.remitente_id !== MI_USUARIO_ID) marcarMensajesAjenosComoLeidos();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensaje_lecturas' }, payload => {
      const l = payload.new;
      if (!msgMensajes.some(m => m.id === l.mensaje_id)) return;
      marcarLocalComoLeido(l.mensaje_id, l.usuario_id);
      renderConversacion();
    })
    .subscribe();
}
function marcarLocalComoLeido(mensajeId, usuarioId) {
  (msgLecturasPorMensaje[mensajeId] ??= []);
  if (!msgLecturasPorMensaje[mensajeId].includes(usuarioId)) msgLecturasPorMensaje[mensajeId].push(usuarioId);
}
async function marcarMensajesAjenosComoLeidos() {
  const pendientes = msgMensajes.filter(m => m.remitente_id !== MI_USUARIO_ID && !(msgLecturasPorMensaje[m.id] || []).includes(MI_USUARIO_ID));
  if (!pendientes.length) return;
  await Promise.all(pendientes.map(async m => {
    const { error } = await sb.rpc('marcar_leido', { p_mensaje_id: m.id });
    if (!error) marcarLocalComoLeido(m.id, MI_USUARIO_ID);
  }));
  renderConversacion();
  cargarBandeja(true);
}

async function cargarUrlsAdjuntos(mensajesConArchivo) {
  const paths = mensajesConArchivo.map(m => m.storage_path).filter(p => p && !msgUrlsAdjuntos[p]);
  if (!paths.length) return;
  const { data, error } = await sb.storage.from('chat-interno-adjuntos').createSignedUrls(paths, 3600);
  if (error) { errToast('No se pudieron cargar algunos adjuntos'); return; }
  (data || []).forEach(d => { if (d.signedUrl) msgUrlsAdjuntos[d.path] = d.signedUrl; });
}
function formatBytes(n) {
  if (!n) return '';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}
function iconoPorExtension(nombre) {
  const ext = (nombre || '').split('.').pop().toLowerCase();
  return ICONO_EXT[ext] || 'fa-file';
}
function etiquetaDia(fecha) {
  const hoy = new Date(), ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (fecha.toDateString() === hoy.toDateString()) return 'Hoy';
  if (fecha.toDateString() === ayer.toDateString()) return 'Ayer';
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: 'long', year: 'numeric' }).format(fecha);
}
function reproducirVideo(el) {
  const video = el.querySelector('video');
  el.querySelector('.msg-video-play')?.remove();
  video.setAttribute('controls', '');
  video.play();
}

function renderBurbuja(m, esMio, agrupado, esUltimoDelGrupo, todosLeyeron, nombreRemitente) {
  const clases = `chat-msg ${esMio ? 'mine' : 'other'}${agrupado ? ' grouped' : ''}${esUltimoDelGrupo ? ' tail' : ''}${m.tipo !== 'texto' ? ' adjunto' : ''} msg-new`;
  const hora = fmtHoraChat(m.created_at);
  // Un solo timestamp al final del grupo de burbujas consecutivas del mismo remitente, no uno por mensaje.
  const meta = esUltimoDelGrupo ? `<div class="msg-meta"><span>${hora}</span>${esMio ? `<span class="msg-tick${todosLeyeron ? ' leido' : ''}">${todosLeyeron ? '✓✓' : '✓'}</span>` : ''}</div>` : '';
  const sender = nombreRemitente ? `<div class="msg-sender">${esc(nombreRemitente)}</div>` : '';
  const url = msgUrlsAdjuntos[m.storage_path] || '';
  let cuerpo;
  if (m.tipo !== 'texto' && !url) cuerpo = `${sender}<div class="msg-doc"><i class="fas fa-triangle-exclamation"></i><div><div class="msg-doc-nombre">${esc(m.nombre_archivo || 'Adjunto')}</div><div class="msg-doc-peso">No se pudo cargar</div></div></div>${meta}`;
  else if (m.tipo === 'imagen') cuerpo = `${sender}<img class="msg-img" src="${esc(url)}" data-img="${esc(url)}">${m.contenido ? `<div style="padding:4px 4px 0">${esc(m.contenido)}</div>` : ''}${meta}`;
  else if (m.tipo === 'video') cuerpo = `${sender}<div class="msg-video-wrap" data-video><video src="${esc(url)}" preload="metadata"></video><div class="msg-video-play"><i class="fas fa-play"></i></div></div>${meta}`;
  else if (m.tipo === 'documento') cuerpo = `${sender}<div class="msg-doc" data-doc="${esc(url)}"><i class="fas ${iconoPorExtension(m.nombre_archivo)}"></i><div><div class="msg-doc-nombre">${esc(m.nombre_archivo || 'Archivo')}</div><div class="msg-doc-peso">${formatBytes(m.peso_bytes)}</div></div></div>${meta}`;
  else cuerpo = `${sender}<div>${esc(m.contenido || '')}</div>${meta}`;
  return `<div class="${clases}">${cuerpo}</div>`;
}
function renderConversacion() {
  const log = document.getElementById('msg-conv-log');
  const scrollAbajo = log.scrollTop + log.clientHeight >= log.scrollHeight - 40;
  const esGrupo = msgActual?.tipo === 'grupo';
  const otrosParticipantes = msgParticipantesActual.filter(id => id !== MI_USUARIO_ID);
  let html = '', diaAnterior = null, remitenteAnterior = null;
  msgMensajes.forEach((m, i) => {
    const fecha = new Date(m.created_at), diaKey = fecha.toDateString();
    if (diaKey !== diaAnterior) { html += `<div class="msg-date-chip">${etiquetaDia(fecha)}</div>`; diaAnterior = diaKey; remitenteAnterior = null; }
    const esMio = m.remitente_id === MI_USUARIO_ID;
    const agrupado = remitenteAnterior === m.remitente_id;
    const sig = msgMensajes[i + 1];
    const esUltimoDelGrupo = !sig || sig.remitente_id !== m.remitente_id || new Date(sig.created_at).toDateString() !== diaKey;
    const lecturas = msgLecturasPorMensaje[m.id] || [];
    const todosLeyeron = otrosParticipantes.length > 0 && otrosParticipantes.every(id => lecturas.includes(id));
    const nombreRemitente = esGrupo && !esMio && !agrupado ? nombreUsuario(m.remitente_id) : null;
    html += renderBurbuja(m, esMio, agrupado, esUltimoDelGrupo, todosLeyeron, nombreRemitente);
    remitenteAnterior = m.remitente_id;
  });
  log.innerHTML = html || '<div class="chat-empty"><i class="fas fa-comment-dots"></i>Todavía no hay mensajes en esta conversación</div>';
  log.querySelectorAll('[data-img]').forEach(el => el.addEventListener('click', () => openLightbox([el.dataset.img], 0)));
  log.querySelectorAll('[data-video]').forEach(el => el.addEventListener('click', () => reproducirVideo(el)));
  log.querySelectorAll('[data-doc]').forEach(el => el.addEventListener('click', () => window.open(el.dataset.doc, '_blank')));
  if (scrollAbajo) log.scrollTop = log.scrollHeight;
}

async function enviarMensajeTexto() {
  const input = document.getElementById('msg-input');
  const texto = input.value.trim();
  if (!texto || !msgActual) return;
  input.value = ''; input.style.height = 'auto';
  const { data, error } = await sb.rpc('enviar_mensaje', { p_conversacion_id: msgActual.conversacion_id, p_tipo: 'texto', p_contenido: texto });
  if (error || !data?.ok) { errToast('No se pudo enviar el mensaje'); input.value = texto; input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; return; }
  // El eco de este INSERT también llega por el canal realtime de la conversación (suscribirConversacion);
  // ese handler ya chequea por id antes de empujar, así que este push optimista no duplica la burbuja.
  if (!msgMensajes.some(m => m.id === data.id)) {
    msgMensajes.push({ id: data.id, conversacion_id: msgActual.conversacion_id, remitente_id: MI_USUARIO_ID, tipo: 'texto', contenido: texto, created_at: new Date().toISOString() });
    renderConversacion();
  }
}
async function subirAdjunto(file) {
  if (!msgActual) return;
  if (file.size > ADJUNTO_LIMITE) { errToast('El archivo supera los 20MB — redúcelo antes de subirlo'); return; }
  const attachBtn = document.getElementById('msg-attach-btn');
  attachBtn.disabled = true; attachBtn.classList.add('msg-attach-uploading');
  try {
    const tipo = file.type.startsWith('image/') ? 'imagen' : file.type.startsWith('video/') ? 'video' : 'documento';
    const path = `${msgActual.conversacion_id}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await sb.storage.from('chat-interno-adjuntos').upload(path, file);
    if (upErr) { errToast('No se pudo subir el archivo'); return; }
    const { data, error } = await sb.rpc('enviar_mensaje', { p_conversacion_id: msgActual.conversacion_id, p_tipo: tipo, p_storage_path: path, p_nombre_archivo: file.name, p_peso_bytes: file.size });
    if (error || !data?.ok) {
      await sb.storage.from('chat-interno-adjuntos').remove([path]); // evita huérfanos en el bucket si el RPC falla
      errToast('No se pudo enviar el adjunto');
      return;
    }
    if (!msgMensajes.some(m => m.id === data.id)) {
      msgMensajes.push({ id: data.id, conversacion_id: msgActual.conversacion_id, remitente_id: MI_USUARIO_ID, tipo, storage_path: path, nombre_archivo: file.name, peso_bytes: file.size, created_at: new Date().toISOString() });
      await cargarUrlsAdjuntos([{ storage_path: path }]);
      renderConversacion();
    }
  } finally {
    attachBtn.disabled = false; attachBtn.classList.remove('msg-attach-uploading');
  }
}

/* ---------- Voucher (Bloque 15 — disponible para admin y asesor, gate por ROL) ----------
   La página 1 (datos variables) se genera con jsPDF+autotable; las páginas 2-4
   (términos y condiciones fijos) se copian tal cual de voucher-terminos.pdf con
   pdf-lib -- nunca se reescribe ese texto legal a mano. Ambas libs se cargan
   perezosas (mismo patrón que ensureChart), solo cuando se entra a esta sección. */
let voucherLibsPromise = null;
function ensureVoucherLibs() {
  if (window.jspdf && window.PDFLib) return Promise.resolve();
  if (voucherLibsPromise) return voucherLibsPromise;
  const cargarScript = src => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  voucherLibsPromise = cargarScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js')
    .then(() => cargarScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'))
    .then(() => cargarScript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'))
    // Si un solo intento falla (CDN caído, red cortada), no dejar la promesa
    // rota cacheada para siempre -- el próximo llamado a ensureVoucherLibs()
    // tiene que poder reintentar la carga en vez de heredar el rechazo viejo.
    .catch(e => { voucherLibsPromise = null; throw e; });
  return voucherLibsPromise;
}
const VC_PAGE_SIZE = 20;
let vcOffset = 0;
let vcSearchTimer = null;
function setupVoucher() {
  document.getElementById('vc-buscar')?.addEventListener('input', () => {
    clearTimeout(vcSearchTimer); vcSearchTimer = setTimeout(() => { vcOffset = 0; cargarHistorialVouchers(false); }, 280);
  });
  document.getElementById('vc-filtro-desde')?.addEventListener('change', () => { vcOffset = 0; cargarHistorialVouchers(false); });
  document.getElementById('vc-filtro-hasta')?.addEventListener('change', () => { vcOffset = 0; cargarHistorialVouchers(false); });
}
async function loadVoucherSeccion() {
  const sel = document.getElementById('vc-asesor');
  const optHtml = (nombre, sel_) => `<option value="${esc(nombre)}" ${nombre === sel_ ? 'selected' : ''}>${esc(nombre)}</option>`;
  if (ROL === 'admin') {
    const preSel = ACTIVOS.includes(MI_NOMBRE) ? MI_NOMBRE : ACTIVOS[0];
    sel.innerHTML = ACTIVOS.map(n => optHtml(n, preSel)).join('');
    sel.disabled = false;
  } else {
    sel.innerHTML = optHtml(MI_NOMBRE, MI_NOMBRE);
    sel.disabled = true;
  }
  vcOffset = 0;
  await cargarHistorialVouchers(false);
}
function vcQueryBase() {
  let q = sb.from('vouchers').select('numero_factura,created_at,asesor_nombre,cliente_nombre,destino_hospedaje,total_general,pdf_path');
  // Sin comas/paréntesis -- romperían la sintaxis del filtro .or() de PostgREST.
  const buscar = (val('vc-buscar') || '').trim().replace(/[,()]/g, '');
  if (buscar) q = q.or(`cliente_nombre.ilike.%${buscar}%,asesor_nombre.ilike.%${buscar}%`);
  const desde = val('vc-filtro-desde'), hasta = val('vc-filtro-hasta');
  if (desde) q = q.gte('created_at', desde);
  if (hasta) q = q.lt('created_at', new Date(new Date(hasta).getTime() + 86400000).toISOString().slice(0, 10));
  return q;
}
async function cargarHistorialVouchers(append) {
  const tbody = document.getElementById('vc-historial-tbody');
  const masBtn = document.getElementById('vc-cargar-mas-btn');
  // Solo la carga inicial muestra el skeleton -- "Cargar más" (append=true)
  // agrega filas al final de una lista que ya se ve, tapar todo con el
  // skeleton ahí se vería como que se perdió lo que ya estaba.
  if (!append) document.getElementById('vc-historial-loading')?.classList.add('show');
  const { data, error } = await vcQueryBase()
    .order('created_at', { ascending: false })
    .range(vcOffset, vcOffset + VC_PAGE_SIZE - 1);
  document.getElementById('vc-historial-loading')?.classList.remove('show');
  if (error) { if (!append) tbody.innerHTML = ''; return; }
  const filas = (data || []).map(v => `<tr>
    <td data-label="N° Factura">${fmt(v.numero_factura)}</td>
    <td data-label="Fecha" class="muted">${esc((v.created_at || '').replace('T', ' ').slice(0, 16))}</td>
    <td data-label="Asesor">${esc(v.asesor_nombre)}</td>
    <td class="td-name">${esc(v.cliente_nombre)}</td>
    <td data-label="Destino">${esc(v.destino_hospedaje || '—')}</td>
    <td data-label="Total">${v.total_general != null ? '$' + fmt(v.total_general) : '—'}</td>
    <td class="td-acciones"><button class="btn-sm" type="button" onclick="verVoucherPdf('${(v.pdf_path || '').replace(/'/g, "\\'")}', ${v.numero_factura})">${v.pdf_path ? 'Ver PDF' : 'Reconstruir'}</button></td>
  </tr>`).join('');
  tbody.innerHTML = append ? tbody.innerHTML + filas : filas;
  if (masBtn) masBtn.style.display = (data || []).length < VC_PAGE_SIZE ? 'none' : '';
  await actualizarBadgeVoucher();
}
function cargarMasVouchers() { vcOffset += VC_PAGE_SIZE; cargarHistorialVouchers(true); }
window.cargarMasVouchers = cargarMasVouchers;
window.verVoucherPdf = async function verVoucherPdf(pdfPath, numeroFactura) {
  if (pdfPath) {
    const { data, error } = await sb.storage.from('vouchers-pdf').createSignedUrl(pdfPath, 60);
    if (error || !data?.signedUrl) { errToast('No se pudo abrir el PDF'); return; }
    window.open(data.signedUrl, '_blank');
    return;
  }
  // Voucher generado antes de guardar el PDF real -- se reconstruye desde los
  // datos guardados (mismo comportamiento de siempre, solo como fallback).
  const { data: registro, error } = await sb.from('vouchers').select('*').eq('numero_factura', numeroFactura).single();
  if (error || !registro) { errToast('No se pudo reconstruir el voucher'); return; }
  try {
    await ensureVoucherLibs();
    const pdfBytes = await construirVoucherPdf(registro);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    window.open(URL.createObjectURL(blob), '_blank');
  } catch (e) {
    console.error('verVoucherPdf reconstruir', e);
    errToast('No se pudo generar el PDF reconstruido');
  }
};
async function actualizarBadgeVoucher() {
  const badge = document.getElementById('nav-voucher-count');
  if (!badge) return;
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const { count, error } = await sb.from('vouchers').select('id', { count: 'exact', head: true }).gte('created_at', inicioMes.toISOString());
  if (error) return;
  badge.textContent = count || 0;
  badge.style.display = count ? '' : 'none';
}
function cargarImagenBase64(src) {
  return fetch(src).then(r => r.blob()).then(blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  }));
}
window.generarVoucherPdf = async function generarVoucherPdf() {
  const btn = document.getElementById('vc-generar-btn');
  const clienteNombre = val('vc-cliente-nombre').trim();
  if (!clienteNombre) { errToast('Ingresá el nombre del cliente'); return; }
  const asesorNombre = ROL === 'admin' ? (val('vc-asesor').trim() || MI_NOMBRE) : MI_NOMBRE;
  const fila = {
    creado_por: MI_USUARIO_ID, asesor_nombre: asesorNombre, cliente_nombre: clienteNombre,
    documento_identidad: val('vc-documento').trim() || null, telefono: val('vc-telefono').trim() || null,
    destino_hospedaje: val('vc-destino').trim() || null, fecha_entrada: val('vc-fecha-entrada') || null,
    check_in: val('vc-check-in').trim() || null, fecha_salida: val('vc-fecha-salida') || null,
    check_out: val('vc-check-out').trim() || null, modalidad: val('vc-modalidad').trim() || null,
    total_dias: val('vc-total-dias').trim() || null, habitaciones: val('vc-habitaciones').trim() || null,
    adultos: val('vc-adultos') ? parseInt(val('vc-adultos'), 10) : null, ninos: val('vc-ninos').trim() || null,
    status_reserva: val('vc-status').trim() || null,
    total_general: val('vc-total-general') ? parseFloat(val('vc-total-general')) : null,
    forma_pago: val('vc-forma-pago').trim() || null,
    monto_pagado: val('vc-monto-pagado') ? parseFloat(val('vc-monto-pagado')) : null,
    resta: val('vc-resta') ? parseFloat(val('vc-resta')) : null,
  };
  btn.disabled = true; btn.innerHTML = 'Generando... <i class="fas fa-spinner fa-spin"></i>';
  try {
    const { data: registro, error } = await sb.from('vouchers').insert(fila).select().single();
    if (error || !registro) { errToast('No se pudo guardar el voucher: ' + (error?.message || '')); return; }
    await ensureVoucherLibs();
    const pdfBytes = await construirVoucherPdf(registro);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    // Guarda el PDF real en Storage -- el historial siempre muestra este
    // archivo exacto, no una reconstrucción, aunque cambie la plantilla más
    // adelante. No bloquea la descarga inmediata al asesor si falla (queda
    // sin pdf_path, cargarHistorialVouchers cae al fallback de reconstruir).
    try {
      const pdfPath = `${MI_USUARIO_ID}/${registro.numero_factura}.pdf`;
      const { error: upErr } = await sb.storage.from('vouchers-pdf').upload(pdfPath, blob, { contentType: 'application/pdf' });
      if (!upErr) await sb.from('vouchers').update({ pdf_path: pdfPath }).eq('id', registro.id);
      else console.error('subir pdf voucher a storage', upErr);
    } catch (upEx) {
      console.error('subir pdf voucher a storage', upEx);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Voucher-${registro.numero_factura}-${clienteNombre.replace(/\s+/g, '-')}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    okToast('Voucher generado');
    vcOffset = 0; cargarHistorialVouchers(false);
  } catch (e) {
    // El registro en `vouchers` (con su numero_factura) ya pudo haberse
    // guardado antes de que fallara la generación del PDF (CDN caído, red
    // cortada, voucher-terminos.pdf no disponible) -- avisar explícito en vez
    // de dejar el botón "colgado" sin feedback, que es lo que ocultaba el bug.
    console.error('generarVoucherPdf', e);
    errToast('El voucher se guardó pero no se pudo generar el PDF, reintentá');
    vcOffset = 0; cargarHistorialVouchers(false);
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-pdf"></i> Generar PDF';
  }
};
async function construirVoucherPdf(v) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const naranja = [255, 145, 0], gris = [244, 245, 249];
  doc.setFillColor(...naranja);
  doc.rect(0, 0, 612, 70, 'F');
  try {
    const logo = await cargarImagenBase64('logolotus-integrado.png');
    doc.addImage(logo, 'PNG', 40, 12, 46, 46);
  } catch (_e) { /* sin logo el voucher igual se genera, solo queda sin el ícono */ }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('DESTINO Y EVENTOS LOTUS 360', 100, 40);
  doc.setTextColor(20, 20, 20); doc.setFontSize(11);
  doc.text(`FACTURA N° ${v.numero_factura}`, 572, 30, { align: 'right' });
  doc.text(`FECHA ${new Date(v.created_at).toLocaleDateString('es-VE')}`, 572, 48, { align: 'right' });

  // Datos fiscales de la agencia -- esquina superior izquierda, debajo de la
  // franja naranja. Fijos (no vienen del registro del voucher).
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('DESTINO Y EVENTOS LOTUS 360', 40, 82);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('J-412-9355-85', 40, 92);
  doc.text('C.C.P. Dinastía, P-3 Oficina 5-4, Naguanagua.', 40, 101);
  doc.text('0241-5144470 / 0424-4634041', 40, 110);
  doc.text('Destinoyeventoslotus360@gmail.com', 40, 119);

  doc.setFontSize(14);
  doc.text('VOUCHER HOSPEDAJE', 306, 100, { align: 'center' });

  const filas = [
    ['NOMBRE Y APELLIDO', v.cliente_nombre || ''],
    ['DOCUMENTO DE IDENTIFICACIÓN', v.documento_identidad || ''],
    ['TELÉFONO', v.telefono || ''],
    ['ASESOR(A) DE VENTAS', v.asesor_nombre || ''],
    ['DESTINO / HOSPEDAJE', v.destino_hospedaje || ''],
    ['FECHA DE ENTRADA', v.fecha_entrada || ''],
    ['CHECK IN', v.check_in || ''],
    ['FECHA DE SALIDA', v.fecha_salida || ''],
    ['CHECK OUT', v.check_out || ''],
    ['MODALIDAD HOSPEDAJE', v.modalidad || ''],
    ['TOTAL DÍAS DE DISFRUTE', v.total_dias || ''],
    ['CANTIDAD DE HABITACIONES / CLASE', v.habitaciones || ''],
    ['CANTIDAD DE ADULTOS', v.adultos ?? ''],
    ['CANTIDAD DE NIÑOS', v.ninos || 'N/A'],
    ['STATUS DE LA RESERVA / N° LOCALIZADOR', v.status_reserva || ''],
  ];
  doc.autoTable({
    startY: 132, theme: 'grid', margin: { left: 40, right: 40 },
    styles: { fontSize: 9, cellPadding: 6 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: gris, cellWidth: 220 } },
    body: filas,
  });

  const totales = [
    ['TOTAL GENERAL', v.total_general != null ? `$${Number(v.total_general).toFixed(2)}` : ''],
    [`PAGO ${v.forma_pago || ''}`.trim(), v.monto_pagado != null ? `${Number(v.monto_pagado).toFixed(2)}` : ''],
    ['RESTA', v.resta != null ? `$${Number(v.resta).toFixed(2)}` : ''],
  ];
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 16, theme: 'grid', margin: { left: 40, right: 40 },
    styles: { fontSize: 9, cellPadding: 6 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: naranja, textColor: 255, cellWidth: 220 } },
    body: totales,
  });

  const page1Bytes = doc.output('arraybuffer');
  const { PDFDocument } = window.PDFLib;
  const page1Doc = await PDFDocument.load(page1Bytes);
  const finalDoc = await PDFDocument.create();
  const [p1] = await finalDoc.copyPages(page1Doc, [0]);
  finalDoc.addPage(p1);
  const terminosBytes = await fetch('voucher-terminos.pdf').then(r => r.arrayBuffer());
  const terminosDoc = await PDFDocument.load(terminosBytes);
  const paginasTerminos = await finalDoc.copyPages(terminosDoc, terminosDoc.getPageIndices());
  paginasTerminos.forEach(p => finalDoc.addPage(p));
  return finalDoc.save();
}

/* ---------- Realtime ---------- */
// Salud del canal (falla #2 del plan de rediseño): sin esto el websocket
// puede morir en silencio y la interfaz sigue pareciendo viva. El indicador
// (#leads-live-dot / #leads-live-status) es honesto: verde solo mientras el
// canal está realmente SUBSCRIBED, gris con leyenda apenas se cae.
let canalLeadsLive = null, intentosReconexionLive = 0, timerReconexionLive = null, cerrandoCanalIntencional = false;
function marcarLeadsLiveVivo() {
  intentosReconexionLive = 0;
  clearTimeout(timerReconexionLive);
  const dot = document.getElementById('leads-live-dot'), status = document.getElementById('leads-live-status');
  if (dot) dot.className = 'live-dot vivo';
  if (status) status.textContent = '';
}
function marcarLeadsLiveCaido() {
  const dot = document.getElementById('leads-live-dot'), status = document.getElementById('leads-live-status');
  if (dot) dot.className = 'live-dot caido';
  if (status) status.textContent = 'Sin conexión en vivo';
}
function reconectarLeadsLive(inmediato = false) {
  clearTimeout(timerReconexionLive);
  const espera = inmediato ? 0 : Math.min(60000, 2000 * (2 ** intentosReconexionLive));
  if (!inmediato) intentosReconexionLive++;
  timerReconexionLive = setTimeout(() => {
    cerrandoCanalIntencional = true;
    if (canalLeadsLive) sb.removeChannel(canalLeadsLive);
    cerrandoCanalIntencional = false;
    subscribeRealtime();
  }, espera);
}
window.addEventListener('online', () => { intentosReconexionLive = 0; reconectarLeadsLive(true); });
window.addEventListener('offline', marcarLeadsLiveCaido);

function subscribeRealtime() {
  canalLeadsLive = sb.channel('leads-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, payload => {
      // Mismo criterio de visibilidad que buildQuery (:2334) -- si no, avisa
      // de leads que el usuario nunca ve aparecer en la lista. Nota: buildQuery
      // NO excluye es_prueba (esos leads sí aparecen, con su chip), así que acá
      // tampoco se filtra por es_prueba -- solo lo que buildQuery de verdad excluye.
      if (payload.new.servicio !== SERVICIO_POSADA_IA && !payload.new.eliminado_at) toast(payload.new);
      loadStats().then(() => { renderAll(); loadDestPeriodo(); });
      if (page === 1 && document.getElementById('sec-leads')?.classList.contains('active')) encolarLeadLive(payload);
      // Solo empujar al inbox en vivo si el lead realmente llegó sin atender
      // -- un INSERT no siempre significa "nuevo por atender" (ej. import
      // masivo con estado ya PAGO REALIZADO, hallazgo real 2026-07-24: sin
      // este chequeo, cualquier INSERT terminaba en el inbox del asesor con
      // botón Atender aunque la venta ya estuviera cerrada).
      if (ROL === 'asesor' && payload.new.estado === 'POR ATENDER' && !payload.new.fecha_primer_contacto) recibirLeadNuevoInbox(payload.new);
    })
    // RLS ya filtra este evento a leads propios -- si uno deja de estar
    // pendiente por otra vía (ej. lo editan a mano en el drawer/tabla), sale
    // del inbox sin esperar un refresh manual.
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, payload => {
      if (ROL === 'asesor' && INBOX_LEADS.some(x => x.id === payload.new.id)
          && (payload.new.estado !== 'POR ATENDER' || payload.new.fecha_primer_contacto || payload.new.eliminado_at)) quitarDeInbox(payload.new.id);
      if (document.getElementById('sec-postventa')?.classList.contains('active')) loadPostventa();
      // A diferencia del INSERT (siempre entra en página 1 por el order by
      // fecha_creacion desc), un UPDATE puede tocar un lead de cualquier
      // página -- se refresca igual, loadTable() ya respeta filtros/página
      // actuales así que si el lead editado no está en la vista no cambia nada.
      if (document.getElementById('sec-leads')?.classList.contains('active')) encolarLeadLive(payload);
    })
    .subscribe(estado => {
      if (estado === 'SUBSCRIBED') { marcarLeadsLiveVivo(); return; }
      if (cerrandoCanalIntencional) return;
      if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(estado)) { marcarLeadsLiveCaido(); reconectarLeadsLive(); }
    });
}

// Resync al volver de segundo plano (falla #3): el socket pudo morir sin
// avisar mientras el teléfono estaba bloqueado, y Realtime no reenvía lo
// perdido. Se refresca todo lo que dependía del canal caído -- KPIs/
// pipeline, inbox+badge, la tabla si está a la vista -- y se reintenta la
// suscripción de una vez, sin esperar a que algo falle para notarlo.
// Función nombrada (antes vivía inline en el listener) para poder llamarla
// también desde el pull-to-refresh (Fase 5.4) sin duplicar la lógica.
function resyncTrasSegundoPlano() {
  const p = loadStats().then(() => { renderAll(); loadDestPeriodo(); });
  if (ROL === 'asesor') loadInboxLeads();
  if (document.getElementById('sec-leads')?.classList.contains('active')) loadTable();
  reconectarLeadsLive(true);
  return p;
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) resyncTrasSegundoPlano(); });
// Red de seguridad si el websocket de Realtime se cae y tarda en reconectar
// -- refresco silencioso de la tabla mientras la sección Leads esté abierta,
// se arranca/para desde activateSection() para no dejarlo corriendo en fondo.
//
// Cada refresco cuesta 45 KB (`select('*')` = 52 columnas × 25 filas) y no se
// puede recortar sin romper la ficha: `openDrawer(l)` recibe el objeto entero.
// A 50 s eran 72 refrescos por hora POR USUARIO, y como el timer solo miraba la
// sección visible y no `document.hidden`, seguía corriendo con la PWA abierta en
// segundo plano en el teléfono de cada asesor -- toda la noche incluida. Medido:
// ~200 MB/día entre los 7 usuarios, sobre una cuota de 5 GB al mes.
//
// Realtime ya cubre el caso normal (INSERT/UPDATE llegan al instante); esto solo
// existe para cuando el websocket se cae. 3 minutos alcanza de sobra para eso, y
// el `visibilitychange` recupera la frescura apenas alguien vuelve a mirar --
// mismo patrón que `setupLatidoPresencia`.
let leadsPollInterval = null;
const leadsVisible = () => !document.hidden && document.getElementById('sec-leads').classList.contains('active');
function iniciarPollLeads() {
  if (leadsPollInterval) return;
  leadsPollInterval = setInterval(() => { if (leadsVisible()) loadTable(); }, 180000);
  document.addEventListener('visibilitychange', pollLeadsAlVolver);
}
function pollLeadsAlVolver() { if (leadsVisible()) loadTable(); }
function detenerPollLeads() {
  clearInterval(leadsPollInterval); leadsPollInterval = null;
  document.removeEventListener('visibilitychange', pollLeadsAlVolver);
}
// Card nueva al tope del inbox en vivo + notificación local instantánea si la
// pestaña no está en foco (no depende de la latencia del push del servidor).
function recibirLeadNuevoInbox(lead) {
  INBOX_LEADS.unshift(lead);
  renderInbox();
  const card = document.querySelector(`.inbox-card[data-id="${lead.id}"]`);
  if (card) { card.classList.add('inbox-new'); setTimeout(() => card.classList.remove('inbox-new'), 2200); }
  // showNotification() vía SW, no `new Notification(...)` -- ese constructor
  // directo tira "Illegal constructor" en Chrome/Android cuando corre como
  // PWA instalada (la forma en que la usan los asesores), no solo en sitios
  // sueltos de escritorio.
  if (MI_PREFERENCIAS.notificaciones_leads !== false && document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted' && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification('Nuevo lead — ' + (lead.destino || 'sin destino'), {
      body: `${lead.nombre} · contacto disponible al tomarlo en el CRM`, icon: './icons/icon-192.png', badge: './icons/badge-72.png', tag: `lead-${lead.id}`,
    }));
  }
}
function toast(l) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<i class="fas fa-bolt"></i> <div><b>Nuevo lead en vivo</b><br>${esc(l.nombre)} · ${esc(l.destino || '')}</div>`; document.getElementById('toasts').appendChild(t); setTimeout(() => t.classList.add('show'), 30); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 5200); }
function okToast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<i class="fas fa-check"></i> <div><b>${esc(msg)}</b></div>`; document.getElementById('toasts').appendChild(t); setTimeout(() => t.classList.add('show'), 30); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500); }
function errToast(msg) { const t = document.createElement('div'); t.className = 'toast toast-err'; t.innerHTML = `<i class="fas fa-triangle-exclamation"></i> <div><b>${esc(msg)}</b></div>`; document.getElementById('toasts').appendChild(t); setTimeout(() => t.classList.add('show'), 30); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 5000); }

// `sb.functions.invoke` con status != 2xx deja `data=null` y el cuerpo JSON
// real (el { ok:false, error } que arma la Edge Function) adentro de
// `error.context`, un Response sin leer -- sin esto, cualquier toast de
// error de una función queda pelado ("No se pudo X: ") porque `data?.error`
// es null. Lee el context si existe, si no cae al mensaje genérico de error.
async function msgErrorFn(error, data) {
  if (data?.error) return data.error;
  const ctx = error?.context;
  if (ctx && typeof ctx.json === 'function') {
    try { const body = await ctx.clone().json(); if (body?.error) return body.error; } catch {}
  }
  return error?.message || 'error desconocido';
}
// Igual que okToast/errToast pero con HTML propio (nunca de input de usuario)
// y más tiempo en pantalla -- para acciones que el asesor tiene que tocar,
// como el link de WhatsApp cuando window.open() vuelve bloqueado.
function linkToast(html) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<i class="fas fa-link"></i> <div>${html}</div>`; document.getElementById('toasts').appendChild(t); setTimeout(() => t.classList.add('show'), 30); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 10000); }

/* ---------- Historial interno (gesto de "atrás" del SO no debe salir de la PWA) ----------
   Cada cambio de sección o apertura de overlay (drawer/lightbox/sheet) empuja
   una entrada de historial. El botón/gesto de atrás de Android y el
   swipe-back de iOS disparan `popstate` en vez de salir de la app mientras
   haya algo en NAV_STACK — al vaciarse (pantalla raíz), el siguiente atrás
   sí sale de la PWA (comportamiento estándar, no se intercepta más allá). */
let NAV_STACK = [];
function navPush(entry) { NAV_STACK.push(entry); history.pushState({ navDepth: NAV_STACK.length }, ''); }
// Usado por los cierres propios de la UI (botón X, backdrop, "Listo") para
// consumir la entrada de historial que ese overlay había empujado — sin
// esto, cada cierre manual deja una entrada fantasma y el próximo gesto de
// atrás del sistema queda desfasado (hay que tocarlo dos veces sin efecto).
function navConsume() { if (NAV_STACK.length) history.back(); }
window.addEventListener('popstate', () => {
  if (!NAV_STACK.length) return; // pantalla raíz: se deja que el SO cierre la PWA
  const top = NAV_STACK.pop();
  if (top.type === 'drawer') window.closeDrawer(true);
  else if (top.type === 'lightbox') closeLightbox(true);
  else if (top.type === 'sheet') closeSheet(top.id, true);
  else if (top.type === 'msg-conv') cerrarConversacion(true);
  else if (top.type === 'section') activateSection(top.prevSec, true);
  else if (top.type === 'tour') volverAlMenuTutorial(true);
  else if (top.type === 'seleccion') top.limpiar?.();
});

/* ---------- Nav ---------- */
let currentSec = null;
// Qué secciones pasaron por activateSection() al menos una vez -- el peek
// del swipe (Fase 5.2) lo consulta para no asomar una sección que nunca
// disparó su carga perezosa (loadTarifario, loadFacturacion, etc): montar
// 500 filas a mitad de gesto se siente peor que no tener peek.
const SECCIONES_CARGADAS = new Set();
// Secciones que se retiraron del menú (2026-07-27) y a dónde fue su contenido.
// Sin esto, quien tenía guardada una de ellas como última sección abría el CRM
// contra un id que ya no existe y reventaba en el getElementById de abajo.
const SECCIONES_REUBICADAS = {
  metricas: 'gestion-personal',
  reasignaciones: 'gestion-personal',
  'leads-colaboraciones': 'leads',
  'leads-fallidos': 'gestion-personal',
  'buscar-tarifario': 'tarifario',
  extractor: 'leads',
  // "Mis leads" del rol asesor_prueba, fusionado en asesor (2026-08-19).
  'leads-prueba': 'clientes-asignados',
};
async function loadClientesAsignados() {
  const wrap = document.getElementById('clientes-asignados-list');
  if (!wrap) return;
  const { data, error } = await sb.rpc('listar_mis_clientes_asignados');
  if (error) { console.error(error); wrap.innerHTML = '<div class="es-s">No se pudieron cargar tus clientes.</div>'; return; }
  const filas = data || [];
  if (!filas.length) { wrap.innerHTML = '<div class="es-s">No tenés clientes asignados por ahora.</div>'; return; }
  wrap.innerHTML = filas.map(l => `<article class="entity-card"><div class="ec-head"><b>${esc(l.nombre || 'Sin nombre')}</b><span class="chip">${esc(l.estado || 'Sin estado')}</span></div><div class="ec-row"><i class="fas fa-phone"></i> ${esc(l.telefono || 'Sin teléfono')}</div><div class="ec-row"><i class="fas fa-location-dot"></i> ${esc(l.destino || 'Sin destino')}</div><div class="ec-row"><i class="fas fa-clock"></i> ${l.vence_at ? esc(fmtFecha(l.vence_at)) : 'Sin plazo'}</div>${l.notas ? `<div class="ec-row"><i class="fas fa-note-sticky"></i> ${esc(l.notas)}</div>` : ''}<div class="seg-group" style="margin-top:10px;flex-wrap:wrap"><button class="seg" data-r="no_contesta" data-task="${l.task_id}">No contesta</button><button class="seg" data-r="numero_equivocado" data-task="${l.task_id}">Número equivocado</button><button class="seg" data-r="no_interesa" data-task="${l.task_id}">No interesa</button><button class="seg" data-r="interesado" data-task="${l.task_id}">Interesado</button><button class="seg" data-r="ya_viajo" data-task="${l.task_id}">Ya viajó</button></div><textarea class="ei" data-nota placeholder="¿Qué te dijo el cliente? (obligatorio para registrar el resultado)"></textarea><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn-sm" data-editar-lead="${l.lead_id}"><i class="fas fa-pen"></i> Editar datos</button><a class="btn-sm" href="https://wa.me/${esc(String(l.telefono || '').replace(/\D/g,''))}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp</a><a class="btn-sm" href="tel:${esc(l.telefono || '')}"><i class="fas fa-phone"></i> Llamar</a></div></article>`).join('');
  wrap.querySelectorAll('[data-r]').forEach(btn => btn.addEventListener('click', async () => {
    const nota = btn.closest('.entity-card').querySelector('[data-nota]').value.trim();
    if (!nota) { errToast('Contá qué te dijo el cliente antes de registrar el resultado.'); return; }
    btn.disabled = true;
    const { data: r, error: e } = await sb.rpc('registrar_contacto_lead', { p_task_id: Number(btn.dataset.task), p_resultado: btn.dataset.r, p_nota: nota });
    if (e || !r?.ok) { errToast('No se pudo registrar el contacto.'); btn.disabled = false; return; }
    okToast('Contacto registrado');
    // Una objeción recién escuchada es justo lo que conviene guardar para
    // repasar: se ofrece pasarla a Mis Notas sin volver a escribirla.
    if (btn.dataset.r === 'no_interesa' && await confirmarSheet({
      titulo: '¿Guardar esta objeción en Mis Notas?',
      detalle: 'Te la vamos a recordar cada tanto para que tengas lista la respuesta.',
      textoOk: 'Guardar nota'
    })) { window.guardarComoNota('Objeción: ' + (btn.closest('.entity-card')?.querySelector('.ec-head b')?.textContent || 'cliente'), nota, ['objeciones']); return; }
    loadClientesAsignados();
  }));
  // Editar los datos del cliente reusa el MISMO drawer de la sección Leads
  // (openDrawer/guardarLead) -- no hay un segundo formulario que mantener.
  wrap.querySelectorAll('[data-editar-lead]').forEach(btn => btn.addEventListener('click', async () => {
    const { data: lead, error: e } = await sb.from('leads').select('*').eq('id', Number(btn.dataset.editarLead)).single();
    if (e || !lead) { errToast('No se pudo cargar el cliente'); return; }
    openDrawer(lead);
  }));
}

/* ---------- Mis Notas (libreta propia del asesor, con repaso espaciado) ---------- */
// El repaso lo decide el backend (repasar_nota): acá solo se muestra y se
// reporta si acertó o no. Los intervalos viven en la migración, no duplicados acá.
let NOTAS_FILTRO_ETIQUETA = null;
let NOTAS_BUSQUEDA = '';

async function loadMisNotas() {
  await Promise.all([cargarNotasRepaso(), cargarListaNotas()]);
}

async function cargarNotasRepaso() {
  const card = document.getElementById('notas-repaso-card');
  const wrap = document.getElementById('notas-repaso-list');
  if (!card || !wrap) return;
  const { data, error } = await sb.rpc('notas_para_repasar_hoy');
  if (error) console.error(error);
  const pendientes = error ? [] : (data || []);
  actualizarBadgeNotas(pendientes.length);
  if (!pendientes.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  wrap.innerHTML = pendientes.map(n => `<article class="entity-card" data-nota-repaso="${n.id}">
    <div class="ec-head"><b>${esc(n.titulo)}</b><span class="chip">Nivel ${n.nivel}</span></div>
    <div class="ec-row nota-respuesta" style="display:none;white-space:pre-wrap">${esc(n.cuerpo)}</div>
    <div class="tbar" style="margin-top:10px;flex-wrap:wrap">
      <button class="btn-sm" data-nota-ver="${n.id}"><i class="fas fa-eye"></i> Ver respuesta</button>
      <button class="btn-sm" data-nota-acerte="${n.id}"><i class="fas fa-check"></i> Ya me lo sé</button>
      <button class="btn-sm" data-nota-falle="${n.id}"><i class="fas fa-rotate-left"></i> Todavía me cuesta</button>
    </div>
  </article>`).join('');
  wrap.querySelectorAll('[data-nota-ver]').forEach(b => b.addEventListener('click', () => {
    const cuerpo = b.closest('.entity-card').querySelector('.nota-respuesta');
    cuerpo.style.display = cuerpo.style.display === 'none' ? '' : 'none';
  }));
  wrap.querySelectorAll('[data-nota-acerte],[data-nota-falle]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.notaAcerte || b.dataset.notaFalle;
    b.disabled = true;
    const { data: r, error: e } = await sb.rpc('repasar_nota', { p_id: id, p_acerte: !!b.dataset.notaAcerte });
    if (e || !r?.ok) { errToast('No se pudo registrar el repaso.'); b.disabled = false; return; }
    okToast(b.dataset.notaAcerte ? `Bien. Vuelve el ${fmtFechaCorta(r.proximo_repaso)}` : 'Listo, te lo repito mañana');
    await loadMisNotas();
  }));
}

const fmtFechaCorta = iso => { try { return new Date(iso + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }); } catch { return iso; } };

async function cargarListaNotas() {
  const wrap = document.getElementById('notas-list');
  if (!wrap) return;
  const { data, error } = await sb.rpc('listar_mis_notas', { p_etiqueta: NOTAS_FILTRO_ETIQUETA, p_busqueda: NOTAS_BUSQUEDA || null });
  if (error) { console.error(error); wrap.innerHTML = '<div class="es-s">No se pudieron cargar tus notas.</div>'; return; }
  const notas = data || [];
  renderChipsEtiquetasNotas(notas);
  if (!notas.length) {
    wrap.innerHTML = (NOTAS_FILTRO_ETIQUETA || NOTAS_BUSQUEDA)
      ? '<div class="es-s">Ninguna nota coincide con ese filtro.</div>'
      : '<div class="es-s">Todavía no tenés notas. Empezá por eso que siempre se te olvida.</div>';
    return;
  }
  wrap.innerHTML = notas.map(n => `<article class="entity-card">
    <div class="ec-head"><b>${esc(n.titulo)}</b>${n.me_cuesta ? '<span class="chip am">Me cuesta</span>' : ''}</div>
    <div class="ec-row" style="white-space:pre-wrap">${esc(n.cuerpo)}</div>
    ${n.etiquetas?.length ? `<div class="chip-group" style="margin-top:8px">${n.etiquetas.map(e => `<span class="chip">${esc(e)}</span>`).join('')}</div>` : ''}
    ${n.me_cuesta && n.proximo_repaso ? `<div class="ec-row"><i class="fas fa-rotate-right"></i> Próximo repaso: ${esc(fmtFechaCorta(n.proximo_repaso))}</div>` : ''}
    <div class="tbar" style="margin-top:10px">
      <button class="btn-sm" data-nota-editar="${n.id}"><i class="fas fa-pen"></i> Editar</button>
      <button class="btn-sm" data-nota-borrar="${n.id}"><i class="fas fa-trash"></i> Borrar</button>
    </div>
  </article>`).join('');
  wrap.querySelectorAll('[data-nota-editar]').forEach(b => b.addEventListener('click', () => {
    abrirEditorNota(notas.find(n => n.id === b.dataset.notaEditar));
  }));
  wrap.querySelectorAll('[data-nota-borrar]').forEach(b => b.addEventListener('click', async () => {
    if (!(await confirmarSheet({ titulo: '¿Borrar esta nota?', detalle: 'No se puede deshacer.', textoOk: 'Borrar' }))) return;
    const { data: r, error: e } = await sb.rpc('borrar_nota', { p_id: b.dataset.notaBorrar });
    if (e || !r?.ok) { errToast('No se pudo borrar.'); return; }
    okToast('Nota borrada'); await loadMisNotas();
  }));
}

// Las etiquetas del filtro salen de las notas ya cargadas: sin filtro activo la
// lista es completa, así que sirve como universo. Con un filtro puesto se
// conserva el chip activo aunque quede fuera del resultado.
let NOTAS_ETIQUETAS_CONOCIDAS = [];
function renderChipsEtiquetasNotas(notas) {
  if (!NOTAS_FILTRO_ETIQUETA) {
    NOTAS_ETIQUETAS_CONOCIDAS = [...new Set(notas.flatMap(n => n.etiquetas || []))].sort();
  }
  renderChipGroup('notas-etiquetas-chips',
    NOTAS_ETIQUETAS_CONOCIDAS.map(e => ({ valor: e, etiqueta: e })),
    {
      multi: false,
      seleccion: NOTAS_FILTRO_ETIQUETA ? [NOTAS_FILTRO_ETIQUETA] : [],
      onChange: vals => { NOTAS_FILTRO_ETIQUETA = vals[0] || null; cargarListaNotas(); }
    });
}

function abrirEditorNota(nota) {
  const ed = document.getElementById('notas-editor');
  if (!ed) return;
  ed.style.display = '';
  document.getElementById('nota-id').value = nota?.id || '';
  document.getElementById('nota-titulo').value = nota?.titulo || '';
  document.getElementById('nota-cuerpo').value = nota?.cuerpo || '';
  document.getElementById('nota-etiquetas').value = (nota?.etiquetas || []).join(', ');
  document.getElementById('nota-me-cuesta').checked = !!nota?.me_cuesta;
  document.getElementById('nota-err').textContent = '';
  document.getElementById('nota-titulo').focus();
}

function cerrarEditorNota() {
  const ed = document.getElementById('notas-editor');
  if (ed) ed.style.display = 'none';
}

async function guardarNotaDesdeEditor() {
  const err = document.getElementById('nota-err'); err.textContent = '';
  const titulo = document.getElementById('nota-titulo').value.trim();
  const cuerpo = document.getElementById('nota-cuerpo').value.trim();
  if (!titulo) { err.textContent = 'Ponele un título.'; return; }
  if (!cuerpo) { err.textContent = 'Escribí el contenido de la nota.'; return; }
  const etiquetas = document.getElementById('nota-etiquetas').value.split(',').map(e => e.trim()).filter(Boolean);
  if (etiquetas.length > 8) { err.textContent = 'Máximo 8 etiquetas.'; return; }
  const btn = document.getElementById('nota-guardar'); btn.disabled = true;
  const { data, error } = await sb.rpc('guardar_nota', {
    p_id: document.getElementById('nota-id').value || null,
    p_titulo: titulo, p_cuerpo: cuerpo, p_etiquetas: etiquetas,
    p_me_cuesta: document.getElementById('nota-me-cuesta').checked
  });
  btn.disabled = false;
  if (error || !data?.ok) { err.textContent = error?.message || 'No se pudo guardar.'; return; }
  okToast('Nota guardada'); cerrarEditorNota(); await loadMisNotas();
}

// Puente desde otras pantallas: convierte un texto ya escrito (el aprendizaje
// del informe diario, la objeción de un cliente) en nota sin reescribirlo.
window.guardarComoNota = (titulo, cuerpo, etiquetas) => {
  activateSection('mis-notas');
  abrirEditorNota({ titulo, cuerpo, etiquetas: etiquetas || [], me_cuesta: true });
};

function actualizarBadgeNotas(n) {
  const badge = document.getElementById('nav-notas-count');
  if (!badge) return;
  badge.textContent = n;
  badge.style.display = n > 0 ? '' : 'none';
}

function setupMisNotas() {
  document.getElementById('notas-nueva')?.addEventListener('click', () => abrirEditorNota(null));
  document.getElementById('nota-cancelar')?.addEventListener('click', cerrarEditorNota);
  document.getElementById('nota-guardar')?.addEventListener('click', guardarNotaDesdeEditor);
  let t = null;
  document.getElementById('notas-buscar')?.addEventListener('input', e => {
    clearTimeout(t);
    t = setTimeout(() => { NOTAS_BUSQUEDA = e.target.value.trim(); cargarListaNotas(); }, 300);
  });
}

/* ---------- Menú: fuente única de datos (sidebar desktop + sheet "Yo" móvil) ----------
   Antes cada superficie tenía su propia lista de <a> hardcodeada en el HTML,
   duplicada y desincronizada entre sí. Ahora un solo NAV_ITEMS alimenta ambas.
   `roles` preserva LITERAL las clases nav-admin-only/nav-marketing-ok/etc. que
   ya filtraban por CSS -- ese sistema no cambia, solo cambia dónde vive cada
   <a> en el DOM. */
const NAV_ITEMS = [
  { sec: 'dashboard', icon: 'fas fa-chart-pie', label: 'Dashboard', grupo: 'principal', roles: 'nav-asesor-hide', excludeSheet: true },
  { sec: 'leads', icon: 'fas fa-users', label: 'Leads', grupo: 'principal', roles: '', badge: 'nav-lead-count', badgeDefault: '—', badgeVisible: true, excludeSheet: true },
  { sec: 'pipeline', icon: 'fas fa-diagram-project', label: 'Pipeline', grupo: 'principal', roles: '' },
  { sec: 'clientes-asignados', icon: 'fas fa-user-clock', label: 'Clientes Asignados', grupo: 'principal', roles: 'nav-asesor-only' },
  { sec: 'mensajes', icon: 'fas fa-comment-dots', label: 'Mensajes', grupo: 'principal', roles: 'nav-marketing-ok nav-boleteria-ok nav-modo-boleteria-ok', badge: 'nav-msg-count', badgeDefault: '—', excludeSheet: true },
  { sec: 'tareas', icon: 'fas fa-list-check', label: 'Tareas', grupo: 'principal', roles: 'nav-freelancer-only', badge: 'nav-tareas-count', badgeDefault: '0' },
  { sec: 'mis-notas', icon: 'fas fa-lightbulb', label: 'Mis Notas', grupo: 'principal', roles: '', badge: 'nav-notas-count', badgeDefault: '0', sub: 'Lo que te cuesta recordar, para repasar' },
  { sec: 'stop-sales', icon: 'fas fa-ban', label: 'Stop Sales', grupo: 'ventas', roles: 'nav-marketing-ok nav-boleteria-ok nav-modo-boleteria-ok', sub: 'Disponibilidad de hoteles (BT Travel)' },
  { sec: 'postventa', icon: 'fas fa-handshake-angle', label: 'Postventa', grupo: 'ventas', roles: '', badge: 'nav-postventa-count', badgeDefault: '0', sub: 'Cobros, reservas y seguimiento del viaje' },
  { sec: 'facturacion', icon: 'fas fa-file-invoice-dollar', label: 'Facturación', grupo: 'ventas', roles: 'nav-admin-only' },
  { sec: 'voucher', icon: 'fas fa-file-invoice', label: 'Voucher', grupo: 'ventas', roles: 'nav-boleteria-ok nav-modo-boleteria-ok solo-voucher', id: 'nav-voucher', badge: 'nav-voucher-count', badgeDefault: '0' },
  { sec: 'mis-comisiones', icon: 'fas fa-sack-dollar', label: 'Mis Comisiones', grupo: 'ventas', roles: 'nav-asesor-only' },
  { sec: 'ranking', icon: 'fas fa-ranking-star', label: 'Ranking', grupo: 'ventas', roles: 'nav-admin-only' },
  { sec: 'tarifario', icon: 'fas fa-book-open', label: 'Tarifario', grupo: 'tarifario', roles: 'nav-marketing-ok nav-boleteria-ok nav-modo-boleteria-ok', excludeSheet: true },
  { sec: 'galeria', icon: 'fas fa-images', label: 'Galería', grupo: 'tarifario', roles: 'nav-marketing-ok nav-boleteria-ok nav-modo-boleteria-ok' },
  { sec: 'cotizador', icon: 'fas fa-comments', label: 'Cotizador IA', grupo: 'ia', roles: 'nav-marketing-ok' },
  { sec: 'cerebro-ia', icon: 'fas fa-brain', label: 'Cerebro IA', grupo: 'ia', roles: 'nav-admin-only' },
  { sec: 'ia-atencion', icon: 'fas fa-headset', label: 'Prospectos de IA', grupo: 'ia', roles: 'nav-admin-only', sub: 'Posadas que quieren el asistente' },
  { sec: 'consultor-ia', icon: 'fas fa-user-tie', label: 'Consultor IA', grupo: 'ia', roles: 'nav-admin-only', sub: 'Preguntale sobre el proyecto, sin gastar Claude Code' },
  { sec: 'voz-ia', icon: 'fas fa-microphone-lines', label: 'Voz IA', grupo: 'ia', roles: 'nav-admin-only nav-marketing-ok', sub: 'Probá la voz clonada y cambiá la muestra de referencia' },
  { sec: 'rendimiento-ia', icon: 'fas fa-chart-line', label: 'Rendimiento IA', grupo: 'ia', roles: 'nav-admin-only', sub: 'Ventas, calidad, errores y costos' },
  { sec: 'web-reasignados', icon: 'fas fa-hand-holding-dollar', label: 'Web y Reasignados', grupo: 'marketing', roles: 'nav-admin-only', sub: 'Los leads por los que cobrás comisión' },
  { sec: 'redes', icon: 'fa-brands fa-instagram', label: 'Redes', grupo: 'marketing', roles: 'nav-admin-only nav-marketing-ok' },
  { sec: 'gestion-personal', icon: 'fas fa-people-group', label: 'Gestión de Personal', grupo: 'gestion', roles: 'nav-admin-only' },
  { sec: 'informe-diario', icon: 'fas fa-file-lines', label: 'Informe Diario', grupo: 'gestion', roles: 'nav-admin-only solo-informe-diario', id: 'nav-informe-diario' },
  { sec: 'manual', icon: 'fas fa-book-open-reader', label: 'Manual del CRM', grupo: 'ayuda', roles: 'nav-marketing-ok nav-boleteria-ok nav-modo-boleteria-ok' },
  { sec: 'actualizaciones', icon: 'fas fa-bullhorn', label: 'Actualizaciones', grupo: 'ayuda', roles: 'nav-marketing-ok nav-boleteria-ok nav-modo-boleteria-ok' },
  { sec: 'proyecto-constructor', icon: 'fas fa-drafting-compass', label: 'Proyecto Constructor', grupo: 'ayuda', roles: 'nav-admin-only', sub: 'Avance del CRM que se vende a otras empresas' },
];
const NAV_GRUPOS = [
  { id: 'principal', label: 'Principal' },
  { id: 'ventas', label: 'Ventas y Postventa' },
  { id: 'tarifario', label: 'Tarifario' },
  { id: 'ia', label: 'Herramientas IA' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'gestion', label: 'Gestión', roles: 'nav-admin-only' },
  { id: 'ayuda', label: 'Ayuda' },
];

function renderNavItems() {
  const htmlDesktop = it => {
    const cls = ['nav-item', it.roles].filter(Boolean).join(' ');
    const idAttr = it.id ? ` id="${it.id}"` : '';
    const titleAttr = it.sub ? ` title="${esc(it.sub)}"` : '';
    const badge = it.badge ? ` <span class="badge" id="${it.badge}"${it.badgeVisible ? '' : ' style="display:none"'}>${esc(it.badgeDefault || '0')}</span>` : '';
    return `<a class="${cls}"${idAttr} data-sec="${it.sec}"${titleAttr}><i class="${it.icon}"></i> ${esc(it.label)}${badge}</a>`;
  };
  const htmlSheet = it => {
    const cls = ['sheet-item', it.roles].filter(Boolean).join(' ');
    const sub = it.sub ? `<span class="si-sub">${esc(it.sub)}</span>` : '';
    return `<a class="${cls}" data-sec="${it.sec}"><i class="${it.icon}"></i> ${esc(it.label)}${sub}</a>`;
  };

  const ancoraDesktop = document.getElementById('nav-items-anchor');
  if (ancoraDesktop) {
    const bloque = NAV_GRUPOS.map(g => {
      const items = NAV_ITEMS.filter(it => it.grupo === g.id);
      if (!items.length) return '';
      const labelCls = ['nav-label', g.roles].filter(Boolean).join(' ');
      return `<div class="${labelCls}" data-label="${g.id}">${esc(g.label)}</div>` + items.map(htmlDesktop).join('');
    }).join('');
    ancoraDesktop.insertAdjacentHTML('beforebegin', bloque);
  }

  const ancoraSheet = document.getElementById('sheet-items-anchor');
  if (ancoraSheet) {
    const bloque = NAV_GRUPOS.map(g => {
      const items = NAV_ITEMS.filter(it => it.grupo === g.id && !it.excludeSheet);
      if (!items.length) return '';
      const labelCls = ['sheet-label', g.roles].filter(Boolean).join(' ');
      return `<div class="${labelCls}">${esc(g.label)}</div>` + items.map(htmlSheet).join('');
    }).join('');
    ancoraSheet.insertAdjacentHTML('beforebegin', bloque);
  }
  // nav-admin-only/nav-asesor-only etc. ya filtran por CSS (.rol-asesor) --
  // estos dos casos necesitan el valor real del usuario (flag por persona,
  // no por rol), así que se resuelven con clases en <body> + CSS (ver
  // index.html), nunca con style.display inline en el item: el buscador del
  // menú limpia el style.display de cualquier item que matchea el texto
  // tipeado, y eso reaparecía el link aunque el usuario no tuviera permiso
  // (bug real, visto en vivo 2026-08-19).
  document.body.classList.toggle('ve-informe-diario', MI_VE_INFORME_DIARIO);
  document.body.classList.toggle('puede-ver-voucher', ROL === 'admin' || ROL === 'asesor');
}

/* ---------- "Frecuentes": top de secciones más clickeadas ----------
   MI_PREFERENCIAS.uso_secciones = {sec: count}, incrementado solo en clic real
   (ver delegación de click en setupNav). Se calcula UNA vez al arrancar, no en
   vivo, para que el menú no "salte" mientras el usuario navega. Los items se
   MUEVEN (no se clonan) para no duplicar data-sec y romper el Map de
   guardarOrdenSidebar/aplicarOrdenSidebar. Por eso Frecuentes no es
   arrastrable: setupSidebarReorder/guardarOrdenSidebar excluyen .nav-freq. */
const FRECUENTES_N = 6;
const FRECUENTES_MIN_CLICS = 8;
function calcularFrecuentes() {
  const uso = MI_PREFERENCIAS.uso_secciones || {};
  const total = Object.values(uso).reduce((a, b) => a + b, 0);
  if (total < FRECUENTES_MIN_CLICS) return [];
  return Object.entries(uso)
    .filter(([sec]) => document.getElementById('sec-' + sec))
    .sort((a, b) => b[1] - a[1])
    .slice(0, FRECUENTES_N)
    .map(([sec]) => sec);
}
function ocultarHeadersVaciosMenu() {
  ocultarHeadersVacios('sidebar-nav', '.nav-item', '.nav-label');
  ocultarHeadersVacios('more-sheet', '.sheet-item', '.sheet-label');
}
function renderFrecuentes() {
  const top = calcularFrecuentes();
  [
    { contId: 'sidebar-nav', itemCls: 'nav-freq', labelHtml: '<div class="nav-label" data-label="frecuentes" data-grupo-frec>Frecuentes</div>' },
    { contId: 'more-sheet', itemCls: 'freq', labelHtml: '<div class="sheet-label" data-grupo-frec>Frecuentes</div>' },
  ].forEach(({ contId, itemCls, labelHtml }) => {
    const cont = document.getElementById(contId);
    if (!cont) return;
    cont.querySelector('[data-grupo-frec]')?.remove();
    cont.querySelectorAll('.' + itemCls).forEach(n => n.classList.remove(itemCls));
    if (!top.length) return;
    const primerHijo = cont.querySelector('.nav-item, .nav-label, .sheet-item, .sheet-label');
    if (!primerHijo) return;
    primerHijo.insertAdjacentHTML('beforebegin', labelHtml);
    const marcador = cont.querySelector('[data-grupo-frec]');
    // .slice().reverse(): marcador.after(el) inserta cada uno pegado al
    // marcador, empujando abajo al anterior -- sin invertir, el orden final
    // queda al revés (el menos clickeado de los 6 primero).
    top.slice().reverse().forEach(sec => {
      const el = cont.querySelector(`[data-sec="${sec}"]`);
      if (!el) return;
      el.classList.add(itemCls);
      marcador.after(el);
    });
  });
}

/* ---------- Ocultar headers de grupo sin items visibles ----------
   renderNavItems() imprime un header si el grupo tiene items DEFINIDOS en
   NAV_ITEMS, no si tiene items VISIBLES para el rol actual -- esa parte la
   decide CSS después, en el navegador. Sin este paso, un grupo donde el rol
   actual no puede ver ningún item (ej. "Marketing" para un asesor) deja el
   header flotando vacío. */
function ocultarHeadersVacios(contId, itemSel, labelSel) {
  const cont = document.getElementById(contId);
  if (!cont) return;
  cont.querySelectorAll(labelSel).forEach(label => {
    let sib = label.nextElementSibling, tieneVisible = false;
    while (sib && !sib.matches(labelSel)) {
      if (sib.matches(itemSel) && getComputedStyle(sib).display !== 'none') tieneVisible = true;
      sib = sib.nextElementSibling;
    }
    label.style.display = tieneVisible ? '' : 'none';
  });
}

/* ---------- Guardado throttleado de preferencias de navegación ----------
   guardarUltimaSeccion() y incrementarUsoSeccion() comparten este debounce de
   3s para no pegarle a actualizar_mi_perfil en cada clic. */
let _navPrefsTimer = null;
function guardarPreferenciasNavDebounced() {
  clearTimeout(_navPrefsTimer);
  _navPrefsTimer = setTimeout(() => {
    Promise.resolve(sb.rpc('actualizar_mi_perfil', { p_preferencias: MI_PREFERENCIAS })).catch(() => {});
  }, 3000);
}
function incrementarUsoSeccion(sec) {
  if (!sec) return;
  const uso = { ...(MI_PREFERENCIAS.uso_secciones || {}) };
  uso[sec] = (uso[sec] || 0) + 1;
  MI_PREFERENCIAS = { ...MI_PREFERENCIAS, uso_secciones: uso };
  guardarPreferenciasNavDebounced();
}

/* ---------- Buscador/quick-jump del menú (sidebar + sheet "Yo") ----------
   ~28 secciones entre ambas listas, filtra por texto y oculta headers de
   grupo que quedan vacíos tras filtrar. */
function setupNavBuscador() {
  const wire = (inputId, contId, itemSel, labelSel) => {
    const input = document.getElementById(inputId);
    const cont = document.getElementById(contId);
    if (!input || !cont) return;
    let t = null;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const q = input.value.trim().toLowerCase();
        const items = [...cont.querySelectorAll(itemSel)];
        // Buscando: el texto manda. Buscador vacío: la visibilidad por rol
        // manda (no revive un item oculto por CSS de rol solo porque el
        // buscador quedó en blanco).
        items.forEach(it => {
          if (q) it.style.display = it.textContent.toLowerCase().includes(q) ? '' : 'none';
          else it.style.removeProperty('display');
        });
        ocultarHeadersVacios(contId, itemSel, labelSel);
      }, 150);
    });
  };
  wire('nav-buscar', 'sidebar-nav', '.nav-item', '.nav-label');
  wire('sheet-buscar', 'more-sheet', '.sheet-item', '.sheet-label');
}

function activateSection(sec, fromNav) {
  sec = SECCIONES_REUBICADAS[sec] || sec;
  if (!document.getElementById('sec-' + sec)) sec = 'hoy';
  if (currentSec === sec) return;
  if (!fromNav && currentSec !== null) navPush({ type: 'section', prevSec: currentSec });
  if (currentSec === 'leads' && sec !== 'leads') detenerPollLeads();
  currentSec = sec;
  SECCIONES_CARGADAS.add(sec);
  guardarUltimaSeccion(sec);
  document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x.dataset.sec === sec));
  // La barra de abajo ya no tiene un set fijo: se marca "Yo" cuando la sección
  // abierta no es ninguna de las que el usuario eligió tener a mano.
  marcarBottomNavActivo(sec);
  if (sheetAbierta) closeSheet(sheetAbierta, true);
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + sec).classList.add('active');
  document.querySelector('.topbar').classList.toggle('show-search', sec === 'leads');
  const t = TITLES[sec] || TITLES.dashboard;
  document.getElementById('page-title').textContent = t[0];
  document.getElementById('page-sub').textContent = t[1];
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (sec === 'ranking') loadRanking();
  if (sec === 'facturacion') loadFacturacion();
  if (sec === 'mis-comisiones') loadMisComisiones();
  if (sec === 'gestion-personal') loadGestionPersonal();
  if (sec === 'postventa') loadPostventa();
  if (sec === 'informe-diario') loadInformeDiario();
  if (sec === 'hoy') renderHoy();
  if (sec === 'leads') { if (ROL === 'asesor') loadInboxLeads(); iniciarPollLeads(); }
  if (sec === 'clientes-asignados') loadClientesAsignados();
  if (sec === 'mis-notas') loadMisNotas();
  if (sec === 'tarifario') loadTarifario();
  if (sec === 'mensajes') cargarBandeja();
  if (sec === 'galeria') loadGaleria();
  if (sec === 'cerebro-ia') loadCerebroIA();
  if (sec === 'rendimiento-ia') loadRendimientoIA();
  if (sec === 'ia-atencion') loadIaAtencion();
  if (sec === 'web-reasignados') loadWebReasignados();
  if (sec === 'stop-sales') { loadStopSalesVigentes(); ssCargarPdfActual(); }
  if (sec === 'redes') cargarRedActual();
  if (sec === 'voucher') loadVoucherSeccion();
  if (sec === 'boleteria') loadBoleteria();
  if (sec === 'tareas') loadTareas();
  if (sec === 'manual') renderManual();
  if (sec === 'actualizaciones') renderActualizaciones();
  if (sec === 'proyecto-constructor') renderProyectoConstructor();
  setTimeout(() => Object.values(charts).forEach(c => c && c.resize()), 60);
}
function setupNav() {
  // Delegado (no querySelectorAll+forEach puntual): NAV_ITEMS regenera los
  // .nav-item/.sheet-item dinámicamente (renderNavItems/renderFrecuentes), un
  // binding hecho una sola vez al boot no los cubriría.
  document.addEventListener('click', e => {
    const n = e.target.closest('.nav-item[data-sec], .bn-item[data-sec], .sheet-item[data-sec]');
    if (!n) return;
    incrementarUsoSeccion(n.dataset.sec);
    activateSection(n.dataset.sec);
  });
  document.getElementById('bn-more')?.addEventListener('click', () => openSheet('more-sheet'));
  document.getElementById('side-foot-perfil')?.addEventListener('click', () => openPerfilDrawer());
  document.getElementById('sheet-item-perfil')?.addEventListener('click', () => { closeSheet('more-sheet', true); openPerfilDrawer(); });
  document.querySelectorAll('.mfs-trigger, .mfs-done').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.mfs;
    b.classList.contains('mfs-trigger') ? openSheet(id) : closeSheet(id);
  }));
  setupSidebarReorder();
  setupNavBuscador();
}

/* ---------- Barra de abajo (móvil): configurable + swipe ----------
   Pedido del dueño (2026-07-27): poder elegir qué secciones aparecen abajo
   (máximo 7 contando "Yo") y moverse entre ellas deslizando el dedo.

   El catálogo NO se define acá a mano: se lee del sidebar, que ya tiene todas
   las secciones y ya está filtrado por rol vía CSS. Se pregunta por
   getComputedStyle porque el display calculado de cada .nav-item refleja las
   reglas de rol aunque el sidebar entero esté oculto en móvil -- así esto no
   se desincroniza cuando se agregue o saque una sección del menú. */
const BN_MAX = 7;                                              // incluye "Yo"
// stop-sales y gestion-personal sumados 2026-08-06: bnSeleccion() ya filtra
// por lo que el rol puede ver (vía bnCatalogo/getComputedStyle), así que basta
// con agregarlos acá una sola vez -- a un asesor/marketing/boleteria le queda
// "stop-sales" (ahora visible para todo rol) y se le cae solo "gestion-personal"
// (sigue nav-admin-only); a un admin le quedan las dos.
const BN_DEFAULT = ['hoy', 'leads', 'mensajes', 'tarifario', 'stop-sales', 'gestion-personal'];
// "Hoy" solo existe en móvil (no está en el sidebar), así que va a mano.
const BN_HOY = { sec: 'hoy', icono: 'fas fa-house', label: 'Hoy', clases: 'nav-marketing-ok nav-boleteria-ok' };
// Nombres cortos: en una barra de 7 no entra "Gestión de Personal".
const BN_LABEL_CORTO = {
  'gestion-personal': 'Personal',
  'informe-diario': 'Informe',
  'mis-comisiones': 'Comisiones',
  'buscar-tarifario': 'Buscar',
  actualizaciones: 'Novedades',
  facturacion: 'Facturas',
  cotizador: 'Cotizador',
};
// Badges que ya existían en la barra vieja y hay que preservar al reconstruirla.
const BN_BADGES = { leads: 'nav-lead-count-m' };

// Cache del catálogo/selección: bnCatalogo() recorre el sidebar entero con
// getComputedStyle por ítem (forza layout), y bnSeleccion() lo llama de nuevo
// arriba. Antes esto corría completo en CADA cambio de sección y en cada fin
// de gesto de swipe -- ahora se calcula una vez y se invalida solo cuando algo
// puede haber cambiado de verdad (renderBottomNav, que ya se llama al armar la
// barra y al guardar el editor).
let _bnCatalogoCache = null;
function bnCatalogo() {
  if (_bnCatalogoCache) return _bnCatalogoCache;
  const items = [BN_HOY];
  document.querySelectorAll('#sidebar-nav > .nav-item[data-sec]').forEach(el => {
    if (getComputedStyle(el).display === 'none') return;
    const sec = el.dataset.sec;
    if (!sec || items.some(x => x.sec === sec)) return;
    const icono = el.querySelector('i')?.className || 'fas fa-circle';
    const label = BN_LABEL_CORTO[sec]
      || [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()
      || sec;
    items.push({ sec, icono, label, clases: [...el.classList].filter(c => c.startsWith('nav-')).join(' ') });
  });
  return (_bnCatalogoCache = items);
}

// Secciones elegidas, saneadas: sin duplicados, sin las que este rol no puede
// ver (ej. quedó guardado "facturacion" y después lo pasaron a asesor), y
// acotadas al máximo. Si queda vacío, vuelve al default.
function bnSeleccion() {
  const catalogo = bnCatalogo();
  const validas = new Set(catalogo.map(x => x.sec));
  const guardada = Array.isArray(MI_PREFERENCIAS.barra_mobile) ? MI_PREFERENCIAS.barra_mobile : BN_DEFAULT;
  const out = [];
  for (const sec of guardada) {
    if (validas.has(sec) && !out.includes(sec)) out.push(sec);
    if (out.length >= BN_MAX - 1) break;
  }
  if (!out.length) return BN_DEFAULT.filter(s => validas.has(s));
  return out;
}

function renderBottomNav() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;
  _bnCatalogoCache = null; // el sidebar pudo cambiar (rol, sección nueva) desde el último render
  const catalogo = bnCatalogo();
  const porSec = Object.fromEntries(catalogo.map(x => [x.sec, x]));
  const secs = bnSeleccion();
  nav.innerHTML = secs.map(sec => {
    const it = porSec[sec];
    const badge = BN_BADGES[sec] ? `<span class="bn-badge" id="${BN_BADGES[sec]}"></span>` : '';
    return `<a class="bn-item ${esc(it.clases || '')}" data-sec="${esc(sec)}" role="tab" tabindex="0"><i class="${esc(it.icono)}"></i>${badge}<span class="bn-t">${esc(it.label)}</span></a>`;
  }).join('') + '<a class="bn-item" id="bn-more" role="tab" tabindex="0"><i class="fas fa-user"></i><span class="bn-t">Yo</span></a>'
    + '<div class="bn-indicator" id="bn-indicator"></div>';
  // El CSS achica la letra según cuántos entren, para que el nombre no se corte.
  nav.dataset.n = String(secs.length + 1);

  nav.querySelectorAll('.bn-item[data-sec]').forEach(el => {
    el.addEventListener('click', () => activateSection(el.dataset.sec));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateSection(el.dataset.sec); } });
  });
  document.getElementById('bn-more').addEventListener('click', () => openSheet('more-sheet'));
  // El badge de leads se pinta aparte y ya pudo haber corrido antes de que la
  // barra existiera: se repinta con el último valor conocido.
  actualizarBadgeLeads(BN_LEADS_PENDIENTES);
  marcarBottomNavActivo(currentSec);
}

function marcarBottomNavActivo(sec) {
  document.querySelectorAll('.bn-item').forEach(x => {
    const on = x.dataset.sec === sec;
    x.classList.toggle('active', on);
    x.setAttribute('aria-selected', String(on));
  });
  const enBarra = bnSeleccion().includes(sec);
  const masBtn = document.getElementById('bn-more');
  masBtn?.classList.toggle('active', !enBarra);
  masBtn?.setAttribute('aria-selected', String(!enBarra));
  posicionarIndicadorActivo();
}

/* ---------- Editor de la barra (dentro de Mi Perfil) ---------- */
function bnEditorHtml() {
  const catalogo = bnCatalogo();
  const sel = bnSeleccion();
  const filas = catalogo.map(it => {
    const on = sel.includes(it.sec);
    const pos = on ? sel.indexOf(it.sec) + 1 : null;
    return `<label class="bn-cfg-row${on ? ' on' : ''}">
      <input type="checkbox" data-bn-sec="${esc(it.sec)}"${on ? ' checked' : ''}>
      <i class="${esc(it.icono)}"></i>
      <span class="bn-cfg-n">${esc(it.label)}</span>
      <span class="bn-cfg-pos">${pos ? '#' + pos : ''}</span>
    </label>`;
  }).join('');
  return `<div class="edit-box" style="margin-top:16px">
    <div class="eb-title"><i class="fas fa-table-columns"></i> Barra de abajo (celular)</div>
    <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:10px">
      Elegí qué secciones querés tener a mano. Hasta ${BN_MAX - 1} más "Yo", que va siempre.
      En el celular también podés deslizar el dedo a los costados para pasar de una a otra.
    </div>
    <div class="bn-cfg-count" id="bn-cfg-count"></div>
    <div id="bn-cfg-list">${filas}</div>
  </div>`;
}

function bnEditorWire() {
  const lista = document.getElementById('bn-cfg-list');
  if (!lista) return;
  const pintarContador = () => {
    const n = lista.querySelectorAll('input[data-bn-sec]:checked').length;
    const c = document.getElementById('bn-cfg-count');
    if (c) c.textContent = `${n + 1} de ${BN_MAX} usados (incluye "Yo")`;
    // Deshabilitar lo no marcado al llegar al tope explica el límite mejor que
    // dejar tocar y después rebotar con un error.
    lista.querySelectorAll('input[data-bn-sec]').forEach(i => {
      i.disabled = !i.checked && n >= BN_MAX - 1;
      i.closest('.bn-cfg-row').classList.toggle('tope', i.disabled);
    });
  };
  pintarContador();
  lista.querySelectorAll('input[data-bn-sec]').forEach(inp => {
    inp.addEventListener('change', async () => {
      // Las que ya estaban conservan su posición y las nuevas se agregan al
      // final: agregar una sección no debería reordenarle la barra a nadie.
      const marcada = sec => !!lista.querySelector(`input[data-bn-sec="${sec}"]`)?.checked;
      const elegidas = bnSeleccion().filter(marcada);
      bnCatalogo().forEach(x => { if (marcada(x.sec) && !elegidas.includes(x.sec)) elegidas.push(x.sec); });
      inp.closest('.bn-cfg-row').classList.toggle('on', inp.checked);
      pintarContador();
      await guardarPreferencia('barra_mobile', elegidas);
      renderBottomNav();
      // Repintar las posiciones (#1, #2...) sin recargar el drawer entero.
      const sel = bnSeleccion();
      lista.querySelectorAll('.bn-cfg-row').forEach(row => {
        const sec = row.querySelector('input').dataset.bnSec;
        const i = sel.indexOf(sec);
        row.querySelector('.bn-cfg-pos').textContent = i >= 0 ? '#' + (i + 1) : '';
      });
    });
  });
}

/* ---------- Swipe lateral entre secciones (móvil) ----------
   Recorre las mismas secciones de la barra de abajo, en ese orden.
   Umbral bajado a 2026-08-19 a algo de app nativa de verdad: antes exigía
   45% del ancho de pantalla (~170px en un teléfono de 380px) Y que la
   sección vecina ya se hubiera visitado antes -- si no, el gesto no hacía
   NADA, que era el motivo real de "el swipe no funciona". SWIPE_MIN_X y
   SWIPE_MAX_MS ya existían pero nunca se leían; ahora sí se usan. */
const SWIPE_MIN_X = 90;      // px horizontales mínimos para confirmar por distancia
const SWIPE_RATIO = 1.3;     // cuánto más horizontal que vertical tiene que ser
const SWIPE_MAX_MS = 700;    // ventana para que la velocidad cuente como "flick"
const SWIPE_FLICK_VEL = 0.3; // px reales/ms para confirmar por velocidad aunque falte distancia

// Un swipe NO debe robarle el gesto a algo que scrollea de costado (tablas,
// carruseles del tarifario, filas de pestañas). Se busca hacia arriba desde el
// elemento tocado.
function dentroDeScrollHorizontal(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollWidth - n.clientWidth > 12) {
      const ov = getComputedStyle(n).overflowX;
      if (ov === 'auto' || ov === 'scroll') return true;
    }
  }
  return false;
}

// Píxeles reales del touch vs píxeles CSS: body{zoom:.9} (y .8/1.05 con
// fsize-chico/grande, index.html:71) hace que 100px de dedo NO sean 100px
// de translateX(). clientX del evento siempre viene en reales; esto lo
// convierte antes de usarlo en cualquier transform.
function zoomFactor() { return parseFloat(getComputedStyle(document.body).zoom) || 1; }

// Color del ítem activo (index.html: .bn-item.active[data-sec=...]) -- se lee
// del propio ítem en vez de duplicar el mapa acá, así el CSS sigue siendo la
// única fuente de verdad y una sección nueva sin regla propia hereda el color
// por defecto (--accent) en texto Y barrita a la vez, nunca desincronizados.
function colorSeccionActiva(el) { return el ? getComputedStyle(el).color : ''; }

// Barrita bajo el ítem activo de la bottom-nav -- se desliza proporcional al
// arrastre mientras dura el swipe (progreso 0..1, hacia vecinaSec), y vuelve
// a su lugar normal al terminar. Puramente visual (nunca toca transform de
// una .section), así que no puede reintroducir el riesgo #1.
//
// left/width se leen con getBoundingClientRect (píxeles REALES de pantalla,
// ya escalados por body{zoom}) pero se escribían en style.left/width, que el
// motor interpreta como píxeles CSS DENTRO del subárbol con zoom -- sin
// dividir por zoomFactor() la barra quedaba corrida (y el error crecía con la
// distancia al borde izquierdo). Bug real hasta 2026-08-19.
function posicionarIndicadorActivo() {
  document.getElementById('bn-indicator')?.classList.remove('dragging');
  actualizarIndicadorSwipe(0, null);
}
function actualizarIndicadorSwipe(progreso, vecinaSecParam, rectsCache) {
  const ind = document.getElementById('bn-indicator');
  if (!ind) return;
  // Si la sección abierta no está en la barra (se entró por la hoja "Yo"), no
  // hay .bn-item con ese data-sec -- antes eso hacía return acá y la barrita
  // quedaba pegada en el ítem anterior mientras "Yo" también se marcaba activo.
  const activoEl = document.querySelector(`.bn-item[data-sec="${currentSec}"]`) || document.getElementById('bn-more');
  if (!activoEl) return;
  const nav = activoEl.parentElement;
  const zf = zoomFactor();
  const navR = (rectsCache && rectsCache.navR) || nav.getBoundingClientRect();
  const rActivo = (rectsCache && rectsCache.rActivo) || activoEl.getBoundingClientRect();
  let left = rActivo.left - navR.left, width = rActivo.width;
  const vecinaEl = vecinaSecParam ? document.querySelector(`.bn-item[data-sec="${vecinaSecParam}"]`) : null;
  if (progreso && vecinaEl) {
    const rVec = (rectsCache && rectsCache.rVec) || vecinaEl.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, progreso));
    left += (rVec.left - navR.left - left) * t;
    width += (rVec.width - width) * t;
  }
  ind.style.left = (left / zf) + 'px';
  ind.style.width = (width / zf) + 'px';
  ind.style.background = colorSeccionActiva(activoEl);
}
// El resize con debounce se quedaba corto justo al arrancar: renderBottomNav()
// puede correr con Font Awesome sin cargar todavía (íconos a 0 ancho) o con la
// barra en display:none en escritorio, y nada disparaba un resize después. Un
// ResizeObserver sobre la barra recalcula apenas su layout real cambia, sin
// esperar a que el usuario gire el teléfono.
if ('ResizeObserver' in window) {
  const bnRO = new ResizeObserver(() => posicionarIndicadorActivo());
  document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.bottom-nav');
    if (nav) bnRO.observe(nav);
  });
}
window.addEventListener('orientationchange', () => setTimeout(posicionarIndicadorActivo, 60));

function setupSwipeSecciones() {
  let x0 = 0, y0 = 0, t0 = 0, activo = false, eje = null, resuelto = false, settleT = null;
  let elActual = null, elVecina = null, vecinaSec = null, dirVecina = 0, mainEl = null;
  let rectsCache = null, ultimoDxReal = 0;

  // RIESGO #1 del plan: un transform que se queda pegado en .section.active
  // (o en cualquier sección) la convierte en bloque contenedor de sus hijos
  // position:fixed -- las hojas de filtros (.mfs) se dibujan lejos del
  // viewport en vez de pegadas abajo (bug real ya visto, ver comentario en
  // index.html:1383-1387). limpiarGesto() es el único lugar que toca estos
  // estilos para terminar un gesto, y se llama SIEMPRE -- éxito (después del
  // settle), cancelación (después del settle de vuelta) y touchcancel --
  // nunca se deja en translateX(0), se borra el atributo. `resuelto` evita
  // que el transitionend y el setTimeout de respaldo la llamen dos veces.
  function limpiarGesto() {
    clearTimeout(settleT); settleT = null;
    if (mainEl) mainEl.style.position = '';
    if (elActual) { elActual.style.transform = ''; elActual.classList.remove('swipe-settling'); }
    if (elVecina) { elVecina.style.transform = ''; elVecina.classList.remove('swipe-peek', 'swipe-settling'); elVecina.style.top = elVecina.style.left = elVecina.style.width = ''; }
    elActual = null; elVecina = null; vecinaSec = null; dirVecina = 0; mainEl = null; eje = null; activo = false; rectsCache = null;
    posicionarIndicadorActivo();
  }

  function iniciarGestoX(dxReal) {
    elActual = document.getElementById('sec-' + currentSec);
    if (!elActual) { eje = 'y'; return; }
    const secs = bnSeleccion();
    const i = secs.indexOf(currentSec);
    // dedo hacia la izquierda -> avanza a la siguiente; hacia la derecha ->
    // retrocede. Sin wrap: en los extremos no hay vecina (decisión del
    // dueño, Fase 5.2) y el gesto solo amortigua.
    dirVecina = dxReal < 0 ? 1 : -1;
    vecinaSec = i < 0 ? null : secs[i + dirVecina];
    // elVecina es solo el elemento a ASOMAR de fondo (si ya se cargó antes).
    // Que no haya elemento para asomar ya NO bloquea la navegación -- eso era
    // el bug principal, ver SWIPE_MIN_X arriba.
    const candidata = vecinaSec ? document.getElementById('sec-' + vecinaSec) : null;
    elVecina = (candidata && SECCIONES_CARGADAS.has(vecinaSec)) ? candidata : null;
    mainEl = document.querySelector('.main');
    if (mainEl) mainEl.style.position = 'relative';
    if (elVecina) {
      elVecina.classList.add('swipe-peek');
      // El peek se posiciona absoluto contra .main -- sin copiar el rect de la
      // sección activa quedaba pegado al borde de PADDING de .main en vez de
      // alineado con lo que realmente se ve (index.html: .section.swipe-peek).
      const r = elActual.getBoundingClientRect(), rMain = mainEl.getBoundingClientRect();
      elVecina.style.top = (r.top - rMain.top) + 'px';
      elVecina.style.left = (r.left - rMain.left) + 'px';
      elVecina.style.width = r.width + 'px';
    }
    // Rects de la barra cacheados una sola vez por gesto: no cambian mientras
    // dura (la barra es fixed, el eje ya quedó fijado en 'x'), así se evitan
    // 3 getBoundingClientRect (forzados layout) por cada evento touchmove.
    const activoEl = document.querySelector(`.bn-item[data-sec="${currentSec}"]`) || document.getElementById('bn-more');
    const vecinaElBar = vecinaSec ? document.querySelector(`.bn-item[data-sec="${vecinaSec}"]`) : null;
    if (activoEl) {
      rectsCache = { navR: activoEl.parentElement.getBoundingClientRect(), rActivo: activoEl.getBoundingClientRect(), rVec: vecinaElBar && vecinaElBar.getBoundingClientRect() };
    }
    document.getElementById('bn-indicator')?.classList.add('dragging');
    actualizarIndicadorSwipe(0, null, rectsCache);
  }

  function aplicarArrastre(dxReal) {
    ultimoDxReal = dxReal;
    const dx = dxReal / zoomFactor();
    if (elVecina) {
      const ancho = elActual.getBoundingClientRect().width || window.innerWidth;
      elActual.style.transform = `translateX(${dx}px)`;
      elVecina.style.transform = `translateX(${dx - dirVecina * ancho}px)`;
    } else {
      // Rebote en el extremo: sin vecina (no hay siguiente/anterior, o la
      // vecina nunca cargó), el arrastre se amortigua en vez de no hacer nada.
      elActual.style.transform = `translateX(${dx * 0.35}px)`;
    }
    const ancho = window.innerWidth || 1;
    actualizarIndicadorSwipe(Math.abs(Math.max(-1, Math.min(1, dxReal / ancho))), vecinaSec, rectsCache);
  }

  // Termina el gesto animando hasta el final en vez de saltar: la sección
  // arrastrada sigue su camino hasta salir/entrar del todo y RECIÉN AHÍ se
  // llama activateSection(). Antes limpiarGesto() cortaba el transform de
  // golpe y la sección nueva entraba con un empujón de 26px aparte (sw-izq/
  // sw-der) -- se sentía como un tirón, no como un deslizamiento continuo.
  function resolverGesto(exito) {
    if (resuelto) return;
    resuelto = true;
    const elA = elActual, elV = elVecina, destino = exito ? vecinaSec : null;
    const dirSalida = ultimoDxReal < 0 ? -1 : 1;
    const zf = zoomFactor();
    const anchoCss = ((elA && elA.getBoundingClientRect().width) || window.innerWidth) / zf;
    if (elA) {
      elA.classList.add('swipe-settling');
      elA.style.transform = exito ? `translateX(${dirSalida * anchoCss}px)` : 'translateX(0px)';
    }
    if (elV) {
      elV.classList.add('swipe-settling');
      elV.style.transform = exito ? 'translateX(0px)' : `translateX(${-dirVecina * anchoCss}px)`;
    }
    const terminar = () => {
      if (elA) elA.removeEventListener('transitionend', terminar);
      if (destino) activateSection(destino);
      limpiarGesto();
    };
    if (elA) { elA.addEventListener('transitionend', terminar, { once: true }); settleT = setTimeout(terminar, 260); }
    else terminar();
  }

  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { activo = false; return; }
    // Con una hoja, drawer, tour u overlay abierto el swipe es del contenido de
    // eso, no de la navegación de fondo.
    if (sheetAbierta
      || document.getElementById('drawer')?.classList.contains('open')
      || document.getElementById('tour-overlay')?.classList.contains('open')
      || document.body.classList.contains('lb-lock')) { activo = false; return; }
    if (dentroDeScrollHorizontal(e.target)) { activo = false; return; }
    if (e.target.closest('input,textarea,select,canvas')) { activo = false; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    activo = true; eje = null; resuelto = false;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!activo) return;
    const t = e.touches[0];
    const dxReal = t.clientX - x0, dyReal = t.clientY - y0;
    if (eje === null) {
      // Bloqueo de eje: los primeros ~10px reales deciden si el gesto es
      // horizontal o vertical, y esa decisión se mantiene hasta soltar --
      // sin esto pelea con el scroll vertical de la página.
      if (Math.abs(dxReal) < 10 && Math.abs(dyReal) < 10) return;
      eje = Math.abs(dxReal) >= Math.abs(dyReal) * SWIPE_RATIO ? 'x' : 'y';
      if (eje === 'x') iniciarGestoX(dxReal);
    }
    if (eje !== 'x' || !elActual) return;
    e.preventDefault(); // solo si ganó horizontal -- necesita {passive:false}
    aplicarArrastre(dxReal);
  }, { passive: false });

  document.addEventListener('touchend', e => {
    if (!activo) { limpiarGesto(); return; }
    if (eje !== 'x' || !elActual) { limpiarGesto(); return; }
    const t = e.changedTouches[0];
    const dxReal = t.clientX - x0;
    const dt = Math.max(1, Date.now() - t0);
    const velocidadRealMs = Math.abs(dxReal) / dt; // px reales / ms, sin convertir por zoom
    // Umbral de app nativa: basta con SWIPE_MIN_X de distancia, o un flick
    // rápido dentro de SWIPE_MAX_MS aunque el dedo haya viajado poco. Antes
    // pedía 45% del ancho de pantalla (~170px) sin alternativa de velocidad.
    const pasaUmbral = Math.abs(dxReal) > SWIPE_MIN_X || (velocidadRealMs > SWIPE_FLICK_VEL && dt <= SWIPE_MAX_MS);
    // Ya no exige elVecina (el peek precargado): navega igual con vecinaSec
    // aunque la sección vecina nunca se haya visitado -- eso era lo que hacía
    // que el primer swipe a una sección nueva no hiciera nada.
    resolverGesto(pasaUmbral && !!vecinaSec);
  }, { passive: true });

  document.addEventListener('touchcancel', () => resolverGesto(false), { passive: true });
}

/* ---------- Pull-to-refresh (Fase 5.4) ----------
   <body> es el contenedor de scroll real, no <html> (index.html:78-89,
   decisión de un bug de iOS del 2026-07-18 -- no tocar esa parte). El
   gesto se engancha ahí y solo arranca con body.scrollTop === 0. Es un
   atajo, no reemplaza los botones de refrescar que ya existen en cada
   sección -- esos se quedan igual. */
// Mismo mapeo de sección->recarga que ya usa activateSection() (app.js
// ~11185), repetido acá a propósito: activateSection es un if-chain con un
// guard de "no hacer nada si ya estás ahí" (no sirve para forzar un
// refresco), y convertirlo en esta tabla es un refactor más grande que lo
// que pide esta fase. Si se agrega una sección nueva con carga propia, hay
// que sumarla en los dos lugares.
const REFRESCAR_SECCION = {
  leads: () => loadTable(), 'clientes-asignados': () => loadClientesAsignados(), 'mis-notas': () => loadMisNotas(), ranking: () => loadRanking(), facturacion: () => loadFacturacion(),
  'mis-comisiones': () => loadMisComisiones(), 'gestion-personal': () => loadGestionPersonal(),
  postventa: () => loadPostventa(), 'informe-diario': () => loadInformeDiario(), hoy: () => renderHoy(),
  tarifario: () => loadTarifario(), mensajes: () => cargarBandeja(), galeria: () => loadGaleria(),
  'cerebro-ia': () => loadCerebroIA(), 'rendimiento-ia': () => loadRendimientoIA(),
  'ia-atencion': () => loadIaAtencion(), 'web-reasignados': () => loadWebReasignados(),
  'stop-sales': () => { loadStopSalesVigentes(); ssCargarPdfActual(); },
  redes: () => cargarRedActual(), voucher: () => loadVoucherSeccion(), tareas: () => loadTareas(),
  boleteria: () => loadBoleteria(),
};
async function refrescarSeccionActual() {
  const tareas = [Promise.resolve(resyncTrasSegundoPlano())];
  const fn = REFRESCAR_SECCION[currentSec];
  if (fn) tareas.push(Promise.resolve(fn()));
  await Promise.allSettled(tareas);
}

function mostrarIndicadorPTR(distancia, umbral) {
  const el = document.getElementById('ptr-indicador');
  if (!el) return;
  el.classList.add('show');
  el.classList.toggle('listo', distancia >= umbral);
  el.style.transform = `translate(-50%, ${Math.min(distancia, umbral + 20) - 44}px)`;
  el.querySelector('i').style.transform = `rotate(${Math.min(distancia / umbral, 1) * 200}deg)`;
}
function ocultarIndicadorPTR() {
  const el = document.getElementById('ptr-indicador');
  if (!el) return;
  el.classList.remove('show', 'listo', 'cargando');
  el.style.transform = '';
  el.querySelector('i').style.transform = '';
}
async function dispararRefreshPTR() {
  const el = document.getElementById('ptr-indicador');
  if (!el) return;
  el.classList.add('show', 'cargando');
  el.style.transform = 'translate(-50%, 20px)';
  el.querySelector('i').style.transform = '';
  try { await refrescarSeccionActual(); } finally { setTimeout(ocultarIndicadorPTR, 350); }
}

function setupPullToRefresh() {
  const UMBRAL = 70;
  let y0 = 0, activo = false, distancia = 0;

  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || document.body.scrollTop > 0) { activo = false; return; }
    if (sheetAbierta
      || document.getElementById('drawer')?.classList.contains('open')
      || document.getElementById('tour-overlay')?.classList.contains('open')
      || document.body.classList.contains('lb-lock')) { activo = false; return; }
    if (e.target.closest('input,textarea,select,canvas')) { activo = false; return; }
    y0 = e.touches[0].clientY; activo = true; distancia = 0;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!activo) return;
    if (document.body.scrollTop > 0) { activo = false; distancia = 0; ocultarIndicadorPTR(); return; }
    const dy = e.touches[0].clientY - y0;
    if (dy <= 0) { distancia = 0; ocultarIndicadorPTR(); return; }
    distancia = dy * 0.5; // resistencia
    mostrarIndicadorPTR(distancia, UMBRAL);
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!activo) return;
    activo = false;
    if (distancia >= UMBRAL) dispararRefreshPTR(); else ocultarIndicadorPTR();
    distancia = 0;
  }, { passive: true });

  document.addEventListener('touchcancel', () => { activo = false; distancia = 0; ocultarIndicadorPTR(); }, { passive: true });
}

/* ---------- Long-press para selección múltiple (Fase 5.5) ----------
   Reusa TAL CUAL la selección que ya existe (wireLeadChecks/SELECTED_LEADS/
   updateBulkBar, ver app.js ~2573) -- el long-press solo hace lo mismo que
   tocar el checkbox: lo tilda y dispara su propio 'change'. Cero lógica de
   selección duplicada.
   Solo tarjetas de Leads: los checkboxes son solo-admin-borrar (admin) y
   el checkbox SOLO existe en leadCardHtml -- postCardHtml (vista tarjetas
   de Postulaciones) no tiene uno, así que ahí no hay nada que long-press
   pueda tildar. Sumarle uno es una ampliación de scope, no esta fase. */
function setupLongPressSeleccion() {
  const LONG_PRESS_MS = 500, UMBRAL_MOVIMIENTO = 10;
  let timer = null, x0 = 0, y0 = 0, disparado = false;

  document.addEventListener('touchstart', e => {
    if (ROL !== 'admin') return;
    if (e.target.closest('button,a,input,select,.estado-arrow')) return;
    const tarjeta = e.target.closest('.entity-card[data-lead-id]');
    if (!tarjeta) return;
    const cb = tarjeta.querySelector('.lead-check');
    if (!cb || getComputedStyle(cb).display === 'none') return;
    const t = e.touches[0];
    x0 = t.clientX; y0 = t.clientY;
    timer = setTimeout(() => {
      const habiaSeleccion = SELECTED_LEADS.size > 0;
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
      navigator.vibrate?.(10);
      disparado = true;
      // Solo se registra en NAV_STACK la PRIMERA selección de la racha --
      // si ya había algo seleccionado, el atrás ya tiene su entrada.
      if (!habiaSeleccion && cb.checked) navPush({ type: 'seleccion', limpiar: clearSelection });
      timer = null;
    }, LONG_PRESS_MS);
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!timer) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - x0) > UMBRAL_MOVIMIENTO || Math.abs(t.clientY - y0) > UMBRAL_MOVIMIENTO) { clearTimeout(timer); timer = null; }
  }, { passive: true });

  document.addEventListener('touchend', () => { clearTimeout(timer); timer = null; }, { passive: true });
  document.addEventListener('touchcancel', () => { clearTimeout(timer); timer = null; }, { passive: true });

  // El navegador dispara un click sintético después de un touchend -- si el
  // long-press ya disparó (tildó el checkbox), hay que tragarse ese click
  // para que no ABRA TAMBIÉN el drawer del lead (el listener de click de la
  // tarjeta vive en wireLeadCardLive). Captura, para interceptar antes.
  document.addEventListener('click', e => {
    if (disparado) { e.preventDefault(); e.stopPropagation(); disparado = false; }
  }, true);
}

/* ---------- Orden de la sidebar a mano (drag & drop, guardado en
   preferencias.orden_sidebar) ---------- Solo el sidebar de escritorio;
   bottom-nav/more-sheet mobile quedan con su orden fijo de siempre. Los
   nav-label también entran en el orden guardado (se arrastran los nav-item,
   pero las etiquetas de grupo se mueven junto con ellos al reconstruir). */
function setupSidebarReorder() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  let dragEl = null;
  nav.querySelectorAll(':scope > .nav-item:not(.nav-freq)').forEach(item => {
    item.draggable = true;
    item.addEventListener('dragstart', () => { dragEl = item; item.classList.add('dragging'); });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      nav.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      dragEl = null;
      guardarOrdenSidebar();
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragEl || dragEl === item) return;
      item.classList.add('drag-over');
      const before = (e.clientY - item.getBoundingClientRect().top) < item.offsetHeight / 2;
      nav.insertBefore(dragEl, before ? item : item.nextSibling);
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
  });
}
function guardarOrdenSidebar() {
  const orden = [...document.querySelectorAll('#sidebar-nav > .nav-item:not(.nav-freq), #sidebar-nav > .nav-label:not([data-grupo-frec])')]
    .map(el => el.classList.contains('nav-label') ? 'label:' + el.dataset.label : 'sec:' + el.dataset.sec);
  if (JSON.stringify(orden) === JSON.stringify(MI_PREFERENCIAS.orden_sidebar_v2 || null)) return;
  MI_PREFERENCIAS = { ...MI_PREFERENCIAS, orden_sidebar_v2: orden };
  // sb.rpc() devuelve un builder "thenable" de postgrest-js, no una Promise real:
  // tiene .then() pero NO .catch(). Llamar .catch() directo tira
  // "TypeError: sb.rpc(...).catch is not a function" y, al ocurrir dentro de
  // startApp, cortaba la inicialización entera (sin KPIs ni gráficas).
  // Promise.resolve() lo normaliza a Promise real antes de encadenar .catch().
  Promise.resolve(sb.rpc('actualizar_mi_perfil', { p_preferencias: MI_PREFERENCIAS })).catch(() => {});
}
function aplicarOrdenSidebar() {
  // orden_sidebar (sin sufijo) es el guardado bajo el esquema VIEJO de 4
  // grupos (principal/tarifario/gestion/ayuda) -- reproducirlo tal cual tras
  // el regrupamiento a 7 grupos amontona los grupos nuevos (ventas/ia/
  // marketing) al final, vacíos, porque no existen en ese array viejo.
  // orden_sidebar_v2 arranca limpio para todos, sin migrar datos.
  const orden = MI_PREFERENCIAS.orden_sidebar_v2;
  const nav = document.getElementById('sidebar-nav');
  if (!orden?.length || !nav) return;
  const hijos = [...nav.querySelectorAll(':scope > .nav-item, :scope > .nav-label')];
  const idDe = el => el.classList.contains('nav-label') ? 'label:' + el.dataset.label : 'sec:' + el.dataset.sec;
  const mapa = new Map(hijos.map(el => [idDe(el), el]));
  // Los que no estén en el orden guardado (secciones nuevas agregadas después
  // de que el usuario guardó su orden) quedan al final, en su posición
  // original entre sí.
  const usados = new Set();
  const final = [];
  orden.forEach(id => { const el = mapa.get(id); if (el) { final.push(el); usados.add(el); } });
  hijos.forEach(el => { if (!usados.has(el)) final.push(el); });
  final.forEach(el => nav.appendChild(el));
}

/* ---------- Recordar la última sección visitada (preferencias.ultima_seccion) ----------
   Se guarda para cualquier rol, pero solo se restaura al entrar para admin/
   asesor -- marketing y boleteria arrancan siempre en su única sección fija
   (ver startApp), no tiene sentido restaurarles nada ahí. */
function guardarUltimaSeccion(sec) {
  if (MI_PREFERENCIAS.ultima_seccion === sec) return;
  MI_PREFERENCIAS = { ...MI_PREFERENCIAS, ultima_seccion: sec };
  guardarPreferenciasNavDebounced();
}

/* ---------- Leads: sub-pestañas (Leads / Colaboraciones) ----------
   Colaboraciones era una sección suelta del menú; ahora vive acá porque es el
   mismo objeto (un lead) con otro origen. Solo admin la ve. */
let leadsTab = 'pipeline';
function setupLeadsTabs() {
  document.querySelectorAll('#leads-tabs .seg').forEach(btn => btn.addEventListener('click', () => {
    leadsTab = btn.dataset.leadsTab;
    document.querySelectorAll('#leads-tabs .seg').forEach(b => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.leads-tab-panel').forEach(p => p.style.display = p.dataset.leadsPanel === leadsTab ? '' : 'none');
    if (leadsTab === 'colaboraciones') loadLeadsColaboraciones();
    if (leadsTab === 'facturacion') loadLeadsEnFacturacion();
    if (leadsTab === 'boleteria') loadColaBoleteria();
  }));
  document.getElementById('lf-refrescar')?.addEventListener('click', () => loadLeadsEnFacturacion());
  loadLeadsEnFacturacion(); // el contador de la pestaña tiene que estar antes de que la abran
  setupBoleteria();
  loadColaBoleteria();
  setupLeadsDropTargets();
}

/* ---------- Cola de boletería (sub-pestaña de Leads) ----------
   El asesor manda una solicitud de vuelo a una cola compartida; los agentes de
   boletería (marca es_boleteria, no un rol) la atienden por orden de llegada.
   El asesor ve lo suyo con su puesto en la cola; el agente ve todo y toma la
   siguiente. Mismo patrón que "En facturación", cola distinta. */
let MI_ES_AGENTE_BOLETERIA = false;
let BOL_CERRAR_ID = null;
let BOL_BUSCAR_DEBOUNCE = null;
// Última cola cargada: la hoja de detalle lee de acá en vez de volver a pedirla.
let BOL_COLA = [];

// Precios de boletería nacional ya confirmados (mismos que en la IA). Si la ruta
// de la solicitud coincide, se le muestra al agente el precio que ya tenemos en
// vez de que lo busque de cero. Clave: "origen|destino" en minúsculas, sin tildes.
const BOL_PRECIOS = {
  'valencia|porlamar': 131, 'valencia|san antonio': 195, 'valencia|maracaibo': 164,
};
const bolNorm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
function bolPrecioRuta(origen, destino) {
  const o = bolNorm(origen), d = bolNorm(destino);
  const p = BOL_PRECIOS[`${o}|${d}`] ?? BOL_PRECIOS[`${d}|${o}`];
  return p ? `Precio ya cargado para esta ruta: ${money(p)} por persona, ida y vuelta (Aerolíneas Turpial). El agente confirma cupo.` : '';
}

const BOL_ERR = {
  falta_nombre: 'Falta el nombre del cliente',
  falta_origen: 'Falta de dónde sale el vuelo',
  falta_destino: 'Falta a dónde va el vuelo',
  regreso_antes_de_ida: 'La fecha de regreso es anterior a la de ida',
  ya_en_cola: 'Ese lead ya tiene una solicitud abierta en la cola',
  lead_no_disponible: 'Ese lead ya no está disponible',
  no_disponible: 'Esa solicitud ya la tomó o cerró alguien más',
  ida_en_el_pasado: 'La fecha de ida ya pasó',
  regreso_en_el_pasado: 'La fecha de regreso ya pasó',
  personas_invalidas: 'La cantidad de personas tiene que estar entre 1 y 60',
  no_existe: 'Esa solicitud ya no existe',
  ya_cerrada: 'Esa solicitud ya estaba cerrada',
};

// Hoy en Caracas, en formato YYYY-MM-DD -- el mismo día que usa el RPC para
// validar. Con la hora del navegador se corría un día para quien tenga el
// dispositivo en otro huso.
function hoyCaracasISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// Validación de fechas en vivo: el navegador ya bloquea elegir antes del `min`,
// pero se puede escribir la fecha a mano, así que igual se revisa acá y el RPC
// lo revisa de nuevo del lado del servidor.
function bolValidarFechas() {
  const hoy = hoyCaracasISO();
  const ida = val('bol-fecha-viaje'), regreso = val('bol-fecha-regreso');
  const aviso = document.getElementById('bol-fecha-aviso');
  const reg = document.getElementById('bol-fecha-regreso');
  if (reg) reg.min = ida || hoy;
  let msg = '';
  if (ida && ida < hoy) msg = 'La fecha de ida ya pasó.';
  else if (regreso && regreso < hoy) msg = 'La fecha de regreso ya pasó.';
  else if (ida && regreso && regreso < ida) msg = 'El regreso no puede ser antes de la ida.';
  if (aviso) aviso.textContent = msg;
  return msg;
}

function setupBoleteria() {
  document.getElementById('bol-refrescar')?.addEventListener('click', () => loadColaBoleteria());
  document.getElementById('bol-nueva-btn')?.addEventListener('click', () => abrirSolicitudBoleteria());
  document.getElementById('bol-cancelar')?.addEventListener('click', () => closeSheet('boleteria-sheet'));
  document.getElementById('bol-enviar')?.addEventListener('click', enviarSolicitudBoleteria);
  ['bol-origen', 'bol-destino'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
    document.getElementById('bol-precio').textContent = bolPrecioRuta(val('bol-origen'), val('bol-destino'));
  }));
  document.getElementById('bol-buscar')?.addEventListener('input', bolBuscarLead);
  ['bol-fecha-viaje', 'bol-fecha-regreso'].forEach(id =>
    document.getElementById(id)?.addEventListener('change', bolValidarFechas));
  document.getElementById('bol-cerrar-cancelar')?.addEventListener('click', () => closeSheet('bol-cerrar-sheet'));
  document.getElementById('bol-cerrar-ok')?.addEventListener('click', cerrarSolicitudBoleteria);
}

function abrirSolicitudBoleteria(lead) {
  document.getElementById('bol-err').textContent = '';
  ['bol-nombre', 'bol-telefono', 'bol-cedula', 'bol-origen', 'bol-destino',
   'bol-fecha-viaje', 'bol-fecha-regreso', 'bol-personas', 'bol-notas', 'bol-buscar'].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = '';
  });
  document.getElementById('bol-flexible').checked = false;
  document.getElementById('bol-precio').textContent = '';
  // El navegador no deja elegir un día anterior a `min` en el calendario.
  const hoy = hoyCaracasISO();
  document.getElementById('bol-fecha-viaje').min = hoy;
  document.getElementById('bol-fecha-regreso').min = hoy;
  document.getElementById('bol-fecha-aviso').textContent = '';
  document.getElementById('bol-buscar-res').style.display = 'none';
  document.getElementById('bol-lead-id')?.remove();
  const hid = document.createElement('input');
  hid.type = 'hidden'; hid.id = 'bol-lead-id';
  document.getElementById('boleteria-sheet').appendChild(hid);
  const box = document.getElementById('bol-cliente');
  if (lead) {
    // Precargado desde el botón "a boletería" de un lead: cliente fijo.
    hid.value = lead.id;
    document.getElementById('bol-nombre').value = lead.nombre || '';
    document.getElementById('bol-telefono').value = lead.telefono || '';
    document.getElementById('bol-destino').value = lead.destino || '';
    document.getElementById('bol-buscar-box').style.display = 'none';
    box.style.display = ''; box.innerHTML = `<i class="fas fa-user"></i> Desde el lead de <b>${esc(lead.nombre || 'Sin nombre')}</b>`;
    document.getElementById('bol-precio').textContent = bolPrecioRuta(val('bol-origen'), val('bol-destino'));
  } else {
    document.getElementById('bol-buscar-box').style.display = '';
    box.style.display = 'none';
  }
  openSheet('boleteria-sheet');
}

function bolBuscarLead(e) {
  clearTimeout(BOL_BUSCAR_DEBOUNCE);
  const q = e.target.value.trim();
  const box = document.getElementById('bol-buscar-res');
  if (q.length < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
  BOL_BUSCAR_DEBOUNCE = setTimeout(async () => {
    const qSafe = q.replace(/[,()%]/g, '');
    const { data, error } = await sb.from('leads').select('id,nombre,telefono,destino,asesor,estado')
      .or(`nombre.ilike.%${qSafe}%,telefono.ilike.%${qSafe}%`).is('eliminado_at', null).limit(12);
    if (error) { box.style.display = 'none'; return; }
    if (!data || !data.length) { box.innerHTML = '<div style="padding:10px;font-size:12.5px;color:var(--muted)">Sin resultados</div>'; box.style.display = ''; return; }
    box.innerHTML = data.map(l => `
      <div class="nl-buscar-row" data-lid="${l.id}" style="padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--line);font-size:13px">
        <b>${esc(l.nombre)}</b> <span style="color:var(--muted)">${esc(l.telefono || 'sin teléfono')}</span>
        <div style="font-size:11.5px;color:var(--muted2)">${esc(l.asesor || 'Sin asignar')} · ${esc(niceEstado(l.estado))}</div>
      </div>`).join('');
    box.style.display = '';
    box.querySelectorAll('.nl-buscar-row').forEach(row => row.addEventListener('click', () => {
      const l = data.find(x => String(x.id) === row.dataset.lid);
      if (l) abrirSolicitudBoleteria(l);
    }));
  }, 300);
}

async function enviarSolicitudBoleteria() {
  const btn = document.getElementById('bol-enviar'), err = document.getElementById('bol-err');
  const ent = id => { const v = parseInt(val(id), 10); return Number.isFinite(v) ? v : null; };
  const leadId = document.getElementById('bol-lead-id')?.value;
  const problemaFecha = bolValidarFechas();
  if (problemaFecha) { err.textContent = problemaFecha; return; }
  err.textContent = ''; btn.disabled = true; btn.innerHTML = 'Enviando... <i class="fas fa-spinner fa-spin"></i>';
  const { data, error } = await sb.rpc('crear_solicitud_boleteria', {
    p_cliente_nombre: val('bol-nombre'),
    p_origen: val('bol-origen'), p_destino: val('bol-destino'),
    p_lead_id: leadId ? Number(leadId) : null,
    p_cliente_telefono: val('bol-telefono'), p_cliente_cedula: val('bol-cedula'),
    p_fecha_viaje: val('bol-fecha-viaje') || null, p_fecha_regreso: val('bol-fecha-regreso') || null,
    p_flexible_fechas: document.getElementById('bol-flexible').checked,
    p_personas: ent('bol-personas'), p_notas: val('bol-notas'),
  });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Mandar a la cola';
  if (error || !data?.ok) { err.textContent = 'No se pudo mandar: ' + (BOL_ERR[data?.error] || error?.message || data?.error || ''); return; }
  closeSheet('boleteria-sheet');
  okToast('Solicitud mandada a la cola de boletería');
  loadColaBoleteria();
}

const BOL_ESTADO = {
  en_cola:    { cls: 'cola', t: 'En cola' },
  atendiendo: { cls: 'aten', t: 'Atendiendo' },
  resuelta:   { cls: 'res', t: 'Resuelta' },
  cancelada:  { cls: 'can', t: 'Cancelada' },
};
// La tarjeta es un resumen tocable. Todo el detalle y las acciones viven en la
// hoja que abre al tocarla (bolDetalleHtml) -- antes la cola era un muro de
// datos donde no se distinguía una solicitud de otra.
function bolCardHtml(s) {
  const est = BOL_ESTADO[s.estado] || BOL_ESTADO.en_cola;
  const fechas = [s.fecha_viaje && fmtDiaCorto(s.fecha_viaje), s.fecha_regreso && fmtDiaCorto(s.fecha_regreso)].filter(Boolean).join(' → ');
  const puesto = (s.estado === 'en_cola' && s.puesto) ? `<span class="bol-puesto">#${s.puesto} en la cola</span>` : '';
  const resumen = [
    fechas ? `<span><i class="fas fa-calendar-days"></i> ${esc(fechas)}</span>` : '',
    s.personas != null ? `<span><i class="fas fa-users"></i> ${s.personas}</span>` : '',
    s.flexible_fechas ? '<span><i class="fas fa-shuffle"></i> Fechas flexibles</span>' : '',
  ].filter(Boolean).join('');
  return `<div class="bol-card st-${s.estado}" data-bol-abrir="${s.id}" role="button" tabindex="0">
    <div class="bol-top">
      <div class="bol-nombre">${esc(s.cliente_nombre)}</div>
      ${puesto}
      <span class="bol-chip ${est.cls}">${est.t}</span>
    </div>
    <div class="bol-ruta"><i class="fas fa-plane"></i> ${esc(s.origen)} → ${esc(s.destino)}</div>
    ${resumen ? `<div class="bol-resumen">${resumen}</div>` : ''}
    <div class="bol-pie">
      <span>Por ${esc(s.creado_por || '—')}${s.tomada_por ? ' · atiende ' + esc(s.tomada_por) : ''}</span>
      <span>${tiempoRelativo(s.creado_en)}</span>
    </div>
  </div>`;
}

function bolDetalleHtml(s) {
  const est = BOL_ESTADO[s.estado] || BOL_ESTADO.en_cola;
  const precio = bolPrecioRuta(s.origen, s.destino);
  const dato = (k, v, ancho) => v ? `<div class="bd-dato ${ancho ? 'ancho' : ''}"><div class="bd-k">${esc(k)}</div><div class="bd-v">${v}</div></div>` : '';
  const fechaTxt = f => f ? esc(fmtDiaCorto(f)) : '<span style="color:var(--muted2)">Sin definir</span>';
  // Mismas reglas de permiso que el backend: el agente toma/resuelve/cancela;
  // el asesor dueño solo cancela lo suyo mientras nadie lo tomó; borrar es admin.
  const acc = [];
  if (MI_ES_AGENTE_BOLETERIA) {
    if (s.estado === 'en_cola') acc.push(`<button class="dbtn save" data-bol-tomar="${s.id}"><i class="fas fa-hand"></i> Tomar</button>`);
    else if (s.estado === 'atendiendo') {
      acc.push(`<button class="dbtn save" data-bol-cerrar="${s.id}"><i class="fas fa-check"></i> Marcar resuelta</button>`);
      acc.push(`<button class="dbtn gh" data-bol-cancelar="${s.id}"><i class="fas fa-xmark"></i> Cancelar</button>`);
    }
  } else if (s.es_mia && s.estado === 'en_cola') {
    acc.push(`<button class="dbtn gh" data-bol-cancelar="${s.id}"><i class="fas fa-xmark"></i> Cancelar solicitud</button>`);
  }
  if (ROL === 'admin') acc.push(`<button class="dbtn peligro" data-bol-eliminar="${s.id}"><i class="fas fa-trash"></i> Eliminar</button>`);

  return `
    <div class="bd-head">
      <div class="bd-ava"><i class="fas fa-plane-departure"></i></div>
      <div style="min-width:0;flex:1">
        <div class="bd-nombre">${esc(s.cliente_nombre)}</div>
        <div class="bd-sub">Solicitud #${s.id} · ${tiempoRelativo(s.creado_en)}</div>
        <span class="bol-chip ${est.cls}" style="margin-top:8px;display:inline-block">${est.t}</span>
        ${(s.estado === 'en_cola' && s.puesto) ? `<span class="bol-puesto" style="margin-left:6px">#${s.puesto} en la cola</span>` : ''}
      </div>
    </div>

    <div class="bd-ruta">
      <div class="bd-ciudad"><span>Sale de</span><b>${esc(s.origen)}</b></div>
      <i class="fas fa-plane bd-flecha"></i>
      <div class="bd-ciudad"><span>Llega a</span><b>${esc(s.destino)}</b></div>
    </div>
    ${precio ? `<div class="bol-precio" style="text-align:center;margin:-6px 0 12px">${precio}</div>` : ''}

    <div class="bd-datos">
      <div class="bd-dato"><div class="bd-k">Ida</div><div class="bd-v">${fechaTxt(s.fecha_viaje)}</div></div>
      <div class="bd-dato"><div class="bd-k">Regreso</div><div class="bd-v">${fechaTxt(s.fecha_regreso)}</div></div>
      ${dato('Personas', s.personas != null ? String(s.personas) : '')}
      ${dato('Flexibilidad', s.flexible_fechas ? 'Acepta otras fechas' : '')}
      ${dato('Teléfono', esc(s.cliente_telefono || ''))}
      ${dato('Cédula', esc(s.cliente_cedula || ''))}
      ${dato('Notas del asesor', esc(s.notas || ''), true)}
      ${dato('Resultado', esc(s.resultado || ''), true)}
    </div>

    ${acc.length ? `<div class="bd-acc">${acc.join('')}</div>` : ''}
    <div class="bd-pie">
      Pedida por ${esc(s.creado_por || '—')} · ${esc(fmtFechaHoraCaracas(s.creado_en))}
      ${s.tomada_por ? `<br>Atiende ${esc(s.tomada_por)}${s.tomada_en ? ' · ' + esc(fmtFechaHoraCaracas(s.tomada_en)) : ''}` : ''}
      ${s.cerrada_en ? `<br>Cerrada ${esc(fmtFechaHoraCaracas(s.cerrada_en))}` : ''}
    </div>`;
}

function abrirDetalleBoleteria(id) {
  const s = (BOL_COLA || []).find(x => String(x.id) === String(id));
  if (!s) return;
  const cuerpo = document.getElementById('bol-detalle-cuerpo');
  cuerpo.innerHTML = bolDetalleHtml(s);
  cuerpo.querySelector('[data-bol-tomar]')?.addEventListener('click', () => { cerrarDetalleBoleteria(); bolTomar(id); });
  cuerpo.querySelector('[data-bol-cancelar]')?.addEventListener('click', () => { cerrarDetalleBoleteria(); bolCancelar(id); });
  cuerpo.querySelector('[data-bol-eliminar]')?.addEventListener('click', () => bolEliminar(id));
  cuerpo.querySelector('[data-bol-cerrar]')?.addEventListener('click', () => {
    cerrarDetalleBoleteria();
    BOL_CERRAR_ID = id;
    document.getElementById('bol-cerrar-nota').value = '';
    document.getElementById('bol-cerrar-err').textContent = '';
    openSheet('bol-cerrar-sheet');
  });
  openSheet('bol-detalle-sheet');
}
// Cierra la hoja descartando su entrada de historial a mano, para no encadenar
// dos history.back() cuando abre otra hoja arriba (mismo patrón que el borrado
// de leads, ver confirm-delete-lead-ok).
function cerrarDetalleBoleteria() {
  if (NAV_STACK[NAV_STACK.length - 1]?.type === 'sheet') NAV_STACK.pop();
  closeSheet('bol-detalle-sheet', true);
}

async function bolEliminar(id) {
  if (!(await confirmarSheet({ titulo: '¿Eliminar esta solicitud de la cola?', detalle: 'Deja de verse para todos.', textoOk: 'Eliminar', destructivo: true }))) return;
  const { data, error } = await sb.rpc('eliminar_solicitud_boleteria', { p_id: Number(id) });
  if (error || !data?.ok) { errToast('No se pudo eliminar: ' + (BOL_ERR[data?.error] || error?.message || '')); return; }
  cerrarDetalleBoleteria();
  okToast('Solicitud eliminada');
  loadColaBoleteria();
}

async function loadColaBoleteria() {
  if (ROL !== 'admin' && ROL !== 'asesor' && ROL !== 'boleteria') return;
  const grid = document.getElementById('bol-grid');
  if (!grid) return;
  const loading = document.getElementById('bol-loading'), empty = document.getElementById('bol-empty');
  loading?.classList.add('show');
  const [cola, agentes] = await Promise.all([
    sb.rpc('listar_cola_boleteria'),
    sb.rpc('agentes_boleteria_estado'),
  ]);
  loading?.classList.remove('show');
  if (cola.error) { console.error('cola_boleteria', cola.error); errToast('No se pudo cargar la cola de boletería'); return; }
  const filas = cola.data || [];
  // Soy agente si aparezco en el roster de agentes (marca es_boleteria).
  MI_ES_AGENTE_BOLETERIA = (agentes.data || []).some(a => String(a.usuario_id) === String(MI_USUARIO_ID)) || ROL === 'admin';

  const abiertas = filas.filter(s => s.estado === 'en_cola' || s.estado === 'atendiendo').length;
  const badge = document.getElementById('leads-bol-count');
  if (badge) { badge.textContent = abiertas; badge.style.display = abiertas ? '' : 'none'; }

  const ag = document.getElementById('bol-agentes');
  ag.innerHTML = (agentes.data || []).length
    ? (agentes.data).map(a => `<div class="bol-ag"><span class="bol-ag-dot${a.conectado_ahora ? ' on' : ''}"></span><b>${esc(a.nombre)}</b>${a.atendiendo ? ` <span class="bol-ag-carga">· ${a.atendiendo} atendiendo</span>` : (a.conectado_ahora ? ' <span class="bol-ag-carga">· libre</span>' : '')}</div>`).join('')
    : '<div class="ef-opc">No hay agentes de boletería configurados. Un admin lo activa en Gestión de Personal.</div>';

  empty?.classList.toggle('show', filas.length === 0);
  BOL_COLA = filas;
  grid.innerHTML = filas.map(bolCardHtml).join('');
  grid.querySelectorAll('[data-bol-abrir]').forEach(c => {
    c.addEventListener('click', () => abrirDetalleBoleteria(c.dataset.bolAbrir));
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDetalleBoleteria(c.dataset.bolAbrir); } });
  });
}

async function bolTomar(id) {
  const { data, error } = await sb.rpc('tomar_solicitud_boleteria', { p_id: Number(id) });
  if (error || !data?.ok) { errToast('No se pudo tomar: ' + (BOL_ERR[data?.error] || error?.message || '')); loadColaBoleteria(); return; }
  okToast('Solicitud tomada'); loadColaBoleteria();
}
async function cerrarSolicitudBoleteria() {
  if (!BOL_CERRAR_ID) return;
  const btn = document.getElementById('bol-cerrar-ok'), err = document.getElementById('bol-cerrar-err');
  err.textContent = ''; btn.disabled = true; btn.innerHTML = 'Guardando... <i class="fas fa-spinner fa-spin"></i>';
  const { data, error } = await sb.rpc('resolver_solicitud_boleteria', { p_id: Number(BOL_CERRAR_ID), p_resultado: val('bol-cerrar-nota') });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Marcar resuelta';
  if (error || !data?.ok) { err.textContent = 'No se pudo cerrar: ' + (BOL_ERR[data?.error] || error?.message || ''); return; }
  closeSheet('bol-cerrar-sheet'); okToast('Solicitud resuelta'); BOL_CERRAR_ID = null; loadColaBoleteria();
}
async function bolCancelar(id) {
  if (!(await confirmarSheet({ titulo: '¿Cancelar esta solicitud de boletería?', textoOk: 'Cancelar solicitud', destructivo: true }))) return;
  const { data, error } = await sb.rpc('cancelar_solicitud_boleteria', { p_id: Number(id) });
  if (error || !data?.ok) { errToast('No se pudo cancelar: ' + (BOL_ERR[data?.error] || error?.message || '')); return; }
  okToast('Solicitud cancelada'); loadColaBoleteria();
}

/* ---------- Modo Boletería -- cambio de modo completo, no una sección más.
   body.modo-boleteria recolorea TODO el CRM (variables CSS en body, cascadean
   solas) y reemplaza el menú entero por el set de Boletería (mismo mecanismo
   que rol-marketing/rol-boleteria, ver index.html:1247-1249).
   Pedido del dueño tras ver la versión anterior (tema scopeado a la sección):
   quería algo más contundente, con botón de volver. El rol `boleteria` entra
   directo al modo desde entrarSegunRol() (sin flash: se aplica ahí, antes de
   startApp) y no tiene botón de volver -- no tiene otro lado al que ir. */
let modoBoleteria = false;
let seccionAntesDeModoBoleteria = null;
function entrarModoBoleteria() {
  if (!modoBoleteria) seccionAntesDeModoBoleteria = currentSec;
  modoBoleteria = true;
  document.body.classList.add('modo-boleteria');
  activateSection('boleteria');
}
function salirModoBoleteria() {
  modoBoleteria = false;
  document.body.classList.remove('modo-boleteria');
  activateSection(seccionAntesDeModoBoleteria && document.getElementById('sec-' + seccionAntesDeModoBoleteria) ? seccionAntesDeModoBoleteria : (ROL === 'asesor' ? 'leads' : 'dashboard'));
  seccionAntesDeModoBoleteria = null;
}
function irAColaBoleteria() {
  if (!modoBoleteria) entrarModoBoleteria();
  activateSection('leads');
  document.querySelector('[data-leads-tab="boleteria"]')?.click();
}

/* ---------- Sección Boletería (D4) -- base de conocimiento de vuelos:
   rutas, aerolíneas, precios, requisitos por país y calendario de
   temporadas. Distinta de la cola de solicitudes de arriba (BOL_*), que
   sigue funcionando igual. */
let bolCatalogo = null;
let bolTab = 'rutas';
function setupBoleteriaSeccion() {
  document.querySelectorAll('#bol-tabs .seg').forEach(btn => btn.addEventListener('click', () => {
    bolTab = btn.dataset.bolTab;
    document.querySelectorAll('#bol-tabs .seg').forEach(b => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.bol-tab-panel').forEach(p => p.style.display = p.dataset.bolPanel === bolTab ? '' : 'none');
    renderBoleteriaTab();
  }));
  document.getElementById('bol-buscador')?.addEventListener('input', () => renderBoleteriaTab());
  document.getElementById('bol-ruta-nueva')?.addEventListener('click', nuevaRutaBoleteria);
  document.getElementById('bol-aerolinea-nueva')?.addEventListener('click', nuevaAerolineaBoleteria);
  document.getElementById('bol-precio-nuevo')?.addEventListener('click', nuevoPrecioBoleteria);
  document.getElementById('bol-requisito-nuevo')?.addEventListener('click', nuevoRequisitoBoleteria);
  document.getElementById('bol-temporada-nueva')?.addEventListener('click', nuevaTemporadaBoleteria);
  document.getElementById('btn-entrar-modo-boleteria')?.addEventListener('click', entrarModoBoleteria);
  document.getElementById('btn-salir-modo-boleteria')?.addEventListener('click', salirModoBoleteria);
  document.getElementById('sheet-entrar-modo-boleteria')?.addEventListener('click', entrarModoBoleteria);
  document.getElementById('sheet-salir-modo-boleteria')?.addEventListener('click', salirModoBoleteria);
  document.getElementById('nav-cola-boleteria')?.addEventListener('click', irAColaBoleteria);
  document.getElementById('sheet-cola-boleteria')?.addEventListener('click', irAColaBoleteria);
}
async function loadBoleteria() {
  const { data, error } = await sb.rpc('boleteria_catalogo');
  if (error) { console.error('boleteria_catalogo:', error); errToast('No se pudo cargar Boletería'); return; }
  bolCatalogo = data;
  renderBoleteriaTab();
}
function bolFiltro() { return (val('bol-buscador') || '').trim().toLowerCase(); }
function bolMatch(texto, alias) {
  const q = bolFiltro();
  if (!q) return true;
  if ((texto || '').toLowerCase().includes(q)) return true;
  return (alias || []).some(a => (a || '').toLowerCase().includes(q));
}
function renderBoleteriaTab() {
  if (!bolCatalogo) return;
  if (bolTab === 'rutas') return renderBolRutas();
  if (bolTab === 'aerolineas') return renderBolAerolineas();
  if (bolTab === 'precios') return renderBolPrecios();
  if (bolTab === 'requisitos') return renderBolRequisitos();
  if (bolTab === 'calendario') return renderBolCalendario();
}
function bolNombreAerolinea(id) { return bolCatalogo.aerolineas.find(a => a.id === id)?.nombre || '—'; }
function bolNombreRuta(id) { return bolCatalogo.rutas.find(r => r.id === id)?.nombre_natural || '—'; }
function renderBolRutas() {
  const wrap = document.getElementById('bol-rutas-wrap'); if (!wrap) return;
  const rutas = bolCatalogo.rutas.filter(r => bolMatch(r.nombre_natural + ' ' + r.nombre_corto + ' ' + r.origen_iata + ' ' + r.destino_iata, r.alias));
  wrap.innerHTML = rutas.length ? rutas.map(r => {
    const aerolineas = bolCatalogo.ruta_aerolineas.filter(ra => ra.ruta_id === r.id).map(ra => bolNombreAerolinea(ra.aerolinea_id));
    return `<div class="card"><h2>${esc(r.nombre_natural)}</h2><div class="csub">${esc(r.nombre_corto)}${r.es_internacional ? ' · Internacional' : ' · Nacional'}</div>
      <div style="margin-top:8px;font-size:12.5px;color:var(--muted2)">${aerolineas.length ? 'Vuela: ' + esc(aerolineas.join(', ')) : 'Sin aerolíneas asignadas'}</div></div>`;
  }).join('') : '<div class="pc-vacio">Sin rutas cargadas todavía.</div>';
}
function renderBolAerolineas() {
  const wrap = document.getElementById('bol-aerolineas-wrap'); if (!wrap) return;
  const aerolineas = bolCatalogo.aerolineas.filter(a => bolMatch(a.nombre + ' ' + (a.iata_code || '')));
  wrap.innerHTML = aerolineas.length ? aerolineas.map(a => `
    <div class="card"><h2>${esc(a.nombre)} ${a.por_verificar ? '<span class="chip" style="background:rgba(245,181,68,.18);color:#f5b544">Por verificar</span>' : ''}</h2>
      <div class="csub">${esc(a.iata_code || 'Sin código IATA')}${a.operativa ? '' : ' · No operativa'}</div>
      <div style="margin-top:8px;font-size:12.5px;color:var(--muted2)">
        ${a.equipaje_bodega_kg ? 'Bodega: ' + a.equipaje_bodega_kg + 'kg · ' : ''}${a.equipaje_mano_kg ? 'Mano: ' + a.equipaje_mano_kg + 'kg' : ''}
      </div>
      ${a.contacto_whatsapp || a.contacto_oficina ? `<div style="margin-top:6px;font-size:12.5px">${esc(a.contacto_oficina || '')} ${esc(a.contacto_whatsapp || '')}</div>` : ''}
      ${a.por_verificar ? `<button class="btn-sm" style="margin-top:8px" data-verificar="${a.id}">Marcar verificada</button>` : ''}
    </div>`).join('') : '<div class="pc-vacio">Sin aerolíneas cargadas todavía.</div>';
  wrap.querySelectorAll('[data-verificar]').forEach(b => b.addEventListener('click', async () => {
    const a = bolCatalogo.aerolineas.find(x => x.id === Number(b.dataset.verificar));
    await sb.rpc('boleteria_guardar_aerolinea', { p_id: a.id, p_nombre: a.nombre, p_iata: a.iata_code, p_operativa: a.operativa,
      p_equipaje_bodega_kg: a.equipaje_bodega_kg, p_equipaje_mano_kg: a.equipaje_mano_kg, p_costo_maleta_extra: a.costo_maleta_extra,
      p_contacto_oficina: a.contacto_oficina, p_contacto_whatsapp: a.contacto_whatsapp, p_contacto_email: a.contacto_email,
      p_contacto_ejecutivo: a.contacto_ejecutivo, p_politica_cambio: a.politica_cambio, p_politica_cancelacion: a.politica_cancelacion,
      p_marcar_verificada: true });
    okToast('Marcada como verificada'); loadBoleteria();
  }));
}
function renderBolPrecios() {
  const wrap = document.getElementById('bol-precios-wrap'); if (!wrap) return;
  const precios = bolCatalogo.precios.filter(p => bolMatch(bolNombreRuta(p.ruta_id) + ' ' + bolNombreAerolinea(p.aerolinea_id)));
  wrap.innerHTML = `<div style="overflow-x:auto"><table><thead><tr><th>Ruta</th><th>Aerolínea</th><th>Tipo</th><th>Precio ref.</th><th>Vigencia</th></tr></thead><tbody>
    ${precios.length ? precios.map(p => `<tr><td>${esc(bolNombreRuta(p.ruta_id))}</td><td>${esc(bolNombreAerolinea(p.aerolinea_id))}</td><td>${p.tipo === 'ida_vuelta' ? 'Ida y vuelta' : 'Ida'}</td><td>${p.moneda} ${p.precio}</td><td>${esc(fmtFechaSolo(p.vigente_desde))}${p.vigente_hasta ? ' – ' + esc(fmtFechaSolo(p.vigente_hasta)) : ''}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">Sin precios cargados todavía -- los carga el equipo, ninguno viene sembrado.</td></tr>'}
  </tbody></table></div>`;
}
function renderBolRequisitos() {
  const wrap = document.getElementById('bol-requisitos-wrap'); if (!wrap) return;
  const req = bolCatalogo.requisitos.filter(r => bolMatch(r.pais));
  wrap.innerHTML = req.length ? req.map(r => `
    <div class="card"><h2>${esc(r.pais)}</h2>
      <div class="csub">${r.requiere_visa ? 'Requiere visa' : 'No requiere visa'}${r.acepta_cedula ? ' · Acepta cédula' : ''}</div>
      ${r.vigencia_min_pasaporte_meses ? `<div style="margin-top:6px;font-size:12.5px;color:var(--muted2)">Pasaporte con al menos ${r.vigencia_min_pasaporte_meses} meses de vigencia</div>` : ''}
      ${r.vacunas ? `<div style="margin-top:4px;font-size:12.5px;color:var(--muted2)">Vacunas: ${esc(r.vacunas)}</div>` : ''}
      ${r.notas ? `<div style="margin-top:4px;font-size:12.5px">${esc(r.notas)}</div>` : ''}
    </div>`).join('') : '<div class="pc-vacio">Sin requisitos cargados todavía.</div>';
}
function renderBolCalendario() {
  const wrap = document.getElementById('bol-calendario-wrap'); if (!wrap) return;
  const temporadas = bolCatalogo.temporadas.filter(t => bolMatch(t.nombre));
  const nivelColor = { alta: '#ff5c8a', media: '#f5b544', baja: '#10b981' };
  wrap.innerHTML = temporadas.length ? temporadas.map(t => `
    <div class="card"><h2>${esc(t.nombre)} <span class="chip" style="background:${nivelColor[t.nivel]}22;color:${nivelColor[t.nivel]}">${t.nivel}</span></h2>
      <div class="csub">${esc(fmtFechaSolo(t.fecha_inicio))} – ${esc(fmtFechaSolo(t.fecha_fin))} (${t.anio})</div></div>`).join('')
    : '<div class="pc-vacio">Sin temporadas cargadas todavía. Carnaval y Semana Santa se mueven cada año -- cargalas por año, no quedan fijas.</div>';
}

/* Altas rápidas: formularios cortos vía prompt(), consistente con el resto
   de altas puntuales de una sola línea en esta app (ver confirmarSheet para
   flujos con más campos si hace falta ampliarlo más adelante). */
async function nuevaRutaBoleteria() {
  const origen = prompt('Código IATA de origen (ej: CCS):'); if (!origen) return;
  const destino = prompt('Código IATA de destino (ej: MIA):'); if (!destino) return;
  const natural = prompt('Nombre natural (ej: Caracas – Miami):'); if (!natural) return;
  const corto = prompt('Nombre corto (ej: CCS–MIA):', `${origen.toUpperCase()}–${destino.toUpperCase()}`);
  const alias = prompt('Otras formas de nombrarla, separadas por coma (opcional):', '');
  const internacional = confirm('¿Es una ruta internacional?');
  const { data, error } = await sb.rpc('boleteria_guardar_ruta', { p_id: null, p_origen_iata: origen, p_destino_iata: destino, p_nombre_natural: natural, p_nombre_corto: corto, p_alias: alias ? alias.split(',').map(s => s.trim()).filter(Boolean) : [], p_es_internacional: internacional });
  if (error || !data?.ok) { errToast(error?.message || 'No se pudo crear la ruta (¿el aeropuerto existe?)'); return; }
  okToast('Ruta creada'); loadBoleteria();
}
async function nuevaAerolineaBoleteria() {
  const nombre = prompt('Nombre de la aerolínea:'); if (!nombre) return;
  const iata = prompt('Código IATA (opcional):', '');
  const { data, error } = await sb.rpc('boleteria_guardar_aerolinea', { p_id: null, p_nombre: nombre, p_iata: iata || null, p_operativa: true,
    p_equipaje_bodega_kg: null, p_equipaje_mano_kg: null, p_costo_maleta_extra: null, p_contacto_oficina: null, p_contacto_whatsapp: null,
    p_contacto_email: null, p_contacto_ejecutivo: null, p_politica_cambio: null, p_politica_cancelacion: null, p_marcar_verificada: false });
  if (error || !data?.ok) { errToast(error?.message || 'No se pudo crear la aerolínea'); return; }
  okToast('Aerolínea creada como "por verificar"'); loadBoleteria();
}
async function nuevoPrecioBoleteria() {
  if (!bolCatalogo.rutas.length || !bolCatalogo.aerolineas.length) { errToast('Primero cargá al menos una ruta y una aerolínea'); return; }
  const rutaTxt = bolCatalogo.rutas.map((r, i) => `${i + 1}) ${r.nombre_natural}`).join('\n');
  const iRuta = parseInt(prompt(`Elegí la ruta (número):\n${rutaTxt}`), 10) - 1;
  if (!(iRuta >= 0 && iRuta < bolCatalogo.rutas.length)) return;
  const aerTxt = bolCatalogo.aerolineas.map((a, i) => `${i + 1}) ${a.nombre}`).join('\n');
  const iAer = parseInt(prompt(`Elegí la aerolínea (número):\n${aerTxt}`), 10) - 1;
  if (!(iAer >= 0 && iAer < bolCatalogo.aerolineas.length)) return;
  const tipo = confirm('¿Es tarifa de ida y vuelta? (Cancelar = solo ida)') ? 'ida_vuelta' : 'ida';
  const precio = parseFloat(prompt('Precio de referencia en USD:')); if (!(precio > 0)) return;
  const { data, error } = await sb.rpc('boleteria_guardar_precio', { p_ruta_id: bolCatalogo.rutas[iRuta].id, p_aerolinea_id: bolCatalogo.aerolineas[iAer].id, p_temporada_id: null, p_tipo: tipo, p_precio: precio, p_moneda: 'USD', p_vigente_desde: null, p_vigente_hasta: null });
  if (error || !data?.ok) { errToast(error?.message || 'No se pudo cargar el precio'); return; }
  okToast('Precio cargado'); loadBoleteria();
}
async function nuevoRequisitoBoleteria() {
  const pais = prompt('País:'); if (!pais) return;
  const visa = confirm('¿Requiere visa?');
  const cedula = confirm('¿Acepta cédula (sin pasaporte)?');
  const meses = prompt('Vigencia mínima de pasaporte, en meses (opcional):', '');
  const notas = prompt('Notas (opcional):', '');
  const { data, error } = await sb.rpc('boleteria_guardar_requisito', { p_id: null, p_pais: pais, p_requiere_visa: visa, p_vigencia_min_pasaporte_meses: meses ? parseInt(meses, 10) : null, p_acepta_cedula: cedula, p_vacunas: null, p_notas: notas || null });
  if (error || !data?.ok) { errToast(error?.message || 'No se pudo guardar'); return; }
  okToast('Requisito guardado'); loadBoleteria();
}
async function nuevaTemporadaBoleteria() {
  const nombre = prompt('Nombre de la temporada (ej: Carnaval 2027):'); if (!nombre) return;
  const nivel = (prompt('Nivel (alta, media o baja):', 'alta') || '').trim().toLowerCase();
  if (!['alta', 'media', 'baja'].includes(nivel)) { errToast('Nivel inválido'); return; }
  const anio = parseInt(prompt('Año:', new Date().getFullYear()), 10);
  const inicio = prompt('Fecha de inicio (AAAA-MM-DD):'); if (!inicio) return;
  const fin = prompt('Fecha de fin (AAAA-MM-DD):'); if (!fin) return;
  const { data, error } = await sb.rpc('boleteria_guardar_temporada', { p_id: null, p_nombre: nombre, p_nivel: nivel, p_anio: anio, p_fecha_inicio: inicio, p_fecha_fin: fin });
  if (error || !data?.ok) { errToast(error?.message || 'No se pudo guardar la temporada'); return; }
  okToast('Temporada guardada'); loadBoleteria();
}

/* ---------- Sub-pestaña "En facturación" de Leads ----------
   Vista de seguimiento, no cola de trabajo: el asesor ve lo suyo y el admin ve
   todo. La Bandeja de Facturación sigue siendo la cola del admin que factura
   (filtrada a lo que le mandaron a él), acá se ve el estado. */
const LF_TIPO = {
  hospedaje: { i: 'fa-bed', t: 'Hospedaje' },
  boleteria: { i: 'fa-plane', t: 'Boletería' },
  paquete:   { i: 'fa-suitcase-rolling', t: 'Paquete' },
  otro:      { i: 'fa-ellipsis', t: 'Otro' },
};
// Un reenvío que cambia de tipo no borra lo del envío anterior (el upsert
// conserva lo que ya estaba), así que se filtra por tipo_venta al mostrar: si
// no, una venta de hospedaje aparece con la ruta de vuelo de un envío viejo.
function lfDetalleVenta(x) {
  const partes = [];
  if (x.hotel_posada && (x.tipo_venta === 'hospedaje' || x.tipo_venta === 'paquete')) partes.push(x.hotel_posada);
  if ((x.vuelo_origen || x.vuelo_destino) && (x.tipo_venta === 'boleteria' || x.tipo_venta === 'paquete')) {
    partes.push(`${x.vuelo_origen || '?'} → ${x.vuelo_destino || '?'}`);
  }
  return partes.join(' · ');
}
function lfQueSeVendio(x) {
  const meta = LF_TIPO[x.tipo_venta] || { i: 'fa-tag', t: 'Sin especificar' };
  const detalle = lfDetalleVenta(x);
  return `<div class="lf-que"><i class="fas ${meta.i}"></i> <span>${esc(meta.t)}${detalle ? ' — ' + esc(detalle) : ''}</span></div>`;
}
function lfFila(k, v) { return v ? `<div class="lf-k">${esc(k)}</div><div class="lf-v">${v}</div>` : ''; }
function lfCardHtml(x) {
  const lista = x.facturada || x.estado === 'procesado';
  const pagado = x.monto_pagado != null ? Number(x.monto_pagado) : null;
  const total = x.monto_total != null ? Number(x.monto_total) : null;
  const saldo = (pagado != null && total != null && total > pagado) ? total - pagado : null;
  const fechas = [x.fecha_viaje && fmtDiaCorto(x.fecha_viaje), x.fecha_regreso && fmtDiaCorto(x.fecha_regreso)]
    .filter(Boolean).join(' → ');
  // Los envíos viejos (anteriores a esta pantalla) no tienen nada cargado: se
  // dice explícito en vez de mostrar una tarjeta vacía que parezca un bug.
  const sinDatos = !x.tipo_venta && !x.cedula && pagado == null;
  return `<div class="lf-card${lista ? ' lf-lista' : ''}">
    <div class="lf-top">
      <div class="lf-nombre">${esc(x.nombre || 'Sin nombre')}</div>
      <span class="lf-chip ${lista ? 'list' : 'pend'}">${lista ? 'Facturado' : 'Pendiente'}</span>
    </div>
    ${sinDatos ? '' : lfQueSeVendio(x)}
    <div class="lf-datos">
      ${lfFila('Teléfono', esc(x.telefono || ''))}
      ${lfFila('Cédula', esc(x.cedula || ''))}
      ${lfFila(x.tipo_venta === 'hospedaje' ? 'Entrada/salida' : 'Viaje', esc(fechas))}
      ${lfFila('Personas', x.personas != null ? String(x.personas) : '')}
      ${lfFila('Pagó', pagado != null ? money(pagado) + (total != null ? ` de ${money(total)}` : '') : '')}
      ${lfFila('Método', esc([x.metodo_pago, x.referencia_pago].filter(Boolean).join(' · ')))}
      ${lfFila('Notas', esc(x.notas_venta || ''))}
    </div>
    ${saldo != null ? `<div class="lf-falta lf-saldo">Saldo pendiente: ${money(saldo)}</div>` : ''}
    ${sinDatos ? '<div class="lf-falta">Se envió sin los datos de la venta — mandalo de nuevo desde el lead para completarlos.</div>' : ''}
    <div class="lf-pie">
      <span>Por ${esc(x.enviado_por || '—')}${(x.admin_destino && x.admin_destino !== x.enviado_por) ? ' → ' + esc(x.admin_destino) : ''}</span>
      <span>${tiempoRelativo(x.creado_en)}</span>
    </div>
  </div>`;
}
async function loadLeadsEnFacturacion() {
  if (ROL !== 'admin' && ROL !== 'asesor') return;
  const loading = document.getElementById('lf-loading'), empty = document.getElementById('lf-empty');
  const grid = document.getElementById('lf-grid');
  if (!grid) return;
  loading?.classList.add('show');
  const { data, error } = await sb.rpc('listar_leads_en_facturacion');
  loading?.classList.remove('show');
  if (error) { console.error('leads_en_facturacion', error); errToast('No se pudo cargar En facturación'); return; }
  const filas = data || [];
  // El contador de la pestaña muestra pendientes, no el total: los facturados
  // siguen visibles pero ya no son trabajo por hacer.
  const pendientes = filas.filter(x => !(x.facturada || x.estado === 'procesado')).length;
  const badge = document.getElementById('leads-fact-count');
  if (badge) { badge.textContent = pendientes; badge.style.display = pendientes ? '' : 'none'; }
  empty?.classList.toggle('show', filas.length === 0);
  grid.innerHTML = filas.map(lfCardHtml).join('');
}

/* ---------- Tarifario: buscador con IA ----------
   Reemplaza la sección "Buscar Tarifario". El #tar-search de la barra sigue
   siendo un filtro de texto sobre lo que ya está en pantalla; esto manda la
   frase del asesor a la Edge Function buscar-tarifario-ia, que la traduce a
   términos reales y corre el RPC buscar_tarifario contra toda la base.

   La IA solo produce PALABRAS DE BÚSQUEDA: los resultados salen tal cual de la
   base, así que no hay forma de que invente un precio. */
let tarIABusy = false;
/* Un solo campo para las dos búsquedas (2026-08-19). #tar-search filtra al
   instante lo que ya está en pantalla (ese listener vive en setupTarifarioTabs);
   acá se engancha la otra acción sobre EL MISMO campo: Enter o el botón de
   varita mandan la frase a la IA, que consulta la base entera. Nunca automático
   -- cada consulta es una llamada a la Edge Function y la pide el asesor. */
let tarIAResultados = [], tarIAMeta = null, tarIAView = 'tarjetas';
function setupBuscadorIATarifario() {
  const input = document.getElementById('tar-search');
  const btn = document.getElementById('tar-ia-btn');
  if (!input || !btn) return;
  btn.addEventListener('click', () => buscarTarifarioIA(input.value.trim()));
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    buscarTarifarioIA(input.value.trim());
  });
  document.getElementById('tar-ia-cerrar')?.addEventListener('click', cerrarResultadosIA);
  tarIAView = initViewSwitcher('tar-ia-view-switch', 'tarifario_ia', 'tarjetas',
    v => { tarIAView = v; pintarResultadosIA(); }, ['tarjetas', 'lista']);
}

function cerrarResultadosIA() {
  tarIAResultados = []; tarIAMeta = null;
  const box = document.getElementById('tar-ia-box');
  if (box) box.hidden = true;
  const res = document.getElementById('tar-ia-resultados');
  if (res) res.innerHTML = '';
}

/* Los resultados de la IA traen solo {tipo,id,titulo,destino,extracto}: sin
   fotos, precio ni tags, que es justamente lo que hace a una tarjeta. Se
   completan primero contra lo que ya está en memoria (tarCache, de cualquier
   pestaña ya visitada) y lo que falte con UNA consulta por tabla, con el mismo
   select que loadTarifario para que fotos y tarifas vengan igual.
   Mismo criterio que ya usaba abrirDesdeBusquedaIA() para abrir uno suelto. */
async function hidratarResultadosIA(res) {
  const enMemoria = new Map();
  for (const [tab, filas] of Object.entries(tarCache)) {
    const clave = (tab === 'promo' || tab === 'hotsale') ? 'promocion' : 'producto';
    for (const x of filas || []) enMemoria.set(clave + ':' + x.id, x);
  }
  const faltan = { promocion: [], producto: [] };
  res.forEach(r => {
    if (!enMemoria.has(r.tipo + ':' + r.id)) faltan[r.tipo === 'promocion' ? 'promocion' : 'producto'].push(r.id);
  });
  const selProductos = '*, tarifas(*), promociones(titulo,precio_texto,precio_desde_usd,vigencia_texto,fecha_fin_estimada,incluye_tags,ninos_gratis_cantidad,resumen_ia), producto_fotos(storage_path,orden,es_principal,activo)';
  const selPromos = '*, promocion_fotos(storage_path,orden,es_principal,activo), productos(nombre,destino,producto_fotos(storage_path,orden,es_principal,activo))';
  const pedidos = [];
  if (faltan.promocion.length) pedidos.push(sb.from('promociones').select(selPromos).in('id', faltan.promocion).then(r => ['promocion', r]));
  if (faltan.producto.length) pedidos.push(sb.from('productos').select(selProductos).in('id', faltan.producto).then(r => ['producto', r]));
  for (const [clave, { data, error }] of await Promise.all(pedidos)) {
    if (error) { console.error('hidratarResultadosIA:', error); continue; }
    (data || []).forEach(x => enMemoria.set(clave + ':' + x.id, x));
  }
  // El ítem completo se cuelga del resultado; si no se pudo traer queda null y
  // esa fila cae a la vista de lista, que solo necesita título y extracto.
  return res.map(r => ({ ...r, item: enMemoria.get(r.tipo + ':' + r.id) || null }));
}

/* tarCardHtml/destinoDe/fotosDe leen el global tarTab para saber si el ítem es
   promoción o producto. Los resultados de la IA pueden ser de varias pestañas a
   la vez, así que cada uno se pinta con su tab puesto y se restaura al terminar.
   Es seguro porque armar el HTML es 100% síncrono: nada más puede leer tarTab
   en el medio. */
function conTabTarifario(tab, fn) {
  const previo = tarTab;
  tarTab = tab;
  try { return fn(); } finally { tarTab = previo; }
}
function tabDeResultadoIA(r) {
  if (r.tipo === 'promocion') return 'promo';
  return r.item?.tipo || 'hotel';
}

function pintarResultadosIA() {
  const box = document.getElementById('tar-ia-resultados');
  if (!box) return;
  const res = tarIAResultados;
  if (!res.length) { box.innerHTML = ''; return; }
  if (tarIAView === 'lista') {
    box.innerHTML = res.map(r => {
      const ico = r.tipo === 'promocion' ? 'fa-tag' : 'fa-hotel';
      const meta = [r.destino, r.extracto].filter(Boolean).join(' · ');
      return `<div class="tia-row" data-tipo="${esc(r.tipo)}" data-id="${r.id}">`
        + `<i class="fas ${ico}"></i>`
        + `<div><div class="tia-n">${esc(r.titulo || 'Sin nombre')}</div>`
        + `<div class="tia-m">${esc(meta)}</div></div></div>`;
    }).join('');
  } else {
    // Las mismas tarjetas que la grilla: una tarjeta de la IA y una de la
    // pestaña se ven idénticas, que es el punto de mostrarlas así.
    const html = res.map(r => r.item
      ? conTabTarifario(tabDeResultadoIA(r), () => tarCardHtml(r.item))
      : `<div class="tia-row" data-tipo="${esc(r.tipo)}" data-id="${r.id}">`
        + `<i class="fas ${r.tipo === 'promocion' ? 'fa-tag' : 'fa-hotel'}"></i>`
        + `<div><div class="tia-n">${esc(r.titulo || 'Sin nombre')}</div>`
        + `<div class="tia-m">${esc([r.destino, r.extracto].filter(Boolean).join(' · '))}</div></div></div>`
    ).join('');
    box.innerHTML = `<div class="tar-grid-sub">${html}</div>`;
  }
  const abrir = el => abrirDesdeBusquedaIA(el.dataset.tipo, Number(el.dataset.id));
  box.querySelectorAll('.tia-row').forEach(row => { row.onclick = () => abrir(row); });
  // Las .tar-card no llevan data-tipo: se resuelve por el id contra el propio
  // resultado, que ya sabe de qué tabla salió.
  box.querySelectorAll('.tar-card').forEach(card => {
    const id = Number(card.dataset.id);
    const r = res.find(x => Number(x.id) === id && x.item);
    if (r) card.onclick = () => abrirDesdeBusquedaIA(r.tipo, id);
  });
}

async function buscarTarifarioIA(consulta) {
  const estado = document.getElementById('tar-ia-estado');
  const caja = document.getElementById('tar-ia-box');
  const btn = document.getElementById('tar-ia-btn');
  if (!estado || !caja) return;
  if (consulta.length < 2) { caja.hidden = false; estado.textContent = 'Escribí qué estás buscando.'; tarIAResultados = []; pintarResultadosIA(); return; }
  if (tarIABusy) return;
  tarIABusy = true;
  btn?.classList.add('cargando');
  caja.hidden = false;
  estado.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Buscando...';
  tarIAResultados = [];
  pintarResultadosIA();
  const { data, error } = await sb.functions.invoke('buscar-tarifario-ia', { body: { consulta } });
  tarIABusy = false;
  btn?.classList.remove('cargando');
  if (error || !data?.ok) {
    console.error('buscar-tarifario-ia:', error || data);
    estado.textContent = 'No se pudo buscar en este momento. Probá de nuevo.';
    return;
  }
  const res = data.resultados || [];
  if (!res.length) {
    estado.textContent = data.interpretacion
      ? 'Entendí: ' + data.interpretacion + ' — pero no hay nada cargado que coincida.'
      : 'Sin resultados. Probá con otras palabras.';
    return;
  }
  estado.innerHTML = (data.interpretacion ? '<b>Entendí:</b> ' + esc(data.interpretacion) + ' · ' : '')
    + res.length + (res.length === 1 ? ' resultado' : ' resultados')
    + (data.ia_disponible ? '' : ' (búsqueda literal: la IA no respondió)');
  tarIAResultados = await hidratarResultadosIA(res);
  tarIAMeta = data;
  // Las promos de la IA no pasaron por renderTarifario(), que es donde se
  // reparten las portadas: sin esto varias promos del mismo hotel muestran
  // todas la misma foto.
  asignarPortadas(tarIAResultados.map(r => r.item).filter(Boolean));
  pintarResultadosIA();
}

// El buscador devuelve ids de productos/promociones. Si el item ya está en la
// pestaña abierta se usa esa fila (viene con fotos y tarifas embebidas); si no,
// se trae de la base para poder abrir la ficha igual.
async function abrirDesdeBusquedaIA(tipo, id) {
  const enCache = (tarCache[tarTab] || []).find(x => Number(x.id) === id);
  if (enCache) { openProductoDrawer(enCache); return; }
  const tabla = tipo === 'promocion' ? 'promociones' : 'productos';
  const { data, error } = await sb.from(tabla).select('*').eq('id', id).maybeSingle();
  if (error || !data) { errToast('No se pudo abrir ese ítem'); return; }
  openProductoDrawer(data);
}

/* ---------- Hoja inferior genérica (más opciones del nav, filtros en móvil) — un solo backdrop compartido, una hoja abierta a la vez ---------- */
let sheetAbierta = null;
function openSheet(id) {
  if (sheetAbierta && sheetAbierta !== id) closeSheet(sheetAbierta, true);
  document.getElementById(id)?.classList.add('open');
  document.getElementById('sheet-bg')?.classList.add('open');
  sheetAbierta = id;
  navPush({ type: 'sheet', id });
}
function closeSheet(id, fromNav) {
  // Cerrar el menú de capítulos por cualquier vía (X, tocar afuera, elegir
  // un capítulo) cuenta como "ya vio el tutorial" -- no solo completarlo.
  document.getElementById(id)?.classList.remove('open');
  document.getElementById('sheet-bg')?.classList.remove('open');
  if (sheetAbierta === id) sheetAbierta = null;
  // Si confirmar-sheet se cierra por cualquier via que NO sea sus propios
  // botones (fondo, atras de Android, otra hoja que la reemplaza), la
  // promesa de confirmarSheet() tiene que resolver igual -- si no, el
  // await del que llamó queda colgado para siempre. resolverConfirmarSheet
  // ya vacia confirmarSheetResolve ANTES de llegar acá, asi que esto nunca
  // dispara dos veces para un mismo confirm.
  if (id === 'confirmar-sheet' && confirmarSheetResolve) { const r = confirmarSheetResolve; confirmarSheetResolve = null; r(false); }
  if (!fromNav) navConsume();
}
document.getElementById('sheet-bg')?.addEventListener('click', () => { if (sheetAbierta) closeSheet(sheetAbierta); });

// Hoja de confirmación genérica (Fase 4.4) -- reemplaza confirm() nativo.
// Uso: if (!(await confirmarSheet({ titulo, detalle, textoOk, destructivo })))
// return; -- misma forma que el confirm() que reemplaza, pero con Promise.
let confirmarSheetResolve = null;
function confirmarSheet({ titulo = '¿Confirmar?', detalle = '', textoOk = 'Confirmar', textoCancelar = 'Cancelar', destructivo = false } = {}) {
  return new Promise(resolve => {
    confirmarSheetResolve = resolve;
    document.getElementById('confirmar-sheet-titulo').textContent = titulo;
    const det = document.getElementById('confirmar-sheet-detalle');
    det.innerHTML = detalle ? esc(detalle).replace(/\n/g, '<br>') : '';
    det.style.display = detalle ? '' : 'none';
    const btnOk = document.getElementById('confirmar-sheet-ok');
    btnOk.textContent = textoOk;
    btnOk.classList.toggle('destructivo', !!destructivo);
    document.getElementById('confirmar-sheet-cancelar').textContent = textoCancelar;
    openSheet('confirmar-sheet');
  });
}
function resolverConfirmarSheet(valor) {
  const r = confirmarSheetResolve;
  confirmarSheetResolve = null;
  closeSheet('confirmar-sheet');
  if (r) r(valor);
}
document.getElementById('confirmar-sheet-ok')?.addEventListener('click', () => resolverConfirmarSheet(true));
document.getElementById('confirmar-sheet-cancelar')?.addEventListener('click', () => resolverConfirmarSheet(false));

/* ---------- Tutorial guiado ---------- *
 * Motor de tour dirigido por datos: TOUR_CAPITULOS define contenido, el
 * resto son funciones genéricas de recorrido (spotlight sobre la UI real +
 * burbuja de texto). Un capítulo = una sección del nav. Los pasos con
 * soloAdmin solo los ve ROL==='admin' (ahí el admin ve un mockup de cómo le
 * queda esa misma pantalla a un asesor -- HTML/CSS real del proyecto, no
 * capturas, para que nunca quede desincronizado).
 */
function mockupBandejaAsesor() {
  return `<div class="entity-card inbox-card" style="pointer-events:none;margin:0">
    <div class="ec-top"><div class="ec-ava" style="background:#ff910022;color:#ff9100"><i class="fas fa-user"></i></div><div class="ec-nombre">Andrea Triana</div></div>
    <div class="ec-row"><i class="fas fa-phone"></i> +58 412 555 1234</div>
    <div class="ec-row"><i class="fas fa-location-dot"></i> Cancún</div>
    <div class="ec-row"><i class="fas fa-clock"></i> hace 2 min</div>
    <div class="inbox-actions">
      <button type="button" class="inbox-btn atender"><i class="fas fa-check"></i> Atender</button>
      <button type="button" class="inbox-btn nopuedo"><i class="fas fa-xmark"></i> No puedo</button>
      <button type="button" class="inbox-btn avisar"><i class="fas fa-flag"></i></button>
    </div>
  </div>`;
}
function mockupAsistenciaAsesor() {
  return `<div class="jornada-widget" style="margin:0">
    <span class="jornada-dot on"></span>
    <span class="jornada-text">Jornada activa · 08:52</span>
    <button class="jornada-btn on" disabled>Finalizar</button>
  </div>`;
}

const TOUR_CAPITULOS = [
  { id: 'dashboard', titulo: 'Dashboard', icono: 'fa-chart-pie', roles: ['admin'], seccion: 'dashboard', pasos: [
    { titulo: 'Panorama general', texto: 'Acá ves de un vistazo cuántos leads llegaron, cómo vienen (Instagram, TikTok, web) y cómo va cada asesor.', selector: '#kpis' },
    { titulo: 'Toca para profundizar', texto: 'Cualquier gráfico o número se puede tocar para ver el detalle de esos leads.', selector: '#sec-dashboard' },
  ]},
  { id: 'leads', titulo: 'Leads', icono: 'fa-users', roles: ['admin', 'asesor'], seccion: 'leads', pasos: [
    { titulo: 'Tus clientes', texto: () => ROL === 'asesor' ? 'Acá aparecen los clientes que te asignaron. Los nuevos suben arriba de todo.' : 'Acá el admin ve y filtra todos los leads del negocio, de todos los asesores.', selector: '#sec-leads' },
    { titulo: 'Leads nuevos por atender', texto: 'Cada tarjeta nueva tiene 3 botones: ✅ Atender (lo tomas), ❌ No puedo (se lo pasas a otro asesor), 🚩 (avisas que el número está mal).', selector: '#inbox-grid' },
    { soloAdmin: true, titulo: '🔎 Así lo ve un asesor', texto: 'Cada asesor solo ve sus propios leads nuevos, con estos mismos 3 botones. Si no toca ninguno a tiempo, el lead se reasigna automático a otro asesor.', mockup: mockupBandejaAsesor },
  ]},
  { id: 'mensajes', titulo: 'Mensajes', icono: 'fa-comment-dots', roles: ['admin', 'asesor', 'marketing'], seccion: 'mensajes', pasos: [
    { titulo: 'Chat interno del equipo', texto: 'Esto no es WhatsApp del cliente -- es un chat interno para hablar con tus compañeros y con administración.', selector: '#sec-mensajes' },
  ]},
  { id: 'metricas', titulo: 'Métricas', icono: 'fa-chart-simple', roles: ['admin'], seccion: 'gestion-personal', pasos: [
    { titulo: 'Números del negocio', texto: 'Conversión, tiempos de respuesta y ventas, con filtro de fecha. Está dentro de Gestión de Personal, como una pestaña más.', selector: '#gp-tabs' },
  ]},
  { id: 'ranking', titulo: 'Ranking', icono: 'fa-ranking-star', roles: ['admin'], seccion: 'ranking', pasos: [
    { titulo: 'Ranking de asesores', texto: 'Compara el desempeño de cada asesor: cuántos leads atendió, cuántos cerró, tiempo de respuesta.', selector: '#sec-ranking' },
  ]},
  { id: 'pipeline', titulo: 'Pipeline', icono: 'fa-diagram-project', roles: ['admin', 'asesor'], seccion: 'pipeline', pasos: [
    { titulo: 'El camino de un cliente', texto: 'Acá ves en qué etapa está cada cliente: Atendido → Cotización enviada → Esperando pago → Pago realizado.', selector: '#sec-pipeline' },
  ]},
  { id: 'tarifario', titulo: 'Tarifario', icono: 'fa-book-open', roles: ['admin', 'asesor', 'marketing'], seccion: 'tarifario', pasos: [
    { titulo: 'Catálogo de hoteles y paquetes', texto: 'Todos los precios y opciones que le puedes ofrecer a un cliente, con fotos.', selector: '#sec-tarifario' },
    { titulo: 'Buscador con IA', texto: 'El mismo campo hace dos cosas: mientras escribís filtra lo que ya tenés en pantalla, y si tocás la varita (o Enter) le pasa esa frase a la IA para que busque en todo el tarifario — "playa para una pareja en diciembre". Los precios que ves salen siempre de la ficha real, la IA nunca los inventa.', selector: '#tar-search' },
  ]},
  { id: 'cotizador', titulo: 'Cotizador IA', icono: 'fa-comments', roles: ['admin', 'asesor', 'marketing'], seccion: 'cotizador', pasos: [
    { titulo: 'Arma una cotización hablando', texto: 'Cuéntale a la IA qué busca el cliente (destino, presupuesto, fechas) y te arma opciones del Tarifario al toque.', selector: '#chat-input' },
  ]},
  { id: 'galeria', titulo: 'Galería', icono: 'fa-images', roles: ['admin', 'asesor', 'marketing'], seccion: 'galeria', pasos: [
    { titulo: 'Fotos para mandar al cliente', texto: 'Fotos reales de hoteles y paquetes, listas para compartir por WhatsApp.', selector: '#sec-galeria' },
  ]},
  { id: 'redes', titulo: 'Redes', icono: 'fa-share-nodes', roles: ['admin', 'marketing'], seccion: 'redes', pasos: [
    { titulo: 'Instagram y Meta', texto: 'Métricas de las redes sociales del negocio -- alcance, seguidores, publicaciones que mejor funcionan.', selector: '#sec-redes' },
  ]},
  { id: 'reasignaciones', titulo: 'Reasignaciones', icono: 'fa-shuffle', roles: ['admin'], seccion: 'gestion-personal', pasos: [
    { titulo: 'Historial de reasignaciones', texto: 'Cada vez que un lead pasa de un asesor a otro por no responder a tiempo, queda acá con el motivo. Es una pestaña de Gestión de Personal.', selector: '#gp-tabs' },
  ]},
  { id: 'gestion-personal', titulo: 'Gestión de Personal', icono: 'fa-people-group', roles: ['admin'], seccion: 'gestion-personal', pasos: [
    { titulo: 'Todo el equipo en un lugar', texto: 'Personal (tarjeta de cada quien con su cargo y sus horarios de conexión), Asistencia, Asesores, Freelancers, Postulaciones, Reasignaciones y Métricas -- todo como pestañas de una sola sección.', selector: '#sec-gestion-personal' },
    { soloAdmin: true, titulo: '🔎 Así lo ve un asesor', texto: 'Cada asesor marca su propia jornada con este botón, siempre visible arriba del menú -- no ve esta sección, es solo de Admin.', mockup: mockupAsistenciaAsesor },
  ]},
  { id: 'informe-diario', titulo: 'Informe Diario', icono: 'fa-file-lines', roles: ['admin'], seccion: 'informe-diario',
    visibleIf: () => getComputedStyle(document.getElementById('nav-informe-diario')).display !== 'none', pasos: [
    { titulo: 'Resumen del día', texto: 'Un resumen automático del día, para no tener que revisar todo a mano.', selector: '#sec-informe-diario' },
  ]},
  { id: 'asistencia-personal', titulo: 'Marcar asistencia', icono: 'fa-user-clock', roles: ['asesor'], seccion: null, pasos: [
    { titulo: 'Marca tu entrada y salida', texto: 'Toca "Comenzar" al empezar tu jornada y "Finalizar" al terminarla. Administración lo ve reflejado al instante.', selector: '#jornada-widget-d, #jornada-widget-m' },
  ]},
];

/* ---------- Manual del CRM (sección estática con capturas, complementa el tour) ----------
   Reusa el contenido de TOUR_CAPITULOS (para no mantener el mismo texto dos veces) y lo
   completa con MANUAL_EXTRA para las secciones que el tour todavía no cubre. Pedido del
   dueño (2026-07-26): manual completo con capturas, accesible por sección o de corrido,
   más visible que el tour de bienvenida (botón propio en el topbar). */
const MANUAL_EXTRA = [
  { id: 'hoy', titulo: 'Hoy', icono: 'fa-sun', roles: ['admin', 'asesor', 'marketing', 'boleteria'], pasos: [
    { titulo: 'Tu resumen del día', texto: 'La pantalla con la que arrancás: leads nuevos, pendientes por atender y tu jornada, todo en un vistazo.' },
  ]},
  { id: 'postventa', titulo: 'Postventa', icono: 'fa-handshake-angle', roles: ['admin', 'asesor'], pasos: [
    { titulo: 'Después de la venta', texto: 'Cobros pendientes, reservas confirmadas, documentos del cliente y seguimiento del viaje una vez que ya pagó -- para no perder el hilo después del cierre.' },
  ]},
  { id: 'facturacion', titulo: 'Facturación', icono: 'fa-file-invoice-dollar', roles: ['admin'], pasos: [
    { titulo: 'Facturas y comisiones', texto: 'Creá o buscá el cliente, registrá la venta con su costo neto y proveedor, y el sistema calcula la comisión de cada asesor automáticamente.' },
    { titulo: 'Cuentas por pagar', texto: 'Lo que se le debe a cada proveedor queda registrado acá, separado de la comisión del asesor.' },
  ]},
  { id: 'mis-comisiones', titulo: 'Mis Comisiones', icono: 'fa-sack-dollar', roles: ['asesor'], pasos: [
    { titulo: 'Lo que ganaste', texto: 'Tus comisiones sobre las ventas ya pagadas, con filtro por mes.' },
  ]},
  { id: 'gestion-personal', titulo: 'Gestión de Personal', icono: 'fa-people-group', roles: ['admin'], pasos: [
    { titulo: 'Personal', texto: 'Una tarjeta por persona, con su icono según el cargo, el tiempo que tuvo el CRM abierto en el período y el detalle día por día: a qué hora entró y a qué hora salió.' },
    { titulo: 'Asistencia', texto: 'Quién marcó entrada/salida cada día, strikes del mes e historial completo.' },
    { titulo: 'Asesores', texto: 'Alta/baja de tu equipo y el peso de cada uno en el sorteo automático de leads nuevos.' },
    { titulo: 'Freelancers', texto: 'Jornadas, tareas asignadas y cumplimiento de cada asesor freelance, aparte del equipo presencial.' },
    { titulo: 'Postulaciones', texto: 'Candidatos que aplicaron desde "Trabaja con nosotros" en la web (o le contaron a la IA por Instagram/Facebook) -- presencial y freelance, con su CV. Marcá si ya revisaste el perfil, si es buen prospecto, y si ya lo llamaste.' },
  ]},
  { id: 'tareas', titulo: 'Tareas', icono: 'fa-list-check', roles: ['admin', 'asesor'], pasos: [
    { titulo: 'Lo que tenés pendiente', texto: 'Tareas que te asignó administración, con su estado -- para no perder de vista pendientes que no son un lead.' },
  ]},
  { id: 'voucher', titulo: 'Voucher', icono: 'fa-file-invoice', roles: ['admin', 'asesor'], pasos: [
    { titulo: 'Genera el voucher', texto: 'Arma el voucher de hospedaje en PDF para el cliente, con los datos de la reserva ya cargados.' },
  ]},
  { id: 'leads-colaboraciones', titulo: 'Colaboraciones (dentro de Leads)', icono: 'fa-handshake', roles: ['admin'], pasos: [
    { titulo: 'Campañas pagas con colaboradores', texto: 'Es una pestaña dentro de Leads. Estos leads van directo al WhatsApp del colaborador (no a un asesor) -- acá queda el registro de esa campaña.' },
  ]},
  { id: 'perfil', titulo: 'Mi Perfil', icono: 'fa-user-gear', roles: ['admin', 'asesor', 'marketing', 'boleteria'], pasos: [
    { titulo: 'Personalizá tu CRM', texto: 'Foto de perfil, tema claro/oscuro, tamaño de letra y recordatorios de asistencia -- todo desde tu avatar arriba a la derecha.' },
  ]},
];
const MANUAL_IMG = {
  leads: 'leads.png', mensajes: 'mensajes.png', tarifario: 'tarifario.png', facturacion: 'facturacion.png',
  postulaciones: 'postulaciones.png', redes: 'redes.png', asistencia: 'asistencia.png', reasignaciones: 'reasignaciones.png',
};
function temasManualVisibles() {
  // tour:true marca los temas que además se pueden REPRODUCIR sobre la pantalla
  // real (botón "Ver en pantalla"): son los que vienen de TOUR_CAPITULOS.
  const deTour = capitulosVisiblesTour().map(c => ({ id: c.id, titulo: c.titulo, icono: c.icono, pasos: pasosVisiblesCapitulo(c), tour: true }));
  const extra = MANUAL_EXTRA.filter(t => t.roles.includes(ROL));
  const vistos = new Set(deTour.map(t => t.id));
  return [...deTour, ...extra.filter(t => !vistos.has(t.id))];
}
function renderManual() {
  const temas = temasManualVisibles();
  document.getElementById('manual-list').innerHTML = temas.map(t => `
    <details class="manual-tema" id="manual-${t.id}">
      <summary><i class="fas ${t.icono}"></i> <span>${esc(t.titulo)}</span><i class="fas fa-chevron-down manual-chev"></i></summary>
      <div class="manual-body">${t.tour ? `<button class="btn-sm manual-ver-btn" type="button" data-tour="${t.id}"><i class="fas fa-play"></i> Ver en pantalla</button>` : ''}${MANUAL_IMG[t.id] ? `<img class="manual-shot" src="img/manual/${MANUAL_IMG[t.id]}" alt="Captura de ${esc(t.titulo)}" loading="lazy">` : ''}${t.pasos.map(p => `
        <div class="manual-paso">
          <div class="mp-t">${esc(p.titulo)}</div>
          <div class="mp-x">${esc(typeof p.texto === 'function' ? p.texto() : p.texto)}</div>
        </div>`).join('')}
      </div>
    </details>`).join('');
  document.getElementById('manual-count').textContent = `${temas.length} secciones`;
  // El recorrido guiado dejó de tener menú propio: se arranca desde acá.
  document.querySelectorAll('#manual-list .manual-ver-btn').forEach(btn => {
    btn.onclick = e => { e.preventDefault(); iniciarCapituloTour(btn.dataset.tour); };
  });
  marcarTutorialVisto();
}
function setupManual() {
  document.getElementById('manual-expand-all')?.addEventListener('click', () => document.querySelectorAll('#manual-list details').forEach(d => d.open = true));
  document.getElementById('manual-collapse-all')?.addEventListener('click', () => document.querySelectorAll('#manual-list details').forEach(d => d.open = false));
}

/* ---------- Actualizaciones (changelog del CRM, pedido del dueño 2026-07-26) ----------
   Curado a mano a partir del historial real de commits de lotus-crm-preview y
   redireccion-whatsapp/crm -- traducido a lenguaje de usuario final, no mensajes de commit
   crudos. Orden: más reciente primero. Agregar acá arriba cada vez que se publique algo
   nuevo relevante para el equipo (no hace falta registrar cada fix chico). */
const ROLES_TODOS = ['admin', 'asesor', 'marketing', 'boleteria'];
const ACTUALIZACIONES_LOG = [
  { fecha: '2026-08-20', emoji: '📲', titulo: 'Contacto directo: leads sin teléfono, a propósito', texto: 'Cuando un cliente le pide a la IA el WhatsApp del equipo en vez de dar el suyo, ahora se le entrega el número de un asesor asignado por la rueda de reparto de siempre, y el lead queda registrado en el CRM sin teléfono. Vas a verlo marcado con la etiqueta "Contacto directo" en la lista y en la ficha -- no es un dato faltante por error, es que el cliente todavía no dejó su número. Si la IA logra que lo deje más adelante, el lead se completa solo y te llega el aviso a Telegram.', roles: ROLES_TODOS },
  { fecha: '2026-08-19', emoji: '👥', titulo: 'Clientes Asignados para todo asesor', texto: 'Cualquier asesor comercial puede recibir ahora un lote de clientes asignados (antes era exclusivo del rol de práctica): editá sus datos, marcá si ya lo atendiste, dejá nota de qué te dijo y por qué no le interesó. En Gestión de Personal, "Estados a incluir" y "Destino" del panel de asignación ahora son etiquetas para tocar en vez de listas, y el plazo se elige como "24h/48h/72h/Sin límite" en vez de fecha exacta.', roles: ROLES_TODOS },
  { fecha: '2026-08-19', emoji: '💡', titulo: 'Mis Notas', texto: 'Sección nueva para guardar lo que se te complica recordar (objeciones, tarifas, condiciones de un destino). Lo que marqués como "me cuesta" vuelve a aparecer para repasar en intervalos cada vez más largos si vas acertando.', roles: ['asesor'] },
  { fecha: '2026-08-19', emoji: '📝', titulo: 'Informe diario con 4 preguntas', texto: 'Al finalizar la jornada ahora se responde "¿Cómo te fue?", "¿Qué aprendiste?", "¿Qué se te complicó?" y "Bloqueos" en vez de un solo texto libre. Lo que aprendiste se puede guardar directo en Mis Notas.', roles: ROLES_TODOS },
  { fecha: '2026-08-18', emoji: '📖', titulo: 'Guía del tarifario automático', texto: 'En Tarifario → Actualizador hay una pestaña nueva "¿Cómo funciona?": explica en simple cómo se actualiza solo el tarifario, qué IA hace cada cosa y cuánto cuesta cada actualización.', roles: ['admin'] },
  { fecha: '2026-08-16', emoji: '🎯', titulo: 'Control total en lotes de práctica', texto: 'En Gestión de Personal → Asesores de prueba ya se puede filtrar por rango de fecha y por destino, y ver la lista real de leads antes de asignar el lote, tildando y destildando a mano cuáles entran. Además, crear una cuenta nueva ahora pide contraseña de 8 caracteres (antes 12) y la pregunta/respuesta de seguridad ya no tienen mínimo de letras.', roles: ['admin'] },
  { fecha: '2026-08-15', emoji: '✈️', titulo: 'Modo Boletería', texto: 'El botón "Boletería" (abajo del menú) cambia el CRM entero de color y de menú, como si fuera otra app: rutas, aerolíneas, precios de referencia, requisitos por país y calendario de temporadas, más la cola de solicitudes de siempre a mano. "Volver a Hospedajes" te devuelve todo como estaba.', roles: ['admin', 'asesor', 'boleteria'] },
  { fecha: '2026-08-15', emoji: '🧑‍💼', titulo: 'Asesores de prueba: lotes y progreso', texto: 'En Gestión de Personal, pestaña "Asesores de prueba": asignale a un asesor nuevo un lote de leads viejos para que practique contactándolos, con conteo previo, fecha límite y seguimiento de contactados/pendientes/vencidos. Botón para promoverlo a asesor real cuando esté listo. También se puede editar usuario, permisos de voucher/informe diario y bloquear acceso sin dar de baja.', roles: ['admin'] },
  { fecha: '2026-08-15', emoji: '📱', titulo: 'El CRM en el celular se siente como una app', texto: 'Deslizá el dedo a los costados para cambiar de sección, deslizá hacia abajo arriba de todo para refrescar, y mantené el dedo sobre un lead para seleccionarlo sin tocar el chequeo chiquito. Las notificaciones ahora se ven con nuestro logo (antes salía el ícono genérico del navegador), y hay botón para instalar la app desde el celular. Los botones y filas son más fáciles de tocar, las tablas largas (Facturación, Vouchers, Postulaciones) se ven como tarjetas legibles en vez de una tabla achicada, y todo tiene animaciones más suaves.', roles: ROLES_TODOS },
  { fecha: '2026-08-15', emoji: '⚡', titulo: 'Leads en vivo más confiables', texto: 'La lista de Leads se actualiza sola cuando entra o cambia uno, sin parpadear entera ni perder tu lugar en el scroll. Si el teléfono se queda sin señal un rato, el CRM lo avisa (puntito gris junto a "Nuevo lead") y se reconecta solo al volver. Si dos personas editan el mismo lead a la vez, ahora avisa el conflicto en vez de que uno le pise el cambio al otro en silencio. La tarjeta de cada lead se reordenó: el nombre, destino y estado se ven primero, las acciones (WhatsApp, Facturar) quedan abajo.', roles: ROLES_TODOS },
  { fecha: '2026-08-13', emoji: '🔊', titulo: 'Voz IA: ya conectada al chat de la web (opcional)', texto: 'En Cerebro IA, arriba de las reglas, hay dos interruptores nuevos para prender las notas de voz en el chat de la página web y en Instagram/Facebook, por separado. Apagados por defecto: nada cambia hasta que los prendas a propósito. Cuando está prendido, al cotizar un precio la IA manda una nota de voz con la voz clonada en vez de texto. Se puede apagar en cualquier momento sin perder nada.', roles: ['admin'] },
  { fecha: '2026-08-12', emoji: '🎚️', titulo: 'Voz IA: sliders y varias muestras por voz', texto: 'La voz clonada sonaba un poco robótica porque la muestra era una locución de comercial, no una conversación. Ahora se pueden cargar VARIAS muestras por modo (una con buen timbre, otra con buen flow conversacional) y entrenarlas juntas en un solo botón "Entrenar voz". Se sumaron 3 sliders (Expresividad, Variación, Velocidad) para ajustar por oído cómo habla la IA, con un botón para guardarlos como predeterminados -- eso es lo que de verdad va a escuchar el cliente el día que se conecte a las conversaciones reales.', roles: ['admin'] },
  { fecha: '2026-08-12', emoji: '🎙️', titulo: 'Voz IA: control de calidad de la muestra', texto: 'La primera prueba sonó metálica porque la muestra de referencia era una nota de voz de WhatsApp (calidad muy comprimida). Ahora, al subir una muestra nueva, el panel mide su duración y calidad reales antes de subirla: bloquea las que son imposibles de usar bien y avisa cuando la calidad es apenas aceptable, con instrucciones de cómo grabar bien (app de notas de voz del teléfono, nunca por WhatsApp). También transcribe la muestra automáticamente para que la IA pronuncie mejor, con la transcripción editable por si se equivoca en algún nombre.', roles: ['admin'] },
  { fecha: '2026-08-12', emoji: '🎙️', titulo: 'Voz IA: probar y controlar la voz de la IA', texto: 'Sección nueva (solo admin) para escuchar cómo suena la voz clonada antes de que llegue a un cliente real. Pegás un texto, se pule automáticamente con las reglas de venta y se sintetiza con la voz de referencia. Un toggle arriba cambia entre la voz para mensajes y la voz para videos de Instagram, cada una con su propia muestra de referencia (subible desde ahí mismo, con confirmación antes de reemplazarla). Todavía no está conectado a las conversaciones reales.', roles: ['admin'] },
  { fecha: '2026-08-07', emoji: '🔐', titulo: 'Accesos más seguros', texto: 'Si olvidaste tu contraseña, pedí ayuda a un administrador: desde Gestión de Personal puede restablecer tu acceso y entregarte una contraseña temporal que debés cambiar al entrar. Los códigos para configurar una cuenta nueva ahora los genera el admin y vencen; ya no se usa la pregunta personal para recuperar cuentas.', roles: ROLES_TODOS },
  { fecha: '2026-08-06', emoji: '📅', titulo: 'Stop Sales: calendario de bloqueos', texto: 'La pestaña Stop Sales (qué hoteles no tienen cupo, según el PDF que manda BT Travel) ahora se ve como un calendario del mes: los días con bloqueo salen pintados, y cuanto más oscuro, más hoteles caen ese día. Tocá un día y te dice cuáles son. Arriba a la derecha podés cambiar a la vista por hotel, donde cada uno muestra una barra con sus días bloqueados. Los tres recuadros de arriba son filtros: sin cupo, a confirmar, y los que se liberan en menos de una semana. También está el botón "Ver PDF original" por si querés comparar contra lo que mandó BT Travel.', roles: ROLES_TODOS },
  { fecha: '2026-08-05', emoji: '💰', titulo: 'Web y Reasignados', texto: 'Sección nueva (solo admin) con todos los leads que entraron por la página web o que en algún momento se reasignaron, juntos en un solo lugar. Se puede filtrar por origen y ver cuáles ya cerraron en venta, con el monto y la comisión calculada al porcentaje que configures ahí mismo. Los que son de los dos orígenes aparecen una sola vez, marcados "Ambos", para no contarlos doble.', roles: ['admin'] },
  { fecha: '2026-08-05', emoji: '🛡️', titulo: 'El CRM ya no se cae entero por una sola sección', texto: 'El 3 de agosto el CRM quedó inutilizable después de una actualización. La causa: al publicar, el navegador podía quedarse con una mitad nueva y otra vieja, y con esa mezcla una sección fallaba y arrastraba a todas las demás (Voucher, Tareas, Freelancers dejaban de cargar). Se arregló por dos lados: ahora las dos mitades entran juntas o no entra ninguna, y si una sección falla queda apagada solo ella, sin tocar el resto.', roles: ROLES_TODOS },
  { fecha: '2026-08-02', emoji: '📊', titulo: 'Clientes de la IA: cuánto consumen y cómo va su cobro', texto: 'En "IA Atención al Cliente" hay dos pestañas. Interesados es lo de antes, con un botón nuevo para convertir una solicitud en cliente (le crea su rama de la IA). Clientes muestra, por cada uno: cuántos mensajes lleva del plan, cuántas personas distintas le escribieron este mes, cuánto nos costó de verdad, cuánto se ganó, y si ya pagó. Al 80% del plan avisa y propone el siguiente — la IA nunca se corta ni se cobra nada solo.', roles: ['admin'] },
  { fecha: '2026-08-02', emoji: '🌱', titulo: 'Crear ramas de la IA desde el CRM', texto: 'En Cerebro IA > Ramas hay un botón "Nueva rama": le ponés el nombre de la posada y queda creada heredando toda la Base (cómo vende, qué nunca inventa, cuándo pasa a un humano). Se puede apagar y volver a prender sin perder lo que le hayas escrito, y borrar si nunca se le cargó nada. Ojo: la rama todavía no tiene forma de cargar sus habitaciones y fotos, ni le llegan mensajes — sirve para armarle la identidad y probarla en "Probar".', roles: ['admin'] },
  { fecha: '2026-08-02', emoji: '📞', titulo: 'Un cliente que deja su número ya no se pierde', texto: 'Si el cliente escribe su teléfono en el chat, el lead se crea sí o sí — antes eso dependía de que la IA además "decidiera" que estaba listo, y en 30 días 36 conversaciones dieron el número sin generar ningún lead. También se arregló que una consulta que no es un destino del catálogo (ej. un boleto Cancún–Venezuela) dejaba a la IA pidiendo el destino en círculos, y que a un número sin código de país se le asignaba el país por orden de una lista en vez de por lo que dijo el cliente.', roles: ['admin', 'asesor'] },
  { fecha: '2026-08-01', emoji: '🌑', titulo: 'Se fue la sombra negra de abajo', texto: 'Aparecía una banda oscura fija en la parte de abajo del Dashboard que tapaba el embudo del pipeline. Eran las hojas de edición cerradas, que aunque no se vieran seguían pintando su sombra dentro de la pantalla. Ya no.', roles: ROLES_TODOS },
  { fecha: '2026-08-01', emoji: '🌳', titulo: 'Cerebro IA: pestaña "Ramas"', texto: 'Ahora se ve cómo está armada la IA por dentro: un árbol con la Base (cómo vende, qué nunca inventa, cuándo pasa a un humano) y la rama de Lotus 360 con lo nuestro (hoteles, asesores, boletería). Al elegir una rama sale el texto exacto que recibe la IA, con colores según venga de la Base o sea propio de la rama. Si editás un pedazo, antes de guardar te muestra qué líneas cambian y te pide confirmar. En "Probar" ahora elegís contra qué rama conversar.', roles: ['admin'] },
  { fecha: '2026-08-01', emoji: '🏨', titulo: 'IA Atención al Cliente', texto: 'Las posadas que entran a destinoyeventoslotus360.com/ia-planes, arman su asistente y dejan sus datos caen en esta sección nueva. No se les asigna asesor y no aparecen en Leads: no son clientes de viaje, son quienes quieren contratar el asistente.', roles: ['admin'] },
  { fecha: '2026-08-01', emoji: '🖼️', titulo: 'Cerebro IA: cargar un flyer', texto: 'Subís la captura del flyer o del reel y la IA lee el precio, la vigencia y qué incluye. No se publica nada hasta que vos lo confirmes: primero te muestra lo que entendió para que lo corrijas. Lo que cargues queda marcado "por revisar" en el Actualizador.', roles: ['admin', 'marketing'] },
  { fecha: '2026-08-01', emoji: '🧠', titulo: 'Cerebro IA: reglas de venta y banco de pruebas', texto: 'Le decís a la IA en qué orden ofrecer y qué aclarar en cada destino, con tus palabras, y lo obedece en Instagram, Facebook y la web en el próximo mensaje — sin publicar nada. Al lado tenés "Probar": escribís lo que diría un cliente y ves qué le contestaría ahora mismo, con el tarifario real. No crea leads ni le avisa a ningún asesor.', roles: ['admin'] },
  { fecha: '2026-08-01', emoji: '💲', titulo: 'Editar promociones desde el Tarifario', texto: 'Precio, vigencia, fecha de fin y qué incluye se corrigen desde la ficha misma, sin esperar la próxima carga del tarifario.', roles: ['admin', 'marketing'] },
  { fecha: '2026-08-01', emoji: '📐', titulo: 'Hojas de edición más cómodas en la computadora', texto: 'Se veían estiradas de borde a borde, con campos de mil píxeles para escribir un precio. Ahora van centradas y con un ancho de lectura, y el botón Guardar queda siempre a la vista. En el celular no cambia nada.', roles: ROLES_TODOS },
  { fecha: '2026-07-27', emoji: '🟢', titulo: '"Conectados ahora" ahora dice la verdad', texto: 'Ese número contaba jornadas que nadie cerró, por eso marcaba 9 de 15 personas hasta de madrugada. Ahora cuenta solo a quien de verdad tiene el CRM abierto en este momento. Además los tres recuadros de arriba pasaron a ser filtros: tocá "Conectados ahora" para ver solo a esos, "Miembros de equipo" para ver a todos, y "Postulaciones sin revisar" te lleva directo a esa pestaña.', roles: ['admin'] },
  { fecha: '2026-07-27', emoji: '👥', titulo: 'Gestión de Personal renovada', texto: 'Ahora podés agregar gente nueva (se le crea su usuario y contraseña temporal), editarle nombre, cargo y rol, y darla de baja sin perder su historial. La pestaña Asistencia desapareció: quién marcó hoy, sus strikes y el botón de exceptuar están en la tarjeta de cada persona, y el historial de entradas y salidas quedó más abajo en la misma pestaña.', roles: ['admin'] },
  { fecha: '2026-07-27', emoji: '⏱️', titulo: 'Freelancers: trabajo real vs inactividad', texto: 'Los freelancers ahora se ven con las mismas tarjetas que el resto del equipo, y además muestran cuánto tiempo trabajaron de verdad y cuánto estuvieron inactivos (hoy y en la semana). Si alguno queda bloqueado por los 15 minutos sin actividad, la tarjeta se marca en rojo con la etiqueta Bloqueado y un botón para desbloquearlo ahí mismo.', roles: ['admin'] },
  { fecha: '2026-07-27', emoji: '🔀', titulo: 'Reasignaciones editables', texto: 'La tabla ahora muestra el traspaso completo (de quién a quién) en una sola columna, y cada fila se puede corregir o eliminar a mano. Se limpió el historial anterior al 20 de julio.', roles: ['admin'] },
  { fecha: '2026-07-27', emoji: '🧲', titulo: 'El mismo cliente ya no genera dos leads', texto: 'Si un cliente escribe por la web y después por Instagram (o al revés) con el mismo número, el CRM lo reconoce y NO crea un lead nuevo: suma la info al que ya existe y te avisa por Telegram que volvió a escribir. El asesor asignado no cambia nunca, así que no pasa más que dos personas llamen al mismo cliente. Lo ves en la pestaña Actividad del lead.', roles: ['admin', 'asesor'] },
  { fecha: '2026-07-27', emoji: '📱', titulo: 'Barra de abajo a tu gusto + deslizar para cambiar de sección', texto: 'Desde el celular podés elegir qué secciones tenés en la barra de abajo (hasta 6 más "Yo"): entrá a Yo > tu nombre > "Barra de abajo" y tildá las que quieras. Además, deslizando el dedo de un lado al otro pasás de una sección a la otra sin tocar nada. Los nombres de la barra ahora se leen mucho mejor.', roles: ROLES_TODOS },
  { fecha: '2026-07-27', emoji: '🔄', titulo: 'Botón "Actualizar CRM"', texto: 'Arriba a la derecha del logo y abajo del menú (y en "Yo" desde el celular). Hace lo mismo que Ctrl+Shift+R: borra lo que quedó guardado del navegador y trae la última versión, sin cerrar tu sesión. Usalo cuando algo se vea raro o cuando te avisemos de una novedad.', roles: ROLES_TODOS },
  { fecha: '2026-07-27', emoji: '🧭', titulo: 'Menú más corto: cada cosa donde corresponde', texto: 'Colaboraciones ahora es una pestaña dentro de Leads. Reasignaciones y Métricas pasaron a Gestión de Personal. Buscar Tarifario se integró al Tarifario. El Recorrido guiado y el Manual son ahora lo mismo: desde el Manual tocás "Ver en pantalla" y el recorrido arranca solo.', roles: ROLES_TODOS },
  { fecha: '2026-07-27', emoji: '🔎', titulo: 'Buscador con IA en el Tarifario', texto: 'Escribí lo que busca el cliente en tus palabras ("algo de playa para una pareja en diciembre") y la IA lo traduce a una búsqueda sobre todo el tarifario. Los precios salen siempre de la ficha real: la IA nunca los inventa ni los reescribe.', roles: ['admin', 'asesor', 'marketing'] },
  { fecha: '2026-07-27', emoji: '🪪', titulo: 'Personal ahora son tarjetas', texto: 'Una tarjeta por persona, con icono según su cargo, el tiempo que tuvo el CRM abierto en el período y el detalle día por día con las horas de conexión y desconexión. El cargo se edita desde la misma tarjeta.', roles: ['admin'] },
  { fecha: '2026-07-27', emoji: '🔕', titulo: 'Se acabaron los avisos de Leads Fallidos', texto: 'Antes llegaba un mensaje a Telegram por cada lead que fallaba, aunque el sistema lo recuperara solo minutos después. Ahora un proceso automático los recupera cada 20 minutos y solo te avisa si uno agotó los reintentos y de verdad necesita tu mano.', roles: ['admin'] },
  { fecha: '2026-07-27', emoji: '🖼️', titulo: 'Tarjetas del Tarifario parejas', texto: 'Las promociones muestran una descripción corta normalizada (la misma que se ve en la web) y todas las tarjetas quedan del mismo alto, con el precio siempre a la misma altura.', roles: ['admin', 'asesor', 'marketing'] },
  { fecha: '2026-07-26', emoji: '📖', titulo: 'Manual del CRM y esta sección de Actualizaciones', texto: 'Guía completa por secciones (con capturas) accesible desde un botón arriba de toda pantalla, y este historial de novedades.', roles: ROLES_TODOS },
  { fecha: '2026-07-25', emoji: '🧑‍💼', titulo: 'Sección Postulaciones', texto: 'Los candidatos que aplican desde "Trabaja con nosotros" (web o Instagram/Facebook) quedan acá, con CV, estado de llamada y calificación de prospecto.', roles: ['admin'] },
  { fecha: '2026-07-25', emoji: '🏷️', titulo: 'Tarjetas de lead y Tarifario reorganizados', texto: 'Botón de "Enviar a facturación" directo en la tarjeta, checkboxes con más estilo, recarga manual de Leads, y Promociones agrupadas por hotel + nueva sección Hot Sales.', roles: ['admin', 'asesor', 'marketing'] },
  { fecha: '2026-07-24', emoji: '📱', titulo: 'CRM móvil rediseñado', texto: 'Navegación de 5 zonas (Hoy / Leads / Mensajes / Tarifario / Yo), pestaña Conversación y Actividad en la ficha del lead, también en desktop.', roles: ROLES_TODOS },
  { fecha: '2026-07-24', emoji: '💰', titulo: 'Ventas y Cobranzas', texto: 'Costo neto, proveedor y Cuentas por Pagar por venta, con % de comisión calculado por asesor. Filtros por mes/asesor y exportar a CSV/PDF/XLSX.', roles: ['admin'] },
  { fecha: '2026-07-24', emoji: '🧑‍💻', titulo: 'Perfil freelancer', texto: 'Sección Freelancers con jornadas y tareas propias, separado del equipo presencial.', roles: ['admin', 'asesor'] },
  { fecha: '2026-07-23', emoji: '🏅', titulo: 'Badges inteligentes en Leads', texto: 'La IA marca prioridad del lead y avisa cuando el nombre parece dudoso (perfil de Instagram/Facebook en vez del nombre real).', roles: ['admin', 'asesor'] },
  { fecha: '2026-07-22', emoji: '🛡️', titulo: 'Leads Fallidos y Colaboraciones', texto: 'Red de seguridad para leads que el bot no pudo registrar solo, y sección aparte para leads de campañas pagas con colaboradores.', roles: ['admin'] },
  { fecha: '2026-07-21', emoji: '🔀', titulo: 'Estado NUMERO INVALIDO + flechitas de estado', texto: 'Nuevo estado para números que no sirven, y flechitas para avanzar/retroceder el estado del lead directo desde la ficha.', roles: ['admin', 'asesor'] },
  { fecha: '2026-07-18', emoji: '📸', titulo: 'Fotos del Tarifario mejoradas', texto: 'Se pueden borrar fotos desde el CRM, arreglos de scroll en celular, y pestaña TikTok agregada junto a Instagram en Redes.', roles: ['admin', 'marketing'] },
  { fecha: '2026-07-17', emoji: '🧭', titulo: 'Sidebar reordenable', texto: 'Podés reordenar el menú lateral a tu gusto, borrado masivo de leads, y voucher disponible para todos los asesores.', roles: ['admin', 'asesor'] },
  { fecha: '2026-07-16', emoji: '🧾', titulo: 'Facturación y Buscar Tarifario', texto: 'Sección de Facturación con Mis Comisiones para asesores, buscador de texto libre sobre el Tarifario, y botón "Sugerir respuesta" con IA en la ficha del lead.', roles: ['admin', 'asesor'] },
  { fecha: '2026-07-15', emoji: '🎨', titulo: 'Rediseño de UI', texto: 'Postventa, bandeja de leads, jornada laboral y tema claro/oscuro -- lavado de cara grande al CRM.', roles: ROLES_TODOS },
  { fecha: '2026-07-11', emoji: '🚫', titulo: 'Cotizador IA no promete sin entregar', texto: 'Regla dura + timeout de 20s: la IA nunca deja al cliente esperando una respuesta que no puede cumplir.', roles: ['admin', 'asesor', 'marketing'] },
  { fecha: '2026-07-10', emoji: '🗣️', titulo: 'Dictado por voz + Extractor de datos IA', texto: 'Podés dictar en vez de escribir en Cotizador/Mensajes/Extractor. El Extractor IA (con Gemini) parsea una conversación de WhatsApp y precarga la ficha del lead solo.', roles: ['admin', 'asesor'] },
  { fecha: '2026-07-10', emoji: '💬', titulo: 'Chat interno del equipo', texto: 'Mensajería 1 a 1 y grupo "Comunidad" con fotos, videos y documentos, estilo WhatsApp -- para hablar con compañeros sin salir del CRM.', roles: ROLES_TODOS },
  { fecha: '2026-07-10', emoji: '⚡', titulo: 'PWA instalable + rendimiento', texto: 'El CRM se instala como app, funciona offline, y mejoras grandes de velocidad y accesibilidad.', roles: ROLES_TODOS },
  { fecha: '2026-07-10', emoji: '🕒', titulo: 'Control de asistencia', texto: 'Marcá entrada/salida de tu jornada, con recordatorios y notificaciones push.', roles: ['admin', 'asesor'] },
  { fecha: '2026-07-09', emoji: '🏨', titulo: 'Tarifario con fotos y filtros', texto: 'Fotos de hoteles, filtros por precio/tipo de plan/niños gratis, y el Cotizador IA arma opciones usando ese catálogo.', roles: ['admin', 'asesor', 'marketing'] },
  { fecha: '2026-07-08', emoji: '🔐', titulo: 'Login individual por usuario', texto: 'Cada asesor entra con su propia cuenta y rol (admin/asesor/marketing), con autoservicio para configurar su contraseña.', roles: ROLES_TODOS },
  { fecha: '2026-07-07', emoji: '🚀', titulo: 'Nace el CRM Lotus360', texto: 'Primera versión: leads editables, ranking de asesores y métricas -- reemplazando el flujo disperso de ManyChat, Telegram y Google Sheets.', roles: ROLES_TODOS },
];
function renderActualizaciones() {
  const porMes = {};
  ACTUALIZACIONES_LOG.filter(e => e.roles.includes(ROL)).forEach(e => { const k = e.fecha.slice(0, 7); (porMes[k] ||= []).push(e); });
  const meses = Object.keys(porMes).sort().reverse();
  document.getElementById('actualizaciones-list').innerHTML = meses.map(k => `
    <div class="act-mes">
      <div class="act-mes-t">${esc(fullMonth(k))}</div>
      ${porMes[k].map(e => `
        <div class="act-item">
          <div class="act-emoji">${e.emoji}</div>
          <div class="act-body">
            <div class="act-head"><span class="act-titulo">${esc(e.titulo)}</span><span class="act-fecha">${e.fecha.slice(8, 10)}/${e.fecha.slice(5, 7)}</span></div>
            <div class="act-texto">${esc(e.texto)}</div>
          </div>
        </div>`).join('')}
    </div>`).join('');
}

// Avance del Proyecto Constructor de CRM para Empresas (producto de marca
// blanca aparte, ver `plataforma-crm` -- nada que ver con este CRM). Solo
// admin: el link ya lleva `nav-admin-only`, así que no hace falta filtrar por
// rol acá como sí hace `ACTUALIZACIONES_LOG`. Una entrada por JORNADA
// CERRADA del plan, no por cada commit -- si se vuelve una entrada por día,
// se convierte en trabajo de mantenimiento en vez de una foto del avance.
const PROYECTO_CONSTRUCTOR_LOG = [
  { fecha: '2026-08-09', emoji: '🎨', titulo: 'Día 1 — Fundación de diseño', texto: 'Un solo sistema de colores y tipografía para todo el lado interno (antes eran tres estilos distintos que no combinaban). Botones y textos ahora se leen bien para cualquier persona, y la página ya no se rompe en el celular.', capturas: ['dia1-estado.png', 'dia1-constructor.png'] },
  { fecha: '2026-08-09', emoji: '🏗️', titulo: 'Shell del CRM del cliente + Tareas y Catálogo', texto: 'El CRM que ve cada empresa cliente pasó de una página plana a una aplicación real: menú lateral, colores de marca de cada empresa, y dos secciones nuevas de punta a punta (Tareas y Catálogo de productos).', capturas: ['tenant-panel.png', 'tenant-catalogo.png'] },
  { fecha: '2026-08-09', emoji: '🧩', titulo: 'Día 3 — Elegir qué contrata cada empresa', texto: 'Hasta ahora, qué secciones ve una empresa quedaba fijado para siempre al crearla. Ahora se puede agregar o quitar un módulo (Citas, Inventario, Pagos...) desde el constructor en cualquier momento, con aviso claro de cuáles todavía no están listos.', capturas: [] },
  { fecha: '2026-08-09', emoji: '🖼️', titulo: 'Día 4 — Vista previa real y botón Publicar arreglado', texto: 'La vista previa del constructor dejó de ser cajas genéricas y ahora muestra una maqueta real del CRM de esa empresa, con su color de marca. Además, el botón "Publicar" -- que llevaba tiempo sin hacer nada -- ya funciona, con avisos claros mientras guarda o publica.', capturas: [] },
  { fecha: '2026-08-10', emoji: '🌐', titulo: 'Día 5 — Dominios propios conectados de verdad', texto: 'Quedó conectada la pieza que hospeda el dominio de cada empresa (ej. crm.empresacliente.com): al registrar uno, el sistema ya devuelve las instrucciones de DNS reales para configurarlo. Falta el último paso -- probarlo con un dominio real de una empresa, no uno de prueba.', capturas: [] },
  { fecha: '2026-08-10', emoji: '📊', titulo: 'Día 6 — Planes con límites reales', texto: 'Cada empresa cliente ahora tiene un plan (Inicio, Taller o Empresa) con topes reales de usuarios, contactos y módulos -- y esos topes se respetan de verdad, no son sólo un cartel. Se ve una barra de uso por empresa y se puede subir de plan con un clic.', capturas: ['dia6-plan-uso.png', 'dia6-modulos-tope.png'] },
  { fecha: '2026-08-10', emoji: '📅', titulo: 'Día 7 — Módulo de Citas de punta a punta', texto: 'Primer módulo nuevo agregado siguiendo una receta escrita para repetirla con los que faltan. Las empresas que lo contraten ya ven una agenda real (agrupada por día, con la hora de cada quien la mira) para agendar, confirmar y reasignar turnos.', capturas: ['dia7-citas-agenda.png', 'dia7-citas-movil.png'] },
];
function renderProyectoConstructor() {
  const porMes = {};
  PROYECTO_CONSTRUCTOR_LOG.forEach(e => { const k = e.fecha.slice(0, 7); (porMes[k] ||= []).push(e); });
  const meses = Object.keys(porMes).sort().reverse();
  document.getElementById('proyecto-constructor-list').innerHTML = meses.map(k => `
    <div class="act-mes">
      <div class="act-mes-t">${esc(fullMonth(k))}</div>
      ${porMes[k].map(e => `
        <div class="act-item">
          <div class="act-emoji">${e.emoji}</div>
          <div class="act-body">
            <div class="act-head"><span class="act-titulo">${esc(e.titulo)}</span><span class="act-fecha">${e.fecha.slice(8, 10)}/${e.fecha.slice(5, 7)}</span></div>
            <div class="act-texto">${esc(e.texto)}</div>
            ${e.capturas?.length ? `<div class="pc-capturas">${e.capturas.map(c => `<img class="manual-shot" src="img/proyecto-constructor/${c}" alt="Captura: ${esc(e.titulo)}" loading="lazy">`).join('')}</div>` : ''}
          </div>
        </div>`).join('')}
    </div>`).join('');
}

/* ---------- Aviso de actualización disponible (Service Worker) ----------
   sw.js ya hace self.skipWaiting() + clients.claim() en cada instalación --
   la versión nueva toma control del tab sola en segundo plano apenas Cloudflare
   sirve el sw.js actualizado. Lo único que faltaba era avisarle al usuario que
   ya hay una versión nueva activa y dejarlo elegir cuándo recargar (nunca solo
   -- puede estar a mitad de escribir algo). Pedido del dueño (2026-07-26):
   mismo pop-up sirve de mini-changelog reusando ACTUALIZACIONES_LOG.
   'controllerchange' también dispara en la instalación inicial del SW (cuando
   el tab pasa de sin-controlador a controlado por primera vez) -- yaHabiaControlador
   distingue eso de una actualización real para no avisar de más a alguien
   que recién entra por primera vez. */
/* ---------- Actualizar CRM (equivalente a Ctrl+Shift+R) ----------
   Pedido del dueño (2026-07-27): un botón visible, porque nadie del equipo se
   acuerda del atajo y quedaban trabajando sobre una versión vieja cacheada.

   Un location.reload() pelado NO alcanza: el Service Worker sirve app.js e
   index.html desde Cache Storage, así que el navegador vuelve a mostrar lo
   mismo. Hay que vaciar los cachés y sacar el SW de encima ANTES de recargar.
   El SW se vuelve a registrar solo en la carga siguiente
   (registrarServiceWorkerConAviso), así que no se pierde el modo offline. */
let refreshEnCurso = false;
async function actualizarCRM() {
  if (refreshEnCurso) return;
  refreshEnCurso = true;
  document.querySelectorAll('[data-refresh]').forEach(b => {
    b.classList.add('girando');
    b.disabled = true;
  });
  try {
    if (window.caches) {
      const claves = await caches.keys();
      await Promise.all(claves.map(k => caches.delete(k)));
    }
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (err) {
    // Si falla el limpiado igual conviene recargar: peor caso, queda la versión
    // vieja y el usuario reintenta. Bloquear acá no ayuda a nadie.
    console.error('actualizarCRM: no se pudo limpiar el caché', err);
  }
  // El query param fuerza a saltear el caché HTTP del navegador para el
  // documento; el resto de los assets ya quedaron sin caché arriba.
  const url = new URL(location.href);
  url.searchParams.set('_v', Date.now().toString(36));
  location.replace(url.toString());
}

// Se engancha en el nivel del módulo, no dentro de startApp: si startApp
// revienta a mitad (justo el caso donde hace falta actualizar), el botón tiene
// que seguir andando.
document.querySelectorAll('[data-refresh]').forEach(b => {
  b.addEventListener('click', e => { e.preventDefault(); actualizarCRM(); });
});

function registrarServiceWorkerConAviso() {
  if (!('serviceWorker' in navigator)) return;
  const yaHabiaControlador = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (yaHabiaControlador) mostrarAvisoActualizacion();
  });
  navigator.serviceWorker.register('sw.js').then(reg => {
    // El navegador NO revisa solo si sw.js cambió en el server mientras la
    // pestaña queda abierta sin navegar -- solo lo hace al recargar, o cada
    // ~24h por su cuenta (hallazgo real, 2026-07-26: probamos 3 deploys
    // seguidos con la pestaña abierta y el aviso nunca disparó). reg.update()
    // fuerza ese chequeo -- acá cada 5 min, y también apenas la pestaña
    // vuelve a estar visible (alguien que cambia de pestaña y vuelve).
    setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) reg.update().catch(() => {});
    });
  }).catch(console.error);
}
function mostrarAvisoActualizacion() {
  if (document.getElementById('update-toast')) return;
  const novedades = ACTUALIZACIONES_LOG.filter(e => e.roles.includes(ROL)).slice(0, 3);
  const toast = document.createElement('div');
  toast.id = 'update-toast';
  toast.className = 'update-toast';
  toast.innerHTML = `
    <div class="ut-head"><i class="fas fa-arrows-rotate"></i> Hay una actualización del CRM</div>
    <div class="ut-list">${novedades.length ? novedades.map(n => `<div class="ut-item">${n.emoji} ${esc(n.titulo)}</div>`).join('') : '<div class="ut-item">Se agregaron mejoras nuevas.</div>'}</div>
    <div class="ut-actions">
      <button type="button" class="ut-despues" id="ut-despues">Después</button>
      <button type="button" class="ut-recargar" id="ut-recargar"><i class="fas fa-rotate"></i> Actualizar ahora</button>
    </div>`;
  document.body.appendChild(toast);
  document.getElementById('ut-despues').onclick = () => toast.remove();
  document.getElementById('ut-recargar').onclick = () => location.reload();
}

function pasosVisiblesCapitulo(cap) { return cap.pasos.filter(p => !p.soloAdmin || ROL === 'admin'); }
function capitulosVisiblesTour() { return TOUR_CAPITULOS.filter(c => c.roles.includes(ROL) && (!c.visibleIf || c.visibleIf())); }
function elVisible(selector) { return [...document.querySelectorAll(selector)].find(el => el.offsetParent !== null) || null; }

let TOUR_CAP_ACTUAL = null, TOUR_PASO_IDX = 0;

// El menú de capítulos del tour desapareció: ahora ES el Manual (2026-07-27).
// El overlay + renderPasoTour + posicionarSpotlight se conservan tal cual --
// son el motor que reproduce el recorrido sobre la pantalla real; lo único que
// cambió es desde dónde se arranca.
function iniciarCapituloTour(capId) {
  const cap = TOUR_CAPITULOS.find(c => c.id === capId);
  if (!cap) return;
  TOUR_CAP_ACTUAL = cap;
  TOUR_PASO_IDX = 0;
  document.getElementById('tour-overlay').classList.add('open');
  navPush({ type: 'tour' });
  renderPasoTour();
}
function siguientePasoTour() {
  const pasos = pasosVisiblesCapitulo(TOUR_CAP_ACTUAL);
  if (TOUR_PASO_IDX < pasos.length - 1) { TOUR_PASO_IDX++; renderPasoTour(); } else volverAlMenuTutorial();
}
function pasoAnteriorTour() { if (TOUR_PASO_IDX > 0) { TOUR_PASO_IDX--; renderPasoTour(); } }
function volverAlMenuTutorial(fromNav) {
  document.getElementById('tour-overlay').classList.remove('open');
  if (!fromNav) navConsume();
  TOUR_CAP_ACTUAL = null;
  marcarTutorialVisto();
  activateSection('manual');
}
function marcarTutorialVisto() {
  if (MI_PREFERENCIAS.tutorial_visto) return;
  guardarPreferencia('tutorial_visto', true);
}
function renderPasoTour() {
  const pasos = pasosVisiblesCapitulo(TOUR_CAP_ACTUAL);
  const paso = pasos[TOUR_PASO_IDX];
  document.getElementById('tb-titulo').textContent = paso.titulo;
  document.getElementById('tb-texto').textContent = typeof paso.texto === 'function' ? paso.texto() : paso.texto;
  const mockupEl = document.getElementById('tb-mockup');
  if (paso.mockup) { mockupEl.style.display = ''; mockupEl.innerHTML = paso.mockup(); } else mockupEl.style.display = 'none';
  document.getElementById('tb-dots').innerHTML = pasos.map((_, i) => `<span class="tb-dot${i === TOUR_PASO_IDX ? ' on' : ''}"></span>`).join('');
  document.getElementById('tb-back').style.visibility = TOUR_PASO_IDX === 0 ? 'hidden' : 'visible';
  document.getElementById('tb-next').textContent = TOUR_PASO_IDX === pasos.length - 1 ? 'Listo' : 'Siguiente';
  posicionarSpotlight(paso);
}
function posicionarSpotlight(paso) {
  const spot = document.getElementById('tour-spotlight'), bubble = document.getElementById('tour-bubble');
  const centrar = () => { spot.style.opacity = '0'; bubble.style.top = '50%'; bubble.style.bottom = ''; bubble.style.left = '50%'; bubble.style.transform = 'translate(-50%,-50%)'; };
  if (!paso.selector) { centrar(); return; }
  const posicionar = () => {
    const el = elVisible(paso.selector);
    if (!el) { centrar(); return; }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => {
      const r = el.getBoundingClientRect();
      spot.style.opacity = '1';
      spot.style.top = (r.top - 8) + 'px'; spot.style.left = (r.left - 8) + 'px';
      spot.style.width = (r.width + 16) + 'px'; spot.style.height = (r.height + 16) + 'px';
      const debajo = r.top < window.innerHeight / 2;
      bubble.style.transform = 'none';
      bubble.style.top = debajo ? Math.min(r.bottom + 16, window.innerHeight - 200) + 'px' : '';
      bubble.style.bottom = !debajo ? (window.innerHeight - r.top + 16) + 'px' : '';
      bubble.style.left = Math.max(16, Math.min(r.left, window.innerWidth - 356)) + 'px';
    }, 260);
  };
  if (TOUR_CAP_ACTUAL.seccion && currentSec !== TOUR_CAP_ACTUAL.seccion) { activateSection(TOUR_CAP_ACTUAL.seccion, true); setTimeout(posicionar, 80); } else posicionar();
}
function setupTutorial() {
  document.getElementById('sheet-item-logout')?.addEventListener('click', () => cerrarSesion());
  document.getElementById('tb-next').addEventListener('click', siguientePasoTour);
  document.getElementById('tb-back').addEventListener('click', pasoAnteriorTour);
  document.getElementById('tb-skip').addEventListener('click', () => volverAlMenuTutorial());
  document.getElementById('topbar-manual-btn')?.addEventListener('click', () => activateSection('manual'));
}
