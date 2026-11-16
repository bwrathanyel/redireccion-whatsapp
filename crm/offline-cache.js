// Copia local de las lecturas de Supabase para poder consultar el CRM sin red (solo lectura).
// La usa fetchConSesion (app.js): con red guarda cada lectura OK; sin red la devuelve.
// Clave por usuario: en un equipo compartido nadie ve la copia de otro, y el logout la borra.
const DB = 'lotus-offline', ST = 'resp', TTL = 7 * 864e5, TOPE = 40 * 1024 * 1024, SYNC_KEY = 'lotus_ultima_sync';
// Solo RPCs que leen. Una RPC que escribe nunca puede salir de la copia: devolvería "ok" sin haber guardado nada.
const RPC_LECTURA = /^(listar_|tablero_|panel_|historial_|tareas_de_|tarea_detalle$|reservas?_de_|reserva_(detalle|checklist|abonos_lista|tickets_ia)$|mis_(ventas|conversaciones|pagos_asesor)$|mi_resumen_jornada$|mi_push_estado$|dashboard_stats$|metricas$|ranking_asesores$|tasas_del_dia$|stop_sales_(vigentes|textos_ultimos|pdf_actual)$|tarifas_por_confirmar$|tarifario_vencidos$|postventa_(bandeja|resumen)$|plan_de_reserva$|apto_(disponibilidad|asignaciones_reserva)$|voucher_(buscar_lead|reservas_similares)$|hot_sales_publicas$|ofertas_publicaciones$|notas_para_repasar_hoy$|lead_origen_anuncio$|estado_reasignacion_lead$|usuarios_chat$|boleteria_(catalogo|reservas_listar|historico_ruta)$|promociones_sin_hotel$)/;

let uid = null, dbP = null, escrituras = 0, ultimaMarca = 0;
export const fijarUsuario = id => { uid = id || null; };

export function esLectura(url, metodo) {
  const p = new URL(url).pathname;
  if (!p.startsWith('/rest/v1/')) return false;
  if (metodo === 'GET' || metodo === 'HEAD') return true;
  return metodo === 'POST' && p.startsWith('/rest/v1/rpc/') && RPC_LECTURA.test(p.slice(13));
}

const abrir = () => dbP ??= new Promise((ok, mal) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(ST);
  r.onsuccess = () => ok(r.result);
  r.onerror = () => mal(r.error);
}).catch(e => { dbP = null; throw e; });
const tx = async (modo, fn) => {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const t = db.transaction(ST, modo), out = fn(t.objectStore(ST));
    t.oncomplete = () => ok(out?.result);
    t.onerror = t.onabort = () => mal(t.error);
  });
};
const cabecera = (init, n) => new Headers(init.headers || {}).get(n) || '';
const clave = (url, metodo, init) => [uid, metodo, cabecera(init, 'accept'), cabecera(init, 'accept-profile'), url, typeof init.body === 'string' ? init.body : ''].join('|');

export async function guardar(url, metodo, init, res) {
  if (!uid) return;
  try {
    const body = await res.text();
    const fila = { status: res.status, headers: [...res.headers], body, guardado: Date.now() };
    await tx('readwrite', s => s.put(fila, clave(url, metodo, init)));
    if (Date.now() - ultimaMarca > 60e3) { ultimaMarca = Date.now(); try { localStorage.setItem(SYNC_KEY, String(ultimaMarca)); } catch { /* sin cuota */ } }
    if (++escrituras % 200 === 1) podar();
  } catch (e) { console.warn('offline-cache guardar', e); }
}

export async function leer(url, metodo, init) {
  if (!uid) return null;
  try {
    const f = await tx('readonly', s => s.get(clave(url, metodo, init)));
    if (!f || Date.now() - f.guardado > TTL) return null;
    const h = new Headers(f.headers); h.set('x-lotus-offline', new Date(f.guardado).toISOString());
    return new Response(metodo === 'HEAD' ? null : f.body, { status: f.status, headers: h });
  } catch { return null; }
}

// Borra lo vencido y, si pasa del tope, lo más viejo primero.
async function podar() {
  try {
    const filas = [];
    await tx('readonly', s => { const c = s.openCursor(); c.onsuccess = () => { const k = c.result; if (!k) return; filas.push([k.key, k.value.guardado, k.value.body.length]); k.continue(); }; return c; });
    filas.sort((a, b) => a[1] - b[1]);
    let total = filas.reduce((n, f) => n + f[2], 0);
    const fuera = filas.filter(([, g, tam]) => { const sale = Date.now() - g > TTL || total > TOPE; if (sale) total -= tam; return sale; });
    if (fuera.length) await tx('readwrite', s => fuera.forEach(([k]) => s.delete(k)));
  } catch (e) { console.warn('offline-cache podar', e); }
}

export const ultimaSync = () => { try { return Number(localStorage.getItem(SYNC_KEY)) || 0; } catch { return 0; } };

export async function borrarTodo() {
  uid = null;
  try { localStorage.removeItem(SYNC_KEY); } catch { /* idem */ }
  try { await tx('readwrite', s => s.clear()); } catch (e) { console.warn('offline-cache borrar', e); }
}
