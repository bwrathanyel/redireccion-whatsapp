(() => {
'use strict';

// Respuestas de RPCs y Edge Functions para el Supabase falso: handler(mock, args) -> body | {__status, body}.
//
// Las que dependen del estado (dashboard_stats, repartir-numeros) leen y escriben
// `mock.tablas`, así un cambio hecho en pantalla se ve reflejado en el resto.
const { AHORA, ASESORA, ASESORES, DESTINOS, ID_ASESORA, ID_DESTINO, LEADS, USUARIOS, dia, en, hace, lead, iso, ymd } = window.PRUEBA_DATOS;

const g = (o, k, d = null) => (o != null && Object.hasOwn(o, k) ? o[k] : d);
const contar = arr => { const c = {}; for (const x of arr) c[x] = (c[x] ?? 0) + 1; return c; };
const setdefault = (o, k, d) => { if (!Object.hasOwn(o, k)) o[k] = d; return o[k]; };
const pick = (o, ks) => Object.fromEntries(ks.map(k => [k, o[k]]));
const tru = x => (Array.isArray(x) ? x.length > 0 : x && typeof x === 'object' ? Object.keys(x).length > 0 : Boolean(x));
const pyor = (x, d) => (tru(x) ? x : d);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const str = x => (x == null ? 'None' : String(x));
const entero = x => {
  if (typeof x === 'number' && Number.isFinite(x)) return Math.trunc(x);
  if (typeof x === 'boolean') return +x;
  if (typeof x === 'string' && /^\s*[+-]?\d+\s*$/.test(x)) return parseInt(x, 10);
  throw new TypeError(`int() invalido: ${x}`);
};
const flotante = x => {
  if (typeof x === 'number') return x;
  if (typeof x === 'boolean') return +x;
  if (typeof x === 'string' && x.trim() !== '' && !Number.isNaN(Number(x))) return Number(x);
  throw new TypeError(`float() invalido: ${x}`);
};
const redondear = x => (Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : Math.round(x));
const rd = (x, n) => Math.round(x * 10 ** n) / 10 ** n;
const miles = x => String(redondear(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const pad = (x, n) => String(x).padStart(n, '0');
const T = d => d.getTime();
const mas = (d, { dias = 0, horas = 0, minutos = 0 } = {}) => new Date(Math.round(T(d) + dias * 86400000 + horas * 3600000 + minutos * 60000));
const rep = (d, c) => {
  const x = new Date(T(d));
  if ('day' in c) x.setUTCDate(c.day);
  if ('hour' in c) x.setUTCHours(c.hour);
  if ('minute' in c) x.setUTCMinutes(c.minute);
  if ('second' in c) x.setUTCSeconds(c.second);
  return x;
};
const anio = d => d.getUTCFullYear();
const mes = d => d.getUTCMonth() + 1;
const diaMes = d => d.getUTCDate();
const weekday = d => (d.getUTCDay() + 6) % 7;

const OK = { ok: true };
const UUID_ASESOR = { [ASESORA]: ID_ASESORA, 'Carlos Demo': '0de00000-0000-4000-8000-0000000ca205', 'Luisa Demo': '0de00000-0000-4000-8000-00000001a15a' };
const DESTINOS_TOP = { Margarita: 48, 'Los Roques': 22, Mérida: 17, Canaima: 9, Morrocoy: 8, Choroní: 5, 'Puerto La Cruz': 4 };

function _leads(m) { return g(m.tablas, 'leads', []).filter(l => !g(l, 'eliminado_at')); }
function _es_asesor(m) { return g(m.usuario, 'rol') === 'asesor'; }
function _lead(nombre) {
  const l = LEADS.find(x => x.nombre === nombre);
  if (!l) throw new Error(`StopIteration: ${nombre}`);
  return l;
}


function _meses(n = 12) {
  let y = anio(AHORA), mo = mes(AHORA);
  const out = [];
  for (let k = 0; k < n; k++) {
    out.push(`${y}-${pad(mo, 2)}`); mo -= 1;
    if (mo === 0) { y -= 1; mo = 12; }
  }
  return out.reverse();
}


function dashboard_stats(m, a) {
  const ls = _leads(m), est = contar(ls.map(l => l.estado));
  const base = _es_asesor(m) ? 0 : 1200;
  return { total: base + ls.length, anio_actual: Math.floor(base / 2) + ls.length, mes_actual: Math.floor(base / 12) + ls.length,
    por_atender: est['POR ATENDER'] ?? 0, historico_inactivo: Math.floor(base / 10), vouchers_mes: 7,
    by_canal: { Instagram: 760, Facebook: 310, Web: 140, TikTok: 30 }, by_estado: { ...est },
    by_anio: { 2024: 180, 2025: 420, 2026: Math.floor(base / 2) + ls.length },
    by_advisor: { ...contar(ls.map(l => l.asesor)) }, top_destinos: DESTINOS_TOP,
    trend: _meses().map((mes, i) => ({ mes, total: 60 + (i * 7) % 45 })) };
}


function conversion_por_destino(m, a) {
  const gr = { Margarita: [48, 7], 'Los Roques': [22, 4], Mérida: [17, 2], Canaima: [9, 1], Morrocoy: [8, 1] };
  return Object.fromEntries(Object.entries(gr).map(([d, [t, w]]) => [d, { total: t, ganados: w, pct: rd(w / t * 100, 1) }]));
}


function ranking_asesores(m, a) {
  return [{ asesor: ASESORA, peso_asignacion: 35, nuevos: 42, atendidos: 38, ventas: 7, monto: 4850.0, horas_respuesta: 1 },
    { asesor: 'Carlos Demo', peso_asignacion: 35, nuevos: 40, atendidos: 33, ventas: 5, monto: 3600.0, horas_respuesta: 2 },
    { asesor: 'Luisa Demo', peso_asignacion: 30, nuevos: 35, atendidos: 30, ventas: 6, monto: 4100.0, horas_respuesta: 1 }];
}


function metricas(m, a) {
  return { nuevos: 117, atendidos: 101, ventas: 18, monto: 12550.0,
    serie: Array.from({ length: 14 }, (_, j) => { const i = 13 - j; return { dia: dia(-i), nuevos: 3 + (i * 5) % 7, ventas: +(i % 3 === 0) }; }),
    por_servicio: { Paquete: 48, Hospedaje: 39, 'Full Day': 18, Boletería: 12 }, por_estado: {} };
}


function informes_diarios_listado(m, a) {
  const filas = []; let d = 0;
  while (filas.length < 15) {
    const f = mas(AHORA, { dias: -d }); d += 1;
    if (weekday(f) >= 5) continue;
    for (const nombre of [ASESORA, 'Carlos Demo', 'Luisa Demo']) {
      const ok = !(nombre === 'Luisa Demo' && d === 2);
      filas.push({ fecha: ymd(f), asesor_id: UUID_ASESOR[nombre], nombre, tiene_informe: ok,
        hora_salida: ok ? iso(rep(f, { hour: 21, minute: 5 })) : null, resumen: null,
        como_me_fue: ok ? 'Buen día: 2 cotizaciones enviadas y un abono confirmado.' : null,
        que_aprendi: ok ? 'Mandar la cotización con fotos acelera la respuesta.' : null,
        que_se_complico: ok ? 'Un cliente pidió fechas sin disponibilidad.' : null, bloqueos: null });
    }
  }
  return filas;
}


function listar_pagos(m, a) {
  const pago = (i, nombre, tipo, riel, cent, moneda, usd, tasa, ref, comp, h) => {
    const l = _lead(nombre);
    return { id: i, lead_id: l.id, lead_nombre: nombre, lead_telefono: l.telefono, asesor: l.asesor,
      tipo, riel, estado: 'pendiente_verificacion', monto_centavos: cent, moneda,
      tasa_usd_ves: tasa, monto_usd_centavos: usd, referencia_declarada: ref,
      comprobante_path: comp ? `demo/comprobante-${i}.jpg` : null, created_at: hace(h) };
  };
  const hechos = setdefault(m.tablas, '_pagos_verificados', []);
  const pagos = [pago(1, 'Ricardo Díaz', 'abono', 'pago_movil', 1186250, 'VES', 32500, 36.5, '004512', true, 1),
    pago(2, 'Gabriela Torres', 'total', 'zelle', 98000, 'USD', 98000, null, 'ZL-7781', true, 3),
    pago(3, 'Andrés Morales', 'abono', 'binance', 19000, 'USDT', 19000, null, null, false, 5)];
  return { ok: true, pagos: pagos.filter(p => !hechos.includes(p.id)) };
}


function verificar_pago(m, a) {
  setdefault(m.tablas, '_pagos_verificados', []).push(g(a, 'p_pago_id'));
  return OK;
}


function listar_ventas_pendientes_verificar(m, a) {
  const l = _lead('Andrés Morales');
  if (g(m.tablas, '_ventas_verificadas', []).includes(l.id)) return [];
  return [{ lead_id: l.id, nombre: l.nombre, telefono: l.telefono, destino: l.destino, asesor: l.asesor,
    monto_total: 380, costo_neto: 290, proveedor: 'Posada Demo Mar Azul', actualizado_en: hace(4) }];
}


function confirmar_venta(m, a) {
  setdefault(m.tablas, '_ventas_verificadas', []).push(g(a, 'p_lead_id'));
  return OK;
}


function listar_bandeja_facturacion(m, a) {
  const fila = (bid, nombre, tipo, hotel, viaje, pagado, total, metodo, h) => {
    const l = _lead(nombre);
    return { bandeja_id: bid, lead_id: l.id, nombre, telefono: l.telefono, destino: l.destino,
      asesor: l.asesor, enviado_por: l.asesor, creado_en: hace(h), cedula: 'V-00.000.000',
      tipo_venta: [tipo], hotel_posada: hotel, vuelo_origen: null, vuelo_destino: null, fecha_viaje: dia(viaje),
      fecha_regreso: dia(viaje + 3), personas: 2, adultos: 2, ninos: 0, infantes: 0, metodo_pago: metodo,
      referencia_pago: '004512', monto_pagado: pagado, monto_total: total, notas_venta: 'Habitación matrimonial' };
  };
  const hechos = g(m.tablas, '_bandeja_procesada', []);
  const filas = [fila(1, 'Ricardo Díaz', 'hospedaje', 'Venetur Mérida', 12, 325, 650, 'Pago móvil', 2),
    fila(2, 'Camila Rojas', 'paquete', 'Villa Caracol', 20, 600, 1200, 'Zelle', 6)];
  return filas.filter(f => !hechos.includes(f.lead_id));
}


const FACTURAS = [  // numero, cliente, asesor, monto, estado, días atrás
  [1021, 'Sofía Ramírez', ASESORA, 540, 'pagada', 9], [1022, 'Camila Rojas', 'Luisa Demo', 1200, 'pagada', 6],
  [1023, 'Elena Vargas', 'Carlos Demo', 760, 'pagada', 5], [1024, 'Jorge Medina', ASESORA, 430, 'pagada', 3],
  [1025, 'Patricia Silva', 'Carlos Demo', 890, 'anulada', 2]];


// FACTURAS fijas + las que el admin genera en pantalla con 'Guardar y facturar' (guardar_postventa con p_marcar_pagado).
function _facturas_todas(m) {
  const nuevas = g(m.tablas, '_facturas_nuevas', []).map(f => [f.numero, f.cliente, f.asesor, f.total, 'pagada', 0, f.lead_id]);
  return [...FACTURAS.map(f => [...f, 9100 + f[0] - 1000]), ...nuevas];
}


function listar_facturas(m, a) {
  let out = _facturas_todas(m).map(([n, c, ase, t, e, d, lid]) => ({ id: n - 1000, numero_factura: n, lead_id: lid, reserva_id: lid, reserva_codigo: null, cliente: c,
    reserva_total: null, reserva_pagado: null, reserva_costo: null,
    asesor: ase, monto_total: t, moneda: 'USD', forma_pago: 'Zelle', estado: e,
    fecha_emision: d ? hace({ dias: d }) : hace(0.1), notas: null }));
  if (g(a, 'p_estado')) out = out.filter(f => f.estado === a.p_estado);
  return [...out].sort((x, y) => cmp(y.fecha_emision, x.fecha_emision));
}


function resumen_facturacion(m, a) {
  const pag = _facturas_todas(m).filter(f => f[4] === 'pagada');
  return { total_facturado: pag.reduce((s, f) => s + f[3], 0), facturas_pagadas: pag.length, facturas_anuladas: 1,
    comisiones_sin_configurar: 0, comisiones_pendientes_monto: rd(98.5 + g(m.tablas, '_facturas_nuevas', []).reduce((s, f) => s + f.total * 0.05, 0), 2),
    comisiones_pagadas_monto: 27.0 };
}


function listar_cuentas_por_pagar(m, a) {
  const nuevas = g(m.tablas, '_facturas_nuevas', []).map((f, i) => [f, i]).filter(([f]) => f.costo !== null)
    .map(([f, i]) => ({ id: 100 + i, lead_id: f.lead_id, reserva_id: f.lead_id, reserva_codigo: null, cliente: f.cliente, destino: null,
      proveedor: f.proveedor || 'Sin proveedor', monto_a_transferir: f.costo, monto_abonado: 0, saldo_pendiente: f.costo,
      estado: 'pendiente', updated_at: hace(0.1) }));
  return [...nuevas, ..._cxp_fijas()];
}


function _cxp_fijas() {
  return [{ id: 1, lead_id: 9122, reserva_id: 9122, reserva_codigo: null, cliente: 'Camila Rojas', destino: 'Los Roques',
    proveedor: 'Villa Caracol', monto_a_transferir: 900, monto_abonado: 450, saldo_pendiente: 450,
    estado: 'pendiente', updated_at: hace(5) },
  { id: 2, lead_id: 9121, reserva_id: 9121, reserva_codigo: null, cliente: 'Sofía Ramírez', destino: 'Margarita',
    proveedor: 'BT Travel', monto_a_transferir: 410, monto_abonado: 410, saldo_pendiente: 0,
    estado: 'pagado', updated_at: hace({ dias: 7 }) }];
}


function listar_comisiones(m, a) {
  let out = FACTURAS.map(([n, c, ase, t, e, d]) => ({ id: n - 1000, factura_id: n - 1000, asesor: ase, monto_venta: t, porcentaje: 5, monto_comision: rd(t * 0.05, 2),
    estado: e === 'anulada' ? 'anulada' : (d > 7 ? 'pagada' : 'pendiente'), fecha_pago: null, created_at: hace({ dias: d }) }));
  out = out.concat(g(m.tablas, '_facturas_nuevas', []).map(f => ({ id: f.numero - 1000, factura_id: f.numero - 1000, asesor: f.asesor, monto_venta: f.total, porcentaje: 5,
    monto_comision: rd(f.total * 0.05, 2), estado: 'pendiente', fecha_pago: null, created_at: hace(0.1) })));
  return _es_asesor(m) ? out.filter(c => c.asesor === ASESORA) : out;
}


function comisiones_origen_panel(m, a) {
  const filas = [];
  for (const [l, origen] of [[LEADS[1], 'reasignado'], [LEADS[11], 'web'], [LEADS[13], 'ambos'], [LEADS[5], 'rescatado']]) {
    const venta = l.estado === 'VENTA COMPLETA';
    filas.push({ ...pick(l, ['id', 'nombre', 'telefono', 'destino', 'estado', 'asesor', 'canal', 'fecha_creacion']),
      origen, de_web: ['web', 'ambos'].includes(origen), reasignado: ['reasignado', 'ambos'].includes(origen),
      rescatado: origen === 'rescatado', en_manual: venta, monto_total: venta ? l.total : null,
      mi_comision: venta ? rd(l.total * 0.05, 2) : null, numero_factura: venta ? 1022 : null,
      fecha_emision: venta ? hace({ dias: 6 }) : null, estado_factura: venta ? 'pagada' : null });
  }
  return { pct: 5, filas, resumen: { total: 4, web: 1, reasignados: 1, ambos: 1, rescatados: 1, vendidos: 1,
    comisiones_bwrathanyel: 1, monto_vendido: 1200.0, mi_comision_total: 60.0 } };
}


function comision_liquidaciones_listar(m, a) {
  const liq = (i, num, vend, pago, ventas, total, estado) => ({ id: i, numero: num, vendedor: vend, usuario_id: UUID_ASESOR[vend], pago_el: pago, ventas, total,
    estado, pdf_path: `demo/liq-${num}.pdf`, creada_en: hace({ dias: 3 }), condiciones: 'Pago por corte', terminos: '',
    enviada_telegram_en: null, enviada_correo_en: null, pagada_en: estado === 'pagada' ? hace({ dias: 1 }) : null, anulada_en: null });
  const pagadas = g(m.tablas, '_liq_pagadas', []);
  return [liq(2, 24, 'Carlos Demo', dia(-1), 2, 38.0, pagadas.includes(2) ? 'pagada' : 'emitida'),
    liq(1, 23, ASESORA, _corte(mas(AHORA, { dias: -19 })), 1, 54.0, 'pagada')];
}


function comision_liquidacion_marcar_pagada(m, a) {
  setdefault(m.tablas, '_liq_pagadas', []).push(entero(g(a, 'p_id')));
  return OK;
}


function comision_venta_verificar(m, a) {
  setdefault(m.tablas, '_cm_estados', {})[entero(g(a, 'p_id'))] = 'verificada';
  return OK;
}


function comision_reglas_listar(m, a) {
  const base = { boletos: 5, traslado: 5, hospedaje: 7, paquete: 10 };
  const reglas = Object.entries(base).map(([k, v]) => ({ usuario_id: null, tipo: k, porcentaje: v }));
  reglas.push({ usuario_id: UUID_ASESOR['Luisa Demo'], tipo: 'hospedaje', porcentaje: 5 }, { usuario_id: UUID_ASESOR['Luisa Demo'], tipo: 'paquete', porcentaje: 8 });
  const vendedores = ASESORES.map(x => ({ id: UUID_ASESOR[x.nombre], nombre: x.nombre, rol: 'asesor', es_freelancer: x.nombre === 'Luisa Demo' }));
  return { ok: true, reglas, vendedores,
    config: { proximo_numero: 25, condiciones: 'Pago por corte', terminos: 'Comisiones de ventas verificadas, pagadas en la fecha del corte.',
      autoverif_activa: false, autoverif_umbral: 0 } };
}


function personal_resumen(m, a) {
  const personas = [];
  ASESORES.forEach((ase, i) => {
    const n = ase.nombre;
    const dias = Array.from({ length: 5 }, (_, k) => ({ dia: dia(-k), minutos: 470 - 15 * k, cant_sesiones: 1, tiene_anomala: false,
      sesiones: [{ entrada: iso(mas(AHORA, { dias: -k, horas: -9 })),
        salida: k === 0 ? null : iso(mas(AHORA, { dias: -k, horas: -1 })), abierta: k === 0, anomala: false }] }));
    personas.push({ usuario_id: UUID_ASESOR[n], nombre: n, rol: 'asesor', cargo: 'Asesor comercial',
      username: n.toLowerCase().replaceAll(' ', '.'), correo: null, es_freelancer: false, bloqueado: false,
      strikes_freelancer: 0, es_boleteria: false, ve_voucher: false, ve_informe_diario: false, asesor_id: ase.id,
      whatsapp: null, telegram_chat_id: null, dado_de_baja: false, minutos_hoy: 480 - 60 * i,
      minutos_semana: 2300 - 200 * i, tiene_anomala: false, conectado_ahora: i < 2, ultima_actividad: hace(0.1 + i),
      ultima_presencia: hace(0.05 + i), marco_hoy: i < 2, exento_hoy: false, strikes_mes: +(i === 2), dias,
      actividad: i === 2 ? { activo_hoy: 300, idle_hoy: 40, activo_semana: 1500, idle_semana: 210 } : {} });
  });
  for (const f of g(m.tablas, '_personal_nuevo', [])) {   // altas hechas en pantalla con crear-personal
    personas.push({ ...personas[0], usuario_id: f.usuario_id, nombre: f.nombre, username: f.username, cargo: f.cargo || null,
      rol: f.rol, es_freelancer: f.es_freelancer, bloqueado: false, strikes_freelancer: 0, asesor_id: 4,
      minutos_hoy: 0, minutos_semana: 0, conectado_ahora: false, marco_hoy: false, strikes_mes: 0, dias: [], actividad: {} });
  }
  return { desde: hace({ dias: 90 }), hoy: dia(), semana_desde: dia(-weekday(AHORA)), de_baja: [], personas };
}


// Edge Function crear-personal: la contraseña temporal es ficticia.
function crear_personal(m, b) {
  const nuevos = setdefault(m.tablas, '_personal_nuevo', []);
  const uid = `0de00000-0000-4000-8000-${pad((0xa00 + nuevos.length).toString(16), 12)}`;
  nuevos.push({ usuario_id: uid, nombre: g(b, 'nombre'), username: g(b, 'username'), cargo: g(b, 'cargo'),
    rol: g(b, 'rol') || 'asesor', es_freelancer: Boolean(g(b, 'es_freelancer')) });
  return { ok: true, usuario_id: uid, username: g(b, 'username'), password_temporal: g(b, 'password') || 'Lotus-Demo-4821' };
}


function admin_vincular_asesor(m, a) {
  m.tablas.asesores.push({ id: 4, nombre: g(a, 'p_nombre'), peso_asignacion: null, peso_internacional: null, activo: true, horario: '08:00-17:00' });
  return OK;
}


function admin_guardar_reparto(m, a) {
  const col = g(a, 'p_pool') === 'domestico' ? 'peso_asignacion' : 'peso_internacional';
  const pesos = new Map(pyor(g(a, 'p_pesos'), []).map(p => [p.nombre, p.peso]));
  for (const r of m.tablas.asesores) r[col] = pesos.has(r.nombre) ? pesos.get(r.nombre) : null;
  return OK;
}


function asistencia_historial(m, a) {
  const out = [];
  for (let k = 0; k < 5; k++) {
    ASESORES.forEach((x, i) => out.push({ id: 100 + k * 3 + i, asesor_id: UUID_ASESOR[x.nombre], nombre: x.nombre,
      hora_entrada: iso(mas(AHORA, { dias: -k, horas: -9 })),
      hora_salida: k === 0 ? null : iso(mas(AHORA, { dias: -k, horas: -1 })) }));
  }
  return out;
}


function repartir_numeros(m, b) {
  if (g(b, 'accion') === 'extraer') {
    const tels = (g(b, 'texto') || '').match(/\+?\d[\d \t-]{9,}\d/g) ?? [];
    return { ok: true, avisos: [], numeros: tels.map(t => ({ telefono: '+' + t.replace(/\D/g, ''), nombre: null, destino: null,
      fecha_viaje: null, personas: null, duplicado: null, ambiguo: false })) };
  }
  const res = [];
  g(b, 'numeros', []).forEach((n, i) => {
    const ase = g(b, 'asesor') || ASESORES[i % ASESORES.length].nombre;
    m.tablas.leads.push(lead(g(n, 'nombre') || 'Sin nombre', 'POR ATENDER', g(n, 'destino') || 'Margarita',
      { asesor: ase, horas: 0, telefono: n.telefono, numero: n.telefono }));
    res.push({ telefono: n.telefono, estado: 'asignado', asesor: ase, detalle: null });
  });
  return { ok: true, resultados: res };
}


// ---------- Asesor: ventas, postventa, comisiones ----------
const VENDIDOS = ['PAGO REALIZADO', 'VENTA COMPLETA'];
// Datos de la reserva por cliente: etapa, prioridad, días al viaje, noches, proveedor/hotel, días desde el cierre
const RESERVA_META = {
  'María González': ['CONFIRMACION_RESERVA', 'ALTA', 25, 3, 'Hesperia Playa El Agua', 1],
  'Ricardo Díaz': ['COBRO_PENDIENTE', 'NORMAL', 12, 3, 'Venetur Mérida', 4],
  'Fernando Blanco': ['DOCUMENTACION', 'NORMAL', 18, 2, 'Villa Caracol', 3],
  'Sofía Ramírez': ['LISTO_PARA_VIAJAR', 'ALTA', 4, 3, 'Hesperia Playa El Agua', 20],
  'Isabel Moreno': ['SEGUIMIENTO_POSTVIAJE', 'BAJA', -6, 3, 'Venetur Mérida', 15],
  'Pedro Martínez': ['COBRO_PENDIENTE', 'NORMAL', 20, 3, 'Hesperia Playa El Agua', 0],
};
const DOCS_POR_ETAPA = { COBRO_PENDIENTE: 1, CONFIRMACION_RESERVA: 1, DOCUMENTACION: 3, LISTO_PARA_VIAJAR: 6, EN_VIAJE: 6,
  SEGUIMIENTO_POSTVIAJE: 6, CERRADO: 6 };
const DOCS = ['comprobante_pago', 'reserva_emitida', 'voucher_hotel', 'boletos', 'seguro', 'itinerario_entregado'];


function _nombre_usuario(m, a) {
  if (g(a, 'p_asesor_id')) return Object.entries(UUID_ASESOR).find(([n, u]) => u === a.p_asesor_id)?.[0] ?? null;
  return _es_asesor(m) ? g(m.usuario, 'nombre') : null;
}


function _vendidos(m, asesor = null) {
  return _leads(m).filter(l => VENDIDOS.includes(l.estado) && Object.hasOwn(RESERVA_META, l.nombre) && (asesor === null || l.asesor === asesor));
}


// Cierres dentro del mes en curso (hora Caracas) para que el KPI "ventas del mes" no quede en 0 a principio de mes.
function _cierre(l) {
  const d = RESERVA_META[l.nombre][5];
  let f = mas(AHORA, { dias: -d });
  const caracas = mas(AHORA, { horas: -4 });
  const inicio = mas(rep(caracas, { day: 1, hour: 0, minute: 0, second: 0 }), { horas: 4 });
  if (f < inicio && d < 16) f = new Date(T(inicio) + (T(AHORA) - T(inicio)) * (1 - d / 16));
  return iso(f);
}


function _pagado(l) { return flotante(l.monto_completo || l.monto_inicial || 0); }


function mis_ventas(m, a) {
  const asesor = _nombre_usuario(m, a);
  if (!asesor) return [];
  const out = [];
  for (const l of _vendidos(m, asesor)) {
    const tot = flotante(l.total), pag = _pagado(l);
    out.push({ lead_id: l.id, cliente: l.nombre, destino: l.destino, fecha_cierre: _cierre(l), monto_total: tot,
      monto_pagado: pag, saldo: rd(tot - pag, 2), porcentaje_pagado: tot ? redondear(pag / tot * 100) : 0,
      estado: l.estado });
  }
  return out.sort((x, y) => cmp(y.fecha_cierre, x.fecha_cierre));
}


function _reserva(l) {
  const [etapa, prio, viaje, noches, prov] = RESERVA_META[l.nombre];
  const rid = l.id - 9000 + 100;
  const tot = flotante(l.total), pag = _pagado(l);
  const ndocs = DOCS_POR_ETAPA[etapa];
  return { id: rid, codigo: `R-${pad(rid, 6)}`, principal: true, factura_id: null, lead_id: l.id, nombre: l.nombre,
    cliente: l.nombre, telefono: l.telefono, destino: l.destino, servicio: l.servicio,
    servicios_comprados: [l.servicio], estado_lead: l.estado, asesor: l.asesor, fecha_creacion: l.fecha_creacion,
    fecha_cierre: _cierre(l), etapa, responsable: l.asesor, prioridad: prio, monto_total: tot,
    monto_pagado: pag, saldo_pendiente: rd(tot - pag, 2), fecha_viaje_inicio: dia(viaje),
    fecha_viaje_fin: dia(viaje + noches), proveedor: prov,
    localizador_reserva: ndocs > 1 ? `LTS${rid}` : null,
    documentos: Object.fromEntries(DOCS.map((d, i) => [d, i < ndocs])),
    proximo_seguimiento_at: etapa !== 'SEGUIMIENTO_POSTVIAJE' ? en({ dias: 1 }) : hace({ dias: 1 }),
    ultimo_contacto_at: hace({ dias: 1 }), notas: null, incidencia_abierta: false,
    satisfaccion: etapa === 'SEGUIMIENTO_POSTVIAJE' ? 5 : null, updated_at: hace(2), version: 1,
    destino_id: g(ID_DESTINO, l.destino), con_servicios: true };
}


function _reservas(m) {
  return _vendidos(m, _es_asesor(m) ? g(m.usuario, 'nombre') : null).map(_reserva);
}


function postventa_bandeja(m, a) {
  let rs = _reservas(m);
  if (g(a, 'p_etapa')) rs = rs.filter(r => r.etapa === a.p_etapa);
  const q = String(g(a, 'p_busqueda') || '').trim().toLowerCase();
  if (q) rs = rs.filter(r => ['nombre', 'telefono', 'destino', 'localizador_reserva', 'codigo'].some(k => String(r[k] || '').toLowerCase().includes(q)));
  return [...rs].sort((x, y) => cmp(x.fecha_viaje_inicio, y.fecha_viaje_inicio));
}


function postventa_resumen(m, a) {
  const rs = _reservas(m);
  const hoy = Date.UTC(anio(AHORA), mes(AHORA) - 1, diaMes(AHORA));
  return { total: rs.length, cobros_pendientes: rs.filter(r => r.saldo_pendiente > 0).length,
    documentacion: rs.filter(r => r.etapa === 'DOCUMENTACION').length,
    viajes_proximos: rs.filter(r => { const dd = Math.round((Date.parse(`${r.fecha_viaje_inicio}T00:00:00Z`) - hoy) / 86400000); return dd >= 0 && dd <= 15; }).length,
    seguimientos_vencidos: rs.filter(r => r.proximo_seguimiento_at < iso(AHORA)).length,
    incidencias: 0, saldo_pendiente: rd(rs.reduce((s, r) => s + r.saldo_pendiente, 0), 2) };
}


function _servicio(r, sid, tipo, desc, ini, fin, estado, usd, { pax = 2, hora = null, detalle = null, loc = null } = {}) {
  return { id: sid, reserva_id: r.id, tipo, descripcion: desc, destino_id: r.destino_id, destino: r.destino,
    fecha_inicio: ini, fecha_fin: fin, hora, pax_adultos: pax, pax_ninos: 0, localizador: loc, estado,
    detalle: detalle || {}, anulado_en: null, precio_centavos: usd * 100, precio_moneda: 'USD', precio_tasa: null,
    precio_usd_centavos: usd * 100 };
}


function reserva_detalle(m, a) {
  const r = _reservas(m).find(x => x.id === entero(g(a, 'p_reserva_id') || 0)) ?? null;
  if (!r) return { ok: false, error: 'Reserva no encontrada' };
  const ini = r.fecha_viaje_inicio, fin = r.fecha_viaje_fin, noches = RESERVA_META[r.nombre][3], base = r.id * 10;
  const hosp = { hospedaje: { hotel: r.proveedor, habitacion: 'Doble estándar', plan: 'Todo incluido', noches } };
  let servicios, pasajeros;
  if (r.nombre === 'María González') {
    servicios = [_servicio(r, base + 1, 'boleto_aereo', 'Caracas – Porlamar ida y vuelta', ini, fin, 'solicitado', 180, { hora: '08:30' }),
      _servicio(r, base + 2, 'traslado_terrestre', 'Aeropuerto – hotel – aeropuerto', ini, fin, 'confirmado', 40, { hora: '10:00' }),
      _servicio(r, base + 3, 'hospedaje', 'Hesperia Playa El Agua, 3 noches', ini, fin, 'confirmado', 460, { detalle: hosp,
        loc: 'HCA-7731' })];
    pasajeros = [['María', 'González', 'V-00.000.001', '1990-05-14', true], ['Juan', 'González', 'V-00.000.002', '1988-11-02', false]];
  } else {
    servicios = [_servicio(r, base + 1, 'hospedaje', `${r.proveedor}, ${noches} noches`, ini, fin,
      r.documentos.voucher_hotel ? 'emitido' : 'confirmado', Math.trunc(r.monto_total), { detalle: hosp,
        loc: r.localizador_reserva })];
    const sp = r.nombre.indexOf(' ');
    const nom = r.nombre.slice(0, sp), ape = r.nombre.slice(sp + 1);
    pasajeros = [[nom, ape, 'V-00.000.0' + String(r.id).slice(-2), '1985-03-20', true]];
  }
  const pas = pasajeros.map(([n, ap, doc, fn, tit], i) => ({ id: base + 50 + i, nombre: n, apellido: ap, tipo_documento: 'cedula', numero_documento: doc, fecha_nacimiento: fn,
    nacionalidad: 'Venezolana', telefono: tit ? r.telefono : null, email: null, titular: tit }));
  const docs = [{ id: base + 80, servicio_id: null, tipo: 'comprobante', nombre: 'comprobante-abono.jpg', mime: 'image/jpeg',
    tamano_bytes: 184000, created_at: r.fecha_cierre, subido_por: r.asesor }];
  if (r.documentos.voucher_hotel) {
    docs.push({ id: base + 81, servicio_id: servicios[servicios.length - 1].id, tipo: 'voucher', nombre: 'voucher-hotel.pdf',
      mime: 'application/pdf', tamano_bytes: 96000, created_at: hace({ dias: 1 }), subido_por: r.asesor });
  }
  return { ok: true, vista: _es_asesor(m) ? 'asesor' : 'admin', reserva: r, servicios, pasajeros: pas,
    documentos: docs };
}


const DOC_TEXTO = { comprobante_pago: 'Comprobante de pago', reserva_emitida: 'Reserva emitida', voucher_hotel: 'Voucher del hotel',
  boletos: 'Boletos', seguro: 'Seguro de viaje', itinerario_entregado: 'Itinerario entregado al cliente' };


function reserva_checklist(m, a) {
  const r = _reservas(m).find(x => x.id === entero(g(a, 'p_reserva_id') || 0)) ?? null;
  if (!r) return { ok: false };
  const f = Object.entries(r.documentos).filter(([d, ok]) => !ok).map(([d]) => ({ texto: DOC_TEXTO[d] }));
  if (r.saldo_pendiente > 0) f.unshift({ texto: `Saldo pendiente $${miles(r.saldo_pendiente)}` });
  return { ok: true, completa: !f.length, faltantes: f };
}


const PCT = { boletos: 5, traslado: 5, hospedaje: 7, paquete: 10 };


// Cortes de comisión: lo cargado del 1 al 15 se paga el 20; del 16 a fin de mes, el 5 del mes siguiente.
function _corte(f) {
  if (diaMes(f) <= 15) return ymd(rep(f, { day: 20 }));
  const sig = rep(mas(rep(f, { day: 28 }), { dias: 4 }), { day: 5 });
  return ymd(sig);
}


// cliente, asesor, modalidad, monto, días desde la carga, estado, liquidación, motivo de rechazo
const COMISIONES_VENTA = [
  ['Sofía Ramírez', ASESORA, 'paquete', 540, 19, 'liquidada', 23, null],
  ['Isabel Moreno', ASESORA, 'hospedaje', 480, 14, 'verificada', null, null],
  ['Ricardo Díaz', ASESORA, 'hospedaje', 650, 4, 'verificada', null, null],
  ['Fernando Blanco', ASESORA, 'paquete', 1100, 3, 'enviada', null, null],
  ['Jorge Medina', ASESORA, 'boletos', 430, 2, 'rechazada', null, 'Falta el comprobante del saldo'],
  ['Camila Rojas', 'Luisa Demo', 'paquete', 1200, 6, 'verificada', null, null],
  ['Elena Vargas', 'Carlos Demo', 'hospedaje', 760, 5, 'liquidada', 24, null],
];


function comision_ventas_listar(m, a) {
  const out = [];
  COMISIONES_VENTA.forEach(([cli, ase, mod, monto, d, estado0, liq, motivo], idx) => {
    const i = idx + 1;
    const verificada_a_mano = Object.hasOwn(g(m.tablas, '_cm_estados', {}), i);
    const estado = g(g(m.tablas, '_cm_estados', {}), i, estado0);   // comision_venta_verificar cambia el estado en pantalla
    const cargada = mas(AHORA, { dias: -d });
    const l = LEADS.find(x => x.nombre === cli) ?? null;
    const montos = Object.fromEntries(Object.keys(PCT).map(k => [k, k === mod ? monto : 0]));
    out.push({ id: i, usuario_id: UUID_ASESOR[ase], vendedor: ase, reserva_id: l ? l.id - 8900 : null,
      reserva_codigo: l ? `R-${pad(l.id - 8900, 6)}` : null, cliente_nombre: cli,
      cliente_telefono: l ? l.telefono : '+584125550099', cliente_cedula: 'V-00.000.0' + pad(i, 2),
      cliente_correo: null, destino: l ? l.destino : 'Margarita', modalidad: mod,
      ...Object.fromEntries(Object.entries(montos).map(([k, v]) => [`monto_${k}`, v])), ...Object.fromEntries(Object.entries(PCT).map(([k, v]) => [`pct_${k}`, v])),
      comision_total: rd(monto * PCT[mod] / 100, 2), cargada_en: iso(cargada), pago_el: _corte(cargada),
      estado, auto_verificada: estado === 'verificada' && i % 2 === 0 && !verificada_a_mano, motivo_rechazo: motivo,
      liquidacion_numero: liq });
  });
  return _es_asesor(m) ? out.filter(c => c.vendedor === g(m.usuario, 'nombre')) : out;
}


function comision_contexto(m, a) {
  const hoy = mas(AHORA, { horas: -4 });
  const fin = diaMes(hoy) <= 15 ? rep(hoy, { day: 15 }) : mas(rep(mas(rep(hoy, { day: 28 }), { dias: 4 }), { day: 1 }), { dias: -1 });
  const cierre = mas(rep(fin, { hour: 23, minute: 59, second: 0 }), { horas: 4 });  // 23:59 hora Caracas
  return { vendedor_id: m.usuario.id, pago_el: _corte(hoy), cierra_en: iso(cierre),
    porcentajes: PCT };
}


function listar_mis_clientes_asignados(m, a) {
  const pend = [['Daniel Herrera', 'Retomar: quería viajar el año que viene', 2], ['Luis Fernández', 'Preguntó por Morrocoy en temporada baja', 5]];
  const out = [];
  pend.forEach(([nombre, nota, h], idx) => {
    const l = _leads(m).find(x => x.nombre === nombre) ?? null;
    if (l) out.push({ task_id: idx + 1, lead_id: l.id, nombre, telefono: l.telefono, destino: l.destino,
      // vence_at null: app.js:19998 llama fmtFecha fuera de su alcance y revienta (bug de prod, arreglar en etapa 5)
      estado: l.estado, notas: nota, vence_at: null, resultado_contacto: null });
  });
  return out;
}


function listar_leads_en_facturacion(m, a) {
  const out = [];
  _vendidos(m, _es_asesor(m) ? g(m.usuario, 'nombre') : null).forEach((l, idx) => {
    const i = idx + 1;
    const hecho = l.estado === 'VENTA COMPLETA';
    const meta = RESERVA_META[l.nombre];
    out.push({ bandeja_id: i, lead_id: l.id, nombre: l.nombre, telefono: l.telefono, destino: l.destino,
      asesor: l.asesor, enviado_por: l.asesor, creado_en: _cierre(l), estado: hecho ? 'procesado' : 'pendiente',
      procesado_en: hecho ? hace({ dias: 2 }) : null, admin_destino: 'Admin Demo', cedula: 'V-00.000.0' + pad(i, 2),
      tipo_venta: [l.servicio.toLowerCase()], hotel_posada: meta[4], vuelo_origen: null, vuelo_destino: null,
      fecha_viaje: dia(meta[2]), fecha_regreso: dia(meta[2] + meta[3]), personas: l.personas, adultos: l.personas,
      ninos: 0, infantes: 0, metodo_pago: 'Pago móvil', referencia_pago: `00${4500 + i}`,
      monto_pagado: _pagado(l), monto_total: flotante(l.total), notas_venta: null, facturada: hecho });
  });
  return out;
}


// ---------- Asesor: herramientas, Lyra, chat ----------
function listar_destinos(m, a) {
  return DESTINOS.map(([i, n, r, p, gr]) => ({ id: i, nombre: n, region: r, pais: p, grupo: gr, activo: true }));
}


function stop_sales_vigentes(m, a) {
  return [{ producto_id: 102, nombre: 'Sunsol Ecoland', fecha_desde: dia(10), fecha_hasta: dia(14), estado: 'stop_sale' },
    { producto_id: 104, nombre: 'Villa Caracol', fecha_desde: dia(20), fecha_hasta: dia(23), estado: 'on_request' }];
}


function asistente_acciones_listar(m, a) {
  const maria = _leads(m).find(l => l.nombre === 'María González') ?? null;
  const rid = maria ? maria.id - 8900 : null;
  const acc = (i, h, canal, herr, params, res, reserva = null) => ({ id: i, created_at: hace(h), canal, herramienta: herr, parametros: params, resultado: res, ok: true,
    escritura: true, reserva_id: reserva, deshacible: true, deshecha_en: null, usuario: g(m.usuario, 'nombre') });
  return [acc(3, 0.5, 'crm', 'nota_lead', { lead: 'María González', nota: 'Prefiere habitación con vista al mar' },
    { mensaje: 'Nota guardada en la ficha de María González' }),
  acc(2, 3, 'telegram', 'guardar_pasajero', { nombre: 'Juan González', documento: 'V-00.000.002' },
    { mensaje: 'Pasajero agregado a la reserva' }, rid),
  acc(1, 26, 'telegram', 'mover_etapa_lead', { lead: 'Pedro Martínez', estado: 'COTIZACION ENVIADA' },
    { mensaje: 'Pedro Martínez pasó a COTIZACION ENVIADA' })];
}


function mis_conversaciones(m, a) {
  return [{ conversacion_id: 1, tipo: 'grupo', nombre: 'Equipo de ventas', otro_usuario_id: null,
    ultimo_mensaje: { tipo: 'texto', contenido: 'Recuerden cargar los abonos antes del corte 👍', created_at: hace(2), es_mio: false },
    no_leidos: 0 },
  { conversacion_id: 2, tipo: 'directo', nombre: 'Admin Demo', otro_usuario_id: USUARIOS.admin.id,
    ultimo_mensaje: { tipo: 'texto', contenido: 'Listo, ya verifiqué el pago de Ricardo', created_at: hace(5), es_mio: false },
    no_leidos: 0 }];
}


function _dias_rango(a) {
  try {
    const d = Date.parse(a.p_hasta.replace('Z', '+00:00')) - Date.parse(a.p_desde.replace('Z', '+00:00'));
    if (Number.isNaN(d)) throw new Error('fromisoformat');
    return Math.max(1, redondear(d / 1000 / 86400));
  } catch (e) { return 1; }
}


function panel_rendimiento_ia(m, a) {
  const k = _dias_rango(a);
  const res = f => ({ conversaciones: Math.trunc(142 * k * f), destinos: Math.trunc(118 * k * f), telefonos: Math.trunc(61 * k * f),
    intenciones: Math.trunc(49 * k * f), leads_calificados: Math.trunc(44 * k * f), oportunidades_sin_lead: 0,
    duplicados: 0, solo_boton: Math.trunc(9 * k * f) });
  return { salud: { estado: 'bien', ultima_actividad: hace(0.1), incidentes_criticos: 0, errores_tecnicos: 0 },
    resumen: res(1), anterior: res(0.88),
    operacion: { ultima_actividad: hace(0.1), latencia_promedio_ms: 4200, latencia_p95_ms: 8900,
      tokens_entrada: 910000 * k, tokens_cache: 640000 * k, tokens_salida: 52000 * k, salidas_finales_medidas: 131 * k },
    ventas: { esperando_primer_contacto: 0, ventas_confirmadas: 3 * k, facturacion_atribuida: 1840 * k },
    colaboraciones: { total: 0, por_campania: [] },
    calidad: { modelo: { pregunta_repetida: 2 * k, respuesta_extensa: 4 * k }, visible: {} },
    por_canal: [{ canal: 'instagram', conversaciones: Math.trunc(118 * k), telefonos: Math.trunc(50 * k), leads_calificados: Math.trunc(37 * k), latencia_promedio_ms: 4300 },
      { canal: 'web', conversaciones: Math.trunc(24 * k), telefonos: Math.trunc(11 * k), leads_calificados: Math.trunc(7 * k), latencia_promedio_ms: 3700 }] };
}


function panel_piloto_ia(m, a) {
  const k = _dias_rango(a);
  return { grupos: [{ experimento_grupo: 'control', contactos: 114 * k, conversion_telefono_pct: 41.2, con_cta_ausente: 0, con_fallo_visible: 0 },
    { experimento_grupo: 'tratamiento', contactos: 28 * k, conversion_telefono_pct: 44.6, con_cta_ausente: 0, con_fallo_visible: 0 }] };
}


function panel_reactivacion_ia(m, a) {
  const k = _dias_rango(a);
  return { grupos: [{ grupo_experimental: 'tratamiento', elegibles: 36 * k, enviadas: 31 * k, respondidas: 9 * k, rescatadas: 4 * k, canceladas: 1 * k }],
    grupos_foto: [{ grupo_foto: 'con_foto', enviadas: 16 * k, respondidas: 5 * k }, { grupo_foto: 'sin_foto', enviadas: 15 * k, respondidas: 4 * k }],
    entrega: { turnos: 140 * k, callbacks: 140 * k, reintentos: 0, requieren_atencion: 0 },
    salud_cron: { ultima_corrida_ok: hace(0.15), ultimo_error: null }, no_contactar: 0 };
}


function voz_ia_referencia(m, b) {
  return { ok: true, temperatura: 0.7, top_p: 0.7, velocidad: 1.0, entrenado: true, muestras: [] };
}


function _fila_lead(m, lead_id) { const id = entero(lead_id); return g(m.tablas, 'leads', []).find(l => l.id === id) ?? null; }


function actualizar_lead(m, a) {
  const l = _fila_lead(m, g(a, 'p_lead_id'));
  if (!l) return { ok: false, error: 'lead_no_encontrado' };
  if (g(a, 'p_estado')) {
    l.estado = a.p_estado;
    if (a.p_estado !== 'POR ATENDER' && !g(l, 'fecha_primer_contacto')) l.fecha_primer_contacto = hace(0);
    if (a.p_estado === 'VENTA COMPLETA') {
      [l.monto_completo, l.restante_pago] = [g(l, 'total') || g(l, 'monto'), 0];
    }
  }
  return OK;
}


function guardar_postventa(m, a) {
  const l = _fila_lead(m, g(a, 'p_lead_id'));
  if (!l) return { ok: false, error: 'lead_no_encontrado' };
  if (g(a, 'p_marcar_pagado')) {
    const total = flotante(g(a, 'p_monto_total') || 0), pagado = flotante(g(a, 'p_monto_pagado') || 0);
    Object.assign(l, { estado: 'PAGO REALIZADO', monto: total, total, monto_inicial: pagado, restante_pago: Math.max(total - pagado, 0) });
    const nuevas = setdefault(m.tablas, '_facturas_nuevas', []);
    nuevas.push({ numero: 1026 + nuevas.length, lead_id: l.id, cliente: l.nombre, asesor: g(l, 'asesor'), total,
      costo: g(a, 'p_costo_neto'), proveedor: g(a, 'p_proveedor') });
  }
  return OK;
}


function marcar_bandeja_procesada(m, a) {
  setdefault(m.tablas, '_bandeja_procesada', []).push(entero(g(a, 'p_lead_id')));
  return OK;
}


function registrar_abono_venta(m, a) {
  const l = _fila_lead(m, g(a, 'p_lead_id'));
  if (!l) return { ok: false, error: 'lead_no_encontrado' };
  const total = flotante(g(l, 'total') || g(l, 'monto') || 0);
  l.monto_inicial = flotante(g(l, 'monto_inicial') || 0) + flotante(g(a, 'p_monto') || 0);
  l.restante_pago = Math.max(total - l.monto_inicial, 0);
  if (l.restante_pago === 0) l.monto_completo = total;
  return OK;
}


function estadisticas_asesor(m, a) {
  const leads = m.tablas.leads;
  const atendidos = leads.filter(l => !['POR ATENDER', 'NUMERO INVALIDO'].includes(l.estado));
  const vendidos = leads.filter(l => ['PAGO REALIZADO', 'VENTA COMPLETA'].includes(l.estado));
  const monto = vendidos.reduce((s, l) => s + flotante(g(l, 'total') || g(l, 'monto') || 0), 0);
  const cotizados = leads.filter(l => ['COTIZACION ENVIADA', 'PAGO REALIZADO', 'VENTA COMPLETA'].includes(l.estado));
  const hoy = new Date(), hy = hoy.getFullYear(), hm = hoy.getMonth() + 1;
  const meses = [5, 4, 3, 2, 1, 0].map(k => [hy + Math.floor((hm - 1 - k) / 12), (((hm - 1 - k) % 12) + 12) % 12 + 1]);
  const base = [[38, 4, 1850, 2.4], [42, 5, 2300, 2.1], [35, 3, 1420, 2.8], [47, 6, 2980, 1.9], [44, 5, 2510, 1.7]];
  const cols = [...base, [atendidos.length, vendidos.length, redondear(monto), 1.2]];
  const serie = meses.slice(0, cols.length).map(([y, mm], i) => { const [at, v, mo, h] = cols[i];
    return { mes: `${y}-${pad(mm, 2)}`, atendidos: at, ventas: v, monto: mo, horas_respuesta: h }; });
  const por_dest = new Map();
  for (const l of leads) {
    const k = g(l, 'destino') || 'Otro';
    if (!por_dest.has(k)) por_dest.set(k, [0, 0]);
    const e = por_dest.get(k);
    e[0] += 1;
    e[1] += +vendidos.includes(l);
  }
  const destinos = [...por_dest.entries()].map(([k, [t, v]]) => ({ destino: k, total: t, pct: redondear(100 * v / t) })).sort((x, y) => y.total - x.total);
  return { ok: true, embudo: { asignados: leads.length, atendidos: atendidos.length, ventas: vendidos.length, monto,
    conv_pct: redondear(100 * vendidos.length / Math.max(atendidos.length, 1)) },
  calidad: { horas_respuesta: 1.2 }, cotizaciones_enviadas: cotizados.length,
  serie_mensual: serie, destinos: destinos.slice(0, 6) };
}


function fijar_proxima_accion(m, a) {
  const l = _fila_lead(m, g(a, 'p_lead_id'));
  if (!l) return { ok: false, error: 'lead_no_encontrado' };
  [l.proxima_accion_at, l.proxima_accion_nota] = [g(a, 'p_at'), g(a, 'p_nota')];
  return { ok: true, proxima_accion_at: g(a, 'p_at'), proxima_accion_nota: g(a, 'p_nota') };
}


function guardar_notas_lead(m, a) {
  const l = _fila_lead(m, g(a, 'p_lead_id'));
  if (l) l.notas = g(a, 'p_notas') || null;
  return OK;
}


function registrar_cotizacion_enviada(m, a) {
  const l = _fila_lead(m, g(a, 'p_lead_id'));
  if (!l) return { ok: false, error: 'lead_no_encontrado' };
  [l.estado, l.fecha_cotizacion_enviada] = ['COTIZACION ENVIADA', hace(0)];
  return { ok: true, estado: l.estado, fecha_cotizacion_enviada: l.fecha_cotizacion_enviada };
}


function enviar_a_facturacion(m, a) {
  const l = _fila_lead(m, g(a, 'p_lead_id'));
  if (!l) return { ok: false, error: 'lead_no_encontrado' };
  // Simula que el admin ya la facturó: el lead pasa a PAGO REALIZADO y aparece en Mis Ventas/Reservas.
  const pagado = flotante(g(a, 'p_monto_pagado') || 0), total = flotante(g(a, 'p_monto_total') || 0);
  const tipos = pyor(g(a, 'p_tipo_venta'), []);
  Object.assign(l, { estado: 'PAGO REALIZADO', monto_inicial: pagado, monto: total, total, restante_pago: Math.max(total - pagado, 0),
    monto_completo: pagado >= total ? total : null, personas: ((g(a, 'p_adultos') || 0) + (g(a, 'p_ninos') || 0)) || g(l, 'personas') });
  if (tipos.length) l.servicio = tipos[0].charAt(0).toUpperCase() + tipos[0].slice(1).toLowerCase();
  return { ok: true, admin_destino: 'Admin Demo' };
}


function emitir_pago(m, a) {
  return { ok: true, token: 'demo-' + str(g(a, 'p_lead_id')) + '-a7f3k2', expira_en: en({ dias: 2 }) };
}


function reportar_telefono_incorrecto(m, a) {
  const l = _fila_lead(m, g(a, 'p_lead_id'));
  if (l && g(a, 'p_telefono_corregido')) l.telefono = l.numero = a.p_telefono_corregido;
  return null;
}


// Edge Function reasignar-lead: el lead pasa a Carlos Demo; por RLS la asesora deja de verlo.
function reasignar_lead(m, body) {
  const l = _fila_lead(m, g(body, 'p_lead_id'));
  if (!l) return { ok: false, motivo: 'lead_no_encontrado' };
  if (g(l, 'no_reasignar')) return { ok: false, motivo: 'no_reasignable' };
  m.tablas.leads.splice(m.tablas.leads.indexOf(l), 1);
  return { ok: true, nuevo_asesor: 'Carlos Demo', pool_agotado: false };
}


// ---------- Tareas v2 (tutorial 17): estado propio en el mock, mismas formas que las RPC reales ----------
const ADMIN_DEMO = { id: USUARIOS.admin.id, nombre: 'Admin Demo' };


// Hora de hoy (Caracas) que todavía no pasó, para que la tarjeta caiga en «Hoy» a cualquier hora de grabación.
function _vence_hoy(horas = 3) {
  const ccs = mas(AHORA, { horas: -4 });
  let v = new Date(Math.min(T(mas(ccs, { horas })), T(rep(ccs, { hour: 23, minute: 40, second: 0 }))));
  v = new Date(Math.max(T(v), T(mas(ccs, { minutos: 25 }))));
  return iso(mas(v, { horas: 4 }));
}


function _paso(pid, titulo, detector, { hecho = false, ...extra } = {}) {
  const params = Object.hasOwn(extra, 'params') ? extra.params : {};
  delete extra.params;
  return { id: pid, titulo, detector, params, requerido: true,
    estado: hecho ? 'hecho' : 'pendiente', hecho_at: hecho ? hace(0.4) : null,
    origen: hecho ? 'auto' : null, hecho_por: hecho ? ASESORA : null, ...extra };
}


function _tk(m) {
  if (m._tareas === undefined) {
    const maria = _lead('María González'), carmen = _lead('Carmen López');
    const cli = l => ({ id: l.id, nombre: l.nombre, estado: l.estado, asesor: l.asesor, eliminado: false });
    const base = (tid, titulo, k = {}) => ({ id: tid, titulo, estado: 'pendiente', prioridad: 'media', vence_at: null,
      visto_at: hace(2), version: 1, descripcion: null, asesor_id: ID_ASESORA, personal: false,
      creador: ADMIN_DEMO, lead: null, completada_at: null, comentarios: [],
      eventos: [{ id: tid * 10, tipo: 'creada', actor: 'Admin Demo', created_at: hace(3) }], ...k });
    m._tareas = [
      base(701, 'Cotizar Canaima a Carmen López', { estado: 'en_proceso', prioridad: 'alta', vence_at: _vence_hoy(),
        descripcion: 'Quiere conocer Canaima con su pareja en diciembre. Mándale la cotización hoy.', lead: cli(carmen),
        pasos: [_paso(7011, 'Llamarla para saber qué busca', 'llamada', { hecho: true }),
          _paso(7012, 'Enviarle la cotización', 'cotizacion_enviada', { lead_id: carmen.id }),
          _paso(7013, 'Agendar el seguimiento', 'proxima_accion', { lead_id: carmen.id })],
        comentarios: [{ autor: 'Admin Demo', autor_id: ADMIN_DEMO.id, cuerpo: 'Ofrécele el paquete con vuelo incluido, tiene promo esta semana.', created_at: hace(2.5) }] }),
      base(702, 'Llamar a María González: es nueva', { vence_at: hace(1.5), visto_at: null, lead: cli(maria),
        pasos: [_paso(7021, 'Llamarla', 'llamada', { lead_id: maria.id })] }),
      base(703, 'Confirmar habitaciones con la posada de Mérida', { vence_at: _vence_hoy(4),
        pasos: [_paso(7031, 'Confirmar con la posada', 'manual')] }),
      base(704, 'Foto del flyer impreso en la oficina', { vence_at: en({ dias: 3 }),
        pasos: [_paso(7041, 'Tomar la foto', 'evidencia', { params: { tipo: 'foto' } })] }),
      base(705, 'Revisar el voucher de Sofía Ramírez', { estado: 'completada', completada_at: hace(0.2),
        pasos: [_paso(7051, 'Revisarlo', 'manual', { hecho: true })] }),
    ];
  }
  return m._tareas;
}


function _tarea(m, tid) { const id = entero(tid || 0); return _tk(m).find(t => t.id === id) ?? null; }


function _recalcular(t) {
  const req = t.pasos.filter(p => p.requerido);
  const hechos = req.filter(p => p.estado === 'hecho').length;
  t.version += 1;
  if (hechos === req.length) Object.assign(t, { estado: 'completada', completada_at: hace(0) });
  else if (hechos) t.estado = 'en_proceso';
}


function _evento(t, tipo, k = {}) {
  t.eventos.push({ id: t.id * 10 + t.eventos.length, tipo, actor: ASESORA, created_at: hace(0), ...k });
}


// Lo que hacen los triggers de Fase 2: un evento del lead cumple el paso pendiente de ese tipo.
function _tk_detectar(m, lead_id, detector) {
  for (const t of _tk(m)) {
    for (const p of t.pasos) {
      if (p.estado === 'pendiente' && p.detector === detector && g(p, 'lead_id') === entero(lead_id || 0)) {
        Object.assign(p, { estado: 'hecho', hecho_at: hace(0), origen: 'auto', hecho_por: ASESORA });
        _evento(t, 'paso', { detalle: { titulo: p.titulo, origen: 'auto' } });
        _recalcular(t);
      }
    }
  }
}


function listar_mis_tareas_v2(m, a) {
  const fila = t => {
    const req = t.pasos.filter(p => p.requerido);
    const px = t.pasos.find(p => ['pendiente', 'rechazado'].includes(p.estado)) ?? null;
    const hechos = req.filter(p => p.estado === 'hecho').length;
    return { ...pick(t, ['id', 'titulo', 'estado', 'prioridad', 'vence_at', 'visto_at', 'personal', 'lead', 'completada_at']),
      creador: t.personal ? null : t.creador.nombre, pasos_total: req.length, pasos_hechos: hechos,
      progreso: redondear(100 * hechos / Math.max(req.length, 1)), problema: t.estado === 'bloqueada',
      proximo: px && { id: px.id, titulo: px.titulo, detector: px.detector } };
  };
  return { ok: true, hoy: dia(), ahora: hace(0), lote: { pendientes: 18, hechas_hoy: 12 }, tareas: _tk(m).map(fila) };
}


function tarea_detalle(m, a) {
  const t = _tarea(m, g(a, 'p_id'));
  if (!t) return { ok: false, error: 'no_encontrada', mensaje: 'La tarea ya no existe' };
  return { ok: true, tarea: pick(t, ['id', 'titulo', 'estado', 'prioridad', 'vence_at', 'visto_at', 'version', 'descripcion', 'asesor_id', 'personal']),
    asignado: { id: ID_ASESORA, nombre: ASESORA }, creador: t.creador, lead: t.lead, pasos: t.pasos,
    comentarios: t.comentarios, evidencia: [], reportes: [], eventos: t.eventos,
    puede: { trabajar: true, gestionar: t.personal, aprobar: false } };
}


function tarea_marcar_vista(m, a) {
  const t = _tarea(m, g(a, 'p_id'));
  if (t && !t.visto_at) { t.visto_at = hace(0); _evento(t, 'vista'); }
  return OK;
}


function tarea_paso_listo(m, a) {
  const t = _tarea(m, g(a, 'p_id'));
  const p = t && (t.pasos.find(x => x.id === entero(g(a, 'p_paso_id') || 0)) ?? null);
  if (!p) return { ok: false, error: 'paso_no_encontrado', mensaje: 'Ese paso ya no existe' };
  Object.assign(p, { estado: 'hecho', hecho_at: hace(0), origen: 'manual', hecho_por: ASESORA });
  _evento(t, 'paso', { detalle: { titulo: p.titulo, origen: 'manual' } });
  _recalcular(t);
  return { ok: true, estado: t.estado };
}


function tarea_registrar_accion(m, a) {
  const t = _tarea(m, g(a, 'p_id'));
  const p = t && (t.pasos.find(x => x.id === entero(g(a, 'p_paso_id') || 0)) ?? null);
  if (!p) return { ok: false, error: 'paso_no_encontrado', mensaje: 'Ese paso ya no existe' };
  _evento(t, 'accion');
  return { ok: true, paso: { id: p.id, detector: p.detector, lead_id: g(t.lead || {}, 'id'), reserva_id: null } };
}


function tarea_comentar(m, a) {
  const t = _tarea(m, g(a, 'p_id'));
  if (t) {
    t.comentarios.push({ autor: ASESORA, autor_id: ID_ASESORA, cuerpo: g(a, 'p_cuerpo'), created_at: hace(0) });
    _evento(t, 'comentario');
  }
  return OK;
}


// Desde el tutorial solo se crean recordatorios personales (la asesora se asigna a sí misma).
function tarea_crear(m, a) {
  const d = pyor(g(a, 'p_datos'), {});
  const tid = Math.max(..._tk(m).map(t => t.id)) + 1;
  _tk(m).push({ id: tid, titulo: g(d, 'titulo'), estado: 'pendiente', prioridad: 'media', vence_at: g(d, 'vence_at'),
    visto_at: hace(0), version: 1, descripcion: null, asesor_id: ID_ASESORA, personal: true,
    creador: { id: ID_ASESORA, nombre: ASESORA }, lead: null, completada_at: null, comentarios: [],
    eventos: [{ id: tid * 10, tipo: 'creada', actor: ASESORA, created_at: hace(0) }],
    pasos: [_paso(tid * 10 + 1, g(d, 'titulo'), 'manual')] });
  return { ok: true, ids: [tid], avisos: [], previos: 0 };
}


function _cotizacion_y_tarea(m, a) {
  const r = registrar_cotizacion_enviada(m, a);
  if (g(r, 'ok')) _tk_detectar(m, g(a, 'p_lead_id'), 'cotizacion_enviada');
  return r;
}


function _proxima_y_tarea(m, a) {
  const r = fijar_proxima_accion(m, a);
  if (g(r, 'ok')) _tk_detectar(m, g(a, 'p_lead_id'), 'proxima_accion');
  return r;
}


const RPCS_TAREAS = {
  listar_mis_tareas_v2, tarea_detalle, tarea_marcar_vista,
  tarea_paso_listo, tarea_registrar_accion, tarea_comentar,
  tarea_crear, listar_mis_tareas: (m, a) => [],  // tablero v1 escondido (#tareas-v1) que app.js aún carga
  tareas_de_lead: (m, a) => ({ ok: true, tareas: _tk(m).filter(t => g(t.lead || {}, 'id') === entero(g(a, 'p_lead_id') || 0)).map(t => (
    { id: t.id, titulo: t.titulo, estado: t.estado, asesor: ASESORA })) }),
  // Los triggers de detectores, imitados: marcar la cotización o agendar el seguimiento cumple el paso.
  registrar_cotizacion_enviada: _cotizacion_y_tarea, fijar_proxima_accion: _proxima_y_tarea,
};


const RPCS_ASESOR = {
  actualizar_lead, reportar_telefono_incorrecto,
  fijar_proxima_accion, guardar_notas_lead,
  registrar_cotizacion_enviada, enviar_a_facturacion, emitir_pago,
  registrar_abono_venta, estadisticas_asesor,
  usuarios_chat: (m, a) => [{ id: USUARIOS.admin.id, nombre: 'Admin Demo', rol: 'admin' }],
  mis_ventas, postventa_bandeja, postventa_resumen,
  reserva_detalle, reserva_checklist, comision_ventas_listar, comision_contexto,
  listar_mis_clientes_asignados, listar_leads_en_facturacion,
  listar_destinos, stop_sales_vigentes,
  stop_sales_pdf_actual: (m, a) => [{ storage_path: `stop-sales/${dia()}.pdf`, creado_en: hace(5), creado_por: 'Admin Demo' }],
  hot_sales_publicas: (m, a) => [[514, 'Margarita'], [509, 'Los Roques'], [504, 'Coche']].map(([t, d], j) => { const i = j + 1;
    return { id: t, posicion: i, manual: i === 1, destino: d, nino_gratis: t === 514 }; }),
  notas_para_repasar_hoy: (m, a) => [
    { id: '0de00000-0000-4000-8000-0000000a07e1', titulo: 'Cotizá con fotos', nivel: 1, etiquetas: ['ventas'],
      cuerpo: 'Las cotizaciones que van con fotos del hotel se responden más rápido. Usá la Galería antes de mandar el precio.' }],
  asistente_mi_vinculo: (m, a) => ({ vinculado: true, vinculado_en: hace({ dias: 20 }) }),
  asistente_acciones_listar,
  lyra_memoria_listar: (m, a) => [
    { id: 1, tipo: 'habito', texto: 'Le gusta que le recuerde los seguimientos a primera hora', actualizado: hace({ dias: 2 }) },
    { id: 2, tipo: 'dato', texto: 'Vende sobre todo Margarita y Los Roques', actualizado: hace({ dias: 6 }) }],
  mis_conversaciones,
  listar_proveedores: (m, a) => [...new Set(Object.values(RESERVA_META).map(x => x[4]))].sort().map((n, j) => ({ id: j + 1, nombre: n })),
  // Boletería: la asesora demo no es de boletería; responden vacío sin error.
  agentes_boleteria_estado: (m, a) => [], listar_cola_boleteria: (m, a) => [],
  registrar_contacto_lead: (m, a) => OK,
  // Voucher: sin ventas parecidas; queda en el historial y se confirma sin tocar reservas.
  voucher_revisar_venta: (m, a) => ({ ok: true, reservas: [] }),
  voucher_preparar: (m, a) => { const t = m.tablas.vouchers ||= [], n = 1200 + t.length + 1;
    const v = { ...g(a, 'p_datos'), id: n, numero_factura: n, revision: 1, created_at: new Date().toISOString(), pdf_path: null, reserva_id: null };
    t.push(v); return { ok: true, voucher: v }; },
  voucher_confirmar_venta: (m, a) => ({ ok: true, lead_id: null, reserva_id: null, codigo: null }),
  ...RPCS_TAREAS,
};


const RPCS = {
  ...RPCS_ASESOR,
  dashboard_stats, conversion_por_destino,
  top_destinos_periodo: (m, a) => DESTINOS_TOP,
  estadisticas_asesores_lista: (m, a) => ASESORES.map(x => ({ asesor_id: UUID_ASESOR[x.nombre], nombre: x.nombre, activo: true })),
  ranking_asesores, metricas, informes_diarios_listado,
  listar_pagos, listar_ventas_pendientes_verificar,
  listar_bandeja_facturacion, listar_facturas,
  resumen_facturacion, listar_cuentas_por_pagar,
  listar_asesores_comision: (m, a) => ASESORES.map(x => ({ id: x.id, nombre: x.nombre, porcentaje_comision: x.id < 3 ? 5 : null })),
  listar_comisiones, comisiones_origen_panel,
  comision_liquidaciones_listar, personal_resumen,
  comision_liquidacion_marcar_pagada, comision_venta_verificar,
  rendimiento_asesores: (m, a) => ({
    'Andrea Demo': { asignados: 42, perdidos: 3, pct_perdido: 7, top_destinos_perdidos: [{ destino: 'Margarita', c: 2 }] },
    'Carlos Demo': { asignados: 38, perdidos: 4, pct_perdido: 10, top_destinos_perdidos: [{ destino: 'Los Roques', c: 2 }] },
    'Luisa Demo': { asignados: 18, perdidos: 5, pct_perdido: 22, top_destinos_perdidos: [] } }),
  listar_freelancers: (m, a) => [{ id: UUID_ASESOR['Luisa Demo'], nombre: 'Luisa Demo' }],
  carga_asesores: (m, a) => Object.fromEntries(ASESORES.map(x => x.nombre).map(n => [n, m.tablas.leads.filter(l => g(l, 'asesor') === n).length])),
  bio_config_get: (m, a) => ({ bio_max_por_30min: 4, bio_guardia_nocturna: '' }),
  listar_turno_actual: (m, a) => ASESORES.map(x => ({ nombre: x.nombre, en_turno: x.id < 3, pausa_hasta: null })),
  reparto_bio_hoy: (m, a) => [],
  comision_reglas_listar, admin_vincular_asesor, admin_guardar_reparto,
  asistencia_admin_hoy: (m, a) => ASESORES.map(x => ({ usuario_id: UUID_ASESOR[x.nombre], nombre: x.nombre, marco_hoy: x.id < 3,
    exento_hoy: false, tiene_recordatorios: true, strikes_mes: +(x.id === 3) })),
  asistencia_historial,
  asistencia_strikes_mes: (m, a) => [{ id: 1, asesor_id: UUID_ASESOR['Luisa Demo'], nombre: 'Luisa Demo', fecha: dia(-2),
    motivo: 'informe_faltante', anulado_at: null, anulado_motivo: null }],
  listar_asesores_activos: (m, a) => ASESORES.map(x => ({ nombre: x.nombre })),
  reasignaciones_kpis: (m, a) => ({ timeout: 1, manual: 1, agotados: 0 }),
  // Escrituras y latidos que solo deben responder sin error.
  verificar_pago, confirmar_venta, rechazar_venta: confirmar_venta,
  guardar_postventa, marcar_bandeja_procesada,
  comisiones_manuales_set: (m, a) => OK, guardar_comision_origen_pct: (m, a) => OK,
  registrar_presencia: (m, a) => null, actualizar_mi_perfil: (m, a) => OK,
  agent_check_in: (m, a) => ({ id: 1, asesor_id: m.usuario.id, hora_entrada: hace(1), hora_salida: null, estado_actual: 'activo' }),
  panel_rendimiento_ia, panel_piloto_ia, panel_reactivacion_ia,
  // Configuración de voces: listas vacías válidas (ningún tutorial muestra esa sección).
  voz_presets_listar: (m, a) => ({ ok: true, presets: [], overrides: [] }),
  voces_catalogo_listar: (m, a) => ({ ok: true, voces: [] }),
  perfiles_voz_listar: (m, a) => ({ ok: true, perfiles: [] }),
  boleteria_bandeja: (m, a) => [],
};
const LYRA_RESPUESTAS = [
  ['nota', 'Listo, le dejé la nota a la ficha de María González: «Llamar el viernes para cobrar el saldo». ' +
    'Si te equivocaste, la deshaces desde Acciones del asistente.'],
  ['reserva', 'La reserva R-000101 de María González (Margarita, 2 adultos) está en Cobro pendiente. ' +
    'Falta cobrar $340 del total de $680 y quedan 6 pendientes en el checklist. ' +
    '¿Quieres que te deje un recordatorio para cobrar el saldo?'],
  ['llamar', 'Hoy te falta llamar a María González: pidió precio para Margarita y todavía no le mandaste la cotización. ' +
    '¿Te dejo un recordatorio para mañana a las 10?'],
  [['todo incluido', 'todo-incluido', 'all inclusive'], 'Tienes 5 hoteles todo incluido en Margarita. Míralos en Tarifario, pestaña Hoteles, ' +
    'buscando «Margarita»: cada uno muestra su precio por persona en base doble.'],
  [['margarita', 'tarifario', 'hotel', 'playa'], 'En el tarifario tienes hoteles en Margarita, Coche, Los Roques, Canaima y Mérida. ' +
    'Míralos en Tarifario, pestaña Hoteles: cada uno muestra su precio por persona en base doble.'],
  [['maria', 'gonzalez'], 'María González pidió precio para Margarita y sigue POR ATENDER. ' +
    'Atiéndela desde Leads y mándale la cotización.'],
  [['ricardo', 'diaz'], 'Ricardo Díaz ya pagó una parte: está en PAGO REALIZADO. Registra el abono que falte desde Ventas.'],
];
const LYRA_NO_ENTIENDO = 'En modo prueba entiendo pocas cosas. Prueba con: «busca un todo incluido», ' +
  '«cómo va la reserva de María», «a quién me falta llamar hoy» o «déjale una nota».';


// Edge Function asistente-admin: respuestas fijas por palabra clave; la voz nunca sale del mock.
function asistente_admin(m, body) {
  if (g(body, 'accion')) return { ok: false, error: 'sin_voz_en_demo' };
  if (g(body, 'deshacer_accion_id')) return OK;
  const ms = pyor(g(body, 'messages'), [{}]);
  const ultimo = String(g(ms[ms.length - 1], 'content') || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const texto = (LYRA_RESPUESTAS.find(([clave]) => [clave].flat().some(c => ultimo.includes(c))) ?? [null, LYRA_NO_ENTIENDO])[1];
  return { ok: true, respuesta: texto, expresion: 'feliz' };
}


const FUNCIONES = { 'repartir-numeros': repartir_numeros, 'voz-ia-referencia': voz_ia_referencia, 'reasignar-lead': reasignar_lead,
  'asistente-admin': asistente_admin, 'crear-personal': crear_personal };

window.PRUEBA_RPCS = { RPCS, FUNCIONES };
})();
