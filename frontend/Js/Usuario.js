// ==============================
// AUTH SIMPLE (SIN Auth.js)
// ==============================
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
  alert('Sesión expirada');
  window.location.href = 'http://localhost:3000';
}

if (!['usuario'].includes(user.rol)) {
  alert('No autorizado');
  window.location.href = 'http://localhost:3000/';
}

// Definir window.Auth para compatibilidad
window.Auth = {
  requireAuth: (roles) => {
    if (!roles.includes(user.rol)) {
      window.location.href = 'http://localhost:3000';
      return null;
    }
    return user;
  },
  apiFetch: async (url, options = {}) => {
    const fetchOptions = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`
      }
    };

    if (options.body) {
      fetchOptions.headers['Content-Type'] = 'application/json';
    }

    return fetch(`http://localhost:3000${url}`, fetchOptions);
  }
};

const authUser = window.Auth.requireAuth(['usuario']);
if (!authUser) {
  window.location.href = 'http://localhost:3000';
}

if (authUser && document.getElementById('userAvatar')) {
  document.getElementById('userAvatar').textContent = authUser.nombre
    ? authUser.nombre.charAt(0).toUpperCase()
    : authUser.email.charAt(0).toUpperCase();
}

const statusMessage = document.createElement('div');
statusMessage.id = 'usuarioStatusMessage';
statusMessage.style.margin = '10px 0';
statusMessage.style.color = '#334155';

function showStatus(text) {
  if (!document.getElementById('usuarioStatusMessage')) {
    const content = document.querySelector('.content');
    if (content) content.prepend(statusMessage);
  }
  statusMessage.textContent = text;
}

function uploadDocument(docType) {
  if (!authUser) return;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.doc,.docx,.jpg,.png';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const tipoId = prompt('Ingresa el ID del tipo de documento:');
    if (!tipoId) return;

    try {
      const response = await window.Auth.apiFetch('/api/documentos', {
        method: 'POST',
        body: JSON.stringify({
          tipo_documento_id: Number(tipoId),
          nombre_archivo: file.name,
          comentarios: `Carga desde UI: ${docType || 'manual'}`
        })
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.message || 'Error al subir documento');
        return;
      }

      alert(`Documento "${file.name}" subido. Queda en revisión.`);
      loadDocumentos();
    } catch (error) {
      console.error('Error al cargar documentos:', error);
      alert('Error al subir documento');
    }
  };

  input.click();
}

document.addEventListener('DOMContentLoaded', loadDocumentos);

async function loadDocumentos() {
  showStatus('Cargando documentos...');

  try {
    const asignadosResponse = await window.Auth.apiFetch('/api/documentos-requeridos/usuario/asignados');
    if (!asignadosResponse.ok) {
      const error = await asignadosResponse.json();
      throw new Error(error.message || 'Error al cargar documentos asignados');
    }

    const asignados = await asignadosResponse.json();
    const pendientes = asignados.filter(doc => doc.estado === 'pendiente');
    const completados = asignados.filter(doc => doc.estado === 'subido');
    const total = asignados.length;
    const progreso = total > 0 ? (completados.length / total) * 100 : 0;

    document.getElementById('kpiPendientes').textContent = pendientes.length;
    document.getElementById('kpiCompletados').textContent = completados.length;
    document.getElementById('kpiProgreso').textContent = Math.round(progreso) + '%';
    document.getElementById('progressFill').style.width = progreso + '%';
    document.getElementById('progressDetalle').textContent = `${completados.length} de ${total} documentos completados`;
    document.getElementById('badgePendientes').textContent = pendientes.length;

    const tablaPendientes = document.getElementById('tablaPendientes');
    tablaPendientes.innerHTML = '';

    if (pendientes.length === 0) {
      tablaPendientes.innerHTML = '<tr><td colspan="5">No hay documentos pendientes asignados.</td></tr>';
    } else {
      pendientes.forEach(doc => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${doc.nombre}</td>
          <td>${doc.frecuencia}</td>
          <td>${new Date(doc.fecha_limite).toLocaleDateString()}</td>
          <td><span class="badge badge-${doc.prioridad === 'alta' ? 'danger' : doc.prioridad === 'media' ? 'warning' : 'info'}">${doc.prioridad}</span></td>
          <td><button class="btn btn-sm btn-primary" onclick="uploadDocumentForPending(${doc.tipo_documento_id}, '${doc.nombre}')">Subir</button></td>
        `;
        tablaPendientes.appendChild(row);
      });
    }

    const subidosResponse = await window.Auth.apiFetch('/api/documentos');
    if (!subidosResponse.ok) {
      const error = await subidosResponse.json();
      throw new Error(error.message || 'Error al cargar historial de documentos');
    }

    const subidos = await subidosResponse.json();
    const tablaHistorial = document.getElementById('tablaHistorial');
    tablaHistorial.innerHTML = '';

    if (subidos.length === 0) {
      tablaHistorial.innerHTML = '<tr><td colspan="4">No hay documentos subidos aún.</td></tr>';
    } else {
      subidos.forEach(doc => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${doc.nombre_archivo}</td>
          <td>${new Date(doc.fecha_subida).toLocaleDateString()}</td>
          <td><span class="badge badge-${doc.estado === 'aprobado' ? 'success' : doc.estado === 'rechazado' ? 'danger' : 'warning'}">${doc.estado}</span></td>
          <td>${doc.validado_por || 'Pendiente'}</td>
        `;
        tablaHistorial.appendChild(row);
      });
    }

    if (pendientes.length > 0) {
      showStatus(`Tienes ${pendientes.length} documento(s) pendiente(s).`);
    } else {
      showStatus('No tienes documentos pendientes asignados.');
    }
  } catch (error) {
    console.error('Error cargando documentos:', error);
    showStatus('No se pudo cargar los documentos. Revisa la consola.');
  }
}

function uploadDocumentForPending(tipoDocumentoId, nombre) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.doc,.docx,.jpg,.png';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const response = await window.Auth.apiFetch('/api/documentos', {
        method: 'POST',
        body: JSON.stringify({
          tipo_documento_id: tipoDocumentoId,
          nombre_archivo: file.name,
          comentarios: `Subido desde dashboard usuario`
        })
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.message || 'Error al subir documento');
        return;
      }

      alert(`Documento "${file.name}" subido. Queda en revisión.`);
      loadDocumentos();
    } catch (error) {
      console.error('Error al subir documento:', error);
      alert('Error al subir documento');
    }
  };

  input.click();
}

