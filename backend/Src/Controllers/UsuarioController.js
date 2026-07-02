// src/controllers/usuarioController.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs'); // usar bcryptjs para consistencia
const { validationResult } = require('express-validator');
const Usuario = require('../Models/UsuarioModel'); // asegúrate del path y nombre
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10);
const auditoria = require('../Helpers/auditoriaHelper');
const { enviarInvitacionUsuario } = require('../Helpers/emailHelper');

function esDuplicadoEmail(err) {
  return err && (err.code === '23505' || err.code === 'ER_DUP_ENTRY' || err.errno === 1062);
}

async function crearUsuarioConInvitacion({ nombre, email, rol, empresa_id, requester }) {
  const token = Usuario.generarTokenActivacion();
  const tokenExpira = Usuario.calcularExpiracionToken();
  const passwordTemporal = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), SALT_ROUNDS);

  const nuevoUsuario = await Usuario.crearUsuario({
    nombre,
    email,
    password_hash: passwordTemporal,
    rol,
    empresa_id,
    activo: false,
    token_activacion: token,
    token_expira: tokenExpira,
  });

  try {
    await enviarInvitacionUsuario({ email, nombre, token });
  } catch (error) {
    await Usuario.eliminarUsuario(nuevoUsuario.id);
    throw new Error('No se pudo enviar el correo de invitación. Verifica SMTP_HOST, SMTP_USER y SMTP_PASS.');
  }

  try {
    await auditoria.registrar({
      entidad: 'usuarios',
      entidad_id: nuevoUsuario.id,
      accion: 'invitar',
      usuario_id: requester ? requester.id : null,
      descripcion: `Invitación enviada a ${nuevoUsuario.email}`,
      datos_nuevos: { ...nuevoUsuario, invitacion_enviada: true },
      empresa_id: nuevoUsuario.empresa_id || null,
    });
  } catch (e) {
    console.error('auditoria invitarUsuario error:', e.message);
  }

  return {
    ...nuevoUsuario,
    message: 'Invitación enviada por correo. El usuario debe activar su cuenta.',
  };
}


exports.activarCuenta = async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (!token || !password) {
      return res.status(400).json({ message: 'token y password son requeridos' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const pendiente = await Usuario.obtenerUsuarioPorToken(token);
    if (!pendiente) {
      return res.status(404).json({ message: 'Token inválido o expirado' });
    }

    if (pendiente.activo) {
      return res.status(400).json({ message: 'Esta cuenta ya está activa' });
    }

    if (new Date(pendiente.token_expira).getTime() < Date.now()) {
      return res.status(410).json({ message: 'El enlace de activación expiró. Solicita una nueva invitación.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const activado = await Usuario.activarUsuarioConToken(token, password_hash);

    if (!activado) {
      return res.status(404).json({ message: 'Token inválido o expirado' });
    }

    return res.json({
      message: 'Cuenta activada correctamente. Ya puedes iniciar sesión.',
      user: activado,
    });
  } catch (err) {
    console.error('activarCuenta error:', err);
    return res.status(500).json({ message: 'Error al activar la cuenta' });
  }
};

exports.verificarTokenActivacion = async (req, res) => {
  try {
    const token = req.params.token;
    const pendiente = await Usuario.obtenerUsuarioPorToken(token);

    if (!pendiente || pendiente.activo) {
      return res.status(404).json({ valido: false, message: 'Token inválido' });
    }

    if (new Date(pendiente.token_expira).getTime() < Date.now()) {
      return res.status(410).json({ valido: false, message: 'Token expirado' });
    }

    return res.json({
      valido: true,
      nombre: pendiente.nombre,
      email: pendiente.email,
    });
  } catch (err) {
    console.error('verificarTokenActivacion error:', err);
    return res.status(500).json({ valido: false, message: 'Error al verificar token' });
  }
};

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

    const existente = await Usuario.obtenerUsuarioPorEmail(email);
    if (existente) {
      return res.status(409).json({ message: 'El email ya está en uso' });
    }

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

    delete nuevo.password_hash;

    try {
      await auditoria.registrar({
        entidad: 'usuarios',
        entidad_id: nuevo.id,
        accion: 'registro_publico',
        usuario_id: nuevo.id,
        descripcion: `Registro público de usuario: ${nuevo.email}`,
        datos_nuevos: nuevo,
        empresa_id: nuevo.empresa_id || null
      });
    } catch (e) {
      console.error('auditoria crearUsuarioPublico error:', e.message);
    }

    return res.status(201).json(nuevo);
  } catch (err) {
    console.error('crearUsuarioPublico error:', err);

    if (esDuplicadoEmail(err)) {
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

    if (!nombre || !email) {
      return res.status(400).json({
        message: 'nombre y email son obligatorios'
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
    let rol = validRoles.has(bodyRol) ? bodyRol : 'usuario';

    if (requester.rol === 'super_admin') {
      rol = 'usuario';
    }

    if (requester.rol === 'auditor' && bodyRol && !validRoles.has(bodyRol)) {
      return res.status(400).json({ message: 'Rol inválido. Debe ser usuario o super_admin.' });
    }

    let empresaId = null;
    if (requester.rol === 'auditor') {
      empresaId = bodyEmpresaId;
      if (!empresaId) {
        return res.status(400).json({ message: 'empresa_id es obligatorio para auditores' });
      }
    } else if (requester.rol === 'super_admin') {
      empresaId = requester.empresa_id || bodyEmpresaId || null;
      if (!empresaId) {
        return res.status(400).json({ message: 'El super admin debe tener una empresa asignada para crear usuarios' });
      }
    } else {
      empresaId = bodyEmpresaId || requester.empresa_id || null;
    }

    const activoFinal = typeof activo === 'boolean' ? activo : true;

    if (password) {
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
      const nuevoUsuario = await Usuario.crearUsuario({
        nombre,
        email,
        password_hash,
        rol,
        empresa_id: empresaId,
        activo: activoFinal
      });

      try {
        await auditoria.registrar({
          entidad: 'usuarios',
          entidad_id: nuevoUsuario.id,
          accion: 'crear',
          usuario_id: requester ? requester.id : null,
          descripcion: `Usuario creado: ${nuevoUsuario.email}`,
          datos_nuevos: nuevoUsuario,
          empresa_id: nuevoUsuario.empresa_id || null
        });
      } catch (e) {
        console.error('auditoria crearUsuario error:', e.message);
      }

      return res.status(201).json(nuevoUsuario);
    }

    const invitacion = await crearUsuarioConInvitacion({
      nombre,
      email,
      rol,
      empresa_id: empresaId,
      requester,
    });

    return res.status(201).json(invitacion);

  } catch (err) {
    console.error('crearUsuario error:', err);

    if (esDuplicadoEmail(err)) {
      return res.status(409).json({ message: 'Email ya en uso' });
    }

    return res.status(500).json({
      message: err.message || 'Error al crear usuario'
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
    if (esDuplicadoEmail(err)) { // unique_violation
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
