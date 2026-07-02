(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const alertBox = document.getElementById('activarAlert');
  const form = document.getElementById('activarForm');
  const emailInput = document.getElementById('activarEmail');
  const descripcion = document.getElementById('activarDescripcion');

  function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.classList.remove('hidden');
    alertBox.classList.toggle('login-alert-error', type === 'error');
    alertBox.classList.toggle('login-alert-success', type === 'success');
  }

  async function validarToken() {
    if (!token) {
      form.style.display = 'none';
      showAlert('Enlace inválido. Solicita una nueva invitación.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/auth/activar/${encodeURIComponent(token)}`);
      const data = await res.json();

      if (!res.ok || !data.valido) {
        form.style.display = 'none';
        showAlert(data.message || 'El enlace no es válido o expiró.', 'error');
        return;
      }

      emailInput.value = data.email || '';
      descripcion.textContent = `Hola ${data.nombre || ''}, define tu contraseña para activar tu cuenta.`;
    } catch (err) {
      form.style.display = 'none';
      showAlert('No se pudo validar el enlace.', 'error');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = document.getElementById('activarPassword').value;
    const confirm = document.getElementById('activarPasswordConfirm').value;

    if (password.length < 6) {
      return showAlert('La contraseña debe tener al menos 6 caracteres.', 'error');
    }

    if (password !== confirm) {
      return showAlert('Las contraseñas no coinciden.', 'error');
    }

    try {
      const res = await fetch('/api/auth/activar-cuenta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return showAlert(data.message || 'No se pudo activar la cuenta.', 'error');
      }

      form.style.display = 'none';
      showAlert(data.message || 'Cuenta activada. Ya puedes iniciar sesión.', 'success');
    } catch (err) {
      showAlert('Error de conexión al activar la cuenta.', 'error');
    }
  });

  validarToken();
})();
