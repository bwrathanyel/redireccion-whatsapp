// Finanzas > Pagos: panel del banco Wells Fargo (avisos de Zelle por correo).
// RPC finanzas_banco_panel (admin y administrativo); «Deshacer» de Lyra solo admin
// (finanzas_abono_deshacer_lyra). Spec: docs/superpowers/specs/2026-11-15-wells-fargo-correos-lyra-design.md
const CSS = `
.fb-cab{display:flex;align-items:flex-start;justify-content:space-between;gap:11px;flex-wrap:wrap}
.fb-cab h2{margin:0}
.fb-tabs{margin:14px 0 11px}
.fb-tabs .seg-n{margin-left:4px;font-size:10.5px;font-weight:800;color:var(--amber)}
.fb-scroll{overflow-x:auto}
.fb-tabla tbody tr{cursor:default}
.fb-tabla td.num,.fb-tabla th.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.fb-tabla td small{display:block;font-size:11px;color:var(--muted);margin-top:2px}
.fb-ref{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;user-select:all;word-break:break-all}
.fb-in{color:var(--green);font-weight:700}
.fb-out{color:var(--danger);font-weight:700}
.fb-alerta{color:var(--amber);font-weight:700}
.fb-ok{color:var(--muted)}
.fb-estado{display:inline-flex;align-items:center;min-height:22px;padding:0 9px;border-radius:999px;border:1px solid var(--line2);font-size:11px;font-weight:700;color:var(--muted);white-space:nowrap}
.fb-estado.cruzado,.fb-estado.verificado{color:var(--green);border-color:var(--green)}
.fb-estado.problema{color:var(--amber);border-color:var(--amber)}
.fb-vacio{padding:22px 0;text-align:center;color:var(--muted);font-size:12px}
.fb-nota{font-size:12px;color:var(--muted);margin:0 0 11px}
`;
const TABS = [['lyra', 'Lyra', 'fa-robot'], ['dias', 'Saldo diario', 'fa-scale-balanced'], ['movs', 'Movimientos', 'fa-building-columns']];
const ERRORES = { abono_no_encontrado: 'El abono ya no existe.', no_verificado_por_lyra: 'Ese abono no lo verificó Lyra.' };

export function crearFinanzasBanco({ sb, esc, ok, error, confirmar, rol, raiz, alCambiar }) {
  const admin = rol === 'admin';
  let datos = null, tab = 'lyra', pedido = 0;
  try { tab = localStorage.getItem('fb_tab') || 'lyra'; } catch {}
  const usd = n => '$' + Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dia = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
  const hora = iso => iso ? new Date(iso).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' }) : '—';

  if (!document.getElementById('fb-css')) {
    const st = document.createElement('style'); st.id = 'fb-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  raiz.addEventListener('click', e => {
    const t = e.target.closest('[data-fb-tab]');
    if (t) { tab = t.dataset.fbTab; try { localStorage.setItem('fb_tab', tab); } catch {} return pintar(); }
    const d = e.target.closest('[data-fb-deshacer]');
    if (d) deshacer(Number(d.dataset.fbDeshacer), d);
  });

  // Problema que dejó Lyra por abono (lo muestra la tarjeta de «Por verificar»).
  const problemas = () => new Map((datos?.lyra || []).filter(a => a.estado === 'por_verificar' && a.problema).map(a => [a.abono_id, a.problema]));

  async function cargar() {
    const n = ++pedido;
    const { data, error: e } = await sb.rpc('finanzas_banco_panel', { p_dias: 30 });
    if (n !== pedido) return datos;
    // PGRST202: CRM publicado antes de la migración. El panel no se muestra y Pagos sigue igual.
    if (e) { if (e.code !== 'PGRST202') console.warn('finanzas_banco_panel', e.message); raiz.hidden = true; return datos; }
    datos = data || {};
    raiz.hidden = false;
    pintar();
    return datos;
  }

  function pintar() {
    if (!datos) return;
    const lyra = datos.lyra || [], dias = datos.dias || [], movs = datos.movimientos || [];
    const nProb = lyra.filter(a => a.estado === 'por_verificar').length;
    const nDias = dias.filter(d => Math.abs(Number(d.sin_aviso)) >= 0.01).length;
    const cuenta = movs.find(m => m.cuenta)?.cuenta || dias.find(d => d.cuenta)?.cuenta || 'Wells Fargo';
    if (!TABS.some(([k]) => k === tab)) tab = 'lyra';
    const n = { lyra: nProb, dias: nDias, movs: 0 };
    raiz.innerHTML = `
      <div class="fb-cab"><div><h2><i class="fas fa-building-columns"></i> Banco · ${esc(cuenta)}</h2>
        <div class="csub">Lo que avisa Wells Fargo por correo (solo Zelle). Lyra verifica sola los abonos que calzan con un Zelle recibido y avisa a los admin por Telegram cuando algo no cuadra. Últimos 30 días.</div></div></div>
      <div class="seg-group fb-tabs" role="tablist">${TABS.map(([k, t, ic]) => `
        <button class="seg${k === tab ? ' on' : ''}" type="button" role="tab" aria-selected="${k === tab}" data-fb-tab="${k}"><i class="fas ${ic}"></i> ${t}${n[k] ? `<span class="seg-n">${n[k]}</span>` : ''}</button>`).join('')}</div>
      <div class="fb-scroll">${tab === 'lyra' ? tablaLyra(lyra) : tab === 'dias' ? tablaDias(dias) : tablaMovs(movs)}</div>`;
  }

  function tablaLyra(filas) {
    if (!filas.length) return '<div class="fb-vacio">Lyra todavía no revisó abonos de Wells Fargo en estos días.</div>';
    return `<table class="fb-tabla"><thead><tr><th>Reserva</th><th class="num">Monto</th><th>Zelle del banco</th><th>Resultado</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>${filas.map(a => {
      const verificado = a.verificado_auto && a.estado === 'verificado';
      return `<tr>
        <td><b>${esc(a.reserva_codigo || '—')}</b><small>${esc(a.asesor || 'Sin asesor')} · ${esc(a.metodo || '')}</small></td>
        <td class="num">${usd(a.monto)}</td>
        <td>${a.referencia_banco ? `${esc(a.contraparte || '—')}<small><span class="fb-ref">${esc(a.referencia_banco)}</span> · ${dia(a.fecha_banco)}</small>` : '<span class="fb-ok">—</span>'}</td>
        <td>${verificado ? `<span class="fb-estado verificado">Verificado por Lyra</span><small>${hora(a.verificado_en)}</small>`
          : a.estado === 'por_verificar' ? `<span class="fb-estado problema">Por verificar</span><small>${esc(a.problema || '')}</small>`
          : `<span class="fb-estado">${esc(a.estado || '')}</span>`}</td>
        ${admin ? `<td>${verificado ? `<button type="button" class="inbox-btn" data-fb-deshacer="${a.abono_id}" title="Vuelve el abono a «Por verificar» para revisarlo a mano"><i class="fas fa-rotate-left"></i> Deshacer</button>` : ''}</td>` : ''}
      </tr>`; }).join('')}</tbody></table>`;
  }

  function tablaDias(filas) {
    if (!filas.length) return '<div class="fb-vacio">Sin resúmenes de saldo en estos días.</div>';
    return `<p class="fb-nota">Cada mañana Wells Fargo manda el saldo de cierre del día anterior. «Sin aviso» es lo que se movió y no vino en ningún Zelle (tarjeta, depósitos, comisiones, transferencias): hay que cargarlo a mano.</p>
      <table class="fb-tabla"><thead><tr><th>Fecha</th><th class="num">Saldo</th><th class="num">Variación</th><th class="num">Zelle neto</th><th class="num">Sin aviso</th></tr></thead><tbody>${filas.map(d => {
        const sin = Number(d.sin_aviso || 0), alerta = Math.abs(sin) >= 0.01;
        return `<tr><td>${dia(d.fecha)}</td><td class="num">${usd(d.saldo)}</td><td class="num">${usd(d.variacion)}</td><td class="num">${usd(d.avisos_neto)}</td>
          <td class="num ${alerta ? 'fb-alerta' : 'fb-ok'}">${alerta ? usd(sin) : 'cuadra'}</td></tr>`; }).join('')}</tbody></table>`;
  }

  function tablaMovs(filas) {
    if (!filas.length) return '<div class="fb-vacio">Sin movimientos en estos días.</div>';
    return `<table class="fb-tabla"><thead><tr><th>Fecha</th><th class="num">Monto</th><th>Contraparte</th><th>Confirmación</th><th>Estado</th></tr></thead><tbody>${filas.map(m => {
      const entra = m.direccion === 'entrada';
      return `<tr><td>${dia(m.fecha)}<small>${esc(m.tipo === 'deposito' ? 'Depósito' : 'Zelle')}</small></td>
        <td class="num ${entra ? 'fb-in' : 'fb-out'}">${entra ? '+' : '−'}${usd(m.monto)}</td>
        <td>${esc(m.contraparte || '—')}${m.nota ? `<small>${esc(m.nota)}</small>` : ''}</td>
        <td><span class="fb-ref">${esc(m.referencia || '—')}</span></td>
        <td>${m.estado === 'cruzado' ? `<span class="fb-estado cruzado">${esc(m.reserva_codigo || 'Cruzado')}</span>`
          : m.estado === 'no_parseado' ? '<span class="fb-estado problema">No se pudo leer</span>'
          : `<span class="fb-estado">${entra ? 'Sin abono' : 'Salida'}</span>`}</td></tr>`; }).join('')}</tbody></table>`;
  }

  async function deshacer(abonoId, btn) {
    const a = (datos?.lyra || []).find(x => x.abono_id === abonoId);
    if (!a) return;
    const si = await confirmar({ titulo: 'Deshacer verificación de Lyra', textoOk: 'Deshacer', destructivo: true,
      detalle: `${usd(a.monto)} · ${a.reserva_codigo || ''}${a.referencia_banco ? ' · Zelle ' + a.referencia_banco : ''}. El abono vuelve a «Por verificar», deja de sumar al pagado y el Zelle queda libre.` });
    if (!si) return;
    btn.disabled = true;
    const { data, error: e } = await sb.rpc('finanzas_abono_deshacer_lyra', { p_abono_id: abonoId });
    if (e || !data?.ok) { if (btn.isConnected) btn.disabled = false; return error(ERRORES[data?.error] || 'No se pudo deshacer: ' + (e?.message || data?.error || '')); }
    ok('Abono devuelto a «Por verificar».');
    alCambiar ? alCambiar() : cargar();
  }

  return { cargar, problemas };
}
