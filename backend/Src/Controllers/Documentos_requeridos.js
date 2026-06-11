// src/controllers/DocumentoRequeridoController.js
const model = require('../Models/Documentos_requeridoModel');
const auditoria = require('../Helpers/auditoriaHelper');
const { pool } = require('../configures/db');

// ✅ Crear
const crear = async (req, res) => {
  try {
    const data = await model.crearDocumentoRequerido(req.body);
    try {
      const infoResult = await pool.query(
        `SELECT e.nombre AS empresa_nombre, td.nombre AS tipo_nombre
         FROM documentos_requeridos dr
         JOIN empresas e ON dr.empresa_id = e.id
         JOIN tipos_documentos td ON dr.tipo_documento_id = td.id
         WHERE dr.id = $1`,
        [data.id]
      );
      const info = infoResult.rows[0] || {};
      await auditoria.registrar({
        entidad: 'documentos_requeridos',
        entidad_id: data.id,
        accion: 'asignar',
        usuario_id: req.user ? req.user.id : null,
        descripcion: `Asignado documento requerido '${info.tipo_nombre || data.tipo_documento_id}' a empresa '${info.empresa_nombre || data.empresa_id}'`,
        datos_nuevos: data
      });
    } catch (e) {
      console.error('auditoria crearDocumentoRequerido error:', e.message);
    }
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

    // auditor puede consultar cualquiera
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

// ✅ Pendientes por usuario
const listarPendientesUsuario = async (req, res) => {
  try {
    const { id: usuario_id } = req.user;

    const data = await model.obtenerPendientesPorUsuario(usuario_id);
    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar pendientes del usuario' });
  }
};
// ✅ Asignados por usuario (todos con estado)
const listarAsignadosUsuario = async (req, res) => {
  try {
    const { id: usuario_id } = req.user;

    const data = await model.obtenerAsignadosPorUsuario(usuario_id);
    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar asignados del usuario' });
  }
};
// ✅ Asignados por usuario (todos con estado)

// ✅ Listar todos (para superadmin)
const listarTodos = async (req, res) => {
  try {
    const { rol } = req.user;

    if (rol !== 'super_admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const data = await model.obtenerTodos();
    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar todos los documentos' });
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
  listarTodos,
  listarPendientes,
  listarPendientesUsuario,
  listarAsignadosUsuario,
  listarColaRevision,
  obtenerResumen
};