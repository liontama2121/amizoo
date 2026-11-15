/* AmiZoo — interacciones del sitio público (vanilla JS) */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const normalizar = (t) =>
    String(t || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9ñ ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const almacen = {
    leer(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
    guardar(k, v) { try { window.localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };

  /* ---------- Menú móvil ---------- */
  const menu = $('[data-menu]');
  const abrirMenu = $('[data-abrir-menu]');
  if (menu && abrirMenu) {
    const cerrar = () => {
      menu.classList.remove('abierto');
      abrirMenu.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      abrirMenu.focus();
    };
    abrirMenu.addEventListener('click', () => {
      menu.classList.add('abierto');
      abrirMenu.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      $('[data-cerrar-menu]', menu)?.focus();
    });
    $('[data-cerrar-menu]', menu)?.addEventListener('click', cerrar);
    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cerrar();
      if (e.key === 'Tab') {
        const f = $$('a, button', menu);
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  /* ---------- Revelado y ruta ---------- */
  const animables = $$('[data-revela], [data-anim]');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(
      (entradas) => entradas.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
      }),
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    );
    animables.forEach((el) => io.observe(el));
  } else {
    animables.forEach((el) => el.classList.add('visible'));
  }

  /* ---------- Filtro de servicios por especie ---------- */
  const filtro = $('[data-filtro-especie]');
  if (filtro) {
    const items = $$('[data-servicios] > .servicio');
    const vacio = $('[data-vacio]');
    const estado = $('[data-filtro-estado]');
    const aplicar = (esp) => {
      let n = 0;
      items.forEach((li) => {
        const ok = !esp || li.dataset.especies.split(' ').includes(esp);
        li.hidden = !ok;
        if (ok) n++;
      });
      if (vacio) vacio.hidden = n > 0;
      if (estado) estado.textContent = `${n} ${n === 1 ? 'servicio' : 'servicios'} disponibles`;
    };
    filtro.addEventListener('change', (e) => {
      if (e.target.name === 'especie') aplicar(e.target.value);
    });
    const desdeUrl = new URLSearchParams(location.search).get('especie');
    if (desdeUrl) {
      const r = $(`input[value="${CSS.escape(desdeUrl)}"]`, filtro);
      if (r) { r.checked = true; aplicar(desdeUrl); }
    }
  }

  /* ---------- Buscador de barrio ---------- */
  const buscador = $('[data-buscador-barrio]');
  if (buscador) {
    const input = $('input', buscador);
    const salida = $('.resultado', buscador);
    const paradas = $$('.paradas li');
    const WA = 'https://wa.me/573142300347?text=';
    let t;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const q = normalizar(input.value);
        paradas.forEach((p) => p.classList.remove('coincide'));
        resaltarZona(null);
        if (q.length < 3) { salida.textContent = ''; return; }
        const hits = paradas.filter((p) => normalizar(p.dataset.barrio).includes(q));
        if (hits.length) {
          hits.forEach((p) => p.classList.add('coincide'));
          resaltarZona(hits[0].closest('.recorrido')?.getAttribute('aria-labelledby')?.replace('zona-', ''));
          const zona = hits[0].closest('.recorrido')?.querySelector('h3')?.textContent.trim();
          salida.textContent = `¡Sí llegamos! ${hits[0].dataset.barrio} está en ${zona}.`;
        } else {
          salida.innerHTML = '';
          const p = document.createElement('span');
          p.textContent = `No vemos “${input.value.trim()}” en nuestras zonas, pero la cobertura se verifica según la dirección. Escríbenos y te confirmamos.`;
          const a = document.createElement('a');
          a.className = 'btn btn-primario';
          a.href = WA + encodeURIComponent(`Hola AmiZoo, ¿llegan a ${input.value.trim()}?`);
          a.textContent = 'Preguntar por WhatsApp';
          salida.append(p, document.createElement('br'), a);
        }
      }, 180);
    });
  }

  /* ---------- Buscador de preguntas frecuentes ---------- */
  const buscarFaq = $('[data-buscar-faq]');
  if (buscarFaq) {
    const detalles = $$('.faq details');
    const grupos = $$('[data-faq-grupo]');
    const salida = $('#faq-resultado');
    buscarFaq.addEventListener('input', () => {
      const palabras = normalizar(buscarFaq.value).split(' ').filter((w) => w.length > 2);
      let n = 0;
      detalles.forEach((d) => {
        const texto = normalizar(d.dataset.claves + ' ' + d.textContent);
        const ok = !palabras.length || palabras.some((w) => texto.includes(w));
        d.hidden = !ok;
        if (ok) n++;
      });
      grupos.forEach((g) => { g.hidden = !$$('details:not([hidden])', g).length; });
      salida.textContent = palabras.length ? (n ? `${n} ${n === 1 ? 'pregunta encontrada' : 'preguntas encontradas'}` : 'No encontramos esa pregunta. Escríbenos por WhatsApp y te ayudamos.') : '';
    });
    if (location.hash) { const d = $(location.hash); if (d?.tagName === 'DETAILS') d.open = true; }
  }

  /* ---------- Carrusel de testimonios ---------- */
  const carrusel = $('[data-carrusel]');
  if (carrusel) {
    const paso = (dir) => {
      const tarjeta = carrusel.querySelector('.testimonio');
      const ancho = tarjeta ? tarjeta.getBoundingClientRect().width + 16 : 300;
      carrusel.scrollBy({ left: dir * ancho, behavior: reduce ? 'auto' : 'smooth' });
    };
    $('[data-carrusel-ant]')?.addEventListener('click', () => paso(-1));
    $('[data-carrusel-sig]')?.addEventListener('click', () => paso(1));
    // Avance automático suave; se pausa con el mouse encima, con el foco o al tocar.
    if (!reduce) {
      let quieto = false;
      let enPantalla = false;
      ['pointerenter', 'focusin', 'touchstart'].forEach((ev) => carrusel.addEventListener(ev, () => { quieto = true; }, { passive: true }));
      ['pointerleave', 'focusout'].forEach((ev) => carrusel.addEventListener(ev, () => { quieto = false; }));
      new IntersectionObserver((e) => { enPantalla = e[0].isIntersecting; }, { threshold: 0.5 }).observe(carrusel);
      setInterval(() => {
        if (quieto || !enPantalla || document.hidden) return;
        const fin = carrusel.scrollLeft + carrusel.clientWidth >= carrusel.scrollWidth - 8;
        if (fin) carrusel.scrollTo({ left: 0, behavior: 'smooth' }); else paso(1);
      }, 6000);
    }
  }

  /* ---------- Agenda temporal: servicio en el mensaje de WhatsApp ---------- */
  const waServ = $('[data-wa-servicio]');
  const servParam = new URLSearchParams(location.search).get('servicio');
  if (waServ && servParam) {
    const nombre = servParam.replace(/-/g, ' ');
    waServ.href = 'https://wa.me/573142300347?text=' + encodeURIComponent(`Hola AmiZoo, quiero agendar: ${nombre}.`);
  }

  /* ---------- "Sin transporte, sin salas de espera": el carro veterinario llega a la casa ---------- */
  const ruta = $('[data-ruta]');
  if (ruta) {
    const A = window.anime;
    const camino = $('#rv-camino', ruta);
    const carro = $('[data-rv-carro]', ruta);
    const paradas = $$('[data-rv-parada]', ruta);
    const pasos = $$('.como .pasos li');
    const puerta = $('[data-rv-puerta]', ruta);
    const corazones = $$('[data-rv-corazones] path', ruta);
    const rayas = $$('.sin-raya', ruta);
    const largo = camino.getTotalLength();
    const UMBRALES = [0.02, 0.5, 0.97];
    const ubicar = (p) => {
      const d = Math.max(0, Math.min(1, p)) * largo;
      const a = camino.getPointAtLength(d);
      const b = camino.getPointAtLength(Math.min(largo, d + 2));
      const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      carro.setAttribute('transform', `translate(${a.x} ${a.y}) rotate(${ang})`);
    };
    const activar = (n, si) => {
      paradas[n]?.classList.toggle('activa', si);
      pasos[n]?.classList.toggle('activo', si);
    };
    if (reduce || !A) {
      ubicar(1);
      paradas.forEach((_, i) => activar(i, true));
    } else {
      ubicar(0);
      // Las ruedas giran y la sirena parpadea mientras el carro avanza
      const ruedas = A({ targets: $$('[data-rv-rueda]', ruta), rotate: '1turn', duration: 700, easing: 'linear', loop: true, autoplay: false });
      const sirena = A({ targets: $('[data-rv-sirena]', ruta), opacity: [1, 0.25], direction: 'alternate', duration: 260, easing: 'linear', loop: true, autoplay: false });
      rayas.forEach((r) => r.style.setProperty('--raya', '0'));
      let viaje = null;
      let visible = false;
      let espera = null;
      const llegar = () => {
        ruedas.pause();
        sirena.pause();
        A.timeline({ easing: 'easeOutQuad' })
          .add({ targets: puerta, scaleX: [1, 0.08], duration: 520, easing: 'easeInOutQuad' })
          .add({ targets: corazones, opacity: [0, 1, 0], translateY: [0, -34], scale: [0.4, 1.15], delay: A.stagger(140), duration: 1300 }, '-=200')
          .add({ targets: puerta, scaleX: [0.08, 1], duration: 520, delay: 900, easing: 'easeInOutQuad' });
        espera = setTimeout(() => { if (visible) iniciar(); }, 4200);
      };
      const iniciar = () => {
        clearTimeout(espera);
        paradas.forEach((_, i) => activar(i, false));
        rayas.forEach((r, i) => {
          r.style.setProperty('--raya', '0');
          const o = { v: 0 };
          A({ targets: o, v: 1, delay: 400 + i * 250, duration: 450, easing: 'easeOutQuad', update: () => r.style.setProperty('--raya', o.v.toFixed(3)) });
        });
        const estado = { p: 0 };
        ruedas.play();
        sirena.play();
        viaje = A({
          targets: estado, p: 1, duration: 7000, easing: 'easeInOutSine',
          update: () => {
            ubicar(estado.p);
            UMBRALES.forEach((u, i) => {
              if (estado.p >= u && !paradas[i].classList.contains('activa')) {
                activar(i, true);
                A({ targets: paradas[i].querySelector('.rv-pin'), r: [26, 33, 26], duration: 600, easing: 'easeOutBack' });
              }
            });
          },
          complete: llegar,
        });
      };
      new IntersectionObserver((e) => {
        visible = e[0].isIntersecting;
        if (visible && !viaje) iniciar();
        else if (visible && viaje && !viaje.completed && viaje.paused) { viaje.play(); ruedas.play(); sirena.play(); }
        else if (!visible && viaje && !viaje.completed) { viaje.pause(); ruedas.pause(); sirena.pause(); }
      }, { threshold: 0.35 }).observe(ruta);
    }
  }

  /* ---------- Animaciones de secciones del inicio ---------- */
  const A2 = window.anime;
  const alVer = (el, fn, umbral = 0.3) => {
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold: umbral });
    io.observe(el);
  };
  const enVista = (el) => {
    const o = { v: false };
    if (el) new IntersectionObserver((e) => { o.v = e[0].isIntersecting; }).observe(el);
    return o;
  };

  // Mapa: resaltar la zona que encontró el buscador
  function resaltarZona(id) {
    $$('[data-letrero]').forEach((l) => l.classList.toggle('resaltado', !!id && l.dataset.letrero === id));
    window.AmizooMapa?.ir(id); // Amizoo vuela al letrero de esa zona
  }


  if (A2 && !reduce) {
    // Indicaciones: cada punto entra, se dibuja su chulito y salta su dibujito
    const lista = $('[data-indicaciones]');
    if (lista) {
      const items = $$('li', lista);
      items.forEach((li) => {
        const path = $('.marca-check path', li);
        const largo = path.getTotalLength();
        path.style.strokeDasharray = largo;
        path.style.strokeDashoffset = largo;
        li.style.opacity = 0;
        $$('.ind-ilus .ph', li).forEach((i) => { i.style.transform = 'scale(0)'; });
      });
      alVer(lista, () => {
        items.forEach((li, i) => {
          A2.timeline({ delay: i * 650, easing: 'easeOutQuart' })
            .add({ targets: li, opacity: [0, 1], translateX: [-40, 0], duration: 600 })
            .add({ targets: $('.marca-check', li), scale: [0.6, 1.15, 1], duration: 420, easing: 'easeOutBack' }, '-=250')
            .add({ targets: $('.marca-check path', li), strokeDashoffset: [A2.setDashoffset, 0], duration: 420, easing: 'easeInOutSine' }, '-=300')
            .add({ targets: $$('.ind-ilus .ph', li), scale: [0, 1.2, 1], rotate: [-25, 8, 0], delay: A2.stagger(120), duration: 650, easing: 'easeOutBack' }, '-=150');
        });
        const ilus = $$('.ind-ilus .ph', lista);
        const vis = enVista(lista);
        setInterval(() => {
          if (vis.v) A2({ targets: ilus[Math.floor(Math.random() * ilus.length)], rotate: [0, -14, 12, 0], translateY: [0, -6, 0], duration: 700, easing: 'easeInOutSine' });
        }, 2200);
      });
    }
    const fichas = $('[data-fichas]');
    if (fichas) {
      const lista2 = $$('.fichas li', fichas);
      lista2.forEach((f) => { f.style.opacity = 0; });
      alVer(fichas, () => A2({ targets: lista2, opacity: [0, 1], translateY: [-50, 0], rotate: () => [A2.random(-25, 25), 0], delay: A2.stagger(110, { start: 300 }), duration: 900, easing: 'easeOutBounce' }));
    }

    // Puerta: se abre, entran huellitas y se cierra
    const puerta = $('[data-puerta]');
    if (puerta) {
      const hoja = $('[data-puerta-hoja]', puerta);
      const luz = $('.pa-luz', puerta);
      const huellas = $$('.pa-huellas g', puerta);
      A2.set(huellas, { opacity: 0 });
      A2.set(luz, { opacity: 0 });
      const vis = enVista(puerta);
      const ciclo = () => {
        if (!vis.v) { setTimeout(ciclo, 1200); return; }
        A2.timeline({ easing: 'easeInOutQuad', complete: () => setTimeout(ciclo, 2600) })
          .add({ targets: hoja, scaleX: [1, 0.12], duration: 700 })
          .add({ targets: luz, opacity: [0, 1], duration: 400 }, '-=500')
          .add({ targets: huellas, opacity: [0, 1, 1, 0], delay: A2.stagger(260), duration: 1300, easing: 'easeOutQuad' }, '-=200')
          .add({ targets: luz, opacity: [1, 0], duration: 400 })
          .add({ targets: hoja, scaleX: [0.12, 1], duration: 700 }, '-=400');
      };
      alVer(puerta, ciclo);
    }
    const tarjetas = $$('.testimonio');
    if (tarjetas.length) {
      tarjetas.forEach((t) => { t.style.opacity = 0; });
      alVer(tarjetas[0].parentElement, () => {
        A2({ targets: tarjetas, opacity: [0, 1], translateY: [50, 0], rotate: [() => A2.random(-4, 4), 0], delay: A2.stagger(140), duration: 900, easing: 'easeOutQuart' });
        A2({ targets: $$('.testimonio__comillas'), scale: [0, 1.3, 1], delay: A2.stagger(140, { start: 500 }), duration: 700, easing: 'easeOutBack' });
      }, 0.15);
    }

    // Calendario: pasa la hoja, se encierra el día, sello con chulito y corazones
    const cal = $('[data-calendario]');
    if (cal) {
      const frente = $('[data-cal-frente]', cal);
      const circulo = $('[data-cal-circulo]', cal);
      const sello = $('[data-cal-sello]', cal);
      const corazonesCal = $$('[data-cal-corazones] path', cal);
      const dias = $$('.cal-dia', cal);
      const largoC = circulo.getTotalLength();
      circulo.style.strokeDasharray = largoC;
      circulo.style.strokeDashoffset = largoC;
      sello.style.opacity = 0;
      const vis = enVista(cal);
      const ciclo = () => {
        if (!vis.v) { setTimeout(ciclo, 1200); return; }
        sello.style.opacity = 0;
        circulo.style.strokeDashoffset = largoC;
        dias.forEach((d) => d.classList.remove('hoy'));
        A2.timeline({ easing: 'easeInOutQuad', complete: () => setTimeout(ciclo, 2800) })
          .add({ targets: frente, scaleY: [1, 0.05], duration: 380, easing: 'easeInQuad' })
          .add({ targets: frente, scaleY: [0.05, 1], duration: 420, easing: 'easeOutBack' })
          .add({ targets: dias, opacity: [0.3, 1], delay: A2.stagger(30), duration: 300, complete: () => dias[13]?.classList.add('hoy') }, '-=200')
          .add({ targets: circulo, strokeDashoffset: [largoC, 0], duration: 800, easing: 'easeInOutSine' })
          .add({ targets: sello, opacity: [0, 1], scale: [2.2, 1], rotate: [-30, -8], duration: 520, easing: 'easeOutBack' })
          .add({ targets: corazonesCal, opacity: [0, 1, 0], translateY: [0, -30], scale: [0.5, 1.2], delay: A2.stagger(150), duration: 1400, easing: 'easeOutQuad' }, '-=200');
      };
      alVer(cal, ciclo);
    }
  } else {
    $$('.cal-dia')[13]?.classList.add('hoy');
  }

})();
