// src/controllers/empresaController.js
const Empresa = require('../Models/empresaModel');

const crearEmpresa = async (req, res) => {
  try {
    const { nombre, rut, sector, ubicacion, email, telefono, activa } = req.body;

    if (!nombre || !rut) {
      return res.status(400).json({ message: 'nombre y rut son obligatorios' });
    }

    const nueva = await Empresa.createEmpresa({ nombre, rut, sector, ubicacion, email, telefono, activa });
    return res.status(201).json(nueva);
  } catch (err) {
    // Manejo de errores comunes: unique constraint
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ message: 'Ya existe una empresa con el mismo nombre o rut', detail: err.detail });
    }
    console.error(err);
    return res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

const listarEmpresas = async (req, res) => {
  try {
    const empresas = await Empresa.getAllEmpresas();
    return res.json(empresas);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al listar empresas' });
  }
};

const obtenerEmpresa = async (req, res) => {
  try {
    const { id } = req.params;
    const empresa = await Empresa.getEmpresaById(id);
    if (!empresa) return res.status(404).json({ message: 'Empresa no encontrada' });
    return res.json(empresa);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al obtener la empresa' });
  }
};

const actualizarEmpresa = async (req, res) => {
  try {
    const { id } = req.params;
    const campos = req.body;
    const empresaActualizada = await Empresa.updateEmpresa(id, campos);
    if (!empresaActualizada) return res.status(404).json({ message: 'Empresa no encontrada' });
    return res.json(empresaActualizada);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Conflicto: nombre o rut ya existen', detail: err.detail });
    }
    console.error(err);
    return res.status(500).json({ message: 'Error al actualizar la empresa' });
  }
};

const eliminarEmpresa = async (req, res) => {
  try {
    const { id } = req.params;
    const eliminado = await Empresa.deleteEmpresa(id);
    if (!eliminado) return res.status(404).json({ message: 'Empresa no encontrada' });
    return res.json({ message: 'Empresa eliminada', empresa: eliminado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al eliminar la empresa' });
  }
};

module.exports = {
  crearEmpresa,
  listarEmpresas,
  obtenerEmpresa,
  actualizarEmpresa,
  eliminarEmpresa,
};
