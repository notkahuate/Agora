// ==============================
// AUTH SIMPLE (SIN Auth.js)
// ==============================
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

let usuariosGlobal = [];
let paginaUsuarios = 1;
const limiteUsuarios = 5;

let documentosGlobal = [];
let paginaDocumentos = 1;
const limiteDocumentos = 5;

console.log("USER:", user);

if (!token || !user) {
  alert('Sesión expirada');
  window.location.href = 'http://localhost:3000';
}

if (user && user.rol !== 'super_admin') {
  alert('No autorizado');
  window.location.href = 'http://localhost:3000';
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
const btnAbrir = document.getElementById('btnAbrirModal');
const cerrar = document.getElementById('cerrarModal');

btnAbrir.onclick = () => modal.style.display = 'block';
cerrar.onclick = () => modal.style.display = 'none';

window.onclick = (e) => {
  if (e.target === modal) modal.style.display = 'none';
};

// Crear usuario
document.getElementById('formCrearUsuario')
  .addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      nombre: document.getElementById('nombre').value.trim(),
      email: document.getElementById('email').value.trim(),
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

      showAlert();

      modal.style.display = 'none';
      e.target.reset();

      // 🔥 ESTA ES LA CLAVE
      await cargarUsuariosEmpresa();

    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    }
  });

async function cargarUsuariosEmpresa() {
  try {
    const res = await fetch('/api/usuarios/empresa/mios', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();

    document.getElementById('kpiUsuarios').textContent = data.cantidad;

    usuariosGlobal = data.usuarios; // 🔥 GUARDAR
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

    tr.innerHTML = `
      <td>${usuario.nombre}</td>
      <td>—</td>
      <td>0</td>
      <td>
        <div class="progress-bar">
          <div class="progress" style="width:70%"></div>
        </div>
      </td>
      <td><span class="badge badge-success">Activo</span></td>
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
  paginaUsuarios += direccion;
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
};

async function cargarColaRevision() {
  try {
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const res = await fetch('http://localhost:3000/api/documentos-requeridos/cola-revision', { headers });
    const docs = await res.json();

    const tabla = document.getElementById('tablaColaRevision');
    const badge = document.getElementById('badgeColaRevision');

    tabla.innerHTML = '';
    badge.textContent = docs.length;

    console.log("COLA REVISION:", docs);

    docs.forEach(doc => {
      const dias = calcularDias(doc.fecha_limite);

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${doc.documento} (${doc.porcentaje}%)</td> <!-- 🔥 AQUÍ -->
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
        <td>${dias} días</td>
        <td>
          <button class="btn btn-primary" onclick="validarDocumento(${doc.id})">
            Revisar
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
function calcularDias(fecha) {
  const hoy = new Date();
  const f = new Date(fecha);
  return Math.floor((hoy - f) / (1000 * 60 * 60 * 24));
};
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

    const estado = doc.estado || 'pendiente';

    tr.innerHTML = `
      <td>${doc.tipo_documento}</td>
      <td>—</td>
      <td>${new Date(doc.fecha_limite).toLocaleDateString()}</td>
      <td>${doc.prioridad}</td>
      <td>
        <span class="badge ${
          estado === 'pendiente'
            ? 'badge-warning'
            : estado === 'aprobado'
            ? 'badge-success'
            : 'badge-danger'
        }">
          ${estado}
        </span>
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
  paginaDocumentos += direccion;
  renderDocumentos();
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
};


document.addEventListener('DOMContentLoaded', () => {
  cargarUsuariosEmpresa();
  cargarColaRevision();
  cargarKPIs();

  // 🔥 NUEVOS
  cargarCumplimientoGlobal();
  cargarDocumentos();
});