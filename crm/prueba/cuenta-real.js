/* Botón «Crear mi cuenta real»: pide la cuenta, espera la aprobación de un admin y entra al CRM.
   Carga ANTES que prueba-mock.js para quedarse con el fetch y el Storage reales (el mock los parchea).
   La sesión se guarda con la clave normal de Supabase: al volver a / el CRM real ya entra con ella. */
(() => {
  'use strict';
  const URL_CUENTA = 'https://begbjhrdbsqftbbleecb.supabase.co/functions/v1/prueba-cuenta-real';
  const CLAVE_SESION = `sb-${new URL(URL_CUENTA).hostname.split('.')[0]}-auth-token`;
  const CLAVE_TOKEN = 'lotus:cuenta-real-token';
  const fetchReal = window.fetch.bind(window);
  const { getItem, setItem, removeItem } = Storage.prototype;
  const guardado = {
    leer: () => { try { return getItem.call(localStorage, CLAVE_TOKEN); } catch { return null; } },
    poner: t => { try { setItem.call(localStorage, CLAVE_TOKEN, t); } catch { /* sin storage: solo dura esta pestaña */ } },
    quitar: () => { try { removeItem.call(localStorage, CLAVE_TOKEN); } catch { /* nada que quitar */ } },
  };
  const nombrePractica = () => { try { return getItem.call(sessionStorage, 'prueba:prueba:nombre') || ''; } catch { return ''; } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const ERRORES = {
    nombre_invalido: 'Escribe tu nombre real, sin números ni símbolos.',
    ya_solicitada: 'Ya hay una solicitud abierta con ese nombre. Pídele a un administrador que la revise.',
    demasiadas_solicitudes: 'Hay demasiadas solicitudes por ahora. Intenta de nuevo más tarde.',
  };
  const ESPERA_MS = 15000;
  let tokenMemoria = guardado.leer(), reloj = null, sesionLista = null, revisando = false;

  const llamar = async cuerpo => {
    const r = await fetchReal(URL_CUENTA, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(cuerpo) });
    return r.json().catch(() => ({ ok: false }));
  };

  function hoja(html) {
    let el = document.getElementById('cr-hoja');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cr-hoja';
      el.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
      document.body.append(el);
    }
    el.innerHTML = `<div style="background:var(--panel-solid,#fff);color:var(--txt,#111);border-radius:14px;padding:20px;width:min(420px,100%);font-size:14px;line-height:1.5">${html}</div>`;
    return el;
  }
  // Solo cierra la hoja: si hay una solicitud abierta, se sigue revisando de fondo.
  const cerrar = () => document.getElementById('cr-hoja')?.remove();

  function pedir(error, valor = nombrePractica()) {
    const el = hoja(`<h3 style="margin:0 0 8px">Crear mi cuenta real</h3>
      <p style="margin:0 0 12px">Tu cuenta quedará como asesor integral y un administrador debe aprobarla antes de que puedas entrar.</p>
      <label for="cr-nombre" style="display:block;font-weight:600;margin-bottom:4px">Tu nombre y apellido</label>
      <input id="cr-nombre" maxlength="60" autocomplete="name" value="${esc(valor)}" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:8px">
      ${error ? `<p role="alert" style="color:#b91c1c;margin:8px 0 0">${esc(error)}</p>` : ''}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="dbtn gh" type="button" id="cr-cancelar">Cancelar</button>
        <button class="dbtn save" type="button" id="cr-enviar">Enviar solicitud</button>
      </div>`);
    el.querySelector('#cr-cancelar').onclick = cerrar;
    el.querySelector('#cr-enviar').onclick = async e => {
      e.target.disabled = true;
      const nombre = el.querySelector('#cr-nombre').value;
      const r = await llamar({ accion: 'solicitar', nombre }).catch(() => ({ ok: false }));
      if (!r.ok) return pedir(ERRORES[r.error] || 'No se pudo enviar. Revisa tu conexión e intenta de nuevo.', nombre);
      tokenMemoria = r.token;
      guardado.poner(r.token);
      esperar();
    };
  }

  function esperar() {
    const el = hoja(`<h3 style="margin:0 0 8px">Solicitud enviada</h3>
      <p style="margin:0 0 14px">Un administrador debe aprobarla. Puedes seguir practicando: te avisamos aquí cuando esté lista.</p>
      <div style="display:flex;justify-content:flex-end"><button class="dbtn gh" type="button" id="cr-seguir">Seguir practicando</button></div>`);
    el.querySelector('#cr-seguir').onclick = cerrar;
    if (!reloj) reloj = setInterval(revisar, ESPERA_MS);
    revisar();
  }

  function datos(r) {
    sesionLista = r.sesion || null;
    // Otra sesión abierta en este navegador no se pisa: una pestaña de admin seguiría creyéndose admin.
    let otraSesion = null;
    try { otraSesion = getItem.call(localStorage, CLAVE_SESION); } catch { /* sin storage: entra por el login */ }
    const el = hoja(`<h3 style="margin:0 0 8px">La cuenta de ${esc(r.nombre)} está lista</h3>
      <p style="margin:0 0 10px"><b>Anota estos datos ahora: no se vuelven a mostrar.</b> Los necesitas para entrar la próxima vez.</p>
      <p style="margin:0">Usuario: <b>${esc(r.username)}</b></p>
      <p style="margin:0 0 14px">Contraseña: <b>${esc(r.password)}</b></p>
      ${otraSesion ? '<p style="margin:0 0 14px">Este navegador ya tiene otra sesión abierta: ciérrala y entra con estos datos.</p>' : ''}
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end">
        <button class="dbtn gh" type="button" id="cr-no-soy">No soy yo</button>
        <button class="dbtn save" type="button" id="cr-entrar">${otraSesion ? 'Ya los anoté, ir al CRM' : 'Ya los anoté, entrar al CRM'}</button>
      </div>`);
    // Computador compartido: olvida la solicitud solo aquí, sin marcarla como entregada.
    el.querySelector('#cr-no-soy').onclick = () => { guardado.quitar(); tokenMemoria = null; cerrar(); };
    el.querySelector('#cr-entrar').onclick = async e => {
      e.target.disabled = true;
      // El token solo se suelta ya anotados los datos: si esto falla, los vuelve a mostrar al volver.
      const r = await llamar({ accion: 'confirmar', token: tokenMemoria }).catch(() => null);
      if (r?.ok) guardado.quitar();
      if (sesionLista && !otraSesion) try { setItem.call(localStorage, CLAVE_SESION, JSON.stringify(sesionLista)); } catch { /* entra por el login */ }
      location.replace('/');
    };
  }

  async function revisar() {
    if (!tokenMemoria || revisando) return;
    revisando = true;
    const r = await llamar({ accion: 'estado', token: tokenMemoria }).catch(() => null);
    revisando = false;
    if (!r?.ok && r?.error !== 'token_invalido') return;
    if (r.ok && r.estado === 'pendiente') return;
    clearInterval(reloj); reloj = null;
    if (r.ok && r.estado === 'aprobada') return datos(r);
    guardado.quitar(); tokenMemoria = null;
    if (r.ok && r.estado === 'rechazada') return pedir('Tu solicitud no fue aprobada. Habla con un administrador.');
    if (r.ok && r.estado === 'entregada') {
      const el = hoja(`<h3 style="margin:0 0 8px">Tu cuenta ya existe</h3>
        <p style="margin:0 0 14px">Entra con el usuario <b>${esc(r.username)}</b> y la contraseña que anotaste. Si no la tienes, pídele a un administrador que la restablezca.</p>
        <div style="display:flex;justify-content:flex-end"><button class="dbtn save" type="button" id="cr-login">Ir al login</button></div>`);
      el.querySelector('#cr-login').onclick = () => location.replace('/');
    }
  }

  function montar() {
    const pie = document.querySelector('.side-foot-row');
    if (!pie || document.getElementById('cr-boton')) return;
    const b = document.createElement('button');
    b.id = 'cr-boton';
    b.type = 'button';
    b.className = 'dbtn save';
    b.style.cssText = 'flex:none;margin:8px 12px;width:calc(100% - 24px)';
    b.innerHTML = '<i class="fas fa-user-check"></i> Crear mi cuenta real';
    b.onclick = () => { window.__pruebaCerrarMenu?.(); tokenMemoria ? esperar() : pedir(); };
    pie.before(b);
    if (tokenMemoria) { reloj = setInterval(revisar, ESPERA_MS); revisar(); }
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', montar); else montar();
})();
