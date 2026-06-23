(function () {
  const LOGIN_URL = '/';

  function getToken() {
    return localStorage.getItem('token');
  }

  function getUser() {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  function parseApiError(data) {
    if (!data) return 'Error desconocido';
    if (data.message) return data.message;
    if (Array.isArray(data.errors) && data.errors.length) {
      return data.errors.map(e => e.msg || e.message).join('. ');
    }
    return 'Error desconocido';
  }

  async function validateSession() {
    const token = getToken();
    const user = getUser();
    if (!token || !user) return null;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        clearSession();
        return null;
      }

      const freshUser = await res.json();
      localStorage.setItem('user', JSON.stringify(freshUser));
      return freshUser;
    } catch {
      return null;
    }
  }

  async function requireAuth(allowedRoles) {
    const user = await validateSession();
    if (!user) {
      alert('Sesión expirada');
      clearSession();
      window.location.replace(LOGIN_URL);
      return null;
    }

    if (allowedRoles && allowedRoles.length && !allowedRoles.includes(user.rol)) {
      alert('No autorizado');
      clearSession();
      window.location.replace(LOGIN_URL);
      return null;
    }

    return user;
  }

  async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = { ...options.headers };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      clearSession();
      window.location.replace(LOGIN_URL);
      throw new Error('Sesión expirada');
    }

    return res;
  }

  function logout() {
    clearSession();
    window.location.replace(LOGIN_URL);
  }

  const PROTECTED_PAGES = {
    'auditor-dashboard.html': ['auditor', 'super_admin'],
    'superadmin-dashboard.html': ['super_admin'],
    'usuario-dashboard.html': ['usuario'],
    'Empresa_Detalles.html': null
  };

  function getCurrentPage() {
    return window.location.pathname.split('/').pop() || '';
  }

  function syncGuard() {
    const page = getCurrentPage();
    const allowedRoles = PROTECTED_PAGES[page];
    if (allowedRoles === undefined) return false;

    const token = getToken();
    const user = getUser();

    if (!token || !user) {
      window.location.replace(LOGIN_URL);
      return true;
    }

    if (allowedRoles && !allowedRoles.includes(user.rol)) {
      window.location.replace(LOGIN_URL);
      return true;
    }

    return false;
  }

  async function runGuard() {
    const page = getCurrentPage();
    const allowedRoles = PROTECTED_PAGES[page];
    if (allowedRoles === undefined) return;

    if (syncGuard()) return;
    await requireAuth(allowedRoles);
  }

  window.Auth = {
    getToken,
    getUser,
    clearSession,
    parseApiError,
    validateSession,
    requireAuth,
    apiFetch,
    logout
  };

  window.logout = logout;

  if (syncGuard()) return;

  const page = getCurrentPage();
  if (PROTECTED_PAGES[page] !== undefined) {
    runGuard();

    window.addEventListener('pageshow', (event) => {
      if (event.persisted || !getToken()) {
        runGuard();
      }
    });
  }
})();
