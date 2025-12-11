// models/tiposDocumentos.model.js
const pool = require("../configures/db").pool;

class TiposDocumentos {
  static async getAll() {
    const query = "SELECT * FROM tipos_documentos ORDER BY id ASC";
    const result = await pool.query(query);
    return result.rows;
  }

  static async getById(id) {
    const query = "SELECT * FROM tipos_documentos WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async create(data) {
    const query = `
      INSERT INTO tipos_documentos (nombre, descripcion, frecuencia, obligatorio)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [data.nombre, data.descripcion, data.frecuencia, data.obligatorio];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async update(id, data) {
    const query = `
      UPDATE tipos_documentos
      SET nombre = $1,
          descripcion = $2,
          frecuencia = $3,
          obligatorio = $4
      WHERE id = $5
      RETURNING *;
    `;
    const values = [data.nombre, data.descripcion, data.frecuencia, data.obligatorio, id];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async delete(id) {
    const query = "DELETE FROM tipos_documentos WHERE id = $1 RETURNING *;";
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = TiposDocumentos;
