// ==============================
// CONFIG INICIAL
// ==============================
const token = window.Auth ? window.Auth.getToken() : localStorage.getItem('token');
const params = new URLSearchParams(window.location.search);
const empresaId = params.get('id');

let usuariosGlobal = [];
let paginaUsuarios = 1;

let subidosGlobal = [];
let paginaSubidos = 1;

let pendientesGlobal = [];
let paginaPendientes = 1;

let aprobadosGlobal = [];
let paginaAprobados = 1;

const LIMITE_PAGINA = 7;
const LIMITE_MODAL_DOCS = 6;

let modalDocsUsuarioId = null;
let modalDocsUsuarioPagina = 1;

let actividadWidget = null;

function renderPaginacionEmpresa(containerId, pagina, totalItems, callbackName, limite = LIMITE_PAGINA) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPaginas = Math.max(1, Math.ceil(totalItems / limite));
  if (totalItems <= limite) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm" onclick="${callbackName}(-1)" ${pagina === 1 ? 'disabled' : ''}>⬅ Anterior</button>
    <span>Página ${pagina} de ${totalPaginas}</span>
    <button type="button" class="btn btn-secondary btn-sm" onclick="${callbackName}(1)" ${pagina === totalPaginas ? 'disabled' : ''}>Siguiente ➡</button>
  `;
}

function estadoDocumentoBadge(estado) {
  const e = String(estado || 'pendiente').toLowerCase();
  if (['validado', 'revisado', 'aprobado'].includes(e)) {
    return { clase: 'badge-success', texto: 'Aprobado' };
  }
  if (e === 'rechazado') {
    return { clase: 'badge-danger', texto: 'Rechazado' };
  }
  if (e === 'subido') {
    return { clase: 'badge-info', texto: 'Subido' };
  }
  if (e === 'pendiente') {
    return { clase: 'badge-warning', texto: 'Pendiente' };
  }
  return { clase: 'badge-info', texto: estado || '—' };
}

function filaDocumentoSubido(doc) {
  const estado = estadoDocumentoBadge(doc.estado);
  const nombreArchivo = doc.nombre_archivo || 'Documento';
  const safeName = String(nombreArchivo).replace(/'/g, "\\'");

  return `
    <tr>
      <td>${nombreArchivo}</td>
      <td>${doc.tipo_documento_nombre || doc.tipo_documento_id || '-'}</td>
      <td>${doc.usuario_nombre || doc.usuario_id || '-'}</td>
      <td>${doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
      <td><span class="badge ${estado.clase}">${estado.texto}</span></td>
      <td>
        <button type="button" class="btn btn-sm btn-primary" onclick="abrirPreviewEmpresa('${doc.id}', '${safeName}')" style="margin-right:5px;">
          Ver
        </button>
        <button type="button" class="btn btn-sm btn-secondary btn-descargar-doc" data-descargar-id="${doc.id}" data-descargar-nombre="${encodeURIComponent(nombreArchivo)}">
          Descargar
        </button>
      </td>
    </tr>`;
}

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
    const res = await fetch(`/api/empresas/${empresaId}`, {
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
let documentosRequeridosGlobal = [];
let empresaData = null;

function esDocumentoCompletoEmpresa(doc) {
  if (doc.cumple_periodo_actual === true || doc.cumple_periodo_actual === 't') {
    return true;
  }
  const estado = String(doc.estado_documento || doc.estado || 'pendiente').toLowerCase();
  return ['validado', 'revisado', 'aprobado'].includes(estado);
}

async function cargarDocumentosRequeridosEmpresa() {
  try {
    const res = await fetch(`/api/documentos-requeridos/empresa/${empresaId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      documentosRequeridosGlobal = await res.json();
    } else {
      documentosRequeridosGlobal = [];
    }
    renderDocumentosAsignados();
  } catch (err) {
    console.error('Error cargando documentos requeridos:', err);
    documentosRequeridosGlobal = [];
    renderDocumentosAsignados();
  }
}

// ==============================
// CARGAR USUARIOS (EMPLEADOS)
// ==============================
async function loadUsuariosEmpresa() {
  const tablaUsuarios = document.getElementById('tablaUsuariosEmpresa');

  try {
    const res = await fetch('/api/usuarios', {
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

    // Cargar documentos requeridos (estado vigente por tipo) y subidos
    await cargarDocumentosRequeridosEmpresa();
    await cargarTodosLosDocumentos();

    renderUsuarios();

  } catch (err) {
    console.error("Error usuarios:", err);
  }
}

async function cargarTodosLosDocumentos() {
  try {
    const res = await fetch('/api/documentos', {
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
    const resResumen = await fetch(`/api/documentos-requeridos/empresa/${empresaId}/resumen`, {
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
  const docs = documentosRequeridosGlobal || [];

  if (!docs.length) {
    document.getElementById('badgeProgresoDocEmpresa').textContent = '0%';
    document.getElementById('barraProgresoDocEmpresa').style.width = '0%';
    document.getElementById('docsCompletadosEmpresa').textContent = '0';
    document.getElementById('docsTotalesEmpresa').textContent = '0';
    document.getElementById('docsValidadosEmpresa').textContent = '0';

    document.getElementById('badgeProgresoPersonasEmpresa').textContent = '0%';
    document.getElementById('barraProgresoPersonasEmpresa').style.width = '0%';
    document.getElementById('usuariosCompletosEmpresa').textContent = '0';
    document.getElementById('usuariosTotalesEmpresa').textContent = String(usuariosGlobal?.length || 0);
    document.getElementById('usuariosProgresoEmpresa').textContent = '0';
    return;
  }

  // ========== PROGRESO DE DOCUMENTACIÓN (último estado por tipo, sin rechazados obsoletos) ==========
  const totalDocs = docs.length;

  const docsCompletadosCount = docs.filter(esDocumentoCompletoEmpresa).length;

  const docsValidadosCount = docs.filter(d => {
    const estado = String(d.estado_documento || d.estado || 'pendiente').toLowerCase();
    return ['validado', 'revisado', 'aprobado'].includes(estado);
  }).length;

  const progresoDocs = totalDocs > 0 ? Math.round((docsCompletadosCount / totalDocs) * 100) : 0;

  document.getElementById('badgeProgresoDocEmpresa').textContent = progresoDocs + '%';
  document.getElementById('barraProgresoDocEmpresa').style.width = progresoDocs + '%';
  document.getElementById('docsCompletadosEmpresa').textContent = docsCompletadosCount;
  document.getElementById('docsTotalesEmpresa').textContent = totalDocs;
  document.getElementById('docsValidadosEmpresa').textContent = docsValidadosCount;

  // ========== PROGRESO DE PERSONAS (según documentos requeridos asignados) ==========
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

  const usuariosConAsignacion = usuariosGlobal.filter(usuario =>
    docs.some(d => String(d.responsable_id) === String(usuario.id))
  );

  usuariosConAsignacion.forEach(usuario => {
    const docsDelUsuario = docs.filter(d => String(d.responsable_id) === String(usuario.id));
    const docsCompletadosDelUsuario = docsDelUsuario.filter(esDocumentoCompletoEmpresa).length;
    const progresoUsuario = (docsCompletadosDelUsuario / docsDelUsuario.length) * 100;

    if (progresoUsuario === 100) {
      usuariosCompletosCount++;
    } else if (progresoUsuario > 0) {
      usuariosEnProgresoCount++;
    }
  });

  const totalUsuariosConDocs = usuariosConAsignacion.length;
  const progresoPersonas = totalUsuariosConDocs > 0
    ? Math.round((usuariosCompletosCount / totalUsuariosConDocs) * 100)
    : 0;

  document.getElementById('badgeProgresoPersonasEmpresa').textContent = progresoPersonas + '%';
  document.getElementById('barraProgresoPersonasEmpresa').style.width = progresoPersonas + '%';
  document.getElementById('usuariosCompletosEmpresa').textContent = usuariosCompletosCount;
  document.getElementById('usuariosTotalesEmpresa').textContent = totalUsuariosConDocs;
  document.getElementById('usuariosProgresoEmpresa').textContent = usuariosEnProgresoCount;
}

function obtenerDocsDelUsuario(usuarioId) {
  return (documentosGlobal || []).filter(d =>
    String(d.usuario_id) === String(usuarioId)
  );
}

function renderCellDocumentosUsuario(usuario) {
  const docs = obtenerDocsDelUsuario(usuario.id);
  const count = docs.length;

  if (!count) {
    return '<span class="usuario-docs-vacio">Sin documentos</span>';
  }

  const ultima = docs.reduce((max, d) => {
    const t = d.fecha_subida ? new Date(d.fecha_subida).getTime() : 0;
    return t > max ? t : max;
  }, 0);
  const ultimaStr = ultima
    ? new Date(ultima).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  return `
    <div class="usuario-docs-cell">
      <div class="usuario-docs-resumen">
        <span class="badge badge-info usuario-docs-count">${count} doc${count !== 1 ? 's' : ''}</span>
        <button type="button" class="btn btn-sm btn-secondary usuario-docs-btn-ver" onclick="abrirModalDocsUsuario(${usuario.id})">
          Ver
        </button>
      </div>
      <small class="usuario-docs-meta">Última subida: ${ultimaStr}</small>
    </div>`;
}

function renderModalDocsUsuario() {
  const tbody = document.getElementById('modalDocsUsuarioBody');
  if (!tbody || !modalDocsUsuarioId) return;

  const docs = obtenerDocsDelUsuario(modalDocsUsuarioId)
    .slice()
    .sort((a, b) => new Date(b.fecha_subida || 0) - new Date(a.fecha_subida || 0));

  const inicio = (modalDocsUsuarioPagina - 1) * LIMITE_MODAL_DOCS;
  const pagina = docs.slice(inicio, inicio + LIMITE_MODAL_DOCS);

  tbody.innerHTML = pagina.length
    ? pagina.map(d => {
        const estado = estadoDocumentoBadge(d.estado);
        const nombreArchivo = d.nombre_archivo || d.nombre || 'Documento';
        const safeName = String(nombreArchivo).replace(/'/g, "\\'");
        return `
          <tr>
            <td>${nombreArchivo}</td>
            <td>${d.tipo_documento_nombre || d.tipo_documento_id || '—'}</td>
            <td>${d.fecha_subida ? new Date(d.fecha_subida).toLocaleDateString() : '—'}</td>
            <td><span class="badge ${estado.clase}">${estado.texto}</span></td>
            <td class="usuario-docs-acciones">
              <button type="button" class="btn btn-sm btn-primary" onclick="abrirPreviewEmpresa('${d.id}', '${safeName}')">Ver</button>
              <button type="button" class="btn btn-sm btn-secondary btn-descargar-doc" data-descargar-id="${d.id}" data-descargar-nombre="${encodeURIComponent(nombreArchivo)}">Descargar</button>
            </td>
          </tr>`;
      }).join('')
    : '<tr><td colspan="5">Sin documentos</td></tr>';

  renderPaginacionEmpresa(
    'paginacionModalDocsUsuario',
    modalDocsUsuarioPagina,
    docs.length,
    'cambiarPaginaModalDocsUsuario',
    LIMITE_MODAL_DOCS
  );
}

window.abrirModalDocsUsuario = function (usuarioId) {
  modalDocsUsuarioId = usuarioId;
  modalDocsUsuarioPagina = 1;

  const usuario = usuariosGlobal.find(u => String(u.id) === String(usuarioId));
  const modal = document.getElementById('modalDocsUsuario');
  if (!modal) return;

  const docs = obtenerDocsDelUsuario(usuarioId);
  const titulo = document.getElementById('modalDocsUsuarioTitulo');
  const subtitulo = document.getElementById('modalDocsUsuarioSubtitulo');

  if (titulo) {
    titulo.textContent = `Documentos de ${usuario?.nombre || usuario?.email || 'usuario'}`;
  }
  if (subtitulo) {
    subtitulo.textContent = `${docs.length} documento(s) cargado(s)`;
  }

  renderModalDocsUsuario();
  modal.style.display = 'flex';
};

window.cerrarModalDocsUsuario = function () {
  const modal = document.getElementById('modalDocsUsuario');
  if (modal) modal.style.display = 'none';
  modalDocsUsuarioId = null;
};

window.cambiarPaginaModalDocsUsuario = function (direccion) {
  const docs = obtenerDocsDelUsuario(modalDocsUsuarioId);
  const totalPaginas = Math.max(1, Math.ceil(docs.length / LIMITE_MODAL_DOCS));
  modalDocsUsuarioPagina = Math.min(totalPaginas, Math.max(1, modalDocsUsuarioPagina + direccion));
  renderModalDocsUsuario();
};

function renderUsuarios() {
  const tablaUsuarios = document.getElementById('tablaUsuariosEmpresa');

  const inicio = (paginaUsuarios - 1) * LIMITE_PAGINA;
  const fin = inicio + LIMITE_PAGINA;

  const pagina = usuariosGlobal.slice(inicio, fin);

  tablaUsuarios.innerHTML = pagina.length
    ? pagina.map(u => {
        const docsDelUsuario = obtenerDocsDelUsuario(u.id);

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
            <td class="usuario-docs-col">${renderCellDocumentosUsuario(u)}</td>
            <td>${ultimaActividad}</td>
          </tr>
        `;
      }).join('')
    : `<tr><td colspan="6">Sin usuarios</td></tr>`;

  renderControlesUsuarios();
  actualizarBarrasProgresoEmpresa();
}

function renderControlesUsuarios() {
  renderPaginacionEmpresa('paginacionUsuarios', paginaUsuarios, usuariosGlobal.length, 'cambiarPaginaUsuarios');
}

window.cambiarPaginaUsuarios = function (direccion) {
  const totalPaginas = Math.max(1, Math.ceil(usuariosGlobal.length / LIMITE_PAGINA));
  paginaUsuarios = Math.min(totalPaginas, Math.max(1, paginaUsuarios + direccion));
  renderUsuarios();
};
// ==============================
// DOCUMENTOS (opcional)
// ==============================
async function loadDocumentosEmpresa() {
  try {
    const res = await fetch('/api/documentos', {
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

    const aprobados = empresaDocs.filter(d => ['validado', 'revisado', 'aprobado'].includes(String(d.estado || '').toLowerCase()));

    document.getElementById('statSubidos').textContent = empresaDocs.length;
    document.getElementById('statAprobados').textContent = aprobados.length;

    subidosGlobal = empresaDocs;
    aprobadosGlobal = aprobados;
    paginaSubidos = 1;
    paginaAprobados = 1;

    renderSubidos();
    renderAprobados();

    await cargarDocumentosRequeridosEmpresa();
    actualizarBarrasProgresoEmpresa();

  } catch (err) {
    console.error("Error documentos:", err);
  }
}

function renderSubidos() {
  const tablaSubidos = document.getElementById('tablaDocumentosSubidos');
  if (!tablaSubidos) return;

  const inicio = (paginaSubidos - 1) * LIMITE_PAGINA;
  const pagina = subidosGlobal.slice(inicio, inicio + LIMITE_PAGINA);

  tablaSubidos.innerHTML = pagina.length
    ? pagina.map(filaDocumentoSubido).join('')
    : `<tr><td colspan="6">Sin documentos</td></tr>`;

  renderPaginacionEmpresa('paginacionSubidos', paginaSubidos, subidosGlobal.length, 'cambiarPaginaSubidos');
}

window.cambiarPaginaSubidos = function (direccion) {
  const totalPaginas = Math.max(1, Math.ceil(subidosGlobal.length / LIMITE_PAGINA));
  paginaSubidos = Math.min(totalPaginas, Math.max(1, paginaSubidos + direccion));
  renderSubidos();
};

function renderAprobados() {
  const tablaAprobados = document.getElementById('tablaDocumentosAprobados');
  const inicio = (paginaAprobados - 1) * LIMITE_PAGINA;
  const pagina = aprobadosGlobal.slice(inicio, inicio + LIMITE_PAGINA);

  if (!tablaAprobados) return;

  tablaAprobados.innerHTML = pagina.length
    ? pagina.map(filaDocumentoSubido).join('')
    : `<tr><td colspan="6">No hay documentos aprobados</td></tr>`;

  renderControlesAprobados();
}

function renderControlesAprobados() {
  renderPaginacionEmpresa('paginacionAprobados', paginaAprobados, aprobadosGlobal.length, 'cambiarPaginaAprobados');
}

window.cambiarPaginaAprobados = function (direccion) {
  const totalPaginas = Math.max(1, Math.ceil(aprobadosGlobal.length / LIMITE_PAGINA));
  paginaAprobados = Math.min(totalPaginas, Math.max(1, paginaAprobados + direccion));
  renderAprobados();
};

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
    await cargarDocumentosRequeridosEmpresa();
    await cargarTodosLosDocumentos();
    renderUsuarios();
    actualizarBarrasProgresoEmpresa();
  }

  if (tabName === 'documentos-asignados') {
    await cargarDocumentosRequeridosEmpresa();
    await cargarTodosLosDocumentos();
    renderDocumentosAsignados();
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
    const res = await fetch(`/api/documentos-requeridos/empresa/${empresaId}/pendientes`, {
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

  const inicio = (paginaPendientes - 1) * LIMITE_PAGINA;
  const pagina = pendientesGlobal.slice(inicio, inicio + LIMITE_PAGINA);

  tbody.innerHTML = pagina.length
    ? pagina.map(doc => `
        <tr>
          <td>${doc.nombre}</td>
          <td>${doc.tipo_documento_id}</td>
          <td>${doc.frecuencia || '-'}</td>
          <td>${new Date(doc.fecha_limite).toLocaleDateString()}</td>
          <td>${doc.responsable_nombre || 'Sin asignar'}</td>
          <td>
            <span class="badge badge-${doc.prioridad === 'alta' ? 'danger' : doc.prioridad === 'media' ? 'warning' : 'info'}">
              ${doc.prioridad || '-'}
            </span>
          </td>
        </tr>
      `).join('')
    : `<tr><td colspan="6">Sin pendientes</td></tr>`;

  renderControlesPendientes();
}

function renderControlesPendientes() {
  renderPaginacionEmpresa('paginacionPendientes', paginaPendientes, pendientesGlobal.length, 'cambiarPaginaPendientes');
}

window.cambiarPaginaPendientes = function (direccion) {
  const totalPaginas = Math.max(1, Math.ceil(pendientesGlobal.length / LIMITE_PAGINA));
  paginaPendientes = Math.min(totalPaginas, Math.max(1, paginaPendientes + direccion));
  renderPendientes();
};

// ==============================
// DOCUMENTOS ASIGNADOS (árbol SG-SST)
// ==============================
const COLORES_CATEGORIA_SGSST = {
  '1': { color: '#2563eb', bg: '#eff6ff' },
  '2': { color: '#4f46e5', bg: '#eef2ff' },
  '3': { color: '#059669', bg: '#ecfdf5' },
  '4': { color: '#d97706', bg: '#fffbeb' },
  '5': { color: '#dc2626', bg: '#fef2f2' },
  '6': { color: '#7c3aed', bg: '#f5f3ff' },
  '7': { color: '#0891b2', bg: '#ecfeff' },
  otros: { color: '#64748b', bg: '#f8fafc' }
};

function obtenerCodigoDocumento(nombre) {
  const match = String(nombre || '').trim().match(/^(\d+(?:\.\d+)+)/);
  return match ? match[1] : null;
}

function obtenerTituloDocumento(nombre) {
  const text = String(nombre || '').trim();
  return text.replace(/^\d+(?:\.\d+)+\s*/, '') || text;
}

function calcularStatsGrupo(documentos) {
  const docs = Array.isArray(documentos) ? documentos : [];
  const completados = docs.filter(esDocumentoCompletoEmpresa).length;
  const total = docs.length;
  const porcentaje = total ? Math.round((completados / total) * 100) : 0;
  return { total, completados, pendientes: total - completados, porcentaje };
}

function claseEstadoDocumentoAsignado(estadoRaw) {
  const e = String(estadoRaw || 'pendiente').toLowerCase();
  if (['validado', 'revisado', 'aprobado'].includes(e)) return 'aprobado';
  if (e === 'subido') return 'subido';
  if (e === 'rechazado') return 'rechazado';
  return 'pendiente';
}

function agruparAsignadosPorSgsst(documentos) {
  if (!window.SgsstStructure) {
    return { categorias: [], sinCategoria: documentos || [] };
  }

  const { SG_SST_CATEGORIAS, obtenerSubseccionSgsst } = window.SgsstStructure;
  const docs = Array.isArray(documentos) ? documentos : [];
  const docsUsados = new Set();
  const categorias = [];

  SG_SST_CATEGORIAS.forEach(cat => {
    const subcategorias = [];

    cat.subcategorias.forEach(sub => {
      const docsSub = docs.filter(doc => {
        const nombre = doc.tipo_documento || doc.nombre || '';
        return obtenerSubseccionSgsst(nombre) === sub.id;
      });

      docsSub.forEach(d => docsUsados.add(String(d.id || d.tipo_documento_id)));

      if (docsSub.length) {
        subcategorias.push({ ...sub, documentos: docsSub, stats: calcularStatsGrupo(docsSub) });
      }
    });

    if (subcategorias.length) {
      const todosDocs = subcategorias.flatMap(s => s.documentos);
      categorias.push({ ...cat, subcategorias, stats: calcularStatsGrupo(todosDocs) });
    }
  });

  const sinCategoria = docs.filter(doc => !docsUsados.has(String(doc.id || doc.tipo_documento_id)));

  return { categorias, sinCategoria };
}

function obtenerHistorialPorTipo(tipoDocumentoId) {
  return (documentosGlobal || [])
    .filter(d => String(d.tipo_documento_id) === String(tipoDocumentoId))
    .sort((a, b) => {
      const ta = a.fecha_subida ? new Date(a.fecha_subida).getTime() : 0;
      const tb = b.fecha_subida ? new Date(b.fecha_subida).getTime() : 0;
      return tb - ta || (Number(b.id) - Number(a.id));
    });
}

function renderHistorialVersiones(doc, historial) {
  if (!historial.length) return '';

  const items = historial.map((version, index) => {
    const estado = estadoDocumentoBadge(version.estado);
    const fecha = version.fecha_subida
      ? new Date(version.fecha_subida).toLocaleDateString()
      : '-';
    const nombreArchivo = version.nombre_archivo || version.nombre || 'Documento';
    const safeName = String(nombreArchivo).replace(/'/g, "\\'");
    const esActual = String(version.id) === String(doc.documento_subido_id);

    return `
      <div class="doc-historial-item ${esActual ? 'is-actual' : ''}">
        <div class="doc-historial-info">
          <span class="doc-historial-label">${esActual ? 'Versión actual' : `Versión ${historial.length - index}`}</span>
          <strong>${nombreArchivo}</strong>
          <span class="doc-historial-meta">${fecha} · <span class="badge ${estado.clase}">${estado.texto}</span></span>
        </div>
        <div class="doc-historial-acciones">
          <button type="button" class="btn btn-sm btn-primary" onclick="abrirPreviewEmpresa('${version.id}', '${safeName}')">Ver</button>
          <button type="button" class="btn btn-sm btn-secondary btn-descargar-doc" data-descargar-id="${version.id}" data-descargar-nombre="${encodeURIComponent(nombreArchivo)}">Descargar</button>
        </div>
      </div>`;
  }).join('');

  return `
    <details class="doc-historial-panel">
      <summary>Historial de versiones (${historial.length})</summary>
      <div class="doc-historial-list">${items}</div>
    </details>`;
}

function filaDocumentoAsignado(doc) {
  const nombreCompleto = doc.tipo_documento || doc.nombre || 'Documento';
  const codigo = obtenerCodigoDocumento(nombreCompleto);
  const titulo = obtenerTituloDocumento(nombreCompleto);
  const estado = estadoDocumentoBadge(doc.estado_documento || doc.estado);
  const estadoClase = claseEstadoDocumentoAsignado(doc.estado_documento || doc.estado);
  const prioridad = String(doc.prioridad || 'media').toLowerCase();
  const prioridadClase = prioridad === 'alta' ? 'danger' : prioridad === 'media' ? 'warning' : 'info';
  const fechaLimite = doc.fecha_limite
    ? new Date(doc.fecha_limite).toLocaleDateString()
    : '-';
  const porcentaje = doc.porcentaje ? `${doc.porcentaje}%` : '-';
  const docSubidoId = doc.documento_subido_id;
  const safeName = String(nombreCompleto).replace(/'/g, "\\'");
  const searchText = `${nombreCompleto} ${doc.responsable_nombre || ''} ${doc.responsable_email || ''}`.toLowerCase().replace(/"/g, '');
  const frecuencia = doc.frecuencia ? String(doc.frecuencia) : '-';
  const historial = obtenerHistorialPorTipo(doc.tipo_documento_id);
  const periodoOk = doc.cumple_periodo_actual === true || doc.cumple_periodo_actual === 't';
  const periodoBadge = periodoOk
    ? '<span class="badge badge-success">Periodo al día</span>'
    : '<span class="badge badge-warning">Requiere entrega</span>';

  const acciones = docSubidoId
    ? `
      <button type="button" class="btn btn-sm btn-primary" onclick="abrirPreviewEmpresa('${docSubidoId}', '${safeName}')">Ver</button>
      <button type="button" class="btn btn-sm btn-secondary btn-descargar-doc" data-descargar-id="${docSubidoId}" data-descargar-nombre="${encodeURIComponent(nombreCompleto)}">Descargar</button>
    `
    : `<span class="doc-asignado-sin-subir"><i data-lucide="clock"></i> Pendiente de subir</span>`;

  return `
    <article class="doc-asignado-card doc-asignado-card--${estadoClase}" data-search="${searchText}">
      <div class="doc-asignado-status-bar"></div>
      <div class="doc-asignado-content">
        <div class="doc-asignado-header">
          <span class="doc-asignado-icon"><i data-lucide="file-text"></i></span>
          <div class="doc-asignado-header-main">
            ${codigo ? `<div class="doc-asignado-codigo">${codigo}</div>` : ''}
            <h4 class="doc-asignado-titulo">${titulo}</h4>
          </div>
          <span class="badge ${estado.clase}">${estado.texto}</span>
        </div>
        <div class="doc-asignado-detalles">
          <span class="doc-asignado-detalle"><i data-lucide="user"></i> ${doc.responsable_nombre || 'Sin asignar'}</span>
          <span class="doc-asignado-detalle"><i data-lucide="calendar"></i> Límite: ${fechaLimite}</span>
          <span class="doc-asignado-detalle"><i data-lucide="repeat"></i> Frecuencia: ${frecuencia}</span>
          <span class="doc-asignado-detalle"><i data-lucide="percent"></i> Peso: ${porcentaje}</span>
          <span class="doc-asignado-detalle"><i data-lucide="flag"></i> <span class="badge badge-${prioridadClase}">${doc.prioridad || 'media'}</span></span>
          <span class="doc-asignado-detalle">${periodoBadge}</span>
        </div>
        ${renderHistorialVersiones(doc, historial)}
      </div>
      <div class="doc-asignado-acciones">${acciones}</div>
    </article>`;
}

function renderKpisAsignados(docs) {
  const kpis = document.getElementById('kpisDocumentosAsignados');
  if (!kpis) return;

  if (!docs.length) {
    kpis.innerHTML = '';
    return;
  }

  const stats = calcularStatsGrupo(docs);
  let cumplimientoSgsst = stats.porcentaje;

  if (window.SgsstStructure) {
    const resultado = window.SgsstStructure.calcularCumplimientoSgsst(docs);
    cumplimientoSgsst = resultado?.porcentajeEmpresa ?? stats.porcentaje;
  }

  kpis.innerHTML = `
    <div class="asignados-kpi">
      <div class="asignados-kpi-label">Total asignados</div>
      <div class="asignados-kpi-value is-primary">${stats.total}</div>
    </div>
    <div class="asignados-kpi">
      <div class="asignados-kpi-label">Completados</div>
      <div class="asignados-kpi-value is-success">${stats.completados}</div>
    </div>
    <div class="asignados-kpi">
      <div class="asignados-kpi-label">Pendientes</div>
      <div class="asignados-kpi-value is-warning">${stats.pendientes}</div>
    </div>
    <div class="asignados-kpi">
      <div class="asignados-kpi-label">Avance SG-SST</div>
      <div class="asignados-kpi-value">${cumplimientoSgsst}%</div>
    </div>`;
}

function renderResumenCategoria(stats) {
  return `
    <div class="asignados-mini-stats">
      <span>${stats.completados}/${stats.total} docs</span>
      <div class="asignados-mini-bar" title="${stats.porcentaje}% completado">
        <div class="asignados-mini-bar-fill" style="width:${stats.porcentaje}%"></div>
      </div>
    </div>
    <span class="badge badge-info">${stats.total}</span>
    <span class="asignados-chevron"><i data-lucide="chevron-down"></i></span>`;
}

function renderBloqueSinCategoria(documentos) {
  if (!documentos.length) return '';

  const stats = calcularStatsGrupo(documentos);
  const tema = COLORES_CATEGORIA_SGSST.otros;
  const items = documentos.map(filaDocumentoAsignado).join('');

  return `
    <details class="asignados-categoria" style="--cat-color:${tema.color};--cat-bg:${tema.bg}">
      <summary class="asignados-summary">
        <span class="asignados-summary-left">
          <span class="asignados-cat-num">+</span>
          <span class="asignados-summary-text">
            <strong>Otros documentos</strong>
            <small>Sin categoría SG-SST</small>
          </span>
        </span>
        <span class="asignados-summary-right">
          ${renderResumenCategoria(stats)}
        </span>
      </summary>
      <div class="asignados-categoria-body">${items}</div>
    </details>`;
}

function renderDocumentosAsignados() {
  const container = document.getElementById('listaDocumentosAsignados');
  if (!container) return;

  const docs = documentosRequeridosGlobal || [];
  renderKpisAsignados(docs);

  const toolbar = document.querySelector('.asignados-toolbar');
  if (toolbar) toolbar.style.display = docs.length ? '' : 'none';

  if (!docs.length) {
    container.innerHTML = `
      <div class="asignados-empty">
        <div class="asignados-empty-icon"><i data-lucide="folder-open"></i></div>
        <strong>Sin documentos asignados</strong>
        <p>Esta empresa aún no tiene requisitos SG-SST asignados desde el panel de auditoría.</p>
      </div>`;
    refrescarIconosAsignados();
    return;
  }

  const { categorias, sinCategoria } = agruparAsignadosPorSgsst(docs);

  if (!categorias.length && !sinCategoria.length) {
    container.innerHTML = `
      <div class="asignados-empty">
        <div class="asignados-empty-icon"><i data-lucide="search-x"></i></div>
        <strong>No se encontraron documentos</strong>
        <p>Hubo un problema al agrupar los documentos asignados.</p>
      </div>`;
    refrescarIconosAsignados();
    return;
  }

  const htmlCategorias = categorias.map((cat, index) => {
    const tema = COLORES_CATEGORIA_SGSST[cat.id] || COLORES_CATEGORIA_SGSST.otros;
    const subsHtml = cat.subcategorias.map(sub => {
      const items = sub.documentos.map(filaDocumentoAsignado).join('');
      return `
        <details class="asignados-subcategoria">
          <summary class="asignados-sub-summary">
            <span class="asignados-sub-left">
              <span class="asignados-sub-id">${sub.id}</span>
              <span class="asignados-sub-text">
                <strong>${sub.nombre}</strong>
                <small>Peso ${sub.peso}% · ${sub.stats.completados}/${sub.stats.total} completados</small>
              </span>
            </span>
            <span class="asignados-summary-right">
              ${renderResumenCategoria(sub.stats)}
            </span>
          </summary>
          <div class="asignados-subcategoria-body">${items}</div>
        </details>`;
    }).join('');

    return `
      <details class="asignados-categoria" ${index === 0 ? 'open' : ''} style="--cat-color:${tema.color};--cat-bg:${tema.bg}">
        <summary class="asignados-summary">
          <span class="asignados-summary-left">
            <span class="asignados-cat-num">${cat.id}</span>
            <span class="asignados-summary-text">
              <strong>${cat.nombre}</strong>
              <small>Peso regulación ${cat.peso}% · ${cat.stats.completados}/${cat.stats.total} completados</small>
            </span>
          </span>
          <span class="asignados-summary-right">
            ${renderResumenCategoria(cat.stats)}
          </span>
        </summary>
        <div class="asignados-categoria-body">${subsHtml}</div>
      </details>`;
  }).join('');

  container.innerHTML = htmlCategorias + renderBloqueSinCategoria(sinCategoria);
  refrescarIconosAsignados();
  filtrarDocumentosAsignados(document.getElementById('buscarDocumentosAsignados')?.value || '');
}

function refrescarIconosAsignados() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function filtrarDocumentosAsignados(termino) {
  const container = document.getElementById('listaDocumentosAsignados');
  if (!container) return;

  const query = String(termino || '').trim().toLowerCase();
  const cards = container.querySelectorAll('.doc-asignado-card');
  let visibles = 0;

  cards.forEach(card => {
    const match = !query || (card.dataset.search || '').includes(query);
    card.classList.toggle('is-hidden', !match);
    if (match) visibles += 1;
  });

  container.querySelectorAll('.asignados-subcategoria').forEach(sub => {
    const tieneVisibles = Array.from(sub.querySelectorAll('.doc-asignado-card')).some(c => !c.classList.contains('is-hidden'));
    sub.classList.toggle('is-filtered-hidden', query.length > 0 && !tieneVisibles);
  });

  container.querySelectorAll('.asignados-categoria').forEach(cat => {
    const tieneVisibles = Array.from(cat.querySelectorAll('.doc-asignado-card')).some(c => !c.classList.contains('is-hidden'));
    cat.classList.toggle('is-filtered-hidden', query.length > 0 && !tieneVisibles);
  });

  let msg = container.querySelector('.asignados-no-resultados');
  if (query && visibles === 0) {
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'asignados-no-resultados';
      container.appendChild(msg);
    }
    msg.textContent = `No se encontraron documentos para "${termino.trim()}".`;
    msg.style.display = '';
  } else if (msg) {
    msg.style.display = 'none';
  }
}

function initControlesAsignados() {
  const input = document.getElementById('buscarDocumentosAsignados');
  const btnExpandir = document.getElementById('btnExpandirAsignados');
  const btnColapsar = document.getElementById('btnColapsarAsignados');
  const container = document.getElementById('listaDocumentosAsignados');

  input?.addEventListener('input', (e) => filtrarDocumentosAsignados(e.target.value));

  btnExpandir?.addEventListener('click', () => {
    container?.querySelectorAll('details').forEach(d => { d.open = true; });
  });

  btnColapsar?.addEventListener('click', () => {
    container?.querySelectorAll('details').forEach(d => { d.open = false; });
  });
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

window.abrirPreviewEmpresa = function (id, nombre) {
  previewDocumento(id, nombre, {
    onDeleted: async () => {
      await cargarDocumentosRequeridosEmpresa();
      loadDocumentosEmpresa();
      actualizarBarrasProgresoEmpresa();
      renderDocumentosAsignados();
      invalidarCacheActividadEmpresa();
      if (typeof cargarPendientesEmpresa === 'function') cargarPendientesEmpresa(empresaId);
    }
  });
};

window.descargarDocumento = async function (id, nombreArchivo) {
  if (!id) {
    return alert('No se encontró el documento para descargar.');
  }

  try {
    const res = await fetch(`/api/documentos/${id}/descargar`, {
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
// ACTIVIDAD RECIENTE (EMPRESA)
// ==============================
function invalidarCacheActividadEmpresa() {
  actividadWidget?.refrescarSilenciosa();
}

function initActividadEmpresa() {
  if (!window.ActividadReciente || !empresaId) return;
  actividadWidget = ActividadReciente.crearWidget({
    timelineId: 'timelineEmpresa',
    paginacionId: 'paginacionActividadEmpresa',
    limite: 7,
    buildUrl: (limit) => ActividadReciente.buildAuditoriaUrl(limit, { empresaId }),
    mensajeVacio: 'Sin actividad registrada para esta empresa'
  });
  actividadWidget.init();
}

// ==============================
// INIT
// ==============================
document.addEventListener('DOMContentLoaded', async () => {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-descargar-doc');
    if (!btn) return;
    const id = btn.dataset.descargarId;
    const nombre = decodeURIComponent(btn.dataset.descargarNombre || 'Documento');
    descargarDocumento(id, nombre);
  });

  await cargarEmpresaDetalle();
  await cargarPendientesEmpresa(empresaId);
  initControlesAsignados();
  initActividadEmpresa();
});

