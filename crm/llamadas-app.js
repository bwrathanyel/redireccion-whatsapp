// Llamadas que el asesor hace desde su propio WhatsApp (plan B, sin grabación): se abre
// wa.me, se registra la fila canal 'app' y unos segundos después aparece la ficha de cierre.
// Las dos escrituras usan el mismo proveedor_call_id, así que si la primera falla por red
// la ficha igual crea la fila. La llamada abierta vive en localStorage para sobrevivir a la
// recarga que suele pasar en móvil al volver de WhatsApp.
const FICHA_MS = 4000;
const RESULTADOS = [['interesado', 'Interesado'], ['no_contesta', 'No contesta'], ['no_interesa', 'No le interesa'], ['numero_equivocado', 'Número equivocado'], ['ya_viajo', 'Ya viajó']];
const PROXIMAS = [['0', 'Ninguna'], ['1', 'Llamar mañana'], ['3', 'En 3 días'], ['7', 'En 1 semana']];
const CSS = `
.lc-card{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:9000;width:min(340px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow-y:auto;box-sizing:border-box;background:var(--panel-solid);color:var(--txt);border:1px solid var(--line2);border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.28);padding:14px;display:flex;flex-direction:column;gap:10px}
.lc-card header{display:flex;align-items:center;gap:10px}
.lc-card header>i{width:38px;height:38px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--wa);color:#fff}
.lc-card header div{flex:1;min-width:0}
.lc-card header b{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.lc-card header small,.lc-et{display:block;color:var(--muted);font-size:12.5px}
.lc-x{width:40px;height:40px;flex:none;border:0;background:transparent;color:var(--muted);font-size:18px;cursor:pointer}
.lc-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.lc-chips button{min-height:40px;padding:6px 12px;border-radius:999px;border:1px solid var(--line2);background:transparent;color:var(--txt);font:inherit;font-size:13px;cursor:pointer}
.lc-chips button[aria-pressed="true"]{background:var(--wa);border-color:transparent;color:#fff;font-weight:600}
.lc-card textarea{width:100%;box-sizing:border-box;min-height:56px;padding:8px 10px;border-radius:10px;border:1px solid var(--line2);background:transparent;color:var(--txt);font:inherit;resize:vertical}
.lc-guardar{min-height:42px;border:0;border-radius:10px;background:var(--wa);color:#fff;font:inherit;font-weight:600;cursor:pointer}
.lc-guardar:disabled{opacity:.5;cursor:default}
`;

export function crearLlamadasApp({ sb, esc, usuarioId, asesor, ok, error, aviso }) {
  const clave = `lotus-llamada-app:${usuarioId}`;
  let pendiente = null, tarjeta = null, timer = null;

  const leer = () => { try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; } };
  const escribir = p => { try { p ? localStorage.setItem(clave, JSON.stringify(p)) : localStorage.removeItem(clave); } catch {} };
  const mensaje = e => /no autorizado/i.test(e?.message || '') ? 'Este lead no está asignado a ti' : (e?.message || 'No se pudo guardar');
  const valor = g => tarjeta?.querySelector(`[data-g="${g}"] [aria-pressed="true"]`)?.dataset.v;
  const chips = (g, ops, activo) => `<div class="lc-chips" data-g="${g}">${ops.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${v === activo}">${t}</button>`).join('')}</div>`;

  function quitar() { clearTimeout(timer); tarjeta?.remove(); tarjeta = null; }
  function cerrar() { if (leer()?.id === pendiente?.id) escribir(null); pendiente = null; quitar(); }

  async function registrar(p, extra) {
    const { error: e } = await sb.rpc('registrar_llamada', { p_proveedor_call_id: p.id, p_lead_id: p.lead_id, p_asesor: asesor, p_direccion: 'saliente', p_canal: 'app', p_telefono: p.telefono, p_iniciada_en: p.iniciada_en, ...extra });
    if (e) throw e;
  }

  async function crearTarea(p, dias) {
    const vence = new Date(); vence.setDate(vence.getDate() + dias); vence.setHours(10, 0, 0, 0);
    const titulo = `Llamar a ${p.nombre}`;
    const { data, error: e } = await sb.rpc('tarea_crear', { p_datos: { titulo, vence_at: vence.toISOString(), destinatarios: [usuarioId], lead_id: p.lead_id, cliente_token: p.tarea_token, pasos: [{ titulo, detector: 'manual' }] } });
    if (e) throw e;
    if (data?.ok === false) throw new Error(`La llamada quedó guardada, pero no se pudo crear la tarea (${data.error})`);
  }

  async function guardarFicha() {
    const p = pendiente, btn = tarjeta.querySelector('.lc-guardar'), notas = tarjeta.querySelector('textarea').value.trim() || null, resultado = valor('resultado'), dias = Number(valor('proxima'));
    btn.disabled = true;
    try {
      await registrar(p, { p_resultado: resultado, p_notas: notas });
      if (dias) await crearTarea(p, dias);
      cerrar();
      ok(dias ? 'Llamada guardada y tarea creada' : 'Llamada guardada');
    } catch (e) { btn.disabled = false; error(mensaje(e)); }
  }

  function mostrar() {
    if (!pendiente || tarjeta) return;
    tarjeta = document.createElement('section');
    tarjeta.className = 'lc-card';
    tarjeta.setAttribute('aria-label', 'Resultado de la llamada');
    tarjeta.innerHTML = `<header><i class="fas fa-phone"></i><div><b>${esc(pendiente.nombre)}</b><small>¿Cómo salió la llamada?</small></div><button type="button" class="lc-x" title="Cerrar sin resultado" aria-label="Cerrar sin resultado"><i class="fas fa-xmark"></i></button></header>
      ${chips('resultado', RESULTADOS)}
      <div><span class="lc-et">Próxima acción</span>${chips('proxima', PROXIMAS, '0')}</div>
      <textarea maxlength="1000" placeholder="Nota (opcional)" aria-label="Nota de la llamada"></textarea>
      <button type="button" class="lc-guardar" disabled>Guardar</button>`;
    tarjeta.addEventListener('click', e => {
      if (e.target.closest('.lc-x')) { registrar(pendiente).catch(() => {}); return cerrar(); }
      if (e.target.closest('.lc-guardar')) return guardarFicha();
      const chip = e.target.closest('[data-v]');
      if (!chip) return;
      chip.parentElement.querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', b === chip));
      tarjeta.querySelector('.lc-guardar').disabled = !valor('resultado');
    });
    document.body.appendChild(tarjeta);
  }

  function llamar(lead, telefono) {
    pendiente = leer() || pendiente;
    if (pendiente) { mostrar(); error('Primero guarda el resultado de la llamada anterior'); return; }
    quitar();
    const url = `https://wa.me/${telefono}`, win = window.open(url, '_blank');
    if (win) win.opener = null;
    else aviso(`El navegador bloqueó WhatsApp -- <a href="${url}" target="_blank" rel="noopener">toca aquí para abrirlo</a>`);
    pendiente = { id: `app-${crypto.randomUUID()}`, lead_id: lead.id, nombre: lead.nombre || `+${telefono}`, telefono, iniciada_en: new Date().toISOString(), tarea_token: crypto.randomUUID() };
    escribir(pendiente);
    registrar(pendiente).catch(e => { if (/no autorizado/i.test(e?.message || '')) error(mensaje(e)); });
    timer = setTimeout(mostrar, FICHA_MS);
  }

  function enlazar() {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    pendiente = leer();
    mostrar();
  }

  return { enlazar, llamar };
}
