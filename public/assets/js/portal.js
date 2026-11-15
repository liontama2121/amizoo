/* =========================================================
   Portal del cliente: inicio, mis animales, mis citas, historia clínica y mis datos.
   ========================================================= */
(() => {
  'use strict';
  const { api, esc, f, ico, chip, chipAnticipo, ESPECIES, ICONO_ESPECIE, avisar, modal, confirmar, enviar, guia, archivo, camposAnimal, activarCamposAnimal, datosAnimal, calendario } = window.AZ;
  const $ = (s, r = document) => r.querySelector(s);
  const vista = $('[data-vista]');
  let D = null;

  const GUIA = {
    inicio: ['Tu cuenta', 'Aquí ves tu próxima cita y a tus animales. Arriba tienes las pestañas: Mis animales, Mis citas, Historia clínica y Mis datos.'],
    animales: ['Mis animales', 'Estas son las fichas de tus animales. Toca Editar para cambiar sus datos o Cambiar foto para ponerle su foto. Con Agregar animal sumas uno nuevo.'],
    citas: ['Mis citas', 'Aquí están tus citas con su estado. Puedes agregarlas a tu calendario, subir el comprobante, cambiar el horario o cancelar. Recuerda: con menos de 24 horas el anticipo no se devuelve.'],
    historia: ['Historia clínica', 'Aquí ves las visitas, vacunas y fórmulas que registran los doctores, y los documentos para descargar. Elige el animal arriba.'],
    datos: ['Mis datos', 'Aquí cambias tu nombre, tu celular, tus direcciones y tu contraseña.'],
  };

  const proximas = () => D.citas.filter((c) => c.inicio >= Date.now() - 3600_000 && ['pendiente', 'confirmada'].includes(c.estado)).sort((a, b) => a.inicio - b.inicio);
  const pasadas = () => D.citas.filter((c) => !proximas().includes(c));
  const lugar = (c) => (c.direccion ? `${esc(c.direccion)}, ${esc(c.barrio)}` : `Virtual · ${esc(c.contacto_virtual || '')}`);
  const fotoAnimal = (a, clase = 'avatar') => (a.foto_key
    ? `<img class="${clase}" src="${archivo(a.foto_key)}" alt="Foto de ${esc(a.nombre)}" loading="lazy">`
    : `<span class="${clase} ${clase}--icono">${ico(ICONO_ESPECIE[a.especie] || 'paw-print')}</span>`);
  const googleCal = (c) => {
    const t = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const p = new URLSearchParams({ action: 'TEMPLATE', text: `🐾 AmiZoo: ${c.servicio_nombre}${c.animal_nombre ? ` — ${c.animal_nombre}` : ''}`, dates: `${t(c.inicio)}/${t(c.fin)}`, ctz: 'America/Bogota', location: c.direccion ? `${c.direccion}, ${c.barrio}` : 'Virtual', details: `Cita ${c.codigo} con AmiZoo.` });
    return `https://calendar.google.com/calendar/render?${p}`;
  };

  /* ---------- Tarjeta de cita ---------- */
  function tarjetaCita(c, { acciones = true } = {}) {
    const activa = ['pendiente', 'confirmada'].includes(c.estado) && c.inicio > Date.now();
    const necesitaComprobante = activa && ['sin_comprobante', 'no_recibido'].includes(c.anticipo_estado);
    return `<article class="tarjeta-cita tarjeta-cita--${c.estado}">
      <div class="tarjeta-cita__fecha"><span>${esc(f.capital(f.fechaCorta(c.inicio)))}</span><strong>${esc(f.hora(c.inicio))}</strong></div>
      <div class="tarjeta-cita__info">
        <div class="chips">${chip(c.estado)} ${c.anticipo_estado !== 'no_aplica' ? chipAnticipo(c.anticipo_estado) : ''}</div>
        <h3>${esc(c.servicio_nombre)}${c.animal_nombre ? ` · ${esc(c.animal_nombre)}` : ''}</h3>
        <p>${ico('map-pin')} ${lugar(c)}</p>
        <p class="pequeno">Código ${esc(c.codigo)} · ${esc(c.precio_texto || '')}</p>
        ${c.estado === 'pendiente' ? `<p class="pequeno">${ico('hourglass')} Te avisaremos por correo cuando la confirmemos.</p>` : ''}
        ${c.nota_estado && ['rechazada', 'cancelada'].includes(c.estado) ? `<p class="pequeno">${esc(c.nota_estado)}</p>` : ''}
        ${acciones && activa ? `<div class="grupo-botones grupo-botones--chico">
          ${c.estado === 'confirmada' ? `<a class="btn btn-borde" href="${googleCal(c)}" target="_blank" rel="noopener">${ico('google-logo')} Agregar a Google Calendar</a>` : ''}
          ${necesitaComprobante ? `<button class="btn btn-primario" data-comprobante="${c.id}">${ico('upload-simple')} Subir comprobante</button>` : ''}
          <button class="btn btn-borde" data-reprogramar="${c.id}">${ico('calendar-dots')} Cambiar horario</button>
          <button class="btn btn-borde btn-borde--peligro" data-cancelar="${c.id}">${ico('x-circle')} Cancelar</button>
        </div>` : ''}
      </div>
    </article>`;
  }

  /* ---------- Vistas ---------- */
  const VISTAS = {
    inicio() {
      const prox = proximas();
      const pend = prox.filter((c) => ['sin_comprobante', 'no_recibido'].includes(c.anticipo_estado));
      return `
        ${pend.length ? `<div class="aviso">${ico('receipt')}<p>Tienes ${pend.length === 1 ? 'una cita' : `${pend.length} citas`} sin comprobante del anticipo. Súbelo en <a href="#citas">Mis citas</a> para que podamos confirmarla.</p></div>` : ''}
        <div class="portal__dos">
          <section class="panel-caja" aria-labelledby="prox-t">
            <h2 id="prox-t">Tu próxima cita</h2>
            ${prox[0] ? tarjetaCita(prox[0]) : `<div class="vacio">${ico('calendar-blank')}<p>No tienes citas próximas.</p><a class="btn btn-primario" href="/agendar">Agendar una cita</a></div>`}
            ${prox.length > 1 ? `<p><a href="#citas">Ver las ${prox.length} citas próximas</a></p>` : ''}
          </section>
          <section class="panel-caja" aria-labelledby="anim-t">
            <h2 id="anim-t">Tus animales</h2>
            ${D.animales.length ? `<ul class="lista-animales">${D.animales.map((a) => `<li><a href="#historia/${a.id}">${fotoAnimal(a)}<span><strong>${esc(a.nombre)}</strong><small>${esc(ESPECIES[a.especie])}${a.raza ? ` · ${esc(a.raza)}` : ''}</small></span>${ico('caret-right')}</a></li>`).join('')}</ul>`
              : `<div class="vacio">${ico('paw-print')}<p>Aún no tienes animales registrados.</p><button class="btn btn-primario" data-nuevo-animal>Agregar animal</button></div>`}
          </section>
        </div>
        <div class="aviso aviso--menta">${ico('first-aid-kit')}<p><strong>Antes de cada visita:</strong> ten a la mano el carné de vacunación y el peso actualizado de tu animal, y ubícalo en un lugar donde se sienta cómodo y tranquilo.</p></div>`;
    },

    animales() {
      return `<div class="cabeza-fila"><h2>Mis animales</h2><button class="btn btn-primario" data-nuevo-animal>${ico('plus')} Agregar animal</button></div>
        ${D.animales.length ? `<div class="rejilla-animales">${D.animales.map((a) => `
          <article class="ficha-animal">
            ${fotoAnimal(a, 'ficha-animal__foto')}
            <div class="ficha-animal__cuerpo">
              <h3>${esc(a.nombre)}</h3>
              <dl class="datos-cortos">
                <div><dt>Especie</dt><dd>${esc(ESPECIES[a.especie])}</dd></div>
                ${a.tipo === 'produccion' ? `<div><dt>Animales</dt><dd>${esc(a.num_animales)}</dd></div><div><dt>Producción</dt><dd>${esc(a.tipo_produccion)}</dd></div>` : `
                ${a.raza ? `<div><dt>Raza</dt><dd>${esc(a.raza)}</dd></div>` : ''}${a.edad ? `<div><dt>Edad</dt><dd>${esc(a.edad)}</dd></div>` : ''}${a.peso ? `<div><dt>Peso</dt><dd>${esc(a.peso)}</dd></div>` : ''}`}
                ${a.temperamento ? `<div class="ancho"><dt>Temperamento</dt><dd>${esc(a.temperamento)}</dd></div>` : ''}
              </dl>
              <div class="grupo-botones grupo-botones--chico">
                <button class="btn btn-borde" data-editar-animal="${a.id}">${ico('pencil-simple')} Editar</button>
                <label class="btn btn-borde">${ico('camera')} Cambiar foto<input type="file" accept="image/jpeg,image/png,image/webp" data-foto-animal="${a.id}" class="oculto-visual"></label>
                <a class="btn btn-borde" href="#historia/${a.id}">${ico('first-aid-kit')} Historia</a>
              </div>
            </div>
          </article>`).join('')}</div>`
          : `<div class="vacio">${ico('paw-print')}<p>Agrega a tus animales para agendar más rápido.</p></div>`}`;
    },

    citas() {
      const prox = proximas(), pas = pasadas();
      const anticipos = D.citas.filter((c) => c.anticipo_estado !== 'no_aplica');
      return `<h2>Próximas</h2>
        ${prox.length ? `<div class="lista-citas">${prox.map((c) => tarjetaCita(c)).join('')}</div>` : `<div class="vacio">${ico('calendar-blank')}<p>No tienes citas próximas.</p><a class="btn btn-primario" href="/agendar">Agendar una cita</a></div>`}
        <details class="politica"><summary>Política de cancelación</summary>
          <ul><li>Cancela o cambia el horario con <strong>24 horas</strong> de anticipación. Si no se hace a tiempo y el profesional llega al domicilio, no se devuelve el anticipo de ${f.pesos(D.anticipo)}.</li>
          <li>Plan de Medicina Preventiva: con menos de 4 días de anticipación hay un cargo de $15.000; con más de 4 días no tiene costo.</li></ul></details>
        <h2>Pasadas</h2>
        ${pas.length ? `<div class="lista-citas">${pas.map((c) => tarjetaCita(c, { acciones: false })).join('')}</div>` : '<p class="nota">Aquí aparecerán tus citas anteriores.</p>'}
        ${anticipos.length ? `<h2>Mis anticipos</h2>
          <div class="tabla-envuelta"><table class="tabla"><thead><tr><th>Cita</th><th>Fecha</th><th>Valor</th><th>Estado</th></tr></thead><tbody>
          ${anticipos.map((c) => `<tr><td>${esc(c.codigo)} · ${esc(c.servicio_nombre)}</td><td>${esc(f.fechaAnio(c.inicio))}</td><td>${f.pesos(c.anticipo)}</td><td>${chipAnticipo(c.anticipo_estado)}${c.pierde_anticipo ? ' <small>(no reembolsable)</small>' : ''}</td></tr>`).join('')}
          </tbody></table></div>` : ''}`;
    },

    async historia(id) {
      if (!D.animales.length) return `<div class="vacio">${ico('first-aid-kit')}<p>Cuando tengas animales registrados verás aquí su historia clínica.</p></div>`;
      const a = D.animales.find((x) => String(x.id) === String(id)) || D.animales[0];
      const h = await api(`/api/mi/animales/${a.id}/historia`);
      const ICONO = { visita: 'stethoscope', vacuna: 'syringe', prescripcion: 'prescription' };
      const NOMBRE = { visita: 'Visita', vacuna: 'Vacuna', prescripcion: 'Prescripción' };
      return `<div class="selector-animal" role="tablist" aria-label="Elige el animal">${D.animales.map((x) => `<a href="#historia/${x.id}" class="pastilla${x.id === a.id ? ' activa' : ''}" ${x.id === a.id ? 'aria-current="true"' : ''}>${esc(x.nombre)}</a>`).join('')}</div>
        <div class="portal__dos portal__dos--historia">
          <section class="panel-caja"><h2>Registros de ${esc(a.nombre)}</h2>
            ${h.historia.length ? `<ol class="historia-lt">${h.historia.map((r) => `<li class="lt lt--${r.tipo}">
              <span class="lt__icono">${ico(ICONO[r.tipo])}</span>
              <div><p class="pequeno">${esc(NOMBRE[r.tipo])} · ${esc(f.fechaAnio(new Date(r.fecha + 'T12:00:00-05:00')))}</p><h3>${esc(r.titulo)}</h3>
              ${r.detalle ? `<p class="pre">${esc(r.detalle)}</p>` : ''}${r.proxima ? `<p class="chip chip--pendiente">${ico('bell')} Próxima: ${esc(f.fechaAnio(new Date(r.proxima + 'T12:00:00-05:00')))}</p>` : ''}</div></li>`).join('')}</ol>`
              : `<div class="vacio">${ico('notebook')}<p>Todavía no hay registros. Después de cada visita los doctores anotan aquí lo que hicieron.</p></div>`}
          </section>
          <section class="panel-caja"><h2>Documentos</h2>
            ${h.documentos.length ? `<ul class="lista-docs">${h.documentos.map((d) => `<li>${ico(d.tipo_mime === 'application/pdf' ? 'file-pdf' : 'file-image')}<span><strong>${esc(d.nombre)}</strong><small>${esc(f.fechaAnio(d.creado_en))} · ${(d.tamano / 1024 / 1024).toFixed(1)} MB</small></span>
              <a class="btn btn-borde" href="${archivo(d.archivo_key, true)}">${ico('download-simple')} Descargar</a></li>`).join('')}</ul>`
              : '<p class="nota">Aquí aparecerán exámenes, fórmulas y otros documentos.</p>'}
          </section>
        </div>`;
    },

    datos() {
      const u = D.usuario;
      return `<div class="portal__dos">
        <section class="panel-caja"><h2>Tus datos</h2>
          <form data-form-datos>
            <label class="campo-f"><span>Nombre completo</span><input name="nombre" value="${esc(u.nombre)}" maxlength="100" required></label>
            <label class="campo-f"><span>Celular</span><input name="telefono" type="tel" value="${esc(u.telefono)}" required></label>
            <label class="campo-f"><span>Correo</span><input value="${esc(u.correo)}" disabled><small class="ayuda">Para cambiar el correo escríbenos por WhatsApp.</small></label>
            <p class="error-form" data-error hidden role="alert"></p>
            <button class="btn btn-primario" type="submit">Guardar cambios</button>
          </form>
        </section>
        <section class="panel-caja"><h2>Tus direcciones</h2>
          ${D.direcciones.length ? `<ul class="lista-docs">${D.direcciones.map((d) => `<li>${ico('house-line')}<span><strong>${esc(d.etiqueta || 'Dirección')}</strong><small>${esc(d.direccion)}, ${esc(d.barrio)}</small></span><button class="btn btn-borde" data-borrar-dir="${d.id}">${ico('trash')} Quitar</button></li>`).join('')}</ul>` : '<p class="nota">No tienes direcciones guardadas.</p>'}
          <button class="btn btn-borde" data-nueva-dir>${ico('plus')} Agregar dirección</button>
        </section>
        <section class="panel-caja"><h2>Cambiar contraseña</h2>
          <form data-form-clave>
            <label class="campo-f"><span>Contraseña actual</span><input type="password" name="actual" autocomplete="current-password" required></label>
            <label class="campo-f"><span>Contraseña nueva <small>(mínimo 8)</small></span><input type="password" name="nueva" autocomplete="new-password" minlength="8" required></label>
            <p class="error-form" data-error hidden role="alert"></p>
            <button class="btn btn-primario" type="submit">Cambiar contraseña</button>
          </form>
        </section>
      </div>`;
    },
  };

  /* ---------- Navegación ---------- */
  async function mostrar() {
    const [tab, id] = (location.hash.slice(1) || 'inicio').split('/');
    const t = VISTAS[tab] ? tab : 'inicio';
    document.querySelectorAll('[data-tab]').forEach((a) => (a.dataset.tab === t ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    vista.dataset.vista = '';
    try {
      vista.innerHTML = await VISTAS[t](id);
      vista.dataset.vista = t;
    } catch (e) {
      vista.innerHTML = `<div class="aviso">${ico('warning')}<p>${esc(e.message)}</p></div>`;
    }
    guia(...GUIA[t]);
  }

  async function recargar() {
    D = await api('/api/mi/resumen');
    $('[data-saludo]').textContent = `Hola, ${D.usuario.nombre.split(' ')[0]}`;
    await mostrar();
  }

  /* ---------- Acciones ---------- */
  function formAnimal(a) {
    const d = modal({
      titulo: a ? `Editar a ${a.nombre}` : 'Agregar animal', ancho: 'ancho',
      html: `<form data-f>${camposAnimal(a || {})}<p class="error-form" data-error hidden role="alert"></p><div class="grupo-botones"><button class="btn btn-primario" type="submit">Guardar</button><button class="btn btn-borde" type="button" data-cerrar>Cancelar</button></div></form>`,
    });
    const form = $('[data-f]', d);
    activarCamposAnimal(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await enviar(form, (datos) => api(a ? `/api/mi/animales/${a.id}` : '/api/mi/animales', { metodo: a ? 'PATCH' : 'POST', datos: datosAnimal(datos) }));
        d.close(); avisar(a ? 'Datos guardados.' : '¡Animal agregado!'); window.AmizooGuia?.celebrar(); recargar();
      } catch { /* mostrado */ }
    });
  }

  function formDireccion() {
    api('/api/config-publica').then((cfg) => {
      const d = modal({
        titulo: 'Agregar dirección',
        html: `<form data-f>
          <label class="campo-f"><span>Nombre corto</span><input name="etiqueta" maxlength="40" placeholder="Ej: Casa, Finca, Oficina"></label>
          <label class="campo-f"><span>Zona</span><select name="zona" required><option value="">Elige…</option>${cfg.zonas.map((z) => `<option value="${esc(z.id)}">${esc(z.nombre)}</option>`).join('')}</select></label>
          <label class="campo-f"><span>Barrio o municipio</span><input name="barrio" maxlength="80" required></label>
          <label class="campo-f"><span>Dirección</span><input name="direccion" maxlength="160" required></label>
          <p class="error-form" data-error hidden role="alert"></p>
          <div class="grupo-botones"><button class="btn btn-primario" type="submit">Guardar</button><button class="btn btn-borde" type="button" data-cerrar>Cancelar</button></div></form>`,
      });
      const form = $('[data-f]', d);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try { await enviar(form, (x) => api('/api/mi/direcciones', { metodo: 'POST', datos: x })); d.close(); avisar('Dirección guardada.'); recargar(); } catch { /* mostrado */ }
      });
    });
  }

  function subirComprobante(c) {
    const d = modal({
      titulo: 'Subir comprobante',
      html: `<p>Cita ${esc(c.codigo)} · ${esc(c.servicio_nombre)}. Anticipo: <strong>${f.pesos(c.anticipo)}</strong>.</p>
        ${D.pago.nequi || D.pago.daviplata || D.pago.transferencia ? `<ul class="datos-pago">${D.pago.nequi ? `<li>${ico('device-mobile')}<span><strong>Nequi</strong> ${esc(D.pago.nequi)}</span></li>` : ''}${D.pago.daviplata ? `<li>${ico('device-mobile')}<span><strong>Daviplata</strong> ${esc(D.pago.daviplata)}</span></li>` : ''}${D.pago.transferencia ? `<li>${ico('bank')}<span><strong>Transferencia</strong> ${esc(D.pago.transferencia)}</span></li>` : ''}</ul>` : ''}
        <form data-f><label class="subir"><input type="file" name="comprobante" accept="image/jpeg,image/png,image/webp,application/pdf" required><span class="subir__caja">${ico('upload-simple')}<strong data-nombre>Elegir foto o PDF</strong><small>Máximo 5 MB</small></span></label>
        <p class="error-form" data-error hidden role="alert"></p><div class="grupo-botones"><button class="btn btn-primario" type="submit">Enviar comprobante</button></div></form>`,
    });
    const form = $('[data-f]', d);
    const input = $('input[type=file]', form);
    input.addEventListener('change', () => { $('[data-nombre]', form).textContent = input.files[0]?.name || 'Elegir foto o PDF'; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await enviar(form, () => {
          if (input.files[0]?.size > 5 * 1024 * 1024) throw new Error('El archivo pesa más de 5 MB.');
          const fd = new FormData(); fd.append('comprobante', input.files[0]);
          return api(`/api/mi/citas/${c.id}/comprobante`, { metodo: 'POST', form: fd });
        });
        d.close(); avisar('¡Comprobante enviado! Lo revisamos pronto.'); window.AmizooGuia?.celebrar(); recargar();
      } catch { /* mostrado */ }
    });
  }

  // Si la API pide confirmar (menos de 24 h), preguntamos y repetimos con confirmo: true.
  async function conPolitica(ruta, datos, tituloConfirmar) {
    try { return await api(ruta, { metodo: 'POST', datos }); } catch (e) {
      if (e.status === 409 && e.datos?.requiereConfirmar) {
        const ok = await confirmar({ titulo: tituloConfirmar, texto: e.datos.mensaje, si: 'Sí, entiendo', peligro: true });
        if (!ok) return null;
        return api(ruta, { metodo: 'POST', datos: { ...datos, confirmo: true } });
      }
      throw e;
    }
  }

  async function cancelar(c) {
    const ok = await confirmar({ titulo: '¿Cancelar la cita?', texto: `${c.servicio_nombre} del ${f.fecha(c.inicio)} a las ${f.hora(c.inicio)}.`, si: 'Sí, cancelar', no: 'No, mantenerla', peligro: true });
    if (!ok) return;
    try {
      const r = await conPolitica(`/api/mi/citas/${c.id}/cancelar`, {}, 'Faltan menos de 24 horas');
      if (r) { avisar('Cita cancelada.'); recargar(); }
    } catch (e) { avisar(e.message, 'error'); }
  }

  function reprogramar(c) {
    const d = modal({ titulo: 'Cambiar horario', ancho: 'ancho', html: `<p>Elige el nuevo día y hora para <strong>${esc(c.servicio_nombre)}</strong>. La cita vuelve a quedar pendiente hasta que la confirmemos.</p><div class="cuando"><div data-cal></div><div class="horas" data-horas></div></div><p class="error-form" data-error hidden role="alert"></p>` });
    const cont = $('[data-cal]', d), horas = $('[data-horas]', d), err = $('[data-error]', d);
    const hoyMes = f.hoy().slice(0, 7);
    const pintarMes = async (mes) => {
      const r = await api(`/api/disponibilidad?servicio=${c.servicio_id}&mes=${mes}&excluir=${c.id}`);
      calendario(cont, { mes, disponibles: new Set(r.dias), minimoMes: hoyMes, alCambiarMes: pintarMes, alElegir: async (dia) => {
        cont.querySelectorAll('[data-dia]').forEach((b) => b.classList.toggle('sel', b.dataset.dia === dia));
        const h = await api(`/api/disponibilidad?servicio=${c.servicio_id}&fecha=${dia}&excluir=${c.id}`);
        horas.innerHTML = h.horarios.length ? `<h3>${esc(f.capital(f.dia(dia)))}</h3><div class="horas__lista">${h.horarios.map((x) => `<button type="button" class="hora hora--btn" data-h="${x}">${f.horaTexto(x)}</button>`).join('')}</div>` : '<p>Ese día ya no tiene horarios.</p>';
        horas.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', async () => {
          try {
            const r2 = await conPolitica(`/api/mi/citas/${c.id}/reprogramar`, { fecha: dia, hora: b.dataset.h }, 'Faltan menos de 24 horas');
            if (r2) { d.close(); avisar('Listo. Te avisamos cuando confirmemos el nuevo horario.'); recargar(); }
          } catch (e) { err.textContent = e.message; err.hidden = false; }
        }));
      } });
    };
    pintarMes(c.inicio > Date.now() ? f.isoLocal(c.inicio).slice(0, 7) : hoyMes).catch((e) => { err.textContent = e.message; err.hidden = false; });
  }

  vista.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const cita = (k) => D.citas.find((c) => String(c.id) === b.dataset[k]);
    if (b.matches('[data-nuevo-animal]')) formAnimal();
    else if (b.dataset.editarAnimal) formAnimal(D.animales.find((a) => String(a.id) === b.dataset.editarAnimal));
    else if (b.dataset.comprobante) subirComprobante(cita('comprobante'));
    else if (b.dataset.cancelar) cancelar(cita('cancelar'));
    else if (b.dataset.reprogramar) reprogramar(cita('reprogramar'));
    else if (b.matches('[data-nueva-dir]')) formDireccion();
    else if (b.dataset.borrarDir) {
      confirmar({ titulo: '¿Quitar esta dirección?', texto: 'Puedes volver a agregarla cuando quieras.', si: 'Quitar' }).then(async (ok) => {
        if (!ok) return;
        try { await api(`/api/mi/direcciones/${b.dataset.borrarDir}`, { metodo: 'DELETE' }); recargar(); } catch (er) { avisar(er.message, 'error'); }
      });
    }
  });

  vista.addEventListener('change', async (e) => {
    const input = e.target.closest('[data-foto-animal]');
    if (!input?.files[0]) return;
    if (input.files[0].size > 5 * 1024 * 1024) { avisar('La foto pesa más de 5 MB.', 'error'); return; }
    const fd = new FormData(); fd.append('foto', input.files[0]);
    try { await api(`/api/mi/animales/${input.dataset.fotoAnimal}/foto`, { metodo: 'POST', form: fd }); avisar('¡Foto guardada!'); recargar(); }
    catch (er) { avisar(er.message, 'error'); }
  });

  vista.addEventListener('submit', async (e) => {
    const form = e.target;
    e.preventDefault();
    try {
      if (form.matches('[data-form-datos]')) { await enviar(form, (x) => api('/api/mi/datos', { metodo: 'PATCH', datos: x })); avisar('Datos guardados.'); recargar(); }
      if (form.matches('[data-form-clave]')) { await enviar(form, (x) => api('/api/auth/clave', { metodo: 'POST', datos: x })); form.reset(); avisar('Contraseña cambiada.'); }
    } catch { /* mostrado */ }
  });

  /* ---------- Recorrido de Amizoo por el portal ---------- */
  const irTab = async (tab, sel) => {
    if (location.hash.slice(1).split('/')[0] !== tab) location.hash = tab;
    // mostrar() es asíncrono: esperamos a que la pestaña quede pintada
    const t0 = Date.now();
    while (vista.dataset.vista !== tab) {
      if (Date.now() - t0 > 3000) break;
      await new Promise((r) => setTimeout(r, 60));
    }
    void sel;
  };
  function pasosTour() {
    const nombre = D.usuario.nombre.split(' ')[0];
    return [
      { titulo: `¡Te doy la bienvenida, ${nombre}!`, texto: 'Soy Amizoo. Te muestro en un minuto dónde está cada cosa. Toca Siguiente cuando quieras.', antes: () => irTab('inicio') },
      { sel: '.pestanas', titulo: 'Las secciones', texto: 'Estas pestañas son las partes de tu cuenta: Inicio, Mis animales, Mis citas, Historia clínica y Mis datos. Tócalas para cambiar.' },
      { sel: '[data-tour-agendar]', titulo: 'Agendar una cita', texto: 'Con este botón amarillo pides una cita nueva cuando quieras. Yo te acompaño paso a paso.' },
      { sel: () => document.querySelector('#prox-t')?.closest('.panel-caja'), titulo: 'Tu próxima cita', texto: 'Aquí aparece tu próxima visita con la fecha, la hora y la dirección.', antes: () => irTab('inicio') },
      { sel: () => vista.querySelector('.rejilla-animales, .vacio'), titulo: 'Mis animales', texto: 'Aquí ves la ficha de cada animal. Puedes editar sus datos, ponerle foto y agregar otros.', antes: () => irTab('animales') },
      { sel: () => vista.querySelector('[data-nuevo-animal]'), titulo: 'Agregar un animal', texto: 'Con este botón registras a otro animal: perro, gato, ave, conejo… o los animales de tu finca.' },
      { sel: () => vista.querySelector('.lista-citas, .vacio'), titulo: 'Mis citas', texto: 'Aquí están tus citas con su estado. Puedes subir el comprobante del anticipo, cambiar el horario o cancelar. Recuerda avisar con 24 horas.', antes: () => irTab('citas') },
      { sel: () => vista.querySelector('.portal__dos, .vacio'), titulo: 'Historia clínica', texto: 'Después de cada visita los doctores anotan aquí lo que hicieron: vacunas, fórmulas y exámenes que puedes descargar.', antes: () => irTab('historia') },
      { sel: () => vista.querySelector('.portal__dos'), titulo: 'Mis datos', texto: 'Aquí cambias tu nombre, tu celular, tus direcciones y tu contraseña.', antes: () => irTab('datos') },
      { titulo: '¡Listo!', texto: 'Ya conoces tu cuenta. Si me necesitas, estoy en la esquina: tócame y te explico cada pantalla.', antes: async () => { await irTab('inicio'); window.scrollTo({ top: 0, behavior: 'smooth' }); } },
    ];
  }
  const claveTour = () => `amizoo_tour_portal_${D.usuario.id}`;
  function empezarTour() {
    if (!window.AmizooGuia?.tour) return;
    try { localStorage.setItem(claveTour(), '1'); } catch { /* sin almacenamiento */ }
    window.AmizooGuia.tour(pasosTour());
  }
  document.querySelector('[data-ver-tour]')?.addEventListener('click', empezarTour);

  window.addEventListener('hashchange', mostrar);
  recargar().then(() => {
    const pedido = new URLSearchParams(location.search).has('tour');
    let visto = false;
    try { visto = localStorage.getItem(claveTour()) === '1'; } catch { /* nada */ }
    if (pedido) history.replaceState(null, '', location.pathname + location.hash);
    if (pedido || !visto) setTimeout(empezarTour, 700);
  }).catch((e) => { vista.innerHTML = `<div class="aviso">${ico('warning')}<p>${esc(e.message)}</p></div>`; });
})();
