/* Práctica con clientes IA (inducción): el asesor entra directo (sin misiones) y llegan a Leads clientes simulados
   por la Edge Function prueba-cliente-ia y se atienden en WhatsApp empresa con piel de WhatsApp.
   La guía tilda el procedimiento con las señales del mock ('prueba:accion') y del chat; al cerrar,
   la EF evalúa y decide si se sube de nivel. Además de la telemetría, la única salida al proyecto
   real es esa EF (la permite el gate de build-crm-prueba.mjs).
   Plan: ~/.claude/plans/recuerdas-que-la-semana-eager-lake.md */
(() => {
  'use strict';
  const P = window.__PRUEBA, D = window.PRUEBA_DATOS, R = window.PRUEBA_RPCS;
  if (!P || !D || !R) return;
  const URL_IA = 'https://begbjhrdbsqftbbleecb.supabase.co/functions/v1/prueba-cliente-ia';
  const ss = (k, v) => { try { return v === undefined ? sessionStorage.getItem(k) : v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { return null; } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const $ = id => document.getElementById(id);
  const ahora = () => new Date().toISOString();
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const tabla = t => (P.m.tablas[t] ||= []);
  const sesion = ss('clientes:sesion') || (ss('clientes:sesion', crypto.randomUUID()), ss('clientes:sesion'));
  const nombre = () => ss('prueba:nombre') || D.ASESORA;

  /* ---------- Estado ---------- */
  // Examen «hora pico» (nivel 6 en la EF): 3 clientes casi juntos, 60 min, sin guía; aprueba con promedio 75+.
  const EXAMEN = { nivel: 6, clientes: 3, min: 60, aprueba: 75, llegadas: [0, 90e3, 240e3] };
  const leeExamen = () => { try { return JSON.parse(ss('clientes:examen')) || null; } catch { return null; } };
  const S = { activo: ss('clientes:activo') === '1', nivel: 1, pasos: [], sims: new Map(), llegando: false, aviso: null, nSim: 0, examen: leeExamen() };
  const guardaExamen = () => ss('clientes:examen', S.examen ? JSON.stringify(S.examen) : null);
  const enExamen = () => !!S.examen && !S.examen.fin;
  const simDeLead = id => [...S.sims.values()].find(s => s.leadId === Number(id));
  const simDeConv = id => [...S.sims.values()].find(s => s.convId === Number(id));
  const simDeTel = tel => [...S.sims.values()].find(s => s.tel.replace(/\D/g, '') === tel);
  const abiertas = () => [...S.sims.values()].filter(s => !s.cerrada);
  const chatAbierto = () => $('sec-wa-bandeja')?.classList.contains('active') && !$('wb-head')?.hidden
    ? abiertas().find(s => s.cliente.nombre === $('wb-titulo')?.textContent) : null;
  const foco = () => chatAbierto() || abiertas().at(-1) || null;
  window.__pruebaClientes = { activo: () => S.activo, abrirChat };
  const misionPrevia = window.__pruebaMision;
  window.__pruebaMision = () => S.activo ? (foco() ? `cliente-n${foco().nivel}` : 'clientes') : misionPrevia?.() ?? null;

  async function ia(cuerpo) {
    try {
      const r = await P.fetchReal(URL_IA, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(cuerpo) });
      return (await r.json().catch(() => null)) || { ok: false, motivo: 'red' };
    } catch { return { ok: false, motivo: 'red' }; }
  }
  const MOTIVOS = {
    tope: 'La práctica con clientes está en pausa: se llegó al tope de gasto. Avísale a administración.',
    limite_dia: 'Ya atendiste 15 clientes hoy. Mañana sigues.',
    red: 'No hay conexión con el cliente simulado. Revisa internet: se reintenta solo.',
    ia: 'El cliente tardó en contestar. Se reintenta solo.',
  };

  /* ---------- Llegada de un cliente: lead POR ATENDER con su ficha. El chat se abre con Atender y escribe primero el asesor ---------- */
  async function nuevoCliente() {
    if (S.llegando) return;
    S.llegando = true;
    const examen = S.nivel >= EXAMEN.nivel && enExamen() ? S.examen.id : undefined;
    const r = await ia({ accion: 'iniciar', sesion, nombre: nombre(), nivel: S.nivel, examen });
    S.llegando = false;
    if (!r.ok) {
      if (r.motivo === 'examen_lleno' && enExamen()) { S.examen.lanzados = EXAMEN.clientes; guardaExamen(); return; }
      if (r.motivo === 'tope' || r.motivo === 'limite_dia') S.bloqueo = MOTIVOS[r.motivo];
      // En el examen reintenta el reloj del examen (tickExamen), no este temporizador.
      avisa(MOTIVOS[r.motivo] || 'No se pudo traer al próximo cliente.'); if ((r.motivo === 'red' || r.motivo === 'error') && !examen) setTimeout(nuevoCliente, 15000); return; }
    S.pasos = r.pasos || S.pasos;
    if (examen) { S.examen.lanzados++; guardaExamen(); }
    crearSim({ id: r.sim_id, nivel: r.nivel, nivelJuego: r.nivel_juego, titulo: r.titulo, guia: r.guia, cliente: r.cliente, paciencia: r.paciencia_min, examen,
      historial: [] });
    sonido();
  }
  function crearSim(o, rehidratada) {
    const n = ++S.nSim, t = ahora();
    const tel = `+58414777${String(1000 + n + Math.floor(Math.random() * 8000)).slice(-4)}`;
    const f = o.cliente.ficha, destino = f ? `${o.cliente.destino}: ${f.hotel || 'hotel por definir'} · ${f.fechas}` : o.cliente.destino;
    const lead = D.lead(o.cliente.nombre, 'POR ATENDER', destino, { canal: o.cliente.canal, servicio: 'Hospedaje', personas: f?.personas ?? null, fecha_estimada: f?.fecha ?? null });
    Object.assign(lead, { id: 9600 + n, telefono: tel, numero: tel, fecha_creacion: t, lote_asignado_at: t, vence_at: new Date(Date.now() + 3600e3).toISOString(), notas: f ? `Bot: ${f.bot}` : null });
    const sim = { ...o, leadId: lead.id, convId: 700 + n, tel, llego: Date.now(), pasos: { ...(o.pasos || {}) }, pend: nuevoPend(), ocupado: false, otraVez: false,
      escribiendo: false, insistencias: 0, cerrada: false, comprobanteEn: null, registroEn: null, temperatura: null, cots: [], guiaVista: null };
    S.sims.set(sim.id, sim);
    if (rehidratada && o.historial.some(h => h.de === 'asesor')) { lead.estado = 'ATENDIDO'; lead.fecha_primer_contacto = t; }
    tabla('leads').push(lead); P.empuja('leads', 'INSERT', lead);
    if (o.historial.length) abreConv(sim);
    for (const h of o.historial) {
      if (h.de === 'cliente') entrante(sim, h.texto, h.ts);
      else if (h.de === 'asesor') guardaMensaje(sim, { direccion: 'saliente_api', tipo: 'text', texto: h.texto, estado: 'leido', enviado_en: new Date(h.ts).toISOString() });
      if (h.adjunto === 'comprobante') comprobante(sim, pagoDe(sim, h.pago), h.ts);
    }
    if (rehidratada) retoma(sim, o.historial);
    S.activo = true; pinta();
    return sim;
  }
  function abreConv(sim) {
    if (tabla('whatsapp_conversaciones').some(c => c.id === sim.convId)) return;
    const t = ahora();
    const conv = { id: sim.convId, nombre: sim.cliente.nombre, wa_id: sim.tel.slice(1), no_leidos: 0, ultimo_mensaje_at: t, ultimo_entrante_at: t, lead_id: sim.leadId, asesor: D.ASESORA, phone_number_id: 'prueba' };
    tabla('whatsapp_conversaciones').push(conv); P.empuja('whatsapp_conversaciones', 'INSERT', conv);
  }
  // Volver a la práctica no es dejar esperando al cliente: su reloj arranca de nuevo y, si lo último fue del asesor, le contesta.
  function retoma(sim, historial) {
    const delAsesor = historial.filter(h => h.de === 'asesor');
    sim.llego = historial[0]?.ts || sim.llego; sim.ultimoCliente = Date.now();
    sim.textosAsesor = delAsesor.map(h => h.texto);
    if (delAsesor[0]) { sim.atencionEn = delAsesor[0].ts; sim.ultimoAsesor = delAsesor.at(-1).ts; }
    // Las cotizaciones viven en el mock, que se borra al recargar: vuelven las de este chat para el PDF y Crear reserva.
    for (const c of cotsGuardadas()[sim.id] || []) { const fila = { ...c, lead_id: sim.leadId }; tabla('cotizaciones_boleteria').push(fila); sim.cots.push(cotizacionDe(fila)); }
    if (historial.at(-1)?.de === 'asesor' && !sim.comprobanteEn) { sim.respondido = true; setTimeout(() => contesta(sim, true), 3000); }
  }
  const cotsGuardadas = () => { try { return JSON.parse(ss('clientes:cots')) || {}; } catch { return {}; } };
  function guardaCots(sim, c) {
    const t = cotsGuardadas();
    if (c) t[sim.id] = [...(t[sim.id] || []), c].slice(-3); else delete t[sim.id];
    ss('clientes:cots', JSON.stringify(t));
  }
  const nuevoPend = () => ({ textos: [], crm: [], eventos: [], reloj: '' });

  let nMsg = 0;
  function guardaMensaje(sim, campos) {
    const id = 80000 + ++nMsg;
    const fila = { id, conversacion_id: sim.convId, wamid: `prueba-${id}`, direccion: 'entrante', tipo: 'text', texto: null, enviado_en: ahora(), estado: null, error: null,
      enviado_por: campos.direccion === 'entrante' ? null : D.ASESORA, plantilla: null, media_id: null, media_mime: null, media_path: null, transcripcion: null, ...campos };
    tabla('whatsapp_mensajes').push(fila); P.empuja('whatsapp_mensajes', 'INSERT', fila);
    const conv = tabla('whatsapp_conversaciones').find(c => c.id === sim.convId);
    if (conv) {
      conv.ultimo_mensaje_at = fila.enviado_en;
      if (fila.direccion === 'entrante') { conv.ultimo_entrante_at = fila.enviado_en; if (chatAbierto() !== sim) conv.no_leidos = (conv.no_leidos || 0) + 1; }
      P.empuja('whatsapp_conversaciones', 'UPDATE', conv);
    }
    return fila;
  }
  function entrante(sim, texto, ts) {
    sim.ultimoCliente = ts || Date.now(); sim.respondido = false;
    return guardaMensaje(sim, { direccion: 'entrante', texto, enviado_en: new Date(sim.ultimoCliente).toISOString() });
  }
  const tick = (fila, estado) => { fila.estado = estado; P.empuja('whatsapp_mensajes', 'UPDATE', fila); };

  /* ---------- Lo que manda el asesor (mock de whatsapp-enviar) ---------- */
  R.FUNCIONES['whatsapp-enviar'] = (m, a) => {
    if (!a || a.conversacion_id == null) return { ok: true, plantillas: [] };
    const sim = simDeConv(a.conversacion_id);
    if (!tabla('whatsapp_conversaciones').some(c => c.id === Number(a.conversacion_id))) return { __status: 404, body: { ok: false, error: 'sin_acceso' } };
    const archivo = a.archivo instanceof File ? a.archivo : null, imagen = a.tipo === 'imagen';
    const fila = guardaMensaje(sim || { convId: Number(a.conversacion_id) }, archivo
      ? { direccion: 'saliente_api', tipo: imagen ? 'image' : 'document', texto: a.texto || null, estado: 'enviado', media_mime: imagen ? archivo.type : archivo.name, media_path: P.blob(archivo) }
      : { direccion: 'saliente_api', tipo: 'text', texto: String(a.texto || ''), estado: 'enviado' });
    setTimeout(() => fila.estado === 'enviado' && tick(fila, 'entregado'), 700);
    if (sim && !sim.cerrada) saliente(sim, fila, archivo);
    return { ok: true, mensaje: { ...fila } };
  };
  R.RPCS.wa_marcar_leida = (m, a) => {
    const conv = tabla('whatsapp_conversaciones').find(c => c.id === Number(a.p_conversacion));
    if (conv && conv.no_leidos) { conv.no_leidos = 0; P.empuja('whatsapp_conversaciones', 'UPDATE', conv); }
    return { ok: true };
  };

  function saliente(sim, fila, archivo, seg) {
    sim.respondido = true; sim.ultimoAsesor = Date.now(); sim.insistencias = Math.min(sim.insistencias, 1);
    atencion(sim);
    if (fila.tipo === 'audio' && !fila.transcripcion) sim.pend.crm.push(`El asesor te mandó una nota de voz de ${seg} s, pero no se le entiende nada.`);
    else if (fila.tipo === 'text' || fila.tipo === 'audio') {
      const texto = fila.tipo === 'audio' ? `[nota de voz de ${seg} s] ${fila.transcripcion}`.slice(0, 990) : fila.texto;
      sim.pend.textos.push(texto);
      sim.textosAsesor = [...(sim.textosAsesor || []), texto];
    } else if (fila.tipo === 'image') {
      sim.pend.crm.push(`El asesor te mandó una foto${fila.texto ? ` con el texto «${fila.texto}»` : ''}.`);
      marca(sim, 'opciones');
    } else {
      const cot = sim.cots.at(-1) || ultimaCotizacion(sim);
      if (cot) {
        sim.pend.crm.push(`El asesor te mandó un PDF «${archivo?.name || 'cotización'}»: ${cot.detalle}. Total ${cot.total ?? '?'} $.`);
        sim.pend.eventos.push({ tipo: 'cotizacion', total: cot.total, detalle: cot.detalle.slice(0, 300) });
        marca(sim, 'cotizacion');
      } else sim.pend.crm.push(`El asesor te mandó un PDF «${archivo?.name || 'archivo'}» que no es una cotización (no trae precios).`);
      if (fila.texto) sim.pend.textos.push(fila.texto);
    }
    programa(sim);
  }
  // Como una persona real: espera a que el asesor termine de escribir (5 s sin mensajes nuevos, más si sigue tecleando).
  function programa(sim, extra = 0) {
    clearTimeout(sim.timer);
    sim.timer = setTimeout(() => {
      const tecleando = chatAbierto() === sim && ($('wb-texto')?.value || '').trim();
      if (voz?.sim === sim || (tecleando && extra < 12000)) return programa(sim, extra + 3000);
      contesta(sim);
    }, 5000 + (extra ? 3000 : 0));
  }

  async function contesta(sim, reintento) {
    if (sim.cerrada) return;
    if (sim.ocupado) { sim.otraVez = true; return; }
    const p = sim.pend;
    if (!reintento && !p.textos.length && !p.crm.length && !p.reloj) return;
    sim.pend = nuevoPend(); sim.ocupado = true;
    await espera(600 + Math.random() * 900);
    tabla('whatsapp_mensajes').filter(f => f.conversacion_id === sim.convId && f.direccion !== 'entrante' && f.estado !== 'leido').forEach(f => tick(f, 'leido'));
    const r = await ia({ accion: 'responder', sesion, sim_id: sim.id, textos: p.textos, crm: p.crm, eventos: p.eventos, reloj: p.reloj, pasos: sim.pasos, reintento: !!reintento });
    if (!r.ok) {
      sim.ocupado = false;
      if (r.motivo === 'cerrada' || r.motivo === 'forma') return;
      if (r.motivo === 'tope' || r.motivo === 'turnos') { avisa(MOTIVOS[r.motivo] || 'Este chat llegó a su límite de mensajes.'); return cierra(sim, 'limite'); }
      // 'ia': la EF ya guardó lo del asesor, el reintento va vacío. 'red': no llegó nada, se reenvía igual.
      if (r.motivo === 'red') sim.pend = { textos: [...p.textos, ...sim.pend.textos], crm: [...p.crm, ...sim.pend.crm], eventos: [...p.eventos, ...sim.pend.eventos], reloj: p.reloj || sim.pend.reloj };
      avisa(MOTIVOS[r.motivo] || MOTIVOS.ia);
      setTimeout(() => contesta(sim, r.motivo !== 'red'), 5000);
      return;
    }
    S.aviso = null;
    Object.assign(sim, { temperatura: r.temperatura, decision: r.decision });
    if (r.decision === 'comprar') marca(sim, 'objeciones');
    const logros = (r.logros || []).filter(l => !sim.pasos[l]);
    if (logros.length) { logros.forEach(l => { sim.pasos[l] = true; }); pinta(true); }
    const burbujas = [...(r.burbujas || [])], pago = r.adjunto === 'comprobante' ? pagoDe(sim, r.pago) : null;
    // El cliente siempre dice cuánto abonó: si el modelo no lo escribió, se agrega y coincide con la captura.
    if (pago && !burbujas.join(' ').replace(/[.,\s]/g, '').includes(String(Math.trunc(pago.dicho)))) burbujas.push(`Te aboné ${pago.dichoTexto} por ${pago.metodo}`);
    await escribe(sim, burbujas);
    if (pago) { await espera(1500); comprobante(sim, pago); marca(sim, 'cierre'); }
    sim.ocupado = false;
    if (r.decision === 'irse') { setTimeout(() => cierra(sim, 'perdido'), 5000); return; }
    if (sim.otraVez) { sim.otraVez = false; contesta(sim); }
    pinta();
  }
  async function escribe(sim, burbujas) {
    for (const [i, b] of burbujas.entries()) {
      sim.escribiendo = true; pinta(); pintaEscribiendo();
      await espera(Math.min(Math.max(b.length * 45, 1300), 6500) + (i ? 500 : 0));
      sim.escribiendo = false;
      if (sim.cerrada) return;
      entrante(sim, b);
      pintaEscribiendo();
    }
    pinta();
  }

  /* ---------- Comprobante de pago del cliente (imagen según el método + lectura «IA» como en el CRM real) ---------- */
  const EN_BS = new Set(['Pago móvil', 'Transferencia bancaria', 'Efectivo Bs', 'Punto de venta']);
  const METODO_EN_TEXTO = [[/zelle/i, 'Zelle'], [/pago\s*m[oó]vil/i, 'Pago móvil'], [/binance|usdt/i, 'Binance / USDT'], [/punto\s*de\s*venta/i, 'Punto de venta'],
    [/efectivo.*(bs|bol[ií]var)/i, 'Efectivo Bs'], [/efectivo/i, 'Efectivo USD'], [/transferencia/i, 'Transferencia bancaria']];
  const dos = n => Math.round(n * 100) / 100;
  const cifra = n => Number(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const digitos = n => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
  const letras = n => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  // El último método que nombró el asesor, por si el modelo no lo devuelve.
  function metodoPedido(sim) {
    for (const t of [...(sim.textosAsesor || [])].reverse()) { const h = METODO_EN_TEXTO.find(([re]) => re.test(t)); if (h) return h[1]; }
    return 'Zelle';
  }
  function pagoDe(sim, p) {
    const metodo = p?.metodo || metodoPedido(sim), dado = Number(p?.monto) > 0 ? Number(p.monto) : montoAbono(sim), enBs = Number(p?.monto) > 0 && p?.moneda === 'VES', enEur = Number(p?.monto) > 0 && p?.moneda === 'EUR';
    const usd = dos(enBs ? dado / R.TASA_VES : enEur ? dado * R.TASAS_VES.EUR / R.TASA_VES : dado);
    return { metodo, usd, eur: enEur ? dado : 0, bs: EN_BS.has(metodo) ? (enBs ? dado : dos(usd * R.TASA_VES)) : 0, dicho: dado, dichoTexto: enBs ? `Bs ${cifra(dado)}` : `${enEur ? '€' : '$'}${cifra(dado)}` };
  }
  // No imitan a ningún banco ni billetera: cada método tiene su forma de comprobante y llevan la marca de práctica.
  const RECIBOS = {
    zelle: { metodo: 'Zelle', titulo: 'Pago enviado', cabeza: '#5b21b6', ref: () => letras(9), etqRef: 'Confirmación', filas: [['Para', 'Destinos y Eventos Lotus'], ['Correo', 'pagos@lotus-prueba.test'], ['Nota', 'Abono reserva']] },
    'pago-movil': { metodo: 'Pago móvil', titulo: 'Pago móvil', cabeza: '#0f766e', ref: () => digitos(12), etqRef: 'Referencia', filas: [['Teléfono destino', '0414-000-0360'], ['RIF destino', 'J-00000000-0'], ['Concepto', 'Abono reserva']] },
    transferencia: { metodo: 'Transferencia bancaria', titulo: 'Transferencia exitosa', cabeza: '#1e3a8a', ref: () => digitos(8), etqRef: 'Nro. de operación', filas: [['Beneficiario', 'Destinos y Eventos Lotus'], ['Cuenta destino', '•••• •••• 0360'], ['Concepto', 'Abono reserva']] },
    binance: { metodo: 'Binance / USDT', titulo: 'Envío completado', cabeza: '#111827', fondo: '#1f2937', tinta: '#f9fafb', tenue: '#9ca3af', moneda: 'USDT', ref: () => digitos(18), etqRef: 'ID de orden', filas: [['Red', 'TRC20'], ['Para', 'Lotus 360 (práctica)'], ['Estado', 'Completado']] },
    'efectivo-usd': { metodo: 'Efectivo USD', titulo: 'Recibo de caja', cabeza: '#92400e', fondo: '#fffbeb', ref: () => 'REC-' + digitos(5), etqRef: 'Recibo', filas: [['Recibió', 'Oficina Lotus 360'], ['Forma', 'Efectivo en dólares'], ['Concepto', 'Abono reserva']] },
    'efectivo-bs': { metodo: 'Efectivo Bs', titulo: 'Recibo de caja', cabeza: '#92400e', fondo: '#fffbeb', ref: () => 'REC-' + digitos(5), etqRef: 'Recibo', filas: [['Recibió', 'Oficina Lotus 360'], ['Forma', 'Efectivo en bolívares'], ['Concepto', 'Abono reserva']] },
    punto: { metodo: 'Punto de venta', titulo: 'APROBADA', cabeza: '#374151', letra: "'Courier New',monospace", ref: () => digitos(6), etqRef: 'Ref.', filas: [['Comercio', 'LOTUS 360'], ['Terminal', '00036001'], ['Tarjeta', 'DÉBITO **** 0360']] },
    otro: { metodo: 'Otro', titulo: 'Pago realizado', cabeza: '#374151', ref: () => digitos(10), etqRef: 'Referencia', filas: [['Para', 'Destinos y Eventos Lotus'], ['Concepto', 'Abono reserva']] },
  };
  const claveRecibo = metodo => Object.keys(RECIBOS).find(k => RECIBOS[k].metodo === metodo) || 'otro';
  function montoAbono(sim) {
    const textos = (sim.textosAsesor || []).slice(-6).join(' ');
    const m = [...textos.matchAll(/(?:\$\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:\$|d[oó]lares|usd))/gi)].at(-1);
    const v = m ? Number((m[1] || m[2]).replace(',', '.')) : NaN;
    return Number.isFinite(v) && v > 0 ? v : Math.round((sim.cots.at(-1)?.total || 200) / 2);
  }
  function comprobante(sim, pago, ts) {
    const clave = claveRecibo(pago.metodo), ref = RECIBOS[clave].ref(), bs = pago.bs;
    const fila = guardaMensaje(sim, { direccion: 'entrante', tipo: 'image', texto: null, media_mime: 'image/svg+xml', media_path: `prueba-comprobante/${clave}/${pago.usd}/${bs}/${ref}${pago.eur ? `/eur/${pago.eur}` : ''}`,
      enviado_en: new Date(ts || Date.now()).toISOString() });
    const c = { id: 500 + fila.id, conversacion_id: sim.convId, wamid: fila.wamid, estado: 'pendiente', duplicado_de: null,
      datos: { metodo: pago.metodo, referencia: ref, monto: bs || pago.eur || pago.usd, moneda: bs ? 'VES' : pago.eur ? 'EUR' : 'USD', monto_usd: pago.usd, fecha: new Date().toLocaleDateString('es-VE') } };
    tabla('wa_comprobantes').push(c); P.empuja('wa_comprobantes', 'INSERT', c);
    sim.comprobanteEn = Date.now();
  }
  window.__pruebaComprobante = s => {
    const [, clave = 'otro', usd = '0', bs = '0', ref = '', eur = '0'] = /prueba-comprobante\/([\w-]+)\/([\d.]+)\/([\d.]+)\/([\w-]+)(?:\/eur\/([\d.]+))?/.exec(s) || [];
    const r = RECIBOS[clave] || RECIBOS.otro, fondo = r.fondo || '#ffffff', tinta = r.tinta || '#111827', tenue = r.tenue || '#6b7280';
    const fecha = new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
    const monto = Number(bs) > 0 ? `Bs ${cifra(bs)}` : r.moneda ? `${cifra(usd)} ${r.moneda}` : Number(eur) > 0 ? `€ ${cifra(eur)}` : `$ ${cifra(usd)}`;
    const filas = [['Fecha', fecha], [r.etqRef, ref], ...r.filas, ...(Number(bs) > 0 ? [['Equivale a', Number(eur) > 0 ? `€ ${cifra(eur)}` : `$ ${cifra(usd)}`]] : [])];
    const lineas = filas.map(([a, b], i) => { const y = 310 + i * 28; return `<text x="28" y="${y}" font-size="14" fill="${tenue}">${esc(a)}</text><text x="332" y="${y}" font-size="14" fill="${tinta}" text-anchor="end" font-weight="600">${esc(b)}</text>`; }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="520" viewBox="0 0 360 520" font-family="${(r.letra || 'Arial,Helvetica,sans-serif').replace(/"/g, '')}">
<rect width="360" height="520" fill="${fondo}"/><rect width="360" height="84" fill="${r.cabeza}"/><text x="180" y="52" fill="#fff" font-size="21" text-anchor="middle" font-weight="700">${esc(r.metodo)}</text>
<circle cx="180" cy="142" r="32" fill="#16a34a"/><path d="M165 142l10 10 21-22" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="180" y="210" font-size="17" text-anchor="middle" fill="${tinta}">${esc(r.titulo)}</text><text x="180" y="262" font-size="34" text-anchor="middle" font-weight="700" fill="${tinta}">${esc(monto)}</text>
${lineas}
<text x="180" y="500" font-size="11" text-anchor="middle" fill="${tenue}">Comprobante de práctica · no es un pago real</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
  // «Leer captura» en la hoja de Crear reserva: no hay IA que lea la imagen, se toma el último pago sin registrar.
  R.FUNCIONES['leer-comprobante'] = () => {
    const c = tabla('wa_comprobantes').filter(x => x.estado === 'pendiente').at(-1)?.datos, fecha = new Date().toISOString().slice(0, 10);
    return { ok: true, datos: { metodo: c?.metodo || 'Zelle', referencia: c?.referencia || letras(9), monto: c?.monto_usd ?? 100, moneda: 'USD', fecha, confianza: 0.95 } };
  };
  // La reserva creada guarda la captura y deja el comprobante del chat como registrado.
  const crearReserva = R.RPCS.crear_reserva_con_servicios;
  R.RPCS.crear_reserva_con_servicios = (m, a) => {
    const leadId = Number(a.p_lead_id), conv = tabla('whatsapp_conversaciones').find(c => c.lead_id === leadId);
    const comp = conv && tabla('wa_comprobantes').find(x => x.conversacion_id === conv.id && x.estado === 'pendiente' && x.datos?.referencia === a.p_referencia_pago);
    const foto = comp && tabla('whatsapp_mensajes').find(x => x.wamid === comp.wamid)?.media_path;
    const r = crearReserva(m, { ...a, p_comprobante_path: foto ?? null });
    if (!r.ok) return r;
    if (comp) { comp.estado = 'registrado'; P.empuja('wa_comprobantes', 'UPDATE', comp); }
    const lead = tabla('leads').find(x => x.id === leadId); if (lead) P.empuja('leads', 'UPDATE', lead);
    const sim = simDeLead(leadId); if (sim && r.monto_pagado > 0) registro(sim);
    return r;
  };
  // Botón junto a la foto: la hoja la abre whatsapp-bandeja.js. En captura, para vincular antes su cotización al lead.
  document.addEventListener('click', e => {
    const id = e.target.closest?.('[data-wb-reserva]')?.dataset.wbReserva; if (!id) return;
    const c = tabla('wa_comprobantes').find(x => x.id === Number(id)), leadId = c && tabla('whatsapp_conversaciones').find(x => x.id === c.conversacion_id)?.lead_id;
    if (!leadId) return;
    // La cotización pudo armarse sin vincular el cliente: la precarga de la hoja busca por lead.
    const cots = tabla('cotizaciones_boleteria');
    if (!cots.some(x => x.lead_id === leadId)) { const suelta = cots.filter(x => x.lead_id == null).at(-1); if (suelta) suelta.lead_id = leadId; }
  }, true);

  /* ---------- Señales del CRM que tildan pasos ---------- */
  const PASO_PAGO = new Set(['PAGO REALIZADO', 'VENTA COMPLETA']);
  function ultimaCotizacion(sim) {
    const c = tabla('cotizaciones_boleteria').filter(x => x.lead_id === sim.leadId || x.lead_id == null).at(-1);
    return c ? cotizacionDe(c) : null;
  }
  const cotizacionDe = c => ({
    total: Number.isFinite(Number(c.total)) ? Number(c.total) : null,
    detalle: (c.items || []).map(it => Object.entries(it).filter(([k, v]) => v !== '' && v != null && typeof v !== 'object' && !/(^id$|_id$|^_)/.test(k)).map(([k, v]) => `${k}: ${v}`).join(', ').slice(0, 300)).join(' | ')
      + (c.fecha ? ` (emitida ${c.fecha}${c.vence ? `, vence ${c.vence}` : ''})` : ''),
  });
  addEventListener('prueba:accion', e => {
    const d = e.detail || {};
    if (!S.activo || d.error) return;
    if (d.tipo === 'insert' && d.tabla === 'cotizaciones_boleteria') {
      for (const c of d.filas || []) { const sim = simDeLead(c.lead_id) || foco(); if (sim) { sim.cots.push(cotizacionDe(c)); guardaCots(sim, c); marca(sim, 'tarifario'); evento(sim, { tipo: 'cotizacion_creada', total: Number(c.total) || null }); } }
      return;
    }
    if (d.tipo === 'update' && d.tabla === 'leads') { (d.filas || []).forEach(f => { const s = simDeLead(f.id); if (s) marca(s, 'ficha'); }); return; }
    if (d.tipo !== 'rpc') return;
    const a = d.args || {}, sim = simDeLead(a.p_lead_id);
    if (!sim) return;
    if (d.nombre === 'actualizar_lead') {
      if (a.p_estado && a.p_estado !== 'POR ATENDER') abreConv(sim);
      if (a.p_estado === 'ATENDIDO' && !sim.atendido) {
        sim.atendido = Date.now();
        const seg = Math.round((sim.atendido - sim.llego) / 1000);
        evento(sim, { tipo: 'atendido', seg });
        atencion(sim);
      }
      if (Object.keys(a).some(k => !['p_lead_id', 'p_estado'].includes(k) && a[k] != null && a[k] !== '')) marca(sim, 'ficha');
      if (a.p_estado) evento(sim, { tipo: 'estado', estado: a.p_estado });
      if (PASO_PAGO.has(a.p_estado)) registro(sim);
    } else if (['guardar_notas_lead', 'fijar_proxima_accion', 'registrar_interaccion_lead'].includes(d.nombre)) marca(sim, 'ficha');
    else if ((d.nombre === 'guardar_postventa' && a.p_marcar_pagado) || /^registrar_abono/.test(d.nombre) || d.nombre === 'voucher_preparar') registro(sim);
  });
  // Atender o escribirle cuenta igual. Pasados 2 min el paso queda perdido, pero no frena la guía.
  function atencion(sim) {
    if (sim.atencionEn) return;
    sim.atencionEn = Date.now();
    const seg = Math.round((sim.atencionEn - sim.llego) / 1000);
    if (seg <= 120) return marca(sim, 'rapidez');
    sim.tarde = true;
    avisa(`Lo atendiste a los ${Math.round(seg / 60)} min: con un cliente real, a esa altura ya le escribió a otra agencia.`);
  }
  function registro(sim) {
    if (sim.registroEn) return;
    sim.registroEn = Date.now(); marca(sim, 'registro'); evento(sim, { tipo: 'pago_registrado' });
    if (sim.comprobanteEn) setTimeout(() => cierra(sim, 'vendido'), 12000);
  }
  let busca = null;
  document.addEventListener('input', e => {
    if (!S.activo || !e.target.matches?.('#tar-search,[id*="tar-"][type="search"]')) return;
    clearTimeout(busca);
    busca = setTimeout(() => { const s = foco(), v = e.target.value.trim(); if (s && v.length > 2) { marca(s, 'tarifario'); evento(s, { tipo: 'busqueda', texto: v.slice(0, 60) }); } }, 1200);
  }, true);
  document.addEventListener('click', e => { if (S.activo && e.target.closest?.('#sec-tarifario')) { const s = foco(); if (s) marca(s, 'tarifario'); } }, true);
  function marca(sim, paso) {
    if (sim.pasos[paso]) return;
    sim.pasos[paso] = true;
    ia({ accion: 'marcar', sesion, sim_id: sim.id, pasos: sim.pasos });
    pinta(true);
  }
  const evento = (sim, ev) => { sim.pend.eventos.push({ ...ev, ts: Date.now() }); };

  /* ---------- Reloj: el cliente reclama si lo dejan esperando ---------- */
  setInterval(() => {
    if (!S.activo || document.hidden) return;
    for (const sim of abiertas()) {
      if (sim.ocupado || sim.escribiendo) continue;
      // Pagó y nadie lo registró: a los 5 min se evalúa igual (el paso queda sin hacer).
      if (sim.comprobanteEn && !sim.registroEn && Date.now() - sim.comprobanteEn > 5 * 60e3) { cierra(sim, 'vendido'); continue; }
      // Hasta que el asesor le escribe por primera vez, el cliente no reclama: escribe primero el asesor.
      if (!sim.ultimoAsesor || sim.respondido || sim.comprobanteEn) continue;
      const min = (Date.now() - sim.ultimoCliente) / 60e3, umbral = sim.paciencia * [0.5, 1, 1.6][sim.insistencias];
      if (umbral && min >= umbral) {
        sim.insistencias++;
        sim.pend.reloj = `Pasaron ${Math.round((Date.now() - sim.llego) / 60e3)} minutos desde tu primer mensaje y ${Math.round(min)} desde el último sin respuesta del asesor.`;
        contesta(sim);
      }
    }
    if (enExamen()) tickExamen();
    pinta();
  }, 5000);

  /* ---------- Cierre y evaluación ---------- */
  async function cierra(sim, motivo) {
    if (sim.cerrada) return;
    sim.cerrada = true; clearTimeout(sim.timer); guardaCots(sim);
    pinta();
    // En el examen la tarjeta de cada chat taparía a los otros clientes: se ve todo junto al final.
    if (sim.examen) avisa(`Se cerró el chat con ${sim.cliente.nombre}. Su puntaje lo ves al terminar el examen.`); else tarjeta(null, sim);
    const pend = sim.pend; sim.pend = nuevoPend();
    let r = await ia({ accion: 'evaluar', sesion, sim_id: sim.id, motivo, pasos: sim.pasos, eventos: pend.eventos });
    for (let i = 0; !r.ok && r.motivo !== 'tope' && r.motivo !== 'sim' && i < 2; i++) { await espera(4000); r = await ia({ accion: 'evaluar', sesion, sim_id: sim.id, motivo, pasos: sim.pasos }); }
    if (r.ok) { if (r.nivel) S.nivel = r.nivel; ss('clientes:nivel', String(S.nivel)); }
    if (sim.examen) return examenCerrado(sim, r);
    tarjeta(r, sim);
  }

  /* ---------- Examen «hora pico» ---------- */
  function presentaExamen() {
    const M = window.__pruebaMisiones;
    if (!M || $('prueba-modal')) return;
    M.modal([
      { icono: '⏱️', titulo: 'Examen «hora pico»', texto: `Pasaste los 5 niveles. Ahora llegan <b>${EXAMEN.clientes} clientes casi juntos</b> y tienes <b>${EXAMEN.min} minutos</b> para atenderlos a todos, sin guía. Cambias de chat con los nombres del panel o desde WhatsApp empresa.` },
      { icono: '🎯', titulo: 'Cómo se aprueba', texto: `Con un promedio de <b>${EXAMEN.aprueba} o más</b> entre los ${EXAMEN.clientes} chats. Cada chat que cierras se evalúa, y al final ves el resultado de los ${EXAMEN.clientes}. Al aprobar, administración te asigna clientes reales.` },
    ], 'Empezar el examen', iniciaExamen);
  }
  function iniciaExamen() {
    S.examen = { id: crypto.randomUUID(), inicio: Date.now(), lanzados: 0 }; guardaExamen();
    $('pc-nota')?.remove(); tickExamen(); pinta();
  }
  function tickExamen() {
    const E = S.examen, t = Date.now() - E.inicio;
    if (t >= EXAMEN.min * 60e3) {
      if (E.lanzados < EXAMEN.clientes) { E.lanzados = EXAMEN.clientes; guardaExamen(); }
      return abiertas().filter(s => s.examen === E.id).forEach(s => cierra(s, 'tiempo'));
    }
    if (E.lanzados < EXAMEN.clientes && t >= EXAMEN.llegadas[E.lanzados] && !S.llegando && !S.bloqueo) nuevoCliente();
  }
  async function examenCerrado(sim, r) {
    sim.eval = r.ok ? r : { puntaje: null };
    const E = S.examen;
    if (!E || E.id !== sim.examen || E.fin) return;
    const delExamen = [...S.sims.values()].filter(s => s.examen === E.id);
    let ex = r.examen;
    // Dos chats evaluados a la vez no se ven entre sí en la EF: se vuelve a pedir el último y ahí se cierra.
    if (!ex && E.lanzados >= EXAMEN.clientes && delExamen.length >= EXAMEN.clientes && delExamen.every(s => s.eval)) ex = (await ia({ accion: 'evaluar', sesion, sim_id: sim.id })).examen;
    if (ex) finExamen(ex, delExamen);
  }
  function finExamen(ex, sims) {
    S.examen.fin = ex; guardaExamen();
    for (const s of sims) S.sims.delete(s.id);
    pinta();
    $('pc-nota')?.remove();
    const m = document.createElement('div');
    m.id = 'pc-nota'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    const filas = sims.length === ex.puntajes?.length
      ? sims.map(s => `<div class="pc-paso"><span>${esc(s.cliente.nombre)}${s.eval?.hechos?.resultado === 'vendido' ? ' · ✅ venta' : ''}</span><i style="--v:${s.eval?.puntaje ?? 0}%;--c:${PUNTOS(s.eval?.puntaje ?? 0)}"></i><b>${s.eval?.puntaje ?? '—'}</b></div>`).join('')
      : (ex.puntajes || []).map((p, i) => `<div class="pc-paso"><span>Cliente ${i + 1}</span><i style="--v:${p}%;--c:${PUNTOS(p)}"></i><b>${p}</b></div>`).join('');
    const mejoras = sims.flatMap(s => (s.eval?.mejoras || []).slice(0, 1));
    m.innerHTML = `<div class="pc-caja pc-larga">
      <div class="pc-cab"><div class="pc-puntaje" style="--c:${PUNTOS(ex.promedio)}"><b>${ex.promedio}</b><small>promedio</small></div>
        <div><h3>Examen «hora pico»</h3><p class="pc-estado ${ex.aprobado ? 'ok' : ''}">${ex.aprobado ? 'Aprobado' : `No aprobado: hace falta un promedio de ${EXAMEN.aprueba}`}</p></div></div>
      ${ex.aprobado ? '<div class="pc-subio">🎉 ¡Aprobaste la inducción! Administración ya lo ve y te asigna clientes reales.</div>' : ''}
      <div class="pc-pasos-fin">${filas}</div>
      ${mejoras.length ? `<div class="pc-cols"><div><h4>Para mejorar</h4><ul>${mejoras.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>` : ''}
      <div class="pc-acc">${ex.aprobado ? '<button class="pp-ir" data-pc="listo">Listo</button>' : '<button data-pc="listo">Cerrar</button><button class="pp-ir" data-pc="examen">Repetir el examen</button>'}</div></div>`;
    m.addEventListener('click', e => {
      const b = e.target.closest('[data-pc]'); if (!b) return;
      m.remove();
      if (b.dataset.pc === 'examen') repiteExamen();
    });
    document.body.appendChild(m);
    m.querySelector('[data-pc]')?.focus();
  }
  function repiteExamen() { S.examen = null; guardaExamen(); presentaExamen(); pinta(); }
  // Lo que sigue al cerrar un chat: otro cliente del nivel o, desde el nivel 6, el examen.
  function siguiente(ms) {
    if (S.nivel < EXAMEN.nivel) return setTimeout(nuevoCliente, ms);
    if (!S.examen) setTimeout(presentaExamen, 1500);
  }
  const PUNTOS = n => n >= 85 ? '#25d366' : n >= 70 ? '#53bdeb' : n >= 50 ? '#ffb020' : '#ef4444';
  function tarjeta(r, sim) {
    $('pc-nota')?.remove();
    const m = document.createElement('div');
    m.id = 'pc-nota'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    if (!r) m.innerHTML = `<div class="pc-caja"><div class="pc-cargando"></div><h3>Evaluando tu atención a ${esc(sim.cliente.nombre)}…</h3><p>El supervisor está leyendo el chat.</p></div>`;
    else if (!r.ok) m.innerHTML = `<div class="pc-caja"><h3>No se pudo evaluar</h3><p>${esc(MOTIVOS[r.motivo] || 'Inténtalo de nuevo en un rato.')}</p><div class="pc-acc"><button class="pp-ir" data-pc="sig">Siguiente cliente</button></div></div>`;
    else {
      const nombres = Object.fromEntries((S.pasos || []).map(p => [p.id, p.texto]));
      const res = r.hechos?.resultado === 'vendido' ? '✅ Venta cerrada' : r.hechos?.resultado === 'perdido' ? '❌ Se fue sin comprar' : '⏸ Quedó abierto';
      m.innerHTML = `<div class="pc-caja pc-larga">
        <div class="pc-cab"><div class="pc-puntaje" style="--c:${PUNTOS(r.puntaje)}"><b>${r.puntaje}</b><small>de 100</small></div>
          <div><h3>${esc(sim.cliente.nombre)} · Nivel ${sim.nivel}</h3><p>${res}${r.hechos?.cotizacion_ok ? ' · cotización correcta' : r.hechos?.cotizaciones?.length ? ' · <b>el total de la cotización no era el correcto</b>' : ' · sin cotización en PDF'}</p>
          <p class="pc-estado ${r.aprobada ? 'ok' : ''}">${r.aprobada ? `Aprobado · ${r.aprobadas_nivel} de ${r.para_subir} en este nivel` : 'Este no cuenta para subir de nivel (hace falta 70+, venta cerrada y total correcto)'}</p></div></div>
        ${r.subio ? `<div class="pc-subio">🎉 ${r.nivel >= EXAMEN.nivel ? '¡Pasaste los 5 niveles! Sigue el examen «hora pico».' : `¡Subiste al nivel ${r.nivel}! Los próximos clientes son más exigentes.`}</div>` : ''}
        <div class="pc-cols"><div><h4>Lo hiciste bien</h4><ul>${(r.aciertos || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
          <div><h4>Para mejorar</h4><ul>${(r.mejoras || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
        ${r.frase_ideal ? `<div class="pc-ideal"><h4>Cómo lo diría un asesor top</h4><p>«${esc(r.frase_ideal)}»</p></div>` : ''}
        <details class="pc-pasos"><summary>Puntaje por paso</summary>${Object.entries(r.pasos || {}).map(([k, v]) => `<div class="pc-paso"><span>${esc(nombres[k] || k)}</span><i style="--v:${v * 10}%;--c:${PUNTOS(v * 10)}"></i><b>${v}</b></div>`).join('')}</details>
        <div class="pc-acc"><button class="pp-ir" data-pc="sig">Siguiente cliente →</button></div></div>`;
    }
    m.addEventListener('click', e => {
      if (!e.target.closest('[data-pc="sig"]')) return;
      m.remove(); S.sims.delete(sim.id); pinta();
      if (!abiertas().length) siguiente(8000 + Math.random() * 7000);
    });
    document.body.appendChild(m);
    m.querySelector('[data-pc]')?.focus();
  }

  /* ---------- «Atender» abre el chat del cliente en WhatsApp empresa ---------- */
  function abrirChat(url) {
    const tel = (/wa\.me\/(\d+)/.exec(url) || [])[1], sim = tel && simDeTel(tel);
    if (!sim) return false;
    abreConv(sim);
    setTimeout(() => irAlChat(sim), 500);
    return true;
  }
  async function irAlChat(sim) {
    window.__pruebaMisiones?.vista('wa-bandeja');
    if (!$('sec-wa-bandeja')?.classList.contains('active')) window.__pruebaIr?.('wa-bandeja');
    for (let i = 0; i < 40; i++) {
      const fila = document.querySelector(`#wb-inbox [data-wb="${sim.convId}"]`);
      if (fila) { if (chatAbierto() !== sim) fila.click(); return; }
      await espera(100);
    }
  }

  /* ---------- Panel de la guía ---------- */
  const GUIA = {
    rapidez: ['Tienes un cliente nuevo: toca <b>Atender</b>, lee su ficha y escríbele tú primero.', { sec: 'leads', foco: 'Atender' }],
    presentacion: ['Salúdalo y dile quién eres.', { chat: '#wb-texto' }],
    calificacion: ['Averigua lo que te falte para recomendarle bien: destino, fechas, quiénes viajan o presupuesto.', { chat: '#wb-texto' }],
    ficha: ['Anota en su ficha lo que te contó: toca <b>Ver lead</b>.', { chat: '#wb-ver-lead' }],
    tarifario: ['Busca el hotel o el destino en el <b>Tarifario</b>: precio por persona y qué incluye.', { sec: 'tarifario', sel: '#tar-search' }],
    opciones: ['Cuéntale una o dos opciones y qué incluyen. Si tienes fotos, mándalas con 📎.', { chat: '#wb-texto' }],
    cotizacion: ['En <b>Cotizaciones</b> vincula al cliente, arma el servicio y toca <b>Compartir</b>: se abre su chat con el PDF para revisarlo y enviarlo.', { sec: 'cotizacion-boletos', sel: '#cb-lead-q' }],
    objeciones: ['Responde sus dudas. Si no sabes algo, no inventes: dile que lo confirmas.', { chat: '#wb-texto' }],
    cierre: ['Cuando lo veas listo, propón separar con un <b>abono</b> y pásale los datos de pago.', { chat: '#wb-texto' }],
    registro: ['Llegó el comprobante: junto a la foto toca <b>Crear reserva</b>. La cotización y el pago ya vienen cargados: revísalos y confirma.', { chat: '[data-prueba-reserva]' }],
  };
  const siguientePaso = sim => (S.pasos || []).find(p => !sim.pasos[p.id] && !(p.id === 'rapidez' && sim.tarde) && !(p.id === 'registro' && !sim.comprobanteEn));
  async function llevame(sim, paso) {
    const [, d] = GUIA[paso.id] || [];
    const G = window.__pruebaGuia;
    if (!d || !G) return;
    if (d.chat) { await irAlChat(sim); await espera(350); G.destaca('wa-bandeja', false, null, { dura: 6000, sel: d.chat }); if (d.chat === '#wb-texto') $('wb-texto')?.focus(); }
    else G.destaca(d.sec, true, d.foco, { dura: 7000, sel: d.sel });
  }
  const reloj = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  // En el celular la guía arranca plegada (solo la pista del paso que sigue) para no tapar la pantalla.
  let panel = null, burbuja = null, plegado = true, enChatPrev = false;
  const movil = () => matchMedia('(max-width:760px)').matches;
  function pinta(festeja) {
    const enChat = S.activo && window.__pruebaMisiones?.terminadas?.() !== false && !!document.querySelector('.section.active .dm-shell.ver-chat');
    document.body.classList.toggle('pc-wa', S.activo);
    if (enChat && !enChatPrev && movil()) plegado = true;
    enChatPrev = enChat;
    if (S.activo) $('prueba-panel')?.remove();
    if (!S.activo || window.__pruebaMisiones?.terminadas?.() === false) { panel?.remove(); panel = null; return; }
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'pc-panel'; panel.setAttribute('aria-label', 'Práctica con clientes');
      panel.addEventListener('click', e => {
        const b = e.target.closest('[data-pc]'); if (!b) return;
        const sim = S.sims.get(b.dataset.sim) || foco();
        if (b.dataset.pc === 'plegar') plegado = !plegado;
        if (b.dataset.pc === 'chat' && sim) { irAlChat(sim); if (movil()) plegado = true; }
        if (b.dataset.pc === 'examen') return repiteExamen();
        if (b.dataset.pc === 'ir' && sim) { const p = siguientePaso(sim); if (p) { plegado = true; llevame(sim, p); } }
        if (b.dataset.pc === 'terminar' && sim) { if (b.dataset.seguro) cierra(sim, 'terminar'); else { b.dataset.seguro = '1'; b.textContent = '¿Seguro? Toca otra vez'; return; } }
        pinta();
      });
      burbuja = window.__pruebaBurbuja(panel, { asa: '.pc-fila' });
      document.body.appendChild(panel);
    }
    const sim = foco();
    let html;
    const fin = S.examen?.fin;
    const MINI = '<button class="pc-mini" data-pc="plegar" aria-label="Minimizar a burbuja" title="Minimizar">–</button>';
    if (plegado) html = bolaHtml(sim, fin);
    else if (!sim && fin) {
      html = `<div class="pc-fila"><span class="pc-ava">${fin.aprobado ? '🎓' : '⏱️'}</span><div class="pc-tit">Examen ${fin.aprobado ? 'aprobado' : 'no aprobado'}<small>Promedio ${fin.promedio} de 100${fin.aprobado ? ' · administración te asigna clientes reales' : ` · hace falta ${EXAMEN.aprueba}`}</small></div>${MINI}</div>
        ${fin.aprobado ? '' : '<div class="pc-acc"><button class="pp-ir" data-pc="examen">Repetir el examen</button></div>'}`;
    } else if (!sim) {
      html = `<div class="pc-fila"><span class="pc-ava">⏳</span><div class="pc-tit">${S.bloqueo ? 'Práctica en pausa' : S.llegando ? 'Llega un cliente…' : 'Esperando al próximo cliente'}<small>${S.bloqueo ? esc(S.bloqueo) : `Nivel ${S.nivel} · los clientes entran por Leads`}</small></div>${MINI}</div>`;
    } else {
      const esperando = !sim.respondido && !sim.escribiendo && !sim.comprobanteEn ? Date.now() - sim.ultimoCliente : 0;
      const paso = siguientePaso(sim), guia = sim.guia;
      const pista = guia === 'completa' || (guia === 'pistas' && esperando > 60e3);
      const otras = abiertas().filter(x => x !== sim);
      const pistaHtml = paso && pista ? `<div class="pc-pista">Sugerencia: ${GUIA[paso.id]?.[0] || ''}${guia === 'completa' ? ` <button class="pp-ir" data-pc="ir" data-sim="${sim.id}">Llévame</button>` : ''}</div>` : '';
      html = `<div class="pc-fila"><button class="pc-ava" data-pc="chat" data-sim="${sim.id}" title="Abrir el chat">${esc(sim.cliente.nombre.split(' ').map(x => x[0]).join('').slice(0, 2))}</button>
          <div class="pc-tit">${esc(sim.cliente.nombre)}<small>Nivel ${sim.nivel} · ${esc(sim.titulo || '')}${sim.escribiendo ? ' · <b class="pc-esc">escribiendo…</b>' : esperando > 20e3 ? ` · <b class="${esperando > sim.paciencia * 30e3 ? 'pc-tarde' : ''}">esperando tu respuesta ${reloj(esperando)}</b>` : ''}</small></div>
          ${MINI}</div>
        ${otras.length ? `<div class="pc-otras">${otras.map(o => `<button data-pc="chat" data-sim="${o.id}">${esc(o.cliente.nombre.split(' ')[0])}${!o.respondido ? ' •' : ''}</button>`).join('')}</div>` : ''}
        ${guia !== 'ninguna' && sim.temperatura != null ? `<div class="pc-temp" title="Qué tan cerca está de comprar"><span>Interés del cliente</span><i style="--t:${sim.temperatura}%"></i></div>` : ''}
        ${guia === 'ninguna' ? '<p class="pc-sola">Sin guía: atiéndelo como a un cliente real. Al final ves tu puntaje.</p>'
          : `<p class="pc-pasos-nota">Sin orden fijo: se marcan solos según la conversación y lo que hagas en el CRM.</p><ul class="pc-pasos">${(S.pasos || []).map(p => `<li class="${sim.pasos[p.id] ? 'hecho' : p.id === 'rapidez' && sim.tarde ? 'tarde' : ''}">${p.id === 'rapidez' && sim.tarde ? 'Contestaste después de los 2 min' : esc(p.texto)}</li>`).join('')}</ul>
             ${pistaHtml}`}
        <div class="pc-acc">${S.aviso ? `<span class="pc-aviso">${esc(S.aviso)}</span>` : ''}<button class="pc-terminar" data-pc="terminar" data-sim="${sim.id}">Terminar chat</button></div>`;
    }
    if (enExamen() && !plegado) html = `<div class="pc-examen">⏱ Examen «hora pico» · quedan <b>${Math.max(0, Math.ceil((EXAMEN.min * 60e3 - (Date.now() - S.examen.inicio)) / 60e3))} min</b> · ${S.examen.lanzados} de ${EXAMEN.clientes} clientes</div>` + html;
    if (panel.dataset.html !== html) { panel.dataset.html = html; panel.innerHTML = html; }
    panel.classList.toggle('pb-bola', plegado);
    burbuja.ubica();
    if (festeja) { panel.classList.remove('pc-festejo'); void panel.offsetWidth; panel.classList.add('pc-festejo'); }
    pintaEstado();
  }
  // Burbuja: cara del cliente y nivel a la vista; un punto si algo espera y la pista del paso unos segundos al lado.
  function bolaHtml(sim, fin) {
    const cara = sim ? esc(sim.cliente.nombre.split(' ').map(x => x[0]).join('').slice(0, 2)) : fin ? (fin.aprobado ? '🎓' : '⏱️') : '⏳';
    const marca = enExamen() ? `${Math.max(0, Math.ceil((EXAMEN.min * 60e3 - (Date.now() - S.examen.inicio)) / 60e3))}′` : `N${sim ? sim.nivel : S.nivel}`;
    const esperando = sim && !sim.respondido && !sim.escribiendo && !sim.comprobanteEn ? Date.now() - sim.ultimoCliente : 0;
    const paso = sim && siguientePaso(sim), guia = sim?.guia;
    if (paso && (guia === 'completa' || (guia === 'pistas' && esperando > 60e3)) && sim.bocaDe !== paso.id) {
      sim.bocaDe = paso.id; S.boca = GUIA[paso.id]?.[0] || null;
      clearTimeout(bolaHtml.t); bolaHtml.t = setTimeout(() => { S.boca = null; pinta(); }, 7000);
    }
    const urge = esperando > 20e3 || abiertas().some(o => o !== sim && !o.respondido);
    const boca = S.aviso ? esc(S.aviso) : S.boca;
    return `<button class="pc-bola" data-pc="plegar" aria-label="Abrir la guía de la práctica" title="Toca para abrir · arrastra para mover">${cara}<b>${marca}</b>${urge ? '<i></i>' : ''}</button>${boca ? `<div class="pc-boca">${boca}</div>` : ''}`;
  }
  addEventListener('pointerdown', e => { if (!plegado && movil() && panel && !panel.contains(e.target) && !e.target.closest?.('#pc-nota')) { plegado = true; pinta(); } }, true);
  function avisa(t) { S.aviso = t; pinta(); clearTimeout(avisa.t); avisa.t = setTimeout(() => { S.aviso = null; pinta(); }, 9000); }

  /* ---------- Piel de WhatsApp: «en línea / escribiendo…» y burbuja de tres puntos ---------- */
  function pintaEstado() {
    const sub = $('wb-sub'); if (!sub) return;
    let el = $('pc-wa-estado');
    if (!el) { el = document.createElement('div'); el.id = 'pc-wa-estado'; el.className = 'msg-conv-sub'; sub.after(el); }
    const sim = chatAbierto();
    // Solo si cambia: reasignar el mismo texto igual es una mutación y el MutationObserver de abajo entraría en bucle.
    const t = !sim ? '' : sim.escribiendo ? 'escribiendo…' : sim.cerrada ? '' : 'en línea';
    if (el.textContent !== t) el.textContent = t;
    el.classList.toggle('pc-esc', !!sim?.escribiendo);
    let res = $('pc-wa-resumen');
    if (!res) { res = document.createElement('div'); res.id = 'pc-wa-resumen'; el.after(res); }
    const lead = sim && tabla('leads').find(l => l.id === sim.leadId), bot = sim?.cliente.ficha?.bot;
    const r = !lead ? '' : [bot && `Bot: ${bot}`, `Ficha: ${lead.destino}${lead.personas ? ` · ${lead.personas} personas` : ''}`].filter(Boolean).join('\n');
    if (res.textContent !== r) res.textContent = r;
    const mic = $('pc-mic'), oculto = !sim || sim.cerrada ? 'none' : '';
    if (mic && mic.style.display !== oculto) mic.style.display = oculto;
  }
  function pintaEscribiendo() {
    const log = $('wb-log'), sim = chatAbierto();
    const hay = log?.querySelector('.pc-puntos');
    if (sim?.escribiendo && log && !hay) { log.insertAdjacentHTML('beforeend', '<div class="chat-msg other pc-puntos" aria-label="escribiendo"><i></i><i></i><i></i></div>'); log.scrollTop = log.scrollHeight; }
    else if (!sim?.escribiendo && hay) hay.remove();
    pintaEstado();
  }
  // whatsapp-bandeja.js repinta #wb-log entero con cada mensaje: los tres puntos se vuelven a poner.
  new MutationObserver(() => { if (abiertas().some(s => s.escribiendo)) pintaEscribiendo(); }).observe(document.documentElement, { childList: true, subtree: true });
  // Al abrir o cerrar un chat (`ver-chat`) o cambiar de sección (`active`) la guía se mueve: arriba con un chat abierto, abajo en el resto.
  const obsPc = new MutationObserver(() => S.activo && pinta());
  document.querySelectorAll('.section, .dm-shell').forEach(el => obsPc.observe(el, { attributes: true, attributeFilter: ['class'] }));

  /* ---------- Nota de voz: se graba en el navegador y el cliente «escucha» la transcripción (Web Speech, sin costo ni audio a la EF) ---------- */
  const Reconoce = window.SpeechRecognition || window.webkitSpeechRecognition, VOZ_MAX = 60;
  const junta = (...xs) => xs.map(x => (x || '').trim()).filter(Boolean).join(' ');
  let voz = null;
  if ($('wb-enviar') && navigator.mediaDevices?.getUserMedia && window.MediaRecorder) {
    $('wb-enviar').insertAdjacentHTML('beforebegin', '<button class="wb-ico" id="pc-mic" type="button" title="Nota de voz" aria-label="Grabar nota de voz" style="display:none"><i class="fas fa-microphone"></i></button>');
    $('pc-mic').addEventListener('click', grabaVoz);
  }
  async function grabaVoz() {
    const sim = chatAbierto(); if (!sim || sim.cerrada || voz) return;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { return avisa('Para mandar notas de voz, permite el micrófono en el navegador.'); }
    const rec = new MediaRecorder(stream);
    const v = voz = { sim, rec, stream, trozos: [], inicio: Date.now(), base: '', sesion: '', parcial: '' };
    rec.ondataavailable = e => e.data.size && v.trozos.push(e.data);
    v.listoRec = new Promise(ok => { rec.onstop = ok; });
    v.listoReco = new Promise(ok => { v.recoFin = ok; });
    rec.start();
    if (Reconoce) {
      const r = v.reco = new Reconoce();
      Object.assign(r, { lang: 'es-VE', continuous: true, interimResults: true });
      r.onresult = e => { const rs = [...e.results]; v.sesion = junta(...rs.filter(x => x.isFinal).map(x => x[0].transcript)); v.parcial = junta(...rs.filter(x => !x.isFinal).map(x => x[0].transcript)); pintaVoz(); };
      r.onerror = e => { if (e.error !== 'no-speech' && e.error !== 'aborted') v.sinReco = e.error; };
      // Chrome corta el reconocimiento tras un silencio: mientras se graba se vuelve a arrancar.
      r.onend = () => {
        v.base = junta(v.base, v.sesion); v.sesion = v.parcial = ''; v.recoVivo = false;
        if (voz === v && !v.sinReco) try { r.start(); v.recoVivo = true; } catch {}
        if (!v.recoVivo) v.recoFin();
      };
      try { r.start(); v.recoVivo = true; } catch { v.sinReco = 'start'; }
    }
    if (!v.recoVivo) v.recoFin();
    v.reloj = setInterval(() => { if (chatAbierto() !== v.sim) paraVoz(false); else if (Date.now() - v.inicio >= VOZ_MAX * 1e3) paraVoz(true); else pintaVoz(); }, 250);
    pintaVoz();
  }
  async function paraVoz(enviar) {
    const v = voz; if (!v) return;
    voz = null; v.fin = Date.now(); clearInterval(v.reloj); pintaVoz();
    try { v.reco?.stop(); } catch {}
    if (v.rec.state !== 'inactive') v.rec.stop();
    await Promise.all([v.listoRec, Promise.race([v.listoReco, espera(2500)])]);
    v.stream.getTracks().forEach(t => t.stop());
    const seg = Math.round((v.fin - v.inicio) / 1000);
    if (!enviar || v.sim.cerrada) return;
    if (seg < 1 || !v.trozos.length) return avisa('La nota de voz quedó muy corta.');
    const tipo = v.rec.mimeType || 'audio/webm', dicho = junta(v.base, v.sesion, v.parcial).slice(0, 900);
    const archivo = new File(v.trozos, `nota-de-voz.${/mp4/.test(tipo) ? 'm4a' : /ogg/.test(tipo) ? 'ogg' : 'webm'}`, { type: tipo });
    const fila = guardaMensaje(v.sim, { direccion: 'saliente_api', tipo: 'audio', estado: 'enviado', media_mime: tipo, media_path: P.blob(archivo), transcripcion: dicho || null });
    setTimeout(() => fila.estado === 'enviado' && tick(fila, 'entregado'), 700);
    setTimeout(() => { const log = $('wb-log'); if (log) log.scrollTop = log.scrollHeight; }, 60);
    saliente(v.sim, fila, archivo, seg);
  }
  function pintaVoz() {
    const c = $('wb-compose'); if (!c) return;
    let b = $('pc-grabando');
    c.classList.toggle('pc-graba', !!voz);
    if (!voz) { b?.remove(); return; }
    if (!b) {
      c.insertAdjacentHTML('beforeend', `<div id="pc-grabando" role="status"><button class="wb-ico" type="button" data-voz="no" title="Descartar" aria-label="Descartar nota de voz"><i class="fas fa-trash"></i></button>
        <span class="pc-rec-punto"></span><b class="pc-rec-t"></b><span class="pc-rec-txt"></span>
        <button class="wb-send" type="button" data-voz="si" aria-label="Enviar nota de voz"><i class="fas fa-paper-plane"></i></button></div>`);
      b = $('pc-grabando');
      b.addEventListener('click', e => { const x = e.target.closest('[data-voz]'); if (x) paraVoz(x.dataset.voz === 'si'); });
    }
    const t = reloj(Date.now() - voz.inicio), o = junta(voz.base, voz.sesion, voz.parcial);
    const oido = (o.length > 60 ? '…' + o.slice(-60).replace(/^\S*\s/, '') : o) || (Reconoce && !voz.sinReco ? 'Grabando… habla normal' : 'Grabando…');
    const el = b.querySelector('.pc-rec-t'), tx = b.querySelector('.pc-rec-txt');
    if (el.textContent !== t) el.textContent = t;
    if (tx.textContent !== oido) tx.textContent = oido;
  }

  function sonido() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[880, 0], [1320, 0.13]].forEach(([f, t]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
        o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
      });
    } catch { /* sin audio */ }
  }

  /* ---------- Arranque: después de la última misión (o al recargar con la práctica en curso) ---------- */
  async function empezar(rehidratar) {
    const r = await ia({ accion: 'estado', sesion, nombre: nombre() });
    if (r.ok) { S.nivel = r.nivel; S.pasos = r.pasos; }
    if (r.ok && enExamen() && r.examen?.id === S.examen.id) { S.examen.fin = r.examen; guardaExamen(); }
    S.activo = true; ss('clientes:activo', '1'); pinta();
    if (r.ok && r.frenado) { S.bloqueo = MOTIVOS.tope; return avisa(MOTIVOS.tope); }
    const previas = rehidratar && r.ok ? r.en_curso || [] : [];
    for (const s of previas) crearSim({ id: s.sim_id, nivel: s.nivel, nivelJuego: s.nivel, titulo: (r.niveles || []).find(n => n.nivel === s.nivel)?.titulo || (s.examen ? 'Hora pico' : ''), guia: s.guia, cliente: s.cliente, paciencia: s.paciencia_min, historial: s.historial, pasos: s.pasos, examen: s.examen || undefined }, true);
    if (!previas.length && !enExamen()) siguiente(rehidratar ? 3000 : 6000);
  }
  function presenta() {
    if (ss('clientes:intro')) return;
    ss('clientes:intro', '1');
    empezar(false);
  }
  addEventListener('prueba:misiones-fin', () => { if (P.m.rol === 'asesor') presenta(); });
  setTimeout(function arranca() {
    if (P.m.rol !== 'asesor' || !window.__pruebaMisiones?.terminadas?.()) return setTimeout(arranca, 2000);
    if (S.activo) { S.activo = false; empezar(true); } else if (!ss('clientes:intro')) presenta();
  }, 2500);

  /* ---------- Estilos ---------- */
  const css = document.createElement('style');
  css.textContent = `
#pc-panel{z-index:99980;width:min(340px,calc(100vw - 24px));max-height:min(72vh,520px);overflow:auto;box-sizing:border-box;padding:10px 12px;border-radius:16px;background:color-mix(in srgb,var(--panel-solid,#1b1b1f) 92%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid var(--line2,rgba(255,255,255,.14));box-shadow:0 16px 36px -16px rgba(0,0,0,.6);color:var(--txt,#eee);font:13px/1.4 system-ui,sans-serif}
#pc-panel.pb-bola{width:52px;height:52px;padding:0;overflow:visible;border:0;border-radius:50%;background:transparent;-webkit-backdrop-filter:none;backdrop-filter:none}
#pc-panel .pc-bola{position:relative;display:grid;place-items:center;width:100%;height:100%;padding:0;border:0;border-radius:50%;background:#25d366;color:#05301a;font:700 15px system-ui,sans-serif;box-shadow:0 10px 24px -8px rgba(0,0,0,.65)}
#pc-panel .pc-bola b{position:absolute;right:-3px;bottom:-3px;min-width:22px;padding:1px 4px;box-sizing:border-box;border-radius:999px;background:var(--panel-solid,#1b1b1f);color:var(--txt,#eee);font-size:10.5px;line-height:1.4;box-shadow:0 0 0 1px var(--line2,rgba(255,255,255,.2))}
#pc-panel .pc-bola i{position:absolute;top:0;right:0;width:12px;height:12px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 2px var(--panel-solid,#1b1b1f)}
#pc-panel .pc-boca{position:absolute;top:50%;transform:translateY(-50%);width:max-content;max-width:min(230px,calc(100vw - 90px));padding:7px 10px;border-radius:12px;background:var(--panel-solid,#1b1b1f);border:1px solid var(--line2,rgba(255,255,255,.14));box-shadow:0 10px 24px -10px rgba(0,0,0,.6);font-size:12.5px;line-height:1.35;pointer-events:none}
#pc-panel[data-lado=der] .pc-boca{right:calc(100% + 8px)}#pc-panel[data-lado=izq] .pc-boca{left:calc(100% + 8px)}
#pc-panel .pc-fila{cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
#pc-panel.pc-festejo{animation:pc-pulso .7s}
@keyframes pc-pulso{30%{box-shadow:0 0 0 4px rgba(37,211,102,.45),0 16px 36px -16px rgba(0,0,0,.6)}}
#pc-panel .pc-fila{display:flex;align-items:center;gap:10px}
#pc-panel .pc-ava{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;border:none;background:#25d366;color:#05301a;font:700 13px system-ui;cursor:pointer}
#pc-panel .pc-tit{flex:1;min-width:0;font-weight:600;font-size:14px}
#pc-panel .pc-tit small{display:block;font-weight:400;font-size:11.5px;color:var(--muted,#aaa)}
#pc-panel .pc-esc{color:#25d366;font-weight:600}#pc-panel .pc-tarde{color:#ef4444}
#pc-panel button{font:inherit;cursor:pointer;color:inherit}
#pc-panel .pc-mini{border:none;background:transparent;font-size:16px;padding:4px 6px;color:var(--muted,#aaa)}
#pc-panel .pc-otras{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
#pc-panel .pc-otras button{border:1px solid var(--line2,rgba(255,255,255,.14));background:transparent;border-radius:999px;padding:3px 10px;font-size:12px}
#pc-panel .pc-temp{display:flex;align-items:center;gap:8px;margin-top:9px;font-size:11.5px;color:var(--muted,#aaa)}
#pc-panel .pc-temp i{flex:1;height:6px;border-radius:9px;background:var(--line2,rgba(255,255,255,.12));position:relative;overflow:hidden}
#pc-panel .pc-temp i::after{content:"";position:absolute;inset:0 auto 0 0;width:var(--t);background:linear-gradient(90deg,#ef4444,#ffb020,#25d366);transition:width .6s}
#pc-panel .pc-pasos{margin:9px 0 0;padding:0;list-style:none;display:grid;gap:3px;max-height:38vh;overflow:auto}
#pc-panel .pc-pasos li{position:relative;padding-left:22px;font-size:12.5px;color:var(--muted,#aaa)}
#pc-panel .pc-pasos li::before{content:"○";position:absolute;left:3px}
#pc-panel .pc-pasos li.hecho{color:var(--txt,#eee);text-decoration:line-through;text-decoration-color:rgba(37,211,102,.6)}
#pc-panel .pc-pasos li.hecho::before{content:"✓";color:#25d366;font-weight:700}
#pc-panel .pc-pasos li.tarde{color:#ff8a7a}#pc-panel .pc-pasos li.tarde::before{content:"!";font-weight:700}
#pc-panel .pc-pasos-nota{margin:9px 0 0;font-size:12px;color:var(--muted,#aaa)}
#pc-panel .pc-pista{margin-top:9px;padding:9px 10px;border-radius:12px;background:rgba(255,176,32,.12);border:1px solid rgba(255,176,32,.35);font-size:12.5px}
#pc-panel .pc-pista button{margin-left:6px;border-radius:999px;padding:4px 12px;font-size:12px}
#pc-panel .pc-sola{margin:9px 0 0;font-size:12.5px;color:var(--muted,#aaa)}
#pc-panel .pc-acc{display:flex;align-items:center;gap:8px;margin-top:10px}
#pc-panel .pc-aviso{flex:1;font-size:12px;color:#ffb020}
#pc-panel .pc-terminar{margin-left:auto;border:1px solid var(--line2,rgba(255,255,255,.14));background:transparent;border-radius:10px;padding:5px 10px;font-size:12px;color:var(--muted,#aaa)}
#pc-panel button.pp-ir,#pc-nota button.pp-ir{background:#25d366;color:#05301a;border:1px solid #25d366;font-weight:700}
#pc-nota{position:fixed;inset:0;z-index:99996;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.55);font:14px/1.45 system-ui,sans-serif;color:var(--txt,#eee)}
#pc-nota .pc-caja{width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:22px;border-radius:18px;background:var(--panel-solid,#1b1b1f);border:1px solid var(--line2,rgba(255,255,255,.14));box-shadow:0 24px 60px -20px rgba(0,0,0,.8);text-align:center}
#pc-nota .pc-larga{width:min(620px,100%);text-align:left}
#pc-nota h3{margin:0 0 4px;font-size:17px}#pc-nota h4{margin:14px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#aaa)}
#pc-nota p{margin:0;color:var(--muted,#bbb)}#pc-nota ul{margin:0;padding-left:18px;display:grid;gap:4px}
#pc-nota .pc-cab{display:flex;gap:16px;align-items:center}
#pc-nota .pc-puntaje{flex:none;display:grid;place-items:center;width:84px;height:84px;border-radius:50%;border:5px solid var(--c);text-align:center;line-height:1}
#pc-nota .pc-puntaje b{font-size:28px}#pc-nota .pc-puntaje small{font-size:11px;color:var(--muted,#aaa)}
#pc-nota .pc-estado{margin-top:6px;font-size:12.5px}#pc-nota .pc-estado.ok{color:#25d366;font-weight:600}
#pc-nota .pc-subio{margin-top:14px;padding:10px 12px;border-radius:12px;background:rgba(37,211,102,.14);border:1px solid rgba(37,211,102,.4);font-weight:600}
#pc-nota .pc-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
#pc-nota .pc-ideal p{padding:10px 12px;border-radius:10px;background:var(--wa-mia,#005c4b);color:var(--wa-mia-txt,#e9edef);font-style:italic}
#pc-nota .pc-pasos,#pc-nota .pc-pasos-fin{margin-top:14px}#pc-nota .pc-pasos-fin .pc-paso{grid-template-columns:1fr 90px 26px;font-size:13.5px}
#pc-panel .pc-examen{margin:-2px 0 8px;padding:5px 9px;border-radius:9px;background:rgba(255,176,32,.14);border:1px solid rgba(255,176,32,.35);font-size:12px}#pc-nota .pc-pasos summary{cursor:pointer;color:var(--muted,#aaa)}
#pc-nota .pc-paso{display:grid;grid-template-columns:1fr 90px 22px;gap:8px;align-items:center;font-size:12.5px;margin-top:6px}
#pc-nota .pc-paso i{height:6px;border-radius:9px;background:var(--line2,rgba(255,255,255,.12));position:relative;overflow:hidden}
#pc-nota .pc-paso i::after{content:"";position:absolute;inset:0 auto 0 0;width:var(--v);background:var(--c)}
#pc-nota .pc-acc{display:flex;justify-content:flex-end;margin-top:18px}
#pc-nota button{font:inherit;border-radius:10px;padding:9px 16px;cursor:pointer}
#pc-nota .pc-cargando{width:38px;height:38px;margin:4px auto 14px;border-radius:50%;border:4px solid var(--line2,rgba(255,255,255,.14));border-top-color:#25d366;animation:pc-gira 1s linear infinite}
@keyframes pc-gira{to{transform:rotate(1turn)}}
@media(max-width:760px){#pc-panel .pc-pasos{max-height:24dvh}body:is(.teclado,.menu-abierto) #pc-panel{display:none}#pc-panel .pc-mini{min-width:44px;min-height:44px}#pc-nota .pc-cols{grid-template-columns:1fr}
#pc-nota .pc-caja{max-height:calc(100dvh - 32px);padding:16px}#pc-nota .pc-caja:has(.pc-acc){padding-bottom:0}#pc-nota .pc-acc{position:sticky;bottom:0;margin:12px -16px 0;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));background:var(--panel-solid,#1b1b1f)}}
@media(prefers-reduced-motion:reduce){#pc-panel.pc-festejo,#pc-nota .pc-cargando{animation:none}}
#pc-wa-resumen{font-size:11.5px;line-height:1.35;color:var(--muted);white-space:pre-line;margin-top:2px}#pc-wa-resumen:empty{display:none}
body.pc-wa #sec-wa-bandeja #wb-sub,body.pc-wa #sec-wa-bandeja .wb-por,body.pc-wa #sec-wa-bandeja #wb-recargar{display:none}
body.pc-wa #sec-wa-bandeja .wa-cab{background:var(--wa-cabecera,#202c33)}
body.pc-wa #sec-wa-bandeja #wb-head{background:var(--wa-cabecera,#202c33);border-bottom:1px solid rgba(134,150,160,.15)}
body.pc-wa #sec-wa-bandeja #wb-head .msg-avatar{border-radius:50%}
body.pc-wa #pc-wa-estado{font-size:12px;color:var(--wa-meta,#8696a0)}body.pc-wa #pc-wa-estado.pc-esc{color:#25d366}
body.pc-wa #sec-wa-bandeja .wb-compose{background:var(--wa-cabecera,#202c33);border-top:none}
body.pc-wa #sec-wa-bandeja .wb-compose textarea{border:none;background:var(--wa-entrada,#2a3942);color:var(--wa-ajena-txt,#e9edef)}
body.pc-wa #sec-wa-bandeja .wb-send{background:#00a884;color:#fff}
#sec-wa-bandeja .wb-compose.pc-graba>:not(#pc-grabando){display:none!important}
#pc-grabando{flex:1;min-width:0;display:flex;align-items:center;gap:10px}
#pc-grabando .pc-rec-punto{width:10px;height:10px;border-radius:50%;background:#f15c6d;flex-shrink:0;animation:pc-late 1s infinite}
#pc-grabando .pc-rec-t{font-variant-numeric:tabular-nums}
#pc-grabando .pc-rec-txt{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:13px;font-style:italic;color:var(--wa-meta,#8696a0)}
@keyframes pc-late{50%{opacity:.25}}
body.pc-wa #sec-wa-bandeja .chat-msg .wa-audio{height:40px}
body.pc-wa #sec-wa-bandeja .msg-inbox-badge{background:#25d366;color:#05301a;font-weight:700}
body.pc-wa #sec-wa-bandeja .msg-inbox-row .msg-avatar{border-radius:50%}
body.pc-wa #sec-wa-bandeja .pc-puntos{display:flex;gap:4px;padding:11px 12px}
body.pc-wa #sec-wa-bandeja .pc-puntos i{width:7px;height:7px;border-radius:50%;background:var(--wa-meta,#8696a0);animation:pc-salta 1.2s infinite}
body.pc-wa #sec-wa-bandeja .pc-puntos i:nth-child(2){animation-delay:.15s}body.pc-wa #sec-wa-bandeja .pc-puntos i:nth-child(3){animation-delay:.3s}
@keyframes pc-salta{0%,60%,100%{transform:none;opacity:.5}30%{transform:translateY(-4px);opacity:1}}
:root[data-theme="light"] body.pc-wa #sec-wa-bandeja :is(.wa-cab,#wb-head,.wb-compose){background:#f0f2f5}
:root[data-theme="light"] body.pc-wa #sec-wa-bandeja .wb-compose textarea{background:#fff;color:#111b21}`;
  document.head.appendChild(css);
})();
