// src/controllers/documentoController.js
const Documento = require('../Models/DocumentModel');

exports.crearDocumento = async (req, res) => {
  try {
    const body = req.body || {};
    const { usuario_id, tipo_documento_id, empresa_id, nombre_archivo, ruta_archivo, comentarios } = body;
    const requester = req.user;
    const isAdmin = requester && requester.rol === 'super_admin';
    const isUsuario = requester && requester.rol === 'usuario';

    if (!isAdmin && !isUsuario) {
      return res.status(403).json({ message: 'No autorizado para subir documentos' });
    }

    const resolvedUsuarioId = isUsuario ? requester.id : usuario_id;
    const resolvedEmpresaId = isUsuario ? requester.empresa_id : empresa_id;

    if (!resolvedUsuarioId || !tipo_documento_id || !resolvedEmpresaId || !nombre_archivo) {
      return res.status(400).json({ message: 'usuario_id, tipo_documento_id, empresa_id y nombre_archivo son obligatorios' });
    }

    const creado = await Documento.crearDocumento({
      usuario_id: resolvedUsuarioId,
      tipo_documento_id,
      empresa_id: resolvedEmpresaId,
      nombre_archivo,
      ruta_archivo,
      comentarios
    });
    return res.status(201).json(creado);
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
      if (!requester.empresa_id) {
        return res.status(400).json({ message: 'El auditor no tiene empresa asignada' });
      }
      docs = await Documento.listarDocumentosPorEmpresa(requester.empresa_id);
    } else {
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
    const eliminado = await Documento.eliminarDocumento(id);
    if (!eliminado) return res.status(404).json({ message: 'Documento no encontrado' });
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

    if (!estado || !['subido','validado','rechazado'].includes(estado)) {
      return res.status(400).json({ message: "estado inválido. Usa 'subido', 'validado' o 'rechazado'." });
    }
    const doc = await Documento.obtenerDocumentoPorId(id);
    if (!doc) return res.status(404).json({ message: 'Documento no encontrado' });
    if (requester.rol === 'auditor') {
      if (!requester.empresa_id || String(doc.empresa_id) !== String(requester.empresa_id)) {
        return res.status(403).json({ message: 'No autorizado para validar este documento' });
      }
    }

    const actualizado = await Documento.validarDocumento(id, { estado, validado_por: requester.id, comentarios });
    return res.json(actualizado);
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(400).json({ message: 'validado_por no corresponde a un usuario válido', detail: err.detail });
    }
    return res.status(500).json({ message: 'Error al validar documento' });
  }
};
