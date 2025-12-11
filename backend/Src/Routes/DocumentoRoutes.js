// src/routes/documentosRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../Controllers/DocumentoController');

router.post('/', controller.crearDocumento);
router.get('/', controller.listarDocumentos);
router.get('/:id', controller.obtenerDocumento);
router.put('/:id', controller.actualizarDocumento);
router.delete('/:id', controller.eliminarDocumento);

// endpoint extra para validar/rechazar
router.post('/:id/validar', controller.validarDocumento);

module.exports = router;
