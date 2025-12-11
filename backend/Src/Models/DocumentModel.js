// src/models/documentoModel.js
const { pool } = require('../configures/db');

const crearDocumento = async ({ usuario_id, tipo_documento_id, empresa_id, nombre_archivo, ruta_archivo, comentarios }) => {
  const texto = `
    INSERT INTO documentos_subidos
      (usuario_id, tipo_documento_id, empresa_id, nombre_archivo, ruta_archivo, comentarios)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *;
  `;
  const valores = [usuario_id, tipo_documento_id, empresa_id, nombre_archivo, ruta_archivo || null, comentarios || null];
  const { rows } = await pool.query(texto, valores);
  return rows[0];
};

const listarDocumentos = async () => {
  const { rows } = await pool.query(`SELECT * FROM documentos_subidos ORDER BY fecha_subida DESC;`);
  return rows;
};

const obtenerDocumentoPorId = async (id) => {
  const { rows } = await pool.query(`SELECT * FROM documentos_subidos WHERE id = $1;`, [id]);
  return rows[0];
};

const actualizarDocumento = async (id, campos = {}) => {
  const keys = Object.keys(campos);
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

module.exports = {
  crearDocumento,
  listarDocumentos,
  obtenerDocumentoPorId,
  actualizarDocumento,
  eliminarDocumento,
  validarDocumento,
};
