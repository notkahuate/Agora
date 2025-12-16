const checkAuth = () => ({ name: "Alex Auditor" })

const user = checkAuth()

if (user && document.getElementById("userAvatar")) {
  document.getElementById("userAvatar").textContent = user.name.charAt(0)
}

function switchTab(tabName, evt) {
  document.querySelectorAll(".pill").forEach((tab) => tab.classList.remove("is-active"))
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"))

  const trigger = evt?.currentTarget || document.querySelector(`[data-tab="${tabName}"]`)
  if (trigger) trigger.classList.add("is-active")
  const panel = document.getElementById("tab-" + tabName)
  if (panel) panel.classList.add("active")
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
