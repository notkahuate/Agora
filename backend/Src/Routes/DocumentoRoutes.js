// src/routes/documentosRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../Controllers/DocumentoController');
const { authenticate, authorize } = require('../milddlewares/authMiddleware');
const upload = require('../milddlewares/uploadMiddleware');

// POST — uno o varios archivos para el mismo documento requerido
router.post('/lote', authenticate, upload.uploadMultiple, controller.crearDocumentosLote);
router.post('/', authenticate, upload.single('archivo'), controller.crearDocumento);

// endpoint para listar documentos pendientes de validación (antes de :id para evitar conflicto)
router.get('/pendientes-validacion', authenticate, authorize('auditor', 'super_admin'), controller.listarPendientesValidacion);

router.get('/cola-prioritaria', authenticate, authorize('auditor', 'super_admin'), controller.listarColaPrioritaria);

router.get('/revisados-mes', authenticate, authorize('auditor', 'super_admin'), controller.contarRevisadosMes);

router.get('/historial/tipo', authenticate, controller.listarHistorialPorTipo);

router.get('/', authenticate, controller.listarDocumentos);
router.get('/:id/descargar', authenticate, controller.descargarDocumento);
router.get('/:id', authenticate, controller.obtenerDocumento);

router.put('/:id', authenticate, controller.actualizarDocumento);
router.delete('/:id', authenticate, controller.eliminarDocumento);

// endpoint extra para validar/rechazar
router.post('/:id/validar', authenticate, authorize('auditor', 'super_admin'), controller.validarDocumento);

module.exports = router;
