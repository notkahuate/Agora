/**
 * Widget compartido de actividad reciente — carga ligera y no bloqueante.
 */
const ActividadReciente = (function () {
  const LIMITE_PAGINA = 7;
  const FETCH_LIMIT = 21;
  const REFRESH_MS = 30000;
  const registry = {};

  function obtenerToken() {
    return window.Auth?.getToken?.() || localStorage.getItem('token') || '';
  }

  function iconoActividad(evento) {
    const entidadTexto = String(evento.entidad || '').replace(/_/g, ' ');
    if (evento.accion === 'crear') return { color: '#10b981', icono: '✚' };
    if (evento.accion === 'actualizar') return { color: '#3b82f6', icono: '⟳' };
    if (evento.accion === 'eliminar') return { color: '#ef4444', icono: '✕' };
    if (['validar', 'aprobar', 'revisar'].includes(evento.accion)) return { color: '#8b5cf6', icono: '✓' };
    if (evento.accion === 'descargar') return { color: '#0ea5e9', icono: '↓' };
    if (evento.accion === 'subir') return { color: '#f59e0b', icono: '↑' };
    if (evento.accion === 'asignar') return { color: '#f59e0b', icono: '→' };
    if (evento.accion === 'alerta') return { color: '#ef4444', icono: '!' };
    if (entidadTexto.toLowerCase().includes('documento')) return { color: '#f97316', icono: '📄' };
    return { color: '#94a3b8', icono: '●' };
  }

  function formatearFecha(fechaStr) {
    const fecha = new Date(fechaStr || Date.now());
    if (Number.isNaN(fecha.getTime())) return '-';
    return fecha.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function hashEventos(eventos) {
    if (!eventos?.length) return '';
    return eventos.map(e => `${e.id}-${e.fecha_evento}`).join('|');
  }

  function buildAuditoriaUrl(limit, options = {}) {
    const safeLimit = Math.max(1, parseInt(limit, 10) || FETCH_LIMIT);
    let url = `/api/auditoria?limit=${safeLimit}&offset=0&skipCount=1`;
    if (options.empresaId != null && options.empresaId !== '') {
      url += `&empresa_id=${encodeURIComponent(options.empresaId)}`;
    }
    return url;
  }

  function escaparHtml(texto) {
    return String(texto ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function crearWidget(config) {
    const state = {
      timelineId: config.timelineId,
      paginacionId: config.paginacionId,
      buildUrl: config.buildUrl,
      limite: config.limite || LIMITE_PAGINA,
      refreshMs: config.refreshMs || REFRESH_MS,
      mensajeVacio: config.mensajeVacio || 'Sin eventos registrados',
      pagina: 1,
      eventos: [],
      cargando: false,
      pendingRefresh: false,
      inicializada: false,
      abortController: null,
      lastHash: '',
      intervalId: null
    };

    function getTimeline() {
      return document.getElementById(state.timelineId);
    }

    function renderMensaje(texto, esError = false) {
      const timeline = getTimeline();
      if (!timeline) return;
      timeline.innerHTML = `<p class="timeline-message${esError ? ' is-error' : ''}">${texto}</p>`;
    }

    function renderPaginacion() {
      const container = document.getElementById(state.paginacionId);
      if (!container) return;

      const total = state.eventos.length;
      const totalPaginas = Math.max(1, Math.ceil(total / state.limite));
      if (total <= state.limite) {
        container.innerHTML = '';
        return;
      }

      container.innerHTML = `
        <button type="button" class="btn btn-secondary btn-sm" onclick="ActividadReciente.cambiarPagina('${state.timelineId}', -1)" ${state.pagina === 1 ? 'disabled' : ''}>⬅ Anterior</button>
        <span>Página ${state.pagina} de ${totalPaginas}</span>
        <button type="button" class="btn btn-secondary btn-sm" onclick="ActividadReciente.cambiarPagina('${state.timelineId}', 1)" ${state.pagina === totalPaginas ? 'disabled' : ''}>Siguiente ➡</button>`;
    }

    function renderEventos(force = false) {
      const timeline = getTimeline();
      if (!timeline) return;

      const inicio = (state.pagina - 1) * state.limite;
      const paginaEventos = state.eventos.slice(inicio, inicio + state.limite);
      const newHash = `${hashEventos(state.eventos)}:${state.pagina}`;

      if (!force && newHash === state.lastHash && state.inicializada) {
        renderPaginacion();
        return;
      }
      state.lastHash = newHash;

      if (!paginaEventos.length) {
        renderMensaje(state.mensajeVacio);
        renderPaginacion();
        return;
      }

      timeline.innerHTML = paginaEventos.map(evento => {
        const { color, icono } = iconoActividad(evento);
        const descripcion = evento.descripcion
          || `${evento.accion || 'Evento'} en ${String(evento.entidad || 'sistema').replace(/_/g, ' ')}`;
        const usuario = evento.usuario_nombre || 'Sistema';

        return `
          <article class="timeline-entry">
            <div class="timeline-entry-icon" style="background:${color}20;color:${color}">${icono}</div>
            <div class="timeline-entry-body">
              <p class="timeline-entry-title">${escaparHtml(descripcion)}</p>
              <p class="timeline-entry-meta">${escaparHtml(usuario)} • ${escaparHtml(formatearFecha(evento.fecha_evento))}</p>
            </div>
          </article>`;
      }).join('');

      renderPaginacion();
    }

    async function fetchEventos() {
      if (state.abortController) state.abortController.abort();
      state.abortController = new AbortController();

      const url = state.buildUrl(FETCH_LIMIT);
      const options = { signal: state.abortController.signal };
      let res;

      if (window.Auth?.apiFetch) {
        res = await window.Auth.apiFetch(url, options);
      } else {
        res = await fetch(url, {
          ...options,
          headers: { Authorization: `Bearer ${obtenerToken()}` }
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Error cargando actividad');
      }

      const data = await res.json();
      return Array.isArray(data.eventos) ? data.eventos : (Array.isArray(data) ? data : []);
    }

    async function cargar(pagina = 1, forceFetch = false, silent = false) {
      if (!getTimeline()) return;

      state.pagina = Math.max(1, parseInt(pagina) || 1);
      const needsFetch = forceFetch || !state.eventos.length;

      if (!needsFetch) {
        const totalPaginas = Math.max(1, Math.ceil(state.eventos.length / state.limite));
        state.pagina = Math.min(state.pagina, totalPaginas);
        renderEventos(true);
        return;
      }

      if (state.cargando) {
        state.pendingRefresh = true;
        return;
      }

      try {
        state.cargando = true;
        if (!silent && !state.inicializada) {
          renderMensaje('Cargando actividad...');
        }

        state.eventos = await fetchEventos();
        state.inicializada = true;

        const totalPaginas = Math.max(1, Math.ceil(state.eventos.length / state.limite));
        state.pagina = Math.min(state.pagina, totalPaginas);
        renderEventos(true);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Error actividad reciente:', err);
        renderMensaje(err.message || 'No se pudo cargar la actividad reciente.', true);
        renderPaginacion();
      } finally {
        state.cargando = false;
        if (state.pendingRefresh) {
          state.pendingRefresh = false;
          cargar(state.pagina, true, true);
        }
      }
    }

    async function refrescarSilenciosa() {
      if (document.hidden) return;
      if (state.cargando) {
        state.pendingRefresh = true;
        return;
      }

      const prevHash = hashEventos(state.eventos);
      try {
        state.cargando = true;
        const nuevos = await fetchEventos();
        if (hashEventos(nuevos) !== prevHash || !state.inicializada) {
          state.eventos = nuevos;
          state.inicializada = true;
          const totalPaginas = Math.max(1, Math.ceil(state.eventos.length / state.limite));
          state.pagina = Math.min(state.pagina, totalPaginas);
          renderEventos(true);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error refrescando actividad:', err);
        }
      } finally {
        state.cargando = false;
        if (state.pendingRefresh) {
          state.pendingRefresh = false;
          refrescarSilenciosa();
        }
      }
    }

    function invalidar() {
      state.eventos = [];
      state.lastHash = '';
      state.inicializada = false;
      state.pagina = 1;
    }

    function invalidarYRecargar() {
      invalidar();
      return cargar(1, true, true);
    }

    function iniciarAutoRefresh() {
      detenerAutoRefresh();
      state.intervalId = setInterval(refrescarSilenciosa, state.refreshMs);
    }

    function detenerAutoRefresh() {
      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
      }
    }

    function cambiarPagina(direccion) {
      const totalPaginas = Math.max(1, Math.ceil(state.eventos.length / state.limite));
      const nueva = Math.min(totalPaginas, Math.max(1, state.pagina + direccion));
      if (nueva === state.pagina) return;
      state.pagina = nueva;
      renderEventos(true);
    }

    const api = {
      init() {
        cargar(1, true);
        iniciarAutoRefresh();
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) detenerAutoRefresh();
          else iniciarAutoRefresh();
        });
      },
      cargar,
      refrescarSilenciosa,
      invalidar,
      invalidarYRecargar,
      cambiarPagina,
      detenerAutoRefresh
    };

    registry[state.timelineId] = api;
    return api;
  }

  function cambiarPagina(timelineId, direccion) {
    registry[timelineId]?.cambiarPagina(direccion);
  }

  return {
    crearWidget,
    cambiarPagina,
    buildAuditoriaUrl,
    iconoActividad,
    LIMITE_PAGINA
  };
})();

window.ActividadReciente = ActividadReciente;
