// ==============================
// AUTH (Auth.js valida sesión con backend)
// ==============================
const token = window.Auth ? window.Auth.getToken() : localStorage.getItem('token');
const user = window.Auth ? window.Auth.getUser() : null;

let usuariosGlobal = [];
let paginaUsuarios = 1;
const limiteUsuarios = 7;

let documentosGlobal = [];
let paginaDocumentos = 1;
const limiteDocumentos = 7;

let selectedDocumentoId = null;
let actividadWidget = null;
let empresasMap = {};

const saludState = {
  documentos: [],
  resultado: null,
  vista: 'categorias',
  categoriaId: null,
  lastRenderKey: null
};

if (!token || !user) {
  window.location.replace('/');
  throw new Error('AGORA: sin sesión');
}

if (user.rol !== 'super_admin') {
  alert('No autorizado');
  window.location.replace('/');
  throw new Error('AGORA: rol no autorizado');
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

if (btnAbrir && modal) {
  btnAbrir.onclick = () => { modal.style.display = 'block'; };
}
if (cerrar && modal) {
  cerrar.onclick = () => modal.style.display = 'none';
}
if (modalResponsable && cerrarResponsable) {
  cerrarResponsable.onclick = () => modalResponsable.style.display = 'none';
}

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
    const res = await fetch('/api/documento-responsables', {
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

    if (!user.empresa_id) {
      return alert('Tu cuenta no tiene empresa asignada. Contacta al administrador.');
    }

    const data = {
      nombre: document.getElementById('nombre').value.trim(),
      email: document.getElementById('email').value.trim(),
      rol: 'usuario',
      empresa_id: user.empresa_id
    };

    try {
      const resp = await fetch('/api/usuarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      const result = await resp.json();

      if (!resp.ok) {
        alert(window.Auth.parseApiError(result) || 'Error al enviar invitación');
        return;
      }

      showAlert(result.message || 'Invitación enviada correctamente');

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
    const res = await window.Auth.apiFetch('/api/usuarios');

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
  if (!tbody) return;
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
  const container = document.getElementById('paginacionUsuarios');
  if (!container) return;

  const totalPaginas = Math.max(1, Math.ceil(usuariosGlobal.length / limiteUsuarios));
  if (usuariosGlobal.length <= limiteUsuarios) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm" onclick="cambiarPaginaUsuarios(-1)" ${paginaUsuarios === 1 ? 'disabled' : ''}>⬅ Anterior</button>
    <span>Página ${paginaUsuarios} de ${totalPaginas}</span>
    <button type="button" class="btn btn-secondary btn-sm" onclick="cambiarPaginaUsuarios(1)" ${paginaUsuarios === totalPaginas ? 'disabled' : ''}>Siguiente ➡</button>
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

function actualizarVistaCola(cantidad) {
  const grid = document.getElementById('gridSaludRow');
  if (!grid) return;
  grid.classList.toggle('is-cola-vacia', cantidad === 0);
}

async function cargarColaRevision() {
  try {
    const tabla = document.getElementById('tablaColaRevision');
    const badge = document.getElementById('badgeColaRevision');
    if (!tabla || !badge) return;

    if (!user?.empresa_id) {
      tabla.innerHTML = '<tr><td colspan="4">No hay empresa asociada a tu cuenta.</td></tr>';
      badge.textContent = '0';
      actualizarVistaCola(0);
      return;
    }

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const res = await window.Auth.apiFetch(`/api/documentos-requeridos/empresa/${user.empresa_id}/pendientes`);
    if (!res.ok) {
      throw new Error('Error al cargar cola de revisión');
    }

    const docs = await res.json();
    if (!Array.isArray(docs)) {
      throw new Error('Respuesta inválida de cola de revisión');
    }

    const unassigned = docs.filter(doc => !doc.responsable_id);

    tabla.innerHTML = '';
    badge.textContent = unassigned.length;
    actualizarVistaCola(unassigned.length);

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
  if (saludState.documentos.length) {
    aplicarSaludDesdeCache();
    return;
  }
  await cargarDocumentos();
}

function actualizarCacheSalud(documentos) {
  saludState.documentos = Array.isArray(documentos) ? documentos : [];
  saludState.resultado = window.SgsstStructure
    ? window.SgsstStructure.calcularCumplimientoSgsst(saludState.documentos)
    : null;
}

function aplicarSaludDesdeCache() {
  const { documentos, resultado } = saludState;
  const porcentajeEmpresa = resultado?.porcentajeEmpresa ?? 0;

  document.getElementById('kpiCumplimiento').textContent = documentos.length
    ? `${porcentajeEmpresa}%`
    : '0%';

  renderSaludSistema({ animate: false });
}

function getSaludRenderKey(contenido) {
  const { documentos, resultado, vista, categoriaId } = saludState;
  return JSON.stringify({
    vista,
    categoriaId,
    docCount: documentos.length,
    contenido,
    resultado: resultado ? {
      porcentajeEmpresa: resultado.porcentajeEmpresa,
      esAsignacionTotalCompleta: resultado.esAsignacionTotalCompleta,
      porSeccion: resultado.porSeccion,
      porSubseccion: resultado.porSubseccion
    } : null
  });
}

function estadoCumplimiento(porcentaje) {
  if (porcentaje >= 100) return { texto: 'Cumple', clase: 'badge-success' };
  if (porcentaje > 0) return { texto: 'En progreso', clase: 'badge-warning' };
  return { texto: 'Pendiente', clase: 'badge-danger' };
}

function redondear(valor) {
  return Math.round(valor * 10) / 10;
}

function calcularPorcentajeSub(stats, pesoEsperado) {
  if (!window.SgsstStructure || !stats) return 0;
  return window.SgsstStructure.calcularPorcentajeCategoria(
    stats.ganado,
    stats.asignado,
    pesoEsperado
  );
}

function crearTarjetaSalud({ id, titulo, subtitulo, porcentaje, pesoLabel, estado, clickable }) {
  const attrs = clickable
    ? `class="section-card salud-card is-clickable" data-salud-id="${id}" tabindex="0" role="button"`
    : 'class="section-card salud-card"';

  return `
    <article ${attrs}>
      <div class="section-card-header">
        <div>
          <div class="section-card-title">${titulo}</div>
          ${subtitulo ? `<div class="section-card-sub">${subtitulo}</div>` : ''}
        </div>
        <span class="section-percentage">${porcentaje}%</span>
      </div>
      <div class="section-progress-bar">
        <div class="section-progress-fill" style="width:${Math.min(100, porcentaje)}%"></div>
      </div>
      <div class="section-card-footer">
        <span class="badge ${estado.clase}">${estado.texto}</span>
        <span class="section-card-meta">${pesoLabel}</span>
      </div>
    </article>`;
}

function renderSaludNav() {
  const nav = document.getElementById('saludNav');
  if (!nav) return;

  if (saludState.vista === 'categorias') {
    nav.hidden = true;
    nav.innerHTML = '';
    return;
  }

  const categoria = window.SgsstStructure?.SG_SST_CATEGORIAS
    .find(c => c.id === saludState.categoriaId);

  nav.hidden = false;
  nav.innerHTML = `
    <button type="button" class="salud-back" id="saludBtnVolver">
      <span aria-hidden="true">←</span> ${categoria?.nombre || 'Volver'}
    </button>`;
}

function renderSaludCategorias(porSeccion) {
  const categoriasActivas = window.SgsstStructure.SG_SST_CATEGORIAS.filter(categoria => {
    const stats = porSeccion[categoria.id];
    return stats && stats.asignado > 0;
  });

  if (!categoriasActivas.length) {
    return '<p class="salud-empty">No hay categorías con documentos asignados.</p>';
  }

  return categoriasActivas.map(categoria => {
    const stats = porSeccion[categoria.id];
    const porcentaje = stats.porcentaje;
    const estado = estadoCumplimiento(porcentaje);
    const pesoLabel = stats.esCompleta
      ? `${redondear(stats.contribucion)}% / ${categoria.peso}%`
      : `${redondear(stats.contribucion)}% ganado`;

    return crearTarjetaSalud({
      id: categoria.id,
      titulo: `${categoria.id}. ${categoria.nombre}`,
      subtitulo: `Peso total ${categoria.peso}%`,
      porcentaje,
      pesoLabel,
      estado,
      clickable: true
    });
  }).join('');
}

function renderSaludSubcategorias(porSubseccion, categoriaId) {
  const categoria = window.SgsstStructure.SG_SST_CATEGORIAS.find(c => c.id === categoriaId);
  if (!categoria) return '<p class="salud-empty">Categoría no encontrada.</p>';

  const subcategoriasActivas = categoria.subcategorias.filter(sub => {
    const stats = porSubseccion[sub.id];
    return stats && stats.asignado > 0;
  });

  if (!subcategoriasActivas.length) {
    return '<p class="salud-empty">No hay subcategorías con documentos asignados.</p>';
  }

  return subcategoriasActivas.map(sub => {
    const stats = porSubseccion[sub.id];
    const porcentaje = calcularPorcentajeSub(stats, sub.peso);
    const estado = estadoCumplimiento(porcentaje);
    const esCompleta = stats.asignado > 0
      && window.SgsstStructure.esAsignacionCompleta(stats.asignado, sub.peso);
    const pesoLabel = esCompleta
      ? `${redondear(stats.ganado)}% / ${sub.peso}%`
      : `${redondear(stats.ganado)}% ganado`;

    return crearTarjetaSalud({
      id: sub.id,
      titulo: `${sub.id} ${sub.nombre}`,
      subtitulo: `${stats.completados}/${stats.docs} documentos`,
      porcentaje,
      pesoLabel,
      estado,
      clickable: false
    });
  }).join('');
}

function renderSaludSistema({ animate = false, force = false } = {}) {
  const container = document.getElementById('listaSaludSistema');
  const badgeGlobal = document.getElementById('badgeSaludGlobal');
  if (!container || !window.SgsstStructure) return;

  const { documentos, resultado } = saludState;
  if (!resultado) {
    const emptyMsg = '<p class="salud-empty">No hay datos de cumplimiento.</p>';
    const emptyKey = getSaludRenderKey(emptyMsg);
    if (!force && saludState.lastRenderKey === emptyKey) return;
    saludState.lastRenderKey = emptyKey;
    container.classList.remove('is-entering');
    container.innerHTML = emptyMsg;
    renderSaludNav();
    return;
  }

  const { porSeccion, porSubseccion, porcentajeEmpresa, esAsignacionTotalCompleta } = resultado;
  const estadoGlobal = estadoCumplimiento(porcentajeEmpresa);

  if (badgeGlobal) {
    if (!documentos.length) {
      badgeGlobal.textContent = 'Sin datos';
      badgeGlobal.className = 'badge badge-info';
    } else {
      const etiqueta = esAsignacionTotalCompleta ? '' : ' · ajustado';
      badgeGlobal.textContent = `${porcentajeEmpresa}%${etiqueta}`;
      badgeGlobal.className = `badge ${estadoGlobal.clase}`;
    }
  }

  renderSaludNav();

  const contenido = saludState.vista === 'subcategorias'
    ? renderSaludSubcategorias(porSubseccion, saludState.categoriaId)
    : renderSaludCategorias(porSeccion);

  const renderKey = getSaludRenderKey(contenido);
  if (!force && saludState.lastRenderKey === renderKey) return;
  saludState.lastRenderKey = renderKey;

  container.classList.remove('is-entering');
  if (animate) {
    void container.offsetWidth;
    container.classList.add('is-entering');
  }
  container.innerHTML = contenido;
}

function saludIrAtras() {
  if (saludState.vista === 'categorias') return;
  saludState.vista = 'categorias';
  saludState.categoriaId = null;
  saludState.lastRenderKey = null;
  renderSaludSistema({ animate: true });
}

function saludAbrirCategoria(categoriaId) {
  saludState.vista = 'subcategorias';
  saludState.categoriaId = categoriaId;
  saludState.lastRenderKey = null;
  renderSaludSistema({ animate: true });
}

function initSaludNavegacion() {
  const container = document.getElementById('listaSaludSistema');
  const nav = document.getElementById('saludNav');
  if (!container) return;

  container.addEventListener('click', (event) => {
    const card = event.target.closest('[data-salud-id]');
    if (!card || saludState.vista !== 'categorias') return;
    saludAbrirCategoria(card.dataset.saludId);
  });

  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('[data-salud-id]');
    if (!card || saludState.vista !== 'categorias') return;
    event.preventDefault();
    saludAbrirCategoria(card.dataset.saludId);
  });

  nav?.addEventListener('click', (event) => {
    if (event.target.closest('#saludBtnVolver')) {
      saludIrAtras();
    }
  });
}

async function cargarDocumentos() {
  try {
    if (!user?.empresa_id) {
      documentosGlobal = [];
      renderDocumentos();
      renderUsuarios();
      actualizarBarrasProgreso();
      return;
    }

    const res = await fetch(
      `/api/documentos-requeridos/empresa/${user.empresa_id}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const documentos = await res.json();
    if (JSON.stringify(documentosGlobal) === JSON.stringify(documentos)) return;

    documentosGlobal = documentos;
    paginaDocumentos = 1;

    actualizarCacheSalud(documentos);

    renderDocumentos();
    renderUsuarios();
    actualizarBarrasProgreso();
    saludState.lastRenderKey = null;
    aplicarSaludDesdeCache();

  } catch (error) {
    console.error('Error cargando documentos:', error);
  }
}

function renderDocumentos() {
  const tbody = document.getElementById('tablaDocumentos');
  if (!tbody) return;
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
  const container = document.getElementById('paginacionDocumentos');
  if (!container) return;

  const totalPaginas = Math.max(1, Math.ceil(documentosGlobal.length / limiteDocumentos));
  if (documentosGlobal.length <= limiteDocumentos) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm" onclick="cambiarPaginaDocumentos(-1)" ${paginaDocumentos === 1 ? 'disabled' : ''}>⬅ Anterior</button>
    <span>Página ${paginaDocumentos} de ${totalPaginas}</span>
    <button type="button" class="btn btn-secondary btn-sm" onclick="cambiarPaginaDocumentos(1)" ${paginaDocumentos === totalPaginas ? 'disabled' : ''}>Siguiente ➡</button>
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
    const motivo = await mostrarModalObservacionSuperAdmin('Escribe la observación del rechazo del documento');
    if (motivo === null) return;

    const comentarios = motivo.trim() || null;

    await fetch(`/api/documentos/${id}/validar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ estado: 'rechazado', comentarios })
    });

    // recargar tabla
    cargarColaRevision();

  } catch (error) {
    console.error('Error validando documento:', error);
  }
};

async function mostrarModalObservacionSuperAdmin(titulo) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(15, 23, 42, 0.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';

    const modal = document.createElement('div');
    modal.style.width = 'min(92vw, 480px)';
    modal.style.background = '#fff';
    modal.style.borderRadius = '16px';
    modal.style.boxShadow = '0 16px 40px rgba(0,0,0,0.22)';
    modal.style.padding = '24px';
    modal.style.border = '1px solid #e2e8f0';

    modal.innerHTML = `
      <h3 style="margin:0 0 8px; color:#0f172a; font-size:20px;">${titulo}</h3>
      <p style="margin:0 0 14px; color:#64748b; font-size:14px;">Explica brevemente por qué se rechaza este documento.</p>
      <textarea id="observacionRechazoSuper" rows="6" style="width:100%; box-sizing:border-box; padding:12px; border:1px solid #cbd5e1; border-radius:10px; resize:vertical; font-size:14px; outline:none;"></textarea>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
        <button id="cancelarObservacionSuper" class="btn btn-secondary btn-sm">Cancelar</button>
        <button id="guardarObservacionSuper" class="btn btn-danger btn-sm">Guardar observación</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const textarea = modal.querySelector('#observacionRechazoSuper');
    const cancelarBtn = modal.querySelector('#cancelarObservacionSuper');
    const guardarBtn = modal.querySelector('#guardarObservacionSuper');

    const cerrar = (valor) => {
      overlay.remove();
      resolve(valor);
    };

    cancelarBtn.onclick = () => cerrar(null);
    guardarBtn.onclick = () => cerrar(textarea.value);
    overlay.onclick = (e) => {
      if (e.target === overlay) cerrar(null);
    };
    textarea.focus();
  });
}

async function cargarKPIs() {
  try {
    const empresaId = user?.empresa_id;
    if (!empresaId) {
      const kpi = document.getElementById('kpiDocsPendientes');
      if (kpi) kpi.textContent = '0';
      return;
    }

    const res = await fetch(`/api/documentos-requeridos/empresa/${empresaId}/pendientes`, {
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
    const res = await window.Auth.apiFetch('/api/empresas');
    if (!res.ok) return;
    const list = await res.json();
    if (!Array.isArray(list)) return;
    empresasMap = {};
    list.forEach(e => { empresasMap[e.id] = e.nombre; });
  } catch (err) {
    console.error('Error cargando mapa de empresas:', err);
  }
}

function invalidarCacheActividad() {
  actividadWidget?.invalidarYRecargar();
}

function initActividadSuperAdmin() {
  if (!window.ActividadReciente) return;
  actividadWidget = ActividadReciente.crearWidget({
    timelineId: 'timelineSuperAdmin',
    paginacionId: 'paginacionActividadReciente',
    buildUrl: (limit) => ActividadReciente.buildAuditoriaUrl(limit),
    mensajeVacio: 'Sin eventos registrados'
  });
  actividadWidget.init();
}

document.addEventListener('DOMContentLoaded', async () => {
  initActividadSuperAdmin();
  initSaludNavegacion();
  await cargarEmpresasMap();
  cargarUsuariosEmpresa();
  cargarColaRevision();
  cargarKPIs();
  cargarDocumentos();
});