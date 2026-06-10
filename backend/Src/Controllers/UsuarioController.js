// src/controllers/usuarioController.js
const bcrypt = require('bcryptjs'); // usar bcryptjs para consistencia
const { validationResult } = require('express-validator');
const Usuario = require('../Models/UsuarioModel'); // asegúrate del path y nombre
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10);
const auditoria = require('../Helpers/auditoriaHelper');


exports.crearUsuarioPublico = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const body = req.body || {};
    const { nombre, email, password, empresa_id: bodyEmpresaId } = body;

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
    const empresa_id = bodyEmpresaId || null;

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

    // Registrar auditoría del registro público
    try {
      await auditoria.registrar({
        entidad: 'usuarios',
        entidad_id: nuevo.id,
        accion: 'registro_publico',
        usuario_id: nuevo.id,
        descripcion: `Registro público de usuario: ${nuevo.email}`,
        datos_nuevos: nuevo
      });
    } catch (e) {
      console.error('auditoria crearUsuarioPublico error:', e.message);
    }

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

    const { nombre, email, password, activo, empresa_id: bodyEmpresaId, rol: bodyRol } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({
        message: 'nombre, email y password son obligatorios'
      });
    }

    const requester = req.user;
    if (!requester || !['super_admin', 'auditor'].includes(requester.rol)) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const existente = await Usuario.obtenerUsuarioPorEmail(email);
    if (existente) {
      return res.status(409).json({ message: 'El email ya está en uso' });
    }

    const validRoles = new Set(['usuario', 'super_admin']);
    const rol = validRoles.has(bodyRol) ? bodyRol : 'usuario';

    if (requester.rol === 'auditor' && !validRoles.has(bodyRol)) {
      return res.status(400).json({ message: 'Rol inválido. Debe ser usuario o super_admin.' });
    }

    let empresaId = null;
    if (requester.rol === 'auditor') {
      empresaId = bodyEmpresaId;
      if (!empresaId) {
        return res.status(400).json({ message: 'empresa_id es obligatorio para auditores' });
      }
    } else {
      empresaId = bodyEmpresaId || requester.empresa_id || null;
    }

    const activoFinal = typeof activo === 'boolean' ? activo : true;
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const nuevoUsuario = await Usuario.crearUsuario({
      nombre,
      email,
      password_hash,
      rol,
      empresa_id: empresaId,
      activo: activoFinal
    });

    // Registrar auditoría: creación de usuario por admin/auditor
    try {
      await auditoria.registrar({
        entidad: 'usuarios',
        entidad_id: nuevoUsuario.id,
        accion: 'crear',
        usuario_id: requester ? requester.id : null,
        descripcion: `Usuario creado: ${nuevoUsuario.email}`,
        datos_nuevos: nuevoUsuario
      });
    } catch (e) {
      console.error('auditoria crearUsuario error:', e.message);
    }

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

    if (!requester || !requester.id) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const usuarioActual = await Usuario.obtenerUsuarioPorId(requester.id);
    if (!usuarioActual) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (!usuarioActual.empresa_id) {
      return res.status(400).json({ message: 'Usuario sin empresa asignada' });
    }

    const usuarios = await Usuario.obtenerUsuariosPorEmpresa(
      usuarioActual.empresa_id,
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
