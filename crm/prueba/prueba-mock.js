// Backend falso del modo Prueba: responde en memoria todo lo que el CRM le pide a Supabase
// (demo.invalid / fn.demo.invalid). Port de scripts/tutoriales/mock_supabase.py.
// Requiere datos-prueba.js y rpcs-prueba.js cargados antes. Se pierde al recargar.
(() => {
  'use strict';
  const g = window, D = g.PRUEBA_DATOS, R = g.PRUEBA_RPCS;
  if (!D || !R) { console.error('[prueba] faltan datos-prueba.js / rpcs-prueba.js'); return; }
  const HOST = 'demo.invalid', FN_HOST = 'fn.demo.invalid';
  const origFetch = g.fetch.bind(g), RealWS = g.WebSocket;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clona = o => JSON.parse(JSON.stringify(o));

  /* ---------- Storage propio: la prueba comparte origen con el CRM real ---------- */
  const PFX = 'prueba:';
  for (const met of ['getItem', 'setItem', 'removeItem']) {
    const orig = Storage.prototype[met];
    Storage.prototype[met] = function (k, ...r) { return orig.call(this, PFX + k, ...r); };
  }

  /* ---------- Estado ---------- */
  const m = { tablas: {}, usuario: null, rol: null };
  const avisados = new Set();
  const avisa = clave => { if (!avisados.has(clave)) { avisados.add(clave); console.warn('[prueba] sin mock:', clave); } };
  function inicia(rol) {
    if (m.rol === rol) return;
    m.rol = rol; m.usuario = D.USUARIOS[rol]; m.tablas = clona(D.tablas_para(rol));
  }
  const emite = detalle => g.dispatchEvent(new CustomEvent('prueba:accion', { detail: detalle }));

  /* ---------- Auth ---------- */
  const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  const rolDeId = id => Object.keys(D.USUARIOS).find(r => D.USUARIOS[r].id === id);
  const rolDeUsername = u => Object.keys(D.USUARIOS).find(r => D.USUARIOS[r].username === u);
  function sesion(rol) {
    const u = D.USUARIOS[rol], iat = Math.floor(Date.now() / 1000), exp = iat + 6 * 3600;
    const tok = [b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), b64u(JSON.stringify({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', iat, exp })), 'firma-prueba'].join('.');
    return { access_token: tok, refresh_token: `prueba.${rol}`, token_type: 'bearer', expires_in: 6 * 3600, expires_at: exp,
      user: { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: D.hace(0, 90), confirmed_at: D.hace(0, 90), email_confirmed_at: D.hace(0, 90) } };
  }
  function rolDeHeaders(h) {
    const t = /^Bearer\s+(.+)$/i.exec(h.get('authorization') || '')?.[1];
    if (!t || t.split('.').length !== 3) return null;
    try { return rolDeId(JSON.parse(unb64u(t.split('.')[1])).sub) || null; } catch { return null; }
  }
  function auth(path, sp, body, rol) {
    if (path.endsWith('/token')) {
      const r = sp.get('grant_type') === 'password' ? rolDeUsername(String(body?.email || '').split('@')[0].toLowerCase())
        : sp.get('grant_type') === 'refresh_token' ? String(body?.refresh_token || '').split('.')[1] : null;
      if (!r || !D.USUARIOS[r]) return resp({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials', error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
      inicia(r); emite({ tipo: 'login', rol: r });
      return resp(sesion(r));
    }
    if (path.endsWith('/user')) return rol ? resp(sesion(rol).user) : resp({ code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' }, 401);
    if (path.endsWith('/logout')) return new Response(null, { status: 204 });
    if (path.endsWith('/settings')) return resp({ external: { email: true }, disable_signup: true, mailer_autoconfirm: true });
    avisa('auth ' + path);
    return resp({});
  }

  /* ---------- Filtros PostgREST ---------- */
  const valor = v => v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v;
  const cmp = (a, b) => {
    if (a == null || b == null) return null;
    const x = Number(a), y = Number(b);
    if (!Number.isNaN(x) && !Number.isNaN(y) && a !== '' && b !== '') return (x > y) - (x < y);
    return (String(a) > String(b)) - (String(a) < String(b));
  };
  const lista = v => (v.replace(/^\(|\)$/g, '').match(/"[^"]*"|[^,]+/g) || []).map(x => x.trim().replace(/^"|"$/g, ''));
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function cumple(fila, col, expr) {
    const neg = expr.startsWith('not.'); if (neg) expr = expr.slice(4);
    const i = expr.indexOf('.'), op = i < 0 ? expr : expr.slice(0, i), v = i < 0 ? '' : expr.slice(i + 1);
    const a = fila[col.split('->')[0]];
    let r;
    if (op === 'eq') r = typeof a === 'boolean' ? String(a) === v.toLowerCase() : a != null && String(a) === v;
    else if (op === 'neq') r = a == null || String(a) !== v;
    else if (['gt', 'gte', 'lt', 'lte'].includes(op)) { const c = cmp(a, v); r = c !== null && { gt: c > 0, gte: c >= 0, lt: c < 0, lte: c <= 0 }[op]; }
    else if (op === 'is') r = ['null', 'true', 'false'].includes(v) ? (v === 'null' ? a == null : a === valor(v)) : false;
    else if (op === 'in') r = lista(v).includes(String(a));
    else if (op === 'like' || op === 'ilike') {
      let crudo = v; try { crudo = decodeURIComponent(v); } catch { /* '%ma…' de un ilike ya viene decodificado */ }
      const pat = '^' + escRe(crudo).replace(/\\\*/g, '.*').replace(/%/g, '.*') + '$';
      r = a != null && new RegExp(pat, op === 'ilike' ? 'i' : '').test(String(a));
    }
    else if (op === 'cs') r = Array.isArray(a) && lista(v.replace(/^\{|\}$/g, '')).every(x => a.map(String).includes(x));
    else r = true;
    return neg ? !r : r;
  }
  function partir(s) {
    const out = []; let prof = 0, cur = '';
    for (const ch of s) { if (ch === '(') prof++; if (ch === ')') prof--; if (ch === ',' && prof === 0) { out.push(cur); cur = ''; } else cur += ch; }
    return cur ? [...out, cur] : out;
  }
  function cumpleLogico(fila, tipo, cuerpo) {
    const res = partir(cuerpo.replace(/^\(|\)$/g, '')).map(p => {
      const mm = /^(and|or)\((.*)\)$/.exec(p);
      if (mm) return cumpleLogico(fila, mm[1], mm[2]);
      const i = p.indexOf('.'); return cumple(fila, p.slice(0, i), p.slice(i + 1));
    });
    return tipo === 'or' ? res.some(Boolean) : res.every(Boolean);
  }
  const RESERVADOS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
  function filtrar(tabla, params) {
    let filas = m.tablas[tabla] || [];
    for (const [k, v] of params) {
      if (RESERVADOS.has(k) || k.includes('.')) continue;
      filas = filas.filter(f => (k === 'or' || k === 'and') ? cumpleLogico(f, k, v) : cumple(f, k, v));
    }
    return filas;
  }
  const nuevoId = tabla => { const ids = (m.tablas[tabla] || []).map(f => f.id).filter(Number.isInteger); return ids.length ? Math.max(...ids) + 1 : crypto.randomUUID(); };

  function rest(method, tabla, sp, h, body) {
    const params = [...sp.entries()];
    if (!(tabla in m.tablas)) { avisa(`tabla ${tabla} (${method})`); m.tablas[tabla] = []; }
    if (method === 'GET' || method === 'HEAD') {
      let filas = filtrar(tabla, params);
      const order = sp.get('order');
      if (order) for (const campo of order.split(',').reverse()) {
        const [col, ...mods] = campo.split('.'), desc = mods.includes('desc');
        filas = [...filas].sort((x, y) => {
          const a = x[col], b = y[col];
          if ((a == null) !== (b == null)) return (a == null ? 1 : -1) * (desc ? -1 : 1);
          const c = cmp(a ?? '', b ?? '') || 0; return desc ? -c : c;
        });
      }
      const total = filas.length;
      let off = Number(sp.get('offset') || 0), lim = sp.get('limit') ? Number(sp.get('limit')) : null;
      const rg = h.get('range'); if (rg) { const [a, b] = rg.split('-').map(Number); off = a; lim = b - a + 1; }
      filas = filas.slice(off, lim == null ? undefined : off + lim);
      const cr = { 'content-range': `${off}-${off + Math.max(filas.length - 1, 0)}/${(h.get('prefer') || '').includes('count=') ? total : '*'}` };
      if (method === 'HEAD') return new Response(null, { status: 200, headers: cr });
      if ((h.get('accept') || '').includes('vnd.pgrst.object')) {
        if (filas.length !== 1) return resp({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 406);
        return resp(filas[0], 200, cr);
      }
      return resp(filas, 200, cr);
    }
    if (method === 'POST') {
      const nuevas = (Array.isArray(body) ? body : [body]).map(f => ({ ...f }));
      const conflicto = sp.get('on_conflict');
      for (const f of nuevas) {
        const previa = conflicto && m.tablas[tabla].find(x => conflicto.split(',').every(c => x[c] === f[c]));
        if (previa) Object.assign(previa, f);
        else { if (f.id == null) f.id = nuevoId(tabla); if (f.created_at == null) f.created_at = D.hace(0); if (tabla === 'cotizaciones_boleteria' && f.numero == null) f.numero = f.id; m.tablas[tabla].push(f); }
      }
      emite({ tipo: 'insert', tabla, filas: nuevas });
      return resp(objeto(h) ? nuevas[0] : nuevas, 201);
    }
    if (method === 'PATCH') {
      const filas = filtrar(tabla, params);
      for (const f of filas) Object.assign(f, body || {});
      emite({ tipo: 'update', tabla, filas, cambios: body });
      return resp(objeto(h) && filas.length === 1 ? filas[0] : filas);
    }
    if (method === 'DELETE') {
      const borrar = new Set(filtrar(tabla, params));
      m.tablas[tabla] = m.tablas[tabla].filter(f => !borrar.has(f));
      emite({ tipo: 'delete', tabla, filas: [...borrar] });
      return resp([...borrar]);
    }
    avisa(`${method} ${tabla}`);
    return resp([]);
  }
  const objeto = h => (h.get('accept') || '').includes('vnd.pgrst.object');

  /* ---------- RPCs y funciones ---------- */
  const BASE_RPC = {
    listar_usuarios_activos: () => Object.values(D.USUARIOS).map(u => ({ username: u.username, nombre: `${u.nombre} · ${u.rol === 'admin' ? 'Administración' : 'Asesor'} (prueba)` })),
  };
  function ejecuta(tipo, nombre, args) {
    const h = tipo === 'rpc' ? (BASE_RPC[nombre] || R.RPCS[nombre]) : R.FUNCIONES[nombre];
    if (!h) { avisa(`${tipo} ${nombre}`); return resp(tipo === 'fn' || (g.__PRUEBA_RPC_OK || []).includes(nombre) ? { ok: true } : []); }
    const out = h(m, args || {});
    emite({ tipo, nombre, args: args || {}, ...(out?.__status >= 400 ? { error: String(out.body?.message || out.body?.error || out.__status) } : {}) });
    return out && out.__status ? resp(out.body, out.__status) : resp(out === undefined ? null : out);
  }

  /* ---------- Fetch ---------- */
  function resp(body, status = 200, extra = {}) {
    if (status === 204) return new Response(null, { status, headers: extra });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } });
  }
  async function leeCuerpo(init, req) {
    let raw = init?.body;
    if (raw == null && req) { try { raw = await req.clone().text(); } catch { raw = null; } }
    if (raw == null || raw === '') return null;
    if (typeof raw !== 'string') { if (raw instanceof FormData || raw instanceof Blob) return null; try { raw = await new Response(raw).text(); } catch { return null; } }
    try { return JSON.parse(raw); } catch { return Object.fromEntries(new URLSearchParams(raw)); }
  }
  async function pruebaFetch(input, init) {
    const req = input instanceof Request ? input : null;
    let url; try { url = new URL(req ? req.url : String(input), location.href); } catch { return origFetch(input, init); }
    if (url.hostname !== HOST && url.hostname !== FN_HOST) {
      if (/supabase\.(co|in)$|destinoyeventoslotus360\.com$/i.test(url.hostname)) return resp({ error: 'No disponible en el modo prueba' }, 503);
      return origFetch(input, init);
    }
    await sleep(40);
    const method = (init?.method || req?.method || 'GET').toUpperCase();
    if (method === 'OPTIONS') return new Response(null, { status: 204 });
    const headers = new Headers(init?.headers || req?.headers || {});
    const body = await leeCuerpo(init, req);
    const rol = rolDeHeaders(headers); if (rol) inicia(rol);
    const p = url.pathname, sp = url.searchParams;
    try {
      if (url.hostname === FN_HOST) return ejecuta('fn', p.replace(/^\/+/, '').split('/')[0], body);
      if (p.startsWith('/auth/v1/')) return auth(p, sp, body, rol);
      if (!m.rol) inicia('asesor');
      if (p.startsWith('/rest/v1/rpc/')) return ejecuta('rpc', p.split('/').pop(), method === 'GET' ? Object.fromEntries(sp) : body);
      if (p.startsWith('/rest/v1/')) return rest(method, p.split('/')[3], sp, headers, body);
      if (p.startsWith('/functions/v1/')) return ejecuta('fn', p.split('/')[3], body);
      if (p.startsWith('/storage/v1/')) {
        if (p.includes('/object/sign/')) { const ruta = p.split('/object/sign/')[1]; return resp({ signedURL: `/object/public/${ruta}`, signedUrl: `/object/public/${ruta}` }); }
        if (method === 'GET') return fotoResp(p);
        return resp({ Key: p });
      }
      avisa(`${method} ${p}`);
      return resp({}, 404);
    } catch (e) {
      console.error('[prueba]', p, e);
      return resp({ code: 'PGRST000', message: String(e?.message || e) }, 500);
    }
  }
  g.fetch = pruebaFetch;

  /* ---------- Fotos locales ---------- */
  const NFOTOS = 6;
  const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  // Hoteles reales: prueba-fotos/h/<id>-<k>.jpg, venga como original o como derivado _d/<ancho>/….jpg.
  const fotoLocal = s => { const r = /\bh\/\d+-\d+\.jpg/.exec(s); return r ? `prueba-fotos/${r[0]}` : `prueba-fotos/f${hash(s) % NFOTOS + 1}.jpg`; };
  const fotoResp = p => origFetch(fotoLocal(p));
  document.addEventListener('error', e => {
    const el = e.target;
    if (!el || el.tagName !== 'IMG' || el.dataset.pruebaFoto || /logo|icons\//.test(el.src || '')) return;
    el.dataset.pruebaFoto = '1'; el.src = fotoLocal(el.src || '');
  }, true);

  /* ---------- Realtime falso (phoenix): acepta todo y emite lo que se le empuje ---------- */
  const sockets = new Set();
  class FakeWS {
    constructor(url) {
      Object.assign(this, { url, readyState: 0, protocol: '', extensions: '', bufferedAmount: 0, binaryType: 'blob', _l: {}, _ids: 0, _v2: /vsn=2/.test(url) });
      sockets.add(this);
      setTimeout(() => { this.readyState = 1; this._emit('open', { type: 'open' }); }, 0);
    }
    addEventListener(t, f) { (this._l[t] ||= []).push(f); }
    removeEventListener(t, f) { this._l[t] = (this._l[t] || []).filter(x => x !== f); }
    dispatchEvent() { return true; }
    _emit(t, ev) { if (typeof this['on' + t] === 'function') this['on' + t](ev); (this._l[t] || []).slice().forEach(f => f.call(this, ev)); }
    _manda(joinRef, ref, topic, event, payload) {
      const data = this._v2 ? JSON.stringify([joinRef, ref, topic, event, payload]) : JSON.stringify({ join_ref: joinRef, ref, topic, event, payload });
      setTimeout(() => { if (this.readyState === 1) this._emit('message', { type: 'message', data }); }, 0);
    }
    send(data) {
      if (this.readyState !== 1 || typeof data !== 'string') return;
      let joinRef, ref, topic, event, payload;
      try { const x = JSON.parse(data); if (Array.isArray(x)) [joinRef, ref, topic, event, payload] = x; else ({ join_ref: joinRef, ref, topic, event, payload } = x); } catch { return; }
      if (event === 'phx_join') this._manda(joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: (payload?.config?.postgres_changes || []).map(c => ({ ...c, id: ++this._ids })) } });
      else if (event === 'phx_leave') { this._manda(joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }); this._manda(joinRef, null, topic, 'phx_close', {}); }
      else if (ref != null) this._manda(joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
    }
    close(code = 1000, reason = '') {
      if (this.readyState >= 2) return;
      this.readyState = 2; sockets.delete(this);
      setTimeout(() => { this.readyState = 3; this._emit('close', { type: 'close', code, reason, wasClean: true }); }, 0);
    }
  }
  function WS(url, protocols) { return String(url).includes(HOST) ? new FakeWS(String(url)) : new RealWS(url, protocols); }
  Object.assign(WS, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  Object.assign(FakeWS, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  if (RealWS) WS.prototype = RealWS.prototype;
  g.WebSocket = WS;

  g.__PRUEBA = { m, inicia, emite, avisados, fotoLocal };
})();
