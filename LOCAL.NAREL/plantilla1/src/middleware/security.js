const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { JSDOM } = require('jsdom');
const DOMPurify = require('dompurify');
const { check, validationResult } = require('express-validator');
const { JWT_SECRET } = require('../config');
const { fetchOne } = require('../db');
const logger = require('../utils/logger');

const window = new JSDOM('').window;
const purify = DOMPurify(window);

function authAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Token no proporcionado' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = fetchOne('SELECT id, email, nombre, role FROM admins WHERE id = ?', [decoded.id]);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin no encontrado' });
    }
    req.admin = admin;
    next();
  } catch (err) {
    logger.error('Error authAdmin:', err);
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }
}

function requireTenant(req, res, next) {
  try {
    let tenant_slug = req.params.tenant_slug;
    if (!tenant_slug) tenant_slug = req.params.tenant_id;
    if (!tenant_slug) tenant_slug = req.query.tenant_slug || req.query.tenant_id;
    if (!tenant_slug && req.body) tenant_slug = req.body.tenant_slug || req.body.tenant_id;
    if (!tenant_slug) tenant_slug = req.headers['x-tenant'];

    if (!tenant_slug) {
      return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
    }

    let tenant;
    if (/^\d+$/.test(String(tenant_slug))) {
      tenant = fetchOne('SELECT * FROM tenants WHERE id = ?', [parseInt(tenant_slug, 10)]);
    } else {
      tenant = fetchOne('SELECT * FROM tenants WHERE slug = ?', [tenant_slug]);
    }

    if (!tenant) {
      return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });
    }
    req.tenant = tenant;
    next();
  } catch (err) {
    logger.error('Error requireTenant:', err);
    return res.status(500).json({ ok: false, error: 'Error interno' });
  }
}

const limites = {
  formContacto: rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 6,
    message: { ok: false, error: 'Demasiados envíos de formulario. Intenta nuevamente en una hora.' },
    standardHeaders: true,
    legacyHeaders: false
  }),
  iaChat: rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { ok: false, error: 'Límite de mensajes alcanzado. Intenta nuevamente en una hora.' },
    standardHeaders: true,
    legacyHeaders: false
  }),
  adminLogin: rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { ok: false, error: 'Demasiados intentos de login. Intenta nuevamente en un minuto.' },
    standardHeaders: true,
    legacyHeaders: false
  })
};

function sanitizeValue(val) {
  if (typeof val === 'string') {
    return purify.sanitize(val.trim());
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val && typeof val === 'object') {
    const obj = {};
    for (const k of Object.keys(val)) {
      obj[k] = sanitizeValue(val[k]);
    }
    return obj;
  }
  return val;
}

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
}

function validar(rules) {
  return [
    ...rules,
    (req, res, next) => {
      const errores = validationResult(req);
      if (!errores.isEmpty()) {
        return res.status(400).json({
          ok: false,
          error: 'Datos inválidos',
          detalles: errores.array().map((e) => ({ campo: e.param, mensaje: e.msg }))
        });
      }
      next();
    }
  ];
}

const v = {
  required: (campo, mensaje) => check(campo).notEmpty().withMessage(mensaje || `${campo} es requerido`),
  email: (campo) => check(campo).optional().isEmail().withMessage('Email inválido'),
  length: (campo, min, max, mensaje) =>
    check(campo)
      .optional()
      .isLength({ min, max })
      .withMessage(mensaje || `${campo} debe tener entre ${min} y ${max} caracteres`),
  numeric: (campo, mensaje) =>
    check(campo).optional().isNumeric().withMessage(mensaje || `${campo} debe ser numérico`),
  integer: (campo, mensaje) =>
    check(campo).optional().isInt().withMessage(mensaje || `${campo} debe ser entero`)
};

module.exports = { authAdmin, requireTenant, limites, sanitizeBody, validar, v };
