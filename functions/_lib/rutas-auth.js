// Registro, inicio de sesión, recuperación y cambio de contraseña.
import { json, leerJson, texto, correo, telefono, clave, fallo, registrar } from './util.js';
import { hashClave, verificarClave, aleatorio } from './cripto.js';
import { crearSesion, cerrarSesion, cookieCerrar, cerrarOtrasSesiones, tokenHash } from './sesion.js';
import { enviarCorreo, plantilla, esc } from './correo.js';

const MAX_FALLOS = 5;
const BLOQUEO_MS = 15 * 60_000;
const RESET_MS = 30 * 60_000;

export const publico = (u) => u && { id: u.id, nombre: u.nombre, correo: u.correo, telefono: u.telefono, rol: u.rol };

// Crea un cliente con contraseña. Si el correo ya agendó como invitado (sin contraseña), le enviamos un enlace
// para activar la cuenta en vez de entregarla a quien escribió el correo.
export async function crearCliente(env, sitio, { nombre, correo: c, telefono: t, clave: k, aceptaDatos }) {
  const existe = await env.DB.prepare('SELECT * FROM usuarios WHERE correo = ?').bind(c).first();
  if (existe?.hash) fallo(409, 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.');
  if (existe) {
    await enviarEnlaceClave(env, sitio, existe, 'activar');
    fallo(409, 'Ese correo ya tiene citas con nosotros. Te enviamos un enlace al correo para crear tu contraseña.', { enlaceEnviado: true });
  }
  const h = await hashClave(k);
  const r = await env.DB.prepare(
    `INSERT INTO usuarios (correo, nombre, telefono, rol, hash, sal, iteraciones, acepta_datos_en) VALUES (?, ?, ?, 'cliente', ?, ?, ?, ?)`
  ).bind(c, nombre, t, h.hash, h.sal, h.iteraciones, aceptaDatos ? Date.now() : null).run();
  return { id: r.meta.last_row_id, nombre, correo: c, telefono: t, rol: 'cliente' };
}

export async function enviarEnlaceClave(env, sitio, usuario, modo = 'recuperar') {
  const token = aleatorio(32);
  await env.DB.prepare('INSERT INTO tokens_clave (token_hash, usuario_id, expira) VALUES (?, ?, ?)')
    .bind(await tokenHash(env, token), usuario.id, Date.now() + RESET_MS).run();
  const url = `${sitio}/restablecer#token=${token}`;
  const activar = modo === 'activar';
  await enviarCorreo(env, {
    para: usuario.correo,
    asunto: activar ? 'Crea tu contraseña de AmiZoo' : 'Recupera tu contraseña de AmiZoo',
    html: plantilla(activar ? 'Crea tu contraseña' : 'Recupera tu contraseña',
      `<p>Hola, ${esc(usuario.nombre)}.</p><p>${activar ? 'Para ver tus citas y tus animales en AmiZoo, crea tu contraseña con este botón.' : 'Recibimos una solicitud para cambiar tu contraseña.'} El enlace sirve una sola vez durante 30 minutos.</p><p>Si no fuiste tú, ignora este correo.</p>`,
      { boton: { url, texto: activar ? 'Crear mi contraseña' : 'Cambiar mi contraseña' } }),
  });
  if (!env.RESEND_API_KEY) console.log(`[desarrollo] Enlace de contraseña: ${url}`);
}

export const rutasAuth = [
  ['POST', '/api/auth/registro', async ({ env, request, sitio }) => {
    const b = await leerJson(request);
    if (b.aceptaDatos !== true) fallo(400, 'Debes autorizar el tratamiento de datos personales para crear la cuenta.');
    const u = await crearCliente(env, sitio, {
      nombre: texto(b.nombre, { campo: 'El nombre', requerido: true, min: 2, max: 100 }),
      correo: correo(b.correo), telefono: telefono(b.telefono), clave: clave(b.clave), aceptaDatos: true,
    });
    return json({ usuario: publico(u) }, 201, { 'set-cookie': await crearSesion(env, u) });
  }],

  ['POST', '/api/auth/entrar', async ({ env, request }) => {
    const b = await leerJson(request);
    const c = correo(b.correo);
    const k = String(b.clave ?? '').slice(0, 128);
    const ahora = Date.now();
    const intento = await env.DB.prepare('SELECT * FROM intentos_login WHERE correo = ?').bind(c).first();
    if (intento?.bloqueado_hasta > ahora) {
      const min = Math.ceil((intento.bloqueado_hasta - ahora) / 60_000);
      fallo(429, `Por seguridad bloqueamos el acceso por ${min} minuto${min === 1 ? '' : 's'}. Intenta más tarde o recupera tu contraseña.`);
    }
    const u = await env.DB.prepare('SELECT * FROM usuarios WHERE correo = ? AND activo = 1').bind(c).first();
    const ok = await verificarClave(k, u);
    if (!ok) {
      const fallos = (intento && (!intento.bloqueado_hasta || intento.bloqueado_hasta <= ahora) ? intento.fallos : 0) + 1;
      const bloqueo = fallos >= MAX_FALLOS ? ahora + BLOQUEO_MS : null;
      await env.DB.prepare(
        `INSERT INTO intentos_login (correo, fallos, bloqueado_hasta, actualizado) VALUES (?, ?, ?, ?)
         ON CONFLICT(correo) DO UPDATE SET fallos = excluded.fallos, bloqueado_hasta = excluded.bloqueado_hasta, actualizado = excluded.actualizado`
      ).bind(c, bloqueo ? 0 : fallos, bloqueo, ahora).run();
      if (bloqueo) fallo(429, 'Por seguridad bloqueamos el acceso por 15 minutos. Intenta más tarde o recupera tu contraseña.');
      fallo(401, u && !u.hash
        ? 'Ese correo todavía no tiene contraseña. Toca "¿Olvidaste tu contraseña?" para crearla.'
        : `Correo o contraseña incorrectos. Te quedan ${MAX_FALLOS - fallos} intento${MAX_FALLOS - fallos === 1 ? '' : 's'}.`);
    }
    await env.DB.prepare('DELETE FROM intentos_login WHERE correo = ?').bind(c).run();
    if (u.rol === 'admin') await registrar(env, u.id, 'inicio_sesion', null);
    return json({ usuario: publico(u) }, 200, { 'set-cookie': await crearSesion(env, u) });
  }],

  ['POST', '/api/auth/salir', async ({ env, request }) => {
    await cerrarSesion(env, request);
    return json({ ok: true }, 200, { 'set-cookie': cookieCerrar() });
  }],

  ['GET', '/api/auth/yo', async ({ sesion }) => json({ usuario: publico(sesion) })],

  ['POST', '/api/auth/olvide', async ({ env, request, sitio }) => {
    const b = await leerJson(request);
    const c = correo(b.correo);
    const u = await env.DB.prepare('SELECT * FROM usuarios WHERE correo = ? AND activo = 1').bind(c).first();
    if (u) {
      const recientes = await env.DB.prepare('SELECT COUNT(*) n FROM tokens_clave WHERE usuario_id = ? AND expira > ?').bind(u.id, Date.now() + RESET_MS - 15 * 60_000).first();
      if (recientes.n < 3) await enviarEnlaceClave(env, sitio, u, u.hash ? 'recuperar' : 'activar');
    }
    // Misma respuesta exista o no el correo.
    return json({ ok: true, mensaje: 'Si el correo está registrado, te llegará un enlace en unos minutos. Revisa también la carpeta de spam.' });
  }],

  ['POST', '/api/auth/restablecer', async ({ env, request }) => {
    const b = await leerJson(request);
    const token = String(b.token || '');
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) fallo(400, 'El enlace no es válido. Pide uno nuevo.');
    const k = clave(b.clave);
    const th = await tokenHash(env, token);
    const t = await env.DB.prepare('SELECT * FROM tokens_clave WHERE token_hash = ?').bind(th).first();
    if (!t || t.usado || t.expira < Date.now()) fallo(400, 'El enlace venció o ya se usó. Pide uno nuevo.');
    const h = await hashClave(k);
    await env.DB.batch([
      env.DB.prepare('UPDATE tokens_clave SET usado = 1 WHERE token_hash = ?').bind(th),
      env.DB.prepare('UPDATE usuarios SET hash = ?, sal = ?, iteraciones = ? WHERE id = ?').bind(h.hash, h.sal, h.iteraciones, t.usuario_id),
      env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(t.usuario_id),
    ]);
    const u = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(t.usuario_id).first();
    await env.DB.prepare('DELETE FROM intentos_login WHERE correo = ?').bind(u.correo).run();
    return json({ usuario: publico(u) }, 200, { 'set-cookie': await crearSesion(env, u) });
  }],

  ['POST', '/api/auth/clave', async ({ env, request, sesion }) => {
    const b = await leerJson(request);
    const u = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(sesion.id).first();
    if (!(await verificarClave(String(b.actual ?? ''), u))) fallo(400, 'La contraseña actual no es correcta.');
    const h = await hashClave(clave(b.nueva));
    await env.DB.prepare('UPDATE usuarios SET hash = ?, sal = ?, iteraciones = ? WHERE id = ?').bind(h.hash, h.sal, h.iteraciones, u.id).run();
    await cerrarOtrasSesiones(env, u.id, sesion.token_hash);
    if (u.rol === 'admin') await registrar(env, u.id, 'cambio_clave', null);
    return json({ ok: true });
  }, 'sesion'],
];
