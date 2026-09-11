const db = require('../db/connection');
const logger = require('../services/logger');

function extraerSlug(req) {
  const host = req.headers.host || '';
  const hostSinPuerto = host.split(':')[0];
  const partesHost = hostSinPuerto.split('.');

  if (partesHost.length >= 3 && !['localhost', '127', '0'].includes(partesHost[0])) {
    const subdominio = partesHost[0];
    if (subdominio && subdominio !== 'www' && subdominio.length <= 50) {
      return subdominio.toLowerCase();
    }
  }

  const path = req.path || '';
  const match = path.match(/^\/([a-z0-9_-]{2,50})(\/|$)/i);
  if (match) {
    return match[1].toLowerCase();
  }

  if (req.query.tenant_slug && typeof req.query.tenant_slug === 'string') {
    return req.query.tenant_slug.toLowerCase();
  }

  return null;
}

function middlewareTenant(req, res, next) {
  try {
    if (req.path.startsWith('/api/') || req.path.startsWith('/admin/') || req.path.includes('.')) {
      const slug = extraerSlug(req);
      if (!slug) {
        return res.error('Tenant no especificado', 400);
      }

      const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(slug);
      if (!tenant) {
        logger.warn(`Tenant no encontrado: ${slug} - IP=${req.ip}`);
        return res.error(`Tenant '${slug}' no encontrado`, 404);
      }

      req.tenant = tenant;
      req.tenant_slug = tenant.slug;
    }
    next();
  } catch (err) {
    logger.error('Error middleware tenant:', err);
    next(err);
  }
}

module.exports = middlewareTenant;
module.exports.extraerSlug = extraerSlug;
