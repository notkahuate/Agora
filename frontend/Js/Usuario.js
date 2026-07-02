// ==============================
// AUTH SIMPLE (SIN Auth.js)
// ==============================
const token = window.Auth ? window.Auth.getToken() : localStorage.getItem('token');
let paginaHistorial = 1;
const limiteHistorial = 7;
let historialGlobal = [];
let auditorMapHistorial = new Map();
const observacionesRechazoMap = new Map();
let actividadWidget = null;
let ultimoEstadoDocumentos = new Map();
let intervaloActualizacionUsuario = null;

function mostrarToastUsuario({ titulo, mensaje, tipo = 'success', variante = null }) {
  let contenedor = document.getElementById('toastUsuario');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'toastUsuario';
    contenedor.className = 'toast-stack toast-stack-user hidden';
    contenedor.setAttribute('aria-live', 'polite');
    document.body.appendChild(contenedor);
  }

  const presets = {
    upload: {
      accent: 'is-upload',
      icon: 'upload-cloud',
      badge: 'En revisión'
    },
    success: {
      accent: 'is-success',
      icon: 'check-circle-2',
      badge: null
    },
    error: {
      accent: 'is-error',
      icon: 'alert-circle',
      badge: null
    },
    info: {
      accent: 'is-info',
      icon: 'info',
      badge: null
    }
  };

  const preset = presets[variante || tipo] || presets.success;
  const badgeHtml = preset.badge
    ? `<span class="toast-badge">${escaparTexto(preset.badge)}</span>`
    : '';

  const toast = document.createElement('div');
  toast.className = `toast-card ${preset.accent}`;
  toast.innerHTML = `
    <div class="toast-accent" aria-hidden="true"></div>
    <div class="toast-icon-wrap" aria-hidden="true">
      <i data-lucide="${preset.icon}" class="toast-lucide-icon"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title-row">
        <div class="toast-title">${escaparTexto(titulo)}</div>
        ${badgeHtml}
      </div>
      <div class="toast-message">${escaparTexto(mensaje)}</div>
    </div>
    <button type="button" class="toast-close" aria-label="Cerrar notificación">&times;</button>
    <div class="toast-progress" aria-hidden="true"><span></span></div>
  `;

  const cerrarToast = () => {
    toast.classList.add('is-hiding');
    setTimeout(() => {
      toast.remove();
      if (!contenedor.querySelector('.toast-card')) {
        contenedor.classList.remove('show');
        contenedor.classList.add('hidden');
      }
    }, 280);
  };

  toast.querySelector('.toast-close')?.addEventListener('click', cerrarToast);

  contenedor.appendChild(toast);
  contenedor.classList.remove('hidden');
  requestAnimationFrame(() => {
    contenedor.classList.add('show');
    toast.querySelector('.toast-progress span')?.classList.add('is-running');
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ nodes: [toast] });
  }

  const duracion = tipo === 'error' ? 5200 : 4500;
  const timer = setTimeout(cerrarToast, duracion);
  toast.addEventListener('mouseenter', () => clearTimeout(timer), { once: true });
}

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

function escaparTexto(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function esDocumentoAprobado(documento) {
  if (documento.cumple_periodo_actual === true || documento.cumple_periodo_actual === 't') {
    return true;
  }
  return ['validado', 'revisado', 'aprobado'].includes(obtenerEstadoAsignado(documento));
}

function esDocumentoPendienteAccion(documento) {
  const estado = obtenerEstadoAsignado(documento);
  if (documento.cumple_periodo_actual === true || documento.cumple_periodo_actual === 't') return false;
  if (['validado', 'revisado', 'aprobado'].includes(estado)) return false;
  return estado === 'pendiente' || estado === 'rechazado' || estado === 'subido' || !documento.cumple_periodo_actual;
}

function puedeAgregarMasArchivos(documento) {
  const estado = obtenerEstadoAsignado(documento);
  return estado === 'subido' && !esDocumentoAprobado(documento);
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

function crearModalObservacionRechazo() {
  if (document.getElementById('modalObservacionRechazo')) return;

  const modal = document.createElement('div');
  modal.id = 'modalObservacionRechazo';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:420px;">
      <span id="cerrarModalObservacion" style="float:right;cursor:pointer;font-size:20px;">&times;</span>
      <h3 style="margin-top:6px;">Observación de rechazo</h3>
      <p id="modalObservacionRechazoTexto" style="margin-top:12px;line-height:1.5;color:#334155;white-space:pre-wrap;"></p>
    </div>
  `;

  document.body.appendChild(modal);
  const cerrar = document.getElementById('cerrarModalObservacion');
  cerrar.addEventListener('click', cerrarModalObservacionRechazo);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      cerrarModalObservacionRechazo();
    }
  });
}

function abrirModalObservacionRechazo(texto) {
  crearModalObservacionRechazo();
  const modal = document.getElementById('modalObservacionRechazo');
  const contenido = document.getElementById('modalObservacionRechazoTexto');
  if (!modal || !contenido) return;
  const mensaje = String(texto || '').trim() || 'No se registró una observación.';
  contenido.textContent = mensaje;
  modal.style.display = 'block';
}

function cerrarModalObservacionRechazo() {
  const modal = document.getElementById('modalObservacionRechazo');
  if (modal) modal.style.display = 'none';
}

function registrarObservacionRechazo(docId, texto) {
  if (!docId) return;
  observacionesRechazoMap.set(String(docId), String(texto || '').trim());
}

function sincronizarObservacionesRechazo(documentos) {
  observacionesRechazoMap.clear();
  (documentos || []).forEach((doc) => {
    if (obtenerEstadoAsignado(doc) !== 'rechazado') return;
    const docId = doc.id || doc.documento_subido_id;
    if (!docId) return;
    registrarObservacionRechazo(docId, doc.comentarios || doc.comentario || '');
  });
}

function botonVerObservacionRechazo(doc) {
  if (obtenerEstadoAsignado(doc) !== 'rechazado') return '';
  const docId = doc.documento_subido_id || doc.id;
  if (!docId) return '';
  registrarObservacionRechazo(docId, doc.comentarios || doc.comentario || observacionesRechazoMap.get(String(docId)) || '');
  return `<button type="button" class="btn btn-sm btn-secondary" onclick="abrirModalObservacionRechazoPorId('${docId}')">Ver observación</button>`;
}

function abrirModalObservacionRechazoPorId(docId) {
  const texto = observacionesRechazoMap.get(String(docId)) || 'No se registró una observación.';
  abrirModalObservacionRechazo(texto);
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
  throw new Error('AGORA: sin sesión');
}

if (!['usuario'].includes(user.rol)) {
  alert('No autorizado');
  window.location.replace('/');
  throw new Error('AGORA: rol no autorizado');
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

  if (intervaloActualizacionUsuario) {
    clearInterval(intervaloActualizacionUsuario);
  }
  intervaloActualizacionUsuario = setInterval(() => loadDocumentos(true), 15000);
});

async function loadDocumentos(silent = false) {
  if (!silent) {
    showStatus('Cargando documentos...');
  }

  try {
    // Fetch both assigned requirements and uploaded documents in parallel
    const [asignadosResponse, subidosResponse] = await Promise.all([
      window.Auth.apiFetch('/api/documentos-requeridos/usuario/asignados'),
      window.Auth.apiFetch('/api/documentos')
    ]);

    if (!asignadosResponse.ok) {
      const error = await asignadosResponse.json().catch(() => ({}));
      throw new Error(error.message || error.error || 'Error al cargar documentos asignados');
    }
    if (!subidosResponse.ok) {
      const error = await subidosResponse.json().catch(() => ({}));
      throw new Error(error.message || error.error || 'Error al cargar historial de documentos');
    }

    const asignados = await asignadosResponse.json();
    const subidos = await subidosResponse.json();

    const cambiosEstado = [];
    subidos.forEach(doc => {
      const key = String(doc.id || doc.documento_subido_id || doc.tipo_documento_id || 'doc');
      const estadoActual = String(doc.estado_documento || doc.estado || 'pendiente').toLowerCase();
      const estadoAnterior = ultimoEstadoDocumentos.get(key);
      if (estadoAnterior && estadoAnterior !== estadoActual && ['revisado', 'aprobado', 'validado', 'rechazado'].includes(estadoActual)) {
        cambiosEstado.push({
          id: key,
          nombre: doc.nombre_archivo || doc.nombre || 'Documento',
          estado: estadoActual
        });
      }
      ultimoEstadoDocumentos.set(key, estadoActual);
    });

    if (cambiosEstado.length && !silent) {
      const cambio = cambiosEstado[cambiosEstado.length - 1];
      mostrarToastUsuario({
        titulo: cambio.estado === 'rechazado' ? 'Documento rechazado' : 'Documento aprobado',
        mensaje: `${cambio.nombre} ahora está ${cambio.estado === 'rechazado' ? 'rechazado' : 'aprobado'}.`,
        tipo: cambio.estado === 'rechazado' ? 'error' : 'success'
      });
    }

    historialGlobal = subidos.slice().sort((a, b) => {
      const ta = a.fecha_subida ? new Date(a.fecha_subida).getTime() : 0;
      const tb = b.fecha_subida ? new Date(b.fecha_subida).getTime() : 0;
      return tb - ta || (b.id - a.id);
    });
    paginaHistorial = 1;
    auditorMapHistorial = new Map();
    sincronizarObservacionesRechazo(subidos);

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
      pendientesMap.set(key, {
        nombre: d.nombre_archivo || d.nombre || 'Documento rechazado',
        frecuencia: d.frecuencia || '-',
        fecha_limite: d.fecha_limite || d.fecha_subida || new Date().toISOString(),
        prioridad: d.prioridad || 'media',
        estado: 'rechazado',
        estado_documento: 'rechazado',
        tipo_documento_id: d.tipo_documento_id,
        id: d.id,
        documento_subido_id: d.id,
        comentarios: d.comentarios || null
      });
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
        const archivosPeriodo = parseInt(doc.archivos_periodo, 10) || 0;
        const estadoInfo = estadoRaw === 'rechazado'
          ? { clase: 'badge-danger', texto: 'Rechazado' }
          : obtenerEstadoDocumentoVisual(doc);
        const estadoBadge = `<span class="badge ${estadoInfo.clase}">${estadoInfo.texto}</span>`;
        const archivosInfo = archivosPeriodo > 0
          ? `<span class="doc-cell-meta">${archivosPeriodo} archivo(s) en este periodo</span>`
          : '';
        const comentarioHtml = '';
        const docSubidoId = doc.documento_subido_id || doc.id || null;
        const observacionButton = botonVerObservacionRechazo(doc);
        let actionButton;
        if (estadoInfo.texto === 'Rechazado') {
          actionButton = `<button class="btn btn-sm btn-secondary" onclick="reuploadRejectedDocument(${doc.tipo_documento_id}, '${safeName}', ${docSubidoId || 'null'})">Volver a subir</button>`;
        } else if (puedeAgregarMasArchivos(doc)) {
          actionButton = `<button class="btn btn-sm btn-primary" onclick="uploadDocumentForPending(${doc.tipo_documento_id}, '${safeName}')">Agregar archivos</button>`;
        } else {
          actionButton = `<button class="btn btn-sm btn-primary" onclick="uploadDocumentForPending(${doc.tipo_documento_id}, '${safeName}')">Subir archivos</button>`;
        }

        row.innerHTML = `
          <td>
            <div class="doc-cell-info">
              <span class="doc-cell-title">${escaparTexto(doc.nombre)}</span>
              ${archivosInfo}
            </div>
          </td>
          <td>${escaparTexto(doc.frecuencia || '-')}</td>
          <td>${fechaLimite}</td>
          <td>${estadoBadge}${comentarioHtml}</td>
          <td>${prioridadBadge}</td>
          <td class="table-actions-cell">
            <div class="table-actions">
              ${observacionButton ? `${observacionButton} ` : ''}${actionButton}
            </div>
          </td>
        `;
        tablaPendientes.appendChild(row);
      });
    }

    // Render historial con todas las versiones (incluye rechazados y periodos anteriores)
    const tablaHistorial = document.getElementById('tablaHistorial');
    const historial = historialGlobal;
    const badgeHistorial = document.getElementById('badgeHistorial');
    if (badgeHistorial) badgeHistorial.textContent = historial.length;

    if (historial.length === 0) {
      tablaHistorial.innerHTML = '<tr class="table-empty-row"><td colspan="5">No hay documentos subidos aún.</td></tr>';
      document.getElementById('paginacionHistorial').innerHTML = '';
    } else {
      renderHistorial(historial, auditorMapHistorial);
    }

    if (!silent) {
      if (pendientes.length > 0) {
        showStatus(`Tienes ${pendientes.length} documento(s) pendiente(s).`);
      } else {
        showStatus('No tienes documentos pendientes asignados.');
      }
    }
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
    tablaHistorial.innerHTML = '<tr class="table-empty-row"><td colspan="5">No hay documentos subidos aún.</td></tr>';
  } else {
    pagina.forEach(doc => {
      const row = document.createElement('tr');
      const estadoInfo = obtenerEstadoDocumentoVisual(doc);
      const estadoBadge = `<span class="badge ${estadoInfo.clase}">${estadoInfo.texto}</span>`;
      const validado = escaparTexto(obtenerNombreValidadorDesdeMapa(doc, auditorMap) || '—');
      const nombreDoc = escaparTexto(doc.tipo_documento_nombre || doc.nombre_archivo || doc.nombre || 'Documento');
      const archivo = escaparTexto(doc.nombre_archivo || doc.nombre || 'Documento');
      const safeName = String(doc.nombre_archivo || doc.nombre || 'Documento').replace(/'/g, "\\'");
      const observacionButton = botonVerObservacionRechazo(doc);
      const fechaSubida = doc.fecha_subida
        ? new Date(doc.fecha_subida).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

      row.innerHTML = `
        <td>
          <div class="doc-cell-info">
            <span class="doc-cell-title">${nombreDoc}</span>
            <span class="doc-cell-meta">${archivo}</span>
          </div>
        </td>
        <td>${fechaSubida}</td>
        <td>${estadoBadge}</td>
        <td>${validado}</td>
        <td class="table-actions-cell">
          <div class="table-actions">
            ${observacionButton ? `${observacionButton} ` : ''}<button type="button" class="btn btn-sm btn-primary" onclick="abrirPreviewUsuario('${doc.id}', '${safeName}')">Ver</button>
            <button type="button" class="btn btn-sm btn-secondary" onclick="descargarDocumentoUsuario('${doc.id}', '${safeName}')">Descargar</button>
          </div>
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
  input.multiple = true;
  input.accept = '.pdf,.doc,.docx,.jpg,.png,.xls,.xlsx';

  input.onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const prevStatus = statusMessage.textContent || '';
    showStatus(files.length > 1
      ? `Subiendo ${files.length} archivos...`
      : 'Subiendo documento...');

    try {
      let response;
      let data;

      if (files.length === 1) {
        const formData = new FormData();
        formData.append('archivo', files[0]);
        formData.append('tipo_documento_id', tipoDocumentoId);
        formData.append(
          'comentarios',
          reemplazaId ? `Re-subido tras rechazo: ${nombre}` : 'Subido desde dashboard usuario'
        );

        response = await fetch('/api/documentos', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        data = await response.json();
      } else {
        const formData = new FormData();
        files.forEach(file => formData.append('archivos', file));
        formData.append('tipo_documento_id', tipoDocumentoId);
        formData.append(
          'comentarios',
          reemplazaId
            ? `Re-subidos ${files.length} archivos tras rechazo: ${nombre}`
            : `Subidos ${files.length} archivos desde dashboard usuario`
        );

        response = await fetch('/api/documentos/lote', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        data = await response.json();
      }

      if (!response.ok) {
        mostrarToastUsuario({
          titulo: 'No se pudo subir',
          mensaje: data.message || data.error || 'Ocurrió un error al subir el documento. Intenta nuevamente.',
          tipo: 'error'
        });
        if (prevStatus) showStatus(prevStatus);
        return;
      }

      const totalSubidos = data.total || 1;
      const nombres = files.length === 1
        ? files[0].name
        : files.map(f => f.name).slice(0, 3).join(', ') + (files.length > 3 ? ` (+${files.length - 3} más)` : '');

      mostrarToastUsuario({
        titulo: totalSubidos > 1 ? '¡Archivos subidos!' : '¡Documento subido!',
        mensaje: totalSubidos > 1
          ? `Se cargaron ${totalSubidos} archivos para "${nombre}". El equipo de auditoría los revisará pronto.`
          : `"${nombres}" se cargó correctamente. El equipo de auditoría lo revisará pronto.`,
        tipo: 'success',
        variante: 'upload'
      });
      loadDocumentos(true);
      actividadWidget?.refrescarSilenciosa();
    } catch (error) {
      console.error('Error al subir documento:', error);
      mostrarToastUsuario({
        titulo: 'Error de conexión',
        mensaje: 'No se pudo subir el documento. Revisa tu conexión e intenta de nuevo.',
        tipo: 'error'
      });
      if (prevStatus) showStatus(prevStatus);
    }
  };

  input.click();
}

function invalidarCacheActividad() {
  actividadWidget?.refrescarSilenciosa();
}

function initActividadUsuario() {
  if (!window.ActividadReciente) return;
  actividadWidget = ActividadReciente.crearWidget({
    timelineId: 'timelineUsuario',
    paginacionId: 'paginacionActividadReciente',
    buildUrl: (limit) => ActividadReciente.buildAuditoriaUrl(limit),
    mensajeVacio: 'Sin eventos recientes'
  });
  actividadWidget.init();
}

window.reuploadRejectedDocument = reuploadRejectedDocument;
window.uploadDocumentForPending = uploadDocumentForPending;
window.abrirModalObservacionRechazo = abrirModalObservacionRechazo;
window.abrirModalObservacionRechazoPorId = abrirModalObservacionRechazoPorId;

window.abrirPreviewUsuario = function (id, nombre) {
  previewDocumento(id, nombre, {
    onDeleted: () => {
      invalidarCacheActividad();
      loadDocumentos();
    }
  });
};

window.descargarDocumentoUsuario = async function (id, nombreArchivo) {
  if (!id) return alert('No se encontró el documento para descargar.');

  try {
    const res = await window.Auth.apiFetch(`/api/documentos/${id}/descargar`);
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      return alert(error?.message || 'No se pudo descargar el documento.');
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
    alert('Error al descargar el documento.');
  }
};

