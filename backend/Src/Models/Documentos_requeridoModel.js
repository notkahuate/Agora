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
    `SELECT dr.*, td.nombre as tipo_documento
     FROM documentos_requeridos dr
     JOIN tipos_documentos td ON dr.tipo_documento_id = td.id
     WHERE dr.empresa_id = $1
     ORDER BY dr.fecha_limite ASC`,
    [empresa_id]
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
      td.porcentaje AS porcentaje
    FROM documentos_requeridos dr
    JOIN tipos_documentos td ON td.id = dr.tipo_documento_id
    LEFT JOIN documentos_subidos ds 
      ON ds.tipo_documento_id = dr.tipo_documento_id
      AND ds.empresa_id = dr.empresa_id
    WHERE dr.empresa_id = $1
    AND ds.id IS NULL
    ORDER BY dr.fecha_limite ASC
    `,
    [empresa_id]
  );

  return result.rows;
};
// 📌 Cola de revisión (documentos subidos sin aprobar)
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
      dr.estado
    FROM documentos_requeridos dr
    JOIN tipos_documentos td ON td.id = dr.tipo_documento_id
    JOIN empresas e ON e.id = dr.empresa_id
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
  obtenerPendientes,
  obtenerColaRevision,
  obtenerResumenEmpresa
};