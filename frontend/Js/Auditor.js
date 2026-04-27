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

  // Cargar datos según el tab
  if (tabName === 'documentos') {
    cargarDocumentos();
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

function verEmpresa(id) {
  window.location.href = `/Empresa_Detalles.html?id=${id}`;
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
          <button class="btn btn-success" onclick="validarDocumento('${doc.id}', 'aprobar')">
            Aprobar
          </button>
          <button class="btn btn-danger" onclick="validarDocumento('${doc.id}', 'rechazar')">
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
      cargarDocumentos(); // Recargar la tabla

      // Actualizar KPI si se aprobó
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

    const tbody = document.getElementById('tablaColaPrioritaria');
    const badge = document.getElementById('badgeCola');

    tbody.innerHTML = '';
    badge.textContent = top5.length;

    if (top5.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">No hay documentos pendientes</td>
        </tr>
      `;
      return;
    }

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
