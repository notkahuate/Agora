const checkAuth = () => ({ name: "Usuario Safety", company: "Mi Empresa" })

const user = checkAuth()

if (user && document.getElementById("userAvatar")) {
  document.getElementById("userAvatar").textContent = user.name.charAt(0)
}

// Función para simular subida de documento
function uploadDocument(docType) {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".pdf,.doc,.docx,.jpg,.png"

  input.onchange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Simular subida
      alert(`Documento "${file.name}" subido exitosamente.\n\nEste documento será revisado por el auditor.`)

      // En una aplicación real, aquí se enviaría el archivo al servidor
      console.log("[v0] Documento a subir:", file.name, "Tipo:", docType)
    }
  }

  input.click()
}
