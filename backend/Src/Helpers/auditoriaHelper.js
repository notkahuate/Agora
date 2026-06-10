const { pool } = require('../configures/db');

/**
 * Registrar un evento en la tabla auditoria_sistema.
 * Parámetros:
 *  - entidad: string (nombre de la tabla o entidad)
 *  - entidad_id: integer | null
 *  - accion: string (crear, actualizar, eliminar, asignar, validar, subir, registro_publico...)
 *  - usuario_id: integer | null (quien realiza la acción)
 *  - descripcion: string | null
 *  - datos_anteriores: object | null
 *  - datos_nuevos: object | null
 */
const registrar = async ({ entidad, entidad_id = null, accion, usuario_id = null, descripcion = null, datos_anteriores = null, datos_nuevos = null }) => {
  try {
    const texto = `
      INSERT INTO auditoria_sistema
        (entidad, entidad_id, accion, usuario_id, descripcion, datos_anteriores, datos_nuevos)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *;
    `;

    const valores = [
      entidad,
      entidad_id,
      accion,
      usuario_id,
      descripcion,
      datos_anteriores ? JSON.stringify(datos_anteriores) : null,
      datos_nuevos ? JSON.stringify(datos_nuevos) : null,
    ];

    const { rows } = await pool.query(texto, valores);
    return rows[0];
  } catch (err) {
    // No bloquear la operación principal por fallos en auditoría
    console.error('Error registrando auditoria:', err.message);
    return null;
  }
};

module.exports = {
  registrar,
};
