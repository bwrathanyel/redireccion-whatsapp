// Métodos de pago de la agencia (2026-11-10): los asesores copian un dato, el texto de un método
// o una foto (tarjeta o flyer completo) para mandar al cliente. Datos en la tabla metodos_pago
// (todos leen, solo admin edita). Las imágenes se dibujan desde los datos: nunca quedan desfasadas.
// Plan: ~/.claude/plans/c-users-user-downloads-informaci-n-de-p-memoized-thimble.md
const CSS = `
.mp-top{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
.mp-region{display:flex;align-items:center;gap:12px;margin:18px 0 10px;font-size:11px;font-weight:800;letter-spacing:.18em;color:var(--muted)}
.mp-region::after{content:'';flex:1;height:1px;background:var(--line2)}
.mp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px}
.mp-card{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border:1px solid var(--line2);border-radius:14px;background:var(--panel)}
.mp-card.sel{border-color:var(--accent-ink);box-shadow:0 0 0 1px var(--accent-ink) inset}
.mp-card.off{opacity:.5}
.mp-cab{display:flex;align-items:center;gap:8px}
.mp-cab h3{flex:1;margin:0;font-size:15px;font-weight:800}
.mp-cab input{width:18px;height:18px;accent-color:var(--accent);cursor:pointer}
.mp-nota{font-size:12px;color:var(--muted);margin:-4px 0 0}
.mp-campos{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.mp-dato{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0;padding:7px 9px;border:1px solid var(--line);border-radius:9px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.mp-dato.ancho{grid-column:1/-1}
.mp-dato:hover{border-color:var(--accent-ink)}
.mp-dato small{display:flex;gap:6px;width:100%;font-size:10.5px;color:var(--muted)}
.mp-dato small i{margin-left:auto;opacity:.6}
.mp-dato span{font-size:13.5px;font-weight:700;white-space:pre-line;overflow-wrap:anywhere;user-select:all}
.mp-aviso{padding:9px 11px;border:1px dashed var(--line2);border-radius:9px;font-size:12px;color:var(--muted);white-space:pre-line}
.mp-aviso b{display:block;font-size:10.5px;letter-spacing:.14em;color:var(--accent-ink);margin-bottom:3px}
.mp-acc{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto}
.mp-acc .btn-sm{flex:1 1 auto;justify-content:center}
.mp-barra{position:sticky;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:14px;padding:10px 12px;border:1px solid var(--accent-ink);border-radius:12px;background:var(--panel-solid);box-shadow:0 8px 24px rgba(0,0,0,.25)}
.mp-barra>span{flex:1 1 100%;font-size:12px;font-weight:700}
.mp-vacio{padding:24px 0;text-align:center;color:var(--muted);font-size:13px}
#mp-sheet-root .mp-grid{grid-template-columns:1fr}
#mp-sheet-root{max-height:70vh;overflow:auto;padding-bottom:6px}
@media (max-width:420px){.mp-campos{grid-template-columns:1fr}}
`;
const REGIONES = [['venezuela', 'Venezuela'], ['internacional', 'Internacional']];
const ASUNTO = 'Destino y Eventos Lotus 360';
const HANDLE = '@destinoyeventoslotus360';
const C = { fondo: '#0b1431', tarjeta: '#111c40', borde: 'rgba(255,255,255,.09)', oro: '#d4b46c', blanco: '#f4f1ea', gris: '#8f9ab8' };
const SERIF = '"Cormorant Garamond", Georgia, serif', SANS = 'Inter, "Segoe UI", Arial, sans-serif';

const tactil = () => matchMedia('(pointer: coarse)').matches;
const campos = m => Array.isArray(m.campos) ? m.campos.filter(c => c && String(c.valor || '').trim()) : [];

// Texto con formato de WhatsApp (*negrita*, _cursiva_).
function textoMetodo(m) {
  const l = [`*${m.titulo}*`];
  if (m.nota) l.push(`_${m.nota}_`);
  for (const c of campos(m)) l.push(String(c.valor).includes('\n') ? `${c.etiqueta}:\n${c.valor}` : `${c.etiqueta}: ${c.valor}`);
  if (m.aviso) l.push('', '*IMPORTANTE*', ...m.aviso.split('\n').filter(s => s.trim()).map(s => `• ${s.trim()}`));
  return l.join('\n');
}
function textoVarios(lista, todo) {
  const bloques = [];
  if (todo) bloques.push(`*Métodos de pago · ${ASUNTO}*`);
  for (const [r, nombre] of REGIONES) {
    const de = lista.filter(m => m.region === r);
    if (!de.length) continue;
    if (todo) bloques.push(`— ${nombre.toUpperCase()} —`);
    bloques.push(...de.map(textoMetodo));
  }
  bloques.push(`*Favor colocar en asunto:* ${ASUNTO}`);
  return bloques.join('\n\n');
}

// ---------- Imagen (canvas) ----------
let fuentes = null, logo = null;
function prepararImagen() {
  if (!document.getElementById('mp-fuente')) {
    const k = document.createElement('link'); k.id = 'mp-fuente'; k.rel = 'stylesheet';
    k.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,500&display=swap';
    document.head.appendChild(k);
  }
  fuentes ||= Promise.race([
    Promise.all(['600 40px "Cormorant Garamond"', 'italic 500 24px "Cormorant Garamond"', '400 20px Inter', '600 28px Inter', '800 18px Inter'].map(f => document.fonts.load(f))),
    new Promise(r => setTimeout(r, 2500)),
  ]).catch(() => {});
  logo ||= new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'logolotus-integrado.png'; });
  return Promise.all([fuentes, logo]);
}
function partir(ctx, texto, ancho) {
  const out = [];
  for (const par of String(texto).split('\n')) {
    let linea = '';
    for (const p of par.split(/\s+/).filter(Boolean)) {
      const prueba = linea ? linea + ' ' + p : p;
      if (linea && ctx.measureText(prueba).width > ancho) { out.push(linea); linea = p; } else linea = prueba;
    }
    out.push(linea);
  }
  return out;
}
function caja(ctx, x, y, w, h, r, relleno, borde) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
  if (borde) { ctx.strokeStyle = borde; ctx.lineWidth = 2; ctx.stroke(); }
}
// El PNG del logo trae fondo cuadrado: se recorta en círculo para que no se vea el borde.
function redondo(ctx, img, x, y, d) { ctx.save(); ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, x, y, d, d); ctx.restore(); }
const W = 1080, PAD = 60, CW = W - PAD * 2, IN = 40;

// Dibuja (o solo mide, con dibujar=false) una tarjeta de método; devuelve su alto.
function tarjeta(ctx, m, y, dibujar) {
  const iw = CW - IN * 2, gap = 28, col = (iw - gap) / 2;
  let h = IN;
  const ops = [];
  ctx.font = `600 44px ${SERIF}`;
  ops.push([h, () => { ctx.fillStyle = C.oro; ctx.font = `600 44px ${SERIF}`; ctx.fillText(m.titulo, PAD + IN, y + IN + 40); }]);
  h += 68;
  if (m.nota) {
    ctx.font = `400 22px ${SANS}`;
    const ls = partir(ctx, m.nota, iw), y0 = h;
    ops.push([h, () => { ctx.fillStyle = C.gris; ctx.font = `400 22px ${SANS}`; ls.forEach((t, i) => ctx.fillText(t, PAD + IN, y + y0 + 24 + i * 31)); }]);
    h += ls.length * 31 + 14;
  }
  // Datos en dos columnas; los largos o de varias líneas ocupan el ancho completo.
  ctx.font = `600 29px ${SANS}`;
  const items = campos(m).map(c => {
    const largo = String(c.valor).includes('\n') || ctx.measureText(c.valor).width > col;
    return { c, largo, ls: partir(ctx, c.valor, largo ? iw : col) };
  });
  const filas = [];
  for (let i = 0; i < items.length; i++) {
    const a = items[i], b = items[i + 1];
    if (!a.largo && b && !b.largo) { filas.push([a, b]); i++; } else filas.push([a]);
  }
  for (const fila of filas) {
    const y0 = h, alto = Math.max(...fila.map(it => 30 + it.ls.length * 38));
    fila.forEach((it, k) => ops.push([y0, () => {
      const x = PAD + IN + k * (col + gap);
      ctx.fillStyle = C.gris; ctx.font = `400 19px ${SANS}`; ctx.fillText(it.c.etiqueta, x, y + y0 + 20);
      ctx.fillStyle = C.blanco; ctx.font = `600 29px ${SANS}`;
      it.ls.forEach((t, i) => ctx.fillText(t, x, y + y0 + 56 + i * 38));
    }]));
    h += alto + 22;
  }
  if (m.aviso) {
    ctx.font = `400 21px ${SANS}`;
    const pts = m.aviso.split('\n').filter(s => s.trim()).map(s => partir(ctx, s.trim(), iw - 80));
    const y0 = h + 6, alto = 70 + pts.reduce((n, ls) => n + ls.length * 30 + 12, 0);
    ops.push([y0, () => {
      caja(ctx, PAD + IN, y + y0, iw, alto, 14, null, 'rgba(212,180,108,.55)');
      ctx.fillStyle = C.oro; ctx.font = `800 17px ${SANS}`; ctx.fillText('I M P O R T A N T E', PAD + IN + 26, y + y0 + 40);
      ctx.fillStyle = '#d6dae6'; ctx.font = `400 21px ${SANS}`;
      let yy = y + y0 + 76;
      for (const ls of pts) { ctx.fillText('–', PAD + IN + 26, yy); ls.forEach((t, i) => ctx.fillText(t, PAD + IN + 54, yy + i * 30)); yy += ls.length * 30 + 12; }
    }]);
    h += alto + 22;
  }
  h += IN - 22 + (filas.length || m.aviso ? 0 : 22);
  if (dibujar) { caja(ctx, PAD, y, CW, h, 22, C.tarjeta, C.borde); ops.forEach(([, f]) => f()); }
  return h;
}

function componer(ctx, lista, { completo }, dibujar, img) {
  let y = PAD;
  if (dibujar) { ctx.fillStyle = C.fondo; ctx.fillRect(0, 0, W, ctx.canvas.height); ctx.textBaseline = 'alphabetic'; }
  const texto = (t, f, color, x, yy, alin = 'left') => { if (!dibujar) return; ctx.font = f; ctx.fillStyle = color; ctx.textAlign = alin; ctx.fillText(t, x, yy); ctx.textAlign = 'left'; };
  if (completo) {
    if (dibujar && img) redondo(ctx, img, PAD, y, 120);
    texto('Más que destinos,', `italic 500 26px ${SERIF}`, C.gris, W - PAD, y + 40, 'right');
    texto('creamos experiencias', `italic 500 26px ${SERIF}`, C.gris, W - PAD, y + 72, 'right');
    y += 170;
    texto('D E S T I N O   Y   E V E N T O S   L O T U S   3 6 0', `600 17px ${SANS}`, C.oro, PAD, y);
    texto('Métodos de pago', `600 84px ${SERIF}`, C.blanco, PAD, y + 92);
    y += 140;
  } else {
    if (dibujar && img) redondo(ctx, img, PAD, y, 84);
    texto('Destino y Eventos Lotus 360', `600 38px ${SERIF}`, C.blanco, PAD + 104, y + 40);
    texto('M É T O D O S   D E   P A G O', `600 16px ${SANS}`, C.oro, PAD + 104, y + 74);
    y += 124;
  }
  for (const [r, nombre] of REGIONES) {
    const de = lista.filter(m => m.region === r);
    if (!de.length) continue;
    if (completo) {
      y += 14;
      if (dibujar) {
        ctx.font = `800 17px ${SANS}`; ctx.fillStyle = C.blanco;
        const t = nombre.toUpperCase().split('').join(' ');
        ctx.fillText(t, PAD, y + 18);
        const wt = ctx.measureText(t).width;
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(PAD + wt + 22, y + 11, CW - wt - 22, 2);
      }
      y += 44;
    }
    for (const m of de) y += tarjeta(ctx, m, y, dibujar) + 22;
  }
  // Pie con el asunto (va siempre: aplica a cualquier método).
  const alto = completo ? 190 : 120;
  if (dibujar) {
    caja(ctx, PAD, y + 8, CW, alto, 22, null, 'rgba(212,180,108,.6)');
    ctx.font = `800 17px ${SANS}`; ctx.fillStyle = C.oro; ctx.fillText('F A V O R   C O L O C A R   E N   A S U N T O', PAD + IN, y + 8 + 44);
    ctx.font = `600 ${completo ? 52 : 40}px ${SERIF}`; ctx.fillStyle = C.blanco; ctx.fillText(ASUNTO, PAD + IN, y + 8 + (completo ? 112 : 94));
    if (completo) { ctx.font = `400 20px ${SANS}`; ctx.fillStyle = C.gris; ctx.fillText('Para cualquiera de las formas de pago', PAD + IN, y + 8 + 152); }
  }
  y += alto + 8 + 44;
  texto(completo ? 'T U   P R Ó X I M A   A V E N T U R A   C O M I E N Z A   A Q U Í' : '', `600 15px ${SANS}`, C.gris, PAD, y);
  texto(HANDLE, `600 22px ${SANS}`, C.blanco, W - PAD, y, 'right');
  return y + PAD - 10;
}

async function imagen(lista, opts) {
  const [, img] = await prepararImagen();
  const medir = document.createElement('canvas').getContext('2d');
  const h = Math.ceil(componer(medir, lista, opts, false, img));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = h;
  componer(cv.getContext('2d'), lista, opts, true, img);
  return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('sin_imagen')), 'image/png'));
}

export function crearMetodosPago({ sb, esc, ok, error, confirmar, rol, raiz, hoja, abrirSheet, cerrarSheet, toastCompartir, descargar }) {
  const admin = rol === 'admin';
  let lista = [], cargado = false, pedido = null;
  const sel = new Set();
  let ctxHoja = {};

  function css() {
    if (document.getElementById('mp-css')) return;
    const st = document.createElement('style'); st.id = 'mp-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const visibles = () => lista.filter(m => m.activo);
  const porId = id => lista.find(m => String(m.id) === String(id));
  const elegidos = () => visibles().filter(m => sel.has(String(m.id)));

  async function traer(forzar) {
    if (cargado && !forzar) return true;
    pedido ||= sb.from('metodos_pago').select('*').order('orden').order('titulo');
    const { data, error: e } = await pedido;
    pedido = null;
    if (e) { error('No se pudieron cargar los métodos de pago'); return false; }
    lista = data || []; cargado = true;
    return true;
  }

  function tarjetaHtml(m, enHoja) {
    const id = esc(m.id), marcado = sel.has(String(m.id));
    const datos = campos(m).map((c, i) => `<button class="mp-dato${String(c.valor).length > 24 || String(c.valor).includes('\n') ? ' ancho' : ''}" type="button" data-mp="dato" data-id="${id}" data-i="${i}" title="Copiar ${esc(c.etiqueta)}">
      <small>${esc(c.etiqueta)}<i class="far fa-copy"></i></small><span>${esc(c.valor)}</span></button>`).join('');
    return `<article class="mp-card${marcado ? ' sel' : ''}${m.activo ? '' : ' off'}" data-id="${id}">
      <div class="mp-cab">${m.activo ? `<input type="checkbox" data-mp="sel" data-id="${id}" aria-label="Elegir ${esc(m.titulo)}"${marcado ? ' checked' : ''}>` : ''}
        <h3>${esc(m.titulo)}${m.activo ? '' : ' <small>(oculto)</small>'}</h3>
        ${admin && !enHoja ? `<button class="btn-sm" type="button" data-mp="editar" data-id="${id}" aria-label="Editar ${esc(m.titulo)}" title="Editar"><i class="fas fa-pen"></i></button>` : ''}</div>
      ${m.nota ? `<p class="mp-nota">${esc(m.nota)}</p>` : ''}
      ${datos ? `<div class="mp-campos">${datos}</div>` : ''}
      ${m.aviso ? `<div class="mp-aviso"><b>IMPORTANTE</b>${esc(m.aviso)}</div>` : ''}
      ${m.activo ? `<div class="mp-acc">${acciones(`data-id="${id}"`, enHoja)}</div>` : ''}</article>`;
  }
  // Mismos tres botones para una tarjeta, la selección y "todo".
  function acciones(attr, enHoja) {
    const insertar = enHoja && ctxHoja.insertar;
    const ins = insertar ? `<button class="btn-sm lt-primario" type="button" data-mp="insertar" ${attr}><i class="fas fa-arrow-turn-down"></i> Poner en el chat</button>` : '';
    return `${ins}<button class="btn-sm" type="button" data-mp="texto" ${attr}><i class="far fa-copy"></i> Copiar texto</button>
      <button class="btn-sm" type="button" data-mp="foto" ${attr}><i class="far fa-image"></i> ${tactil() ? 'Enviar foto' : 'Copiar foto'}</button>
      ${insertar ? '' : `<button class="btn-sm" type="button" data-mp="enviar" ${attr}><i class="fa-brands fa-whatsapp"></i> Enviar</button>`}`;
  }

  function pintar(cont, enHoja) {
    const ver = admin && !enHoja ? lista : visibles();
    const top = `<div class="mp-top">
      <button class="btn-sm lt-primario" type="button" data-mp="flyer"><i class="far fa-image"></i> ${tactil() ? 'Enviar flyer completo' : 'Copiar flyer completo'}</button>
      <button class="btn-sm" type="button" data-mp="texto" data-todo="1"><i class="far fa-copy"></i> Copiar todo en texto</button>
      ${enHoja ? '' : `<button class="btn-sm" type="button" data-mp="descargar"><i class="fas fa-download"></i> Descargar flyer</button>`}
      ${admin && !enHoja ? '<button class="btn-sm" type="button" data-mp="nuevo"><i class="fas fa-plus"></i> Agregar método</button>' : ''}</div>`;
    const cuerpo = REGIONES.map(([r, nombre]) => {
      const de = ver.filter(m => m.region === r);
      return de.length ? `<div class="mp-region">${nombre.toUpperCase()}</div><div class="mp-grid">${de.map(m => tarjetaHtml(m, enHoja)).join('')}</div>` : '';
    }).join('');
    const n = elegidos().length;
    const barra = n ? `<div class="mp-barra"><span>${n} método${n > 1 ? 's' : ''} elegido${n > 1 ? 's' : ''}: se envían juntos</span>${acciones('data-sel="1"', enHoja)}<button class="btn-sm" type="button" data-mp="limpiar">Quitar selección</button></div>` : '';
    cont.innerHTML = (enHoja ? '' : `<div class="pvc-cab"><div><h2>Métodos de pago</h2><div class="ria-sub">Toca un dato para copiarlo solo. Marca varios métodos para mandarlos juntos en un mensaje o una foto.</div></div></div>`)
      + top + (cuerpo || '<div class="mp-vacio">No hay métodos de pago cargados.</div>') + barra;
  }
  const repintar = () => {
    if (raiz?.isConnected && cargado) pintar(raiz, false);
    if (hoja?.closest('.open')) pintar(hoja, true);
  };

  // Qué métodos toca un botón: el suyo, los elegidos o todos.
  function objetivo(b) {
    if (b.dataset.todo) return { ms: visibles(), todo: true };
    if (b.dataset.sel) return { ms: elegidos(), todo: false };
    const m = porId(b.dataset.id);
    return { ms: m ? [m] : [], todo: false };
  }
  const nombreImg = (ms, todo) => todo || ms.length > 2 ? 'Metodos-de-pago-Lotus360.png'
    : `Pago-${ms.map(m => m.titulo).join('-').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)}.png`;

  async function copiar(t, msg) {
    try { await navigator.clipboard.writeText(t); ok(msg); } catch { error('El navegador no dejó copiar'); }
  }
  // Celular: hoja de compartir con el archivo (WhatsApp aparece ahí). PC: la foto queda copiada para pegar.
  async function foto(ms, todo) {
    if (!ms.length) return;
    const completo = todo, nombre = nombreImg(ms, todo);
    if (tactil()) {
      let blob; try { blob = await imagen(ms, { completo }); } catch { error('No se pudo armar la imagen'); return; }
      const file = new File([blob], nombre, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file] }); return; } catch (e) {
          if (e.name === 'AbortError') return;
          if (e.name === 'NotAllowedError') { toastCompartir(file); return; }
        }
      }
      descargar(blob, nombre); ok('Se descargó la imagen');
      return;
    }
    const prom = imagen(ms, { completo });
    try {
      // La promesa va directo al ClipboardItem: Safari exige escribir dentro del mismo clic.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': prom })]);
      ok('Foto copiada: en el chat pégala con Ctrl+V');
    } catch {
      try { descargar(await prom, nombre); ok('No se pudo copiar: se descargó la imagen'); } catch { error('No se pudo armar la imagen'); }
    }
  }
  async function enviar(ms, todo, enHoja) {
    if (!ms.length) return;
    const t = textoVarios(ms, todo), tel = enHoja ? ctxHoja.telefono : '';
    if (tactil() && navigator.share && !tel) { try { await navigator.share({ text: t }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const w = window.open(`https://wa.me/${tel || ''}?text=${encodeURIComponent(t)}`, '_blank');
    if (w) w.opener = null;
  }

  async function clic(e, enHoja) {
    const b = e.target.closest('[data-mp]');
    if (!b) return;
    const a = b.dataset.mp;
    if (a === 'sel') { const id = b.dataset.id; b.checked ? sel.add(id) : sel.delete(id); repintar(); return; }
    if (a === 'limpiar') { sel.clear(); repintar(); return; }
    if (a === 'dato') {
      const c = campos(porId(b.dataset.id) || {})[Number(b.dataset.i)];
      if (c) copiar(String(c.valor), `${c.etiqueta} copiado`);
      return;
    }
    if (a === 'editar') return editar(porId(b.dataset.id));
    if (a === 'nuevo') return editar(null);
    if (a === 'flyer') return foto(visibles(), true);
    if (a === 'descargar') { try { descargar(await imagen(visibles(), { completo: true }), nombreImg([], true)); } catch { error('No se pudo armar la imagen'); } return; }
    const { ms, todo } = objetivo(b);
    if (!ms.length) return;
    if (a === 'texto') return copiar(todo || ms.length > 1 ? textoVarios(ms, todo) : textoMetodo(ms[0]), 'Texto copiado');
    if (a === 'foto') return foto(ms, false);
    if (a === 'enviar') return enviar(ms, todo, enHoja);
    if (a === 'insertar' && enHoja && ctxHoja.insertar) {
      ctxHoja.insertar(ms.length > 1 ? textoVarios(ms, false) : textoMetodo(ms[0]));
      cerrarSheet('mp-sheet');
    }
  }

  // Una línea por dato, «Etiqueta: valor». Una línea sin «: » sigue el dato de arriba (direcciones).
  const camposATexto = cs => (cs || []).map(c => `${c.etiqueta}: ${c.valor}`).join('\n');
  function textoACampos(t) {
    const out = [];
    for (const linea of String(t || '').split('\n').map(s => s.trim()).filter(Boolean)) {
      const k = linea.indexOf(': ');
      if (k > 0) out.push({ etiqueta: linea.slice(0, k).trim(), valor: linea.slice(k + 2).trim() });
      else if (out.length) out[out.length - 1].valor += '\n' + linea;
      else out.push({ etiqueta: 'Dato', valor: linea });
    }
    return out;
  }
  async function editar(m) {
    if (!admin) return;
    const f = await confirmar({ titulo: m ? `Editar ${m.titulo}` : 'Agregar método de pago', textoOk: 'Guardar',
      detalle: 'Datos: una línea por dato con el formato «Etiqueta: valor». Una línea sin «: » se suma al dato de arriba (útil para direcciones).',
      campos: [
        { id: 'titulo', label: 'Nombre', placeholder: 'Ej: Zelle', valor: m?.titulo || '', requerido: true },
        { id: 'region', label: 'Región', tipo: 'select', opciones: REGIONES.map(([v, t]) => ({ v, t })), valor: m?.region || 'venezuela', requerido: true },
        { id: 'campos', label: 'Datos', tipo: 'textarea', placeholder: 'Banco: Banco Provincial\nTeléfono: 0414-0000000', valor: camposATexto(m?.campos) },
        { id: 'nota', label: 'Nota debajo del nombre', valor: m?.nota || '' },
        { id: 'aviso', label: 'Importante (una línea por punto)', tipo: 'textarea', valor: m?.aviso || '' },
        { id: 'orden', label: 'Orden (menor va primero)', tipo: 'number', step: 1, valor: m?.orden ?? (Math.max(0, ...lista.map(x => x.orden || 0)) + 10), requerido: true },
        { id: 'activo', label: 'Visible para los asesores', tipo: 'check', valor: m ? m.activo : true },
      ] });
    if (!f) return;
    const fila = { titulo: f.titulo.trim(), region: f.region, campos: textoACampos(f.campos), nota: f.nota.trim() || null,
      aviso: f.aviso.trim() || null, orden: Number(f.orden) || 0, activo: !!f.activo, actualizado_en: new Date().toISOString() };
    const q = m ? sb.from('metodos_pago').update(fila).eq('id', m.id) : sb.from('metodos_pago').insert(fila);
    const { error: e } = await q;
    if (e) { error('No se pudo guardar: ' + e.message); return; }
    ok('Método de pago guardado');
    await traer(true); repintar();
  }

  let montado = false;
  async function cargar() {
    if (!montado) { css(); raiz.addEventListener('click', e => clic(e, false)); raiz.addEventListener('change', e => e.target.matches('[data-mp="sel"]') && clic(e, false)); montado = true; }
    if (!cargado) raiz.innerHTML = '<div class="ria-sub">Cargando...</div>';
    prepararImagen();
    if (await traer(true)) pintar(raiz, false);
  }
  let hojaLista = false;
  // Hoja rápida desde un chat o la ficha: `insertar(texto)` pone el texto en la caja del chat;
  // `telefono` hace que «Enviar» abra WhatsApp directo con ese cliente.
  async function abrirHoja(opts = {}) {
    css(); prepararImagen();
    if (!hojaLista) { hoja.addEventListener('click', e => clic(e, true)); hoja.addEventListener('change', e => e.target.matches('[data-mp="sel"]') && clic(e, true)); hojaLista = true; }
    ctxHoja = { insertar: opts.insertar || null, telefono: String(opts.telefono || '').replace(/\D/g, '') };
    sel.clear();
    if (!cargado) hoja.innerHTML = '<div class="ria-sub">Cargando...</div>';
    abrirSheet('mp-sheet');
    if (await traer(false)) pintar(hoja, true);
  }

  return { cargar, abrirHoja };
}
