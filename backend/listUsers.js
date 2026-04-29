const { pool } = require('./Src/configures/db');

async function listUsers() {
  try {
    const { rows } = await pool.query('SELECT id, nombre, email, rol, empresa_id, activo FROM usuarios');
    console.log('Usuarios en la base de datos:');
    rows.forEach(user => {
      console.log(`ID: ${user.id}, Nombre: ${user.nombre}, Email: ${user.email}, Rol: ${user.rol}, Empresa: ${user.empresa_id}, Activo: ${user.activo}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

listUsers();