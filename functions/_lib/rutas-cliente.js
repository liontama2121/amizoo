// Rutas públicas (servicios, disponibilidad, solicitar cita) y del portal del cliente ("Mi cuenta").
import { json, leerJson, texto, correo, telefono, clave, fecha, hora, fallo, entero } from './util.js';
import { leerConfig, servicioDesdeFila, servicioPorId, diasDisponibles, horariosDisponibles, bloqueCita } from './agenda.js';
import { guardarArchivo, leerFormulario, servirArchivo } from './archivos.js';
import { crearSesion } from './sesion.js';
import { crearCliente, publico } from './rutas-auth.js';
import { SELECT_CITA, citaPorId, validarAnimal, insertarAnimal, validarLugar, insertarCita, avisarNuevaCita } from './citas.js';
import { enviarCorreo, plantilla, tablaCita, esc } from './correo.js';

const HORA_MS = 3600_000;

async function animalPropio(env, usuarioId, id) {
  const a = await env.DB.prepare('SELECT * FROM animales WHERE id = ? AND usuario_id = ? AND activo = 1').bind(entero(id), usuarioId).first();
  if (!a) fallo(404, 'No encontramos ese animal en tu cuenta.');
  return a;
}
async function citaPropia(env, usuarioId, id) {
  const c = await citaPorId(env, entero(id));
  if (c.usuario_id !== usuarioId) fallo(404, 'No encontramos esa cita en tu cuenta.');
  return c;
}

export const rutasPublicas = [
  ['GET', '/api/servicios', async ({ env }) => {
    const r = await env.DB.prepare('SELECT * FROM servicios WHERE visible = 1 ORDER BY orden').all();
    return json({ servicios: r.results.map(servicioDesdeFila) }, 200, { 'cache-control': 'public, max-age=60' });
  }],

  ['GET', '/api/config-publica', async ({ env }) => {
    const [agenda, pago, zonas, planes] = await Promise.all(['agenda', 'pago', 'zonas', 'planes'].map((k) => leerConfig(env, k)));
    return json({ anticipo: agenda.anticipo, horario: { dias: agenda.dias, inicio: agenda.inicio, fin: agenda.fin }, pago, zonas: zonas.zonas, planes });
  }],

  ['GET', '/api/disponibilidad', async ({ env, url, sesion }) => {
    const servicio = await servicioPorId(env, url.searchParams.get('servicio'));
    // Para reprogramar se excluye la propia cita (solo si es del cliente o eres admin).
    let excluirId = 0;
    if (url.searchParams.get('excluir') && sesion) {
      const c = await citaPorId(env, entero(url.searchParams.get('excluir')));
      if (sesion.rol === 'admin' || c.usuario_id === sesion.id) excluirId = c.id;
    }
    if (url.searchParams.get('fecha')) {
      return json({ horarios: await horariosDisponibles(env, servicio, fecha(url.searchParams.get('fecha')), { excluirId }) });
    }
    const mes = String(url.searchParams.get('mes') || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) fallo(400, 'Mes no válido.');
    return json({ dias: await diasDisponibles(env, servicio, mes, { excluirId }) });
  }],

  // Solicitar cita (con o sin cuenta). Llega como multipart: "datos" (JSON) + "comprobante" (opcional).
  ['POST', '/api/citas', async ({ env, request, sesion, sitio, ctx }) => {
    const form = await leerFormulario(request);
    let b;
    try { b = JSON.parse(String(form.get('datos') || '{}')); } catch { fallo(400, 'Datos inválidos.'); }
    if (b.aceptaDatos !== true) fallo(400, 'Debes autorizar el tratamiento de datos personales.');
    if (b.aceptaPolitica !== true) fallo(400, 'Debes aceptar la política de cancelación.');
    const servicio = await servicioPorId(env, b.servicio);
    const lugar = await validarLugar(env, servicio, b.lugar || {});
    const f = fecha(b.fecha), h = hora(b.hora);
    const motivo = texto(b.motivo, { campo: 'El motivo', requerido: true, max: 600, multilinea: true });

    // Quién agenda
    let usuario = sesion && sesion.rol === 'cliente' ? sesion : null;
    let cookie = null;
    if (!usuario) {
      const k = b.contacto || {};
      const datos = { nombre: texto(k.nombre, { campo: 'Tu nombre', requerido: true, min: 2, max: 100 }), correo: correo(k.correo), telefono: telefono(k.telefono) };
      if (b.cuenta?.modo === 'crear') {
        usuario = await crearCliente(env, sitio, { ...datos, clave: clave(b.cuenta.clave), aceptaDatos: true });
        cookie = await crearSesion(env, usuario);
      } else {
        const existe = await env.DB.prepare('SELECT * FROM usuarios WHERE correo = ?').bind(datos.correo).first();
        if (existe?.hash) fallo(409, 'Ese correo ya tiene cuenta. Inicia sesión para agendar y ver la cita en Mi cuenta.', { iniciarSesion: true });
        if (existe) {
          usuario = existe;
          await env.DB.prepare('UPDATE usuarios SET nombre = ?, telefono = ? WHERE id = ?').bind(datos.nombre, datos.telefono, existe.id).run();
        } else {
          const r = await env.DB.prepare(`INSERT INTO usuarios (correo, nombre, telefono, rol, acepta_datos_en) VALUES (?, ?, ?, 'cliente', ?)`)
            .bind(datos.correo, datos.nombre, datos.telefono, Date.now()).run();
          usuario = { id: r.meta.last_row_id, ...datos };
        }
      }
    }

    // Para quién
    const animal = b.animal?.id ? await animalPropio(env, usuario.id, b.animal.id) : validarAnimal(b.animal || {});
    // Antes de guardar nada más, revisamos el horario y la especie.
    if (!servicio.especies.includes(animal.especie)) fallo(400, `${servicio.nombre} no está disponible para ${animal.especie}.`);
    if (!(await horariosDisponibles(env, servicio, f)).includes(h)) fallo(409, 'Ese horario ya no está disponible. Elige otro, por favor.', { horarioOcupado: true });
    const animalFinal = animal.id ? animal : await insertarAnimal(env, usuario.id, animal);

    if (b.lugar?.guardar && lugar.direccion) {
      await env.DB.prepare('INSERT INTO direcciones (usuario_id, etiqueta, zona, barrio, direccion) VALUES (?, ?, ?, ?, ?)')
        .bind(usuario.id, texto(b.lugar.etiqueta, { max: 40 }) || 'Casa', lugar.zona, lugar.barrio, lugar.direccion).run();
    }

    const id = await insertarCita(env, { usuarioId: usuario.id, animal: animalFinal, servicio, lugar, fecha: f, hora: h, motivo, revisarHorario: false });
    const archivo = await guardarArchivo(env, form.get('comprobante'), `u/${usuario.id}/comprobantes`).catch(async (e) => {
      // La cita queda creada aunque el comprobante falle; se puede subir luego desde Mi cuenta.
      console.error('comprobante', e.message);
      return null;
    });
    if (archivo) await env.DB.prepare(`UPDATE citas SET comprobante_key = ?, anticipo_estado = 'por_revisar' WHERE id = ?`).bind(archivo.key, id).run();
    const c = await citaPorId(env, id);
    avisarNuevaCita(env, ctx, sitio, c);
    return json({
      cita: { id: c.id, codigo: c.codigo, inicio: c.inicio, servicio: c.servicio_nombre, anticipoEstado: c.anticipo_estado },
      cuenta: usuario.hash || cookie || usuario === sesion ? 'con_cuenta' : 'invitado',
      comprobanteFallo: !!form.get('comprobante')?.size && !archivo,
    }, 201, cookie ? { 'set-cookie': cookie } : {});
  }],
];

export const rutasCliente = [
  ['GET', '/api/mi/resumen', async ({ env, sesion }) => {
    const [animales, citas, direcciones, pago, agenda] = await Promise.all([
      env.DB.prepare('SELECT * FROM animales WHERE usuario_id = ? AND activo = 1 ORDER BY nombre').bind(sesion.id).all(),
      env.DB.prepare(`${SELECT_CITA} WHERE c.usuario_id = ? ORDER BY c.inicio DESC LIMIT 200`).bind(sesion.id).all(),
      env.DB.prepare('SELECT * FROM direcciones WHERE usuario_id = ? ORDER BY id').bind(sesion.id).all(),
      leerConfig(env, 'pago'), leerConfig(env, 'agenda'),
    ]);
    return json({ usuario: publico(sesion), animales: animales.results, citas: citas.results, direcciones: direcciones.results, pago, anticipo: agenda.anticipo });
  }, 'sesion'],

  ['PATCH', '/api/mi/datos', async ({ env, request, sesion }) => {
    const b = await leerJson(request);
    const nombre = texto(b.nombre, { campo: 'El nombre', requerido: true, min: 2, max: 100 });
    const tel = telefono(b.telefono);
    await env.DB.prepare('UPDATE usuarios SET nombre = ?, telefono = ? WHERE id = ?').bind(nombre, tel, sesion.id).run();
    return json({ ok: true });
  }, 'sesion'],

  ['POST', '/api/mi/direcciones', async ({ env, request, sesion }) => {
    const b = await leerJson(request);
    const lugar = await validarLugar(env, { modalidad: 'domicilio' }, b);
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM direcciones WHERE usuario_id = ?').bind(sesion.id).first();
    if (n.n >= 10) fallo(400, 'Puedes guardar hasta 10 direcciones.');
    await env.DB.prepare('INSERT INTO direcciones (usuario_id, etiqueta, zona, barrio, direccion) VALUES (?, ?, ?, ?, ?)')
      .bind(sesion.id, texto(b.etiqueta, { max: 40 }) || 'Casa', lugar.zona, lugar.barrio, lugar.direccion).run();
    return json({ ok: true }, 201);
  }, 'sesion'],

  ['DELETE', '/api/mi/direcciones/:id', async ({ env, sesion, p }) => {
    await env.DB.prepare('DELETE FROM direcciones WHERE id = ? AND usuario_id = ?').bind(entero(p.id), sesion.id).run();
    return json({ ok: true });
  }, 'sesion'],

  ['POST', '/api/mi/animales', async ({ env, request, sesion }) => {
    const a = await insertarAnimal(env, sesion.id, validarAnimal(await leerJson(request)));
    return json({ animal: a }, 201);
  }, 'sesion'],

  ['PATCH', '/api/mi/animales/:id', async ({ env, request, sesion, p }) => {
    const actual = await animalPropio(env, sesion.id, p.id);
    const a = validarAnimal(await leerJson(request));
    await env.DB.prepare(`UPDATE animales SET tipo = ?, nombre = ?, especie = ?, raza = ?, edad = ?, peso = ?, temperamento = ?, num_animales = ?, tipo_produccion = ? WHERE id = ?`)
      .bind(a.tipo, a.nombre, a.especie, a.raza, a.edad, a.peso, a.temperamento, a.num_animales, a.tipo_produccion, actual.id).run();
    return json({ ok: true });
  }, 'sesion'],

  ['POST', '/api/mi/animales/:id/foto', async ({ env, request, sesion, p }) => {
    const a = await animalPropio(env, sesion.id, p.id);
    const form = await leerFormulario(request);
    const archivo = await guardarArchivo(env, form.get('foto'), `u/${sesion.id}/animales`, { soloImagen: true });
    if (!archivo) fallo(400, 'Elige una foto.');
    await env.DB.prepare('UPDATE animales SET foto_key = ? WHERE id = ?').bind(archivo.key, a.id).run();
    if (a.foto_key) await env.FILES.delete(a.foto_key);
    return json({ ok: true });
  }, 'sesion'],

  ['GET', '/api/mi/animales/:id/historia', async ({ env, sesion, p }) => {
    const a = await animalPropio(env, sesion.id, p.id);
    const [historia, documentos] = await Promise.all([
      env.DB.prepare('SELECT id, tipo, fecha, titulo, detalle, proxima FROM historia WHERE animal_id = ? ORDER BY fecha DESC, id DESC').bind(a.id).all(),
      env.DB.prepare('SELECT id, nombre, archivo_key, tipo_mime, tamano, creado_en FROM documentos WHERE animal_id = ? ORDER BY creado_en DESC').bind(a.id).all(),
    ]);
    return json({ historia: historia.results, documentos: documentos.results });
  }, 'sesion'],

  ['POST', '/api/mi/citas/:id/comprobante', async ({ env, request, sesion, p, sitio, ctx }) => {
    const c = await citaPropia(env, sesion.id, p.id);
    if (!['pendiente', 'confirmada'].includes(c.estado)) fallo(400, 'Esta cita ya no admite comprobantes.');
    if (c.anticipo_estado === 'recibido') fallo(400, 'Ya recibimos el anticipo de esta cita.');
    const archivo = await guardarArchivo(env, (await leerFormulario(request)).get('comprobante'), `u/${sesion.id}/comprobantes`);
    if (!archivo) fallo(400, 'Elige el archivo del comprobante.');
    await env.DB.prepare(`UPDATE citas SET comprobante_key = ?, anticipo_estado = 'por_revisar', actualizado_en = ? WHERE id = ?`).bind(archivo.key, Date.now(), c.id).run();
    ctx.waitUntil(enviarCorreo(env, { para: env.CORREO_AMIZOO, asunto: `Comprobante recibido · ${c.codigo}`, html: plantilla('Llegó un comprobante de anticipo', tablaCita(c), { boton: { url: `${sitio}/panel#cita/${c.id}`, texto: 'Revisar' } }) }));
    return json({ ok: true });
  }, 'sesion'],

  // Cancelar: con menos de 24 h se avisa que el anticipo no se devuelve y se pide confirmar.
  ['POST', '/api/mi/citas/:id/cancelar', async ({ env, request, sesion, p, sitio, ctx }) => {
    const b = await leerJson(request);
    const c = await citaPropia(env, sesion.id, p.id);
    if (!['pendiente', 'confirmada'].includes(c.estado) || c.inicio < Date.now()) fallo(400, 'Esta cita ya no se puede cancelar.');
    const tarde = c.inicio - Date.now() < 24 * HORA_MS;
    if (tarde && b.confirmo !== true) {
      return json({ requiereConfirmar: true, mensaje: 'Faltan menos de 24 horas para la cita. Si cancelas ahora, el anticipo no se devuelve. ¿Quieres cancelar de todas formas?' }, 409);
    }
    const motivo = texto(b.motivo, { max: 300 });
    await env.DB.prepare(`UPDATE citas SET estado = 'cancelada', nota_estado = ?, pierde_anticipo = ?, actualizado_en = ? WHERE id = ?`)
      .bind(`Cancelada por el cliente${motivo ? `: ${motivo}` : ''}`, tarde ? 1 : 0, Date.now(), c.id).run();
    // Fase 4: eliminar el evento de Google Calendar.
    ctx.waitUntil(enviarCorreo(env, { para: env.CORREO_AMIZOO, asunto: `Cita cancelada por el cliente · ${c.codigo}`, html: plantilla('Un cliente canceló su cita', `${tablaCita(c)}<p>${esc(motivo || 'Sin motivo')}</p>${tarde ? '<p><strong>Canceló con menos de 24 horas.</strong></p>' : ''}`) }));
    return json({ ok: true, pierdeAnticipo: tarde });
  }, 'sesion'],

  // Reprogramar: la cita vuelve a "pendiente" para que AmiZoo confirme el nuevo horario.
  ['POST', '/api/mi/citas/:id/reprogramar', async ({ env, request, sesion, p, sitio, ctx }) => {
    const b = await leerJson(request);
    const c = await citaPropia(env, sesion.id, p.id);
    if (!['pendiente', 'confirmada'].includes(c.estado) || c.inicio < Date.now()) fallo(400, 'Esta cita ya no se puede reprogramar.');
    const tarde = c.inicio - Date.now() < 24 * HORA_MS;
    if (tarde && b.confirmo !== true) {
      return json({ requiereConfirmar: true, mensaje: 'Faltan menos de 24 horas para la cita. Si la cambias ahora, el anticipo no se devuelve. ¿Quieres cambiarla de todas formas?' }, 409);
    }
    const servicio = await servicioPorId(env, c.servicio_id, { soloVisible: false });
    const f = fecha(b.fecha), h = hora(b.hora);
    if (!(await horariosDisponibles(env, servicio, f, { excluirId: c.id })).includes(h)) fallo(409, 'Ese horario ya no está disponible. Elige otro.');
    const { inicio, fin, finBloqueo } = await bloqueCita(env, servicio, f, h);
    const r = await env.DB.prepare(
      `UPDATE citas SET inicio = ?, fin = ?, fin_bloqueo = ?, estado = 'pendiente', pierde_anticipo = MAX(pierde_anticipo, ?), actualizado_en = ?
        WHERE id = ? AND NOT EXISTS (SELECT 1 FROM citas WHERE id != ? AND estado IN ('pendiente','confirmada') AND inicio < ? AND fin_bloqueo > ?)`
    ).bind(inicio, fin, finBloqueo, tarde ? 1 : 0, Date.now(), c.id, c.id, finBloqueo, inicio).run();
    if (!r.meta.changes) fallo(409, 'Ese horario se acaba de ocupar. Elige otro.');
    const nueva = await citaPorId(env, c.id);
    ctx.waitUntil(enviarCorreo(env, { para: env.CORREO_AMIZOO, asunto: `Cliente pidió cambio de horario · ${c.codigo}`, html: plantilla('Solicitud de cambio de horario', `${tablaCita(nueva)}<p>La cita volvió a <strong>pendiente</strong>: confírmala en el panel.</p>`, { boton: { url: `${sitio}/panel#cita/${c.id}`, texto: 'Revisar' } }) }));
    return json({ ok: true });
  }, 'sesion'],

  // Archivos privados de R2: el cliente solo ve los suyos (carpeta u/{id}/); el admin ve todos.
  ['GET', '/api/archivos/*', async ({ env, sesion, p, url }) => {
    const key = decodeURIComponent(p['*'] || '');
    if (!/^u\/\d+\/[a-z]+\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(key)) fallo(404, 'Archivo no encontrado.');
    if (sesion.rol !== 'admin' && !key.startsWith(`u/${sesion.id}/`)) fallo(404, 'Archivo no encontrado.');
    return servirArchivo(env, key, { descargar: url.searchParams.has('descargar') });
  }, 'sesion'],
];
