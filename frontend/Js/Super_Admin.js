// Import the checkAuth function
function checkAuth() {
  // Placeholder for authentication logic
  return {
    name: "John Doe",
    company: "Alibaba Cloud",
  }
}

// Verificar autenticación
const user = checkAuth()

if (user) {
  document.getElementById("userName").textContent = user.name
  document.getElementById("userCompany").textContent = user.company
  document.getElementById("userAvatar").textContent = user.name.charAt(0)
}

// Función para cambiar entre tabs
function switchTab(tabName) {
  // Remover clase active de todos los tabs
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active")
  })

  // Ocultar todo el contenido
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active")
  })

  // Activar el tab seleccionado
  event.target.classList.add("active")
  document.getElementById("tab-" + tabName).classList.add("active")
}

