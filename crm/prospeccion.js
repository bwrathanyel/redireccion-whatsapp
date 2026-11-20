// Búsqueda activa (prospección B2B, 2026-11-20): solo admins. La IA busca y redacta; el humano decide y envía.
// Escritura solo por RPC prospect*/prospeccion_*; búsqueda, contactos y borradores por la EF prospeccion-ia.
// Plan: ~/.claude/plans/podemos-crear-una-secci-n-rosy-stonebraker.md
const CSS = `
.pz-top{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin:0 0 14px}
.pz-top h2{flex:1 1 auto;margin:0;font-size:18px;font-weight:800;letter-spacing:-.02em}
.pz-tabs{display:flex;gap:4px;margin:0 0 14px;overflow-x:auto}
.pz-tabs button{flex:0 0 auto;background:var(--panel-solid);border:1px solid var(--line2);border-radius:999px;padding:7px 14px;font:inherit;font-size:12px;font-weight:700;color:var(--muted);cursor:pointer;min-height:36px}
.pz-tabs button[aria-pressed="true"]{border-color:var(--accent-ink);color:var(--accent-ink);background:var(--accent-soft)}
.pz-tabs b{margin-left:4px;font-size:10px;padding:1px 6px;border-radius:999px;background:var(--danger);color:#fff}
.pz-seg{display:inline-flex;border:1px solid var(--line2);border-radius:9px;overflow:hidden}
.pz-seg button{background:transparent;border:0;padding:7px 12px;font:inherit;font-size:11.5px;font-weight:700;color:var(--muted);cursor:pointer}
.pz-seg button[aria-pressed="true"]{background:var(--accent-soft);color:var(--accent-ink)}
.pz-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:9px}
.pz-card{display:flex;flex-direction:column;gap:6px;padding:11px;border:1px solid var(--line2);border-radius:12px;background:var(--panel);cursor:pointer;transition:border-color .16s;text-align:left;font:inherit;color:var(--txt)}
.pz-card:hover{border-color:var(--accent-ink)}
.pz-card.venc{border-left:3px solid var(--danger)}
.pz-card.apagado{opacity:.55}
.pz-cab{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800}
.pz-cab span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pz-chips{display:flex;flex-wrap:wrap;gap:4px}
.pz-chip{font-size:10px;font-weight:800;letter-spacing:.04em;padding:2px 7px;border-radius:999px;background:var(--line);color:var(--muted)}
.pz-chip.rojo{background:rgba(239,68,68,.14);color:var(--danger)}
.pz-chip.ambar{background:rgba(245,181,68,.15);color:var(--amber)}
.pz-chip.azul{background:rgba(74,158,255,.14);color:var(--blue)}
.pz-chip.verde{background:rgba(16,185,129,.15);color:var(--green)}
.pz-chip.acc{background:var(--accent-soft);color:var(--accent-ink)}
.pz-linea{font-size:11.5px;color:var(--muted);overflow-wrap:anywhere}
.pz-linea b{color:var(--txt);font-weight:700}
.pz-linea a{color:var(--accent-ink)}
.pz-vacio{padding:22px 4px;text-align:center;font-size:12px;color:var(--muted2)}
.pz-busq{display:grid;grid-template-columns:minmax(220px,280px) 1fr;gap:14px;align-items:start}
.pz-plantillas{display:flex;flex-direction:column;gap:4px}
.pz-plantillas h4,.pz-bloque>h4{margin:7px 0 2px;font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.pz-plantillas button{display:flex;flex-direction:column;gap:2px;text-align:left;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--txt);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.pz-plantillas button small{font-size:10.5px;font-weight:600;color:var(--muted)}
.pz-plantillas button[aria-pressed="true"]{border-color:var(--accent-ink)}
.pz-form{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}
.pz-form .ancho{grid-column:1/-1}
.pz-campo{display:flex;flex-direction:column;gap:4px;min-width:0}
.pz-campo>span{font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.pz-campo input,.pz-campo select,.pz-campo textarea{width:100%;box-sizing:border-box;min-height:40px;padding:8px 10px;border:1px solid var(--line2);border-radius:9px;background:var(--bg2);color:var(--txt);font:inherit;font-size:13px}
.pz-campo textarea{min-height:64px;resize:vertical}
.pz-campo input:focus,.pz-campo select:focus,.pz-campo textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.pz-tags{display:flex;flex-wrap:wrap;align-items:center;gap:4px;min-height:40px;padding:4px 7px;border:1px solid var(--line2);border-radius:9px;background:var(--bg2)}
.pz-tags:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.pz-tags input{flex:1 1 90px;min-width:90px;border:0!important;box-shadow:none!important;background:transparent!important;min-height:30px!important;padding:2px!important}
.pz-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 4px 3px 9px;border-radius:999px;background:var(--accent-soft);color:var(--accent-ink);font-size:11.5px;font-weight:700}
.pz-tag button{width:20px;height:20px;border:0;border-radius:50%;background:transparent;color:inherit;cursor:pointer;font-size:12px}
.pz-sug{display:flex;flex-wrap:wrap;gap:4px}
.pz-sug button{border:1px dashed var(--line2);border-radius:999px;background:transparent;color:var(--muted);font:inherit;font-size:11px;padding:3px 9px;cursor:pointer}
.pz-checks{display:flex;flex-wrap:wrap;gap:11px}
.pz-check{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600}
.pz-check input{width:18px;height:18px;accent-color:var(--accent)}
.pz-acc{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
.pz-aviso{padding:9px 11px;border-radius:10px;background:rgba(245,181,68,.12);color:var(--amber);font-size:12px;font-weight:600}
.pz-res{display:flex;flex-direction:column;gap:7px;margin-top:14px}
.pz-cand{display:grid;grid-template-columns:auto 1fr;gap:4px 11px;padding:11px;border:1px solid var(--line2);border-radius:12px;background:var(--panel)}
.pz-cand.no{opacity:.6}
.pz-cand>input{grid-row:1/span 4;width:20px;height:20px;margin-top:2px;accent-color:var(--accent)}
.pz-cand ul{margin:0;padding-left:16px;font-size:11.5px;color:var(--muted)}
.pz-cand ul a{color:var(--accent-ink)}
.pz-barra{position:sticky;bottom:calc(11px + env(safe-area-inset-bottom,0px));z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:14px;padding:9px 11px;border:1px solid var(--accent-ink);border-radius:12px;background:var(--panel-solid);box-shadow:0 8px 24px rgba(0,0,0,.25)}
.pz-barra span{flex:1 1 auto;font-size:12px;font-weight:700}
.pz-barra input{min-height:36px;padding:6px 9px;border:1px solid var(--line2);border-radius:9px;background:var(--bg2);color:var(--txt);font:inherit;font-size:12px}
.pz-filtros{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 11px}
.pz-filtros select,.pz-filtros input{min-height:36px;padding:6px 9px;border:1px solid var(--line2);border-radius:9px;background:var(--bg2);color:var(--txt);font:inherit;font-size:12px}
.pz-kanban{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(230px,1fr);gap:9px;overflow-x:auto;align-items:start;padding-bottom:7px}
.pz-col{display:flex;flex-direction:column;gap:7px;min-height:120px;padding:9px;border:1px solid var(--line);border-radius:14px;background:var(--bg2)}
.pz-col h3{display:flex;align-items:center;gap:7px;margin:0 0 2px;font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.pz-col h3 span{margin-left:auto;font-size:11px;letter-spacing:0}
.pz-velo{position:fixed;inset:0;z-index:66;display:flex;justify-content:flex-end;background:rgba(0,0,0,.45)}
.pz-panel{display:flex;flex-direction:column;width:min(620px,100%);height:100%;background:var(--panel-solid);border-left:1px solid var(--line2);box-shadow:0 20px 60px rgba(0,0,0,.4)}
.pz-pcab{display:flex;align-items:center;gap:9px;padding:14px 14px 11px;border-bottom:1px solid var(--line)}
.pz-pcab h3{flex:1;margin:0;font-size:15px;font-weight:800;min-width:0;overflow-wrap:anywhere}
.pz-x{width:36px;height:36px;border:1px solid var(--line2);border-radius:9px;background:transparent;color:var(--txt);cursor:pointer;font-size:14px}
.pz-cuerpo{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:14px}
.pz-bloque{display:flex;flex-direction:column;gap:7px}
.pz-item{display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:9px 11px;border:1px solid var(--line2);border-radius:12px;font-size:12.5px}
.pz-item>span{flex:1 1 180px;min-width:0;overflow-wrap:anywhere}
.pz-item small{color:var(--muted)}
.pz-borrador{display:flex;flex-direction:column;gap:7px;padding:11px;border:1px solid var(--accent-ink);border-radius:12px}
.pz-tl{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}
.pz-tl li{font-size:11.5px;color:var(--muted);padding-left:11px;border-left:2px solid var(--line2);overflow-wrap:anywhere;white-space:pre-wrap}
.pz-tl li b{color:var(--txt)}
.pz-tabla{width:100%;border-collapse:collapse;font-size:12px}
.pz-tabla th{text-align:left;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:7px 9px;border-bottom:1px solid var(--line2)}
.pz-tabla td{padding:9px;border-bottom:1px solid var(--line)}
.pz-tabla td.n{text-align:right;font-variant-numeric:tabular-nums}
.pz-scroll{overflow-x:auto}
.pz-cargando{opacity:.75;pointer-events:none}
@media (max-width:820px){
  .pz-busq{grid-template-columns:1fr}
  .pz-form{grid-template-columns:1fr}
  .pz-panel{border-left:0}
  .pz-kanban{grid-auto-columns:minmax(80%,1fr)}
}
`;
const ETAPAS = [['nuevo', 'Nuevo'], ['contactado', 'Contactado'], ['respondio', 'Respondió'], ['reunion', 'Reunión / cotizando'],
  ['propuesta', 'Propuesta enviada'], ['en_espera', 'En espera'], ['ganado', 'Ganado'], ['perdido', 'Perdido']];
const ETAPA = Object.fromEntries(ETAPAS);
const MOTIVOS = [['sin_presupuesto', 'Sin presupuesto'], ['sin_autoridad', 'Sin autoridad (no decide)'], ['mal_momento', 'Mal momento (mejor: en espera)'],
  ['contacto_equivocado', 'Contacto equivocado'], ['ya_tiene_agencia', 'Ya tiene agencia'], ['no_aplica', 'No aplica'], ['sin_respuesta', 'Nunca respondió']];
const MOTIVO = Object.fromEntries([...MOTIVOS, ['no_contactar', 'Pidió no ser contactado']]);
const OBJETIVOS = [['corporativo', 'Corporativo'], ['alianza', 'Alianza'], ['proveedor', 'Proveedor']];
const OBJ = Object.fromEntries(OBJETIVOS);
const ROLES = ['RR.HH.', 'Bienestar', 'Compras', 'Marketing', 'Dueño', 'Gerencia', 'General', 'Otro'];
const TIPOS_SENAL = [['contratacion', 'Contratando'], ['aniversario', 'Aniversario'], ['evento', 'Evento'], ['noticia', 'Noticia'], ['expansion', 'Expansión'], ['premio', 'Premio'], ['temporada', 'Temporada'], ['otro', 'Otro']];
const TIPO_SENAL = Object.fromEntries(TIPOS_SENAL);
const CANALES = [['whatsapp', 'WhatsApp'], ['email', 'Correo'], ['instagram', 'Instagram'], ['llamada', 'Llamada']];
const CANAL = Object.fromEntries([...CANALES, ['presencial', 'Presencial'], ['otro', 'Otro']]);
const TABLA = { no_contactar: 'En la lista de no contactar', prospecto: 'Ya es prospecto', empresa: 'Ya está en Empresas', proveedor: 'Ya está en Proveedores', propuesta: 'Escribió al bot (Propuestas)' };
const ZONAS = ['Caracas', 'Valencia', 'Maracaibo', 'Barquisimeto', 'Maracay', 'Puerto La Cruz', 'Lechería', 'Mérida', 'Margarita', 'Puerto Ordaz', 'San Cristóbal', 'Morrocoy'];
const TIPOS_PROV = [['hospedaje', 'Hospedaje'], ['traslado_terrestre', 'Traslado terrestre'], ['traslado_maritimo', 'Traslado marítimo'], ['full_day', 'Full day'], ['otro', 'Otro']];
const ERRORES = {
  no_autorizado: 'Solo los admins usan esta sección', no_existe: 'Ya no existe', nombre_requerido: 'Falta el nombre', motivo_requerido: 'Elige el motivo de pérdida',
  fecha_espera_requerida: 'Pon la fecha hasta cuándo queda en espera (futura)', proxima_accion_requerida: 'La próxima acción y su fecha son obligatorias',
  duplicado: 'Otro prospecto ya tiene esa web, teléfono o Instagram', datos_invalidos: 'Revisa los datos', ya_convertido: 'Ya fue convertido',
  en_no_contactar: 'Está en la lista de no contactar', prospecto_cerrado: 'El prospecto está cerrado (ganado o perdido)', canal_invalido: 'Canal inválido',
  items_invalidos: 'Nada para guardar', sin_web: 'No tiene web propia que revisar', falta_rubro: 'Escribe el rubro', apagado: 'La búsqueda activa está apagada',
  ya_existe_con_ese_nombre: 'Ya existe una empresa/proveedor con ese nombre', plantilla_no_se_borra: 'Las plantillas no se borran', sin_claves: 'Escribe al menos un dato',
  redaccion_fallo: 'La IA no pudo redactar, prueba otra vez', solo_alta_o_borrado: 'Solo se pueden agregar o borrar señales',
};
const hoyISO = () => new Date(Date.now() - 4 * 36e5).toISOString().slice(0, 10);
const masDias = (d, n) => new Date(new Date(d + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const fCorta = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '';
const hora = t => new Date(t).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' });
const urlOk = u => /^https?:\/\//i.test(String(u || '')) ? String(u) : '';
const webUrl = u => !u ? '' : urlOk(u) || 'https://' + String(u).replace(/^\/+/, '');
const digitos = t => String(t || '').replace(/\D/g, '');

export function crearProspeccion({ sb, esc, ok, error, confirmar, raiz }) {
  const S = { tab: 'hoy', d: null, estado: null, hoy: [], hoyTodos: false, cands: [], sel: new Set(), busq: null, cfg: null, filtros: {}, resumen: null, colMovil: 'nuevo' };
  let listo = false;
  const err = (e, base = 'No se pudo') => error(ERRORES[e?.error || e] || (typeof e === 'string' ? e : e?.message) || base);
  const rpc = async (fn, args = {}) => {
    const { data, error: e } = await sb.rpc(fn, args);
    if (e) return { ok: false, error: e.code === '42501' ? 'no_autorizado' : e.message };
    return data ?? {};
  };
  const ef = async (body) => {
    const { data, error: e } = await sb.functions.invoke('prospeccion-ia', { body });
    if (e) {
      let d = null;
      try { d = await e.context?.json(); } catch { /* sin cuerpo */ }
      return d || { ok: false, error: e.message };
    }
    return data;
  };
  const conCarga = async (btn, fn) => { btn?.classList.add('pz-cargando'); try { return await fn(); } finally { btn?.classList.remove('pz-cargando'); } };
  const sel = (opts, v, vacio) => (vacio !== undefined ? `<option value="">${esc(vacio)}</option>` : '') + opts.map(([k, t]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(t)}</option>`).join('');
  const admin = id => S.d?.admins.find(a => a.id === id)?.nombre || '';
  const oferta = k => S.d?.ofertas.find(o => o.clave === k);

  function css() {
    if (document.getElementById('pz-css')) return;
    const s = document.createElement('style'); s.id = 'pz-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  async function cargar() {
    css();
    if (!listo) {
      listo = true;
      raiz.addEventListener('click', onClick);
      raiz.addEventListener('change', onChange);
      raiz.addEventListener('keydown', onKey);
    }
    const [d, h, e] = await Promise.all([rpc('prospeccion_listar'), rpc('prospeccion_hoy', { p_todos: S.hoyTodos }), S.estado ? S.estado : ef({ accion: 'estado' })]);
    if (d.ok === false) { raiz.innerHTML = `<div class="pz-vacio">${esc(ERRORES[d.error] || 'No se pudo cargar la búsqueda activa.')}</div>`; return; }
    S.d = d; S.hoy = Array.isArray(h) ? h : []; S.estado = e?.ok ? e : { maps: false, web: false };
    if (!S.cfg) usarBusqueda(d.busquedas.find(b => b.es_plantilla) || null);
    pintar();
  }

  // ------------------------------------------------------------------ render
  function pintar() {
    const venc = S.hoy.filter(p => p.vencido).length;
    raiz.innerHTML = `<div class="pz-top"><h2><i class="fas fa-binoculars"></i> Búsqueda activa</h2>
      ${S.d.cuota && !S.d.cuota.activa ? '<span class="pz-chip rojo">Apagada</span>' : ''}
      <button class="btn-sm" data-a="recargar" type="button"><i class="fas fa-rotate"></i> Recargar</button></div>
      <div class="pz-tabs" role="tablist">${[['hoy', 'Hoy'], ['buscar', 'Buscar'], ['prospectos', 'Prospectos'], ['resumen', 'Resumen']].map(([k, t]) =>
        `<button type="button" data-tab="${k}" aria-pressed="${S.tab === k}">${t}${k === 'hoy' && S.hoy.length ? `<b>${S.hoy.length}</b>` : ''}</button>`).join('')}</div>
      <div id="pz-vista">${S.tab === 'hoy' ? vistaHoy(venc) : S.tab === 'buscar' ? vistaBuscar() : S.tab === 'prospectos' ? vistaProspectos() : vistaResumen()}</div>`;
    if (S.tab === 'resumen' && !S.resumen) cargarResumen();
  }

  function tarjeta(p) {
    const venc = p.etapa !== 'ganado' && p.etapa !== 'perdido' && p.proxima_accion_fecha && p.proxima_accion_fecha < S.d.hoy;
    return `<button type="button" class="pz-card${venc ? ' venc' : ''}" data-ficha="${p.id}">
      <div class="pz-cab"><span>${esc(p.nombre)}</span>${p.puntaje_fit != null ? `<small class="pz-chip acc" title="Encaje">${p.puntaje_fit}</small>` : ''}</div>
      <div class="pz-chips"><span class="pz-chip">${esc(OBJ[p.objetivo] || p.objetivo)}</span><span class="pz-chip azul">${esc(ETAPA[p.etapa])}</span>
        ${p.n_senales ? `<span class="pz-chip verde">${p.n_senales} señal${p.n_senales > 1 ? 'es' : ''}</span>` : ''}
        ${p.toques ? `<span class="pz-chip">${p.toques} toque${p.toques > 1 ? 's' : ''}</span>` : ''}
        ${p.sin_actividad ? '<span class="pz-chip ambar">Sin actividad</span>' : ''}${p.motivo_perdida ? `<span class="pz-chip rojo">${esc(MOTIVO[p.motivo_perdida] || '')}</span>` : ''}</div>
      ${p.proxima_accion && !['ganado', 'perdido'].includes(p.etapa) ? `<div class="pz-linea"><b>${esc(p.proxima_accion)}</b> · ${venc ? `<span style="color:var(--danger)">vencida ${fCorta(p.proxima_accion_fecha)}</span>` : fCorta(p.proxima_accion_fecha)}</div>` : ''}
      <div class="pz-linea">${esc([p.rubro, p.ciudad, p.responsable_nombre].filter(Boolean).join(' · '))}</div></button>`;
  }

  function vistaHoy(venc) {
    return `<div class="pz-acc" style="margin:0 0 11px"><div class="pz-seg"><button type="button" data-a="hoy-mios" aria-pressed="${!S.hoyTodos}">Míos y sin dueño</button><button type="button" data-a="hoy-todos" aria-pressed="${S.hoyTodos}">Todos</button></div>
      <span class="pz-linea">${S.hoy.length} para hoy${venc ? ` · <b style="color:var(--danger)">${venc} vencidos</b>` : ''}</span></div>
      ${S.hoy.length ? `<div class="pz-grid">${S.hoy.map(tarjeta).join('')}</div>` : '<div class="pz-vacio">Nada pendiente hoy. Busca empresas nuevas en «Buscar».</div>'}`;
  }

  function usarBusqueda(b) {
    S.busq = b?.id ?? null;
    const c = b?.config || {};
    S.cfg = { nombre: b && !b.es_plantilla ? b.nombre : '', objetivo: b?.objetivo || 'corporativo', rubro: c.rubro || '', zonas: [...(c.zonas || [])], tamano: c.tamano || '',
      palabras: [...(c.palabras || [])], excluir: [...(c.excluir || [])], fuentes: [...(c.fuentes || ['web'])], cantidad: c.cantidad || 20, oferta: b?.oferta || '' };
  }

  const tags = (k, ph) => `<div class="pz-tags" data-tags="${k}">${S.cfg[k].map((t, i) => `<span class="pz-tag">${esc(t)}<button type="button" data-quitar="${k}:${i}" aria-label="Quitar">×</button></span>`).join('')}<input placeholder="${esc(ph)}" data-tagin="${k}"></div>`;

  function vistaBuscar() {
    const c = S.cfg, b = S.d.busquedas;
    const item = x => `<button type="button" data-busq="${x.id}" aria-pressed="${S.busq === x.id}">${esc(x.nombre)}<small>${esc(OBJ[x.objetivo])}${x.veces ? ` · ${x.veces} vez${x.veces > 1 ? 'es' : ''}` : ''}</small></button>`;
    const cuota = S.d.cuota || {};
    return `<div class="pz-busq"><div class="pz-plantillas">
        <button type="button" data-a="busq-nueva"><span><i class="fas fa-plus"></i> Búsqueda nueva</span></button>
        ${b.some(x => !x.es_plantilla) ? `<h4>Guardadas</h4>${b.filter(x => !x.es_plantilla).map(item).join('')}` : ''}
        <h4>Plantillas</h4>${b.filter(x => x.es_plantilla).map(item).join('')}
        <p class="pz-linea">Web hoy: ${cuota.web_hoy ?? 0}/${cuota.tope_web_dia ?? 20} · Maps este mes: ${cuota.maps_mes ?? 0}/${cuota.maps_tope_mes ?? 900}</p></div>
      <div><form class="pz-form" id="pz-fbusq" onsubmit="return false">
        <div class="pz-campo ancho"><span>Qué busco</span><div class="pz-seg">${OBJETIVOS.map(([k, t]) => `<button type="button" data-obj="${k}" aria-pressed="${c.objetivo === k}">${t}</button>`).join('')}</div></div>
        <label class="pz-campo ancho"><span>Rubro</span><input data-cfg="rubro" value="${esc(c.rubro)}" placeholder="Ej.: wedding planners, farmacéuticas, colegios privados"></label>
        <div class="pz-campo ancho"><span>Zonas</span>${tags('zonas', 'Escribe y Enter')}<div class="pz-sug">${ZONAS.filter(z => !c.zonas.includes(z)).slice(0, 8).map(z => `<button type="button" data-zona="${esc(z)}">+ ${esc(z)}</button>`).join('')}</div></div>
        <label class="pz-campo"><span>Tamaño</span><input data-cfg="tamano" value="${esc(c.tamano)}" placeholder="Ej.: 50+ empleados"></label>
        <label class="pz-campo"><span>Qué le ofrecemos</span><select data-cfg="oferta">${sel(S.d.ofertas.filter(o => o.objetivo === c.objetivo).map(o => [o.clave, o.nombre]), c.oferta, '—')}</select></label>
        <div class="pz-campo"><span>Palabras clave</span>${tags('palabras', 'Enter para agregar')}</div>
        <div class="pz-campo"><span>Excluir</span>${tags('excluir', 'Enter para agregar')}</div>
        <div class="pz-campo"><span>Fuentes</span><div class="pz-checks">
          <label class="pz-check"><input type="checkbox" data-fuente="web" ${c.fuentes.includes('web') ? 'checked' : ''}> Web (IA)</label>
          <label class="pz-check" title="${S.estado.maps ? '' : 'Falta conectar Google Maps (clave pendiente)'}"><input type="checkbox" data-fuente="maps" ${c.fuentes.includes('maps') ? 'checked' : ''} ${S.estado.maps ? '' : 'disabled'}> Google Maps${S.estado.maps ? '' : ' (pendiente)'}</label></div></div>
        <label class="pz-campo"><span>Cantidad</span><select data-cfg="cantidad">${sel([10, 20, 30, 40].map(n => [String(n), String(n)]), String(c.cantidad))}</select></label>
        <div class="pz-acc ancho"><button class="btn-acc" type="button" data-a="buscar"><i class="fas fa-magnifying-glass"></i> Buscar</button>
          <input data-cfg="nombre" value="${esc(c.nombre)}" placeholder="Nombre para guardarla" style="min-height:36px;flex:1 1 160px;padding:6px 9px;border:1px solid var(--line2);border-radius:9px;background:var(--bg2);color:var(--txt);font:inherit;font-size:12px">
          <button class="btn-sec" type="button" data-a="busq-guardar"><i class="fas fa-floppy-disk"></i> Guardar búsqueda</button>
          ${S.busq && !S.d.busquedas.find(x => x.id === S.busq)?.es_plantilla ? '<button class="btn-sec" type="button" data-a="busq-borrar"><i class="fas fa-trash"></i></button>' : ''}</div>
      </form><div id="pz-res">${vistaResultados()}</div></div></div>`;
  }

  function vistaResultados() {
    if (!S.cands.length) return S.avisos?.length ? S.avisos.map(a => `<div class="pz-aviso">${esc(a)}</div>`).join('') : '';
    const n = S.sel.size;
    return `<div class="pz-res">${(S.avisos || []).map(a => `<div class="pz-aviso">${esc(a)}</div>`).join('')}
      ${S.cands.map((x, i) => {
        const ya = x.existente, duro = ya?.duro || x.guardado;
        return `<label class="pz-cand${x.encaje === false || duro ? ' no' : ''}"><input type="checkbox" data-cand="${i}" ${S.sel.has(i) ? 'checked' : ''} ${duro ? 'disabled' : ''}>
          <div class="pz-cab"><span>${esc(x.nombre)}</span>${x.puntaje_fit != null ? `<small class="pz-chip ${x.encaje === false ? 'rojo' : 'acc'}">Encaje ${x.puntaje_fit}</small>` : ''}${x.puntaje_intencion ? `<small class="pz-chip verde">Señales ${x.puntaje_intencion}</small>` : ''}</div>
          ${x.guardado ? '<div class="pz-chips"><span class="pz-chip verde">Guardado</span></div>' : ya ? `<div class="pz-chips"><span class="pz-chip ${ya.duro ? 'rojo' : 'ambar'}">${esc(ya.posible_duplicado ? 'Posible duplicado de ' + ya.nombre : (TABLA[ya.tabla] || 'Ya lo tenemos') + (ya.nombre ? ': ' + ya.nombre : ''))}</span></div>` : ''}
          ${x.por_que ? `<div class="pz-linea">${esc(x.por_que)}</div>` : ''}
          <div class="pz-linea">${[x.rubro, x.ciudad || x.direccion, x.tel_e164 || x.telefono, x.email, x.instagram && '@' + x.instagram].filter(Boolean).map(esc).join(' · ')}
            ${x.web ? ` · <a href="${esc(webUrl(x.web))}" target="_blank" rel="noopener noreferrer">web</a>` : ''}${urlOk(x.fuente_url) ? ` · <a href="${esc(x.fuente_url)}" target="_blank" rel="noopener noreferrer">fuente</a>` : ''}</div>
          ${x.senales?.length ? `<ul>${x.senales.map(s => `<li>${esc(s.afirmacion)} <a href="${esc(urlOk(s.fuente_url))}" target="_blank" rel="noopener noreferrer">fuente</a></li>`).join('')}</ul>` : ''}</label>`;
      }).join('')}
      <div class="pz-barra"><span>${n} elegido${n === 1 ? '' : 's'}</span><input data-campana placeholder="Campaña (opcional)" value="${esc(S.campana || '')}">
        <button class="btn-sec" type="button" data-a="sel-buenos">Elegir los de buen encaje</button>
        <button class="btn-acc" type="button" data-a="guardar-sel" ${n ? '' : 'disabled'}><i class="fas fa-floppy-disk"></i> Guardar elegidos</button></div></div>`;
  }

  function filtrados() {
    const f = S.filtros, q = (f.q || '').toLowerCase();
    return S.d.prospectos.filter(p => (!f.objetivo || p.objetivo === f.objetivo) && (!f.responsable || (f.responsable === 'sin' ? !p.responsable : p.responsable === f.responsable))
      && (!f.campana || p.campana === f.campana) && (!q || [p.nombre, p.rubro, p.ciudad, p.zona].some(v => (v || '').toLowerCase().includes(q))));
  }

  function vistaProspectos() {
    const f = S.filtros, lista = filtrados();
    const campanas = [...new Set(S.d.prospectos.map(p => p.campana).filter(Boolean))].sort();
    return `<div class="pz-filtros">
        <input data-f="q" value="${esc(f.q || '')}" placeholder="Buscar nombre, rubro o ciudad">
        <select data-f="objetivo">${sel(OBJETIVOS, f.objetivo, 'Todo tipo')}</select>
        <select data-f="responsable">${sel([['sin', 'Sin responsable'], ...S.d.admins.map(a => [a.id, a.nombre])], f.responsable, 'Todo responsable')}</select>
        ${campanas.length ? `<select data-f="campana">${sel(campanas.map(c => [c, c]), f.campana, 'Toda campaña')}</select>` : ''}
        <span style="flex:1"></span>
        <button class="btn-sm" type="button" data-a="nuevo-manual"><i class="fas fa-plus"></i> Agregar a mano</button>
        <label class="btn-sm" style="display:inline-flex;align-items:center;gap:6px"><i class="fas fa-file-csv"></i> Importar CSV<input type="file" accept=".csv,text/csv" data-csv hidden></label>
        <button class="btn-sm" type="button" data-a="nc-manual"><i class="fas fa-ban"></i> No contactar</button></div>
      ${S.d.prospectos.length ? `<div class="pz-kanban">${ETAPAS.map(([k, t]) => {
        const col = lista.filter(p => p.etapa === k);
        return `<div class="pz-col"><h3>${t}<span>${col.length}</span></h3>${col.slice(0, 80).map(tarjeta).join('') || '<div class="pz-vacio">—</div>'}${col.length > 80 ? `<div class="pz-linea">y ${col.length - 80} más: usa los filtros</div>` : ''}</div>`;
      }).join('')}</div>` : '<div class="pz-vacio">Todavía no hay prospectos. Busca empresas en «Buscar» o agrégalas a mano.</div>'}`;
  }

  function vistaResumen() {
    const r = S.resumen, desde = S.rDesde || masDias(hoyISO(), -27), hasta = S.rHasta || hoyISO();
    const cab = `<div class="pz-filtros"><input type="date" data-r="desde" value="${desde}"><input type="date" data-r="hasta" value="${hasta}"><button class="btn-sm" type="button" data-a="resumen">Ver</button></div>`;
    if (!r) return cab + '<div class="pz-vacio">Cargando…</div>';
    if (r.ok === false) return cab + `<div class="pz-vacio">${esc(ERRORES[r.error] || 'No se pudo cargar')}</div>`;
    const tabla = (cols, filas) => `<div class="pz-scroll"><table class="pz-tabla"><thead><tr>${cols.map(([, t], i) => `<th${i ? ' style="text-align:right"' : ''}>${t}</th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr>${cols.map(([k], i) => `<td${i ? ' class="n"' : ''}>${esc(f[k] ?? '')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" class="pz-vacio">Sin actividad en el rango</td></tr>`}</tbody></table></div>`;
    const M = [['busquedas', 'Búsquedas'], ['guardados', 'Guardados'], ['toques', 'Toques'], ['respuestas', 'Respuestas'], ['positivas', 'Positivas'], ['reuniones', 'Reuniones'], ['ganados', 'Ganados']];
    return cab + `<div class="pz-bloque"><h4>Por admin (ranking: respuestas positivas y reuniones pesan más que el volumen)</h4>${tabla([['nombre', 'Admin'], ...M, ['puntaje', 'Puntaje']], r.por_admin.map(x => ({ ...x, nombre: x.nombre || '—' })))}</div>
      <div class="pz-bloque"><h4>Por semana</h4>${tabla([['sem', 'Semana · admin'], ...M], r.por_semana.map(x => ({ ...x, sem: `${fCorta(x.semana)} · ${x.nombre || '—'}` })))}</div>
      <div class="pz-bloque"><h4>Embudo por canal</h4>${tabla([['canal', 'Canal'], ['toques', 'Toques'], ['respuestas', 'Respuestas'], ['positivas', 'Positivas'], ['tasa', '% respuesta']], r.por_canal.map(x => ({ ...x, canal: CANAL[x.canal] || x.canal, tasa: x.toques ? Math.round(100 * x.respuestas / x.toques) + ' %' : '—' })))}</div>
      <div class="pz-bloque"><h4>Por tipo</h4>${tabla([['objetivo', 'Tipo'], ['guardados', 'Guardados'], ['toques', 'Toques'], ['respuestas', 'Respuestas'], ['reuniones', 'Reuniones'], ['ganados', 'Ganados']], r.por_tipo.map(x => ({ ...x, objetivo: OBJ[x.objetivo] || x.objetivo })))}</div>`;
  }

  async function cargarResumen() {
    const desde = S.rDesde || masDias(hoyISO(), -27), hasta = S.rHasta || hoyISO();
    S.resumen = await rpc('prospeccion_resumen', { p_desde: desde, p_hasta: hasta });
    if (S.tab === 'resumen') document.getElementById('pz-vista').innerHTML = vistaResumen();
  }

  // ------------------------------------------------------------------ búsqueda
  function leerForm() {
    raiz.querySelectorAll('[data-cfg]').forEach(i => { S.cfg[i.dataset.cfg] = i.dataset.cfg === 'cantidad' ? Number(i.value) : i.value.trim(); });
    raiz.querySelectorAll('[data-tagin]').forEach(i => { const v = i.value.trim(); if (v && !S.cfg[i.dataset.tagin].includes(v)) S.cfg[i.dataset.tagin].push(v); i.value = ''; });
  }
  const configDe = c => ({ objetivo: c.objetivo, rubro: c.rubro, zonas: c.zonas, tamano: c.tamano, palabras: c.palabras, excluir: c.excluir, fuentes: c.fuentes, cantidad: c.cantidad });

  async function buscar(btn) {
    leerForm();
    if (!S.cfg.rubro) return error('Escribe el rubro');
    if (!S.cfg.fuentes.length) return error('Elige al menos una fuente');
    const r = await conCarga(btn, () => ef({ accion: 'buscar', busqueda_id: S.busq, config: configDe(S.cfg), oferta: S.cfg.oferta || null }));
    if (!r?.ok) return err(r, 'La búsqueda falló');
    S.cands = r.candidatos || []; S.avisos = r.avisos || []; S.d.cuota = r.cuota || S.d.cuota;
    S.sel = new Set(S.cands.map((x, i) => (x.encaje !== false && !x.existente ? i : -1)).filter(i => i >= 0));
    pintar();
  }

  async function guardarBusqueda(borrar) {
    leerForm();
    if (borrar && !(await confirmar({ titulo: '¿Borrar esta búsqueda guardada?', detalle: 'Los prospectos que ya guardaste no se tocan.', textoOk: 'Borrar', destructivo: true }))) return;
    const plantilla = S.d.busquedas.find(x => x.id === S.busq)?.es_plantilla;
    const id = plantilla ? null : S.busq;
    if (!borrar && !S.cfg.nombre) return error('Ponle un nombre a la búsqueda');
    const r = await rpc('prospeccion_guardar_busqueda', { p_id: id, p_datos: borrar ? { borrar: true } : { nombre: S.cfg.nombre, objetivo: S.cfg.objetivo, config: configDe(S.cfg), oferta: S.cfg.oferta || '' } });
    if (!r.ok) return err(r);
    ok(borrar ? 'Búsqueda borrada' : 'Búsqueda guardada');
    if (borrar) { S.busq = null; S.cfg = null; } else S.busq = r.busqueda.id;
    await cargar();
  }

  async function guardarElegidos(btn) {
    const idx = [...S.sel].sort((a, b) => a - b);
    const campana = raiz.querySelector('[data-campana]')?.value.trim() || null;
    S.campana = campana;
    const items = idx.map(i => {
      const x = S.cands[i];
      return { nombre: x.nombre, objetivo: x.objetivo, rubro: x.rubro, ciudad: x.ciudad, zona: x.zona, direccion: x.direccion, web: x.web, dominio: x.dominio,
        telefono: x.telefono, tel_e164: x.tel_e164, email: x.email, instagram: x.instagram, origen: x.origen, place_id: x.place_id, fuente_url: x.fuente_url,
        puntaje_fit: x.puntaje_fit, puntaje_intencion: x.puntaje_intencion, por_que: x.por_que, oferta: S.cfg.oferta || x.oferta || null, campana, senales: x.senales };
    });
    const r = await conCarga(btn, () => rpc('prospectos_guardar', { p_items: items, p_busqueda_id: S.busq }));
    if (!r.ok) return err(r);
    (r.creados || []).forEach(c => { S.cands[idx[c.i]].guardado = true; });
    (r.omitidos || []).forEach(o => { const x = S.cands[idx[o.i]]; x.existente = o.existente || { tabla: o.motivo, duro: true }; });
    S.sel.clear();
    ok(`${r.creados.length} guardado${r.creados.length === 1 ? '' : 's'}${r.omitidos.length ? ` · ${r.omitidos.length} ya los teníamos` : ''}`);
    const d = await rpc('prospeccion_listar'); if (d.ok !== false) S.d = d;
    const h = await rpc('prospeccion_hoy', { p_todos: S.hoyTodos }); if (Array.isArray(h)) S.hoy = h;
    pintar();
  }

  // ------------------------------------------------------------------ ficha
  let F = null;
  function cerrarFicha() { document.getElementById('pz-velo')?.remove(); F = null; }

  async function abrirFicha(id) {
    const r = await rpc('prospecto_ficha', { p_id: id });
    if (!r.ok) return err(r);
    F = { ...r, borrador: F?.prospecto?.id === id ? F.borrador : null };
    pintarFicha();
    const p = r.prospecto;
    if (p.maps_vencido && S.estado?.maps) {
      const m = await ef({ accion: 'refrescar_maps', prospecto_id: id });
      if (m?.ok && m.prospecto && F?.prospecto.id === id) { F.prospecto = m.prospecto; pintarFicha(); }
    }
  }

  function linkContacto(c, p) {
    const out = [];
    const tel = digitos(c.tel_e164 || c.telefono);
    if (tel) out.push(`<button class="btn-sm" type="button" data-abrir="whatsapp" data-dest="${tel}"><i class="fa-brands fa-whatsapp"></i></button>`);
    if (c.email) out.push(`<button class="btn-sm" type="button" data-abrir="email" data-dest="${esc(c.email)}"><i class="fas fa-envelope"></i></button>`);
    if (c.instagram) out.push(`<button class="btn-sm" type="button" data-abrir="instagram" data-dest="${esc(c.instagram)}"><i class="fa-brands fa-instagram"></i></button>`);
    return out.join('');
  }

  function pintarFicha() {
    if (!F) return;
    const p = F.prospecto, cerrado = ['ganado', 'perdido'].includes(p.etapa);
    let velo = document.getElementById('pz-velo');
    if (!velo) {
      velo = document.createElement('div'); velo.id = 'pz-velo'; velo.className = 'pz-velo';
      velo.addEventListener('click', e => { if (e.target === velo) cerrarFicha(); else onClick(e); });
      velo.addEventListener('change', onChange);
      document.body.appendChild(velo);
    }
    const contactos = [{ id: 0, nombre: 'Empresa', rol: '', tel_e164: p.tel_e164, telefono: p.telefono, email: p.email, instagram: p.instagram }, ...F.contactos];
    const b = F.borrador;
    velo.innerHTML = `<div class="pz-panel" role="dialog" aria-label="Prospecto"><div class="pz-pcab"><h3>${esc(p.nombre)}</h3>
        <span class="pz-chip azul">${esc(ETAPA[p.etapa])}</span><button class="pz-x" type="button" data-a="cerrar" aria-label="Cerrar">✕</button></div>
      <div class="pz-cuerpo">
        <div class="pz-chips"><span class="pz-chip">${esc(OBJ[p.objetivo])}</span><span class="pz-chip">${esc({ maps: 'Google Maps', web: 'Web IA', manual: 'A mano', csv: 'CSV' }[p.origen])}</span>
          ${p.puntaje_fit != null ? `<span class="pz-chip acc">Encaje ${p.puntaje_fit}</span>` : ''}${p.convertido_tipo ? `<span class="pz-chip verde">Convertido a ${p.convertido_tipo === 'empresa' ? 'Empresas' : 'Proveedores'}</span>` : ''}
          ${p.motivo_perdida ? `<span class="pz-chip rojo">${esc(MOTIVO[p.motivo_perdida])}</span>` : ''}</div>
        ${p.por_que ? `<div class="pz-linea">${esc(p.por_que)}</div>` : ''}
        ${urlOk(p.fuente_url) ? `<div class="pz-linea">Visto en <a href="${esc(p.fuente_url)}" target="_blank" rel="noopener noreferrer">${esc(p.fuente_url.slice(0, 70))}</a></div>` : ''}

        <form class="pz-form" data-form="seguimiento" onsubmit="return false">
          <label class="pz-campo"><span>Etapa</span><select name="etapa" ${p.convertido_id || p.motivo_perdida === 'no_contactar' ? 'disabled' : ''}>${sel(ETAPAS, p.etapa)}</select></label>
          <label class="pz-campo" data-solo="perdido" ${p.etapa === 'perdido' ? '' : 'hidden'}><span>Motivo de pérdida</span><select name="motivo_perdida">${sel(MOTIVOS, p.motivo_perdida, 'Elige…')}</select></label>
          <label class="pz-campo" data-solo="en_espera" ${p.etapa === 'en_espera' ? '' : 'hidden'}><span>En espera hasta</span><input type="date" name="en_espera_hasta" min="${masDias(S.d.hoy, 1)}" value="${p.en_espera_hasta || ''}"></label>
          <label class="pz-campo ancho"><span>Próxima acción (obligatoria)</span><input name="proxima_accion" value="${esc(p.proxima_accion || '')}" placeholder="Ej.: Llamar a RR.HH."></label>
          <label class="pz-campo"><span>Fecha</span><input type="date" name="proxima_accion_fecha" value="${p.proxima_accion_fecha || ''}"></label>
          <label class="pz-campo"><span>Responsable</span><select name="responsable">${sel(S.d.admins.map(a => [a.id, a.nombre]), p.responsable, 'Sin responsable')}</select></label>
          <label class="pz-campo ancho"><span>Nota para la línea de tiempo</span><input name="nota_actividad" placeholder="Opcional"></label>
          <div class="pz-acc ancho"><button class="btn-acc" type="button" data-a="guardar-seg">Guardar seguimiento</button></div></form>

        <div class="pz-bloque"><h4>Contactos</h4>
          ${contactos.map(c => (c.id === 0 && !c.tel_e164 && !c.telefono && !c.email && !c.instagram) ? '' : `<div class="pz-item"><span><b>${esc(c.nombre || 'Sin nombre')}</b>${c.rol ? ` <small>${esc(c.rol)}</small>` : ''}${c.es_oficial ? ' <small class="pz-chip verde">oficial</small>' : ''}<br>
            <small>${[c.tel_e164 || c.telefono, c.email, c.instagram && '@' + c.instagram].filter(Boolean).map(esc).join(' · ')}</small></span>${linkContacto(c, p)}
            ${c.id ? `<button class="btn-sm" type="button" data-borrar-contacto="${c.id}" aria-label="Borrar"><i class="fas fa-trash"></i></button>` : ''}</div>`).join('')}
          <form class="pz-form" data-form="contacto" onsubmit="return false">
            <label class="pz-campo"><span>Nombre</span><input name="nombre"></label>
            <label class="pz-campo"><span>Cargo</span><select name="rol">${sel(ROLES.map(r => [r, r]), '', '—')}</select></label>
            <label class="pz-campo"><span>Teléfono / WhatsApp</span><input name="telefono" inputmode="tel"></label>
            <label class="pz-campo"><span>Correo</span><input name="email" type="email"></label>
            <label class="pz-campo"><span>Instagram</span><input name="instagram" placeholder="@usuario"></label>
            <div class="pz-acc" style="align-self:end"><button class="btn-sec" type="button" data-a="add-contacto"><i class="fas fa-plus"></i> Agregar contacto</button></div></form>
          <div class="pz-acc"><button class="btn-sm" type="button" data-a="enriquecer" ${p.web || p.dominio ? '' : 'disabled title="Sin web propia"'}><i class="fas fa-globe"></i> Buscar contactos en su web</button></div></div>

        <div class="pz-bloque"><h4>Señales (con fuente)</h4>
          ${F.senales.map(s => `<div class="pz-item"><span><b>${esc(TIPO_SENAL[s.tipo] || s.tipo)}</b> ${esc(s.afirmacion)} <small>${s.fecha ? fCorta(s.fecha) : ''}</small> <a href="${esc(urlOk(s.fuente_url))}" target="_blank" rel="noopener noreferrer">fuente</a></span>
            <button class="btn-sm" type="button" data-borrar-senal="${s.id}" aria-label="Borrar"><i class="fas fa-trash"></i></button></div>`).join('') || '<div class="pz-linea">Sin señales. Un mensaje sin un dato verificable de la empresa sale genérico.</div>'}
          <form class="pz-form" data-form="senal" onsubmit="return false">
            <label class="pz-campo"><span>Tipo</span><select name="tipo">${sel(TIPOS_SENAL, 'otro')}</select></label>
            <label class="pz-campo"><span>Fecha</span><input type="date" name="fecha"></label>
            <label class="pz-campo ancho"><span>Qué pasó</span><input name="afirmacion" placeholder="Ej.: Cumple 25 años en diciembre"></label>
            <label class="pz-campo ancho"><span>URL de la fuente</span><input name="fuente_url" type="url" placeholder="https://"></label>
            <div class="pz-acc ancho"><button class="btn-sec" type="button" data-a="add-senal"><i class="fas fa-plus"></i> Agregar señal</button></div></form></div>

        ${cerrado ? '' : `<div class="pz-bloque"><h4>Mensaje (la IA redacta, usted revisa y envía)</h4>
          <form class="pz-form" data-form="mensaje" onsubmit="return false">
            <label class="pz-campo"><span>Canal</span><select name="canal">${sel(CANALES, b?.canal || (p.email ? 'email' : p.instagram ? 'instagram' : 'whatsapp'))}</select></label>
            <label class="pz-campo"><span>Para</span><select name="contacto_id">${sel(F.contactos.filter(c => c.nombre).map(c => [String(c.id), `${c.nombre}${c.rol ? ' · ' + c.rol : ''}`]), '', 'La empresa')}</select></label>
            <label class="pz-campo"><span>Oferta</span><select name="oferta">${sel(S.d.ofertas.map(o => [o.clave, o.nombre]), p.oferta || '', '—')}</select></label>
            <label class="pz-campo"><span>Indicación (opcional)</span><input name="instrucciones" placeholder="Ej.: mencionar Los Roques"></label>
            <div class="pz-acc ancho"><button class="btn-acc" type="button" data-a="redactar"><i class="fas fa-pen-nib"></i> Redactar</button>
              <span class="pz-linea">Toque ${Math.min((p.toques || 0) + 1, 5)} de 5 · D1 → D3 → D7 → D14 → D21</span></div></form>
          ${b ? `<div class="pz-borrador">${(b.avisos || []).map(a => `<div class="pz-aviso">${esc(a)}</div>`).join('')}
            ${b.canal === 'email' ? `<label class="pz-campo"><span>Asunto</span><input id="pz-asunto" value="${esc(b.asunto || '')}"></label>` : ''}
            <label class="pz-campo"><span>Texto (edítalo antes de enviar)</span><textarea id="pz-texto" rows="7">${esc(b.texto)}</textarea></label>
            <div class="pz-acc"><button class="btn-sec" type="button" data-a="copiar"><i class="fas fa-copy"></i> Copiar</button>
              ${linkContacto(contactoDe(b), p)}
              <button class="btn-acc" type="button" data-a="enviado"><i class="fas fa-check"></i> Marcar enviado</button></div></div>` : ''}
          <div class="pz-acc"><span class="pz-linea">¿Respondió?</span>
            <button class="btn-sm" type="button" data-resp="positivo">Sí, interesado</button><button class="btn-sm" type="button" data-resp="respondio">Respondió</button><button class="btn-sm" type="button" data-resp="negativo">No le interesa</button></div></div>`}

        <form class="pz-form" data-form="datos" onsubmit="return false"><div class="pz-campo ancho"><span style="font-size:11px">Datos de la empresa</span></div>
          ${[['nombre', 'Nombre'], ['rubro', 'Rubro'], ['ciudad', 'Ciudad'], ['zona', 'Estado / zona'], ['web', 'Web'], ['telefono', 'Teléfono'], ['email', 'Correo'], ['instagram', 'Instagram'], ['campana', 'Campaña']]
            .map(([k, t]) => `<label class="pz-campo"><span>${t}</span><input name="${k}" value="${esc(p[k] || '')}"></label>`).join('')}
          <label class="pz-campo"><span>Tipo</span><select name="objetivo">${sel(OBJETIVOS, p.objetivo)}</select></label>
          <label class="pz-campo ancho"><span>Notas</span><textarea name="notas">${esc(p.notas || '')}</textarea></label>
          <div class="pz-acc ancho"><button class="btn-sec" type="button" data-a="guardar-datos">Guardar datos</button></div></form>

        <div class="pz-bloque"><h4>Cerrar</h4><div class="pz-acc">
          ${p.convertido_id ? '' : `<button class="btn-sec" type="button" data-a="convertir-empresa" ${p.motivo_perdida === 'no_contactar' ? 'disabled' : ''}><i class="fas fa-building"></i> Convertir en empresa</button>
          <button class="btn-sec" type="button" data-a="convertir-proveedor" ${p.motivo_perdida === 'no_contactar' ? 'disabled' : ''}><i class="fas fa-truck-field"></i> Convertir en proveedor</button>`}
          ${p.motivo_perdida === 'no_contactar' ? '' : '<button class="btn-sec" type="button" data-a="no-contactar" style="color:var(--danger)"><i class="fas fa-ban"></i> No contactar</button>'}</div></div>

        <div class="pz-bloque"><h4>Línea de tiempo</h4><ul class="pz-tl">${F.actividad.map(a => `<li><b>${esc(hora(a.created_at))}</b> · ${esc(a.usuario_nombre || '')} · ${esc(textoActividad(a))}${a.texto ? '\n' + esc(a.texto.slice(0, 600)) : ''}</li>`).join('') || '<li>Sin actividad</li>'}</ul></div>
      </div></div>`;
  }

  function textoActividad(a) {
    if (a.tipo === 'toque') return `Toque ${a.paso || ''} por ${CANAL[a.canal] || a.canal}`;
    if (a.tipo === 'respuesta') return `Respondió por ${CANAL[a.canal] || a.canal} (${{ positivo: 'interesado', negativo: 'no le interesa', neutral: 'neutral' }[a.resultado] || a.resultado})`;
    if (a.tipo === 'etapa') return `Etapa: ${ETAPA[a.resultado] || a.resultado}`;
    if (a.tipo === 'creado') return `Guardado (${a.resultado})`;
    if (a.tipo === 'convertido') return `Convertido a ${a.resultado === 'empresa' ? 'Empresas' : 'Proveedores'}`;
    return { nota: 'Nota', no_contactar: 'No contactar', enriquecido: 'Contactos' }[a.tipo] || a.tipo;
  }

  const contactoDe = b => F.contactos.find(c => String(c.id) === String(b.contacto_id)) || { tel_e164: F.prospecto.tel_e164, telefono: F.prospecto.telefono, email: F.prospecto.email, instagram: F.prospecto.instagram };
  const datosForm = n => Object.fromEntries(new FormData(document.querySelector(`#pz-velo [data-form="${n}"]`)).entries());

  async function despuesDe(r, msg) {
    if (!r?.ok) { err(r); return false; }
    if (msg) ok(msg);
    cuentaHoy = null;
    if (F?.prospecto?.id) await abrirFicha(F.prospecto.id);
    const d = await rpc('prospeccion_listar'); if (d.ok !== false) S.d = d;
    const h = await rpc('prospeccion_hoy', { p_todos: S.hoyTodos }); if (Array.isArray(h)) S.hoy = h;
    if (document.body.contains(raiz)) pintar();
    return true;
  }

  async function abrirCanal(canal, dest) {
    const t = document.getElementById('pz-texto')?.value || '';
    const asunto = document.getElementById('pz-asunto')?.value || '';
    if (canal === 'whatsapp') window.open(`https://wa.me/${dest}${t ? '?text=' + encodeURIComponent(t) : ''}`, '_blank', 'noopener');
    else if (canal === 'email') location.href = `mailto:${encodeURIComponent(dest)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(t)}`;
    else {
      if (t) { try { await navigator.clipboard.writeText(t); ok('Texto copiado: pégalo en el DM'); } catch { /* sin portapapeles */ } }
      window.open(`https://ig.me/m/${encodeURIComponent(dest)}`, '_blank', 'noopener');
    }
  }

  // ------------------------------------------------------------------ alta manual, CSV, no contactar
  function hojaSimple(titulo, cuerpo, onOk) {
    cerrarFicha();
    const velo = document.createElement('div'); velo.id = 'pz-velo'; velo.className = 'pz-velo';
    velo.innerHTML = `<div class="pz-panel" role="dialog" aria-label="${esc(titulo)}"><div class="pz-pcab"><h3>${esc(titulo)}</h3><button class="pz-x" type="button" data-x aria-label="Cerrar">✕</button></div>
      <form class="pz-cuerpo" onsubmit="return false"><div class="pz-form">${cuerpo}</div><div class="pz-acc"><button class="btn-acc" type="submit">Guardar</button></div></form></div>`;
    velo.addEventListener('click', e => { if (e.target === velo || e.target.closest('[data-x]')) cerrarFicha(); });
    velo.querySelector('form').addEventListener('submit', async e => { const b = e.submitter; await conCarga(b, () => onOk(Object.fromEntries(new FormData(e.target).entries()))); });
    document.body.appendChild(velo);
  }

  function nuevoManual() {
    hojaSimple('Agregar prospecto', `<label class="pz-campo ancho"><span>Nombre</span><input name="nombre" required></label>
      <label class="pz-campo"><span>Tipo</span><select name="objetivo">${sel(OBJETIVOS, 'corporativo')}</select></label>
      ${[['rubro', 'Rubro'], ['ciudad', 'Ciudad'], ['web', 'Web'], ['telefono', 'Teléfono'], ['email', 'Correo'], ['instagram', 'Instagram'], ['campana', 'Campaña']].map(([k, t]) => `<label class="pz-campo"><span>${t}</span><input name="${k}"></label>`).join('')}
      <label class="pz-campo ancho"><span>Notas (de dónde salió: referido, feria…)</span><textarea name="notas"></textarea></label>`, async d => {
      const item = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
      const r = await rpc('prospectos_guardar', { p_items: [{ ...item, origen: 'manual' }] });
      if (!r.ok) return err(r);
      if (!r.creados.length) return error(`Ya lo tenemos: ${TABLA[r.omitidos[0]?.motivo] || 'duplicado'}${r.omitidos[0]?.existente?.nombre ? ' (' + r.omitidos[0].existente.nombre + ')' : ''}`);
      ok('Prospecto agregado'); cerrarFicha(); await cargar(); abrirFicha(r.creados[0].id);
    });
  }

  function noContactarManual() {
    hojaSimple('Agregar a «no contactar»', `<p class="pz-linea ancho">Nadie con estos datos vuelve a aparecer en las búsquedas, y los prospectos que coincidan se cierran.</p>
      ${[['nombre', 'Nombre (referencia)'], ['dominio', 'Web o dominio'], ['telefono', 'Teléfono'], ['email', 'Correo'], ['instagram', 'Instagram']].map(([k, t]) => `<label class="pz-campo"><span>${t}</span><input name="${k}"></label>`).join('')}
      <label class="pz-campo ancho"><span>Motivo</span><input name="motivo" placeholder="Ej.: pidió no ser contactado"></label>`, async d => {
      const { motivo, ...datos } = d;
      const r = await rpc('prospecto_no_contactar', { p_id: null, p_motivo: motivo || null, p_datos: datos });
      if (!r.ok) return err(r);
      ok('Agregado a no contactar'); cerrarFicha(); await cargar();
    });
  }

  function parseCsv(t) {
    const l1 = t.split(/\r?\n/, 1)[0], sep = (l1.split(';').length > l1.split(',').length) ? ';' : ',';
    const filas = []; let f = [], c = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) { if (ch === '"' && t[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; continue; }
      if (ch === '"') q = true; else if (ch === sep) { f.push(c); c = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; f.push(c); filas.push(f); f = []; c = ''; } else c += ch;
    }
    if (c || f.length) { f.push(c); filas.push(f); }
    return filas.filter(r => r.some(x => x.trim()));
  }

  async function importarCsv(file) {
    const filas = parseCsv(await file.text());
    if (filas.length < 2) return error('El CSV está vacío');
    const norm = s => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const alias = { nombre: 'nombre', empresa: 'nombre', rubro: 'rubro', sector: 'rubro', ciudad: 'ciudad', estado: 'zona', zona: 'zona', web: 'web', sitio: 'web', 'sitio web': 'web', telefono: 'telefono', tel: 'telefono', whatsapp: 'telefono', correo: 'email', email: 'email', instagram: 'instagram', ig: 'instagram', tipo: 'objetivo', objetivo: 'objetivo', notas: 'notas', campana: 'campana' };
    const cab = filas[0].map(h => alias[norm(h)] || null);
    if (!cab.includes('nombre')) return error('El CSV necesita una columna «nombre» o «empresa»');
    const items = filas.slice(1).map(r => {
      const o = { origen: 'csv' };
      cab.forEach((k, i) => { if (k && r[i]?.trim()) o[k] = r[i].trim(); });
      if (o.objetivo && !OBJ[o.objetivo.toLowerCase()]) delete o.objetivo; else if (o.objetivo) o.objetivo = o.objetivo.toLowerCase();
      return o;
    }).filter(o => o.nombre);
    if (!(await confirmar({ titulo: `¿Importar ${items.length} empresas?`, detalle: 'Las que ya tenemos (web, teléfono, Instagram o mismo nombre) se saltan.', textoOk: 'Importar' }))) return;
    let creados = 0, omitidos = 0;
    for (let i = 0; i < items.length; i += 100) {
      const r = await rpc('prospectos_guardar', { p_items: items.slice(i, i + 100) });
      if (!r?.ok) {
        error(`Se cortó en la fila ${i + 2}: ${creados} importados antes del error. Reintenta el mismo archivo: los ya cargados se saltan.`);
        return cargar();
      }
      creados += r.creados?.length || 0; omitidos += r.omitidos?.length || 0;
    }
    ok(`${creados} importados${omitidos ? ` · ${omitidos} saltados` : ''}`);
    await cargar();
  }

  // ------------------------------------------------------------------ eventos
  async function onClick(e) {
    const t = e.target.closest('button,[data-ficha]');
    if (!t) return;
    const a = t.dataset.a;
    if (t.dataset.tab) { S.tab = t.dataset.tab; return pintar(); }
    if (t.dataset.ficha) return abrirFicha(Number(t.dataset.ficha));
    if (t.dataset.busq) { usarBusqueda(S.d.busquedas.find(b => b.id === Number(t.dataset.busq))); S.cands = []; S.avisos = []; return pintar(); }
    if (t.dataset.obj) { leerForm(); S.cfg.objetivo = t.dataset.obj; S.cfg.oferta = S.d.ofertas.find(o => o.objetivo === t.dataset.obj)?.clave || ''; return pintar(); }
    if (t.dataset.zona) { leerForm(); S.cfg.zonas.push(t.dataset.zona); return pintar(); }
    if (t.dataset.quitar) { leerForm(); const [k, i] = t.dataset.quitar.split(':'); S.cfg[k].splice(Number(i), 1); return pintar(); }
    if (t.dataset.abrir) return abrirCanal(t.dataset.abrir, t.dataset.dest);
    if (t.dataset.resp) {
      const canal = F.borrador?.canal || F.prospecto.ultimo_canal || 'whatsapp';
      return conCarga(t, async () => despuesDe(await rpc('prospecto_toque_registrar', { p_id: F.prospecto.id, p_canal: canal, p_resultado: t.dataset.resp }), 'Respuesta registrada: la cadencia se detiene'));
    }
    if (t.dataset.borrarContacto) return conCarga(t, async () => despuesDe(await rpc('prospecto_contacto_guardar', { p_prospecto_id: F.prospecto.id, p_datos: { id: Number(t.dataset.borrarContacto), borrar: true } })));
    if (t.dataset.borrarSenal) return conCarga(t, async () => despuesDe(await rpc('prospecto_senal_guardar', { p_prospecto_id: F.prospecto.id, p_datos: { id: Number(t.dataset.borrarSenal), borrar: true } })));
    switch (a) {
      case 'recargar': S.estado = null; S.resumen = null; return cargar();
      case 'hoy-mios': case 'hoy-todos': S.hoyTodos = a === 'hoy-todos'; S.hoy = await rpc('prospeccion_hoy', { p_todos: S.hoyTodos }) || []; if (!Array.isArray(S.hoy)) S.hoy = []; return pintar();
      case 'busq-nueva': usarBusqueda(null); S.cands = []; S.avisos = []; return pintar();
      case 'buscar': return buscar(t);
      case 'busq-guardar': return guardarBusqueda(false);
      case 'busq-borrar': return guardarBusqueda(true);
      case 'sel-buenos': S.sel = new Set(S.cands.map((x, i) => (x.encaje !== false && !x.existente?.duro && !x.guardado ? i : -1)).filter(i => i >= 0)); return (document.getElementById('pz-res').innerHTML = vistaResultados());
      case 'guardar-sel': return guardarElegidos(t);
      case 'nuevo-manual': return nuevoManual();
      case 'nc-manual': return noContactarManual();
      case 'resumen': S.rDesde = raiz.querySelector('[data-r="desde"]').value; S.rHasta = raiz.querySelector('[data-r="hasta"]').value; S.resumen = null; pintar(); return;
      case 'cerrar': return cerrarFicha();
      case 'guardar-seg': {
        const d = datosForm('seguimiento');
        if (d.etapa === 'en_espera' && F.prospecto.etapa === 'en_espera' && (d.en_espera_hasta || '') === (F.prospecto.en_espera_hasta || '')) delete d.en_espera_hasta;
        if (d.etapa === 'perdido' && d.motivo_perdida === 'mal_momento') {
          return error('«Mal momento» va como «En espera» con fecha: así vuelve solo a «Hoy».');
        }
        return conCarga(t, async () => despuesDe(await rpc('prospecto_actualizar', { p_id: F.prospecto.id, p_datos: d }), 'Guardado'));
      }
      case 'guardar-datos': return conCarga(t, async () => despuesDe(await rpc('prospecto_actualizar', { p_id: F.prospecto.id, p_datos: datosForm('datos') }), 'Datos guardados'));
      case 'add-contacto': {
        const d = datosForm('contacto');
        if (!d.nombre && !d.telefono && !d.email && !d.instagram) return error('Escribe al menos un dato');
        return conCarga(t, async () => despuesDe(await rpc('prospecto_contacto_guardar', { p_prospecto_id: F.prospecto.id, p_datos: d }), 'Contacto agregado'));
      }
      case 'add-senal': {
        const d = datosForm('senal');
        if (!d.afirmacion || !urlOk(d.fuente_url)) return error('Toda señal lleva qué pasó y la URL de la fuente');
        return conCarga(t, async () => despuesDe(await rpc('prospecto_senal_guardar', { p_prospecto_id: F.prospecto.id, p_datos: d }), 'Señal agregada'));
      }
      case 'enriquecer': return conCarga(t, async () => {
        const pid = F.prospecto.id;
        const r = await ef({ accion: 'enriquecer', prospecto_id: pid });
        if (!r?.ok) return err(r);
        if (F?.prospecto?.id !== pid) return ok(`Enriquecido: ${r.nuevos || 0} datos nuevos`);
        await despuesDe({ ok: true }, r.encontrados.length ? `${r.encontrados.length} dato${r.encontrados.length > 1 ? 's' : ''} encontrados, ${r.nuevos} nuevos` : 'No se encontraron datos de contacto en su web');
      });
      case 'redactar': return conCarga(t, async () => {
        const d = datosForm('mensaje'), pid = F.prospecto.id;
        const r = await ef({ accion: 'mensaje', prospecto_id: pid, canal: d.canal, contacto_id: d.contacto_id ? Number(d.contacto_id) : null, oferta: d.oferta || null, instrucciones: d.instrucciones || null });
        if (!r?.ok) return err(r, 'No se pudo redactar');
        if (F?.prospecto?.id !== pid) return;
        F.borrador = { ...r, contacto_id: d.contacto_id }; pintarFicha();
      });
      case 'copiar': try { await navigator.clipboard.writeText(document.getElementById('pz-texto').value); ok('Copiado'); } catch { error('No se pudo copiar'); } return;
      case 'enviado': return conCarga(t, async () => {
        const texto = document.getElementById('pz-texto').value, asunto = document.getElementById('pz-asunto')?.value;
        const r = await rpc('prospecto_toque_registrar', { p_id: F.prospecto.id, p_canal: F.borrador.canal, p_texto: asunto ? `Asunto: ${asunto}\n${texto}` : texto });
        if (r.ok) F.borrador = null;
        if (await despuesDe(r, `Toque registrado. Siguiente: ${r.prospecto?.proxima_accion || ''} (${fCorta(r.prospecto?.proxima_accion_fecha)})`) && r.aviso_ritmo) error(r.aviso_ritmo);
      });
      case 'no-contactar': {
        if (!(await confirmar({ titulo: '¿Pasar a «no contactar»?', detalle: 'Se cierra como perdido y sus datos quedan bloqueados para futuras búsquedas.', textoOk: 'No contactar', destructivo: true }))) return;
        return despuesDe(await rpc('prospecto_no_contactar', { p_id: F.prospecto.id }), 'Listo: no se le vuelve a contactar');
      }
      case 'convertir-empresa': {
        if (!(await confirmar({ titulo: '¿Convertir en empresa?', detalle: 'Se crea la ficha en Empresas y el prospecto pasa a Ganado.', textoOk: 'Convertir' }))) return;
        return despuesDe(await rpc('prospecto_convertir', { p_id: F.prospecto.id, p_tipo: 'empresa' }), 'Creada en Empresas');
      }
      case 'convertir-proveedor': {
        hojaProveedor(); return;
      }
    }
  }

  function hojaProveedor() {
    const id = F.prospecto.id;
    hojaSimple('Convertir en proveedor', `<div class="pz-campo ancho"><span>Qué ofrece</span><div class="pz-checks">${TIPOS_PROV.map(([k, t]) => `<label class="pz-check"><input type="checkbox" name="t_${k}" value="1"> ${t}</label>`).join('')}</div></div>`, async d => {
      const tipos = TIPOS_PROV.map(([k]) => k).filter(k => d['t_' + k]);
      const r = await rpc('prospecto_convertir', { p_id: id, p_tipo: 'proveedor', p_datos: { tipos } });
      if (!r.ok) return err(r);
      ok('Creado en Proveedores'); cerrarFicha(); await cargar(); abrirFicha(id);
    });
  }

  function onChange(e) {
    const t = e.target;
    if (t.dataset.cand !== undefined) { const i = Number(t.dataset.cand); t.checked ? S.sel.add(i) : S.sel.delete(i); const b = raiz.querySelector('.pz-barra span'); if (b) b.textContent = `${S.sel.size} elegido${S.sel.size === 1 ? '' : 's'}`; const g = raiz.querySelector('[data-a="guardar-sel"]'); if (g) g.disabled = !S.sel.size; return; }
    if (t.dataset.fuente) { leerForm(); const f = S.cfg.fuentes; t.checked ? f.includes(t.dataset.fuente) || f.push(t.dataset.fuente) : f.splice(f.indexOf(t.dataset.fuente), 1); return; }
    if (t.dataset.f !== undefined) { S.filtros[t.dataset.f] = t.value; return pintar(); }
    if (t.dataset.csv !== undefined && t.files?.[0]) { importarCsv(t.files[0]); t.value = ''; return; }
    if (t.name === 'etapa' && t.closest('[data-form="seguimiento"]')) {
      const f = t.closest('form');
      f.querySelectorAll('[data-solo]').forEach(x => { x.hidden = x.dataset.solo !== t.value; });
    }
  }

  function onKey(e) {
    const t = e.target;
    if (t.dataset?.tagin && e.key === 'Enter') { e.preventDefault(); leerForm(); pintar(); raiz.querySelector(`[data-tagin="${t.dataset.tagin}"]`)?.focus(); }
    else if (t.dataset?.f === 'q' && e.key === 'Enter') { S.filtros.q = t.value; pintar(); }
  }

  // Tareas recarga seguido (realtime): la cuenta se reusa 3 min o hasta que algo cambie aquí.
  let cuentaHoy = null;
  function contarHoy() {
    if (cuentaHoy && Date.now() - cuentaHoy.t < 180_000) return cuentaHoy.p;
    const p = rpc('prospeccion_hoy', { p_todos: false }).then(h => (Array.isArray(h) ? { total: h.length, vencidos: h.filter(x => x.vencido).length } : null));
    cuentaHoy = { t: Date.now(), p };
    p.then(v => { if (!v && cuentaHoy?.p === p) cuentaHoy = null; }, () => { if (cuentaHoy?.p === p) cuentaHoy = null; });
    return p;
  }

  return { cargar, abrir: abrirFicha, contarHoy };
}
