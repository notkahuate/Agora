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

    const [auditoriaEmpresaCol] = await mysqlPool.execute(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'auditoria_sistema'
         AND COLUMN_NAME = 'empresa_id'`
    );

    if (auditoriaEmpresaCol.length === 0) {
      await mysqlPool.execute(
        'ALTER TABLE auditoria_sistema ADD COLUMN empresa_id INT NULL'
      );
      await mysqlPool.execute(
        `ALTER TABLE auditoria_sistema
         ADD CONSTRAINT fk_aud_empresa
         FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL`
      ).catch(() => {
        // Si ya existe la FK o falla en hosting, continuar
      });
      console.log('✅ Columna empresa_id agregada a auditoria_sistema');
    }

    console.log('✅ Migraciones aplicadas');
  } catch (error) {
    console.error('❌ Error en migraciones:', error.message);
    throw error;
  }
}

module.exports = { runMigrations };
