// Subidas a R2 (privado). Solo jpg/png/webp/pdf, máximo 5 MB; el tipo se comprueba por los bytes, no por el nombre.
import { fallo } from './util.js';

export const MAX_BYTES = 5 * 1024 * 1024;

function tipoReal(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: 'image/png', ext: 'png' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: 'image/webp', ext: 'webp' };
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}

// Valida y guarda un File de un FormData. Devuelve { key, mime, tamano, nombre } o null si no vino archivo.
export async function guardarArchivo(env, archivo, carpeta, { soloImagen = false } = {}) {
  if (!archivo || typeof archivo === 'string' || !archivo.size) return null;
  if (archivo.size > MAX_BYTES) fallo(413, 'El archivo pesa más de 5 MB. Prueba con una foto más liviana.');
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = tipoReal(bytes);
  if (!tipo || (soloImagen && tipo.ext === 'pdf')) fallo(415, soloImagen ? 'Sube una imagen JPG, PNG o WEBP.' : 'Sube un archivo JPG, PNG, WEBP o PDF.');
  const key = `${carpeta}/${crypto.randomUUID()}.${tipo.ext}`;
  if (!env.FILES) fallo(500, 'Falta configurar el almacenamiento de archivos (R2).');
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: tipo.mime } });
  const nombre = String(archivo.name || `archivo.${tipo.ext}`).replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 120) || `archivo.${tipo.ext}`;
  return { key, mime: tipo.mime, tamano: archivo.size, nombre };
}

export async function leerFormulario(request) {
  const tipo = request.headers.get('content-type') || '';
  if (!tipo.includes('multipart/form-data')) fallo(415, 'Formato no soportado.');
  const largo = Number(request.headers.get('content-length') || 0);
  if (largo > MAX_BYTES + 300_000) fallo(413, 'El archivo pesa más de 5 MB.');
  try { return await request.formData(); } catch { fallo(400, 'No pudimos leer el formulario.'); }
}

// Sirve un archivo de R2 tras validar permisos (lo decide quien llama).
export async function servirArchivo(env, key, { descargar = false } = {}) {
  const obj = await env.FILES?.get(key);
  if (!obj) fallo(404, 'Archivo no encontrado.');
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('cache-control', 'private, no-store');
  h.set('x-content-type-options', 'nosniff');
  h.set('content-security-policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  h.set('content-disposition', `${descargar ? 'attachment' : 'inline'}; filename="${key.split('/').pop()}"`);
  return new Response(obj.body, { headers: h });
}
