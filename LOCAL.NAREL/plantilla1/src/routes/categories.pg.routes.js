'use strict';

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../db/postgres');
const { authenticate, requireAdmin } = require('../middleware/postgresAuth');

const router = express.Router();

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fail(req, res) {
  const e = validationResult(req);
  return e.isEmpty() ? null : res.status(400).json({ ok: false, message: e.array()[0].msg });
}

router.use(authenticate, requireAdmin);

const RESERVED_SLUGS = new Set([
  'api', 'admin', 'assets', 'uploads', 'dashboard', 'login', 'register',
  'forgot-password', 'reset-password', 'checkout', 'cart', 'orders',
  'notifications', 'banners', 'promotions', 'shipping-promo', 'components',
  'otros-servicios', 'como-comprar', 'politicas-cambio', 'contacto'
]);

// GET /api/admin/categories - List all sections with subcategories and products count
router.get('/', async (_req, res) => {
  try {
    const catsRes = await query(
      'SELECT id, name, slug, sort_order, COALESCE(subtitle, \'CARGADO DESDE PANEL ADMIN\') AS subtitle, created_at, updated_at FROM categories ORDER BY sort_order ASC, name ASC'
    );
    const subcatsRes = await query('SELECT id, category_id, category_slug, name, slug FROM subcategories ORDER BY name ASC');

    let prodCountsMap = new Map();
    try {
      const prodsRes = await query('SELECT category, count(*)::int AS count FROM products GROUP BY category');
      (prodsRes.rows || []).forEach((row) => {
        if (row.category) {
          prodCountsMap.set(String(row.category).toLowerCase().trim(), Number(row.count) || 0);
        }
      });
    } catch (_countErr) {
      // Ignorar si falla el count
    }

    const subcatsByCat = new Map();
    catsRes.rows.forEach((c) => subcatsByCat.set(c.slug, []));
    (subcatsRes.rows || []).forEach((s) => {
      const list = subcatsByCat.get(s.category_slug);
      if (list) list.push(s);
    });

    const data = catsRes.rows.map((c) => ({
      ...c,
      subtitle: c.subtitle || 'CARGADO DESDE PANEL ADMIN',
      products_count: prodCountsMap.get(c.slug.toLowerCase()) || prodCountsMap.get(c.name.toLowerCase()) || 0,
      subcategories: subcatsByCat.get(c.slug) || [],
    }));

    res.json({ ok: true, count: data.length, data });
  } catch (err) {
    console.error('[categories-get] error:', err);
    res.status(500).json({ ok: false, message: 'Error al listar secciones' });
  }
});

// POST /api/admin/categories - Create new section
router.post(
  '/',
  [
    body('name').trim().isLength({ min: 2 }).withMessage('El nombre de la sección debe tener al menos 2 caracteres'),
    body('slug').optional({ checkFalsy: true }).trim(),
    body('subtitle').optional().trim(),
    body('sort_order').optional().isInt(),
  ],
  async (req, res) => {
    if (fail(req, res)) return;
    try {
      const name = req.body.name.trim();
      let slug = slugify(req.body.slug || name);

      if (!slug) {
        return res.status(400).json({ ok: false, message: 'El identificador/URL de la sección no es válido' });
      }

      if (RESERVED_SLUGS.has(slug)) {
        slug = `${slug}-seccion`;
      }

      // Check for duplicate slug
      const checkSlug = await query('SELECT id FROM categories WHERE slug = $1', [slug]);
      if (checkSlug.rows && checkSlug.rows.length > 0) {
        return res.status(400).json({ ok: false, message: `Ya existe una sección con el identificador/URL "${slug}"` });
      }

      const subtitle = req.body.subtitle !== undefined && req.body.subtitle !== ''
        ? req.body.subtitle.trim()
        : 'CARGADO DESDE PANEL ADMIN';

      let sort_order = Number(req.body.sort_order);
      if (isNaN(sort_order) || req.body.sort_order === undefined) {
        const maxOrderRes = await query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM categories');
        sort_order = ((maxOrderRes.rows && maxOrderRes.rows[0]?.max_order) || 0) + 1;
      }

      const r = await query(
        'INSERT INTO categories(name, slug, subtitle, sort_order) VALUES($1, $2, $3, $4) RETURNING id, name, slug, subtitle, sort_order, created_at, updated_at',
        [name, slug, subtitle, sort_order]
      );

      res.status(201).json({
        ok: true,
        message: 'Sección creada exitosamente',
        data: r.rows[0],
      });
    } catch (err) {
      console.error('[categories-create] error:', err);
      res.status(500).json({ ok: false, message: 'Error al crear la sección' });
    }
  }
);

// PUT /api/admin/categories/:id - Update section (name, slug, subtitle, sort_order) + propagate to products and subcategories
router.put(
  '/:id',
  [
    param('id').trim().notEmpty().withMessage('ID inválido'),
    body('name').trim().isLength({ min: 2 }).withMessage('El nombre de la sección debe tener al menos 2 caracteres'),
    body('slug').optional({ checkFalsy: true }).trim(),
    body('subtitle').optional(),
    body('sort_order').optional().isInt(),
  ],
  async (req, res) => {
    if (fail(req, res)) return;
    try {
      const existing = await query('SELECT id, name, slug, subtitle, sort_order FROM categories WHERE id = $1', [req.params.id]);
      if (!existing.rows || !existing.rows[0]) {
        return res.status(404).json({ ok: false, message: 'Sección no encontrada' });
      }

      const oldCat = existing.rows[0];
      const oldSlug = oldCat.slug;
      const oldName = oldCat.name;

      const newName = req.body.name.trim();
      let newSlug = req.body.slug ? slugify(req.body.slug) : slugify(newName);

      if (!newSlug) {
        return res.status(400).json({ ok: false, message: 'URL/identificador no válido' });
      }

      if (RESERVED_SLUGS.has(newSlug)) {
        newSlug = `${newSlug}-seccion`;
      }

      // Check if new slug conflicts with another category
      const dupCheck = await query('SELECT id FROM categories WHERE slug = $1 AND id != $2', [newSlug, oldCat.id]);
      if (dupCheck.rows && dupCheck.rows.length > 0) {
        return res.status(400).json({ ok: false, message: `Ya existe otra sección con la URL "${newSlug}"` });
      }

      const newSubtitle = req.body.subtitle !== undefined
        ? (String(req.body.subtitle).trim() || 'CARGADO DESDE PANEL ADMIN')
        : (oldCat.subtitle || 'CARGADO DESDE PANEL ADMIN');

      const newSortOrder = req.body.sort_order !== undefined && !isNaN(Number(req.body.sort_order))
        ? Number(req.body.sort_order)
        : oldCat.sort_order;

      // Update category record
      const updateRes = await query(
        'UPDATE categories SET name = $1, slug = $2, subtitle = $3, sort_order = $4, updated_at = now() WHERE id = $5 RETURNING id, name, slug, subtitle, sort_order, created_at, updated_at',
        [newName, newSlug, newSubtitle, newSortOrder, oldCat.id]
      );

      // PROPAGATION: If the slug changed, update all products and subcategories associated with the old slug or old name
      let productsUpdated = 0;
      let subcategoriesUpdated = 0;
      if (newSlug !== oldSlug) {
        try {
          const prodsUpdate = await query(
            'UPDATE products SET category = $1 WHERE category = $2 OR category = $3',
            [newSlug, oldSlug, oldName.toLowerCase()]
          );
          productsUpdated = prodsUpdate.rowCount || 0;
        } catch (_prodErr) {
          console.warn('[categories-put] Warning updating products:', _prodErr.message);
        }

        try {
          const subcatsUpdate = await query(
            'UPDATE subcategories SET category_slug = $1 WHERE category_id = $2 OR category_slug = $3',
            [newSlug, oldCat.id, oldSlug]
          );
          subcategoriesUpdated = subcatsUpdate.rowCount || 0;
        } catch (_subErr) {
          console.warn('[categories-put] Warning updating subcategories:', _subErr.message);
        }
      }

      res.json({
        ok: true,
        message: 'Sección actualizada correctamente',
        data: updateRes.rows[0],
        old_slug: oldSlug,
        new_slug: newSlug,
        products_affected: productsUpdated,
        subcategories_affected: subcategoriesUpdated,
      });
    } catch (err) {
      console.error('[categories-update] error:', err);
      res.status(500).json({ ok: false, message: 'Error al actualizar la sección' });
    }
  }
);

// DELETE /api/admin/categories/:id - Delete section + cascade subcategories + unlink products
router.delete('/:id', [param('id').trim().notEmpty()], async (req, res) => {
  if (fail(req, res)) return;
  try {
    const existing = await query('SELECT id, name, slug FROM categories WHERE id = $1', [req.params.id]);
    if (!existing.rows || !existing.rows[0]) {
      return res.status(404).json({ ok: false, message: 'Sección no encontrada' });
    }

    const cat = existing.rows[0];

    // Delete subcategories of this category
    try {
      await query('DELETE FROM subcategories WHERE category_id = $1 OR category_slug = $2', [cat.id, cat.slug]);
    } catch (_subErr) {}

    // Unlink products that belonged to this category
    try {
      await query(
        'UPDATE products SET category = \'\', subcategory = null, subcategory_id = null WHERE category = $1 OR category = $2',
        [cat.slug, cat.name.toLowerCase()]
      );
    } catch (_prodErr) {}

    // Delete the category
    await query('DELETE FROM categories WHERE id = $1', [cat.id]);

    res.json({
      ok: true,
      message: `Sección "${cat.name}" eliminada exitosamente`,
    });
  } catch (err) {
    console.error('[categories-delete] error:', err);
    res.status(500).json({ ok: false, message: 'Error al eliminar la sección' });
  }
});

module.exports = router;
