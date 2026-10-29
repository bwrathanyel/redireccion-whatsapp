// Campañas de plantillas por WhatsApp (Plan 5 v2 F3). Dos orígenes:
//  - 'leads' (bandeja de WhatsApp, solo admin): leads por el número VE de Meta Cloud. Modal (abrir).
//  - 'reservas' (pestaña Reservas › Campañas WhatsApp, solo admin): clientes de postventa_casos por
//    Zernio, solo plantillas MARKETING. Va embebida en la pestaña (montar) con asistente de 4 pasos.
// Crear una campaña NO envía nada: queda en borrador con la lista congelada; solo «Aprobar y enviar»
// (con el costo a la vista) la pone en marcha. CSS propio mínimo (prefijo wc-).
const CANALES = ['Instagram', 'Facebook', 'Ambos', 'WhatsApp', 'Página Web'];
const MOTIVOS = {
  prueba: 'Contactos de prueba',
  baja: 'Pidieron no recibir mensajes',
  compra: 'Ya compraron o pagaron',
  numero_equivocado_o_no_interesa: 'Número equivocado o no les interesa',
  en_cola_de_asesor: 'Tienen una tarea abierta con un asesor',
  contactado_hace_menos_de_7_dias: 'Contactados hace menos de 7 días',
  fuera_de_segmento: 'Fuera del filtro (antigüedad o canal)',
  telefono: 'Sin teléfono válido',
  no_contactar: 'Marcados «no contactar»',
  enviado_hoy: 'Ya recibieron otra plantilla hoy',
  marketing_14d: 'Recibieron una promoción hace menos de 14 días',
  en_otra_campana: 'Ya están en otra campaña en curso',
};
const ESTADOS = { borrador: 'Borrador', enviando: 'Enviando', pausada: 'Pausada', terminada: 'Terminada', cancelada: 'Cancelada' };
const ESTADO_COLOR = { borrador: 'var(--muted)', enviando: 'var(--blue)', pausada: 'var(--amber)', terminada: 'var(--green)', cancelada: 'var(--danger)' };
const PASOS = ['Plantilla', 'Audiencia', 'Vista previa', 'Crear'];
const CSS = `
.wc-fondo{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px}
.wc-caja{background:var(--bg2);color:var(--txt);border:1px solid var(--line);border-radius:14px;width:min(720px,100%);padding:16px;display:flex;flex-direction:column;gap:12px}
.wc-cab{display:flex;align-items:center;gap:8px}.wc-cab h3{margin:0;flex:1;font-size:16px}
.wc-tabs{display:flex;gap:6px}.wc-tabs button.on{background:var(--wa);color:#fff}
.wc-campo{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--muted)}
.wc-campo input,.wc-campo select{padding:9px 11px;border-radius:10px;border:1px solid var(--line2);background:var(--bg);color:var(--txt);font:inherit}
.wc-campo input:focus,.wc-campo select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.wc-fila{display:flex;gap:10px;flex-wrap:wrap}.wc-fila>*{flex:1;min-width:140px}
.wc-chips{display:flex;gap:8px;flex-wrap:wrap}.wc-chips label{display:flex;gap:5px;align-items:center;font-size:13px;color:var(--txt)}
.wc-chips small{color:var(--muted)}
.wc-res{border:1px solid var(--line);border-radius:10px;padding:10px;font-size:13px;display:flex;flex-direction:column;gap:4px}
.wc-camp{border:1px solid var(--line);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px}
.wc-camp-top{display:flex;gap:8px;align-items:center}.wc-camp-top b{flex:1}
.wc-num{display:flex;gap:12px;flex-wrap:wrap;font-size:12.5px;color:var(--muted)}.wc-num b{color:var(--txt)}
.wc-acc{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.wc-pl{font-size:12.5px;color:var(--muted);white-space:pre-wrap}
.wc-barra{height:6px;border-radius:99px;background:var(--line);overflow:hidden}.wc-barra i{display:block;height:100%;background:var(--wa);transition:width .4s}
.wc-nota{font-size:12px;color:var(--muted)}
.wc-emb{display:flex;flex-direction:column;gap:11px}
.wc-emb .wc-camp{border-radius:12px;padding:14px;gap:9px}
.wc-emb .wc-camp-top b{font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wc-camp-top small{font-size:11px;color:var(--muted2);white-space:nowrap}
.wc-emb .wc-num{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}
.wc-emb .wc-num span{display:flex;flex-direction:column;gap:2px;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted2)}
.wc-emb .wc-num span b{font-size:15px;font-weight:800;letter-spacing:-.02em;text-transform:none;font-variant-numeric:tabular-nums}
.wc-pasos{display:flex;gap:7px;list-style:none;margin:0;padding:0;overflow-x:auto}
.wc-pasos li{display:flex;align-items:center;gap:7px;flex:1;min-width:max-content;font-size:11px;font-weight:700;color:var(--muted2);padding:7px 11px;border:1px solid var(--line);border-radius:10px;transition:border-color .16s,color .16s}
.wc-pasos li span{display:grid;place-items:center;width:22px;height:22px;border-radius:999px;border:1px solid var(--line2);font-size:11px;font-variant-numeric:tabular-nums}
.wc-pasos li.on{color:var(--txt);border-color:var(--accent)}.wc-pasos li.on span{background:var(--accent-soft);border-color:var(--accent);color:var(--accent)}
.wc-pasos li.hecho{color:var(--muted)}.wc-pasos li.hecho span{border-color:var(--green);color:var(--green)}
.wc-paso{display:flex;flex-direction:column;gap:11px}.wc-paso[hidden]{display:none}
.wc-nav{display:flex;align-items:center;gap:9px;border-top:1px solid var(--line);padding-top:11px}.wc-nav [data-wc-ir="1"]{margin-left:auto}.wc-nav [hidden]{display:none}
.wc-falta{font-size:12px;color:var(--amber)}
.wc-vivo{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;transition:opacity .16s}.wc-vivo.cargando{opacity:.55}
.wc-vivo div{border:1px solid var(--line);border-radius:10px;padding:9px 11px}.wc-vivo b{display:block;font-size:18px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--txt)}.wc-vivo span{font-size:11px;color:var(--muted)}
.wc-vivo div:first-child{border-color:var(--green)}.wc-vivo div:first-child b{color:var(--green)}
.wc-burbuja{align-self:flex-start;max-width:min(440px,100%);background:color-mix(in srgb,var(--wa) 12%,transparent);border:1px solid color-mix(in srgb,var(--wa) 28%,transparent);border-radius:14px 14px 14px 4px;padding:11px 14px;font-size:13px;line-height:1.45;white-space:pre-wrap;color:var(--txt)}
.wc-burbuja:empty{display:none}
.wc-etq{font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted2)}
.wc-resumen{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:7px 14px;margin:0;font-size:12.5px}.wc-resumen dt{color:var(--muted)}.wc-resumen dd{margin:0;color:var(--txt);font-weight:700;min-width:0;overflow-wrap:anywhere}
.wc-det-fila{display:grid;grid-template-columns:minmax(0,1.2fr) 112px 72px minmax(0,1.6fr);gap:9px;align-items:center;font-size:12px;padding:7px 9px;border-bottom:1px solid var(--line)}.wc-det-fila:last-child{border-bottom:0}
.wc-det-fila b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--txt)}.wc-det-fila .num{font-variant-numeric:tabular-nums;color:var(--muted)}.wc-det-fila small{color:var(--muted)}
@media(max-width:700px){.wc-emb .wc-num{grid-template-columns:repeat(3,minmax(0,1fr))}.wc-vivo{grid-template-columns:repeat(2,minmax(0,1fr))}.wc-pasos li{flex:0 0 auto}
  .wc-det-fila{grid-template-columns:minmax(0,1fr) auto}.wc-det-fila .num{display:none}.wc-det-fila small{grid-column:1/-1}}
`;

export function crearCampanasWa({ sb, esc, ok, error, origen = 'leads', rol = 'admin', etapaTxt = k => k }) {
  const reservas = origen === 'reservas';
  let fondo = null;
  let raiz = null;
  let alCambiar = null;
  let cuentas = [];
  let asesores = [];
  let plantillas = [];
  let opciones = null;
  let vista = 'lista';
  let timer = null;
  let paso = 1, previa = null, tCuenta = null, nPedido = 0, iMuestra = 0;
  const caja = () => raiz || fondo?.querySelector('.wc-caja') || null;
  const $ = id => caja()?.querySelector('#' + id) || null;
  const qa = sel => [...(caja()?.querySelectorAll(sel) || [])];
  const usd = n => '$' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const enDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  const fechaCorta = f => f ? new Date(f).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const marcados = attr => qa(`[${attr}]:checked`).map(x => x.getAttribute(attr) === '' ? x.value : x.getAttribute(attr));

  function css() {
    if (document.getElementById('wc-css')) return;
    const st = document.createElement('style'); st.id = 'wc-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  async function cargarBase() {
    const [c, a] = await Promise.all([
      sb.from('whatsapp_cuentas').select('phone_number_id,etiqueta,numero,activo').eq('activo', true).neq('phone_number_id', '__gate_pnid'),
      sb.from('usuarios').select('nombre').eq('rol', 'asesor').is('desactivado_at', null).not('nombre', 'ilike', '\\_\\_gate%').not('nombre', 'ilike', 'invitado%').order('nombre'),
    ]);
    cuentas = c.data || [];
    asesores = (a.data || []).map(x => x.nombre);
  }

  function marco(html) {
    if (raiz) {
      const lista = vista === 'lista';
      raiz.innerHTML = `
        <div class="pvc-cab"><div><h2>${lista ? 'Campañas' : 'Nueva campaña'}</h2>
          <div class="ria-sub">${lista ? 'Crear una campaña no envía nada: queda en borrador hasta que la apruebes acá.' : 'Al final queda un borrador. Nada sale hasta aprobarlo en la lista de campañas.'}</div></div>
          ${lista ? '<button class="btn-sm lt-primario" type="button" data-wc-vista="nueva"><i class="fas fa-plus"></i> Nueva campaña</button>'
                  : '<button class="btn-sm" type="button" data-wc-vista="lista"><i class="fas fa-arrow-left"></i> Volver a campañas</button>'}</div>
        <div class="wc-emb">${html}</div>`;
      return;
    }
    fondo.querySelector('.wc-caja').innerHTML = `
      <div class="wc-cab"><h3><i class="fa-brands fa-whatsapp"></i> ${reservas ? 'Campañas a clientes de reservas' : 'Campañas de WhatsApp'}</h3>
        <div class="wc-tabs"><button class="btn-sm${vista === 'lista' ? ' on' : ''}" data-wc-vista="lista">Campañas</button>
        <button class="btn-sm${vista === 'nueva' ? ' on' : ''}" data-wc-vista="nueva">Nueva</button></div>
        <button class="btn-sm" data-wc-cerrar title="Cerrar"><i class="fas fa-xmark"></i></button></div>${html}`;
  }

  function filtrosTxt(s) {
    if (!s || s.origen !== 'reservas') return '';
    const p = [];
    if (s.desde || s.hasta) p.push(`viaje ${s.desde || '…'} → ${s.hasta || '…'}`);
    if (s.etapas?.length) p.push(s.etapas.map(etapaTxt).join(', '));
    if (s.asesores?.length) p.push('asesor ' + s.asesores.join(', '));
    if (s.destinos?.length) p.push(`${s.destinos.length} destino(s)`);
    if (s.telefono) p.push('solo ' + s.telefono);
    return p.length ? ' · ' + p.join(' · ') : '';
  }

  function tarjeta(c) {
    const hechos = c.total - c.pendientes, pct = c.total ? Math.round(hechos * 100 / c.total) : 0;
    const admin = rol === 'admin';
    const num = reservas
      ? `<span>Destinatarios <b>${c.total}</b></span><span>Enviados <b>${c.enviados}</b></span><span>Fallidos <b>${c.fallidos}</b></span>
         <span>Omitidos <b>${c.omitidos}</b></span><span>Pendientes <b>${c.pendientes}</b></span><span>Costo est. <b>${usd(c.costo_estimado_usd)}</b></span>`
      : `<span>Pendientes <b>${c.pendientes}</b></span><span>Enviados <b>${c.enviados}</b></span><span>Entregados <b>${c.entregados}</b></span>
         <span>Leídos <b>${c.leidos}</b></span><span>Respondieron <b>${c.respondieron}</b></span><span>Bajas <b>${c.bajas}</b></span>
         <span>Fallidos <b>${c.fallidos}</b></span><span>Cotizaciones <b>${c.cotizaciones}</b></span><span>Pagos <b>${c.pagos}</b></span>
         <span>Costo est. <b>${usd(c.costo_estimado_usd)}</b></span>`;
    const estado = reservas
      ? `<span class="pv-wa-tag" style="--tc:${ESTADO_COLOR[c.estado] || 'var(--muted)'}">${ESTADOS[c.estado] || esc(c.estado)}</span>`
      : `<span class="bt-tag">${ESTADOS[c.estado] || c.estado}</span>`;
    const malos = (c.fallidos || 0) + (c.omitidos || 0);
    return `
      <div class="wc-camp" data-wc-id="${c.id}">
        <div class="wc-camp-top"><b title="${esc(c.nombre)}">${esc(c.nombre)}</b>${reservas ? `<small>${fechaCorta(c.creada_at)}</small>` : ''}${estado}</div>
        <div class="wc-pl">Plantilla ${esc(c.plantilla)} · ${c.total} contactos${esc(filtrosTxt(c.segmento))}</div>
        ${['enviando', 'pausada', 'terminada'].includes(c.estado) ? `<div class="wc-barra" title="${hechos} de ${c.total}"><i style="width:${pct}%"></i></div>` : ''}
        <div class="wc-num">${num}</div>
        <div class="wc-acc">
          ${c.estado === 'borrador' && admin ? `<button class="btn-sm lt-primario" data-wc-acc="enviando" data-n="${c.pendientes}" data-tarifa="${c.tarifa_usd ?? 0.074}">Aprobar y enviar</button>` : ''}
          ${c.estado === 'borrador' && !admin ? '<span class="wc-nota">Espera la aprobación de un administrador</span>' : ''}
          ${c.estado === 'enviando' ? '<button class="btn-sm" data-wc-acc="pausada">Pausar</button>' : ''}
          ${c.estado === 'pausada' && admin ? '<button class="btn-sm lt-primario" data-wc-acc="enviando" data-n="0">Reanudar</button>' : ''}
          ${['borrador', 'enviando', 'pausada'].includes(c.estado) ? '<button class="btn-sm" data-wc-acc="cancelada">Cancelar</button>' : ''}
          ${c.estado === 'enviando' ? '<span class="wc-nota">Sale por tandas, unos 30 por minuto</span>' : ''}
        </div>
        ${reservas && malos ? `<details class="pv-wa-grupo" data-wc-det="${c.id}" style="--tc:var(--amber)"><summary><i class="fas fa-chevron-right flecha"></i><i class="fas fa-circle-info"></i>Por qué fallaron u omitieron<small>${malos} ${malos === 1 ? 'cliente' : 'clientes'}</small></summary>
          <div class="pv-wa-cuerpo" data-wc-det-cuerpo><div class="wc-nota">Cargando…</div></div></details>` : ''}
      </div>`;
  }

  async function cargarDetalle(det) {
    if (det.dataset.cargado) return;
    det.dataset.cargado = '1';
    const cuerpo = det.querySelector('[data-wc-det-cuerpo]');
    const { data, error: e } = await sb.from('wa_campana_envios').select('nombre,telefono,telefono10,estado,error')
      .eq('campana_id', Number(det.dataset.wcDet)).in('estado', ['fallido', 'omitido']).order('estado').limit(300);
    if (e) { cuerpo.innerHTML = '<div class="wc-nota">No se pudo cargar el detalle</div>'; delete det.dataset.cargado; return; }
    cuerpo.innerHTML = (data || []).map(r => `<div class="wc-det-fila"><b title="${esc(r.nombre || '')}">${esc(r.nombre || 'Sin nombre')}</b>
      <span class="num">${esc(r.telefono || r.telefono10 || '')}</span>
      <span style="color:${r.estado === 'fallido' ? 'var(--danger)' : 'var(--amber)'}">${r.estado === 'fallido' ? 'Falló' : 'Omitido'}</span>
      <small>${esc(MOTIVOS[r.error] || r.error || 'Sin motivo registrado')}</small></div>`).join('') || '<div class="wc-nota">Sin registros</div>';
  }

  async function pintarLista(silencioso = false) {
    clearTimeout(timer);
    vista = 'lista';
    if (!silencioso) marco('<div class="msg-empty"><i class="fas fa-spinner fa-spin"></i></div>');
    const { data, error: e } = await sb.rpc('wa_campana_panel');
    if (!caja() || vista !== 'lista') return;
    if (e) { marco(`<div class="msg-empty">No se pudo cargar: ${esc(e.message)}</div>`); return; }
    const lista = (data || []).filter(c => (c.canal === 'zernio') === reservas);
    const abiertos = qa('[data-wc-det][open]').map(d => d.dataset.wcDet);
    marco(lista.map(tarjeta).join('') || `<div class="msg-empty">Todavía no hay campañas${raiz ? '. Arma la primera con «Nueva campaña».' : ''}</div>`);
    abiertos.forEach(id => { const d = caja().querySelector(`[data-wc-det="${id}"]`); if (d) { d.open = true; cargarDetalle(d); } });
    if (lista.some(c => c.estado === 'enviando')) timer = setTimeout(() => { if (!raiz || raiz.offsetParent) pintarLista(true); }, 15000);
  }

  async function cambiarEstado(id, estado, total, tarifa) {
    if (estado === 'enviando' && Number(total) > 0) {
      if (!confirm(`Se enviará la plantilla a ${total} contactos reales (costo aprox. ${usd(total * Number(tarifa || 0.074))}), hasta el tope diario. ¿Aprobar y enviar?`)) return;
    }
    if (estado === 'cancelada' && !confirm('¿Cancelar la campaña? Los envíos pendientes no saldrán.')) return;
    const { data, error: e } = await sb.rpc('wa_campana_estado', { p_id: id, p_estado: estado });
    if (e || !data?.ok) { error(data?.error === 'solo_admin' ? 'Solo un administrador puede aprobar el envío' : e?.message || 'No se pudo cambiar el estado'); return; }
    ok('Campaña ' + (ESTADOS[estado] || estado).toLowerCase());
    pintarLista();
    alCambiar?.();
  }

  const camposPlantilla = `
      <label class="wc-campo">Nombre de la campaña<input id="wc-nombre" maxlength="80" placeholder="${reservas ? 'Recompra · clientes de Mérida' : 'Ola 0 · preventa fin de año'}"></label>
      <div class="wc-fila">
        ${reservas ? '' : '<label class="wc-campo">Número<select id="wc-cuenta"></select></label>'}
        <label class="wc-campo">Plantilla aprobada<select id="wc-plantilla"><option value="">Cargando…</option></select></label>
      </div>
      <div class="${reservas ? 'wc-burbuja' : 'wc-pl'}" id="wc-pl-cuerpo"></div>
      <div id="wc-vars" class="wc-fila"></div>`;

  async function pintarNueva() {
    clearTimeout(timer);
    vista = 'nueva';
    marco('<div class="msg-empty"><i class="fas fa-spinner fa-spin"></i></div>');
    if (reservas) return pintarNuevaReservas();
    await cargarBase();
    if (!cuentas.length) { marco('<div class="msg-empty">No hay un número de WhatsApp conectado todavía</div>'); return; }
    marco(`${camposPlantilla}
      <div class="wc-fila">
        <label class="wc-campo">Leads de los últimos (días)<input id="wc-dias" type="number" min="1" max="1500" value="90"></label>
        <label class="wc-campo">Máximo de contactos<input id="wc-limite" type="number" min="1" max="5000" value="500"></label>
      </div>
      <div class="wc-campo">Canales<div class="wc-chips">${CANALES.map(c => `<label><input type="checkbox" data-wc-canal="${esc(c)}"${c === 'WhatsApp' || c === 'Ambos' ? ' checked' : ''}> ${esc(c)}</label>`).join('')}</div></div>
      <div class="wc-campo">Asesores que atienden las respuestas (rotación)<div class="wc-chips">${asesores.map(a => `<label><input type="checkbox" data-wc-asesor="${esc(a)}"> ${esc(a)}</label>`).join('')}</div></div>
      <div class="wc-acc"><button class="btn-sm" id="wc-calcular">Calcular alcance y costo</button></div>
      <div id="wc-resultado"></div>`);
    $('wc-cuenta').innerHTML = cuentas.map(c => `<option value="${esc(c.phone_number_id)}">${esc(c.etiqueta || c.numero || c.phone_number_id)}</option>`).join('');
    cargarPlantillas();
  }

  async function pintarNuevaReservas() {
    const { data, error: e } = await sb.rpc('wa_campana_preview', { p_segmento: { origen: 'reservas', limite: 1 } });
    if (!caja() || vista !== 'nueva') return;
    if (e) { marco(`<div class="msg-empty">No se pudo cargar: ${esc(e.message)}</div>`); return; }
    opciones = data.opciones || { destinos: [], etapas: [], asesores: [] };
    paso = 1; previa = null; iMuestra = 0;
    const chips = (attr, items, val, txt) => `<div class="wc-chips">${items.map(x => `<label><input type="checkbox" ${attr} value="${esc(String(val(x)))}"> ${esc(txt(x))} <small>${x.n}</small></label>`).join('') || '<span class="wc-nota">Sin datos</span>'}</div>`;
    marco(`<ol class="wc-pasos">${PASOS.map((t, i) => `<li data-wc-paso-ind="${i + 1}"><span>${i + 1}</span>${t}</li>`).join('')}</ol>
      <section class="wc-paso" data-wc-paso="1">${camposPlantilla}
        <div class="wc-nota">{{1}} es siempre el primer nombre de cada cliente. Las demás variables aceptan {{destino}} (destino de su viaje).</div></section>
      <section class="wc-paso" data-wc-paso="2" hidden>
        <div class="wc-vivo" id="wc-vivo"></div>
        <div class="wc-campo">Fecha de viaje
          <div class="wc-acc"><button class="btn-sm" type="button" data-wc-rango="viajaron">Ya viajaron (últimos 120 días)</button>
            <button class="btn-sm" type="button" data-wc-rango="pronto">Viajan en los próximos 30 días</button>
            <button class="btn-sm" type="button" data-wc-rango="todas">Cualquier fecha</button></div></div>
        <div class="wc-fila">
          <label class="wc-campo">Desde<input id="wc-desde" type="date"></label>
          <label class="wc-campo">Hasta<input id="wc-hasta" type="date"></label>
          <label class="wc-campo">Máximo de contactos<input id="wc-limite" type="number" min="1" max="5000" value="500"></label>
        </div>
        <div class="wc-campo">Etapa de la reserva${chips('data-wc-etapa', opciones.etapas, x => x.etapa, x => etapaTxt(x.etapa))}</div>
        <div class="wc-campo">Asesor responsable${chips('data-wc-asesor', opciones.asesores, x => x.nombre, x => x.nombre)}</div>
        <div class="wc-campo">Destino${chips('data-wc-destino', opciones.destinos, x => x.id, x => x.nombre)}</div>
        <div class="wc-nota">Sin marcar nada en un filtro = todos. Siempre se excluyen bajas, «no contactar», teléfonos inválidos y quien recibió una promoción en los últimos 14 días.</div>
      </section>
      <section class="wc-paso" data-wc-paso="3" hidden><div id="wc-resultado"></div></section>
      <section class="wc-paso" data-wc-paso="4" hidden><div id="wc-resumen"></div></section>
      <div class="wc-nav"><button class="btn-sm" type="button" data-wc-ir="-1"><i class="fas fa-arrow-left"></i> Atrás</button>
        <span class="wc-falta" id="wc-falta" role="status"></span>
        <button class="btn-sm lt-primario" type="button" data-wc-ir="1">Siguiente <i class="fas fa-arrow-right"></i></button></div>`);
    irPaso(1);
    cargarPlantillas();
  }

  function faltaPaso(n) {
    if (n === 1) {
      if (!$('wc-nombre').value.trim()) return 'Ponle un nombre a la campaña';
      if (!plantillaElegida()) return 'Elige una plantilla';
      if (qa('[data-wc-var]').some(el => !el.value.trim())) return 'Completa todas las variables';
    }
    if (n === 2 && !previa) return 'Calculando el alcance…';
    if (n === 2 && !previa.a_enviar) return 'Con estos filtros no queda nadie para enviar';
    return '';
  }

  function irPaso(n) {
    if (n > paso) { const f = faltaPaso(paso); if (f) { $('wc-falta').textContent = f; return; } }
    paso = Math.min(Math.max(n, 1), PASOS.length);
    $('wc-falta').textContent = '';
    qa('[data-wc-paso]').forEach(s => { s.hidden = Number(s.dataset.wcPaso) !== paso; });
    qa('[data-wc-paso-ind]').forEach(li => {
      const k = Number(li.dataset.wcPasoInd);
      li.classList.toggle('on', k === paso); li.classList.toggle('hecho', k < paso);
      if (k === paso) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    caja().querySelector('[data-wc-ir="-1"]').hidden = paso === 1;
    caja().querySelector('[data-wc-ir="1"]').hidden = paso === PASOS.length;
    if (paso === 2 && !previa) contar();
    if (paso === 3) pintarPrevia();
    if (paso === 4) pintarResumen();
  }

  function recontar() {
    previa = null;
    clearTimeout(tCuenta);
    tCuenta = setTimeout(contar, 400);
  }

  async function contar() {
    const el = $('wc-vivo');
    if (!el) return;
    const pedido = ++nPedido;
    el.classList.add('cargando');
    if (!el.children.length) el.innerHTML = '<div><b>…</b><span>se enviarían</span></div>';
    const { data, error: e } = await sb.rpc('wa_campana_preview', { p_segmento: segmento() });
    if (pedido !== nPedido || !$('wc-vivo')) return;
    el.classList.remove('cargando');
    if (e) { previa = null; el.innerHTML = `<div><span>No se pudo contar: ${esc(e.message)}</span></div>`; return; }
    previa = data; iMuestra = 0;
    el.innerHTML = `<div><b>${data.a_enviar}</b><span>se enviarían</span></div><div><b>${data.elegibles}</b><span>elegibles</span></div>
      <div><b>${data.en_segmento}</b><span>dentro del filtro</span></div><div><b>${usd(data.costo_usd)}</b><span>costo aprox.</span></div>`;
    if ($('wc-falta')?.textContent) $('wc-falta').textContent = faltaPaso(2);
  }

  function armarMensaje(p, vars, m) {
    const primer = (m?.nombre || 'Cliente').trim().split(/\s+/)[0];
    const sust = v => v.replace(/\{\{nombre\}\}/g, primer).replace(/\{\{destino\}\}/g, m?.destino || 'su destino');
    return (p.cuerpo || '').replace(/\{\{(\d+)\}\}/g, (x, i) => sust(vars[Number(i) - 1] ?? x));
  }

  function pintarPrevia() {
    const p = plantillaElegida(), d = previa;
    if (!p || !d) return;
    const vars = qa('[data-wc-var]').map(el => el.value.trim());
    const muestra = d.muestra || [], m = muestra.length ? muestra[iMuestra % muestra.length] : null;
    const ex = Object.entries(d.excluidos || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    $('wc-resultado').innerHTML = `
      <div class="wc-paso">
        <div class="wc-etq">Así le llega${m ? ` a ${esc(m.nombre || 'un cliente')}` : ''}</div>
        <div class="wc-burbuja">${esc(armarMensaje(p, vars, m))}</div>
        ${muestra.length > 1 ? '<div class="wc-acc"><button class="btn-sm" type="button" data-wc-muestra><i class="fas fa-shuffle"></i> Ver con otro cliente</button></div>' : ''}
        <div class="wc-res">
          <div>Se enviarían <b>${d.a_enviar}</b> de <b>${d.elegibles}</b> elegibles · costo aproximado <b>${usd(d.costo_usd)}</b> (${usd(d.tarifa_usd)} por mensaje)</div>
          ${ex.length ? `<div style="margin-top:7px" class="wc-etq">Quedan fuera</div>${ex.map(([k, n]) => `<div>${esc(MOTIVOS[k] || k)}: <b>${n}</b></div>`).join('')}` : ''}
          ${muestra.length ? `<div style="margin-top:7px" class="wc-etq">Algunos de la lista</div>${muestra.map(x => `<div>${esc(x.nombre || '—')} · ${esc(x.destino || 'sin destino')} · ${esc(x.fecha || 'sin fecha')} · ${esc(etapaTxt(x.etapa))}</div>`).join('')}` : ''}
        </div>
      </div>`;
  }

  function pintarResumen() {
    const p = plantillaElegida(), d = previa;
    if (!p || !d) return;
    const filtros = filtrosTxt(segmento()).replace(/^ · /, '') || 'Todos los clientes de reservas';
    $('wc-resumen').innerHTML = `
      <dl class="wc-resumen">
        <dt>Nombre</dt><dd>${esc($('wc-nombre').value.trim())}</dd>
        <dt>Plantilla</dt><dd>${esc(p.nombre)} (${esc(p.idioma)})</dd>
        <dt>Filtros</dt><dd>${esc(filtros)}</dd>
        <dt>Destinatarios</dt><dd>${d.a_enviar}</dd>
        <dt>Costo aprox.</dt><dd>${usd(d.costo_usd)}</dd>
      </dl>
      <div class="wc-nota" style="margin:11px 0">La lista queda congelada en un borrador. Para que salga, apruébala en la lista de campañas.</div>
      <div class="wc-acc"><button class="btn-sm lt-primario" type="button" id="wc-crear"${d.a_enviar ? '' : ' disabled'}><i class="fas fa-floppy-disk"></i> Crear borrador (no envía nada)</button></div>`;
  }

  async function cargarPlantillas() {
    const sel = $('wc-plantilla');
    const { data, error: e } = reservas
      ? await sb.functions.invoke('wa-plantilla-enviar', { body: { accion: 'plantillas' } })
      : await sb.functions.invoke('whatsapp-enviar?accion=plantillas', { body: { phone_number_id: $('wc-cuenta').value } });
    if (!$('wc-plantilla')) return;
    if (e || !data?.ok) { sel.innerHTML = '<option value="">No se pudieron leer las plantillas</option>'; plantillas = []; return; }
    plantillas = (data.plantillas || [])
      .map(p => ({ ...p, cuerpo: p.cuerpo ?? p.texto }))
      .filter(p => reservas ? p.categoria === 'MARKETING' : p.categoria === 'MARKETING' || p.categoria === 'UTILITY');
    sel.innerHTML = plantillas.length
      ? '<option value="">Elegir plantilla…</option>' + plantillas.map((p, i) => `<option value="${i}">${esc(p.nombre)} (${esc(p.idioma)} · ${esc(p.categoria)})</option>`).join('')
      : '<option value="">No hay plantillas aprobadas todavía</option>';
  }

  const plantillaElegida = () => { const v = $('wc-plantilla')?.value; return v ? plantillas[Number(v)] : null; };

  function pintarVars() {
    const p = plantillaElegida();
    $('wc-pl-cuerpo').textContent = p ? p.cuerpo : '';
    $('wc-vars').innerHTML = p ? Array.from({ length: p.variables }, (_, i) => reservas && i === 0
      ? '<label class="wc-campo">Valor de {{1}}<input type="text" data-wc-var="0" value="{{nombre}}" readonly title="Primer nombre de cada cliente"></label>'
      : `<label class="wc-campo">Valor de {{${i + 1}}}${reservas ? ' (usa {{destino}} para el destino de su viaje)' : ' (usa {{nombre}} para el primer nombre)'}<input type="text" data-wc-var="${i}" maxlength="200"${i === 0 ? ' value="{{nombre}}"' : ''}></label>`).join('') : '';
  }

  const segmento = () => reservas ? {
    origen: 'reservas',
    limite: Number($('wc-limite').value) || 500,
    desde: $('wc-desde').value || null,
    hasta: $('wc-hasta').value || null,
    etapas: marcados('data-wc-etapa'),
    asesores: marcados('data-wc-asesor'),
    destinos: marcados('data-wc-destino').map(Number),
  } : {
    dias: Number($('wc-dias').value) || 90,
    limite: Number($('wc-limite').value) || 500,
    canales: qa('[data-wc-canal]:checked').map(x => x.dataset.wcCanal),
  };

  function rango(tipo) {
    const [d, h] = tipo === 'viajaron' ? [enDias(-120), enDias(-1)] : tipo === 'pronto' ? [enDias(0), enDias(30)] : ['', ''];
    $('wc-desde').value = d; $('wc-hasta').value = h;
    if (reservas) recontar();
  }

  async function calcular() {
    if (!reservas && !segmento().canales.length) { error('Elige al menos un canal'); return; }
    $('wc-resultado').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    const { data, error: e } = await sb.rpc('wa_campana_preview', { p_segmento: segmento() });
    if (e) { $('wc-resultado').textContent = 'No se pudo calcular: ' + e.message; return; }
    const ex = Object.entries(data.excluidos || {}).map(([k, n]) => `<div>${esc(MOTIVOS[k] || k)}: <b>${n}</b></div>`).join('');
    $('wc-resultado').innerHTML = `<div class="wc-res">
      <div>Teléfonos móviles de Venezuela en la base: <b>${data.telefonos_ve}</b></div>
      <div>Elegibles: <b>${data.elegibles}</b> · se enviarían <b>${data.a_enviar}</b></div>
      <div>Costo aproximado: <b>${usd(data.costo_usd)}</b> (${usd(data.tarifa_usd)} por mensaje)</div>
      ${ex ? `<div style="margin-top:6px;color:var(--muted)">Excluidos:</div>${ex}` : ''}
      <div class="wc-acc" style="margin-top:8px"><button class="btn-sm lt-primario" id="wc-crear"${data.a_enviar ? '' : ' disabled'}>Crear borrador (no envía nada)</button></div></div>`;
  }

  async function crear() {
    const p = plantillaElegida();
    const nombre = $('wc-nombre').value.trim();
    if (!nombre || !p) { error('Falta el nombre o la plantilla'); return; }
    if (!reservas && !segmento().canales.length) { error('Elige al menos un canal'); return; }
    const variables = qa('[data-wc-var]').map(el => el.value.trim());
    if (variables.some(v => !v)) { error('Completa todas las variables'); return; }
    $('wc-crear').disabled = true;
    const { data, error: e } = await sb.rpc('wa_campana_crear', {
      p_nombre: nombre, p_phone_number_id: reservas ? null : $('wc-cuenta').value, p_plantilla: p.nombre, p_idioma: p.idioma,
      p_variables: variables, p_segmento: segmento(), p_asesores: reservas ? [] : marcados('data-wc-asesor'),
    });
    if (e || !data?.ok) { error(e?.message || MOTIVOS[data?.error] || data?.error || 'No se pudo crear'); $('wc-crear').disabled = false; return; }
    ok(`Borrador creado con ${data.envios} contactos`);
    pintarLista();
    alCambiar?.();
  }

  function cerrar() { clearTimeout(timer); fondo?.remove(); fondo = null; }

  function enganchar(el, conFondo) {
    el.addEventListener('click', ev => {
      const t = ev.target;
      if (conFondo && (t === el || t.closest('[data-wc-cerrar]'))) return cerrar();
      const v = t.closest('[data-wc-vista]');
      if (v) return v.dataset.wcVista === 'nueva' ? pintarNueva() : pintarLista();
      const acc = t.closest('[data-wc-acc]');
      if (acc) return cambiarEstado(Number(acc.closest('[data-wc-id]').dataset.wcId), acc.dataset.wcAcc, acc.dataset.n, acc.dataset.tarifa);
      const r = t.closest('[data-wc-rango]');
      if (r) return rango(r.dataset.wcRango);
      const ir = t.closest('[data-wc-ir]');
      if (ir) return irPaso(paso + Number(ir.dataset.wcIr));
      if (t.closest('[data-wc-muestra]')) { iMuestra++; return pintarPrevia(); }
      const det = t.closest('[data-wc-det] > summary');
      if (det) return cargarDetalle(det.parentElement);
      if (t.closest('#wc-calcular')) return calcular();
      if (t.closest('#wc-crear')) return crear();
    });
    el.addEventListener('change', ev => {
      if (ev.target.id === 'wc-cuenta') cargarPlantillas();
      if (ev.target.id === 'wc-plantilla') pintarVars();
      if (reservas && ev.target.closest('[data-wc-paso="2"]')) recontar();
    });
    el.addEventListener('input', ev => {
      if (reservas && ev.target.id === 'wc-limite') recontar();
    });
  }

  async function abrir() {
    css();
    if (fondo || raiz) return;
    fondo = document.createElement('div');
    fondo.className = 'wc-fondo';
    fondo.innerHTML = '<div class="wc-caja"></div>';
    document.body.appendChild(fondo);
    enganchar(fondo, true);
    pintarLista();
  }

  // Embebida en una pestaña: el contenedor es fijo y no hay botón de cerrar. Volver a la pestaña
  // refresca la lista, pero no pisa un asistente a medio llenar.
  function montar(el, { alCambiar: cb } = {}) {
    css();
    alCambiar = cb || null;
    if (raiz !== el) { raiz = el; enganchar(el, false); vista = 'lista'; }
    if (vista === 'lista') pintarLista();
  }

  return { abrir, montar };
}
