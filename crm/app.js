import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://begbjhrdbsqftbbleecb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_M7Ms9DLwpNSCXZNCDhYtbQ_LhMYeLxk';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const fmt = n => (n ?? 0).toLocaleString('es-VE');
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fullMonth = k => { const [y, m] = k.split('-'); return MESL[+m - 1] + ' ' + y; };
const ESTADO_COLORS = {
  'POR ATENDER': '#ff9100', 'CLIENTE CONTACTADO': '#4a9eff', 'COTIZACION ENVIADA': '#a06bff',
  'EN ESPERA DE PAGO': '#f5b544', 'PAGO REALIZADO': '#10b981', 'Sin gestionar': '#5f677f'
};
const CANAL_CLASS = { 'Instagram': 'ig', 'Facebook': 'fb', 'Ambos': 'am', 'Desconocido': '' };
const ADV_COLORS = ['#ff9100', '#4a9eff', '#10b981', '#a06bff', '#f5b544', '#ff5c8a'];
const TITLES = { dashboard: ['Dashboard', 'Resumen general de leads · Destinos y Eventos Lotus 360'], leads: ['Leads', 'Base de datos completa de clientes y prospectos'], pipeline: ['Pipeline', 'Seguimiento del ciclo de vida del lead'], asesores: ['Asesores', 'Carga de trabajo y reparto del equipo comercial'] };
const initials = s => (s || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const val = id => document.getElementById(id).value;
const niceEstado = v => (v === (v || '').toUpperCase() && (v || '').includes(' ')) ? v.charAt(0) + v.slice(1).toLowerCase() : v;
const sortEntries = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]);

let STATS = {}, page = 1, PER = 25, totalFiltered = 0;
let activeMonth = null, activeDestino = null;
let trendKeys = [], canalKeys = [], destKeys = [];

const LOGIN_EMAIL = 'equipo@destinoyeventoslotus360.com';
let booted = false;

initAuth();
async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) startApp();
  else document.getElementById('login').classList.add('show');
}
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn'), errEl = document.getElementById('loginErr');
  const pwd = document.getElementById('loginPwd').value;
  errEl.textContent = ''; btn.disabled = true; btn.innerHTML = 'Entrando... <i class="fas fa-spinner fa-spin"></i>';
  const { error } = await sb.auth.signInWithPassword({ email: LOGIN_EMAIL, password: pwd });
  btn.disabled = false; btn.innerHTML = 'Entrar <i class="fas fa-arrow-right"></i>';
  if (error) { errEl.textContent = 'Contraseña incorrecta'; document.getElementById('loginPwd').select(); return; }
  document.getElementById('login').classList.remove('show');
  startApp();
});

async function startApp() {
  if (booted) return; booted = true;
  setupNav();
  await loadStats();
  renderAll();
  setupFilters();
  await loadTable();
  subscribeRealtime();
}
window.cerrarSesion = async () => { await sb.auth.signOut(); location.reload(); };
function renderAll() {
  renderKPIs(); renderTrend(); renderCanal(); renderPipe('pipe'); renderPipe('pipe2');
  renderDest(); renderAdvisors(); renderAssign();
}

async function loadStats() {
  const { data, error } = await sb.rpc('dashboard_stats');
  if (error) { console.error('stats', error.message || error); STATS = {}; return; }
  STATS = data;
  document.getElementById('nav-lead-count').textContent = (STATS.total / 1000).toFixed(1).replace('.0', '') + 'k';
}

/* ---------- KPIs ---------- */
function renderKPIs() {
  const cards = [
    { t: 'Leads totales', v: fmt(STATS.total), d: 'Histórico completo 2022–2026', i: 'fa-users', c: 'var(--accent)' },
    { t: 'Leads en 2026', v: fmt(STATS.anio_actual), d: `<b>+${fmt(STATS.by_canal?.Facebook || 0)}</b> por Facebook`, i: 'fa-calendar-day', c: 'var(--blue)' },
    { t: 'Nuevos este mes', v: fmt(STATS.mes_actual), d: fullMonth(new Date().toISOString().slice(0, 7)), i: 'fa-bolt', c: 'var(--green)' },
    { t: 'Por atender', v: fmt(STATS.por_atender), d: 'Requieren primer contacto', i: 'fa-bell', c: 'var(--amber)' },
  ];
  document.getElementById('kpis').innerHTML = cards.map((k, i) => `
    <div class="kpi ${i === 3 ? 'kpi-click' : ''}" style="--kc:${k.c}" ${i === 3 ? 'data-drill="estado:POR ATENDER"' : ''}>
      <div class="kt"><i class="fas ${k.i}"></i> ${k.t}</div>
      <div class="kv">${k.v}</div><div class="kd">${k.d}</div></div>`).join('');
  const pa = document.querySelector('.kpi-click'); if (pa) pa.onclick = () => drillEstado('POR ATENDER');
}

/* ---------- Charts ---------- */
Chart.defaults.color = '#8b93ad'; Chart.defaults.font.family = 'Inter'; Chart.defaults.font.size = 11;
let charts = {};
function mk(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart(document.getElementById(id), cfg); }
const pointer = (e, el) => { e.native.target.style.cursor = el.length ? 'pointer' : 'default'; };

function renderTrend() {
  const t = (STATS.trend || []).slice().sort((a, b) => a.mes.localeCompare(b.mes));
  trendKeys = t.map(x => x.mes);
  const labels = t.map(x => { const [y, m] = x.mes.split('-'); return MES3[+m - 1] + " '" + y.slice(2); });
  mk('chTrend', {
    type: 'bar',
    data: { labels, datasets: [{ data: t.map(x => x.total), backgroundColor: t.map(x => x.mes === activeMonth ? '#ffc266' : 'rgba(255,145,0,.72)'), hoverBackgroundColor: '#ffc266', borderRadius: 5, maxBarThickness: 30 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      onClick: (e, el) => { if (el.length) drillMonth(trendKeys[el[0].index]); },
      onHover: pointer,
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: it => fullMonth(trendKeys[it[0].dataIndex]), label: c => fmt(c.raw) + ' leads  ·  clic para ver' } } },
      scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }, y: { grid: { color: 'rgba(255,255,255,.05)' }, beginAtZero: true } }
    }
  });
}
function renderCanal() {
  const e = sortEntries(STATS.by_canal); canalKeys = e.map(x => x[0]);
  mk('chCanal', {
    type: 'doughnut',
    data: { labels: canalKeys, datasets: [{ data: e.map(x => x[1]), backgroundColor: ['#ff5c8a', '#a06bff', '#4a9eff', '#5f677f'], borderColor: '#0d1224', borderWidth: 3, hoverOffset: 8 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '64%',
      onClick: (e, el) => { if (el.length) drillCanal(canalKeys[el[0].index]); }, onHover: pointer,
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 12 } } },
        tooltip: { callbacks: { label: c => c.label + ': ' + fmt(c.raw) + '  ·  clic para ver' } } }
    }
  });
}
function renderDest() {
  const e = sortEntries(STATS.top_destinos).slice(0, 8); destKeys = e.map(x => x[0]);
  mk('chDest', {
    type: 'bar',
    data: { labels: destKeys, datasets: [{ data: e.map(x => x[1]), backgroundColor: 'rgba(74,158,255,.75)', hoverBackgroundColor: '#4a9eff', borderRadius: 6, barThickness: 16 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      onClick: (e, el) => { if (el.length) drillDestino(destKeys[el[0].index]); }, onHover: pointer,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmt(c.raw) + ' leads  ·  clic para ver' } } },
      scales: { x: { grid: { color: 'rgba(255,255,255,.05)' }, beginAtZero: true }, y: { grid: { display: false } } }
    }
  });
}
function renderAssign() {
  const e = Object.entries(STATS.asignacion_objetivo || {}).sort((a, b) => b[1] - a[1]);
  mk('chAssign', {
    type: 'bar',
    data: { labels: e.map(x => x[0].split(' ')[0]), datasets: [{ data: e.map(x => x[1]), backgroundColor: ADV_COLORS, borderRadius: 7, barThickness: 30 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw + '% de los leads' } } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { callback: v => v + '%' }, beginAtZero: true } } }
  });
}
function renderPipe(id) {
  const order = ['POR ATENDER', 'CLIENTE CONTACTADO', 'COTIZACION ENVIADA', 'EN ESPERA DE PAGO', 'PAGO REALIZADO', 'Sin gestionar'];
  const be = STATS.by_estado || {}, max = Math.max(...order.map(k => be[k] || 0), 1);
  document.getElementById(id).innerHTML = order.map(k => {
    const v = be[k] || 0, w = Math.max((v / max) * 100, 2);
    return `<div class="pstep" data-est="${k}" title="Clic para ver estos leads"><div class="pl">${niceEstado(k)}</div>
      <div class="pbar"><div class="pfill" style="width:${w}%;background:${ESTADO_COLORS[k]}">${v > max * 0.12 ? fmt(v) : ''}</div></div>
      <div class="pv">${fmt(v)}</div></div>`;
  }).join('');
  document.querySelectorAll('#' + id + ' .pstep').forEach(el => el.onclick = () => drillEstado(el.dataset.est));
}
function renderAdvisors() {
  const e = sortEntries(STATS.by_advisor), max = Math.max(...e.map(x => x[1]), 1);
  document.getElementById('advList').innerHTML = e.map(([name, v], i) => {
    const c = ADV_COLORS[i % ADV_COLORS.length];
    return `<div class="arow adv-click" data-adv="${esc(name)}" title="Clic para ver sus leads"><div class="ava" style="background:${c}">${initials(name)}</div>
      <div class="ai"><div class="an"><span>${esc(name)}</span><span class="anv">${fmt(v)} leads</span></div>
      <div class="track"><div class="fill" style="width:${(v / max) * 100}%;background:${c}"></div></div></div></div>`;
  }).join('') + `<div class="arow" style="opacity:.6"><div class="ava" style="background:#39415c">H</div>
      <div class="ai"><div class="an"><span>Asesores históricos / inactivos</span><span class="anv">${fmt(STATS.historico_inactivo)} leads</span></div>
      <div class="track"><div class="fill" style="width:100%;background:#39415c"></div></div></div></div>`;
  document.querySelectorAll('.adv-click').forEach(el => el.onclick = () => drillAsesor(el.dataset.adv));
}

/* ---------- Drill-down (clic en gráficas → filtra leads) ---------- */
function clearFiltersQuiet() { ['f-canal', 'f-estado', 'f-asesor', 'f-anio'].forEach(id => document.getElementById(id).value = ''); document.getElementById('global-search').value = ''; activeMonth = null; activeDestino = null; }
function drillTo(apply) { clearFiltersQuiet(); apply(); activateSection('leads'); page = 1; loadTable(); renderChips(); }
const drillMonth = m => drillTo(() => { activeMonth = m; });
const drillCanal = c => drillTo(() => { document.getElementById('f-canal').value = c; });
const drillEstado = e => drillTo(() => { document.getElementById('f-estado').value = e; });
const drillAsesor = a => drillTo(() => { document.getElementById('f-asesor').value = a; });
const drillDestino = d => drillTo(() => { activeDestino = d; });

/* ---------- Filters + Table ---------- */
function setupFilters() {
  fill('f-canal', Object.keys(STATS.by_canal || {}));
  fill('f-estado', ['POR ATENDER', 'CLIENTE CONTACTADO', 'COTIZACION ENVIADA', 'EN ESPERA DE PAGO', 'PAGO REALIZADO', 'Sin gestionar']);
  fill('f-asesor', Object.keys(STATS.by_advisor || {}).concat(['Sin asignar']));
  fill('f-anio', Object.keys(STATS.by_anio || {}).sort().reverse());
  ['f-canal', 'f-estado', 'f-asesor', 'f-anio'].forEach(id => document.getElementById(id).addEventListener('change', () => { page = 1; loadTable(); renderChips(); }));
  let deb; document.getElementById('global-search').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => { page = 1; loadTable(); renderChips(); }, 300); });
}
function fill(id, arr) { const s = document.getElementById(id); [...s.querySelectorAll('option:not([value=""])')].forEach(o => o.remove()); arr.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = niceEstado(v); s.appendChild(o); }); }

function renderChips() {
  const box = document.getElementById('active-filters'); if (!box) return;
  const chips = [];
  if (val('f-canal')) chips.push(['Canal: ' + val('f-canal'), () => setDrop('f-canal', '')]);
  if (val('f-estado')) chips.push(['Estado: ' + niceEstado(val('f-estado')), () => setDrop('f-estado', '')]);
  if (val('f-asesor')) chips.push(['Asesor: ' + val('f-asesor'), () => setDrop('f-asesor', '')]);
  if (val('f-anio')) chips.push(['Año: ' + val('f-anio'), () => setDrop('f-anio', '')]);
  if (activeMonth) chips.push(['Mes: ' + fullMonth(activeMonth), () => { activeMonth = null; refresh(); }]);
  if (activeDestino) chips.push(['Destino: ' + activeDestino, () => { activeDestino = null; refresh(); }]);
  const qs = val('global-search').trim(); if (qs) chips.push(['Buscar: ' + qs, () => { document.getElementById('global-search').value = ''; refresh(); }]);
  if (!chips.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<span class="chips-label">Filtros:</span>` + chips.map((c, i) => `<span class="fchip">${esc(c[0])} <b data-ci="${i}">✕</b></span>`).join('') + `<button class="clear-all" id="clearAll"><i class="fas fa-times"></i> Limpiar todo</button>`;
  chips.forEach((c, i) => box.querySelector(`b[data-ci="${i}"]`).onclick = c[1]);
  document.getElementById('clearAll').onclick = () => { clearFiltersQuiet(); refresh(); };
}
function setDrop(id, v) { document.getElementById(id).value = v; refresh(); }
function refresh() { page = 1; loadTable(); renderChips(); }

function buildQuery(forCount) {
  let q = sb.from('leads').select('*', forCount ? { count: 'exact' } : {});
  const fc = val('f-canal'), fe = val('f-estado'), fa = val('f-asesor'), fy = val('f-anio'), qs = val('global-search').trim();
  if (fc) q = q.eq('canal', fc);
  if (fe) q = q.eq('estado', fe);
  if (fa) q = q.eq('asesor', fa);
  if (fy) q = q.eq('anio', +fy);
  if (activeDestino) q = q.eq('destino', activeDestino);
  if (activeMonth) { const [y, m] = activeMonth.split('-').map(Number); const nm = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; q = q.gte('fecha_creacion', activeMonth + '-01').lt('fecha_creacion', nm + '-01'); }
  if (qs) q = q.or(`nombre.ilike.%${qs}%,telefono.ilike.%${qs}%`);
  return q;
}
async function loadTable() {
  const from = (page - 1) * PER;
  const { data, count, error } = await buildQuery(true).order('fecha_creacion', { ascending: false, nullsFirst: false }).range(from, from + PER - 1);
  if (error) { console.error(error); return; }
  totalFiltered = count ?? 0;
  document.getElementById('t-count').textContent = `${fmt(totalFiltered)} leads · mostrando ${data.length}`;
  document.getElementById('tbody').innerHTML = data.map(l => {
    const cc = CANAL_CLASS[l.canal] ?? '';
    const wa = l.telefono ? l.telefono.replace(/\D/g, '') : '';
    return `<tr>
      <td><div class="lead-name"><div class="ln-ava">${initials(l.nombre)}</div>${esc(l.nombre)}</div></td>
      <td class="muted">${esc(l.telefono) || '—'}</td>
      <td>${esc(l.destino)}</td>
      <td><span class="chip ${cc}">${esc(l.canal)}</span></td>
      <td>${l.asesor_activo ? esc(l.asesor) : '<span class="muted">' + esc(l.asesor) + '</span>'}</td>
      <td><span class="badge-st" style="color:${ESTADO_COLORS[l.estado] || '#8b93ad'};background:${(ESTADO_COLORS[l.estado] || '#8b93ad')}22">${niceEstado(l.estado)}</span></td>
      <td class="muted">${l.fecha_creacion ? l.fecha_creacion.slice(0, 10) : '—'}</td>
      <td>${wa ? `<a class="wa-btn" href="https://wa.me/${wa}" target="_blank" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i></a>` : ''}</td>
    </tr>`;
  }).join('');
  [...document.querySelectorAll('#tbody tr')].forEach((tr, i) => tr.addEventListener('click', () => openDrawer(data[i])));
  renderPager(Math.max(Math.ceil(totalFiltered / PER), 1));
}
function renderPager(pages) {
  document.getElementById('pager').innerHTML = `
    <button ${page <= 1 ? 'disabled' : ''} id="pprev"><i class="fas fa-chevron-left"></i> Anterior</button>
    <span class="pinfo">Página ${fmt(page)} de ${fmt(pages)}</span>
    <button ${page >= pages ? 'disabled' : ''} id="pnext">Siguiente <i class="fas fa-chevron-right"></i></button>`;
  const pv = document.getElementById('pprev'), nx = document.getElementById('pnext');
  if (pv) pv.onclick = () => { page--; loadTable(); };
  if (nx) nx.onclick = () => { page++; loadTable(); };
}

/* ---------- Drawer ---------- */
function openDrawer(l) {
  const wa = l.telefono ? l.telefono.replace(/\D/g, '') : '';
  const fields = [
    ['fa-phone', 'Teléfono', esc(l.telefono) || 'No registrado'],
    ['fa-location-dot', 'Destino de interés', esc(l.destino)],
    ['fa-comment-dots', 'Consulta original', esc(l.destino_consulta || '—')],
    ['fa-share-nodes', 'Canal de origen', esc(l.canal)],
    ['fa-user-tie', 'Asesor asignado', esc(l.asesor)],
    ['fa-users', 'Personas', esc(l.personas || '—')],
    ['fa-calendar', 'Fecha estimada de viaje', esc(l.fecha_estimada || '—')],
    ['fa-clock', 'Fecha de captación', l.fecha_creacion ? l.fecha_creacion.slice(0, 10) : '—'],
  ];
  document.getElementById('drawerContent').innerHTML = `
    <div class="dhead"><div class="dava">${initials(l.nombre)}</div>
      <div><div class="dn">${esc(l.nombre)}</div>
      <div class="dm"><span class="badge-st" style="color:${ESTADO_COLORS[l.estado] || '#8b93ad'};background:${(ESTADO_COLORS[l.estado] || '#8b93ad')}22">${niceEstado(l.estado)}</span></div></div></div>
    ${fields.map(f => `<div class="dfield"><div class="dfi"><i class="fas ${f[0]}"></i></div>
      <div><div class="dfl">${f[1]}</div><div class="dfv">${f[2]}</div></div></div>`).join('')}
    <div class="dactions">
      ${wa ? `<a class="dbtn wa" href="https://wa.me/${wa}" target="_blank"><i class="fab fa-whatsapp"></i> Escribir por WhatsApp</a>` : ''}
      <button class="dbtn gh"><i class="fas fa-pen"></i> Editar</button></div>
    <div style="font-size:11px;color:var(--muted2);margin-top:16px;text-align:center">ID de lead: ${esc(l.external_id || l.id)}</div>`;
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBg').classList.add('open');
}
window.closeDrawer = () => { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerBg').classList.remove('open'); };
document.getElementById('dClose').onclick = window.closeDrawer;
document.getElementById('drawerBg').onclick = window.closeDrawer;

/* ---------- Realtime ---------- */
function subscribeRealtime() {
  sb.channel('leads-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, payload => {
    toast(payload.new);
    loadStats().then(renderAll);
    if (page === 1) loadTable();
  }).subscribe();
}
function toast(l) {
  const t = document.createElement('div'); t.className = 'toast';
  t.innerHTML = `<i class="fas fa-bolt"></i> <div><b>Nuevo lead en vivo</b><br>${esc(l.nombre)} · ${esc(l.destino || '')}</div>`;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.classList.add('show'), 30);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 5200);
}

/* ---------- Nav ---------- */
function activateSection(sec) {
  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
  const target = [...document.querySelectorAll('.nav-item')].find(x => x.dataset.sec === sec);
  if (target) target.classList.add('active');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + sec).classList.add('active');
  const t = TITLES[sec] || TITLES.dashboard;
  document.getElementById('page-title').textContent = t[0];
  document.getElementById('page-sub').textContent = t[1];
  window.scrollTo(0, 0);
}
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(n => n.addEventListener('click', () => { if (n.dataset.sec) activateSection(n.dataset.sec); }));
}
