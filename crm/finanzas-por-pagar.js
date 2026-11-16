// Finanzas > Cuentas por pagar: pagos a proveedores (Fase 2.1, 2026-11-16).
// Un pago real (cuenta, fecha, comprobante o salida del banco) se reparte entre CxP; lo que sobra
// queda como saldo a favor. RPC admin y administrativo; anular y desclasificar solo admin.
// Plan: docs/superpowers/plans/2026-11-16-egresos-proveedores.md (Tarea 7)
const CSS = `
.pp-cab{display:flex;align-items:flex-start;justify-content:space-between;gap:11px;flex-wrap:wrap}
.pp-cab h2{margin:0}
.pp-tabs{margin:14px 0 11px}
.pp-tabs .seg-n{margin-left:4px;font-size:10.5px;font-weight:800;color:var(--amber)}
.pp-scroll{overflow-x:auto}
.pp-tabla tbody tr{cursor:default}
.pp-tabla td.num,.pp-tabla th.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.pp-tabla td small{display:block;font-size:11px;color:var(--muted);margin-top:2px}
.pp-tabla td.acc{white-space:nowrap;text-align:right}
.pp-tabla td.acc .inbox-btn{margin-left:4px}
.pp-tabla tr.pp-det>td{background:var(--bg2);padding:11px 14px}
.pp-ref{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;user-select:all;word-break:break-all}
.pp-alerta{color:var(--amber);font-weight:700}
.pp-verde{color:var(--green);font-weight:700}
.pp-muted{color:var(--muted)}
.pp-estado{display:inline-flex;align-items:center;min-height:22px;padding:0 9px;border-radius:999px;border:1px solid var(--line2);font-size:11px;font-weight:700;color:var(--muted);white-space:nowrap}
.pp-estado.alerta{color:var(--amber);border-color:var(--amber)}
.pp-estado.ok{color:var(--green);border-color:var(--green)}
.pp-vacio{padding:22px 0;text-align:center;color:var(--muted);font-size:12px}
.pp-nota{font-size:12px;color:var(--muted);margin:0 0 11px}
.pp-sub{margin:14px 0 7px;font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.pp-sel{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.pp-sel select{min-width:180px;max-width:100%}
#pp-sheet-root{max-height:72vh;overflow:auto;padding-bottom:7px}
.pp-form{display:grid;grid-template-columns:1fr 1fr;gap:9px 11px}
.pp-form .ancho{grid-column:1/-1}
.pp-form label.fl{margin:0 0 4px}
.pp-eq{font-size:12px;color:var(--muted);margin-top:4px}
.pp-rep{display:flex;flex-direction:column;gap:7px}
.pp-rep-fila{display:grid;grid-template-columns:1fr 120px;gap:9px;align-items:center;padding:7px 9px;border:1px solid var(--line);border-radius:10px}
.pp-rep-fila.off{opacity:.55}
.pp-rep-fila small{display:block;font-size:11px;color:var(--muted)}
.pp-rep-fila input{text-align:right}
.pp-tot{display:flex;justify-content:space-between;gap:11px;flex-wrap:wrap;font-size:12px;font-weight:700;padding:9px 2px}
.pp-err{color:var(--danger);font-size:12px;font-weight:700;min-height:16px}
.pp-pie{display:flex;gap:9px;padding-top:11px}
.pp-pie .dbtn{flex:1}
@media (max-width:560px){.pp-form{grid-template-columns:1fr}.pp-rep-fila{grid-template-columns:1fr 96px}}
`;
const TABS = [['prov', 'Por proveedor', 'fa-truck-field'], ['salidas', 'Salidas WF por clasificar', 'fa-building-columns'],
  ['servicios', 'Servicios sin proveedor', 'fa-circle-question'], ['saldo', 'Saldo a favor', 'fa-piggy-bank']];
const CATEGORIAS = [['gasto', 'Gasto de la agencia'], ['nomina', 'Nómina'], ['comision', 'Comisión']];
const ERRORES = {
  falta_idem: 'Reabrí el formulario y probá de nuevo.', proveedor_inexistente: 'Elegí un proveedor.',
  monto_invalido: 'Monto inválido (máximo 2 decimales).', moneda_invalida: 'Moneda inválida.',
  fecha_invalida: 'La fecha no puede ser futura.', aplicaciones_invalidas: 'Revisá los montos del reparto.',
  movimiento_invalido: 'Esa salida del banco ya no existe.', movimiento_ya_clasificado: 'Esa salida ya fue clasificada por otra persona.',
  monto_distinto_al_movimiento: 'El monto tiene que ser igual al de la salida del banco.',
  cuenta_distinta_al_movimiento: 'La cuenta tiene que ser la de la salida del banco.', falta_comprobante: 'Falta el comprobante.',
  cuenta_invalida: 'Elegí la cuenta de donde salió el pago.', moneda_distinta_a_la_cuenta: 'La moneda no coincide con la cuenta.',
  sin_tasa_para_fecha: 'No hay tasa BCV para esa fecha: cargá la tasa o usá otra fecha.', excede_pago: 'El reparto supera el monto del pago.',
  excede_saldo: 'El reparto supera lo que se le debe a esa cuenta.', cxp_sin_migrar: 'Esa cuenta tiene un abono viejo sin migrar; avisale al admin.',
  pago_inexistente: 'El pago ya no existe.', monto_menor_al_aplicado: 'No se puede bajar lo ya aplicado.',
  cxp_inexistente: 'La cuenta ya no existe.', cxp_anulada: 'La cuenta está anulada.', sin_credito: 'No hay crédito para liberar.',
  falta_motivo: 'Escribí el motivo.', ya_anulado: 'Ese pago ya estaba anulado.', reintentar: 'Cambió mientras tanto, probá de nuevo.',
  categoria_invalida: 'Elegí una categoría.', pago_no_historico: 'Ese pago no es histórico o está anulado.',
  pago_ya_enlazado: 'Ese pago histórico ya tiene una salida enlazada.', sin_clasificar: 'Esa salida no estaba clasificada.',
  anular_el_pago: 'Esa salida es un pago: anulá el pago para liberarla.', servicio_inexistente: 'El servicio ya no existe.',
  servicio_anulado: 'El servicio está anulado.', cxp_con_pagos_de_otro_proveedor: 'Esa cuenta ya tiene pagos de otro proveedor.',
  producto_inexistente: 'El producto ya no existe.', historico_parcial: 'El pago histórico tiene que cubrir el abono viejo completo.'
};

export function crearFinanzasPorPagar({ sb, esc, ok, error, confirmar, rol, raiz, hoja, abrirSheet, cerrarSheet, hoy, uid, irTarifario, alCambiar }) {
  const admin = rol === 'admin';
  let tab = 'prov', pedido = 0, provs = null, salidas = [], servicios = [], catalogo = [], cuentas = [];
  const cxpDe = new Map(), pagosDe = new Map(), abiertos = new Set(), clasificadas = new Map();
  let form = null;
  try { tab = localStorage.getItem('pp_tab') || 'prov'; } catch {}
  const usd = n => '$' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const bs = n => 'Bs ' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dia = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
  const r2 = n => Math.round(Number(n || 0) * 100) / 100;
  const msg = (data, e) => ERRORES[data?.error] || data?.error || e?.message || 'error desconocido';
  const nombreProv = id => catalogo.find(p => p.id === id)?.nombre || provs?.find(p => p.proveedor_id === id)?.nombre || `Proveedor ${id}`;
  const opcionesProv = sel => `<option value="">Elegí proveedor…</option>${catalogo.filter(p => p.activo || p.id === sel).map(p =>
    `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}`;

  if (!document.getElementById('pp-css')) {
    const st = document.createElement('style'); st.id = 'pp-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  raiz.addEventListener('click', e => {
    const b = e.target.closest('[data-pp]');
    if (!b || b.disabled) return;
    const id = Number(b.dataset.id), d = b.dataset;
    switch (d.pp) {
      case 'tab': tab = d.tab; try { localStorage.setItem('pp_tab', tab); } catch {} return pintar();
      case 'ver': return alternar(id);
      case 'pagar': return abrirPago({ proveedorId: id || null });
      case 'pagar-cxp': return abrirPago({ proveedorId: Number(d.prov), cxpId: id });
      case 'anular': return anular(id, Number(d.prov), b);
      case 'salida-pago': return pagoDesdeSalida(id);
      case 'salida-hist': return enlazarHistorico(id, b);
      case 'salida-no': return noEsProveedor(id, b);
      case 'desclasificar': return desclasificar(id, b);
      case 'asignar': return asignarServicio(id, b);
      case 'tarifario': return irTarifario?.(id);
      case 'aplicar': return aplicarSaldo(id, Number(d.prov), b);
      case 'liberar': return liberar(id, Number(d.prov), b);
    }
  });

  async function cargar() {
    const n = ++pedido;
    const [a, s, v, p, c] = await Promise.all([sb.rpc('por_pagar_proveedores_listar'), sb.rpc('banco_salidas_por_clasificar'),
      sb.rpc('servicios_sin_proveedor_listar'), catalogo.length ? { data: catalogo } : sb.rpc('listar_proveedores', { p_solo_activos: false }),
      cuentas.length ? { data: cuentas } : sb.rpc('cuentas_financieras_listar')]);
    if (n !== pedido) return;
    // PGRST202: CRM publicado antes de la migración; sin permiso: no es admin/administrativo.
    if (a.error) { if (a.error.code !== 'PGRST202') console.warn('por_pagar_proveedores_listar', a.error.message); raiz.hidden = true; return; }
    provs = a.data || []; salidas = s.data || []; servicios = v.data || []; catalogo = p.data || []; cuentas = c.data || [];
    cxpDe.clear(); pagosDe.clear();
    await Promise.all([...abiertos].map(cargarDetalle));
    if (tab === 'saldo') await Promise.all(provs.filter(x => x.saldo_a_favor > 0).map(x => cargarDetalle(x.proveedor_id)));
    if (n !== pedido) return;
    raiz.hidden = false;
    pintar();
  }
  const recargar = () => { cargar(); alCambiar?.(); };

  async function cargarDetalle(provId) {
    const [c, p] = await Promise.all([sb.rpc('por_pagar_cxp_listar', { p_proveedor_id: provId }), sb.rpc('pagos_proveedor_listar', { p_proveedor_id: provId })]);
    cxpDe.set(provId, c.data || []); pagosDe.set(provId, p.data || []);
  }
  async function alternar(provId) {
    if (abiertos.has(provId)) { abiertos.delete(provId); return pintar(); }
    abiertos.add(provId);
    if (!cxpDe.has(provId)) await cargarDetalle(provId);
    pintar();
  }

  function pintar() {
    if (!provs) return;
    if (!TABS.some(([k]) => k === tab)) tab = 'prov';
    if (tab === 'saldo' && provs.some(x => x.saldo_a_favor > 0 && !cxpDe.has(x.proveedor_id))) { cargar(); return; }
    const pend = provs.reduce((s, x) => s + Number(x.pendiente), 0), venc = provs.reduce((s, x) => s + Number(x.vencido), 0);
    const n = { prov: provs.filter(x => x.vencido > 0).length, salidas: salidas.length, servicios: servicios.length, saldo: provs.filter(x => x.saldo_a_favor > 0).length };
    raiz.innerHTML = `
      <div class="pp-cab"><div><h2><i class="fas fa-hand-holding-dollar"></i> Pagos a proveedores</h2>
        <div class="csub">Pendiente ${usd(pend)}${venc > 0 ? ` · <span class="pp-alerta">vencido ${usd(venc)}</span>` : ''}. Cada pago sale de una cuenta y se reparte entre las cuentas por pagar del proveedor; lo que sobra queda a favor.</div></div>
        <button class="btn-sm lt-primario" type="button" data-pp="pagar"><i class="fas fa-plus"></i> Registrar pago</button></div>
      <div class="seg-group pp-tabs" role="tablist">${TABS.map(([k, t, ic]) => `
        <button class="seg${k === tab ? ' on' : ''}" type="button" role="tab" aria-selected="${k === tab}" data-pp="tab" data-tab="${k}"><i class="fas ${ic}"></i> ${t}${n[k] ? `<span class="seg-n">${n[k]}</span>` : ''}</button>`).join('')}</div>
      <div class="pp-scroll">${tab === 'prov' ? tablaProv() : tab === 'salidas' ? tablaSalidas() : tab === 'servicios' ? tablaServicios() : tablaSaldo()}</div>`;
  }

  function tablaProv() {
    const filas = provs.filter(x => x.n_cxp > 0);
    if (!filas.length) return '<div class="pp-vacio">No hay nada pendiente con proveedores.</div>';
    return `<table class="pp-tabla"><thead><tr><th>Proveedor</th><th class="num">Pendiente</th><th class="num">Vencido</th><th>Próximo viaje</th><th class="num">A favor</th><th></th></tr></thead><tbody>${filas.map(x => `
      <tr><td><b>${esc(x.nombre)}</b><small>${x.n_cxp} cuenta${x.n_cxp === 1 ? '' : 's'}</small></td>
        <td class="num">${usd(x.pendiente)}</td><td class="num ${x.vencido > 0 ? 'pp-alerta' : 'pp-muted'}">${x.vencido > 0 ? usd(x.vencido) : '—'}</td>
        <td>${dia(x.proximo_viaje)}</td><td class="num ${x.saldo_a_favor > 0 ? 'pp-verde' : 'pp-muted'}">${x.saldo_a_favor > 0 ? usd(x.saldo_a_favor) : '—'}</td>
        <td class="acc"><button type="button" class="inbox-btn" data-pp="ver" data-id="${x.proveedor_id}" aria-expanded="${abiertos.has(x.proveedor_id)}"><i class="fas fa-chevron-${abiertos.has(x.proveedor_id) ? 'up' : 'down'}"></i> Ver</button>
          <button type="button" class="inbox-btn" data-pp="pagar" data-id="${x.proveedor_id}"><i class="fas fa-money-bill-transfer"></i> Pagar</button></td></tr>
      ${abiertos.has(x.proveedor_id) ? `<tr class="pp-det"><td colspan="6">${detalleProv(x.proveedor_id)}</td></tr>` : ''}`).join('')}</tbody></table>`;
  }

  function detalleProv(provId) {
    const cx = cxpDe.get(provId) || [], pg = (pagosDe.get(provId) || []).slice(0, 15);
    return `<div class="pp-sub">Cuentas por pagar</div>${cx.length ? `<table class="pp-tabla"><thead><tr><th>Reserva</th><th>Servicio</th><th>Viaje</th><th class="num">Monto</th><th class="num">Pagado</th><th class="num">Saldo</th><th></th></tr></thead><tbody>${cx.map(c => `
      <tr><td><b>${esc(c.codigo || '—')}</b><small>${esc(c.cliente || '')}</small></td><td>${esc(c.servicio || '')}</td>
        <td class="${c.vencida && c.saldo > 0 ? 'pp-alerta' : ''}">${dia(c.fecha_inicio)}</td><td class="num">${usd(c.monto)}</td><td class="num">${usd(c.abonado)}</td>
        <td class="num">${c.saldo > 0 ? usd(c.saldo) : `<span class="pp-verde">a favor ${usd(c.credito_por_conciliar)}</span>`}</td>
        <td class="acc">${c.sin_migrar ? '<span class="pp-estado alerta" title="Abono cargado con el botón viejo: falta pasarlo a pagos">Abono viejo</span>'
          : c.saldo > 0 ? `<button type="button" class="inbox-btn" data-pp="pagar-cxp" data-id="${c.cxp_id}" data-prov="${provId}">Pagar</button>` : ''}</td></tr>`).join('')}</tbody></table>`
      : '<div class="pp-vacio">Sin cuentas pendientes.</div>'}
      <div class="pp-sub">Últimos pagos</div>${pg.length ? `<table class="pp-tabla"><thead><tr><th>Fecha</th><th class="num">Monto</th><th>Cuenta · referencia</th><th class="num">Sin aplicar</th><th></th></tr></thead><tbody>${pg.map(p => `
      <tr><td>${dia(p.fecha)}${p.es_historico ? '<small>histórico</small>' : ''}</td>
        <td class="num">${usd(p.monto_usd)}${p.moneda === 'VES' ? `<small>${bs(p.monto)} · tasa ${p.tasa}</small>` : ''}</td>
        <td>${esc(p.cuenta || (p.es_historico ? 'Antes del sistema' : '—'))}${p.referencia ? `<small><span class="pp-ref">${esc(p.referencia)}</span></small>` : ''}</td>
        <td class="num ${p.sobrante > 0 ? 'pp-verde' : 'pp-muted'}">${p.sobrante > 0 ? usd(p.sobrante) : '—'}</td>
        <td class="acc">${admin ? (p.es_historico && p.movimiento_banco_id ? `<button type="button" class="inbox-btn" data-pp="desclasificar" data-id="${p.movimiento_banco_id}" title="Suelta la salida del banco enlazada a este pago histórico">Desenlazar salida</button>`
          : p.es_historico ? '' : `<button type="button" class="inbox-btn" data-pp="anular" data-id="${p.pago_id}" data-prov="${provId}"><i class="fas fa-ban"></i> Anular</button>`) : ''}</td></tr>`).join('')}</tbody></table>`
      : '<div class="pp-vacio">Sin pagos registrados.</div>'}`;
  }

  function tablaSalidas() {
    const hechas = [...clasificadas.values()];
    if (!salidas.length && !hechas.length) return '<div class="pp-vacio">No hay salidas del banco por clasificar.</div>';
    return `<p class="pp-nota">Salidas de Wells Fargo (Zelle enviados) que todavía no se sabe a qué corresponden. «Pago a…» registra el pago al proveedor con esa salida como comprobante.</p>
      <table class="pp-tabla"><thead><tr><th>Fecha</th><th class="num">Monto</th><th>Para</th><th>Sugerencia</th><th></th></tr></thead><tbody>${salidas.map(s => {
        const sg = s.sugerencia || {}, prov = sg.proveedor_id || s.cxp_proveedor_id;
        const txt = sg.clase === 'no_proveedor' ? `No es proveedor · ${esc(CATEGORIAS.find(c => c[0] === sg.categoria)?.[1] || sg.categoria || '')}`
          : prov ? `${esc(sg.proveedor || nombreProv(prov))}${s.cxp?.length ? `<small>calza con ${s.cxp.length} cuenta${s.cxp.length === 1 ? '' : 's'}</small>` : ''}` : '<span class="pp-muted">—</span>';
        return `<tr><td>${dia(s.fecha)}</td><td class="num">${usd(s.monto)}</td>
          <td>${esc(s.contraparte || '—')}${s.referencia ? `<small><span class="pp-ref">${esc(s.referencia)}</span></small>` : ''}</td><td>${txt}</td>
          <td class="acc"><button type="button" class="inbox-btn" data-pp="salida-pago" data-id="${s.movimiento_id}"><i class="fas fa-money-bill-transfer"></i> ${prov && sg.clase !== 'no_proveedor' ? 'Pago a ' + esc(sg.proveedor || nombreProv(prov)) : 'Pago a proveedor'}</button>
            ${s.historicos?.length ? `<button type="button" class="inbox-btn" data-pp="salida-hist" data-id="${s.movimiento_id}">Enlazar a pago histórico</button>` : ''}
            <button type="button" class="inbox-btn" data-pp="salida-no" data-id="${s.movimiento_id}">No es proveedor</button></td></tr>`; }).join('')}
      ${hechas.map(s => `<tr><td>${dia(s.fecha)}</td><td class="num">${usd(s.monto)}</td><td>${esc(s.contraparte || '—')}</td><td><span class="pp-estado ok">${esc(s.hecho)}</span></td>
        <td class="acc">${admin && s.desclasificable ? `<button type="button" class="inbox-btn" data-pp="desclasificar" data-id="${s.movimiento_id}"><i class="fas fa-rotate-left"></i> Desclasificar</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
  }

  function tablaServicios() {
    if (!servicios.length) return '<div class="pp-vacio">Todos los servicios con costo tienen proveedor.</div>';
    return `<p class="pp-nota">Servicios con costo que no tienen a quién pagarle: sin proveedor no nace la cuenta por pagar. Si el producto del tarifario tampoco tiene proveedor, conviene ponérselo ahí para que los próximos nazcan bien.</p>
      <table class="pp-tabla"><thead><tr><th>Reserva</th><th>Servicio</th><th>Viaje</th><th class="num">Costo</th><th>Proveedor</th></tr></thead><tbody>${servicios.map(s => `
      <tr><td><b>${esc(s.codigo || '—')}</b><small>${esc(s.cliente || '')}</small></td><td>${esc(s.descripcion || s.tipo || '')}<small>${esc(s.tipo || '')}${s.estado ? ' · ' + esc(s.estado) : ''}</small></td>
        <td>${dia(s.fecha_inicio)}</td><td class="num">${usd(s.costo_usd)}</td>
        <td><div class="pp-sel"><select class="ei" id="pp-srv-${s.servicio_id}" aria-label="Proveedor del servicio">${opcionesProv(null)}</select>
          <button type="button" class="inbox-btn" data-pp="asignar" data-id="${s.servicio_id}">Asignar</button>
          ${s.producto_id && irTarifario ? `<button type="button" class="inbox-btn" data-pp="tarifario" data-id="${s.producto_id}" title="Abrir el producto en el tarifario"><i class="fas fa-arrow-up-right-from-square"></i> Tarifario</button>` : ''}</div></td></tr>`).join('')}</tbody></table>`;
  }

  function tablaSaldo() {
    const conSaldo = provs.filter(x => x.saldo_a_favor > 0);
    if (!conSaldo.length) return '<div class="pp-vacio">Ningún proveedor tiene saldo a favor.</div>';
    return `<p class="pp-nota">«Sin aplicar» es plata pagada que no se repartió a ninguna cuenta: se aplica a otra cuenta del mismo proveedor. «Crédito» es lo pagado de más en una cuenta cuyo costo bajó: se libera y queda sin aplicar en el pago.</p>${conSaldo.map(x => {
      const pg = (pagosDe.get(x.proveedor_id) || []).filter(p => p.sobrante > 0), cr = (cxpDe.get(x.proveedor_id) || []).filter(c => c.credito_por_conciliar > 0);
      return `<div class="pp-sub">${esc(x.nombre)} · ${usd(x.saldo_a_favor)}</div><table class="pp-tabla"><tbody>${pg.map(p => `
        <tr><td>Pago del ${dia(p.fecha)}${p.referencia ? `<small><span class="pp-ref">${esc(p.referencia)}</span></small>` : ''}</td><td class="num pp-verde">${usd(p.sobrante)} sin aplicar</td>
          <td class="acc"><button type="button" class="inbox-btn" data-pp="aplicar" data-id="${p.pago_id}" data-prov="${x.proveedor_id}">Aplicar a una cuenta</button></td></tr>`).join('')}${cr.map(c => `
        <tr><td>${esc(c.codigo || '—')} · ${esc(c.servicio || '')}<small>${esc(c.cliente || '')}</small></td><td class="num pp-verde">${usd(c.credito_por_conciliar)} crédito</td>
          <td class="acc"><button type="button" class="inbox-btn" data-pp="liberar" data-id="${c.cxp_id}" data-prov="${x.proveedor_id}">Liberar crédito</button></td></tr>`).join('')}</tbody></table>`; }).join('')}`;
  }

  // ── Formulario «Registrar pago» ────────────────────────────────────────────
  function abrirPago({ proveedorId = null, cxpId = null, mov = null, preCxp = [] } = {}) {
    form = { idem: crypto.randomUUID(), proveedorId, mov, pre: cxpId ? [cxpId] : preCxp, cxp: [], tasa: null, tasaErr: null, archivo: null, subida: null, guardando: false,
      cuentaId: mov ? mov.cuenta_id : (cuentas.find(c => /wells/i.test(c.nombre))?.id || cuentas[0]?.id || null),
      fecha: mov ? mov.fecha : hoy(), monto: mov ? Number(mov.monto) : null, referencia: mov ? (mov.referencia || '') : '', nota: '' };
    const t = document.getElementById('pp-sheet-titulo');
    if (t) t.textContent = mov ? 'Pago a proveedor desde salida del banco' : 'Registrar pago a proveedor';
    pintarForm(); abrirSheet('pp-sheet');
    if (proveedorId) cargarCxpForm();
    actualizarTasa();
  }

  const cuentaForm = () => cuentas.find(c => c.id === form?.cuentaId) || null;
  const usdForm = () => { const m = Number(form.monto || 0), c = cuentaForm(); return c?.moneda === 'VES' ? (form.tasa ? r2(m / form.tasa) : 0) : r2(m); };
  const totalRep = () => r2(form.cxp.reduce((s, c) => s + Number(c.aplicar || 0), 0));

  async function cargarCxpForm() {
    const f = form, { data } = await sb.rpc('por_pagar_cxp_listar', { p_proveedor_id: f.proveedorId });
    if (form !== f) return;
    f.cxp = (data || []).filter(c => c.saldo > 0).map(c => ({ ...c, aplicar: f.pre.includes(c.cxp_id) && !c.sin_migrar ? Number(c.saldo) : 0 }));
    if (f.pre.length && f.monto && totalRep() > usdForm()) f.cxp.forEach(c => { c.aplicar = 0; });
    if (!f.cxp.some(c => c.aplicar > 0) && usdForm() > 0) return sugerir();
    pintarForm();
  }
  async function sugerir() {
    const f = form, m = usdForm();
    if (!f.proveedorId || m <= 0) return pintarForm();
    const { data } = await sb.rpc('pago_proveedor_sugerir_reparto', { p_proveedor_id: f.proveedorId, p_monto_usd: m });
    if (form !== f) return;
    const rep = new Map((data?.reparto || []).map(r => [r.cxp_id, Number(r.monto_usd)]));
    f.cxp.forEach(c => { c.aplicar = rep.get(c.cxp_id) || 0; });
    pintarForm();
  }
  async function actualizarTasa() {
    const f = form; f.tasa = null; f.tasaErr = null;
    if (cuentaForm()?.moneda !== 'VES') return pintarTotales();
    const { data } = await sb.rpc('pago_proveedor_tasa', { p_fecha: f.fecha });
    if (form !== f) return;
    if (data?.ok) f.tasa = Number(data.tasa); else f.tasaErr = ERRORES[data?.error] || 'Sin tasa';
    pintarTotales();
  }

  function pintarForm() {
    if (!form) return;
    const f = form, c = cuentaForm(), fijo = !!f.mov;
    hoja.innerHTML = `<div class="pp-form">
      ${f.mov ? `<p class="pp-nota ancho">Salida del ${dia(f.mov.fecha)} por ${usd(f.mov.monto)} a ${esc(f.mov.contraparte || '—')}${f.mov.referencia ? ` · <span class="pp-ref">${esc(f.mov.referencia)}</span>` : ''}. La salida es el comprobante.</p>` : ''}
      <div class="ancho"><label class="fl" for="pp-f-prov">Proveedor</label><select class="ei" id="pp-f-prov">${opcionesProv(f.proveedorId)}</select></div>
      <div><label class="fl" for="pp-f-cuenta">Cuenta de donde salió</label><select class="ei" id="pp-f-cuenta"${fijo ? ' disabled' : ''}>${cuentas.map(x => `<option value="${x.id}"${x.id === f.cuentaId ? ' selected' : ''}>${esc(x.nombre)} (${x.moneda})</option>`).join('')}</select></div>
      <div><label class="fl" for="pp-f-fecha">Fecha</label><input class="ei" id="pp-f-fecha" type="date" max="${hoy()}" value="${esc(f.fecha || '')}"${fijo ? ' disabled' : ''}></div>
      <div><label class="fl" for="pp-f-monto">Monto (${c?.moneda || 'USD'})</label><input class="ei" id="pp-f-monto" type="number" inputmode="decimal" min="0.01" step="0.01" value="${f.monto ?? ''}"${fijo ? ' disabled' : ''}><div class="pp-eq" id="pp-f-eq"></div></div>
      <div><label class="fl" for="pp-f-ref">Referencia <span style="font-weight:400">(opcional)</span></label><input class="ei" id="pp-f-ref" type="text" value="${esc(f.referencia)}"${fijo ? ' disabled' : ''}></div>
      ${fijo ? '' : `<div class="ancho"><label class="fl" for="pp-f-comp">Comprobante</label><input class="ei" id="pp-f-comp" type="file" accept="image/*,application/pdf">${f.archivo ? `<div class="pp-eq">Elegido: ${esc(f.archivo.name)}</div>` : ''}</div>`}
      <div class="ancho"><label class="fl" for="pp-f-nota">Nota <span style="font-weight:400">(opcional)</span></label><input class="ei" id="pp-f-nota" type="text" value="${esc(f.nota)}"></div>
      <div class="ancho"><div class="pp-sub" style="margin-top:4px">Reparto entre cuentas ${f.proveedorId ? `<button type="button" class="inbox-btn" id="pp-f-sugerir" style="margin-left:7px">Sugerir</button>` : ''}</div>
        <div class="pp-rep">${!f.proveedorId ? '<div class="pp-vacio">Elegí el proveedor para ver sus cuentas.</div>' : !f.cxp.length ? '<div class="pp-vacio">Sin cuentas pendientes: el pago queda como saldo a favor.</div>' : f.cxp.map(x => `
          <div class="pp-rep-fila${x.sin_migrar ? ' off' : ''}"><div><b>${esc(x.codigo || '—')}</b> · ${esc(x.servicio || '')}<small>${esc(x.cliente || '')} · viaje ${dia(x.fecha_inicio)} · saldo ${usd(x.saldo)}${x.sin_migrar ? ' · abono viejo sin migrar' : ''}</small></div>
            <input class="ei" type="number" inputmode="decimal" min="0" step="0.01" max="${x.saldo}" data-pp-apl="${x.cxp_id}" value="${x.aplicar || ''}" aria-label="Monto a aplicar"${x.sin_migrar ? ' disabled' : ''}></div>`).join('')}</div>
        <div class="pp-tot" id="pp-f-tot"></div></div>
      <div class="pp-err ancho" id="pp-f-err" role="alert"></div>
    </div>
    <div class="pp-pie"><button class="dbtn" type="button" id="pp-f-cancelar">Cancelar</button><button class="dbtn save" type="button" id="pp-f-guardar">Registrar pago</button></div>`;
    pintarTotales();
  }
  function pintarTotales() {
    if (!form) return;
    const eq = hoja.querySelector('#pp-f-eq'), tot = hoja.querySelector('#pp-f-tot'), m = usdForm(), apl = totalRep();
    if (eq) eq.innerHTML = cuentaForm()?.moneda === 'VES' ? (form.tasa ? `Tasa ${form.tasa} · equivale a <b>${usd(m)}</b>` : `<span class="pp-alerta">${esc(form.tasaErr || 'Buscando tasa…')}</span>`) : '';
    if (tot) tot.innerHTML = `<span>Pago ${usd(m)}</span><span>Aplicado ${usd(apl)}</span><span class="${apl > m ? 'pp-alerta' : m - apl > 0 ? 'pp-verde' : ''}">${apl > m ? 'Excede ' + usd(apl - m) : 'Queda a favor ' + usd(m - apl)}</span>`;
  }

  hoja.addEventListener('change', e => {
    if (!form) return;
    const t = e.target;
    if (t.id === 'pp-f-prov') { form.proveedorId = Number(t.value) || null; form.cxp = []; form.pre = []; pintarForm(); if (form.proveedorId) cargarCxpForm(); }
    else if (t.id === 'pp-f-cuenta') { form.cuentaId = Number(t.value); pintarForm(); actualizarTasa(); }
    else if (t.id === 'pp-f-fecha') { form.fecha = t.value; actualizarTasa(); }
    else if (t.id === 'pp-f-comp') form.archivo = t.files?.[0] || null;
    else if (t.id === 'pp-f-monto' && !form.cxp.some(c => c.aplicar > 0)) sugerir();
  });
  hoja.addEventListener('input', e => {
    if (!form) return;
    const t = e.target;
    if (t.id === 'pp-f-monto') form.monto = t.value === '' ? null : Number(t.value);
    else if (t.id === 'pp-f-ref') form.referencia = t.value;
    else if (t.id === 'pp-f-nota') form.nota = t.value;
    else if (t.dataset.ppApl) { const c = form.cxp.find(x => x.cxp_id === Number(t.dataset.ppApl)); if (c) c.aplicar = Number(t.value || 0); }
    pintarTotales();
  });
  hoja.addEventListener('click', e => {
    if (!form) return;
    if (e.target.closest('#pp-f-cancelar')) { form = null; cerrarSheet('pp-sheet'); }
    else if (e.target.closest('#pp-f-sugerir')) sugerir();
    else if (e.target.closest('#pp-f-guardar')) guardar();
  });

  async function guardar() {
    const f = form, err = hoja.querySelector('#pp-f-err'), btn = hoja.querySelector('#pp-f-guardar');
    const falla = t => { err.textContent = t; btn.disabled = false; f.guardando = false; };
    if (f.guardando) return;
    const c = cuentaForm(), m = r2(f.monto), musd = usdForm(), apl = totalRep();
    if (!f.proveedorId) return falla('Elegí el proveedor.');
    if (!c) return falla('Elegí la cuenta.');
    if (!(m > 0)) return falla('Escribí el monto.');
    if (c.moneda === 'VES' && !f.tasa) return falla(f.tasaErr || 'Esperá la tasa.');
    if (f.cxp.some(x => x.aplicar < 0 || x.aplicar > Number(x.saldo) + 0.004)) return falla('Un monto del reparto supera el saldo de su cuenta.');
    if (apl > musd + 0.004) return falla('El reparto supera el monto del pago.');
    f.guardando = true; btn.disabled = true; err.textContent = '';
    let path = f.mov ? null : f.subida?.path || null;
    const archivo = f.archivo;
    if (!f.mov && archivo && archivo !== f.subida?.archivo) {
      const ext = (archivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      path = `${uid()}/pagos-proveedor/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage.from('vouchers-pdf').upload(path, archivo, { contentType: archivo.type || 'image/jpeg', upsert: false });
      if (up.error) return falla('No se pudo subir el comprobante: ' + up.error.message);
      f.subida = { path, archivo };
    }
    if (!f.mov && !path) return falla('Falta el comprobante.');
    const { data, error: e } = await sb.rpc('pago_proveedor_registrar', {
      p_idem: f.idem, p_proveedor_id: f.proveedorId, p_cuenta_id: c.id, p_fecha: f.fecha, p_monto: m, p_moneda: c.moneda,
      p_referencia: f.referencia || null, p_comprobante_path: path, p_movimiento_banco_id: f.mov?.movimiento_id || null,
      p_aplicaciones: f.cxp.filter(x => x.aplicar > 0).map(x => ({ cxp_id: x.cxp_id, monto_usd: r2(x.aplicar) })), p_nota: f.nota || null });
    if (form !== f) return;
    if (e || !data?.ok) return falla('No se pudo registrar: ' + msg(data, e));
    form = null; cerrarSheet('pp-sheet');
    ok(`Pago de ${usd(data.monto_usd)} registrado${data.sobrante > 0 ? ` · ${usd(data.sobrante)} quedan a favor` : ''}.`);
    abiertos.add(f.proveedorId);
    recargar();
  }

  // ── Salidas del banco ──────────────────────────────────────────────────────
  function pagoDesdeSalida(movId) {
    const s = salidas.find(x => x.movimiento_id === movId);
    if (!s) return;
    const sg = s.sugerencia || {}, prov = sg.clase === 'no_proveedor' ? null : (sg.proveedor_id || s.cxp_proveedor_id || null);
    abrirPago({ proveedorId: prov, mov: s, preCxp: prov ? (s.cxp || []) : [] });
  }
  function marcar(s, hecho, desclasificable) { clasificadas.set(s.movimiento_id, { ...s, hecho, desclasificable }); salidas = salidas.filter(x => x.movimiento_id !== s.movimiento_id); }

  async function enlazarHistorico(movId, btn) {
    const s = salidas.find(x => x.movimiento_id === movId);
    if (!s?.historicos?.length) return;
    const r = await confirmar({ titulo: 'Enlazar a pago histórico', textoOk: 'Enlazar',
      detalle: `Salida del ${dia(s.fecha)} por ${usd(s.monto)} a ${s.contraparte || '—'}. Queda como el comprobante de un pago cargado antes del sistema (mismo monto, ±7 días).`,
      campos: [{ id: 'pago', tipo: 'radio', label: 'Pago histórico', requerido: true, valor: s.historicos.length === 1 ? s.historicos[0].pago_id : '',
        opciones: s.historicos.map(h => ({ v: h.pago_id, t: `${dia(h.fecha)} · ${usd(h.monto_usd)}` })) }] });
    if (!r?.pago) return;
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('banco_salida_enlazar_historico', { p_movimiento_id: movId, p_pago_id: Number(r.pago) });
    if (e || !data?.ok) { if (btn.isConnected) btn.disabled = false; return error('No se pudo enlazar: ' + msg(data, e)); }
    ok('Salida enlazada al pago histórico.');
    marcar(s, 'Pago histórico', false); pintar();
  }

  async function noEsProveedor(movId, btn) {
    const s = salidas.find(x => x.movimiento_id === movId);
    if (!s) return;
    const r = await confirmar({ titulo: 'No es pago a proveedor', textoOk: 'Guardar',
      detalle: `${usd(s.monto)} a ${s.contraparte || '—'} (${dia(s.fecha)}). Las próximas salidas a esta persona se van a sugerir igual.`,
      campos: [{ id: 'cat', tipo: 'radio', label: 'Qué es', requerido: true, valor: s.sugerencia?.categoria || '', opciones: CATEGORIAS.map(([v, t]) => ({ v, t })) }] });
    if (!r?.cat) return;
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('banco_salida_clasificar', { p_movimiento_id: movId, p_categoria: r.cat });
    if (e || !data?.ok) { if (btn.isConnected) btn.disabled = false; return error('No se pudo clasificar: ' + msg(data, e)); }
    ok('Salida clasificada.');
    marcar(s, CATEGORIAS.find(c => c[0] === r.cat)?.[1] || r.cat, true); pintar();
  }

  async function desclasificar(movId, btn) {
    if (!admin) return;
    const si = await confirmar({ titulo: 'Desclasificar salida', textoOk: 'Desclasificar', destructivo: true,
      detalle: 'La salida vuelve a «por clasificar». Si estaba enlazada a un pago histórico, el pago queda sin comprobante del banco.' });
    if (!si) return;
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('banco_salida_desclasificar', { p_movimiento_id: movId });
    if (e || !data?.ok) { if (btn.isConnected) btn.disabled = false; return error('No se pudo desclasificar: ' + msg(data, e)); }
    ok('Salida devuelta a «por clasificar».');
    clasificadas.delete(movId); recargar();
  }

  // ── Pagos, servicios y saldo a favor ───────────────────────────────────────
  async function anular(pagoId, provId, btn) {
    const p = (pagosDe.get(provId) || []).find(x => x.pago_id === pagoId);
    if (!p || !admin) return;
    const r = await confirmar({ titulo: 'Anular pago', textoOk: 'Anular', destructivo: true,
      detalle: `${usd(p.monto_usd)} del ${dia(p.fecha)} a ${nombreProv(provId)}. Las cuentas vuelven a quedar pendientes por lo que este pago cubría${p.movimiento_banco_id ? ' y la salida del banco queda por clasificar' : ''}.`,
      campos: [{ id: 'motivo', tipo: 'text', label: 'Motivo', requerido: true }] });
    if (!r?.motivo) return;
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('pago_proveedor_anular', { p_pago_id: pagoId, p_motivo: r.motivo });
    if (e || !data?.ok) { if (btn.isConnected) btn.disabled = false; return error('No se pudo anular: ' + msg(data, e)); }
    ok('Pago anulado.'); recargar();
  }

  async function asignarServicio(servId, btn) {
    const prov = Number(raiz.querySelector(`#pp-srv-${servId}`)?.value || 0);
    if (!prov) return error('Elegí el proveedor.');
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('servicio_asignar_proveedor', { p_servicio_id: servId, p_proveedor_id: prov });
    if (e || !data?.ok) { if (btn.isConnected) btn.disabled = false; return error('No se pudo asignar: ' + msg(data, e)); }
    const cambio = Number(data.costo_antes) !== Number(data.costo_despues) ? ` Costo ${usd(data.costo_antes)} → ${usd(data.costo_despues)}.` : '';
    ok(`Proveedor asignado.${data.cxp_id ? ' Nació la cuenta por pagar.' : ''}${cambio}`);
    recargar();
  }

  async function aplicarSaldo(pagoId, provId, btn) {
    const p = (pagosDe.get(provId) || []).find(x => x.pago_id === pagoId), cx = (cxpDe.get(provId) || []).filter(c => c.saldo > 0 && !c.sin_migrar);
    if (!p) return;
    if (!cx.length) return error('Ese proveedor no tiene cuentas pendientes donde aplicarlo.');
    const r = await confirmar({ titulo: 'Aplicar saldo a favor', textoOk: 'Aplicar', detalle: `Pago del ${dia(p.fecha)} · ${usd(p.sobrante)} sin aplicar.`,
      campos: [{ id: 'cxp', tipo: 'select', label: 'Cuenta', requerido: true, opciones: cx.map(c => ({ v: c.cxp_id, t: `${c.codigo || '—'} · ${c.servicio || ''} · saldo ${usd(c.saldo)}` })) },
        { id: 'monto', tipo: 'number', label: 'Monto (USD)', requerido: true, min: 0.01, step: 0.01, valor: Math.min(p.sobrante, cx[0].saldo) }] });
    if (!r?.cxp) return;
    const cxpId = Number(r.cxp), c = cx.find(x => x.cxp_id === cxpId), monto = r2(r.monto);
    if (!(monto > 0) || monto > p.sobrante + 0.004 || monto > Number(c.saldo) + 0.004) return error('El monto supera el saldo a favor o lo que se debe en esa cuenta.');
    const previo = Number(p.aplicaciones?.find(a => a.cxp_id === cxpId)?.monto_usd || 0);
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('pago_proveedor_aplicar_saldo', { p_pago_id: pagoId, p_cxp_id: cxpId, p_monto_usd: r2(previo + monto) });
    if (e || !data?.ok) { if (btn.isConnected) btn.disabled = false; return error('No se pudo aplicar: ' + msg(data, e)); }
    ok(`Aplicado ${usd(monto)}.`); recargar();
  }

  async function liberar(cxpId, provId, btn) {
    const c = (cxpDe.get(provId) || []).find(x => x.cxp_id === cxpId);
    if (!c) return;
    const si = await confirmar({ titulo: 'Liberar crédito', textoOk: 'Liberar',
      detalle: `${usd(c.credito_por_conciliar)} pagados de más en ${c.codigo || '—'} · ${c.servicio || ''}. Pasan a «sin aplicar» en el pago, para usarlos en otra cuenta.` });
    if (!si) return;
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('pago_proveedor_liberar_credito', { p_cxp_id: cxpId });
    if (e || !data?.ok) { if (btn.isConnected) btn.disabled = false; return error('No se pudo liberar: ' + msg(data, e)); }
    ok(`Liberado ${usd(data.liberado)}.`); recargar();
  }

  return { cargar, abrirPago };
}
