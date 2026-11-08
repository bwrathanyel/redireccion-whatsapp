// Llamadas entrantes de WhatsApp (Calling API directo con Meta) atendidas en el
// navegador. whatsapp-webhook crea la fila en `llamadas` al timbrar; acá llega por
// Realtime, se pide la oferta SDP a la EF whatsapp-llamada, se contesta con
// RTCPeerConnection + micrófono y se cuelga por la misma EF. La RLS decide quién
// ve cada llamada; la EF reserva la fila, así que si varios CRM la ven solo uno
// la contesta. Sin grabación hasta que el dueño defina la retención.
const TIMBRE_MAX_MS = 90_000;
const SONDEO_MS = 3000;
const ICE_MAX_MS = 3000;
const ABIERTOS = ['timbrando', 'aceptada', 'conectada'];
const ERRORES = {
  ya_atendida: 'Otra persona ya atendió esta llamada',
  no_timbrando: 'La llamada ya no está sonando',
  sin_oferta: 'WhatsApp todavía no mandó el audio de la llamada, intenta de nuevo',
  sin_acceso: 'Esta llamada no es tuya',
  no_configurado: 'Falta conectar el número de llamadas con Meta (token)',
  meta_rechazo: 'WhatsApp rechazó la acción',
  sdp_invalido: 'El navegador no pudo preparar el audio',
  no_en_curso: 'La llamada ya terminó',
};
const CSS = `
#lw-dock{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:9000;display:flex;flex-direction:column;gap:10px;width:min(340px,calc(100vw - 32px))}
.lw-card{background:var(--panel-solid);color:var(--txt);border:1px solid var(--line2);border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.28);padding:14px;display:flex;flex-direction:column;gap:10px}
.lw-card header{display:flex;align-items:center;gap:10px}
.lw-card header>i{width:38px;height:38px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--wa);color:#fff}
.lw-card.timbrando header>i{animation:lw-pulso 1.2s ease-in-out infinite}
.lw-card header div{flex:1;min-width:0}
.lw-card header b{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.lw-card header small{display:block;color:var(--muted);font-size:12.5px}
.lw-nota{font-size:12px;color:var(--muted)}
.lw-acc{display:flex;gap:8px;flex-wrap:wrap}
.lw-acc button{flex:1;min-height:40px;padding:8px 12px;border-radius:10px;border:1px solid var(--line2);background:transparent;color:var(--txt);font:inherit;cursor:pointer}
.lw-acc button:disabled{opacity:.5;cursor:default}
.lw-acc .lw-si{background:var(--wa);border-color:transparent;color:#fff;font-weight:600}
.lw-acc .lw-no{background:var(--danger);border-color:transparent;color:#fff;font-weight:600}
.lw-acc .lw-mudo.on{border-color:var(--amber);color:var(--amber)}
@keyframes lw-pulso{50%{transform:scale(1.12)}}
@media (prefers-reduced-motion:reduce){.lw-card.timbrando header>i{animation:none}}
`;

export function crearLlamadasWa({ sb, esc, abrirLead, ok, error }) {
  const timbrando = new Map();
  let enCurso = null;
  let dock = null, sondeo = null, reloj = null, audioCtx = null, timbre = null;

  const fmtTel = t => (t ? `+${String(t).replace(/\D/g, '')}` : 'Número oculto');
  const fmtSeg = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const mensaje = r => ERRORES[r?.error] || r?.error || 'No se pudo completar la acción';

  async function ef(accion, llamada_id, sdp) {
    const { data, error: e } = await sb.functions.invoke('whatsapp-llamada', { body: { accion, llamada_id, ...(sdp ? { sdp } : {}) } });
    if (!e) return data;
    let det = null;
    try { det = await e.context?.json(); } catch {}
    return det || { ok: false, error: e.message };
  }

  function sonar(on) {
    if (!on) { clearInterval(timbre); timbre = null; return; }
    if (timbre) return;
    const tono = () => {
      try {
        audioCtx ||= new AudioContext();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        for (const [f, t0] of [[440, 0], [480, 0], [440, 0.5], [480, 0.5]]) {
          const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + t0;
          o.frequency.value = f; g.gain.setValueAtTime(0.06, t); g.gain.setValueAtTime(0, t + 0.4);
          o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.4);
        }
      } catch {}
      navigator.vibrate?.([400, 200, 400]);
    };
    tono();
    timbre = setInterval(tono, 3000);
  }

  function render() {
    const cards = [];
    if (enCurso) {
      const l = enCurso.fila, s = enCurso.desde ? Math.round((Date.now() - enCurso.desde) / 1000) : 0;
      cards.push(`<div class="lw-card" data-lw="${l.id}">
        <header><i class="fas fa-phone-volume"></i><div><b>${esc(enCurso.nombre || fmtTel(l.telefono))}</b>
          <small>${enCurso.desde ? `En llamada · ${fmtSeg(s)}` : 'Conectando…'}</small></div></header>
        <div class="lw-acc">
          <button class="lw-mudo${enCurso.mudo ? ' on' : ''}" data-lw-mudo><i class="fas fa-microphone${enCurso.mudo ? '-slash' : ''}"></i> ${enCurso.mudo ? 'Silenciado' : 'Silenciar'}</button>
          ${l.lead_id ? `<button data-lw-lead="${l.lead_id}"><i class="fas fa-user"></i> Lead</button>` : ''}
          <button class="lw-no" data-lw-colgar><i class="fas fa-phone-slash"></i> Colgar</button>
        </div></div>`);
    }
    for (const t of timbrando.values()) {
      const l = t.fila, ocupado = !!enCurso || t.trabajando;
      cards.push(`<div class="lw-card timbrando" data-lw="${l.id}">
        <header><i class="fab fa-whatsapp"></i><div><b>${esc(t.nombre || fmtTel(l.telefono))}</b>
          <small>Llamada de WhatsApp${t.nombre ? ` · ${esc(fmtTel(l.telefono))}` : ''}</small></div></header>
        ${enCurso ? '<div class="lw-nota">Termina la llamada actual para atender esta.</div>' : ''}
        <div class="lw-acc">
          <button class="lw-no" data-lw-rechazar="${l.id}"${t.trabajando ? ' disabled' : ''}><i class="fas fa-phone-slash"></i> Rechazar</button>
          <button class="lw-si" data-lw-atender="${l.id}"${ocupado ? ' disabled' : ''}><i class="fas fa-phone"></i> ${t.trabajando ? 'Conectando…' : 'Atender'}</button>
        </div></div>`);
    }
    dock.innerHTML = cards.join('');
    dock.hidden = !cards.length;
    sonar(!enCurso && [...timbrando.values()].some(t => !t.trabajando));
  }

  function quitarTimbre(id) {
    if (!timbrando.delete(id)) return;
    if (!timbrando.size) { clearInterval(sondeo); sondeo = null; }
    render();
  }

  async function nombreLead(t) {
    if (!t.fila.lead_id) return;
    const { data } = await sb.from('leads').select('nombre').eq('id', t.fila.lead_id).maybeSingle();
    if (data?.nombre) { t.nombre = data.nombre; if (enCurso?.fila.id === t.fila.id) enCurso.nombre = data.nombre; render(); }
  }

  // Si la reserva la hizo otro asesor la RLS deja de mostrarle la fila a este y
  // Realtime no avisa: se sondea mientras haya algo sonando.
  async function sondear() {
    const ids = [...timbrando.keys()];
    if (!ids.length) return;
    const { data, error: e } = await sb.from('llamadas').select('id,estado').in('id', ids);
    if (e) return;
    const vivos = new Map((data || []).map(f => [f.id, f.estado]));
    for (const [id, t] of timbrando) {
      if (vivos.get(id) !== 'timbrando' || Date.now() - Date.parse(t.fila.iniciada_en) > TIMBRE_MAX_MS) quitarTimbre(id);
    }
  }

  function recibir(fila) {
    if (!fila || fila.canal !== 'whatsapp' || fila.direccion !== 'entrante') return;
    if (enCurso?.fila.id === fila.id) {
      enCurso.fila = { ...enCurso.fila, ...fila };
      if (!ABIERTOS.includes(fila.estado)) terminar(fila.estado === 'finalizada' ? null : 'La llamada se cortó');
      return;
    }
    if (fila.estado !== 'timbrando' || Date.now() - Date.parse(fila.iniciada_en) > TIMBRE_MAX_MS) { quitarTimbre(fila.id); return; }
    if (timbrando.has(fila.id)) { timbrando.get(fila.id).fila = fila; return; }
    const t = { fila, nombre: null, trabajando: false };
    timbrando.set(fila.id, t);
    sondeo ||= setInterval(sondear, SONDEO_MS);
    render();
    nombreLead(t);
  }

  function esperarIce(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(res => {
      const listo = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', listo); res(); } };
      pc.addEventListener('icegatheringstatechange', listo);
      setTimeout(res, ICE_MAX_MS);
    });
  }

  async function ofertaConReintento(id) {
    let r = null;
    for (let i = 0; i < 4; i++) {
      r = await ef('oferta', id);
      if (r?.ok || r?.error !== 'sin_oferta') return r;
      await new Promise(res => setTimeout(res, 1000));
    }
    return r;
  }

  async function atender(id) {
    const t = timbrando.get(id);
    if (!t || enCurso || t.trabajando) return;
    t.trabajando = true; render();
    let mic = null, pc = null;
    const fallar = msg => {
      mic?.getTracks().forEach(tr => tr.stop());
      pc?.close();
      t.trabajando = false;
      render();
      error(msg);
    };
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      return fallar('Sin permiso de micrófono: habilítalo en el navegador para atender');
    }
    const of = await ofertaConReintento(id);
    if (!of?.ok) { if (of?.error === 'no_timbrando' || of?.error === 'sin_acceso') quitarTimbre(id); return fallar(mensaje(of)); }

    try {
      pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      const audio = new Audio();
      audio.autoplay = true;
      pc.ontrack = ev => { audio.srcObject = ev.streams[0] || new MediaStream([ev.track]); audio.play().catch(() => {}); };
      await pc.setRemoteDescription({ type: 'offer', sdp: of.sdp });
      mic.getTracks().forEach(tr => pc.addTrack(tr, mic));
      await pc.setLocalDescription(await pc.createAnswer());
      await esperarIce(pc);
      enCurso = { fila: t.fila, nombre: t.nombre, pc, mic, audio, mudo: false, desde: null };
      pc.onconnectionstatechange = () => {
        if (enCurso?.pc !== pc) return;
        if (pc.connectionState === 'connected' && !enCurso.desde) {
          enCurso.desde = Date.now();
          reloj ||= setInterval(render, 1000);
        }
        if (pc.connectionState === 'failed') { ef('colgar', id); terminar('Se perdió la conexión de audio'); }
      };
    } catch (err) {
      console.error('llamadas-wa: WebRTC', err);
      return fallar('El navegador no pudo preparar el audio de la llamada');
    }

    const r = await ef('contestar', id, pc.localDescription.sdp);
    if (!r?.ok) {
      enCurso = null;
      if (r?.error === 'ya_atendida' || r?.error === 'no_timbrando') quitarTimbre(id);
      return fallar(mensaje(r));
    }
    timbrando.delete(id);
    if (!timbrando.size) { clearInterval(sondeo); sondeo = null; }
    render();
  }

  async function rechazar(id) {
    const t = timbrando.get(id);
    if (!t || t.trabajando) return;
    t.trabajando = true; render();
    const r = await ef('rechazar', id);
    if (r?.ok || r?.error === 'no_timbrando') return quitarTimbre(id);
    t.trabajando = false; render();
    error(mensaje(r));
  }

  function terminar(aviso) {
    if (!enCurso) return;
    const { pc, mic, audio, desde } = enCurso;
    enCurso = null;
    mic.getTracks().forEach(tr => tr.stop());
    audio.srcObject = null;
    pc.close();
    clearInterval(reloj); reloj = null;
    render();
    if (aviso) error(aviso);
    else if (desde) ok(`Llamada terminada · ${fmtSeg(Math.round((Date.now() - desde) / 1000))}`);
  }

  async function colgar() {
    if (!enCurso) return;
    const id = enCurso.fila.id;
    const r = await ef('colgar', id);
    // Meta cierra la fila con el terminate; si ya no estaba en curso, igual se suelta el audio.
    if (!r?.ok && r?.error !== 'no_en_curso') error(mensaje(r));
    terminar(null);
  }

  function mudo() {
    if (!enCurso) return;
    enCurso.mudo = !enCurso.mudo;
    enCurso.mic.getAudioTracks().forEach(tr => { tr.enabled = !enCurso.mudo; });
    render();
  }

  async function cargarSonando() {
    const desde = new Date(Date.now() - TIMBRE_MAX_MS).toISOString();
    const { data } = await sb.from('llamadas').select('*').eq('canal', 'whatsapp').eq('estado', 'timbrando').gte('iniciada_en', desde);
    (data || []).forEach(recibir);
  }

  function enlazar() {
    if (dock) return;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    dock = document.createElement('div');
    dock.id = 'lw-dock';
    dock.hidden = true;
    dock.setAttribute('role', 'region');
    dock.setAttribute('aria-live', 'assertive');
    dock.setAttribute('aria-label', 'Llamadas de WhatsApp');
    document.body.appendChild(dock);
    dock.addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.lwAtender) atender(Number(b.dataset.lwAtender));
      else if (b.dataset.lwRechazar) rechazar(Number(b.dataset.lwRechazar));
      else if ('lwColgar' in b.dataset) colgar();
      else if ('lwMudo' in b.dataset) mudo();
      else if (b.dataset.lwLead) abrirLead(Number(b.dataset.lwLead));
    });
    // El navegador bloquea el audio hasta el primer gesto: se desbloquea con cualquier clic.
    document.addEventListener('pointerdown', () => { try { audioCtx ||= new AudioContext(); audioCtx.resume(); } catch {} }, { once: true });
    window.addEventListener('beforeunload', ev => { if (enCurso) { ev.preventDefault(); ev.returnValue = ''; } });
    sb.channel('llamadas-wa')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'llamadas', filter: 'canal=eq.whatsapp' }, p => recibir(p.new))
      .subscribe(estado => { if (estado === 'SUBSCRIBED') cargarSonando(); });
  }

  return { enlazar, enCurso: () => !!enCurso };
}
