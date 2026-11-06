/* El avance de la práctica sobrevive a salir y volver. El modo prueba vive en sessionStorage (muere con la
   pestaña): acá se copia a localStorage por persona y cargo. El nivel y los chats abiertos están en la EF
   prueba-cliente-ia; para recuperarlos alcanza con conservar clientes:sesion.
   Va después de prueba-mock.js: las claves ya salen con el prefijo que aísla la prueba del CRM real. */
(() => {
  'use strict';
  const CLAVE = 'avance', MAX = 8;
  const LLAVES = ['misiones', 'clientes:sesion', 'clientes:activo', 'clientes:intro', 'clientes:examen', 'clientes:nivel', 'clientes:cots'];
  const ss = k => { try { return sessionStorage.getItem(k); } catch { return null; } };
  const idDe = (nombre, rol) => `${String(nombre).trim().toLowerCase()}|${rol}`;
  const lee = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || { p: {} }; } catch { return { p: {} }; } };
  function guarda() {
    const nombre = ss('prueba:nombre'), rol = ss('prueba:rol');
    if (!nombre || !rol || ss('prueba:modo') === 'presentacion') return;
    const a = lee(), id = idDe(nombre, rol);
    a.p[id] = { nombre, rol, en: Date.now(), datos: Object.fromEntries(LLAVES.map(k => [k, ss(k)]).filter(([, v]) => v != null)) };
    a.ultimo = id;
    // Un computador de inducción lo comparten varios: se conservan los más recientes.
    Object.keys(a.p).sort((x, y) => a.p[y].en - a.p[x].en).slice(MAX).forEach(k => delete a.p[k]);
    try { localStorage.setItem(CLAVE, JSON.stringify(a)); } catch { /* sin storage: el avance dura lo que la pestaña */ }
  }
  // Deja la pestaña con lo guardado de esa persona en ese cargo; si no hay nada, limpia lo de quien estaba antes.
  function restaura(nombre, rol) {
    const datos = lee().p[idDe(nombre, rol)]?.datos || {};
    for (const k of LLAVES) try { if (k in datos) sessionStorage.setItem(k, datos[k]); else sessionStorage.removeItem(k); } catch { /* sin storage */ }
    return Object.keys(datos).length > 0;
  }
  // Lo guardado se queda (volver con el mismo nombre lo retoma), pero retoma.js ya no entra solo como esa persona.
  function suelta() {
    guarda();
    const a = lee();
    delete a.ultimo;
    try { localStorage.setItem(CLAVE, JSON.stringify(a)); } catch { /* sin storage: no hay nada que soltar */ }
  }
  // Cerrar sesión es cambiar de persona: sin nombre ni rol en la pestaña, el próximo guarda() no la vuelve a marcar.
  function olvida() {
    suelta();
    for (const k of [...LLAVES, 'prueba:nombre', 'prueba:rol', 'prueba:modo']) try { sessionStorage.removeItem(k); } catch { /* sin storage */ }
  }

  let espera = null;
  addEventListener('prueba:accion', () => { clearTimeout(espera); espera = setTimeout(guarda, 1500); });
  addEventListener('pagehide', guarda);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guarda(); });
  window.__pruebaAvance = { guarda, restaura, suelta, olvida, CLAVE };
})();
