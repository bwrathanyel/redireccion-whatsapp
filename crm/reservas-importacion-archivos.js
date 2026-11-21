import { lineasDeItems, lectorOcr, lineasDeOcr } from './boletos-emitidos.js';
import { leerMetadatos, parsearPdfLotus, parsearConsolidador, combinarImportaciones, normalizarImportacion } from './reservas-importacion-datos.js';

export const LIMITES_IMPORTACION = Object.freeze({ archivos: 20, bytes: 10485760, paginas: 50, texto: 180000 });
const MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const abortar = signal => { if (signal?.aborted) throw new DOMException('Lectura cancelada', 'AbortError'); };
const fallo = mensaje => { throw new Error(mensaje); };
const huella = async file => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(x => x.toString(16).padStart(2, '0')).join('');
export async function validarArchivoImportacion(file) {
  if (!file?.size || file.size > LIMITES_IMPORTACION.bytes) fallo(`${file?.name || 'Archivo'}: debe pesar entre 1 byte y 10 MB.`);
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const mime = b[0] === 37 && b[1] === 80 && b[2] === 68 && b[3] === 70 && b[4] === 45 ? 'application/pdf'
    : b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'image/jpeg'
      : b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10 ? 'image/png'
        : String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP' ? 'image/webp' : null;
  if (!MIMES.has(mime) || (file.type && file.type !== mime)) fallo(`${file.name}: el contenido no corresponde a un PDF, JPG, PNG o WEBP válido.`);
  const extension = String(file.name || '').split('.').pop()?.toLowerCase();
  if (extension && !({ 'application/pdf': ['pdf'], 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'] }[mime]).includes(extension)) fallo(`${file.name}: la extensión no coincide con su contenido.`);
  return { mime, sha256: await huella(file) };
}
const imagenCanvas = async (file, signal) => {
  const img = await createImageBitmap(file);
  try {
    abortar(signal);
    if (img.width * img.height > 40_000_000) fallo(`${file.name}: la imagen supera 40 megapíxeles; reduce sus dimensiones.`);
    const k = Math.min(1, 2200 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); return cv;
  } finally { img.close(); }
};
export async function leerArchivoImportacion(file, c) {
  const { signal, progreso = () => {} } = c;
  const validado = await validarArchivoImportacion(file); abortar(signal);
  const paginas = []; let pdf, tarea, usoOcr = false, mezcla = false, longitud = 0;
  const cancelar = () => { void tarea?.destroy().catch(() => {}); };
  const ocr = async canvas => {
    abortar(signal); usoOcr = true;
    if (c.ocr) { const lineas = await c.ocr(canvas); abortar(signal); return lineas; }
    const worker = await lectorOcr(); abortar(signal); const { data } = await worker.recognize(canvas); abortar(signal); return lineasDeOcr(data);
  };
  try {
    if (validado.mime === 'application/pdf') {
      const lib = await c.pdfjs(); abortar(signal);
      const data = await file.arrayBuffer(); abortar(signal);
      tarea = lib.getDocument({ data, isEvalSupported: false, enableXfa: false });
      signal?.addEventListener('abort', cancelar, { once: true });
      pdf = await tarea.promise; abortar(signal);
      if (!Number.isInteger(pdf.numPages) || pdf.numPages < 1 || pdf.numPages > LIMITES_IMPORTACION.paginas) fallo(`${file.name}: el máximo es 50 páginas. Divide el PDF sin omitir páginas.`);
      const meta = await pdf.getMetadata().catch(() => null), contenido = leerMetadatos(meta?.info?.Subject || '');
      if (contenido) {
        if (contenido.tipo !== c.tipo) fallo(contenido.tipo === 'boleto_aereo' ? 'Este PDF contiene un boleto aéreo. Selecciona Boleto aéreo antes de importarlo.' : `Este PDF contiene un servicio de tipo «${contenido.tipo}»; selecciona ese tipo antes de importarlo.`);
        progreso(`Datos completos del PDF (${pdf.numPages} páginas)`);
        return { file, ...validado, paginas: pdf.numPages, datos: { ...contenido, fuentes: [{ nombre: file.name, sha256: validado.sha256, paginas: pdf.numPages, metodo: 'metadatos_lotus_v1' }] } };
      }
      for (let numero = 1; numero <= pdf.numPages; numero++) {
        abortar(signal); progreso(`Leyendo página ${numero} de ${pdf.numPages}`);
        const p = await pdf.getPage(numero);
        try {
          const items = (await p.getTextContent()).items;
          let lineas = lineasDeItems(items), texto = lineas.join('\n');
          const ops = await p.getOperatorList(), imagenes = ops.fnArray.some(x => [lib.OPS.paintImageXObject, lib.OPS.paintInlineImageXObject, lib.OPS.paintImageXObjectRepeat].includes(x));
          const propio = /Destino y Eventos Lotus\s*360/i.test(texto) && /BOLETO ELECTR[ÓO]NICO|SU ITINERARIO|PASAJEROS|ANTES DE VOLAR/i.test(texto);
          if (texto.trim().length < 60 || (imagenes && !propio)) {
            progreso(`Reconociendo página ${numero} de ${pdf.numPages}`);
            const vp = p.getViewport({ scale: 1 }), k = Math.min(3, 2200 / Math.max(vp.width, vp.height)), cv = document.createElement('canvas');
            const viewport = p.getViewport({ scale: k }); cv.width = Math.ceil(viewport.width); cv.height = Math.ceil(viewport.height);
            try {
              await p.render({ canvasContext: cv.getContext('2d'), viewport }).promise;
              const reconocidas = await ocr(cv);
              if (!reconocidas.join('').trim()) fallo(`${file.name}, página ${numero}: no se pudo reconocer la parte en imagen. Usa una copia más nítida.`);
              if (texto.trim().length >= 60) {
                mezcla = true;
                const vistas = new Set(lineas.map(l => l.replace(/\s+/g, ' ').trim().toUpperCase()));
                lineas = [...lineas, ...reconocidas.filter(l => !vistas.has(l.replace(/\s+/g, ' ').trim().toUpperCase()))];
              } else lineas = reconocidas;
              texto = lineas.join('\n');
            } finally { cv.width = cv.height = 0; }
          }
          if (!texto.trim()) fallo(`${file.name}, página ${numero}: no se pudo leer. Usa una imagen más nítida o completa la información manualmente.`);
          longitud += texto.length;
          if (longitud > LIMITES_IMPORTACION.texto) fallo(`${file.name}: contiene demasiado texto para una lectura. Divide el documento; no se ha truncado.`);
          paginas.push({ numero, lineas, texto });
        } finally { p.cleanup(); }
      }
    } else {
      progreso('Reconociendo la imagen completa'); const cv = await imagenCanvas(file, signal);
      try {
        const lineas = await ocr(cv), texto = lineas.join('\n');
        if (!texto.trim()) fallo(`${file.name}: no se pudo leer la imagen. Prueba con una foto más nítida.`);
        if (texto.length > LIMITES_IMPORTACION.texto) fallo(`${file.name}: contiene demasiado texto. No se ha truncado.`);
        paginas.push({ numero: 1, lineas, texto });
      } finally { cv.width = cv.height = 0; }
    }
    abortar(signal);
    // En páginas mixtas el texto OCR puede solaparse con columnas nativas: se revisan ambas fuentes sin ejecutar el parser posicional.
    let datos = c.tipo === 'boleto_aereo' && !mezcla ? (parsearPdfLotus(paginas) || parsearConsolidador(paginas)) : null;
    const determinista = !!datos;
    if (!datos) { progreso('Extrayendo datos del servicio'); datos = normalizarImportacion(await c.extraer({ paginas, tipo: c.tipo, nombre: file.name }), { tipo: c.tipo }); }
    abortar(signal);
    datos.fuentes = [...(datos.fuentes || []), { nombre: file.name, sha256: validado.sha256, paginas: paginas.length, metodo: determinista ? 'parser_texto' : usoOcr ? 'texto_ocr_ia' : 'texto_ia' }];
    return { file, ...validado, paginas: paginas.length, datos };
  } finally { signal?.removeEventListener('abort', cancelar); if (tarea) await tarea.destroy(); }
}
export async function leerArchivosImportacion(files, c) {
  if (!files.length || files.length > LIMITES_IMPORTACION.archivos) fallo('Selecciona entre 1 y 20 archivos por importación.');
  const resultados = [], vistos = new Set();
  for (const [i, file] of files.entries()) {
    c.progreso?.(`Archivo ${i + 1} de ${files.length}: ${file.name}`);
    const r = await leerArchivoImportacion(file, { ...c, progreso: texto => c.progreso?.(`Archivo ${i + 1}/${files.length} · ${texto}`) });
    if (vistos.has(r.sha256)) continue;
    vistos.add(r.sha256); resultados.push(r);
  }
  return { archivos: resultados, datos: combinarImportaciones(resultados.map(r => r.datos)) };
}
