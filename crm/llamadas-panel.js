// Leads > Llamadas: las llamadas por WhatsApp del asesor (canal 'app') que quedaron sin
// resultado y las métricas por asesor. La RLS de llamadas decide qué filas ve cada uno.
// "Contactado" = alguien atendió y era el cliente: interesado, no le interesa o ya viajó.
const CSS = `
.lp-periodo{display:flex;gap:6px;margin:0 0 14px}
.lp-periodo button[aria-pressed="true"]{border-color:var(--accent-ink);color:var(--accent-ink);font-weight:700}
.lp-scroll{overflow-x:auto}
.lp-tabla{width:100%;border-collapse:collapse;font-size:13px}
.lp-tabla th,.lp-tabla td{padding:9px 10px;border-top:1px solid var(--line);text-align:right;white-space:nowrap}
.lp-tabla th{border-top:0;color:var(--muted);font-size:11.5px;font-weight:700}
.lp-tabla th:first-child,.lp-tabla td:first-child{text-align:left}
.lp-card{margin-top:12px}
.lp-card h3{margin:0 0 8px;font-size:14px}
.lp-fila{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:9px 0;border-top:1px solid var(--line)}
.lp-fila>div{flex:1;min-width:180px}
.lp-fila b{display:block;font-size:13px;overflow-wrap:anywhere}
.lp-fila small{display:block;margin-top:2px;color:var(--muted);font-size:11.5px}
.lp-vacio{padding:18px 0;text-align:center;color:var(--muted);font-size:12px}
`;
const PERIODOS = [[0, 'Hoy'], [6, '7 días'], [29, '30 días']];
const LIMITE = 100;
const pct = (a, b) => b ? `${Math.round(a / b * 100)}%` : '—';
const n = v => Number(v || 0);
const contactados = m => n(m.interesado) + n(m.no_interesa) + n(m.ya_viajo);
const conResultado = m => n(m.total) - n(m.sin_resultado);
const fecha = t => new Date(t).toLocaleString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function crearLlamadasPanel({ sb, esc, pintarKPIs, hoy, rol, miNombre, abrirLead, completar, error, raiz }) {
  const admin = rol === 'admin';
  let dias = 6, montado = false, turno = 0, filas = [];
  const $ = s => raiz.querySelector(s);

  function marco() {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    raiz.innerHTML = `
      <div class="pvc-cab"><div><h2>Llamadas</h2>
        <div class="ria-sub">Llamadas hechas desde el WhatsApp del asesor. La duración no se mide porque la llamada ocurre fuera del CRM.</div></div></div>
      <div class="lp-periodo">${PERIODOS.map(([d, t]) => `<button class="btn-sm" type="button" data-dias="${d}" aria-pressed="${d === dias}">${t}</button>`).join('')}</div>
      <div class="kpis" id="lp-kpis"></div>
      ${admin ? '<div class="ria-card lp-card"><h3>Por asesor</h3><div class="lp-scroll" id="lp-asesores"></div></div>' : ''}
      <div class="ria-card lp-card"><h3>Sin resultado (todas las fechas)</h3><div id="lp-pendientes"><div class="lp-vacio">Cargando...</div></div></div>`;
    raiz.addEventListener('click', clic);
    montado = true;
  }

  function clic(e) {
    const b = e.target.closest('[data-dias],[data-completar],[data-lead]');
    if (!b) return;
    if (b.dataset.dias !== undefined) {
      dias = Number(b.dataset.dias);
      raiz.querySelectorAll('[data-dias]').forEach(x => x.setAttribute('aria-pressed', x === b));
      return cargar();
    }
    if (b.dataset.lead) return abrirLead(Number(b.dataset.lead));
    const f = filas.find(x => String(x.id) === b.dataset.completar);
    if (f) completar({ id: f.proveedor_call_id, lead_id: f.lead_id, nombre: nombreDe(f), telefono: f.telefono, iniciada_en: f.iniciada_en });
  }

  const nombreDe = f => f.leads?.nombre || (f.telefono ? `+${f.telefono}` : 'Sin nombre');

  function desde() {
    const d = new Date(`${hoy()}T00:00:00-04:00`);
    d.setUTCDate(d.getUTCDate() - dias);
    return d.toISOString();
  }

  function pintarMetricas(metricas) {
    const t = metricas.reduce((a, m) => { for (const k of ['total', 'sin_resultado', 'interesado', 'no_interesa', 'ya_viajo']) a[k] = n(a[k]) + n(m[k]); return a; }, {});
    pintarKPIs($('#lp-kpis'), [
      { t: 'Llamadas', v: n(t.total), d: `${conResultado(t)} con resultado`, i: 'fa-phone', c: 'var(--accent)' },
      { t: 'Contacto', v: pct(contactados(t), conResultado(t)), d: `${contactados(t)} clientes atendieron`, i: 'fa-headset', c: 'var(--blue)' },
      { t: 'Interesados', v: n(t.interesado), d: `${pct(t.interesado, contactados(t))} de los contactados`, i: 'fa-star', c: 'var(--green)' },
      { t: 'Sin resultado', v: n(t.sin_resultado), d: 'En este período', i: 'fa-circle-question', c: 'var(--amber)' },
    ]);
    if (!admin) return;
    $('#lp-asesores').innerHTML = metricas.length ? `<table class="lp-tabla"><thead><tr><th>Asesor</th><th>Llamadas</th><th>Leads</th><th>No contesta</th><th>Contacto</th><th>Interesados</th><th>Sin resultado</th></tr></thead><tbody>
      ${metricas.map(m => `<tr><td>${esc(m.asesor)}</td><td>${n(m.total)}</td><td>${n(m.leads)}</td><td>${n(m.no_contesta)}</td><td>${pct(contactados(m), conResultado(m))}</td><td>${n(m.interesado)}</td><td>${n(m.sin_resultado)}</td></tr>`).join('')}
    </tbody></table>` : '<div class="lp-vacio">Sin llamadas en este período</div>';
  }

  function pintarPendientes() {
    $('#lp-pendientes').innerHTML = !filas.length ? '<div class="lp-vacio">No hay llamadas sin resultado</div>'
      : filas.map(f => `<div class="lp-fila"><div><b>${esc(nombreDe(f))}</b><small>${[fecha(f.iniciada_en), admin ? f.asesor : null].filter(Boolean).map(esc).join(' · ')}</small></div>
        ${f.lead_id ? `<button class="btn-sm" type="button" data-lead="${f.lead_id}">Ver lead</button>` : ''}
        ${!admin || f.asesor === miNombre ? `<button class="btn-sm lt-primario" type="button" data-completar="${f.id}">Poner resultado</button>` : ''}</div>`).join('')
      + (filas.length === LIMITE ? `<div class="lp-vacio">Se muestran las ${LIMITE} más recientes</div>` : '');
  }

  async function cargar() {
    if (!montado) marco();
    const mio = ++turno;
    const [m, p] = await Promise.all([
      sb.rpc('llamadas_app_metricas', { p_desde: desde() }),
      sb.from('llamadas').select('id,proveedor_call_id,lead_id,asesor,telefono,iniciada_en,leads(nombre)').eq('canal', 'app').is('resultado', null).order('iniciada_en', { ascending: false }).limit(LIMITE),
    ]);
    if (mio !== turno) return;
    if (m.error || p.error) {
      console.error('llamadas-panel', m.error || p.error);
      error('No se pudieron cargar las llamadas');
      $('#lp-pendientes').innerHTML = '<div class="lp-vacio">No se pudo cargar</div>';
      return;
    }
    pintarMetricas(m.data || []);
    filas = p.data || [];
    pintarPendientes();
  }

  return { cargar };
}
