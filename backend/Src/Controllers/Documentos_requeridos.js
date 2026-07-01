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
        datos_nuevos: data,
        empresa_id: info.empresa_id || data.empresa_id || null
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

    // auditor y super_admin pueden consultar por empresa en la URL
    if (['auditor', 'super_admin'].includes(rol)) {
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

    // auditor y super_admin pueden consultar por empresa en la URL
    if (['auditor', 'super_admin'].includes(rol)) {
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

// ✅ Pendientes globales para auditor (cola prioritaria y empresas en riesgo)
const listarPendientesAuditor = async (req, res) => {
  try {
    const { rol } = req.user;

    if (!['auditor', 'super_admin'].includes(rol)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const data = await model.obtenerTodosPendientesAuditor();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar pendientes del auditor' });
  }
};

// ✅ Generar alerta por documento pendiente sin subir
const generarAlerta = async (req, res) => {
  try {
    const { rol, id: usuario_id } = req.user;
    const { id } = req.params;

    if (!['auditor', 'super_admin'].includes(rol)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { rows } = await pool.query(
      `SELECT dr.id, dr.empresa_id, dr.fecha_limite, dr.prioridad,
              td.nombre AS documento_nombre, td.porcentaje,
              e.nombre AS empresa_nombre,
              COALESCE(u.nombre, 'Sin asignar') AS responsable_nombre,
              dr_resp.usuario_id AS responsable_id,
              ultimo.id AS documento_subido_id
       FROM documentos_requeridos dr
       JOIN tipos_documentos td ON td.id = dr.tipo_documento_id
       JOIN empresas e ON e.id = dr.empresa_id
       LEFT JOIN documento_responsables dr_resp ON dr.id = dr_resp.documento_requerido_id
       LEFT JOIN usuarios u ON dr_resp.usuario_id = u.id
       LEFT JOIN LATERAL (
         SELECT ds_u.id FROM documentos_subidos ds_u
         WHERE ds_u.empresa_id = dr.empresa_id
           AND ds_u.tipo_documento_id = dr.tipo_documento_id
         ORDER BY ds_u.fecha_subida IS NULL, ds_u.fecha_subida DESC, ds_u.id DESC
         LIMIT 1
       ) ultimo ON true
       WHERE dr.id = $1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const doc = rows[0];

    if (doc.documento_subido_id) {
      return res.status(400).json({ error: 'Solo se puede alertar documentos pendientes sin subir' });
    }

    await auditoria.registrar({
      entidad: 'documentos_requeridos',
      entidad_id: doc.id,
      accion: 'alerta',
      usuario_id,
      empresa_id: doc.empresa_id,
      descripcion: `Alerta: "${doc.documento_nombre}" pendiente de subir en ${doc.empresa_nombre} (responsable: ${doc.responsable_nombre})`,
      datos_nuevos: {
        documento: doc.documento_nombre,
        empresa: doc.empresa_nombre,
        responsable: doc.responsable_nombre,
        responsable_id: doc.responsable_id,
        fecha_limite: doc.fecha_limite,
        porcentaje: doc.porcentaje,
        prioridad: doc.prioridad
      }
    });

    res.json({
      ok: true,
      message: `Alerta registrada para "${doc.documento_nombre}"`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar alerta' });
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
  listarPendientesAuditor,
  generarAlerta,
  listarColaRevision,
  obtenerResumen
};