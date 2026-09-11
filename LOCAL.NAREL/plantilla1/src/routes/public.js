const express = require('express');
const crypto = require('crypto');
const db = require('../db/connection');
const logger = require('../services/logger');
const { responderPregunta } = require('../services/ia');
const { limiterFormularios, limiterIA } = require('../middleware/rateLimit');
const { validationResult, schemas } = require('../utils/validation');
const { buildWhatsappLink, buildMensajePedido } = require('../utils/whatsapp');

const router = express.Router();

function getIpReal(req) {
  return (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim()
    || req.ip
    || (req.socket?.remoteAddress)
    || '0.0.0.0';
}

function manejarErroresValidacion(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    const mensajes = errores.array().map(e => `${e.path || e.param}: ${e.msg}`).join('; ');
    return res.error(mensajes, 400);
  }
  next();
}

router.get('/api/negocio', (req, res, next) => {
  try {
    const tenantId = req.tenant.id;

    const negocio = db.prepare(`
      SELECT * FROM negocio WHERE tenant_id = ? LIMIT 1
    `).get(tenantId) || {};

    const servicios = db.prepare(`
      SELECT * FROM servicios
      WHERE tenant_id = ? AND activo = 1
      ORDER BY orden ASC, id DESC
    `).all(tenantId);

    const faqs = db.prepare(`
      SELECT * FROM faqs
      WHERE tenant_id = ?
      ORDER BY orden ASC, id ASC
    `).all(tenantId);

    const galeria = db.prepare(`
      SELECT * FROM galeria
      WHERE tenant_id = ?
      ORDER BY orden ASC, id DESC
    `).all(tenantId);

    logger.info(`[${req.tenant_slug}] GET /api/negocio - IP=${getIpReal(req)} - servicios=${servicios.length}`);

    return res.ok({
      tenant: { slug: req.tenant.slug, id: req.tenant.id },
      negocio,
      servicios,
      faqs,
      galeria,
    });
  } catch (err) {
    logger.error('Error GET /api/negocio:', err);
    next(err);
  }
});

router.post('/api/formulario/contacto',
  limiterFormularios,
  schemas.contacto,
  manejarErroresValidacion,
  (req, res, next) => {
    try {
      const tenantId = req.tenant.id;
      const ip = getIpReal(req);
      const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 500);
      const {
        nombre, email, telefono, mensaje,
        servicio_solicitado, fecha_solicitada, datos_json,
        tipo = 'contacto',
      } = req.body;

      const datosStr = datos_json && typeof datos_json === 'object'
        ? JSON.stringify(datos_json)
        : (typeof datos_json === 'string' ? datos_json.slice(0, 5000) : '{}');

      const stmt = db.prepare(`
        INSERT INTO formularios_entrada (
          tenant_id, tipo, nombre, email, telefono, mensaje,
          servicio_solicitado, fecha_solicitada, datos_json, ip, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const r = stmt.run(
        tenantId,
        tipo,
        nombre || '',
        email || '',
        telefono || '',
        mensaje || '',
        servicio_solicitado || '',
        fecha_solicitada || '',
        datosStr,
        ip,
        userAgent
      );

      const id = r.lastInsertRowid;

      const negocio = db.prepare('SELECT * FROM negocio WHERE tenant_id = ? LIMIT 1').get(tenantId);
      const textoWA = buildMensajePedido(negocio, req.body);
      const whatsappLink = buildWhatsappLink(negocio?.whatsapp, textoWA);

      logger.info(`[${req.tenant_slug}] Formulario contacto id=${id} - email=${email} - IP=${ip}`);

      return res.ok({
        id,
        whatsappLink,
        mensaje: 'Formulario recibido correctamente',
      }, 'Gracias por tu mensaje!');
    } catch (err) {
      logger.error('Error POST /api/formulario/contacto:', err);
      next(err);
    }
  }
);

router.get('/api/formulario/whatsapp-link', (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const negocio = db.prepare('SELECT * FROM negocio WHERE tenant_id = ? LIMIT 1').get(tenantId);
    if (!negocio?.whatsapp) {
      return res.ok({ link: '' }, 'WhatsApp no configurado');
    }

    const params = {
      nombre: req.query.nombre,
      email: req.query.email,
      telefono: req.query.telefono,
      mensaje: req.query.mensaje,
      servicio_solicitado: req.query.servicio,
      fecha_solicitada: req.query.fecha,
    };

    const texto = buildMensajePedido(negocio, params);
    const link = buildWhatsappLink(negocio.whatsapp, texto);
    return res.ok({ link, texto });
  } catch (err) {
    logger.error('Error GET /api/formulario/whatsapp-link:', err);
    next(err);
  }
});

router.post('/api/ia/chat',
  limiterIA,
  schemas.iaChat,
  manejarErroresValidacion,
  async (req, res, next) => {
    try {
      const tenantId = req.tenant.id;
      const ip = getIpReal(req);
      let { sesion, mensaje } = req.body;

      let sesionUUID = sesion;
      let sesionDb = null;

      if (sesionUUID) {
        sesionDb = db.prepare('SELECT * FROM sesiones_ia WHERE sesion_uuid = ? AND tenant_id = ?').get(sesionUUID, tenantId);
      }

      if (!sesionDb) {
        sesionUUID = sesionUUID || crypto.randomUUID();
        try {
          db.prepare(`
            INSERT INTO sesiones_ia (tenant_id, sesion_uuid, ip, mensajes_count, ultimo_mensaje)
            VALUES (?, ?, ?, 1, datetime('now'))
          `).run(tenantId, sesionUUID, ip);
          sesionDb = db.prepare('SELECT * FROM sesiones_ia WHERE sesion_uuid = ?').get(sesionUUID);
        } catch (e) {
          sesionDb = db.prepare('SELECT * FROM sesiones_ia WHERE sesion_uuid = ? AND tenant_id = ?').get(sesionUUID, tenantId);
          if (sesionDb) {
            db.prepare(`
              UPDATE sesiones_ia SET
                mensajes_count = mensajes_count + 1,
                ultimo_mensaje = datetime('now'),
                ip = COALESCE(NULLIF(ip, ''), ip)
              WHERE id = ?
            `).run(sesionDb.id);
          }
        }
      } else {
        db.prepare(`
          UPDATE sesiones_ia SET
            mensajes_count = mensajes_count + 1,
            ultimo_mensaje = datetime('now')
          WHERE id = ?
        `).run(sesionDb.id);
      }

      const negocio = db.prepare('SELECT * FROM negocio WHERE tenant_id = ? LIMIT 1').get(tenantId) || {};
      const servicios = db.prepare('SELECT * FROM servicios WHERE tenant_id = ? AND activo = 1 ORDER BY orden ASC, id DESC').all(tenantId);
      const faqs = db.prepare('SELECT * FROM faqs WHERE tenant_id = ? ORDER BY orden ASC').all(tenantId);

      const historial = [];
      const respuestaIA = await responderPregunta(negocio, historial, mensaje, servicios, faqs);

      logger.info(`[${req.tenant_slug}] IA chat sesion=${sesionUUID} msgs=${sesionDb?.mensajes_count || 1} IP=${ip}`);

      return res.ok({
        sesion: sesionUUID,
        ...respuestaIA,
      });
    } catch (err) {
      logger.error('Error POST /api/ia/chat:', err);
      next(err);
    }
  }
);

module.exports = router;
