import { leerArchivosImportacion } from './reservas-importacion-archivos.js';
import { revisarImportacion } from './reservas-importacion-datos.js';
import { prepararGuardadoImportacion } from './reservas-importacion-guardado.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const copiar = v => JSON.parse(JSON.stringify(v));
const vacio = v => v == null || v === '';
const SERVICIO = [['descripcion', 'Descripción'], ['fecha_inicio', 'Inicio', 'date'], ['fecha_fin', 'Fin', 'date'], ['hora', 'Hora', 'time'], ['localizador', 'Localizador'], ['pax_adultos', 'Adultos', 'number'], ['pax_ninos', 'Niños', 'number']];
const PAX = [['nombre', 'Nombre'], ['apellido', 'Apellido'], ['tipo_documento', 'Tipo de documento'], ['numero_documento', 'Documento'], ['fecha_nacimiento', 'Nacimiento', 'date'], ['nacionalidad', 'Nacionalidad'], ['categoria', 'Categoría']];
const TRAMO = [['origen_iata', 'Origen IATA'], ['destino_iata', 'Destino IATA'], ['origen_nombre', 'Aeropuerto de salida'], ['destino_nombre', 'Aeropuerto de llegada'], ['aerolinea', 'Aerolínea'], ['codigo_aerolinea', 'Código aerolínea'], ['numero_vuelo', 'N.º de vuelo'], ['sale_en', 'Salida local (AAAA-MM-DDTHH:mm)'], ['llega_en', 'Llegada local (opcional)'], ['clase', 'Clase'], ['equipaje', 'Equipaje'], ['localizador', 'Localizador'], ['estado', 'Estado del vuelo (documento)']];
const ETIQUETAS = { hotel: 'Hotel', habitacion: 'Habitación', plan: 'Plan', noches: 'Noches', voucher: 'N.º de voucher', origen: 'Origen', destino: 'Destino', hora_regreso: 'Hora de regreso', vehiculo: 'Vehículo', embarcadero: 'Embarcadero', embarcacion: 'Embarcación', ida_vuelta: 'Ida y vuelta', punto_encuentro: 'Punto de encuentro', incluye: 'Incluye', no_incluye: 'No incluye', excursion: 'Excursión', aseguradora: 'Aseguradora', cobertura: 'Cobertura', poliza: 'Póliza', nota: 'Nota', aerolinea: 'Aerolínea', ruta: 'Ruta' };
const TIPOS_DETALLE = { hospedaje: ['hotel', 'habitacion', 'plan', 'noches', 'voucher'], traslado_terrestre: ['origen', 'destino', 'hora_regreso', 'vehiculo'], traslado_maritimo: ['embarcadero', 'embarcacion', 'ida_vuelta'], full_day: ['punto_encuentro', 'incluye', 'no_incluye', 'excursion'], seguro: ['aseguradora', 'cobertura', 'poliza'], otro: ['nota'], boleto_aereo: ['aerolinea', 'ruta'] };
function campo(path, label, value, type = 'text') {
  const dato = esc(JSON.stringify(path)), complejo = value != null && typeof value === 'object';
  if (complejo) return `<label class="rvi-campo">${esc(label)}<textarea class="ei" rows="3" data-rvi-json data-rvi-campo="${dato}">${esc(JSON.stringify(value, null, 2))}</textarea></label>`;
  if (typeof value === 'boolean') return `<label class="rvi-check"><input type="checkbox" data-rvi-campo="${dato}" ${value ? 'checked' : ''}> ${esc(label)}</label>`;
  return `<label class="rvi-campo">${esc(label)}<input class="ei" type="${type}" ${type === 'number' ? 'min="0" step="1"' : ''} maxlength="4000" data-rvi-campo="${dato}" value="${esc(value)}"></label>`;
}
export function crearImportacionServicio(c) {
  if (!document.querySelector('link[data-rvi-css]')) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./reservas-importacion.css', import.meta.url).href; link.dataset.rviCss = ''; document.head.append(link); }
  let datos = null, archivos = [], conflictos = [], seleccion = {}, precios = {}, reemplazar = false, aceptado = false, ocupado = '', pendiente = null, vivo = true;
  let tipo = c.tipo(), aborto = new AbortController();
  const vida = new AbortController();
  const urls = new Set(), subidas = new Map(), invalidos = new Set();
  const vigente = () => vivo && c.vigente() && c.root.isConnected;
  const mensaje = (s, error = false) => { if (!vigente()) return; const el = c.root.querySelector('[data-rvi-mensaje]'); if (el) { el.textContent = s; el.setAttribute('role', error ? 'alert' : 'status'); el.classList.toggle('rvi-error', error); } };
  const boton = (accion, texto, extra = '') => `<button type="button" class="dbtn" data-rvi-accion="${accion}" ${extra}>${texto}</button>`;
  const bloqueo = valor => { ocupado = valor; c.alOcupado?.(!!valor || !!pendiente); const fs = c.root.querySelector('fieldset'); if (fs) fs.disabled = !!valor || !!pendiente; };
  const cambiar = () => { aceptado = false; if (!pendiente) operacionId = crypto.randomUUID(); const ch = c.root.querySelector('[data-rvi-aceptado]'); if (ch) ch.checked = false; };
  let operacionId = crypto.randomUUID();
  function detalleConflicto(campo) {
    if (campo.startsWith('servicio.detalle.')) return ['servicio', 'detalle', campo.slice(17)];
    if (campo.startsWith('servicio.')) return ['servicio', campo.slice(9)];
    for (const [i, p] of datos.pasajeros.entries()) { const raiz = `pasajeros.${p.clave}`; if (campo === raiz) return ['pasajeros', i]; if (campo.startsWith(raiz + '.')) return ['pasajeros', i, campo.slice(raiz.length + 1)]; }
    return null;
  }
  function marcarConflictos(base) {
    conflictos = (datos.servicio.detalle?.conflictos_importacion || []).map(x => ({ ...x, path: detalleConflicto(x.campo), resuelto: false }));
    for (const [k] of SERVICIO) {
      const actual = base[k], nuevo = datos.servicio[k];
      if (vacio(nuevo)) { if (!vacio(actual)) datos.servicio[k] = actual; continue; }
      const defecto = !c.servicio && ['pax_adultos', 'pax_ninos'].includes(k) && Number(actual) === 0;
      if (!vacio(actual) && !defecto && String(actual).slice(0, k === 'hora' ? 5 : undefined) !== String(nuevo)) { conflictos.push({ campo: `servicio.${k}`, path: ['servicio', k], valores: [actual, nuevo], resuelto: false }); datos.servicio[k] = actual; }
    }
    for (const [k, actual] of Object.entries(base.detalle || {})) {
      if (k === 'importacion') continue;
      const nuevo = datos.servicio.detalle[k];
      if (vacio(nuevo)) datos.servicio.detalle[k] = actual;
      else if (!vacio(actual) && JSON.stringify(actual) !== JSON.stringify(nuevo)) { conflictos.push({ campo: `servicio.detalle.${k}`, path: ['servicio', 'detalle', k], valores: [actual, nuevo], resuelto: false }); datos.servicio.detalle[k] = actual; }
    }
    for (const aviso of datos.advertencias.filter(x => x.startsWith('Conflicto'))) if (!conflictos.some(x => aviso.startsWith(`Conflicto en ${x.campo}:`))) conflictos.push({ campo: aviso, valores: [], path: null, aviso, resuelto: false });
  }
  function render() {
    if (!vigente()) return;
    const revision = datos ? revisarImportacion(datos) : null;
    c.root.classList.toggle('rvi-revisando', !!datos);
    c.root.innerHTML = `<div class="rvi-cabecera"><div><h3>Importar desde un documento</h3><p>PDF o fotos del servicio, incluidos los PDF de Boletos emitidos.</p></div></div>
      <fieldset ${ocupado || pendiente ? 'disabled' : ''}><div class="rvi-elegir"><label class="dbtn rvi-archivo" tabindex="0"><i class="fas fa-file-arrow-up" aria-hidden="true"></i> ${datos ? 'Añadir documentos' : 'Elegir PDF o fotos'}<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple data-rvi-archivos></label><span class="csub">Hasta 20 archivos · 10 MB por archivo · 50 páginas por PDF</span></div>
      ${datos ? `<p class="rvi-resumen">${datos.grupos.length || 1} servicio(s) · ${datos.grupos.reduce((n, g) => n + g.tramos.length, 0)} tramos · ${datos.pasajeros.length} pasajeros · ${datos.grupos.reduce((n, g) => n + g.boletos.length, 0)} boletos</p>
      <div class="rvi-documentos">${archivos.map((a, i) => `<div><a href="${esc(a.url)}" target="_blank" rel="noopener" download="${esc(a.file.name)}">${esc(a.file.name)}</a><span>${a.paginas} pág.</span><label>Adjuntar a<select class="ei" data-rvi-doc="${i}">${(datos.grupos.length ? datos.grupos : [{ clave: 'servicio' }]).map((g, j) => `<option value="${esc(g.clave)}" ${a.grupo === g.clave ? 'selected' : ''}>Servicio ${j + 1}${g.localizador ? ' · ' + esc(g.localizador) : ''}</option>`).join('')}</select></label></div>`).join('')}</div>
      ${conflictos.length ? `<section class="rvi-conflictos"><h4>Diferencias que debes resolver</h4>${conflictos.map((x, i) => `<label class="rvi-campo">${esc(x.campo)}${x.resuelto ? '<span>Resuelto; puedes seguir editando abajo.</span>' : `<select class="ei" data-rvi-conflicto="${i}"><option value="">Elige qué conservar</option>${x.valores.map((v, j) => `<option value="${j}">${j === 0 ? 'Valor actual / primer documento' : 'Valor del documento ' + (j + 1)}: ${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</option>`).join('')}<option value="manual">Lo corregí manualmente en los campos</option></select>`}</label>`).join('')}</section>` : ''}
      <section><h4>Datos del servicio</h4><div class="rvi-grid">${SERVICIO.map(([k, l, t]) => campo(['servicio', k], l, datos.servicio[k], t)).join('')}</div><details ${tipo !== 'boleto_aereo' ? 'open' : ''}><summary>Detalles del servicio</summary><div class="rvi-grid">${[...new Set([...(TIPOS_DETALLE[tipo] || []), ...Object.keys(datos.servicio.detalle)])].filter(k => !['conflictos_importacion', 'conflictos_resueltos', 'importacion'].includes(k)).map(k => campo(['servicio', 'detalle', k], ETIQUETAS[k] || k.replace(/_/g, ' '), datos.servicio.detalle[k])).join('')}</div></details></section>
      <section><h4>Pasajeros de la reserva</h4><p class="csub">Reutilización automática solo con documento exacto. Si coincide únicamente el nombre, selecciona la persona existente.</p>${datos.pasajeros.map((p, i) => `<details class="rvi-ficha" open><summary>${i + 1}. ${esc([p.nombre, p.apellido].filter(Boolean).join(' ') || 'Pasajero sin nombre')}</summary><div class="rvi-grid">${PAX.map(([k, l, t]) => campo(['pasajeros', i, k], l, p[k], t)).join('')}<label class="rvi-campo">Vincular con pasajero existente<select class="ei" data-rvi-pax="${esc(p.clave)}"><option value="">Nuevo o coincidencia exacta por documento</option><option value="nuevo" ${seleccion[p.clave] === 'nuevo' ? 'selected' : ''}>Crear otra persona aunque tenga el mismo nombre</option>${(c.pasajeros || []).map(q => `<option value="${q.id}" ${Number(seleccion[p.clave]) === q.id ? 'selected' : ''}>${esc([q.nombre, q.apellido, q.numero_documento, q.nacimiento || q.fecha_nacimiento].filter(Boolean).join(' · '))}</option>`).join('')}</select></label></div>${boton('quitar-pax', 'Retirar este pasajero', `data-indice="${i}"`)}</details>`).join('')}${boton('agregar-pax', 'Añadir pasajero')}</section>
      <section><h4>Itinerario y boletos por servicio</h4><p class="csub">Se conserva cada conexión. Las horas son locales: no se inventan años, zonas ni llegadas.</p>${datos.grupos.map((g, i) => `<details class="rvi-ficha" open><summary>Servicio ${i + 1} · ${esc(g.aerolinea || 'Aerolínea pendiente')} · ${esc(g.localizador || 'Sin localizador')} · ${g.tramos.length} tramos</summary><div class="rvi-grid">${campo(['grupos', i, 'aerolinea'], 'Aerolínea del grupo', g.aerolinea)}${campo(['grupos', i, 'localizador'], 'Localizador del grupo', g.localizador)}${i > 0 ? `<label class="rvi-campo">Precio de venta de este servicio<input class="ei" type="number" min="0" step="0.01" data-rvi-precio="${esc(g.clave)}" value="${esc(precios[g.clave] ?? 0)}"></label>` : ''}</div>
      ${g.tramos.map((t, j) => `<details class="rvi-tramo" open><summary>Tramo ${j + 1} · ${esc(t.origen_iata || t.origen_nombre || '?')} → ${esc(t.destino_iata || t.destino_nombre || '?')}</summary><div class="rvi-grid">${TRAMO.map(([k, l]) => campo(['grupos', i, 'tramos', j, k], l, t[k])).join('')}</div>${boton('quitar-tramo', 'Retirar tramo', `data-grupo="${i}" data-indice="${j}"`)}</details>`).join('')}${boton('agregar-tramo', 'Añadir conexión', `data-grupo="${i}"`)}
      <h5>Boletos asociados a este itinerario</h5>${g.boletos.map((b, j) => `<div class="rvi-boleto"><label class="rvi-campo">Pasajero<select class="ei" data-rvi-campo="${esc(JSON.stringify(['grupos', i, 'boletos', j, 'pasajero_clave']))}"><option value="">Elige pasajero</option>${datos.pasajeros.map(p => `<option value="${esc(p.clave)}" ${b.pasajero_clave === p.clave ? 'selected' : ''}>${esc(p.nombre + ' ' + p.apellido)}</option>`).join('')}</select></label>${campo(['grupos', i, 'boletos', j, 'numero_ticket'], 'N.º de ticket', b.numero_ticket)}${boton('quitar-boleto', 'Retirar', `data-grupo="${i}" data-indice="${j}"`)}</div>`).join('')}${boton('agregar-boleto', 'Añadir boleto', `data-grupo="${i}"`)}${boton('quitar-grupo', 'Retirar servicio e itinerario', `data-grupo="${i}"`)}</details>`).join('')}${tipo === 'boleto_aereo' ? boton('agregar-grupo', 'Añadir servicio / localizador') : ''}</section>
      ${revision.advertencias.length || revision.errores.length ? `<details class="rvi-avisos" open><summary>Datos pendientes y observaciones (${revision.advertencias.length + revision.errores.length})</summary><ul>${[...revision.errores, ...revision.advertencias].map(a => `<li>${esc(a)}</li>`).join('')}</ul></details>` : ''}
      ${c.servicio && tipo === 'boleto_aereo' ? `<label class="rvi-check"><input type="checkbox" data-rvi-reemplazar ${reemplazar ? 'checked' : ''}> Confirmo reemplazar el itinerario actual (${c.tramos?.length || 0} tramos) con el revisado. Los boletos existentes no se sobrescriben.</label>` : ''}
      <p class="csub">Precio, moneda y estado comercial se revisan en el formulario inferior: no se extraen del documento. El precio principal no se repite en servicios adicionales; nacen cotizados, sin pagos.</p>
      <label class="rvi-check"><input type="checkbox" data-rvi-aceptado ${aceptado ? 'checked' : ''}> Revisé los datos, las relaciones de los boletos y los avisos. ${c.alBorrador ? 'Incorporar solo prepara el borrador; los archivos se adjuntan al crear la reserva.' : 'Guardar creará o actualizará estos registros y adjuntará los archivos.'}</label>
      <div class="rvi-pie">${c.alBorrador ? boton('reintentar', 'Incorporar al borrador') : ''}${boton('descartar', 'Descartar importación y volver al formulario')}</div>` : '<p class="rvi-nota">Primero leerás y corregirás los datos. No se crea ningún pasajero, boleto ni servicio hasta que confirmes Guardar.</p>'}</fieldset>
      <p class="rvi-mensaje" data-rvi-mensaje role="status" aria-live="polite"></p>${pendiente ? boton('reintentar', 'Reintentar el mismo guardado de forma segura') : ''}`;
    c.alActivar?.(!!datos);
  }
  function resolver(i, valor) {
    const x = conflictos[i]; if (!x || !valor) return;
    if (invalidos.size) { mensaje('Corrige el JSON marcado antes de resolver diferencias.', true); return; }
    if (valor !== 'manual' && x.path) {
      let obj = datos; for (const k of x.path.slice(0, -1)) obj = obj[k];
      const key = x.path.at(-1), elegido = copiar(x.valores[Number(valor)]);
      if (x.path[0] === 'pasajeros' && x.path.length === 2 && elegido && typeof elegido === 'object') elegido.clave = obj[key].clave;
      obj[key] = elegido;
    }
    x.resuelto = true;
    datos.servicio.detalle.conflictos_importacion = (datos.servicio.detalle.conflictos_importacion || []).filter(a => a.campo !== x.campo);
    (datos.servicio.detalle.conflictos_resueltos ||= []).push({ campo: x.campo, valores: x.valores, eleccion: valor });
    datos.advertencias = datos.advertencias.filter(a => !(a === x.aviso || a.startsWith(`Conflicto en ${x.campo}:`)));
    cambiar(); render();
  }
  async function confirmarSalida() {
    if (ocupado === 'guardando' || pendiente) { mensaje('El guardado está pendiente. Reintenta la misma operación antes de salir para conocer su resultado.', true); return false; }
    if (!datos && !ocupado) return true;
    return c.confirmar({ titulo: '¿Descartar la importación?', detalle: 'Se perderán los documentos leídos y las correcciones que aún no has guardado. No se modificará la reserva.', textoOk: 'Descartar', destructivo: true });
  }
  function limpiar() {
    aborto.abort(); aborto = new AbortController(); urls.forEach(u => URL.revokeObjectURL(u)); urls.clear();
    datos = null; archivos = []; conflictos = []; seleccion = {}; precios = {}; aceptado = false; reemplazar = false; invalidos.clear(); operacionId = crypto.randomUUID(); bloqueo(''); render();
  }
  async function leer(files) {
    if (ocupado || pendiente || !files.length) return;
    if (files.length + archivos.length > 20) return mensaje('El máximo es 20 archivos por importación.', true);
    if (invalidos.size) return mensaje('Corrige el JSON marcado antes de añadir documentos.', true);
    try {
      const base = datos ? null : c.leerBase(); bloqueo('leyendo'); mensaje('Preparando lectura completa…');
      const r = await leerArchivosImportacion(files, { tipo, signal: aborto.signal, pdfjs: c.pdfjs, progreso: mensaje, extraer: async b => {
        const { data, error } = await c.sb.functions.invoke('analizar-servicio', { body: { ...b, paginas: b.paginas.map(p => ({ numero: p.numero, texto: p.texto })), ...(c.leadId ? { lead_id: c.leadId } : { reserva_id: c.reservaId }) }, signal: aborto.signal });
        if (error || !data?.ok) {
          let detalle = data;
          if (!detalle && error?.context?.clone) { try { detalle = await error.context.clone().json(); } catch (_) { /* Respuesta no JSON. */ } }
          throw new Error([detalle?.ayuda, detalle?.error].filter(Boolean).join(' · ') || 'No se pudo leer el documento. Reintenta; no se guardó nada.');
        }
        return data.datos;
      } });
      if (!vigente() || aborto.signal.aborted) return;
      const nuevos = r.archivos.filter(a => !archivos.some(b => b.sha256 === a.sha256));
      if (!nuevos.length) { mensaje('Estos archivos ya están en la revisión; no se duplicaron.'); return; }
      if (datos) {
        const { combinarImportaciones } = await import('./reservas-importacion-datos.js'); datos = combinarImportaciones([datos, ...nuevos.map(a => a.datos)]);
        for (const x of datos.servicio.detalle?.conflictos_importacion || []) if (!conflictos.some(y => !y.resuelto && y.campo === x.campo && JSON.stringify(y.valores) === JSON.stringify(x.valores))) conflictos.push({ ...x, path: detalleConflicto(x.campo), resuelto: false });
      }
      else { datos = r.datos; marcarConflictos(base); }
      for (const a of nuevos) { a.url = URL.createObjectURL(a.file); urls.add(a.url); a.grupo = datos.grupos[0]?.clave || 'servicio'; archivos.push(a); }
      cambiar(); render(); mensaje('Lectura completa. Revisa y corrige antes de guardar.');
    } catch (e) { if (vigente() && !aborto.signal.aborted) mensaje(e.message || 'No se pudo leer el documento; no se guardó nada.', true); }
    finally { if (vigente()) bloqueo(''); }
  }
  async function guardar() {
    if (!datos) return false;
    if (ocupado) { mensaje('Espera a que termine la lectura del documento antes de continuar.', true); return false; }
    const reintento = !!pendiente;
    try {
      if (!pendiente) {
        if (!aceptado) throw new Error('Marca que revisaste los datos y los avisos antes de guardar.');
        if (invalidos.size || conflictos.some(x => !x.resuelto)) throw new Error('Resuelve las diferencias y corrige los campos marcados antes de guardar.');
        const preparar = documentos => prepararGuardadoImportacion({ datos, base: c.leerBase(), reservaId: c.reservaId, servicio: c.servicio, operacionId, documentos, seleccion, precios, aerolineas: c.aerolineas?.() || [], reemplazarTramos: reemplazar });
        if (c.alBorrador) {
          const lote = preparar([]);
          bloqueo('guardando');
          await c.alBorrador({ ...lote, archivos: archivos.map(a => ({ file: a.file, mime: a.mime, sha256: a.sha256, grupo: lote.servicios[Math.max(0, datos.grupos.findIndex(g => g.clave === a.grupo))]?.clave })) });
          limpiar(); mensaje('Documentos incorporados al borrador. Completa los precios en Servicios; se adjuntarán al crear la reserva.'); return true;
        }
        preparar(archivos.map(a => ({ path: '0'.repeat(400), nombre: a.file.name, mime: a.mime, tamano: a.file.size, sha256: a.sha256, tipo: tipo === 'boleto_aereo' ? 'boleto' : 'otro', servicio_clave: a.grupo }))); bloqueo('guardando'); mensaje('Adjuntando archivos privados…');
        const documentos = [];
        for (const a of archivos) {
          if (!vigente()) throw new Error('La revisión ya no está activa.');
          let path = subidas.get(a.sha256);
          if (!path) {
            const { data: firma, error: e } = await c.sb.functions.invoke('reservas-documentos', { body: { accion: 'subir', reserva_id: c.reservaId, servicio_id: null, tipo: tipo === 'boleto_aereo' ? 'boleto' : 'otro', nombre: a.file.name, mime: a.mime, tamano: a.file.size } });
            if (e || !firma?.ok) throw new Error(firma?.error || 'No se pudo autorizar el adjunto. No se guardaron registros.');
            const { error: subidaError } = await c.sb.storage.from('reservas-documentos').uploadToSignedUrl(firma.path, firma.token, a.file, { contentType: a.mime });
            if (subidaError) throw new Error('No se pudo completar la subida privada. Reintenta; no se guardaron registros.');
            path = firma.path; subidas.set(a.sha256, path);
          }
          documentos.push({ path, nombre: a.file.name, mime: a.mime, tamano: a.file.size, sha256: a.sha256, tipo: tipo === 'boleto_aereo' ? 'boleto' : 'otro', servicio_clave: a.grupo });
        }
        pendiente = preparar(documentos);
      }
      bloqueo('guardando'); mensaje('Guardando servicio, itinerario, pasajeros y boletos en una sola operación…');
      const { data, error } = await c.sb.rpc('reserva_importacion_guardar', { p_datos: pendiente });
      if (!vigente()) return true;
      if (error) {
        if (!reintento && ['PGRST202', '42883', '42501', '22023', '23505', '23514'].includes(error.code)) { pendiente = null; if (['PGRST202', '42883'].includes(error.code)) throw new Error('El backend de importación aún no está activado. No se guardó nada; conserva esta revisión y solicita la migración autorizada.'); throw new Error(error.message || 'La base rechazó la operación completa; no se guardaron registros.'); }
        throw new Error('No se pudo confirmar el resultado. Reintenta el mismo guardado; no se duplicará. No modifiques ni cierres esta revisión.');
      }
      if (data?.ok === false) { pendiente = null; throw new Error(`${data?.error || 'Importación rechazada'}${data?.etapa ? ' · ' + data.etapa : ''}${data?.causa ? ': ' + data.causa : ''}. No se guardaron registros.`); }
      if (data?.ok !== true || !Array.isArray(data.servicios) || !data.servicios.length) throw new Error('Respuesta incompleta: reintenta el mismo guardado para confirmar el resultado.');
      pendiente = null; ocupado = ''; datos = null; await c.alGuardar(data); return true;
    } catch (e) { mensaje(e.message || 'No se pudo guardar. La revisión sigue disponible.', true); return false; }
    finally { if (vigente()) { bloqueo(''); if (pendiente) { render(); mensaje('Resultado pendiente de confirmación. Reintenta la misma operación; no se duplicará.', true); } } }
  }
  c.root.addEventListener('input', e => {
    const t = e.target; if (ocupado || pendiente || !datos) return;
    if (t.hasAttribute('data-rvi-campo')) {
      const path = JSON.parse(t.dataset.rviCampo); let obj = datos; for (const k of path.slice(0, -1)) obj = obj[k];
      try { obj[path.at(-1)] = t.hasAttribute('data-rvi-json') ? JSON.parse(t.value) : t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? null : Number(t.value)) : t.value.trim(); invalidos.delete(t); t.removeAttribute('aria-invalid'); } catch { invalidos.add(t); t.setAttribute('aria-invalid', 'true'); }
      cambiar();
    } else if (t.hasAttribute('data-rvi-precio')) { precios[t.dataset.rviPrecio] = t.value; cambiar(); }
  }, { signal: vida.signal });
  c.root.addEventListener('change', async e => {
    const t = e.target; if (t.hasAttribute('data-rvi-archivos')) { const files = [...t.files]; t.value = ''; void leer(files); return; }
    if (ocupado || pendiente || !datos) return;
    if (t.hasAttribute('data-rvi-conflicto')) resolver(Number(t.dataset.rviConflicto), t.value);
    else if (t.hasAttribute('data-rvi-pax')) {
      const clave = t.dataset.rviPax, valor = t.value;
      if (valor === 'nuevo') {
        t.disabled = true;
        const ok = await c.confirmar({ titulo: '¿Crear una persona distinta?', detalle: 'Confirma que no es un pasajero ya registrado. Esta elección permite homónimos, pero nunca duplicar el mismo documento.', textoOk: 'Crear persona distinta' });
        if (!vigente() || !t.isConnected) return;
        t.disabled = false; if (!ok) { t.value = seleccion[clave] || ''; return; }
      }
      seleccion[clave] = valor; cambiar();
    }
    else if (t.hasAttribute('data-rvi-doc')) { archivos[Number(t.dataset.rviDoc)].grupo = t.value; cambiar(); }
    else if (t.hasAttribute('data-rvi-reemplazar')) { reemplazar = t.checked; cambiar(); }
    else if (t.hasAttribute('data-rvi-aceptado')) aceptado = t.checked;
  }, { signal: vida.signal });
  c.root.addEventListener('keydown', e => { if (e.target.matches('.rvi-archivo') && ['Enter', ' '].includes(e.key)) { e.preventDefault(); e.target.querySelector('input').click(); } }, { signal: vida.signal });
  c.root.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); }, { signal: vida.signal });
  c.root.addEventListener('drop', e => { if (!e.dataTransfer?.files.length) return; e.preventDefault(); leer([...e.dataTransfer.files]); }, { signal: vida.signal });
  c.root.addEventListener('paste', e => { const fotos = [...(e.clipboardData?.items || [])].filter(i => i.kind === 'file' && /^image\//.test(i.type)).map(i => i.getAsFile()).filter(Boolean); if (fotos.length) { e.preventDefault(); leer(fotos); } }, { signal: vida.signal });
  c.root.addEventListener('click', async e => {
    const b = e.target.closest('[data-rvi-accion]'); if (!b) return; e.preventDefault();
    const a = b.dataset.rviAccion, i = Number(b.dataset.indice), g = Number(b.dataset.grupo);
    if (a === 'reintentar') return void guardar();
    if (ocupado || pendiente) return;
    if (a === 'descartar') { if (await confirmarSalida()) limpiar(); return; }
    if (!datos) return;
    if (invalidos.size) { mensaje('Corrige el JSON marcado antes de cambiar la revisión.', true); return; }
    if (a.startsWith('quitar') && !(await c.confirmar({ titulo: '¿Retirar de la importación?', detalle: 'Se retirará de esta revisión, no de los registros actuales de la reserva.', textoOk: 'Retirar', destructivo: true }))) return;
    if (a === 'quitar-pax') { const [p] = datos.pasajeros.splice(i, 1); datos.grupos.forEach(x => x.boletos = x.boletos.filter(b => b.pasajero_clave !== p.clave)); }
    if (a === 'quitar-tramo') datos.grupos[g].tramos.splice(i, 1);
    if (a === 'quitar-boleto') datos.grupos[g].boletos.splice(i, 1);
    if (a === 'quitar-grupo') { const [q] = datos.grupos.splice(g, 1); archivos.forEach(f => { if (f.grupo === q.clave) f.grupo = datos.grupos[0]?.clave || 'servicio'; }); }
    if (a === 'agregar-pax') datos.pasajeros.push({ clave: crypto.randomUUID(), ...Object.fromEntries(PAX.map(([k]) => [k, ''])) });
    if (a === 'agregar-grupo') datos.grupos.push({ clave: crypto.randomUUID(), aerolinea: '', localizador: '', tramos: [], boletos: [] });
    if (a === 'agregar-tramo') datos.grupos[g].tramos.push(Object.fromEntries(TRAMO.map(([k]) => [k, ''])));
    if (a === 'agregar-boleto') datos.grupos[g].boletos.push({ pasajero_clave: '', numero_ticket: '' });
    cambiar(); render();
  }, { signal: vida.signal });
  render();
  return {
    get activo() { return !!datos; }, get sucio() { return !!datos || !!ocupado || !!pendiente; }, get guardando() { return ocupado === 'guardando' || !!pendiente; },
    guardar, confirmarSalida, agregarArchivos: leer,
    async cambiarTipo(nuevo) { if (nuevo === tipo) return true; if (!(await confirmarSalida())) return false; tipo = nuevo; limpiar(); return true; },
    destruir() { vivo = false; vida.abort(); aborto.abort(); urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); c.alActivar?.(false); },
  };
}
