function ocultarAlertaLogin() {
  const box = document.getElementById('loginAlert');
  const form = document.getElementById('loginForm');
  if (!box) return;

  box.classList.remove('show');
  box.classList.add('hidden');
  box.innerHTML = '';
  form?.classList.remove('login-error', 'login-shake');
}

function mostrarAlertaLogin({ titulo, mensaje, tipo = 'error' }) {
  const box = document.getElementById('loginAlert');
  const form = document.getElementById('loginForm');
  if (!box) return;

  const presets = {
    error: {
      titulo: 'Credenciales incorrectas',
      icon: '!',
      accent: 'is-error'
    },
    warning: {
      titulo: 'Problema de conexión',
      icon: '!',
      accent: 'is-warning'
    },
    info: {
      titulo: 'Atención',
      icon: 'i',
      accent: 'is-info'
    }
  };

  const preset = presets[tipo] || presets.error;

  box.innerHTML = `
    <div class="login-alert-card ${preset.accent}">
      <div class="login-alert-accent" aria-hidden="true"></div>
      <div class="login-alert-icon-wrap" aria-hidden="true">
        <span class="login-alert-icon">${preset.icon}</span>
      </div>
      <div class="login-alert-content">
        <div class="login-alert-title">${titulo || preset.titulo}</div>
        <div class="login-alert-message">${mensaje}</div>
      </div>
      <button type="button" class="login-alert-close" aria-label="Cerrar alerta">&times;</button>
    </div>
  `;

  box.querySelector('.login-alert-close')?.addEventListener('click', ocultarAlertaLogin);

  box.classList.remove('hidden');
  box.classList.add('show');

  if (tipo === 'error') {
    form?.classList.add('login-error');
    form?.classList.remove('login-shake');
    void form?.offsetWidth;
    form?.classList.add('login-shake');
  }
}

document.getElementById('email')?.addEventListener('input', ocultarAlertaLogin);
document.getElementById('password')?.addEventListener('input', ocultarAlertaLogin);

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    ocultarAlertaLogin();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            mostrarAlertaLogin({
              titulo: 'Credenciales incorrectas',
              mensaje: data.message || 'El correo o la contraseña no coinciden. Verifica tus datos e intenta nuevamente.',
              tipo: 'error'
            });
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        redirectByRole(data.user.rol);

    } catch (error) {
        console.error("Error:", error);
        mostrarAlertaLogin({
          titulo: 'Servidor no disponible',
          mensaje: 'No pudimos conectar con el servidor. Revisa tu conexión e intenta otra vez.',
          tipo: 'warning'
        });
    }
});

function redirectByRole(rol) {
    switch (rol) {
        case "super_admin":
            window.location.href = "superadmin-dashboard.html";
            break;
        case "auditor":
            window.location.href = "auditor-dashboard.html";
            break;
        case "usuario":
            window.location.href = "usuario-dashboard.html";
            break;
        default:
            mostrarAlertaLogin({
              titulo: 'Rol no reconocido',
              mensaje: 'Tu cuenta tiene un rol desconocido. Contacta al administrador del sistema.',
              tipo: 'info'
            });
            break;
    }
}

(async function checkExistingSession() {
    if (!window.Auth) return;
    const user = await window.Auth.validateSession();
    if (user) {
        redirectByRole(user.rol);
    }
})();
