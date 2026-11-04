// Corporativo › Facturas (2026-11-04): facturas a empresas, antes hechas en Zoho Invoice (la última
// fue INV-000028; la serie del CRM arranca en INV-000030). Solo admin y administrativo, igual que
// Empresas. Todo pasa por listar_/guardar_/estado_factura_empresa: los totales los calcula la base
// y la pantalla solo los muestra. El PDF se rearma desde la fila; no se guarda archivo.

const CSS = `
.fe-root{display:flex;flex-direction:column;gap:14px}
.fe-cab{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap}
.fe-cab h2{margin:0;font-size:20px}
.fe-cab .csub{margin-top:4px}
.fe-tabs{display:flex;gap:4px;padding:4px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.fe-tabs button{min-height:36px;padding:0 14px;border:0;border-radius:9px;background:transparent;color:var(--muted);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.fe-tabs button.on{background:var(--accent-soft);color:var(--accent-ink,var(--accent))}
.fe-barra{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-bottom:11px}
.fe-barra .ei{flex:1 1 220px;min-width:0}
.fe-barra select.ei{flex:0 1 220px}
.fe-chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:11px}
.fe-num{font-variant-numeric:tabular-nums;letter-spacing:.02em}
.fe-total{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}
.fe-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start}
.fe-form{display:flex;flex-direction:column;gap:14px;min-width:0}
.fe-bloque h3{margin:0 0 4px;font-size:14px;display:flex;align-items:center;gap:8px}
.fe-bloque h3 i{color:var(--accent)}
.fe-bloque h3 small{margin-left:auto;color:var(--muted);font-weight:500;font-size:11.5px}
.fe-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0 11px}
.fe-grid .fe-2{grid-column:span 2}
.fe-grid .fe-4{grid-column:1/-1}
.fe-grid .field{margin-bottom:0}
.fe-grid .fl,.fe-bloque .fl{margin:9px 0 4px}
.fe-ayuda{font-size:11.5px;color:var(--muted);margin-top:4px}
.fe-buscador{position:relative;margin-top:9px}
.fe-lista{position:absolute;z-index:30;left:0;right:0;top:calc(100% + 4px);max-height:290px;overflow:auto;background:var(--panel-solid,var(--bg2));border:1px solid var(--line2);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.35);padding:4px}
.fe-op{display:flex;align-items:center;gap:9px;width:100%;min-height:44px;padding:7px 11px;border:0;border-radius:9px;background:transparent;color:var(--txt);font:inherit;font-size:13px;text-align:left;cursor:pointer}
.fe-op:hover,.fe-op:focus-visible{background:var(--accent-soft)}
.fe-op small{display:block;color:var(--muted);font-size:11.5px}
.fe-op.crear{color:var(--accent);font-weight:700;border-top:1px solid var(--line);border-radius:0 0 9px 9px}
.fe-emp{display:flex;gap:11px;align-items:flex-start;border:1px solid var(--line2);border-radius:12px;padding:11px 14px;margin-top:9px}
.fe-emp-ini{width:40px;height:40px;flex:0 0 40px;border-radius:10px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);font-weight:800;font-size:13px}
.fe-emp-cuerpo{flex:1;min-width:0}
.fe-emp-cuerpo b{font-size:14px}
.fe-emp-cuerpo div{font-size:12px;color:var(--muted);margin-top:2px;overflow-wrap:anywhere}
.fe-emp-acc{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
.fe-falta{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:999px;background:rgba(245,181,68,.14);color:var(--amber);font-size:11px;font-weight:700;margin:4px 4px 0 0}
.fe-item{border:1px solid var(--line);border-radius:12px;padding:2px 14px 11px;margin-top:11px}
.fe-item-cab{display:flex;align-items:center;gap:9px;margin-top:9px}
.fe-item-cab b{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.11em}
.fe-item-cab .fe-importe{margin-left:auto;font-weight:800;font-variant-numeric:tabular-nums}
.fe-quitar{min-width:36px;min-height:36px;border:1px solid var(--line);border-radius:9px;background:transparent;color:var(--muted);cursor:pointer}
.fe-quitar:hover{color:var(--danger);border-color:var(--danger)}
.fe-atajos{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}
.fe-atajos button,.fe-agregar{min-height:36px;padding:0 14px;border:1px dashed var(--line2);border-radius:999px;background:transparent;color:var(--txt);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.fe-agregar{border-radius:10px;min-height:40px}
.fe-atajos button:hover,.fe-agregar:hover{border-color:var(--accent);color:var(--accent)}
.fe-falta-campo .ei{border-color:var(--amber)}
.fe-lateral{position:sticky;top:14px;display:flex;flex-direction:column;gap:11px}
.fe-lateral h3{margin:0;font-size:14px}
.fe-estado{font-size:11.5px;color:var(--muted)}
.fe-hoja{border-radius:12px;background:#fff;color:#0f172a;padding:14px;box-shadow:0 10px 22px rgba(0,0,0,.18);font-size:11px}
.fe-hoja-cab{display:flex;justify-content:space-between;align-items:flex-start;gap:9px;padding-bottom:9px;border-bottom:2px solid #ea7616}
.fe-hoja-cab b{font-size:15px;letter-spacing:.06em}
.fe-hoja-cab span{text-align:right;color:#64748b;font-size:10.5px}
.fe-hoja-cab span strong{display:block;color:#0f172a;font-size:12px}
.fe-hoja-a{margin-top:9px;color:#64748b;font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.fe-hoja-emp{font-weight:700;font-size:12px;margin-top:2px}
.fe-hoja-lin{display:flex;justify-content:space-between;gap:9px;padding:4px 0;border-bottom:1px solid #e2e8f0}
.fe-hoja-lin span:last-child{font-variant-numeric:tabular-nums;white-space:nowrap}
.fe-hoja-tot{display:flex;justify-content:space-between;margin-top:9px;padding:9px 11px;border-radius:8px;background:#0f172a;color:#fff;font-weight:800;font-size:13px}
.fe-faltan{margin:0;padding-left:18px;font-size:12px;color:var(--amber)}
.fe-acciones{display:flex;flex-direction:column;gap:7px}
.fe-btn{min-height:44px;padding:0 16px;border:1px solid var(--line2);border-radius:10px;background:transparent;color:var(--txt);font:inherit;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:border-color .16s,background .16s}
.fe-btn:hover{border-color:var(--accent)}
.fe-btn.prim{border:0;background:linear-gradient(135deg,var(--accent),#e0570a);color:#fff;font-weight:800;box-shadow:0 10px 22px rgba(255,145,0,.22)}
.fe-btn:disabled{opacity:.5;cursor:not-allowed}
.fe-vacio{padding:22px;text-align:center;color:var(--muted)}
@media (max-width:900px){
  .fe-layout{grid-template-columns:minmax(0,1fr)}
  .fe-lateral{position:static}
  .fe-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
`;

export const numeroTxt = n => (n ? `INV-${String(n).padStart(6, '0')}` : '');
export const NOTA_DEFECTO = 'Gracias por permitirnos ser parte de su próxima experiencia. En Lotus 360 nos encargamos de toda la logística para que usted solo se preocupe por disfrutar.';
export const CONDICIONES_DEFECTO = [
  'Todas las tarifas están expresadas en USD y están estrictamente sujetas a cambios y disponibilidad al momento de realizar la reserva formal.',
  'Los precios solo se garantizan con la emisión del boleto o confirmación del voucher de servicio.',
  'Una vez confirmada la reserva, los cambios o cancelaciones estarán sujetos a las penalidades del proveedor.',
].join('\n');
const ATAJOS = [['Boleto aéreo', 'fa-plane'], ['Hospedaje', 'fa-bed'], ['Alquiler de vehículo', 'fa-car'], ['Traslado', 'fa-van-shuttle'], ['Tour', 'fa-map-location-dot']];
const ERRORES = {
  empresa_requerida: 'Elegí la empresa a la que va la factura.',
  empresa_inactiva: 'Esa empresa está inactiva: reactivala en su ficha para facturarle.',
  items_requeridos: 'Agregá al menos un concepto.',
  item_sin_descripcion: 'Hay un concepto sin descripción.',
  item_monto_invalido: 'Revisá la cantidad y la tarifa de los conceptos.',
  total_cero: 'El total no puede ser $0.',
  porcentaje_invalido: 'El descuento y el IVA van de 0 a 100%.',
  fecha_fuera_de_rango: 'La fecha de la factura tiene que estar dentro del último mes o el próximo.',
  vence_antes: 'El vencimiento tiene que ser después de la fecha de la factura (máximo un año).',
  reserva_invalida: 'Esa reserva no es de esta empresa.',
  no_editable: 'Solo se editan facturas pendientes.',
  no_existe: 'Esa factura ya no existe: se recargó la lista.',
  ya_anulada: 'La factura ya estaba anulada.',
  pagada_no_anulable: 'Una factura pagada no se anula: primero marcala como pendiente.',
  motivo_requerido: 'Escribí el motivo de la anulación.',
  numero_duplicado: 'Choque de numeración: intentá de nuevo.',
  dato_invalido: 'Algún dato no es válido o es demasiado largo.',
};

// Redondeo como round(numeric, 2) de Postgres (mitad lejos de cero): 100.555 * 100 da 10055.4999… en float.
const r2 = n => { const v = Number(n) || 0; return Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-7) / 100; };
export const usd = n => '$' + r2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = n => `${r2(n).toLocaleString('es-VE', { maximumFractionDigits: 2 })}%`;
export const fechaTxt = iso => (iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('.', '') : '');
const sumarDias = (iso, n) => { const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + (Number(n) || 0)); return t.toISOString().slice(0, 10); };
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
export const condicionTxt = (fecha, vence) => { const n = fecha && vence ? diasEntre(fecha, vence) : 0; return n > 0 ? `Crédito ${n} ${n === 1 ? 'día' : 'días'}` : 'Al recibir'; };
export const tasaTxt = t => (t ? `Para efectos de esta factura, el pago es a tasa ${t}.` : '');
const iniciales = s => String(s || '').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || 'E';
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Mismo cálculo que guardar_factura_empresa (redondeo por línea, descuento sobre el subtotal, IVA sobre lo descontado).
export function calcular(f) {
  const items = (f.items || []).map(it => {
    const cantidad = Number(it.cantidad) || 0, tarifa = r2(it.tarifa);
    return { ...it, cantidad, tarifa, importe: r2(cantidad * tarifa) };
  });
  const subtotal = r2(items.reduce((s, it) => s + it.importe, 0));
  const descuento_pct = r2(f.descuento_pct), iva_pct = r2(f.iva_pct);
  const descuento = r2(subtotal * descuento_pct / 100), iva = r2((subtotal - descuento) * iva_pct / 100);
  return { ...f, items, subtotal, descuento_pct, iva_pct, descuento, iva, total: r2(subtotal - descuento + iva) };
}
export const vencida = (f, hoy) => f.estado === 'pendiente' && f.vence < hoy;

export function nombreArchivo(f, slug = s => String(s).replace(/[^A-Za-z0-9]+/g, '-')) {
  return `Factura-${[f.numero ? numeroTxt(f.numero) : 'BORRADOR', slug(f.empresa_datos?.nombre || ''), f.referencia ? slug(f.referencia) : ''].filter(Boolean).join('-')}.pdf`;
}

// ---------- PDF (carta, jsPDF + autotable; mismo membrete que el voucher) ----------
export async function construirPdf(f, c) {
  await c.librerias();
  const { jsPDF } = globalThis.jspdf;
  let fuentes = [], F = 'helvetica', st = s => (s === 'normal' || s === 'medium' ? 'normal' : 'bold');
  try { fuentes = await c.fuentes(); F = 'Poppins'; st = s => s; } catch (_e) { /* sin Poppins sale en Helvetica */ }
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  fuentes.forEach(([a, e, b]) => { doc.addFileToVFS(a, b); doc.addFont(a, 'Poppins', e); });
  let logo = null;
  try { const u = await c.imagen('logo-color.png'); if (String(u).startsWith('data:image/png')) logo = u; } catch (_e) { /* membrete sin logo */ }
  const P = c.paleta, limpiar = c.limpiar || (s => String(s ?? '').trim());
  const tinte = (col, k) => col.map(v => Math.round(v + (255 - v) * k));
  const font = (s, size, col) => { doc.setFont(F, st(s)); doc.setFontSize(size); doc.setTextColor(...col); };
  const X0 = 40, X1 = 572, W = X1 - X0, PIE = 740;
  const e = f.empresa_datos || {};
  let y;

  c.membrete(doc, { F, st, logo });

  // ---------- Banda de título ----------
  doc.setFillColor(...P.navy); doc.rect(X0, 114, W, 46, 'F');
  c.franja(doc, X0, 114, 4, 46);
  font('bold', 20, [255, 255, 255]); doc.text('FACTURA', X0 + 18, 144, { charSpace: 1.4 });
  font('semibold', 11.5, [255, 255, 255]); doc.text(f.numero ? `N° ${numeroTxt(f.numero)}` : 'BORRADOR · SIN NÚMERO', X1 - 14, 133, { align: 'right', charSpace: .4 });
  font('normal', 8, tinte(P.navy, .7)); doc.text(`Emitida el ${fechaTxt(f.fecha)}`, X1 - 14, 148, { align: 'right' });

  // ---------- Facturar a | Detalles ----------
  const yb = 176, wIzq = 300, xDer = X0 + wIzq + 14, wDer = X1 - xDer, pad = 12;
  const etiqueta = (t, x, yy) => { font('semibold', 7, P.ambarOsc); doc.text(t, x, yy, { charSpace: 1.4 }); };
  const izq = [];
  font('bold', 11.5, P.navy);
  const nombre = doc.splitTextToSize(limpiar(e.nombre || '—'), wIzq - 2 * pad);
  font('normal', 8.4, P.cuerpo);
  if (e.rif) izq.push(['RIF', e.rif]);
  if (e.direccion) izq.push(['', e.direccion]);
  const contacto = [e.contacto, e.telefono].filter(Boolean).join('  ·  ');
  if (contacto) izq.push(['', contacto]);
  if (e.email) izq.push(['', e.email]);
  const lineasIzq = izq.map(([k, v]) => doc.splitTextToSize(limpiar(k ? `${k} ${v}` : v), wIzq - 2 * pad));
  const altoIzq = 24 + nombre.length * 14 + lineasIzq.reduce((s, l) => s + l.length * 11.5, 0) + 10;
  const det = [['Fecha de emisión', fechaTxt(f.fecha)], ['Vencimiento', fechaTxt(f.vence)], ['Condición', condicionTxt(f.fecha, f.vence)]];
  if (f.referencia) det.push(['Referencia', f.referencia]);
  if (f.reserva_codigo) det.push(['Reserva', f.reserva_codigo]);
  font('semibold', 8.4, P.navy);
  const detLineas = det.map(([k, v]) => [k, doc.splitTextToSize(limpiar(v), wDer - 2 * pad - 78)]);
  const altoDer = 24 + detLineas.reduce((s, [, l]) => s + l.length * 11 + 5, 0) + 6;
  const alto = Math.max(altoIzq, altoDer, 92);
  [[X0, wIzq], [xDer, wDer]].forEach(([x, w]) => {
    doc.setFillColor(...P.suave); doc.setDrawColor(...P.linea); doc.setLineWidth(.8);
    doc.roundedRect(x, yb, w, alto, 5, 5, 'FD');
  });
  etiqueta('FACTURAR A', X0 + pad, yb + 17);
  y = yb + 34;
  font('bold', 11.5, P.navy); doc.text(nombre, X0 + pad, y); y += nombre.length * 14 - 2;
  izq.forEach(([k], i) => {
    lineasIzq[i].forEach((l, j) => {
      if (k && j === 0) { font('semibold', 8.4, P.navy); doc.text(k, X0 + pad, y); font('normal', 8.4, P.cuerpo); doc.text(l.slice(k.length + 1), X0 + pad + doc.getTextWidth(k + ' ') + 2, y); }
      else { font('normal', 8.4, P.cuerpo); doc.text(l, X0 + pad, y); }
      y += 11.5;
    });
  });
  etiqueta('DETALLES', xDer + pad, yb + 17);
  y = yb + 34;
  detLineas.forEach(([k, ls]) => {
    font('normal', 7.8, P.gris); doc.text(k, xDer + pad, y);
    font('semibold', 8.4, P.navy); ls.forEach((l, j) => doc.text(l, X1 - pad, y + j * 11, { align: 'right' }));
    y += ls.length * 11 + 5;
  });

  // ---------- Conceptos ----------
  const items = f.items || [];
  const textoItem = it => [limpiar(it.descripcion), limpiar(it.detalle)].filter(Boolean).join('\n');
  doc.autoTable({
    startY: yb + alto + 18, theme: 'plain', margin: { left: X0, right: 612 - X1, bottom: 70 }, rowPageBreak: 'avoid',
    styles: { font: F, fontStyle: st('medium'), fontSize: 8.8, textColor: P.navy, cellPadding: { top: 8, bottom: 8, left: 9, right: 9 }, valign: 'top' },
    headStyles: { fillColor: P.navy, lineColor: P.navy, lineWidth: .4, textColor: 255, fontStyle: st('semibold'), fontSize: 7.4, cellPadding: { top: 7, bottom: 7, left: 9, right: 9 } },
    alternateRowStyles: { fillColor: P.suave },
    columnStyles: { 0: { cellWidth: 28, halign: 'center', textColor: P.gris }, 2: { cellWidth: 52, halign: 'right' }, 3: { cellWidth: 82, halign: 'right' }, 4: { cellWidth: 92, halign: 'right', fontStyle: st('semibold') } },
    head: [[{ content: '#', styles: { halign: 'center' } }, 'DESCRIPCIÓN', { content: 'CANT.', styles: { halign: 'right' } }, { content: 'TARIFA', styles: { halign: 'right' } }, { content: 'IMPORTE', styles: { halign: 'right' } }]],
    body: items.map((it, i) => [String(i + 1), textoItem(it), r2(it.cantidad).toLocaleString('es-VE'), usd(it.tarifa), usd(it.importe)]),
    // La descripción va en negrita y el detalle debajo en gris: autotable no mezcla estilos en
    // una celda, así que se mide con su texto y se dibuja a mano.
    willDrawCell: d => { if (d.section === 'body' && d.column.index === 1) { d.cell._lineas = d.cell.text; d.cell.text = []; } },
    didDrawCell: d => {
      if (d.section === 'body' && d.column.index === 1) {
        const it = items[d.row.index], ancho = d.cell.width - 18;
        font('semibold', 8.8, P.navy);
        const ld = doc.splitTextToSize(limpiar(it.descripcion), ancho);
        let yy = d.cell.y + 8 + 8.8 * .85;
        doc.text(ld, d.cell.x + 9, yy, { lineHeightFactor: 1.15 }); yy += ld.length * 8.8 * 1.15;
        if (it.detalle) { font('normal', 7.8, P.gris); doc.text(doc.splitTextToSize(limpiar(it.detalle), ancho), d.cell.x + 9, yy + 1, { lineHeightFactor: 1.15 }); }
      }
      if (d.section === 'body' && d.column.index === 4) { doc.setDrawColor(...P.linea); doc.setLineWidth(.6); doc.line(X0, d.cell.y + d.cell.height, X1, d.cell.y + d.cell.height); }
    },
  });
  y = doc.lastAutoTable.finalY + 16;

  // ---------- Totales (derecha) y notas/condiciones (izquierda) ----------
  const filas = [['Subtotal', usd(f.subtotal)]];
  if (Number(f.descuento_pct) > 0) filas.push([`Descuento (${pct(f.descuento_pct)})`, '-' + usd(f.descuento)]);
  if (Number(f.iva_pct) > 0) filas.push([`IVA (${pct(f.iva_pct)})`, usd(f.iva)]);
  const saldo = f.estado === 'pagada' || f.estado === 'anulada' ? 0 : f.total;
  const condiciones = String(f.condiciones || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (f.tasa_pago) condiciones.push(tasaTxt(f.tasa_pago));
  const wNotas = 290, xTot = X0 + wNotas + 22, wTot = X1 - xTot;
  font('normal', 8, P.cuerpo);
  const notaLs = f.notas ? doc.splitTextToSize(limpiar(f.notas), wNotas - 14) : [];
  const condLs = condiciones.map(t => doc.splitTextToSize(limpiar(t), wNotas - 12));
  const altoNotas = (notaLs.length ? 22 + notaLs.length * 11 + 10 : 0) + (condLs.length ? 22 + condLs.reduce((s, l) => s + l.length * 10.5 + 4, 0) : 0);
  const altoTot = filas.length * 20 + 36 + 30 + (f.estado === 'pagada' ? 48 : 0);
  if (y + Math.max(altoNotas, altoTot) > PIE) { doc.addPage(); y = 48; }
  const y0 = y;
  filas.forEach(([k, v]) => {
    font('normal', 8.8, P.gris); doc.text(k, xTot + 4, y + 12);
    font('semibold', 9, P.navy); doc.text(v, X1 - 4, y + 12, { align: 'right' });
    doc.setDrawColor(...P.linea); doc.setLineWidth(.6); doc.line(xTot, y + 20, X1, y + 20);
    y += 20;
  });
  y += 6;
  doc.setFillColor(...P.navy); doc.roundedRect(xTot, y, wTot, 32, 4, 4, 'F');
  font('semibold', 8.5, [255, 255, 255]); doc.text(`TOTAL ${f.moneda || 'USD'}`, xTot + 12, y + 20, { charSpace: 1 });
  font('bold', 14, [255, 255, 255]); doc.text(usd(f.total), X1 - 12, y + 21.5, { align: 'right' });
  y += 32;
  doc.setFillColor(...tinte(P.naranja, .9)); doc.rect(xTot, y + 4, wTot, 24, 'F');
  font('semibold', 8.5, P.ambarOsc); doc.text('Saldo adeudado', xTot + 12, y + 20);
  font('bold', 10.5, P.ambarOsc); doc.text(usd(saldo), X1 - 12, y + 20.5, { align: 'right' });
  if (f.estado === 'pagada') {
    const sx = xTot + wTot / 2, sy = y + 58;
    doc.setDrawColor(...P.verde); doc.setLineWidth(1.6); doc.roundedRect(sx - 56, sy - 18, 112, 28, 4, 4, 'S');
    font('bold', 13, P.verde); doc.text('PAGADA', sx, sy + 1, { align: 'center', charSpace: 2 });
  }

  y = y0;
  const tituloNota = t => { font('semibold', 7, P.ambarOsc); doc.text(t, X0, y + 8, { charSpace: 1.4 }); c.franja(doc, X0, y + 12, 32, 1.6); y += 24; };
  if (notaLs.length) {
    tituloNota('NOTAS');
    doc.setFillColor(...P.naranja); doc.rect(X0, y - 8, 2, notaLs.length * 11 + 2, 'F');
    font('normal', 8, P.cuerpo); doc.text(notaLs, X0 + 10, y, { lineHeightFactor: 1.38 }); y += notaLs.length * 11 + 10;
  }
  if (condLs.length) {
    tituloNota('CONDICIONES GENERALES');
    condLs.forEach((ls, i) => {
      const esTasa = f.tasa_pago && i === condLs.length - 1;
      doc.setFillColor(...P.naranja); doc.circle(X0 + 2.5, y - 2.6, 1.4, 'F');
      font(esTasa ? 'semibold' : 'normal', 7.8, esTasa ? P.navy : P.gris); doc.text(ls, X0 + 10, y, { lineHeightFactor: 1.35 });
      y += ls.length * 10.5 + 4;
    });
  }

  // Marca de agua translúcida: va encima de todo y opaca tapaba los datos.
  if (f.estado === 'anulada') {
    for (let i = 1; i <= doc.getNumberOfPages(); i++) {
      doc.setPage(i);
      doc.setGState(new doc.GState({ opacity: .16 }));
      font('bold', 92, [185, 28, 28]); doc.text('ANULADA', 306, 470, { align: 'center', angle: 32 });
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
  }

  // ---------- Pie en todas las hojas ----------
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    if (i > 1) c.franja(doc, 0, 0, 612, 4);
    doc.setDrawColor(...P.linea); doc.setLineWidth(.6); doc.line(X0, 752, X1, 752);
    font('normal', 7, P.gris);
    doc.text(['Destino y Eventos Lotus 360', f.numero ? numeroTxt(f.numero) : 'Borrador'].join('  ·  '), X0, 765);
    doc.text(`Página ${i} de ${n}`, X1, 765, { align: 'right' });
    c.franja(doc, 0, 788, 612, 4);
  }
  return doc.output('blob');
}

// ---------- Sección ----------
export function crearFacturasEmpresa(c) {
  const { sb, esc, raiz } = c;
  let montado = false, vista = 'lista', lista = [], empresas = [], d = null, editando = null, ocupado = false;
  let filtro = 'pendientes', empFiltro = '', q = '', empQ = '', empAbierta = false, aviso = '';
  const $ = sel => raiz.querySelector(sel);
  const rol = () => (typeof c.rol === 'function' ? c.rol() : c.rol);
  const permitido = () => ['admin', 'administrativo'].includes(rol());
  const hoy = () => c.hoy();
  const empresa = id => empresas.find(e => e.id === Number(id)) || null;

  function css() {
    if (document.getElementById('fe-css')) return;
    const s = document.createElement('style'); s.id = 'fe-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  const itemVacio = (descripcion = '') => ({ descripcion, detalle: '', cantidad: 1, tarifa: '' });
  const nueva = (empresaId = null) => {
    const e = empresa(empresaId);
    d = { empresa_id: e?.id ?? null, fecha: hoy(), vence: sumarDias(hoy(), e?.dias_credito || 0), venceManual: false, referencia: '', reserva_id: null,
      items: [itemVacio()], descuento_pct: 0, iva_pct: 0, tasa_pago: '', notas: NOTA_DEFECTO, condiciones: CONDICIONES_DEFECTO };
    editando = null; aviso = ''; empQ = ''; empAbierta = false;
  };

  function marco() {
    raiz.innerHTML = `<div class="fe-root">
      <div class="fe-cab">
        <div><h2><i class="fas fa-file-invoice"></i> Facturas</h2>
          <div class="csub">Facturas a las empresas a las que les vendemos · elegí la empresa, cargá los conceptos y sale el PDF con el membrete de Lotus.</div></div>
        <div class="fe-tabs" role="tablist"><button type="button" role="tab" data-vista="lista">Facturas</button><button type="button" role="tab" data-vista="editor">Nueva factura</button></div>
      </div>
      <div data-panel="lista"><div class="card">
        <div class="kpis bt-kpis lt-kpis lt-kpis-4" id="fe-kpis"></div>
        <div class="fe-chips" id="fe-chips"></div>
        <div class="fe-barra"><input class="ei" id="fe-buscar" type="search" placeholder="Buscar N°, empresa, RIF o referencia…" autocomplete="off" aria-label="Buscar factura">
          <select class="ei" id="fe-emp-filtro" aria-label="Filtrar por empresa"></select></div>
        <div class="lt-grid" id="fe-lista"></div></div></div>
      <div data-panel="editor" hidden><div class="fe-layout">
        <div class="fe-form">
          <div class="card fe-bloque"><h3><i class="fas fa-building"></i> Empresa</h3><div id="fe-empresa"></div></div>
          <div class="card fe-bloque"><h3><i class="fas fa-calendar-days"></i> Datos de la factura</h3><div class="fe-grid" id="fe-datos"></div></div>
          <div class="card fe-bloque"><h3><i class="fas fa-list"></i> Conceptos <small id="fe-items-res"></small></h3><div id="fe-items"></div>
            <div class="fe-atajos">${ATAJOS.map(([t, i]) => `<button type="button" data-acc="atajo" data-t="${esc(t)}"><i class="fas ${i}"></i> ${esc(t)}</button>`).join('')}
              <button type="button" class="fe-agregar" data-acc="item"><i class="fas fa-plus"></i> Otro concepto</button></div></div>
          <div class="card fe-bloque"><h3><i class="fas fa-percent"></i> Descuento e impuestos</h3><div class="fe-grid" id="fe-totales"></div>
            <div class="fe-ayuda"><i class="fas fa-circle-info"></i> Son opcionales: si los dejás en 0, no aparecen en la factura.</div></div>
          <div class="card fe-bloque"><h3><i class="fas fa-note-sticky"></i> Notas y condiciones</h3><div class="fe-grid" id="fe-notas"></div></div>
        </div>
        <aside class="card fe-lateral" aria-label="Resumen de la factura">
          <h3>Vista previa</h3><div class="fe-estado" id="fe-estado"></div>
          <div id="fe-previa"></div>
          <div class="fe-acciones">
            <button type="button" class="fe-btn prim" data-acc="guardar"><i class="fas fa-file-invoice-dollar"></i> Emitir factura</button>
            <button type="button" class="fe-btn" data-acc="ver"><i class="fas fa-eye"></i> Ver PDF sin guardar</button>
            <button type="button" class="fe-btn" data-acc="cancelar"><i class="fas fa-xmark"></i> Cancelar</button>
          </div>
        </aside>
      </div></div>
    </div>`;
    raiz.addEventListener('click', alClic);
    raiz.addEventListener('input', alEscribir);
    raiz.addEventListener('change', alEscribir);
    raiz.addEventListener('keydown', alTecla);
    document.addEventListener('click', ev => { if (empAbierta && !ev.target.closest?.('.fe-buscador')) { empAbierta = false; pintarListaEmpresas(); } });
  }

  // ---------- Lista ----------
  const FILTROS = {
    pendientes: ['Pendientes', f => f.estado === 'pendiente'],
    vencidas: ['Vencidas', f => vencida(f, hoy())],
    pagadas: ['Pagadas', f => f.estado === 'pagada'],
    anuladas: ['Anuladas', f => f.estado === 'anulada'],
    todas: ['Todas', () => true],
  };
  function pintarLista() {
    const t = norm(q).trim();
    const base = lista.filter(f => (!empFiltro || String(f.empresa_id) === empFiltro)
      && (!t || [numeroTxt(f.numero), f.empresa_datos?.nombre, f.empresa_datos?.rif, f.referencia, f.reserva_codigo].some(v => norm(v).includes(t))));
    const mes = hoy().slice(0, 7), pend = base.filter(FILTROS.pendientes[1]), venc = base.filter(FILTROS.vencidas[1]);
    const sum = xs => xs.reduce((s, f) => s + Number(f.total || 0), 0);
    const ir = k => () => { filtro = k; pintarLista(); };
    c.pintarKPIs($('#fe-kpis'), [
      { key: 'pendientes', t: 'Por cobrar', v: usd(sum(pend)), d: `${pend.length} ${pend.length === 1 ? 'factura pendiente' : 'facturas pendientes'}`, i: 'fa-hourglass-half', c: 'var(--amber)', on: filtro === 'pendientes', go: ir('pendientes') },
      { key: 'vencidas', t: 'Vencidas', v: usd(sum(venc)), d: venc.length ? `${venc.length} sin pagar después del vencimiento` : 'ninguna vencida', i: 'fa-triangle-exclamation', c: venc.length ? 'var(--pink)' : 'var(--green)', on: filtro === 'vencidas', go: ir('vencidas') },
      { key: 'pagadas', t: 'Cobrado este mes', v: usd(sum(base.filter(f => f.estado === 'pagada' && String(f.pagada_at || '').slice(0, 7) === mes))), d: 'facturas marcadas como pagadas', i: 'fa-circle-check', c: 'var(--green)', on: filtro === 'pagadas', go: ir('pagadas') },
      { key: 'todas', t: 'Emitidas', v: String(base.filter(f => f.estado !== 'anulada').length), d: 'sin contar anuladas', i: 'fa-file-invoice', c: 'var(--blue)', on: filtro === 'todas', go: ir('todas') },
    ]);
    $('#fe-chips').innerHTML = Object.entries(FILTROS).map(([k, [l, fn]]) => `<button class="pv-stage${filtro === k ? ' on' : ''}" type="button" data-filtro="${k}" aria-pressed="${filtro === k}">${l} · ${base.filter(fn).length}</button>`).join('');
    const sel = $('#fe-emp-filtro'), conFacturas = [...new Set(lista.map(f => f.empresa_id))];
    sel.innerHTML = '<option value="">Todas las empresas</option>' + conFacturas.map(id => {
      const nombre = empresa(id)?.nombre || lista.find(f => f.empresa_id === id)?.empresa_datos?.nombre || 'Empresa';
      return `<option value="${id}" ${String(id) === empFiltro ? 'selected' : ''}>${esc(nombre)}</option>`;
    }).join('');
    const ver = base.filter(FILTROS[filtro][1]);
    $('#fe-lista').innerHTML = ver.map((f, i) => {
      const venc = vencida(f, hoy()), [et, col] = f.estado === 'pagada' ? ['Pagada', 'var(--green)'] : f.estado === 'anulada' ? ['Anulada', 'var(--muted)'] : venc ? ['Vencida', 'var(--pink)'] : ['Pendiente', 'var(--amber)'];
      return `<article class="lt-card${f.estado === 'anulada' ? ' lt-card-hecha' : ''}" style="--i:${Math.min(i, 20)}">
        <div class="lt-card-cab"><div class="lt-card-tit fe-num">${numeroTxt(f.numero)}</div><span class="bt-tag" style="--c:${col}">${et}</span></div>
        <div class="lt-card-meta"><i class="fas fa-building"></i>${esc(f.empresa_datos?.nombre || 'Empresa')}</div>
        ${f.referencia ? `<div class="lt-card-meta"><i class="fas fa-users"></i>${esc(f.referencia)}</div>` : ''}
        <div class="lt-cifras">
          <div><span>Total</span><b>${usd(f.total)}</b></div>
          <div><span>Emitida</span><b>${esc(fechaTxt(f.fecha))}</b></div>
          <div><span>Vence</span><b class="${venc ? 'lt-debe' : ''}">${esc(fechaTxt(f.vence))}</b></div>
        </div>
        <div class="lt-card-pie">
          <button class="btn-sm" type="button" data-acc="pdf" data-id="${f.id}"><i class="fas fa-file-pdf"></i> PDF</button>
          ${f.estado === 'pendiente' ? `<button class="btn-sm lt-primario" type="button" data-acc="pagada" data-id="${f.id}"><i class="fas fa-check"></i> Pagada</button>
            <button class="btn-sm" type="button" data-acc="editar" data-id="${f.id}" aria-label="Editar ${numeroTxt(f.numero)}"><i class="fas fa-pen"></i></button>
            <button class="btn-sm" type="button" data-acc="anular" data-id="${f.id}" aria-label="Anular ${numeroTxt(f.numero)}" title="Anular"><i class="fas fa-ban"></i></button>` : ''}
          ${f.estado === 'pagada' ? `<button class="btn-sm" type="button" data-acc="pendiente" data-id="${f.id}"><i class="fas fa-rotate-left"></i> Pendiente</button>` : ''}
        </div>
      </article>`;
    }).join('') || `<div class="lt-vacio"><i class="fas fa-inbox"></i> ${lista.length ? 'Ninguna factura coincide con el filtro' : 'Todavía no hay facturas: creá la primera con «Nueva factura»'}</div>`;
  }

  // ---------- Editor ----------
  const campo = (lbl, k, v, extra = '', cls = '') => `<div class="field ${cls}"><label class="fl" for="fe-${k}">${lbl}</label><input class="ei" id="fe-${k}" data-k="${k}" value="${esc(v ?? '')}" ${extra}></div>`;
  function coincidencias() {
    const t = norm(empQ).trim();
    return empresas.filter(e => e.activo && (!t || norm(e.nombre).includes(t) || norm(e.rif).includes(t))).slice(0, 8);
  }
  function pintarListaEmpresas() {
    const box = $('#fe-emp-lista');
    if (!box) return;
    box.hidden = !empAbierta;
    if (!empAbierta) return;
    const xs = coincidencias(), t = empQ.trim(), exacta = xs.some(e => norm(e.nombre) === norm(t));
    box.innerHTML = xs.map(e => `<button type="button" class="fe-op" role="option" data-acc="elegir" data-id="${e.id}"><span class="fe-emp-ini">${esc(iniciales(e.nombre))}</span><span><b>${esc(e.nombre)}</b><small>${esc([e.rif, e.dias_credito ? `crédito ${e.dias_credito} días` : 'contado'].filter(Boolean).join(' · '))}</small></span></button>`).join('')
      + (!xs.length && t ? '<div class="fe-vacio" style="padding:11px">No hay ninguna empresa con ese nombre.</div>' : '')
      + (exacta ? '' : `<button type="button" class="fe-op crear" data-acc="crear-empresa"><i class="fas fa-plus"></i> ${t ? `Crear empresa «${esc(t)}»` : 'Crear una empresa nueva'}</button>`);
  }
  function pintarEmpresa() {
    const e = empresa(d.empresa_id), box = $('#fe-empresa');
    if (!e) {
      box.innerHTML = `<div class="fe-buscador"><label class="fl" for="fe-emp-q">¿A qué empresa le facturás?</label>
        <input class="ei" id="fe-emp-q" type="search" placeholder="Escribí el nombre o el RIF…" autocomplete="off" role="combobox" aria-expanded="${empAbierta}" aria-controls="fe-emp-lista" value="${esc(empQ)}">
        <div class="fe-lista" id="fe-emp-lista" role="listbox" hidden></div></div>
        <div class="fe-ayuda">¿No está? Escribí su nombre y tocá «Crear empresa»: cargás su ficha y volvés acá con ella elegida.</div>`;
      pintarListaEmpresas();
      return;
    }
    const faltan = [!e.rif && 'Falta RIF', !e.direccion && 'Falta dirección fiscal'].filter(Boolean);
    box.innerHTML = `<div class="fe-emp"><span class="fe-emp-ini">${esc(iniciales(e.nombre))}</span><div class="fe-emp-cuerpo">
        <b>${esc(e.nombre)}</b>
        <div>${esc([e.rif && `RIF ${e.rif}`, e.dias_credito ? `Crédito ${e.dias_credito} días` : 'Contado'].filter(Boolean).join(' · '))}</div>
        ${e.direccion ? `<div>${esc(e.direccion)}</div>` : ''}
        ${[e.contacto, e.telefono, e.email].some(Boolean) ? `<div>${esc([e.contacto, e.telefono, e.email].filter(Boolean).join(' · '))}</div>` : ''}
        ${faltan.map(x => `<span class="fe-falta"><i class="fas fa-triangle-exclamation"></i> ${x}</span>`).join('')}
        <div class="fe-emp-acc"><button type="button" class="btn-sm" data-acc="ficha"><i class="fas fa-id-card"></i> ${faltan.length ? 'Completar ficha' : 'Editar ficha'}</button>
          ${editando ? '' : '<button type="button" class="btn-sm" data-acc="cambiar"><i class="fas fa-arrows-rotate"></i> Cambiar empresa</button>'}</div>
      </div></div>`;
  }
  function pintarDatos() {
    const e = empresa(d.empresa_id), reservas = e?.reservas || [];
    $('#fe-datos').innerHTML = campo('Fecha de la factura', 'fecha', d.fecha, 'type="date"')
      + campo('Vence', 'vence', d.vence, `type="date" min="${esc(d.fecha)}"`)
      + `<div class="field fe-2"><label class="fl">Condición</label><div class="ei" style="background:transparent;border-style:dashed" id="fe-condicion">${esc(condicionTxt(d.fecha, d.vence))}</div></div>`
      + campo('Referencia o pasajeros <span class="ef-opc">(opcional)</span>', 'referencia', d.referencia, 'maxlength="200" placeholder="Ej. PAX GODOY Y CAMPOS"', 'fe-2')
      + `<div class="field fe-2"><label class="fl" for="fe-reserva_id">Reserva <span class="ef-opc">(opcional)</span></label><select class="ei" id="fe-reserva_id" data-k="reserva_id" ${reservas.length ? '' : 'disabled'}>
          <option value="">${reservas.length ? 'Sin reserva enlazada' : e ? 'La empresa no tiene reservas' : 'Elegí primero la empresa'}</option>
          ${reservas.map(r => `<option value="${r.id}" ${Number(d.reserva_id) === r.id ? 'selected' : ''}>${esc(r.codigo || '#' + r.id)}${r.referencia ? ' · ' + esc(r.referencia) : ''}${r.fecha_viaje_inicio ? ' · ' + esc(fechaTxt(r.fecha_viaje_inicio)) : ''}</option>`).join('')}</select></div>`;
  }
  function pintarItems() {
    $('#fe-items').innerHTML = d.items.map((it, i) => {
      const imp = r2((Number(it.cantidad) || 0) * r2(it.tarifa));
      return `<div class="fe-item" data-i="${i}">
        <div class="fe-item-cab"><b>Concepto ${i + 1}</b><span class="fe-importe" data-importe>${usd(imp)}</span>
          ${d.items.length > 1 ? `<button type="button" class="fe-quitar" data-acc="quitar" aria-label="Quitar concepto ${i + 1}" title="Quitar concepto"><i class="fas fa-trash"></i></button>` : ''}</div>
        <div class="fe-grid">
          <div class="field fe-2${it.descripcion.trim() ? '' : ' fe-falta-campo'}"><label class="fl" for="fe-desc-${i}">Descripción</label><input class="ei" id="fe-desc-${i}" data-k="i.descripcion" value="${esc(it.descripcion)}" maxlength="300" placeholder="Ej. 2 boletos aéreos CCS-PMV-CCS"></div>
          <div class="field"><label class="fl" for="fe-cant-${i}">Cantidad</label><input class="ei" id="fe-cant-${i}" data-k="i.cantidad" value="${esc(it.cantidad)}" type="number" min="0.01" step="any" inputmode="decimal"></div>
          <div class="field${Number(it.tarifa) > 0 ? '' : ' fe-falta-campo'}"><label class="fl" for="fe-tar-${i}">Tarifa (USD)</label><input class="ei" id="fe-tar-${i}" data-k="i.tarifa" value="${esc(it.tarifa)}" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></div>
          <div class="field fe-4"><label class="fl" for="fe-det-${i}">Detalle <span class="ef-opc">(opcional: fechas, ruta, hotel, localizador…)</span></label><input class="ei" id="fe-det-${i}" data-k="i.detalle" value="${esc(it.detalle)}" maxlength="500" placeholder="Ej. Extensión del 03/11 al 05/11"></div>
        </div></div>`;
    }).join('');
  }
  function pintarTotales() {
    $('#fe-totales').innerHTML = campo('Descuento (%)', 'descuento_pct', d.descuento_pct, 'type="number" min="0" max="100" step="0.01" inputmode="decimal"')
      + campo('IVA (%)', 'iva_pct', d.iva_pct, 'type="number" min="0" max="100" step="0.01" inputmode="decimal"')
      + `<div class="field fe-2"><label class="fl" for="fe-tasa_pago">Pago a tasa</label><select class="ei" id="fe-tasa_pago" data-k="tasa_pago">
          ${[['', 'No indicar'], ['USD', 'Tasa USD'], ['EUR', 'Tasa EUR']].map(([v, l]) => `<option value="${v}" ${d.tasa_pago === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
    $('#fe-notas').innerHTML = `<div class="field fe-4"><label class="fl" for="fe-notas-t">Nota para el cliente</label><textarea class="ei" id="fe-notas-t" data-k="notas" rows="2" maxlength="2000">${esc(d.notas)}</textarea></div>
      <div class="field fe-4"><label class="fl" for="fe-cond-t">Condiciones generales <span class="ef-opc">(una por línea)</span></label><textarea class="ei" id="fe-cond-t" data-k="condiciones" rows="4" maxlength="4000">${esc(d.condiciones)}</textarea></div>`;
  }
  function faltan() {
    const xs = [];
    if (!empresa(d.empresa_id)) xs.push('Elegí la empresa');
    if (d.items.some(it => !it.descripcion.trim())) xs.push('Hay conceptos sin descripción');
    if (d.items.some(it => !(Number(it.cantidad) > 0) || !(Number(it.tarifa) >= 0) || it.tarifa === '')) xs.push('Revisá cantidad y tarifa');
    if (calcular(d).subtotal <= 0) xs.push('El total está en $0');
    if (!d.vence || d.vence < d.fecha) xs.push('El vencimiento es antes de la fecha');
    return xs;
  }
  function pintarPrevia() {
    const f = calcular(d), e = empresa(d.empresa_id), xs = faltan();
    $('#fe-estado').innerHTML = editando ? `Editando <b>${numeroTxt(editando.numero)}</b> · se reemite con el mismo número` : 'Factura nueva · el número se asigna al emitir';
    $('#fe-items-res').textContent = `${f.items.length} ${f.items.length === 1 ? 'concepto' : 'conceptos'} · ${usd(f.subtotal)}`;
    $('#fe-previa').innerHTML = `<div class="fe-hoja">
        <div class="fe-hoja-cab"><b>FACTURA</b><span><strong>${editando ? numeroTxt(editando.numero) : 'INV-······'}</strong>${esc(fechaTxt(d.fecha))}</span></div>
        <div class="fe-hoja-a">Facturar a</div><div class="fe-hoja-emp">${esc(e?.nombre || '—')}</div>
        ${e?.rif ? `<div>RIF ${esc(e.rif)}</div>` : ''}
        <div class="fe-hoja-a">Conceptos</div>
        ${f.items.map(it => `<div class="fe-hoja-lin"><span>${esc(it.descripcion || 'Sin descripción')}</span><span>${usd(it.importe)}</span></div>`).join('')}
        <div class="fe-hoja-lin"><span>Subtotal</span><span>${usd(f.subtotal)}</span></div>
        ${f.descuento_pct > 0 ? `<div class="fe-hoja-lin"><span>Descuento (${pct(f.descuento_pct)})</span><span>−${usd(f.descuento)}</span></div>` : ''}
        ${f.iva_pct > 0 ? `<div class="fe-hoja-lin"><span>IVA (${pct(f.iva_pct)})</span><span>${usd(f.iva)}</span></div>` : ''}
        <div class="fe-hoja-tot"><span>Total</span><span>${usd(f.total)}</span></div>
        <div style="margin-top:7px;color:#64748b">Vence ${esc(fechaTxt(d.vence))} · ${esc(condicionTxt(d.fecha, d.vence))}</div>
      </div>
      ${aviso ? `<div class="fe-faltan" style="color:var(--danger);list-style:none;padding:0">${esc(aviso)}</div>` : ''}
      ${xs.length ? `<ul class="fe-faltan">${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
    const g = raiz.querySelector('[data-acc="guardar"]');
    g.innerHTML = editando ? '<i class="fas fa-floppy-disk"></i> Guardar y reemitir' : '<i class="fas fa-file-invoice-dollar"></i> Emitir factura';
    g.disabled = ocupado || xs.length > 0;
    raiz.querySelector('[data-acc="ver"]').disabled = ocupado || xs.length > 0;
  }
  function pintarEditor() { pintarEmpresa(); pintarDatos(); pintarItems(); pintarTotales(); pintarPrevia(); }

  function mostrarVista(v) {
    vista = v;
    raiz.querySelectorAll('.fe-tabs button').forEach(b => { const on = b.dataset.vista === v; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    raiz.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== v; });
    if (v === 'editor') pintarEditor(); else pintarLista();
  }

  function elegirEmpresa(e) {
    if (!e) return;
    d.empresa_id = e.id; empQ = ''; empAbierta = false;
    if (!d.venceManual) d.vence = sumarDias(d.fecha, e.dias_credito || 0);
    if (d.reserva_id && !(e.reservas || []).some(r => r.id === Number(d.reserva_id))) d.reserva_id = null;
    pintarEditor();
  }
  // La ficha es la de Corporativo › Empresas (app.js); al guardar vuelve acá con la empresa al día.
  function abrirFicha(id, nombre) {
    c.fichaEmpresa(id, nombre, async guardada => {
      await cargarEmpresas();
      if (vista === 'editor' && d) elegirEmpresa(empresa(guardada.id) || guardada);
    });
  }

  function alEscribir(ev) {
    const el = ev.target;
    if (el.id === 'fe-buscar') { q = el.value; pintarLista(); return; }
    if (el.id === 'fe-emp-filtro') { empFiltro = el.value; pintarLista(); return; }
    if (el.id === 'fe-emp-q') { empQ = el.value; empAbierta = true; pintarListaEmpresas(); el.setAttribute('aria-expanded', 'true'); return; }
    const k = el.dataset.k;
    if (!k || !d) return;
    aviso = '';
    if (k.startsWith('i.')) {
      const i = Number(el.closest('[data-i]').dataset.i), campoItem = k.slice(2);
      d.items[i][campoItem] = el.value;
      const imp = r2((Number(d.items[i].cantidad) || 0) * r2(d.items[i].tarifa));
      el.closest('[data-i]').querySelector('[data-importe]').textContent = usd(imp);
      el.closest('.field').classList.toggle('fe-falta-campo', campoItem === 'descripcion' ? !el.value.trim() : campoItem === 'tarifa' ? !(Number(el.value) > 0) : false);
      pintarPrevia();
      return;
    }
    d[k] = k === 'reserva_id' ? (el.value ? Number(el.value) : null) : el.value;
    if (k === 'fecha' && d.fecha) {
      if (!d.venceManual) d.vence = sumarDias(d.fecha, empresa(d.empresa_id)?.dias_credito || 0);
      const v = $('#fe-vence'); if (v) { v.value = d.vence; v.min = d.fecha; }
    }
    if (k === 'vence') d.venceManual = true;
    if (k === 'fecha' || k === 'vence') $('#fe-condicion').textContent = condicionTxt(d.fecha, d.vence);
    pintarPrevia();
  }
  function alTecla(ev) {
    if (ev.target.id !== 'fe-emp-q') return;
    if (ev.key === 'Escape') { empAbierta = false; pintarListaEmpresas(); }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const xs = coincidencias();
      if (xs.length === 1) elegirEmpresa(xs[0]); else if (!xs.length && empQ.trim()) abrirFicha(null, empQ.trim());
    }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); $('#fe-emp-lista .fe-op')?.focus(); }
  }
  async function alClic(ev) {
    const v = ev.target.closest('.fe-tabs button');
    if (v) { if (v.dataset.vista === 'editor' && !editando) nueva(); mostrarVista(v.dataset.vista); return; }
    const chip = ev.target.closest('[data-filtro]');
    if (chip) { filtro = chip.dataset.filtro; pintarLista(); return; }
    if (ev.target.id === 'fe-emp-q') { empAbierta = true; pintarListaEmpresas(); return; }
    const b = ev.target.closest('[data-acc]');
    if (!b) return;
    const acc = b.dataset.acc, id = b.dataset.id;
    if (acc === 'elegir') elegirEmpresa(empresa(id));
    else if (acc === 'crear-empresa') { empAbierta = false; pintarListaEmpresas(); abrirFicha(null, empQ.trim()); }
    else if (acc === 'cambiar') { d.empresa_id = null; d.reserva_id = null; empAbierta = true; pintarEditor(); $('#fe-emp-q')?.focus(); }
    else if (acc === 'ficha') abrirFicha(d.empresa_id);
    else if (acc === 'atajo') {
      const vacio = d.items.findIndex(it => !it.descripcion.trim());
      if (vacio >= 0) d.items[vacio].descripcion = b.dataset.t; else d.items.push(itemVacio(b.dataset.t));
      pintarItems(); pintarPrevia();
      raiz.querySelector(`#fe-tar-${vacio >= 0 ? vacio : d.items.length - 1}`)?.focus();
    } else if (acc === 'item') { d.items.push(itemVacio()); pintarItems(); pintarPrevia(); raiz.querySelector(`#fe-desc-${d.items.length - 1}`)?.focus(); }
    else if (acc === 'quitar') { d.items.splice(Number(b.closest('[data-i]').dataset.i), 1); pintarItems(); pintarPrevia(); }
    else if (acc === 'guardar') guardar();
    else if (acc === 'ver') entregar({ ...calcular(d), numero: editando?.numero, estado: 'pendiente', empresa_datos: fotoEmpresa(empresa(d.empresa_id)), reserva_codigo: reservaCodigo() });
    else if (acc === 'cancelar') { nueva(); mostrarVista('lista'); }
    else if (acc === 'pdf') { const f = lista.find(x => x.id === Number(id)); if (f) entregar(f); }
    else if (acc === 'editar') editar(Number(id));
    else if (acc === 'pagada' || acc === 'pendiente') cambiarEstado(Number(id), acc);
    else if (acc === 'anular') anular(Number(id));
  }

  const fotoEmpresa = e => (e ? Object.fromEntries(['nombre', 'rif', 'direccion', 'contacto', 'telefono', 'email', 'dias_credito'].filter(k => e[k] != null && e[k] !== '').map(k => [k, e[k]])) : {});
  const reservaCodigo = () => (empresa(d.empresa_id)?.reservas || []).find(r => r.id === Number(d.reserva_id))?.codigo || null;

  async function entregar(f) {
    try {
      const blob = await construirPdf(f, c);
      await c.entregar(blob, nombreArchivo(f, c.slug));
    } catch (err) { console.error('facturas-empresa pdf', err); c.error('No se pudo armar el PDF. Revisá la conexión e intentá de nuevo.'); }
  }

  async function guardar() {
    if (ocupado || faltan().length) return;
    const e = empresa(d.empresa_id);
    // Sin RIF o dirección la factura no sirve al cliente: se completa la ficha antes de emitir.
    if (!e.rif || !e.direccion) { c.error('Completá el RIF y la dirección fiscal de la empresa antes de emitir.'); abrirFicha(e.id); return; }
    ocupado = true; aviso = ''; pintarPrevia();
    const datos = {
      empresa_id: d.empresa_id, fecha: d.fecha, vence: d.vence, referencia: d.referencia, reserva_id: d.reserva_id,
      items: d.items.map(it => ({ descripcion: it.descripcion.trim(), detalle: it.detalle.trim(), cantidad: Number(it.cantidad), tarifa: Number(it.tarifa) })),
      descuento_pct: Number(d.descuento_pct) || 0, iva_pct: Number(d.iva_pct) || 0, tasa_pago: d.tasa_pago, notas: d.notas, condiciones: d.condiciones,
    };
    const { data, error } = await sb.rpc('guardar_factura_empresa', { p_id: editando?.id ?? null, p_datos: datos });
    ocupado = false;
    if (error || !data?.ok) {
      aviso = error ? (error.code === '42501' ? 'Solo admin o administración pueden emitir facturas.' : 'No se pudo guardar: ' + (error.message || '')) : ERRORES[data?.error] || 'No se pudo guardar: ' + (data?.error || '');
      if (data?.error === 'no_existe') cargarLista();
      pintarPrevia(); return;
    }
    const f = data.factura;
    c.ok(`${editando ? 'Factura reemitida' : 'Factura emitida'}: ${numeroTxt(f.numero)}`);
    lista = [f, ...lista.filter(x => x.id !== f.id)].sort((a, b) => b.numero - a.numero);
    nueva(); filtro = 'pendientes'; mostrarVista('lista');
    entregar(f);
  }

  function editar(id) {
    const f = lista.find(x => x.id === id);
    if (!f || f.estado !== 'pendiente') return;
    editando = f; aviso = ''; empQ = ''; empAbierta = false;
    d = { empresa_id: f.empresa_id, fecha: f.fecha, vence: f.vence, venceManual: true, referencia: f.referencia || '', reserva_id: f.reserva_id,
      items: (f.items || []).map(it => ({ descripcion: it.descripcion || '', detalle: it.detalle || '', cantidad: it.cantidad, tarifa: it.tarifa })),
      descuento_pct: Number(f.descuento_pct) || 0, iva_pct: Number(f.iva_pct) || 0, tasa_pago: f.tasa_pago || '', notas: f.notas || '', condiciones: f.condiciones || '' };
    if (!d.items.length) d.items.push(itemVacio());
    mostrarVista('editor');
  }

  async function cambiarEstado(id, estado, motivo = null) {
    const { data, error } = await sb.rpc('estado_factura_empresa', { p_id: id, p_estado: estado, p_motivo: motivo });
    if (error || !data?.ok) { c.error(error ? 'No se pudo cambiar el estado' : ERRORES[data?.error] || 'No se pudo cambiar el estado'); if (data?.error === 'no_existe') cargarLista(); return; }
    lista = lista.map(x => (x.id === id ? data.factura : x));
    c.ok({ pagada: 'Marcada como pagada', pendiente: 'Volvió a pendiente', anulada: 'Factura anulada' }[estado]);
    pintarLista();
  }
  async function anular(id) {
    const f = lista.find(x => x.id === id);
    if (!f) return;
    const r = await c.confirmar({ titulo: `¿Anular ${numeroTxt(f.numero)}?`, detalle: 'El número queda usado y la factura sale con la marca ANULADA. No se puede deshacer.', textoOk: 'Anular', destructivo: true,
      campos: [{ id: 'motivo', label: 'Motivo', placeholder: 'Ej. se emitió con el monto equivocado', requerido: true }] });
    if (!r) return;
    const motivo = typeof r === 'object' ? String(r.motivo || '').trim() : '';
    if (!motivo) { c.error(ERRORES.motivo_requerido); return; }
    cambiarEstado(id, 'anulada', motivo);
  }

  async function cargarEmpresas() {
    const { data, error } = await sb.rpc('listar_empresas_cliente', { p_solo_activos: false });
    if (error) { c.error('No se pudieron cargar las empresas'); return; }
    empresas = data || [];
  }
  async function cargarLista() {
    const box = $('#fe-lista');
    if (box && !lista.length) box.innerHTML = '<div class="skel-card"></div><div class="skel-card"></div><div class="skel-card"></div>';
    const [{ data, error }] = await Promise.all([sb.rpc('listar_facturas_empresa'), cargarEmpresas()]);
    if (error) { c.error('No se pudieron cargar las facturas'); if (box) box.innerHTML = '<div class="lt-vacio"><i class="fas fa-triangle-exclamation"></i> No se pudieron cargar las facturas</div>'; return; }
    lista = data || [];
    if (vista === 'lista') pintarLista(); else pintarEditor();
  }

  async function cargar() {
    if (!montado) {
      css();
      if (!permitido()) { raiz.innerHTML = '<div class="card fe-vacio">Esta sección es solo para administración.</div>'; return; }
      marco(); nueva(); montado = true; mostrarVista('lista');
    }
    await cargarLista();
  }
  // Desde la ficha de una empresa (botón «Facturar»): abre el editor con ella elegida.
  async function facturarA(empresaId) {
    await cargar();
    if (!montado) return;
    nueva(empresaId); mostrarVista('editor');
  }
  return { cargar, facturarA };
}
