// Fechas en Bogotá, festivos de Colombia y cálculo de disponibilidad.
// Bogotá es UTC-5 todo el año (sin horario de verano), así que la conversión es fija.
import { fallo } from './util.js';

export const ZONA = 'America/Bogota';
const DESFASE = 5 * 3600_000;

export const desdeLocal = (fecha, hora = '00:00') => {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, mi) + DESFASE;
};
const local = (ms) => new Date(ms - DESFASE);
export const fechaLocal = (ms) => local(ms).toISOString().slice(0, 10);
export const horaLocal = (ms) => local(ms).toISOString().slice(11, 16);
const diaSemana = (fecha) => new Date(fecha + 'T12:00:00Z').getUTCDay(); // 0 domingo … 6 sábado
const sumarDias = (fecha, n) => new Date(Date.parse(fecha + 'T12:00:00Z') + n * 86400_000).toISOString().slice(0, 10);
const aMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const deMin = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/* ---------- Festivos de Colombia ---------- */
// Domingo de Pascua (algoritmo de Meeus / anónimo gregoriano)
export function pascua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
// Ley Emiliani: si no cae lunes, se pasa al lunes siguiente.
const alLunes = (fecha) => { const d = diaSemana(fecha); return d === 1 ? fecha : sumarDias(fecha, (8 - d) % 7); };

const cacheFestivos = new Map();
export function festivos(y) {
  if (cacheFestivos.has(y)) return cacheFestivos.get(y);
  const f = (m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const p = pascua(y);
  const lista = [
    // Fijos
    f(1, 1), f(5, 1), f(7, 20), f(8, 7), f(12, 8), f(12, 25),
    // Ley Emiliani
    ...[f(1, 6), f(3, 19), f(6, 29), f(8, 15), f(10, 12), f(11, 1), f(11, 11)].map(alLunes),
    // Dependen de la Pascua
    sumarDias(p, -3), sumarDias(p, -2), // Jueves y Viernes Santo
    sumarDias(p, 43), // Ascensión (lunes)
    sumarDias(p, 64), // Corpus Christi (lunes)
    sumarDias(p, 71), // Sagrado Corazón (lunes)
  ];
  const s = new Set(lista);
  cacheFestivos.set(y, s);
  return s;
}
export const esFestivo = (fecha) => festivos(Number(fecha.slice(0, 4))).has(fecha);

/* ---------- Configuración ---------- */
export const CONFIG_DEFECTO = {
  agenda: { dias: [1, 2, 3, 4, 5], inicio: '08:00', fin: '18:00', maxDia: 5, desplazamientoMin: 50, anticipacionHoras: 24, pasoMin: 30, anticipo: 20000 },
  pago: { nequi: '', daviplata: '', transferencia: '' },
};
export async function leerConfig(env, clave) {
  const fila = await env.DB.prepare('SELECT valor FROM config WHERE clave = ?').bind(clave).first();
  const valor = fila ? JSON.parse(fila.valor) : null;
  return CONFIG_DEFECTO[clave] ? { ...CONFIG_DEFECTO[clave], ...(valor || {}) } : valor;
}

/* ---------- Servicios ---------- */
export function servicioDesdeFila(f) {
  return {
    id: f.id, nombre: f.nombre, icono: f.icono, descripcion: f.descripcion,
    especies: JSON.parse(f.especies || '[]'), duracionMin: f.duracion_min, duracionTexto: f.duracion_texto,
    modalidad: f.modalidad, precio: JSON.parse(f.precio), visible: !!f.visible, orden: f.orden,
  };
}
export async function servicioPorId(env, id, { soloVisible = true } = {}) {
  const f = await env.DB.prepare('SELECT * FROM servicios WHERE id = ?').bind(String(id || '')).first();
  if (!f || (soloVisible && !f.visible)) fallo(404, 'Ese servicio no está disponible.');
  return servicioDesdeFila(f);
}
export function precioDe(servicio, zona) {
  const p = servicio.precio;
  if (p.tipo === 'zona') {
    const v = zona === 'fuera' ? p.fueraBogota : p.bogota;
    return { precio: v, texto: `$${v.toLocaleString('es-CO')}` };
  }
  if (p.tipo === 'rango') return { precio: p.desde, texto: `Desde $${p.desde.toLocaleString('es-CO')} hasta $${p.hasta.toLocaleString('es-CO')}${p.domicilioAparte ? ' + domicilio' : ''}` };
  return { precio: p.valor, texto: `$${p.valor.toLocaleString('es-CO')}` };
}

/* ---------- Disponibilidad ---------- */
async function datosRango(env, desde, hasta, excluirId) {
  const [citas, bloqueos] = await Promise.all([
    env.DB.prepare(`SELECT id, inicio, fin_bloqueo FROM citas WHERE estado IN ('pendiente','confirmada') AND inicio < ? AND fin_bloqueo > ? AND id != ?`)
      .bind(hasta, desde, excluirId || 0).all(),
    env.DB.prepare('SELECT desde, hasta FROM bloqueos WHERE desde <= ? AND hasta >= ?').bind(fechaLocal(hasta), fechaLocal(desde)).all(),
  ]);
  // Fase 4: aquí se suman los espacios ocupados del Google Calendar de AmiZoo (freeBusy).
  return { ocupados: citas.results, bloqueos: bloqueos.results };
}

function horariosDia(fecha, servicio, cfg, datos, ahora) {
  if (!cfg.dias.includes(diaSemana(fecha)) || esFestivo(fecha)) return [];
  if (datos.bloqueos.some((b) => b.desde <= fecha && fecha <= b.hasta)) return [];
  const iniDia = desdeLocal(fecha), finDia = iniDia + 86400_000;
  const delDia = datos.ocupados.filter((c) => c.inicio >= iniDia && c.inicio < finDia);
  if (delDia.length >= cfg.maxDia) return [];
  const dur = servicio.duracionMin, bloque = dur + cfg.desplazamientoMin;
  const minimo = ahora + cfg.anticipacionHoras * 3600_000;
  const lista = [];
  for (let m = aMin(cfg.inicio); m + dur <= aMin(cfg.fin); m += cfg.pasoMin) {
    const ini = desdeLocal(fecha, deMin(m));
    if (ini < minimo) continue;
    const finB = ini + bloque * 60_000;
    if (datos.ocupados.some((c) => c.inicio < finB && c.fin_bloqueo > ini)) continue;
    lista.push(deMin(m));
  }
  return lista;
}

export async function horariosDisponibles(env, servicio, fecha, { excluirId = 0 } = {}) {
  const cfg = await leerConfig(env, 'agenda');
  const ini = desdeLocal(fecha);
  const datos = await datosRango(env, ini - 86400_000, ini + 2 * 86400_000, excluirId);
  return horariosDia(fecha, servicio, cfg, datos, Date.now());
}

export async function diasDisponibles(env, servicio, mes, { excluirId = 0 } = {}) {
  const cfg = await leerConfig(env, 'agenda');
  const primero = `${mes}-01`;
  const [y, m] = mes.split('-').map(Number);
  const nDias = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const datos = await datosRango(env, desdeLocal(primero) - 86400_000, desdeLocal(primero) + (nDias + 1) * 86400_000, excluirId);
  const ahora = Date.now();
  const dias = [];
  for (let d = 0; d < nDias; d++) {
    const f = sumarDias(primero, d);
    if (horariosDia(f, servicio, cfg, datos, ahora).length) dias.push(f);
  }
  return dias;
}

// Bloque que ocupa una cita: duración del servicio + desplazamiento.
export async function bloqueCita(env, servicio, fecha, hora) {
  const cfg = await leerConfig(env, 'agenda');
  const inicio = desdeLocal(fecha, hora);
  const fin = inicio + servicio.duracionMin * 60_000;
  return { inicio, fin, finBloqueo: fin + cfg.desplazamientoMin * 60_000, cfg };
}
