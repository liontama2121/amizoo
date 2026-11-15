// Enrutador único de /api/*. Cada ruta declara el rol que necesita:
//   (sin rol) pública · 'sesion' cualquier usuario con sesión · admin por defecto en rutasAdmin.
import { json, ErrorHttp } from '../_lib/util.js';
import { sesionDe } from '../_lib/sesion.js';
import { rutasAuth } from '../_lib/rutas-auth.js';
import { rutasPublicas, rutasCliente } from '../_lib/rutas-cliente.js';
import { rutasAdmin } from '../_lib/rutas-admin.js';

const compilar = ([metodo, patron, manejar, rol], rolPorDefecto) => {
  const nombres = [];
  const re = new RegExp('^' + patron.replace(/\//g, '\\/').replace(/:(\w+)/g, (_, n) => { nombres.push(n); return '([^/]+)'; })
    .replace(/\*$/, () => { nombres.push('*'); return '(.+)'; }) + '$');
  return { metodo, re, nombres, manejar, rol: rol ?? rolPorDefecto };
};
const RUTAS = [
  ...rutasAuth.map((r) => compilar(r, null)),
  ...rutasPublicas.map((r) => compilar(r, null)),
  ...rutasCliente.map((r) => compilar(r, 'sesion')),
  ...rutasAdmin.map((r) => compilar(r, 'admin')),
];

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  try {
    let metodoValido = false;
    for (const r of RUTAS) {
      const m = url.pathname.match(r.re);
      if (!m) continue;
      metodoValido = true;
      if (r.metodo !== request.method) continue;
      const p = Object.fromEntries(r.nombres.map((n, i) => [n, m[i + 1]]));
      const sesion = await sesionDe(env, request);
      if (r.rol === 'sesion' && !sesion) return json({ error: 'Tu sesión terminó. Vuelve a entrar.', sesion: false }, 401);
      if (r.rol === 'admin' && sesion?.rol !== 'admin') return json({ error: 'No tienes permiso para esto.', sesion: !!sesion }, sesion ? 403 : 401);
      const sitio = env.SITIO || url.origin;
      return await r.manejar({ request, env, ctx, url, p, sesion, sitio });
    }
    return json({ error: metodoValido ? 'Método no permitido.' : 'No encontrado.' }, metodoValido ? 405 : 404);
  } catch (e) {
    if (e instanceof ErrorHttp) return json({ error: e.message, ...e.extra }, e.status);
    console.error(e);
    return json({ error: 'Tuvimos un problema. Intenta de nuevo en un momento.' }, 500);
  }
}
