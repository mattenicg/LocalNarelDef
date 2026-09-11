const db = require('../db/connection');
const logger = require('../services/logger');
const { verifyJWT, extraerTokenBearer } = require('../services/auth');

function middlewareAuth(req, res, next) {
  try {
    const token = extraerTokenBearer(req);
    if (!token) {
      return res.error('Autenticación requerida', 401);
    }

    const payload = verifyJWT(token);
    if (!payload || !payload.admin_id) {
      return res.error('Token inválido o expirado', 401);
    }

    const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(payload.admin_id);
    if (!admin) {
      return res.error('Administrador no existe', 401);
    }

    if (req.tenant && admin.tenant_id !== req.tenant.id) {
      logger.warn(`Admin ${admin.id} intentó acceder a tenant ${req.tenant.id}`);
      return res.error('No autorizado en este tenant', 403);
    }

    if (!req.tenant) {
      const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(admin.tenant_id);
      if (tenant) {
        req.tenant = tenant;
        req.tenant_slug = tenant.slug;
      }
    }

    delete admin.password_hash;
    req.admin = admin;

    try {
      db.prepare('UPDATE admins SET ultimo_login = datetime(\'now\') WHERE id = ?').run(admin.id);
    } catch {}

    next();
  } catch (err) {
    logger.error('Error middleware auth:', err);
    next(err);
  }
}

module.exports = middlewareAuth;
