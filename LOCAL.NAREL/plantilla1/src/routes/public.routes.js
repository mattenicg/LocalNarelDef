const express = require('express');
const { fetchOne, fetchAll, runStmt } = require('../db');
const { requireTenant, limites, sanitizeBody, validar, v } = require('../middleware/security');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/:tenant_slug/config', requireTenant, async (req, res) => {
  try {
    const configRow = fetchOne('SELECT json FROM tenant_config WHERE tenant_id = ?', [req.tenant.id]);
    const config = configRow ? JSON.parse(configRow.json || '{}') : {};
    res.json({
      ok: true,
      tenant: {
        id: req.tenant.id,
        slug: req.tenant.slug,
        nombre: req.tenant.nombre,
        dominio: req.tenant.dominio,
        whatsapp: req.tenant.whatsapp,
        email_contacto: req.tenant.email_contacto
      },
      config
    });
  } catch (err) {
    logger.error('GET public config:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.get('/:tenant_slug/services', requireTenant, async (req, res) => {
  try {
    const servicios = fetchAll(
      'SELECT * FROM services WHERE tenant_id = ? AND activo = 1 ORDER BY orden ASC, categoria ASC, id ASC',
      [req.tenant.id]
    );
    res.json({ ok: true, servicios });
  } catch (err) {
    logger.error('GET public services:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.get('/:tenant_slug/gallery', requireTenant, async (req, res) => {
  try {
    const galeria = fetchAll(
      'SELECT * FROM gallery WHERE tenant_id = ? AND activo = 1 ORDER BY orden ASC, id ASC',
      [req.tenant.id]
    );
    res.json({ ok: true, galeria });
  } catch (err) {
    logger.error('GET public gallery:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.get('/:tenant_slug/faq', requireTenant, async (req, res) => {
  try {
    const preguntas = fetchAll(
      'SELECT * FROM faq WHERE tenant_id = ? AND activo = 1 ORDER BY orden ASC, id ASC',
      [req.tenant.id]
    );
    res.json({ ok: true, faq: preguntas });
  } catch (err) {
    logger.error('GET public faq:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.post(
  '/:tenant_slug/forms/:tipo',
  requireTenant,
  limites.formContacto,
  sanitizeBody,
  validar([
    v.required('nombre', 'El nombre es requerido'),
    v.email('email'),
    v.required('telefono', 'El teléfono es requerido')
  ]),
  async (req, res) => {
    try {
      const tiposPermitidos = ['contacto', 'presupuesto', 'turno', 'pedido'];
      if (!tiposPermitidos.includes(req.params.tipo)) {
        return res.status(400).json({ ok: false, error: 'Tipo de formulario inválido' });
      }
      const data = JSON.stringify(req.body || {});
      const ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').toString().slice(0, 100);
      const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 500);

      const result = runStmt(
        'INSERT INTO forms (tenant_id, tipo, data, ip, user_agent, leido) VALUES (?, ?, ?, ?, ?, 0)',
        [req.tenant.id, req.params.tipo, data, ip, userAgent]
      );

      const waTexto = armarMensajeWhatsApp(req.tenant, req.params.tipo, req.body || {});
      const whatsappUrl = req.tenant.whatsapp
        ? `https://wa.me/${req.tenant.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(waTexto)}`
        : null;

      res.status(201).json({
        ok: true,
        id: result.lastInsertRowid,
        mensaje: 'Formulario enviado correctamente',
        whatsapp_url: whatsappUrl
      });
    } catch (err) {
      logger.error('POST public form:', err);
      res.status(500).json({ ok: false, error: 'Error interno' });
    }
  }
);

function armarMensajeWhatsApp(tenant, tipo, body) {
  let mensaje = `Hola! Soy *${body.nombre || 'Cliente'}*`;
  if (body.telefono) mensaje += ` (${body.telefono})`;
  if (body.email) mensaje += ` - ${body.email}`;
  mensaje += `\n\n*Tipo*: ${tipo.toUpperCase()}\n\n`;
  if (body.mensaje) mensaje += `*Mensaje:*\n${body.mensaje}\n\n`;
  if (body.servicio_id) mensaje += `*Servicio ID:* ${body.servicio_id}\n`;
  if (body.fecha) mensaje += `*Fecha:* ${body.fecha}\n`;
  if (body.items) mensaje += `*Items:* ${JSON.stringify(body.items)}\n`;
  return mensaje;
}

router.get('/:tenant_slug/schema', requireTenant, async (req, res) => {
  try {
    const configRow = fetchOne('SELECT json FROM tenant_config WHERE tenant_id = ?', [req.tenant.id]);
    const config = configRow ? JSON.parse(configRow.json || '{}') : {};
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: req.tenant.nombre,
      email: req.tenant.email_contacto || undefined,
      telephone: req.tenant.whatsapp ? `+${req.tenant.whatsapp.replace(/\D/g, '')}` : undefined,
      image: config.og_image_url || undefined,
      description: config.meta_description || undefined,
      address: config.direccion || undefined,
      url: config.redes?.web || req.tenant.dominio || undefined,
      priceRange: '$$',
      openingHoursSpecification: (config.horarios || []).map((h) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: h.dia || undefined,
        opens: h.horario?.split(' - ')[0] || undefined,
        closes: h.horario?.split(' - ')[1] || undefined
      })),
      sameAs: Object.values(config.redes || {}).filter(Boolean)
    };
    res.json({ ok: true, schema });
  } catch (err) {
    logger.error('GET public schema:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

module.exports = router;
