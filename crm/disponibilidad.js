// Solicitudes de disponibilidad (2026-11-18): el asesor pide hoteles/posadas/apartamentos, un admin
// la toma, consulta al proveedor por WhatsApp y responde cada alojamiento. Escritura solo por RPC disp_*.
// Plan: ~/.claude/plans/vamos-a-crear-una-joyful-boot.md
const CSS = `
.dp-top{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin:0 0 14px}
.dp-top h2{flex:1 1 auto;margin:0;font-size:18px;font-weight:800;letter-spacing:-.02em}
.dp-seg{display:inline-flex;border:1px solid var(--line2);border-radius:9px;overflow:hidden}
.dp-seg button{background:transparent;border:0;padding:7px 12px;font:inherit;font-size:11.5px;font-weight:700;color:var(--muted);cursor:pointer}
.dp-seg button[aria-pressed="true"]{background:var(--accent-soft);color:var(--accent-ink)}
.dp-met{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:7px;margin:0 0 14px}
.dp-met div{padding:9px 11px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.dp-met b{display:block;font-size:18px;font-weight:800}
.dp-met small{font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.dp-met p{margin:4px 0 0;font-size:11px;color:var(--muted)}
.dp-tabs{display:none;gap:4px;margin:0 0 9px;overflow-x:auto}
.dp-tabs button{flex:1 0 auto;background:var(--panel-solid);border:1px solid var(--line2);border-radius:999px;padding:7px 11px;font:inherit;font-size:11.5px;font-weight:700;color:var(--muted);cursor:pointer}
.dp-tabs button[aria-pressed="true"]{border-color:var(--accent-ink);color:var(--accent-ink)}
.dp-kanban{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;align-items:start}
.dp-col{display:flex;flex-direction:column;gap:7px;min-height:120px;padding:9px;border:1px solid var(--line);border-radius:14px;background:var(--bg2)}
.dp-col.sobre{border-color:var(--accent-ink)}
.dp-col h3{display:flex;align-items:center;gap:7px;margin:0 0 2px;font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.dp-col h3 span{margin-left:auto;font-size:11px;letter-spacing:0}
.dp-card{display:flex;flex-direction:column;gap:6px;padding:11px;border:1px solid var(--line2);border-radius:12px;background:var(--panel);cursor:pointer;transition:border-color .16s}
.dp-card:hover{border-color:var(--accent-ink)}
.dp-card.urg{border-left:3px solid var(--danger)}
.dp-cab{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800}
.dp-cab span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dp-cab small{font-size:11px;font-weight:600;color:var(--muted)}
.dp-chips{display:flex;flex-wrap:wrap;gap:4px}
.dp-chip{font-size:10px;font-weight:800;letter-spacing:.06em;padding:2px 7px;border-radius:999px;background:var(--line);color:var(--muted)}
.dp-chip.rojo{background:rgba(239,68,68,.14);color:var(--danger)}
.dp-chip.ambar{background:rgba(245,181,68,.15);color:var(--amber)}
.dp-chip.azul{background:rgba(74,158,255,.14);color:var(--blue)}
.dp-chip.verde{background:rgba(16,185,129,.15);color:var(--green)}
.dp-chip.acc{background:var(--accent-soft);color:var(--accent-ink)}
.dp-linea{font-size:11.5px;color:var(--muted)}
.dp-linea b{color:var(--txt);font-weight:700}
.dp-alos{display:flex;flex-direction:column;gap:3px;margin:0;padding:0;list-style:none}
.dp-alos li{display:flex;align-items:center;gap:7px;font-size:12px}
.dp-alos li label{display:flex;align-items:center;gap:7px;min-width:0;flex:1;cursor:pointer}
.dp-alos li span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dp-alos input{width:16px;height:16px;accent-color:var(--accent);flex:none}
.dp-punto{width:8px;height:8px;border-radius:50%;flex:none;background:var(--muted2)}
.dp-punto.consultando{background:var(--blue)}.dp-punto.disponible{background:var(--green)}.dp-punto.no_disponible{background:var(--danger)}.dp-punto.alternativa{background:var(--amber)}
.dp-pie{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--muted)}
.dp-pie .btn-sm{margin-left:auto}
.dp-cargando{opacity:.75;pointer-events:none}.dp-cargando::after{content:'';display:inline-block;width:.8em;height:.8em;margin-left:.45em;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;vertical-align:-.12em;animation:dp-gira .6s linear infinite}
@keyframes dp-gira{to{transform:rotate(360deg)}}
.dp-vacio{padding:14px 4px;text-align:center;font-size:11.5px;color:var(--muted2)}
.dp-lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:9px}
.dp-barra{position:sticky;bottom:calc(11px + env(safe-area-inset-bottom,0px));z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:14px;padding:9px 11px;border:1px solid var(--accent-ink);border-radius:12px;background:var(--panel-solid);box-shadow:0 8px 24px rgba(0,0,0,.25)}
.dp-barra span{flex:1 1 auto;font-size:12px;font-weight:700}
.dp-velo{position:fixed;inset:0;z-index:1200;display:flex;justify-content:flex-end;background:rgba(0,0,0,.45)}
.dp-velo.centro{justify-content:center;align-items:center;padding:14px}
.dp-panel{display:flex;flex-direction:column;width:min(560px,100%);height:100%;background:var(--panel-solid);border-left:1px solid var(--line2);box-shadow:0 20px 60px rgba(0,0,0,.4)}
.dp-velo.centro .dp-panel{height:auto;max-height:92%;border:1px solid var(--line2);border-radius:14px}
.dp-pcab{display:flex;align-items:center;gap:9px;padding:14px 14px 11px;border-bottom:1px solid var(--line)}
.dp-pcab h3{flex:1;margin:0;font-size:15px;font-weight:800}
.dp-x{width:36px;height:36px;border:1px solid var(--line2);border-radius:9px;background:transparent;color:var(--txt);cursor:pointer;font-size:14px}
.dp-cuerpo{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:14px}
.dp-bloque{display:flex;flex-direction:column;gap:7px}
.dp-bloque>h4{margin:0;font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.dp-acc{display:flex;flex-wrap:wrap;gap:7px}
.dp-item{display:flex;flex-direction:column;gap:7px;padding:11px;border:1px solid var(--line2);border-radius:12px}
.dp-item.viejo{opacity:.62}
.dp-item h5{display:flex;align-items:center;gap:7px;margin:0;font-size:13px;font-weight:800}
.dp-item h5 span{flex:1}
.dp-precio{font-size:14px;font-weight:800;color:var(--green)}
.dp-alt{display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px dashed var(--line2);border-radius:9px;font-size:12px}
.dp-alt span{flex:1}
.dp-form{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.dp-form .ancho{grid-column:1/-1}
.dp-campo{display:flex;flex-direction:column;gap:4px;min-width:0}
.dp-campo>span{font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.dp-campo input,.dp-campo select,.dp-campo textarea,.dp-chat textarea{width:100%;box-sizing:border-box;min-height:40px;padding:8px 10px;border:1px solid var(--line2);border-radius:9px;background:var(--bg2);color:var(--txt);font:inherit;font-size:13px}
.dp-campo textarea{min-height:64px;resize:vertical}
.dp-campo input:focus,.dp-campo select:focus,.dp-campo textarea:focus,.dp-chat textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.dp-fila{display:flex;flex-wrap:wrap;align-items:flex-end;gap:7px;padding:9px;border:1px solid var(--line);border-radius:12px}
.dp-fila .dp-campo{flex:1 1 90px}
.dp-fila .dp-campo.grande{flex:3 1 200px}
.dp-sug{display:flex;flex-direction:column;border:1px solid var(--line2);border-radius:9px;background:var(--panel-solid);max-height:180px;overflow:auto}
.dp-sug button{text-align:left;background:transparent;border:0;border-bottom:1px solid var(--line);padding:8px 10px;color:var(--txt);font:inherit;font-size:12.5px;cursor:pointer}
.dp-sug button:hover{background:var(--accent-soft)}
.dp-check{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600}
.dp-check input{width:18px;height:18px;accent-color:var(--accent)}
.dp-ppie{display:flex;justify-content:flex-end;gap:7px;padding:11px 14px calc(11px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line)}
.dp-ppie .btn-acc,.dp-ppie .btn-sec{min-height:40px}
.dp-tl{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}
.dp-tl li{font-size:11.5px;color:var(--muted);padding-left:11px;border-left:2px solid var(--line2)}
.dp-tl li b{color:var(--txt)}
.dp-chat{display:flex;flex-direction:column;gap:7px}
.dp-msgs{display:flex;flex-direction:column;gap:4px;max-height:260px;overflow:auto}
.dp-msg{max-width:82%;padding:7px 10px;border-radius:12px;background:var(--bg2);font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere}
.dp-msg.mio{align-self:flex-end;background:var(--accent-soft)}
.dp-msg small{display:block;font-size:10px;color:var(--muted);margin-bottom:2px}
.dp-chat form{display:flex;gap:7px;align-items:flex-end}
.dp-chat textarea{min-height:40px;max-height:120px;resize:none}
.dp-wa{display:flex;flex-direction:column;gap:7px;padding:11px;border:1px solid var(--line2);border-radius:12px}
.dp-wa pre{margin:0;padding:9px;border-radius:9px;background:var(--bg2);font:inherit;font-size:12px;white-space:pre-wrap}
@media (max-width:820px){
  .dp-tabs{display:flex}
  .dp-kanban{grid-template-columns:1fr}
  .dp-kanban .dp-col{display:none}
  .dp-kanban .dp-col.activa{display:flex}
  .dp-form{grid-template-columns:1fr}
  .dp-panel{border-left:0}
}
`;
const COLS = [['en_cola', 'En cola'], ['tomada', 'Tomada'], ['consultando', 'Consultando'], ['respondida', 'Respondida']];
const ESTADO_SOL = { en_cola: 'En cola', tomada: 'Tomada', consultando: 'Consultando', respondida: 'Respondida', cancelada: 'Cancelada' };
const ESTADO_ITEM = { pendiente: 'Pendiente', consultando: 'Consultando', disponible: 'Disponible', no_disponible: 'No disponible', alternativa: 'Alternativa' };
const COLOR_ITEM = { consultando: 'azul', disponible: 'verde', no_disponible: 'rojo', alternativa: 'ambar' };
const UNIDAD = { noche: 'por habitación / noche', persona_noche: 'por persona / noche', total: 'total de la estadía', persona_total: 'por persona (estadía)' };
const CANALES = { crm: 'CRM', cotizacion: 'Cotización', lead: 'Lead', lyra_crm: 'Lyra', lyra_telegram: 'Lyra · Telegram', lyra_whatsapp: 'Lyra · WhatsApp' };
const ERRORES = {
  ya_pedida: 'Ya pediste ese alojamiento con esas fechas y sigue abierta', faltan_fechas: 'Faltan las fechas', fechas_invalidas: 'Fechas inválidas',
  entrada_en_el_pasado: 'La entrada ya pasó', salida_antes_de_entrada: 'La salida tiene que ser después de la entrada', demasiadas_noches: 'Máximo 60 noches',
  faltan_habitaciones: 'Agrega al menos una habitación', habitacion_invalida: 'Revisa las habitaciones (1 a 12 adultos cada una)', edad_invalida: 'Edad de niño inválida (0 a 17)',
  personas_invalidas: 'Máximo 60 personas', falta_alojamiento: 'Agrega al menos un alojamiento', demasiados_alojamientos: 'Máximo 10 alojamientos',
  lead_no_disponible: 'Ese lead no está disponible', cotizacion_no_existe: 'La cotización no existe', ya_cerrada: 'La solicitud ya está cerrada',
  no_existe: 'No existe', estado_invalido: 'Elige una respuesta', precio_invalido: 'Precio inválido', falta_alternativa: 'Escribe la alternativa',
  alternativas_invalidas: 'Alternativas inválidas', moneda_invalida: 'Moneda inválida', alternativa_no_existe: 'Esa alternativa no existe',
  producto_no_existe: 'Ese alojamiento no está en el tarifario', ya_tomada: 'Otro admin ya la tomó', sin_items: 'Elige al menos un alojamiento',
  items_no_disponibles: 'Algún alojamiento ya no está abierto: recarga', no_tomada: 'Nadie la tenía tomada', destino_invalido: 'Ese admin no está activo',
  padre_no_disponible: 'La solicitud original no está disponible', item_no_existe: 'Ese alojamiento ya no está en la solicitud',
};
// Lyra consulta al proveedor (Edge Function lyra-proveedores, 2026-11-23).
const ESTADO_LYRA = { esperando: ['Lyra espera respuesta', 'azul'], repreguntada: ['Lyra repreguntó', 'azul'], respondida: ['Respondió a Lyra', 'verde'],
  sin_respuesta: ['No respondió', 'rojo'], escalada: ['Necesita un humano', 'ambar'], pausada: ['La lleva un admin', ''], cerrada: ['Cerrada', ''] };
const ERRORES_LYRA = {
  lyra_apagada: 'Lyra está apagada para proveedores', ya_consultando_lyra: 'Lyra ya tiene una consulta en curso para esos alojamientos', canal_invalido: 'Elige WhatsApp o correo', destino_invalido: 'Revisa el WhatsApp o el correo del proveedor',
  varios_proveedores: 'Esos alojamientos son de proveedores distintos', sin_proveedor: 'Elige el proveedor', tope_diario: 'Lyra llegó al tope de mensajes de hoy',
  fechas_distintas_whatsapp: 'Por WhatsApp el primer mensaje admite una sola fecha: consulta cada fecha por separado o usa correo',
  remitente_sin_gmail: 'El correo de la empresa está desconectado del CRM: reconéctalo en Correo', sin_remitente: 'Falta el correo remitente de Lyra',
  ventana_cerrada: 'WhatsApp no deja escribir libre a ese número ahora', mensaje_largo: 'El mensaje es demasiado largo', no_activa: 'Esa consulta ya no está activa',
};
const DIA = 864e5;
const hoyISO = () => new Date(Date.now() - 4 * 36e5).toISOString().slice(0, 10);
const fCorta = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '';
const noches = s => Math.round((new Date(s.check_out) - new Date(s.check_in)) / DIA);
const hace = t => { const m = Math.max(0, Math.round((Date.now() - new Date(t)) / 6e4)); return m < 60 ? m + ' min' : m < 1440 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : Math.floor(m / 1440) + ' d'; };
const hora = t => new Date(t).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' });
const habTxt = h => (h || []).map((x, i) => `Hab ${i + 1}: ${x.adultos}A` + ((x.ninos || []).length ? `+${x.ninos.length}N (${x.ninos.join(', ')} años)` : '') + (x.infantes ? `+${x.infantes}inf` : '')).join(' · ');
const habLargo = h => (h || []).map((x, i) => `Hab ${i + 1}: ${x.adultos} adulto${x.adultos > 1 ? 's' : ''}` + ((x.ninos || []).length ? ` + ${x.ninos.length} niño${x.ninos.length > 1 ? 's' : ''} (${x.ninos.join(', ')} años)` : '') + (x.infantes ? ` + ${x.infantes} infante${x.infantes > 1 ? 's' : ''}` : '')).join('\n');
const pronto = s => (new Date(s.check_in) - new Date(hoyISO())) / DIA <= 7;
const viejo = it => it.respondida_en && ['disponible', 'alternativa'].includes(it.estado) && Date.now() - new Date(it.respondida_en) > DIA;
const telWa = t => { let d = String(t || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '58' + d.slice(1); return d.length >= 10 ? d : ''; };
const precioTxt = it => it.precio_confirmado != null ? `${it.moneda === 'EUR' ? '€' : it.moneda === 'VES' ? 'Bs ' : '$'}${Number(it.precio_confirmado).toLocaleString('es-VE', { maximumFractionDigits: 2 })} ${UNIDAD[it.precio_unidad] || ''}` : '';

export function crearDisponibilidad({ sb, esc, ok, error, confirmar, rol, uid, raiz, abrirLead, aplicarCotizacion }) {
  const admin = rol === 'admin', puedeCrear = ['admin', 'asesor', 'administrativo'].includes(rol);
  let vista = admin ? 'tablero' : 'mias', lista = [], colMovil = 'en_cola', abierta = null, canal = null, recarga = null, admins = null, vigilando = false;
  const sel = new Set();
  if (!document.getElementById('dp-css')) { const st = document.createElement('style'); st.id = 'dp-css'; st.textContent = CSS; document.head.appendChild(st); }

  async function rpc(fn, args, silencio) {
    const { data, error: e } = await sb.rpc(fn, args);
    if (e) { if (!silencio) error(e.code === '42501' ? 'No tienes permiso para esto' : e.message); return null; }
    if (data && data.ok === false) { if (!silencio) error(ERRORES[data.error] || data.error); return null; }
    return data ?? {};
  }

  function badge() {
    const n = admin ? lista.filter(s => s.estado === 'en_cola').length : lista.reduce((a, s) => a + (s.no_leidos || 0), 0);
    const b = document.getElementById('nav-disp-count'); if (b) { b.textContent = n; b.hidden = !n; }
  }
  async function traer() {
    const d = await rpc('disp_listar', { p_vista: vista, p_dias: 7 }, true);
    if (d) lista = Array.isArray(d) ? d : [];
    badge();
  }
  function ocupado(b) { if (!b) return () => {}; b.disabled = true; b.classList.add('dp-cargando'); return () => { b.disabled = false; b.classList.remove('dp-cargando'); }; }
  // Tras una acción propia refrescamos al toque (lista y detalle en paralelo) y callamos el eco de realtime de esa misma acción.
  let silencio = 0, abrirTk = 0;
  async function refrescar(id, eco) {
    clearTimeout(recarga); if (!eco) silencio = Date.now() + 2000;
    const tk = abrirTk, [, d] = await Promise.all([traer(), id ? rpc('disp_detalle', { p_id: id }, true) : null]);
    if (raiz?.offsetParent) pintar();
    if (id && d && tk === abrirTk) abrir(id, true, d);
  }
  function programar() { if (Date.now() < silencio) return; clearTimeout(recarga); recarga = setTimeout(() => refrescar(abierta, true), 400); }
  function vigilar() {
    if (vigilando || !puedeCrear) return; vigilando = true;
    canal = sb.channel('disp-' + Math.random().toString(36).slice(2));
    ['disponibilidad_solicitudes', 'disponibilidad_items', 'disponibilidad_mensajes'].forEach(t => canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, programar));
    canal.subscribe();
    traer();
  }

  async function cargar() {
    vigilar();
    raiz.innerHTML = '<div class="dp-vacio">Cargando…</div>';
    await traer(); pintar();
    if (admin) metricas();
  }

  function chips(s) {
    return [s.urgente && '<span class="dp-chip rojo">URGENTE</span>', pronto(s) && s.estado !== 'respondida' && '<span class="dp-chip ambar">≤7 DÍAS</span>',
      s.cambio_tras_consulta && '<span class="dp-chip acc">CAMBIÓ</span>', s.fuera_horario && s.estado === 'en_cola' && '<span class="dp-chip">FUERA DE HORARIO</span>',
      s.no_leidos && `<span class="dp-chip azul"><i class="fas fa-comment"></i> ${s.no_leidos}</span>`, s.padre_id && `<span class="dp-chip">ALT. DE #${s.padre_id}</span>`].filter(Boolean).join('');
  }
  function tarjeta(s, conSel) {
    const espera = s.estado === 'en_cola' ? 'Espera ' + hace(s.creado_en) : s.estado === 'respondida' ? 'Respondida ' + hace(s.respondida_en) : (s.tomada_por_nombre || '') + ' · ' + hace(s.tomada_en || s.creado_en);
    const items = (s.items || []).map(it => {
      const marcable = conSel && admin && ['pendiente', 'consultando'].includes(it.estado);
      const txt = `<span class="dp-punto ${it.estado}" title="${ESTADO_ITEM[it.estado]}"></span><span>${esc(it.alojamiento)}</span>`;
      return `<li>${marcable ? `<label data-no-abrir><input type="checkbox" data-sel="${it.id}"${sel.has(it.id) ? ' checked' : ''}>${txt}</label>` : txt}</li>`;
    }).join('');
    return `<article class="dp-card${s.urgente ? ' urg' : ''}" data-abrir="${s.id}" draggable="${admin}" tabindex="0">
      <div class="dp-cab"><span>${esc(s.cliente_nombre || s.destino || 'Solicitud')}</span><small>#${s.id}</small></div>
      <div class="dp-chips">${chips(s)}</div>
      <div class="dp-linea"><b>${fCorta(s.check_in)} → ${fCorta(s.check_out)}</b> · ${noches(s)} n · ${esc(habTxt(s.habitaciones))}</div>
      <ul class="dp-alos">${items}</ul>
      <div class="dp-pie"><span>${admin ? esc(s.creado_por_nombre || '') + ' · ' : ''}${esc(espera)}</span>
        ${admin && s.estado === 'en_cola' ? `<button class="btn-sm" data-tomar="${s.id}" data-no-abrir>Tomar</button>` : ''}
        ${!admin && s.estado === 'en_cola' ? `<span class="dp-chip">Puesto ${s.puesto || '—'}</span>` : ''}
        ${!admin && s.estado !== 'en_cola' ? `<span class="dp-chip ${s.estado === 'respondida' ? 'verde' : 'azul'}">${ESTADO_SOL[s.estado]}</span>` : ''}</div>
      ${!admin && s.estado === 'en_cola' && s.fuera_horario ? '<div class="dp-linea">Se atenderá desde las 7:00</div>' : ''}
    </article>`;
  }

  function pintar() {
    const cab = `<div class="dp-top"><h2>Disponibilidad</h2>
      ${admin ? `<div class="dp-seg" role="group"><button data-vista="tablero" aria-pressed="${vista === 'tablero'}">Tablero</button><button data-vista="mias" aria-pressed="${vista === 'mias'}">Mis solicitudes</button></div>` : ''}
      ${puedeCrear ? '<button class="btn-acc" data-nueva><i class="fas fa-plus"></i> Pedir disponibilidad</button>' : ''}</div>
      ${admin && vista === 'tablero' ? '<div class="dp-met" id="dp-met"></div>' : ''}`;
    if (vista === 'tablero') {
      const por = Object.fromEntries(COLS.map(([k]) => [k, lista.filter(s => s.estado === k)]));
      raiz.innerHTML = cab + `<div class="dp-tabs" role="group">${COLS.map(([k, t]) => `<button data-col="${k}" aria-pressed="${colMovil === k}">${t} ${por[k].length}</button>`).join('')}</div>
        <div class="dp-kanban">${COLS.map(([k, t]) => `<section class="dp-col${colMovil === k ? ' activa' : ''}" data-columna="${k}"><h3>${t}<span>${por[k].length}</span></h3>
          ${por[k].map(s => tarjeta(s, k !== 'respondida')).join('') || '<div class="dp-vacio">Nada aquí</div>'}</section>`).join('')}</div>
        <div class="dp-barra" id="dp-barra"${sel.size ? '' : ' hidden'}><span>${sel.size} alojamiento${sel.size === 1 ? '' : 's'} elegido${sel.size === 1 ? '' : 's'}</span>
          <button class="btn-sec" data-limpiar>Quitar selección</button><button class="btn-acc" data-juntas><i class="fa-brands fa-whatsapp"></i> Consultar juntas</button></div>`;
      if (lista.length) metricasPintar();
    } else {
      const abiertas = lista.filter(s => !['respondida', 'cancelada'].includes(s.estado)), cerradas = lista.filter(s => ['respondida', 'cancelada'].includes(s.estado));
      raiz.innerHTML = cab + (lista.length ? `<div class="dp-lista">${[...abiertas, ...cerradas].map(s => tarjeta(s, false)).join('')}</div>`
        : '<div class="dp-vacio">No tienes solicitudes en los últimos 7 días. Pide disponibilidad desde aquí, desde una cotización o desde el lead.</div>');
    }
  }

  let ultMet = null;
  async function metricas() { ultMet = await rpc('disp_metricas', {}, true); metricasPintar(); }
  function metricasPintar() {
    const box = document.getElementById('dp-met'); if (!box || !ultMet) return;
    const m = ultMet, min = v => v == null ? '—' : v < 60 ? Math.round(v) + ' min' : (v / 60).toFixed(1) + ' h';
    box.innerHTML = `<div><small>Pendientes</small><b>${m.pendientes ?? 0}</b><p>${m.en_cola ?? 0} en cola</p></div>
      <div><small>Hasta tomarla</small><b>${min(m.min_tomar)}</b><p>mediana · 7 días</p></div>
      <div><small>Hasta responder</small><b>${min(m.min_respuesta)}</b><p>mediana · 7 días</p></div>
      <div><small>Disponible</small><b>${m.pct_disponible != null ? Math.round(m.pct_disponible) + ' %' : '—'}</b><p>${m.creadas ?? 0} pedidas</p></div>
      ${(m.por_admin || []).length ? `<div><small>Por admin</small><p>${m.por_admin.map(a => `${esc(a.nombre)}: ${a.respondidas} · ${min(a.min_mediana)}`).join('<br>')}</p></div>` : ''}
      ${(m.por_proveedor || []).length ? `<div><small>Por proveedor</small><p>${m.por_proveedor.slice(0, 4).map(p => `${esc(p.nombre || 'Sin proveedor')}: ${p.consultas} · ${min(p.min_mediana)}`).join('<br>')}</p></div>` : ''}`;
  }

  raiz.addEventListener('click', async e => {
    const t = e.target.closest('button,[data-abrir],input'); if (!t) return;
    if (t.dataset.vista) { vista = t.dataset.vista; sel.clear(); return cargar(); }
    if (t.dataset.col) { colMovil = t.dataset.col; return pintar(); }
    if (t.dataset.nueva !== undefined) return pedir({});
    if (t.dataset.sel) { const id = +t.dataset.sel; t.checked ? sel.add(id) : sel.delete(id); const b = document.getElementById('dp-barra'); if (b) { b.hidden = !sel.size; b.querySelector('span').textContent = `${sel.size} alojamiento${sel.size === 1 ? '' : 's'} elegido${sel.size === 1 ? '' : 's'}`; } return; }
    if (t.dataset.limpiar !== undefined) { sel.clear(); return pintar(); }
    if (t.dataset.juntas !== undefined) return consultar([...sel]);
    if (t.dataset.tomar) { const listo = ocupado(t); if (await rpc('disp_tomar', { p_id: +t.dataset.tomar })) { ok('Tomada'); await refrescar(); } listo(); return; }
    if (e.target.closest('[data-no-abrir]')) return;
    if (t.dataset.abrir) abrir(+t.dataset.abrir);
  });
  raiz.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset?.abrir) abrir(+e.target.dataset.abrir); });
  // Arrastrar entre columnas: En cola → Tomada toma; Tomada → En cola suelta. El resto se hace en el detalle.
  raiz.addEventListener('dragstart', e => { const c = e.target.closest?.('[data-abrir]'); if (c) e.dataTransfer.setData('text/plain', c.dataset.abrir); });
  raiz.addEventListener('dragover', e => { const col = e.target.closest?.('.dp-col'); if (col) { e.preventDefault(); col.classList.add('sobre'); } });
  raiz.addEventListener('dragleave', e => e.target.closest?.('.dp-col')?.classList.remove('sobre'));
  raiz.addEventListener('drop', async e => {
    const col = e.target.closest?.('.dp-col'); if (!col) return; e.preventDefault(); col.classList.remove('sobre');
    const id = +e.dataTransfer.getData('text/plain'), s = lista.find(x => x.id === id); if (!s) return;
    const a = col.dataset.columna, card = raiz.querySelector(`[data-abrir="${id}"]`);
    if (a !== s.estado && !(s.estado === 'en_cola' || (s.estado === 'tomada' && a === 'en_cola'))) { abrir(id); return; }
    if (a === s.estado) return;
    if (card) { card.classList.add('dp-cargando'); col.querySelector('h3').after(card); }
    if (s.estado === 'en_cola') { if (await rpc('disp_tomar', { p_id: id })) ok('Tomada'); }
    else if (await rpc('disp_soltar', { p_id: id })) ok('Devuelta a la cola');
    await refrescar();
  });

  // ---------- Panel lateral / modal ----------
  function panel(titulo, html, pie, centro) {
    cerrarPanel();
    const v = document.createElement('div'); v.className = 'dp-velo' + (centro ? ' centro' : ''); v.id = 'dp-velo';
    v.innerHTML = `<div class="dp-panel" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="dp-pcab"><h3>${titulo}</h3><button class="dp-x" data-cerrar aria-label="Cerrar">✕</button></div>
      <div class="dp-cuerpo">${html}</div>${pie ? `<div class="dp-ppie">${pie}</div>` : ''}</div>`;
    v.addEventListener('click', e => { if (e.target === v || e.target.closest('[data-cerrar]')) cerrarPanel(); });
    v.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarPanel(); });
    document.body.appendChild(v);
    v.querySelector('.dp-x').focus();
    return v;
  }
  function cerrarPanel() { document.getElementById('dp-velo')?.remove(); abierta = null; abrirTk++; }

  // ---------- Detalle ----------
  async function abrir(id, refresco, pre) {
    if (!refresco && !pre) panel(`#${id}`, '<div class="dp-vacio">Cargando…</div>');
    const tk = abrirTk, d = pre || await rpc('disp_detalle', { p_id: id }, refresco);
    if (tk !== abrirTk) return;
    if (!d) { if (!refresco) cerrarPanel(); return; }
    const s = d.solicitud, mia = s.creado_por_id === uid(), cerrada = ['respondida', 'cancelada'].includes(s.estado), mismo = abierta === id;
    if (refresco && mismo && document.querySelector('#dp-velo textarea:focus, #dp-velo input:focus')) { pintarChat(d); return; }
    const scroll = mismo ? document.querySelector('#dp-velo .dp-cuerpo')?.scrollTop : 0;
    const accs = [
      admin && s.estado === 'en_cola' && `<button class="btn-acc" data-a="tomar">Tomar</button>`,
      admin && s.tomada_por_id && !cerrada && `<button class="btn-sm" data-a="soltar">Soltar</button>`,
      admin && !cerrada && `<button class="btn-sm" data-a="pasar">Pasar a…</button>`,
      admin && !cerrada && s.items.some(i => ['pendiente', 'consultando'].includes(i.estado)) && `<button class="btn-sm" data-a="consultar"><i class="fa-brands fa-whatsapp"></i> Consultar al proveedor</button>`,
      (mia || admin) && !cerrada && `<button class="btn-sm" data-a="editar"><i class="fas fa-pen"></i> Editar</button>`,
      (mia || admin) && s.estado !== 'cancelada' && `<button class="btn-sm" data-a="cancelar">Cancelar solicitud</button>`,
      s.estado === 'respondida' && (mia || admin) && s.items.some(viejo) && `<button class="btn-sm" data-a="reconfirmar"><i class="fas fa-rotate"></i> Re-confirmar</button>`,
      s.lead_id && abrirLead && `<button class="btn-sm" data-a="lead">Abrir lead #${s.lead_id}</button>`,
    ].filter(Boolean).join('');
    const items = s.items.map((it, ix) => `<div class="dp-item${viejo(it) ? ' viejo' : ''}" data-item="${it.id}">
      <h5><span class="dp-punto ${it.estado}"></span><span>${esc(it.alojamiento)}</span><span class="dp-chip ${COLOR_ITEM[it.estado] || ''}">${ESTADO_ITEM[it.estado]}</span></h5>
      <div class="dp-linea">${[it.plan, it.habitacion, it.proveedor_nombre].filter(Boolean).map(esc).join(' · ') || 'Sin plan ni habitación'}${it.consultado_en ? ' · consultado ' + hace(it.consultado_en) : ''}</div>
      ${it.precio_confirmado != null ? `<div class="dp-precio">${esc(precioTxt(it))}</div>` : ''}
      ${it.respuesta_texto ? `<div class="dp-linea">${esc(it.respuesta_texto)}</div>` : ''}
      ${viejo(it) ? '<div class="dp-linea">Respondida hace más de 24 h: puede haber cambiado.</div>' : ''}
      ${(it.alternativas || []).map((a, k) => `<div class="dp-alt"><span><b>${esc(a.alojamiento || it.alojamiento)}</b>${a.check_in ? ` · ${fCorta(a.check_in)} → ${fCorta(a.check_out || s.check_out)}` : ''}${a.precio ? ` · $${esc(String(a.precio))}` : ''}${a.texto ? ` · ${esc(a.texto)}` : ''}</span>
        ${a.solicitud_id ? `<button class="btn-sm" data-ir="${a.solicitud_id}">Ver #${a.solicitud_id}</button>` : (mia || admin) ? `<button class="btn-sm" data-aceptar="${it.id}:${k}">Aceptar alternativa</button>` : ''}</div>`).join('')}
      <div class="dp-acc">${admin && s.estado !== 'cancelada' ? `<button class="btn-sm" data-responder="${ix}">${['disponible', 'no_disponible', 'alternativa'].includes(it.estado) ? 'Editar respuesta' : 'Responder'}</button>` : ''}
        ${it.estado === 'disponible' && it.precio_confirmado != null && (mia || admin) && aplicarCotizacion ? `<button class="btn-sm" data-aplicar="${ix}">${it.aplicado_cotizacion_en ? 'Aplicada · volver a aplicar' : s.cotizacion_id || it.cotizacion_item_idx != null ? 'Aplicar a la cotización' : 'Cotizar con esto'}</button>` : ''}</div>
      <div data-resp-form></div></div>`).join('');
    const v = panel(`#${s.id} · ${esc(s.cliente_nombre || s.destino || 'Solicitud')}`, `
      <div class="dp-bloque"><div class="dp-chips"><span class="dp-chip ${s.estado === 'respondida' ? 'verde' : s.estado === 'cancelada' ? 'rojo' : 'azul'}">${ESTADO_SOL[s.estado]}</span>${chips(s)}<span class="dp-chip">${CANALES[s.canal] || s.canal}</span></div>
        <div class="dp-linea"><b>${fCorta(s.check_in)} → ${fCorta(s.check_out)}</b> · ${noches(s)} noches${s.destino ? ' · ' + esc(s.destino) : ''}</div>
        <div class="dp-linea">${esc(habTxt(s.habitaciones))}</div>
        <div class="dp-linea">Pidió <b>${esc(s.creado_por_nombre || '')}</b> ${hora(s.creado_en)}${s.tomada_por_nombre ? ` · atiende <b>${esc(s.tomada_por_nombre)}</b>` : ''}${s.estado === 'en_cola' ? ` · puesto ${s.puesto || '—'} en la cola` : ''}</div>
        ${s.estado === 'en_cola' && s.fuera_horario ? '<div class="dp-linea">Llegó fuera de horario: se atenderá desde las 7:00.</div>' : ''}
        ${s.notas ? `<div class="dp-linea">${esc(s.notas)}</div>` : ''}
        <div class="dp-acc">${accs}</div></div>
      <div class="dp-bloque"><h4>Alojamientos</h4>${items}</div>
      ${bloqueLyra(d)}
      <div class="dp-bloque dp-chat"><h4>Chat</h4><div class="dp-msgs" id="dp-msgs"></div>
        ${s.estado !== 'cancelada' ? '<form id="dp-chat-f"><textarea rows="1" placeholder="Escribe al ' + (admin && !mia ? 'asesor' : 'admin') + '…" aria-label="Mensaje"></textarea><button class="btn-acc" type="submit" aria-label="Enviar"><i class="fas fa-paper-plane"></i></button></form>' : ''}</div>
      <div class="dp-bloque"><h4>Historial</h4><ul class="dp-tl">${(d.eventos || []).map(ev => `<li>${hora(ev.creado_en)} · <b>${esc(ev.usuario_nombre || 'Sistema')}</b> ${esc(accionTxt(ev, s))}</li>`).join('')}</ul></div>`);
    abierta = id;
    if (scroll) v.querySelector('.dp-cuerpo').scrollTop = scroll;
    pintarChat(d);
    pintarLyra(v, d);
    if (d.mensajes?.length) rpc('disp_marcar_leido', { p_id: id }, true);
    v.querySelector('#dp-chat-f')?.addEventListener('submit', async e => {
      e.preventDefault(); const ta = e.target.querySelector('textarea'), txt = ta.value.trim(); if (!txt) return;
      const listo = ocupado(e.target.querySelector('[type=submit]')); ta.disabled = true;
      const r = await rpc('disp_mensaje', { p_id: id, p_texto: txt, p_canal: 'crm' });
      listo(); ta.disabled = false; ta.focus();
      if (r) { ta.value = ''; refrescar(id); }
    });
    v.querySelector('#dp-chat-f textarea')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.form.requestSubmit(); } });
    v.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      const a = b.dataset.a, simple = { tomar: ['disp_tomar', 'Tomada'], soltar: ['disp_soltar', 'Devuelta a la cola'], cancelar: ['disp_cancelar', 'Cancelada'], reconfirmar: ['disp_reconfirmar', 'Pedida otra vez: vuelve a la cola'] }[a];
      if (simple) {
        if (a === 'cancelar' && !(await confirmar({ titulo: '¿Cancelar esta solicitud?', detalle: 'El admin deja de atenderla.', textoOk: 'Cancelar solicitud', destructivo: true }))) return;
        const listo = ocupado(b);
        if (await rpc(simple[0], { p_id: id })) { ok(simple[1]); await refrescar(id); }
        return listo();
      }
      if (b.dataset.lyraPausar) {
        if (!(await confirmar({ titulo: '¿Lo tomas tú?', detalle: 'Lyra deja de escribirle a este proveedor. Lo que conteste te llega por Telegram.', textoOk: 'Lo tomo yo' }))) return;
        const listo = ocupado(b), r = await lyra({ modo: 'pausar', consulta_id: +b.dataset.lyraPausar }); listo();
        if (r?.ok) { ok('Lyra ya no le escribe'); await refrescar(id); }
        return;
      }
      if (a === 'pasar') return pasar(s);
      if (a === 'consultar') return consultar(s.items.filter(i => ['pendiente', 'consultando'].includes(i.estado)).map(i => i.id), s);
      if (a === 'editar') return pedir({ editar: s });
      if (a === 'lead') { cerrarPanel(); return abrirLead(s.lead_id); }
      if (b.dataset.ir) return abrir(+b.dataset.ir);
      if (b.dataset.aceptar) { const [iid, k] = b.dataset.aceptar.split(':'), listo = ocupado(b); const r = await rpc('disp_aceptar_alternativa', { p_item_id: +iid, p_idx: +k }); listo(); if (r) { ok(r.ya_aceptada ? 'Ya estaba aceptada' : `Nueva solicitud #${r.solicitud_id}`); return refrescar(r.solicitud_id); } return; }
      if (b.dataset.responder) return formRespuesta(b.closest('.dp-item').querySelector('[data-resp-form]'), s, s.items[+b.dataset.responder]);
      if (b.dataset.aplicar) { const it = s.items[+b.dataset.aplicar]; cerrarPanel(); if (await aplicarCotizacion(s, it)) { await rpc('disp_marcar_aplicado', { p_item_id: it.id }, true); } return; }
    });
  }
  function accionTxt(ev, s) {
    const d = ev.detalle || {}, it = s.items.find(i => i.id === ev.item_id), nom = it ? ` ${it.alojamiento}` : '';
    const campos = { check_in: 'entrada', check_out: 'salida', habitaciones: 'habitaciones', notas: 'notas', urgente: 'urgente', cliente_nombre: 'cliente', destino: 'destino' };
    const val = (k, v) => k === 'habitaciones' ? habTxt(v) : k.startsWith('check') ? fCorta(v) : v === true ? 'sí' : v === false ? 'no' : (v ?? '—');
    switch (ev.accion) {
      case 'creada': return 'creó la solicitud' + (d.padre_id ? ` (alternativa de #${d.padre_id})` : '');
      case 'tomada': return 'la tomó';
      case 'soltada': return 'la devolvió a la cola';
      case 'pasada': return 'la pasó a otro admin';
      case 'consultada': return 'consultó al proveedor';
      case 'editada': return 'editó: ' + Object.entries(d.cambios || {}).map(([k, c]) => `${campos[k] || k} ${val(k, c.antes)} → ${val(k, c.despues)}`).join('; ') + (d.reabiertos ? ` (${d.reabiertos} respuesta${d.reabiertos > 1 ? 's' : ''} vuelven a consultarse)` : '');
      case 'item_reabierto': return `reabrió${nom}` + (d.estado ? ` (antes: ${ESTADO_ITEM[d.estado] || d.estado}${d.precio != null ? ' ' + d.precio + ' ' + (d.moneda || '') : ''})` : '');
      case 'respondida': return `respondió${nom}: ${ESTADO_ITEM[d.estado] || d.estado}${d.precio != null ? ' ' + d.precio + ' ' + (d.moneda || '') : ''}`;
      case 'respuesta_editada': return `actualizó la respuesta de${nom}: ${ESTADO_ITEM[d.estado] || d.estado}${d.precio != null ? ' ' + d.precio + ' ' + (d.moneda || '') : ''}` + (d.antes ? ` (antes ${ESTADO_ITEM[d.antes.estado] || ''}${d.antes.precio != null ? ' ' + d.antes.precio : ''})` : '');
      case 'alternativa_aceptada': return `aceptó una alternativa → #${d.nueva_id}`;
      case 'aplicada_cotizacion': return `aplicó${nom} a la cotización`;
      case 'cancelada': return 'canceló' + (d.motivo ? ': ' + d.motivo : '');
      case 'reconfirmada': return 'pidió re-confirmar';
      case 'item_agregado': return `agregó${nom}`;
      case 'item_quitado': return `quitó${nom}`;
      case 'lyra_respondio': return `· Lyra cargó la respuesta de ${d.proveedor || 'el proveedor'}`;
      case 'lyra_escalo': return `· Lyra pidió ayuda con ${d.proveedor || 'el proveedor'}${d.motivo ? ': ' + d.motivo : ''}`;
      case 'lyra_sin_respuesta': return `· ${d.proveedor || 'El proveedor'} no le respondió a Lyra`;
      case 'lyra_mensaje': return `· ${d.proveedor || 'El proveedor'} escribió: ${String(d.texto || '').slice(0, 120)}`;
      case 'lyra_pausada': return 'tomó la conversación con el proveedor (Lyra en pausa)';
      default: return ev.accion.replace(/_/g, ' ');
    }
  }
  function pintarChat(d) {
    const box = document.getElementById('dp-msgs'); if (!box) return;
    box.innerHTML = (d.mensajes || []).map(m => `<div class="dp-msg${m.mio ? ' mio' : ''}"><small>${esc(m.usuario_nombre || '')} · ${hora(m.creado_en)}${m.canal === 'telegram' ? ' · Telegram' : ''}</small>${esc(m.texto)}</div>`).join('') || '<div class="dp-vacio">Sin mensajes. Pregunta aquí en vez de WhatsApp.</div>';
    box.scrollTop = box.scrollHeight;
  }

  function formRespuesta(box, s, it) {
    const alts = (it.alternativas || []).filter(a => !a.solicitud_id);
    box.innerHTML = `<form class="dp-form">
      <label class="dp-campo"><span>Respuesta</span><select name="estado">${['disponible', 'no_disponible', 'alternativa'].map(k => `<option value="${k}"${it.estado === k ? ' selected' : ''}>${ESTADO_ITEM[k]}</option>`).join('')}</select></label>
      <label class="dp-campo"><span>Precio confirmado</span><input name="precio" type="number" min="0" step="0.01" inputmode="decimal" value="${it.precio_confirmado ?? ''}"></label>
      <label class="dp-campo"><span>Moneda</span><select name="moneda">${['USD', 'EUR', 'VES'].map(k => `<option${(it.moneda || 'USD') === k ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
      <label class="dp-campo"><span>El precio es</span><select name="unidad">${Object.entries(UNIDAD).map(([k, t]) => `<option value="${k}"${(it.precio_unidad || 'noche') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="dp-campo ancho"><span>Nota para el asesor</span><textarea name="texto" maxlength="1000">${esc(it.respuesta_texto || '')}</textarea></label>
      <div class="dp-campo ancho"><span>Alternativas</span><div data-alts></div><button type="button" class="btn-sm" data-alt-mas>+ Alternativa</button></div>
      <div class="dp-acc ancho"><button class="btn-acc" type="submit">Guardar respuesta</button><button class="btn-sec" type="button" data-cancelar>Cancelar</button></div></form>`;
    const f = box.querySelector('form'), cont = f.querySelector('[data-alts]');
    const filaAlt = (a = {}) => { const d = document.createElement('div'); d.className = 'dp-fila'; d.innerHTML = `<label class="dp-campo grande"><span>Alojamiento</span><input data-k="alojamiento" value="${esc(a.alojamiento || '')}" placeholder="${esc(it.alojamiento)}"></label>
      <label class="dp-campo"><span>Entrada</span><input data-k="check_in" type="date" value="${a.check_in || ''}"></label><label class="dp-campo"><span>Salida</span><input data-k="check_out" type="date" value="${a.check_out || ''}"></label>
      <label class="dp-campo"><span>Precio</span><input data-k="precio" type="number" min="0" step="0.01" value="${a.precio ?? ''}"></label><label class="dp-campo grande"><span>Detalle</span><input data-k="texto" value="${esc(a.texto || '')}"></label>
      <button type="button" class="btn-sm" data-alt-x aria-label="Quitar alternativa">✕</button>`; cont.appendChild(d); };
    alts.forEach(filaAlt);
    f.addEventListener('click', e => { if (e.target.closest('[data-alt-mas]')) filaAlt(); if (e.target.closest('[data-alt-x]')) e.target.closest('.dp-fila').remove(); if (e.target.closest('[data-cancelar]')) box.innerHTML = ''; });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const nuevas = [...cont.querySelectorAll('.dp-fila')].map(r => Object.fromEntries([...r.querySelectorAll('[data-k]')].map(i => [i.dataset.k, i.type === 'number' ? (i.value === '' ? null : Number(i.value)) : i.value.trim()]).filter(([, v]) => v !== '' && v != null))).filter(a => Object.keys(a).length);
      const p = { estado: f.estado.value, precio: f.precio.value, moneda: f.moneda.value, precio_unidad: f.unidad.value, texto: f.texto.value, alternativas: [...(it.alternativas || []).filter(a => a.solicitud_id), ...nuevas] };
      const listo = ocupado(f.querySelector('[type=submit]'));
      if (await rpc('disp_responder_item', { p_item_id: it.id, p })) { ok('Respuesta guardada'); await refrescar(s.id); }
      listo();
    });
  }

  async function pasar(s) {
    admins ||= ((await sb.from('usuarios').select('id,nombre').eq('rol', 'admin').is('desactivado_at', null).order('nombre')).data || []).filter(a => !a.nombre.startsWith('__gate'));
    const v = panel('Pasar a otro admin', `<div class="dp-acc">${admins.filter(a => a.id !== s.tomada_por_id).map(a => `<button class="btn-sm" data-a="${a.id}">${esc(a.nombre)}</button>`).join('')}</div>`, '', true);
    v.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const listo = ocupado(b); if (await rpc('disp_pasar', { p_id: s.id, p_a: b.dataset.a })) { ok('Pasada a ' + b.textContent); await refrescar(s.id); } listo(); });
  }

  // ---------- Consultar al proveedor (WhatsApp prellenado, agrupado por proveedor) ----------
  async function consultar(ids, sol) {
    if (!ids.length) return error(ERRORES.sin_items);
    const fuente = sol ? [sol] : lista;
    const elegidos = fuente.flatMap(s => (s.items || []).filter(i => ids.includes(i.id)).map(i => ({ ...i, s })));
    const grupos = [...elegidos.reduce((m, i) => { const k = i.proveedor_id || 'sin-' + i.id; if (!m.has(k)) m.set(k, []); m.get(k).push(i); return m; }, new Map()).values()];
    const texto = g => 'Buenas, ¿me confirma disponibilidad y tarifa para:\n\n' + g.map(i => `• ${i.alojamiento}${i.plan ? ' · ' + i.plan : ''}${i.habitacion ? ' · ' + i.habitacion : ''}\n  Entrada ${fCorta(i.s.check_in)} · Salida ${fCorta(i.s.check_out)} (${noches(i.s)} noches)\n  ${habLargo(i.s.habitaciones).replace(/\n/g, '\n  ')}`).join('\n\n') + '\n\n¡Gracias!';
    const v = panel(grupos.length > 1 ? `Consultar a ${grupos.length} proveedores` : 'Consultar al proveedor', grupos.map((g, k) => `<div class="dp-wa" data-g="${k}">
      <div class="dp-cab"><span>${esc(g[0].proveedor_nombre || g[0].alojamiento)}</span><small>${g.length} alojamiento${g.length > 1 ? 's' : ''}</small></div>
      <label class="dp-campo"><span>WhatsApp del proveedor</span><input data-tel inputmode="tel" value="${esc(g[0].proveedor_telefono || '')}" placeholder="0414…"></label>
      ${g[0].proveedor_id && !g[0].proveedor_telefono ? '<div class="dp-linea">Sin teléfono en Proveedores: el que escribas se guarda.</div>' : ''}
      <label class="dp-campo"><span>Mensaje</span><textarea data-msg rows="8">${esc(texto(g))}</textarea></label>
      <div class="dp-acc"><button class="btn-acc" data-enviar="${k}"><i class="fa-brands fa-whatsapp"></i> Abrir WhatsApp y marcar consultando</button><button class="btn-sm" data-solo="${k}">Solo marcar consultando</button><button class="btn-sm" data-lyra="${k}"><i class="fas fa-robot"></i> Que consulte Lyra</button></div></div>`).join(''), '', false);
    v.addEventListener('click', async e => {
      const bl = e.target.closest('[data-lyra]');
      if (bl) { const k = +bl.dataset.lyra; return lyraForm(v.querySelector(`[data-g="${k}"]`), grupos[k], sol, () => { grupos[k].forEach(i => sel.delete(i.id)); }); }
      const b = e.target.closest('[data-enviar],[data-solo]'); if (!b) return;
      const k = +(b.dataset.enviar ?? b.dataset.solo), caja = v.querySelector(`[data-g="${k}"]`), g = grupos[k];
      const tel = caja.querySelector('[data-tel]').value.trim(), msg = caja.querySelector('[data-msg]').value.trim(), wa = telWa(tel);
      if (b.dataset.enviar !== undefined && !wa) return error('Escribe el WhatsApp del proveedor');
      const w = b.dataset.enviar !== undefined ? window.open('', '_blank') : null;
      const listo = ocupado(b);
      const r = await rpc('disp_registrar_consulta', { p_item_ids: g.map(i => i.id), p_mensaje: msg, p_telefono: tel || null, p_proveedor_id: g[0].proveedor_id || null });
      if (!r) { w?.close(); listo(); return; }
      if (w) w.location = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
      g.forEach(i => sel.delete(i.id));
      caja.innerHTML = `<div class="dp-linea"><b>${esc(g[0].proveedor_nombre || g[0].alojamiento)}</b>: consultando.</div>`;
      const fin = !v.querySelector('[data-enviar]');
      if (fin && !sol) cerrarPanel();
      await refrescar(fin && sol ? sol.id : null);
    });
  }

  // ---------- Lyra le escribe al proveedor y sigue la conversación ----------
  async function lyra(body) {
    const { data, error: e } = await sb.functions.invoke('lyra-proveedores', { body });
    if (e || !data) { error('No se pudo hablar con Lyra'); return null; }
    if (!data.ok) { error(ERRORES_LYRA[data.error] || ERRORES[data.error] || data.error || 'Error'); return data; }
    return data;
  }
  let proveedoresLyra = null;
  async function lyraForm(caja, g, sol, alEnviar) {
    const ids = g.map(i => i.id), st = { canal: undefined, destino: undefined, proveedor_id: g[0].proveedor_id || null };
    const cargar = async () => {
      caja.innerHTML = '<div class="dp-vacio">Lyra prepara el mensaje…</div>';
      const b = await lyra({ modo: 'borrador', item_ids: ids, canal: st.canal, destino: st.destino, proveedor_id: st.proveedor_id });
      if (b?.error === 'sin_proveedor') return elegirProveedor();
      if (!b?.ok) { caja.innerHTML = `<div class="dp-linea">${esc(ERRORES_LYRA[b?.error] || 'No se pudo preparar')}</div>`; return; }
      st.canal = b.canal; st.destino = b.destino; st.proveedor_id = b.proveedor.id;
      const activa = (b.lyra_activa || []).length;
      caja.innerHTML = `<div class="dp-cab"><span><i class="fas fa-robot"></i> Lyra consulta a ${esc(b.proveedor.nombre)}</span><small>${g.length} alojamiento${g.length > 1 ? 's' : ''}</small></div>
        ${b.config && !b.config.envio_real ? '<div class="dp-linea"><b>Modo prueba:</b> el mensaje queda registrado pero no le llega al proveedor (salvo números de prueba).</div>' : ''}
        ${activa ? '<div class="dp-linea">Lyra ya tiene una consulta abierta con estos alojamientos.</div>' : ''}
        <div class="dp-acc">${['whatsapp', 'correo'].map(c => `<button type="button" class="btn-sm${b.canal === c ? ' btn-acc' : ''}" data-canal="${c}"><i class="${c === 'whatsapp' ? 'fa-brands fa-whatsapp' : 'fas fa-envelope'}"></i> ${c === 'whatsapp' ? 'WhatsApp' : 'Correo'}</button>`).join('')}</div>
        <label class="dp-campo"><span>${b.canal === 'whatsapp' ? 'WhatsApp del proveedor' : 'Correo del proveedor'}</span><input data-dest ${b.canal === 'whatsapp' ? 'inputmode="tel" placeholder="584141234567"' : 'type="email" placeholder="reservas@hotel.com"'} value="${esc(b.destino || '')}"></label>
        ${b.asunto != null ? `<label class="dp-campo"><span>Asunto</span><input data-asunto maxlength="200" value="${esc(b.asunto)}"></label>` : ''}
        <label class="dp-campo"><span>Mensaje${b.editable ? '' : ' (plantilla aprobada de WhatsApp, no se edita)'}</span><textarea data-msg rows="8"${b.editable ? '' : ' readonly'}>${esc(b.mensaje)}</textarea></label>
        <div class="dp-linea">Lyra solo pregunta disponibilidad y tarifa. Si el proveedor pide confirmar, pagar o negociar, te avisa por Telegram.</div>
        <div class="dp-acc"><button class="btn-acc" data-lyra-enviar><i class="fas fa-paper-plane"></i> Enviar con Lyra</button></div>`;
      caja.onclick = async e => {
        const c = e.target.closest('[data-canal]');
        if (c && c.dataset.canal !== st.canal) { st.canal = c.dataset.canal; st.destino = undefined; return cargar(); }
        const env = e.target.closest('[data-lyra-enviar]'); if (!env) return;
        const destino = caja.querySelector('[data-dest]').value.trim();
        if (!destino) return error(st.canal === 'whatsapp' ? 'Escribe el WhatsApp del proveedor' : 'Escribe el correo del proveedor');
        const listo = ocupado(env);
        const r = await lyra({ modo: 'enviar', item_ids: ids, canal: st.canal, destino: st.canal === 'whatsapp' ? (telWa(destino) || destino) : destino,
          proveedor_id: st.proveedor_id, mensaje: b.editable ? caja.querySelector('[data-msg]').value : null, asunto: caja.querySelector('[data-asunto]')?.value || null });
        listo();
        if (!r?.ok) return;
        alEnviar?.();
        ok(r.simulado ? 'Registrado en modo prueba' : 'Lyra le escribió al proveedor');
        caja.onclick = null;
        caja.innerHTML = `<div class="dp-linea"><i class="fas fa-robot"></i> <b>${esc(b.proveedor.nombre)}</b>: Lyra está consultando${r.simulado ? ' (prueba)' : ''}.</div>`;
        await refrescar(sol ? sol.id : null);
      };
    };
    const elegirProveedor = async () => {
      proveedoresLyra ||= (await rpc('listar_proveedores', { p_solo_activos: true }, true)) || [];
      caja.innerHTML = `<label class="dp-campo"><span>¿A qué proveedor le escribe Lyra?</span><select data-prov><option value="">Elegir…</option>${proveedoresLyra.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></label>`;
      caja.querySelector('[data-prov]').onchange = e => { if (e.target.value) { st.proveedor_id = +e.target.value; cargar(); } };
    };
    await cargar();
  }
  function bloqueLyra(d) {
    const cs = (d.consultas || []).filter(c => c.agente === 'lyra');
    if (!admin || !cs.length) return '';
    return `<div class="dp-bloque"><h4><i class="fas fa-robot"></i> Lyra con proveedores</h4>${cs.map(c => {
      const [txt, color] = ESTADO_LYRA[c.estado_lyra] || [c.estado_lyra, ''];
      return `<div class="dp-item" data-lyra-cons="${c.id}"><h5><span>${esc(c.proveedor_nombre || 'Proveedor')}</span><span class="dp-chip ${color}">${esc(txt)}</span></h5>
        <div class="dp-linea">${c.canal === 'whatsapp' ? 'WhatsApp' : 'Correo'} · ${esc(c.destino || '')} · pidió ${esc(c.admin_nombre || '')} ${hace(c.enviado_en)}${c.recordatorios ? ` · ${c.recordatorios} recordatorio${c.recordatorios > 1 ? 's' : ''}` : ''}</div>
        ${c.escalado_motivo && ['escalada', 'sin_respuesta'].includes(c.estado_lyra) ? `<div class="dp-linea"><b>Motivo:</b> ${esc(c.escalado_motivo)}</div>` : ''}
        <div class="dp-msgs" data-lyra-msgs="${c.id}"><div class="dp-vacio">Cargando conversación…</div></div>
        ${['esperando', 'repreguntada', 'escalada'].includes(c.estado_lyra) ? `<div class="dp-acc"><button class="btn-sm" data-lyra-pausar="${c.id}">Lo tomo yo</button></div>` : ''}</div>`;
    }).join('')}</div>`;
  }
  async function pintarLyra(v, d) {
    const ids = (d.consultas || []).filter(c => c.agente === 'lyra').map(c => c.id);
    if (!admin || !ids.length) return;
    const { data } = await sb.from('disponibilidad_consulta_mensajes').select('consulta_id,direccion,autor,texto,simulado,creado_en').in('consulta_id', ids).order('creado_en');
    for (const id of ids) {
      const box = v.querySelector(`[data-lyra-msgs="${id}"]`); if (!box) continue;
      const ms = (data || []).filter(m => m.consulta_id === id);
      box.innerHTML = ms.map(m => `<div class="dp-msg${m.direccion === 'saliente' ? ' mio' : ''}"><small>${m.direccion === 'saliente' ? 'Lyra' : 'Proveedor'} · ${hora(m.creado_en)}${m.simulado ? ' · prueba, no enviado' : ''}</small>${esc(m.texto)}</div>`).join('') || '<div class="dp-vacio">Sin mensajes.</div>';
      box.scrollTop = box.scrollHeight;
    }
  }

  // ---------- Formulario (nueva o editar) ----------
  let buscarTk = 0;
  function pedir({ editar, lead, cotizacion, items: pre, canal: canalIn, habitaciones, check_in, check_out, cliente, destino } = {}) {
    if (!puedeCrear) return error('Tu rol no pide disponibilidad');
    const s = editar || {};
    const habs = s.habitaciones || habitaciones || [{ adultos: 2, ninos: [], infantes: 0 }];
    const alos = editar ? s.items.map(i => ({ id: i.id, producto_id: i.producto_id, alojamiento: i.alojamiento, tipo: i.tipo, plan: i.plan, habitacion: i.habitacion, cotizacion_item_idx: i.cotizacion_item_idx })) : (pre?.length ? pre : [{}]);
    const leadSel = editar ? (s.lead_id ? { id: s.lead_id } : null) : lead || null;
    const ci = s.check_in || check_in || lead?.fecha_viaje_desde || '', co = s.check_out || check_out || lead?.fecha_viaje_hasta || '';
    const v = panel(editar ? `Editar solicitud #${s.id}` : 'Pedir disponibilidad', `<form class="dp-form" id="dp-f" novalidate>
      ${editar && ['consultando'].includes(s.estado) ? '<div class="dp-linea ancho">Ya se consultó al proveedor: si cambias fechas o habitaciones, el admin recibe aviso y se vuelve a consultar.</div>' : ''}
      ${leadSel ? `<div class="dp-linea ancho">Lead: <b>${esc(leadSel.nombre || '#' + leadSel.id)}</b></div>` : ''}
      <label class="dp-campo"><span>Cliente</span><input name="cliente" maxlength="120" value="${esc(s.cliente_nombre || cliente || leadSel?.nombre || '')}"></label>
      <label class="dp-campo"><span>Destino</span><input name="destino" maxlength="120" value="${esc(s.destino || destino || lead?.destino || '')}"></label>
      <label class="dp-campo"><span>Entrada</span><input name="check_in" type="date" required min="${editar ? '' : hoyISO()}" value="${ci}"></label>
      <label class="dp-campo"><span>Salida</span><input name="check_out" type="date" required value="${co}"></label>
      <div class="dp-campo ancho"><span>Alojamientos</span><div data-alos></div><button type="button" class="btn-sm" data-alo-mas>+ Alojamiento</button></div>
      <div class="dp-campo ancho"><span>Habitaciones</span><div data-habs></div><button type="button" class="btn-sm" data-hab-mas>+ Habitación</button></div>
      <label class="dp-check ancho"><input type="checkbox" name="urgente"${s.urgente ? ' checked' : ''}> Urgente: el cliente está en línea esperando</label>
      <label class="dp-campo ancho"><span>Notas</span><textarea name="notas" maxlength="1000" placeholder="Vista al mar, cama matrimonial, llegada tarde…">${esc(s.notas || '')}</textarea></label>
    </form>`, `<button class="btn-sec" data-cerrar>Cancelar</button><button class="btn-acc" data-enviar>${editar ? 'Guardar cambios' : 'Enviar solicitud'}</button>`);
    const f = v.querySelector('#dp-f'), cAlos = f.querySelector('[data-alos]'), cHabs = f.querySelector('[data-habs]');
    const filaHab = (h = { adultos: 2, ninos: [], infantes: 0 }) => {
      const d = document.createElement('div'); d.className = 'dp-fila';
      d.innerHTML = `<label class="dp-campo"><span>Adultos</span><input data-h="adultos" type="number" min="1" max="12" value="${h.adultos ?? 2}"></label>
        <label class="dp-campo grande"><span>Edades de niños</span><input data-h="ninos" inputmode="numeric" placeholder="Ej: 6, 9" value="${(h.ninos || []).join(', ')}"></label>
        <label class="dp-campo"><span>Infantes</span><input data-h="infantes" type="number" min="0" max="6" value="${h.infantes || 0}"></label>
        <button type="button" class="btn-sm" data-x aria-label="Quitar habitación">✕</button>`;
      cHabs.appendChild(d);
    };
    const filaAlo = (a = {}) => {
      const d = document.createElement('div'); d.className = 'dp-fila'; if (a.id) d.dataset.id = a.id; if (a.producto_id) d.dataset.prod = a.producto_id; if (a.cotizacion_item_idx != null) d.dataset.idx = a.cotizacion_item_idx;
      d.innerHTML = `<label class="dp-campo grande"><span>Hotel, posada o apartamento</span><input data-a="alojamiento" autocomplete="off" placeholder="Busca en el tarifario o escribe el nombre" value="${esc(a.alojamiento || '')}"${a.id ? ' readonly' : ''}><div class="dp-sug" hidden></div></label>
        <label class="dp-campo"><span>Tipo</span><select data-a="tipo"${a.id ? ' disabled' : ''}>${['hotel', 'posada', 'apartamento', 'otro'].map(k => `<option${(a.tipo || 'hotel') === k ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
        <label class="dp-campo"><span>Plan</span><input data-a="plan" maxlength="120" value="${esc(a.plan || '')}" placeholder="Todo incluido…"></label>
        <label class="dp-campo"><span>Habitación</span><input data-a="habitacion" maxlength="120" value="${esc(a.habitacion || '')}" placeholder="Estándar…"></label>
        <button type="button" class="btn-sm" data-x aria-label="Quitar alojamiento">✕</button>`;
      cAlos.appendChild(d);
    };
    habs.forEach(filaHab); alos.forEach(filaAlo);
    f.addEventListener('click', e => {
      if (e.target.closest('[data-hab-mas]')) filaHab();
      if (e.target.closest('[data-alo-mas]')) filaAlo();
      const x = e.target.closest('[data-x]'); if (x && x.closest('[data-habs],[data-alos]').children.length > 1) x.closest('.dp-fila').remove();
      const op = e.target.closest('[data-prod-op]');
      if (op) { const fila = op.closest('.dp-fila'), inp = fila.querySelector('[data-a="alojamiento"]'); inp.value = op.dataset.nombre; fila.dataset.prod = op.dataset.prodOp; fila.querySelector('[data-a="tipo"]').value = op.dataset.tipo; op.parentElement.hidden = true; }
    });
    f.addEventListener('input', async e => {
      const inp = e.target; if (inp.dataset.a !== 'alojamiento' || inp.readOnly) return;
      const fila = inp.closest('.dp-fila'), sug = fila.querySelector('.dp-sug'); delete fila.dataset.prod;
      const q = inp.value.trim(), tk = ++buscarTk; if (q.length < 3) { sug.hidden = true; return; }
      await new Promise(r => setTimeout(r, 250)); if (tk !== buscarTk) return;
      const { data } = await sb.from('productos').select('id,nombre,destino,tipo').in('tipo', ['hotel', 'posada', 'apartamento']).ilike('nombre', `%${q.replace(/[%_,()]/g, ' ')}%`).limit(8);
      if (tk !== buscarTk) return;
      sug.innerHTML = (data || []).map(p => `<button type="button" data-prod-op="${p.id}" data-nombre="${esc(p.nombre)}" data-tipo="${['hotel', 'posada', 'apartamento'].includes(p.tipo) ? p.tipo : 'otro'}">${esc(p.nombre)}${p.destino ? ` · <small>${esc(p.destino)}</small>` : ''}</button>`).join('');
      sug.hidden = !data?.length;
    });
    f.addEventListener('focusout', e => { if (e.target.dataset?.a === 'alojamiento') setTimeout(() => { const s2 = e.target.closest('.dp-fila')?.querySelector('.dp-sug'); if (s2) s2.hidden = true; }, 200); });
    v.querySelector('[data-enviar]').addEventListener('click', async e => {
      const b = e.currentTarget;
      const habitacionesN = [...cHabs.children].map(r => ({ adultos: +r.querySelector('[data-h="adultos"]').value || 0,
        ninos: r.querySelector('[data-h="ninos"]').value.split(/[^\d]+/).filter(Boolean).map(Number), infantes: +r.querySelector('[data-h="infantes"]').value || 0 }));
      const itemsN = [...cAlos.children].map(r => ({ id: r.dataset.id ? +r.dataset.id : undefined, producto_id: r.dataset.prod ? +r.dataset.prod : undefined,
        alojamiento: r.querySelector('[data-a="alojamiento"]').value.trim(), tipo: r.querySelector('[data-a="tipo"]').value,
        plan: r.querySelector('[data-a="plan"]').value.trim(), habitacion: r.querySelector('[data-a="habitacion"]').value.trim(),
        cotizacion_item_idx: r.dataset.idx != null ? +r.dataset.idx : undefined })).filter(i => i.id || i.producto_id || i.alojamiento);
      if (!f.check_in.value || !f.check_out.value) return error(ERRORES.faltan_fechas);
      if (f.check_out.value <= f.check_in.value) return error(ERRORES.salida_antes_de_entrada);
      if (!itemsN.length) return error(ERRORES.falta_alojamiento);
      const p = { cliente_nombre: f.cliente.value.trim(), destino: f.destino.value.trim(), check_in: f.check_in.value, check_out: f.check_out.value,
        habitaciones: habitacionesN, urgente: f.urgente.checked, notas: f.notas.value.trim(), items: itemsN };
      const listo = ocupado(b);
      let r;
      if (editar) r = await rpc('disp_editar', { p_id: s.id, p });
      else r = await rpc('disp_crear', { p: { ...p, canal: canalIn || (cotizacion ? 'cotizacion' : lead ? 'lead' : 'crm'), lead_id: leadSel?.id || null, cotizacion_id: cotizacion || null } });
      if (!r) return listo();
      if (editar) { ok(r.reabiertos ? 'Guardado: el admin vuelve a consultar' : 'Guardado'); }
      else ok(r.fuera_horario && !p.urgente ? 'Enviada. Llegó fuera de horario: se atenderá desde las 7:00' : `Enviada · puesto ${r.puesto} en la cola`);
      await refrescar(editar ? s.id : r.solicitud_id); listo();
    });
    setTimeout(() => f.querySelector(alos[0]?.alojamiento ? '[name="check_in"]' : '[data-a="alojamiento"]')?.focus(), 50);
  }

  return { cargar, vigilar, pedir, abrir };
}
