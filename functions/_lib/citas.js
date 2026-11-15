// Lógica compartida de citas y animales (agenda pública, portal y panel).
import { texto, entero, fallo, opcion, codigoCita, ESPECIES, ESPECIES_PRODUCCION } from './util.js';
import { leerConfig, precioDe, bloqueCita, horariosDisponibles } from './agenda.js';
import { enviarCorreo, plantilla, tablaCita, RECOMENDACIONES, esc, ics, enlaceGoogle, cuandoTexto } from './correo.js';

export const SELECT_CITA = `SELECT c.*, a.nombre animal_nombre, a.especie animal_especie, a.tipo animal_tipo, a.temperamento animal_temperamento,
  a.raza animal_raza, a.edad animal_edad, a.peso animal_peso, a.num_animales animal_num, a.tipo_produccion animal_produccion,
  u.nombre cliente_nombre, u.correo cliente_correo, u.telefono cliente_telefono
  FROM citas c JOIN usuarios u ON u.id = c.usuario_id LEFT JOIN animales a ON a.id = c.animal_id`;

export const ESTADOS = ['pendiente', 'confirmada', 'completada', 'cancelada', 'rechazada', 'no_asistio'];
export const ESTADO_TEXTO = {
  pendiente: 'Pendiente de confirmación', confirmada: 'Confirmada', completada: 'Completada',
  cancelada: 'Cancelada', rechazada: 'No confirmada', no_asistio: 'No asistió',
};

export async function citaPorId(env, id) {
  const c = await env.DB.prepare(`${SELECT_CITA} WHERE c.id = ?`).bind(id).first();
  if (!c) fallo(404, 'No encontramos esa cita.');
  return c;
}

/* ---------- Animales ---------- */
export function validarAnimal(b) {
  const tipo = opcion(b.tipo || 'compania', ['compania', 'produccion'], 'El tipo de animal');
  const especie = opcion(b.especie, tipo === 'produccion' ? ESPECIES_PRODUCCION : ESPECIES, 'La especie');
  if (tipo === 'produccion') {
    return {
      tipo, especie,
      nombre: texto(b.nombre, { campo: 'El nombre de la finca', requerido: true, max: 100 }),
      num_animales: entero(b.numAnimales, { campo: 'El número de animales', min: 1, max: 100000, requerido: true }),
      tipo_produccion: texto(b.tipoProduccion, { campo: 'El tipo de producción', requerido: true, max: 100 }),
      raza: null, edad: null, peso: null, temperamento: texto(b.temperamento, { max: 200 }),
    };
  }
  return {
    tipo, especie,
    nombre: texto(b.nombre, { campo: 'El nombre del animal', requerido: true, max: 60 }),
    raza: texto(b.raza, { max: 60 }), edad: texto(b.edad, { campo: 'La edad', max: 40 }), peso: texto(b.peso, { campo: 'El peso', max: 40 }),
    temperamento: texto(b.temperamento, { campo: 'El temperamento', max: 200 }),
    num_animales: null, tipo_produccion: null,
  };
}

export async function insertarAnimal(env, usuarioId, a) {
  const r = await env.DB.prepare(
    `INSERT INTO animales (usuario_id, tipo, nombre, especie, raza, edad, peso, temperamento, num_animales, tipo_produccion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(usuarioId, a.tipo, a.nombre, a.especie, a.raza, a.edad, a.peso, a.temperamento, a.num_animales, a.tipo_produccion).run();
  return { id: r.meta.last_row_id, ...a };
}

/* ---------- Lugar ---------- */
export async function validarLugar(env, servicio, b) {
  if (servicio.modalidad === 'virtual') {
    return { zona: null, barrio: null, direccion: null, contacto_virtual: texto(b.contactoVirtual, { campo: 'El medio de contacto para la videollamada', requerido: true, max: 120 }), tarifa: 'bogota' };
  }
  const { zonas } = await leerConfig(env, 'zonas');
  const z = zonas.find((x) => x.id === b.zona);
  if (!z) fallo(400, 'Elige la zona donde será la visita.');
  return {
    zona: z.id, tarifa: z.tarifa === 'fueraBogota' ? 'fuera' : 'bogota',
    barrio: texto(b.barrio, { campo: z.tarifa === 'fueraBogota' ? 'El municipio' : 'El barrio', requerido: true, max: 80 }),
    direccion: texto(b.direccion, { campo: 'La dirección', requerido: true, min: 5, max: 160 }),
    contacto_virtual: null,
  };
}

/* ---------- Crear cita (con verificación atómica contra doble reserva) ---------- */
export async function insertarCita(env, { usuarioId, animal, servicio, lugar, fecha, hora, motivo, origen = 'web', estado = 'pendiente', revisarHorario = true }) {
  if (!servicio.especies.includes(animal.especie)) fallo(400, `${servicio.nombre} no está disponible para ${animal.especie}.`);
  if (revisarHorario) {
    const libres = await horariosDisponibles(env, servicio, fecha);
    if (!libres.includes(hora)) fallo(409, 'Ese horario ya no está disponible. Elige otro, por favor.', { horarioOcupado: true });
  }
  const { inicio, fin, finBloqueo, cfg } = await bloqueCita(env, servicio, fecha, hora);
  const { precio, texto: precioTexto } = precioDe(servicio, lugar.tarifa);
  const codigo = codigoCita();
  const r = await env.DB.prepare(
    `INSERT INTO citas (codigo, usuario_id, animal_id, servicio_id, servicio_nombre, inicio, fin, fin_bloqueo, estado, zona, barrio, direccion,
       contacto_virtual, motivo, precio, precio_texto, anticipo, origen)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM citas WHERE estado IN ('pendiente','confirmada') AND inicio < ? AND fin_bloqueo > ?)`
  ).bind(codigo, usuarioId, animal.id, servicio.id, servicio.nombre, inicio, fin, finBloqueo, estado, lugar.zona, lugar.barrio, lugar.direccion,
    lugar.contacto_virtual, motivo, precio, precioTexto, cfg.anticipo, origen, finBloqueo, inicio).run();
  if (!r.meta.changes) fallo(409, 'Ese horario se acaba de ocupar. Elige otro, por favor.', { horarioOcupado: true });
  return r.meta.last_row_id;
}

/* ---------- Correos ---------- */
export function avisarNuevaCita(env, ctx, sitio, c) {
  ctx.waitUntil(Promise.all([
    enviarCorreo(env, {
      para: c.cliente_correo,
      asunto: `Recibimos tu solicitud de cita · ${c.codigo}`,
      html: plantilla('¡Recibimos tu solicitud!', `<p>Hola, ${esc(c.cliente_nombre)}. Tu cita quedó <strong>pendiente de confirmación</strong>. Te escribiremos cuando la revisemos.</p>
        ${tablaCita(c)}
        ${c.anticipo_estado === 'sin_comprobante' ? '<p>Recuerda enviar el comprobante del anticipo desde <strong>Mi cuenta</strong> o por WhatsApp.</p>' : ''}
        ${RECOMENDACIONES}`, { boton: { url: `${sitio}/mi-cuenta#citas`, texto: 'Ver mi cita' } }),
    }),
    enviarCorreo(env, {
      para: env.CORREO_AMIZOO,
      asunto: `Nueva solicitud ${c.codigo}: ${c.servicio_nombre} · ${cuandoTexto(c.inicio)}`,
      html: plantilla('Nueva solicitud de cita', `<p><strong>${esc(c.cliente_nombre)}</strong> · ${esc(c.cliente_telefono || '')} · ${esc(c.cliente_correo || '')}</p>
        ${tablaCita(c)}<p><strong>Motivo:</strong> ${esc(c.motivo || '—')}</p><p><strong>Anticipo:</strong> ${c.anticipo_estado === 'por_revisar' ? 'comprobante adjunto, por revisar' : 'sin comprobante'}</p>`,
        { boton: { url: `${sitio}/panel#cita/${c.id}`, texto: 'Revisar en el panel' } }),
    }),
  ]));
}

export function avisarCambio(env, ctx, sitio, c, tipo, extra = '') {
  if (!c.cliente_correo) return;
  const textos = {
    confirmada: ['¡Tu cita está confirmada!', `Confirmamos tu cita · ${c.codigo}`, '<p>Te esperamos. Agrega la cita a tu calendario con el botón o con el archivo adjunto.</p>' + RECOMENDACIONES],
    rechazada: ['No pudimos confirmar tu cita', `Sobre tu solicitud ${c.codigo}`, `<p>Lo sentimos, no pudimos confirmar esta cita.${extra ? ` Motivo: <strong>${esc(extra)}</strong>.` : ''}</p><p>Escríbenos por WhatsApp al 314 230 0347 y buscamos otro horario.</p>`],
    reprogramada: ['Tu cita cambió de horario', `Nuevo horario para tu cita · ${c.codigo}`, '<p>Este es el nuevo horario de tu cita.</p>' + RECOMENDACIONES],
    cancelada: ['Tu cita fue cancelada', `Cita cancelada · ${c.codigo}`, `<p>La cita quedó cancelada.${extra ? ` ${esc(extra)}` : ''}</p>`],
  };
  const [titulo, asunto, cuerpo] = textos[tipo];
  const conCalendario = tipo === 'confirmada' || tipo === 'reprogramada';
  ctx.waitUntil(enviarCorreo(env, {
    para: c.cliente_correo, asunto,
    html: plantilla(titulo, `<p>Hola, ${esc(c.cliente_nombre)}.</p>${tablaCita(c)}${cuerpo}`,
      conCalendario ? { boton: { url: enlaceGoogle(c, sitio), texto: 'Agregar a Google Calendar' } } : { boton: { url: `${sitio}/mi-cuenta#citas`, texto: 'Ver mis citas' } }),
    adjuntos: conCalendario ? [{ filename: `cita-${c.codigo}.ics`, content: btoa(unescape(encodeURIComponent(ics(c, sitio)))) }] : undefined,
  }));
}
