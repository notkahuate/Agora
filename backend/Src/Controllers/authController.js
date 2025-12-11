// src/controllers/authController.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../configures/db'); // ajusta si exportas de otra forma

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

if (!JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET no definido en .env - define JWT_SECRET para firmar tokens');
}

exports.login = async (req, res) => {
  try {
    // validaciones de express-validator ya habrán corrido antes de llegar aquí
    const { email, password } = req.body || {};

    // comprobación básica
    if (!email || !password) {
      return res.status(400).json({ message: 'email y password son requeridos' });
    }

    // buscar usuario por email (incluye password_hash)
    const { rows } = await pool.query('SELECT id, nombre, email, password_hash, rol, empresa_id, activo FROM usuarios WHERE email = $1', [email]);
    const user = rows[0];

    if (!user) {
      // no revelar si existe o no el email (pero podemos devolver 401)
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    if (!user.activo) {
      return res.status(403).json({ message: 'Cuenta desactivada' });
    }

    // comparar password (bcryptjs)
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // generar token
    const payload = {
      sub: user.id,
      email: user.email,
      rol: user.rol,
      empresa_id: user.empresa_id
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // respuesta (no incluir password_hash)
    return res.json({
      message: 'Autenticación exitosa',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        empresa_id: user.empresa_id
      }
    });
  } catch (err) {
    console.error('Error login:', err);
    return res.status(500).json({ message: 'Error interno' });
  }
};
