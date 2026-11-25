// Finanzas > Pagos a proveedores v2 (2026-11-20): estado de cuenta por proveedor.
// Izquierda: proveedores (debo / vencido / a favor) + bandejas «Por revisar». Derecha: ficha con cuentas
// pendientes (casillas → pagar o usar saldo), y el extracto de pagos, reembolsos y saldo inicial.
// Comprobante opcional (queda marcado «sin comprobante»); lo pagado de más queda como saldo a favor.
// RPC admin y administrativo; anular, desclasificar y saldo inicial solo admin.
// Plan: ~/.claude/plans/hay-que-modernizar-la-woolly-snail.md · migración 20261202100000_pagos_proveedor_v2
const CSS = `
.pp-barra-export{justify-content:flex-end;margin-bottom:9px}
.pp-cab{display:flex;align-items:flex-start;justify-content:space-between;gap:11px;flex-wrap:wrap}
.pp-cab h2{margin:0}
.pp-cuerpo{display:grid;grid-template-columns:minmax(240px,300px) minmax(0,1fr);gap:14px;margin-top:14px;align-items:start}
.pp-lado{display:flex;flex-direction:column;gap:9px;min-width:0}
.pp-buscar{width:100%}
.pp-chips{display:flex;gap:4px;flex-wrap:wrap}
.pp-chip{display:inline-flex;align-items:center;gap:4px;min-height:32px;padding:0 11px;border-radius:999px;border:1px solid var(--line2);background:none;color:var(--muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:background .16s,color .16s,border-color .16s}
.pp-chip span{font-size:10.5px;opacity:.8}
.pp-chip.on{background:var(--accent-soft);border-color:var(--accent);color:var(--txt)}
.pp-provs{display:flex;flex-direction:column;gap:4px}
.pp-prov{display:flex;justify-content:space-between;gap:9px;align-items:flex-start;width:100%;min-height:44px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:var(--bg2);color:inherit;font:inherit;text-align:left;cursor:pointer;transition:border-color .16s,background .16s}
.pp-prov:hover{border-color:var(--line2)}
.pp-prov.on{border-color:var(--accent);background:var(--accent-soft)}
.pp-prov-n{min-width:0}
.pp-prov-n b{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-prov small{display:block;font-size:11px;color:var(--muted);margin-top:2px}
.pp-prov-m{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.pp-prov-m b{font-size:13px}
.pp-prov-m small.pp-alerta{color:var(--amber)}
.pp-prov-m small.pp-verde{color:var(--green)}
.pp-revisar{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.pp-rev{display:grid;grid-template-columns:18px 1fr auto;gap:9px;align-items:center;min-height:44px;padding:0 11px;border:0;border-top:1px solid var(--line);background:none;color:inherit;font:inherit;font-size:12px;text-align:left;cursor:pointer;transition:background .16s}
.pp-rev:first-child{border-top:0}
.pp-rev:hover,.pp-rev.on{background:var(--accent-soft)}
.pp-rev i,.pp-rev b{color:var(--muted)}
.pp-rev b{font-variant-numeric:tabular-nums}
.pp-rev.alerta i,.pp-rev.alerta b{color:var(--amber)}
.pp-panel{min-width:0;container-type:inline-size;border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--bg2)}
.pp-elegi{padding:44px 0}
.pp-elegi i{display:block;font-size:22px;margin-bottom:9px;opacity:.6}
.pp-volver{display:none;margin-bottom:11px}
.pp-h3{margin:0 0 11px;font-size:15px}
.pp-ficha-cab{display:flex;justify-content:space-between;align-items:flex-start;gap:9px 14px;flex-wrap:wrap}
.pp-ficha-cab h3{margin:0;font-size:17px;letter-spacing:-.01em}
.pp-ficha-cab small{display:block;font-size:11px;color:var(--muted);margin-top:2px}
.pp-acc{display:flex;gap:7px;flex-wrap:wrap}
.pp-cifras{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:14px 0 4px}
.pp-cifras div{--c:var(--muted);position:relative;padding:11px 14px;border:1px solid var(--line);border-radius:12px;min-width:0;overflow:hidden;background:var(--bg)}
.pp-cifras div::before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:var(--c);opacity:.35}
.pp-cifras div[data-c]{border-color:color-mix(in srgb,var(--c) 30%,transparent);background:color-mix(in srgb,var(--c) 8%,var(--bg))}
.pp-cifras div[data-c]::before{opacity:1}
.pp-cifras div[data-c="accent"]{--c:var(--accent)}.pp-cifras div[data-c="amber"]{--c:var(--amber)}
.pp-cifras div[data-c="green"]{--c:var(--green)}.pp-cifras div[data-c="blue"]{--c:var(--blue)}
.pp-cifras span{display:flex;align-items:center;gap:7px;font-size:10.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--muted)}
.pp-cifras span i{color:var(--c);font-size:11px}
.pp-cifras b{display:block;margin-top:7px;font-size:19px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.pp-cuerpo .inbox-btn{flex:0 0 auto;min-height:32px;padding:0 11px;border-color:var(--line2);background:transparent;color:var(--txt);transition:border-color .16s,background .16s,color .16s}
.pp-cuerpo .inbox-btn:hover:not(:disabled){filter:none;border-color:var(--accent);background:var(--accent-soft)}
.pp-cuerpo .inbox-btn:disabled{border-style:dashed;color:var(--muted);opacity:.6;cursor:not-allowed}
.pp-cuerpo .inbox-btn:focus-visible,.pp-cuerpo .btn-sm:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.pp-cuerpo .inbox-btn.pp-pri{color:var(--accent-ink);background:var(--accent-soft);border-color:color-mix(in srgb,var(--accent) 35%,transparent)}
.pp-cuerpo .inbox-btn.pp-pri:hover{border-color:var(--accent)}
.pp-acc .btn-sm{display:inline-flex;align-items:center;gap:5px;min-height:32px}
.pp-barra .pp-lleno{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 14px;border:0;border-radius:10px;background:var(--accent);color:var(--on-accent);font:inherit;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 10px 22px rgba(var(--accent-rgb),.22);transition:filter .16s}
.pp-barra .pp-lleno:hover{filter:brightness(1.06)}
.pp-barra .pp-lleno:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.pp-link{border:0;background:none;color:var(--accent);font:inherit;font-size:11px;font-weight:700;letter-spacing:0;text-transform:none;cursor:pointer;margin-left:7px;padding:4px}
.pp-cxps{display:flex;flex-direction:column;gap:4px}
.pp-cxp{display:grid;grid-template-columns:28px minmax(0,1fr) 84px 130px auto;gap:9px;align-items:center;padding:4px 9px;border:1px solid var(--line);border-radius:10px;transition:border-color .16s,background .16s}
.pp-cxp.on{border-color:var(--accent);background:var(--accent-soft)}
.pp-cxp.off{opacity:.6}
.pp-chk{display:flex;align-items:center;justify-content:center;min-width:28px;min-height:44px;cursor:pointer}
.pp-chk input{-webkit-appearance:none;appearance:none;flex:none;display:inline-grid;place-content:center;width:20px;height:20px;margin:0;border:1.5px solid var(--line2);border-radius:6px;background:transparent;cursor:pointer;transition:background .16s,border-color .16s,box-shadow .16s}
.pp-chk input::before{content:"";width:11px;height:11px;background:var(--on-accent);clip-path:polygon(14% 44%,0 65%,50% 100%,100% 16%,80% 0,43% 62%);transform:scale(0);transition:transform .14s ease-out}
.pp-chk:hover input:not(:disabled){border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.pp-chk input:checked{background:var(--accent);border-color:var(--accent)}
.pp-chk input:checked::before{transform:scale(1)}
.pp-chk input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.pp-chk input:disabled{border-style:dashed;opacity:.5;cursor:not-allowed}
.pp-chk:has(input:disabled){cursor:not-allowed}
.pp-cxp-q{min-width:0;font-size:12px}
.pp-cxp small{display:block;font-size:11px;color:var(--muted)}
.pp-cxp-q small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-cxp-f{font-size:12px;white-space:nowrap}
.pp-cxp-m{text-align:right;font-variant-numeric:tabular-nums}
.pp-cxp-m b{font-size:13px}
.pp-cxp-a{display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap}
.pp-barra{position:sticky;bottom:11px;display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap;margin-top:11px;padding:9px 11px;border:1px solid var(--accent);border-radius:12px;background:var(--panel-solid);box-shadow:0 10px 22px rgba(0,0,0,.28);z-index:2}
.pp-barra>span{font-size:12px}
.pp-barra-acc{display:flex;gap:7px;flex-wrap:wrap}
.pp-movs{display:flex;flex-direction:column}
.pp-mov{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:9px;padding:11px 0;border-top:1px solid var(--line)}
.pp-mov:first-child{border-top:0}
.pp-mov-ic{color:var(--muted);padding-top:2px;text-align:center}
.pp-mov-t{font-size:12px}
.pp-mov-f{color:var(--muted);margin-left:7px}
.pp-mov-c{min-width:0}
.pp-mov-c>small{display:block;font-size:11px;color:var(--muted);margin-top:2px}
.pp-mov-chips{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
button.pp-estado{background:none;font:inherit;font-size:11px;font-weight:700;cursor:pointer;min-height:28px;gap:4px}
.pp-apl{list-style:none;margin:7px 0 0;padding:0;display:flex;flex-direction:column;gap:2px}
.pp-apl li{display:grid;grid-template-columns:minmax(0,1fr) auto 28px;gap:7px;align-items:center;font-size:12px;padding:0 0 0 9px;border-left:2px solid var(--line2)}
.pp-apl li span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-apl li small{color:var(--muted);margin-left:4px;font-size:11px}
.pp-apl b{font-variant-numeric:tabular-nums}
.pp-x{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:999px;background:none;color:var(--muted);cursor:pointer;transition:background .16s,color .16s}
.pp-x:hover{background:var(--accent-soft);color:var(--txt)}
.pp-sobra{font-size:12px;margin-top:4px}
.pp-mov-m{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.pp-mov-m b{font-size:13px}
.pp-mov-m small{display:block;font-size:11px;color:var(--muted)}
.pp-mov-m .inbox-btn{margin-top:7px}
.pp-prov-tag{margin-top:11px;font-size:10.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--muted)}
.pp-scroll{overflow-x:auto}
.pp-tabla tbody tr{cursor:default}
.pp-tabla td.num,.pp-tabla th.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.pp-tabla td small{display:block;font-size:11px;color:var(--muted);margin-top:2px}
.pp-tabla td.acc{white-space:nowrap;text-align:right}
.pp-tabla td.acc .inbox-btn{margin-left:4px}
.pp-ref{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;user-select:all;word-break:break-all}
.pp-alerta{color:var(--amber);font-weight:700}
.pp-verde{color:var(--green);font-weight:700}
.pp-muted{color:var(--muted)}
.pp-error-txt{color:var(--danger);font-weight:700}
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
.pp-drop{display:flex;align-items:center;gap:11px;min-height:54px;padding:9px 11px;border:1px dashed var(--line2);border-radius:10px;cursor:pointer;transition:border-color .16s,background .16s}
.pp-drop:hover,.pp-drop:focus-within{border-color:var(--accent);background:var(--accent-soft)}
.pp-drop.lleno{border-style:solid}
.pp-drop>span{flex:1;min-width:0;font-size:12px}
.pp-drop b{overflow-wrap:anywhere}
.pp-drop small{display:block;color:var(--muted);font-size:11px;margin-top:2px}
.pp-oculto{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.pp-rep{display:flex;flex-direction:column;gap:7px}
.pp-rep-fila{display:grid;grid-template-columns:1fr 120px;gap:9px;align-items:center;padding:7px 9px;border:1px solid var(--line);border-radius:10px}
.pp-rep-fila.off{opacity:.55}
.pp-rep-fila.on{border-color:var(--accent)}
.pp-rep-fila small{display:block;font-size:11px;color:var(--muted)}
.pp-rep-fila input{text-align:right}
.pp-tot{display:flex;justify-content:space-between;gap:11px;flex-wrap:wrap;font-size:12px;font-weight:700;padding:9px 2px}
.pp-err{color:var(--danger);font-size:12px;font-weight:700;min-height:16px}
.pp-pie{display:flex;gap:9px;padding-top:11px}
.pp-pie .dbtn{flex:1}
.sal{border:1px solid var(--line);border-radius:10px;padding:0 11px}
.sal>summary{display:flex;justify-content:space-between;align-items:center;gap:7px;min-height:44px;cursor:pointer;font-size:12px;font-weight:800;list-style:none}
.sal>summary::-webkit-details-marker{display:none}
.sal-fila{display:grid;grid-template-columns:18px 1fr 36px 84px 14px;gap:9px;align-items:center;min-height:32px;padding:4px 0;border:0;border-top:1px solid var(--line);background:none;color:inherit;font:inherit;font-size:12px;text-align:left;width:100%}
button.sal-fila{min-height:44px;cursor:pointer;transition:background .16s}
button.sal-fila:hover{background:var(--accent-soft)}
.sal-fila small{display:block;font-size:11px;color:var(--muted)}
.sal-ic{text-align:center}
.sal-n,.sal-monto{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}
.sal-fila.ok .sal-ic,.sal-fila.ok .sal-n{color:var(--green)}
.sal-fila.alerta .sal-ic,.sal-fila.alerta .sal-n,.sal-fila.alerta .sal-monto{color:var(--amber)}
.sal-ir{color:var(--muted);font-size:10px}
@container (max-width:620px){
  .pp-cxp{grid-template-columns:28px minmax(0,1fr) auto;grid-template-areas:"chk q m" "chk f a";row-gap:2px;padding:7px 9px}
  .pp-chk{grid-area:chk}.pp-cxp-q{grid-area:q}.pp-cxp-f{grid-area:f}.pp-cxp-m{grid-area:m}.pp-cxp-a{grid-area:a}
  .pp-cifras{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:760px){
  .pp-cuerpo{grid-template-columns:minmax(0,1fr)}
  .pp-cuerpo[data-vista="panel"] .pp-lado{display:none}
  .pp-cuerpo[data-vista="lista"] .pp-panel{display:none}
  .pp-volver{display:inline-flex;min-height:44px}
  .pp-panel{padding:11px}
  .pp-acc .btn-sm,.pp-cuerpo .inbox-btn,.pp-barra .pp-lleno{min-height:44px}
}
@media (max-width:560px){.pp-form{grid-template-columns:1fr}.pp-rep-fila{grid-template-columns:1fr 96px}}
`;
const SALUD = [['salida_wf_sin_clasificar', 'Salidas WF sin clasificar (más de 3 días)', 'salidas'], ['servicio_sin_proveedor', 'Servicios con costo y sin proveedor', 'servicios'],
  ['pago_proveedor_sin_comprobante', 'Pagos a proveedores sin comprobante', 'sincomp'],
  ['cxp_sin_proveedor', 'Cuentas por pagar sin proveedor', null], ['venta_sin_factura', 'Ventas cobradas sin factura pagada', null],
  ['pagado_sin_abono', 'Reservas con pago y sin abono registrado', null], ['abono_sin_comprobante', 'Abonos sin comprobante', null],
  ['total_distinto_factura', 'Total de la reserva distinto al de la factura', null], ['reserva_sin_costo', 'Reservas facturadas sin costo', null]];
const BANDEJAS = [['salidas', 'Salidas WF por clasificar', 'fa-building-columns'], ['servicios', 'Servicios sin proveedor', 'fa-circle-question'],
  ['sincomp', 'Pagos sin comprobante', 'fa-paperclip']];
const FILTROS = [['deuda', 'Debo'], ['vencidas', 'Vencidas'], ['favor', 'A favor'], ['todos', 'Todos']];
const CATEGORIAS = [['gasto', 'Gasto de la agencia'], ['nomina', 'Nómina'], ['comision', 'Comisión']];
const ERRORES = {
  falta_idem: 'Reabrí el formulario y probá de nuevo.', proveedor_inexistente: 'Elegí un proveedor.',
  monto_invalido: 'Monto inválido (máximo 2 decimales).', moneda_invalida: 'Moneda inválida.',
  fecha_invalida: 'La fecha no puede ser futura.', aplicaciones_invalidas: 'Revisá los montos del reparto.',
  movimiento_invalido: 'Esa salida del banco ya no existe.', movimiento_ya_clasificado: 'Esa salida ya fue clasificada por otra persona.',
  monto_distinto_al_movimiento: 'El monto tiene que ser igual al de la salida del banco.',
  cuenta_distinta_al_movimiento: 'La cuenta tiene que ser la de la salida del banco.', falta_comprobante: 'No se pudo guardar el comprobante.',
  cuenta_invalida: 'Elegí la cuenta.', moneda_distinta_a_la_cuenta: 'La moneda no coincide con la cuenta.',
  sin_tasa_para_fecha: 'No hay tasa BCV para esa fecha: cargá la tasa o usá otra fecha.', excede_pago: 'El reparto supera el monto del pago.',
  excede_saldo: 'El reparto supera lo que se le debe a esa cuenta.', excede_cxp: 'Supera lo que se le debe a esa cuenta.',
  cxp_sin_migrar: 'Esa cuenta tiene un abono viejo sin migrar; avisale al admin.',
  pago_inexistente: 'El pago ya no existe.', cxp_inexistente: 'La cuenta ya no existe.', cxp_anulada: 'La cuenta está anulada.',
  sin_credito: 'No hay crédito para liberar.', falta_motivo: 'Escribí el motivo.', ya_anulado: 'Ya estaba anulado.', reintentar: 'Cambió mientras tanto, probá de nuevo.',
  categoria_invalida: 'Elegí una categoría.', pago_no_historico: 'Ese pago no es histórico o está anulado.',
  pago_ya_enlazado: 'Ese pago histórico ya tiene una salida enlazada.', sin_clasificar: 'Esa salida no estaba clasificada.',
  anular_el_pago: 'Esa salida es un pago: anulá el pago para liberarla.', servicio_inexistente: 'El servicio ya no existe.',
  servicio_anulado: 'El servicio está anulado.', cxp_con_pagos_de_otro_proveedor: 'Esa cuenta ya tiene pagos de otro proveedor.',
  producto_inexistente: 'El producto ya no existe.', historico_parcial: 'El pago histórico tiene que cubrir el abono viejo completo.',
  excede_saldo_a_favor: 'Supera el saldo a favor del proveedor. Si el sobrante de ese pago ya se reembolsó, anulá antes el reembolso.',
  sin_saldo: 'El proveedor no tiene saldo a favor.', sin_cuentas: 'Elegí al menos una cuenta.', nada_que_aplicar: 'No había nada que cubrir en esas cuentas.',
  aplicacion_inexistente: 'Eso ya no estaba aplicado.', pago_anulado: 'El pago está anulado.',
  reserva_historica: 'Es una reserva histórica: ese pago no se mueve.', no_adjuntable: 'Ese movimiento ya tiene comprobante.',
  tipo_invalido: 'Movimiento inválido.', falta_nota: 'Escribí de dónde sale ese saldo.', reembolso_inexistente: 'El reembolso ya no existe.',
  proveedor_distinto: 'Esa cuenta es de otro proveedor.'
};

export function crearFinanzasPorPagar({ sb, esc, ok, error, confirmar, rol, raiz, hoja, abrirSheet, cerrarSheet, hoy, uid, irTarifario, verVenta, leerComprobante, alCambiar }) {
  const admin = rol === 'admin';
  let pedido = 0, provs = null, salidas = [], servicios = [], catalogo = [], cuentas = [], salud = null, sinComp = null;
  let vista = null, filtro = 'deuda', buscar = '', form = null, adjPend = null;
  const cxpDe = new Map(), movDe = new Map(), clasificadas = new Map(), sel = new Set();
  try { filtro = localStorage.getItem('pp_filtro') || 'deuda'; } catch {}
  const usd = n => '$' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const bs = n => 'Bs ' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dia = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
  const r2 = n => Math.round(Number(n || 0) * 100) / 100;
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const movil = () => matchMedia('(max-width:760px)').matches;
  const msg = (data, e) => ERRORES[data?.error] || data?.error || e?.message || 'error desconocido';
  const nombreProv = id => catalogo.find(p => p.id === id)?.nombre || provs?.find(p => p.proveedor_id === id)?.nombre || `Proveedor ${id}`;
  const opcionesProv = sel => `<option value="">Elegí proveedor…</option>${catalogo.filter(p => p.activo || p.id === sel).map(p =>
    `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}`;
  const favor = x => Number(x?.saldo_a_favor || 0);
  const cuentaDefecto = () => cuentas.find(c => /wells/i.test(c.nombre))?.id || cuentas.find(c => c.moneda === 'USD')?.id || cuentas[0]?.id || null;

  if (!document.getElementById('pp-css')) {
    const st = document.createElement('style'); st.id = 'pp-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  // Fuera de raiz: pintar() reemplaza todo su contenido.
  const inputAdj = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*,application/pdf', hidden: true });
  document.body.appendChild(inputAdj);

  raiz.addEventListener('click', e => {
    const b = e.target.closest('[data-pp]');
    if (!b || b.disabled) return;
    const id = Number(b.dataset.id), d = b.dataset, provId = vista?.t === 'prov' ? vista.id : null;
    switch (d.pp) {
      case 'prov': return abrirProveedor(id);
      case 'volver': vista = null; sel.clear(); return pintar();
      case 'filtro': filtro = d.f; try { localStorage.setItem('pp_filtro', filtro); } catch {} return pintar();
      case 'bandeja': return abrirBandeja(d.b);
      case 'pagar': return abrirPago({ proveedorId: id || provId });
      case 'pagar-cxp': return abrirPago({ proveedorId: provId, cxpId: id });
      case 'pagar-sel': return abrirPago({ proveedorId: provId, preCxp: [...sel] });
      case 'usar': return usarSaldo([id], b);
      case 'usar-sel': return usarSaldo([...sel], b);
      case 'sel-todas': return selTodas();
      case 'reembolso': return reembolso(id, b);
      case 'inicial': return saldoInicial(id, b);
      case 'adjuntar': adjPend = { tipo: d.tipo, id }; return inputAdj.click();
      case 'ver-comp': return verComprobante(d.path, b);
      case 'desaplicar': return desaplicar(id, Number(d.prov), Number(d.monto), d.cod, b);
      case 'anular': return anular(id, Number(d.prov), b);
      case 'anular-reemb': return anularReembolso(id, Number(d.prov), b);
      case 'liberar': return liberar(id, Number(d.prov), b);
      case 'salida-pago': return pagoDesdeSalida(id);
      case 'salida-hist': return enlazarHistorico(id, b);
      case 'salida-no': return noEsProveedor(id, b);
      case 'desclasificar': return desclasificar(id, b);
      case 'asignar': return asignarServicio(id, b);
      case 'tarifario': return irTarifario?.(id);
      case 'venta': return verVenta?.(id, d.cod);
    }
  });
  raiz.addEventListener('change', e => {
    const t = e.target;
    if (!t.dataset.ppSel) return;
    const id = Number(t.dataset.ppSel);
    if (t.checked) sel.add(id); else sel.delete(id);
    pintarPanel();
    raiz.querySelector(`[data-pp-sel="${id}"]`)?.focus();
  });
  raiz.addEventListener('input', e => {
    if (!e.target.classList.contains('pp-buscar')) return;
    buscar = e.target.value;
    const l = raiz.querySelector('.pp-provs');
    if (l) l.innerHTML = listaProvs();
  });
  inputAdj.addEventListener('change', async () => {
    const f = inputAdj.files?.[0], p = adjPend;
    inputAdj.value = ''; adjPend = null;
    if (!f || !p) return;
    const up = await subir(f);
    if (up.error) return error('No se pudo subir el comprobante: ' + up.error);
    const { data, error: e } = await sb.rpc('pago_proveedor_adjuntar_comprobante', { p_tipo: p.tipo, p_id: p.id, p_path: up.path });
    if (e || !data?.ok) return error('No se pudo adjuntar: ' + msg(data, e));
    ok('Comprobante adjuntado.'); recargar();
  });

  // ── Carga ──────────────────────────────────────────────────────────────────
  async function cargar() {
    const n = ++pedido;
    const [a, s, v, p, c, h] = await Promise.all([sb.rpc('por_pagar_proveedores_listar'), sb.rpc('banco_salidas_por_clasificar'),
      sb.rpc('servicios_sin_proveedor_listar'), catalogo.length ? { data: catalogo } : sb.rpc('listar_proveedores', { p_solo_activos: false }),
      cuentas.length ? { data: cuentas } : sb.rpc('cuentas_financieras_listar'), admin ? sb.rpc('finanzas_salud') : { data: null }]);
    if (n !== pedido) return;
    if (h.error) console.warn('finanzas_salud', h.error.message);
    salud = h.error ? null : h.data;
    // PGRST202: CRM publicado antes de la migración; sin permiso: no es admin/administrativo.
    if (a.error) { if (a.error.code !== 'PGRST202') console.warn('por_pagar_proveedores_listar', a.error.message); raiz.hidden = true; return; }
    provs = a.data || []; salidas = s.data || []; servicios = v.data || []; catalogo = p.data || []; cuentas = c.data || [];
    cxpDe.clear(); movDe.clear(); sinComp = null;
    if (!vista && !movil()) { const f = filtrados()[0]; if (f) vista = { t: 'prov', id: f.proveedor_id }; }
    if (vista?.t === 'prov') await cargarDetalle(vista.id);
    else if (vista?.t === 'sincomp') await cargarSinComp();
    if (n !== pedido) return;
    raiz.hidden = false;
    pintar();
  }
  const recargar = () => { cargar(); alCambiar?.(); };

  async function cargarDetalle(provId) {
    const [c, m] = await Promise.all([sb.rpc('por_pagar_cxp_listar', { p_proveedor_id: provId }), sb.rpc('proveedor_movimientos_listar', { p_proveedor_id: provId })]);
    if (c.error || m.error) console.warn('detalle proveedor', (c.error || m.error).message);
    cxpDe.set(provId, c.data || []); movDe.set(provId, m.data || []);
  }
  async function cargarSinComp() {
    const ps = (provs || []).filter(x => x.n_sin_comprobante > 0);
    const rs = await Promise.all(ps.map(x => sb.rpc('proveedor_movimientos_listar', { p_proveedor_id: x.proveedor_id })));
    ps.forEach((x, i) => movDe.set(x.proveedor_id, rs[i].data || []));
    sinComp = rs.flatMap((r, i) => (r.data || []).filter(m => m.sin_comprobante).map(m => ({ ...m, proveedor: ps[i].nombre, proveedor_id: ps[i].proveedor_id })));
  }
  async function abrirProveedor(id) {
    if (!(vista?.t === 'prov' && vista.id === id)) sel.clear();
    vista = { t: 'prov', id };
    pintar();
    if (!provs) return;
    if (!cxpDe.has(id) || !movDe.has(id)) { await cargarDetalle(id); if (vista?.t === 'prov' && vista.id === id) pintarPanel(); }
    if (movil()) raiz.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  async function abrirBandeja(k) {
    sel.clear(); vista = { t: k };
    pintar();
    if (k === 'sincomp') { await cargarSinComp(); if (vista?.t === 'sincomp') pintarPanel(); }
    if (movil()) raiz.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // ── Pantalla ───────────────────────────────────────────────────────────────
  function filtrados() {
    const q = norm(buscar);
    return (provs || []).filter(x => (filtro === 'todos' || (filtro === 'deuda' && x.pendiente > 0) || (filtro === 'vencidas' && x.vencido > 0)
      || (filtro === 'favor' && (favor(x) > 0 || x.credito_por_conciliar > 0))) && (!q || norm(x.nombre).includes(q)));
  }
  function pintar() {
    if (!provs) return;
    const t = provs.reduce((a, x) => (a.p += Number(x.pendiente), a.v += Number(x.vencido), a.f += favor(x), a), { p: 0, v: 0, f: 0 });
    raiz.innerHTML = `<div class="pp-cab"><div><h2><i class="fas fa-hand-holding-dollar"></i> Pagos a proveedores</h2>
        <div class="csub">Debo ${usd(t.p)}${t.v > 0 ? ` · <span class="pp-alerta">vencido ${usd(t.v)}</span>` : ''}${t.f > 0 ? ` · <span class="pp-verde">a favor ${usd(t.f)}</span>` : ''}</div></div>
        <button class="btn-sm lt-primario" type="button" data-pp="pagar"><i class="fas fa-plus"></i> Registrar pago</button></div>
      <div class="pp-cuerpo" data-vista="${vista ? 'panel' : 'lista'}"><aside class="pp-lado">${lado()}</aside><section class="pp-panel">${panel()}</section></div>`;
  }
  function pintarPanel() {
    const p = raiz.querySelector('.pp-panel');
    if (!p) return pintar();
    p.innerHTML = panel();
    raiz.querySelectorAll('.pp-prov').forEach(b => { const on = vista?.t === 'prov' && Number(b.dataset.id) === vista.id; b.classList.toggle('on', on); b.setAttribute('aria-current', on); });
  }

  function lado() {
    const n = { deuda: provs.filter(x => x.pendiente > 0).length, vencidas: provs.filter(x => x.vencido > 0).length,
      favor: provs.filter(x => favor(x) > 0 || x.credito_por_conciliar > 0).length, todos: provs.length };
    const nRev = { salidas: salidas.length, servicios: servicios.length, sincomp: provs.reduce((s, x) => s + Number(x.n_sin_comprobante || 0), 0) };
    return `<input class="ei pp-buscar" type="search" placeholder="Buscar proveedor…" aria-label="Buscar proveedor" value="${esc(buscar)}">
      <div class="pp-chips" role="group" aria-label="Filtrar proveedores">${FILTROS.map(([k, t]) =>
        `<button type="button" class="pp-chip${filtro === k ? ' on' : ''}" data-pp="filtro" data-f="${k}" aria-pressed="${filtro === k}">${t}<span>${n[k]}</span></button>`).join('')}</div>
      <div class="pp-provs">${listaProvs()}</div>
      <div class="pp-sub">Por revisar</div>
      <div class="pp-revisar">${BANDEJAS.map(([k, t, ic]) => `<button type="button" class="pp-rev${vista?.t === k ? ' on' : ''}${nRev[k] ? ' alerta' : ''}" data-pp="bandeja" data-b="${k}">
        <i class="fas ${ic}" aria-hidden="true"></i><span>${t}</span><b>${nRev[k]}</b></button>`).join('')}</div>
      ${tarjetaSalud()}`;
  }
  function listaProvs() {
    const l = filtrados();
    if (!l.length) return `<div class="pp-vacio">${buscar ? 'Ningún proveedor coincide.' : filtro === 'favor' ? 'Ningún proveedor tiene saldo a favor.' : filtro === 'vencidas' ? 'Nada vencido.' : 'No hay nada pendiente con proveedores.'}</div>`;
    return l.map(x => {
      const on = vista?.t === 'prov' && vista.id === x.proveedor_id, f = favor(x) + Number(x.credito_por_conciliar || 0);
      return `<button type="button" class="pp-prov${on ? ' on' : ''}" data-pp="prov" data-id="${x.proveedor_id}" aria-current="${on}">
        <span class="pp-prov-n"><b>${esc(x.nombre)}</b><small>${x.n_cxp ? `${x.n_cxp} cuenta${x.n_cxp === 1 ? '' : 's'}` : 'Sin cuentas pendientes'}${x.proximo_viaje ? ` · viaje ${dia(x.proximo_viaje)}` : ''}</small></span>
        <span class="pp-prov-m">${x.pendiente > 0 ? `<b>${usd(x.pendiente)}</b>` : '<b class="pp-muted">—</b>'}${x.vencido > 0 ? `<small class="pp-alerta">vencido ${usd(x.vencido)}</small>` : ''}${f > 0 ? `<small class="pp-verde">a favor ${usd(f)}</small>` : ''}</span></button>`;
    }).join('');
  }
  function tarjetaSalud() {
    if (!admin || !salud?.checks) return '';
    const total = Number(salud.total) || 0;
    const filas = SALUD.map(([k, t, dest]) => {
      const c = salud.checks[k] || { n: 0, monto: 0, n_historico: 0 }, cero = !c.n, ir = !cero && dest;
      const cuerpo = `<i class="fas ${cero ? 'fa-circle-check' : 'fa-triangle-exclamation'} sal-ic" aria-hidden="true"></i>
        <span>${t}${c.n_historico ? `<small>+${c.n_historico} históricas, aparte</small>` : ''}</span>
        <span class="sal-n">${c.n}</span><span class="sal-monto">${cero ? '' : usd(c.monto)}</span>${ir ? '<i class="fas fa-chevron-right sal-ir" aria-hidden="true"></i>' : '<span></span>'}`;
      return ir ? `<button type="button" class="sal-fila alerta" data-pp="bandeja" data-b="${dest}">${cuerpo}</button>` : `<div class="sal-fila ${cero ? 'ok' : 'alerta'}">${cuerpo}</div>`;
    }).join('');
    return `<details class="sal"><summary><span><i class="fas fa-heart-pulse"></i> Salud de finanzas</span>${total ? `<span class="pp-alerta">${total} por resolver</span>` : '<span class="pp-verde">Todo en orden</span>'}</summary>${filas}</details>`;
  }

  function panel() {
    if (!vista) return '<div class="pp-vacio pp-elegi"><i class="fas fa-truck-field" aria-hidden="true"></i>Elegí un proveedor para ver su estado de cuenta.</div>';
    const volver = '<button type="button" class="inbox-btn pp-volver" data-pp="volver"><i class="fas fa-arrow-left"></i> Proveedores</button>';
    if (vista.t === 'salidas') return `${volver}<h3 class="pp-h3">Salidas WF por clasificar</h3>${tablaSalidas()}`;
    if (vista.t === 'servicios') return `${volver}<h3 class="pp-h3">Servicios sin proveedor</h3>${tablaServicios()}`;
    if (vista.t === 'sincomp') return `${volver}<h3 class="pp-h3">Pagos sin comprobante</h3>${tablaSinComp()}`;
    return volver + ficha(vista.id);
  }

  function ficha(id) {
    const x = provs.find(p => p.proveedor_id === id) || { proveedor_id: id, nombre: nombreProv(id), pendiente: 0, vencido: 0, saldo_a_favor: 0, credito_por_conciliar: 0 };
    const fav = favor(x), cx = cxpDe.get(id), mv = movDe.get(id);
    const cab = `<div class="pp-ficha-cab"><div><h3>${esc(x.nombre)}</h3>${x.ultimo_pago ? `<small>Último pago ${dia(x.ultimo_pago)}</small>` : ''}</div>
      <div class="pp-acc"><button class="btn-sm lt-primario" type="button" data-pp="pagar" data-id="${id}"><i class="fas fa-money-bill-transfer"></i> Registrar pago</button>
        <button class="inbox-btn" type="button" data-pp="reembolso" data-id="${id}"${fav > 0 ? '' : ' disabled title="Sin saldo a favor para reembolsar"'}><i class="fas fa-rotate-left"></i> Reembolso</button>
        ${admin ? `<button class="inbox-btn" type="button" data-pp="inicial" data-id="${id}" title="Saldo a favor que ya existía antes del sistema"><i class="fas fa-flag"></i> Saldo inicial</button>` : ''}</div></div>
      <div class="pp-cifras"><div${x.pendiente > 0 ? ' data-c="accent"' : ''}><span><i class="fas fa-file-invoice-dollar" aria-hidden="true"></i>Debo</span><b>${usd(x.pendiente)}</b></div>
        <div${x.vencido > 0 ? ' data-c="amber"' : ''}><span><i class="fas fa-clock" aria-hidden="true"></i>Vencido</span><b class="${x.vencido > 0 ? 'pp-alerta' : 'pp-muted'}">${x.vencido > 0 ? usd(x.vencido) : '—'}</b></div>
        <div${fav > 0 ? ' data-c="green"' : ''}><span><i class="fas fa-piggy-bank" aria-hidden="true"></i>A favor</span><b class="${fav > 0 ? 'pp-verde' : 'pp-muted'}">${usd(fav)}</b></div>
        <div${x.proximo_viaje ? ' data-c="blue"' : ''}><span><i class="fas fa-plane-departure" aria-hidden="true"></i>Próximo viaje</span><b${x.proximo_viaje ? '' : ' class="pp-muted"'}>${dia(x.proximo_viaje)}</b></div></div>`;
    if (!cx || !mv) return `${cab}<div class="pp-vacio">Cargando…</div>`;
    const pend = cx.filter(c => c.saldo > 0), cr = cx.filter(c => c.credito_por_conciliar > 0);
    const elegibles = pend.filter(c => !c.sin_migrar), todas = elegibles.length > 0 && elegibles.every(c => sel.has(c.cxp_id));
    const selL = pend.filter(c => sel.has(c.cxp_id)), selTot = r2(selL.reduce((s, c) => s + Number(c.saldo), 0));
    return `${cab}
      <div class="pp-sub">Cuentas pendientes${elegibles.length > 1 ? `<button type="button" class="pp-link" data-pp="sel-todas">${todas ? 'Ninguna' : 'Elegir todas'}</button>` : ''}</div>
      ${pend.length ? `<div class="pp-cxps">${pend.map(c => cxpFila(c, fav)).join('')}</div>`
        : `<div class="pp-vacio">Nada pendiente con ${esc(x.nombre)}.${fav > 0 ? ' El saldo a favor queda para la próxima cuenta.' : ''}</div>`}
      ${selL.length ? `<div class="pp-barra" role="region" aria-label="Cuentas elegidas"><span><b>${selL.length}</b> elegida${selL.length === 1 ? '' : 's'} · ${usd(selTot)}</span>
        <div class="pp-barra-acc">${fav > 0 ? `<button type="button" class="inbox-btn" data-pp="usar-sel"><i class="fas fa-piggy-bank"></i> Usar saldo ${usd(Math.min(fav, selTot))}</button>` : ''}
          <button type="button" class="pp-lleno" data-pp="pagar-sel"><i class="fas fa-money-bill-transfer"></i> Pagar ${usd(selTot)}</button></div></div>` : ''}
      ${cr.length ? `<div class="pp-sub">Pagado de más por conciliar</div><p class="pp-nota">Cuentas de reservas históricas o con abono viejo cuyo costo bajó. Al pasarlo a saldo a favor se puede usar en otra cuenta.</p>
        <div class="pp-cxps">${cr.map(c => `<div class="pp-cxp"><span></span><div class="pp-cxp-q"><b>${esc(c.codigo || '—')}</b> ${esc(c.cliente || '')}<small>${esc(c.servicio || '')}</small></div>
          <div class="pp-cxp-f"></div><div class="pp-cxp-m"><b class="pp-verde">${usd(c.credito_por_conciliar)}</b></div>
          <div class="pp-cxp-a"><button type="button" class="inbox-btn" data-pp="liberar" data-id="${c.cxp_id}" data-prov="${id}">Pasar a saldo a favor</button></div></div>`).join('')}</div>` : ''}
      <div class="pp-sub">Movimientos</div>
      ${mv.length ? `<div class="pp-movs">${mv.map(m => movFila(m, id)).join('')}</div>` : '<div class="pp-vacio">Sin pagos registrados.</div>'}
      ${mv.length >= 500 ? '<p class="pp-nota">Se muestran los 500 movimientos más recientes.</p>' : ''}`;
  }
  function cxpFila(c, fav) {
    const on = sel.has(c.cxp_id), cod = esc(c.codigo || '—');
    return `<div class="pp-cxp${on ? ' on' : ''}${c.sin_migrar ? ' off' : ''}">
      <label class="pp-chk"><input type="checkbox" data-pp-sel="${c.cxp_id}"${on ? ' checked' : ''}${c.sin_migrar ? ' disabled' : ''} aria-label="Elegir ${cod}"></label>
      <div class="pp-cxp-q">${verVenta && c.reserva_id ? `<button type="button" class="pp-venta" data-pp="venta" data-id="${c.reserva_id}" data-cod="${esc(c.codigo || '')}" title="Abrir la venta: cobro al cliente y pagos">${cod}</button>` : `<b>${cod}</b>`} ${esc(c.cliente || '')}<small>${esc(c.servicio || '')}</small></div>
      <div class="pp-cxp-f${c.vencida ? ' pp-alerta' : ''}"><small>${c.vencida ? 'Viajó' : 'Viaja'}</small>${dia(c.fecha_inicio)}</div>
      <div class="pp-cxp-m"><small>${Number(c.abonado) > 0 ? `pagado ${usd(c.abonado)} de ${usd(c.monto)}` : 'debo'}</small><b>${usd(c.saldo)}</b></div>
      <div class="pp-cxp-a">${c.sin_migrar ? '<span class="pp-estado alerta" title="Abono cargado con el botón viejo: falta pasarlo a pagos">Abono viejo</span>'
        : `${fav > 0 ? `<button type="button" class="inbox-btn" data-pp="usar" data-id="${c.cxp_id}" title="Cubrir con el saldo a favor">Usar saldo</button>` : ''}<button type="button" class="inbox-btn pp-pri" data-pp="pagar-cxp" data-id="${c.cxp_id}">Pagar</button>`}</div></div>`;
  }
  function movFila(m, provId) {
    const reemb = m.clase === 'reembolso', ini = m.clase === 'saldo_inicial';
    const ic = reemb ? 'fa-rotate-left' : ini ? 'fa-flag' : 'fa-money-bill-transfer';
    const tit = reemb ? 'Reembolso del proveedor' : ini ? 'Saldo inicial' : 'Pago';
    const donde = m.cuenta || (m.es_historico ? 'antes del sistema' : '');
    const chips = [];
    if (m.es_historico) chips.push('<span class="pp-estado">histórico</span>');
    if (m.movimiento_banco_id) chips.push('<span class="pp-estado ok"><i class="fas fa-building-columns"></i>&nbsp;Salida WF</span>');
    if (m.comprobante_path) chips.push(`<button type="button" class="pp-estado ok" data-pp="ver-comp" data-path="${esc(m.comprobante_path)}"><i class="fas fa-paperclip"></i> Comprobante</button>`);
    if (m.sin_comprobante) chips.push(`<button type="button" class="pp-estado alerta" data-pp="adjuntar" data-tipo="${reemb ? 'reembolso' : 'pago'}" data-id="${m.id}"><i class="fas fa-paperclip"></i> Sin comprobante · Adjuntar</button>`);
    const apl = (m.aplicaciones || []).map(a => `<li><span>${esc(a.codigo || '—')} · ${esc(a.cliente || '')}<small>${esc(a.servicio || '')}</small></span><b>${usd(a.monto_usd)}</b>
      <button type="button" class="pp-x" data-pp="desaplicar" data-id="${a.aplicacion_id}" data-prov="${provId}" data-monto="${a.monto_usd}" data-cod="${esc(a.codigo || '')}" title="Quitar de esta cuenta: vuelve a saldo a favor" aria-label="Quitar ${usd(a.monto_usd)} de ${esc(a.codigo || 'la cuenta')}"><i class="fas fa-xmark"></i></button></li>`).join('');
    const anulable = admin && (reemb || !m.es_historico);
    return `<div class="pp-mov"><i class="fas ${ic} pp-mov-ic" aria-hidden="true"></i>
      <div class="pp-mov-c"><div class="pp-mov-t"><b>${tit}</b>${donde ? ` · ${esc(donde)}` : ''}<span class="pp-mov-f">${dia(m.fecha)}</span></div>
        ${m.referencia ? `<small>Ref. <span class="pp-ref">${esc(m.referencia)}</span></small>` : ''}${m.nota ? `<small>${esc(m.nota)}</small>` : ''}
        ${chips.length ? `<div class="pp-mov-chips">${chips.join('')}</div>` : ''}
        ${apl ? `<ul class="pp-apl" aria-label="Aplicado a">${apl}</ul>` : ''}
        ${!reemb && m.sobrante > 0 ? `<div class="pp-verde pp-sobra">${usd(m.sobrante)} quedan a favor</div>` : ''}</div>
      <div class="pp-mov-m"><b class="${reemb ? 'pp-verde' : ''}">${reemb ? '+' : ''}${usd(m.monto_usd)}</b>${m.moneda === 'VES' ? `<small>${bs(m.monto)} · tasa ${m.tasa}</small>` : ''}
        ${anulable ? `<button type="button" class="inbox-btn" data-pp="${reemb ? 'anular-reemb' : 'anular'}" data-id="${m.id}" data-prov="${provId}"><i class="fas fa-ban"></i> Anular</button>` : ''}</div></div>`;
  }

  function tablaSalidas() {
    const hechas = [...clasificadas.values()];
    if (!salidas.length && !hechas.length) return '<div class="pp-vacio">No hay salidas del banco por clasificar.</div>';
    return `<p class="pp-nota">Zelle enviados desde Wells Fargo que todavía no se sabe a qué corresponden. «Pago a…» registra el pago al proveedor con esa salida como comprobante.</p>
      <div class="pp-scroll"><table class="pp-tabla"><thead><tr><th>Fecha</th><th class="num">Monto</th><th>Para</th><th>Sugerencia</th><th></th></tr></thead><tbody>${salidas.map(s => {
        const sg = s.sugerencia || {}, prov = sg.proveedor_id || s.cxp_proveedor_id;
        const txt = sg.clase === 'no_proveedor' ? `No es proveedor · ${esc(CATEGORIAS.find(c => c[0] === sg.categoria)?.[1] || sg.categoria || '')}`
          : prov ? `${esc(sg.proveedor || nombreProv(prov))}${s.cxp?.length ? `<small>calza con ${s.cxp.length} cuenta${s.cxp.length === 1 ? '' : 's'}</small>` : ''}` : '<span class="pp-muted">—</span>';
        return `<tr><td>${dia(s.fecha)}</td><td class="num">${usd(s.monto)}</td>
          <td>${esc(s.contraparte || '—')}${s.referencia ? `<small><span class="pp-ref">${esc(s.referencia)}</span></small>` : ''}</td><td>${txt}</td>
          <td class="acc"><button type="button" class="inbox-btn" data-pp="salida-pago" data-id="${s.movimiento_id}"><i class="fas fa-money-bill-transfer"></i> ${prov && sg.clase !== 'no_proveedor' ? 'Pago a ' + esc(sg.proveedor || nombreProv(prov)) : 'Pago a proveedor'}</button>
            ${s.historicos?.length ? `<button type="button" class="inbox-btn" data-pp="salida-hist" data-id="${s.movimiento_id}">Enlazar a pago histórico</button>` : ''}
            <button type="button" class="inbox-btn" data-pp="salida-no" data-id="${s.movimiento_id}">No es proveedor</button></td></tr>`; }).join('')}
      ${hechas.map(s => `<tr><td>${dia(s.fecha)}</td><td class="num">${usd(s.monto)}</td><td>${esc(s.contraparte || '—')}</td><td><span class="pp-estado ok">${esc(s.hecho)}</span></td>
        <td class="acc">${admin && s.desclasificable ? `<button type="button" class="inbox-btn" data-pp="desclasificar" data-id="${s.movimiento_id}"><i class="fas fa-rotate-left"></i> Desclasificar</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function tablaServicios() {
    if (!servicios.length) return '<div class="pp-vacio">Todos los servicios con costo tienen proveedor.</div>';
    return `<p class="pp-nota">Servicios con costo que no tienen a quién pagarle: sin proveedor no nace la cuenta por pagar. Si el producto del tarifario tampoco tiene proveedor, conviene ponérselo ahí para que los próximos nazcan bien.</p>
      <div class="pp-scroll"><table class="pp-tabla"><thead><tr><th>Reserva</th><th>Servicio</th><th>Viaje</th><th class="num">Costo</th><th>Proveedor</th></tr></thead><tbody>${servicios.map(s => `
      <tr><td><b>${esc(s.codigo || '—')}</b><small>${esc(s.cliente || '')}</small></td><td>${esc(s.descripcion || s.tipo || '')}<small>${esc(s.tipo || '')}${s.estado ? ' · ' + esc(s.estado) : ''}</small></td>
        <td>${dia(s.fecha_inicio)}</td><td class="num">${usd(s.costo_usd)}</td>
        <td><div class="pp-sel"><select class="ei" id="pp-srv-${s.servicio_id}" aria-label="Proveedor del servicio">${opcionesProv(null)}</select>
          <button type="button" class="inbox-btn" data-pp="asignar" data-id="${s.servicio_id}">Asignar</button>
          ${s.producto_id && irTarifario ? `<button type="button" class="inbox-btn" data-pp="tarifario" data-id="${s.producto_id}" title="Abrir el producto en el tarifario"><i class="fas fa-arrow-up-right-from-square"></i> Tarifario</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`;
  }
  function tablaSinComp() {
    if (!sinComp) return '<div class="pp-vacio">Cargando…</div>';
    if (!sinComp.length) return '<div class="pp-vacio">Todos los pagos tienen comprobante.</div>';
    return `<p class="pp-nota">Pagos y reembolsos guardados sin comprobante. Adjuntalo cuando lo tengas.</p>
      <div class="pp-movs">${sinComp.map(m => `<div class="pp-prov-tag">${esc(m.proveedor)}</div>${movFila(m, m.proveedor_id)}`).join('')}</div>`;
  }

  // ── Acciones de la ficha ───────────────────────────────────────────────────
  function selTodas() {
    const pend = (cxpDe.get(vista?.id) || []).filter(c => c.saldo > 0 && !c.sin_migrar);
    const todas = pend.every(c => sel.has(c.cxp_id));
    pend.forEach(c => { if (todas) sel.delete(c.cxp_id); else sel.add(c.cxp_id); });
    pintarPanel();
  }
  async function usarSaldo(ids, btn) {
    if (!vista?.id || !ids.length) return;
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('proveedor_usar_saldo', { p_proveedor_id: vista.id, p_cxp_ids: ids });
    if (e || !data?.ok) { if (btn.isConnected) btn.disabled = false; return error('No se pudo usar el saldo: ' + msg(data, e)); }
    ok(`Saldo a favor usado: ${usd(data.aplicado)}.${data.saldo_a_favor > 0 ? ` Quedan ${usd(data.saldo_a_favor)} a favor.` : ''}`);
    sel.clear(); recargar();
  }
  async function reembolso(provId, btn) {
    const x = provs.find(p => p.proveedor_id === provId), fav = favor(x), idem = crypto.randomUUID();
    const r = await confirmar({ titulo: 'Reembolso del proveedor', textoOk: 'Registrar reembolso',
      detalle: `${nombreProv(provId)} devuelve plata. Se descuenta del saldo a favor (${usd(fav)} disponibles). El comprobante se puede adjuntar después.`,
      campos: [{ id: 'cuenta', tipo: 'select', label: 'Cuenta donde entró', requerido: true, valor: cuentaDefecto(), opciones: cuentas.map(c => ({ v: c.id, t: `${c.nombre} (${c.moneda})` })) },
        { id: 'fecha', tipo: 'date', label: 'Fecha', requerido: true, valor: hoy() },
        { id: 'monto', tipo: 'number', label: 'Monto (en la moneda de la cuenta)', requerido: true, min: 0.01, step: 0.01, valor: fav || '' },
        { id: 'ref', tipo: 'text', label: 'Referencia' }, { id: 'nota', tipo: 'text', label: 'Nota' }] });
    if (!r) return;
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('proveedor_reembolso_registrar', { p_idem: idem, p_proveedor_id: provId, p_cuenta_id: Number(r.cuenta),
      p_fecha: r.fecha, p_monto: r2(r.monto), p_referencia: r.ref || null, p_comprobante_path: null, p_nota: r.nota || null });
    if (btn.isConnected) btn.disabled = false;
    if (e || !data?.ok) return error('No se pudo registrar: ' + msg(data, e));
    ok(`Reembolso de ${usd(data.monto_usd)} registrado. Quedan ${usd(data.saldo_a_favor)} a favor.`); recargar();
  }
  async function saldoInicial(provId, btn) {
    if (!admin) return;
    const idem = crypto.randomUUID();
    const r = await confirmar({ titulo: 'Saldo inicial a favor', textoOk: 'Cargar',
      detalle: `Plata que ${nombreProv(provId)} ya nos debía antes de usar el sistema. Queda como saldo a favor para usar en sus cuentas.`,
      campos: [{ id: 'fecha', tipo: 'date', label: 'Fecha', requerido: true, valor: hoy() },
        { id: 'monto', tipo: 'number', label: 'Monto (USD)', requerido: true, min: 0.01, step: 0.01 },
        { id: 'nota', tipo: 'text', label: 'De dónde sale', requerido: true, placeholder: 'Ej.: depósito de garantía, cancelación de marzo' }] });
    if (!r) return;
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('proveedor_saldo_inicial_registrar', { p_idem: idem, p_proveedor_id: provId, p_fecha: r.fecha, p_monto_usd: r2(r.monto), p_nota: r.nota });
    if (btn.isConnected) btn.disabled = false;
    if (e || !data?.ok) return error('No se pudo cargar: ' + msg(data, e));
    ok('Saldo inicial cargado.'); recargar();
  }
  async function desaplicar(aplId, provId, monto, cod, btn) {
    const si = await confirmar({ titulo: 'Quitar de esta cuenta', textoOk: 'Quitar',
      detalle: `${usd(monto)}${cod ? ` de ${cod}` : ''} vuelven a saldo a favor de ${nombreProv(provId)} y la cuenta queda pendiente por ese monto.` });
    if (!si) return;
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('pago_proveedor_desaplicar', { p_aplicacion_id: aplId });
    if (e || !data?.ok) { if (btn.isConnected) btn.disabled = false; return error('No se pudo quitar: ' + msg(data, e)); }
    ok(`${usd(data.liberado)} volvieron a saldo a favor.`); recargar();
  }
  async function anular(pagoId, provId, btn) {
    const m = (movDe.get(provId) || []).find(x => x.id === pagoId && x.clase !== 'reembolso');
    if (!m || !admin) return;
    const ini = m.clase === 'saldo_inicial';
    const r = await confirmar({ titulo: ini ? 'Anular saldo inicial' : 'Anular pago', textoOk: 'Anular', destructivo: true,
      detalle: ini ? `${usd(m.monto_usd)} de saldo inicial de ${nombreProv(provId)}. Lo que se haya usado de ese saldo vuelve a quedar pendiente.`
        : `${usd(m.monto_usd)} del ${dia(m.fecha)} a ${nombreProv(provId)}. Las cuentas vuelven a quedar pendientes por lo que este pago cubría${m.movimiento_banco_id ? ' y la salida del banco queda por clasificar' : ''}.`,
      campos: [{ id: 'motivo', tipo: 'text', label: 'Motivo', requerido: true }] });
    if (!r?.motivo) return;
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('pago_proveedor_anular', { p_pago_id: pagoId, p_motivo: r.motivo });
    if (e || !data?.ok) { if (btn.isConnected) btn.disabled = false; return error('No se pudo anular: ' + msg(data, e)); }
    ok(ini ? 'Saldo inicial anulado.' : 'Pago anulado.'); recargar();
  }
  async function anularReembolso(id, provId, btn) {
    const m = (movDe.get(provId) || []).find(x => x.id === id && x.clase === 'reembolso');
    if (!m || !admin) return;
    const r = await confirmar({ titulo: 'Anular reembolso', textoOk: 'Anular', destructivo: true,
      detalle: `${usd(m.monto_usd)} del ${dia(m.fecha)}. Vuelven a sumar al saldo a favor de ${nombreProv(provId)}.`,
      campos: [{ id: 'motivo', tipo: 'text', label: 'Motivo', requerido: true }] });
    if (!r?.motivo) return;
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('proveedor_reembolso_anular', { p_id: id, p_motivo: r.motivo });
    if (e || !data?.ok) { if (btn.isConnected) btn.disabled = false; return error('No se pudo anular: ' + msg(data, e)); }
    ok('Reembolso anulado.'); recargar();
  }
  async function liberar(cxpId, provId, btn) {
    const c = (cxpDe.get(provId) || []).find(x => x.cxp_id === cxpId);
    if (!c) return;
    const si = await confirmar({ titulo: 'Pasar a saldo a favor', textoOk: 'Pasar',
      detalle: `${usd(c.credito_por_conciliar)} pagados de más en ${c.codigo || '—'} · ${c.servicio || ''}. Quedan como saldo a favor de ${nombreProv(provId)}.` });
    if (!si) return;
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('pago_proveedor_liberar_credito', { p_cxp_id: cxpId });
    if (e || !data?.ok) { if (btn.isConnected) btn.disabled = false; return error('No se pudo pasar: ' + msg(data, e)); }
    ok(`${usd(data.liberado)} pasaron a saldo a favor.`); recargar();
  }
  async function verComprobante(path, btn) {
    btn.disabled = true;
    const { data, error: e } = await sb.storage.from('vouchers-pdf').createSignedUrl(path, 300);
    btn.disabled = false;
    if (e || !data?.signedUrl) return error('No se pudo abrir el comprobante.');
    window.open(data.signedUrl, '_blank', 'noopener');
  }
  async function subir(archivo) {
    const ext = ((archivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg').slice(0, 5);
    const path = `${uid()}/pagos-proveedor/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage.from('vouchers-pdf').upload(path, archivo, { contentType: archivo.type || 'image/jpeg', upsert: false });
    return up.error ? { error: up.error.message } : { path };
  }

  // ── Formulario «Registrar pago» ────────────────────────────────────────────
  function abrirPago({ proveedorId = null, cxpId = null, mov = null, preCxp = [] } = {}) {
    form = { idem: crypto.randomUUID(), proveedorId, mov, pre: cxpId ? [cxpId] : preCxp.map(Number), cxp: [], tasa: null, tasaErr: null,
      archivo: null, subida: null, ocr: '', guardando: false, tocado: false, montoTocado: !!mov,
      cuentaId: mov ? mov.cuenta_id : cuentaDefecto(), fecha: mov ? mov.fecha : hoy(), monto: mov ? Number(mov.monto) : null,
      referencia: mov ? (mov.referencia || '') : '', nota: '' };
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
    f.cxp = (data || []).filter(c => c.saldo > 0).map(c => ({ ...c, on: f.pre.includes(c.cxp_id) && !c.sin_migrar, aplicar: 0 }));
    fijarMonto(); repartir(); pintarForm();
  }
  // Sin monto escrito a mano: el pago = lo que suman las cuentas elegidas (en la moneda de la cuenta).
  function fijarMonto() {
    const f = form;
    if (f.montoTocado) return;
    const u = r2(f.cxp.filter(c => c.on).reduce((s, c) => s + Number(c.saldo), 0));
    if (!u) return;
    f.monto = cuentaForm()?.moneda === 'VES' ? (f.tasa ? r2(u * f.tasa) : null) : u;
  }
  // Reparto automático: primero las elegidas (o todas), por fecha de viaje; lo que sobra queda a favor.
  function repartir() {
    const f = form;
    if (f.tocado) return;
    let m = usdForm();
    const base = f.cxp.some(c => c.on) ? f.cxp.filter(c => c.on) : f.cxp.filter(c => !c.sin_migrar);
    f.cxp.forEach(c => { c.aplicar = 0; });
    for (const c of base) { if (m <= 0) break; const a = r2(Math.min(m, Number(c.saldo))); c.aplicar = a; m = r2(m - a); }
  }
  async function actualizarTasa() {
    const f = form; f.tasa = null; f.tasaErr = null;
    if (cuentaForm()?.moneda !== 'VES') { fijarMonto(); repartir(); return pintarForm(); }
    pintarTotales();
    const { data } = await sb.rpc('pago_proveedor_tasa', { p_fecha: f.fecha });
    if (form !== f) return;
    if (data?.ok) f.tasa = Number(data.tasa); else f.tasaErr = ERRORES[data?.error] || 'Sin tasa';
    fijarMonto(); repartir(); pintarForm();
  }
  function cuentaPara(d) {
    const cands = cuentas.filter(c => c.moneda === d.moneda);
    const met = norm(d.metodo);
    return (met && cands.find(c => norm(c.nombre).includes(met) || met.includes(norm(c.nombre)))) || (d.moneda === 'USD' && cands.find(c => /wells|zelle/i.test(c.nombre))) || cands[0] || null;
  }
  async function leer(file) {
    const f = form;
    if (!leerComprobante || !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 6291456) return;
    setOcr('Leyendo comprobante…');
    let d = null;
    try { d = await leerComprobante(file); } catch (e) { console.warn('leer-comprobante', e); }
    if (form !== f || f.archivo !== file) return;
    if (!d) return setOcr('No pude leerlo: completá los datos a mano.');
    const partes = [];
    if ((d.moneda === 'VES' || d.moneda === 'USD') && cuentaForm()?.moneda !== d.moneda) {
      const alt = cuentaPara(d);
      if (alt) { f.cuentaId = alt.id; f.tasa = null; partes.push(alt.nombre); }
    }
    if (d.monto != null && (!d.moneda || d.moneda === cuentaForm()?.moneda)) { f.monto = r2(d.monto); f.montoTocado = true; partes.push(d.moneda === 'VES' ? bs(d.monto) : usd(d.monto)); }
    if (d.fecha && d.fecha <= hoy()) { f.fecha = d.fecha; partes.push(dia(d.fecha)); }
    if (d.referencia) { f.referencia = String(d.referencia); partes.push('ref. ' + d.referencia); }
    f.ocr = partes.length ? `Leído: ${partes.join(' · ')}.${d.confianza < 0.6 ? ' Lectura dudosa: revisalo.' : ' Revisá que coincida.'}` : 'No encontré datos: completalos a mano.';
    await actualizarTasa();
  }
  function setOcr(t) { if (!form) return; form.ocr = t; const el = hoja.querySelector('#pp-f-ocr'); if (el) el.textContent = t; }

  function pintarForm() {
    if (!form) return;
    const act = document.activeElement, foco = hoja.contains(act) ? (act.dataset?.ppApl ? `[data-pp-apl="${act.dataset.ppApl}"]` : act.id ? '#' + act.id : null) : null;
    const f = form, c = cuentaForm(), fijo = !!f.mov;
    hoja.innerHTML = `<div class="pp-form">
      ${fijo ? `<p class="pp-nota ancho">Salida del ${dia(f.mov.fecha)} por ${usd(f.mov.monto)} a ${esc(f.mov.contraparte || '—')}${f.mov.referencia ? ` · <span class="pp-ref">${esc(f.mov.referencia)}</span>` : ''}. La salida es el comprobante.</p>`
        : `<div class="ancho"><label class="pp-drop${f.archivo ? ' lleno' : ''}" for="pp-f-comp"><i class="fas fa-paperclip" aria-hidden="true"></i>
            <span>${f.archivo ? `<b>${esc(f.archivo.name)}</b>` : '<b>Adjuntar comprobante</b> <span class="pp-muted">(opcional)</span>'}
              <small id="pp-f-ocr" aria-live="polite">${esc(f.ocr || (f.archivo ? '' : 'Si es una captura, se leen monto, fecha y referencia.'))}</small></span>
            ${f.archivo ? '<button type="button" class="pp-x" id="pp-f-quitar" aria-label="Quitar comprobante"><i class="fas fa-xmark"></i></button>' : ''}</label>
          <input id="pp-f-comp" class="pp-oculto" type="file" accept="image/*,application/pdf" tabindex="-1"></div>`}
      <div class="ancho"><label class="fl" for="pp-f-prov">Proveedor</label><select class="ei" id="pp-f-prov">${opcionesProv(f.proveedorId)}</select></div>
      <div><label class="fl" for="pp-f-cuenta">Cuenta de donde salió</label><select class="ei" id="pp-f-cuenta"${fijo ? ' disabled' : ''}>${cuentas.map(x => `<option value="${x.id}"${x.id === f.cuentaId ? ' selected' : ''}>${esc(x.nombre)} (${x.moneda})</option>`).join('')}</select></div>
      <div><label class="fl" for="pp-f-fecha">Fecha</label><input class="ei" id="pp-f-fecha" type="date" max="${hoy()}" value="${esc(f.fecha || '')}"${fijo ? ' disabled' : ''}></div>
      <div><label class="fl" for="pp-f-monto">Monto (${c?.moneda || 'USD'})</label><input class="ei" id="pp-f-monto" type="number" inputmode="decimal" min="0.01" step="0.01" value="${f.monto ?? ''}"${fijo ? ' disabled' : ''}><div class="pp-eq" id="pp-f-eq"></div></div>
      <div><label class="fl" for="pp-f-ref">Referencia <span style="font-weight:400">(opcional)</span></label><input class="ei" id="pp-f-ref" type="text" value="${esc(f.referencia)}"${fijo ? ' disabled' : ''}></div>
      <div class="ancho"><div class="pp-sub" style="margin-top:4px">A qué cuentas va${f.cxp.length ? '<button type="button" class="pp-link" id="pp-f-auto">Repartir automático</button>' : ''}</div>
        <div class="pp-rep">${!f.proveedorId ? '<div class="pp-vacio">Elegí el proveedor para ver sus cuentas.</div>' : !f.cxp.length ? '<div class="pp-vacio">Sin cuentas pendientes: todo el pago queda como saldo a favor (anticipo).</div>' : f.cxp.map(x => `
          <div class="pp-rep-fila${x.sin_migrar ? ' off' : ''}${x.on ? ' on' : ''}"><div><b>${esc(x.codigo || '—')}</b> · ${esc(x.servicio || '')}<small>${esc(x.cliente || '')} · viaje ${dia(x.fecha_inicio)} · debo ${usd(x.saldo)}${x.sin_migrar ? ' · abono viejo sin migrar' : ''}</small></div>
            <input class="ei" type="number" inputmode="decimal" min="0" step="0.01" max="${x.saldo}" data-pp-apl="${x.cxp_id}" value="${x.aplicar || ''}" placeholder="0" aria-label="Monto a aplicar a ${esc(x.codigo || '')}"${x.sin_migrar ? ' disabled' : ''}></div>`).join('')}</div>
        <div class="pp-tot" id="pp-f-tot"></div></div>
      <div class="ancho"><label class="fl" for="pp-f-nota">Nota <span style="font-weight:400">(opcional)</span></label><input class="ei" id="pp-f-nota" type="text" value="${esc(f.nota)}"></div>
      <div class="pp-err ancho" id="pp-f-err" role="alert"></div>
    </div>
    <div class="pp-pie"><button class="dbtn" type="button" id="pp-f-cancelar">Cancelar</button><button class="dbtn save" type="button" id="pp-f-guardar">Registrar pago</button></div>`;
    pintarTotales();
    if (foco) hoja.querySelector(foco)?.focus();
  }
  function pintarTotales() {
    if (!form) return;
    const eq = hoja.querySelector('#pp-f-eq'), tot = hoja.querySelector('#pp-f-tot'), m = usdForm(), apl = totalRep(), resto = r2(m - apl);
    const prov = form.proveedorId ? nombreProv(form.proveedorId) : 'el proveedor';
    if (eq) eq.innerHTML = cuentaForm()?.moneda === 'VES' ? (form.tasa ? `Tasa ${form.tasa} · equivale a <b>${usd(m)}</b>` : `<span class="pp-alerta">${esc(form.tasaErr || 'Buscando tasa…')}</span>`) : '';
    if (tot) tot.innerHTML = m <= 0 ? '' : `<span>Pago ${usd(m)}</span><span>Aplicado ${usd(apl)}</span>${apl > m + 0.004 ? `<span class="pp-error-txt">Excede ${usd(apl - m)}</span>`
      : resto > 0 ? `<span class="pp-verde">Queda a favor de ${esc(prov)}: ${usd(resto)}</span>` : '<span class="pp-verde">Cubre justo</span>'}`;
  }
  function pintarReparto() {
    hoja.querySelectorAll('[data-pp-apl]').forEach(i => { const c = form.cxp.find(x => x.cxp_id === Number(i.dataset.ppApl)); if (c && document.activeElement !== i) i.value = c.aplicar || ''; });
  }

  hoja.addEventListener('change', e => {
    if (!form) return;
    const t = e.target;
    if (t.id === 'pp-f-prov') { form.proveedorId = Number(t.value) || null; form.cxp = []; form.pre = []; form.tocado = false; pintarForm(); if (form.proveedorId) cargarCxpForm(); }
    else if (t.id === 'pp-f-cuenta') { form.cuentaId = Number(t.value); pintarForm(); actualizarTasa(); }
    else if (t.id === 'pp-f-fecha') { form.fecha = t.value; actualizarTasa(); }
    else if (t.id === 'pp-f-comp') { form.archivo = t.files?.[0] || null; form.subida = null; form.ocr = ''; pintarForm(); if (form.archivo) leer(form.archivo); }
    else if (t.dataset.ppApl) {
      const c = form.cxp.find(x => x.cxp_id === Number(t.dataset.ppApl));
      if (!c) return;
      // Más de lo que se debe en esa cuenta: se recorta y el resto queda a favor.
      if (c.aplicar > Number(c.saldo)) { c.aplicar = Number(c.saldo); t.value = c.aplicar; }
      if (!(c.aplicar > 0)) { c.aplicar = 0; t.value = ''; }
      pintarTotales();
    }
  });
  hoja.addEventListener('input', e => {
    if (!form) return;
    const t = e.target;
    if (t.id === 'pp-f-monto') { form.monto = t.value === '' ? null : Number(t.value); form.montoTocado = true; if (!form.tocado) { repartir(); pintarReparto(); } }
    else if (t.id === 'pp-f-ref') form.referencia = t.value;
    else if (t.id === 'pp-f-nota') form.nota = t.value;
    else if (t.dataset.ppApl) { const c = form.cxp.find(x => x.cxp_id === Number(t.dataset.ppApl)); if (c) { c.aplicar = Number(t.value || 0); form.tocado = true; } }
    pintarTotales();
  });
  hoja.addEventListener('click', e => {
    if (!form) return;
    if (e.target.closest('#pp-f-quitar')) { e.preventDefault(); form.archivo = null; form.subida = null; form.ocr = ''; pintarForm(); }
    else if (e.target.closest('#pp-f-cancelar')) { form = null; cerrarSheet('pp-sheet'); }
    else if (e.target.closest('#pp-f-auto')) { form.tocado = false; repartir(); pintarReparto(); pintarTotales(); }
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
    if (f.cxp.some(x => x.aplicar < 0 || x.aplicar > Number(x.saldo) + 0.004)) return falla('Un monto del reparto supera lo que se debe en su cuenta.');
    if (apl > musd + 0.004) return falla('El reparto supera el monto del pago.');
    f.guardando = true; btn.disabled = true; err.textContent = '';
    let path = null;
    if (!f.mov && f.archivo) {
      if (f.subida?.archivo === f.archivo) path = f.subida.path;
      else {
        const up = await subir(f.archivo);
        if (up.error) return falla('No se pudo subir el comprobante: ' + up.error);
        path = up.path; f.subida = { path, archivo: f.archivo };
      }
    }
    const { data, error: e } = await sb.rpc('pago_proveedor_registrar', {
      p_idem: f.idem, p_proveedor_id: f.proveedorId, p_cuenta_id: c.id, p_fecha: f.fecha, p_monto: m, p_moneda: c.moneda,
      p_referencia: f.referencia || null, p_comprobante_path: path, p_movimiento_banco_id: f.mov?.movimiento_id || null,
      p_aplicaciones: f.cxp.filter(x => x.aplicar > 0).map(x => ({ cxp_id: x.cxp_id, monto_usd: r2(x.aplicar) })), p_nota: f.nota || null });
    if (form !== f) return;
    if (e || !data?.ok) return falla('No se pudo registrar: ' + msg(data, e));
    form = null; cerrarSheet('pp-sheet');
    ok(`Pago de ${usd(data.monto_usd)} registrado${data.sobrante > 0 ? ` · ${usd(data.sobrante)} quedan a favor` : ''}${!f.mov && !path ? ' · sin comprobante, se puede adjuntar después' : ''}.`);
    if (f.mov) { const s = salidas.find(x => x.movimiento_id === f.mov.movimiento_id); if (s) marcar(s, 'Pago a ' + nombreProv(f.proveedorId), false); }
    else { vista = { t: 'prov', id: f.proveedorId }; sel.clear(); }
    recargar();
  }

  // ── Salidas del banco y servicios sin proveedor ────────────────────────────
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

  return { cargar, abrirPago, abrirProveedor };
}
