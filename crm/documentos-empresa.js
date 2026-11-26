// Corporativo › Documentos (2026-11-15): RIF, registro, contratos, pólizas... de la empresa.
// Lista con RPC docemp_listar (admin ve todo; los demás roles solo lo vigente y visible_asesores).
// Subir y firmar descargas pasa por la Edge Function documentos-empresa (bucket privado, sin policies).
// 2026-11-16: visor dentro del CRM (clic en la fila), compartir (enlace 7 días, WhatsApp, correo, archivo).
// Spec: docs/superpowers/specs/2026-11-15-documentos-corporativos-design.md
const CSS = `
.de-filtros{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin:0 0 11px}
.de-buscar{position:relative;flex:1;min-width:200px}
.de-buscar i{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:12px;pointer-events:none}
.de-in{height:44px;padding:0 11px;border:1px solid var(--line2);border-radius:10px;background:var(--panel-solid);color:var(--txt);font:inherit;font-size:13px;transition:border-color .16s,box-shadow .16s}
.de-buscar .de-in{width:100%;padding-left:32px}
.de-in:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.de-cats{display:flex;gap:7px;overflow-x:auto;padding:2px 0 11px;margin:0 0 4px;scrollbar-width:none}
.de-cats::-webkit-scrollbar{display:none}
.de-cat{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--line2);background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:background .16s,color .16s,border-color .16s}
.de-cat:hover{color:var(--txt);border-color:var(--muted2)}
.de-cat.on{background:var(--accent-soft);color:var(--accent-ink);border-color:color-mix(in srgb,var(--accent) 40%,transparent)}
.de-chip{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:0 11px;border-radius:999px;background:var(--accent-soft);color:var(--accent-ink);font-size:11.5px;font-weight:700}
.de-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:4px 8px}
.de-lista{display:flex;flex-direction:column}
.de-fila{--dc:var(--muted);display:flex;align-items:center;gap:13px;padding:11px 9px;border-top:1px solid var(--line);border-radius:12px;cursor:pointer;transition:background .16s}
.de-fila:first-child{border-top-color:transparent}
.de-fila:hover,.de-fila:focus-visible{background:color-mix(in srgb,var(--txt) 5%,transparent)}
.de-fila:hover+.de-fila,.de-fila:focus-visible+.de-fila{border-top-color:transparent}
.de-fila[data-cat=legal]{--dc:var(--blue)}.de-fila[data-cat=fiscal]{--dc:var(--amber)}.de-fila[data-cat=contrato]{--dc:var(--purple)}
.de-fila[data-cat=bancario]{--dc:var(--green)}.de-fila[data-cat=seguro]{--dc:var(--pink)}
.de-ico{flex:0 0 42px;height:42px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--dc) 16%,transparent);color:var(--dc);font-size:16px}
.de-txt{flex:1;min-width:0}
.de-tit{font-size:13.5px;font-weight:700;overflow-wrap:anywhere}
.de-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin-top:3px;font-size:11px;color:var(--muted)}
.de-meta .de-sep{opacity:.5}
.de-badge{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted2)}
.de-vence{display:inline-flex;align-items:center;gap:6px;min-height:26px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;color:var(--muted);background:var(--line)}
.de-vence.pronto{color:var(--amber);background:color-mix(in srgb,var(--amber) 15%,transparent)}
.de-vence.vencido{color:var(--danger);background:color-mix(in srgb,var(--danger) 15%,transparent)}
.de-vence.ok{color:var(--green);background:color-mix(in srgb,var(--green) 13%,transparent)}
.de-acc{display:flex;gap:4px;flex:0 0 auto}
.de-bt{width:44px;height:44px;display:inline-grid;place-items:center;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--muted);font-size:14px;cursor:pointer;transition:background .16s,color .16s,border-color .16s}
.de-bt:hover{background:var(--line);color:var(--txt);border-color:var(--line2)}
.de-bt.pri{color:var(--accent-ink)}
.de-fila.off{opacity:.62}
.de-carp{display:flex;align-items:center;gap:13px;width:100%;padding:11px 9px;border:0;border-top:1px solid var(--line);border-radius:12px;background:transparent;color:var(--txt);font:inherit;text-align:left;cursor:pointer;transition:background .16s}
.de-lista>:first-child{border-top-color:transparent}
.de-carp:hover,.de-carp:focus-visible{background:color-mix(in srgb,var(--txt) 5%,transparent)}
.de-carp .de-ico{--dc:var(--accent);font-size:18px}
.de-carp .de-flecha{flex:0 0 44px;text-align:center;color:var(--muted);transition:transform .2s}
.de-carp[aria-expanded=true] .de-flecha{transform:rotate(90deg)}
.de-hijos{margin:0 0 6px 30px;padding-left:10px;border-left:2px solid var(--line)}
.de-hijos .de-fila:first-child{border-top-color:transparent}
.de-vacio{padding:34px 12px;text-align:center;color:var(--muted);font-size:12.5px;display:flex;flex-direction:column;align-items:center;gap:11px}
.de-vacio>i{font-size:26px;opacity:.5}
.de-esq{height:64px;margin:6px 4px;border-radius:12px;background:linear-gradient(90deg,var(--line),transparent,var(--line));background-size:200% 100%;animation:de-brillo 1.4s linear infinite}
@keyframes de-brillo{to{background-position:-200% 0}}
/* Visor y compartir */
.de-vis{position:fixed;inset:0;z-index:960;display:flex;align-items:center;justify-content:center;padding:max(10px,env(safe-area-inset-top)) 10px max(10px,env(safe-area-inset-bottom));background:rgba(4,6,12,.72);backdrop-filter:blur(4px)}
.de-vis[hidden]{display:none}
.de-caja{--dc:var(--muted);display:flex;flex-direction:column;width:min(1320px,100%);height:100%;max-height:100%;background:var(--bg2);border:1px solid var(--line2);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.45);overflow:hidden}
.de-caja[data-cat=legal]{--dc:var(--blue)}.de-caja[data-cat=fiscal]{--dc:var(--amber)}.de-caja[data-cat=contrato]{--dc:var(--purple)}
.de-caja[data-cat=bancario]{--dc:var(--green)}.de-caja[data-cat=seguro]{--dc:var(--pink)}
.de-cab{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line)}
.de-cab .de-txt{flex:1}
.de-cab .de-tit{font-size:14.5px}
.de-barra{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:9px 14px;border-bottom:1px solid var(--line)}
.de-pill{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line2);background:var(--panel-solid);color:var(--txt);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;transition:background .16s,border-color .16s}
.de-pill:hover{border-color:var(--muted2)}
.de-pill.pri{background:linear-gradient(135deg,var(--accent),var(--accent-deep));color:#fff;border-color:transparent;box-shadow:0 8px 18px rgba(255,145,0,.2)}
.de-pill:disabled{opacity:.5;cursor:default}
.de-info{display:flex;flex-wrap:wrap;gap:6px 14px;margin-left:auto;font-size:11.5px;color:var(--muted)}
.de-info b{color:var(--txt);font-weight:700}
.de-cuerpo{flex:1;min-height:0;position:relative;background:color-mix(in srgb,var(--bg) 70%,#000)}
.de-cuerpo iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}
.de-img{position:absolute;inset:0;overflow:auto;padding:24px;background:repeating-conic-gradient(#7b828c 0 25%,#8f96a0 0 50%) 0 0/24px 24px}
.de-img img{display:block;width:100%;height:100%;object-fit:contain;cursor:zoom-in}
.de-img.zoom img{width:auto;height:auto;max-width:none;margin:auto;cursor:zoom-out}
.de-msg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;color:var(--muted);font-size:13px}
.de-msg>i{font-size:30px;opacity:.55}
.de-pdf{position:absolute;inset:0;overflow:auto;padding:14px 0 70px}
.de-pdf .pg{display:block;margin:0 auto 14px;background:#fff;border-radius:4px;box-shadow:0 6px 24px rgba(0,0,0,.35)}
.de-zoom{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:2px;padding:4px;border-radius:999px;background:var(--panel-solid);border:1px solid var(--line2);box-shadow:0 8px 24px rgba(0,0,0,.35);z-index:2}
.de-zoom button{width:44px;height:44px;border-radius:50%;border:0;background:transparent;color:var(--txt);cursor:pointer;font-size:13px}
.de-zoom button:hover{background:var(--line)}
.de-zoom span{min-width:46px;text-align:center;font-size:12px;font-weight:700;color:var(--muted)}
.de-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:1px solid var(--line2);background:var(--panel-solid);color:var(--txt);cursor:pointer;display:grid;place-items:center;opacity:.9;z-index:2}
.de-nav:hover{border-color:var(--accent)}
.de-nav.ant{left:12px}.de-nav.sig{right:12px}
.de-comp{z-index:970}
.de-comp .de-caja{width:min(420px,100%);height:auto;padding:16px 16px 14px;gap:4px}
.de-comp h3{margin:0;font-size:15px}
.de-comp p{margin:0 0 10px;font-size:12px;color:var(--muted)}
.de-opc{display:flex;align-items:center;gap:13px;width:100%;min-height:56px;padding:8px 10px;margin-top:6px;border-radius:12px;border:1px solid var(--line2);background:var(--panel-solid);color:var(--txt);font:inherit;text-align:left;cursor:pointer;transition:border-color .16s}
.de-opc:hover:not(:disabled){border-color:var(--accent)}
.de-opc:disabled{opacity:.55;cursor:default}
.de-opc>i{flex:0 0 38px;height:38px;border-radius:10px;display:grid;place-items:center;background:var(--line);font-size:15px}
.de-opc b{display:block;font-size:13px}.de-opc small{display:block;font-size:11px;color:var(--muted)}
.de-opc.wa>i{background:rgba(37,211,102,.16);color:#25d366}
@media (max-width:640px){
  .de-fila{flex-wrap:wrap;gap:10px 12px}
  .de-fila .de-vence{order:3}
  .de-acc{order:4;width:100%;justify-content:flex-end;border-top:1px solid var(--line);padding-top:6px;margin-top:2px}
  .de-hijos{margin-left:10px;padding-left:8px}
  .de-vis{padding:0}
  .de-caja{border-radius:0;border:0}
  .de-info{margin-left:0;width:100%}
  .de-nav{display:none}
}
`;
const CATEGORIAS = [
  ['legal', 'Legal', 'fa-scale-balanced'], ['fiscal', 'Fiscal', 'fa-landmark'], ['contrato', 'Contrato', 'fa-file-signature'],
  ['bancario', 'Bancario', 'fa-building-columns'], ['seguro', 'Seguro', 'fa-shield-halved'], ['personal', 'Personal', 'fa-id-card'],
  ['otro', 'Otro', 'fa-file-lines'],
];
const CAT = Object.fromEntries(CATEGORIAS.map(([v, t, i]) => [v, { t, i }]));
const ERRORES = {
  no_autorizado: 'No tiene permiso para esto.', no_existe: 'El documento ya no existe.', duplicado: 'Ese archivo ya está guardado.',
  archivo_muy_grande: 'El archivo pasa de 50 MB.', formato_invalido: 'Solo PDF, JPG, PNG, WebP o HEIC.', archivo_vacio: 'El archivo está vacío.',
  datos_invalidos: 'Revise las fechas.', categoria_invalida: 'Categoría inválida.', hay_otro_vigente: 'Ya hay otro vigente del mismo documento: archive ese primero.',
  no_archivado: 'Solo se restaura un documento archivado.', sin_reemplazo: 'Ese documento no reemplazó a otro.', anterior_no_disponible: 'El anterior ya no está disponible.',
  sin_conexion: 'Sin conexión.', firma_fallida: 'No se pudo generar el acceso al archivo.',
};
const msg = (r, e, base) => ERRORES[r?.error] || r?.aviso || `${base}${e?.message || r?.error ? ': ' + (e?.message || r?.error) : ''}`;

export function crearDocumentosEmpresa({ sb, esc, ok, error, confirmar, rol = 'asesor', raiz, supabaseUrl, supabaseKey }) {
  const admin = rol === 'admin';
  let montado = false, datos = null, pedido = 0, tq = null, subiendo = false;
  let vis = null, visTk = 0, visId = null, compId = null;
  const blobs = new Map(), abiertas = new Set();
  const filtro = { q: '', categoria: '', estado: 'vigente' };
  const $ = sel => raiz.querySelector(sel);
  const fecha = iso => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';
  const hoyIso = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
  const dias = iso => Math.round((Date.parse(iso) - Date.parse(hoyIso())) / 864e5);
  const token = async () => (await sb.auth.getSession()).data.session?.access_token;
  const lista = () => datos?.documentos || [];
  const doc = id => lista().find(d => d.id === id);
  const kb = n => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

  function css() {
    if (document.getElementById('de-css')) return;
    const st = document.createElement('style'); st.id = 'de-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  function marco() {
    raiz.innerHTML = `
      <div class="pvc-cab"><div><h2>Documentos</h2>
        <div class="ria-sub">RIF, registro mercantil, contratos, pólizas y demás papeles de la empresa. ${admin ? 'Al subir uno, Lyra lo clasifica y saca el vencimiento; también se lo puede pedir por Telegram o WhatsApp.' : 'Los que administración comparte con el equipo, para ver, compartir o descargar.'}</div></div>
        ${admin ? `<button class="btn-sm lt-primario" type="button" data-de="subir" style="min-height:44px"><i class="fas fa-upload"></i> Subir documento</button>
          <input type="file" id="de-archivo" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/*" multiple hidden>` : ''}</div>
      <div class="de-filtros">
        <label class="de-buscar"><i class="fas fa-magnifying-glass"></i><input class="de-in" id="de-q" placeholder="Buscar por nombre, número o entidad" aria-label="Buscar documento" autocomplete="off"></label>
        ${admin ? `<select class="de-in" id="de-estado" aria-label="Estado"><option value="vigente">Vigentes</option><option value="archivado">Archivados</option><option value="reemplazado">Reemplazados</option><option value="todos">Todos</option></select>` : ''}
        <span id="de-aviso"></span>
      </div>
      <div class="de-cats" role="group" aria-label="Categoría">${[['', 'Todas'], ...CATEGORIAS.filter(([v]) => admin || v !== 'personal').map(([v, t]) => [v, t])]
        .map(([v, t]) => `<button class="de-cat${v === '' ? ' on' : ''}" type="button" data-de="cat" data-v="${v}" aria-pressed="${v === ''}">${t}</button>`).join('')}</div>
      <div class="de-card"><div class="de-lista" id="de-cuerpo"><div class="de-esq"></div><div class="de-esq"></div><div class="de-esq"></div></div></div>`;
    raiz.addEventListener('click', clic);
    raiz.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.de-fila')) { e.preventDefault(); visor(e.target.dataset.id); }
    });
    $('#de-q').addEventListener('input', e => { clearTimeout(tq); tq = setTimeout(() => { filtro.q = e.target.value.trim(); cargar(); }, 300); });
    $('#de-estado')?.addEventListener('change', e => { filtro.estado = e.target.value; cargar(); });
    $('#de-archivo')?.addEventListener('change', e => { const fs = [...e.target.files]; e.target.value = ''; subir(fs); });
  }

  function clic(e) {
    const b = e.target.closest('[data-de]');
    if (!b) return;
    const a = b.dataset.de, d = doc(b.dataset.id);
    if (a === 'subir') $('#de-archivo').click();
    else if (a === 'cat') {
      filtro.categoria = b.dataset.v;
      raiz.querySelectorAll('.de-cat').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
      cargar();
    }
    else if (a === 'carpeta') { const k = b.dataset.k; abiertas.has(k) ? abiertas.delete(k) : abiertas.add(k); render(); raiz.querySelector(`.de-carp[data-k="${window.CSS.escape(k)}"]`)?.focus(); }
    else if (a === 'ver') visor(b.dataset.id);
    else if (a === 'bajar') abrir(d, true);
    else if (a === 'compartir') compartir(d);
    else if (a === 'editar') editar(d);
    else if (a === 'archivar') archivar(d, true);
    else if (a === 'restaurar') archivar(d, false);
    else if (a === 'deshacer') deshacer(d);
  }

  function estadoVence(d) {
    if (!d.fecha_vencimiento) return null;
    const n = dias(d.fecha_vencimiento);
    const cls = n < 0 ? 'vencido' : n <= 30 ? 'pronto' : 'ok';
    const txt = n < 0 ? `Venció ${fecha(d.fecha_vencimiento)}` : n === 0 ? 'Vence hoy' : n <= 30 ? `Vence en ${n} d` : `Vigente hasta ${fecha(d.fecha_vencimiento)}`;
    const ico = n < 0 ? 'fa-circle-exclamation' : n <= 30 ? 'fa-clock' : 'fa-circle-check';
    return { cls, txt, ico };
  }
  const vence = d => { const v = estadoVence(d); return v ? `<span class="de-vence ${v.cls}"><i class="fas ${v.ico}"></i>${v.txt}</span>` : ''; };

  function meta(d) {
    const c = CAT[d.categoria] || CAT.otro;
    const partes = [c.t, d.tipo, d.entidad, d.numero && `N° ${d.numero}`, d.estado !== 'vigente' && d.estado].filter(Boolean).map(x => esc(x));
    if (admin) partes.push(d.visible_asesores ? '<span class="de-badge"><i class="fas fa-users"></i>Compartido con asesores</span>' : '<span class="de-badge"><i class="fas fa-lock"></i>Solo admin</span>');
    return partes.join('<span class="de-sep">·</span>');
  }

  function fila(d) {
    const c = CAT[d.categoria] || CAT.otro;
    const btn = (acc, ico, t, pri) => `<button class="de-bt${pri ? ' pri' : ''}" type="button" data-de="${acc}" data-id="${d.id}" title="${t}" aria-label="${t}"><i class="fas ${ico}"></i></button>`;
    const acciones = [btn('compartir', 'fa-share-nodes', 'Compartir', true), btn('bajar', 'fa-download', 'Descargar')];
    if (admin) {
      acciones.push(btn('editar', 'fa-pen', 'Editar'));
      if (d.estado === 'vigente' && d.reemplaza_id) acciones.push(btn('deshacer', 'fa-rotate-left', 'Deshacer reemplazo'));
      acciones.push(d.estado === 'archivado' ? btn('restaurar', 'fa-box-open', 'Restaurar') : d.estado === 'vigente' ? btn('archivar', 'fa-box-archive', 'Archivar') : '');
    }
    return `<div class="de-fila${d.estado !== 'vigente' ? ' off' : ''}" data-de="ver" data-id="${d.id}" data-cat="${esc(d.categoria)}" role="button" tabindex="0" aria-label="Ver ${esc(d.titulo)}">
      <div class="de-ico"><i class="fas ${c.i}"></i></div>
      <div class="de-txt"><div class="de-tit">${esc(d.titulo)}</div><div class="de-meta">${meta(d)}</div></div>${vence(d)}<div class="de-acc">${acciones.join('')}</div></div>`;
  }

  // Tres o más documentos del mismo tipo se agrupan en una carpeta plegable.
  function agrupado(docs) {
    const clave = d => (d.tipo || '').trim().toLowerCase();
    const n = new Map();
    docs.forEach(d => clave(d) && n.set(clave(d), (n.get(clave(d)) || 0) + 1));
    const hechas = new Set();
    return docs.map(d => {
      const k = clave(d);
      if (!k || n.get(k) < 3) return fila(d);
      if (hechas.has(k)) return '';
      hechas.add(k);
      const hijos = docs.filter(x => clave(x) === k)
        .sort((a, b) => (a.nombre_archivo || a.titulo).localeCompare(b.nombre_archivo || b.titulo, 'es', { numeric: true }));
      const abierta = abiertas.has(k) || !!filtro.q, t = d.tipo.trim();
      const nombre = /[aeiouáéó]$/i.test(t) ? `${t}s` : `${t}es`;
      return `<button class="de-carp" type="button" data-de="carpeta" data-k="${esc(k)}" aria-expanded="${abierta}">
        <div class="de-ico"><i class="fas ${abierta ? 'fa-folder-open' : 'fa-folder'}"></i></div>
        <div class="de-txt"><div class="de-tit">${esc(nombre)}</div><div class="de-meta">Carpeta<span class="de-sep">·</span>${hijos.length} archivos</div></div>
        <i class="fas fa-chevron-right de-flecha" aria-hidden="true"></i></button>${abierta ? `<div class="de-hijos">${hijos.map(fila).join('')}</div>` : ''}`;
    }).join('');
  }

  function render() {
    const docs = lista(), pv = Number(datos.por_vencer || 0);
    $('#de-aviso').innerHTML = pv ? `<span class="de-chip"><i class="fas fa-clock"></i> ${pv} ${pv === 1 ? 'vence' : 'vencen'} en 30 días o ya ${pv === 1 ? 'venció' : 'vencieron'}</span>` : '';
    const filtrando = filtro.q || filtro.categoria;
    $('#de-cuerpo').innerHTML = docs.length ? agrupado(docs)
      : `<div class="de-vacio"><i class="fas ${filtrando ? 'fa-magnifying-glass' : 'fa-folder-open'}"></i><div>${filtrando ? 'Nada coincide con la búsqueda.' : admin ? 'Todavía no hay documentos.' : 'Todavía no hay documentos compartidos.'}</div>${!filtrando && admin ? '<button class="btn-sm lt-primario" type="button" data-de="subir" style="min-height:44px"><i class="fas fa-upload"></i> Subir el primero</button>' : ''}</div>`;
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
    const r = await funcion({ accion: 'url', id: d.id, descargar });
    if (!r.ok) { error(msg(r, null, 'No se pudo abrir')); return; }
    const a = document.createElement('a'); a.href = r.url; a.rel = 'noopener';
    if (descargar) a.download = r.nombre || ''; else a.target = '_blank';
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- Visor dentro del CRM ---------- */
  const esPdf = d => d.mime === 'application/pdf';
  const esImg = d => /^image\/(jpeg|png|webp)$/.test(d.mime || '');
  const pdfEnPagina = () => navigator.pdfViewerEnabled !== false;

  function armarVisor() {
    if (vis) return vis;
    vis = document.createElement('div'); vis.className = 'de-vis'; vis.hidden = true;
    vis.setAttribute('role', 'dialog'); vis.setAttribute('aria-modal', 'true'); vis.setAttribute('aria-label', 'Vista del documento');
    vis.innerHTML = '<div class="de-caja"></div>';
    vis.addEventListener('click', e => {
      if (e.target === vis) return cerrarVisor();
      const b = e.target.closest('[data-dv]'); if (!b) return;
      const a = b.dataset.dv, d = doc(visId);
      if (a === 'cerrar') cerrarVisor();
      else if (a === 'ant' || a === 'sig') mover(a === 'sig' ? 1 : -1);
      else if (a === 'compartir') compartir(d);
      else if (a === 'bajar') abrir(d, true);
      else if (a === 'pestana') abrir(d, false);
      else if (a === 'editar') { cerrarVisor(); editar(d); }
      else if (a === 'zoom') b.closest('.de-img')?.classList.toggle('zoom');
      else if (a === 'zmas') pdfCtl?.zoom(1.25);
      else if (a === 'zmenos') pdfCtl?.zoom(0.8);
      else if (a === 'zfit') pdfCtl?.zoom(0);
    });
    document.addEventListener('keydown', e => {
      if (vis.hidden || compId) return;
      if (e.key === 'Escape') cerrarVisor();
      else if (e.key === 'ArrowLeft') mover(-1);
      else if (e.key === 'ArrowRight') mover(1);
    });
    document.body.appendChild(vis);
    return vis;
  }

  /* PDF propio (pdf.js): ajustado al ancho del visor y centrado, con zoom; si no carga, queda el visor del navegador. */
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  let pdfLib = null, pdfCtl = null;
  const cargarPdfjs = () => pdfLib ||= new Promise((res, rej) => {
    if (window.pdfjsLib) { res(window.pdfjsLib); return; }
    const s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); };
    s.onerror = () => { pdfLib = null; rej(new Error('pdfjs')); };
    document.head.appendChild(s);
  });

  async function pintarPdf(cuerpo, u, tk) {
    const lib = await cargarPdfjs();
    const pdf = await lib.getDocument({ url: u }).promise;
    if (tk !== visTk) { pdf.destroy(); return; }
    cuerpo.querySelectorAll('.de-msg').forEach(n => n.remove());
    const cont = document.createElement('div'); cont.className = 'de-pdf';
    const zb = document.createElement('div'); zb.className = 'de-zoom';
    zb.innerHTML = '<button type="button" data-dv="zmenos" aria-label="Alejar"><i class="fas fa-minus"></i></button><span data-zv>100%</span><button type="button" data-dv="zmas" aria-label="Acercar"><i class="fas fa-plus"></i></button><button type="button" data-dv="zfit" aria-label="Ajustar al ancho"><i class="fas fa-expand"></i></button>';
    cuerpo.prepend(cont); cuerpo.appendChild(zb);
    const paginas = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const cv = document.createElement('canvas'); cv.className = 'pg'; cont.appendChild(cv);
      paginas.push({ n, cv });
    }
    let z = 1, ren = 0;
    const pintar = async () => {
      const mi = ++ren, dpr = Math.min(window.devicePixelRatio || 1, 2);
      zb.querySelector('[data-zv]').textContent = `${Math.round(z * 100)}%`;
      for (const p of paginas) {
        if (mi !== ren || tk !== visTk) return;
        const pg = await pdf.getPage(p.n), v1 = pg.getViewport({ scale: 1 });
        const esc1 = Math.min(Math.max(Math.min((cont.clientWidth - 28) / v1.width, (cont.clientHeight - 84) / v1.height), 0.2), 2.2) * z, vp = pg.getViewport({ scale: esc1 * dpr });
        p.cv.width = Math.floor(vp.width); p.cv.height = Math.floor(vp.height);
        p.cv.style.width = `${Math.floor(vp.width / dpr)}px`; p.cv.style.height = `${Math.floor(vp.height / dpr)}px`;
        await pg.render({ canvasContext: p.cv.getContext('2d'), viewport: vp }).promise;
      }
    };
    pdfCtl = { zoom: f => { z = f === 0 ? 1 : Math.min(4, Math.max(0.5, z * f)); pintar(); } };
    const reajuste = () => { if (tk === visTk) { clearTimeout(reajuste.t); reajuste.t = setTimeout(pintar, 150); } else removeEventListener('resize', reajuste); };
    addEventListener('resize', reajuste);
    await pintar();
  }

  function mover(p) {
    const l = lista(), i = l.findIndex(d => d.id === visId), n = l[i + p];
    if (n) visor(n.id);
  }

  function liberarBlobs(todo) {
    for (const [id, u] of [...blobs]) if (todo || (id !== visId && blobs.size > 3)) { URL.revokeObjectURL(u.url); blobs.delete(id); }
  }

  function cerrarVisor() {
    if (!vis || vis.hidden) return;
    visTk++; vis.hidden = true; visId = null;
    vis.querySelector('.de-caja').innerHTML = '';
    document.body.style.overflow = '';
    liberarBlobs(true);
  }

  function info(d) {
    const x = [d.numero && ['N°', d.numero], d.fecha_emision && ['Emitido', fecha(d.fecha_emision)], d.fecha_vencimiento && ['Vence', fecha(d.fecha_vencimiento)], d.bytes && ['Tamaño', kb(d.bytes)]].filter(Boolean);
    return x.map(([k, v]) => `<span>${k} <b>${esc(v)}</b></span>`).join('');
  }

  async function visor(id) {
    const d = doc(id); if (!d) return;
    armarVisor();
    const l = lista(), i = l.findIndex(x => x.id === id), tk = ++visTk;
    visId = id; vis.hidden = false; document.body.style.overflow = 'hidden';
    const c = CAT[d.categoria] || CAT.otro;
    const caja = vis.querySelector('.de-caja'); caja.dataset.cat = d.categoria;
    const pill = (a, ico, t, pri) => `<button class="de-pill${pri ? ' pri' : ''}" type="button" data-dv="${a}"><i class="fas ${ico}"></i>${t}</button>`;
    caja.innerHTML = `
      <div class="de-cab"><div class="de-ico"><i class="fas ${c.i}"></i></div>
        <div class="de-txt"><div class="de-tit">${esc(d.titulo)}</div><div class="de-meta">${meta(d)}</div></div>${vence(d)}
        <button class="de-bt" type="button" data-dv="cerrar" title="Cerrar" aria-label="Cerrar"><i class="fas fa-xmark"></i></button></div>
      <div class="de-barra">${pill('compartir', 'fa-share-nodes', 'Compartir', true)}${pill('bajar', 'fa-download', 'Descargar')}${admin ? pill('editar', 'fa-pen', 'Editar') : ''}${pill('pestana', 'fa-arrow-up-right-from-square', 'Nueva pestaña')}
        <div class="de-info">${info(d)}</div></div>
      <div class="de-cuerpo" id="de-vc"><div class="de-msg"><i class="fas fa-spinner fa-spin"></i>Abriendo documento...</div>
        ${i > 0 ? '<button class="de-nav ant" type="button" data-dv="ant" aria-label="Anterior"><i class="fas fa-chevron-left"></i></button>' : ''}
        ${i < l.length - 1 ? '<button class="de-nav sig" type="button" data-dv="sig" aria-label="Siguiente"><i class="fas fa-chevron-right"></i></button>' : ''}</div>`;
    caja.querySelector('[data-dv="cerrar"]').focus({ preventScroll: true });
    const cuerpo = caja.querySelector('#de-vc');
    const mensaje = (ico, txt, extra = '') => cuerpo.insertAdjacentHTML('afterbegin', `<div class="de-msg"><i class="fas ${ico}"></i><div>${txt}</div>${extra}</div>`);
    const limpiar = () => cuerpo.querySelectorAll('.de-msg,iframe,.de-img').forEach(n => n.remove());

    if (!esPdf(d) && !esImg(d)) { limpiar(); mensaje('fa-file-image', 'Este formato no se puede mostrar acá.', '<button class="de-pill pri" type="button" data-dv="bajar"><i class="fas fa-download"></i>Descargar</button>'); return; }

    let u = blobs.get(id)?.url;
    if (!u) {
      const r = await funcion({ accion: 'url', id });
      if (tk !== visTk) return;
      if (!r.ok) { limpiar(); mensaje('fa-triangle-exclamation', esc(msg(r, null, 'No se pudo abrir'))); return; }
      u = r.url;
      try {
        const resp = await fetch(r.url);
        if (!resp.ok) throw new Error(resp.status);
        const b = await resp.blob();
        u = URL.createObjectURL(new Blob([b], { type: d.mime }));
        blobs.set(id, { url: u }); liberarBlobs(false);
      } catch { /* sin CORS o sin red: se muestra directo con la URL firmada */ }
      if (tk !== visTk) return;
    }
    limpiar();
    if (esPdf(d)) {
      try { await pintarPdf(cuerpo, u, tk); }
      catch {
        if (tk !== visTk) return;
        if (pdfEnPagina()) cuerpo.insertAdjacentHTML('afterbegin', `<iframe title="${esc(d.titulo)}" src="${u}${u.startsWith('blob:') ? '#navpanes=0&view=FitH' : ''}"></iframe>`);
        else mensaje('fa-file-pdf', 'Este navegador no muestra PDF dentro de la página.', '<button class="de-pill pri" type="button" data-dv="pestana"><i class="fas fa-arrow-up-right-from-square"></i>Abrir PDF</button>');
      }
    }
    else cuerpo.insertAdjacentHTML('afterbegin', `<div class="de-img"><img src="${u}" alt="${esc(d.titulo)}" data-dv="zoom"></div>`);
  }

  /* ---------- Compartir ---------- */
  function copiar(t) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(t);
    const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select();
    try { document.execCommand('copy'); } finally { a.remove(); }
    return Promise.resolve();
  }

  async function enlace(d, canal) {
    const { data, error: e } = await sb.rpc('docemp_registrar_envio', { p_documento_id: d.id, p_canal: canal, p_destino: null, p_destinatario_nombre: null, p_con_enlace: true });
    if (e || !data?.ok || !data.token) { error(msg(data, e, 'No se pudo crear el enlace')); return null; }
    return { url: `${supabaseUrl}/functions/v1/documento-enlace?t=${data.token}`, envio: data.envio_id };
  }
  const resultado = (envio, okk, err) => envio && sb.rpc('docemp_envio_resultado', { p_envio_id: envio, p_ok: okk, p_error: err || null }).then(() => {}, () => {});

  function puedeCompartirArchivo() {
    try { return !!navigator.canShare?.({ files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] }); } catch { return false; }
  }

  function compartir(d) {
    if (!d) return;
    document.getElementById('de-comp')?.remove();
    compId = d.id;
    const m = document.createElement('div'); m.id = 'de-comp'; m.className = 'de-vis de-comp';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Compartir documento');
    const opc = (a, ico, t, s, cls = '') => `<button class="de-opc ${cls}" type="button" data-dc="${a}"><i class="${ico.startsWith('fab') ? ico : 'fas ' + ico}"></i><span><b>${t}</b><small>${s}</small></span></button>`;
    m.innerHTML = `<div class="de-caja"><div style="display:flex;align-items:center;gap:8px"><h3 style="flex:1">Compartir documento</h3>
        <button class="de-bt" type="button" data-dc="cerrar" aria-label="Cerrar"><i class="fas fa-xmark"></i></button></div>
      <p>«${esc(d.titulo)}». El enlace funciona 7 días, sin pedir clave.</p>
      ${opc('wa', 'fab fa-whatsapp', 'WhatsApp', 'Abre WhatsApp con el enlace listo', 'wa')}
      ${opc('copiar', 'fa-link', 'Copiar enlace', 'Para pegarlo donde quiera')}
      ${opc('correo', 'fa-envelope', 'Correo', 'Abre su correo con el enlace')}
      ${puedeCompartirArchivo() ? opc('archivo', 'fa-paperclip', 'Enviar el archivo', 'Con las apps de este equipo') : ''}</div>`;
    const cerrar = () => { m.remove(); compId = null; };
    m.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); cerrar(); } });
    m.addEventListener('click', async e => {
      if (e.target === m) return cerrar();
      const b = e.target.closest('[data-dc]'); if (!b) return;
      const a = b.dataset.dc;
      if (a === 'cerrar') return cerrar();
      b.disabled = true;
      try {
        if (a === 'archivo') {
          const r = await funcion({ accion: 'url', id: d.id, descargar: true });
          if (!r.ok) { error(msg(r, null, 'No se pudo preparar el archivo')); return; }
          const blob = await (await fetch(r.url)).blob();
          const env = await enlace(d, 'crm');
          try { await navigator.share({ files: [new File([blob], r.nombre || 'documento', { type: d.mime })], title: d.titulo }); resultado(env?.envio, true); cerrar(); }
          catch (er) { if (er?.name !== 'AbortError') error('No se pudo compartir el archivo'); resultado(env?.envio, false, er?.name); }
          return;
        }
        const canal = a === 'wa' ? 'whatsapp' : a === 'correo' ? 'correo' : 'crm';
        const w = a === 'wa' ? window.open('', '_blank') : null;
        const l = await enlace(d, canal);
        if (!l) { w?.close(); return; }
        const texto = `Le comparto «${d.titulo}» de Destino y Eventos Lotus 360: ${l.url} (enlace válido por 7 días)`;
        if (a === 'copiar') { await copiar(l.url); ok('Enlace copiado'); }
        else if (a === 'wa') { const url = `https://wa.me/?text=${encodeURIComponent(texto)}`; if (w) w.location.href = url; else window.open(url, '_blank', 'noopener'); }
        else { const x = document.createElement('a'); x.href = `mailto:?subject=${encodeURIComponent(d.titulo)}&body=${encodeURIComponent(texto)}`; document.body.appendChild(x); x.click(); x.remove(); }
        resultado(l.envio, true); cerrar();
      } finally { b.disabled = false; }
    });
    document.body.appendChild(m);
    m.querySelector('[data-dc]:not([data-dc="cerrar"])')?.focus({ preventScroll: true });
  }

  /* ---------- Subir, editar, archivar ---------- */
  async function subir(archivos) {
    if (!admin || subiendo || !archivos.length) return;
    subiendo = true;
    const b = $('[data-de="subir"]'); b.disabled = true;
    let revisar = null;
    try {
      for (const [i, f] of archivos.entries()) {
        b.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Clasificando${archivos.length > 1 ? ` ${i + 1}/${archivos.length}` : ''}...`;
        if (f.size > 50 * 1024 * 1024) { error(`${f.name}: ${ERRORES.archivo_muy_grande}`); continue; }
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
