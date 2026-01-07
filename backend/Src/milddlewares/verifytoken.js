const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔥 AQUÍ ESTÁ LA CLAVE
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      rol: decoded.rol,
      empresa_id: decoded.empresa_id
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};
