// Genera migrations/0002_datos.sql (servicios, planes, zonas y configuración inicial)
// a partir de public/data/*.json. Uso: node scripts/semilla.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data', f), 'utf8'));
const sql = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const { servicios } = leer('servicios.json');
const planes = leer('planes.json');
const { zonas, pendienteConfirmar } = leer('zonas.json');

const filas = servicios.map((s, i) =>
  `INSERT INTO servicios (id, nombre, icono, descripcion, especies, duracion_min, duracion_texto, modalidad, precio, visible, orden) VALUES (${[
    s.id, s.nombre, s.icono, s.descripcion, JSON.stringify(s.especies), s.duracionMin, s.duracionTexto, s.modalidad,
    JSON.stringify(s.precio), s.visible === false ? 0 : 1, i,
  ].map(sql).join(', ')});`);

const config = {
  agenda: { dias: [1, 2, 3, 4, 5], inicio: '08:00', fin: '18:00', maxDia: 5, desplazamientoMin: 50, anticipacionHoras: 24, pasoMin: 30, anticipo: 20000 },
  pago: { nequi: '', daviplata: '', transferencia: '' },
  zonas: { pendienteConfirmar, zonas },
  planes: { preventiva: planes.preventiva, membresias: planes.membresias },
};

const salida = `-- Generado por scripts/semilla.mjs a partir de public/data/*.json
${filas.join('\n')}
${Object.entries(config).map(([k, v]) => `INSERT INTO config (clave, valor) VALUES (${sql(k)}, ${sql(JSON.stringify(v))});`).join('\n')}
`;
fs.writeFileSync(path.join(ROOT, 'migrations/0002_datos.sql'), salida);
console.log(`✓ migrations/0002_datos.sql (${filas.length} servicios)`);
