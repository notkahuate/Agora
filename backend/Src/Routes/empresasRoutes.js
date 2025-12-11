// src/routes/empresasRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../Controllers/EmpresaController');

// CRUD básico
router.post('/', controller.crearEmpresa);        // Crear empresa
router.get('/', controller.listarEmpresas);      // Obtener todas
router.get('/:id', controller.obtenerEmpresa);   // Obtener por id
router.put('/:id', controller.actualizarEmpresa);// Actualizar (reemplazo parcial/total según body)
router.delete('/:id', controller.eliminarEmpresa);// Eliminar

module.exports = router;
