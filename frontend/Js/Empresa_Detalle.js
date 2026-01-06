const user = window.Auth?.requireAuth(['auditor', 'super_admin'])
if (user) {
  const avatar = document.getElementById('userAvatar')
  if (avatar) {
    const initial = user.nombre ? user.nombre.charAt(0) : user.email.charAt(0)
    avatar.textContent = initial.toUpperCase()
  }
}

// Obtener ID de empresa de la URL
const urlParams = new URLSearchParams(window.location.search)
const empresaId = urlParams.get("id")

function renderEmptyRow(colspan) {
  return `<tr><td colspan="${colspan}">Sin datos</td></tr>`
}

// Cargar datos de la empresa seleccionada
async function loadEmpresaData() {
  if (!user) return
  if (!empresaId) {
    console.warn('Empresa no especificada')
    return
  }
  let empresa = null

  try {
    const response = await window.Auth.apiFetch(`/api/empresas/${empresaId}`)
    const data = await response.json()
    if (response.ok) {
      empresa = {
        nombre: data.nombre,
        razonSocial: data.nombre,
        ruc: data.rut || '-',
        empleados: data.empleados || '-',
        sector: data.sector || '-',
        fecha: data.fecha_creacion ? new Date(data.fecha_creacion).toLocaleDateString() : '-',
        estado: data.activa ? 'Activa' : 'Inactiva'
      }
    }
  } catch (error) {
    console.warn('No se pudo cargar la empresa', error)
  }

  if (empresa) {
    document.getElementById('empresaNombre').textContent = empresa.nombre
    document.getElementById('empresaRazonSocial').textContent = empresa.razonSocial
    document.getElementById('empresaRuc').textContent = empresa.ruc
    document.getElementById('empresaEmpleados').textContent = empresa.empleados
    document.getElementById('empresaSector').textContent = empresa.sector
    document.getElementById('empresaFecha').textContent = empresa.fecha
    document.getElementById('empresaEstado').textContent = empresa.estado
  }

  await loadDocumentosEmpresa()
  await loadUsuariosEmpresa()
}

async function loadDocumentosEmpresa() {
  const tablaSubidos = document.getElementById('tablaDocumentosSubidos')
  const tablaPendientes = document.getElementById('tablaDocumentosPendientes')
  try {
    const response = await window.Auth.apiFetch('/api/documentos')
    const data = await response.json()
    if (!response.ok) return
    const docs = Array.isArray(data) ? data : []
    const empresaDocs = docs.filter((doc) => String(doc.empresa_id) === String(empresaId))
    const aprobados = empresaDocs.filter((doc) => doc.estado === 'validado')
    const pendientes = empresaDocs.filter((doc) => doc.estado !== 'validado')
    const total = empresaDocs.length
    const cumplimiento = total ? Math.round((aprobados.length / total) * 100) : 0

    document.getElementById('statSubidos').textContent = total || 0
    document.getElementById('statPendientes').textContent = pendientes.length || 0
    document.getElementById('statAprobados').textContent = aprobados.length || 0
    document.getElementById('statCumplimiento').textContent = total ? `${cumplimiento}%` : '-'

    if (tablaSubidos) {
      tablaSubidos.innerHTML = empresaDocs.length
        ? empresaDocs.map((doc) => `
            <tr>
              <td>${doc.nombre_archivo || 'Documento'}</td>
              <td><span class="badge badge-info">${doc.tipo_documento_id ?? '-'}</span></td>
              <td>${doc.usuario_id ?? '-'}</td>
              <td>${doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
              <td><span class="badge badge-info">${doc.estado || 'subido'}</span></td>
              <td><button class="btn btn-secondary" style="padding:6px 12px;">Ver</button></td>
            </tr>
          `).join('')
        : renderEmptyRow(6)
    }

    if (tablaPendientes) {
      tablaPendientes.innerHTML = pendientes.length
        ? pendientes.map((doc) => `
            <tr>
              <td>${doc.nombre_archivo || 'Documento'}</td>
              <td><span class="badge badge-info">${doc.tipo_documento_id ?? '-'}</span></td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td><span class="badge badge-warning">Pendiente</span></td>
            </tr>
          `).join('')
        : renderEmptyRow(6)
    }
  } catch (error) {
    console.warn('No se pudieron cargar documentos de la empresa', error)
  }
}

async function loadUsuariosEmpresa() {
  const tablaUsuarios = document.getElementById('tablaUsuariosEmpresa')
  if (!tablaUsuarios) return
  try {
    const response = await window.Auth.apiFetch('/api/usuarios')
    const data = await response.json()
    if (!response.ok) {
      tablaUsuarios.innerHTML = renderEmptyRow(6)
      return
    }
    const usuarios = Array.isArray(data) ? data : []
    const usuariosEmpresa = usuarios.filter((u) => String(u.empresa_id) === String(empresaId))
    tablaUsuarios.innerHTML = usuariosEmpresa.length
      ? usuariosEmpresa.map((u) => `
          <tr>
            <td>${u.nombre || u.email}</td>
            <td>${u.email || '-'}</td>
            <td>${u.rol || '-'}</td>
            <td><span class="badge badge-info">-</span></td>
            <td>-</td>
            <td><span class="badge ${u.activo ? 'badge-success' : 'badge-warning'}\">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
          </tr>
        `).join('')
      : renderEmptyRow(6)
  } catch (error) {
    console.warn('No se pudieron cargar usuarios de la empresa', error)
    tablaUsuarios.innerHTML = renderEmptyRow(6)
  }
}

// Función para cambiar entre tabs
function switchTab(tabName, evt) {
  document.querySelectorAll(".pill").forEach((pill) => pill.classList.remove("is-active"))
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"))

  const target = evt?.target
  if (target) target.classList.add("is-active")
  const panel = document.getElementById("tab-" + tabName)
  if (panel) panel.classList.add("active")
}

// Función para volver al dashboard del auditor
function goBack() {
  window.location.href = "auditor-dashboard.html"
}

// Cargar datos cuando se carga la página
document.addEventListener("DOMContentLoaded", loadEmpresaData)
