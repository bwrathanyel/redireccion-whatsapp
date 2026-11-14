// Abonos de una reserva: lista + alta + edición + eliminación.
// Vive aparte de app.js (mismo patrón que documentos-revisiones.js) porque app.js
// ya está en 30k líneas y la UI de abonos tiene su propio ciclo de vida.
// La tabla reserva_abonos no tiene grants: todo pasa por las RPC.
const ERRORES = {
  reserva_no_disponible: 'La reserva no está disponible.',
  lead_fuera_de_ventas: 'El lead tiene que estar en Pago realizado o Venta completa para cobrar un abono.',
  supera_saldo: 'El abono supera el saldo pendiente de la reserva.',
  monto_invalido: 'Escribe un monto mayor a cero, con dos decimales como máximo.',
  moneda_invalida: 'Elige la moneda del pago.',
  metodo_invalido: 'Elige el método de pago.',
  referencia_requerida: 'Escribe la referencia o sube la captura del comprobante.',
  captura_requerida: 'Sube la captura del comprobante del pago (o elige Efectivo si no hay comprobante).',
  referencia_invalida: 'La referencia es demasiado larga.',
  nota_demasiado_larga: 'La nota es demasiado larga.',
  tasa_no_disponible: 'No hay tasa cargada para esa opción: elige otra tasa o registra el abono en dólares.',
  tasa_tipo_invalida: 'Elige la tasa del cobro: BCV dólar, BCV euro o USDT.',
  comprobante_path_invalido: 'La captura no quedó guardada en tu carpeta. Vuelve a subirla.',
  solicitud_requerida: 'No se pudo identificar la operación. Cierra el formulario y reintenta.',
  solicitud_con_otros_datos: 'Esa operación ya se registró con otros datos. Recarga la reserva y verifica.',
  abono_anulado: 'Ese abono está anulado: no se edita, se elimina.',
  fecha_invalida: 'La fecha del abono no puede ser futura.',
  tasa_invalida: 'Escribe una tasa mayor a cero.',
  abono_respaldo_no_anulable: 'El saldo anterior es el acumulado que ya tenía la reserva: no se elimina, edítalo con los datos del pago.',
  abono_no_encontrado: 'El abono no existe.',
  motivo_requerido: 'Explica el motivo con al menos 4 caracteres.',
  motivo_demasiado_largo: 'El motivo es demasiado largo.',
  saldo_incompatible: 'Anular dejaría el acumulado en negativo.',
  conflicto_revision: 'Otro usuario guardó una revisión del voucher. Recarga la reserva y reintenta.',
  documento_anulado: 'El voucher está anulado: no se le puede agregar el abono.',
  sincronizar_solo_pago: 'El voucher cambió de total: esto es una corrección, no un abono. Revísalo desde Voucher.',
  sincronizar_baja_pago: 'El voucher ya declara más cobrado que la reserva. Revísalo desde Voucher.',
  montos_invalidos: 'El voucher quedaría con más pagado que su total. Revísalo desde Voucher.',
  fechas_invalidas: 'El voucher tiene la salida antes de la entrada. Corrígelo desde Voucher.',
  nombre_requerido: 'El voucher no tiene nombre de cliente. Corrígelo desde Voucher.',
  selecciona_servicio: 'La reserva tiene varios servicios y ninguno es hospedaje: actualiza el voucher desde Voucher.',
  voucher_pendiente_confirmacion: 'El voucher todavía no está confirmado como venta.',
  pago_movil_en_bs: 'El Pago móvil se registra en bolívares: elige VES (puedes escribir el monto en dólares y se calcula en Bs).',
  sin_librerias: 'No cargaron las herramientas de PDF. Recarga la página y toca «Reintentar documentos».',
  voucher_no_leido: 'No se pudo leer el voucher de la reserva. Toca «Reintentar documentos».',
  servicio_invalido: 'Ese servicio ya no está en la reserva. Recarga la reserva y elige otro.',
  posible_duplicado: 'Ya hay un pago con ese monto y esa referencia en las últimas 48 horas.',
  orden_desactualizado: 'Los abonos cambiaron mientras los ordenabas: se recargó la lista, vuelve a ordenarlos.',
  abono_no_pendiente: 'Ese abono ya no está por verificar: otra persona lo resolvió. Recarga.',
  datos_invalidos: 'Faltan datos para verificar el abono.',
  abono_verificado: 'Ese abono ya fue verificado por administración: pídele a administración que corrija el monto, el método o la referencia.',
};
// Finanzas Fase 1: aprobar o rechazar un abono por verificar. También lo usa el tablero de Pagos (app.js).
export async function verificarAbono(sb, id, aprobar, motivo = null) {
  const { data, error } = await sb.rpc('finanzas_abono_verificar', { p_abono_id: id, p_aprobar: aprobar, p_motivo: motivo });
  if (error) throw new Error(error.code === '42501' ? 'Solo administración verifica abonos.' : error.message);
  if (!data?.ok) throw new Error(ERRORES[data?.error] || data?.error || 'Sin respuesta del servidor');
  return data;
}
const TIPO_SERV = { hospedaje: 'Hospedaje', boleto_aereo: 'Boleto aéreo', traslado_terrestre: 'Traslado', full_day: 'Full day', seguro: 'Seguro', otro: 'Otro' };
// El abono en Bs se cobra a la tasa que se elija (pedido del dueño 30-oct); USDT es Binance P2P.
const TASAS = { USD: 'BCV dólar', EUR: 'BCV euro', USDT: 'USDT' };
const METODOS = ['Pago móvil', 'Zelle', 'Efectivo', 'Transferencia', 'TDC', 'Binance'];
const CSS = `
.ab-top{display:flex;flex-wrap:wrap;gap:7px;align-items:stretch;margin:0 0 14px}
.ab-kpi{flex:1 1 92px;min-width:92px;padding:9px 11px;border:1px solid var(--line2);border-radius:10px;background:var(--panel)}
.ab-kpi span{display:block;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.ab-kpi b{font-size:14px;font-weight:800;color:var(--txt)}
.ab-kpi.ab-saldo b{color:var(--accent-ink)}
.ab-nuevo{flex:0 0 auto;min-height:44px}
.ab-form{margin:0 0 14px;padding:14px;border:1px solid var(--line2);border-radius:12px;background:var(--panel)}
.ab-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.ab-tasa{margin:9px 0 0;padding:9px 11px;border-radius:10px;background:var(--accent-soft);color:var(--accent-txt);font-size:11px}
.ab-tasa b{color:var(--txt)}
.ab-tasa .ab-chips{margin:0 0 7px}
.ab-tasa-fecha{color:var(--muted)}
.ab-tasa .ab-grid{margin-top:4px}
.ab-chips{display:flex;flex-wrap:wrap;gap:7px;margin:7px 0 0}
.ab-chip{min-height:44px;padding:0 14px;border:1px solid var(--line2);border-radius:999px;background:transparent;color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;transition:all var(--dur-rapida) var(--ease-salida)}
.ab-chip:hover{color:var(--txt);border-color:var(--line2)}
.ab-chip.on{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.ab-acciones{display:flex;flex-wrap:wrap;gap:9px;margin:14px 0 0}
.ab-acciones .dbtn{margin:0}
.ab-lista{display:flex;flex-direction:column;gap:9px;margin:0;padding:0;list-style:none}
.ab-fila{padding:11px 14px;border:1px solid var(--line2);border-radius:10px;background:var(--panel)}
.ab-fila-top{display:flex;flex-wrap:wrap;gap:7px;align-items:baseline}
.ab-fila-top b{font-size:14px;font-weight:800}
.ab-origen{font-size:11px;color:var(--muted)}
.ab-tag{padding:2px 9px;border-radius:999px;border:1px solid var(--line2);font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.ab-tag.ab-respaldo{color:var(--amber);border-color:var(--amber)}
.ab-tag.ab-anulada-tag{color:var(--danger);border-color:var(--danger)}
.ab-tag.ab-pend-tag{color:var(--amber);border-color:var(--amber)}
.ab-fila.ab-rechazada{opacity:.75}
.ab-fila-sub{margin:4px 0 0;font-size:11px;color:var(--muted)}
.ab-fila.ab-anulada{opacity:.72}
.ab-anular{margin:7px 0 0;padding:0;border:0;background:none;color:var(--danger);font-size:11px;font-weight:700;cursor:pointer}
.ab-aviso{margin:0 0 14px;padding:9px 11px;border:1px solid var(--amber);border-radius:10px;font-size:11px;color:var(--txt)}
.ab-err{margin:11px 0 0;font-size:11px;color:var(--danger);min-height:0}
.ab-ia{margin:7px 0 0;font-size:11.5px;color:var(--muted)}
.ab-vacia{padding:14px;border:1px dashed var(--line2);border-radius:10px;font-size:12px;color:var(--muted)}
.ab-fila-acc{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:7px}
.ab-mini{font-size:10px;font-weight:700;padding:4px 8px;border-radius:7px;border:1px solid var(--line2);background:var(--panel);color:var(--ink);cursor:pointer}
.ab-mini:hover{border-color:var(--brand)}
.ab-mini i{margin-right:3px}
.ab-docs{font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:3px 7px;border-radius:6px;background:#fdf3e6;color:#a56a12}
.ab-docs.fallo{background:#fdeceb;color:#a72b1f}
.ab-orden-tit{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 10px;margin:0 0 7px;font-size:11px;color:var(--muted)}
.ab-orden-tit b{font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.ab-lista + .ab-lista,.ab-orden-pie + .ab-lista{margin-top:9px}
.ab-orden-pie{position:sticky;bottom:0;z-index:3;align-items:center;margin:9px 0 0;padding:9px 11px;border:1px solid var(--accent);border-radius:10px;background:var(--panel)}
.ab-orden-pie span{flex:1 1 100%;font-size:11px;font-weight:700;color:var(--accent-ink)}
.ab-fila.ab-mov{display:flex;gap:9px;align-items:flex-start;position:relative}
.ab-cuerpo{flex:1;min-width:0}
.ab-asa{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:34px;padding:4px 0;border:1px solid var(--line2);border-radius:8px;background:transparent;color:var(--muted);cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
.ab-asa:hover,.ab-asa:focus-visible{color:var(--txt);border-color:var(--accent)}
.ab-asa b{font-size:12px;font-weight:800;color:var(--txt)}
.ab-asa i{font-size:11px}
.ab-asa:disabled{cursor:default;opacity:.6}
.ab-pos{flex:0 0 auto;min-width:34px;padding:4px 0;text-align:center;font-size:12px;font-weight:800;border:1px solid var(--line2);border-radius:8px}
.ab-acum{margin:4px 0 0;font-size:11px;color:var(--txt)}
.ab-acum span{color:var(--muted)}
.ab-fila.ab-arrastrando{z-index:2;border-color:var(--accent);box-shadow:0 10px 24px rgba(0,0,0,.18);cursor:grabbing}
.ab-fila.ab-arrastrando .ab-asa{cursor:grabbing;color:var(--accent-ink);border-color:var(--accent)}
@media (max-width:420px){.ab-grid{grid-template-columns:1fr}}
@media (max-width:760px){.ab-asa{min-width:44px;min-height:44px;justify-content:center}}
@media (max-width:760px){.ab-fila-acc{gap:12px}.ab-mini,.ab-anular{min-height:44px;padding:0 14px;font-size:13px;display:inline-flex;align-items:center}.ab-anular{border:1px solid color-mix(in srgb,var(--danger) 45%,transparent);border-radius:7px}}
`;

export function crearAbonos(c) {
  const { sb, esc } = c;
  const usd = n => '$' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (n, d = 2) => Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const mensaje = e => ERRORES[e?.message || e] || (e?.message || e) || 'No se pudo completar la operación';
  const panel = () => document.querySelector('[data-rv-panel="abonos"]');
  const miUid = () => String(c.usuario() || '');
  const nombreServ = s => `${TIPO_SERV[s.tipo] || s.tipo}${s.descripcion ? ' · ' + s.descripcion : ''}`;
  // Regla del dueño: los abonos son del hospedaje y los boletos se pagan de contado.
  const tasaDe = (d, t) => Number(d?.tasas?.[t]?.tasa || (t === 'USD' ? d?.tasa_ves : 0) || 0);
  const nombreTasa = t => TASAS[t] || 'BCV dólar';
  const diaIso = f => new Date(f || Date.now()).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
  const hospUnico = d => { const h = (d?.servicios || []).filter(s => s.tipo === 'hospedaje'); return h.length === 1 ? Number(h[0].id) : null; };
  const diaCorto = f => String(f || '').slice(0, 10).split('-').reverse().join('/');
  // Pago de un día anterior: la tasa de ese día (RPC tasas_del_dia), no la de hoy (pedido del dueño 7-nov).
  const tasaForm = t => Number(est.tasasFecha?.[t]?.tasa || 0) || tasaDe(est.datos, t);
  async function tasasDelDia(f) {
    if (!f || f >= diaIso(new Date())) return null;
    const { data, error } = await sb.rpc('tasas_del_dia', { p_fecha: f });
    return error || !data ? null : data;
  }
  // Finanzas Fase 1: solo lo verificado suma al pagado y entra al voucher. Lo por verificar sí ocupa saldo.
  const cuenta = a => !a.anulado_en && (a.estado || 'verificado') === 'verificado';
  const ocupa = a => !a.anulado_en && a.estado !== 'rechazado';
  const oficina = () => !!c.oficina?.();
  let est = { reservaId: null, datos: null, token: 0, tokenIA: 0, tokenFecha: 0, metodo: '', moneda: 'USD', tasaTipo: 'USD', archivo: null, guardando: false, formAbierto: false, tasasFecha: null };

  function inyectarCss() {
    if (document.getElementById('ab-css')) return;
    const s = document.createElement('style'); s.id = 'ab-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function asentar() {
    inyectarCss();
    const p = panel(); if (!p) return false;
    p.onclick = e => {
      const b = e.target.closest('[data-ab-accion]'); if (!b) return;
      const a = b.dataset.abAccion;
      if (!['metodo', 'tasa', 'cerrar'].includes(a)) c.usoBoton?.('ab:' + a, est.reservaId);
      if (a === 'nuevo') abrirForm();
      else if (a === 'cerrar') { est.archivo = null; est.formAbierto = false; est.editando = null; est.tasasFecha = null; pintar(); }
      else if (a === 'guardar') guardar(b);
      else if (a === 'guardar-orden') guardarOrden(b);
      else if (a === 'deshacer-orden') deshacerOrden();
      else if (a === 'eliminar') eliminar(Number(b.dataset.id));
      else if (a === 'editar') abrirForm(Number(b.dataset.id));
      else if (a === 'recibo') verRecibo(b.dataset.id, b);
      else if (a === 'comprobante') verComprobante(b.dataset.path, b);
      else if (a === 'reintentar') reintentarDocumentos(Number(b.dataset.id), b);
      else if (a === 'verificar' || a === 'rechazar') verificar(Number(b.dataset.id), a === 'verificar', b);
      else if (a === 'metodo') {
        // Sin repintar: pintar() recrea el formulario y borraría lo ya escrito.
        est.metodo = b.dataset.metodo;
        p.querySelectorAll('[data-ab-accion="metodo"]').forEach(x => x.classList.toggle('on', x.dataset.metodo === est.metodo));
        const mon = document.getElementById('ab-moneda');
        if (est.metodo === 'Pago móvil' && mon) { if (mon.value !== 'VES') est.fuente = 'USD'; mon.value = 'VES'; est.moneda = 'VES'; actualizarTasa(); }
        // Los métodos en divisas cobran en dólares: pasar a USD (pedido del dueño 4-nov).
        else if (['Zelle', 'Binance'].includes(est.metodo) && mon && mon.value !== 'USD') { mon.value = 'USD'; est.moneda = 'USD'; actualizarTasa(); }
      }
      else if (a === 'tasa') {
        est.tasaTipo = b.dataset.tasa;
        const man = document.getElementById('ab-tasa-manual'), ed = est.editando;
        if (man) man.value = ed?.moneda === 'VES' && ed.tasa_tipo === est.tasaTipo && !est.tasasFecha ? ed.tasa_usd_ves : tasaForm(est.tasaTipo) || '';
        p.querySelectorAll('[data-ab-accion="tasa"]').forEach(x => x.classList.toggle('on', x.dataset.tasa === est.tasaTipo));
        actualizarTasa();
      }
    };
    p.onpointerdown = arrastrar;
    p.onkeydown = moverConTeclado;
    // Pago en Bs: el monto se escribe en dólares o en bolívares y el otro se calcula con la tasa
    // (pedido del dueño 13-nov). `est.fuente` = el último que escribieron; ese no se recalcula.
    p.oninput = e => {
      const id = e.target.id;
      if (id === 'ab-monto') est.fuente = 'USD';
      else if (id === 'ab-monto-bs') est.fuente = 'VES';
      else if (id === 'ab-moneda') { est.fuente = 'USD'; est.moneda = e.target.value; }
      if (['ab-monto', 'ab-monto-bs', 'ab-moneda', 'ab-tasa-manual'].includes(id)) actualizarTasa();
    };
    p.onchange = e => {
      if (e.target.id === 'ab-file') { est.archivo = e.target.files?.[0] || null; if (est.archivo) leerComprobante(est.archivo); }
      else if (e.target.id === 'ab-fecha') cambiarFecha(e.target.value);
    };
    return true;
  }
  function kpis(d) {
    return `<div class="ab-top">
      <div class="ab-kpi"><span>Total</span><b>${usd(d.monto_total)}</b></div>
      <div class="ab-kpi"><span>Pagado</span><b>${usd(d.monto_pagado)}</b></div>
      ${Number(d.monto_por_verificar) > 0 ? `<div class="ab-kpi" title="Cargado por el asesor: suma al pagado cuando administración lo verifique"><span>Por verificar</span><b>${usd(d.monto_por_verificar)}</b></div>` : ''}
      <div class="ab-kpi ab-saldo"><span>${Number(d.monto_pagado) > Number(d.monto_total) ? 'Saldo a favor' : 'Saldo'}</span><b>${usd(Math.abs(Number(d.monto_total) - Number(d.monto_pagado)))}</b></div>
      <button class="dbtn save ab-nuevo" type="button" data-ab-accion="nuevo"><i class="fas fa-plus"></i> Abono</button>
    </div>`;
  }
  function avisoCuadre(d) {
    const dif = Number(d.monto_pagado || 0) - Number(d.pagado_con_detalle || 0);
    if (Math.abs(dif) < 0.005) return '';
    return `<p class="ab-aviso">Hay ${usd(dif)} cobrados sin detalle de pago${(d.abonos || []).length ? '' : '. El próximo abono los agrupa como «Saldo anterior»'}.</p>`;
  }
  function formHtml(d) {
    const chips = METODOS.map(m => `<button class="ab-chip ${m === est.metodo ? 'on' : ''}" type="button" data-ab-accion="metodo" data-metodo="${esc(m)}">${esc(m)}</button>`).join('');
    const servs = d.servicios || [], hosp = hospUnico(d), ed = est.editando;
    const elegido = ed ? Number(ed.servicio_id || 0) : hosp;
    const servicio = servs.length > 1 ? `<label class="fl" for="ab-servicio">Servicio que paga</label><select class="ei" id="ab-servicio">
        ${hosp && !ed ? '' : '<option value="">Toda la reserva</option>'}${servs.map(s => `<option value="${s.id}"${Number(s.id) === elegido ? ' selected' : ''}>${esc(nombreServ(s))} · ${usd(s.precio_usd)}</option>`).join('')}</select>` : '';
    return `<div class="ab-form">
      ${ed ? `<p class="ab-fila-sub">Editando el abono de ${usd(ed.monto_usd)} del ${esc(c.fecha(ed.fecha))}. El recibo se vuelve a generar.</p>` : ''}
      <div class="ab-grid">
        <div><label class="fl" for="ab-monto">Monto en dólares</label><input class="ei" id="ab-monto" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00" value="${ed ? esc(ed.moneda === 'VES' ? ed.monto_usd : ed.monto_original) : ''}"></div>
        <div><label class="fl" for="ab-moneda">Moneda</label><select class="ei" id="ab-moneda">
          <option value="USD"${est.moneda === 'USD' ? ' selected' : ''}>Dólares (USD)</option>
          <option value="VES"${est.moneda === 'VES' ? ' selected' : ''}>Bolívares (VES)</option></select></div>
      </div>
      <div class="ab-tasa" id="ab-tasa-box" ${est.moneda === 'VES' ? '' : 'hidden'}>
        <div class="ab-chips" role="group" aria-label="Tasa del cobro">${Object.entries(TASAS).map(([t, n]) => `<button class="ab-chip ${t === est.tasaTipo ? 'on' : ''}" type="button" data-ab-accion="tasa" data-tasa="${t}"${tasaForm(t) || ed ? '' : ' disabled title="Sin tasa cargada"'}>${n}</button>`).join('')}</div>
        Tasa <span id="ab-tasa-nombre"></span> <b id="ab-tasa">—</b> Bs/USD <span class="ab-tasa-fecha" id="ab-tasa-fecha"></span>
        <div class="ab-grid">
          <div><label class="fl" for="ab-monto-bs">Monto en bolívares</label><input class="ei" id="ab-monto-bs" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Se calcula del monto en dólares" value="${ed?.moneda === 'VES' ? esc(ed.monto_original) : ''}"></div>
          ${ed ? `<div><label class="fl" for="ab-tasa-manual">Tasa del día del pago (Bs/USD)</label><input class="ei" id="ab-tasa-manual" type="number" min="0" step="0.0001" inputmode="decimal" value="${ed.moneda === 'VES' ? esc(ed.tasa_usd_ves || '') : esc(tasaDe(d, est.tasaTipo) || '')}"></div>` : ''}
        </div></div>
      <label class="fl">Método de pago</label>
      <div class="ab-chips">${chips}</div>
      ${servicio}
      <label class="fl" for="ab-ref">Referencia</label><input class="ei" id="ab-ref" maxlength="120" placeholder="Número de operación" value="${ed ? esc(ed.referencia || '') : ''}">
      <label class="fl" for="ab-fecha">Fecha del pago</label><input class="ei" id="ab-fecha" type="date" min="2020-01-01" max="${diaIso(new Date())}" value="${ed ? diaIso(ed.fecha) : diaIso(new Date())}">
      <label class="fl" for="ab-nota">Nota (opcional)</label><textarea class="ei" id="ab-nota" maxlength="2000" rows="2">${ed ? esc(ed.nota || '') : ''}</textarea>
      <label class="fl" for="ab-file">${ed ? (ed.comprobante_path ? 'Leer otro comprobante (llena los datos; se conserva el guardado)' : 'Captura del comprobante (llena los datos y queda guardada)') : 'Captura del comprobante del pago (opcional)'}</label>
      <input class="ei" id="ab-file" type="file" accept="image/jpeg,image/png,image/webp">
      <p class="ab-ia" id="ab-ia" hidden></p>
      <p class="ab-err" id="ab-err"></p>
      <div class="ab-acciones">
        <button class="dbtn save" type="button" data-ab-accion="guardar"><i class="fas fa-floppy-disk"></i> ${ed ? 'Guardar cambios' : 'Registrar abono'}</button>
        <button class="dbtn gh" type="button" data-ab-accion="cerrar">Cancelar</button>
      </div>
    </div>`;
  }
  const btnComprobante = a => a.comprobante_path ? `<button class="ab-mini" type="button" data-ab-accion="comprobante" data-path="${esc(a.comprobante_path)}"><i class="fas fa-receipt"></i>Comprobante</button>` : '';
  // Vigentes con su puesto en el voucher (1°, 2°...) y lo que lleva abonado hasta ese abono.
  // `mover`: se puede arrastrar (más de uno y sin el formulario abierto, que pintar() borraría).
  function filaHtml(a, pos = 0, acum = 0, mover = false) {
    const ref = a.referencia ? ` · ${esc(a.referencia)}` : a.comprobante_path ? ' · captura adjunta' : '';
    const servs = est.datos?.servicios || [];
    const serv = servs.length > 1 && a.servicio_id ? servs.find(s => Number(s.id) === Number(a.servicio_id)) : null;
    const total = Number(est.datos?.monto_total || 0);
    const puesto = !pos ? '' : mover
      ? `<button class="ab-asa" type="button" data-ab-asa aria-label="Abono ${pos}° en el voucher: arrastra o usa las flechas para moverlo" title="Arrastra para cambiar el orden"><b>${pos}°</b><i class="fas fa-grip-lines"></i></button>`
      : `<span class="ab-pos" title="Puesto en el voucher">${pos}°</span>`;
    return `<li class="ab-fila${a.anulado_en ? ' ab-anulada' : a.estado === 'rechazado' ? ' ab-rechazada' : ''}${pos ? ' ab-mov' : ''}" data-id="${a.id}">${puesto}${pos ? '<div class="ab-cuerpo">' : ''}
      <div class="ab-fila-top"><b>${usd(a.monto_usd)}</b>
        <span class="ab-origen">${esc(a.moneda)} ${num(a.monto_original)}${a.moneda === 'VES' && a.tasa_usd_ves ? ` · tasa ${a.tasa_tipo ? nombreTasa(a.tasa_tipo) + ' ' : ''}${num(a.tasa_usd_ves, 4)}` : ''}</span>
        <span class="ab-tag">${esc(a.metodo)}</span>
        ${serv ? `<span class="ab-tag" title="${esc(nombreServ(serv))}">${esc(TIPO_SERV[serv.tipo] || serv.tipo)}</span>` : ''}
        ${/^inicial/i.test(a.nota || '') ? '<span class="ab-tag">Inicial reserva</span>' : ''}
        ${a.respaldo ? '<span class="ab-tag ab-respaldo" title="Lo cobrado antes de que existiera el registro de abonos: no tiene recibo propio">Cobrado antes</span>' : ''}
        ${a.anulado_en ? '<span class="ab-tag ab-anulada-tag">Anulado</span>' : a.estado === 'por_verificar' ? '<span class="ab-tag ab-pend-tag" title="Suma al pagado cuando administración lo verifique">Por verificar</span>' : a.estado === 'rechazado' ? '<span class="ab-tag ab-anulada-tag">Rechazado</span>' : ''}
      </div>
      <p class="ab-fila-sub">${esc(c.fecha(a.fecha))}${ref}${a.asesor ? ' · ' + esc(a.asesor) : ''}</p>
      ${pos ? `<p class="ab-acum">Lleva abonado <b>${usd(acum)}</b> <span>de ${usd(total)} · resta ${usd(Math.max(0, total - acum))}</span></p>` : ''}
      ${a.anulado_en ? `<p class="ab-fila-sub">Anulado: ${esc(a.anulado_motivo || 'sin motivo')}</p>
        <div class="ab-fila-acc"><button class="ab-anular" type="button" data-ab-accion="eliminar" data-id="${a.id}">Eliminar abono</button></div>`
        : a.estado === 'por_verificar' || a.estado === 'rechazado' ? `${a.estado === 'rechazado' ? `<p class="ab-fila-sub">Rechazado: ${esc(a.rechazado_motivo || 'sin motivo')}${oficina() ? '' : '. Corrígelo con «Editar» y vuelve a verificación.'}</p>` : ''}
        <div class="ab-fila-acc">
          ${btnComprobante(a)}
          ${a.estado === 'por_verificar' && oficina() ? `<button class="ab-mini" type="button" data-ab-accion="verificar" data-id="${a.id}"><i class="fas fa-check"></i>Verificar</button>
          <button class="ab-mini" type="button" data-ab-accion="rechazar" data-id="${a.id}"><i class="fas fa-xmark"></i>Rechazar</button>` : ''}
          <button class="ab-mini" type="button" data-ab-accion="editar" data-id="${a.id}"><i class="fas fa-pen"></i>Editar</button>
          <button class="ab-anular" type="button" data-ab-accion="eliminar" data-id="${a.id}">Eliminar abono</button>
        </div>`
        : a.respaldo ? `<div class="ab-fila-acc"><button class="ab-mini" type="button" data-ab-accion="editar" data-id="${a.id}"><i class="fas fa-pen"></i>Editar</button>${btnComprobante(a)}</div>` : `<div class="ab-fila-acc">
          ${btnComprobante(a)}
          ${a.recibo_documento_id ? `<button class="ab-mini" type="button" data-ab-accion="recibo" data-id="${a.recibo_documento_id}"><i class="fas fa-file-pdf"></i>Recibo</button>` : ''}
          ${a.documentos_estado && a.documentos_estado !== 'listo' ? `<span class="ab-docs${a.documentos_estado === 'fallido' ? ' fallo' : ''}" title="${esc(a.documentos_error || '')}">${a.documentos_estado === 'fallido' ? 'Documentos con error' : 'Documentos pendientes'}</span>
            <button class="ab-mini" type="button" data-ab-accion="reintentar" data-id="${a.id}"><i class="fas fa-rotate"></i>${a.documentos_estado === 'fallido' ? 'Reintentar documentos' : 'Generar documentos'}</button>` : ''}
          <button class="ab-mini" type="button" data-ab-accion="editar" data-id="${a.id}"><i class="fas fa-pen"></i>Editar</button>
          <button class="ab-anular" type="button" data-ab-accion="eliminar" data-id="${a.id}">Eliminar abono</button>
        </div>`}
    ${pos ? '</div>' : ''}</li>`;
  }
  function pintar() {
    const p = panel(); if (!p || !est.datos) return;
    const d = est.datos, ab = d.abonos || [];
    const vivos = ab.filter(cuenta), anulados = ab.filter(a => !cuenta(a));
    anulados.sort((x, y) => (x.estado === 'por_verificar' && !x.anulado_en ? 0 : 1) - (y.estado === 'por_verificar' && !y.anulado_en ? 0 : 1));
    const mover = vivos.length > 1 && !est.formAbierto && !est.guardando;
    let acum = 0;
    const filas = vivos.map((a, i) => filaHtml(a, i + 1, acum += Number(a.monto_usd || 0), mover)).join('');
    p.innerHTML = kpis(d) + avisoCuadre(d) + (est.formAbierto ? formHtml(d) : '') +
      (ab.length ? (vivos.length ? `<p class="ab-orden-tit"><b>Orden en el voucher</b>${mover ? '<span>Arrastra <i class="fas fa-grip-lines"></i> para cambiarlo</span>' : ''}</p>
        <ul class="ab-lista" data-ab-orden>${filas}</ul>${est.ordenPrevio ? `<div class="ab-acciones ab-orden-pie"><span>Orden sin guardar</span>
          <button class="dbtn save" type="button" data-ab-accion="guardar-orden"><i class="fas fa-floppy-disk"></i> Guardar cambios</button>
          <button class="dbtn gh" type="button" data-ab-accion="deshacer-orden">Deshacer</button></div>` : ''}` : '') + (anulados.length ? `<ul class="ab-lista">${anulados.map(a => filaHtml(a)).join('')}</ul>` : '')
        : '<p class="ab-vacia">Todavía no hay abonos registrados en esta reserva.</p>');
    if (est.formAbierto) actualizarTasa();
  }
  // Orden del voucher: se arrastra por el asa (puntero o dedo) o con flechas del teclado, y se guarda al soltar.
  const idsLista = ul => [...ul.querySelectorAll(':scope > .ab-mov')].map(x => x.dataset.id);
  const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function flip(els, cambio) {
    const antes = new Map(els.map(x => [x, x.getBoundingClientRect().top]));
    cambio();
    if (sinMovimiento()) return;
    els.forEach(x => { const dy = antes.get(x) - x.getBoundingClientRect().top; if (dy) x.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 160, easing: 'ease-out' }); });
  }
  function arrastrar(e) {
    const asa = e.target.closest('[data-ab-asa]');
    if (!asa || asa.disabled || e.button > 0 || est.ordenando) return;
    const li = asa.closest('.ab-mov'), ul = li?.parentElement; if (!ul) return;
    e.preventDefault();
    asa.setPointerCapture?.(e.pointerId);
    const antes = idsLista(ul), agarre = e.clientY - li.getBoundingClientRect().top;
    li.classList.add('ab-arrastrando');
    const seguir = y => { li.style.transform = ''; li.style.transform = `translateY(${y - agarre - li.getBoundingClientRect().top}px)`; };
    // En window y no en el asa: mover el <li> en el DOM suelta la captura del puntero y el pointerup
    // no llegaba al asa (el orden nunca se guardaba, reporte del dueño 13-nov).
    const mover = ev => {
      const otros = [...ul.querySelectorAll(':scope > .ab-mov')].filter(x => x !== li);
      const sig = otros.find(x => { const r = x.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; }) || null;
      if (li.nextElementSibling !== sig && !(sig === null && !li.nextElementSibling)) flip(otros, () => ul.insertBefore(li, sig));
      seguir(ev.clientY);
    };
    const soltar = () => {
      removeEventListener('pointermove', mover); removeEventListener('pointerup', soltar); removeEventListener('pointercancel', soltar);
      const dy = li.style.transform;
      li.style.transform = '';
      li.classList.remove('ab-arrastrando');
      if (dy && !sinMovimiento()) li.animate([{ transform: dy }, { transform: 'none' }], { duration: 140, easing: 'ease-out' });
      fijarOrden(antes, idsLista(ul));
    };
    addEventListener('pointermove', mover); addEventListener('pointerup', soltar); addEventListener('pointercancel', soltar);
  }
  function moverConTeclado(e) {
    const asa = e.target.closest('[data-ab-asa]');
    if (!asa || !['ArrowUp', 'ArrowDown'].includes(e.key) || est.ordenando) return;
    const li = asa.closest('.ab-mov'), ul = li.parentElement, antes = idsLista(ul);
    const otro = e.key === 'ArrowUp' ? li.previousElementSibling : li.nextElementSibling;
    if (!otro?.classList.contains('ab-mov')) return;
    e.preventDefault();
    if (e.key === 'ArrowUp') ul.insertBefore(li, otro); else otro.after(li);
    fijarOrden(antes, idsLista(ul), li.dataset.id);
  }
  // Mover solo cambia la lista en pantalla; «Guardar orden» lo manda al servidor (pedido del dueño 13-nov).
  function fijarOrden(antes, nuevo, foco = null) {
    if (antes.join() === nuevo.join()) return;
    const d = est.datos, previo = d.abonos || [], porId = new Map(previo.map(a => [String(a.id), a]));
    est.ordenPrevio = est.ordenPrevio || previo;
    d.abonos = [...nuevo.map(id => porId.get(id)), ...previo.filter(a => !cuenta(a))];
    pintar();
    if (foco) panel()?.querySelector(`.ab-mov[data-id="${foco}"] [data-ab-asa]`)?.focus();
  }
  function deshacerOrden() {
    if (!est.ordenPrevio || !est.datos) return;
    est.datos.abonos = est.ordenPrevio; est.ordenPrevio = null; pintar();
  }
  async function guardarOrden(btn) {
    const d = est.datos;
    if (!est.ordenPrevio || !d || est.ordenando) return;
    const ids = (d.abonos || []).filter(cuenta).map(a => Number(a.id));
    est.ordenando = true; btn.disabled = true;
    const { data, error } = await sb.rpc('reserva_abonos_ordenar', { p_reserva_id: est.reservaId, p_ids: ids });
    est.ordenando = false;
    if (est.datos !== d) return;
    if (btn.isConnected) btn.disabled = false;
    if (error || !data?.ok) {
      c.error(error?.code === '42501' ? 'Tu usuario no puede ordenar los abonos de esta reserva.' : mensaje(error?.message || data?.error));
      if (data?.error === 'orden_desactualizado') { est.ordenPrevio = null; cargar(est.reservaId); }
      return;
    }
    est.ordenPrevio = null; pintar();
    c.ok('Orden guardado: así salen los abonos en el próximo voucher.');
  }
  const tasaActual = () => { const man = Number(document.getElementById('ab-tasa-manual')?.value || 0); return man > 0 ? man : tasaForm(est.tasaTipo); };
  // Monto que se registra, en la moneda del pago (en Bs sale del campo de bolívares, ya sincronizado).
  function montoForm() {
    const moneda = document.getElementById('ab-moneda')?.value || 'USD';
    actualizarTasa();
    const usdV = Number(document.getElementById('ab-monto')?.value || 0), bsV = Number(document.getElementById('ab-monto-bs')?.value || 0);
    if (moneda !== 'VES') return { moneda, monto: usdV };
    if (est.fuente !== 'VES' && usdV > 0 && !(tasaActual() > 0)) return { moneda, error: 'tasa_no_disponible' };
    return { moneda, monto: bsV };
  }
  function actualizarTasa() {
    const box = document.getElementById('ab-tasa-box'); if (!box) return;
    const moneda = document.getElementById('ab-moneda')?.value || est.moneda;
    const man = Number(document.getElementById('ab-tasa-manual')?.value || 0);
    const tasa = tasaActual();
    box.hidden = moneda !== 'VES';
    if (moneda !== 'VES') return;
    const usdIn = document.getElementById('ab-monto'), bsIn = document.getElementById('ab-monto-bs');
    if (tasa > 0 && usdIn && bsIn) {
      const r2 = n => Math.round(n * 100) / 100;
      if (est.fuente === 'VES') { const b = Number(bsIn.value || 0); usdIn.value = b > 0 ? r2(b / tasa) : ''; }
      else { const u = Number(usdIn.value || 0); bsIn.value = u > 0 ? r2(u * tasa) : ''; }
    }
    const en = est.datos?.tasas?.[est.tasaTipo]?.actualizado_en, delDia = est.tasasFecha?.[est.tasaTipo];
    document.getElementById('ab-tasa-nombre').textContent = nombreTasa(est.tasaTipo);
    document.getElementById('ab-tasa').textContent = tasa ? num(tasa, 4) : 'sin cargar';
    document.getElementById('ab-tasa-fecha').textContent = man > 0 && !delDia ? ''
      : delDia ? (delDia.historica ? `(del ${diaCorto(delDia.fecha)}, fecha del pago)` : '(no hay tasa guardada del día del pago: es la vigente)')
      : en ? `(${c.fecha(en)})` : '';
  }
  // Si suben la captura, se aprovecha para prellenar (EF analizar-comprobante).
  // Solo completa lo que está vacío; nunca registra nada.
  async function leerComprobante(archivo) {
    const aviso = document.getElementById('ab-ia'); if (!aviso) return;
    const token = ++est.tokenIA;
    aviso.hidden = false; aviso.textContent = 'Leyendo el comprobante…';
    const d = await analizarCaptura(archivo);
    if (token !== est.tokenIA || !document.getElementById('ab-ia')) return;
    if (!d) { aviso.textContent = 'No se pudo leer: completa los datos a mano.'; return; }
    // Al editar, el comprobante manda (para eso lo suben); en un abono nuevo solo llena lo vacío.
    const pisa = !!est.editando, puestos = [];
    const monto = document.getElementById('ab-monto'), bs = document.getElementById('ab-monto-bs'), moneda = document.getElementById('ab-moneda'), ref = document.getElementById('ab-ref');
    const montoVacio = !monto?.value && !bs?.value;
    if (['USD', 'VES'].includes(d.moneda) && moneda && (pisa || montoVacio)) { if (moneda.value !== d.moneda) puestos.push('moneda'); moneda.value = d.moneda; est.moneda = d.moneda; }
    if (d.monto != null && monto && (pisa || montoVacio)) {
      // En Bs se guarda el monto exacto del comprobante; los dólares salen de la tasa.
      if (moneda?.value === 'VES' && bs) { bs.value = d.monto; est.fuente = 'VES'; } else { monto.value = d.monto; est.fuente = 'USD'; }
      puestos.push('monto');
    }
    if (d.referencia && ref && (pisa || !ref.value)) { ref.value = d.referencia; puestos.push('referencia'); }
    if (d.metodo && METODOS.includes(d.metodo)) {
      est.metodo = d.metodo; puestos.push('método');
      panel()?.querySelectorAll('[data-ab-accion="metodo"]').forEach(x => x.classList.toggle('on', x.dataset.metodo === est.metodo));
    }
    // La fecha del comprobante manda sobre la de hoy (el campo nace con hoy): de ella sale la tasa.
    const fecha = document.getElementById('ab-fecha'), hoy = diaIso(new Date());
    if (d.fecha && fecha && d.fecha <= hoy && d.fecha >= '2020-01-01' && fecha.value !== d.fecha && (pisa || !fecha.value || fecha.value === hoy)) {
      fecha.value = d.fecha; puestos.push(`fecha (${diaCorto(d.fecha)})`);
      await cambiarFecha(d.fecha);
    }
    actualizarTasa();
    aviso.textContent = puestos.length ? `Leído del comprobante: ${puestos.join(', ')}${d.banco ? ` (${d.banco})` : ''}. Revísalo antes de registrar.` : 'No se encontraron datos en la captura.';
  }
  async function cambiarFecha(f) {
    const token = ++est.tokenFecha;
    const t = await tasasDelDia(f);
    if (token !== est.tokenFecha || !est.formAbierto) return;
    est.tasasFecha = t;
    const man = document.getElementById('ab-tasa-manual');
    if (man) man.value = tasaForm(est.tasaTipo) || man.value;
    actualizarTasa();
  }
  // null = no se pudo leer. También la usa el pago del formulario de servicio.
  async function analizarCaptura(archivo) {
    const imagen = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(null); fr.readAsDataURL(archivo); });
    if (!imagen) return null;
    const { data, error } = await sb.functions.invoke('analizar-comprobante', { body: { reserva_id: est.reservaId, mime: archivo.type || 'image/jpeg', imagen } });
    if (error || !data?.ok) return null;
    c.usoHerramienta?.(null, 'leer_comprobante', est.reservaId);
    return data.datos || {};
  }
  // `id`: editar ese abono (form precargado); sin id, abono nuevo.
  function abrirForm(id) {
    const ed = id ? (est.datos?.abonos || []).find(x => Number(x.id) === id) || null : null;
    est.editando = ed;
    if (ed) { est.metodo = METODOS.includes(ed.metodo) ? ed.metodo : ''; est.moneda = ed.moneda; }
    else { est.metodo = est.metodo || 'Zelle'; est.moneda = est.metodo === 'Pago móvil' ? 'VES' : 'USD'; }
    est.archivo = null; est.formAbierto = true; est.tasasFecha = null; est.tokenFecha++;
    est.tasaTipo = ed?.tasa_tipo || 'USD';
    // Abono en Bs ya cargado: manda el monto en bolívares guardado (no se recalcula si no lo tocan).
    est.fuente = ed?.moneda === 'VES' ? 'VES' : 'USD';
    est.solicitud = crypto.randomUUID();
    pintar();
    document.getElementById('ab-monto')?.focus();
  }
  async function cargar(reservaId) {
    const token = ++est.token;
    est.ordenPrevio = null;
    const p = panel(); if (!p) return;
    p.innerHTML = '<div class="tbl-state skel show"><div class="skel-bar"></div><div class="skel-bar"></div></div>';
    const { data, error } = await sb.rpc('reserva_abonos_lista', { p_reserva_id: reservaId });
    if (token !== est.token || reservaId !== est.reservaId) return;
    if (error || !data?.ok) {
      p.innerHTML = `<p class="ab-vacia">${esc(error?.code === '42501' ? 'Tu usuario no tiene acceso a los abonos de esta reserva.' : rpcErr(error, data))}</p>`;
      return;
    }
    est.datos = data; pintar();
  }
  const rpcErr = (error, data) => mensaje(error?.message || data?.error) || 'No se pudo cargar';
  async function subirCaptura(archivo) {
    const ext = (archivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
    const path = `${miUid()}/abonos/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage.from('vouchers-pdf').upload(path, archivo, { contentType: archivo.type || 'image/jpeg', upsert: false });
    if (up.error) throw new Error('No se pudo subir la captura. Reintenta o registra el abono con referencia.');
    return path;
  }
  async function guardar(btn) {
    if (est.guardando) return;
    if (est.editando) return guardarEdicion(btn);
    const err = document.getElementById('ab-err');
    const poner = m => { if (err) err.textContent = m || ''; };
    poner('');
    const v = id => (document.getElementById(id)?.value || '').trim();
    // La misma solicitud en cada reintento: si el primer intento sí entró, el servidor lo reconoce.
    est.solicitud = est.solicitud || crypto.randomUUID();
    const m = montoForm();
    if (m.error) return poner(mensaje(m.error));
    est.guardando = true;
    btn.disabled = true;
    try {
      await registrar({
        monto: m.monto, moneda: m.moneda, metodo: est.metodo, referencia: v('ab-ref'), nota: v('ab-nota'),
        archivo: est.archivo || document.getElementById('ab-file')?.files?.[0] || null, servicio: Number(v('ab-servicio') || 0) || null,
        tasaTipo: est.tasaTipo, solicitud: est.solicitud, fecha: v('ab-fecha'), tasasFecha: est.tasasFecha,
      }, poner);
    } catch (e) {
      poner(mensaje(e));
      c.error(mensaje(e));
    } finally {
      est.guardando = false;
      if (btn?.isConnected) btn.disabled = false;
    }
  }
  // Alta de un abono con su cadena de documentos. La usan el formulario de Abonos y el pago del
  // formulario de servicio (pagarServicio). true = quedó registrado; los errores de validación van a `poner`.
  async function registrar(p, poner) {
    if (!(p.monto > 0)) { poner(ERRORES.monto_invalido); return false; }
    if (!p.metodo) { poner(ERRORES.metodo_invalido); return false; }
    // Pago móvil en dólares (formulario del servicio): se registra en Bs a la tasa elegida del día del pago.
    const pmUsd = p.metodo === 'Pago móvil' && p.moneda === 'USD';
    const ves = p.moneda === 'VES' || pmUsd, hoy = diaIso(new Date());
    if (p.fecha && (p.fecha > hoy || p.fecha < '2020-01-01')) { poner(ERRORES.fecha_invalida); return false; }
    const fecha = p.fecha && p.fecha < hoy ? p.fecha : null;
    const tasasF = fecha && ves ? p.tasasFecha || await tasasDelDia(fecha) : null;
    if (pmUsd) {
      const t = Number(tasasF?.[p.tasaTipo]?.tasa || 0) || tasaDe(est.datos, p.tasaTipo);
      if (!t) { poner(ERRORES.tasa_no_disponible); return false; }
      p = { ...p, moneda: 'VES', monto: Math.round(p.monto * t * 100) / 100 };
    }
    if (p.metodo === 'Pago móvil' && p.moneda !== 'VES') { poner(ERRORES.pago_movil_en_bs); return false; }
    const comprobante = p.archivo ? await subirCaptura(p.archivo) : null;
    const llamar = forzar => sb.rpc('registrar_abono_reserva_v2', {
      p_reserva_id: est.reservaId, p_monto_original: p.monto, p_moneda: p.moneda, p_metodo: p.metodo,
      p_solicitud_id: p.solicitud, p_referencia: p.referencia || null, p_nota: p.nota || null,
      p_comprobante_path: comprobante, p_comprobante_datos: null, p_servicio_id: p.servicio, p_forzar: forzar,
      p_tasa_tipo: ves ? p.tasaTipo : null, p_tasa_esperada: ves ? (Number(tasasF?.[p.tasaTipo]?.tasa || 0) || tasaDe(est.datos, p.tasaTipo)) || null : null,
      p_fecha: fecha,
    });
    let { data, error } = await llamar(false);
    // A3: el mismo pago cargado dos veces (R-000133). Solo sigue si confirman que es otro pago.
    if (!error && data?.error === 'posible_duplicado') {
      const x = data.duplicado || {};
      const otro = await c.confirmar({ titulo: '¿Es el mismo pago?', textoOk: 'Es otro pago: registrar', textoCancelar: 'No registrar',
        detalle: `Ya hay ${x.origen === 'pago' ? 'un pago declarado' : 'un abono'} de ${usd(x.monto_usd)} con la referencia ${x.referencia || '—'} del ${c.fecha(x.fecha)}${x.codigo ? ` en ${x.codigo}` : ''}.\nSi es el mismo pago, no lo cargues de nuevo.` });
      if (!otro) { poner('No se registró: ese pago ya estaba cargado.'); return false; }
      ({ data, error } = await llamar(true));
    }
    // M10: la tasa se actualizó con el form abierto. Se muestra la nueva y se pide confirmar de nuevo.
    if (!error && data?.error === 'tasa_cambio') {
      const destino = tasasF && tasasF === est.tasasFecha ? tasasF : (est.datos.tasas ||= {});
      (destino[data.tasa_tipo] ||= {}).tasa = data.tasa;
      actualizarTasa();
      poner(`La tasa ${nombreTasa(data.tasa_tipo)} cambió a ${num(data.tasa, 4)}. Revisa el equivalente y registra de nuevo.`);
      return false;
    }
    if (error) throw new Error(error.code === '42501' ? 'Tu usuario no puede registrar abonos en esta reserva.' : error.message);
    if (!data?.ok) throw new Error(data?.error || 'Sin respuesta del servidor');
    est.archivo = null; est.solicitud = null;
    est.formAbierto = false;
    // Abono de asesor: queda por verificar. Voucher y recibo salen cuando administración lo verifica.
    if (data.estado === 'por_verificar') {
      c.ok(`Abono enviado a verificación · ${usd(data.monto_usd)}. Suma al pagado cuando administración lo confirme.`);
      est.datos = null;
      await cargar(est.reservaId);
      c.pagosCambiaron?.();
      return true;
    }
    // El pago ya quedó: ahora los documentos (voucher revisado + recibo).
    const docs = await cadenaAbono({
      id: data.abono_id, monto_usd: data.monto_usd, monto_original: data.monto_original,
      moneda: data.moneda, tasa_usd_ves: data.tasa_usd_ves, tasa_tipo: data.tasa_tipo, metodo: data.metodo,
      referencia: data.referencia, servicio_id: data.servicio_id ?? null, fecha: data.fecha || new Date().toISOString(),
    }, data.monto_pagado, data.saldo_pendiente);
    // El pago quedó guardado: nunca un toast de error, o lo vuelven a cargar (R-000133, abonos 66-68).
    if (docs.fallo) c.ok(`Abono registrado · saldo ${usd(data.saldo_pendiente)}. Los documentos quedaron pendientes (${docs.fallo}): no lo cargues de nuevo, usa «Reintentar documentos».`);
    else c.ok(`Abono registrado · ${docs.voucherInfo ? `Voucher ${docs.voucherInfo.numero}${docs.voucherInfo.revision ? ` rev. ${docs.voucherInfo.revision}` : ''}` : 'sin voucher'}${docs.reciboId ? ' · Recibo' : ''} · saldo ${usd(data.saldo_pendiente)}`);
    est.datos = null;
    await cargar(est.reservaId);
    c.pagosCambiaron?.();
    await ofrecerDocumento(docs, data.saldo_pendiente);
    return true;
  }
  // Lo ya cobrado de un servicio: sus abonos vivos y, si es el hospedaje (o el único servicio), también
  // los abonos de toda la reserva y lo cobrado sin detalle (regla del dueño: los abonos son del hospedaje).
  function pagadoDe(sid) {
    const d = est.datos; if (!d) return null;
    const servs = d.servicios || [], propio = (servs.length === 1 && Number(servs[0].id) === sid) || hospUnico(d) === sid;
    const suma = (d.abonos || []).filter(a => ocupa(a) && (Number(a.servicio_id) === sid || (propio && a.servicio_id == null))).reduce((s, a) => s + Number(a.monto_usd || 0), 0);
    return Math.round((suma + (propio ? Math.max(0, Number(d.monto_pagado || 0) - Number(d.pagado_con_detalle || 0)) : 0)) * 100) / 100;
  }
  // Pago cargado desde el formulario del servicio (recién guardado: se relee la reserva para que esté su
  // precio). `p.completo`: el monto es lo que le falta al servicio, sin pasar el saldo de la reserva.
  async function pagarServicio(reservaId, p, poner) {
    if (est.guardando) { poner('Ya hay un abono registrándose: espera a que termine.'); return false; }
    est.guardando = true;
    try {
      if (reservaId !== est.reservaId) throw new Error('reserva_no_disponible');
      est.datos = null; await cargar(reservaId);
      if (!est.datos) throw new Error('No se pudieron leer los abonos de la reserva.');
      if (p.completo) {
        const s = (est.datos.servicios || []).find(x => Number(x.id) === p.servicio);
        if (!s) throw new Error('servicio_invalido');
        const falta = Math.min(Math.round((Number(s.precio_usd || 0) - pagadoDe(p.servicio)) * 100) / 100, Number(est.datos.saldo_pendiente || 0) - Number(est.datos.monto_por_verificar || 0));
        if (!(falta > 0)) { poner('Ese servicio ya está pagado completo.'); return false; }
        const tasasFecha = p.moneda === 'VES' ? await tasasDelDia(p.fecha) : null;
        const tasa = Number(tasasFecha?.[p.tasaTipo]?.tasa || 0) || tasaDe(est.datos, p.tasaTipo);
        if (p.moneda === 'VES' && !tasa) throw new Error('tasa_no_disponible');
        // En Bs se redondea hacia abajo: un céntimo de más daría supera_saldo.
        p = { ...p, tasasFecha, monto: p.moneda === 'VES' ? Math.floor(falta * tasa * 100) / 100 : falta };
      }
      return await registrar({ ...p, solicitud: p.solicitud || crypto.randomUUID() }, poner);
    } catch (e) { poner(mensaje(e)); return false; }
    finally { est.guardando = false; }
  }
  async function guardarEdicion(btn) {
    const ed = est.editando, err = document.getElementById('ab-err');
    const poner = m => { if (err) err.textContent = m || ''; };
    poner('');
    const val = id => (document.getElementById(id)?.value || '').trim();
    const m = montoForm(), { monto, moneda } = m, tasa = moneda === 'VES' ? tasaActual() : 0;
    if (m.error) return poner(mensaje(m.error));
    if (!(monto > 0)) return poner(ERRORES.monto_invalido);
    if (!est.metodo) return poner(ERRORES.metodo_invalido);
    if (est.metodo === 'Pago móvil' && moneda !== 'VES') return poner(ERRORES.pago_movil_en_bs);
    if (moneda === 'VES' && !(tasa > 0)) return poner(ERRORES.tasa_invalida);
    // La captura se sube antes de tocar el abono: si falla, no queda nada a medias.
    const archivo = !ed.comprobante_path && (est.archivo || document.getElementById('ab-file')?.files?.[0]) || null;
    est.guardando = true; btn.disabled = true;
    try {
      const comprobante = archivo ? await subirCaptura(archivo) : null;
      const { data, error } = await sb.rpc('editar_abono_reserva', {
        p_abono_id: ed.id, p_monto_original: monto, p_moneda: moneda, p_metodo: est.metodo,
        p_referencia: val('ab-ref') || null, p_nota: val('ab-nota') || null,
        p_servicio_id: document.getElementById('ab-servicio') ? Number(val('ab-servicio') || 0) : null,
        p_tasa_tipo: moneda === 'VES' ? est.tasaTipo : null, p_tasa: moneda === 'VES' && Number(val('ab-tasa-manual') || 0) > 0 ? Number(val('ab-tasa-manual')) : null,
        p_fecha: val('ab-fecha') || null,
      });
      if (error) throw new Error(error.code === '42501' ? 'Tu usuario no puede editar este abono.' : error.message);
      if (!data?.ok) throw new Error(data?.error || 'Sin respuesta del servidor');
      est.formAbierto = false; est.editando = null; est.archivo = null;
      let adjunto = '';
      if (comprobante) {
        const r = await sb.rpc('abono_adjuntar_comprobante', { p_abono_id: ed.id, p_comprobante_path: comprobante });
        adjunto = !r.error && r.data?.ok ? ' · comprobante guardado' : ` · el comprobante no quedó guardado (${mensaje(r.error?.message || r.data?.error)})`;
      }
      if (data.sin_cambios) {
        c.ok(adjunto ? 'Abono sin cambios' + adjunto : 'El abono no tenía cambios.');
        if (adjunto) { est.datos = null; await cargar(est.reservaId); } else pintar();
        return;
      }
      let docs = { fallo: null };
      // Por verificar o rechazado: sin documentos hasta que administración lo apruebe.
      if (data.estado && data.estado !== 'verificado') { c.ok(`Abono editado${adjunto} · ${data.estado === 'por_verificar' ? 'queda por verificar' : 'sigue rechazado'}`); est.datos = null; await cargar(est.reservaId); c.pagosCambiaron?.(); return; }
      if (data.documentos_estado !== 'listo') docs = await cadenaAbono({
        id: data.abono_id, monto_usd: data.monto_usd, monto_original: data.monto_original,
        moneda: data.moneda, tasa_usd_ves: data.tasa_usd_ves, tasa_tipo: data.tasa_tipo, metodo: data.metodo,
        referencia: data.referencia, servicio_id: data.servicio_id ?? null, fecha: data.fecha,
      }, data.monto_pagado, data.saldo_pendiente);
      if (docs.fallo) c.ok(`Abono editado · saldo ${usd(data.saldo_pendiente)}${adjunto}. Los documentos quedaron pendientes (${docs.fallo}): usa «Reintentar documentos».`);
      else c.ok(`Abono editado · saldo ${usd(data.saldo_pendiente)}${docs.reciboId ? ' · Recibo nuevo' : ''}${adjunto}`);
      est.datos = null;
      await cargar(est.reservaId);
      c.pagosCambiaron?.();
    } catch (e) {
      poner(mensaje(e));
      c.error(mensaje(e));
    } finally {
      est.guardando = false;
      if (btn?.isConnected) btn.disabled = false;
    }
  }
  // Pedido del dueño: no quedan anulados. Borra el abono y su recibo; queda el evento en el historial.
  async function eliminar(id) {
    const a = (est.datos?.abonos || []).find(x => Number(x.id) === id); if (!a) return;
    const motivo = await c.pedir({
      titulo: 'Eliminar abono', detalle: `${usd(a.monto_usd)} · ${a.metodo}. ${a.anulado_en ? 'Ya estaba anulado: se borra de la lista.' : 'Se borra el abono y su recibo, y el acumulado de la reserva baja.'}`,
      label: 'Motivo', tipo: 'textarea', requerido: true, textoOk: 'Eliminar', destructivo: true,
    });
    if (!motivo) return;
    const { data, error } = await sb.rpc('eliminar_abono_reserva', { p_abono_id: id, p_motivo: motivo });
    if (error) return c.error(error.code === '42501' ? 'Tu usuario no puede eliminar este abono.' : error.message);
    if (!data?.ok) return c.error(mensaje(data?.error));
    if (Number(est.editando?.id) === id) { est.formAbierto = false; est.editando = null; }
    est.datos = null;
    await cargar(est.reservaId);
    c.pagosCambiaron?.();
    // El voucher se reimprime sin ese abono (un anulado ya no estaba en el voucher).
    let aviso = '';
    if (cuenta(a) && est.datos?.voucher?.id && puedeGenerar()) {
      try {
        const actual = (await rpcDoc('documento_historial', { p_tipo: 'voucher', p_id: String(est.datos.voucher.id) }))?.actual || null;
        // El abono ya no existe: sin abono_id, documento_preparar no lo busca.
        const v = await revisarVoucher({ ...a, id: null }, data.monto_pagado, actual, true);
        if (v) aviso = ` · voucher ${v.numero} rev. ${v.revision}`;
      } catch (e) { aviso = `. El voucher no se actualizó (${mensaje(e)}): revísalo desde Voucher`; }
    }
    c.ok(`Abono eliminado · saldo ${usd(data.saldo_pendiente)}${aviso}`);
    if (aviso.startsWith(' ·')) { est.datos = null; await cargar(est.reservaId); }
  }
  // ------------------------------------------------ documentos del abono (fase 3)
  // El abono (el pago) ya está guardado y es la fuente de verdad: acá solo se arman los
  // documentos. Si algo falla, se registra el error en el abono y queda «Reintentar documentos».
  const diaMesAnio = d => { const f = new Date(d || Date.now()); return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`; };
  async function rpcDoc(fn, args) {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(error.code === '42501' ? 'Tu usuario no puede actualizar el voucher de esta reserva.' : error.message);
    if (data?.ok === false) throw new Error(mensaje(data.error) || 'No se pudo completar la operación');
    return data;
  }
  const puedeGenerar = () => !!(c.librerias && c.membrete && c.pdfVoucher);

  // Revisión automática del voucher con el ajuste sincronizar_abono: sube la revisión y NO
  // vuelve a sumar el pago a la reserva (eso ya lo hizo el abono).
  // `anulacion`: el abono se acaba de anular; el voucher baja y el abono sale del detalle.
  async function revisarVoucher(abono, pagado, actual, anulacion = false) {
    if (!actual || actual.anulado_en || !puedeGenerar()) return null;
    await c.librerias();
    const v = est.datos.voucher;
    const totalDoc = Number(actual.total_general || 0);
    const S = servicioDelVoucher(totalDoc);
    // D1: el abono de otro servicio (p. ej. el boleto de contado) no toca el voucher del hotel.
    if (S && abono.servicio_id && Number(abono.servicio_id) !== S) return null;
    const pagadoDoc = Math.min(totalDoc, S ? pagadoServicio(S, abono, anulacion) : Number(pagado));
    const datos = { ...actual, monto_pagado: pagadoDoc };
    const pre = await rpcDoc('documento_preparar', {
      p_tipo: 'voucher', p_id: String(v.id), p_version: actual.revision || 1,
      p_datos: datos, p_finanzas: { tipo: 'sincronizar_abono', abono_id: abono.id },
    });
    if (!pre?.candidato || Number(pre.candidato.monto_pagado) === Number(actual.monto_pagado)) return null;
    const operacion = crypto.randomUUID();
    const pdf = await c.pdfVoucher({ ...pre.candidato, abonos_detalle: abonosDetalle(anulacion ? null : abono, pagadoDoc, S) });
    const nombre = c.nombreArchivo ? c.nombreArchivo('voucher', pre.candidato) : `Voucher-${pre.candidato.numero_factura || v.id}-r${pre.candidato.revision}.pdf`;
    const path = `${miUid()}/documentos/voucher/${v.id}/r${pre.candidato.revision}-${operacion}.pdf`;
    const up = await sb.storage.from('vouchers-pdf').upload(path, pdf, { contentType: 'application/pdf' });
    if (up.error && String(up.error.statusCode) !== '409') throw new Error('No se pudo subir el PDF del voucher.');
    const adjunto = c.prepararAdjunto && pre.candidato.reserva_id
      ? await c.prepararAdjunto(pre.candidato.reserva_id, pre.impacto?.servicio_id ?? null, pdf, nombre)
      : null;
    let r;
    try {
      r = await rpcDoc('documento_guardar', {
        p_tipo: 'voucher', p_id: String(v.id), p_version: actual.revision || 1, p_datos: datos,
        p_motivo: `${anulacion ? 'Anulación del abono' : 'Abono'} ${usd(abono.monto_usd)} del ${diaMesAnio(abono.fecha)}`, p_operacion: operacion,
        p_huella: pre.huella, p_pdf_path: path,
        p_finanzas: { tipo: 'sincronizar_abono', abono_id: abono.id }, p_adjunto: adjunto,
      });
    } catch (e) {
      // Sin revisión guardada, el PDF subido no lo referencia nadie: se borra para no dejar huérfanos.
      sb.storage.from('vouchers-pdf').remove([path]).catch(() => {});
      throw e;
    }
    return { revision: r.documento?.revision ?? pre.candidato.revision, documentoId: r.documento?.revision_documento_reserva ?? null, numero: r.documento?.numero_factura || v.numero_factura, voucherId: v.id, pdf, nombre };
  }

  // Servicio que cubre el voucher: el de su documento; sin él, si el voucher no cubre toda la
  // reserva, el hospedaje. null = voucher de toda la reserva.
  function servicioDelVoucher(totalDoc) {
    const d = est.datos || {};
    if (d.voucher?.servicio_id) return Number(d.voucher.servicio_id);
    return totalDoc < Number(d.monto_total || 0) - 0.005 ? hospUnico(d) : null;
  }
  // Abono sin servicio = de toda la reserva: cuenta para cualquier voucher.
  const delServicio = (a, S) => !S || a.servicio_id == null || Number(a.servicio_id) === S;
  // Lo pagado del servicio: sus abonos vivos (+ el nuevo) y, en el hospedaje, lo cobrado sin detalle.
  function pagadoServicio(S, abono, anulacion) {
    const d = est.datos || {};
    const otros = (d.abonos || []).filter(a => cuenta(a) && Number(a.id) !== Number(abono.id) && delServicio(a, S));
    const sinDetalle = S === hospUnico(d) ? Math.max(0, Number(d.monto_pagado || 0) - Number(d.pagado_con_detalle || 0)) : 0;
    const suma = otros.reduce((s, a) => s + Number(a.monto_usd || 0), 0) + (anulacion ? 0 : Number(abono.monto_usd || 0)) + sinDetalle;
    return Math.round(suma * 100) / 100;
  }

  // Líneas de abonos del voucher reimpreso: los vigentes del servicio `S` + el nuevo (resaltado). Lo
  // cobrado sin fila de abono (p. ej. el pago que traía un voucher importado) va como «Pagos anteriores».
  function abonosDetalle(abono, pagado, S = null) {
    const fila = (a, nuevo) => ({ fecha: diaMesAnio(a.fecha), metodo: /^(saldo anterior|sin especificar)$/i.test(a.metodo || '') ? 'Abono' : a.metodo, referencia: a.referencia, monto: Number(a.monto_usd || 0), nuevo });
    // En el orden elegido en la lista; el abono editado conserva su puesto y el nuevo va al final.
    const vivos = (est.datos?.abonos || []).filter(a => !a.anulado_en && (Number(a.id) === Number(abono?.id) || (cuenta(a) && delServicio(a, S))));
    const filas = vivos.map(a => Number(a.id) === Number(abono?.id) ? fila(abono, true) : fila(a, false));
    if (abono && !vivos.some(a => Number(a.id) === Number(abono.id))) filas.push(fila(abono, true));
    const sinDetalle = Math.round((Number(pagado || 0) - filas.reduce((s, f) => s + f.monto, 0)) * 100) / 100;
    return sinDetalle > 0 ? [{ fecha: '—', metodo: 'Abono anterior', referencia: '', monto: sinDetalle }, ...filas] : filas;
  }

  // Reserva sin voucher propio: se reimprime desde la reserva con el N° del voucher importado
  // (sin N°, rotulado con el código de la reserva). No crea fila en vouchers ni gasta numeración.
  async function voucherDeReserva(abono, pagado, saldo) {
    const d = est.datos || {};
    if (!c.voucherReserva || !c.adjuntarVoucher || !puedeGenerar()) return null;
    const base = c.voucherReserva({ reservaId: est.reservaId, pagado, saldo, metodo: abono.metodo, referencia: abono.referencia });
    if (!base) return null;
    const numero = d.voucher_importado?.numero_voucher ? String(d.voucher_importado.numero_voucher).padStart(6, '0') : '';
    const v = { ...base, numero_factura: numero, rotulo: `Voucher ${numero || d.codigo || ''} · abono del ${diaMesAnio(abono.fecha)}`, abonos_detalle: abonosDetalle(abono, pagado) };
    await c.librerias();
    const pdf = await c.pdfVoucher(v);
    const nombre = c.nombreArchivo ? c.nombreArchivo('voucher', { ...v, numero_factura: numero || d.codigo, fecha_entrada: null }) : `Voucher ${numero || d.codigo}.pdf`;
    await c.adjuntarVoucher(est.reservaId, pdf, nombre);
    return { numero: numero || d.codigo, revision: null, documentoId: null, pdf, nombre };
  }

  // Tras el abono: el voucher al día (o, sin voucher, el recibo) listo para mandarlo al cliente.
  async function ofrecerDocumento(docs, saldo) {
    const v = docs.voucherInfo, doc = v?.pdf ? v : docs.recibo;
    if (!doc?.pdf || !c.confirmar) return;
    const file = new File([doc.pdf], doc.nombre, { type: 'application/pdf' });
    const compartir = !!navigator.canShare?.({ files: [file] });
    const titulo = v?.pdf ? `Voucher ${v.numero}${v.revision ? ` · revisión ${v.revision}` : ''} actualizado` : 'Recibo del abono listo';
    // El chat con ventana abierta va en la misma hoja: dos hojas seguidas se pisan. La bandeja muestra la vista previa y nada sale hasta tocar Enviar.
    const chat = await Promise.resolve(c.chatDeReserva?.(est.reservaId)).catch(() => null);
    const otra = compartir ? 'Compartir con el cliente' : 'Descargar PDF';
    const ok = await c.confirmar({ titulo, textoOk: chat ? 'Continuar' : otra, textoCancelar: 'Cerrar',
      detalle: `${v?.pdf ? 'Incluye el abono nuevo, el total abonado' : 'Esta reserva no tiene voucher para reimprimir. El recibo trae el total pagado'} y el saldo de ${usd(saldo)}.\nYa quedó adjunto en la reserva.`,
      campos: chat ? [{ id: 'via', label: '¿Cómo se lo mandas?', tipo: 'radio', requerido: true, valor: 'chat', opciones: [{ v: 'chat', t: 'Al chat del cliente' }, { v: 'otra', t: otra }] }] : null });
    if (!ok) return;
    if (ok.via === 'chat') { await c.pdfAlChat(chat, doc.pdf, doc.nombre); return; }
    let accion = 'descarga';
    if (compartir) {
      try { await navigator.share({ files: [file], title: doc.nombre }); accion = 'compartir'; }
      catch (e) { if (e.name === 'AbortError') return; c.descargar(doc.pdf, doc.nombre); }
    } else c.descargar(doc.pdf, doc.nombre);
    if (v?.pdf && v.revision && v.voucherId) {
      try { await rpcDoc('documento_registrar_entrega', { p_tipo: 'voucher', p_id: String(v.voucherId), p_version: v.revision, p_accion: accion, p_operacion: crypto.randomUUID() }); }
      catch { /* la entrega ya ocurrió: solo falta el registro en el historial */ }
    }
  }

  // Recibo de abono: 1 página con el membrete del voucher.
  async function reciboPdf(d) {
    await c.librerias();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const logo = c.logo ? await c.logo().catch(() => null) : null;
    c.membrete(doc, { F: 'helvetica', st: s => ({ bold: 'bold', semibold: 'bold', medium: 'normal', normal: 'normal' }[s] || 'normal'), logo });
    const X0 = 40, X1 = 572;
    let y = 152;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(20, 32, 60);
    doc.text('RECIBO DE ABONO', X0, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    if (d.codigo) doc.text(`Reserva ${d.codigo}`, X1, y - 12, { align: 'right' });
    if (d.numero) doc.text(`Voucher ${d.numero} · revisión ${d.revision || 1}`, X1, y, { align: 'right' });
    doc.setDrawColor(220, 224, 232); doc.setLineWidth(0.8); doc.line(X0, y + 12, X1, y + 12);
    y += 40;
    const monto = d.moneda === 'VES'
      ? `Bs ${num(d.monto_original)}${d.tasa ? ` · tasa ${d.tasa_tipo ? nombreTasa(d.tasa_tipo) + ' ' : ''}${num(d.tasa, 4)}` : ''}`
      : usd(d.monto_original);
    const filas = [['Fecha del abono', d.fechaTexto], ['Cliente', d.cliente], ['Monto recibido', monto],
      ['Equivalente en dólares', usd(d.monto_usd)], ['Método de pago', d.metodo], ['Referencia', d.referencia]];
    doc.setFontSize(10);
    filas.filter(([, v]) => v).forEach(([k, v]) => {
      doc.setFont('helvetica', 'normal'); doc.setTextColor(122, 126, 134); doc.text(String(k).toUpperCase(), X0, y);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(28, 32, 40); doc.text(String(v), X1, y, { align: 'right' });
      y += 22;
    });
    y += 8;
    doc.setFillColor(245, 247, 251); doc.roundedRect(X0, y, X1 - X0, 64, 8, 8, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(112, 116, 124);
    doc.text('TOTAL PAGADO DE LA RESERVA', X0 + 16, y + 25);
    doc.text('SALDO PENDIENTE', X0 + 16, y + 47);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20, 32, 60);
    doc.text(usd(d.total_pagado), X1 - 16, y + 27, { align: 'right' });
    doc.setFontSize(12); doc.setTextColor(172, 58, 40);
    doc.text(usd(d.saldo), X1 - 16, y + 49, { align: 'right' });
    y += 96;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(134, 138, 144);
    doc.text('Este recibo corresponde a un abono parcial de la reserva. El documento vigente es el voucher emitido.', X0, y, { maxWidth: X1 - X0 });
    doc.text('Destino y Eventos Lotus 360 · 0241-5144470 / 0424-4634041 · Destinoyeventoslotus360@gmail.com', X0, 806);
    return doc.output('blob');
  }

  async function adjuntarRecibo(blob, nombre) {
    const firma = await sb.functions.invoke('reservas-documentos', { body: { accion: 'subir', reserva_id: est.reservaId, servicio_id: null, tipo: 'recibo_abono', nombre, mime: 'application/pdf', tamano: blob.size } });
    if (firma.error || !firma.data?.ok) throw new Error(`No se pudo preparar el recibo en la reserva${c.errorFn ? ` (${await c.errorFn(firma.error, firma.data)})` : ''}.`);
    const up = await sb.storage.from('reservas-documentos').uploadToSignedUrl(firma.data.path, firma.data.token, blob, { contentType: 'application/pdf' });
    if (up.error) throw new Error('No se pudo subir el recibo a la reserva.');
    const r = await rpcDoc('registrar_documento', { p_reserva_id: est.reservaId, p_servicio_id: null, p_tipo: 'recibo_abono', p_storage_path: firma.data.path, p_nombre: nombre });
    return r.documento_id;
  }

  // `reciboPrevio`: al reintentar, el recibo que ya quedó adjunto no se vuelve a generar (no duplica).
  // `alAbono` ({ pagado, saldo }): los totales del recibo cuando no son los de hoy (reintento de un abono viejo).
  async function cadenaAbono(abono, pagado, saldo, reciboPrevio = null, alAbono = null) {
    const d = est.datos || {};
    let actual = null;
    if (d.voucher?.id) { try { actual = (await rpcDoc('documento_historial', { p_tipo: 'voucher', p_id: String(d.voucher.id) }))?.actual || null; } catch { actual = null; } }
    let voucherInfo = null, reciboId = reciboPrevio, recibo = null, fallo = null;
    if (!puedeGenerar()) fallo = ERRORES.sin_librerias;
    else if (d.voucher?.id && !actual) fallo = ERRORES.voucher_no_leido;
    try {
      if (!fallo) voucherInfo = d.voucher?.id ? await revisarVoucher(abono, pagado, actual) : await voucherDeReserva(abono, pagado, saldo);
    } catch (e) { fallo = mensaje(e); }
    try {
      if (puedeGenerar() && !reciboPrevio) {
        const blob = await reciboPdf({
          codigo: d.codigo, cliente: actual?.cliente_nombre, numero: voucherInfo?.numero || d.voucher?.numero_factura,
          revision: voucherInfo?.revision || d.voucher?.revision, fechaTexto: diaMesAnio(abono.fecha),
          monto_original: abono.monto_original, moneda: abono.moneda, tasa: abono.tasa_usd_ves, tasa_tipo: abono.tasa_tipo,
          monto_usd: abono.monto_usd, metodo: abono.metodo, referencia: abono.referencia,
          total_pagado: alAbono?.pagado ?? pagado, saldo: alAbono?.saldo ?? saldo,
        });
        recibo = { pdf: blob, nombre: c.nombreArchivo ? c.nombreArchivo('recibo', { cliente: actual?.cliente_nombre, codigo: d.codigo, fecha: abono.fecha }) : `Recibo abono ${diaMesAnio(abono.fecha)}.pdf` };
        reciboId = await adjuntarRecibo(blob, recibo.nombre);
      }
    } catch (e) { fallo = fallo || mensaje(e); }
    // Si este registro se pierde, el recibo queda sin enlazar y un reintento lo duplicaría: se
    // reintenta una vez y, si igual falla, se avisa (el abono ya está guardado).
    const registro = { p_abono_id: abono.id, p_recibo_documento_id: reciboId,
      p_voucher_documento_id: voucherInfo?.documentoId ?? null,
      p_voucher_revision: voucherInfo?.revision ?? null, p_error: fallo ? String(fallo).slice(0, 300) : null };
    try { await rpcDoc('abono_documentos_registrar', registro); }
    catch { try { await rpcDoc('abono_documentos_registrar', registro); } catch (e) { fallo = fallo || `no quedó registrado en el abono (${mensaje(e)})`; } }
    return { voucherInfo, reciboId, recibo, fallo };
  }

  async function verRecibo(documentoId, btn) {
    if (btn) btn.disabled = true;
    const { data, error } = await sb.functions.invoke('reservas-documentos', { body: { accion: 'descargar', documento_id: Number(documentoId) } });
    if (error || !data?.ok) { if (btn) btn.disabled = false; return c.error('No se pudo abrir el recibo. Reintenta en unos segundos.'); }
    try { await c.entregarUrl(data.url, data.nombre || 'Recibo de abono.pdf', data.mime || 'application/pdf'); }
    catch { c.error('No se pudo abrir el recibo. Reintenta en unos segundos.'); }
    finally { if (btn) btn.disabled = false; }
  }

  // Captura del pago guardada en el abono (al registrarlo o desde el voucher de la reserva).
  async function verComprobante(path, btn) {
    if (!path) return;
    if (btn) btn.disabled = true;
    try {
      const { data, error } = await sb.storage.from('vouchers-pdf').createSignedUrl(path, 300);
      if (error || !data?.signedUrl) throw error || new Error('sin_url');
      const ext = (path.split('.').pop() || 'jpg').toLowerCase();
      await c.entregarUrl(data.signedUrl, `Comprobante abono.${ext}`, ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
    } catch {
      c.error('No se pudo abrir el comprobante. Solo lo ven quien lo subió y administración.');
    } finally { if (btn) btn.disabled = false; }
  }

  async function reintentarDocumentos(id, btn) {
    const a = (est.datos?.abonos || []).find(x => Number(x.id) === id);
    if (!a || !est.datos) return;
    const previo = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...'; }
    // El recibo de un abono viejo lleva el pagado y el saldo de ese momento: sus abonos vivos hasta
    // él + lo cobrado sin fila. El voucher sí se revisa con lo de hoy.
    const d = est.datos, vivos = (d.abonos || []).filter(cuenta);
    const suma = l => l.reduce((s, x) => s + Number(x.monto_usd || 0), 0);
    const pagadoAlAbono = Math.round((suma(vivos.filter(x => Number(x.id) <= id)) + Math.max(0, Number(d.monto_pagado || 0) - suma(vivos))) * 100) / 100;
    const alAbono = { pagado: pagadoAlAbono, saldo: Math.max(0, Math.round((Number(d.monto_total || 0) - pagadoAlAbono) * 100) / 100) };
    const docs = await cadenaAbono({ id: a.id, monto_usd: a.monto_usd, monto_original: a.monto_original, moneda: a.moneda, tasa_usd_ves: a.tasa_usd_ves, tasa_tipo: a.tasa_tipo, metodo: a.metodo, referencia: a.referencia, servicio_id: a.servicio_id ?? null, fecha: a.fecha }, d.monto_pagado, d.saldo_pendiente, a.recibo_documento_id || null, alAbono);
    if (btn?.isConnected) { btn.disabled = false; btn.innerHTML = previo; }
    if (docs.fallo) c.error(`No se pudieron generar los documentos: ${docs.fallo}`);
    else c.ok('Documentos del abono generados.');
    est.datos = null; await cargar(est.reservaId);
    await ofrecerDocumento(docs, est.datos?.saldo_pendiente ?? a.saldo);
  }

  // Oficina aprueba o rechaza un abono por verificar. Al aprobar salen voucher y recibo, como en un alta.
  async function verificar(id, aprobar, btn) {
    const a = (est.datos?.abonos || []).find(x => Number(x.id) === id);
    if (!a || est.guardando) return;
    let motivo = null;
    if (!aprobar) {
      motivo = await c.pedir({ titulo: 'Rechazar abono', detalle: `${usd(a.monto_usd)} · ${a.metodo}${a.referencia ? ' · ' + a.referencia : ''}. No suma al pagado; el asesor ve el motivo y puede corregirlo.`,
        label: 'Motivo', tipo: 'textarea', requerido: true, textoOk: 'Rechazar', destructivo: true });
      if (!motivo) return;
    }
    est.guardando = true; if (btn) btn.disabled = true;
    try {
      const data = await verificarAbono(sb, id, aprobar, motivo);
      c.pagosCambiaron?.();
      // Rechazo, o ya lo había resuelto otra persona (sus documentos los armó quien lo verificó).
      if (!aprobar || data.reutilizado) { est.datos = null; await cargar(est.reservaId); return c.ok(!aprobar ? 'Abono rechazado.' : 'Ese abono ya estaba verificado.'); }
      const docs = await cadenaAbono({ id, monto_usd: data.monto_usd, monto_original: data.monto_original, moneda: data.moneda,
        tasa_usd_ves: data.tasa_usd_ves, tasa_tipo: data.tasa_tipo, metodo: data.metodo, referencia: data.referencia,
        servicio_id: data.servicio_id ?? null, fecha: data.fecha }, data.monto_pagado, data.saldo_pendiente);
      if (docs.fallo) c.ok(`Abono verificado · saldo ${usd(data.saldo_pendiente)}. Los documentos quedaron pendientes (${docs.fallo}): usa «Reintentar documentos».`);
      else c.ok(`Abono verificado · saldo ${usd(data.saldo_pendiente)}${docs.reciboId ? ' · Recibo' : ''}`);
      est.datos = null; await cargar(est.reservaId);
      await ofrecerDocumento(docs, data.saldo_pendiente);
    } catch (e) { c.error(mensaje(e)); }
    finally { est.guardando = false; if (btn?.isConnected) btn.disabled = false; }
  }

  // Punto de montaje que llama app.js desde rvIniciar.
  function montar(reservaId, conForm) {
    if (!asentar()) return;
    est.reservaId = reservaId;
    est.datos = null; est.archivo = null; est.editando = null; est.metodo = conForm ? 'Pago móvil' : ''; est.formAbierto = !!conForm;
    est.moneda = conForm ? 'VES' : 'USD'; est.solicitud = conForm ? crypto.randomUUID() : null;
    cargar(reservaId);
  }
  return {
    montar, recargar: () => est.reservaId && cargar(est.reservaId),
    // Para el pago del formulario de servicio (app.js rvPagoHtml / rvGuardarServicio).
    pagarServicio, analizarCaptura, pagadoDe, editar: id => abrirForm(Number(id)), datos: () => est.datos, tasa: t => tasaDe(est.datos, t), METODOS, TASAS,
  };
}
