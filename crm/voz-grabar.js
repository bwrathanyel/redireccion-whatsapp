// Grabar y mandar notas de voz desde los compositores de WhatsApp (Bandeja y WhatsApp empresa).
// Mantener presionado el micrófono graba y al soltar envía (deslizar a la izquierda cancela);
// un toque deja grabando con botones para descartar, escuchar antes o enviar.
// WhatsApp solo muestra nota de voz con ogg/opus mono. Chrome graba webm/opus: se reempaqueta a
// ogg sin recodificar (webmAOgg). Firefox ya graba ogg. Safari graba mp4/aac: sale como audio común.
const TIPOS = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const MAX_SEG = 15 * 60, TOQUE_MS = 350, CANCELAR_PX = 90;

// ---- webm/opus -> ogg/opus ----
const MAESTROS = new Set([0x18538067, 0x1F43B675, 0x1654AE6B, 0xAE, 0xA0, 0xE1]);
function largoVint(x, max) { let n = 1, m = 0x80; while (n <= max && !(x & m)) { n++; m >>= 1; } if (n > max) throw new Error('ebml'); return [n, m]; }
function leerId(b, i) { const [n] = largoVint(b[i], 4); let v = 0; for (let k = 0; k < n; k++) v = v * 256 + b[i + k]; return { v, n }; }
function leerTam(b, i) {
  const [n, m] = largoVint(b[i], 8);
  let v = b[i] & (m - 1), unos = v === m - 1;
  for (let k = 1; k < n; k++) { v = v * 256 + b[i + k]; if (b[i + k] !== 255) unos = false; }
  return { v, n, desconocido: unos };
}
function muestrasOpus(p) {
  if (!p.length) return 0;
  const cfg = p[0] >> 3, c = p[0] & 3;
  const ms = cfg < 12 ? [10, 20, 40, 60][cfg & 3] : cfg < 16 ? [10, 20][cfg & 1] : [2.5, 5, 10, 20][cfg & 3];
  return Math.round(ms * 48) * (c === 0 ? 1 : c < 3 ? 2 : (p[1] & 0x3f));
}
const CRC_OGG = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let r = i << 24; for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04C11DB7 : r << 1; t[i] = r >>> 0; }
  return t;
})();
function paginaOgg(paqs, granulo, serie, seq, tipo) {
  const lac = [];
  for (const p of paqs) { let n = p.length; while (n >= 255) { lac.push(255); n -= 255; } lac.push(n); }
  const out = new Uint8Array(27 + lac.length + paqs.reduce((s, p) => s + p.length, 0)), dv = new DataView(out.buffer);
  out.set([0x4f, 0x67, 0x67, 0x53, 0, tipo]);
  dv.setUint32(6, granulo % 2 ** 32, true); dv.setUint32(10, Math.floor(granulo / 2 ** 32), true);
  dv.setUint32(14, serie, true); dv.setUint32(18, seq, true);
  out[26] = lac.length; out.set(lac, 27);
  let o = 27 + lac.length;
  for (const p of paqs) { out.set(p, o); o += p.length; }
  let crc = 0;
  for (let k = 0; k < out.length; k++) crc = ((crc << 8) ^ CRC_OGG[((crc >>> 24) ^ out[k]) & 255]) >>> 0;
  dv.setUint32(22, crc, true);
  return out;
}
export function webmAOgg(b) {
  let i = 0, head = null, canales = 1;
  const paqs = [];
  while (i < b.length - 1) {
    let id, tam;
    try { id = leerId(b, i); tam = leerTam(b, i + id.n); } catch { break; }
    const ini = i + id.n + tam.n;
    if (MAESTROS.has(id.v)) { i = ini; continue; }
    if (tam.desconocido) break;
    const fin = ini + tam.v;
    if (fin > b.length) break;
    if (id.v === 0x63A2) head = b.slice(ini, fin);
    else if (id.v === 0x9F) canales = b[fin - 1] || 1;
    else if (id.v === 0xA3 || id.v === 0xA1) {
      const pista = leerTam(b, ini), cab = ini + pista.n + 3;
      if (id.v === 0xA3 && (b[cab - 1] & 0x06)) throw new Error('webm_con_lacing');
      if (fin > cab) paqs.push(b.subarray(cab, fin));
    }
    i = fin;
  }
  if (!paqs.length) throw new Error('sin_audio');
  if (!head || head.length < 19 || String.fromCharCode(...head.subarray(0, 8)) !== 'OpusHead') {
    head = new Uint8Array(19); head.set([...'OpusHead'].map(c => c.charCodeAt(0)));
    const dv = new DataView(head.buffer); head[8] = 1; head[9] = canales; dv.setUint16(10, 312, true); dv.setUint32(12, 48000, true);
  }
  canales = head[9];
  const preskip = head[10] | head[11] << 8;
  const vendor = new TextEncoder().encode('Lotus CRM');
  const tags = new Uint8Array(8 + 4 + vendor.length + 4), dvt = new DataView(tags.buffer);
  tags.set([...'OpusTags'].map(c => c.charCodeAt(0))); dvt.setUint32(8, vendor.length, true); tags.set(vendor, 12);
  const serie = (Math.random() * 2 ** 32) >>> 0, partes = [paginaOgg([head], 0, serie, 0, 2), paginaOgg([tags], 0, serie, 1, 0)];
  let seq = 2, gran = 0, grupo = [], lac = 0;
  const volcar = fin => { partes.push(paginaOgg(grupo, gran, serie, seq++, fin ? 4 : 0)); grupo = []; lac = 0; };
  for (const p of paqs) {
    const l = Math.floor(p.length / 255) + 1;
    if (grupo.length && (lac + l > 255 || grupo.length >= 50)) volcar(false);
    grupo.push(p); lac += l; gran += muestrasOpus(p);
  }
  volcar(true);
  return { blob: new Blob(partes, { type: 'audio/ogg; codecs=opus' }), canales, segundos: Math.max(0, gran - preskip) / 48000 };
}

// ---- grabador ----
const CSS = `
.vg-on{position:relative}
.vg-barra{position:absolute;inset:0;z-index:3;display:flex;align-items:center;gap:9px;padding:0 9px;background:var(--panel-solid);border-radius:inherit}
.vg-mic{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.vg-b{width:42px;height:42px;flex-shrink:0;border-radius:50%;border:none;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;background:transparent;color:var(--muted);transition:color .16s,background .16s}
.vg-b:hover{color:var(--txt)}
.vg-x:hover{color:var(--danger)}
.vg-b.vg-ok{background:var(--wa);color:#fff}
.vg-b:disabled{opacity:.5;cursor:default}
.vg-b.vg-mic-on{background:var(--danger);color:#fff;cursor:default}
.vg-punto{width:9px;height:9px;flex-shrink:0;border-radius:50%;background:var(--danger);animation:vg-latido 1s ease-in-out infinite}
@keyframes vg-latido{50%{opacity:.25}}
.vg-t{min-width:38px;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}
.vg-guia{flex:1;min-width:0;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transform:translateX(var(--dx,0px))}
.vg-prev{flex:1;min-width:0}
@media(prefers-reduced-motion:reduce){.vg-punto{animation:none}}
`;
const reloj = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const vozGrabable = () => typeof MediaRecorder === 'function' && !!navigator.mediaDevices?.getUserMedia;

async function preparar(blob, seg) {
  const tipo = (blob.type || '').toLowerCase();
  if (tipo.includes('webm')) {
    const r = webmAOgg(new Uint8Array(await blob.arrayBuffer()));
    return { file: new File([r.blob], 'nota-de-voz.ogg', { type: 'audio/ogg' }), voz: r.canales === 1, segundos: r.segundos || seg };
  }
  if (tipo.includes('ogg')) return { file: new File([blob], 'nota-de-voz.ogg', { type: 'audio/ogg' }), voz: true, segundos: seg };
  return { file: new File([blob], 'nota-de-voz.m4a', { type: 'audio/mp4' }), voz: false, segundos: seg };
}

// compose: contenedor del compositor; antesDe: botón enviar (el micrófono va antes);
// alEnviar(file, { voz, segundos }) sube el audio y avisa sus propios errores.
export function crearGrabadorVoz({ compose, antesDe, claseBoton, htmlVoz, puede, contexto, alEnviar, error }) {
  if (!compose || !antesDe || !vozGrabable()) return { cancelar() {} };
  if (!document.getElementById('vg-css')) {
    const st = document.createElement('style'); st.id = 'vg-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  antesDe.insertAdjacentHTML('beforebegin', `<button type="button" class="${claseBoton} vg-mic" title="Nota de voz: mantén presionado para grabar o toca para grabar sin sostener" aria-label="Grabar nota de voz"><i class="fas fa-microphone"></i></button>`);
  const mic = antesDe.previousElementSibling;
  const barra = document.createElement('div');
  barra.className = 'vg-barra'; barra.hidden = true;
  compose.appendChild(barra);

  let estado = 'libre', modo = 'fijo', presionado = false, x0 = 0, t0 = 0, tRec = 0, ctx = null;
  let stream = null, rec = null, trozos = [], tic = null, listo = null, url = null;
  const seg = () => tRec ? (Date.now() - tRec) / 1000 : 0;

  function pintar() {
    const on = estado !== 'libre';
    compose.classList.toggle('vg-on', on);
    barra.hidden = !on;
    if (!on) { barra.innerHTML = ''; barra.style.removeProperty('--dx'); return; }
    const x = `<button type="button" class="vg-b vg-x" data-vg="descartar" aria-label="Descartar nota de voz" ${estado === 'enviando' ? 'disabled' : ''}><i class="fas fa-trash"></i></button>`;
    if (estado === 'revision' || estado === 'enviando') {
      const env = estado === 'enviando';
      barra.innerHTML = `${x}<div class="vg-prev">${htmlVoz(`src="${url}"`, url)}</div>`
        + `<button type="button" class="vg-b vg-ok" data-vg="enviar" aria-label="Enviar nota de voz" ${env ? 'disabled' : ''}><i class="fas fa-${env ? 'spinner fa-spin' : 'paper-plane'}"></i></button>`;
      return;
    }
    const fijo = modo === 'fijo', ocupado = estado !== 'grabando';
    const guia = estado === 'pidiendo' ? 'Activando micrófono…' : estado === 'procesando' ? 'Preparando…' : fijo ? 'Grabando' : '<i class="fas fa-chevron-left" aria-hidden="true"></i> Desliza para cancelar';
    barra.innerHTML = `${fijo ? x : ''}<span class="vg-punto" aria-hidden="true"></span><span class="vg-t">${reloj(seg())}</span><span class="vg-guia">${guia}</span>`
      + (fijo
        ? `<button type="button" class="vg-b" data-vg="parar" aria-label="Detener y escuchar" ${ocupado ? 'disabled' : ''}><i class="fas fa-stop"></i></button><button type="button" class="vg-b vg-ok" data-vg="enviar-ya" aria-label="Enviar nota de voz" ${ocupado ? 'disabled' : ''}><i class="fas fa-paper-plane"></i></button>`
        : '<span class="vg-b vg-mic-on" aria-hidden="true"><i class="fas fa-microphone"></i></span>');
  }
  function soltarMic() { stream?.getTracks().forEach(t => t.stop()); stream = null; }
  function reset() {
    clearInterval(tic); tic = null;
    if (rec && rec.state !== 'inactive') { rec.onstop = null; try { rec.stop(); } catch {} }
    rec = null; trozos = []; soltarMic();
    if (url) URL.revokeObjectURL(url);
    url = null; listo = null; tRec = 0; presionado = false; estado = 'libre';
    pintar();
  }
  async function empezar() {
    estado = 'pidiendo'; ctx = contexto(); pintar();
    let s;
    try { s = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }); }
    catch (e) {
      if (estado === 'pidiendo') reset();
      error(e?.name === 'NotAllowedError' ? 'Permite el micrófono en el navegador para grabar notas de voz' : 'No se encontró un micrófono');
      return;
    }
    if (estado !== 'pidiendo') { s.getTracks().forEach(t => t.stop()); return; }
    stream = s;
    const tipo = TIPOS.find(t => MediaRecorder.isTypeSupported?.(t));
    try { rec = new MediaRecorder(stream, { ...(tipo ? { mimeType: tipo } : {}), audioBitsPerSecond: 32000 }); }
    catch { reset(); error('Este navegador no puede grabar audio'); return; }
    trozos = [];
    rec.ondataavailable = e => { if (e.data?.size) trozos.push(e.data); };
    rec.start(1000);
    tRec = Date.now(); estado = 'grabando';
    tic = setInterval(() => {
      const t = barra.querySelector('.vg-t');
      if (t) t.textContent = reloj(seg());
      if (seg() >= MAX_SEG) terminar(false);
    }, 250);
    pintar();
  }
  const detener = () => new Promise(res => {
    if (!rec || rec.state === 'inactive') return res(null);
    const r = rec;
    r.onstop = () => res(new Blob(trozos, { type: r.mimeType || trozos[0]?.type || '' }));
    r.stop();
  });
  async function terminar(directo) {
    if (estado === 'pidiendo') { modo = 'fijo'; pintar(); return; }
    if (estado !== 'grabando') return;
    const s = seg();
    clearInterval(tic); tic = null; estado = 'procesando'; pintar();
    const blob = await detener();
    rec = null; soltarMic();
    if (estado !== 'procesando') return;
    if (!blob || s < 1) { reset(); if (blob) error('Nota muy corta: mantén presionado mientras hablas'); return; }
    try { listo = await preparar(blob, s); } catch { reset(); error('No se pudo preparar la nota de voz'); return; }
    if (directo) return enviar();
    url = URL.createObjectURL(listo.file); estado = 'revision'; pintar();
  }
  async function enviar() {
    if (!listo || estado === 'enviando') return;
    if (contexto() !== ctx || !puede()) { reset(); error('Cambiaste de chat: la nota de voz no se envió'); return; }
    if (!url) url = URL.createObjectURL(listo.file);
    estado = 'enviando'; pintar();
    const { file, voz, segundos } = listo;
    try { await alEnviar(file, { voz, segundos }); } finally { reset(); }
  }

  mic.addEventListener('contextmenu', ev => ev.preventDefault());
  mic.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 || estado !== 'libre' || !puede()) return;
    ev.preventDefault();
    try { mic.setPointerCapture(ev.pointerId); } catch {}
    presionado = true; modo = 'mantener'; x0 = ev.clientX; t0 = Date.now();
    empezar();
  });
  mic.addEventListener('pointermove', ev => {
    if (!presionado) return;
    const dx = Math.min(0, ev.clientX - x0);
    barra.style.setProperty('--dx', `${dx}px`);
    if (dx < -CANCELAR_PX) reset();
  });
  mic.addEventListener('pointerup', () => {
    if (!presionado) return;
    presionado = false;
    barra.style.removeProperty('--dx');
    if (Date.now() - t0 < TOQUE_MS) { modo = 'fijo'; pintar(); return; }
    terminar(true);
  });
  mic.addEventListener('pointercancel', () => { if (presionado) reset(); });
  mic.addEventListener('click', ev => { if (ev.detail === 0 && estado === 'libre' && puede()) { modo = 'fijo'; empezar(); } });
  barra.addEventListener('click', ev => {
    const b = ev.target.closest('[data-vg]');
    if (!b || b.disabled) return;
    const a = b.dataset.vg;
    if (a === 'descartar') reset();
    else if (a === 'parar') terminar(false);
    else if (a === 'enviar-ya') terminar(true);
    else if (a === 'enviar') enviar();
  });
  barra.addEventListener('keydown', ev => { if (ev.key === 'Escape' && estado !== 'enviando') reset(); });
  return { cancelar: () => { if (estado !== 'libre' && estado !== 'enviando') reset(); } };
}
