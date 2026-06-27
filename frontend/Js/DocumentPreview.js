(function () {
  function getToken() {
    return window.Auth ? window.Auth.getToken() : localStorage.getItem('token');
  }

  function parseError(data) {
    return window.Auth ? window.Auth.parseApiError(data) : (data?.message || 'Error desconocido');
  }

  function puedeEliminarDocumento() {
    const user = window.Auth ? window.Auth.getUser() : null;
    return user && ['super_admin', 'auditor', 'usuario'].includes(user.rol);
  }

  function cerrarModal(modal, previewUrl) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (modal && modal.parentNode) modal.remove();
  }

  async function eliminarDocumento(id) {
    if (!id) return false;
    if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) {
      return false;
    }

    try {
      const res = await fetch(`http://localhost:3000/api/documentos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(parseError(data) || 'No se pudo eliminar el documento');
        return false;
      }

      alert('Documento eliminado correctamente');
      return true;
    } catch (err) {
      console.error('Error eliminando documento:', err);
      alert('Error al eliminar el documento');
      return false;
    }
  }

  async function show(id, nombreArchivo, options = {}) {
    const { onDeleted } = options;

    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const docRes = await fetch(`http://localhost:3000/api/documentos/${id}`, { method: 'GET', headers });

      if (!docRes.ok) {
        alert('Error al obtener el documento');
        return;
      }

      const doc = await docRes.json();
      const nombre = nombreArchivo || doc.nombre_archivo || 'documento';
      const extension = String(nombre).split('.').pop().toLowerCase();
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension);
      const isPdf = extension === 'pdf';

      let previewUrl = null;
      if (isImage || isPdf) {
        const previewRes = await fetch(`http://localhost:3000/api/documentos/${id}/descargar`, {
          method: 'GET',
          headers
        });
        if (!previewRes.ok) {
          throw new Error('No se pudo obtener el archivo para previsualizar');
        }
        const blob = await previewRes.blob();
        previewUrl = URL.createObjectURL(blob);
      }

      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.55);
        display: flex; justify-content: center; align-items: center;
        z-index: 10000; padding: 16px;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background: white; padding: 20px; border-radius: 8px;
        max-width: 90%; max-height: 90vh; overflow: auto;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2); width: min(900px, 100%);
      `;

      const titulo = document.createElement('h3');
      titulo.textContent = nombre;
      titulo.style.cssText = 'margin: 0 0 16px 0; font-size: 18px; word-break: break-word;';
      content.appendChild(titulo);

      if (isImage && previewUrl) {
        const img = document.createElement('img');
        img.style.cssText = 'max-width: 100%; max-height: 65vh; display: block; margin: 0 auto;';
        img.src = previewUrl;
        content.appendChild(img);
      } else if (isPdf && previewUrl) {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'width: 100%; height: 65vh; border: none;';
        iframe.src = previewUrl;
        content.appendChild(iframe);
      } else {
        const p = document.createElement('p');
        p.textContent = 'Vista previa no disponible para este tipo de archivo.';
        p.style.cssText = 'margin: 12px 0 20px; color: #64748b;';
        content.appendChild(p);
      }

      const acciones = document.createElement('div');
      acciones.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; justify-content: flex-end;';

      const btnDescargar = document.createElement('button');
      btnDescargar.className = 'btn btn-secondary';
      btnDescargar.textContent = 'Descargar';
      btnDescargar.onclick = async () => {
        if (typeof window.descargarDocumento === 'function') {
          window.descargarDocumento(id, nombre);
          return;
        }
        try {
          const res = await fetch(`http://localhost:3000/api/documentos/${id}/descargar`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${getToken()}` }
          });
          if (!res.ok) throw new Error('Error al descargar');
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = nombre;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } catch (err) {
          alert('Error al descargar el documento');
        }
      };

      const btnCerrar = document.createElement('button');
      btnCerrar.className = 'btn btn-secondary';
      btnCerrar.textContent = 'Cerrar';
      btnCerrar.onclick = () => cerrarModal(modal, previewUrl);

      acciones.appendChild(btnDescargar);

      if (puedeEliminarDocumento()) {
        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btn btn-danger';
        btnEliminar.textContent = 'Eliminar';
        btnEliminar.onclick = async () => {
          const ok = await eliminarDocumento(id);
          if (ok) {
            cerrarModal(modal, previewUrl);
            if (typeof onDeleted === 'function') onDeleted();
          }
        };
        acciones.appendChild(btnEliminar);
      }

      acciones.appendChild(btnCerrar);
      content.appendChild(acciones);
      modal.appendChild(content);

      modal.onclick = (e) => {
        if (e.target === modal) cerrarModal(modal, previewUrl);
      };

      document.body.appendChild(modal);
    } catch (err) {
      console.error('Error en preview:', err);
      alert('Error al previsualizar documento');
    }
  }

  window.previewDocumento = show;
  window.eliminarDocumentoDesdePreview = eliminarDocumento;
  window.DocumentPreview = { show, eliminar: eliminarDocumento };
})();
