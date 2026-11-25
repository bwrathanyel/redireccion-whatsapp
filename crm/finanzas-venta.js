// Drawer de una venta (Finanzas › Ventas, 2026-11-25): cobro al cliente + pago a cada
// proveedor en una sola vista. Solo lectura: «Pagar» abre la hoja de Pagos a proveedores y
// el resto de las acciones las resuelve app.js (reserva, cliente, PDF, anular).
// Datos: venta_finanzas_detalle (servicios + CxP + pagos aplicados) y reserva_abonos_lista.
export function crearFinanzasVenta(c) {
  const { sb, esc, money } = c;
  let actual = null, pedido = 0;
  const n = v => Number(v) || 0;
  const fecha = iso => iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
  const pct = (a, b) => b > 0 ? Math.max(0, Math.min(100, Math.floor(a / b * 100))) : 0;
  const barra = (p, col, lbl) => `<div class="lt-barra" style="--c:${col}" role="progressbar" aria-label="${lbl}" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div>`;
  const chip = (t, col, ic) => `<span class="vt-chip" style="--c:${col}">${ic ? `<i class="fas ${ic}"></i> ` : ''}${esc(t)}</span>`;
  const btn = (acc, ic, t, extra = '', cls = '') => `<button type="button" class="vt-accion${cls}" data-vd="${acc}"${extra}><i class="fas ${ic}"></i> ${esc(t)}</button>`;
  // Panel universal (panel-universal.js): filas que abren su propia hoja, solo si app.js pasó el callback.
  const ir = (cb, acc, extra = '') => c[cb] ? { cls: ' pl-ir', at: ` role="button" tabindex="0" data-vd="${acc}"${extra}` } : { cls: '', at: '' };

  function cabecera(f, d) {
    const cli = d?.cliente || f.cliente || 'Venta', viaje = c.viaje(d?.viaje_inicio ?? f.viaje_inicio, d?.viaje_fin ?? f.viaje_fin);
    const ini = cli.trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '#';
    const fechas = [d?.viaje_inicio ?? f.viaje_inicio, d?.viaje_fin ?? f.viaje_fin].filter(Boolean).map(fecha);
    const anulada = (d?.factura?.estado ?? f.estado) === 'anulada';
    return `<div class="vd-cab">
      <span class="vt-avatar" aria-hidden="true" style="--vc:var(--accent)">${esc(ini)}</span>
      <div class="vd-quien">
        <h2 id="vd-titulo">${esc(cli)}</h2>
        <div class="vt-meta">${f.reserva_codigo ? `<span>${esc(f.reserva_codigo)}</span>` : ''}${c.verFactura ? `<button type="button" class="pp-venta" data-vd="factura"><i class="fas fa-receipt"></i> Factura #${esc(String(f.numero_factura ?? ''))}</button>` : `<span><i class="fas fa-receipt"></i> Factura #${esc(String(f.numero_factura ?? ''))}</span>`}<span><i class="fas fa-user-tie"></i> ${esc(d?.asesor || f.asesor || 'Sin asesor')}</span>${fechas.length ? `<span><i class="fas fa-calendar-days"></i> ${esc([...new Set(fechas)].join(' → '))}</span>` : ''}</div>
        <div class="vd-chips">${anulada ? chip('Factura anulada', 'var(--muted)', 'fa-ban') : ''}${viaje?.t ? chip(viaje.t, viaje.col, viaje.ic) : ''}</div>
      </div>
    </div>`;
  }

  function resumen(d, ab) {
    const venta = n(d.total), neto = n(d.totales?.costo_neto), sinNeto = d.servicios.some(s => s.costo_usd == null && n(s.precio_usd) > 0);
    const cobrado = n(ab?.monto_pagado ?? d.pagado), pagadoProv = n(d.totales?.prov_abonado), margen = venta - neto;
    const caja = cobrado - pagadoProv;
    const k = (t, v, sub = '', cls = '') => `<div class="vd-kpi"><span>${t}</span><b class="${cls}">${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    return `<div class="vd-kpis">
      ${k('Venta', money(venta))}
      ${k('Costo neto', money(neto), sinNeto ? 'falta algún neto' : '', sinNeto ? 'vt-falta' : '')}
      ${k('Margen', sinNeto ? '—' : money(margen), sinNeto ? 'incompleto' : venta > 0 ? `${Math.round(margen / venta * 100)} % de la venta` : '', sinNeto ? 'vt-falta' : margen >= 0 ? 'lt-ok' : 'lt-debe')}
      ${k('Queda en caja', money(caja), 'cobrado − pagado al proveedor', caja < 0 ? 'lt-debe' : '')}
    </div>`;
  }

  function cobro(d, ab) {
    if (!ab) return `<section class="vd-sec"><h3>Cobro al cliente</h3><p class="vd-nota">No se pudieron cargar los abonos.</p></section>`;
    const total = n(ab.monto_total), pagado = n(ab.monto_pagado), saldo = total - pagado;
    const abonos = ab.abonos || [], vivos = abonos.filter(a => !a.anulado_en);
    const porConciliar = vivos.filter(a => a.por_conciliar).reduce((s, a) => s + n(a.monto_usd), 0);
    const col = saldo > 0.005 ? 'var(--amber)' : 'var(--green)';
    const fila = (a, i) => {
      const x = ir('verCobro', 'cobro', ` data-i="${i}"`);
      const chips = [a.saldo_anterior ? chip('Inicial reserva', 'var(--blue)') : '', a.anulado_en ? chip('Anulado', 'var(--muted)') : '',
        !a.anulado_en && a.por_conciliar ? chip('Por conciliar', 'var(--amber)') : '', !a.anulado_en && a.estado === 'por_verificar' ? chip('Por verificar', 'var(--amber)') : '',
        !a.anulado_en && a.estado === 'rechazado' ? chip('Rechazado', 'var(--danger)') : ''].join('');
      return `<li class="vd-fila${a.anulado_en || a.estado === 'rechazado' ? ' vd-tachada' : ''}${x.cls}"${x.at}>
        <div class="vd-fila-txt"><b>${esc(fecha(a.fecha))} · ${esc(a.metodo || 'Abono')}</b><small>${esc(a.referencia || 'sin referencia')}</small>${chips ? `<div class="vd-chips">${chips}</div>` : ''}</div>
        <b class="vd-monto">${money(n(a.monto_usd))}</b></li>`;
    };
    return `<section class="vd-sec" aria-labelledby="vd-cobro">
      <div class="vd-sec-cab"><h3 id="vd-cobro">Cobro al cliente</h3>${chip(saldo > 0.005 ? `Abonó ${pct(pagado, total)} %` : saldo < -0.005 ? 'Saldo a favor' : 'Pagó todo', col)}</div>
      ${barra(pct(pagado, total), col, 'Cobrado al cliente')}
      <div class="vd-mini">
        <div><span>Total</span><b>${money(total)}</b></div><div><span>Pagado</span><b>${money(pagado)}</b></div>
        ${porConciliar > 0.005 ? `<div><span>Por conciliar</span><b>${money(porConciliar)}</b></div>` : ''}
        <div><span>${saldo < -0.005 ? 'Saldo a favor' : 'Saldo'}</span><b class="${saldo > 0.005 ? 'lt-debe' : ''}">${money(Math.abs(saldo))}</b></div>
      </div>
      ${abonos.length ? `<ul class="vd-lista">${abonos.map(fila).join('')}</ul>` : '<p class="vd-nota">Sin abonos registrados.</p>'}
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

  function proveedores(d) {
    const gs = grupos(d);
    if (!gs.length) return `<section class="vd-sec"><h3>Pago a proveedores</h3><p class="vd-nota">La reserva no tiene servicios cargados.</p></section>`;
    const html = gs.map(gr => {
      const cxps = gr.items.map(i => i.cxp).filter(Boolean);
      const monto = cxps.reduce((s, x) => s + n(x.monto), 0), pagado = cxps.reduce((s, x) => s + n(x.abonado), 0), saldo = cxps.reduce((s, x) => s + Math.max(0, n(x.saldo)), 0);
      const conCosto = gr.items.filter(i => n(i.s?.costo_usd) > 0);
      const estado = !gr.id && !gr.nombre ? (conCosto.length ? chip('Sin proveedor', 'var(--pink)') : chip('Sin costo', 'var(--muted)'))
        : !cxps.length ? chip('Sin cuenta por pagar', 'var(--muted)')
        : saldo <= 0.005 ? chip('Pagado', 'var(--green)') : pagado > 0.005 ? chip(`Pagado ${pct(pagado, monto)} %`, 'var(--amber)') : chip('Por pagar', 'var(--blue)');
      const pagos = cxps.flatMap(x => x.pagos || []).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      const serv = gr.items.map(({ s, cxp }) => {
        const desc = s ? (s.descripcion || s.tipo) : 'Paquete (cuenta general)', neto = s ? s.costo_usd : cxp?.monto;
        const sinNeto = s && s.costo_usd == null && n(s.precio_usd) > 0;
        return `<li class="vd-fila">
          <div class="vd-fila-txt"><b>${esc(desc)}</b><small>${[s?.seccion, s?.estado, s?.fecha_inicio ? fecha(s.fecha_inicio) : ''].filter(Boolean).map(esc).join(' · ')}</small>
            ${sinNeto ? `<div class="vd-chips">${chip('Sin neto', 'var(--pink)')}</div>` : ''}</div>
          <div class="vd-fila-num"><span>Neto <b>${neto == null ? '—' : money(n(neto))}</b></span>${cxp ? `<span>Pagado <b>${money(n(cxp.abonado))}</b></span><span>Saldo <b class="${n(cxp.saldo) > 0.005 ? 'lt-debe' : ''}">${money(Math.max(0, n(cxp.saldo)))}</b></span>` : ''}</div>
        </li>`;
      }).join('');
      const pagosHtml = pagos.length ? `<h4>Pagos aplicados</h4><ul class="vd-lista">${pagos.map(p => { const x = gr.id && p.pago_id ? ir('verPago', 'pago', ` data-pago="${p.pago_id}" data-prov="${gr.id}"`) : ir('', ''); return `<li class="vd-fila${x.cls}"${x.at}>
          <div class="vd-fila-txt"><b>${esc(fecha(p.fecha))}${p.cuenta ? ' · ' + esc(p.cuenta) : ''}</b><small>${esc(p.referencia || 'sin referencia')}${p.es_historico ? ' · histórico' : ''}</small></div>
          <span class="vd-fila-ic" title="${p.comprobante ? 'Con comprobante' : 'Sin comprobante'}"><i class="fas ${p.comprobante ? 'fa-paperclip' : 'fa-circle-minus'}"></i></span>
          <b class="vd-monto">${money(n(p.monto_usd))}</b></li>`; }).join('')}</ul>` : '';
      const acc = gr.id ? `<div class="vd-acc">${saldo > 0.005 ? btn('pagar', 'fa-money-bill-transfer', `Pagar ${money(saldo)}`, ` data-prov="${gr.id}"`, ' vt-pagar') : ''}${btn('cuenta', 'fa-file-invoice-dollar', 'Estado de cuenta', ` data-prov="${gr.id}"`)}</div>`
        : conCosto.length ? `<div class="vt-aviso" style="--c:var(--pink)"><i class="fas fa-triangle-exclamation"></i> Neto sin proveedor: no hay a quién pagarle. ${btn('reserva', 'fa-pen', 'Cargar en la reserva')}</div>` : '';
      return `<div class="vd-prov">
        <div class="vd-sec-cab"><h4>${gr.id && c.verProveedor ? `<button type="button" class="pp-venta" data-vd="proveedor" data-prov="${gr.id}" title="Ver todo lo de este proveedor">${esc(gr.nombre || 'Proveedor')}</button>` : esc(gr.nombre || 'Sin proveedor')}</h4>${estado}</div>
        ${cxps.length ? `${barra(pct(pagado, monto), saldo <= 0.005 ? 'var(--green)' : 'var(--amber)', 'Pagado al proveedor')}
        <div class="vd-mini"><div><span>Neto</span><b>${money(monto)}</b></div><div><span>Pagado</span><b>${money(pagado)}</b></div><div><span>Debemos</span><b class="${saldo > 0.005 ? 'lt-debe' : ''}">${money(saldo)}</b></div></div>` : ''}
        <ul class="vd-lista">${serv}</ul>${pagosHtml}${acc}
      </div>`;
    }).join('');
    const sinNeto = d.servicios.filter(s => s.costo_usd == null && n(s.precio_usd) > 0).length;
    const aviso = sinNeto ? `<div class="vt-aviso" style="--c:var(--pink)"><i class="fas fa-triangle-exclamation"></i> ${sinNeto} servicio${sinNeto === 1 ? '' : 's'} sin neto: el margen no es real. ${btn('reserva', 'fa-pen', 'Cargar en la reserva')}</div>` : '';
    return `<section class="vd-sec" aria-labelledby="vd-prov"><div class="vd-sec-cab"><h3 id="vd-prov">Pago a proveedores</h3></div>${aviso}${html}</section>`;
  }

  function pie(f, d) {
    const anulable = c.rol === 'admin' && (d?.factura?.estado ?? f.estado) === 'pagada';
    return `<div class="vd-pie">
      ${f.reserva_id ? btn('reserva', 'fa-suitcase', 'Ver reserva') : ''}
      ${f.lead_id ? btn('cliente', 'fa-user', 'Ver cliente') : ''}
      ${(() => { const e = c.empresaDe?.(f.reserva_id); return e ? btn('empresa', 'fa-building', e.nombre || 'Empresa', ` data-emp="${e.id}"`) : ''; })()}
      ${btn('pdf', 'fa-file-pdf', 'PDF')}
      ${anulable ? btn('anular', 'fa-ban', 'Anular', ' style="--c:var(--danger)"', ' vd-anular') : ''}
    </div>`;
  }

  function pintar(f, d, ab, cargando) {
    const raiz = c.drawer();
    if (!raiz) return;
    raiz.innerHTML = `<div class="vd" role="region" aria-labelledby="vd-titulo">${cabecera(f, d)}
      ${cargando ? '<p class="vd-nota"><i class="fas fa-spinner fa-spin"></i> Cargando la venta…</p>'
        : d?.ok === false || !d ? `<div class="vt-aviso" style="--c:var(--danger)"><i class="fas fa-triangle-exclamation"></i> No se pudo cargar el detalle de esta venta.</div>`
        : `${resumen(d, ab)}<div class="vd-cols">${cobro(d, ab)}${proveedores(d)}</div>`}
      ${pie(f, d)}</div>`;
    raiz.querySelector('.vd').onclick = e => accion(e.target.closest('[data-vd]'), f, d, ab);
  }

  function accion(b, f, d, ab) {
    if (!b) return;
    const prov = Number(b.dataset.prov) || null;
    switch (b.dataset.vd) {
      case 'pagar': {
        const ids = [...d.servicios.map(s => s.cxp), ...(d.cxp_general || [])].filter(x => x && x.proveedor_id === prov && n(x.saldo) > 0.005).map(x => x.id);
        return c.pagar(prov, ids);
      }
      case 'cuenta': return c.irCuenta(prov);
      case 'reserva': return c.verReserva(f.reserva_id, f.reserva_codigo);
      case 'cliente': return c.verCliente(f.lead_id);
      case 'pdf': return c.pdf(f.id);
      case 'anular': return Promise.resolve(c.anular(f.id)).then(refrescar);
      case 'factura': return c.verFactura?.(f);
      case 'proveedor': return c.verProveedor?.(prov, grupos(d).find(g => g.id === prov)?.nombre);
      case 'pago': return c.verPago?.(prov, Number(b.dataset.pago), grupos(d).find(g => g.id === prov)?.nombre);
      case 'cobro': { const a = ab?.abonos?.[Number(b.dataset.i)]; return a && c.verCobro?.(a, f); }
      case 'empresa': return c.verEmpresa?.(Number(b.dataset.emp));
    }
  }

  async function abrir(f) {
    if (!f?.reserva_id) { c.error('Esta factura no tiene reserva asociada.'); return; }
    actual = f;
    const mio = ++pedido;
    pintar(f, null, null, true);
    c.abrirDrawer();
    const [det, ab] = await Promise.all([
      sb.rpc('venta_finanzas_detalle', { p_reserva_id: f.reserva_id }),
      sb.rpc('reserva_abonos_lista', { p_reserva_id: f.reserva_id }),
    ]);
    if (mio !== pedido || !c.drawer()?.querySelector('.vd')) return;
    if (det.error) c.error('No se pudo cargar la venta: ' + det.error.message);
    pintar(f, det.data, ab.data?.ok === false ? null : ab.data, false);
  }
  // Tras pagar o anular: recarga solo si el drawer sigue mostrando esta venta.
  function refrescar() {
    if (!actual || !c.drawer()?.querySelector('.vd') || !c.abierto()) return;
    abrir(c.buscar(actual.id) || actual);
  }
  return { abrir, refrescar };
}
