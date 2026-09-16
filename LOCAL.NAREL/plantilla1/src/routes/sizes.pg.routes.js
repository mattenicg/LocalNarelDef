'use strict';

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../db/postgres');
const { authenticate, requireAdmin } = require('../middleware/postgresAuth');

const router = express.Router();

function fail(req, res) {
  const e = validationResult(req);
  return e.isEmpty() ? null : res.status(400).json({ ok: false, message: e.array()[0].msg });
}

router.use(authenticate, requireAdmin);

// GET /api/admin/sizes - List all custom sizes
router.get('/', async (req, res) => {
  try {
    const r = await query('SELECT id, name, active, created_at FROM sizes_master ORDER BY name ASC');
    res.json({ ok: true, data: r.rows });
  } catch (err) {
    console.error('[sizes-get] error:', err);
    res.status(500).json({ ok: false, message: 'Error al obtener talles' });
  }
});

// POST /api/admin/sizes - Create new custom size
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('El nombre del talle es obligatorio').isLength({ max: 50 }).withMessage('El nombre es demasiado largo'),
  ],
  async (req, res) => {
    if (fail(req, res)) return;
    try {
      const name = req.body.name.trim();

      // Check for duplicate
      const checkDup = await query('SELECT id, active FROM sizes_master WHERE LOWER(name) = LOWER($1)', [name]);
      if (checkDup.rows && checkDup.rows.length > 0) {
        const existing = checkDup.rows[0];
        if (!existing.active) {
          // Reactivate it
          await query('UPDATE sizes_master SET active = true WHERE id = $1', [existing.id]);
          const updated = await query('SELECT id, name, active, created_at FROM sizes_master WHERE id = $1', [existing.id]);
          return res.status(200).json({ ok: true, message: 'Talle reactivado', data: updated.rows[0] });
        }
        return res.status(400).json({ ok: false, message: 'Este talle ya existe' });
      }

      const r = await query(
        'INSERT INTO sizes_master (name, active) VALUES ($1, true) RETURNING id, name, active, created_at',
        [name]
      );
      res.status(201).json({ ok: true, message: 'Talle creado correctamente', data: r.rows[0] });
    } catch (err) {
      console.error('[sizes-post] error:', err);
      res.status(500).json({ ok: false, message: 'Error al crear talle' });
    }
  }
);

// PUT /api/admin/sizes/:id - Edit custom size
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('ID inválido'),
    body('name').trim().notEmpty().withMessage('El nombre del talle es obligatorio').isLength({ max: 50 }).withMessage('El nombre es demasiado largo'),
    body('active').optional().isBoolean().withMessage('Estado activo inválido'),
  ],
  async (req, res) => {
    if (fail(req, res)) return;
    try {
      const { id } = req.params;
      const name = req.body.name.trim();
      const active = req.body.active !== undefined ? req.body.active : true;

      // Check existence
      const sizeRes = await query('SELECT id, name FROM sizes_master WHERE id = $1', [id]);
      if (!sizeRes.rows[0]) {
        return res.status(404).json({ ok: false, message: 'Talle no encontrado' });
      }

      const oldName = sizeRes.rows[0].name;

      // Check duplicates with other sizes
      const checkDup = await query('SELECT id FROM sizes_master WHERE LOWER(name) = LOWER($1) AND id <> $2', [name, id]);
      if (checkDup.rows && checkDup.rows.length > 0) {
        return res.status(400).json({ ok: false, message: 'Ya existe otro talle con ese nombre' });
      }

      // Update name in sizes_master
      const r = await query(
        'UPDATE sizes_master SET name = $1, active = $2 WHERE id = $3 RETURNING id, name, active, created_at',
        [name, active, id]
      );

      // If name changed, also update it in product_size_stock for continuity
      if (LOWER(oldName) !== LOWER(name)) {
        await query(
          'UPDATE product_size_stock SET size_name = $1 WHERE size_name = $2',
          [name, oldName]
        );
      }

      res.json({ ok: true, message: 'Talle actualizado correctamente', data: r.rows[0] });
    } catch (err) {
      console.error('[sizes-put] error:', err);
      res.status(500).json({ ok: false, message: 'Error al actualizar talle' });
    }
  }
);

// DELETE /api/admin/sizes/:id - Safe deletion of custom size
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('ID inválido')],
  async (req, res) => {
    if (fail(req, res)) return;
    try {
      const { id } = req.params;

      const sizeRes = await query('SELECT name FROM sizes_master WHERE id = $1', [id]);
      if (!sizeRes.rows[0]) {
        return res.status(404).json({ ok: false, message: 'Talle no encontrado' });
      }

      const sizeName = sizeRes.rows[0].name;

      // Check if size is configured on any product size_stock
      const stockCheck = await query('SELECT 1 FROM product_size_stock WHERE size_name = $1 LIMIT 1', [sizeName]);
      // Check if used in order items
      const orderCheck = await query('SELECT 1 FROM order_items WHERE size = $1 LIMIT 1', [sizeName]);

      if (stockCheck.rows.length > 0 || orderCheck.rows.length > 0) {
        // Safe check: do not delete, archive instead
        await query('UPDATE sizes_master SET active = false WHERE id = $1', [id]);
        return res.json({
          ok: true,
          message: 'El talle está siendo utilizado por productos o pedidos históricos. Se ha desactivado/archivado para preservar la integridad.',
          archived: true,
        });
      }

      await query('DELETE FROM sizes_master WHERE id = $1', [id]);
      res.json({ ok: true, message: 'Talle eliminado correctamente', archived: false });
    } catch (err) {
      console.error('[sizes-delete] error:', err);
      res.status(500).json({ ok: false, message: 'Error al eliminar talle' });
    }
  }
);

function LOWER(str) {
  return String(str || '').toLowerCase().trim();
}

module.exports = router;
