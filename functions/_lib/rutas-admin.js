// Panel de control (/panel): solo rol admin. Cada acción importante queda en el registro de actividad.
import { json, leerJson, texto, correo, telefono, fecha, hora, fallo, entero, opcion, registrar, ESPECIES } from './util.js';
import { leerConfig, servicioDesdeFila, servicioPorId, bloqueCita, desdeLocal, fechaLocal } from './agenda.js';
import { guardarArchivo, leerFormulario } from './archivos.js';
import { SELECT_CITA, ESTADOS, citaPorId, validarAnimal, insertarAnimal, validarLugar, insertarCita, avisarCambio } from './citas.js';
import { cuandoTexto } from './correo.js';

const DIA = 86400_000;
const hoyLocal = () => fechaLocal(Date.now());

async function clientePorId(env, id) {
  const u = await env.DB.prepare(`SELECT id, nombre, correo, telefono, hash IS NOT NULL tiene_cuenta, creado_en FROM usuarios WHERE id = ? AND rol = 'cliente'`).bind(entero(id)).first();
  if (!u) fallo(404, 'No encontramos ese cliente.');
  return u;
}
async function animalPorId(env, id) {
  const a = await env.DB.prepare('SELECT * FROM animales WHERE id = ?').bind(entero(id)).first();
  if (!a) fallo(404, 'No encontramos ese animal.');
  return a;
}
const resumenCita = (c) => `${c.codigo} · ${c.servicio_nombre} · ${c.cliente_nombre} · ${cuandoTexto(c.inicio)}`;

/* ---------- Validación de servicios y configuración ---------- */
const ICONOS = ['estetoscopio', 'correa', 'jeringa', 'tubo', 'granero', 'plato', 'pelota', 'curita', 'biberon'];
function validarServicio(b, { nuevo }) {
  const tipo = opcion(b.precio?.tipo, ['zona', 'rango', 'fijo'], 'El tipo de precio');
  const v = (x, campo) => entero(x, { campo, min: 0, max: 50_000_000, requerido: true });
  const precio = tipo === 'zona' ? { tipo, bogota: v(b.precio.bogota, 'El precio en Bogotá'), fueraBogota: v(b.precio.fueraBogota, 'El precio fuera de Bogotá') }
    : tipo === 'rango' ? { tipo, desde: v(b.precio.desde, 'El precio "desde"'), hasta: v(b.precio.hasta, 'El precio "hasta"'), domicilioAparte: !!b.precio.domicilioAparte }
    : { tipo, valor: v(b.precio.valor, 'El precio') };
  if (tipo === 'rango' && precio.hasta < precio.desde) fallo(400, 'El precio "hasta" debe ser mayor que "desde".');
  const especies = Array.isArray(b.especies) ? b.especies.filter((e) => ESPECIES.includes(e)) : [];
  if (!especies.length) fallo(400, 'Elige al menos una especie.');
  const s = {
    nombre: texto(b.nombre, { campo: 'El nombre', requerido: true, max: 80 }),
    icono: opcion(b.icono || 'estetoscopio', ICONOS, 'El ícono'),
    descripcion: texto(b.descripcion, { campo: 'La descripción', requerido: true, max: 1200, multilinea: true }),
    especies, precio,
    duracionMin: entero(b.duracionMin, { campo: 'La duración', min: 10, max: 600, requerido: true }),
    duracionTexto: texto(b.duracionTexto, { max: 80 }),
    modalidad: opcion(b.modalidad || 'domicilio', ['domicilio', 'virtual'], 'La modalidad'),
    visible: b.visible !== false, orden: entero(b.orden ?? 0, { min: 0, max: 999 }) ?? 0,
  };
  if (nuevo) {
    s.id = String(b.id || s.nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
    if (!s.id) fallo(400, 'El nombre del servicio no es válido.');
  }
  return s;
}

const lista = (x, max, campo) => (Array.isArray(x) ? x : []).map((t) => texto(t, { campo, max })).filter(Boolean).slice(0, 60);
const VALIDAR_CONFIG = {
  agenda(b) {
    const dias = [...new Set((b.dias || []).map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
    if (!dias.length) fallo(400, 'Elige al menos un día de atención.');
    const inicio = hora(b.inicio), fin = hora(b.fin);
    if (fin <= inicio) fallo(400, 'La hora de cierre debe ser después de la de apertura.');
    return {
      dias, inicio, fin,
      maxDia: entero(b.maxDia, { campo: 'El máximo de citas por día', min: 1, max: 20, requerido: true }),
      desplazamientoMin: entero(b.desplazamientoMin, { campo: 'El tiempo entre citas', min: 0, max: 240, requerido: true }),
      anticipacionHoras: entero(b.anticipacionHoras, { campo: 'La anticipación mínima', min: 0, max: 720, requerido: true }),
      pasoMin: opcion(Number(b.pasoMin), [15, 20, 30, 60], 'El intervalo de horarios'),
      anticipo: entero(b.anticipo, { campo: 'El anticipo', min: 0, max: 1_000_000, requerido: true }),
    };
  },
  pago: (b) => ({ nequi: texto(b.nequi, { max: 40 }) || '', daviplata: texto(b.daviplata, { max: 40 }) || '', transferencia: texto(b.transferencia, { max: 400, multilinea: true }) || '' }),
  zonas(b) {
    const zonas = (Array.isArray(b.zonas) ? b.zonas : []).slice(0, 30).map((z, i) => ({
      id: String(z.id || `zona-${i + 1}`).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30) || `zona-${i + 1}`,
      nombre: texto(z.nombre, { campo: 'El nombre de la zona', requerido: true, max: 60 }),
      tarifa: opcion(z.tarifa, ['bogota', 'fueraBogota'], 'La tarifa de la zona'),
      barrios: lista(z.barrios, 80, 'El barrio'),
    }));
    if (!zonas.length) fallo(400, 'Debe haber al menos una zona.');
    return { pendienteConfirmar: texto(b.pendienteConfirmar, { max: 500, multilinea: true }), zonas };
  },
  planes(b) {
    const p = b.preventiva || {}, m = b.membresias || {};
    return {
      preventiva: {
        id: 'medicina-preventiva', nombre: texto(p.nombre, { campo: 'El nombre del plan', requerido: true, max: 80 }),
        pago: texto(p.pago, { max: 60 }), condicion: texto(p.condicion, { max: 120 }), incluye: lista(p.incluye, 200, 'El beneficio'),
        precios: (p.precios || []).slice(0, 10).map((x) => ({ especie: texto(x.especie, { campo: 'La especie', requerido: true, max: 40 }), valor: entero(x.valor, { campo: 'El precio', min: 0, max: 50_000_000, requerido: true }) })),
      },
      membresias: {
        titulo: texto(m.titulo, { max: 100 }), para: texto(m.para, { max: 100 }),
        planes: (m.planes || []).slice(0, 6).map((x) => ({
          id: String(x.id || '').replace(/[^a-z0-9-]/g, '').slice(0, 30), nombre: texto(x.nombre, { campo: 'El nombre de la membresía', requerido: true, max: 40 }),
          precioMensual: x.precioMensual === null || x.precioMensual === '' ? null : entero(x.precioMensual, { campo: 'El precio mensual', min: 0, max: 50_000_000 }),
          beneficios: lista(x.beneficios, 200, 'El beneficio'),
        })),
      },
    };
  },
};

export const rutasAdmin = [
  ['GET', '/api/admin/resumen', async ({ env }) => {
    const hoy = desdeLocal(hoyLocal());
    const q = (sql, ...a) => env.DB.prepare(sql).bind(...a).all().then((r) => r.results);
    const [deHoy, semana, pendientes, anticipos, sync] = await Promise.all([
      q(`${SELECT_CITA} WHERE c.inicio >= ? AND c.inicio < ? AND c.estado IN ('pendiente','confirmada','completada') ORDER BY c.inicio`, hoy, hoy + DIA),
      q(`${SELECT_CITA} WHERE c.inicio >= ? AND c.inicio < ? AND c.estado IN ('pendiente','confirmada') ORDER BY c.inicio`, hoy + DIA, hoy + 8 * DIA),
      q(`${SELECT_CITA} WHERE c.estado = 'pendiente' AND c.inicio >= ? ORDER BY c.inicio`, Date.now() - DIA),
      q(`${SELECT_CITA} WHERE c.anticipo_estado = 'por_revisar' AND c.estado IN ('pendiente','confirmada') ORDER BY c.inicio`),
      q(`${SELECT_CITA} WHERE c.sync_estado IN ('pendiente','error') AND c.estado = 'confirmada' ORDER BY c.inicio`),
    ]);
    return json({ hoy: deHoy, semana, pendientes, anticipos, sync });
  }],

  ['GET', '/api/admin/citas', async ({ env, url }) => {
    const s = url.searchParams;
    const desde = desdeLocal(fecha(s.get('desde') || hoyLocal()));
    const hasta = desdeLocal(fecha(s.get('hasta') || fechaLocal(desde + 7 * DIA))) + DIA;
    if (hasta - desde > 62 * DIA) fallo(400, 'Elige un rango de máximo dos meses.');
    const estado = s.get('estado');
    const r = await env.DB.prepare(`${SELECT_CITA} WHERE c.inicio >= ? AND c.inicio < ? ${estado ? 'AND c.estado = ?' : ''} ORDER BY c.inicio LIMIT 500`)
      .bind(...[desde, hasta, ...(estado ? [opcion(estado, ESTADOS, 'El estado')] : [])]).all();
    return json({ citas: r.results });
  }],

  ['GET', '/api/admin/citas/:id', async ({ env, p }) => {
    const c = await citaPorId(env, entero(p.id));
    const otras = await env.DB.prepare(`${SELECT_CITA} WHERE c.usuario_id = ? AND c.id != ? ORDER BY c.inicio DESC LIMIT 20`).bind(c.usuario_id, c.id).all();
    return json({ cita: c, otras: otras.results });
  }],

  ['POST', '/api/admin/citas', async ({ env, request, sesion }) => {
    const b = await leerJson(request);
    let clienteId = b.clienteId ? (await clientePorId(env, b.clienteId)).id : null;
    if (!clienteId) {
      const k = b.cliente || {};
      const c = correo(k.correo, { requerido: false });
      if (c) {
        const ex = await env.DB.prepare('SELECT id, rol FROM usuarios WHERE correo = ?').bind(c).first();
        if (ex?.rol === 'admin') fallo(400, 'Ese correo es de un administrador.');
        if (ex) clienteId = ex.id;
      }
      if (!clienteId) {
        const r = await env.DB.prepare(`INSERT INTO usuarios (correo, nombre, telefono, rol) VALUES (?, ?, ?, 'cliente')`)
          .bind(c, texto(k.nombre, { campo: 'El nombre del cliente', requerido: true, max: 100 }), telefono(k.telefono)).run();
        clienteId = r.meta.last_row_id;
      }
    }
    let animal;
    if (b.animalId) {
      animal = await animalPorId(env, b.animalId);
      if (animal.usuario_id !== clienteId) fallo(400, 'Ese animal no es de este cliente.');
    } else animal = await insertarAnimal(env, clienteId, validarAnimal(b.animal || {}));
    const servicio = await servicioPorId(env, b.servicio, { soloVisible: false });
    const estado = opcion(b.estado || 'confirmada', ['pendiente', 'confirmada'], 'El estado');
    const id = await insertarCita(env, {
      usuarioId: clienteId, animal, servicio, lugar: await validarLugar(env, servicio, b.lugar || {}),
      fecha: fecha(b.fecha), hora: hora(b.hora), motivo: texto(b.motivo, { max: 600, multilinea: true }),
      origen: 'manual', estado, revisarHorario: !b.fueraDeHorario,
    });
    const anticipo = opcion(b.anticipo || 'sin_comprobante', ['sin_comprobante', 'recibido', 'no_aplica'], 'El estado del anticipo');
    await env.DB.prepare('UPDATE citas SET anticipo_estado = ? WHERE id = ?').bind(anticipo, id).run();
    const c = await citaPorId(env, id);
    await registrar(env, sesion.id, 'crear_cita', resumenCita(c));
    return json({ cita: c }, 201);
  }],

  ['POST', '/api/admin/citas/:id/confirmar', async ({ env, sesion, p, sitio, ctx }) => {
    const c = await citaPorId(env, entero(p.id));
    if (c.estado !== 'pendiente') fallo(400, 'Solo se confirman citas pendientes.');
    // Fase 4: crear el evento en Google Calendar con el cliente invitado; si falla, sync_estado = 'pendiente'.
    await env.DB.prepare(`UPDATE citas SET estado = 'confirmada', actualizado_en = ? WHERE id = ?`).bind(Date.now(), c.id).run();
    const n = await citaPorId(env, c.id);
    avisarCambio(env, ctx, sitio, n, 'confirmada');
    await registrar(env, sesion.id, 'confirmar_cita', resumenCita(n));
    return json({ cita: n });
  }],

  ['POST', '/api/admin/citas/:id/rechazar', async ({ env, request, sesion, p, sitio, ctx }) => {
    const b = await leerJson(request);
    const motivo = texto(b.motivo, { campo: 'El motivo', requerido: true, max: 300 });
    const c = await citaPorId(env, entero(p.id));
    if (!['pendiente', 'confirmada'].includes(c.estado)) fallo(400, 'Esta cita ya está cerrada.');
    await env.DB.prepare(`UPDATE citas SET estado = 'rechazada', nota_estado = ?, actualizado_en = ? WHERE id = ?`).bind(motivo, Date.now(), c.id).run();
    const n = await citaPorId(env, c.id);
    avisarCambio(env, ctx, sitio, n, 'rechazada', motivo);
    await registrar(env, sesion.id, 'rechazar_cita', `${resumenCita(n)} · Motivo: ${motivo}`);
    return json({ cita: n });
  }],

  ['POST', '/api/admin/citas/:id/reprogramar', async ({ env, request, sesion, p, sitio, ctx }) => {
    const b = await leerJson(request);
    const c = await citaPorId(env, entero(p.id));
    if (!['pendiente', 'confirmada'].includes(c.estado)) fallo(400, 'Esta cita ya está cerrada.');
    const servicio = await servicioPorId(env, c.servicio_id, { soloVisible: false });
    const { inicio, fin, finBloqueo } = await bloqueCita(env, servicio, fecha(b.fecha), hora(b.hora));
    const r = await env.DB.prepare(
      `UPDATE citas SET inicio = ?, fin = ?, fin_bloqueo = ?, actualizado_en = ?
        WHERE id = ? AND NOT EXISTS (SELECT 1 FROM citas WHERE id != ? AND estado IN ('pendiente','confirmada') AND inicio < ? AND fin_bloqueo > ?)`
    ).bind(inicio, fin, finBloqueo, Date.now(), c.id, c.id, finBloqueo, inicio).run();
    if (!r.meta.changes) fallo(409, 'Ese horario se cruza con otra cita (incluye 50 min de desplazamiento).');
    const n = await citaPorId(env, c.id);
    if (b.avisar !== false) avisarCambio(env, ctx, sitio, n, 'reprogramada');
    await registrar(env, sesion.id, 'reprogramar_cita', `${c.codigo}: ${cuandoTexto(c.inicio)} → ${cuandoTexto(n.inicio)}`);
    return json({ cita: n });
  }],

  ['POST', '/api/admin/citas/:id/estado', async ({ env, request, sesion, p, sitio, ctx }) => {
    const b = await leerJson(request);
    const estado = opcion(b.estado, ['completada', 'cancelada', 'no_asistio'], 'El estado');
    const nota = texto(b.nota, { max: 300 });
    const c = await citaPorId(env, entero(p.id));
    await env.DB.prepare('UPDATE citas SET estado = ?, nota_estado = COALESCE(?, nota_estado), actualizado_en = ? WHERE id = ?').bind(estado, nota, Date.now(), c.id).run();
    const n = await citaPorId(env, c.id);
    if (estado === 'cancelada' && b.avisar !== false) avisarCambio(env, ctx, sitio, n, 'cancelada', nota || '');
    await registrar(env, sesion.id, `cita_${estado}`, resumenCita(n));
    return json({ cita: n });
  }],

  ['POST', '/api/admin/citas/:id/anticipo', async ({ env, request, sesion, p }) => {
    const b = await leerJson(request);
    const estado = opcion(b.estado, ['recibido', 'no_recibido', 'por_revisar', 'sin_comprobante', 'no_aplica'], 'El estado del anticipo');
    const c = await citaPorId(env, entero(p.id));
    await env.DB.prepare('UPDATE citas SET anticipo_estado = ?, actualizado_en = ? WHERE id = ?').bind(estado, Date.now(), c.id).run();
    await registrar(env, sesion.id, `anticipo_${estado}`, resumenCita(c));
    return json({ cita: await citaPorId(env, c.id) });
  }],

  /* ---------- Clientes y animales ---------- */
  // Clientes con filtros: búsqueda (nombre, celular, correo, mascota o raza), especie, tipo y orden.
  ['GET', '/api/admin/clientes', async ({ env, url }) => {
    const s = url.searchParams;
    const q = texto(s.get('q'), { max: 80 });
    const especie = s.get('especie') ? opcion(s.get('especie'), ESPECIES, 'La especie') : null;
    const tipo = s.get('tipo') ? opcion(s.get('tipo'), ['compania', 'produccion'], 'El tipo') : null;
    const orden = { nombre: 'u.nombre', reciente: 'ultima_cita DESC NULLS LAST, u.nombre', animales: 'n_animales DESC, u.nombre', nuevo: 'u.creado_en DESC' }[s.get('orden')] || 'u.nombre';
    const donde = ["u.rol = 'cliente'"];
    const params = [];
    if (q) {
      const like = `%${q.replace(/[%_]/g, '')}%`;
      donde.push(`(u.nombre LIKE ? OR u.correo LIKE ? OR u.telefono LIKE ? OR EXISTS (SELECT 1 FROM animales a WHERE a.usuario_id = u.id AND a.activo = 1 AND (a.nombre LIKE ? OR a.raza LIKE ?)))`);
      params.push(like, like, like, like, like);
    }
    if (especie || tipo) {
      donde.push(`EXISTS (SELECT 1 FROM animales a WHERE a.usuario_id = u.id AND a.activo = 1 ${especie ? 'AND a.especie = ?' : ''} ${tipo ? 'AND a.tipo = ?' : ''})`);
      if (especie) params.push(especie);
      if (tipo) params.push(tipo);
    }
    const r = await env.DB.prepare(
      `SELECT u.id, u.nombre, u.correo, u.telefono, u.hash IS NOT NULL tiene_cuenta, u.creado_en,
         (SELECT COUNT(*) FROM animales a WHERE a.usuario_id = u.id AND a.activo = 1) n_animales,
         (SELECT json_group_array(json_object('id', a.id, 'nombre', a.nombre, 'especie', a.especie, 'tipo', a.tipo)) FROM animales a WHERE a.usuario_id = u.id AND a.activo = 1) animales_json,
         (SELECT MAX(inicio) FROM citas c WHERE c.usuario_id = u.id AND c.inicio <= ?1) ultima_cita,
         (SELECT MIN(inicio) FROM citas c WHERE c.usuario_id = u.id AND c.estado IN ('pendiente','confirmada') AND c.inicio > ?1) proxima_cita,
         (SELECT COUNT(*) FROM citas c WHERE c.usuario_id = u.id) n_citas
       FROM usuarios u WHERE ${donde.join(' AND ')}
       ORDER BY ${orden} LIMIT 300`
    ).bind(Date.now(), ...params).all();
    const clientes = r.results.map(({ animales_json, ...c }) => ({ ...c, animales: JSON.parse(animales_json || '[]') }));
    return json({ clientes });
  }],

  // Mascotas (todas las de todos los clientes) con su dueño, última visita y próximo control.
  ['GET', '/api/admin/animales', async ({ env, url }) => {
    const s = url.searchParams;
    const q = texto(s.get('q'), { max: 80 });
    const especie = s.get('especie') ? opcion(s.get('especie'), ESPECIES, 'La especie') : null;
    const tipo = s.get('tipo') ? opcion(s.get('tipo'), ['compania', 'produccion'], 'El tipo') : null;
    const orden = { nombre: 'a.nombre', reciente: 'ultima_visita DESC NULLS LAST, a.nombre', especie: 'a.especie, a.nombre', proximo: 'proximo_control IS NULL, proximo_control, a.nombre' }[s.get('orden')] || 'a.nombre';
    const donde = ['a.activo = 1'];
    const params = [];
    if (q) {
      const like = `%${q.replace(/[%_]/g, '')}%`;
      donde.push('(a.nombre LIKE ? OR a.raza LIKE ? OR u.nombre LIKE ? OR u.telefono LIKE ? OR a.tipo_produccion LIKE ?)');
      params.push(like, like, like, like, like);
    }
    if (especie) { donde.push('a.especie = ?'); params.push(especie); }
    if (tipo) { donde.push('a.tipo = ?'); params.push(tipo); }
    const hoy = fechaLocal(Date.now());
    const r = await env.DB.prepare(
      `SELECT a.id, a.nombre, a.especie, a.raza, a.edad, a.peso, a.temperamento, a.tipo, a.num_animales, a.tipo_produccion, a.foto_key,
         u.id usuario_id, u.nombre dueno, u.telefono dueno_telefono,
         (SELECT MAX(c.inicio) FROM citas c WHERE c.animal_id = a.id AND c.estado = 'completada') ultima_visita,
         (SELECT MIN(c.inicio) FROM citas c WHERE c.animal_id = a.id AND c.estado IN ('pendiente','confirmada') AND c.inicio > ?) proxima_cita,
         (SELECT MIN(h.proxima) FROM historia h WHERE h.animal_id = a.id AND h.proxima >= ?) proximo_control,
         (SELECT COUNT(*) FROM historia h WHERE h.animal_id = a.id) n_registros
       FROM animales a JOIN usuarios u ON u.id = a.usuario_id
       WHERE ${donde.join(' AND ')}
       ORDER BY ${orden} LIMIT 400`
    ).bind(Date.now(), hoy, ...params).all();
    const conteo = await env.DB.prepare(`SELECT especie, tipo, COUNT(*) n FROM animales WHERE activo = 1 GROUP BY especie, tipo`).all();
    return json({ animales: r.results, conteo: conteo.results });
  }],

  ['POST', '/api/admin/clientes', async ({ env, request, sesion }) => {
    const b = await leerJson(request);
    const c = correo(b.correo, { requerido: false });
    if (c && (await env.DB.prepare('SELECT 1 FROM usuarios WHERE correo = ?').bind(c).first())) fallo(409, 'Ya hay un cliente con ese correo.');
    const r = await env.DB.prepare(`INSERT INTO usuarios (correo, nombre, telefono, rol) VALUES (?, ?, ?, 'cliente')`)
      .bind(c, texto(b.nombre, { campo: 'El nombre', requerido: true, max: 100 }), telefono(b.telefono)).run();
    await registrar(env, sesion.id, 'crear_cliente', b.nombre);
    return json({ cliente: await clientePorId(env, r.meta.last_row_id) }, 201);
  }],

  ['GET', '/api/admin/clientes/:id', async ({ env, p }) => {
    const u = await clientePorId(env, p.id);
    const [animales, citas, direcciones] = await Promise.all([
      env.DB.prepare('SELECT * FROM animales WHERE usuario_id = ? AND activo = 1 ORDER BY nombre').bind(u.id).all(),
      env.DB.prepare(`${SELECT_CITA} WHERE c.usuario_id = ? ORDER BY c.inicio DESC`).bind(u.id).all(),
      env.DB.prepare('SELECT * FROM direcciones WHERE usuario_id = ?').bind(u.id).all(),
    ]);
    return json({ cliente: u, animales: animales.results, citas: citas.results, direcciones: direcciones.results });
  }],

  ['PATCH', '/api/admin/clientes/:id', async ({ env, request, sesion, p }) => {
    const u = await clientePorId(env, p.id);
    const b = await leerJson(request);
    const c = correo(b.correo, { requerido: false });
    if (c && c !== u.correo && (await env.DB.prepare('SELECT 1 FROM usuarios WHERE correo = ?').bind(c).first())) fallo(409, 'Ya hay otro usuario con ese correo.');
    await env.DB.prepare('UPDATE usuarios SET nombre = ?, telefono = ?, correo = ? WHERE id = ?')
      .bind(texto(b.nombre, { campo: 'El nombre', requerido: true, max: 100 }), telefono(b.telefono), c, u.id).run();
    await registrar(env, sesion.id, 'editar_cliente', u.nombre);
    return json({ ok: true });
  }],

  ['POST', '/api/admin/clientes/:id/animales', async ({ env, request, p }) => {
    const u = await clientePorId(env, p.id);
    return json({ animal: await insertarAnimal(env, u.id, validarAnimal(await leerJson(request))) }, 201);
  }],

  ['PATCH', '/api/admin/animales/:id', async ({ env, request, p }) => {
    const actual = await animalPorId(env, p.id);
    const a = validarAnimal(await leerJson(request));
    await env.DB.prepare(`UPDATE animales SET tipo = ?, nombre = ?, especie = ?, raza = ?, edad = ?, peso = ?, temperamento = ?, num_animales = ?, tipo_produccion = ? WHERE id = ?`)
      .bind(a.tipo, a.nombre, a.especie, a.raza, a.edad, a.peso, a.temperamento, a.num_animales, a.tipo_produccion, actual.id).run();
    return json({ ok: true });
  }],

  ['GET', '/api/admin/animales/:id/historia', async ({ env, p }) => {
    const a = await animalPorId(env, p.id);
    const [historia, documentos] = await Promise.all([
      env.DB.prepare('SELECT h.*, u.nombre autor FROM historia h LEFT JOIN usuarios u ON u.id = h.creado_por WHERE h.animal_id = ? ORDER BY h.fecha DESC, h.id DESC').bind(a.id).all(),
      env.DB.prepare('SELECT * FROM documentos WHERE animal_id = ? ORDER BY creado_en DESC').bind(a.id).all(),
    ]);
    return json({ animal: a, historia: historia.results, documentos: documentos.results });
  }],

  ['POST', '/api/admin/animales/:id/historia', async ({ env, request, sesion, p }) => {
    const a = await animalPorId(env, p.id);
    const b = await leerJson(request);
    const tipo = opcion(b.tipo, ['visita', 'vacuna', 'prescripcion'], 'El tipo de registro');
    await env.DB.prepare('INSERT INTO historia (animal_id, tipo, fecha, titulo, detalle, proxima, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(a.id, tipo, fecha(b.fecha), texto(b.titulo, { campo: 'El título', requerido: true, max: 120 }),
        texto(b.detalle, { max: 4000, multilinea: true }), fecha(b.proxima, { requerido: false, campo: 'La próxima fecha' }), sesion.id).run();
    await registrar(env, sesion.id, `historia_${tipo}`, `${a.nombre}: ${b.titulo}`);
    return json({ ok: true }, 201);
  }],

  ['DELETE', '/api/admin/historia/:id', async ({ env, sesion, p }) => {
    const h = await env.DB.prepare('SELECT * FROM historia WHERE id = ?').bind(entero(p.id)).first();
    if (!h) fallo(404, 'No encontramos ese registro.');
    await env.DB.prepare('DELETE FROM historia WHERE id = ?').bind(h.id).run();
    await registrar(env, sesion.id, 'borrar_historia', `${h.fecha} · ${h.titulo}`);
    return json({ ok: true });
  }],

  ['POST', '/api/admin/animales/:id/documentos', async ({ env, request, sesion, p }) => {
    const a = await animalPorId(env, p.id);
    const form = await leerFormulario(request);
    const archivo = await guardarArchivo(env, form.get('archivo'), `u/${a.usuario_id}/historia`);
    if (!archivo) fallo(400, 'Elige el archivo.');
    const nombre = texto(form.get('nombre'), { max: 120 }) || archivo.nombre;
    await env.DB.prepare('INSERT INTO documentos (animal_id, nombre, archivo_key, tipo_mime, tamano, subido_por) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(a.id, nombre, archivo.key, archivo.mime, archivo.tamano, sesion.id).run();
    await registrar(env, sesion.id, 'subir_documento', `${a.nombre}: ${nombre}`);
    return json({ ok: true }, 201);
  }],

  ['DELETE', '/api/admin/documentos/:id', async ({ env, sesion, p }) => {
    const d = await env.DB.prepare('SELECT * FROM documentos WHERE id = ?').bind(entero(p.id)).first();
    if (!d) fallo(404, 'No encontramos ese documento.');
    await env.DB.prepare('DELETE FROM documentos WHERE id = ?').bind(d.id).run();
    await env.FILES?.delete(d.archivo_key);
    await registrar(env, sesion.id, 'borrar_documento', d.nombre);
    return json({ ok: true });
  }],

  /* ---------- Servicios ---------- */
  ['GET', '/api/admin/servicios', async ({ env }) => {
    const r = await env.DB.prepare('SELECT * FROM servicios ORDER BY orden, nombre').all();
    return json({ servicios: r.results.map(servicioDesdeFila) });
  }],

  ['POST', '/api/admin/servicios', async ({ env, request, sesion }) => {
    const s = validarServicio(await leerJson(request), { nuevo: true });
    if (await env.DB.prepare('SELECT 1 FROM servicios WHERE id = ?').bind(s.id).first()) fallo(409, 'Ya existe un servicio con ese nombre.');
    await env.DB.prepare('INSERT INTO servicios (id, nombre, icono, descripcion, especies, duracion_min, duracion_texto, modalidad, precio, visible, orden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(s.id, s.nombre, s.icono, s.descripcion, JSON.stringify(s.especies), s.duracionMin, s.duracionTexto, s.modalidad, JSON.stringify(s.precio), s.visible ? 1 : 0, s.orden).run();
    await registrar(env, sesion.id, 'crear_servicio', s.nombre);
    return json({ ok: true }, 201);
  }],

  ['PATCH', '/api/admin/servicios/:id', async ({ env, request, sesion, p }) => {
    const actual = await servicioPorId(env, p.id, { soloVisible: false });
    const s = validarServicio(await leerJson(request), { nuevo: false });
    await env.DB.prepare('UPDATE servicios SET nombre = ?, icono = ?, descripcion = ?, especies = ?, duracion_min = ?, duracion_texto = ?, modalidad = ?, precio = ?, visible = ?, orden = ? WHERE id = ?')
      .bind(s.nombre, s.icono, s.descripcion, JSON.stringify(s.especies), s.duracionMin, s.duracionTexto, s.modalidad, JSON.stringify(s.precio), s.visible ? 1 : 0, s.orden, actual.id).run();
    await registrar(env, sesion.id, 'editar_servicio', s.nombre);
    return json({ ok: true });
  }],

  /* ---------- Configuración ---------- */
  ['GET', '/api/admin/config', async ({ env }) => {
    const [agenda, pago, zonas, planes, bloqueos] = await Promise.all([
      leerConfig(env, 'agenda'), leerConfig(env, 'pago'), leerConfig(env, 'zonas'), leerConfig(env, 'planes'),
      env.DB.prepare('SELECT * FROM bloqueos WHERE hasta >= ? ORDER BY desde').bind(hoyLocal()).all(),
    ]);
    return json({ agenda, pago, zonas, planes, bloqueos: bloqueos.results, google: { conectado: false, fase: 4 } });
  }],

  ['PUT', '/api/admin/config/:clave', async ({ env, request, sesion, p }) => {
    const validar = VALIDAR_CONFIG[p.clave];
    if (!validar) fallo(404, 'Configuración desconocida.');
    const valor = validar(await leerJson(request));
    await env.DB.prepare('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').bind(p.clave, JSON.stringify(valor)).run();
    await registrar(env, sesion.id, 'config_' + p.clave, null);
    return json({ ok: true, valor });
  }],

  ['POST', '/api/admin/bloqueos', async ({ env, request, sesion }) => {
    const b = await leerJson(request);
    const desde = fecha(b.desde, { campo: 'La fecha inicial' }), hasta = fecha(b.hasta || b.desde, { campo: 'La fecha final' });
    if (hasta < desde) fallo(400, 'La fecha final debe ser igual o posterior a la inicial.');
    const motivo = texto(b.motivo, { max: 120 });
    await env.DB.prepare('INSERT INTO bloqueos (desde, hasta, motivo) VALUES (?, ?, ?)').bind(desde, hasta, motivo).run();
    await registrar(env, sesion.id, 'bloquear_dias', `${desde} a ${hasta}${motivo ? ` · ${motivo}` : ''}`);
    return json({ ok: true }, 201);
  }],

  ['DELETE', '/api/admin/bloqueos/:id', async ({ env, sesion, p }) => {
    await env.DB.prepare('DELETE FROM bloqueos WHERE id = ?').bind(entero(p.id)).run();
    await registrar(env, sesion.id, 'desbloquear_dias', `#${p.id}`);
    return json({ ok: true });
  }],

  ['GET', '/api/admin/actividad', async ({ env }) => {
    const r = await env.DB.prepare('SELECT a.*, u.nombre usuario FROM actividad a LEFT JOIN usuarios u ON u.id = a.usuario_id ORDER BY a.creado_en DESC LIMIT 150').all();
    return json({ actividad: r.results });
  }],
];
