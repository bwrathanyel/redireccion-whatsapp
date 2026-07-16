import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://begbjhrdbsqftbbleecb.supabase.co';
const FOTOS_BASE = SUPABASE_URL + '/storage/v1/object/public/tarifario-fotos/';
const SUPABASE_KEY = 'sb_publishable_M7Ms9DLwpNSCXZNCDhYtbQ_LhMYeLxk';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

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
const TITLES = { dashboard: ['Dashboard', 'Resumen general · Destino y Eventos Lotus 360'], leads: ['Leads', 'Base de datos de clientes y prospectos'], metricas: ['Métricas', 'Ventas, clientes nuevos y conversión'], ranking: ['Ranking de asesores', 'Desempeño del equipo comercial'], pipeline: ['Pipeline', 'Ciclo de vida del lead'], postventa: ['Postventa', 'Cobros, reservas, documentos y seguimiento del viaje'], asesores: ['Asesores', 'Carga de trabajo del equipo'], reasignaciones: ['Reasignaciones', 'Historial de leads reasignados por timeout o manualmente'], asistencia: ['Asistencia', 'Control de jornada y strikes del equipo'], 'informe-diario': ['Informe Diario', 'Resumen de cierre de jornada de cada asesor'], tarifario: ['Tarifario', 'Destinos, hoteles, paquetes y promociones vigentes'], cotizador: ['Cotizador IA', 'Cotiza con el tarifario vigente como base'], galeria: ['Galería', 'Fotos de promociones, hoteles, paquetes y guías/tours'], redes: ['Redes', 'Métricas de Instagram y análisis con IA'], extractor: ['Extractor IA', 'Pegá una conversación de WhatsApp y completá los datos del cliente'], mensajes: ['Mensajes', 'Chat interno del equipo — individual y grupo Comunidad'] };
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

let STATS = {}, page = 1, PER = 25, totalFiltered = 0;
let activeMonth = null, activeDestino = null, currentLead = null;
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
let booted = false, ROL = null, MI_NOMBRE = null, MI_USERNAME = null, MI_USUARIO_ID = null, JORNADA_ACTIVA = false, MI_AVATAR_URL = null, MI_PREFERENCIAS = {}, MI_VE_INFORME_DIARIO = false;
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
  const { data, error } = await sb.from('usuarios').select('id,username,nombre,rol,debe_cambiar_password,avatar_url,preferencias,ve_informe_diario').eq('id', user?.id).single();
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
  MI_NOMBRE = u.nombre; ROL = u.rol; MI_USERNAME = u.username; MI_USUARIO_ID = u.id;
  MI_AVATAR_URL = u.avatar_url; MI_PREFERENCIAS = u.preferencias || {}; MI_VE_INFORME_DIARIO = !!u.ve_informe_diario;
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
  pintarAvatar(document.getElementById('side-avatar'), MI_AVATAR_URL, MI_NOMBRE);
  document.getElementById('side-un-m').textContent = MI_NOMBRE;
  document.getElementById('side-ue-m').textContent = ROL === 'admin' ? 'Administrador' : 'Asesor comercial';
  pintarAvatar(document.getElementById('side-avatar-m'), MI_AVATAR_URL, MI_NOMBRE);
  // nav-admin-only ya oculta esto para asesores/marketing vía CSS (.rol-asesor) --
  // acá se ajusta el caso fino de que no todo admin ve Informe Diario, solo Luis Rueda.
  document.querySelectorAll('.solo-informe-diario').forEach(el => el.style.display = MI_VE_INFORME_DIARIO ? '' : 'none');
  aplicarPreferencias();
  renderJornadaUI();
  handleCheckIn();
  startApp();
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
  if (!MI_PREFERENCIAS.tutorial_visto && (ROL === 'admin' || ROL === 'asesor')) abrirMenuTutorial();
}

/* ---------- Mi Perfil (Bloque 8) — cada asesor edita solo lo propio ---------- */
const AVATAR_LIMITE = 3 * 1024 * 1024, AVATAR_MIME = ['image/png', 'image/jpeg', 'image/webp'];
function openPerfilDrawer() {
  document.getElementById('drawerContent').innerHTML = `
    <div class="dhead"><div class="dava" id="perfil-avatar-preview"></div>
      <div><div class="dn">${esc(MI_NOMBRE)}</div>
      <div class="dm">${ROL === 'admin' ? 'Administrador' : ROL === 'marketing' ? 'Marketing' : 'Asesor comercial'} · @${esc(MI_USERNAME)}</div></div></div>
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
    ${puedeActivarRecordatorios() ? `
    <div class="edit-box" style="margin-top:16px">
      <div class="eb-title"><i class="fas fa-bell"></i> Notificaciones</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <span style="font-size:13px">Recordatorios de asistencia</span>
        <button type="button" class="tas-toggle" id="perfil-notif-toggle"></button>
      </div>
    </div>` : ''}
    <div style="font-size:11px;color:var(--muted2);margin-top:14px;text-align:center">Solo vos podés ver y editar tu propio perfil</div>`;
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
  if (puedeActivarRecordatorios()) actualizarToggleNotif();
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
async function actualizarToggleNotif() {
  const btn = document.getElementById('perfil-notif-toggle');
  if (!btn) return;
  const { data, error } = await sb.rpc('mi_asistencia_hoy');
  const activo = !error && data?.tiene_recordatorios;
  btn.classList.toggle('on', !!activo);
  btn.onclick = async () => {
    btn.disabled = true;
    if (activo) await desactivarRecordatorios(); else await window.activarRecordatorios();
    btn.disabled = false;
    actualizarToggleNotif();
  };
}
async function desactivarRecordatorios() {
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
    console.error('desactivarRecordatorios', e);
    errToast('No se pudo desactivar los recordatorios');
    return;
  }
  okToast('Recordatorios desactivados');
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
function abrirResumenJornada() {
  if (ROL !== 'admin' && ROL !== 'asesor') return;
  document.getElementById('jornada-resumen-input').value = '';
  document.getElementById('jornada-resumen-ok').disabled = true;
  openSheet('jornada-resumen-sheet');
}
document.getElementById('jornada-resumen-input')?.addEventListener('input', (e) => {
  document.getElementById('jornada-resumen-ok').disabled = !e.target.value.trim();
});
document.getElementById('jornada-resumen-cancelar')?.addEventListener('click', (e) => {
  if (e.currentTarget.disabled) return; // envío en curso -- no se puede cancelar a mitad de camino
  closeSheet('jornada-resumen-sheet');
});
document.getElementById('jornada-resumen-ok')?.addEventListener('click', async () => {
  const btn = document.getElementById('jornada-resumen-ok');
  const cancelarBtn = document.getElementById('jornada-resumen-cancelar');
  const resumen = document.getElementById('jornada-resumen-input').value.trim();
  if (!resumen) return;
  btn.disabled = true; cancelarBtn.disabled = true; btn.innerHTML = 'Enviando... <i class="fas fa-spinner fa-spin"></i>';
  const { error } = await sb.rpc('agent_check_out', { p_resumen: resumen });
  btn.innerHTML = '<i class="fas fa-check"></i> Finalizar jornada';
  cancelarBtn.disabled = false;
  if (error) { btn.disabled = false; errToast('No se pudo cerrar la jornada: ' + error.message); return; }
  JORNADA_ACTIVA = false;
  renderJornadaUI();
  closeSheet('jornada-resumen-sheet');
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

function puedeActivarRecordatorios() {
  return (ROL === 'asesor' && !ASISTENCIA_USERNAMES_EXCLUIDOS.includes(MI_USERNAME)) || (ROL === 'admin' && GERENCIA_USERNAMES.includes(MI_USERNAME));
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

// Deep-link desde un app shortcut del manifest (?ir=leads|cotizador|tarifario)
const IR_SECCIONES = ['leads', 'postventa', 'cotizador', 'tarifario'];
function manejarDeepLinkSeccion() {
  const params = new URLSearchParams(location.search);
  const ir = params.get('ir');
  if (!IR_SECCIONES.includes(ir)) return;
  history.replaceState(null, '', location.pathname);
  activateSection(ir);
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
// `date` de Postgres (ej. "2026-07-11", SIN hora/offset) -- a propósito no pasa por
// Date()/timeZone: un date puro interpretado como hora local del navegador puede
// correrse un día en timezones lejanos a Caracas (ej. UTC+9 lo lee como el día
// anterior al reformatearlo). Se formatea directo de los componentes del string.
const fmtFechaSolo = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
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
  const selAsesor = document.getElementById('asist-hist-asesor');
  const prevSel = selAsesor.value;
  selAsesor.innerHTML = '<option value="">Todos los asesores</option>' + (hoy || []).map(a => `<option value="${a.usuario_id}">${esc(a.nombre)}</option>`).join('');
  if (prevSel && [...selAsesor.options].some(o => o.value === prevSel)) selAsesor.value = prevSel;
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
  if (error) { errToast('No se pudo cargar el Informe Diario'); return; }
  document.getElementById('informe-diario-tbody').innerHTML = (data || []).map(f => `
    <tr>
      <td data-label="Fecha" class="muted">${fmtFechaSolo(f.fecha)}</td>
      <td data-label="Asesor">${esc(f.nombre)}</td>
      <td data-label="Hora salida">${f.tiene_informe ? fmtHoraCaracas(f.hora_salida) : '<span class="asist-badge off">Sin informe</span>'}</td>
      <td data-label="Resumen">${f.tiene_informe ? esc(f.resumen) : '—'}</td>
    </tr>`).join('') || '<tr><td colspan="4">Sin registros</td></tr>';
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
  MI_NOMBRE = u.nombre; ROL = u.rol; MI_USERNAME = u.username; MI_USUARIO_ID = u.id;
  MI_AVATAR_URL = u.avatar_url; MI_PREFERENCIAS = u.preferencias || {}; MI_VE_INFORME_DIARIO = !!u.ve_informe_diario;
  entrarSegunRol();
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

// Ya no cierra la jornada acá (agent_check_out ahora exige resumen, Bloque 14)
// -- si queda activa, agent_check_in ya la cierra sola en el próximo login
// (mismo criterio que un refresh/cierre de pestaña sin logout, ver comentario
// arriba de agent_check_in).
window.cerrarSesion = async () => { await sb.auth.signOut(); location.reload(); };

async function startApp() {
  if (booted) return; booted = true;
  setupNav();
  setupTarifarioTabs();
  setupLightbox();
  setupChat();
  setupExtractor();
  setupMensajes();
  setupRedes();
  setupPostventa();
  setupTutorial();
  if (ROL === 'marketing') { activateSection('tarifario'); return; }
  if (ROL === 'asesor') activateSection('leads');
  await loadStats();
  ACTIVOS = Object.keys(STATS.by_advisor || {});
  renderAll();
  setupFilters();
  await loadTable();
  // No se llama loadInboxLeads() acá de nuevo -- activateSection('leads')
  // (arriba, para asesor) ya la dispara; llamarla dos veces corría 2 fetches
  // del mismo query en paralelo sin orden garantizado de resolución.
  setupMetricas(); setupRanking(); setupReasignaciones(); setupAsesoresPeriodo();
  setupDestPeriodo(); loadDestPeriodo();
  subscribeRealtime();
}
async function renderAll() { renderKPIs(); renderPipe('pipe'); renderPipe('pipe2'); renderAdvisors(); await ensureChart(); renderTrend(); renderCanal(); renderAssign(); }

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
  if (total < 0 || pagado < 0 || pagado > total) { err.textContent = 'El monto pagado no puede superar el total.'; return; }
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
  });
  btn.disabled = false; btn.innerHTML = previo;
  if (error || !data?.ok) { err.textContent = 'No se pudo guardar: ' + (error?.message || data?.error || 'error desconocido'); return; }
  window.closeDrawer(); okToast(marcarPagado ? 'Pago registrado y postventa actualizada' : 'Postventa actualizada');
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
  leadsView = initViewSwitcher('leads-view-switch', 'leads', window.innerWidth <= 760 ? 'tarjetas' : 'lista', v => { leadsView = v; applyLeadsView(); });
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
  let q = sb.from('leads').select('*', forCount ? { count: 'exact' } : {}).is('eliminado_at', null);
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
      <td data-label="Teléfono" class="muted">${esc(l.telefono) || '—'}${l.requiere_revision_telefono ? ' <i class="fas fa-flag" style="color:#ef4444" title="Número marcado para revisión"></i>' : ''}</td>
      <td data-label="Destino">${esc(l.destino)}</td>
      <td data-label="Canal"><span class="chip ${cc}">${esc(l.canal)}</span></td>
      <td data-label="Asesor">${l.asesor_activo ? esc(l.asesor) : '<span class="muted">' + esc(l.asesor) + '</span>'}</td>
      <td data-label="Estado"><span class="badge-st" style="color:${ESTADO_COLORS[l.estado] || '#8b93ad'};background:${(ESTADO_COLORS[l.estado] || '#8b93ad')}22">${esc(niceEstado(l.estado))}</span></td>
      <td data-label="Fecha" class="muted">${l.fecha_creacion ? l.fecha_creacion.slice(0, 10) : '—'}</td>
      <td class="td-wa">${wa ? `<a class="wa-btn" href="https://wa.me/${wa}" target="_blank" title="Abrir WhatsApp" aria-label="Abrir WhatsApp" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i></a>` : '<span class="muted">—</span>'}</td>
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
    <div class="ec-row"><i class="fas fa-clock"></i> ${l.fecha_creacion ? esc(l.fecha_creacion.slice(0, 16).replace('T', ' ')) : '—'}</div>
    <div class="ec-row"><i class="fas fa-user-tie"></i> ${l.asesor_activo ? esc(l.asesor) : '<span class="muted">' + esc(l.asesor) + '</span>'}</div>
    ${detalle}
    <div class="ec-foot">
      <span class="chip ${cc}">${esc(l.canal)}</span>
      <span class="badge-st" style="color:${ESTADO_COLORS[l.estado] || '#8b93ad'};background:${(ESTADO_COLORS[l.estado] || '#8b93ad')}22">${esc(niceEstado(l.estado))}</span>
      ${wa ? `<a class="wa-btn" href="https://wa.me/${wa}" target="_blank" title="Abrir WhatsApp" aria-label="Abrir WhatsApp" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i></a>` : ''}
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
    el.querySelector('.inbox-btn.nopuedo').addEventListener('click', e => { e.stopPropagation(); noPuedoInboxLead(l); });
    el.querySelector('.inbox-btn.avisar').addEventListener('click', e => { e.stopPropagation(); abrirAvisarTelefono(l); });
  });
  actualizarBadgeLeads(INBOX_LEADS.length);
}
function inboxCardHtml(l) {
  const av = clientAvatar(l);
  return `<div class="entity-card inbox-card" data-id="${l.id}">
    <div class="ec-top"><div class="ec-ava" style="background:${av.color}22;color:${av.color}"><i class="fas ${av.icon}"></i></div><div class="ec-nombre">${esc(l.nombre)}</div></div>
    <div class="ec-row"><i class="fas fa-phone"></i> ${esc(l.telefono) || 'Sin teléfono'}</div>
    <div class="ec-row"><i class="fas fa-location-dot"></i> ${esc(l.destino) || '—'}</div>
    ${l.destino_consulta ? `<div class="ec-row"><i class="fas fa-comment-dots"></i> ${esc(l.destino_consulta)}</div>` : ''}
    ${l.personas ? `<div class="ec-row"><i class="fas fa-users"></i> ${esc(l.personas)} persona(s)</div>` : ''}
    <div class="ec-row"><i class="fas fa-clock"></i> ${tiempoRelativo(l.fecha_creacion)}</div>
    <div class="inbox-actions">
      <button type="button" class="inbox-btn atender"><i class="fas fa-check"></i> Atender</button>
      <button type="button" class="inbox-btn nopuedo"><i class="fas fa-xmark"></i> No puedo</button>
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
async function noPuedoInboxLead(l) {
  // Vía Edge Function reasignar-lead (no RPC directo): además de reasignar
  // (misma reasignar_lead(), mismo check de ownership) dispara el push al
  // asesor nuevo -- si se llamara la RPC directo desde acá, ese aviso nunca
  // salía (solo lo disparan telegram-webhook/timeout-leads hoy).
  const { data, error } = await sb.functions.invoke('reasignar-lead', { body: { p_lead_id: l.id } });
  if (error) { errToast('No se pudo reasignar: ' + error.message); return; }
  if (data?.motivo === 'fuera_de_horario') { errToast('No se reasignan leads entre 9pm y 9am -- el lead sigue contigo'); return; }
  if (!data?.ok) { errToast('No se pudo reasignar: ' + (data?.motivo || data?.error || 'error desconocido')); return; }
  if (data.pool_agotado) { errToast('No hay más asesores disponibles por ahora -- el lead sigue contigo'); return; }
  quitarDeInbox(l.id);
  okToast('Lead reasignado a otro asesor');
}
function quitarDeInbox(leadId) {
  INBOX_LEADS = INBOX_LEADS.filter(x => x.id !== leadId);
  renderInbox();
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
function actualizarBadgeLeads(pendientes) {
  const d = document.getElementById('nav-lead-count'), m = document.getElementById('nav-lead-count-m');
  if (d) d.textContent = pendientes > 0 ? String(pendientes) : '—';
  if (m) { m.textContent = pendientes > 9 ? '9+' : String(pendientes); m.classList.toggle('show', pendientes > 0); }
  if ('setAppBadge' in navigator) { (pendientes > 0 ? navigator.setAppBadge(pendientes) : navigator.clearAppBadge()).catch(() => {}); }
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
      <label class="fl">Fecha de viaje (aprox.)</label>
      <input id="e-fecha-estimada" class="ei" type="text" placeholder="Ej: 15 de agosto, o del 10 al 15/09" value="${esc(l.fecha_estimada || '')}">
      <label class="fl">Presupuesto (USD)</label>
      <input id="e-presupuesto" class="ei" type="number" min="0" step="1" placeholder="Sin definir" value="${l.presupuesto ?? ''}">
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

    <div class="dactions">
      ${wa ? `<a class="dbtn wa" href="https://wa.me/${wa}" target="_blank"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}
      <button class="dbtn extractor" id="e-a-extractor" type="button"><i class="fas fa-wand-magic-sparkles"></i> Extractor IA</button>
      ${ROL === 'admin' ? `<button class="dbtn" id="e-a-eliminar" type="button" style="background:#ef444422;color:#ef4444"><i class="fas fa-trash"></i> Eliminar lead</button>` : ''}
    </div>
    <div style="font-size:11px;color:var(--muted2);margin-top:14px;text-align:center">ID: ${esc(l.external_id || l.id)}</div>`;

  document.getElementById('e-estado').onchange = e => document.getElementById('venta-box').classList.toggle('show', e.target.value === VENTA);
  document.getElementById('e-save').onclick = guardarLead;
  document.getElementById('e-a-extractor').onclick = () => irAExtractor(l);
  if (ROL === 'admin') document.getElementById('e-a-eliminar').onclick = () => openSheet('confirm-delete-lead-sheet');
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBg').classList.add('open');
  navPush({ type: 'drawer' });
}
document.getElementById('confirm-delete-lead-cancel')?.addEventListener('click', () => closeSheet('confirm-delete-lead-sheet'));
document.getElementById('confirm-delete-lead-ok')?.addEventListener('click', async () => {
  if (!currentLead) return;
  const btn = document.getElementById('confirm-delete-lead-ok');
  btn.disabled = true; btn.innerHTML = 'Eliminando... <i class="fas fa-spinner fa-spin"></i>';
  const { data, error } = await sb.rpc('eliminar_lead', { p_lead_id: currentLead.id });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
  if (error || !data?.ok) { errToast('No se pudo eliminar: ' + (error?.message || data?.error || '')); return; }
  // La hoja de confirmación quedó apilada arriba del drawer (openSheet
  // empujó su propia entrada de historial) — se descarta esa entrada a
  // mano en vez de sumar un history.back() extra, así el cierre de
  // ambos overlays consume un solo history.back() (el del drawer).
  if (NAV_STACK[NAV_STACK.length - 1]?.type === 'sheet') NAV_STACK.pop();
  closeSheet('confirm-delete-lead-sheet', true);
  window.closeDrawer();
  okToast('Lead eliminado');
  await loadStats(); renderAll(); loadTable(); loadDestPeriodo();
});
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
  const presupuestoRaw = val('e-presupuesto').trim();
  err.textContent = ''; btn.disabled = true; btn.innerHTML = 'Guardando... <i class="fas fa-spinner fa-spin"></i>';
  const { data, error } = await sb.rpc('actualizar_lead', {
    p_lead_id: currentLead.id, p_estado: estado, p_asesor: asesor, p_monto: monto, p_servicio: servicio, p_servicios_comprados: comprado,
    p_nombre: nombre, p_telefono: val('e-telefono').trim(), p_canal: val('e-canal').trim(),
    p_destino: val('e-destino').trim(), p_destino_consulta: val('e-destino-consulta').trim(), p_personas: val('e-personas').trim(),
    p_fecha_creacion: fechaVal ? new Date(fechaVal + 'T12:00:00').toISOString() : null,
    p_fecha_estimada: val('e-fecha-estimada').trim(), p_presupuesto: presupuestoRaw ? parseFloat(presupuestoRaw) : null,
  });
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar cambios';
  if (error || !data?.ok) { err.textContent = 'No se pudo guardar: ' + (error?.message || data?.error || ''); return; }
  window.closeDrawer();
  okToast('Lead actualizado');
  await loadStats(); renderAll(); loadTable(); loadDestPeriodo();
}
window.closeDrawer = (fromNav) => { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerBg').classList.remove('open'); if (!fromNav) navConsume(); };
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

/* ---------- Redes (Instagram) ---------- */
let redesPeriodo = '30d', redesChatHistory = [];
function setupRedes() {
  document.querySelectorAll('#redes-periodo .seg').forEach(b => b.onclick = () => { document.querySelectorAll('#redes-periodo .seg').forEach(x => x.classList.remove('on')); b.classList.add('on'); redesPeriodo = b.dataset.p; loadRedes(); });
  const input = document.getElementById('redes-chat-input');
  document.getElementById('redes-chat-send').onclick = enviarChatRedes;
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarChatRedes(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  addChatBubbleRedes('bot', 'Hola, soy el analista de redes. Preguntame sobre el alcance, los posts con mejor desempeño o las historias del período seleccionado.');
}
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
  document.getElementById('redes-kpis').innerHTML = cards.map(k => `<div class="kpi" style="--kc:${k.c};cursor:default"><div class="kt"><i class="fas ${k.i}"></i> ${k.t}</div><div class="kv">${k.v}</div></div>`).join('');
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
const tarDestinosAbiertos = new Set();
const TAR_TAB_LABEL = { destino: 'Guías/Tours', hotel: 'Hotel', paquete: 'Paquete', promo: 'Promoción' };
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
  setupTarAdmin();
}

/* ---------- Configuración de visibilidad de Tarifario (solo admin) ---------- */
const TAR_TAB_META = [
  { key: 'promo', label: 'Promociones' },
  { key: 'destino', label: 'Guías/Tours' },
  { key: 'hotel', label: 'Hoteles' },
  { key: 'paquete', label: 'Paquetes' },
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
async function loadTarifario() {
  loadTarifarioInfo();
  if (tarCache[tarTab]) { renderTarifario(); return; }
  const loading = document.getElementById('tar-loading'), empty = document.getElementById('tar-empty'), grid = document.getElementById('tar-grid');
  empty.classList.remove('show'); loading.classList.add('show'); grid.style.display = 'none';
  const q = tarTab === 'promo'
    ? sb.from('promociones').select('*, promocion_fotos(storage_path,orden,es_principal,activo), productos(destino,producto_fotos(storage_path,orden,es_principal,activo))').order('titulo')
    : sb.from('productos').select('*, tarifas(*), promociones(titulo,precio_texto,precio_desde_usd,vigencia_texto,fecha_fin_estimada,incluye_tags,ninos_gratis_cantidad), producto_fotos(storage_path,orden,es_principal,activo)').eq('tipo', tarTab).order('nombre');
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
const fotosDe = x => fotosRaw(x).map(f => FOTOS_BASE + f.storage_path);
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
function fotosRotadas(x) {
  const fotos = fotosDe(x);
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
  if (tarTab === 'promo') return x.productos?.destino || null;
  if (tarTab === 'paquete') return x.destino || x.hotel?.destino || null;
  return x.destino || null;
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
      if (fDestino && destinoDe(x) !== fDestino) return false;
      if (fTipo && !(x.incluye_tags || []).includes(fTipo)) return false;
      if (fPrecio != null && x.precio_desde_usd != null && x.precio_desde_usd > fPrecio) return false;
      if (fNinos && !(x.ninos_gratis_cantidad > 0)) return false;
      if (fVigente && !promoVigente(x)) return false;
      if (fMes != null && !promoDisponibleEnMes(x, fMes)) return false;
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
  } else if (tarTab === 'promo' || tarTab === 'paquete') {
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
    <ul class="tc-resumen">${resumenBullets(x.descripcion).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
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
      ${!esPromo && x.descripcion ? `<ul class="tc-resumen tc-resumen-ficha">${resumenBullets(x.descripcion).map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      ${precio ? `<div class="tc-precio">${esc(precio)}</div>` : ''}
      ${vigencia ? `<div class="tc-vigencia"><i class="fas fa-clock"></i> ${esc(vigencia)}</div>` : ''}
      ${promos.length ? `<div class="tc-promos"><i class="fas fa-tag"></i> ${promos.length} promoción${promos.length > 1 ? 'es' : ''} activa${promos.length > 1 ? 's' : ''}</div>` : ''}
      ${tagsHtml(tags)}
    </div>
  </div>`;
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
        const dims = f.width && f.height ? ` width="${f.width}" height="${f.height}"` : '';
        return `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="${esc(nombreDe(x))}" loading="lazy"${dims}></a>`;
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
    ${ROL === 'admin' ? `
    <div class="edit-box" style="margin-top:16px">
      <div class="eb-title"><i class="fas fa-note-sticky"></i> Notas internas (solo admin)</div>
      <textarea id="tar-notas" class="ei" rows="3" placeholder="Notas propias, no vienen del tarifario automático...">${esc(x.notas || '')}</textarea>
      <button class="dbtn save" id="tar-notas-save" type="button" style="margin-top:8px"><i class="fas fa-floppy-disk"></i> Guardar notas</button>
      <div class="eb-title" style="margin-top:16px"><i class="fas fa-images"></i> Fotos (solo admin)</div>
      <div id="tar-fotos-admin"><div class="muted" style="font-size:12.5px">Cargando...</div></div>
    </div>` : ''}
    <div class="dactions"><button class="dbtn gh" id="dCotizador"><i class="fas fa-comments"></i> Ir al Cotizador</button></div>
    <div style="font-size:11px;color:var(--muted2);margin-top:14px;text-align:center">Fuente: ${esc(x.fuente_archivo)}</div>`;
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBg').classList.add('open');
  navPush({ type: 'drawer' });
  document.getElementById('dCotizador').onclick = () => irAlCotizadorConOpcion(esPromo ? 'promociones' : 'productos', x.id, nombre);
  if (ROL === 'admin') {
    document.getElementById('tar-notas-save').onclick = () => guardarNotasTarifario(esPromo ? 'promociones' : 'productos', x.id);
    cargarFotosAdmin(esPromo ? 'promocion_fotos' : 'producto_fotos', esPromo ? 'promocion_id' : 'producto_id', x.id, esPromo ? 'promos' : 'hoteles');
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
  delete tarCache[tarTab];
}
const TAR_FOTOS_LIMITE = 5 * 1024 * 1024, TAR_FOTOS_MIME = ['image/png', 'image/jpeg', 'image/webp'];
function slugArchivo(nombre) {
  return nombre.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'foto';
}
async function cargarFotosAdmin(tabla, fk, entidadId, prefijo) {
  const box = document.getElementById('tar-fotos-admin');
  const { data, error } = await sb.from(tabla).select('id,storage_path,orden,es_principal').eq(fk, entidadId).eq('activo', true).order('es_principal', { ascending: false }).order('orden');
  if (!box) return; // el drawer se pudo haber cerrado mientras esto cargaba
  if (error) { box.innerHTML = '<div class="muted" style="font-size:12.5px">No se pudieron cargar las fotos</div>'; return; }
  if (!data.length) { box.innerHTML = '<div class="muted" style="font-size:12.5px">Esta opción no tiene fotos cargadas todavía.</div>'; return; }
  box.innerHTML = `<div class="tar-fotos-admin-grid">${data.map(f => `
    <div class="tfa-item" data-foto-id="${f.id}">
      <div class="tfa-img" style="background-image:url('${esc(FOTOS_BASE + f.storage_path)}')">${f.es_principal ? '<span class="tfa-principal-badge"><i class="fas fa-star"></i> Principal</span>' : ''}</div>
      <div class="tfa-actions">
        ${f.es_principal ? '' : `<button type="button" class="tfa-btn" data-accion="principal" title="Marcar como principal"><i class="fas fa-star"></i></button>`}
        <button type="button" class="tfa-btn" data-accion="reemplazar" title="Reemplazar imagen"><i class="fas fa-rotate"></i></button>
      </div>
    </div>`).join('')}</div>
    <input type="file" id="tar-foto-file" accept="image/png,image/jpeg,image/webp" style="display:none">`;
  box.querySelectorAll('[data-accion="principal"]').forEach(btn => btn.onclick = () => marcarFotoPrincipal(tabla, fk, entidadId, +btn.closest('.tfa-item').dataset.fotoId, prefijo));
  box.querySelectorAll('[data-accion="reemplazar"]').forEach(btn => btn.onclick = () => {
    const fotoId = +btn.closest('.tfa-item').dataset.fotoId;
    const input = document.getElementById('tar-foto-file');
    input.onchange = () => { if (input.files[0]) reemplazarFoto(tabla, fk, entidadId, fotoId, prefijo, input.files[0]); input.value = ''; };
    input.click();
  });
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
  // La vieja se desactiva Y pierde es_principal ANTES de insertar la nueva —
  // el índice único parcial (una sola es_principal por producto/promoción)
  // rechaza el insert si las dos filas quedan marcadas principal a la vez.
  const { error: eDesactivar } = await sb.from(tabla).update({ activo: false, reemplazada_en: new Date().toISOString(), es_principal: false }).eq('id', fotoIdViejo);
  if (eDesactivar) {
    box.style.opacity = '1';
    await sb.storage.from('tarifario-fotos').remove([storagePath]);
    errToast('No se pudo desactivar la imagen anterior: ' + eDesactivar.message);
    return;
  }
  const { error: eInsert } = await sb.from(tabla).insert({ [fk]: entidadId, storage_path: storagePath, orden: vieja.orden, es_principal: vieja.es_principal, origen: 'manual' });
  if (eInsert) {
    box.style.opacity = '1';
    await sb.storage.from('tarifario-fotos').remove([storagePath]);
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
  list.innerHTML = data.map(c => `<div class="strike-row" data-id="${c.id}" style="cursor:pointer"><span>${esc(c.titulo || 'Conversación')}<br><span class="muted" style="font-size:11px">${c.updated_at.slice(0, 16).replace('T', ' ')}</span></span><i class="fas fa-chevron-right"></i></div>`).join('');
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
  chatHistory.push({ role: 'assistant', content: data.respuesta });
  await guardarChatIA();
}
// Mismo patrón que mensajeErrorExtraccion (ver setupExtractor más abajo):
// con status no-2xx supabase-js deja `data` en null y el body real queda en
// `error.context`.
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
    sin_mensajes: 'Escribí un mensaje antes de enviar.',
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

/* ---------- Extractor IA ---------- */
// El extractor siempre opera sobre un lead YA existente (nunca crea uno
// nuevo, eso ya lo hace ingest_lead vía ManyChat) — o llega preseleccionado
// desde el botón de una ficha (irAExtractor) o el asesor lo busca acá mismo.
// extractorLeadObjetivo guarda la FILA COMPLETA del lead (no solo id/nombre)
// para poder precargar en la previsualización el valor actual de cualquier
// campo que la IA no haya encontrado (ver renderExtractorPreview).
const EXT_CAMPOS = ['nombre', 'telefono', 'canal', 'destino', 'destino_consulta', 'personas', 'fecha_estimada', 'presupuesto'];
const extIdCampo = campo => 'ext-e-' + campo.replace(/_/g, '-');
let extractorLeadObjetivo = null, extractorDatos = null, extractorBusy = false, extractorBuscarSeq = 0, extractorBuscarTimer = null;
function irAExtractor(lead) {
  extractorLeadObjetivo = lead;
  window.closeDrawer(true);
  activateSection('extractor');
  descartarExtraccion();
  renderExtractorTarget();
}
function setupExtractor() {
  const searchInput = document.getElementById('ext-search-input');
  searchInput.addEventListener('input', () => {
    clearTimeout(extractorBuscarTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) { document.getElementById('ext-search-results').innerHTML = ''; return; }
    extractorBuscarTimer = setTimeout(() => buscarLeadsExtractor(q), 300);
  });
  document.getElementById('ext-target-clear').onclick = () => { extractorLeadObjetivo = null; descartarExtraccion(); renderExtractorTarget(); };
  document.getElementById('ext-chat-input').addEventListener('input', actualizarContadorExtractor);
  attachVoiceInput(document.getElementById('ext-mic-btn'), document.getElementById('ext-chat-input'));
  document.getElementById('ext-extraer-btn').onclick = extraerDatosChat;
  document.getElementById('ext-aplicar-btn').onclick = aplicarDatosExtraidos;
  document.getElementById('ext-descartar-btn').onclick = descartarExtraccion;
  renderExtractorTarget();
}
// Deshabilita cambiar/buscar lead mientras hay una llamada en curso (extraer
// o aplicar) — sin esto, el asesor puede cambiar de lead objetivo a mitad de
// una extracción y terminar aplicando el chat de un cliente sobre otro lead.
function actualizarControlesExtractor() {
  document.getElementById('ext-target-clear').disabled = extractorBusy;
  document.getElementById('ext-search-input').disabled = extractorBusy;
}
function renderExtractorTarget() {
  const fixed = document.getElementById('ext-target-fixed'), search = document.getElementById('ext-target-search');
  if (extractorLeadObjetivo) {
    document.getElementById('ext-target-nombre').textContent = extractorLeadObjetivo.nombre;
    fixed.classList.add('show');
    search.classList.add('hide');
  } else {
    fixed.classList.remove('show');
    search.classList.remove('hide');
    document.getElementById('ext-search-input').value = '';
    document.getElementById('ext-search-results').innerHTML = '';
  }
  document.getElementById('ext-chat-input').disabled = !extractorLeadObjetivo;
  document.getElementById('ext-mic-btn').disabled = !extractorLeadObjetivo;
  actualizarControlesExtractor();
  actualizarBotonExtraer();
}
async function buscarLeadsExtractor(q) {
  const seq = ++extractorBuscarSeq;
  const qSafe = q.replace(/[,()%]/g, '');
  const box = document.getElementById('ext-search-results');
  if (qSafe.length < 2) { box.innerHTML = ''; return; } // tras sacar caracteres especiales, un patrón vacío/de 1 char matchearía cualquier lead
  const { data, error } = await sb.from('leads').select('*').or(`nombre.ilike.%${qSafe}%,telefono.ilike.%${qSafe}%`).limit(8);
  if (seq !== extractorBuscarSeq) return; // llegó una búsqueda más nueva mientras esperábamos esta
  if (error) { box.innerHTML = ''; return; }
  if (!data.length) { box.innerHTML = '<div class="ext-search-row"><span class="esr-n">Sin resultados</span></div>'; return; }
  box.innerHTML = data.map(l => `<div class="ext-search-row" data-id="${l.id}"><span class="esr-n">${esc(l.nombre)}</span><span class="esr-m">${esc(l.telefono || 'Sin teléfono')}${l.destino ? ' · ' + esc(l.destino) : ''}</span></div>`).join('');
  box.querySelectorAll('[data-id]').forEach((el, i) => el.onclick = () => { extractorLeadObjetivo = data[i]; renderExtractorTarget(); });
}
function actualizarContadorExtractor() {
  const len = document.getElementById('ext-chat-input').value.length;
  const counter = document.getElementById('ext-counter');
  counter.textContent = `${fmt(len)} / 20.000`;
  counter.classList.toggle('over', len > 20000);
  actualizarBotonExtraer();
}
function actualizarBotonExtraer() {
  const len = document.getElementById('ext-chat-input').value.trim().length;
  document.getElementById('ext-extraer-btn').disabled = extractorBusy || !extractorLeadObjetivo || !len || len > 20000;
}
// El body de error de la Edge Function SOLO llega en data cuando la respuesta
// es 2xx — con status no-2xx (400/401/502/503/504, que es como responde
// SIEMPRE parse-chat-lead en sus casos de error) supabase-js deja `data` en
// null y expone el body real en `error.context` (el Response crudo).
async function mensajeErrorExtraccion(data, error) {
  let code = data?.error;
  if (!code && error?.context?.json) {
    try { code = (await error.context.json())?.error; } catch { /* body no era JSON, se usa el mensaje genérico */ }
  }
  const MSG = {
    timeout_ia: 'La IA tardó demasiado en responder, intenta de nuevo.',
    error_ia: 'No se pudo conectar con la IA, intenta de nuevo en un momento.',
    sin_respuesta: 'La IA no devolvió una respuesta, intenta de nuevo.',
    json_invalido: 'La IA devolvió una respuesta inválida, intenta de nuevo.',
    texto_muy_largo: 'El texto es muy largo (máximo 20.000 caracteres).',
    sin_texto: 'Pegá el texto del chat antes de extraer.',
    no_autenticado: 'Tu sesión expiró, volvé a iniciar sesión.',
    no_configurado: 'El extractor no está disponible en este momento.',
    body_invalido: 'Ocurrió un error inesperado, intenta de nuevo.',
    metodo_no_permitido: 'Ocurrió un error inesperado, intenta de nuevo.',
  };
  return MSG[code] || 'No se pudo extraer los datos, intenta de nuevo.';
}
async function extraerDatosChat() {
  const btn = document.getElementById('ext-extraer-btn'), err = document.getElementById('ext-input-err');
  const chatText = document.getElementById('ext-chat-input').value.trim();
  err.textContent = '';
  if (!extractorLeadObjetivo || !chatText) return;
  const leadIdAlPedir = extractorLeadObjetivo.id;
  extractorBusy = true; actualizarControlesExtractor();
  btn.disabled = true; btn.innerHTML = 'Extrayendo... <i class="fas fa-spinner fa-spin"></i>';
  const { data, error } = await sb.functions.invoke('parse-chat-lead', { body: { chat_text: chatText } });
  extractorBusy = false; actualizarControlesExtractor();
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Extraer datos';
  // Con los controles de cambio de lead deshabilitados mientras extractorBusy
  // esto no debería poder pasar, pero se valida igual antes de mostrar datos
  // que quedaron pedidos para un lead que ya no es el objetivo actual.
  if (!extractorLeadObjetivo || extractorLeadObjetivo.id !== leadIdAlPedir) {
    err.textContent = 'El lead objetivo cambió mientras se procesaba — los datos extraídos se descartaron, intenta de nuevo.';
    return;
  }
  if (error || !data?.ok) { err.textContent = await mensajeErrorExtraccion(data, error); return; }
  extractorDatos = data.datos;
  renderExtractorPreview();
}
// Precarga cada campo con lo que extrajo la IA, o si la IA no encontró ese
// dato, con el valor ACTUAL del lead (nunca lo deja en blanco a menos que el
// lead tampoco lo tuviera) — así lo que se ve acá es exactamente lo que va a
// quedar guardado al aplicar, sin sorpresas (actualizar_lead conserva el
// valor viejo en cualquier campo que llegue vacío, igual que en la ficha).
function renderExtractorPreview() {
  const d = extractorDatos, lead = extractorLeadObjetivo;
  for (const campo of EXT_CAMPOS) {
    document.getElementById(extIdCampo(campo)).value = (d[campo] ?? lead[campo]) ?? '';
  }
  document.getElementById('ext-aplicar-nombre').textContent = lead.nombre;
  const box = document.getElementById('ext-preview-box');
  box.style.display = 'block';
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function leerCamposExtractor() {
  const out = {};
  for (const campo of EXT_CAMPOS) out[campo] = val(extIdCampo(campo)).trim();
  return out;
}
function descartarExtraccion() {
  extractorDatos = null;
  document.getElementById('ext-preview-box').style.display = 'none';
  document.getElementById('ext-chat-input').value = '';
  document.getElementById('ext-input-err').textContent = '';
  actualizarContadorExtractor();
}
// Sobrescribe SIEMPRE los 8 campos con lo que quedó en la previsualización
// (editable por el asesor antes de este punto) — decisión confirmada: la
// revisión previa ya es la red de seguridad, no hay merge campo por campo.
async function aplicarDatosExtraidos() {
  const btn = document.getElementById('ext-aplicar-btn'), err = document.getElementById('ext-err');
  const campos = leerCamposExtractor();
  if (!campos.nombre) { err.textContent = 'El nombre no puede quedar vacío'; return; }
  const leadId = extractorLeadObjetivo.id;
  const presupuesto = campos.presupuesto ? parseFloat(campos.presupuesto) : null;
  err.textContent = ''; extractorBusy = true; actualizarControlesExtractor();
  btn.disabled = true; btn.innerHTML = 'Aplicando... <i class="fas fa-spinner fa-spin"></i>';
  const rpcParams = { p_lead_id: leadId };
  for (const campo of EXT_CAMPOS) rpcParams['p_' + campo] = campo === 'presupuesto' ? presupuesto : campos[campo];
  const { data, error } = await sb.rpc('actualizar_lead', rpcParams);
  extractorBusy = false; actualizarControlesExtractor();
  btn.disabled = false; btn.innerHTML = `<i class="fas fa-check"></i> Aplicar a <span id="ext-aplicar-nombre">${esc(extractorLeadObjetivo?.nombre ?? '')}</span>`;
  if (error || !data?.ok) { err.textContent = 'No se pudo aplicar: ' + (error?.message || data?.error || ''); return; }
  okToast('Lead actualizado con los datos extraídos');
  const leadActualizado = { ...extractorLeadObjetivo, ...campos, presupuesto };
  extractorLeadObjetivo = null;
  descartarExtraccion();
  renderExtractorTarget();
  loadStats().then(() => renderAll()); loadTable(); loadDestPeriodo();
  openDrawer(leadActualizado);
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
    const preview = um?.es_mio ? 'Vos: ' + cuerpo : cuerpo;
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
  if (error || !data?.ok) { errToast('No se pudo enviar el mensaje'); return; }
  // El eco de este INSERT también llega por el canal realtime de la conversación (suscribirConversacion);
  // ese handler ya chequea por id antes de empujar, así que este push optimista no duplica la burbuja.
  if (!msgMensajes.some(m => m.id === data.id)) {
    msgMensajes.push({ id: data.id, conversacion_id: msgActual.conversacion_id, remitente_id: MI_USUARIO_ID, tipo: 'texto', contenido: texto, created_at: new Date().toISOString() });
    renderConversacion();
  }
}
async function subirAdjunto(file) {
  if (!msgActual) return;
  if (file.size > ADJUNTO_LIMITE) { errToast('El archivo supera los 20MB — achicalo antes de subirlo'); return; }
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
}

/* ---------- Realtime ---------- */
function subscribeRealtime() {
  sb.channel('leads-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, payload => {
      toast(payload.new);
      loadStats().then(() => { renderAll(); loadDestPeriodo(); });
      if (page === 1 && document.getElementById('sec-leads').classList.contains('active')) loadTable();
      if (ROL === 'asesor') recibirLeadNuevoInbox(payload.new);
    })
    // RLS ya filtra este evento a leads propios -- si uno deja de estar
    // pendiente por otra vía (ej. lo editan a mano en el drawer/tabla), sale
    // del inbox sin esperar un refresh manual.
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, payload => {
      if (ROL === 'asesor' && INBOX_LEADS.some(x => x.id === payload.new.id)
          && (payload.new.estado !== 'POR ATENDER' || payload.new.fecha_primer_contacto || payload.new.eliminado_at)) quitarDeInbox(payload.new.id);
      if (document.getElementById('sec-postventa')?.classList.contains('active')) loadPostventa();
    })
    .subscribe();
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
  if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted' && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification('Nuevo lead — ' + (lead.destino || 'sin destino'), {
      body: `${lead.nombre} · ${lead.telefono || ''}`, icon: './icons/icon-192.png',
    }));
  }
}
function toast(l) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<i class="fas fa-bolt"></i> <div><b>Nuevo lead en vivo</b><br>${esc(l.nombre)} · ${esc(l.destino || '')}</div>`; document.getElementById('toasts').appendChild(t); setTimeout(() => t.classList.add('show'), 30); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 5200); }
function okToast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<i class="fas fa-check"></i> <div><b>${esc(msg)}</b></div>`; document.getElementById('toasts').appendChild(t); setTimeout(() => t.classList.add('show'), 30); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500); }
function errToast(msg) { const t = document.createElement('div'); t.className = 'toast toast-err'; t.innerHTML = `<i class="fas fa-triangle-exclamation"></i> <div><b>${esc(msg)}</b></div>`; document.getElementById('toasts').appendChild(t); setTimeout(() => t.classList.add('show'), 30); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 5000); }
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
});

/* ---------- Nav ---------- */
const BN_CORE_SECS = ['dashboard', 'leads', 'mensajes', 'extractor', 'tarifario', 'cotizador'];
let currentSec = null;
function activateSection(sec, fromNav) {
  if (currentSec === sec) return;
  if (!fromNav && currentSec !== null) navPush({ type: 'section', prevSec: currentSec });
  currentSec = sec;
  document.querySelectorAll('.nav-item,.bn-item').forEach(x => x.classList.toggle('active', x.dataset.sec === sec));
  // 'extractor' es core (fila principal del bottom-nav) SOLO para rol asesor
  // (ver .nav-asesor-only en el CSS) — para el resto se llega vía "Más", así
  // que ahí sí tiene que marcarse "Más" como activo.
  const esCoreParaEsteRol = BN_CORE_SECS.includes(sec) && (sec !== 'extractor' || ROL === 'asesor');
  document.getElementById('bn-more')?.classList.toggle('active', !esCoreParaEsteRol);
  if (sheetAbierta) closeSheet(sheetAbierta, true);
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + sec).classList.add('active');
  document.querySelector('.topbar').classList.toggle('show-search', sec === 'leads');
  const t = TITLES[sec] || TITLES.dashboard;
  document.getElementById('page-title').textContent = t[0];
  document.getElementById('page-sub').textContent = t[1];
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (sec === 'metricas') loadMetricas();
  if (sec === 'ranking') loadRanking();
  if (sec === 'reasignaciones') loadReasignaciones();
  if (sec === 'asistencia') loadAsistencia();
  if (sec === 'postventa') loadPostventa();
  if (sec === 'informe-diario') loadInformeDiario();
  if (sec === 'leads' && ROL === 'asesor') loadInboxLeads();
  if (sec === 'tarifario') loadTarifario();
  if (sec === 'mensajes') cargarBandeja();
  if (sec === 'galeria') loadGaleria();
  if (sec === 'asesores') loadAsesoresPeriodo();
  if (sec === 'redes') loadRedes();
  setTimeout(() => Object.values(charts).forEach(c => c && c.resize()), 60);
}
function setupNav() {
  document.querySelectorAll('.nav-item,.bn-item,.sheet-item').forEach(n => n.addEventListener('click', () => { if (n.dataset.sec) activateSection(n.dataset.sec); }));
  document.getElementById('bn-more')?.addEventListener('click', () => openSheet('more-sheet'));
  document.getElementById('side-foot-perfil')?.addEventListener('click', () => openPerfilDrawer());
  document.getElementById('sheet-item-perfil')?.addEventListener('click', () => { closeSheet('more-sheet', true); openPerfilDrawer(); });
  document.querySelectorAll('.mfs-trigger, .mfs-done').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.mfs;
    b.classList.contains('mfs-trigger') ? openSheet(id) : closeSheet(id);
  }));
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
  if (id === 'tutorial-sheet') marcarTutorialVisto();
  document.getElementById(id)?.classList.remove('open');
  document.getElementById('sheet-bg')?.classList.remove('open');
  if (sheetAbierta === id) sheetAbierta = null;
  if (!fromNav) navConsume();
}
document.getElementById('sheet-bg')?.addEventListener('click', () => { if (sheetAbierta) closeSheet(sheetAbierta); });

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
function mockupExtractorAsesor() {
  return `<div style="font-size:12px;color:var(--muted);margin-bottom:6px"><i class="fas fa-wand-magic-sparkles" style="color:var(--accent)"></i> Extractor IA</div>
    <textarea rows="3" disabled style="width:100%;resize:none;background:var(--bg);border:1px solid var(--line2);border-radius:8px;color:var(--muted);font-size:12px;padding:8px;font-family:inherit">Hola, quiero viajar a Margarita con mi esposa del 10 al 15...</textarea>`;
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
    { titulo: 'Tocá para profundizar', texto: 'Cualquier gráfico o número se puede tocar para ver el detalle de esos leads.', selector: '#sec-dashboard' },
  ]},
  { id: 'leads', titulo: 'Leads', icono: 'fa-users', roles: ['admin', 'asesor'], seccion: 'leads', pasos: [
    { titulo: 'Tus clientes', texto: () => ROL === 'asesor' ? 'Acá aparecen los clientes que te asignaron. Los nuevos suben arriba de todo.' : 'Acá el admin ve y filtra todos los leads del negocio, de todos los asesores.', selector: '#sec-leads' },
    { titulo: 'Leads nuevos por atender', texto: 'Cada tarjeta nueva tiene 3 botones: ✅ Atender (lo tomás), ❌ No puedo (se lo pasás a otro asesor), 🚩 (avisás que el número está mal).', selector: '#inbox-grid' },
    { soloAdmin: true, titulo: '🔎 Así lo ve un asesor', texto: 'Cada asesor solo ve sus propios leads nuevos, con estos mismos 3 botones. Si no toca ninguno a tiempo, el lead se reasigna automático a otro asesor.', mockup: mockupBandejaAsesor },
  ]},
  { id: 'mensajes', titulo: 'Mensajes', icono: 'fa-comment-dots', roles: ['admin', 'asesor', 'marketing'], seccion: 'mensajes', pasos: [
    { titulo: 'Chat interno del equipo', texto: 'Esto no es WhatsApp del cliente -- es un chat interno para hablar con tus compañeros y con administración.', selector: '#sec-mensajes' },
  ]},
  { id: 'extractor', titulo: 'Extractor IA', icono: 'fa-wand-magic-sparkles', roles: ['admin', 'asesor'], seccion: 'extractor', pasos: [
    { titulo: 'Copiá y pegá la conversación', texto: 'Pegá acá la conversación de WhatsApp con el cliente y la IA saca automáticamente destino, fechas, cantidad de personas y presupuesto.', selector: '#ext-chat-input' },
    { soloAdmin: true, titulo: '🔎 Así lo ve un asesor', texto: 'Los asesores usan esto todo el tiempo para no tener que tipear los datos del cliente a mano en cada cotización.', mockup: mockupExtractorAsesor },
  ]},
  { id: 'metricas', titulo: 'Métricas', icono: 'fa-chart-simple', roles: ['admin'], seccion: 'metricas', pasos: [
    { titulo: 'Números del negocio', texto: 'Conversión, tiempos de respuesta y ventas, con filtro de fecha. Solo lo ve administración.', selector: '#sec-metricas' },
  ]},
  { id: 'ranking', titulo: 'Ranking', icono: 'fa-ranking-star', roles: ['admin'], seccion: 'ranking', pasos: [
    { titulo: 'Ranking de asesores', texto: 'Compará el desempeño de cada asesor: cuántos leads atendió, cuántos cerró, tiempo de respuesta.', selector: '#sec-ranking' },
  ]},
  { id: 'pipeline', titulo: 'Pipeline', icono: 'fa-diagram-project', roles: ['admin', 'asesor'], seccion: 'pipeline', pasos: [
    { titulo: 'El camino de un cliente', texto: 'Acá ves en qué etapa está cada cliente: Atendido → Cotización enviada → Esperando pago → Pago realizado.', selector: '#sec-pipeline' },
  ]},
  { id: 'tarifario', titulo: 'Tarifario', icono: 'fa-book-open', roles: ['admin', 'asesor', 'marketing'], seccion: 'tarifario', pasos: [
    { titulo: 'Catálogo de hoteles y paquetes', texto: 'Todos los precios y opciones que le podés ofrecer a un cliente, con fotos.', selector: '#sec-tarifario' },
  ]},
  { id: 'cotizador', titulo: 'Cotizador IA', icono: 'fa-comments', roles: ['admin', 'asesor', 'marketing'], seccion: 'cotizador', pasos: [
    { titulo: 'Armá una cotización hablando', texto: 'Contale a la IA qué busca el cliente (destino, presupuesto, fechas) y te arma opciones del Tarifario al toque.', selector: '#chat-input' },
  ]},
  { id: 'galeria', titulo: 'Galería', icono: 'fa-images', roles: ['admin', 'asesor', 'marketing'], seccion: 'galeria', pasos: [
    { titulo: 'Fotos para mandar al cliente', texto: 'Fotos reales de hoteles y paquetes, listas para compartir por WhatsApp.', selector: '#sec-galeria' },
  ]},
  { id: 'redes', titulo: 'Redes', icono: 'fa-share-nodes', roles: ['admin', 'marketing'], seccion: 'redes', pasos: [
    { titulo: 'Instagram y Meta', texto: 'Métricas de las redes sociales del negocio -- alcance, seguidores, publicaciones que mejor funcionan.', selector: '#sec-redes' },
  ]},
  { id: 'asesores', titulo: 'Asesores', icono: 'fa-user-tie', roles: ['admin'], seccion: 'asesores', pasos: [
    { titulo: 'Tu equipo', texto: 'Alta/baja de asesores, y el peso de cada uno en el sorteo automático de leads nuevos.', selector: '#sec-asesores' },
  ]},
  { id: 'reasignaciones', titulo: 'Reasignaciones', icono: 'fa-shuffle', roles: ['admin'], seccion: 'reasignaciones', pasos: [
    { titulo: 'Historial de reasignaciones', texto: 'Cada vez que un lead pasa de un asesor a otro por no responder a tiempo, queda acá con el motivo.', selector: '#sec-reasignaciones' },
  ]},
  { id: 'asistencia', titulo: 'Asistencia', icono: 'fa-user-clock', roles: ['admin'], seccion: 'asistencia', pasos: [
    { titulo: 'Asistencia del equipo', texto: 'Quién marcó entrada/salida cada día y a qué hora.', selector: '#sec-asistencia' },
    { soloAdmin: true, titulo: '🔎 Así lo ve un asesor', texto: 'Cada asesor marca su propia jornada con este botón, siempre visible arriba del menú.', mockup: mockupAsistenciaAsesor },
  ]},
  { id: 'informe-diario', titulo: 'Informe Diario', icono: 'fa-file-lines', roles: ['admin'], seccion: 'informe-diario',
    visibleIf: () => getComputedStyle(document.getElementById('nav-informe-diario')).display !== 'none', pasos: [
    { titulo: 'Resumen del día', texto: 'Un resumen automático del día, para no tener que revisar todo a mano.', selector: '#sec-informe-diario' },
  ]},
  { id: 'asistencia-personal', titulo: 'Marcar asistencia', icono: 'fa-user-clock', roles: ['asesor'], seccion: null, pasos: [
    { titulo: 'Marcá tu entrada y salida', texto: 'Tocá "Comenzar" al empezar tu jornada y "Finalizar" al terminarla. Administración lo ve reflejado al instante.', selector: '#jornada-widget-d, #jornada-widget-m' },
  ]},
];

function pasosVisiblesCapitulo(cap) { return cap.pasos.filter(p => !p.soloAdmin || ROL === 'admin'); }
function capitulosVisiblesTour() { return TOUR_CAPITULOS.filter(c => c.roles.includes(ROL) && (!c.visibleIf || c.visibleIf())); }
function elVisible(selector) { return [...document.querySelectorAll(selector)].find(el => el.offsetParent !== null) || null; }

let TOUR_CAP_ACTUAL = null, TOUR_PASO_IDX = 0;

function abrirMenuTutorial() {
  const lista = capitulosVisiblesTour();
  document.getElementById('tutorial-chap-list').innerHTML = lista.map(c => `
    <a class="sheet-item tour-chap-item" data-cap="${c.id}">
      <i class="fas ${c.icono}"></i>
      <span class="si-t">${esc(c.titulo)}<span class="si-sub">${pasosVisiblesCapitulo(c).length} paso${pasosVisiblesCapitulo(c).length === 1 ? '' : 's'}</span></span>
    </a>`).join('');
  document.querySelectorAll('#tutorial-chap-list .tour-chap-item').forEach(el => { el.onclick = () => iniciarCapituloTour(el.dataset.cap); });
  openSheet('tutorial-sheet');
}
function iniciarCapituloTour(capId) {
  const cap = TOUR_CAPITULOS.find(c => c.id === capId);
  if (!cap) return;
  closeSheet('tutorial-sheet', true);
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
  abrirMenuTutorial();
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
  document.getElementById('nav-tutorial')?.addEventListener('click', () => abrirMenuTutorial());
  document.getElementById('sheet-item-tutorial')?.addEventListener('click', () => { closeSheet('more-sheet', true); abrirMenuTutorial(); });
  document.getElementById('tb-next').addEventListener('click', siguientePasoTour);
  document.getElementById('tb-back').addEventListener('click', pasoAnteriorTour);
  document.getElementById('tb-skip').addEventListener('click', () => volverAlMenuTutorial());
}
