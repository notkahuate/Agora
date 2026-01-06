// src/routes/usuariosRoutes.js
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const controller = require('../Controllers/UsuarioController');
const { authenticate, authorize } = require('../milddlewares/authMiddleware');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
};

// Creación por super_admin (protegido)
router.post(
  '/',
  authenticate,
  authorize('super_admin'), // solo super_admin puede crear usuarios
  [
    body('nombre').isString().isLength({ min: 2 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('rol').optional().isIn(['usuario', 'super_admin', 'auditor']),
    body('empresa_id').optional().isInt()
  ],
  handleValidation,
  controller.crearUsuario
);




// proteger las demás rutas (listar, obtener, actualizar, eliminar)
router.get('/', authenticate, authorize('super_admin'), controller.listarUsuarios); // solo super_admin lista
router.get('/:id', authenticate, param('id').isInt(), handleValidation, controller.obtenerUsuario);

// actualizar: permitir admin o el propio usuario
router.put('/:id', authenticate, param('id').isInt(), handleValidation, controller.actualizarUsuario);

// eliminar: solo admin
router.delete('/:id', authenticate, authorize('super_admin'), param('id').isInt(), handleValidation, controller.eliminarUsuario);

module.exports = router;
