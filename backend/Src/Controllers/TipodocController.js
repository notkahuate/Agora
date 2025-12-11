// controllers/tiposDocumentos.controller.js
const TiposDocumentos = require("../Models/tiposDocumentosModel.js");

module.exports = {
  async getAll(req, res) {
    try {
      const data = await TiposDocumentos.getAll();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener los tipos de documentos" });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const data = await TiposDocumentos.getById(id);

      if (!data) return res.status(404).json({ error: "Tipo de documento no encontrado" });

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener el tipo de documento" });
    }
  },

  async create(req, res) {
    try {
      const nuevo = await TiposDocumentos.create(req.body);
      res.status(201).json(nuevo);
    } catch (error) {
      res.status(500).json({ error: "Error al crear el tipo de documento" });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const actualizado = await TiposDocumentos.update(id, req.body);

      if (!actualizado) return res.status(404).json({ error: "Tipo de documento no encontrado" });

      res.json(actualizado);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar el tipo de documento" });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;
      const eliminado = await TiposDocumentos.delete(id);

      if (!eliminado) return res.status(404).json({ error: "Tipo de documento no encontrado" });

      res.json({ mensaje: "Tipo de documento eliminado" });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar el tipo de documento" });
    }
  }
};
