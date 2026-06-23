// ==============================
// AUTH (Auth.js valida sesión con backend)
// ==============================
const token = window.Auth ? window.Auth.getToken() : localStorage.getItem('token');
const user = window.Auth ? window.Auth.getUser() : null;

let usuariosGlobal = [];
let paginaUsuarios = 1;
const limiteUsuarios = 5;

let documentosGlobal = [];
let paginaDocumentos = 1;
const limiteDocumentos = 5;

let selectedDocumentoId = null;

// Actividad reciente
let actividadPagina = 1;
const limiteActividad = 5;
let actividadTotal = 0;
let actividadGlobal = [];
let actividadCargando = false;
let actividadInicializada = false;
const ACTIVIDAD_FETCH_LIMIT = 100;
let empresasMap = {};

console.log("USER:", user);

if (!token || !user) {
  window.location.replace('/');
}

if (user && user.rol !== 'super_admin') {
  alert('No autorizado');
  window.location.replace('/');
}


// Avatar
const avatar = document.getElementById('userAvatar');
if (avatar) {
  avatar.textContent = user.nombre
    ? user.nombre.charAt(0).toUpperCase()
    : user.email.charAt(0).toUpperCase();
}

function showAlert() {
  const alertBox = document.getElementById("customAlert");
  alertBox.classList.remove("hidden");
  alertBox.classList.add("show");

  setTimeout(() => {
    alertBox.classList.remove("show");
    alertBox.classList.add("hidden");
  }, 3000);
}
// Modal
const modal = document.getElementById('modalUsuario');
const modalResponsable = document.getElementById('modalAsignarResponsable');
const btnAbrir = document.getElementById('btnAbrirModal');
const cerrar = document.getElementById('cerrarModal');
const cerrarResponsable = document.getElementById('cerrarModalResponsable');

btnAbrir.onclick = () => { modal.style.display = 'block'; };
cerrar.onclick = () => modal.style.display = 'none';
modalResponsable && cerrarResponsable && (cerrarResponsable.onclick = () => modalResponsable.style.display = 'none');

window.onclick = (e) => {
  if (e.target === modal) modal.style.display = 'none';
  if (e.target === modalResponsable) modalResponsable.style.display = 'none';
};

const btnAsignarResponsable = document.getElementById('btnAsignarResponsable');
if (btnAsignarResponsable) {
  btnAsignarResponsable.addEventListener('click', async () => {
    await asignarResponsableDocumento();
  });
}

async function abrirModalAsignarResponsable(documentoId, documentoNombre) {
  selectedDocumentoId = documentoId;
  const titulo = document.getElementById('asignarResponsableTitulo');
  const select = document.getElementById('selectUsuarioResponsable');

  titulo.textContent = `Documento: ${documentoNombre}`;
  select.innerHTML = '<option value="">Selecciona un usuario</option>';

  if (!usuariosGlobal || usuariosGlobal.length === 0) {
    await cargarUsuariosEmpresa().catch(err => console.error('Error cargando usuarios para asignar:', err));
  }

  usuariosGlobal.forEach(usuario => {
    const option = document.createElement('option');
    option.value = usuario.id;
    option.textContent = usuario.nombre || usuario.email;
    select.appendChild(option);
  });

  modalResponsable.style.display = 'flex';
}

async function asignarResponsableDocumento() {
  const select = document.getElementById('selectUsuarioResponsable');
  const usuarioId = select.value;

  if (!selectedDocumentoId || !usuarioId) {
    return alert('Selecciona un documento y un usuario para asignar.');
  }

  try {
    const res = await fetch('http://localhost:3000/api/documento-responsables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ documento_requerido_id: selectedDocumentoId, usuario_id: Number(usuarioId) })
    });

    const data = await res.json();

    if (!res.ok) {
      return alert(data.error || 'Error al asignar responsable');
    }

    alert('Responsable asignado correctamente.');
    modalResponsable.style.display = 'none';
    await cargarDocumentos();
    await cargarUsuariosEmpresa();
    await cargarColaRevision();
  } catch (error) {
    console.error('Error asignando responsable:', error);
    alert('No se pudo asignar el responsable. Intenta nuevamente.');
  }
}

// Crear usuario
document.getElementById('formCrearUsuario')
  .addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = document.getElementById('password').value;

    if (password.length < 6) {
      return alert('La contraseña debe tener al menos 6 caracteres.');
    }

    if (!user.empresa_id) {
      return alert('Tu cuenta no tiene empresa asignada. Contacta al administrador.');
    }

    const data = {
      nombre: document.getElementById('nombre').value.trim(),
      email: document.getElementById('email').value.trim(),
      password,
      rol: 'usuario',
      empresa_id: user.empresa_id
    };

    try {
      const resp = await fetch('http://localhost:3000/api/usuarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      const result = await resp.json();

      if (!resp.ok) {
        alert(window.Auth.parseApiError(result) || 'Error al crear usuario');
        return;
      }

      showAlert();

      modal.style.display = 'none';
      e.target.reset();

      await cargarUsuariosEmpresa();

    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    }
  });

async function cargarUsuariosEmpresa() {
  try {
    const res = await fetch('/api/usuarios', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Error cargando usuarios:', window.Auth.parseApiError(err));
      return;
    }

    const data = await res.json();
    const todos = Array.isArray(data) ? data : (data.usuarios || []);
    const usuarios = user.empresa_id
      ? todos.filter(u => String(u.empresa_id) === String(user.empresa_id))
      : todos;

    document.getElementById('kpiUsuarios').textContent = usuarios.length;

    usuariosGlobal = usuarios;
    paginaUsuarios = 1;

    renderUsuarios();

  } catch (error) {
    console.error('Error cargando usuarios:', error);
  }
}


function renderUsuarios() {
  const tbody = document.getElementById('tablaUsuarios');
  tbody.innerHTML = '';

  const inicio = (paginaUsuarios - 1) * limiteUsuarios;
  const fin = inicio + limiteUsuarios;

  const pagina = usuariosGlobal.slice(inicio, fin);

  pagina.forEach(usuario => {
    const tr = document.createElement('tr');

    // Calculate pending and progress based on documentosGlobal
    const totalAssigned = documentosGlobal ? documentosGlobal.filter(d => d.responsable_id === usuario.id).length : 0;
    const pendingCount = documentosGlobal ? documentosGlobal.filter(d => d.responsable_id === usuario.id && String(d.estado_documento || d.estado || 'pendiente').toLowerCase() === 'pendiente').length : 0;
    
    const completedCount = documentosGlobal ? documentosGlobal.filter(d => d.responsable_id === usuario.id && !['pendiente'].includes(String(d.estado_documento || d.estado || 'pendiente').toLowerCase())).length : 0;
    const progressPercent = totalAssigned > 0 ? Math.max(0, Math.min(100, Math.round((completedCount / totalAssigned) * 100))) : 0;

    const estadoBadgeClass = usuario.activo ? 'badge-success' : 'badge-danger';
    const estadoTexto = usuario.activo ? 'Activo' : 'Inactivo';

    tr.innerHTML = `
      <td>${usuario.nombre}</td>
      <td>${usuario.email || '—'}</td>
      <td>${pendingCount}</td>
      <td>
        <div style="display:flex; align-items:center; gap:8px; width:100%;">
          <div class="progress-bar" style="flex:1;">
            <div class="progress-fill" style="width:${progressPercent}%"></div>
          </div>
          <span style="font-size:12px; font-weight:700; min-width:40px;">${progressPercent}%</span>
        </div>
      </td>
      <td><span class="badge ${estadoBadgeClass}">${estadoTexto}</span></td>
    `;

    tbody.appendChild(tr);
  });

  renderControlesUsuarios();
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
  const totalPaginas = Math.max(1, Math.ceil(usuariosGlobal.length / limiteUsuarios));
  paginaUsuarios = Math.min(totalPaginas, Math.max(1, paginaUsuarios + direccion));
  renderUsuarios();
}

window.switchTab = function (tabName, evt) {
  document.querySelectorAll('.pill').forEach(p =>
    p.classList.remove('is-active')
  );

  document.querySelectorAll('.tab-content').forEach(c =>
    c.classList.remove('active')
  );

  if (evt?.currentTarget) {
    evt.currentTarget.classList.add('is-active');
  }

  const panel = document.getElementById(`tab-${tabName}`);
  if (panel) panel.classList.add('active');

  if (tabName === 'documentos') {
    cargarDocumentos();
    if (window.docRefreshInterval) clearInterval(window.docRefreshInterval);
    window.docRefreshInterval = setInterval(() => {
      cargarDocumentos();
    }, 10000);
  } else {
    if (window.docRefreshInterval) clearInterval(window.docRefreshInterval);
  }
};

async function cargarColaRevision() {
  try {
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const res = await fetch(`http://localhost:3000/api/documentos-requeridos/empresa/${user.empresa_id}/pendientes`, { headers });
    const docs = await res.json();

    const tabla = document.getElementById('tablaColaRevision');
    const badge = document.getElementById('badgeColaRevision');

    const unassigned = docs.filter(doc => !doc.responsable_id);

    tabla.innerHTML = '';
    badge.textContent = unassigned.length;

    console.log("COLA PENDIENTES SIN ASIGNAR:", unassigned);

    unassigned.forEach(doc => {
      const sla = formatearSLA(doc.fecha_limite);

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${doc.nombre} (${doc.frecuencia || '-'})</td>
        <td>
          <span class="badge ${
            doc.prioridad === 'alta'
              ? 'badge-danger'
              : doc.prioridad === 'media'
              ? 'badge-warning'
              : 'badge-success'
          }">
            ${doc.prioridad || '—'}
          </span>
        </td>
        <td>${sla}</td>
        <td>
          <button class="btn btn-primary" onclick="abrirModalAsignarResponsable(${doc.id}, '${String(doc.nombre).replace(/'/g, "\\'")}')">
            Asignar
          </button>
        </td>
      `;

      tabla.appendChild(tr);
    });

  } catch (error) {
    console.error('Error cola revisión:', error);
  }
}
async function cargarCumplimientoGlobal() {
  try {
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    // 🔥 TRAER TODOS LOS DOCUMENTOS (NO SOLO PENDIENTES)
    const res = await fetch(
      `http://localhost:3000/api/documentos-requeridos/empresa/${user.empresa_id}`,
      { headers }
    );

    const documentos = await res.json();

    if (!documentos.length) {
      document.getElementById('kpiCumplimiento').textContent = '100%';
      return;
    }

    // 🔥 CONTAR PENDIENTES
    const pendientes = documentos.filter(doc =>
      doc.estado && doc.estado.toLowerCase() === 'pendiente'
    ).length;

    const total = documentos.length;

    // ✅ FORMULA REAL
    const cumplimiento = Math.round(((total - pendientes) / total) * 100);

    document.getElementById('kpiCumplimiento').textContent = `${cumplimiento}%`;

  } catch (error) {
    console.error('Error cumplimiento:', error);
  }
}

async function cargarDocumentos() {
  try {
    const res = await fetch(
      `http://localhost:3000/api/documentos-requeridos/empresa/${user.empresa_id}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const documentos = await res.json();

    documentosGlobal = documentos; // 🔥 GUARDAR
    paginaDocumentos = 1;

    renderDocumentos();
    renderUsuarios();
    actualizarBarrasProgreso();

  } catch (error) {
    console.error('Error cargando documentos:', error);
  }
}

function renderDocumentos() {
  const tbody = document.getElementById('tablaDocumentos');
  tbody.innerHTML = '';

  const inicio = (paginaDocumentos - 1) * limiteDocumentos;
  const fin = inicio + limiteDocumentos;

  const pagina = documentosGlobal.slice(inicio, fin);

  pagina.forEach(doc => {
    const tr = document.createElement('tr');

    const estado = String(doc.estado_documento || doc.estado || 'pendiente').toLowerCase();
    let badgeClass = 'badge-warning';
    let estadoDisplay = 'Pendiente';

    if (['validado', 'revisado'].includes(estado)) {
      badgeClass = 'badge-success';
      estadoDisplay = estado === 'validado' ? 'Validado' : 'Revisado';
    } else if (estado === 'rechazado') {
      badgeClass = 'badge-danger';
      estadoDisplay = 'Rechazado';
    } else if (estado === 'subido') {
      badgeClass = 'badge-info';
      estadoDisplay = 'Subido';
    }

    tr.innerHTML = `
      <td>${doc.tipo_documento}</td>
      <td>${doc.responsable_nombre || 'Sin asignar'}</td>
      <td>${new Date(doc.fecha_limite).toLocaleDateString()}</td>
      <td>${doc.prioridad}</td>
      <td>
        <span class="badge ${badgeClass}">
          ${estadoDisplay}
        </span>
      </td>
      <td>
        <button class="btn btn-secondary" onclick="abrirModalAsignarResponsable(${doc.id}, '${String(doc.tipo_documento).replace(/'/g, "\\'")}')">
          Asignar
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  renderControlesDocumentos();
}


function renderControlesDocumentos() {
  const totalPaginas = Math.ceil(documentosGlobal.length / limiteDocumentos);

  const container = document.getElementById('paginacionDocumentos');
  if (!container) return;

  container.innerHTML = `
    <button onclick="cambiarPaginaDocumentos(-1)" ${paginaDocumentos === 1 ? 'disabled' : ''}>⬅</button>
    <span>Página ${paginaDocumentos} de ${totalPaginas}</span>
    <button onclick="cambiarPaginaDocumentos(1)" ${paginaDocumentos === totalPaginas ? 'disabled' : ''}>➡</button>
  `;
}

function cambiarPaginaDocumentos(direccion) {
  const totalPaginas = Math.max(1, Math.ceil(documentosGlobal.length / limiteDocumentos));
  paginaDocumentos = Math.min(totalPaginas, Math.max(1, paginaDocumentos + direccion));
  renderDocumentos();
}

function formatearSLA(fechaLimite) {
  if (!fechaLimite) return '—';
  const f = new Date(fechaLimite);
  if (Number.isNaN(f.getTime())) return '—';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  f.setHours(0, 0, 0, 0);
  const dias = Math.round((f - hoy) / (1000 * 60 * 60 * 24));
  if (dias > 0) return `${dias} ${dias === 1 ? 'día faltante' : 'días faltantes'}`;
  if (dias === 0) return 'Vence hoy';
  const atraso = Math.abs(dias);
  return `${atraso} ${atraso === 1 ? 'día atrasado' : 'días atrasado'}`;
}
function getColorPrioridad(prioridad) {
  if (prioridad === 'alta') return 'badge-danger';
  if (prioridad === 'media') return 'badge-warning';
  return 'badge-success';
};

async function validarDocumento(id) {
  try {
    await fetch(`http://localhost:3000/api/documentos/${id}/validar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // recargar tabla
    cargarColaRevision();

  } catch (error) {
    console.error('Error validando documento:', error);
  }
};

async function cargarKPIs() {
  try {
    // ⚠️ CAMBIA el ID si luego lo haces dinámico
    const empresaId = user.empresa_id;

    const res = await fetch(`http://localhost:3000/api/documentos-requeridos/empresa/${empresaId}/pendientes`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();

    document.getElementById('kpiDocsPendientes').textContent = data.length;
  } catch (error) {
    console.error('Error KPI:', error);
  }
}

function actualizarBarrasProgreso() {
  if (!documentosGlobal || documentosGlobal.length === 0) {
    // Sin datos, mostrar 0%
    document.getElementById('badgeProgresoDocs').textContent = '0%';
    document.getElementById('barraProgresoDocs').style.width = '0%';
    document.getElementById('docsCompletados').textContent = '0';
    document.getElementById('docsTotales').textContent = '0';
    document.getElementById('docsValidados').textContent = '0';

    document.getElementById('badgeProgresoPersonas').textContent = '0%';
    document.getElementById('barraProgresoPersonas').style.width = '0%';
    document.getElementById('usuariosCompletos').textContent = '0';
    document.getElementById('usuariosTotales').textContent = '0';
    document.getElementById('usuariosProgreso').textContent = '0';
    return;
  }

  // ========== PROGRESO DE DOCUMENTACIÓN ==========
  const totalDocs = documentosGlobal.length;
  
  // Contar documentos completados (validado, revisado, aprobado)
  const docsCompletadosCount = documentosGlobal.filter(d => {
    const estado = String(d.estado_documento || d.estado || 'pendiente').toLowerCase();
    return ['validado', 'revisado', 'aprobado'].includes(estado);
  }).length;

  // Contar documentos validados/revisados
  const docsValidadosCount = documentosGlobal.filter(d => {
    const estado = String(d.estado_documento || d.estado || 'pendiente').toLowerCase();
    return ['validado', 'revisado'].includes(estado);
  }).length;

  const progresoDocs = totalDocs > 0 ? Math.round((docsCompletadosCount / totalDocs) * 100) : 0;

  document.getElementById('badgeProgresoDocs').textContent = progresoDocs + '%';
  document.getElementById('barraProgresoDocs').style.width = progresoDocs + '%';
  document.getElementById('docsCompletados').textContent = docsCompletadosCount;
  document.getElementById('docsTotales').textContent = totalDocs;
  document.getElementById('docsValidados').textContent = docsValidadosCount;

  // ========== PROGRESO DE PERSONAS ==========
  const totalUsuarios = usuariosGlobal.length;
  
  if (totalUsuarios === 0) {
    document.getElementById('badgeProgresoPersonas').textContent = '0%';
    document.getElementById('barraProgresoPersonas').style.width = '0%';
    document.getElementById('usuariosCompletos').textContent = '0';
    document.getElementById('usuariosTotales').textContent = '0';
    document.getElementById('usuariosProgreso').textContent = '0';
    return;
  }

  // Contar usuarios con 100% de documentos completados
  let usuariosCompletosCount = 0;
  let usuariosEnProgresoCount = 0;

  usuariosGlobal.forEach(usuario => {
    const docsDelUsuario = documentosGlobal.filter(d => d.responsable_id === usuario.id);
    
    if (docsDelUsuario.length === 0) {
      // Usuario sin documentos asignados
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

  document.getElementById('badgeProgresoPersonas').textContent = progresoPersonas + '%';
  document.getElementById('barraProgresoPersonas').style.width = progresoPersonas + '%';
  document.getElementById('usuariosCompletos').textContent = usuariosCompletosCount;
  document.getElementById('usuariosTotales').textContent = totalUsuarios;
  document.getElementById('usuariosProgreso').textContent = usuariosEnProgresoCount;
}



// ==============================
// ACTIVIDAD RECIENTE (SUPER ADMIN)
// ==============================
async function cargarEmpresasMap() {
  try {
    const res = await fetch('/api/empresas', { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const list = await res.json();
    empresasMap = {};
    list.forEach(e => { empresasMap[e.id] = e.nombre; });
  } catch (err) {
    console.error('Error cargando mapa de empresas:', err);
  }
}

async function fetchActividadGlobal(force = false) {
  if (!force && actividadGlobal.length) return actividadGlobal;
  if (actividadCargando) return actividadGlobal;

  actividadCargando = true;
  try {
    const headers = { Authorization: `Bearer ${token}` };
    let url = `http://localhost:3000/api/auditoria?limit=${ACTIVIDAD_FETCH_LIMIT}&offset=0`;
    if (user.empresa_id) url += `&empresa_id=${user.empresa_id}`;

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
  const timeline = document.getElementById('timelineSuperAdmin');
  if (!timeline) return;

  const inicio = (actividadPagina - 1) * limiteActividad;
  const eventos = actividadGlobal.slice(inicio, inicio + limiteActividad);

  if (!eventos.length) {
    timeline.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:16px;">Sin eventos registrados</p>';
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
      <div style="display:flex; gap:12px; padding:12px 0; border-bottom:1px solid #eee;">
        <div style="width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:#f3f4f6; color:#334155; flex-shrink:0;">${inicial}</div>
        <div>
          <div style="font-weight:600;">${titulo}</div>
          <div style="color:#64748b; font-size:12px;">${usuario} • ${fechaFormato}</div>
        </div>
      </div>
    `;
  }).join('');

  renderActividadPaginacion();
}

async function cargarActividadReciente(pagina = 1, forceFetch = false, silent = false) {
  const timeline = document.getElementById('timelineSuperAdmin');
  if (!timeline) return;

  actividadPagina = Math.max(1, parseInt(pagina) || 1);

  try {
    const needsFetch = forceFetch || !actividadGlobal.length;
    if (needsFetch) {
      if (!silent && !actividadInicializada) {
        timeline.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:16px;">Cargando actividad...</p>';
      }
      await fetchActividadGlobal(true);
      actividadInicializada = true;
    }

    const totalPaginas = Math.max(1, Math.ceil(actividadGlobal.length / limiteActividad));
    actividadPagina = Math.min(actividadPagina, totalPaginas);
    actividadTotal = actividadGlobal.length;
    renderActividadPagina();
  } catch (err) {
    console.error('Error cargando actividad reciente (superadmin):', err);
    if (!actividadInicializada) {
      timeline.innerHTML = '<p style="color:#ef4444; text-align:center; padding:16px;">Error cargando actividad reciente</p>';
    }
    renderActividadPaginacion();
  }
}

async function refrescarActividadSilenciosa() {
  if (actividadCargando) return;
  await cargarActividadReciente(actividadPagina, true, true);
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

function invalidarCacheActividad() {
  actividadGlobal = [];
}

document.addEventListener('DOMContentLoaded', async () => {
  await cargarEmpresasMap();
  cargarUsuariosEmpresa();
  cargarColaRevision();
  cargarKPIs();

  cargarCumplimientoGlobal();
  cargarDocumentos();
  cargarActividadReciente(1, true);
  window.actividadRecienteInterval = setInterval(refrescarActividadSilenciosa, 15000);
});