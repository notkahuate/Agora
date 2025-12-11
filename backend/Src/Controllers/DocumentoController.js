// src/controllers/documentoController.js
const Documento = require('../Models/DocumentModel');

exports.crearDocumento = async (req, res) => {
  try {
    const body = req.body || {};
    const { usuario_id, tipo_documento_id, empresa_id, nombre_archivo, ruta_archivo, comentarios } = body;

    if (!usuario_id || !tipo_documento_id || !empresa_id || !nombre_archivo) {
      return res.status(400).json({ message: 'usuario_id, tipo_documento_id, empresa_id y nombre_archivo son obligatorios' });
    }

    const creado = await Documento.crearDocumento({ usuario_id, tipo_documento_id, empresa_id, nombre_archivo, ruta_archivo, comentarios });
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
    const docs = await Documento.listarDocumentos();
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

    // prohibir actualizar campos que no quieras: fecha_subida, fecha_validacion si no corresponde, etc.
    delete campos.fecha_subida;
    delete campos.fecha_validacion;

    const actualizado = await Documento.actualizarDocumento(id, campos);
    if (!actualizado) return res.status(404).json({ message: 'Documento no encontrado' });
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
    const { estado, validado_por, comentarios } = body;

    if (!estado || !['subido','validado','rechazado'].includes(estado)) {
      return res.status(400).json({ message: "estado inválido. Usa 'subido', 'validado' o 'rechazado'." });
    }
    if (!validado_por) {
      return res.status(400).json({ message: 'validado_por (id de usuario) es obligatorio para validar' });
    }

    const actualizado = await Documento.validarDocumento(id, { estado, validado_por, comentarios });
    if (!actualizado) return res.status(404).json({ message: 'Documento no encontrado' });
    return res.json(actualizado);
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(400).json({ message: 'validado_por no corresponde a un usuario válido', detail: err.detail });
    }
    return res.status(500).json({ message: 'Error al validar documento' });
  }
};
