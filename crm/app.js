import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://begbjhrdbsqftbbleecb.supabase.co';
const FOTOS_BASE = SUPABASE_URL + '/storage/v1/object/public/tarifario-fotos/';
const SUPABASE_KEY = 'sb_publishable_M7Ms9DLwpNSCXZNCDhYtbQ_LhMYeLxk';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const fmt = n => (n ?? 0).toLocaleString('es-VE');
const money = n => '$' + (Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fullMonth = k => { const [y, m] = k.split('-'); return MESL[+m - 1] + ' ' + y; };
const ESTADOS = ['POR ATENDER', 'ATENDIDO', 'CLIENTE CONTACTADO', 'COTIZACION ENVIADA', 'EN ESPERA DE PAGO', 'PAGO REALIZADO', 'PERDIDO', 'Sin gestionar'];
const ESTADOS_EDIT = ESTADOS;
const ESTADO_COLORS = { 'POR ATENDER': '#ff9100', 'ATENDIDO': '#4a9eff', 'CLIENTE CONTACTADO': '#4a9eff', 'COTIZACION ENVIADA': '#a06bff', 'EN ESPERA DE PAGO': '#f5b544', 'PAGO REALIZADO': '#10b981', 'PERDIDO': '#ef4444', 'Sin gestionar': '#5f677f' };
const SERVICIOS = ['Vuelos', 'Full Day', 'Hospedaje', 'Paquete Todo Incluido', 'Hotel', 'Tour', 'Evento', 'Otro'];
const VENTA = 'PAGO REALIZADO';
const CANAL_CLASS = { 'Instagram': 'ig', 'Facebook': 'fb', 'Ambos': 'am', 'Desconocido': '' };
const ADV_COLORS = ['#ff9100', '#4a9eff', '#10b981', '#a06bff', '#f5b544', '#ff5c8a'];
const CLIENT_ICONS = ['fa-umbrella-beach', 'fa-plane-departure', 'fa-suitcase-rolling', 'fa-compass', 'fa-earth-americas', 'fa-camera-retro', 'fa-map-location-dot', 'fa-sun', 'fa-water', 'fa-mountain-sun', 'fa-passport', 'fa-glasses'];
const CLIENT_COLORS = ['#ff9100', '#4a9eff', '#10b981', '#a06bff', '#f5b544', '#ff5c8a', '#22c1c3', '#7c93ff'];
const seedHash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const clientAvatar = l => { const h = seedHash(l.id ?? l.telefono ?? l.nombre); return { icon: CLIENT_ICONS[h % CLIENT_ICONS.length], color: CLIENT_COLORS[(h >> 3) % CLIENT_COLORS.length] }; };
const TITLES = { dashboard: ['Dashboard', 'Resumen general de leads · Lotus 360'], leads: ['Leads', 'Base de datos de clientes y prospectos'], metricas: ['Métricas', 'Ventas, clientes nuevos y conversión'], ranking: ['Ranking de asesores', 'Desempeño del equipo comercial'], pipeline: ['Pipeline', 'Ciclo de vida del lead'], asesores: ['Asesores', 'Carga de trabajo del equipo'], reasignaciones: ['Reasignaciones', 'Historial de leads reasignados por timeout o manualmente'], asistencia: ['Asistencia', 'Control de jornada y strikes del equipo'], tarifario: ['Tarifario', 'Destinos, hoteles, paquetes y promociones vigentes'], cotizador: ['Cotizador IA', 'Cotiza con el tarifario vigente como base'], galeria: ['Galería', 'Fotos de los hoteles del tarifario'] };
const initials = s => (s || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
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

let STATS = {}, page = 1, PER = 25, totalFiltered = 0;
let activeMonth = null, activeDestino = null, currentLead = null;
let trendKeys = [], canalKeys = [], destKeys = [], trendMap = {};
let previewSel = null, charts = {};
let ACTIVOS = [];
let leadsView = 'lista', rgView = 'lista';

/* ---------- Periodos ---------- */
function periodo(kind) {
  const now = new Date(); let d = new Date(now);
  if (kind === 'hoy') { d.setHours(0, 0, 0, 0); return [d, addD(d, 1)]; }
  if (kind === 'semana') { const w = new Date(now); const day = (w.getDay() + 6) % 7; w.setDate(w.getDate() - day); w.setHours(0, 0, 0, 0); return [w, addD(w, 7)]; }
  if (kind === 'mes') { const m = new Date(now.getFullYear(), now.getMonth(), 1); return [m, new Date(now.getFullYear(), now.getMonth() + 1, 1)]; }
  if (kind === 'anio') { return [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear() + 1, 0, 1)]; }
  return [addD(now, -30), addD(now, 1)];
}
const addD = (dt, n) => { const x = new Date(dt); x.setDate(x.getDate() + n); return x; };
const iso = dt => dt.toISOString();

/* ---------- Auth ---------- */
const EMAIL_DOMINIO = 'lotus360.local';
const RESET_FN_URL = 'https://begbjhrdbsqftbbleecb.functions.supabase.co/reset-password';
const CLAIM_FN_URL = 'https://begbjhrdbsqftbbleecb.functions.supabase.co/claim-account';
const OVERLAYS = ['login', 'setup', 'forgot', 'marketing-placeholder', 'claim-list', 'claim-form'];
let booted = false, ROL = null, MI_NOMBRE = null, MI_USERNAME = null, JORNADA_ACTIVA = false;
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
  const { data, error } = await sb.from('usuarios').select('id,username,nombre,rol,debe_cambiar_password').eq('id', user?.id).single();
  if (error || !data) {
    await sb.auth.signOut();
    showOverlay('login');
    document.getElementById('loginErr').textContent = 'Cuenta sin configurar, contacta a un administrador';
    return null;
  }
  return data;
}

async function afterLogin() {
  const u = await cargarUsuario();
  if (!u) return;
  MI_NOMBRE = u.nombre; ROL = u.rol; MI_USERNAME = u.username;
  if (u.debe_cambiar_password) { showOverlay('setup'); return; }
  entrarSegunRol();
}

function entrarSegunRol() {
  document.body.classList.toggle('rol-asesor', ROL === 'asesor');
  document.body.classList.toggle('rol-marketing', ROL === 'marketing');
  overlay('login').classList.remove('show');
  overlay('setup').classList.remove('show');
  document.getElementById('side-un').textContent = MI_NOMBRE;
  document.getElementById('side-ue').textContent = ROL === 'admin' ? 'Administrador' : 'Asesor comercial';
  document.getElementById('side-avatar').textContent = initials(MI_NOMBRE);
  renderJornadaUI();
  handleCheckIn();
  startApp();
  renderRecordatoriosUI();
  manejarDeepLinkAsistencia();
  registrarPushNativo();
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
async function handleCheckOut() {
  if (ROL !== 'admin' && ROL !== 'asesor') return;
  const { error } = await sb.rpc('agent_check_out');
  if (error) { console.error('check-out', error); return; }
  JORNADA_ACTIVA = false;
  renderJornadaUI();
}
window.toggleJornada = async () => { JORNADA_ACTIVA ? await handleCheckOut() : await handleCheckIn(); };
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

function puedeActivarRecordatorios() {
  return ROL === 'asesor' || (ROL === 'admin' && GERENCIA_USERNAMES.includes(MI_USERNAME));
}
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
window.activarRecordatorios = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { errToast('Este navegador no soporta notificaciones push'); return; }
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') { errToast('Permiso de notificaciones denegado'); return; }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from('push_subscriptions').insert({ usuario_id: user.id, platform: 'web', subscription_json: sub.toJSON() });
    if (error && error.code !== '23505') { errToast('No se pudo activar: ' + error.message); return; }
    okToast('Recordatorios activados');
  } catch (e) {
    console.error('activarRecordatorios', e);
    errToast('No se pudo activar los recordatorios');
  }
  renderRecordatoriosUI();
};
window.ocultarRecordatoriosBanner = () => {
  sessionStorage.setItem('recordatorios_banner_oculto', '1');
  renderRecordatoriosUI();
};
async function renderRecordatoriosUI() {
  if (!puedeActivarRecordatorios()) return;
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
async function loadAsistencia() {
  const [{ data: hoy, error: e1 }, { data: strikes, error: e2 }] = await Promise.all([
    sb.rpc('asistencia_admin_hoy'),
    sb.rpc('asistencia_strikes_mes'),
  ]);
  if (e1 || e2) { errToast('No se pudo cargar Asistencia'); return; }
  document.getElementById('asist-tbody').innerHTML = (hoy || []).map(a => `
    <tr>
      <td>${esc(a.nombre)}</td>
      <td>${a.exento_hoy ? '<span class="asist-badge">Exento hoy</span>' : a.marco_hoy ? '<span class="asist-badge on">Marcó</span>' : '<span class="asist-badge off">No marcó</span>'}</td>
      <td>${a.tiene_recordatorios ? 'Activos' : '—'}</td>
      <td>${a.strikes_mes}</td>
      <td>${a.exento_hoy ? '' : `<button class="btn-sm" onclick="exceptuarHoy('${a.usuario_id}')">Exceptuar hoy</button>`}</td>
    </tr>`).join('') || '<tr><td colspan="5">Sin asesores</td></tr>';
  const activos = (strikes || []).filter(s => !s.anulado_at);
  document.getElementById('asist-strikes-wrap').innerHTML = activos.length
    ? activos.map(s => `<div class="strike-row"><span>${esc(s.nombre)} — ${s.fecha}</span><button class="btn-sm" onclick="anularStrikeUI(${s.id})">Anular</button></div>`).join('')
    : '<div class="es-s">Sin strikes este mes</div>';
}
window.exceptuarHoy = async (asesorId) => {
  const motivo = prompt('Motivo (opcional):');
  const { error } = await sb.rpc('exceptuar_asistencia', { p_asesor_id: asesorId, p_fecha: hoyCaracas(), p_motivo: motivo || null });
  if (error) { errToast('No se pudo exceptuar: ' + error.message); return; }
  okToast('Asesor exceptuado hoy');
  loadAsistencia();
};
window.anularStrikeUI = async (strikeId) => {
  const motivo = prompt('Motivo de la anulación (obligatorio):');
  if (!motivo || !motivo.trim()) return;
  const { error } = await sb.rpc('anular_strike', { p_strike_id: strikeId, p_motivo: motivo.trim() });
  if (error) { errToast('No se pudo anular: ' + error.message); return; }
  okToast('Strike anulado');
  loadAsistencia();
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
  if (p1.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres'; return; }
  if (p1 !== p2) { errEl.textContent = 'Las contraseñas no coinciden'; return; }
  if (!pregunta || !respuesta) { errEl.textContent = 'Completa la pregunta y la respuesta de seguridad'; return; }
  btn.disabled = true; btn.innerHTML = 'Guardando... <i class="fas fa-spinner fa-spin"></i>';
  const { error: e1 } = await sb.auth.updateUser({ password: p1 });
  const { error: e2 } = e1 ? { error: null } : await sb.rpc('set_pregunta_seguridad', { p_pregunta: pregunta, p_respuesta: respuesta });
  btn.disabled = false; btn.innerHTML = 'Guardar y entrar <i class="fas fa-arrow-right"></i>';
  const err = e1 || e2;
  if (err) { errEl.textContent = 'No se pudo guardar: ' + err.message; return; }
  const u = await cargarUsuario(); if (!u) return;
  ROL = u.rol; entrarSegunRol();
});

document.getElementById('forgotLink').addEventListener('click', e => { e.preventDefault(); resetForgot(); showOverlay('forgot'); });
document.getElementById('backToLogin').addEventListener('click', e => { e.preventDefault(); showOverlay('login'); });

let forgotStep = 1;
function resetForgot() {
  forgotStep = 1;
  document.getElementById('forgotForm').reset();
  document.getElementById('forgotUser').disabled = false;
  document.getElementById('forgotQWrap').style.display = 'none';
  document.getElementById('forgotAWrap').style.display = 'none';
  document.getElementById('forgotPwdWrap').style.display = 'none';
  document.getElementById('forgotErr').textContent = '';
  document.getElementById('forgotBtn').innerHTML = 'Continuar <i class="fas fa-arrow-right"></i>';
}

document.getElementById('forgotForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('forgotBtn'), errEl = document.getElementById('forgotErr');
  errEl.textContent = '';
  if (forgotStep === 1) {
    const username = val('forgotUser').trim().toLowerCase();
    if (!username) { errEl.textContent = 'Escribe tu usuario'; return; }
    btn.disabled = true;
    const { data: pregunta, error } = await sb.rpc('obtener_pregunta_seguridad', { p_username: username });
    btn.disabled = false;
    if (error || !pregunta) { errEl.textContent = 'Usuario no encontrado o sin pregunta de seguridad configurada'; return; }
    document.getElementById('forgotQ').value = pregunta;
    document.getElementById('forgotUser').disabled = true;
    document.getElementById('forgotQWrap').style.display = 'block';
    document.getElementById('forgotAWrap').style.display = 'block';
    document.getElementById('forgotPwdWrap').style.display = 'block';
    btn.innerHTML = 'Cambiar contraseña <i class="fas fa-arrow-right"></i>';
    forgotStep = 2;
    return;
  }
  const username = val('forgotUser').trim().toLowerCase(), respuesta = val('forgotA').trim(), nueva = val('forgotPwd');
  if (nueva.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres'; return; }
  btn.disabled = true; btn.innerHTML = 'Verificando... <i class="fas fa-spinner fa-spin"></i>';
  try {
    const r = await fetch(RESET_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, respuesta, nueva_password: nueva }) });
    const data = await r.json();
    btn.disabled = false; btn.innerHTML = 'Cambiar contraseña <i class="fas fa-arrow-right"></i>';
    if (!data.ok) { errEl.textContent = data.error === 'respuesta_incorrecta' ? 'Respuesta incorrecta' : 'No se pudo cambiar la contraseña'; return; }
    okToast('Contraseña actualizada, ya puedes entrar');
    document.getElementById('loginUser').value = username;
    showOverlay('login');
  } catch (_e) {
    btn.disabled = false; btn.innerHTML = 'Cambiar contraseña <i class="fas fa-arrow-right"></i>';
    errEl.textContent = 'Error de conexión, intenta de nuevo';
  }
});

/* ---------- Configurar usuario (reclamar cuenta, sin contraseña previa) ---------- */
const ROL_LABEL = { admin: 'Admin', asesor: 'Asesor', marketing: 'Marketing' };
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
  if (p1.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres'; return; }
  if (p1 !== p2) { errEl.textContent = 'Las contraseñas no coinciden'; return; }
  if (!pregunta || !respuesta) { errEl.textContent = 'Completa la pregunta y la respuesta de seguridad'; return; }
  btn.disabled = true; btn.innerHTML = 'Creando... <i class="fas fa-spinner fa-spin"></i>';
  try {
    const r = await fetch(CLAIM_FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: claimUsername, password: p1, pregunta, respuesta }) });
    const data = await r.json();
    btn.disabled = false; btn.innerHTML = 'Crear mi acceso <i class="fas fa-arrow-right"></i>';
    if (!data.ok) { errEl.textContent = data.error === 'ya_reclamado' ? 'Ese usuario ya fue configurado por otra persona' : 'No se pudo crear el acceso, intenta de nuevo'; return; }
    okToast('Usuario configurado, ya puedes entrar');
    document.getElementById('loginUser').value = claimUsername;
    showOverlay('login');
  } catch (_e) {
    btn.disabled = false; btn.innerHTML = 'Crear mi acceso <i class="fas fa-arrow-right"></i>';
    errEl.textContent = 'Error de conexión, intenta de nuevo';
  }
});

window.cerrarSesion = async () => { await handleCheckOut(); await sb.auth.signOut(); location.reload(); };

async function startApp() {
  if (booted) return; booted = true;
  setupNav();
  setupTarifarioTabs();
  setupLightbox();
  setupChat();
  if (ROL === 'marketing') { activateSection('tarifario'); return; }
  await loadStats();
  ACTIVOS = Object.keys(STATS.by_advisor || {});
  renderAll();
  setupFilters();
  await loadTable();
  setupMetricas(); setupRanking(); setupReasignaciones(); setupAsesoresPeriodo();
  setupDestPeriodo(); loadDestPeriodo();
  subscribeRealtime();
}
function renderAll() { renderKPIs(); renderTrend(); renderCanal(); renderPipe('pipe'); renderPipe('pipe2'); renderAdvisors(); renderAssign(); }

async function loadStats() {
  const { data, error } = await sb.rpc('dashboard_stats');
  if (error) { console.error('stats', error.message || error); errToast('No se pudieron cargar las estadísticas'); return; }
  STATS = data;
  trendMap = {}; (STATS.trend || []).forEach(x => trendMap[x.mes] = x.total);
  document.getElementById('nav-lead-count').textContent = Number.isFinite(STATS.total) ? (STATS.total / 1000).toFixed(1).replace('.0', '') + 'k' : '—';
}

/* ---------- KPIs ---------- */
function renderKPIs() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const cards = [
    { t: 'Leads totales', v: fmt(STATS.total), d: 'Histórico 2022–2026', i: 'fa-users', c: 'var(--accent)', go: () => drillClear() },
    { t: 'Leads en 2026', v: fmt(STATS.anio_actual), d: `<b>+${fmt(STATS.by_canal?.Facebook || 0)}</b> por Facebook`, i: 'fa-calendar-day', c: 'var(--blue)', go: () => drillAnio('2026') },
    { t: 'Nuevos este mes', v: fmt(STATS.mes_actual), d: fullMonth(thisMonth), i: 'fa-bolt', c: 'var(--green)', go: () => drillMonth(thisMonth) },
    { t: 'Por atender', v: fmt(STATS.por_atender), d: 'Requieren primer contacto', i: 'fa-bell', c: 'var(--amber)', go: () => drillEstado('POR ATENDER') },
  ];
  const box = document.getElementById('kpis');
  box.innerHTML = cards.map(k => `<div class="kpi" style="--kc:${k.c}"><div class="kt"><i class="fas ${k.i}"></i> ${k.t}</div><div class="kv">${k.v}</div><div class="kd">${k.d}</div><i class="fas fa-arrow-right kgo"></i></div>`).join('');
  [...box.children].forEach((el, i) => el.onclick = cards[i].go);
}

/* ---------- Charts (dashboard) ---------- */
Chart.defaults.color = '#8b93ad'; Chart.defaults.font.family = 'Inter'; Chart.defaults.font.size = 11;
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
  if (destPeriodo === 'historico') { renderDest(); return; }
  const [d, h] = periodo(destPeriodo === 'dia' ? 'hoy' : destPeriodo);
  const { data, error } = await sb.rpc('top_destinos_periodo', { p_desde: iso(d), p_hasta: iso(h) });
  if (error) { console.error(error); errToast('No se pudieron cargar los destinos del periodo'); return; }
  renderDest(data || {});
}
function renderAssign() {
  const e = Object.entries(STATS.asignacion_objetivo || {}).sort((a, b) => b[1] - a[1]);
  mk('chAssign', { type: 'bar', data: { labels: e.map(x => x[0].split(' ')[0]), datasets: [{ data: e.map(x => x[1]), backgroundColor: ADV_COLORS, borderRadius: 7, barThickness: 30 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw + '% de los leads' } } }, scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { callback: v => v + '%' }, beginAtZero: true } } } });
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
    const fh = l.fecha_creacion ? new Date(l.fecha_creacion) : null;
    const fechaTxt = fh ? `${fh.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' })} · ${fh.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}` : '—';
    const col = ESTADO_COLORS[l.estado] || '#5f677f';
    return `<div class="al-row"><div class="al-ava" style="background:${av.color}22;color:${av.color}"><i class="fas ${av.icon}"></i></div><div class="al-info"><div class="al-nombre">${esc(l.nombre)}</div><div class="al-meta">${esc(l.destino || 'Sin destino')}</div></div><div class="al-right"><span class="al-badge" style="background:${col}22;color:${col}">${esc(niceEstado(l.estado))}</span><div class="al-fecha">${fechaTxt}</div></div></div>`;
  }).join('') + `<a class="al-more">Ver todos en Leads <i class="fas fa-arrow-right"></i></a>`;
  panel.querySelector('.al-more').onclick = () => chartPreview('asesor', nombre, nombre, 'fa-user-tie', rows.length);
}

/* ---------- Filtros de periodo en Asesores ---------- */
let asePeriodo = 'semana';
function setupAsesoresPeriodo() {
  document.querySelectorAll('#ase-periodo .seg').forEach(b => b.onclick = () => {
    document.querySelectorAll('#ase-periodo .seg').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); asePeriodo = b.dataset.p; loadAsesoresPeriodo();
  });
}
async function loadAsesoresPeriodo() {
  if (asePeriodo === 'historico') { renderAdvisors(); return; }
  const [d, h] = periodo(asePeriodo);
  const { data, error } = await sb.rpc('carga_asesores', { p_desde: iso(d), p_hasta: iso(h) });
  if (error) { console.error(error); errToast('No se pudo cargar la carga por asesor'); return; }
  renderAdvisors(data || {});
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
  leadsView = initViewSwitcher('leads-view-switch', 'leads', 'lista', v => { leadsView = v; applyLeadsView(); });
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
function initViewSwitcher(containerId, key, defaultView, onChange) {
  const bar = document.getElementById(containerId);
  const saved = localStorage.getItem('view_' + key) || defaultView;
  if (!bar) return saved;
  bar.innerHTML = `<button class="vs-btn" data-v="fichas" title="Vista de fichas"><i class="fas fa-id-card"></i></button>
    <button class="vs-btn" data-v="tarjetas" title="Vista de tarjetas"><i class="fas fa-table-cells-large"></i></button>
    <button class="vs-btn" data-v="lista" title="Vista de lista"><i class="fas fa-list"></i></button>`;
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
  if (!chips.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<span class="chips-label">Filtros:</span>` + chips.map((c, i) => `<span class="fchip">${esc(c[0])} <b data-ci="${i}">✕</b></span>`).join('') + `<button class="clear-all" id="clearAll"><i class="fas fa-times"></i> Limpiar</button>`;
  chips.forEach((c, i) => box.querySelector(`b[data-ci="${i}"]`).onclick = c[1]);
  document.getElementById('clearAll').onclick = () => { clearFiltersQuiet(); refresh(); };
}
function setDrop(id, v) { const el = document.getElementById(id); el.value = v; if (id.endsWith('-desde') || id.endsWith('-hasta')) el.dispatchEvent(new Event('change')); refresh(); }
function refresh() { page = 1; loadTable(); renderChips(); }

function buildQuery(forCount) {
  let q = sb.from('leads').select('*', forCount ? { count: 'exact' } : {});
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
  if (qs) q = q.or(`nombre.ilike.%${qs}%,telefono.ilike.%${qs}%`);
  return q;
}
async function loadTable() {
  const loading = document.getElementById('tbl-loading'), empty = document.getElementById('tbl-empty'), wrap = document.getElementById('tbl-wrap');
  empty.classList.remove('show'); loading.classList.add('show'); wrap.style.opacity = '.4';
  const from = (page - 1) * PER;
  const { data, count, error } = await buildQuery(true).order('fecha_creacion', { ascending: false, nullsFirst: false }).range(from, from + PER - 1);
  loading.classList.remove('show'); wrap.style.opacity = '1';
  if (error) { console.error(error); errToast('No se pudieron cargar los leads'); return; }
  totalFiltered = count ?? 0;
  document.getElementById('t-count').textContent = `${fmt(totalFiltered)} leads`;
  if (!data.length) { empty.classList.add('show'); document.getElementById('tbody').innerHTML = ''; document.getElementById('leads-cards').innerHTML = ''; document.getElementById('pager').innerHTML = ''; return; }
  document.getElementById('tbody').innerHTML = data.map(l => {
    const cc = CANAL_CLASS[l.canal] ?? '', wa = l.telefono ? l.telefono.replace(/\D/g, '') : '', av = clientAvatar(l);
    return `<tr>
      <td class="td-name"><div class="lead-name"><div class="ln-ava" style="background:${av.color}22;color:${av.color}"><i class="fas ${av.icon}"></i></div>${esc(l.nombre)}</div></td>
      <td data-label="Teléfono" class="muted">${esc(l.telefono) || '—'}</td>
      <td data-label="Destino">${esc(l.destino)}</td>
      <td data-label="Canal"><span class="chip ${cc}">${esc(l.canal)}</span></td>
      <td data-label="Asesor">${l.asesor_activo ? esc(l.asesor) : '<span class="muted">' + esc(l.asesor) + '</span>'}</td>
      <td data-label="Estado"><span class="badge-st" style="color:${ESTADO_COLORS[l.estado] || '#8b93ad'};background:${(ESTADO_COLORS[l.estado] || '#8b93ad')}22">${niceEstado(l.estado)}</span></td>
      <td data-label="Fecha" class="muted">${l.fecha_creacion ? l.fecha_creacion.slice(0, 10) : '—'}</td>
      <td class="td-wa">${wa ? `<a class="wa-btn" href="https://wa.me/${wa}" target="_blank" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i></a>` : '<span class="muted">—</span>'}</td>
    </tr>`;
  }).join('');
  [...document.querySelectorAll('#tbody tr')].forEach((tr, i) => tr.addEventListener('click', () => openDrawer(data[i])));
  document.getElementById('leads-cards').innerHTML = data.map(leadCardHtml).join('');
  [...document.querySelectorAll('#leads-cards .entity-card')].forEach((el, i) => el.addEventListener('click', () => openDrawer(data[i])));
  applyLeadsView();
  renderPager(Math.max(Math.ceil(totalFiltered / PER), 1));
}
function leadCardHtml(l) {
  const cc = CANAL_CLASS[l.canal] ?? '', wa = l.telefono ? l.telefono.replace(/\D/g, '') : '', av = clientAvatar(l);
  const detalle = leadsView === 'fichas' ? `
    <div class="ec-row"><i class="fas fa-comment-dots"></i> ${esc(l.destino_consulta || 'Sin consulta registrada')}</div>
    <div class="ec-row"><i class="fas fa-users"></i> ${esc(l.personas || '—')} persona(s)</div>` : '';
  return `<div class="entity-card">
    <div class="ec-top"><div class="ec-ava" style="background:${av.color}22;color:${av.color}"><i class="fas ${av.icon}"></i></div><div class="ec-nombre">${esc(l.nombre)}</div></div>
    <div class="ec-row"><i class="fas fa-phone"></i> ${esc(l.telefono) || 'Sin teléfono'}</div>
    <div class="ec-row"><i class="fas fa-location-dot"></i> ${esc(l.destino) || '—'}</div>
    <div class="ec-row"><i class="fas fa-user-tie"></i> ${l.asesor_activo ? esc(l.asesor) : '<span class="muted">' + esc(l.asesor) + '</span>'}</div>
    ${detalle}
    <div class="ec-foot">
      <span class="chip ${cc}">${esc(l.canal)}</span>
      <span class="badge-st" style="color:${ESTADO_COLORS[l.estado] || '#8b93ad'};background:${(ESTADO_COLORS[l.estado] || '#8b93ad')}22">${niceEstado(l.estado)}</span>
      ${wa ? `<a class="wa-btn" href="https://wa.me/${wa}" target="_blank" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i></a>` : ''}
    </div>
  </div>`;
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

/* ---------- Drawer editable ---------- */
function openDrawer(l) {
  currentLead = l;
  const wa = l.telefono ? l.telefono.replace(/\D/g, '') : '';
  const av = clientAvatar(l);
  const opt = (arr, sel) => arr.map(v => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(niceEstado(v))}</option>`).join('');
  document.getElementById('drawerContent').innerHTML = `
    <div class="dhead"><div class="dava" style="background:${av.color}22;color:${av.color}"><i class="fas ${av.icon}"></i></div><div><div class="dn">${esc(l.nombre)}</div>
      <div class="dm">${esc(l.telefono) || 'Sin teléfono'} · ${esc(l.canal)}</div></div></div>

    <div class="edit-box">
      <div class="eb-title"><i class="fas fa-user-pen"></i> Datos del lead</div>
      <label class="fl">Nombre</label>
      <input id="e-nombre" class="ei" type="text" value="${esc(l.nombre || '')}">
      <label class="fl">Teléfono</label>
      <input id="e-telefono" class="ei" type="text" value="${esc(l.telefono || '')}">
      <label class="fl">Canal</label>
      <input id="e-canal" class="ei" type="text" value="${esc(l.canal || '')}">
      <label class="fl">Destino de interés</label>
      <input id="e-destino" class="ei" type="text" value="${esc(l.destino || '')}">
      <label class="fl">Consulta original</label>
      <input id="e-destino-consulta" class="ei" type="text" value="${esc(l.destino_consulta || '')}">
      <label class="fl">Personas</label>
      <input id="e-personas" class="ei" type="text" value="${esc(l.personas || '')}">
      <label class="fl">Fecha de captación</label>
      <input id="e-fecha" class="ei" type="date" value="${l.fecha_creacion ? l.fecha_creacion.slice(0, 10) : ''}">

      <div class="eb-title" style="margin-top:16px"><i class="fas fa-sliders"></i> Gestión</div>
      <label class="fl">Estado</label>
      <select id="e-estado" class="ei">${opt(ESTADOS_EDIT, ESTADOS_EDIT.includes(l.estado) ? l.estado : 'POR ATENDER')}</select>
      <label class="fl">Asesor asignado</label>
      <select id="e-asesor" class="ei" ${ROL === 'asesor' ? 'disabled' : ''}>${ROL === 'asesor' ? opt([MI_NOMBRE], MI_NOMBRE) : opt(['Sin asignar', ...ACTIVOS], ACTIVOS.includes(l.asesor) ? l.asesor : 'Sin asignar')}</select>
      <label class="fl">Servicio de interés</label>
      <select id="e-servicio" class="ei"><option value="">— sin definir —</option>${opt(SERVICIOS, l.servicio)}</select>
      <div id="venta-box" class="venta-box ${l.estado === VENTA ? 'show' : ''}">
        <label class="fl">Monto de la venta (USD)</label>
        <input id="e-monto" class="ei" type="number" min="0" step="1" placeholder="0" value="${l.monto ?? ''}">
        <label class="fl">Servicios / paquetes comprados</label>
        <input id="e-comprado" class="ei" type="text" placeholder="Ej: Vuelo + Hotel 3 noches" value="${esc(l.servicios_comprados || '')}">
      </div>
      <div class="edit-err" id="edit-err"></div>
      <button class="dbtn save" id="e-save"><i class="fas fa-floppy-disk"></i> Guardar cambios</button>
    </div>

    <div class="dactions">${wa ? `<a class="dbtn wa" href="https://wa.me/${wa}" target="_blank"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}</div>
    <div style="font-size:11px;color:var(--muted2);margin-top:14px;text-align:center">ID: ${esc(l.external_id || l.id)}</div>`;

  document.getElementById('e-estado').onchange = e => document.getElementById('venta-box').classList.toggle('show', e.target.value === VENTA);
  document.getElementById('e-save').onclick = guardarLead;
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBg').classList.add('open');
}
async function guardarLead() {
  const btn = document.getElementById('e-save'), err = document.getElementById('edit-err');
  const estado = val('e-estado'), asesor = val('e-asesor'), servicio = val('e-servicio');
  const montoRaw = val('e-monto').trim();
  if (estado === VENTA && (!montoRaw || !(parseFloat(montoRaw) > 0))) { err.textContent = 'Ingresa el monto de la venta (debe ser mayor a 0)'; return; }
  const nombre = val('e-nombre').trim();
  if (!nombre) { err.textContent = 'El nombre no puede quedar vacío'; return; }
  const monto = estado === VENTA ? parseFloat(montoRaw) : null;
  const comprado = estado === VENTA ? val('e-comprado').trim() : null;
  const fechaVal = val('e-fecha');
  err.textContent = ''; btn.disabled = true; btn.innerHTML = 'Guardando... <i class="fas fa-spinner fa-spin"></i>';
  const { data, error } = await sb.rpc('actualizar_lead', {
    p_lead_id: currentLead.id, p_estado: estado, p_asesor: asesor, p_monto: monto, p_servicio: servicio, p_servicios_comprados: comprado,
    p_nombre: nombre, p_telefono: val('e-telefono').trim(), p_canal: val('e-canal').trim(),
    p_destino: val('e-destino').trim(), p_destino_consulta: val('e-destino-consulta').trim(), p_personas: val('e-personas').trim(),
    p_fecha_creacion: fechaVal ? new Date(fechaVal + 'T12:00:00').toISOString() : null,
  });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar cambios';
  if (error || !data?.ok) { err.textContent = 'No se pudo guardar: ' + (error?.message || data?.error || ''); return; }
  window.closeDrawer();
  okToast('Lead actualizado');
  await loadStats(); renderAll(); loadTable(); loadDestPeriodo();
}
window.closeDrawer = () => { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerBg').classList.remove('open'); };
document.getElementById('dClose').onclick = window.closeDrawer;
document.getElementById('drawerBg').onclick = window.closeDrawer;

/* ---------- Métricas ---------- */
let metPeriodo = 'mes';
function setupMetricas() {
  document.querySelectorAll('#met-periodo .seg').forEach(b => b.onclick = () => { document.querySelectorAll('#met-periodo .seg').forEach(x => x.classList.remove('on')); b.classList.add('on'); metPeriodo = b.dataset.p; loadMetricas(); });
}
async function loadMetricas() {
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
  document.getElementById('met-kpis').innerHTML = cards.map(k => `<div class="kpi" style="--kc:${k.c};cursor:default"><div class="kt"><i class="fas ${k.i}"></i> ${k.t}</div><div class="kv">${k.v}</div></div>`).join('');
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

/* ---------- Reasignaciones ---------- */
let rgPage = 1;
const MOTIVO_LABEL = { timeout_no_respuesta: 'Timeout', manual_no_puedo: 'No puedo' };
function setupReasignaciones() {
  fill('rg-asesor', ACTIVOS);
  ['rg-asesor', 'rg-motivo', 'rg-desde', 'rg-hasta'].forEach(id => document.getElementById(id).addEventListener('change', () => { rgPage = 1; loadReasignaciones(); }));
  initDateRangePicker('rg');
  rgView = initViewSwitcher('rg-view-switch', 'reasignaciones', 'lista', v => { rgView = v; applyRgView(); });
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
  document.getElementById('reasig-kpis').innerHTML = [
    { t: 'Total reasignaciones', v: fmt(total), i: 'fa-shuffle', c: 'var(--accent)' },
    { t: 'Por timeout', v: fmt(kpi.timeout ?? 0), i: 'fa-clock', c: 'var(--blue)' },
    { t: 'Manual (No puedo)', v: fmt(kpi.manual ?? 0), i: 'fa-hand', c: 'var(--purple)' },
    { t: 'Sin asesor disponible', v: fmt(kAgotados), i: 'fa-triangle-exclamation', c: kAgotados > 0 ? '#ef4444' : 'var(--green)' },
  ].map(k => `<div class="kpi" style="--kc:${k.c};cursor:default"><div class="kt"><i class="fas ${k.i}"></i> ${k.t}</div><div class="kv">${k.v}</div></div>`).join('');
  if (!data.length) { empty.classList.add('show'); document.getElementById('rg-tbody').innerHTML = ''; document.getElementById('rg-cards').innerHTML = ''; document.getElementById('rg-pager').innerHTML = ''; return; }
  document.getElementById('rg-tbody').innerHTML = data.map(r => {
    const l = r.leads || {}, av = clientAvatar({ id: r.lead_id, telefono: l.telefono, nombre: l.nombre });
    const sinAsesor = !r.asesor_nuevo;
    return `<tr${sinAsesor ? ' style="background:rgba(239,68,68,.06)"' : ''}>
      <td class="td-name"><div class="lead-name"><div class="ln-ava" style="background:${av.color}22;color:${av.color}"><i class="fas ${av.icon}"></i></div>${esc(l.nombre || 'Sin nombre')}</div></td>
      <td data-label="Teléfono" class="muted">${esc(l.telefono) || '—'}</td>
      <td data-label="Destino">${esc(l.destino) || '—'}</td>
      <td data-label="De">${esc(r.asesor_anterior)}</td>
      <td data-label="A">${sinAsesor ? '<span style="color:#ef4444"><i class="fas fa-triangle-exclamation"></i> Sin asesor disponible</span>' : esc(r.asesor_nuevo)}</td>
      <td data-label="Motivo"><span class="chip">${MOTIVO_LABEL[r.motivo] || esc(r.motivo)}</span></td>
      <td data-label="Tiempo" class="muted">${r.minutos_transcurridos != null ? r.minutos_transcurridos + ' min' : '—'}</td>
      <td data-label="Fecha" class="muted">${r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '—'}</td>
    </tr>`;
  }).join('');
  document.getElementById('rg-cards').innerHTML = data.map(reasignCardHtml).join('');
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
      <span class="muted" style="font-size:11px">${r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '—'}</span>
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

/* ---------- Tarifario ---------- */
let tarTab = 'promo', tarCache = {}, tarInfo = null, tarView = 'tarjetas';
const TAR_TAB_LABEL = { destino: 'Guías/Tours', hotel: 'Hotel', paquete: 'Paquete', promo: 'Promoción' };
function setupTarifarioTabs() {
  fill('tar-f-destino', ['Margarita', 'Coche']);
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
  cargarTabsOcultas();
  setupTarAdmin();
}

/* ---------- Configuración de visibilidad de Tarifario (solo admin) ---------- */
const TAR_TAB_META = [
  { key: 'promo', label: 'Promociones' },
  { key: 'destino', label: 'Guías/Tours' },
  { key: 'hotel', label: 'Hoteles' },
  { key: 'paquete', label: 'Paquetes' },
];
let tabsOcultas = [];
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
  document.getElementById('tas-close').onclick = () => closeSheet('tar-admin-sheet');
  document.getElementById('tas-search').addEventListener('input', renderTasList);
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
async function loadTarifario() {
  loadTarifarioInfo();
  if (tarCache[tarTab]) { renderTarifario(); return; }
  const loading = document.getElementById('tar-loading'), empty = document.getElementById('tar-empty'), grid = document.getElementById('tar-grid');
  empty.classList.remove('show'); loading.classList.add('show'); grid.style.display = 'none';
  const q = tarTab === 'promo'
    ? sb.from('promociones').select('*, promocion_fotos(storage_path,orden), productos(producto_fotos(storage_path,orden))').order('titulo')
    : sb.from('productos').select('*, tarifas(*), promociones(titulo,precio_texto,precio_desde_usd,vigencia_texto,fecha_fin_estimada,incluye_tags,ninos_gratis_cantidad), producto_fotos(storage_path,orden)').eq('tipo', tarTab).order('nombre');
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
      const { data: hoteles } = await sb.from('productos').select('id, producto_fotos(storage_path,orden)').in('id', hotelIds);
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
const fotosDe = x => {
  const ordenar = arr => arr.slice().sort((a, b) => a.orden - b.orden).map(f => FOTOS_BASE + f.storage_path);
  const propias = ordenar(x.producto_fotos || x.promocion_fotos || []);
  if (propias.length) return propias;
  const heredadas = x.productos?.producto_fotos || x.hotel?.producto_fotos || [];
  return ordenar(heredadas);
};
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
function fotosRotadas(x) {
  const fotos = fotosDe(x);
  if (!fotos.length) return fotos;
  const idx = (x._portadaIdx || 0) % fotos.length;
  return idx ? [...fotos.slice(idx), ...fotos.slice(0, idx)] : fotos;
}

/* ---------- Carrusel de fotos al hover (hoteles/promos/paquetes vinculados) ---------- */
const carruselPrecargadas = new Set();
function precargarFotos(fotos) {
  fotos.forEach(u => { if (!carruselPrecargadas.has(u)) { new Image().src = u; carruselPrecargadas.add(u); } });
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
const DESTINO_ORDEN = ['Margarita', 'Coche'];
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

  const filtered = data.filter(x => {
    if (q && !(x.nombre || x.titulo || '').toLowerCase().includes(q) && !(x.destino || '').toLowerCase().includes(q)) return false;
    if (tarTab === 'hotel') {
      if (fDestino && x.destino !== fDestino) return false;
      const ag = agregarHotel(x);
      if (fTipo && !ag.tags.includes(fTipo)) return false;
      if (fPrecio != null && ag.precioMin != null && ag.precioMin > fPrecio) return false;
      if (fNinos && ag.ninosMax < 1) return false;
      if (fVigente && !ag.algunaVigente) return false;
    } else if (tarTab === 'promo') {
      if (fTipo && !(x.incluye_tags || []).includes(fTipo)) return false;
      if (fPrecio != null && x.precio_desde_usd != null && x.precio_desde_usd > fPrecio) return false;
      if (fNinos && !(x.ninos_gratis_cantidad > 0)) return false;
      if (fVigente && !promoVigente(x)) return false;
      if (fMes != null && !promoDisponibleEnMes(x, fMes)) return false;
    } else if (fPrecio != null) {
      const precioTarifa = (x.tarifas || [])[0]?.precio_desde_usd;
      if (precioTarifa != null && precioTarifa > fPrecio) return false;
    }
    return true;
  });
  // Orden por defecto de Promociones: más económicas primero. Sin precio
  // numérico parseado (solo texto libre tipo "Consultar") va al final, no
  // se le inventa un valor para ordenarlo.
  if (tarTab === 'promo') {
    filtered.sort((a, b) => {
      if (a.precio_desde_usd == null && b.precio_desde_usd == null) return 0;
      if (a.precio_desde_usd == null) return 1;
      if (b.precio_desde_usd == null) return -1;
      return a.precio_desde_usd - b.precio_desde_usd;
    });
    asignarPortadas(filtered);
  }

  document.getElementById('tar-count').textContent = `${fmt(filtered.length)} ítems`;
  document.getElementById('tar-empty').classList.toggle('show', filtered.length === 0);
  const grid = document.getElementById('tar-grid');
  if (tarTab === 'hotel') {
    const porDestino = {};
    filtered.forEach(x => (porDestino[x.destino || 'Otros'] ??= []).push(x));
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
    if (ROL === 'admin' && (tarTab === 'promo' ? x.revisado === false : x.activo === false)) {
      el.classList.add('tar-oculto-admin');
      el.insertAdjacentHTML('afterbegin', '<span class="tar-oculto-badge">Oculto</span>');
    }
    const fotos = fotosRotadas(x);
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
  const esPromo = tarTab === 'promo';
  const nombre = esPromo ? x.titulo : x.nombre;
  const foto = fotosRotadas(x)[0];
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
function tarCardThumbHtml(foto, esPromo) {
  const media = foto
    ? `<img class="tc-thumb" src="${esc(foto)}" alt="" loading="lazy">`
    : `<div class="tc-thumb tc-thumb-vacio"><i class="fas fa-${esPromo ? 'tag' : 'image'}"></i></div>`;
  return `<div class="tc-media-wrap">${media}<div class="carrusel-dots"></div></div>`;
}
function tarCardHtml(x) {
  if (tarTab === 'promo') {
    return `<div class="tar-item tar-card" data-id="${x.id}">
      ${tarCardThumbHtml(fotosRotadas(x)[0], true)}
      <div class="tc-top"><div class="tc-nombre">${esc(x.titulo)}</div></div>
      ${x.precio_texto ? `<div class="tc-precio">${esc(x.precio_texto)}</div>` : ''}
      ${x.vigencia_texto ? `<div class="tc-vigencia"><i class="fas fa-clock"></i> ${esc(x.vigencia_texto)}</div>` : ''}
      ${tagsHtml(x.incluye_tags)}</div>`;
  }
  const tarifa = (x.tarifas || [])[0];
  const promos = x.promociones || [];
  const tagsHotel = [...new Set(promos.flatMap(p => p.incluye_tags || []))];
  return `<div class="tar-item tar-card" data-id="${x.id}">
    ${tarCardThumbHtml(fotosDe(x)[0], false)}
    <div class="tc-top"><div><div class="tc-nombre">${esc(x.nombre)}</div>${x.destino ? `<div class="tc-destino"><i class="fas fa-location-dot"></i> ${esc(x.destino)}</div>` : ''}</div></div>
    <div class="tc-resumen">${esc(x.descripcion || '')}</div>
    ${tarifa ? `<div class="tc-precio">${esc(tarifa.precio_texto)}</div>` : ''}
    ${tarifa && tarifa.vigencia_texto ? `<div class="tc-vigencia"><i class="fas fa-clock"></i> ${esc(tarifa.vigencia_texto)}</div>` : ''}
    ${promos.length ? `<div class="tc-promos"><i class="fas fa-tag"></i> ${promos.length} promoción${promos.length > 1 ? 'es' : ''} activa${promos.length > 1 ? 's' : ''}</div>` : ''}
    ${tagsHtml(tagsHotel)}</div>`;
}
function tarFichaHtml(x) {
  const esPromo = tarTab === 'promo';
  const nombre = esPromo ? x.titulo : x.nombre;
  const foto = fotosRotadas(x)[0];
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
      ${!esPromo && x.descripcion ? `<div class="tc-resumen">${esc(x.descripcion)}</div>` : ''}
      ${precio ? `<div class="tc-precio">${esc(precio)}</div>` : ''}
      ${vigencia ? `<div class="tc-vigencia"><i class="fas fa-clock"></i> ${esc(vigencia)}</div>` : ''}
      ${promos.length ? `<div class="tc-promos"><i class="fas fa-tag"></i> ${promos.length} promoción${promos.length > 1 ? 'es' : ''} activa${promos.length > 1 ? 's' : ''}</div>` : ''}
      ${tagsHtml(tags)}
    </div>
  </div>`;
}
/* ---------- Galería (solo fotos, sin precios ni filtros) ---------- */
let galCargada = false;
async function loadGaleria() {
  if (galCargada) return;
  const loading = document.getElementById('gal-loading'), empty = document.getElementById('gal-empty'), list = document.getElementById('gal-list');
  empty.classList.remove('show'); loading.classList.add('show');
  const { data, error } = await sb.from('productos').select('nombre, producto_fotos(storage_path,orden)').eq('tipo', 'hotel').eq('activo', true).order('nombre');
  loading.classList.remove('show');
  if (error) { console.error(error); errToast('No se pudo cargar la galería'); return; }
  const conFotos = (data || []).filter(x => x.producto_fotos?.length);
  if (!conFotos.length) { empty.classList.add('show'); return; }
  galCargada = true;
  list.innerHTML = conFotos.map(x => {
    const fotos = x.producto_fotos.slice().sort((a, b) => a.orden - b.orden).map(f => FOTOS_BASE + f.storage_path);
    return `<div class="gal-hotel"><h3><i class="fas fa-hotel"></i> ${esc(x.nombre)}</h3>
      <div class="gal-masonry">${fotos.map(f => `<a href="${esc(f)}" target="_blank" rel="noopener"><img src="${esc(f)}" alt="${esc(x.nombre)}" loading="lazy"></a>`).join('')}</div>
    </div>`;
  }).join('');
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
  const esPromo = tarTab === 'promo';
  const nombre = esPromo ? x.titulo : x.nombre;
  const tarifa = !esPromo ? (x.tarifas || [])[0] : null;
  const precio = esPromo ? x.precio_texto : tarifa?.precio_texto;
  const vigencia = esPromo ? x.vigencia_texto : tarifa?.vigencia_texto;
  const fotos = fotosRotadas(x);
  document.getElementById('drawerContent').innerHTML = `
    <div class="dhead">${fotos[0] ? `<div class="dava" style="background-image:url('${esc(fotos[0])}')"></div>` : `<div class="dava" style="background:${ADV_COLORS[0]}22;color:${ADV_COLORS[0]}"><i class="fas fa-book-open"></i></div>`}<div><div class="dn">${esc(nombre)}</div>
      <div class="dm">${esc(x.destino || TAR_TAB_LABEL[tarTab])}</div></div></div>
    ${fotos.length ? `<div class="dgallery">${fotos.map(f => `<a href="${esc(f)}" target="_blank" rel="noopener"><img src="${esc(f)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}
    ${precio ? `<div class="dfield"><div class="dfi"><i class="fas fa-tag"></i></div><div><div class="dfl">Precio</div><div class="dfv dfv-rich">${formatearTexto(precio)}</div></div></div>` : ''}
    ${vigencia ? `<div class="dfield"><div class="dfi"><i class="fas fa-clock"></i></div><div><div class="dfl">Vigencia</div><div class="dfv dfv-rich">${formatearTexto(vigencia)}</div></div></div>` : ''}
    ${!esPromo && x.descripcion ? `<div class="dfield"><div class="dfi"><i class="fas fa-circle-info"></i></div><div><div class="dfl">Descripción</div><div class="dfv dfv-rich">${formatearTexto(x.descripcion)}</div></div></div>` : ''}
    ${!esPromo && x.requisitos ? `<div class="dfield"><div class="dfi"><i class="fas fa-triangle-exclamation"></i></div><div><div class="dfl">Requisitos</div><div class="dfv dfv-rich">${formatearTexto(x.requisitos)}</div></div></div>` : ''}
    ${esPromo ? tagsHtml(x.incluye_tags) : ''}
    ${!esPromo && (x.promociones || []).length ? `<div class="dfield"><div class="dfi"><i class="fas fa-gift"></i></div><div><div class="dfl">Promociones activas</div><div class="dfv" style="font-weight:500">${x.promociones.map(p => `<div style="margin-bottom:10px"><b>${esc(p.titulo)}</b>${p.precio_texto ? `<div class="dfv-rich" style="margin-top:4px">${formatearTexto(p.precio_texto)}</div>` : ''}${p.vigencia_texto ? `<div class="dfv-rich" style="margin-top:2px;color:var(--amber)">Vigencia: ${formatearTexto(p.vigencia_texto)}</div>` : ''}${tagsHtml(p.incluye_tags)}</div>`).join('')}</div></div></div>` : ''}
    <div class="dactions"><button class="dbtn gh" id="dCotizador"><i class="fas fa-comments"></i> Ir al Cotizador</button></div>
    <div style="font-size:11px;color:var(--muted2);margin-top:14px;text-align:center">Fuente: ${esc(x.fuente_archivo)}</div>`;
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBg').classList.add('open');
  document.getElementById('dCotizador').onclick = () => irAlCotizadorConOpcion(esPromo ? 'promociones' : 'productos', x.id, nombre);
}
// Deja al filtro "opción de Tarifario" del Cotizador ya elegida, con el
// chat enfocado y un mensaje sugerido, para no obligar a re-seleccionar
// lo mismo que ya se estaba viendo en el drawer del Tarifario.
function irAlCotizadorConOpcion(tabla, id, nombre) {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerBg').classList.remove('open');
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
}
function closeLightbox() {
  lbEl().classList.remove('open');
  document.body.classList.remove('lb-lock');
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
  document.getElementById('lbClose').onclick = closeLightbox;
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

/* ---------- Cotizador IA ---------- */
let chatHistory = [];
function setupChat() {
  const input = document.getElementById('chat-input');
  document.getElementById('chat-send').onclick = enviarChat;
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarChat(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  fill('cot-f-destino', DESTINO_ORDEN);
  cargarOpcionesTarifario();
  document.getElementById('cot-f-clear').onclick = () => {
    ['cot-f-destino', 'cot-f-tipo', 'cot-f-plan', 'cot-f-opcion', 'cot-f-precio', 'cot-f-desde', 'cot-f-hasta'].forEach(id => { document.getElementById(id).value = ''; });
  };
  if (!chatHistory.length) addChatBubble('bot', '¡Hola! Soy tu Cotizador IA de Lotus 360, estoy aquí para ayudarte en tus cotizaciones.');
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
  sel.innerHTML = '<option value="">Cualquier opción de Tarifario</option>' + TAR_TAB_META.map(t => grupos[t.key].length ? `<optgroup label="${esc(t.label)}">${grupos[t.key].map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</optgroup>` : '').join('');
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
  const texto = input.value.trim();
  if (!texto || btn.disabled) return;
  addChatBubble('user', texto);
  chatHistory.push({ role: 'user', content: texto });
  input.value = ''; input.style.height = 'auto';
  btn.disabled = true;
  const loadingEl = addChatBubble('bot', 'Pensando...', true);
  const { data, error } = await sb.functions.invoke('cotizador-chat', { body: { messages: chatHistory, filtros: leerFiltrosCotizador() } });
  loadingEl.remove();
  btn.disabled = false;
  if (error || !data?.respuesta) { addChatBubble('bot', 'No pude conectar con el cotizador, intenta de nuevo en un momento.'); return; }
  addChatBubble('bot', data.respuesta);
  chatHistory.push({ role: 'assistant', content: data.respuesta });
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

/* ---------- Realtime ---------- */
function subscribeRealtime() {
  sb.channel('leads-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, payload => {
    toast(payload.new);
    loadStats().then(() => { renderAll(); loadDestPeriodo(); });
    if (page === 1 && document.getElementById('sec-leads').classList.contains('active')) loadTable();
  }).subscribe();
}
function toast(l) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<i class="fas fa-bolt"></i> <div><b>Nuevo lead en vivo</b><br>${esc(l.nombre)} · ${esc(l.destino || '')}</div>`; document.getElementById('toasts').appendChild(t); setTimeout(() => t.classList.add('show'), 30); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 5200); }
function okToast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<i class="fas fa-check"></i> <div><b>${esc(msg)}</b></div>`; document.getElementById('toasts').appendChild(t); setTimeout(() => t.classList.add('show'), 30); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500); }
function errToast(msg) { const t = document.createElement('div'); t.className = 'toast toast-err'; t.innerHTML = `<i class="fas fa-triangle-exclamation"></i> <div><b>${esc(msg)}</b></div>`; document.getElementById('toasts').appendChild(t); setTimeout(() => t.classList.add('show'), 30); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 5000); }

/* ---------- Nav ---------- */
const BN_CORE_SECS = ['dashboard', 'leads', 'tarifario', 'cotizador'];
function activateSection(sec) {
  document.querySelectorAll('.nav-item,.bn-item').forEach(x => x.classList.toggle('active', x.dataset.sec === sec));
  document.getElementById('bn-more')?.classList.toggle('active', !BN_CORE_SECS.includes(sec));
  if (sheetAbierta) closeSheet(sheetAbierta);
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + sec).classList.add('active');
  const t = TITLES[sec] || TITLES.dashboard;
  document.getElementById('page-title').textContent = t[0];
  document.getElementById('page-sub').textContent = t[1];
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (sec === 'metricas') loadMetricas();
  if (sec === 'ranking') loadRanking();
  if (sec === 'reasignaciones') loadReasignaciones();
  if (sec === 'asistencia') loadAsistencia();
  if (sec === 'tarifario') loadTarifario();
  if (sec === 'galeria') loadGaleria();
  if (sec === 'asesores') loadAsesoresPeriodo();
  setTimeout(() => Object.values(charts).forEach(c => c && c.resize()), 60);
}
function setupNav() {
  document.querySelectorAll('.nav-item,.bn-item,.sheet-item').forEach(n => n.addEventListener('click', () => { if (n.dataset.sec) activateSection(n.dataset.sec); }));
  document.getElementById('bn-more')?.addEventListener('click', () => openSheet('more-sheet'));
  document.querySelectorAll('.mfs-trigger, .mfs-done').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.mfs;
    b.classList.contains('mfs-trigger') ? openSheet(id) : closeSheet(id);
  }));
}

/* ---------- Hoja inferior genérica (más opciones del nav, filtros en móvil) — un solo backdrop compartido, una hoja abierta a la vez ---------- */
let sheetAbierta = null;
function openSheet(id) {
  if (sheetAbierta && sheetAbierta !== id) closeSheet(sheetAbierta);
  document.getElementById(id)?.classList.add('open');
  document.getElementById('sheet-bg')?.classList.add('open');
  sheetAbierta = id;
}
function closeSheet(id) {
  document.getElementById(id)?.classList.remove('open');
  document.getElementById('sheet-bg')?.classList.remove('open');
  if (sheetAbierta === id) sheetAbierta = null;
}
document.getElementById('sheet-bg')?.addEventListener('click', () => { if (sheetAbierta) closeSheet(sheetAbierta); });
