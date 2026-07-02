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

    const [tokenColumns] = await mysqlPool.execute(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'usuarios'
         AND COLUMN_NAME = 'token_activacion'`
    );

    if (tokenColumns.length === 0) {
      await mysqlPool.execute(
        'ALTER TABLE usuarios ADD COLUMN token_activacion VARCHAR(64) NULL'
      );
      await mysqlPool.execute(
        'ALTER TABLE usuarios ADD COLUMN token_expira DATETIME NULL'
      );
      console.log('✅ Columnas de invitación agregadas a usuarios');
    }

    console.log('✅ Migraciones aplicadas');
  } catch (error) {
    console.error('❌ Error en migraciones:', error.message);
    throw error;
  }
}

module.exports = { runMigrations };
