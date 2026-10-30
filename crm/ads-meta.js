// Marketing > Anuncios Meta: gestor de campañas vía EF ads-meta-zernio (Zernio).
// Vive aparte de app.js (mismo patrón que wa-campanas.js). La key de Zernio nunca
// baja al navegador; los topes y permisos de escritura se validan en la EF.
// Plan: ~/.claude/plans/podemos-montar-un-gestor-imperative-firefly.md
const CSS = `
.am-barra{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}
.am-barra select{min-height:38px}
.am-sinc{font-size:11px;color:var(--muted);margin-left:auto}
.am-tabla{width:100%;border-collapse:collapse;font-size:12.5px}
.am-tabla th{position:sticky;top:0;background:var(--panel);text-align:right;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:8px 6px;border-bottom:1px solid var(--line2);white-space:nowrap}
.am-tabla th:first-child,.am-tabla td:first-child{text-align:left}
.am-tabla td{padding:8px 6px;border-bottom:1px solid var(--line2);text-align:right;white-space:nowrap;vertical-align:middle}
.am-tabla td:first-child{white-space:normal;min-width:240px}
.am-fila-camp{cursor:pointer}
.am-fila-camp td:first-child b{font-weight:700}
.am-fila-conj td:first-child{padding-left:22px}
.am-fila-anun td:first-child{padding-left:40px}
.am-nom{display:flex;gap:8px;align-items:center}
.am-nom img{width:34px;height:34px;object-fit:cover;border-radius:6px;flex:0 0 auto}
.am-nom small{display:block;color:var(--muted);font-size:10.5px}
.am-est{display:inline-block;font-size:10px;font-weight:800;padding:2px 7px;border-radius:999px;background:var(--line2);color:var(--muted)}
.am-est.on{background:color-mix(in srgb,#16a34a 18%,transparent);color:#15803d}
.am-crm{color:var(--accent-ink);font-weight:700}
.am-acc{display:inline-flex;gap:4px}
.am-acc button{min-height:30px;padding:0 8px}
.am-vacio{padding:28px;text-align:center;color:var(--muted)}
.am-posts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.am-post{border:1px solid var(--line2);border-radius:10px;overflow:hidden;background:var(--panel);cursor:pointer;text-align:left;padding:0}
.am-post img{width:100%;aspect-ratio:1;object-fit:cover;display:block}
.am-post div{padding:7px 8px;font-size:11px;color:var(--muted)}
.am-post.on{outline:2px solid var(--accent-ink)}
.am-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}
.am-aviso{font-size:12px;color:var(--muted);margin:6px 0 0}
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

export function crearAdsMeta({ sb, esc, ok, error, confirmar, rol = 'admin', raiz }) {
  const admin = rol === 'admin';
  let cuentas = [], cuenta = '', tope = 20, dias = 30, abiertas = new Set(), datos = null, vista = 'arbol';
  let posts = [], postSel = null, pedido = 0, ocupado = false;
  const $ = sel => raiz.querySelector(sel);
  const usd = n => '$' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ent = n => Number(n || 0).toLocaleString('es-VE');
  const div = (a, b) => (b > 0 ? a / b : null);
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const haceDias = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

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
        <select class="ei" id="am-cuenta"></select>
        <div class="seg-group" id="am-dias">${[7, 30, 90].map(d => `<button class="seg${d === dias ? ' on' : ''}" data-dias="${d}">${d} días</button>`).join('')}</div>
        <button class="btn-sm" type="button" data-am="recargar"><i class="fas fa-rotate"></i></button>
        <span class="am-sinc" id="am-sinc"></span>
      </div>
      <div class="kpis kpis-5" id="am-kpis"></div>
      <div class="card" style="margin-top:12px;overflow:auto" id="am-cuerpo"><div class="am-vacio">Cargando…</div></div>`;
    raiz.addEventListener('click', clic);
    raiz.addEventListener('change', e => { if (e.target.id === 'am-cuenta') { cuenta = e.target.value; cargarArbol(); } });
  }

  function pintarCuentas() {
    $('#am-cuenta').innerHTML = cuentas.map(c => `<option value="${esc(c.id)}"${c.id === cuenta ? ' selected' : ''}>${esc(c.nombre)}${c.activa ? '' : ' (inactiva)'}</option>`).join('');
  }

  function kpis(c) {
    const m = c.reduce((a, x) => ({ g: a.g + x.metricas.gasto, conv: a.conv + x.metricas.conversaciones, l: a.l + x.crm.leads, v: a.v + x.crm.ventas, $: a.$ + x.crm.monto }), { g: 0, conv: 0, l: 0, v: 0, $: 0 });
    const k = [
      ['Gasto', usd(m.g), 'fa-dollar-sign', '#2563eb'],
      ['Chats (Meta)', ent(m.conv), 'fa-comments', '#7c3aed'],
      ['Leads CRM', `${ent(m.l)}${m.l ? ' · ' + usd(div(m.g, m.l)) + ' c/u' : ''}`, 'fa-user-plus', '#0891b2'],
      ['Ventas', `${ent(m.v)}${m.v ? ' · ' + usd(div(m.g, m.v)) + ' c/u' : ''}`, 'fa-cart-shopping', '#16a34a'],
      ['Vendido / gasto', m.g ? (m.$ / m.g).toFixed(1) + 'x' : '—', 'fa-scale-balanced', '#ea580c'],
    ];
    $('#am-kpis').innerHTML = k.map(c => `<div class="kpi" style="--kc:${c[3]}"><div class="kt"><i class="fas ${c[2]}"></i>${c[0]}</div><div class="kv">${c[1]}</div></div>`).join('');
  }

  const estado = e => `<span class="am-est${e === 'active' ? ' on' : ''}">${e === 'active' ? 'Activo' : e === 'paused' ? 'Pausado' : esc(e || '—')}</span>`;

  function celdas(n) {
    const m = n.metricas, c = n.crm;
    return `<td>${usd(m.gasto)}</td><td>${ent(m.alcance)}</td><td>${ent(m.clics)}</td><td>${ent(m.conversaciones)}</td>
      <td class="am-crm">${ent(c.leads)}</td><td>${c.leads ? usd(div(m.gasto, c.leads)) : '—'}</td>
      <td class="am-crm">${ent(c.ventas)}</td><td>${c.ventas ? usd(div(m.gasto, c.ventas)) : '—'}</td>`;
  }

  function acciones(nivel, n, plataforma) {
    if (!admin || !['active', 'paused'].includes(n.estado)) return '<td></td>';
    const dato = `data-nivel="${nivel}" data-id="${esc(n.id)}" data-plat="${esc(plataforma)}" data-nombre="${esc(n.nombre)}" data-estado="${esc(n.estado)}"`;
    const pres = nivel !== 'anuncio' && n.presupuesto?.tipo === 'daily'
      ? `<button class="btn-sm" type="button" data-am="presupuesto" ${dato} data-monto="${n.presupuesto.monto}" title="Presupuesto diario">${usd(n.presupuesto.monto)}/día</button>` : '';
    return `<td><span class="am-acc">${pres}<button class="btn-sm" type="button" data-am="estado" ${dato} title="${n.estado === 'active' ? 'Pausar' : 'Activar'}"><i class="fas fa-${n.estado === 'active' ? 'pause' : 'play'}"></i></button></span></td>`;
  }

  function pintarArbol() {
    const c = datos?.campanas || [];
    kpis(c);
    $('#am-sinc').textContent = datos?.sincronizado ? 'Meta sincronizado ' + new Date(datos.sincronizado).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '';
    if (!c.length) { $('#am-cuerpo').innerHTML = '<div class="am-vacio">Sin campañas en este período.</div>'; return; }
    const filas = c.map(camp => {
      const abierta = abiertas.has(camp.id);
      let h = `<tr class="am-fila-camp" data-camp="${esc(camp.id)}"><td><div class="am-nom"><i class="fas fa-chevron-${abierta ? 'down' : 'right'}"></i><div><b>${esc(camp.nombre)}</b><small>${estado(camp.estado)} ${esc(camp.objetivo || '')}</small></div></div></td>${celdas(camp)}${acciones('campana', camp.nivel_presupuesto === 'campaign' ? camp : { ...camp, presupuesto: null }, camp.plataforma)}</tr>`;
      if (!abierta) return h;
      for (const s of camp.conjuntos) {
        h += `<tr class="am-fila-conj"><td><div class="am-nom"><div>${esc(s.nombre)}<small>${estado(s.estado)} ${esc(s.destino || '')}</small></div></div></td>${celdas(s)}${acciones('conjunto', camp.nivel_presupuesto === 'campaign' ? { ...s, presupuesto: null } : s, camp.plataforma)}</tr>`;
        for (const a of s.anuncios) {
          h += `<tr class="am-fila-anun"><td><div class="am-nom">${a.miniatura ? `<img src="${esc(a.miniatura)}" alt="" loading="lazy">` : ''}<div>${a.enlace ? `<a href="${esc(a.enlace)}" target="_blank" rel="noopener">${esc(a.nombre)}</a>` : esc(a.nombre)}<small>${estado(a.estado)}</small></div></div></td>${celdas(a)}${acciones('anuncio', a, camp.plataforma)}</tr>`;
        }
      }
      return h;
    }).join('');
    $('#am-cuerpo').innerHTML = `<table class="am-tabla"><thead><tr><th>Campaña / conjunto / anuncio</th><th>Gasto</th><th>Alcance</th><th>Clics</th><th>Chats</th><th>Leads</th><th>$/lead</th><th>Ventas</th><th>$/venta</th><th></th></tr></thead><tbody>${filas}</tbody></table>
      ${datos.errores?.crm ? '<div class="am-aviso">No se pudieron leer los leads del CRM: las columnas Leads y Ventas pueden estar en cero.</div>' : ''}`;
  }

  // Gana el último pedido: cambiar cuenta o rango mientras carga no pinta datos viejos.
  async function cargarArbol() {
    if (!cuenta) return;
    const n = ++pedido;
    $('#am-cuerpo').innerHTML = '<div class="am-vacio">Cargando…</div>';
    try {
      const d = await invocar({ accion: 'arbol', cuenta, desde: haceDias(dias), hasta: iso(new Date()) });
      if (n !== pedido || vista !== 'arbol') return;
      datos = d;
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
    $('#am-kpis').innerHTML = '';
    $('#am-cuerpo').innerHTML = '<div class="am-vacio">Cargando publicaciones…</div>';
    try {
      posts = (await invocar({ accion: 'posts' })).posts;
    } catch (e) { $('#am-cuerpo').innerHTML = `<div class="am-vacio">${esc(e.message)}</div>`; return; }
    $('#am-cuerpo').innerHTML = `
      <div class="pvc-cab"><h2>Promocionar un post de Instagram</h2><button class="btn-sm" type="button" data-am="volver"><i class="fas fa-arrow-left"></i> Volver</button></div>
      <div class="am-posts">${posts.map(p => `<button class="am-post" type="button" data-post="${esc(p.id)}">${p.miniatura ? `<img src="${esc(p.miniatura)}" alt="" loading="lazy">` : ''}<div>${esc((p.fecha || '').slice(0, 10))} · alcance ${ent(p.alcance)}<br>${esc(p.texto.slice(0, 70))}</div></button>`).join('') || '<div class="am-vacio">Sin publicaciones en los últimos 30 días.</div>'}</div>
      <div class="am-form">
        <label class="fl">Nombre<input class="ei" id="am-nombre" maxlength="120" placeholder="Ej.: Mérida diciembre"></label>
        <label class="fl">Botón<select class="ei" id="am-cta">${CTAS.map(c => `<option value="${c.v}">${c.t}</option>`).join('')}</select></label>
        <label class="fl">Diario (USD)<input class="ei" id="am-diario" type="number" min="1" max="${tope}" step="0.5" value="3"></label>
        <label class="fl">Días<input class="ei" id="am-dias-boost" type="number" min="1" max="30" value="7"></label>
        <label class="fl">Países (ISO, coma)<input class="ei" id="am-paises" value="VE"></label>
      </div>
      <button class="btn-sm lt-primario" type="button" data-am="validar"><i class="fas fa-check"></i> Revisar con Meta</button>
      <div class="am-aviso">Primero Meta lo revisa sin crear nada. Al confirmar se crea <b>en pausa</b>: se activa desde la lista, con fecha de fin siempre.</div>`;
  }

  function leerBoost() {
    return {
      accion: 'boost', cuenta, post: postSel,
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
      const v = await invocar(b);
      const r = v.resumen;
      const si = await confirmar({
        titulo: 'Meta lo aceptó: ¿crear en pausa?',
        detalle: `«${r.nombre}»\n${usd(r.diario)} por día × ${r.dias} días (máximo ${usd(r.total_max)}), hasta ${r.fin}.\nPaíses: ${r.paises.join(', ')}.\nQueda pausada: no gasta hasta que la actives.`,
        textoOk: 'Crear en pausa',
      });
      if (!si) return;
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
      raiz.querySelectorAll('.am-post').forEach(b => b.classList.toggle('on', b === t)); return;
    }
    const a = t.dataset.am;
    if (a === 'estado') return cambiarEstado(t.dataset);
    if (a === 'presupuesto') return cambiarPresupuesto(t.dataset);
    if (a === 'recargar' || a === 'volver') { vista = 'arbol'; return cargarArbol(); }
    if (a === 'nuevo') return abrirNuevo();
    if (a === 'validar') return validarBoost();
    if (t.dataset.camp && !e.target.closest('button')) {
      abiertas.has(t.dataset.camp) ? abiertas.delete(t.dataset.camp) : abiertas.add(t.dataset.camp);
      pintarArbol();
    }
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
