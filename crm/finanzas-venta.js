// Drawer de una venta (Finanzas › Ventas, v2 2026-11-26): cliente y viajeros, cobro con sus
// comprobantes, pago a cada proveedor (con asignación del que falta), documentos, comisión e
// historia de la venta. «Pagar» abre la hoja de Pagos a proveedores; reserva, cliente, PDF y
// anular los resuelve app.js.
// Datos: venta_finanzas_detalle v2 (servicios + CxP + pagos + pasajeros + comisión + documentos)
// y reserva_abonos_lista.
export function crearFinanzasVenta(c) {
  const { sb, esc, money } = c;
  let actual = null, pedido = 0, provs = null;
  const n = v => Number(v) || 0;
  const fecha = iso => iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
  const corta = iso => iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) : '';
  const pct = (a, b) => b > 0 ? Math.max(0, Math.min(100, Math.floor(a / b * 100))) : 0;
  const iniciales = t => String(t || '').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '#';
  const barra = (p, col, lbl) => `<div class="lt-barra" style="--c:${col}" role="progressbar" aria-label="${lbl}" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div>`;
  const btn = (acc, ic, t, extra = '', cls = '') => `<button type="button" class="vt-accion${cls}" data-vd="${acc}"${extra}><i class="${ic.startsWith('fab') ? ic : 'fas ' + ic}"></i> ${esc(t)}</button>`;
  const peq = (acc, ic, t, extra = '', cls = '') => btn(acc, ic, t, extra, ' vd-peq' + cls);
  // Panel universal (panel-universal.js): filas que abren su propia hoja, solo si app.js pasó el callback.
  const ir = (cb, acc, extra = '') => c[cb] ? { cls: ' pl-ir', at: ` role="button" tabindex="0" data-vd="${acc}"${extra}` } : { cls: '', at: '' };
  const sinNeto = d => d.servicios.filter(s => s.costo_usd == null && n(s.precio_usd) > 0);
  const titular = d => (d.pasajeros || []).find(p => p.titular) || null;
  const telWa = d => String(titular(d)?.telefono || d.contacto?.telefono || '').replace(/\D/g, '');

  // v4 «menos ruido» (2026-11-26): un solo resumen de números, «Por hacer» con lo pendiente, el resto
  // en filas sin cajas. El color queda solo para estados (ámbar = pendiente, rosa = falta, verde = listo).
  const est = (t, col) => `<span class="vd-est" style="--c:${col}">${esc(t)}</span>`;
  const anuladaDe = (f, d) => (d?.factura?.estado ?? f.estado) === 'anulada';
  const rango = (ini, fin) => !ini ? '' : !fin || fin === ini ? fecha(ini) : String(ini).slice(0, 7) === String(fin).slice(0, 7) ? `${Number(String(ini).slice(8, 10))} → ${fecha(fin)}` : `${fecha(ini)} → ${fecha(fin)}`;

  function cabecera(f, d) {
    const cli = d?.cliente || f.cliente || 'Venta', ini = d?.viaje_inicio ?? f.viaje_inicio, fin = d?.viaje_fin ?? f.viaje_fin, viaje = c.viaje(ini, fin);
    const nf = esc(String(f.numero_factura ?? d?.factura?.numero ?? ''));
    return `<div class="vd-cab">
      <span class="vt-avatar" aria-hidden="true" style="--vc:var(--accent)">${esc(iniciales(cli))}</span>
      <div class="vd-quien">
        <div class="vd-nombre"><h2 id="vd-titulo">${esc(cli)}</h2>${anuladaDe(f, d) ? est('Factura anulada', 'var(--muted)') : ''}${viaje?.t ? est(viaje.t, viaje.col) : ''}</div>
        <div class="vt-meta">${f.reserva_codigo ? `<span>${esc(f.reserva_codigo)}</span>` : ''}${c.verFactura ? `<button type="button" class="pp-venta" data-vd="factura">Factura #${nf}</button>` : `<span>Factura #${nf}</span>`}<span><i class="fas fa-user-tie"></i> ${esc(d?.asesor || f.asesor || 'Sin asesor')}</span>${ini ? `<span><i class="fas fa-calendar-days"></i> ${esc(rango(ini, fin))}</span>` : ''}${d?.contacto?.canal ? `<span>${esc(d.contacto.canal)}</span>` : ''}</div>
      </div>
    </div>`;
  }

  function rapidas(f, d) {
    const wa = d ? telWa(d) : '';
    const bs = [wa ? btn('wa', 'fab fa-whatsapp', 'WhatsApp', '', ' vd-wa') : '', f.lead_id && c.verChat ? btn('chat', 'fa-comments', 'Chat') : '',
      f.lead_id ? btn('cliente', 'fa-user', 'Ver cliente') : '', f.reserva_id ? btn('reserva', 'fa-suitcase', 'Ver reserva') : ''].join('');
    return bs ? `<div class="vd-rapidas">${bs}</div>` : '';
  }

  // Los números de la venta en un solo lugar: cuatro grandes y una línea chica con caja y comisión.
  function resumen(d, ab) {
    const venta = n(d.total), neto = n(d.totales?.costo_neto), falta = sinNeto(d).length > 0;
    const total = n(ab?.monto_total ?? venta), cobrado = n(ab?.monto_pagado ?? d.pagado), saldo = total - cobrado, p = pct(cobrado, total);
    const margen = venta - neto, caja = cobrado - n(d.totales?.prov_abonado);
    const cm = d.comision, cmTxt = !cm ? 'sin cargar' : `${money(n(cm.total))} · ${cm.estado === 'pagada' ? `pagada ${corta(cm.pagada_en)}` : cm.estado === 'verificada' ? 'verificada, por pagar' : cm.estado === 'enviada' ? 'por revisar' : cm.estado}`;
    const k = (t, v, sub, cls = '', extra = '') => `<div class="vd-res-k"><span>${t}</span><b class="${cls}">${v}</b>${sub ? `<small>${sub}</small>` : ''}${extra}</div>`;
    return `<div class="vd-res">
      <div class="vd-res-grid">
        ${k('Venta', money(venta), `Costo neto <b class="${falta ? 'vt-falta' : ''}">${money(neto)}</b>${falta ? ' · incompleto' : ''}`)}
        ${k('Cobrado', money(cobrado), `${p} % del total`, '', barra(p, saldo > 0.005 ? 'var(--amber)' : 'var(--green)', 'Cobrado al cliente'))}
        ${k(saldo < -0.005 ? 'Saldo a favor' : 'Por cobrar', money(Math.abs(saldo)), saldo > 0.005 ? 'saldo del cliente' : saldo < -0.005 ? 'a favor del cliente' : 'pagó todo', saldo > 0.005 ? 'vd-pend' : saldo < -0.005 ? '' : 'lt-ok')}
        ${k('Margen', falta ? '—' : money(margen), falta ? 'falta algún neto' : venta > 0 ? `${Math.round(margen / venta * 100)} % de la venta` : '', falta ? 'vt-falta' : margen < 0 ? 'lt-debe' : '')}
      </div>
      <div class="vd-res-pie"><span title="Cobrado al cliente menos lo pagado al proveedor">Queda en caja <b class="${caja < 0 ? 'lt-debe' : ''}">${money(caja)}</b></span><span>Comisión del asesor <b>${esc(cmTxt)}</b></span></div>
    </div>`;
  }

  // Lo que falta para cerrar la venta, en un solo bloque arriba (antes iba al final de la Historia).
  function pendientes(f, d, ab) {
    if (anuladaDe(f, d)) return '';
    const it = [], add = (t, sub, monto, col, extra = '') => it.push(`<li style="--c:${col}"><div class="vd-fila-txt"><b>${esc(t)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${extra}${monto != null ? `<b class="vd-monto">${money(monto)}</b>` : ''}</li>`);
    const faltan = sinNeto(d).length;
    if (faltan) add(`Cargar el neto de ${faltan} servicio${faltan === 1 ? '' : 's'}`, 'sin eso el margen no es real', null, 'var(--pink)', peq('reserva', 'fa-pen', 'Abrir reserva'));
    const sinProv = d.servicios.filter(s => !s.proveedor_id && !s.cxp && n(s.costo_usd) > 0);
    if (sinProv.length) add('Asignar proveedor', `${sinProv.length === 1 ? sinProv[0].descripcion || sinProv[0].tipo : sinProv.length + ' servicios'} · se elige en Pago a proveedores`, sinProv.reduce((s, x) => s + n(x.costo_usd), 0), 'var(--pink)');
    const saldoCli = n(ab?.monto_total ?? d.total) - n(ab?.monto_pagado ?? d.pagado);
    if (saldoCli > 0.005) add('Cobrar saldo al cliente', '', saldoCli, 'var(--amber)');
    const debe = grupos(d).filter(g => g.id).map(g => ({ g, s: g.items.reduce((t, i) => t + Math.max(0, n(i.cxp?.saldo)), 0) })).filter(x => x.s > 0.005);
    if (debe.length) add(`Pagar a ${debe.map(x => x.g.nombre).join(' y ')}`, '', debe.reduce((t, x) => t + x.s, 0), 'var(--amber)');
    const cm = d.comision;
    if (cm && !cm.pagada_en) add(cm.estado === 'verificada' ? 'Pagar comisión del asesor' : 'Revisar comisión del asesor', '', n(cm.total), 'var(--amber)');
    return it.length ? `<section class="vd-sec vd-hacer" aria-labelledby="vd-hacer"><h3 id="vd-hacer">Por hacer <span class="vd-cuenta">${it.length}</span></h3><ul>${it.join('')}</ul></section>` : '';
  }

  function viajeros(d) {
    const ps = d.pasajeros || [], t = titular(d) || ps[0], otros = ps.filter(p => p !== t);
    if (!t) return `<section class="vd-sec"><div class="vd-sec-cab"><h3>Viajeros</h3>${peq('pasajeros', 'fa-user-plus', 'Cargar')}</div><p class="vd-nota">La reserva no tiene pasajeros cargados.</p></section>`;
    const fila = (p, tit) => `<li class="vd-fila"><span class="vd-ini${tit ? ' vd-tit' : ''}" aria-hidden="true">${esc(iniciales(p.nombre))}</span>
      <div class="vd-fila-txt"><b>${esc(p.nombre)}${tit ? '<span class="vd-tag">Titular</span>' : ''}</b><small>${esc(p.documento || 'Sin documento')}${tit ? ` · ${esc(p.telefono || d.contacto?.telefono || 'Sin teléfono')}` : ''}</small></div></li>`;
    return `<section class="vd-sec"><div class="vd-sec-cab"><h3>Viajeros <span class="vd-cuenta">${ps.length}</span></h3>${peq('pasajeros', 'fa-user-pen', 'Editar')}</div>
      <ul class="vd-lista">${fila(t, t.titular)}${otros.map(o => fila(o, false)).join('')}</ul></section>`;
  }

  function cobro(d, ab) {
    if (!ab) return `<section class="vd-sec"><h3>Cobro al cliente</h3><p class="vd-nota">No se pudieron cargar los abonos.</p></section>`;
    const abonos = ab.abonos || [], vivos = abonos.filter(a => !a.anulado_en);
    const porConciliar = vivos.filter(a => a.por_conciliar).reduce((s, a) => s + n(a.monto_usd), 0);
    const fila = (a, i) => {
      const x = ir('verCobro', 'cobro', ` data-i="${i}"`), vivo = !a.anulado_en;
      const marcas = [a.respaldo || a.saldo_anterior ? est('Inicial de la reserva', 'var(--muted)') : '', !vivo ? est('Anulado', 'var(--muted)') : '',
        vivo && a.por_conciliar ? est('Por conciliar', 'var(--amber)') : '', vivo && a.estado === 'por_verificar' ? est('Por verificar', 'var(--amber)') : '',
        vivo && a.estado === 'rechazado' ? est('Rechazado', 'var(--danger)') : ''].join('');
      const comp = a.comprobante_path ? peq('ver-comp', 'fa-image', 'Comprobante', ` data-path="${esc(a.comprobante_path)}" data-nombre="Comprobante ${esc(String(a.fecha || '').slice(0, 10))}"`)
        : vivo && c.uid?.() ? peq('adjuntar', 'fa-paperclip', 'Adjuntar', ` data-abono="${a.id}" style="--c:var(--amber)" title="Adjuntar el comprobante de este abono"`) : '';
      return `<li class="vd-fila${!vivo || a.estado === 'rechazado' ? ' vd-tachada' : ''}${x.cls}"${x.at}>
        <div class="vd-fila-txt"><b>${esc(a.metodo || 'Abono')}</b><small>${esc(fecha(a.fecha))} · ${a.referencia ? `ref. ${esc(a.referencia)}` : 'sin referencia'}</small>${marcas ? `<div class="vd-chips">${marcas}</div>` : ''}</div>
        ${comp}<b class="vd-monto">${money(n(a.monto_usd))}</b></li>`;
    };
    return `<section class="vd-sec" aria-labelledby="vd-cobro">
      <div class="vd-sec-cab"><h3 id="vd-cobro">Cobro al cliente <span class="vd-cuenta">${vivos.length} abono${vivos.length === 1 ? '' : 's'}</span></h3></div>
      ${abonos.length ? `<ul class="vd-lista">${abonos.map(fila).join('')}</ul>` : '<p class="vd-nota">Sin abonos registrados.</p>'}
      ${porConciliar > 0.005 ? `<p class="vd-nota">${money(porConciliar)} por conciliar con el banco.</p>` : ''}
      <input type="file" accept="image/*,application/pdf" data-vd-archivo hidden>
    </section>`;
  }

  // Agrupa servicios + CxP general por proveedor. Clave: id del proveedor de la CxP, si no el del servicio.
  function grupos(d) {
    const g = new Map(), clave = (id, nombre) => id ?? (nombre ? 'n:' + nombre : 'sin');
    const tomar = (id, nombre) => { const k = clave(id, nombre); if (!g.has(k)) g.set(k, { id: id ?? null, nombre: nombre || null, items: [] }); return g.get(k); };
    d.servicios.forEach(s => tomar(s.cxp?.proveedor_id ?? s.proveedor_id, s.cxp?.proveedor ?? s.proveedor).items.push({ s, cxp: s.cxp }));
    (d.cxp_general || []).forEach(x => tomar(x.proveedor_id, x.proveedor).items.push({ s: null, cxp: x }));
    return [...g.values()].sort((a, b) => (a.id == null) - (b.id == null));
  }

  const MOTIVO = { producto: () => 'es el proveedor del producto en el tarifario', destino: s => `el más usado para este destino y tipo (${s.ventas} venta${s.ventas === 1 ? '' : 's'})` };
  function asignar(s) {
    const sug = s.sugerido, lista = (provs || []).filter(p => p.activo !== false);
    const delTipo = lista.filter(p => (p.tipos || []).includes(s.tipo));
    const ops = (delTipo.length ? delTipo : lista);
    if (sug && !ops.some(p => p.id === sug.proveedor_id)) ops.unshift({ id: sug.proveedor_id, nombre: sug.nombre });
    const id = `vd-prov-${s.servicio_id}`;
    return `<div class="vd-asignar"><label for="${id}">¿A quién se le paga?</label>
      <div class="vd-sel-fila"><select id="${id}"><option value="">${provs ? 'Elige un proveedor' : 'Cargando proveedores…'}</option>${ops.map(p => `<option value="${p.id}"${p.id === sug?.proveedor_id ? ' selected' : ''}>${esc(p.nombre)}${p.id === sug?.proveedor_id ? ' · sugerido' : ''}</option>`).join('')}</select>
        ${btn('asignar', 'fa-check', 'Asignar', ` data-srv="${s.servicio_id}"`, ' vt-pagar')}</div>
      ${sug ? `<div class="vd-pista"><i class="fas fa-wand-magic-sparkles"></i><span>Sugerido: <b>${esc(sug.nombre)}</b>, ${esc(MOTIVO[sug.motivo]?.(sug) || '')}.</span></div>` : ''}
      ${s.costo != null ? `<label class="vd-check"><input type="checkbox" data-vd-mantener="${s.servicio_id}" checked><span>Mantener el neto de ${money(n(s.costo_usd))}<small>Si lo desmarcas, se calcula con el % del proveedor.</small></span></label>` : ''}
    </div>`;
  }

  function proveedores(d) {
    const gs = grupos(d);
    if (!gs.length) return `<section class="vd-sec"><h3>Pago a proveedores</h3><p class="vd-nota">La reserva no tiene servicios cargados.</p></section>`;
    const html = gs.map(gr => {
      const cxps = gr.items.map(i => i.cxp).filter(Boolean);
      const monto = cxps.reduce((s, x) => s + n(x.monto), 0), pagado = cxps.reduce((s, x) => s + n(x.abonado), 0), saldo = cxps.reduce((s, x) => s + Math.max(0, n(x.saldo)), 0);
      const sinProv = !gr.id && !gr.nombre, conCosto = gr.items.filter(i => n(i.s?.costo_usd) > 0);
      const estado = sinProv ? (conCosto.length ? est('Falta proveedor', 'var(--pink)') : est('Sin costo', 'var(--muted)'))
        : !cxps.length ? est('Sin cuenta por pagar', 'var(--muted)')
        : saldo <= 0.005 ? est('Pagado', 'var(--green)') : pagado > 0.005 ? est(`Pagado ${pct(pagado, monto)} %`, 'var(--amber)') : est('Por pagar', 'var(--amber)');
      const pagos = cxps.flatMap(x => x.pagos || []).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      const serv = gr.items.map(({ s, cxp }) => {
        const desc = s ? (s.descripcion || s.tipo) : 'Paquete (cuenta general)', neto = s ? s.costo_usd : cxp?.monto;
        const falta = s && s.costo_usd == null && n(s.precio_usd) > 0;
        return `<li class="vd-fila">
          <div class="vd-fila-txt"><b>${esc(desc)}</b><small>${[s?.seccion, s?.estado, s?.fecha_inicio ? fecha(s.fecha_inicio) : ''].filter(Boolean).map(esc).join(' · ')}</small>
            ${falta ? `<div class="vd-chips">${est('Sin neto', 'var(--pink)')}</div>` : ''}</div>
          <span class="vd-neto">Neto <b>${neto == null ? '—' : money(n(neto))}</b></span>
        </li>${sinProv && s && n(s.costo_usd) > 0 ? `<li>${asignar(s)}</li>` : ''}`;
      }).join('');
      const pagosHtml = pagos.map(p => { const x = gr.id && p.pago_id ? ir('verPago', 'pago', ` data-pago="${p.pago_id}" data-prov="${gr.id}"`) : ir('', ''); return `<li class="vd-fila${x.cls}"${x.at}>
          <div class="vd-fila-txt"><b>Pago aplicado</b><small>${[fecha(p.fecha), p.cuenta, p.referencia ? `ref. ${p.referencia}` : 'sin referencia', p.es_historico ? 'histórico' : ''].filter(Boolean).map(esc).join(' · ')}</small></div>
          <span class="vd-fila-ic" title="${p.comprobante ? 'Con comprobante' : 'Sin comprobante'}"><i class="fas ${p.comprobante ? 'fa-paperclip' : 'fa-circle-minus'}"></i></span>
          <b class="vd-monto">${money(n(p.monto_usd))}</b></li>`; }).join('');
      // Totales del proveedor en una línea; el neto total solo si hay más de un servicio (si no, repite la fila).
      const tot = cxps.length && !sinProv ? `<div class="vd-prov-tot">${gr.items.length > 1 ? `<span>Neto <b>${money(monto)}</b></span>` : ''}<span>Pagado <b>${money(pagado)}</b></span><span>Debemos <b class="${saldo > 0.005 ? 'vd-pend' : ''}">${money(saldo)}</b></span></div>` : '';
      const acc = gr.id ? `<div class="vd-acc">${saldo > 0.005 ? btn('pagar', 'fa-money-bill-transfer', `Pagar ${money(saldo)}`, ` data-prov="${gr.id}"`, ' vt-pagar') : ''}${peq('cuenta', 'fa-file-invoice-dollar', 'Estado de cuenta', ` data-prov="${gr.id}"`)}</div>` : '';
      return `<div class="vd-prov">
        <div class="vd-sec-cab"><h4>${gr.id && c.verProveedor ? `<button type="button" class="pp-venta" data-vd="proveedor" data-prov="${gr.id}" title="Ver todo lo de este proveedor">${esc(gr.nombre || 'Proveedor')}</button>` : esc(gr.nombre || 'Sin proveedor')}</h4>${estado}</div>
        <ul class="vd-lista">${serv}${pagosHtml}</ul>${tot}${acc}
      </div>`;
    }).join('');
    return `<section class="vd-sec" aria-labelledby="vd-prov"><div class="vd-sec-cab"><h3 id="vd-prov">Pago a proveedores</h3></div>${html}</section>`;
  }

  const DOC_IC = { voucher: 'fa-file-lines', recibo_abono: 'fa-receipt', comprobante: 'fa-image', boleto: 'fa-plane' };
  const DOC_TXT = { voucher: 'Voucher', recibo_abono: 'Recibo de abono', comprobante: 'Comprobante', boleto: 'Boleto' };
  function documentos(f, d, ab) {
    const v = d.voucher, cobrado = n(ab?.monto_pagado ?? d.pagado);
    // El voucher importado (tabla vouchers) queda atrás si la reserva generó uno nuevo después.
    const reemplazado = v && (d.documentos || []).some(x => x.tipo === 'voucher' && String(x.creado_en) > String(v.creado_en));
    // Sin el nombre largo del archivo (queda en el title): tipo, fecha y estado.
    const fila = (ic, t, sub, extra, title = '') => `<li class="vd-fila vd-doc"${title ? ` title="${title}"` : ''}><i class="fas ${ic} vd-doc-ic" aria-hidden="true"></i><div class="vd-fila-txt"><b>${t}</b><small>${sub}</small></div>${extra}</li>`;
    const vEst = !v ? '' : reemplazado ? est('Reemplazado', 'var(--muted)') : n(v.monto_pagado) + 0.005 >= cobrado ? est('Al día', 'var(--green)') : est('Desactualizado', 'var(--amber)');
    const vou = v ? fila('fa-file-lines', `Voucher N° ${esc(String(v.numero))} · rev. ${esc(String(v.revision))}`, `${esc(corta(v.creado_en))} · refleja ${money(n(v.monto_pagado))} pagado · ${vEst}`,
      v.pdf_path ? peq('ver-comp', 'fa-file-pdf', 'Abrir', ` data-path="${esc(v.pdf_path)}" data-nombre="Voucher ${esc(String(v.numero))} rev ${esc(String(v.revision))}"`) : '') : '';
    const docs = (d.documentos || []).map(x => fila(DOC_IC[x.tipo] || 'fa-file', esc(DOC_TXT[x.tipo] || x.tipo), esc(corta(x.creado_en)),
      c.verDocumento ? peq('doc', 'fa-arrow-up-right-from-square', 'Abrir', ` data-doc="${x.id}"`) : '', esc(x.nombre || ''))).join('');
    const fac = fila('fa-file-invoice', `Factura #${esc(String(f.numero_factura ?? d.factura?.numero ?? ''))}`, 'PDF de la venta', peq('pdf', 'fa-file-pdf', 'PDF'));
    const cuantos = (v ? 1 : 0) + (d.documentos || []).length + 1;
    // El voucher importado que ya fue reemplazado va al final: el vigente es el generado.
    return `<section class="vd-sec"><div class="vd-sec-cab"><h3>Documentos <span class="vd-cuenta">${cuantos}</span></h3></div>
      <ul class="vd-lista">${reemplazado ? '' : vou}${docs}${fac}${reemplazado ? vou : ''}</ul></section>`;
  }

  // Historia: solo lo que ya pasó, en orden, y el viaje (hueco si todavía no llega). Lo pendiente va en «Por hacer».
  function historia(f, d, ab) {
    const ev = [], hoy = new Date().toISOString().slice(0, 10);
    const e = (iso, t, sub, col) => iso && ev.push({ iso: String(iso), t, sub, col });
    e(d.creada_en, 'Reserva creada', d.asesor ? `por ${d.asesor}` : '');
    if (d.factura) e(d.factura.fecha_emision, `Factura #${d.factura.numero}`, d.factura.estado === 'anulada' ? 'anulada' : money(n(d.factura.monto_total)), d.factura.estado === 'anulada' ? 'var(--muted2)' : '');
    (ab?.abonos || []).filter(a => !a.anulado_en && a.estado !== 'rechazado').forEach(a => e(a.fecha, `Abono ${money(n(a.monto_usd))}`, a.metodo || ''));
    if (d.voucher) e(d.voucher.creado_en, `Voucher N° ${d.voucher.numero}`, `revisión ${d.voucher.revision}`);
    grupos(d).forEach(g => g.items.flatMap(i => i.cxp?.pagos || []).forEach(p => e(p.fecha, `Pago a ${g.nombre || 'proveedor'}`, money(n(p.monto_usd)))));
    if (d.comision?.pagada_en) e(d.comision.pagada_en, `Comisión pagada${d.asesor ? ' a ' + d.asesor.split(' ')[0] : ''}`, money(n(d.comision.total)));
    const vi = d.viaje_inicio, vf = d.viaje_fin;
    if (vi) ev.push({ iso: vi, t: 'Viaje', sub: '', fut: vi > hoy, cuando: vf && vf !== vi ? `${corta(vi)} → ${corta(vf)}` : corta(vi) });
    ev.sort((a, b) => a.iso.localeCompare(b.iso));
    const li = x => `<li class="${x.fut ? 'vd-fut' : ''}"${x.col ? ` style="--c:${x.col}"` : ''}><span class="vd-cuando">${esc(x.cuando || corta(x.iso))}</span><b>${esc(x.t)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</li>`;
    return `<section class="vd-sec"><h3>Historia de la venta</h3><ul class="vd-linea">${ev.map(li).join('')}</ul></section>`;
  }

  // El PDF de la venta ya está en Documentos (Factura): abajo quedan solo empresa y anular.
  function pie(f, d) {
    const anulable = c.rol === 'admin' && (d?.factura?.estado ?? f.estado) === 'pagada';
    const e = c.empresaDe?.(f.reserva_id);
    if (!anulable && !e) return '';
    return `<div class="vd-pie">
      ${e ? btn('empresa', 'fa-building', e.nombre || 'Empresa', ` data-emp="${e.id}"`) : ''}
      ${anulable ? btn('anular', 'fa-ban', 'Anular venta', ' style="--c:var(--danger)"', ' vd-anular') : ''}
    </div>`;
  }

  // Dos columnas por peso (≈ filas) para no dejar huecos: Cobro a la izquierda, Proveedores a la derecha,
  // Viajeros y Documentos a la más liviana. Historia entra vertical en el hueco si cabe; si no, va a lo ancho.
  // `order` es el orden de una sola columna (≤899, donde .vd-col es display:contents).
  const peso = h => 1.5 + (h.match(/<li/g) || []).length + 3 * (h.match(/vd-asignar"/g) || []).length
    + 2 * (h.match(/class="vd-prov"/g) || []).length + (h.match(/vd-nota/g) || []).length + 0.5 * (h.match(/vd-chips/g) || []).length;
  function columnas(f, d, ab) {
    const blq = (h, o) => `<div class="vd-blq" style="order:${o}">${h}</div>`;
    const izq = { h: [blq(cobro(d, ab), 1)], p: 0 }, der = { h: [blq(proveedores(d), 2)], p: 0 };
    izq.p = peso(izq.h[0]); der.p = peso(der.h[0]);
    [[viajeros(d), 3], [documentos(f, d, ab), 4]].forEach(([h, o]) => { const col = izq.p <= der.p ? izq : der; col.h.push(blq(h, o)); col.p += peso(h) + 0.5; });
    const hist = historia(f, d, ab), liv = izq.p <= der.p ? izq : der, pes = liv === izq ? der : izq;
    const cabe = liv.p + peso(hist) + 0.5 <= pes.p;
    if (cabe) liv.h.push(blq(hist, 5));
    return `<div class="vd-cols"><div class="vd-col">${izq.h.join('')}</div><div class="vd-col">${der.h.join('')}</div></div>${cabe ? '' : hist}`;
  }

  function pintar(f, d, ab, cargando) {
    const raiz = c.drawer();
    if (!raiz) return;
    const listo = !cargando && d && d.ok !== false;
    raiz.innerHTML = `<div class="vd" role="region" aria-labelledby="vd-titulo" data-rid="${Number(f.reserva_id)}">${cabecera(f, listo ? d : null)}${rapidas(f, listo ? d : null)}
      ${cargando ? '<p class="vd-nota"><i class="fas fa-spinner fa-spin"></i> Cargando la venta…</p>'
        : !listo ? `<div class="vt-aviso" style="--c:var(--danger)"><i class="fas fa-triangle-exclamation"></i> No se pudo cargar el detalle de esta venta.</div>`
        : `${resumen(d, ab)}${pendientes(f, d, ab)}${columnas(f, d, ab)}`}
      ${pie(f, d)}</div>`;
    const vd = raiz.querySelector('.vd');
    vd.onclick = e => accion(e.target.closest('[data-vd]'), f, d, ab, vd);
    const arch = vd.querySelector('[data-vd-archivo]');
    if (arch) arch.onchange = () => { const file = arch.files?.[0]; arch.value = ''; if (file) adjuntar(Number(arch.dataset.abono), file, f); };
    // Comprobantes y voucher importado se firman de una vez: el clic en «Comprobante» ya no espera la firma.
    if (listo) c.prefirmar?.([...(ab?.abonos || []).map(a => a.comprobante_path), d.voucher?.pdf_path], (d.documentos || []).some(x => x.mime === 'application/pdf'));
    if (listo && !provs && d.servicios.some(s => !s.proveedor_id && n(s.costo_usd) > 0)) cargarProveedores().then(() => { if (actual === f && c.drawer()?.querySelector('.vd-asignar')) pintar(f, d, ab, false); });
  }

  async function cargarProveedores() {
    const { data, error } = await sb.rpc('listar_proveedores', { p_solo_activos: true });
    if (error) { c.error('No se pudieron cargar los proveedores: ' + error.message); provs = []; return; }
    provs = data || [];
  }

  async function asignarProveedor(b, d, f) {
    const sid = Number(b.dataset.srv), s = d.servicios.find(x => x.servicio_id === sid);
    const prov = Number(document.getElementById(`vd-prov-${sid}`)?.value) || null;
    if (!s) return;
    if (!prov) { c.error('Elige un proveedor de la lista'); return; }
    const mantener = s.costo != null && document.querySelector(`[data-vd-mantener="${sid}"]`)?.checked;
    b.disabled = true;
    // Con neto ya cargado se conserva tal cual (guardar_costo_servicio); costo_servicio_auto lo recalcularía.
    const r = mantener
      ? await sb.rpc('guardar_costo_servicio', { p_servicio_id: sid, p_proveedor_id: prov, p_costo: n(s.costo), p_moneda: s.costo_moneda || 'USD', p_tasa: s.costo_moneda && s.costo_moneda !== 'USD' ? n(s.costo_tasa) || null : null })
      : await sb.rpc('costo_servicio_auto', { p_servicio_id: sid, p_proveedor_id: prov });
    b.disabled = false;
    if (r.error || r.data?.ok === false) { c.error('No se pudo asignar: ' + (r.error?.message || r.data?.error || 'error')); return; }
    const nombre = (provs || []).find(p => p.id === prov)?.nombre || s.sugerido?.nombre || 'proveedor';
    c.ok(`Proveedor asignado: ${nombre}. ${!mantener && r.data?.sin_regla ? 'Sin % ni tarifa base: el neto quedó vacío.' : 'Ya tiene su cuenta por pagar.'}`);
    c.alCambiar?.();
    refrescar();
  }

  async function adjuntar(abonoId, file, f) {
    const uid = c.uid?.();
    if (!abonoId || !uid) return;
    if (file.size > 10 * 1024 * 1024) { c.error('El archivo pesa más de 10 MB'); return; }
    c.ok('Subiendo comprobante…');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
    const path = `${uid}/abonos/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage.from('vouchers-pdf').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
    if (up.error) { c.error('No se pudo subir el archivo'); return; }
    const datos = file.type.startsWith('image/') ? await c.leerComprobante?.(file).catch(() => null) : null;
    const { data, error } = await sb.rpc('abono_adjuntar_comprobante', { p_abono_id: abonoId, p_comprobante_path: path, p_comprobante_datos: datos || null, p_referencia: datos?.referencia || null });
    if (error || !data?.ok) {
      sb.storage.from('vouchers-pdf').remove([path]).catch(() => {});
      c.error('No se pudo guardar: ' + (data?.error === 'ya_tiene_comprobante' ? 'el abono ya tenía comprobante' : error?.code === '42501' ? 'sin permiso sobre ese abono' : (error?.message || data?.error || 'error')));
      return;
    }
    c.ok(datos?.referencia ? `Comprobante guardado · ref. ${datos.referencia}` : 'Comprobante guardado en el abono');
    refrescar();
  }

  function accion(b, f, d, ab, vd) {
    if (!b || b.disabled) return;
    const prov = Number(b.dataset.prov) || null;
    switch (b.dataset.vd) {
      case 'pagar': {
        const ids = [...d.servicios.map(s => s.cxp), ...(d.cxp_general || [])].filter(x => x && x.proveedor_id === prov && n(x.saldo) > 0.005).map(x => x.id);
        return c.pagar(prov, ids);
      }
      case 'cuenta': return c.irCuenta(prov);
      case 'reserva': return c.verReserva(f.reserva_id, f.reserva_codigo);
      case 'pasajeros': return c.verReserva(f.reserva_id, f.reserva_codigo, 'pasajeros');
      case 'cliente': return c.verCliente(f.lead_id);
      case 'chat': return c.verChat?.(f.lead_id);
      case 'wa': { const wa = telWa(d); return wa && window.open(`https://wa.me/${wa}`, '_blank', 'noopener'); }
      case 'pdf': return c.pdf(f.id);
      case 'anular': return Promise.resolve(c.anular(f.id)).then(refrescar);
      case 'factura': return c.verFactura?.(f);
      case 'proveedor': return c.verProveedor?.(prov, grupos(d).find(g => g.id === prov)?.nombre);
      case 'pago': return c.verPago?.(prov, Number(b.dataset.pago), grupos(d).find(g => g.id === prov)?.nombre);
      case 'cobro': { const a = ab?.abonos?.[Number(b.dataset.i)]; return a && c.verCobro?.(a, f); }
      case 'empresa': return c.verEmpresa?.(Number(b.dataset.emp));
      case 'asignar': return asignarProveedor(b, d, f);
      case 'ver-comp': {
        const p = b.dataset.path, ext = (p.split('.').pop() || 'pdf').toLowerCase();
        return c.verComprobante?.(p, b, `${`${b.dataset.nombre || 'Comprobante'} ${f.reserva_codigo || ''}`.trim()}.${ext}`);
      }
      case 'doc': {
        const x = (d.documentos || []).find(y => y.id === Number(b.dataset.doc)) || {};
        const base = x.nombre || `${DOC_TXT[x.tipo] || 'Documento'} ${f.reserva_codigo || ''}`.trim();
        const ext = String(x.mime || 'application/pdf').split('/')[1]?.replace('jpeg', 'jpg') || 'pdf';
        return c.verDocumento?.(Number(b.dataset.doc), b, { mime: x.mime, nombre: /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}.${ext}` });
      }
      case 'adjuntar': { const i = vd.querySelector('[data-vd-archivo]'); if (i) { i.dataset.abono = b.dataset.abono; i.click(); } return; }
    }
  }

  // Caché por reserva (las dos RPC tardan 0,3-0,7 s, medido 26-nov): reabrir una venta pinta al
  // instante con lo último visto y se actualiza detrás; solo se repinta si algo cambió.
  const cache = new Map(), enCurso = new Map();
  async function traer(rid) {
    const t0 = Date.now();
    const [det, ab] = await Promise.all([
      sb.rpc('venta_finanzas_detalle', { p_reserva_id: rid }),
      sb.rpc('reserva_abonos_lista', { p_reserva_id: rid }),
    ]);
    const r = { det, ab: ab.data?.ok === false ? null : ab.data, en: t0 };
    // Un pedido viejo que llega tarde no pisa uno más nuevo.
    if (!det.error && det.data && det.data.ok !== false && !(cache.get(rid)?.en > t0)) {
      cache.delete(rid); cache.set(rid, r);
      if (cache.size > 30) cache.delete(cache.keys().next().value);
    }
    return r;
  }
  const pedir = rid => { if (!enCurso.has(rid)) enCurso.set(rid, traer(rid).finally(() => enCurso.delete(rid))); return enCurso.get(rid); };
  // Mouse sobre la venta en la lista: el detalle se pide antes del clic (si no se trajo hace poco).
  function precargar(f) {
    const rid = f?.reserva_id;
    if (rid && !enCurso.has(rid) && Date.now() - (cache.get(rid)?.en || 0) > 20000) pedir(rid).catch(() => {});
  }
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // fresco = recién se cambió algo (pago, anulación, proveedor, comprobante): se ignora lo guardado.
  async function abrir(f, fresco) {
    if (!f?.reserva_id) { c.error('Esta factura no tiene reserva asociada.'); return; }
    actual = f;
    const mio = ++pedido, rid = f.reserva_id;
    const previo = fresco ? null : cache.get(rid);
    const mostrando = Number(c.drawer()?.querySelector('.vd')?.dataset.rid) === Number(rid) && c.abierto();
    if (previo) pintar(f, previo.det.data, previo.ab, false);
    else if (!mostrando) pintar(f, null, null, true);
    c.abrirDrawer();
    // Recién precargado (mouse sobre la fila): no hace falta volver a pedirlo.
    if (previo && Date.now() - previo.en < 20000) return;
    const r = await (fresco ? traer(rid) : pedir(rid)).catch(e => ({ det: { error: e }, ab: null }));
    if (mio !== pedido || !c.drawer()?.querySelector('.vd')) return;
    if (r.det.error) {
      c.error('No se pudo cargar la venta: ' + (r.det.error.message || 'error de red'));
      if (previo || mostrando) return;
    }
    if (previo && igual(previo.det.data, r.det.data) && igual(previo.ab, r.ab)) return;
    pintar(f, r.det.data, r.ab, false);
  }
  // Tras pagar, anular, asignar o adjuntar: recarga solo si el drawer sigue mostrando esta venta.
  // La vista actual queda puesta hasta que llega la nueva (sin parpadeo de «Cargando…»).
  function refrescar() {
    if (!actual || !c.drawer()?.querySelector('.vd') || !c.abierto()) return;
    const f = c.buscar(actual.id) || actual;
    actual = f;
    abrir(f, true);
  }
  return { abrir, refrescar, precargar };
}
