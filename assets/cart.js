// Lotus 360 -- carrito de cotizacion compartido entre tour/, hospedaje/ y
// boleteria/ (localStorage, cruza paginas). Depende de common.js (enviarDatos,
// enviarACRM, elegirAsesor, esInstagramInApp, lanzarConfeti) cargado antes.
//
// Full Day: total EXACTO, solo para los paquetes en FULLDAY_PRECIO_RULES
// (unica fuente de precio/politica de ninos confirmada -- ver
// Scripts/tarifario-sync/knowledge/part-excursiones.json). Cayo Sal no vive
// aqui, sigue con su propio flujo de grupo minimo en tour/index.html.
//
// Hospedaje: nunca un total cerrado -- solo un ESTIMADO rotulado, usando
// tarifas.precio_desde_usd (parseo best-effort, nunca la fuente de verdad)
// cuando existe, o "consultar" si no.
var L360Cart = (function() {
    var SUPABASE_URL = 'https://begbjhrdbsqftbbleecb.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_M7Ms9DLwpNSCXZNCDhYtbQ_LhMYeLxk';
    var FOTOS_BASE = SUPABASE_URL + '/storage/v1/object/public/tarifario-fotos/';
    var CART_KEY = 'l360_carrito';
    var fotosPorUid = {};

    // Mismo criterio que lotus-crm-preview/app.js: activo!==false, es_principal
    // primero, luego orden. Fotos reales curadas del hotel/paquete -- nunca se
    // inventa una imagen para algo sin fotos propias.
    function ordenarFotos(arr) {
        return (arr || []).filter(function(f) { return f.activo !== false; }).slice()
            .sort(function(a, b) { return (b.es_principal ? 1 : 0) - (a.es_principal ? 1 : 0) || a.orden - b.orden; });
    }
    function fotosDe(producto) { return ordenarFotos(producto && producto.producto_fotos).map(function(f) { return FOTOS_BASE + f.storage_path; }); }
    function truncar(txt, max) { if (!txt) return ''; return txt.length > max ? txt.slice(0, max).replace(/\s+\S*$/, '') + '…' : txt; }

    var FULLDAY_PRECIO_RULES = {
        'Coche Express (Sunsol)': { adultoUsd: 89, ninoUsd: 45, ninoEdadTexto: '4-10 años', ninosPolicy: { tipo: 'precio_fijo_nino' }, emoji: '🏝️' },
        'Daypass Ecoland (Sunsol)': { adultoUsd: 72, ninoUsd: 36, ninoEdadTexto: '4-10 años', ninosPolicy: { tipo: 'precio_fijo_nino' }, emoji: '🌴' },
        'Daypass Unik (Sunsol Unik Luxury Hotel)': { adultoUsd: 50, ninoUsd: 25, ninoEdadTexto: '4-10 años', ninosPolicy: { tipo: 'precio_fijo_nino' }, emoji: '✨' },
        'Daypass Isla Caribe (Sunsol)': { adultoUsd: 59, ninoUsd: 30, ninoEdadTexto: '4-10 años', ninosPolicy: { tipo: 'precio_fijo_nino' }, emoji: '🏖️' },
        'Full Day Sparta Tours - Vamos a Cubagua': { adultoUsd: 59, ninoUsd: 30, ninoEdadTexto: '4-10 años', ninosPolicy: { tipo: 'precio_fijo_nino' }, emoji: '🚤', nota: 'Modalidad Full Day' },
        'Pool Day Costa Caribe': { adultoUsd: 40, ninoUsd: 40, ninosPolicy: { tipo: 'precio_fijo_nino' }, emoji: '🏊', nota: 'Precio único por persona' },
        'Viola Festival - Vive Coche (Sunsol)': { adultoUsd: 89, ninoUsd: 45, ninoEdadTexto: '4-10 años', ninosPolicy: { tipo: 'precio_fijo_nino' }, emoji: '🎉', nota: 'Solo fechas de festival' }
    };

    // Snapshot estatico: si falla el fetch a Supabase, el catalogo Full Day
    // no debe quedar vacio. Mantener sincronizado a mano con las reglas de arriba.
    var FULLDAY_FALLBACK = Object.keys(FULLDAY_PRECIO_RULES).map(function(nombre) {
        var r = FULLDAY_PRECIO_RULES[nombre];
        return { nombre: nombre, precio_texto: 'Adultos $' + r.adultoUsd + (r.ninoUsd != null ? ', Niños $' + r.ninoUsd + (r.ninoEdadTexto ? ' (' + r.ninoEdadTexto + ')' : '') : ''), vigencia_texto: null };
    });

    function sbGet(query) {
        return fetch(SUPABASE_URL + '/rest/v1/' + query, { headers: { apikey: SUPABASE_ANON_KEY } })
            .then(function(r) { if (!r.ok) throw new Error('sb_' + r.status); return r.json(); });
    }

    // ---------- Carrito (localStorage) ----------
    function leerCarrito() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; } }
    function guardarCarrito(items) { localStorage.setItem(CART_KEY, JSON.stringify(items)); actualizarBadge(); }

    function agregarAlCarrito(item) {
        var items = leerCarrito();
        item.id = 'it_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        items.push(item);
        guardarCarrito(items);
        mostrarToast('Agregado al carrito: ' + item.nombre);
        return item.id;
    }
    function quitarDelCarrito(id) { guardarCarrito(leerCarrito().filter(function(i) { return i.id !== id; })); renderSheetItems(); }
    function actualizarItemCarrito(id, cambios) {
        var items = leerCarrito();
        for (var i = 0; i < items.length; i++) { if (items[i].id === id) { for (var k in cambios) items[i][k] = cambios[k]; } }
        guardarCarrito(items);
        renderSheetItems();
    }
    function vaciarCarrito() { guardarCarrito([]); renderSheetItems(); }

    // ---------- Motor de precio ----------
    function calcularLineaFullDay(item) {
        var regla = FULLDAY_PRECIO_RULES[item.nombre];
        if (!regla) return { total: null, detalleNinos: '' };
        var adultos = item.adultos || 0, ninos = item.ninos || 0;
        var totalAdultos = adultos * regla.adultoUsd;
        var pol = regla.ninosPolicy || { tipo: 'consultar' };
        if (pol.tipo === 'gratis') {
            var max = pol.maxGratis != null ? pol.maxGratis : ninos;
            var gratis = Math.min(ninos, max), pagan = Math.max(0, ninos - max);
            var precioNinoPago = regla.ninoUsd != null ? regla.ninoUsd : regla.adultoUsd;
            var totalNinos = pagan * precioNinoPago;
            var detalle = ninos > 0 ? (gratis + ' niño(s) gratis' + (pagan > 0 ? ' + ' + pagan + ' niño(s) a $' + precioNinoPago : '')) : '';
            return { total: totalAdultos + totalNinos, adultosTotal: totalAdultos, ninosTotal: totalNinos, detalleNinos: detalle };
        }
        if (pol.tipo === 'descuento_pct') {
            var precioNino = +(regla.adultoUsd * (1 - pol.pct / 100)).toFixed(2);
            var totalNinos2 = ninos * precioNino;
            var detalle2 = ninos > 0 ? (ninos + ' niño(s) con ' + pol.pct + '% desc. ($' + precioNino + ' c/u)') : '';
            return { total: totalAdultos + totalNinos2, adultosTotal: totalAdultos, ninosTotal: totalNinos2, detalleNinos: detalle2 };
        }
        if (pol.tipo === 'precio_fijo_nino') {
            var totalNinos3 = ninos * regla.ninoUsd;
            var detalle3 = ninos > 0 ? (ninos + ' niño(s) x $' + regla.ninoUsd + (regla.ninoEdadTexto ? ' (' + regla.ninoEdadTexto + ')' : '')) : '';
            return { total: totalAdultos + totalNinos3, adultosTotal: totalAdultos, ninosTotal: totalNinos3, detalleNinos: detalle3 };
        }
        // consultar: nunca se ofrece un total cerrado para los ninos sin regla confirmada
        return { total: null, adultosTotal: totalAdultos, detalleNinos: ninos > 0 ? (ninos + ' niño(s): consultar tarifa con tu asesor') : '' };
    }

    function calcularLineaHospedaje(item) {
        var noches = item.noches || 1, personas = (item.adultos || 0) + (item.ninos || 0);
        if (item.precioDesdeUsd) return { estimado: item.precioDesdeUsd * personas * noches, esEstimado: true };
        return { estimado: null, esEstimado: true };
    }

    function calcularLinea(item) { return item.tipo === 'fullday' ? calcularLineaFullDay(item) : calcularLineaHospedaje(item); }

    function calcularTotalCarrito() {
        var items = leerCarrito(), totalExacto = 0, totalEstimado = 0, hayExacto = false, hayEstimado = false, hayConsultar = false;
        items.forEach(function(item) {
            var c = calcularLinea(item);
            if (item.tipo === 'fullday') {
                if (c.total != null) { totalExacto += c.total; hayExacto = true; } else { hayConsultar = true; }
            } else {
                if (c.estimado != null) { totalEstimado += c.estimado; hayEstimado = true; } else { hayConsultar = true; }
            }
        });
        return { totalExacto: totalExacto, totalEstimado: totalEstimado, hayExacto: hayExacto, hayEstimado: hayEstimado, hayConsultar: hayConsultar, cantidad: items.length };
    }

    // ---------- Catalogo Full Day ----------
    function cargarCatalogoFullDay() {
        var nombres = Object.keys(FULLDAY_PRECIO_RULES);
        return Promise.all(nombres.map(function(nombre) {
            return sbGet('productos?select=nombre,descripcion,tarifas(precio_texto,vigencia_texto,vigente),producto_fotos(storage_path,orden,es_principal,activo)&nombre=eq.' + encodeURIComponent(nombre) + '&activo=eq.true')
                .then(function(rows) { return rows && rows[0] ? rows[0] : null; })
                .catch(function() { return null; });
        })).then(function(resultados) {
            var porNombre = {};
            resultados.forEach(function(r) { if (r) porNombre[r.nombre] = r; });
            return nombres.map(function(nombre) {
                var db = porNombre[nombre];
                var tarifa = db && db.tarifas && db.tarifas[0];
                return { nombre: nombre, precio_texto: tarifa ? tarifa.precio_texto : null, vigencia_texto: tarifa ? tarifa.vigencia_texto : null, descripcion: db ? db.descripcion : null, producto_fotos: db ? db.producto_fotos : null };
            });
        }).catch(function() { return FULLDAY_FALLBACK; });
    }

    function renderCatalogoFullDay(containerId) {
        var cont = document.getElementById(containerId);
        if (!cont) return;
        cont.innerHTML = '<div class="l360-cat-loading"><i class="fas fa-circle-notch fa-spin"></i> Cargando paquetes...</div>';
        cargarCatalogoFullDay().then(function(lista) {
            if (!lista.length) { cont.innerHTML = ''; return; }
            cont.innerHTML = lista.map(function(p) { return tarjetaFullDayHtml(p); }).join('');
        });
    }

    function tarjetaFullDayHtml(p) {
        var regla = FULLDAY_PRECIO_RULES[p.nombre] || {};
        var uid = 'fd_' + btoa(unescape(encodeURIComponent(p.nombre))).replace(/[^a-zA-Z0-9]/g, '');
        var precioRef = p.precio_texto || ('Adultos $' + regla.adultoUsd + (regla.ninoUsd != null ? ', Niños $' + regla.ninoUsd : ''));
        return '' +
            '<div class="l360-pkg-card" data-nombre="' + escHtml(p.nombre) + '">' +
                fotoHeaderHtml(uid, fotosDe(p), regla.emoji || '🌴') +
                '<div class="l360-pkg-body">' +
                    '<div class="l360-pkg-titulo">' + escHtml(p.nombre) + '</div>' +
                    '<div class="l360-pkg-precio-ref">' + escHtml(precioRef) + '</div>' +
                    (p.descripcion ? '<p class="l360-pkg-desc">' + escHtml(truncar(p.descripcion, 130)) + '</p>' : '') +
                    (regla.nota ? '<div class="l360-pkg-nota"><i class="fas fa-circle-info"></i> ' + escHtml(regla.nota) + '</div>' : '') +
                    '<div class="l360-stepper-row">' +
                        stepperHtml(uid, 'adultos', 'Adultos', 1) +
                        stepperHtml(uid, 'ninos', 'Niños' + (regla.ninoEdadTexto ? ' (' + regla.ninoEdadTexto + ')' : ''), 0) +
                    '</div>' +
                    '<div class="l360-pkg-total" id="' + uid + '-total"></div>' +
                    '<button class="l360-btn-add" onclick="L360Cart.agregarFullDayDesdeCard(\'' + uid + '\')"><i class="fas fa-cart-plus"></i> Agregar al carrito</button>' +
                '</div>' +
            '</div>';
    }

    function fotoHeaderHtml(uid, fotos, emojiFallback) {
        fotosPorUid[uid] = fotos || [];
        if (!fotos || !fotos.length) return '<div class="l360-pkg-photo l360-pkg-photo-empty">' + emojiFallback + '</div>';
        var dots = fotos.length > 1 ? '<div class="l360-pkg-photo-dots" id="' + uid + '-dots">' + fotos.map(function(_, i) { return '<span class="' + (i === 0 ? 'on' : '') + '"></span>'; }).join('') + '</div>' : '';
        var nav = fotos.length > 1 ? (
            '<button type="button" class="l360-pkg-photo-nav prev" onclick="event.stopPropagation();L360Cart.cambiarFoto(\'' + uid + '\',-1)" aria-label="Foto anterior"><i class="fas fa-chevron-left"></i></button>' +
            '<button type="button" class="l360-pkg-photo-nav next" onclick="event.stopPropagation();L360Cart.cambiarFoto(\'' + uid + '\',1)" aria-label="Foto siguiente"><i class="fas fa-chevron-right"></i></button>'
        ) : '';
        var count = fotos.length > 1 ? '<span class="l360-pkg-photo-count">1/' + fotos.length + '</span>' : '';
        return '<div class="l360-pkg-photo"><img id="' + uid + '-img" src="' + fotos[0] + '" data-idx="0" loading="lazy" alt="">' + nav + dots + count + '</div>';
    }

    function cambiarFoto(uid, delta) {
        var fotos = fotosPorUid[uid];
        if (!fotos || !fotos.length) return;
        var img = document.getElementById(uid + '-img');
        if (!img) return;
        var idx = (parseInt(img.dataset.idx || '0') + delta + fotos.length) % fotos.length;
        img.dataset.idx = idx;
        img.src = fotos[idx];
        var dotsWrap = document.getElementById(uid + '-dots');
        if (dotsWrap) { for (var i = 0; i < dotsWrap.children.length; i++) dotsWrap.children[i].className = i === idx ? 'on' : ''; }
        var countEl = img.parentElement.querySelector('.l360-pkg-photo-count');
        if (countEl) countEl.textContent = (idx + 1) + '/' + fotos.length;
    }

    function stepperHtml(uid, campo, label, valorInicial) {
        var id = uid + '-' + campo;
        return '<div class="l360-stepper"><label>' + label + '</label><div class="l360-stepper-ctrl">' +
            '<button type="button" onclick="L360Cart.cambiarStepper(\'' + id + '\',-1,\'' + uid + '\')">−</button>' +
            '<span id="' + id + '" data-val="' + valorInicial + '">' + valorInicial + '</span>' +
            '<button type="button" onclick="L360Cart.cambiarStepper(\'' + id + '\',1,\'' + uid + '\')">+</button>' +
        '</div></div>';
    }

    function stepperVal(id) { var el = document.getElementById(id); return el ? parseInt(el.dataset.val || '0') : 0; }

    function cambiarStepper(id, delta, uid) {
        var el = document.getElementById(id);
        if (!el) return;
        var v = Math.max(0, parseInt(el.dataset.val || '0') + delta);
        el.dataset.val = v; el.textContent = v;
        actualizarTotalTarjeta(uid);
    }

    function actualizarTotalTarjeta(uid) {
        var card = document.getElementById(uid + '-total');
        if (!card) return;
        var cardEl = card.closest('.l360-pkg-card');
        var nombre = cardEl ? cardEl.dataset.nombre : null;
        var adultos = stepperVal(uid + '-adultos'), ninos = stepperVal(uid + '-ninos');
        if (!nombre || adultos < 1) { card.innerHTML = adultos < 1 ? 'Indica al menos 1 adulto' : ''; return; }
        var calc = calcularLineaFullDay({ tipo: 'fullday', nombre: nombre, adultos: adultos, ninos: ninos });
        if (calc.total == null) { card.innerHTML = '<span class="l360-total-consultar">' + (calc.detalleNinos || 'Consultar precio con tu asesor') + '</span>'; return; }
        card.innerHTML = '<b>$' + calc.total + ' USD</b>' + (calc.detalleNinos ? ' · ' + calc.detalleNinos : '');
    }

    function agregarFullDayDesdeCard(uid) {
        var totalEl = document.getElementById(uid + '-total');
        var cardEl = totalEl ? totalEl.closest('.l360-pkg-card') : null;
        if (!cardEl) return;
        var nombre = cardEl.dataset.nombre;
        var adultos = stepperVal(uid + '-adultos'), ninos = stepperVal(uid + '-ninos');
        if (adultos < 1) { mostrarToast('Indica al menos 1 adulto'); return; }
        agregarAlCarrito({ tipo: 'fullday', nombre: nombre, adultos: adultos, ninos: ninos });
    }

    // ---------- Catalogo Hospedaje ----------
    function cargarCatalogoHospedaje() {
        return sbGet('productos?select=id,nombre,destino,descripcion,tarifas(precio_texto,precio_desde_usd,vigencia_texto,vigente),promociones(titulo,precio_texto,precio_desde_usd,ninos_gratis_cantidad,revisado),producto_fotos(storage_path,orden,es_principal,activo)&tipo=eq.hotel&activo=eq.true&order=nombre')
            .catch(function() { return []; });
    }

    function tienePromoRevisada(h) { return (h.promociones || []).some(function(p) { return p.revisado; }); }

    function renderCatalogoHospedaje(containerId) {
        var cont = document.getElementById(containerId);
        if (!cont) return;
        cont.innerHTML = '<div class="l360-cat-loading"><i class="fas fa-circle-notch fa-spin"></i> Cargando ofertas...</div>';
        cargarCatalogoHospedaje().then(function(lista) {
            var enPromo = (lista || []).filter(tienePromoRevisada);
            actualizarLabelToggleHoteles(enPromo.length);
            if (!enPromo.length) { cont.innerHTML = '<div class="l360-cat-empty">No hay ofertas de hotel activas ahora mismo — escríbenos directo con el formulario de abajo 👇</div>'; return; }
            cont.innerHTML = enPromo.map(function(h) { return tarjetaHospedajeHtml(h); }).join('');
        }).catch(function() {
            cont.innerHTML = '<div class="l360-cat-empty">No pudimos cargar las ofertas ahora — escríbenos directo con el formulario de abajo 👇</div>';
        });
    }

    // ---------- Desplegable de ofertas de hotel, solo visible si el destino
    // elegido en el formulario de abajo es Isla de Margarita (unico destino
    // con hoteles cargados en el tarifario hoy).
    function actualizarDestinoHospedaje(destino) {
        var wrap = document.getElementById('l360-hospedaje-promo-wrap');
        if (wrap) wrap.style.display = (destino === 'Isla de Margarita') ? '' : 'none';
    }
    function actualizarLabelToggleHoteles(n) {
        var label = document.getElementById('l360-hoteles-toggle-label');
        if (label) label.textContent = n > 0 ? ('Ver ' + n + ' hotel(es) en oferta') : 'Sin ofertas de hotel ahora mismo';
    }
    function toggleHotelesPromo() {
        var btn = document.getElementById('l360-hoteles-toggle-btn');
        var cont = document.getElementById('l360-hospedaje-catalogo-wrap');
        if (!btn || !cont) return;
        var abierto = cont.classList.toggle('open');
        btn.classList.toggle('open', abierto);
    }

    function tarjetaHospedajeHtml(h) {
        var tarifa = (h.tarifas && h.tarifas[0]) || {};
        var promos = (h.promociones || []).filter(function(p) { return p.revisado; }).sort(function(a, b) {
            if (a.precio_desde_usd == null) return 1;
            if (b.precio_desde_usd == null) return -1;
            return a.precio_desde_usd - b.precio_desde_usd;
        });
        var promo = promos[0];
        var precioDesde = (promo && promo.precio_desde_usd) || tarifa.precio_desde_usd || null;
        var precioTexto = (promo && promo.precio_texto) || tarifa.precio_texto || 'Precio a consultar con tu asesor';
        var ninosGratis = promo && promo.ninos_gratis_cantidad;
        var uid = 'hp_' + h.id;
        return '' +
            '<div class="l360-pkg-card" data-hotel-id="' + h.id + '" data-nombre="' + escHtml(h.nombre) + '" data-precio-desde="' + (precioDesde || '') + '">' +
                fotoHeaderHtml(uid, fotosDe(h), '🏨') +
                '<div class="l360-pkg-body">' +
                    (promo ? '<div class="l360-pkg-promo-badge"><i class="fas fa-fire"></i> ' + escHtml(promo.titulo) + '</div>' : '') +
                    '<div class="l360-pkg-titulo">' + escHtml(h.nombre) + '</div>' +
                    '<div class="l360-pkg-precio-ref">' + escHtml(precioTexto) + '</div>' +
                    (h.descripcion ? '<p class="l360-pkg-desc">' + escHtml(truncar(h.descripcion, 130)) + '</p>' : '') +
                    (ninosGratis ? '<div class="l360-pkg-nota l360-pkg-nota-ok"><i class="fas fa-child"></i> Primeros ' + ninosGratis + ' niño(s) gratis en esta promo</div>' : '') +
                    '<div class="l360-estimado-tag"><i class="fas fa-triangle-exclamation"></i> Estimado, sujeto a confirmación con tu asesor</div>' +
                    '<div class="l360-stepper-row">' +
                        stepperHtml(uid, 'adultos', 'Adultos', 2) +
                        stepperHtml(uid, 'ninos', 'Niños', 0) +
                        stepperHtml(uid, 'noches', 'Noches', 1) +
                    '</div>' +
                    '<div class="l360-pkg-total" id="' + uid + '-total"></div>' +
                    '<button class="l360-btn-add" onclick="L360Cart.agregarHospedajeDesdeCard(\'' + uid + '\')"><i class="fas fa-cart-plus"></i> Agregar al carrito</button>' +
                '</div>' +
            '</div>';
    }

    function agregarHospedajeDesdeCard(uid) {
        var totalEl = document.getElementById(uid + '-total');
        var cardEl = totalEl ? totalEl.closest('.l360-pkg-card') : null;
        if (!cardEl) return;
        var nombre = cardEl.dataset.nombre;
        var precioDesde = cardEl.dataset.precioDesde ? parseFloat(cardEl.dataset.precioDesde) : null;
        var adultos = stepperVal(uid + '-adultos'), ninos = stepperVal(uid + '-ninos'), noches = stepperVal(uid + '-noches') || 1;
        if (adultos < 1) { mostrarToast('Indica al menos 1 adulto'); return; }
        agregarAlCarrito({ tipo: 'hospedaje', nombre: nombre, adultos: adultos, ninos: ninos, noches: noches, precioDesdeUsd: precioDesde });
    }

    // ---------- FAB + Sheet ----------
    function actualizarBadge() {
        var badge = document.getElementById('l360-fab-badge');
        if (!badge) return;
        var n = leerCarrito().length;
        badge.textContent = n;
        badge.style.display = n > 0 ? 'flex' : 'none';
    }

    function initFAB() {
        if (document.getElementById('l360-fab-cart')) { actualizarBadge(); return; }
        var fab = document.createElement('button');
        fab.id = 'l360-fab-cart';
        fab.className = 'l360-fab-cart';
        fab.setAttribute('aria-label', 'Ver carrito de cotización');
        fab.innerHTML = '<i class="fas fa-cart-shopping"></i><span id="l360-fab-badge" class="l360-fab-badge">0</span>';
        fab.onclick = abrirSheet;
        document.body.appendChild(fab);
        injectSheetSkeleton();
        actualizarBadge();
    }

    function injectSheetSkeleton() {
        if (document.getElementById('l360-sheet-bg')) return;
        var bg = document.createElement('div');
        bg.id = 'l360-sheet-bg';
        bg.className = 'l360-sheet-bg';
        bg.onclick = cerrarSheet;
        var sheet = document.createElement('div');
        sheet.id = 'l360-sheet';
        sheet.className = 'l360-sheet';
        sheet.innerHTML = '' +
            '<div class="l360-sheet-handle"></div>' +
            '<div class="l360-sheet-header"><i class="fas fa-cart-shopping"></i> Tu cotización<button class="l360-sheet-close" onclick="L360Cart.cerrarSheet()"><i class="fas fa-xmark"></i></button></div>' +
            '<div id="l360-sheet-items" class="l360-sheet-items"></div>' +
            '<div id="l360-sheet-checkout" class="l360-sheet-checkout"></div>';
        document.body.appendChild(bg);
        document.body.appendChild(sheet);
    }

    function abrirSheet() { injectSheetSkeleton(); renderSheetItems(); document.getElementById('l360-sheet-bg').classList.add('open'); document.getElementById('l360-sheet').classList.add('open'); document.body.style.overflow = 'hidden'; }
    function cerrarSheet() { var bg = document.getElementById('l360-sheet-bg'), sh = document.getElementById('l360-sheet'); if (bg) bg.classList.remove('open'); if (sh) sh.classList.remove('open'); document.body.style.overflow = ''; }

    function renderSheetItems() {
        var cont = document.getElementById('l360-sheet-items');
        if (!cont) return;
        var items = leerCarrito();
        if (!items.length) {
            cont.innerHTML = '<div class="l360-sheet-empty"><i class="fas fa-cart-shopping"></i><p>Tu carrito está vacío.<br>Agrega un Full Day o un hospedaje para empezar tu cotización.</p></div>';
            document.getElementById('l360-sheet-checkout').innerHTML = '';
            return;
        }
        cont.innerHTML = items.map(function(item) {
            var c = calcularLinea(item);
            var precioHtml;
            if (item.tipo === 'fullday') {
                precioHtml = c.total != null ? '<b>$' + c.total + ' USD</b>' + (c.detalleNinos ? ' · ' + c.detalleNinos : '') : '<span class="l360-total-consultar">' + (c.detalleNinos || 'Consultar con tu asesor') + '</span>';
            } else {
                precioHtml = '<span class="l360-estimado-tag l360-estimado-inline"><i class="fas fa-triangle-exclamation"></i> ' + (c.estimado != null ? 'Estimado: $' + c.estimado.toFixed(0) + ' USD' : 'Consultar con tu asesor') + ' · sujeto a confirmación</span>';
            }
            return '' +
                '<div class="l360-sheet-item">' +
                    '<div class="l360-sheet-item-head"><span class="l360-sheet-item-titulo">' + (item.tipo === 'fullday' ? '🌴' : '🏨') + ' ' + escHtml(item.nombre) + '</span>' +
                    '<button class="l360-sheet-item-del" onclick="L360Cart.quitarDelCarrito(\'' + item.id + '\')" aria-label="Quitar"><i class="fas fa-trash"></i></button></div>' +
                    '<div class="l360-sheet-item-meta">' + item.adultos + ' adulto(s)' + (item.ninos ? ' · ' + item.ninos + ' niño(s)' : '') + (item.noches ? ' · ' + item.noches + ' noche(s)' : '') + '</div>' +
                    '<div class="l360-sheet-item-precio">' + precioHtml + '</div>' +
                '</div>';
        }).join('');
        renderCheckoutForm();
    }

    function renderCheckoutForm() {
        var cont = document.getElementById('l360-sheet-checkout');
        if (!cont) return;
        var t = calcularTotalCarrito();
        var resumen = [];
        if (t.hayExacto) resumen.push('$' + t.totalExacto.toFixed(0) + ' USD confirmados');
        if (t.hayEstimado) resumen.push('~$' + t.totalEstimado.toFixed(0) + ' USD estimados');
        if (t.hayConsultar) resumen.push('parte a consultar');
        cont.innerHTML = '' +
            '<div class="l360-sheet-total">' + (resumen.join(' + ') || 'Agrega ítems para ver el total') + '</div>' +
            '<div class="l360-checkout-form">' +
                '<div class="l360-form-row"><input type="text" id="l360-nombre" placeholder="Nombre" autocomplete="given-name"><input type="text" id="l360-apellido" placeholder="Apellido" autocomplete="family-name"></div>' +
                '<div class="l360-form-row"><input type="text" id="l360-cedula" placeholder="Cédula (ej: V-12345678)" autocomplete="off"><input type="tel" id="l360-telefono" placeholder="Teléfono" autocomplete="tel"></div>' +
                '<button class="l360-btn-checkout" onclick="L360Cart.enviarCotizacion()"><i class="fab fa-whatsapp"></i> Enviar cotización por WhatsApp</button>' +
            '</div>';
    }

    function enviarCotizacion() {
        var items = leerCarrito();
        if (!items.length) { mostrarToast('Tu carrito está vacío'); return; }
        var nombre = (document.getElementById('l360-nombre').value || '').trim();
        var apellido = (document.getElementById('l360-apellido').value || '').trim();
        var cedula = (document.getElementById('l360-cedula').value || '').trim();
        var telefono = (document.getElementById('l360-telefono').value || '').trim();
        if (!nombre || !apellido) { mostrarToast('Completa nombre y apellido'); return; }
        var nombreCompleto = nombre + ' ' + apellido;
        var t = calcularTotalCarrito();
        var asesor = elegirAsesor();
        var procedencia = detectarProcedencia();

        var lineasDatos = items.map(function(item) {
            var c = calcularLinea(item);
            if (item.tipo === 'fullday') return item.nombre + ' (' + item.adultos + 'A' + (item.ninos ? '+' + item.ninos + 'N' : '') + (c.total != null ? ', $' + c.total : ', consultar') + ')';
            return item.nombre + ' (' + item.adultos + 'A' + (item.ninos ? '+' + item.ninos + 'N' : '') + ', ' + (item.noches || 1) + 'n, ' + (c.estimado != null ? 'est. $' + c.estimado.toFixed(0) : 'consultar') + ')';
        });
        var destinos = items.map(function(i) { return i.nombre; }).join(' + ');

        enviarDatos({ fechaHora: new Date().toLocaleString('es-VE'), destino: destinos, servicio: 'Carrito (' + items.length + ' ítem(s))', pagina: 'Carrito', nombre: nombreCompleto, procedencia: procedencia, telefono: telefono || 'No especificado', asesor: asesor.telefono });
        enviarACRM({ nombre: nombreCompleto, telefono: telefono || 'No especificado', destino: destinos, personas: items.reduce(function(s, i) { return s + i.adultos + (i.ninos || 0); }, 0) + ' persona(s)', consulta: 'Cédula: ' + (cedula || 'No especificada') + ' · ' + lineasDatos.join(' · ') });

        var lineasEmoji = ['🛒 *COTIZACIÓN CARRITO - LOTUS 360*', '', '👤 *Nombre:* ' + nombreCompleto, '🆔 *Cédula:* ' + (cedula || 'No especificada')];
        var lineasTexto = ['▸ COTIZACIÓN CARRITO - LOTUS 360 ◂', '', '► Nombre: ' + nombreCompleto, '► Cédula: ' + (cedula || 'No especificada')];
        items.forEach(function(item, idx) {
            var c = calcularLinea(item);
            var icono = item.tipo === 'fullday' ? '🌴' : '🏨';
            var precioTxt = item.tipo === 'fullday'
                ? (c.total != null ? '$' + c.total + ' USD' + (c.detalleNinos ? ' (' + c.detalleNinos + ')' : '') : 'Consultar tarifa niños con asesor')
                : (c.estimado != null ? 'Estimado $' + c.estimado.toFixed(0) + ' USD (sujeto a confirmación)' : 'Consultar con asesor');
            lineasEmoji.push('', (idx + 1) + '. ' + icono + ' *' + item.nombre + '*', '   👥 ' + item.adultos + ' adulto(s)' + (item.ninos ? ' + ' + item.ninos + ' niño(s)' : '') + (item.noches ? ' · ' + item.noches + ' noche(s)' : ''), '   💰 ' + precioTxt);
            lineasTexto.push('', (idx + 1) + '. ' + item.nombre, '   Personas: ' + item.adultos + ' adulto(s)' + (item.ninos ? ' + ' + item.ninos + ' niño(s)' : '') + (item.noches ? ' · ' + item.noches + ' noche(s)' : ''), '   Precio: ' + precioTxt);
        });
        var totalTxt = (t.hayExacto ? '$' + t.totalExacto.toFixed(0) + ' USD confirmados' : '') + (t.hayExacto && t.hayEstimado ? ' + ' : '') + (t.hayEstimado ? '~$' + t.totalEstimado.toFixed(0) + ' USD estimados' : '') + (t.hayConsultar ? ' + parte a consultar' : '');
        lineasEmoji.push('', '💵 *Total:* ' + totalTxt, '', '✅ *Confirmar disponibilidad y cerrar cotización. ¡Gracias!*');
        lineasTexto.push('', 'Total: ' + totalTxt, '', 'Confirmar disponibilidad y cerrar cotización. Gracias.');

        var mensajeFinal = esInstagramInApp() ? lineasTexto.join('\n') : lineasEmoji.join('\n');
        var waLink = 'https://wa.me/' + asesor.telefono + '?text=' + encodeURIComponent(mensajeFinal);
        lanzarConfeti();
        vaciarCarrito();
        cerrarSheet();
        window.open(waLink, '_blank', 'noopener');
    }

    // ---------- Toast ----------
    function mostrarToast(texto) {
        var existente = document.getElementById('l360-toast');
        if (existente) existente.remove();
        var t = document.createElement('div');
        t.id = 'l360-toast';
        t.className = 'l360-toast';
        t.innerHTML = '<i class="fas fa-circle-check"></i> ' + escHtml(texto);
        document.body.appendChild(t);
        requestAnimationFrame(function() { t.classList.add('show'); });
        setTimeout(function() { t.classList.remove('show'); setTimeout(function() { t.remove(); }, 250); }, 2200);
    }

    function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    return {
        initFAB: initFAB,
        renderCatalogoFullDay: renderCatalogoFullDay,
        renderCatalogoHospedaje: renderCatalogoHospedaje,
        cambiarStepper: cambiarStepper,
        cambiarFoto: cambiarFoto,
        actualizarDestinoHospedaje: actualizarDestinoHospedaje,
        toggleHotelesPromo: toggleHotelesPromo,
        agregarFullDayDesdeCard: agregarFullDayDesdeCard,
        agregarHospedajeDesdeCard: agregarHospedajeDesdeCard,
        quitarDelCarrito: quitarDelCarrito,
        enviarCotizacion: enviarCotizacion,
        abrirSheet: abrirSheet,
        cerrarSheet: cerrarSheet
    };
})();
