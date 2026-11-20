export function crearComisionesCortes(c) {
  const $ = id => document.getElementById(id), esc = c.esc, dinero = c.money;
  const fecha = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—';
  const numero = v => Number(v) || 0, suma = xs => xs.reduce((n, v) => n + numero(v.comision_total), 0);
  const normal = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const etiquetas = { verificada: 'Pendiente', liquidada: 'Liquidación emitida', pagada: 'Marcada pagada', rechazada: 'Rechazada', enviada: 'Por verificar', emitida: 'Pendiente', anulada: 'Anulada' };
  const errores = {
    version_desactualizada: 'Otra persona actualizó estas comisiones. Recarga y revisa el cambio antes de confirmar.',
    versiones_desactualizadas: 'Otra persona actualizó estas comisiones. Recarga y revisa el cambio antes de confirmar.',
    corte_pagado: 'Ese corte ya está marcado pagado. Elige otro día de pago.', corte_bloqueado: 'Llegó la hora de pago de ese corte. Ya no se puede mover.',
    plazo_vencido: 'Llegó la hora de pago de ese corte. Ya no se puede mover.', fecha_invalida: 'El día de pago debe ser el 5 o el 20 de un mes.',
    pago_el_invalido: 'El día de pago debe ser el 5 o el 20 de un mes.', motivo_requerido: 'Escribe el motivo del cambio.',
    saldo_no_positivo: 'El cambio dejaría una liquidación con saldo cero o negativo. Revisa sus ajustes antes de mover.',
    liquidacion_no_positiva: 'El cambio dejaría una liquidación con saldo cero o negativo. Revisa sus ajustes antes de mover.',
    sin_cambios: 'Las comisiones ya están en ese corte. Elige otro.', no_movible: 'Una comisión ya no está disponible para mover.',
    operacion_conflicto: 'Esta operación ya se usó para otro cambio. Recarga antes de continuar.',
    version_conflicto: 'Otra persona actualizó estas comisiones. Recarga y revisa el cambio antes de confirmar.',
    seleccion_invalida: 'Elige al menos una comisión disponible para mover.', venta_no_existe: 'Una comisión ya no existe. Actualiza antes de continuar.',
    venta_no_movible: 'Una comisión ya no está disponible para mover. Actualiza y revisa su estado.',
    destino_invalido: 'El día de pago debe ser el 5 o el 20 de un mes.', destino_vencido: 'Llegó la hora de pago del destino. Elige otro corte.', destino_fuera_de_rango: 'Solo se puede mover hasta 6 cortes atrás (unos 3 meses). Elige otro corte.',
    origen_vencido: 'Llegó la hora de pago del corte de origen. Ya no se puede mover.', destino_pagado: 'Ese pago de destino ya está marcado pagado. Elige otro corte.',
    destino_duplicado: 'Hay más de una liquidación activa para ese destino. Administración debe revisarlo antes de mover.',
    origen_neto_no_positivo: 'El origen quedaría con saldo cero o negativo. Revisa sus ajustes antes de mover.',
    destino_neto_no_positivo: 'El destino quedaría con saldo cero o negativo. Revisa sus ajustes antes de mover.',
    mismo_corte: 'Las comisiones ya están en ese corte. Elige otro.', motivo_invalido: 'Escribe un motivo de entre 5 y 1000 caracteres.',
    idempotencia_conflicto: 'Esta operación ya se usó para otro cambio. Recarga antes de continuar.',
    venta_no_pagada: 'Esta comisión ya no está marcada pagada. Actualiza para ver su estado.',
    liquidacion_inconsistente: 'La liquidación de esta comisión no está pagada o no coincide. Administración debe revisarla.',
    importe_no_positivo: 'Esta comisión no tiene importe a pagar; no hace falta deshacer el pago.'
  };
  let ventas = [], invoices = [], cortes = [], revision = [], seleccion = new Set(), activo = 'resumen', elegido = '';
  let carga = 0, reloj = null, relojLocal = 0, mover = null, wired = false, estado = 'pend', deshacerPend = {};
  const chip = e => `<span class="cm-estado" data-e="${esc(e)}">${esc(etiquetas[e] || e)}</span>`;
  const errorTexto = (r, fallback) => r?.error?.code === '42501' ? 'No tienes permiso para esta acción.' : errores[r?.data?.error] || fallback;
  const ahora = () => reloj ? Date.parse(reloj) + (performance.now() - relojLocal) : null;
  const plazo = d => Date.parse(`${d}T12:00:00-04:00`);
  const movible = v => c.office() && !!v.movible && ['verificada', 'liquidada'].includes(v.estado) && ahora() !== null && ahora() < plazo(v.pago_el);
  const errorHtml = texto => `<div class="cm-vacio" role="alert"><b>No pudimos cargar los cortes</b><p>${esc(texto)}</p><button class="btn-sm" type="button" data-cmc="recargar">Volver a intentar</button></div>`;
  const vacio = texto => `<div class="cm-vacio">${esc(texto)}</div>`;

  function setup() {
    if (wired) return;
    wired = true;
    $('cm-tab-ventas').textContent = 'Todas las comisiones';
    document.querySelector('#cm-tabs [data-cm-tab="resumen"]').textContent = 'Cortes';
    document.querySelectorAll('#cm-tabs [data-cm-rol]').forEach(b => { b.hidden = !b.dataset.cmRol.split(' ').includes(c.role()); });
    $('cm-f-vendedor').hidden = !c.office();
    $('cm-cortes-app').innerHTML = `<div class="cm-cabecera"><div><h2>Comisiones por corte</h2><p>Revisa lo que entra en cada pago${c.office() ? ' y ajusta las fechas acordadas' : ''}.</p></div><button class="btn-sm" type="button" data-cmc="recargar" aria-label="Actualizar cortes" title="Actualizar cortes"><span class="cm-recargar-icono" aria-hidden="true">↻</span> Actualizar</button></div>
      <div class="cm-calendario-nota"><i class="far fa-clock" aria-hidden="true"></i><span>Pagos el <b>5 y el 20</b>. Se marcan pagados automáticamente desde las <b>12:00 p. m., hora Caracas</b>. Este estado no confirma una transferencia bancaria.</span></div>
      <div id="cm-carga-estado" role="status" aria-live="polite"></div>
      <div class="cm-espacio"><aside class="cm-cortes-nav" aria-label="Cortes de pago"><label class="cm-selector-movil" for="cm-corte-movil">Corte de pago<select class="ei" id="cm-corte-movil"></select></label><div id="cm-cortes-lista"></div></aside><div id="cm-corte-detalle" class="cm-corte-detalle"></div></div>`;
    document.querySelector('#sec-comisiones [data-cm-panel="ventas"]').insertAdjacentHTML('beforeend', '<div id="cm-todas-seleccion"></div>');
    $('cm-f-estado').addEventListener('click', e => { const b = e.target.closest('[data-cm-est]'); if (b) { estado = b.dataset.cmEst; seleccion.clear(); renderTodas(); } });
    ['cm-f-corte', 'cm-f-vendedor'].forEach(id => $(id).addEventListener('change', () => { seleccion.clear(); renderTodas(); }));
    $('cm-buscar').addEventListener('input', () => { seleccion.clear(); renderTodas(); });
    $('cm-corte-movil').addEventListener('change', e => elegir(e.target.value));
    $('cm-tabs').addEventListener('click', e => { const b = e.target.closest('[data-cm-tab]'); if (b && !b.hidden) tab(b.dataset.cmTab); });
    $('sec-comisiones').addEventListener('click', click);
    $('sec-comisiones').addEventListener('change', change);
    const cfg = document.querySelector('#sec-comisiones [data-cm-panel="config"]');
    cfg.addEventListener('change', c.configChange); cfg.addEventListener('click', c.configClick);
    $('cm-mover-form').addEventListener('submit', aplicar);
    $('cm-mover-destino').addEventListener('change', () => { $('cm-mover-fecha-wrap').hidden = $('cm-mover-destino').value !== 'otra'; preparar(); });
    $('cm-mover-fecha').addEventListener('change', preparar);
    $('cm-mover-motivo').addEventListener('input', habilitarConfirmar);
    $('cm-mover-cancelar').addEventListener('click', cerrarMovimiento);
    $('cm-mover-dialog').addEventListener('cancel', e => { if (mover?.enviando) e.preventDefault(); else mover = null; });
  }
  function tab(t) {
    activo = t === 'invoices' ? 'resumen' : t;
    c.tabChanged?.(activo);
    seleccion.clear();
    document.querySelectorAll('#cm-tabs [data-cm-tab]').forEach(b => { b.classList.toggle('on', b.dataset.cmTab === activo); b.setAttribute('aria-pressed', String(b.dataset.cmTab === activo)); });
    document.querySelectorAll('#sec-comisiones [data-cm-panel]').forEach(p => { p.style.display = p.dataset.cmPanel === activo ? '' : 'none'; });
    if (activo === 'config') { if (c.role() === 'admin') c.config(); return; }
    return load();
  }
  async function load() {
    const turno = ++carga;
    $('cm-carga-estado').textContent = 'Actualizando cortes…';
    const root = $('cm-cortes-app'); root.setAttribute('aria-busy', 'true');
    try {
      const [v, l, cr, rv] = await Promise.all([c.rpc('comision_ventas_listar'), c.rpc('comision_liquidaciones_listar'), c.rpc('comision_cortes_listar'), c.office() ? c.rpc('comision_sin_venta_listar') : Promise.resolve({ data: [] })]);
      if (turno !== carga) return;
      if (v.error || l.error || cr.error || cr.data?.ok === false || !cr.data?.ahora) throw new Error('Revisa tu conexión. Si el problema continúa, consulta con administración.');
      ventas = v.data || []; invoices = l.data || []; cortes = cr.data?.cortes || []; revision = rv.error ? null : rv.data || [];
      reloj = cr.data.ahora; relojLocal = performance.now();
      seleccion = new Set([...seleccion].filter(id => ventas.some(x => x.id === id && movible(x))));
      const fechas = fechasDisponibles();
      if (!fechas.includes(elegido)) elegido = fechas.find(d => ventas.some(v => v.pago_el === d && ['verificada', 'liquidada'].includes(v.estado))) || fechas.at(-1) || '';
      filtros(); renderCortes(); renderTodas(); renderRevision(); c.adjustments?.();
      $('cm-carga-estado').textContent = '';
    } catch (e) {
      if (turno !== carga) return;
      seleccion.clear(); reloj = null;
      $('cm-corte-detalle').innerHTML = errorHtml(e.message || 'Revisa la conexión e intenta de nuevo.');
      $('cm-ventas-lista').innerHTML = errorHtml('Revisa la conexión e intenta de nuevo.');
      $('cm-carga-estado').textContent = 'Los datos no se actualizaron. No se pueden mover comisiones hasta recargar.';
    } finally { if (turno === carga) root.removeAttribute('aria-busy'); }
  }
  const fechasDisponibles = () => [...new Set([...cortes.map(x => x.pago_el), ...ventas.filter(x => x.estado !== 'rechazada').map(x => x.pago_el), ...invoices.filter(x => x.estado !== 'anulada').map(x => x.pago_el)])].sort();
  function resumen(d) {
    const vs = ventas.filter(v => v.pago_el === d && v.estado !== 'rechazada'), ls = invoices.filter(l => l.pago_el === d && l.estado !== 'anulada');
    const r = cortes.find(x => x.pago_el === d) || {}, ajustes = numero(r.ajustes_total);
    const cerrado = r.cierra_en ? ahora() >= Date.parse(r.cierra_en) : ls.length > 0;
    return { vs, ls, ajustes, total: r.total != null ? numero(r.total) : suma(vs) + ajustes, estado: vs.length && vs.every(v => v.estado === 'pagada') && ls.every(l => l.estado === 'pagada') ? 'pagada' : cerrado ? 'emitida' : 'verificada', cerrado, r };
  }
  function elegir(d) { elegido = d; seleccion.clear(); renderCortes(); }
  function renderCortes() {
    const fechas = fechasDisponibles();
    $('cm-corte-movil').innerHTML = fechas.map(d => `<option value="${esc(d)}"${d === elegido ? ' selected' : ''}>Pago del ${fecha(d)}</option>`).join('');
    $('cm-cortes-lista').innerHTML = [...fechas].reverse().map(d => { const r = resumen(d); return `<button class="cm-corte-op${d === elegido ? ' on' : ''}" type="button" data-cmc-corte="${esc(d)}" aria-pressed="${d === elegido}"><span>Pago del <b>${fecha(d)}</b></span><strong>${dinero(r.total)}</strong><small>${r.vs.length} comisiones · ${r.estado === 'pagada' ? 'Marcado pagado' : r.cerrado ? 'Corte cerrado' : 'En curso'}</small></button>`; }).join('') || vacio('Todavía no hay cortes con comisiones.');
    if (!elegido) { $('cm-corte-detalle').innerHTML = vacio('Las comisiones aparecerán aquí cuando las reservas estén completamente pagadas.'); return; }
    const r = resumen(elegido), pendientes = r.vs.filter(v => ['verificada', 'liquidada'].includes(v.estado));
    $('cm-corte-detalle').innerHTML = `<div class="cm-detalle-cab"><div><h3>Pago del ${fecha(elegido)}</h3><p>${r.estado === 'pagada' ? `Histórico protegido. Las comisiones pagadas no se pueden mover${c.office() ? '; si una no se pagó, usa «Deshacer pago»' : ''}.` : r.cerrado ? 'Corte cerrado. Puedes ajustar comisiones hasta la hora de pago.' : 'Corte en curso. Las comisiones se liquidan al cerrar el período.'}</p></div>${chip(r.estado)}</div>
      <div class="cm-cuenta"><span>Comisiones <b>${dinero(suma(r.vs))}</b></span><span>Ajustes <b>${dinero(r.ajustes)}</b></span><span>Total del corte <strong>${dinero(r.total)}</strong></span></div>
      <div class="cm-tabla-barra"><h4>${r.vs.length} comisiones${pendientes.length ? ` · ${pendientes.length} pendientes` : ''}</h4>${c.office() ? '<button type="button" class="btn-sm" data-cmc="seleccionar">Seleccionar disponibles</button>' : ''}</div>
      <div class="cm-filas">${r.vs.map(fila).join('') || vacio('No hay comisiones en este corte.')}</div><div id="cm-corte-seleccion"></div>
      <div class="cm-liquidaciones"><h4>Liquidaciones por persona</h4>${r.ls.map(liquidacion).join('') || '<p class="cm-nota">La liquidación se genera al cerrar el corte, si el saldo a pagar es positivo.</p>'}</div>`;
    renderSeleccion();
  }
  function fila(v) {
    const puede = movible(v), movs = v.movimientos || [];
    return `<article class="cm-fila${seleccion.has(v.id) ? ' seleccionada' : ''}" data-cmc-fila="${v.id}">
      ${c.office() ? `<label class="cm-elegir"><input type="checkbox" data-cmc-check="${v.id}" aria-label="Seleccionar comisión de ${esc(v.cliente_nombre || v.reserva_codigo || v.id)}"${seleccion.has(v.id) ? ' checked' : ''}${puede ? '' : ' disabled'}><span class="sr-only">Seleccionar</span></label>` : ''}
      <div class="cm-fila-identidad"><b>${esc(v.cliente_nombre || 'Sin nombre')}</b><span>${v.reserva_codigo ? `<button class="cm-reserva-link" type="button" data-cmc-reserva="${v.reserva_id}" data-cmc-codigo="${esc(v.reserva_codigo)}">${esc(v.reserva_codigo)}</button> · ` : ''}${esc(v.destino || v.modalidad || 'Servicio')}</span><small>${c.office() ? esc(v.vendedor || 'Sin vendedor') + ' · ' : ''}Pago ${fecha(v.pago_el)}${v.corte_manual ? ' · Fecha acordada' : ''}</small></div>
      <div class="cm-fila-importe"><b>${dinero(v.comision_total)}</b>${chip(v.estado)}</div>
      <div class="cm-fila-acciones">${puede ? `<button type="button" class="btn-sm" data-cmc-mover="${v.id}"><i class="fas fa-arrow-right-arrow-left" aria-hidden="true"></i> Mover a otro corte</button>` : ''}${c.office() && v.estado === 'pagada' ? `<button type="button" class="btn-sm" data-cmc-deshacer="${v.id}"><i class="fas fa-rotate-left" aria-hidden="true"></i> Deshacer pago</button>` : ''}${c.office() && v.estado === 'verificada' && !v.liquidacion_id ? `<button type="button" class="btn-sm cm-icono" data-cmc-rechazar="${v.id}" aria-label="Rechazar comisión de ${esc(v.cliente_nombre)}" title="Rechazar comisión"><i class="fas fa-ban" aria-hidden="true"></i></button>` : ''}</div>
      ${movs.length ? `<details class="cm-movimientos"><summary>Historial de cambios (${movs.length})</summary>${movs.map(m => `<div><b>${fecha(m.pago_el_anterior)} → ${fecha(m.pago_el_nuevo)}</b><p>${esc(m.motivo)}</p><small>${esc(m.autor || 'Administración')} · ${esc(new Date(m.creado_en).toLocaleString('es-VE', { timeZone: 'America/Caracas' }))}</small></div>`).join('')}</details>` : ''}
      ${!puede && c.office() && ['verificada', 'liquidada'].includes(v.estado) ? '<small class="cm-fila-bloqueo">No disponible para mover: llegó la hora de pago o el corte está protegido.</small>' : ''}
    </article>`;
  }
  function liquidacion(l) {
    const actualizada = numero(l.version) > 1 && !l.enviada_telegram_en && !l.enviada_correo_en;
    return `<div class="cm-liquidacion"><div><b>${esc(l.vendedor || 'Liquidación')}</b> ${chip(l.estado)}<small>${esc(l.numero || '')} · Revisión ${numero(l.version) || 1}${actualizada ? ' · Actualizada · pendiente de reenvío' : ''}</small></div><strong>${dinero(l.total)}</strong><div class="cm-liq-acciones"><button class="btn-sm" type="button" data-cmc-pdf="${l.id}"><i class="far fa-file-pdf" aria-hidden="true"></i> Ver PDF vigente</button><button class="btn-sm" type="button" data-cmc-desglose="${l.id}">Ver ajustes</button>${c.office() && l.estado !== 'anulada' ? `<button class="btn-sm" type="button" data-cmc-enviar="${l.id}">${actualizada ? 'Reenviar revisión' : 'Enviar PDF'}</button>` : ''}${c.office() && l.estado === 'emitida' ? `<button class="btn-sm" type="button" data-cmc-pagar="${l.id}">Marcar pagado ahora</button>` : ''}</div><div id="cm-liq-detalle-${l.id}" class="cm-liq-desglose" hidden></div></div>`;
  }
  function filtros() {
    const pagos = $('cm-f-corte'), vend = $('cm-f-vendedor'), pago = pagos.value, vendedor = vend.value;
    pagos.innerHTML = '<option value="">Todos los cortes</option>' + [...new Set(ventas.map(v => v.pago_el))].sort().reverse().map(d => `<option value="${esc(d)}">Pago del ${fecha(d)}</option>`).join('');
    vend.innerHTML = '<option value="">Todas las personas</option>' + [...new Map(ventas.map(v => [v.usuario_id, v.vendedor])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]))).map(([id, nombre]) => `<option value="${esc(id)}">${esc(nombre || 'Sin nombre')}</option>`).join('');
    pagos.value = pago; vend.value = vendedor;
  }
  function filtradas() {
    const q = normal($('cm-buscar').value);
    return ventas.filter(v => (!estado || (estado === 'pend' ? ['verificada', 'liquidada'].includes(v.estado) : v.estado === estado)) && (!$('cm-f-corte').value || v.pago_el === $('cm-f-corte').value) && (!$('cm-f-vendedor').value || v.usuario_id === $('cm-f-vendedor').value) && (!q || normal([v.cliente_nombre, v.reserva_codigo, v.destino, v.vendedor].join(' ')).includes(q)));
  }
  function renderTodas() {
    const vs = filtradas();
    $('cm-ventas-lista').classList.add('cm-todas-filas');
    $('cm-ventas-lista').innerHTML = vs.map(fila).join('') || vacio('No hay comisiones con estos filtros. Cambia el corte, el estado o la búsqueda.');
    $('cm-ventas-n').textContent = `${vs.length} comisiones · ${dinero(suma(vs))}`;
    document.querySelectorAll('#cm-f-estado [data-cm-est]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cmEst === estado)));
    renderSeleccion();
  }
  function renderSeleccion() {
    const elegidas = ventas.filter(v => seleccion.has(v.id)), html = elegidas.length ? `<div class="cm-seleccion-barra" role="status"><span><b>${elegidas.length} seleccionadas</b> · ${dinero(suma(elegidas))}</span><button type="button" class="btn-sm" data-cmc="limpiar">Quitar selección</button><button type="button" class="btn-sm cm-primario" data-cmc="mover">Mover a otro corte <i class="fas fa-arrow-right" aria-hidden="true"></i></button></div>` : '';
    if ($('cm-corte-seleccion')) $('cm-corte-seleccion').innerHTML = activo === 'resumen' ? html : '';
    $('cm-todas-seleccion').innerHTML = activo === 'ventas' ? html : '';
    document.querySelectorAll('[data-cmc-check]').forEach(i => { i.checked = seleccion.has(Number(i.dataset.cmcCheck)); i.closest('.cm-fila').classList.toggle('seleccionada', i.checked); });
  }
  function renderRevision() {
    const root = $('cm-aviso-sin-venta');
    if (!c.office()) { root.innerHTML = ''; return; }
    if (revision === null) { root.innerHTML = '<p class="cm-nota" role="status">No pudimos cargar «Por revisar». Actualiza para volver a intentarlo.</p>'; return; }
    const pendientes = revision.filter(r => !['rechazada', 'gemela'].includes(r.motivo)), excluidas = revision.filter(r => ['rechazada', 'gemela'].includes(r.motivo));
    const item = r => `<div class="cm-sv-fila"><div><b>${esc(r.reserva_codigo || '#' + r.reserva_id)} · ${esc(r.cliente || '')}</b><small>${esc(({ sin_vendedor: 'Sin vendedor elegible', gemela: 'Reserva duplicada excluida', rechazada: 'Comisión rechazada', sin_comision: 'Sin comisión generada' })[r.motivo] || 'Requiere revisión')}</small></div><button class="btn-sm" type="button" data-cmc-reserva="${r.reserva_id}" data-cmc-codigo="${esc(r.reserva_codigo || '')}">Ver reserva</button></div>`;
    root.innerHTML = `${pendientes.length ? `<details class="cm-aviso"><summary><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> Por revisar · ${pendientes.length} reservas pagadas sin comisión</summary>${pendientes.map(item).join('')}</details>` : ''}${excluidas.length ? `<details class="cm-excluidas"><summary>Excluidas de comisión (${excluidas.length})</summary>${excluidas.map(item).join('')}</details>` : ''}`;
  }
  function change(e) { const check = e.target.closest('[data-cmc-check]'); if (check) { const id = Number(check.dataset.cmcCheck); check.checked ? seleccion.add(id) : seleccion.delete(id); renderSeleccion(); } }
  function click(e) {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.cmcCorte) { elegir(b.dataset.cmcCorte); return; }
    if (b.dataset.cmcReserva) { c.reservation(Number(b.dataset.cmcReserva), b.dataset.cmcCodigo, b); return; }
    if (b.dataset.cmcMover) { abrirMovimiento([Number(b.dataset.cmcMover)]); return; }
    if (b.dataset.cmcRechazar) { rechazar(Number(b.dataset.cmcRechazar)); return; }
    if (b.dataset.cmcDeshacer) { deshacerPago(Number(b.dataset.cmcDeshacer), b); return; }
    if (b.dataset.cmcPdf) { documento(Number(b.dataset.cmcPdf), 'ver', b); return; }
    if (b.dataset.cmcEnviar) { documento(Number(b.dataset.cmcEnviar), 'enviar', b); return; }
    if (b.dataset.cmcDesglose) { desglose(Number(b.dataset.cmcDesglose), b); return; }
    if (b.dataset.cmcPagar) { pagar(Number(b.dataset.cmcPagar)); return; }
    if (b.dataset.cmc === 'recargar') load();
    if (b.dataset.cmc === 'mover') abrirMovimiento([...seleccion]);
    if (b.dataset.cmc === 'limpiar') { seleccion.clear(); renderSeleccion(); }
    if (b.dataset.cmc === 'seleccionar') { resumen(elegido).vs.filter(movible).forEach(v => seleccion.add(v.id)); renderSeleccion(); }
  }
  async function rechazar(id) {
    const r = await c.confirm({ titulo: 'Rechazar comisión', detalle: 'El vendedor verá el motivo. Esta venta quedará fuera del pago.', textoOk: 'Rechazar', destructivo: true, campos: [{ id: 'motivo', tipo: 'textarea', label: 'Motivo', requerido: true }] });
    if (!r) return;
    const res = await c.rpc('comision_venta_rechazar', { p_id: id, p_motivo: r.motivo });
    if (res.error || !res.data?.ok) { c.error(errorTexto(res, 'No se pudo rechazar la comisión. Actualiza e intenta de nuevo.')); return; }
    c.success('Comisión rechazada'); await load();
  }
  // La comisión sale de su liquidación pagada (el total baja; el PDF anterior se conserva) y pasa a un corte cuya hora de pago no llegó.
  async function deshacerPago(id, boton) {
    const v = ventas.find(x => x.id === id && x.estado === 'pagada');
    if (!c.office() || !v || ahora() === null) { c.error('Esta comisión ya no está marcada pagada. Actualiza para revisar su estado.'); return; }
    const futuros = opcionesDestino().opciones.filter(d => ahora() < plazo(d)).sort();
    if (!futuros.length) { c.error('No hay un corte próximo disponible. Actualiza e intenta de nuevo.'); return; }
    const liq = invoices.find(l => l.id === v.liquidacion_id), pend = deshacerPend[id];
    const r = await c.confirm({ titulo: 'Deshacer pago de comisión', destructivo: true, textoOk: 'Deshacer pago',
      detalle: `${v.cliente_nombre || 'Comisión'} · ${dinero(v.comision_total)} · Pago del ${fecha(v.pago_el)}. Volverá a quedar pendiente en el corte que elijas.${liq ? ` La liquidación ${liq.numero || ''} pasa de ${dinero(liq.total)} a ${dinero(numero(liq.total) - numero(v.comision_total))}; su PDF anterior se conserva.` : ''} No se envía ninguna notificación.`,
      campos: [{ id: 'destino', label: 'Nuevo día de pago', tipo: 'select', requerido: true, valor: pend?.payload.p_pago_el || futuros[0], opciones: futuros.map(d => ({ v: d, t: `Pago del ${fecha(d)}` })) },
        { id: 'motivo', tipo: 'textarea', label: 'Motivo', requerido: true, valor: pend?.payload.p_motivo || '' }] });
    if (!r) return;
    const motivo = String(r.motivo || '').trim();
    if (motivo.length < 5) { c.error(errores.motivo_invalido); return; }
    const payload = { p_id: id, p_pago_el: r.destino, p_motivo: motivo, p_version: v.version, p_operacion_id: crypto.randomUUID() };
    if (pend && pend.payload.p_pago_el === payload.p_pago_el && pend.payload.p_motivo === motivo) payload.p_operacion_id = pend.payload.p_operacion_id;
    deshacerPend[id] = { payload }; boton.disabled = true;
    try {
      const res = await c.rpc('comision_venta_deshacer_pago', payload);
      if (res.error && !res.error.code?.startsWith('PGRST') && res.error.code !== '42501') throw new Error('conexión');
      delete deshacerPend[id];
      if (res.error || !res.data?.ok) { c.error(errorTexto(res, 'No se deshizo el pago. Actualiza y revisa la comisión.')); return; }
      elegido = r.destino; c.success(`Pago deshecho. La comisión quedó en el pago del ${fecha(r.destino)}.`); await load();
    } catch { c.error('No pudimos confirmar la respuesta. Vuelve a «Deshacer pago» con el mismo día y motivo: no se duplicará.'); }
    finally { if (boton.isConnected) boton.disabled = false; }
  }
  // Destinos: los últimos 6 cortes (hoy incluido, aunque ya esté pagado) + los 6 próximos (más lejos: «otra fecha»). La BD aplica el mismo límite hacia atrás.
  function opcionesDestino() {
    const base = new Date(reloj), hoy = new Date(ahora() - 4 * 3600e3).toISOString().slice(0, 10), dias = new Set(fechasDisponibles());
    for (let i = -4; i <= 18; i++) for (const d of [5, 20]) dias.add(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + i, d)).toISOString().slice(0, 10));
    const todos = [...dias].filter(d => /-(05|20)$/.test(d)).sort().reverse(), pasados = todos.filter(d => d <= hoy).slice(0, 6);
    return { opciones: [...todos.filter(d => d > hoy).slice(-6), ...pasados], actual: pasados[0] };
  }
  function abrirMovimiento(ids) {
    if (!c.office() || !ids.length || ids.some(id => !ventas.some(v => v.id === id && movible(v)))) { c.error('Estas comisiones ya no se pueden mover. Actualiza para revisar el estado.'); return; }
    mover = { ids: [...ids].sort((a, b) => a - b), operacion: crypto.randomUUID(), preparado: null, secuencia: 0, enviando: false, intento: false };
    const vs = ventas.filter(v => ids.includes(v.id));
    $('cm-mover-resumen').textContent = `${vs.length} comisiones · ${dinero(suma(vs))}. Se conserva el importe y el vendedor.`;
    const { opciones, actual } = opcionesDestino();
    $('cm-mover-destino').innerHTML = '<option value="">Elige el día de pago</option>' + opciones.map(d => `<option value="${esc(d)}">Pago del ${fecha(d)}${d === actual ? ' · corte actual' : ''}${vs.every(v => v.pago_el === d) ? ' · origen' : ''}</option>`).join('') + '<option value="otra">Elegir otra fecha…</option>';
    $('cm-mover-fecha-wrap').hidden = true; $('cm-mover-fecha').value = ''; $('cm-mover-motivo').value = '';
    $('cm-mover-impacto').innerHTML = '<p class="cm-nota">Elige un destino para comparar los totales antes de confirmar.</p>';
    $('cm-mover-error').textContent = ''; $('cm-mover-ok').disabled = true; $('cm-mover-ok').textContent = 'Confirmar cambio de corte';
    ['cm-mover-destino', 'cm-mover-fecha', 'cm-mover-motivo', 'cm-mover-cancelar'].forEach(id => { $(id).disabled = false; });
    $('cm-mover-dialog').showModal();
  }
  function cerrarMovimiento() { if (mover?.enviando) return; mover = null; $('cm-mover-dialog').close(); }
  const destino = () => $('cm-mover-destino').value === 'otra' ? $('cm-mover-fecha').value : $('cm-mover-destino').value;
  async function preparar() {
    if (!mover || mover.enviando || mover.intento) return;
    const actual = mover, orden = ++actual.secuencia, pago = destino();
    actual.preparado = null; habilitarConfirmar(); $('cm-mover-error').textContent = '';
    if (!pago) { $('cm-mover-impacto').innerHTML = '<p class="cm-nota">Elige un destino para comparar los totales.</p>'; return; }
    if (!/^\d{4}-\d{2}-(05|20)$/.test(pago)) { $('cm-mover-error').textContent = 'El día de pago debe ser el 5 o el 20 de un mes.'; return; }
    $('cm-mover-impacto').textContent = 'Calculando el cambio…';
    try {
      const res = await c.rpc('comision_cambio_corte_preparar', { p_ids: actual.ids, p_pago_el: pago });
      if (mover !== actual || orden !== actual.secuencia) return;
      if (res.error || !res.data?.ok) { $('cm-mover-impacto').innerHTML = ''; $('cm-mover-error').textContent = errorTexto(res, 'No se puede usar este destino. Puede estar pagado o bloqueado; actualiza y revisa el corte.'); return; }
      actual.preparado = { ...res.data, pago };
      $('cm-mover-impacto').innerHTML = `<h3>Así quedarán los pagos</h3><div class="cm-impacto-cab"><span>Persona y corte</span><span>Antes</span><span>Después</span></div>${(res.data.impactos || []).map(x => `<div class="cm-impacto-fila"><span><b>${esc(x.vendedor || 'Vendedor')}</b><small>Pago del ${fecha(x.pago_el)}</small></span><span>${dinero(x.antes)}</span><strong>${dinero(x.despues)}</strong></div>`).join('')}${res.data.destino?.vencido ? `<p class="cm-nota"><b>Ese pago ya pasó: estas comisiones quedan como pagadas.</b>${(res.data.impactos || []).some(x => x.queda_pagada) ? ' La liquidación ya pagada no cambia; se registran como pagadas aparte.' : ''}</p>` : ''}<p class="cm-nota">Las liquidaciones afectadas se actualizan. Los PDF anteriores se conservan y no se enviará ninguna notificación.</p>`;
      habilitarConfirmar();
    } catch { if (mover === actual && orden === actual.secuencia) { $('cm-mover-error').textContent = 'No pudimos calcular el cambio. Revisa la conexión y elige de nuevo el destino.'; $('cm-mover-impacto').innerHTML = ''; } }
  }
  function habilitarConfirmar() { $('cm-mover-ok').disabled = !mover?.preparado || mover.enviando || $('cm-mover-motivo').value.trim().length < 5; }
  async function aplicar(e) {
    e.preventDefault();
    if (!mover?.preparado || mover.enviando || $('cm-mover-motivo').value.trim().length < 5) return;
    const actual = mover, p = actual.preparado;
    if (!actual.payload) actual.payload = { p_ids: actual.ids, p_pago_el: p.pago, p_motivo: $('cm-mover-motivo').value.trim(), p_versiones: p.versiones, p_operacion_id: actual.operacion };
    actual.enviando = true; actual.intento = true; habilitarConfirmar();
    ['cm-mover-destino', 'cm-mover-fecha', 'cm-mover-motivo', 'cm-mover-cancelar'].forEach(id => { $(id).disabled = true; });
    $('cm-mover-ok').textContent = 'Guardando cambio…'; $('cm-mover-error').textContent = '';
    try {
      const res = await c.rpc('comision_cambio_corte_aplicar', actual.payload);
      if (res.error || !res.data?.ok) {
        if (res.error && !res.error.code?.startsWith('PGRST') && res.error.code !== '42501') throw new Error('conexión');
        actual.preparado = null; actual.intento = false; actual.payload = null; actual.operacion = crypto.randomUUID();
        $('cm-mover-error').textContent = errorTexto(res, 'No se aplicó el cambio. Cierra esta ventana, actualiza y revisa las comisiones.');
        return;
      }
      elegido = p.pago; seleccion.clear(); mover = null; $('cm-mover-dialog').close(); c.success(res.data.destino?.vencido ? 'Comisiones movidas y marcadas como pagadas en ese corte.' : 'Comisiones movidas. Las liquidaciones se actualizaron sin enviar notificaciones.'); await load();
    } catch {
      $('cm-mover-error').textContent = 'No pudimos confirmar la respuesta. Reintenta con este mismo botón: no se duplicará el cambio. No cambies el destino ni el motivo hasta verificar el resultado.';
    } finally {
      actual.enviando = false;
      ['cm-mover-destino', 'cm-mover-fecha', 'cm-mover-motivo'].forEach(id => { $(id).disabled = actual.intento; });
      $('cm-mover-cancelar').disabled = false;
      $('cm-mover-ok').textContent = actual.intento ? 'Reintentar el mismo cambio' : 'Confirmar cambio de corte';
      if (mover === actual) habilitarConfirmar();
    }
  }
  async function documento(id, accion, boton) {
    const l = invoices.find(x => x.id === id); if (!l) return;
    if (accion === 'enviar' && !await c.confirm({ titulo: numero(l.version) > 1 ? 'Reenviar la revisión vigente' : 'Enviar PDF de comisión', detalle: `${l.vendedor || ''} · Pago del ${fecha(l.pago_el)} · Revisión ${l.version || 1}. Se enviará por los canales disponibles que todavía no tengan esta revisión registrada.`, textoOk: 'Enviar PDF' })) return;
    const ventana = accion === 'ver' ? window.open('', '_blank') : null;
    if (ventana) { ventana.opener = null; ventana.document.title = 'Preparando PDF vigente'; ventana.document.body.textContent = 'Preparando la revisión vigente del PDF…'; }
    boton.disabled = true;
    try {
      const res = await c.invoice({ accion, id, version: l.version || 1 });
      if (!res.data && res.error?.context?.json) { try { res.data = await res.error.context.json(); } catch { /* El transporte puede no tener un cuerpo JSON. */ } }
      if (res.error || res.data?.ok === false) {
        const estados = { enviado: 'entregado y registrado', ya_enviado: 'ya registrado', fallido: 'falló; puedes reintentar', enviado_sin_registrar: 'entregado sin registro; verifica antes de reenviar', sin_destino: 'sin destino configurado', pendiente: 'pendiente' };
        const canales = Object.entries(res.data?.canales || {}).map(([nombre, x]) => `${nombre === 'telegram' ? 'Telegram' : 'Correo'}: ${estados[x.estado] || (x.registrado ? 'registrado' : x.entregado ? 'entregado; verifica el registro' : 'no completado')}`).join('. ');
        if (accion === 'enviar') await load();
        throw new Error((errores[res.data?.error] || (accion === 'ver' ? 'No se pudo preparar el PDF vigente. Intenta de nuevo; el cambio de corte ya está guardado.' : 'No se completó el envío. Los canales ya registrados no se repetirán.')) + (canales ? ` ${canales}.` : ''));
      }
      if (accion === 'ver') {
        const url = new URL(res.data?.url); if (url.protocol !== 'https:') throw new Error('No se recibió una dirección segura para el PDF.');
        if (ventana) ventana.location.replace(url.href); else { const a = document.createElement('a'); a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Abrir PDF vigente'; boton.insertAdjacentElement('afterend', a); c.success('PDF listo. Usa el enlace «Abrir PDF vigente».'); }
      } else { c.success('Envío procesado. Revisa el estado de los canales.'); await load(); }
    } catch (err) { ventana?.close(); c.error(err.message); } finally { if (boton.isConnected) boton.disabled = false; }
  }
  async function desglose(id, boton) {
    const root = $(`cm-liq-detalle-${id}`); if (!root.hidden) { root.hidden = true; boton.textContent = 'Ver ajustes'; return; }
    root.hidden = false; root.textContent = 'Cargando ajustes…'; boton.disabled = true;
    try {
      const r = await c.rpc('comision_liquidacion_detalle', { p_id: id });
      if (r.error || r.data?.ok === false) throw new Error();
      root.innerHTML = (r.data?.ajustes || []).map(a => `<div><span>${esc(a.motivo || 'Ajuste de comisión')}</span><b>${dinero(a.importe)}</b></div>`).join('') || '<p class="cm-nota">Esta liquidación no tiene ajustes.</p>';
      boton.textContent = 'Ocultar ajustes';
    } catch { root.textContent = 'No se pudieron cargar los ajustes. Cierra el desglose e intenta de nuevo.'; } finally { boton.disabled = false; }
  }
  async function pagar(id) {
    const l = invoices.find(x => x.id === id);
    if (!l || !await c.confirm({ titulo: '¿Marcar pagado antes del automático?', detalle: `${dinero(l.total)} · ${l.vendedor || ''} · Pago del ${fecha(l.pago_el)}. Se bloquearán los cambios de corte de sus comisiones. Este estado no confirma una transferencia bancaria.`, textoOk: 'Marcar pagado ahora' })) return;
    const r = await c.rpc('comision_liquidacion_marcar_pagada', { p_id: id });
    if (r.error || !r.data?.ok) { c.error('No se pudo marcar pagado. Actualiza antes de intentar de nuevo.'); return; }
    c.success('Liquidación marcada pagada'); await load();
  }
  return { setup, tab, load };
}
