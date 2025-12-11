// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const authController = require('../Controllers/authController');

// Rate limiter para login (protección básica brute-force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 6, // 6 intentos por IP en 15 min
  message: { message: 'Demasiados intentos, intenta de nuevo más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validación de entrada para login
const loginValidation = [
  body('email').isEmail().withMessage('email inválido').normalizeEmail(),
  body('password').isString().isLength({ min: 6 }).withMessage('password mínimo 6 caracteres')
];

router.post('/login', loginLimiter, loginValidation, (req, res, next) => {
  // manejar errores de validación
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return authController.login(req, res, next);
});

module.exports = router;
