// src/controllers/AuditoriaController.js
const { pool } = require('../configures/db');

function parseJsonField(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function enriquecerEvento(evento) {
  try {
    if (evento.descripcion && String(evento.descripcion).trim().length > 0) {
      return evento;
    }

    const datosNuevos = parseJsonField(evento.datos_nuevos);
    const datosAnteriores = parseJsonField(evento.datos_anteriores);
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
      console.error('Error enriqueciendo evento de auditoría:', err.message);
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
        descripcion = `Documento '${nombreDoc}' de empresa '${empresaText}' cambiado al estado ${datosNuevos.estado || datosAnteriores.estado || 'desconocido'}`;
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
  } catch (err) {
    console.error('Error procesando evento de auditoría:', err.message);
    return evento;
  }
}

function parseEmpresaId(value) {
  if (value == null || value === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Alcance de actividad reciente:
 * - auditor: todas las empresas (o una empresa si viene empresa_id en query)
 * - super_admin / usuario: solo su empresa
 */
function resolverAlcanceAuditoria(req, requestedEmpresaId) {
  const rol = req.user?.rol;
  const userEmpresaId = parseEmpresaId(req.user?.empresa_id);
  const requested = parseEmpresaId(requestedEmpresaId);

  if (rol === 'auditor') {
    if (requested) {
      return { tipo: 'empresa', params: [requested] };
    }
    return { tipo: 'todos', params: [] };
  }

  if (rol === 'super_admin' || rol === 'usuario') {
    if (userEmpresaId) {
      return { tipo: 'empresa', params: [userEmpresaId] };
    }
    if (rol === 'usuario' && req.user?.id) {
      return { tipo: 'usuario', params: [req.user.id] };
    }
    return { tipo: 'vacio', params: [] };
  }

  return { tipo: 'todos', params: [] };
}

function construirFiltroAuditoria(alcance, paramIndex = 1) {
  switch (alcance.tipo) {
    case 'empresa':
      return {
        whereSql: ` WHERE COALESCE(a.empresa_id, u.empresa_id) = $${paramIndex}`,
        countWhereSql: ` WHERE COALESCE(a.empresa_id, u.empresa_id) = $${paramIndex}`,
        countJoinSql: ' LEFT JOIN usuarios u ON a.usuario_id = u.id',
        params: [...alcance.params],
        nextIndex: paramIndex + 1
      };
    case 'usuario':
      return {
        whereSql: ` WHERE a.usuario_id = $${paramIndex}`,
        countWhereSql: ` WHERE a.usuario_id = $${paramIndex}`,
        countJoinSql: '',
        params: [...alcance.params],
        nextIndex: paramIndex + 1
      };
    case 'vacio':
      return {
        whereSql: ' WHERE 1=0',
        countWhereSql: ' WHERE 1=0',
        countJoinSql: '',
        params: [],
        nextIndex: paramIndex
      };
    default:
      return {
        whereSql: '',
        countWhereSql: '',
        countJoinSql: '',
        params: [],
        nextIndex: paramIndex
      };
  }
}

/**
 * Obtener todos los eventos de auditoría con paginación
 * Query params: limit, offset, empresa_id (opcional, solo auditor en detalle de empresa)
 */
const obtenerEventos = async (req, res) => {
  try {
    const { limit = 20, offset = 0, empresa_id, skipCount } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100
    const offsetNum = Math.max(parseInt(offset) || 0, 0);

    const alcance = resolverAlcanceAuditoria(req, empresa_id);
    const filtro = construirFiltroAuditoria(alcance, 1);

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

    let countQuery = `SELECT COUNT(*) as total FROM auditoria_sistema a${filtro.countJoinSql || ''}`;
    const params = [...filtro.params];

    query += filtro.whereSql;
    countQuery += filtro.countWhereSql;

    // LIMIT/OFFSET inline: MySQL en hosting compartido falla con LIMIT/OFFSET como parámetros preparados
    query += ` ORDER BY a.fecha_evento DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

    const { rows } = await pool.query(query, params);
    const eventos = await Promise.all(rows.map((row) => enriquecerEvento(row)));

    let total = eventos.length;
    if (skipCount !== '1' && skipCount !== 'true') {
      const countResult = await pool.query(countQuery, filtro.params);
      total = parseInt(countResult.rows[0].total, 10) || 0;
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
    return res.status(500).json({
      message: 'Error al obtener eventos de auditoría',
      error: process.env.ENV === 'local' ? err.message : undefined
    });
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
      LIMIT ${limitNum}
      OFFSET ${offsetNum}
    `;

    const { rows } = await pool.query(query, [entidad]);
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

    const alcance = resolverAlcanceAuditoria(req, empresa_id);
    const filtro = construirFiltroAuditoria(alcance, 1);

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

    query += filtro.whereSql;
    query += ` ORDER BY a.fecha_evento DESC LIMIT ${limitNum}`;

    const { rows } = await pool.query(query, filtro.params);
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
      LIMIT ${limitNum}
      OFFSET ${offsetNum}
    `;

    const { rows } = await pool.query(query, [entidad, entidad_id]);
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
