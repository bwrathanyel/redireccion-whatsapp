import { AEROLINEAS, parsearBoleto, grupoDe } from './boletos-emitidos.js';

const MAX = 1024 * 1024, INICIO = 'LOTUS360_IMPORT_V1:', FIN = ':END_LOTUS360_IMPORT_V1';
const TIPOS = new Set(['boleto_aereo', 'traslado_terrestre', 'traslado_maritimo', 'full_day', 'hospedaje', 'seguro', 'otro']);
const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const vacio = v => v == null || v === '';
const texto = v => typeof v === 'string' || typeof v === 'number' ? String(v).trim().replace(/\s+/g, ' ') : '';
const norm = v => texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const propio = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
const objeto = v => v != null && typeof v === 'object' && !Array.isArray(v);
const unicos = a => [...new Set(a)];
const json = v => JSON.stringify(v);
const llave = v => encodeURIComponent(texto(v));
const seguro = (v, nivel = 0) => {
  if (nivel > 24) return false;
  if (v == null || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(v) && !/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(v);
  if (Array.isArray(v)) return v.length <= 20000 && v.every(x => seguro(x, nivel + 1));
  return objeto(v) && Object.getPrototypeOf(v) === Object.prototype && Object.entries(v).every(([k, x]) => !['__proto__', 'constructor', 'prototype'].includes(k) && seguro(k, nivel + 1) && seguro(x, nivel + 1));
};
const copia = v => seguro(v) ? JSON.parse(json(v)) : null;
const advertir = (d, s) => { if (!d.advertencias.includes(s)) d.advertencias.push(s); };
const base = tipo => ({ version: 1, tipo: tipo || 'otro', servicio: { descripcion: '', fecha_inicio: '', fecha_fin: '', hora: '', localizador: '', detalle: {}, pax_adultos: null, pax_ninos: null }, pasajeros: [], grupos: [], advertencias: [], fuentes: [] });
const aerolinea = t => AEROLINEAS.find(a => [norm(a.id), norm(a.nombre), norm(a.iata)].filter(Boolean).includes(norm(t.aerolinea)))?.nombre || texto(t.aerolinea_nombre || (objeto(t.aerolinea) ? t.aerolinea.nombre : t.aerolinea));
const codigo = t => texto(t.codigo_aerolinea || t.iata).toUpperCase();
const iata = s => /^[A-Z]{3}$/.test(norm(s)) ? norm(s) : '';
const ticket = v => texto(v).replace(/[\s-]/g, '');
const fechaValida = s => {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = +m[1], mes = +m[2], dia = +m[3], bisiesto = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return y >= 1 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
};
const fechaParcialValida = s => {
  if (fechaValida(s) || /^([01]\d|2[0-3]):[0-5]\d(?:\+(?:\d|[12]\d|3[01]))?$/.test(s)) return true;
  const m = s.match(/^(\d{1,2})(JAN|ENE|FEB|MAR|APR|ABR|MAY|JUN|JUL|AUG|AGO|SEP|OCT|NOV|DEC|DIC)(?: ((?:[01]\d|2[0-3]):[0-5]\d))?$/i);
  if (!m) return false;
  const mes = { JAN: 1, ENE: 1, FEB: 2, MAR: 3, APR: 4, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12, DIC: 12 }[m[2].toUpperCase()];
  return fechaValida(`2000-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}`);
};
const fecha = v => {
  const s = texto(v), m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
};
const hora = v => {
  const s = texto(v), m = s.match(/^(\d{1,2}):?(\d{2})(?::00)?$/);
  return m && +m[1] < 24 && +m[2] < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : s;
};
const instante = v => {
  const s = texto(v), m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})(.*)$/);
  return m ? `${m[1]}T${hora(m[2])}${m[3]}` : s;
};
const sumarDia = (f, n) => {
  if (!fechaValida(f) || !Number.isInteger(n) || n < 0 || n > 31) return '';
  const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};
function documento(p) {
  let n = norm(p.numero_documento || p.documento), tipo = texto(p.tipo_documento).toLowerCase();
  const m = n.replace(/[.\s]/g, '').match(/^(?:ID|NI)?([VEJ])(?:CI)?-?(\d+)$/);
  if (m) { n = `${m[1]}-${m[2]}`; tipo ||= 'cedula'; }
  else if (['cedula', 'dni', 'cédula'].includes(tipo)) n = n.replace(/[.\s]/g, '');
  else n = n.replace(/\s/g, '');
  return { tipo_documento: ({ dni: 'cedula', 'cédula': 'cedula', passport: 'pasaporte' })[tipo] || tipo, numero_documento: n };
}
function pasajero(p, indice) {
  const doc = documento(p), cat = norm(p.categoria || p.tipo), categoria = ({ ADT: 'adulto', ADULTO: 'adulto', CHD: 'nino', NIÑO: 'nino', NINO: 'nino', INF: 'infante', INFANTE: 'infante' })[cat] || texto(p.categoria || p.tipo).toLowerCase();
  return { clave: texto(p.clave) || (doc.numero_documento ? `doc:${llave(doc.tipo_documento)}:${llave(p.nacionalidad)}:${llave(doc.numero_documento)}` : `p:${indice + 1}`), nombre: texto(p.nombre || p.nombres), apellido: texto(p.apellido || p.apellidos), ...doc, fecha_nacimiento: fecha(p.fecha_nacimiento), nacionalidad: texto(p.nacionalidad), categoria };
}
function tramo(t, g = {}) {
  let sale = instante(t.sale_en || t.salida), llega = instante(t.llega_en || t.llegada);
  const f = fecha(t.fecha), h = hora(t.sale), l = hora(t.llega);
  if (!sale) sale = f && h ? `${f}${fechaValida(f) ? 'T' : ' '}${h}` : f || h;
  if (!llega && l) {
    // La hora menor no prueba cambio de día: solo se suma un desfase expresado.
    const dia = propio(t, 'llega_dia') ? sumarDia(f, Number(t.llega_dia)) : '';
    llega = dia ? `${dia}T${l}` : `${l}${Number(t.llega_dia) > 0 ? '+' + Number(t.llega_dia) : ''}`;
  }
  const o = t.origen_iata || t.origen, de = t.destino_iata || t.destino;
  return { origen_iata: iata(o), destino_iata: iata(de), aerolinea: aerolinea(t) || texto(g.aerolinea), codigo_aerolinea: codigo(t), numero_vuelo: texto(t.numero_vuelo || t.vuelo), sale_en: sale, llega_en: llega, clase: texto(t.clase), equipaje: texto(t.equipaje), localizador: norm(t.localizador || t.reserva || g.localizador), estado: texto(t.estado), origen_nombre: texto(t.origen_nombre || t.origen_ciudad || (!iata(o) ? o : '')), destino_nombre: texto(t.destino_nombre || t.destino_ciudad || (!iata(de) ? de : '')) };
}
const idRutaVuelo = t => [norm(t.codigo_aerolinea || t.aerolinea), t.numero_vuelo, t.origen_iata || norm(t.origen_nombre), t.destino_iata || norm(t.destino_nombre)].join('|');
const diaTramo = t => t.sale_en.match(/^(\d{4}-\d{2}-\d{2}|\d{1,2}[A-Z]{3})/)?.[1] || '';
const idTramo = t => `${idRutaVuelo(t)}|${diaTramo(t) || t.sale_en}`;
const idGrupo = g => `${norm(g.aerolinea)}|${norm(g.localizador)}`;
const distintos = (a, b, omitir = []) => Object.keys(a).some(k => !omitir.includes(k) && !vacio(a[k]) && !vacio(b[k]) && norm(a[k]) !== norm(b[k]));
const completar = (a, b) => { for (const [k, v] of Object.entries(b)) if (vacio(a[k]) && !vacio(v)) a[k] = v; return a; };
function agregarGrupo(d, g) {
  g.tramos = [...new Map(g.tramos.map(t => [json(t), t])).values()];
  g.boletos = [...new Map(g.boletos.map(b => [json(b), b])).values()];
  const g0 = d.grupos.find(x => {
    if (idGrupo(x) !== idGrupo(g) || (!g.aerolinea && json(x.tramos) !== json(g.tramos)) || (!g.localizador && (!g.tramos.length || json(x.tramos) !== json(g.tramos)))) return false;
    const ticketCompartido = g.boletos.some(b => b.numero_ticket && x.boletos.some(c => c.numero_ticket === b.numero_ticket && c.pasajero_clave === b.pasajero_clave));
    return !x.tramos.some(t => g.tramos.some(u => (idTramo(t) === idTramo(u) && distintos(t, u)) || (ticketCompartido && idRutaVuelo(t) === idRutaVuelo(u) && diaTramo(t) && diaTramo(u) && diaTramo(t) !== diaTramo(u))));
  });
  if (g0) {
    for (const t of g.tramos) { const t0 = g0.tramos.find(x => idTramo(x) === idTramo(t)); if (t0) completar(t0, t); else g0.tramos.push(t); }
    for (const b of g.boletos) if (!g0.boletos.some(x => x.pasajero_clave === b.pasajero_clave && x.numero_ticket === b.numero_ticket)) g0.boletos.push(b);
    return g0;
  }
  if (d.grupos.some(x => idGrupo(x) === idGrupo(g))) advertir(d, `${g.aerolinea && g.localizador ? 'Conflicto de itinerario' : 'Identidad de grupo insuficiente'}: ${g.aerolinea || 'aerolínea ausente'} / ${g.localizador || 'sin localizador'}; grupos conservados por separado.`);
  let clave = g.clave || `g:${llave(g.aerolinea)}:${llave(g.localizador)}`;
  while (d.grupos.some(x => x.clave === clave)) clave += ':2';
  const nuevo = { ...g, clave }; d.grupos.push(nuevo); return nuevo;
}
function derivar(d) {
  const ts = d.grupos.flatMap(g => g.tramos), fechas = ts.map(t => t.sale_en.slice(0, 10)).filter(fechaValida).sort();
  const finales = ts.flatMap(t => [t.sale_en.slice(0, 10), t.llega_en.slice(0, 10)]).filter(fechaValida).sort();
  const loc = unicos(d.grupos.map(g => g.localizador).filter(Boolean));
  if (!d.servicio.fecha_inicio && fechas.length) d.servicio.fecha_inicio = fechas[0];
  if (!d.servicio.fecha_fin && finales.length) d.servicio.fecha_fin = finales[finales.length - 1];
  if (!d.servicio.hora && fechas.length) d.servicio.hora = ts.find(t => t.sale_en.startsWith(d.servicio.fecha_inicio + 'T'))?.sale_en.slice(11, 16) || '';
  if (!d.servicio.localizador && loc.length === 1) d.servicio.localizador = loc[0];
  return d;
}

export function normalizarImportacion(datos, { tipo, fuente } = {}) {
  const entrada = copia(datos);
  const d = base(tipo || entrada?.tipo);
  if (!objeto(entrada)) { advertir(d, 'Entrada inválida o con caracteres no permitidos.'); return d; }
  if (!entrada.grupos && Array.isArray(entrada.tramos) && Array.isArray(entrada.pasajeros)) {
    const convertido = desdeBoletosEmitidos(entrada); convertido.tipo = tipo || convertido.tipo;
    if (fuente != null && seguro(fuente)) convertido.fuentes.push(copia(fuente));
    return convertido;
  }
  if (objeto(entrada.servicio)) {
    d.servicio = { ...d.servicio, ...entrada.servicio };
    for (const k of ['descripcion', 'localizador']) d.servicio[k] = texto(d.servicio[k]);
    for (const k of ['fecha_inicio', 'fecha_fin']) d.servicio[k] = fecha(d.servicio[k]);
    d.servicio.hora = hora(d.servicio.hora);
    d.servicio.detalle = objeto(d.servicio.detalle) ? d.servicio.detalle : {};
    for (const k of ['pax_adultos', 'pax_ninos']) if (typeof d.servicio[k] === 'string' && /^\d+$/.test(d.servicio[k].trim())) d.servicio[k] = Number(d.servicio[k]);
  }
  d.advertencias = (Array.isArray(entrada.advertencias) ? entrada.advertencias : []).filter(x => typeof x === 'string').map(texto);
  d.fuentes = Array.isArray(entrada.fuentes) ? entrada.fuentes : [];
  if (fuente != null && seguro(fuente)) d.fuentes.push(copia(fuente));
  const claves = new Set();
  for (const [i, p] of (Array.isArray(entrada.pasajeros) ? entrada.pasajeros : []).entries()) {
    if (!objeto(p)) { advertir(d, `Pasajero ${i + 1}: estructura inválida.`); continue; }
    const n = pasajero(p, i);
    if (claves.has(n.clave)) { advertir(d, `Conflicto de clave de pasajero repetida: ${n.clave}; revisar relaciones.`); while (claves.has(n.clave)) n.clave += ':2'; }
    claves.add(n.clave); d.pasajeros.push(n);
  }
  for (const [i, g] of (Array.isArray(entrada.grupos) ? entrada.grupos : []).entries()) {
    if (!objeto(g)) continue;
    const nuevo = { clave: texto(g.clave), aerolinea: aerolinea(g), localizador: norm(g.localizador || g.reserva), tramos: [], boletos: [] };
    nuevo.tramos = (Array.isArray(g.tramos) ? g.tramos : []).filter(objeto).map(t => tramo(t, nuevo));
    if (!nuevo.aerolinea) nuevo.aerolinea = nuevo.tramos.find(t => t.aerolinea)?.aerolinea || '';
    if (!nuevo.localizador) { const ls = unicos(nuevo.tramos.map(t => t.localizador).filter(Boolean)); if (ls.length === 1) nuevo.localizador = ls[0]; }
    nuevo.boletos = (Array.isArray(g.boletos) ? g.boletos : []).filter(objeto).map(b => ({ pasajero_clave: texto(b.pasajero_clave), numero_ticket: ticket(b.numero_ticket || b.boleto) }));
    if (!nuevo.aerolinea && !nuevo.localizador) nuevo.clave ||= `grupo:${i + 1}`;
    const partes = new Map();
    for (const t of nuevo.tramos) {
      const k = `${norm(t.aerolinea)}|${t.localizador}`;
      if (!partes.has(k)) partes.set(k, { clave: '', aerolinea: t.aerolinea, localizador: t.localizador, tramos: [], boletos: [] });
      partes.get(k).tramos.push(t);
    }
    if (partes.size <= 1) agregarGrupo(d, nuevo);
    else {
      const vinculado = partes.get(idGrupo(nuevo));
      if (vinculado) vinculado.boletos = nuevo.boletos;
      else if (nuevo.boletos.length) agregarGrupo(d, { ...nuevo, clave: `${nuevo.clave || `grupo:${i + 1}`}:sin-itinerario`, tramos: [] });
      for (const g2 of partes.values()) agregarGrupo(d, g2);
      advertir(d, `Grupo ${i + 1}: varios localizadores/aerolíneas; solo se vincularon boletos con evidencia explícita.`);
    }
  }
  return derivar(d);
}

export function desdeBoletosEmitidos(datos) {
  const entrada = copia(objeto(datos?.datos) ? datos.datos : datos), d = base('boleto_aereo');
  if (!objeto(entrada)) { advertir(d, 'Datos de Boletos emitidos inválidos.'); return d; }
  const personas = (Array.isArray(entrada.pasajeros) ? entrada.pasajeros : []).filter(objeto);
  d.pasajeros = personas.map(pasajero);
  const claves = new Set();
  for (const p of d.pasajeros) { while (claves.has(p.clave)) p.clave += ':2'; claves.add(p.clave); }
  const grupos = new Map();
  for (const t of (Array.isArray(entrada.tramos) ? entrada.tramos : []).filter(objeto)) {
    const k = grupoDe(t);
    if (!grupos.has(k)) grupos.set(k, { clave: k, aerolinea: aerolinea(t), localizador: norm(t.reserva), tramos: [], boletos: [] });
    grupos.get(k).tramos.push(tramo(t));
  }
  personas.forEach((p, i) => {
    if (!d.pasajeros[i]) return;
    if (p.boletos != null && !objeto(p.boletos)) advertir(d, `Pasajero ${i + 1}: mapa de boletos inválido; requiere revisión.`);
    for (const [k, valor] of Object.entries(objeto(p.boletos) ? p.boletos : {})) {
      const vs = Array.isArray(valor) ? valor : [valor];
      if (!grupos.has(k)) { const [a, r] = k.split('|'); grupos.set(k, { clave: k, aerolinea: aerolinea({ aerolinea: a.replace(/^otra:/, '') }), localizador: norm(r), tramos: [], boletos: [] }); advertir(d, `Boleto sin itinerario coincidente: ${k}.`); }
      for (const v of vs) if (ticket(v)) grupos.get(k).boletos.push({ pasajero_clave: d.pasajeros[i].clave, numero_ticket: ticket(v) });
    }
  });
  for (const g of grupos.values()) agregarGrupo(d, g);
  if (entrada.notas) d.servicio.detalle.notas = texto(entrada.notas);
  if (objeto(entrada.emision) && Object.keys(entrada.emision).length) d.servicio.detalle.emision = entrada.emision;
  if (objeto(entrada.emisoras) && Object.keys(entrada.emisoras).length) d.servicio.detalle.emisoras = entrada.emisoras;
  d.fuentes.push({ tipo: 'boletos_emitidos' });
  return derivar(d);
}

export function combinarImportaciones(lista) {
  const entradas = (Array.isArray(lista) ? lista : []).filter(Boolean).map(x => normalizarImportacion(x));
  // El mismo contenido completo sí es evidencia de reimportación, incluso sin DNI/ticket.
  const ds = [...new Map(entradas.map(x => [json(x), x])).values()], d = base(ds[0]?.tipo);
  const conflictos = [];
  for (const [indice, x] of ds.entries()) {
    if (x.tipo !== d.tipo) advertir(d, `Conflicto de tipo de servicio: ${d.tipo} / ${x.tipo}.`);
    d.advertencias.push(...x.advertencias); d.fuentes.push(...x.fuentes);
    const ts = x.grupos.flatMap(g => g.tramos), fs = ts.map(t => t.sale_en.slice(0, 10)).filter(fechaValida).sort();
    const fsFin = ts.flatMap(t => [t.sale_en.slice(0, 10), t.llega_en.slice(0, 10)]).filter(fechaValida).sort();
    for (const [k, v] of Object.entries(x.servicio)) {
      if (vacio(v) || (objeto(v) && !Object.keys(v).length)) continue;
      if (k === 'detalle') { for (const [c, valor] of Object.entries(v)) { if (!propio(d.servicio.detalle, c)) d.servicio.detalle[c] = valor; else if (json(d.servicio.detalle[c]) !== json(valor)) conflictos.push({ campo: `servicio.detalle.${c}`, valores: [d.servicio.detalle[c], valor] }); } continue; }
      if (['fecha_inicio', 'fecha_fin', 'hora', 'localizador'].includes(k) && ts.length) {
        if ((k === 'fecha_inicio' && v === fs[0]) || (k === 'fecha_fin' && v === fsFin[fsFin.length - 1]) || (k === 'localizador' && x.grupos.some(g => g.localizador === v)) || (k === 'hora' && ts.some(t => t.sale_en.slice(11, 16) === v))) continue;
      }
      if (vacio(d.servicio[k])) d.servicio[k] = v;
      else if (json(d.servicio[k]) !== json(v)) conflictos.push({ campo: `servicio.${k}`, valores: [d.servicio[k], v] });
    }
    const remap = new Map();
    for (const p of x.pasajeros) {
      const tickets = x.grupos.flatMap(g => g.boletos.filter(b => b.pasajero_clave === p.clave).map(b => b.numero_ticket)).filter(Boolean);
      const candidatos = d.pasajeros.filter(q => {
        const doc = p.numero_documento && q.numero_documento && p.numero_documento === q.numero_documento && (!p.tipo_documento || !q.tipo_documento || p.tipo_documento === q.tipo_documento) && (!p.nacionalidad || !q.nacionalidad || norm(p.nacionalidad) === norm(q.nacionalidad));
        const bol = tickets.length && d.grupos.some(g => g.boletos.some(b => b.pasajero_clave === q.clave && tickets.includes(b.numero_ticket)));
        return doc || bol;
      });
      let q = candidatos.length === 1 ? candidatos[0] : null;
      if (q && distintos(q, p, ['clave', 'nombre', 'apellido'])) {
        conflictos.push({ campo: `pasajeros.${q.clave}`, valores: [copia(q), copia(p)] }); q = null;
      }
      if (q) {
        for (const k of ['nombre', 'apellido']) if (p[k] && q[k] && norm(p[k]) !== norm(q[k])) conflictos.push({ campo: `pasajeros.${q.clave}.${k}`, valores: [q[k], p[k]] });
        completar(q, p);
      } else {
        if (d.pasajeros.some(o => norm(`${o.nombre} ${o.apellido}`) === norm(`${p.nombre} ${p.apellido}`))) advertir(d, 'Pasajeros con nombre coincidente sin identidad fuerte compatible: se conservaron separados.');
        let clave = p.clave; while (d.pasajeros.some(o => o.clave === clave)) clave += `:${indice + 1}`;
        q = { ...p, clave }; d.pasajeros.push(q);
      }
      remap.set(p.clave, q.clave);
    }
    for (const g of x.grupos) agregarGrupo(d, { ...g, boletos: g.boletos.map(b => ({ ...b, pasajero_clave: remap.get(b.pasajero_clave) || b.pasajero_clave })) });
  }
  if (conflictos.length) {
    d.servicio.detalle.conflictos_importacion = [...(Array.isArray(d.servicio.detalle.conflictos_importacion) ? d.servicio.detalle.conflictos_importacion : []), ...conflictos];
    conflictos.forEach(c => advertir(d, `Conflicto en ${c.campo}: requiere revisión; no se reemplazó el valor anterior.`));
  }
  d.advertencias = unicos(d.advertencias); d.fuentes = [...new Map(d.fuentes.map(f => [json(f), f])).values()];
  return derivar(d);
}

export function revisarImportacion(datos) {
  const errores = [], advertencias = [], conflictos = [];
  if (!objeto(datos) || !seguro(datos)) return { valido: false, errores: ['Estructura o caracteres inválidos.'], advertencias, conflictos };
  const d = datos;
  if (d.version !== 1) errores.push('Versión de importación no admitida.');
  if (!TIPOS.has(d.tipo)) errores.push('Tipo de servicio inválido.');
  for (const k of ['pasajeros', 'grupos', 'advertencias', 'fuentes']) if (!Array.isArray(d[k])) errores.push(`${k}: debe ser una lista.`);
  if (!objeto(d.servicio)) errores.push('servicio: debe ser un objeto.');
  if (errores.length) return { valido: false, errores, advertencias, conflictos };
  if (!d.advertencias.every(x => typeof x === 'string')) errores.push('advertencias: cada entrada debe ser texto.');
  if (!d.fuentes.every(x => typeof x === 'string' || objeto(x))) errores.push('fuentes: cada entrada debe ser texto u objeto.');
  advertencias.push(...d.advertencias.filter(x => typeof x === 'string'));
  for (const k of ['descripcion', 'fecha_inicio', 'fecha_fin', 'hora', 'localizador']) if (typeof d.servicio[k] !== 'string') errores.push(`servicio.${k}: debe ser texto.`);
  if (!objeto(d.servicio.detalle)) errores.push('servicio.detalle: debe ser un objeto.');
  for (const k of ['fecha_inicio', 'fecha_fin']) if (d.servicio[k] && !fechaValida(d.servicio[k])) errores.push(`servicio.${k}: fecha incompleta o inválida.`);
  if (fechaValida(d.servicio.fecha_inicio) && fechaValida(d.servicio.fecha_fin) && d.servicio.fecha_fin < d.servicio.fecha_inicio) errores.push('La fecha final del servicio precede a la inicial.');
  if (d.servicio.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.servicio.hora)) errores.push('Hora del servicio inválida.');
  for (const k of ['pax_adultos', 'pax_ninos']) if (!vacio(d.servicio[k]) && (!Number.isInteger(d.servicio[k]) || d.servicio[k] < 0 || d.servicio[k] > 9999)) errores.push(`${k}: cantidad inválida.`);
  const claves = new Set(), docs = new Map();
  for (const [i, p] of d.pasajeros.entries()) {
    if (!objeto(p) || !texto(p.clave)) { errores.push(`Pasajero ${i + 1}: falta clave.`); continue; }
    if (claves.has(p.clave)) errores.push(`Clave de pasajero duplicada: ${p.clave}.`); claves.add(p.clave);
    for (const [k, v] of Object.entries(p)) if (typeof v !== 'string') errores.push(`Pasajero ${i + 1}: ${k} debe ser texto.`);
    if (!p.nombre || !p.apellido) advertencias.push(`Pasajero ${i + 1}: revisar nombre y apellido.`);
    if (!p.numero_documento) advertencias.push(`Pasajero ${i + 1}: documento ausente.`);
    if (p.fecha_nacimiento && !fechaValida(p.fecha_nacimiento)) errores.push(`Pasajero ${i + 1}: fecha de nacimiento inválida.`);
    if (p.numero_documento) {
      const k = `${p.tipo_documento}|${norm(p.nacionalidad)}|${p.numero_documento}`;
      if (docs.has(k)) {
        const anterior = docs.get(k), q = d.pasajeros[anterior];
        advertencias.push(`Documento repetido entre pasajeros ${anterior + 1} y ${i + 1}: revisar identidad.`);
        if (distintos(q, p, ['clave'])) conflictos.push({ campo: `pasajeros.${p.clave}.documento`, valores: [copia(q), copia(p)] });
      } else docs.set(k, i);
    }
  }
  const gs = new Set(), tickets = new Map();
  for (const [i, g] of d.grupos.entries()) {
    if (!objeto(g) || !Array.isArray(g.tramos) || !Array.isArray(g.boletos)) { errores.push(`Grupo ${i + 1}: estructura inválida.`); continue; }
    for (const k of ['clave', 'aerolinea', 'localizador']) if (typeof g[k] !== 'string') errores.push(`Grupo ${i + 1}: ${k} debe ser texto.`);
    if (!g.clave || gs.has(g.clave)) errores.push(`Grupo ${i + 1}: clave ausente o duplicada.`); gs.add(g.clave);
    if (!g.aerolinea || !g.localizador) advertencias.push(`Grupo ${i + 1}: falta aerolínea o localizador explícito.`);
    if (!g.tramos.length) advertencias.push(`Grupo ${i + 1}: sin tramos; no asignar un itinerario por defecto.`);
    for (const [j, t] of g.tramos.entries()) {
      if (!objeto(t)) { errores.push(`Grupo ${i + 1}, tramo ${j + 1}: estructura inválida.`); continue; }
      const lugar = `Grupo ${i + 1}, tramo ${j + 1}`;
      if (g.aerolinea && t.aerolinea && norm(aerolinea(g)) !== norm(aerolinea(t))) errores.push(`${lugar}: aerolínea incompatible con el grupo.`);
      if (g.localizador && t.localizador && norm(g.localizador) !== norm(t.localizador)) errores.push(`${lugar}: localizador incompatible con el grupo.`);
      for (const [k, v] of Object.entries(t)) if (typeof v !== 'string') errores.push(`${lugar}: ${k} debe ser texto.`);
      for (const k of ['origen_iata', 'destino_iata']) if (t[k] && !/^[A-Z]{3}$/.test(t[k])) errores.push(`${lugar}: IATA inválido.`);
      if (!t.origen_iata && !t.origen_nombre || !t.destino_iata && !t.destino_nombre) advertencias.push(`${lugar}: ruta incompleta.`);
      for (const k of ['sale_en', 'llega_en']) {
        const s = texto(t[k]), m = s.match(/^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))?$/);
        if (!s) advertencias.push(`${lugar}: ${k} ausente.`);
        else if (!m || !fechaValida(m[1])) {
          const parcial = fechaParcialValida(s);
          if (!parcial) errores.push(`${lugar}: ${k} tiene fecha/hora inválida.`);
          else advertencias.push(`${lugar}: ${k} no tiene fecha/hora completa; conservar original y revisar.`);
        }
        if (m && !/(Z|[+-]\d{2}:\d{2})$/.test(s)) advertencias.push(`${lugar}: ${k} es hora local sin zona explícita.`);
      }
      if (t.sale_en && t.llega_en && /^\d{4}-/.test(t.sale_en) && /^\d{4}-/.test(t.llega_en) && !/(Z|[+-]\d{2}:\d{2})$/.test(t.sale_en + t.llega_en) && t.llega_en < t.sale_en) advertencias.push(`${lugar}: llegada local anterior a salida; revisar cambio de día/zona, sin inferirlo.`);
    }
    for (const b of g.boletos) {
      if (!objeto(b) || typeof b.pasajero_clave !== 'string' || typeof b.numero_ticket !== 'string') { errores.push(`Grupo ${i + 1}: boleto inválido.`); continue; }
      if (!claves.has(b.pasajero_clave)) errores.push(`Grupo ${i + 1}: boleto referencia un pasajero inexistente.`);
      if (!/^\d{13}$/.test(b.numero_ticket)) advertencias.push(`Grupo ${i + 1}: número de ticket incompleto o no estándar.`);
      if (b.numero_ticket) { if (tickets.has(b.numero_ticket) && tickets.get(b.numero_ticket) !== b.pasajero_clave) { errores.push('Un mismo ticket está vinculado a pasajeros distintos.'); conflictos.push({ campo: 'numero_ticket', valores: [b.numero_ticket] }); } else tickets.set(b.numero_ticket, b.pasajero_clave); }
    }
  }
  if (Array.isArray(d.servicio.detalle?.conflictos_importacion)) conflictos.push(...d.servicio.detalle.conflictos_importacion);
  if (d.advertencias.some(a => typeof a === 'string' && a.startsWith('Conflicto'))) conflictos.push(...d.advertencias.filter(a => typeof a === 'string' && a.startsWith('Conflicto')).map(a => ({ campo: 'importacion', valores: [a] })));
  return { valido: !errores.length && !conflictos.length, errores: unicos(errores), advertencias: unicos(advertencias), conflictos };
}

function schemaMetadatos(d) {
  if (!objeto(d) || Object.keys(d).some(k => !['version', 'tipo', 'servicio', 'pasajeros', 'grupos', 'advertencias', 'fuentes'].includes(k))) return false;
  if (!objeto(d.servicio) || !objeto(d.servicio.detalle) || !Array.isArray(d.pasajeros) || !Array.isArray(d.grupos) || !Array.isArray(d.advertencias) || !Array.isArray(d.fuentes)) return false;
  if (!d.advertencias.every(x => typeof x === 'string')) return false;
  for (const k of ['descripcion', 'fecha_inicio', 'fecha_fin', 'hora', 'localizador']) if (typeof d.servicio[k] !== 'string') return false;
  const ps = ['clave', 'nombre', 'apellido', 'tipo_documento', 'numero_documento', 'fecha_nacimiento', 'nacionalidad', 'categoria'];
  const ts = ['origen_iata', 'destino_iata', 'aerolinea', 'codigo_aerolinea', 'numero_vuelo', 'sale_en', 'llega_en', 'clase', 'equipaje', 'localizador', 'estado', 'origen_nombre', 'destino_nombre'];
  if (!d.pasajeros.every(p => objeto(p) && ps.every(k => typeof p[k] === 'string') && Object.keys(p).every(k => ps.includes(k)))) return false;
  if (!d.grupos.every(g => objeto(g) && ['clave', 'aerolinea', 'localizador'].every(k => typeof g[k] === 'string') && Object.keys(g).every(k => ['clave', 'aerolinea', 'localizador', 'tramos', 'boletos'].includes(k)) && Array.isArray(g.tramos) && g.tramos.every(t => objeto(t) && ts.every(k => typeof t[k] === 'string') && Object.keys(t).every(k => ts.includes(k))) && Array.isArray(g.boletos) && g.boletos.every(b => objeto(b) && typeof b.pasajero_clave === 'string' && typeof b.numero_ticket === 'string' && Object.keys(b).every(k => ['pasajero_clave', 'numero_ticket'].includes(k))))) return false;
  const r = revisarImportacion(d);
  return !r.errores.length;
}
export function codificarMetadatos(datos) {
  const entrada = objeto(datos?.datos) ? datos.datos : datos;
  if (!objeto(entrada) || !Array.isArray(entrada.pasajeros) || !Array.isArray(entrada.grupos || entrada.tramos) || (propio(entrada, 'version') && entrada.version !== 1)) throw new TypeError('Metadatos de importación inválidos.');
  const d = normalizarImportacion(entrada, { tipo: entrada.tipo || 'boleto_aereo' });
  if (!seguro(entrada) || !schemaMetadatos(d)) throw new TypeError('Metadatos de importación inválidos.');
  const bytes = new TextEncoder().encode(json(d));
  if (bytes.length > MAX) throw new RangeError('Metadatos de importación exceden 1 MiB.');
  let binario = ''; for (let i = 0; i < bytes.length; i += 8192) binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `${INICIO}${btoa(binario)}${FIN}`;
}
export function leerMetadatos(textoPdf) {
  if (typeof textoPdf !== 'string' || textoPdf.length > MAX * 8) return null;
  const continuo = textoPdf.replace(/[\r\n\t ]/g, '');
  const inicio = continuo.indexOf(INICIO); if (inicio < 0) return null;
  const fin = continuo.indexOf(FIN, inicio + INICIO.length);
  if (fin < 0) return null;
  const cod = continuo.slice(inicio + INICIO.length, fin);
  for (let siguiente = continuo.indexOf(INICIO, fin + FIN.length); siguiente >= 0; siguiente = continuo.indexOf(INICIO, siguiente + INICIO.length)) {
    const limite = continuo.indexOf(FIN, siguiente + INICIO.length);
    if (limite < 0 || continuo.slice(siguiente + INICIO.length, limite) !== cod) return null;
  }
  if (!cod || cod.length > Math.ceil(MAX / 3) * 4 + 2048 || /[^A-Za-z0-9+/=\r\n\t ]/.test(cod)) return null;
  const compacto = cod.replace(/\s/g, '');
  if (compacto.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compacto)) return null;
  try {
    const binario = atob(compacto); if (binario.length > MAX || btoa(binario) !== compacto) return null;
    const bytes = Uint8Array.from(binario, c => c.charCodeAt(0)), s = new TextDecoder('utf-8', { fatal: true }).decode(bytes), d = JSON.parse(s);
    return seguro(d) && schemaMetadatos(d) ? d : null;
  } catch (_e) { return null; }
}

function fechaImprimida(s) {
  const m = norm(s).match(/(?:LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO),?\s+(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})/);
  if (!m) return '';
  return `${m[3]}-${String(MESES[m[2].toLowerCase()] || 0).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
const sinPie = s => !/^(?:Destino y Eventos Lotus 360|Página \d+ de \d+)/i.test(s);
function tarjeta(lineas, d) {
  const f = lineas.map(fechaImprimida).find(Boolean) || '', todo = lineas.join('\n');
  const vuelo = todo.match(/Vuelo\s+(?:([A-Z0-9]{2})\s+)?(\d{1,4})\b/i);
  const a = AEROLINEAS.find(a => a.iata && a.iata === vuelo?.[1]) || AEROLINEAS.find(a => norm(todo).includes(norm(a.nombre)));
  let cia = a?.nombre || '';
  if (!cia) cia = texto(lineas.find(l => /\b(?:Airlines?|Airways|Aerol[ií]nea|Air|A[eé]reo)\b/i.test(l) && !fechaImprimida(l) && !/C[ÓO]DIGO DE RESERVA|\d{1,2}:\d{2}|EQUIPAJE|ESTADO|Vuelo|clase/i.test(l)));
  cia ||= vuelo?.[1] || '';
  const horas = [...todo.matchAll(/(?:^|\s)([0-2]\d:[0-5]\d)(?=\s|$)/g)].map(m => m[1]);
  const lineaIata = lineas.find(l => /^([A-Z]{3})\s+([A-Z]{3})$/.test(l));
  const codes = lineaIata?.split(/\s+/) || [];
  const locIdx = lineas.findIndex(l => /C[ÓO]DIGO DE RESERVA/i.test(l));
  const locLinea = locIdx >= 0 ? lineas[locIdx + 1] || '' : '';
  const loc = [...locLinea.matchAll(/\b[A-Z0-9]{5,8}\b/g)].map(m => m[0]).filter(s => !['AIRLINES', 'AIRLINE', 'RUTACA', 'CONVIASA', 'TURPIAL', 'ESTELAR'].includes(s)).pop() || '';
  const equipaje = todo.match(/Equipaje facturado:\s*\d+\s*kg|\d+ maletas? facturadas?|Sin equipaje facturado|Seg[úu]n la tarifa|\b\d+(?:KG|PC|K|P)\b/i)?.[0] || '';
  const estado = todo.match(/En lista de espera|Sujeto a espacio|Confirmado|POR CONFIRMAR/i)?.[0] || '';
  const clase = todo.match(/\(clase\s+([A-Z])\)/i)?.[1] || '';
  const nombreLinea = lineaIata ? lineas[lineas.indexOf(lineaIata) + 2] || '' : '';
  const t = tramo({ origen_iata: codes[0], destino_iata: codes[1], aerolinea: cia, codigo_aerolinea: vuelo?.[1] || '', numero_vuelo: vuelo?.[2] || '', sale_en: horas[0] ? f ? `${f}T${horas[0]}` : horas[0] : '', llega_en: horas[1] ? /\+1\b/.test(todo) && f ? `${sumarDia(f, 1)}T${horas[1]}` : horas[1] : '', clase, equipaje, estado, localizador: loc });
  // Sin separadores de columnas no se parte una ciudad compuesta en dos nombres.
  if (nombreLinea && !codes.length) advertir(d, 'Tarjeta sin IATA: revisar nombres de origen y destino en el documento.');
  if (!vuelo || !f || codes.length !== 2 || !cia) {
    advertir(d, 'Tarjeta de itinerario incompleta: revisar campos no recuperables del texto.');
    (d.servicio.detalle.tarjetas_texto_incompletas ||= []).push(lineas);
  }
  agregarGrupo(d, { clave: '', aerolinea: cia, localizador: loc, tramos: [t], boletos: [] });
}

export function parsearPdfLotus(paginas) {
  if (!Array.isArray(paginas) || !paginas.length) return null;
  const ps = paginas.filter(objeto).map((p, i) => ({ numero: p.numero || i + 1, lineas: (Array.isArray(p.lineas) && p.lineas.length ? p.lineas : typeof p.texto === 'string' ? p.texto.split(/\r?\n/) : []).filter(s => typeof s === 'string').map(s => s.trim()).filter(Boolean), texto: typeof p.texto === 'string' ? p.texto : '' }));
  const completo = ps.map(p => [...p.lineas, p.texto].join('\n')).join('\n'), meta = leerMetadatos(completo);
  if (meta) return meta;
  if (!/BOLETO ELECTR[ÓO]NICO/i.test(completo) || !/Destino y Eventos Lotus\s*360/i.test(completo) || !/SU ITINERARIO/i.test(completo)) return null;
  const d = base('boleto_aereo'), ls = ps.flatMap(p => p.lineas.filter(sinPie));
  d.fuentes = ps.map(p => ({ tipo: 'pdf_lotus_texto', pagina: p.numero }));
  if (completo.includes(INICIO)) advertir(d, 'Metadatos embebidos inválidos: se intentó recuperar el texto visible.');
  const inicio = ls.findIndex(l => /SU ITINERARIO/i.test(l)), fin = ls.findIndex((l, i) => i > inicio && /^PASAJEROS\b/i.test(l));
  const itinerario = ls.slice(inicio + 1, fin < 0 ? undefined : fin);
  let inicios = itinerario.map((l, i) => /C[ÓO]DIGO DE RESERVA/i.test(l) ? i : -1).filter(i => i >= 0);
  if (!inicios.length) inicios = itinerario.map((l, i) => fechaImprimida(l) ? i : -1).filter(i => i >= 0);
  inicios.forEach((i, k) => tarjeta(itinerario.slice(i, inicios[k + 1] ?? itinerario.length), d));
  if (!inicios.length) advertir(d, 'No se pudieron reconocer tarjetas completas de itinerario.');
  if (fin >= 0) {
    const hasta = ls.findIndex((l, i) => i > fin && /^(ANTES DE VOLAR|DATOS DE EMISI[ÓO]N)/i.test(l));
    const tabla = ls.slice(fin + 1, hasta < 0 ? undefined : hasta), filas = [], gruposItinerario = [...d.grupos];
    for (const l of tabla) {
      if (/^\d{1,3}\s+\S/.test(l)) filas.push(l);
      else if (filas.length && !/^(#|Pasajero|Documento|Boleto|Passengers)/i.test(l)) filas[filas.length - 1] += ' ' + l;
    }
    for (const [i, fila] of filas.entries()) {
      const sinNumero = fila.replace(/^\d+\s+/, ''), tokens = [...sinNumero.matchAll(/\b\d{3}[- ]?\d{10}\b|[—–]/g)];
      let cabeza = tokens.length ? sinNumero.slice(0, tokens[0].index).trim() : sinNumero;
      const doc = cabeza.match(/(?:\b[VEJ][- ]?[\d.]{5,}|\b(?:PP|ID|NI)[A-Z0-9-]+|\b[A-Z]{1,4}-?\d{4,}|\b\d[\d.]{3,20})$/i)?.[0] || '';
      if (doc) cabeza = cabeza.slice(0, cabeza.length - doc.length).trim();
      let columnas = tokens.map(t => /^\d/.test(t[0]) ? ticket(t[0]) : '');
      // El guion de documento ocupa una celda propia antes de las columnas de boletos.
      if (!doc && columnas.length === gruposItinerario.length + 1 && columnas[0] === '') columnas = columnas.slice(1);
      const categoria = cabeza.match(/\((Niño|Infante|CHD|INF)\)/i)?.[1] || '';
      cabeza = cabeza.replace(/\s*\((Niño|Infante|CHD|INF)\)/i, '').trim();
      const p = pasajero({ nombre: cabeza, documento: doc, categoria }, i); d.pasajeros.push(p);
      if (columnas.length === gruposItinerario.length) columnas.forEach((b, j) => { if (b) gruposItinerario[j].boletos.push({ pasajero_clave: p.clave, numero_ticket: b }); });
      else {
        advertir(d, `Pasajero ${i + 1}: columnas de boletos ambiguas; no se asignaron a un itinerario.`);
        const boletos = columnas.filter(Boolean).map(numero_ticket => ({ pasajero_clave: p.clave, numero_ticket }));
        if (boletos.length) d.grupos.push({ clave: `sin-itinerario:${i + 1}`, aerolinea: '', localizador: '', tramos: [], boletos });
      }
    }
    if (d.pasajeros.length) advertir(d, 'PDF antiguo: nombre completo conservado en nombre; revisar apellido por separado, no puede deducirse sin ambigüedad.');
  }
  return derivar(d);
}

// El formato KIU no imprime el año de cada vuelo. Se reutiliza su lector, no el año inferido ni unirBoletos (que admite un solo ticket por grupo).
export function parsearConsolidador(paginas) {
  const lista = [], recibos = [];
  let actual = null;
  for (const [i, p] of (Array.isArray(paginas) ? paginas : []).entries()) {
    const ls = (Array.isArray(p) ? p : p?.lineas)?.filter(l => typeof l === 'string');
    if (!ls?.length) continue;
    const fragmentos = [];
    for (const l of ls) { if (/^ELECTRONIC TICKET$/i.test(l.trim()) || !fragmentos.length) fragmentos.push([]); fragmentos.at(-1).push(l); }
    for (const lineas of fragmentos) {
      const txt = lineas.join('\n'), bol = txt.match(/TICKET (?:NUMBER[^:\n]*|N(?:BR|RO)\.?):\s*(\d{3})-?(\d{10})/i)?.slice(1).join('') || '';
      const nombre = lineas.find(l => /NAME(?:\/NOMBRE)?:/i.test(l)) || '';
      if (!actual || (bol && actual.boleto && bol !== actual.boleto) || (nombre && actual.nombre && norm(nombre) !== norm(actual.nombre))) {
        actual = { lineas: [], paginas: [], boleto: bol, nombre }; recibos.push(actual);
      }
      actual.boleto ||= bol; actual.nombre ||= nombre; actual.lineas.push(...lineas); actual.paginas.push(p.numero || i + 1);
    }
  }
  for (const recibo of recibos) {
    const ls = recibo.lineas, r = parsearBoleto(ls); if (!r) continue;
    const crudos = ls.map(norm).filter(l => /^.+? [A-Z0-9]{2} ?\d{1,4} [A-Z] \d{1,2}[A-Z]{3} \d{4} \d{4}/.test(l));
    const ts = r.tramos.map((t, i) => {
      const diaMes = crudos[i]?.match(/ [A-Z] (\d{1,2}[A-Z]{3}) /)?.[1] || '';
      return { ...t, fecha: '', sale_en: `${diaMes ? diaMes + ' ' : ''}${t.sale}`, llega_en: `${t.llega}${t.llega_dia ? '+' + t.llega_dia : ''}` };
    });
    const personas = r.pasajero && (r.pasajero.nombre || r.pasajero.apellido || r.pasajero.documento) ? [{ ...r.pasajero, tipo: '', boletos: Object.fromEntries(r.tramos.map(t => [grupoDe(t), r.boleto])) }] : [];
    const emision = { ...r.emision };
    if (!ls.some(l => /ISSUE DATE[^:]*:\s*\d{1,2}\s*[A-Z]{3}\s*\d{4}\s+\d{1,2}:\s*\d{2}/i.test(l))) emision.fecha = emision.fecha.slice(0, 10);
    const d = desdeBoletosEmitidos({ pasajeros: personas, tramos: ts, emision });
    d.fuentes = unicos(recibo.paginas).map(pagina => ({ tipo: 'consolidador_texto', pagina }));
    if (r.emisora?.nombre) d.servicio.detalle.emisora = r.emisora;
    if (r.boleto && !ts.length && personas.length) agregarGrupo(d, { clave: 'boleto-sin-itinerario', aerolinea: r.emisora?.nombre || '', localizador: r.reserva, tramos: [], boletos: [{ pasajero_clave: d.pasajeros[0].clave, numero_ticket: ticket(r.boleto) }] });
    if (!personas.length) {
      advertir(d, 'Consolidador: pasajero no identificado; no se asignaron boletos por defecto.');
      if (r.boleto) d.servicio.detalle.boletos_sin_pasajero = [{ numero_ticket: ticket(r.boleto), aerolinea: r.emisora?.nombre || '', localizador: r.reserva }];
    }
    d.servicio.detalle.fechas_vuelo_sin_anio = crudos.map(l => l.match(/ [A-Z] (\d{1,2}[A-Z]{3}) /)?.[1] || '');
    advertir(d, 'Consolidador: año del vuelo no explícito; se conservaron día/mes en detalle y horas locales sin inventar año.');
    lista.push(d);
  }
  return lista.length ? combinarImportaciones(lista) : null;
}
