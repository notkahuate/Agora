const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'Agora',
    password: process.env.DB_PASSWORD || 'uts2023',
    port: process.env.DB_PORT || 5432,
});

// Función para probar la conexión
const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Conexión exitosa a PostgreSQL');
        client.release();
    } catch (error) {
        console.error('❌ Error al conectar a PostgreSQL:', error.message);
        process.exit(1); // Terminar la aplicación si no hay conexión
    }
};

// Función para ejecutar consultas
const query = async (text, params) => {
    try {
        const result = await pool.query(text, params);
        return result;
    } catch (error) {
        console.error('Error en la consulta:', error.message);
        throw error;
    }
};

module.exports = {
    pool,
    testConnection,
    query
}; 