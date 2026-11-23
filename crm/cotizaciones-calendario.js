const DIA = 864e5;
const fecha = iso => new Date(`${iso}T00:00:00Z`);
const isoDe = d => d.toISOString().slice(0, 10);
export const sumarDias = (iso, n) => isoDe(new Date(+fecha(iso) + n * DIA));
export const moverMes = (iso, n) => {
  const d = fecha(iso), fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n + 1, 0));
  return isoDe(new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), Math.min(d.getUTCDate(), fin.getUTCDate()))));
};
const mesDe = iso => iso.slice(0, 7) + '-01';
const largo = iso => fecha(iso).toLocaleDateString('es', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const corto = iso => iso ? fecha(iso).toLocaleDateString('es', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }) : 'Elegir fecha';
const hoy = () => { const d = new Date(); return isoDe(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))); };

export function crearCalendarioRango({ raiz, obtener, aplicar, esc }) {
  const doc = raiz.ownerDocument, win = doc.defaultView;
  const panel = doc.createElement('div');
  panel.id = 'cb-calendario'; panel.className = 'cb-cal'; panel.hidden = true;
  panel.setAttribute('popover', 'manual'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Fechas de estancia');
  doc.body.append(panel);
  let estado = null;
  const campo = k => doc.querySelector(`#cb-items .cb-item[data-i="${estado?.i}"] [data-cb-fecha="${k}"]`);
  const vigente = () => estado && obtener(estado.i) === estado.it && campo('ida')?.isConnected;
  function cerrar(foco = false) {
    if (!estado) return;
    const origen = campo(estado.origen);
    raiz.querySelectorAll('[data-cb-fecha]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    estado = null;
    if (panel.matches(':popover-open')) panel.hidePopover();
    panel.hidden = true;
    if (foco) origen?.focus({ preventScroll: true });
  }
  function escala() { return parseFloat(win.getComputedStyle(doc.body).zoom) || 1; }
  function cantidad() { return win.innerWidth >= 760 && (win.innerWidth - 16) / escala() >= 740 ? 2 : 1; }
  function colocar() {
    if (!vigente()) { cerrar(); return; }
    const z = escala(), b = campo(estado.origen).getBoundingClientRect();
    const margen = win.innerWidth < 360 ? 0 : 8, ancho = (win.innerWidth - margen * 2) / z;
    panel.style.width = `${Math.min(cantidad() === 2 ? 760 : 380, ancho)}px`;
    const r = panel.getBoundingClientRect();
    const x = Math.max(margen, Math.min(b.left, win.innerWidth - r.width - margen));
    const abajo = b.bottom + 6, arriba = b.top - r.height - 6;
    const y = abajo + r.height <= win.innerHeight - margen ? abajo : Math.max(margen, arriba);
    panel.style.left = `${x / z}px`; panel.style.top = `${y / z}px`;
    panel.style.maxHeight = `${(win.innerHeight - margen * 2) / z}px`;
  }
  function mesHtml(mes) {
    const d = fecha(mes), titulo = d.toLocaleDateString('es', { timeZone: 'UTC', month: 'long', year: 'numeric' });
    const desfase = (d.getUTCDay() + 6) % 7, dias = fecha(moverMes(mes, 1)).getTime() - d.getTime();
    const celdas = Array.from({ length: Math.ceil((desfase + dias / DIA) / 7) * 7 }, (_, j) => {
      if (j < desfase || j >= desfase + dias / DIA) return '<span role="gridcell"></span>';
      const iso = sumarDias(mes, j - desfase), it = estado.it;
      const inicio = iso === it.ida, fin = iso === it.vuelta, dentro = it.ida && it.vuelta && iso > it.ida && iso < it.vuelta;
      const seleccionado = inicio || fin || dentro;
      const clase = [inicio && 'inicio', fin && 'fin', dentro && 'rango'].filter(Boolean).join(' ');
      const nota = inicio ? ', entrada' : fin ? ', salida' : dentro ? ', en la estancia' : '';
      return `<button type="button" role="gridcell" class="cb-cal-dia ${clase}" data-cb-dia="${iso}" tabindex="${iso === estado.foco ? 0 : -1}" aria-selected="${!!seleccionado}" aria-label="${esc(largo(iso) + nota)}"${iso === hoy() ? ' aria-current="date"' : ''}>${j - desfase + 1}</button>`;
    });
    const semanas = Array.from({ length: celdas.length / 7 }, (_, j) => `<div role="row" class="cb-cal-semana">${celdas.slice(j * 7, j * 7 + 7).join('')}</div>`).join('');
    return `<section class="cb-cal-mes"><h4>${esc(titulo)}</h4><div class="cb-cal-dias" role="grid" aria-label="${esc(titulo)}"><div role="row" class="cb-cal-semana">${['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map(s => `<span role="columnheader">${s}</span>`).join('')}</div>${semanas}</div></section>`;
  }
  function pintar(enfocar = true) {
    if (!vigente()) { cerrar(); return; }
    const it = estado.it, n = it.ida && it.vuelta ? Math.round((+fecha(it.vuelta) - +fecha(it.ida)) / DIA) : 0;
    panel.innerHTML = `<div class="cb-cal-cab"><button type="button" data-cb-mes="-1" aria-label="Mes anterior"><span aria-hidden="true">‹</span></button><strong aria-live="polite">${estado.extremo === 'ida' ? 'Elige entrada' : 'Elige salida'}</strong><button type="button" data-cb-mes="1" aria-label="Mes siguiente"><span aria-hidden="true">›</span></button><button type="button" data-cb-cerrar aria-label="Cerrar calendario"><span aria-hidden="true">×</span></button></div><div class="cb-cal-extremos">${[['ida', 'Check-in'], ['vuelta', 'Check-out']].map(([k, s]) => `<button type="button" data-cb-extremo="${k}" aria-pressed="${estado.extremo === k}"><small>${s}</small><span>${esc(corto(it[k]))}</span></button>`).join('')}</div><div class="cb-cal-meses" style="--cb-meses:${cantidad()}">${Array.from({ length: cantidad() }, (_, j) => mesHtml(moverMes(estado.mes, j))).join('')}</div><div class="cb-cal-pie" aria-live="polite">${n > 0 ? `${n} ${n === 1 ? 'noche' : 'noches'}` : it.ida ? 'Selecciona una salida posterior a la entrada' : 'Selecciona el día de llegada'}</div>`;
    colocar();
    if (enfocar) panel.querySelector(`[data-cb-dia="${estado.foco}"]`)?.focus({ preventScroll: true });
  }
  function abrir(boton) {
    const i = Number(boton.closest('.cb-item').dataset.i), it = obtener(i);
    if (!it || it.tipo !== 'hotel') return;
    const extremo = boton.dataset.cbFecha === 'vuelta' && it.ida ? 'vuelta' : 'ida';
    cerrar();
    const foco = it[extremo] || it.ida || hoy();
    estado = { i, it, extremo, origen: boton.dataset.cbFecha, mes: mesDe(foco), foco };
    boton.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    if (panel.showPopover) panel.showPopover();
    pintar();
  }
  function elegir(iso) {
    if (!vigente()) { cerrar(); return; }
    const anterior = estado, it = anterior.it;
    let ida = it.ida || '', vuelta = it.vuelta || '', completo = false;
    if (anterior.extremo === 'ida' || !ida || iso < ida) { ida = iso; if (vuelta <= ida) vuelta = ''; }
    else if (iso > ida) { vuelta = iso; completo = true; }
    else return;
    cerrar();
    aplicar(anterior.i, { ida, vuelta });
    if (completo) {
      doc.querySelector(`#cb-items .cb-item[data-i="${anterior.i}"] [data-cb-fecha="${anterior.origen}"]`)?.focus({ preventScroll: true });
      return;
    }
    const b = doc.querySelector(`#cb-items .cb-item[data-i="${anterior.i}"] [data-cb-fecha="vuelta"]`);
    if (!b || obtener(anterior.i) !== it) return;
    abrir(b); estado.origen = anterior.origen; estado.foco = vuelta || sumarDias(ida, 1); estado.mes = mesDe(estado.foco); pintar();
  }
  panel.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !estado) return;
    if (b.hasAttribute('data-cb-cerrar')) cerrar(true);
    else if (b.dataset.cbDia) elegir(b.dataset.cbDia);
    else if (b.dataset.cbMes) { estado.mes = moverMes(estado.mes, Number(b.dataset.cbMes)); estado.foco = estado.mes; pintar(false); }
    else if (b.dataset.cbExtremo) { estado.extremo = b.dataset.cbExtremo === 'vuelta' && estado.it.ida ? 'vuelta' : 'ida'; pintar(false); }
  });
  panel.addEventListener('keydown', e => {
    if (!estado) return;
    if (e.key === 'Escape') { e.preventDefault(); cerrar(true); return; }
    const iso = e.target.dataset.cbDia; if (!iso) return;
    const dia = (fecha(iso).getUTCDay() + 6) % 7;
    const saltos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -dia, End: 6 - dia };
    let siguiente;
    if (Object.hasOwn(saltos, e.key)) siguiente = sumarDias(iso, saltos[e.key]);
    else if (e.key === 'PageUp' || e.key === 'PageDown') siguiente = moverMes(iso, e.key === 'PageUp' ? -1 : 1);
    else return;
    e.preventDefault(); estado.foco = siguiente;
    if (siguiente < estado.mes || siguiente >= moverMes(estado.mes, cantidad())) estado.mes = mesDe(siguiente);
    pintar();
  });
  doc.addEventListener('pointerdown', e => { if (estado && !panel.contains(e.target) && !e.target.closest('[data-cb-fecha]')) cerrar(); });
  doc.addEventListener('focusin', e => { if (estado && !panel.contains(e.target) && !e.target.closest('[data-cb-fecha]')) cerrar(); });
  doc.addEventListener('keydown', e => { if (estado && e.key === 'Escape') { e.preventDefault(); cerrar(true); } });
  win.addEventListener('resize', () => { if (estado) pintar(false); });
  win.addEventListener('scroll', () => { if (estado) colocar(); }, true);
  new win.MutationObserver(() => { if (estado && !vigente()) cerrar(); }).observe(raiz, { childList: true, subtree: true });
  return { abrir, cerrar };
}
