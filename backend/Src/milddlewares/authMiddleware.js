// src/middlewares/authMiddleware.js
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { pool } = require('../configures/db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) console.warn('⚠️ JWT_SECRET no definido');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No se proporcionó token' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }

    // Opcional: cargar usuario completo desde BD (para validar rol/activo)
    const { rows } = await pool.query(
      'SELECT id, nombre, email, rol, empresa_id, activo FROM usuarios WHERE id = $1',
      [payload.sub]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Usuario no existe' });
    if (!user.activo) return res.status(403).json({ message: 'Cuenta desactivada' });

    req.user = user; // inyectamos el usuario en la request
    next();
  } catch (err) {
    console.error('authenticate error:', err);
    return res.status(500).json({ message: 'Error interno en autenticación' });
  }
}

function authorize(...allowedRoles) {
  // allowedRoles por ejemplo: ('admin'), o ('admin','manager')
  return (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ message: 'No autenticado' });
      if (allowedRoles.length === 0) return next(); // si no se pasaron roles, permitir
      if (!allowedRoles.includes(user.rol)) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      next();
    } catch (err) {
      console.error('authorize error:', err);
      return res.status(500).json({ message: 'Error interno autorización' });
    }
  };
}

module.exports = { authenticate, authorize };
