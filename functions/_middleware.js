// Corre antes de todo: valida Origin en peticiones que cambian datos, protege /panel y /mi-cuenta
// y agrega cabeceras de seguridad.
import { sesionDe } from './_lib/sesion.js';

const SEGURIDAD = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
};

const PRIVADAS = { '/panel': 'admin', '/mi-cuenta': 'cliente' };

export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const url = new URL(request.url);

  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origen = request.headers.get('origin');
    if (!origen || origen !== url.origin) {
      return new Response(JSON.stringify({ error: 'Origen no permitido.' }), { status: 403, headers: { 'content-type': 'application/json' } });
    }
  }

  const ruta = url.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  const rolPagina = PRIVADAS[ruta];
  if (rolPagina) {
    let sesion = null;
    try { sesion = await sesionDe(env, request); } catch { sesion = null; }
    if (!sesion) return Response.redirect(`${url.origin}/entrar?volver=${encodeURIComponent(ruta)}`, 302);
    // El admin que abre "Mi cuenta" va a su panel; el cliente que abre /panel va a su cuenta.
    if (sesion.rol !== rolPagina) return Response.redirect(`${url.origin}${sesion.rol === 'admin' ? '/panel' : '/mi-cuenta'}`, 302);
  }

  const res = await next();
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(SEGURIDAD)) r.headers.set(k, v);
  if (rolPagina) r.headers.set('cache-control', 'no-store');
  return r;
}
