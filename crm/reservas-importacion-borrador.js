const copia = v => JSON.parse(JSON.stringify(v));
export function serviciosDeImportacion(lote, siguienteId) {
  if (lote.servicios.some(s => s.pasajeros.length > 30)) throw new Error('El asistente admite hasta 30 viajeros. Divide la reserva antes de incorporar.');
  return lote.servicios.map(s => ({ ...copia(s.datos), id: siguienteId(), origen: 'documento', anulado_en: null,
    estado: 'solicitado', precio_centavos: Math.round(Number(s.datos.precio || 0) * 100), apto: '',
    _importacion: { servicio: copia(s), archivos: lote.archivos.filter(a => a.grupo === s.clave), operacion: crypto.randomUUID(), subidas: new Map(), payload: null, listo: false },
  }));
}
export function viajerosDeImportacion(servicios) {
  const vistos = new Map();
  for (const s of servicios) for (const p of s._importacion?.servicio.pasajeros || []) {
    const k = `${p.tipo_documento || ''}:${p.numero_documento || ''}:${p.nombre}:${p.apellido}`.toUpperCase();
    if (!vistos.has(k)) vistos.set(k, { ...p, identidades: [] });
    vistos.get(k).identidades.push(`${s._importacion.operacion}:${p.clave}`);
  }
  return [...vistos.values()];
}
export function sincronizarViajerosImportados(servicios, viajeros, convertir) {
  for (const s of servicios) if (s._importacion) {
    s._importacion.servicio.pasajeros = s._importacion.servicio.pasajeros.map(p => {
      const identidad = `${s._importacion.operacion}:${p.clave}`;
      const v = viajeros.find(v => v.identidades?.includes(identidad));
      if (!v) throw new Error('Falta un viajero de los documentos. Restablece su cantidad y revisa el paso Viaje antes de crear.');
      const d = convertir(v, p);
      return { ...p, nombre: d.nombre, apellido: d.apellido, tipo_documento: d.tipo_documento || null, numero_documento: d.numero_documento || null };
    });
  }
}
export async function finalizarImportaciones({ sb, reservaId, servicios, leerDatos }) {
  if (!servicios.some(s => s._importacion && !s._importacion.listo)) return;
  const { data, error } = await sb.rpc('reserva_detalle', { p_reserva_id: reservaId });
  if (error || !data?.ok) throw new Error('No se pudo consultar la reserva creada. Reintenta los adjuntos.');
  const creados = (data.servicios || []).filter(s => !s.anulado_en).sort((a, b) => a.id - b.id);
  if (creados.length !== servicios.length || creados.some((s, i) => s.tipo !== servicios[i].tipo)) throw new Error('Los servicios cambiaron. Revisa la reserva creada antes de adjuntar.');
  for (const [i, s] of servicios.entries()) {
    const imp = s._importacion;
    if (!imp || imp.listo) continue;
    if (!imp.payload) {
      const documentos = [];
      for (const a of imp.archivos) {
        let path = imp.subidas.get(a.sha256);
        const tipo = s.tipo === 'boleto_aereo' ? 'boleto' : 'otro';
        if (!path) {
          const { data: firma, error: e } = await sb.functions.invoke('reservas-documentos', { body: { accion: 'subir', reserva_id: reservaId, servicio_id: creados[i].id, tipo, nombre: a.file.name, mime: a.mime, tamano: a.file.size } });
          if (e || !firma?.ok) throw new Error('No se pudo autorizar el adjunto privado. Reintenta.');
          const { error: eSubida } = await sb.storage.from('reservas-documentos').uploadToSignedUrl(firma.path, firma.token, a.file, { contentType: a.mime });
          if (eSubida) throw new Error('No se pudo subir el adjunto privado. Reintenta.');
          path = firma.path; imp.subidas.set(a.sha256, path);
        }
        documentos.push({ path, tipo, nombre: a.file.name, mime: a.mime, tamano: a.file.size, sha256: a.sha256, servicio_clave: imp.servicio.clave });
      }
      const servicio = copia(imp.servicio);
      servicio.datos = leerDatos(s);
      // Los viajeros del paso 1 ya se guardaron: relacionarlos por documento o nombre exacto, nunca por posición.
      const actual = await sb.rpc('reserva_detalle', { p_reserva_id: reservaId });
      if (actual.error || !actual.data?.ok) throw new Error('No se pudo comprobar los viajeros de la reserva. Reintenta.');
      servicio.pasajeros = servicio.pasajeros.map(p => {
        const coincidencias = (actual.data.pasajeros || []).filter(q => (p.numero_documento && q.tipo_documento === p.tipo_documento && q.numero_documento === p.numero_documento) || (q.nombre === p.nombre && (q.apellido || '') === (p.apellido || '')));
        if (coincidencias.length > 1) throw new Error('Hay viajeros ambiguos. Revísalos en la reserva antes de reintentar.');
        return { ...p, ...(coincidencias.length ? { pasajero_id: coincidencias[0].id } : {}) };
      });
      const version = (actual.data.servicios || []).find(x => x.id === creados[i].id)?.updated_at;
      if (!version) throw new Error('No se pudo comprobar la versión del servicio. Reintenta.');
      imp.payload = { operacion_id: imp.operacion, reserva_id: reservaId, servicio_id: creados[i].id, version_servicio: version, servicios: [servicio], documentos };
    }
    const { data: guardado, error: fallo } = await sb.rpc('reserva_importacion_guardar', { p_datos: imp.payload });
    if (fallo || !guardado?.ok) throw new Error(`No se pudo confirmar la importación${guardado?.error ? ': ' + guardado.error : ''}. Reintenta: no se repetirá la reserva ni el pago.`);
    imp.listo = true;
  }
}
