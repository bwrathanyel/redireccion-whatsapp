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
.am-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px;margin:14px 0}
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
  zernio_no_responde: 'Zernio no respondió. Probá de nuevo en un minuto.',
};
// Nombre que se muestra en el CRM (pedido del dueño 30-oct); en Meta siguen con su nombre original.
const ALIAS_CUENTAS = {
  '1227849214235821': 'Destino y Eventos Lotus 360 Instagram',
  '1402478865116363': 'Proacción Instagram',
};
// Solo las de venta entran en el costo por lead/venta (tipo automático en SQL: meta_campana_tipo).
const TIPOS = { venta: 'Venta', reclutamiento: 'Reclutamiento', tercero: 'De terceros' };
const OBJETIVOS = {
  LINK_CLICKS: 'Clics al enlace', OUTCOME_TRAFFIC: 'Tráfico', OUTCOME_ENGAGEMENT: 'Interacción',
  POST_ENGAGEMENT: 'Interacción', MESSAGES: 'Mensajes', OUTCOME_LEADS: 'Clientes potenciales',
  OUTCOME_AWARENESS: 'Reconocimiento', REACH: 'Alcance', VIDEO_VIEWS: 'Reproducciones', OUTCOME_SALES: 'Ventas',
};

export function crearAdsMeta({ sb, esc, ok, error, confirmar, rol = 'admin', raiz }) {
  const admin = rol === 'admin';
  let cuentas = [], cuenta = '', tope = 20, dias = 30, conGasto = true, busca = '', tipoFiltro = '', datos = null, vista = 'arbol';
  let posts = [], postSel = null, igs = { cuenta: null, lista: [], propio: null }, igSel = '', pedido = 0, ocupado = false, campSel = null, fondo = null, cajon = null, pausas = new Map();
  const $ = sel => raiz.querySelector(sel);
  const usd = n => '$' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ent = n => Number(n || 0).toLocaleString('es-VE');
  const div = (a, b) => (b > 0 ? a / b : null);
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const haceDias = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const nombreCuenta = c => ALIAS_CUENTAS[String(c.id).replace(/^act_/, '')] || (!c.nombre || /^\d+$/.test(c.nombre.trim()) ? `Cuenta …${String(c.id).slice(-4)}` : c.nombre);
  const anuncios = camp => camp.conjuntos.flatMap(s => s.anuncios);
  const portada = camp => anuncios(camp).find(a => a.miniatura) || {};
  const tipoDe = camp => camp.tipo || 'venta';
  const esVenta = camp => tipoDe(camp) === 'venta';

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
        <input class="ei am-busca" id="am-busca" type="search" placeholder="Buscar campaña" aria-label="Buscar campaña">
        <button class="btn-sm" type="button" data-am="recargar" title="Recargar"><i class="fas fa-rotate"></i></button>
        <span class="am-sinc" id="am-sinc"></span>
      </div>
      <div class="kpis kpis-5" id="am-kpis"></div>
      <div id="am-cuerpo"><div class="am-vacio">Cargando…</div></div>`;
    raiz.addEventListener('click', clic);
    raiz.addEventListener('change', e => {
      if (e.target.id === 'am-cuenta') { cuenta = e.target.value; cerrar(); cargarArbol(); }
      if (e.target.id === 'am-ig') { igSel = e.target.value; abrirNuevo(); }
      if (e.target.id === 'am-tipo') { tipoFiltro = e.target.value; if (vista === 'arbol' && datos) pintarArbol(); }
    });
    raiz.addEventListener('input', e => { if (e.target.id === 'am-busca') { busca = norm(e.target.value.trim()); if (vista === 'arbol' && datos) pintarArbol(); } });
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
    cajon.addEventListener('change', e => { if (e.target.id === 'am-tipo-camp') cambiarTipo(e.target); });
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

  function tarjeta(camp) {
    const crm = lineaCrm(camp.crm), pie = accionesCamp(camp);
    return `<article class="am-card" data-camp="${esc(camp.id)}" tabindex="0" role="button" aria-label="${esc(camp.nombre)}">
      <div class="am-foto">${foto(portada(camp))}${estado(camp.estado)}</div>
      <div class="am-cuerpo"><div class="am-tit">${esc(camp.nombre)}</div><div class="am-gasto">${usd(camp.metricas.gasto)}</div>
        <div class="am-res">${resultado(camp.metricas)}</div>${crm ? `<div class="am-crm">${crm}</div>` : ''}${lineaPausa(camp)}${esVenta(camp) ? '' : `<span class="am-tipo">${TIPOS[tipoDe(camp)]}</span>`}</div>
      ${pie ? `<div class="am-pie">${pie}</div>` : ''}</article>`;
  }

  function visibles() {
    return (datos?.campanas || []).filter(x => (!busca || norm(x.nombre).includes(busca)) && (!tipoFiltro || tipoDe(x) === tipoFiltro));
  }

  function pintarArbol() {
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
        <div class="am-aviso">Solo las de venta cuentan en el costo por lead y por venta.</div>`
      : '';
    const fila = a => `<div class="am-anun">${a.miniatura ? `<img src="${esc(a.miniatura)}" alt="" loading="lazy">` : '<span class="am-sin"><i class="fas fa-bullhorn"></i></span>'}
      <div>${a.enlace ? `<a href="${esc(a.enlace)}" target="_blank" rel="noopener">${esc(a.nombre)}</a>` : esc(a.nombre)}
        <small>${estado(a.estado)} ${usd(a.metricas.gasto)} · ${resultado(a.metricas)}</small></div>${botones('anuncio', a, camp.plataforma, false)}</div>`;
    const lista = camp.conjuntos.length > 1
      ? camp.conjuntos.map(s => `<div class="am-conj"><div class="am-conj-cab"><div>${esc(s.nombre)}<small>${estado(s.estado)} ${esc(s.destino || '')} · ${usd(s.metricas.gasto)}</small></div>
          ${botones('conjunto', s, camp.plataforma, camp.nivel_presupuesto !== 'campaign')}</div>${s.anuncios.map(fila).join('')}</div>`).join('')
      : anuncios(camp).map(fila).join('');
    const n = anuncios(camp).length;
    cajon.querySelector('#am-det').innerHTML = `
      <h3 class="am-det-tit">${esc(camp.nombre)}</h3>
      <div class="am-det-sub">${estado(camp.estado)}${objetivo(camp.objetivo)}<span class="am-tipo">${TIPOS[tipoDe(camp)]}</span></div>
      ${p.enlace ? `<a class="am-det-foto" href="${esc(p.enlace)}" target="_blank" rel="noopener">${foto(p)}<span class="am-ver">Ver en Instagram ↗</span></a>` : `<div class="am-det-foto">${foto(p)}</div>`}
      ${accionesCamp(camp)}${lineaPausa(camp)}${grupo(btnPausa(camp))}${tipo}
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
      posts = (await invocar({ accion: 'posts', cuenta, ig: igSel || undefined })).posts;
    } catch (e) { $('#am-cuerpo').innerHTML = `<div class="am-vacio">${esc(e.message)}</div>`; return; }
    const selIg = igs.lista.length > 1 ? `<label class="fl">Cuenta de Instagram<select class="ei" id="am-ig">${igs.lista.map(c => `<option value="${esc(c.id)}"${c.id === igSel ? ' selected' : ''}>@${esc(c.usuario)}</option>`).join('')}</select></label>` : '';
    $('#am-cuerpo').innerHTML = `<div class="card">
      <div class="pvc-cab"><h2>Promocionar un post de Instagram</h2><button class="btn-sm" type="button" data-am="volver"><i class="fas fa-arrow-left"></i> Volver</button></div>
      ${selIg}
      <div class="am-posts">${posts.map(p => `<button class="am-post" type="button" data-post="${esc(p.id)}">${p.miniatura ? `<img src="${esc(p.miniatura)}" alt="" loading="lazy">` : ''}<div>${esc((p.fecha || '').slice(0, 10))}${p.alcance == null ? '' : ` · alcance ${ent(p.alcance)}`}<br>${esc((p.texto || '').slice(0, 70))}</div></button>`).join('') || '<div class="am-vacio">Sin publicaciones recientes.</div>'}</div>
      <div class="am-form">
        <label class="fl">Nombre<input class="ei" id="am-nombre" maxlength="120" placeholder="Ej.: Mérida diciembre"></label>
        <label class="fl">Botón<select class="ei" id="am-cta">${CTAS.map(c => `<option value="${c.v}">${c.t}</option>`).join('')}</select></label>
        <label class="fl">Diario (USD)<input class="ei" id="am-diario" type="number" min="1" max="${tope}" step="0.5" value="3"></label>
        <label class="fl">Días<input class="ei" id="am-dias-boost" type="number" min="1" max="30" value="7"></label>
        <label class="fl">Países (ISO, coma)<input class="ei" id="am-paises" value="VE"></label>
      </div>
      <button class="btn-sm lt-primario" type="button" data-am="validar"><i class="fas fa-check"></i> Revisar con Meta</button>
      <div class="am-aviso">Primero Meta lo revisa sin crear nada. Al confirmar se crea <b>en pausa</b>: se activa desde la lista, con fecha de fin siempre.</div></div>`;
  }

  function leerBoost() {
    return {
      accion: 'boost', cuenta, post: postSel, ig: igSel || undefined,
      nombre: $('#am-nombre').value.trim(), cta: $('#am-cta').value,
      diario: Number($('#am-diario').value), dias: Number($('#am-dias-boost').value),
      paises: $('#am-paises').value.toUpperCase().split(/[\s,]+/).filter(Boolean),
    };
  }

  async function validarBoost() {
    if (ocupado) return;
    const b = leerBoost();
    if (!b.post) return error('Elegí una publicación.');
    if (!b.nombre) return error('Ponele un nombre.');
    ocupado = true;
    try {
      ok('Meta lo está revisando: tarda cerca de un minuto…');
      const v = await invocar(b);
      const r = v.resumen;
      const comoIg = r.ig ? `Anuncia como @${igs.lista.find(c => c.id === r.ig)?.usuario || r.ig}.\n` : '';
      const si = await confirmar({
        titulo: 'Meta lo aceptó: ¿crear en pausa?',
        detalle: `«${r.nombre}»\n${comoIg}${usd(r.diario)} por día × ${r.dias} días (máximo ${usd(r.total_max)}), hasta ${r.fin}.\nPaíses: ${r.paises.join(', ')}.\nQueda pausada: no gasta hasta que la actives.`,
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

  function clic(e) {
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
