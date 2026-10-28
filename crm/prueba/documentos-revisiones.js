const TITULOS = { solicitud: 'Solicitud', cotizacion: 'Cotización', voucher: 'Voucher' };
const ERRORES = {
  conflicto_revision: 'El documento cambió en otra sesión. Abre de nuevo su historial antes de corregirlo.',
  conflicto_saldo: 'Los importes vinculados cambiaron. Revisa nuevamente el resumen antes de guardar.',
  documento_anulado: 'El documento está anulado.', motivo_requerido: 'Explica el motivo con al menos 4 caracteres.',
  saldo_incompatible: 'El ajuste dejaría importes negativos o un pago superior al total. Revisa el total y lo pagado.',
  comision_base_incompatible: 'La corrección supera el importe del servicio que originó la comisión.',
  tipo_ajuste_requerido: 'Selecciona si corriges un error, registras un abono o una devolución.',
  devolucion_incompleta: 'Para registrar la devolución, indica fecha, medio y referencia del dinero ya devuelto.',
  fecha_devolucion_futura: 'La devolución debe corresponder a dinero ya devuelto.', abono_invalido: 'Un abono adicional debe aumentar lo pagado.',
  solicitud_ya_abierta: 'Esta solicitud ya está abierta; sus datos se pueden corregir con Editar.',
  solicitud_con_boleto_activo: 'La solicitud tiene un boleto activo. Gestiona su cambio desde la reserva antes de reabrirla.',
  pdf_requerido: 'El PDF no terminó de guardarse. Reintenta; la versión vigente se conserva.',
  voucher_pendiente_confirmacion: 'Completa la generación pendiente de este voucher antes de corregirlo.',
  factura_no_vigente: 'La factura vinculada está anulada o excluida. Puedes corregir datos; para cambiar importes, primero revisa la operación en Facturación.',
};

export function crearDocumentosRevisiones(c) {
  const ediciones = new Map(), ocupados = new Set(), enviosPendientes = new Map();
  const $ = id => document.getElementById(id), esc = c.esc;
  const money = n => Number(n || 0).toLocaleString('es-VE', { style: 'currency', currency: 'USD' });
  const mensaje = e => ERRORES[e?.message || e] || e?.message || e || 'No se pudo completar la operación';
  const anulado = d => !!(d.anulado_en || d.eliminado_at);
  const numero = (t, d) => `${TITULOS[t]} ${d.numero_factura || d.numero || d.id} · revisión ${d.revision || 1}`;
  function datosHistoricos(t, d) {
    const comunes = t === 'cotizacion' ? [['cliente', 'Cliente'], ['fecha', 'Fecha'], ['vence', 'Válida hasta'], ['total', 'Total'], ['notas', 'Notas'], ['terminos', 'Términos']]
      : t === 'voucher' ? [['cliente_nombre', 'Cliente'], ['documento_identidad', 'Documento'], ['telefono', 'Teléfono'], ['asesor_nombre', 'Asesor'], ['destino_hospedaje', 'Hotel o destino'], ['fecha_entrada', 'Entrada'], ['fecha_salida', 'Salida'], ['modalidad', 'Plan'], ['habitaciones', 'Habitaciones'], ['adultos', 'Adultos'], ['ninos', 'Niños'], ['total_general', 'Total'], ['monto_pagado', 'Pagado'], ['resta', 'Saldo'], ['forma_pago', 'Forma de pago'], ['referencia_pago', 'Referencia']]
        : [['cliente_nombre', 'Cliente'], ['cliente_telefono', 'Teléfono'], ['cliente_cedula', 'Documento'], ['origen', 'Origen'], ['destino', 'Destino'], ['fecha_viaje', 'Ida'], ['fecha_regreso', 'Regreso'], ['adultos', 'Adultos'], ['ninos', 'Niños'], ['infantes', 'Infantes'], ['notas', 'Notas'], ['resultado', 'Resultado']];
    const moneda = new Set(['total', 'total_general', 'monto_pagado', 'resta']);
    const campos = comunes.filter(([k]) => d[k] !== null && d[k] !== undefined && d[k] !== '').map(([k, etiqueta]) => `<dt>${etiqueta}</dt><dd>${esc(moneda.has(k) ? money(d[k]) : d[k])}</dd>`).join('');
    const servicios = (t === 'cotizacion' ? d.items : d.servicios) || [];
    return `<dl class="dr-datos">${campos}</dl>` + servicios.map(s => `<p>${esc(s.nombre || s.ruta || s.tipo || 'Servicio')}${s.plan ? ' · ' + esc(s.plan) : ''}${s.hab ? ' · ' + esc(s.hab) : ''}${s.ida || s.fecha ? ' · ' + esc(s.ida || s.fecha) : ''}${s.vuelta ? ' → ' + esc(s.vuelta) : ''} · ${money(t === 'cotizacion' ? c.importeItem(s) : s.monto)}</p>`).join('');
  }
  async function rpc(fn, args) {
    const { data, error } = await c.sb.rpc(fn, args);
    if (error) {
      const e = new Error(error.code === '42501' ? 'Tu usuario no puede modificar este documento.' : error.message);
      if (['42501', '22023', '22P02', '23514'].includes(error.code)) e.datos = { error: error.message };
      throw e;
    }
    if (!data?.ok) { const e = new Error(data?.error || 'Sin respuesta del servidor'); e.datos = data; throw e; }
    return data;
  }
  async function blob(t, d) { await c.librerias(); return c.pdf(t, d); }
  async function archivo(bucket, path) {
    const { data, error } = await c.sb.storage.from(bucket).download(path);
    if (error) throw new Error('No se pudo obtener el PDF guardado. Reintenta.');
    return data;
  }
  async function pdfVigente(t, d) {
    const path = d.pdf_revision_path || d.pdf_path;
    if (path) return archivo(t === 'voucher' || d.pdf_revision_path ? 'vouchers-pdf' : 'chat-interno-adjuntos', path);
    return blob(t, d);
  }
  function nombre(t, d) { return c.nombreArchivo ? c.nombreArchivo(t, d) : `${TITULOS[t]}-${d.numero_factura || d.numero || d.id}-r${d.revision || 1}.pdf`; }
  function puedeEditar(t, d) {
    return c.rol() === 'admin' || (t === 'solicitud' ? d.es_mia || d.la_atiendo_yo
      : d.creado_por === c.usuario() || (t === 'cotizacion' && c.atiende(d.solicitud_id)));
  }
  function acciones(t, d) {
    const btn = (a, texto, icono) => `<button class="btn-sm dr-accion" type="button" data-dr="${a}" data-dr-tipo="${t}" data-dr-id="${esc(d.id)}" title="${texto}" aria-label="${texto} ${esc(numero(t, d))}"><i class="fas fa-${icono}" aria-hidden="true"></i></button>`;
    const editable = puedeEditar(t, d), cerrado = anulado(d);
    return `<div class="dr-acciones" role="group" aria-label="Acciones de ${esc(numero(t, d))}"><span class="dr-revision">${cerrado ? 'Anulado · ' : ''}Revisión ${d.revision || 1}</span>`
      + (!cerrado && editable ? btn('editar', 'Editar', 'pen-to-square') + btn('anular', 'Anular', 'circle-xmark') : '')
      + btn('historial', 'Historial', 'clock-rotate-left')
      + (t === 'solicitud' ? (editable && ['resuelta', 'cancelada'].includes(d.estado) ? btn('reenviar', 'Volver a enviar', 'paper-plane') : '')
        : !cerrado ? btn('descarga', 'Descargar', 'download') + btn('compartir', 'Compartir', 'share-nodes')
          + (t === 'cotizacion' && d.origen !== 'ventas' && editable ? btn('reenviar', 'Volver a enviar', 'paper-plane') : '') : '') + '</div>';
  }
  function cancelar(t) {
    ediciones.delete(t); $(`dr-editando-${t}`)?.remove();
    c.editorActualizado?.(t, null);
  }
  async function editar(t, d) {
    if (ediciones.has(t) && !(await c.confirmar({ titulo: '¿Reemplazar la corrección abierta?', detalle: 'Los cambios sin guardar se descartarán.', textoOk: 'Abrir documento' }))) return;
    if ($('dr-historial-sheet')?.classList.contains('open')) c.cerrar('dr-historial-sheet');
    await c.abrirEditor(t, d);
    ediciones.set(t, { original: d, operacion: crypto.randomUUID() });
    const aviso = document.createElement('div'); aviso.id = `dr-editando-${t}`; aviso.className = 'vc-hecho';
    const sig = (d.revision || 1) + 1, para = d.enviado_a_nombre || (d.enviado_a ? c.nombreUsuario(d.enviado_a) : '');
    const ayuda = t === 'cotizacion'
      ? `Cambia vuelos, horarios, aerolínea o precios abajo y toca <b>Guardar revisión</b>. Se genera el PDF nuevo (revisión ${sig})${para && d.origen !== 'ventas' ? ` y reemplaza al que tiene ${esc(para)} en el chat` : ''}.`
      : `Corrige los datos y guarda: quedará como revisión ${sig} y la anterior se conserva en el historial.`;
    aviso.className = 'vc-hecho dr-editando';
    aviso.innerHTML = `<i class="fas fa-pen-to-square dr-editando-ico" aria-hidden="true"></i><div class="dr-editando-txt"><b>Corrigiendo ${esc(numero(t, d))}</b><span>${ayuda}</span></div><button class="btn-sm" type="button">Cancelar</button>`;
    aviso.querySelector('button').onclick = () => { cancelar(t); c.limpiar(t); };
    c.contenedorEditor(t).prepend(aviso); c.editorActualizado?.(t, d); aviso.scrollIntoView({ block: 'nearest' });
  }
  async function preparar(t, ed, datos, finanzas) {
    for (let intento = 0; intento < 3; intento++) {
      try { return await rpc('documento_preparar', { p_tipo: t, p_id: String(ed.original.id), p_version: ed.original.revision || 1, p_datos: datos, p_finanzas: finanzas }); }
      catch (e) {
        if (!['selecciona_servicio', 'selecciona_factura'].includes(e.message)) throw e;
        const esServicio = e.message === 'selecciona_servicio', filas = esServicio ? e.datos.servicios : e.datos.facturas;
        const eleccion = await c.confirmar({ titulo: esServicio ? 'Selecciona el servicio que corriges' : 'Selecciona la factura vinculada',
          detalle: 'El ajuste se aplicará a esta operación. Los demás servicios y cobros se conservan.', textoOk: 'Revisar ajuste',
          campos: [{ id: 'id', tipo: 'select', label: esServicio ? 'Servicio' : 'Factura', requerido: true,
            opciones: [{ v: '', t: 'Selecciona una operación' }, ...filas.map(x => ({ v: x.id, t: esServicio ? `${x.descripcion || x.tipo} · ${money(x.precio_usd_centavos / 100)}` : `Factura ${x.numero_factura} · ${money(x.monto_total)}` }))] }] });
        if (!eleccion) return null;
        finanzas[esServicio ? 'servicio_id' : 'factura_id'] = Number(eleccion.id);
      }
    }
    throw new Error('Revisa las operaciones vinculadas antes de continuar.');
  }
  function resumen(pre) {
    const i = pre.impacto || {}, lineas = [];
    if (i.reserva_id) lineas.push(`Reserva ${i.codigo}: total ${money(i.total_antes)} → ${money(i.total_despues)}; pagado ${money(i.pagado_antes)} → ${money(i.pagado_despues)}.`,
      `Facturado: ${money(i.factura_antes)} → ${money(i.factura_despues)}.`);
    for (const x of i.comisiones || []) lineas.push(`Comisión: ${money(x.antes)} → ${money(x.despues)}${x.comprometida ? `; ajuste para próxima liquidación: ${money(x.diferencia)}` : ''}.`);
    return lineas.join('\n');
  }
  // La cotización corregida reemplaza a la que el asesor ya tenía en el chat: sale la
  // revisión nueva y se retiran los mensajes de revisiones anteriores que mandó este
  // mismo usuario (los PDF viejos siguen en el historial del documento).
  async function reemplazarEnChat(d, original, pdf) {
    const destino = d.enviado_a || original.enviado_a;
    if (!destino || String(destino) === String(c.usuario())) return null;
    const h = await rpc('documento_historial', { p_tipo: 'cotizacion', p_id: String(d.id) });
    const previos = h.envios.filter(e => e.accion === 'chat_interno' && e.mensaje_id && (e.revision || 1) < (d.revision || 1)
      && String(e.destinatario) === String(destino) && String(e.enviado_por) === String(c.usuario()));
    await enviarCotizacion(d, destino, pdf);
    for (const e of previos) { try { await c.sb.rpc('eliminar_mensaje', { p_mensaje_id: e.mensaje_id }); } catch { /* el mensaje viejo queda; la revisión nueva ya llegó */ } }
    return { nombre: d.enviado_a_nombre || original.enviado_a_nombre || c.nombreUsuario(destino), reemplazo: previos.length > 0 };
  }
  async function finalizar(t, ed, resultado, pdf) {
    const d = resultado.documento;
    let envio = null;
    if (t === 'cotizacion' && pdf && d.origen !== 'ventas') {
      try { envio = await reemplazarEnChat(d, ed.original, pdf); }
      catch (e) { c.error(`La revisión se guardó, pero no se pudo mandar al asesor (${mensaje(e)}). Reenvíala desde el historial.`); }
    }
    if (pdf && !envio) c.descargar(pdf, nombre(t, d));
    cancelar(t); c.limpiar(t); await c.recargar(t);
    c.ok(envio ? `${numero(t, d)} lista: PDF nuevo enviado a ${envio.nombre}${envio.reemplazo ? ', reemplazó al anterior en el chat' : ''}.`
      : `${numero(t, d)} guardada.${t === 'solicitud' ? '' : ' Descargaste el PDF nuevo; puedes enviarlo desde el historial.'}`);
    if (resultado.aviso) c.error(resultado.aviso);
  }
  async function guardar(t, datosEntrada) {
    const datos = structuredClone(datosEntrada);
    const ed = ediciones.get(t); if (!ed) return false;
    if (ocupados.has(`guardar-${t}`)) return true;
    ocupados.add(`guardar-${t}`);
    try {
      // Una respuesta perdida se resuelve con la misma operación antes de preparar otra.
      if (ed.pendiente) {
        try { const recuperada = await rpc('documento_guardar', ed.pendiente.args); await finalizar(t, ed, recuperada, ed.pendiente.pdf); }
        catch (e) { if (e.datos) { ed.pendiente = null; ed.operacion = crypto.randomUUID(); } throw e; }
        return true;
      }
      const cambioMonto = t === 'voucher' && ['total_general', 'monto_pagado'].some(k => Number(datos[k] || 0) !== Number(ed.original[k] || 0));
      const campos = [{ id: 'motivo', tipo: 'textarea', label: 'Motivo de la corrección (mínimo 4 caracteres)', requerido: true, valor: ed.motivo || '' }];
      if (cambioMonto) campos.push({ id: 'tipo', tipo: 'select', label: 'Tipo de ajuste', requerido: true, opciones: [
        { v: '', t: 'Selecciona qué ocurrió' }, { v: 'error_registro', t: 'Corregir un error de registro' },
        { v: 'abono_adicional', t: 'Registrar un abono adicional' }, { v: 'devolucion', t: 'Registrar dinero ya devuelto' }] });
      const eleccion = await c.confirmar({ titulo: `Corregir ${numero(t, ed.original)}`, textoOk: 'Revisar cambios', campos });
      if (!eleccion) return true; if (eleccion.motivo.length < 4) throw new Error('motivo_requerido');
      ed.motivo = eleccion.motivo;
      const finanzas = { tipo: eleccion.tipo || 'error_registro' };
      if (finanzas.tipo === 'devolucion') {
        const dev = await c.confirmar({ titulo: 'Dinero ya devuelto al cliente', textoOk: 'Revisar devolución', campos: [
          { id: 'fecha', tipo: 'date', label: 'Fecha de la devolución', requerido: true },
          { id: 'medio', label: 'Medio utilizado', requerido: true }, { id: 'referencia', label: 'Referencia o comprobante', requerido: true }] });
        if (!dev) return true; Object.assign(finanzas, dev);
      }
      const pre = await preparar(t, ed, datos, finanzas); if (!pre) return true;
      if (!(await c.confirmar({ titulo: `Guardar revisión ${pre.candidato.revision}`, detalle: `${eleccion.motivo}\n${resumen(pre)}\nLa revisión anterior quedará en el historial.`, textoOk: 'Guardar revisión' }))) return true;
      const args = { p_tipo: t, p_id: String(ed.original.id), p_version: ed.original.revision || 1, p_datos: datos, p_motivo: eleccion.motivo,
        p_operacion: ed.operacion, p_huella: pre.huella, p_pdf_path: null, p_finanzas: finanzas };
      let pdf = null;
      if (t !== 'solicitud') {
        pdf = await blob(t, pre.candidato);
        args.p_pdf_path = `${c.usuario()}/documentos/${t}/${ed.original.id}/r${pre.candidato.revision}-${ed.operacion}.pdf`;
        const { error } = await c.sb.storage.from('vouchers-pdf').upload(args.p_pdf_path, pdf, { contentType: 'application/pdf' });
        if (error && String(error.statusCode) !== '409') throw new Error('pdf_requerido');
        if (t === 'voucher' && pre.candidato.reserva_id) args.p_adjunto = await c.prepararAdjunto(pre.candidato.reserva_id, pre.impacto.servicio_id, pdf, nombre(t, pre.candidato));
      }
      ed.pendiente = { args, pdf };
      let resultado;
      try { resultado = await rpc('documento_guardar', args); }
      catch (e) { if (e.datos) { ed.pendiente = null; ed.operacion = crypto.randomUUID(); } throw e; }
      await finalizar(t, ed, resultado, pdf);
    } catch (e) { c.error(mensaje(e)); }
    finally { ocupados.delete(`guardar-${t}`); if (t === 'solicitud' && ediciones.has(t)) c.abrir('boleteria-sheet'); }
    return true;
  }
  async function historial(t, id) {
    const h = await rpc('documento_historial', { p_tipo: t, p_id: String(id) }), d = h.actual;
    try { await c.prepararUsuarios?.(); } catch { /* el documento sigue disponible si no cargó el directorio */ }
    $('dr-historial-titulo').textContent = numero(t, d);
    const cuerpo = $('dr-historial-cuerpo');
    cuerpo.innerHTML = `<div class="vc-hecho"><b>${anulado(d) ? 'Anulado' : 'Versión vigente'}</b><span>${esc(d.cliente_nombre || d.cliente || '')}</span>${anulado(d) ? `<span>${esc(d.anulado_motivo || d.resultado || '')}</span>` : ''}${h.solicitud_modificada ? '<span>La solicitud cambió después de esta cotización. Revisa sus datos antes de volver a enviarla.</span>' : ''}<div class="lt-card-pie">${acciones(t, { ...d, es_mia: d.creado_por_id === c.usuario(), la_atiendo_yo: d.tomada_por_id === c.usuario() })}</div></div>`
      + (h.revisiones.length ? h.revisiones.map(r => `<article class="lt-card"><b>Revisión ${r.revision}${r.revision === d.revision ? ' · vigente' : ' · anterior'}</b><p>${esc(r.motivo)}</p><small>${esc(c.nombreUsuario(r.creado_por))} · ${esc(c.fecha(r.creado_en))}</small>${t !== 'solicitud' ? `<button class="btn-sm" type="button" data-dr-revision="${r.revision}">${r.pdf_path ? 'Ver PDF guardado' : 'Reconstruir PDF histórico'}</button>` : ''}<details><summary>Datos de esta revisión</summary>${datosHistoricos(t, r.datos)}</details></article>`).join('') : '<p>Esta es la primera versión. Las correcciones quedarán registradas aquí.</p>')
      + '<h3>Envíos y entregas</h3>' + (h.envios.map(e => `<p>${esc(c.fecha(e.creado_en))} · revisión ${e.revision} · ${esc(e.destinatario_nombre || ({ descarga: 'Descarga', compartir: 'Compartir' }[e.accion]) || 'Chat interno')}${e.accion === 'aviso_pendiente' && h.editable ? ` <button class="btn-sm" data-dr-aviso="${e.id}" type="button">Reintentar aviso al agente</button>` : ''}</p>`).join('') || '<p>Sin entregas registradas.</p>');
    cuerpo.querySelectorAll('[data-dr-aviso]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await rpc('documento_reintentar_aviso', { p_id: String(id), p_aviso_id: Number(b.dataset.drAviso) }); await historial(t, id); }
      catch (e) { c.error(mensaje(e)); } finally { b.disabled = false; }
    });
    cuerpo.querySelectorAll('[data-dr-revision]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { const r = h.revisiones.find(x => x.revision === Number(b.dataset.drRevision)); c.descargar(r.pdf_path ? await archivo(r.pdf_bucket, r.pdf_path) : await blob(t, r.datos), nombre(t, r.datos)); }
      catch (e) { c.error(mensaje(e)); } finally { b.disabled = false; }
    });
    c.abrir('dr-historial-sheet');
  }
  async function reenviarCotizacion(d) {
    const usuarios = c.destinatarios(), opciones = usuarios.filter(u => String(u.id) !== String(c.usuario())).map(u => ({ v: u.id, t: u.nombre }));
    const envio = await c.confirmar({ titulo: `Enviar ${numero('cotizacion', d)}`, textoOk: 'Enviar al asesor', campos: [
      { id: 'destinatario', tipo: 'select', label: 'Asesor destinatario', requerido: true, valor: d.enviado_a || '', opciones: [{ v: '', t: 'Selecciona al asesor' }, ...opciones] }] });
    if (!envio) return;
    await enviarCotizacion(d, envio.destinatario);
    c.ok('La revisión vigente se envió al asesor.'); await c.recargar('cotizacion');
  }
  async function enviarCotizacion(d, destinatario, pdf = null) {
    const clave = `${d.id}:${d.revision || 1}:${destinatario}`;
    let pend = enviosPendientes.get(clave);
    if (!pend) {
      const { data: conv, error } = await c.sb.rpc('obtener_o_crear_conversacion_directa', { p_otro_usuario_id: destinatario });
      if (error || !conv) throw new Error('No se pudo abrir el chat con ese asesor.');
      const op = crypto.randomUUID(), path = `${conv}/${op}-cotizacion.pdf`;
      const { error: up } = await c.sb.storage.from('chat-interno-adjuntos').upload(path, pdf || await pdfVigente('cotizacion', d), { contentType: 'application/pdf' });
      if (up) throw new Error('No se pudo guardar el adjunto para el asesor.');
      pend = { p_id: String(d.id), p_version: d.revision || 1, p_destinatario: destinatario, p_operacion: op, p_pdf_path: path }; enviosPendientes.set(clave, pend);
    }
    await rpc('documento_enviar_cotizacion', pend); enviosPendientes.delete(clave);
    return true;
  }
  async function accion(a, t, id) {
    if (a === 'historial') return historial(t, id);
    const h = await rpc('documento_historial', { p_tipo: t, p_id: String(id) }), d = h.actual;
    if (a === 'editar') return editar(t, d);
    if (a === 'anular' || (a === 'reenviar' && t === 'solicitud')) {
      if ($('dr-historial-sheet')?.classList.contains('open')) c.cerrar('dr-historial-sheet');
      const reabrir = a === 'reenviar';
      const motivo = await c.pedir({ titulo: `${reabrir ? 'Volver a enviar' : 'Anular'} ${numero(t, d)}`, requerido: true, tipo: 'textarea', label: 'Motivo (mínimo 4 caracteres)',
        detalle: reabrir ? 'Volverá al mismo agente si está disponible; en otro caso usará el reparto actual.' : 'Sale del listado activo y conserva su historial. Las reservas, facturas y pagos vinculados se conservan.', textoOk: reabrir ? 'Volver a enviar' : 'Anular', destructivo: !reabrir });
      if (motivo === null) return;
      const args = { p_id: String(id), p_version: d.revision || 1, p_motivo: motivo, p_operacion: crypto.randomUUID() };
      await rpc(reabrir ? 'documento_reabrir_solicitud' : 'documento_anular', reabrir ? args : { ...args, p_tipo: t });
      c.ok(reabrir ? 'Solicitud enviada de nuevo a la cola.' : 'Documento anulado; historial conservado.'); await c.recargar(t); return;
    }
    if (a === 'reenviar') return reenviarCotizacion(d);
    if (anulado(d)) throw new Error('documento_anulado');
    const pdf = await pdfVigente(t, d);
    if (a === 'compartir') {
      const file = new File([pdf], nombre(t, d), { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); } catch (e) { if (e.name === 'AbortError') return; throw e; } }
      else { c.descargar(pdf, nombre(t, d)); a = 'descarga'; c.ok('PDF descargado para adjuntarlo al cliente.'); }
    } else c.descargar(pdf, nombre(t, d));
    await rpc('documento_registrar_entrega', { p_tipo: t, p_id: String(id), p_version: d.revision || 1, p_accion: a, p_operacion: crypto.randomUUID() });
  }
  function setup() {
    if ($('dr-historial-sheet')) return;
    const sheet = document.createElement('div'); sheet.id = 'dr-historial-sheet'; sheet.className = 'sheet';
    sheet.innerHTML = '<div class="sheet-handle"></div><div class="sheet-title" id="dr-historial-titulo"></div><div id="dr-historial-cuerpo"></div><button class="dbtn" type="button">Cerrar</button>';
    sheet.lastElementChild.onclick = () => c.cerrar(sheet.id); document.body.appendChild(sheet);
    document.addEventListener('click', async e => {
      const b = e.target.closest('[data-dr]'); if (!b) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const clave = `${b.dataset.drTipo}:${b.dataset.drId}`; if (ocupados.has(clave)) return;
      ocupados.add(clave); b.disabled = true;
      try { await accion(b.dataset.dr, b.dataset.drTipo, b.dataset.drId); }
      catch (err) { c.error(mensaje(err)); } finally { ocupados.delete(clave); b.disabled = false; }
    }, true);
  }
  async function cargarComisiones() {
    const { data, error } = await c.sb.from('comision_ajustes').select('*,usuario:usuarios!comision_ajustes_usuario_id_fkey(nombre)').is('liquidacion_id', null).is('absorbido_en', null).order('creado_en', { ascending: false });
    for (const id of ['dr-comision-ajustes', 'dr-fact-ajustes']) {
      const el = $(id); if (!el) continue;
      el.hidden = !error && !data?.length;
      el.innerHTML = error ? 'No se pudieron consultar los ajustes pendientes.' : '<b>Ajustes para próximas liquidaciones</b>' + (data || []).map(a => `<p>${esc(a.usuario?.nombre || c.nombreUsuario(a.usuario_id))} · Voucher ${a.voucher_id}: <b>${money(a.importe)}</b> · ${esc(a.motivo)}</p>`).join('') + '<small>Los saldos negativos pendientes se arrastran hasta compensarse.</small>';
    }
  }
  async function cargarCreditos() {
    const el = $('dr-creditos-proveedor'); if (!el) return;
    try { const r = await rpc('documento_creditos_proveedor', {}); el.hidden = !r.items.length;
      el.innerHTML = '<b>Pagos a proveedores por conciliar</b>' + r.items.map(a => `<p>${esc(a.proveedor)} · Reserva ${esc(a.codigo)} · diferencia a favor: <b>${money(a.credito_por_conciliar)}</b>. Pagado conservado: ${money(a.monto_abonado)}.</p>`).join('');
    } catch (e) { el.hidden = false; el.textContent = mensaje(e); }
  }
  async function ejecutar(a, t, id) { try { await accion(a, t, id); } catch (e) { c.error(mensaje(e)); } }
  return { setup, acciones, puedeEditar, ejecutar, guardar, cancelar, edicion: t => ediciones.get(t)?.original || null, reenviarCotizacion, enviarCotizacion, pdfVigente, cargarComisiones, cargarCreditos };
}
