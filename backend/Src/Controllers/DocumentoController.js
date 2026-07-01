// src/controllers/documentoController.js
const Documento = require('../Models/DocumentModel');
const { pool } = require('../configures/db');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const auditoria = require('../Helpers/auditoriaHelper');

function resolverContextoSubida(req) {
  const body = req.body || {};
  const requester = req.user;
  const isAdmin = requester && requester.rol === 'super_admin';
  const isUsuario = requester && requester.rol === 'usuario';

  if (!isAdmin && !isUsuario) {
    return { error: { status: 403, message: 'No autorizado para subir documentos' } };
  }

  const resolvedUsuarioId = isUsuario ? requester.id : body.usuario_id;
  const resolvedEmpresaId = isUsuario ? requester.empresa_id : body.empresa_id;
  const tipo_documento_id = body.tipo_documento_id;

  if (!resolvedUsuarioId || !tipo_documento_id || !resolvedEmpresaId) {
    return { error: { status: 400, message: 'usuario_id, tipo_documento_id y empresa_id son obligatorios' } };
  }

  return {
    resolvedUsuarioId,
    resolvedEmpresaId,
    tipo_documento_id,
    comentarios: body.comentarios || null
  };
}

async function registrarAuditoriaSubida({ creados, resolvedUsuarioId, resolvedEmpresaId, tipo_documento_id, loteSubida }) {
  try {
    const infoResult = await pool.query(
      `SELECT e.nombre AS empresa_nombre, td.nombre AS tipo_nombre
       FROM empresas e, tipos_documentos td
       WHERE e.id = $1 AND td.id = $2`,
      [resolvedEmpresaId, tipo_documento_id]
    );
    const info = infoResult.rows[0] || {};
    const nombres = creados.map(d => d.nombre_archivo).join(', ');
    await auditoria.registrar({
      entidad: 'documentos_subidos',
      entidad_id: creados[0]?.id || null,
      accion: 'subir',
      usuario_id: resolvedUsuarioId,
      descripcion: creados.length > 1
        ? `${creados.length} archivos subidos para '${info.tipo_nombre || tipo_documento_id}' (${nombres})`
        : `Documento '${info.tipo_nombre || creados[0]?.nombre_archivo}' subido para empresa '${info.empresa_nombre || resolvedEmpresaId}'`,
      datos_nuevos: { lote_subida: loteSubida, archivos: creados.map(d => ({ id: d.id, nombre: d.nombre_archivo })) },
      empresa_id: resolvedEmpresaId
    });
  } catch (e) {
    console.error('auditoria crearDocumento error:', e.message);
  }
}

exports.crearDocumento = async (req, res) => {
  try {
    const ctx = resolverContextoSubida(req);
    if (ctx.error) {
      return res.status(ctx.error.status).json({ message: ctx.error.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'El archivo es obligatorio' });
    }

    const loteSubida = crypto.randomUUID();

    const creado = await Documento.crearDocumento({
      usuario_id: ctx.resolvedUsuarioId,
      tipo_documento_id: ctx.tipo_documento_id,
      empresa_id: ctx.resolvedEmpresaId,
      nombre_archivo: req.file.originalname,
      ruta_archivo: null,
      archivo: req.file.buffer,
      mime_type: req.file.mimetype,
      comentarios: ctx.comentarios,
      lote_subida: loteSubida
    });

    await registrarAuditoriaSubida({
      creados: [creado],
      resolvedUsuarioId: ctx.resolvedUsuarioId,
      resolvedEmpresaId: ctx.resolvedEmpresaId,
      tipo_documento_id: ctx.tipo_documento_id,
      loteSubida
    });

    return res.status(201).json({
      ...creado,
      ruta_archivo: `/api/documentos/${creado.id}/descargar`
    });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(400).json({ message: 'Referencia inválida (usuario, tipo o empresa no existe)', detail: err.detail });
    }
    return res.status(500).json({ message: 'Error al crear documento', error: err.message });
  }
};

exports.crearDocumentosLote = async (req, res) => {
  try {
    const ctx = resolverContextoSubida(req);
    if (ctx.error) {
      return res.status(ctx.error.status).json({ message: ctx.error.message });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({ message: 'Debes seleccionar al menos un archivo' });
    }

    const loteSubida = crypto.randomUUID();
    const creados = [];

    for (const file of files) {
      const creado = await Documento.crearDocumento({
        usuario_id: ctx.resolvedUsuarioId,
        tipo_documento_id: ctx.tipo_documento_id,
        empresa_id: ctx.resolvedEmpresaId,
        nombre_archivo: file.originalname,
        ruta_archivo: null,
        archivo: file.buffer,
        mime_type: file.mimetype,
        comentarios: ctx.comentarios || `Lote de ${files.length} archivo(s)`,
        lote_subida: loteSubida
      });
      creados.push({
        ...creado,
        ruta_archivo: `/api/documentos/${creado.id}/descargar`
      });
    }

    await registrarAuditoriaSubida({
      creados,
      resolvedUsuarioId: ctx.resolvedUsuarioId,
      resolvedEmpresaId: ctx.resolvedEmpresaId,
      tipo_documento_id: ctx.tipo_documento_id,
      loteSubida
    });

    return res.status(201).json({
      lote_subida: loteSubida,
      total: creados.length,
      documentos: creados
    });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(400).json({ message: 'Referencia inválida (usuario, tipo o empresa no existe)', detail: err.detail });
    }
    return res.status(500).json({ message: 'Error al subir archivos', error: err.message });
  }
};

exports.listarDocumentos = async (req, res) => {
  try {
    const requester = req.user;
    let docs = [];
    if (requester.rol === 'super_admin') {
      docs = await Documento.listarDocumentos();
    } else if (requester.rol === 'auditor') {
  docs = await Documento.listarDocumentos(); // 🔥 VE TODO
}else {
      docs = await Documento.listarDocumentosPorUsuario(requester.id);
    }
    return res.json(docs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al listar documentos' });
  }
};

exports.obtenerDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Documento.obtenerDocumentoPorId(id);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado' });
    const requester = req.user;
    const isAdmin = requester.rol === 'super_admin';
    const isAuditor = requester.rol === 'auditor';
    const isOwner = String(doc.usuario_id) === String(requester.id);

    if (!isAdmin && !isAuditor && !isOwner) {
      return res.status(403).json({ message: 'No autorizado para ver este documento' });
    }
    return res.json(doc);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al obtener documento' });
  }
};

exports.actualizarDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const campos = req.body || {};
    const requester = req.user;
    const doc = await Documento.obtenerDocumentoPorId(id);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado' });
    const isAdmin = requester.rol === 'super_admin';
    const isOwner = String(doc.usuario_id) === String(requester.id);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'No autorizado para actualizar este documento' });
    }

    // prohibir actualizar campos que no quieras: fecha_subida, fecha_validacion si no corresponde, etc.
    delete campos.fecha_subida;
    delete campos.fecha_validacion;
    delete campos.usuario_id;
    delete campos.empresa_id;
    delete campos.validado_por;

    const actualizado = await Documento.actualizarDocumento(id, campos);
    try {
      const infoResult = await pool.query(
        `SELECT e.nombre AS empresa_nombre, td.nombre AS tipo_nombre
         FROM empresas e, tipos_documentos td
         WHERE e.id = $1 AND td.id = $2`,
        [doc.empresa_id, doc.tipo_documento_id]
      );
      const info = infoResult.rows[0] || {};
      await auditoria.registrar({
        entidad: 'documentos_subidos',
        entidad_id: actualizado.id,
        accion: 'actualizar',
        usuario_id: requester.id,
        descripcion: `Documento '${info.tipo_nombre || actualizado.nombre_archivo}' actualizado para empresa '${info.empresa_nombre || doc.empresa_id}'`,
        datos_anteriores: doc,
        datos_nuevos: actualizado,
        empresa_id: doc.empresa_id
      });
    } catch (e) {
      console.error('auditoria actualizarDocumento error:', e.message);
    }
    return res.json(actualizado);
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(400).json({ message: 'Referencia inválida en actualización', detail: err.detail });
    }
    return res.status(500).json({ message: 'Error al actualizar documento' });
  }
};

exports.eliminarDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const requester = req.user;
    const doc = await Documento.obtenerDocumentoPorId(id);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado' });

    const isAdmin = requester && requester.rol === 'super_admin';
    const isAuditor = requester && requester.rol === 'auditor';
    const isOwner = requester && String(doc.usuario_id) === String(requester.id);

    if (isOwner && requester.rol === 'usuario') {
      const estado = String(doc.estado || '').toLowerCase();
      if (['validado', 'revisado', 'aprobado'].includes(estado)) {
        return res.status(403).json({ message: 'No se puede eliminar un documento validado' });
      }
    }

    if (!isAdmin && !isAuditor && !isOwner) {
      return res.status(403).json({ message: 'No autorizado para eliminar este documento' });
    }

    const eliminado = await Documento.eliminarDocumento(id);
    if (!eliminado) return res.status(404).json({ message: 'Documento no encontrado' });

    try {
      const infoResult = await pool.query(
        `SELECT e.nombre AS empresa_nombre, td.nombre AS tipo_nombre
         FROM empresas e, tipos_documentos td
         WHERE e.id = $1 AND td.id = $2`,
        [doc.empresa_id, doc.tipo_documento_id]
      );
      const info = infoResult.rows[0] || {};
      await auditoria.registrar({
        entidad: 'documentos_subidos',
        entidad_id: doc.id,
        accion: 'eliminar',
        usuario_id: req.user ? req.user.id : null,
        descripcion: `Documento '${info.tipo_nombre || doc.nombre_archivo}' eliminado de empresa '${info.empresa_nombre || doc.empresa_id}'`,
        datos_anteriores: doc,
        empresa_id: doc.empresa_id
      });
    } catch (e) {
      console.error('auditoria eliminarDocumento error:', e.message);
    }

    return res.json({ message: 'Documento eliminado', documento: eliminado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al eliminar documento' });
  }
};

exports.validarDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { estado, comentarios } = body;
    const requester = req.user;

    if (!estado || !['subido','validado','rechazado','revisado'].includes(estado)) {
      return res.status(400).json({ message: "estado inválido. Usa 'subido', 'validado', 'rechazado' o 'revisado'." });
    }
    const doc = await Documento.obtenerDocumentoPorId(id);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado' });
    // Auditores y super_admin pueden validar cualquier documento
    // No hay restricción adicional de empresa para auditores

    const actualizado = await Documento.validarDocumento(id, { estado, validado_por: requester.id, comentarios });
    // Registrar auditoría: cambio de estado
    try {
      const infoResult = await pool.query(
        `SELECT e.nombre AS empresa_nombre, td.nombre AS tipo_nombre
         FROM empresas e, tipos_documentos td
         WHERE e.id = $1 AND td.id = $2`,
        [doc.empresa_id, doc.tipo_documento_id]
      );
      const info = infoResult.rows[0] || {};
      await auditoria.registrar({
        entidad: 'documentos_subidos',
        entidad_id: actualizado.id,
        accion: 'validar',
        usuario_id: requester.id,
        descripcion: `Documento '${info.tipo_nombre || actualizado.nombre_archivo}' de empresa '${info.empresa_nombre || doc.empresa_id}' cambió a estado ${actualizado.estado}`,
        datos_anteriores: doc,
        datos_nuevos: actualizado,
        empresa_id: doc.empresa_id
      });
    } catch (e) {
      console.error('auditoria validarDocumento error:', e.message);
    }

    return res.json(actualizado);
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(400).json({ message: 'validado_por no corresponde a un usuario válido', detail: err.detail });
    }
    return res.status(500).json({ message: 'Error al validar documento' });
  }
};

exports.listarPendientesValidacion = async (req, res) => {
  try {
    const requester = req.user;
    if (!['auditor', 'super_admin'].includes(requester.rol)) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    // Listar documentos con estado 'subido' y todos sus datos con JOINs
    const pendientes = await Documento.listarPendientesValidacionConJoin();

    return res.json(pendientes);
  } catch (err) {
    console.error('❌ Error en listarPendientesValidacion:', err);
    return res.status(500).json({ message: 'Error al listar documentos pendientes de validación' });
  }
};

exports.contarRevisadosMes = async (req, res) => {
  try {
    const requester = req.user;
    if (!['auditor', 'super_admin'].includes(requester.rol)) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    // Contar documentos con estado 'revisado' en el mes actual
    const { rows } = await pool.query(`
      SELECT COUNT(*) as count
      FROM documentos_subidos
      WHERE estado = 'revisado'
      AND MONTH(fecha_validacion) = MONTH(CURRENT_DATE)
      AND YEAR(fecha_validacion) = YEAR(CURRENT_DATE)
    `);

    return res.json({ count: parseInt(rows[0].count) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al contar documentos revisados del mes' });
  }
};

exports.listarColaPrioritaria = async (req, res) => {
  try {
    const requester = req.user;
    if (!['auditor', 'super_admin'].includes(requester.rol)) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const limite = Math.min(parseInt(req.query.limit, 10) || 8, 20);
    const cola = await Documento.listarColaPrioritariaAuditor(limite);
    return res.json(cola);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al listar cola prioritaria' });
  }
};

exports.listarHistorialPorTipo = async (req, res) => {
  try {
    const { empresa_id, tipo_documento_id } = req.query;
    const requester = req.user;

    if (!empresa_id || !tipo_documento_id) {
      return res.status(400).json({ message: 'empresa_id y tipo_documento_id son obligatorios' });
    }

    const empresaId = Number(empresa_id);
    const tipoId = Number(tipo_documento_id);
    const isAdmin = requester.rol === 'super_admin';
    const isAuditor = requester.rol === 'auditor';
    const isSameEmpresa = String(requester.empresa_id) === String(empresaId);

    if (!isAdmin && !isAuditor && !isSameEmpresa) {
      return res.status(403).json({ message: 'No autorizado para ver este historial' });
    }

    const historial = await Documento.listarHistorialPorTipo(empresaId, tipoId);
    return res.json(historial);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al listar historial del documento' });
  }
};

exports.descargarDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Documento.obtenerDocumentoArchivoPorId(id);

    if (!doc) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    const requester = req.user;
    const isAdmin = requester.rol === 'super_admin';
    const isOwner = String(doc.usuario_id) === String(requester.id);
    const isAuditor = requester.rol === 'auditor';
    const isSameEmpresa = String(doc.empresa_id) === String(requester.empresa_id);

    // Verificar permisos: owner, admin, auditor o mismo empresa (super_admin/auditor/usuario de la empresa)
    if (!isAdmin && !isOwner && !isAuditor && !isSameEmpresa) {
      return res.status(403).json({ message: 'No autorizado para descargar este documento' });
    }

    try {
      const infoResult = await pool.query(
        `SELECT e.nombre AS empresa_nombre, td.nombre AS tipo_nombre
         FROM empresas e, tipos_documentos td
         WHERE e.id = $1 AND td.id = $2`,
        [doc.empresa_id, doc.tipo_documento_id]
      );
      const info = infoResult.rows[0] || {};
      await auditoria.registrar({
        entidad: 'documentos_subidos',
        entidad_id: doc.id,
        accion: 'descargar',
        usuario_id: requester.id,
        descripcion: `Descargado documento '${info.tipo_nombre || doc.nombre_archivo}' de empresa '${info.empresa_nombre || doc.empresa_id}'`,
        datos_anteriores: doc,
        empresa_id: doc.empresa_id
      });
    } catch (e) {
      console.error('auditoria descargarDocumento error:', e.message);
    }

    if (doc.archivo && doc.archivo.length > 0) {
      res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.nombre_archivo)}"`);
      return res.send(doc.archivo);
    }

    if (!doc.ruta_archivo) {
      return res.status(404).json({ message: 'El documento no tiene archivo asociado' });
    }

    const uploadDir = path.join(__dirname, '../uploads');
    const filename = path.basename(doc.ruta_archivo);
    const filepath = path.join(uploadDir, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: 'Archivo no encontrado en el servidor' });
    }

    res.download(filepath, doc.nombre_archivo, (err) => {
      if (err) {
        console.error('Error descargando archivo:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error al descargar el archivo' });
        }
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al descargar documento', error: err.message });
  }
};
