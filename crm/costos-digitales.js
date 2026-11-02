// IA > Costos digitales: suscripciones fijas (Claude, Zernio, Supabase...) + consumo
// medido de IA, por mes. RPCs costos_digitales / guardar_suscripcion (solo admin).
// Cada cobro entra solo a `gastos` (Balance) el día de cobro: generar_cargos_suscripciones.
// Plan: ~/.claude/plans/quiero-que-dentro-del-cheerful-iverson.md
const CSS = `
.cd-mes{display:flex;align-items:center;gap:7px;margin:0 0 14px}
.cd-mes .bal-etiqueta{min-width:130px;text-align:center;text-transform:capitalize}
.cd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:12px}
.cd-fila{display:flex;align-items:center;gap:10px;width:100%;padding:9px 0;border:0;border-top:1px solid var(--line);background:none;color:inherit;font:inherit;text-align:left}
.cd-fila:first-child{border-top:0}
button.cd-fila{cursor:pointer}
button.cd-fila:hover .cd-prov{color:var(--accent-ink)}
.cd-fila>div{flex:1;min-width:0}
.cd-prov{font-size:13px;font-weight:700}
.cd-fila small{display:block;font-size:11px;color:var(--muted);margin-top:2px}
.cd-fila b{font-size:13px;white-space:nowrap}
.cd-fila.off{opacity:.55}
.cd-tot{display:flex;justify-content:space-between;padding-top:9px;margin-top:4px;border-top:1px solid var(--line2);font-size:12px;font-weight:700}
.cd-cobrado{color:var(--green)}
.cd-vacio{padding:18px 0;text-align:center;color:var(--muted);font-size:12px}
`;
const GRUPOS = [
  ['ia', 'IA y modelos', 'fa-brain'],
  ['automatizacion', 'Automatización y mensajería', 'fa-comments'],
  ['infraestructura', 'Infraestructura', 'fa-server'],
];
const FUENTES = { ventas: 'Bot de ventas', tarifario: 'Carga del tarifario', habitaciones: 'Fotos de habitaciones' };
const ERRORES = {
  falta_proveedor: 'Falta el proveedor.', grupo_invalido: 'Elegí un grupo.', monto_invalido: 'El monto tiene que ser mayor a 0.',
  ciclo_invalido: 'Ciclo inválido.', dia_invalido: 'El día de cobro va del 1 al 28.', mes_invalido: 'Un plan anual necesita el mes de cobro.',
  hasta_invalido: 'La fecha de fin es anterior al inicio.', no_encontrada: 'La suscripción ya no existe.',
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function crearCostosDigitales({ sb, esc, ok, error, confirmar, pintarKPIs, hoy, rol = 'admin', raiz }) {
  const admin = rol === 'admin';
  let montado = false, off = 0, datos = null, pedido = 0;
  const $ = sel => raiz.querySelector(sel);
  const usd = n => '$' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mesIso = () => { const [y, m] = hoy().split('-').map(Number), d = new Date(Date.UTC(y, m - 1 + off, 1)); return d.toISOString().slice(0, 10); };
  const mesTxt = iso => { const [y, m] = iso.split('-').map(Number); return `${MESES[m - 1]} ${y}`; };
  const dd = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);

  function css() {
    if (document.getElementById('cd-css')) return;
    const st = document.createElement('style'); st.id = 'cd-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  function marco() {
    raiz.innerHTML = `
      <div class="pvc-cab"><div><h2>Costos digitales</h2>
        <div class="ria-sub">Todo lo que se paga por mes en IA, automatización e infraestructura. Las suscripciones entran solas al Balance como gasto «Software» el día de cobro; el consumo de IA ya se mide por uso.</div></div>
        ${admin ? '<button class="btn-sm lt-primario" type="button" data-cd="nueva"><i class="fas fa-plus"></i> Agregar suscripción</button>' : ''}</div>
      <div class="cd-mes">
        <button class="btn-sm" type="button" data-cd="ant" aria-label="Mes anterior" title="Mes anterior"><i class="fas fa-chevron-left"></i></button>
        <span class="bal-etiqueta" id="cd-etiqueta">—</span>
        <button class="btn-sm" type="button" data-cd="sig" aria-label="Mes siguiente" title="Mes siguiente"><i class="fas fa-chevron-right"></i></button>
      </div>
      <div class="kpis" id="cd-kpis"></div>
      <div class="cd-grid" id="cd-cuerpo"><div class="ria-card"><div class="ria-sub">Cargando...</div></div></div>`;
    raiz.addEventListener('click', clic);
  }

  function clic(e) {
    const b = e.target.closest('[data-cd]');
    if (!b) return;
    const a = b.dataset.cd;
    if (a === 'ant') { off--; cargar(); }
    else if (a === 'sig' && off < 0) { off++; cargar(); }
    else if (a === 'nueva') editar(null);
    else if (a === 'editar') editar((datos?.suscripciones || []).find(s => String(s.id) === b.dataset.id));
  }

  function cobroTxt(s) {
    if (!s.activa) return 'Pausada';
    if (s.cargo) return `<span class="cd-cobrado">Cobrado ${dd(s.cargo.fecha)}</span>`;
    const anual = s.ciclo === 'anual', mes = Number(datos.mes.slice(5, 7));
    if (anual && s.mes_cobro !== mes) return `Se cobra el ${s.dia_cobro} de ${MESES[s.mes_cobro - 1]}`;
    return `Se cobra el día ${s.dia_cobro}`;
  }

  function filaSus(s) {
    const ciclo = s.ciclo === 'anual' ? `Anual ${usd(s.monto_usd)}` : 'Mensual';
    const sub = [s.plan ? esc(s.plan) : '', ciclo, cobroTxt(s)].filter(Boolean).join(' · ');
    const tag = admin ? 'button' : 'div';
    return `<${tag} class="cd-fila${s.vigente ? '' : ' off'}"${admin ? ` type="button" data-cd="editar" data-id="${s.id}" title="Editar"` : ''}>
      <div><span class="cd-prov">${esc(s.proveedor)}</span><small>${sub}</small></div><b>${usd(s.mensual)}</b></${tag}>`;
  }

  function render() {
    const d = datos, t = d.totales || {}, a = d.anterior || {}, total = Number(t.fijo) + Number(t.consumo);
    $('#cd-etiqueta').textContent = mesTxt(d.mes);
    $('[data-cd="sig"]').disabled = off >= 0;
    const dif = total - Number(a.total || 0);
    pintarKPIs($('#cd-kpis'), [
      { t: 'Total del mes', v: usd(total), d: Number(a.total) ? `${dif >= 0 ? '+' : '−'}${usd(Math.abs(dif))} vs ${mesTxt(new Date(Date.UTC(+d.mes.slice(0, 4), +d.mes.slice(5, 7) - 2, 1)).toISOString())}` : 'Suscripciones + consumo de IA', i: 'fa-wallet', c: 'var(--accent)' },
      { t: 'Suscripciones', v: usd(t.fijo), d: `${d.suscripciones.filter(s => s.vigente).length} activas · ${usd(t.cargado)} ya cobrado`, i: 'fa-repeat', c: 'var(--blue)' },
      { t: 'Consumo de IA', v: usd(t.consumo), d: 'Medido por uso (tokens)', i: 'fa-microchip', c: 'var(--amber)' },
    ]);
    const tarjetas = GRUPOS.map(([g, nombre, icono]) => {
      const lista = d.suscripciones.filter(s => s.grupo === g), suma = lista.filter(s => s.vigente).reduce((n, s) => n + Number(s.mensual), 0);
      return `<div class="ria-card"><h2><i class="fas ${icono}"></i> ${nombre}</h2>
        ${lista.length ? lista.map(filaSus).join('') + `<div class="cd-tot"><span>Por mes</span><span>${usd(suma)}</span></div>` : `<div class="cd-vacio">Sin suscripciones cargadas.</div>`}</div>`;
    });
    const cons = d.consumo || [];
    tarjetas.push(`<div class="ria-card"><h2><i class="fas fa-gauge-high"></i> Consumo medido de IA</h2>
      <div class="ria-sub">Lo que se paga por uso (OpenRouter, DeepSeek...). No se carga como suscripción para no contarlo dos veces.</div>
      ${cons.length ? cons.map(c => {
        const [base, sub] = String(c.fuente).split(':');
        const nombre = sub ? `Tareas · ${sub}` : (FUENTES[base] || base);
        return `<div class="cd-fila"><div><span class="cd-prov">${esc(nombre)}</span><small>${[c.modelo, `${Number(c.llamadas || 0).toLocaleString('es-VE')} llamadas`].filter(Boolean).map(esc).join(' · ')}</small></div><b>${usd(c.usd)}</b></div>`;
      }).join('') + `<div class="cd-tot"><span>Total</span><span>${usd(t.consumo)}</span></div>` : '<div class="cd-vacio">Sin consumo registrado este mes.</div>'}</div>`);
    $('#cd-cuerpo').innerHTML = tarjetas.join('');
  }

  async function cargar() {
    if (!montado) { css(); marco(); montado = true; }
    const n = ++pedido, mes = mesIso();
    $('#cd-etiqueta').textContent = mesTxt(mes);
    const { data, error: e } = await sb.rpc('costos_digitales', { p_mes: mes });
    if (n !== pedido) return;
    if (e || !data) { error('No se pudieron cargar los costos digitales'); return; }
    datos = data; render();
  }

  async function editar(s) {
    const f = await confirmar({ titulo: s ? 'Editar suscripción' : 'Agregar suscripción', textoOk: 'Guardar',
      detalle: s ? 'Cambiar el monto no toca los cargos ya cobrados.' : 'Si el día de cobro de este mes ya pasó, el cargo entra hoy al Balance.', campos: [
      { id: 'proveedor', label: 'Proveedor', placeholder: 'Ej: Claude, Zernio, Supabase', valor: s?.proveedor || '', requerido: true },
      { id: 'plan', label: 'Plan', placeholder: 'Ej: Max, Pro, 5 cuentas', valor: s?.plan || '' },
      { id: 'grupo', label: 'Grupo', tipo: 'select', opciones: GRUPOS.map(([v, t]) => ({ v, t })), valor: s?.grupo || 'ia', requerido: true },
      { id: 'monto', label: 'Monto por cobro (USD)', tipo: 'number', step: 0.01, min: 0, valor: s?.monto_usd ?? '', requerido: true },
      { id: 'ciclo', label: 'Ciclo', tipo: 'select', opciones: [{ v: 'mensual', t: 'Mensual' }, { v: 'anual', t: 'Anual' }], valor: s?.ciclo || 'mensual', requerido: true },
      { id: 'dia', label: 'Día de cobro (1 a 28)', tipo: 'number', step: 1, min: 1, max: 28, valor: s?.dia_cobro ?? 1, requerido: true },
      { id: 'mes', label: 'Mes de cobro (solo si es anual)', tipo: 'select', opciones: [{ v: '', t: '—' }, ...MESES.map((m, i) => ({ v: i + 1, t: m }))], valor: s?.mes_cobro ?? '', requeridoSi: o => o.ciclo === 'anual' },
      { id: 'desde', label: 'Desde', tipo: 'date', valor: s?.desde || hoy(), requerido: true },
      { id: 'activa', label: 'Activa (se sigue cobrando)', tipo: 'check', valor: s ? s.activa : true },
      { id: 'notas', label: 'Notas', tipo: 'textarea', valor: s?.notas || '' },
    ] });
    if (!f) return;
    const { data, error: e } = await sb.rpc('guardar_suscripcion', {
      p_proveedor: f.proveedor, p_plan: f.plan || null, p_grupo: f.grupo, p_monto_usd: Number(String(f.monto).replace(',', '.')),
      p_ciclo: f.ciclo, p_dia_cobro: Number(f.dia), p_mes_cobro: f.ciclo === 'anual' ? Number(f.mes) : null,
      p_activa: f.activa, p_desde: f.desde, p_hasta: s?.hasta ?? null, p_notas: f.notas || null, p_id: s?.id ?? null,
    });
    if (e || !data?.ok) { error(ERRORES[data?.error] || 'No se pudo guardar: ' + (e?.message || data?.error || '')); return; }
    ok(data.cargos ? 'Guardada · cargo de este mes enviado al Balance' : 'Suscripción guardada');
    cargar();
  }

  return { cargar };
}
