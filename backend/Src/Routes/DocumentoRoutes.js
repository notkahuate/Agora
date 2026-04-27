// src/routes/documentosRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../Controllers/DocumentoController');
const { authenticate, authorize } = require('../milddlewares/authMiddleware');

router.post('/', authenticate, controller.crearDocumento);

// endpoint para listar documentos pendientes de validación (antes de :id para evitar conflicto)
router.get('/pendientes-validacion', authenticate, authorize('auditor', 'super_admin'), controller.listarPendientesValidacion);

// endpoint para contar documentos revisados en el mes
router.get('/revisados-mes', authenticate, authorize('auditor', 'super_admin'), controller.contarRevisadosMes);

router.get('/', authenticate, controller.listarDocumentos);
router.get('/:id', authenticate, controller.obtenerDocumento);
router.put('/:id', authenticate, controller.actualizarDocumento);
router.delete('/:id', authenticate, authorize('super_admin'), controller.eliminarDocumento);

// endpoint extra para validar/rechazar
router.post('/:id/validar', authenticate, authorize('auditor', 'super_admin'), controller.validarDocumento);

module.exports = router;
