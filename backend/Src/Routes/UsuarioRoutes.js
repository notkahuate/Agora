// src/routes/usuariosRoutes.js
const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const controller = require('../Controllers/UsuarioController');
const { authenticate, authorize } = require('../milddlewares/authMiddleware');

// 1) Registro público (si quieres permitir registro público):
router.post(
  '/register',
  [
    body('nombre').isString().isLength({ min: 2 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('rol').optional().isIn(['usuario', 'super_admin', 'manager']),
    body('empresa_id').optional().isInt()
  ],
  controller.crearUsuarioPublico
);

// 2) Creación por admin (protegido)
router.post(
  '/',
  authenticate,
  authorize('super_admin'), // solo admin puede crear usuarios al usar esta ruta
  [
    body('nombre').isString().isLength({ min: 2 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('rol').optional().isIn(['usuario', 'super_admin', 'manager']),
    body('empresa_id').optional().isInt()
  ],
  controller.crearUsuario
);




// proteger las demás rutas (listar, obtener, actualizar, eliminar)
router.get('/', authenticate, authorize('super_admin'), controller.listarUsuarios); // solo admin lista
router.get('/:id', authenticate, param('id').isInt(), controller.obtenerUsuario);

// actualizar: permitir admin o el propio usuario
router.put('/:id', authenticate, param('id').isInt(), controller.actualizarUsuario);

// eliminar: solo admin
router.delete('/:id', authenticate, authorize('super_admin'), param('id').isInt(), controller.eliminarUsuario);

module.exports = router;
