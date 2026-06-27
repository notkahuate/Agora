// ==============================
// AUTH SIMPLE (SIN Auth.js)
// ==============================
const token = window.Auth ? window.Auth.getToken() : localStorage.getItem('token');
let paginaHistorial = 1;
const limiteHistorial = 7;
let historialGlobal = [];
let auditorMapHistorial = new Map();
let actividadWidget = null;

function obtenerNombreValidador(documento) {
  if (!documento) return 'No disponible';
  if (documento.validado_por_nombre) return documento.validado_por_nombre;
  if (documento.auditor_nombre) return documento.auditor_nombre;
  if (documento.revisor_nombre) return documento.revisor_nombre;
  if (documento.validated_by_name) return documento.validated_by_name;
  if (documento.validator_name) return documento.validator_name;
  if (documento.auditor) return documento.auditor;
  if (documento.revisor) return documento.revisor;
  return 'No disponible';
}

function obtenerEstadoAsignado(documento) {
  return String(documento.estado_documento || documento.estado || documento.status || 'pendiente').toLowerCase();
}

function esDocumentoAprobado(documento) {
  return ['validado', 'revisado', 'aprobado'].includes(obtenerEstadoAsignado(documento));
}

function esDocumentoPendienteAccion(documento) {
  const estado = obtenerEstadoAsignado(documento);
  return estado === 'pendiente' || estado === 'rechazado';
}

function obtenerEstadoDocumentoVisual(documento) {
  const estado = obtenerEstadoAsignado(documento);
  if (['validado', 'revisado', 'aprobado'].includes(estado)) {
    return { clase: 'badge-success', texto: 'Validado' };
  }
  if (estado === 'rechazado') {
    return { clase: 'badge-danger', texto: 'Rechazado' };
  }
  if (estado === 'subido') {
    return { clase: 'badge-info', texto: 'Subido' };
  }
  return { clase: 'badge-warning', texto: 'Pendiente' };
}

function obtenerNombreValidadorDesdeMapa(doc, auditorMap) {
  if (!doc) return 'No disponible';
  if (doc.validado_por_nombre) return doc.validado_por_nombre;
  if (doc.validado_por && auditorMap.has(doc.validado_por)) {
    return auditorMap.get(doc.validado_por);
  }
  return obtenerNombreValidador(doc);
}

const user = window.Auth ? window.Auth.getUser() : null;

if (!token || !user) {
  window.location.replace('/');
}

if (!['usuario'].includes(user.rol)) {
  alert('No autorizado');
  window.location.replace('/');
}

if (user && document.getElementById('userAvatar')) {
  document.getElementById('userAvatar').textContent = user.nombre
    ? user.nombre.charAt(0).toUpperCase()
    : user.email.charAt(0).toUpperCase();
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
  if (!user) return;
  const tipoId = prompt('Ingresa el ID del tipo de documento:');
  if (!tipoId) return;
  uploadDocumentForPending(tipoId, docType || 'manual');
}

function reuploadRejectedDocument(tipoDocumentoId, nombre, docId = null) {
  const confirmar = confirm('Este documento fue rechazado. ¿Deseas volver a subirlo ahora?');
  if (!confirmar) return;
  uploadDocumentForPending(tipoDocumentoId, nombre, docId);
}

document.addEventListener('DOMContentLoaded', () => {
  loadDocumentos();
  initActividadUsuario();
});

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

    historialGlobal = subidos.filter(d => String(d.estado).toLowerCase() !== 'rechazado');
    paginaHistorial = 1;
    auditorMapHistorial = new Map();

    // Resolve auditor names for any validado_por ids
    const auditorIds = Array.from(new Set(subidos.map(s => s.validado_por).filter(Boolean)));
    const auditorMap = auditorMapHistorial;
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
      if (esDocumentoPendienteAccion(doc)) {
        pendientesMap.set(doc.tipo_documento_id || doc.id, Object.assign({}, doc, {
          id: doc.documento_subido_id || doc.id
        }));
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
    const completados = asignados.filter(esDocumentoAprobado);
    const enRevision = asignados.filter(doc => obtenerEstadoAsignado(doc) === 'subido');
    const total = asignados.length;
    const progreso = total > 0 ? Math.round((completados.length / total) * 100) : 0;

    document.getElementById('kpiPendientes').textContent = pendientes.length;
    document.getElementById('kpiCompletados').textContent = completados.length;
    document.getElementById('kpiProgreso').textContent = progreso + '%';
    document.getElementById('progressFill').style.width = progreso + '%';

    let detalleProgreso = total > 0
      ? `${completados.length} de ${total} documentos aprobados`
      : 'Sin documentos asignados';
    if (enRevision.length > 0) {
      detalleProgreso += ` (${enRevision.length} en revisión)`;
    }
    document.getElementById('progressDetalle').textContent = detalleProgreso;

    const kpiProgresoDetalle = document.getElementById('kpiProgresoDetalle');
    if (kpiProgresoDetalle) {
      kpiProgresoDetalle.textContent = progreso >= 100
        ? 'Cumplimiento completo'
        : progreso >= 80
        ? 'Buen avance'
        : progreso > 0
        ? 'En progreso'
        : 'Sin avance';
    }

    const kpiPendientesDetalle = document.getElementById('kpiPendientesDetalle');
    if (kpiPendientesDetalle) {
      kpiPendientesDetalle.textContent = pendientes.length === 0
        ? 'Al día'
        : `${pendientes.length} por gestionar`;
    }

    document.getElementById('badgePendientes').textContent = pendientes.length;

    const alertPendientes = document.getElementById('alertPendientes');
    if (alertPendientes) {
      alertPendientes.style.display = pendientes.length > 0 ? '' : 'none';
      if (pendientes.length > 0) {
        alertPendientes.innerHTML = `<strong>Atención:</strong> Tienes ${pendientes.length} documento(s) pendiente(s) por gestionar.`;
      }
    }

    const tablaPendientes = document.getElementById('tablaPendientes');
    tablaPendientes.innerHTML = '';

    if (pendientes.length === 0) {
      tablaPendientes.innerHTML = '<tr><td colspan="6">No hay documentos pendientes asignados.</td></tr>';
    } else {
      pendientes.forEach(doc => {
        const row = document.createElement('tr');
        const safeName = (doc.nombre || '').replace(/'/g, "\\'");
        const prioridadBadge = `<span class="badge badge-${doc.prioridad === 'alta' ? 'danger' : doc.prioridad === 'media' ? 'warning' : 'info'}">${doc.prioridad}</span>`;
        const fechaLimite = new Date(doc.fecha_limite).toLocaleDateString();
        const estadoRaw = String(doc.estado_documento || doc.estado || 'pendiente').toLowerCase();
        const estadoInfo = estadoRaw === 'rechazado'
          ? { clase: 'badge-danger', texto: 'Rechazado' }
          : obtenerEstadoDocumentoVisual(doc);
        const estadoBadge = `<span class="badge ${estadoInfo.clase}">${estadoInfo.texto}</span>`;
        const docSubidoId = doc.documento_subido_id || doc.id || null;
        const actionButton = estadoInfo.texto === 'Rechazado'
          ? `<button class="btn btn-sm btn-secondary" onclick="reuploadRejectedDocument(${doc.tipo_documento_id}, '${safeName}', ${docSubidoId || 'null'})">Volver a subir</button>`
          : `<button class="btn btn-sm btn-primary" onclick="uploadDocumentForPending(${doc.tipo_documento_id}, '${safeName}')">Subir</button>`;

        row.innerHTML = `
          <td>${doc.nombre}</td>
          <td>${doc.frecuencia || '-'}</td>
          <td>${fechaLimite}</td>
          <td>${estadoBadge}</td>
          <td>${prioridadBadge}</td>
          <td>${actionButton}</td>
        `;
        tablaPendientes.appendChild(row);
      });
    }

    // Render historial excluding rejected uploads so they don't clutter historial
    const tablaHistorial = document.getElementById('tablaHistorial');
    const historial = historialGlobal;
    if (historial.length === 0) {
      tablaHistorial.innerHTML = '<tr><td colspan="4">No hay documentos subidos aún.</td></tr>';
      document.getElementById('paginacionHistorial').innerHTML = '';
    } else {
      renderHistorial(historial, auditorMap);
    }

    if (pendientes.length > 0) {
      showStatus(`Tienes ${pendientes.length} documento(s) pendiente(s).`);
    } else {
      showStatus('No tienes documentos pendientes asignados.');
    }

    actividadWidget?.refrescarSilenciosa();
  } catch (error) {
    console.error('Error cargando documentos:', error);
    showStatus('No se pudo cargar los documentos. Revisa la consola.');
  }
}

function renderHistorial(historial, auditorMap) {
  const tablaHistorial = document.getElementById('tablaHistorial');
  const inicio = (paginaHistorial - 1) * limiteHistorial;
  const pagina = historial.slice(inicio, inicio + limiteHistorial);

  tablaHistorial.innerHTML = '';

  if (pagina.length === 0) {
    tablaHistorial.innerHTML = '<tr><td colspan="5">No hay documentos subidos aún.</td></tr>';
  } else {
    pagina.forEach(doc => {
      const row = document.createElement('tr');
      const estadoInfo = obtenerEstadoDocumentoVisual(doc);
      const estadoBadge = `<span class="badge ${estadoInfo.clase}">${estadoInfo.texto}</span>`;
      const validado = obtenerNombreValidadorDesdeMapa(doc, auditorMap) || '—';

      row.innerHTML = `
        <td>${doc.nombre_archivo || doc.nombre || 'Documento'}</td>
        <td>${doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
        <td>${estadoBadge}</td>
        <td>${validado}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="abrirPreviewUsuario('${doc.id}', '${String(doc.nombre_archivo || doc.nombre || 'Documento').replace(/'/g, "\\'")}')">Ver</button>
        </td>
      `;
      tablaHistorial.appendChild(row);
    });
  }

  renderPaginacionHistorial(historial.length);
}

function renderPaginacionHistorial(totalItems) {
  const container = document.getElementById('paginacionHistorial');
  if (!container) return;

  const totalPaginas = Math.max(1, Math.ceil(totalItems / limiteHistorial));
  if (totalItems <= limiteHistorial) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm" onclick="cambiarPaginaHistorial(-1)" ${paginaHistorial === 1 ? 'disabled' : ''}>⬅ Anterior</button>
    <span>Página ${paginaHistorial} de ${totalPaginas}</span>
    <button type="button" class="btn btn-secondary btn-sm" onclick="cambiarPaginaHistorial(1)" ${paginaHistorial === totalPaginas ? 'disabled' : ''}>Siguiente ➡</button>
  `;
}

window.cambiarPaginaHistorial = function (direccion) {
  const totalPaginas = Math.max(1, Math.ceil(historialGlobal.length / limiteHistorial));
  const nuevaPagina = Math.min(totalPaginas, Math.max(1, paginaHistorial + direccion));
  if (nuevaPagina === paginaHistorial) return;
  paginaHistorial = nuevaPagina;
  renderHistorial(historialGlobal, auditorMapHistorial);
};

function uploadDocumentForPending(tipoDocumentoId, nombre, reemplazaId = null) {
  if (!user) return;

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
      formData.append(
        'comentarios',
        reemplazaId ? `Re-subido tras rechazo: ${nombre}` : 'Subido desde dashboard usuario'
      );

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

function invalidarCacheActividad() {
  actividadWidget?.invalidarYRecargar();
}

function initActividadUsuario() {
  if (!window.ActividadReciente) return;
  actividadWidget = ActividadReciente.crearWidget({
    timelineId: 'timelineUsuario',
    paginacionId: 'paginacionActividadReciente',
    buildUrl: (limit) => {
      let url = `http://localhost:3000/api/auditoria?limit=${limit}&offset=0`;
      if (user?.empresa_id) url += `&empresa_id=${user.empresa_id}`;
      return url;
    },
    mensajeVacio: 'Sin eventos recientes'
  });
  actividadWidget.init();
}

window.reuploadRejectedDocument = reuploadRejectedDocument;
window.uploadDocumentForPending = uploadDocumentForPending;

window.abrirPreviewUsuario = function (id, nombre) {
  previewDocumento(id, nombre, {
    onDeleted: () => {
      invalidarCacheActividad();
      loadDocumentos();
    }
  });
};

