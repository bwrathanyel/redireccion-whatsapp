// Modo Prueba: franja de aviso, acceso rápido por rol en el login y práctica guiada.
// La práctica abre el CRM de a poco: el menú arranca vacío y cada misión desbloquea su sección con una explicación.
// Las misiones se tildan solas escuchando 'prueba:accion' (prueba-mock.js) y la sección visible.
(() => {
  'use strict';
  const P = window.__PRUEBA;
  if (!P) return;
  const CLAVE = 'misiones';
  const esLead = (d, rpc, f = () => true) => d.tipo === 'rpc' && d.nombre === rpc && f(d.args);

  const MISIONES = {
    asesor: [
      { id: 'atender', titulo: 'Atiende tu lead nuevo', foco: 'Atender', texto: 'En «Leads nuevos por atender» hay clientes que te escribieron. Toca el botón verde <b>Atender</b> de María González: la marcas como atendida y, en el CRM real, se abre su WhatsApp. (No toques «No puedo»: eso se la pasa a otro asesor.)', sec: 'leads',
        ok: d => esLead(d, 'actualizar_lead', a => a.p_estado === 'ATENDIDO') },
      { id: 'tarifario', titulo: 'Busca en el Tarifario', foco: 'Hoteles', texto: 'Entra a la pestaña <b>Hoteles</b>, escribe <b>Margarita</b> en el buscador y mira cuántos hoteles salen y desde qué precio. Así sabrás qué ofrecerle a María.', sec: 'tarifario',
        ok: d => d.tipo === 'busqueda' && /margarita/i.test(d.texto) },
      { id: 'cotizar', titulo: 'Registra la cotización', foco: 'María González', texto: 'Ya le mandaste el precio a María por WhatsApp. Toca su nombre en la lista para abrir su ficha y, en el selector de estado de arriba, elige <b>Cotización enviada</b>. (Si cotizas con el botón «Cotizar», el CRM lo registra solo.) Si ya lo hiciste antes, toca Saltar.', sec: 'leads',
        ok: d => esLead(d, 'registrar_cotizacion_enviada') || esLead(d, 'actualizar_lead', a => a.p_estado === 'COTIZACION ENVIADA') },
      { id: 'abono', titulo: 'Registra un abono', foco: 'Registrar abono', texto: 'Ricardo Díaz ya pagó la mitad de su viaje y debe $325. Anota un pago parcial que te hizo: en su tarjeta toca <b>Registrar abono</b>, escribe un monto menor o igual al saldo (ej. 100) y confirma.', sec: 'mis-ventas',
        ok: d => esLead(d, 'registrar_abono_venta') },
      { id: 'lyra', titulo: 'Pídele ayuda a Lyra', texto: 'Abre a Lyra con el círculo de abajo a la izquierda (o con Ctrl+Z, fuera de cualquier campo) y escríbele: «¿cómo va la reserva de María González?».', sec: null,
        ok: d => d.tipo === 'fn' && /^asistente/.test(d.nombre) && !d.args?.accion },
    ],
    admin: [
      { id: 'kpi', titulo: 'Explora el Dashboard', texto: 'Este es el resumen de todo el negocio. Toca una tarjeta de arriba (por ejemplo «Por atender») o una barra del embudo: te muestra el número y, si quieres, la lista de clientes que hay detrás.', sec: 'dashboard',
        ok: d => d.tipo === 'click' && d.dentro === 'dashboard' && d.kpi },
      { id: 'pago', titulo: 'Verifica un pago', foco: 'Comprobante', texto: 'Cuando un asesor avisa que su cliente pagó, el pago queda en «Por verificar». Toca «Comprobante» para ver la prueba y, si todo cuadra, toca «Aprobar» y confirma.', sec: 'pagos',
        ok: d => esLead(d, 'verificar_pago', a => a.p_aprobar !== false) || esLead(d, 'confirmar_venta') },
      { id: 'repartir', titulo: 'Reparte números', foco: 'Detectar', texto: 'Un cliente escribió directo y hay que dárselo a un asesor. Pega en el cuadro estas dos líneas: «0414-5550101 Marta» y «0424-5550102 Jorge». Toca «Detectar números», revísalos y toca «Repartir». En «Asignar» eliges un asesor o dejas el reparto automático.', sec: 'repartir',
        ok: d => d.tipo === 'fn' && d.nombre === 'repartir-numeros' && d.args?.accion === 'repartir' },
      { id: 'personal', titulo: 'Revisa quién vino hoy', foco: 'Ver día por día', texto: 'Cada tarjeta es una persona del equipo y dice si marcó asistencia hoy. Busca a quien aparece como «No marcó hoy» y abre «Ver día por día» para ver sus horarios.', sec: 'gestion-personal',
        ok: d => d.tipo === 'click' && d.dentro === 'gestion-personal' && d.fila },
    ],
  };
  // Explicación que aparece la primera vez que se abre cada sección (clave: sec o 'lyra').
  const INTROS = {
    leads: { icono: '👥', titulo: 'Se abrió: Leads', texto: 'Tu bandeja de clientes. Cada persona que escribe por Instagram, Facebook o la web cae aquí. Los nuevos aparecen en <b>Por atender</b> hasta que alguien los toma.' },
    pipeline: { icono: '🧭', titulo: 'Se abrió: Pipeline', texto: 'El embudo de ventas: cada barra es una etapa (<b>Atendido → Cotización enviada → En espera de pago → Pago realizado</b>). Toca una y «Ver leads» para ver quiénes están ahí.' },
    tarifario: { icono: '🏨', titulo: 'Se abrió: Tarifario', texto: 'Todos los hoteles, paquetes y precios para cotizar. Buscas por destino o por nombre del hotel y ves fotos y tarifas.' },
    'mis-ventas': { icono: '💰', titulo: 'Se abrió: Mis Ventas', texto: 'Lo que ya vendiste y lo que te falta cobrar. Cuando un cliente paga una parte, lo registras aquí como <b>abono</b>.' },
    lyra: { icono: '✨', titulo: 'Se abrió: Lyra', texto: 'Tu asistente. Pídele cosas con palabras normales: «deja una nota a María» o «¿cómo va la reserva de María González?».' },
    'gestion-personal': { icono: '🧑‍🤝‍🧑', titulo: 'Se abrió: Gestión de Personal', texto: 'Tu equipo. Ves quién está trabajando hoy, su asistencia y sus datos.' },
    pagos: { icono: '🧾', titulo: 'Se abrió: Pagos por verificar', texto: 'Cuando un asesor avisa «el cliente pagó», el comprobante llega aquí. Tú lo revisas y lo confirmas; recién ahí cuenta como venta.' },
    repartir: { icono: '📲', titulo: 'Se abrió: Repartir números', texto: 'Pegas teléfonos o capturas de clientes nuevos y los asignas a los asesores para que los atiendan.' },
    dashboard: { icono: '📊', titulo: 'Se abrió: Dashboard', texto: 'El resumen del negocio en números. No hace falta entenderlo todo de una: toca un número y te muestra qué clientes hay detrás.' },
  };
  const bienvenida = rol => [
    { icono: '👋', titulo: `¡Hola${ss('prueba:nombre') ? ', ' + escHtml(ss('prueba:nombre')) : ''}! Esta es tu práctica`, texto: rol === 'admin'
      ? 'Este es el CRM de Lotus 360. Eres el administrador: verificas pagos, repartes clientes entre los asesores y ves el trabajo del equipo. Aquí todo es inventado: puedes tocar lo que quieras, no le llega nada a ningún cliente.'
      : 'Este es el CRM, el sistema donde atendemos a los clientes de Lotus 360. Aquí todo es inventado: puedes tocar lo que quieras, no le llega nada a ningún cliente.' },
    { icono: '🪜', titulo: 'Vamos de a poco', texto: 'No vas a ver todo de golpe. Empiezas con una sola sección y, cada vez que terminas una tarea, se abre la siguiente con su explicación.' },
    { icono: '🎯', titulo: 'Tu guía', texto: 'Abajo a la derecha está la tarjeta con tu tarea. Si no sabes dónde ir, toca <b>Llévame</b>. Si te equivocas, <b>Reiniciar</b> deja todo como al principio.' },
  ];
  const CIERRE = {
    asesor: 'Repite tú solo el caso completo: atiende a un cliente, cotízale, ciérrale la venta y registra su pago. Si te trabas, pregúntale a Lyra.',
    admin: 'Repite tú solo el recorrido: aprueba un pago, reparte un número y revisa quién vino hoy. Si te trabas, pregúntale a Lyra.',
  };
  const cierre = () => CIERRE[P.m.rol] || CIERRE.asesor;

  const ss = (k, v) => { try { return v === undefined ? sessionStorage.getItem(k) : v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { return null; } };
  const escHtml = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const nuevo = () => ({ hechas: [], vistas: [] });
  const lee = () => { try { return JSON.parse(sessionStorage.getItem(CLAVE)) || nuevo(); } catch { return nuevo(); } };
  const guarda = e => { try { sessionStorage.setItem(CLAVE, JSON.stringify(e)); } catch { /* sin storage: el progreso vive solo en esta pestaña */ } };
  let estado = lee(); // { hechas: [ids], vistas: [secciones abiertas], bienvenida, pausa, plegado }
  estado.hechas ||= []; estado.vistas ||= [];
  const lista = () => MISIONES[P.m.rol] || [];
  const actual = () => lista().find(x => !estado.hechas.includes(x.id));
  const clave = mi => mi.sec || 'lyra';
  // medicion.js escucha estas señales y etiqueta cada evento con la misión en curso (null en pausa).
  const mide = (tipo, extra = {}) => dispatchEvent(new CustomEvent('prueba:medir', { detail: { tipo, mision: actual()?.id ?? null, ...extra } }));
  window.__pruebaMision = () => (estado.bienvenida && !estado.pausa && actual()?.id) || null;
  const esMovil = () => matchMedia('(max-width:760px)').matches;
  // #login es position:fixed (offsetParent siempre null) y el mock fija m.rol con la primera RPC del login: se mira la clase.
  const loginVisible = () => !!document.getElementById('login')?.classList.contains('show');
  const enLogin = () => !P.m.rol || loginVisible();
  // En la presentación (presentacion.js) no hay misiones: menú completo, sin bienvenida ni panel.
  const presentando = () => ss('prueba:modo') === 'presentacion';
  // Pestaña nueva (sessionStorage vacío): la sesión vieja del mock sigue en localStorage y saltaría el inicio.
  if (!ss('prueba:rol')) try { Object.keys(localStorage).filter(k => k.startsWith('prueba:')).forEach(k => localStorage.removeItem(k.slice(7))); } catch { /* sin storage */ }

  /* ---------- Estilos ---------- */
  // Sin movimiento (reduced-motion o paleta «sereno»): el foco aparece en su lugar y la flecha queda quieta.
  const QUIETO = s => `${s} #prueba-spot,${s} #prueba-spot.pp-fijo{transition:opacity .15s}${s} #prueba-flecha .pf-linea{transition:none}${s} #prueba-flecha.pp-listo g{animation:none}`;
  const css = document.createElement('style');
  css.textContent = `
#prueba-franja{position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:99990;padding:3px 12px;border-radius:0 0 10px 10px;font:600 11.5px/1.4 system-ui,sans-serif;letter-spacing:.02em;color:#1a1200;background:#ffb020;box-shadow:0 4px 14px -6px rgba(0,0,0,.5);pointer-events:none;white-space:nowrap}
#prueba-panel{position:fixed;right:16px;bottom:16px;z-index:99980;width:min(340px,calc(100vw - 32px));color:var(--txt,#eee);background:var(--panel-solid,#1b1b1f);border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:16px;box-shadow:0 18px 40px -16px rgba(0,0,0,.7);font:14px/1.45 system-ui,sans-serif;overflow:hidden}
#prueba-panel header{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer;user-select:none}
#prueba-panel header b{flex:1;font-size:13px}
#prueba-panel .pp-barra{height:4px;background:var(--line2,rgba(255,255,255,.1))}
#prueba-panel .pp-barra i{display:block;height:100%;background:#ffb020;transition:width .4s}
#prueba-panel .pp-cuerpo{padding:12px 14px 14px}
#prueba-panel h4{margin:0 0 4px;font-size:15.5px}
#prueba-panel p{margin:0 0 12px;color:var(--muted,#aaa)}
#prueba-panel .pp-acc{display:flex;gap:8px;flex-wrap:wrap}
#prueba-panel button,#prueba-modal button{font:inherit;font-size:13px;border-radius:10px;padding:7px 12px;cursor:pointer;border:1px solid var(--line2,rgba(255,255,255,.14));background:transparent;color:inherit}
#prueba-panel button.pp-ir,#prueba-modal button.pp-ir{background:#ffb020;color:#1a1200;border-color:#ffb020;font-weight:600}
#prueba-panel .pp-ok{color:#4fbf7f;font-weight:600}
#prueba-panel button.pp-reini{margin-left:auto;border-color:transparent;color:var(--muted,#aaa);text-decoration:underline}
#prueba-panel.plegado .pp-cuerpo{display:none}
#prueba-panel.festejo{animation:pp-pulso .7s}
@keyframes pp-pulso{40%{transform:scale(1.03);box-shadow:0 0 0 4px rgba(79,191,127,.5)}}
#prueba-modal{position:fixed;inset:0;z-index:99985;display:flex;overflow:auto;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));background:rgba(8,8,12,.8);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:var(--txt,#eee);font:15px/1.5 system-ui,sans-serif}
#prueba-modal .pm-caja{width:min(420px,100%);margin:auto;padding:26px 24px 20px;border-radius:18px;background:var(--panel-solid,#1b1b1f);border:1px solid var(--line2,rgba(255,255,255,.14));box-shadow:0 30px 60px -20px rgba(0,0,0,.8);text-align:center}
#prueba-modal .pm-ico{font-size:40px;line-height:1;margin-bottom:10px}
#prueba-modal h3{margin:0 0 8px;font-size:19px}
#prueba-modal p{margin:0 0 18px;color:var(--muted,#bbb)}
#prueba-modal .pm-puntos{display:flex;justify-content:center;gap:6px;margin:-4px 0 16px}
#prueba-modal .pm-puntos i{width:7px;height:7px;border-radius:50%;background:var(--line2,rgba(255,255,255,.2))}
#prueba-modal .pm-puntos i.on{background:#ffb020}
#prueba-modal .pm-acc{display:flex;gap:8px;justify-content:center}
#prueba-modal button{font-size:14px;padding:9px 18px}
body.prueba-guiada #sidebar-nav [data-sec]:not([data-prueba-ok]),
body.prueba-guiada #sidebar-nav .nav-label:not([data-label="secciones"]),
body.prueba-guiada #nav-buscar,body.prueba-guiada .side-modo,
body.prueba-guiada .topbar .search,body.prueba-guiada .topbar .pill,
body.prueba-guiada #topbar-tutorial-btn,body.prueba-guiada #topbar-buscar-btn,body.prueba-guiada #topbar-manual-btn,
body.prueba-guiada #ab-tutorial,body.prueba-guiada #ab-buscar,
body.prueba-guiada:not(.prueba-lyra) #lyra-dock,body.prueba-guiada:not(.prueba-lyra) #lyra-fab{display:none!important}
body:is(.menu-abierto,.chat-abierto,.lyra-abierta) #prueba-panel,body:has(:is(.sheet,.drawer,.mfs).open) #prueba-panel{display:none}
#prueba-candado{display:none;margin:12px 8px 0;padding:9px 10px;border-radius:10px;border:1px dashed var(--line2,rgba(255,255,255,.2));color:var(--muted,#999);font:12.5px/1.4 system-ui,sans-serif}
body.prueba-guiada #prueba-candado{display:block}
#prueba-spot{position:fixed;z-index:99975;pointer-events:none;opacity:0;border-radius:12px;box-shadow:0 0 0 2px #ffb020,0 0 0 9999px rgba(8,8,12,.45);transition:opacity .4s ease,top .6s var(--pp-ease),left .6s var(--pp-ease),width .6s var(--pp-ease),height .6s var(--pp-ease),border-radius .6s var(--pp-ease);--pp-ease:cubic-bezier(.22,1,.36,1)}
#prueba-spot.on{opacity:1}
#prueba-spot.pp-fijo{transition:opacity .4s ease}
#prueba-flecha{position:fixed;inset:0;width:100%;height:100%;z-index:99978;pointer-events:none;overflow:visible;opacity:0;transition:opacity .3s ease}
#prueba-flecha.on{opacity:1}
#prueba-flecha path{fill:none;stroke:#ffb020;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
#prueba-flecha .pf-linea{transition:stroke-dashoffset .55s cubic-bezier(.22,1,.36,1)}
#prueba-flecha .pf-punta{opacity:0;transition:opacity .25s ease}
#prueba-flecha.pp-listo .pf-punta{opacity:1}
#prueba-flecha.pp-listo g{animation:pp-vaiven 1.2s ease-in-out infinite alternate}
@keyframes pp-vaiven{to{transform:translate(var(--dx,0),var(--dy,0))}}
#prueba-inicio{position:fixed;inset:0;z-index:99970;display:flex;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));overflow:auto;background:var(--bg,#0e0e12);color:var(--txt,#eee);font:15px/1.5 system-ui,sans-serif}
#prueba-inicio .pi-caja{width:min(440px,100%);margin:auto;padding:28px 24px 22px;border-radius:20px;background:var(--panel-solid,#1b1b1f);border:1px solid var(--line2,rgba(255,255,255,.14));box-shadow:0 30px 60px -20px rgba(0,0,0,.8);text-align:center}
#prueba-inicio .pi-ico{font-size:42px;line-height:1;margin-bottom:8px}
#prueba-inicio h2{margin:0 0 6px;font-size:22px}
#prueba-inicio p{margin:0 0 18px;color:var(--muted,#bbb)}
#prueba-inicio label{display:block;text-align:left;font-weight:600;font-size:13.5px;margin-bottom:6px}
#prueba-inicio input{width:100%;box-sizing:border-box;padding:12px 14px;margin-bottom:14px;border-radius:12px;border:1px solid var(--line2,rgba(255,255,255,.2));background:rgba(255,255,255,.04);color:inherit;font:inherit}
#prueba-inicio input:focus{outline:2px solid #ffb020;outline-offset:1px}
#prueba-inicio .pi-ir{width:100%;padding:12px;border:0;border-radius:12px;background:#ffb020;color:#1a1200;font:600 15px system-ui,sans-serif;cursor:pointer}
#prueba-inicio .pi-error{margin:-6px 0 14px;text-align:left;font-size:13.5px;color:#ff8a7a}
#prueba-inicio .pi-aviso{margin:12px 0 0;font-size:13px;color:var(--muted,#aaa)}
#prueba-inicio .pi-real,#prueba-inicio .pi-volver{display:inline-block;margin-top:6px;padding:13px 12px;min-height:44px;box-sizing:border-box;border:0;background:none;color:var(--muted,#aaa);font:14px system-ui,sans-serif;text-decoration:underline;cursor:pointer}
#prueba-inicio .pi-cargos{display:grid;gap:10px}
#prueba-inicio .pi-cargo{display:grid;grid-template-columns:auto 1fr;column-gap:12px;align-items:center;padding:14px;border-radius:14px;border:1px solid var(--line2,rgba(255,255,255,.14));background:rgba(255,255,255,.03);color:inherit;font:inherit;text-align:left;cursor:pointer}
#prueba-inicio .pi-cargo span{grid-row:span 2;font-size:28px}
#prueba-inicio .pi-cargo small{color:var(--muted,#aaa);font-size:13px}
#prueba-inicio .pi-cargo:hover,#prueba-inicio .pi-cargo:focus-visible{border-color:#ffb020;background:rgba(255,176,32,.08);outline:none}
#forgotLink,#claimLink,#loginPrueba{display:none!important}
#prueba-panel .pp-ico{display:inline-block;animation:pp-respira 2.8s ease-in-out infinite}
@keyframes pp-respira{50%{transform:scale(1.15);filter:drop-shadow(0 0 6px rgba(255,176,32,.7))}}
#prueba-panel .pp-barra i{background:linear-gradient(90deg,#ffb020 0%,#ffd27a 50%,#ffb020 100%) 0 0/200% 100%;animation:pp-brilla 3s linear infinite}
@keyframes pp-brilla{to{background-position:-200% 0}}
@media (max-width:760px){
  #prueba-franja{left:0;right:0;transform:none;border-radius:0;padding:calc(2px + env(safe-area-inset-top)) 10px 2px;font-size:11px;text-align:center;white-space:normal}
  #prueba-franja .pf-mas{display:none}
  body:has(#prueba-franja){padding-top:calc(18px + env(safe-area-inset-top))}
  body:has(#prueba-franja) .mobile-brand{top:calc(18px + env(safe-area-inset-top))}
  #prueba-panel{left:10px;right:84px;width:auto;bottom:calc(18px + env(safe-area-inset-bottom));font-size:13px;border-radius:14px}
  body.prueba-lyra #prueba-panel{left:76px}
  body:has(input:focus,textarea:focus,select:focus) #prueba-panel{display:none}
  body.prueba-guiada .main{padding-bottom:calc(190px + env(safe-area-inset-bottom))}
  #prueba-panel .pp-ico,#prueba-panel .pp-barra i{animation:none}
  #prueba-modal{background:rgba(8,8,12,.92);-webkit-backdrop-filter:none;backdrop-filter:none}
  #prueba-panel header{padding:0 12px;min-height:44px}
  #prueba-panel header b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
  #prueba-panel .pp-cuerpo{padding:8px 12px 12px}
  #prueba-panel h4{font-size:15px}
  #prueba-panel p{font-size:14px;margin-bottom:10px}
  #prueba-panel button,#prueba-modal button{min-height:44px;padding:8px 14px;font-size:14px}
}
@media (prefers-reduced-motion:reduce){#prueba-panel,#prueba-panel.festejo,#prueba-panel .pp-ico,#prueba-panel .pp-barra i{animation:none}${QUIETO('')}}
${QUIETO(':root[data-paleta="sereno"]')}`;
  document.head.appendChild(css);

  /* ---------- Franja ---------- */
  const franja = document.createElement('div');
  franja.id = 'prueba-franja';
  franja.innerHTML = 'MODO PRUEBA · datos ficticios<span class="pf-mas"> · nada de esto es real</span>';
  document.body.appendChild(franja);

  /* ---------- Pantalla de inicio: nombre y cargo ---------- */
  // El nombre entra en los datos de ejemplo (datos-prueba.js lo lee al cargar), por eso se recarga antes de entrar.
  const CARGOS = [
    { rol: 'asesor', icono: '💬', titulo: 'Asesor de ventas', texto: 'Atiendes a los clientes, les cotizas viajes y cierras ventas.' },
    { rol: 'admin', icono: '🗂️', titulo: 'Administración', texto: 'Verificas pagos, repartes clientes y ves el trabajo del equipo.' },
    { rol: 'presentacion', icono: '🎤', titulo: 'Presentación', texto: 'El recorrido para enseñar el CRM: en vivo con proyector o para repasarlo solo.' },
  ];
  // PIN blando: el sitio es estático y se lee en el código; solo evita que un asesor entre por error.
  const PIN_PRESENTACION = '9952';
  function entrar(rol) {
    const u = window.PRUEBA_DATOS.USUARIOS[rol], sel = document.getElementById('loginUser'), pwd = document.getElementById('loginPwd');
    if (!u || !sel || !pwd) return false;
    if (![...sel.options].some(o => o.value === u.username)) sel.add(new Option(u.nombre, u.username));
    sel.value = u.username; pwd.value = 'prueba';
    estado = nuevo(); guarda(estado);
    document.getElementById('loginForm').requestSubmit();
    return true;
  }
  let entrandoDesde = 0;
  function pintaInicio() {
    let c = document.getElementById('prueba-inicio');
    if (!loginVisible()) return c?.remove();
    // La clave se borra recién al confirmar el login ('prueba:accion' tipo login); si falla, se reintenta.
    const pendiente = ss('prueba:entrar');
    if (pendiente) { if (Date.now() - entrandoDesde > 5000 && entrar(pendiente)) entrandoDesde = Date.now(); return; }
    if (c) return;
    c = document.createElement('div');
    c.id = 'prueba-inicio';
    c.dataset.nombre = ss('prueba:nombre') || '';
    const paso1 = () => {
      c.innerHTML = `<form class="pi-caja"><div class="pi-ico" aria-hidden="true">🧪</div><h2>Modo de prueba</h2><p>Practica el CRM sin miedo: los clientes, ventas y pagos son inventados.</p>
        <label for="pi-nombre">¿Cómo te llamas?</label><input id="pi-nombre" maxlength="40" autocomplete="given-name" placeholder="Tu nombre" required value="${escHtml(c.dataset.nombre)}">
        <button class="pi-ir" type="submit">Continuar</button><p class="pi-aviso">Registramos cómo usas la práctica para ayudarte donde más lo necesites.</p><a class="pi-real" href="../">Volver al CRM real</a></form>`;
      c.querySelector('input').focus();
    };
    const paso2 = () => {
      c.innerHTML = `<div class="pi-caja"><h2>¡Hola, ${escHtml(c.dataset.nombre)}!</h2><p>¿Qué cargo te interesa practicar?</p>
        <div class="pi-cargos">${CARGOS.map(x => `<button type="button" class="pi-cargo" data-rol="${x.rol}"><span aria-hidden="true">${x.icono}</span><b>${x.titulo}</b><small>${x.texto}</small></button>`).join('')}</div>
        <button type="button" class="pi-volver">← Cambiar nombre</button></div>`;
      c.querySelector('.pi-cargo').focus();
    };
    const pasoPin = (error) => {
      c.innerHTML = `<form class="pi-caja pi-pin"><div class="pi-ico" aria-hidden="true">🎤</div><h2>Presentación</h2><p>Escribe el PIN de 4 números que te dio administración.</p>
        <label for="pi-pin">PIN</label><input id="pi-pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" required${error ? ' aria-invalid="true" aria-describedby="pi-error"' : ''}>
        ${error ? '<p class="pi-error" id="pi-error" role="alert">Ese PIN no es. Prueba otra vez.</p>' : ''}<button class="pi-ir" type="submit">Entrar</button>
        <button type="button" class="pi-volver" data-volver="2">← Elegir otro cargo</button></form>`;
      c.querySelector('input').focus();
    };
    const entra = (rol, modo) => {
      ss('prueba:nombre', c.dataset.nombre); ss('prueba:rol', rol); ss('prueba:entrar', rol); ss('prueba:modo', modo); ss(CLAVE, null);
      location.reload();
    };
    c.addEventListener('submit', e => {
      e.preventDefault();
      if (e.target.classList.contains('pi-pin')) return c.querySelector('input').value.trim() === PIN_PRESENTACION ? entra('asesor', 'presentacion') : pasoPin(true);
      c.dataset.nombre = c.querySelector('input').value.replace(/[<>]/g, '').trim().slice(0, 40);
      if (c.dataset.nombre) paso2();
    });
    c.addEventListener('click', e => {
      const v = e.target.closest('.pi-volver');
      if (v) return v.dataset.volver === '2' ? paso2() : paso1();
      const b = e.target.closest('[data-rol]'); if (!b) return;
      if (b.dataset.rol === 'presentacion') return pasoPin(false);
      entra(b.dataset.rol, null);
    });
    document.body.appendChild(c); paso1();
  }

  /* ---------- Ventana de explicación (pasos con Siguiente/Atrás) ---------- */
  function modal(pasos, ultimo, fin) {
    document.getElementById('prueba-modal')?.remove();
    const m = document.createElement('div');
    m.id = 'prueba-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    let i = 0;
    const dibuja = () => {
      const p = pasos[i];
      m.innerHTML = `<div class="pm-caja"><div class="pm-ico" aria-hidden="true">${p.icono}</div><h3>${p.titulo}</h3><p>${p.texto}</p>
        ${pasos.length > 1 ? `<div class="pm-puntos">${pasos.map((_, j) => `<i${j === i ? ' class="on"' : ''}></i>`).join('')}</div>` : ''}
        <div class="pm-acc">${i ? '<button data-pm="atras">Atrás</button>' : ''}<button class="pp-ir" data-pm="sig">${i < pasos.length - 1 ? 'Siguiente' : ultimo}</button></div></div>`;
      m.querySelector('[data-pm="sig"]').focus();
    };
    m.addEventListener('click', e => {
      const b = e.target.closest('[data-pm]'); if (!b) return;
      if (b.dataset.pm === 'atras') { i--; return dibuja(); }
      if (i < pasos.length - 1) { i++; return dibuja(); }
      m.remove(); fin?.();
    });
    document.body.appendChild(m); dibuja();
  }

  /* ---------- Menú que se abre de a poco ---------- */
  function aplicaGuia() {
    const guiada = !enLogin() && !presentando() && (!!actual() || !!estado.pausa);
    document.body.classList.toggle('prueba-guiada', guiada);
    if (!guiada) return;
    const nav = document.getElementById('sidebar-nav'); if (!nav) return;
    const ok = new Set(estado.vistas);
    nav.querySelectorAll('[data-sec]').forEach(el => el.toggleAttribute('data-prueba-ok', ok.has(el.dataset.sec)));
    nav.querySelectorAll('.nav-padre').forEach(el => { if (nav.querySelector(`[data-padre="${el.dataset.sec}"][data-prueba-ok]`)) el.setAttribute('data-prueba-ok', ''); });
    document.body.classList.toggle('prueba-lyra', ok.has('lyra'));
    if (!document.getElementById('prueba-candado')) nav.insertAdjacentHTML('beforeend', '<div id="prueba-candado">🔒 Se abren más secciones a medida que avanzas.</div>');
  }
  /* ---------- Guía: foco que se desliza, flecha y scroll suave ---------- */
  const quieto = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.paleta === 'sereno';
  const pausa = ms => new Promise(ok => setTimeout(ok, quieto() ? 0 : ms));
  const limita = (v, a, b) => Math.min(Math.max(v, a), b);
  const spot = document.createElement('div'), flecha = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  spot.id = 'prueba-spot'; flecha.id = 'prueba-flecha';
  [spot, flecha].forEach(x => x.setAttribute('aria-hidden', 'true'));
  flecha.innerHTML = '<g><path class="pf-linea"/><path class="pf-punta"/></g>';
  let turno = 0, objetivo = null, conFlecha = false, apagaEn = 0, ultimoScroll = 0, rafMide = 0;
  const panelGuia = () => [...document.querySelectorAll('#prueba-pres,#prueba-panel')].find(p => p.getClientRects().length);
  // Lo que se ve del objetivo, con aire alrededor y recortado a la pantalla.
  function caja(el) {
    const r = el.getBoundingClientRect(), x = Math.max(r.left - 6, 4), y = Math.max(r.top - 6, 4), w = Math.min(r.right + 6, innerWidth - 4) - x, h = Math.min(r.bottom + 6, innerHeight - 4) - y;
    return r.width && r.height && w > 8 && h > 8 ? { x, y, w, h } : null;
  }
  function apaga() { turno++; objetivo = null; conFlecha = false; clearTimeout(apagaEn); spot.classList.remove('on'); flecha.classList.remove('on', 'pp-listo'); }
  const corta = () => { turno++; };
  // Cuando el objetivo cambia de lugar por scroll se lo sigue pegado; si se movió solo (se abrió algo), el foco viaja.
  function coloca(viaja) {
    if (!objetivo) return;
    if (!objetivo.isConnected) { objetivo = null; spot.classList.remove('on'); flecha.classList.remove('on', 'pp-listo'); return; }
    const c = caja(objetivo);
    if (!c) { spot.classList.remove('on'); flecha.classList.remove('on', 'pp-listo'); return; }
    const salta = !viaja || !spot.classList.contains('on');
    spot.classList.toggle('pp-fijo', salta);
    Object.assign(spot.style, { left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', height: c.h + 'px', borderRadius: limita((parseFloat(getComputedStyle(objetivo).borderTopLeftRadius) || 0) + 6, 8, 24) + 'px' });
    if (salta) void spot.offsetWidth;
    spot.classList.add('on');
    if (conFlecha) traza(false);
  }
  // Flecha curva desde el borde del panel hasta el borde del objetivo, apuntando a su centro. En el celular va recta.
  function traza(dibuja) {
    const p = panelGuia(), c = objetivo && caja(objetivo), g = flecha.firstChild, [linea, punta] = g.children;
    const nada = () => flecha.classList.remove('on', 'pp-listo');
    if (!p || !c || c.h > innerHeight * .6) return nada();
    const r = p.getBoundingClientRect(), cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    const dx = cx < r.left ? r.left - cx : cx > r.right ? cx - r.right : 0, dy = cy < r.top ? r.top - cy : cy > r.bottom ? cy - r.bottom : 0;
    if (!dx && !dy) return nada();
    const vertical = dy >= dx;
    const ax = vertical ? limita(cx, r.left + 20, r.right - 20) : cx < r.left ? r.left : r.right, ay = vertical ? (cy < r.top ? r.top : r.bottom) : limita(cy, r.top + 20, r.bottom - 20);
    const L = c.x - 6, R = c.x + c.w + 6, T = c.y - 6, B = c.y + c.h + 6, vx = cx - ax, vy = cy - ay;
    const k = Math.max(vx ? ((vx > 0 ? L : R) - ax) / vx : -Infinity, vy ? ((vy > 0 ? T : B) - ay) / vy : -Infinity);
    if (!(k > 0 && k < 1)) return nada();
    const bx = ax + vx * k, by = ay + vy * k, largo = Math.hypot(bx - ax, by - ay);
    if (largo < 36) return nada();
    const ux = (bx - ax) / largo, uy = (by - ay) / largo, sx = ax + ux * 8, sy = ay + uy * 8;
    const curva = innerWidth <= 760 ? 0 : Math.min(largo * .18, 60) * (ux > 0 ? -1 : 1);
    const qx = (sx + bx) / 2 - uy * curva, qy = (sy + by) / 2 + ux * curva;
    const tl = Math.hypot(bx - qx, by - qy) || 1, hx = (bx - qx) / tl, hy = (by - qy) / tl;
    linea.setAttribute('d', `M${sx} ${sy}Q${qx} ${qy} ${bx} ${by}`);
    punta.setAttribute('d', `M${bx - hx * 10 - hy * 6} ${by - hy * 10 + hx * 6}L${bx} ${by}L${bx - hx * 10 + hy * 6} ${by - hy * 10 - hx * 6}`);
    g.style.setProperty('--dx', hx * 4 + 'px'); g.style.setProperty('--dy', hy * 4 + 'px');
    const len = linea.getTotalLength();
    linea.style.strokeDasharray = len;
    if (!dibuja || quieto()) { linea.style.strokeDashoffset = 0; flecha.classList.add('on', 'pp-listo'); return; }
    flecha.classList.remove('pp-listo');
    linea.style.transition = 'none'; linea.style.strokeDashoffset = len; flecha.classList.add('on');
    void linea.getBoundingClientRect(); linea.style.transition = ''; linea.style.strokeDashoffset = 0;
    const t = turno; setTimeout(() => t === turno && conFlecha && flecha.classList.add('pp-listo'), 500);
  }
  function scroller(el) {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return null;
  }
  // scrollIntoView nativo salta en el celular: scroll propio de 700 ms que deja el objetivo en lo que el panel no tapa.
  function desliza(el, t) {
    const s = scroller(el); if (!s) return Promise.resolve();
    const r = el.getBoundingClientRect(), p = panelGuia()?.getBoundingClientRect();
    const sr = s === document.body || s === document.documentElement ? { top: 0, bottom: innerHeight } : s.getBoundingClientRect();
    const arriba = Math.max(sr.top, innerWidth <= 760 ? 72 : 16), abajo = Math.min(sr.bottom, p && p.width > innerWidth * .6 ? p.top - 12 : innerHeight), alto = abajo - arriba;
    const delta = r.height > alto * .8 ? r.top - arriba - 8 : r.top + r.height / 2 - (arriba + alto / 2);
    const desde = s.scrollTop, hasta = limita(desde + delta, 0, s.scrollHeight - s.clientHeight);
    if (Math.abs(hasta - desde) < 4) return Promise.resolve();
    if (quieto()) { s.scrollTop = hasta; return Promise.resolve(); }
    return new Promise(ok => {
      const t0 = performance.now();
      const paso = ahora => {
        if (t !== turno) return ok();
        const k = Math.min((ahora - t0) / 700, 1), e = k < .5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
        s.scrollTop = desde + (hasta - desde) * e;
        if (k < 1) requestAnimationFrame(paso); else setTimeout(ok, 120);
      };
      requestAnimationFrame(paso);
    });
  }
  // No muestra nada hasta que el objetivo existe y quedó quieto (dos medidas iguales): las secciones y la ficha entran animadas.
  const estable = (busca, t, intentos = 16) => new Promise(ok => {
    let antes = '';
    const mira = n => {
      if (t !== turno) return ok(null);
      const x = busca(), r = x?.getBoundingClientRect(), firma = r?.width ? [r.top, r.left, r.width, r.height].map(Math.round).join() : '';
      if (firma && firma === antes) return ok(x);
      antes = firma;
      if (!n) return ok(firma ? x : null);
      setTimeout(() => mira(n - 1), 250);
    };
    mira(intentos);
  });
  // Coreografía de un paso: espera al objetivo, scroll, el foco viaja, se dibuja la flecha. Un paso nuevo cancela el anterior.
  async function guiar(busca, { dura = 0 } = {}) {
    const t = ++turno; clearTimeout(apagaEn);
    conFlecha = false; flecha.classList.remove('on', 'pp-listo');
    const el = typeof busca === 'function' ? await estable(busca, t) : busca;
    if (t !== turno) return false;
    if (!el) { apaga(); return false; }
    if (!spot.isConnected) document.body.append(spot, flecha);
    await desliza(el, t); if (t !== turno) return false;
    objetivo = el; coloca(true);
    await pausa(600); if (t !== turno) return false;
    conFlecha = true; traza(true);
    await pausa(450); if (t !== turno) return false;
    if (dura) apagaEn = setTimeout(() => t === turno && apaga(), dura);
    return true;
  }
  const remide = () => { ultimoScroll = performance.now(); if (objetivo && !rafMide) rafMide = requestAnimationFrame(() => { rafMide = 0; coloca(false); }); };
  addEventListener('scroll', remide, { capture: true, passive: true });
  addEventListener('resize', remide, { passive: true });
  setInterval(() => { if (objetivo && performance.now() - ultimoScroll > 300) coloca(true); }, 500);
  // Tocar la pantalla fuera de la guía es que la persona ya está haciendo el paso: el foco se retira.
  addEventListener('pointerdown', e => { if (objetivo && !e.target.closest?.('#prueba-panel,#prueba-pres,#prueba-modal,#prueba-portada')) apaga(); }, true);
  // Busca en pantalla el botón o nombre que la misión pide tocar; la sección puede tardar en cargar.
  // El texto primero: offsetParent fuerza layout y se recorre todo el DOM.
  const buscaTexto = texto => [...document.querySelectorAll('button,summary,a,[role="tab"],[data-nav-tab],b,strong,span,.ec-nombre')].find(e => e.textContent.trim().replace(/^[^\p{L}]+/u, '').startsWith(texto)
    && e.offsetParent && !e.closest('#prueba-panel,#prueba-modal,#prueba-pres,#sidebar-nav'));
  const enfoca = (texto, opc) => guiar(() => { const x = buscaTexto(texto); return x && (x.closest('button,summary,a,[role="tab"]') || x); }, opc);
  // El menú en el celular está cerrado y algunas secciones cuelgan de un padre: se navega con la función del CRM, no con su click.
  // marca:false navega sin mover el foco (la presentación lo lleva a otro lado).
  function destaca(k, ir, foco, opc = {}) {
    if (ir && k !== 'lyra') window.__pruebaIr?.(k);
    const fab = document.getElementById('lyra-fab');
    const el = k === 'lyra' ? (fab?.offsetParent ? fab : document.getElementById('lyra-dock')) : document.querySelector(`#sidebar-nav [data-sec="${k}"]`);
    if (el && ir && (k === 'lyra' || !window.__pruebaIr)) el.click();
    if (foco) return enfoca(foco, opc);
    if (!el || opc.marca === false) return Promise.resolve(false);
    const padre = el.dataset.padre && document.querySelector(`#sidebar-nav [data-sec="${el.dataset.padre}"]`);
    return guiar(() => [el, padre].find(x => x && caja(x)), opc);
  }
  window.__pruebaGuia = { destaca, enfoca, buscaTexto, guiar, apaga, corta, pausa, quieto, enLogin, presentando };
  function presenta(mi) {
    const k = clave(mi);
    mide('mision_inicio');
    if (estado.vistas.includes(k)) { aplicaGuia(); return pinta(); }
    estado.vistas.push(k); guarda(estado); aplicaGuia();
    modal([INTROS[k]], mi.sec ? 'Ir ahí' : 'Entendido', () => { destaca(k, !!mi.sec, mi.foco, { dura: 8000 }); pinta(); });
  }
  function seguir() {
    // En el celular la tarea queda plegada en una línea; se abre tocándola.
    estado.pausa = false; estado.plegado = esMovil(); guarda(estado);
    const mi = actual();
    if (mi) return presenta(mi);
    aplicaGuia();
    modal([{ icono: '🏁', titulo: 'Desbloqueaste todo el CRM', texto: 'Ahora ves el menú completo, igual que en el CRM real. ' + cierre() }], 'Ver el CRM completo', pinta);
  }

  /* ---------- Panel ---------- */
  let panel = null;
  function pinta(festejo) {
    if (enLogin() || !estado.bienvenida) { panel?.remove(); panel = null; return; }
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'prueba-panel';
      panel.setAttribute('aria-live', 'polite');
      panel.addEventListener('click', e => {
        if (e.target.closest('header')) { estado.plegado = !estado.plegado; guarda(estado); return pinta(); }
        const b = e.target.closest('button[data-acc]'); if (!b) return;
        const mi = actual();
        if (b.dataset.acc === 'ir' && mi) { destaca(clave(mi), true, mi.foco, { dura: 8000 }); if (esMovil()) { estado.plegado = true; guarda(estado); pinta(); } }
        if (b.dataset.acc === 'seguir') seguir();
        if (b.dataset.acc === 'saltar' && mi) { mide('mision_saltar'); estado.hechas.push(mi.id); guarda(estado); seguir(); }
        if (b.dataset.acc === 'reiniciar' && confirm('¿Empezar de cero? Se borra lo que hiciste en la práctica.')) { mide('mision_reiniciar'); try { sessionStorage.removeItem(CLAVE); } catch { /* nada que limpiar */ } location.reload(); }
      });
      document.body.appendChild(panel);
    }
    const ls = lista(), hechas = ls.filter(x => estado.hechas.includes(x.id)).length, mi = actual();
    const sigNueva = mi && !estado.vistas.includes(clave(mi));
    panel.classList.toggle('plegado', !!estado.plegado);
    const rotulo = estado.plegado && mi && !estado.pausa ? `${hechas + 1}/${ls.length} · ${mi.titulo}` : `Práctica · ${hechas}/${ls.length}`;
    panel.innerHTML = `<header><span class="pp-ico">🎯</span><b>${rotulo}</b><span>${estado.plegado ? '▴' : '▾'}</span></header>
      <div class="pp-barra"><i style="width:${ls.length ? hechas / ls.length * 100 : 0}%"></i></div>
      <div class="pp-cuerpo">${estado.pausa
        ? `<p class="pp-ok">✔ ¡Bien hecho!</p><p>${!mi ? 'Terminaste todas las tareas.' : sigNueva ? 'Siguiente tarea desbloqueada: pulsa «Seguir».' : 'Sigue con la próxima tarea en esta misma sección.'}</p>
           <div class="pp-acc"><button class="pp-ir" data-acc="seguir">Seguir →</button></div>`
        : mi
        ? `<h4>${hechas + 1}. ${mi.titulo}</h4><p>${mi.texto}</p>
           <div class="pp-acc"><button class="pp-ir" data-acc="ir">Llévame</button><button data-acc="saltar">Saltar</button><button class="pp-reini" data-acc="reiniciar" title="Borra lo que hiciste y vuelve a cargar los datos de ejemplo">Reiniciar</button></div>`
        : `<h4>🏁 ¡Completaste la práctica!</h4><p>${cierre()}</p><div class="pp-acc"><button class="pp-ir" data-acc="reiniciar">Empezar de cero</button></div>`}
      </div>`;
    if (festejo) { panel.classList.remove('festejo'); void panel.offsetWidth; panel.classList.add('festejo'); }
  }
  function registra(d) {
    const mi = actual();
    if (!estado.bienvenida || estado.pausa || !mi || d.error || !mi.ok(d)) return;
    mide('mision_fin');
    estado.hechas.push(mi.id); estado.pausa = true; estado.plegado = false; guarda(estado);
    pinta(true);
  }
  addEventListener('prueba:accion', e => { if (e.detail.tipo === 'login') { ss('prueba:entrar', null); setTimeout(pinta, 600); } else registra(e.detail); });

  /* ---------- Señales de UI que no pasan por el backend ---------- */
  let secVisible = null;
  const visible = () => [...document.querySelectorAll('[id^="sec-"]')].find(s => s.offsetParent && s.getBoundingClientRect().height > 40)?.id.slice(4) || null;
  setInterval(() => {
    if (document.hidden) return;
    pintaInicio();
    aplicaGuia();
    if (!enLogin() && !presentando() && !estado.bienvenida && !document.getElementById('prueba-modal'))
      modal(bienvenida(P.m.rol), 'Empezar', () => { estado.bienvenida = true; estado.plegado = esMovil(); guarda(estado); const mi = actual(); mi ? presenta(mi) : pinta(); });
    const s = visible();
    if (s !== secVisible) { secVisible = s; if (s) { mide('seccion', { seccion: s }); registra({ tipo: 'seccion', sec: s }); } pinta(); }
  }, 700);
  document.addEventListener('input', e => { if (e.target.id === 'tar-search') registra({ tipo: 'busqueda', texto: e.target.value }); }, true);
  /* ---------- Nada sale hacia WhatsApp, correo ni teléfono ---------- */
  const EXTERNO = /wa\.me|whatsapp\.com|^mailto:|^tel:/i;
  function avisoExterno() {
    const t = document.createElement('div');
    t.textContent = 'En la prueba no se abre WhatsApp ni el correo: en el CRM real aquí se abriría el chat con el cliente.';
    t.style.cssText = 'position:fixed;left:50%;top:40px;transform:translateX(-50%);z-index:99995;max-width:90vw;padding:10px 14px;border-radius:12px;background:#ffb020;color:#1a1200;font:600 13px system-ui,sans-serif;box-shadow:0 10px 30px -10px rgba(0,0,0,.6)';
    document.body.appendChild(t); setTimeout(() => t.remove(), 4200);
  }
  const abrir = window.open.bind(window);
  window.open = (url, ...r) => {
    if (/demo\.invalid/.test(String(url || ''))) return abrir(P.fotoLocal(String(url)), ...r);
    if (!EXTERNO.test(String(url || ''))) return abrir(url, ...r);
    avisoExterno();
    return { closed: false, close() {}, focus() {}, location: {} };
  };
  document.addEventListener('click', e => {
    if (e.target.closest('#prueba-panel,#prueba-modal')) return;
    const a = e.target.closest('a[href]');
    if (a && EXTERNO.test(a.getAttribute('href'))) { e.preventDefault(); avisoExterno(); return; }
    const sec = e.target.closest('[id^="sec-"]');
    if (sec) registra({ tipo: 'click', dentro: sec.id.slice(4), kpi: !!e.target.closest('canvas,.kpi,.pstep,#destConversion *'), fila: !!e.target.closest('.pc-dias') });
  }, true);
})();
