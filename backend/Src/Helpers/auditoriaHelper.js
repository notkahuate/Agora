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
const registrar = async ({ entidad, entidad_id = null, accion, usuario_id = null, descripcion = null, datos_anteriores = null, datos_nuevos = null, empresa_id = null }) => {
  const valoresBase = [
    entidad,
    entidad_id,
    accion,
    usuario_id,
    descripcion,
    datos_anteriores ? JSON.stringify(datos_anteriores) : null,
    datos_nuevos ? JSON.stringify(datos_nuevos) : null,
  ];

  try {
    const texto = `
      INSERT INTO auditoria_sistema
        (entidad, entidad_id, accion, usuario_id, descripcion, datos_anteriores, datos_nuevos, empresa_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `;
    const { rows } = await pool.query(texto, [...valoresBase, empresa_id]);
    return rows[0];
  } catch (err) {
    if (!String(err.message).includes('empresa_id')) {
      console.error('Error registrando auditoria:', err.message);
      return null;
    }
    try {
      const texto = `
        INSERT INTO auditoria_sistema
          (entidad, entidad_id, accion, usuario_id, descripcion, datos_anteriores, datos_nuevos)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *;
      `;
      const { rows } = await pool.query(texto, valoresBase);
      return rows[0];
    } catch (err2) {
      console.error('Error registrando auditoria:', err2.message);
      return null;
    }
  }
};

module.exports = {
  registrar,
};
