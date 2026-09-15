'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, requireAdmin } = require('../middleware/postgresAuth');
const {
  getNotificationSettings,
  saveNotificationSettings,
  sendTestNotification,
  getNotificationLogs,
} = require('../services/notification.service');

const router = express.Router();
router.use(authenticate, requireAdmin);

// Obtener configuración actual
router.get('/settings', async (_req, res) => {
  try {
    const settings = await getNotificationSettings();
    // Ocultar contraseña SMTP en la respuesta por seguridad
    const safeSettings = { ...settings };
    if (safeSettings.smtpPassword) {
      safeSettings.smtpPassword = '••••••••';
    }
    return res.json({ ok: true, data: safeSettings });
  } catch (err) {
    return res.status(500).json({ ok: false, message: 'Error al obtener configuración de notificaciones' });
  }
});

// Guardar configuración
router.put('/settings', [
  body('adminEmail').optional().isEmail().withMessage('El email de administrador debe ser válido'),
  body('adminNotificationEnabled').optional().isBoolean(),
  body('customerNotificationEnabled').optional().isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, message: errors.array()[0].msg });
  }

  try {
    const updated = await saveNotificationSettings(req.body);
    const safeSettings = { ...updated };
    if (safeSettings.smtpPassword) {
      safeSettings.smtpPassword = '••••••••';
    }
    return res.json({
      ok: true,
      message: 'Configuración de notificaciones guardada correctamente',
      data: safeSettings,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: 'Error al guardar configuración de notificaciones' });
  }
});

// Obtener historial de notificaciones
router.get('/logs', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const logs = await getNotificationLogs(limit);
    return res.json({ ok: true, data: logs });
  } catch (err) {
    return res.status(500).json({ ok: false, message: 'Error al obtener registros de notificaciones' });
  }
});

// Enviar correo de prueba
router.post('/test', [
  body('recipient').optional().isEmail().withMessage('El email de destino debe ser válido'),
  body('type').optional().isIn(['admin', 'customer']).withMessage('Tipo de prueba inválido'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, message: errors.array()[0].msg });
  }

  try {
    const result = await sendTestNotification({
      recipient: req.body.recipient,
      type: req.body.type || 'admin',
    });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, message: `Error en envío de prueba: ${err.message}` });
  }
});

module.exports = router;
