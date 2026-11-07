(() => {
'use strict';

// Datos 100% ficticios para grabar los videotutoriales (asesora "Andrea Demo").
// Fechas relativas a hoy, para que "Hoy", vencimientos y cortes se vean vigentes
// el día que se graba. Teléfonos con prefijo 555 (no asignable).
const AHORA = new Date(Math.floor(Date.now() / 1000) * 1000);

const iso = d => { const t = d.toISOString(); return d.getTime() % 1000 === 0 ? t.replace(/\.\d{3}Z$/, '+00:00') : t.replace('Z', '000+00:00'); };
const ymd = d => d.toISOString().slice(0, 10);
const _delta = (horas, dias) => Math.round(horas * 3600000 + dias * 86400000);

function hace(horas = 0, dias = 0) {
  if (horas !== null && typeof horas === 'object') ({ horas = 0, dias = 0 } = horas);
  return iso(new Date(AHORA.getTime() - _delta(horas, dias)));
}

function en(horas = 0, dias = 0) {
  if (horas !== null && typeof horas === 'object') ({ horas = 0, dias = 0 } = horas);
  return iso(new Date(AHORA.getTime() + _delta(horas, dias)));
}

function dia(dias = 0) {
  return ymd(new Date(AHORA.getTime() + _delta(0, dias)));
}

const ID_ASESORA = '0de00000-0000-4000-8000-00000000a5e5';
const ID_ADMIN = '0de00000-0000-4000-8000-0000000ad010';
// El nombre que la persona escribe en la pantalla de inicio (misiones.js) reemplaza al de ejemplo.
// misiones.js guarda con el Storage ya parcheado por prueba-mock.js (prefijo 'prueba:'); este archivo corre antes del parche.
const [NOMBRE_PRUEBA, ROL_PRUEBA] = (() => { try { return [sessionStorage.getItem('prueba:prueba:nombre') || '', sessionStorage.getItem('prueba:prueba:rol')]; } catch { return ['', null]; } })();
const ASESORA = (ROL_PRUEBA === 'asesor' && NOMBRE_PRUEBA) || 'Andrea Demo';

const USUARIOS = {
  asesor: { id: ID_ASESORA, email: 'andrea.demo@demo.lotus', username: 'andrea.demo', nombre: ASESORA, rol: 'asesor' },
  admin: { id: ID_ADMIN, email: 'admin.demo@demo.lotus', username: 'admin.demo', nombre: (ROL_PRUEBA === 'admin' && NOMBRE_PRUEBA) || 'Admin Demo', rol: 'admin' },
};

function _usuario(u, extra = {}) {
  return { id: u.id, username: u.username, nombre: u.nombre, rol: u.rol,
    debe_cambiar_password: false, avatar_url: null,
    // Pipeline e Inicio nacen apagados en el CRM real. El asesor no ve Inicio (Mis Ventas pasó a Reservas); el admin lo conserva porque sus misiones usan Dashboard y Ranking.
    preferencias: { tutorial_visto: true, nav_extra: ['pipeline', ...(u.rol === 'admin' ? ['grp-inicio'] : []), 'grp-bandeja'], ultima_hija: { 'grp-bandeja': 'wa-bandeja' } }, ve_informe_diario: u.rol === 'admin',
    es_freelancer: false, bloqueado: false, es_superadmin: false, ...extra };
}

const ASESORES = [
  { id: 1, nombre: ASESORA, peso_asignacion: 35, peso_internacional: 30, activo: true, horario: '08:00-17:00' },
  { id: 2, nombre: 'Carlos Demo', peso_asignacion: 35, peso_internacional: 40, activo: true, horario: '08:00-17:00' },
  { id: 3, nombre: 'Luisa Demo', peso_asignacion: 30, peso_internacional: 30, activo: true, horario: '13:00-21:00' },
];

let _n = 0;

function lead(nombre, estado, destino, extra = {}) {
  const { asesor = ASESORA, horas = 2, ...resto } = extra;
  _n += 1;
  const tel = `+58412555${String(_n).padStart(4, '0')}`;
  const base = {
    id: 9000 + _n, nombre, telefono: tel, numero: tel, estado,
    asesor, asesor_activo: asesor, destino, destino_consulta: destino,
    servicio: 'Paquete', canal: 'instagram', fecha_creacion: hace(horas),
    fecha_primer_contacto: estado === 'POR ATENDER' ? null : hace(horas - 0.5),
    fecha_cotizacion_enviada: null, monto: null, monto_inicial: null, monto_completo: null,
    restante_pago: null, total: null, personas: 2, fecha_estimada: dia(30),
    notas: null, proxima_accion_at: null, proxima_accion_nota: null,
    vence_at: estado === 'POR ATENDER' ? en({ horas: 1 }) : null,
    lote_asignado_at: hace(horas), asignado_por: null, eliminado_at: null,
    contacto_directo_enviado_at: null, es_prueba: false, no_reasignar: false,
    prioridad_ia: null, servicios_comprados: [],
  };
  Object.assign(base, resto);
  return base;
}

// Sin clientes de ejemplo (pedido del dueño, 6-nov): todo lead de la práctica lo crea clientes-ia.js.
const LEADS = [];

const TABLAS = {
  usuarios: [_usuario(USUARIOS.asesor), _usuario(USUARIOS.admin)],
  asesores: ASESORES,
  leads: LEADS,
  whatsapp_conversaciones: [],
  whatsapp_mensajes: [],
  reasignaciones: [],
};

// ---------- Tarifario / Galería ----------
// id, nombre, region, pais, grupo (forma de listar_destinos)
const DESTINOS = [[1, 'Margarita', 'nacional', 'Venezuela', 'Isla de Margarita'], [2, 'Coche', 'nacional', 'Venezuela', 'Isla de Margarita'],
  [3, 'Los Roques', 'nacional', 'Venezuela', 'Los Roques'], [4, 'Canaima', 'nacional', 'Venezuela', 'Canaima'],
  [5, 'Mérida', 'nacional', 'Venezuela', 'Mérida'], [6, 'Morrocoy', 'nacional', 'Venezuela', 'Otros nacionales'],
  [7, 'Punta Cana', 'internacional', 'República Dominicana', 'Internacional']];
const ID_DESTINO = Object.fromEntries(DESTINOS.map(d => [d[1], d[0]]));

// Fotos reales (640 px) bajadas del Worker de fotos a prueba-fotos/h/<id real>-<k>.jpg.
function _fotos(real, n = 2) {
  return Array.from({ length: n }, (_, k) => ({ storage_path: real ? `h/${real}-${k}.jpg` : `demo/${real}-${k}.jpg`, orden: k, es_principal: k === 0, activo: true, width: 640, height: 800 }));
}

// id, tipo, nombre, destino, descripcion, id real en producción (fotos). Hoteles y precios reales del tarifario (oct-2026).
const _PRODUCTOS = [
  [101, 'hotel', 'Hesperia Playa El Agua', 'Margarita', 'En primera línea de Playa El Agua, cruzando el bulevar. Plan todo incluido', 3],
  [102, 'hotel', 'Sunsol Ecoland', 'Margarita', 'En el valle de Pedro González, zona norte de la isla, a 40 minutos del aeropuerto. Todo incluido', 12],
  [103, 'hotel', 'Sunsol Punta Blanca', 'Coche', 'En Playa La Punta, isla de Coche, a 20 minutos de Margarita. Todo incluido', 14],
  [104, 'hotel', 'Villa Caracol', 'Los Roques', 'En el extremo oeste del Gran Roque, zona tranquila y ventilada. Pensión completa', 304],
  [105, 'hotel', 'Venetur Mérida', 'Mérida', 'Bar, piscina, restaurante y traslado al teleférico', 1024],
  [106, 'hotel', 'Tapuy Lodge', 'Canaima', 'Lodge en el Parque Nacional Canaima, con expedición al Salto Ángel', 325],
  [107, 'hotel', 'Margarita Dynasty', 'Margarita', 'A 300 m del C.C. La Vela y 5 minutos del Sambil. Todo incluido', 20],
  [108, 'hotel', 'Costa Caribe', 'Margarita', 'Frente al mar en Playa La Boquita, a 3 km de Juan Griego. Todo incluido', 1],
  [109, 'hotel', 'Margarita Village', 'Margarita', 'Único todo incluido de Porlamar y pet friendly', 1026],
  [110, 'hotel', 'Los Corales', 'Los Roques', 'Posada cerca de playas de arena blanca: windsurf, pesca y navegación', 296],
  [111, 'hotel', 'Macanao Lodge By LD', 'Los Roques', 'Lodge de lujo en el corazón del archipiélago. Pensión completa', 298],
  [112, 'hotel', 'Refugio Turístico Mifafi', 'Mérida', 'Cabañas con calefacción, agua caliente y TV. Dos restaurantes', 319],
  [113, 'hotel', 'Waka Wená', 'Canaima', 'Suites con jacuzzi. Paquete full pensión 4D/3N', 328],
  [201, 'paquete', 'Margarita 4D/3N Todo Incluido', 'Margarita', 'Boleto aéreo, traslados y hotel. Plan todo incluido', 3],
  [202, 'paquete', 'Los Roques Full Experience 3D/2N', 'Los Roques', 'Vuelo, posada y paseo a cayos. Pensión completa', 298],
  [203, 'paquete', 'Mérida Andina 4D/3N', 'Mérida', 'Posada, tour al páramo y teleférico', 319],
  [301, 'destino', 'Full Day Cayo Sombrero', 'Morrocoy', 'Lancha ida y vuelta. Almuerzo en la playa', null],
  [302, 'destino', 'Full Day Salto Ángel', 'Canaima', 'Sobrevuelo al Salto Ángel. Almuerzo en el campamento', 325],
];
// id, producto_id, titulo, plan, habitacion, desde, sgl, dbl, tpl, tags
const _TARIFAS = [
  [501, 101, 'Promoción temporada baja', 'Todo incluido', 'Holiday Village', 48, 70, 50, 48, ['todo_incluido']],
  [502, 107, 'Temporada baja', 'Todo incluido', 'Estándar', 81, 81, 89, 89, ['todo_incluido']],
  [503, 102, 'Temporada baja', 'Todo incluido', 'Superior', 107, 155, 110, 107, ['todo_incluido']],
  [504, 103, 'Temporada baja', 'Todo incluido', 'Superior', 107, 165, 110, 107, ['todo_incluido']],
  [505, 104, 'Temporada baja', 'Pensión completa', 'Superior (domingo a jueves)', 215, 331, 244, 215, ['pension_completa']],
  [506, 105, 'Octubre a diciembre', 'Solo desayuno', 'Matrimonial', 69, 69, 69, 69, ['solo_desayuno']],
  [507, 106, 'Jueves a domingo · 3 noches', 'Pensión completa', 'Cabaña', 905, 1135, 905, 905, ['pension_completa']],
  [513, 108, 'Temporada baja 2027', 'Todo incluido', 'Standard', 60, 90, 60, 60, ['todo_incluido']],
  [514, 109, 'Promo temporada baja', 'Todo incluido', 'Estándar', 65, 85, 65, 65, ['todo_incluido', 'ninos_gratis']],
  [515, 110, 'Temporada alta · noche', 'Solo alojamiento', 'Doble', 151, 151, 151, 151, []],
  [516, 111, 'Regular (domingo a jueves)', 'Pensión completa', 'Doble', 569, 737, 569, 569, ['pension_completa']],
  [517, 112, 'Paquete 4 días / 3 noches', 'Paquete', 'Cabaña', 150, 150, 150, 150, []],
  [518, 113, 'Jueves a domingo (4D/3N)', 'Pensión completa', 'Suite superior', 1140, 1368, 1140, 1140, ['pension_completa']],
  [508, 201, 'Paquete 4D/3N', 'Todo incluido', 'Doble estándar', 340, 460, 340, 320, ['todo_incluido']],
  [509, 202, 'Paquete 3D/2N', 'Pensión completa', 'Doble', 550, 690, 550, 520, ['pension_completa']],
  [510, 203, 'Paquete 4D/3N', 'Solo desayuno', 'Doble', 240, 310, 240, 225, ['solo_desayuno']],
  [511, 301, 'Full Day', 'Almuerzo', '-', 45, 45, 45, 45, []],
  [512, 302, 'Full Day', 'Almuerzo', '-', 390, 390, 390, 390, []],
];
const _DESC = Object.fromEntries(_PRODUCTOS.map(p => [p[0], p]));

function _tarifa(t) {
  const [tid, pid, titulo, plan, hab, desde, sgl, dbl, tpl, tags] = t;
  const p = _DESC[pid];
  return { id: tid, producto_id: pid, titulo, plan, habitacion: hab, destino: p[3],
    precio_texto: `Desde $${desde} por persona`, precio_desde_usd: desde,
    precios: { sgl, dbl, tpl, base: desde }, moneda: 'USD',
    vigencia_texto: 'Válido hasta el 15 de diciembre', fecha_fin: dia(75), venta_hasta: dia(60), vigente: true,
    origen: 'flyer', incluye_tags: tags, resumen_ia: `${p[2]}: ${plan.toLowerCase()}, ${hab.toLowerCase()}. Precio por persona.`,
    condiciones: ['Precio por persona en base doble', 'Sujeto a disponibilidad'], hot_sale_estado: null,
    score: 70 + tid % 25, tarifario_bloques: [], promocion_fotos: [],
    productos: { id: pid, nombre: p[2], destino: p[3], producto_fotos: _fotos(p[5]) } };
}

const TARIFAS = _TARIFAS.map(_tarifa);
const PRODUCTOS = _PRODUCTOS.map(([pid, tipo, nom, dest, desc, real]) => ({ id: pid, tipo, nombre: nom, destino: dest, descripcion: desc,
  region: dest === 'Punta Cana' ? 'internacional' : 'nacional', activo: true, es_boleteria: false,
  hotel_id: pid === 201 ? 101 : null, tarifa_destacada_id: (TARIFAS.find(t => t.producto_id === pid) ?? { id: null }).id,
  notas: null, requisitos: dest === 'Los Roques' ? 'Cédula o pasaporte vigente' : null,
  tarifas: TARIFAS.filter(t => t.producto_id === pid).map(({ productos, ...resto }) => resto),
  producto_fotos: _fotos(real) }));
const PROMOCIONES = [{ id: 1, titulo: 'Margarita todo incluido — niños gratis', producto_id: 109, promocion_fotos: _fotos(1026),
  productos: { producto_fotos: _fotos(1026) } },
{ id: 2, titulo: 'Los Roques: 3D/2N con vuelo', producto_id: 202, promocion_fotos: _fotos(298),
  productos: { producto_fotos: _fotos(298) } }];

const HABITACIONES = [];
for (let pid = 101; pid < 114; pid++) {
  [['Doble estándar', 24, '2 matrimoniales', 4, 'Jardín'], ['Suite familiar', 38, '1 king + 2 individuales', 5, 'Mar']].forEach(([nom, m2, camas, cap, vista], i) => {
    HABITACIONES.push({ id: pid * 10 + i, producto_id: pid, nombre: nom, nombre_norm: nom.toLowerCase(), metros2: m2, camas,
      capacidad_max: cap, vista, amenities: ['Aire acondicionado', 'TV', 'Wi-Fi'], descripcion: null,
      fuente_url: null, revisado: true, producto_fotos: [] });
  });
}
Object.assign(TABLAS, { producto_habitaciones: HABITACIONES, productos: PRODUCTOS, tarifas: TARIFAS, promociones: PROMOCIONES, vouchers: [], postulaciones_empleo: [],
  tarifario_config: [{ key: 'tabs_ocultas', value: [] }] });

const tablas_para = () => TABLAS;

window.PRUEBA_DATOS = { AHORA, hace, en, dia, iso, ymd, ID_ASESORA, ID_ADMIN, ASESORA, USUARIOS, ASESORES, lead, LEADS, DESTINOS, ID_DESTINO,
  TARIFAS, PRODUCTOS, PROMOCIONES, HABITACIONES, TABLAS, tablas_para };
})();

window.__PRUEBA_RPC_OK = ["actualizar_lead","admin_baja_personal","admin_configurar_whatsapp_restringido","admin_eliminar_reasignacion","admin_guardar_genero_asesor","admin_marcar_asesor_integral","admin_quitar_reparto_destino","anular_documento","anular_gasto","anular_servicio","aprobar_item_tarifario","apto_asignaciones_reserva","asignar_apartamento","asignar_empresa_lead","asignar_lote_prueba","asistente_reserva_empresa","boleteria_guardar_aeropuerto","boleteria_guardar_boleto","boleteria_guardar_tramos","borrar_pasajero","cambiar_estado_tarea","cancelar_solicitud_boleteria","catalogo_hot_sale_ordenar","catalogo_ia_promo_ordenar","cerrar_reserva","comision_regla_guardar","comision_venta_rechazar","conciliar_pago_factura","confirmar_tarifas_sigue","confirmar_venta","contar_lote_prueba","corregir_precio_tarifario","desbloquear_freelancer","disparar_actualizacion_tarifario","eliminar_apto_bloqueo","eliminar_lead","eliminar_mensaje","enviar_mensaje","establecer_porcentaje_comision","estadisticas_asesor","estado_factura_empresa","fijar_fecha_fin_producto","fijar_proxima_accion","guardar_gasto","guardar_servicio","liberar_apartamento","listar_margenes","listar_pagos","lote_diario_guardar","lote_diario_repartir_ahora","mi_push_estado","mi_resumen_jornada","ocultar_vencidos_tarifario","perfiles_voz_eliminar","perfiles_voz_listar","posadas_interesadas","prueba_ia_config_guardar","reanudar_solicitud_boleteria","rechazar_venta","registrar_contacto_lead","registrar_cotizacion_enviada","registrar_documento","reserva_tickets_ia","reservas_de_lead","resolver_solicitud_boleteria","retirar_item_tarifario","retirar_tarifa","retirar_tarifas_por_confirmar","tarifario_juntar_tarifas","verificar_pago","voces_catalogo_eliminar","voces_catalogo_guardar","voces_catalogo_listar","voucher_buscar_lead","voz_preset_override_guardar","voz_presets_eliminar","voz_presets_guardar","voz_presets_listar","voz_redes_historial_eliminar","voz_redes_historial_listar","wa_campana_estado","wa_campana_recalcular"];
