/* =========================================================
   Amizoo: periquito animado (anime.js 3.2.2) que guía al usuario.
   - Saluda en la primera visita y vuela a la esquina.
   - Explica cada sección marcada con data-guia="texto" (opcional data-guia-titulo).
   - Botones grandes: Siguiente y Ocultar. Sin voz (solo texto).
   - Respeta prefers-reduced-motion. Sin anime.js, funciona sin animación.
   ========================================================= */
(() => {
  'use strict';

  const A = window.anime || null;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animar = !!A && !reduce;
  const almacen = {
    leer(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
    guardar(k, v) { try { window.localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };
  const WA = 'https://wa.me/573142300347';

  /* ---------- Dibujo del periquito (vectorial, partes con id para animar) ---------- */
  // La paleta de la marca no tiene verde; el brief pide la mascota verde y amarillo,
  // así que el plumaje verde vive solo en la mascota.
  const P = {
    verde: '#7FBF45', verdeOsc: '#5E9E2F', verdeClaro: '#A9D872',
    amarillo: '#EAC72E', amarilloClaro: '#F3DA62',
    turquesa: '#73BEBD', turquesaOsc: '#4F9C9B',
    grafito: '#34363A', marfil: '#F7F8F4', pico: '#EFE3C2', menta: '#C8F9E1',
  };
  function aveSVG(id = '') {
    return `<svg class="ave-svg" viewBox="0 0 200 250" aria-hidden="true" focusable="false"${id ? ` id="${id}"` : ''}>
      <g class="ave-todo">
        <g class="ave-cola">
          <path d="M84 176 L44 246 Q52 250 58 244 L98 186 Z" fill="${P.turquesaOsc}"/>
          <path d="M92 178 L62 248 Q70 250 74 244 L104 186 Z" fill="${P.turquesa}"/>
        </g>
        <g class="ave-patas" fill="none" stroke="${P.grafito}" stroke-width="4" stroke-linecap="round">
          <path d="M98 214 v14 M90 230 q8 -6 16 0"/>
          <path d="M116 212 v16 M108 230 q8 -6 16 0"/>
        </g>
        <g class="ave-cuerpo">
          <path d="M104 92 C146 92 162 140 154 180 C146 216 112 230 90 216 C68 202 64 160 74 130 C82 106 92 92 104 92 Z" fill="${P.verde}"/>
          <path d="M128 112 C150 128 156 168 146 196 C136 214 116 220 104 214 C126 196 136 158 128 112 Z" fill="${P.verdeClaro}" opacity=".8"/>
        </g>
        <g class="ave-ala">
          <path d="M84 116 C66 136 62 178 76 214 C92 204 108 172 108 140 C108 124 98 112 84 116 Z" fill="${P.amarilloClaro}"/>
          <path d="M80 214 C74 196 72 184 74 170 L90 188 C88 198 86 206 80 214 Z" fill="${P.verdeOsc}"/>
          <g fill="none" stroke="${P.grafito}" stroke-width="2.2" stroke-linecap="round" opacity=".85">
            <path d="M80 128 q9 -5 18 2"/><path d="M76 140 q11 -5 22 2"/><path d="M74 152 q12 -5 24 2"/>
            <path d="M74 164 q11 -5 22 2"/><path d="M76 176 q9 -4 18 2"/>
          </g>
        </g>
        <g class="ave-cabeza">
          <circle cx="118" cy="76" r="38" fill="${P.amarillo}"/>
          <path d="M84 62 C90 44 106 36 120 38 C108 42 98 50 94 62 Z" fill="${P.verde}" opacity=".55"/>
          <g fill="none" stroke="${P.grafito}" stroke-width="1.8" stroke-linecap="round" opacity=".55">
            <path d="M92 58 q5 -4 10 -1"/><path d="M96 49 q5 -4 10 -1"/><path d="M104 42 q5 -3 10 0"/>
          </g>
          <ellipse cx="136" cy="102" rx="8" ry="6.5" fill="${P.turquesa}"/>
          <circle cx="124" cy="112" r="2.6" fill="${P.grafito}"/><circle cx="133" cy="114" r="2.6" fill="${P.grafito}"/><circle cx="116" cy="111" r="2.3" fill="${P.grafito}"/>
          <g class="ave-ojo">
            <circle cx="132" cy="68" r="7.5" fill="${P.grafito}"/>
            <circle cx="134.5" cy="65.5" r="2.4" fill="${P.marfil}"/>
            <ellipse class="ave-parpado" cx="132" cy="68" rx="8.5" ry="8.5" fill="${P.amarillo}" transform="scale(1 0)" style="transform-origin:132px 60px"/>
          </g>
          <path d="M146 72 q8 -4 13 2 q-6 2 -13 -2 Z" fill="${P.turquesaOsc}"/>
          <path class="ave-pico-inf" d="M150 92 q10 4 12 -4 q-6 -2 -14 -2 Z" fill="${P.pico}" style="transform-origin:150px 88px"/>
          <path d="M146 76 C164 74 172 86 162 98 C160 92 154 88 146 88 Z" fill="${P.pico}"/>
        </g>
      </g>
    </svg>`;
  }

  /* ---------- Animales y medicinas que salen del maletín ----------
     Dibujos vectoriales pequeños, mismo estilo que Amizoo (contorno grafito).
     Partes con clase cr-* para animarlas con anime.js. */
  const GR = '#4A4D52'; // gris del gato (grafito aclarado)
  const ojos = (pts, r, parpado) => pts.map(([x, y]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${P.grafito}" stroke="none"/><circle cx="${x + r * .35}" cy="${y - r * .35}" r="${r * .32}" fill="${P.marfil}" stroke="none"/>`).join('') +
    `<g class="cr-parpado">${pts.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="${r + 1.2}" ry="${r + 1.2}" fill="${parpado}" stroke="none"/>`).join('')}</g>`;
  const trazo = `stroke="${P.grafito}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const DIBUJOS = {
    perro: { vb: '0 0 100 102', svg: `
      <g class="cr-cola"><path d="M66 86 C84 84 90 70 87 56" fill="none" stroke="${P.grafito}" stroke-width="10"/><path d="M66 86 C84 84 90 70 87 56" fill="none" stroke="${P.amarillo}" stroke-width="4.5"/></g>
      <g class="cr-cuerpo"><path d="M30 98 C26 74 36 60 50 60 C64 60 74 74 70 98 Z" fill="${P.amarillo}"/><path d="M42 98 C42 84 45 74 50 72 C55 74 58 84 58 98 Z" fill="${P.marfil}" stroke="none"/></g>
      <ellipse cx="41" cy="97" rx="7" ry="4.5" fill="${P.marfil}"/><ellipse cx="59" cy="97" rx="7" ry="4.5" fill="${P.marfil}"/>
      <g class="cr-cabeza">
        <path class="cr-oreja" d="M31 26 C18 28 14 46 20 58 C27 56 33 46 35 36 Z" fill="${P.grafito}"/>
        <path class="cr-oreja" d="M69 26 C82 28 86 46 80 58 C73 56 67 46 65 36 Z" fill="${P.grafito}"/>
        <ellipse cx="50" cy="40" rx="22" ry="20" fill="${P.amarillo}"/>
        <ellipse cx="50" cy="49" rx="11" ry="8" fill="${P.marfil}" stroke="none"/>
        ${ojos([[42, 37], [58, 37]], 3.6, P.amarillo)}
        <ellipse cx="50" cy="45.5" rx="4.6" ry="3.3" fill="${P.grafito}" stroke="none"/>
        <path d="M50 48 v3 M45 51 q5 4 10 0" fill="none" stroke-width="2.2"/>
      </g>` },
    gato: { vb: '0 0 100 102', svg: `
      <g class="cr-cola"><path d="M64 92 C88 94 94 70 80 56" fill="none" stroke="${P.grafito}" stroke-width="10"/><path d="M64 92 C88 94 94 70 80 56" fill="none" stroke="${GR}" stroke-width="4.5"/></g>
      <g class="cr-cuerpo"><path d="M32 98 C28 76 38 62 50 62 C62 62 72 76 68 98 Z" fill="${GR}"/><path d="M44 98 C44 84 46 76 50 74 C54 76 56 84 56 98 Z" fill="${P.marfil}" stroke="none"/></g>
      <ellipse cx="42" cy="97" rx="6.5" ry="4.5" fill="${P.marfil}"/><ellipse cx="58" cy="97" rx="6.5" ry="4.5" fill="${P.marfil}"/>
      <g class="cr-cabeza">
        <g class="cr-oreja"><path d="M30 34 L27 9 L47 24 Z" fill="${GR}"/><path d="M32 28 L31 16 L40 24 Z" fill="${P.menta}" stroke="none"/></g>
        <g class="cr-oreja"><path d="M70 34 L73 9 L53 24 Z" fill="${GR}"/><path d="M68 28 L69 16 L60 24 Z" fill="${P.menta}" stroke="none"/></g>
        <ellipse cx="50" cy="40" rx="23" ry="19" fill="${GR}"/>
        <ellipse cx="41" cy="38" rx="5" ry="5.5" fill="${P.amarillo}" stroke="none"/><ellipse cx="59" cy="38" rx="5" ry="5.5" fill="${P.amarillo}" stroke="none"/>
        <ellipse cx="41" cy="38" rx="1.8" ry="4.2" fill="${P.grafito}" stroke="none"/><ellipse cx="59" cy="38" rx="1.8" ry="4.2" fill="${P.grafito}" stroke="none"/>
        <g class="cr-parpado"><ellipse cx="41" cy="38" rx="6" ry="6.5" fill="${GR}" stroke="none"/><ellipse cx="59" cy="38" rx="6" ry="6.5" fill="${GR}" stroke="none"/></g>
        <path d="M47 46 h6 l-3 3 z" fill="${P.menta}" stroke="none"/>
        <path d="M50 49 q-3 4 -6 2 M50 49 q3 4 6 2" fill="none" stroke="${P.marfil}" stroke-width="1.8"/>
        <g class="cr-bigotes" fill="none" stroke="${P.marfil}" stroke-width="1.4"><path d="M37 46 L23 44 M37 49 L24 52 M63 46 L77 44 M63 49 L76 52"/></g>
      </g>` },
    conejo: { vb: '0 0 100 122', svg: `
      <circle cx="70" cy="104" r="7" fill="${P.marfil}"/>
      <g class="cr-cuerpo"><path d="M32 118 C28 96 38 82 50 82 C62 82 72 96 68 118 Z" fill="${P.marfil}"/></g>
      <ellipse cx="42" cy="117" rx="7" ry="4.5" fill="${P.marfil}"/><ellipse cx="58" cy="117" rx="7" ry="4.5" fill="${P.marfil}"/>
      <g class="cr-cabeza">
        <g class="cr-oreja"><path d="M44 56 C30 50 28 18 36 10 C46 8 50 40 48 56 Z" fill="${P.marfil}"/><path d="M43 50 C36 44 34 24 38 17 C43 19 45 38 45 50 Z" fill="${P.menta}" stroke="none"/></g>
        <g class="cr-oreja"><path d="M56 56 C70 50 72 18 64 10 C54 8 50 40 52 56 Z" fill="${P.marfil}"/><path d="M57 50 C64 44 66 24 62 17 C57 19 55 38 55 50 Z" fill="${P.menta}" stroke="none"/></g>
        <ellipse cx="50" cy="66" rx="20" ry="18" fill="${P.marfil}"/>
        <circle cx="37" cy="72" r="3.6" fill="${P.menta}" stroke="none"/><circle cx="63" cy="72" r="3.6" fill="${P.menta}" stroke="none"/>
        ${ojos([[43, 63], [57, 63]], 3.4, P.marfil)}
        <path class="cr-nariz" d="M47 70 h6 l-3 3 z" fill="${P.turquesa}" stroke-width="1.5"/>
        <path d="M50 73 v3 M47 77 q3 2 6 0" fill="none" stroke-width="2"/>
      </g>` },
    vaca: { vb: '0 0 120 102', svg: `
      <g class="cr-cola"><path d="M86 88 C102 86 106 72 102 62" fill="none" stroke-width="4.5"/><circle cx="102" cy="59" r="4.5" fill="${P.grafito}"/></g>
      <g class="cr-cuerpo"><path d="M34 98 C28 74 42 62 60 62 C78 62 92 74 86 98 Z" fill="${P.marfil}"/>
        <path d="M38 80 C44 72 54 78 50 88 C44 94 36 90 38 80 Z" fill="${P.grafito}" stroke="none"/><ellipse cx="76" cy="84" rx="6" ry="8" fill="${P.grafito}" stroke="none"/></g>
      <ellipse cx="48" cy="97" rx="7.5" ry="4.5" fill="${P.grafito}"/><ellipse cx="72" cy="97" rx="7.5" ry="4.5" fill="${P.grafito}"/>
      <g class="cr-cabeza">
        <path d="M44 22 C40 12 44 5 49 5 C46 12 48 18 51 22 Z" fill="${P.amarilloClaro}"/><path d="M76 22 C80 12 76 5 71 5 C74 12 72 18 69 22 Z" fill="${P.amarilloClaro}"/>
        <path class="cr-oreja" d="M39 30 C26 25 19 32 24 39 C30 41 36 39 41 36 Z" fill="${P.marfil}"/>
        <path class="cr-oreja" d="M81 30 C94 25 101 32 96 39 C90 41 84 39 79 36 Z" fill="${P.marfil}"/>
        <path d="M40 22 C40 14 80 14 80 22 L82 50 C82 62 38 62 38 50 Z" fill="${P.marfil}"/>
        <path d="M62 17 C74 15 80 21 79 31 C71 33 64 26 62 17 Z" fill="${P.grafito}" stroke="none"/>
        ${ojos([[50, 36], [70, 36]], 3.6, P.marfil)}
        <ellipse cx="60" cy="54" rx="19" ry="11" fill="${P.menta}"/>
        <ellipse cx="53" cy="54" rx="2.2" ry="3.2" fill="${P.grafito}" stroke="none"/><ellipse cx="67" cy="54" rx="2.2" ry="3.2" fill="${P.grafito}" stroke="none"/>
      </g>` },
    tortuga: { vb: '0 0 110 70', svg: `
      <g class="cr-patas"><ellipse cx="32" cy="61" rx="7" ry="8" fill="${P.menta}"/><ellipse cx="74" cy="61" rx="7" ry="8" fill="${P.menta}"/></g>
      <path d="M18 52 L7 57 L18 59 Z" fill="${P.menta}"/>
      <g class="cr-cabeza"><path d="M82 50 C86 34 103 31 106 43 C108 54 96 58 84 57 Z" fill="${P.menta}"/>
        ${ojos([[97, 42]], 3, P.menta)}<path d="M101 50 q-3 2 -7 1" fill="none" stroke-width="2"/></g>
      <path d="M14 56 C14 20 90 16 94 56 Z" fill="${P.turquesaOsc}"/>
      <path d="M44 30 l10 -6 l10 6 v10 l-10 6 l-10 -6 Z" fill="${P.turquesa}" stroke-width="2.2"/>
      <path d="M24 48 l6 -10 l10 2 l2 10 Z M66 50 l2 -10 l10 -2 l6 10 Z" fill="${P.turquesa}" stroke-width="2.2"/>
      <path d="M12 57 H96" stroke-width="5"/>` },
    hamster: { vb: '0 0 100 92', svg: `
      <circle cx="31" cy="25" r="9" fill="${P.amarillo}"/><circle cx="31" cy="25" r="4.5" fill="${P.menta}" stroke="none"/>
      <circle cx="69" cy="25" r="9" fill="${P.amarillo}"/><circle cx="69" cy="25" r="4.5" fill="${P.menta}" stroke="none"/>
      <g class="cr-cuerpo"><ellipse cx="50" cy="56" rx="34" ry="32" fill="${P.amarillo}"/><ellipse cx="50" cy="70" rx="20" ry="16" fill="${P.marfil}" stroke="none"/></g>
      <g class="cr-cabeza">
        <circle class="cr-mejilla" cx="31" cy="58" r="7" fill="${P.amarilloClaro}" stroke="none"/><circle class="cr-mejilla" cx="69" cy="58" r="7" fill="${P.amarilloClaro}" stroke="none"/>
        ${ojos([[40, 46], [60, 46]], 3.4, P.amarillo)}
        <ellipse cx="50" cy="53" rx="2.6" ry="2" fill="${P.grafito}" stroke="none"/>
        <path d="M50 55 v2 M46 58 q4 3 8 0" fill="none" stroke-width="2"/>
      </g>
      <ellipse cx="42" cy="88" rx="5.5" ry="3.5" fill="${P.marfil}"/><ellipse cx="58" cy="88" rx="5.5" ry="3.5" fill="${P.marfil}"/>` },
    cerdo: { vb: '0 0 110 100', svg: `
      <g class="cr-cola"><path d="M88 74 c10 -2 10 -12 3 -12 c-6 0 -4 8 2 6" fill="none" stroke-width="3.2"/></g>
      <g class="cr-cuerpo"><ellipse cx="55" cy="72" rx="36" ry="24" fill="${P.amarilloClaro}"/></g>
      <rect x="28" y="88" width="10" height="11" rx="3" fill="${P.amarilloClaro}"/><rect x="42" y="90" width="10" height="9" rx="3" fill="${P.amarilloClaro}"/>
      <rect x="60" y="90" width="10" height="9" rx="3" fill="${P.amarilloClaro}"/><rect x="74" y="88" width="10" height="11" rx="3" fill="${P.amarilloClaro}"/>
      <g class="cr-cabeza">
        <path class="cr-oreja" d="M34 26 L30 8 L48 20 Z" fill="${P.amarillo}"/><path class="cr-oreja" d="M76 26 L80 8 L62 20 Z" fill="${P.amarillo}"/>
        <circle cx="55" cy="40" r="25" fill="${P.amarilloClaro}"/>
        <circle cx="38" cy="48" r="4" fill="${P.amarillo}" stroke="none" opacity=".8"/><circle cx="72" cy="48" r="4" fill="${P.amarillo}" stroke="none" opacity=".8"/>
        ${ojos([[46, 35], [64, 35]], 3.4, P.amarilloClaro)}
        <ellipse cx="55" cy="50" rx="11" ry="8" fill="${P.amarillo}"/>
        <ellipse cx="51" cy="50" rx="2" ry="3" fill="${P.grafito}" stroke="none"/><ellipse cx="59" cy="50" rx="2" ry="3" fill="${P.grafito}" stroke="none"/>
      </g>` },
    oveja: { vb: '0 0 110 100', svg: `
      <rect x="32" y="84" width="9" height="15" rx="3" fill="${P.grafito}"/><rect x="69" y="84" width="9" height="15" rx="3" fill="${P.grafito}"/>
      <g class="cr-cuerpo" fill="${P.marfil}">
        <circle cx="36" cy="66" r="16"/><circle cx="55" cy="58" r="18"/><circle cx="74" cy="66" r="16"/>
        <circle cx="44" cy="80" r="14"/><circle cx="66" cy="80" r="14"/><circle cx="55" cy="72" r="16" stroke="none"/>
      </g>
      <g class="cr-cola"><circle cx="90" cy="68" r="7" fill="${P.marfil}"/></g>
      <g class="cr-cabeza">
        <path class="cr-oreja" d="M30 40 C18 36 14 44 20 48 C26 50 32 46 34 44 Z" fill="${GR}"/>
        <path class="cr-oreja" d="M80 40 C92 36 96 44 90 48 C84 50 78 46 76 44 Z" fill="${GR}"/>
        <ellipse cx="55" cy="44" rx="19" ry="22" fill="${GR}"/>
        <g fill="${P.marfil}"><circle cx="45" cy="24" r="8"/><circle cx="55" cy="20" r="9"/><circle cx="65" cy="24" r="8"/></g>
        <circle cx="47" cy="42" r="4.6" fill="${P.marfil}" stroke="none"/><circle cx="63" cy="42" r="4.6" fill="${P.marfil}" stroke="none"/>
        ${ojos([[47, 42], [63, 42]], 2.6, GR)}
        <path d="M51 56 q4 3 8 0" fill="none" stroke="${P.marfil}" stroke-width="2"/>
      </g>` },
    cabra: { vb: '0 0 110 104', svg: `
      <rect x="34" y="84" width="8" height="19" rx="3" fill="${P.marfil}"/><rect x="68" y="84" width="8" height="19" rx="3" fill="${P.marfil}"/>
      <g class="cr-cola"><path d="M88 62 l10 -8 l-2 10 Z" fill="${P.marfil}"/></g>
      <g class="cr-cuerpo"><path d="M26 64 C26 52 40 48 55 48 C70 48 88 52 88 66 C88 82 74 88 56 88 C38 88 26 80 26 64 Z" fill="${P.marfil}"/>
        <path d="M60 52 C70 52 78 58 76 66 C68 66 62 60 60 52 Z" fill="${P.turquesa}" stroke="none" opacity=".55"/></g>
      <g class="cr-cabeza">
        <path d="M44 20 C40 8 46 2 52 4 C48 8 48 14 50 20 Z" fill="${P.amarilloClaro}"/><path d="M66 20 C70 8 64 2 58 4 C62 8 62 14 60 20 Z" fill="${P.amarilloClaro}"/>
        <path class="cr-oreja" d="M38 28 L20 32 L36 38 Z" fill="${P.marfil}"/><path class="cr-oreja" d="M72 28 L90 32 L74 38 Z" fill="${P.marfil}"/>
        <path d="M40 22 C40 16 70 16 70 22 L68 46 C66 56 44 56 42 46 Z" fill="${P.marfil}"/>
        ${ojos([[48, 30], [62, 30]], 3.2, P.marfil)}
        <ellipse cx="55" cy="44" rx="7" ry="4" fill="${P.menta}"/>
        <path d="M51 53 L55 66 L59 53 Z" fill="${GR}"/>
      </g>` },
    capsula: { vb: '0 0 60 60', svg: `<g transform="rotate(-35 30 30)"><path d="M12 30 a10 10 0 0 1 10 -10 H30 V40 H22 a10 10 0 0 1 -10 -10 Z" fill="${P.amarillo}"/><path d="M30 20 H38 a10 10 0 0 1 0 20 H30 Z" fill="${P.marfil}"/><path d="M18 26 q2 -3 6 -3" fill="none" stroke="${P.marfil}" stroke-width="2.4"/></g>` },
    jeringa: { vb: '0 0 82 30', svg: `<path d="M3 7 v16 M3 15 H14" fill="none" stroke-width="4"/><rect x="14" y="7" width="40" height="16" rx="3" fill="${P.marfil}"/><rect x="31" y="10" width="21" height="10" rx="1.5" fill="${P.menta}" stroke="none"/><path d="M24 7 v6 M31 7 v5 M38 7 v6 M45 7 v5" fill="none" stroke-width="2"/><rect x="54" y="11" width="7" height="8" rx="1.5" fill="${P.marfil}"/><path d="M61 15 H79" fill="none" stroke-width="2"/>` },
    frasco: { vb: '0 0 50 64', svg: `<rect x="14" y="2" width="22" height="11" rx="3" fill="${P.turquesa}"/><rect x="17" y="12" width="16" height="7" fill="${P.marfil}"/><path d="M9 24 C9 17 41 17 41 24 V57 C41 62 9 62 9 57 Z" fill="${P.marfil}"/><rect x="14" y="30" width="22" height="19" rx="3" fill="${P.menta}" stroke-width="2"/><path d="M25 34 v11 M19.5 39.5 h11" fill="none" stroke="${P.turquesaOsc}" stroke-width="3.6"/>` },
    curita: { vb: '0 0 72 40', svg: `<g transform="rotate(-18 36 20)"><rect x="2" y="9" width="68" height="22" rx="11" fill="${P.amarilloClaro}"/><rect x="25" y="12" width="22" height="16" rx="3" fill="${P.marfil}" stroke-width="2"/><g fill="${P.grafito}" stroke="none" opacity=".5"><circle cx="12" cy="17" r="1.4"/><circle cx="17" cy="23" r="1.4"/><circle cx="56" cy="17" r="1.4"/><circle cx="61" cy="23" r="1.4"/></g></g>` },
  };
  // x = centro, y = pies (fracción del ancho del maletín; el borde de la boca está en ~.2 y el piso en .78), s = ancho
  const ZOO = [
    { t: 'gato', x: -.32, y: .22, s: .19 },
    { t: 'hamster', x: .33, y: .22, s: .15 },
    { t: 'perro', x: -.6, y: .8, s: .22 },
    { t: 'vaca', x: .6, y: .8, s: .25 },
    { t: 'conejo', x: -.36, y: .83, s: .15 },
    { t: 'tortuga', x: .35, y: .82, s: .18 },
    { t: 'capsula', x: -.56, y: -.02, s: .1, med: 1 },
    { t: 'jeringa', x: .56, y: .02, s: .15, med: 1 },
    { t: 'frasco', x: -.68, y: .3, s: .08, med: 1 },
    { t: 'curita', x: .68, y: .32, s: .12, med: 1 },
  ];
  const criaturaHTML = (c) => `<div class="criatura criatura--${c.med ? 'medicina' : 'animal'}" data-tipo="${c.t}" style="--x:${c.x};--y:${c.y};--s:${c.s}">
      <svg viewBox="${DIBUJOS[c.t].vb}" focusable="false"><g class="cr-todo" ${trazo}>${DIBUJOS[c.t].svg}</g></svg></div>`;

  /* Vida de cada animal: respira, parpadea y hace su gesto propio. Devuelve los bucles para pausarlos. */
  function vidaCriatura(el, activo) {
    const q = (s) => el.querySelectorAll(s);
    const tipo = el.dataset.tipo;
    const bucles = [];
    const prep = (nodos, origen) => nodos.forEach((n) => { n.style.transformBox = 'fill-box'; n.style.transformOrigin = origen; });
    const cadaTanto = (fn, min, max) => { const t = () => setTimeout(() => { if (activo()) fn(); t(); }, A.random(min, max)); t(); };
    if (el.classList.contains('criatura--medicina')) {
      bucles.push(A({ targets: el.querySelector('svg'), translateY: [0, -A.random(6, 11)], rotate: [A.random(-10, 0), A.random(2, 12)], direction: 'alternate', loop: true, duration: A.random(1400, 2200), easing: 'easeInOutSine' }));
      return bucles;
    }
    const cuerpo = q('.cr-cuerpo'), cabeza = q('.cr-cabeza'), parpado = q('.cr-parpado'), cola = q('.cr-cola'), orejas = q('.cr-oreja');
    prep(cuerpo, '50% 100%'); prep(cabeza, '50% 90%'); prep(parpado, '50% 0%'); prep(cola, '0% 100%'); prep(orejas, '50% 100%');
    A.set(parpado, { scaleY: 0 });
    bucles.push(A({ targets: cuerpo, scaleY: [1, 1.05], scaleX: [1, .98], direction: 'alternate', loop: true, duration: A.random(1100, 1500), easing: 'easeInOutSine' }));
    cadaTanto(() => A({ targets: parpado, scaleY: [0, 1, 0], duration: 260, easing: 'easeInOutSine' }), 1800, 4500);
    if (tipo !== 'tortuga') cadaTanto(() => A({ targets: cabeza, rotate: [0, A.random(-12, 12), 0], duration: 900, easing: 'easeInOutSine' }), 2500, 5000);
    if (tipo === 'perro') bucles.push(A({ targets: cola, rotate: [-16, 22], direction: 'alternate', loop: true, duration: 230, easing: 'easeInOutSine' }));
    if (tipo === 'gato') {
      bucles.push(A({ targets: cola, rotate: [-10, 12], direction: 'alternate', loop: true, duration: 1700, easing: 'easeInOutSine' }));
      cadaTanto(() => A({ targets: orejas[A.random(0, 1)], rotate: [0, -14, 0], duration: 300, easing: 'easeOutQuad' }), 2000, 4000);
    }
    if (tipo === 'vaca') {
      bucles.push(A({ targets: cola, rotate: [-14, 18], direction: 'alternate', loop: true, duration: 1100, easing: 'easeInOutSine' }));
      cadaTanto(() => A({ targets: orejas, rotate: [0, 16, -6, 0], duration: 500, easing: 'easeOutQuad' }), 2200, 4200);
    }
    if (['cerdo', 'oveja', 'cabra'].includes(tipo)) {
      bucles.push(A({ targets: cola, rotate: [-14, 16], direction: 'alternate', loop: true, duration: tipo === 'cerdo' ? 320 : 600, easing: 'easeInOutSine' }));
      cadaTanto(() => A({ targets: orejas, rotate: [0, tipo === 'cabra' ? -14 : 12, 0], duration: 420, easing: 'easeOutQuad' }), 1800, 3800);
    }
    if (tipo === 'conejo') {
      cadaTanto(() => A({ targets: orejas[A.random(0, 1)], rotate: [0, A.random(-18, 18), 0], duration: 420, easing: 'easeOutQuad' }), 1200, 3000);
      cadaTanto(() => A({ targets: el.querySelector('svg'), translateY: [0, -10, 0], duration: 420, easing: 'easeOutQuad' }), 3000, 6000);
    }
    if (tipo === 'tortuga') {
      bucles.push(A({ targets: cabeza, translateX: [0, 4], direction: 'alternate', loop: true, duration: 1300, easing: 'easeInOutSine' }));
      bucles.push(A({ targets: q('.cr-patas ellipse'), translateY: [0, -2], direction: 'alternate', loop: true, delay: A.stagger(300), duration: 600, easing: 'easeInOutSine' }));
    }
    if (tipo === 'hamster') {
      const mej = q('.cr-mejilla'); prep(mej, '50% 50%');
      cadaTanto(() => A({ targets: mej, scale: [1, 1.35, 1], duration: 700, easing: 'easeInOutSine' }), 1500, 3200);
    }
    return bucles;
  }

  /* ---------- Animaciones del personaje ---------- */
  function vida(raiz) {
    if (!animar) return { hablar() {}, callar() {}, saltar() {}, aletear() {}, saludar() {} };
    const q = (s) => raiz.querySelector(s);
    const cabeza = q('.ave-cabeza'), pico = q('.ave-pico-inf'), parpado = q('.ave-parpado'),
      ala = q('.ave-ala'), cuerpo = q('.ave-cuerpo'), todo = q('.ave-todo');
    [cabeza, ala, cuerpo, todo].forEach((el) => { el.style.transformBox = 'fill-box'; });
    cabeza.style.transformOrigin = '30% 90%';
    ala.style.transformOrigin = '50% 8%';
    cuerpo.style.transformOrigin = '50% 100%';
    todo.style.transformOrigin = '50% 95%';

    // Respiración y movimiento de cabeza
    A({ targets: cuerpo, scaleY: [1, 1.03], scaleX: [1, .99], direction: 'alternate', loop: true, duration: 1600, easing: 'easeInOutSine' });
    A({ targets: cabeza, rotate: [-3, 4], direction: 'alternate', loop: true, duration: 2600, easing: 'easeInOutSine' });
    // Parpadeo
    const parpadear = () => {
      A({ targets: parpado, scaleY: [0, 1, 0], duration: 260, easing: 'easeInOutQuad' });
      setTimeout(parpadear, 2200 + Math.random() * 2600);
    };
    setTimeout(parpadear, 1500);

    let charla = null;
    return {
      hablar(ms = 2500) {
        if (charla) charla.pause();
        charla = A({ targets: pico, rotate: [0, 22], direction: 'alternate', loop: Math.max(2, Math.round(ms / 140)), duration: 140, easing: 'easeInOutQuad', complete: () => { pico.style.transform = ''; } });
      },
      callar() { if (charla) { charla.pause(); pico.style.transform = ''; } },
      saltar() { A({ targets: todo, translateY: [0, -16, 0], scaleY: [1, .94, 1], duration: 520, easing: 'easeOutQuad' }); },
      aletear(veces = 6) { A({ targets: ala, rotate: [0, -55], direction: 'alternate', loop: veces * 2, duration: 110, easing: 'easeInOutSine' }); },
      saludar() {
        A.timeline({ easing: 'easeOutElastic(1, .6)' })
          .add({ targets: ala, rotate: [0, -70], duration: 380 })
          .add({ targets: ala, rotate: [-70, -40, -70, -40, 0], duration: 900, easing: 'easeInOutSine' });
      },
    };
  }

  /* ---------- Guía ---------- */
  const secciones = [...document.querySelectorAll('[data-guia]')];
  const raiz = document.createElement('aside');
  raiz.className = 'guia';
  raiz.setAttribute('aria-label', 'Amizoo, tu guía');
  raiz.innerHTML = `
    <div class="guia__globo" role="status" aria-live="polite">
      <div class="guia__cab">
        <strong class="guia__titulo">Amizoo</strong>
        <button type="button" class="guia__x" data-g="ocultar" aria-label="Ocultar a Amizoo"><i class="ph ph-x" aria-hidden="true"></i></button>
      </div>
      <p class="guia__texto"></p>
      <div class="guia__acciones">
        <button type="button" class="btn btn-primario" data-g="sig">Siguiente <i class="ph ph-arrow-down" aria-hidden="true"></i></button>
      </div>
      <div class="guia__menu" hidden>
        <a class="btn btn-primario" href="/agendar"><i class="ph ph-calendar-check" aria-hidden="true"></i> Agendar cita</a>
        <a class="btn btn-borde" href="/preguntas-frecuentes"><i class="ph ph-chats-circle" aria-hidden="true"></i> Preguntas frecuentes</a>
        <a class="btn btn-borde" href="${WA}"><i class="ph ph-whatsapp-logo" aria-hidden="true"></i> Hablar por WhatsApp</a>
      </div>
    </div>
    <button type="button" class="guia__ave" data-g="ave" aria-expanded="true" aria-label="Amizoo: mostrar u ocultar la guía">
      ${aveSVG()}
      <span class="guia__percha" aria-hidden="true"></span>
    </button>`;
  document.body.append(raiz);
  const globo = raiz.querySelector('.guia__globo');
  const texto = raiz.querySelector('.guia__texto');
  const titulo = raiz.querySelector('.guia__titulo');
  const botonSig = raiz.querySelector('[data-g="sig"]');
  const menu = raiz.querySelector('.guia__menu');
  const acciones = raiz.querySelector('.guia__acciones');
  const botonAve = raiz.querySelector('.guia__ave');
  const ave = vida(botonAve);

  const CLAVE_OCULTA = 'amizoo_guia_oculta';
  let actual = -1;
  let escribiendo = null;

  // Amizoo no habla en voz alta: solo explica con su globo de texto.
  const hablarVoz = () => {};
  const detenerVoz = () => {};

  function decir(t, tit = 'Amizoo') {
    titulo.textContent = tit;
    clearInterval(escribiendo);
    if (!animar) { texto.textContent = t; } else {
      texto.textContent = '';
      let i = 0;
      escribiendo = setInterval(() => {
        texto.textContent = t.slice(0, ++i);
        if (i >= t.length) clearInterval(escribiendo);
      }, 18);
      ave.hablar(t.length * 18 + 200);
      ave.saltar();
    }
    hablarVoz(t);
  }

  function irA(i) {
    if (i < 0 || i >= secciones.length) return;
    actual = i;
    const s = secciones[i];
    decir(s.dataset.guia, s.dataset.guiaTitulo || 'Amizoo');
    const ultimo = i === secciones.length - 1;
    botonSig.innerHTML = ultimo ? 'Volver arriba <i class="ph ph-arrow-up" aria-hidden="true"></i>' : 'Siguiente <i class="ph ph-arrow-down" aria-hidden="true"></i>';
  }

  function mostrar(si) {
    raiz.classList.toggle('guia--oculta', !si);
    botonAve.setAttribute('aria-expanded', String(si));
    almacen.guardar(CLAVE_OCULTA, si ? '0' : '1');
    if (!si) detenerVoz();
  }

  /* ---------- Recorrido guiado: Amizoo vuela a cada parte de la pantalla y la explica ----------
     pasos: [{ sel?: 'selector' | () => Element, titulo, texto, antes?: async () => {} }] */
  let enTour = false;
  const esperarEl = (sel, ms = 3000) => new Promise((resolve) => {
    const t0 = performance.now();
    const buscar = () => {
      const el = typeof sel === 'function' ? sel() : document.querySelector(sel);
      if (el && el.getClientRects().length) return resolve(el);
      if (performance.now() - t0 > ms) return resolve(null);
      requestAnimationFrame(buscar);
    };
    buscar();
  });
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

  async function tour(pasos, { alTerminar } = {}) {
    if (enTour || !pasos.length) return;
    enTour = true;
    const estabaOculta = raiz.classList.contains('guia--oculta');
    raiz.classList.add('guia--en-tour');
    const capa = document.createElement('div');
    capa.className = 'tour';
    capa.innerHTML = `
      <div class="tour__foco" aria-hidden="true"></div>
      <section class="tour__caja" role="dialog" aria-modal="false" aria-labelledby="tour-titulo" aria-describedby="tour-texto">
        <div class="tour__ave" aria-hidden="true">${aveSVG()}</div>
        <div class="tour__globo">
          <p class="tour__paso"></p>
          <h2 class="tour__titulo" id="tour-titulo" tabindex="-1"></h2>
          <p class="tour__texto" id="tour-texto" aria-live="polite"></p>
          <div class="tour__botones">
            <button type="button" class="tour__saltar" data-t="saltar" aria-label="Saltar el recorrido">Saltar</button>
            <button type="button" class="btn btn-borde" data-t="ant"><i class="ph ph-arrow-left" aria-hidden="true"></i> Atrás</button>
            <button type="button" class="btn btn-primario" data-t="sig">Siguiente <i class="ph ph-arrow-right" aria-hidden="true"></i></button>
          </div>
        </div>
      </section>`;
    document.body.append(capa);
    const foco = capa.querySelector('.tour__foco');
    const caja = capa.querySelector('.tour__caja');
    const aveT = vida(capa.querySelector('.tour__ave'));
    const [elPaso, elTitulo, elTexto] = ['.tour__paso', '.tour__titulo', '.tour__texto'].map((s) => capa.querySelector(s));
    const bAnt = capa.querySelector('[data-t="ant"]'), bSig = capa.querySelector('[data-t="sig"]');
    let i = -1, objetivo = null, ocupado = false;

    // Arranca desde la esquina, donde vive Amizoo
    const esquina = botonAve.getBoundingClientRect();
    const pos = { x: esquina.left - 20, y: esquina.top - 40 };
    caja.style.transform = `translate(${pos.x}px, ${pos.y}px)`;

    const colocar = (animado) => {
      const vw = innerWidth, vh = innerHeight;
      const w = caja.offsetWidth, h = caja.offsetHeight;
      const r = objetivo?.getBoundingClientRect();
      const m = 10;
      let x, y;
      if (!r) { x = (vw - w) / 2; y = Math.max(90, (vh - h) / 2); }
      else {
        x = Math.min(Math.max(r.left + r.width / 2 - w / 2, 12), vw - w - 12);
        if (r.bottom + m + 70 + h < vh - 8) y = r.bottom + m + 70;        // debajo (deja sitio al pájaro)
        else if (r.top - m - h > 80) y = r.top - m - h;                   // encima
        else y = vh - h - 12;                                             // objetivo muy grande: abajo
        y = Math.min(Math.max(y, 80), vh - h - 12);
      }
      const fr = r ? { left: r.left - 8, top: r.top - 8, width: r.width + 16, height: r.height + 16 } : { left: vw / 2, top: vh / 2, width: 0, height: 0 };
      const dur = animado && animar ? 750 : 0;
      if (dur) {
        aveT.aletear(6);
        A({ targets: pos, x, y, duration: dur, easing: 'easeInOutQuad', update: () => { caja.style.transform = `translate(${pos.x}px, ${pos.y}px)`; } });
        A({ targets: caja.querySelector('.tour__ave'), rotate: [{ value: x < pos.x ? -12 : 12, duration: dur * 0.5 }, { value: 0, duration: dur * 0.5 }], easing: 'easeInOutSine' });
        A({ targets: foco, left: fr.left, top: fr.top, width: fr.width, height: fr.height, opacity: 1, duration: dur, easing: 'easeInOutQuad' });
      } else {
        Object.assign(pos, { x, y });
        caja.style.transform = `translate(${x}px, ${y}px)`;
        Object.assign(foco.style, { left: `${fr.left}px`, top: `${fr.top}px`, width: `${fr.width}px`, height: `${fr.height}px`, opacity: 1 });
      }
    };

    async function ir(n) {
      if (ocupado || n < 0 || n >= pasos.length) return;
      ocupado = true;
      i = n;
      const p = pasos[i];
      if (p.antes) await p.antes();
      objetivo = p.sel ? await esperarEl(p.sel) : null;
      if (objetivo) {
        const r = objetivo.getBoundingClientRect();
        if (r.top < 80 || r.bottom > innerHeight - 240) {
          objetivo.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
          await pausa(reduce ? 50 : 450);
        }
      }
      elPaso.textContent = `${i + 1} de ${pasos.length}`;
      elTitulo.textContent = p.titulo;
      elTexto.textContent = p.texto;
      bAnt.hidden = i === 0;
      bSig.innerHTML = i === pasos.length - 1 ? '¡Listo! <i class="ph ph-check" aria-hidden="true"></i>' : 'Siguiente <i class="ph ph-arrow-right" aria-hidden="true"></i>';
      colocar(true);
      aveT.hablar(Math.min(4000, p.texto.length * 45));
      if (i === pasos.length - 1) setTimeout(() => aveT.saludar(), 500);
      hablarVoz(`${p.titulo}. ${p.texto}`);
      bSig.focus({ preventScroll: true });
      ocupado = false;
    }

    const terminar = async () => {
      if (!enTour) return;
      enTour = false;
      window.removeEventListener('resize', alCambiarTam);
      document.removeEventListener('keydown', teclas);
      detenerVoz();
      A && animar && A({ targets: foco, opacity: 0, duration: 300, easing: 'linear' });
      if (animar) {
        const b = botonAve.getBoundingClientRect();
        aveT.aletear(8);
        capa.querySelector('.tour__globo').style.visibility = 'hidden';
        await A({ targets: pos, x: b.left - 18, y: b.top - 30, duration: 800, easing: 'easeInOutQuad', update: () => { caja.style.transform = `translate(${pos.x}px, ${pos.y}px)`; } }).finished;
      }
      capa.remove();
      raiz.classList.remove('guia--en-tour');
      if (estabaOculta) raiz.classList.add('guia--oculta');
      ave.saltar(); ave.saludar();
      alTerminar?.();
    };

    const alCambiarTam = () => colocar(false);
    const teclas = (e) => {
      if (e.key === 'Escape') terminar();
      if (e.key === 'ArrowRight' && !e.target.closest('input, textarea, select')) (i === pasos.length - 1 ? terminar() : ir(i + 1));
      if (e.key === 'ArrowLeft' && !e.target.closest('input, textarea, select')) ir(i - 1);
    };
    window.addEventListener('resize', alCambiarTam);
    document.addEventListener('keydown', teclas);
    capa.addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]');
      if (!b) return;
      if (b.dataset.t === 'saltar') terminar();
      if (b.dataset.t === 'ant') ir(i - 1);
      if (b.dataset.t === 'sig') (i === pasos.length - 1 ? terminar() : ir(i + 1));
    });
    await pausa(150);
    ir(0);
  }

  // API para las pantallas dinámicas (agenda, portal, panel): Amizoo explica el paso actual.
  let ultimaExplicacion = '';
  window.AmizooGuia = {
    explicar(tit, t) {
      if (!t || t === ultimaExplicacion) return;
      ultimaExplicacion = t;
      acciones.hidden = false; botonSig.hidden = true; menu.hidden = true;
      if (raiz.classList.contains('guia--oculta') || enTour) { titulo.textContent = tit; texto.textContent = t; return; }
      decir(t, tit);
    },
    celebrar() { ave.saltar(); ave.saludar(); },
    tour,
    enTour: () => enTour,
  };

  // Sin secciones guiadas: el globo funciona como menú de ayuda.
  if (!secciones.length) {
    acciones.hidden = true;
    menu.hidden = false;
    texto.textContent = '¿Te ayudo? Puedo llevarte a agendar tu cita o a las preguntas frecuentes.';
  }


  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    const accion = b.dataset.g;
    if (accion === 'ocultar') mostrar(false);
    if (accion === 'ave') {
      const oculta = raiz.classList.contains('guia--oculta');
      mostrar(oculta);
      if (oculta) { ave.saludar(); if (actual >= 0) irA(actual); }
      else ave.aletear(3);
    }
    if (accion === 'sig') {
      const sig = actual + 1 >= secciones.length ? 0 : actual + 1;
      const destino = secciones[sig];
      destino.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      irA(sig);
    }
  });

  // Explica la sección que está en pantalla
  if (secciones.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entradas) => {
      const visibles = entradas.filter((e) => e.isIntersecting);
      if (!visibles.length) return;
      const i = secciones.indexOf(visibles[0].target);
      if (i !== actual && !raiz.classList.contains('guia--oculta')) irA(i);
      else if (i !== actual) actual = i;
    }, { rootMargin: '-40% 0px -45% 0px' });
    secciones.forEach((s) => io.observe(s));
  }

  /* ---------- Primera visita: saludo en el centro y vuelo a la esquina ---------- */
  const CLAVE_INTRO = 'amizoo_mascota_vista';
  const primera = !almacen.leer(CLAVE_INTRO);
  const movil = window.matchMedia('(max-width: 1023px)').matches;
  const pref = almacen.leer(CLAVE_OCULTA);
  if (pref === '1' || (movil && pref === null)) { raiz.classList.add('guia--oculta'); botonAve.setAttribute('aria-expanded', 'false'); }

  /* ---------- Portada: el maletín se abre y sale Amizoo ---------- */
  const bolsoEscena = document.querySelector('[data-bolso]');
  if (bolsoEscena) {
    const lugarAve = bolsoEscena.querySelector('[data-bolso-ave]');
    lugarAve.innerHTML = aveSVG();
    const aveHero = vida(lugarAve);
    const zoo = bolsoEscena.querySelector('[data-bolso-zoo]');
    zoo.innerHTML = ZOO.map(criaturaHTML).join('');
    const criaturas = [...zoo.querySelectorAll('.criatura')];

    // Los animales saltan del maletín uno a uno, aterrizan y quedan vivos.
    let zooVisible = true;
    const buclesZoo = [];
    const saltarCriaturas = () => {
      const w = bolsoEscena.querySelector('.bolso').offsetWidth;
      const orden = [0, 1, 6, 7, 2, 3, 8, 9, 4, 5]; // alterna izquierda y derecha
      orden.forEach((i, n) => {
        const el = criaturas[i], c = ZOO[i];
        const svg = el.querySelector('svg');
        svg.style.transformOrigin = '50% 100%';
        const dur = 850 + Math.abs(c.x) * 500;
        const inicioY = (0.18 - c.y) * w;            // pies a la altura de la boca del maletín
        const cima = (Math.min(0.18, c.y) - c.y - (c.med ? 0.22 : 0.32)) * w;
        A({
          targets: el, delay: n * 150, easing: 'linear',
          opacity: [{ value: [0, 1], duration: 120 }],
          translateX: [{ value: [-c.x * w, 0], duration: dur, easing: 'easeOutSine' }],
          translateY: [{ value: [inicioY, cima], duration: dur * 0.45, easing: 'easeOutQuad' }, { value: 0, duration: dur * 0.55, easing: 'easeInQuad' }],
          rotate: c.med
            ? [{ value: [0, (c.x < 0 ? -1 : 1) * 360], duration: dur, easing: 'easeOutQuad' }]
            : [{ value: [0, c.x < 0 ? -18 : 18], duration: dur * 0.45 }, { value: 0, duration: dur * 0.55 }],
          scale: [{ value: [0.35, 1], duration: dur * 0.5, easing: 'easeOutQuad' }],
          complete: () => {
            if (c.med) { buclesZoo.push(...vidaCriatura(el, () => zooVisible)); return; }
            A({
              targets: svg, scaleY: [1, 0.72, 1.12, 1], scaleX: [1, 1.22, 0.94, 1], duration: 520, easing: 'easeOutQuad',
              complete: () => buclesZoo.push(...vidaCriatura(el, () => zooVisible)),
            });
          },
        });
      });
    };
    // Tocar un animal: da un saltico.
    criaturas.filter((el) => el.classList.contains('criatura--animal')).forEach((el) => {
      el.addEventListener('click', () => {
        if (!animar) return;
        A({ targets: el.querySelector('svg'), translateY: [0, -22, 0], scaleY: [1, 1.1, 0.85, 1], duration: 560, easing: 'easeOutQuad' });
      });
    });
    // Pausar los bucles cuando la portada no se ve.
    if (animar && 'IntersectionObserver' in window) {
      new IntersectionObserver((e) => {
        zooVisible = e[0].isIntersecting;
        buclesZoo.forEach((a) => (zooVisible ? a.play() : a.pause()));
      }).observe(bolsoEscena);
    }
    if (animar) criaturas.forEach((el) => { el.style.opacity = 0; });
    const globoHero = bolsoEscena.querySelector('[data-bolso-globo]');
    const frases = ['¡Hola! Soy Amizoo 🐾', 'Vengo en el maletín de los doctores.', 'Vamos a tu casa o finca.', 'Toca el botón amarillo y agendamos.'];
    let f = 0;
    const decirHero = () => {
      globoHero.textContent = frases[f % frases.length];
      f++;
      aveHero.hablar(1200);
      if (animar) A({ targets: globoHero, scale: [0.85, 1], opacity: [0.4, 1], duration: 500, easing: 'easeOutBack' });
    };
    lugarAve.addEventListener('click', () => { aveHero.saludar(); decirHero(); });

    // Sin animación: Amizoo se queda en el maletín y la guía de la esquina espera mientras la portada se ve.
    if (!animar && 'IntersectionObserver' in window) {
      new IntersectionObserver((e) => {
        raiz.classList.toggle('guia--esperando', e[0].isIntersecting);
      }, { threshold: 0.35 }).observe(bolsoEscena);
    }

    // Amizoo sale volando del maletín y se convierte en la guía de la esquina.
    let volo = false;
    const volarAGuia = () => {
      if (volo) return; volo = true;
      const a = lugarAve.getBoundingClientRect();
      const b = botonAve.getBoundingClientRect();
      const actualY = A.get(lugarAve, 'translateY', 'px');
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2) + parseFloat(actualY || 0);
      lugarAve.style.zIndex = 6;
      lugarAve.style.transformOrigin = '50% 50%';
      A({ targets: globoHero, opacity: 0, scale: 0.6, duration: 250, easing: 'easeInQuad' });
      aveHero.aletear(14);
      A({
        targets: lugarAve, easing: 'easeInOutSine',
        translateX: [{ value: dx * 0.15, duration: 450 }, { value: dx, duration: 1150 }],
        translateY: [{ value: -160, duration: 450 }, { value: dy, duration: 1150 }],
        rotate: [{ value: -14, duration: 450 }, { value: 8, duration: 800 }, { value: 0, duration: 350 }],
        scale: [{ value: 1.1, duration: 450 }, { value: b.height / a.height, duration: 1150 }],
        complete: () => {
          lugarAve.style.visibility = 'hidden';
          raiz.classList.remove('guia--esperando');
          ave.saltar();
          ave.saludar();
          if (secciones.length && !raiz.classList.contains('guia--oculta')) irA(Math.max(actual, 0));
        },
      });
    };

    if (animar) {
      raiz.classList.add('guia--esperando'); // la guía aparece cuando Amizoo llegue volando
      const q = (s) => bolsoEscena.querySelector(s);
      bolsoEscena.classList.add('preparado'); // estado cerrado inicial
      A.timeline({ easing: 'easeOutQuart' })
        .add({ targets: q('.bolso'), translateY: [-140, 0], rotate: [-6, 0], opacity: [0, 1], duration: 900, easing: 'easeOutBounce' }, 200)
        .add({ targets: q('.bolso__sombra'), scaleX: [0.3, 1], opacity: [0, 1], duration: 900, easing: 'easeOutBounce' }, 200)
        .add({ targets: q('.bolso__broche'), rotate: [0, -18, 14, -10, 0], scale: [1, 1.15, 1], duration: 700, easing: 'easeInOutSine' })
        .add({ targets: q('.bolso__tapa'), translateY: [{ value: '-70%', duration: 380 }, { value: '-22%', duration: 520 }], translateX: [{ value: '-10%', duration: 380 }, { value: '-46%', duration: 520 }], rotate: [{ value: -10, duration: 380 }, { value: -34, duration: 520 }], easing: 'easeOutQuad', begin: (a) => { setTimeout(() => { q('.bolso__tapa').style.zIndex = 0; }, 380); } })
        .add({
          targets: lugarAve, translateY: ['60%', '0%'], duration: 900, easing: 'easeOutElastic(1, .55)',
          begin: () => { bolsoEscena.classList.remove('preparado'); aveHero.aletear(6); setTimeout(saltarCriaturas, 300); },
        }, '-=450')
        .add({
          targets: globoHero, opacity: [0, 1], scale: [0.6, 1], duration: 500, easing: 'easeOutBack',
          begin: () => { aveHero.saludar(); aveHero.hablar(1400); },
          complete: () => {
            // Dice una frase más y sale volando a la esquina
            setTimeout(() => { globoHero.textContent = '¡Te acompaño! Voy a la esquina 🐾'; aveHero.hablar(1200); }, 1600);
            setTimeout(volarAGuia, 3200);
          },
        }, '-=300');
    }
  }

  if (primera && animar && !bolsoEscena) {
    almacen.guardar(CLAVE_INTRO, '1');
    const capa = document.createElement('div');
    capa.className = 'intro-ave';
    capa.innerHTML = `<div class="intro-ave__velo"></div>
      <div class="intro-ave__globo">¡Hola! Soy Amizoo 🐾<span>Te acompaño mientras conoces AmiZoo.</span></div>
      <div class="intro-ave__ave">${aveSVG()}</div>
      <button type="button" class="btn btn-claro intro-ave__saltar">Saltar</button>`;
    document.body.append(capa);
    raiz.classList.add('guia--esperando');
    const aveIntro = capa.querySelector('.intro-ave__ave');
    const vidaIntro = vida(aveIntro);
    let fin = false;
    const terminar = () => {
      if (fin) return; fin = true;
      A.remove(aveIntro);
      capa.remove();
      raiz.classList.remove('guia--esperando');
      ave.saludar();
      if (secciones.length && !raiz.classList.contains('guia--oculta')) irA(Math.max(actual, 0));
    };
    capa.querySelector('.intro-ave__saltar').addEventListener('click', terminar);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') terminar(); }, { once: true });

    const volar = () => {
      if (fin) return;
      const a = aveIntro.getBoundingClientRect(), b = botonAve.getBoundingClientRect();
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      vidaIntro.aletear(10);
      A({ targets: '.intro-ave__globo, .intro-ave__velo', opacity: 0, duration: 300, easing: 'linear' });
      A({
        targets: aveIntro, easing: 'easeInOutQuad',
        translateX: { value: dx, duration: 1300 },
        translateY: [{ value: -120, duration: 500 }, { value: dy, duration: 800 }],
        scale: { value: b.height / a.height, duration: 1300 },
        rotate: [{ value: -12, duration: 500 }, { value: 0, duration: 800 }],
        complete: terminar,
      });
    };
    A.timeline({ easing: 'easeOutElastic(1, .7)' })
      .add({ targets: aveIntro, scale: [0.3, 1], opacity: [0, 1], duration: 700, begin: () => vidaIntro.aletear(4) })
      .add({ targets: '.intro-ave__globo', opacity: [0, 1], translateY: [16, 0], duration: 500, easing: 'easeOutQuad', begin: () => { vidaIntro.hablar(1100); vidaIntro.saludar(); }, complete: () => setTimeout(volar, 1100) }, '-=200');
  } else {
    almacen.guardar(CLAVE_INTRO, '1');
    if (secciones.length && !raiz.classList.contains('guia--oculta')) setTimeout(() => irA(Math.max(actual, 0)), 600);
  }

  /* ---------- Desfile "Del periquito a la vaca": dibujos ---------- */
  const desfile = document.querySelector('[data-desfile]');
  const animalesDesfile = desfile ? [...desfile.querySelectorAll('.desfile__animal')] : [];
  animalesDesfile.forEach((li) => {
    const t = li.dataset.tipo;
    li.querySelector('[data-dibujo]').innerHTML = t === 'ave' ? aveSVG()
      : `<svg viewBox="${DIBUJOS[t].vb}" focusable="false"><g class="cr-todo" ${trazo}>${DIBUJOS[t].svg}</g></svg>`;
  });

  const unaVezOp = (el, fn) => { const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold: 0.2 }); io.observe(el); };
  // Mascotas de las opiniones (cacatúa, perro, gato) asomándose en cada tarjeta
  const mascotasOpinion = [...document.querySelectorAll('[data-dibujo-tipo]')];
  mascotasOpinion.forEach((f) => {
    const t = f.dataset.dibujoTipo;
    f.dataset.tipo = t;
    const cont = f.querySelector('[data-dibujo]');
    if (cont) cont.innerHTML = t === 'ave' ? aveSVG() : `<svg viewBox="${DIBUJOS[t].vb}" focusable="false"><g class="cr-todo" ${trazo}>${DIBUJOS[t].svg}</g></svg>`;
  });


  /* ---------- "¿Hasta dónde llegamos?": Amizoo recorre el paisaje y levanta los letreros ---------- */
  const mapaZonas = document.querySelector('[data-mapa]');
  if (mapaZonas) {
    const lugarAveM = mapaZonas.querySelector('[data-ave-mapa]');
    const letreros = [...mapaZonas.querySelectorAll('[data-letrero]')];
    const globoM = mapaZonas.querySelector('[data-globo-mapa]');
    const xDe = (l) => Number(l.getAttribute('transform').match(/translate\(([\d.-]+)/)[1]);
    const PERCHA_Y = 192; // borde superior de los letreros
    lugarAveM.innerHTML = `<g data-volteo><g transform="translate(-24 -60)">${aveSVG().replace('<svg ', '<svg width="48" height="60" ')}</g></g>`;
    const volteo = lugarAveM.querySelector('[data-volteo]');
    const aveM = vida(lugarAveM);
    const pos = { x: letreros.length ? xDe(letreros[letreros.length - 1]) : 560, y: PERCHA_Y };
    const pintar = () => lugarAveM.setAttribute('transform', `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)})`);
    pintar();
    let ocupado = false;
    let actualM = letreros.length - 1;

    // Vuelo en arco hasta (x, y). Devuelve una promesa.
    const volarA = (x, y, { alto = 70, dur = 1200 } = {}) => new Promise((resolve) => {
      if (!animar) { pos.x = x; pos.y = y; pintar(); resolve(); return; }
      const x0 = pos.x, y0 = pos.y, t = { v: 0 };
      volteo.setAttribute('transform', x < x0 ? 'scale(-1 1)' : '');
      aveM.aletear(Math.round(dur / 220));
      A({
        targets: t, v: 1, duration: dur, easing: 'easeInOutSine',
        update: () => { pos.x = x0 + (x - x0) * t.v; pos.y = y0 + (y - y0) * t.v - Math.sin(Math.PI * t.v) * alto; pintar(); },
        complete: () => { volteo.setAttribute('transform', ''); resolve(); },
      });
    });
    const posarEn = async (i, opciones) => {
      const l = letreros[i];
      if (!l) return;
      await volarA(xDe(l), PERCHA_Y, opciones);
      actualM = i;
      if (animar) A({ targets: l.querySelector('.pz-letrero-in'), scaleY: [1, 0.9, 1.04, 1], duration: 500, easing: 'easeOutQuad' });
    };

    window.AmizooMapa = {
      async ir(id) {
        const i = letreros.findIndex((l) => l.dataset.letrero === id);
        if (i < 0) { if (animar) A({ targets: globoM, opacity: 0, duration: 200, easing: 'linear' }); return; }
        ocupado = true;
        if (animar) A({ targets: globoM, opacity: 0, duration: 150, easing: 'linear' });
        await posarEn(i, { alto: 50, dur: 900 });
        globoM.parentNode.setAttribute('transform', `translate(${Math.min(Math.max(xDe(letreros[i]), 72), 568)} 112)`);
        if (animar) { A({ targets: globoM, opacity: [0, 1], translateY: [8, 0], duration: 400, easing: 'easeOutBack' }); aveM.saludar(); aveM.hablar(900); } else globoM.style.opacity = 1;
        setTimeout(() => { ocupado = false; }, 4000);
      },
    };

    if (animar) {
      const crecen = [...mapaZonas.querySelectorAll('.pz-crece > g, .pz-arbol')];
      const tablas = letreros.map((l) => l.querySelector('.pz-letrero-in'));
      A.set(crecen, { scaleY: 0 });
      A.set(tablas, { scaleY: 0 });
      pos.x = -40; pos.y = 120; pintar();
      let visibleM = false;
      new IntersectionObserver((e) => { visibleM = e[0].isIntersecting; }).observe(mapaZonas);
      const inicio = new IntersectionObserver(async (e) => {
        if (!e[0].isIntersecting) return;
        inicio.disconnect();
        // Las nubes pasan despacio
        A({ targets: mapaZonas.querySelectorAll('[data-nube]'), translateX: [0, 70], direction: 'alternate', loop: true, duration: 9000, easing: 'easeInOutSine' });
        // Casas, edificios y árboles crecen desde el suelo
        A({ targets: crecen, scaleY: [0, 1.08, 1], delay: A.stagger(70), duration: 700, easing: 'easeOutBack' });
        await new Promise((r) => setTimeout(r, 600));
        // Amizoo cruza el paisaje y levanta cada letrero al pasar
        for (let i = 0; i < letreros.length; i++) {
          await volarA(xDe(letreros[i]), 150, { alto: 30, dur: 900 });
          A({ targets: tablas[i], scaleY: [0, 1.15, 1], rotate: [-12, 4, 0], duration: 750, easing: 'easeOutElastic(1, .6)' });
        }
        await posarEn(letreros.length - 1, { alto: 20, dur: 600 });
        aveM.saludar();
        // Después patrulla: vuela de letrero en letrero
        setInterval(async () => {
          if (ocupado || !visibleM || document.hidden || letreros.length < 2) return;
          ocupado = true;
          let i = Math.floor(Math.random() * letreros.length);
          if (i === actualM) i = (i + 1) % letreros.length;
          await posarEn(i, { alto: 60 + Math.random() * 40, dur: 1300 });
          aveM.saludar();
          ocupado = false;
        }, 5200);
      }, { threshold: 0.3 });
      inicio.observe(mapaZonas);
    }
  }


  /* ---------- Entrar / crear cuenta / recuperar: Amizoo se posa en la tarjeta y acompaña el formulario ----------
     Mira lo que escribes, se tapa los ojos con el ala en la contraseña, se ríe al darle "Ver",
     niega con la cabeza si hay error y celebra (y sale volando) al entrar.
     cuenta.js llama a window.AmizooAcceso.{pensando, error, exito}. */
  const cajaAcceso = document.querySelector('.acceso__caja');
  if (cajaAcceso) {
    raiz.hidden = true; // en estas pantallas el guía es el que está posado en la tarjeta
    const seccion = cajaAcceso.closest('.acceso');
    const nodo = document.createElement('div');
    nodo.className = 'acceso-ave';
    nodo.innerHTML = `
      <p class="acceso-ave__globo" role="status" aria-live="polite"></p>
      <button type="button" class="acceso-ave__boton" aria-label="Amizoo: ¿qué hago aquí?">
        <span class="acceso-ave__vuelo"><span class="acceso-ave__dibujo">${aveSVG()}</span></span>
      </button>`;
    cajaAcceso.classList.add('acceso__caja--ave');
    cajaAcceso.prepend(nodo);
    const globoA = nodo.querySelector('.acceso-ave__globo');
    const botonA = nodo.querySelector('.acceso-ave__boton');
    const vuelo = nodo.querySelector('.acceso-ave__vuelo');
    const dibujo = nodo.querySelector('.acceso-ave__dibujo');
    const aveA = vida(dibujo);
    const ojo = dibujo.querySelector('.ave-ojo');
    const ala = dibujo.querySelector('.ave-ala');
    const todoA = dibujo.querySelector('.ave-todo');
    const ayuda = seccion?.dataset.guia || 'Llena los datos y toca el botón amarillo.';

    // Globo con texto que se escribe solo
    let tecleo = null;
    let ultimo = '';
    const decirA = (t, { forzar = false } = {}) => {
      if (t === ultimo && !forzar) return;
      ultimo = t;
      clearInterval(tecleo);
      globoA.classList.add('visible');
      if (!animar) { globoA.textContent = t; return; }
      A.remove(globoA);
      A({ targets: globoA, scale: [0.85, 1], opacity: [0, 1], duration: 380, easing: 'easeOutBack' });
      globoA.textContent = '';
      let i = 0;
      tecleo = setInterval(() => { globoA.textContent = t.slice(0, ++i); if (i >= t.length) clearInterval(tecleo); }, 22);
      aveA.hablar(Math.min(2600, t.length * 22 + 200));
    };

    // Ojos: siguen el puntero o el texto que se escribe (desplazamiento máximo ~4 unidades del dibujo)
    let mirarX = 0, mirarY = 0;
    const mirar = (x, y) => {
      mirarX = Math.max(-4, Math.min(4, x)); mirarY = Math.max(-3, Math.min(4, y));
      if (!animar) return;
      A.remove(ojo);
      A({ targets: ojo, translateX: mirarX, translateY: mirarY, duration: 220, easing: 'easeOutQuad' });
    };
    let tapado = false;
    let raf = 0;
    if (animar && window.matchMedia('(pointer: fine)').matches) {
      document.addEventListener('pointermove', (e) => {
        if (raf || tapado || document.activeElement?.matches('input')) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = ojo.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
          const d = Math.hypot(dx, dy) || 1;
          mirar((dx / d) * 4, (dy / d) * 3.5);
        });
      }, { passive: true });
    }

    // Ala sobre los ojos (contraseña) o espiando (contraseña visible)
    const posAla = (grados, dur = 420) => {
      if (!animar) return;
      A.remove(ala);
      A({ targets: ala, rotate: grados, duration: dur, easing: grados ? 'easeOutBack' : 'easeOutQuad' });
    };
    // El ala va detrás de la cabeza; para taparse los ojos la pasamos al frente.
    const cabezaA = dibujo.querySelector('.ave-cabeza');
    const alFrente = (si) => { if (si) todoA.append(ala); else todoA.insertBefore(ala, cabezaA); };
    const taparOjos = () => { tapado = true; alFrente(true); posAla(-154); mirar(0, 2); };
    const espiar = () => { tapado = true; alFrente(true); posAla(-120); mirar(3, 1); };
    const destapar = () => {
      if (!tapado) return;
      tapado = false; posAla(0);
      setTimeout(() => { if (!tapado) alFrente(false); }, animar ? 260 : 0);
    };

    const form = cajaAcceso.querySelector('form');
    const nombreCampo = (input) => input.closest('label')?.querySelector('span')?.textContent.trim().toLowerCase() || '';
    const verVisible = (input) => input.type === 'text' && input.closest('.campo-clave');
    form?.addEventListener('focusin', (e) => {
      const input = e.target.closest('input');
      if (!input) return;
      if (input.closest('.campo-clave')) {
        if (verVisible(input)) { espiar(); decirA('Jeje, estoy espiando un poquito… 👀'); } else { taparOjos(); decirA('Escribe tu contraseña, yo no miro 🙈'); }
        return;
      }
      destapar();
      const campo = nombreCampo(input);
      if (input.type === 'email') decirA('Escribe tu correo, te lo cuido 💌');
      else if (campo.includes('nombre')) decirA('¿Cómo te llamas? Así te saludo bien.');
      else if (campo.includes('celular') || input.type === 'tel') decirA('Tu celular es para confirmarte la visita por WhatsApp.');
      else if (input.type === 'checkbox') decirA('Lee y acepta, es para cuidar tus datos.');
      if (input.type !== 'checkbox') mirar(-4 + Math.min(8, input.value.length * 0.3), 4);
    });
    form?.addEventListener('focusout', () => {
      setTimeout(() => { if (!form.contains(document.activeElement)) { destapar(); mirar(0, 0); } }, 60);
    });
    form?.addEventListener('input', (e) => {
      const input = e.target.closest('input');
      if (!input || input.closest('.campo-clave') || input.type === 'checkbox') return;
      // Los ojos van de izquierda a derecha siguiendo lo que se escribe
      mirar(-4 + Math.min(8, input.value.length * 0.3), 4);
      if (animar && input.value.length % 6 === 0) aveA.saltar();
      if (input.type === 'email' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value)) decirA('¡Ese correo se ve perfecto! ✨');
    });
    // Botón Ver/Ocultar de la contraseña
    cajaAcceso.querySelectorAll('[data-ver-clave]').forEach((b) => b.addEventListener('click', () => {
      setTimeout(() => {
        const input = b.parentElement.querySelector('input');
        if (input.type === 'text') { espiar(); decirA('Jeje, estoy espiando un poquito… 👀', { forzar: true }); } else { taparOjos(); decirA('Listo, ya no miro 🙈', { forzar: true }); }
      }, 0);
    }));

    botonA.addEventListener('click', () => { aveA.saludar(); aveA.saltar(); decirA(ayuda, { forzar: true }); });

    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    let pensandoAnim = null;
    window.AmizooAcceso = {
      pensando() {
        destapar(); mirar(0, 4);
        decirA('Revisando… 🔎', { forzar: true });
        if (animar) { pensandoAnim?.pause(); pensandoAnim = A({ targets: vuelo, translateY: [0, -10], direction: 'alternate', loop: true, duration: 260, easing: 'easeInOutSine' }); aveA.aletear(8); }
      },
      error(msg) {
        pensandoAnim?.pause();
        destapar();
        decirA(msg || 'Uy… algo no coincide. Revisa y probamos otra vez.', { forzar: true });
        if (!animar) return;
        A({ targets: vuelo, translateY: 0, duration: 200, easing: 'easeOutQuad' });
        A({ targets: todoA, translateX: [0, -9, 9, -7, 7, -4, 0], duration: 620, easing: 'easeInOutSine' });
        A({ targets: form, translateX: [0, -8, 8, -5, 5, 0], duration: 480, easing: 'easeInOutSine' });
      },
      // Celebra sin irse (por ejemplo, al enviar el enlace de recuperación)
      celebrar(t) {
        pensandoAnim?.pause();
        destapar(); mirar(0, 0);
        decirA(t || '¡Listo! 🎉', { forzar: true });
        if (!animar) return;
        A({ targets: vuelo, translateY: 0, duration: 200, easing: 'easeOutQuad' });
        confeti(dibujo); fiestaEscena(); aveA.saludar(); aveA.saltar();
      },
      // Celebra y sale volando; la promesa se resuelve cuando ya se fue (para redirigir después)
      async exito(nombre) {
        pensandoAnim?.pause();
        destapar(); mirar(0, -2);
        const primer = String(nombre || '').trim().split(/\s+/)[0];
        decirA(primer ? `¡Hola, ${primer}! Vamos 🎉` : '¡Listo! Vamos 🎉', { forzar: true });
        if (!animar) { await esperar(500); return; }
        confeti(dibujo); fiestaEscena();
        aveA.saludar();
        await A({ targets: vuelo, translateY: [0, -24, 0], scaleY: [1, .92, 1], duration: 520, easing: 'easeOutQuad' }).finished;
        aveA.aletear(14);
        await A({ targets: vuelo, translateX: [0, 60, 240], translateY: [0, -120, -420], rotate: [0, -10, -18], opacity: [1, 1, 0], duration: 1000, easing: 'easeInQuad' }).finished;
      },
    };

    // Plumas y corazones de colores que saltan del ave
    function confeti(desde) {
      const r = desde.getBoundingClientRect();
      const colores = [P.amarillo, P.turquesa, P.menta, P.verde];
      const piezas = Array.from({ length: 16 }, (_, i) => {
        const s = document.createElement('span');
        s.className = 'acceso-confeti';
        s.style.background = colores[i % colores.length];
        s.style.left = `${r.left + r.width / 2}px`;
        s.style.top = `${r.top + r.height / 2}px`;
        document.body.append(s);
        return s;
      });
      A({
        targets: piezas,
        translateX: () => A.random(-140, 140), translateY: () => A.random(-160, 40),
        rotate: () => A.random(-260, 260), scale: [1, 0.4], opacity: [1, 0],
        duration: () => A.random(900, 1300), easing: 'easeOutCubic',
        complete: () => piezas.forEach((p) => p.remove()),
      });
    }

    // Llegada: entra volando en arco desde arriba a la derecha y se posa sobre la tarjeta
    const saludoInicial = () => {
      const h = new Date().getHours();
      const franja = h < 12 ? '¡Buenos días!' : h < 19 ? '¡Buenas tardes!' : '¡Buenas noches!';
      decirA(`${franja} Soy Amizoo. Toca aquí si necesitas ayuda.`);
    };
    if (animar) {
      A.set(vuelo, { translateX: 260, translateY: -220, rotate: -20, opacity: 0 });
      setTimeout(() => {
        aveA.aletear(12);
        A.timeline({ easing: 'easeOutCubic' })
          .add({ targets: vuelo, opacity: [0, 1], translateX: [260, 30], translateY: [-220, -40], rotate: [-20, 6], duration: 700 })
          .add({ targets: vuelo, translateX: [30, 0], translateY: [-40, 0], rotate: [6, 0], duration: 420, easing: 'easeOutBack' })
          .add({ targets: vuelo, scaleY: [1, .9, 1], scaleX: [1, 1.06, 1], duration: 320, easing: 'easeOutQuad', complete: () => { aveA.saludar(); saludoInicial(); } });
      }, 350);
      // Cuando está quieto: de vez en cuando salta, aletea o ladea el cuerpo
      setInterval(() => {
        if (document.hidden || tapado || form?.contains(document.activeElement)) return;
        const r = Math.random();
        if (r < 0.35) aveA.saltar();
        else if (r < 0.65) aveA.aletear(3);
        else A({ targets: todoA, rotate: [0, -8, 0], duration: 900, easing: 'easeInOutSine' });
      }, 4200);
    } else saludoInicial();

    // Escena ilustrada (en lugar de foto): sol, nubes, colinas, la casita y los animales que esperan la visita
    const escena = seccion?.querySelector('.acceso__escena');
    let fiestaEscena = () => {};
    if (escena) {
      const corazon = `<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.4-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.6-9.5 9-9.5 9z" fill="${P.amarillo}" stroke="${P.grafito}" stroke-width="1.6"/></svg>`;
      const flor = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><g class="esc-flor"><path d="M0 0 v-22" stroke="${P.grafito}" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cy="-26" r="7" fill="${P.amarillo}" stroke="${P.grafito}" stroke-width="2"/><circle cy="-26" r="2.6" fill="${P.marfil}"/></g></g>`;
      escena.innerHTML = `
        <svg class="esc-fondo" viewBox="0 0 400 500" preserveAspectRatio="xMidYMax slice" focusable="false">
          <rect width="400" height="500" fill="${P.menta}"/>
          <g transform="translate(318 92)"><g class="esc-sol">
            <g stroke="${P.amarillo}" stroke-width="6" stroke-linecap="round">${Array.from({ length: 10 }, (_, i) => `<path d="M0 -50 v-14" transform="rotate(${i * 36})"/>`).join('')}</g>
            <circle r="36" fill="${P.amarillo}" stroke="${P.grafito}" stroke-width="3"/>
            <circle cx="-11" cy="-4" r="3.4" fill="${P.grafito}"/><circle cx="11" cy="-4" r="3.4" fill="${P.grafito}"/>
            <path d="M-11 10 q11 10 22 0" fill="none" stroke="${P.grafito}" stroke-width="3" stroke-linecap="round"/>
          </g></g>
          <g class="esc-nube" transform="translate(40 70)"><g class="esc-nube-in"><path d="M10 40 q-14 0 -10 -16 q4 -14 22 -10 q6 -18 28 -14 q18 4 18 20 q16 0 14 14 q-2 8 -12 8 Z" fill="${P.marfil}" stroke="${P.grafito}" stroke-width="3" stroke-linejoin="round"/></g></g>
          <g class="esc-nube" transform="translate(170 150) scale(.7)"><g class="esc-nube-in"><path d="M10 40 q-14 0 -10 -16 q4 -14 22 -10 q6 -18 28 -14 q18 4 18 20 q16 0 14 14 q-2 8 -12 8 Z" fill="${P.marfil}" stroke="${P.grafito}" stroke-width="3" stroke-linejoin="round"/></g></g>
          <path d="M-10 300 Q90 230 200 280 T420 250 V500 H-10 Z" fill="${P.turquesa}" opacity=".45"/>
          <g transform="translate(250 228)">
            <path d="M0 40 L36 10 L72 40 Z" fill="${P.amarillo}" stroke="${P.grafito}" stroke-width="3" stroke-linejoin="round"/>
            <rect x="8" y="40" width="56" height="44" fill="${P.marfil}" stroke="${P.grafito}" stroke-width="3"/>
            <rect x="29" y="58" width="16" height="26" rx="3" fill="${P.turquesa}" stroke="${P.grafito}" stroke-width="3"/>
            <rect x="12" y="48" width="12" height="12" rx="2" fill="${P.menta}" stroke="${P.grafito}" stroke-width="2.4"/>
            <path d="M36 22 v12 M30 28 h12" stroke="${P.grafito}" stroke-width="3.4" stroke-linecap="round"/>
          </g>
          <path d="M-10 360 Q120 300 240 345 T420 330 V500 H-10 Z" fill="${P.turquesa}" opacity=".75"/>
          <path d="M-10 420 Q140 380 260 410 T420 400 V500 H-10 Z" fill="${P.turquesa}"/>
          <path d="M290 312 Q270 360 230 400 T160 470" fill="none" stroke="${P.marfil}" stroke-width="5" stroke-dasharray="2 14" stroke-linecap="round" class="esc-camino"/>
          ${flor(36, 432)}${flor(64, 440, .8)}${flor(352, 426)}${flor(378, 436, .75)}${flor(206, 448, .7)}
        </svg>
        ${[['perro', 4, 7, 30], ['gato', 30, 10, 24], ['conejo', 54, 9, 19], ['oveja', 72, 6, 27]].map(([t, x, y, w]) =>
          `<div class="esc-animal" data-tipo="${t}" style="left:${x}%;bottom:${y}%;width:${w}%"><svg viewBox="${DIBUJOS[t].vb}" focusable="false"><g class="cr-todo" ${trazo}>${DIBUJOS[t].svg}</g></svg></div>`).join('')}
        <div class="esc-corazones"></div>`;
      if (animar) {
        const animales = [...escena.querySelectorAll('.esc-animal')];
        const capa = escena.querySelector('.esc-corazones');
        let visibleE = false;
        new IntersectionObserver((e) => { visibleE = e[0].isIntersecting; }).observe(escena);
        const vivo = () => visibleE && !document.hidden;
        const sol = escena.querySelector('.esc-sol');
        const prep = (els, origen) => els.forEach((n) => { n.style.transformBox = 'fill-box'; n.style.transformOrigin = origen; });
        prep([sol], '50% 50%');
        prep([...escena.querySelectorAll('.esc-flor')], '50% 100%');
        A({ targets: sol, rotate: 360, duration: 30000, loop: true, easing: 'linear' });
        A({ targets: sol, scale: [1, 1.06], direction: 'alternate', loop: true, duration: 1800, easing: 'easeInOutSine' });
        A({ targets: escena.querySelectorAll('.esc-nube-in'), translateX: (el, i) => [0, i ? -50 : 60], direction: 'alternate', loop: true, duration: (el, i) => 8000 + i * 3000, easing: 'easeInOutSine' });
        A({ targets: escena.querySelectorAll('.esc-flor'), rotate: [-8, 8], direction: 'alternate', loop: true, delay: A.stagger(250), duration: 1500, easing: 'easeInOutSine' });
        A({ targets: escena.querySelector('.esc-camino'), strokeDashoffset: [0, -64], loop: true, duration: 2600, easing: 'linear' });
        // Corazón que sube desde un animal
        const latido = (el) => {
          const c = document.createElement('span');
          c.className = 'esc-corazon';
          c.innerHTML = corazon;
          const re = escena.getBoundingClientRect(), ra = el.getBoundingClientRect();
          c.style.left = `${ra.left - re.left + ra.width / 2}px`;
          c.style.top = `${ra.top - re.top}px`;
          capa.append(c);
          A({ targets: c, translateY: [0, -90], translateX: () => A.random(-18, 18), scale: [0.4, 1.1], opacity: [1, 0], duration: 1500, easing: 'easeOutQuad', complete: () => c.remove() });
        };
        const brinco = (el, alto = 26) => A({ targets: el, translateY: [0, -alto, 0], scaleY: [1, .92, 1], duration: 560, easing: 'easeOutQuad' });
        // Llegan saltando uno por uno
        A.set(animales, { translateY: 160, opacity: 0 });
        A({ targets: animales, translateY: [160, 0], opacity: [0, 1], delay: A.stagger(220, { start: 500 }), duration: 900, easing: 'easeOutElastic(1, .7)',
          complete: () => animales.forEach((el) => vidaCriatura(el, vivo)) });
        setInterval(() => {
          if (!vivo()) return;
          const el = animales[A.random(0, animales.length - 1)];
          brinco(el); latido(el);
        }, 2400);
        fiestaEscena = () => animales.forEach((el, i) => setTimeout(() => { brinco(el, 40); latido(el); }, i * 120));
      }
    }
  }

  /* ---------- Animaciones de la página con anime.js ---------- */
  if (!animar) return;

  // Las mascotas de las opiniones cobran vida al verse
  if (mascotasOpinion.length) {
    let visibleOp = false;
    const zona = mascotasOpinion[0].closest('section') || mascotasOpinion[0].parentElement;
    new IntersectionObserver((e) => { visibleOp = e[0].isIntersecting; }).observe(zona);
    unaVezOp(zona, () => mascotasOpinion.forEach((f, i) => {
      const cont = f.querySelector('[data-dibujo]');
      cont.style.transformOrigin = '50% 100%';
      A({ targets: cont, translateY: [40, 0], opacity: [0, 1], delay: 600 + i * 160, duration: 900, easing: 'easeOutElastic(1, .6)',
        complete: () => { if (f.dataset.dibujoTipo === 'ave') vida(cont).aletear(3); else vidaCriatura(f, () => visibleOp); } });
    }));
  }

  // Línea de latido del hero
  const latido = document.querySelector('[data-latido] path');
  if (latido) {
    const largo = latido.getTotalLength();
    latido.style.strokeDasharray = largo;
    A({ targets: latido, strokeDashoffset: [largo, 0], duration: 2200, delay: 400, easing: 'easeInOutSine' });
    A({ targets: '[data-latido] .huella-fin', scale: [0, 1], opacity: [0, 1], duration: 600, delay: 2400, easing: 'easeOutBack' });
  }

  // Maletín que se abre
  const maletin = document.querySelector('[data-maletin]');
  const unaVez = (el, fn) => {
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { fn(); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
  };
  if (maletin) {
    maletin.classList.add('cerrado');
    unaVez(maletin, () => {
      maletin.classList.remove('cerrado');
      A({ targets: maletin.querySelectorAll('.compartimento'), translateY: [60, 0], scale: [0.85, 1], opacity: [0, 1], delay: A.stagger(80, { grid: [3, 3], from: 'center' }), duration: 800, easing: 'easeOutQuart' });
    });
  }
  if (desfile) {
    // Entran caminando a saltitos del más pequeño al más grande; al llegar les aparece el mismo corazón.
    const lis = animalesDesfile;
    const corazones = lis.map((li) => li.querySelector('.desfile__corazon'));
    let visibleD = false;
    new IntersectionObserver((e) => { visibleD = e[0].isIntersecting; }).observe(desfile);
    lis.forEach((li) => { li.style.opacity = 0; });
    corazones.forEach((c) => { c.style.opacity = 0; });
    const saltar = (li) => A({ targets: li.querySelector('[data-dibujo]'), translateY: [0, -22, 0], scaleY: [1, 1.06, 0.9, 1], duration: 620, easing: 'easeOutQuad' });
    const latir = () => {
      A({ targets: corazones, scale: [1, 1.2, 1], duration: 900, loop: true, endDelay: 900, easing: 'easeInOutSine' });
      setInterval(() => { if (visibleD) saltar(lis[Math.floor(Math.random() * lis.length)]); }, 2600);
    };
    unaVez(desfile, () => {
      lis.forEach((li, i) => {
        const dib = li.querySelector('[data-dibujo]');
        dib.style.transformOrigin = '50% 100%';
        const dx = -(li.offsetLeft + li.offsetWidth + 30);
        const paso = 1300 + i * 70;
        A.timeline({ delay: i * 280 })
          .add({ targets: li, opacity: [{ value: 1, duration: 200 }], translateX: [dx, 0], duration: paso, easing: 'easeOutCubic' })
          .add({ targets: dib, translateY: [0, -16, 0, -12, 0, -7, 0], duration: paso, easing: 'easeInOutSine' }, 0)
          .add({ targets: dib, scaleY: [1, 0.84, 1.06, 1], scaleX: [1, 1.12, 0.97, 1], duration: 460, easing: 'easeOutQuad' })
          .add({
            targets: corazones[i], opacity: [0, 1], scale: [0, 1.3, 1], translateY: [12, 0], duration: 620, easing: 'easeOutBack',
            complete: () => {
              if (li.dataset.tipo === 'ave') vida(dib).aletear(4);
              else vidaCriatura(li, () => visibleD);
              if (i === lis.length - 1) latir();
            },
          });
      });
    });
    lis.forEach((li) => li.addEventListener('click', () => {
      saltar(li);
      A({ targets: li.querySelector('.desfile__corazon svg'), scale: [1, 1.5, 1], duration: 520, easing: 'easeOutBack' });
    }));
  }
})();
