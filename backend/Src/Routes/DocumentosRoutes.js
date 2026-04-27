// src/routes/documentosRequeridosRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../Controllers/Documentos_requeridos');
const { authenticate } = require('../milddlewares/authMiddleware');

// 📌 Crear
router.post('/', authenticate, controller.crear);

// 📌 Listar por empresa
router.get('/empresa/:empresaId', authenticate, controller.listarPorEmpresa);

// 📌 Pendientes
router.get('/empresa/:empresaId/pendientes', authenticate, controller.listarPendientes);
// 📌 Cola de revisión (solo para auditores y super admins)
router.get('/cola-revision', authenticate, controller.listarColaRevision);

router.get('/empresa/:empresaId/resumen', controller.obtenerResumen);

module.exports = router;