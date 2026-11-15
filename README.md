# AmiZoo — sitio web

Servicios veterinarios y zootécnicos a domicilio. Hecho con amor por JuanCode.

## Correr en local

```bash
npm install                   # instala wrangler
cp .dev.vars.example .dev.vars   # y llena SESSION_SECRET (≥ 32 caracteres) y ENCRYPTION_KEY (32 bytes en base64)
npm run db:local              # crea las tablas y carga servicios, zonas, planes y configuración en la D1 local
npm run admin -- --local      # crea un administrador (pide nombre, correo y contraseña)
npm run dev                   # build + wrangler pages dev → http://localhost:8788
npm test                      # pruebas (festivos de Colombia 2026 y 2027, hora de Bogotá)
```

### Datos de demostración (solo local)

Con el servidor local corriendo, `npm run demo` crea ~100 citas usando la API real (43 clientes, animales de compañía y de finca, citas pasadas con historia clínica, solicitudes confirmadas, rechazadas, reprogramadas y canceladas) y verifica que no haya cruces, que se respeten el máximo diario, los festivos y las 24 h, y que cada cliente vea solo lo suyo. Usa los accesos `DEMO_ADMIN_*` (admin) y `DEMO_CLIENTE_*` (cliente "Juan Demo") de `.dev.vars`. Para empezar de cero: detener el servidor, borrar `.wrangler/state/v3/d1` y `.wrangler/state/v3/r2`, `npm run db:local` y crear el admin.

Sin `RESEND_API_KEY` los correos no se envían: se muestran en la consola de wrangler (incluido el enlace para recuperar contraseña).

## Despliegue (Cloudflare Pages)

1. Crear la base y el bucket:
   ```bash
   npx wrangler d1 create amizoo          # copia el database_id en wrangler.toml
   npx wrangler r2 bucket create amizoo-files   # privado: nunca activar acceso público
   ```
2. Migraciones: `npm run db:remoto`
3. Secretos (nunca en el código ni en el repo):
   ```bash
   npx wrangler pages secret put SESSION_SECRET      # texto aleatorio de 48+ caracteres
   npx wrangler pages secret put ENCRYPTION_KEY      # 32 bytes en base64 (Fase 4)
   npx wrangler pages secret put RESEND_API_KEY
   npx wrangler pages secret put GOOGLE_CLIENT_ID    # Fase 4
   npx wrangler pages secret put GOOGLE_CLIENT_SECRET   # Fase 4
   ```
   Variables opcionales (no secretas): `SITIO` (ej. `https://amizoovet.com`, para los enlaces de los correos) y `CORREO_REMITENTE` (ej. `AmiZoo <citas@amizoovet.com>`, dominio verificado en Resend).
4. Administradores: `npm run admin -- --remote` una vez por persona (David y Valentina). El script pide la contraseña sin mostrarla y guarda solo el hash PBKDF2.
5. En Cloudflare Pages: comando de build `npm run build`, directorio de salida `public`, bindings `DB` (D1) y `FILES` (R2).

## Cómo está armado

- `functions/_middleware.js`: valida `Origin` en todo lo que cambia datos, protege `/panel` (admin) y `/mi-cuenta` (cliente) y agrega cabeceras de seguridad.
- `functions/api/[[ruta]].js`: un solo enrutador para `/api/*`; cada ruta declara si es pública, de cliente o de admin.
- `functions/_lib/`: sesiones (`sesion.js`), criptografía (`cripto.js`), disponibilidad y festivos (`agenda.js`), citas (`citas.js`), archivos R2 (`archivos.js`), correos (`correo.js`) y las rutas.
- Seguridad: contraseñas PBKDF2-SHA256 (100.000 iteraciones, el máximo que admite Workers) con sal por usuario; sesión con token aleatorio en cookie `HttpOnly; Secure; SameSite=Strict` (7 días clientes, 12 h admin) y solo su HMAC en D1; 5 intentos fallidos → bloqueo de 15 min; enlace de recuperación de un solo uso por 30 min; archivos solo JPG/PNG/WEBP/PDF de máximo 5 MB comprobados por sus bytes y servidos únicamente a su dueño o a un admin; doble reserva imposible (la inserción verifica el cruce en la misma sentencia).
- Disponibilidad: lunes a viernes 8:00–18:00, sin festivos de Colombia (fijos, Ley Emiliani y los de Pascua), 24 h de anticipación, máximo 5 citas por día y 50 min de desplazamiento; todo editable en Panel → Configuración.

## Pantallas

- `/agendar`: agenda en 7 pasos, un paso por pantalla, con Amizoo explicando cada uno. Con o sin cuenta.
- `/entrar`, `/registro`, `/recuperar`, `/restablecer`: cuentas.
- `/mi-cuenta`: portal del cliente (inicio, mis animales, mis citas y anticipos, historia clínica, mis datos).
- `/panel`: panel de AmiZoo (inicio del día, solicitudes, agenda día/semana/mes, clientes y animales con historia clínica, servicios y planes, configuración, actividad).

## Editar contenido

- Textos de páginas: `src/pages/*.html`
- Servicios, planes, zonas y preguntas frecuentes: `public/data/*.json` (desde la Fase 2 se editan en el panel).
- Luego correr `npm run build`.

## Fotografías

Las fotos en `public/assets/fotos/` son provisionales, de Unsplash (Licencia Unsplash: uso comercial gratuito, sin atribución obligatoria). Se reemplazan por fotos reales de AmiZoo cuando lleguen.

| Archivo | Origen |
|---|---|
| periquito-1 | unsplash.com/photos/yDLzgj5DJUQ (Ilona Froehlich) |
| periquito-2 (mascota provisional) | unsplash.com/photos/zOKrNguZwKo |
| periquito-3 | unsplash.com/photos/X3lAtvSL_MQ (Johannes Giez) |
| periquitos-rama | unsplash.com/photos/km2f-EUivRU (David Clode) |
| gato-sofa | unsplash.com/photos/g3qrEmWsA6k (Reba Spike) |
| gato-manta | unsplash.com/photos/ajn8aKQWT2k (Alex Mamedov) |
| vacas | unsplash.com/photos/JMjNnQ2xFoY |
| vacas-2 | unsplash.com/photos/LeddYmHIFAc |
| perro-abrazo | unsplash.com/photos/yB4ezSdhEgA (Leohoho) |
| perro-abrazo-2 | unsplash.com/photos/Hen3PrsTGsM (Catalin Pop) |
| cachorro | unsplash.com/photos/CXQgs12wFHc |
| ovejas | unsplash.com/photos/fu98B_QguGQ (Ali Fesçi) |
| cabra | unsplash.com/photos/0b0lC3ddQ-w (Rin Tian) |
