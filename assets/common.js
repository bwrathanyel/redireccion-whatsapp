// Lotus 360 -- funciones compartidas por tour/, hospedaje/, boleteria/ e index.html.
// Extraidas sin cambio de comportamiento (eran copias literales duplicadas en cada pagina).
// Cargar con <script src="/assets/common.js"> antes del <script> propio de cada pagina.

function detectarProcedencia() {
    var ua = navigator.userAgent || navigator.vendor || window.opera;
    if (ua.indexOf('Instagram') > -1 || ua.indexOf('FBAN') > -1 || ua.indexOf('FBAV') > -1) return 'Instagram';
    if (ua.indexOf('Facebook') > -1 || ua.indexOf('FB') > -1) return 'Facebook';
    if (document.referrer.indexOf('instagram.com') > -1) return 'Instagram (Web)';
    if (document.referrer.indexOf('facebook.com') > -1) return 'Facebook (Web)';
    return 'Link Directo';
}

function esInstagramInApp() {
    var ua = navigator.userAgent || navigator.vendor || window.opera;
    return (ua.indexOf('Instagram') > -1) || (ua.indexOf('FBAN') > -1) || (ua.indexOf('FBAV') > -1);
}

function enviarDatos(datos) {
    var formData = new FormData();
    formData.append('Nombres', datos.nombre || 'No especificado');
    formData.append('Fecha', datos.fechaHora);
    formData.append('Destino', datos.destino);
    formData.append('Pagina', datos.pagina);
    formData.append('Servicio', datos.servicio);
    formData.append('Procedencia', datos.procedencia || 'No detectada');
    formData.append('Telefono', datos.telefono || 'No especificado');
    formData.append('Asesor', datos.asesor || 'No asignado');
    fetch('https://api.sheetmonkey.io/form/nLKvJpsMkGCFRwwwMMMX21', { method: 'POST', body: formData }).then(function(r) { console.log('Lead registrado en Sheets'); }).catch(function(e) { console.log('Error:', e); });
}

// Registra el lead tambien en el CRM (ademas de Sheet Monkey arriba). Solo
// si hay telefono real -- sin eso el lead no es accionable en el CRM.
function enviarACRM(datos) {
    if (!datos.telefono || datos.telefono === 'No especificado') return;
    fetch('https://begbjhrdbsqftbbleecb.functions.supabase.co/ingest-web-lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }).catch(function(e) { console.log('CRM ingest error:', e); });
}

// Pool de asesores (tour/hospedaje). peso = probabilidad relativa. Boleteria
// usa su propio contacto unico (ASESOR_BOLETERIA), no este pool -- confirmado
// intencional por el usuario 2026-07-09, no tocar.
var ASESORES = [
    { nombre: 'Ambar Arévalo', telefono: '584244900601', peso: 3 },
    { nombre: 'Nicoll Osorio', telefono: '584127136169', peso: 2 },
    { nombre: 'Eudys Chourio', telefono: '584147020527', peso: 1 },
    { nombre: 'Arquímedes Arévalo', telefono: '584128905774', peso: 1 },
    { nombre: 'Luis Rueda', telefono: '584244269876', peso: 1 },
    { nombre: 'Andric Arévalo', telefono: '584140415685', peso: 1 }
];
function elegirAsesor() {
    var total = ASESORES.reduce(function(s, a) { return s + a.peso; }, 0);
    var r = Math.random() * total, acumulado = 0;
    for (var i = 0; i < ASESORES.length; i++) { acumulado += ASESORES[i].peso; if (r < acumulado) return ASESORES[i]; }
    return ASESORES[ASESORES.length - 1];
}

function lanzarConfeti(colores) {
    colores = colores || ['#ff9100', '#25D366', '#ffd166', '#ffb74d'];
    var container = document.createElement('div');
    container.className = 'confeti-container';
    var f = document.createDocumentFragment();
    for (var i = 0; i < 20; i++) {
        var c = document.createElement('div');
        c.className = 'confeti';
        c.style.left = Math.random() * 100 + '%';
        c.style.animationDelay = Math.random() * 0.4 + 's';
        c.style.animationDuration = (Math.random() * 0.8 + 0.7) + 's';
        c.style.backgroundColor = colores[Math.floor(Math.random() * colores.length)];
        f.appendChild(c);
    }
    container.appendChild(f);
    document.body.appendChild(container);
    setTimeout(function() { container.remove(); }, 1500);
}

function transicionSalida(e) {
    e.preventDefault();
    document.body.classList.add('salir');
    var href = e.currentTarget && e.currentTarget.href;
    setTimeout(function() { window.location.href = href || 'https://destinoyeventoslotus360.com/'; }, 250);
}

// Badge de horario en linea/fuera de linea -- requiere #estado-dot/#estado-texto
// en el DOM (presentes en las 4 paginas). Se ejecuta al cargar este script, que
// se incluye al final del <body>, despues de que esos elementos ya existen.
(function() {
    var dot = document.getElementById('estado-dot');
    var texto = document.getElementById('estado-texto');
    if (!dot || !texto) return;
    var ahora = new Date();
    var ve = new Date(ahora.getTime() + ahora.getTimezoneOffset() * 60000 - 4 * 3600000);
    var dia = ve.getDay();
    var horaDecimal = ve.getHours() + ve.getMinutes() / 60;
    var online = (dia >= 1 && dia <= 6) ? (horaDecimal >= 8.5 && horaDecimal < 19) : (dia === 0 && horaDecimal >= 10 && horaDecimal < 15);
    dot.className = 'dot ' + (online ? 'online' : 'offline');
    texto.textContent = online ? 'En línea · Respondemos pronto' : (dia === 0 ? 'Domingos 10am-3pm' : 'Lun-Sáb 8:30am-7pm');
})();
