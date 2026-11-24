// Correo (Gmail) del CRM. Salió de app.js el 2026-11-23 (F1 del rediseño «negocio primero»,
// plan docs/superpowers/plans/2026-11-23-correo-f1.md). El visor compartido con la ficha del
// lead (CORREOS_DATA, renderCuerpoCorreo, cargarCorreoLead) sigue en app.js y llega por deps.
// Clases .correo-* en index.html; lo del teléfono va en su media query.

export function crearCorreo({ sb, SUPABASE_URL, SUPABASE_KEY, CLIENT_COLORS, seedHash, esc, val, fmtFechaHoraCaracas, openDrawer, CORREOS_DATA, renderCuerpoCorreo, fileABase64, extraerEmailDeCabecera, fmtTamano, renderAdjuntosCorreo, okToast, errToast, biBadge, openSheet, closeSheet, popoverASheet, confirmarSheet, pedirTexto, hojaAbierta, crearTareaLead, abrirProveedor, crearLead }) {
  /* ---------- Correo (Gmail vinculado a leads) ----------
     OAuth por asesor (cada uno conecta su propia cuenta) -- gmail_iniciar_conexion()
     solo devuelve el token de "state" (uuid de un solo uso, 10 min), la URL de
     consentimiento se arma acá con el client_id público de Google (no es secreto,
     va en la URL del navegador). Ver plan en
     C:\Users\Usuario\.claude\plans\en-el-crm-se-compressed-conway.md
     2026-10-02 (plan correo-crm-gmail.md): carpetas y pestañas con las etiquetas
     reales de Gmail, consulta y búsqueda en el servidor con paginación, hilo
     completo en el lector, acciones (archivar, papelera, destacar, no leído,
     spam) aplicadas también en Gmail, responder a todos / reenviar, contactos
     derivados del correo, firma por cuenta y backfill de días anteriores. */
  const GMAIL_CLIENT_ID = '16841972131-bk0p99ds2ntktd9cdbhdf3cbcnp94rio.apps.googleusercontent.com';
  const GMAIL_REDIRECT_URI = 'https://begbjhrdbsqftbbleecb.supabase.co/functions/v1/gmail-oauth-callback';
  // gmail.modify (Fase 5, marcar leído sincronizado) -- los asesores ya
  // conectados con el scope viejo van a ver el consent screen de nuevo la
  // próxima vez que interactúen; no pierden datos, solo reautorizan.
  const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify';

  let CORREO_BANDEJA_DATA = [];
  let correoFiltro = 'todos';
  let CORREO_CUENTAS = []; // filas de gmail_cuentas() -- una por cuenta conectada
  // 'todas' = bandeja unificada de las cuentas sin revocar (F1, 2026-11-23).
  let CORREO_CUENTA_ACTIVA = (() => { try { return localStorage.getItem('correo_cuenta_activa'); } catch { return null; } })() || 'todas';
  // Abre en Negocio (decisión del dueño 23-nov); las categorías de Gmail solo filtran Recibidos.
  let CORREO_CARPETA = 'negocio', CORREO_CATEGORIA = 'todas';
  let CORREO_HAY_MAS = false, CORREO_CARGANDO_MAS = false, CORREO_PEDIDO = 0;
  let CORREO_BACKFILL = null; // credencial_id con un backfill en curso
  const CORREO_PAGINA = 60;
  const CORREO_CATEGORIAS = ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'];
  // La lista no trae cuerpos (pesan): se piden al abrir el hilo.
  const CORREO_SELECT = 'id,lead_id,proveedor_id,credencial_id,gmail_message_id,gmail_thread_id,direccion,de,para,cc,asunto,snippet,enviado_en,leido,etiquetas,clase,sugerido_lead_id,gmail_correo_adjuntos(id,filename,mime_type,tamano_bytes)';
  const CORREO_SELECT_HILO = 'id,lead_id,proveedor_id,credencial_id,gmail_message_id,gmail_thread_id,direccion,de,para,cc,bcc,asunto,snippet,cuerpo_texto,cuerpo_html,enviado_en,leido,etiquetas,clase,sugerido_lead_id,gmail_correo_adjuntos(id,filename,mime_type,tamano_bytes)';
  const correoSeccionActiva = () => document.getElementById('sec-correo')?.classList.contains('active');
  const idHiloSeguro = id => String(id || '').replace(/[^\w-]/g, '');
  const terminoBusquedaCorreo = () => (document.getElementById('correo-search')?.value || '').replace(/[,()*%\\:"']/g, ' ').trim();
  const esTodas = () => CORREO_CUENTA_ACTIVA === 'todas';
  const cuentasVivas = () => CORREO_CUENTAS.filter(c => !c.revocado);
  const cuentaCorreoActiva = () => esTodas() ? null : CORREO_CUENTAS.find(c => String(c.credencial_id) === String(CORREO_CUENTA_ACTIVA));
  // Credenciales que entran en la lista; con «Todas», las que no están revocadas.
  const credsVista = () => esTodas() ? cuentasVivas().map(c => String(c.credencial_id)) : [String(CORREO_CUENTA_ACTIVA)];
  const enVista = cred => credsVista().includes(String(cred));
  // Cuenta para redactar, firmar o traer correo cuando la vista es «Todas».
  const credDeTrabajo = () => esTodas() ? String(cuentasVivas()[0]?.credencial_id || '') : String(CORREO_CUENTA_ACTIVA || '');
  const colorCuenta = cred => CLIENT_COLORS[Math.max(0, CORREO_CUENTAS.findIndex(c => String(c.credencial_id) === String(cred))) % CLIENT_COLORS.length];
  const CORREO_CLASES_NEGOCIO = ['cliente', 'proveedor', 'interno'];
  const CORREO_CLASES = [['cliente', 'Cliente'], ['proveedor', 'Proveedor'], ['interno', 'Interno'], ['ruido', 'No es negocio']];
  const CORREO_VISTAS = [['negocio', 'fa-briefcase', 'Negocio'], ['recibidos', 'fa-inbox', 'Recibidos'], ['destacados', 'fa-star', 'Destacados'], ['enviados', 'fa-paper-plane', 'Enviados']];
  const CORREO_MAS = [['spam', 'fa-ban', 'Spam'], ['papelera', 'fa-trash', 'Papelera'], ['contactos', 'fa-address-book', 'Contactos']];

  /* Cuerpo HTML ajeno (iframe sandbox sin scripts, mismo origen): pliega el historial citado
     detrás de un <details> nativo (no necesita JS dentro del iframe) y suaviza el blanco.
     Si el correo es solo cita (reenvío), no se pliega nada. */
  const SEL_CITA = '.gmail_quote,.yahoo_quoted,blockquote';
  function plegarCitasIframe(f) {
    try {
      const d = f.contentDocument;
      if (!d?.body || d.body.dataset.plegado) return;
      d.body.dataset.plegado = '1';
      const citas = [...d.body.querySelectorAll(SEL_CITA)].filter(n => !n.parentElement.closest(SEL_CITA));
      const st = d.createElement('style');
      st.textContent = 'html{background:#f8f9fa}body{padding:12px 16px}blockquote{margin:6px 0}details.cita-plegada>summary{display:inline-block;cursor:pointer;list-style:none;padding:0 8px;margin:6px 0;border-radius:10px;background:#e8eaed;color:#5f6368;font-size:12px;line-height:18px;letter-spacing:2px;user-select:none}details.cita-plegada>summary::-webkit-details-marker{display:none}details.cita-plegada[open]>summary{background:#dadce0}';
      d.head.appendChild(st);
      f.style.borderRadius = '8px';
      if (!citas.length) return;
      const resto = d.body.cloneNode(true);
      resto.querySelectorAll(SEL_CITA).forEach(n => n.remove());
      if (!resto.textContent.trim()) return;
      citas.forEach(c => {
        const det = d.createElement('details'), sum = d.createElement('summary');
        det.className = 'cita-plegada';
        sum.textContent = '···'; sum.title = 'Ver historial citado';
        c.replaceWith(det);
        det.append(sum, c);
      });
    } catch { /* sin acceso al documento: queda como vino */ }
  }

  function setupCorreo() {
    document.getElementById('correo-detalle-body').addEventListener('load', (e) => {
      if (e.target?.classList?.contains('correo-msg-iframe')) plegarCitasIframe(e.target);
    }, true);
    // Solo conecta los botones acá -- el estado y la bandeja se cargan recién
    // cuando se activa la sección (ver activateSection), mismo patrón perezoso
    // que el resto de las secciones. La excepción es el badge del menú: una
    // sola RPC liviana para que el asesor vea que tiene correo sin entrar.
    document.getElementById('correo-banner-btn').onclick = conectarGmail;
    document.getElementById('correo-detalle-back').onclick = cerrarHiloCorreo;
    document.getElementById('correo-sync-btn').onclick = sincronizarCorreoAhora;
    document.getElementById('correo-redactar-btn').onclick = () => abrirCompose({ modo: 'nuevo' });
    document.getElementById('compose-cancelar').onclick = cerrarCompose;
    document.getElementById('compose-descartar').onclick = descartarCompose;
    document.getElementById('compose-enviar').onclick = enviarCompose;
    document.getElementById('compose-adjuntar-input').addEventListener('change', (e) => { agregarAdjuntoCompose(e.target.files); e.target.value = ''; });
    document.getElementById('compose-cco-toggle').onclick = () => mostrarCcoCompose(true);
    document.getElementById('compose-de').addEventListener('change', (e) => {
      COMPOSE.credencialId = e.target.value;
      aplicarFirmaCompose(true);
      cargarFirmaEnCompose();
      guardarBorradorCompose();
    });
    ['compose-para', 'compose-cc', 'compose-cco'].forEach(conectarAutocompletarDireccion);
    ['compose-para', 'compose-cc', 'compose-cco', 'compose-asunto', 'compose-body'].forEach(id => document.getElementById(id).addEventListener('input', guardarBorradorCompose));
    document.getElementById('correo-cuenta-btn').onclick = (e) => { e.stopPropagation(); toggleMenuCuentas(); };
    document.addEventListener('click', () => document.getElementById('correo-cuenta-menu').style.display = 'none');
    popoverASheet('#correo-cuenta-menu', { abierto: n => n.style.display !== 'none', cerrar: n => { n.style.display = 'none'; } });
    // conectarGmail() abre el consentimiento de Google en pestaña nueva; al
    // volver a esta pestaña (visibilitychange) se refresca el estado en vez de
    // pedirle al asesor que recargue a mano.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && correoSeccionActiva()) refrescarEstadoGmail();
    });
    // Búsqueda en el servidor (asunto, remitente, resumen y cuerpo), con
    // debounce para no pedir por cada tecla.
    let t = null;
    document.getElementById('correo-search').addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => CORREO_CARPETA === 'contactos' ? cargarContactosCorreo() : cargarBandejaCorreo(), 300);
    });
    // Chips que se prenden y apagan: uno a la vez, apagado = todos.
    document.querySelectorAll('#correo-filtros .seg').forEach(b => b.onclick = () => {
      const prender = !b.classList.contains('on');
      document.querySelectorAll('#correo-filtros .seg').forEach(x => x.classList.toggle('on', prender && x === b));
      correoFiltro = prender ? b.dataset.f : 'todos';
      cargarBandejaCorreo();
    });
    document.getElementById('correo-vistas-movil').addEventListener('click', e => { const b = e.target.closest('[data-carpeta]'); if (b) elegirCarpetaCorreo(b.dataset.carpeta); });
    document.getElementById('correo-categoria').addEventListener('change', e => {
      CORREO_CATEGORIA = e.target.value;
      cerrarHiloCorreo();
      cargarBandejaCorreo();
    });
    document.getElementById('correo-lista').addEventListener('touchstart', gestoArchivarInicio, { passive: true });
    document.getElementById('correo-lista').addEventListener('touchmove', gestoArchivarMover, { passive: true });
    document.getElementById('correo-lista').addEventListener('touchend', gestoArchivarFin);
    document.getElementById('correo-atajos-btn').onclick = () => openSheet('correo-atajos-sheet');
    let correoScrollPend = false;
    document.getElementById('correo-lista').addEventListener('scroll', e => {
      const el = e.currentTarget;
      if (correoScrollPend || !CORREO_HAY_MAS || CORREO_CARGANDO_MAS) return;
      correoScrollPend = true;
      requestAnimationFrame(() => {
        correoScrollPend = false;
        if (CORREO_HAY_MAS && !CORREO_CARGANDO_MAS && el.scrollTop + el.clientHeight > el.scrollHeight - 240) cargarBandejaCorreo('mas');
      });
    }, { passive: true });
    document.addEventListener('keydown', atajosCorreo);
    refrescarBadgeCorreo();
  }
  function cargarCorreoSeccion() { refrescarEstadoGmail(); }

  function tiempoRelativoCorto(iso) {
    if (!iso) return 'nunca';
    const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutos < 1) return 'recién';
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.round(minutos / 60);
    if (horas < 24) return `hace ${horas}h`;
    return `hace ${Math.round(horas / 24)}d`;
  }
  // Igual que la lista de Gmail: hoy = hora, este año = "2 oct", antes = fecha corta.
  function fmtFechaCorreo(iso) {
    const d = new Date(iso), ahora = new Date(), tz = { timeZone: 'America/Caracas' };
    const dia = x => x.toLocaleDateString('es-VE', { ...tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    if (dia(d) === dia(ahora)) return d.toLocaleTimeString('es-VE', { ...tz, hour: 'numeric', minute: '2-digit' });
    const anio = x => x.toLocaleDateString('es-VE', { ...tz, year: 'numeric' });
    return d.toLocaleDateString('es-VE', anio(d) === anio(ahora) ? { ...tz, day: 'numeric', month: 'short' } : { ...tz, day: '2-digit', month: '2-digit', year: '2-digit' });
  }
  function nombreDeCabecera(dir) {
    const m = (dir || '').match(/^\s*"?([^"<]*?)"?\s*<[^>]+>/);
    return (m && m[1].trim()) || extraerEmailDeCabecera(dir) || '';
  }
  function avatarCorreo(dir) {
    const email = extraerEmailDeCabecera(dir).toLowerCase();
    const inicial = (nombreDeCabecera(dir) || email || '?').trim().charAt(0).toUpperCase() || '?';
    return `<span class="correo-row-avatar" style="--c:${CLIENT_COLORS[seedHash(email) % CLIENT_COLORS.length]}">${esc(inicial)}</span>`;
  }
  function textoDeHtml(html) {
    // DOMParser no ejecuta scripts ni carga recursos del documento parseado.
    try { return new DOMParser().parseFromString(html || '', 'text/html').body.textContent.replace(/\n{3,}/g, '\n\n').trim(); } catch { return ''; }
  }

  /* ---------- Badge del menú y contadores por carpeta ---------- */
  async function refrescarBadgeCorreo() {
    const { data } = await sb.rpc('gmail_cuentas');
    if (!data) return;
    CORREO_CUENTAS = data;
    actualizarBadgeCorreo();
    pintarNavCorreo();
  }
  function actualizarBadgeCorreo() {
    const n = CORREO_CUENTAS.filter(c => !c.revocado).reduce((a, c) => a + (c.no_leidos || 0), 0);
    const b = document.getElementById('nav-correo-count');
    if (b) { b.textContent = n > 99 ? '99+' : String(n); b.style.display = n ? '' : 'none'; }
  }
  async function cargarContadoresCorreo() {
    if (!credsVista().filter(Boolean).length) return;
    const c = await contadoresVista();
    const pintar = (sel, n) => { const el = document.querySelector(sel); if (el) { el.textContent = n > 99 ? '99+' : String(n || ''); el.hidden = !n; } };
    CORREO_CONTADORES = c;
    pintarNavCorreo();
    const sel = document.getElementById('correo-categoria');
    [...sel.options].forEach(o => { const n = o.value === 'todas' ? 0 : c[o.value]; o.textContent = o.dataset.t + (n ? ` (${n > 99 ? '99+' : n})` : ''); });
    pintar('#correo-vistas-movil [data-carpeta="recibidos"] .n', (c.notificaciones || 0) + (c.principal || 0));
    pintar('#correo-vistas-movil [data-carpeta="negocio"] .n', c.negocio || 0);
  }
  let CORREO_CONTADORES = {};
  // Con «Todas» se suman los contadores de cada cuenta (son 2-4: una RPC liviana por cuenta).
  async function contadoresVista() {
    const res = await Promise.all(credsVista().map(id => sb.rpc('gmail_contadores', { p_credencial_id: Number(id) })));
    const suma = {};
    res.forEach(({ data }) => Object.entries(data || {}).forEach(([k, v]) => { suma[k] = (suma[k] || 0) + (Number(v) || 0); }));
    return suma;
  }

  /* ---------- Menú del Correo dentro de la barra lateral del CRM ----------
     Decisión del dueño 23-nov: un solo menú. Con Correo activo, debajo de
     su propia entrada («Correo», sección aparte de Bandeja) se despliega Redactar, las cuentas, las vistas y «Más»; al salir
     se pliega. En el teléfono (≤760) la barra lateral es un cajón: ahí manda
     la barra de arriba de la sección (#correo-movil-bar). */
  let CORREO_NAV_ON = false;
  function navCorreo(on) {
    CORREO_NAV_ON = on;
    if (!on) { document.getElementById('correo-nav')?.remove(); return; }
    pintarNavCorreo();
  }
  function pintarNavCorreo() {
    if (!CORREO_NAV_ON) return;
    const padre = document.querySelector('#sidebar-nav > .nav-item[data-sec="correo"]');
    if (!padre) return;
    let nav = document.getElementById('correo-nav');
    if (!nav) {
      nav = document.createElement('div');
      nav.id = 'correo-nav';
      nav.className = 'correo-nav';
      nav.addEventListener('click', clickNavCorreo);
    }
    if (nav.previousElementSibling !== padre) padre.after(nav);
    const n = v => v ? `<span class="n">${v > 99 ? '99+' : v}</span>` : '';
    const vivas = cuentasVivas();
    const cuenta = (id, punto, texto, extra, title) => `<button type="button" class="correo-nav-it${String(CORREO_CUENTA_ACTIVA) === String(id) ? ' on' : ''}" data-cn-cuenta="${esc(id)}" title="${esc(title || texto)}">${punto}<span class="t">${esc(texto)}</span>${extra}</button>`;
    const cuentas = !CORREO_CUENTAS.length ? '' : (CORREO_CUENTAS.length > 1 ? cuenta('todas', '<i class="fas fa-layer-group"></i>', 'Todas', n(vivas.reduce((a, c) => a + (c.no_leidos || 0), 0))) : '') +
      CORREO_CUENTAS.map(c => cuenta(c.credencial_id, `<span class="correo-nav-punto" style="--c:${colorCuenta(c.credencial_id)}"></span>`, c.email_conectado,
        c.revocado ? '<span class="correo-nav-alerta">Reconectar</span>' : n(c.no_leidos))).join('');
    const activa = cuentaCorreoActiva();
    const ops = activa && !activa.revocado ? `<details class="correo-nav-ops"><summary><i class="fas fa-sliders"></i> Opciones de la cuenta</summary>
      ${[7, 30, 90].map(d => `<button type="button" class="correo-nav-sub" data-cn-traer="${d}"><i class="fas fa-clock-rotate-left"></i> Traer últimos ${d} días</button>`).join('')}
      <button type="button" class="correo-nav-sub" data-cn="firma"><i class="fas fa-signature"></i> Firma de esta cuenta</button>
      <button type="button" class="correo-nav-sub" data-cn="desconectar"><i class="fas fa-link-slash"></i> Desconectar</button></details>` : '';
    const vista = ([k, ic, t]) => `<button type="button" class="correo-nav-it${CORREO_CARPETA === k ? ' on' : ''}" data-cn-vista="${k}"><i class="fas ${ic}"></i><span class="t">${t}</span>${k === 'negocio' ? n(CORREO_CONTADORES.negocio) : k === 'recibidos' ? n((CORREO_CONTADORES.notificaciones || 0) + (CORREO_CONTADORES.principal || 0)) : k === 'spam' ? n(CORREO_CONTADORES.spam) : ''}</button>`;
    const masAbierto = CORREO_MAS.some(([k]) => k === CORREO_CARPETA) || nav.querySelector('.correo-nav-mas')?.open;
    const opsAbierto = nav.querySelector('.correo-nav-ops')?.open;
    nav.innerHTML = `<button type="button" class="correo-nav-redactar" data-cn="redactar"><i class="fas fa-pen"></i> Redactar</button>
      <div class="correo-nav-t">Cuentas</div>${cuentas}${ops}
      <button type="button" class="correo-nav-sub" data-cn="conectar"><i class="fas fa-plus"></i> ${CORREO_CUENTAS.length ? 'Conectar otra cuenta' : 'Conectar Gmail'}</button>
      <div class="correo-nav-t">Vistas</div>${CORREO_VISTAS.map(vista).join('')}
      <details class="correo-nav-mas"${masAbierto ? ' open' : ''}><summary>Más</summary>${CORREO_MAS.map(vista).join('')}</details>`;
    if (opsAbierto) nav.querySelector('.correo-nav-ops')?.setAttribute('open', '');
  }
  function clickNavCorreo(e) {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.cnCuenta) window.elegirCuentaCorreo(d.cnCuenta);
    else if (d.cnVista) elegirCarpetaCorreo(d.cnVista);
    else if (d.cnTraer) window.traerCorreosAnteriores(Number(d.cnTraer));
    else if (d.cn === 'redactar') abrirCompose({ modo: 'nuevo' });
    else if (d.cn === 'conectar') conectarGmail();
    else if (d.cn === 'firma') window.editarFirmaCorreo();
    else if (d.cn === 'desconectar') { const c = cuentaCorreoActiva(); if (c) window.desconectarCuentaCorreo(c.credencial_id, c.email_conectado); }
  }
  // Realtime (gmail-correos-live): durante un backfill llegan cientos de
  // eventos seguidos, por eso se agrupan en una sola recarga.
  let CORREO_RECARGA_T = null;
  function programarRecargaCorreo() {
    clearTimeout(CORREO_RECARGA_T);
    CORREO_RECARGA_T = setTimeout(() => {
      if (CORREO_BACKFILL) return;
      refrescarBadgeCorreo();
      if (correoSeccionActiva() && CORREO_CARPETA !== 'contactos') { cargarBandejaCorreo('refrescar'); cargarContadoresCorreo(); }
    }, 1500);
  }

  /* ---------- Selector de cuentas Gmail (multi-cuenta) ----------
     gmail_cuentas() devuelve una fila POR CADA cuenta conectada del asesor.
     CORREO_CUENTA_ACTIVA decide cuál bandeja se ve -- se guarda en
     localStorage para sobrevivir un refresh, y si la cuenta guardada ya no
     existe (se desconectó en otra sesión) se cae a la primera disponible. */
  async function refrescarEstadoGmail() {
    const banner = document.getElementById('correo-banner');
    const txt = document.getElementById('correo-banner-txt');
    const btn = document.getElementById('correo-banner-btn');
    const selector = document.getElementById('correo-cuenta-selector');
    const syncBtn = document.getElementById('correo-sync-btn');
    const syncTime = document.getElementById('correo-sync-time');
    const { data, error } = await sb.rpc('gmail_cuentas');
    if (error) { txt.textContent = 'No se pudo consultar el estado de Gmail.'; return; }
    CORREO_CUENTAS = data || [];
    CORREO_CUENTAS.filter(c => !c.revocado).forEach(c => cargarFirmaGmail(c.credencial_id));
    actualizarBadgeCorreo();

    const layout = document.getElementById('correo-layout');
    layout.classList.toggle('sin-cuenta', !CORREO_CUENTAS.length);
    if (!CORREO_CUENTAS.length) {
      banner.style.display = 'none';
      selector.style.display = 'none';
      syncBtn.style.display = 'none';
      syncTime.style.display = 'none';
      CORREO_CUENTA_ACTIVA = null;
      document.getElementById('correo-lista').innerHTML = '<div class="correo-empty"><i class="fas fa-envelope"></i><p>Conecta tu Gmail para ver y enviar correo desde el CRM.</p><button type="button" class="dbtn save" onclick="conectarGmail()"><i class="fas fa-plug"></i> Conectar Gmail</button></div>';
      return;
    }

    // Con una sola cuenta «Todas» no aporta nada: se trabaja sobre esa cuenta.
    if (esTodas() ? CORREO_CUENTAS.length < 2 || !cuentasVivas().length : !CORREO_CUENTAS.some(c => String(c.credencial_id) === String(CORREO_CUENTA_ACTIVA))) {
      CORREO_CUENTA_ACTIVA = CORREO_CUENTAS.length > 1 && cuentasVivas().length ? 'todas' : String(CORREO_CUENTAS[0].credencial_id);
      try { localStorage.setItem('correo_cuenta_activa', CORREO_CUENTA_ACTIVA); } catch { /* sin storage */ }
    }
    const activa = cuentaCorreoActiva();
    const revocada = activa?.revocado ? activa : CORREO_CUENTAS.find(c => c.revocado && esTodas());

    if (revocada) {
      banner.style.display = 'flex';
      banner.style.background = 'rgba(239,68,68,.1)';
      banner.style.borderColor = 'rgba(239,68,68,.35)';
      txt.textContent = `${revocada.email_conectado} se desconectó — reautoriza el acceso, dejaste de recibir correo nuevo.`;
      btn.textContent = 'Reconectar Gmail';
      btn.style.display = '';
    } else {
      banner.style.display = 'none';
    }

    selector.style.display = '';
    document.getElementById('correo-cuenta-actual').textContent = activa ? activa.email_conectado : 'Todas las cuentas';
    renderMenuCuentas();
    pintarNavCorreo();
    const sinSync = activa ? activa.revocado : !cuentasVivas().length;
    syncBtn.style.display = sinSync ? 'none' : '';
    syncTime.style.display = sinSync ? 'none' : '';
    const ultima = activa ? activa.ultima_sync_en : cuentasVivas().map(c => c.ultima_sync_en).filter(Boolean).sort()[0];
    syncTime.textContent = `Sincronizado ${tiempoRelativoCorto(ultima)}`;
    if (CORREO_CARPETA === 'contactos') cargarContactosCorreo(); else cargarBandejaCorreo(CORREO_BANDEJA_DATA.length ? 'refrescar' : 'nuevo');
    cargarContadoresCorreo();
    // Primera vez que se abre una cuenta: se traen los últimos 7 días de Gmail
    // (antes solo llegaban los 50 más recientes al conectar).
    const sinHistorial = activa ? (!activa.revocado && !activa.backfill_desde ? activa : null) : cuentasVivas().find(c => !c.backfill_desde);
    if (sinHistorial && !CORREO_BACKFILL) window.traerCorreosAnteriores(7, sinHistorial.credencial_id);
  }

  function renderMenuCuentas() {
    const menu = document.getElementById('correo-cuenta-menu');
    const activa = cuentaCorreoActiva();
    const ops = activa && !activa.revocado ? `
      <div class="correo-cuenta-sep"></div>
      ${[7, 30, 90].map(d => `<button type="button" class="correo-cuenta-op" onclick="traerCorreosAnteriores(${d})"><i class="fas fa-clock-rotate-left"></i> Traer últimos ${d} días</button>`).join('')}
      <button type="button" class="correo-cuenta-op" onclick="editarFirmaCorreo()"><i class="fas fa-signature"></i> Firma de esta cuenta</button>` : '';
    const todas = CORREO_CUENTAS.length > 1 ? `<button type="button" class="correo-cuenta-item${esTodas() ? ' activa' : ''}" onclick="elegirCuentaCorreo('todas')"><span class="cc-email">Todas las cuentas</span></button>` : '';
    menu.innerHTML = (menu.classList.contains('sheet') ? '<div class="sheet-handle"></div>' : '') + todas + CORREO_CUENTAS.map(c => `
      <button type="button" class="correo-cuenta-item${String(c.credencial_id) === String(CORREO_CUENTA_ACTIVA) ? ' activa' : ''}" onclick="elegirCuentaCorreo('${c.credencial_id}')">
        <span class="cc-email">${esc(c.email_conectado)}</span>
        ${c.no_leidos && !c.revocado ? `<span class="correo-unread-badge">${c.no_leidos}</span>` : ''}
        ${c.revocado ? '<span class="cc-revocado">Reconectar</span>' : `<span class="correo-cuenta-desvincular" onclick="event.stopPropagation();desconectarCuentaCorreo('${c.credencial_id}','${esc(c.email_conectado).replace(/'/g, '')}')" title="Desconectar"><i class="fas fa-xmark"></i></span>`}
      </button>`).join('') + ops + `<button type="button" class="correo-cuenta-agregar" onclick="conectarGmail()"><i class="fas fa-plus"></i> Conectar otra cuenta</button>`;
  }
  function toggleMenuCuentas() {
    const menu = document.getElementById('correo-cuenta-menu');
    menu.style.display = menu.style.display === 'none' ? '' : 'none';
  }
  window.elegirCuentaCorreo = (credencialId) => {
    CORREO_CUENTA_ACTIVA = String(credencialId);
    try { localStorage.setItem('correo_cuenta_activa', CORREO_CUENTA_ACTIVA); } catch { /* sin storage */ }
    document.getElementById('correo-cuenta-menu').style.display = 'none';
    pintarNavCorreo();
    cerrarHiloCorreo();
    CORREO_BANDEJA_DATA = [];
    refrescarEstadoGmail();
  };
  window.desconectarCuentaCorreo = async (credencialId, email) => {
    if (!(await confirmarSheet({ titulo: `¿Desconectar ${email}?`, detalle: 'Dejas de recibir correo nuevo de esa cuenta en el CRM.', textoOk: 'Desconectar', destructivo: true }))) return;
    const { error } = await sb.rpc('gmail_desconectar', { p_credencial_id: Number(credencialId) });
    if (error) { errToast('No se pudo desconectar la cuenta'); return; }
    if (String(credencialId) === CORREO_CUENTA_ACTIVA) { CORREO_CUENTA_ACTIVA = 'todas'; try { localStorage.removeItem('correo_cuenta_activa'); } catch { /* sin storage */ } }
    okToast('Cuenta desconectada');
    refrescarEstadoGmail();
  };
  window.editarFirmaCorreo = async () => {
    document.getElementById('correo-cuenta-menu').style.display = 'none';
    const c = cuentaCorreoActiva();
    if (!c) return;
    const v = await pedirTexto({ titulo: 'Firma de ' + c.email_conectado, detalle: 'Se agrega al final de cada correo que escribas desde esta cuenta. Si la dejas vacía se usa la firma que tienes en Gmail.', label: 'Firma', tipo: 'textarea', valor: c.firma_texto || '', placeholder: 'Tu nombre\nDestino y Eventos Lotus 360\nWhatsApp +58 ...', textoOk: 'Guardar' });
    if (v === null) return;
    const { error } = await sb.rpc('gmail_guardar_firma', { p_credencial_id: Number(c.credencial_id), p_firma: v });
    if (error) { errToast('No se pudo guardar la firma'); return; }
    c.firma_texto = v.trim() || null;
    okToast('Firma guardada');
  };

  async function llamarFuncionCorreo(nombre, body) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) throw new Error('sesion');
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${nombre}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || 'error');
    return data;
  }

  async function sincronizarCorreoAhora() {
    const btn = document.getElementById('correo-sync-btn');
    const icon = btn.querySelector('i');
    if (btn.disabled) return;
    btn.disabled = true;
    icon.classList.add('girando');
    try {
      const ids = esTodas() ? credsVista() : [CORREO_CUENTA_ACTIVA];
      let nuevos = 0;
      for (const id of ids) nuevos += (await llamarFuncionCorreo('gmail-sync-manual', { credencial_id: Number(id) })).nuevos || 0;
      const data = { nuevos };
      okToast(data.nuevos > 0 ? `${data.nuevos} correo${data.nuevos > 1 ? 's' : ''} nuevo${data.nuevos > 1 ? 's' : ''}` : 'Ya estás al día');
      await refrescarEstadoGmail();
    } catch (e) {
      errToast(e.message === 'sesion' ? 'Sesión expirada, recarga la página' : e.message === 'gmail_revocado' ? 'Tu Gmail se desconectó, reautoriza el acceso' : 'No se pudo sincronizar ahora, se reintenta solo cada 20 min');
    } finally {
      btn.disabled = false;
      icon.classList.remove('girando');
    }
  }

  // Trae de Gmail los correos de los últimos `dias` (y pone al día leído,
  // estrella, archivado de los que ya estaban). gmail-sync-manual corta cada
  // ~80 s y devuelve page_token; se repite hasta terminar.
  window.traerCorreosAnteriores = async (dias, credencial = null) => {
    document.getElementById('correo-cuenta-menu').style.display = 'none';
    if (CORREO_BACKFILL) { errToast('Ya se están trayendo correos, espera a que termine'); return; }
    const cred = credencial ? String(credencial) : esTodas() ? null : CORREO_CUENTA_ACTIVA;
    if (!cred) return;
    CORREO_BACKFILL = cred;
    const caja = document.getElementById('correo-backfill');
    let nuevos = 0, actualizados = 0, token = null, ok = true, vueltas = 0, fallidos = 0, pasadas = 0;
    const pintar = () => {
      caja.hidden = false;
      caja.innerHTML = `<i class="fas fa-cloud-arrow-down"></i><span>Trayendo tus correos de los últimos ${dias} días… ${nuevos} nuevo${nuevos === 1 ? '' : 's'}${actualizados ? `, ${actualizados} puestos al día` : ''}</span><div class="bar"><i></i></div>`;
    };
    pintar();
    try {
      // Una pasada recorre todas las páginas; si algún correo falló (límite de
      // Gmail, red) se repite entera: los ya guardados se saltean, solo se
      // reintentan los que faltaban. Termina solo con una pasada sin fallos.
      let terminado = false;
      do {
        const data = await llamarFuncionCorreo('gmail-sync-manual', { credencial_id: Number(cred), backfill_dias: dias, page_token: token });
        nuevos += data.nuevos || 0;
        actualizados += data.actualizados || 0;
        fallidos += data.fallidos || 0;
        token = data.page_token;
        pintar();
        if (enVista(cred) && data.nuevos && correoSeccionActiva()) cargarBandejaCorreo('refrescar');
        if (!token) {
          terminado = !fallidos;
          if (!terminado && ++pasadas < 4) fallidos = 0;
          else if (!terminado) throw new Error('backfill incompleto');
        }
      } while ((token || !terminado) && ++vueltas < 120);
      if (!terminado) ok = false;
    } catch { ok = false; }
    CORREO_BACKFILL = null;
    if (ok) {
      caja.hidden = true;
      const c = CORREO_CUENTAS.find(x => String(x.credencial_id) === String(cred));
      if (c) c.backfill_desde = new Date(Date.now() - dias * 864e5).toISOString();
      okToast(nuevos ? `Listo: ${nuevos} correo${nuevos === 1 ? '' : 's'} de los últimos ${dias} días` : `Tu bandeja ya tenía los últimos ${dias} días`);
    } else {
      caja.innerHTML = `<i class="fas fa-triangle-exclamation"></i><span>No se pudieron traer todos los correos anteriores (${nuevos} llegaron).</span><button type="button" class="correo-sync-btn" onclick="traerCorreosAnteriores(${dias},'${cred}')">Reintentar</button>`;
    }
    if (enVista(cred) && correoSeccionActiva()) { cargarBandejaCorreo('refrescar'); cargarContadoresCorreo(); }
    refrescarBadgeCorreo();
  };

  window.conectarGmail = conectarGmail;
  async function conectarGmail() {
    document.getElementById('correo-cuenta-menu').style.display = 'none';
    const { data: state, error } = await sb.rpc('gmail_iniciar_conexion');
    if (error || !state) { errToast('No fue posible iniciar la conexión con Gmail'); return; }
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', GMAIL_CLIENT_ID);
    url.searchParams.set('redirect_uri', GMAIL_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', GMAIL_SCOPES);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
    window.open(url.toString(), '_blank');
  }

  /* ---------- Redactor (nuevo, responder, responder a todos, reenviar) ----------
     Una sola hoja lateral para los cuatro modos. Responder y reenviar mandan el
     id de la fila original (responde_a / reenviar_de): gmail-enviar saca de ahí
     el Message-ID real, el hilo y, al reenviar, los adjuntos originales. El
     borrador de un correo nuevo se guarda en localStorage por cuenta. */
  let COMPOSE = { modo: 'nuevo', correoId: null, adjuntos: [], reenviarDe: null };
  const COMPOSE_TITULOS = { nuevo: 'Redactar correo', responder: 'Responder', todos: 'Responder a todos', reenviar: 'Reenviar' };
  const claveBorradorCorreo = () => 'correo_borrador_' + CORREO_CUENTA_ACTIVA;
  /* Firma: la que el asesor escribió a mano en el CRM manda; si no hay, la que
     tiene en Gmail (Edge gmail-firma, la API de envío no la agrega sola). */
  const CORREO_FIRMAS = new Map(); // credencial_id -> { html saneado, en }
  const CORREO_FIRMAS_EN_CURSO = new Map();
  function sanitizarFirmaHtml(html) {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,link,meta,base,form,input,button,textarea,select,svg,math,noscript').forEach(n => n.remove());
    doc.body.querySelectorAll('*').forEach(el => [...el.attributes].forEach(a => {
      const n = a.name.toLowerCase(), v = a.value.trim();
      if (n.startsWith('on') || (n === 'src' && !/^(https?:|data:image\/)/i.test(v)) || (['href', 'action', 'formaction', 'background', 'xlink:href'].includes(n) && !/^(https?:|mailto:|tel:)/i.test(v))) el.removeAttribute(a.name);
    }));
    return doc.body.innerHTML.trim();
  }
  async function cargarFirmaGmail(credId) {
    const k = String(credId), previa = CORREO_FIRMAS.get(k);
    if (previa && Date.now() - previa.en < 600000) return previa.html;
    if (!CORREO_FIRMAS_EN_CURSO.has(k)) {
      CORREO_FIRMAS_EN_CURSO.set(k, llamarFuncionCorreo('gmail-firma', { credencial_id: Number(credId) })
        .then(d => { const html = sanitizarFirmaHtml(d.firma_html); CORREO_FIRMAS.set(k, { html, en: Date.now() }); return html; })
        .catch(() => previa?.html || '')
        .finally(() => CORREO_FIRMAS_EN_CURSO.delete(k)));
    }
    return CORREO_FIRMAS_EN_CURSO.get(k);
  }
  function firmaCorreoHtml() {
    const k = String(COMPOSE.credencialId);
    const manual = CORREO_CUENTAS.find(c => String(c.credencial_id) === k)?.firma_texto;
    if (manual) return `<div class="correo-firma">-- <br>${esc(manual).replace(/\n/g, '<br>')}</div>`;
    const gmail = CORREO_FIRMAS.get(k)?.html;
    return gmail ? `<div class="correo-firma">${gmail}</div>` : '';
  }
  // reemplazar=true al cambiar de cuenta (el bloque es de la otra); false cuando
  // la firma de Gmail llega tarde y no hay que pisar lo que el asesor ya editó.
  function aplicarFirmaCompose(reemplazar) {
    const body = document.getElementById('compose-body');
    const nueva = firmaCorreoHtml();
    const actual = body.querySelector('.correo-firma');
    if (actual) { if (!reemplazar) return; if (nueva) actual.outerHTML = nueva; else actual.remove(); return; }
    if (!nueva) return;
    const t = document.createElement('template');
    t.innerHTML = nueva;
    const cita = body.querySelector('.correo-cita');
    if (cita) cita.before(t.content); else body.append(t.content);
  }
  function cargarFirmaEnCompose() {
    const estado = COMPOSE, cred = estado.credencialId;
    cargarFirmaGmail(cred).then(() => { if (COMPOSE === estado && estado.credencialId === cred) aplicarFirmaCompose(false); });
  }
  function textoOriginalCorreo(c) {
    return esc(c.cuerpo_texto || textoDeHtml(c.cuerpo_html) || c.snippet || '').replace(/\n/g, '<br>');
  }
  function mostrarCcoCompose(mostrar) {
    document.getElementById('compose-cco-wrap').hidden = !mostrar;
    document.getElementById('compose-cco-toggle').hidden = mostrar;
    if (mostrar) document.getElementById('compose-cco').focus();
  }
  function leerBorradorCompose() {
    try { const b = JSON.parse(localStorage.getItem(claveBorradorCorreo()) || 'null'); return b && (b.para || b.asunto || textoDeHtml(b.cuerpo)) ? b : null; } catch { return null; }
  }
  function guardarBorradorCompose() {
    if (COMPOSE.modo !== 'nuevo') return;
    try { localStorage.setItem(claveBorradorCorreo(), JSON.stringify({ para: val('compose-para'), cc: val('compose-cc'), cco: val('compose-cco'), asunto: val('compose-asunto'), de: COMPOSE.credencialId, cuerpo: document.getElementById('compose-body').innerHTML })); } catch { /* sin storage */ }
  }
  function abrirCompose({ modo = 'nuevo', correoId = null, para = '' } = {}) {
    if (!credDeTrabajo()) { errToast('Conecta un Gmail antes de redactar'); return; }
    if (ENVIO_PENDIENTE) enviarPendienteYa();
    const c = correoId ? CORREOS_DATA.get(correoId) : null;
    // Responder sale de la cuenta dueña del hilo (con «Todas» puede ser cualquiera).
    const credencialId = String(c?.credencial_id || credDeTrabajo());
    const yo = (CORREO_CUENTAS.find(x => String(x.credencial_id) === credencialId)?.email_conectado || '').toLowerCase();
    const emailDe = d => extraerEmailDeCabecera(d).toLowerCase();
    COMPOSE = { modo, correoId, adjuntos: [], reenviarDe: modo === 'reenviar' ? correoId : null, credencialId };
    let vPara = para, vCc = '', vCco = '', asunto = '', cuerpo = '<br>' + firmaCorreoHtml();
    if (c && modo !== 'reenviar') {
      const destino = c.direccion === 'saliente' ? (c.para || []) : [c.de];
      vPara = destino.join(', ');
      if (modo === 'todos') {
        const yaEstan = new Set([yo, ...destino.map(emailDe)]);
        vCc = [...(c.direccion === 'saliente' ? [] : (c.para || [])), ...(c.cc || [])].filter(d => { const e = emailDe(d); return e && !yaEstan.has(e) && yaEstan.add(e); }).join(', ');
      }
      asunto = /^re:/i.test(c.asunto || '') ? c.asunto : `Re: ${c.asunto || ''}`;
      const quien = c.direccion === 'saliente' ? yo : c.de;
      cuerpo += `<br><div class="correo-cita">El ${esc(fmtFechaHoraCaracas(c.enviado_en))}, ${esc(quien)} escribió:<blockquote>${textoOriginalCorreo(c)}</blockquote></div>`;
    } else if (c) {
      asunto = /^(fwd?|rv):/i.test(c.asunto || '') ? c.asunto : `Fwd: ${c.asunto || ''}`;
      cuerpo += `<br><div class="correo-cita">---------- Mensaje reenviado ----------<br>De: ${esc(c.de)}<br>Fecha: ${esc(fmtFechaHoraCaracas(c.enviado_en))}<br>Asunto: ${esc(c.asunto || '')}<br>Para: ${esc((c.para || []).join(', '))}<br><br>${textoOriginalCorreo(c)}</div>`;
    } else if (modo === 'nuevo' && !para) {
      const b = leerBorradorCompose();
      if (b) {
        vPara = b.para || ''; vCc = b.cc || ''; vCco = b.cco || ''; asunto = b.asunto || ''; cuerpo = b.cuerpo || cuerpo;
        if (b.de && CORREO_CUENTAS.some(x => !x.revocado && String(x.credencial_id) === String(b.de))) COMPOSE.credencialId = String(b.de);
      }
    }
    document.getElementById('compose-titulo').textContent = COMPOSE_TITULOS[modo] || COMPOSE_TITULOS.nuevo;
    // Responder/reenviar quedan en la cuenta dueña del hilo: otra no tiene ese
    // Message-ID ni puede traer los adjuntos del original.
    const selDe = document.getElementById('compose-de');
    const cuentasDe = CORREO_CUENTAS.filter(x => !x.revocado || String(x.credencial_id) === COMPOSE.credencialId);
    selDe.innerHTML = cuentasDe.map(x => `<option value="${esc(x.credencial_id)}">${esc(x.email_conectado)}</option>`).join('');
    selDe.value = COMPOSE.credencialId;
    selDe.disabled = modo !== 'nuevo' || cuentasDe.length < 2;
    document.getElementById('compose-para').value = vPara;
    document.getElementById('compose-cc').value = vCc;
    document.getElementById('compose-cco').value = vCco;
    mostrarCcoCompose(!!vCco);
    document.getElementById('compose-asunto').value = asunto;
    document.getElementById('compose-body').innerHTML = cuerpo;
    document.getElementById('compose-descartar').hidden = modo !== 'nuevo';
    pintarAdjuntosCompose();
    openSheet('correo-compose-sheet');
    cargarFirmaEnCompose();
    setTimeout(() => {
      const body = document.getElementById('compose-body');
      if (!vPara) { document.getElementById('compose-para').focus(); return; }
      body.focus();
      const r = document.createRange(); r.setStart(body, 0); r.collapse(true);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }, 60);
  }
  window.abrirCompose = abrirCompose;
  window.responderCorreo = (correoId, modo) => abrirCompose({ modo, correoId });
  function cerrarCompose() {
    const habiaTexto = COMPOSE.modo === 'nuevo' && leerBorradorCompose();
    closeSheet('correo-compose-sheet');
    if (habiaTexto) okToast('Borrador guardado');
  }
  function descartarCompose() {
    try { localStorage.removeItem(claveBorradorCorreo()); } catch { /* sin storage */ }
    closeSheet('correo-compose-sheet');
  }
  function pintarAdjuntosCompose() {
    const orig = COMPOSE.reenviarDe ? (CORREOS_DATA.get(COMPOSE.reenviarDe)?.gmail_correo_adjuntos || []) : [];
    document.getElementById('compose-adjuntos').innerHTML =
      orig.map(a => `<span><i class="fas fa-paperclip"></i> ${esc(a.filename || 'adjunto')} <small class="muted">del original</small></span>`).join('') +
      (orig.length ? '<a href="#" class="correo-quitar-orig" onclick="event.preventDefault();quitarAdjuntosOriginal()">Quitar adjuntos del original</a>' : '') +
      COMPOSE.adjuntos.map((f, i) => `<span>${esc(f.name)} (${fmtTamano(f.size)}) <a href="#" onclick="event.preventDefault();quitarAdjuntoCompose(${i})" style="color:#f66">×</a></span>`).join('');
  }
  window.quitarAdjuntosOriginal = () => { COMPOSE.reenviarDe = null; pintarAdjuntosCompose(); };
  window.agregarAdjuntoCompose = (files) => {
    const total = [...COMPOSE.adjuntos, ...files].reduce((acc, f) => acc + f.size, 0);
    if (total > 25 * 1024 * 1024) { errToast('Los adjuntos superan 25 MB en total'); return; }
    COMPOSE.adjuntos.push(...files);
    pintarAdjuntosCompose();
  };
  window.quitarAdjuntoCompose = (idx) => {
    COMPOSE.adjuntos.splice(idx, 1);
    pintarAdjuntosCompose();
  };
  function parsearDirecciones(valor) {
    return (valor || '').split(',').map(s => s.trim()).filter(Boolean);
  }
  async function enviarCompose() {
    const para = parsearDirecciones(val('compose-para'));
    const cc = parsearDirecciones(val('compose-cc'));
    const bcc = parsearDirecciones(val('compose-cco'));
    const asunto = val('compose-asunto').trim();
    const bodyEl = document.getElementById('compose-body');
    const texto = bodyEl.innerText.trim();
    const html = bodyEl.innerHTML.trim();
    const sinFirma = bodyEl.cloneNode(true);
    sinFirma.querySelectorAll('.correo-firma').forEach(n => n.remove());
    if (!para.length) { errToast('Ingresa al menos un destinatario'); return; }
    const mala = [...para, ...cc, ...bcc].find(d => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(extraerEmailDeCabecera(d)));
    if (mala) { errToast(`Revisa esta dirección: ${mala}`); return; }
    if (!asunto) { errToast('Ingresa un asunto'); return; }
    if (!sinFirma.textContent.trim()) { errToast('Escribe el cuerpo del correo'); return; }
    const original = COMPOSE.correoId ? CORREOS_DATA.get(COMPOSE.correoId) : null;
    // Deshacer envío (F1): la hoja se cierra sin tocar su contenido y la EF se
    // llama recién a los 5 s. Deshacer la vuelve a abrir tal cual.
    closeSheet('correo-compose-sheet');
    ENVIO_PENDIENTE = { estado: COMPOSE, original, datos: { para, cc, bcc, asunto, texto, html }, t: setTimeout(enviarPendienteYa, CORREO_DESHACER_MS) };
    avisoDeshacer(true);
  }
  const CORREO_DESHACER_MS = 5000;
  let ENVIO_PENDIENTE = null;
  function avisoDeshacer(mostrar) {
    let el = document.getElementById('correo-deshacer');
    if (!mostrar) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'correo-deshacer';
      el.className = 'correo-deshacer';
      el.setAttribute('role', 'status');
      el.innerHTML = '<i class="fas fa-paper-plane"></i><span>Enviando…</span><button type="button">Deshacer</button><i class="correo-deshacer-barra"></i>';
      el.querySelector('button').onclick = deshacerEnvio;
      document.body.append(el);
    }
  }
  function deshacerEnvio() {
    const p = ENVIO_PENDIENTE;
    if (!p) return;
    clearTimeout(p.t);
    ENVIO_PENDIENTE = null;
    avisoDeshacer(false);
    COMPOSE = p.estado;
    openSheet('correo-compose-sheet');
  }
  function enviarPendienteYa() {
    const p = ENVIO_PENDIENTE;
    if (!p) return;
    clearTimeout(p.t);
    ENVIO_PENDIENTE = null;
    avisoDeshacer(false);
    return ejecutarEnvio(p);
  }
  async function ejecutarEnvio({ estado, original, datos: { para, cc, bcc, asunto, texto, html } }) {
    try {
      const adjuntos = await Promise.all(estado.adjuntos.map(async (f) => ({ filename: f.name, mime_type: f.type || 'application/octet-stream', contenido_base64: await fileABase64(f) })));
      await llamarFuncionCorreo('gmail-enviar', {
        credencial_id: Number(estado.credencialId), lead_id: original?.lead_id ?? null,
        para, cc, bcc, asunto, cuerpo: texto, cuerpo_html: html, adjuntos,
        responde_a: ['responder', 'todos'].includes(estado.modo) ? estado.correoId : undefined,
        reenviar_de: estado.reenviarDe || undefined,
      });
      okToast('Correo enviado');
      if (estado.modo === 'nuevo') { try { localStorage.removeItem(claveBorradorCorreo()); } catch { /* sin storage */ } }
      if (CORREO_CARPETA !== 'contactos') cargarBandejaCorreo('refrescar');
      if (original && CORREO_HILO_ABIERTO === idHiloSeguro(original.gmail_thread_id)) window.abrirHiloCorreo(CORREO_HILO_ABIERTO);
    } catch (e) {
      errToast(e.message === 'adjuntos_exceden_25mb' ? 'Los adjuntos superan 25 MB' : e.message === 'sesion' ? 'Sesión expirada, recarga la página' : 'No se pudo enviar el correo');
      // Si nadie abrió otro redactor mientras tanto, se reabre este para reintentar.
      if (COMPOSE === estado && !hojaAbierta()) openSheet('correo-compose-sheet');
    }
  }
  // Cerrar la pestaña con un envío en espera lo perdería: el navegador pregunta antes.
  addEventListener('beforeunload', e => { if (ENVIO_PENDIENTE) e.preventDefault(); });

  // Autocompletado de Para/CC/CCO: contactos del propio correo + leads con email.
  function conectarAutocompletarDireccion(inputId) {
    const input = document.getElementById(inputId), sug = document.getElementById(inputId + '-sug');
    let t = null, items = [], sel = -1;
    const termino = () => input.value.slice(input.value.lastIndexOf(',') + 1).trim();
    const cerrar = () => { sug.hidden = true; items = []; sel = -1; };
    const elegir = (i) => {
      const it = items[i];
      if (!it) return;
      const previos = input.value.slice(0, input.value.lastIndexOf(',') + 1).trim();
      const dir = it.nombre ? `${it.nombre.replace(/[",<>]/g, '')} <${it.email}>` : it.email;
      input.value = (previos ? previos + ' ' : '') + dir + ', ';
      cerrar();
      input.focus();
      guardarBorradorCompose();
    };
    input.addEventListener('input', () => {
      clearTimeout(t);
      const q = termino();
      if (!q) { cerrar(); return; }
      t = setTimeout(async () => {
        const { data } = await sb.rpc('gmail_buscar_contactos', { p_q: q, p_limite: 8 });
        if (termino() !== q) return;
        const vistos = new Set();
        items = (data || []).filter(x => !vistos.has(x.email) && vistos.add(x.email));
        if (!items.length) { cerrar(); return; }
        sel = 0;
        sug.innerHTML = items.map((x, i) => `<button type="button" class="correo-sug-item${i === 0 ? ' on' : ''}" data-i="${i}"><b>${esc(x.nombre || x.email)}</b>${x.origen === 'lead' ? ` <span class="correo-chip lead">Lead #${x.lead_id}</span>` : ''}<small>${esc(x.email)}</small></button>`).join('');
        sug.hidden = false;
      }, 200);
    });
    sug.addEventListener('mousedown', e => { const b = e.target.closest('[data-i]'); if (b) { e.preventDefault(); elegir(Number(b.dataset.i)); } });
    input.addEventListener('keydown', e => {
      if (sug.hidden || !items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        sug.querySelectorAll('[data-i]').forEach((b, i) => b.classList.toggle('on', i === sel));
      } else if ((e.key === 'Enter' || e.key === 'Tab') && sel >= 0) { e.preventDefault(); elegir(sel); }
      else if (e.key === 'Escape') cerrar();
    });
    input.addEventListener('blur', () => setTimeout(cerrar, 150));
  }

  window.abrirLeadPorId = async (leadId) => {
    const { data: l, error } = await sb.from('leads').select('*').eq('id', leadId).single();
    if (error || !l) { errToast('No se pudo cargar ese lead'); return; }
    openDrawer(l);
  };

  /* ---------- Bandeja: carpetas, consulta paginada e hilos ----------
     Cada carpeta es un filtro sobre gmail_correos.etiquetas (los labelIds de
     Gmail): Recibidos = INBOX, con las mismas pestañas que Gmail (Principal =
     INBOX sin categoría). Los hilos se arman client-side con lo traído; al
     abrir uno se pide el hilo completo. */
  function elegirCarpetaCorreo(carpeta) {
    CORREO_CARPETA = carpeta;
    document.querySelectorAll('#correo-vistas-movil [data-carpeta]').forEach(b => b.classList.toggle('on', b.dataset.carpeta === carpeta));
    document.getElementById('correo-categoria').hidden = carpeta !== 'recibidos';
    document.getElementById('correo-filtros').hidden = carpeta === 'contactos';
    pintarNavCorreo();
    cerrarHiloCorreo();
    if (carpeta === 'contactos') cargarContactosCorreo(); else cargarBandejaCorreo();
  }
  window.elegirCarpetaCorreo = elegirCarpetaCorreo;
  function consultaCorreos(desde, hasta) {
    const conAdjuntos = correoFiltro === 'adjuntos';
    let q = sb.from('gmail_correos').select(conAdjuntos ? CORREO_SELECT.replace('gmail_correo_adjuntos(', 'gmail_correo_adjuntos!inner(') : CORREO_SELECT)
      .in('credencial_id', credsVista()).is('eliminado_en', null);
    const basura = '{TRASH,SPAM,DRAFT}';
    // Negocio: lo que sigue en Recibidos y es de cliente, proveedor o interno
    // (clase de F2). Sin clase todavía (Jev dudó o falló) vale la regla de F1:
    // Principal, sin categoría de Gmail. Archivar lo saca igual que de Recibidos.
    if (CORREO_CARPETA === 'negocio') q = q.contains('etiquetas', ['INBOX']).not('etiquetas', 'ov', basura).or(`clase.in.(${CORREO_CLASES_NEGOCIO}),and(clase.is.null,etiquetas.not.ov.{${CORREO_CATEGORIAS}})`);
    else if (CORREO_CARPETA === 'recibidos') {
      q = q.contains('etiquetas', ['INBOX']).not('etiquetas', 'ov', basura);
      if (CORREO_CATEGORIA === 'principal') q = q.not('etiquetas', 'ov', `{${CORREO_CATEGORIAS}}`);
      else if (CORREO_CATEGORIA === 'promociones') q = q.contains('etiquetas', ['CATEGORY_PROMOTIONS']);
      else if (CORREO_CATEGORIA === 'social') q = q.contains('etiquetas', ['CATEGORY_SOCIAL']);
      else if (CORREO_CATEGORIA === 'notificaciones') q = q.overlaps('etiquetas', ['CATEGORY_UPDATES', 'CATEGORY_FORUMS']);
    } else if (CORREO_CARPETA === 'destacados') q = q.contains('etiquetas', ['STARRED']).not('etiquetas', 'ov', basura);
    else if (CORREO_CARPETA === 'enviados') q = q.contains('etiquetas', ['SENT']).not('etiquetas', 'ov', basura);
    else if (CORREO_CARPETA === 'spam') q = q.contains('etiquetas', ['SPAM']);
    else if (CORREO_CARPETA === 'papelera') q = q.contains('etiquetas', ['TRASH']);
    else q = q.not('etiquetas', 'ov', basura);
    if (correoFiltro === 'no_leidos') q = q.eq('leido', false).eq('direccion', 'entrante');
    else if (correoFiltro === 'sin_vincular') q = q.is('lead_id', null);
    const t = terminoBusquedaCorreo();
    if (t) q = q.or(['asunto', 'de', 'snippet', 'cuerpo_texto'].map(c => `${c}.ilike.*${t}*`).join(','));
    return q.order('enviado_en', { ascending: false }).range(desde, hasta);
  }
  // Mismo criterio que consultaCorreos, para sacar de la lista lo que una
  // acción (archivar, papelera...) movió a otra carpeta sin volver a pedir.
  function correoEnCarpeta(m) {
    const e = m.etiquetas || [], tiene = x => e.includes(x);
    const basura = tiene('TRASH') || tiene('SPAM') || tiene('DRAFT');
    if (CORREO_CARPETA === 'negocio') return tiene('INBOX') && !basura && (m.clase ? CORREO_CLASES_NEGOCIO.includes(m.clase) : !CORREO_CATEGORIAS.some(tiene));
    if (CORREO_CARPETA === 'recibidos') return tiene('INBOX') && !basura;
    if (CORREO_CARPETA === 'destacados') return tiene('STARRED') && !basura;
    if (CORREO_CARPETA === 'enviados') return tiene('SENT') && !basura;
    if (CORREO_CARPETA === 'spam') return tiene('SPAM');
    if (CORREO_CARPETA === 'papelera') return tiene('TRASH');
    return !basura;
  }
  // modo: 'nuevo' (cambió carpeta/filtro/búsqueda), 'mas' (scroll infinito),
  // 'refrescar' (mismo tamaño, sin perder el scroll: realtime, acciones).
  async function cargarBandejaCorreo(modo = 'nuevo') {
    const box = document.getElementById('correo-lista');
    if (!credsVista().filter(Boolean).length || CORREO_CARPETA === 'contactos') return;
    if (modo === 'mas' && (CORREO_CARGANDO_MAS || !CORREO_HAY_MAS)) return;
    const pedido = ++CORREO_PEDIDO;
    const desde = modo === 'mas' ? CORREO_BANDEJA_DATA.length : 0;
    const hasta = modo === 'refrescar' ? Math.max(CORREO_BANDEJA_DATA.length, CORREO_PAGINA) - 1 : desde + CORREO_PAGINA - 1;
    if (modo === 'nuevo') box.innerHTML = '<div class="tbl-state skel show"><div class="skel-bar"></div><div class="skel-bar"></div><div class="skel-bar"></div><div class="skel-bar"></div></div>';
    CORREO_CARGANDO_MAS = modo === 'mas';
    const { data, error } = await consultaCorreos(desde, hasta);
    CORREO_CARGANDO_MAS = false;
    if (pedido !== CORREO_PEDIDO) return;
    if (error) {
      if (modo !== 'mas') box.innerHTML = '<div class="correo-empty"><i class="fas fa-triangle-exclamation"></i><p>No se pudo cargar la bandeja</p></div>';
      return;
    }
    data.forEach(c => { if (!CORREOS_DATA.get(c.id)?.cuerpo_html && !CORREOS_DATA.get(c.id)?.cuerpo_texto) CORREOS_DATA.set(c.id, c); });
    CORREO_BANDEJA_DATA = modo === 'mas' ? [...CORREO_BANDEJA_DATA, ...data] : data;
    CORREO_HAY_MAS = data.length === hasta - desde + 1;
    const scroll = box.scrollTop;
    renderBandejaCorreo();
    if (modo !== 'nuevo') box.scrollTop = scroll;
  }
  window.cargarBandejaCorreo = cargarBandejaCorreo;
  const CORREO_VACIOS = {
    negocio: ['fa-briefcase', 'Nada de negocio por ahora: ni clientes ni proveedores. Lo personal y las promos están en Recibidos.'],
    recibidos: ['fa-inbox', 'No hay correos en esta pestaña.'], destacados: ['fa-star', 'Todavía no destacaste ningún correo.'],
    enviados: ['fa-paper-plane', 'No hay correos enviados en lo sincronizado.'], todos: ['fa-envelope-open-text', 'Todavía no hay correos sincronizados.'],
    spam: ['fa-circle-check', 'No hay spam. ¡Bien!'], papelera: ['fa-trash', 'La papelera está vacía.'],
  };
  function renderBandejaCorreo() {
    const box = document.getElementById('correo-lista');
    if (!CORREO_BANDEJA_DATA.length) {
      const filtrado = terminoBusquedaCorreo() || correoFiltro !== 'todos';
      const [icono, texto] = filtrado ? ['fa-filter', 'Ningún correo coincide con la búsqueda o el filtro.'] : (CORREO_VACIOS[CORREO_CARPETA] || CORREO_VACIOS.todos);
      box.innerHTML = `<div class="correo-empty"><i class="fas ${icono}"></i><p>${texto}</p>${!filtrado && cuentaCorreoActiva()?.backfill_desde ? '' : ''}</div>`;
      return;
    }
    box.innerHTML = renderHilosBandeja(CORREO_BANDEJA_DATA) + (CORREO_HAY_MAS ? '<div class="correo-mas"><button type="button" class="correo-sync-btn" onclick="cargarBandejaCorreo(\'mas\')">Cargar más</button></div>' : '');
  }

  function agruparPorHilo(data) {
    const hilos = new Map();
    for (const c of data) {
      if (!hilos.has(c.gmail_thread_id)) hilos.set(c.gmail_thread_id, []);
      hilos.get(c.gmail_thread_id).push(c);
    }
    return [...hilos.values()]
      .map(msgs => msgs.sort((a, b) => new Date(a.enviado_en) - new Date(b.enviado_en)))
      .sort((a, b) => new Date(b[b.length - 1].enviado_en) - new Date(a[a.length - 1].enviado_en));
  }
  const HILOS_DATA = new Map(); // id de hilo -> mensajes (de la lista, o el hilo completo si se abrió)
  let CORREO_HILO_ABIERTO = null;
  function renderHilosBandeja(data) {
    return agruparPorHilo(data).map(msgs => {
      const ultimo = msgs[msgs.length - 1];
      const id = idHiloSeguro(ultimo.gmail_thread_id);
      if (!HILOS_DATA.has(id) || CORREO_HILO_ABIERTO !== id) HILOS_DATA.set(id, msgs);
      const noLeidos = msgs.filter(m => !m.leido && m.direccion === 'entrante').length;
      const saliente = CORREO_CARPETA === 'enviados' || ultimo.direccion === 'saliente';
      const remitente = saliente ? 'Para: ' + (ultimo.para || []).map(nombreDeCabecera).join(', ') : nombreDeCabecera(ultimo.de);
      const destacado = msgs.some(m => (m.etiquetas || []).includes('STARRED'));
      const conAdjunto = msgs.some(m => m.gmail_correo_adjuntos?.length);
      const leadId = msgs.find(m => m.lead_id)?.lead_id;
      const provId = !leadId && msgs.find(m => m.proveedor_id)?.proveedor_id;
      const cuenta = esTodas() && CORREO_CUENTAS.find(c => String(c.credencial_id) === String(ultimo.credencial_id));
      const chips = [leadId && `<span class="correo-chip lead"><i class="fas fa-user"></i> Lead #${leadId}</span>`,
        provId && `<span class="correo-chip prov"><i class="fas fa-truck-field"></i> Proveedor</span>`,
        conAdjunto && '<span class="correo-chip"><i class="fas fa-paperclip"></i> Adjunto</span>',
        cuenta && `<span class="correo-chip cuenta" style="--c:${colorCuenta(cuenta.credencial_id)}" title="${esc(cuenta.email_conectado)}">${esc(cuenta.email_conectado.split('@')[0])}</span>`].filter(Boolean).join('');
      return `
      <div class="correo-row${noLeidos ? ' no-leido' : ''}${id === CORREO_HILO_ABIERTO ? ' active' : ''}" data-thread="${id}" onclick="abrirHiloCorreo('${id}')">
        ${avatarCorreo(saliente ? (ultimo.para || [])[0] : ultimo.de)}
        <div class="correo-row-body">
          <div class="correo-row-top"><b>${esc(remitente)}${msgs.length > 1 ? ` <span class="correo-row-n">${msgs.length}</span>` : ''}</b><time>${esc(fmtFechaCorreo(ultimo.enviado_en))}</time></div>
          <div class="correo-row-asunto">${esc(ultimo.asunto || '(sin asunto)')}</div>
          <div class="correo-row-snippet">${esc(ultimo.snippet || '')}</div>
          ${chips ? `<div class="correo-row-chips">${chips}</div>` : ''}
        </div>
        <div class="correo-row-meta">
          <button type="button" class="correo-row-star${destacado ? ' on' : ''}" title="${destacado ? 'Quitar destacado' : 'Destacar'}" aria-label="${destacado ? 'Quitar destacado' : 'Destacar'}" onclick="event.stopPropagation();accionCorreo('${id}','${destacado ? 'quitar_destacado' : 'destacar'}')"><i class="${destacado ? 'fas' : 'far'} fa-star"></i></button>
          ${noLeidos && msgs.length > 1 ? `<span class="correo-unread-badge">${noLeidos}</span>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  /* ---------- Contactos (derivados de lo que entra y sale del correo) ---------- */
  async function cargarContactosCorreo() {
    const box = document.getElementById('correo-lista');
    if (!credsVista().filter(Boolean).length) return;
    const pedido = ++CORREO_PEDIDO;
    box.innerHTML = '<div class="tbl-state skel show"><div class="skel-bar"></div><div class="skel-bar"></div><div class="skel-bar"></div></div>';
    let q = sb.from('gmail_contactos_v').select('email,nombre,veces,enviados,ultimo_en').in('credencial_id', credsVista())
      .not('email', 'ilike', '%noreply%').not('email', 'ilike', '%no-reply%');
    const t = terminoBusquedaCorreo();
    if (t) q = q.or(`email.ilike.*${t}*,nombre.ilike.*${t}*`);
    const { data, error } = await q.order('enviados', { ascending: false }).order('veces', { ascending: false }).limit(300);
    if (pedido !== CORREO_PEDIDO) return;
    if (error) { box.innerHTML = '<div class="correo-empty"><i class="fas fa-triangle-exclamation"></i><p>No se pudieron cargar los contactos</p></div>'; return; }
    CORREO_HAY_MAS = false;
    box.innerHTML = data.length ? data.map(c => {
      const dir = c.nombre ? `${c.nombre.replace(/[",<>]/g, '')} <${c.email}>` : c.email;
      const dirAttr = esc(dir).replace(/'/g, '&#39;');
      return `
      <div class="correo-row correo-contacto">
        ${avatarCorreo(dir)}
        <div class="correo-row-body">
          <div class="correo-row-top"><b>${esc(c.nombre || c.email)}</b><time>${esc(fmtFechaCorreo(c.ultimo_en))}</time></div>
          <div class="correo-row-asunto">${esc(c.email)}</div>
          <div class="correo-row-snippet">${c.veces} correo${c.veces === 1 ? '' : 's'}${c.enviados ? ` · le escribiste ${c.enviados}` : ''}</div>
        </div>
        <div class="correo-row-meta correo-contacto-acc">
          <button type="button" class="correo-accion" title="Escribir" aria-label="Escribir a ${esc(c.email)}" data-dir="${dirAttr}" onclick="abrirCompose({ modo: 'nuevo', para: this.dataset.dir + ', ' })"><i class="fas fa-pen"></i></button>
          <button type="button" class="correo-accion" title="Ver correos" aria-label="Ver correos con ${esc(c.email)}" data-email="${esc(c.email)}" onclick="verCorreosDeContacto(this.dataset.email)"><i class="fas fa-envelope-open-text"></i></button>
        </div>
      </div>`;
    }).join('') : `<div class="correo-empty"><i class="fas fa-address-book"></i><p>${t ? 'Ningún contacto coincide.' : 'Tus contactos aparecen acá a medida que escribes y recibes correo.'}</p></div>`;
  }
  window.verCorreosDeContacto = (email) => {
    document.getElementById('correo-search').value = email;
    elegirCarpetaCorreo('todos');
  };

  /* ---------- Lector de hilo (split-view desktop / hoja deslizante mobile) ----------
     Mismo mecanismo que .msg-conv de Mensajes (overlay absoluto dentro de un
     contenedor position:relative;overflow:hidden, con .open corriendo el
     transform) -- en desktop el media query lo convierte en columna estática.
     Se abren el último mensaje y los no leídos, como Gmail; el resto queda
     plegado y su iframe se arma recién al expandirlo. */
  const CORREO_ETIQUETAS_VISIBLES = { INBOX: 'Recibidos', SENT: 'Enviado', STARRED: 'Destacado', IMPORTANT: 'Importante', SPAM: 'Spam', TRASH: 'Papelera', CATEGORY_PROMOTIONS: 'Promociones', CATEGORY_SOCIAL: 'Social', CATEGORY_UPDATES: 'Notificaciones', CATEGORY_FORUMS: 'Foros' };
  window.abrirHiloCorreo = async (threadId) => {
    threadId = idHiloSeguro(threadId);
    CORREO_HILO_ABIERTO = threadId;
    document.querySelectorAll('#correo-lista .correo-row').forEach(r => r.classList.toggle('active', r.dataset.thread === threadId));
    document.getElementById('correo-detalle-body').innerHTML = '<div class="correo-detalle-empty"><i class="fas fa-circle-notch fa-spin"></i></div>';
    document.getElementById('correo-detalle').classList.add('open');
    const { data, error } = await sb.from('gmail_correos').select(CORREO_SELECT_HILO).eq('credencial_id', (HILOS_DATA.get(threadId) || [])[0]?.credencial_id ?? credDeTrabajo()).eq('gmail_thread_id', threadId).is('eliminado_en', null).order('enviado_en');
    if (CORREO_HILO_ABIERTO !== threadId) return;
    if (error || !data?.length) {
      document.getElementById('correo-detalle-body').innerHTML = '<div class="correo-detalle-empty"><i class="fas fa-triangle-exclamation"></i><p>No se pudo abrir esta conversación.</p></div>';
      return;
    }
    data.forEach(c => CORREOS_DATA.set(c.id, c));
    HILOS_DATA.set(threadId, data);
    pintarHiloCorreo(threadId);
    if (data.some(m => !m.leido && m.direccion === 'entrante')) accionCorreo(threadId, 'leido', { silencioso: true });
  };
  window.cerrarHiloCorreo = () => {
    CORREO_HILO_ABIERTO = null;
    document.querySelectorAll('#correo-lista .correo-row.active').forEach(r => r.classList.remove('active'));
    document.getElementById('correo-detalle').classList.remove('open');
    document.getElementById('correo-detalle-body').innerHTML = '<div class="correo-detalle-empty"><i class="fas fa-envelope-open-text"></i><p>Elige un correo para leerlo.</p></div>';
  };
  function accionesHiloHtml(threadId) {
    const msgs = HILOS_DATA.get(threadId) || [];
    const et = new Set(msgs.flatMap(m => m.etiquetas || []));
    const destacado = et.has('STARRED'), papelera = et.has('TRASH'), spam = et.has('SPAM');
    const b = (accion, icono, titulo, extra = '') => `<button type="button" class="correo-accion${extra}" title="${titulo}" aria-label="${titulo}" onclick="accionCorreo('${threadId}','${accion}')"><i class="${icono}"></i></button>`;
    return [
      et.has('INBOX') ? b('archivar', 'fas fa-box-archive', 'Archivar (e)') : (!papelera && !spam ? b('mover_bandeja', 'fas fa-inbox', 'Mover a Recibidos') : ''),
      papelera ? b('restaurar', 'fas fa-trash-arrow-up', 'Sacar de la papelera') : b('papelera', 'fas fa-trash', 'Mover a la papelera (#)'),
      spam ? b('no_spam', 'fas fa-circle-check', 'No es spam') : b('spam', 'fas fa-circle-exclamation', 'Marcar como spam'),
      b('no_leido', 'fas fa-envelope', 'Marcar como no leído (Shift+U)'),
      b(destacado ? 'quitar_destacado' : 'destacar', `${destacado ? 'fas' : 'far'} fa-star`, destacado ? 'Quitar destacado (s)' : 'Destacar (s)', destacado ? ' on' : ''),
    ].join('');
  }
  function pintarHiloCorreo(threadId) {
    const msgs = HILOS_DATA.get(threadId) || [];
    const ultimo = msgs[msgs.length - 1];
    if (!ultimo) return;
    const et = [...new Set(msgs.flatMap(m => m.etiquetas || []))].filter(e => CORREO_ETIQUETAS_VISIBLES[e]);
    const leadId = msgs.find(m => m.lead_id)?.lead_id;
    const provId = !leadId && msgs.find(m => m.proveedor_id)?.proveedor_id;
    const externo = [...msgs].reverse().find(m => m.direccion === 'entrante') || ultimo;
    FRANJA = { hilo: threadId, correoId: ultimo.id, lead: leadId ? { id: leadId } : null, provId, de: externo.direccion === 'entrante' ? externo.de : (externo.para || [])[0],
      clase: ultimo.clase || msgs.find(m => m.clase)?.clase || null, sugerido: msgs.find(m => m.sugerido_lead_id)?.sugerido_lead_id || null };
    document.getElementById('correo-detalle-body').innerHTML = `${franjaHtml()}
      <div class="correo-detalle-head">
        <div class="correo-head-fila">
          <h3>${esc(ultimo.asunto || '(sin asunto)')}</h3>
          <div class="correo-hilo-acciones" id="correo-hilo-acciones">${accionesHiloHtml(threadId)}</div>
        </div>
        <div class="correo-head-fila2">
        <div class="correo-etiquetas">${et.map(e => `<span class="correo-chip">${CORREO_ETIQUETAS_VISIBLES[e]}</span>`).join('')}<span class="correo-detalle-meta">${msgs.length} mensaje${msgs.length > 1 ? 's' : ''}</span></div>
        </div>
      </div>
      <div class="correo-detalle-log">${msgs.map((c, i) => renderMensajeHilo(c, i === msgs.length - 1 || (!c.leido && c.direccion === 'entrante'))).join('')}</div>
      <div class="correo-responder-bar">
        <button type="button" class="correo-sync-btn" onclick="responderCorreo(${ultimo.id},'responder')"><i class="fas fa-reply"></i> Responder</button>
        <button type="button" class="correo-sync-btn" onclick="responderCorreo(${ultimo.id},'todos')"><i class="fas fa-reply-all"></i> <span class="cr-largo">Responder a todos</span><span class="cr-corto">Todos</span></button>
        <button type="button" class="correo-sync-btn" onclick="responderCorreo(${ultimo.id},'reenviar')"><i class="fas fa-share"></i> Reenviar</button>
      </div>`;
    completarFranja(FRANJA);
  }

  /* ---------- Franja de contexto (arriba del hilo) ----------
     Con lead: quién es, en qué estado y de qué asesor, con Abrir ficha y Crear
     tarea. Con proveedor: nombre y Abrir proveedor. Sin vínculo: el buscador
     para vincular y «Crear lead» con el nombre del remitente precargado. */
  let FRANJA = null;
  function franjaHtml() {
    const f = FRANJA;
    const btn = (accion, ic, t, extra = '') => `<button type="button" class="correo-franja-btn${extra}" onclick="correoFranja('${accion}')"><i class="fas ${ic}"></i> ${t}</button>`;
    if (f.lead) return `<div class="correo-franja" id="correo-franja" data-tipo="lead">
      <span class="correo-franja-ic"><i class="fas fa-user"></i></span>
      <div class="correo-franja-txt"><b id="correo-franja-nombre">Lead #${f.lead.id}</b><small id="correo-franja-meta">Cargando…</small></div>
      <div class="correo-franja-acc">${btn('ficha', 'fa-id-card', 'Abrir ficha', ' pri')}${btn('tarea', 'fa-list-check', 'Crear tarea')}<button type="button" class="correo-franja-btn ico" title="Desvincular" aria-label="Desvincular" onclick="vincularHiloCorreo(${f.correoId}, null)"><i class="fas fa-link-slash"></i></button></div></div>`;
    if (f.provId) return `<div class="correo-franja" id="correo-franja" data-tipo="proveedor">
      <span class="correo-franja-ic"><i class="fas fa-truck-field"></i></span>
      <div class="correo-franja-txt"><b id="correo-franja-nombre">Proveedor #${f.provId}</b><small>Proveedor</small></div>
      <div class="correo-franja-acc">${btn('proveedor', 'fa-truck-field', 'Abrir proveedor', ' pri')}</div></div>`;
    const quien = nombreDeCabecera(f.de) || extraerEmailDeCabecera(f.de) || 'Remitente';
    // Tipo de correo (clase de F2): elegirlo a mano lo aplica al hilo y los
    // próximos correos del mismo remitente lo heredan.
    const clase = `<select class="correo-franja-clase" aria-label="Tipo de correo" onchange="marcarClaseCorreo(${f.correoId}, this.value)">${f.clase ? '' : '<option value="" selected>Sin clasificar</option>'}${CORREO_CLASES.map(([v, t]) => `<option value="${v}"${f.clase === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
    const sug = f.sugerido && f.clase !== 'ruido' ? `<div class="correo-franja-sug" id="correo-franja-sug" hidden><span id="correo-franja-sug-txt"></span><button type="button" class="correo-franja-btn pri" onclick="vincularHiloCorreo(${f.correoId}, ${Number(f.sugerido)})"><i class="fas fa-link"></i> Sí, vincular</button></div>` : '';
    return `<div class="correo-franja" id="correo-franja" data-tipo="sin">
      <span class="correo-franja-ic"><i class="fas fa-link"></i></span>
      <div class="correo-franja-txt"><b>${esc(quien)}</b><small>Sin vincular · ${esc(extraerEmailDeCabecera(f.de) || '')}</small>${clase}</div>${sug}
      <div class="correo-franja-acc"><div class="correo-lead-buscar"><input type="search" class="correo-lead-input" id="correo-lead-input" placeholder="Vincular a un lead: nombre, teléfono o #ID" autocomplete="off" oninput="buscarLeadParaCorreo(this.value, ${f.correoId})"><div class="correo-lead-sug" id="correo-lead-sug" hidden></div></div>${btn('crear_lead', 'fa-user-plus', 'Crear lead', ' pri')}</div></div>`;
  }
  async function completarFranja(f) {
    const pintar = (id, t) => { const el = FRANJA === f && document.getElementById(id); if (el) el.textContent = t; };
    if (f.lead) {
      const { data } = await sb.from('leads').select('id,nombre,estado,asesor').eq('id', f.lead.id).maybeSingle();
      if (!data) { pintar('correo-franja-meta', 'No se pudo cargar el lead'); return; }
      f.lead = data;
      pintar('correo-franja-nombre', `${data.nombre || 'Sin nombre'} · #${data.id}`);
      pintar('correo-franja-meta', [data.estado, data.asesor && 'Asesor: ' + data.asesor].filter(Boolean).join(' · '));
    } else if (f.provId) {
      const { data } = await sb.from('proveedores').select('id,nombre').eq('id', f.provId).maybeSingle();
      if (data?.nombre) pintar('correo-franja-nombre', data.nombre);
    } else if (f.sugerido && f.clase !== 'ruido') {
      // El teléfono de la firma coincide con un lead: se sugiere, no se vincula solo.
      const { data } = await sb.from('leads').select('id,nombre,estado').eq('id', f.sugerido).maybeSingle();
      const caja = FRANJA === f && document.getElementById('correo-franja-sug');
      if (!data || !caja) return;
      pintar('correo-franja-sug-txt', `¿Es de ${data.nombre || 'Sin nombre'} (#${data.id}${data.estado ? ' · ' + data.estado : ''})? Coincide el teléfono.`);
      caja.hidden = false;
    }
  }
  window.marcarClaseCorreo = async (correoId, clase) => {
    if (!clase) return;
    const { error } = await sb.rpc('gmail_marcar_clase', { p_correo_id: correoId, p_clase: clase });
    if (error) { errToast('No se pudo cambiar el tipo de correo'); return; }
    const hilo = idHiloSeguro(CORREOS_DATA.get(correoId)?.gmail_thread_id);
    for (const m of HILOS_DATA.get(hilo) || []) m.clase = clase;
    CORREO_BANDEJA_DATA.forEach(m => { if (idHiloSeguro(m.gmail_thread_id) === hilo) m.clase = clase; });
    if (FRANJA && FRANJA.hilo === hilo) FRANJA.clase = clase;
    okToast(clase === 'ruido' ? 'Fuera de Negocio. Los próximos correos de este remitente también.' : 'Listo. Los próximos correos de este remitente quedan igual.');
    const antes = CORREO_BANDEJA_DATA.length;
    CORREO_BANDEJA_DATA = CORREO_BANDEJA_DATA.filter(m => idHiloSeguro(m.gmail_thread_id) !== hilo || correoEnCarpeta(m));
    if (CORREO_BANDEJA_DATA.length !== antes && CORREO_HILO_ABIERTO === hilo) cerrarHiloCorreo();
    renderBandejaCorreo();
  };
  window.correoFranja = (accion) => {
    const f = FRANJA;
    if (!f) return;
    if (accion === 'ficha' && f.lead) window.abrirLeadPorId(f.lead.id);
    else if (accion === 'tarea' && f.lead) crearTareaLead(f.lead);
    else if (accion === 'proveedor' && f.provId) abrirProveedor(f.provId);
    else if (accion === 'crear_lead') crearLead({ nombre: nombreDeCabecera(f.de) || extraerEmailDeCabecera(f.de) }, leadId => window.vincularHiloCorreo(f.correoId, leadId));
  };
  function renderMensajeHilo(c, abierto) {
    const para = [...(c.para || []), ...(c.cc || [])].map(nombreDeCabecera).join(', ');
    return `<article class="correo-msg${abierto ? ' abierto' : ''}" id="correo-msg-${c.id}">
      <div class="correo-msg-head" onclick="toggleMensajeHilo(${c.id})">
        ${avatarCorreo(c.de)}
        <div class="correo-msg-quien">
          <div><b>${esc(c.direccion === 'saliente' ? 'Yo' : nombreDeCabecera(c.de))}</b><span class="em">${esc(extraerEmailDeCabecera(c.de))}</span></div>
          <div class="correo-msg-para">para ${esc(para || '—')}${c.bcc?.length ? ` · CCO: ${esc(c.bcc.map(nombreDeCabecera).join(', '))}` : ''}</div>
          <div class="correo-msg-snip">${esc(c.snippet || '')}</div>
        </div>
        <div class="correo-msg-fecha">${c.gmail_correo_adjuntos?.length ? '<i class="fas fa-paperclip"></i> ' : ''}<time title="${esc(fmtFechaHoraCaracas(c.enviado_en))}">${esc(fmtFechaCorreo(c.enviado_en))}</time></div>
      </div>
      <div class="correo-msg-body">${abierto ? cuerpoMensajeHilo(c) : ''}</div>
    </article>`;
  }
  function cuerpoMensajeHilo(c) {
    if (!c) return '';
    return renderCuerpoCorreo(c) + (c.gmail_correo_adjuntos?.length ? renderAdjuntosCorreo(c.id, c.gmail_correo_adjuntos) : '') + `
      <div class="correo-msg-btns">
        <button type="button" class="correo-accion" onclick="responderCorreo(${c.id},'responder')"><i class="fas fa-reply"></i> Responder</button>
        <button type="button" class="correo-accion" onclick="responderCorreo(${c.id},'todos')"><i class="fas fa-reply-all"></i> A todos</button>
        <button type="button" class="correo-accion" onclick="responderCorreo(${c.id},'reenviar')"><i class="fas fa-share"></i> Reenviar</button>
      </div>`;
  }
  window.toggleMensajeHilo = (id) => {
    const art = document.getElementById('correo-msg-' + id);
    if (!art) return;
    const abrir = !art.classList.contains('abierto');
    art.classList.toggle('abierto', abrir);
    const body = art.querySelector('.correo-msg-body');
    if (abrir && !body.innerHTML.trim()) body.innerHTML = cuerpoMensajeHilo(CORREOS_DATA.get(id));
  };

  let CORREO_LEAD_T = null;
  window.buscarLeadParaCorreo = (valor, correoId) => {
    clearTimeout(CORREO_LEAD_T);
    const sug = document.getElementById('correo-lead-sug');
    const t = String(valor || '').replace(/[,()*%\\:"']/g, ' ').trim();
    if (t.length < 2) { sug.hidden = true; return; }
    CORREO_LEAD_T = setTimeout(async () => {
      const n = Number(t.replace(/^#/, ''));
      const filtros = ['nombre', 'telefono', 'email'].map(c => `${c}.ilike.*${t}*`);
      if (Number.isInteger(n) && n > 0) filtros.push(`id.eq.${n}`);
      const { data } = await sb.from('leads').select('id,nombre,telefono,email,estado').or(filtros.join(',')).order('id', { ascending: false }).limit(8);
      if (document.getElementById('correo-lead-input')?.value !== valor) return;
      sug.innerHTML = (data || []).length
        ? data.map(l => `<button type="button" class="correo-sug-item" onclick="vincularHiloCorreo(${correoId}, ${l.id})"><b>${esc(l.nombre || 'Sin nombre')}</b> <span class="muted">#${l.id}</span><small>${esc([l.telefono, l.email, l.estado].filter(Boolean).join(' · '))}</small></button>`).join('')
        : '<div class="correo-sug-item muted">Ningún lead coincide</div>';
      sug.hidden = false;
    }, 250);
  };
  // Vincula o desvincula el HILO entero (antes solo el último mensaje).
  window.vincularHiloCorreo = async (correoId, leadId) => {
    const { error } = await sb.rpc('gmail_vincular_hilo', { p_correo_id: correoId, p_lead_id: leadId });
    if (error) { errToast(leadId ? 'No se pudo vincular el correo' : 'No se pudo desvincular el correo'); return; }
    const hilo = idHiloSeguro(CORREOS_DATA.get(correoId)?.gmail_thread_id);
    const fijar = m => { m.lead_id = leadId; if (leadId) { m.clase = 'cliente'; m.sugerido_lead_id = null; } else if (m.clase === 'cliente') m.clase = null; };
    for (const m of HILOS_DATA.get(hilo) || []) fijar(m);
    CORREO_BANDEJA_DATA.forEach(m => { if (idHiloSeguro(m.gmail_thread_id) === hilo) fijar(m); });
    okToast(leadId ? `Conversación vinculada al lead #${leadId}` : 'Conversación desvinculada');
    renderBandejaCorreo();
    if (CORREO_HILO_ABIERTO === hilo) pintarHiloCorreo(hilo);
  };

  /* ---------- Acciones sobre el hilo (se aplican en Gmail vía gmail-modificar) ----------
     Optimistas: se pintan ya y se corrigen con las etiquetas reales que
     devuelve Gmail; si falla, se recarga la lista. */
  const ACCION_CORREO_TEXTO = { archivar: 'Conversación archivada', papelera: 'Movida a la papelera', restaurar: 'Sacada de la papelera', spam: 'Marcada como spam', no_spam: 'Movida a Recibidos', mover_bandeja: 'Movida a Recibidos', no_leido: 'Marcada como no leída' };
  const ACCIONES_QUE_MUEVEN = ['archivar', 'papelera', 'restaurar', 'spam', 'no_spam', 'mover_bandeja'];
  function aplicarAccionLocal(msgs, accion) {
    const quitar = (m, x) => { m.etiquetas = (m.etiquetas || []).filter(e => e !== x); };
    const poner = (m, x) => { if (!(m.etiquetas || []).includes(x)) m.etiquetas = [...(m.etiquetas || []), x]; };
    const ultimo = msgs[msgs.length - 1];
    const ultimoEntrante = [...msgs].reverse().find(m => m.direccion === 'entrante');
    if (accion === 'leido') msgs.forEach(m => { quitar(m, 'UNREAD'); m.leido = true; });
    else if (accion === 'no_leido' && ultimoEntrante) { poner(ultimoEntrante, 'UNREAD'); ultimoEntrante.leido = false; }
    else if (accion === 'destacar' && ultimo) poner(ultimo, 'STARRED');
    else if (accion === 'quitar_destacado') msgs.forEach(m => quitar(m, 'STARRED'));
    else if (accion === 'archivar') msgs.forEach(m => quitar(m, 'INBOX'));
    else if (accion === 'mover_bandeja') msgs.forEach(m => poner(m, 'INBOX'));
    else if (accion === 'papelera') msgs.forEach(m => { poner(m, 'TRASH'); quitar(m, 'INBOX'); });
    else if (accion === 'restaurar') msgs.forEach(m => quitar(m, 'TRASH'));
    else if (accion === 'spam') msgs.forEach(m => { poner(m, 'SPAM'); quitar(m, 'INBOX'); });
    else if (accion === 'no_spam') msgs.forEach(m => { quitar(m, 'SPAM'); poner(m, 'INBOX'); });
  }
  window.accionCorreo = async (threadId, accion, { silencioso = false } = {}) => {
    const enLista = CORREO_BANDEJA_DATA.filter(m => idHiloSeguro(m.gmail_thread_id) === threadId);
    const enHilo = HILOS_DATA.get(threadId) || [];
    const ref = (enHilo.length ? enHilo : enLista).slice(-1)[0];
    if (!ref) return;
    aplicarAccionLocal(enLista, accion);
    if (enHilo !== enLista) aplicarAccionLocal(enHilo.filter(m => !enLista.includes(m)), accion);
    const mueve = ACCIONES_QUE_MUEVEN.includes(accion);
    if (mueve) CORREO_BANDEJA_DATA = CORREO_BANDEJA_DATA.filter(m => idHiloSeguro(m.gmail_thread_id) !== threadId || correoEnCarpeta(m));
    if ((mueve || accion === 'no_leido') && CORREO_HILO_ABIERTO === threadId) cerrarHiloCorreo();
    renderBandejaCorreo();
    const barra = CORREO_HILO_ABIERTO === threadId && document.getElementById('correo-hilo-acciones');
    if (barra) barra.innerHTML = accionesHiloHtml(threadId);
    try {
      const data = await llamarFuncionCorreo('gmail-modificar', { correo_id: ref.id, accion });
      for (const m of [...CORREO_BANDEJA_DATA, ...(HILOS_DATA.get(threadId) || [])]) {
        const e = data.etiquetas?.[m.gmail_message_id];
        if (e) { m.etiquetas = e; m.leido = !e.includes('UNREAD'); }
      }
      if (!silencioso && ACCION_CORREO_TEXTO[accion]) okToast(ACCION_CORREO_TEXTO[accion]);
      cargarContadoresCorreo();
      refrescarBadgeCorreo();
    } catch (e) {
      errToast(e.message === 'gmail_revocado' ? 'Tu Gmail se desconectó, reconéctalo' : 'No se pudo aplicar el cambio en Gmail');
      cargarBandejaCorreo('refrescar');
    }
  };

  /* ---------- Teléfono: deslizar una fila a la izquierda la archiva ----------
     Solo en la vista de una columna (≤760). Un gesto más vertical que
     horizontal es scroll y se suelta; pasado el 35 % del ancho, archiva. */
  let GESTO = null;
  const esTelefono = () => matchMedia('(max-width:760px)').matches;
  function gestoArchivarInicio(e) {
    const fila = esTelefono() && e.touches.length === 1 && e.target.closest('.correo-row[data-thread]');
    GESTO = fila ? { fila, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, horizontal: null } : null;
  }
  function gestoArchivarMover(e) {
    const g = GESTO;
    if (!g) return;
    const dx = e.touches[0].clientX - g.x, dy = e.touches[0].clientY - g.y;
    if (g.horizontal === null && Math.abs(dx) + Math.abs(dy) > 10) g.horizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
    if (!g.horizontal) return;
    g.dx = Math.min(0, dx);
    g.fila.classList.add('deslizando');
    g.fila.style.transform = `translateX(${g.dx}px)`;
  }
  function gestoArchivarFin(e) {
    const g = GESTO;
    GESTO = null;
    if (!g?.horizontal) return;
    e.preventDefault();
    g.fila.classList.remove('deslizando');
    const archivar = -g.dx > g.fila.offsetWidth * 0.35;
    g.fila.style.transform = archivar ? 'translateX(-100%)' : '';
    if (archivar) setTimeout(() => window.accionCorreo(g.fila.dataset.thread, 'archivar'), 160);
  }
  let ATAJO_G = 0;

  // Atajos tipo Gmail. Nunca mientras se escribe ni con una hoja abierta.
  function atajosCorreo(e) {
    if (!correoSeccionActiva() || e.ctrlKey || e.metaKey || e.altKey || hojaAbierta()) return;
    if (e.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    const hilo = CORREO_HILO_ABIERTO, k = e.key;
    const ultimoId = () => (HILOS_DATA.get(hilo) || []).slice(-1)[0]?.id;
    let hecho = true;
    // «g» y después otra tecla en menos de 1,5 s: g n = ir a Negocio.
    const conG = Date.now() - ATAJO_G < 1500;
    ATAJO_G = 0;
    if (conG && k === 'n') elegirCarpetaCorreo('negocio');
    else if (k === 'g') ATAJO_G = Date.now();
    else if (k === '?') openSheet('correo-atajos-sheet');
    else if (k === 'c') abrirCompose({ modo: 'nuevo' });
    else if (k === '/') document.getElementById('correo-search').focus();
    else if (k === 'j' || k === 'k') {
      const filas = [...document.querySelectorAll('#correo-lista .correo-row[data-thread]')];
      const idx = filas.findIndex(r => r.dataset.thread === hilo);
      const f = filas[Math.min(Math.max(idx + (k === 'j' ? 1 : -1), 0), filas.length - 1)];
      if (f) { abrirHiloCorreo(f.dataset.thread); f.scrollIntoView({ block: 'nearest' }); }
    } else if (!hilo) hecho = false;
    else if (k === 'e') accionCorreo(hilo, 'archivar');
    else if (k === '#') accionCorreo(hilo, 'papelera');
    else if (k === 's') accionCorreo(hilo, (HILOS_DATA.get(hilo) || []).some(m => (m.etiquetas || []).includes('STARRED')) ? 'quitar_destacado' : 'destacar');
    else if (k === 'r' || k === 'a' || k === 'f') { const id = ultimoId(); if (id) abrirCompose({ modo: { r: 'responder', a: 'todos', f: 'reenviar' }[k], correoId: id }); }
    else if (k === 'U') accionCorreo(hilo, 'no_leido');
    else if (k === 'u' || k === 'Escape') cerrarHiloCorreo();
    else hecho = false;
    if (hecho) e.preventDefault();
  }

  return { setupCorreo, cargarCorreoSeccion, programarRecargaCorreo, navCorreo };
}
