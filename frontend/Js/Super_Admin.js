// ==============================
// AUTH SIMPLE (SIN Auth.js)
// ==============================
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

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
    const token = localStorage.getItem('token');

    const res = await fetch('/api/usuarios/empresa/mios', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();

    // KPI
    document.getElementById('kpiUsuarios').textContent = data.cantidad;

    // Tabla
    const tbody = document.getElementById('tablaUsuarios');
    tbody.innerHTML = '';

    data.usuarios.forEach(usuario => {
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
        <td>
          <span class="badge badge-success">Activo</span>
        </td>
      `;

      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error('Error cargando usuarios:', error);
  }
}



async function cargarColaRevision() {
  try {
    const res = await fetch('http://localhost:3000/api/documentos-requeridos/cola-revision', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();

    const tabla = document.getElementById('tablaColaRevision');
    const badge = document.getElementById('badgeColaRevision');

    tabla.innerHTML = '';
    badge.textContent = data.length;

    data.forEach(doc => {
      const dias = calcularDias(doc.fecha_subida);

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${doc.documento}</td>
        <td>${doc.empresa}</td>
        <td>
          <span class="badge ${getColorPrioridad(doc.prioridad)}">
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
};

function calcularDias(fecha) {
  const hoy = new Date();
  const f = new Date(fecha);
  return Math.floor((hoy - f) / (1000 * 60 * 60 * 24));
}

function getColorPrioridad(prioridad) {
  if (prioridad === 'alta') return 'badge-danger';
  if (prioridad === 'media') return 'badge-warning';
  return 'badge-success';
}

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
    const empresaId = 1;

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
  cargarColaRevision();   // 🔥 NUEVO
  cargarKPIs();           // 🔥 NUEVO
});