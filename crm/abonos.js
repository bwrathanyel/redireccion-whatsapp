// Abonos de una reserva: lista + alta + anulación.
// Vive aparte de app.js (mismo patrón que documentos-revisiones.js) porque app.js
// ya está en 30k líneas y la UI de abonos tiene su propio ciclo de vida.
// La tabla reserva_abonos no tiene grants: todo pasa por las RPC.
const ERRORES = {
  reserva_no_disponible: 'La reserva no está disponible.',
  lead_fuera_de_ventas: 'El lead tiene que estar en Pago realizado o Venta completa para cobrar un abono.',
  supera_saldo: 'El abono supera el saldo pendiente de la reserva.',
  monto_invalido: 'Escribe un monto mayor a cero, con dos decimales como máximo.',
  moneda_invalida: 'Elige la moneda del pago.',
  metodo_invalido: 'Elige el método de pago.',
  referencia_requerida: 'Escribe la referencia o sube la captura del comprobante.',
  captura_requerida: 'Subí la captura del comprobante del pago (o elegí Efectivo si no hay comprobante).',
  referencia_invalida: 'La referencia es demasiado larga.',
  nota_demasiado_larga: 'La nota es demasiado larga.',
  tasa_no_disponible: 'No hay tasa BCV cargada: registra el abono en dólares o pide que la carguen.',
  comprobante_path_invalido: 'La captura no quedó guardada en tu carpeta. Vuelve a subirla.',
  solicitud_requerida: 'No se pudo identificar la operación. Cierra el formulario y reintenta.',
  solicitud_con_otros_datos: 'Esa operación ya se registró con otros datos. Recarga la reserva y verifica.',
  abono_anulado: 'Ese abono ya estaba anulado.',
  abono_respaldo_no_anulable: 'El saldo anterior es el acumulado que ya tenía la reserva: no se anula desde aquí.',
  abono_no_encontrado: 'El abono no existe.',
  motivo_requerido: 'Explica el motivo con al menos 4 caracteres.',
  motivo_demasiado_largo: 'El motivo es demasiado largo.',
  saldo_incompatible: 'Anular dejaría el acumulado en negativo.',
  conflicto_revision: 'Otro usuario guardó una revisión del voucher. Recarga la reserva y reintenta.',
  documento_anulado: 'El voucher está anulado: no se le puede agregar el abono.',
  sincronizar_solo_pago: 'El voucher cambió de total: esto es una corrección, no un abono. Revisalo desde Voucher.',
  sincronizar_baja_pago: 'El voucher ya declara más cobrado que la reserva. Revisalo desde Voucher.',
};
const METODOS = ['Pago móvil', 'Zelle', 'Efectivo', 'Transferencia', 'TDC', 'Binance'];
const CSS = `
.ab-top{display:flex;flex-wrap:wrap;gap:7px;align-items:stretch;margin:0 0 14px}
.ab-kpi{flex:1 1 92px;min-width:92px;padding:9px 11px;border:1px solid var(--line2);border-radius:10px;background:var(--panel)}
.ab-kpi span{display:block;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.ab-kpi b{font-size:14px;font-weight:800;color:var(--txt)}
.ab-kpi.ab-saldo b{color:var(--accent-ink)}
.ab-nuevo{flex:0 0 auto;min-height:44px}
.ab-form{margin:0 0 14px;padding:14px;border:1px solid var(--line2);border-radius:12px;background:var(--panel)}
.ab-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.ab-tasa{margin:9px 0 0;padding:9px 11px;border-radius:10px;background:var(--accent-soft);color:var(--accent-txt);font-size:11px}
.ab-tasa b{color:var(--txt)}
.ab-chips{display:flex;flex-wrap:wrap;gap:7px;margin:7px 0 0}
.ab-chip{min-height:44px;padding:0 14px;border:1px solid var(--line2);border-radius:999px;background:transparent;color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;transition:all var(--dur-rapida) var(--ease-salida)}
.ab-chip:hover{color:var(--txt);border-color:var(--line2)}
.ab-chip.on{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.ab-acciones{display:flex;flex-wrap:wrap;gap:9px;margin:14px 0 0}
.ab-acciones .dbtn{margin:0}
.ab-lista{display:flex;flex-direction:column;gap:9px;margin:0;padding:0;list-style:none}
.ab-fila{padding:11px 14px;border:1px solid var(--line2);border-radius:10px;background:var(--panel)}
.ab-fila-top{display:flex;flex-wrap:wrap;gap:7px;align-items:baseline}
.ab-fila-top b{font-size:14px;font-weight:800}
.ab-origen{font-size:11px;color:var(--muted)}
.ab-tag{padding:2px 9px;border-radius:999px;border:1px solid var(--line2);font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.ab-tag.ab-respaldo{color:var(--amber);border-color:var(--amber)}
.ab-tag.ab-anulada-tag{color:var(--danger);border-color:var(--danger)}
.ab-fila-sub{margin:4px 0 0;font-size:11px;color:var(--muted)}
.ab-fila.ab-anulada{opacity:.72}
.ab-anular{margin:7px 0 0;padding:0;border:0;background:none;color:var(--danger);font-size:11px;font-weight:700;cursor:pointer}
.ab-aviso{margin:0 0 14px;padding:9px 11px;border:1px solid var(--amber);border-radius:10px;font-size:11px;color:var(--txt)}
.ab-err{margin:11px 0 0;font-size:11px;color:var(--danger);min-height:0}
.ab-ia{margin:7px 0 0;font-size:11.5px;color:var(--muted)}
.ab-vacia{padding:14px;border:1px dashed var(--line2);border-radius:10px;font-size:12px;color:var(--muted)}
.ab-fila-acc{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:7px}
.ab-mini{font-size:10px;font-weight:700;padding:4px 8px;border-radius:7px;border:1px solid var(--line2);background:var(--panel);color:var(--ink);cursor:pointer}
.ab-mini:hover{border-color:var(--brand)}
.ab-mini i{margin-right:3px}
.ab-docs{font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:3px 7px;border-radius:6px;background:#fdf3e6;color:#a56a12}
.ab-docs.fallo{background:#fdeceb;color:#a72b1f}
@media (max-width:420px){.ab-grid{grid-template-columns:1fr}}
`;

export function crearAbonos(c) {
  const { sb, esc } = c;
  const usd = n => '$' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (n, d = 2) => Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const mensaje = e => ERRORES[e?.message || e] || (e?.message || e) || 'No se pudo completar la operación';
  const panel = () => document.querySelector('[data-rv-panel="abonos"]');
  const miUid = () => String(c.usuario() || '');
  let est = { reservaId: null, datos: null, token: 0, tokenIA: 0, metodo: '', moneda: 'USD', archivo: null, guardando: false, formAbierto: false };

  function inyectarCss() {
    if (document.getElementById('ab-css')) return;
    const s = document.createElement('style'); s.id = 'ab-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function asentar() {
    inyectarCss();
    const p = panel(); if (!p) return false;
    p.onclick = e => {
      const b = e.target.closest('[data-ab-accion]'); if (!b) return;
      const a = b.dataset.abAccion;
      if (a === 'nuevo') abrirForm();
      else if (a === 'cerrar') { est.archivo = null; est.formAbierto = false; pintar(); }
      else if (a === 'guardar') guardar(b);
      else if (a === 'anular') anular(Number(b.dataset.id));
      else if (a === 'recibo') verRecibo(b.dataset.id, b);
      else if (a === 'reintentar') reintentarDocumentos(Number(b.dataset.id), b);
      else if (a === 'metodo') {
        // Sin repintar: pintar() recrea el formulario y borraría lo ya escrito.
        est.metodo = b.dataset.metodo;
        p.querySelectorAll('[data-ab-accion="metodo"]').forEach(x => x.classList.toggle('on', x.dataset.metodo === est.metodo));
      }
    };
    p.oninput = e => {
      if (e.target.id === 'ab-monto' || e.target.id === 'ab-moneda') actualizarTasa();
    };
    p.onchange = e => { if (e.target.id === 'ab-file') { est.archivo = e.target.files?.[0] || null; if (est.archivo) leerComprobante(est.archivo); } };
    return true;
  }
  function kpis(d) {
    return `<div class="ab-top">
      <div class="ab-kpi"><span>Total</span><b>${usd(d.monto_total)}</b></div>
      <div class="ab-kpi"><span>Pagado</span><b>${usd(d.monto_pagado)}</b></div>
      <div class="ab-kpi ab-saldo"><span>Saldo</span><b>${usd(d.saldo_pendiente)}</b></div>
      <button class="dbtn save ab-nuevo" type="button" data-ab-accion="nuevo"><i class="fas fa-plus"></i> Abono</button>
    </div>`;
  }
  function avisoCuadre(d) {
    const dif = Number(d.monto_pagado || 0) - Number(d.pagado_con_detalle || 0);
    if (Math.abs(dif) < 0.005) return '';
    return `<p class="ab-aviso">Hay ${usd(dif)} cobrados sin detalle de pago. El próximo abono los agrupa como «Saldo anterior».</p>`;
  }
  function formHtml(d) {
    const chips = METODOS.map(m => `<button class="ab-chip ${m === est.metodo ? 'on' : ''}" type="button" data-ab-accion="metodo" data-metodo="${esc(m)}">${esc(m)}</button>`).join('');
    return `<div class="ab-form">
      <div class="ab-grid">
        <div><label class="fl" for="ab-monto">Monto</label><input class="ei" id="ab-monto" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></div>
        <div><label class="fl" for="ab-moneda">Moneda</label><select class="ei" id="ab-moneda">
          <option value="USD"${est.moneda === 'USD' ? ' selected' : ''}>Dólares (USD)</option>
          <option value="VES"${est.moneda === 'VES' ? ' selected' : ''}>Bolívares (VES)</option></select></div>
      </div>
      <div class="ab-tasa" id="ab-tasa-box" ${est.moneda === 'VES' ? '' : 'hidden'}>Tasa BCV <b id="ab-tasa">${num(d.tasa_ves, 4)}</b> Bs/USD · Equivale a <b id="ab-usd">—</b></div>
      <label class="fl">Método de pago</label>
      <div class="ab-chips">${chips}</div>
      <label class="fl" for="ab-ref">Referencia</label><input class="ei" id="ab-ref" maxlength="120" placeholder="Número de operación">
      <label class="fl" for="ab-nota">Nota (opcional)</label><textarea class="ei" id="ab-nota" maxlength="2000" rows="2"></textarea>
      <label class="fl" for="ab-file">Captura del comprobante del pago</label>
      <input class="ei" id="ab-file" type="file" accept="image/jpeg,image/png,image/webp">
      <p class="ab-ia" id="ab-ia" hidden></p>
      <p class="ab-err" id="ab-err"></p>
      <div class="ab-acciones">
        <button class="dbtn save" type="button" data-ab-accion="guardar"><i class="fas fa-floppy-disk"></i> Registrar abono</button>
        <button class="dbtn gh" type="button" data-ab-accion="cerrar">Cancelar</button>
      </div>
    </div>`;
  }
  function filaHtml(a) {
    const ref = a.referencia ? ` · ${esc(a.referencia)}` : a.comprobante_path ? ' · captura adjunta' : '';
    return `<li class="ab-fila${a.anulado_en ? ' ab-anulada' : ''}">
      <div class="ab-fila-top"><b>${usd(a.monto_usd)}</b>
        <span class="ab-origen">${esc(a.moneda)} ${num(a.monto_original)}${a.moneda === 'VES' && a.tasa_usd_ves ? ` · tasa ${num(a.tasa_usd_ves, 4)}` : ''}</span>
        <span class="ab-tag">${esc(a.metodo)}</span>
        ${a.respaldo ? '<span class="ab-tag ab-respaldo">Sin detalle</span>' : ''}
        ${a.anulado_en ? '<span class="ab-tag ab-anulada-tag">Anulado</span>' : ''}
      </div>
      <p class="ab-fila-sub">${esc(c.fecha(a.fecha))}${ref}${a.asesor ? ' · ' + esc(a.asesor) : ''}</p>
      ${a.anulado_en ? `<p class="ab-fila-sub">Anulado: ${esc(a.anulado_motivo || 'sin motivo')}</p>`
        : a.respaldo ? '' : `<div class="ab-fila-acc">
          ${a.recibo_documento_id ? `<button class="ab-mini" type="button" data-ab-accion="recibo" data-id="${a.recibo_documento_id}"><i class="fas fa-file-pdf"></i>Recibo</button>` : ''}
          ${a.documentos_estado && a.documentos_estado !== 'listo' ? `<span class="ab-docs${a.documentos_estado === 'fallido' ? ' fallo' : ''}" title="${esc(a.documentos_error || '')}">${a.documentos_estado === 'fallido' ? 'Documentos con error' : 'Documentos pendientes'}</span>
            <button class="ab-mini" type="button" data-ab-accion="reintentar" data-id="${a.id}"><i class="fas fa-rotate"></i>Reintentar documentos</button>` : ''}
          <button class="ab-anular" type="button" data-ab-accion="anular" data-id="${a.id}">Anular abono</button>
        </div>`}
    </li>`;
  }
  function pintar() {
    const p = panel(); if (!p || !est.datos) return;
    const d = est.datos, ab = d.abonos || [];
    p.innerHTML = kpis(d) + avisoCuadre(d) + (est.formAbierto ? formHtml(d) : '') +
      (ab.length ? `<ul class="ab-lista">${ab.map(filaHtml).join('')}</ul>`
        : '<p class="ab-vacia">Todavía no hay abonos registrados en esta reserva.</p>');
    if (est.formAbierto) actualizarTasa();
  }
  function actualizarTasa() {
    const box = document.getElementById('ab-tasa-box'); if (!box) return;
    const moneda = document.getElementById('ab-moneda')?.value || est.moneda;
    const monto = Number(document.getElementById('ab-monto')?.value || 0);
    const tasa = Number(est.datos?.tasa_ves || 0);
    box.hidden = moneda !== 'VES';
    if (moneda !== 'VES') return;
    const eq = document.getElementById('ab-usd');
    if (eq) eq.textContent = !monto || !tasa ? '—' : usd(monto / tasa);
  }
  // La captura ya es obligatoria: se aprovecha para prellenar (EF analizar-comprobante).
  // Solo completa lo que está vacío; nunca registra nada.
  async function leerComprobante(archivo) {
    const aviso = document.getElementById('ab-ia'); if (!aviso) return;
    const token = ++est.tokenIA;
    aviso.hidden = false; aviso.textContent = 'Leyendo el comprobante…';
    const imagen = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(null); fr.readAsDataURL(archivo); });
    if (!imagen) { aviso.hidden = true; return; }
    const { data, error } = await sb.functions.invoke('analizar-comprobante', { body: { reserva_id: est.reservaId, mime: archivo.type || 'image/jpeg', imagen } });
    if (token !== est.tokenIA || !document.getElementById('ab-ia')) return;
    if (error || !data?.ok) { aviso.textContent = 'No se pudo leer: completá los datos a mano.'; return; }
    const d = data.datos || {}, puestos = [];
    const monto = document.getElementById('ab-monto'), moneda = document.getElementById('ab-moneda'), ref = document.getElementById('ab-ref');
    if (d.moneda && moneda && !monto.value) { moneda.value = d.moneda; est.moneda = d.moneda; puestos.push('moneda'); }
    if (d.monto != null && monto && !monto.value) { monto.value = d.monto; puestos.push('monto'); }
    if (d.referencia && ref && !ref.value) { ref.value = d.referencia; puestos.push('referencia'); }
    if (d.metodo && METODOS.includes(d.metodo)) {
      est.metodo = d.metodo; puestos.push('método');
      panel()?.querySelectorAll('[data-ab-accion="metodo"]').forEach(x => x.classList.toggle('on', x.dataset.metodo === est.metodo));
    }
    actualizarTasa();
    aviso.textContent = puestos.length ? `Leído del comprobante: ${puestos.join(', ')}${d.banco ? ` (${d.banco})` : ''}. Revisalo antes de registrar.` : 'No se encontraron datos en la captura.';
  }
  function abrirForm() {
    est.metodo = est.metodo || 'Zelle'; est.moneda = 'USD'; est.archivo = null; est.formAbierto = true;
    pintar();
    document.getElementById('ab-monto')?.focus();
  }
  async function cargar(reservaId) {
    const token = ++est.token;
    const p = panel(); if (!p) return;
    p.innerHTML = '<div class="tbl-state skel show"><div class="skel-bar"></div><div class="skel-bar"></div></div>';
    const { data, error } = await sb.rpc('reserva_abonos_lista', { p_reserva_id: reservaId });
    if (token !== est.token || reservaId !== est.reservaId) return;
    if (error || !data?.ok) {
      p.innerHTML = `<p class="ab-vacia">${esc(error?.code === '42501' ? 'Tu usuario no tiene acceso a los abonos de esta reserva.' : rpcErr(error, data))}</p>`;
      return;
    }
    est.datos = data; pintar();
  }
  const rpcErr = (error, data) => mensaje(error?.message || data?.error) || 'No se pudo cargar';
  async function subirCaptura(archivo) {
    const ext = (archivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
    const path = `${miUid()}/abonos/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage.from('vouchers-pdf').upload(path, archivo, { contentType: archivo.type || 'image/jpeg', upsert: false });
    if (up.error) throw new Error('No se pudo subir la captura. Reintenta o registra el abono con referencia.');
    return path;
  }
  async function guardar(btn) {
    if (est.guardando) return;
    const err = document.getElementById('ab-err');
    const poner = m => { if (err) err.textContent = m || ''; };
    poner('');
    const monto = Number(document.getElementById('ab-monto')?.value || 0);
    const moneda = document.getElementById('ab-moneda')?.value || 'USD';
    const referencia = (document.getElementById('ab-ref')?.value || '').trim();
    const nota = (document.getElementById('ab-nota')?.value || '').trim();
    const archivo = est.archivo || document.getElementById('ab-file')?.files?.[0] || null;
    if (!(monto > 0)) return poner(ERRORES.monto_invalido);
    if (!est.metodo) return poner(ERRORES.metodo_invalido);
    if (!archivo && est.metodo !== 'Efectivo') return poner(ERRORES.captura_requerida);
    est.guardando = true;
    btn.disabled = true;
    try {
      const comprobante = archivo ? await subirCaptura(archivo) : null;
      const { data, error } = await sb.rpc('registrar_abono_reserva_v2', {
        p_reserva_id: est.reservaId, p_monto_original: monto, p_moneda: moneda, p_metodo: est.metodo,
        p_solicitud_id: crypto.randomUUID(), p_referencia: referencia || null, p_nota: nota || null,
        p_comprobante_path: comprobante, p_comprobante_datos: null,
      });
      if (error) throw new Error(error.code === '42501' ? 'Tu usuario no puede registrar abonos en esta reserva.' : error.message);
      if (!data?.ok) throw new Error(data?.error || 'Sin respuesta del servidor');
      est.archivo = null;
      est.formAbierto = false;
      // El pago ya quedó: ahora los documentos (voucher revisado + recibo).
      const docs = await cadenaAbono({
        id: data.abono_id, monto_usd: data.monto_usd, monto_original: data.monto_original,
        moneda: data.moneda, tasa_usd_ves: data.tasa_usd_ves, metodo: data.metodo,
        referencia: data.referencia, fecha: new Date().toISOString(),
      }, data.monto_pagado, data.saldo_pendiente);
      if (docs.fallo) c.error(`Abono registrado, pero los documentos no salieron: ${docs.fallo}`);
      else c.ok(`Abono registrado · ${docs.voucherInfo ? `Voucher ${docs.voucherInfo.numero} rev. ${docs.voucherInfo.revision}` : 'sin revisión de voucher'}${docs.reciboId ? ' · Recibo' : ''} · saldo ${usd(data.saldo_pendiente)}`);
      est.datos = null;
      await cargar(est.reservaId);
      c.pagosCambiaron?.();
    } catch (e) {
      poner(mensaje(e));
      c.error(mensaje(e));
    } finally {
      est.guardando = false;
      if (btn?.isConnected) btn.disabled = false;
    }
  }
  async function anular(id) {
    const a = (est.datos?.abonos || []).find(x => Number(x.id) === id); if (!a) return;
    const motivo = await c.pedir({
      titulo: 'Anular abono', detalle: `${usd(a.monto_usd)} · ${a.metodo}. El abono queda marcado y el acumulado de la reserva baja.`,
      label: 'Motivo de la anulación', tipo: 'textarea', requerido: true, textoOk: 'Anular', destructivo: true,
    });
    if (!motivo) return;
    const { data, error } = await sb.rpc('anular_abono_reserva', { p_abono_id: id, p_motivo: motivo });
    if (error) return c.error(error.code === '42501' ? 'Tu usuario no puede anular este abono.' : error.message);
    if (!data?.ok) return c.error(mensaje(data?.error));
    c.ok(`Abono anulado · saldo ${usd(data.saldo_pendiente)}`);
    est.datos = null;
    await cargar(est.reservaId);
    c.pagosCambiaron?.();
  }
  // ------------------------------------------------ documentos del abono (fase 3)
  // El abono (el pago) ya está guardado y es la fuente de verdad: acá solo se arman los
  // documentos. Si algo falla, se registra el error en el abono y queda «Reintentar documentos».
  const diaMesAnio = d => { const f = new Date(d || Date.now()); return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`; };
  async function rpcDoc(fn, args) {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(error.code === '42501' ? 'Tu usuario no puede actualizar el voucher de esta reserva.' : error.message);
    if (data?.ok === false) throw new Error(mensaje(data.error) || 'No se pudo completar la operación');
    return data;
  }
  const puedeGenerar = () => !!(c.librerias && c.membrete && c.pdfVoucher);

  // Revisión automática del voucher con el ajuste sincronizar_abono: sube la revisión y NO
  // vuelve a sumar el pago a la reserva (eso ya lo hizo el abono).
  async function revisarVoucher(abono, pagado, actual) {
    if (!actual || actual.anulado_en || !puedeGenerar()) return null;
    const v = est.datos.voucher;
    const datos = { ...actual, monto_pagado: Number(pagado) };
    const pre = await rpcDoc('documento_preparar', {
      p_tipo: 'voucher', p_id: String(v.id), p_version: actual.revision || 1,
      p_datos: datos, p_finanzas: { tipo: 'sincronizar_abono', abono_id: abono.id },
    });
    if (!pre?.candidato || Number(pre.candidato.monto_pagado) === Number(actual.monto_pagado)) return null;
    const operacion = crypto.randomUUID();
    const pdf = await c.pdfVoucher(pre.candidato);
    const path = `${miUid()}/documentos/voucher/${v.id}/r${pre.candidato.revision}-${operacion}.pdf`;
    const up = await sb.storage.from('vouchers-pdf').upload(path, pdf, { contentType: 'application/pdf' });
    if (up.error && String(up.error.statusCode) !== '409') throw new Error('No se pudo subir el PDF del voucher.');
    const adjunto = c.prepararAdjunto && pre.candidato.reserva_id
      ? await c.prepararAdjunto(pre.candidato.reserva_id, pre.impacto?.servicio_id ?? null, pdf, c.nombreArchivo ? c.nombreArchivo('voucher', pre.candidato) : `Voucher-${pre.candidato.numero_factura || v.id}-r${pre.candidato.revision}.pdf`)
      : null;
    const r = await rpcDoc('documento_guardar', {
      p_tipo: 'voucher', p_id: String(v.id), p_version: actual.revision || 1, p_datos: datos,
      p_motivo: `Abono ${usd(abono.monto_usd)} del ${diaMesAnio(abono.fecha)}`, p_operacion: operacion,
      p_huella: pre.huella, p_pdf_path: path,
      p_finanzas: { tipo: 'sincronizar_abono', abono_id: abono.id }, p_adjunto: adjunto,
    });
    return { revision: r.documento?.revision ?? pre.candidato.revision, documentoId: r.documento?.revision_documento_reserva ?? null, numero: r.documento?.numero_factura || v.numero_factura };
  }

  // Recibo de abono: 1 página con el membrete del voucher.
  async function reciboPdf(d) {
    await c.librerias();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const logo = c.logo ? await c.logo().catch(() => null) : null;
    c.membrete(doc, { F: 'helvetica', st: s => ({ bold: 'bold', semibold: 'bold', medium: 'normal', normal: 'normal' }[s] || 'normal'), logo });
    const X0 = 40, X1 = 572;
    let y = 152;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(20, 32, 60);
    doc.text('RECIBO DE ABONO', X0, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    if (d.codigo) doc.text(`Reserva ${d.codigo}`, X1, y - 12, { align: 'right' });
    if (d.numero) doc.text(`Voucher ${d.numero} · revisión ${d.revision || 1}`, X1, y, { align: 'right' });
    doc.setDrawColor(220, 224, 232); doc.setLineWidth(0.8); doc.line(X0, y + 12, X1, y + 12);
    y += 40;
    const monto = d.moneda === 'VES'
      ? `Bs ${num(d.monto_original)}${d.tasa ? ` · tasa ${num(d.tasa, 4)}` : ''}`
      : usd(d.monto_original);
    const filas = [['Fecha del abono', d.fechaTexto], ['Cliente', d.cliente], ['Monto recibido', monto],
      ['Equivalente en dólares', usd(d.monto_usd)], ['Método de pago', d.metodo], ['Referencia', d.referencia]];
    doc.setFontSize(10);
    filas.filter(([, v]) => v).forEach(([k, v]) => {
      doc.setFont('helvetica', 'normal'); doc.setTextColor(122, 126, 134); doc.text(String(k).toUpperCase(), X0, y);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(28, 32, 40); doc.text(String(v), X1, y, { align: 'right' });
      y += 22;
    });
    y += 8;
    doc.setFillColor(245, 247, 251); doc.roundedRect(X0, y, X1 - X0, 64, 8, 8, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(112, 116, 124);
    doc.text('TOTAL PAGADO DE LA RESERVA', X0 + 16, y + 25);
    doc.text('SALDO PENDIENTE', X0 + 16, y + 47);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20, 32, 60);
    doc.text(usd(d.total_pagado), X1 - 16, y + 27, { align: 'right' });
    doc.setFontSize(12); doc.setTextColor(172, 58, 40);
    doc.text(usd(d.saldo), X1 - 16, y + 49, { align: 'right' });
    y += 96;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(134, 138, 144);
    doc.text('Este recibo corresponde a un abono parcial de la reserva. El documento vigente es el voucher emitido.', X0, y, { maxWidth: X1 - X0 });
    doc.text('Destino y Eventos Lotus 360 · 0241-5144470 / 0424-4634041 · Destinoyeventoslotus360@gmail.com', X0, 806);
    return doc.output('blob');
  }

  async function adjuntarRecibo(blob, nombre) {
    const firma = await sb.functions.invoke('reservas-documentos', { body: { accion: 'subir', reserva_id: est.reservaId, servicio_id: null, tipo: 'recibo_abono', nombre, mime: 'application/pdf', tamano: blob.size } });
    if (firma.error || !firma.data?.ok) throw new Error('No se pudo preparar el recibo en la reserva.');
    const up = await sb.storage.from('reservas-documentos').uploadToSignedUrl(firma.data.path, firma.data.token, blob, { contentType: 'application/pdf' });
    if (up.error) throw new Error('No se pudo subir el recibo a la reserva.');
    const r = await rpcDoc('registrar_documento', { p_reserva_id: est.reservaId, p_servicio_id: null, p_tipo: 'recibo_abono', p_storage_path: firma.data.path, p_nombre: nombre });
    return r.documento_id;
  }

  async function cadenaAbono(abono, pagado, saldo) {
    const d = est.datos || {};
    let actual = null;
    if (d.voucher?.id) { try { actual = (await rpcDoc('documento_historial', { p_tipo: 'voucher', p_id: String(d.voucher.id) }))?.actual || null; } catch { actual = null; } }
    let voucherInfo = null, reciboId = null, fallo = null;
    try {
      voucherInfo = await revisarVoucher(abono, pagado, actual);
    } catch (e) { fallo = mensaje(e); }
    try {
      if (puedeGenerar()) {
        const blob = await reciboPdf({
          codigo: d.codigo, cliente: actual?.cliente_nombre, numero: voucherInfo?.numero || d.voucher?.numero_factura,
          revision: voucherInfo?.revision || d.voucher?.revision, fechaTexto: diaMesAnio(abono.fecha),
          monto_original: abono.monto_original, moneda: abono.moneda, tasa: abono.tasa_usd_ves,
          monto_usd: abono.monto_usd, metodo: abono.metodo, referencia: abono.referencia,
          total_pagado: pagado, saldo,
        });
        reciboId = await adjuntarRecibo(blob, c.nombreArchivo ? c.nombreArchivo('recibo', { cliente: actual?.cliente_nombre, codigo: d.codigo, fecha: abono.fecha }) : `Recibo abono ${diaMesAnio(abono.fecha)}.pdf`);
      }
    } catch (e) { fallo = fallo || mensaje(e); }
    try {
      await rpcDoc('abono_documentos_registrar', {
        p_abono_id: abono.id, p_recibo_documento_id: reciboId,
        p_voucher_documento_id: voucherInfo?.documentoId ?? null,
        p_voucher_revision: voucherInfo?.revision ?? null, p_error: fallo,
      });
    } catch { /* el abono ya está guardado: el estado de documentos no lo puede tumbar */ }
    return { voucherInfo, reciboId, fallo };
  }

  async function verRecibo(documentoId, btn) {
    if (btn) btn.disabled = true;
    const { data, error } = await sb.functions.invoke('reservas-documentos', { body: { accion: 'descargar', documento_id: Number(documentoId) } });
    if (btn) btn.disabled = false;
    if (error || !data?.ok) return c.error('No se pudo abrir el recibo. Reintenta en unos segundos.');
    const w = window.open(data.url, '_blank');
    if (w) w.opener = null; else c.error('El navegador bloqueó la ventana. Permite las ventanas emergentes para ver el recibo.');
  }

  async function reintentarDocumentos(id, btn) {
    const a = (est.datos?.abonos || []).find(x => Number(x.id) === id);
    if (!a || !est.datos) return;
    const previo = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...'; }
    const docs = await cadenaAbono({ id: a.id, monto_usd: a.monto_usd, monto_original: a.monto_original, moneda: a.moneda, tasa_usd_ves: a.tasa_usd_ves, metodo: a.metodo, referencia: a.referencia, fecha: a.fecha }, est.datos.monto_pagado, est.datos.saldo_pendiente);
    if (btn?.isConnected) { btn.disabled = false; btn.innerHTML = previo; }
    if (docs.fallo) c.error(`No se pudieron generar los documentos: ${docs.fallo}`);
    else c.ok('Documentos del abono generados.');
    est.datos = null; await cargar(est.reservaId);
  }

  // Punto de montaje que llama app.js desde rvIniciar.
  function montar(reservaId, conForm) {
    if (!asentar()) return;
    est.reservaId = reservaId;
    est.datos = null; est.archivo = null; est.metodo = conForm ? 'Pago móvil' : ''; est.formAbierto = !!conForm;
    cargar(reservaId);
  }
  return { montar, recargar: () => est.reservaId && cargar(est.reservaId) };
}
