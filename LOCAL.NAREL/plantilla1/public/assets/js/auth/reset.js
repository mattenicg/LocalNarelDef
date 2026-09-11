(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('access_token') || hashParams.get('access_token') || '';
    const refreshToken = params.get('refresh_token') || hashParams.get('refresh_token') || '';
    document.getElementById('accessToken').value = token;

    const form = document.getElementById('resetForm');
    const msgId = 'formMessage';
    const btnId = 'submitBtn';

    if (!token) {
      window.auth.setMessage(msgId, 'Token inválido o faltante. Solicitá un nuevo enlace de recuperación.', 'error');
      document.getElementById(btnId).disabled = true;
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      window.auth.setMessage(msgId, '', '');

      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const access_token = document.getElementById('accessToken').value;

      if (!access_token) {
        window.auth.setMessage(msgId, 'Token inválido. Solicitá un nuevo enlace.', 'error');
        return;
      }
      if (!password || !confirmPassword) {
        window.auth.setMessage(msgId, 'Completá ambos campos de contraseña.', 'error');
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

      window.auth.setButtonLoading(btnId, true, 'GUARDANDO...');

      try {
        const json = await window.auth.apiFetch('/api/auth/reset-password', {
          method: 'POST',
          body: {
            new_password: password,
            confirm_password: confirmPassword,
            access_token,
            refresh_token: refreshToken
          }
        });

        const type = json.ok ? 'success' : 'error';
        window.auth.setMessage(msgId, json.message || (json.ok ? 'Contraseña actualizada.' : 'Error al restablecer.'), type);

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
