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
  const tipoId = prompt('Ingresa el ID del tipo de documento:');
  if (!tipoId) return;
  uploadDocumentGeneric(tipoId, `Carga desde UI: ${docType || 'manual'}`, null);
}

function uploadDocumentGeneric(tipoDocumentoId, comentarios, reemplazaId = null) {
  if (!authUser) return;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.doc,.docx,.jpg,.png,.xls,.xlsx';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('tipo_documento_id', tipoDocumentoId);
      formData.append('comentarios', comentarios || 'Subido desde UI');
      if (reemplazaId) formData.append('reemplaza_id', reemplazaId);

      const response = await fetch('http://localhost:3000/api/documentos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.message || 'Error al subir documento');
        return;
      }

      alert(`Documento "${file.name}" subido exitosamente. Queda en revisión.`);
      loadDocumentos();
    } catch (error) {
      console.error('Error al subir documento:', error);
      alert('Error al subir documento');
    }
  };

  input.click();
}

function reuploadRejectedDocument(tipoDocumentoId, nombre, docId = null) {
  const confirmar = confirm('Este documento fue rechazado. ¿Deseas volver a subirlo ahora?');
  if (!confirmar) return;
  uploadDocumentGeneric(tipoDocumentoId, `Re-subido tras rechazo: ${nombre}`, docId);
}

document.addEventListener('DOMContentLoaded', loadDocumentos);

async function loadDocumentos() {
  showStatus('Cargando documentos...');

  try {
    // Fetch both assigned requirements and uploaded documents in parallel
    const [asignadosResponse, subidosResponse] = await Promise.all([
      window.Auth.apiFetch('/api/documentos-requeridos/usuario/asignados'),
      window.Auth.apiFetch('/api/documentos')
    ]);

    if (!asignadosResponse.ok) {
      const error = await asignadosResponse.json();
      throw new Error(error.message || 'Error al cargar documentos asignados');
    }
    if (!subidosResponse.ok) {
      const error = await subidosResponse.json();
      throw new Error(error.message || 'Error al cargar historial de documentos');
    }

    const asignados = await asignadosResponse.json();
    const subidos = await subidosResponse.json();

    // Resolve auditor names for any validado_por ids
    const auditorIds = Array.from(new Set(subidos.map(s => s.validado_por).filter(Boolean)));
    const auditorMap = new Map();
    if (auditorIds.length > 0) {
      await Promise.all(auditorIds.map(async id => {
        try {
          const res = await window.Auth.apiFetch(`/api/usuarios/${id}`);
          if (res.ok) {
            const userData = await res.json();
            auditorMap.set(id, userData.nombre || userData.email || `#${id}`);
          } else {
            auditorMap.set(id, `#${id}`);
          }
        } catch (e) {
          auditorMap.set(id, `#${id}`);
        }
      }));
    }

    // Start with assigned pendientes (include rejected)
    const pendientesMap = new Map();
    asignados.forEach(doc => {
      if (doc.estado === 'pendiente' || doc.estado === 'rechazado') {
        pendientesMap.set(doc.tipo_documento_id || doc.id, Object.assign({}, doc));
      }
    });

    // Add rejected uploads into pendientes so user sees them in the pendientes table
    // Only keep the latest upload per tipo_documento_id, otherwise a previously rejected file may remain after re-upload.
    const latestUploadsByTipo = new Map();
    subidos.forEach(d => {
      const tipo = d.tipo_documento_id || d.id;
      const timestamp = d.fecha_subida ? new Date(d.fecha_subida).getTime() : 0;
      const prev = latestUploadsByTipo.get(tipo);
      if (!prev || timestamp > prev.timestamp || (timestamp === prev.timestamp && d.id > prev.doc.id)) {
        latestUploadsByTipo.set(tipo, { doc: d, timestamp });
      }
    });

    const rejectedUploads = Array.from(latestUploadsByTipo.values())
      .map(entry => entry.doc)
      .filter(d => String(d.estado).toLowerCase() === 'rechazado');

    rejectedUploads.forEach(d => {
      const key = d.tipo_documento_id || d.id;
      if (!pendientesMap.has(key)) {
        pendientesMap.set(key, {
          nombre: d.nombre_archivo || d.nombre || 'Documento rechazado',
          frecuencia: d.frecuencia || '-',
          fecha_limite: d.fecha_limite || d.fecha_subida || new Date().toISOString(),
          prioridad: d.prioridad || 'media',
          estado: 'rechazado',
          tipo_documento_id: d.tipo_documento_id,
          id: d.id
        });
      }
    });

    const pendientes = Array.from(pendientesMap.values());
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
        const safeName = (doc.nombre || '').replace(/'/g, "\\'");
        const prioridadBadge = `<span class="badge badge-${doc.prioridad === 'alta' ? 'danger' : doc.prioridad === 'media' ? 'warning' : 'info'}">${doc.prioridad}</span>`;
        const fechaLimite = new Date(doc.fecha_limite).toLocaleDateString();
        const estadoLabel = doc.estado === 'rechazado' ? `<span class="badge badge-danger">rechazado</span>` : '';
        const actionButton = doc.estado === 'rechazado'
          ? `<button class="btn btn-sm btn-secondary" onclick="reuploadRejectedDocument(${doc.tipo_documento_id}, '${safeName}', ${doc.id || null})">Volver a subir</button>`
          : `<button class="btn btn-sm btn-primary" onclick="uploadDocumentForPending(${doc.tipo_documento_id}, '${safeName}')">Subir</button>`;

        row.innerHTML = `
          <td>${doc.nombre} ${estadoLabel}</td>
          <td>${doc.frecuencia || '-'}</td>
          <td>${fechaLimite}</td>
          <td>${prioridadBadge}</td>
          <td>${actionButton}</td>
        `;
        tablaPendientes.appendChild(row);
      });
    }

    // Render historial excluding rejected uploads so they don't clutter historial
    const tablaHistorial = document.getElementById('tablaHistorial');
    tablaHistorial.innerHTML = '';
    const historial = subidos.filter(d => d.estado !== 'rechazado');
    if (historial.length === 0) {
      tablaHistorial.innerHTML = '<tr><td colspan="4">No hay documentos subidos aún.</td></tr>';
    } else {
      historial.forEach(doc => {
        const row = document.createElement('tr');
        const estadoBadge = `<span class="badge badge-${doc.estado === 'aprobado' ? 'success' : 'warning'}">${doc.estado}</span>`;
        const validado = doc.validado_por ? (auditorMap.get(doc.validado_por) || `#${doc.validado_por}`) : 'Pendiente';

        row.innerHTML = `
          <td>${doc.nombre_archivo}</td>
          <td>${new Date(doc.fecha_subida).toLocaleDateString()}</td>
          <td>${estadoBadge}</td>
          <td>${validado}</td>
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
  input.accept = '.pdf,.doc,.docx,.jpg,.png,.xls,.xlsx';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('tipo_documento_id', tipoDocumentoId);
      formData.append('comentarios', `Subido desde dashboard usuario`);

      const response = await fetch('http://localhost:3000/api/documentos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.message || 'Error al subir documento');
        return;
      }

      alert(`Documento "${file.name}" subido exitosamente. Queda en revisión.`);
      loadDocumentos();
    } catch (error) {
      console.error('Error al subir documento:', error);
      alert('Error al subir documento');
    }
  };

  input.click();
}

