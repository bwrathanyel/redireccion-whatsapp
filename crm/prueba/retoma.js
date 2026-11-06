/* Volver a abrir la práctica entra directo como quien estaba: sin nombre, sin cargo y sin login.
   Va primero: datos-prueba.js y clientes-ia.js leen nombre, rol y sesión al cargar. Todavía no corre prueba-mock.js,
   por eso las claves se escriben con su prefijo a mano. Cerrar sesión a propósito suelta a la persona (avance.js). */
(() => {
  'use strict';
  const PFX = 'prueba:', SESION = PFX + 'sb-demo-auth-token';
  try {
    if (sessionStorage.getItem(PFX + 'prueba:rol')) return;
    const a = JSON.parse(localStorage.getItem(PFX + 'avance')), u = a?.p?.[a.ultimo];
    if (!u) return;
    sessionStorage.setItem(PFX + 'prueba:nombre', u.nombre);
    sessionStorage.setItem(PFX + 'prueba:rol', u.rol);
    for (const [k, v] of Object.entries(u.datos || {})) sessionStorage.setItem(PFX + k, v);
    // La sesión del mock puede ser de otro cargo (una presentación corre como asesor): sin ella, misiones.js entra por el login.
    if (JSON.parse(localStorage.getItem(SESION))?.refresh_token !== `prueba.${u.rol}`) localStorage.removeItem(SESION);
  } catch { /* sin storage: arranca por el inicio de siempre */ }
})();
