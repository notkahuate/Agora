// src/models/DocumentoRequeridoModel.js
const pool = require('../configures/db');

// 📌 Crear documento requerido
const crearDocumentoRequerido = async (data) => {
  const {
    empresa_id,
    tipo_documento_id,
    mes,
    anio,
    fecha_limite,
    prioridad
  } = data;

  const result = await pool.query(
    `INSERT INTO documentos_requeridos 
    (empresa_id, tipo_documento_id, mes, anio, fecha_limite, prioridad)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [empresa_id, tipo_documento_id, mes, anio, fecha_limite, prioridad]
  );

  return result.rows[0];
};

// 📌 Listar por empresa
const obtenerPorEmpresa = async (empresa_id) => {
  const result = await pool.query(
    `SELECT dr.*, td.nombre as tipo_documento,
            COALESCE(u.nombre, 'Sin asignar') as responsable_nombre,
            COALESCE(u.email, '') as responsable_email
     FROM documentos_requeridos dr
     JOIN tipos_documentos td ON dr.tipo_documento_id = td.id
     LEFT JOIN documento_responsables dr_resp ON dr.id = dr_resp.documento_requerido_id
     LEFT JOIN usuarios u ON dr_resp.usuario_id = u.id
     WHERE dr.empresa_id = $1
     ORDER BY dr.fecha_limite ASC`,
    [empresa_id]
  );

  return result.rows;
};

// 📌 Listar todos los documentos (para superadmin)
const obtenerTodos = async () => {
  const result = await pool.query(
    `SELECT dr.*, td.nombre as tipo_documento, e.nombre as empresa_nombre,
            COALESCE(u.nombre, 'Sin asignar') as responsable_nombre,
            COALESCE(u.email, '') as responsable_email
     FROM documentos_requeridos dr
     JOIN tipos_documentos td ON dr.tipo_documento_id = td.id
     JOIN empresas e ON dr.empresa_id = e.id
     LEFT JOIN documento_responsables dr_resp ON dr.id = dr_resp.documento_requerido_id
     LEFT JOIN usuarios u ON dr_resp.usuario_id = u.id
     ORDER BY dr.fecha_limite ASC`
  );

  return result.rows;
};

const obtenerResumenEmpresa = async (empresa_id) => {
  const result = await pool.query(`
    SELECT 
      COUNT(DISTINCT dr.tipo_documento_id) AS total,
      COUNT(DISTINCT ds.tipo_documento_id) AS enviados
    FROM documentos_requeridos dr
    LEFT JOIN documentos_subidos ds 
      ON ds.tipo_documento_id = dr.tipo_documento_id
      AND ds.empresa_id = dr.empresa_id
    WHERE dr.empresa_id = $1
  `, [empresa_id]);

  return result.rows[0];
};

// 📌 Documentos pendientes (NO subidos)
const obtenerPendientes = async (empresa_id) => {
  const result = await pool.query(
    `
    SELECT 
      dr.*, 
      td.nombre AS nombre,
      td.frecuencia AS frecuencia,
      td.porcentaje AS porcentaje,
      COALESCE(u.nombre, 'Sin asignar') as responsable_nombre,
      COALESCE(u.email, '') as responsable_email
    FROM documentos_requeridos dr
    JOIN tipos_documentos td ON td.id = dr.tipo_documento_id
    LEFT JOIN documentos_subidos ds 
      ON ds.tipo_documento_id = dr.tipo_documento_id
      AND ds.empresa_id = dr.empresa_id
    LEFT JOIN documento_responsables dr_resp ON dr.id = dr_resp.documento_requerido_id
    LEFT JOIN usuarios u ON dr_resp.usuario_id = u.id
    WHERE dr.empresa_id = $1
    AND ds.id IS NULL
    ORDER BY dr.fecha_limite ASC
    `,
    [empresa_id]
  );

  return result.rows;
};

const obtenerPendientesPorUsuario = async (usuario_id) => {
  const result = await pool.query(
    `
    SELECT 
      dr.*, 
      td.nombre AS nombre,
      td.frecuencia AS frecuencia,
      td.porcentaje AS porcentaje,
      COALESCE(u.nombre, 'Sin asignar') as responsable_nombre,
      COALESCE(u.email, '') as responsable_email
    FROM documentos_requeridos dr
    JOIN tipos_documentos td ON td.id = dr.tipo_documento_id
    LEFT JOIN documentos_subidos ds 
      ON ds.tipo_documento_id = dr.tipo_documento_id
      AND ds.empresa_id = dr.empresa_id
    JOIN documento_responsables dr_resp ON dr.id = dr_resp.documento_requerido_id
    JOIN usuarios u ON dr_resp.usuario_id = u.id
    WHERE dr_resp.usuario_id = $1
    AND ds.id IS NULL
    ORDER BY dr.fecha_limite ASC
    `,
    [usuario_id]
  );

  return result.rows;
};

const obtenerAsignadosPorUsuario = async (usuario_id) => {
  const result = await pool.query(
    `
    SELECT 
      dr.*, 
      td.nombre AS nombre,
      td.frecuencia AS frecuencia,
      td.porcentaje AS porcentaje,
      COALESCE(u.nombre, 'Sin asignar') as responsable_nombre,
      COALESCE(u.email, '') as responsable_email,
      CASE WHEN ds.id IS NOT NULL THEN 'subido' ELSE 'pendiente' END as estado
    FROM documentos_requeridos dr
    JOIN tipos_documentos td ON td.id = dr.tipo_documento_id
    LEFT JOIN documentos_subidos ds 
      ON ds.tipo_documento_id = dr.tipo_documento_id
      AND ds.empresa_id = dr.empresa_id
    JOIN documento_responsables dr_resp ON dr.id = dr_resp.documento_requerido_id
    JOIN usuarios u ON dr_resp.usuario_id = u.id
    WHERE dr_resp.usuario_id = $1
    ORDER BY dr.fecha_limite ASC
    `,
    [usuario_id]
  );

  return result.rows;
};
// 📌 Cola de revisión (documentos subidos sin aprobar)
const obtenerColaRevision = async (empresa_id = null) => {
  const result = await pool.query(`
    SELECT 
      dr.id,
      td.nombre AS documento,
      td.porcentaje,
      e.nombre AS empresa,
      dr.prioridad,
      dr.fecha_limite,
      dr.estado,
      COALESCE(u.nombre, 'Sin asignar') as responsable_nombre
    FROM documentos_requeridos dr
    JOIN tipos_documentos td ON td.id = dr.tipo_documento_id
    JOIN empresas e ON e.id = dr.empresa_id
    LEFT JOIN documento_responsables dr_resp ON dr.id = dr_resp.documento_requerido_id
    LEFT JOIN usuarios u ON dr_resp.usuario_id = u.id
    WHERE dr.estado = 'pendiente' -- 🔥 SOLO PENDIENTES
    ${empresa_id ? 'AND dr.empresa_id = $1' : ''}
    ORDER BY td.porcentaje DESC -- 🔥 MAYOR PESO PRIMERO
    LIMIT 5 -- 🔥 SOLO 5
  `, empresa_id ? [empresa_id] : []);

  return result.rows;
};
module.exports = {
  crearDocumentoRequerido,
  obtenerPorEmpresa,
  obtenerTodos,
  obtenerPendientes,
  obtenerPendientesPorUsuario,
  obtenerAsignadosPorUsuario,
  obtenerColaRevision,
  obtenerResumenEmpresa
};