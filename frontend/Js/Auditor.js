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
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const [empresasRes, usuariosRes] = await Promise.all([
      fetch('http://localhost:3000/api/empresas', { headers }),
      fetch('http://localhost:3000/api/usuarios', { headers })
    ]);

    const empresas = await empresasRes.json();
    const usuarios = await usuariosRes.json();

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
      const cumplimiento = totalPendientes === 0
        ? 100
        : Math.max(0, 100 - totalPendientes * 10);

      // 🔥 SUMAR PARA KPI GLOBAL
      sumaCumplimiento += cumplimiento;

      // ==============================
      // 🚨 RIESGO
      // ==============================
      const enRiesgo = cumplimiento < 70;

      if (enRiesgo) {
        empresasRiesgo.push({
          nombre: e.nombre,
          pendientes: totalPendientes
        });
      }

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${e.nombre}</td>

        <td>${usuariosEmpresa.length}</td>

        <td>
          <span class="badge ${totalPendientes > 0 ? 'badge-warning' : 'badge-success'}">
            ${totalPendientes}
          </span>
        </td>

        <td>
          <div class="progress-bar">
            <div class="progress" style="width:${cumplimiento}%"></div>
          </div>
          <small>${cumplimiento}%</small>
        </td>

        <td>
          <span class="badge ${enRiesgo ? 'badge-danger' : 'badge-success'}">
            ${enRiesgo ? 'En riesgo' : 'Estable'}
          </span>
        </td>

        <td>
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

function verEmpresa(id) {
  window.location.href = `/Empresa_Detalles.html?id=${id}`;
}
async function cargarColaPrioritaria() {
  try {
    const headers = {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    };

    // 🔥 1. TRAER EMPRESAS
    const resEmpresas = await fetch('http://localhost:3000/api/empresas', { headers });
    const empresas = await resEmpresas.json();

    // 🔥 2. TRAER PENDIENTES POR EMPRESA
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

    // 🔥 3. UNIR TODO (AQUÍ SE CREA)
    const todosPendientes = pendientesPorEmpresa.flat();

    // 🔥 4. ORDENAR POR PORCENTAJE + FECHA
    const ordenados = todosPendientes.sort((a, b) => {
      const porcentajeA = parseFloat(a.porcentaje) || 0;
      const porcentajeB = parseFloat(b.porcentaje) || 0;

      // 🔝 MAYOR PORCENTAJE PRIMERO
      if (porcentajeB !== porcentajeA) {
        return porcentajeB - porcentajeA;
      }

      // ⏱ SI EMPATAN → MÁS URGENTE
      return new Date(a.fecha_limite) - new Date(b.fecha_limite);
    });

    // 🔥 5. TOP 5
    const top5 = ordenados.slice(0, 5);

    const tbody = document.getElementById('tablaColaPrioritaria');
    const badge = document.getElementById('badgeCola');

    tbody.innerHTML = '';
    badge.textContent = top5.length;

    top5.forEach(doc => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${doc.nombre} (${doc.porcentaje}%)</td>
        <td>${doc.empresa}</td>
        <td>
          <span class="badge badge-${
            doc.prioridad === 'alta'
              ? 'danger'
              : doc.prioridad === 'media'
              ? 'warning'
              : 'info'
          }">
            ${doc.prioridad}
          </span>
        </td>
        <td>${new Date(doc.fecha_limite).toLocaleDateString()}</td>
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
// INIT
// ==============================
document.addEventListener('DOMContentLoaded', () => {
  cargarEmpresas();
  cargarColaPrioritaria();
});
