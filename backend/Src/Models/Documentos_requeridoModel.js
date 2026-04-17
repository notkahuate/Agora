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
const obtenerColaRevision = async () => {
  const result = await pool.query(`
    SELECT 
      ds.id,
      td.nombre AS documento,
      e.nombre AS empresa,
      COALESCE(dr.prioridad, 'media') AS prioridad,
      ds.fecha_subida,
      ds.estado
    FROM documentos_subidos ds
    JOIN tipos_documentos td ON td.id = ds.tipo_documento_id
    JOIN empresas e ON e.id = ds.empresa_id
    LEFT JOIN documentos_requeridos dr 
      ON dr.tipo_documento_id = ds.tipo_documento_id 
      AND dr.empresa_id = ds.empresa_id
    WHERE ds.estado IN ('subido', 'pendiente')
    ORDER BY 
      CASE dr.prioridad 
        WHEN 'alta' THEN 1
        WHEN 'media' THEN 2
        WHEN 'baja' THEN 3
        ELSE 4
      END,
      ds.fecha_subida ASC
  `);

  return result.rows;
};

module.exports = {
  crearDocumentoRequerido,
  obtenerPorEmpresa,
  obtenerPendientes,
  obtenerColaRevision
};