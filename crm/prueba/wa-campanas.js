// Campañas de plantillas por WhatsApp (Plan 5 v2 F3), solo admin. Se abre desde la bandeja de
// WhatsApp. Crear una campaña NO envía nada: queda en borrador con la lista congelada; solo
// «Aprobar y enviar» (con el costo a la vista) la pone en marcha. CSS propio mínimo (prefijo wc-).
const CANALES = ['Instagram', 'Facebook', 'Ambos', 'WhatsApp', 'Página Web'];
const MOTIVOS = {
  prueba: 'Contactos de prueba',
  baja: 'Pidieron no recibir mensajes',
  compra: 'Ya compraron o pagaron',
  numero_equivocado_o_no_interesa: 'Número equivocado o no les interesa',
  en_cola_de_asesor: 'Tienen una tarea abierta con un asesor',
  contactado_hace_menos_de_7_dias: 'Contactados hace menos de 7 días',
  fuera_de_segmento: 'Fuera del filtro (antigüedad o canal)',
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
.wc-res{border:1px solid var(--line);border-radius:10px;padding:10px;font-size:13px;display:flex;flex-direction:column;gap:4px}
.wc-camp{border:1px solid var(--line);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px}
.wc-camp-top{display:flex;gap:8px;align-items:center}.wc-camp-top b{flex:1}
.wc-num{display:flex;gap:12px;flex-wrap:wrap;font-size:12.5px;color:var(--muted)}.wc-num b{color:var(--txt)}
.wc-acc{display:flex;gap:6px;flex-wrap:wrap}
.wc-pl{font-size:12.5px;color:var(--muted);white-space:pre-wrap}
`;

export function crearCampanasWa({ sb, esc, ok, error }) {
  let fondo = null;
  let cuentas = [];
  let asesores = [];
  let plantillas = [];
  let preview = null;
  let vista = 'lista';
  const $ = id => document.getElementById(id);
  const usd = n => '$' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      <div class="wc-cab"><h3><i class="fa-brands fa-whatsapp"></i> Campañas de WhatsApp</h3>
        <div class="wc-tabs"><button class="btn-sm${vista === 'lista' ? ' on' : ''}" data-wc-vista="lista">Campañas</button>
        <button class="btn-sm${vista === 'nueva' ? ' on' : ''}" data-wc-vista="nueva">Nueva</button></div>
        <button class="btn-sm" data-wc-cerrar title="Cerrar"><i class="fas fa-xmark"></i></button></div>${html}`;
  }

  async function pintarLista() {
    vista = 'lista';
    marco('<div class="msg-empty"><i class="fas fa-spinner fa-spin"></i></div>');
    const { data, error: e } = await sb.rpc('wa_campana_panel');
    if (e) { marco(`<div class="msg-empty">No se pudo cargar: ${esc(e.message)}</div>`); return; }
    const cards = (data || []).map(c => `
      <div class="wc-camp" data-wc-id="${c.id}">
        <div class="wc-camp-top"><b>${esc(c.nombre)}</b><span class="bt-tag">${ESTADOS[c.estado] || c.estado}</span></div>
        <div class="wc-pl">Plantilla ${esc(c.plantilla)} · ${c.total} contactos</div>
        <div class="wc-num"><span>Pendientes <b>${c.pendientes}</b></span><span>Enviados <b>${c.enviados}</b></span><span>Entregados <b>${c.entregados}</b></span>
          <span>Leídos <b>${c.leidos}</b></span><span>Respondieron <b>${c.respondieron}</b></span><span>Bajas <b>${c.bajas}</b></span>
          <span>Fallidos <b>${c.fallidos}</b></span><span>Cotizaciones <b>${c.cotizaciones}</b></span><span>Pagos <b>${c.pagos}</b></span>
          <span>Costo est. <b>${usd(c.costo_estimado_usd)}</b></span></div>
        <div class="wc-acc">
          ${c.estado === 'borrador' ? `<button class="btn-sm lt-primario" data-wc-acc="enviando" data-n="${c.pendientes}" data-tarifa="${c.tarifa_usd ?? 0.074}">Aprobar y enviar</button>` : ''}
          ${c.estado === 'enviando' ? '<button class="btn-sm" data-wc-acc="pausada">Pausar</button>' : ''}
          ${c.estado === 'pausada' ? '<button class="btn-sm lt-primario" data-wc-acc="enviando" data-n="0">Reanudar</button>' : ''}
          ${['borrador', 'enviando', 'pausada'].includes(c.estado) ? '<button class="btn-sm" data-wc-acc="cancelada">Cancelar</button>' : ''}
        </div>
      </div>`).join('');
    marco(cards || '<div class="msg-empty">Todavía no hay campañas</div>');
  }

  async function cambiarEstado(id, estado, total, tarifa) {
    if (estado === 'enviando' && Number(total) > 0) {
      if (!confirm(`Se enviará la plantilla a ${total} contactos reales (costo aprox. ${usd(total * Number(tarifa || 0.074))}), hasta el tope diario. ¿Aprobar y enviar?`)) return;
    }
    if (estado === 'cancelada' && !confirm('¿Cancelar la campaña? Los envíos pendientes no saldrán.')) return;
    const { data, error: e } = await sb.rpc('wa_campana_estado', { p_id: id, p_estado: estado });
    if (e || !data?.ok) { error(e?.message || 'No se pudo cambiar el estado'); return; }
    ok('Campaña ' + (ESTADOS[estado] || estado).toLowerCase());
    pintarLista();
  }

  async function pintarNueva() {
    vista = 'nueva';
    preview = null;
    marco('<div class="msg-empty"><i class="fas fa-spinner fa-spin"></i></div>');
    await cargarBase();
    if (!cuentas.length) { marco('<div class="msg-empty">No hay un número de WhatsApp conectado todavía</div>'); return; }
    marco(`
      <label class="wc-campo">Nombre de la campaña<input id="wc-nombre" maxlength="80" placeholder="Ola 0 · preventa fin de año"></label>
      <div class="wc-fila">
        <label class="wc-campo">Número<select id="wc-cuenta">${cuentas.map(c => `<option value="${esc(c.phone_number_id)}">${esc(c.etiqueta || c.numero || c.phone_number_id)}</option>`).join('')}</select></label>
        <label class="wc-campo">Plantilla aprobada<select id="wc-plantilla"><option value="">Cargando…</option></select></label>
      </div>
      <div class="wc-pl" id="wc-pl-cuerpo"></div>
      <div id="wc-vars" class="wc-fila"></div>
      <div class="wc-fila">
        <label class="wc-campo">Leads de los últimos (días)<input id="wc-dias" type="number" min="1" max="1500" value="90"></label>
        <label class="wc-campo">Máximo de contactos<input id="wc-limite" type="number" min="1" max="5000" value="500"></label>
      </div>
      <div class="wc-campo">Canales<div class="wc-chips">${CANALES.map(c => `<label><input type="checkbox" data-wc-canal="${esc(c)}"${c === 'WhatsApp' || c === 'Ambos' ? ' checked' : ''}> ${esc(c)}</label>`).join('')}</div></div>
      <div class="wc-campo">Asesores que atienden las respuestas (rotación)<div class="wc-chips">${asesores.map(a => `<label><input type="checkbox" data-wc-asesor="${esc(a)}"> ${esc(a)}</label>`).join('')}</div></div>
      <div class="wc-acc"><button class="btn-sm" id="wc-calcular">Calcular alcance y costo</button></div>
      <div id="wc-resultado"></div>`);
    cargarPlantillas();
  }

  async function cargarPlantillas() {
    const sel = $('wc-plantilla');
    const { data, error: e } = await sb.functions.invoke('whatsapp-enviar?accion=plantillas', { body: { phone_number_id: $('wc-cuenta').value } });
    if (!sel) return;
    if (e || !data?.ok) { sel.innerHTML = '<option value="">No se pudieron leer las plantillas</option>'; plantillas = []; return; }
    plantillas = (data.plantillas || []).filter(p => p.categoria === 'MARKETING' || p.categoria === 'UTILITY');
    sel.innerHTML = plantillas.length
      ? '<option value="">Elegir plantilla…</option>' + plantillas.map((p, i) => `<option value="${i}">${esc(p.nombre)} (${esc(p.idioma)} · ${esc(p.categoria)})</option>`).join('')
      : '<option value="">No hay plantillas aprobadas todavía</option>';
  }

  const plantillaElegida = () => { const v = $('wc-plantilla')?.value; return v ? plantillas[Number(v)] : null; };

  function pintarVars() {
    const p = plantillaElegida();
    $('wc-pl-cuerpo').textContent = p ? p.cuerpo : '';
    $('wc-vars').innerHTML = p ? Array.from({ length: p.variables }, (_, i) =>
      `<label class="wc-campo">Valor de {{${i + 1}}} (usa {{nombre}} para el primer nombre)<input type="text" data-wc-var="${i}" maxlength="200"${i === 0 ? ' value="{{nombre}}"' : ''}></label>`).join('') : '';
  }

  const segmento = () => ({
    dias: Number($('wc-dias').value) || 90,
    limite: Number($('wc-limite').value) || 500,
    canales: [...document.querySelectorAll('[data-wc-canal]:checked')].map(x => x.dataset.wcCanal),
  });

  async function calcular() {
    if (!segmento().canales.length) { error('Elige al menos un canal'); return; }
    $('wc-resultado').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    const { data, error: e } = await sb.rpc('wa_campana_preview', { p_segmento: segmento() });
    if (e) { $('wc-resultado').textContent = 'No se pudo calcular: ' + e.message; return; }
    preview = data;
    const ex = Object.entries(data.excluidos || {}).map(([k, n]) => `<div>${esc(MOTIVOS[k] || k)}: <b>${n}</b></div>`).join('');
    $('wc-resultado').innerHTML = `<div class="wc-res">
      <div>Teléfonos móviles de Venezuela en la base: <b>${data.telefonos_ve}</b></div>
      <div>Elegibles: <b>${data.elegibles}</b> · se enviarían <b>${data.a_enviar}</b> (los más recientes)</div>
      <div>Costo aproximado: <b>${usd(data.costo_usd)}</b> (${usd(data.tarifa_usd)} por mensaje)</div>
      ${ex ? `<div style="margin-top:6px;color:var(--muted)">Excluidos:</div>${ex}` : ''}
      <div class="wc-acc" style="margin-top:8px"><button class="btn-sm lt-primario" id="wc-crear"${data.a_enviar ? '' : ' disabled'}>Crear borrador (no envía nada)</button></div></div>`;
  }

  async function crear() {
    const p = plantillaElegida();
    const nombre = $('wc-nombre').value.trim();
    if (!nombre || !p) { error('Falta el nombre o la plantilla'); return; }
    if (!segmento().canales.length) { error('Elige al menos un canal'); return; }
    const variables = [...document.querySelectorAll('[data-wc-var]')].map(el => el.value.trim());
    if (variables.some(v => !v)) { error('Completa todas las variables'); return; }
    const asesoresSel = [...document.querySelectorAll('[data-wc-asesor]:checked')].map(x => x.dataset.wcAsesor);
    $('wc-crear').disabled = true;
    const { data, error: e } = await sb.rpc('wa_campana_crear', {
      p_nombre: nombre, p_phone_number_id: $('wc-cuenta').value, p_plantilla: p.nombre, p_idioma: p.idioma,
      p_variables: variables, p_segmento: segmento(), p_asesores: asesoresSel,
    });
    if (e || !data?.ok) { error(e?.message || data?.error || 'No se pudo crear'); $('wc-crear').disabled = false; return; }
    ok(`Borrador creado con ${data.envios} contactos`);
    pintarLista();
  }

  function cerrar() { fondo?.remove(); fondo = null; }

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
