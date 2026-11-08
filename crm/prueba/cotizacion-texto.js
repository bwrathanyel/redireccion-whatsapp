/* Lo que «lee» el cliente IA cuando el asesor le manda el PDF de una cotización. Aparte de clientes-ia.js
   para probarlo con node (scripts/probar-prueba-cotizacion.mjs). El total va primero y con nombre: antes iba
   al final de los campos crudos del ítem, el tope de la EF lo cortaba y el cliente se quedaba con «tarifa: 65»
   sin saber si era por persona, por noche o el total (sim 352900c1). */
(() => {
  'use strict';
  const TIPOS = { boleto: 'Boleto aéreo', hotel: 'Hotel', paquete: 'Paquete', fullday: 'Full day', tour: 'Tour', traslado: 'Traslado', otro: 'Servicio' };
  const UNIDAD = { persona_noche: 'por persona por noche', habitacion_noche: 'por habitación por noche' };
  const TOPE = 690; // la EF guarda cada nota [CRM] hasta 700 caracteres
  const num = v => v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
  const usd = n => `${Math.round(n * 100) / 100} $`;
  const fecha = s => /^\d{4}-\d{2}-\d{2}/.test(s || '') ? `${+s.slice(8, 10)}/${+s.slice(5, 7)}/${s.slice(0, 4)}` : '';
  const noches = (a, b) => { const d = (Date.parse(b) - Date.parse(a)) / 864e5; return d > 0 ? Math.round(d) : 0; };
  const cuenta = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const corta = (s, max) => s.length <= max ? s : s.slice(0, max - 1).replace(/[\s,;:.]+\S*$/, '') + '…';

  // Mismo cálculo que cbImporte de app.js (app.js es módulo: no se puede llamar desde acá). Con tramos no se recalcula.
  function importe(it) {
    if (it.tramos?.length) return num(it.importe_revision);
    const t = num(it.tarifa) || 0, a = num(it.adultos) || 0, n = num(it.ninos) || 0, i = num(it.infantes) || 0;
    const veces = UNIDAD[it.unidad] && it.tipo === 'hotel' ? noches(it.ida, it.vuelta) || 1 : 1;
    if (it.tipo === 'hotel' && it.unidad === 'habitacion_noche') return ((it.habitaciones === undefined ? 1 : num(it.habitaciones) || 0) * t + n * (num(it.tarifa_nino) || 0)) * veces;
    if (it.tipo === 'otro') return (num(it.cant) || 0) * t;
    return (a * t + n * (num(it.tarifa_nino) || 0) + i * (it.infantes_gratis ? 0 : num(it.tarifa_infante) || 0)) * veces;
  }

  function item(it) {
    const hotel = it.tipo === 'hotel', unidad = hotel ? UNIDAD[it.unidad] || '' : 'por persona';
    const n = hotel ? noches(it.ida, it.vuelta) : 0;
    const que = [[TIPOS[it.tipo] || 'Servicio', it.nombre || it.ruta].filter(Boolean).join(' '), it.aerolinea, it.plan, it.hab && `habitación ${it.hab}`].filter(Boolean).join(', ');
    const cuando = it.ida && it.vuelta ? `del ${fecha(it.ida)} al ${fecha(it.vuelta)}${n ? ` (${cuenta(n, 'noche', 'noches')})` : ''}` : it.ida ? `el ${fecha(it.ida)}` : '';
    const a = num(it.adultos) || 0, ni = num(it.ninos) || 0, inf = num(it.infantes) || 0;
    let precio;
    if (it.tramos?.length) precio = `${cuenta(a, 'adulto', 'adultos')}${ni ? `, ${cuenta(ni, 'niño', 'niños')}` : ''}, tarifa por tramos de fechas`;
    else if (it.tipo === 'otro') precio = `${num(it.cant) || 0} × ${usd(num(it.tarifa) || 0)}`;
    else if (hotel && it.unidad === 'habitacion_noche') {
      const h = it.habitaciones === undefined ? 1 : num(it.habitaciones) || 0;
      precio = `${cuenta(h, 'habitación', 'habitaciones')} a ${usd(num(it.tarifa) || 0)} ${unidad}, ${cuenta(a, 'adulto', 'adultos')}${ni ? `, ${cuenta(ni, 'niño', 'niños')} a ${usd(num(it.tarifa_nino) || 0)}` : ''}`;
    } else {
      precio = [`${cuenta(a, 'adulto', 'adultos')} a ${usd(num(it.tarifa) || 0)} ${unidad}`.trim(),
        ni ? `${cuenta(ni, 'niño', 'niños')} a ${usd(num(it.tarifa_nino) || 0)} ${unidad}`.trim() : '',
        inf ? `${cuenta(inf, 'infante', 'infantes')} ${it.infantes_gratis ? 'gratis' : `a ${usd(num(it.tarifa_infante) || 0)}`}` : ''].filter(Boolean).join(', ');
    }
    const sub = importe(it);
    const extra = String(it.extra || '').trim();
    return corta([que, cuando, precio].filter(Boolean).join(', ') + (sub != null ? ` = ${usd(sub)}` : '') + (extra ? ` (${extra})` : ''), 260);
  }

  const cotizacionDe = c => ({
    total: num(c.total),
    detalle: (c.items || []).map(item).join(' | ')
      + (c.fecha ? `. Emitida el ${fecha(c.fecha)}${c.vence ? `, válida hasta el ${fecha(c.vence)}` : ''}` : ''),
  });

  const textoPdf = (nombre, cot) => corta(`El asesor te mandó un PDF «${nombre || 'cotización'}». `
    + (cot.total != null ? `TOTAL A PAGAR: ${usd(cot.total)} (el precio final de toda la cotización, no por persona ni por noche). ` : 'El PDF no muestra el total. ')
    + `Lo que cotiza: ${cot.detalle}.`, TOPE);

  window.__pruebaCotizacion = { cotizacionDe, textoPdf };
})();
