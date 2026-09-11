const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, fetchOne, fetchAll, runStmt } = require('../db');
const {
  authAdmin,
  limites,
  sanitizeBody,
  validar,
  v
} = require('../middleware/security');
const { JWT_SECRET, JWT_EXPIRES } = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

router.post(
  '/login',
  limites.adminLogin,
  sanitizeBody,
  validar([v.required('email', 'Email requerido'), v.email('email'), v.required('password', 'Password requerida')]),
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const admin = fetchOne('SELECT * FROM admins WHERE email = ?', [email.toLowerCase().trim()]);
      if (!admin) return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
      const ok = await bcrypt.compare(password, admin.password_hash);
      if (!ok) return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
      const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES
      });
      res.json({
        ok: true,
        token,
        admin: { id: admin.id, email: admin.email, nombre: admin.nombre, role: admin.role }
      });
    } catch (err) {
      logger.error('POST admin login:', err);
      res.status(500).json({ ok: false, error: 'Error interno' });
    }
  }
);

router.use(authAdmin);

router.get('/me', (req, res) => {
  try {
    res.json({ ok: true, admin: req.admin });
  } catch (err) {
    logger.error('GET admin me:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.get('/tenants', async (req, res) => {
  try {
    const tenants = fetchAll('SELECT * FROM tenants ORDER BY created_at DESC');
    res.json({ ok: true, tenants });
  } catch (err) {
    logger.error('GET admin tenants:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.post(
  '/tenants',
  sanitizeBody,
  validar([
    v.required('slug', 'slug requerido'),
    v.required('nombre', 'nombre requerido'),
    v.length('slug', 2, 80),
    v.length('nombre', 2, 150),
    v.email('email_contacto')
  ]),
  async (req, res) => {
    try {
      const existe = fetchOne('SELECT id FROM tenants WHERE slug = ?', [req.body.slug]);
      if (existe) return res.status(400).json({ ok: false, error: 'Slug ya utilizado' });

      const tx = db.transaction(() => {
        const result = runStmt(
          'INSERT INTO tenants (slug, nombre, dominio, whatsapp, email_contacto) VALUES (?, ?, ?, ?, ?)',
          [
            req.body.slug,
            req.body.nombre,
            req.body.dominio || null,
            req.body.whatsapp || null,
            req.body.email_contacto || null
          ]
        );
        const tenantId = result.lastInsertRowid;

        const configDefault = JSON.stringify({
          color_principal: req.body.colores?.color_principal || '#2563eb',
          color_secundario: req.body.colores?.color_secundario || '#1e40af',
          color_acento: req.body.colores?.color_acento || '#f59e0b',
          logo_url: req.body.logo_url || '',
          favicon_url: req.body.favicon_url || '',
          meta_title: req.body.nombre,
          meta_description: req.body.meta_description || '',
          og_image_url: req.body.og_image_url || '',
          horarios: req.body.horarios || [],
          direccion: req.body.direccion || '',
          ubicacion_url: req.body.ubicacion_url || '',
          redes: req.body.redes || { ig: '', fb: '', web: '' }
        });
        runStmt('INSERT INTO tenant_config (tenant_id, json) VALUES (?, ?)', [tenantId, configDefault]);
        return tenantId;
      });
      const tenantId = tx();
      res.status(201).json({ ok: true, id: tenantId, mensaje: 'Cliente creado' });
    } catch (err) {
      logger.error('POST admin tenants:', err);
      res.status(500).json({ ok: false, error: 'Error interno' });
    }
  }
);

router.put(
  '/tenants/:id',
  sanitizeBody,
  validar([v.length('nombre', 2, 150), v.email('email_contacto')]),
  async (req, res) => {
    try {
      const tenant = fetchOne('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
      if (!tenant) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });

      const tx = db.transaction(() => {
        runStmt(
          'UPDATE tenants SET slug=?, nombre=?, dominio=?, whatsapp=?, email_contacto=? WHERE id=?',
          [
            req.body.slug || tenant.slug,
            req.body.nombre || tenant.nombre,
            req.body.dominio ?? tenant.dominio,
            req.body.whatsapp ?? tenant.whatsapp,
            req.body.email_contacto ?? tenant.email_contacto,
            tenant.id
          ]
        );

        const prevRow = fetchOne('SELECT json FROM tenant_config WHERE tenant_id = ?', [tenant.id]);
        const prev = prevRow ? JSON.parse(prevRow.json || '{}') : {};
        const newConfig = { ...prev };

        ['color_principal', 'color_secundario', 'color_acento', 'logo_url', 'favicon_url', 'meta_title',
         'meta_description', 'og_image_url', 'direccion', 'ubicacion_url'].forEach((k) => {
          if (k in req.body) newConfig[k] = req.body[k];
        });
        if (req.body.horarios) newConfig.horarios = req.body.horarios;
        if (req.body.redes) newConfig.redes = { ...(newConfig.redes || {}), ...req.body.redes };

        const json = JSON.stringify(newConfig);
        if (prevRow) {
          runStmt('UPDATE tenant_config SET json = ? WHERE tenant_id = ?', [json, tenant.id]);
        } else {
          runStmt('INSERT INTO tenant_config (tenant_id, json) VALUES (?, ?)', [tenant.id, json]);
        }
      });
      tx();
      res.json({ ok: true, mensaje: 'Cliente actualizado' });
    } catch (err) {
      logger.error('PUT admin tenants:', err);
      res.status(500).json({ ok: false, error: 'Error interno' });
    }
  }
);

router.delete('/tenants/:id', async (req, res) => {
  try {
    const tenant = fetchOne('SELECT id FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });
    runStmt('DELETE FROM tenants WHERE id = ?', [tenant.id]);
    res.json({ ok: true, mensaje: 'Cliente eliminado' });
  } catch (err) {
    logger.error('DELETE admin tenants:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

function requireTenantParam(req, res, next) {
  try {
    const t = fetchOne('SELECT * FROM tenants WHERE id = ?', [req.params.tenant_id]);
    if (!t) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });
    req.tenant = t;
    next();
  } catch (err) {
    logger.error('requireTenantParam:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
}

router.use('/tenants/:tenant_id/*', requireTenantParam);

router.get('/tenants/:tenant_id/services', async (req, res) => {
  try {
    const rows = fetchAll('SELECT * FROM services WHERE tenant_id = ? ORDER BY orden ASC, id ASC', [req.tenant.id]);
    res.json({ ok: true, servicios: rows });
  } catch (err) {
    logger.error('GET admin services:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.post(
  '/tenants/:tenant_id/services',
  sanitizeBody,
  validar([v.required('nombre', 'Nombre requerido')]),
  async (req, res) => {
    try {
      const result = runStmt(
        'INSERT INTO services (tenant_id, nombre, descripcion, precio, categoria, duracion_min, destacado, activo, orden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          req.tenant.id,
          req.body.nombre,
          req.body.descripcion || '',
          parseFloat(req.body.precio) || 0,
          req.body.categoria || '',
          parseInt(req.body.duracion_min) || 0,
          req.body.destacado ? 1 : 0,
          req.body.activo === undefined ? 1 : req.body.activo ? 1 : 0,
          parseInt(req.body.orden) || 0
        ]
      );
      res.status(201).json({ ok: true, id: result.lastInsertRowid, mensaje: 'Servicio creado' });
    } catch (err) {
      logger.error('POST admin services:', err);
      res.status(500).json({ ok: false, error: 'Error interno' });
    }
  }
);

router.put('/tenants/:tenant_id/services/:id', sanitizeBody, async (req, res) => {
  try {
    const row = fetchOne('SELECT * FROM services WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!row) return res.status(404).json({ ok: false, error: 'Servicio no encontrado' });
    runStmt(
      'UPDATE services SET nombre=?, descripcion=?, precio=?, categoria=?, duracion_min=?, destacado=?, activo=?, orden=? WHERE id=?',
      [
        req.body.nombre ?? row.nombre,
        req.body.descripcion ?? row.descripcion,
        'precio' in req.body ? parseFloat(req.body.precio) || 0 : row.precio,
        req.body.categoria ?? row.categoria,
        'duracion_min' in req.body ? parseInt(req.body.duracion_min) || 0 : row.duracion_min,
        'destacado' in req.body ? (req.body.destacado ? 1 : 0) : row.destacado,
        'activo' in req.body ? (req.body.activo ? 1 : 0) : row.activo,
        'orden' in req.body ? parseInt(req.body.orden) || 0 : row.orden,
        row.id
      ]
    );
    res.json({ ok: true, mensaje: 'Servicio actualizado' });
  } catch (err) {
    logger.error('PUT admin services:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.delete('/tenants/:tenant_id/services/:id', async (req, res) => {
  try {
    const row = fetchOne('SELECT id FROM services WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!row) return res.status(404).json({ ok: false, error: 'Servicio no encontrado' });
    runStmt('DELETE FROM services WHERE id = ?', [row.id]);
    res.json({ ok: true, mensaje: 'Servicio eliminado' });
  } catch (err) {
    logger.error('DELETE admin services:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.get('/tenants/:tenant_id/gallery', async (req, res) => {
  try {
    const rows = fetchAll('SELECT * FROM gallery WHERE tenant_id = ? ORDER BY orden ASC, id ASC', [req.tenant.id]);
    res.json({ ok: true, galeria: rows });
  } catch (err) {
    logger.error('GET admin gallery:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.post(
  '/tenants/:tenant_id/gallery',
  sanitizeBody,
  validar([v.required('url_imagen', 'url_imagen requerida')]),
  async (req, res) => {
    try {
      const result = runStmt(
        'INSERT INTO gallery (tenant_id, titulo, descripcion, url_imagen, categoria, orden, activo) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          req.tenant.id,
          req.body.titulo || '',
          req.body.descripcion || '',
          req.body.url_imagen,
          req.body.categoria || '',
          parseInt(req.body.orden) || 0,
          req.body.activo === undefined ? 1 : req.body.activo ? 1 : 0
        ]
      );
      res.status(201).json({ ok: true, id: result.lastInsertRowid, mensaje: 'Imagen creada' });
    } catch (err) {
      logger.error('POST admin gallery:', err);
      res.status(500).json({ ok: false, error: 'Error interno' });
    }
  }
);

router.put('/tenants/:tenant_id/gallery/:id', sanitizeBody, async (req, res) => {
  try {
    const row = fetchOne('SELECT * FROM gallery WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!row) return res.status(404).json({ ok: false, error: 'Imagen no encontrada' });
    runStmt(
      'UPDATE gallery SET titulo=?, descripcion=?, url_imagen=?, categoria=?, orden=?, activo=? WHERE id=?',
      [
        req.body.titulo ?? row.titulo,
        req.body.descripcion ?? row.descripcion,
        req.body.url_imagen ?? row.url_imagen,
        req.body.categoria ?? row.categoria,
        'orden' in req.body ? parseInt(req.body.orden) || 0 : row.orden,
        'activo' in req.body ? (req.body.activo ? 1 : 0) : row.activo,
        row.id
      ]
    );
    res.json({ ok: true, mensaje: 'Imagen actualizada' });
  } catch (err) {
    logger.error('PUT admin gallery:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.delete('/tenants/:tenant_id/gallery/:id', async (req, res) => {
  try {
    const row = fetchOne('SELECT id FROM gallery WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!row) return res.status(404).json({ ok: false, error: 'Imagen no encontrada' });
    runStmt('DELETE FROM gallery WHERE id = ?', [row.id]);
    res.json({ ok: true, mensaje: 'Imagen eliminada' });
  } catch (err) {
    logger.error('DELETE admin gallery:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.get('/tenants/:tenant_id/faq', async (req, res) => {
  try {
    const rows = fetchAll('SELECT * FROM faq WHERE tenant_id = ? ORDER BY orden ASC, id ASC', [req.tenant.id]);
    res.json({ ok: true, faq: rows });
  } catch (err) {
    logger.error('GET admin faq:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.post(
  '/tenants/:tenant_id/faq',
  sanitizeBody,
  validar([v.required('pregunta', 'Pregunta requerida')]),
  async (req, res) => {
    try {
      const result = runStmt(
        'INSERT INTO faq (tenant_id, pregunta, respuesta, orden, activo) VALUES (?, ?, ?, ?, ?)',
        [
          req.tenant.id,
          req.body.pregunta,
          req.body.respuesta || '',
          parseInt(req.body.orden) || 0,
          req.body.activo === undefined ? 1 : req.body.activo ? 1 : 0
        ]
      );
      res.status(201).json({ ok: true, id: result.lastInsertRowid, mensaje: 'FAQ creada' });
    } catch (err) {
      logger.error('POST admin faq:', err);
      res.status(500).json({ ok: false, error: 'Error interno' });
    }
  }
);

router.put('/tenants/:tenant_id/faq/:id', sanitizeBody, async (req, res) => {
  try {
    const row = fetchOne('SELECT * FROM faq WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!row) return res.status(404).json({ ok: false, error: 'FAQ no encontrada' });
    runStmt('UPDATE faq SET pregunta=?, respuesta=?, orden=?, activo=? WHERE id=?', [
      req.body.pregunta ?? row.pregunta,
      req.body.respuesta ?? row.respuesta,
      'orden' in req.body ? parseInt(req.body.orden) || 0 : row.orden,
      'activo' in req.body ? (req.body.activo ? 1 : 0) : row.activo,
      row.id
    ]);
    res.json({ ok: true, mensaje: 'FAQ actualizada' });
  } catch (err) {
    logger.error('PUT admin faq:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.delete('/tenants/:tenant_id/faq/:id', async (req, res) => {
  try {
    const row = fetchOne('SELECT id FROM faq WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!row) return res.status(404).json({ ok: false, error: 'FAQ no encontrada' });
    runStmt('DELETE FROM faq WHERE id = ?', [row.id]);
    res.json({ ok: true, mensaje: 'FAQ eliminada' });
  } catch (err) {
    logger.error('DELETE admin faq:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.get('/tenants/:tenant_id/ia-knowledge', async (req, res) => {
  try {
    const rows = fetchAll('SELECT * FROM ia_knowledge WHERE tenant_id = ? ORDER BY id DESC', [req.tenant.id]);
    res.json({ ok: true, knowledge: rows });
  } catch (err) {
    logger.error('GET admin ia-knowledge:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.post(
  '/tenants/:tenant_id/ia-knowledge',
  sanitizeBody,
  validar([v.required('contenido', 'Contenido requerido')]),
  async (req, res) => {
    try {
      const result = runStmt(
        'INSERT INTO ia_knowledge (tenant_id, categoria, contenido, activo) VALUES (?, ?, ?, ?)',
        [
          req.tenant.id,
          req.body.categoria || 'general',
          req.body.contenido,
          req.body.activo === undefined ? 1 : req.body.activo ? 1 : 0
        ]
      );
      res.status(201).json({ ok: true, id: result.lastInsertRowid, mensaje: 'Conocimiento creado' });
    } catch (err) {
      logger.error('POST admin ia-knowledge:', err);
      res.status(500).json({ ok: false, error: 'Error interno' });
    }
  }
);

router.put('/tenants/:tenant_id/ia-knowledge/:id', sanitizeBody, async (req, res) => {
  try {
    const row = fetchOne('SELECT * FROM ia_knowledge WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!row) return res.status(404).json({ ok: false, error: 'Conocimiento no encontrado' });
    runStmt('UPDATE ia_knowledge SET categoria=?, contenido=?, activo=? WHERE id=?', [
      req.body.categoria ?? row.categoria,
      req.body.contenido ?? row.contenido,
      'activo' in req.body ? (req.body.activo ? 1 : 0) : row.activo,
      row.id
    ]);
    res.json({ ok: true, mensaje: 'Conocimiento actualizado' });
  } catch (err) {
    logger.error('PUT admin ia-knowledge:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.delete('/tenants/:tenant_id/ia-knowledge/:id', async (req, res) => {
  try {
    const row = fetchOne('SELECT id FROM ia_knowledge WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!row) return res.status(404).json({ ok: false, error: 'Conocimiento no encontrado' });
    runStmt('DELETE FROM ia_knowledge WHERE id = ?', [row.id]);
    res.json({ ok: true, mensaje: 'Conocimiento eliminado' });
  } catch (err) {
    logger.error('DELETE admin ia-knowledge:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.get('/tenants/:tenant_id/forms', async (req, res) => {
  try {
    let sql = 'SELECT * FROM forms WHERE tenant_id = ?';
    const params = [req.tenant.id];
    if (req.query.tipo) {
      sql += ' AND tipo = ?';
      params.push(req.query.tipo);
    }
    if (req.query.desde) {
      sql += ' AND created_at >= ?';
      params.push(parseInt(req.query.desde));
    }
    if (req.query.hasta) {
      sql += ' AND created_at <= ?';
      params.push(parseInt(req.query.hasta));
    }
    sql += ' ORDER BY created_at DESC';
    const rows = fetchAll(sql, params);
    res.json({ ok: true, forms: rows });
  } catch (err) {
    logger.error('GET admin forms:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.patch('/tenants/:tenant_id/forms/:id', async (req, res) => {
  try {
    const row = fetchOne('SELECT id FROM forms WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!row) return res.status(404).json({ ok: false, error: 'Formulario no encontrado' });
    runStmt('UPDATE forms SET leido = 1 WHERE id = ?', [row.id]);
    res.json({ ok: true, mensaje: 'Marcado como leído' });
  } catch (err) {
    logger.error('PATCH admin forms:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.delete('/tenants/:tenant_id/forms/:id', async (req, res) => {
  try {
    const row = fetchOne('SELECT id FROM forms WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!row) return res.status(404).json({ ok: false, error: 'Formulario no encontrado' });
    runStmt('DELETE FROM forms WHERE id = ?', [row.id]);
    res.json({ ok: true, mensaje: 'Formulario eliminado' });
  } catch (err) {
    logger.error('DELETE admin forms:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

router.post(
  '/generar-cliente',
  sanitizeBody,
  validar([v.required('slug', 'slug requerido'), v.required('nombre', 'nombre requerido')]),
  async (req, res) => {
    try {
      const existe = fetchOne('SELECT id FROM tenants WHERE slug = ?', [req.body.slug]);
      if (existe) return res.status(400).json({ ok: false, error: 'Slug ya utilizado' });

      const colores = req.body.colores || {};

      const tx = db.transaction(() => {
        const r = runStmt(
          'INSERT INTO tenants (slug, nombre, dominio, whatsapp, email_contacto) VALUES (?, ?, ?, ?, ?)',
          [
            req.body.slug,
            req.body.nombre,
            req.body.dominio || null,
            req.body.whatsapp || null,
            req.body.email || null
          ]
        );
        const tenantId = r.lastInsertRowid;

        const cfg = JSON.stringify({
          color_principal: colores.color_principal || '#2563eb',
          color_secundario: colores.color_secundario || '#1e40af',
          color_acento: colores.color_acento || '#f59e0b',
          logo_url: '',
          favicon_url: '',
          meta_title: req.body.nombre,
          meta_description: `${req.body.nombre} - Soluciones profesionales`,
          og_image_url: '',
          horarios: [
            { dia: 'Lunes a Viernes', horario: '09:00 - 18:00' },
            { dia: 'Sábados', horario: '10:00 - 14:00' }
          ],
          direccion: req.body.direccion || '',
          ubicacion_url: req.body.ubicacion_url || '',
          redes: { ig: '', fb: '', web: '' }
        });
        runStmt('INSERT INTO tenant_config (tenant_id, json) VALUES (?, ?)', [tenantId, cfg]);

        const srv = db.prepare(
          'INSERT INTO services (tenant_id, nombre, descripcion, precio, categoria, duracion_min, destacado, activo, orden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        srv.run(tenantId, 'Servicio Estándar', 'Nuestro servicio principal con atención personalizada.', 99.99, 'General', 30, 1, 1, 1);
        srv.run(tenantId, 'Servicio Premium', 'Versión premium con beneficios adicionales.', 249.99, 'Premium', 60, 1, 1, 2);
        srv.run(tenantId, 'Consultoría', 'Asesoramiento personalizado uno a uno.', 150, 'Consultoría', 45, 0, 1, 3);

        const f = db.prepare('INSERT INTO faq (tenant_id, pregunta, respuesta, orden, activo) VALUES (?, ?, ?, ?, ?)');
        f.run(tenantId, '¿Cómo contratar un servicio?', 'Contactanos por WhatsApp o completa el formulario web y te responderemos a la brevedad.', 1, 1);
        f.run(tenantId, '¿Aceptan tarjetas?', 'Sí, aceptamos tarjetas Visa, Mastercard, American Express y transferencias bancarias.', 2, 1);
        f.run(tenantId, '¿Tienen garantía?', 'Sí, todos nuestros servicios tienen garantía de satisfacción por 30 días.', 3, 1);

        return tenantId;
      });
      const tenantId = tx();

      res.status(201).json({ ok: true, id: tenantId, mensaje: 'Cliente completo generado con éxito' });
    } catch (err) {
      logger.error('POST admin generar-cliente:', err);
      res.status(500).json({ ok: false, error: 'Error interno' });
    }
  }
);

module.exports = router;
