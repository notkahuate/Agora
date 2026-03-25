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

module.exports = router;