// src/controllers/usuarioController.js
const bcrypt = require('bcryptjs'); // usar bcryptjs para consistencia
const { validationResult } = require('express-validator');
const Usuario = require('../Models/UsuarioModel'); // asegúrate del path y nombre
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10);

exports.crearUsuario = async (req, res) => {
  try {
    // si usas express-validator en la ruta, revisa errores:
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const body = req.body || {};
    let { nombre, email, password, rol, empresa_id, activo } = body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ message: 'nombre, email y password son obligatorios' });
    }

    // Verificar si ya existe email
    const existente = await Usuario.obtenerUsuarioPorEmail(email);
    if (existente) return res.status(409).json({ message: 'El email ya está en uso' });

    // Seguridad: si la llamada viene de un usuario autenticado (req.user) y es admin,
    // permite asignar rol/empresa/activo según lo mande el admin.
    // Si no hay req.user (registro público) o no es admin, forzar rol por defecto.
    const requester = req.user; // viene del middleware authenticate si se usa
    const isAdmin = requester && requester.rol === 'admin';

    if (!isAdmin) {
      // restricción: no permitir que un cliente normal establezca rol/activo/empresa_id
      rol = 'usuario';
      activo = true;
      // empresa_id: podrías permitir asignar si quieres, pero normalmente null
      empresa_id = null;
    } else {
      // Si admin no pasa rol, por defecto 'usuario'
      rol = rol || 'usuario';
      // activo si no viene, por defecto true
      activo = typeof activo === 'boolean' ? activo : true;
      empresa_id = empresa_id || null;
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const nuevo = await Usuario.crearUsuario({ nombre, email, password_hash, rol, empresa_id, activo });
    // no devolver password_hash
    return res.status(201).json(nuevo);
  } catch (err) {
    console.error('crearUsuario error:', err);
    if (err.code === '23503') { // foreign_key_violation (empresa_id)
      return res.status(400).json({ message: 'empresa_id inválida' });
    }
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ message: 'Email ya en uso' });
    }
    return res.status(500).json({ message: 'Error al crear usuario', error: err.message });
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

    // Si vienen password, hashearla antes de actualizar
    if (body.password) {
      body.password_hash = await bcrypt.hash(body.password, SALT_ROUNDS);
      delete body.password;
    }

    // No permitir actualizar campos sensibles manualmente (ej: fecha_creacion)
    delete body.fecha_creacion;

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
