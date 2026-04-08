// ==============================
// CONFIG INICIAL
// ==============================
const token = localStorage.getItem('token');
const params = new URLSearchParams(window.location.search);
const empresaId = params.get('id');

// ==============================
// VALIDACIÓN BÁSICA
// ==============================
if (!token) {
  alert("Sesión expirada");
  window.location.href = "http://localhost:3000";
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

    document.getElementById('empresaFecha').textContent =
      e.createdAt
        ? new Date(e.createdAt).toLocaleDateString()
        : e.fecha_creacion
        ? new Date(e.fecha_creacion).toLocaleDateString()
        : '-';

    document.getElementById('empresaEstado').textContent =
      e.activa ? 'Activa' : 'Inactiva';

    // 🔥 cargar usuarios (esto llena empleados)
    await loadUsuariosEmpresa();

    // 🔥 cargar documentos (opcional si ya lo tienes)
    await loadDocumentosEmpresa();

  } catch (err) {
    console.error(err);
    alert("Error de conexión");
  }
}

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
      tablaUsuarios.innerHTML = `<tr><td colspan="6">Error cargando usuarios</td></tr>`;
      return;
    }

    const usuarios = Array.isArray(data) ? data : [];

    const usuariosEmpresa = usuarios.filter(u =>
      String(u.empresa_id) === String(empresaId)
    );

    // 🔥 AQUÍ SE CALCULA EMPLEADOS REAL
    document.getElementById('empresaEmpleados').textContent =
      usuariosEmpresa.length;

    // 🔥 TABLA
    tablaUsuarios.innerHTML = usuariosEmpresa.length
      ? usuariosEmpresa.map(u => `
          <tr>
            <td>${u.nombre || u.email}</td>
            <td>${u.email || '-'}</td>
            <td>${u.rol || '-'}</td>
            <td>-</td>
            <td>-</td>
            <td>
              <span class="badge ${u.activo ? 'badge-success' : 'badge-warning'}">
                ${u.activo ? 'Activo' : 'Inactivo'}
              </span>
            </td>
          </tr>
        `).join('')
      : `<tr><td colspan="6">Sin usuarios</td></tr>`;

  } catch (err) {
    console.error("Error usuarios:", err);
  }
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

    const aprobados = empresaDocs.filter(d => d.estado === 'validado');
    const pendientes = empresaDocs.filter(d => d.estado !== 'validado');

    const total = empresaDocs.length;
    const cumplimiento = total
      ? Math.round((aprobados.length / total) * 100)
      : 0;

    document.getElementById('statSubidos').textContent = total;
    document.getElementById('statPendientes').textContent = pendientes.length;
    document.getElementById('statAprobados').textContent = aprobados.length;
    document.getElementById('statCumplimiento').textContent =
      total ? `${cumplimiento}%` : '-';

    if (tablaSubidos) {
      tablaSubidos.innerHTML = empresaDocs.length
        ? empresaDocs.map(doc => `
            <tr>
              <td>${doc.nombre_archivo || 'Documento'}</td>
              <td>${doc.tipo_documento_id || '-'}</td>
              <td>${doc.usuario_id || '-'}</td>
              <td>${doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
              <td>${doc.estado}</td>
              <td><button class="btn btn-secondary">Ver</button></td>
            </tr>
          `).join('')
        : `<tr><td colspan="6">Sin documentos</td></tr>`;
    }

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

// ==============================
// TABS
// ==============================
function switchTab(tabName, evt) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('is-active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  if (evt?.currentTarget) evt.currentTarget.classList.add('is-active');

  const panel = document.getElementById(`tab-${tabName}`);
  if (panel) panel.classList.add('active');
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

    const tbody = document.getElementById('tablaDocumentosPendientes');
    tbody.innerHTML = '';

    document.getElementById('statPendientes').textContent = data.length;

    data.forEach(doc => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${doc.nombre}</td>
        <td>${doc.tipo_documento_id}</td>
        <td>${doc.mes || 'N/A'} / ${doc.anio}</td>
        <td>${new Date(doc.fecha_limite).toLocaleDateString()}</td>
        <td>Empresa</td>
        <td>
          <span class="badge badge-${doc.prioridad === 'alta' ? 'danger' : doc.prioridad === 'media' ? 'warning' : 'info'}">
            ${doc.prioridad}
          </span>
        </td>
      `;

      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error('Error cargando pendientes:', error);
  }
}

// ==============================
// INIT
// ==============================
document.addEventListener('DOMContentLoaded', async () => {
  await cargarEmpresaDetalle();
  await cargarPendientesEmpresa(empresaId);
});

