// Criptografía con Web Crypto: PBKDF2 para contraseñas, HMAC para tokens, AES-GCM para secretos guardados.
const enc = new TextEncoder();

export const b64u = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const desdeB64u = (s) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '==='.slice((t.length + 3) % 4)), (c) => c.charCodeAt(0));
};

export const aleatorio = (bytes = 32) => b64u(crypto.getRandomValues(new Uint8Array(bytes)));

// Cloudflare Workers admite como máximo 100.000 iteraciones de PBKDF2; el brief pide ≥ 100.000.
export const ITERACIONES = 100_000;

export async function hashClave(clave, salB64 = null, iteraciones = ITERACIONES) {
  const sal = salB64 ? desdeB64u(salB64) : crypto.getRandomValues(new Uint8Array(16));
  const llave = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones }, llave, 256);
  return { hash: b64u(bits), sal: b64u(sal), iteraciones };
}

export function igual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Sal fija para comparar en falso cuando el usuario no existe (mismo tiempo de respuesta).
const SAL_FALSA = 'AAAAAAAAAAAAAAAAAAAAAA';
export async function verificarClave(clave, usuario) {
  if (!usuario?.hash) { await hashClave(clave, SAL_FALSA); return false; }
  const r = await hashClave(clave, usuario.sal, usuario.iteraciones || ITERACIONES);
  return igual(r.hash, usuario.hash);
}

export async function hmac(secreto, dato) {
  const llave = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', llave, enc.encode(dato)));
}

// AES-GCM (ENCRYPTION_KEY = 32 bytes en base64). Se usa para el refresh token de Google (Fase 4).
async function llaveAes(claveB64) {
  const crudo = desdeB64u(claveB64);
  if (crudo.length !== 32) throw new Error('ENCRYPTION_KEY debe tener 32 bytes en base64.');
  return crypto.subtle.importKey('raw', crudo, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function cifrar(textoPlano, claveB64) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await llaveAes(claveB64), enc.encode(textoPlano));
  return `${b64u(iv)}.${b64u(c)}`;
}
export async function descifrar(cifrado, claveB64) {
  const [iv, c] = cifrado.split('.');
  const p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: desdeB64u(iv) }, await llaveAes(claveB64), desdeB64u(c));
  return new TextDecoder().decode(p);
}
