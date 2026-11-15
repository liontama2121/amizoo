// Respuestas, errores y validación/saneamiento de entradas (todo se valida en el servidor).

export class ErrorHttp extends Error {
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    this.extra = extra;
  }
}
export const fallo = (status, mensaje, extra) => { throw new ErrorHttp(status, mensaje, extra); };

export const json = (datos, status = 200, headers = {}) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export async function leerJson(request) {
  const tipo = request.headers.get('content-type') || '';
  if (!tipo.includes('application/json')) fallo(415, 'Formato no soportado.');
  const t = await request.text();
  if (t.length > 200_000) fallo(413, 'La solicitud es muy grande.');
  try { return t ? JSON.parse(t) : {}; } catch { fallo(400, 'Datos inválidos.'); }
}

// Quita caracteres de control y espacios sobrantes.
const limpiar = (v) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

export function texto(v, { campo = 'Este campo', max = 200, min = 0, requerido = false, multilinea = false } = {}) {
  let s = limpiar(v);
  if (!multilinea) s = s.replace(/\s+/g, ' ');
  if (!s) { if (requerido) fallo(400, `${campo} es obligatorio.`); return null; }
  if (s.length < min) fallo(400, `${campo} es muy corto.`);
  if (s.length > max) fallo(400, `${campo} es muy largo (máximo ${max} caracteres).`);
  return s;
}

export function correo(v, { requerido = true } = {}) {
  const s = limpiar(v).toLowerCase();
  if (!s) { if (requerido) fallo(400, 'El correo es obligatorio.'); return null; }
  if (s.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) fallo(400, 'Revisa el correo: no parece válido.');
  return s;
}

export function telefono(v, { requerido = true } = {}) {
  const s = limpiar(v).replace(/[^\d+]/g, '');
  if (!s) { if (requerido) fallo(400, 'El teléfono es obligatorio.'); return null; }
  const digitos = s.replace(/\D/g, '');
  if (digitos.length < 7 || digitos.length > 15) fallo(400, 'Revisa el teléfono: escribe solo números, por ejemplo 3001234567.');
  return s;
}

export function clave(v) {
  const s = String(v ?? '');
  if (s.length < 8) fallo(400, 'La contraseña debe tener al menos 8 caracteres.');
  if (s.length > 128) fallo(400, 'La contraseña es muy larga.');
  return s;
}

export function entero(v, { campo = 'El número', min = 0, max = 1e9, requerido = false } = {}) {
  if (v === null || v === undefined || v === '') { if (requerido) fallo(400, `${campo} es obligatorio.`); return null; }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fallo(400, `${campo} no es válido.`);
  return n;
}

export function fecha(v, { campo = 'La fecha', requerido = true } = {}) {
  const s = limpiar(v);
  if (!s) { if (requerido) fallo(400, `${campo} es obligatoria.`); return null; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s + 'T00:00:00Z'))) fallo(400, `${campo} no es válida.`);
  return s;
}

export function hora(v) {
  const s = limpiar(v);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) fallo(400, 'La hora no es válida.');
  return s;
}

export function opcion(v, lista, campo = 'La opción') {
  if (!lista.includes(v)) fallo(400, `${campo} no es válida.`);
  return v;
}

export const ESPECIES = ['perros', 'gatos', 'aves', 'roedores', 'bovinos', 'ovinos', 'caprinos', 'porcinos'];
export const ESPECIES_PRODUCCION = ['bovinos', 'ovinos', 'caprinos', 'porcinos', 'aves'];

export const ahora = () => Date.now();

export function codigoCita() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(6));
  return 'AZ-' + [...b].map((x) => abc[x % abc.length]).join('');
}

export async function registrar(env, usuarioId, accion, detalle) {
  await env.DB.prepare('INSERT INTO actividad (usuario_id, accion, detalle) VALUES (?, ?, ?)').bind(usuarioId, accion, detalle ?? null).run();
}
