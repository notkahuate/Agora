const { mysqlPool } = require('./db');

async function runMigrations() {
  try {
    const [columns] = await mysqlPool.execute(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'documentos_subidos'
         AND COLUMN_NAME = 'lote_subida'`
    );

    if (columns.length === 0) {
      await mysqlPool.execute(
        'ALTER TABLE documentos_subidos ADD COLUMN lote_subida VARCHAR(64) NULL'
      );
      console.log('✅ Columna lote_subida agregada');
    }

    console.log('✅ Migraciones aplicadas');
  } catch (error) {
    console.error('❌ Error en migraciones:', error.message);
    throw error;
  }
}

module.exports = { runMigrations };
