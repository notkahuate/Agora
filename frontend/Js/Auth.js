window.logout = function () {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'http://localhost:3000';
};
