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
// 📌 Pendientes por usuario
router.get('/usuario/pendientes', authenticate, controller.listarPendientesUsuario);
// 📌 Asignados por usuario
router.get('/usuario/asignados', authenticate, controller.listarAsignadosUsuario);
// 📌 Listar todos (superadmin)
router.get('/todos', authenticate, controller.listarTodos);

router.get('/empresa/:empresaId/resumen', controller.obtenerResumen);

module.exports = router;