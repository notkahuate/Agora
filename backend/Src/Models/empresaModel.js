// src/models/empresaModel.js
const db = require('../configures/db');

const createEmpresa = async ({ nombre, rut, sector, ubicacion, email, telefono, activa }) => {
  const text = `
    INSERT INTO empresas (nombre, rut, sector, ubicacion, email, telefono, activa)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const values = [nombre, rut, sector || null, ubicacion || null, email || null, telefono || null, (typeof activa === 'boolean' ? activa : true)];
  const { rows } = await db.query(text, values);
  return rows[0];
};

const getAllEmpresas = async () => {
  const { rows } = await db.query('SELECT * FROM empresas ORDER BY id;');
  return rows;
};

const getEmpresaById = async (id) => {
  const { rows } = await db.query('SELECT * FROM empresas WHERE id = $1;', [id]);
  return rows[0];
};

const updateEmpresa = async (id, fields = {}) => {
  // Construir query dinámica y parámetros
  const setClauses = [];
  const values = [];
  let idx = 1;
  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }
  if (setClauses.length === 0) return await getEmpresaById(id); // nothing to update

  const text = `UPDATE empresas SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *;`;
  values.push(id);
  const { rows } = await db.query(text, values);
  return rows[0];
};

const deleteEmpresa = async (id) => {
  const { rows } = await db.query('DELETE FROM empresas WHERE id = $1 RETURNING *;', [id]);
  return rows[0];
};

module.exports = {
  createEmpresa,
  getAllEmpresas,
  getEmpresaById,
  updateEmpresa,
  deleteEmpresa,
};
