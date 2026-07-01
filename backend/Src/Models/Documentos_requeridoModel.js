// src/models/DocumentoRequeridoModel.js
const pool = require('../configures/db');
const {
  renovarPeriodosVencidos,
  sqlInicioPeriodo,
  esEstadoAprobado
} = require('../Helpers/frecuenciaDocumentoHelper');

const SQL_ULTIMO_UPLOAD = `
  LEFT JOIN LATERAL (
    SELECT ds_u.id, ds_u.estado, ds_u.fecha_subida, ds_u.fecha_validacion
    FROM documentos_subidos ds_u
    WHERE ds_u.empresa_id = dr.empresa_id
      AND ds_u.tipo_documento_id = dr.tipo_documento_id
    ORDER BY ds_u.fecha_subida IS NULL, ds_u.fecha_subida DESC, ds_u.id DESC
    LIMIT 1
  ) ultimo ON true
`;

const SQL_ULTIMO_UPLOAD_USUARIO = `
  LEFT JOIN LATERAL (
    SELECT ds_u.id, ds_u.estado, ds_u.fecha_subida, ds_u.fecha_validacion
    FROM documentos_subidos ds_u
    WHERE ds_u.empresa_id = dr.empresa_id
      AND ds_u.tipo_documento_id = dr.tipo_documento_id
      AND ds_u.usuario_id = dr_resp.usuario_id
    ORDER BY ds_u.fecha_subida IS NULL, ds_u.fecha_subida DESC, ds_u.id DESC
    LIMIT 1
  ) ultimo ON true
`;

function sqlCumplePeriodo(usuarioIdExpr = null) {
  const filtroUsuario = usuarioIdExpr
    ? `AND ds_ok.usuario_id = ${usuarioIdExpr}`
    : '';

  return `
  EXISTS (
    SELECT 1 FROM documentos_subidos ds_ok
    WHERE ds_ok.empresa_id = dr.empresa_id
      AND ds_ok.tipo_documento_id = dr.tipo_documento_id
      ${filtroUsuario}
      AND ds_ok.estado IN ('revisado', 'aprobado')
      AND DATE(COALESCE(ds_ok.fecha_validacion, ds_ok.fecha_subida)) <= dr.fecha_limite
      AND DATE(ds_ok.fecha_subida) > ${sqlInicioPeriodo('dr.fecha_limite', 'td.frecuencia')}
  )
`;
}

const SQL_CUMPLE_PERIODO = sqlCumplePeriodo();
const SQL_CUMPLE_PERIODO_USUARIO = sqlCumplePeriodo('dr_resp.usuario_id');

function sqlPendienteSubida(cumplePeriodoSql) {
  return `
  (
    ultimo.id IS NULL
    OR ultimo.estado = 'rechazado'
    OR NOT (${cumplePeriodoSql})
  )
  AND (
    ultimo.id IS NULL
    OR NOT (ultimo.estado <=> 'subido')
    OR DATE(ultimo.fecha_subida) <= ${sqlInicioPeriodo('dr.fecha_limite', 'td.frecuencia')}
  )
`;
}

const SQL_PENDIENTE_SUBIDA = sqlPendienteSubida(SQL_CUMPLE_PERIODO);
const SQL_PENDIENTE_SUBIDA_USUARIO = sqlPendienteSubida(SQL_CUMPLE_PERIODO_USUARIO);

async function prepararConsultaEmpresa(empresa_id) {
  await renovarPeriodosVencidos(pool, { empresaId: empresa_id });
}

async function prepararConsultaUsuario(usuario_id) {
  await renovarPeriodosVencidos(pool, { usuarioId: usuario_id });
}

// 📌 Crear documento requerido
const crearDocumentoRequerido = async (data) => {
  const {
    empresa_id,
    tipo_documento_id,
    fecha_limite,
    prioridad
  } = data;

  const result = await pool.query(
    `INSERT INTO documentos_requeridos 
    (empresa_id, tipo_documento_id, fecha_limite, prioridad)
    VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [empresa_id, tipo_documento_id, fecha_limite, prioridad]
  );

  return result.rows[0];
};

// 📌 Listar por empresa
const obtenerPorEmpresa = async (empresa_id) => {
  await prepararConsultaEmpresa(empresa_id);

  const result = await pool.query(
    `SELECT dr.*, td.nombre as tipo_documento,
            td.frecuencia AS frecuencia,
            td.porcentaje AS porcentaje,
            COALESCE(u.nombre, 'Sin asignar') as responsable_nombre,
            COALESCE(u.email, '') as responsable_email,
            dr_resp.usuario_id as responsable_id,
            COALESCE(ultimo.estado, 'pendiente') as estado_documento,
            ultimo.id as documento_subido_id,
            (${SQL_CUMPLE_PERIODO}) AS cumple_periodo_actual,
            (
              SELECT COUNT(*) FROM documentos_subidos ds_hist
              WHERE ds_hist.empresa_id = dr.empresa_id
                AND ds_hist.tipo_documento_id = dr.tipo_documento_id
            ) AS total_versiones
     FROM documentos_requeridos dr
     JOIN tipos_documentos td ON dr.tipo_documento_id = td.id
     LEFT JOIN documento_responsables dr_resp ON dr.id = dr_resp.documento_requerido_id
     LEFT JOIN usuarios u ON dr_resp.usuario_id = u.id
     ${SQL_ULTIMO_UPLOAD}
     WHERE dr.empresa_id = $1
     ORDER BY dr.fecha_limite ASC`,
    [empresa_id]
  );

  return result.rows;
};

// 📌 Listar todos los documentos (para superadmin)
const obtenerTodos = async () => {
  await renovarPeriodosVencidos(pool);

  const result = await pool.query(
    `SELECT dr.*, td.nombre as tipo_documento, e.nombre as empresa_nombre,
            COALESCE(u.nombre, 'Sin asignar') as responsable_nombre,
            COALESCE(u.email, '') as responsable_email,
            dr_resp.usuario_id as responsable_id
     FROM documentos_requeridos dr
     JOIN tipos_documentos td ON dr.tipo_documento_id = td.id
     JOIN empresas e ON dr.empresa_id = e.id
     LEFT JOIN documento_responsables dr_resp ON dr.id = dr_resp.documento_requerido_id
     LEFT JOIN usuarios u ON dr_resp.usuario_id = u.id
     ORDER BY dr.fecha_limite ASC`
  );

  return result.rows;
};

const obtenerResumenEmpresa = async (empresa_id) => {
  await prepararConsultaEmpresa(empresa_id);

  const result = await pool.query(`
    SELECT 
      COUNT(DISTINCT dr.tipo_documento_id) AS total,
      COUNT(DISTINCT CASE WHEN (${SQL_CUMPLE_PERIODO}) THEN dr.tipo_documento_id END) AS enviados
    FROM documentos_requeridos dr
    JOIN tipos_documentos td ON dr.tipo_documento_id = td.id
    ${SQL_ULTIMO_UPLOAD}
    WHERE dr.empresa_id = $1
  `, [empresa_id]);

  return result.rows[0];
};

// 📌 Documentos pendientes de subida en el periodo vigente
const obtenerPendientes = async (empresa_id) => {
  await prepararConsultaEmpresa(empresa_id);

  const result = await pool.query(
    `
    SELECT 
      dr.*, 
      td.nombre AS nombre,
      td.frecuencia AS frecuencia,
      td.porcentaje AS porcentaje,
      COALESCE(u.nombre, 'Sin asignar') as responsable_nombre,
      COALESCE(u.email, '') as responsable_email,
      dr_resp.usuario_id as responsable_id,
      ultimo.id AS documento_subido_id,
      COALESCE(ultimo.estado, 'pendiente') AS estado_documento
    FROM documentos_requeridos dr
    JOIN tipos_documentos td ON td.id = dr.tipo_documento_id
    LEFT JOIN documento_responsables dr_resp ON dr.id = dr_resp.documento_requerido_id
    LEFT JOIN usuarios u ON dr_resp.usuario_id = u.id
    ${SQL_ULTIMO_UPLOAD}
    WHERE dr.empresa_id = $1
      AND ${SQL_PENDIENTE_SUBIDA}
    ORDER BY dr.fecha_limite ASC
    `,
    [empresa_id]
  );

  return result.rows;
};

const obtenerPendientesPorUsuario = async (usuario_id) => {
  await prepararConsultaUsuario(usuario_id);

  const result = await pool.query(
    `
    SELECT 
      dr.*, 
      td.nombre AS nombre,
      td.frecuencia AS frecuencia,
      td.porcentaje AS porcentaje,
      COALESCE(u.nombre, 'Sin asignar') as responsable_nombre,
      COALESCE(u.email, '') as responsable_email,
      ultimo.id AS documento_subido_id,
      COALESCE(ultimo.estado, 'pendiente') AS estado_documento
    FROM documentos_requeridos dr
    JOIN tipos_documentos td ON td.id = dr.tipo_documento_id
    JOIN documento_responsables dr_resp ON dr.id = dr_resp.documento_requerido_id
    JOIN usuarios u ON dr_resp.usuario_id = u.id
    ${SQL_ULTIMO_UPLOAD_USUARIO}
    WHERE dr_resp.usuario_id = $1
      AND ${SQL_PENDIENTE_SUBIDA_USUARIO}
    ORDER BY dr.fecha_limite ASC
    `,
    [usuario_id]
  );

  return result.rows;
};

const obtenerAsignadosPorUsuario = async (usuario_id) => {
  await prepararConsultaUsuario(usuario_id);

  const result = await pool.query(
    `
    SELECT 
      dr.*, 
      td.nombre AS nombre,
      td.frecuencia AS frecuencia,
      td.porcentaje AS porcentaje,
      COALESCE(u.nombre, 'Sin asignar') as responsable_nombre,
      COALESCE(u.email, '') as responsable_email,
      ultimo.id AS documento_subido_id,
      COALESCE(ultimo.estado, 'pendiente') AS estado,
      COALESCE(ultimo.estado, 'pendiente') AS estado_documento,
      (${SQL_CUMPLE_PERIODO_USUARIO}) AS cumple_periodo_actual,
      (
        SELECT COUNT(*) FROM documentos_subidos ds_cnt
        WHERE ds_cnt.empresa_id = dr.empresa_id
          AND ds_cnt.tipo_documento_id = dr.tipo_documento_id
          AND ds_cnt.usuario_id = dr_resp.usuario_id
          AND DATE(ds_cnt.fecha_subida) > ${sqlInicioPeriodo('dr.fecha_limite', 'td.frecuencia')}
      ) AS archivos_periodo,
      (
        SELECT COUNT(*) FROM documentos_subidos ds_hist
        WHERE ds_hist.empresa_id = dr.empresa_id
          AND ds_hist.tipo_documento_id = dr.tipo_documento_id
          AND ds_hist.usuario_id = dr_resp.usuario_id
      ) AS total_versiones
    FROM documentos_requeridos dr
    JOIN tipos_documentos td ON td.id = dr.tipo_documento_id
    JOIN documento_responsables dr_resp ON dr.id = dr_resp.documento_requerido_id
    JOIN usuarios u ON dr_resp.usuario_id = u.id
    ${SQL_ULTIMO_UPLOAD_USUARIO}
    WHERE dr_resp.usuario_id = $1
    ORDER BY dr.fecha_limite ASC
    `,
    [usuario_id]
  );

  return result.rows;
};

// 📌 Todos los pendientes (auditor) — ordenados por mayor peso SG-SST
const obtenerTodosPendientesAuditor = async () => {
  await renovarPeriodosVencidos(pool);

  const result = await pool.query(`
    SELECT 
      dr.id,
      dr.empresa_id,
      dr.tipo_documento_id,
      dr.prioridad,
      dr.fecha_limite,
      td.nombre AS nombre,
      td.nombre AS tipo_documento,
      td.porcentaje,
      td.frecuencia,
      e.nombre AS empresa,
      e.nombre AS empresa_nombre,
      COALESCE(u.nombre, 'Sin asignar') AS responsable_nombre,
      dr_resp.usuario_id AS responsable_id,
      COALESCE(u.email, '') AS responsable_email,
      COALESCE(ultimo.estado, 'pendiente') AS estado_documento,
      (ultimo.id IS NULL) AS sin_subir
    FROM documentos_requeridos dr
    JOIN tipos_documentos td ON td.id = dr.tipo_documento_id
    JOIN empresas e ON e.id = dr.empresa_id
    LEFT JOIN documento_responsables dr_resp ON dr.id = dr_resp.documento_requerido_id
    LEFT JOIN usuarios u ON dr_resp.usuario_id = u.id
    ${SQL_ULTIMO_UPLOAD}
    WHERE ${SQL_PENDIENTE_SUBIDA}
    ORDER BY td.porcentaje IS NULL, td.porcentaje DESC, dr.fecha_limite ASC
  `);

  return result.rows;
};

// 📌 Cola de revisión (legacy)
const obtenerColaRevision = async (empresa_id = null) => {
  const result = await pool.query(`
    SELECT 
      dr.id,
      td.nombre AS documento,
      td.porcentaje,
      e.nombre AS empresa,
      dr.prioridad,
      dr.fecha_limite,
      dr.estado,
      COALESCE(u.nombre, 'Sin asignar') as responsable_nombre
    FROM documentos_requeridos dr
    JOIN tipos_documentos td ON td.id = dr.tipo_documento_id
    JOIN empresas e ON e.id = dr.empresa_id
    LEFT JOIN documento_responsables dr_resp ON dr.id = dr_resp.documento_requerido_id
    LEFT JOIN usuarios u ON dr_resp.usuario_id = u.id
    WHERE dr.estado = 'pendiente'
    ${empresa_id ? 'AND dr.empresa_id = $1' : ''}
    ORDER BY td.porcentaje DESC
    LIMIT 5
  `, empresa_id ? [empresa_id] : []);

  return result.rows;
};

module.exports = {
  crearDocumentoRequerido,
  obtenerPorEmpresa,
  obtenerTodos,
  obtenerPendientes,
  obtenerPendientesPorUsuario,
  obtenerAsignadosPorUsuario,
  obtenerColaRevision,
  obtenerTodosPendientesAuditor,
  obtenerResumenEmpresa,
  esEstadoAprobado
};
