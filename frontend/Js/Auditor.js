const user = window.Auth?.requireAuth(['auditor', 'super_admin'])

if (user && document.getElementById('userAvatar')) {
  document.getElementById('userAvatar').textContent = user.nombre
    ? user.nombre.charAt(0)
    : user.email.charAt(0)
}

function switchTab(tabName, evt) {
  document.querySelectorAll('.pill').forEach((tab) => tab.classList.remove('is-active'))
  document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'))

  const trigger = evt?.currentTarget || document.querySelector(`[data-tab="${tabName}"]`)
  if (trigger) trigger.classList.add('is-active')
  const panel = document.getElementById('tab-' + tabName)
  if (panel) panel.classList.add('active')
}

// Revisar documentos
async function reviewDocument(action) {
  if (!user) return
  const docId = prompt('Ingresa el ID del documento a revisar:')
  if (!docId) return

  const estado = action === 'approve' ? 'validado' : 'rechazado'
  const mensaje = action === 'approve'
    ? 'El documento ha sido aprobado exitosamente.'
    : 'El documento ha sido rechazado. Se notificará al usuario.'

  if (!confirm(`¿Estás seguro de que deseas ${action === 'approve' ? 'aprobar' : 'rechazar'} este documento?`)) {
    return
  }

  try {
    const response = await window.Auth.apiFetch(`/api/documentos/${docId}/validar`, {
      method: 'POST',
      body: JSON.stringify({ estado })
    })
    const data = await response.json()
    if (!response.ok) {
      alert(data.message || 'No se pudo actualizar el documento')
      return
    }
    alert(mensaje)
  } catch (error) {
    console.error('Error al validar documento:', error)
    alert('No se pudo conectar con el servidor.')
  }
}

function renderEmptyRow(colspan) {
  return `<tr><td colspan="${colspan}">Sin datos</td></tr>`
}

async function loadDocumentos() {
  const tbodyDocs = document.getElementById('tablaDocumentos') || document.querySelector('#tab-documentos tbody')
  const tbodyHistorial = document.getElementById('tablaHistorial')
  const tbodyCola = document.getElementById('tablaColaPrioritaria')
  const badgeCola = document.getElementById('badgeCola')
  const kpiPendientes = document.getElementById('kpiPendientes')
  const kpiPendientesDetalle = document.getElementById('kpiPendientesDetalle')
  const kpiRevisados = document.getElementById('kpiRevisados')
  const kpiRevisadosDetalle = document.getElementById('kpiRevisadosDetalle')
  const kpiCumplimiento = document.getElementById('kpiCumplimiento')
  const kpiCumplimientoDetalle = document.getElementById('kpiCumplimientoDetalle')
  try {
    const response = await window.Auth.apiFetch('/api/documentos')
    const data = await response.json()
    if (!response.ok) return
    const docs = Array.isArray(data) ? data : []
    const pendientes = docs.filter((doc) => doc.estado !== 'validado')
    const revisados = docs.filter((doc) => doc.estado === 'validado')
    const total = docs.length
    const cumplimiento = total > 0 ? Math.round((revisados.length / total) * 100) : 0

    if (kpiPendientes) kpiPendientes.textContent = pendientes.length
    if (kpiPendientesDetalle) kpiPendientesDetalle.textContent = total ? `${pendientes.length} de ${total}` : '-'
    if (kpiRevisados) kpiRevisados.textContent = revisados.length
    if (kpiRevisadosDetalle) kpiRevisadosDetalle.textContent = total ? `${revisados.length} de ${total}` : '-'
    if (kpiCumplimiento) kpiCumplimiento.textContent = total ? `${cumplimiento}%` : '-'
    if (kpiCumplimientoDetalle) kpiCumplimientoDetalle.textContent = total ? `${revisados.length}/${total}` : '-'
    if (badgeCola) badgeCola.textContent = pendientes.length ? `${pendientes.length} en cola` : '-'

    if (tbodyDocs) {
      tbodyDocs.innerHTML = docs.length
        ? docs.map((doc) => {
            const estado = doc.estado || 'subido'
            return `
              <tr>
                <td>${doc.nombre_archivo || 'Documento'}</td>
                <td>${doc.empresa_id ?? '-'}</td>
                <td>${doc.usuario_id ?? '-'}</td>
                <td>${doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
                <td><span class="badge badge-info">${estado}</span></td>
                <td>
                  <button class="btn btn-primary" style="padding:6px 12px;" onclick="reviewDocument('approve')">Aprobar</button>
                </td>
              </tr>
            `
          }).join('')
        : renderEmptyRow(6)
    }

    if (tbodyCola) {
      tbodyCola.innerHTML = pendientes.length
        ? pendientes.map((doc) => `
            <tr>
              <td>${doc.nombre_archivo || 'Documento'}</td>
              <td>${doc.empresa_id ?? '-'}</td>
              <td><span class="badge badge-warning">Pendiente</span></td>
              <td>-</td>
              <td><button class="btn btn-primary" style="padding:8px 12px;" onclick="reviewDocument('approve')">Revisar</button></td>
            </tr>
          `).join('')
        : renderEmptyRow(5)
    }

    if (tbodyHistorial) {
      tbodyHistorial.innerHTML = docs.length
        ? docs.map((doc) => `
            <tr>
              <td>#${doc.id ?? '-'}</td>
              <td>${doc.nombre_archivo || 'Documento'}</td>
              <td>${doc.empresa_id ?? '-'}</td>
              <td>${doc.usuario_id ?? '-'}</td>
              <td>${doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
              <td><span class="badge badge-info">${doc.estado || 'subido'}</span></td>
              <td><button class="btn btn-secondary" style="padding:6px 12px;">Ver</button></td>
            </tr>
          `).join('')
        : renderEmptyRow(7)
    }
  } catch (error) {
    console.warn('No se pudieron cargar documentos', error)
  }
}

async function loadEmpresas() {
  const kpiEmpresas = document.getElementById('kpiEmpresas')
  const kpiEmpresasDetalle = document.getElementById('kpiEmpresasDetalle')
  const listaRiesgo = document.getElementById('listaEmpresasRiesgo')
  const badgeRiesgo = document.getElementById('badgeEmpresasRiesgo')
  const tablaEmpresas = document.getElementById('tablaEmpresas')

  try {
    const response = await window.Auth.apiFetch('/api/empresas')
    const data = await response.json()
    if (!response.ok) return
    const empresas = Array.isArray(data) ? data : []
    if (kpiEmpresas) kpiEmpresas.textContent = empresas.length
    if (kpiEmpresasDetalle) kpiEmpresasDetalle.textContent = empresas.length ? `${empresas.length} registradas` : '-'
    if (badgeRiesgo) badgeRiesgo.textContent = empresas.length ? `${Math.min(empresas.length, 4)} en riesgo` : '-'

    if (listaRiesgo) {
      listaRiesgo.innerHTML = empresas.length
        ? empresas.slice(0, 4).map((emp) => `
            <div class="list-item"><span>${emp.nombre || 'Empresa'}</span><span class="badge badge-info">Sin datos</span></div>
          `).join('')
        : '<div class="list-item"><span>Sin empresas</span><span class="badge badge-info">-</span></div>'
    }

    if (tablaEmpresas) {
      tablaEmpresas.innerHTML = empresas.length
        ? empresas.map((emp) => `
            <tr>
              <td>${emp.nombre || 'Empresa'}</td>
              <td>-</td>
              <td><span class="badge badge-info">-</span></td>
              <td><div class="progress-bar" style="width:100px;"><div class="progress-fill" style="width:0%;"></div></div></td>
              <td><span class="badge ${emp.activa ? 'badge-success' : 'badge-warning'}">${emp.activa ? 'Activa' : 'Inactiva'}</span></td>
              <td><button class="btn btn-secondary" style="padding:6px 12px;">Ver</button></td>
            </tr>
          `).join('')
        : renderEmptyRow(6)
    }
  } catch (error) {
    console.warn('No se pudieron cargar empresas', error)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadEmpresas()
  loadDocumentos()
})
