-- 1. Crear tipos personalizados
CREATE TYPE document_frequency AS ENUM ('mensual', 'anual', 'trimestral');
CREATE TYPE document_status AS ENUM ('pendiente', 'subido', 'aprobado', 'rechazado', 'revisado');
CREATE TYPE user_role AS ENUM ('usuario', 'super_admin', 'auditor');

-- 2. Crear tablas
CREATE TABLE empresas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    rut VARCHAR(20) NOT NULL UNIQUE,
    sector VARCHAR(100),
    ubicacion VARCHAR(255),
    email VARCHAR(255),
    telefono VARCHAR(20),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activa BOOLEAN DEFAULT true
);

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol user_role DEFAULT 'usuario' NOT NULL,
    empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tipos_documentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    frecuencia document_frequency NOT NULL,
    obligatorio BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    porcentaje NUMERIC(5,2)
);

CREATE TABLE documentos_requeridos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tipo_documento_id INTEGER NOT NULL REFERENCES tipos_documentos(id) ON DELETE CASCADE,
    fecha_limite DATE NOT NULL,
    prioridad VARCHAR(20) CHECK (prioridad IN ('baja', 'media', 'alta')),
    estado VARCHAR(20) DEFAULT 'pendiente'
);

CREATE TABLE documentos_subidos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo_documento_id INTEGER NOT NULL REFERENCES tipos_documentos(id) ON DELETE CASCADE,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500),
    archivo BYTEA,
    mime_type VARCHAR(255),
    estado document_status DEFAULT 'subido',
    validado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    comentarios TEXT,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_validacion TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documento_responsables (
    id SERIAL PRIMARY KEY,
    documento_requerido_id INTEGER NOT NULL UNIQUE REFERENCES documentos_requeridos(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE historial_documentos (
    id SERIAL PRIMARY KEY,
    documento_id INTEGER NOT NULL REFERENCES documentos_subidos(id) ON DELETE CASCADE,
    estado_anterior document_status,
    estado_nuevo document_status NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    comentario TEXT,
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);