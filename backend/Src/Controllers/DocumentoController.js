// src/controllers/documentoController.js
const Documento = require('../Models/DocumentModel');
const { pool } = require('../configures/db');
const fs = require('fs');
const path = require('path');
const auditoria = require('../Helpers/auditoriaHelper');

exports.crearDocumento = async (req, res) => {
  try {
    const body = req.body || {};
    const { usuario_id, tipo_documento_id, empresa_id, comentarios } = body;
    const requester = req.user;
    const isAdmin = requester && requester.rol === 'super_admin';
    const isUsuario = requester && requester.rol === 'usuario';

    if (!isAdmin && !isUsuario) {
      return res.status(403).json({ message: 'No autorizado para subir documentos' });
    }

    const resolvedUsuarioId = isUsuario ? requester.id : usuario_id;
    const resolvedEmpresaId = isUsuario ? requester.empresa_id : empresa_id;

    if (!resolvedUsuarioId || !tipo_documento_id || !resolvedEmpresaId || !req.file) {
      return res.status(400).json({ message: 'usuario_id, tipo_documento_id, empresa_id y archivo son obligatorios' });
    }

    // Obtener nombre del archivo subido
    const nombre_archivo = req.file.originalname;
    const archivo = req.file.buffer;
    const mime_type = req.file.mimetype;

    const creado = await Documento.crearDocumento({
      usuario_id: resolvedUsuarioId,
      tipo_documento_id,
      empresa_id: resolvedEmpresaId,
      nombre_archivo,
      ruta_archivo: null,
      archivo,
      mime_type,
      comentarios
    });

    // Registrar auditoría: documento subido
    try {
      await auditoria.registrar({
        entidad: 'documentos_subidos',
        entidad_id: creado.id,
        accion: 'subir',
        usuario_id: resolvedUsuarioId,
        descripcion: `Documento subido: ${creado.nombre_archivo}`,
        datos_nuevos: creado
      });
    } catch (e) {
      console.error('auditoria crearDocumento error:', e.message);
    }

    return res.status(201).json({
      ...creado,
      ruta_archivo: `/api/documentos/${creado.id}/descargar`
    });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') { // foreign key violation
      return res.status(400).json({ message: 'Referencia inválida (usuario, tipo o empresa no existe)', detail: err.detail });
    }
    return res.status(500).json({ message: 'Error al crear documento', error: err.message });
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
    const isOwner = String(doc.usuario_id) === String(requester.id);
    const sameEmpresa = requester.empresa_id && String(doc.empresa_id) === String(requester.empresa_id);
    if (!isAdmin && !isOwner && !(requester.rol === 'auditor' && sameEmpresa)) {
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
      await auditoria.registrar({
        entidad: 'documentos_subidos',
        entidad_id: actualizado.id,
        accion: 'actualizar',
        usuario_id: requester.id,
        descripcion: `Documento ${actualizado.id} actualizado`,
        datos_anteriores: doc,
        datos_nuevos: actualizado
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
    const doc = await Documento.obtenerDocumentoPorId(id);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado' });

    const eliminado = await Documento.eliminarDocumento(id);
    if (!eliminado) return res.status(404).json({ message: 'Documento no encontrado' });

    try {
      await auditoria.registrar({
        entidad: 'documentos_subidos',
        entidad_id: doc.id,
        accion: 'eliminar',
        usuario_id: req.user ? req.user.id : null,
        descripcion: `Documento eliminado: ${doc.nombre_archivo}`,
        datos_anteriores: doc
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
      await auditoria.registrar({
        entidad: 'documentos_subidos',
        entidad_id: actualizado.id,
        accion: 'validar',
        usuario_id: requester.id,
        descripcion: `Documento ${actualizado.id} cambiado a estado ${actualizado.estado}`,
        datos_anteriores: doc,
        datos_nuevos: actualizado
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
      AND EXTRACT(MONTH FROM fecha_validacion) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM fecha_validacion) = EXTRACT(YEAR FROM CURRENT_DATE)
    `);

    return res.json({ count: parseInt(rows[0].count) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al contar documentos revisados del mes' });
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

    // Verificar permisos: owner, admin, o auditor
    if (!isAdmin && !isOwner && !isAuditor) {
      return res.status(403).json({ message: 'No autorizado para descargar este documento' });
    }

    try {
      await auditoria.registrar({
        entidad: 'documentos_subidos',
        entidad_id: doc.id,
        accion: 'descargar',
        usuario_id: requester.id,
        descripcion: `Documento descargado: ${doc.nombre_archivo}`,
        datos_anteriores: doc
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
