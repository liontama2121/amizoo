// Correos con Resend. Sin RESEND_API_KEY (desarrollo) se registran en la consola y no se envían.
import { fechaLocal, horaLocal } from './agenda.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { esc };

export async function enviarCorreo(env, { para, asunto, html, adjuntos }) {
  if (!para) return { ok: false, motivo: 'sin destinatario' };
  if (!env.RESEND_API_KEY) {
    console.log(`[correo simulado] Para: ${para} · Asunto: ${asunto}`);
    return { ok: true, simulado: true };
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.CORREO_REMITENTE || 'AmiZoo <onboarding@resend.dev>',
        to: [para], reply_to: env.CORREO_AMIZOO, subject: asunto, html,
        attachments: adjuntos,
      }),
    });
    if (!r.ok) console.error('Resend', r.status, await r.text());
    return { ok: r.ok };
  } catch (e) {
    console.error('Resend', e);
    return { ok: false };
  }
}

// Plantilla con los colores de la marca (los correos no cargan CSS externo).
export function plantilla(titulo, cuerpo, { boton } = {}) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#F7F8F4;font-family:Arial,Helvetica,sans-serif;color:#34363A;font-size:17px;line-height:1.55">
  <div style="max-width:560px;margin:0 auto;padding:28px 18px">
    <div style="background:#73BEBD;border-radius:22px 22px 0 0;padding:22px 26px;font-weight:800;font-size:22px">AmiZoo 🐾</div>
    <div style="background:#ffffff;border-radius:0 0 22px 22px;padding:26px">
      <h1 style="font-size:24px;margin:0 0 14px">${esc(titulo)}</h1>
      ${cuerpo}
      ${boton ? `<p style="margin:26px 0 6px"><a href="${esc(boton.url)}" style="display:inline-block;background:#EAC72E;color:#34363A;text-decoration:none;font-weight:800;padding:14px 24px;border-radius:999px">${esc(boton.texto)}</a></p>` : ''}
    </div>
    <p style="font-size:14px;margin:18px 6px">Diferentes tamaños, misma importancia.<br>WhatsApp 314 230 0347 · amizoo.contacto@gmail.com<br>No atendemos urgencias.</p>
  </div></body></html>`;
}

const fechaLarga = (ms) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(ms);
const horaTexto = (ms) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit', hour12: true }).format(ms);
export const cuandoTexto = (ms) => `${fechaLarga(ms)}, ${horaTexto(ms)}`;

export const RECOMENDACIONES = `<p><strong>Antes de la visita:</strong></p><ul>
  <li>Ten a la mano el carné de vacunación y el peso actualizado de tu animal.</li>
  <li>Ubica a tu animal en un lugar donde se sienta cómodo y tranquilo.</li></ul>`;

export function tablaCita(c) {
  const fila = (k, v) => (v ? `<tr><td style="padding:6px 10px 6px 0;color:#34363A;opacity:.75;vertical-align:top">${k}</td><td style="padding:6px 0;font-weight:700">${esc(v)}</td></tr>` : '');
  return `<table style="border-collapse:collapse;margin:8px 0 16px">
    ${fila('Código', c.codigo)}${fila('Servicio', c.servicio_nombre)}${fila('Animal', c.animal_nombre ? `${c.animal_nombre} (${c.animal_especie})` : '')}
    ${fila('Fecha', cuandoTexto(c.inicio))}${fila('Dirección', c.direccion ? `${c.direccion}, ${c.barrio}` : c.contacto_virtual ? `Virtual · ${c.contacto_virtual}` : '')}
    ${fila('Valor', c.precio_texto)}${fila('Anticipo', `$${Number(c.anticipo).toLocaleString('es-CO')} (se descuenta del valor)`)}
  </table>`;
}

// Archivo .ics para quien no usa Google Calendar.
export function ics(c, sitio) {
  const f = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const limpio = (s) => String(s ?? '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AmiZoo//Citas//ES', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${c.codigo}@amizoo`, `DTSTAMP:${f(Date.now())}`, `DTSTART:${f(c.inicio)}`, `DTEND:${f(c.fin)}`,
    `SUMMARY:${limpio(`🐾 AmiZoo: ${c.servicio_nombre}${c.animal_nombre ? ` — ${c.animal_nombre}` : ''}`)}`,
    `LOCATION:${limpio(c.direccion ? `${c.direccion}, ${c.barrio}` : 'Virtual')}`,
    `DESCRIPTION:${limpio(`Cita ${c.codigo}. Ver en ${sitio}/mi-cuenta#citas`)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', 'DESCRIPTION:Cita AmiZoo mañana', 'END:VALARM',
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Cita AmiZoo en 1 hora', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

export function enlaceGoogle(c, sitio) {
  const f = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `🐾 AmiZoo: ${c.servicio_nombre}${c.animal_nombre ? ` — ${c.animal_nombre}` : ''}`,
    dates: `${f(c.inicio)}/${f(c.fin)}`,
    ctz: 'America/Bogota',
    location: c.direccion ? `${c.direccion}, ${c.barrio}` : 'Virtual',
    details: `Cita ${c.codigo}. ${sitio}/mi-cuenta#citas`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export { fechaLocal, horaLocal };
