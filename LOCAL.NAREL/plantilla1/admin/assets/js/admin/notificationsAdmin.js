(function () {
  'use strict';

  class NotificationsAdmin {
    constructor(options = {}) {
      this.containerId = options.containerId || 'notificationsAdminContainer';
      this.container = null;
      this.settings = null;
      this.logs = [];
      this.loading = false;
      this.saving = false;
      this.testing = false;
    }

    async init() {
      this.container = document.getElementById(this.containerId);
      if (!this.container) return;
      this.renderLoading();
      await this.loadData();
      this.render();
      this.bindEvents();
    }

    async loadData() {
      try {
        const [settingsRes, logsRes] = await Promise.all([
          window.auth.apiFetch('/api/admin/notifications/settings', { method: 'GET' }),
          window.auth.apiFetch('/api/admin/notifications/logs?limit=15', { method: 'GET' }),
        ]);

        if (settingsRes.ok && settingsRes.data) {
          this.settings = settingsRes.data;
        } else {
          this.settings = {
            adminNotificationEnabled: true,
            adminEmail: 'localnarel@gmail.com',
            customerNotificationEnabled: true,
            smtpHost: '',
            smtpPort: 587,
            smtpUser: '',
            smtpPassword: '',
            smtpFrom: 'Narel Local <localnarel@gmail.com>',
            orderPreparationMessage: '¡Tu pedido fue recibido con éxito y ya está siendo preparado en nuestro taller! Te avisaremos ante cualquier novedad o cuando esté listo para su despacho o retiro.',
          };
        }

        if (logsRes.ok && Array.isArray(logsRes.data)) {
          this.logs = logsRes.data;
        }
      } catch (err) {
        console.error('Error cargando configuración de notificaciones:', err);
      }
    }

    renderLoading() {
      if (!this.container) return;
      this.container.innerHTML = `
        <div style="padding:28px;background:#141414;border:1px solid #2a2a2a;border-radius:8px;text-align:center;">
          <p style="font-family:'DM Mono',monospace;font-size:13px;color:#b0b0b0;margin:0;">
            Cargando configuración de notificaciones...
          </p>
        </div>
      `;
    }

    render() {
      if (!this.container) return;
      const s = this.settings || {};

      const logsHtml = this.logs.length > 0 ? this.logs.map((log) => {
        let statusBadge = '';
        if (log.status === 'sent') {
          statusBadge = '<span style="color:#2ecc71;background:rgba(46,204,113,0.1);padding:2px 8px;border-radius:4px;border:1px solid rgba(46,204,113,0.3);">ENVIADO (SMTP)</span>';
        } else if (log.status === 'logged') {
          statusBadge = '<span style="color:#3498db;background:rgba(52,152,219,0.1);padding:2px 8px;border-radius:4px;border:1px solid rgba(52,152,219,0.3);">REGISTRADO EN LOGS</span>';
        } else {
          statusBadge = `<span style="color:#e74c3c;background:rgba(231,76,60,0.1);padding:2px 8px;border-radius:4px;border:1px solid rgba(231,76,60,0.3);" title="${log.error_message || ''}">ERROR</span>`;
        }

        const dateFormatted = new Date(log.created_at).toLocaleString('es-AR', {
          dateStyle: 'short',
          timeStyle: 'short',
        });

        return `
          <tr style="border-bottom:1px solid #222;">
            <td style="padding:10px 12px;font-family:'DM Mono',monospace;font-size:11px;color:#888;">${dateFormatted}</td>
            <td style="padding:10px 12px;font-family:'DM Mono',monospace;font-size:12px;color:#fff;">
              ${log.order_number ? `<b>#${log.order_number}</b>` : '<span style="color:#666;">—</span>'}
            </td>
            <td style="padding:10px 12px;font-size:12px;color:#fff;">
              <span style="display:block;font-weight:bold;">${log.recipient}</span>
              <span style="display:block;font-size:11px;color:#888;font-family:'DM Mono',monospace;">${log.subject}</span>
            </td>
            <td style="padding:10px 12px;font-family:'DM Mono',monospace;font-size:11px;">
              ${statusBadge}
            </td>
          </tr>
        `;
      }).join('') : `
        <tr>
          <td colspan="4" style="padding:20px;text-align:center;color:#666;font-family:'DM Mono',monospace;font-size:12px;">
            Aún no hay registros de notificaciones emitidas.
          </td>
        </tr>
      `;

      this.container.innerHTML = `
        <div class="notifications-admin-panel" style="background:#141414;border:1px solid #2a2a2a;border-radius:8px;padding:24px;margin-bottom:32px;">
          
          <!-- ENCABEZADO DE SECCIÓN -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;border-bottom:1px solid #2a2a2a;padding-bottom:18px;margin-bottom:24px;">
            <div>
              <span style="font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.2em;color:#999;text-transform:uppercase;display:block;">[ SISTEMA DE CORREO AUTOMÁTICO ]</span>
              <h2 style="font-family:'Oswald',sans-serif;font-size:22px;color:#fff;margin:4px 0 6px 0;letter-spacing:.05em;text-transform:uppercase;">
                ✉️ Configuración de Notificaciones por Correo
              </h2>
              <p style="font-family:'DM Mono',monospace;font-size:12px;color:#b0b0b0;margin:0;max-width:700px;line-height:1.5;">
                Notifica automáticamente al administrador cada vez que entra un nuevo pedido y envía al cliente la confirmación de que su pedido está en preparación en el taller.
              </p>
            </div>
            <div style="display:flex;gap:8px;">
              <button type="button" id="btnTestNotification" class="button secondary" style="padding:8px 14px;font-size:12px;width:auto;">
                ⚡ PROBAR ENVÍO
              </button>
            </div>
          </div>

          <!-- MENSAJES FEEDBACK -->
          <div id="notifStatusMessage" style="display:none;margin-bottom:20px;padding:12px 16px;border-radius:6px;font-size:13px;font-family:'DM Mono',monospace;"></div>

          <form id="notificationsConfigForm">
            
            <!-- BLOQUE 1: NOTIFICACIÓN AL ADMINISTRADOR (localnarel@gmail.com) -->
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:18px;margin-bottom:20px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:16px;">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin:0;">
                  <input type="checkbox" id="adminNotificationEnabled" ${s.adminNotificationEnabled ? 'checked' : ''} style="width:18px;height:18px;accent-color:#fff;">
                  <b style="font-family:'Oswald',sans-serif;font-size:16px;color:#fff;letter-spacing:.05em;">NOTIFICAR AL ADMINISTRADOR ANTE UN NUEVO PEDIDO</b>
                </label>
                <span style="font-family:'DM Mono',monospace;font-size:11px;color:#2ecc71;background:rgba(46,204,113,0.1);padding:3px 8px;border-radius:4px;border:1px solid rgba(46,204,113,0.2);">
                  RECOMENDADO
                </span>
              </div>
              <p style="font-family:'DM Mono',monospace;font-size:12px;color:#999;margin:0 0 14px 0;">
                Envía un correo completo con todos los datos del cliente (nombre, teléfono, email), dirección de entrega, método de pago y el detalle prenda por prenda.
              </p>

              <div class="form-group" style="margin:0;">
                <label for="adminEmail" style="display:block;font-family:'Oswald',sans-serif;font-size:13px;letter-spacing:.08em;color:#e0e0e0;margin-bottom:6px;">
                  CORREO ELECTRÓNICO DE DESTINO
                </label>
                <input 
                  type="email" 
                  id="adminEmail" 
                  name="adminEmail" 
                  value="${s.adminEmail || 'localnarel@gmail.com'}" 
                  class="form-control" 
                  style="font-family:'DM Mono',monospace;font-size:14px;background:#0c0c0c;border:1px solid #3a3a3a;color:#fff;padding:10px 14px;border-radius:4px;width:100%;max-width:480px;"
                  placeholder="localnarel@gmail.com"
                  required
                >
                <small style="display:block;color:#888;font-family:'DM Mono',monospace;font-size:11px;margin-top:4px;">
                  Por defecto configurado en <strong>localnarel@gmail.com</strong>. Podés ingresar cualquier dirección a donde quieras recibir las órdenes.
                </small>
              </div>
            </div>

            <!-- BLOQUE 2: NOTIFICACIÓN AL CLIENTE (PEDIDO EN PREPARACIÓN) -->
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:18px;margin-bottom:20px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:16px;">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin:0;">
                  <input type="checkbox" id="customerNotificationEnabled" ${s.customerNotificationEnabled ? 'checked' : ''} style="width:18px;height:18px;accent-color:#fff;">
                  <b style="font-family:'Oswald',sans-serif;font-size:16px;color:#fff;letter-spacing:.05em;">ENVIAR VERIFICACIÓN AL CLIENTE (PEDIDO EN PREPARACIÓN)</b>
                </label>
                <span style="font-family:'DM Mono',monospace;font-size:11px;color:#3498db;background:rgba(52,152,219,0.1);padding:3px 8px;border-radius:4px;border:1px solid rgba(52,152,219,0.2);">
                  EXPERIENCIA DE COMPRA
                </span>
              </div>
              <p style="font-family:'DM Mono',monospace;font-size:12px;color:#999;margin:0 0 14px 0;">
                Envía un correo automático a la dirección de email que el cliente ingresó al pagar con el resumen de su compra, el número de pedido y la confirmación de que está siendo preparado en el taller.
              </p>

              <div class="form-group" style="margin:0;">
                <label for="orderPreparationMessage" style="display:block;font-family:'Oswald',sans-serif;font-size:13px;letter-spacing:.08em;color:#e0e0e0;margin-bottom:6px;">
                  MENSAJE DE PREPARACIÓN PARA EL CLIENTE
                </label>
                <textarea 
                  id="orderPreparationMessage" 
                  name="orderPreparationMessage" 
                  rows="2" 
                  class="form-control" 
                  style="font-family:'DM Mono',monospace;font-size:13px;background:#0c0c0c;border:1px solid #3a3a3a;color:#fff;padding:10px 14px;border-radius:4px;width:100%;resize:vertical;"
                >${s.orderPreparationMessage || '¡Tu pedido fue recibido con éxito y ya está siendo preparado en nuestro taller! Te avisaremos ante cualquier novedad o cuando esté listo para su despacho o retiro.'}</textarea>
              </div>
            </div>

            <!-- BLOQUE 3: SERVIDOR SMTP (CONFIGURABLE U OPCIONAL) -->
            <details style="background:#101010;border:1px solid #2a2a2a;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
              <summary style="cursor:pointer;font-family:'Oswald',sans-serif;font-size:14px;letter-spacing:.08em;color:#ccc;user-select:none;">
                ⚙️ CONFIGURACIÓN AVANZADA DE SERVIDOR DE CORREO (SMTP / GMAIL) ▾
              </summary>
              <div style="margin-top:16px;border-top:1px solid #222;padding-top:16px;">
                <p style="font-family:'DM Mono',monospace;font-size:12px;color:#aaa;margin-bottom:14px;">
                  Podés configurar tu servidor SMTP (o credenciales de Gmail con contraseña de aplicación). Si dejás estos campos vacíos, el sistema guardará y registrará cada correo enviado en el historial y en los logs seguros del servidor.
                </p>
                
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:14px;margin-bottom:14px;">
                  <div class="form-group" style="margin:0;">
                    <label style="display:block;font-family:'DM Mono',monospace;font-size:11px;color:#888;margin-bottom:4px;">HOST SMTP (ej: smtp.gmail.com)</label>
                    <input type="text" id="smtpHost" value="${s.smtpHost || ''}" placeholder="smtp.gmail.com" class="form-control" style="font-family:'DM Mono',monospace;font-size:12px;background:#050505;border:1px solid #333;color:#fff;padding:8px 10px;border-radius:4px;width:100%;">
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label style="display:block;font-family:'DM Mono',monospace;font-size:11px;color:#888;margin-bottom:4px;">PUERTO SMTP (ej: 465 o 587)</label>
                    <input type="number" id="smtpPort" value="${s.smtpPort || 587}" placeholder="587" class="form-control" style="font-family:'DM Mono',monospace;font-size:12px;background:#050505;border:1px solid #333;color:#fff;padding:8px 10px;border-radius:4px;width:100%;">
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label style="display:block;font-family:'DM Mono',monospace;font-size:11px;color:#888;margin-bottom:4px;">USUARIO / EMAIL SMTP</label>
                    <input type="text" id="smtpUser" value="${s.smtpUser || ''}" placeholder="localnarel@gmail.com" class="form-control" style="font-family:'DM Mono',monospace;font-size:12px;background:#050505;border:1px solid #333;color:#fff;padding:8px 10px;border-radius:4px;width:100%;">
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label style="display:block;font-family:'DM Mono',monospace;font-size:11px;color:#888;margin-bottom:4px;">CONTRASEÑA / APP PASSWORD</label>
                    <input type="password" id="smtpPassword" value="${s.smtpPassword || ''}" placeholder="••••••••" class="form-control" style="font-family:'DM Mono',monospace;font-size:12px;background:#050505;border:1px solid #333;color:#fff;padding:8px 10px;border-radius:4px;width:100%;">
                  </div>
                </div>

                <div class="form-group" style="margin:0;">
                  <label style="display:block;font-family:'DM Mono',monospace;font-size:11px;color:#888;margin-bottom:4px;">REMITENTE VISIBLE (FROM)</label>
                  <input type="text" id="smtpFrom" value="${s.smtpFrom || 'Narel Local <localnarel@gmail.com>'}" placeholder="Narel Local <localnarel@gmail.com>" class="form-control" style="font-family:'DM Mono',monospace;font-size:12px;background:#050505;border:1px solid #333;color:#fff;padding:8px 10px;border-radius:4px;width:100%;max-width:400px;">
                </div>
              </div>
            </details>

            <!-- BOTONES DE ACCIÓN -->
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
              <button type="submit" id="btnSaveNotifications" class="button primary" style="padding:12px 24px;font-size:14px;width:auto;min-width:220px;">
                💾 GUARDAR CONFIGURACIÓN
              </button>
            </div>
          </form>

          <!-- HISTORIAL DE NOTIFICACIONES EMITIDAS -->
          <div style="margin-top:32px;border-top:1px solid #2a2a2a;padding-top:24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <h3 style="font-family:'Oswald',sans-serif;font-size:16px;color:#fff;margin:0;letter-spacing:.05em;text-transform:uppercase;">
                📋 Historial Reciente de Notificaciones
              </h3>
              <button type="button" id="btnRefreshLogs" class="button secondary" style="padding:4px 10px;font-size:11px;width:auto;">
                🔄 Actualizar Historial
              </button>
            </div>

            <div style="overflow-x:auto;border:1px solid #222;border-radius:6px;background:#0c0c0c;">
              <table style="width:100%;border-collapse:collapse;text-align:left;">
                <thead>
                  <tr style="background:#161616;border-bottom:1px solid #2a2a2a;">
                    <th style="padding:8px 12px;font-family:'DM Mono',monospace;font-size:11px;color:#888;">FECHA</th>
                    <th style="padding:8px 12px;font-family:'DM Mono',monospace;font-size:11px;color:#888;">ORDEN</th>
                    <th style="padding:8px 12px;font-family:'DM Mono',monospace;font-size:11px;color:#888;">DESTINATARIO / ASUNTO</th>
                    <th style="padding:8px 12px;font-family:'DM Mono',monospace;font-size:11px;color:#888;">ESTADO</th>
                  </tr>
                </thead>
                <tbody id="notificationsLogsBody">
                  ${logsHtml}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      `;
    }

    bindEvents() {
      const form = document.getElementById('notificationsConfigForm');
      if (form) {
        form.addEventListener('submit', (e) => this.handleSave(e));
      }

      const testBtn = document.getElementById('btnTestNotification');
      if (testBtn) {
        testBtn.addEventListener('click', () => this.handleTest());
      }

      const refreshBtn = document.getElementById('btnRefreshLogs');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
          refreshBtn.disabled = true;
          refreshBtn.textContent = 'Actualizando...';
          await this.loadData();
          this.render();
          this.bindEvents();
        });
      }
    }

    showMessage(text, type = 'info') {
      const el = document.getElementById('notifStatusMessage');
      if (!el) return;
      el.style.display = 'block';
      el.textContent = text;
      if (type === 'success') {
        el.style.background = 'rgba(46, 204, 113, 0.15)';
        el.style.border = '1px solid rgba(46, 204, 113, 0.4)';
        el.style.color = '#2ecc71';
      } else if (type === 'error') {
        el.style.background = 'rgba(231, 76, 60, 0.15)';
        el.style.border = '1px solid rgba(231, 76, 60, 0.4)';
        el.style.color = '#e74c3c';
      } else {
        el.style.background = 'rgba(52, 152, 219, 0.15)';
        el.style.border = '1px solid rgba(52, 152, 219, 0.4)';
        el.style.color = '#3498db';
      }
    }

    async handleSave(e) {
      e.preventDefault();
      const saveBtn = document.getElementById('btnSaveNotifications');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'GUARDANDO...';
      }

      const adminNotificationEnabled = document.getElementById('adminNotificationEnabled')?.checked ?? true;
      const adminEmail = document.getElementById('adminEmail')?.value?.trim() || 'localnarel@gmail.com';
      const customerNotificationEnabled = document.getElementById('customerNotificationEnabled')?.checked ?? true;
      const orderPreparationMessage = document.getElementById('orderPreparationMessage')?.value?.trim() || '';

      const smtpHost = document.getElementById('smtpHost')?.value?.trim() || '';
      const smtpPort = Number(document.getElementById('smtpPort')?.value) || 587;
      const smtpUser = document.getElementById('smtpUser')?.value?.trim() || '';
      const smtpPassword = document.getElementById('smtpPassword')?.value || '';
      const smtpFrom = document.getElementById('smtpFrom')?.value?.trim() || 'Narel Local <localnarel@gmail.com>';

      const payload = {
        adminNotificationEnabled,
        adminEmail,
        customerNotificationEnabled,
        orderPreparationMessage,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword,
        smtpFrom,
      };

      try {
        const res = await window.auth.apiFetch('/api/admin/notifications/settings', {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          this.showMessage('Configuración de notificaciones guardada con éxito.', 'success');
          this.settings = res.data;
        } else {
          this.showMessage(res.message || 'Error al guardar la configuración', 'error');
        }
      } catch (err) {
        this.showMessage('Error de conexión al guardar configuración', 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 GUARDAR CONFIGURACIÓN';
        }
      }
    }

    async handleTest() {
      const testBtn = document.getElementById('btnTestNotification');
      if (testBtn) {
        testBtn.disabled = true;
        testBtn.textContent = 'ENVIANDO PRUEBA...';
      }

      const currentAdminEmail = document.getElementById('adminEmail')?.value?.trim() || this.settings?.adminEmail || 'localnarel@gmail.com';

      try {
        const res = await window.auth.apiFetch('/api/admin/notifications/test', {
          method: 'POST',
          body: JSON.stringify({
            recipient: currentAdminEmail,
            type: 'admin',
          }),
        });

        if (res.ok) {
          this.showMessage(res.message || 'Notificación de prueba generada con éxito.', 'success');
          // Recargar logs
          await this.loadData();
          const tbody = document.getElementById('notificationsLogsBody');
          if (tbody) {
            this.render();
            this.bindEvents();
          }
        } else {
          this.showMessage(res.message || 'Error en prueba de notificación', 'error');
        }
      } catch (err) {
        this.showMessage('Error al solicitar prueba de notificación', 'error');
      } finally {
        if (testBtn) {
          testBtn.disabled = false;
          testBtn.textContent = '⚡ PROBAR ENVÍO';
        }
      }
    }
  }

  window.NotificationsAdmin = NotificationsAdmin;
})();
