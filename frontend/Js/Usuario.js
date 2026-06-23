// ==============================
// AUTH SIMPLE (SIN Auth.js)
// ==============================
const token = window.Auth ? window.Auth.getToken() : localStorage.getItem('token');
let paginaHistorial = 1;
const limiteHistorial = 5;
let historialGlobal = [];
let auditorMapHistorial = new Map();

let actividadPagina = 1;
const limiteActividad = 5;
let actividadTotal = 0;
let actividadGlobal = [];
let actividadCargando = false;
let actividadInicializada = false;
const ACTIVIDAD_FETCH_LIMIT = 100;
let empresaMapActividad = {};

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

function obtenerEstadoDocumentoVisual(documento) {
  const estado = String(documento.estado_documento || documento.estado || documento.status || 'pendiente').toLowerCase();
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

document.addEventListener('DOMContentLoaded', () => {
  loadDocumentos();
  cargarActividadReciente(1, true);
  window.actividadRecienteInterval = setInterval(refrescarActividadSilenciosa, 15000);
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
      tablaPendientes.innerHTML = '<tr><td colspan="6">No hay documentos pendientes asignados.</td></tr>';
    } else {
      pendientes.forEach(doc => {
        const row = document.createElement('tr');
        const safeName = (doc.nombre || '').replace(/'/g, "\\'");
        const prioridadBadge = `<span class="badge badge-${doc.prioridad === 'alta' ? 'danger' : doc.prioridad === 'media' ? 'warning' : 'info'}">${doc.prioridad}</span>`;
        const fechaLimite = new Date(doc.fecha_limite).toLocaleDateString();
        const estadoInfo = obtenerEstadoDocumentoVisual(doc);
        const estadoBadge = `<span class="badge ${estadoInfo.clase}">${estadoInfo.texto}</span>`;
        const actionButton = estadoInfo.texto === 'Rechazado'
          ? `<button class="btn btn-sm btn-secondary" onclick="reuploadRejectedDocument(${doc.tipo_documento_id}, '${safeName}', ${doc.id || null})">Volver a subir</button>`
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

    refrescarActividadSilenciosa();
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
    tablaHistorial.innerHTML = '<tr><td colspan="4">No hay documentos subidos aún.</td></tr>';
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

async function fetchActividadGlobal(force = false) {
  if (!force && actividadGlobal.length) return actividadGlobal;
  if (actividadCargando) return actividadGlobal;

  actividadCargando = true;
  try {
    const headers = { Authorization: `Bearer ${token}` };
    let url = `http://localhost:3000/api/auditoria?limit=${ACTIVIDAD_FETCH_LIMIT}&offset=0`;
    if (user && user.empresa_id) {
      url += `&empresa_id=${user.empresa_id}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Error cargando actividad');
    const data = await res.json();
    actividadGlobal = data.eventos || [];
    actividadTotal = actividadGlobal.length;
    return actividadGlobal;
  } finally {
    actividadCargando = false;
  }
}

function renderActividadPagina() {
  const timeline = document.getElementById('timelineUsuario');
  if (!timeline) return;

  const inicio = (actividadPagina - 1) * limiteActividad;
  const eventos = actividadGlobal.slice(inicio, inicio + limiteActividad);

  if (!eventos.length) {
    timeline.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:16px;">Sin eventos recientes</p>';
    renderActividadPaginacion();
    return;
  }

  timeline.innerHTML = eventos.map(evento => {
    const fecha = new Date(evento.fecha_evento || Date.now());
    const fechaFormato = fecha.toLocaleString('es-ES', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const usuario = evento.usuario_nombre || 'Sistema';
    const titulo = evento.descripcion || `${evento.accion || 'Evento'} en ${evento.entidad || 'sistema'}`;
    const inicial = evento.accion ? evento.accion.charAt(0).toUpperCase() : 'E';

    return `
      <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #eee;">
        <div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#f3f4f6;color:#334155;flex-shrink:0;">${inicial}</div>
        <div>
          <div style="font-weight:600;">${titulo}</div>
          <div style="color:#64748b;font-size:12px;">${usuario} • ${fechaFormato}</div>
        </div>
      </div>
    `;
  }).join('');

  renderActividadPaginacion();
}

async function cargarActividadReciente(pagina = 1, forceFetch = false, silent = false) {
  const timeline = document.getElementById('timelineUsuario');
  if (!timeline) return;

  actividadPagina = Math.max(1, parseInt(pagina) || 1);

  try {
    const needsFetch = forceFetch || !actividadGlobal.length;
    if (needsFetch) {
      if (!silent && !actividadInicializada) {
        timeline.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:16px;">Cargando actividad...</p>';
      }
      await fetchActividadGlobal(true);
      actividadInicializada = true;
    }

    const totalPaginas = Math.max(1, Math.ceil(actividadGlobal.length / limiteActividad));
    actividadPagina = Math.min(actividadPagina, totalPaginas);
    actividadTotal = actividadGlobal.length;
    renderActividadPagina();
  } catch (error) {
    console.error('Error cargando actividad reciente:', error);
    if (!actividadInicializada) {
      timeline.innerHTML = '<p style="color:#f87171;text-align:center;padding:16px;">No se pudo cargar la actividad reciente.</p>';
    }
    renderActividadPaginacion();
  }
}

async function refrescarActividadSilenciosa() {
  if (actividadCargando) return;
  await cargarActividadReciente(actividadPagina, true, true);
}

function invalidarCacheActividad() {
  actividadGlobal = [];
}

function renderActividadPaginacion() {
  const container = document.getElementById('paginacionActividadReciente');
  if (!container) return;

  const total = actividadGlobal.length || actividadTotal;
  const totalPaginas = Math.max(1, Math.ceil(total / limiteActividad));
  if (total <= limiteActividad) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm" onclick="cambiarPaginaActividad(-1)" ${actividadPagina === 1 ? 'disabled' : ''}>⬅ Anterior</button>
    <span>Página ${actividadPagina} de ${totalPaginas}</span>
    <button type="button" class="btn btn-secondary btn-sm" onclick="cambiarPaginaActividad(1)" ${actividadPagina === totalPaginas ? 'disabled' : ''}>Siguiente ➡</button>
  `;
}

window.cambiarPaginaActividad = function (direccion) {
  const totalPaginas = Math.max(1, Math.ceil(actividadGlobal.length / limiteActividad));
  const nuevaPagina = Math.min(totalPaginas, Math.max(1, actividadPagina + direccion));
  if (nuevaPagina === actividadPagina) return;
  actividadPagina = nuevaPagina;
  renderActividadPagina();
};

