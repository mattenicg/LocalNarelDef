(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    window.auth.redirectIfAlreadyLoggedIn();

    const form = document.getElementById('loginForm');
    const msgId = 'formMessage';
    const btnId = 'submitBtn';

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      window.auth.setMessage(msgId, '', '');

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      if (!email || !password) {
        window.auth.setMessage(msgId, 'Completá todos los campos.', 'error');
        return;
      }

      window.auth.setButtonLoading(btnId, true, 'ENTRANDO...');

      try {
        const json = await window.auth.apiFetch('/api/auth/login', {
          method: 'POST',
          body: { email, password }
        });

        const type = json.ok ? 'success' : 'error';
        window.auth.setMessage(msgId, json.message || (json.ok ? 'Bienvenido.' : 'Error al iniciar sesión.'), type);

        if (json.ok && json.redirect) {
          window.location.replace(json.redirect);
        }
      } catch (err) {
        window.auth.setMessage(msgId, err.message || 'Error de conexión.', 'error');
      } finally {
        window.auth.setButtonLoading(btnId, false);
      }
    });
  });
})();
