/* Entrar, crear cuenta, recuperar y restablecer contraseña. */
(() => {
  'use strict';
  const { api, enviar } = window.AZ;

  // Solo se vuelve a rutas internas del sitio.
  const volver = (rol) => {
    const v = new URLSearchParams(location.search).get('volver') || '';
    const interno = /^\/(?!\/)[\w\-/#]*$/.test(v) ? v : '';
    if (interno && !(rol === 'cliente' && interno.startsWith('/panel'))) return interno;
    return rol === 'admin' ? '/panel' : '/mi-cuenta';
  };

  document.querySelectorAll('[data-ver-clave]').forEach((b) => b.addEventListener('click', () => {
    const input = b.parentElement.querySelector('input');
    const ver = input.type === 'password';
    input.type = ver ? 'text' : 'password';
    b.setAttribute('aria-pressed', String(ver));
    b.lastChild.textContent = ver ? ' Ocultar' : ' Ver';
  }));

  // Amizoo posado en la tarjeta (amizoo.js). Opcional: sin él todo funciona igual.
  const ave = () => window.AmizooAcceso;
  const fallo = (form) => {
    const msg = form.querySelector('[data-error]')?.textContent.trim();
    ave()?.error(msg ? `Uy… ${msg.charAt(0).toLowerCase()}${msg.slice(1)}` : 'Revisa los datos marcados y probamos otra vez.');
  };

  const acciones = {
    async entrar(form) {
      ave()?.pensando();
      const r = await enviar(form, (d) => api('/api/auth/entrar', { metodo: 'POST', datos: d, silencioso401: true }));
      if (!r) return fallo(form);
      await ave()?.exito(r.usuario.nombre);
      location.href = volver(r.usuario.rol);
    },
    async registro(form) {
      ave()?.pensando();
      const r = await enviar(form, (d) => api('/api/auth/registro', { metodo: 'POST', datos: { ...d, aceptaDatos: !!d.aceptaDatos } }));
      if (!r) return fallo(form);
      await ave()?.exito(r.usuario?.nombre);
      const destino = volver('cliente');
      // Cuenta nueva: Amizoo da el recorrido por el portal.
      location.href = destino.startsWith('/mi-cuenta') ? '/mi-cuenta?tour=1' : destino;
    },
    async recuperar(form) {
      ave()?.pensando();
      const r = await enviar(form, (d) => api('/api/auth/olvide', { metodo: 'POST', datos: d }));
      if (!r) return fallo(form);
      form.hidden = true;
      const ok = document.querySelector('[data-exito]');
      ok.querySelector('[data-exito-texto]').textContent = r.mensaje;
      ok.hidden = false;
      ave()?.celebrar('¡Listo! Revisa tu correo 💌');
    },
    async restablecer(form) {
      const token = new URLSearchParams(location.hash.slice(1)).get('token');
      ave()?.pensando();
      const r = await enviar(form, (d) => {
        if (d.clave !== d.repetir) throw new Error('Las dos contraseñas no son iguales.');
        if (!token) throw new Error('El enlace no es válido. Pide uno nuevo.');
        return api('/api/auth/restablecer', { metodo: 'POST', datos: { token, clave: d.clave } });
      });
      if (!r) return fallo(form);
      history.replaceState(null, '', location.pathname);
      await ave()?.exito(r.usuario?.nombre);
      location.href = volver(r.usuario.rol);
    },
  };

  document.querySelectorAll('[data-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      acciones[form.dataset.form](form).catch(() => fallo(form)); // el error ya se mostró en el formulario
    });
  });
})();
