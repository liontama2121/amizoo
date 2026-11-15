/* =========================================================
   AZ: utilidades compartidas de la agenda, el portal y el panel.
   ========================================================= */
(() => {
  'use strict';
  const ZONA = 'America/Bogota';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(ruta, { metodo = 'GET', datos, form, silencioso401 = false } = {}) {
    const op = { method: metodo, credentials: 'same-origin', headers: {} };
    if (form) op.body = form;
    else if (datos !== undefined) { op.body = JSON.stringify(datos); op.headers['content-type'] = 'application/json'; }
    let r;
    try { r = await fetch(ruta, op); } catch { throw Object.assign(new Error('No hay conexión. Revisa tu internet e intenta de nuevo.'), { red: true }); }
    let cuerpo = {};
    try { cuerpo = await r.json(); } catch { /* sin cuerpo */ }
    if (r.status === 401 && !silencioso401 && cuerpo.sesion === false) {
      location.href = `/entrar?volver=${encodeURIComponent(location.pathname + location.hash)}`;
      throw new Error(cuerpo.error);
    }
    if (!r.ok) throw Object.assign(new Error(cuerpo.error || 'Tuvimos un problema. Intenta de nuevo.'), { status: r.status, datos: cuerpo });
    return cuerpo;
  }

  const fmt = (op) => new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, ...op });
  const f = {
    pesos: (n) => (n === null || n === undefined ? '' : '$' + Number(n).toLocaleString('es-CO')),
    fecha: (ms) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(ms),
    fechaCorta: (ms) => fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(ms),
    fechaAnio: (ms) => fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(ms),
    hora: (ms) => fmt({ hour: 'numeric', minute: '2-digit', hour12: true }).format(ms),
    horaTexto: (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`; },
    dia: (iso) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso + 'T12:00:00-05:00')),
    hoy: () => fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(Date.now()).split('/').reverse().join('-'),
    isoLocal: (ms) => fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms).split('/').reverse().join('-'),
    capital: (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : ''),
  };

  const ESTADOS = {
    pendiente: ['Pendiente de confirmación', 'pendiente'], confirmada: ['Confirmada', 'confirmada'],
    completada: ['Completada', 'completada'], cancelada: ['Cancelada', 'cerrada'], rechazada: ['No confirmada', 'cerrada'], no_asistio: ['No asistió', 'cerrada'],
  };
  const ANTICIPO = {
    sin_comprobante: 'Sin comprobante', por_revisar: 'Comprobante por revisar', recibido: 'Anticipo recibido', no_recibido: 'Anticipo no recibido', no_aplica: 'No aplica',
  };
  const ESPECIES = { perros: 'Perro', gatos: 'Gato', aves: 'Ave', roedores: 'Roedor', bovinos: 'Bovino', ovinos: 'Ovino', caprinos: 'Caprino', porcinos: 'Porcino' };
  const ESPECIES_PROD = ['bovinos', 'ovinos', 'caprinos', 'porcinos', 'aves'];
  const ICONO_ESPECIE = { perros: 'dog', gatos: 'cat', aves: 'bird', roedores: 'rabbit', bovinos: 'cow', ovinos: 'paw-print', caprinos: 'paw-print', porcinos: 'paw-print' };
  const ICONO_SERVICIO = { estetoscopio: 'stethoscope', correa: 'dog', jeringa: 'syringe', tubo: 'test-tube', granero: 'barn', plato: 'bowl-food', pelota: 'tennis-ball', curita: 'bandaids', biberon: 'baby' };

  const ico = (n) => `<i class="ph ph-${n}" aria-hidden="true"></i>`;
  const chip = (estado) => { const [t, c] = ESTADOS[estado] || [estado, 'cerrada']; return `<span class="chip chip--${c}">${esc(t)}</span>`; };
  const chipAnticipo = (e) => `<span class="chip chip--anticipo-${e}">${esc(ANTICIPO[e] || e)}</span>`;

  function avisar(texto, tipo = 'ok') {
    const caja = document.querySelector('[data-avisos]');
    if (!caja) return;
    const el = document.createElement('div');
    el.className = `aviso-flot aviso-flot--${tipo}`;
    el.innerHTML = `${ico(tipo === 'error' ? 'warning-circle' : 'check-circle')}<span>${esc(texto)}</span>`;
    caja.append(el);
    setTimeout(() => { el.classList.add('sale'); setTimeout(() => el.remove(), 400); }, tipo === 'error' ? 6000 : 3500);
  }

  // Ventana modal accesible con <dialog>. Devuelve el elemento; cerrar() lo quita.
  function modal({ titulo, html, ancho = 'normal', alAbrir }) {
    const d = document.createElement('dialog');
    d.className = `modal modal--${ancho}`;
    d.innerHTML = `<div class="modal__cab"><h2>${esc(titulo)}</h2><button type="button" class="btn-icono" data-cerrar aria-label="Cerrar">${ico('x')}</button></div><div class="modal__cuerpo">${html}</div>`;
    document.body.append(d);
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-cerrar]')) d.close(); });
    d.addEventListener('close', () => d.remove());
    d.showModal();
    alAbrir?.(d);
    return d;
  }
  function confirmar({ titulo, texto, si = 'Sí, continuar', no = 'Volver', peligro = false }) {
    return new Promise((resolve) => {
      const d = modal({ titulo, html: `<p class="lead-sm">${esc(texto)}</p><div class="grupo-botones"><button class="btn ${peligro ? 'btn-peligro' : 'btn-primario'}" data-si>${esc(si)}</button><button class="btn btn-borde" data-cerrar>${esc(no)}</button></div>` });
      let r = false;
      d.querySelector('[data-si]').addEventListener('click', () => { r = true; d.close(); });
      d.addEventListener('close', () => resolve(r));
    });
  }

  // Envía un formulario mostrando el estado en su botón y el error junto al formulario.
  async function enviar(form, accion) {
    const boton = form.querySelector('[type="submit"]');
    const error = form.querySelector('[data-error]');
    if (error) { error.hidden = true; error.textContent = ''; }
    if (!form.reportValidity()) return;
    const txt = boton?.innerHTML;
    if (boton) { boton.disabled = true; boton.innerHTML = `${ico('circle-notch')} Un momento…`; boton.classList.add('cargando'); }
    try {
      return await accion(Object.fromEntries(new FormData(form)));
    } catch (e) {
      if (error) { error.textContent = e.message; error.hidden = false; error.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } else avisar(e.message, 'error');
      throw e;
    } finally {
      if (boton) { boton.disabled = false; boton.innerHTML = txt; boton.classList.remove('cargando'); }
    }
  }

  const guia = (titulo, texto) => window.AmizooGuia?.explicar(titulo, texto);
  const mapa = (c) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.direccion}, ${c.barrio}, Colombia`)}`;
  const wa = (tel, msg = '') => `https://wa.me/${String(tel || '').replace(/\D/g, '').replace(/^(?=3\d{9}$)/, '57')}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
  const archivo = (key, descargar) => `/api/archivos/${key.split('/').map(encodeURIComponent).join('/')}${descargar ? '?descargar' : ''}`;

  // Campos de animal compartidos (agenda, portal y panel).
  function camposAnimal(a = {}, { prefijo = '' } = {}) {
    const tipo = a.tipo || 'compania';
    const opciones = (lista, sel) => lista.map((e) => `<option value="${e}"${e === sel ? ' selected' : ''}>${ESPECIES[e]}</option>`).join('');
    return `
      <fieldset class="campo-f">
        <legend>¿Qué tipo de animal es?</legend>
        <div class="opciones-fila">
          <label class="opcion-chica"><input type="radio" name="${prefijo}tipo" value="compania"${tipo === 'compania' ? ' checked' : ''} data-tipo-animal> ${ico('heart')} De compañía</label>
          <label class="opcion-chica"><input type="radio" name="${prefijo}tipo" value="produccion"${tipo === 'produccion' ? ' checked' : ''} data-tipo-animal> ${ico('barn')} De producción (finca)</label>
        </div>
      </fieldset>
      <div class="rejilla-campos" data-si-tipo="compania"${tipo === 'compania' ? '' : ' hidden'}>
        <label class="campo-f"><span>Nombre</span><input name="${prefijo}nombre" maxlength="60" value="${esc(tipo === 'compania' ? a.nombre : '')}" autocomplete="off" required></label>
        <label class="campo-f"><span>Especie</span><select name="${prefijo}especie" required><option value="">Elige…</option>${opciones(Object.keys(ESPECIES), a.especie)}</select></label>
        <label class="campo-f"><span>Raza <small>(opcional)</small></span><input name="${prefijo}raza" maxlength="60" value="${esc(a.raza)}"></label>
        <label class="campo-f"><span>Edad</span><input name="${prefijo}edad" maxlength="40" placeholder="Ej: 3 años" value="${esc(a.edad)}"></label>
        <label class="campo-f"><span>Peso</span><input name="${prefijo}peso" maxlength="40" placeholder="Ej: 12 kg" value="${esc(a.peso)}"></label>
        <label class="campo-f ancho-total"><span>Temperamento</span><input name="${prefijo}temperamento" maxlength="200" placeholder="Ej: tranquilo, nervioso con extraños, muerde" value="${esc(a.temperamento)}"></label>
      </div>
      <div class="rejilla-campos" data-si-tipo="produccion"${tipo === 'produccion' ? '' : ' hidden'}>
        <label class="campo-f"><span>Nombre de la finca</span><input name="${prefijo}finca" maxlength="100" value="${esc(tipo === 'produccion' ? a.nombre : '')}"></label>
        <label class="campo-f"><span>Especie</span><select name="${prefijo}especieProd"><option value="">Elige…</option>${opciones(ESPECIES_PROD, a.especie)}</select></label>
        <label class="campo-f"><span>Número de animales</span><input name="${prefijo}numAnimales" type="number" min="1" inputmode="numeric" value="${esc(a.num_animales)}"></label>
        <label class="campo-f"><span>Tipo de producción</span><input name="${prefijo}tipoProduccion" maxlength="100" placeholder="Ej: leche, carne, huevo" value="${esc(a.tipo_produccion)}"></label>
      </div>`;
  }
  // Activa el cambio compañía/producción y ajusta qué campos son obligatorios.
  function activarCamposAnimal(raiz) {
    const aplicar = () => {
      const tipo = raiz.querySelector('[data-tipo-animal]:checked')?.value || 'compania';
      raiz.querySelectorAll('[data-si-tipo]').forEach((g) => {
        const activo = g.dataset.siTipo === tipo;
        g.hidden = !activo;
        g.querySelectorAll('input, select').forEach((i) => {
          i.disabled = !activo;
          i.required = activo && /(nombre|especie|finca|especieProd|numAnimales|tipoProduccion)$/.test(i.name);
        });
      });
    };
    raiz.querySelectorAll('[data-tipo-animal]').forEach((r) => r.addEventListener('change', aplicar));
    aplicar();
  }
  const datosAnimal = (d, prefijo = '') => {
    const g = (k) => d[prefijo + k];
    return g('tipo') === 'produccion'
      ? { tipo: 'produccion', nombre: g('finca'), especie: g('especieProd'), numAnimales: g('numAnimales'), tipoProduccion: g('tipoProduccion'), temperamento: '' }
      : { tipo: 'compania', nombre: g('nombre'), especie: g('especie'), raza: g('raza'), edad: g('edad'), peso: g('peso'), temperamento: g('temperamento') };
  };

  // Calendario mensual reutilizable. dias: Set de 'YYYY-MM-DD' disponibles (o null = todos los futuros).
  function calendario(contenedor, { mes, disponibles, seleccion, alElegir, alCambiarMes, minimoMes }) {
    const [y, m] = mes.split('-').map(Number);
    const primero = new Date(Date.UTC(y, m - 1, 1));
    const nDias = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const vacios = (primero.getUTCDay() + 6) % 7; // lunes primero
    const nombreMes = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(primero);
    const mesAnt = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
    const mesSig = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    let celdas = '';
    for (let i = 0; i < vacios; i++) celdas += '<span></span>';
    for (let d = 1; d <= nDias; d++) {
      const iso = `${mes}-${String(d).padStart(2, '0')}`;
      const ok = disponibles ? disponibles.has(iso) : true;
      celdas += `<button type="button" class="cal__dia${iso === seleccion ? ' sel' : ''}" data-dia="${iso}" ${ok ? '' : 'disabled'} aria-pressed="${iso === seleccion}" aria-label="${f.dia(iso)}${ok ? ', disponible' : ', no disponible'}">${d}</button>`;
    }
    contenedor.innerHTML = `
      <div class="cal">
        <div class="cal__cab">
          <button type="button" class="btn-icono" data-mes="${mesAnt}" aria-label="Mes anterior" ${minimoMes && mesAnt < minimoMes ? 'disabled' : ''}>${ico('caret-left')}</button>
          <strong class="cal__mes">${f.capital(nombreMes)}</strong>
          <button type="button" class="btn-icono" data-mes="${mesSig}" aria-label="Mes siguiente">${ico('caret-right')}</button>
        </div>
        <div class="cal__semana" aria-hidden="true"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div>
        <div class="cal__dias">${celdas}</div>
      </div>`;
    contenedor.querySelectorAll('[data-mes]').forEach((b) => b.addEventListener('click', () => alCambiarMes(b.dataset.mes)));
    contenedor.querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', () => alElegir(b.dataset.dia)));
  }

  // Sesión y botón "Salir" del encabezado
  async function salir() {
    try { await api('/api/auth/salir', { metodo: 'POST' }); } catch { /* igual salimos */ }
    location.href = '/';
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-salir]')) salir(); });

  window.AZ = { api, esc, f, ESTADOS, ANTICIPO, ESPECIES, ESPECIES_PROD, ICONO_ESPECIE, ICONO_SERVICIO, ico, chip, chipAnticipo, avisar, modal, confirmar, enviar, guia, mapa, wa, archivo, camposAnimal, activarCamposAnimal, datosAnimal, calendario, salir };
})();
