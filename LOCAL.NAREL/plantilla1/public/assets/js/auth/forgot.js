(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('forgotForm');
    const msgId = 'formMessage';
    const btnId = 'submitBtn';

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      window.auth.setMessage(msgId, '', '');

      const email = document.getElementById('email').value.trim();

      if (!email) {
        window.auth.setMessage(msgId, 'Ingresá tu correo electrónico.', 'error');
        return;
      }

      window.auth.setButtonLoading(btnId, true, 'ENVIANDO...');

      try {
        const json = await window.auth.apiFetch('/api/auth/forgot-password', {
          method: 'POST',
          body: { email }
        });

        const type = json.ok ? 'success' : 'error';
        window.auth.setMessage(msgId, json.message || (json.ok ? 'Enviado correctamente.' : 'Error al enviar el correo.'), type);

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
