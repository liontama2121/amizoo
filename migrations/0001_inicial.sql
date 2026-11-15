-- AmiZoo · esquema inicial (D1 / SQLite)
-- Fechas de citas en milisegundos UTC (INTEGER). Zona del negocio: America/Bogota (UTC-5, sin horario de verano).

CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  correo TEXT UNIQUE COLLATE NOCASE,          -- NULL permitido para clientes creados a mano (WhatsApp) sin correo
  nombre TEXT NOT NULL,
  telefono TEXT,
  rol TEXT NOT NULL DEFAULT 'cliente' CHECK (rol IN ('admin', 'cliente')),
  hash TEXT,                                   -- PBKDF2-SHA256; NULL = cliente sin cuenta (agendó como invitado)
  sal TEXT,
  iteraciones INTEGER,
  acepta_datos_en INTEGER,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE sesiones (
  token_hash TEXT PRIMARY KEY,                 -- HMAC-SHA256(SESSION_SECRET, token); el token solo vive en la cookie
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira INTEGER NOT NULL,
  creado_en INTEGER NOT NULL
);
CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);

CREATE TABLE intentos_login (
  correo TEXT PRIMARY KEY COLLATE NOCASE,
  fallos INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta INTEGER,
  actualizado INTEGER NOT NULL
);

CREATE TABLE tokens_clave (
  token_hash TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira INTEGER NOT NULL,
  usado INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE direcciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  etiqueta TEXT,
  zona TEXT NOT NULL,
  barrio TEXT NOT NULL,
  direccion TEXT NOT NULL
);

CREATE TABLE animales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'compania' CHECK (tipo IN ('compania', 'produccion')),
  nombre TEXT NOT NULL,                        -- en producción: nombre de la finca
  especie TEXT NOT NULL,
  raza TEXT, edad TEXT, peso TEXT, temperamento TEXT,
  num_animales INTEGER, tipo_produccion TEXT,
  foto_key TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_animales_usuario ON animales(usuario_id);

CREATE TABLE servicios (
  id TEXT PRIMARY KEY,                         -- slug
  nombre TEXT NOT NULL,
  icono TEXT,
  descripcion TEXT,
  especies TEXT NOT NULL DEFAULT '[]',         -- JSON
  duracion_min INTEGER NOT NULL,
  duracion_texto TEXT,
  modalidad TEXT NOT NULL DEFAULT 'domicilio' CHECK (modalidad IN ('domicilio', 'virtual')),
  precio TEXT NOT NULL,                        -- JSON {tipo:'zona'|'rango'|'fijo', ...}
  visible INTEGER NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE citas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  animal_id INTEGER REFERENCES animales(id),
  servicio_id TEXT NOT NULL,
  servicio_nombre TEXT NOT NULL,
  inicio INTEGER NOT NULL,
  fin INTEGER NOT NULL,
  fin_bloqueo INTEGER NOT NULL,                -- fin + desplazamiento
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada', 'rechazada', 'no_asistio')),
  zona TEXT, barrio TEXT, direccion TEXT, contacto_virtual TEXT,
  motivo TEXT,
  precio INTEGER, precio_texto TEXT,
  anticipo INTEGER NOT NULL DEFAULT 20000,
  anticipo_estado TEXT NOT NULL DEFAULT 'sin_comprobante'
    CHECK (anticipo_estado IN ('sin_comprobante', 'por_revisar', 'recibido', 'no_recibido', 'no_aplica')),
  comprobante_key TEXT,
  nota_estado TEXT,                            -- motivo de rechazo / cancelación
  pierde_anticipo INTEGER NOT NULL DEFAULT 0,
  google_event_id TEXT,
  sync_estado TEXT NOT NULL DEFAULT 'no_aplica', -- no_aplica | pendiente | ok | error
  origen TEXT NOT NULL DEFAULT 'web',
  creado_en INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  actualizado_en INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_citas_inicio ON citas(inicio);
CREATE INDEX idx_citas_usuario ON citas(usuario_id);
CREATE INDEX idx_citas_estado ON citas(estado);

CREATE TABLE historia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  animal_id INTEGER NOT NULL REFERENCES animales(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('visita', 'vacuna', 'prescripcion')),
  fecha TEXT NOT NULL,                         -- YYYY-MM-DD
  titulo TEXT NOT NULL,
  detalle TEXT,
  proxima TEXT,                                -- próxima dosis / control (YYYY-MM-DD)
  creado_por INTEGER REFERENCES usuarios(id),
  creado_en INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_historia_animal ON historia(animal_id);

CREATE TABLE documentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  animal_id INTEGER NOT NULL REFERENCES animales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  archivo_key TEXT NOT NULL,
  tipo_mime TEXT NOT NULL,
  tamano INTEGER NOT NULL,
  subido_por INTEGER REFERENCES usuarios(id),
  creado_en INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE bloqueos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  desde TEXT NOT NULL,                         -- YYYY-MM-DD (incluido)
  hasta TEXT NOT NULL,                         -- YYYY-MM-DD (incluido)
  motivo TEXT
);

CREATE TABLE config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL                          -- JSON
);

CREATE TABLE actividad (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id),
  accion TEXT NOT NULL,
  detalle TEXT,
  creado_en INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_actividad_fecha ON actividad(creado_en);
