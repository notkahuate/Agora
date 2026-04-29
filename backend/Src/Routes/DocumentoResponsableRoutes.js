// src/routes/documentoResponsableRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../Controllers/DocumentoResponsableController');
const { authenticate } = require('../milddlewares/authMiddleware');

// 📌 Asignar responsable
router.post('/', authenticate, controller.asignar);

// 📌 Obtener responsable de un documento
router.get('/:documentoId', authenticate, controller.obtener);

// 📌 Listar todos (superadmin)
router.get('/', authenticate, controller.listarTodos);

module.exports = router;