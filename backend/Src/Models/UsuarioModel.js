// src/models/usuarioModel.js
const crypto = require('crypto');
const { pool } = require('../configures/db');

const crearUsuario = async ({ nombre, email, password_hash, rol, empresa_id, activo, token_activacion = null, token_expira = null }) => {
  const texto = `
    INSERT INTO usuarios (nombre, email, password_hash, rol, empresa_id, activo, token_activacion, token_expira)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, nombre, email, rol, empresa_id, activo, fecha_creacion;
  `;
  const valores = [
    nombre,
    email,
    password_hash,
    rol || 'usuario',
    empresa_id || null,
    typeof activo === 'boolean' ? activo : true,
    token_activacion,
    token_expira,
  ];
  const { rows } = await pool.query(texto, valores);
  return rows[0];
};

function generarTokenActivacion() {
  return crypto.randomBytes(32).toString('hex');
}

function calcularExpiracionToken() {
  const horas = Number(process.env.INVITATION_EXPIRES_HOURS || 48);
  return new Date(Date.now() + horas * 60 * 60 * 1000);
}

const obtenerUsuarioPorToken = async (token) => {
  const { rows } = await pool.query(
    `SELECT id, nombre, email, rol, empresa_id, activo, token_expira
     FROM usuarios
     WHERE token_activacion = $1`,
    [token]
  );
  return rows[0];
};

const activarUsuarioConToken = async (token, password_hash) => {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET password_hash = $1,
         activo = 1,
         token_activacion = NULL,
         token_expira = NULL,
         fecha_actualizacion = CURRENT_TIMESTAMP
     WHERE token_activacion = $2
       AND token_expira > NOW()
       AND activo = 0
     RETURNING id, nombre, email, rol, empresa_id, activo, fecha_actualizacion;`,
    [password_hash, token]
  );
  return rows[0];
};

const listarUsuarios = async () => {
  const { rows } = await pool.query('SELECT id, nombre, email, rol, empresa_id, activo, fecha_creacion FROM usuarios ORDER BY id DESC;');
  return rows;
};

const obtenerUsuarioPorId = async (id) => {
  const { rows } = await pool.query('SELECT id, nombre, email, rol, empresa_id, activo, fecha_creacion, fecha_actualizacion FROM usuarios WHERE id = $1;', [id]);
  return rows[0];
};

const obtenerUsuarioPorEmail = async (email) => {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1;', [email]);
  return rows[0];
};

const obtenerUsuariosPorEmpresa = async (empresa_id, excluirUsuarioId) => {
  const texto = `
    SELECT 
      id,
      nombre,
      email,
      rol,
      empresa_id,
      activo,
      fecha_creacion
    FROM usuarios
    WHERE empresa_id = $1
      AND id <> $2
      AND activo = true
    ORDER BY nombre ASC;
  `;

  const valores = [empresa_id, excluirUsuarioId];
  const { rows } = await pool.query(texto, valores);
  return rows;
};


const actualizarUsuario = async (id, campos = {}) => {
  // Construye actualización dinámica con whitelist de campos permitidos
  const allowed = new Set(['nombre', 'email', 'password_hash', 'rol', 'empresa_id', 'activo']);
  const keys = Object.keys(campos).filter((key) => allowed.has(key));
  if (keys.length === 0) return await obtenerUsuarioPorId(id);

  const set = [];
  const values = [];
  let idx = 1;
  for (const key of keys) {
    set.push(`${key} = $${idx}`);
    values.push(campos[key]);
    idx++;
  }
  values.push(id);
  const texto = `UPDATE usuarios SET ${set.join(', ')}, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING id, nombre, email, rol, empresa_id, activo, fecha_actualizacion;`;
  const { rows } = await pool.query(texto, values);
  return rows[0];
};

const eliminarUsuario = async (id) => {
  const { rows } = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id, nombre, email;', [id]);
  return rows[0];
};

module.exports = {
  crearUsuario,
  generarTokenActivacion,
  calcularExpiracionToken,
  obtenerUsuarioPorToken,
  activarUsuarioConToken,
  listarUsuarios,
  obtenerUsuarioPorId,
  obtenerUsuarioPorEmail,
  actualizarUsuario,
  eliminarUsuario,
  obtenerUsuariosPorEmpresa
};
