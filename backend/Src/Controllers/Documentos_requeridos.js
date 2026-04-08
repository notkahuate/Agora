// src/controllers/DocumentoRequeridoController.js
const model = require('../Models/Documentos_requeridoModel');

// ✅ Crear
const crear = async (req, res) => {
  try {
    const data = await model.crearDocumentoRequerido(req.body);
    res.status(201).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear documento requerido' });
  }
};

// ✅ Listar por empresa
const listarPorEmpresa = async (req, res) => {
  try {
    const { empresaId } = req.params;
    const data = await model.obtenerPorEmpresa(empresaId);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar documentos' });
  }
};

// ✅ Pendientes
const listarPendientes = async (req, res) => {
  try {
    const { empresaId } = req.params;
    const data = await model.obtenerPendientes(empresaId);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar pendientes' });
  }
};

// ✅ Cola de revisión
const listarColaRevision = async (req, res) => {
  try {
    const data = await model.obtenerColaRevision();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar cola de revisión' });
  }
};


module.exports = {
  crear,
  listarPorEmpresa,
  listarPendientes,
  listarColaRevision
};