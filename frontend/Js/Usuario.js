const user = window.Auth?.requireAuth(['usuario'])

if (user && document.getElementById('userAvatar')) {
  document.getElementById('userAvatar').textContent = user.nombre
    ? user.nombre.charAt(0)
    : user.email.charAt(0)
}

// Subida de documento (sin archivo físico, solo metadatos)
function uploadDocument(docType) {
  if (!user) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pdf,.doc,.docx,.jpg,.png'

  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const tipoId = prompt('Ingresa el ID del tipo de documento:')
    if (!tipoId) return

    try {
      const response = await window.Auth.apiFetch('/api/documentos', {
        method: 'POST',
        body: JSON.stringify({
          tipo_documento_id: Number(tipoId),
          nombre_archivo: file.name,
          comentarios: `Carga desde UI: ${docType || 'manual'}`
        })
      })

      const data = await response.json()
      if (!response.ok) {
        alert(data.message || 'Error al subir documento')
        return
      }

      alert(`Documento "${file.name}" subido. Queda en revisión.`)
      } catch (error) {
    console.error('Error al cargar documentos:', error)
  }
}

document.addEventListener('DOMContentLoaded', loadDocumentos)}
