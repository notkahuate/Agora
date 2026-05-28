// src/routes/documentosRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../Controllers/DocumentoController');
const { authenticate, authorize } = require('../milddlewares/authMiddleware');
const upload = require('../milddlewares/uploadMiddleware');

// POST con multer para subida de archivo
router.post('/', authenticate, upload.single('archivo'), controller.crearDocumento);

// endpoint para listar documentos pendientes de validación (antes de :id para evitar conflicto)
router.get('/pendientes-validacion', authenticate, authorize('auditor', 'super_admin'), controller.listarPendientesValidacion);

// endpoint para contar documentos revisados en el mes
router.get('/revisados-mes', authenticate, authorize('auditor', 'super_admin'), controller.contarRevisadosMes);

router.get('/', authenticate, controller.listarDocumentos);
router.get('/:id', authenticate, controller.obtenerDocumento);

// endpoint para descargar archivo (antes de put/delete para evitar conflicto)
router.get('/:id/descargar', authenticate, controller.descargarDocumento);

router.put('/:id', authenticate, controller.actualizarDocumento);
router.delete('/:id', authenticate, authorize('super_admin'), controller.eliminarDocumento);

// endpoint extra para validar/rechazar
router.post('/:id/validar', authenticate, authorize('auditor', 'super_admin'), controller.validarDocumento);

module.exports = router;
