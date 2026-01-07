const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();

const controller = require('../Controllers/UsuarioController');
const verifyToken = require('../milddlewares/verifytoken');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// =======================
// 🔓 Registro público
// =======================
router.post(
  '/registro',
  [
    body('nombre').isString().isLength({ min: 2 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
  ],
  handleValidation,
  controller.crearUsuarioPublico
);

// =======================
// 🔐 Crear usuario (solo super_admin)
// =======================
router.post(
  '/',
  verifyToken,
  [
    body('nombre').isString().isLength({ min: 2 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
  ],
  handleValidation,
  controller.crearUsuario
);

// =======================
// 📋 Listar usuarios (solo super_admin)
// =======================
router.get(
  '/',
  verifyToken,
  controller.listarUsuarios
);

// =======================
// 👤 Obtener usuario (admin o dueño)
// =======================
router.get(
  '/:id',
  verifyToken,
  param('id').isInt(),
  handleValidation,
  controller.obtenerUsuario
);

// =======================
// ✏️ Actualizar usuario (admin o dueño)
// =======================
router.put(
  '/:id',
  verifyToken,
  param('id').isInt(),
  handleValidation,
  controller.actualizarUsuario
);

// =======================
// 🗑 Eliminar usuario (solo super_admin)
// =======================
router.delete(
  '/:id',
  verifyToken,
  param('id').isInt(),
  handleValidation,
  controller.eliminarUsuario
);

// 👥 Usuarios de la misma empresa (menos el actual)
router.get(
  '/empresa/mios',
  verifyToken,
  controller.usuariosEmpresa
);


module.exports = router;
