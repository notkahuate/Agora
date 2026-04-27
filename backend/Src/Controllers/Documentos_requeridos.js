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

const obtenerResumen = async (req, res) => {
  try {
    const { empresaId } = req.params;
    const data = await model.obtenerResumenEmpresa(empresaId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error resumen' });
  }
};

// ✅ Listar por empresa
const listarPorEmpresa = async (req, res) => {
  try {
    const { rol, empresa_id } = req.user;

    let empresaFinal = empresa_id;

    // auditor puede consultar cualquiera
    if (rol === 'auditor') {
      empresaFinal = req.params.empresaId;
    }

    const data = await model.obtenerPorEmpresa(empresaFinal);
    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar documentos' });
  }
};

// ✅ Pendientes
const listarPendientes = async (req, res) => {
  try {
    const { rol, empresa_id } = req.user;

    let empresaFinal = empresa_id;

    if (rol === 'auditor') {
      empresaFinal = req.params.empresaId;
    }

    const data = await model.obtenerPendientes(empresaFinal);
    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar pendientes' });
  }
};

// ✅ Cola de revisión
const listarColaRevision = async (req, res) => {
  try {
    const { rol, empresa_id } = req.user;

    let data;

    if (rol === 'auditor') {
      data = await model.obtenerColaRevision();
    } else {
      data = await model.obtenerColaRevision(empresa_id);
    }

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
  listarColaRevision,
  obtenerResumen
};