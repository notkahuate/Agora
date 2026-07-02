const mysql = require('mysql2/promise');

const mysqlPool = mysql.createPool({
  user: process.env.DB_USER || 'root',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'Agora',
  password: process.env.DB_PASSWORD || '',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

function convertPlaceholders(sql) {
  return sql.replace(/\$(\d+)/g, '?');
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const normalized = { ...row };
    for (const [key, value] of Object.entries(normalized)) {
      if (typeof value === 'string' && (key === 'datos_anteriores' || key === 'datos_nuevos')) {
        try {
          normalized[key] = JSON.parse(value);
        } catch (_) {
          // mantener string si no es JSON válido
        }
      }
    }
    return normalized;
  });
}

function toSafeInt(value, fallback = 0) {
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

/**
 * MySQL/MariaDB en hosting compartido suele fallar con LIMIT/OFFSET en prepared statements.
 * Se insertan como enteros ya validados.
 */
function applyPaginationInlining(sql, params) {
  let nextSql = convertPlaceholders(sql);
  let nextParams = Array.isArray(params) ? [...params] : [];

  const limitOffsetMatch = nextSql.match(/\bLIMIT\s+\?\s+OFFSET\s+\?/i);
  if (limitOffsetMatch && nextParams.length >= 2) {
    const offsetVal = toSafeInt(nextParams.pop());
    const limitVal = toSafeInt(nextParams.pop(), 20);
    nextSql = nextSql.replace(
      /\bLIMIT\s+\?\s+OFFSET\s+\?/i,
      `LIMIT ${limitVal} OFFSET ${offsetVal}`
    );
  }

  const limitOnlyMatch = nextSql.match(/\bLIMIT\s+\?\s*;?\s*$/i);
  if (limitOnlyMatch && nextParams.length >= 1) {
    const limitVal = toSafeInt(nextParams.pop(), 20);
    nextSql = nextSql.replace(/\bLIMIT\s+\?\s*;?\s*$/i, `LIMIT ${limitVal}`);
  }

  return { sql: nextSql, params: nextParams };
}

async function runQuery(sql, params = []) {
  const { sql: finalSql, params: finalParams } = applyPaginationInlining(sql, params);
  const [result] = await mysqlPool.query(finalSql, finalParams);
  return result;
}

async function executeReturning(originalSql, params) {
  const returningMatch = originalSql.match(/\sRETURNING\s+([\s\S]+?)\s*;?\s*$/i);
  const returning = returningMatch ? returningMatch[1].trim() : '*';
  const baseSql = originalSql.replace(/\sRETURNING\s+[\s\S]+?\s*;?\s*$/i, '');
  const upper = baseSql.trim().toUpperCase();

  if (upper.startsWith('INSERT')) {
    const header = await runQuery(baseSql, params);
    const tableMatch = baseSql.match(/INSERT\s+INTO\s+[`"]?(\w+)[`"]?/i);
    const table = tableMatch ? tableMatch[1] : null;
    if (!table || !header.insertId) {
      return { rows: [], insertId: header.insertId || null };
    }
    const rows = await runQuery(
      `SELECT ${returning} FROM \`${table}\` WHERE id = ?`,
      [header.insertId]
    );
    return { rows: normalizeRows(rows), insertId: header.insertId };
  }

  if (upper.startsWith('UPDATE') || upper.startsWith('DELETE')) {
    const tableMatch = upper.startsWith('UPDATE')
      ? baseSql.match(/UPDATE\s+[`"]?(\w+)[`"]?/i)
      : baseSql.match(/FROM\s+[`"]?(\w+)[`"]?/i);
    const table = tableMatch ? tableMatch[1] : null;
    const idMatch = baseSql.match(/\bid\s*=\s*\$(\d+)/i);
    const id = idMatch ? params[parseInt(idMatch[1], 10) - 1] : null;

    let rows = [];
    if (table && id != null) {
      rows = await runQuery(
        `SELECT ${returning} FROM \`${table}\` WHERE id = ?`,
        [id]
      );
    }

    const header = await runQuery(baseSql, params);
    return { rows: normalizeRows(rows), rowCount: header.affectedRows || 0 };
  }

  throw new Error('RETURNING no soportado para este tipo de consulta');
}

async function query(text, params = []) {
  try {
    if (/\sRETURNING\s+/i.test(text)) {
      return executeReturning(text, params);
    }

    const result = await runQuery(text, params);

    if (Array.isArray(result)) {
      return { rows: normalizeRows(result), rowCount: result.length };
    }

    return {
      rows: [],
      rowCount: result.affectedRows || 0,
      insertId: result.insertId || null,
    };
  } catch (error) {
    console.error('Error en la consulta:', error.message);
    throw error;
  }
}

const pool = { query };

const testConnection = async () => {
  try {
    const connection = await mysqlPool.getConnection();
    console.log('✅ Conexión exitosa a MySQL');
    connection.release();
  } catch (error) {
    console.error('❌ Error al conectar a MySQL:', error.message);
    process.exit(1);
  }
};

module.exports = {
  pool,
  mysqlPool,
  testConnection,
  query,
};
