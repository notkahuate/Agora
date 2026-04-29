// src/models/DocumentoResponsableModel.js
const pool = require('../configures/db');

// 📌 Asignar responsable a un documento requerido
const asignarResponsable = async (documento_requerido_id, usuario_id) => {
  // Primero, verificar si ya existe un responsable
  const existe = await pool.query(
    'SELECT id FROM documento_responsables WHERE documento_requerido_id = $1',
    [documento_requerido_id]
  );

  if (existe.rows.length > 0) {
    // Actualizar
    const result = await pool.query(
      'UPDATE documento_responsables SET usuario_id = $1, fecha_asignacion = CURRENT_TIMESTAMP WHERE documento_requerido_id = $2 RETURNING *',
      [usuario_id, documento_requerido_id]
    );
    return result.rows[0];
  } else {
    // Insertar
    const result = await pool.query(
      'INSERT INTO documento_responsables (documento_requerido_id, usuario_id) VALUES ($1, $2) RETURNING *',
      [documento_requerido_id, usuario_id]
    );
    return result.rows[0];
  }
};

// 📌 Obtener responsable de un documento
const obtenerResponsable = async (documento_requerido_id) => {
  const result = await pool.query(
    `SELECT dr.*, u.nombre as usuario_nombre, u.email as usuario_email
     FROM documento_responsables dr
     JOIN usuarios u ON dr.usuario_id = u.id
     WHERE dr.documento_requerido_id = $1`,
    [documento_requerido_id]
  );
  return result.rows[0];
};

// 📌 Listar todos los responsables (para superadmin)
const listarTodosResponsables = async () => {
  const result = await pool.query(
    `SELECT dr.*, u.nombre as usuario_nombre, u.email as usuario_email,
            dreq.id as documento_id, td.nombre as tipo_documento, e.nombre as empresa_nombre
     FROM documento_responsables dr
     JOIN usuarios u ON dr.usuario_id = u.id
     JOIN documentos_requeridos dreq ON dr.documento_requerido_id = dreq.id
     JOIN tipos_documentos td ON dreq.tipo_documento_id = td.id
     JOIN empresas e ON dreq.empresa_id = e.id
     ORDER BY dr.fecha_asignacion DESC`
  );
  return result.rows;
};

module.exports = {
  asignarResponsable,
  obtenerResponsable,
  listarTodosResponsables
};