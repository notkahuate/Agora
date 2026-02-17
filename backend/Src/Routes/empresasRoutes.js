// src/routes/empresasRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../Controllers/EmpresaController');
const { authenticate, authorize } = require('../milddlewares/authMiddleware');

// CRUD básico
router.post('/', authenticate, authorize('auditor'), controller.crearEmpresa); // Crear empresa
router.get('/', authenticate, authorize('auditor'), controller.listarEmpresas); // Obtener todas
router.get('/:id', authenticate, authorize('super_admin', 'auditor'), controller.obtenerEmpresa); // Obtener por id
router.put('/:id', authenticate, authorize('super_admin'), controller.actualizarEmpresa); // Actualizar
router.delete('/:id', authenticate, authorize('super_admin'), controller.eliminarEmpresa); // Eliminar

module.exports = router;
