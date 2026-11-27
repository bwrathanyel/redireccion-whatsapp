// Calculadora de tasas (2026-11-27): dólar BCV, euro BCV y Binance (USDT) en un solo lugar.
// Convertir, comparar tasas y precios, regla de 3, porcentajes e historial. Sin backend propio:
// lee la RPC tasas_del_dia (hoy o una fecha) y la tabla tasas_cambio_historial (todos los roles leen).
const CSS = `
.tc{max-width:1040px}
.tc-head{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 18px;margin:0 0 14px}
.tc-head h2{margin:0;font-size:20px;font-weight:800}
.tc-head p{margin:2px 0 0;font-size:12.5px;color:var(--muted)}
.tc-head>div:first-child{flex:1 1 280px}
.tc-fecha{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
.tc-fecha input{width:auto}
.tc-tasas{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.tc-t{display:flex;flex-direction:column;gap:6px;padding:14px 16px;border:1px solid var(--line2);border-radius:14px;background:var(--panel)}
.tc-t.edit{border-color:var(--amber)}
.tc-t b{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.tc-t .tc-in{display:flex;align-items:center;gap:8px}
.tc-t .tc-in span{font-size:13px;font-weight:700;color:var(--muted)}
.tc-t input{font-size:22px;font-weight:800;padding:6px 10px;min-width:0;width:100%}
.tc-t small{font-size:11.5px;color:var(--muted)}
.tc-t small.ed{color:var(--amber);font-weight:700}
.tc-brechas{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin:12px 0 18px}
.tc-b{padding:10px 12px;border:1px dashed var(--line2);border-radius:11px;font-size:12.5px;line-height:1.45}
.tc-b strong{display:block;font-size:15px}
.tc-b em{font-style:normal;color:var(--muted);font-size:11.5px;display:block;margin-top:2px}
.tc-tabs{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 14px;padding:4px;border:1px solid var(--line2);border-radius:12px;background:var(--panel);width:fit-content;max-width:100%}
.tc-tabs .seg i{margin-right:6px;font-size:12px;opacity:.85}
.tc-card{padding:16px 18px;border:1px solid var(--line2);border-radius:14px;background:var(--panel);margin:0 0 14px}
.tc-card h3{margin:0 0 4px;font-size:15px;font-weight:800}
.tc-card>p{margin:0 0 12px;font-size:12.5px;color:var(--muted);line-height:1.5}
.tc-form{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin:0 0 12px}
.tc-form label{display:flex;flex-direction:column;gap:4px;font-size:11.5px;font-weight:700;color:var(--muted);flex:1 1 150px;min-width:0}
.tc-form .ei{font-size:15px;font-weight:700}
.tc-form .tc-op{flex:0 0 auto;align-self:flex-end;padding-bottom:9px;font-size:18px;font-weight:800;color:var(--muted)}
.tc-fila{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:11px;margin:0 0 8px}
.tc-fila-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.tc-fila-t b{font-size:13px}
.tc-fila-t small{font-size:11.5px;color:var(--muted);overflow-wrap:anywhere}
.tc-fila-v{font-size:19px;font-weight:800;white-space:nowrap;color:var(--accent-ink)}
.tc-tabla{width:100%;overflow-x:auto}
.tc-tabla table{width:100%;border-collapse:collapse;font-size:13px}
.tc-tabla th{padding:7px 10px;text-align:right;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line2);white-space:nowrap}
.tc-tabla td{padding:9px 10px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
.tc-tabla th:first-child,.tc-tabla td:first-child{text-align:left}
.tc-tabla td:first-child{white-space:normal;font-weight:700}
.tc-tabla .bar{display:block;height:5px;border-radius:3px;margin-top:5px;background:var(--accent);opacity:.7}
.tc-mas{color:var(--danger);font-weight:700}.tc-menos{color:var(--green);font-weight:700}.tc-igual{color:var(--muted)}
.tc-resumen{margin:12px 0 0;padding:10px 12px;border-radius:10px;background:var(--accent-soft);color:var(--accent-txt);font-size:13px;line-height:1.5}
.tc-vacio{padding:14px 0;text-align:center;color:var(--muted);font-size:13px}
.tc-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
.tc-chips>span{font-size:11.5px;color:var(--muted);align-self:center}
.tc-pasos{margin:10px 0 0;padding:10px 12px;border:1px dashed var(--line2);border-radius:10px;font-size:12.5px;line-height:1.6;color:var(--muted)}
.tc-pasos b{color:var(--txt)}
.tc-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.tc-pct{display:flex;flex-direction:column;gap:8px}
.tc-pct .tc-form{margin:0}
.tc-pct output{display:block;font-size:17px;font-weight:800;color:var(--accent-ink)}
.tc-pct output small{display:block;font-size:11.5px;font-weight:500;color:var(--muted)}
.tc-graf{width:100%;height:auto;display:block;margin:4px 0 8px}
.tc-leyenda{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--muted)}
.tc-leyenda i{display:inline-block;width:18px;height:3px;border-radius:2px;margin-right:6px;vertical-align:middle}
@media (max-width:560px){.tc-fila{flex-wrap:wrap}.tc-fila-v{font-size:17px}.tc-tabs{width:100%}.tc-tabs .seg{flex:1;padding:8px 6px}.tc-tabs .seg i{display:none}}
`;
const MON = ['USD', 'EUR', 'USDT'];
const NOM = { USD: 'Dólar BCV', EUR: 'Euro BCV', USDT: 'Binance (USDT)', VES: 'Bolívares' };
const EN = { USD: 'En dólares ($)', EUR: 'En euros (€)', USDT: 'En USDT (Binance)' };
const SIMB = { USD: '$', EUR: '€', USDT: 'USDT', VES: 'Bs' };
const TASA_NOM = { USD: 'tasa BCV dólar', EUR: 'tasa euro', USDT: 'tasa Binance' };
const COLOR = { USD: 'var(--blue)', EUR: 'var(--amber)', USDT: 'var(--green)' };
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const f2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f4 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const fN = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 });
const fmt = n => Number.isFinite(n) ? f2.format(n) : '—';
const fmt4 = n => Number.isFinite(n) ? f4.format(n) : '—';
const fmtN = n => Number.isFinite(n) ? fN.format(n) : '—';
const fm = (m, n) => `${SIMB[m]} ${fmt(n)}`;
const pct = n => Number.isFinite(n) ? `${n > 0 ? '+' : ''}${f2.format(n)} %` : '—';
// Acepta «1.234,56», «1234,56» y «1234.56». Con solo puntos, «926.359» son miles; «926.3592» es decimal.
function num(s) {
  s = String(s ?? '').trim().replace(/[^\d.,-]/g, '');
  if (!s || s === '-') return NaN;
  const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
  if (c >= 0 && d >= 0) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (c >= 0) s = (s.match(/,/g) || []).length > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
const hoyCaracas = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
const diasAtras = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const fechaCorta = iso => { const [, m, d] = String(iso).slice(0, 10).split('-'); return `${+d} ${MES[+m - 1] || ''}`; };
const fechaLarga = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${+d} ${MES[+m - 1] || ''} ${y}`; };
const clasePct = n => !Number.isFinite(n) || Math.abs(n) < 0.005 ? 'tc-igual' : n > 0 ? 'tc-mas' : 'tc-menos';

export function crearTasas({ sb, esc, ok, error, raiz }) {
  const T = {
    base: {}, tasas: {}, fechas: {}, historica: false, fecha: '', cargado: false, ts: 0, tab: 'convertir',
    conv: { monto: '100', moneda: 'USD' },
    comp: { modo: 'usd', monto: '100', m1: '100', c1: 'USD', m2: '', c2: 'VES' },
    r3: { tipo: 'directa', a: '1', b: '', c: '100', sembrado: false },
    pct: { a1: '', b1: '', a2: '', b2: '', a3: '', b3: '' },
    dias: 30, hist: {},
  };
  const R = m => num(T.tasas[m]);
  const aBs = (m, monto) => m === 'VES' ? monto : monto * R(m);
  const faltan = () => MON.filter(m => !(R(m) > 0));

  function css() {
    if (document.getElementById('tc-css')) return;
    const st = document.createElement('style'); st.id = 'tc-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const copiar = txt => {
    const listo = () => ok('Copiado: ' + txt);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(listo, () => error('No se pudo copiar'));
    else error('No se pudo copiar');
  };

  async function traerTasas(fecha) {
    const { data, error: e } = await sb.rpc('tasas_del_dia', { p_fecha: fecha || null });
    if (e || !data) { error('No se pudieron cargar las tasas'); return false; }
    T.base = {}; T.tasas = {}; T.fechas = {}; T.historica = false;
    for (const m of MON) {
      const x = data[m]; if (!x) continue;
      T.base[m] = Number(x.tasa); T.tasas[m] = fmt4(Number(x.tasa)); T.fechas[m] = x.fecha;
      if (x.historica) T.historica = true;
    }
    T.fecha = fecha || ''; T.cargado = true; T.ts = Date.now();
    if (T.r3.sembrado) T.r3.b = '';
    T.r3.sembrado = false;
    return true;
  }

  const editada = m => Number.isFinite(T.base[m]) && Math.abs(R(m) - T.base[m]) > 0.0001;
  const hayEdicion = () => MON.some(editada);

  // ---------- Barra superior: tasas editables y brechas ----------
  function tasasHtml() {
    return MON.map(m => {
      const ed = editada(m), f = T.fechas[m];
      const pie = ed ? `<small class="ed">Cambiada a mano (la tasa real es ${fmt4(T.base[m])})</small>`
        : `<small>${m === 'USDT' ? 'Mercado Binance' : 'Oficial BCV'}${f ? ' · ' + esc(fechaLarga(f)) : ''}${T.historica ? ' · día pasado' : ''}</small>`;
      return `<div class="tc-t${ed ? ' edit' : ''}" data-m="${m}"><b>${NOM[m]}</b>
        <div class="tc-in"><span>Bs</span><input class="ei" inputmode="decimal" autocomplete="off" data-tc="tasa" data-m="${m}" value="${esc(T.tasas[m] ?? '')}" aria-label="${NOM[m]} en bolívares"></div>
        ${pie}</div>`;
    }).join('');
  }
  function brechasHtml() {
    if (faltan().length) return '';
    const u = R('USD'), e = R('EUR'), b = R('USDT');
    return `<div class="tc-b"><strong>Binance vs dólar BCV: <span class="${clasePct((b / u - 1) * 100)}">${pct((b / u - 1) * 100)}</span></strong>
        1 USDT cuesta Bs ${fmt(b - u)} ${b >= u ? 'más' : 'menos'} que 1 $ BCV.<em>Es la «brecha»: qué tan por encima del oficial está el mercado.</em></div>
      <div class="tc-b"><strong>Euro vs dólar BCV: <span class="${clasePct((e / u - 1) * 100)}">${pct((e / u - 1) * 100)}</span></strong>
        1 € = $ ${fmt4(e / u)} (euro BCV ÷ dólar BCV).<em>Cuánto vale un euro en dólares según el BCV.</em></div>
      <div class="tc-b"><strong>Binance vs euro BCV: <span class="${clasePct((b / e - 1) * 100)}">${pct((b / e - 1) * 100)}</span></strong>
        1 USDT cuesta Bs ${fmt(b - e)} ${b >= e ? 'más' : 'menos'} que 1 €.<em>Útil cuando el precio se cobra «a tasa euro».</em></div>`;
  }
  function pintarTasas() {
    raiz.querySelector('#tc-tasas').innerHTML = tasasHtml();
    pintarBrechas();
    raiz.querySelector('#tc-reset').hidden = !hayEdicion();
  }
  const pintarBrechas = () => { raiz.querySelector('#tc-brechas').innerHTML = brechasHtml(); };

  // ---------- Pestañas ----------
  const TABS = [['convertir', 'fa-right-left', 'Convertir'], ['comparar', 'fa-scale-balanced', 'Comparar'], ['regla3', 'fa-equals', 'Regla de 3'], ['historial', 'fa-chart-line', 'Historial']];
  const monedasOpc = (sel, conBs = true) => [...MON, ...(conBs ? ['VES'] : [])].map(m => `<option value="${m}"${m === sel ? ' selected' : ''}>${NOM[m]}${m === 'USD' ? ' ($)' : m === 'EUR' ? ' (€)' : m === 'VES' ? ' (Bs)' : ''}</option>`).join('');

  function panelConvertir() {
    return `<div class="tc-card"><h3>¿Cuánto es en las otras monedas?</h3>
      <p>Escribe un monto, elige en qué moneda está y mira al instante cuánto equivale en cada una, usando las tasas de arriba.</p>
      <div class="tc-form">
        <label>Monto<input class="ei" inputmode="decimal" autocomplete="off" data-tc="f" data-g="conv" data-k="monto" value="${esc(T.conv.monto)}" placeholder="Ej: 250"></label>
        <label>Moneda<select class="ei" data-tc="f" data-g="conv" data-k="moneda">${monedasOpc(T.conv.moneda)}</select></label>
      </div><div id="tc-res"></div></div>`;
  }
  function resConvertir() {
    const { monto, moneda } = T.conv, amt = num(monto);
    if (!(amt >= 0)) return `<div class="tc-vacio">Escribe un monto para ver las equivalencias.</div>`;
    const faltante = moneda === 'VES' ? faltan() : faltan().filter(m => m === moneda);
    if (moneda !== 'VES' && faltante.length) return `<div class="tc-vacio">Falta la tasa de ${NOM[moneda]}.</div>`;
    const bs = aBs(moneda, amt), filas = [];
    const copia = (m, v) => `${fmt(v)} ${m === 'VES' ? 'Bs' : SIMB[m]}`;
    if (moneda !== 'VES') filas.push(fila('En bolívares', fm('VES', bs), `${fmtN(amt)} ${SIMB[moneda]} × ${fmt4(R(moneda))} (${TASA_NOM[moneda]})`, copia('VES', bs)));
    for (const m of MON) {
      if (m === moneda || !(R(m) > 0)) continue;
      const v = bs / R(m);
      filas.push(fila(EN[m], fm(m, v), moneda === 'VES' ? `Bs ${fmt(bs)} ÷ ${fmt4(R(m))} (${TASA_NOM[m]})` : `Bs ${fmt(bs)} ÷ ${fmt4(R(m))} (${TASA_NOM[m]}): pasa por bolívares`, copia(m, v)));
    }
    return filas.join('');
  }
  const fila = (et, valor, formula, txt) => `<div class="tc-fila"><div class="tc-fila-t"><b>${esc(et)}</b><small>${esc(formula)}</small></div>
    <div class="tc-fila-v">${esc(valor)}</div><button class="btn-sm" type="button" data-tc="copiar" data-v="${esc(txt)}" title="Copiar" aria-label="Copiar ${esc(valor)}"><i class="far fa-copy"></i></button></div>`;

  function panelComparar() {
    const c = T.comp, usd = c.modo === 'usd';
    return `<div class="tc-card"><h3>Un mismo monto, según cada tasa</h3>
      <p>El mismo precio cambia según la tasa con la que se cobre. Aquí ves cuánto cambia y qué diferencia hay contra el dólar BCV.</p>
      <div class="tc-chips"><button class="btn-sm${usd ? ' lt-primario' : ''}" type="button" data-tc="modo" data-v="usd">Tengo un precio en $ → ver Bs</button>
        <button class="btn-sm${usd ? '' : ' lt-primario'}" type="button" data-tc="modo" data-v="bs">Tengo Bs → ver cuántos $</button></div>
      <div class="tc-form"><label>${usd ? 'Precio en dólares ($)' : 'Monto en bolívares (Bs)'}<input class="ei" inputmode="decimal" autocomplete="off" data-tc="f" data-g="comp" data-k="monto" value="${esc(c.monto)}" placeholder="Ej: 100"></label></div>
      <div id="tc-res"></div></div>
      <div class="tc-card"><h3>¿Cuál de dos precios conviene?</h3>
      <p>Pon dos precios, cada uno en su moneda (por ejemplo $100 en divisa contra Bs 95.000). Los pasamos a lo mismo para que se puedan comparar.</p>
      <div class="tc-form">
        <label>Precio A<input class="ei" inputmode="decimal" autocomplete="off" data-tc="f" data-g="comp" data-k="m1" value="${esc(c.m1)}"></label>
        <label>Moneda A<select class="ei" data-tc="f" data-g="comp" data-k="c1">${monedasOpc(c.c1)}</select></label>
        <span class="tc-op">vs</span>
        <label>Precio B<input class="ei" inputmode="decimal" autocomplete="off" data-tc="f" data-g="comp" data-k="m2" value="${esc(c.m2)}" placeholder="Ej: 95.000"></label>
        <label>Moneda B<select class="ei" data-tc="f" data-g="comp" data-k="c2">${monedasOpc(c.c2)}</select></label>
      </div><div id="tc-res2"></div></div>`;
  }
  function resComparar() {
    const c = T.comp, amt = num(c.monto), usd = c.modo === 'usd';
    if (!(amt >= 0)) return `<div class="tc-vacio">Escribe un monto para comparar.</div>`;
    if (faltan().length) return `<div class="tc-vacio">Falta alguna tasa arriba.</div>`;
    const filas = MON.map(m => ({ m, tasa: R(m), v: usd ? amt * R(m) : amt / R(m) }));
    const ref = filas[0].v, max = Math.max(...filas.map(x => x.v)) || 1;
    const cuerpo = filas.map(x => {
      const dif = x.v - ref, p = ref ? (x.v / ref - 1) * 100 : NaN;
      const sd = usd ? (dif >= 0 ? '+' : '−') : (dif > 0 ? '+' : dif < 0 ? '−' : '');
      return `<tr><td>${NOM[x.m]}<span class="bar" style="width:${Math.max(4, (x.v / max) * 100).toFixed(1)}%"></span></td><td>${fmt4(x.tasa)}</td>
        <td><b>${usd ? fm('VES', x.v) : fm('USD', x.v)}</b></td>
        <td class="${x.m === 'USD' ? 'tc-igual' : usd ? clasePct(p) : clasePct(-p)}">${x.m === 'USD' ? 'Base' : `${sd}${usd ? 'Bs ' : '$ '}${fmt(Math.abs(dif))} (${pct(p)})`}</td></tr>`;
    }).join('');
    const ord = [...filas].sort((a, b) => a.v - b.v), lo = ord[0], hi = ord[2], d = hi.v - lo.v, p = lo.v ? (hi.v / lo.v - 1) * 100 : NaN;
    const resumen = usd
      ? `Pagar a <b>${TASA_NOM[hi.m]}</b> cuesta <b>Bs ${fmt(d)}</b> más (${pct(p)}) que a <b>${TASA_NOM[lo.m]}</b>. Para el cliente conviene la más baja; para la agencia, la más alta.`
      : `Con Bs ${fmt(amt)} el cliente cubre <b>$ ${fmt(hi.v)}</b> a <b>${TASA_NOM[hi.m]}</b> y solo <b>$ ${fmt(lo.v)}</b> a <b>${TASA_NOM[lo.m]}</b>: <b>$ ${fmt(d)}</b> de diferencia (${f2.format(p)} % más a favor de la tasa más baja).`;
    return `<div class="tc-tabla"><table><thead><tr><th>Tasa</th><th>Bs por 1</th><th>${usd ? `Precio en Bs` : `Equivale a`}</th><th>Contra dólar BCV</th></tr></thead><tbody>${cuerpo}</tbody></table></div>
      <div class="tc-resumen">${resumen}</div>`;
  }
  function resDosPrecios() {
    const c = T.comp, a = num(c.m1), b = num(c.m2);
    if (!(a >= 0) || !(b >= 0)) return `<div class="tc-vacio">Escribe los dos precios.</div>`;
    if ([c.c1, c.c2].some(m => m !== 'VES' && !(R(m) > 0))) return `<div class="tc-vacio">Falta la tasa de una de las monedas.</div>`;
    const bsA = aBs(c.c1, a), bsB = aBs(c.c2, b);
    const sub = bs => R('USD') > 0 ? `≈ $ ${fmt(bs / R('USD'))} a dólar BCV` : '';
    const caja = (et, m, v, bs) => `<div class="tc-fila"><div class="tc-fila-t"><b>${et}: ${fm(m, v)}</b><small>${m === 'VES' ? '' : `${fmtN(v)} ${SIMB[m]} × ${fmt4(R(m))} (${TASA_NOM[m]})`}</small></div><div class="tc-fila-v">Bs ${fmt(bs)}</div></div>
      <div class="tc-vacio" style="padding:0 0 8px;margin-top:-4px;text-align:right;font-size:11.5px">${sub(bs)}</div>`;
    const d = Math.abs(bsA - bsB), base = Math.min(bsA, bsB), p = base ? d / base * 100 : NaN;
    const veredicto = d < 0.005 ? 'Los dos precios son prácticamente iguales.'
      : `<b>El precio ${bsA < bsB ? 'A' : 'B'} es más barato</b> por Bs ${fmt(d)}: el otro cuesta ${f2.format(p)} % más.`;
    return caja('Precio A', c.c1, a, bsA) + caja('Precio B', c.c2, b, bsB) + `<div class="tc-resumen">${veredicto}</div>`;
  }

  function panelRegla3() {
    const r = T.r3, dir = r.tipo === 'directa';
    if (!r.sembrado && !r.b && R('USD') > 0) { r.a = '1'; r.b = fmt4(R('USD')); r.sembrado = true; }
    const chips = MON.map(m => `<button class="btn-sm" type="button" data-tc="semilla" data-m="${m}">1 ${SIMB[m]} = Bs ${esc(T.tasas[m] ?? '?')}</button>`).join('');
    return `<div class="tc-card"><h3>Regla de 3</h3>
      <p>Si ya sabes cuánto equivale una cantidad, saca cuánto equivale otra. Llena las tres casillas y la cuarta se calcula sola.</p>
      <div class="tc-chips"><button class="btn-sm${dir ? ' lt-primario' : ''}" type="button" data-tc="tipo" data-v="directa">Directa: más de uno, más del otro</button>
        <button class="btn-sm${dir ? '' : ' lt-primario'}" type="button" data-tc="tipo" data-v="inversa">Inversa: más de uno, menos del otro</button></div>
      <div class="tc-chips"><span>Cargar una tasa de ejemplo:</span>${chips}</div>
      <div class="tc-form">
        <label>Si esto (A)<input class="ei" inputmode="decimal" autocomplete="off" data-tc="f" data-g="r3" data-k="a" value="${esc(r.a)}"></label>
        <span class="tc-op">${dir ? '→' : '⇄'}</span>
        <label>equivale a esto (B)<input class="ei" inputmode="decimal" autocomplete="off" data-tc="f" data-g="r3" data-k="b" value="${esc(r.b)}"></label>
      </div>
      <div class="tc-form">
        <label>entonces esto (C)<input class="ei" inputmode="decimal" autocomplete="off" data-tc="f" data-g="r3" data-k="c" value="${esc(r.c)}"></label>
        <span class="tc-op">${dir ? '→' : '⇄'}</span>
        <label>equivale a (X, el resultado)<input class="ei" id="tc-x" readonly style="background:var(--accent-soft)"></label>
      </div><div id="tc-res"></div></div>
      <div class="tc-card"><h3>Porcentajes</h3><p>Tres cuentas de porcentaje que se usan todos los días.</p>
      <div class="tc-grid2">
        <div class="tc-pct"><b>¿Cuánto es el __ % de __?</b><div class="tc-form"><label>Porcentaje (%)<input class="ei" inputmode="decimal" autocomplete="off" data-tc="f" data-g="pct" data-k="a1" value="${esc(T.pct.a1)}" placeholder="Ej: 10"></label><label>De este monto<input class="ei" inputmode="decimal" autocomplete="off" data-tc="f" data-g="pct" data-k="b1" value="${esc(T.pct.b1)}" placeholder="Ej: 350"></label></div><output id="tc-p1"></output></div>
        <div class="tc-pct"><b>¿Qué porcentaje es __ de __?</b><div class="tc-form"><label>Esta parte<input class="ei" inputmode="decimal" autocomplete="off" data-tc="f" data-g="pct" data-k="a2" value="${esc(T.pct.a2)}" placeholder="Ej: 35"></label><label>Del total<input class="ei" inputmode="decimal" autocomplete="off" data-tc="f" data-g="pct" data-k="b2" value="${esc(T.pct.b2)}" placeholder="Ej: 350"></label></div><output id="tc-p2"></output></div>
        <div class="tc-pct"><b>Subir o bajar un monto un __ %</b><div class="tc-form"><label>Monto<input class="ei" inputmode="decimal" autocomplete="off" data-tc="f" data-g="pct" data-k="a3" value="${esc(T.pct.a3)}" placeholder="Ej: 350"></label><label>Porcentaje (%)<input class="ei" inputmode="decimal" autocomplete="off" data-tc="f" data-g="pct" data-k="b3" value="${esc(T.pct.b3)}" placeholder="Ej: 10"></label></div><output id="tc-p3"></output></div>
      </div></div>`;
  }
  function resRegla3() {
    const r = T.r3, a = num(r.a), b = num(r.b), c = num(r.c), dir = r.tipo === 'directa', x = raiz.querySelector('#tc-x');
    const ok3 = [a, b, c].every(Number.isFinite) && a !== 0 && (dir || c !== 0);
    if (!ok3) { if (x) x.value = ''; return `<div class="tc-vacio">Llena A, B y C (A${dir ? '' : ' y C'} no pueden ser 0).</div>`; }
    const v = dir ? b * c / a : a * b / c;
    if (x) x.value = fmtN(Math.round(v * 1e6) / 1e6);
    const pasos = dir
      ? `Si <b>${fmtN(a)}</b> equivale a <b>${fmtN(b)}</b>, entonces <b>${fmtN(c)}</b> equivale a:<br>X = B × C ÷ A = ${fmtN(b)} × ${fmtN(c)} ÷ ${fmtN(a)} = <b>${fmt(v)}</b>`
      : `Si <b>${fmtN(a)}</b> con <b>${fmtN(b)}</b> alcanza, con <b>${fmtN(c)}</b> alcanza:<br>X = A × B ÷ C = ${fmtN(a)} × ${fmtN(b)} ÷ ${fmtN(c)} = <b>${fmt(v)}</b>`;
    return `${fila('Resultado (X)', fmt(v), `${dir ? 'B × C ÷ A' : 'A × B ÷ C'}, redondeado a 2 decimales`, fmt(v))}<div class="tc-pasos">${pasos}</div>`;
  }
  function resPct() {
    const p = T.pct, set = (id, html) => { const o = raiz.querySelector(id); if (o) o.innerHTML = html; };
    const a1 = num(p.a1), b1 = num(p.b1), a2 = num(p.a2), b2 = num(p.b2), a3 = num(p.a3), b3 = num(p.b3);
    set('#tc-p1', Number.isFinite(a1) && Number.isFinite(b1) ? `${fmt(a1 * b1 / 100)}<small>${fmtN(a1)} % de ${fmtN(b1)}</small>` : '');
    set('#tc-p2', Number.isFinite(a2) && Number.isFinite(b2) && b2 !== 0 ? `${fmt(a2 / b2 * 100)} %<small>${fmtN(a2)} es el ${fmt(a2 / b2 * 100)} % de ${fmtN(b2)}</small>` : '');
    set('#tc-p3', Number.isFinite(a3) && Number.isFinite(b3) ? `Subiendo: ${fmt(a3 * (1 + b3 / 100))}<small>Bajando: ${fmt(a3 * (1 - b3 / 100))} · la diferencia es ${fmt(a3 * b3 / 100)}</small>` : '');
  }

  // ---------- Historial ----------
  function panelHistorial() {
    return `<div class="tc-card"><h3>Cómo se han movido las tasas</h3><p>Tasa de cada día, con la brecha de Binance contra el dólar BCV. Útil para explicarle al cliente por qué un precio cambió.</p>
      <div class="tc-chips">${[7, 14, 30, 90].map(n => `<button class="btn-sm${T.dias === n ? ' lt-primario' : ''}" type="button" data-tc="dias" data-v="${n}">${n} días</button>`).join('')}</div>
      <div id="tc-res"><div class="tc-vacio">Cargando…</div></div></div>`;
  }
  async function resHistorial() {
    const cont = raiz.querySelector('#tc-res'), n = T.dias;
    if (!T.hist[n]) {
      const desde = diasAtras(T.fecha || hoyCaracas(), n), hasta = T.fecha || hoyCaracas();
      const { data, error: e } = await sb.from('tasas_cambio_historial').select('moneda,fecha,tasa').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false });
      if (e) { if (cont && T.tab === 'historial' && T.dias === n) cont.innerHTML = `<div class="tc-vacio">No se pudo cargar el historial.</div>`; return; }
      T.hist[n] = data || [];
    }
    if (T.tab !== 'historial' || T.dias !== n || !cont) return;
    const dias = {};
    for (const r of T.hist[n]) (dias[r.fecha] ||= {})[r.moneda] = Number(r.tasa);
    const fechas = Object.keys(dias).sort();
    if (!fechas.length) { cont.innerHTML = `<div class="tc-vacio">Sin datos en este rango.</div>`; return; }
    const primero = m => { const f = fechas.find(x => dias[x][m] > 0); return f ? dias[f][m] : null; };
    const ultimo = m => { const f = [...fechas].reverse().find(x => dias[x][m] > 0); return f ? dias[f][m] : null; };
    const resumen = MON.map(m => { const a = primero(m), b = ultimo(m); return a && b && a !== b ? `${NOM[m]}: <b class="${clasePct(b / a - 1)}">${pct((b / a - 1) * 100)}</b>` : a ? `${NOM[m]}: <b>sin cambio</b>` : ''; }).filter(Boolean).join(' · ');
    const filas = [...fechas].reverse().map(f => {
      const d = dias[f], br = d.USD && d.USDT ? (d.USDT / d.USD - 1) * 100 : NaN;
      return `<tr><td>${esc(fechaLarga(f))}</td>${MON.map(m => `<td>${d[m] ? fmt4(d[m]) : '—'}</td>`).join('')}<td class="${clasePct(br)}">${pct(br)}</td></tr>`;
    }).join('');
    cont.innerHTML = `${grafico(dias, fechas)}${resumen ? `<div class="tc-resumen">En ${n} días: ${resumen}</div>` : ''}
      <div class="tc-tabla" style="margin-top:12px;max-height:360px;overflow:auto"><table><thead><tr><th>Día</th>${MON.map(m => `<th>${NOM[m]}</th>`).join('')}<th>Binance vs BCV</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  }
  function grafico(dias, fechas) {
    const W = 640, H = 220, L = 56, Rr = 12, Tp = 12, B = 26;
    const t0 = Date.parse(fechas[0] + 'T12:00:00Z'), t1 = Date.parse(fechas[fechas.length - 1] + 'T12:00:00Z'), span = Math.max(1, t1 - t0);
    const vals = fechas.flatMap(f => MON.map(m => dias[f][m]).filter(v => v > 0));
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo || hi * 0.02) * 0.1; lo -= pad; hi += pad;
    const X = f => L + (Date.parse(f + 'T12:00:00Z') - t0) / span * (W - L - Rr), Y = v => Tp + (1 - (v - lo) / (hi - lo)) * (H - Tp - B);
    const lineas = MON.map(m => {
      const pts = fechas.filter(f => dias[f][m] > 0).map(f => `${X(f).toFixed(1)},${Y(dias[f][m]).toFixed(1)}`);
      return pts.length > 1 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="${COLOR[m]}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>` : '';
    }).join('');
    const ejeY = [0, 0.5, 1].map(k => { const v = lo + (hi - lo) * k, y = Y(v); return `<line x1="${L}" x2="${W - Rr}" y1="${y}" y2="${y}" stroke="var(--line2)" stroke-dasharray="3 4"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmtN(Math.round(v))}</text>`; }).join('');
    return `<svg class="tc-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de tasas en bolívares">${ejeY}${lineas}
      <text x="${L}" y="${H - 6}" font-size="11" fill="var(--muted)">${esc(fechaCorta(fechas[0]))}</text>
      <text x="${W - Rr}" y="${H - 6}" text-anchor="end" font-size="11" fill="var(--muted)">${esc(fechaCorta(fechas[fechas.length - 1]))}</text></svg>
      <div class="tc-leyenda">${MON.map(m => `<span><i style="background:${COLOR[m]}"></i>${NOM[m]}</span>`).join('')}</div>`;
  }

  // ---------- Render ----------
  function resultados() {
    const set = (id, html) => { const o = raiz.querySelector(id); if (o) o.innerHTML = html; };
    if (T.tab === 'convertir') set('#tc-res', resConvertir());
    else if (T.tab === 'comparar') { set('#tc-res', resComparar()); set('#tc-res2', resDosPrecios()); }
    else if (T.tab === 'regla3') { set('#tc-res', resRegla3()); resPct(); }
    else resHistorial();
  }
  function pintarPanel() {
    raiz.querySelector('.tc-tabs').innerHTML = TABS.map(([k, i, t]) => `<button class="seg${T.tab === k ? ' on' : ''}" type="button" data-tc="tab" data-v="${k}"><i class="fas ${i}"></i>${t}</button>`).join('');
    raiz.querySelector('#tc-panel').innerHTML = ({ convertir: panelConvertir, comparar: panelComparar, regla3: panelRegla3, historial: panelHistorial })[T.tab]();
    resultados();
  }
  function armar() {
    css();
    raiz.innerHTML = `<div class="tc">
      <div class="tc-head"><div><h2>Calculadora de tasas</h2><p>Dólar BCV, euro BCV y Binance. Cambia una tasa si necesitas otra y todo se recalcula.</p></div>
        <label class="tc-fecha"><span>Tasas del día</span><input class="ei" type="date" id="tc-fecha" max="${hoyCaracas()}" value="${esc(T.fecha || hoyCaracas())}"></label>
        <button class="btn-sm" type="button" id="tc-reset" data-tc="reset" hidden><i class="fas fa-rotate-left"></i> Volver a las tasas reales</button></div>
      <div class="tc-tasas" id="tc-tasas"></div><div class="tc-brechas" id="tc-brechas"></div>
      <div class="tc-tabs"></div><div id="tc-panel"></div></div>`;
    if (!raiz.dataset.tcListo) {
      raiz.dataset.tcListo = '1';
      raiz.addEventListener('input', alEscribir);
      raiz.addEventListener('change', alCambiar);
      raiz.addEventListener('click', alClick);
    }
    pintarTasas(); pintarPanel();
  }

  function alEscribir(e) {
    const el = e.target, t = el.dataset.tc;
    if (t === 'tasa') {
      T.tasas[el.dataset.m] = el.value;
      const ed = editada(el.dataset.m), caja = el.closest('.tc-t');
      caja.classList.toggle('edit', ed);
      caja.querySelector('small').className = ed ? 'ed' : '';
      caja.querySelector('small').textContent = ed ? `Cambiada a mano (la tasa real es ${fmt4(T.base[el.dataset.m])})` : 'Tasa real';
      raiz.querySelector('#tc-reset').hidden = !hayEdicion();
      pintarBrechas(); resultados();
    } else if (t === 'f' && el.tagName === 'INPUT') { T[el.dataset.g][el.dataset.k] = el.value; resultados(); }
  }
  function alCambiar(e) {
    const el = e.target;
    if (el.id === 'tc-fecha') { recargar(el.value && el.value < hoyCaracas() ? el.value : ''); return; }
    if (el.dataset.tc === 'f' && el.tagName === 'SELECT') { T[el.dataset.g][el.dataset.k] = el.value; resultados(); }
  }
  async function alClick(e) {
    const b = e.target.closest('[data-tc]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
    const t = b.dataset.tc, v = b.dataset.v;
    if (t === 'tab') { T.tab = v; pintarPanel(); }
    else if (t === 'copiar') copiar(b.dataset.v);
    else if (t === 'modo') { T.comp.modo = v; pintarPanel(); }
    else if (t === 'tipo') { T.r3.tipo = v; pintarPanel(); }
    else if (t === 'dias') { T.dias = +v; pintarPanel(); }
    else if (t === 'semilla') { T.r3.a = '1'; T.r3.b = T.tasas[b.dataset.m] ?? ''; T.r3.sembrado = true; pintarPanel(); }
    else if (t === 'reset') { for (const m of MON) T.tasas[m] = fmt4(T.base[m]); pintarTasas(); resultados(); }
  }
  async function recargar(fecha) {
    if (!await traerTasas(fecha)) return;
    T.hist = {}; pintarTasas();
    const inp = raiz.querySelector('#tc-fecha'); if (inp) inp.value = fecha || hoyCaracas();
    pintarPanel();
  }

  async function cargar() {
    if (!raiz) return;
    if (!raiz.firstChild) raiz.innerHTML = '<div class="tc-vacio">Cargando tasas…</div>';
    const viejo = Date.now() - T.ts > 5 * 60 * 1000;
    if (!T.cargado || (viejo && !hayEdicion())) { if (!await traerTasas(T.fecha)) return; T.hist = {}; }
    armar();
  }
  return { cargar };
}
