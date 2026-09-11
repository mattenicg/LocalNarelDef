const express = require('express');
const db = require('../db/connection');
const logger = require('../services/logger');
const middlewareAuth = require('../middleware/auth');
const { limiterLogin } = require('../middleware/rateLimit');
const { generateJWT, verifyPassword, hashPassword } = require('../services/auth');
const { validationResult, schemas } = require('../utils/validation');

const router = express.Router();

function manejarErroresValidacion(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    const mensajes = errores.array().map(e => `${e.path || e.param}: ${e.msg}`).join('; ');
    return res.error(mensajes, 400);
  }
  next();
}

router.post('/admin/login',
  limiterLogin,
  schemas.adminLogin,
  manejarErroresValidacion,
  (req, res, next) => {
    try {
      const tenantId = req.tenant?.id;
      const { email, password } = req.body;

      const baseStmt = 'SELECT * FROM admins WHERE email = ?';
      const admin = tenantId
        ? db.prepare(baseStmt + ' AND tenant_id = ?').get(email, tenantId)
        : db.prepare(baseStmt + ' LIMIT 1').get(email);

      if (!admin) {
        logger.warn(`Login fallido email=${email} - admin no existe`);
        return res.error('Credenciales inválidas', 401);
      }

      const valida = verifyPassword(password, admin.password_hash);
      if (!valida) {
        logger.warn(`Login fallido email=${email} - password incorrecta`);
        return res.error('Credenciales inválidas', 401);
      }

      try {
        db.prepare("UPDATE admins SET ultimo_login = datetime('now') WHERE id = ?").run(admin.id);
      } catch {}

      const payload = {
        admin_id: admin.id,
        tenant_id: admin.tenant_id,
        email: admin.email,
        role: admin.role,
      };
      const token = generateJWT(payload);

      delete admin.password_hash;
      logger.info(`[tenant=${admin.tenant_id}] Admin login OK: ${admin.email}`);

      return res.ok({
        token,
        admin,
      }, 'Sesión iniciada correctamente');
    } catch (err) {
      logger.error('Error POST /admin/login:', err);
      next(err);
    }
  }
);

router.get('/admin/me', middlewareAuth, (req, res, next) => {
  try {
    return res.ok({
      admin: req.admin,
      tenant: req.tenant ? { id: req.tenant.id, slug: req.tenant.slug } : null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/admin/password',
  middlewareAuth,
  schemas.cambioPassword,
  manejarErroresValidacion,
  (req, res, next) => {
    try {
      const { password_actual, password_nueva } = req.body;
      const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);

      if (!admin || !verifyPassword(password_actual, admin.password_hash)) {
        return res.error('Contraseña actual incorrecta', 400);
      }

      const nuevoHash = hashPassword(password_nueva);
      db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(nuevoHash, admin.id);
      logger.info(`Admin ${admin.email} cambió contraseña`);
      return res.ok(null, 'Contraseña actualizada correctamente');
    } catch (err) {
      logger.error('Error PUT /admin/password:', err);
      next(err);
    }
  }
);

router.get('/admin/negocio', middlewareAuth, (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const negocio = db.prepare('SELECT * FROM negocio WHERE tenant_id = ? LIMIT 1').get(tenantId);
    return res.ok(negocio || {});
  } catch (err) {
    next(err);
  }
});

router.put('/admin/negocio',
  middlewareAuth,
  schemas.negocio,
  manejarErroresValidacion,
  (req, res, next) => {
    try {
      const tenantId = req.tenant.id;
      const existe = db.prepare('SELECT id FROM negocio WHERE tenant_id = ?').get(tenantId);

      const campos = [
        'nombre', 'descripcion', 'tagline', 'whatsapp', 'email', 'telefono',
        'direccion', 'ciudad', 'logo_url', 'color_primario', 'color_secundario',
        'color_terciario', 'dominio', 'meta_title', 'meta_desc', 'og_image',
        'ia_conocimiento',
      ];

      const valores = [];
      const sets = [];
      for (const c of campos) {
        if (c in req.body) {
          sets.push(`${c} = ?`);
          valores.push(req.body[c]);
        }
      }
      if ('horario_json' in req.body) {
        sets.push('horario_json = ?');
        valores.push(
          typeof req.body.horario_json === 'object'
            ? JSON.stringify(req.body.horario_json)
            : String(req.body.horario_json || '{}')
        );
      }
      if ('schema_org_json' in req.body) {
        sets.push('schema_org_json = ?');
        valores.push(
          typeof req.body.schema_org_json === 'object'
            ? JSON.stringify(req.body.schema_org_json)
            : String(req.body.schema_org_json || '{}')
        );
      }

      if (existe) {
        valores.push(tenantId);
        db.prepare(`UPDATE negocio SET ${sets.join(', ')} WHERE tenant_id = ?`).run(...valores);
      } else {
        sets.unshift('tenant_id = ?');
        valores.unshift(tenantId);
        const colNames = sets.map(s => s.split(' ')[0]);
        const placeholders = colNames.map(() => '?').join(', ');
        db.prepare(`INSERT INTO negocio (${colNames.join(', ')}) VALUES (${placeholders})`).run(...valores);
      }

      const negocio = db.prepare('SELECT * FROM negocio WHERE tenant_id = ? LIMIT 1').get(tenantId);
      logger.info(`[${req.tenant_slug}] Negocio actualizado por ${req.admin.email}`);
      return res.ok(negocio, 'Negocio actualizado correctamente');
    } catch (err) {
      logger.error('Error PUT /admin/negocio:', err);
      next(err);
    }
  }
);

function crearCrudRecurso(nombre, tabla, camposObligatorios, camposTodos) {
  router.get(`/admin/${nombre}`, middlewareAuth, (req, res, next) => {
    try {
      const tenantId = req.tenant.id;
      const order = tabla === 'servicios' || tabla === 'galeria' || tabla === 'faqs' ? 'orden ASC, id DESC' : 'id DESC';
      const filas = db.prepare(`SELECT * FROM ${tabla} WHERE tenant_id = ? ORDER BY ${order}`).all(tenantId);
      return res.ok(filas);
    } catch (err) { next(err); }
  });

  router.post(`/admin/${nombre}`,
    middlewareAuth,
    schemas[nombre] || [],
    manejarErroresValidacion,
    (req, res, next) => {
      try {
        const tenantId = req.tenant.id;
        const sets = ['tenant_id'];
        const valores = [tenantId];
        const placeholders = ['?'];

        for (const c of camposTodos) {
          if (c in req.body) {
            sets.push(c);
            valores.push(req.body[c]);
            placeholders.push('?');
          }
        }

        const r = db.prepare(`INSERT INTO ${tabla} (${sets.join(', ')}) VALUES (${placeholders.join(', ')})`).run(...valores);
        const fila = db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(r.lastInsertRowid);
        logger.info(`[${req.tenant_slug}] ${nombre} creado id=${r.lastInsertRowid} por ${req.admin.email}`);
        return res.ok(fila, `${nombre.slice(0, 1).toUpperCase() + nombre.slice(1)} creado correctamente`);
      } catch (err) {
        logger.error(`Error POST /admin/${nombre}:`, err);
        next(err);
      }
    }
  );

  router.put(`/admin/${nombre}/:id`,
    middlewareAuth,
    schemas.idParam,
    schemas[nombre] || [],
    manejarErroresValidacion,
    (req, res, next) => {
      try {
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const existente = db.prepare(`SELECT * FROM ${tabla} WHERE id = ? AND tenant_id = ?`).get(id, tenantId);
        if (!existente) {
          return res.error('Recurso no encontrado', 404);
        }

        const sets = [];
        const valores = [];
        for (const c of camposTodos) {
          if (c in req.body) {
            sets.push(`${c} = ?`);
            valores.push(req.body[c]);
          }
        }
        if (!sets.length) return res.ok(existente, 'Sin cambios');

        valores.push(id, tenantId);
        db.prepare(`UPDATE ${tabla} SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...valores);
        const fila = db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(id);
        logger.info(`[${req.tenant_slug}] ${nombre} actualizado id=${id} por ${req.admin.email}`);
        return res.ok(fila, 'Actualizado correctamente');
      } catch (err) {
        logger.error(`Error PUT /admin/${nombre}:`, err);
        next(err);
      }
    }
  );

  router.delete(`/admin/${nombre}/:id`,
    middlewareAuth,
    schemas.idParam,
    manejarErroresValidacion,
    (req, res, next) => {
      try {
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const existente = db.prepare(`SELECT * FROM ${tabla} WHERE id = ? AND tenant_id = ?`).get(id, tenantId);
        if (!existente) return res.error('Recurso no encontrado', 404);

        db.prepare(`DELETE FROM ${tabla} WHERE id = ? AND tenant_id = ?`).run(id, tenantId);
        logger.info(`[${req.tenant_slug}] ${nombre} eliminado id=${id} por ${req.admin.email}`);
        return res.ok({ id }, 'Eliminado correctamente');
      } catch (err) {
        logger.error(`Error DELETE /admin/${nombre}:`, err);
        next(err);
      }
    }
  );
}

crearCrudRecurso(
  'servicios',
  'servicios',
  ['nombre'],
  ['nombre', 'descripcion', 'precio', 'moneda', 'categoria', 'destacado', 'orden', 'activo']
);
crearCrudRecurso('galeria', 'galeria', ['url'], ['url', 'titulo', 'orden']);
crearCrudRecurso('faqs', 'faqs', ['pregunta', 'respuesta'], ['pregunta', 'respuesta', 'orden']);

router.get('/admin/formularios',
  middlewareAuth,
  schemas.formulariosQuery,
  manejarErroresValidacion,
  (req, res, next) => {
    try {
      const tenantId = req.tenant.id;
      const pagina = parseInt(req.query.pagina, 10) || 1;
      const porPagina = parseInt(req.query.por_pagina, 10) || 25;
      const offset = (pagina - 1) * porPagina;
      const filtro = req.query.leido;

      const where = ['tenant_id = ?'];
      const params = [tenantId];
      if (filtro === '0' || filtro === '1') {
        where.push('leido = ?');
        params.push(parseInt(filtro, 10));
      }

      const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = db.prepare(`SELECT COUNT(*) as n FROM formularios_entrada ${whereSQL}`).get(...params).n;
      const formularios = db.prepare(`
        SELECT * FROM formularios_entrada
        ${whereSQL}
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?
      `).all(...params, porPagina, offset);

      return res.ok({
        total,
        pagina,
        por_pagina: porPagina,
        paginas: Math.max(1, Math.ceil(total / porPagina)),
        items: formularios,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.put('/admin/formularios/:id/leido',
  middlewareAuth,
  schemas.idParam,
  manejarErroresValidacion,
  (req, res, next) => {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      const form = db.prepare('SELECT * FROM formularios_entrada WHERE id = ? AND tenant_id = ?').get(id, tenantId);
      if (!form) return res.error('Formulario no encontrado', 404);

      const nuevoLeido = req.body?.leido === 0 ? 0 : 1;
      db.prepare('UPDATE formularios_entrada SET leido = ? WHERE id = ?').run(nuevoLeido, id);
      const actualizado = db.prepare('SELECT * FROM formularios_entrada WHERE id = ?').get(id);
      logger.info(`[${req.tenant_slug}] Formulario ${id} marcado leido=${nuevoLeido} por ${req.admin.email}`);
      return res.ok(actualizado);
    } catch (err) {
      logger.error('Error PUT /admin/formularios/:id/leido:', err);
      next(err);
    }
  }
);

module.exports = router;
