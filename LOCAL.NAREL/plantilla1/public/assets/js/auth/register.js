(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    window.auth.redirectIfAlreadyLoggedIn();

    const form = document.getElementById('registerForm');
    const msgId = 'formMessage';
    const btnId = 'submitBtn';

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      window.auth.setMessage(msgId, '', '');

      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const terms = document.getElementById('terms').checked;

      if (!name || !email || !password || !confirmPassword) {
        window.auth.setMessage(msgId, 'Completá todos los campos.', 'error');
        return;
      }
      if (password.length < 6) {
        window.auth.setMessage(msgId, 'La contraseña debe tener al menos 6 caracteres.', 'error');
        return;
      }
      if (password !== confirmPassword) {
        window.auth.setMessage(msgId, 'Las contraseñas no coinciden.', 'error');
        return;
      }
      if (!terms) {
        window.auth.setMessage(msgId, 'Debés aceptar los términos y condiciones.', 'error');
        return;
      }

      window.auth.setButtonLoading(btnId, true, 'CREANDO...');

      try {
        const json = await window.auth.apiFetch('/api/auth/register', {
          method: 'POST',
          body: { name, email, password, confirm_password: confirmPassword }
        });

        const type = json.ok ? 'success' : 'error';
        window.auth.setMessage(msgId, json.message || (json.ok ? 'Cuenta creada correctamente.' : 'Error al crear la cuenta.'), type);

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
