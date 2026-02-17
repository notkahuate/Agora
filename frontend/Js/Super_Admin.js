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

      alert('Usuario creado correctamente');

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


document.addEventListener('DOMContentLoaded', () => {
  cargarUsuariosEmpresa();
});
