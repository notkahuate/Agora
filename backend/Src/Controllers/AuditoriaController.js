// src/controllers/AuditoriaController.js
const { pool } = require('../configures/db');

async function enriquecerEvento(evento) {
  if (evento.descripcion && String(evento.descripcion).trim().length > 0) {
    return evento;
  }

  const datosNuevos = evento.datos_nuevos || {};
  const datosAnteriores = evento.datos_anteriores || {};
  const entidad = evento.entidad;
  let descripcion = evento.descripcion || '';

  const empresaId = datosNuevos.empresa_id || datosAnteriores.empresa_id || datosNuevos.empresaId || datosAnteriores.empresaId;
  const tipoDocumentoId = datosNuevos.tipo_documento_id || datosAnteriores.tipo_documento_id || datosNuevos.tipoDocumentoId || datosAnteriores.tipoDocumentoId;
  const nombreArchivo = datosNuevos.nombre_archivo || datosAnteriores.nombre_archivo || datosNuevos.nombreArchivo || datosAnteriores.nombreArchivo;
  const documentoRequeridoId = datosNuevos.documento_requerido_id || datosAnteriores.documento_requerido_id || datosNuevos.documentoRequeridoId || datosAnteriores.documentoRequeridoId;

  let empresaNombre;
  let tipoDocumentoNombre;

  try {
    if (entidad === 'documento_responsables' && evento.entidad_id) {
      const query = `
        SELECT e.nombre AS empresa_nombre, td.nombre AS tipo_nombre
        FROM documento_responsables dr
        JOIN documentos_requeridos dreq ON dr.documento_requerido_id = dreq.id
        JOIN empresas e ON dreq.empresa_id = e.id
        JOIN tipos_documentos td ON dreq.tipo_documento_id = td.id
        WHERE dr.id = $1
      `;
      const resultado = await pool.query(query, [evento.entidad_id]);
      if (resultado.rows.length) {
        empresaNombre = resultado.rows[0].empresa_nombre;
        tipoDocumentoNombre = resultado.rows[0].tipo_nombre;
      }
    }

    if ((entidad === 'documentos_requeridos' || entidad === 'documentos_subidos') && empresaId && tipoDocumentoId) {
      const query = `
        SELECT e.nombre AS empresa_nombre, td.nombre AS tipo_nombre
        FROM empresas e
        JOIN tipos_documentos td ON td.id = $2
        WHERE e.id = $1
      `;
      const resultado = await pool.query(query, [empresaId, tipoDocumentoId]);
      if (resultado.rows.length) {
        empresaNombre = resultado.rows[0].empresa_nombre;
        tipoDocumentoNombre = resultado.rows[0].tipo_nombre;
      }
    }
  } catch (err) {
    console.error('Error enriqueciendo evento de auditoría:', err);
  }

  if (entidad === 'documentos_requeridos' && evento.accion === 'asignar') {
    descripcion = `Asignado documento requerido '${tipoDocumentoNombre || tipoDocumentoId}' a empresa '${empresaNombre || empresaId}'`;
  } else if (entidad === 'documento_responsables' && evento.accion === 'asignar') {
    descripcion = `Asignado documento '${tipoDocumentoNombre || documentoRequeridoId}' de la empresa '${empresaNombre || empresaId}'`;
  } else if (entidad === 'documentos_subidos') {
    const accion = evento.accion || 'actualizado';
    const nombreDoc = nombreArchivo || tipoDocumentoNombre || tipoDocumentoId;
    const empresaText = empresaNombre || empresaId;
    if (accion === 'subir') {
      descripcion = `Documento '${nombreDoc}' subido para empresa '${empresaText}'`;
    } else if (accion === 'descargar') {
      descripcion = `Descargado documento '${nombreDoc}' de empresa '${empresaText}'`;
    } else if (accion === 'validar') {
      descripcion = `Documento '${nombreDoc}' de empresa '${empresaText}' cambiado al estado ${evento.datos_nuevos?.estado || evento.datos_anteriores?.estado || 'desconocido'}`;
    } else if (accion === 'actualizar') {
      descripcion = `Documento '${nombreDoc}' actualizado para empresa '${empresaText}'`;
    } else if (accion === 'eliminar') {
      descripcion = `Documento '${nombreDoc}' eliminado de empresa '${empresaText}'`;
    }
  }

  if (!descripcion) {
    descripcion = evento.descripcion || `${evento.accion || 'Evento'} en ${evento.entidad}`;
    if (evento.entidad_id) {
      descripcion += ` (#${evento.entidad_id})`;
    }
  }

  return {
    ...evento,
    descripcion
  };
}

/**
 * Obtener todos los eventos de auditoría con paginación
 * Query params: limit, offset, empresa_id (opcional)
 */
const obtenerEventos = async (req, res) => {
  try {
    const { limit = 20, offset = 0, empresa_id, skipCount } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100
    const offsetNum = Math.max(parseInt(offset) || 0, 0);
    const requestedEmpresaId = empresa_id ? parseInt(empresa_id) : null;

    let empresaIdNum = null;
    if (req.user && req.user.rol === 'usuario') {
      empresaIdNum = req.user.empresa_id || null;
    } else {
      empresaIdNum = requestedEmpresaId;
    }

    let query = `
      SELECT 
        a.id,
        a.entidad,
        a.entidad_id,
        a.accion,
        a.usuario_id,
        a.empresa_id,
        a.descripcion,
        a.datos_anteriores,
        a.datos_nuevos,
        a.fecha_evento,
        u.nombre as usuario_nombre,
        u.email as usuario_email
      FROM auditoria_sistema a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
    `;

    let countQuery = 'SELECT COUNT(*) as total FROM auditoria_sistema a';
    let params = [];
    let paramIndex = 1;

    // Usuarios solo ven su propia empresa; otros roles pueden filtrar opcionalmente
    if (empresaIdNum) {
      query += ` WHERE a.empresa_id = $${paramIndex}`;
      countQuery += ` WHERE a.empresa_id = $1`;
      params.push(empresaIdNum);
      paramIndex++;
    } else if (req.user && req.user.rol === 'usuario') {
      // si el usuario no tiene empresa asignada, devolver vacío
      return res.json({ eventos: [], total: 0, limit: limitNum, offset: offsetNum, hasMore: false });
    }

    query += ` ORDER BY a.fecha_evento DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, offsetNum);

    const { rows } = await pool.query(query, params);
    const eventos = await Promise.all(rows.map(enriquecerEvento));

    let total = eventos.length;
    if (skipCount !== '1' && skipCount !== 'true') {
      const countParams = empresaIdNum ? [empresaIdNum] : [];
      const countResult = await pool.query(countQuery, countParams);
      total = parseInt(countResult.rows[0].total);
    }

    return res.json({
      eventos,
      total,
      limit: limitNum,
      offset: offsetNum,
      hasMore: skipCount === '1' || skipCount === 'true'
        ? eventos.length >= limitNum
        : offsetNum + limitNum < total
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
    const eventos = await Promise.all(rows.map(enriquecerEvento));

    // Contar total
    const countQuery = 'SELECT COUNT(*) as total FROM auditoria_sistema WHERE entidad = $1';
    const countResult = await pool.query(countQuery, [entidad]);
    const total = parseInt(countResult.rows[0].total);

    return res.json({
      eventos,
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
    const { limit = 10, empresa_id } = req.query;
    const limitNum = Math.min(parseInt(limit) || 10, 50);

    let empresaIdNum = null;
    if (req.user && req.user.rol === 'usuario') {
      empresaIdNum = req.user.empresa_id || null;
      if (!empresaIdNum) {
        return res.json({ eventos: [], limit: limitNum });
      }
    } else if (empresa_id) {
      empresaIdNum = parseInt(empresa_id) || null;
    }

    const params = [limitNum];
    let query = `
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
    `;

    if (empresaIdNum) {
      query += ` WHERE a.empresa_id = $2`;
      params.push(empresaIdNum);
    }

    query += ` ORDER BY a.fecha_evento DESC LIMIT $1`;

    const { rows } = await pool.query(query, params);
    const eventos = await Promise.all(rows.map(enriquecerEvento));

    return res.json({
      eventos,
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
    const eventos = await Promise.all(rows.map(enriquecerEvento));

    // Contar total
    const countQuery = 'SELECT COUNT(*) as total FROM auditoria_sistema WHERE entidad = $1 AND entidad_id = $2';
    const countResult = await pool.query(countQuery, [entidad, entidad_id]);
    const total = parseInt(countResult.rows[0].total);

    return res.json({
      eventos,
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
