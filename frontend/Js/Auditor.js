// ==============================
// AUTH (Auth.js valida sesión con backend)
// ==============================
const token = window.Auth ? window.Auth.getToken() : localStorage.getItem('token');
const user = window.Auth ? window.Auth.getUser() : null;
let actividadWidget = null;

let historialGlobal = [];
let paginaHistorial = 1;
const limiteHistorial = 7;
let historialCargando = false;

function cerrarToastAuditor() {
  const toast = document.getElementById('toastAuditor');
  if (!toast) return;

  clearTimeout(mostrarToast._timer);
  toast.classList.remove('show');
  toast.classList.add('hidden');
}

function mostrarToast(input, tipo = 'success') {
  const toast = document.getElementById('toastAuditor');
  if (!toast) return;

  let titulo;
  let mensaje;
  let type = tipo;

  if (typeof input === 'object' && input !== null) {
    titulo = input.titulo;
    mensaje = input.mensaje || '';
    type = input.tipo || 'success';
  } else {
    mensaje = String(input || '');
  }

  const presets = {
    success: {
      titulo: 'Operación exitosa',
      icon: '✓',
      accent: 'is-success'
    },
    error: {
      titulo: 'No se pudo completar',
      icon: '!',
      accent: 'is-error'
    }
  };

  const preset = presets[type] || presets.success;
  const tituloFinal = titulo || preset.titulo;

  toast.innerHTML = `
    <div class="toast-card ${preset.accent}">
      <div class="toast-accent" aria-hidden="true"></div>
      <div class="toast-icon-wrap" aria-hidden="true">
        <span class="toast-icon">${preset.icon}</span>
      </div>
      <div class="toast-content">
        <div class="toast-title">${tituloFinal}</div>
        <div class="toast-message">${mensaje}</div>
      </div>
      <button type="button" class="toast-close" aria-label="Cerrar notificación">&times;</button>
      <div class="toast-progress" aria-hidden="true"><span></span></div>
    </div>
  `;

  toast.querySelector('.toast-close')?.addEventListener('click', cerrarToastAuditor);

  toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('show'));

  clearTimeout(mostrarToast._timer);
  mostrarToast._timer = setTimeout(cerrarToastAuditor, 4200);
}

if (!token || !user) {
  window.location.replace('/');
}

if (!['auditor', 'super_admin'].includes(user.rol)) {
  alert('No autorizado');
  window.location.replace('/');
}

// ==============================
// AVATAR
// ==============================
const avatar = document.getElementById('userAvatar');
if (avatar) {
  avatar.textContent = (user.nombre || user.email)
    .charAt(0)
    .toUpperCase();
}

// ==============================
// TABS (para el HTML)
// ==============================
window.switchTab = function (tabName, evt) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('is-active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  if (evt?.currentTarget) evt.currentTarget.classList.add('is-active');

  const panel = document.getElementById(`tab-${tabName}`);
  if (panel) panel.classList.add('active');

  // Cargar datos según el tab
  if (tabName === 'documentos') {
    cargarDocumentos();
  } else if (tabName === 'historial') {
    cargarHistorial();
  }
};

// ==============================
// CARGAR EMPRESAS (TU ENDPOINT)
// ==============================
async function cargarEmpresas() {
  const kpiEmpresas = document.getElementById('kpiEmpresas');
  const kpiEmpresasDetalle = document.getElementById('kpiEmpresasDetalle');
  const listaRiesgo = document.getElementById('listaEmpresasRiesgo');
  const badgeRiesgo = document.getElementById('badgeEmpresasRiesgo');
  const tablaEmpresas = document.getElementById('tablaEmpresas');

  try {
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const [empresasRes, usuariosRes] = await Promise.all([
      fetch('http://localhost:3000/api/empresas', { headers }),
      fetch('http://localhost:3000/api/usuarios', { headers })
    ]);

    const empresas = await empresasRes.json();
    const usuarios = await usuariosRes.json();
    window.allUsuarios = usuarios;
    window.empresasData = empresas;

    let totalPendientesGlobal = 0;
    let totalDocsGlobal = 0;
    let totalEnviadosGlobal = 0;

    tablaEmpresas.innerHTML = '';
    const empresasRiesgo = [];

    // 🔥 recorrer empresas
    for (const e of empresas) {

      const resPend = await fetch(
        `http://localhost:3000/api/documentos-requeridos/empresa/${e.id}/pendientes`,
        { headers }
      );

      const pendientesEmpresa = await resPend.json();
      const totalPendientes = pendientesEmpresa.length;

      totalPendientesGlobal += totalPendientes;

      // 👤 usuarios
      const usuariosEmpresa = usuarios.filter(u =>
        String(u.empresa_id) === String(e.id)
      );

      // ==============================
      // 🔥 CUMPLIMIENTO
      // ==============================
      const resResumen = await fetch(
        `http://localhost:3000/api/documentos-requeridos/empresa/${e.id}/resumen`,
        { headers }
      );

      const resumen = await resResumen.json();

      const totalDocs = parseInt(resumen.total) || 0;
      const enviados = parseInt(resumen.enviados) || 0;

      const cumplimiento = totalDocs === 0
        ? null
        : Math.round((enviados / totalDocs) * 100);

      if (totalDocs > 0) {
        totalDocsGlobal += totalDocs;
        totalEnviadosGlobal += enviados;
      }

      // ==============================
      // 🚨 RIESGO (solo si hay pendientes reales)
      // ==============================
      const enRiesgo = totalDocs > 0 && totalPendientes > 0 && cumplimiento < 70;

      if (enRiesgo) {
        empresasRiesgo.push({
          nombre: e.nombre,
          pendientes: totalPendientes
        });
      }

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${e.nombre}</td>

        <td>${e.sector || '-'}</td>

        <td>${usuariosEmpresa.length}</td>

        <td>
          <span class="badge ${totalPendientes > 0 ? 'badge-warning' : 'badge-success'}">
            ${totalPendientes}
          </span>
        </td>

        <td>
          ${cumplimiento === null
            ? '<small>—</small>'
            : `<div class="progress-bar">
                <div class="progress-fill" style="width:${cumplimiento}%"></div>
              </div>
              <small>${cumplimiento}%</small>`}
        </td>

        <td>
          <span class="badge ${enRiesgo ? 'badge-danger' : 'badge-success'}">
            ${enRiesgo ? 'En riesgo' : 'Estable'}
          </span>
        </td>

        <td>
          <button class="btn btn-primary" onclick="abrirModalAsignarDocumentos(${e.id}, '${String(e.nombre).replace(/'/g, "\\'")}')">
            Asignar
          </button>
          <button class="btn btn-secondary" onclick="abrirModalCrearUsuario(${e.id}, '${String(e.nombre).replace(/'/g, "\\'")}')">
            Crear usuario
          </button>
          <button class="btn btn-secondary" onclick="verEmpresa('${e.id}')">
            Ver
          </button>
        </td>
      `;

      tablaEmpresas.appendChild(tr);
    }

   
    // ==============================
    // 🔥 KPI GLOBAL
    // ==============================
    kpiEmpresas.textContent = empresas.length;
    kpiEmpresasDetalle.textContent = `${empresas.length} registradas`;

    document.getElementById('kpiPendientes').textContent = totalPendientesGlobal;

    // 🔥 CUMPLIMIENTO GLOBAL (solo empresas con documentos asignados)
    const promedioCumplimiento = totalDocsGlobal
      ? Math.round((totalEnviadosGlobal / totalDocsGlobal) * 100)
      : 0;

    document.getElementById('kpiCumplimiento').textContent = `${promedioCumplimiento}%`;

    document.getElementById('kpiCumplimientoDetalle').textContent =
      promedioCumplimiento >= 80
        ? 'Buen nivel'
        : promedioCumplimiento >= 60
        ? 'Nivel medio'
        : 'Nivel crítico';

    // ==============================
    // 🔥 REVISADOS DEL MES
    // ==============================
    try {
      const resRevisados = await fetch('http://localhost:3000/api/documentos/revisados-mes', { headers });
      const dataRevisados = await resRevisados.json();
      document.getElementById('kpiRevisados').textContent = dataRevisados.count;
    } catch (err) {
      console.error('Error cargando revisados del mes:', err);
      document.getElementById('kpiRevisados').textContent = '0';
    }

    // ==============================
    // 🚨 EMPRESAS EN RIESGO
    // ==============================
    badgeRiesgo.textContent = empresasRiesgo.length;

    listaRiesgo.innerHTML = empresasRiesgo.length
      ? empresasRiesgo
          .sort((a, b) => b.pendientes - a.pendientes)
          .slice(0, 5)
          .map(e => `
            <div class="list-item">
              <span>${e.nombre}</span>
              <span class="badge badge-danger">
                ${e.pendientes} pendientes
              </span>
            </div>
          `).join('')
      : `<div class="list-item"><span>Sin riesgo</span></div>`;

  } catch (err) {
    console.error('Error cargando dashboard:', err);
  }
}

let selectedEmpresaId = null;
let selectedEmpresaNombre = '';

function verEmpresa(id) {
  window.location.href = `/Empresa_Detalles.html?id=${id}`;
}

function cerrarModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

function abrirModalCrearEmpresa() {
  selectedEmpresaId = null;
  document.getElementById('empresaNombre').value = '';
  document.getElementById('empresaRut').value = '';
  document.getElementById('empresaSector').value = '';
  document.getElementById('empresaUbicacion').value = '';
  document.getElementById('empresaEmail').value = '';
  document.getElementById('empresaTelefono').value = '';
  document.getElementById('modalCrearEmpresa').style.display = 'flex';
}

async function crearEmpresa() {
  const nombre = document.getElementById('empresaNombre').value.trim();
  const rut = document.getElementById('empresaRut').value.trim();
  const sector = document.getElementById('empresaSector').value.trim();
  const ubicacion = document.getElementById('empresaUbicacion').value.trim();
  const email = document.getElementById('empresaEmail').value.trim();
  const telefono = document.getElementById('empresaTelefono').value.trim();

  if (!nombre || !rut) {
    return alert('Nombre y RUT son obligatorios.');
  }

  try {
    const res = await fetch('http://localhost:3000/api/empresas', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre, rut, sector, ubicacion, email, telefono })
    });

    if (!res.ok) {
      const error = await res.json();
      return alert(error.message || 'Error creando la empresa');
    }

    alert('Empresa creada correctamente');
    cerrarModal('modalCrearEmpresa');
    cargarEmpresas();
    cargarColaPrioritaria();
    invalidarCacheActividad();
  } catch (err) {
    console.error('Error creando empresa:', err);
    alert('Error creando empresa');
  }
}

function abrirModalCrearUsuario(empresaId, empresaNombre) {
  selectedEmpresaId = empresaId;
  selectedEmpresaNombre = empresaNombre;
  document.getElementById('usuarioEmpresaNombre').textContent = `Empresa: ${empresaNombre}`;
  document.getElementById('usuarioNombre').value = '';
  document.getElementById('usuarioEmail').value = '';
  document.getElementById('usuarioPassword').value = '';

  document.getElementById('usuarioRoleGroup').style.display = 'block';
  document.getElementById('usuarioRol').value = 'usuario';

  document.getElementById('modalCrearUsuario').style.display = 'flex';
}

async function crearUsuario() {
  const nombre = document.getElementById('usuarioNombre').value.trim();
  const email = document.getElementById('usuarioEmail').value.trim();
  const password = document.getElementById('usuarioPassword').value.trim();
  const rolInput = document.getElementById('usuarioRol');
  const rol = rolInput ? rolInput.value : 'usuario';

  if (!selectedEmpresaId) {
    return alert('Selecciona una empresa primero.');
  }
  if (!nombre || !email || !password) {
    return alert('Nombre, email y contraseña son obligatorios.');
  }
  if (password.length < 6) {
    return alert('La contraseña debe tener al menos 6 caracteres.');
  }

  try {
    const res = await fetch('http://localhost:3000/api/usuarios', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre, email, password, rol, empresa_id: selectedEmpresaId })
    });

    const data = await res.json();
    if (!res.ok) {
      return alert(window.Auth.parseApiError(data) || 'Error creando usuario');
    }

    alert('Usuario creado correctamente');
    cerrarModal('modalCrearUsuario');
    cargarEmpresas();
    cargarColaPrioritaria();
    invalidarCacheActividad();
  } catch (err) {
    console.error('Error creando usuario:', err);
    alert('Error creando usuario');
  }
}

function obtenerSeccion(nombre) {
  const text = String(nombre || '').trim();
  const match = text.match(/^(\d+)(?:\.\d+)*\b/);
  return match ? match[1] : 'Otros';
}

function agruparDocumentosPorSeccion(documentos) {
  return documentos.reduce((grupos, doc) => {
    const seccion = obtenerSeccion(doc.nombre || doc.tipo_documento || 'Otros');
    grupos[seccion] = grupos[seccion] || [];
    grupos[seccion].push(doc);
    return grupos;
  }, {});
}

async function abrirModalAsignarDocumentos(empresaId, empresaNombre) {
  selectedEmpresaId = Number(empresaId);
  selectedEmpresaNombre = String(empresaNombre || '').trim();
  document.getElementById('asignarDocsTitulo').textContent = `Empresa: ${selectedEmpresaNombre}`;
  const fechaLimiteInput = document.getElementById('asignarFechaLimite');
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 30);
  fechaLimiteInput.value = defaultDate.toISOString().split('T')[0];
  document.getElementById('asignarPrioridad').value = 'media';
  document.getElementById('asignarDocsBody').innerHTML = '<p>Cargando documentos disponibles...</p>';
  document.getElementById('modalAsignarDocumentos').style.display = 'flex';

  try {
    const headers = { 'Authorization': `Bearer ${token}` };
    const [tiposRes, docsEmpresaRes] = await Promise.all([
      fetch('http://localhost:3000/api/tipos-documentos', { headers }),
      fetch(`http://localhost:3000/api/documentos-requeridos/empresa/${empresaId}`, { headers })
    ]);

    if (!tiposRes.ok) {
      const error = await tiposRes.json().catch(() => ({}));
      throw new Error(error.message || 'Error cargando tipos de documentos');
    }
    if (!docsEmpresaRes.ok) {
      const error = await docsEmpresaRes.json().catch(() => ({}));
      throw new Error(error.message || 'Error cargando documentos de la empresa');
    }

    const tipos = await tiposRes.json();
    const docsEmpresa = await docsEmpresaRes.json();
    const tiposAsignados = new Set(docsEmpresa.map(d => d.tipo_documento_id));

    if (!tipos.length) {
      document.getElementById('asignarDocsBody').innerHTML = '<p>No hay tipos de documentos disponibles.</p>';
      return;
    }

    const secciones = agruparDocumentosPorSeccion(tipos);
    const html = Object.keys(secciones).sort().map(seccion => {
      const items = secciones[seccion].map(tipo => {
        const isAssigned = tiposAsignados.has(tipo.id);
        return `
          <div class="tipo-card">
            <div class="tipo-card-info">
              <div class="tipo-card-title">${tipo.nombre}</div>
              <div class="tipo-card-meta">Frecuencia: ${tipo.frecuencia || 'n/a'} · ${tipo.porcentaje ? tipo.porcentaje + '%' : '0%'}</div>
            </div>
            <label class="tipo-card-action">
              <input type="checkbox" id="check-tipo-${tipo.id}" value="${tipo.id}" ${isAssigned ? 'disabled checked' : ''} />
              <span>${isAssigned ? 'Asignado' : 'Seleccionar'}</span>
            </label>
          </div>`;
      }).join('');

      return `
        <details class="section-panel" ${seccion === '1' ? 'open' : ''}>
          <summary>Sección ${seccion}</summary>
          <div class="section-panel-body">${items}</div>
        </details>`;
    }).join('');

    document.getElementById('asignarDocsBody').innerHTML = `<div class="seccion-grid">${html}</div>`;
  } catch (err) {
    console.error('Error cargando documentos para asignar:', err);
    document.getElementById('asignarDocsBody').innerHTML = '<p>Error cargando documentos.</p>';
  }
}

async function asignarDocumentosEmpresa() {
  if (!selectedEmpresaId) {
    return alert('No se ha seleccionado correctamente la empresa. Vuelve a abrir el modal.');
  }

  const fechaLimite = document.getElementById('asignarFechaLimite').value;
  const prioridad = String(document.getElementById('asignarPrioridad').value || 'media').trim().toLowerCase();
  const validPrioridades = ['baja', 'media', 'alta'];

  if (!validPrioridades.includes(prioridad)) {
    return alert('La prioridad seleccionada no es válida.');
  }

  const checkedBoxes = Array.from(document.querySelectorAll('#asignarDocsBody input[type="checkbox"]'))
    .filter(input => input.checked && !input.disabled);

  if (!checkedBoxes.length) {
    return alert('Selecciona al menos un documento para asignar.');
  }

  const tipoIds = checkedBoxes.map(input => Number(input.value)).filter(Boolean);
  if (!tipoIds.length) {
    return alert('No se pudo leer los documentos seleccionados. Intenta recargar el modal.');
  }

  const fecha = new Date(fechaLimite);
  if (Number.isNaN(fecha.getTime())) {
    return alert('Fecha límite inválida.');
  }

  const mes = fecha.getMonth() + 1;
  const anio = fecha.getFullYear();

  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const results = await Promise.all(tipoIds.map(tipo_documento_id =>
      fetch('http://localhost:3000/api/documentos-requeridos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          empresa_id: Number(selectedEmpresaId),
          tipo_documento_id: Number(tipo_documento_id),
          fecha_limite: fechaLimite,
          prioridad
        })
      })
    ));

    const failed = [];
    for (const res of results) {
      if (!res.ok) {
        let errorMessage = 'Error al asignar documento';
        try {
          const errorBody = await res.json();
          errorMessage = errorBody.message || errorBody.error || errorMessage;
        } catch (_) {
          const errorText = await res.text().catch(() => '');
          if (errorText) errorMessage = errorText;
        }
        failed.push(errorMessage);
      }
    }

    if (failed.length) {
      mostrarToast({
        titulo: 'Asignación incompleta',
        mensaje: `Algunos documentos no se asignaron: ${failed.join(', ')}`,
        tipo: 'error'
      });
    } else {
      mostrarToast({
        titulo: 'Documentos asignados',
        mensaje: 'Los documentos se asignaron correctamente a la empresa y ya están disponibles para seguimiento.',
        tipo: 'success'
      });
      cerrarModal('modalAsignarDocumentos');
    }

    if (failed.length) {
      abrirModalAsignarDocumentos(selectedEmpresaId, selectedEmpresaNombre);
    }
    cargarEmpresas();
    cargarColaPrioritaria();
    invalidarCacheActividad();
  } catch (err) {
    console.error('Error asignando documentos a la empresa:', err);
    mostrarToast({
      titulo: 'Error de asignación',
      mensaje: 'No se pudieron asignar los documentos. Revisa la consola o intenta nuevamente.',
      tipo: 'error'
    });
  }
}

async function actualizarKpiRevisados() {
  try {
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const res = await fetch('http://localhost:3000/api/documentos/revisados-mes', { headers });
    const data = await res.json();
    document.getElementById('kpiRevisados').textContent = data.count;
  } catch (err) {
    console.error('Error actualizando KPI revisados:', err);
  }
}

async function cargarDocumentos() {
  const tablaDocumentos = document.getElementById('tablaDocumentos');

  try {
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const res = await fetch('http://localhost:3000/api/documentos/pendientes-validacion', { headers });
    const documentos = await res.json();

    console.log('📋 DOCUMENTOS RECIBIDOS:', documentos); // 🔍 DEBUG

    tablaDocumentos.innerHTML = '';

    documentos.forEach(doc => {
      console.log('📄 DOCUMENTO:', doc); // 🔍 DEBUG - Ver cada documento
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${doc.tipo_documento_nombre}</td>
        <td>${doc.empresa_nombre}</td>
        <td>${doc.usuario_nombre}</td>
        <td>${new Date(doc.fecha_subida).toLocaleDateString()}</td>
        <td>
          <span class="badge badge-warning">Subido</span>
        </td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="abrirPreviewAuditor('${doc.id}', '${String(doc.nombre_archivo || 'documento').replace(/'/g, "\\'")}')" style="margin-right:5px;">
            Ver
          </button>
          <button class="btn btn-sm btn-secondary" onclick="descargarDocumento('${doc.id}', '${String(doc.nombre_archivo || 'documento').replace(/'/g, "\\'")}')" style="margin-right:5px;">
            Descargar
          </button>
          <button class="btn btn-success btn-sm" onclick="validarDocumento('${doc.id}', 'aprobar')" style="margin-right:5px;">
            Aprobar
          </button>
          <button class="btn btn-danger btn-sm" onclick="validarDocumento('${doc.id}', 'rechazar')">
            Rechazar
          </button>
        </td>
      `;

      tablaDocumentos.appendChild(tr);
    });

  } catch (err) {
    console.error('Error cargando documentos:', err);
  }
}

function estadoHistorialBadge(estado) {
  const e = String(estado || 'pendiente').toLowerCase();
  if (['revisado', 'validado', 'aprobado'].includes(e)) {
    return { clase: 'badge-success', texto: 'Revisado' };
  }
  if (e === 'rechazado') {
    return { clase: 'badge-danger', texto: 'Rechazado' };
  }
  return { clase: 'badge-warning', texto: e };
}

async function cargarHistorial(forceReload = false) {
  const tbody = document.getElementById('tablaHistorial');
  if (!tbody) return;

  if (historialCargando) return;
  historialCargando = true;

  try {
    if (forceReload || historialGlobal.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">Cargando historial...</td></tr>';

      const res = await fetch('http://localhost:3000/api/documentos', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Error al cargar historial');

      const docs = await res.json();
      historialGlobal = docs
        .filter(d => ['revisado', 'validado', 'rechazado', 'aprobado'].includes(String(d.estado).toLowerCase()))
        .sort((a, b) => new Date(b.fecha_validacion || b.fecha_subida) - new Date(a.fecha_validacion || a.fecha_subida));
    }

    const totalPaginas = Math.max(1, Math.ceil(historialGlobal.length / limiteHistorial));
    paginaHistorial = Math.min(paginaHistorial, totalPaginas);

    renderHistorialAuditor();
  } catch (err) {
    console.error('Error cargando historial:', err);
    tbody.innerHTML = '<tr><td colspan="7">Error al cargar historial</td></tr>';
  } finally {
    historialCargando = false;
  }
}

function renderHistorialAuditor() {
  const tbody = document.getElementById('tablaHistorial');
  if (!tbody) return;

  const inicio = (paginaHistorial - 1) * limiteHistorial;
  const pagina = historialGlobal.slice(inicio, inicio + limiteHistorial);

  tbody.innerHTML = '';

  if (!pagina.length) {
    tbody.innerHTML = '<tr><td colspan="7">No hay documentos en el historial</td></tr>';
    renderPaginacionHistorialAuditor();
    return;
  }

  pagina.forEach(doc => {
    const badge = estadoHistorialBadge(doc.estado);
    const fecha = doc.fecha_validacion || doc.fecha_subida;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${doc.id}</td>
      <td>${doc.tipo_documento_nombre || doc.nombre_archivo || '—'}</td>
      <td>${doc.empresa_nombre || '—'}</td>
      <td>${doc.usuario_nombre || '—'}</td>
      <td>${fecha ? new Date(fecha).toLocaleDateString() : '—'}</td>
      <td><span class="badge ${badge.clase}">${badge.texto}</span></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="abrirPreviewAuditor('${doc.id}', '${String(doc.nombre_archivo || 'documento').replace(/'/g, "\\'")}')" style="margin-right:5px;">
          Ver
        </button>
        <button class="btn btn-sm btn-secondary" onclick="descargarDocumento('${doc.id}', '${String(doc.nombre_archivo || 'documento').replace(/'/g, "\\'")}')">
          Descargar
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  renderPaginacionHistorialAuditor();
}

function renderPaginacionHistorialAuditor() {
  const container = document.getElementById('paginacionHistorialAuditor');
  if (!container) return;

  const totalPaginas = Math.max(1, Math.ceil(historialGlobal.length / limiteHistorial));
  if (historialGlobal.length <= limiteHistorial) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm" onclick="cambiarPaginaHistorialAuditor(-1)" ${paginaHistorial === 1 ? 'disabled' : ''}>⬅ Anterior</button>
    <span>Página ${paginaHistorial} de ${totalPaginas}</span>
    <button type="button" class="btn btn-secondary btn-sm" onclick="cambiarPaginaHistorialAuditor(1)" ${paginaHistorial === totalPaginas ? 'disabled' : ''}>Siguiente ➡</button>
  `;
}

window.cambiarPaginaHistorialAuditor = function (direccion) {
  const totalPaginas = Math.max(1, Math.ceil(historialGlobal.length / limiteHistorial));
  const nuevaPagina = Math.min(totalPaginas, Math.max(1, paginaHistorial + direccion));
  if (nuevaPagina === paginaHistorial) return;
  paginaHistorial = nuevaPagina;
  renderHistorialAuditor();
};

window.refrescarTrasEliminarDocumentoAuditor = function () {
  historialGlobal = [];
  invalidarCacheActividad();
  cargarDocumentos();
  cargarColaPrioritaria();
  cargarHistorial(true);
  cargarEmpresas();
};

window.abrirPreviewAuditor = function (id, nombre) {
  previewDocumento(id, nombre, { onDeleted: refrescarTrasEliminarDocumentoAuditor });
};

window.validarDocumento = async function(id, action) {
  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const estado = action === 'aprobar' ? 'revisado' : 'rechazado';

    const res = await fetch(`http://localhost:3000/api/documentos/${id}/validar`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ estado })
    });

    if (res.ok) {
      alert(`Documento ${action === 'aprobar' ? 'aprobado' : 'rechazado'}`);
      historialGlobal = [];
      invalidarCacheActividad();
      cargarDocumentos();
      cargarColaPrioritaria();
      invalidarCacheActividad();
      cargarEmpresas();

      if (action === 'aprobar') {
        actualizarKpiRevisados();
      }
    } else {
      alert(`Error al ${action === 'aprobar' ? 'aprobar' : 'rechazar'} documento`);
    }
  } catch (err) {
    console.error('Error validando documento:', err);
  }
};

window.descargarDocumento = async function(id, nombreArchivo) {
  try {
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const res = await fetch(`http://localhost:3000/api/documentos/${id}/descargar`, {
      method: 'GET',
      headers
    });

    if (!res.ok) {
      alert('Error al descargar el documento');
      return;
    }

    // Obtener el blob
    const blob = await res.blob();
    
    // Crear un link temporal y descargar
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo || 'documento';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    console.error('Error descargando documento:', err);
    alert('Error al descargar documento');
  }
};

async function cargarColaPrioritaria() {
  try {
    const headers = {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    };

    const resEmpresas = await fetch('http://localhost:3000/api/empresas', { headers });
    const empresas = await resEmpresas.json();

    const pendientesPorEmpresa = await Promise.all(
      empresas.map(e =>
        fetch(`http://localhost:3000/api/documentos-requeridos/empresa/${e.id}/pendientes`, { headers })
          .then(res => res.json())
          .then(docs => docs.map(doc => ({
            ...doc,
            empresa: e.nombre
          })))
      )
    );

    const todos = pendientesPorEmpresa.flat();

    console.log("PENDIENTES REALES:", todos);

    // 🔥 ORDENAR
    const ordenados = todos.sort((a, b) => {
      const porcentajeA = parseFloat(a.porcentaje) || 0;
      const porcentajeB = parseFloat(b.porcentaje) || 0;

      if (porcentajeB !== porcentajeA) {
        return porcentajeB - porcentajeA;
      }

      return new Date(a.fecha_limite) - new Date(b.fecha_limite);
    });

    const top5 = ordenados.slice(0, 5);

    const sectionCola = document.getElementById('sectionColaRevision');
    const tbody = document.getElementById('tablaColaPrioritaria');
    const badge = document.getElementById('badgeCola');

    if (top5.length === 0) {
      if (sectionCola) sectionCola.style.display = 'none';
      if (badge) badge.textContent = '0';
      return;
    }

    if (sectionCola) sectionCola.style.display = '';

    tbody.innerHTML = '';
    badge.textContent = top5.length;

    top5.forEach(doc => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${doc.tipo_documento || doc.nombre} (${doc.porcentaje || 0}%)</td>
        <td>${doc.empresa}</td>
        <td>
          <span class="badge ${
            doc.prioridad === 'alta'
              ? 'badge-danger'
              : doc.prioridad === 'media'
              ? 'badge-warning'
              : 'badge-success'
          }">
            ${doc.prioridad}
          </span>
        </td>
        <td>${doc.fecha_limite ? new Date(doc.fecha_limite).toLocaleDateString() : '—'}</td>
        <td>
          <button class="btn btn-primary">
            Revisar
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error('Error cola prioritaria:', error);
  }
}



function invalidarCacheActividad() {
  actividadWidget?.invalidarYRecargar();
}

function initActividadAuditor() {
  if (!window.ActividadReciente) return;
  actividadWidget = ActividadReciente.crearWidget({
    timelineId: 'timelineAuditor',
    paginacionId: 'paginacionActividadReciente',
    buildUrl: (limit) => `http://localhost:3000/api/auditoria?limit=${limit}&offset=0`,
    mensajeVacio: 'Sin eventos registrados'
  });
  actividadWidget.init();
}

// ==============================
// INIT
// ==============================
document.addEventListener('DOMContentLoaded', () => {
  cargarEmpresas();
  cargarColaPrioritaria();
  initActividadAuditor();
  window.colaPrioritariaInterval = setInterval(cargarColaPrioritaria, 15000);

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        cerrarModal(modal.id);
      }
    });
  });
});
