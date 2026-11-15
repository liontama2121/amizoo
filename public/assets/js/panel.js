/* =========================================================
   Panel de control de AmiZoo (solo admin). Pensado para usarlo desde el celular entre visitas.
   Rutas por hash: #inicio, #solicitudes, #agenda[/dia|semana|mes/AAAA-MM-DD], #clientes, #cliente/ID,
   #animal/ID, #servicios, #config, #cuenta, #cita/ID (abre el detalle).
   ========================================================= */
(() => {
  'use strict';
  const { api, esc, f, ico, chip, chipAnticipo, ESPECIES, ESPECIES_PROD, ICONO_ESPECIE, ICONO_SERVICIO, ANTICIPO, avisar, modal, confirmar, enviar, guia, mapa, wa, archivo, camposAnimal, activarCamposAnimal, datosAnimal } = window.AZ;
  const $ = (s, r = document) => r.querySelector(s);
  const vista = $('[data-vista]');
  const DIA = 86400_000;
  let yo = null;
  let cacheServicios = null;
  let cacheConfig = null;

  const GUIA = {
    inicio: ['Inicio del panel', 'Aquí ves las citas de hoy en orden, con la dirección y el botón para abrir Maps. Más abajo están las solicitudes por confirmar y los comprobantes por revisar.'],
    solicitudes: ['Solicitudes', 'Estas citas esperan tu respuesta. Toca una para ver el detalle y el comprobante. Luego Confirmar, Cambiar horario o No confirmar con el motivo; al cliente le llega un correo.'],
    agenda: ['Agenda', 'Cambia entre día, semana y mes. Con Nueva cita registras a quien te escribió por WhatsApp. Toca una cita para cambiar su estado.'],
    clientes: ['Clientes y mascotas', 'Arriba eliges ver Clientes o Mascotas. Escribe en el buscador y la lista se filtra sola: dueño, celular, correo, nombre de la mascota o raza. Toca una especie para ver solo esos animales. En Mascotas ves el próximo control de cada uno.'],
    servicios: ['Servicios y planes', 'Edita precios, duración y especies de cada servicio, u ocúltalo de la página. Abajo están los planes y membresías.'],
    config: ['Configuración', 'Aquí defines el horario, el máximo de citas por día, el tiempo entre citas, los días bloqueados, las zonas y los datos de pago del anticipo.'],
    cuenta: ['Mi cuenta', 'Cambia tu contraseña y revisa quién confirmó, canceló o cambió algo.'],
    cliente: ['Ficha del cliente', 'Aquí están sus datos, sus animales y todas sus citas. Toca un animal para abrir su historia clínica.'],
    animal: ['Historia clínica', 'Registra visitas, vacunas y prescripciones con fecha. Si hay un próximo control o dosis, ponle la fecha. También puedes adjuntar exámenes en PDF o foto. El cliente lo ve en su cuenta.'],
  };

  const servicios = async () => (cacheServicios ||= (await api('/api/admin/servicios')).servicios);
  const config = async () => (cacheConfig ||= await api('/api/admin/config'));
  const fechaIso = (ms) => f.isoLocal(ms);
  const sumar = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * DIA).toISOString().slice(0, 10);
  const lunes = (iso) => { const d = new Date(iso + 'T12:00:00Z').getUTCDay(); return sumar(iso, -((d + 6) % 7)); };
  const lugar = (c) => (c.direccion ? `${esc(c.direccion)}, ${esc(c.barrio)}` : `Virtual · ${esc(c.contacto_virtual || '')}`);
  const animalTxt = (c) => (c.animal_nombre ? `${esc(c.animal_nombre)} (${esc(ESPECIES[c.animal_especie] || c.animal_especie)})` : '');

  /* ---------- Filas de cita ---------- */
  function filaCita(c, { conFecha = false, rapido = false } = {}) {
    return `<li class="fila-cita fila-cita--${c.estado}">
      <button type="button" class="fila-cita__abrir" data-cita="${c.id}" aria-label="Ver cita ${esc(c.codigo)}">
        <span class="fila-cita__hora">${conFecha ? `<small>${esc(f.capital(f.fechaCorta(c.inicio)))}</small>` : ''}${esc(f.hora(c.inicio))}</span>
        <span class="fila-cita__txt"><strong>${esc(c.servicio_nombre)}</strong> · ${animalTxt(c)}<br><small>${esc(c.cliente_nombre)} · ${lugar(c)}</small></span>
        <span class="fila-cita__chips">${chip(c.estado)}${['por_revisar', 'sin_comprobante'].includes(c.anticipo_estado) && c.estado !== 'cerrada' ? chipAnticipo(c.anticipo_estado) : ''}</span>
      </button>
      ${rapido ? `<div class="fila-cita__acciones">
        ${c.direccion ? `<a class="btn btn-borde" href="${mapa(c)}" target="_blank" rel="noopener">${ico('map-trifold')} Abrir en Maps</a>` : ''}
        ${c.cliente_telefono ? `<a class="btn btn-borde" href="${wa(c.cliente_telefono)}" target="_blank" rel="noopener">${ico('whatsapp-logo')} WhatsApp</a>` : ''}
        ${c.estado === 'confirmada' ? `<button class="btn btn-borde" data-estado-rapido="completada" data-id="${c.id}">${ico('check')} Completada</button>` : ''}
      </div>` : ''}
    </li>`;
  }
  const listaCitas = (cs, op) => (cs.length ? `<ul class="lista-filas">${cs.map((c) => filaCita(c, op)).join('')}</ul>` : '');

  /* ---------- Vistas ---------- */
  const VISTAS = {
    async inicio() {
      const r = await api('/api/admin/resumen');
      actualizarGlobito(r.pendientes.length);
      return `<h1 class="h-panel">Hoy, ${esc(f.fecha(Date.now()))}</h1>
        <div class="cifras">
          <a class="cifra" href="#agenda/dia"><strong>${r.hoy.length}</strong><span>citas hoy</span></a>
          <a class="cifra${r.pendientes.length ? ' cifra--alerta' : ''}" href="#solicitudes"><strong>${r.pendientes.length}</strong><span>por confirmar</span></a>
          <a class="cifra${r.anticipos.length ? ' cifra--alerta' : ''}" href="#solicitudes"><strong>${r.anticipos.length}</strong><span>comprobantes por revisar</span></a>
          <a class="cifra" href="#agenda/semana"><strong>${r.semana.length}</strong><span>próximos 7 días</span></a>
        </div>
        ${r.sync.length ? `<div class="aviso">${ico('warning')}<p>${r.sync.length} cita(s) confirmadas sin sincronizar con Google Calendar.</p></div>` : ''}
        <section class="panel-caja"><div class="cabeza-fila"><h2>Citas de hoy</h2><button class="btn btn-primario" data-nueva-cita>${ico('plus')} Nueva cita</button></div>
          ${listaCitas(r.hoy, { rapido: true }) || `<div class="vacio">${ico('coffee')}<p>No hay citas para hoy.</p></div>`}</section>
        <section class="panel-caja panel-caja--alerta"><h2>${ico('bell-ringing')} Solicitudes por confirmar</h2>
          ${listaCitas(r.pendientes, { conFecha: true }) || '<p class="nota">No hay solicitudes pendientes. ¡Al día!</p>'}</section>
        ${r.anticipos.length ? `<section class="panel-caja"><h2>${ico('receipt')} Comprobantes por revisar</h2>${listaCitas(r.anticipos, { conFecha: true })}</section>` : ''}
        <section class="panel-caja"><h2>Próximos 7 días</h2>${listaCitas(r.semana, { conFecha: true }) || '<p class="nota">Sin citas en los próximos días.</p>'}</section>`;
    },

    async solicitudes() {
      const r = await api('/api/admin/resumen');
      actualizarGlobito(r.pendientes.length);
      return `<h1 class="h-panel">Solicitudes</h1>
        <section class="panel-caja panel-caja--alerta"><h2>Por confirmar (${r.pendientes.length})</h2>
          ${r.pendientes.length ? `<div class="tarjetas-solicitud">${r.pendientes.map((c) => `
            <article class="solicitud">
              <div class="solicitud__cab"><strong>${esc(f.capital(f.fecha(c.inicio)))}, ${esc(f.hora(c.inicio))}</strong>${chipAnticipo(c.anticipo_estado)}</div>
              <h3>${esc(c.servicio_nombre)}</h3>
              <p>${ico('paw-print')} ${animalTxt(c)}${c.animal_temperamento ? ` · <em>${esc(c.animal_temperamento)}</em>` : ''}</p>
              <p>${ico('user')} ${esc(c.cliente_nombre)} · ${esc(c.cliente_telefono || '')}</p>
              <p>${ico('map-pin')} ${lugar(c)}</p>
              <p class="pequeno">${ico('chat-text')} ${esc(c.motivo || '')}</p>
              <div class="grupo-botones grupo-botones--chico">
                <button class="btn btn-primario" data-confirmar="${c.id}">${ico('check')} Confirmar</button>
                <button class="btn btn-borde" data-cita="${c.id}">${ico('eye')} Ver detalle</button>
              </div>
            </article>`).join('')}</div>` : `<div class="vacio">${ico('check-circle')}<p>No hay solicitudes pendientes.</p></div>`}
        </section>
        <section class="panel-caja"><h2>Comprobantes por revisar (${r.anticipos.length})</h2>${listaCitas(r.anticipos, { conFecha: true }) || '<p class="nota">Nada por revisar.</p>'}</section>`;
    },

    async agenda(modo = 'dia', fechaSel) {
      const hoy = f.hoy();
      const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaSel || '') ? fechaSel : hoy;
      let desde = fecha, hasta = fecha, tituloRango = f.capital(f.dia(fecha)), ant, sig;
      if (modo === 'semana') { desde = lunes(fecha); hasta = sumar(desde, 6); tituloRango = `Semana del ${f.dia(desde)}`; ant = sumar(desde, -7); sig = sumar(desde, 7); }
      else if (modo === 'mes') {
        desde = fecha.slice(0, 8) + '01';
        const [y, m] = fecha.split('-').map(Number);
        hasta = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
        tituloRango = f.capital(new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(desde + 'T12:00:00Z')));
        ant = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10); sig = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      } else { modo = 'dia'; ant = sumar(fecha, -1); sig = sumar(fecha, 1); }
      const { citas } = await api(`/api/admin/citas?desde=${desde}&hasta=${hasta}`);
      const activas = citas.filter((c) => !['cancelada', 'rechazada'].includes(c.estado));
      let cuerpo = '';
      if (modo === 'dia') {
        cuerpo = listaCitas(citas, { rapido: true }) || `<div class="vacio">${ico('calendar-blank')}<p>Sin citas este día.</p></div>`;
      } else if (modo === 'semana') {
        cuerpo = `<div class="semana">${[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const d = sumar(desde, i);
          const delDia = citas.filter((c) => fechaIso(c.inicio) === d);
          return `<section class="semana__dia${d === hoy ? ' hoy' : ''}"><a class="semana__cab" href="#agenda/dia/${d}">${esc(f.capital(f.fechaCorta(new Date(d + 'T12:00:00-05:00'))))}</a>
            ${listaCitas(delDia) || '<p class="nota">—</p>'}</section>`;
        }).join('')}</div>`;
      } else {
        const vacios = (new Date(desde + 'T12:00:00Z').getUTCDay() + 6) % 7;
        const n = Number(hasta.slice(8));
        let celdas = '<span></span>'.repeat(vacios);
        for (let i = 0; i < n; i++) {
          const d = sumar(desde, i);
          const delDia = activas.filter((c) => fechaIso(c.inicio) === d);
          const pend = delDia.filter((c) => c.estado === 'pendiente').length;
          celdas += `<a class="mes__dia${d === hoy ? ' hoy' : ''}${delDia.length ? ' con' : ''}" href="#agenda/dia/${d}"><span>${i + 1}</span>${delDia.length ? `<b>${delDia.length}</b>` : ''}${pend ? '<i class="punto" title="Pendientes"></i>' : ''}</a>`;
        }
        cuerpo = `<div class="mes"><div class="cal__semana"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div><div class="mes__dias">${celdas}</div></div>
          <p class="nota">El número es la cantidad de citas activas; el punto amarillo indica solicitudes pendientes.</p>`;
      }
      return `<div class="cabeza-fila"><h1 class="h-panel">Agenda</h1><button class="btn btn-primario" data-nueva-cita data-fecha="${fecha}">${ico('plus')} Nueva cita</button></div>
        <div class="agenda-ctrl">
          <div class="segmentado" role="group" aria-label="Vista">${['dia', 'semana', 'mes'].map((m) => `<a href="#agenda/${m}/${fecha}" class="${m === modo ? 'activo' : ''}" ${m === modo ? 'aria-current="true"' : ''}>${{ dia: 'Día', semana: 'Semana', mes: 'Mes' }[m]}</a>`).join('')}</div>
          <div class="agenda-ctrl__nav">
            <a class="btn-icono" href="#agenda/${modo}/${ant}" aria-label="Anterior">${ico('caret-left')}</a>
            <strong>${esc(tituloRango)}</strong>
            <a class="btn-icono" href="#agenda/${modo}/${sig}" aria-label="Siguiente">${ico('caret-right')}</a>
            ${fecha !== hoy ? `<a class="btn btn-borde" href="#agenda/${modo}/${hoy}">Hoy</a>` : ''}
            <label class="oculto-visual" for="ir-fecha">Ir a fecha</label><input id="ir-fecha" type="date" value="${fecha}" data-ir-fecha data-modo="${modo}">
          </div>
        </div>
        <section class="panel-caja">${cuerpo}</section>`;
    },

    // Clientes y mascotas: dos vistas, búsqueda en vivo, filtro por especie y tipo, y orden.
    async clientes() {
      const st = estadoClientes();
      const { conteo } = await api('/api/admin/animales?orden=nombre');
      const total = conteo.reduce((n, c) => n + c.n, 0);
      const porEspecie = {};
      conteo.forEach((c) => { porEspecie[c.especie] = (porEspecie[c.especie] || 0) + c.n; });
      const porTipo = { compania: 0, produccion: 0 };
      conteo.forEach((c) => { porTipo[c.tipo] += c.n; });
      const especies = Object.keys(ESPECIES).filter((e) => porEspecie[e]);
      return `<div class="cabeza-fila"><h1 class="h-panel">Clientes y mascotas</h1><button class="btn btn-primario" data-nuevo-cliente>${ico('user-plus')} Nuevo cliente</button></div>
        <div class="filtros-cli" data-filtros-cli>
          <div class="segmentado segmentado--grande" role="group" aria-label="Ver">
            <button type="button" data-vista-cli="clientes" aria-pressed="${st.vista === 'clientes'}" class="${st.vista === 'clientes' ? 'activo' : ''}">${ico('users-three')} Clientes</button>
            <button type="button" data-vista-cli="mascotas" aria-pressed="${st.vista === 'mascotas'}" class="${st.vista === 'mascotas' ? 'activo' : ''}">${ico('paw-print')} Mascotas <b>${total}</b></button>
          </div>
          <div class="filtros-cli__fila">
            <label class="buscador buscador--vivo"><span class="oculto-visual">Buscar</span>${ico('magnifying-glass')}
              <input type="search" data-filtro-q value="${esc(st.q)}" placeholder="Buscar dueño, celular, correo, mascota o raza" autocomplete="off"></label>
            <label class="campo-orden"><span>Ordenar</span><select data-filtro-orden>${opcionesOrden(st.vista, st.orden)}</select></label>
          </div>
          <div class="chips-especie" role="group" aria-label="Filtrar por especie">
            <button type="button" data-especie="" aria-pressed="${!st.especie}">${ico('squares-four')} Todas <b>${total}</b></button>
            ${especies.map((e) => `<button type="button" data-especie="${e}" aria-pressed="${st.especie === e}">${ico(ICONO_ESPECIE[e] || 'paw-print')} ${ESPECIES[e]}s <b>${porEspecie[e]}</b></button>`).join('')}
          </div>
          <div class="segmentado segmentado--chico" role="group" aria-label="Tipo de animal">
            <button type="button" data-tipo="" class="${!st.tipo ? 'activo' : ''}" aria-pressed="${!st.tipo}">Todos</button>
            <button type="button" data-tipo="compania" class="${st.tipo === 'compania' ? 'activo' : ''}" aria-pressed="${st.tipo === 'compania'}">${ico('heart')} Compañía <b>${porTipo.compania}</b></button>
            <button type="button" data-tipo="produccion" class="${st.tipo === 'produccion' ? 'activo' : ''}" aria-pressed="${st.tipo === 'produccion'}">${ico('barn')} Producción <b>${porTipo.produccion}</b></button>
          </div>
        </div>
        <p class="nota conteo-res" data-conteo-res aria-live="polite"></p>
        <section class="panel-caja" data-resultados>${await resultadosClientes(st)}</section>`;
    },

    async cliente(id) {
      const r = await api(`/api/admin/clientes/${id}`);
      const c = r.cliente;
      return `<p><a href="#clientes">${ico('arrow-left')} Clientes</a></p>
        <div class="cabeza-fila"><h1 class="h-panel">${esc(c.nombre)}</h1><button class="btn btn-primario" data-nueva-cita data-cliente="${c.id}">${ico('calendar-plus')} Nueva cita</button></div>
        <div class="portal__dos">
          <section class="panel-caja"><h2>Datos</h2>
            <form data-form-cliente="${c.id}">
              <label class="campo-f"><span>Nombre</span><input name="nombre" value="${esc(c.nombre)}" required maxlength="100"></label>
              <label class="campo-f"><span>Celular</span><input name="telefono" type="tel" value="${esc(c.telefono)}" required></label>
              <label class="campo-f"><span>Correo</span><input name="correo" type="email" value="${esc(c.correo)}"></label>
              <p class="error-form" data-error hidden role="alert"></p>
              <div class="grupo-botones grupo-botones--chico"><button class="btn btn-primario" type="submit">Guardar</button>
              ${c.telefono ? `<a class="btn btn-borde" href="${wa(c.telefono)}" target="_blank" rel="noopener">${ico('whatsapp-logo')} WhatsApp</a>` : ''}</div>
            </form>
            <p class="nota">${c.tiene_cuenta ? 'Tiene cuenta en la página.' : 'No ha creado cuenta. Si tiene correo, puede crearla con "¿Olvidaste tu contraseña?".'}</p>
            ${r.direcciones.length ? `<h3>Direcciones</h3><ul class="lista-simple">${r.direcciones.map((d) => `<li>${esc(d.etiqueta || '')}: ${esc(d.direccion)}, ${esc(d.barrio)}</li>`).join('')}</ul>` : ''}
          </section>
          <section class="panel-caja"><div class="cabeza-fila"><h2>Animales</h2><button class="btn btn-borde" data-nuevo-animal="${c.id}">${ico('plus')} Agregar</button></div>
            ${r.animales.length ? `<ul class="lista-animales">${r.animales.map((a) => `<li><a href="#animal/${a.id}">${a.foto_key ? `<img class="avatar" src="${archivo(a.foto_key)}" alt="">` : `<span class="avatar avatar--icono">${ico(ICONO_ESPECIE[a.especie] || 'paw-print')}</span>`}
              <span><strong>${esc(a.nombre)}</strong><small>${esc(ESPECIES[a.especie])}${a.tipo === 'produccion' ? ` · ${esc(a.num_animales)} animales · ${esc(a.tipo_produccion)}` : `${a.raza ? ` · ${esc(a.raza)}` : ''}${a.edad ? ` · ${esc(a.edad)}` : ''}`}</small></span>${ico('caret-right')}</a></li>`).join('')}</ul>` : '<p class="nota">Sin animales registrados.</p>'}
          </section>
        </div>
        <section class="panel-caja"><h2>Historial de citas (${r.citas.length})</h2>${listaCitas(r.citas, { conFecha: true }) || '<p class="nota">Sin citas.</p>'}</section>`;
    },

    async animal(id) {
      const r = await api(`/api/admin/animales/${id}/historia`);
      const a = r.animal;
      const ICONO = { visita: 'stethoscope', vacuna: 'syringe', prescripcion: 'prescription' };
      const NOMBRE = { visita: 'Visita', vacuna: 'Vacuna', prescripcion: 'Prescripción' };
      return `<p><a href="#cliente/${a.usuario_id}">${ico('arrow-left')} Volver al cliente</a></p>
        <div class="cabeza-fila"><h1 class="h-panel">${esc(a.nombre)} <small>· ${esc(ESPECIES[a.especie])}</small></h1><button class="btn btn-borde" data-editar-animal="${a.id}">${ico('pencil-simple')} Editar datos</button></div>
        <p class="nota">${a.tipo === 'produccion' ? `Finca · ${esc(a.num_animales)} animales · ${esc(a.tipo_produccion)}` : [a.raza, a.edad, a.peso].filter(Boolean).map(esc).join(' · ')}${a.temperamento ? ` · Temperamento: <strong>${esc(a.temperamento)}</strong>` : ''}</p>
        <div class="portal__dos portal__dos--historia">
          <section class="panel-caja"><h2>Nuevo registro</h2>
            <form data-form-historia="${a.id}">
              <div class="segmentado segmentado--radios" role="radiogroup" aria-label="Tipo">${['visita', 'vacuna', 'prescripcion'].map((t, i) => `<label><input type="radio" name="tipo" value="${t}"${i ? '' : ' checked'}><span>${ico(ICONO[t])} ${NOMBRE[t]}</span></label>`).join('')}</div>
              <div class="rejilla-campos">
                <label class="campo-f"><span>Fecha</span><input type="date" name="fecha" value="${f.hoy()}" required></label>
                <label class="campo-f"><span>Próximo control o dosis <small>(opcional)</small></span><input type="date" name="proxima"></label>
                <label class="campo-f ancho-total"><span>Título</span><input name="titulo" maxlength="120" placeholder="Ej: Consulta por otitis / Vacuna rabia / Fórmula antibiótico" required></label>
                <label class="campo-f ancho-total"><span>Detalle</span><textarea name="detalle" rows="5" maxlength="4000" placeholder="Hallazgos, diagnóstico, dosis, indicaciones…"></textarea></label>
              </div>
              <p class="error-form" data-error hidden role="alert"></p>
              <button class="btn btn-primario" type="submit">${ico('floppy-disk')} Guardar registro</button>
            </form>
            <h2 class="mt">Adjuntar documento</h2>
            <form data-form-doc="${a.id}">
              <label class="campo-f"><span>Nombre del documento</span><input name="nombre" maxlength="120" placeholder="Ej: Cuadro hemático 12 nov"></label>
              <label class="subir"><input type="file" name="archivo" accept="image/jpeg,image/png,image/webp,application/pdf" required><span class="subir__caja">${ico('upload-simple')}<strong data-nombre>Elegir PDF o foto</strong><small>Máximo 5 MB</small></span></label>
              <p class="error-form" data-error hidden role="alert"></p>
              <button class="btn btn-primario" type="submit">${ico('paperclip')} Adjuntar</button>
            </form>
          </section>
          <section class="panel-caja"><h2>Historia clínica</h2>
            ${r.historia.length ? `<ol class="historia-lt">${r.historia.map((h) => `<li class="lt lt--${h.tipo}"><span class="lt__icono">${ico(ICONO[h.tipo])}</span><div>
              <p class="pequeno">${NOMBRE[h.tipo]} · ${esc(f.fechaAnio(new Date(h.fecha + 'T12:00:00-05:00')))}${h.autor ? ` · ${esc(h.autor)}` : ''}</p><h3>${esc(h.titulo)}</h3>
              ${h.detalle ? `<p class="pre">${esc(h.detalle)}</p>` : ''}${h.proxima ? `<p class="chip chip--pendiente">${ico('bell')} Próxima: ${esc(f.fechaAnio(new Date(h.proxima + 'T12:00:00-05:00')))}</p>` : ''}
              <button class="enlace-btn" data-borrar-historia="${h.id}">${ico('trash')} Borrar</button></div></li>`).join('')}</ol>` : '<p class="nota">Sin registros todavía.</p>'}
            <h2 class="mt">Documentos</h2>
            ${r.documentos.length ? `<ul class="lista-docs">${r.documentos.map((d) => `<li>${ico(d.tipo_mime === 'application/pdf' ? 'file-pdf' : 'file-image')}<span><strong>${esc(d.nombre)}</strong><small>${esc(f.fechaAnio(d.creado_en))}</small></span>
              <a class="btn btn-borde" href="${archivo(d.archivo_key)}" target="_blank" rel="noopener">${ico('eye')} Ver</a><button class="btn-icono" data-borrar-doc="${d.id}" aria-label="Borrar ${esc(d.nombre)}">${ico('trash')}</button></li>`).join('')}</ul>` : '<p class="nota">Sin documentos.</p>'}
          </section>
        </div>`;
    },

    async servicios() {
      cacheServicios = null;
      const [lista, cfg] = await Promise.all([servicios(), config()]);
      const precio = (s) => (s.precio.tipo === 'zona' ? `${f.pesos(s.precio.bogota)} Bogotá · ${f.pesos(s.precio.fueraBogota)} fuera` : s.precio.tipo === 'rango' ? `${f.pesos(s.precio.desde)} – ${f.pesos(s.precio.hasta)}` : f.pesos(s.precio.valor));
      const p = cfg.planes;
      return `<div class="cabeza-fila"><h1 class="h-panel">Servicios</h1><button class="btn btn-primario" data-servicio="nuevo">${ico('plus')} Nuevo servicio</button></div>
        <section class="panel-caja"><ul class="lista-filas">${lista.map((s) => `<li class="fila-servicio${s.visible ? '' : ' oculto'}">
          <span class="avatar avatar--icono">${ico(ICONO_SERVICIO[s.icono] || 'first-aid')}</span>
          <span><strong>${esc(s.nombre)}</strong>${s.visible ? '' : ' <span class="chip chip--cerrada">Oculto</span>'}<small>${esc(precio(s))} · ${s.duracionMin} min · ${s.modalidad === 'virtual' ? 'Virtual' : 'A domicilio'}</small><small>${s.especies.map((e) => ESPECIES[e]).join(', ')}</small></span>
          <button class="btn btn-borde" data-servicio="${s.id}">${ico('pencil-simple')} Editar</button></li>`).join('')}</ul></section>
        <h2>Planes y membresías</h2>
        <form class="panel-caja" data-form-planes>
          <h3>${esc(p.preventiva.nombre)}</h3>
          <div class="rejilla-campos">
            <label class="campo-f"><span>Nombre</span><input name="pNombre" value="${esc(p.preventiva.nombre)}" required></label>
            <label class="campo-f"><span>Pago</span><input name="pPago" value="${esc(p.preventiva.pago)}"></label>
            <label class="campo-f ancho-total"><span>Condición</span><input name="pCondicion" value="${esc(p.preventiva.condicion)}"></label>
            <label class="campo-f ancho-total"><span>Incluye <small>(uno por línea)</small></span><textarea name="pIncluye" rows="4">${esc(p.preventiva.incluye.join('\n'))}</textarea></label>
            ${p.preventiva.precios.map((x, i) => `<label class="campo-f"><span>Precio ${esc(x.especie)}</span><input type="hidden" name="pEsp${i}" value="${esc(x.especie)}"><input name="pVal${i}" type="number" min="0" step="100" value="${x.valor}" required></label>`).join('')}
          </div>
          <h3 class="mt">${esc(p.membresias.titulo)}</h3>
          <p class="nota">Deja el precio vacío mientras no esté definido: la página muestra "Escríbenos por WhatsApp".</p>
          <div class="rejilla-membresias">${p.membresias.planes.map((m, i) => `<fieldset class="panel-caja panel-caja--suave"><legend>${esc(m.nombre)}</legend>
            <input type="hidden" name="mId${i}" value="${esc(m.id)}"><input type="hidden" name="mNombre${i}" value="${esc(m.nombre)}">
            <label class="campo-f"><span>Precio mensual</span><input name="mPrecio${i}" type="number" min="0" step="100" value="${m.precioMensual ?? ''}"></label>
            <label class="campo-f"><span>Beneficios <small>(uno por línea)</small></span><textarea name="mBen${i}" rows="4">${esc(m.beneficios.join('\n'))}</textarea></label></fieldset>`).join('')}</div>
          <p class="error-form" data-error hidden role="alert"></p>
          <button class="btn btn-primario" type="submit">Guardar planes</button>
        </form>`;
    },

    async config() {
      cacheConfig = null;
      const c = await config();
      const a = c.agenda;
      const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      return `<h1 class="h-panel">Configuración</h1>
        <div class="portal__dos">
          <form class="panel-caja" data-form-agenda><h2>${ico('clock')} Horario y agenda</h2>
            <fieldset class="campo-f"><legend>Días de atención</legend><div class="opciones-fila">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="opcion-chica"><input type="checkbox" name="dias" value="${d}"${a.dias.includes(d) ? ' checked' : ''}> ${DIAS[d]}</label>`).join('')}</div>
              <small class="ayuda">Los festivos de Colombia se bloquean solos.</small></fieldset>
            <div class="rejilla-campos">
              <label class="campo-f"><span>Abre</span><input type="time" name="inicio" value="${a.inicio}" required></label>
              <label class="campo-f"><span>Cierra</span><input type="time" name="fin" value="${a.fin}" required></label>
              <label class="campo-f"><span>Máximo de citas por día</span><input type="number" name="maxDia" min="1" max="20" value="${a.maxDia}" required></label>
              <label class="campo-f"><span>Minutos de desplazamiento entre citas</span><input type="number" name="desplazamientoMin" min="0" max="240" value="${a.desplazamientoMin}" required></label>
              <label class="campo-f"><span>Anticipación mínima (horas)</span><input type="number" name="anticipacionHoras" min="0" max="720" value="${a.anticipacionHoras}" required></label>
              <label class="campo-f"><span>Horarios cada</span><select name="pasoMin">${[15, 20, 30, 60].map((m) => `<option value="${m}"${a.pasoMin === m ? ' selected' : ''}>${m} minutos</option>`).join('')}</select></label>
              <label class="campo-f"><span>Anticipo para separar</span><input type="number" name="anticipo" min="0" step="1000" value="${a.anticipo}" required></label>
            </div>
            <p class="error-form" data-error hidden role="alert"></p>
            <button class="btn btn-primario" type="submit">Guardar horario</button>
          </form>
          <section class="panel-caja"><h2>${ico('calendar-x')} Días bloqueados</h2>
            <p class="nota">Vacaciones, capacitaciones o días libres. Esos días no se ofrecen en la agenda.</p>
            ${c.bloqueos.length ? `<ul class="lista-docs">${c.bloqueos.map((b) => `<li>${ico('prohibit')}<span><strong>${esc(f.fechaAnio(new Date(b.desde + 'T12:00:00-05:00')))}${b.hasta !== b.desde ? ` al ${esc(f.fechaAnio(new Date(b.hasta + 'T12:00:00-05:00')))}` : ''}</strong><small>${esc(b.motivo || '')}</small></span><button class="btn-icono" data-borrar-bloqueo="${b.id}" aria-label="Quitar bloqueo">${ico('trash')}</button></li>`).join('')}</ul>` : ''}
            <form data-form-bloqueo><div class="rejilla-campos">
              <label class="campo-f"><span>Desde</span><input type="date" name="desde" min="${f.hoy()}" required></label>
              <label class="campo-f"><span>Hasta</span><input type="date" name="hasta" min="${f.hoy()}"></label>
              <label class="campo-f ancho-total"><span>Motivo <small>(opcional)</small></span><input name="motivo" maxlength="120"></label></div>
              <p class="error-form" data-error hidden role="alert"></p>
              <button class="btn btn-primario" type="submit">Bloquear</button></form>
          </section>
          <form class="panel-caja" data-form-pago><h2>${ico('wallet')} Datos de pago del anticipo</h2>
            <label class="campo-f"><span>Nequi</span><input name="nequi" value="${esc(c.pago.nequi)}" maxlength="40" placeholder="Número"></label>
            <label class="campo-f"><span>Daviplata</span><input name="daviplata" value="${esc(c.pago.daviplata)}" maxlength="40" placeholder="Número"></label>
            <label class="campo-f"><span>Transferencia</span><textarea name="transferencia" rows="3" maxlength="400" placeholder="Banco, tipo y número de cuenta, titular">${esc(c.pago.transferencia)}</textarea></label>
            <p class="error-form" data-error hidden role="alert"></p>
            <button class="btn btn-primario" type="submit">Guardar datos de pago</button>
          </form>
          <section class="panel-caja"><h2>${ico('google-logo')} Google Calendar</h2>
            <p><span class="chip chip--cerrada">Desconectado</span></p>
            <p class="nota">La conexión con el calendario de AmiZoo se activa en la Fase 4. Mientras tanto, al confirmar una cita el cliente recibe el correo con el archivo .ics y el botón "Agregar a Google Calendar".</p>
          </section>
        </div>
        <form class="panel-caja" data-form-zonas><h2>${ico('map-pin-area')} Zonas de cobertura</h2>
          ${c.zonas.pendienteConfirmar ? `<div class="aviso">${ico('warning')}<p><strong>Pendiente de confirmar:</strong> ${esc(c.zonas.pendienteConfirmar)}</p></div>` : ''}
          <div class="rejilla-membresias" data-zonas>${c.zonas.zonas.map((z, i) => filaZona(z, i)).join('')}</div>
          <button class="btn btn-borde" type="button" data-agregar-zona>${ico('plus')} Agregar zona</button>
          <p class="error-form" data-error hidden role="alert"></p>
          <button class="btn btn-primario" type="submit">Guardar zonas</button>
        </form>`;
    },

    async cuenta() {
      const r = await api('/api/admin/actividad');
      return `<h1 class="h-panel">Mi cuenta</h1>
        <div class="portal__dos">
          <form class="panel-caja" data-form-clave><h2>Cambiar contraseña</h2>
            <p class="nota">${esc(yo.nombre)} · ${esc(yo.correo)}</p>
            <label class="campo-f"><span>Contraseña actual</span><input type="password" name="actual" autocomplete="current-password" required></label>
            <label class="campo-f"><span>Contraseña nueva <small>(mínimo 12)</small></span><input type="password" name="nueva" autocomplete="new-password" minlength="12" required></label>
            <p class="error-form" data-error hidden role="alert"></p>
            <button class="btn btn-primario" type="submit">Cambiar contraseña</button>
          </form>
          <section class="panel-caja"><h2>Registro de actividad</h2>
            ${r.actividad.length ? `<ul class="actividad">${r.actividad.map((x) => `<li><small>${esc(f.fechaCorta(x.creado_en))} ${esc(f.hora(x.creado_en))} · ${esc(x.usuario || '')}</small><span><strong>${esc(x.accion.replace(/_/g, ' '))}</strong>${x.detalle ? ` · ${esc(x.detalle)}` : ''}</span></li>`).join('')}</ul>` : '<p class="nota">Sin actividad todavía.</p>'}
          </section>
        </div>`;
    },
  };

  /* ---------- Clientes y mascotas: estado, resultados y filtros ---------- */
  function estadoClientes() {
    const p = new URLSearchParams(location.hash.split('?')[1] || '');
    const vista = p.get('vista') === 'mascotas' ? 'mascotas' : 'clientes';
    return { vista, q: p.get('q') || '', especie: p.get('especie') || '', tipo: p.get('tipo') || '', orden: p.get('orden') || (vista === 'mascotas' ? 'especie' : 'nombre') };
  }
  function guardarEstado(st) {
    const p = new URLSearchParams();
    Object.entries(st).forEach(([k, v]) => { if (v) p.set(k, v); });
    history.replaceState(null, '', `#clientes?${p}`);
  }
  function opcionesOrden(vista, sel) {
    const ops = vista === 'mascotas'
      ? [['especie', 'Agrupadas por especie'], ['nombre', 'Nombre (A-Z)'], ['proximo', 'Próximo control o vacuna'], ['reciente', 'Última visita']]
      : [['nombre', 'Nombre (A-Z)'], ['reciente', 'Última cita'], ['animales', 'Más mascotas'], ['nuevo', 'Clientes nuevos']];
    return ops.map(([v, t]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${t}</option>`).join('');
  }
  const qs = (st) => new URLSearchParams(Object.entries({ q: st.q, especie: st.especie, tipo: st.tipo, orden: st.orden }).filter(([, v]) => v)).toString();
  const resaltar = (texto, q) => {
    const t = esc(texto || '');
    if (!q || q.length < 2) return t;
    const i = String(texto || '').toLowerCase().indexOf(q.toLowerCase());
    return i < 0 ? t : `${esc(texto.slice(0, i))}<mark>${esc(texto.slice(i, i + q.length))}</mark>${esc(texto.slice(i + q.length))}`;
  };
  const avatarAnimal = (a) => (a.foto_key ? `<img class="avatar" src="${archivo(a.foto_key)}" alt="" loading="lazy">` : `<span class="avatar avatar--icono avatar--${a.especie}">${ico(ICONO_ESPECIE[a.especie] || 'paw-print')}</span>`);
  const pronto = (iso) => iso && (Date.parse(iso + 'T12:00:00-05:00') - Date.now()) < 30 * DIA;

  async function resultadosClientes(st) {
    if (st.vista === 'mascotas') {
      const { animales } = await api(`/api/admin/animales?${qs(st)}`);
      const n = animales.length;
      const cab = `<p class="conteo-res">${n} ${n === 1 ? 'mascota' : 'mascotas'}${st.q ? ` para "${esc(st.q)}"` : ''}</p>`;
      if (!n) return `${cab}<div class="vacio">${ico('paw-print')}<p>No encontramos mascotas con esos filtros.</p></div>`;
      const tarjeta = (a) => `<li><a class="tarjeta-mascota" href="#animal/${a.id}">
          ${avatarAnimal(a)}
          <span class="tarjeta-mascota__txt">
            <strong>${resaltar(a.nombre, st.q)}</strong>
            <small>${esc(ESPECIES[a.especie])}${a.tipo === 'produccion' ? ` · ${esc(a.num_animales)} animales · ${resaltar(a.tipo_produccion, st.q)}` : `${a.raza ? ` · ${resaltar(a.raza, st.q)}` : ''}${a.edad ? ` · ${esc(a.edad)}` : ''}${a.peso ? ` · ${esc(a.peso)}` : ''}`}</small>
            <small>${ico('user')} ${resaltar(a.dueno, st.q)}${a.dueno_telefono ? ` · ${resaltar(a.dueno_telefono, st.q)}` : ''}</small>
            ${a.temperamento ? `<small class="temperamento">${ico('warning-circle')} ${esc(a.temperamento)}</small>` : ''}
            <span class="chips">
              ${a.proximo_control ? `<span class="chip ${pronto(a.proximo_control) ? 'chip--pendiente' : 'chip--confirmada'}">${ico('bell')} Control ${esc(f.fechaCorta(new Date(a.proximo_control + 'T12:00:00-05:00')))}</span>` : ''}
              ${a.proxima_cita ? `<span class="chip chip--confirmada">${ico('calendar-check')} Cita ${esc(f.fechaCorta(a.proxima_cita))}</span>` : ''}
              ${a.ultima_visita ? `<span class="chip chip--cerrada">Última visita ${esc(f.fechaCorta(a.ultima_visita))}</span>` : '<span class="chip chip--cerrada">Sin visitas</span>'}
            </span>
          </span></a></li>`;
      if (st.orden === 'especie' && !st.especie) {
        const grupos = {};
        animales.forEach((a) => { (grupos[a.especie] ||= []).push(a); });
        return cab + Object.keys(ESPECIES).filter((e) => grupos[e]).map((e) => `<section class="grupo-especie">
            <h2 class="grupo-especie__titulo">${ico(ICONO_ESPECIE[e] || 'paw-print')} ${ESPECIES[e]}s <span>${grupos[e].length}</span></h2>
            <ul class="rejilla-mascotas">${grupos[e].map(tarjeta).join('')}</ul></section>`).join('');
      }
      return `${cab}<ul class="rejilla-mascotas">${animales.map(tarjeta).join('')}</ul>`;
    }
    const { clientes } = await api(`/api/admin/clientes?${qs(st)}`);
    const n = clientes.length;
    const cab = `<p class="conteo-res">${n} ${n === 1 ? 'cliente' : 'clientes'}${st.q ? ` para "${esc(st.q)}"` : ''}${st.especie ? ` con ${esc(ESPECIES[st.especie].toLowerCase())}s` : ''}</p>`;
    if (!n) return `${cab}<div class="vacio">${ico('users-three')}<p>${st.q || st.especie || st.tipo ? 'No encontramos clientes con esos filtros.' : 'Todavía no hay clientes.'}</p></div>`;
    return `${cab}<ul class="lista-filas">${clientes.map((c) => `<li><a class="fila-cliente" href="#cliente/${c.id}">
        <span class="avatar avatar--icono">${ico('user')}</span>
        <span><strong>${resaltar(c.nombre, st.q)}</strong>
          <small>${resaltar(c.telefono || '', st.q)}${c.correo ? ` · ${resaltar(c.correo, st.q)}` : ''}</small>
          <span class="mini-mascotas">${c.animales.length ? c.animales.map((a) => `<span class="mini-mascota${st.especie === a.especie ? ' activa' : ''}">${ico(ICONO_ESPECIE[a.especie] || 'paw-print')} ${resaltar(a.nombre, st.q)}</span>`).join('') : '<small>Sin mascotas registradas</small>'}</span>
          <small>${c.n_citas} ${c.n_citas === 1 ? 'cita' : 'citas'}${c.ultima_cita ? ` · Última: ${esc(f.fechaCorta(c.ultima_cita))}` : ''}${c.proxima_cita ? ` · <strong>Próxima: ${esc(f.fechaCorta(c.proxima_cita))}</strong>` : ''}</small>
        </span>
        ${c.tiene_cuenta ? '<span class="chip chip--confirmada">Con cuenta</span>' : '<span class="chip chip--cerrada">Sin cuenta</span>'}</a></li>`).join('')}</ul>`;
  }

  let turnoFiltro = null;
  async function refrescarClientes(cambios = {}, { inmediato = false } = {}) {
    const st = { ...estadoClientes(), ...cambios };
    guardarEstado(st);
    const caja = $('[data-resultados]');
    if (!caja) return;
    clearTimeout(turnoFiltro);
    turnoFiltro = setTimeout(async () => {
      caja.setAttribute('aria-busy', 'true');
      try { caja.innerHTML = await resultadosClientes(st); } catch (e) { caja.innerHTML = `<div class="aviso">${ico('warning')}<p>${esc(e.message)}</p></div>`; }
      caja.removeAttribute('aria-busy');
    }, inmediato ? 0 : 220);
  }

  const filaZona = (z, i) => `<fieldset class="panel-caja panel-caja--suave" data-zona><legend>Zona ${i + 1}</legend>
    <input type="hidden" name="id" value="${esc(z.id || '')}">
    <label class="campo-f"><span>Nombre</span><input name="nombre" value="${esc(z.nombre || '')}" required maxlength="60"></label>
    <label class="campo-f"><span>Tarifa</span><select name="tarifa"><option value="bogota"${z.tarifa !== 'fueraBogota' ? ' selected' : ''}>Bogotá</option><option value="fueraBogota"${z.tarifa === 'fueraBogota' ? ' selected' : ''}>Fuera de Bogotá</option></select></label>
    <label class="campo-f"><span>Barrios o municipios <small>(uno por línea)</small></span><textarea name="barrios" rows="5">${esc((z.barrios || []).join('\n'))}</textarea></label>
    <button type="button" class="enlace-btn" data-quitar-zona>${ico('trash')} Quitar zona</button></fieldset>`;

  /* ---------- Detalle de cita ---------- */
  async function abrirCita(id) {
    let r;
    try { r = await api(`/api/admin/citas/${id}`); } catch (e) { avisar(e.message, 'error'); return; }
    const c = r.cita;
    const activa = ['pendiente', 'confirmada'].includes(c.estado);
    const esImagen = c.comprobante_key && !c.comprobante_key.endsWith('.pdf');
    const d = modal({
      titulo: `${c.servicio_nombre} · ${c.codigo}`, ancho: 'ancho',
      html: `<div class="chips">${chip(c.estado)} ${chipAnticipo(c.anticipo_estado)} ${c.origen === 'manual' ? '<span class="chip chip--cerrada">Creada en el panel</span>' : ''}</div>
        <dl class="resumen resumen--panel">
          <div class="resumen__fila"><dt>Cuándo</dt><dd><strong>${esc(f.capital(f.fecha(c.inicio)))}, ${esc(f.hora(c.inicio))}</strong> a ${esc(f.hora(c.fin))}</dd></div>
          <div class="resumen__fila"><dt>Dónde</dt><dd>${lugar(c)}${c.direccion ? ` <a href="${mapa(c)}" target="_blank" rel="noopener">${ico('map-trifold')} Maps</a>` : ''}</dd></div>
          <div class="resumen__fila"><dt>Cliente</dt><dd><a href="#cliente/${c.usuario_id}">${esc(c.cliente_nombre)}</a> · ${c.cliente_telefono ? `<a href="${wa(c.cliente_telefono)}" target="_blank" rel="noopener">${ico('whatsapp-logo')} ${esc(c.cliente_telefono)}</a>` : ''} ${c.cliente_correo ? `· ${esc(c.cliente_correo)}` : ''}</dd></div>
          <div class="resumen__fila"><dt>Animal</dt><dd>${c.animal_id ? `<a href="#animal/${c.animal_id}">${animalTxt(c)}</a>` : '—'} ${c.animal_tipo === 'produccion' ? `· ${esc(c.animal_num)} animales · ${esc(c.animal_produccion)}` : [c.animal_raza, c.animal_edad, c.animal_peso].filter(Boolean).map((x) => ` · ${esc(x)}`).join('')}</dd></div>
          ${c.animal_temperamento ? `<div class="resumen__fila"><dt>Temperamento</dt><dd><strong>${esc(c.animal_temperamento)}</strong></dd></div>` : ''}
          <div class="resumen__fila"><dt>Motivo</dt><dd class="pre">${esc(c.motivo || '—')}</dd></div>
          <div class="resumen__fila"><dt>Valor</dt><dd>${esc(c.precio_texto || '')} · anticipo ${f.pesos(c.anticipo)}${c.pierde_anticipo ? ' <strong>(no reembolsable)</strong>' : ''}</dd></div>
          ${c.nota_estado ? `<div class="resumen__fila"><dt>Nota</dt><dd>${esc(c.nota_estado)}</dd></div>` : ''}
        </dl>
        <section class="comprobante"><h3>Anticipo: ${esc(ANTICIPO[c.anticipo_estado])}</h3>
          ${c.comprobante_key ? (esImagen ? `<a href="${archivo(c.comprobante_key)}" target="_blank" rel="noopener"><img src="${archivo(c.comprobante_key)}" alt="Comprobante de pago" class="comprobante__img"></a>` : `<a class="btn btn-borde" href="${archivo(c.comprobante_key)}" target="_blank" rel="noopener">${ico('file-pdf')} Ver comprobante (PDF)</a>`) : '<p class="nota">El cliente no ha subido comprobante.</p>'}
          <div class="grupo-botones grupo-botones--chico">
            <button class="btn btn-borde" data-anticipo="recibido">${ico('check')} Recibido</button>
            <button class="btn btn-borde" data-anticipo="no_recibido">${ico('x')} No recibido</button>
          </div>
        </section>
        <div class="grupo-botones acciones-cita">
          ${c.estado === 'pendiente' ? `<button class="btn btn-primario btn-grande" data-accion="confirmar">${ico('check-circle')} Confirmar</button>` : ''}
          ${activa ? `<button class="btn btn-borde" data-accion="reprogramar">${ico('calendar-dots')} Cambiar horario</button>` : ''}
          ${c.estado === 'pendiente' ? `<button class="btn btn-borde btn-borde--peligro" data-accion="rechazar">${ico('x-circle')} No confirmar</button>` : ''}
          ${c.estado === 'confirmada' ? `<button class="btn btn-borde" data-accion="completada">${ico('check')} Completada</button><button class="btn btn-borde" data-accion="no_asistio">${ico('user-minus')} No asistió</button><button class="btn btn-borde btn-borde--peligro" data-accion="cancelada">${ico('x-circle')} Cancelar</button>` : ''}
        </div>
        ${r.otras.length ? `<details class="politica"><summary>Otras citas de este cliente (${r.otras.length})</summary>${listaCitas(r.otras, { conFecha: true })}</details>` : ''}`,
    });
    const refrescar = () => { d.close(); mostrar(); };
    d.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-accion], button[data-anticipo], button[data-cita]');
      if (!b) return;
      if (b.dataset.cita) { d.close(); abrirCita(b.dataset.cita); return; }
      try {
        if (b.dataset.anticipo) { await api(`/api/admin/citas/${c.id}/anticipo`, { metodo: 'POST', datos: { estado: b.dataset.anticipo } }); avisar(`Anticipo: ${ANTICIPO[b.dataset.anticipo]}.`); refrescar(); return; }
        const a = b.dataset.accion;
        if (a === 'confirmar') { await api(`/api/admin/citas/${c.id}/confirmar`, { metodo: 'POST' }); avisar('Cita confirmada. Le enviamos el correo al cliente.'); window.AmizooGuia?.celebrar(); refrescar(); }
        if (a === 'rechazar' || a === 'cancelada') {
          const motivo = await pedirTexto(a === 'rechazar' ? 'No confirmar la cita' : 'Cancelar la cita', 'Motivo (le llega al cliente por correo)', a === 'rechazar');
          if (motivo === null) return;
          if (a === 'rechazar') await api(`/api/admin/citas/${c.id}/rechazar`, { metodo: 'POST', datos: { motivo } });
          else await api(`/api/admin/citas/${c.id}/estado`, { metodo: 'POST', datos: { estado: 'cancelada', nota: motivo } });
          avisar('Listo. Le avisamos al cliente.'); refrescar();
        }
        if (a === 'completada' || a === 'no_asistio') { await api(`/api/admin/citas/${c.id}/estado`, { metodo: 'POST', datos: { estado: a } }); avisar('Estado actualizado.'); refrescar(); }
        if (a === 'reprogramar') { d.close(); reprogramar(c); }
      } catch (er) { avisar(er.message, 'error'); }
    });
  }

  function pedirTexto(titulo, etiqueta, requerido) {
    return new Promise((resolve) => {
      const d = modal({ titulo, html: `<form data-f><label class="campo-f"><span>${esc(etiqueta)}</span><textarea name="t" rows="3" maxlength="300" ${requerido ? 'required' : ''}></textarea></label><div class="grupo-botones"><button class="btn btn-primario" type="submit">Enviar</button><button class="btn btn-borde" type="button" data-cerrar>Volver</button></div></form>` });
      let r = null;
      $('[data-f]', d).addEventListener('submit', (e) => { e.preventDefault(); r = e.target.t.value.trim(); d.close(); });
      d.addEventListener('close', () => resolve(r));
    });
  }

  function reprogramar(c) {
    const d = modal({
      titulo: `Cambiar horario · ${c.codigo}`,
      html: `<form data-f><p>Ahora: <strong>${esc(f.fecha(c.inicio))}, ${esc(f.hora(c.inicio))}</strong></p>
        <div class="rejilla-campos"><label class="campo-f"><span>Nueva fecha</span><input type="date" name="fecha" value="${fechaIso(c.inicio)}" required></label>
        <label class="campo-f"><span>Hora</span><input type="time" name="hora" step="900" value="${new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' }).format(c.inicio)}" required></label></div>
        <div class="horas" data-sugeridas></div>
        <label class="casilla"><input type="checkbox" name="avisar" checked> <span>Avisarle al cliente por correo</span></label>
        <p class="error-form" data-error hidden role="alert"></p>
        <div class="grupo-botones"><button class="btn btn-primario" type="submit">Guardar nuevo horario</button><button class="btn btn-borde" type="button" data-cerrar>Volver</button></div></form>`,
    });
    const form = $('[data-f]', d);
    const sugerir = async () => {
      const cont = $('[data-sugeridas]', d);
      try {
        const h = await api(`/api/disponibilidad?servicio=${c.servicio_id}&fecha=${form.fecha.value}&excluir=${c.id}`);
        cont.innerHTML = h.horarios.length ? `<p class="pequeno">Horarios libres ese día:</p><div class="horas__lista">${h.horarios.map((x) => `<button type="button" class="hora hora--btn" data-h="${x}">${f.horaTexto(x)}</button>`).join('')}</div>` : '<p class="pequeno">Ese día no tiene horarios libres en la agenda (puedes poner otra hora si no se cruza con otra cita).</p>';
        cont.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', () => { form.hora.value = b.dataset.h; }));
      } catch { cont.innerHTML = ''; }
    };
    form.fecha.addEventListener('change', sugerir);
    sugerir();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await enviar(form, (x) => api(`/api/admin/citas/${c.id}/reprogramar`, { metodo: 'POST', datos: { fecha: x.fecha, hora: x.hora, avisar: !!x.avisar } }));
        d.close(); avisar('Horario actualizado.'); mostrar();
      } catch { /* mostrado */ }
    });
  }

  /* ---------- Nueva cita manual (clientes de WhatsApp) ---------- */
  async function nuevaCita({ clienteId, fecha } = {}) {
    const [lista, cfg] = await Promise.all([servicios(), config()]);
    let cliente = clienteId ? (await api(`/api/admin/clientes/${clienteId}`)) : null;
    const d = modal({
      titulo: 'Nueva cita', ancho: 'ancho',
      html: `<form data-f>
        <h3>1. Cliente</h3>
        <div data-cliente-zona></div>
        <h3>2. Animal</h3>
        <div data-animal-zona></div>
        <h3>3. Servicio, lugar y hora</h3>
        <div class="rejilla-campos">
          <label class="campo-f ancho-total"><span>Servicio</span><select name="servicio" required><option value="">Elige…</option>${lista.map((s) => `<option value="${s.id}">${esc(s.nombre)}${s.visible ? '' : ' (oculto)'}</option>`).join('')}</select></label>
          <div class="ancho-total rejilla-campos" data-lugar>
            <label class="campo-f"><span>Zona</span><select name="zona"><option value="">Elige…</option>${cfg.zonas.zonas.map((z) => `<option value="${esc(z.id)}">${esc(z.nombre)}</option>`).join('')}</select></label>
            <label class="campo-f"><span>Barrio o municipio</span><input name="barrio" maxlength="80"></label>
            <label class="campo-f ancho-total"><span>Dirección</span><input name="direccion" maxlength="160"></label>
          </div>
          <label class="campo-f ancho-total" data-virtual hidden><span>Contacto para la videollamada</span><input name="contactoVirtual" maxlength="120"></label>
          <label class="campo-f"><span>Fecha</span><input type="date" name="fecha" value="${fecha || f.hoy()}" required></label>
          <label class="campo-f"><span>Hora</span><input type="time" name="hora" step="900" required></label>
          <div class="ancho-total horas" data-sugeridas></div>
          <label class="casilla ancho-total"><input type="checkbox" name="fueraDeHorario"> <span>Permitir fuera del horario configurado (igual no deja cruzar citas)</span></label>
          <label class="campo-f ancho-total"><span>Motivo</span><textarea name="motivo" rows="2" maxlength="600"></textarea></label>
          <label class="campo-f"><span>Estado</span><select name="estado"><option value="confirmada">Confirmada</option><option value="pendiente">Pendiente</option></select></label>
          <label class="campo-f"><span>Anticipo</span><select name="anticipo"><option value="sin_comprobante">Sin pagar aún</option><option value="recibido">Recibido</option><option value="no_aplica">No aplica</option></select></label>
        </div>
        <p class="error-form" data-error hidden role="alert"></p>
        <div class="grupo-botones"><button class="btn btn-primario btn-grande" type="submit">${ico('calendar-check')} Crear cita</button><button class="btn btn-borde" type="button" data-cerrar>Cancelar</button></div>
      </form>`,
    });
    const form = $('[data-f]', d);
    const zonaCliente = $('[data-cliente-zona]', d);
    const zonaAnimal = $('[data-animal-zona]', d);

    const pintarAnimal = () => {
      const animales = cliente?.animales || [];
      zonaAnimal.innerHTML = `${animales.length ? `<label class="campo-f"><span>Animal</span><select name="animalId"><option value="">+ Animal nuevo</option>${animales.map((a) => `<option value="${a.id}">${esc(a.nombre)} (${esc(ESPECIES[a.especie])})</option>`).join('')}</select></label>` : ''}
        <div data-animal-nuevo>${camposAnimal({}, { prefijo: 'a_' })}</div>`;
      const nuevo = $('[data-animal-nuevo]', zonaAnimal);
      activarCamposAnimal(nuevo);
      const sel = $('select[name="animalId"]', zonaAnimal);
      const ajustar = () => { nuevo.hidden = !!sel?.value; nuevo.querySelectorAll('input,select').forEach((i) => { if (nuevo.hidden) i.disabled = true; }); if (!nuevo.hidden) activarCamposAnimal(nuevo); };
      if (sel) { sel.addEventListener('change', ajustar); if (animales.length) { sel.value = String(animales[0].id); ajustar(); } }
    };
    const pintarCliente = () => {
      if (cliente) {
        zonaCliente.innerHTML = `<div class="aviso aviso--menta">${ico('user')}<p><strong>${esc(cliente.cliente.nombre)}</strong> · ${esc(cliente.cliente.telefono || '')} ${clienteId ? '' : '<button type="button" class="enlace-btn" data-cambiar-cliente>Cambiar</button>'}</p></div>`;
        const dir = cliente.direcciones[0];
        if (dir) { form.zona.value = dir.zona; form.barrio.value = dir.barrio; form.direccion.value = dir.direccion; }
      } else {
        zonaCliente.innerHTML = `<label class="campo-f"><span>Buscar cliente existente</span><input type="search" data-buscar placeholder="Nombre, celular o animal" autocomplete="off"></label>
          <ul class="lista-filas lista-filas--compacta" data-resultados></ul>
          <p class="pequeno">O registra uno nuevo:</p>
          <div class="rejilla-campos"><label class="campo-f"><span>Nombre</span><input name="c_nombre" maxlength="100" required></label>
          <label class="campo-f"><span>Celular</span><input name="c_telefono" type="tel" required></label>
          <label class="campo-f ancho-total"><span>Correo <small>(opcional, para avisos)</small></span><input name="c_correo" type="email"></label></div>`;
        let t;
        $('[data-buscar]', zonaCliente).addEventListener('input', (e) => {
          clearTimeout(t);
          const q = e.target.value.trim();
          t = setTimeout(async () => {
            const res = $('[data-resultados]', zonaCliente);
            if (q.length < 2) { res.innerHTML = ''; return; }
            const r = await api(`/api/admin/clientes?q=${encodeURIComponent(q)}`);
            res.innerHTML = r.clientes.slice(0, 6).map((c) => `<li><button type="button" class="fila-cliente" data-elegir="${c.id}"><span><strong>${esc(c.nombre)}</strong><small>${esc(c.telefono || '')} ${c.animales ? `· ${esc(c.animales)}` : ''}</small></span></button></li>`).join('') || '<li class="nota">Sin resultados.</li>';
          }, 250);
        });
      }
      pintarAnimal();
    };
    zonaCliente.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-elegir], [data-cambiar-cliente]');
      if (!b) return;
      cliente = b.dataset.elegir ? await api(`/api/admin/clientes/${b.dataset.elegir}`) : null;
      pintarCliente();
    });

    const sugerir = async () => {
      const cont = $('[data-sugeridas]', d);
      const s = lista.find((x) => x.id === form.servicio.value);
      $('[data-lugar]', d).hidden = s?.modalidad === 'virtual';
      $('[data-virtual]', d).hidden = s?.modalidad !== 'virtual';
      if (!s || !form.fecha.value) { cont.innerHTML = ''; return; }
      try {
        const h = await api(`/api/disponibilidad?servicio=${s.id}&fecha=${form.fecha.value}`);
        cont.innerHTML = h.horarios.length ? `<p class="pequeno">Horarios libres:</p><div class="horas__lista">${h.horarios.map((x) => `<button type="button" class="hora hora--btn" data-h="${x}">${f.horaTexto(x)}</button>`).join('')}</div>` : '<p class="pequeno">Sin horarios libres en la agenda ese día (respeta la anticipación mínima). Marca "Permitir fuera del horario" si hace falta.</p>';
        cont.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', () => { form.hora.value = b.dataset.h; cont.querySelectorAll('[data-h]').forEach((x) => x.classList.toggle('sel', x === b)); }));
      } catch { cont.innerHTML = ''; }
    };
    form.servicio.addEventListener('change', sugerir);
    form.fecha.addEventListener('change', sugerir);
    pintarCliente();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const r = await enviar(form, (x) => {
          const s = lista.find((y) => y.id === x.servicio);
          const datos = {
            servicio: x.servicio, fecha: x.fecha, hora: x.hora, motivo: x.motivo, estado: x.estado, anticipo: x.anticipo, fueraDeHorario: !!x.fueraDeHorario,
            lugar: s?.modalidad === 'virtual' ? { contactoVirtual: x.contactoVirtual } : { zona: x.zona, barrio: x.barrio, direccion: x.direccion },
          };
          if (cliente) datos.clienteId = cliente.cliente.id; else datos.cliente = { nombre: x.c_nombre, telefono: x.c_telefono, correo: x.c_correo };
          if (x.animalId) datos.animalId = Number(x.animalId); else datos.animal = datosAnimal(x, 'a_');
          return api('/api/admin/citas', { metodo: 'POST', datos });
        });
        if (r) { d.close(); avisar(`Cita ${r.cita.codigo} creada.`); mostrar(); }
      } catch { /* mostrado */ }
    });
  }

  /* ---------- Servicio (crear / editar) ---------- */
  async function formServicio(id) {
    const s = id === 'nuevo' ? { nombre: '', icono: 'estetoscopio', descripcion: '', especies: [], duracionMin: 45, duracionTexto: '', modalidad: 'domicilio', precio: { tipo: 'zona', bogota: 0, fueraBogota: 0 }, visible: true, orden: 99 } : (await servicios()).find((x) => x.id === id);
    const p = s.precio;
    const d = modal({
      titulo: id === 'nuevo' ? 'Nuevo servicio' : `Editar · ${s.nombre}`, ancho: 'ancho',
      html: `<form data-f><div class="rejilla-campos">
        <label class="campo-f ancho-total"><span>Nombre</span><input name="nombre" value="${esc(s.nombre)}" maxlength="80" required></label>
        <label class="campo-f ancho-total"><span>Descripción</span><textarea name="descripcion" rows="4" maxlength="1200" required>${esc(s.descripcion)}</textarea></label>
        <fieldset class="campo-f ancho-total"><legend>Especies</legend><div class="opciones-fila">${Object.keys(ESPECIES).map((e) => `<label class="opcion-chica"><input type="checkbox" name="especies" value="${e}"${s.especies.includes(e) ? ' checked' : ''}> ${ESPECIES[e]}</label>`).join('')}</div></fieldset>
        <label class="campo-f"><span>Duración (minutos)</span><input type="number" name="duracionMin" min="10" max="600" value="${s.duracionMin}" required><small class="ayuda">Es el tiempo que bloquea en la agenda (más el desplazamiento).</small></label>
        <label class="campo-f"><span>Duración (texto en la página)</span><input name="duracionTexto" value="${esc(s.duracionTexto)}" maxlength="80"></label>
        <label class="campo-f"><span>Modalidad</span><select name="modalidad"><option value="domicilio"${s.modalidad === 'domicilio' ? ' selected' : ''}>A domicilio</option><option value="virtual"${s.modalidad === 'virtual' ? ' selected' : ''}>Virtual</option></select></label>
        <label class="campo-f"><span>Ícono</span><select name="icono">${Object.keys(ICONO_SERVICIO).map((k) => `<option value="${k}"${k === s.icono ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
        <label class="campo-f"><span>Tipo de precio</span><select name="tipo" data-tipo-precio>
          <option value="zona"${p.tipo === 'zona' ? ' selected' : ''}>Bogotá / fuera de Bogotá</option><option value="rango"${p.tipo === 'rango' ? ' selected' : ''}>Desde – hasta</option><option value="fijo"${p.tipo === 'fijo' ? ' selected' : ''}>Precio fijo</option></select></label>
        <label class="campo-f"><span>Orden</span><input type="number" name="orden" min="0" max="999" value="${s.orden}"></label>
        <div class="ancho-total rejilla-campos" data-precio="zona"><label class="campo-f"><span>Bogotá</span><input type="number" name="bogota" min="0" step="100" value="${p.bogota ?? ''}"></label><label class="campo-f"><span>Fuera de Bogotá</span><input type="number" name="fueraBogota" min="0" step="100" value="${p.fueraBogota ?? ''}"></label></div>
        <div class="ancho-total rejilla-campos" data-precio="rango"><label class="campo-f"><span>Desde</span><input type="number" name="desde" min="0" step="100" value="${p.desde ?? ''}"></label><label class="campo-f"><span>Hasta</span><input type="number" name="hasta" min="0" step="100" value="${p.hasta ?? ''}"></label><label class="casilla"><input type="checkbox" name="domicilioAparte"${p.domicilioAparte ? ' checked' : ''}> <span>El domicilio se cobra aparte</span></label></div>
        <div class="ancho-total rejilla-campos" data-precio="fijo"><label class="campo-f"><span>Precio</span><input type="number" name="valor" min="0" step="100" value="${p.valor ?? ''}"></label></div>
        <label class="casilla ancho-total"><input type="checkbox" name="visible"${s.visible ? ' checked' : ''}> <span>Visible en la página y en la agenda</span></label>
      </div><p class="error-form" data-error hidden role="alert"></p>
      <div class="grupo-botones"><button class="btn btn-primario" type="submit">Guardar</button><button class="btn btn-borde" type="button" data-cerrar>Cancelar</button></div></form>`,
    });
    const form = $('[data-f]', d);
    const tipo = () => { d.querySelectorAll('[data-precio]').forEach((g) => { g.hidden = g.dataset.precio !== form.tipo.value; }); };
    form.tipo.addEventListener('change', tipo); tipo();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await enviar(form, (x) => {
          const fd = new FormData(form);
          const t = x.tipo;
          const datos = {
            nombre: x.nombre, descripcion: x.descripcion, especies: fd.getAll('especies'), duracionMin: Number(x.duracionMin), duracionTexto: x.duracionTexto,
            modalidad: x.modalidad, icono: x.icono, orden: Number(x.orden || 0), visible: !!x.visible,
            precio: t === 'zona' ? { tipo: t, bogota: Number(x.bogota), fueraBogota: Number(x.fueraBogota) } : t === 'rango' ? { tipo: t, desde: Number(x.desde), hasta: Number(x.hasta), domicilioAparte: !!x.domicilioAparte } : { tipo: t, valor: Number(x.valor) },
          };
          return api(id === 'nuevo' ? '/api/admin/servicios' : `/api/admin/servicios/${id}`, { metodo: id === 'nuevo' ? 'POST' : 'PATCH', datos });
        });
        d.close(); avisar('Servicio guardado.'); cacheServicios = null; mostrar();
      } catch { /* mostrado */ }
    });
  }

  function formAnimal({ animal, clienteId }) {
    const d = modal({
      titulo: animal ? `Editar · ${animal.nombre}` : 'Agregar animal', ancho: 'ancho',
      html: `<form data-f>${camposAnimal(animal || {})}<p class="error-form" data-error hidden role="alert"></p><div class="grupo-botones"><button class="btn btn-primario" type="submit">Guardar</button><button class="btn btn-borde" type="button" data-cerrar>Cancelar</button></div></form>`,
    });
    const form = $('[data-f]', d);
    activarCamposAnimal(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await enviar(form, (x) => api(animal ? `/api/admin/animales/${animal.id}` : `/api/admin/clientes/${clienteId}/animales`, { metodo: animal ? 'PATCH' : 'POST', datos: datosAnimal(x) }));
        d.close(); avisar('Animal guardado.'); mostrar();
      } catch { /* mostrado */ }
    });
  }

  /* ---------- Eventos de la vista ---------- */
  // Filtros de Clientes y mascotas (búsqueda en vivo, especie, tipo, orden y vista)
  vista.addEventListener('input', (e) => {
    if (e.target.matches('[data-filtro-q]')) refrescarClientes({ q: e.target.value.trim() });
  });
  vista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vista-cli], [data-especie], [data-tipo]');
    if (!b || !b.closest('[data-filtros-cli]')) return;
    if (b.dataset.vistaCli) {
      const st = estadoClientes();
      guardarEstado({ ...st, vista: b.dataset.vistaCli, orden: '' });
      mostrar();
      return;
    }
    const grupo = b.parentElement;
    grupo.querySelectorAll('button').forEach((x) => { const si = x === b; x.setAttribute('aria-pressed', String(si)); x.classList.toggle('activo', si); });
    if (b.dataset.especie !== undefined) refrescarClientes({ especie: b.dataset.especie }, { inmediato: true });
    else refrescarClientes({ tipo: b.dataset.tipo }, { inmediato: true });
  });
  vista.addEventListener('change', (e) => {
    if (e.target.matches('[data-filtro-orden]')) refrescarClientes({ orden: e.target.value }, { inmediato: true });
  });

  vista.addEventListener('click', async (e) => {
    const b = e.target.closest('button, [data-cita]');
    if (!b) return;
    const ds = b.dataset;
    try {
      if (ds.cita) { abrirCita(ds.cita); return; }
      if (b.matches('[data-nueva-cita]')) { nuevaCita({ clienteId: ds.cliente, fecha: ds.fecha }); return; }
      if (ds.confirmar) { await api(`/api/admin/citas/${ds.confirmar}/confirmar`, { metodo: 'POST' }); avisar('Cita confirmada. Le enviamos el correo al cliente.'); window.AmizooGuia?.celebrar(); mostrar(); return; }
      if (ds.estadoRapido) { await api(`/api/admin/citas/${ds.id}/estado`, { metodo: 'POST', datos: { estado: ds.estadoRapido } }); avisar('Cita marcada como completada.'); mostrar(); return; }
      if (b.matches('[data-nuevo-cliente]')) {
        const dlg = modal({ titulo: 'Nuevo cliente', html: `<form data-f><label class="campo-f"><span>Nombre</span><input name="nombre" required maxlength="100"></label><label class="campo-f"><span>Celular</span><input name="telefono" type="tel" required></label><label class="campo-f"><span>Correo <small>(opcional)</small></span><input name="correo" type="email"></label><p class="error-form" data-error hidden role="alert"></p><div class="grupo-botones"><button class="btn btn-primario" type="submit">Crear</button></div></form>` });
        $('[data-f]', dlg).addEventListener('submit', async (ev) => {
          ev.preventDefault();
          try { const r = await enviar(ev.target, (x) => api('/api/admin/clientes', { metodo: 'POST', datos: x })); dlg.close(); location.hash = `cliente/${r.cliente.id}`; } catch { /* mostrado */ }
        });
        return;
      }
      if (ds.nuevoAnimal) { formAnimal({ clienteId: ds.nuevoAnimal }); return; }
      if (ds.editarAnimal) { const r = await api(`/api/admin/animales/${ds.editarAnimal}/historia`); formAnimal({ animal: r.animal }); return; }
      if (ds.servicio) { formServicio(ds.servicio); return; }
      if (ds.borrarHistoria) { if (await confirmar({ titulo: '¿Borrar este registro?', texto: 'El cliente dejará de verlo en su historia clínica.', si: 'Borrar', peligro: true })) { await api(`/api/admin/historia/${ds.borrarHistoria}`, { metodo: 'DELETE' }); mostrar(); } return; }
      if (ds.borrarDoc) { if (await confirmar({ titulo: '¿Borrar este documento?', texto: 'Se elimina el archivo y el cliente ya no podrá descargarlo.', si: 'Borrar', peligro: true })) { await api(`/api/admin/documentos/${ds.borrarDoc}`, { metodo: 'DELETE' }); mostrar(); } return; }
      if (ds.borrarBloqueo) { await api(`/api/admin/bloqueos/${ds.borrarBloqueo}`, { metodo: 'DELETE' }); avisar('Día desbloqueado.'); mostrar(); return; }
      if (b.matches('[data-agregar-zona]')) { const cont = $('[data-zonas]'); cont.insertAdjacentHTML('beforeend', filaZona({}, cont.children.length)); return; }
      if (b.matches('[data-quitar-zona]')) { b.closest('[data-zona]').remove(); return; }
    } catch (er) { avisar(er.message, 'error'); }
  });

  vista.addEventListener('change', (e) => {
    if (e.target.matches('[data-ir-fecha]') && e.target.value) location.hash = `agenda/${e.target.dataset.modo}/${e.target.value}`;
    if (e.target.matches('.subir input[type=file]')) { const n = e.target.closest('.subir').querySelector('[data-nombre]'); if (n) n.textContent = e.target.files[0]?.name || 'Elegir archivo'; }
  });

  vista.addEventListener('submit', async (e) => {
    const form = e.target;
    e.preventDefault();
    const fd = new FormData(form);
    try {
      if (form.matches('[data-buscar-cliente]')) { location.hash = `clientes?q=${encodeURIComponent(fd.get('q') || '')}`; return; }
      if (form.dataset.formCliente) { await enviar(form, (x) => api(`/api/admin/clientes/${form.dataset.formCliente}`, { metodo: 'PATCH', datos: x })); avisar('Datos guardados.'); return; }
      if (form.dataset.formHistoria) { await enviar(form, (x) => api(`/api/admin/animales/${form.dataset.formHistoria}/historia`, { metodo: 'POST', datos: x })); avisar('Registro guardado. El cliente ya lo ve en su cuenta.'); mostrar(); return; }
      if (form.dataset.formDoc) {
        await enviar(form, () => { if (fd.get('archivo')?.size > 5 * 1024 * 1024) throw new Error('El archivo pesa más de 5 MB.'); return api(`/api/admin/animales/${form.dataset.formDoc}/documentos`, { metodo: 'POST', form: fd }); });
        avisar('Documento adjuntado.'); mostrar(); return;
      }
      if (form.matches('[data-form-agenda]')) { await enviar(form, (x) => api('/api/admin/config/agenda', { metodo: 'PUT', datos: { ...x, dias: fd.getAll('dias').map(Number) } })); avisar('Horario guardado.'); cacheConfig = null; return; }
      if (form.matches('[data-form-pago]')) { await enviar(form, (x) => api('/api/admin/config/pago', { metodo: 'PUT', datos: x })); avisar('Datos de pago guardados.'); cacheConfig = null; return; }
      if (form.matches('[data-form-bloqueo]')) { await enviar(form, (x) => api('/api/admin/bloqueos', { metodo: 'POST', datos: x })); avisar('Días bloqueados.'); mostrar(); return; }
      if (form.matches('[data-form-zonas]')) {
        const zonas = [...form.querySelectorAll('[data-zona]')].map((z) => ({ id: z.querySelector('[name=id]').value, nombre: z.querySelector('[name=nombre]').value, tarifa: z.querySelector('[name=tarifa]').value, barrios: z.querySelector('[name=barrios]').value.split('\n').map((x) => x.trim()).filter(Boolean) }));
        const actual = (await config()).zonas;
        await enviar(form, () => api('/api/admin/config/zonas', { metodo: 'PUT', datos: { pendienteConfirmar: actual.pendienteConfirmar, zonas } }));
        avisar('Zonas guardadas.'); cacheConfig = null; return;
      }
      if (form.matches('[data-form-planes]')) {
        const p = (await config()).planes;
        const lineas = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);
        const datos = {
          preventiva: { nombre: fd.get('pNombre'), pago: fd.get('pPago'), condicion: fd.get('pCondicion'), incluye: lineas(fd.get('pIncluye')), precios: p.preventiva.precios.map((_, i) => ({ especie: fd.get(`pEsp${i}`), valor: Number(fd.get(`pVal${i}`)) })) },
          membresias: { titulo: p.membresias.titulo, para: p.membresias.para, planes: p.membresias.planes.map((_, i) => ({ id: fd.get(`mId${i}`), nombre: fd.get(`mNombre${i}`), precioMensual: fd.get(`mPrecio${i}`) === '' ? null : Number(fd.get(`mPrecio${i}`)), beneficios: lineas(fd.get(`mBen${i}`)) })) },
        };
        await enviar(form, () => api('/api/admin/config/planes', { metodo: 'PUT', datos }));
        avisar('Planes guardados.'); cacheConfig = null; return;
      }
      if (form.matches('[data-form-clave]')) { await enviar(form, (x) => api('/api/auth/clave', { metodo: 'POST', datos: x })); form.reset(); avisar('Contraseña cambiada. Cerramos tus otras sesiones.'); }
    } catch { /* el error se muestra en el formulario */ }
  });

  /* ---------- Navegación ---------- */
  function actualizarGlobito(n) {
    const g = $('[data-cuenta-pend]');
    g.hidden = !n; g.textContent = n;
  }

  async function mostrar() {
    const [ruta, query] = (location.hash.slice(1) || 'inicio').split('?');
    const [tab, ...args] = ruta.split('/');
    if (tab === 'cita') { history.replaceState(null, '', '#solicitudes'); await mostrar(); abrirCita(args[0]); return; }
    const t = VISTAS[tab] ? tab : 'inicio';
    const menu = { cliente: 'clientes', animal: 'clientes' }[t] || t;
    document.querySelectorAll('[data-tab]').forEach((a) => (a.dataset.tab === menu ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    vista.setAttribute('aria-busy', 'true');
    try { vista.innerHTML = await VISTAS[t](...args); } catch (e) { vista.innerHTML = `<div class="aviso">${ico('warning')}<p>${esc(e.message)}</p></div>`; }
    vista.removeAttribute('aria-busy');
    guia(...GUIA[t]);
    void query;
  }

  (async () => {
    try {
      yo = (await api('/api/auth/yo')).usuario;
      if (!yo || yo.rol !== 'admin') { location.href = '/entrar?volver=/panel'; return; }
      $('[data-quien]').textContent = yo.nombre.split(' ')[0];
      window.addEventListener('hashchange', mostrar);
      await mostrar();
      if (!/^#?(inicio|solicitudes)?$/.test(location.hash)) api('/api/admin/resumen').then((r) => actualizarGlobito(r.pendientes.length)).catch(() => {});
    } catch (e) { vista.innerHTML = `<div class="aviso">${ico('warning')}<p>${esc(e.message)}</p></div>`; }
  })();
})();
