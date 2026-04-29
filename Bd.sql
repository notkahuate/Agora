
-- =========================
-- DATABASE
-- =========================
CREATE DATABASE "Agora";
-- Conectarse a la BD antes de ejecutar lo siguiente

-- =========================
-- ENUMS
-- =========================
CREATE TYPE document_frequency AS ENUM ('mensual', 'anual', 'trimestral');

CREATE TYPE document_status AS ENUM (
    'pendiente',
    'subido',
    'aprobado',
    'rechazado',
    'revisado'
);

CREATE TYPE user_role AS ENUM (
    'usuario',
    'super_admin',
    'auditor'
);

-- =========================
-- TABLA: empresas
-- =========================
CREATE TABLE empresas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    rut VARCHAR(20) NOT NULL UNIQUE,
    sector VARCHAR(100),
    ubicacion VARCHAR(255),
    email VARCHAR(255),
    telefono VARCHAR(20),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activa BOOLEAN DEFAULT TRUE
);

-- =========================
-- TABLA: usuarios
-- =========================
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol user_role NOT NULL DEFAULT 'usuario',
    empresa_id INTEGER,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- =========================
-- TABLA: tipos_documentos
-- =========================
CREATE TABLE tipos_documentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    frecuencia document_frequency NOT NULL,
    obligatorio BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    porcentaje NUMERIC(5,2)
);

-- =========================
-- TABLA: documentos_requeridos
-- =========================
CREATE TABLE documentos_requeridos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    tipo_documento_id INTEGER NOT NULL,
    fecha_limite DATE NOT NULL,
    prioridad VARCHAR(20),
    estado VARCHAR(20) DEFAULT 'pendiente',
    CHECK (prioridad IN ('baja', 'media', 'alta')),
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documentos(id) ON DELETE CASCADE
);

-- =========================
-- TABLA: documentos_subidos
-- =========================
CREATE TABLE documentos_subidos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    tipo_documento_id INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500),
    estado document_status DEFAULT 'subido',
    validado_por INTEGER,
    comentarios TEXT,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_validacion TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documentos(id) ON DELETE CASCADE,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (validado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- =========================
-- TABLA: historial_documentos
-- =========================
CREATE TABLE historial_documentos (
    id SERIAL PRIMARY KEY,
    documento_id INTEGER NOT NULL,
    estado_anterior document_status,
    estado_nuevo document_status NOT NULL,
    usuario_id INTEGER,
    comentario TEXT,
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (documento_id) REFERENCES documentos_subidos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);


CREATE TABLE documento_responsables (
    id SERIAL PRIMARY KEY,
    documento_requerido_id INTEGER NOT NULL UNIQUE, -- solo 1 responsable por documento
    usuario_id INTEGER NOT NULL,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (documento_requerido_id)
        REFERENCES documentos_requeridos(id)
        ON DELETE CASCADE,

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE
);