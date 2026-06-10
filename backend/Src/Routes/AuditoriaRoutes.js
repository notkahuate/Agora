// src/routes/AuditoriaRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../Controllers/AuditoriaController');
const { authenticate, authorize } = require('../milddlewares/authMiddleware');

// Obtener todos los eventos (con paginación)
router.get('/', authenticate, authorize('auditor', 'super_admin'), controller.obtenerEventos);

// Obtener eventos recientes (timeline)
router.get('/recientes', authenticate, authorize('auditor', 'super_admin'), controller.obtenerEventosRecientes);

// Obtener eventos por entidad
router.get('/:entidad', authenticate, authorize('auditor', 'super_admin'), controller.obtenerEventosPorEntidad);

// Obtener eventos por entidad e ID específico
router.get('/:entidad/:entidad_id', authenticate, authorize('auditor', 'super_admin'), controller.obtenerEventosPorEntidadId);

module.exports = router;
