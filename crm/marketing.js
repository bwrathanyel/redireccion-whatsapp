// Marketing > Contenido: marcas (Lotus + clientes) sobre perfiles de Zernio, vía EF marketing-zernio.
// Vive aparte de app.js (mismo patrón que ads-meta.js). Permisos y gasto se validan en la EF:
// ver marcas = admin/administrativo/marketing; crear y sacar link de conexión = admin/administrativo.
// Calendario (F3): programar, editar y borrar posts; ver/programar = esos 3 roles. Los medios
// suben directo del navegador a Zernio con la URL de `presign`.
// Plan: ~/.claude/plans/plataforma-marketing-crm.md (F1 Marcas, F3 Calendario).
const CSS = `
.mk-lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.mk-marca{--mk:var(--accent);display:flex;flex-direction:column;gap:9px;border:1px solid var(--line2);border-left:4px solid var(--mk);border-radius:14px;padding:14px;background:var(--panel)}
.mk-marca[data-color=blue],.mk-color[data-color=blue]{--mk:var(--blue)}
.mk-marca[data-color=green],.mk-color[data-color=green]{--mk:var(--green)}
.mk-marca[data-color=amber],.mk-color[data-color=amber]{--mk:var(--amber)}
.mk-marca[data-color=purple],.mk-color[data-color=purple]{--mk:var(--purple)}
.mk-marca[data-color=pink],.mk-color[data-color=pink]{--mk:var(--pink)}
.mk-marca.off{opacity:.6}
.mk-cab{display:flex;align-items:flex-start;justify-content:space-between;gap:9px}
.mk-nom{font-size:14px;font-weight:800;line-height:1.3}
.mk-tag{flex:0 0 auto;font-size:10px;font-weight:800;padding:2px 9px;border-radius:999px;border:1px solid var(--line2);color:var(--muted)}
.mk-tag.bot{border-color:var(--accent-ink);color:var(--accent-ink);background:var(--accent-soft)}
.mk-notas{font-size:12px;color:var(--muted);white-space:pre-line}
.mk-cuentas{display:flex;flex-direction:column;gap:5px;font-size:12.5px}
.mk-cuenta{display:flex;align-items:center;gap:7px}
.mk-cuenta img,.mk-cuenta .mk-ini{flex:0 0 auto;width:26px;height:26px;border-radius:999px;object-fit:cover;background:var(--bg2);display:grid;place-items:center;font-size:11px;font-weight:800;color:var(--muted)}
.mk-cuenta small{color:var(--muted)}
.mk-est{font-size:12px;color:var(--muted)}
.mk-acc{display:flex;flex-wrap:wrap;gap:7px;margin-top:auto}
.mk-acc .btn-sm,.mk-form .btn-sm{min-height:44px}
.mk-link{display:flex;flex-direction:column;gap:5px;font-size:11.5px;color:var(--muted)}
.mk-link input{width:100%;min-height:38px}
.mk-form{border:1px solid var(--line2);border-radius:14px;padding:14px;margin:0 0 14px;background:var(--panel)}
.mk-form input,.mk-form textarea{width:100%}
.mk-colores{display:flex;flex-wrap:wrap;gap:7px}
.mk-color{--mk:var(--accent);width:44px;height:44px;border-radius:12px;border:2px solid transparent;background:color-mix(in srgb,var(--mk) 22%,transparent);cursor:pointer;display:grid;place-items:center}
.mk-color::after{content:'';width:18px;height:18px;border-radius:999px;background:var(--mk)}
.mk-color.on{border-color:var(--mk)}
.mk-color:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.mk-form-pie{display:flex;justify-content:flex-end;gap:7px;margin-top:14px}
.mk-vacio{padding:28px;text-align:center;color:var(--muted)}
.mk-tabs{margin:0 0 14px}
.mk-barra{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:0 0 14px}
.mk-barra .btn-sm{min-height:44px}
.mk-mes{font-size:15px;font-weight:800;min-width:140px;text-align:center;text-transform:capitalize}
.mk-filtro{display:flex;flex-wrap:wrap;gap:7px}
.mk-fchip{--mk:var(--accent);display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 13px;border-radius:999px;border:1px solid var(--line2);background:transparent;color:var(--muted);font-size:12px;font-weight:700;cursor:pointer}
.mk-fchip::before{content:'';width:9px;height:9px;border-radius:999px;background:var(--mk)}
.mk-fchip.todas::before{display:none}
.mk-fchip.on{border-color:var(--accent-ink);color:var(--accent-ink);background:var(--accent-soft)}
.mk-fchip[data-color=blue],.mk-chip[data-color=blue]{--mk:var(--blue)}
.mk-fchip[data-color=green],.mk-chip[data-color=green]{--mk:var(--green)}
.mk-fchip[data-color=amber],.mk-chip[data-color=amber]{--mk:var(--amber)}
.mk-fchip[data-color=purple],.mk-chip[data-color=purple]{--mk:var(--purple)}
.mk-fchip[data-color=pink],.mk-chip[data-color=pink]{--mk:var(--pink)}
.mk-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--panel)}
.mk-dsem{padding:7px 9px;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line)}
.mk-dia{display:flex;flex-direction:column;gap:4px;min-height:108px;padding:6px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);min-width:0}
.mk-dia:nth-child(7n){border-right:0}
.mk-dia.fuera{background:var(--bg2)}
.mk-dia.fuera .mk-num{opacity:.5}
.mk-dia-cab{display:flex;align-items:center;justify-content:space-between}
.mk-num{font-size:12px;font-weight:700;color:var(--muted)}
.mk-dia.hoy .mk-num{color:var(--accent-ink);font-weight:800}
.mk-mas{width:28px;height:28px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--muted);font-size:16px;line-height:1;cursor:pointer}
.mk-mas:hover,.mk-mas:focus-visible{border-color:var(--line2);color:var(--accent-ink)}
.mk-chip{--mk:var(--accent);display:block;width:100%;text-align:left;padding:4px 7px;border:0;border-left:3px solid var(--mk);border-radius:6px;background:color-mix(in srgb,var(--mk) 14%,transparent);color:var(--txt);font-size:11px;line-height:1.3;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mk-chip b{font-weight:800;margin-right:4px}
.mk-chip.published{opacity:.7}
.mk-chip.failed{outline:1px dashed var(--mk)}
.mk-lista-dias{display:none}
.mk-ldia{border-top:1px solid var(--line);padding:9px 0}
.mk-ldia h3{font-size:12px;margin:0 0 7px;text-transform:capitalize}
.mk-ldia .mk-chip{font-size:12.5px;padding:9px 11px;margin-bottom:5px;white-space:normal}
.mk-ed h3{font-size:18px;font-weight:800;margin:0 44px 4px 0}
.mk-ed textarea{width:100%;min-height:140px}
.mk-ed select,.mk-ed input[type=date],.mk-ed input[type=time]{min-height:44px}
.mk-cont{font-size:11px;color:var(--muted);text-align:right}
.mk-ctas{display:flex;flex-direction:column;gap:5px}
.mk-ctas label{display:flex;align-items:center;gap:9px;min-height:44px;padding:0 11px;border:1px solid var(--line2);border-radius:10px;font-size:13px;cursor:pointer}
.mk-medios{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:7px}
.mk-medio{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;background:var(--bg2);display:grid;place-items:center;font-size:11px;color:var(--muted)}
.mk-medio img,.mk-medio video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.mk-medio button{position:absolute;top:4px;right:4px;width:28px;height:28px;border-radius:999px;border:0;background:var(--velo-foto);color:var(--sobre-foto);cursor:pointer}
.mk-subir{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:7px;cursor:pointer}
.mk-subir input{position:absolute;width:1px;height:1px;opacity:0}
.mk-fh{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.mk-avisos{font-size:12px;color:var(--muted);margin:9px 0 0;white-space:pre-line}
.mk-ed-pie{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px;margin-top:18px}
.mk-ed-pie .btn-sm{min-height:44px}
.mk-ed-pie .mk-borrar{margin-right:auto}
.mk-pub a{color:var(--accent-ink)}
@media (max-width:640px){
  .mk-cal{display:none}
  .mk-lista-dias{display:block}
  .mk-mes{min-width:0;flex:1}
}
`;
const COLORES = { accent: 'Lotus', blue: 'Azul', green: 'Verde', amber: 'Ámbar', purple: 'Morado', pink: 'Rosa' };
const PLATAFORMAS = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', whatsapp: 'WhatsApp' };
const ERRORES = {
  no_autorizado: 'Solo administración puede agregar marcas o sacar links de conexión.',
  nombre_invalido: 'Poné un nombre de hasta 80 letras.',
  marca_repetida: 'Ya hay una marca con ese nombre.',
  marca_lotus: 'Las cuentas de Lotus no se conectan desde acá.',
  marca_inactiva: 'La marca está desactivada.',
  zernio_no_responde: 'Zernio no respondió. Probá de nuevo en un minuto.',
  texto_largo: 'El texto pasa de 2.200 caracteres (límite de Instagram).',
  medios_invalidos: 'Subí entre 1 y 10 fotos o videos.',
  cuentas_invalidas: 'Elegí al menos una cuenta.',
  cuenta_ajena: 'Esa cuenta no es de la marca elegida.',
  fecha_invalida: 'Falta el día o la hora.',
  fecha_pasada: 'La hora tiene que ser al menos 10 minutos después de ahora.',
  post_invalido: 'Instagram no lo aceptaría:',
  post_ajeno: 'Esa publicación no es de la marca elegida.',
  post_no_existe: 'Esa publicación ya no existe en Zernio. Recargá el calendario.',
  post_no_editable: 'Ya se publicó o se está publicando: no se puede cambiar.',
  post_publicado: 'Ya está publicada: no se puede borrar desde acá.',
  post_duplicado: 'Ya hay una publicación igual en las últimas 24 horas.',
  medio_no_soportado: 'Solo fotos JPG, PNG o WEBP y videos MP4 o MOV.',
  medio_pesado: 'Muy pesado: fotos hasta 8 MB, videos hasta 300 MB.',
};
const ESTADOS = { scheduled: 'Programada', publishing: 'Publicando', published: 'Publicada', partial: 'Publicada a medias', failed: 'Falló', draft: 'Borrador', cancelled: 'Cancelada' };
const DIAS_SEM = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const ACEPTA = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime';

export function crearMarketing({ sb, esc, ok, error, confirmar, rol = 'admin', raiz }) {
  const oficina = rol === 'admin' || rol === 'administrativo';
  let marcas = [], errores = {}, formAbierto = false, colorNuevo = 'blue', ocupado = false, iniciado = false;
  let pestana = 'calendario', mes = null, filtro = '', posts = [], erroresPosts = {}, pedido = 0, ed = null, fondo = null, cajon = null;
  const links = new Map();
  const $ = sel => raiz.querySelector(sel);
  const horaCaracas = iso => new Date(iso).toLocaleString('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const igActivo = m => (m.cuentas || []).some(c => c.plataforma === 'instagram' && c.activo);

  async function invocar(body) {
    const { data, error: e } = await sb.functions.invoke('marketing-zernio', { body });
    if (e) {
      let j = null;
      try { j = await e.context?.json?.(); } catch { /* sin cuerpo */ }
      const lista = Array.isArray(j?.errores) && j.errores.length ? '\n' + j.errores.join('\n') : '';
      throw new Error((ERRORES[j?.error] || j?.error || e.message) + lista);
    }
    if (!data?.ok) throw new Error(ERRORES[data?.error] || data?.error || 'Error desconocido');
    return data;
  }

  function css() {
    if (document.getElementById('mk-css')) return;
    const st = document.createElement('style'); st.id = 'mk-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  function marco() {
    raiz.innerHTML = `
      <div class="pvc-cab"><div><h2>Contenido</h2>
        <div class="ria-sub">Publicaciones programadas de Lotus y de las marcas de clientes, y la conexión de sus cuentas.</div></div></div>
      <div class="seg-group mk-tabs" role="tablist">
        <button class="seg on" type="button" role="tab" aria-selected="true" data-mk="tab" data-tab="calendario">Calendario</button>
        <button class="seg" type="button" role="tab" aria-selected="false" data-mk="tab" data-tab="marcas">Marcas</button>
      </div>
      <div id="mk-p-calendario">
        <div class="mk-barra">
          <button class="btn-sm" type="button" data-mk="mes" data-paso="-1" aria-label="Mes anterior">‹</button>
          <span class="mk-mes" id="mk-mes"></span>
          <button class="btn-sm" type="button" data-mk="mes" data-paso="1" aria-label="Mes siguiente">›</button>
          <button class="btn-sm" type="button" data-mk="hoy">Hoy</button>
          <button class="btn-sm lt-primario" type="button" data-mk="post-nuevo">Nueva publicación</button>
        </div>
        <div class="mk-filtro mk-barra" id="mk-filtro" aria-label="Filtrar por marca"></div>
        <div id="mk-cal"><div class="mk-vacio">Cargando…</div></div>
      </div>
      <div id="mk-p-marcas" hidden>
        <div class="pvc-cab"><div class="ria-sub">Lotus y las marcas de clientes a las que les manejamos las redes. Cada cliente conecta su Instagram con su propio login desde el link de conexión; cada cuenta conectada cuesta USD 3 al mes.</div>
          <div class="mk-acc">
            <button class="btn-sm" type="button" data-mk="recargar">Recargar</button>
            ${oficina ? '<button class="btn-sm lt-primario" type="button" data-mk="nueva">Agregar marca</button>' : ''}
          </div></div>
        <div id="mk-form"></div>
        <div id="mk-cuerpo"><div class="mk-vacio">Cargando…</div></div>
      </div>`;
    raiz.addEventListener('click', clic);
    raiz.addEventListener('submit', e => { if (e.target.id === 'mk-nueva') { e.preventDefault(); crear(e.target); } });
    fondo = document.createElement('div'); fondo.className = 'drawer-bg';
    cajon = document.createElement('aside');
    cajon.className = 'drawer mk-ed'; cajon.setAttribute('role', 'dialog'); cajon.setAttribute('aria-modal', 'true'); cajon.setAttribute('aria-label', 'Publicación');
    cajon.innerHTML = '<button class="dclose" type="button" data-mk="cerrar" aria-label="Cerrar">✕</button><div id="mk-ed"></div>';
    document.body.append(fondo, cajon);
    fondo.addEventListener('click', cerrarEditor);
    cajon.addEventListener('click', clic);
    cajon.addEventListener('change', cambioEditor);
    cajon.addEventListener('input', e => { if (e.target.id === 'mk-texto') { ed.texto = e.target.value; cajon.querySelector('#mk-cont').textContent = `${ed.texto.length} / 2200`; } });
    cajon.addEventListener('submit', e => { if (e.target.id === 'mk-post') { e.preventDefault(); guardarPost(); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && ed && !document.querySelector('.sheet.open')) cerrarEditor(); });
  }

  // ---- Calendario (fechas siempre en hora de Caracas, UTC-4 fijo) ----
  const cct = iso => { const d = new Date(Date.parse(iso) - 4 * 3600e3).toISOString(); return { dia: d.slice(0, 10), hora: d.slice(11, 16) }; };
  const hoyCct = () => cct(new Date().toISOString()).dia;
  const diaUtc = s => new Date(`${s}T12:00:00Z`);
  const sumarDias = (s, n) => { const d = diaUtc(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const nombreMes = s => diaUtc(s).toLocaleDateString('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const nombreDia = s => diaUtc(s).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const marcaDe = id => marcas.find(m => m.id === id);
  const colorDe = id => (COLORES[marcaDe(id)?.color] ? marcaDe(id).color : 'accent');
  const cuentasPost = m => (m?.cuentas || []).filter(c => c.activo && (c.plataforma === 'instagram' || c.plataforma === 'facebook'));
  const publicables = () => marcas.filter(m => m.activa && cuentasPost(m).length);

  function rango() {
    const primero = mes;
    const dow = (diaUtc(primero).getUTCDay() + 6) % 7;
    const desde = sumarDias(primero, -dow);
    const d = diaUtc(primero); d.setUTCMonth(d.getUTCMonth() + 1, 0);
    const ultimo = d.toISOString().slice(0, 10);
    const hasta = sumarDias(ultimo, 6 - (d.getUTCDay() + 6) % 7);
    return { desde, hasta };
  }

  async function cargarPosts() {
    const { desde, hasta } = rango();
    const n = ++pedido;
    $('#mk-mes').textContent = nombreMes(mes);
    try {
      const d = await invocar({ accion: 'posts', desde, hasta });
      if (n !== pedido) return;
      posts = d.posts || []; erroresPosts = d.errores || {};
      pintarCalendario();
    } catch (e) {
      if (n === pedido) $('#mk-cal').innerHTML = `<div class="mk-vacio">${esc(e.message)}</div>`;
    }
  }

  function pintarFiltro() {
    const conPerfil = marcas.filter(m => m.zernio_perfil_id);
    $('#mk-filtro').innerHTML = conPerfil.length < 2 ? '' : [`<button class="mk-fchip todas${filtro === '' ? ' on' : ''}" type="button" data-mk="filtro" data-marca="" aria-pressed="${filtro === ''}">Todas</button>`]
      .concat(conPerfil.map(m => `<button class="mk-fchip${filtro === String(m.id) ? ' on' : ''}" type="button" data-mk="filtro" data-marca="${m.id}" data-color="${colorDe(m.id)}" aria-pressed="${filtro === String(m.id)}">${esc(m.nombre)}</button>`)).join('');
  }

  function chip(p) {
    const { hora } = cct(p.fecha);
    const m = marcaDe(p.marca_id);
    const titulo = `${m?.nombre || ''} · ${hora} · ${ESTADOS[p.estado] || p.estado}\n${p.texto.slice(0, 140)}`;
    return `<button class="mk-chip ${esc(p.estado)}" type="button" data-mk="post" data-post="${esc(p.id)}" data-color="${colorDe(p.marca_id)}" title="${esc(titulo)}"><b>${hora}</b>${esc(p.texto.slice(0, 60) || '(sin texto)')}</button>`;
  }

  function pintarCalendario() {
    pintarFiltro();
    const { desde, hasta } = rango();
    const hoy = hoyCct(), mesClave = mes.slice(0, 7);
    const visibles = posts.filter(p => p.fecha && (!filtro || String(p.marca_id) === filtro)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const porDia = new Map();
    visibles.forEach(p => { const k = cct(p.fecha).dia; porDia.set(k, [...(porDia.get(k) || []), p]); });
    const celdas = [];
    for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
      const lista = porDia.get(d) || [];
      const puede = d >= hoy && publicables().length;
      celdas.push(`<div class="mk-dia${d.slice(0, 7) !== mesClave ? ' fuera' : ''}${d === hoy ? ' hoy' : ''}">
        <div class="mk-dia-cab"><span class="mk-num">${Number(d.slice(8))}</span>${puede ? `<button class="mk-mas" type="button" data-mk="post-nuevo" data-dia="${d}" aria-label="Nueva publicación el ${esc(nombreDia(d))}">+</button>` : ''}</div>
        ${lista.map(chip).join('')}</div>`);
    }
    const avisos = Object.keys(erroresPosts).map(id => marcaDe(Number(id))?.nombre).filter(Boolean);
    const dias = [...porDia.keys()].filter(k => k.slice(0, 7) === mesClave);
    $('#mk-cal').innerHTML = `${avisos.length ? `<div class="mk-est">Zernio no respondió para ${esc(avisos.join(', '))}: faltan sus publicaciones.</div>` : ''}
      <div class="mk-cal">${DIAS_SEM.map(d => `<div class="mk-dsem">${d}</div>`).join('')}${celdas.join('')}</div>
      <div class="mk-lista-dias">${dias.length ? dias.map(k => `<div class="mk-ldia"><h3>${esc(nombreDia(k))}</h3>${porDia.get(k).map(chip).join('')}</div>`).join('') : '<div class="mk-vacio">No hay publicaciones este mes.</div>'}</div>`;
  }

  // ---- Editor de publicación ----
  function abrirEditor(post, dia) {
    const m = post ? marcaDe(post.marca_id) : (marcaDe(Number(filtro)) && cuentasPost(marcaDe(Number(filtro))).length ? marcaDe(Number(filtro)) : publicables()[0]);
    if (!m) { error('Ninguna marca tiene cuentas conectadas todavía.'); return; }
    const f = post?.fecha ? cct(post.fecha) : { dia: dia || hoyCct(), hora: '10:00' };
    ed = {
      id: post?.id || null, estado: post?.estado || null, marca: m.id,
      cuentas: post ? post.cuentas.map(c => c.id) : cuentasPost(m).filter(c => c.plataforma === 'instagram').map(c => c.id),
      texto: post?.texto || '', medios: post ? post.medios.map(x => ({ ...x })) : [], dia: f.dia, hora: f.hora,
      clave: crypto.randomUUID(), subiendo: 0, avisos: '', pub: post,
    };
    pintarEditor();
    fondo.classList.add('open'); cajon.classList.add('open');
    cajon.querySelector('.dclose').focus();
  }

  function cerrarEditor() {
    if (!ed) return;
    ed.medios.forEach(x => x.local && URL.revokeObjectURL(x.local));
    ed = null;
    fondo.classList.remove('open'); cajon.classList.remove('open');
  }

  function pintarEditor() {
    const caja = cajon.querySelector('#mk-ed');
    const m = marcaDe(ed.marca);
    const editable = !ed.id || ['scheduled', 'draft', 'failed'].includes(ed.estado);
    if (!editable) {
      const p = ed.pub;
      caja.innerHTML = `<h3>${esc(ESTADOS[p.estado] || p.estado)}</h3>
        <div class="mk-est">${esc(m?.nombre || '')} · ${esc(nombreDia(cct(p.fecha).dia))}, ${cct(p.fecha).hora}</div>
        <div class="mk-medios" style="margin:14px 0">${p.medios.map(x => `<div class="mk-medio">${x.tipo === 'video' ? `<video src="${esc(x.url)}" muted preload="metadata"></video>` : `<img src="${esc(x.url)}" alt="" loading="lazy">`}</div>`).join('')}</div>
        <div class="mk-notas">${esc(p.texto)}</div>
        <div class="mk-cuentas mk-pub" style="margin-top:14px">${p.cuentas.map(c => `<div>@${esc(c.usuario || c.id)} · ${esc(ESTADOS[c.estado] || c.estado || '')}${c.url ? ` · <a href="${esc(c.url)}" target="_blank" rel="noopener">Ver</a>` : ''}${c.error ? `<br><small>${esc(c.error)}</small>` : ''}</div>`).join('')}</div>`;
      return;
    }
    const opciones = (ed.id ? [m] : publicables()).map(x => `<option value="${x.id}"${x.id === ed.marca ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('');
    caja.innerHTML = `<h3>${ed.id ? 'Editar publicación' : 'Nueva publicación'}</h3>
      ${ed.estado === 'failed' ? '<div class="mk-est">Falló al publicar: corregila y volvé a programarla.</div>' : ''}
      <form id="mk-post" novalidate>
        <label class="fl" for="mk-marca">Marca</label>
        <select class="ei" id="mk-marca"${ed.id ? ' disabled' : ''}>${opciones}</select>
        <span class="fl">Cuentas</span>
        <div class="mk-ctas">${cuentasPost(m).map(c => `<label><input type="checkbox" data-cuenta="${esc(c.id)}"${ed.cuentas.includes(c.id) ? ' checked' : ''}> @${esc(c.usuario || c.id)} <small class="mk-est">${esc(PLATAFORMAS[c.plataforma] || c.plataforma)}</small></label>`).join('')}</div>
        <label class="fl" for="mk-texto">Texto</label>
        <textarea class="ei" id="mk-texto" maxlength="2200">${esc(ed.texto)}</textarea>
        <div class="mk-cont" id="mk-cont">${ed.texto.length} / 2200</div>
        <span class="fl">Fotos o videos (hasta 10, en orden)</span>
        <div class="mk-medios">${ed.medios.map((x, i) => `<div class="mk-medio">${x.tipo === 'video' ? `<video src="${esc(x.local || x.url)}" muted preload="metadata"></video>` : `<img src="${esc(x.local || x.url)}" alt="">`}<button type="button" data-mk="medio-quitar" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('')}
          ${ed.subiendo ? `<div class="mk-medio">Subiendo ${ed.subiendo}…</div>` : ''}</div>
        ${ed.medios.length + ed.subiendo < 10 ? `<label class="btn-sm mk-subir">Agregar fotos o videos<input type="file" id="mk-archivos" accept="${ACEPTA}" multiple></label>` : ''}
        <div class="mk-fh">
          <div><label class="fl" for="mk-dia">Día</label><input class="ei" type="date" id="mk-dia" value="${ed.dia}" min="${hoyCct()}"></div>
          <div><label class="fl" for="mk-hora">Hora (Caracas)</label><input class="ei" type="time" id="mk-hora" value="${ed.hora}"></div>
        </div>
        ${ed.avisos ? `<div class="mk-avisos">${esc(ed.avisos)}</div>` : ''}
        <div class="mk-ed-pie">
          ${ed.id ? '<button class="btn-sm mk-borrar" type="button" data-mk="post-borrar">Borrar</button>' : ''}
          <button class="btn-sm" type="button" data-mk="cerrar">Cancelar</button>
          <button class="btn-sm lt-primario" type="submit"${ed.subiendo || ocupado ? ' disabled' : ''}>${ed.id ? 'Guardar cambios' : 'Programar'}</button>
        </div>
      </form>`;
  }

  function cambioEditor(e) {
    const t = e.target;
    if (t.id === 'mk-marca') {
      ed.marca = Number(t.value);
      ed.cuentas = cuentasPost(marcaDe(ed.marca)).filter(c => c.plataforma === 'instagram').map(c => c.id);
      pintarEditor();
    }
    if (t.dataset.cuenta) ed.cuentas = t.checked ? [...new Set([...ed.cuentas, t.dataset.cuenta])] : ed.cuentas.filter(c => c !== t.dataset.cuenta);
    if (t.id === 'mk-dia') ed.dia = t.value;
    if (t.id === 'mk-hora') ed.hora = t.value;
    if (t.id === 'mk-archivos') subir([...t.files]);
  }

  async function subir(archivos) {
    const sesion = ed;
    const lote = archivos.slice(0, 10 - ed.medios.length - ed.subiendo);
    sesion.subiendo += lote.length; pintarEditor();
    for (const f of lote) {
      try {
        const p = await invocar({ accion: 'presign', filename: f.name, contentType: f.type, size: f.size });
        const r = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': f.type }, body: f });
        if (!r.ok) throw new Error(`No se pudo subir ${f.name} (${r.status})`);
        sesion.medios.push({ tipo: p.tipo, url: p.publicUrl, local: URL.createObjectURL(f) });
      } catch (e) {
        error(`${f.name}: ${e.message}`);
      } finally {
        sesion.subiendo--;
        if (ed === sesion) pintarEditor();
      }
    }
  }

  async function guardarPost() {
    if (ocupado || ed.subiendo) return;
    const sesion = ed;
    const body = { marca_id: ed.marca, cuentas: ed.cuentas, contenido: ed.texto, medios: ed.medios.map(({ tipo, url }) => ({ tipo, url })), fecha: ed.dia && ed.hora ? `${ed.dia}T${ed.hora}` : '' };
    ocupado = true; pintarEditor();
    try {
      const d = sesion.id
        ? await invocar({ accion: 'post_editar', post_id: sesion.id, ...body })
        : await invocar({ accion: 'post_crear', clave: sesion.clave, ...body });
      ok(sesion.id ? 'Publicación actualizada' : `Programada para el ${nombreDia(sesion.dia)}, ${sesion.hora}`);
      if (d.avisos?.length) ok(d.avisos.join(' · '));
      cerrarEditor();
      cargarPosts();
    } catch (e) {
      if (ed === sesion) ed.avisos = e.message;
      error(e.message.split('\n')[0]);
    } finally {
      ocupado = false;
      if (ed === sesion) pintarEditor();
    }
  }

  async function borrarPost() {
    const p = ed.pub;
    if (!await confirmar({ titulo: 'Borrar publicación', detalle: `${marcaDe(p.marca_id)?.nombre || ''} · ${nombreDia(cct(p.fecha).dia)}, ${cct(p.fecha).hora}\nNo se publica y se borra de Zernio.`, textoOk: 'Borrar', destructivo: true })) return;
    try {
      await invocar({ accion: 'post_borrar', marca_id: p.marca_id, post_id: p.id });
      ok('Publicación borrada');
      cerrarEditor();
      cargarPosts();
    } catch (e) { error(e.message); }
  }

  function cambiarPestana(t) {
    pestana = t;
    raiz.querySelectorAll('[data-mk=tab]').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    $('#mk-p-calendario').hidden = t !== 'calendario';
    $('#mk-p-marcas').hidden = t !== 'marcas';
  }

  function pintarForm() {
    $('#mk-form').innerHTML = !formAbierto ? '' : `
      <form class="mk-form" id="mk-nueva">
        <label class="fl" for="mk-nombre">Nombre de la marca</label>
        <input class="ei" id="mk-nombre" name="nombre" maxlength="80" required autocomplete="off">
        <span class="fl" id="mk-color-l">Color en el calendario</span>
        <div class="mk-colores" role="radiogroup" aria-labelledby="mk-color-l">${Object.entries(COLORES).map(([c, t]) =>
          `<button class="mk-color${c === colorNuevo ? ' on' : ''}" type="button" role="radio" aria-checked="${c === colorNuevo}" aria-label="${t}" title="${t}" data-color="${c}" data-mk="color"></button>`).join('')}</div>
        <label class="fl" for="mk-notas">Condición comercial (opcional)</label>
        <textarea class="ei" id="mk-notas" name="notas" rows="2" maxlength="500" placeholder="Ej.: 4 posts por semana, responde comentarios, USD 80/mes"></textarea>
        <div class="mk-form-pie">
          <button class="btn-sm" type="button" data-mk="cancelar">Cancelar</button>
          <button class="btn-sm lt-primario" type="submit">Crear marca</button>
        </div>
      </form>`;
    if (formAbierto) $('#mk-nombre').focus();
  }

  function cuentas(m) {
    if (m.cuentas === null) return `<div class="mk-est">Zernio no respondió (${esc(String(errores[m.id] || 'error'))}). Recargá en un minuto.</div>`;
    if (!m.zernio_perfil_id) return '<div class="mk-est">Todavía sin perfil en Zernio: se crea al sacar el link de conexión.</div>';
    if (!m.cuentas.length) return '<div class="mk-est">Sin cuentas conectadas.</div>';
    return `<div class="mk-cuentas">${m.cuentas.map(c => `<div class="mk-cuenta">
      ${c.foto ? `<img src="${esc(c.foto)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="mk-ini">${esc((c.usuario || '?').slice(0, 1).toUpperCase())}</span>`}
      <span>@${esc(c.usuario || c.id)} <small>· ${esc(PLATAFORMAS[c.plataforma] || c.plataforma)}${c.activo ? '' : ' · desconectada'}</small></span></div>`).join('')}</div>`;
  }

  function link(m) {
    const l = links.get(m.id);
    if (!l) return '';
    return `<div class="mk-link"><span>Link para ${esc(m.nombre)} · vence ${esc(horaCaracas(l.vence))} (hora de Caracas)</span>
      <input class="ei" type="text" readonly value="${esc(l.url)}" aria-label="Link de conexión de ${esc(m.nombre)}"></div>`;
  }

  function tarjeta(m) {
    const color = COLORES[m.color] ? m.color : 'accent';
    const conectable = oficina && !m.es_lotus && m.activa && !igActivo(m);
    const tag = m.es_lotus ? '<span class="mk-tag bot">Lo atiende el bot</span>' : !m.activa ? '<span class="mk-tag">Desactivada</span>' : igActivo(m) ? '<span class="mk-tag">Instagram conectado</span>' : '';
    return `<article class="mk-marca${m.activa ? '' : ' off'}" data-color="${color}">
      <div class="mk-cab"><div class="mk-nom">${esc(m.nombre)}</div>${tag}</div>
      ${m.notas ? `<div class="mk-notas">${esc(m.notas)}</div>` : ''}
      ${cuentas(m)}
      ${link(m)}
      ${conectable ? `<div class="mk-acc"><button class="btn-sm" type="button" data-mk="conectar" data-marca="${m.id}">${links.has(m.id) ? 'Copiar otro link' : 'Link de conexión'}</button></div>` : ''}
    </article>`;
  }

  function pintar() {
    $('#mk-cuerpo').innerHTML = marcas.length
      ? `<div class="mk-lista">${marcas.map(tarjeta).join('')}</div>`
      : '<div class="mk-vacio">No hay marcas cargadas.</div>';
  }

  async function cargar() {
    css();
    if (!iniciado) { marco(); iniciado = true; mes = hoyCct().slice(0, 8) + '01'; }
    try {
      const d = await invocar({ accion: 'marcas' });
      marcas = d.marcas || []; errores = d.errores || {};
      pintar();
      await cargarPosts();
    } catch (e) {
      $('#mk-cuerpo').innerHTML = `<div class="mk-vacio">${esc(e.message)}</div>`;
      $('#mk-cal').innerHTML = `<div class="mk-vacio">${esc(e.message)}</div>`;
    }
  }

  async function crear(form) {
    if (ocupado) return;
    ocupado = true;
    const boton = form.querySelector('[type=submit]'); boton.disabled = true;
    try {
      const d = await invocar({ accion: 'marca_crear', nombre: form.nombre.value, color: colorNuevo, notas: form.notas.value });
      ok(`Marca «${d.marca.nombre}» creada`);
      formAbierto = false; pintarForm();
      await cargar();
    } catch (e) {
      error(e.message);
      boton.disabled = false;
    } finally { ocupado = false; }
  }

  async function conectar(boton) {
    if (ocupado) return;
    const m = marcas.find(x => String(x.id) === boton.dataset.marca);
    if (!m) return;
    ocupado = true; boton.disabled = true;
    try {
      const d = await invocar({ accion: 'conectar', marca_id: m.id });
      links.set(m.id, { url: d.authUrl, vence: d.vence });
      if (!m.zernio_perfil_id) m.zernio_perfil_id = d.perfil;
      const texto = `Hola, para que podamos publicar en el Instagram de ${m.nombre}, abrí este link e iniciá sesión con tu Instagram. Vence el ${horaCaracas(d.vence)} (hora de Caracas):\n${d.authUrl}`;
      try { await navigator.clipboard.writeText(texto); ok('Link copiado: pegalo en el WhatsApp del cliente'); }
      catch { ok('Link listo: copialo de la tarjeta'); }
      pintar();
    } catch (e) {
      error(e.message);
      boton.disabled = false;
    } finally { ocupado = false; }
  }

  function clic(e) {
    const b = e.target.closest('[data-mk]');
    if (!b) return;
    const acc = b.dataset.mk;
    if (acc === 'recargar') { $('#mk-cuerpo').innerHTML = '<div class="mk-vacio">Cargando…</div>'; cargar(); }
    if (acc === 'nueva') { formAbierto = true; pintarForm(); }
    if (acc === 'cancelar') { formAbierto = false; pintarForm(); }
    if (acc === 'color') {
      colorNuevo = b.dataset.color;
      raiz.querySelectorAll('.mk-color').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
    }
    if (acc === 'conectar') conectar(b);
    if (acc === 'tab') cambiarPestana(b.dataset.tab);
    if (acc === 'mes') { const d = diaUtc(mes); d.setUTCMonth(d.getUTCMonth() + Number(b.dataset.paso)); mes = d.toISOString().slice(0, 8) + '01'; $('#mk-cal').innerHTML = '<div class="mk-vacio">Cargando…</div>'; cargarPosts(); }
    if (acc === 'hoy') { mes = hoyCct().slice(0, 8) + '01'; cargarPosts(); }
    if (acc === 'filtro') { filtro = b.dataset.marca; pintarCalendario(); }
    if (acc === 'post-nuevo') abrirEditor(null, b.dataset.dia);
    if (acc === 'post') { const p = posts.find(x => x.id === b.dataset.post); if (p) abrirEditor(p); }
    if (acc === 'cerrar') cerrarEditor();
    if (acc === 'medio-quitar') { const [x] = ed.medios.splice(Number(b.dataset.i), 1); if (x?.local) URL.revokeObjectURL(x.local); pintarEditor(); }
    if (acc === 'post-borrar') borrarPost();
  }

  return { cargar };
}
