// ==============================
// AUTH SIMPLE (SIN auth.js)
// ==============================
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
  alert('Sesión expirada');
  window.location.href = 'http://localhost:3000';
}

// solo auditor o super admin
if (!['auditor', 'super_admin'].includes(user.rol)) {
  alert('No autorizado');
  window.location.href = 'http://localhost:3000/';
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
    const res = await fetch('http://localhost:3000/api/empresas', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      console.error('Error endpoint empresas');
      return;
    }

    const empresas = await res.json();

    // KPI
    kpiEmpresas.textContent = empresas.length;
    kpiEmpresasDetalle.textContent = `${empresas.length} registradas`;

    // Empresas en riesgo (simple visual)
    const riesgo = empresas.slice(0, 4);
    badgeRiesgo.textContent = riesgo.length;

    listaRiesgo.innerHTML = riesgo.length
      ? riesgo.map(e => `
          <div class="list-item">
            <span>${e.nombre}</span>
            <span class="badge badge-warning">Revisión</span>
          </div>
        `).join('')
      : `<div class="list-item"><span>Sin datos</span></div>`;

    // Tabla principal
    tablaEmpresas.innerHTML = empresas.length
      ? empresas.map(e => `
          <tr>
            <td>${e.nombre}</td>
            <td>-</td>
            <td>-</td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" style="width:0%"></div>
              </div>
            </td>
            <td>
              <span class="badge ${e.activa ? 'badge-success' : 'badge-warning'}">
                ${e.activa ? 'Activa' : 'Inactiva'}
              </span>
            </td>
            <td>
              <button class="btn btn-secondary" style="padding:6px 12px;">Ver</button>
            </td>
          </tr>
        `).join('')
      : `<tr><td colspan="6">Sin empresas</td></tr>`;

  } catch (err) {
    console.error('Error cargando empresas:', err);
  }
}

// ==============================
// INIT
// ==============================
document.addEventListener('DOMContentLoaded', () => {
  cargarEmpresas();
});
