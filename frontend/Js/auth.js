(() => {
  const rawBase = (window.API_BASE || '').trim();
  const API_BASE = rawBase ? rawBase.replace(/\/$/, '') : '';

  const getToken = () => localStorage.getItem('token');

  const getUser = () => {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.warn('No se pudo leer el usuario de localStorage');
      return null;
    }
  };

  const roleDashboard = (role) => {
    switch (role) {
      case 'super_admin':
        return 'superadmin-dashboard.html';
      case 'auditor':
        return 'auditor-dashboard.html';
      case 'usuario':
        return 'usuario-dashboard.html';
      default:
        return 'index.html';
    }
  };

  const requireAuth = (allowedRoles = []) => {
    const token = getToken();
    const user = getUser();
    if (!token || !user) {
      window.location.href = 'index.html';
      return null;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.rol)) {
      window.location.href = roleDashboard(user.rol);
      return null;
    }

    return user;
  };

  const apiFetch = (path, options = {}) => {
    const token = getToken();
    const headers = new Headers(options.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    return fetch(url, { ...options, headers });
  };

  window.Auth = {
    apiFetch,
    getToken,
    getUser,
    requireAuth,
    roleDashboard
  };
})();
