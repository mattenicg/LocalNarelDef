(function () {
  'use strict';

  let currentUser = null;

  document.addEventListener('DOMContentLoaded', async function () {
    const msgId = 'formMessage';
    const logoutBtn = document.getElementById('logoutBtn');
    const adminBtn = document.getElementById('adminBtn');

    currentUser = await window.auth.requireAuth();
    if (!currentUser) return;

    renderUser(currentUser);

    logoutBtn.addEventListener('click', async function () {
      window.auth.setMessage(msgId, '', '');
      window.auth.setButtonLoading('logoutBtn', true, 'CERRANDO...');

      try {
        const json = await window.auth.apiFetch('/api/auth/logout', { method: 'POST' });
        const type = json.ok ? 'success' : 'error';
        window.auth.setMessage(msgId, json.message || (json.ok ? 'Sesión cerrada.' : 'Error.'), type);

        if (json.ok && json.redirect) {
          window.location.replace(json.redirect);
        } else if (json.ok) {
          window.location.replace('/login.html');
        }
      } catch (err) {
        window.auth.setMessage(msgId, err.message || 'Error de conexión.', 'error');
      } finally {
        window.auth.setButtonLoading('logoutBtn', false);
      }
    });
  });

  function renderUser(user) {
    const name = user.name || user.full_name || user.email || 'Usuario';
    document.getElementById('userName').textContent = name;
    document.getElementById('userNameShort').textContent = truncate(name, 16);
    document.getElementById('userEmail').textContent = truncate(user.email || '-', 24);
    document.getElementById('userRole').textContent = (user.role || 'user').toUpperCase();
    document.getElementById('userId').textContent = user.id ? String(user.id).slice(0, 12).toUpperCase() : '-';
    document.getElementById('roleLabel').textContent = 'PANEL · ' + (user.role || 'USER').toUpperCase();

    if (user.role === 'admin') {
      const adminBtn = document.getElementById('adminBtn');
      adminBtn.style.display = 'inline-flex';
      adminBtn.href = 'admin/dashboard.html';
    }
  }

  function truncate(str, n) {
    if (!str) return '-';
    return str.length > n ? str.slice(0, n - 1) + '…' : str;
  }
})();
