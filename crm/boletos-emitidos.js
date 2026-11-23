// Boletería > Boletos emitidos: recibo de itinerario (e-ticket) con diseño Lotus.
// Se autollena con el PDF que manda el consolidador (BT Travel, formato KIU), se guarda en
// boletos_emitidos (RLS: admin y boletería) y el PDF se arma en el navegador desde la fila.
// Plan: ~/.claude/plans/vamos-a-hacer-una-serene-beaver.md
const CSS = `
.be-root{--be-papel:#fff;display:flex;flex-direction:column;gap:14px}
.be-cab{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap}
.be-cab h2{margin:0;font-size:20px}
.be-cab .csub{margin-top:4px}
.be-tabs{display:flex;gap:4px;padding:4px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.be-tabs button{min-height:36px;padding:0 14px;border:0;border-radius:9px;background:transparent;color:var(--muted);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.be-tabs button.on{background:var(--accent-soft);color:var(--accent-ink,var(--accent))}
.be-layout{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:14px;align-items:start}
.be-form{display:flex;flex-direction:column;gap:14px;min-width:0}
.be-drop{display:flex;align-items:center;gap:14px;padding:16px 18px;border:1.5px dashed var(--line2);border-radius:14px;background:var(--panel);cursor:pointer;transition:border-color .16s,background .16s}
.be-drop:hover,.be-drop.sobre{border-color:var(--accent);background:var(--accent-soft)}
.be-drop>i{font-size:22px;color:var(--accent)}
.be-drop b{display:block;font-size:13.5px}
.be-drop small{display:block;color:var(--muted);font-size:11.5px;margin-top:2px}
.be-drop input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.be-drop:focus-within{outline:2px solid var(--accent);outline-offset:2px}
.be-modo{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--muted)}
.be-modo .be-tabs{padding:3px}
.be-modo .be-tabs button{min-height:32px;padding:0 11px;font-size:12px}
.be-lote{display:flex;flex-direction:column;gap:9px;padding:12px 14px}
.be-lote-cab{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12.5px}
.be-lote-cab .be-btn{margin-left:auto;min-height:38px}
.be-lote-items{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
.be-lote-items button{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-start;gap:1px;min-height:44px;max-width:220px;padding:6px 11px;border:1px solid var(--line2);border-radius:10px;background:transparent;color:var(--txt);font:inherit;font-size:12px;font-weight:700;text-align:left;cursor:pointer}
.be-lote-items button small{font-weight:500;color:var(--muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.be-lote-items button.on{border-color:var(--accent);background:var(--accent-soft)}
.be-lote-items button.falta small{color:var(--amber)}
.be-lote-items button.listo small{color:var(--green)}
.be-lote-items button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.be-aviso{padding:11px 14px;border-radius:12px;border:1px solid var(--line2);background:var(--panel);font-size:12.5px;display:flex;gap:9px;align-items:flex-start}
.be-aviso>i{margin-top:2px}
.be-aviso.ok>i{color:var(--green)}
.be-aviso.warn>i{color:var(--amber)}
.be-aviso button{margin-left:auto}
.be-bloque h3{margin:0 0 4px;font-size:14px;display:flex;align-items:center;gap:8px}
.be-bloque h3 i{color:var(--accent)}
.be-bloque>summary{cursor:pointer;font-size:14px;font-weight:700;list-style:none;display:flex;align-items:center;gap:8px}
.be-bloque>summary::-webkit-details-marker{display:none}
.be-bloque>summary small{color:var(--muted);font-weight:500;font-size:11.5px}
.be-item{border:1px solid var(--line);border-radius:12px;padding:4px 14px 12px;margin-top:11px;position:relative}
.be-item-cab{display:flex;align-items:center;gap:9px;margin-top:9px}
.be-item-cab b{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
.be-quitar{margin-left:auto;min-width:36px;min-height:36px;border:1px solid var(--line);border-radius:9px;background:transparent;color:var(--muted);cursor:pointer}
.be-quitar:hover{color:var(--danger);border-color:var(--danger)}
.be-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:0 10px}
.be-grid>*{grid-column:span var(--c,3);min-width:0}
.be-grid>.be-2{--c:6;--m:6}
.be-grid>.be-todo{grid-column:1/-1}
.be-grid .field{margin-bottom:0}
.be-grid .fl{margin:9px 0 4px}
.be-grid .ei{padding:9px 11px;font-size:14px;min-height:42px}
.be-fecha{display:flex;align-items:center;gap:7px;width:100%;text-align:left;cursor:pointer;font:inherit;font-size:14px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden}
.be-fecha>span{overflow:hidden;text-overflow:ellipsis}
.be-fecha i{margin-left:auto;color:var(--accent)}
.be-fecha.on,.be-fecha:focus-visible{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);outline:0}
.be-fecha .ph{color:var(--muted2,var(--muted));font-weight:500}
.be-fecha-dia{text-transform:capitalize;color:var(--muted)}
.be-cal{margin-top:9px;padding:11px;border:1px solid var(--line2);border-radius:12px;background:var(--bg2,var(--panel))}
.be-cal-cab{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-bottom:7px;font-size:12px;color:var(--muted);text-align:center}
.be-cal-cab b{color:var(--txt)}
.be-cal-nav{flex:none;width:38px;height:38px;border:1px solid var(--line2);border-radius:10px;background:transparent;color:var(--txt);cursor:pointer}
.be-cal-nav:hover{border-color:var(--accent);color:var(--accent)}
.be-cal-meses{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.be-cal-tit{margin-bottom:4px;text-align:center;font-size:13px;font-weight:700;text-transform:capitalize}
.be-cal-sem,.be-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px 0}
.be-cal-sem span{text-align:center;font-size:10.5px;color:var(--muted2,var(--muted));text-transform:uppercase}
.be-cal-grid button{position:relative;height:36px;border:0;border-radius:8px;background:transparent;color:var(--txt);font:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:background .16s}
.be-cal-grid button:hover{background:var(--accent-soft)}
.be-cal-grid button.pasado{color:var(--muted2,var(--muted));font-weight:500}
.be-cal-grid button.hoy{box-shadow:inset 0 0 0 1px var(--line2)}
.be-cal-grid button.otro::after{content:'';position:absolute;left:50%;bottom:4px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--accent)}
.be-cal-grid button.sel{background:var(--accent);color:var(--on-accent,#fff)}
.be-cal-grid button.sel::after{background:currentColor}
.be-cal-grid button:focus-visible,.be-cal-nav:focus-visible,.be-chip:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.be-cal-pie{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px}
.be-chip{min-height:34px;padding:0 12px;border:1px solid var(--line2);border-radius:999px;background:transparent;color:var(--txt);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.be-chip:hover,.be-chip.on{border-color:var(--accent);background:var(--accent-soft)}
.be-cal-listo{margin-left:auto;font-weight:800}
.be-mas{margin-top:9px;border-top:1px dashed var(--line)}
.be-mas>summary{display:flex;align-items:center;gap:8px;min-height:38px;padding-top:7px;cursor:pointer;list-style:none;font-size:12px;color:var(--muted)}
.be-mas>summary::-webkit-details-marker{display:none}
.be-mas>summary b{color:var(--txt);font-weight:700}
.be-mas>summary span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.be-mas>summary i{margin-left:auto;transition:transform .16s}
.be-mas[open]>summary i{transform:rotate(180deg)}
.be-mas>summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}
.be-logo{display:inline-flex;align-items:center;justify-content:center;background:var(--be-papel);border-radius:8px;padding:4px 7px;height:30px;min-width:30px}
.be-logo img{max-height:22px;max-width:96px;display:block}
.be-logo span{font-size:11px;font-weight:800;color:#0f172a;white-space:nowrap}
.be-agregar{margin-top:11px;min-height:40px;padding:0 14px;border:1px dashed var(--line2);border-radius:10px;background:transparent;color:var(--txt);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.be-agregar:hover{border-color:var(--accent);color:var(--accent)}
.be-falta .ei{border-color:var(--amber)}
.be-lateral{position:sticky;top:14px;display:flex;flex-direction:column;gap:11px}
.be-lateral h3{margin:0;font-size:14px}
.be-estado{font-size:11.5px;color:var(--muted)}
.be-estado b{color:var(--txt)}
.be-clave{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.be-clave>div{border:1px solid var(--line);border-radius:10px;padding:7px 9px;min-width:0}
.be-clave small{display:block;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.be-clave b{display:block;font-size:13px;margin-top:2px;overflow-wrap:anywhere}
.be-pase{border:1px solid var(--line);border-left:4px solid var(--be-color,var(--accent));border-radius:12px;padding:9px 11px;display:flex;flex-direction:column;gap:7px}
.be-pase-cab{display:flex;align-items:center;gap:9px;font-size:11.5px;color:var(--muted)}
.be-pase-cab b{color:var(--txt)}
.be-pase-ruta{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px}
.be-pase-ruta strong{display:block;font-size:19px;line-height:1.1}
.be-pase-ruta small{display:block;font-size:10.5px;color:var(--muted)}
.be-pase-ruta .der{text-align:right}
.be-linea{height:1px;background:var(--line2);position:relative}
.be-linea em{position:absolute;left:50%;top:-16px;transform:translateX(-50%);font-size:10px;font-style:normal;color:var(--muted);white-space:nowrap}
.be-pase-pie{display:flex;flex-wrap:wrap;gap:4px 11px;font-size:11px;color:var(--muted)}
.be-faltan{margin:0;padding-left:18px;font-size:11.5px;color:var(--amber)}
.be-acciones{display:flex;flex-direction:column;gap:7px}
.be-btn{min-height:44px;padding:0 16px;border-radius:10px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--line2);background:transparent;color:var(--txt)}
.be-btn.prim{border:0;background:linear-gradient(135deg,var(--accent),#e0570a);color:var(--on-accent,#fff);box-shadow:0 10px 22px rgba(255,145,0,.22)}
.be-btn:disabled{opacity:.55;cursor:default}
.be-btn:focus-visible,.be-tabs button:focus-visible,.be-agregar:focus-visible,.be-quitar:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.be-hist-barra{display:flex;gap:11px;align-items:center;flex-wrap:wrap}
.be-hist-barra .ei{flex:1;min-width:220px}
.be-hist-barra label{font-size:12px;color:var(--muted);display:flex;gap:6px;align-items:center}
.be-fila{display:grid;grid-template-columns:96px minmax(0,1.4fr) minmax(0,1fr) auto;gap:11px;align-items:center;padding:11px 0;border-top:1px solid var(--line)}
.be-fila:first-child{border-top:0}
.be-fila.anulado{opacity:.55}
.be-fila .num{font-weight:800;font-size:12.5px}
.be-fila .num small,.be-fila .det small{display:block;font-weight:500;color:var(--muted);font-size:11px}
.be-fila .det b{display:block;font-size:13px;overflow-wrap:anywhere}
.be-fila .acc{display:flex;gap:6px}
.be-fila .acc button{min-width:38px;min-height:38px;border-radius:9px;border:1px solid var(--line);background:transparent;color:var(--txt);cursor:pointer}
.be-fila .acc button:hover{border-color:var(--accent);color:var(--accent)}
.be-vacio{padding:22px 0;text-align:center;color:var(--muted);font-size:12.5px}
@media (max-width:1100px){.be-layout{grid-template-columns:1fr}.be-lateral{position:static}}
@media (max-width:640px){
  .be-root{gap:10px}
  .be-cab .csub{display:none}
  .be-cab h2{font-size:18px}
  .be-tabs{width:100%}
  .be-tabs button{flex:1}
  .be-drop{padding:11px 14px}
  .be-modo{flex-wrap:nowrap;overflow-x:auto}
  .be-modo>span{white-space:nowrap}
  .be-modo .be-tabs{width:auto}
  .be-modo .be-tabs button{flex:none;white-space:nowrap}
  .be-form{gap:10px}
  .be-form>.card{padding:12px}
  .be-item{padding:2px 11px 11px;margin-top:9px}
  .be-item-cab{margin-top:7px}
  .be-quitar{min-width:34px;min-height:34px}
  .be-grid{grid-template-columns:repeat(6,minmax(0,1fr));gap:0 8px}
  .be-grid>*{grid-column:span var(--m,3)}
  .be-grid .fl{margin:7px 0 3px}
  .be-grid .ei{padding:9px 10px}
  .be-fecha{gap:4px}
  .be-fecha i,.be-fecha-dia{display:none}
  .be-cal-meses{grid-template-columns:1fr}
  .be-cal-mes+.be-cal-mes{display:none}
  .be-cal-grid button{height:42px}
  .be-chip{min-height:38px}
  .be-fila{grid-template-columns:1fr auto}
  .be-fila .det:nth-child(3){display:none}
}
`;

// Aerolíneas con logo (img/aerolineas/<id>.png). Códigos IATA verificados en Wikipedia el
// 2026-11-04; los que no se pudieron verificar quedan vacíos y se escriben a mano.
// Logos: Wikimedia Commons; Rutaca y Turpial salen del recibo del consolidador.
export const AEROLINEAS = [
  { id: 'conviasa', nombre: 'Conviasa', iata: 'V0', color: '#f26f21', grupo: 'nacional', logo: true },
  { id: 'avior', nombre: 'Avior Airlines', iata: '9V', color: '#c8102e', grupo: 'nacional', logo: true },
  { id: 'laser', nombre: 'Laser Airlines', iata: 'QL', color: '#2f9e44', grupo: 'nacional', logo: true },
  { id: 'estelar', nombre: 'Estelar', iata: 'ES', color: '#1b2a8f', grupo: 'nacional', logo: true },
  { id: 'rutaca', nombre: 'Rutaca Airlines', iata: '5R', color: '#d99a1e', grupo: 'nacional', logo: true,
    razon: 'Rutas Aéreas, C.A. (RUTACA)', fiscal: 'RIF J-095003965', direccion: 'Av. Jesús Soto, sector Aeropuerto, Edif. Taller Mares, Ciudad Bolívar, Venezuela',
    contrato: 'El servicio de transporte realizado por Rutas Aéreas, C.A. RUTACA, está sujeto a las normas establecidas en la Ley de Aeronáutica Civil, las regulaciones nacionales, las condiciones generales del transporte aéreo y a los acuerdos y convenios internacionales aceptados en el país, en cuanto le sean aplicables.' },
  { id: 'turpial', nombre: 'Turpial Airlines', iata: 'T9', color: '#f2b705', grupo: 'nacional', logo: true,
    razon: 'Turpial Airlines C.A.', fiscal: 'NIT 3404919210-IRS', direccion: 'Av. Final Diego Iribarren, Aeropuerto Int. Arturo Michelena, Zona Industrial Sur, Valencia, Carabobo' },
  { id: 'albatros', nombre: 'Albatros Airlines', iata: '', color: '#1d3c8c', grupo: 'nacional', logo: true },
  { id: 'sasca', nombre: 'SASCA Airlines', iata: '', color: '#1f3a93', grupo: 'nacional', logo: true },
  { id: 'venezolana', nombre: 'Venezolana', iata: 'WW', color: '#0f2f6b', grupo: 'nacional', logo: false },
  { id: 'aeropostal', nombre: 'Aeropostal', iata: 'CW', color: '#0b4a9e', grupo: 'nacional', logo: true },
  // El consolidador la emite como «BLUE STAR» con código BS (no es su IATA oficial; su OACI es BSV).
  { id: 'bluestar', nombre: 'Bluestar', iata: 'BS', color: '#283171', grupo: 'nacional', logo: true },
  { id: 'copa', nombre: 'Copa Airlines', iata: 'CM', color: '#0b4ea2', grupo: 'internacional', logo: true },
  { id: 'wingo', nombre: 'Wingo', iata: 'P5', color: '#5c2d91', grupo: 'internacional', logo: true },
  { id: 'avianca', nombre: 'Avianca', iata: 'AV', color: '#da291c', grupo: 'internacional', logo: true },
  { id: 'iberia', nombre: 'Iberia', iata: 'IB', color: '#d7192d', grupo: 'internacional', logo: true },
  { id: 'aireuropa', nombre: 'Air Europa', iata: 'UX', color: '#0072ce', grupo: 'internacional', logo: true },
  { id: 'plusultra', nombre: 'Plus Ultra', iata: 'PU', color: '#13394f', grupo: 'internacional', logo: true },
  { id: 'tap', nombre: 'TAP Air Portugal', iata: 'TP', color: '#2e9e3e', grupo: 'internacional', logo: true },
  { id: 'turkish', nombre: 'Turkish Airlines', iata: 'TK', color: '#c8102e', grupo: 'internacional', logo: true },
  { id: 'boa', nombre: 'Boliviana de Aviación', iata: 'OB', color: '#1f3a8a', grupo: 'internacional', logo: true },
  { id: 'arajet', nombre: 'Arajet', iata: 'DM', color: '#5b2a86', grupo: 'internacional', logo: true },
];
const AER = Object.fromEntries(AEROLINEAS.map(a => [a.id, a]));
const logoDe = a => (a?.logo ? `img/aerolineas/${a.id}.png` : '');
// Ciudades como las escribe el GDS -> IATA (las del catálogo de Boletería se resuelven aparte).
const ALIAS_CIUDAD = {
  CARACAS: 'CCS', MAIQUETIA: 'CCS', PORLAMAR: 'PMV', MARGARITA: 'PMV', 'ISLA MARGARITA': 'PMV', VALENCIA: 'VLN', MARACAIBO: 'MAR',
  BARCELONA: 'BLA', 'PUERTO ORDAZ': 'PZO', 'LOS ROQUES': 'LRV', 'EL VIGIA': 'VIG', MERIDA: 'MRD', BARINAS: 'BNS', MATURIN: 'MUN',
  CUMANA: 'CUM', 'CIUDAD BOLIVAR': 'CBL', CANAIMA: 'CAJ', 'LAS PIEDRAS': 'LSP', 'PUNTO FIJO': 'LSP', CORO: 'CZE', BARQUISIMETO: 'BRM',
  PANAMA: 'PTY', BOGOTA: 'BOG', MEDELLIN: 'MDE', MADRID: 'MAD', 'PUNTA CANA': 'PUJ', MIAMI: 'MIA', LIMA: 'LIM', ISTANBUL: 'IST',
  ESTAMBUL: 'IST', LISBOA: 'LIS', LISBON: 'LIS', CANCUN: 'CUN', ARUBA: 'AUA', CURACAO: 'CUR', 'SANTA CRUZ': 'VVI', 'LA HABANA': 'HAV', HAVANA: 'HAV',
};
const MESES = { JAN: 1, ENE: 1, FEB: 2, MAR: 3, APR: 4, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12, DIC: 12 };
const BT_TRAVEL = { agencia: 'GRUPO BT TRAVEL SA', direccion: 'Vía Israel, Urb. Aeropuerto, Panamá', office_id: 'PA-14747-0', telefono: '507-2238961', email: 'emisiones@grupobttravel.com', agente: '' };
const CLAVE_EMISOR = 'be_emisor';

let AEROPUERTOS = [];
export const fijarAeropuertos = lista => { AEROPUERTOS = Array.isArray(lista) ? lista : []; };
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const titulo = s => String(s ?? '').toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const aeropuerto = iata => AEROPUERTOS.find(a => a.iata_code === iata);
export function iataDeCiudad(ciudad) {
  const c = norm(ciudad);
  if (/^[A-Z]{3}$/.test(c) && aeropuerto(c)) return c;
  const ap = AEROPUERTOS.find(a => [a.ciudad, a.nombre_comercial].some(n => n && norm(n) === c));
  return ap?.iata_code || ALIAS_CIUDAD[c] || '';
}
const lugar = (codigo, ciudad) => {
  const c = norm(codigo), ap = /^[A-Z]{3}$/.test(c) ? aeropuerto(c) : null;
  const iata = /^[A-Z]{3}$/.test(c) ? c : '';
  return { iata, ciudad: ap ? (ap.nombre_comercial || ap.ciudad) : (ciudad ? titulo(ciudad) : iata ? '' : titulo(codigo)), pais: ap?.pais || '' };
};
export const aerolineaDe = t => (t.aerolinea && t.aerolinea !== 'otra' && AER[t.aerolinea])
  || { id: 'otra', nombre: t.aerolinea_nombre || 'Aerolínea', iata: t.iata || '', color: '#0f172a', logo: false };
export const claveAerolinea = t => (t.aerolinea && t.aerolinea !== 'otra' ? t.aerolinea : 'otra:' + norm(t.aerolinea_nombre || t.iata));
export const grupoDe = t => `${claveAerolinea(t)}|${norm(t.reserva)}`;
export function gruposDe(d) {
  const vistos = new Map();
  (d.tramos || []).forEach(t => { const g = grupoDe(t); if (!vistos.has(g)) vistos.set(g, { clave: g, aerolinea: aerolineaDe(t), reserva: norm(t.reserva) }); });
  return [...vistos.values()];
}
export const cabinaDe = clase => /^[JCDIZR]$/.test(clase) ? 'Ejecutiva' : /^[FAP]$/.test(clase) ? 'Primera' : 'Económica';
export function equipajeTxt(cod) {
  const c = norm(cod).replace(/\s/g, '');
  if (!c) return '';
  if (/^(NIL|NO|0K|0KG|0P|0PC)$/.test(c)) return 'Sin equipaje facturado';
  let m = c.match(/^(\d+)(K|KG)$/);
  if (m) return `Equipaje facturado: ${+m[1]} kg`;
  m = c.match(/^(\d+)(P|PC)$/);
  if (m) return +m[1] === 1 ? '1 maleta facturada' : `${+m[1]} maletas facturadas`;
  return cod;
}
export const estadoTxt = e => ({ OK: 'Confirmado', HK: 'Confirmado', KK: 'Confirmado', RQ: 'En lista de espera', HL: 'En lista de espera', SA: 'Sujeto a espacio' })[norm(e)] || norm(e) || 'Confirmado';
const confirmado = e => ['', 'OK', 'HK', 'KK'].includes(norm(e));
export function docTxt(doc) {
  const m = norm(doc).replace(/\s/g, '').match(/^([VEJ])-?(\d{5,9})$/);
  return m ? `${m[1]}-${Number(m[2]).toLocaleString('es-VE')}` : String(doc ?? '').trim();
}
export const nombreTxt = p => titulo(`${p.nombre || ''} ${p.apellido || ''}`).trim();
const minutos = h => { const m = String(h || '').match(/^(\d{1,2}):?(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };
export const llegaOtroDia = t => { const s = minutos(t.sale), l = minutos(t.llega); return s != null && l != null && (t.llega_dia ? t.llega_dia > 0 : l < s); };
export function duracionTxt(t) {
  const o = lugar(t.origen), d = lugar(t.destino), s = minutos(t.sale), l = minutos(t.llega);
  if (!o.pais || o.pais !== d.pais || s == null || l == null) return '';
  const min = l + (llegaOtroDia(t) ? 1440 : 0) - s;
  if (min <= 0 || min > 1440) return '';
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ' ' + String(min % 60).padStart(2, '0') + ' min' : ''}`;
}
const fechaDe = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : null; };
const hoyVe = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
const isoSum = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const mesSum = (ym, n) => { const [y, m] = ym.split('-').map(Number), k = y * 12 + m - 1 + n; return `${Math.floor(k / 12)}-${String(k % 12 + 1).padStart(2, '0')}`; };
const diasDelMes = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
// «0830», «830», «8:30» o «83:0» (autoformato a medio tipear) → «08:30»; inválida → ''.
export function horaTxt(v) {
  const s = String(v || '').trim(), g = s.replace(/\D/g, ''), p = s.split(':').map(x => x.replace(/\D/g, ''));
  const ok = (h, m) => (h !== '' && m !== '' && +h < 24 && +m < 60 ? `${h.padStart(2, '0')}:${m.padStart(2, '0')}` : '');
  return (p.length === 2 && ok(p[0], p[1])) || (g.length && g.length <= 4 ? ok(g.length <= 2 ? g : g.slice(0, -2), g.length <= 2 ? '00' : g.slice(-2)) : '');
}
export const fechaLarga = iso => fechaDe(iso)?.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) || '';
export const fechaCorta = iso => fechaDe(iso)?.toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('.', '') || '';
const fechaHoraTxt = iso => { const f = fechaCorta(iso), h = String(iso || '').slice(11, 16); return f ? f + (h ? ` · ${h}` : '') : ''; };
export const numeroTxt = n => (n ? `BE-${String(n).padStart(6, '0')}` : '');
export const boletoTxt = b => { const c = String(b || '').replace(/[\s-]/g, ''); return /^\d{13}$/.test(c) ? `${c.slice(0, 3)}-${c.slice(3)}` : String(b || '').trim(); };

// ---------- Lectura del PDF del consolidador ----------
// pdf.js entrega palabras sueltas con su posición: se rearman las líneas por la Y.
export function lineasDeItems(items) {
  const filas = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4], y = it.transform[5];
    let f = filas.find(f => Math.abs(f.y - y) < 2.5);
    if (!f) filas.push(f = { y, partes: [] });
    f.partes.push({ x, fin: x + (it.width || 0), s: it.str });
  }
  return filas.sort((a, b) => b.y - a.y).map(f => f.partes.sort((a, b) => a.x - b.x)
    .reduce((t, p, i, arr) => t + (i && p.x - arr[i - 1].fin > 1.5 ? ' ' : '') + p.s, '').replace(/\s+/g, ' ').trim());
}

// Foto o captura (OCR de tesseract): palabras con su caja en píxeles. Se escalan a una letra de ~10 pt
// y se pasan por el mismo armado de líneas que el PDF.
export function lineasDeOcr(data) {
  const pal = (data?.words || []).filter(w => w.text?.trim() && w.confidence > 20);
  if (!pal.length) return [];
  const altos = pal.map(w => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b), k = 10 / (altos[altos.length >> 1] || 10);
  return lineasDeItems(pal.map(w => ({ str: w.text, width: (w.bbox.x1 - w.bbox.x0) * k, transform: [1, 0, 0, 1, w.bbox.x0 * k, -(w.bbox.y0 + w.bbox.y1) / 2 * k] })))
    .map(l => l.replace(/\s+[©®«»|]\s+/g, ' : '));
}

const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js';
let ocrLib = null;
export async function lectorOcr() {
  ocrLib ||= import(TESSERACT).then(m => m.default);
  return (await ocrLib).createWorker('eng');
}

// Varios recibos en un lote: todos juntos, uno por código de reserva o uno por pasajero.
export function separarRecibos(recibos, modo) {
  if (modo === 'juntos') return recibos.length ? [{ clave: 'todos', recibos }] : [];
  const m = new Map();
  for (const r of recibos) {
    const k = modo === 'pasajero' ? `p:${clavePax(r.pasajero)}` : `r:${r.reserva || r.boleto || clavePax(r.pasajero)}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return [...m].map(([clave, rs]) => ({ clave, recibos: rs }));
}

const RE_TRAMO =/^(.+?) ([A-Z0-9]{2}) ?(\d{1,4}) ([A-Z]) (\d{1,2})([A-Z]{3}) (\d{4}) (\d{4})(?: ?\+(\d))?(?: ([A-Z0-9/]{2,15}))?(?: \d{1,2}[A-Z]{3}){0,2} (\d{1,2}(?:KG|PC|K|P)|NIL) ([A-Z]{2})$/;
const sinCola = s => s.replace(/\s+(NAME\/NOMBRE|FOID\/D\.IDENTIDAD|ISSUE (DATE|AGENT)[^:]*):.*$/, '').trim();
const hhmm = s => `${s.slice(0, 2)}:${s.slice(2)}`;

// Un recibo = una página (un boleto). Devuelve null si la página no parece un boleto.
export function parsearBoleto(lineas) {
  const L = lineas.map(l => norm(l));
  const buscar = re => { for (const l of L) { const m = l.match(re); if (m) return m; } return null; };
  const idx = re => L.findIndex(l => re.test(l));
  const boleto = buscar(/TICKET NUMBER[^:]*:\s*(\d{3})-?(\d{10})/) || buscar(/TICKET N(?:BR|RO)\.?:\s*(\d{3})-?(\d{10})/) || buscar(/TICKET'?S NUMBER'?S\s*:\s*(\d{3})-?(\d{10})/);
  const nombre = buscar(/NAME(?:\/NOMBRE)?:\s*([A-Z' -]+?)\s*\/\s*([A-Z' .-]+?)(?:\s+(?:MR|MRS|MS|MISS|MSTR|CHD|INF))?$/);
  const foid = buscar(/FOID(?:\/D\.IDENTIDAD)?:\s*(\S+)/);
  const reserva = buscar(/BOOKING REF[^:]*:\s*(?:[A-Z0-9]{1,3}\/)?\s*([A-Z0-9]{5,8})\b/);
  const emision = buscar(/ISSUE DATE[^:]*:\s*(\d{1,2}) ?([A-Z]{3}) ?(\d{4})(?:\s+(\d{1,2}):\s?(\d{2}))?/);
  const tramosCrudos = [];
  L.forEach((l, i) => {
    const m = l.match(RE_TRAMO);
    if (!m) return;
    const sig = L[i + 1] || '';
    tramosCrudos.push({ m, destino: /^[A-Z][A-Z .'-]+$/.test(sig) && !RE_TRAMO.test(sig) ? sig : '' });
  });
  if (!boleto && !tramosCrudos.length) return null;

  const anioEm = emision ? +emision[3] : new Date().getFullYear(), mesEm = emision ? MESES[emision[2]] || 1 : 1, diaEm = emision ? +emision[1] : 1;
  const fechaVuelo = (dia, mes) => {
    const mm = MESES[mes]; if (!mm || +dia < 1 || +dia > new Date(Date.UTC(2024, mm, 0)).getUTCDate()) return '';
    const anio = mm < mesEm || (mm === mesEm && +dia < diaEm) ? anioEm + 1 : anioEm;
    return `${anio}-${String(mm).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  };
  const emisora = (buscar(/ISSUING AIRLINE[^:]*:\s*(.+)$/) || [])[1] || '';
  const tramos = tramosCrudos.map(({ m, destino }) => {
    const [, origen, cia, vuelo, clase, dia, mes, sale, llega, mas, tarifa, equipaje, estado] = m;
    // Por nombre de la emisora solo las del catálogo sin código IATA verificado (Albatros, SASCA): otro código es otra aerolínea.
    const a = AEROLINEAS.find(x => x.iata && x.iata === cia) || AEROLINEAS.find(x => !x.iata && emisora && norm(emisora).startsWith(norm(x.nombre).split(' ')[0]));
    const oI = iataDeCiudad(origen), dI = iataDeCiudad(destino);
    return {
      aerolinea: a?.id || 'otra', aerolinea_nombre: a ? '' : titulo(emisora.replace(/\s+(C\.?A\.?|S\.?A\.?)$/, '')) || cia, iata: cia, vuelo: String(+vuelo),
      reserva: reserva?.[1] || '', origen: oI || titulo(origen), origen_ciudad: oI ? '' : titulo(origen), destino: dI || titulo(destino), destino_ciudad: dI ? '' : titulo(destino),
      fecha: fechaVuelo(dia, mes), sale: hhmm(sale), llega: hhmm(llega), llega_dia: mas ? +mas : 0,
      clase, cabina: cabinaDe(clase), equipaje, tarifa: tarifa || '', estado,
    };
  });

  const iAg = idx(/ISSUE DATE/), iOf = idx(/^OFFICE ID/);
  const agencia = iAg >= 0 ? L[iAg].replace(/\s*ISSUE DATE.*$/, '').trim() : '';
  const dirAg = iAg >= 0 && iOf > iAg ? [...new Set(L.slice(iAg + 1, iOf).map(sinCola).join(', ').split(',').map(s => s.trim()).filter(Boolean))].join(', ') : '';
  const iDir = idx(/^ADDRESS(\/DIRECCION)?\s*:/), iFis = idx(/^(RIF|NIT)\s*:/);
  const dirAe = iDir >= 0 ? [L[iDir].replace(/^ADDRESS(\/DIRECCION)?\s*:\s*/, ''), ...L.slice(iDir + 1, iFis > iDir ? iFis : iDir + 1)].join(', ').replace(/,\s*,/g, ',') : '';
  const fiscal = iFis >= 0 ? L[iFis].replace(/\s*:\s*/, ' ') : '';
  const iCon = idx(/^CONTRATO DE BOLETO/);
  const contrato = iCon >= 0 ? L.slice(iCon + 1).join(' ').trim() : '';
  const docm = foid?.[1]?.match(/(?:^|ID|NI|PP)([VEJ])(?:CI)?(\d{5,9})$/);
  return {
    boleto: boleto ? `${boleto[1]}-${boleto[2]}` : '',
    pasajero: { apellido: nombre?.[1]?.trim() || '', nombre: nombre?.[2]?.trim() || '', documento: docm ? `${docm[1]}-${docm[2]}` : (foid?.[1] || ''), tipo: 'ADT' },
    reserva: reserva?.[1] || '',
    tramos,
    emision: {
      fecha: emision ? `${emision[3]}-${String(MESES[emision[2]] || 1).padStart(2, '0')}-${emision[1].padStart(2, '0')}T${emision[4] ? emision[4].padStart(2, '0') + ':' + emision[5] : '00:00'}` : '',
      agencia, direccion: titulo(dirAg), office_id: (buscar(/OFFICE ID:\s*(\S+)/) || [])[1] || '', agente: (buscar(/ISSUE AGENT[^:]*:\s*(\S+)/) || [])[1] || '',
      telefono: (buscar(/TELEPHONE[^:]*:\s*([\d +()-]{6,})/) || [])[1]?.trim() || '', email: ((buscar(/MAIL INFO:\s*(\S+@\S+)/) || [])[1] || '').toLowerCase(),
    },
    emisora: { nombre: titulo(emisora), fiscal, direccion: titulo(dirAe), contrato: contrato ? contrato.charAt(0) + contrato.slice(1).toLowerCase() : '' },
  };
}

export const snapshotAsesor = a => { const nombre = String(a?.nombre || '').trim(); return nombre ? { id: String(a.id || ''), nombre } : null; };
export const asesoresVisibles = lista => (Array.isArray(lista) ? lista : []).filter(a => a && a.rol === 'asesor' && a.activo !== false && a.visible !== false && !a.es_prueba && !/^(__gate|prueba|invitado)/i.test(String(a.nombre || '').trim()))
  .map(snapshotAsesor).filter(a => a?.id).filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
export const datosVacios = () => ({ pasajeros: [], tramos: [], emision: {}, emisoras: {}, notas: '', asesor: null });
const clavePax = p => `${norm(p.apellido)}/${norm(p.nombre)}|${String(p.documento || '').replace(/\D/g, '')}`;
const claveTramo = t => [t.iata || claveAerolinea(t), String(+t.vuelo || t.vuelo), t.fecha, norm(t.origen), norm(t.destino), norm(t.reserva)].join('|');

// Junta los recibos leídos (uno por boleto) en un solo documento, sobre lo que ya haya en `base`.
export function unirBoletos(recibos, base = datosVacios()) {
  const d = JSON.parse(JSON.stringify(base));
  d.pasajeros ||= []; d.tramos ||= []; d.emision ||= {}; d.emisoras ||= {}; d.asesor = snapshotAsesor(d.asesor);
  for (const r of recibos.filter(Boolean)) {
    for (const t of r.tramos) if (!d.tramos.some(x => claveTramo(x) === claveTramo(t))) d.tramos.push(t);
    const k = clavePax(r.pasajero);
    let p = d.pasajeros.find(x => clavePax(x) === k);
    if (!p && (r.pasajero.apellido || r.pasajero.nombre)) d.pasajeros.push(p = { ...r.pasajero, boletos: {} });
    if (p && r.boleto) r.tramos.forEach(t => { p.boletos[grupoDe(t)] = r.boleto; });
    for (const [c, v] of Object.entries(r.emision)) if (v && (!d.emision[c] || (c === 'fecha' && v > d.emision[c]))) d.emision[c] = v;
    const t0 = r.tramos[0];
    if (t0 && (r.emisora.fiscal || r.emisora.direccion || r.emisora.contrato)) d.emisoras[claveAerolinea(t0)] = { ...d.emisoras[claveAerolinea(t0)], ...Object.fromEntries(Object.entries(r.emisora).filter(([, v]) => v)) };
  }
  d.tramos.sort((a, b) => `${a.fecha} ${a.sale}`.localeCompare(`${b.fecha} ${b.sale}`));
  return d;
}

// Lo que impide guardar (duro) y lo que conviene revisar (suave).
export function revisar(d) {
  const duros = [], suaves = [];
  if (!d.tramos.length) duros.push('Agrega al menos un vuelo');
  d.tramos.forEach((t, i) => {
    const n = `Vuelo ${i + 1}`;
    if (t.aerolinea === 'otra' && !t.aerolinea_nombre) duros.push(`${n}: falta la aerolínea`);
    if (!t.origen || !t.destino) duros.push(`${n}: falta origen o destino`);
    if (!t.fecha) duros.push(`${n}: falta la fecha`);
    if (!t.sale) duros.push(`${n}: falta la hora de salida`);
    if (!t.vuelo) suaves.push(`${n}: falta el número de vuelo`);
    if (!t.llega) suaves.push(`${n}: falta la hora de llegada`);
    if (!/^[A-Z0-9]{5,8}$/.test(norm(t.reserva))) suaves.push(`${n}: revisa el código de reserva`);
  });
  if (!d.pasajeros.length) duros.push('Agrega al menos un pasajero');
  const grupos = gruposDe(d);
  d.pasajeros.forEach((p, i) => {
    const n = nombreTxt(p) || `Pasajero ${i + 1}`;
    if (!p.apellido || !p.nombre) duros.push(`${n}: falta nombre o apellido`);
    grupos.forEach(g => {
      const b = String(p.boletos?.[g.clave] || '').replace(/[\s-]/g, '');
      if (!b) suaves.push(`${n}: falta el N° de boleto de ${g.aerolinea.nombre}`);
      else if (!/^\d{13}$/.test(b)) suaves.push(`${n}: el boleto de ${g.aerolinea.nombre} no tiene 13 dígitos`);
    });
  });
  return { duros, suaves };
}

// ---------- PDF (carta, jsPDF) ----------
const rgb = hex => { const h = String(hex).replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
// Tomado de las condiciones generales del voucher (VC_TERMINOS › SERVICIO DE BOLETOS AÉREOS), sin políticas nuevas.
const ANTES_DE_VOLAR = [
  'Preséntese en el aeropuerto 2 horas antes de la salida si el vuelo es nacional y 4 horas antes si es internacional.',
  'Lleve un documento de identidad con fotografía (cédula o pasaporte) con los mismos datos del boleto.',
  'Si viaja con menores de edad: partida de nacimiento y permiso de viaje expedido por el ente encargado.',
  'Si no se presenta al primer tramo, el tramo siguiente se cancela automáticamente.',
  'Boletos no reembolsables, no transferibles y no endosables; sujetos a las condiciones de la tarifa y de la aerolínea.',
];

export async function construirPdf(d, numero, c) {
  await c.librerias();
  const { jsPDF } = globalThis.jspdf;
  let fuentes = [], F = 'helvetica', st = s => (s === 'normal' || s === 'medium' ? 'normal' : 'bold');
  try { fuentes = await c.fuentes(); F = 'Poppins'; st = s => s; } catch (_e) { /* sin Poppins sale en Helvetica */ }
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  fuentes.forEach(([a, e, b]) => { doc.addFileToVFS(a, b); doc.addFont(a, 'Poppins', e); });
  const P = c.paleta, limpiar = c.limpiar || (s => String(s ?? '').trim());
  const tinte = (col, k) => col.map(v => Math.round(v + (255 - v) * k));
  const imagen = async src => { try { const u = await c.imagen(src); return String(u).startsWith('data:image/png') ? u : null; } catch (_e) { return null; } };
  // Logo en negro: se tiñe el de color (mismas proporciones que espera el membrete).
  const enNegro = u => new Promise(ok => {
    if (!u) return ok(null);
    const im = new Image();
    im.onload = () => {
      const cv = Object.assign(document.createElement('canvas'), { width: im.naturalWidth, height: im.naturalHeight }), g = cv.getContext('2d');
      g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
      ok(cv.toDataURL('image/png'));
    };
    im.onerror = () => ok(u);
    im.src = u;
  });
  const logo = await enNegro(await imagen('logo-color.png'));
  const logos = {};
  for (const t of d.tramos) { const a = aerolineaDe(t); if (a.logo && !(a.id in logos)) logos[a.id] = await imagen(logoDe(a)); }
  const font = (s, size, col) => { doc.setFont(F, st(s)); doc.setFontSize(size); doc.setTextColor(...col); };
  const X0 = 40, X1 = 572, W = X1 - X0, ALTO = 792, PIE = 748;
  let y = 0;
  const asegurar = h => { if (y + h > PIE) { doc.addPage(); y = 48; } };
  const titulo2 = (es, en) => {
    asegurar(40);
    font('bold', 9, P.navy); doc.text(es, X0, y, { charSpace: 1 });
    const w = doc.getTextWidth(es) + es.length * 1;
    font('normal', 7, P.gris); doc.text(en, X0 + w + 8, y);
    doc.setDrawColor(...P.linea); doc.setLineWidth(.8); doc.line(X0, y + 7, X1, y + 7);
    y += 18;
  };
  const conLogo = (a, x, yy, mw, mh) => {
    const im = logos[a.id];
    if (im) {
      const p = doc.getImageProperties(im), k = Math.min(mw / p.width, mh / p.height);
      doc.addImage(im, 'PNG', x, yy + (mh - p.height * k) / 2, p.width * k, p.height * k);
    } else {
      font('bold', 12, a.color ? rgb(a.color) : P.navy);
      doc.text(doc.splitTextToSize(limpiar(a.nombre), mw)[0], x, yy + mh / 2 + 4);
    }
  };
  const grupos = gruposDe(d), todosOk = d.tramos.every(t => confirmado(t.estado));

  // ---------- Membrete y banda ----------
  c.membrete(doc, { F, st, logo });
  doc.setFillColor(...P.navy); doc.rect(X0, 112, W, 44, 'F');
  font('bold', 15, [255, 255, 255]); doc.text('BOLETO ELECTRÓNICO', X0 + 16, 132, { charSpace: .8 });
  font('normal', 7.8, tinte(P.navy, .7)); doc.text('Recibo de itinerario  ·  E-ticket itinerary receipt', X0 + 16, 146);
  const chip = todosOk ? 'CONFIRMADO' : 'POR CONFIRMAR', colChip = todosOk ? P.verde : P.ambarOsc;
  font('bold', 7.5, [255, 255, 255]);
  const cw = doc.getTextWidth(chip) + 20;
  doc.setFillColor(...colChip); doc.roundedRect(X1 - 16 - cw, 120, cw, 16, 8, 8, 'F');
  doc.text(chip, X1 - 16 - cw / 2, 131, { align: 'center', charSpace: .6 });
  const em = fechaHoraTxt(d.emision?.fecha);
  if (em) { font('normal', 7.5, tinte(P.navy, .7)); doc.text(`Emitido ${em}`, X1 - 16, 148, { align: 'right' }); }
  y = 168;

  // ---------- Datos clave ----------
  const cajaW = (W - 16) / 3, cajaH = 52;
  const caja = (i, es, en, filas) => {
    const x = X0 + i * (cajaW + 8);
    doc.setFillColor(...P.suave); doc.setDrawColor(...P.linea); doc.setLineWidth(.8); doc.roundedRect(x, y, cajaW, cajaH, 6, 6, 'FD');
    font('semibold', 6.6, P.gris); doc.text(es, x + 11, y + 13, { charSpace: .8 });
    const we = doc.getTextWidth(es) + es.length * .8; font('normal', 6, tinte(P.gris, .35)); doc.text(en, x + 11 + we + 5, y + 13);
    filas.forEach(([txt, size, estilo, col], k) => { font(estilo, size, col || P.navy); doc.text(doc.splitTextToSize(limpiar(txt), cajaW - 22)[0] || '', x + 11, y + 28 + k * (size + 3)); });
  };
  const resv = grupos.filter(g => g.reserva);
  caja(0, 'CÓDIGO DE RESERVA', 'Booking ref', resv.length === 1 ? [[resv[0].reserva, 18, 'bold'], [resv[0].aerolinea.nombre, 7.5, 'normal', P.gris]]
    : resv.length === 2 ? resv.map(g => [`${g.reserva}  ·  ${g.aerolinea.nombre}`, 10.5, 'bold'])
    : resv.length ? [[resv.map(g => g.reserva).join('  ·  '), 10.5, 'bold'], [`${resv.length} reservas`, 7.5, 'normal', P.gris]] : [['—', 14, 'bold']]);
  const pax = d.pasajeros;
  caja(1, 'PASAJERO', 'Passenger', pax.length === 1 ? [[nombreTxt(pax[0]), 11.5, 'bold'], [docTxt(pax[0].documento), 8, 'normal', P.gris]]
    : [[`${pax.length} pasajeros`, 11.5, 'bold'], [pax.slice(0, 2).map(nombreTxt).join(', ') + (pax.length > 2 ? '…' : ''), 7.5, 'normal', P.gris]]);
  const ruta = d.tramos.reduce((r, t, i) => { const o = lugar(t.origen).iata || t.origen, de = lugar(t.destino).iata || t.destino; if (!i || r[r.length - 1] !== o) r.push(o); r.push(de); return r; }, []);
  const f0 = d.tramos[0]?.fecha, f1 = d.tramos[d.tramos.length - 1]?.fecha;
  font('bold', 11.5, P.navy);
  // Ruta larga: origen, la escala donde más días se queda (el destino real) y el final.
  const estadia = i => (fechaDe(d.tramos[i + 1].fecha) - fechaDe(d.tramos[i].fecha)) || 0;
  const iDest = d.tramos.slice(0, -1).reduce((m, _t, i) => (estadia(i) > estadia(m) ? i : m), 0);
  const principal = lugar(d.tramos[iDest]?.destino).iata || d.tramos[iDest]?.destino;
  const rutaTxt = doc.getTextWidth(ruta.join(' - ')) <= cajaW - 22 ? ruta.join(' - ') : [...new Set([ruta[0], principal])].concat(ruta[ruta.length - 1]).join(' - ');
  caja(2, 'RUTA', 'Route', [[rutaTxt, 11.5, 'bold'], [f0 === f1 ? fechaCorta(f0) : `${fechaCorta(f0)}  al  ${fechaCorta(f1)}`, 8, 'normal', P.gris]]);
  y += cajaH + 20;

  // ---------- Itinerario ----------
  titulo2('SU ITINERARIO', 'Itinerary');
  const tarjetaH = 88;
  d.tramos.forEach(t => {
    asegurar(tarjetaH + 10);
    const a = aerolineaDe(t), col = a.color ? rgb(a.color) : P.navy, o = lugar(t.origen, t.origen_ciudad), de = lugar(t.destino, t.destino_ciudad);
    doc.setDrawColor(...P.linea); doc.setLineWidth(.8); doc.setFillColor(255, 255, 255); doc.roundedRect(X0, y, W, tarjetaH, 7, 7, 'FD');
    doc.setFillColor(...col); doc.rect(X0, y + 7, 4, tarjetaH - 14, 'F');
    // Columna aerolínea
    const xa = X0 + 16;
    conLogo(a, xa, y + 10, 118, 30);
    font('semibold', 7.5, P.gris); doc.text(doc.splitTextToSize(limpiar(a.nombre), 128)[0], xa, y + 52);
    font('bold', 11, P.navy); doc.text(`Vuelo ${[t.iata || a.iata, t.vuelo].filter(Boolean).join(' ')}`.trim(), xa, y + 65);
    font('normal', 7.5, P.gris); doc.text(`${t.cabina || cabinaDe(t.clase)}${t.clase ? ` (clase ${t.clase})` : ''}`, xa, y + 77);
    // Columna ruta
    const xm0 = X0 + 168, xm1 = X0 + 388;
    doc.setDrawColor(...P.linea); doc.line(xm0 - 14, y + 12, xm0 - 14, y + tarjetaH - 12);
    font('semibold', 8, P.ambarOsc); doc.text(fechaLarga(t.fecha).toUpperCase(), xm0, y + 19, { charSpace: .5 });
    font('bold', 21, P.navy); doc.text(t.sale || '--:--', xm0, y + 45);
    const wSale = doc.getTextWidth(t.sale || '--:--');
    doc.text(t.llega || '--:--', xm1, y + 45, { align: 'right' });
    const wLlega = doc.getTextWidth(t.llega || '--:--');
    if (llegaOtroDia(t)) { font('bold', 7, P.naranja); doc.text('+1', xm1 + 2, y + 34); }
    const l0 = xm0 + wSale + 12, l1 = xm1 - wLlega - 12, ly = y + 38;
    if (l1 - l0 > 30) {
      doc.setDrawColor(...tinte(P.navy, .55)); doc.setLineWidth(.9); doc.setLineDashPattern([2, 2], 0); doc.line(l0 + 4, ly, l1 - 6, ly); doc.setLineDashPattern([], 0);
      doc.setFillColor(...P.navy); doc.circle(l0 + 2, ly, 2, 'F'); doc.triangle(l1 - 7, ly - 3.5, l1 - 7, ly + 3.5, l1, ly, 'F');
      const dur = duracionTxt(t);
      if (dur) { font('normal', 7, P.gris); doc.text(dur, (l0 + l1) / 2, ly - 6, { align: 'center' }); }
    }
    font('bold', 11, P.navy); doc.text(o.iata || '', xm0, y + 61); doc.text(de.iata || '', xm1, y + 61, { align: 'right' });
    font('normal', 7.5, P.gris);
    doc.text(doc.splitTextToSize(limpiar(o.ciudad), 105)[0] || '', xm0, y + (o.iata ? 72 : 61));
    doc.text(doc.splitTextToSize(limpiar(de.ciudad), 105)[0] || '', xm1, y + (de.iata ? 72 : 61), { align: 'right' });
    // Columna detalles
    const xd = X0 + 404;
    doc.setDrawColor(...P.linea); doc.line(xd - 12, y + 12, xd - 12, y + tarjetaH - 12);
    const det = (k, v, yy, col2 = P.navy, est = 'semibold') => { font('semibold', 6.4, P.gris); doc.text(k, xd, yy, { charSpace: .6 }); font(est, 8.4, col2); doc.text(doc.splitTextToSize(limpiar(v) || '—', X1 - xd - 12)[0], xd, yy + 10); };
    det('CÓDIGO DE RESERVA', norm(t.reserva), y + 18, P.navy, 'bold');
    det('EQUIPAJE', equipajeTxt(t.equipaje) || 'Según la tarifa', y + 42);
    det('ESTADO', estadoTxt(t.estado), y + 66, confirmado(t.estado) ? P.verde : P.ambarOsc, 'bold');
    y += tarjetaH + 8;
  });
  y += 10;

  // ---------- Pasajeros ----------
  titulo2('PASAJEROS', 'Passengers');
  const tipoTxt = { ADT: 'Adulto', CHD: 'Niño', INF: 'Infante' };
  doc.autoTable({
    startY: y, theme: 'grid', margin: { left: X0, right: 612 - X1, bottom: ALTO - PIE }, tableWidth: W,
    styles: { font: F, fontStyle: st('medium'), fontSize: 8.6, textColor: P.navy, lineColor: P.linea, lineWidth: .6, cellPadding: { top: 5, bottom: 5, left: 8, right: 8 }, valign: 'middle' },
    headStyles: { fillColor: P.navy, textColor: 255, fontStyle: st('semibold'), fontSize: 7.4 },
    columnStyles: { 0: { cellWidth: 22, halign: 'center', textColor: P.gris } },
    head: [['#', 'Pasajero · Passenger', 'Documento', ...grupos.map(g => `Boleto ${g.aerolinea.nombre}${grupos.length > 1 && g.reserva ? ` (${g.reserva})` : ''}`)]],
    body: pax.map((p, i) => [i + 1, { content: `${nombreTxt(p)}${p.tipo && p.tipo !== 'ADT' ? `  (${tipoTxt[p.tipo] || p.tipo})` : ''}`, styles: { fontStyle: st('semibold') } }, docTxt(p.documento) || '—',
      ...grupos.map(g => ({ content: boletoTxt(p.boletos?.[g.clave]) || '—', styles: { fontStyle: st('bold') } }))].map(v => (typeof v === 'object' ? { ...v, content: limpiar(v.content) } : limpiar(String(v))))),
  });
  y = doc.lastAutoTable.finalY + 16;

  const asesor = snapshotAsesor(d.asesor);
  if (asesor) {
    font('medium', 8.6, P.navy);
    const lineas = doc.splitTextToSize(limpiar(`Asesor: ${asesor.nombre}`), W), max = Math.floor((PIE - 48 - 9) / 11);
    for (let i = 0; i < lineas.length; i += max) {
      const parte = lineas.slice(i, i + max); asegurar(parte.length * 11 + 9);
      font('medium', 8.6, P.navy); parte.forEach((l, k) => doc.text(l, X0, y + 9 + k * 11)); y += parte.length * 11 + 9;
    }
  }

  // ---------- Antes de volar ----------
  const vinetas = [...ANTES_DE_VOLAR, ...(d.notas ? [d.notas] : [])].map(limpiar);
  font('normal', 8, P.cuerpo);
  const lineasV = vinetas.map(v => doc.splitTextToSize(v, W - 46));
  const altoV = 28 + lineasV.reduce((h, l) => h + l.length * 10 + 2, 0);
  asegurar(altoV + 10);
  doc.setFillColor(...tinte(P.ambar, .88)); doc.roundedRect(X0, y, W, altoV, 6, 6, 'F');
  doc.setFillColor(...P.ambar); doc.rect(X0, y + 6, 4, altoV - 12, 'F');
  font('bold', 8.6, P.ambarOsc); doc.text('ANTES DE VOLAR', X0 + 16, y + 17, { charSpace: .8 });
  let yv = y + 30;
  lineasV.forEach(ls => {
    doc.setFillColor(...P.ambarOsc); doc.circle(X0 + 20, yv - 2.6, 1.6, 'F');
    font('normal', 8, P.cuerpo); ls.forEach((l, k) => doc.text(l, X0 + 28, yv + k * 10));
    yv += ls.length * 10 + 2;
  });
  y += altoV + 16;

  // ---------- Datos de emisión (letra chica) ----------
  const e = d.emision || {};
  const izq = [e.agencia && `Agencia emisora: ${e.agencia}`, e.direccion, [e.office_id && `Office ID ${e.office_id}`, e.agente && `Agente ${e.agente}`].filter(Boolean).join('  ·  '),
    [e.telefono && `Tel. ${e.telefono}`, e.email].filter(Boolean).join('  ·  '), em && `Fecha de emisión: ${em}`].filter(Boolean);
  const emisoras = grupos.filter((g, i, arr) => arr.findIndex(x => x.aerolinea.id === g.aerolinea.id && x.aerolinea.nombre === g.aerolinea.nombre) === i).map(g => {
    // Lo leído del PDF completa; los datos legales cargados a mano en AEROLINEAS mandan (vienen con acentos y mayúsculas bien).
    const a = g.aerolinea, ex = { ...(d.emisoras?.[g.clave.split('|')[0]] || {}), ...Object.fromEntries(['razon', 'fiscal', 'direccion', 'contrato'].filter(k => AER[a.id]?.[k]).map(k => [k, AER[a.id][k]])) };
    return { nombre: ex.razon || a.nombre, fiscal: ex.fiscal, direccion: ex.direccion, contrato: ex.contrato || '' };
  });
  const der = emisoras.flatMap(a => [`Aerolínea emisora: ${a.nombre}`, [a.fiscal, a.direccion].filter(Boolean).join('  ·  ')].filter(Boolean));
  font('normal', 6.8, P.gris);
  const colW = (W - 20) / 2;
  const li = izq.flatMap(s => doc.splitTextToSize(limpiar(s), colW)), ld = der.flatMap(s => doc.splitTextToSize(limpiar(s), colW));
  const contratos = emisoras.filter(a => a.contrato).map(a => doc.splitTextToSize(limpiar(`${a.nombre.toUpperCase()}: ${a.contrato}`), W));
  asegurar(Math.max(li.length, ld.length) * 8.5 + 24);
  titulo2('DATOS DE EMISIÓN', 'Issue data');
  font('normal', 6.8, P.gris);
  li.forEach((l, k) => doc.text(l, X0, y + k * 8.5));
  ld.forEach((l, k) => doc.text(l, X0 + colW + 20, y + k * 8.5));
  y += Math.max(li.length, ld.length) * 8.5 + 6;
  contratos.forEach(ls => { asegurar(ls.length * 7.5 + 3); font('normal', 6, tinte(P.gris, .15)); ls.forEach((l, k) => doc.text(l, X0, y + k * 7.5)); y += ls.length * 7.5 + 3; });

  // ---------- Pie en todas las hojas ----------
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...P.linea); doc.setLineWidth(.6); doc.line(X0, 758, X1, 758);
    font('normal', 7, P.gris);
    doc.text(['Destino y Eventos Lotus 360', numeroTxt(numero)].filter(Boolean).join('  ·  '), X0, 770);
    doc.text(`Página ${i} de ${n}`, X1, 770, { align: 'right' });
  }
  const { codificarMetadatos } = await import('./reservas-importacion-datos.js');
  doc.setProperties({ subject: codificarMetadatos(d) });
  return doc.output('blob');
}

export function nombreArchivo(d, slug = s => String(s).replace(/[^A-Za-z0-9]+/g, '-')) {
  const g = gruposDe(d).find(x => x.reserva), p = d.pasajeros[0];
  return `Boleto-${slug([g?.reserva, p && nombreTxt(p)].filter(Boolean).join(' ') || 'Lotus360')}.pdf`;
}

// ---------- Sección ----------
export function crearBoletosEmitidos(c) {
  const { sb, esc, raiz } = c;
  let montado = false, vista = 'editor', d = datosVacios(), editando = null, aviso = null, ocupado = false, pedido = 0, verAnulados = false, histQ = '';
  let lote = [], iLote = 0, modo = 'reserva', crudos = [], porCompartir = null;
  let asesores = [], cargandoAsesores = false, errorAsesores = false;
  const asesorPorRecibo = new WeakMap(), recibosPorDocumento = new WeakMap();
  try { modo = localStorage.getItem('be_modo_lote') || 'reserva'; } catch (_e) { /* sin almacenamiento */ }
  const $ = sel => raiz.querySelector(sel);
  const permitido = () => ['admin', 'boleteria'].includes(typeof c.rol === 'function' ? c.rol() : c.rol);

  function css() {
    if (document.getElementById('be-css')) return;
    const st = document.createElement('style'); st.id = 'be-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const emisorGuardado = () => { try { return { ...BT_TRAVEL, ...JSON.parse(localStorage.getItem(CLAVE_EMISOR) || '{}') }; } catch (_e) { return { ...BT_TRAVEL }; } };
  const recordarEmisor = e => { try { const { fecha, ...resto } = e; localStorage.setItem(CLAVE_EMISOR, JSON.stringify(resto)); } catch (_e) { /* sin almacenamiento, se vuelve a escribir */ } };
  const ahoraIso = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 16);
  const nuevo = () => {
    d = datosVacios(); d.emision = { ...emisorGuardado(), fecha: ahoraIso() };
    d.tramos.push(tramoVacio()); d.pasajeros.push(paxVacio());
    editando = null; aviso = null; lote = []; iLote = 0; crudos = [];
  };
  const tramoVacio = (prev) => ({ aerolinea: prev?.aerolinea || '', aerolinea_nombre: prev?.aerolinea_nombre || '', iata: prev?.iata || '', vuelo: '', reserva: prev?.reserva || '', origen: prev?.destino || '', origen_ciudad: prev?.destino_ciudad || '', destino: prev?.origen || '', destino_ciudad: prev?.origen_ciudad || '', fecha: '', sale: '', llega: '', llega_dia: 0, clase: '', cabina: prev?.cabina || 'Económica', equipaje: prev?.equipaje || '', tarifa: '', estado: 'OK' });
  const paxVacio = () => ({ apellido: '', nombre: '', documento: '', tipo: 'ADT', boletos: {} });

  function marco() {
    raiz.innerHTML = `<div class="be-root">
      <div class="be-cab">
        <div><h2><i class="fas fa-ticket"></i> Boletos emitidos</h2>
          <div class="csub">Recibo de itinerario con el logo de la aerolínea, claro para el cliente. Sube el PDF del consolidador, o fotos y capturas del boleto, y se llena solo.</div></div>
        <div class="be-tabs" role="tablist"><button type="button" role="tab" data-vista="editor">Nuevo boleto</button><button type="button" role="tab" data-vista="historial">Historial</button></div>
      </div>
      <div data-panel="editor"><div class="be-layout">
        <div class="be-form">
          <label class="be-drop" id="be-drop"><i class="fas fa-file-arrow-up"></i><span>${matchMedia('(pointer:coarse)').matches ? '<b>Toca para subir los boletos</b><small>PDF, fotos o capturas · varios a la vez</small>' : '<b>Suelta aquí los boletos</b><small>o tócalo para elegirlos · PDF, fotos o capturas, varios a la vez</small>'}</span>
            <input type="file" id="be-archivo" accept="application/pdf,.pdf,image/*" multiple></label>
          <div class="be-modo"><span>Si subes varios:</span><div class="be-tabs" role="radiogroup" aria-label="Cómo agrupar varios boletos">${[['reserva', 'Un PDF por reserva'], ['pasajero', 'Un PDF por pasajero'], ['juntos', 'Todos en un PDF']].map(([v, l]) => `<button type="button" role="radio" data-modo="${v}">${l}</button>`).join('')}</div></div>
          <div id="be-lote"></div>
          <div id="be-aviso"></div>
          <div class="card be-bloque"><h3><i class="fas fa-plane"></i> Vuelos</h3><div id="be-tramos"></div>
            <button type="button" class="be-agregar" data-acc="tramo"><i class="fas fa-plus"></i> Agregar vuelo</button></div>
          <div class="card be-bloque"><h3><i class="fas fa-user"></i> Pasajeros</h3><div id="be-pasajeros"></div>
            <button type="button" class="be-agregar" data-acc="pax"><i class="fas fa-plus"></i> Agregar pasajero</button>
            <div class="field"><label class="fl" for="be-notas">Nota para el pasajero (opcional, sale en «Antes de volar»)</label><textarea id="be-notas" class="ei" rows="2" data-k="notas"></textarea></div></div>
          <div class="card be-bloque"><div class="field"><label class="fl" for="be-asesor">Asesor (opcional, solo nombre en el boleto)</label><select class="ei" id="be-asesor" data-k="asesor" aria-describedby="be-asesor-estado"></select></div><div id="be-asesor-estado" class="be-estado" role="status"></div></div>
          <details class="card be-bloque" id="be-emision"><summary><i class="fas fa-building"></i> Datos de emisión <small id="be-emision-res"></small></summary><div class="be-grid" id="be-emision-campos"></div></details>
        </div>
        <aside class="card be-lateral" aria-label="Vista previa del boleto">
          <h3>Vista previa</h3><div class="be-estado" id="be-estado"></div>
          <div id="be-previa"></div>
          <div class="be-acciones">
            <button type="button" class="be-btn prim" data-acc="guardar"><i class="fas fa-file-pdf"></i> Guardar y generar PDF</button>
            <button type="button" class="be-btn" data-acc="ver"><i class="fas fa-eye"></i> Ver PDF sin guardar</button>
            <button type="button" class="be-btn" data-acc="nuevo"><i class="fas fa-rotate-left"></i> Empezar uno nuevo</button>
          </div>
        </aside>
      </div></div>
      <div data-panel="historial" hidden><div class="card">
        <div class="be-hist-barra"><input class="ei" id="be-buscar" type="search" placeholder="Buscar por pasajero, cédula, código de reserva o N° de boleto…" autocomplete="off">
          <label><input type="checkbox" id="be-anulados"> Ver anulados</label></div>
        <div id="be-lista"></div></div></div>
      <datalist id="be-aeropuertos"></datalist><datalist id="be-equipajes"><option value="23K">1 maleta 23 kg</option><option value="1P">1 pieza</option><option value="2P">2 piezas</option><option value="46K">46 kg</option><option value="0P">Sin equipaje</option></datalist>
    </div>`;
    raiz.addEventListener('click', alClic);
    raiz.addEventListener('input', alEscribir);
    raiz.addEventListener('change', alEscribir);
    const drop = $('#be-drop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('sobre'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('sobre')));
    drop.addEventListener('drop', e => { e.preventDefault(); importar([...(e.dataTransfer?.files || [])]); });
    $('#be-archivo').addEventListener('change', e => { importar([...e.target.files]); e.target.value = ''; });
    let t = null;
    $('#be-buscar').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { histQ = e.target.value; cargarHistorial(); }, 300); });
    $('#be-anulados').addEventListener('change', e => { verAnulados = e.target.checked; cargarHistorial(); });
  }

  const opcionesAerolinea = sel => ['nacional', 'internacional'].map(g => `<optgroup label="${g === 'nacional' ? 'Nacionales' : 'Internacionales'}">${AEROLINEAS.filter(a => a.grupo === g).map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}</optgroup>`).join('')
    + `<option value="otra" ${sel === 'otra' ? 'selected' : ''}>Otra aerolínea…</option>`;
  const chipLogo = a => (a.logo ? `<span class="be-logo"><img src="${logoDe(a)}" alt="${esc(a.nombre)}"></span>` : `<span class="be-logo"><span>${esc(a.nombre)}</span></span>`);
  const movil = matchMedia('(max-width:640px)').matches;
  // sp = 'escritorio/celular' en columnas de 12/6 (ver .be-grid).
  const ancho = sp => { if (!sp) return ''; const [c, m] = sp.split('/'); return ` style="--c:${c};--m:${m}"`; };
  const campo = (lbl, k, v, extra = '', cls = '', sp = '') => `<div class="field ${cls}"${ancho(sp)}><label class="fl">${lbl}</label><input class="ei" data-k="${k}" value="${esc(v ?? '')}" ${extra}></div>`;
  const hora = (lbl, k, v, cls) => campo(lbl, k, v, 'inputmode="numeric" maxlength="5" placeholder="--:--" autocomplete="off" data-hora', cls, '2/2');
  const ESTADOS = [['OK', 'Confirmado'], ['RQ', 'En lista de espera'], ['SA', 'Sujeto a espacio']];
  const masRes = t => [t.clase && `Clase ${t.clase}`, t.cabina || 'Económica', t.equipaje && equipajeTxt(t.equipaje), (ESTADOS.find(([v]) => v === (norm(t.estado) || 'OK')) || ESTADOS[0])[1], t.tarifa].filter(Boolean).join(' · ');
  const fechaBoton = iso => {
    const f = fechaDe(iso); if (!f) return '<span class="ph">Elegir fecha</span>';
    const o = { timeZone: 'UTC' }, sinPunto = s => s.replace(/\./g, '');
    const dia = sinPunto(f.toLocaleDateString('es-VE', { ...o, weekday: 'short' }));
    const resto = sinPunto(f.toLocaleDateString('es-VE', { ...o, day: 'numeric', month: 'short', ...(iso.slice(0, 4) !== hoyVe().slice(0, 4) ? { year: 'numeric' } : {}) }));
    return `<span><span class="be-fecha-dia">${dia}</span> ${resto}</span>`;
  };

  // Calendario en línea (mismo lenguaje que el editor de servicios de la Reserva), no el popup global de los type=date.
  let cal = null;
  const MESES_CAL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const mesesVisibles = () => (matchMedia('(max-width:640px)').matches ? 1 : 2);
  function calHtml() {
    const i = cal.i, t = d.tramos[i], hoy = hoyVe(), prev = d.tramos[i - 1]?.fecha;
    const otros = new Set(d.tramos.filter((x, k) => k !== i && x.fecha).map(x => x.fecha));
    const mes = ym => {
      const [y, m] = ym.split('-').map(Number), off = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
      let h = '<span></span>'.repeat(off);
      for (let k = 1; k <= diasDelMes(ym); k++) {
        const iso = `${ym}-${String(k).padStart(2, '0')}`, cls = [iso === t.fecha && 'sel', iso === hoy && 'hoy', iso < hoy && 'pasado', otros.has(iso) && 'otro'].filter(Boolean).join(' ');
        h += `<button type="button" data-dia="${iso}" class="${cls}" tabindex="${iso === cal.foco ? 0 : -1}" aria-label="${esc(fechaLarga(iso))}${otros.has(iso) ? ', otro vuelo' : ''}"${iso === t.fecha ? ' aria-current="date"' : ''}>${k}</button>`;
      }
      return `<div class="be-cal-mes"><div class="be-cal-tit">${MESES_CAL[m - 1]} ${y}</div><div class="be-cal-sem" aria-hidden="true">${['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'].map(x => `<span>${x}</span>`).join('')}</div><div class="be-cal-grid">${h}</div></div>`;
    };
    const ruta = [t.origen, t.destino].filter(Boolean).join(' → ');
    const chips = [['Hoy', hoy], ['Mañana', isoSum(hoy, 1)], ...(prev ? [[`Mismo día que el vuelo ${i}`, prev], [`Día después del vuelo ${i}`, isoSum(prev, 1)]] : [])];
    return `<div class="be-cal-cab"><button type="button" class="be-cal-nav" data-cal-mes="-1" aria-label="Mes anterior"><i class="fas fa-chevron-left"></i></button>
        <span>Fecha del <b>vuelo ${i + 1}</b>${ruta ? ` · ${esc(ruta)}` : ''}</span>
        <button type="button" class="be-cal-nav" data-cal-mes="1" aria-label="Mes siguiente"><i class="fas fa-chevron-right"></i></button></div>
      <div class="be-cal-meses">${mes(cal.mes)}${mes(mesSum(cal.mes, 1))}</div>
      <div class="be-cal-pie">${chips.map(([l, v]) => `<button type="button" class="be-chip${v === t.fecha ? ' on' : ''}" data-dia="${v}">${l}</button>`).join('')}${t.fecha ? '<button type="button" class="be-chip" data-dia="">Quitar fecha</button>' : ''}<button type="button" class="be-chip be-cal-listo" data-acc="cal-cerrar">Listo</button></div>`;
  }
  const calBox = () => (cal ? $(`.be-item[data-i="${cal.i}"] .be-cal`) : null);
  function pintarCal(foco) {
    const box = calBox(); if (!box) return;
    box.innerHTML = calHtml();
    if (foco) (typeof foco === 'string' ? box.querySelector(foco) : box.querySelector('.be-cal-grid [tabindex="0"]'))?.focus({ preventScroll: true });
  }
  function abrirCal(i) {
    const foco = d.tramos[i].fecha || d.tramos[i - 1]?.fecha || hoyVe();
    cal = { i, mes: foco.slice(0, 7), foco };
    pintarTramos();
    calBox()?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    pintarCal(true);
  }
  function cerrarCal(foco) {
    const i = cal?.i; cal = null; pintarTramos();
    if (foco && i != null) $(`.be-item[data-i="${i}"] [data-acc="fecha"]`)?.focus();
  }
  function calMover(iso) {
    const ym = iso.slice(0, 7), ultimo = mesSum(cal.mes, mesesVisibles() - 1);
    if (ym < cal.mes) cal.mes = ym; else if (ym > ultimo) cal.mes = mesSum(ym, 1 - mesesVisibles());
    cal.foco = iso; pintarCal(true);
  }
  function elegirFecha(iso) {
    const i = cal.i, t = d.tramos[i];
    t.fecha = iso; cal = null; pintarTramos(); pintarPrevia();
    const item = $(`.be-item[data-i="${i}"]`);
    (iso && !t.sale ? item?.querySelector('[data-k="t.sale"]') : item?.querySelector('[data-acc="fecha"]'))?.focus();
  }
  function alTecla(e) {
    if (!cal || !e.target.closest?.('.be-cal')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarCal(true); return; }
    const dia = e.target.closest('.be-cal-grid [data-dia]'); if (!dia) return;
    const iso = dia.dataset.dia, paso = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (paso) { e.preventDefault(); calMover(isoSum(iso, paso)); return; }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const ym = mesSum(iso.slice(0, 7), e.key === 'PageUp' ? -1 : 1);
      calMover(`${ym}-${String(Math.min(+iso.slice(8), diasDelMes(ym))).padStart(2, '0')}`);
    }
  }

  function pintarTramos() {
    if (cal && !d.tramos[cal.i]) cal = null;
    $('#be-tramos').innerHTML = d.tramos.map((t, i) => {
      const a = t.aerolinea ? aerolineaDe(t) : null, abierto = cal?.i === i;
      return `<div class="be-item" data-i="${i}">
        <div class="be-item-cab"><b>Vuelo ${i + 1}</b>${a ? chipLogo(a) : ''}<button type="button" class="be-quitar" data-acc="quitar-tramo" aria-label="Quitar vuelo ${i + 1}" title="Quitar vuelo"><i class="fas fa-trash"></i></button></div>
        <div class="be-grid">
          <div class="field${t.aerolinea ? '' : ' be-falta'}"${ancho('5/6')}><label class="fl">Aerolínea</label><select class="ei" data-k="t.aerolinea"><option value="">Elige la aerolínea…</option>${opcionesAerolinea(t.aerolinea)}</select></div>
          ${campo('N° de vuelo', 't.vuelo', t.vuelo, 'inputmode="numeric" maxlength="5" placeholder="302"', '', '3/3')}
          ${campo('Código de reserva', 't.reserva', t.reserva, 'maxlength="8" placeholder="KPAKEE" autocomplete="off" style="text-transform:uppercase"', '', '4/3')}
          ${t.aerolinea === 'otra' ? campo('Nombre de la aerolínea', 't.aerolinea_nombre', t.aerolinea_nombre, '', t.aerolinea_nombre ? '' : 'be-falta', '8/4') + campo('Código (IATA)', 't.iata', t.iata, 'maxlength="3" style="text-transform:uppercase"', '', '4/2') : ''}
          ${campo('Origen', 't.origen', t.origen, 'list="be-aeropuertos" placeholder="' + (movil ? 'CCS' : 'CCS o ciudad') + '"', t.origen ? '' : 'be-falta', '2/3')}
          ${campo('Destino', 't.destino', t.destino, 'list="be-aeropuertos" placeholder="' + (movil ? 'PMV' : 'PMV o ciudad') + '"', t.destino ? '' : 'be-falta', '2/3')}
          <div class="field${t.fecha ? '' : ' be-falta'}"${ancho('4/2')}><label class="fl" id="be-fl-fecha-${i}">Fecha</label><button type="button" class="ei be-fecha${abierto ? ' on' : ''}" data-acc="fecha" aria-expanded="${abierto}" aria-labelledby="be-fl-fecha-${i} be-fb-${i}"><span id="be-fb-${i}" style="display:contents">${fechaBoton(t.fecha)}</span><i class="far fa-calendar"></i></button></div>
          ${hora('Sale', 't.sale', t.sale, t.sale ? '' : 'be-falta')}
          ${hora('Llega', 't.llega', t.llega, '')}
          ${abierto ? '<div class="be-cal be-todo" role="group" aria-label="Calendario"></div>' : ''}
          <details class="be-mas be-todo"${t._mas ? ' open' : ''}><summary><b>Más detalles</b><span class="be-mas-res">${esc(masRes(t))}</span><i class="fas fa-chevron-down" aria-hidden="true"></i></summary>
            <div class="be-grid">
              ${campo('Clase', 't.clase', t.clase, 'maxlength="1" placeholder="T" autocomplete="off" style="text-transform:uppercase"', '', '2/2')}
              ${campo('Equipaje', 't.equipaje', t.equipaje, 'list="be-equipajes" placeholder="23K o 1P" style="text-transform:uppercase"', '', '2/2')}
              ${campo('Base tarifaria', 't.tarifa', t.tarifa, 'placeholder="Opcional" style="text-transform:uppercase"', '', '2/2')}
              <div class="field"${ancho('3/3')}><label class="fl">Cabina</label><select class="ei" data-k="t.cabina">${['Económica', 'Ejecutiva', 'Primera'].map(x => `<option ${x === (t.cabina || 'Económica') ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
              <div class="field"${ancho('3/3')}><label class="fl">Estado</label><select class="ei" data-k="t.estado">${ESTADOS.map(([v, l]) => `<option value="${v}" ${v === (norm(t.estado) || 'OK') ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            </div></details>
        </div></div>`;
    }).join('');
    if (cal) pintarCal(false);
  }
  function pintarPasajeros() {
    const grupos = gruposDe(d);
    $('#be-pasajeros').innerHTML = d.pasajeros.map((p, i) => `<div class="be-item" data-i="${i}">
      <div class="be-item-cab"><b>Pasajero ${i + 1}</b><button type="button" class="be-quitar" data-acc="quitar-pax" aria-label="Quitar pasajero ${i + 1}" title="Quitar pasajero"><i class="fas fa-trash"></i></button></div>
      <div class="be-grid">
        ${campo('Apellido(s)', 'p.apellido', p.apellido, 'autocomplete="off" style="text-transform:uppercase"', p.apellido ? '' : 'be-falta')}
        ${campo('Nombre(s)', 'p.nombre', p.nombre, 'autocomplete="off" style="text-transform:uppercase"', p.nombre ? '' : 'be-falta')}
        ${campo('Cédula o pasaporte', 'p.documento', p.documento, 'placeholder="V-12345678"')}
        <div class="field"><label class="fl">Tipo</label><select class="ei" data-k="p.tipo">${[['ADT', 'Adulto'], ['CHD', 'Niño'], ['INF', 'Infante']].map(([v, l]) => `<option value="${v}" ${v === (p.tipo || 'ADT') ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        ${grupos.map(g => campo(`N° de boleto ${esc(g.aerolinea.nombre)}${grupos.length > 1 && g.reserva ? ' · ' + esc(g.reserva) : ''}`, 'p.boleto', p.boletos?.[g.clave], `data-g="${esc(g.clave)}" inputmode="numeric" placeholder="765-0380712859" data-boleto`, 'be-2')).join('')}
      </div></div>`).join('');
  }
  function pintarAsesor() {
    const sel = snapshotAsesor(d.asesor), indice = asesores.findIndex(a => a.id === sel?.id && a.nombre === sel.nombre);
    $('#be-asesor').innerHTML = `<option value="" ${!sel ? 'selected' : ''}>Sin asesor</option>${sel && indice < 0 ? `<option value="historico" selected>${esc(sel.nombre)} (guardado)</option>` : ''}${asesores.map((a, i) => `<option value="a:${i}" ${i === indice ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}`;
    $('#be-asesor-estado').innerHTML = cargandoAsesores ? 'Cargando asesores…' : errorAsesores ? 'No se pudo cargar la lista. Puedes continuar sin asesor. <button type="button" class="be-btn" data-acc="asesores-recargar">Reintentar</button>' : !asesores.length ? 'No hay asesores disponibles. Puedes continuar sin asesor. <button type="button" class="be-btn" data-acc="asesores-recargar">Actualizar</button>' : '';
  }
  async function cargarAsesores() {
    if (cargandoAsesores) return;
    cargandoAsesores = true; errorAsesores = false; pintarAsesor();
    try { asesores = asesoresVisibles(await c.asesores?.()); } catch (_e) { errorAsesores = true; }
    finally { cargandoAsesores = false; pintarAsesor(); }
  }
  const recibosDe = datos => recibosPorDocumento.get(datos) || [];
  const asesorDeRecibos = rs => {
    const valores = rs.map(r => snapshotAsesor(asesorPorRecibo.get(r))), primero = valores[0] || null;
    return valores.every(a => a?.id === primero?.id && a?.nombre === primero?.nombre) ? primero : null;
  };
  function pintarEmision() {
    const e = d.emision;
    $('#be-emision-campos').innerHTML = `${campo('Fecha y hora de emisión', 'e.fecha', e.fecha, 'type="datetime-local"', 'be-2')}${campo('Agencia emisora', 'e.agencia', e.agencia, '', 'be-2')}
      ${campo('Dirección', 'e.direccion', e.direccion, '', 'be-2')}${campo('Office ID', 'e.office_id', e.office_id)}${campo('Agente emisor', 'e.agente', e.agente)}
      ${campo('Teléfono', 'e.telefono', e.telefono)}${campo('Correo', 'e.email', e.email, 'type="email"')}`;
    $('#be-emision-res').textContent = [e.agencia, e.office_id].filter(Boolean).join(' · ');
    $('#be-notas').value = d.notas || '';
  }
  function pintarPrevia() {
    const grupos = gruposDe(d), { duros, suaves } = revisar(d);
    $('#be-estado').innerHTML = editando ? `Editando <b>${numeroTxt(editando.numero)}</b>${editando.estado === 'anulado' ? ' · <b>anulado</b>' : ''}` : 'Boleto nuevo, todavía sin guardar';
    const ruta = d.tramos.map(t => lugar(t.origen).iata || t.origen).concat(d.tramos.length ? [lugar(d.tramos[d.tramos.length - 1].destino).iata || d.tramos[d.tramos.length - 1].destino] : []).filter(Boolean);
    const pases = d.tramos.filter(t => t.aerolinea || t.origen || t.fecha).map(t => {
      const a = aerolineaDe(t), o = lugar(t.origen, t.origen_ciudad), de = lugar(t.destino, t.destino_ciudad), dur = duracionTxt(t);
      return `<div class="be-pase" style="--be-color:${esc(a.color || '')}">
        <div class="be-pase-cab">${t.aerolinea ? chipLogo(a) : ''}<span><b>${esc([t.iata || a.iata, t.vuelo].filter(Boolean).join(' ') || 'Vuelo')}</b> · ${esc(fechaLarga(t.fecha) || 'sin fecha')}</span></div>
        <div class="be-pase-ruta"><div><strong>${esc(t.sale || '--:--')}</strong><small>${esc(o.iata || '')} ${esc(o.ciudad || '')}</small></div>
          <div class="be-linea">${dur ? `<em>${esc(dur)}</em>` : ''}</div>
          <div class="der"><strong>${esc(t.llega || '--:--')}${llegaOtroDia(t) ? '<sup>+1</sup>' : ''}</strong><small>${esc(de.iata || '')} ${esc(de.ciudad || '')}</small></div></div>
        <div class="be-pase-pie"><span>${esc(equipajeTxt(t.equipaje) || 'Equipaje según la tarifa')}</span><span>${esc(estadoTxt(t.estado))}</span></div></div>`;
    }).join('');
    $('#be-previa').innerHTML = `<div class="be-clave">
        <div><small>Reserva</small><b>${esc(grupos.map(g => g.reserva).filter(Boolean).join(' · ') || '—')}</b></div>
        <div><small>Ruta</small><b>${esc(ruta.join(' - ') || '—')}</b></div>
        <div style="grid-column:1/-1"><small>${d.pasajeros.length === 1 ? 'Pasajero' : `${d.pasajeros.length} pasajeros`}</small><b>${esc(d.pasajeros.map(nombreTxt).filter(Boolean).join(', ') || '—')}</b></div>
        ${snapshotAsesor(d.asesor) ? `<div style="grid-column:1/-1"><small>Asesor</small><b>${esc(snapshotAsesor(d.asesor).nombre)}</b></div>` : ''}
      </div>${pases ? `<div style="display:flex;flex-direction:column;gap:7px;margin-top:9px">${pases}</div>` : ''}
      ${duros.length || suaves.length ? `<ul class="be-faltan" style="margin-top:9px">${[...duros, ...suaves].slice(0, 6).map(x => `<li>${esc(x)}</li>`).join('')}${duros.length + suaves.length > 6 ? `<li>y ${duros.length + suaves.length - 6} más</li>` : ''}</ul>` : ''}`;
    raiz.querySelector('[data-acc="guardar"]').disabled = ocupado || duros.length > 0;
    raiz.querySelector('[data-acc="ver"]').disabled = ocupado || duros.length > 0;
    pintarLote();
  }
  function pintarLote() {
    const box = $('#be-lote');
    if (lote.length < 2) { box.innerHTML = ''; return; }
    lote[iLote].editando = editando;
    const faltan = lote.filter(x => revisar(x.d).duros.length).length;
    box.innerHTML = `<div class="card be-lote"><div class="be-lote-cab"><span><b>${lote.length} boletos</b> · ${faltan ? `${faltan} con datos por completar` : 'toca uno para revisarlo'}</span>
        <button type="button" class="be-btn prim" data-acc="lote-guardar" ${ocupado || faltan ? 'disabled' : ''}><i class="fas fa-file-pdf"></i> Guardar todos y generar ${lote.length} PDF</button></div>
      <div class="be-lote-items">${lote.map((x, i) => {
        const p = x.d.pasajeros, falta = revisar(x.d).duros.length, res = gruposDe(x.d).map(g => g.reserva).filter(Boolean).join(' · ');
        const est = x.editando ? `Guardado ${numeroTxt(x.editando.numero)}` : falta ? 'Falta completar' : 'Listo';
        return `<button type="button" data-acc="lote-ir" data-n="${i}" aria-pressed="${i === iLote}" class="${i === iLote ? 'on ' : ''}${x.editando ? 'listo' : falta ? 'falta' : ''}"><span>${esc(titulo(nombreTxt(p[0] || {}) || `Boleto ${i + 1}`))}${p.length > 1 ? ` +${p.length - 1}` : ''}</span><small>${esc([res, est].filter(Boolean).join(' · '))}</small></button>`;
      }).join('')}</div></div>`;
  }
  function pintarModo() { raiz.querySelectorAll('[data-modo]').forEach(b => { b.classList.toggle('on', b.dataset.modo === modo); b.setAttribute('aria-checked', b.dataset.modo === modo); }); }
  function pintarAviso() {
    const box = $('#be-aviso');
    const ico = { ok: 'fa-circle-check', leyendo: 'fa-spinner fa-spin' }[aviso?.tipo] || 'fa-triangle-exclamation';
    box.innerHTML = aviso ? `<div class="be-aviso ${aviso.tipo}" role="status"><i class="fas ${ico}"></i><div>${aviso.html}</div>${aviso.abrir ? `<button type="button" class="be-btn" data-acc="abrir" data-id="${esc(aviso.abrir)}">Abrir</button>` : ''}${aviso.compartir ? '<button type="button" class="be-btn" data-acc="compartir-lote"><i class="fas fa-share-nodes"></i> Compartir</button>' : ''}</div>` : '';
  }
  function pintarTodo() { pintarTramos(); pintarPasajeros(); pintarEmision(); pintarAsesor(); pintarPrevia(); pintarAviso(); pintarModo(); }
  function mostrarVista(v) {
    vista = v;
    raiz.querySelectorAll('.be-tabs button').forEach(b => { const on = b.dataset.vista === v; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    raiz.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== v; });
    if (v === 'historial') cargarHistorial();
  }

  function alEscribir(e) {
    const el = e.target, k = el.dataset?.k;
    if (!k) return;
    const item = el.closest('.be-item'), i = item ? +item.dataset.i : -1;
    const [zona, campoK] = k.includes('.') ? k.split('.') : [k, null];
    let v = el.value;
    if (zona === 'asesor') {
      if (e.type !== 'change' || v === 'historico') return;
      d.asesor = snapshotAsesor(asesores[Number(v.replace(/^a:/, ''))]);
      if (!v) d.asesor = null;
      recibosDe(d).forEach(r => asesorPorRecibo.set(r, snapshotAsesor(d.asesor)));
      pintarAsesor(); pintarPrevia(); return;
    }
    if (zona === 'notas') { d.notas = v; pintarPrevia(); return; }
    if (zona === 'e') { d.emision[campoK] = v; if (e.type === 'change') recordarEmisor(d.emision); $('#be-emision-res').textContent = [d.emision.agencia, d.emision.office_id].filter(Boolean).join(' · '); pintarPrevia(); return; }
    if (zona === 't') {
      const t = d.tramos[i];
      const gAntes = grupoDe(t);
      if (['reserva', 'clase', 'iata', 'equipaje', 'tarifa'].includes(campoK)) v = v.toUpperCase().trim();
      if ((campoK === 'origen' || campoK === 'destino') && e.type === 'change') {
        const iata = iataDeCiudad(v);
        if (iata) { t[campoK + '_ciudad'] = /^[A-Z]{3}$/.test(norm(v)) ? '' : titulo(v); v = iata; el.value = iata; } else t[campoK + '_ciudad'] = '';
      }
      t[campoK] = v;
      if (campoK === 'aerolinea') { const a = AER[v]; t.iata = a?.iata || (v === 'otra' ? t.iata : ''); }
      if (campoK === 'clase' && !t._cabinaManual) t.cabina = cabinaDe(v);
      if (campoK === 'cabina') t._cabinaManual = true;
      if (campoK === 'llega' || campoK === 'sale') t.llega_dia = 0;
      const gDespues = grupoDe(t);
      if (gAntes !== gDespues) d.pasajeros.forEach(p => { if (p.boletos?.[gAntes] && !d.tramos.some(x => x !== t && grupoDe(x) === gAntes)) { p.boletos[gDespues] ||= p.boletos[gAntes]; delete p.boletos[gAntes]; } });
      if (e.type === 'change' && (campoK === 'aerolinea' || campoK === 'reserva' || campoK === 'aerolinea_nombre')) { pintarTramos(); pintarPasajeros(); }
      else if (e.type === 'change' && campoK === 'clase') pintarTramos();
      pintarPrevia(); return;
    }
    if (zona === 'p') {
      const p = d.pasajeros[i];
      if (campoK === 'boleto') { p.boletos ||= {}; p.boletos[el.dataset.g] = v.trim(); if (e.type === 'change') { el.value = boletoTxt(v); p.boletos[el.dataset.g] = el.value; buscarDuplicado(); } }
      else p[campoK] = campoK === 'documento' ? v.trim() : v.toUpperCase().replace(/\s+/g, ' ').replace(/^\s/, '');
      pintarPrevia();
    }
  }

  async function alClic(e) {
    const b = e.target.closest('[data-acc],[data-vista],[data-modo]');
    if (!b || !raiz.contains(b)) return;
    if (b.dataset.vista) { mostrarVista(b.dataset.vista); return; }
    if (b.dataset.modo) { cambiarModo(b.dataset.modo); return; }
    const acc = b.dataset.acc, i = +b.closest('.be-item')?.dataset.i;
    if (acc === 'tramo') { d.tramos.push(tramoVacio(d.tramos[d.tramos.length - 1])); pintarTramos(); pintarPasajeros(); pintarPrevia(); }
    else if (acc === 'pax') { d.pasajeros.push(paxVacio()); pintarPasajeros(); pintarPrevia(); }
    else if (acc === 'quitar-tramo') { d.tramos.splice(i, 1); pintarTramos(); pintarPasajeros(); pintarPrevia(); }
    else if (acc === 'quitar-pax') { d.pasajeros.splice(i, 1); pintarPasajeros(); pintarPrevia(); }
    else if (acc === 'nuevo') {
      const sinGuardar = lote.filter(x => x !== lote[iLote] && !x.editando).length + (!editando && revisar(d).duros.length < 3 ? 1 : 0);
      if (sinGuardar && !(await c.confirmar({ titulo: '¿Empezar un boleto nuevo?', detalle: lote.length > 1 ? `Se descartan ${sinGuardar} ${sinGuardar === 1 ? 'boleto' : 'boletos'} del lote que no están guardados.` : 'Se borra lo que está en el formulario (no está guardado).', textoOk: 'Empezar de cero', destructivo: true }))) return;
      nuevo(); pintarTodo();
    }
    else if (acc === 'lote-ir') { lote[iLote].editando = editando; iLote = +b.dataset.n; d = lote[iLote].d; editando = lote[iLote].editando; aviso = null; pintarTodo(); buscarDuplicado(); }
    else if (acc === 'asesores-recargar') cargarAsesores();
    else if (acc === 'lote-guardar') guardarLote();
    else if (acc === 'compartir-lote') compartirLote();
    else if (acc === 'guardar') guardar();
    else if (acc === 'ver') entregar(d, editando?.numero, 'Vista previa');
    else if (acc === 'abrir') abrir(b.dataset.id);
    else if (acc === 'h-pdf') { const f = await fila(b.dataset.id); if (f) entregar(f.datos, f.numero); }
    else if (acc === 'h-editar') abrir(b.dataset.id);
    else if (acc === 'h-anular') anular(b.dataset.id, b.dataset.estado === 'anulado' ? 'emitido' : 'anulado');
  }

  async function entregar(datos, numero, etiqueta) {
    try {
      const blob = await construirPdf(datos, numero, c);
      await c.entregar(blob, nombreArchivo(datos, c.slug));
      if (etiqueta) c.ok?.(`${etiqueta} lista`);
    } catch (err) { console.error('boletos-emitidos pdf', err); c.error('No se pudo armar el PDF. Revisa la conexión e intenta de nuevo.'); }
  }

  const limpiar = x => JSON.parse(JSON.stringify({ ...x, asesor: snapshotAsesor(x.asesor) }, (k, v) => (k.startsWith('_') ? undefined : v)));
  const grabar = (datos, ed) => (ed ? sb.from('boletos_emitidos').update({ datos: limpiar(datos) }).eq('id', ed.id) : sb.from('boletos_emitidos').insert({ datos: limpiar(datos) })).select('id, numero, estado').single();

  // Varios PDF: en el teléfono se comparten juntos; en la computadora se descargan uno tras otro.
  async function entregarVarios(items) {
    try {
      const usados = new Set(), files = [];
      for (const it of items) {
        let nom = nombreArchivo(it.datos, c.slug);
        for (let n = 2; usados.has(nom); n++) nom = nombreArchivo(it.datos, c.slug).replace(/\.pdf$/, `-${n}.pdf`);
        usados.add(nom);
        files.push(new File([await construirPdf(it.datos, it.numero, c)], nom, { type: 'application/pdf' }));
      }
      if (files.length === 1) { await c.entregar(files[0], files[0].name); return; }
      porCompartir = files;
      await compartirLote();
    } catch (err) { console.error('boletos-emitidos pdf lote', err); c.error('No se pudieron armar los PDF. Revisa la conexión e intenta de nuevo.'); }
  }
  async function compartirLote() {
    const files = porCompartir;
    if (!files?.length) return;
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files })) {
      try { await navigator.share({ files, title: `${files.length} boletos` }); porCompartir = null; if (aviso?.compartir) { aviso.compartir = false; pintarAviso(); } return; } catch (e) {
        if (e.name === 'AbortError') return;
        if (e.name === 'NotAllowedError') { aviso = { ...(aviso || { tipo: 'ok', html: '' }), compartir: true, html: `${aviso?.html || ''} Toca «Compartir» para enviar los ${files.length} PDF.` }; pintarAviso(); return; }
      }
    }
    for (const f of files) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60e3);
      await new Promise(r => setTimeout(r, 350));
    }
    porCompartir = null;
    c.ok?.(`${files.length} PDF descargados`);
  }

  async function guardarLote() {
    if (ocupado || lote.length < 2 || lote.some(x => revisar(x.d).duros.length)) return;
    lote[iLote].editando = editando;
    ocupado = true; pintarPrevia();
    const hechos = [];
    for (const x of lote) {
      const { data, error } = await grabar(x.d, x.editando);
      if (error || !data) { console.error('boletos_emitidos lote', error); c.error(`No se pudo guardar el boleto de ${titulo(nombreTxt(x.d.pasajeros[0] || {}))}. ${error?.message || ''}`); break; }
      x.editando = data; hechos.push(x);
    }
    ocupado = false; editando = lote[iLote].editando;
    if (hechos.length) recordarEmisor(hechos[0].d.emision);
    aviso = { tipo: hechos.length === lote.length ? 'ok' : 'warn', html: `Guardé ${hechos.length} de ${lote.length} boletos: <b>${hechos.map(x => numeroTxt(x.editando.numero)).join(', ')}</b>. Quedan en el Historial.` };
    pintarTodo();
    if (hechos.length) entregarVarios(hechos.map(x => ({ datos: x.d, numero: x.editando.numero })));
  }

  async function guardar() {
    if (ocupado || revisar(d).duros.length) return;
    ocupado = true; pintarPrevia();
    const { data, error } = await grabar(d, editando);
    ocupado = false;
    if (error || !data) { console.error('boletos_emitidos', error); c.error('No se pudo guardar el boleto. ' + (error?.message || '')); pintarPrevia(); return; }
    editando = data; recordarEmisor(d.emision);
    aviso = { tipo: 'ok', html: `Guardado como <b>${numeroTxt(data.numero)}</b>. Queda en el Historial para volver a descargarlo.` };
    pintarAviso(); pintarPrevia();
    entregar(d, data.numero);
  }

  async function fila(id) {
    const { data, error } = await sb.from('boletos_emitidos').select('id, numero, estado, datos').eq('id', id).single();
    if (error || !data) { c.error('No se encontró ese boleto.'); return null; }
    return data;
  }
  async function abrir(id) {
    const f = await fila(id); if (!f) return;
    d = unirBoletos([], f.datos); editando = { id: f.id, numero: f.numero, estado: f.estado }; aviso = null; lote = []; iLote = 0; crudos = [];
    pintarTodo(); mostrarVista('editor');
  }
  async function anular(id, estado) {
    if (estado === 'anulado' && !(await c.confirmar({ titulo: '¿Anular este boleto?', detalle: 'Sigue en el historial marcado como anulado. Se puede reactivar.', textoOk: 'Anular', destructivo: true }))) return;
    const { error } = await sb.from('boletos_emitidos').update({ estado }).eq('id', id);
    if (error) { c.error('No se pudo cambiar el estado.'); return; }
    c.ok?.(estado === 'anulado' ? 'Boleto anulado' : 'Boleto reactivado');
    cargarHistorial();
  }

  async function buscarDuplicado() {
    const nums = d.pasajeros.flatMap(p => Object.values(p.boletos || {})).map(b => boletoTxt(b)).filter(b => /^\d{3}-\d{10}$/.test(b));
    if (!nums.length) return;
    let q = sb.from('boletos_emitidos').select('id, numero').overlaps('boletos', nums).limit(1);
    if (editando) q = q.neq('id', editando.id);
    const { data } = await q;
    if (data?.length) { aviso = { tipo: 'warn', html: `Uno de estos boletos ya está registrado como <b>${numeroTxt(data[0].numero)}</b>.`, abrir: data[0].id }; pintarAviso(); }
  }

  // Página sin texto (escaneo o PDF hecho de fotos): se dibuja y se lee con OCR.
  async function lineasDelPdf(file, ocr) {
    const lib = await c.pdfjs();
    const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    const paginas = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const pag = await pdf.getPage(i), items = (await pag.getTextContent()).items;
      if (items.some(x => x.str?.trim())) { paginas.push(lineasDeItems(items)); continue; }
      const vp = pag.getViewport({ scale: 2.5 }), cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height;
      await pag.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      paginas.push(await ocr(cv));
    }
    return paginas;
  }
  const esPdf = f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
  const esFoto = f => /^image\//i.test(f.type) || /\.(jpe?g|png|webp|bmp|gif)$/i.test(f.name);
  const formVacio = () => !lote.length && !editando && !d.tramos.some(t => t.aerolinea || t.origen || t.vuelo) && !d.pasajeros.some(p => p.apellido || p.nombre);
  const armar = (rs, base = { ...datosVacios(), emision: {}, notas: d.notas }) => {
    const x = unirBoletos(rs, base);
    if (!x.emision.fecha) x.emision.fecha = ahoraIso();
    for (const [k, v] of Object.entries(emisorGuardado())) if (!x.emision[k] && v) x.emision[k] = v;
    recibosPorDocumento.set(x, [...new Set([...recibosDe(base), ...rs])]);
    return x;
  };
  // Arma el formulario (o el lote) desde cero con todo lo leído.
  function desdeCrudos() {
    const grupos = separarRecibos(crudos, modo);
    editando = null; iLote = 0;
    // Una combinación con nombres distintos no debe atribuirse al primer asesor del lote.
    const datosGrupo = rs => { const x = armar(rs); x.asesor = asesorDeRecibos(rs); return x; };
    if (grupos.length < 2) { lote = []; d = datosGrupo(crudos); return; }
    lote = grupos.map(g => ({ clave: g.clave, d: datosGrupo(g.recibos), editando: null }));
    d = lote[0].d;
  }
  function cambiarModo(m) {
    modo = m;
    try { localStorage.setItem('be_modo_lote', m); } catch (_e) { /* sin almacenamiento */ }
    if (crudos.length && !editando && !lote.some(x => x.editando)) { desdeCrudos(); aviso = resumenLectura(crudos.length, []); pintarTodo(); }
    else pintarModo();
  }
  function resumenLectura(n, sinLeer) {
    const docs = lote.length > 1 ? lote.map(x => x.d) : [d];
    const malos = docs.filter(x => { const r = revisar(x); return r.duros.length || r.suaves.length; }).length;
    const pax = docs.reduce((s, x) => s + x.pasajeros.length, 0);
    const que = lote.length > 1
      ? `separados en ${lote.length} PDF (${{ reserva: 'uno por reserva', pasajero: 'uno por pasajero' }[modo] || 'todos juntos'}), ${pax} pasajeros. Revisa cada uno en la lista y guarda todos juntos.`
      : `${d.pasajeros.length} ${d.pasajeros.length === 1 ? 'pasajero' : 'pasajeros'} y ${d.tramos.length} ${d.tramos.length === 1 ? 'vuelo' : 'vuelos'}. ${malos ? 'Revisa lo marcado antes de guardar.' : 'Revisa y guarda.'}`;
    return { tipo: malos || sinLeer.length ? 'warn' : 'ok', html: `Leí ${n} ${n === 1 ? 'boleto' : 'boletos'}: ${que}${lote.length > 1 && malos ? ` ${malos} con algo por revisar.` : ''}${sinLeer.length ? ` No pude leer: ${esc(sinLeer.join(', '))}.` : ''}` };
  }
  async function importar(archivos) {
    const validos = archivos.filter(f => esPdf(f) || esFoto(f));
    if (!validos.length) { c.error('Sube el boleto en PDF, foto o captura.'); return; }
    if (ocupado) return;
    ocupado = true; pintarPrevia();
    const recibos = [], sinLeer = [];
    let lector = null;
    const ocr = async fuente => { lector ||= await lectorOcr(); return lineasDeOcr((await lector.recognize(fuente)).data); };
    try {
      for (const [n, f] of validos.entries()) {
        aviso = { tipo: 'leyendo', html: `Leyendo ${validos.length > 1 ? `${n + 1} de ${validos.length}` : ''} <b>${esc(f.name)}</b>…${esFoto(f) ? ' Las fotos tardan unos segundos.' : ''}` }; pintarAviso();
        try {
          const leidos = (esPdf(f) ? await lineasDelPdf(f, ocr) : [await ocr(f)]).map(parsearBoleto).filter(Boolean);
          if (!leidos.length) sinLeer.push(f.name);
          recibos.push(...leidos);
        } catch (err) { console.error('boletos-emitidos lectura', err); sinLeer.push(f.name); }
      }
    } finally { ocupado = false; lector?.terminate(); }
    if (!recibos.length) { aviso = { tipo: 'warn', html: `No pude leer datos de boleto en ${esc(sinLeer.join(', '))}. Si la foto está borrosa o torcida, prueba con una captura de pantalla o llénalo a mano.` }; pintarAviso(); pintarPrevia(); return; }
    // `crudos` guarda lo leído solo mientras todo el formulario/lote salió de archivos: así cambiar el modo lo rearma.
    if (formVacio()) {
      separarRecibos(recibos, modo).forEach((g, i) => g.recibos.forEach(r => asesorPorRecibo.set(r, i === 0 ? snapshotAsesor(d.asesor) : null)));
      crudos = [...recibos]; desdeCrudos();
    }
    else if (lote.length) {
      lote[iLote].editando = editando;
      for (const g of separarRecibos(recibos, modo)) {
        const x = lote.find(y => y.clave === g.clave);
        g.recibos.forEach(r => asesorPorRecibo.set(r, snapshotAsesor(x?.d.asesor)));
        if (x) x.d = armar(g.recibos, x.d); else lote.push({ clave: g.clave, d: armar(g.recibos), editando: null });
      }
      d = lote[iLote].d;
      if (crudos.length) crudos.push(...recibos);
    } else {
      const grupos = separarRecibos(recibos, modo);
      if (grupos.length < 2) { recibos.forEach(r => asesorPorRecibo.set(r, snapshotAsesor(d.asesor))); d = armar(recibos, d); }
      else { lote = [{ clave: 'actual', d, editando }, ...grupos.map(g => ({ clave: g.clave, d: armar(g.recibos), editando: null }))]; iLote = 0; }
      if (crudos.length) crudos.push(...recibos);
    }
    aviso = resumenLectura(recibos.length, sinLeer);
    pintarTodo();
    buscarDuplicado();
  }

  async function cargarHistorial() {
    const n = ++pedido, lista = $('#be-lista');
    lista.innerHTML = '<div class="be-vacio">Cargando…</div>';
    let q = sb.from('boletos_emitidos').select('id, numero, estado, pasajero, n_pasajeros, ruta, primer_vuelo, reservas, creado_por_nombre, created_at').order('created_at', { ascending: false }).limit(60);
    if (!verAnulados) q = q.eq('estado', 'emitido');
    const t = norm(histQ).toLowerCase().replace(/[%,()]/g, ' ').trim();
    if (t) q = q.ilike('busqueda', `%${/^\d[\d -]+$/.test(t) ? t.replace(/[\s-]/g, '') : t}%`);
    const { data, error } = await q;
    if (n !== pedido) return;
    if (error) { lista.innerHTML = '<div class="be-vacio">No se pudo cargar el historial.</div>'; console.error('boletos_emitidos', error); return; }
    lista.innerHTML = data.length ? data.map(f => `<div class="be-fila${f.estado === 'anulado' ? ' anulado' : ''}">
        <div class="num">${numeroTxt(f.numero)}<small>${esc(fechaCorta(String(f.created_at).slice(0, 10)))}</small></div>
        <div class="det"><b>${esc(titulo(f.pasajero || '—'))}${f.n_pasajeros > 1 ? ` +${f.n_pasajeros - 1}` : ''}</b><small>${esc(f.ruta || '')}${f.primer_vuelo ? ' · ' + esc(fechaCorta(f.primer_vuelo)) : ''}${f.estado === 'anulado' ? ' · anulado' : ''}</small></div>
        <div class="det"><b>${esc((f.reservas || []).join(' · ') || '—')}</b><small>${esc(f.creado_por_nombre || '')}</small></div>
        <div class="acc"><button type="button" data-acc="h-pdf" data-id="${f.id}" title="Descargar o compartir el PDF" aria-label="PDF de ${numeroTxt(f.numero)}"><i class="fas fa-file-pdf"></i></button>
          <button type="button" data-acc="h-editar" data-id="${f.id}" title="Abrir y editar" aria-label="Editar ${numeroTxt(f.numero)}"><i class="fas fa-pen"></i></button>
          <button type="button" data-acc="h-anular" data-id="${f.id}" data-estado="${f.estado}" title="${f.estado === 'anulado' ? 'Reactivar' : 'Anular'}" aria-label="${f.estado === 'anulado' ? 'Reactivar' : 'Anular'} ${numeroTxt(f.numero)}"><i class="fas ${f.estado === 'anulado' ? 'fa-rotate-left' : 'fa-ban'}"></i></button></div>
      </div>`).join('') : `<div class="be-vacio">${t ? 'Nada coincide con esa búsqueda.' : 'Todavía no hay boletos guardados.'}</div>`;
  }

  async function cargar() {
    if (!montado) {
      css();
      if (!permitido()) { raiz.innerHTML = '<div class="card be-vacio">Esta sección es solo para Boletería y administración.</div>'; return; }
      marco(); nuevo(); pintarTodo(); mostrarVista('editor'); montado = true; cargarAsesores();
      c.catalogo?.().then(cat => {
        fijarAeropuertos(cat?.aeropuertos);
        const dl = $('#be-aeropuertos');
        if (dl) dl.innerHTML = AEROPUERTOS.filter(a => a.activo !== false).map(a => `<option value="${esc(a.iata_code)}">${esc(a.nombre_comercial || a.ciudad)}</option>`).join('');
        pintarPrevia();
      }).catch(() => { /* sin catálogo se escribe la ciudad a mano */ });
    } else if (vista === 'historial') cargarHistorial();
  }
  return { cargar };
}
