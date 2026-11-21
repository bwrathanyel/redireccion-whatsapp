import { revisarImportacion } from './reservas-importacion-datos.js';
const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
const dato = v => v === '' || v == null ? null : v;
const local = s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?$/.test(s || '') ? s.replace(/(?:Z|[+-]\d{2}:\d{2})$/, '') : null;
const CAMPOS = ['tipo', 'descripcion', 'fecha_inicio', 'fecha_fin', 'hora', 'localizador', 'pax_adultos', 'pax_ninos', 'destino_id', 'estado', 'precio', 'precio_moneda', 'precio_tasa', 'time_limit'];
const DETALLE = { boleto_aereo: ['aerolinea', 'ruta', 'ida_vuelta'], traslado_terrestre: ['origen', 'destino', 'hora_regreso', 'vehiculo'], traslado_maritimo: ['embarcadero', 'embarcacion', 'ida_vuelta'], full_day: ['punto_encuentro', 'incluye', 'no_incluye', 'excursion'], hospedaje: ['hotel', 'habitacion', 'plan', 'noches', 'voucher'], seguro: ['aseguradora', 'cobertura', 'poliza'], otro: ['nota'] };
export function prepararGuardadoImportacion({ datos, base, reservaId, servicio, operacionId, documentos = [], seleccion = {}, precios = {}, aerolineas = [], reemplazarTramos = false }) {
  const revision = revisarImportacion(datos);
  if (!revision.valido) throw new Error([...revision.errores, ...revision.conflictos.map(c => `Conflicto pendiente: ${c.campo}`)].join('\n'));
  if (!datos.servicio.descripcion?.trim()) throw new Error('Completa la descripción del servicio.');
  if (datos.pasajeros.length > 200 || datos.grupos.length > 20) throw new Error('La importación supera el límite de pasajeros o grupos. Divide los documentos.');
  if (datos.grupos.reduce((n, g) => n + g.tramos.length, 0) > 200) throw new Error('El máximo es 200 tramos por operación. Divide los documentos.');
  if (servicio && !servicio.updated_at) throw new Error('Falta la versión original del servicio. Vuelve a abrirlo antes de importar.');
  const grupos = datos.grupos.length ? datos.grupos : [{ clave: 'servicio', tramos: [], boletos: [], aerolinea: '', localizador: '' }];
  const pasajeros = datos.pasajeros.map(p => {
    if (!p.nombre?.trim() || !p.apellido?.trim()) throw new Error(`Completa nombre y apellido de ${p.nombre || 'cada pasajero'}; no se separan automáticamente.`);
    if (p.numero_documento && !p.tipo_documento) throw new Error(`Selecciona el tipo de documento de ${p.nombre}.`);
    return { clave: p.clave, ...(seleccion[p.clave] === 'nuevo' ? { crear_nuevo: true } : seleccion[p.clave] ? { pasajero_id: Number(seleccion[p.clave]) } : {}), nombre: p.nombre, apellido: p.apellido, tipo_documento: dato(p.tipo_documento), numero_documento: dato(p.numero_documento), nacimiento: dato(p.fecha_nacimiento), nacionalidad: dato(p.nacionalidad), categoria: dato(p.categoria) };
  });
  const servicios = grupos.map((g, i) => {
    const principal = {};
    for (const k of CAMPOS) if (base[k] != null) principal[k] = base[k];
    for (const k of ['descripcion', 'fecha_inicio', 'fecha_fin', 'hora', 'localizador', 'pax_adultos', 'pax_ninos']) if (datos.servicio[k] != null) principal[k] = dato(datos.servicio[k]);
    principal.tipo = datos.tipo;
    const detalle = { ...(base.detalle || {}) }; delete detalle.importacion;
    for (const [k, v] of Object.entries(datos.servicio.detalle || {})) if ((DETALLE[datos.tipo] || []).includes(k) && v != null && ['string', 'number', 'boolean'].includes(typeof v)) detalle[k] = v;
    if (g.aerolinea) detalle.aerolinea = g.aerolinea;
    if (g.tramos.length) detalle.ruta = g.tramos.map(t => [t.origen_iata || t.origen_nombre, t.destino_iata || t.destino_nombre].join(' → ')).join(' · ');
    principal.detalle = detalle;
    if (g.localizador) principal.localizador = g.localizador;
    if (i > 0) {
      principal.precio = Number(precios[g.clave] ?? 0);
      principal.estado = 'cotizado';
      delete principal.time_limit; delete principal.destino_id;
      principal.fecha_inicio = local(g.tramos[0]?.sale_en)?.slice(0, 10) || null;
      principal.fecha_fin = local(g.tramos.at(-1)?.llega_en)?.slice(0, 10) || null;
    }
    if (!Number.isFinite(Number(principal.precio || 0)) || Number(principal.precio || 0) < 0) throw new Error(`Grupo ${i + 1}: precio de venta inválido.`);
    const tramos = g.tramos.map((t, j) => {
      if (!/^[A-Z]{3}$/.test(t.origen_iata || '') || !/^[A-Z]{3}$/.test(t.destino_iata || '')) throw new Error(`Grupo ${i + 1}, tramo ${j + 1}: completa ambos códigos IATA.`);
      if (!local(t.sale_en)) throw new Error(`Grupo ${i + 1}, tramo ${j + 1}: completa fecha (con año) y hora de salida. El documento no permite inventarlas.`);
      if (t.llega_en && !local(t.llega_en)) throw new Error(`Grupo ${i + 1}, tramo ${j + 1}: llegada incompleta; complétala o déjala vacía conservando el original en los adjuntos.`);
      const candidatos = aerolineas.filter(a => [a.nombre, a.iata_code].some(n => norm(n) && [norm(t.aerolinea || g.aerolinea), norm(t.codigo_aerolinea)].includes(norm(n))));
      return { origen_iata: t.origen_iata, destino_iata: t.destino_iata, aerolinea_id: candidatos.length === 1 ? candidatos[0].id : null, numero_vuelo: dato(t.numero_vuelo), clase: dato(t.clase), sale_en: local(t.sale_en), llega_en: local(t.llega_en) };
    });
    if (g.boletos.length && !tramos.length) throw new Error(`Grupo ${i + 1}: vincula el itinerario de sus boletos o retira explícitamente los boletos sin relación conocida.`);
    const vistos = new Set();
    for (const b of g.boletos) {
      if (!b.numero_ticket?.trim() || !b.pasajero_clave) throw new Error(`Grupo ${i + 1}: completa número de ticket y pasajero.`);
      if (vistos.has(b.pasajero_clave)) throw new Error(`Grupo ${i + 1}: varios tickets para un pasajero; sepáralos en servicios compatibles.`);
      vistos.add(b.pasajero_clave);
    }
    if (i === 0 && servicio && tramos.length && !reemplazarTramos) throw new Error('Confirma el reemplazo del itinerario del servicio existente.');
    return { clave: g.clave, datos: principal, ...(tramos.length ? { tramos } : {}), pasajeros, boletos: g.boletos, importado: datos };
  });
  const peso = objeto => new TextEncoder().encode(JSON.stringify(objeto, null, 1)).length;
  for (const [i, s] of servicios.entries()) {
    const anterior = i === 0 ? servicio?.detalle?.importacion || {} : {};
    const meta = { ...anterior, version: 1, operacion_id: operacionId, clave: s.clave, importado: { ...(anterior.importado || {}), ...datos }, pasajeros: s.pasajeros, tramos: s.tramos ?? anterior.tramos ?? [], boletos: s.boletos, documentos: [...(anterior.documentos || []), ...documentos.map(d => ({ ...d, documento_id: Number.MAX_SAFE_INTEGER }))] };
    if (peso(meta) > 1048576) throw new Error('La procedencia completa supera 1 MiB por servicio. Divide los documentos.');
  }
  const payload = { operacion_id: operacionId, reserva_id: Number(reservaId), ...(servicio ? { servicio_id: servicio.id, version_servicio: servicio.updated_at } : {}), servicios, documentos };
  if (peso(payload) > 4194304) throw new Error('La operación supera 4 MiB. Divide los documentos; no se ha truncado.');
  return payload;
}
