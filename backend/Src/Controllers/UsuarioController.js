// src/controllers/usuarioController.js
const bcrypt = require('bcryptjs'); // usar bcryptjs para consistencia
const { validationResult } = require('express-validator');
const Usuario = require('../Models/UsuarioModel'); // asegúrate del path y nombre
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10);


exports.crearUsuarioPublico = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const body = req.body || {};
    const { nombre, email, password } = body;

    if (!nombre || !email || !password) {
      return res.status(400).json({
        message: 'nombre, email y password son obligatorios'
      });
    }

    // Verificar si ya existe email
    const existente = await Usuario.obtenerUsuarioPorEmail(email);
    if (existente) {
      return res.status(409).json({ message: 'El email ya está en uso' });
    }

    // Valores forzados (seguridad)
    const rol = 'usuario';
    const activo = true;
    const empresa_id = null;

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const nuevo = await Usuario.crearUsuario({
      nombre,
      email,
      password_hash,
      rol,
      empresa_id,
      activo
    });

    // Nunca devolver el hash
    delete nuevo.password_hash;

    return res.status(201).json(nuevo);
  } catch (err) {
    console.error('crearUsuarioPublico error:', err);

    if (err.code === '23505') {
      return res.status(409).json({ message: 'Email ya en uso' });
    }

    return res.status(500).json({
      message: 'Error al crear usuario',
      error: err.message
    });
  }
};
exports.crearUsuario = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, email, password, activo } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({
        message: 'nombre, email y password son obligatorios'
      });
    }

    // Usuario autenticado (super admin)
    const requester = req.user;

    if (!requester || requester.rol !== 'super_admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    // Verificar email existente
    const existente = await Usuario.obtenerUsuarioPorEmail(email);
    if (existente) {
      return res.status(409).json({ message: 'El email ya está en uso' });
    }

    // 🔐 VALORES FORZADOS
    const rol = 'usuario';
    const empresa_id = requester.empresa_id;
    const activoFinal = typeof activo === 'boolean' ? activo : true;

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const nuevoUsuario = await Usuario.crearUsuario({
      nombre,
      email,
      password_hash,
      rol,
      empresa_id,
      activo: activoFinal
    });

    return res.status(201).json(nuevoUsuario);

  } catch (err) {
    console.error('crearUsuario error:', err);

    if (err.code === '23505') {
      return res.status(409).json({ message: 'Email ya en uso' });
    }

    return res.status(500).json({
      message: 'Error al crear usuario'
    });
  }
};

exports.listarUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.listarUsuarios();
    return res.json(usuarios);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al listar usuarios' });
  }
};

exports.obtenerUsuario = async (req, res) => {
  try {
    const id = req.params.id;
    const requester = req.user;
    const isAdmin = requester && requester.rol === 'super_admin';
    const isSelf = requester && String(requester.id) === String(id);
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: 'No autorizado para ver este usuario' });
    }

    const usuario = await Usuario.obtenerUsuarioPorId(id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    return res.json(usuario);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al obtener usuario' });
  }
};

exports.actualizarUsuario = async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const requester = req.user;
    const isAdmin = requester && requester.rol === 'super_admin';
    const isSelf = requester && String(requester.id) === String(id);
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: 'No autorizado para actualizar este usuario' });
    }

    // Si vienen password, hashearla antes de actualizar
    if (body.password) {
      body.password_hash = await bcrypt.hash(body.password, SALT_ROUNDS);
      delete body.password;
    }

    // No permitir actualizar campos sensibles manualmente (ej: fecha_creacion)
    delete body.fecha_creacion;
    delete body.fecha_actualizacion;

    if (!isAdmin) {
      // Un usuario normal no puede cambiar rol/estado/empresa.
      delete body.rol;
      delete body.activo;
      delete body.empresa_id;
    }

    const actualizado = await Usuario.actualizarUsuario(id, body);
    if (!actualizado) return res.status(404).json({ message: 'Usuario no encontrado' });
    return res.json(actualizado);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ message: 'Email ya en uso' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ message: 'empresa_id inválida' });
    }
    return res.status(500).json({ message: 'Error al actualizar usuario' });
  }
};

exports.eliminarUsuario = async (req, res) => {
  try {
    const id = req.params.id;
    const eliminado = await Usuario.eliminarUsuario(id);
    if (!eliminado) return res.status(404).json({ message: 'Usuario no encontrado' });
    return res.json({ message: 'Usuario eliminado', usuario: eliminado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al eliminar usuario' });
  }
};

// 📊 Usuarios de mi empresa (menos yo)
exports.usuariosEmpresa = async (req, res) => {
  try {
    const requester = req.user;

    if (!requester || !requester.empresa_id) {
      return res.status(400).json({ message: 'Usuario sin empresa asignada' });
    }

    const usuarios = await Usuario.obtenerUsuariosPorEmpresa(
      requester.empresa_id,
      requester.id
    );

    return res.json({
      cantidad: usuarios.length,
      usuarios
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al obtener usuarios de la empresa' });
  }
};
