// src/models/documentoModel.js
const { pool } = require('../configures/db');

const crearDocumento = async ({ usuario_id, tipo_documento_id, empresa_id, nombre_archivo, ruta_archivo, archivo, mime_type, comentarios, lote_subida = null }) => {
  const texto = `
    INSERT INTO documentos_subidos
      (usuario_id, tipo_documento_id, empresa_id, nombre_archivo, ruta_archivo, archivo, mime_type, comentarios, lote_subida)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *;
  `;
  const valores = [
    usuario_id,
    tipo_documento_id,
    empresa_id,
    nombre_archivo,
    ruta_archivo || null,
    archivo || null,
    mime_type || null,
    comentarios || null,
    lote_subida || null
  ];
  const { rows } = await pool.query(texto, valores);
  return rows[0];
};

const LISTAR_DOCUMENTOS_SQL = (includeLote = true) => `
    SELECT 
      ds.id,
      ds.usuario_id,
      ds.tipo_documento_id,
      ds.empresa_id,
      ds.nombre_archivo,
      COALESCE(ds.ruta_archivo, CONCAT('/api/documentos/', ds.id, '/descargar')) AS ruta_archivo,
      ds.estado,
      ds.validado_por,
      vu.nombre AS validado_por_nombre,
      ds.comentarios,
      ${includeLote ? 'ds.lote_subida,' : ''}
      ds.fecha_subida,
      ds.fecha_validacion,
      ds.fecha_actualizacion,
      e.nombre AS empresa_nombre,
      u.nombre AS usuario_nombre,
      td.nombre AS tipo_documento_nombre
    FROM documentos_subidos ds
    JOIN empresas e ON ds.empresa_id = e.id
    JOIN usuarios u ON ds.usuario_id = u.id
    LEFT JOIN usuarios vu ON ds.validado_por = vu.id
    JOIN tipos_documentos td ON ds.tipo_documento_id = td.id
    ORDER BY ds.fecha_subida DESC;
  `;

const listarDocumentos = async () => {
  try {
    const { rows } = await pool.query(LISTAR_DOCUMENTOS_SQL(true));
    return rows;
  } catch (error) {
    if (String(error.message || '').includes('lote_subida')) {
      const { rows } = await pool.query(LISTAR_DOCUMENTOS_SQL(false));
      return rows;
    }
    throw error;
  }
};

const listarDocumentosPorUsuario = async (usuario_id) => {
  const { rows } = await pool.query(
    `
      SELECT
        ds.id,
        ds.usuario_id,
        ds.tipo_documento_id,
        ds.empresa_id,
        ds.nombre_archivo,
        COALESCE(ds.ruta_archivo, CONCAT('/api/documentos/', ds.id, '/descargar')) AS ruta_archivo,
        ds.estado,
        ds.validado_por,
        vu.nombre AS validado_por_nombre,
        ds.comentarios,
        ds.fecha_subida,
        ds.fecha_validacion,
        ds.fecha_actualizacion,
        td.nombre AS tipo_documento_nombre,
        td.frecuencia
      FROM documentos_subidos ds
      LEFT JOIN usuarios vu ON ds.validado_por = vu.id
      LEFT JOIN tipos_documentos td ON td.id = ds.tipo_documento_id
      WHERE ds.usuario_id = $1
      ORDER BY ds.fecha_subida IS NULL, ds.fecha_subida DESC, ds.id DESC;
    `,
    [usuario_id]
  );
  return rows;
};

const listarDocumentosPorEmpresa = async (empresa_id) => {
  const { rows } = await pool.query(
    `
      SELECT
        ds.id,
        ds.usuario_id,
        ds.tipo_documento_id,
        ds.empresa_id,
        ds.nombre_archivo,
        COALESCE(ds.ruta_archivo, CONCAT('/api/documentos/', ds.id, '/descargar')) AS ruta_archivo,
        ds.estado,
        ds.validado_por,
        vu.nombre AS validado_por_nombre,
        ds.comentarios,
        ds.fecha_subida,
        ds.fecha_validacion,
        ds.fecha_actualizacion
      FROM documentos_subidos ds
      LEFT JOIN usuarios vu ON ds.validado_por = vu.id
      WHERE ds.empresa_id = $1
      ORDER BY ds.fecha_subida DESC;
    `,
    [empresa_id]
  );
  return rows;
};

const obtenerDocumentoPorId = async (id) => {
  const { rows } = await pool.query(`
    SELECT
      ds.id,
      ds.usuario_id,
      ds.tipo_documento_id,
      ds.empresa_id,
      ds.nombre_archivo,
      COALESCE(ds.ruta_archivo, CONCAT('/api/documentos/', ds.id, '/descargar')) AS ruta_archivo,
      ds.estado,
      ds.validado_por,
      vu.nombre AS validado_por_nombre,
      ds.comentarios,
      ds.lote_subida,
      ds.fecha_subida,
      ds.fecha_validacion,
      ds.fecha_actualizacion
    FROM documentos_subidos ds
    LEFT JOIN usuarios vu ON ds.validado_por = vu.id
    WHERE ds.id = $1;
  `, [id]);
  return rows[0];
};

const obtenerDocumentoArchivoPorId = async (id) => {
  const { rows } = await pool.query(`
    SELECT
      ds.id,
      ds.usuario_id,
      ds.tipo_documento_id,
      ds.empresa_id,
      ds.nombre_archivo,
      ds.ruta_archivo,
      ds.archivo,
      ds.mime_type,
      ds.estado,
      ds.validado_por,
      vu.nombre AS validado_por_nombre,
      ds.comentarios,
      ds.lote_subida,
      ds.fecha_subida,
      ds.fecha_validacion,
      ds.fecha_actualizacion
    FROM documentos_subidos ds
    LEFT JOIN usuarios vu ON ds.validado_por = vu.id
    WHERE ds.id = $1;
  `, [id]);
  return rows[0];
};

const actualizarDocumento = async (id, campos = {}) => {
  const allowed = new Set(['tipo_documento_id', 'empresa_id', 'nombre_archivo', 'ruta_archivo', 'comentarios']);
  const keys = Object.keys(campos).filter((key) => allowed.has(key));
  if (keys.length === 0) return await obtenerDocumentoPorId(id);

  const set = [];
  const values = [];
  let idx = 1;
  for (const key of keys) {
    set.push(`${key} = $${idx}`);
    values.push(campos[key]);
    idx++;
  }
  // actualizar fecha_actualizacion siempre
  const texto = `UPDATE documentos_subidos SET ${set.join(', ')}, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *;`;
  values.push(id);
  const { rows } = await pool.query(texto, values);
  return rows[0];
};

const eliminarDocumento = async (id) => {
  const { rows } = await pool.query(`DELETE FROM documentos_subidos WHERE id = $1 RETURNING *;`, [id]);
  return rows[0];
};

/**
 * marcar como validado/rechazado
 * estado: 'validado' | 'rechazado' | 'subido' (según tu enum document_status)
 * validado_por: id de usuario que valida
 * comentarios: texto adicional
 */
const validarDocumento = async (id, { estado, validado_por, comentarios }) => {
  const texto = `
    UPDATE documentos_subidos
    SET estado = $1,
        validado_por = $2,
        comentarios = $3,
        fecha_validacion = CURRENT_TIMESTAMP,
        fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING *;
  `;
  const valores = [estado, validado_por || null, comentarios || null, id];
  const { rows } = await pool.query(texto, valores);
  return rows[0];
};

/**
 * Listar documentos pendientes de validación con JOINs a usuarios, empresas y tipos de documentos
 */
const listarPendientesValidacionConJoin = async () => {
  const { rows } = await pool.query(`
    SELECT 
      ds.id,
      ds.usuario_id,
      ds.tipo_documento_id,
      ds.empresa_id,
      ds.nombre_archivo,
      COALESCE(ds.ruta_archivo, CONCAT('/api/documentos/', ds.id, '/descargar')) AS ruta_archivo,
      ds.comentarios,
      ds.estado,
      ds.fecha_subida,
      ds.fecha_validacion,
      ds.validado_por,
      vu.nombre AS validado_por_nombre,
      e.nombre AS empresa_nombre,
      u.nombre AS usuario_nombre,
      td.nombre AS tipo_documento_nombre,
      td.porcentaje
    FROM documentos_subidos ds
    LEFT JOIN empresas e ON ds.empresa_id = e.id
    LEFT JOIN usuarios u ON ds.usuario_id = u.id
    LEFT JOIN usuarios vu ON ds.validado_por = vu.id
    LEFT JOIN tipos_documentos td ON ds.tipo_documento_id = td.id
    WHERE ds.estado = 'subido'
    ORDER BY ds.fecha_subida DESC;
  `);
  return rows;
};

/**
 * Cola prioritaria del auditor: documentos subidos pendientes de revisión, ordenados por prioridad y peso SG-SST.
 */
const listarColaPrioritariaAuditor = async (limite = 8) => {
  const { rows } = await pool.query(`
    SELECT 
      ds.id,
      ds.nombre_archivo,
      ds.fecha_subida,
      td.nombre AS tipo_documento_nombre,
      td.porcentaje,
      e.nombre AS empresa_nombre,
      e.id AS empresa_id,
      u.nombre AS usuario_nombre,
      COALESCE(dr.prioridad, 'media') AS prioridad,
      dr.fecha_limite
    FROM documentos_subidos ds
    JOIN tipos_documentos td ON td.id = ds.tipo_documento_id
    JOIN empresas e ON e.id = ds.empresa_id
    JOIN usuarios u ON u.id = ds.usuario_id
    LEFT JOIN documentos_requeridos dr
      ON dr.empresa_id = ds.empresa_id
      AND dr.tipo_documento_id = ds.tipo_documento_id
    WHERE ds.estado = 'subido'
    ORDER BY
      CASE COALESCE(dr.prioridad, 'media')
        WHEN 'alta' THEN 0
        WHEN 'media' THEN 1
        ELSE 2
      END,
      td.porcentaje IS NULL, td.porcentaje DESC,
      ds.fecha_subida ASC
    LIMIT $1
  `, [limite]);
  return rows;
};

const listarHistorialPorTipo = async (empresa_id, tipo_documento_id) => {
  const { rows } = await pool.query(`
    SELECT
      ds.id,
      ds.usuario_id,
      ds.tipo_documento_id,
      ds.empresa_id,
      ds.nombre_archivo,
      COALESCE(ds.ruta_archivo, CONCAT('/api/documentos/', ds.id, '/descargar')) AS ruta_archivo,
      ds.estado,
      ds.validado_por,
      vu.nombre AS validado_por_nombre,
      ds.comentarios,
      ds.lote_subida,
      ds.fecha_subida,
      ds.fecha_validacion,
      ds.fecha_actualizacion,
      u.nombre AS usuario_nombre,
      td.nombre AS tipo_documento_nombre,
      td.frecuencia
    FROM documentos_subidos ds
    JOIN usuarios u ON u.id = ds.usuario_id
    JOIN tipos_documentos td ON td.id = ds.tipo_documento_id
    LEFT JOIN usuarios vu ON vu.id = ds.validado_por
    WHERE ds.empresa_id = $1 AND ds.tipo_documento_id = $2
    ORDER BY ds.fecha_subida IS NULL, ds.fecha_subida DESC, ds.id DESC
  `, [empresa_id, tipo_documento_id]);
  return rows;
};

module.exports = {
  crearDocumento,
  listarDocumentos,
  listarDocumentosPorUsuario,
  listarDocumentosPorEmpresa,
  obtenerDocumentoPorId,
  obtenerDocumentoArchivoPorId,
  actualizarDocumento,
  eliminarDocumento,
  validarDocumento,
  listarPendientesValidacionConJoin,
  listarColaPrioritariaAuditor,
  listarHistorialPorTipo,
};
