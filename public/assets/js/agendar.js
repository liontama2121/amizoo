/* =========================================================
   Agenda en línea: un paso por pantalla, barra de avance y "Atrás" siempre visible.
   Amizoo explica cada paso. La cita queda "Pendiente de confirmación".
   ========================================================= */
(() => {
  'use strict';
  const { api, esc, f, ico, ESPECIES, ICONO_SERVICIO, camposAnimal, activarCamposAnimal, datosAnimal, calendario, guia, avisar } = window.AZ;

  const $ = (s, r = document) => r.querySelector(s);
  const cuerpo = $('[data-paso-cuerpo]');
  const titulo = $('[data-paso-titulo]');
  const num = $('[data-paso-num]');
  const barra = $('[data-progreso]');
  const btnAtras = $('[data-atras]');
  const btnSeguir = $('[data-seguir]');
  const caja = $('[data-error]');
  const pie = $('[data-pie]');

  const CLAVE = 'amizoo_agenda';
  const guardado = (() => { try { return JSON.parse(sessionStorage.getItem(CLAVE) || 'null'); } catch { return null; } })();
  // Estado de la solicitud (la contraseña y el archivo no se guardan en el navegador).
  const E = Object.assign({ servicio: null, animal: null, lugar: null, fecha: null, hora: null, motivo: '', contacto: {}, cuenta: { modo: 'crear' } }, guardado || {});
  E.comprobante = null;
  E.cuenta.clave = '';
  const persistir = () => { try { const { comprobante, ...resto } = E; sessionStorage.setItem(CLAVE, JSON.stringify({ ...resto, cuenta: { modo: E.cuenta.modo } })); } catch { /* sin almacenamiento */ } };

  let D = { servicios: [], config: null, usuario: null, animales: [], direcciones: [] };
  let paso = 0;
  let mesCal = null;

  const servicio = () => D.servicios.find((s) => s.id === E.servicio);
  const virtual = () => servicio()?.modalidad === 'virtual';
  const precioTexto = (s, zona) => {
    const p = s.precio;
    if (p.tipo === 'zona') return zona ? f.pesos(zona === 'fuera' ? p.fueraBogota : p.bogota) : `${f.pesos(p.bogota)} en Bogotá · ${f.pesos(p.fueraBogota)} fuera`;
    if (p.tipo === 'rango') return `Desde ${f.pesos(p.desde)}${p.domicilioAparte ? ' + domicilio' : ''}`;
    return f.pesos(p.valor);
  };
  const zonaInfo = () => D.config?.zonas.find((z) => z.id === E.lugar?.zona);
  const tarifa = () => (zonaInfo()?.tarifa === 'fueraBogota' ? 'fuera' : 'bogota');
  const nombreAnimal = () => (E.animal?.id ? D.animales.find((a) => a.id === E.animal.id)?.nombre : E.animal?.nombre) || 'tu animal';
  const especieAnimal = () => (E.animal?.id ? D.animales.find((a) => a.id === E.animal.id)?.especie : E.animal?.especie);

  const error = (t) => { caja.textContent = t; caja.hidden = !t; if (t) caja.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };

  /* ---------- Pasos ---------- */
  const PASOS = [
    {
      id: 'servicio', titulo: '¿Qué servicio necesitas?',
      guia: 'Toca el servicio que necesitas. Debajo de cada uno ves el precio y cuánto dura. Luego toca Continuar.',
      html: () => `<div class="opciones-grandes" role="radiogroup" aria-label="Servicios">
        ${D.servicios.map((s) => `
          <label class="opcion-grande">
            <input type="radio" name="servicio" value="${s.id}"${s.id === E.servicio ? ' checked' : ''}>
            <span class="opcion-grande__icono">${ico(ICONO_SERVICIO[s.icono] || 'first-aid')}</span>
            <span class="opcion-grande__txt">
              <strong>${esc(s.nombre)}</strong>
              <span>${esc(precioTexto(s))} · ${esc(s.duracionTexto || `${s.duracionMin} min`)}${s.modalidad === 'virtual' ? ' · Virtual' : ''}</span>
              <small>${s.especies.map((e) => ESPECIES[e]).join(', ')}</small>
            </span>
          </label>`).join('')}
      </div>`,
      validar() {
        const v = $('input[name="servicio"]:checked', cuerpo)?.value;
        if (!v) return 'Elige un servicio para continuar.';
        if (v !== E.servicio) { E.fecha = null; E.hora = null; }
        E.servicio = v;
      },
    },
    {
      id: 'animal', titulo: '¿Para quién es la cita?',
      guia: () => (D.animales.length
        ? 'Toca el animal que vamos a atender. Si es otro, elige Agregar otro animal y llena sus datos.'
        : 'Cuéntanos de tu animal: nombre, especie, edad, peso y cómo es su temperamento. Si es de finca, elige De producción.'),
      html() {
        const s = servicio();
        const validos = D.animales.filter((a) => s.especies.includes(a.especie));
        // Si tiene animales, preseleccionamos el primero que aplique al servicio.
        const elegido = E.animal ? E.animal.id : validos[0]?.id;
        const nuevo = !elegido;
        return `${D.animales.length ? `
          <div class="opciones-grandes opciones-grandes--animales" role="radiogroup" aria-label="Tus animales">
            ${D.animales.map((a) => {
              const ok = s.especies.includes(a.especie);
              return `<label class="opcion-grande${ok ? '' : ' no-aplica'}">
                <input type="radio" name="animalSel" value="${a.id}"${a.id === elegido ? ' checked' : ''}${ok ? '' : ' disabled'}>
                <span class="opcion-grande__icono">${ico(window.AZ.ICONO_ESPECIE[a.especie] || 'paw-print')}</span>
                <span class="opcion-grande__txt"><strong>${esc(a.nombre)}</strong><span>${esc(ESPECIES[a.especie])}${a.raza ? ` · ${esc(a.raza)}` : ''}</span>
                ${ok ? '' : `<small>Este servicio no es para ${esc(ESPECIES[a.especie].toLowerCase())}s</small>`}</span>
              </label>`;
            }).join('')}
            <label class="opcion-grande"><input type="radio" name="animalSel" value="nuevo"${nuevo ? ' checked' : ''}>
              <span class="opcion-grande__icono">${ico('plus')}</span><span class="opcion-grande__txt"><strong>Agregar otro animal</strong><span>Llena sus datos abajo</span></span></label>
          </div>` : ''}
          <div class="bloque-form" data-animal-nuevo${D.animales.length && !nuevo ? ' hidden' : ''}>
            ${camposAnimal(E.animal && !E.animal.id ? { ...E.animal, num_animales: E.animal.numAnimales, tipo_produccion: E.animal.tipoProduccion } : {})}
          </div>
          <p class="nota">${ico('info')} ${esc(s.nombre)} es para: ${s.especies.map((e) => ESPECIES[e].toLowerCase() + 's').join(', ')}.</p>`;
      },
      montar() {
        const bloque = $('[data-animal-nuevo]', cuerpo);
        activarCamposAnimal(bloque);
        cuerpo.querySelectorAll('input[name="animalSel"]').forEach((r) => r.addEventListener('change', () => { bloque.hidden = r.value !== 'nuevo'; }));
      },
      validar() {
        const sel = $('input[name="animalSel"]:checked', cuerpo)?.value;
        if (sel && sel !== 'nuevo') { E.animal = { id: Number(sel) }; return; }
        const bloque = $('[data-animal-nuevo]', cuerpo);
        const campos = [...bloque.querySelectorAll('input, select')].filter((i) => !i.disabled);
        for (const c of campos) if (!c.reportValidity()) return 'Revisa los datos del animal.';
        const d = Object.fromEntries(campos.filter((c) => c.type !== 'radio' || c.checked).map((c) => [c.name, c.value]));
        d.tipo = $('[data-tipo-animal]:checked', bloque)?.value || 'compania';
        const a = datosAnimal(d);
        if (!servicio().especies.includes(a.especie)) return `${servicio().nombre} no está disponible para ${ESPECIES[a.especie]?.toLowerCase()}s. Elige otro servicio en el paso 1.`;
        E.animal = a;
      },
    },
    {
      id: 'lugar', titulo: '¿Dónde será la visita?',
      saltar: () => virtual(),
      guia: 'Elige tu zona y escribe el barrio o municipio y la dirección. Si tu zona no aparece, escríbenos por WhatsApp y miramos si llegamos.',
      html() {
        const dirs = D.direcciones;
        // Si tiene direcciones guardadas, preseleccionamos la primera.
        const l = E.lugar || (dirs.length ? { dirId: dirs[0].id } : {});
        return `${dirs.length ? `<fieldset class="campo-f"><legend>Tus direcciones guardadas</legend><div class="opciones-grandes">
            ${dirs.map((d) => `<label class="opcion-grande"><input type="radio" name="dirSel" value="${d.id}"${l.dirId === d.id ? ' checked' : ''}>
              <span class="opcion-grande__icono">${ico('house-line')}</span><span class="opcion-grande__txt"><strong>${esc(d.etiqueta || 'Dirección')}</strong><span>${esc(d.direccion)}, ${esc(d.barrio)}</span></span></label>`).join('')}
            <label class="opcion-grande"><input type="radio" name="dirSel" value="nueva"${!l.dirId ? ' checked' : ''}><span class="opcion-grande__icono">${ico('plus')}</span><span class="opcion-grande__txt"><strong>Otra dirección</strong></span></label>
          </div></fieldset>` : ''}
          <div data-dir-nueva${dirs.length && l.dirId ? ' hidden' : ''}>
            <fieldset class="campo-f"><legend>Zona</legend>
              <div class="opciones-zonas">
                ${D.config.zonas.map((z) => `<label class="opcion-zona"><input type="radio" name="zona" value="${z.id}"${l.zona === z.id && !l.dirId ? ' checked' : ''}>
                  <strong>${esc(z.nombre)}</strong><small>${esc(z.barrios.slice(0, 6).join(', '))}${z.barrios.length > 6 ? '…' : ''}</small></label>`).join('')}
                <label class="opcion-zona"><input type="radio" name="zona" value="ninguna"><strong>Mi zona no aparece</strong><small>Te ayudamos por WhatsApp</small></label>
              </div>
            </fieldset>
            <div class="aviso" data-fuera hidden>${ico('map-pin')}<p>Por ahora llegamos al norte, occidente y oriente de Bogotá y a la Sabana Norte hasta Sopó. <a href="${esc(window.AZ.wa('3142300347', 'Hola AmiZoo, quiero saber si llegan a mi barrio: '))}">Escríbenos por WhatsApp</a> y revisamos tu dirección.</p></div>
            <div class="rejilla-campos" data-campos-dir>
              <label class="campo-f"><span data-etq-barrio>Barrio o municipio</span><input name="barrio" maxlength="80" list="lista-barrios" value="${esc(l.dirId ? '' : l.barrio)}" required><datalist id="lista-barrios"></datalist></label>
              <label class="campo-f ancho-total"><span>Dirección</span><input name="direccion" maxlength="160" autocomplete="street-address" placeholder="Ej: Calle 140 # 12-34, apto 501" value="${esc(l.dirId ? '' : l.direccion)}" required></label>
              ${D.usuario ? `<label class="casilla ancho-total"><input type="checkbox" name="guardar"${l.guardar ? ' checked' : ''}> <span>Guardar esta dirección en mi cuenta</span></label>` : ''}
            </div>
          </div>
          <p class="nota" data-precio-zona></p>`;
      },
      montar() {
        const nueva = $('[data-dir-nueva]', cuerpo);
        const actualizar = () => {
          const zona = $('input[name="zona"]:checked', cuerpo)?.value;
          const z = D.config.zonas.find((x) => x.id === zona);
          $('[data-fuera]', cuerpo).hidden = zona !== 'ninguna';
          $('[data-campos-dir]', cuerpo).hidden = zona === 'ninguna';
          $('#lista-barrios', cuerpo).innerHTML = (z?.barrios || []).map((b) => `<option value="${esc(b)}">`).join('');
          $('[data-etq-barrio]', cuerpo).textContent = z?.tarifa === 'fueraBogota' ? 'Municipio' : 'Barrio';
          const s = servicio();
          $('[data-precio-zona]', cuerpo).innerHTML = z ? `${ico('tag')} Valor del servicio en esta zona: <strong>${esc(precioTexto(s, z.tarifa === 'fueraBogota' ? 'fuera' : 'bogota'))}</strong>` : '';
        };
        cuerpo.querySelectorAll('input[name="zona"]').forEach((r) => r.addEventListener('change', actualizar));
        cuerpo.querySelectorAll('input[name="dirSel"]').forEach((r) => r.addEventListener('change', () => { nueva.hidden = r.value !== 'nueva'; }));
        actualizar();
      },
      validar() {
        const sel = $('input[name="dirSel"]:checked', cuerpo)?.value;
        if (sel && sel !== 'nueva') {
          const d = D.direcciones.find((x) => String(x.id) === sel);
          E.lugar = { dirId: d.id, zona: d.zona, barrio: d.barrio, direccion: d.direccion };
          return;
        }
        const zona = $('input[name="zona"]:checked', cuerpo)?.value;
        if (!zona) return 'Elige tu zona.';
        if (zona === 'ninguna') return 'Por ahora no tenemos esa zona en línea. Escríbenos por WhatsApp y revisamos tu dirección.';
        const barrio = $('input[name="barrio"]', cuerpo), dir = $('input[name="direccion"]', cuerpo);
        if (!barrio.reportValidity() || !dir.reportValidity()) return 'Completa el barrio y la dirección.';
        E.lugar = { zona, barrio: barrio.value.trim(), direccion: dir.value.trim(), guardar: !!$('input[name="guardar"]', cuerpo)?.checked };
      },
    },
    {
      id: 'cuando', titulo: '¿Qué día y a qué hora?',
      guia: 'Los días en amarillo tienen espacio. Toca un día y luego la hora que te sirva. Atendemos de lunes a viernes, sin festivos.',
      html: () => `<div class="cuando"><div data-cal></div><div class="horas" data-horas aria-live="polite"></div></div>`,
      async montar() {
        const cont = $('[data-cal]', cuerpo);
        const horas = $('[data-horas]', cuerpo);
        const hoyMes = f.hoy().slice(0, 7);
        mesCal = mesCal || (E.fecha ? E.fecha.slice(0, 7) : hoyMes);
        let saltos = 0;
        const pintarHoras = async (fecha) => {
          horas.innerHTML = `<p class="cargando-texto">${ico('circle-notch')} Buscando horarios…</p>`;
          try {
            const r = await api(`/api/disponibilidad?servicio=${encodeURIComponent(E.servicio)}&fecha=${fecha}`);
            if (!r.horarios.length) { horas.innerHTML = '<p>Ese día ya no tiene horarios. Elige otro.</p>'; return; }
            horas.innerHTML = `<h2 class="h-paso">${esc(f.capital(f.dia(fecha)))}</h2><div class="horas__lista" role="radiogroup" aria-label="Horarios">
              ${r.horarios.map((h) => `<label class="hora"><input type="radio" name="hora" value="${h}"${E.fecha === fecha && E.hora === h ? ' checked' : ''}><span>${f.horaTexto(h)}</span></label>`).join('')}</div>`;
            horas.querySelectorAll('input[name="hora"]').forEach((i) => i.addEventListener('change', () => { E.fecha = fecha; E.hora = i.value; persistir(); }));
          } catch (e) { horas.innerHTML = `<p class="error-form">${esc(e.message)}</p>`; }
        };
        const pintarMes = async (mes) => {
          mesCal = mes;
          cont.innerHTML = `<p class="cargando-texto">${ico('circle-notch')} Buscando días disponibles…</p>`;
          let dias = [];
          try { dias = (await api(`/api/disponibilidad?servicio=${encodeURIComponent(E.servicio)}&mes=${mes}`)).dias; }
          catch (e) { cont.innerHTML = `<p class="error-form">${esc(e.message)}</p>`; return; }
          // Si el mes actual ya no tiene espacio, mostramos el siguiente.
          if (!dias.length && saltos < 2 && mes === hoyMes) { saltos++; const [y, m] = mes.split('-').map(Number); return pintarMes(new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7)); }
          const sel = E.fecha && dias.includes(E.fecha) ? E.fecha : null;
          calendario(cont, {
            mes, disponibles: new Set(dias), seleccion: sel, minimoMes: hoyMes,
            alCambiarMes: (m) => pintarMes(m),
            alElegir: (d) => { E.fecha = d; E.hora = null; cont.querySelectorAll('[data-dia]').forEach((b) => { b.classList.toggle('sel', b.dataset.dia === d); b.setAttribute('aria-pressed', String(b.dataset.dia === d)); }); pintarHoras(d); },
          });
          if (!dias.length) cont.insertAdjacentHTML('beforeend', '<p class="nota">Este mes no tiene espacios libres. Mira el mes siguiente.</p>');
          if (sel) pintarHoras(sel); else horas.innerHTML = '<p class="nota">Elige un día en el calendario.</p>';
        };
        pintarMes(mesCal);
      },
      validar() {
        if (!E.fecha || !E.hora) return 'Elige el día y la hora.';
      },
    },
    {
      id: 'datos', titulo: 'Motivo y tus datos',
      guia: () => (D.usuario ? 'Cuéntanos el motivo de la cita: qué síntomas tiene o qué necesitas.' : 'Cuéntanos el motivo de la cita y deja tus datos. Te recomiendo crear tu cuenta: así ves tus citas y la historia de tu animal.'),
      html() {
        const c = E.contacto || {};
        return `<label class="campo-f"><span>¿Cuál es el motivo de la cita?</span><textarea name="motivo" rows="4" maxlength="600" placeholder="Ej: se rasca mucho las orejas desde hace una semana" required>${esc(E.motivo)}</textarea></label>
          ${virtual() ? `<label class="campo-f"><span>¿Por dónde hacemos la videollamada?</span><input name="contactoVirtual" maxlength="120" placeholder="Ej: WhatsApp 300 123 4567 o Google Meet a mi correo" value="${esc(E.lugar?.contactoVirtual)}" required></label>` : ''}
          ${D.usuario ? `<div class="aviso aviso--menta">${ico('user-circle')}<p>Agendas como <strong>${esc(D.usuario.nombre)}</strong> (${esc(D.usuario.correo)}). Te avisaremos a ese correo.</p></div>` : `
          <h2 class="h-paso">Tus datos</h2>
          <div class="rejilla-campos">
            <label class="campo-f"><span>Nombre completo</span><input name="nombre" autocomplete="name" maxlength="100" value="${esc(c.nombre)}" required></label>
            <label class="campo-f"><span>Celular</span><input name="telefono" type="tel" inputmode="tel" autocomplete="tel" value="${esc(c.telefono)}" required></label>
            <label class="campo-f ancho-total"><span>Correo</span><input name="correo" type="email" inputmode="email" autocomplete="email" value="${esc(c.correo)}" required></label>
          </div>
          <fieldset class="campo-f"><legend>¿Creamos tu cuenta?</legend>
            <div class="opciones-grandes opciones-grandes--dos">
              <label class="opcion-grande"><input type="radio" name="modo" value="crear"${E.cuenta.modo !== 'invitado' ? ' checked' : ''}><span class="opcion-grande__icono">${ico('user-plus')}</span>
                <span class="opcion-grande__txt"><strong>Sí, crear mi cuenta</strong><span>Recomendado: ves tus citas y la historia clínica</span></span></label>
              <label class="opcion-grande"><input type="radio" name="modo" value="invitado"${E.cuenta.modo === 'invitado' ? ' checked' : ''}><span class="opcion-grande__icono">${ico('envelope-simple')}</span>
                <span class="opcion-grande__txt"><strong>Seguir sin cuenta</strong><span>Solo con tu correo y celular</span></span></label>
            </div>
          </fieldset>
          <label class="campo-f" data-campo-clave><span>Inventa una contraseña <small>(mínimo 8 caracteres)</small></span><input name="clave" type="password" autocomplete="new-password" minlength="8" maxlength="128" value="${esc(E.cuenta.clave)}"></label>
          <p class="nota">¿Ya tienes cuenta? <a href="/entrar?volver=/agendar">Entra aquí</a> y no pierdes lo que llevas.</p>`}`;
      },
      montar() {
        const clave = $('[data-campo-clave]', cuerpo);
        if (!clave) return;
        const ajustar = () => {
          const crear = $('input[name="modo"]:checked', cuerpo)?.value === 'crear';
          clave.hidden = !crear;
          $('input[name="clave"]', cuerpo).required = crear;
        };
        cuerpo.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener('change', ajustar));
        ajustar();
      },
      validar() {
        const campos = [...cuerpo.querySelectorAll('input, textarea')].filter((i) => !i.closest('[hidden]'));
        for (const c of campos) if (!c.reportValidity()) return 'Revisa los datos marcados.';
        const v = (n) => $(`[name="${n}"]`, cuerpo)?.value.trim();
        E.motivo = v('motivo');
        if (virtual()) E.lugar = { contactoVirtual: v('contactoVirtual') };
        if (!D.usuario) {
          E.contacto = { nombre: v('nombre'), telefono: v('telefono'), correo: v('correo') };
          E.cuenta = { modo: $('input[name="modo"]:checked', cuerpo)?.value || 'crear', clave: $('input[name="clave"]', cuerpo)?.value || '' };
        }
      },
    },
    {
      id: 'anticipo', titulo: 'Separa tu cita',
      guia: () => `La cita se separa con ${f.pesos(D.config.anticipo)}, que se descuentan del valor del servicio. Paga por Nequi, Daviplata o transferencia y sube la foto del comprobante. Si no lo tienes ahora, lo puedes enviar después.`,
      html() {
        const p = D.config.pago;
        const hay = p.nequi || p.daviplata || p.transferencia;
        return `<div class="anticipo">
          <p class="anticipo__monto"><span>Anticipo</span><strong>${f.pesos(D.config.anticipo)}</strong><small>Se descuenta del valor del servicio. El saldo lo pagas en la visita en efectivo o con tarjeta.</small></p>
          ${hay ? `<ul class="datos-pago">
            ${p.nequi ? `<li>${ico('device-mobile')}<span><strong>Nequi</strong> ${esc(p.nequi)}</span></li>` : ''}
            ${p.daviplata ? `<li>${ico('device-mobile')}<span><strong>Daviplata</strong> ${esc(p.daviplata)}</span></li>` : ''}
            ${p.transferencia ? `<li>${ico('bank')}<span><strong>Transferencia</strong> ${esc(p.transferencia).replace(/\n/g, '<br>')}</span></li>` : ''}
          </ul>` : `<div class="aviso">${ico('whatsapp-logo')}<p>Te enviamos los datos de pago por WhatsApp apenas recibamos tu solicitud.</p></div>`}
        </div>
        <label class="subir">
          <input type="file" name="comprobante" accept="image/jpeg,image/png,image/webp,application/pdf">
          <span class="subir__caja">${ico('upload-simple')}<strong data-archivo-nombre>${E.comprobante ? esc(E.comprobante.name) : 'Subir foto del comprobante'}</strong><small>JPG, PNG, WEBP o PDF de máximo 5 MB</small></span>
        </label>
        <p class="nota">${ico('clock')} ¿Pagas después? Puedes continuar y subirlo luego desde Mi cuenta o enviarlo por WhatsApp.</p>`;
      },
      montar() {
        const input = $('input[name="comprobante"]', cuerpo);
        input.addEventListener('change', () => {
          const a = input.files[0];
          error('');
          if (!a) return;
          if (a.size > 5 * 1024 * 1024) { input.value = ''; error('El archivo pesa más de 5 MB. Prueba con una foto más liviana.'); return; }
          if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(a.type)) { input.value = ''; error('Sube una foto JPG, PNG, WEBP o un PDF.'); return; }
          E.comprobante = a;
          $('[data-archivo-nombre]', cuerpo).textContent = a.name;
          window.AmizooGuia?.celebrar();
        });
      },
      validar() { /* opcional */ },
    },
    {
      id: 'resumen', titulo: 'Revisa y confirma',
      guia: 'Revisa que todo esté bien. Lee la política de cancelación, marca las dos casillas y toca Solicitar cita. Nosotros te confirmamos por correo.',
      html() {
        const s = servicio();
        const z = zonaInfo();
        const fila = (k, v, editar) => `<div class="resumen__fila"><dt>${k}</dt><dd>${v}</dd>${editar !== undefined ? `<button type="button" class="enlace-btn" data-ir="${editar}">Cambiar</button>` : ''}</div>`;
        return `<dl class="resumen">
          ${fila('Servicio', `<strong>${esc(s.nombre)}</strong>`, 0)}
          ${fila('Animal', `${esc(nombreAnimal())} · ${esc(ESPECIES[especieAnimal()] || '')}`, 1)}
          ${virtual() ? fila('Videollamada', esc(E.lugar?.contactoVirtual), 4) : fila('Dirección', `${esc(E.lugar.direccion)}, ${esc(E.lugar.barrio)} <small>(${esc(z?.nombre || '')})</small>`, 2)}
          ${fila('Cuándo', `<strong>${esc(f.capital(f.dia(E.fecha)))}</strong>, ${f.horaTexto(E.hora)}`, 3)}
          ${fila('Motivo', esc(E.motivo), 4)}
          ${D.usuario ? '' : fila('Tus datos', `${esc(E.contacto.nombre)} · ${esc(E.contacto.telefono)} · ${esc(E.contacto.correo)}`, 4)}
          ${fila('Valor', `<strong>${esc(precioTexto(s, virtual() ? 'bogota' : tarifa()))}</strong>`)}
          ${fila('Anticipo', `${f.pesos(D.config.anticipo)} · ${E.comprobante ? `comprobante: ${esc(E.comprobante.name)}` : 'lo envías después'}`, 5)}
        </dl>
        <details class="politica" open><summary>Política de cancelación</summary>
          <ul><li>Cancela o reprograma con <strong>24 horas</strong> de anticipación. Si no se hace a tiempo y el profesional llega al domicilio, no se devuelve el anticipo de ${f.pesos(D.config.anticipo)}.</li>
          <li>Plan de Medicina Preventiva: con menos de 4 días de anticipación hay un cargo de $15.000; con más de 4 días no tiene costo.</li></ul>
        </details>
        <label class="casilla"><input type="checkbox" name="aceptaPolitica" required> <span>Leí y acepto la política de cancelación.</span></label>
        <label class="casilla"><input type="checkbox" name="aceptaDatos" required> <span>Autorizo el tratamiento de mis datos personales según la <a href="/politica-de-datos" target="_blank">política de datos</a>.</span></label>`;
      },
      montar() {
        cuerpo.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => ir(Number(b.dataset.ir))));
      },
      validar() {
        for (const c of cuerpo.querySelectorAll('input[type="checkbox"]')) if (!c.reportValidity()) return 'Marca las dos casillas para solicitar la cita.';
      },
    },
  ];

  const visibles = () => PASOS.filter((p) => !p.saltar?.());

  function ir(i, { enfocar = true } = {}) {
    error('');
    paso = Math.max(0, Math.min(i, PASOS.length - 1));
    const p = PASOS[paso];
    const lista = visibles();
    const n = lista.indexOf(p) + 1;
    num.textContent = `Paso ${n} de ${lista.length}`;
    titulo.textContent = p.titulo;
    barra.setAttribute('aria-valuenow', String(n));
    barra.setAttribute('aria-valuemax', String(lista.length));
    barra.firstElementChild.style.width = `${(n / lista.length) * 100}%`;
    cuerpo.innerHTML = p.html();
    p.montar?.();
    btnAtras.innerHTML = paso === 0 ? `${ico('house')} Inicio` : `${ico('arrow-left')} Atrás`;
    btnSeguir.innerHTML = p.id === 'resumen' ? `${ico('paper-plane-tilt')} Solicitar cita` : `Continuar <span class="flecha">${ico('arrow-right')}</span>`;
    guia(`Paso ${n}: ${p.titulo}`, typeof p.guia === 'function' ? p.guia() : p.guia);
    if (enfocar) { titulo.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    history.replaceState(null, '', `#${p.id}`);
    persistir();
  }

  btnAtras.addEventListener('click', () => {
    if (paso === 0) { location.href = '/'; return; }
    let i = paso - 1;
    while (i > 0 && PASOS[i].saltar?.()) i--;
    ir(i);
  });

  btnSeguir.addEventListener('click', async () => {
    const p = PASOS[paso];
    const e = await p.validar?.();
    if (e) { error(e); return; }
    persistir();
    if (p.id === 'resumen') return solicitar();
    let i = paso + 1;
    while (PASOS[i]?.saltar?.()) i++;
    ir(i);
  });

  async function solicitar() {
    const s = servicio();
    const datos = {
      servicio: s.id, animal: E.animal, fecha: E.fecha, hora: E.hora, motivo: E.motivo,
      lugar: virtual() ? { contactoVirtual: E.lugar?.contactoVirtual } : E.lugar,
      contacto: E.contacto, cuenta: E.cuenta, aceptaDatos: true, aceptaPolitica: true,
    };
    const form = new FormData();
    form.append('datos', JSON.stringify(datos));
    if (E.comprobante) form.append('comprobante', E.comprobante);
    btnSeguir.disabled = true;
    btnSeguir.innerHTML = `${ico('circle-notch')} Enviando…`;
    try {
      const r = await api('/api/citas', { metodo: 'POST', form });
      try { sessionStorage.removeItem(CLAVE); } catch { /* nada */ }
      exito(r);
    } catch (e) {
      btnSeguir.disabled = false;
      btnSeguir.innerHTML = `${ico('paper-plane-tilt')} Solicitar cita`;
      if (e.datos?.horarioOcupado) { E.hora = null; ir(PASOS.findIndex((x) => x.id === 'cuando')); error(e.message); return; }
      if (e.datos?.iniciarSesion) { error(''); caja.innerHTML = `${esc(e.message)} <a href="/entrar?volver=/agendar">Entrar</a>`; caja.hidden = false; return; }
      if (e.datos?.enlaceEnviado) { E.cuenta.modo = 'invitado'; }
      error(e.message);
    }
  }

  function exito(r) {
    num.textContent = '¡Listo!';
    titulo.textContent = '¡Recibimos tu solicitud!';
    barra.firstElementChild.style.width = '100%';
    pie.hidden = true;
    cuerpo.innerHTML = `<div class="exito exito--grande">
      ${ico('check-circle')}
      <p class="lead">Tu cita <strong>${esc(r.cita.codigo)}</strong> para el <strong>${esc(f.fecha(r.cita.inicio))} a las ${esc(f.hora(r.cita.inicio))}</strong> quedó <strong>pendiente de confirmación</strong>.</p>
      <p>Te avisaremos por correo cuando la confirmemos. ${r.cita.anticipoEstado === 'por_revisar' ? 'Ya recibimos tu comprobante.' : 'Recuerda enviar el comprobante del anticipo.'}</p>
      ${r.comprobanteFallo ? '<p class="error-form">No pudimos subir el comprobante. Súbelo desde Mi cuenta o envíalo por WhatsApp.</p>' : ''}
      <div class="aviso aviso--menta">${ico('first-aid-kit')}<p><strong>Antes de la visita:</strong> ten a la mano el carné de vacunación y el peso actualizado, y ubica a tu animal en un lugar donde se sienta cómodo y tranquilo.</p></div>
      <div class="grupo-botones">
        ${r.cuenta === 'con_cuenta' ? `<a class="btn btn-primario btn-grande" href="/mi-cuenta#citas">${ico('calendar-check')} Ver mis citas</a>` : `<a class="btn btn-primario btn-grande" href="/registro">${ico('user-plus')} Crear mi cuenta</a>`}
        <a class="btn btn-borde btn-grande" href="/">Volver al inicio</a>
      </div></div>`;
    guia('¡Listo!', '¡Recibimos tu solicitud! Te avisaremos por correo cuando la confirmemos. Gracias por confiar en AmiZoo.');
    window.AmizooGuia?.celebrar();
    history.replaceState(null, '', location.pathname);
    titulo.focus();
  }

  /* ---------- Carga inicial ---------- */
  (async () => {
    try {
      const [serv, config, yo] = await Promise.all([
        api('/api/servicios').catch(() => fetch('/data/servicios.json').then((r) => r.json())),
        api('/api/config-publica'),
        api('/api/auth/yo', { silencioso401: true }).catch(() => ({ usuario: null })),
      ]);
      D.servicios = serv.servicios.filter((s) => s.visible !== false);
      D.config = config;
      if (yo.usuario?.rol === 'cliente') {
        D.usuario = yo.usuario;
        const mi = await api('/api/mi/resumen');
        D.animales = mi.animales;
        D.direcciones = mi.direcciones;
      }
    } catch (e) {
      cuerpo.innerHTML = `<div class="aviso">${ico('warning')}<p>No pudimos cargar la agenda (${esc(e.message)}). Intenta de nuevo o <a href="${window.AZ.wa('3142300347', 'Hola AmiZoo, quiero agendar una cita.')}">agenda por WhatsApp</a>.</p></div>`;
      return;
    }
    const pre = new URLSearchParams(location.search).get('servicio');
    if (pre && D.servicios.some((s) => s.id === pre)) E.servicio = pre;
    if (E.servicio && !D.servicios.some((s) => s.id === E.servicio)) E.servicio = null;
    if (E.animal?.id && !D.animales.some((a) => a.id === E.animal.id)) E.animal = null;
    // Retoma el paso donde iba (si los pasos anteriores tienen datos).
    const hash = location.hash.slice(1);
    const objetivo = PASOS.findIndex((p) => p.id === hash);
    const posible = (i) => (i <= 0 || E.servicio) && (i <= 1 || E.animal) && (i <= 2 || E.lugar || virtual()) && (i <= 3 || E.hora) && (i <= 4 || E.motivo);
    ir(objetivo > 0 && posible(objetivo) && !PASOS[objetivo].saltar?.() && PASOS[objetivo].id !== 'resumen' ? objetivo : pre ? 1 : 0, { enfocar: false });
    if (pre && paso === 1) avisar(`Elegiste ${servicio().nombre}.`);
  })();
})();
