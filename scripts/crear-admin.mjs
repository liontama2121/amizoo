// Crea el INSERT de un administrador con la contraseña ya cifrada (PBKDF2-SHA256, 100.000 iteraciones).
// La contraseña nunca queda en el código ni en el repositorio.
// Uso: node scripts/crear-admin.mjs  → copia el comando que imprime (o usa --local / --remote para ejecutarlo).
import readline from 'node:readline';
import { webcrypto as crypto } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ITERACIONES = 100_000;
const b64u = (buf) => Buffer.from(buf).toString('base64url');

function preguntar(texto, { oculto = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) {
      rl._writeToOutput = (s) => { rl.output.write(s.includes(texto) ? s : '*'); };
    }
    rl.question(texto, (r) => { rl.close(); if (oculto) process.stdout.write('\n'); resolve(r.trim()); });
  });
}

const sql = (v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const nombre = await preguntar('Nombre completo: ');
const correo = (await preguntar('Correo: ')).toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) { console.error('Correo no válido.'); process.exit(1); }
const clave = await preguntar('Contraseña (mínimo 12 caracteres): ', { oculto: true });
if (clave.length < 12) { console.error('La contraseña de un administrador debe tener al menos 12 caracteres.'); process.exit(1); }
const repetir = await preguntar('Repite la contraseña: ', { oculto: true });
if (clave !== repetir) { console.error('Las contraseñas no coinciden.'); process.exit(1); }

const sal = crypto.getRandomValues(new Uint8Array(16));
const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: ITERACIONES }, llave, 256);

const insert = `INSERT INTO usuarios (correo, nombre, rol, hash, sal, iteraciones, acepta_datos_en) VALUES (${[correo, nombre, 'admin', b64u(bits), b64u(sal), ITERACIONES, Date.now()].map(sql).join(', ')})
ON CONFLICT(correo) DO UPDATE SET rol = 'admin', nombre = excluded.nombre, hash = excluded.hash, sal = excluded.sal, iteraciones = excluded.iteraciones;`;

const modo = process.argv.includes('--remote') ? '--remote' : process.argv.includes('--local') ? '--local' : null;
if (modo) {
  const tmp = path.join(os.tmpdir(), `amizoo-admin-${Date.now()}.sql`);
  fs.writeFileSync(tmp, insert, { mode: 0o600 });
  try {
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'amizoo', modo, `--file=${tmp}`], { stdio: 'inherit', shell: process.platform === 'win32' });
    console.log(`\n✓ Administrador ${correo} listo (${modo.slice(2)}).`);
  } finally { fs.rmSync(tmp, { force: true }); }
} else {
  console.log('\n-- Ejecuta este SQL en D1 (no lo guardes en el repositorio):\n');
  console.log(insert);
  console.log('\nO vuelve a correr el script con --local (desarrollo) o --remote (producción) para ejecutarlo directo.');
}
