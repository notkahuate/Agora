// ==============================
// AUTH (Auth.js valida sesión con backend)
// ==============================
const token = window.Auth ? window.Auth.getToken() : localStorage.getItem('token');
const user = window.Auth ? window.Auth.getUser() : null;
let actividadPagina = 1;
const limiteActividad = 5;
let actividadTotal = 0;
let actividadGlobal = [];
let actividadCargando = false;
let actividadInicializada = false;
const ACTIVIDAD_FETCH_LIMIT = 100;

let historialGlobal = [];
let paginaHistorial = 1;
const limiteHistorial = 5;
let historialCargando = false;

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
    let sumaCumplimiento = 0;
    let totalEmpresas = empresas.length;

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
        ? 0
        : Math.round((enviados / totalDocs) * 100);

            // 🔥 SUMAR PARA KPI GLOBAL
            sumaCumplimiento += cumplimiento;

      // ==============================
      // 🚨 RIESGO (solo si hay pendientes reales)
      // ==============================
      const enRiesgo = totalPendientes > 0 && cumplimiento < 70;

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
          <div class="progress-bar">
            <div class="progress-fill" style="width:${cumplimiento}%"></div>
          </div>
          <small>${cumplimiento}%</small>
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

    // 🔥 CUMPLIMIENTO GLOBAL
    const promedioCumplimiento = totalEmpresas
      ? Math.round(sumaCumplimiento / totalEmpresas)
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
    cargarActividadReciente(actividadPagina, true, true);
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
    cargarActividadReciente(actividadPagina, true, true);
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
      alert(`Algunos documentos no se asignaron:\n${failed.join('\n')}`);
    } else {
      alert('Documentos asignados correctamente a la empresa.');
    }

    abrirModalAsignarDocumentos(selectedEmpresaId, selectedEmpresaNombre);
    cargarEmpresas();
    cargarColaPrioritaria();
    cargarActividadReciente(actividadPagina, true, true);
  } catch (err) {
    console.error('Error asignando documentos a la empresa:', err);
    alert('Error asignando documentos a la empresa. Revisa la consola o recarga la página.');
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
          <button class="btn btn-sm btn-secondary" onclick="descargarDocumento('${doc.id}', '${doc.nombre_archivo}')" style="margin-right:5px;">
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
      cargarActividadReciente(actividadPagina, true, true);
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

window.previewDocumento = async function(id, nombreArchivo) {
  try {
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    // Obtener info del documento
    const docRes = await fetch(`http://localhost:3000/api/documentos/${id}`, {
      method: 'GET',
      headers
    });

    if (!docRes.ok) {
      alert('Error al obtener documento');
      return;
    }

    const doc = await docRes.json();
    const extension = nombreArchivo.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(extension);
    const isPdf = extension === 'pdf';

    let previewUrl = null;
    if (isImage || isPdf) {
      const token = localStorage.getItem('token');
      const previewRes = await fetch(`http://localhost:3000/api/documentos/${id}/descargar`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!previewRes.ok) {
        throw new Error('No se pudo obtener el archivo para previsualizar');
      }
      const blob = await previewRes.blob();
      previewUrl = URL.createObjectURL(blob);
    }

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 80%;
      max-height: 80vh;
      overflow: auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;

    if (isImage && previewUrl) {
      const img = document.createElement('img');
      img.style.cssText = 'max-width: 100%; max-height: 70vh;';
      img.src = previewUrl;
      content.appendChild(img);
    } else if (isPdf && previewUrl) {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'width: 100%; height: 70vh; border: none;';
      iframe.src = previewUrl;
      content.appendChild(iframe);
    } else {
      const p = document.createElement('p');
      p.textContent = `Documento: ${nombreArchivo} (no se puede previsualizar)`;
      p.style.cssText = 'margin-bottom: 20px;';
      content.appendChild(p);
    }

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cerrar';
    closeBtn.style.cssText = `
      margin-top: 20px;
      padding: 8px 16px;
      background: #334155;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    closeBtn.onclick = () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      modal.remove();
    };
    content.appendChild(closeBtn);

    modal.appendChild(content);
    modal.onclick = (e) => {
      if (e.target === modal) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        modal.remove();
      }
    };

    document.body.appendChild(modal);
  } catch (err) {
    console.error('Error en preview:', err);
    alert('Error al previsualizar documento');
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



// ==============================
// ACTIVIDAD RECIENTE (TIMELINE)
// ==============================
function iconoActividad(evento) {
  const entidadTexto = String(evento.entidad || '').replace(/_/g, ' ');
  if (evento.accion === 'crear') return { color: '#10b981', icono: '✚' };
  if (evento.accion === 'actualizar') return { color: '#3b82f6', icono: '⟳' };
  if (evento.accion === 'eliminar') return { color: '#ef4444', icono: '✕' };
  if (['validar', 'aprobar', 'revisar'].includes(evento.accion)) return { color: '#8b5cf6', icono: '✓' };
  if (evento.accion === 'descargar') return { color: '#0ea5e9', icono: '↓' };
  if (evento.accion === 'subir') return { color: '#f59e0b', icono: '↑' };
  if (evento.accion === 'asignar') return { color: '#f59e0b', icono: '→' };
  if (entidadTexto.toLowerCase().includes('documento')) return { color: '#f97316', icono: '📄' };
  return { color: '#94a3b8', icono: '●' };
}

async function fetchActividadGlobal(force = false) {
  if (!force && actividadGlobal.length) return actividadGlobal;
  if (actividadCargando) return actividadGlobal;

  actividadCargando = true;
  try {
    const res = await fetch(
      `http://localhost:3000/api/auditoria?limit=${ACTIVIDAD_FETCH_LIMIT}&offset=0`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();
    actividadGlobal = data.eventos || [];
    actividadTotal = actividadGlobal.length;
    return actividadGlobal;
  } finally {
    actividadCargando = false;
  }
}

function renderActividadPagina() {
  const timeline = document.getElementById('timelineAuditor');
  if (!timeline) return;

  const inicio = (actividadPagina - 1) * limiteActividad;
  const eventos = actividadGlobal.slice(inicio, inicio + limiteActividad);

  if (!eventos.length) {
    timeline.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px;">Sin eventos registrados</p>';
    renderActividadPaginacion();
    return;
  }

  timeline.innerHTML = eventos.map(evento => {
    const fecha = new Date(evento.fecha_evento || Date.now());
    const fechaFormato = fecha.toLocaleString('es-ES', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const { color, icono } = iconoActividad(evento);
    const entidadLabel = String(evento.entidad || 'Evento').replace(/_/g, ' ');
    const descripcion = evento.descripcion || `${evento.accion || 'Evento'} en ${entidadLabel}`;
    const usuario = evento.usuario_nombre || 'Sistema';

    return `
      <div style="display:flex;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e2e8f0;">
        <div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;min-width:32px;background:${color}20;color:${color};border-radius:50%;font-weight:bold;margin-right:12px;flex-shrink:0;">${icono}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;color:#1e293b;font-weight:500;">${descripcion}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">${usuario} • ${fechaFormato}</div>
        </div>
      </div>
    `;
  }).join('');

  renderActividadPaginacion();
}

async function cargarActividadReciente(pagina = 1, forceFetch = false, silent = false) {
  const timeline = document.getElementById('timelineAuditor');
  if (!timeline) return;

  actividadPagina = Math.max(1, parseInt(pagina) || 1);

  try {
    const needsFetch = forceFetch || !actividadGlobal.length;
    if (needsFetch) {
      if (!silent && !actividadInicializada) {
        timeline.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px;">Cargando actividad...</p>';
      }
      await fetchActividadGlobal(true);
      actividadInicializada = true;
    }

    const totalPaginas = Math.max(1, Math.ceil(actividadGlobal.length / limiteActividad));
    actividadPagina = Math.min(actividadPagina, totalPaginas);
    actividadTotal = actividadGlobal.length;
    renderActividadPagina();
  } catch (err) {
    console.error('Error cargando actividad reciente:', err);
    if (!actividadInicializada) {
      timeline.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px;">Error cargando actividad reciente</p>';
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

// ==============================
// INIT
// ==============================
document.addEventListener('DOMContentLoaded', () => {
  cargarEmpresas();
  cargarColaPrioritaria();
  cargarActividadReciente(1, true);
  window.actividadRecienteInterval = setInterval(refrescarActividadSilenciosa, 15000);
  window.colaPrioritariaInterval = setInterval(cargarColaPrioritaria, 15000);

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        cerrarModal(modal.id);
      }
    });
  });
});
