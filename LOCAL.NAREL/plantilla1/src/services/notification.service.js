'use strict';

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { query } = require('../db/postgres');
const env = require('../config/env');
const logger = require('../utils/logger');

const settingsFile = path.join(__dirname, '..', '..', 'data', 'notification-settings.json');

const DEFAULT_SETTINGS = {
  adminNotificationEnabled: true,
  adminEmail: 'localnarel@gmail.com',
  customerNotificationEnabled: true,
  smtpHost: env.SMTP_HOST || '',
  smtpPort: Number(env.SMTP_PORT) || 587,
  smtpUser: env.SMTP_USER || '',
  smtpPassword: env.SMTP_PASSWORD || '',
  smtpFrom: env.SMTP_FROM || 'Narel Local <localnarel@gmail.com>',
  orderPreparationMessage: '¡Tu pedido fue recibido con éxito y ya está siendo preparado en nuestro taller! Te avisaremos ante cualquier novedad o cuando esté listo para su despacho o retiro.',
  updatedAt: new Date().toISOString(),
};

function readFallbackFileSync() {
  try {
    if (fs.existsSync(settingsFile)) {
      const raw = fs.readFileSync(settingsFile, 'utf8');
      return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
    }
  } catch (err) {
    logger.warn(`[notification.service] Error leyendo fallback: ${err.message}`);
  }
  return { ...DEFAULT_SETTINGS };
}

function writeFallbackFileSync(settings) {
  try {
    const dir = path.dirname(settingsFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    logger.warn(`[notification.service] Error escribiendo fallback: ${err.message}`);
  }
}

async function getNotificationSettings() {
  try {
    const res = await query('SELECT value FROM store_settings WHERE key = $1', ['notification_settings']);
    if (res && res.rows && res.rows.length > 0 && res.rows[0].value) {
      const dbVal = res.rows[0].value;
      const parsed = typeof dbVal === 'string' ? JSON.parse(dbVal) : dbVal;
      return Object.assign({}, DEFAULT_SETTINGS, parsed);
    }
  } catch (err) {
    logger.warn(`[notification.service] Error consultando store_settings: ${err.message}`);
  }
  return readFallbackFileSync();
}

async function saveNotificationSettings(updates) {
  const current = await getNotificationSettings();
  const nextSettings = {
    adminNotificationEnabled: typeof updates.adminNotificationEnabled === 'boolean' ? updates.adminNotificationEnabled : current.adminNotificationEnabled,
    adminEmail: typeof updates.adminEmail === 'string' && updates.adminEmail.trim() ? updates.adminEmail.trim().toLowerCase() : current.adminEmail,
    customerNotificationEnabled: typeof updates.customerNotificationEnabled === 'boolean' ? updates.customerNotificationEnabled : current.customerNotificationEnabled,
    smtpHost: updates.smtpHost !== undefined ? String(updates.smtpHost).trim() : current.smtpHost,
    smtpPort: updates.smtpPort !== undefined ? (Number(updates.smtpPort) || 587) : current.smtpPort,
    smtpUser: updates.smtpUser !== undefined ? String(updates.smtpUser).trim() : current.smtpUser,
    smtpPassword: updates.smtpPassword !== undefined && updates.smtpPassword !== '••••••••' ? String(updates.smtpPassword) : current.smtpPassword,
    smtpFrom: updates.smtpFrom !== undefined && String(updates.smtpFrom).trim() ? String(updates.smtpFrom).trim() : current.smtpFrom,
    orderPreparationMessage: updates.orderPreparationMessage !== undefined && String(updates.orderPreparationMessage).trim() ? String(updates.orderPreparationMessage).trim() : current.orderPreparationMessage,
    updatedAt: new Date().toISOString(),
  };

  try {
    await query(
      `INSERT INTO store_settings (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      ['notification_settings', JSON.stringify(nextSettings)]
    );
  } catch (err) {
    logger.warn(`[notification.service] Error guardando en store_settings: ${err.message}`);
  }

  writeFallbackFileSync(nextSettings);
  return nextSettings;
}

function createTransporter(settings) {
  const host = settings.smtpHost || env.SMTP_HOST;
  const user = settings.smtpUser || env.SMTP_USER;
  const pass = settings.smtpPassword || env.SMTP_PASSWORD;
  const port = Number(settings.smtpPort || env.SMTP_PORT) || 587;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
  }
  return null;
}

async function recordNotificationLog({ type, recipient, subject, orderNumber, status, errorMessage, payload }) {
  try {
    await query(
      `INSERT INTO notification_logs (type, recipient, subject, order_number, status, error_message, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [
        type,
        recipient,
        subject,
        orderNumber || null,
        status,
        errorMessage || null,
        JSON.stringify(payload || {}),
      ]
    );
  } catch (err) {
    logger.warn(`[notification.service] Error registrando log en base de datos: ${err.message}`);
  }
}

async function getNotificationLogs(limit = 20) {
  try {
    const res = await query('SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT $1', [Math.min(limit, 100)]);
    return res.rows || [];
  } catch (err) {
    logger.warn(`[notification.service] Error obteniendo logs: ${err.message}`);
    return [];
  }
}

function formatCurrency(amount) {
  return `$ ${Number(amount || 0).toLocaleString('es-AR')}`;
}

function formatDateAr(date) {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(date ? new Date(date) : new Date());
  } catch (_) {
    return new Date().toLocaleString();
  }
}

function buildAdminEmailHtml(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const dateStr = formatDateAr(order.created_at);

  const itemsHtml = items.map((it) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #2a2a2a;font-size:14px;color:#ffffff;">
        <b>${it.name || it.product_name || 'Prenda Narel'}</b>
        ${it.size ? `<span style="display:block;font-size:11px;color:#b0b0b0;font-family:monospace;">Talle: ${it.size}</span>` : ''}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #2a2a2a;text-align:center;font-size:13px;color:#ffffff;font-family:monospace;">
        ${it.quantity}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #2a2a2a;text-align:right;font-size:13px;color:#ffffff;font-family:monospace;">
        ${formatCurrency(it.unit_price || it.price)}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #2a2a2a;text-align:right;font-size:14px;color:#ffffff;font-weight:bold;font-family:monospace;">
        ${formatCurrency(it.line_total || (it.quantity * (it.unit_price || it.price || 0)))}
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nuevo Pedido #${order.order_number}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#ffffff;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    
    <!-- HEADER -->
    <div style="background:#141414;border:1px solid #2a2a2a;border-radius:8px 8px 0 0;padding:24px 20px;text-align:center;border-bottom:2px solid #ffffff;">
      <span style="font-family:monospace;font-size:11px;letter-spacing:0.25em;color:#b0b0b0;text-transform:uppercase;">NAREL LOCAL · ADMIN NOTIFICATION</span>
      <h1 style="margin:8px 0 0 0;font-size:26px;letter-spacing:0.05em;color:#ffffff;text-transform:uppercase;">⚡ ¡NUEVO PEDIDO RECIBIDO!</h1>
      <div style="margin-top:10px;display:inline-block;padding:4px 12px;background:#1e1e1e;border-radius:4px;border:1px solid #333;font-family:monospace;font-size:12px;color:#2ecc71;">
        ORDEN #${order.order_number} · ${dateStr}
      </div>
    </div>

    <!-- CUERPO PRINCIPAL -->
    <div style="background:#141414;border:1px solid #2a2a2a;border-top:none;padding:24px 20px;">
      
      <!-- DATOS DEL CLIENTE -->
      <div style="background:#0c0c0c;border:1px solid #222;border-radius:6px;padding:16px;margin-bottom:20px;">
        <h3 style="margin:0 0 12px 0;font-size:12px;font-family:monospace;letter-spacing:0.15em;color:#b0b0b0;text-transform:uppercase;">
          DATOS DEL CLIENTE
        </h3>
        <p style="margin:4px 0;font-size:14px;color:#ffffff;"><strong>Nombre:</strong> ${order.customer_name || '—'}</p>
        <p style="margin:4px 0;font-size:14px;color:#ffffff;"><strong>Email:</strong> <a href="mailto:${order.customer_email}" style="color:#ffffff;text-decoration:underline;">${order.customer_email || '—'}</a></p>
        <p style="margin:4px 0;font-size:14px;color:#ffffff;"><strong>Teléfono:</strong> <a href="tel:${order.customer_phone}" style="color:#2ecc71;text-decoration:none;">${order.customer_phone || '—'}</a></p>
      </div>

      <!-- DATOS DE ENTREGA Y PAGO -->
      <div style="display:grid;gap:12px;margin-bottom:20px;">
        <div style="background:#0c0c0c;border:1px solid #222;border-radius:6px;padding:16px;">
          <h3 style="margin:0 0 12px 0;font-size:12px;font-family:monospace;letter-spacing:0.15em;color:#b0b0b0;text-transform:uppercase;">
            DETALLES DE ENTREGA Y PAGO
          </h3>
          <p style="margin:4px 0;font-size:14px;color:#ffffff;"><strong>Método de Entrega:</strong> ${order.shipping_method === 'envio' ? '🚀 Envío a Domicilio' : '🏪 Retiro en Punto de Entrega'}</p>
          ${order.shipping_address ? `<p style="margin:4px 0;font-size:14px;color:#ffffff;"><strong>Dirección:</strong> ${order.shipping_address}, ${order.shipping_city || ''} (CP: ${order.shipping_postal_code || ''})</p>` : ''}
          ${order.notes ? `<p style="margin:4px 0;font-size:13px;color:#b0b0b0;font-family:monospace;"><strong>Notas:</strong> ${order.notes}</p>` : ''}
          <p style="margin:4px 0;font-size:14px;color:#ffffff;"><strong>Método de Pago:</strong> <span style="text-transform:uppercase;color:#f1c40f;">${order.payment_method || 'transferencia'}</span></p>
          <p style="margin:4px 0;font-size:14px;color:#ffffff;"><strong>Estado del Pago:</strong> ${order.payment_status || 'pendiente'}</p>
        </div>
      </div>

      <!-- PRODUCTOS -->
      <h3 style="margin:16px 0 10px 0;font-size:12px;font-family:monospace;letter-spacing:0.15em;color:#b0b0b0;text-transform:uppercase;">
        ARTÍCULOS DEL PEDIDO
      </h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="background:#1e1e1e;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-family:monospace;color:#b0b0b0;">PRODUCTO</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-family:monospace;color:#b0b0b0;">CANT</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-family:monospace;color:#b0b0b0;">PRECIO</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-family:monospace;color:#b0b0b0;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#888;">Sin detalles de ítems</td></tr>'}
        </tbody>
      </table>

      <!-- TOTALES -->
      <div style="background:#0c0c0c;border:1px solid #333;border-radius:6px;padding:16px;text-align:right;">
        <p style="margin:4px 0;font-size:13px;color:#b0b0b0;font-family:monospace;">Subtotal: ${formatCurrency(order.subtotal)}</p>
        <p style="margin:6px 0 0 0;font-size:22px;color:#ffffff;font-weight:bold;font-family:monospace;">
          TOTAL A COBRAR: <span style="color:#2ecc71;">${formatCurrency(order.total)}</span>
        </p>
      </div>

      <!-- ACCIONES RÁPIDAS -->
      <div style="margin-top:24px;text-align:center;">
        <a href="/admin/orders.html" style="display:inline-block;padding:12px 24px;background:#ffffff;color:#0a0a0a;text-decoration:none;font-weight:bold;font-size:14px;border-radius:4px;letter-spacing:0.05em;">
          VER PEDIDO EN EL PANEL ADMIN →
        </a>
      </div>

    </div>

    <!-- FOOTER -->
    <div style="background:#0f0f0f;border:1px solid #2a2a2a;border-top:none;border-radius:0 0 8px 8px;padding:16px 20px;text-align:center;font-family:monospace;font-size:11px;color:#666;">
      Notificación automática generada por NAREL LOCAL · Sistema de Pedidos & Checkout
    </div>

  </div>
</body>
</html>
  `;
}

function buildCustomerEmailHtml(order, preparationMessage) {
  const items = Array.isArray(order.items) ? order.items : [];
  const dateStr = formatDateAr(order.created_at);

  const itemsHtml = items.map((it) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #2a2a2a;font-size:14px;color:#ffffff;">
        <b>${it.name || it.product_name || 'Prenda Narel'}</b>
        ${it.size ? `<span style="display:block;font-size:11px;color:#b0b0b0;font-family:monospace;">Talle: ${it.size}</span>` : ''}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #2a2a2a;text-align:center;font-size:13px;color:#ffffff;font-family:monospace;">
        ${it.quantity}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #2a2a2a;text-align:right;font-size:14px;color:#ffffff;font-weight:bold;font-family:monospace;">
        ${formatCurrency(it.line_total || (it.quantity * (it.unit_price || it.price || 0)))}
      </td>
    </tr>
  `).join('');

  // Mensaje según método de pago
  let paymentInstruction = '';
  if (order.payment_method === 'transferencia') {
    paymentInstruction = `
      <div style="margin-top:16px;background:#1a1708;border:1px solid #4a3e10;border-radius:6px;padding:14px;font-size:13px;color:#f9e79f;">
        <strong>Información para Transferencia:</strong><br>
        Si aún no transferiste, recordá transferir a nuestro alias oficial y enviar el comprobante por WhatsApp adjuntando el número de orden <b>#${order.order_number}</b>.
        ${env.ORDER_PAYMENT_ALIAS ? `<br><b>Alias:</b> ${env.ORDER_PAYMENT_ALIAS}` : ''}
        ${env.ORDER_PAYMENT_CBU ? `<br><b>CBU:</b> ${env.ORDER_PAYMENT_CBU}` : ''}
      </div>
    `;
  } else if (order.payment_method === 'efectivo') {
    paymentInstruction = `
      <div style="margin-top:16px;background:#0d2818;border:1px solid #185028;border-radius:6px;padding:14px;font-size:13px;color:#a9dfbf;">
        <strong>Pago en Efectivo:</strong><br>
        Abonarás el total de tu pedido al momento de retirar o recibir tu entrega. ¡Te esperamos!
      </div>
    `;
  } else if (order.payment_method === 'whatsapp') {
    paymentInstruction = `
      <div style="margin-top:16px;background:#10222e;border:1px solid #1a3f5a;border-radius:6px;padding:14px;font-size:13px;color:#aed6f1;">
        <strong>Coordinación por WhatsApp:</strong><br>
        Uno de nuestros asesores te escribirá a tu número de teléfono para coordinar la entrega y confirmar tu pedido.
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tu Pedido #${order.order_number} está en preparación</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#ffffff;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    
    <!-- HEADER -->
    <div style="background:#141414;border:1px solid #2a2a2a;border-radius:8px 8px 0 0;padding:28px 20px;text-align:center;border-bottom:2px solid #ffffff;">
      <span style="font-family:monospace;font-size:11px;letter-spacing:0.25em;color:#b0b0b0;text-transform:uppercase;">NAREL LOCAL · UNA NUEVA VISIÓN</span>
      <h1 style="margin:10px 0 0 0;font-size:26px;letter-spacing:0.04em;color:#ffffff;text-transform:uppercase;">¡TU PEDIDO ESTÁ EN PREPARACIÓN! ⚡</h1>
      <p style="margin:8px 0 0 0;font-size:13px;color:#b0b0b0;font-family:monospace;">Orden #${order.order_number} · ${dateStr}</p>
    </div>

    <!-- CUERPO PRINCIPAL -->
    <div style="background:#141414;border:1px solid #2a2a2a;border-top:none;padding:28px 20px;">
      
      <!-- SALUDO Y CONFIRMACIÓN -->
      <div style="background:#1e1e1e;border:1px solid #333;border-radius:6px;padding:20px;margin-bottom:24px;">
        <h2 style="margin:0 0 10px 0;font-size:18px;color:#ffffff;">¡Hola, ${order.customer_name || 'amigo/a'}!</h2>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#e0e0e0;">
          ${preparationMessage || '¡Muchas gracias por tu compra! Tu pedido fue recibido con éxito y ya está siendo preparado en nuestro taller. Te notificaremos apenas esté listo.'}
        </p>
        <div style="margin-top:14px;padding:8px 12px;background:#0d2818;border:1px solid #185028;border-radius:4px;display:inline-block;font-family:monospace;font-size:12px;color:#2ecc71;font-weight:bold;">
          ESTADO ACTUAL: EN PREPARACIÓN ⏳
        </div>
      </div>

      <!-- DETALLE DE ENTREGA -->
      <div style="background:#0c0c0c;border:1px solid #222;border-radius:6px;padding:16px;margin-bottom:20px;">
        <h3 style="margin:0 0 10px 0;font-size:12px;font-family:monospace;letter-spacing:0.15em;color:#b0b0b0;text-transform:uppercase;">
          MÉTODO DE ENTREGA
        </h3>
        <p style="margin:4px 0;font-size:14px;color:#ffffff;">
          <strong>Modalidad:</strong> ${order.shipping_method === 'envio' ? '🚀 Envío a domicilio' : '🏪 Retiro en local (San Martín 2029)'}
        </p>
        ${order.shipping_address ? `<p style="margin:4px 0;font-size:14px;color:#ffffff;"><strong>Destino:</strong> ${order.shipping_address}, ${order.shipping_city || ''}</p>` : ''}
      </div>

      <!-- TABLA DE PRENDAS -->
      <h3 style="margin:20px 0 10px 0;font-size:12px;font-family:monospace;letter-spacing:0.15em;color:#b0b0b0;text-transform:uppercase;">
        RESUMEN DE TU COMPRA
      </h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="background:#1e1e1e;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-family:monospace;color:#b0b0b0;">PRENDA</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-family:monospace;color:#b0b0b0;">CANT</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-family:monospace;color:#b0b0b0;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || '<tr><td colspan="3" style="padding:12px;text-align:center;color:#888;">Detalle de prendas</td></tr>'}
        </tbody>
      </table>

      <!-- TOTAL FINAL -->
      <div style="background:#0c0c0c;border:1px solid #333;border-radius:6px;padding:16px;text-align:right;">
        <p style="margin:0;font-size:20px;color:#ffffff;font-weight:bold;font-family:monospace;">
          TOTAL: <span style="color:#ffffff;">${formatCurrency(order.total)}</span>
        </p>
      </div>

      <!-- INSTRUCCIONES DE PAGO -->
      ${paymentInstruction}

      <!-- CONTACTO / WHATSAPP -->
      <div style="margin-top:28px;text-align:center;border-top:1px solid #222;padding-top:20px;">
        <p style="margin:0 0 12px 0;font-size:13px;color:#b0b0b0;">¿Tenés alguna consulta sobre tu pedido o querés coordinar la entrega?</p>
        <a href="https://wa.me/${String(env.ORDER_WHATSAPP_NUMBER || '').replace(/\D/g, '') || '5493425555555'}?text=${encodeURIComponent(`Hola Narel Local, tengo una consulta sobre mi pedido #${order.order_number}`)}" style="display:inline-block;padding:10px 20px;background:#25d366;color:#ffffff;text-decoration:none;font-weight:bold;font-size:13px;border-radius:4px;letter-spacing:0.05em;margin-right:8px;">
          CONSULTAR POR WHATSAPP 💬
        </a>
        <a href="https://instagram.com/narel_local" style="display:inline-block;padding:10px 20px;background:#1e1e1e;border:1px solid #333;color:#ffffff;text-decoration:none;font-size:13px;border-radius:4px;margin-top:6px;">
          INSTAGRAM @narel_local ↗
        </a>
      </div>

    </div>

    <!-- FOOTER -->
    <div style="background:#0f0f0f;border:1px solid #2a2a2a;border-top:none;border-radius:0 0 8px 8px;padding:18px 20px;text-align:center;font-family:monospace;font-size:11px;color:#666;">
      NAREL LOCAL · Ropa urbana y diseño independiente · Santa Fe Capital<br>
      Este es un correo automático enviado a ${order.customer_email}.
    </div>

  </div>
</body>
</html>
  `;
}

async function notifyNewOrder(order) {
  if (!order) return { ok: false, message: 'Orden vacía' };

  const settings = await getNotificationSettings();
  const transporter = createTransporter(settings);
  const fromAddress = settings.smtpFrom || env.SMTP_FROM || 'Narel Local <localnarel@gmail.com>';

  const results = {
    admin: { attempted: false, success: false },
    customer: { attempted: false, success: false },
  };

  // 1. Notificación al Administrador (localnarel@gmail.com)
  if (settings.adminNotificationEnabled && settings.adminEmail) {
    results.admin.attempted = true;
    const adminSubject = `⚡ Nuevo Pedido Recibido #${order.order_number} (${formatCurrency(order.total)}) - Narel Local`;
    const adminHtml = buildAdminEmailHtml(order);

    if (transporter) {
      try {
        await transporter.sendMail({
          from: fromAddress,
          to: settings.adminEmail,
          subject: adminSubject,
          html: adminHtml,
        });
        results.admin.success = true;
        await recordNotificationLog({
          type: 'order_admin_alert',
          recipient: settings.adminEmail,
          subject: adminSubject,
          orderNumber: order.order_number,
          status: 'sent',
          payload: { order_id: order.id, total: order.total },
        });
        logger.info(`[notification.service] Correo enviado al administrador (${settings.adminEmail}) para orden #${order.order_number}`);
      } catch (err) {
        logger.error(`[notification.service] Error enviando correo al admin: ${err.message}`);
        await recordNotificationLog({
          type: 'order_admin_alert',
          recipient: settings.adminEmail,
          subject: adminSubject,
          orderNumber: order.order_number,
          status: 'error',
          errorMessage: err.message,
          payload: { order_id: order.id },
        });
      }
    } else {
      // Modo Log / Simulación sin SMTP externo configurado
      results.admin.success = true;
      logger.info(`[NOTIFICATION - ADMIN EMAIL LOGGED]
To: ${settings.adminEmail}
Subject: ${adminSubject}
Order: #${order.order_number} | Cliente: ${order.customer_name} | Total: ${formatCurrency(order.total)}`);

      await recordNotificationLog({
        type: 'order_admin_alert',
        recipient: settings.adminEmail,
        subject: adminSubject,
        orderNumber: order.order_number,
        status: 'logged',
        payload: { order_id: order.id, customer: order.customer_name, total: order.total },
      });
    }
  }

  // 2. Notificación al Cliente (al email ingresado durante el método de pago / checkout)
  if (settings.customerNotificationEnabled && order.customer_email) {
    results.customer.attempted = true;
    const customerSubject = `¡Tu pedido #${order.order_number} está en preparación! - Narel Local`;
    const customerHtml = buildCustomerEmailHtml(order, settings.orderPreparationMessage);

    if (transporter) {
      try {
        await transporter.sendMail({
          from: fromAddress,
          to: order.customer_email,
          subject: customerSubject,
          html: customerHtml,
        });
        results.customer.success = true;
        await recordNotificationLog({
          type: 'order_customer_prep',
          recipient: order.customer_email,
          subject: customerSubject,
          orderNumber: order.order_number,
          status: 'sent',
          payload: { order_id: order.id, customer_name: order.customer_name },
        });
        logger.info(`[notification.service] Correo enviado al cliente (${order.customer_email}) para orden #${order.order_number}`);
      } catch (err) {
        logger.error(`[notification.service] Error enviando correo al cliente: ${err.message}`);
        await recordNotificationLog({
          type: 'order_customer_prep',
          recipient: order.customer_email,
          subject: customerSubject,
          orderNumber: order.order_number,
          status: 'error',
          errorMessage: err.message,
          payload: { order_id: order.id },
        });
      }
    } else {
      // Modo Log / Simulación sin SMTP externo configurado
      results.customer.success = true;
      logger.info(`[NOTIFICATION - CUSTOMER EMAIL LOGGED]
To: ${order.customer_email}
Subject: ${customerSubject}
Order: #${order.order_number} | Mensaje: En preparación en taller | Total: ${formatCurrency(order.total)}`);

      await recordNotificationLog({
        type: 'order_customer_prep',
        recipient: order.customer_email,
        subject: customerSubject,
        orderNumber: order.order_number,
        status: 'logged',
        payload: { order_id: order.id, customer_name: order.customer_name },
      });
    }
  }

  return { ok: true, results };
}

async function sendTestNotification({ recipient, type = 'admin' }) {
  const settings = await getNotificationSettings();
  const transporter = createTransporter(settings);
  const targetEmail = recipient || (type === 'admin' ? settings.adminEmail : 'cliente@ejemplo.com');

  const mockOrder = {
    id: 'test-order-uuid',
    order_number: `NL-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
    created_at: new Date().toISOString(),
    customer_name: 'Cliente de Prueba',
    customer_email: targetEmail,
    customer_phone: '+54 9 342 555-1234',
    shipping_method: 'envio',
    shipping_address: 'San Martín 1234 Piso 2',
    shipping_city: 'Santa Fe Capital',
    shipping_postal_code: '3000',
    notes: 'Prueba de notificación desde el Panel de Control',
    payment_method: 'transferencia',
    payment_status: 'pendiente',
    subtotal: 42000,
    total: 42000,
    items: [
      {
        name: 'Remera Narel Oversize Black',
        size: 'L',
        quantity: 1,
        unit_price: 26000,
        line_total: 26000,
      },
      {
        name: 'Gorra Diamond Edition',
        size: 'Único',
        quantity: 1,
        unit_price: 16000,
        line_total: 16000,
      },
    ],
  };

  const subject = type === 'admin'
    ? `[TEST] ⚡ Nuevo Pedido Recibido #${mockOrder.order_number} - Narel Local`
    : `[TEST] ¡Tu pedido #${mockOrder.order_number} está en preparación! - Narel Local`;

  const html = type === 'admin'
    ? buildAdminEmailHtml(mockOrder)
    : buildCustomerEmailHtml(mockOrder, settings.orderPreparationMessage);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: settings.smtpFrom || 'Narel Local <localnarel@gmail.com>',
        to: targetEmail,
        subject,
        html,
      });
      await recordNotificationLog({
        type: `test_${type}`,
        recipient: targetEmail,
        subject,
        orderNumber: mockOrder.order_number,
        status: 'sent',
      });
      return { ok: true, status: 'sent', message: `Correo de prueba enviado a ${targetEmail} vía SMTP.` };
    } catch (err) {
      await recordNotificationLog({
        type: `test_${type}`,
        recipient: targetEmail,
        subject,
        orderNumber: mockOrder.order_number,
        status: 'error',
        errorMessage: err.message,
      });
      return { ok: false, status: 'error', message: `Error al conectar con SMTP: ${err.message}` };
    }
  } else {
    await recordNotificationLog({
      type: `test_${type}`,
      recipient: targetEmail,
      subject,
      orderNumber: mockOrder.order_number,
      status: 'logged',
      payload: { simulated: true },
    });
    return {
      ok: true,
      status: 'logged',
      message: `Notificación de prueba generada con éxito para ${targetEmail} y registrada en logs (sin servidor SMTP externo configurado).`,
    };
  }
}

module.exports = {
  getNotificationSettings,
  saveNotificationSettings,
  notifyNewOrder,
  sendTestNotification,
  getNotificationLogs,
};
