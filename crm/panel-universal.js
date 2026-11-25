// Panel lateral universal (2026-11-25, dirección A «migas» elegida por el dueño): una sola hoja
// dentro del drawer que navega venta ↔ proveedor ↔ pago ↔ cobro ↔ factura ↔ empresa sin cambiar de
// tamaño. «Volver», Esc y el atrás de Android = una hoja; «Cerrar» = todo. Tocar algo que ya está
// en la pila regresa ahí, sin duplicarlo. Con más de 3 pasos las migas muestran solo el último.
// La hoja de venta la pinta finanzas-venta.js dentro de .pl-cuerpo (c.pintarVenta).
export function crearPanelUniversal(c) {
  const { sb, esc, money } = c;
  let pila = [], pedido = 0, empresas = null;
  const n = v => Number(v) || 0;
  const fecha = iso => iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
  const bs = v => 'Bs ' + n(v).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const chip = (t, col, ic) => `<span class="vt-chip" style="--c:${col}">${ic ? `<i class="fas ${ic}"></i> ` : ''}${esc(t)}</span>`;
  const btn = (acc, ic, t, extra = '', cls = '') => `<button type="button" class="vt-accion${cls}" data-pl="${acc}"${extra}><i class="fas ${ic}"></i> ${esc(t)}</button>`;
  const aviso = (t, col = 'var(--danger)') => `<div class="vt-aviso" style="--c:${col}"><i class="fas fa-triangle-exclamation"></i> ${esc(t)}</div>`;
  const dato = (t, v) => v == null || v === '' ? '' : `<div><span>${esc(t)}</span><b>${v}</b></div>`;
  const ir = (acc, extra, txt, sub, monto) => `<li class="vd-fila pl-ir" role="button" tabindex="0" data-pl="${acc}"${extra}>
      <div class="vd-fila-txt"><b>${txt}</b>${sub ? `<small>${sub}</small>` : ''}</div>${monto ?? ''}<i class="fas fa-chevron-right pl-flecha" aria-hidden="true"></i></li>`;
  const cab = (ic, tit, sub, chips = '') => `<div class="pl-cab"><span class="pl-ic" aria-hidden="true"><i class="fas ${ic}"></i></span>
      <div class="vd-quien"><h2>${esc(tit)}</h2>${sub ? `<div class="vt-meta">${sub}</div>` : ''}${chips ? `<div class="vd-chips">${chips}</div>` : ''}</div></div>`;

  const raiz = () => c.drawer();
  const marco = () => raiz()?.querySelector(':scope > .pl') || null;
  const cuerpo = () => marco()?.querySelector('.pl-cuerpo') || null;
  const activo = () => !!marco() && c.abierto();

  function armar() {
    const r = raiz();
    r.innerHTML = '<div class="pl"><div class="pl-barra"></div><div class="pl-cuerpo"></div></div>';
    const pl = r.firstElementChild;
    pl.addEventListener('click', clic);
    pl.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.pl-ir[role="button"]')) { e.preventDefault(); e.target.click(); }
    });
  }
  function barra() {
    const b = marco()?.querySelector('.pl-barra');
    if (!b) return;
    const k = pila.length, ver = k > 3 ? [pila[k - 1]] : pila;
    b.innerHTML = `${k > 1 ? '<button type="button" class="pl-volver" data-pl="volver"><i class="fas fa-arrow-left"></i> Volver</button>' : ''}
      <nav class="pl-migas" aria-label="Dónde estás"><ol>${ver.map(h => h === pila[k - 1]
        ? `<li><span aria-current="page">${esc(h.tit)}</span></li>`
        : `<li><button type="button" data-pl="miga" data-i="${pila.indexOf(h)}">${esc(h.tit)}</button></li>`).join('')}</ol></nav>
      <button type="button" class="pl-cerrar" data-pl="cerrar"><i class="fas fa-xmark"></i> Cerrar</button>`;
  }
  function mostrar() {
    barra();
    const el = cuerpo(), h = pila[pila.length - 1];
    if (!el || !h) return;
    const mio = ++pedido, vigente = () => mio === pedido && cuerpo() === el && pila[pila.length - 1] === h;
    el.innerHTML = '<p class="vd-nota"><i class="fas fa-spinner fa-spin"></i> Cargando…</p>';
    marco().closest('.drawer')?.scrollTo?.({ top: 0 });
    const retitular = t => { if (vigente() && t && t !== h.tit) { h.tit = t; barra(); } };
    Promise.resolve().then(() => h.pintar(el, vigente, retitular)).catch(e => {
      console.error('panel', h.clave, e);
      if (vigente()) el.innerHTML = aviso('No se pudo cargar esta hoja.');
    });
  }
  function abrir(h) {
    pila = [h];
    armar();
    mostrar();
    c.abrirDrawer();
  }
  function empujar(h) {
    if (!activo()) return abrir(h);
    const i = pila.findIndex(x => x.clave === h.clave);
    if (i >= 0) { pila = pila.slice(0, i + 1); pila[i] = { ...h, tit: pila[i].tit }; } else pila.push(h);
    mostrar();
  }
  function volver() {
    if (!activo() || pila.length < 2) return false;
    pila.pop();
    mostrar();
    return true;
  }
  function refrescar() { if (activo()) mostrar(); }
  // Esc solo si el foco está en el panel (o en ningún lado): una hoja encima (Pagar) maneja su propio Esc.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented || !activo()) return;
    const foco = document.activeElement;
    if (foco && foco !== document.body && !marco().contains(foco)) return;
    e.preventDefault();
    if (!volver()) c.cerrar();
  });

  async function cargarEmpresas() {
    if (empresas || !c.oficina()) return empresas || [];
    const { data, error } = await sb.rpc('listar_empresas_cliente', { p_solo_activos: false });
    if (error) console.warn('panel empresas', error.message);
    return (empresas = error ? [] : data || []);
  }
  const empresaDeReserva = id => (empresas || []).find(e => (e.reservas || []).some(r => Number(r.id) === Number(id)));

  function clic(e) {
    const b = e.target.closest('[data-pl]');
    if (!b || b.disabled) return;
    const d = b.dataset, prov = Number(d.prov) || null;
    switch (d.pl) {
      case 'volver': return volver();
      case 'cerrar': return c.cerrar();
      case 'miga': { const i = Number(d.i); if (i >= 0 && i < pila.length - 1) { pila = pila.slice(0, i + 1); mostrar(); } return; }
      case 'venta-cod': {
        const f = c.ventaPorCodigo(d.cod) || c.ventaPorReserva(Number(d.res));
        return f ? empujar(hojaVenta(f)) : Number(d.res) ? c.verReserva(Number(d.res), d.cod) : c.error(`La venta ${d.cod || ''} no está en Ventas (sin factura o filtrada).`);
      }
      case 'venta': { const f = c.ventaPorReserva(Number(d.res)); return f && empujar(hojaVenta(f)); }
      case 'proveedor': return prov && empujar(hojaProveedor(prov, d.nombre));
      case 'pago': return prov && empujar(hojaPago(prov, Number(d.id), d.nombre));
      case 'empresa': return empujar(hojaEmpresa(Number(d.id)));
      case 'factura': { const f = c.ventaPorReserva(Number(d.res)); return f && empujar(hojaFactura(f)); }
      case 'pagar': return c.pagar(prov, (d.cxp || '').split(',').map(Number).filter(Boolean));
      case 'cuenta': return c.irCuenta(prov);
      case 'comprobante': return c.verComprobante(d.path, b);
      case 'reserva': return c.verReserva(Number(d.res), d.cod);
      case 'pdf': return c.pdf(Number(d.id));
      case 'anular': return Promise.resolve(c.anular(Number(d.id))).then(refrescar);
    }
  }

  // ---------- Hojas ----------
  function hojaVenta(f) {
    return { clave: 'venta:' + f.reserva_id, tit: `Venta ${f.reserva_codigo || '#' + (f.numero_factura ?? '')}`, f,
      pintar: async () => { cargarEmpresas(); c.pintarVenta(c.ventaPorReserva(Number(f.reserva_id)) || f); } };
  }

  function hojaProveedor(id, nombre) {
    nombre ||= c.nombreProveedor(id) || 'Proveedor';
    return { clave: 'prov:' + id, tit: nombre, pintar: async (el, vigente) => {
      const [cx, mv] = await Promise.all([sb.rpc('por_pagar_cxp_listar', { p_proveedor_id: id }), sb.rpc('proveedor_movimientos_listar', { p_proveedor_id: id })]);
      if (!vigente()) return;
      if (cx.error || mv.error) { el.innerHTML = aviso('No se pudo cargar el proveedor.'); return; }
      const cxps = (cx.data || []).filter(x => n(x.saldo) > 0.005 && !x.sin_migrar), deuda = cxps.reduce((s, x) => s + n(x.saldo), 0);
      const pagos = (mv.data || []).filter(m => m.clase !== 'reembolso' && m.clase !== 'saldo_inicial').sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      const sinComp = pagos.filter(m => m.sin_comprobante).length;
      const filasCxp = cxps.map(x => ir('venta-cod', ` data-cod="${esc(x.codigo || '')}" data-res="${x.reserva_id ?? ''}"`,
        `${esc(x.codigo || '—')} · ${esc(x.cliente || '')}`, [x.servicio, x.fecha_inicio ? (x.vencida ? 'viajó ' : 'viaja ') + fecha(x.fecha_inicio) : ''].filter(Boolean).map(esc).join(' · '),
        `<b class="vd-monto lt-debe">${money(n(x.saldo))}</b>`)).join('');
      const filasPago = pagos.slice(0, 12).map(m => ir('pago', ` data-prov="${id}" data-id="${m.id}" data-nombre="${esc(nombre)}"`,
        `${esc(fecha(m.fecha))}${m.cuenta ? ' · ' + esc(m.cuenta) : m.es_historico ? ' · antes del sistema' : ''}`,
        `${esc(m.referencia ? 'Ref. ' + m.referencia : 'sin referencia')}${m.sin_comprobante ? ' · sin comprobante' : ''}`,
        `<b class="vd-monto">${money(n(m.monto_usd))}</b>`)).join('');
      el.innerHTML = `<div class="pl-hoja">${cab('fa-truck-field', nombre, '<span>Proveedor</span>',
          deuda > 0.005 ? chip(`Le debemos ${money(deuda)}`, 'var(--amber)') : chip('Al día', 'var(--green)'))}
        <div class="vd-mini">${dato('Le debemos', money(deuda))}${dato('Cuentas abiertas', String(cxps.length))}${dato('Último pago', pagos[0] ? esc(fecha(pagos[0].fecha)) : '—')}</div>
        ${sinComp ? aviso(`${sinComp} pago${sinComp === 1 ? '' : 's'} sin comprobante.`, 'var(--amber)') : ''}
        <section class="vd-sec"><div class="vd-sec-cab"><h3>Lo que le debemos</h3></div>
          ${filasCxp ? `<ul class="vd-lista">${filasCxp}</ul>` : '<p class="vd-nota">No le debemos nada.</p>'}</section>
        <section class="vd-sec"><div class="vd-sec-cab"><h3>Pagos hechos</h3>${pagos.length > 12 ? `<small class="vd-nota">últimos 12 de ${pagos.length}</small>` : ''}</div>
          ${filasPago ? `<ul class="vd-lista">${filasPago}</ul>` : '<p class="vd-nota">Sin pagos registrados.</p>'}</section>
        <div class="vd-pie">${deuda > 0.005 ? btn('pagar', 'fa-money-bill-transfer', `Pagar ${money(deuda)}`, ` data-prov="${id}" data-cxp="${cxps.map(x => x.cxp_id).join(',')}"`, ' vt-pagar') : ''}
          ${btn('cuenta', 'fa-file-invoice-dollar', 'Estado de cuenta completo', ` data-prov="${id}"`)}</div></div>`;
    } };
  }

  function hojaPago(provId, pagoId, provNombre) {
    provNombre ||= c.nombreProveedor(provId) || 'Proveedor';
    return { clave: 'pago:' + pagoId, tit: 'Pago', pintar: async (el, vigente, retitular) => {
      const { data, error } = await sb.rpc('proveedor_movimientos_listar', { p_proveedor_id: provId });
      if (!vigente()) return;
      const m = (data || []).find(x => Number(x.id) === pagoId && x.clase !== 'reembolso' && x.clase !== 'saldo_inicial');
      if (error || !m) { el.innerHTML = aviso(error ? 'No se pudo cargar el pago.' : 'Ese pago ya no existe o fue anulado.'); return; }
      retitular(`Pago ${fecha(m.fecha)}`);
      const chips = [m.es_historico ? chip('Histórico', 'var(--muted)') : '', m.movimiento_banco_id ? chip('Salida WF', 'var(--green)', 'fa-building-columns') : '',
        m.sin_comprobante ? chip('Sin comprobante', 'var(--amber)', 'fa-paperclip') : m.comprobante_path ? chip('Con comprobante', 'var(--green)', 'fa-paperclip') : ''].join('');
      const apl = (m.aplicaciones || []).map(a => ir('venta-cod', ` data-cod="${esc(a.codigo || '')}"`, `${esc(a.codigo || '—')} · ${esc(a.cliente || '')}`,
        esc(a.servicio || ''), `<b class="vd-monto">${money(n(a.monto_usd))}</b>`)).join('');
      el.innerHTML = `<div class="pl-hoja">${cab('fa-money-bill-transfer', `${money(n(m.monto_usd))} a ${provNombre}`,
          `<span><i class="fas fa-calendar-days"></i> ${esc(fecha(m.fecha))}</span>${m.cuenta ? `<span><i class="fas fa-building-columns"></i> ${esc(m.cuenta)}</span>` : ''}`, chips)}
        <div class="vd-mini">${dato('Monto', money(n(m.monto_usd)))}${m.moneda === 'VES' ? dato('En bolívares', `${bs(m.monto)} · tasa ${esc(String(m.tasa ?? ''))}`) : ''}
          ${dato('Referencia', m.referencia ? esc(m.referencia) : 'sin referencia')}${n(m.sobrante) > 0.005 ? dato('Quedó a favor', money(n(m.sobrante))) : ''}</div>
        ${m.nota ? `<p class="vd-nota">${esc(m.nota)}</p>` : ''}
        <section class="vd-sec"><div class="vd-sec-cab"><h3>A qué ventas se aplicó</h3></div>
          ${apl ? `<ul class="vd-lista">${apl}</ul>` : '<p class="vd-nota">No está aplicado a ninguna venta: es saldo a favor.</p>'}</section>
        <div class="vd-pie">${m.comprobante_path ? btn('comprobante', 'fa-paperclip', 'Ver comprobante', ` data-path="${esc(m.comprobante_path)}"`) : ''}
          ${btn('proveedor', 'fa-truck-field', `Ver ${provNombre}`, ` data-prov="${provId}" data-nombre="${esc(provNombre)}"`)}</div></div>`;
    } };
  }

  function hojaCobro(a, f) {
    return { clave: 'cobro:' + a.id, tit: `Abono ${fecha(a.fecha)}`, pintar: el => {
      const estado = a.anulado_en ? chip('Anulado', 'var(--muted)') : a.estado === 'rechazado' ? chip('Rechazado', 'var(--danger)')
        : a.estado === 'por_verificar' ? chip('Por verificar', 'var(--amber)') : a.por_conciliar ? chip('Por conciliar', 'var(--amber)') : chip('Confirmado', 'var(--green)');
      el.innerHTML = `<div class="pl-hoja">${cab('fa-hand-holding-dollar', `${money(n(a.monto_usd))} de ${f.cliente || 'el cliente'}`,
          `<span><i class="fas fa-calendar-days"></i> ${esc(fecha(a.fecha))}</span><span>${esc(a.metodo || 'Abono')}</span>${f.reserva_codigo ? `<span>${esc(f.reserva_codigo)}</span>` : ''}`,
          estado + (a.saldo_anterior ? chip('Inicial reserva', 'var(--blue)') : ''))}
        <div class="vd-mini">${dato('Monto', money(n(a.monto_usd)))}${a.moneda === 'VES' && a.monto_original != null ? dato('En bolívares', `${bs(a.monto_original)}${a.tasa_ves ? ' · tasa ' + esc(String(a.tasa_ves)) : ''}`) : ''}
          ${dato('Referencia', a.referencia ? esc(a.referencia) : 'sin referencia')}${a.verificado_en ? dato('Verificado', esc(fecha(a.verificado_en))) : ''}</div>
        ${a.anulado_en ? aviso(`Anulado el ${fecha(a.anulado_en)}${a.anulado_motivo ? ': ' + a.anulado_motivo : ''}`, 'var(--muted)') : ''}
        ${a.descripcion ? `<p class="vd-nota">${esc(a.descripcion)}</p>` : ''}
        <div class="vd-pie">${a.comprobante_path ? btn('comprobante', 'fa-paperclip', 'Ver comprobante', ` data-path="${esc(a.comprobante_path)}"`) : ''}
          ${btn('factura', 'fa-receipt', `Factura #${f.numero_factura ?? ''}`, ` data-res="${f.reserva_id}"`)}</div></div>`;
    } };
  }

  function hojaFactura(f0) {
    return { clave: 'factura:' + f0.id, tit: `Factura #${f0.numero_factura ?? ''}`, pintar: async el => {
      await cargarEmpresas();
      const f = c.ventaPorReserva(Number(f0.reserva_id)) || f0;
      const anulada = f.estado === 'anulada', emp = empresaDeReserva(f.reserva_id);
      const total = n(f.venta_total ?? f.reserva_total), facturado = n(f.monto_total);
      el.innerHTML = `<div class="pl-hoja">${cab('fa-receipt', `Factura #${f.numero_factura ?? ''}`,
          `<span>${esc(f.cliente || '')}</span>${f.fecha_emision ? `<span><i class="fas fa-calendar-days"></i> ${esc(fecha(f.fecha_emision))}</span>` : ''}<span><i class="fas fa-user-tie"></i> ${esc(f.asesor || 'Sin asesor')}</span>`,
          anulada ? chip('Anulada', 'var(--muted)', 'fa-ban') : chip('Pagada', 'var(--green)'))}
        <div class="vd-mini">${dato('Monto facturado', money(facturado))}${dato('Total de la venta', money(total))}${dato('Forma de pago', f.forma_pago ? esc(f.forma_pago) : '')}${dato('Moneda', f.moneda ? esc(f.moneda) : '')}</div>
        ${total - facturado > 0.005 ? aviso('El monto facturado es menor que el total de la venta: la venta manda.', 'var(--blue)') : ''}
        ${f.notas ? `<p class="vd-nota">${esc(f.notas)}</p>` : ''}
        <ul class="vd-lista">${ir('venta', ` data-res="${f.reserva_id}"`, `Venta ${esc(f.reserva_codigo || '')}`, 'cobro al cliente y pago a proveedores')}
          ${emp ? ir('empresa', ` data-id="${emp.id}"`, esc(emp.nombre || 'Empresa'), 'cliente empresarial') : ''}</ul>
        <div class="vd-pie">${btn('pdf', 'fa-file-pdf', 'PDF', ` data-id="${f.id}"`)}
          ${c.rol === 'admin' && !anulada ? btn('anular', 'fa-ban', 'Anular', ` data-id="${f.id}" style="--c:var(--danger)"`, ' vd-anular') : ''}</div></div>`;
    } };
  }

  function hojaEmpresa(id) {
    return { clave: 'empresa:' + id, tit: 'Empresa', pintar: async (el, vigente, retitular) => {
      const es = await cargarEmpresas();
      if (!vigente()) return;
      const e = es.find(x => Number(x.id) === id);
      if (!e) { el.innerHTML = aviso('No se encontró la empresa.'); return; }
      retitular(e.nombre || 'Empresa');
      const rs = [...(e.reservas || [])].sort((a, b) => String(b.fecha_viaje_inicio || '').localeCompare(String(a.fecha_viaje_inicio || '')));
      const filas = rs.map(r => { const f = c.ventaPorReserva(Number(r.id));
        return ir(f ? 'venta' : 'reserva', ` data-res="${r.id}" data-cod="${esc(r.codigo || '')}"`, esc(r.codigo || 'Reserva'),
          [r.etapa, r.fecha_viaje_inicio ? 'viaja ' + fecha(r.fecha_viaje_inicio) : '', f ? '' : 'sin factura'].filter(Boolean).map(esc).join(' · ')); }).join('');
      el.innerHTML = `<div class="pl-hoja">${cab('fa-building', e.nombre || 'Empresa', `${e.rif ? `<span>RIF ${esc(e.rif)}</span>` : ''}${e.tipo ? `<span>${esc(e.tipo)}</span>` : ''}`,
          e.activo === false ? chip('Inactiva', 'var(--muted)') : '')}
        <div class="vd-mini">${dato('Contacto', e.contacto ? esc(e.contacto) : '')}${dato('Teléfono', e.telefono ? esc(e.telefono) : '')}${dato('Correo', e.email ? esc(e.email) : '')}
          ${dato('Crédito', e.dias_credito ? `${esc(String(e.dias_credito))} días` : '')}${dato('Comisión', e.comision_pct != null ? `${esc(String(e.comision_pct))} %` : '')}</div>
        ${e.direccion ? `<p class="vd-nota">${esc(e.direccion)}</p>` : ''}
        <section class="vd-sec"><div class="vd-sec-cab"><h3>Reservas</h3></div>
          ${filas ? `<ul class="vd-lista">${filas}</ul>` : '<p class="vd-nota">Sin reservas.</p>'}</section></div>`;
    } };
  }

  return {
    cuerpo, atras: volver, refrescar,
    activoEn: clave => activo() && pila.some(h => h.clave === clave),
    venta: f => f?.reserva_id ? empujar(hojaVenta(f)) : c.error('Esta factura no tiene reserva asociada.'),
    nuevaVenta: f => f?.reserva_id ? abrir(hojaVenta(f)) : c.error('Esta factura no tiene reserva asociada.'),
    proveedor: (id, nombre) => empujar(hojaProveedor(id, nombre)),
    pago: (provId, pagoId, nombre) => empujar(hojaPago(provId, pagoId, nombre)),
    cobro: (a, f) => empujar(hojaCobro(a, f)),
    factura: f => empujar(hojaFactura(f)),
    empresa: id => empujar(hojaEmpresa(id)),
    empresaDeReserva,
  };
}
