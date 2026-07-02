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
  throw new Error('AGORA: sin sesión');
}

if (!['auditor', 'super_admin'].includes(user.rol)) {
  alert('No autorizado');
  window.location.replace('/');
  throw new Error('AGORA: rol no autorizado');
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

  const selectedPill = evt?.currentTarget
    || document.querySelector(`.pill[data-tab="${tabName}"]`)
    || Array.from(document.querySelectorAll('.pill')).find(p => (p.getAttribute('onclick') || '').includes(`'${tabName}'`));

  if (selectedPill) selectedPill.classList.add('is-active');

  const panel = document.getElementById(`tab-${tabName}`);
  if (panel) panel.classList.add('active');

  if (tabName === 'documentos') {
    cargarDocumentos();
  } else if (tabName === 'historial') {
    cargarHistorial();
  }
};

window.pendientesAuditorGlobal = [];

function agruparPendientesPorEmpresa(pendientes) {
  const map = new Map();
  (pendientes || []).forEach(p => {
    const key = String(p.empresa_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  });
  return map;
}

function renderEmpresasEnRiesgo() {
  const listaRiesgo = document.getElementById('listaEmpresasRiesgo');
  const badgeRiesgo = document.getElementById('badgeEmpresasRiesgo');
  if (!listaRiesgo || !badgeRiesgo) return;

  const porEmpresa = agruparPendientesPorEmpresa(window.pendientesAuditorGlobal);
  const empresasMap = new Map((window.empresasData || []).map(e => [String(e.id), e]));
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const empresasRiesgo = [];

  porEmpresa.forEach((docs, empresaId) => {
    if (!docs.length) return;

    const empresa = empresasMap.get(empresaId);
    const nombre = empresa?.nombre || docs[0]?.empresa_nombre || docs[0]?.empresa || 'Empresa';
    const vencidos = docs.filter(d => {
      if (!d.fecha_limite) return false;
      const fecha = new Date(d.fecha_limite);
      return !Number.isNaN(fecha.getTime()) && fecha < hoy;
    }).length;

    empresasRiesgo.push({
      id: empresaId,
      nombre,
      pendientes: docs.length,
      vencidos
    });
  });

  empresasRiesgo.sort((a, b) => {
    if (b.vencidos !== a.vencidos) return b.vencidos - a.vencidos;
    return b.pendientes - a.pendientes;
  });

  badgeRiesgo.textContent = empresasRiesgo.length;

  listaRiesgo.innerHTML = empresasRiesgo.length
    ? empresasRiesgo.slice(0, 6).map(e => `
        <div class="list-item list-item-riesgo" role="button" tabindex="0"
          onclick="verEmpresa('${e.id}')"
          onkeydown="if(event.key==='Enter')verEmpresa('${e.id}')">
          <div class="list-item-riesgo-info">
            <strong>${e.nombre}</strong>
            <small>${e.pendientes} documento(s) pendiente(s) de subir</small>
          </div>
          <div class="list-item-riesgo-badges">
            ${e.vencidos > 0 ? `<span class="badge badge-danger">${e.vencidos} vencido(s)</span>` : ''}
            <span class="badge badge-warning">${e.pendientes} pend.</span>
          </div>
        </div>
      `).join('')
    : `<div class="list-empty"><i data-lucide="shield-check"></i><span>Ninguna empresa con documentos pendientes</span></div>`;

  if (window.lucide) lucide.createIcons();
}

function esPendienteSinSubir(doc) {
  if (doc.sin_subir === true || doc.sin_subir === 'true') return true;
  return String(doc.estado_documento || 'pendiente').toLowerCase() === 'pendiente';
}

function renderColaPrioritaria() {
  const lista = document.getElementById('listaColaPrioritaria');
  const badge = document.getElementById('badgeCola');
  const sectionCola = document.getElementById('sectionColaRevision');
  if (!lista || !badge) return;

  const items = [...(window.pendientesAuditorGlobal || [])]
    .filter(esPendienteSinSubir)
    .sort((a, b) => {
      const pctA = parseFloat(a.porcentaje) || 0;
      const pctB = parseFloat(b.porcentaje) || 0;
      if (pctB !== pctA) return pctB - pctA;
      return new Date(a.fecha_limite || 0) - new Date(b.fecha_limite || 0);
    })
    .slice(0, 6);

  if (sectionCola) sectionCola.style.display = '';
  badge.textContent = items.length;

  if (!items.length) {
    lista.innerHTML = `
      <div class="list-empty">
        <i data-lucide="inbox"></i>
        <span>No hay documentos pendientes sin subir</span>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  lista.innerHTML = items.map(doc => {
    const nombreDoc = doc.nombre || doc.tipo_documento || 'Documento';
    const empresa = doc.empresa_nombre || doc.empresa || '—';
    const porcentaje = parseFloat(doc.porcentaje) || 0;
    const fecha = doc.fecha_limite
      ? new Date(doc.fecha_limite).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
      : '—';
    const nombreEsc = nombreDoc.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const empresaEsc = empresa.replace(/'/g, "\\'").replace(/"/g, '&quot;');

    return `
      <div class="cola-item">
        <div class="cola-item-doc">
          <strong title="${nombreEsc}">${nombreDoc}</strong>
          <small>${empresa} · ${doc.responsable_nombre || 'Sin responsable'}</small>
        </div>
        <div class="cola-item-meta">
          <span class="badge badge-info">${porcentaje}%</span>
          <small class="cola-item-fecha">${fecha}</small>
        </div>
        <button type="button" class="btn btn-sm btn-warning cola-btn-alerta"
          onclick="generarAlertaCola(${doc.id}, '${nombreEsc}', '${empresaEsc}', this)">
          Generar alerta
        </button>
      </div>`;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

window.generarAlertaCola = async function (documentoId, nombreDoc, empresaNombre, btn) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Enviando…';
  }

  try {
    const res = await fetch(
      `/api/documentos-requeridos/auditor/alerta/${documentoId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || data.message || 'No se pudo generar la alerta');
    }

    mostrarToast({
      titulo: 'Alerta generada',
      mensaje: `Se registró alerta por "${nombreDoc}" en ${empresaNombre}`,
      tipo: 'success'
    });
    invalidarCacheActividad();
  } catch (error) {
    console.error('Error generando alerta:', error);
    mostrarToast({
      titulo: 'Error',
      mensaje: error.message || 'No se pudo generar la alerta',
      tipo: 'error'
    });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Generar alerta';
    }
  }
};

async function cargarPendientesAuditor() {
  try {
    const headers = { 'Authorization': `Bearer ${token}` };
    const res = await window.Auth.apiFetch('/api/documentos-requeridos/auditor/pendientes');

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Error al cargar pendientes');
    }

    const data = await res.json();
    window.pendientesAuditorGlobal = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error cargando pendientes auditor:', error);
    window.pendientesAuditorGlobal = [];
  }

  renderEmpresasEnRiesgo();
  renderColaPrioritaria();

  const kpiPendientes = document.getElementById('kpiPendientes');
  if (kpiPendientes) {
    kpiPendientes.textContent = window.pendientesAuditorGlobal.length;
  }
}

// ==============================
// CARGAR EMPRESAS (TU ENDPOINT)
// ==============================
async function cargarEmpresas() {
  const kpiEmpresas = document.getElementById('kpiEmpresas');
  const kpiEmpresasDetalle = document.getElementById('kpiEmpresasDetalle');
  const listaRiesgo = document.getElementById('listaEmpresasRiesgo');
  const badgeRiesgo = document.getElementById('badgeEmpresasRiesgo');
  const tablaEmpresas = document.getElementById('tablaEmpresas');

  if (tablaEmpresas) {
    tablaEmpresas.innerHTML = '<tr><td colspan="7">Cargando empresas...</td></tr>';
  }

  try {
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const [empresasRes, usuariosRes] = await Promise.all([
      window.Auth.apiFetch('/api/empresas'),
      window.Auth.apiFetch('/api/usuarios')
    ]);

    if (!empresasRes.ok) {
      const err = await empresasRes.json().catch(() => ({}));
      throw new Error(window.Auth.parseApiError(err) || 'Error al cargar empresas');
    }
    if (!usuariosRes.ok) {
      const err = await usuariosRes.json().catch(() => ({}));
      throw new Error(window.Auth.parseApiError(err) || 'Error al cargar usuarios');
    }

    const empresas = await empresasRes.json();
    const usuarios = await usuariosRes.json();

    if (!Array.isArray(empresas)) {
      throw new Error('Respuesta inválida de empresas');
    }

    window.allUsuarios = Array.isArray(usuarios) ? usuarios : [];
    window.empresasData = empresas;

    let totalPendientesGlobal = 0;
    let totalDocsGlobal = 0;
    let totalEnviadosGlobal = 0;

    if (tablaEmpresas) {
      tablaEmpresas.innerHTML = '';
    }

    const pendientesPorEmpresa = agruparPendientesPorEmpresa(window.pendientesAuditorGlobal);

    const resumenesMap = new Map();
    await Promise.all(empresas.map(async (e) => {
      try {
        const resResumen = await fetch(
          `/api/documentos-requeridos/empresa/${e.id}/resumen`,
          { headers }
        );
        const resumen = resResumen.ok ? await resResumen.json() : { total: 0, enviados: 0 };
        resumenesMap.set(String(e.id), resumen);
      } catch {
        resumenesMap.set(String(e.id), { total: 0, enviados: 0 });
      }
    }));

    for (const e of empresas) {
      const pendientesEmpresa = pendientesPorEmpresa.get(String(e.id)) || [];
      const totalPendientes = pendientesEmpresa.length;

      totalPendientesGlobal += totalPendientes;

      const usuariosEmpresa = window.allUsuarios.filter(u =>
        String(u.empresa_id) === String(e.id)
      );

      const resumen = resumenesMap.get(String(e.id)) || { total: 0, enviados: 0 };

      const totalDocs = parseInt(resumen.total) || 0;
      const enviados = parseInt(resumen.enviados) || 0;

      const cumplimiento = totalDocs === 0
        ? null
        : Math.round((enviados / totalDocs) * 100);

      if (totalDocs > 0) {
        totalDocsGlobal += totalDocs;
        totalEnviadosGlobal += enviados;
      }

      const enRiesgo = totalPendientes > 0;

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

      if (tablaEmpresas) {
        tablaEmpresas.appendChild(tr);
      }
    }

   
    // ==============================
    // 🔥 KPI GLOBAL
    // ==============================
    if (kpiEmpresas) kpiEmpresas.textContent = empresas.length;
    if (kpiEmpresasDetalle) kpiEmpresasDetalle.textContent = `${empresas.length} registradas`;

    const kpiPendientesEl = document.getElementById('kpiPendientes');
    if (kpiPendientesEl) kpiPendientesEl.textContent = totalPendientesGlobal;
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
      const resRevisados = await fetch('/api/documentos/revisados-mes', { headers });
      const dataRevisados = await resRevisados.json();
      document.getElementById('kpiRevisados').textContent = dataRevisados.count;
    } catch (err) {
      console.error('Error cargando revisados del mes:', err);
      document.getElementById('kpiRevisados').textContent = '0';
    }

    // ==============================
    // 🚨 EMPRESAS EN RIESGO (desde pendientes globales)
    // ==============================
    renderEmpresasEnRiesgo();

  } catch (err) {
    console.error('Error cargando dashboard:', err);
    if (kpiEmpresas) kpiEmpresas.textContent = '0';
    if (kpiEmpresasDetalle) kpiEmpresasDetalle.textContent = 'Error al cargar';
    if (listaRiesgo) {
      listaRiesgo.innerHTML = `<div class="list-empty is-error">No se pudo cargar el listado de riesgo</div>`;
    }
    if (badgeRiesgo) badgeRiesgo.textContent = '!';
    if (tablaEmpresas) {
      tablaEmpresas.innerHTML = '<tr><td colspan="7">No se pudieron cargar las empresas.</td></tr>';
    }
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
  document.getElementById('empresaNit').value = '';
  document.getElementById('empresaSector').value = '';
  document.getElementById('empresaUbicacion').value = '';
  document.getElementById('empresaEmail').value = '';
  document.getElementById('empresaTelefono').value = '';
  document.getElementById('modalCrearEmpresa').style.display = 'flex';
  setTimeout(() => {
    const nitInput = document.getElementById('empresaNit');
    if (nitInput) {
      nitInput.addEventListener('input', formatearNitInput);
      nitInput.addEventListener('blur', formatearNitInput);
    }
  }, 0);
}

function formatearNitInput(event) {
  const input = event.target;
  let value = input.value.replace(/[^0-9]/g, '');

  if (value.length > 10) {
    value = value.slice(0, 10);
  }

  if (value.length <= 9) {
    input.value = value;
    return;
  }

  input.value = `${value.slice(0, 9)}-${value.slice(9, 10)}`;
}

async function crearEmpresa() {
  const nombre = document.getElementById('empresaNombre').value.trim();
  const nit = document.getElementById('empresaNit').value.trim();
  const sector = document.getElementById('empresaSector').value.trim();
  const ubicacion = document.getElementById('empresaUbicacion').value.trim();
  const email = document.getElementById('empresaEmail').value.trim();
  const telefono = document.getElementById('empresaTelefono').value.trim();

  if (!nombre || !nit) {
    return alert('Nombre y NIT son obligatorios.');
  }

  const nitRegex = /^\d{6,10}-\d$/;
  if (!nitRegex.test(nit)) {
    return alert('El NIT debe tener entre 6 y 10 dígitos, un guion y un dígito verificador.');
  }

  try {
    const res = await fetch('/api/empresas', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre, nit, sector, ubicacion, email, telefono })
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

  document.getElementById('usuarioRoleGroup').style.display = 'block';
  document.getElementById('usuarioRol').value = 'usuario';

  document.getElementById('modalCrearUsuario').style.display = 'flex';
}

async function crearUsuario() {
  const nombre = document.getElementById('usuarioNombre').value.trim();
  const email = document.getElementById('usuarioEmail').value.trim();
  const rolInput = document.getElementById('usuarioRol');
  const rol = rolInput ? rolInput.value : 'usuario';

  if (!selectedEmpresaId) {
    return alert('Selecciona una empresa primero.');
  }
  if (!nombre || !email) {
    return alert('Nombre y email son obligatorios.');
  }

  try {
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre, email, rol, empresa_id: selectedEmpresaId })
    });

    const data = await res.json();
    if (!res.ok) {
      return alert(window.Auth.parseApiError(data) || 'Error enviando invitación');
    }

    alert(data.message || 'Invitación enviada correctamente');
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
      fetch('/api/tipos-documentos', { headers }),
      fetch(`/api/documentos-requeridos/empresa/${empresaId}`, { headers })
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
      fetch('/api/documentos-requeridos', {
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

    const res = await fetch('/api/documentos/revisados-mes', { headers });
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

    const res = await fetch('/api/documentos/pendientes-validacion', { headers });
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

      const res = await fetch('/api/documentos', {
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
  const btn = event?.target?.closest?.('button');
  const prevText = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = action === 'aprobar' ? 'Aprobando…' : 'Rechazando…';
  }

  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const estado = action === 'aprobar' ? 'revisado' : 'rechazado';
    let comentarios = null;

    if (action === 'rechazar') {
      const motivo = await mostrarModalObservacion('Escribe la observación del rechazo del documento');
      if (motivo === null) return;
      comentarios = motivo.trim() || null;
    }

    const res = await fetch(`/api/documentos/${id}/validar`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ estado, comentarios })
    });

    if (res.ok) {
      const mensaje = action === 'aprobar'
        ? 'El documento fue aprobado correctamente.'
        : 'El documento fue rechazado y la observación quedó registrada.';

      mostrarToast({
        titulo: action === 'aprobar' ? 'Documento aprobado' : 'Documento rechazado',
        mensaje,
        tipo: action === 'aprobar' ? 'success' : 'error'
      });

      historialGlobal = [];
      actividadWidget?.invalidarYRecargar();
      Promise.all([
        cargarDocumentos(),
        cargarPendientesAuditor()
      ]).then(() => cargarEmpresas());

      if (action === 'aprobar') {
        actualizarKpiRevisados();
      }
    } else {
      mostrarToast({
        titulo: 'No se pudo completar',
        mensaje: `No se pudo ${action === 'aprobar' ? 'aprobar' : 'rechazar'} el documento. Intenta nuevamente.`,
        tipo: 'error'
      });
    }
  } catch (err) {
    console.error('Error validando documento:', err);
  } finally {
    if (btn) {
      btn.disabled = false;
      if (prevText) btn.textContent = prevText;
    }
  }
};

async function mostrarModalObservacion(titulo) {
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
      <textarea id="observacionRechazo" rows="6" style="width:100%; box-sizing:border-box; padding:12px; border:1px solid #cbd5e1; border-radius:10px; resize:vertical; font-size:14px; outline:none;"></textarea>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
        <button id="cancelarObservacion" class="btn btn-secondary btn-sm">Cancelar</button>
        <button id="guardarObservacion" class="btn btn-danger btn-sm">Guardar observación</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const textarea = modal.querySelector('#observacionRechazo');
    const cancelarBtn = modal.querySelector('#cancelarObservacion');
    const guardarBtn = modal.querySelector('#guardarObservacion');

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

window.descargarDocumento = async function(id, nombreArchivo) {
  try {
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const res = await fetch(`/api/documentos/${id}/descargar`, {
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
  await cargarPendientesAuditor();
}

window.revisarDocumentoCola = function (id, nombre) {
  verEmpresa(id);
};



function invalidarCacheActividad() {
  actividadWidget?.invalidarYRecargar();
}

function initActividadAuditor() {
  if (!window.ActividadReciente) return;
  actividadWidget = ActividadReciente.crearWidget({
    timelineId: 'timelineAuditor',
    paginacionId: 'paginacionActividadReciente',
    buildUrl: (limit) => ActividadReciente.buildAuditoriaUrl(limit),
    mensajeVacio: 'Sin eventos registrados'
  });
  actividadWidget.init();
}

// ==============================
// INIT
// ==============================
document.addEventListener('DOMContentLoaded', async () => {
  initActividadAuditor();
  await cargarPendientesAuditor();
  cargarEmpresas();
  window.colaPrioritariaInterval = setInterval(cargarPendientesAuditor, 15000);

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        cerrarModal(modal.id);
      }
    });
  });
});
