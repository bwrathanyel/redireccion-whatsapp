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
const TITLES = { dashboard: ['Dashboard', 'Resumen general de leads · Lotus 360'], leads: ['Leads', 'Base de datos de clientes y prospectos'], metricas: ['Métricas', 'Ventas, clientes nuevos y conversión'], ranking: ['Ranking de asesores', 'Desempeño del equipo comercial'], pipeline: ['Pipeline', 'Ciclo de vida del lead'], asesores: ['Asesores', 'Carga de trabajo del equipo'], reasignaciones: ['Reasignaciones', 'Historial de leads reasignados por timeout o manualmente'], tarifario: ['Tarifario', 'Destinos, hoteles, paquetes y promociones vigentes'], cotizador: ['Cotizador IA', 'Cotiza con el tarifario vigente como base'], galeria: ['Galería', 'Fotos de los hoteles del tarifario'] };
const initials = s => (s || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
let booted = false, ROL = null, MI_NOMBRE = null;
const overlay = id => document.getElementById(id);
const showOverlay = id => OVERLAYS.forEach(o => overlay(o).classList.toggle('show', o === id));

initAuth();
async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) await afterLogin(); else showOverlay('login');
}

async function cargarUsuario() {
  const { data: { user } } = await sb.auth.getUser();
  const { data, error } = await sb.from('usuarios').select('username,nombre,rol,debe_cambiar_password').eq('id', user?.id).single();
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
  MI_NOMBRE = u.nombre; ROL = u.rol;
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
  startApp();
}

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

window.cerrarSesion = async () => { await sb.auth.signOut(); location.reload(); };

async function startApp() {
  if (booted) return; booted = true;
  setupNav();
  setupTarifarioTabs();
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
  const filaHistorico = datosPeriodo ? '' : `<div class="arow" style="opacity:.6"><div class="ava" style="background:#39415c">H</div><div class="ai"><div class="an"><span>Históricos / inactivos</span><span class="anv">${fmt(STATS.historico_inactivo)} leads</span></div><div class="track"><div class="fill" style="width:100%;background:#39415c"></div></div></div></div>`;
  document.getElementById('advList').innerHTML = e.map(([name, v], i) => { const c = ADV_COLORS[i % ADV_COLORS.length]; return `<div class="arow adv-click" data-adv="${esc(name)}"><div class="ava" style="background:${c}">${initials(name)}</div><div class="ai"><div class="an"><span>${esc(name)}</span><span class="anv">${fmt(v)} leads</span></div><div class="track"><div class="fill" style="width:${(v / max) * 100}%;background:${c}"></div></div></div></div>`; }).join('') + filaHistorico;
  document.querySelectorAll('.adv-click').forEach(el => el.onclick = () => { const a = el.dataset.adv; chartPreview('asesor', a, a, 'fa-user-tie', src[a]); });
  document.querySelector('#advList').closest('.card').querySelector('.csub').textContent = datosPeriodo ? `Toca un asesor para ver su cartera · ${e.length} con actividad en el periodo` : `Toca un asesor para ver su cartera · ${e.length} activos`;
}

/* ---------- Filtros de periodo en Asesores ---------- */
let asePeriodo = 'historico';
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
      <div class="eb-title"><i class="fas fa-sliders"></i> Gestión</div>
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

    <div class="dfield"><div class="dfi"><i class="fas fa-location-dot"></i></div><div><div class="dfl">Destino de interés</div><div class="dfv">${esc(l.destino)}</div></div></div>
    <div class="dfield"><div class="dfi"><i class="fas fa-comment-dots"></i></div><div><div class="dfl">Consulta original</div><div class="dfv">${esc(l.destino_consulta || '—')}</div></div></div>
    <div class="dfield"><div class="dfi"><i class="fas fa-users"></i></div><div><div class="dfl">Personas</div><div class="dfv">${esc(l.personas || '—')}</div></div></div>
    <div class="dfield"><div class="dfi"><i class="fas fa-clock"></i></div><div><div class="dfl">Fecha de captación</div><div class="dfv">${l.fecha_creacion ? l.fecha_creacion.slice(0, 10) : '—'}</div></div></div>

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
  const monto = estado === VENTA ? parseFloat(montoRaw) : null;
  const comprado = estado === VENTA ? val('e-comprado').trim() : null;
  err.textContent = ''; btn.disabled = true; btn.innerHTML = 'Guardando... <i class="fas fa-spinner fa-spin"></i>';
  const { data, error } = await sb.rpc('actualizar_lead', { p_lead_id: currentLead.id, p_estado: estado, p_asesor: asesor, p_monto: monto, p_servicio: servicio, p_servicios_comprados: comprado });
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
let tarTab = 'destino', tarCache = {}, tarInfo = null, tarView = 'tarjetas';
const TAR_TAB_LABEL = { destino: 'Guías/Tours', hotel: 'Hotel', paquete: 'Paquete', promo: 'Promoción' };
function setupTarifarioTabs() {
  fill('tar-f-destino', ['Margarita', 'Coche']);
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
    ? sb.from('promociones').select('*, productos(producto_fotos(storage_path,orden))').order('titulo')
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
  const propias = (x.producto_fotos || []).slice().sort((a, b) => a.orden - b.orden).map(f => FOTOS_BASE + f.storage_path);
  if (propias.length) return propias;
  const heredadas = x.productos?.producto_fotos || x.hotel?.producto_fotos || [];
  return heredadas.slice().sort((a, b) => a.orden - b.orden).map(f => FOTOS_BASE + f.storage_path);
};

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
  const irA = n => {
    i = (n + fotos.length) % fotos.length;
    mediaEl.style.opacity = '0';
    setTimeout(() => { setFoto(fotos[i]); mediaEl.style.opacity = '1'; }, 180);
    if (dotsEl) [...dotsEl.children].forEach((d, idx) => d.classList.toggle('on', idx === i));
  };
  if (esTouch) {
    let startX = null;
    mediaEl.addEventListener('touchstart', e => { precargarFotos(fotos); startX = e.touches[0].clientX; }, { passive: true });
    mediaEl.addEventListener('touchend', e => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 30) irA(i + (dx < 0 ? 1 : -1));
      startX = null;
    }, { passive: true });
    return;
  }
  cardEl.addEventListener('mouseenter', () => {
    precargarFotos(fotos);
    i = 0;
    timer = setInterval(() => irA(i + 1), 1100);
    carruselTimers.add(timer);
  });
  cardEl.addEventListener('mouseleave', () => {
    clearInterval(timer); carruselTimers.delete(timer); timer = null;
    mediaEl.style.opacity = '1';
    setFoto(fotos[0]);
    if (dotsEl) [...dotsEl.children].forEach((d, idx) => d.classList.toggle('on', idx === 0));
  });
}
const DESTINO_ORDEN = ['Margarita', 'Coche'];
const hoy = () => new Date().toISOString().slice(0, 10);
const promoVigente = p => !p.fecha_fin_estimada || p.fecha_fin_estimada >= hoy();

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
    } else if (fPrecio != null) {
      const precioTarifa = (x.tarifas || [])[0]?.precio_desde_usd;
      if (precioTarifa != null && precioTarifa > fPrecio) return false;
    }
    return true;
  });

  document.getElementById('tar-count').textContent = `${fmt(filtered.length)} ítems`;
  document.getElementById('tar-empty').classList.toggle('show', filtered.length === 0);
  const grid = document.getElementById('tar-grid');
  if (tarTab === 'hotel') {
    const porDestino = {};
    filtered.forEach(x => (porDestino[x.destino || 'Otros'] ??= []).push(x));
    const destinos = [...new Set([...DESTINO_ORDEN, ...Object.keys(porDestino)])].filter(d => porDestino[d]?.length);
    grid.innerHTML = destinos.map(d => `<div class="tar-destino-header"><i class="fas fa-location-dot"></i> ${esc(d)} <span>${porDestino[d].length}</span></div>${tarItemsWrapHtml(porDestino[d])}`).join('');
  } else {
    grid.innerHTML = tarItemsWrapHtml(filtered);
  }
  [...document.querySelectorAll('#tar-grid .tar-item')].forEach(el => {
    const x = filtered.find(x => String(x.id) === el.dataset.id);
    el.onclick = () => openProductoDrawer(x);
    const fotos = fotosDe(x);
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
  const foto = fotosDe(x)[0];
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
      ${tarCardThumbHtml(fotosDe(x)[0], true)}
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
  const foto = fotosDe(x)[0];
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
  const fotos = fotosDe(x);
  document.getElementById('drawerContent').innerHTML = `
    <div class="dhead">${fotos[0] ? `<div class="dava" style="background-image:url('${esc(fotos[0])}')"></div>` : `<div class="dava" style="background:${ADV_COLORS[0]}22;color:${ADV_COLORS[0]}"><i class="fas fa-book-open"></i></div>`}<div><div class="dn">${esc(nombre)}</div>
      <div class="dm">${esc(x.destino || TAR_TAB_LABEL[tarTab])}</div></div></div>
    ${fotos.length ? `<div class="dgallery">${fotos.map(f => `<a href="${esc(f)}" target="_blank" rel="noopener"><img src="${esc(f)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}
    ${precio ? `<div class="dfield"><div class="dfi"><i class="fas fa-tag"></i></div><div><div class="dfl">Precio</div><div class="dfv">${esc(precio)}</div></div></div>` : ''}
    ${vigencia ? `<div class="dfield"><div class="dfi"><i class="fas fa-clock"></i></div><div><div class="dfl">Vigencia</div><div class="dfv">${esc(vigencia)}</div></div></div>` : ''}
    ${!esPromo && x.descripcion ? `<div class="dfield"><div class="dfi"><i class="fas fa-circle-info"></i></div><div><div class="dfl">Descripción</div><div class="dfv">${esc(x.descripcion)}</div></div></div>` : ''}
    ${!esPromo && x.requisitos ? `<div class="dfield"><div class="dfi"><i class="fas fa-triangle-exclamation"></i></div><div><div class="dfl">Requisitos</div><div class="dfv">${esc(x.requisitos)}</div></div></div>` : ''}
    ${esPromo ? tagsHtml(x.incluye_tags) : ''}
    ${!esPromo && (x.promociones || []).length ? `<div class="dfield"><div class="dfi"><i class="fas fa-gift"></i></div><div><div class="dfl">Promociones activas</div><div class="dfv" style="font-weight:500">${x.promociones.map(p => `<div style="margin-bottom:8px"><b>${esc(p.titulo)}</b>${p.precio_texto ? `<br>${esc(p.precio_texto)}` : ''}${p.vigencia_texto ? `<br><span style="color:var(--amber);font-weight:400">Vigencia: ${esc(p.vigencia_texto)}</span>` : ''}${tagsHtml(p.incluye_tags)}</div>`).join('')}</div></div></div>` : ''}
    <div style="font-size:11px;color:var(--muted2);margin-top:14px;text-align:center">Fuente: ${esc(x.fuente_archivo)}</div>`;
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBg').classList.add('open');
}

/* ---------- Cotizador IA ---------- */
let chatHistory = [];
function setupChat() {
  const input = document.getElementById('chat-input');
  document.getElementById('chat-send').onclick = enviarChat;
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarChat(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  fill('cot-f-destino', DESTINO_ORDEN);
  document.getElementById('cot-f-clear').onclick = () => {
    ['cot-f-destino', 'cot-f-tipo', 'cot-f-plan', 'cot-f-precio', 'cot-f-desde', 'cot-f-hasta'].forEach(id => { document.getElementById(id).value = ''; });
  };
}
// Filtros elegidos en la interfaz (no en texto libre) — se mandan como
// parámetros estructurados al Cotizador, que los aplica ANTES de dejar que
// la IA razone sobre el pedido en lenguaje natural del cliente.
function leerFiltrosCotizador() {
  return {
    destino: val('cot-f-destino') || null,
    tipo: val('cot-f-tipo') || null,
    plan: val('cot-f-plan') || null,
    precioMax: val('cot-f-precio') ? Number(val('cot-f-precio')) : null,
    fechaDesde: val('cot-f-desde') || null,
    fechaHasta: val('cot-f-hasta') || null,
  };
}
async function enviarChat() {
  const input = document.getElementById('chat-input'), btn = document.getElementById('chat-send');
  const texto = input.value.trim();
  if (!texto || btn.disabled) return;
  document.getElementById('chat-empty')?.remove();
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
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
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
