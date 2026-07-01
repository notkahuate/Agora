/**
 * Lógica de periodos SG-SST según frecuencia (mensual, trimestral, anual).
 * La fecha límite del documento requerido marca el fin del periodo vigente.
 */
const ESTADOS_APROBADOS = ['revisado', 'aprobado'];
const ESTADOS_APROBADOS_SQL = "('revisado', 'aprobado')";

function toDateOnly(value) {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateOnly(date) {
  const d = toDateOnly(date);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function addPeriod(fecha, frecuencia) {
  const d = toDateOnly(fecha);
  if (!d) return null;

  switch (String(frecuencia || '').toLowerCase()) {
    case 'mensual':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'trimestral':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'anual':
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      return d;
  }
  return d;
}

function subtractPeriod(fecha, frecuencia) {
  const d = toDateOnly(fecha);
  if (!d) return null;

  switch (String(frecuencia || '').toLowerCase()) {
    case 'mensual':
      d.setMonth(d.getMonth() - 1);
      break;
    case 'trimestral':
      d.setMonth(d.getMonth() - 3);
      break;
    case 'anual':
      d.setFullYear(d.getFullYear() - 1);
      break;
    default:
      return d;
  }
  return d;
}

function esEstadoAprobado(estado) {
  return ESTADOS_APROBADOS.includes(String(estado || '').toLowerCase());
}

function sqlInicioPeriodo(aliasFechaLimite, aliasFrecuencia) {
  return `(
    CASE ${aliasFrecuencia}
      WHEN 'mensual' THEN DATE_SUB(DATE(${aliasFechaLimite}), INTERVAL 1 MONTH)
      WHEN 'trimestral' THEN DATE_SUB(DATE(${aliasFechaLimite}), INTERVAL 3 MONTH)
      WHEN 'anual' THEN DATE_SUB(DATE(${aliasFechaLimite}), INTERVAL 1 YEAR)
      ELSE DATE_SUB(DATE(${aliasFechaLimite}), INTERVAL 100 YEAR)
    END
  )`;
}

/**
 * Avanza fecha_limite cuando un periodo venció y fue cumplido con un documento aprobado.
 */
async function renovarPeriodosVencidos(pool, filters = {}) {
  const { empresaId = null, usuarioId = null } = filters;
  const params = [];
  let query = `
    SELECT dr.id, dr.empresa_id, dr.tipo_documento_id, dr.fecha_limite, td.frecuencia
    FROM documentos_requeridos dr
    JOIN tipos_documentos td ON td.id = dr.tipo_documento_id
    WHERE td.frecuencia IS NOT NULL
  `;

  if (empresaId) {
    params.push(empresaId);
    query += ` AND dr.empresa_id = $${params.length}`;
  }

  if (usuarioId) {
    params.push(usuarioId);
    query += ` AND EXISTS (
      SELECT 1 FROM documento_responsables resp
      WHERE resp.documento_requerido_id = dr.id AND resp.usuario_id = $${params.length}
    )`;
  }

  const { rows } = await pool.query(query, params);
  const today = toDateOnly(new Date());

  for (const row of rows) {
    let fechaLimite = toDateOnly(row.fecha_limite);
    if (!fechaLimite) continue;

    let updated = false;

    while (fechaLimite < today) {
      const periodStart = subtractPeriod(fechaLimite, row.frecuencia);
      const periodStartStr = formatDateOnly(periodStart);
      const fechaLimiteStr = formatDateOnly(fechaLimite);

      const { rows: approved } = await pool.query(
        `SELECT id FROM documentos_subidos
         WHERE empresa_id = $1 AND tipo_documento_id = $2
           AND estado IN ${ESTADOS_APROBADOS_SQL}
           AND DATE(COALESCE(fecha_validacion, fecha_subida)) <= DATE($3)
           AND DATE(fecha_subida) > DATE($4)
         LIMIT 1`,
        [row.empresa_id, row.tipo_documento_id, fechaLimiteStr, periodStartStr]
      );

      if (!approved.length) break;

      fechaLimite = addPeriod(fechaLimite, row.frecuencia);
      updated = true;
    }

    if (updated) {
      await pool.query(
        `UPDATE documentos_requeridos SET fecha_limite = $1 WHERE id = $2`,
        [formatDateOnly(fechaLimite), row.id]
      );
    }
  }
}

module.exports = {
  ESTADOS_APROBADOS,
  ESTADOS_APROBADOS_SQL,
  addPeriod,
  subtractPeriod,
  toDateOnly,
  formatDateOnly,
  esEstadoAprobado,
  sqlInicioPeriodo,
  renovarPeriodosVencidos
};
