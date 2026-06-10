// src/controllers/AuditoriaController.js
const { pool } = require('../configures/db');

/**
 * Obtener todos los eventos de auditoría con paginación
 * Query params: limit, offset
 */
const obtenerEventos = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100
    const offsetNum = Math.max(parseInt(offset) || 0, 0);

    const query = `
      SELECT 
        a.id,
        a.entidad,
        a.entidad_id,
        a.accion,
        a.usuario_id,
        a.descripcion,
        a.datos_anteriores,
        a.datos_nuevos,
        a.fecha_evento,
        u.nombre as usuario_nombre,
        u.email as usuario_email
      FROM auditoria_sistema a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      ORDER BY a.fecha_evento DESC
      LIMIT $1
      OFFSET $2
    `;

    const { rows } = await pool.query(query, [limitNum, offsetNum]);

    // Contar total de eventos
    const countQuery = 'SELECT COUNT(*) as total FROM auditoria_sistema';
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].total);

    return res.json({
      eventos: rows,
      total,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < total
    });
  } catch (err) {
    console.error('Error obteniendo eventos de auditoría:', err);
    return res.status(500).json({ message: 'Error al obtener eventos de auditoría' });
  }
};

/**
 * Obtener eventos de una entidad específica
 */
const obtenerEventosPorEntidad = async (req, res) => {
  try {
    const { entidad } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offsetNum = Math.max(parseInt(offset) || 0, 0);

    const query = `
      SELECT 
        a.id,
        a.entidad,
        a.entidad_id,
        a.accion,
        a.usuario_id,
        a.descripcion,
        a.datos_anteriores,
        a.datos_nuevos,
        a.fecha_evento,
        u.nombre as usuario_nombre,
        u.email as usuario_email
      FROM auditoria_sistema a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE a.entidad = $1
      ORDER BY a.fecha_evento DESC
      LIMIT $2
      OFFSET $3
    `;

    const { rows } = await pool.query(query, [entidad, limitNum, offsetNum]);

    // Contar total
    const countQuery = 'SELECT COUNT(*) as total FROM auditoria_sistema WHERE entidad = $1';
    const countResult = await pool.query(countQuery, [entidad]);
    const total = parseInt(countResult.rows[0].total);

    return res.json({
      eventos: rows,
      entidad,
      total,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < total
    });
  } catch (err) {
    console.error('Error obteniendo eventos por entidad:', err);
    return res.status(500).json({ message: 'Error al obtener eventos' });
  }
};

/**
 * Obtener eventos recientes (últimos 10 por defecto)
 */
const obtenerEventosRecientes = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 10, 50);

    const query = `
      SELECT 
        a.id,
        a.entidad,
        a.entidad_id,
        a.accion,
        a.usuario_id,
        a.descripcion,
        a.datos_anteriores,
        a.datos_nuevos,
        a.fecha_evento,
        u.nombre as usuario_nombre,
        u.email as usuario_email
      FROM auditoria_sistema a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      ORDER BY a.fecha_evento DESC
      LIMIT $1
    `;

    const { rows } = await pool.query(query, [limitNum]);

    return res.json({
      eventos: rows,
      limit: limitNum
    });
  } catch (err) {
    console.error('Error obteniendo eventos recientes:', err);
    return res.status(500).json({ message: 'Error al obtener eventos recientes' });
  }
};

/**
 * Obtener eventos de una entidad específica por ID
 */
const obtenerEventosPorEntidadId = async (req, res) => {
  try {
    const { entidad, entidad_id } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offsetNum = Math.max(parseInt(offset) || 0, 0);

    const query = `
      SELECT 
        a.id,
        a.entidad,
        a.entidad_id,
        a.accion,
        a.usuario_id,
        a.descripcion,
        a.datos_anteriores,
        a.datos_nuevos,
        a.fecha_evento,
        u.nombre as usuario_nombre,
        u.email as usuario_email
      FROM auditoria_sistema a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE a.entidad = $1 AND a.entidad_id = $2
      ORDER BY a.fecha_evento DESC
      LIMIT $3
      OFFSET $4
    `;

    const { rows } = await pool.query(query, [entidad, entidad_id, limitNum, offsetNum]);

    // Contar total
    const countQuery = 'SELECT COUNT(*) as total FROM auditoria_sistema WHERE entidad = $1 AND entidad_id = $2';
    const countResult = await pool.query(countQuery, [entidad, entidad_id]);
    const total = parseInt(countResult.rows[0].total);

    return res.json({
      eventos: rows,
      entidad,
      entidad_id,
      total,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < total
    });
  } catch (err) {
    console.error('Error obteniendo eventos por entidad e ID:', err);
    return res.status(500).json({ message: 'Error al obtener eventos' });
  }
};

module.exports = {
  obtenerEventos,
  obtenerEventosPorEntidad,
  obtenerEventosRecientes,
  obtenerEventosPorEntidadId
};
