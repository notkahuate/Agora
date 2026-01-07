const user = window.Auth?.requireAuth(['super_admin'])

if (user && document.getElementById('userAvatar')) {
  document.getElementById('userAvatar').textContent = user.nombre
    ? user.nombre.charAt(0)
    : user.email.charAt(0)
}

function switchTab(tabName, evt) {
  document.querySelectorAll('.pill').forEach((tab) => tab.classList.remove('is-active'))
  document.querySelectorAll('.tab-content').forEach((panel) => panel.classList.remove('active'))

  const trigger = evt?.currentTarget || document.querySelector(`[data-tab="${tabName}"]`)
  if (trigger) {
    trigger.classList.add('is-active')
  }
  const panel = document.getElementById('tab-' + tabName)
  if (panel) {
    panel.classList.add('active')
  }
}

function renderEmptyRow(colspan) {
  return `<tr><td colspan="${colspan}">Sin datos</td></tr>`
}

async function loadUsuarios() {
  const tbody = document.querySelector('#tab-usuarios tbody')
  if (!tbody) return
  try {
    const response = await window.Auth.apiFetch('/api/usuarios')
    const data = await response.json()
    if (!response.ok) return
    tbody.innerHTML = data.map((u) => {
      return `
        <tr>
          <td>${u.nombre || u.email}</td>
          <td>${u.rol || '-'}</td>
          <td><span class="badge badge-warning">-</span></td>
          <td><div class="progress-bar" style="width:140px;"><div class="progress-fill" style="width:70%;"></div></div></td>
          <td><span class="badge badge-success">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
        </tr>
      `
    }).join('')
  } catch (error) {
    console.warn('No se pudieron cargar usuarios', error)
  }
}

async function loadDocumentos() {
  const tbodyDocs = document.getElementById('tablaDocumentos')
  const tbodyHistorial = document.getElementById('tablaHistorial')
  const tbodyCola = document.getElementById('tablaColaRevision')
  const badgeCola = document.getElementById('badgeColaRevision')
  const kpiDocsPendientes = document.getElementById('kpiDocsPendientes')
  const kpiDocsPendientesDetalle = document.getElementById('kpiDocsPendientesDetalle')
  const kpiCumplimiento = document.getElementById('kpiCumplimiento')
  const kpiCumplimientoDetalle = document.getElementById('kpiCumplimientoDetalle')

  try {
    const response = await window.Auth.apiFetch('/api/documentos')
    const data = await response.json()
    if (!response.ok) return
    const docs = Array.isArray(data) ? data : []
    const pendientes = docs.filter((d) => d.estado !== 'validado')
    const validados = docs.filter((d) => d.estado === 'validado')
    const total = docs.length
    const cumplimiento = total ? Math.round((validados.length / total) * 100) : 0

    if (kpiDocsPendientes) kpiDocsPendientes.textContent = pendientes.length
    if (kpiDocsPendientesDetalle) kpiDocsPendientesDetalle.textContent = total ? `${pendientes.length} de ${total}` : '-'
    if (kpiCumplimiento) kpiCumplimiento.textContent = total ? `${cumplimiento}%` : '-'
    if (kpiCumplimientoDetalle) kpiCumplimientoDetalle.textContent = total ? `${validados.length}/${total}` : '-'
    if (badgeCola) badgeCola.textContent = pendientes.length ? `${pendientes.length} pendientes` : '-'

    if (tbodyDocs) {
      tbodyDocs.innerHTML = docs.length
        ? docs.map((doc) => `
            <tr>
              <td>${doc.nombre_archivo || 'Documento'}</td>
              <td>${doc.usuario_id ?? '-'}</td>
              <td>${doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
              <td><span class="badge badge-info">${doc.tipo_documento_id ?? '-'}</span></td>
              <td><span class="badge badge-info">${doc.estado || 'subido'}</span></td>
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
              <td>${doc.usuario_id ?? '-'}</td>
              <td>${doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString() : '-'}</td>
              <td><span class="badge badge-info">${doc.estado || 'subido'}</span></td>
              <td><button class="btn btn-secondary" style="padding:6px 12px;">Ver</button></td>
            </tr>
          `).join('')
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
              <td><button class="btn btn-primary" style="padding:8px 12px;">Revisar</button></td>
            </tr>
          `).join('')
        : renderEmptyRow(5)
    }
  } catch (error) {
    console.warn('No se pudieron cargar documentos', error)
  }
}

async function loadKPIsUsuarios() {
  const kpiUsuarios = document.getElementById('kpiUsuarios')
  const kpiUsuariosDetalle = document.getElementById('kpiUsuariosDetalle')
  try {
    const response = await window.Auth.apiFetch('/api/usuarios')
    const data = await response.json()
    if (!response.ok) return
    const usuarios = Array.isArray(data) ? data : []
    if (kpiUsuarios) kpiUsuarios.textContent = usuarios.length
    if (kpiUsuariosDetalle) kpiUsuariosDetalle.textContent = usuarios.length ? `${usuarios.length} usuarios` : '-'
  } catch (error) {
    console.warn('No se pudieron cargar KPIs de usuarios', error)
  }
}

async function loadSaludSistema() {
  const lista = document.getElementById('listaSaludSistema')
  if (lista) {
    lista.innerHTML = '<div class=\"list-item\"><span>Sin datos</span><span class=\"badge badge-info\">-</span></div>'
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadKPIsUsuarios()
  loadUsuarios()
  loadDocumentos()
  loadSaludSistema()
})


const modal = document.getElementById('modalUsuario');
const btnAbrir = document.getElementById('btnAbrirModal');
const cerrar = document.getElementById('cerrarModal');

btnAbrir.onclick = () => modal.style.display = 'block';
cerrar.onclick = () => modal.style.display = 'none';

window.onclick = (e) => {
  if (e.target === modal) modal.style.display = 'none';
};


document.getElementById('formCrearUsuario')
  .addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      nombre: document.getElementById('nombre').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
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
        alert(result.message || 'Error al crear usuario');
        return;
      }

      alert('Usuario creado correctamente');
      modal.style.display = 'none';
      e.target.reset();

    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    }
  });
