// Llena la base LOCAL con datos de demostración usando la API real (como lo harían clientes y administradores)
// y verifica que todo funcione. Uso (con `npm run dev` corriendo):
//   node scripts/datos-demo.mjs [http://localhost:8788]
// Lee DEMO_ADMIN_* y DEMO_CLIENTE_* de .dev.vars. Nunca correr contra producción.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { festivos } from '../functions/_lib/agenda.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://localhost:8788';
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) { console.error('Solo para el servidor local.'); process.exit(1); }
const V = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.dev.vars'), 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
for (const k of ['DEMO_ADMIN_CORREO', 'DEMO_ADMIN_CLAVE', 'DEMO_CLIENTE_CORREO', 'DEMO_CLIENTE_CLAVE']) if (!V[k]) { console.error(`Falta ${k} en .dev.vars`); process.exit(1); }

/* ---------- Utilidades ---------- */
let semilla = 20261114;
const azar = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; };
const elegir = (a) => a[Math.floor(azar() * a.length)];
let bien = 0, mal = 0;
const revisar = (cond, nombre, extra = '') => { if (cond) bien++; else { mal++; console.log('  ✘', nombre, extra); } };

function sesion() {
  let cookie = '';
  return async (ruta, { metodo = 'GET', datos, form } = {}) => {
    const h = { cookie, origin: BASE };
    let body;
    if (form) body = form; else if (datos !== undefined) { body = JSON.stringify(datos); h['content-type'] = 'application/json'; }
    const r = await fetch(BASE + ruta, { method: metodo, headers: h, body, redirect: 'manual' });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    let j = null; try { j = await r.json(); } catch { /* sin json */ }
    return { s: r.status, j };
  };
}
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
const fdCita = (datos, comprobante) => { const f = new FormData(); f.append('datos', JSON.stringify(datos)); if (comprobante) f.append('comprobante', new Blob([PNG], { type: 'image/png' }), 'comprobante.png'); return f; };
const hoyBog = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
const sumar = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const habil = (d) => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return w >= 1 && w <= 5 && !festivos(Number(d.slice(0, 4))).has(d); };

/* ---------- Datos ficticios ---------- */
const NOMBRES = ['María Fernanda', 'Carlos Andrés', 'Laura', 'Andrés Felipe', 'Natalia', 'Juan David', 'Daniela', 'Santiago', 'Valeria', 'Camilo', 'Paula Andrea', 'Sebastián', 'Catalina', 'Julián', 'Mariana', 'Diego', 'Ana María', 'Felipe', 'Juliana', 'Nicolás', 'Carolina', 'Alejandro', 'Gabriela', 'Mateo', 'Isabella', 'Esteban', 'Luisa', 'Ricardo', 'Sofía', 'Hernán', 'Gloria', 'Óscar', 'Lucía', 'Fernando', 'Patricia', 'Mauricio', 'Adriana', 'Jorge', 'Claudia', 'Tomás'];
const APELLIDOS = ['Rodríguez', 'Gómez', 'González', 'Martínez', 'García', 'López', 'Hernández', 'Sánchez', 'Ramírez', 'Torres', 'Díaz', 'Vargas', 'Moreno', 'Rojas', 'Castro', 'Ortiz', 'Jiménez', 'Ruiz', 'Suárez', 'Peña'];
const MASCOTAS = {
  perros: [['Toby', 'Criollo'], ['Luna', 'Labrador'], ['Max', 'Golden retriever'], ['Kira', 'Pastor alemán'], ['Rocky', 'Bulldog francés'], ['Lola', 'Schnauzer'], ['Simón', 'Beagle'], ['Canela', 'Poodle'], ['Bruno', 'Pug'], ['Nina', 'Border collie']],
  gatos: [['Michi', 'Criollo'], ['Nala', 'Siamés'], ['Mota', 'Persa'], ['Pelusa', 'Angora'], ['Felipe', 'Criollo'], ['Oliva', 'Bengalí']],
  aves: [['Kiwi', 'Periquito australiano'], ['Paco', 'Loro'], ['Lorenzo', 'Cacatúa'], ['Sol', 'Canario']],
  roedores: [['Bigotes', 'Hámster'], ['Copito', 'Cobayo'], ['Tambor', 'Conejo']],
};
const FINCAS = [['Finca El Roble', 'bovinos', 25, 'leche'], ['Granja La Esperanza', 'porcinos', 40, 'ceba'], ['Hacienda Los Pinos', 'ovinos', 18, 'lana y carne'], ['Finca Santa Rita', 'caprinos', 12, 'leche'], ['Granja Las Margaritas', 'aves', 300, 'huevo']];
const TEMPERAMENTOS = ['tranquilo', 'juguetón', 'nervioso con extraños', 'muerde si lo cargan', 'miedoso', 'muy sociable', ''];
const MOTIVOS = ['Control general y revisión de piel', 'Se rasca mucho las orejas', 'No quiere comer desde hace dos días', 'Vacuna anual', 'Diarrea leve desde ayer', 'Revisión de una herida en la pata', 'Tos seca en las noches', 'Control de peso', 'Tiene pulgas', 'Cojea un poco de la pata trasera', 'Revisión antes de viajar', 'Asesoría de alimentación'];
const DIRS = { norte: ['Cedritos', 'Niza', 'Santa Bárbara', 'Colina Campestre', 'Mazurén'], occidente: ['Quirigua', 'La Española', 'El Cortijo'], oriente: ['Chapinero Alto', 'Galerías', 'Rosales'], fuera: ['Chía', 'Cajicá', 'Sopó', 'La Calera'] };
const lugar = () => {
  const zona = elegir(['norte', 'norte', 'norte', 'occidente', 'oriente', 'fuera']);
  return { zona, barrio: elegir(DIRS[zona]), direccion: `${zona === 'fuera' ? 'Vereda Centro' : `Calle ${100 + Math.floor(azar() * 90)}`} # ${Math.floor(azar() * 40) + 1}-${Math.floor(azar() * 90) + 10}${azar() > 0.5 ? `, apto ${Math.floor(azar() * 900) + 100}` : ''}` };
};
const persona = (i) => {
  const n = NOMBRES[i % NOMBRES.length], a = APELLIDOS[(i * 7) % APELLIDOS.length], a2 = APELLIDOS[(i * 3 + 5) % APELLIDOS.length];
  const correo = `${n.split(' ')[0]}.${a}${i}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@amizoo.test';
  return { nombre: `${n} ${a} ${a2}`, correo, telefono: `3${String(100000000 + Math.floor(azar() * 899999999)).slice(0, 9)}` };
};
const animalAzar = () => {
  if (azar() < 0.08) { const [nombre, especie, numAnimales, tipoProduccion] = elegir(FINCAS); return { tipo: 'produccion', nombre, especie, numAnimales, tipoProduccion, temperamento: '' }; }
  const especie = elegir(['perros', 'perros', 'perros', 'gatos', 'gatos', 'aves', 'roedores']);
  const [nombre, raza] = elegir(MASCOTAS[especie]);
  return { tipo: 'compania', nombre, especie, raza, edad: `${1 + Math.floor(azar() * 12)} años`, peso: especie === 'perros' ? `${4 + Math.floor(azar() * 30)} kg` : especie === 'gatos' ? `${3 + Math.floor(azar() * 4)} kg` : '', temperamento: elegir(TEMPERAMENTOS) };
};

/* ---------- Disponibilidad ---------- */
async function horarioLibre(api, servicio, { desde = 0 } = {}) {
  const meses = [];
  const h = new Date(Date.now() - 5 * 3600e3);
  for (let i = 0; i < 3; i++) meses.push(new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
  let dias = [];
  for (const m of meses) dias.push(...((await api(`/api/disponibilidad?servicio=${servicio}&mes=${m}`)).j?.dias || []));
  dias = dias.filter((d) => d >= sumar(hoyBog(), desde));
  for (let intento = 0; intento < 6 && dias.length; intento++) {
    const d = elegir(dias.slice(0, 35));
    const hs = (await api(`/api/disponibilidad?servicio=${servicio}&fecha=${d}`)).j?.horarios || [];
    if (hs.length) return { fecha: d, hora: elegir(hs) };
  }
  return null;
}

/* ---------- Programa ---------- */
const anon = sesion();
const t0 = Date.now();
console.log(`Datos de demostración en ${BASE}\n`);
const servicios = (await anon('/api/servicios')).j.servicios;
revisar(servicios.length === 9, 'servicios cargados');
const servicioPara = (especie) => elegir(servicios.filter((s) => s.especies.includes(especie) && (s.id !== 'asesoria-zootecnica' || ['bovinos', 'porcinos', 'ovinos', 'caprinos'].includes(especie))));

// 1. Admin
const adm = sesion();
const la = await adm('/api/auth/entrar', { metodo: 'POST', datos: { correo: V.DEMO_ADMIN_CORREO, clave: V.DEMO_ADMIN_CLAVE } });
revisar(la.s === 200 && la.j.usuario.rol === 'admin', 'admin demo entra', JSON.stringify(la.j));
if (la.s !== 200) process.exit(1);

// 2. Cliente demo (el tuyo) con 3 animales
const yo = sesion();
let r = await yo('/api/auth/registro', { metodo: 'POST', datos: { nombre: 'Juan Demo', correo: V.DEMO_CLIENTE_CORREO, telefono: '3142300347', clave: V.DEMO_CLIENTE_CLAVE, aceptaDatos: true } });
if (r.s === 409) r = await yo('/api/auth/entrar', { metodo: 'POST', datos: { correo: V.DEMO_CLIENTE_CORREO, clave: V.DEMO_CLIENTE_CLAVE } });
revisar([200, 201].includes(r.s), 'cliente demo creado', JSON.stringify(r.j));
const misAnimales = [];
for (const a of [
  { tipo: 'compania', nombre: 'Toby', especie: 'perros', raza: 'Criollo', edad: '5 años', peso: '14 kg', temperamento: 'juguetón, nervioso con la aguja' },
  { tipo: 'compania', nombre: 'Mía', especie: 'gatos', raza: 'Siamés', edad: '3 años', peso: '4 kg', temperamento: 'tranquila' },
  { tipo: 'compania', nombre: 'Kiwi', especie: 'aves', raza: 'Periquito australiano', edad: '2 años', peso: '35 g', temperamento: 'curioso' },
]) misAnimales.push((await yo('/api/mi/animales', { metodo: 'POST', datos: a })).j.animal);
await yo('/api/mi/direcciones', { metodo: 'POST', datos: { etiqueta: 'Casa', zona: 'norte', barrio: 'Cedritos', direccion: 'Calle 147 # 12-30, apto 402' } });
revisar(misAnimales.length === 3 && misAnimales.every(Boolean), 'animales del cliente demo');

// 3. Clientes con cuenta (28) y sus animales
console.log('Creando clientes…');
const clientes = [];
for (let i = 0; i < 28; i++) {
  const p = persona(i);
  const api = sesion();
  const rr = await api('/api/auth/registro', { metodo: 'POST', datos: { ...p, clave: `Demo-${i}-${Math.floor(azar() * 1e6)}`, aceptaDatos: true } });
  revisar(rr.s === 201, `registro ${p.correo}`, rr.j?.error);
  const animales = [];
  const n = 1 + Math.floor(azar() * 2.2);
  for (let k = 0; k < n; k++) { const ra = await api('/api/mi/animales', { metodo: 'POST', datos: animalAzar() }); if (ra.s === 201) animales.push(ra.j.animal); }
  clientes.push({ ...p, api, animales, id: rr.j?.usuario?.id });
}

// 4. Citas futuras por la web: 52 de clientes con cuenta + 14 de invitados
console.log('Agendando citas por la web…');
const futuras = [];
async function agendarWeb(api, { animal, contacto, cuenta }) {
  const especie = animal.especie;
  const s = servicioPara(especie);
  if (!s) return null;
  const h = await horarioLibre(api, s.id, { desde: 1 });
  if (!h) return null;
  const datos = {
    servicio: s.id, fecha: h.fecha, hora: h.hora, motivo: s.id === 'asesoria-zootecnica' ? 'Asesoría en alimentación del hato' : elegir(MOTIVOS),
    lugar: s.modalidad === 'virtual' ? { contactoVirtual: 'WhatsApp al mismo celular' } : lugar(),
    animal: animal.id ? { id: animal.id } : animal, contacto, cuenta, aceptaDatos: true, aceptaPolitica: true,
  };
  const rr = await api('/api/citas', { metodo: 'POST', form: fdCita(datos, azar() < 0.6) });
  if (rr.s === 409) return null; // horario recién ocupado: se intenta con otro
  revisar(rr.s === 201, `cita web ${s.id}`, JSON.stringify(rr.j));
  return rr.s === 201 ? { ...rr.j.cita, servicio_id: s.id, api } : null;
}
for (let i = 0; futuras.length < 52 && i < 120; i++) {
  const c = clientes[i % clientes.length];
  if (!c.animales.length) continue;
  const cita = await agendarWeb(c.api, { animal: elegir(c.animales) });
  if (cita) futuras.push({ ...cita, cliente: c });
}
let invitados = 0;
for (let i = 0; invitados < 14 && i < 40; i++) {
  const p = persona(100 + i);
  const cita = await agendarWeb(sesion(), { animal: animalAzar(), contacto: p, cuenta: { modo: 'invitado' } });
  if (cita) { futuras.push({ ...cita, invitado: true }); invitados++; }
}
// Citas del cliente demo: una para confirmar, una que se queda pendiente sin comprobante y una virtual
const misFuturas = [];
for (const [a, comp] of [[misAnimales[0], true], [misAnimales[1], false]]) {
  const s = servicioPara(a.especie) && servicios.find((x) => x.id === (a.especie === 'perros' ? 'vacunacion' : 'consulta-general'));
  const h = await horarioLibre(yo, s.id, { desde: 2 });
  const rr = await yo('/api/citas', { metodo: 'POST', form: fdCita({ servicio: s.id, fecha: h.fecha, hora: h.hora, motivo: a.especie === 'perros' ? 'Vacuna anual de rabia' : 'Control general, estornuda mucho', lugar: { zona: 'norte', barrio: 'Cedritos', direccion: 'Calle 147 # 12-30, apto 402' }, animal: { id: a.id }, aceptaDatos: true, aceptaPolitica: true }, comp) });
  revisar(rr.s === 201, 'cita del cliente demo', JSON.stringify(rr.j));
  if (rr.s === 201) misFuturas.push(rr.j.cita);
}
console.log(`  ${futuras.length} citas web de otros clientes (${invitados} de invitados) + ${misFuturas.length} del cliente demo`);

// 5. Citas pasadas (historial) creadas por el admin, completadas y con historia clínica
console.log('Creando historial de citas pasadas…');
const pasadas = [];
const diasPasados = [];
for (let d = sumar(hoyBog(), -1); diasPasados.length < 22; d = sumar(d, -1)) if (habil(d)) diasPasados.push(d);
const idCliente = async (correo) => (await adm(`/api/admin/clientes?q=${encodeURIComponent(correo)}`)).j.clientes[0]?.id;
const conDatos = clientes.filter((c) => c.animales.length);
let slot = 0;
async function citaPasada({ clienteId, animal, servicioId, fecha, hora, estado = 'completada' }) {
  const s = servicios.find((x) => x.id === servicioId);
  const rr = await adm('/api/admin/citas', { metodo: 'POST', datos: { clienteId, animalId: animal.id, servicio: s.id, fecha, hora, motivo: elegir(MOTIVOS), estado: 'confirmada', anticipo: 'recibido', fueraDeHorario: true, lugar: s.modalidad === 'virtual' ? { contactoVirtual: 'WhatsApp' } : lugar() } });
  revisar(rr.s === 201, `cita pasada ${fecha} ${hora}`, JSON.stringify(rr.j));
  if (rr.s !== 201) return null;
  const re = await adm(`/api/admin/citas/${rr.j.cita.id}/estado`, { metodo: 'POST', datos: { estado, avisar: false } });
  revisar(re.j?.cita?.estado === estado, `marcar ${estado}`);
  return rr.j.cita;
}
// Historial del cliente demo
const yoId = await idCliente(V.DEMO_CLIENTE_CORREO);
const historialYo = [
  [misAnimales[0], 'consulta-general', diasPasados[21], '09:00', [['visita', 'Consulta general', 'Buen estado general. Peso 14 kg. Se recomienda limpieza dental en 6 meses.'], ['prescripcion', 'Desparasitante interno', 'Una tableta de 20 kg en dosis única. Repetir en 3 meses.']]],
  [misAnimales[0], 'vacunacion', diasPasados[20], '10:30', [['vacuna', 'Vacuna rabia', 'Lote RB-2291. Aplicada en zona interescapular. Sin reacciones.', 365], ['vacuna', 'Tos de perreras', 'Intranasal. Lote BB-118.', 365]]],
  [misAnimales[1], 'consulta-general', diasPasados[21], '15:00', [['visita', 'Control por estornudos', 'Rinitis leve. Hidratación y vaporizaciones. Control en 15 días si no mejora.'], ['prescripcion', 'Suero oral y vitamina C', '1 ml cada 12 horas por 5 días.']]],
];
for (const [animal, sid, fecha, hora, regs] of historialYo) {
  const c = await citaPasada({ clienteId: yoId, animal, servicioId: sid, fecha, hora });
  for (const [tipo, titulo, detalle, prox] of regs) {
    const rh = await adm(`/api/admin/animales/${animal.id}/historia`, { metodo: 'POST', datos: { tipo, fecha, titulo, detalle, proxima: prox ? sumar(fecha, prox) : '' } });
    revisar(rh.s === 201, 'registro de historia demo');
  }
  if (c) pasadas.push(c);
}
const fdDoc = (nombre) => { const f = new FormData(); f.append('archivo', new Blob([PDF], { type: 'application/pdf' }), 'examen.pdf'); f.append('nombre', nombre); return f; };
revisar((await adm(`/api/admin/animales/${misAnimales[0].id}/documentos`, { metodo: 'POST', form: fdDoc('Cuadro hemático Toby') })).s === 201, 'documento demo');
revisar((await adm(`/api/admin/animales/${misAnimales[1].id}/documentos`, { metodo: 'POST', form: fdDoc('Fórmula médica Mía') })).s === 201, 'documento demo 2');
// Historial de otros clientes
const HORAS_PASADAS = ['08:00', '10:00', '13:00', '15:00'];
for (let i = 0; pasadas.length < 30 && i < 60; i++) {
  const c = conDatos[i % conDatos.length];
  const animal = elegir(c.animales);
  const s = servicioPara(animal.especie);
  if (!s || s.id === 'asesoria-zootecnica') continue;
  const fecha = diasPasados[slot % 20], hora = HORAS_PASADAS[Math.floor(slot / 20) % 4]; slot++;
  const estado = azar() < 0.1 ? 'no_asistio' : 'completada';
  const cita = await citaPasada({ clienteId: c.id, animal, servicioId: s.id, fecha, hora, estado });
  if (!cita) continue;
  pasadas.push(cita);
  if (estado === 'completada') {
    await adm(`/api/admin/animales/${animal.id}/historia`, { metodo: 'POST', datos: { tipo: s.id === 'vacunacion' ? 'vacuna' : 'visita', fecha, titulo: s.id === 'vacunacion' ? 'Vacunación' : s.nombre, detalle: 'Atención a domicilio sin novedades. Recomendaciones entregadas al propietario.', proxima: s.id === 'vacunacion' ? sumar(fecha, 365) : '' } });
  }
}
console.log(`  ${pasadas.length} citas pasadas`);

// 6. El admin trabaja las solicitudes: confirma, cambia horario, no confirma, marca anticipos
console.log('El admin revisa las solicitudes…');
const desde = hoyBog(), hasta = sumar(hoyBog(), 61);
let pend = (await adm(`/api/admin/citas?desde=${desde}&hasta=${hasta}&estado=pendiente`)).j.citas;
revisar(pend.length >= futuras.length, 'el panel ve todas las solicitudes', `${pend.length} vs ${futuras.length}`);
const miIds = new Set(misFuturas.map((c) => c.id));
let conf = 0, rech = 0, repro = 0, ant = 0;
// La primera cita del cliente demo se confirma con anticipo recibido; la segunda se deja pendiente.
if (misFuturas[0]) {
  revisar((await adm(`/api/admin/citas/${misFuturas[0].id}/anticipo`, { metodo: 'POST', datos: { estado: 'recibido' } })).s === 200, 'anticipo demo');
  revisar((await adm(`/api/admin/citas/${misFuturas[0].id}/confirmar`, { metodo: 'POST' })).j?.cita?.estado === 'confirmada', 'confirmar cita demo');
}
for (const c of pend.filter((x) => !miIds.has(x.id))) {
  const p = azar();
  if (c.anticipo_estado === 'por_revisar') { const e = azar() < 0.9 ? 'recibido' : 'no_recibido'; await adm(`/api/admin/citas/${c.id}/anticipo`, { metodo: 'POST', datos: { estado: e } }); ant++; }
  if (p < 0.62) {
    const rr = await adm(`/api/admin/citas/${c.id}/confirmar`, { metodo: 'POST' });
    revisar(rr.j?.cita?.estado === 'confirmada', 'confirmar', JSON.stringify(rr.j)); conf++;
  } else if (p < 0.70) {
    const rr = await adm(`/api/admin/citas/${c.id}/rechazar`, { metodo: 'POST', datos: { motivo: elegir(['No tenemos cobertura en esa dirección', 'El profesional no está disponible ese día; te escribimos para buscar otro horario', 'El servicio no aplica para ese caso; te orientamos por WhatsApp']) } });
    revisar(rr.j?.cita?.estado === 'rechazada', 'rechazar'); rech++;
  } else if (p < 0.78) {
    const h = await horarioLibre(adm, c.servicio_id, { desde: 2 });
    if (h) {
      const rr = await adm(`/api/admin/citas/${c.id}/reprogramar`, { metodo: 'POST', datos: { ...h, avisar: true } });
      revisar(rr.s === 200, 'reprogramar', JSON.stringify(rr.j));
      if (rr.s === 200) { await adm(`/api/admin/citas/${c.id}/confirmar`, { metodo: 'POST' }); repro++; }
    }
  }
}
console.log(`  confirmadas ${conf}, con nuevo horario ${repro}, no confirmadas ${rech}, anticipos revisados ${ant}`);

// 7. Algunos clientes cancelan desde su cuenta
let canc = 0;
for (const f of futuras.filter((x) => !x.invitado).slice(0, 4)) {
  const rr = await f.api(`/api/mi/citas/${f.id}/cancelar`, { metodo: 'POST', datos: { motivo: 'Me surgió un viaje', confirmo: true } });
  if (rr.s === 200) canc++;
}
revisar(canc >= 1, 'clientes cancelan desde su cuenta');

// 8. Verificaciones finales
console.log('Verificando…');
const todas = [...(await adm(`/api/admin/citas?desde=${sumar(hoyBog(), -40)}&hasta=${sumar(hoyBog(), 21)}`)).j.citas, ...(await adm(`/api/admin/citas?desde=${sumar(hoyBog(), 22)}&hasta=${sumar(hoyBog(), 62)}`)).j.citas];
const activas = todas.filter((c) => ['pendiente', 'confirmada'].includes(c.estado));
let cruces = 0;
for (let i = 0; i < activas.length; i++) for (let j = i + 1; j < activas.length; j++) if (activas[i].inicio < activas[j].fin_bloqueo && activas[j].inicio < activas[i].fin_bloqueo) cruces++;
revisar(cruces === 0, 'ninguna cita activa se cruza (incluye 50 min de desplazamiento)', cruces);
const porDia = {};
for (const c of activas) { const d = new Date(c.inicio - 5 * 3600e3).toISOString().slice(0, 10); porDia[d] = (porDia[d] || 0) + 1; }
revisar(Object.values(porDia).every((n) => n <= 5), 'máximo 5 citas activas por día', JSON.stringify(porDia));
const web = todas.filter((c) => c.origen === 'web');
revisar(web.every((c) => habil(new Date(c.inicio - 5 * 3600e3).toISOString().slice(0, 10))), 'citas web solo en días hábiles sin festivos');
revisar(web.every((c) => { const h = new Date(c.inicio - 5 * 3600e3).getUTCHours(); return h >= 8 && h < 18; }), 'citas web dentro del horario 8:00–18:00');
revisar(web.every((c) => c.inicio - c.creado_en >= 24 * 3600e3), 'citas web con 24 h de anticipación');
const muestra = clientes.slice(0, 6);
for (const c of muestra) {
  const res = (await c.api('/api/mi/resumen')).j;
  revisar(res.citas.every((x) => x.usuario_id === c.id), `${c.correo} solo ve sus citas`);
  revisar((await c.api('/api/admin/resumen')).s === 403, `${c.correo} no entra al panel`);
}
const mio = (await yo('/api/mi/resumen')).j;
revisar(mio.animales.length === 3, 'cliente demo: 3 animales');
revisar(mio.citas.some((c) => c.estado === 'confirmada') && mio.citas.some((c) => c.estado === 'pendiente') && mio.citas.filter((c) => c.estado === 'completada').length === 3, 'cliente demo: confirmada, pendiente y 3 completadas', mio.citas.map((c) => c.estado).join(','));
const hist = (await yo(`/api/mi/animales/${misAnimales[0].id}/historia`)).j;
revisar(hist.historia.length === 4 && hist.documentos.length === 1, 'cliente demo ve la historia clínica de Toby');
const resumen = (await adm('/api/admin/resumen')).j;
const act = (await adm('/api/admin/actividad')).j.actividad;
revisar(act.some((a) => a.accion === 'confirmar_cita') && act.some((a) => a.accion === 'rechazar_cita'), 'registro de actividad');

const cuenta = (e) => todas.filter((c) => c.estado === e).length;
console.log(`\nTotal de citas: ${todas.length}  (pendientes ${cuenta('pendiente')}, confirmadas ${cuenta('confirmada')}, completadas ${cuenta('completada')}, no asistió ${cuenta('no_asistio')}, no confirmadas ${cuenta('rechazada')}, canceladas ${cuenta('cancelada')})`);
console.log(`Clientes: ${clientes.length + 1 + invitados} · Panel hoy: ${resumen.hoy.length} citas, ${resumen.pendientes.length} solicitudes, ${resumen.anticipos.length} comprobantes por revisar`);
console.log(`Verificaciones: ${bien} bien, ${mal} mal · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(mal ? 1 : 0);
