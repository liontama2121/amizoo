# DESIGN · AmiZoo v3 "El maletín de visita"

Rediseño del 2026-11-14 con taste-skill + impeccable. La v1 ("Ruta a domicilio", ilustraciones planas) se descartó por verse infantil; su CSS está en .impeccable/v1/.

## Lectura
Página de veterinaria a domicilio para dueños de 18 a 80 años en Bogotá. Lenguaje cálido, editorial y de confianza, con fotografía real. Variación 6, movimiento 5, densidad 4.

## Tokens (styles.css :root)
- Paleta oficial: turquesa #73BEBD (campos de color: fondo del hero, testimonios, bloque destacado), mango #EAC72E (solo acciones y énfasis: botón principal, números de pasos, CTA final), menta #C8F9E1 (íconos, sección suave), marfil #F7F8F4 (fondo), grafito #34363A (todo el texto).
- Mezclas permitidas: --superficie, --menta-suave, --mango-suave, --turquesa-suave, --linea (grafito 12 %).
- Tipos: Manrope 800 títulos (h1 hasta 4.5rem, tracking -0.038em), Open Sans 18 px texto.
- Forma: tarjetas y fotos 28px, campos 16px, todo lo interactivo en píldora. Bordes de 1px con --linea. Sombras suaves teñidas de grafito.
- Íconos: Phosphor regular. Nada de SVG dibujados a mano.

## Composición del inicio (v3, elegida por el cliente)
Hero del doctor (credenciales MVZ/UDCA, foto de manos del médico con estetoscopio, línea de latido que termina en huella, tarjeta Consulta a domicilio) · maletín médico que se abre (anime.js) con los 9 servicios en compartimentos · cómo funciona · desfile de animales por tamaño (periquito a vaca, saltitos en orden) · indicaciones antes de la visita · testimonios · zonas · CTA.

## Amizoo, la guía (public/assets/js/amizoo.js)
- Periquito vectorial verde y amarillo (único uso de verde: el brief pide la mascota así), partes animadas con anime.js 3.2.2: respira, mueve la cabeza, parpadea, mueve el pico al hablar, salta, aletea, saluda.
- Explica cada elemento con data-guia="texto" y data-guia-titulo, según la sección visible. Botones grandes: Escuchar (voz del navegador, es-CO), Siguiente, Ocultar.
- Primera visita: saluda en el centro y vuela a la esquina. En celular arranca discreto con "¿Te ayudo?".
- Para la agenda y el portal (fases 2 y 5): marcar cada paso con data-guia y Amizoo lo explica solo.
- Respeta prefers-reduced-motion (sin animación, la guía sigue funcionando).
