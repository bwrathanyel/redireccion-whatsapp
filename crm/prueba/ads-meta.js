// Marketing > Anuncios Meta: gestor de campañas vía EF ads-meta-zernio (Zernio).
// Vive aparte de app.js (mismo patrón que wa-campanas.js). La key de Zernio nunca
// baja al navegador; los topes y permisos de escritura se validan en la EF.
// Plan: ~/.claude/plans/podemos-montar-un-gestor-imperative-firefly.md
// Diseño: docs/superpowers/specs/2026-10-30-ads-meta-tarjetas-design.md
const CSS = `
.am-barra{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:0 0 14px}
.am-barra select,.am-busca{min-height:38px}
.am-busca{flex:1 1 180px;max-width:280px}
.am-chip{display:inline-flex;align-items:center;gap:7px;min-height:38px;padding:0 14px;border-radius:999px;border:1px solid var(--line2);background:transparent;color:var(--muted);font-size:12px;font-weight:700;cursor:pointer;transition:.16s}
.am-chip.on{border-color:var(--accent-ink);color:var(--accent-ink);background:var(--accent-soft)}
.am-sinc{font-size:11px;color:var(--muted);margin-left:auto}
.am-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-top:14px}
.am-card{display:flex;flex-direction:column;border:1px solid var(--line2);border-radius:14px;overflow:hidden;background:var(--panel);cursor:pointer;transition:border-color .16s,transform .16s}
.am-card:hover{border-color:var(--accent-ink);transform:translateY(-2px)}
.am-card:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.am-foto{position:relative;aspect-ratio:1;background:var(--bg2);display:grid;place-items:center;color:var(--muted);font-size:28px}
.am-foto img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.am-est{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;padding:2px 9px;border-radius:999px;background:var(--line2);color:var(--muted)}
.am-est.on::before{content:'';width:7px;height:7px;border-radius:999px;background:var(--green)}
.am-foto .am-est{position:absolute;top:9px;left:9px;background:var(--velo-foto);color:var(--sobre-foto)}
.am-foto .am-est.on::before{background:var(--precio-sobre-foto)}
.am-cuerpo{display:flex;flex-direction:column;gap:4px;flex:1;padding:11px 14px}
.am-tit{font-size:13px;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.am-gasto{font-size:22px;font-weight:800;letter-spacing:-.02em}
.am-res{font-size:11.5px;color:var(--muted)}
.am-crm{font-size:11.5px;font-weight:700;color:var(--accent-ink)}
.am-tipo{align-self:flex-start;display:inline-flex;font-size:10px;font-weight:800;padding:2px 9px;border-radius:999px;border:1px solid var(--line2);color:var(--muted)}
.am-tipo-sel{margin:11px 0 0}
.am-marca{color:var(--mk,var(--accent));border-color:color-mix(in srgb,var(--mk,var(--accent)) 45%,transparent);margin-left:6px}
.am-marca[data-color=blue]{--mk:var(--blue)}.am-marca[data-color=green]{--mk:var(--green)}.am-marca[data-color=amber]{--mk:var(--amber)}
.am-marca[data-color=purple]{--mk:var(--purple)}.am-marca[data-color=pink]{--mk:var(--pink)}
.am-prog{display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:var(--muted)}
.am-pie{padding:0 14px 11px}
.am-acc{display:inline-flex;flex-wrap:wrap;gap:4px}
.am-acc button{min-height:32px;padding:0 9px}
.am-vacio{padding:28px;text-align:center;color:var(--muted)}
.am-vacio .btn-sm{margin-top:11px}
.am-aviso{font-size:12px;color:var(--muted);margin:7px 0 0}
.am-det-tit{font-size:18px;font-weight:800;line-height:1.25;margin:0 44px 4px 0}
.am-det-sub{display:flex;flex-wrap:wrap;gap:7px;align-items:center;font-size:11.5px;color:var(--muted)}
.am-det-foto{display:grid;place-items:center;position:relative;width:100%;aspect-ratio:1;margin:14px 0;border-radius:12px;overflow:hidden;background:var(--bg2);color:var(--muted);font-size:34px}
.am-det-foto img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.am-ver{position:absolute;right:9px;bottom:9px;padding:4px 11px;border-radius:999px;background:var(--velo-foto);color:var(--sobre-foto);font-size:11px;font-weight:700}
.am-met{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:14px 0}
.am-met div{border:1px solid var(--line);border-radius:10px;padding:7px 9px}
.am-met small,.am-det-h{display:block;font-size:9px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--muted)}
.am-met b{font-size:13px}
.am-met .crm b{color:var(--accent-ink)}
.am-det-h{margin:22px 0 7px}
.am-conj{border-top:1px solid var(--line);margin-top:9px;padding-top:9px}
.am-conj-cab{display:flex;gap:7px;align-items:center;justify-content:space-between;font-size:12px;font-weight:700}
.am-conj-cab small{display:block;font-size:11px;font-weight:400;color:var(--muted)}
.am-anun{display:flex;gap:9px;align-items:center;padding:7px 0}
.am-anun>img,.am-anun>.am-sin{flex:0 0 auto;width:48px;height:48px;border-radius:8px;object-fit:cover;background:var(--bg2);display:grid;place-items:center;color:var(--muted)}
.am-anun>div{flex:1;min-width:0;font-size:12.5px;overflow-wrap:anywhere}
.am-anun a{color:inherit}
.am-anun small{display:block;font-size:11px;color:var(--muted)}
.am-posts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px}
.am-post{border:1px solid var(--line2);border-radius:10px;overflow:hidden;background:var(--panel);cursor:pointer;text-align:left;padding:0}
.am-post img{width:100%;aspect-ratio:1;object-fit:cover;display:block}
.am-post div{padding:7px 9px;font-size:11px;color:var(--muted)}
.am-post.on{outline:2px solid var(--accent-ink)}
.am-post-datos{display:block;margin-top:5px;font-weight:600}
.am-post-pagar{display:block;margin-top:5px;color:var(--accent-ink);font-weight:600}
.am-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px;margin:14px 0}
.am-fila{display:flex;flex-wrap:wrap;gap:9px;align-items:flex-end;margin:9px 0}
.am-fila>.fl{flex:1 1 110px}
.am-chips{display:flex;flex-wrap:wrap;gap:6px;margin:7px 0}
.am-tag{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:0 4px 0 11px;border-radius:999px;background:var(--accent-soft);color:var(--accent-ink);font-size:12px;font-weight:700}
.am-tag select{min-height:24px;border:0;border-radius:999px;background:var(--panel);color:inherit;font-size:11px}
.am-tag button{border:0;background:transparent;color:inherit;cursor:pointer;min-width:24px;min-height:24px;font-size:12px}
.am-auto{position:relative;flex:1 1 220px}
.am-auto .ei{width:100%}
.am-sugs{position:absolute;z-index:5;left:0;right:0;top:100%;margin-top:4px;border:1px solid var(--line2);border-radius:10px;background:var(--panel);box-shadow:0 8px 24px rgb(0 0 0/.14);max-height:260px;overflow:auto}
.am-sugs[hidden]{display:none}
.am-sugs button{display:block;width:100%;text-align:left;padding:8px 11px;border:0;background:transparent;color:inherit;font-size:12.5px;cursor:pointer}
.am-sugs button:hover,.am-sugs button:focus-visible{background:var(--bg2)}
.am-sugs small{display:block;color:var(--muted);font-size:11px}
.am-sugs .am-aviso{padding:8px 11px;margin:0}
.am-check{display:flex;gap:7px;align-items:center;font-size:12.5px;margin:11px 0 0;cursor:pointer}
.am-alc{font-size:13px;font-weight:700;margin:11px 0}
.am-alc small{font-weight:400;color:var(--muted)}
.am-ia{display:flex;flex-wrap:wrap;gap:9px;align-items:flex-start}
.am-ia textarea{flex:1 1 260px;min-height:58px;resize:vertical}
.am-vars{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:9px;margin:11px 0}
.am-vars:empty{display:none}
.am-var{display:flex;flex-direction:column;gap:5px;border:1px solid var(--line2);border-radius:12px;padding:11px 14px;font-size:12px}
.am-var.on{border-color:var(--accent-ink);background:var(--accent-soft)}
.am-var b{font-size:13px;text-transform:capitalize}
.am-var p{margin:0;color:var(--muted)}
.am-var .btn-sm{align-self:flex-start;margin-top:auto}
.am-pub-pie{margin:14px 0 0}
@media (max-width:640px){
  .am-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
  .am-cuerpo{padding:9px 11px}
  .am-pie{padding:0 11px 9px}
  .am-gasto{font-size:18px}
  .am-met{grid-template-columns:repeat(2,minmax(0,1fr))}
}
`;
const CTAS = [
  { v: 'INSTAGRAM_MESSAGE', t: 'Enviar mensaje por Instagram' },
  { v: 'WHATSAPP_MESSAGE', t: 'Enviar mensaje por WhatsApp' },
  { v: 'MESSAGE_PAGE', t: 'Enviar mensaje por Messenger' },
];
const ERRORES = {
  no_autorizado: 'Solo administración puede ver anuncios; solo un admin puede cambiarlos.',
  sobre_tope: 'Supera el tope permitido desde el CRM.',
  meta_ads_sin_conectar: 'La cuenta de Meta Ads no está conectada en Zernio.',
  zernio_no_responde: 'Zernio no respondió. Prueba de nuevo en un minuto.',
};
// Nombre que se muestra en el CRM (pedido del dueño 30-oct); en Meta siguen con su nombre original.
const ALIAS_CUENTAS = {
  '1227849214235821': 'Destino y Eventos Lotus 360 Instagram',
  '1402478865116363': 'Proacción Instagram',
};
// Solo las de venta entran en el costo por lead/venta (tipo automático en SQL: meta_campana_tipo).
const TIPOS = { venta: 'Venta', reclutamiento: 'Reclutamiento', tercero: 'De terceros' };
const GENEROS = [['todos', 'Todos'], ['hombres', 'Hombres'], ['mujeres', 'Mujeres']];
const POSICIONES = [['feed', 'Feed'], ['stories', 'Stories'], ['reels', 'Reels'], ['explorar', 'Explorar']];
// Meta no entrega con menos de ~17 km alrededor de una ciudad; 80 es su máximo.
const RADIOS = [0, 17, 25, 40, 80];
const SECCIONES = { edad: 'edad', genero: 'género', ubicaciones: 'ubicaciones', intereses: 'intereses', audiencias: 'audiencias', ubicaciones_anuncio: 'dónde se ve' };
const OBJETIVOS = {
  LINK_CLICKS: 'Clics al enlace', OUTCOME_TRAFFIC: 'Tráfico', OUTCOME_ENGAGEMENT: 'Interacción',
  POST_ENGAGEMENT: 'Interacción', MESSAGES: 'Mensajes', OUTCOME_LEADS: 'Clientes potenciales',
  OUTCOME_AWARENESS: 'Reconocimiento', REACH: 'Alcance', VIDEO_VIEWS: 'Reproducciones', OUTCOME_SALES: 'Ventas',
};

export function crearAdsMeta({ sb, esc, ok, error, confirmar, rol = 'admin', raiz }) {
  const admin = rol === 'admin';
  let cuentas = [], cuenta = '', tope = 20, dias = 30, conGasto = true, busca = '', tipoFiltro = '', marcaFiltro = '', datos = null, vista = 'arbol';
  let pub = null, pubCtx = null, sugs = { geo: [], int: [] }, variantes = [], tBusca = null, nBusca = 0, tAlc = null, nAlc = 0;
  const cacheBusca = new Map();
  let posts = [], cobertura = null, postSel = null, igs = { cuenta: null, lista: [], propio: null }, igSel = '', pedido = 0, ocupado = false, campSel = null, fondo = null, cajon = null, pausas = new Map();
  const $ = sel => raiz.querySelector(sel);
  const usd = n => '$' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ent = n => Number(n || 0).toLocaleString('es-VE');
  const compacto = n => Number(n || 0).toLocaleString('es-VE', { notation: 'compact', maximumFractionDigits: 1 });
  const div = (a, b) => (b > 0 ? a / b : null);
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const haceDias = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const nombreCuenta = c => ALIAS_CUENTAS[String(c.id).replace(/^act_/, '')] || (!c.nombre || /^\d+$/.test(c.nombre.trim()) ? `Cuenta …${String(c.id).slice(-4)}` : c.nombre);
  const anuncios = camp => camp.conjuntos.flatMap(s => s.anuncios);
  const portada = camp => anuncios(camp).find(a => a.miniatura) || {};
  const tipoDe = camp => camp.tipo || 'venta';
  const esVenta = camp => tipoDe(camp) === 'venta';
  const marcaDe = id => (datos?.marcas || []).find(m => m.id === id);

  async function invocar(body) {
    const { data, error: e } = await sb.functions.invoke('ads-meta-zernio', { body });
    if (e) {
      let j = null;
      try { j = await e.context?.json?.(); } catch { /* sin cuerpo */ }
      throw new Error(j?.detalle || ERRORES[j?.error] || j?.error || e.message);
    }
    if (!data?.ok) throw new Error(data?.detalle || ERRORES[data?.error] || data?.error || 'Error desconocido');
    return data;
  }

  function css() {
    if (document.getElementById('am-css')) return;
    const st = document.createElement('style'); st.id = 'am-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  function marco() {
    raiz.innerHTML = `
      <div class="pvc-cab"><div><h2>Anuncios Meta</h2>
        <div class="ria-sub">Gasto de Meta cruzado con los leads y ventas que trajo cada anuncio. Solo cuentan los anuncios que abren un chat (Instagram, Messenger o WhatsApp).</div></div>
        ${admin ? '<button class="btn-sm lt-primario" type="button" data-am="nuevo"><i class="fas fa-rocket"></i> Promocionar post</button>' : ''}</div>
      <div class="am-barra">
        <select class="ei" id="am-cuenta" aria-label="Cuenta publicitaria"></select>
        <div class="seg-group" id="am-dias">${[7, 30, 90].map(d => `<button class="seg${d === dias ? ' on' : ''}" type="button" data-dias="${d}">${d} días</button>`).join('')}</div>
        <button class="am-chip on" type="button" data-am="gasto" aria-pressed="true"><i class="fas fa-dollar-sign"></i> Solo con gasto</button>
        <select class="ei" id="am-tipo" aria-label="Tipo de campaña"><option value="">Todos los tipos</option>${Object.entries(TIPOS).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
        <select class="ei" id="am-marca" aria-label="Marca" hidden></select>
        <input class="ei am-busca" id="am-busca" type="search" placeholder="Buscar campaña" aria-label="Buscar campaña">
        <button class="btn-sm" type="button" data-am="recargar" title="Recargar"><i class="fas fa-rotate"></i></button>
        <span class="am-sinc" id="am-sinc"></span>
      </div>
      <div class="kpis kpis-5" id="am-kpis"></div>
      <div id="am-cuerpo"><div class="am-vacio">Cargando…</div></div>`;
    raiz.addEventListener('click', clic);
    raiz.addEventListener('change', e => {
      if (e.target.id === 'am-cuenta') { cuenta = e.target.value; cerrar(); cargarArbol(); }
      if (e.target.id === 'am-pub-prev' && e.target.value) copiarPublico(e.target);
      if (e.target.id === 'am-ig') { igSel = e.target.value; abrirNuevo(); }
      if (e.target.id === 'am-tipo') { tipoFiltro = e.target.value; if (vista === 'arbol' && datos) pintarArbol(); }
      if (e.target.id === 'am-marca') { marcaFiltro = e.target.value; if (vista === 'arbol' && datos) pintarArbol(); }
      cambioPublico(e);
    });
    raiz.addEventListener('input', e => { inputPublico(e); if (e.target.id === 'am-busca') { busca = norm(e.target.value.trim()); if (vista === 'arbol' && datos) pintarArbol(); } });
    raiz.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('am-card')) { e.preventDefault(); abrir(e.target.dataset.camp); }
    });
    fondo = document.createElement('div'); fondo.className = 'drawer-bg';
    cajon = document.createElement('aside');
    cajon.className = 'drawer am-drawer'; cajon.setAttribute('role', 'dialog'); cajon.setAttribute('aria-modal', 'true'); cajon.setAttribute('aria-label', 'Detalle de campaña');
    cajon.innerHTML = '<button class="dclose" type="button" data-am="cerrar" aria-label="Cerrar">✕</button><div id="am-det"></div>';
    document.body.append(fondo, cajon);
    fondo.addEventListener('click', cerrar);
    cajon.addEventListener('click', clic);
    cajon.addEventListener('change', e => {
      if (e.target.id === 'am-tipo-camp') cambiarTipo(e.target);
      if (e.target.id === 'am-evento') cambiarEvento(e.target);
      if (e.target.id === 'am-marca-camp') cambiarMarca(e.target);
      cambioPublico(e);
    });
    cajon.addEventListener('input', inputPublico);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && campSel && !document.querySelector('.sheet.open')) cerrar(); });
  }

  function pintarCuentas() {
    $('#am-cuenta').innerHTML = cuentas.map(c => `<option value="${esc(c.id)}"${c.id === cuenta ? ' selected' : ''}>${esc(nombreCuenta(c))}${c.activa ? '' : ' (inactiva)'}</option>`).join('');
  }

  function kpis(c) {
    const m = c.reduce((a, x) => ({ g: a.g + x.metricas.gasto, gv: a.gv + (esVenta(x) ? x.metricas.gasto : 0), conv: a.conv + x.metricas.conversaciones, l: a.l + x.crm.leads, v: a.v + x.crm.ventas, $: a.$ + x.crm.monto }), { g: 0, gv: 0, conv: 0, l: 0, v: 0, $: 0 });
    const cu = n => (n && m.gv ? ' · ' + usd(div(m.gv, n)) + ' c/u' : '');
    const k = [
      ['Gasto', usd(m.g), 'fa-dollar-sign', 'var(--blue)'],
      ['Chats (Meta)', ent(m.conv), 'fa-comments', 'var(--purple)'],
      ['Leads CRM', `${ent(m.l)}${cu(m.l)}`, 'fa-user-plus', 'var(--amber)'],
      ['Ventas', `${ent(m.v)}${cu(m.v)}`, 'fa-cart-shopping', 'var(--green)'],
      ['Vendido / gasto', m.gv ? (m.$ / m.gv).toFixed(1) + 'x' : '—', 'fa-scale-balanced', 'var(--accent)'],
    ];
    $('#am-kpis').innerHTML = k.map(c => `<div class="kpi" style="--kc:${c[3]}"><div class="kt"><i class="fas ${c[2]}"></i>${c[0]}</div><div class="kv">${c[1]}</div></div>`).join('');
  }

  const estado = e => `<span class="am-est${e === 'active' ? ' on' : ''}">${e === 'active' ? 'Activo' : e === 'paused' ? 'Pausado' : esc(e || '—')}</span>`;
  const objetivo = o => (o ? esc(OBJETIVOS[o] || o.replace(/^OUTCOME_/, '').replace(/_/g, ' ').toLowerCase()) : '');
  const foto = (a, clase) => (a.miniatura ? `<img src="${esc(a.miniatura)}" alt="" loading="lazy">` : `<i class="fas fa-bullhorn${clase ? ' ' + clase : ''}"></i>`);

  function resultado(m) {
    if (m.conversaciones) return `${ent(m.conversaciones)} chats · ${usd(div(m.gasto, m.conversaciones))} c/u`;
    if (m.clics) return `${ent(m.clics)} clics · ${usd(div(m.gasto, m.clics))} c/u`;
    return `${ent(m.alcance)} de alcance`;
  }
  const lineaCrm = c => [c.leads ? `${ent(c.leads)} lead${c.leads > 1 ? 's' : ''}` : '', c.ventas ? `${ent(c.ventas)} venta${c.ventas > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');

  const editable = n => admin && ['active', 'paused'].includes(n.estado);
  const dato = (nivel, n, plataforma) => `data-nivel="${nivel}" data-id="${esc(n.id)}" data-plat="${esc(plataforma)}" data-nombre="${esc(n.nombre)}" data-estado="${esc(n.estado)}"`;
  const btnPresupuesto = (nivel, n, plataforma) => (editable(n) && n.presupuesto?.tipo === 'daily'
    ? `<button class="btn-sm" type="button" data-am="presupuesto" ${dato(nivel, n, plataforma)} data-monto="${n.presupuesto.monto}" title="Presupuesto diario">${usd(n.presupuesto.monto)}/día</button>` : '');
  const btnEstado = (nivel, n, plataforma) => (editable(n)
    ? `<button class="btn-sm" type="button" data-am="estado" ${dato(nivel, n, plataforma)} title="${n.estado === 'active' ? 'Pausar' : 'Activar'}" aria-label="${n.estado === 'active' ? 'Pausar' : 'Activar'}"><i class="fas fa-${n.estado === 'active' ? 'pause' : 'play'}"></i></button>` : '');
  const btnPublico = s => (editable(s) ? `<button class="btn-sm" type="button" data-am="publico" data-id="${esc(s.id)}" data-nombre="${esc(s.nombre)}"><i class="fas fa-users"></i> Editar público</button>` : '');
  const grupo = (...b) => (b.join('') ? `<span class="am-acc">${b.join('')}</span>` : '');
  const botones = (nivel, n, plataforma, conPresupuesto) => grupo(conPresupuesto ? btnPresupuesto(nivel, n, plataforma) : '', btnEstado(nivel, n, plataforma));

  // Presupuesto CBO vive en la campaña; ABO con un solo conjunto (los boosts) se edita desde la campaña igual.
  function accionesCamp(camp) {
    const unico = camp.nivel_presupuesto !== 'campaign' && camp.conjuntos.length === 1 ? camp.conjuntos[0] : null;
    const pres = camp.nivel_presupuesto === 'campaign' ? btnPresupuesto('campana', camp, camp.plataforma) : unico ? btnPresupuesto('conjunto', unico, camp.plataforma) : '';
    return grupo(pres, btnEstado('campana', camp, camp.plataforma));
  }

  // Las aplica el cron de las 11:20 UTC (7:20 a. m. en Caracas) del día elegido.
  const diaPausa = p => new Date(p.pausar_en).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', timeZone: 'America/Caracas' });
  const lineaPausa = camp => (pausas.has(camp.id) ? `<div class="am-prog"><i class="fas fa-clock"></i> Se pausa el ${diaPausa(pausas.get(camp.id))}</div>` : '');
  function btnPausa(camp) {
    if (!admin) return '';
    const p = pausas.get(camp.id);
    if (p) return `<button class="btn-sm" type="button" data-am="prog-cancelar" data-pausa="${p.id}" data-nombre="${esc(camp.nombre)}">Cancelar pausa del ${diaPausa(p)}</button>`;
    return camp.estado === 'active' ? `<button class="btn-sm" type="button" data-am="prog" ${dato('campana', camp, camp.plataforma)}><i class="fas fa-clock"></i> Pausar el…</button>` : '';
  }

  // Lotus es lo normal: la etiqueta solo aparece en las campañas de clientes.
  function chipMarca(camp) {
    const m = marcaDe(camp.marca_id);
    return m && !m.es_lotus ? `<span class="am-tipo am-marca" data-color="${esc(m.color || 'accent')}">${esc(m.nombre)}</span>` : '';
  }

  function tarjeta(camp) {
    const crm = lineaCrm(camp.crm), pie = accionesCamp(camp);
    return `<article class="am-card" data-camp="${esc(camp.id)}" tabindex="0" role="button" aria-label="${esc(camp.nombre)}">
      <div class="am-foto">${foto(portada(camp))}${estado(camp.estado)}</div>
      <div class="am-cuerpo"><div class="am-tit">${esc(camp.nombre)}</div><div class="am-gasto">${usd(camp.metricas.gasto)}</div>
        <div class="am-res">${resultado(camp.metricas)}</div>${crm ? `<div class="am-crm">${crm}</div>` : ''}${lineaPausa(camp)}${esVenta(camp) ? '' : `<span class="am-tipo">${TIPOS[tipoDe(camp)]}</span>`}${chipMarca(camp)}</div>
      ${pie ? `<div class="am-pie">${pie}</div>` : ''}</article>`;
  }

  function visibles() {
    return (datos?.campanas || []).filter(x => (!busca || norm(x.nombre).includes(busca)) && (!tipoFiltro || tipoDe(x) === tipoFiltro) && (!marcaFiltro || String(x.marca_id) === marcaFiltro));
  }

  // Solo se ofrece si hay campañas de más de una marca en esta cuenta y rango.
  function pintarMarcas() {
    const sel = $('#am-marca'), ids = new Set((datos?.campanas || []).map(x => x.marca_id));
    if (marcaFiltro && !ids.has(Number(marcaFiltro))) marcaFiltro = '';
    sel.hidden = ids.size < 2 && !marcaFiltro;
    sel.innerHTML = '<option value="">Todas las marcas</option>' + (datos?.marcas || []).filter(m => ids.has(m.id))
      .map(m => `<option value="${m.id}"${String(m.id) === marcaFiltro ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('');
  }

  function pintarArbol() {
    pintarMarcas();
    const todas = datos?.campanas || [], c = visibles();
    kpis(c);
    $('#am-sinc').textContent = datos?.sincronizado ? 'Meta sincronizado ' + new Date(datos.sincronizado).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '';
    const aviso = datos?.errores?.crm ? '<div class="am-aviso">No se pudieron leer los leads del CRM: leads y ventas pueden estar en cero.</div>' : '';
    if (!todas.length) {
      $('#am-cuerpo').innerHTML = conGasto
        ? `<div class="am-vacio">Ninguna campaña gastó en estos ${dias} días.<br><button class="btn-sm" type="button" data-am="gasto">Ver todas</button></div>`
        : '<div class="am-vacio">Sin campañas en este período.</div>';
    } else if (!c.length) {
      $('#am-cuerpo').innerHTML = `<div class="am-vacio">Ninguna campaña coincide con ${busca ? 'la búsqueda' : 'el tipo elegido'}.</div>`;
    } else {
      $('#am-cuerpo').innerHTML = `<div class="am-grid">${c.map(tarjeta).join('')}</div>${aviso}`;
    }
    if (campSel) pintarDetalle();
  }

  function pintarDetalle() {
    const camp = (datos?.campanas || []).find(x => x.id === campSel);
    if (!camp) return cerrar();
    const m = camp.metricas, c = camp.crm, p = portada(camp), v = esVenta(camp);
    const met = [
      ['Gasto', usd(m.gasto)], ['Alcance', ent(m.alcance)], ['Clics', ent(m.clics)], ['Chats', ent(m.conversaciones)],
      ['Leads', ent(c.leads), 1], ['$/lead', v && c.leads ? usd(div(m.gasto, c.leads)) : '—', 1],
      ['Ventas', ent(c.ventas), 1], ['$/venta', v && c.ventas ? usd(div(m.gasto, c.ventas)) : '—', 1],
    ];
    const tipo = admin
      ? `<label class="fl am-tipo-sel">Tipo<select class="ei" id="am-tipo-camp" data-id="${esc(camp.id)}" data-nombre="${esc(camp.nombre)}">
          <option value="auto"${camp.tipo_fijado ? '' : ' selected'}>Automático${camp.tipo_fijado ? '' : ' · ' + TIPOS[tipoDe(camp)]}</option>
          ${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}"${camp.tipo_fijado && camp.tipo === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
        <div class="am-aviso">Solo las de venta cuentan en el costo por lead y por venta.</div>
        <label class="fl am-tipo-sel">Fecha del evento<input type="date" class="ei" id="am-evento" data-id="${esc(camp.id)}" data-nombre="${esc(camp.nombre)}" value="${esc(camp.fecha_evento || '')}"></label>
        <div class="am-aviso">Si pasa esa fecha y la campaña sigue gastando, el agente pide en Telegram permiso para pausarla.</div>
        ${(datos?.marcas || []).length > 1 ? `<label class="fl am-tipo-sel">Marca<select class="ei" id="am-marca-camp" data-id="${esc(camp.id)}" data-nombre="${esc(camp.nombre)}">
          <option value="auto"${camp.marca_fijada ? '' : ' selected'}>Según la cuenta · ${esc(marcaDe(datos.marca_cuenta)?.nombre || 'Lotus')}</option>
          ${datos.marcas.filter(m => m.activa || m.id === camp.marca_id).map(m => `<option value="${m.id}"${camp.marca_fijada && camp.marca_id === m.id ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
        <div class="am-aviso">El gasto de esta campaña cuenta para esa marca en su reporte. El informe diario de Telegram es solo de Lotus.</div>` : ''}`
      : '';
    const fila = a => `<div class="am-anun">${a.miniatura ? `<img src="${esc(a.miniatura)}" alt="" loading="lazy">` : '<span class="am-sin"><i class="fas fa-bullhorn"></i></span>'}
      <div>${a.enlace ? `<a href="${esc(a.enlace)}" target="_blank" rel="noopener">${esc(a.nombre)}</a>` : esc(a.nombre)}
        <small>${estado(a.estado)} ${usd(a.metricas.gasto)} · ${resultado(a.metricas)}</small></div>${botones('anuncio', a, camp.plataforma, false)}</div>`;
    const lista = camp.conjuntos.length > 1
      ? camp.conjuntos.map(s => `<div class="am-conj"><div class="am-conj-cab"><div>${esc(s.nombre)}<small>${estado(s.estado)} ${esc(s.destino || '')} · ${usd(s.metricas.gasto)}</small></div>
          ${botones('conjunto', s, camp.plataforma, camp.nivel_presupuesto !== 'campaign')}${grupo(btnPublico(s))}</div>${s.anuncios.map(fila).join('')}</div>`).join('')
      : anuncios(camp).map(fila).join('');
    const n = anuncios(camp).length;
    cajon.querySelector('#am-det').innerHTML = `
      <h3 class="am-det-tit">${esc(camp.nombre)}</h3>
      <div class="am-det-sub">${estado(camp.estado)}${objetivo(camp.objetivo)}<span class="am-tipo">${TIPOS[tipoDe(camp)]}</span></div>
      ${p.enlace ? `<a class="am-det-foto" href="${esc(p.enlace)}" target="_blank" rel="noopener">${foto(p)}<span class="am-ver">Ver en Instagram ↗</span></a>` : `<div class="am-det-foto">${foto(p)}</div>`}
      ${accionesCamp(camp)}${camp.conjuntos.length === 1 ? grupo(btnPublico(camp.conjuntos[0])) : ''}${lineaPausa(camp)}${grupo(btnPausa(camp))}${tipo}
      <div class="am-met">${met.map(x => `<div${x[2] ? ' class="crm"' : ''}><small>${x[0]}</small><b>${x[1]}</b></div>`).join('')}</div>
      <div class="am-det-h">${n} anuncio${n === 1 ? '' : 's'}</div>${lista || '<div class="am-aviso">Sin anuncios en este período.</div>'}`;
  }

  function abrir(id) {
    campSel = id;
    pintarDetalle();
    fondo.classList.add('open'); cajon.classList.add('open');
    cajon.querySelector('.dclose').focus();
  }

  // La grilla se repinta tras cada acción: el foco vuelve a la tarjeta por id, no por nodo.
  function cerrar() {
    if (!campSel) return;
    const id = campSel;
    campSel = null;
    fondo.classList.remove('open'); cajon.classList.remove('open');
    raiz.querySelector(`.am-card[data-camp="${window.CSS.escape(id)}"]`)?.focus();
  }

  // Gana el último pedido: cambiar cuenta o rango mientras carga no pinta datos viejos.
  async function cargarArbol() {
    if (!cuenta) return;
    const n = ++pedido;
    $('#am-cuerpo').innerHTML = '<div class="am-vacio">Cargando…</div>';
    try {
      const [d, pp] = await Promise.all([
        invocar({ accion: 'arbol', cuenta, desde: haceDias(dias), hasta: iso(new Date()), con_gasto: conGasto }),
        invocar({ accion: 'pausas' }).catch(() => null),
      ]);
      if (n !== pedido || vista !== 'arbol') return;
      datos = d;
      if (pp) pausas = new Map((pp.pausas || []).map(p => [p.objeto_id, p]));
      pintarArbol();
    } catch (e) {
      if (n === pedido) $('#am-cuerpo').innerHTML = `<div class="am-vacio">${esc(e.message)}</div>`;
    }
  }

  async function cambiarEstado(d) {
    const nuevo = d.estado === 'active' ? 'paused' : 'active';
    const si = await confirmar({
      titulo: `${nuevo === 'paused' ? 'Pausar' : 'Activar'} ${d.nivel}`,
      detalle: `«${d.nombre}»\n${nuevo === 'active' ? 'Empieza a gastar plata real en Meta.' : 'Deja de gastar hasta que lo actives.'}`,
      textoOk: nuevo === 'paused' ? 'Pausar' : 'Activar y gastar', destructivo: nuevo === 'active',
    });
    if (!si) return;
    try {
      await invocar({ accion: 'estado', nivel: d.nivel, id: d.id, estado: nuevo, estado_antes: d.estado, plataforma: d.plat, nombre: d.nombre });
      ok(nuevo === 'paused' ? 'Pausado en Meta' : 'Activado en Meta');
      cargarArbol();
    } catch (e) { error(e.message); }
  }

  async function programarPausa(d) {
    const manana = iso(new Date(Date.now() + 86400000));
    const r = await confirmar({
      titulo: 'Pausar en una fecha', detalle: `«${d.nombre}»\nSe pausa sola ese día a las 7:20 a. m. (hora Caracas). Sirve para boosts sin fecha de fin.`,
      textoOk: 'Programar', campos: [
        { id: 'fecha', label: 'Día', tipo: 'date', valor: manana, requerido: true },
        { id: 'motivo', label: 'Motivo', tipo: 'text', placeholder: 'Ej.: el evento terminó' },
      ],
    });
    if (!r) return;
    try {
      await invocar({ accion: 'pausa_programar', nivel: d.nivel, id: d.id, nombre: d.nombre, motivo: r.motivo, pausar_en: `${r.fecha}T11:00:00Z` });
      ok('Pausa programada');
      cargarArbol();
    } catch (e) { error(e.message); }
  }

  async function cancelarPausa(d) {
    if (!await confirmar({ titulo: 'Cancelar pausa programada', detalle: `«${d.nombre}»\nSigue activa hasta que la pauses a mano.`, textoOk: 'Cancelar pausa' })) return;
    try {
      await invocar({ accion: 'pausa_cancelar', pausa_id: Number(d.pausa) });
      ok('Pausa cancelada');
      cargarArbol();
    } catch (e) { error(e.message); }
  }

  async function cambiarTipo(sel) {
    sel.disabled = true;
    try {
      await invocar({ accion: 'tipo', id: sel.dataset.id, tipo: sel.value, nombre: sel.dataset.nombre });
      ok('Tipo guardado');
      cargarArbol();
    } catch (e) { error(e.message); sel.disabled = false; }
  }

  async function cambiarEvento(inp) {
    inp.disabled = true;
    try {
      await invocar({ accion: 'evento', id: inp.dataset.id, fecha: inp.value || null, nombre: inp.dataset.nombre });
      ok(inp.value ? 'Fecha del evento guardada' : 'Fecha del evento borrada');
      cargarArbol();
    } catch (e) { error(e.message); inp.disabled = false; }
  }

  async function cambiarMarca(sel) {
    sel.disabled = true;
    try {
      await invocar({ accion: 'marca', id: sel.dataset.id, marca_id: sel.value === 'auto' ? null : Number(sel.value), nombre: sel.dataset.nombre });
      ok('Marca guardada');
      cargarArbol();
    } catch (e) { error(e.message); sel.disabled = false; }
  }

  async function cambiarPresupuesto(d) {
    const r = await confirmar({
      titulo: 'Presupuesto diario', detalle: `«${d.nombre}»\nAhora: ${usd(d.monto)} por día. Tope desde el CRM: ${usd(tope)}.`,
      textoOk: 'Guardar', campos: [{ id: 'monto', label: 'Nuevo presupuesto diario (USD)', tipo: 'number', valor: d.monto, min: 1, max: tope, step: '0.5', requerido: true }],
    });
    if (!r) return;
    try {
      await invocar({ accion: 'presupuesto', nivel: d.nivel, id: d.id, monto: Number(r.monto), monto_antes: Number(d.monto), plataforma: d.plat, nombre: d.nombre });
      ok('Presupuesto actualizado en Meta');
      cargarArbol();
    } catch (e) { error(e.message); }
  }

  async function abrirNuevo() {
    vista = 'nuevo'; postSel = null;
    cerrar();
    $('#am-kpis').innerHTML = '';
    $('#am-cuerpo').innerHTML = '<div class="am-vacio">Cargando publicaciones…</div>';
    try {
      if (igs.cuenta !== cuenta) {
        const r = await invocar({ accion: 'ig_cuentas', cuenta }).catch(() => ({ cuentas: [], propio: null }));
        igs = { cuenta, lista: r.cuentas || [], propio: r.propio };
        if (!igs.lista.some(c => c.id === igSel)) igSel = igs.propio || '';
      }
      const r = await invocar({ accion: 'posts_ranking', cuenta, ig: igSel || undefined });
      posts = r.posts; cobertura = r.cobertura;
    } catch (e) { $('#am-cuerpo').innerHTML = `<div class="am-vacio">${esc(e.message)}</div>`; return; }
    const selIg = igs.lista.length > 1 ? `<label class="fl">Cuenta de Instagram<select class="ei" id="am-ig">${igs.lista.map(c => `<option value="${esc(c.id)}"${c.id === igSel ? ' selected' : ''}>@${esc(c.usuario)}</option>`).join('')}</select></label>` : '';
    $('#am-cuerpo').innerHTML = `<div class="card">
      <div class="pvc-cab"><h2>Promocionar un post de Instagram</h2><button class="btn-sm" type="button" data-am="volver"><i class="fas fa-arrow-left"></i> Volver</button></div>
      ${selIg}
      ${cobertura ? `<div class="am-aviso">Solo ${ent(cobertura.con_post)} de ${ent(cobertura.leads)} leads de Instagram desde el ${esc(cobertura.desde)} tienen publicación identificada (los que entran por comentario). Orden: leads y luego interacciones; las ventas se muestran, no pesan en el orden.</div>` : ''}
      <div class="am-posts">${posts.map(p => `<button class="am-post" type="button" data-post="${esc(p.id)}">${p.miniatura ? `<img src="${esc(p.miniatura)}" alt="" loading="lazy">` : ''}<div>${esc((p.fecha || '').slice(0, 10))}${p.alcance == null ? '' : ` · alcance ${ent(p.alcance)}`}<br>${esc((p.texto || '').slice(0, 70))}<span class="am-post-datos">${ent(p.leads)} leads · ${ent(p.ventas)} ventas${p.interacciones == null ? '' : ` · ${ent(p.interacciones)} interacciones`}</span><span class="am-post-pagar">Pagar este post</span></div></button>`).join('') || '<div class="am-vacio">Sin publicaciones recientes.</div>'}</div>
      <div class="am-form">
        <label class="fl">Nombre<input class="ei" id="am-nombre" maxlength="120" placeholder="Ej.: Mérida diciembre"></label>
        <label class="fl">Botón<select class="ei" id="am-cta">${CTAS.map(c => `<option value="${c.v}">${c.t}</option>`).join('')}</select></label>
        <label class="fl">Diario (USD)<input class="ei" id="am-diario" type="number" min="1" max="${tope}" step="0.5" value="3"></label>
        <label class="fl">Días<input class="ei" id="am-dias-boost" type="number" min="1" max="30" value="7"></label>
      </div>
      <div class="am-det-h">¿Qué buscas con este anuncio?</div>
      <div class="am-ia"><textarea class="ei" id="am-que" rows="2" maxlength="600" aria-label="Qué buscas con este anuncio" placeholder="Ej.: que me escriban jóvenes de Mérida y Caracas para comprar entradas"></textarea>
        <button class="btn-sm" type="button" data-am="sugerir"><i class="fas fa-wand-magic-sparkles"></i> Sugerir con IA</button></div>
      <div class="am-vars" id="am-vars"></div>
      <div class="am-det-h">Público</div>
      ${selPrevios()}
      <div id="am-pub"></div>
      <button class="btn-sm lt-primario" type="button" data-am="validar"><i class="fas fa-check"></i> Revisar con Meta</button>
      <div class="am-aviso">Primero Meta lo revisa sin crear nada. Al confirmar se crea <b>en pausa</b>: se activa desde la lista, con fecha de fin siempre.</div></div>`;
    variantes = [];
    abrirPublico(pubBase(), { modo: 'boost', audiencias: [], noEditable: {} });
    invocar({ accion: 'audiencias', cuenta }).then(r => { if (pubCtx?.modo === 'boost' && r.audiencias?.length) { pubCtx.audiencias = r.audiencias; pintarPublico(); } }).catch(() => {});
  }

  function leerBoost() {
    return {
      accion: 'boost', cuenta, post: postSel, ig: igSel || undefined,
      nombre: $('#am-nombre').value.trim(), cta: $('#am-cta').value,
      diario: Number($('#am-diario').value), dias: Number($('#am-dias-boost').value),
      publico: pub,
    };
  }

  async function validarBoost() {
    if (ocupado) return;
    const b = leerBoost();
    if (!b.post) return error('Elige una publicación.');
    if (!b.nombre) return error('Ponle un nombre.');
    if (!pub.ubicaciones.length) return error('Elige al menos una ubicación.');
    ocupado = true;
    try {
      ok('Meta lo está revisando: tarda cerca de un minuto…');
      const v = await invocar(b);
      const r = v.resumen;
      const comoIg = r.ig ? `Anuncia como @${igs.lista.find(c => c.id === r.ig)?.usuario || r.ig}.\n` : '';
      const si = await confirmar({
        titulo: 'Meta lo aceptó: ¿crear en pausa?',
        detalle: `«${r.nombre}»\n${comoIg}${usd(r.diario)} por día × ${r.dias} días (máximo ${usd(r.total_max)}), hasta ${r.fin}.\nPúblico: ${r.publico ? textoPub(r.publico) : r.paises.join(', ')}.\nQueda pausada: no gasta hasta que la actives.`,
        textoOk: 'Crear en pausa',
      });
      if (!si) return;
      ok('Creando en pausa: tarda cerca de un minuto…');
      await invocar({ ...b, confirmar: true });
      ok('Campaña creada en pausa');
      vista = 'arbol';
      cargarArbol();
    } catch (e) { error(e.message); } finally { ocupado = false; }
  }

  // Editor de público: el mismo en «Promocionar» (boost) y en «Editar público» de un conjunto.
  // En edición solo viajan las secciones tocadas (`cambios`): lo que el CRM no muestra queda igual en Meta.
  const pubBase = () => ({ edad_min: 18, edad_max: 65, genero: 'todos', ubicaciones: [{ tipo: 'pais', codigo: 'VE', nombre: 'Venezuela' }], intereses: [], audiencias_incluir: [], audiencias_excluir: [], advantage: false, ubicaciones_anuncio: [] });
  const nombreUbic = u => (u.tipo === 'pais' ? u.nombre || u.codigo : `${u.nombre}${u.tipo === 'ciudad' && u.region ? ` (${u.region})` : ''}`);
  const textoPub = r => [
    `${r.edad} años`, r.genero !== 'todos' ? r.genero : '', [...r.paises, ...r.regiones, ...r.ciudades].join(', '),
    r.intereses.length ? r.intereses.slice(0, 5).join(', ') + (r.intereses.length > 5 ? '…' : '') : 'sin intereses',
    r.advantage ? 'Advantage+' : '', Array.isArray(r.ubicaciones_anuncio) ? r.ubicaciones_anuncio.join('/') : '',
  ].filter(Boolean).join(' · ');
  const marcar = sec => pubCtx.cambios.add(sec);
  const paisBase = () => pub.ubicaciones.find(u => u.pais)?.pais || pub.ubicaciones.find(u => u.tipo === 'pais')?.codigo || 'VE';

  function abrirPublico(p, ctx) {
    pub = p;
    pub.ubicaciones.forEach(u => { if (u.tipo === 'pais' && !u.nombre) u.nombre = u.codigo; });
    pubCtx = { cambios: new Set(), ...ctx };
    pintarPublico();
  }

  function htmlPublico() {
    const p = pub, ne = pubCtx.noEditable || {}, pos = p.ubicaciones_anuncio;
    const radio = (u, i) => `<select data-radio="${i}" aria-label="Radio alrededor de ${esc(u.nombre)}">${RADIOS.map(r => `<option value="${r}"${(u.radio_km || 0) === r ? ' selected' : ''}>${r ? `+${r} km` : 'solo la ciudad'}</option>`).join('')}</select>`;
    const quitar = (a, i, n) => `<button type="button" data-am="${a}" data-i="${i}" aria-label="Quitar ${esc(n)}">✕</button>`;
    const ubic = p.ubicaciones.map((u, i) => `<span class="am-tag">${esc(nombreUbic(u))}${u.tipo === 'ciudad' ? radio(u, i) : ''}${quitar('ubic-x', i, nombreUbic(u))}</span>`).join('');
    const ints = p.intereses.map((x, i) => `<span class="am-tag">${esc(x.nombre)}${quitar('int-x', i, x.nombre)}</span>`).join('');
    const auds = pubCtx.audiencias.map(a => {
      const v = p.audiencias_incluir.includes(a.id) ? 'in' : p.audiencias_excluir.includes(a.id) ? 'ex' : '';
      return `<label class="fl">${esc(a.nombre)}${a.tamano ? ` · ${compacto(a.tamano)}` : ''}<select class="ei" data-aud="${esc(a.id)}"><option value="">No usar</option><option value="in"${v === 'in' ? ' selected' : ''}>Incluir</option><option value="ex"${v === 'ex' ? ' selected' : ''}>Excluir</option></select></label>`;
    }).join('');
    return `
      <div class="am-fila">
        <label class="fl">Edad desde<input class="ei" id="am-edad-min" type="number" min="18" max="65" value="${p.edad_min}"></label>
        <label class="fl">Hasta<input class="ei" id="am-edad-max" type="number" min="18" max="65" value="${p.edad_max}"></label>
        <div class="fl">Género<div class="seg-group">${GENEROS.map(([v, t]) => `<button class="seg${p.genero === v ? ' on' : ''}" type="button" data-am="genero" data-v="${v}">${t}</button>`).join('')}</div></div>
      </div>
      ${p.advantage ? '<div class="am-aviso">Con Advantage+ la edad es solo una sugerencia: va de 25 o menos hasta 65.</div>' : ''}
      <div class="am-det-h">Ubicaciones</div>
      ${ne.ubicaciones ? `<div class="am-aviso">Tiene ${ne.ubicaciones} ubicación${ne.ubicaciones > 1 ? 'es' : ''} marcada${ne.ubicaciones > 1 ? 's' : ''} en el mapa que acá no se ve${ne.ubicaciones > 1 ? 'n' : ''}. Si cambias las ubicaciones, se reemplazan.</div>` : ''}
      <div class="am-chips">${ubic || '<span class="am-aviso">Sin ubicaciones.</span>'}</div>
      <div class="am-fila"><select class="ei" id="am-geo-tipo" aria-label="Tipo de ubicación"><option value="ciudad">Ciudad</option><option value="region">Estado</option><option value="pais">País</option></select>
        <div class="am-auto"><input class="ei" id="am-geo-q" type="search" placeholder="Buscar ciudad, estado o país" autocomplete="off" aria-label="Buscar ubicación"><div class="am-sugs" id="am-geo-sugs" hidden></div></div></div>
      <div class="am-det-h">Intereses</div>
      ${ne.intereses ? '<div class="am-aviso">Tiene otros grupos de intereses o comportamientos en Ads Manager. Si cambias los intereses, se reemplazan los de este grupo.</div>' : ''}
      <div class="am-chips">${ints || '<span class="am-aviso">Sin intereses: Meta busca entre todos.</span>'}</div>
      <div class="am-auto"><input class="ei" id="am-int-q" type="search" placeholder="Buscar interés (ej.: Travel, Parties, Beaches)" autocomplete="off" aria-label="Buscar interés"><div class="am-sugs" id="am-int-sugs" hidden></div></div>
      ${auds ? `<div class="am-det-h">Audiencias guardadas</div><div class="am-form">${auds}</div>` : ''}
      <div class="am-det-h">Dónde se ve</div>
      ${pos === null ? '<div class="am-aviso">Tiene ubicaciones elegidas en Ads Manager que acá no se muestran: no se tocan.</div>'
        : `<div class="am-chips">${POSICIONES.map(([v, t]) => `<button class="am-chip${pos.includes(v) ? ' on' : ''}" type="button" data-am="pos" data-v="${v}" aria-pressed="${pos.includes(v)}">${t}</button>`).join('')}</div>
        <div class="am-aviso">${pos.length ? 'Solo en Instagram, en lo marcado.' : 'Nada marcado: automáticas (Meta elige; puede incluir Facebook).'}</div>`}
      ${pubCtx.modo === 'boost' ? `<label class="am-check"><input type="checkbox" id="am-adv"${p.advantage ? ' checked' : ''}> Advantage+: que Meta amplíe el público si encuentra mejores resultados</label>` : ''}
      <div class="am-alc" id="am-alc" aria-live="polite"></div>`;
  }

  function pintarPublico(foco) {
    const el = document.getElementById('am-pub');
    if (!el || !pub) return;
    el.innerHTML = htmlPublico();
    if (foco) document.getElementById(foco)?.focus();
    refrescarAlcance();
  }

  function refrescarAlcance() {
    clearTimeout(tAlc);
    const el = () => document.getElementById('am-alc');
    if (!el()) return;
    if (!pub.ubicaciones.length) { el().innerHTML = '<small>Agrega una ubicación para estimar el alcance.</small>'; return; }
    el().innerHTML = '<small>Calculando alcance…</small>';
    const n = ++nAlc;
    tAlc = setTimeout(async () => {
      try {
        const r = await invocar({ accion: 'alcance', cuenta, publico: pub });
        if (n !== nAlc || !el()) return;
        el().innerHTML = r.alcance.estimable ? `Alcance estimado: ${compacto(r.alcance.min)} – ${compacto(r.alcance.max)} personas` : '<small>Meta no pudo estimar el alcance de este público.</small>';
      } catch (e) { if (n === nAlc && el()) el().innerHTML = `<small>${esc(e.message)}</small>`; }
    }, 700);
  }

  // Autocompletar contra Meta (vía la EF): solo se agrega lo que Meta reconoce.
  function buscarPub(tipo, q) {
    clearTimeout(tBusca);
    const caja = document.getElementById(tipo === 'geo' ? 'am-geo-sugs' : 'am-int-sugs');
    if (q.length < 2) { caja.hidden = true; return; }
    const n = ++nBusca, geoTipo = document.getElementById('am-geo-tipo').value;
    const base = tipo === 'geo' ? `geo|${geoTipo}|${geoTipo === 'pais' ? '' : paisBase()}|` : 'int|', clave = base + norm(q);
    const mostrar = (lista, buscando) => {
      sugs[tipo] = lista;
      caja.innerHTML = lista.map((x, i) => `<button type="button" data-am="${tipo}-add" data-i="${i}">${esc(x.nombre)}<small>${esc([x.ruta, x.tamano ? `${compacto(x.tamano)} personas` : ''].filter(Boolean).join(' · '))}</small></button>`).join('')
        + (buscando ? '<div class="am-aviso">Buscando en Meta…</div>' : lista.length ? '' : '<div class="am-aviso">Meta no reconoce nada con ese nombre.</div>');
      caja.hidden = false;
    };
    if (cacheBusca.has(clave)) return mostrar(cacheBusca.get(clave));
    // Mientras Meta responde (~2 s), se filtra lo que ya trajo una búsqueda más corta.
    const previa = [...cacheBusca.keys()].filter(k => k.startsWith(base) && clave.startsWith(k)).sort((a, b) => b.length - a.length)[0];
    mostrar(previa ? cacheBusca.get(previa).filter(x => norm(x.nombre).includes(norm(q))) : [], true);
    tBusca = setTimeout(async () => {
      try {
        const r = tipo === 'geo'
          ? await invocar({ accion: 'geo_buscar', q, tipo: geoTipo, pais: geoTipo === 'pais' ? undefined : paisBase() })
          : await invocar({ accion: 'intereses_buscar', q });
        const lista = (tipo === 'geo' ? r.resultados : r.intereses) || [];
        cacheBusca.set(clave, lista);
        if (n === nBusca) mostrar(lista);
      } catch (e) {
        if (n === nBusca) { caja.innerHTML = `<div class="am-aviso">${esc(e.message)}</div>`; caja.hidden = false; }
      }
    }, 250);
  }

  function agregarGeo(x) {
    if (!x) return;
    const u = x.tipo === 'pais' ? { tipo: 'pais', codigo: x.pais || x.key, nombre: x.nombre } : { tipo: x.tipo, key: x.key, nombre: x.nombre, pais: x.pais, ...(x.region ? { region: x.region } : {}) };
    if (!pub.ubicaciones.some(y => (y.key || y.codigo) === (u.key || u.codigo))) pub.ubicaciones.push(u);
    // Meta rechaza un país junto con una ciudad o estado de ese país: queda lo más fino.
    if (u.tipo !== 'pais') pub.ubicaciones = pub.ubicaciones.filter(y => !(y.tipo === 'pais' && y.codigo === u.pais));
    marcar('ubicaciones'); pintarPublico('am-geo-q');
  }

  function agregarInteres(x) {
    if (!x) return;
    if (!pub.intereses.some(y => y.id === x.id)) pub.intereses.push({ id: x.id, nombre: x.nombre });
    marcar('intereses'); pintarPublico('am-int-q');
  }

  function inputPublico(e) {
    if (e.target.id === 'am-geo-q') buscarPub('geo', e.target.value.trim());
    if (e.target.id === 'am-int-q') buscarPub('int', e.target.value.trim());
  }

  function cambioPublico(e) {
    const t = e.target;
    if (!pub || !t.closest('#am-pub')) return;
    if (t.id === 'am-edad-min' || t.id === 'am-edad-max') {
      pub[t.id === 'am-edad-min' ? 'edad_min' : 'edad_max'] = Math.min(65, Math.max(18, Number(t.value) || 18));
      marcar('edad'); return refrescarAlcance();
    }
    if (t.dataset.radio != null) {
      const u = pub.ubicaciones[Number(t.dataset.radio)], r = Number(t.value);
      if (r) u.radio_km = r; else delete u.radio_km;
      marcar('ubicaciones'); return refrescarAlcance();
    }
    if (t.dataset.aud) {
      const id = t.dataset.aud;
      pub.audiencias_incluir = pub.audiencias_incluir.filter(x => x !== id).concat(t.value === 'in' ? [id] : []);
      pub.audiencias_excluir = pub.audiencias_excluir.filter(x => x !== id).concat(t.value === 'ex' ? [id] : []);
      marcar('audiencias'); return refrescarAlcance();
    }
    if (t.id === 'am-adv') {
      pub.advantage = t.checked;
      if (pub.advantage) { pub.edad_min = Math.min(pub.edad_min, 25); pub.edad_max = 65; }
      pintarPublico();
    }
  }

  async function sugerir() {
    if (ocupado) return;
    const que = $('#am-que').value.trim();
    if (que.length < 3) return error('Cuenta qué buscas con el anuncio.');
    const caja = $('#am-vars'), p = posts.find(x => x.id === postSel);
    caja.innerHTML = '<div class="am-aviso">La IA arma 3 públicos y Meta calcula el alcance de cada uno: tarda cerca de medio minuto…</div>';
    ocupado = true;
    try {
      const r = await invocar({ accion: 'sugerir_publico', cuenta, que_buscas: que, caption: p?.texto || '', cuenta_ig: igs.lista.find(c => c.id === igSel)?.usuario || '' });
      variantes = r.variantes || [];
      caja.innerHTML = variantes.map((v, i) => (v.error ? `<div class="am-var"><b>${esc(v.nombre)}</b><p>${esc(v.error)}</p></div>` : `<div class="am-var"><b>${esc(v.nombre)}</b>
        <p>${esc(v.porque)}</p><span>${esc(textoPub(v.resumen))}</span>
        <span>${v.alcance?.estimable ? `${compacto(v.alcance.min)} – ${compacto(v.alcance.max)} personas` : 'Alcance sin estimar'} · ${usd(v.diario)}/día × ${v.dias} días</span>
        ${v.descartados?.length ? `<small class="am-aviso">Meta no reconoció: ${esc(v.descartados.join(', '))}</small>` : ''}
        <button class="btn-sm" type="button" data-am="usar" data-i="${i}">Usar esta</button></div>`)).join('');
    } catch (e) { caja.innerHTML = ''; error(e.message); } finally { ocupado = false; }
  }

  function usarVariante(i) {
    const v = variantes[i];
    if (!v?.publico) return;
    abrirPublico(structuredClone(v.publico), { modo: 'boost', audiencias: pubCtx.audiencias, noEditable: {} });
    $('#am-cta').value = v.cta; $('#am-diario').value = v.diario; $('#am-dias-boost').value = v.dias;
    raiz.querySelectorAll('.am-var').forEach((c, k) => c.classList.toggle('on', k === i));
    document.getElementById('am-pub').previousElementSibling.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // Meta no expone los «públicos guardados» de Ads Manager por la API de Zernio: se reusa el de un conjunto ya pagado.
  function selPrevios() {
    const conj = (datos?.campanas || []).flatMap(c => c.conjuntos.map(s => ({ id: s.id, txt: `${c.nombre}${c.conjuntos.length > 1 ? ` › ${s.nombre}` : ''}`, gasto: s.metricas?.gasto || 0 })))
      .sort((a, b) => b.gasto - a.gasto).slice(0, 40);
    if (!conj.length) return '';
    return `<label class="fl">Copiar el público de una campaña anterior<select class="ei" id="am-pub-prev"><option value="">Elegir campaña…</option>${conj.map(s => `<option value="${esc(s.id)}">${esc(s.txt.slice(0, 90))} · ${usd(s.gasto)}</option>`).join('')}</select></label>`;
  }

  async function copiarPublico(sel) {
    const id = sel.value;
    sel.disabled = true;
    try {
      const r = await invocar({ accion: 'publico_leer', id });
      if (sel.value !== id || pubCtx?.modo !== 'boost') return;
      const p = { ...r.publico, ubicaciones_anuncio: r.publico.ubicaciones_anuncio || [] };
      abrirPublico(p, { modo: 'boost', audiencias: pubCtx.audiencias, noEditable: {} });
      const ne = r.no_editable || {};
      ok(ne.ubicaciones ? `Público copiado. Tenía ${ne.ubicaciones} ubicación(es) marcada(s) en el mapa que no se copian: revisa Ubicaciones.` : 'Público copiado: puedes ajustarlo.');
    } catch (e) { error(e.message); } finally { sel.disabled = false; }
  }

  async function editarPublico(d) {
    const det = cajon.querySelector('#am-det');
    det.innerHTML = '<div class="am-vacio">Leyendo el público en Meta…</div>';
    try {
      const [r, a] = await Promise.all([
        invocar({ accion: 'publico_leer', id: d.id }),
        invocar({ accion: 'audiencias', cuenta }).catch(() => ({ audiencias: [] })),
      ]);
      det.innerHTML = `<h3 class="am-det-tit">Público del conjunto</h3><div class="am-det-sub">${esc(d.nombre)}</div>
        <div id="am-pub"></div>
        <span class="am-acc am-pub-pie"><button class="btn-sm lt-primario" type="button" data-am="publico-guardar"><i class="fas fa-check"></i> Guardar en Meta</button><button class="btn-sm" type="button" data-am="publico-volver">Volver</button></span>
        <div class="am-aviso">Solo se cambia lo que toques. Si está activo, Meta puede volver a la fase de aprendizaje.${r.publico.advantage ? ' Advantage+ se cambia en Ads Manager.' : ''}</div>`;
      abrirPublico(r.publico, { modo: 'editar', id: d.id, nombre: d.nombre, audiencias: a.audiencias || [], noEditable: r.no_editable || {} });
    } catch (e) { det.innerHTML = `<div class="am-vacio">${esc(e.message)}</div>`; }
  }

  async function guardarPublico() {
    if (ocupado) return;
    const cambios = [...pubCtx.cambios];
    if (!cambios.length) return error('No cambiaste nada.');
    if (cambios.includes('ubicaciones') && !pub.ubicaciones.length) return error('Elige al menos una ubicación.');
    const si = await confirmar({
      titulo: 'Cambiar el público en Meta', textoOk: 'Guardar',
      detalle: `«${pubCtx.nombre}»\nCambia: ${cambios.map(c => SECCIONES[c]).join(', ')}.\nSi está activo, Meta puede volver a la fase de aprendizaje.`,
    });
    if (!si) return;
    ocupado = true;
    try {
      await invocar({ accion: 'publico_editar', id: pubCtx.id, nombre: pubCtx.nombre, publico: pub, cambios });
      ok('Público actualizado en Meta');
      pintarDetalle();
    } catch (e) { error(e.message); } finally { ocupado = false; }
  }

  function clic(e) {
    document.querySelectorAll('.am-sugs').forEach(s => { if (!s.parentElement.contains(e.target)) s.hidden = true; });
    const t = e.target.closest('[data-am],[data-dias],[data-camp],[data-post]');
    if (!t || t.tagName === 'A') return;
    if (t.dataset.dias) {
      dias = Number(t.dataset.dias);
      raiz.querySelectorAll('#am-dias .seg').forEach(b => b.classList.toggle('on', b === t));
      vista = 'arbol'; return cargarArbol();
    }
    if (t.dataset.post) {
      postSel = t.dataset.post;
      raiz.querySelectorAll('.am-post').forEach(b => b.classList.toggle('on', b === t));
      $('.am-form').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const n = $('#am-nombre');
      n.closest('.am-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
      n.focus({ preventScroll: true }); return;
    }
    const a = t.dataset.am;
    if (a === 'estado') return cambiarEstado(t.dataset);
    if (a === 'presupuesto') return cambiarPresupuesto(t.dataset);
    if (a === 'prog') return programarPausa(t.dataset);
    if (a === 'prog-cancelar') return cancelarPausa(t.dataset);
    if (a === 'cerrar') return cerrar();
    if (a === 'gasto') {
      conGasto = !conGasto;
      const chip = $('.am-chip'); chip.classList.toggle('on', conGasto); chip.setAttribute('aria-pressed', String(conGasto));
      vista = 'arbol'; return cargarArbol();
    }
    if (a === 'recargar' || a === 'volver') { vista = 'arbol'; return cargarArbol(); }
    if (a === 'nuevo') return abrirNuevo();
    if (a === 'validar') return validarBoost();
    if (a === 'genero') { pub.genero = t.dataset.v; marcar('genero'); return pintarPublico(); }
    if (a === 'pos') {
      const v = t.dataset.v, l = pub.ubicaciones_anuncio;
      pub.ubicaciones_anuncio = l.includes(v) ? l.filter(x => x !== v) : [...l, v];
      marcar('ubicaciones_anuncio'); return pintarPublico();
    }
    if (a === 'ubic-x') { pub.ubicaciones.splice(Number(t.dataset.i), 1); marcar('ubicaciones'); return pintarPublico(); }
    if (a === 'int-x') { pub.intereses.splice(Number(t.dataset.i), 1); marcar('intereses'); return pintarPublico(); }
    if (a === 'geo-add') return agregarGeo(sugs.geo[Number(t.dataset.i)]);
    if (a === 'int-add') return agregarInteres(sugs.int[Number(t.dataset.i)]);
    if (a === 'sugerir') return sugerir();
    if (a === 'usar') return usarVariante(Number(t.dataset.i));
    if (a === 'publico') return editarPublico(t.dataset);
    if (a === 'publico-guardar') return guardarPublico();
    if (a === 'publico-volver') return pintarDetalle();
    if (t.dataset.camp) abrir(t.dataset.camp);
  }

  let montado = false;
  async function cargar() {
    if (!montado) { css(); marco(); montado = true; }
    if (!cuentas.length) {
      try {
        const r = await invocar({ accion: 'cuentas' });
        cuentas = r.cuentas; tope = r.tope_diario || tope;
        cuenta = (cuentas.find(c => c.seleccionada) || cuentas[0])?.id || '';
        pintarCuentas();
      } catch (e) { $('#am-cuerpo').innerHTML = `<div class="am-vacio">${esc(e.message)}</div>`; return; }
    }
    if (vista === 'arbol') cargarArbol();
  }

  return { cargar };
}
