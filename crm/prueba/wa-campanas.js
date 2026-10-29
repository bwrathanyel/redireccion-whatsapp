// Campañas de plantillas por WhatsApp (Plan 5 v2 F3). Dos orígenes:
//  - 'leads' (bandeja de WhatsApp, solo admin): leads por el número VE de Meta Cloud.
//  - 'reservas' (sección Reservas, admin y administrativo): clientes de postventa_casos por Zernio,
//    solo plantillas MARKETING; el envío lo aprueba únicamente el admin.
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
const CSS = `
.wc-fondo{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px}
.wc-caja{background:var(--bg2);color:var(--txt);border:1px solid var(--line);border-radius:14px;width:min(720px,100%);padding:16px;display:flex;flex-direction:column;gap:12px}
.wc-cab{display:flex;align-items:center;gap:8px}.wc-cab h3{margin:0;flex:1;font-size:16px}
.wc-tabs{display:flex;gap:6px}.wc-tabs button.on{background:var(--wa);color:#fff}
.wc-campo{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--muted)}
.wc-campo input,.wc-campo select{padding:9px 11px;border-radius:10px;border:1px solid var(--line2);background:var(--bg);color:var(--txt);font:inherit}
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
`;

export function crearCampanasWa({ sb, esc, ok, error, origen = 'leads', rol = 'admin', etapaTxt = k => k }) {
  const reservas = origen === 'reservas';
  let fondo = null;
  let cuentas = [];
  let asesores = [];
  let plantillas = [];
  let opciones = null;
  let vista = 'lista';
  let timer = null;
  const $ = id => document.getElementById(id);
  const usd = n => '$' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const enDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  const marcados = attr => [...document.querySelectorAll(`[${attr}]:checked`)].map(x => x.getAttribute(attr) === '' ? x.value : x.getAttribute(attr));

  function css() {
    if ($('wc-css')) return;
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
    return p.length ? ' · ' + p.join(' · ') : '';
  }

  function tarjeta(c) {
    const hechos = c.total - c.pendientes, pct = c.total ? Math.round(hechos * 100 / c.total) : 0;
    const admin = rol === 'admin';
    const num = reservas
      ? `<span>Pendientes <b>${c.pendientes}</b></span><span>Enviados <b>${c.enviados}</b></span><span>Omitidos <b>${c.omitidos}</b></span>
         <span>Fallidos <b>${c.fallidos}</b></span><span>Bajas <b>${c.bajas}</b></span><span>Costo est. <b>${usd(c.costo_estimado_usd)}</b></span>`
      : `<span>Pendientes <b>${c.pendientes}</b></span><span>Enviados <b>${c.enviados}</b></span><span>Entregados <b>${c.entregados}</b></span>
         <span>Leídos <b>${c.leidos}</b></span><span>Respondieron <b>${c.respondieron}</b></span><span>Bajas <b>${c.bajas}</b></span>
         <span>Fallidos <b>${c.fallidos}</b></span><span>Cotizaciones <b>${c.cotizaciones}</b></span><span>Pagos <b>${c.pagos}</b></span>
         <span>Costo est. <b>${usd(c.costo_estimado_usd)}</b></span>`;
    return `
      <div class="wc-camp" data-wc-id="${c.id}">
        <div class="wc-camp-top"><b>${esc(c.nombre)}</b><span class="bt-tag">${ESTADOS[c.estado] || c.estado}</span></div>
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
      </div>`;
  }

  async function pintarLista(silencioso = false) {
    clearTimeout(timer);
    vista = 'lista';
    if (!silencioso) marco('<div class="msg-empty"><i class="fas fa-spinner fa-spin"></i></div>');
    const { data, error: e } = await sb.rpc('wa_campana_panel');
    if (!fondo || vista !== 'lista') return;
    if (e) { marco(`<div class="msg-empty">No se pudo cargar: ${esc(e.message)}</div>`); return; }
    const lista = (data || []).filter(c => (c.canal === 'zernio') === reservas);
    marco(lista.map(tarjeta).join('') || '<div class="msg-empty">Todavía no hay campañas</div>');
    if (lista.some(c => c.estado === 'enviando')) timer = setTimeout(() => pintarLista(true), 15000);
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
  }

  const camposPlantilla = `
      <label class="wc-campo">Nombre de la campaña<input id="wc-nombre" maxlength="80" placeholder="${reservas ? 'Recompra · clientes de Mérida' : 'Ola 0 · preventa fin de año'}"></label>
      <div class="wc-fila">
        ${reservas ? '' : '<label class="wc-campo">Número<select id="wc-cuenta"></select></label>'}
        <label class="wc-campo">Plantilla aprobada<select id="wc-plantilla"><option value="">Cargando…</option></select></label>
      </div>
      <div class="wc-pl" id="wc-pl-cuerpo"></div>
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
    if (!fondo || vista !== 'nueva') return;
    if (e) { marco(`<div class="msg-empty">No se pudo cargar: ${esc(e.message)}</div>`); return; }
    opciones = data.opciones || { destinos: [], etapas: [], asesores: [] };
    const chips = (attr, items, val, txt) => `<div class="wc-chips">${items.map(x => `<label><input type="checkbox" ${attr} value="${esc(String(val(x)))}"> ${esc(txt(x))} <small>${x.n}</small></label>`).join('') || '<span class="wc-nota">Sin datos</span>'}</div>`;
    marco(`${camposPlantilla}
      <div class="wc-campo">Fecha de viaje
        <div class="wc-acc"><button class="btn-sm" data-wc-rango="viajaron">Ya viajaron (últimos 120 días)</button>
          <button class="btn-sm" data-wc-rango="pronto">Viajan en los próximos 30 días</button>
          <button class="btn-sm" data-wc-rango="todas">Cualquier fecha</button></div></div>
      <div class="wc-fila">
        <label class="wc-campo">Desde<input id="wc-desde" type="date"></label>
        <label class="wc-campo">Hasta<input id="wc-hasta" type="date"></label>
        <label class="wc-campo">Máximo de contactos<input id="wc-limite" type="number" min="1" max="5000" value="500"></label>
      </div>
      <div class="wc-campo">Etapa de la reserva${chips('data-wc-etapa', opciones.etapas, x => x.etapa, x => etapaTxt(x.etapa))}</div>
      <div class="wc-campo">Asesor responsable${chips('data-wc-asesor', opciones.asesores, x => x.nombre, x => x.nombre)}</div>
      <div class="wc-campo">Destino${chips('data-wc-destino', opciones.destinos, x => x.id, x => x.nombre)}</div>
      <div class="wc-nota">Sin marcar nada en un filtro = todos. Siempre se excluyen bajas, «no contactar», teléfonos inválidos y quien recibió una promoción en los últimos 14 días.</div>
      <div class="wc-acc"><button class="btn-sm" id="wc-calcular">Calcular alcance y costo</button></div>
      <div id="wc-resultado"></div>`);
    cargarPlantillas();
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
    canales: [...document.querySelectorAll('[data-wc-canal]:checked')].map(x => x.dataset.wcCanal),
  };

  function rango(tipo) {
    const [d, h] = tipo === 'viajaron' ? [enDias(-120), enDias(-1)] : tipo === 'pronto' ? [enDias(0), enDias(30)] : ['', ''];
    $('wc-desde').value = d; $('wc-hasta').value = h;
  }

  async function calcular() {
    if (!reservas && !segmento().canales.length) { error('Elige al menos un canal'); return; }
    $('wc-resultado').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    const { data, error: e } = await sb.rpc('wa_campana_preview', { p_segmento: segmento() });
    if (e) { $('wc-resultado').textContent = 'No se pudo calcular: ' + e.message; return; }
    const ex = Object.entries(data.excluidos || {}).map(([k, n]) => `<div>${esc(MOTIVOS[k] || k)}: <b>${n}</b></div>`).join('');
    const muestra = reservas && data.muestra?.length
      ? `<div style="margin-top:6px;color:var(--muted)">Algunos de la lista:</div>${data.muestra.map(m => `<div>${esc(m.nombre || '—')} · ${esc(m.destino || 'sin destino')} · ${esc(m.fecha || 'sin fecha')} · ${esc(etapaTxt(m.etapa))}</div>`).join('')}`
      : '';
    $('wc-resultado').innerHTML = `<div class="wc-res">
      ${reservas
        ? `<div>Clientes de reservas: <b>${data.clientes}</b> · dentro del filtro: <b>${data.en_segmento}</b></div>`
        : `<div>Teléfonos móviles de Venezuela en la base: <b>${data.telefonos_ve}</b></div>`}
      <div>Elegibles: <b>${data.elegibles}</b> · se enviarían <b>${data.a_enviar}</b></div>
      <div>Costo aproximado: <b>${usd(data.costo_usd)}</b> (${usd(data.tarifa_usd)} por mensaje)</div>
      ${ex ? `<div style="margin-top:6px;color:var(--muted)">Excluidos:</div>${ex}` : ''}${muestra}
      <div class="wc-acc" style="margin-top:8px"><button class="btn-sm lt-primario" id="wc-crear"${data.a_enviar ? '' : ' disabled'}>Crear borrador (no envía nada)</button></div></div>`;
  }

  async function crear() {
    const p = plantillaElegida();
    const nombre = $('wc-nombre').value.trim();
    if (!nombre || !p) { error('Falta el nombre o la plantilla'); return; }
    if (!reservas && !segmento().canales.length) { error('Elige al menos un canal'); return; }
    const variables = [...document.querySelectorAll('[data-wc-var]')].map(el => el.value.trim());
    if (variables.some(v => !v)) { error('Completa todas las variables'); return; }
    $('wc-crear').disabled = true;
    const { data, error: e } = await sb.rpc('wa_campana_crear', {
      p_nombre: nombre, p_phone_number_id: reservas ? null : $('wc-cuenta').value, p_plantilla: p.nombre, p_idioma: p.idioma,
      p_variables: variables, p_segmento: segmento(), p_asesores: reservas ? [] : marcados('data-wc-asesor'),
    });
    if (e || !data?.ok) { error(e?.message || MOTIVOS[data?.error] || data?.error || 'No se pudo crear'); $('wc-crear').disabled = false; return; }
    ok(`Borrador creado con ${data.envios} contactos`);
    pintarLista();
  }

  function cerrar() { clearTimeout(timer); fondo?.remove(); fondo = null; }

  async function abrir() {
    css();
    if (fondo) return;
    fondo = document.createElement('div');
    fondo.className = 'wc-fondo';
    fondo.innerHTML = '<div class="wc-caja"></div>';
    document.body.appendChild(fondo);
    fondo.addEventListener('click', ev => {
      const t = ev.target;
      if (t === fondo || t.closest('[data-wc-cerrar]')) return cerrar();
      const v = t.closest('[data-wc-vista]');
      if (v) return v.dataset.wcVista === 'nueva' ? pintarNueva() : pintarLista();
      const acc = t.closest('[data-wc-acc]');
      if (acc) return cambiarEstado(Number(acc.closest('[data-wc-id]').dataset.wcId), acc.dataset.wcAcc, acc.dataset.n, acc.dataset.tarifa);
      const r = t.closest('[data-wc-rango]');
      if (r) return rango(r.dataset.wcRango);
      if (t.closest('#wc-calcular')) return calcular();
      if (t.closest('#wc-crear')) return crear();
    });
    fondo.addEventListener('change', ev => {
      if (ev.target.id === 'wc-cuenta') cargarPlantillas();
      if (ev.target.id === 'wc-plantilla') pintarVars();
    });
    pintarLista();
  }

  return { abrir };
}
