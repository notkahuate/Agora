-- Esquema MySQL para Agora
-- Ejecutar: mysql -u root -p < Bd.sql

CREATE DATABASE IF NOT EXISTS Agora
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE Agora;

CREATE TABLE empresas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    rut VARCHAR(20) NOT NULL UNIQUE,
    sector VARCHAR(100),
    ubicacion VARCHAR(255),
    email VARCHAR(255),
    telefono VARCHAR(20),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activa TINYINT(1) DEFAULT 1
);

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('usuario', 'super_admin', 'auditor') DEFAULT 'usuario' NOT NULL,
    empresa_id INT,
    activo TINYINT(1) DEFAULT 1,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuarios_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

CREATE TABLE tipos_documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    frecuencia ENUM('mensual', 'anual', 'trimestral') NOT NULL,
    obligatorio TINYINT(1) DEFAULT 1,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    porcentaje DECIMAL(5,2)
);

CREATE TABLE documentos_requeridos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    tipo_documento_id INT NOT NULL,
    fecha_limite DATE NOT NULL,
    prioridad VARCHAR(20),
    estado VARCHAR(20) DEFAULT 'pendiente',
    CONSTRAINT fk_dr_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    CONSTRAINT fk_dr_tipo FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documentos(id) ON DELETE CASCADE,
    CONSTRAINT chk_dr_prioridad CHECK (prioridad IN ('baja', 'media', 'alta'))
);

CREATE TABLE documentos_subidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo_documento_id INT NOT NULL,
    empresa_id INT NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500),
    archivo LONGBLOB,
    mime_type VARCHAR(255),
    estado ENUM('pendiente', 'subido', 'aprobado', 'rechazado', 'revisado') DEFAULT 'subido',
    validado_por INT,
    comentarios TEXT,
    observaciones TEXT,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_validacion TIMESTAMP NULL,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    lote_subida VARCHAR(64),
    CONSTRAINT fk_ds_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_ds_tipo FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documentos(id) ON DELETE CASCADE,
    CONSTRAINT fk_ds_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    CONSTRAINT fk_ds_validador FOREIGN KEY (validado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE documento_responsables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    documento_requerido_id INT NOT NULL UNIQUE,
    usuario_id INT NOT NULL,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dresp_requerido FOREIGN KEY (documento_requerido_id) REFERENCES documentos_requeridos(id) ON DELETE CASCADE,
    CONSTRAINT fk_dresp_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE historial_documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    documento_id INT NOT NULL,
    estado_anterior ENUM('pendiente', 'subido', 'aprobado', 'rechazado', 'revisado'),
    estado_nuevo ENUM('pendiente', 'subido', 'aprobado', 'rechazado', 'revisado') NOT NULL,
    usuario_id INT,
    comentario TEXT,
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_hist_documento FOREIGN KEY (documento_id) REFERENCES documentos_subidos(id) ON DELETE CASCADE,
    CONSTRAINT fk_hist_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE auditoria_sistema (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entidad VARCHAR(50) NOT NULL,
    entidad_id INT,
    accion VARCHAR(50) NOT NULL,
    usuario_id INT,
    empresa_id INT,
    descripcion TEXT,
    datos_anteriores JSON,
    datos_nuevos JSON,
    fecha_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_aud_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_aud_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL
);
