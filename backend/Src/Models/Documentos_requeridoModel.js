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
    SELECT dr.*, td.nombre
    FROM documentos_requeridos dr
    JOIN tipos_documentos td ON td.id = dr.tipo_documento_id
    LEFT JOIN documentos_subidos ds 
      ON ds.tipo_documento_id = dr.tipo_documento_id
      AND ds.empresa_id = dr.empresa_id
      AND ds.mes IS NOT DISTINCT FROM dr.mes
      AND ds.anio IS NOT DISTINCT FROM dr.anio
    WHERE dr.empresa_id = $1
    AND ds.id IS NULL
    ORDER BY dr.fecha_limite ASC
    `,
    [empresa_id]
  );

  return result.rows;
};

module.exports = {
  crearDocumentoRequerido,
  obtenerPorEmpresa,
  obtenerPendientes
};