// Bandeja "Alianzas y propuestas": quienes escribieron al bot de ventas sin ser
// clientes (alianza, proveedor, prensa, spam). Los escribe la IA vía
// _shared/contactos-no-cliente.ts; acá el admin los revisa y los marca. Solo
// reutiliza clases que ya existen (ia-card, ce-*, seg): sin CSS nuevo.
const CATEGORIAS = {
  alianza: { etiqueta: 'Alianza', icono: 'handshake' },
  proveedor: { etiqueta: 'Proveedor', icono: 'truck-field' },
  prensa: { etiqueta: 'Prensa', icono: 'newspaper' },
  spam: { etiqueta: 'Spam', icono: 'ban' },
};
const ESTADOS = { nuevo: 'Nuevo', visto: 'Visto', descartado: 'Descartado' };
const CANALES = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', whatsapp: 'WhatsApp', web: 'Web' };
const ICONOS_CANAL = { instagram: 'fab fa-instagram', facebook: 'fab fa-facebook', tiktok: 'fab fa-tiktok', whatsapp: 'fab fa-whatsapp' };

const RE_EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
const RE_URL = /https?:\/\/[^\s,)]+/i;
const RE_DOMINIO = /\b((?:[a-z0-9-]+\.)+(?:com|net|org|co|ve|pe|mx|ar|cl|es|io|app|travel|tours|info|biz)(?:\.[a-z]{2})?)\b/i;
const RE_ARROBA = /(?:^|[\s(,])@([\w.]{2,30})/;

// Números locales venezolanos ("0424 ...") van sin código de país: wa.me necesita el +58.
function digitosWa(texto) {
  let d = String(texto || '').replace(/\D/g, '');
  if (/^0\d{10}$/.test(d)) d = '58' + d.slice(1);
  return d.length >= 8 && d.length <= 15 ? d : '';
}
const iconoCanal = c => ICONOS_CANAL[String(c || '').toLowerCase()] || 'comments';
function iconoContacto(t) {
  if (RE_EMAIL.test(t)) return 'envelope';
  if (/whats/i.test(t)) return 'fab fa-whatsapp';
  if (digitosWa(t)) return 'phone';
  return 'address-book';
}
function urlWeb(t) {
  const u = String(t || '').match(RE_URL);
  if (u) return u[0];
  const d = String(t || '').match(RE_DOMINIO);
  if (d && !RE_EMAIL.test(t)) return 'https://' + d[1];
  const a = String(t || '').match(RE_ARROBA);
  return a ? 'https://instagram.com/' + a[1] : '';
}
function urlContacto(t) {
  const e = String(t || '').match(RE_EMAIL);
  if (e) return 'mailto:' + e[0];
  const w = urlWeb(t);
  if (w) return w;
  const d = digitosWa(t);
  return d ? 'https://wa.me/' + d : '';
}
function urlCanal(f) {
  const canal = String(f.canal || '').toLowerCase();
  const perfil = String(f.perfil || '').trim().replace(/^@/, '');
  const usuario = /^[\w.]{1,30}$/.test(perfil) ? perfil : '';
  if (canal === 'whatsapp') { const d = digitosWa(f.id_externo); return d ? 'https://wa.me/' + d : ''; }
  if (canal === 'instagram' && usuario) return 'https://instagram.com/' + usuario;
  if (canal === 'tiktok' && usuario) return 'https://www.tiktok.com/@' + usuario;
  return '';
}

export function crearPropuestas({ sb, esc, fecha, ok, error }) {
  let filas = [];
  let filtroEstado = 'nuevo';
  let filtroCategoria = 'util';

  const lista = () => document.getElementById('pr-lista');

  function visibles() {
    return filas.filter(f => {
      if (filtroEstado !== 'todos' && f.estado !== filtroEstado) return false;
      if (filtroCategoria === 'util') return f.categoria !== 'spam';
      return filtroCategoria === 'todas' || f.categoria === filtroCategoria;
    });
  }

  function chip(icono, texto, url) {
    const ico = icono.startsWith('fab ') ? icono : `fas fa-${icono}`;
    const dentro = `<i class="${ico}"></i> ${esc(texto)}`;
    return url
      ? `<a class="ia-dato" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Abrir">${dentro}</a>`
      : `<span class="ia-dato">${dentro}</span>`;
  }

  function tarjeta(f) {
    const cat = CATEGORIAS[f.categoria] || { etiqueta: f.categoria, icono: 'circle-question' };
    const nombre = f.nombre || f.perfil || 'Sin nombre';
    const canal = CANALES[String(f.canal || '').toLowerCase()] || f.canal || '';
    const datos = [
      f.empresa && chip('building', f.empresa, urlWeb(f.empresa)),
      f.contacto && chip(iconoContacto(f.contacto), f.contacto, urlContacto(f.contacto)),
      canal && chip(iconoCanal(f.canal), canal, urlCanal(f)),
      `<span class="ia-dato"><i class="fas fa-flag"></i> ${esc(ESTADOS[f.estado] || f.estado)}</span>`,
    ].filter(Boolean).join('');
    const cuerpo = [
      f.propuesta && `<b>Propone:</b> ${esc(f.propuesta)}`,
      f.resumen && `<b>Primer mensaje:</b> ${esc(f.resumen)}`,
    ].filter(Boolean).join('<br>');
    const acciones = f.estado === 'nuevo'
      ? `<button class="ce-mini on" data-pr-estado="visto" data-pr-id="${f.id}">Marcar visto</button>
         <button class="ce-mini" data-pr-estado="descartado" data-pr-id="${f.id}">Descartar</button>`
      : `<button class="ce-mini" data-pr-estado="nuevo" data-pr-id="${f.id}">Volver a nuevo</button>`;
    return `<div class="ia-card">
      <div class="ia-top">
        <div class="ia-nom">${esc(nombre)}</div>
        <div class="ia-fecha">${esc(fecha(f.created_at))}</div>
      </div>
      <span class="ia-plan ${f.categoria === 'spam' ? 'basico' : 'full'}"><i class="fas fa-${cat.icono}"></i> ${esc(cat.etiqueta)}</span>
      <div class="ia-datos">${datos}</div>
      ${cuerpo ? `<div class="ia-cfg">${cuerpo}</div>` : ''}
      <div class="ce-pie">
        <span class="ce-vig">${f.cierre_enviado
          ? '<i class="fas fa-circle-check" style="color:#86efac"></i> La IA cerró la conversación'
          : '<i class="fas fa-hourglass-half"></i> Conversación sin cerrar'}</span>
        <span class="ce-acc">${acciones}</span>
      </div>
    </div>`;
  }

  function pintar() {
    const cont = lista();
    if (!cont) return;
    const vis = visibles();
    const conteo = document.getElementById('pr-conteo');
    if (conteo) conteo.textContent = vis.length ? `${vis.length} ${vis.length === 1 ? 'contacto' : 'contactos'}` : '';
    cont.innerHTML = vis.length
      ? vis.map(tarjeta).join('')
      : `<div class="vig-vacio"><i class="fas fa-handshake"></i><b>Nada por acá</b>
          <div style="font-size:12.5px;margin-top:6px">Cuando alguien escriba al bot buscando una alianza o para ofrecer un servicio, aparece en esta lista.</div></div>`;
  }

  async function cargar() {
    const cont = lista();
    const { data, error: err } = await sb.from('contactos_no_cliente')
      .select('*').order('created_at', { ascending: false }).limit(300);
    if (err) {
      if (cont) cont.innerHTML = `<div class="vig-vacio">No se pudo cargar: ${esc(err.message || '')}</div>`;
      return;
    }
    filas = data || [];
    pintar();
  }

  async function cambiarEstado(id, estado) {
    const { error: err } = await sb.from('contactos_no_cliente')
      .update({ estado, updated_at: new Date().toISOString() }).eq('id', id);
    if (err) return error('No se pudo actualizar: ' + (err.message || ''));
    const f = filas.find(x => String(x.id) === String(id));
    if (f) f.estado = estado;
    ok(estado === 'visto' ? 'Marcado como visto' : estado === 'descartado' ? 'Descartado' : 'Vuelve a nuevo');
    pintar();
  }

  function marcarSeg(grupoId, attr, valor) {
    document.querySelectorAll(`#${grupoId} [${attr}]`).forEach(b => b.classList.toggle('on', b.getAttribute(attr) === valor));
  }

  function enlazar() {
    document.getElementById('pr-recargar')?.addEventListener('click', cargar);
    document.getElementById('pr-estados')?.addEventListener('click', e => {
      const b = e.target.closest('[data-pr-filtro-estado]');
      if (!b) return;
      filtroEstado = b.dataset.prFiltroEstado;
      marcarSeg('pr-estados', 'data-pr-filtro-estado', filtroEstado);
      pintar();
    });
    document.getElementById('pr-categorias')?.addEventListener('click', e => {
      const b = e.target.closest('[data-pr-filtro-cat]');
      if (!b) return;
      filtroCategoria = b.dataset.prFiltroCat;
      marcarSeg('pr-categorias', 'data-pr-filtro-cat', filtroCategoria);
      pintar();
    });
    lista()?.addEventListener('click', e => {
      const b = e.target.closest('[data-pr-estado]');
      if (b) cambiarEstado(b.dataset.prId, b.dataset.prEstado);
    });
  }

  return { cargar, enlazar };
}
