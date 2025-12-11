// src/models/usuarioModel.js
const { pool } = require('../configures/db');

const crearUsuario = async ({ nombre, email, password_hash, rol, empresa_id, activo }) => {
  const texto = `
    INSERT INTO usuarios (nombre, email, password_hash, rol, empresa_id, activo)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, nombre, email, rol, empresa_id, activo, fecha_creacion;
  `;
  const valores = [nombre, email, password_hash, rol || 'usuario', empresa_id || null, (typeof activo === 'boolean' ? activo : true)];
  const { rows } = await pool.query(texto, valores);
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

const actualizarUsuario = async (id, campos = {}) => {
  // Construye actualización dinámica (no actualizar password_hash si no viene)
  const keys = Object.keys(campos);
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
  listarUsuarios,
  obtenerUsuarioPorId,
  obtenerUsuarioPorEmail,
  actualizarUsuario,
  eliminarUsuario,
};
