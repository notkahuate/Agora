// ==============================
// CONFIG INICIAL
// ==============================
const token = window.Auth ? window.Auth.getToken() : localStorage.getItem('token');
const params = new URLSearchParams(window.location.search);
const empresaId = params.get('id');

let usuariosGlobal = [];
let paginaUsuarios = 1;
const limiteUsuarios = 5;

let pendientesGlobal = [];
let paginaPendientes = 1;
const limitePendientes = 5;

let aprobadosGlobal = [];
let paginaAprobados = 1;
const limiteAprobados = 5;

// ==============================
// VALIDACIÓN BÁSICA
// ==============================
if (!token) {
  alert("Sesión expirada");
  window.location.replace("/");
}

// ==============================
// CARGAR EMPRESA
// ==============================
async function cargarEmpresaDetalle() {
  console.log("ID recibido:", empresaId);

  if (!empresaId) {
    alert("Empresa no encontrada");
    return;
  }

  try {
    const res = await fetch(`http://localhost:3000/api/empresas/${empresaId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      alert("Error al cargar empresa");
      return;
    }

    const data = await res.json();
    console.log("DATA BACKEND:", data);

    // 🔥 soporta ambos formatos
    const e = data.empresa || data;

    // ==========================
    // PINTAR DATOS
    // ==========================
    document.getElementById('empresaNombre').textContent = e.nombre || '-';

    document.getElementById('empresaRazonSocial').textContent =
      e.razon_social || e.nombre || '-';

    document.getElementById('empresaRuc').textContent =
      e.ruc || e.rut || '-';

    document.getElementById('empresaSector').textContent =
      e.sector || '-';

    document.getElementById('empresaFecha').textContent =
      e.createdAt
        ? new Date(e.createdAt).toLocaleDateString()
        : e.fecha_creacion
        ? new Date(e.fecha_creacion).toLocaleDateString()
        : '-';

    document.getElementById('empresaEstado').textContent =
      e.activa ? 'Activa' : 'Inactiva';

    empresaData = e;

    // 🔥 cargar usuarios (esto llena empleados)
    await loadUsuariosEmpresa();

    // 🔥 cargar cumplimiento
    await cargarCumplimientoEmpresa();

    // 🔥 cargar documentos (opcional si ya lo tienes)
    await loadDocumentosEmpresa();

  } catch (err) {
    console.error(err);
    alert("Error de conexión");
  }
}

let documentosGlobal = [];
let empresaData = null;

// ==============================
// CARGAR USUARIOS (EMPLEADOS)
// ==============================
async function loadUsuariosEmpresa() {
  const tablaUsuarios = document.getElementById('tablaUsuariosEmpresa');

  try {
    const res = await fetch('http://localhost:3000/api/usuarios', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (!res.ok) {
      tablaUsuarios.innerHTML = `<tr><td colspan="5">Error cargando usuarios</td></tr>`;
      return;
    }

    const usuarios = Array.isArray(data) ? data : [];
    const usuariosEmpresa = usuarios.filter(u =>
      String(u.empresa_id) === String(empresaId)
    );

    usuariosGlobal = usuariosEmpresa;
    paginaUsuarios = 1;

    document.getElementById('empresaEmpleados').textContent = usuariosEmpresa.length;

    // Cargar documentos una sola vez
    await cargarTodosLosDocumentos();

    renderUsuarios();

  } catch (err) {
    console.error("Error usuarios:", err);
  }
}

async function cargarTodosLosDocumentos() {
  try {
    const res = await fetch('http://localhost:3000/api/documentos', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (res.ok) {
      const allDocs = Array.isArray(data) ? data : [];
      documentosGlobal = allDocs.filter(d => String(d.empresa_id) === String(empresaId));
    }
  } catch (err) {
    console.error("Error cargando documentos:", err);
    documentosGlobal = [];
  }
}

// ==============================
// CARGAR CUMPLIMIENTO (como en auditor)
// ==============================
async function cargarCumplimientoEmpresa() {
  try {
    const resResumen = await fetch(`http://localhost:3000/api/documentos-requeridos/empresa/${empresaId}/resumen`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const resumen = await resResumen.json();

    const totalDocs = parseInt(resumen.total) || 0;
    const enviados = parseInt(resumen.enviados) || 0;

    const cumplimiento = totalDocs === 0 ? 0 : Math.round((enviados / totalDocs) * 100);

    document.getElementById('statCumplimiento').textContent = `${cumplimiento}%`;

    // 🔥 Actualizar barra de progreso
    const barra = document.getElementById('barraCumplimiento');
    if (barra) {
      const fill = barra.querySelector('.progress-fill');
      if (fill) {
        fill.style.width = `${cumplimiento}%`;
      }
    }

  } catch (err) {
    console.error("Error cargando cumplimiento:", err);
  }
}

// ==============================
// ACTUALIZAR BARRAS DE PROGRESO
// ==============================
function actualizarBarrasProgresoEmpresa() {
  if (!documentosGlobal || documentosGlobal.length === 0 || !usuariosGlobal) {
    // Sin datos, mostrar 0%
    document.getElementById('badgeProgresoDocEmpresa').textContent = '0%';
    document.getElementById('barraProgresoDocEmpresa').style.width = '0%';
    document.getElementById('docsCompletadosEmpresa').textContent = '0';
    document.getElementById('docsTotalesEmpresa').textContent = '0';
    document.getElementById('docsValidadosEmpresa').textContent = '0';

    document.getElementById('badgeProgresoPersonasEmpresa').textContent = '0%';
    document.getElementById('barraProgresoPersonasEmpresa').style.width = '0%';
    document.getElementById('usuariosCompletosEmpresa').textContent = '0';
    document.getElementById('usuariosTotalesEmpresa').textContent = '0';
    document.getElementById('usuariosProgresoEmpresa').textContent = '0';
    return;
  }

  // ========== PROGRESO DE DOCUMENTACIÓN ==========
  const totalDocs = documentosGlobal.length;
  
  const docsCompletadosCount = documentosGlobal.filter(d => {
    const estado = String(d.estado_documento || d.estado || 'pendiente').toLowerCase();
    return ['validado', 'revisado', 'aprobado'].includes(estado);
  }).length;

  const docsValidadosCount = documentosGlobal.filter(d => {
    const estado = String(d.estado_documento || d.estado || 'pendiente').toLowerCase();
    return ['validado', 'revisado'].includes(estado);
  }).length;

  const progresoDocs = totalDocs > 0 ? Math.round((docsCompletadosCount / totalDocs) * 100) : 0;

  document.getElementById('badgeProgresoDocEmpresa').textContent = progresoDocs + '%';
  document.getElementById('barraProgresoDocEmpresa').style.width = progresoDocs + '%';
  document.getElementById('docsCompletadosEmpresa').textContent = docsCompletadosCount;
  document.getElementById('docsTotalesEmpresa').textContent = totalDocs;
  document.getElementById('docsValidadosEmpresa').textContent = docsValidadosCount;

  // ========== PROGRESO DE PERSONAS ==========
  const totalUsuarios = usuariosGlobal.length;
  
  if (totalUsuarios === 0) {
    document.getElementById('badgeProgresoPersonasEmpresa').textContent = '0%';
    document.getElementById('barraProgresoPersonasEmpresa').style.width = '0%';
    document.getElementById('usuariosCompletosEmpresa').textContent = '0';
    document.getElementById('usuariosTotalesEmpresa').textContent = '0';
    document.getElementById('usuariosProgresoEmpresa').textContent = '0';
    return;
  }

  let usuariosCompletosCount = 0;
  let usuariosEnProgresoCount = 0;

  usuariosGlobal.forEach(usuario => {
    const docsDelUsuario = documentosGlobal.filter(d => d.responsable_id === usuario.id);
    
    if (docsDelUsuario.length === 0) {
      return;
    }

    const docsCompletadosDelUsuario = docsDelUsuario.filter(d => {
      const estado = String(d.estado_documento || d.estado || 'pendiente').toLowerCase();
      return ['validado', 'revisado', 'aprobado'].includes(estado);
    }).length;

    const progresoUsuario = (docsCompletadosDelUsuario / docsDelUsuario.length) * 100;

    if (progresoUsuario === 100) {
      usuariosCompletosCount++;
    } else if (progresoUsuario > 0) {
      usuariosEnProgresoCount++;
    }
  });

  const progresoPersonas = totalUsuarios > 0 ? Math.round((usuariosCompletosCount / totalUsuarios) * 100) : 0;

  document.getElementById('badgeProgresoPersonasEmpresa').textContent = progresoPersonas + '%';
  document.getElementById('barraProgresoPersonasEmpresa').style.width = progresoPersonas + '%';
  document.getElementById('usuariosCompletosEmpresa').textContent = usuariosCompletosCount;
  document.getElementById('usuariosTotalesEmpresa').textContent = totalUsuarios;
  document.getElementById('usuariosProgresoEmpresa').textContent = usuariosEnProgresoCount;
}

function renderUsuarios() {
  const tablaUsuarios = document.getElementById('tablaUsuariosEmpresa');

  const inicio = (paginaUsuarios - 1) * limiteUsuarios;
  const fin = inicio + limiteUsuarios;

  const pagina = usuariosGlobal.slice(inicio, fin);

  tablaUsuarios.innerHTML = pagina.length
    ? pagina.map(u => {
        const docsDelUsuario = documentosGlobal.filter(d =>
          String(d.usuario_id) === String(u.id)
        );

        const contadorDocumentos = docsDelUsuario.length;

        const listaDocumentos = docsDelUsuario.length > 0
          ? docsDelUsuario.map(d => `
              <div style="font-size:12px; padding:6px; background:#f8fafc; border-radius:6px; margin:4px 0; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <span>${d.nombre_archivo || d.nombre || 'Documento'}</span>
                <button class="btn btn-sm btn-secondary" onclick="descargarDocumento('${d.id}', '${String(d.nombre_archivo || d.nombre || 'Documento').replace(/'/g, "\\'")}')">Descargar</button>
              </div>
            `).join('')
          : '<div style="font-size:12px; color:#64748b;">Sin documentos</div>';

        const ultimaActividad = docsDelUsuario.length > 0
          ? new Date(Math.max(...docsDelUsuario.map(d => new Date(d.fecha_subida).getTime()))).toLocaleDateString()
          : '-';

        const activoValor = String(u.activo ?? u.estado ?? u.status ?? u.estatus ?? '').toLowerCase();
        const estaActivo = ['true', '1', 'activo', 'activo', 'active', 't', 'yes', 'si'].includes(activoValor) || u.activo === true || u.activo === 1;
        const estadoUsuario = estaActivo ? 'Activo' : 'Inactivo';

        return `
          <tr>
            <td>${u.nombre || u.email}</td>
            <td>${u.email || '-'}</td>
            <td>${u.rol || '-'}</td>
            <td><span class="badge ${estadoUsuario === 'Activo' ? 'badge-success' : 'badge-danger'}">${estadoUsuario}</span></td>
            <td>${contadorDocumentos}</td>
            <td>${ultimaActividad}</td>
          </tr>
        `;
      }).join('')
    : `<tr><td colspan="6">Sin usuarios</td></tr>`;

  renderControlesUsuarios();
  actualizarBarrasProgresoEmpresa();
}

function renderControlesUsuarios() {
  const totalPaginas = Math.ceil(usuariosGlobal.length / limiteUsuarios);

  const container = document.getElementById('paginacionUsuarios');
  if (!container) return;

  container.innerHTML = `
    <button onclick="cambiarPaginaUsuarios(-1)" ${paginaUsuarios === 1 ? 'disabled' : ''}>⬅</button>
    <span>Página ${paginaUsuarios} de ${totalPaginas}</span>
    <button onclick="cambiarPaginaUsuarios(1)" ${paginaUsuarios === totalPaginas ? 'disabled' : ''}>➡</button>
  `;
}

function cambiarPaginaUsuarios(direccion) {
  paginaUsuarios += direccion;
  renderUsuarios();
}
// ==============================
// DOCUMENTOS (opcional)
// ==============================
async function loadDocumentosEmpresa() {
  const tablaSubidos = document.getElementById('tablaDocumentosSubidos');
  const tablaPendientes = document.getElementById('tablaDocumentosPendientes');

  try {
    const res = await fetch('http://localhost:3000/api/documentos', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (!res.ok) return;

    const docs = Array.isArray(data) ? data : [];

    const empresaDocs = docs.filter(d =>
      String(d.empresa_id) === String(empresaId)
    );

    const aprobados = empresaDocs.filter(d => ['validado','revisado'].includes(d.estado));
    const pendientes = empresaDocs.filter(d => !['validado','revisado'].includes(d.estado));

    document.getElementById('statSubidos').textContent = empresaDocs.length;
    document.getElementById('statAprobados').textContent = aprobados.length;

    aprobadosGlobal = aprobados;
    paginaAprobados = 1;

    if (tablaSubidos) {
      tablaSubidos.innerHTML = empresaDocs.length
        ? empresaDocs.map(doc => `
            <tr>
              <td>${doc.nombre_archivo || 'Documento'}</td>
              <td>${doc.tipo_documento_nombre || doc.tipo_documento_id || '-'}</td>
              <td>${doc.usuario_nombre || doc.usuario_id || '-'}</td>
              <td>${doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
              <td>${doc.estado}</td>
              <td>
                <button class="btn btn-secondary" onclick="descargarDocumento('${doc.id}', '${String(doc.nombre_archivo).replace(/'/g, "\\'")}')">
                  Descargar
                </button>
              </td>
            </tr>
          `).join('')
        : `<tr><td colspan="6">Sin documentos</td></tr>`;
    }

    renderAprobados();

    if (tablaPendientes) {
      tablaPendientes.innerHTML = pendientes.length
        ? pendientes.map(doc => `
            <tr>
              <td>${doc.nombre_archivo}</td>
              <td>${doc.tipo_documento_id}</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td><span class="badge badge-warning">Pendiente</span></td>
            </tr>
          `).join('')
        : `<tr><td colspan="6">Sin pendientes</td></tr>`;
    }

  } catch (err) {
    console.error("Error documentos:", err);
  }
}

function renderAprobados() {
  const tablaAprobados = document.getElementById('tablaDocumentosAprobados');
  const inicio = (paginaAprobados - 1) * limiteAprobados;
  const fin = inicio + limiteAprobados;
  const pagina = aprobadosGlobal.slice(inicio, fin);

  if (!tablaAprobados) return;

  tablaAprobados.innerHTML = pagina.length
    ? pagina.map(doc => `
        <tr>
          <td>${doc.nombre_archivo || 'Documento'}</td>
          <td>${doc.tipo_documento_nombre || doc.tipo_documento_id || '-'}</td>
          <td>${doc.usuario_nombre || doc.usuario_id || '-'}</td>
          <td>${doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
          <td>${doc.estado}</td>
          <td>
            <button class="btn btn-secondary" onclick="descargarDocumento('${doc.id}', '${String(doc.nombre_archivo).replace(/'/g, "\\'")}')">
              Descargar
            </button>
          </td>
        </tr>
      `).join('')
    : `<tr><td colspan="6">No hay documentos aprobados</td></tr>`;

  renderControlesAprobados();
}

function renderControlesAprobados() {
  const totalPaginas = Math.max(1, Math.ceil(aprobadosGlobal.length / limiteAprobados));
  const container = document.getElementById('paginacionAprobados');
  if (!container) return;

  container.innerHTML = `
    <button onclick="cambiarPaginaAprobados(-1)" ${paginaAprobados === 1 ? 'disabled' : ''}>⬅</button>
    <span>Página ${paginaAprobados} de ${totalPaginas}</span>
    <button onclick="cambiarPaginaAprobados(1)" ${paginaAprobados === totalPaginas ? 'disabled' : ''}>➡</button>
  `;
}

function cambiarPaginaAprobados(direccion) {
  paginaAprobados += direccion;
  if (paginaAprobados < 1) paginaAprobados = 1;
  const max = Math.max(1, Math.ceil(aprobadosGlobal.length / limiteAprobados));
  if (paginaAprobados > max) paginaAprobados = max;
  renderAprobados();
}

// ==============================
// TABS
// ==============================
async function switchTab(tabName, evt) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('is-active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  const selectedPill = evt?.currentTarget || document.querySelector(`.pill[data-tab="${tabName}"]`);
  if (selectedPill) selectedPill.classList.add('is-active');

  const panel = document.getElementById(`tab-${tabName}`);
  if (panel) panel.classList.add('active');

  if (tabName === 'usuarios-empresa') {
    await cargarTodosLosDocumentos();
    renderUsuarios();
    actualizarBarrasProgresoEmpresa();
  }
}

// ==============================
// SIDEBAR (Resumen / Usuarios)
// ==============================
function mostrarSeccion(seccion, el) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('is-active'));
  el.classList.add('is-active');

  if (seccion === 'usuarios') {
    switchTab('usuarios-empresa');
  } else {
    switchTab('documentos-subidos');
  }
}

// ==============================
// VOLVER
// ==============================
function goBack() {
  window.location.href = "auditor-dashboard.html";
}


async function cargarPendientesEmpresa(empresaId) {
  try {
    const res = await fetch(`http://localhost:3000/api/documentos-requeridos/empresa/${empresaId}/pendientes`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const data = await res.json();

    // 🔥 GUARDAR EN GLOBAL
    pendientesGlobal = data;
    paginaPendientes = 1;

    document.getElementById('statPendientes').textContent = data.length;

    // 🔥 RENDER
    renderPendientes();

  } catch (error) {
    console.error('Error cargando pendientes:', error);
  }
}

function renderPendientes() {
  const tbody = document.getElementById('tablaDocumentosPendientes');

  const inicio = (paginaPendientes - 1) * limitePendientes;
  const fin = inicio + limitePendientes;

  const pagina = pendientesGlobal.slice(inicio, fin);

  tbody.innerHTML = pagina.length
    ? pagina.map(doc => `
        <tr>
          <td>${doc.nombre}</td>
          <td>${doc.tipo_documento_id}</td>
          <td>${doc.frecuencia}</td>
          <td>${new Date(doc.fecha_limite).toLocaleDateString()}</td>
          <td>Empresa</td>
          <td>
            <span class="badge badge-${doc.prioridad === 'alta' ? 'danger' : doc.prioridad === 'media' ? 'warning' : 'info'}">
              ${doc.prioridad}
            </span>
          </td>
        </tr>
      `).join('')
    : `<tr><td colspan="6">Sin pendientes</td></tr>`;

  renderControlesPendientes();
}

function renderControlesPendientes() {
  const totalPaginas = Math.ceil(pendientesGlobal.length / limitePendientes);

  const container = document.getElementById('paginacionPendientes');
  if (!container) return;

  container.innerHTML = `
    <button onclick="cambiarPaginaPendientes(-1)" ${paginaPendientes === 1 ? 'disabled' : ''}>⬅</button>
    <span>Página ${paginaPendientes} de ${totalPaginas}</span>
    <button onclick="cambiarPaginaPendientes(1)" ${paginaPendientes === totalPaginas ? 'disabled' : ''}>➡</button>
  `;
}

function cambiarPaginaPendientes(direccion) {
  paginaPendientes += direccion;
  renderPendientes();
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function parseToDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function exportarReporteEmpresa() {
  if (!empresaId) {
    return alert('Empresa no encontrada');
  }

  if (!empresaData) {
    await cargarEmpresaDetalle();
  }

  await cargarTodosLosDocumentos();
  if (!usuariosGlobal || usuariosGlobal.length === 0) {
    await loadUsuariosEmpresa();
  }

  const empresa = empresaData || {};
  const docs = documentosGlobal || [];

  const reportDate = new Date().toLocaleDateString();
  const companyInfo = [
    ['AGORA - Reporte de empresa'],
    ['Fecha del reporte', reportDate],
    [],
    ['Campo', 'Valor'],
    ['Nombre de empresa', empresa.nombre || empresa.razon_social || '-'],
    ['NIT / RUC', empresa.ruc || empresa.rut || '-'],
    ['Sector', empresa.sector || '-'],
    ['Ubicación', empresa.ubicacion || empresa.direccion || '-'],
    ['Empleados', document.getElementById('empresaEmpleados').textContent || '-'],
    ['Fecha de registro', document.getElementById('empresaFecha').textContent || '-'],
    ['Estado', document.getElementById('empresaEstado').textContent || '-'],
    ['Documentos subidos', docs.length],
    ['Documentos aprobados', docs.filter(d => ['validado', 'revisado', 'aprobado'].includes(String(d.estado || d.estado_documento || '').toLowerCase())).length],
    ['Documentos pendientes', docs.filter(d => !['validado', 'revisado', 'aprobado'].includes(String(d.estado || d.estado_documento || '').toLowerCase())).length],
    ['Usuarios totales', usuariosGlobal.length]
  ];

  const historyRows = docs.map((doc, index) => ({
    'N°': index + 1,
    'Documento': doc.nombre_archivo || doc.nombre || 'Documento',
    'Tipo': doc.tipo_documento_nombre || doc.tipo_documento_id || '-',
    'Usuario': doc.usuario_nombre || doc.usuario || doc.usuario_id || doc.responsable_id || '-',
    'Email usuario': doc.usuario_email || doc.email || '-',
    'Fecha envío': formatDate(doc.fecha_subida || doc.createdAt || doc.fecha_creacion),
    'Estado': doc.estado || doc.estado_documento || 'Pendiente',
    'Subido por': doc.usuario_nombre || doc.usuario || doc.usuario_id || doc.responsable_id || '-'
  }));

  const usuarioMap = {};
  docs.forEach(doc => {
    const userId = String(doc.usuario_id || doc.responsable_id || '');
    if (!userId) return;

    const estado = String(doc.estado || doc.estado_documento || 'pendiente').toLowerCase();
    const fechaDoc = parseToDate(doc.fecha_subida || doc.createdAt || doc.fecha_creacion);
    if (!usuarioMap[userId]) {
      usuarioMap[userId] = {
        'Usuario': doc.usuario_nombre || doc.usuario || userId,
        'Correo': doc.usuario_email || doc.email || '-',
        'Documentos subidos': 0,
        'Documentos aprobados': 0,
        'Documentos pendientes': 0,
        '_lastActivity': fechaDoc,
        'Última actividad': formatDate(fechaDoc)
      };
    }

    usuarioMap[userId]['Documentos subidos'] += 1;
    if (['validado', 'revisado', 'aprobado'].includes(estado)) {
      usuarioMap[userId]['Documentos aprobados'] += 1;
    } else {
      usuarioMap[userId]['Documentos pendientes'] += 1;
    }

    if (fechaDoc && (!usuarioMap[userId]['_lastActivity'] || fechaDoc > usuarioMap[userId]['_lastActivity'])) {
      usuarioMap[userId]['_lastActivity'] = fechaDoc;
      usuarioMap[userId]['Última actividad'] = formatDate(fechaDoc);
    }
  });

  usuariosGlobal.forEach(usuario => {
    const userId = String(usuario.id);
    if (!usuarioMap[userId]) {
      const userDocs = docs.filter(d => String(d.usuario_id || d.responsable_id) === userId);
      const lastActivity = userDocs.reduce((latest, current) => {
        const date = parseToDate(current.fecha_subida || current.createdAt || current.fecha_creacion);
        if (!date) return latest;
        return date > latest ? date : latest;
      }, null);

      usuarioMap[userId] = {
        'Usuario': usuario.nombre || usuario.email || userId,
        'Correo': usuario.email || '-',
        'Documentos subidos': userDocs.length,
        'Documentos aprobados': userDocs.filter(d => ['validado', 'revisado', 'aprobado'].includes(String(d.estado || d.estado_documento || '').toLowerCase())).length,
        'Documentos pendientes': userDocs.filter(d => !['validado', 'revisado', 'aprobado'].includes(String(d.estado || d.estado_documento || '').toLowerCase())).length,
        '_lastActivity': lastActivity,
        'Última actividad': lastActivity ? formatDate(lastActivity) : '-'
      };
    }
  });

  const userRows = Object.values(usuarioMap).map(({_lastActivity, ...rest}) => rest);

    // Generar .xlsx real usando ExcelJS para poder aplicar estilos (bordes, cabeceras)
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AGORA';
    workbook.created = new Date();

    // Hoja Empresa
    const wsCompany = workbook.addWorksheet('Empresa');
    wsCompany.columns = [
      { header: 'Campo', key: 'campo', width: 32 },
      { header: 'Valor', key: 'valor', width: 56 }
    ];
    // Título
    wsCompany.mergeCells('A1:B1');
    wsCompany.getCell('A1').value = `AGORA - Reporte de empresa: ${empresa.nombre || empresa.razon_social || ''}`;
    wsCompany.getCell('A1').font = { size: 14, bold: true };
    wsCompany.getCell('A1').alignment = { horizontal: 'center' };

    // Añadir filas de companyInfo (empezando en fila 3 para separar título)
    let rowIndex = 3;
    companyInfo.forEach(row => {
      if (!row || row.length === 0) {
        rowIndex++;
        return;
      }
      wsCompany.addRow({ campo: row[0], valor: row[1] });
      rowIndex++;
    });

    // Estilos y bordes en Empresa
    wsCompany.eachRow({ includeEmpty: false }, function(row, rIdx) {
      row.eachCell(function(cell, cIdx) {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        if (rIdx === 3) { // header row where 'Campo' appears
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF6FF' } };
        }
      });
    });

    // Hoja Historial
    const wsHistory = workbook.addWorksheet('Historial');
    wsHistory.columns = [
      { header: 'N°', key: 'n', width: 6 },
      { header: 'Documento', key: 'documento', width: 36 },
      { header: 'Tipo', key: 'tipo', width: 24 },
      { header: 'Usuario', key: 'usuario', width: 24 },
      { header: 'Email usuario', key: 'email', width: 32 },
      { header: 'Fecha envío', key: 'fecha', width: 18 },
      { header: 'Estado', key: 'estado', width: 16 },
      { header: 'Subido por', key: 'subido', width: 22 }
    ];
    // Header style
    wsHistory.getRow(1).font = { bold: true };
    wsHistory.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF6FF' } };
    // Añadir filas
    historyRows.forEach(r => wsHistory.addRow([
      r['N°'], r['Documento'], r['Tipo'], r['Usuario'], r['Email usuario'], r['Fecha envío'], r['Estado'], r['Subido por']
    ]));
    // Bordes
    wsHistory.eachRow({ includeEmpty: false }, function(row) {
      row.eachCell(function(cell) {
        cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
      });
    });
    wsHistory.autoFilter = 'A1:H1';

    // Hoja Usuarios
    const wsUsers = workbook.addWorksheet('Usuarios');
    wsUsers.columns = [
      { header: 'Usuario', key: 'usuario', width: 30 },
      { header: 'Correo', key: 'correo', width: 32 },
      { header: 'Documentos subidos', key: 'subidos', width: 18 },
      { header: 'Documentos aprobados', key: 'aprobados', width: 18 },
      { header: 'Documentos pendientes', key: 'pendientes', width: 18 },
      { header: 'Última actividad', key: 'ultima', width: 18 }
    ];
    wsUsers.getRow(1).font = { bold: true };
    wsUsers.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF6FF' } };
    userRows.forEach(r => wsUsers.addRow([r['Usuario'], r['Correo'], r['Documentos subidos'], r['Documentos aprobados'], r['Documentos pendientes'], r['Última actividad']]));
    wsUsers.eachRow({ includeEmpty: false }, function(row) {
      row.eachCell(function(cell) {
        cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
      });
    });
    wsUsers.autoFilter = 'A1:F1';

    // Generar buffer y descargar
    const fileName = `${(empresa.nombre || empresa.razon_social || 'empresa').replace(/\s+/g, '_')}-reporte-${new Date().toISOString().slice(0,10)}.xlsx`;
    workbook.xlsx.writeBuffer().then(function(buffer) {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, fileName);
    }).catch(function(err) {
      console.error('Error generando xlsx:', err);
      alert('Error generando el archivo Excel. Revisa la consola.');
    });
}

window.descargarDocumento = async function (id, nombreArchivo) {
  if (!id) {
    return alert('No se encontró el documento para descargar.');
  }

  try {
    const res = await fetch(`http://localhost:3000/api/documentos/${id}/descargar`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      const message = error?.message || 'No se pudo descargar el documento.';
      return alert(message);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo || `documento-${id}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error descargando documento:', err);
    alert('Error al descargar el documento. Intenta nuevamente.');
  }
};

// ==============================
// INIT
// ==============================
document.addEventListener('DOMContentLoaded', async () => {
  await cargarEmpresaDetalle();
  await cargarPendientesEmpresa(empresaId);
});

