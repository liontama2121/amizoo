# CLAUDE.md — AmiZoo

Sitio de **AmiZoo** (veterinaria y zootecnia a domicilio, Bogotá + Sabana Norte) hecho por **JuanCode**.
Se trabaja por fases; mostrar resultado de cada fase y esperar visto bueno antes de seguir.

## Stack (decidido, no cambiar)
- HTML/CSS/JS vanilla, mobile-first. Sin frameworks.
- Cloudflare Pages + Pages Functions (`/functions/api/...`), D1 (`DB`), R2 privado (`FILES`, solo vía Function con sesión).
- Login propio correo+contraseña (PBKDF2-SHA256 ≥100k, cookies HttpOnly/Secure/SameSite=Strict). **Nunca** "Iniciar sesión con Google".
- Google Calendar solo como integración (OAuth offline, refresh token cifrado AES-GCM). Correos con Resend.
- Zona horaria `America/Bogota` en todo. Secretos solo con `wrangler secret put`.

## Estructura
- `src/pages/*.html` → contenido de cada página con cabecera `<!--meta {...} -->` y marcadores `{{...}}`.
- `scripts/build.mjs` → genera `public/*.html` (layout común: cabecera, menú, pie, flotantes, asistente) y prerenderiza servicios, planes, zonas, FAQ y testimonios desde `public/data/*.json`. **Editar `src/`, nunca `public/*.html`** (son generados y están en .gitignore).
- `public/data/*.json` → respaldo de datos. Desde Fase 2 la fuente es D1 vía `/api/*`; los JSON quedan como fallback.
- `public/assets/fotos/` fotos WebP 640/1200. `assets/img/` y `public/opciones/` son de la v1 descartada (solo referencia).
- `public/assets/logos/` → logos oficiales (no modificar) + versiones recortadas/reducidas para web.

## Identidad (fija)
- Colores únicos: turquesa `#73BEBD`, mango `#EAC72E`, menta `#C8F9E1`, marfil `#F7F8F4`, grafito `#34363A`.
- Texto siempre grafito. Botón principal mango + texto grafito. Manrope (títulos) + Open Sans (texto). Base 18 px, botones ≥48 px con texto.
- Dirección visual v3 "El maletín de visita" (2026-11-14, elegida tras rechazar v1 ilustrada y v2 editorial): fotos reales, íconos Phosphor, maletín médico animado con los servicios. Ver DESIGN.md.
- Mascota Amizoo: periquito vectorial animado con anime.js (public/assets/js/amizoo.js) que guía con data-guia en cada sección; usar data-guia en cada paso de la agenda y del portal. Se puede reemplazar el dibujo por la ilustración oficial manteniendo las partes con clase ave-*.

- No mostrar números de tarjeta profesional (T.P.) del equipo (pedido del cliente, 2026-11-14).

## Pendientes del cliente (no inventar)
Fotos del equipo/animales e ilustración oficial de la mascota · Nequi/Daviplata/transferencia · precios Hámster/Puma/Manatí · textos legales · confirmar zonas (occidente y Chapinero/Galerías vs. "Calle 72 al norte") · dominio amizoovet (`SITE` en build.mjs).

## Estado
- Fase 1 (sitio público) construida.
- Fases 2, 3 y 5 construidas (2026-11-14): D1 (`migrations/`), API en `functions/` (enrutador único `functions/api/[[ruta]].js`, lógica en `functions/_lib/`), agenda `/agendar`, cuentas (`/entrar`, `/registro`, `/recuperar`, `/restablecer`), portal `/mi-cuenta`, panel `/panel` (layout "panel" en build.mjs). JS de pantallas: `public/assets/js/{app,agendar,cuenta,portal,panel}.js`; estilos `public/assets/css/app.css`.
- Guía en pantallas dinámicas: `window.AmizooGuia.explicar(titulo, texto)` (cada paso/pestaña lo llama) y `window.AmizooGuia.tour(pasos)` (recorrido: Amizoo vuela a cada `sel` y lo ilumina). El portal lo lanza al crear cuenta (`/mi-cuenta?tour=1`), la primera visita y con el botón "Recorrido con Amizoo".
- Amizoo (es macho) no habla en voz alta: se eliminó la voz a pedido del cliente (2026-11-14). Solo globo de texto.
- Inicio animado: "Sin transporte, sin salas de espera" = escena SVG del carro veterinario (`[data-ruta]`, lógica en main.js); "Del periquito a la vaca" = desfile de 8 animales dibujados (ave, hámster, gato, perro, cerdo, oveja, cabra, vaca; dibujos en `DIBUJOS` de amizoo.js) con el mismo corazón encima de cada uno; "Indicaciones" con chulitos que se dibujan y fichas que caen; "Familias…" con puerta animada y mascota dibujada en cada opinión (carrusel avanza solo); "¿Hasta dónde llegamos?" = paisaje ilustrativo donde Amizoo vuela y levanta letreros por zona (`window.AmizooMapa.ir(id)` lo llama el buscador de barrios); CTA final con calendario animado.
- Panel → Clientes y mascotas (`#clientes?vista=clientes|mascotas&q=&especie=&tipo=&orden=`): búsqueda en vivo, filtro por especie y tipo, orden; APIs `GET /api/admin/clientes` y `GET /api/admin/animales` (con conteo por especie, última visita, próxima cita y próximo control).
- Clases de formulario: envoltorio `.campo-f` (`.campo` ya es el input del buscador de zonas en styles.css).
- Fase 4 (Google Calendar) pendiente: ganchos marcados con "Fase 4" en `agenda.js` (freeBusy) y `rutas-admin.js` (confirmar). Mientras tanto el correo de confirmación lleva .ics y botón de Google Calendar.
- Pendiente: la página pública de servicios/planes sigue prerenderizada desde `public/data/*.json`; falta que lea `/api/servicios` para reflejar lo editado en el panel.
- Local: `.dev.vars` tiene un admin de prueba (ADMIN_PRUEBA_*) solo para la D1 local.
