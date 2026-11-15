// Corporativo › Documentos (2026-11-15): RIF, registro, contratos, pólizas... de la empresa.
// Lista con RPC docemp_listar (admin ve todo; los demás roles solo lo vigente y visible_asesores).
// Subir y firmar descargas pasa por la Edge Function documentos-empresa (bucket privado, sin policies).
// Spec: docs/superpowers/specs/2026-11-15-documentos-corporativos-design.md
const CSS = `
.de-filtros{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin:0 0 14px}
.de-buscar{position:relative;flex:1;min-width:200px}
.de-buscar i{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:12px}
.de-in{height:40px;padding:0 11px;border:1px solid var(--line2);border-radius:10px;background:var(--panel-solid);color:var(--txt);font:inherit;font-size:13px;transition:border-color .16s,box-shadow .16s}
.de-buscar .de-in{width:100%;padding-left:32px}
.de-in:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.de-chip{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:0 11px;border-radius:999px;background:var(--accent-soft);color:var(--accent-ink);font-size:11.5px;font-weight:700}
.de-lista{display:flex;flex-direction:column}
.de-fila{display:flex;align-items:center;gap:11px;padding:11px 0;border-top:1px solid var(--line)}
.de-fila:first-child{border-top:0}
.de-ico{flex:0 0 36px;height:36px;border-radius:10px;display:grid;place-items:center;background:var(--line);color:var(--muted);font-size:14px}
.de-txt{flex:1;min-width:0}
.de-tit{font-size:13px;font-weight:700;overflow-wrap:anywhere}
.de-txt small{display:block;font-size:11px;color:var(--muted);margin-top:2px;overflow-wrap:anywhere}
.de-vence{font-size:11px;font-weight:700;white-space:nowrap;color:var(--muted)}
.de-vence.pronto{color:var(--amber)}
.de-vence.vencido{color:var(--danger)}
.de-acc{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px}
.de-fila.off{opacity:.6}
.de-vacio{padding:22px 0;text-align:center;color:var(--muted);font-size:12px}
@media (max-width:640px){.de-fila{flex-wrap:wrap}.de-acc{width:100%;justify-content:flex-start;padding-left:47px}}
`;
const CATEGORIAS = [
  ['legal', 'Legal', 'fa-scale-balanced'], ['fiscal', 'Fiscal', 'fa-landmark'], ['contrato', 'Contrato', 'fa-file-signature'],
  ['bancario', 'Bancario', 'fa-building-columns'], ['seguro', 'Seguro', 'fa-shield-halved'], ['personal', 'Personal', 'fa-id-card'],
  ['otro', 'Otro', 'fa-file-lines'],
];
const CAT = Object.fromEntries(CATEGORIAS.map(([v, t, i]) => [v, { t, i }]));
const ERRORES = {
  no_autorizado: 'No tiene permiso para esto.', no_existe: 'El documento ya no existe.', duplicado: 'Ese archivo ya está guardado.',
  archivo_muy_grande: 'El archivo pasa de 20 MB.', formato_invalido: 'Solo PDF, JPG, PNG, WebP o HEIC.', archivo_vacio: 'El archivo está vacío.',
  datos_invalidos: 'Revise las fechas.', categoria_invalida: 'Categoría inválida.', hay_otro_vigente: 'Ya hay otro vigente del mismo documento: archive ese primero.',
  no_archivado: 'Solo se restaura un documento archivado.', sin_reemplazo: 'Ese documento no reemplazó a otro.', anterior_no_disponible: 'El anterior ya no está disponible.',
};
const msg = (r, e, base) => ERRORES[r?.error] || r?.aviso || `${base}${e?.message || r?.error ? ': ' + (e?.message || r?.error) : ''}`;

export function crearDocumentosEmpresa({ sb, esc, ok, error, confirmar, rol = 'asesor', raiz, supabaseUrl, supabaseKey }) {
  const admin = rol === 'admin';
  let montado = false, datos = null, pedido = 0, tq = null, subiendo = false;
  const filtro = { q: '', categoria: '', estado: 'vigente' };
  const $ = sel => raiz.querySelector(sel);
  const fecha = iso => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';
  const hoyIso = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
  const dias = iso => Math.round((Date.parse(iso) - Date.parse(hoyIso())) / 864e5);
  const token = async () => (await sb.auth.getSession()).data.session?.access_token;

  function css() {
    if (document.getElementById('de-css')) return;
    const st = document.createElement('style'); st.id = 'de-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  function marco() {
    raiz.innerHTML = `
      <div class="pvc-cab"><div><h2>Documentos</h2>
        <div class="ria-sub">RIF, registro mercantil, contratos, pólizas y demás papeles de la empresa. ${admin ? 'Al subir uno, Lyra lo clasifica y saca el vencimiento; también se lo puede pedir por Telegram o WhatsApp.' : 'Los que administración comparte con el equipo, para ver o descargar.'}</div></div>
        ${admin ? `<button class="btn-sm lt-primario" type="button" data-de="subir"><i class="fas fa-upload"></i> Subir documento</button>
          <input type="file" id="de-archivo" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/*" multiple hidden>` : ''}</div>
      <div class="de-filtros">
        <label class="de-buscar"><i class="fas fa-magnifying-glass"></i><input class="de-in" id="de-q" placeholder="Buscar por nombre, número o entidad" aria-label="Buscar documento" autocomplete="off"></label>
        <select class="de-in" id="de-cat" aria-label="Categoría"><option value="">Todas las categorías</option>${CATEGORIAS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
        ${admin ? `<select class="de-in" id="de-estado" aria-label="Estado"><option value="vigente">Vigentes</option><option value="archivado">Archivados</option><option value="reemplazado">Reemplazados</option><option value="todos">Todos</option></select>` : ''}
        <span id="de-aviso"></span>
      </div>
      <div class="ria-card"><div class="de-lista" id="de-cuerpo"><div class="de-vacio">Cargando...</div></div></div>`;
    raiz.addEventListener('click', clic);
    $('#de-q').addEventListener('input', e => { clearTimeout(tq); tq = setTimeout(() => { filtro.q = e.target.value.trim(); cargar(); }, 300); });
    $('#de-cat').addEventListener('change', e => { filtro.categoria = e.target.value; cargar(); });
    $('#de-estado')?.addEventListener('change', e => { filtro.estado = e.target.value; cargar(); });
    $('#de-archivo')?.addEventListener('change', e => { const fs = [...e.target.files]; e.target.value = ''; subir(fs); });
  }

  const doc = id => (datos?.documentos || []).find(d => d.id === id);
  function clic(e) {
    const b = e.target.closest('[data-de]');
    if (!b) return;
    const a = b.dataset.de, d = doc(b.dataset.id);
    if (a === 'subir') $('#de-archivo').click();
    else if (a === 'ver' || a === 'bajar') abrir(d, a === 'bajar');
    else if (a === 'editar') editar(d);
    else if (a === 'archivar') archivar(d, true);
    else if (a === 'restaurar') archivar(d, false);
    else if (a === 'deshacer') deshacer(d);
  }

  function vence(d) {
    if (!d.fecha_vencimiento) return '';
    const n = dias(d.fecha_vencimiento);
    const cls = n < 0 ? ' vencido' : n <= 30 ? ' pronto' : '';
    const txt = n < 0 ? `Venció ${fecha(d.fecha_vencimiento)}` : n === 0 ? 'Vence hoy' : `Vence ${fecha(d.fecha_vencimiento)}${n <= 30 ? ` · ${n} d` : ''}`;
    return `<span class="de-vence${cls}">${txt}</span>`;
  }

  function fila(d) {
    const c = CAT[d.categoria] || CAT.otro;
    const sub = [c.t, d.tipo, d.entidad, d.numero && `N° ${d.numero}`, d.estado !== 'vigente' && d.estado,
      admin && !d.visible_asesores && 'solo admin'].filter(Boolean).map(esc).join(' · ');
    const btn = (acc, ico, t) => `<button class="btn-sm" type="button" data-de="${acc}" data-id="${d.id}" title="${t}" aria-label="${t}"><i class="fas ${ico}"></i></button>`;
    const acciones = [btn('ver', 'fa-eye', 'Ver'), btn('bajar', 'fa-download', 'Descargar')];
    if (admin) {
      acciones.push(btn('editar', 'fa-pen', 'Editar'));
      if (d.estado === 'vigente' && d.reemplaza_id) acciones.push(btn('deshacer', 'fa-rotate-left', 'Deshacer reemplazo'));
      acciones.push(d.estado === 'archivado' ? btn('restaurar', 'fa-box-open', 'Restaurar') : d.estado === 'vigente' ? btn('archivar', 'fa-box-archive', 'Archivar') : '');
    }
    return `<div class="de-fila${d.estado !== 'vigente' ? ' off' : ''}"><div class="de-ico"><i class="fas ${c.i}"></i></div>
      <div class="de-txt"><div class="de-tit">${esc(d.titulo)}</div><small>${sub}</small></div>${vence(d)}<div class="de-acc">${acciones.join('')}</div></div>`;
  }

  function render() {
    const docs = datos.documentos || [], pv = Number(datos.por_vencer || 0);
    $('#de-aviso').innerHTML = pv ? `<span class="de-chip"><i class="fas fa-clock"></i> ${pv} ${pv === 1 ? 'vence' : 'vencen'} en 30 días o ya ${pv === 1 ? 'venció' : 'vencieron'}</span>` : '';
    $('#de-cuerpo').innerHTML = docs.length ? docs.map(fila).join('')
      : `<div class="de-vacio">${filtro.q || filtro.categoria ? 'Nada coincide con la búsqueda.' : admin ? 'Todavía no hay documentos. Suba el primero con «Subir documento».' : 'Todavía no hay documentos compartidos.'}</div>`;
  }

  async function cargar() {
    if (!montado) { css(); marco(); montado = true; }
    const n = ++pedido;
    const { data, error: e } = await sb.rpc('docemp_listar', { p_q: filtro.q || null, p_categoria: filtro.categoria || null, p_estado: filtro.estado });
    if (n !== pedido) return;
    if (e || !data) { error('No se pudieron cargar los documentos'); return; }
    datos = data; render();
  }

  async function funcion(body) {
    const t = await token();
    if (!t) return { ok: false, error: 'no_autorizado' };
    const esForm = body instanceof FormData;
    const r = await fetch(`${supabaseUrl}/functions/v1/documentos-empresa`, {
      method: 'POST', body: esForm ? body : JSON.stringify(body), signal: AbortSignal.timeout(esForm ? 120000 : 20000),
      headers: { Authorization: `Bearer ${t}`, apikey: supabaseKey, ...(esForm ? {} : { 'Content-Type': 'application/json' }) },
    }).catch(() => null);
    return r ? await r.json().catch(() => ({ ok: false, error: `http_${r.status}` })) : { ok: false, error: 'sin_conexion' };
  }

  async function abrir(d, descargar) {
    if (!d) return;
    // La ventana se abre en el clic para que el navegador no la bloquee; la URL firmada llega después.
    const w = descargar ? null : window.open('', '_blank');
    const r = await funcion({ accion: 'url', id: d.id, descargar });
    if (!r.ok) { w?.close(); error(msg(r, null, 'No se pudo abrir')); return; }
    if (w) { w.opener = null; w.location.href = r.url; return; }
    const a = document.createElement('a'); a.href = r.url; a.download = r.nombre || ''; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function subir(archivos) {
    if (!admin || subiendo || !archivos.length) return;
    subiendo = true;
    const b = $('[data-de="subir"]'); b.disabled = true;
    let revisar = null;
    try {
      for (const [i, f] of archivos.entries()) {
        b.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Clasificando${archivos.length > 1 ? ` ${i + 1}/${archivos.length}` : ''}...`;
        if (f.size > 20 * 1024 * 1024) { error(`${f.name}: ${ERRORES.archivo_muy_grande}`); continue; }
        const fd = new FormData(); fd.append('archivo', f, f.name);
        const r = await funcion(fd);
        if (!r.ok) { error(`${f.name}: ${msg(r, null, 'No se pudo subir')}`); continue; }
        ok(`Guardado: ${r.documento.titulo}${r.reemplazo ? ` · reemplaza a «${r.reemplazo.titulo}»` : ''}`);
        if (r.aviso) error(r.aviso);
        if (r.revisar) revisar = r.documento;
      }
    } finally {
      subiendo = false; b.disabled = false; b.innerHTML = '<i class="fas fa-upload"></i> Subir documento';
    }
    await cargar();
    if (revisar) editar(doc(revisar.id) || revisar, 'Lyra no está segura de la clasificación: revise los datos.');
  }

  async function editar(d, detalle) {
    if (!admin || !d) return;
    const f = await confirmar({ titulo: 'Editar documento', textoOk: 'Guardar', detalle: detalle || 'Cambiar el vencimiento reinicia los avisos por Telegram.', campos: [
      { id: 'titulo', label: 'Título', valor: d.titulo || '', requerido: true },
      { id: 'categoria', label: 'Categoría', tipo: 'select', opciones: CATEGORIAS.map(([v, t]) => ({ v, t })), valor: d.categoria || 'otro', requerido: true },
      { id: 'tipo', label: 'Tipo', placeholder: 'Ej: RIF, Registro mercantil, Póliza', valor: d.tipo || '' },
      { id: 'entidad', label: 'Entidad que lo emite', placeholder: 'Ej: SENIAT, Banesco', valor: d.entidad || '' },
      { id: 'numero', label: 'Número', valor: d.numero || '' },
      { id: 'emision', label: 'Fecha de emisión', tipo: 'date', valor: d.fecha_emision || '' },
      { id: 'vence', label: 'Fecha de vencimiento', tipo: 'date', valor: d.fecha_vencimiento || '' },
      { id: 'visible', label: 'Visible para asesores (los personales nunca lo son)', tipo: 'check', valor: !!d.visible_asesores },
    ] });
    if (!f) return;
    const { data, error: e } = await sb.rpc('docemp_editar', { p_id: d.id, p: {
      titulo: f.titulo, categoria: f.categoria, tipo: f.tipo || '', entidad: f.entidad || '', numero: f.numero || '',
      fecha_emision: f.emision || '', fecha_vencimiento: f.vence || '', visible_asesores: !!f.visible,
    } });
    if (e || !data?.ok) { error(msg(data, e, 'No se pudo guardar')); return; }
    ok('Documento actualizado'); cargar();
  }

  async function archivar(d, si) {
    if (!admin || !d) return;
    if (si && !await confirmar({ titulo: 'Archivar documento', textoOk: 'Archivar', detalle: `«${d.titulo}» deja de aparecer para los asesores y para Lyra. Se puede restaurar desde «Archivados».` })) return;
    const { data, error: e } = await sb.rpc('docemp_archivar', { p_id: d.id, p_archivar: si });
    if (e || !data?.ok) { error(msg(data, e, si ? 'No se pudo archivar' : 'No se pudo restaurar')); return; }
    ok(si ? 'Documento archivado' : 'Documento restaurado'); cargar();
  }

  async function deshacer(d) {
    if (!admin || !d) return;
    if (!await confirmar({ titulo: 'Deshacer reemplazo', textoOk: 'Deshacer', detalle: `«${d.titulo}» se archiva y el documento anterior vuelve a estar vigente.` })) return;
    const { data, error: e } = await sb.rpc('docemp_deshacer_reemplazo', { p_id: d.id });
    if (e || !data?.ok) { error(msg(data, e, 'No se pudo deshacer')); return; }
    ok('Reemplazo deshecho: volvió el anterior'); cargar();
  }

  return { cargar };
}
