// Verificar autenticación
const checkAuth = () => {
  // Simulación de autenticación
  return { name: "John Doe" }
}

const user = checkAuth()

if (user) {
  document.getElementById("userName").textContent = user.name
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

// Función para revisar documentos
function reviewDocument(action) {
  const actionText = action === "approve" ? "aprobado" : "rechazado"
  const message =
    action === "approve"
      ? "El documento ha sido aprobado exitosamente."
      : "El documento ha sido rechazado. Se notificará al usuario."

  if (confirm(`¿Estás seguro de que deseas ${action === "approve" ? "aprobar" : "rechazar"} este documento?`)) {
    alert(message)
    console.log("[v0] Documento", actionText)
  }
}
