// Marketing > Contenido: marcas (Lotus + clientes) sobre perfiles de Zernio, vía EF marketing-zernio.
// Vive aparte de app.js (mismo patrón que ads-meta.js). Permisos y gasto se validan en la EF:
// ver marcas = admin/administrativo/marketing; crear y sacar link de conexión = admin/administrativo.
// Plan: ~/.claude/plans/plataforma-marketing-crm.md (F1, pestaña Marcas).
const CSS = `
.mk-lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.mk-marca{--mk:var(--accent);display:flex;flex-direction:column;gap:9px;border:1px solid var(--line2);border-left:4px solid var(--mk);border-radius:14px;padding:14px;background:var(--panel)}
.mk-marca[data-color=blue],.mk-color[data-color=blue]{--mk:var(--blue)}
.mk-marca[data-color=green],.mk-color[data-color=green]{--mk:var(--green)}
.mk-marca[data-color=amber],.mk-color[data-color=amber]{--mk:var(--amber)}
.mk-marca[data-color=purple],.mk-color[data-color=purple]{--mk:var(--purple)}
.mk-marca[data-color=pink],.mk-color[data-color=pink]{--mk:var(--pink)}
.mk-marca.off{opacity:.6}
.mk-cab{display:flex;align-items:flex-start;justify-content:space-between;gap:9px}
.mk-nom{font-size:14px;font-weight:800;line-height:1.3}
.mk-tag{flex:0 0 auto;font-size:10px;font-weight:800;padding:2px 9px;border-radius:999px;border:1px solid var(--line2);color:var(--muted)}
.mk-tag.bot{border-color:var(--accent-ink);color:var(--accent-ink);background:var(--accent-soft)}
.mk-notas{font-size:12px;color:var(--muted);white-space:pre-line}
.mk-cuentas{display:flex;flex-direction:column;gap:5px;font-size:12.5px}
.mk-cuenta{display:flex;align-items:center;gap:7px}
.mk-cuenta img,.mk-cuenta .mk-ini{flex:0 0 auto;width:26px;height:26px;border-radius:999px;object-fit:cover;background:var(--bg2);display:grid;place-items:center;font-size:11px;font-weight:800;color:var(--muted)}
.mk-cuenta small{color:var(--muted)}
.mk-est{font-size:12px;color:var(--muted)}
.mk-acc{display:flex;flex-wrap:wrap;gap:7px;margin-top:auto}
.mk-acc .btn-sm,.mk-form .btn-sm{min-height:44px}
.mk-link{display:flex;flex-direction:column;gap:5px;font-size:11.5px;color:var(--muted)}
.mk-link input{width:100%;min-height:38px}
.mk-form{border:1px solid var(--line2);border-radius:14px;padding:14px;margin:0 0 14px;background:var(--panel)}
.mk-form input,.mk-form textarea{width:100%}
.mk-colores{display:flex;flex-wrap:wrap;gap:7px}
.mk-color{--mk:var(--accent);width:44px;height:44px;border-radius:12px;border:2px solid transparent;background:color-mix(in srgb,var(--mk) 22%,transparent);cursor:pointer;display:grid;place-items:center}
.mk-color::after{content:'';width:18px;height:18px;border-radius:999px;background:var(--mk)}
.mk-color.on{border-color:var(--mk)}
.mk-color:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.mk-form-pie{display:flex;justify-content:flex-end;gap:7px;margin-top:14px}
.mk-vacio{padding:28px;text-align:center;color:var(--muted)}
`;
const COLORES = { accent: 'Lotus', blue: 'Azul', green: 'Verde', amber: 'Ámbar', purple: 'Morado', pink: 'Rosa' };
const PLATAFORMAS = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', whatsapp: 'WhatsApp' };
const ERRORES = {
  no_autorizado: 'Solo administración puede agregar marcas o sacar links de conexión.',
  nombre_invalido: 'Poné un nombre de hasta 80 letras.',
  marca_repetida: 'Ya hay una marca con ese nombre.',
  marca_lotus: 'Las cuentas de Lotus no se conectan desde acá.',
  marca_inactiva: 'La marca está desactivada.',
  zernio_no_responde: 'Zernio no respondió. Probá de nuevo en un minuto.',
};

export function crearMarketing({ sb, esc, ok, error, rol = 'admin', raiz }) {
  const oficina = rol === 'admin' || rol === 'administrativo';
  let marcas = [], errores = {}, formAbierto = false, colorNuevo = 'blue', ocupado = false, iniciado = false;
  const links = new Map();
  const $ = sel => raiz.querySelector(sel);
  const horaCaracas = iso => new Date(iso).toLocaleString('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const igActivo = m => (m.cuentas || []).some(c => c.plataforma === 'instagram' && c.activo);

  async function invocar(body) {
    const { data, error: e } = await sb.functions.invoke('marketing-zernio', { body });
    if (e) {
      let j = null;
      try { j = await e.context?.json?.(); } catch { /* sin cuerpo */ }
      throw new Error(ERRORES[j?.error] || j?.error || e.message);
    }
    if (!data?.ok) throw new Error(ERRORES[data?.error] || data?.error || 'Error desconocido');
    return data;
  }

  function css() {
    if (document.getElementById('mk-css')) return;
    const st = document.createElement('style'); st.id = 'mk-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  function marco() {
    raiz.innerHTML = `
      <div class="pvc-cab"><div><h2>Marcas</h2>
        <div class="ria-sub">Lotus y las marcas de clientes a las que les manejamos las redes. Cada cliente conecta su Instagram con su propio login desde el link de conexión; cada cuenta conectada cuesta USD 3 al mes.</div></div>
        <div class="mk-acc">
          <button class="btn-sm" type="button" data-mk="recargar">Recargar</button>
          ${oficina ? '<button class="btn-sm lt-primario" type="button" data-mk="nueva">Agregar marca</button>' : ''}
        </div></div>
      <div id="mk-form"></div>
      <div id="mk-cuerpo"><div class="mk-vacio">Cargando…</div></div>`;
    raiz.addEventListener('click', clic);
    raiz.addEventListener('submit', e => { if (e.target.id === 'mk-nueva') { e.preventDefault(); crear(e.target); } });
  }

  function pintarForm() {
    $('#mk-form').innerHTML = !formAbierto ? '' : `
      <form class="mk-form" id="mk-nueva">
        <label class="fl" for="mk-nombre">Nombre de la marca</label>
        <input class="ei" id="mk-nombre" name="nombre" maxlength="80" required autocomplete="off">
        <span class="fl" id="mk-color-l">Color en el calendario</span>
        <div class="mk-colores" role="radiogroup" aria-labelledby="mk-color-l">${Object.entries(COLORES).map(([c, t]) =>
          `<button class="mk-color${c === colorNuevo ? ' on' : ''}" type="button" role="radio" aria-checked="${c === colorNuevo}" aria-label="${t}" title="${t}" data-color="${c}" data-mk="color"></button>`).join('')}</div>
        <label class="fl" for="mk-notas">Condición comercial (opcional)</label>
        <textarea class="ei" id="mk-notas" name="notas" rows="2" maxlength="500" placeholder="Ej.: 4 posts por semana, responde comentarios, USD 80/mes"></textarea>
        <div class="mk-form-pie">
          <button class="btn-sm" type="button" data-mk="cancelar">Cancelar</button>
          <button class="btn-sm lt-primario" type="submit">Crear marca</button>
        </div>
      </form>`;
    if (formAbierto) $('#mk-nombre').focus();
  }

  function cuentas(m) {
    if (m.cuentas === null) return `<div class="mk-est">Zernio no respondió (${esc(String(errores[m.id] || 'error'))}). Recargá en un minuto.</div>`;
    if (!m.zernio_perfil_id) return '<div class="mk-est">Todavía sin perfil en Zernio: se crea al sacar el link de conexión.</div>';
    if (!m.cuentas.length) return '<div class="mk-est">Sin cuentas conectadas.</div>';
    return `<div class="mk-cuentas">${m.cuentas.map(c => `<div class="mk-cuenta">
      ${c.foto ? `<img src="${esc(c.foto)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="mk-ini">${esc((c.usuario || '?').slice(0, 1).toUpperCase())}</span>`}
      <span>@${esc(c.usuario || c.id)} <small>· ${esc(PLATAFORMAS[c.plataforma] || c.plataforma)}${c.activo ? '' : ' · desconectada'}</small></span></div>`).join('')}</div>`;
  }

  function link(m) {
    const l = links.get(m.id);
    if (!l) return '';
    return `<div class="mk-link"><span>Link para ${esc(m.nombre)} · vence ${esc(horaCaracas(l.vence))} (hora de Caracas)</span>
      <input class="ei" type="text" readonly value="${esc(l.url)}" aria-label="Link de conexión de ${esc(m.nombre)}"></div>`;
  }

  function tarjeta(m) {
    const color = COLORES[m.color] ? m.color : 'accent';
    const conectable = oficina && !m.es_lotus && m.activa && !igActivo(m);
    const tag = m.es_lotus ? '<span class="mk-tag bot">Lo atiende el bot</span>' : !m.activa ? '<span class="mk-tag">Desactivada</span>' : igActivo(m) ? '<span class="mk-tag">Instagram conectado</span>' : '';
    return `<article class="mk-marca${m.activa ? '' : ' off'}" data-color="${color}">
      <div class="mk-cab"><div class="mk-nom">${esc(m.nombre)}</div>${tag}</div>
      ${m.notas ? `<div class="mk-notas">${esc(m.notas)}</div>` : ''}
      ${cuentas(m)}
      ${link(m)}
      ${conectable ? `<div class="mk-acc"><button class="btn-sm" type="button" data-mk="conectar" data-marca="${m.id}">${links.has(m.id) ? 'Copiar otro link' : 'Link de conexión'}</button></div>` : ''}
    </article>`;
  }

  function pintar() {
    $('#mk-cuerpo').innerHTML = marcas.length
      ? `<div class="mk-lista">${marcas.map(tarjeta).join('')}</div>`
      : '<div class="mk-vacio">No hay marcas cargadas.</div>';
  }

  async function cargar() {
    css();
    if (!iniciado) { marco(); iniciado = true; }
    try {
      const d = await invocar({ accion: 'marcas' });
      marcas = d.marcas || []; errores = d.errores || {};
      pintar();
    } catch (e) {
      $('#mk-cuerpo').innerHTML = `<div class="mk-vacio">${esc(e.message)}</div>`;
    }
  }

  async function crear(form) {
    if (ocupado) return;
    ocupado = true;
    const boton = form.querySelector('[type=submit]'); boton.disabled = true;
    try {
      const d = await invocar({ accion: 'marca_crear', nombre: form.nombre.value, color: colorNuevo, notas: form.notas.value });
      ok(`Marca «${d.marca.nombre}» creada`);
      formAbierto = false; pintarForm();
      await cargar();
    } catch (e) {
      error(e.message);
      boton.disabled = false;
    } finally { ocupado = false; }
  }

  async function conectar(boton) {
    if (ocupado) return;
    const m = marcas.find(x => String(x.id) === boton.dataset.marca);
    if (!m) return;
    ocupado = true; boton.disabled = true;
    try {
      const d = await invocar({ accion: 'conectar', marca_id: m.id });
      links.set(m.id, { url: d.authUrl, vence: d.vence });
      if (!m.zernio_perfil_id) m.zernio_perfil_id = d.perfil;
      const texto = `Hola, para que podamos publicar en el Instagram de ${m.nombre}, abrí este link e iniciá sesión con tu Instagram. Vence el ${horaCaracas(d.vence)} (hora de Caracas):\n${d.authUrl}`;
      try { await navigator.clipboard.writeText(texto); ok('Link copiado: pegalo en el WhatsApp del cliente'); }
      catch { ok('Link listo: copialo de la tarjeta'); }
      pintar();
    } catch (e) {
      error(e.message);
      boton.disabled = false;
    } finally { ocupado = false; }
  }

  function clic(e) {
    const b = e.target.closest('[data-mk]');
    if (!b) return;
    const acc = b.dataset.mk;
    if (acc === 'recargar') { $('#mk-cuerpo').innerHTML = '<div class="mk-vacio">Cargando…</div>'; cargar(); }
    if (acc === 'nueva') { formAbierto = true; pintarForm(); }
    if (acc === 'cancelar') { formAbierto = false; pintarForm(); }
    if (acc === 'color') {
      colorNuevo = b.dataset.color;
      raiz.querySelectorAll('.mk-color').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
    }
    if (acc === 'conectar') conectar(b);
  }

  return { cargar };
}
