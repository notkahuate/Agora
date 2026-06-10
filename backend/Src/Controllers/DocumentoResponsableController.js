// src/controllers/DocumentoResponsableController.js
const model = require('../Models/DocumentoResponsableModel');
const auditoria = require('../Helpers/auditoriaHelper');

// ✅ Asignar responsable
const asignar = async (req, res) => {
  try {
    const { documento_requerido_id, usuario_id } = req.body;

    const data = await model.asignarResponsable(documento_requerido_id, usuario_id);
      // Registrar auditoría: asignación de responsable
      try {
        await auditoria.registrar({
          entidad: 'documento_responsables',
          entidad_id: data.id,
          accion: 'asignar',
          usuario_id: req.user ? req.user.id : null,
          descripcion: `Asignado usuario ${usuario_id} al documento requerido ${documento_requerido_id}`,
          datos_nuevos: data
        });
      } catch (e) {
        console.error('auditoria asignarResponsable error:', e.message);
      }

      res.status(201).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al asignar responsable' });
  }
};

// ✅ Obtener responsable
const obtener = async (req, res) => {
  try {
    const { documentoId } = req.params;

    const data = await model.obtenerResponsable(documentoId);
    if (data) {
      res.json(data);
    } else {
      res.status(404).json({ error: 'No encontrado' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener responsable' });
  }
};

// ✅ Listar todos (superadmin)
const listarTodos = async (req, res) => {
  try {
    const { rol } = req.user;

    if (rol !== 'super_admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const data = await model.listarTodosResponsables();
    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar responsables' });
  }
};

module.exports = {
  asignar,
  obtener,
  listarTodos
};