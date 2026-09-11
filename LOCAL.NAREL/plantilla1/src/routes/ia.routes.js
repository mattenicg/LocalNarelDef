const express = require('express');
const { fetchOne, runStmt } = require('../db');
const { requireTenant, limites, sanitizeBody } = require('../middleware/security');
const { procesarMensajeIA } = require('../services/ia.service');
const { IA_MAX_MENSAJES_POR_HORA } = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/:tenant_slug/chat', requireTenant, limites.iaChat, sanitizeBody, async (req, res) => {
  try {
    const { session_id, mensaje, historial } = req.body || {};
    if (!mensaje || !String(mensaje).trim()) {
      return res.status(400).json({ ok: false, error: 'Mensaje vacío' });
    }
    if (!session_id) {
      return res.status(400).json({ ok: false, error: 'session_id requerido' });
    }

    const horaActual = Math.floor(Date.now() / (60 * 60 * 1000));
    let sesion = fetchOne('SELECT * FROM ia_sessions WHERE tenant_id = ? AND session_id = ?', [req.tenant.id, session_id]);
    const ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').toString().slice(0, 100);

    if (!sesion) {
      const result = runStmt(
        'INSERT INTO ia_sessions (tenant_id, session_id, ip, mensajes_en_hora, ultima_hora) VALUES (?, ?, ?, 1, ?)',
        [req.tenant.id, session_id, ip, horaActual]
      );
      sesion = {
        id: result.lastInsertRowid,
        tenant_id: req.tenant.id,
        session_id,
        mensajes_en_hora: 1,
        ultima_hora: horaActual
      };
    } else {
      if (sesion.ultima_hora !== horaActual) {
        runStmt(
          'UPDATE ia_sessions SET mensajes_en_hora = 1, ultima_hora = ? WHERE id = ?',
          [horaActual, sesion.id]
        );
        sesion.mensajes_en_hora = 1;
      } else {
        if (sesion.mensajes_en_hora >= IA_MAX_MENSAJES_POR_HORA) {
          return res.status(429).json({
            ok: false,
            error: 'Has alcanzado el límite de mensajes por hora. Intenta nuevamente más tarde o contactanos por WhatsApp.'
          });
        }
        runStmt('UPDATE ia_sessions SET mensajes_en_hora = mensajes_en_hora + 1 WHERE id = ?', [sesion.id]);
        sesion.mensajes_en_hora += 1;
      }
    }

    const resultado = await procesarMensajeIA(req.tenant, historial || [], mensaje);
    res.json({ ok: true, ...resultado });
  } catch (err) {
    logger.error('POST ia chat:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

module.exports = router;
