// Genera las páginas públicas en /public a partir de /src/pages + /public/data.
// Sin dependencias: `node scripts/build.mjs`.
// Cada página empieza con: <!--meta {"title":"...","description":"...","path":"/ruta"} -->
// Marcadores: {{servicios-bento}}, {{servicios-filtro}}, {{servicios-lista}}, {{plan-preventiva}},
// {{membresias}}, {{zonas-buscador}}, {{zonas-recorridos}}, {{faq}}, {{testimonios}}, {{especies}},
// {{ico:nombre-phosphor}}, {{foto:archivo:clase:alt}}, {{wa}}, {{wa-msg:texto}}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'pages');
const OUT = path.join(ROOT, 'public');
const DATA = path.join(OUT, 'data');
const SITE = 'https://amizoovet.com'; // TODO: confirmar dominio (amizoovet.com o .com.co)
const WA = 'https://wa.me/573142300347';
const ASSET_V = Date.now().toString(36);

const leer = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const servicios = leer('servicios.json').servicios.filter((s) => s.visible);
const planes = leer('planes.json');
const zonas = leer('zonas.json');
const faq = leer('faq.json');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cop = (n) => '$' + new Intl.NumberFormat('es-CO').format(n);
const waMsg = (t) => `${WA}?text=${encodeURIComponent(t)}`;

// Íconos: Phosphor (https://phosphoricons.com), cargado desde unpkg en el <head>.
const ICONOS = {
  estetoscopio: 'stethoscope', correa: 'dog', jeringa: 'syringe', tubo: 'test-tube', granero: 'barn',
  plato: 'bowl-food', pelota: 'tennis-ball', curita: 'bandaids', biberon: 'baby',
};
const ico = (nombre) => `<i class="ph ph-${ICONOS[nombre] || nombre}" aria-hidden="true"></i>`;

// Fotos: /public/assets/fotos/{nombre}-{640|1200}.webp (Licencia Unsplash, ver README).
const FOTOS = {
  'periquito-1': [1200, 1793], 'periquito-2': [1200, 800], 'periquito-3': [1200, 800], 'periquitos-rama': [1200, 838],
  'gato-sofa': [1200, 799], 'gato-manta': [1200, 900], 'vacas': [1200, 800], 'vacas-2': [1200, 800],
  'perro-abrazo': [1200, 800], 'perro-abrazo-2': [1200, 800], 'cachorro': [1200, 1800], 'ovejas': [1200, 1800], 'cabra': [1200, 800],
  'vet-gatito': [1200, 800], 'maletin': [1200, 798], 'estetoscopio': [1200, 800],
};
const foto = (n, alt = '', { lazy = true, sizes = '(min-width: 900px) 50vw, 100vw', cls = '' } = {}) => {
  const [w, h] = FOTOS[n] || [1200, 800];
  return `<img${cls ? ` class="${cls}"` : ''} src="/assets/fotos/${n}-1200.webp" srcset="/assets/fotos/${n}-640.webp 640w, /assets/fotos/${n}-1200.webp 1200w" sizes="${sizes}" width="${w}" height="${h}" alt="${esc(alt)}"${lazy ? ' loading="lazy" decoding="async"' : ' fetchpriority="high"'}>`;
};
const MASCOTA = 'periquito-2'; // foto provisional de Amizoo hasta tener la ilustración oficial

const ESPECIES = {
  perros: { n: 'Perros', i: 'dog' }, gatos: { n: 'Gatos', i: 'cat' }, aves: { n: 'Aves', i: 'bird' },
  roedores: { n: 'Roedores', i: 'paw-print' }, bovinos: { n: 'Bovinos', i: 'cow' }, ovinos: { n: 'Ovinos', i: 'paw-print' },
  caprinos: { n: 'Caprinos', i: 'paw-print' }, porcinos: { n: 'Porcinos', i: 'paw-print' },
};
const ORDEN_ESPECIES = Object.keys(ESPECIES);

const precioCorto = (p) =>
  p.tipo === 'zona' ? `${cop(p.bogota)} en Bogotá` : p.tipo === 'rango' ? `Desde ${cop(p.desde)} + domicilio` : cop(p.valor);

function etiquetaPrecio(p) {
  if (p.tipo === 'zona')
    return `<div class="etiqueta-precio">
      <div class="fila"><span class="zona">En Bogotá</span><span class="valor">${cop(p.bogota)}</span></div>
      <div class="fila"><span class="zona">Fuera de Bogotá</span><span class="valor">${cop(p.fueraBogota)}</span></div>
    </div>`;
  if (p.tipo === 'rango')
    return `<div class="etiqueta-precio">
      <div class="fila"><span class="zona">Desde</span><span class="valor">${cop(p.desde)}</span></div>
      <div class="fila"><span class="zona">Hasta</span><span class="valor">${cop(p.hasta)}</span></div>
      ${p.domicilioAparte ? '<p class="extra"><strong>+ domicilio</strong> (te confirmamos el valor)</p>' : ''}
    </div>`;
  return `<div class="etiqueta-precio"><div class="fila"><span class="zona">Valor</span><span class="valor">${cop(p.valor)}</span></div></div>`;
}

const TESTIMONIOS = [
  ['Cindy Ríos', 'Shrek y Fiona', 'cacatúas', 'El doctor revisó las aves y me dio el tratamiento para acabar con los piojos que tenían. Excelente servicio, el agendar la cita fue muy sencillo.', 'Contacté a AMIZOO por su página web y pedí cita a domicilio porque mis cacatúas no dejaban de rascarse. El doctor revisó las aves y me dio el tratamiento para acabar con los piojos que tenían. El doctor realizó un control después del tratamiento y estuvo pendiente de la evolución de mis bebés. Excelente servicio, el agendar la cita fue muy sencillo. Los recomiendo totalmente.'],
  ['Andrés Estupiñán', 'Lukas', 'perro', 'La doctora que llegó a mi casa fue muy amable, realizó la valoración y determinó las causas del malestar. Gracias a ellos Lukas ya se encuentra bien de salud.', 'Necesitaba una consulta médica a domicilio para mi perrito Lukas ya que estaba con mucho malestar de estómago y alguien me recomendó a AMIZOO. Ingresé a su página y solicité el servicio. La doctora que llegó a mi casa fue muy amable, realizó la valoración y determinó las causas del malestar. Nos indicó el tratamiento y dieta a seguir para que se mejorara. Realizamos dos controles posteriores a la consulta y su evolución fue positiva. Muy acertados en AMIZOO, gracias a ellos Lukas ya se encuentra bien de salud. Excelente servicio.'],
  ['Valeria García', 'Tom', 'gato', 'La doctora fue y lo revisó; se hizo cambio en la dieta y ya empezó a comer y está más gordito.', 'Mi gato no quería comer su concentrado y estaba muy flaco. Pedí la consulta a domicilio en AMIZOO. La doctora fue y lo revisó; se hizo cambio en la dieta y ya empezó a comer y está más gordito. Me gustó mucho la atención y compromiso.'],
  ['Juan Beltrán', 'Celeste', 'gata', 'La doctora la revisó en casa, le dio el medicamento requerido y ahora mi gata está muy bien. Feliz con el servicio.', 'Mi gatita tenía parásitos, pero no tenía tiempo para llevarla al veterinario, por eso pedí cita a domicilio en AMIZOO. La doctora la revisó en casa, le dio el medicamento requerido y ahora mi gata está muy bien. Feliz con el servicio. Los recomiendo.'],
  ['Santiago Paredes', 'Ron', 'perro', 'El doctor hizo la consulta y me indicó el tratamiento. Tuvo dos controles y ya se encuentra mucho mejor.', 'Tengo un perrito pequeño que tenía mucha tos y no sabía por qué. Pedí cita a domicilio con AMIZOO. El doctor hizo la consulta, me indicó el tratamiento y los medicamentos para darle a mi perrito. Tuvo dos controles y ya se encuentra mucho mejor y feliz con sus papitos. Muchas gracias AMIZOO por ayudar a mi peludito.'],
];

const bloques = {
  maletin: () => `<div class="maletin" data-maletin>
      <div class="maletin__cuerpo">
        <ul class="compartimentos" role="list">${servicios
          .map(
            (s) => `<li class="compartimento"><a href="/servicios#${s.id}">
            <span class="ic">${ico(s.icono)}</span>
            <strong>${esc(s.nombre)}</strong>
            <span class="meta">${esc(s.duracionTexto)}</span>
            <span class="precio">${esc(precioCorto(s.precio))}</span>
          </a></li>`
          )
          .join('')}</ul>
      </div>
    </div>`,

  desfile: () => {
    // Del más pequeño al más grande; los dibujos los pone amizoo.js. --s = ancho relativo.
    const fila = [
      ['ave', 'Aves', 0.07], ['hamster', 'Roedores', 0.085], ['gato', 'Gatos', 0.1], ['perro', 'Perros', 0.115],
      ['cerdo', 'Porcinos', 0.13], ['oveja', 'Ovinos', 0.14], ['cabra', 'Caprinos', 0.14], ['vaca', 'Bovinos', 0.2],
    ];
    const corazon = '<svg viewBox="0 0 32 30" focusable="false"><path d="M16 28C4 19 1 13 1 8.5 1 4 4.5 1 8.5 1c3.3 0 5.9 2 7.5 4.6C17.6 3 20.2 1 23.5 1 27.5 1 31 4 31 8.5 31 13 28 19 16 28Z"/></svg>';
    return `<div class="desfile" data-desfile>
      <ul class="desfile__fila" role="list" aria-label="Del más pequeño al más grande, todos con el mismo corazón">${fila
        .map(([t, n, s]) => `<li class="desfile__animal" data-tipo="${t}" style="--s:${s}"><span class="desfile__corazon" aria-hidden="true">${corazon}</span><span class="desfile__dibujo" data-dibujo aria-hidden="true"></span><span class="desfile__nombre">${n}</span></li>`)
        .join('')}</ul>
      <div class="desfile__suelo" aria-hidden="true"></div>
    </div>
      <ul class="especies-lista" role="list" aria-label="Especies que atendemos">${ORDEN_ESPECIES.map((e) => `<li>${ico(ESPECIES[e].i)} ${ESPECIES[e].n}</li>`).join('')}</ul>`;
  },

  'servicios-bento': () => {
    const [dest, ...resto] = servicios;
    return `<ul class="bento" role="list">
      <li class="destacado" data-revela><a class="tile" href="/servicios#${dest.id}">
        <div class="foto">${foto('perro-abrazo', 'Una mujer abraza a su perro en casa')}</div>
        <div class="cuerpo">
          <strong>${esc(dest.nombre)}</strong>
          <span class="meta">${esc(dest.descripcion)}</span>
          <div class="precio-grande"><div><span>En Bogotá</span><b>${cop(dest.precio.bogota)}</b></div><div><span>Fuera de Bogotá</span><b>${cop(dest.precio.fueraBogota)}</b></div></div>
        </div>
      </a></li>
      ${resto
        .map(
          (s) => `<li data-revela><a class="tile" href="/servicios#${s.id}">
        <span class="ic">${ico(s.icono)}</span>
        <strong>${esc(s.nombre)}</strong>
        <span class="meta">${esc(s.duracionTexto)}${s.modalidad === 'virtual' ? '' : ', en casa'}</span>
        <span class="precio">${esc(precioCorto(s.precio))}</span>
      </a></li>`
        )
        .join('')}
    </ul>`;
  },

  'servicios-filtro': () =>
    `<fieldset class="filtro-especie" data-filtro-especie>
      <legend>¿Qué animal tienes?</legend>
      <label class="chip-radio"><input type="radio" name="especie" value="" checked><span>Todos</span></label>
      ${ORDEN_ESPECIES.map((e) => `<label class="chip-radio"><input type="radio" name="especie" value="${e}"><span>${ESPECIES[e].n}</span></label>`).join('')}
    </fieldset>
    <p class="sr-only" aria-live="polite" data-filtro-estado></p>`,

  'servicios-lista': () =>
    `<ul class="servicios-lista" role="list" data-servicios>${servicios
      .map(
        (s) => `<li class="servicio" id="${s.id}" data-especies="${s.especies.join(' ')}" data-revela>
        <div class="servicio__principal">
          <div class="servicio__cab"><span class="servicio__icono">${ico(s.icono)}</span><h2>${esc(s.nombre)}</h2></div>
          <p>${esc(s.descripcion)}</p>
          ${s.nota ? `<p class="nota-servicio">${esc(s.nota)}</p>` : ''}
          <div><span class="sr-only">Especies: </span><ul class="chips" role="list">${s.especies.map((e) => `<li class="chip">${ESPECIES[e]?.n ?? esc(e)}</li>`).join('')}</ul></div>
          <div class="servicio__datos">
            <span>${ico('clock')} ${esc(s.duracionTexto)}</span>
            <span>${s.modalidad === 'virtual' ? ico('video-camera') + ' Virtual, por videollamada' : ico('house-line') + ' En tu casa o finca'}</span>
          </div>
        </div>
        <div class="servicio__lateral">
          ${etiquetaPrecio(s.precio)}
          <a class="btn btn-primario btn-bloque" href="/agendar?servicio=${s.id}">${ico('calendar-check')} Agendar</a>
        </div>
      </li>`
      )
      .join('')}</ul>
      <p class="vacio" data-vacio hidden>No tenemos servicios para esa especie todavía. <a href="${WA}">Escríbenos por WhatsApp</a> y te orientamos.</p>`,

  especies: () => {
    const fotos = [
      ['gato-manta', 'Gatos', 'Consulta, vacunas, nutrición', 'Gato dormido bajo una manta'],
      ['periquitos-rama', 'Aves', 'Compañía y producción', 'Periquitos australianos en una rama'],
      ['cachorro', 'Perros', 'Del cachorro al abuelo', 'Joven abrazando a su cachorro'],
      ['cabra', 'Caprinos', 'Asesoría zootécnica', 'Cabrita comiendo pasto'],
      ['vacas', 'Bovinos', 'Consulta y producción en finca', 'Terneros en un establo'],
      ['ovejas', 'Ovinos', 'Manejo y bienestar', 'Ovejas pastando'],
    ];
    return `<div class="mosaico">${fotos
      .map(([f, n, d, alt]) => `<figure data-revela><div class="img">${foto(f, alt, { sizes: '(min-width: 900px) 40vw, 50vw' })}</div><figcaption>${n}<span>${d}</span></figcaption></figure>`)
      .join('')}</div>
      <ul class="especies-lista" role="list" aria-label="Especies que atendemos">${ORDEN_ESPECIES.map((e) => `<li>${ico(ESPECIES[e].i)} ${ESPECIES[e].n}</li>`).join('')}</ul>`;
  },

  'plan-preventiva': () => {
    const p = planes.preventiva;
    const fotosPlan = { Perros: ['perro-abrazo-2', 'Dos personas abrazan a su perro'], Gatos: ['gato-sofa', 'Gato descansando en el sofá'] };
    return `<article class="plan-destacado" id="${p.id}" data-revela>
      <div>
        <h2>${esc(p.nombre)}</h2>
        <p class="lead">${esc(p.pago)}, ${esc(p.condicion.toLowerCase())}.</p>
        <h3>Incluye</h3>
        <ul class="lista-check" role="list">${p.incluye.map((i) => `<li><span class="marca-check">${ico('check')}</span><span>${esc(i)}</span></li>`).join('')}</ul>
        <p>La aplicación de los servicios se ajusta a las necesidades y antecedentes de cada paciente.</p>
      </div>
      <div class="precios-plan">
        ${p.precios.map((x) => `<div class="precio-plan"><div><span class="especie-n">${esc(x.especie)}</span><span class="valor">${cop(x.valor)}</span><span class="periodo">pago anual</span></div>${foto(...(fotosPlan[x.especie] || fotosPlan.Perros), { sizes: '88px' })}</div>`).join('')}
        <a class="btn btn-primario btn-grande btn-bloque" href="${waMsg('Hola AmiZoo, quiero adquirir el Plan de Medicina Preventiva.')}">${ico('whatsapp-logo')} Quiero este plan</a>
      </div>
    </article>`;
  },

  membresias: () =>
    `<ul class="membresias" role="list">${planes.membresias.planes
      .map(
        (m) => `<li class="membresia" id="${m.id}" data-revela>
        <h3>${esc(m.nombre)}</h3>
        ${
          m.precioMensual
            ? `<p class="valor">${cop(m.precioMensual)} / mes</p><ul class="lista-check" role="list">${m.beneficios.map((b) => `<li><span class="marca-check">${ico('check')}</span><span>${esc(b)}</span></li>`).join('')}</ul>`
            : `<span class="estado">Precios y beneficios próximamente</span><p>Mientras publicamos los detalles, te contamos todo por WhatsApp.</p>`
        }
        <a class="btn btn-borde" href="${waMsg(`Hola AmiZoo, quiero información de la membresía ${m.nombre}.`)}">${ico('whatsapp-logo')} Pedir información</a>
      </li>`
      )
      .join('')}</ul>`,

  'zonas-buscador': () =>
    `<div class="buscador-barrio" data-buscador-barrio>
      <label for="barrio">¿Llegamos a tu barrio?</label>
      <div class="campo-icono">${ico('magnifying-glass')}<input class="campo" id="barrio" type="search" autocomplete="off" placeholder="Escribe tu barrio o municipio" aria-describedby="barrio-resultado"></div>
      <p class="resultado" id="barrio-resultado" aria-live="polite"></p>
    </div>`,

  // Paisaje ilustrativo (no a escala) de las zonas; Amizoo lo recorre volando (amizoo.js).
  'zonas-mapa': () => {
    const X = { occidente: 82, norte: 250, oriente: 405, fuera: 560 };
    const zs = zonas.zonas.filter((z) => X[z.id]);
    const casa = (x, y, w, h, c) => `<g class="pz-crece" transform="translate(${x} ${y})"><g><rect x="0" y="${-h}" width="${w}" height="${h}" rx="3" class="pz-muro"/><path d="M-4 ${-h + 2} L${w / 2} ${-h - w * 0.55} L${w + 4} ${-h + 2} Z" class="pz-techo ${c || ''}"/><rect x="${w / 2 - 4}" y="-12" width="8" height="12" rx="2" class="pz-puerta"/></g></g>`;
    const edificio = (x, w, h) => {
      let ventanas = '';
      for (let yy = -h + 10; yy < -14; yy += 16) for (let xx = 6; xx < w - 8; xx += 11) ventanas += `<rect x="${xx}" y="${yy}" width="6" height="8" rx="1.5" class="pz-ventana"/>`;
      return `<g class="pz-crece" transform="translate(${x} 240)"><g><rect x="0" y="${-h}" width="${w}" height="${h}" rx="4" class="pz-edificio"/>${ventanas}</g></g>`;
    };
    const vaca = (x, y, f) => `<g class="pz-vaca" transform="translate(${x} ${y}) scale(${f} 1)"><ellipse cx="0" cy="-9" rx="13" ry="8" class="pz-vaca-cuerpo"/><ellipse cx="-4" cy="-11" rx="4" ry="3" class="pz-mancha"/><circle cx="13" cy="-14" r="5" class="pz-vaca-cuerpo"/><path d="M-8 -2 v6 M8 -2 v6" class="pz-patas"/></g>`;
    const arbol = (x, y, r) => `<g transform="translate(${x} ${y})"><g class="pz-arbol"><rect x="-2.5" y="-14" width="5" height="14" rx="2" class="pz-tronco"/><circle cy="${-14 - r * 0.7}" r="${r}" class="pz-copa"/></g></g>`;
    return `<figure class="mapa-zonas" data-mapa>
      <svg viewBox="0 0 640 320" role="img" aria-label="Paisaje ilustrativo de las zonas donde atendemos: ${zs.map((z) => esc(z.nombre)).join(', ')}" focusable="false">
        <rect width="640" height="320" rx="30" class="pz-cielo"/>
        <circle cx="585" cy="58" r="38" class="pz-sol"/>
        <g transform="translate(110 54)"><g class="pz-nube" data-nube><ellipse cx="0" cy="0" rx="34" ry="12"/><ellipse cx="18" cy="-9" rx="20" ry="11"/></g></g>
        <g transform="translate(360 44)"><g class="pz-nube" data-nube><ellipse cx="0" cy="0" rx="28" ry="10"/><ellipse cx="-14" cy="-7" rx="16" ry="9"/></g></g>
        <path d="M300 240 L352 132 L392 176 L440 104 L492 186 L530 150 L600 214 L640 200 V240 Z" class="pz-cerros"/>
        <path d="M455 240 Q545 176 640 220 V240 Z" class="pz-loma"/>
        <rect y="238" width="640" height="82" class="pz-suelo"/>
        <path d="M0 278 H640" class="pz-via"/><path d="M0 278 H640" class="pz-linea"/>
        ${casa(24, 240, 28, 22)}${casa(62, 240, 32, 28, 'pz-techo--b')}${casa(102, 240, 26, 20)}${arbol(140, 240, 11)}
        ${edificio(168, 30, 70)}${edificio(204, 26, 104)}${edificio(236, 34, 82)}${edificio(276, 28, 126)}
        ${casa(340, 236, 24, 20, 'pz-techo--b')}${casa(372, 228, 26, 22)}${arbol(408, 226, 10)}${casa(424, 234, 24, 18, 'pz-techo--b')}
        <g class="pz-crece" transform="translate(500 240)"><g><rect x="0" y="-36" width="44" height="36" rx="3" class="pz-granero"/><path d="M-5 -34 L22 -56 L49 -34 Z" class="pz-techo"/><path d="M12 0 V-18 H32 V0 M12 -18 L32 0 M32 -18 L12 0" class="pz-cruce"/></g></g>
        <path d="M555 236 H630 M558 236 V226 M576 236 V226 M594 236 V226 M612 236 V226 M630 236 V226 M555 229 H630" class="pz-cerca"/>
        ${vaca(574, 254, 1)}${vaca(612, 262, -1)}${arbol(470, 240, 12)}
        ${zs.map((z) => {
          const nombre = esc(z.nombre.replace('Zona ', '').replace('Fuera de Bogotá', 'Sabana Norte'));
          const w = Math.max(76, nombre.length * 9 + 22);
          return `<g class="pz-letrero" data-letrero="${z.id}" transform="translate(${X[z.id]} 266)"><g class="pz-letrero-in"><rect x="-3" y="-46" width="6" height="46" rx="2" class="pz-poste"/><rect x="${-w / 2}" y="-74" width="${w}" height="30" rx="8" class="pz-tabla"/><text y="-54" text-anchor="middle" class="pz-texto">${nombre}</text></g></g>`;
        }).join('')}
        <g data-globo-pos transform="translate(560 112)"><g class="pz-globo" data-globo-mapa><rect x="-64" y="-28" width="128" height="30" rx="15"/><text y="-8" text-anchor="middle">¡Aquí llegamos!</text></g></g>
        <g class="pz-ave" data-ave-mapa></g>
      </svg>
      <figcaption>Paisaje ilustrativo, no a escala. La cobertura se confirma según la dirección.</figcaption>
    </figure>`;
  },

  'zonas-recorridos': () =>
    `<div class="recorridos">${zonas.zonas
      .map(
        (z) => `<section class="recorrido${z.tarifa === 'fueraBogota' ? ' recorrido--fuera' : ''}" aria-labelledby="zona-${z.id}" data-revela>
        <h3 id="zona-${z.id}">${esc(z.nombre)}</h3>
        <span class="tarifa">${z.tarifa === 'fueraBogota' ? 'Tarifa fuera de Bogotá' : 'Tarifa Bogotá'}</span>
        <ul class="paradas" role="list">${z.barrios.map((b) => `<li data-barrio="${esc(b)}">${esc(b)}</li>`).join('')}</ul>
      </section>`
      )
      .join('')}</div>`,

  faq: () => {
    const enlazar = (t) =>
      esc(t).replace(/https:\/\/wa\.me\/573142300347/g, `</p><p><a class="btn btn-primario" href="${WA}">${ico('whatsapp-logo')} Hablar por WhatsApp</a>`);
    const cuerpo = (r) =>
      r
        .split('\n\n')
        .map((p) => {
          const lineas = p.split('\n');
          const items = lineas.filter((l) => l.startsWith('- '));
          const texto = lineas.filter((l) => !l.startsWith('- '));
          let html = texto.length ? `<p>${enlazar(texto.join(' '))}</p>` : '';
          if (items.length) html += `<ul>${items.map((i) => `<li>${esc(i.slice(2))}</li>`).join('')}</ul>`;
          return html;
        })
        .join('')
        .replace(/<p>\s*<\/p>/g, '');
    return faq.grupos
      .map(
        (g) => `<section class="faq-grupo" aria-labelledby="g-${g.id}" data-faq-grupo>
        <h2 id="g-${g.id}">${esc(g.titulo)}</h2>
        <div class="faq">${faq.preguntas
          .filter((q) => q.grupo === g.id)
          .map(
            (q) => `<details id="${q.id}" data-claves="${esc(q.claves.join(' '))}">
            <summary>${esc(q.pregunta)}<span class="signo" aria-hidden="true"></span></summary>
            <div class="respuesta">${cuerpo(q.respuesta)}</div>
          </details>`
          )
          .join('')}</div>
      </section>`
      )
      .join('');
  },

  testimonios: () =>
    `<div class="carrusel" tabindex="0" aria-label="Testimonios de clientes" data-carrusel>${TESTIMONIOS.map(
      ([quien, nombre, especie, corto, largo]) => `<figure class="testimonio" data-dibujo-tipo="${/cacat|ave|loro|periq/i.test(especie) ? 'ave' : /gat/i.test(especie) ? 'gato' : 'perro'}">
        <span class="testimonio__mascota" data-dibujo aria-hidden="true"></span>
        <span class="testimonio__comillas" aria-hidden="true">“</span>
        <blockquote><p>“${esc(corto)}”</p></blockquote>
        <details><summary>Leer opinión completa</summary><p>${esc(largo)}</p></details>
        <figcaption><span class="inicial" aria-hidden="true">${esc(quien[0])}</span><span><span class="quien">${esc(quien)}</span><span class="mascota">${esc(nombre)} (${esc(especie)})</span></span></figcaption>
      </figure>`
    ).join('')}</div>`,
};

// ---------- Layout ----------
const NAV = [
  ['/', 'Inicio'],
  ['/servicios', 'Servicios'],
  ['/planes', 'Planes'],
  ['/nosotros', 'Nosotros'],
  ['/preguntas-frecuentes', 'Preguntas frecuentes'],
  ['/contacto', 'Contacto'],
];

function layout(meta, contenido) {
  const actual = (h) => (h === meta.path ? ' aria-current="page"' : '');
  const url = SITE + (meta.path === '/' ? '/' : meta.path);
  const titulo = meta.path === '/' ? meta.title : `${meta.title} | AmiZoo`;
  const jsonld =
    meta.path === '/'
      ? `<script type="application/ld+json">${JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'VeterinaryCare',
          name: 'AmiZoo',
          description: 'Servicios veterinarios y zootécnicos a domicilio en Bogotá y la Sabana Norte de Cundinamarca.',
          url: SITE + '/',
          logo: SITE + '/assets/logos/isotipo-512.png',
          image: SITE + '/assets/logos/LOGO_TIPO.png',
          telephone: '+57 314 230 0347',
          email: 'amizoo.contacto@gmail.com',
          slogan: 'Diferentes tamaños, misma importancia.',
          priceRange: '$40.000 - $520.000',
          areaServed: [
            { '@type': 'City', name: 'Bogotá' },
            { '@type': 'AdministrativeArea', name: 'Sabana Norte de Cundinamarca' },
          ],
          openingHoursSpecification: [
            { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '18:00' },
          ],
          sameAs: ['https://www.instagram.com/amizoo.co', 'https://www.tiktok.com/@amizoo.co', 'https://www.facebook.com/AmiZoo'],
        })}</script>`
      : '';

  return `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(meta.description)}">
<link rel="canonical" href="${url}">
${meta.noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta name="theme-color" content="#F7F8F4">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_CO">
<meta property="og:site_name" content="AmiZoo">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/logos/LOGO_TIPO.png">
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/logos/isotipo-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="/assets/logos/isotipo-192.png">
<link rel="apple-touch-icon" href="/assets/logos/isotipo-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Open+Sans:wght@400;600;700&display=swap">
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
<link rel="stylesheet" href="/assets/css/styles.css?v=${ASSET_V}">
${(meta.css || []).map((c) => `<link rel="stylesheet" href="/assets/css/${c}.css?v=${ASSET_V}">`).join('\n')}
<script>document.documentElement.classList.add('js')</script>
${jsonld}
</head>
<body${meta.layout === 'panel' ? ' class="cuerpo-panel"' : ''}>
<a class="saltar-contenido" href="#contenido">Saltar al contenido</a>
${meta.layout === 'panel' ? `
<header class="cabecera cabecera--panel">
  <div class="cabecera__fila cabecera__fila--panel">
    <a class="marca" href="/panel" aria-label="Panel de AmiZoo"><img src="/assets/logos/logo-horizontal-480.png" width="480" height="181" alt="AmiZoo"></a>
    <span class="etiqueta-panel">Panel</span>
    <div class="cabecera__acciones">
      <span class="quien" data-quien></span>
      <button class="btn btn-borde" type="button" data-salir>${ico('sign-out')} Salir</button>
    </div>
  </div>
</header>
<main id="contenido" tabindex="-1">
${contenido}
</main>
<div class="avisos" role="status" aria-live="polite" data-avisos></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js" defer></script>
${(meta.js || []).map((j) => `<script src="/assets/js/${j}.js?v=${ASSET_V}" defer></script>`).join('\n')}
<script src="/assets/js/amizoo.js?v=${ASSET_V}" defer></script>
</body>
</html>
` : `
<header class="cabecera">
  <div class="contenedor cabecera__fila">
    <a class="marca" href="/" aria-label="AmiZoo, ir al inicio"><img src="/assets/logos/logo-horizontal-480.png" width="480" height="181" alt="AmiZoo"></a>
    <nav class="nav" aria-label="Principal">
      <ul>${NAV.map(([h, t]) => `<li><a href="${h}"${actual(h)}>${t}</a></li>`).join('')}</ul>
    </nav>
    <div class="cabecera__acciones">
      <a class="btn btn-borde btn-cuenta" href="/mi-cuenta"${actual('/mi-cuenta')}>${ico('user')} Mi cuenta</a>
      <a class="btn btn-primario" href="/agendar"><span>Agenda<span class="texto-largo"> tu cita</span></span></a>
      <button class="btn-menu" type="button" aria-expanded="false" aria-controls="menu-movil" data-abrir-menu>${ico('list')} Menú</button>
    </div>
  </div>
</header>

<div class="menu-movil" id="menu-movil" role="dialog" aria-modal="true" aria-label="Menú" data-menu>
  <div class="menu-movil__top">
    <img src="/assets/logos/logo-horizontal-480.png" width="480" height="181" alt="AmiZoo" style="height:38px;width:auto">
    <button class="btn btn-borde" type="button" data-cerrar-menu>${ico('x')} Cerrar</button>
  </div>
  <ul>${NAV.map(([h, t]) => `<li><a class="enlace" href="${h}"${actual(h)}>${t}</a></li>`).join('')}
    <li><a class="enlace" href="/mi-cuenta"${actual('/mi-cuenta')}>Mi cuenta</a></li></ul>
  <div class="grupo-botones">
    <a class="btn btn-primario btn-grande" href="/agendar">${ico('calendar-check')} Agenda tu cita</a>
    <a class="btn btn-borde btn-grande" href="${WA}">${ico('whatsapp-logo')} Escríbenos por WhatsApp</a>
  </div>
</div>

<main id="contenido" tabindex="-1">
${contenido}
</main>

<footer class="pie">
  <div class="contenedor pie__grid">
    <div>
      <img class="logo" src="/assets/logos/logo-vertical-360.png" width="360" height="318" alt="AmiZoo" loading="lazy">
      <p class="pie__eslogan">Diferentes tamaños, misma importancia.</p>
      <p>Servicios veterinarios y zootécnicos a domicilio en Bogotá y la Sabana Norte. Lunes a viernes, 8:00 a.&nbsp;m. a 6:00 p.&nbsp;m.</p>
      <p><strong>No atendemos urgencias.</strong></p>
    </div>
    <div>
      <h2>Navega</h2>
      <ul>${NAV.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h2>Contacto</h2>
      <ul>
        <li><a href="${WA}">${ico('whatsapp-logo')} 314 230 0347</a></li>
        <li><a href="mailto:amizoo.contacto@gmail.com">${ico('envelope-simple')} amizoo.contacto@gmail.com</a></li>
      </ul>
    </div>
    <div>
      <h2>Síguenos</h2>
      <ul>
        <li><a href="https://www.instagram.com/amizoo.co" rel="noopener">${ico('instagram-logo')} amizoo.co</a></li>
        <li><a href="https://www.facebook.com/AmiZoo" rel="noopener">${ico('facebook-logo')} AmiZoo</a></li>
        <li><a href="https://www.tiktok.com/@amizoo.co" rel="noopener">${ico('tiktok-logo')} amizoo.co</a></li>
      </ul>
    </div>
  </div>
  <div class="contenedor pie__legal">
    <p>© ${new Date().getFullYear()} AmiZoo. <a href="/politica-de-datos">Política de tratamiento de datos personales</a>. <a href="/terminos">Términos y condiciones</a>.</p>
    <p>Hecho con amor por JuanCode</p>
  </div>
</footer>

<a class="flot-wa" href="${WA}" aria-label="Escríbenos por WhatsApp">${ico('whatsapp-logo')}<span class="txt">WhatsApp</span></a>

<script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js" defer></script>
<script src="/assets/js/main.js?v=${ASSET_V}" defer></script>
${(meta.js || []).map((j) => `<script src="/assets/js/${j}.js?v=${ASSET_V}" defer></script>`).join('\n')}
<script src="/assets/js/amizoo.js?v=${ASSET_V}" defer></script>
${meta.js ? '<div class="avisos" role="status" aria-live="polite" data-avisos></div>' : ''}
</body>
</html>
`}`;
}

// ---------- Proceso ----------
const paginas = fs.readdirSync(SRC).filter((f) => f.endsWith('.html'));
const mapa = [];
for (const archivo of paginas) {
  let src = fs.readFileSync(path.join(SRC, archivo), 'utf8');
  const m = src.match(/^<!--meta\s+([\s\S]*?)\s*-->/);
  if (!m) throw new Error(`Falta <!--meta--> en ${archivo}`);
  const meta = JSON.parse(m[1]);
  src = src.slice(m[0].length);
  src = src.replace(/\{\{([a-z-]+)\}\}/g, (todo, k) => {
    if (k === 'wa') return WA;
    if (!bloques[k]) throw new Error(`Bloque desconocido {{${k}}} en ${archivo}`);
    return bloques[k]();
  });
  src = src.replace(/\{\{foto:([a-z0-9-]+):([^:}]*):([^}]*)\}\}/g, (_, n, opc, alt) =>
    foto(n, alt, { lazy: !opc.includes('prioridad'), sizes: opc.includes('mitad') ? '(min-width: 900px) 45vw, 100vw' : '(min-width: 900px) 50vw, 100vw' })
  );
  src = src.replace(/\{\{ico:([a-z-]+)\}\}/g, (_, id) => ico(id));
  src = src.replace(/\{\{wa-msg:([^}]+)\}\}/g, (_, t) => waMsg(t));
  src = src.replace(/\{\{mascota\}\}/g, MASCOTA);
  if (/\{\{/.test(src)) throw new Error(`Marcador sin resolver en ${archivo}: ${src.match(/\{\{[^}]*\}\}/)[0]}`);
  fs.writeFileSync(path.join(OUT, archivo), layout(meta, src.trim()));
  if (!meta.noindex) mapa.push(meta.path);
  console.log('✓', archivo);
}

fs.writeFileSync(
  path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${mapa.map((p) => `  <url><loc>${SITE}${p === '/' ? '/' : p}</loc></url>`).join('\n')}
</urlset>
`
);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /panel\nDisallow: /mi-cuenta\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log('✓ sitemap.xml, robots.txt');
