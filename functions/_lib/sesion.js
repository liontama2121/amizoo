// Sesiones en D1: token aleatorio en cookie HttpOnly; en la base solo se guarda su HMAC.
import { aleatorio, hmac } from './cripto.js';
import { fallo } from './util.js';

const COOKIE = 'amizoo_s';
export const DURACION = { admin: 12 * 3600_000, cliente: 7 * 24 * 3600_000 };

function secreto(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) fallo(500, 'Falta configurar SESSION_SECRET.');
  return env.SESSION_SECRET;
}

const leerCookie = (request) => {
  const c = request.headers.get('cookie') || '';
  const m = c.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]{20,})`));
  return m ? m[1] : null;
};

const cookie = (valor, maxAge) => `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
export const cookieCerrar = () => cookie('', 0);

export async function crearSesion(env, usuario) {
  const token = aleatorio(32);
  const dur = DURACION[usuario.rol] || DURACION.cliente;
  const ahora = Date.now();
  await env.DB.prepare('INSERT INTO sesiones (token_hash, usuario_id, expira, creado_en) VALUES (?, ?, ?, ?)')
    .bind(await hmac(secreto(env), token), usuario.id, ahora + dur, ahora).run();
  // Limpieza ocasional de sesiones vencidas
  if (Math.random() < 0.05) await env.DB.prepare('DELETE FROM sesiones WHERE expira < ?').bind(ahora).run();
  return cookie(token, Math.floor(dur / 1000));
}

export async function sesionDe(env, request) {
  const token = leerCookie(request);
  if (!token) return null;
  const th = await hmac(secreto(env), token);
  const fila = await env.DB.prepare(
    `SELECT s.token_hash, u.id, u.nombre, u.correo, u.telefono, u.rol
       FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = ? AND s.expira > ? AND u.activo = 1`
  ).bind(th, Date.now()).first();
  return fila || null;
}

export async function cerrarSesion(env, request) {
  const token = leerCookie(request);
  if (token) await env.DB.prepare('DELETE FROM sesiones WHERE token_hash = ?').bind(await hmac(secreto(env), token)).run();
}

export async function cerrarOtrasSesiones(env, usuarioId, tokenHashActual = '') {
  await env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ? AND token_hash != ?').bind(usuarioId, tokenHashActual).run();
}

export const tokenHash = (env, token) => hmac(secreto(env), token);
