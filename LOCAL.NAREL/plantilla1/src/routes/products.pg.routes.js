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

const fields = 'id,name,description,price,sizes,stock,image_url,category,subcategory,subcategory_id,active,featured,created_at,updated_at';

router.use(authenticate, requireAdmin);

// ================= CATEGORIES & SUBCATEGORIES FOR ADMIN =================
router.get('/categories', async (_req, res) => {
  try {
    const catsRes = await query('SELECT id, name, slug, sort_order FROM categories ORDER BY sort_order ASC, name ASC');
    const subcatsRes = await query('SELECT id, category_id, category_slug, name, slug FROM subcategories ORDER BY name ASC');

    const subcatsByCat = new Map();
    catsRes.rows.forEach((c) => subcatsByCat.set(c.slug, []));
    subcatsRes.rows.forEach((s) => {
      const list = subcatsByCat.get(s.category_slug);
      if (list) list.push(s);
    });

    const data = catsRes.rows.map((c) => ({
      ...c,
      subcategories: subcatsByCat.get(c.slug) || [],
    }));

    res.json({ ok: true, data });
  } catch (err) {
    console.error('[admin/categories] error:', err);
    res.status(500).json({ ok: false, message: 'Error al obtener categorías' });
  }
});

router.post('/subcategories', async (req, res) => {
  try {
    const category_slug = slugify(req.body.category_slug || req.body.category);
    const rawName = String(req.body.name || '').trim();

    if (!category_slug) {
      return res.status(400).json({ ok: false, message: 'La categoría es obligatoria' });
    }
    if (!rawName || rawName.length < 2) {
      return res.status(400).json({ ok: false, message: 'El nombre de la subcategoría debe tener al menos 2 caracteres' });
    }

    const catRes = await query('SELECT id, name, slug FROM categories WHERE slug = $1', [category_slug]);
    if (!catRes.rows[0]) {
      return res.status(404).json({ ok: false, message: `Categoría '${category_slug}' no encontrada` });
    }
    const cat = catRes.rows[0];
    const subSlug = slugify(rawName);

    // Check if subcategory already exists under this category
    const existing = await query(
      'SELECT id, category_id, category_slug, name, slug FROM subcategories WHERE category_slug = $1 AND slug = $2',
      [cat.slug, subSlug]
    );

    if (existing.rows[0]) {
      return res.status(200).json({
        ok: true,
        message: 'La subcategoría ya existe para esta categoría',
        data: existing.rows[0],
        created: false,
      });
    }

    const newSub = await query(
      'INSERT INTO subcategories(category_id, category_slug, name, slug) VALUES($1, $2, $3, $4) RETURNING id, category_id, category_slug, name, slug',
      [cat.id, cat.slug, rawName, subSlug]
    );

    return res.status(201).json({
      ok: true,
      message: 'Subcategoría creada con éxito',
      data: newSub.rows[0],
      created: true,
    });
  } catch (err) {
    console.error('[admin/subcategories] error:', err);
    return res.status(500).json({ ok: false, message: 'Error al crear subcategoría' });
  }
});

// ================= PRODUCTS LIST & STATS =================
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const order = ['updated_at', 'created_at', 'name', 'price', 'stock', 'featured', 'active'].includes(req.query.order)
      ? req.query.order
      : 'updated_at';
    const dir = req.query.desc ? 'DESC' : 'ASC';
    const count = await query('SELECT count(*)::int AS count FROM products');
    const r = await query(`SELECT ${fields} FROM products ORDER BY ${order} ${dir} LIMIT $1 OFFSET $2`, [limit, offset]);
    res.json({ ok: true, data: r.rows, count: count.rows[0].count });
  } catch (err) {
    console.error('[admin/products] error:', err);
    res.status(500).json({ ok: false, message: 'Error al listar productos' });
  }
});

router.get('/stats', async (_req, res) => {
  try {
    const r = await query('SELECT count(*)::int total_products,coalesce(sum(stock),0)::int total_stock,count(*) FILTER (WHERE stock<=0)::int out_of_stock FROM products');
    res.json({ ok: true, data: r.rows[0] });
  } catch (err) {
    console.error('[admin/stats] error:', err);
    res.status(500).json({ ok: false, message: 'Error al obtener estadísticas' });
  }
});

router.get('/:id', [param('id').isUUID()], async (req, res) => {
  if (fail(req, res)) return;
  try {
    const r = await query(`SELECT ${fields} FROM products WHERE id=$1`, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ ok: false, message: 'Producto no encontrado' });
    res.json({ ok: true, data: r.rows[0] });
  } catch (err) {
    console.error('[admin/product-get] error:', err);
    res.status(500).json({ ok: false, message: 'Error al buscar producto' });
  }
});

const rules = [
  body('name').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Nombre requerido'),
  body('description').optional().isString(),
  body('price').custom((v) => {
    if (!Number.isFinite(Number(v)) || Number(v) < 0) throw Error('Precio inválido');
    return true;
  }),
  body('sizes').optional().isString(),
  body('stock').custom((v) => {
    if (!Number.isInteger(Number(v)) || Number(v) < 0) throw Error('Stock inválido');
    return true;
  }),
  body('category').optional().isString().trim().notEmpty().withMessage('Categoría inválida'),
  body('subcategory').optional().isString().trim(),
  body('subcategory_id').optional(),
  body('active').optional().isBoolean(),
  body('featured').optional().isBoolean(),
];

router.post('/', rules, async (req, res) => {
  if (fail(req, res)) return;
  try {
    const categorySlug = slugify(req.body.category || 'remeras');
    let subcategorySlug = req.body.subcategory ? slugify(req.body.subcategory) : null;
    let subcategoryId = req.body.subcategory_id || null;

    // Validate subcategory belongs to category if provided
    if (subcategorySlug || subcategoryId) {
      const subRes = await query(
        'SELECT id, slug, category_slug FROM subcategories WHERE category_slug = $1 AND (slug = $2 OR id::text = $3)',
        [categorySlug, subcategorySlug || '', String(subcategoryId || '')]
      );
      if (subRes.rows[0]) {
        subcategorySlug = subRes.rows[0].slug;
        subcategoryId = subRes.rows[0].id;
      } else {
        // Clear invalid subcategory relation
        subcategorySlug = null;
        subcategoryId = null;
      }
    }

    const r = await query(
      `INSERT INTO products(name,description,price,sizes,stock,image_url,category,subcategory,subcategory_id,active,featured) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${fields}`,
      [
        req.body.name.trim(),
        req.body.description || '',
        Number(req.body.price),
        req.body.sizes || '',
        Number(req.body.stock),
        req.body.image_url || null,
        categorySlug,
        subcategorySlug,
        subcategoryId,
        req.body.active !== false,
        req.body.featured === true,
      ]
    );
    res.status(201).json({ ok: true, message: 'Producto creado correctamente', data: r.rows[0] });
  } catch (err) {
    console.error('[admin/product-create] error:', err);
    res.status(500).json({ ok: false, message: 'Error al crear producto' });
  }
});

router.put('/:id', [param('id').isUUID(), ...rules], async (req, res) => {
  if (fail(req, res)) return;
  try {
    const existing = await query('SELECT id, category, subcategory, subcategory_id FROM products WHERE id=$1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ ok: false, message: 'Producto no encontrado' });

    const currentProd = existing.rows[0];
    const categorySlug = req.body.category ? slugify(req.body.category) : currentProd.category;
    let subcategorySlug = req.body.subcategory !== undefined ? (req.body.subcategory ? slugify(req.body.subcategory) : null) : currentProd.subcategory;
    let subcategoryId = req.body.subcategory_id !== undefined ? (req.body.subcategory_id || null) : currentProd.subcategory_id;

    // Validate subcategory belongs to category
    if (subcategorySlug || subcategoryId) {
      const subRes = await query(
        'SELECT id, slug, category_slug FROM subcategories WHERE category_slug = $1 AND (slug = $2 OR id::text = $3)',
        [categorySlug, subcategorySlug || '', String(subcategoryId || '')]
      );
      if (subRes.rows[0]) {
        subcategorySlug = subRes.rows[0].slug;
        subcategoryId = subRes.rows[0].id;
      } else {
        // Relation is invalid or category changed: clear subcategory
        subcategorySlug = null;
        subcategoryId = null;
      }
    }

    const r = await query(
      `UPDATE products SET name=$1,description=$2,price=$3,sizes=$4,stock=$5,image_url=COALESCE($6,image_url),category=$7,subcategory=$8,subcategory_id=$9,active=COALESCE($10,active),featured=COALESCE($11,featured),updated_at=now() WHERE id=$12 RETURNING ${fields}`,
      [
        req.body.name.trim(),
        req.body.description || '',
        Number(req.body.price),
        req.body.sizes || '',
        Number(req.body.stock),
        req.body.image_url || null,
        categorySlug,
        subcategorySlug,
        subcategoryId,
        req.body.active === undefined ? null : req.body.active,
        req.body.featured === undefined ? null : req.body.featured,
        req.params.id,
      ]
    );
    res.json({ ok: true, message: 'Producto actualizado correctamente', data: r.rows[0] });
  } catch (err) {
    console.error('[admin/product-update] error:', err);
    res.status(500).json({ ok: false, message: 'Error al actualizar producto' });
  }
});

router.delete('/:id', [param('id').isUUID()], async (req, res) => {
  if (fail(req, res)) return;
  try {
    const r = await query('DELETE FROM products WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ ok: false, message: 'Producto no encontrado' });
    res.json({ ok: true, message: 'Producto eliminado correctamente' });
  } catch (err) {
    console.error('[admin/product-delete] error:', err);
    res.status(500).json({ ok: false, message: 'Error al eliminar producto' });
  }
});

module.exports = router;

