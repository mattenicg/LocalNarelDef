const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../db/postgres');
const { authenticate, requireAdmin } = require('../middleware/postgresAuth');
const {
  getProductImages,
  syncProductImages,
  addProductImages,
  deleteProductImage,
  reorderProductImages,
  deleteProductImagesForProduct,
} = require('../services/productImages.service');

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

async function saveProductSizeStock(productId, sizeStocks) {
  const sizeStocksArray = Array.isArray(sizeStocks) ? sizeStocks : [];
  const valid = sizeStocksArray.filter(item => item && typeof item.size_name === 'string' && item.size_name.trim() !== '');

  await query('DELETE FROM product_size_stock WHERE product_id = $1', [productId]);

  let totalStock = 0;
  const sizeNamesList = [];

  for (const item of valid) {
    const sizeName = item.size_name.trim();
    const stock = Math.max(0, parseInt(item.stock, 10) || 0);
    totalStock += stock;
    sizeNamesList.push(sizeName);

    await query(
      'INSERT INTO product_size_stock (product_id, size_name, stock) VALUES ($1, $2, $3)',
      [productId, sizeName, stock]
    );

    await query(
      'INSERT INTO sizes_master (name, active) VALUES ($1, true) ON CONFLICT (LOWER(name)) DO NOTHING',
      [sizeName]
    );
  }

  const sizesString = sizeNamesList.join(', ');
  await query(
    'UPDATE products SET stock = $1, sizes = $2 WHERE id = $3',
    [totalStock, sizesString, productId]
  );

  return { totalStock, sizesString };
}

const fields = 'id,name,description,price,sizes,size_guide,stock,image_url,images,category,subcategory,subcategory_id,active,featured,direct_purchase,allowed_payment_methods,allowed_installments,direct_discount_percent,direct_discount_text,direct_show_promo_badge,direct_promo_badge_text,direct_installments_count,direct_installments_text,direct_custom_transfer_price,direct_transfer_text,cash_discount_percent,cash_discount_text,cash_custom_price,cash_text,created_at,updated_at';

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
    const products = r.rows;
    const productIds = products.map((p) => p.id);
    if (productIds.length > 0) {
      try {
        const sizeStockRes = await query(
          'SELECT product_id, size_name, stock FROM product_size_stock WHERE product_id = ANY($1) ORDER BY size_name ASC',
          [productIds]
        );
        const ssMap = new Map();
        (sizeStockRes.rows || []).forEach((row) => {
          if (!ssMap.has(row.product_id)) ssMap.set(row.product_id, []);
          ssMap.get(row.product_id).push(row);
        });
        products.forEach((p) => {
          p.size_stock = ssMap.get(p.id) || [];
        });
      } catch (ssErr) {
        console.warn('[admin/products] fallback size stock error:', ssErr.message);
      }
    }
    res.json({ ok: true, data: products, count: count.rows[0].count });
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
    const product = r.rows[0];

    // Load size stock
    try {
      const sizeStockRes = await query(
        'SELECT size_name, stock FROM product_size_stock WHERE product_id = $1 ORDER BY size_name ASC',
        [product.id]
      );
      product.size_stock = sizeStockRes.rows || [];
    } catch (ssErr) {
      console.warn('[admin/product-get] warn loading size_stock:', ssErr.message);
      product.size_stock = [];
    }

    // Load persistent product_images
    try {
      const pImages = await getProductImages(product.id);
      product.product_images = pImages;
      if (pImages && pImages.length > 0) {
        product.images = pImages.map((img) => img.image_url);
        product.image_url = pImages[0].image_url;
      }
    } catch (imgErr) {
      console.warn('[admin/product-get] warn loading product_images:', imgErr.message);
      product.product_images = [];
    }

    // Check if there is an existing promotion linked to this product (in promotions / promotion_products)
    try {
      const promoRes = await query(
        `SELECT p.id AS promo_id, p.title AS promo_title, p.discount_type, p.discount_value, p.badge_label, pp.override_price, pp.discount_percentage
         FROM promotion_products pp
         JOIN promotions p ON p.id = pp.promotion_id
         WHERE pp.product_id = $1 AND p.active = true
         ORDER BY p.created_at DESC LIMIT 1`,
        [req.params.id]
      );
      if (promoRes && promoRes.rows && promoRes.rows[0]) {
        product.active_promotion = promoRes.rows[0];
      }
    } catch (_pErr) {}

    res.json({ ok: true, data: product });
  } catch (err) {
    console.error('[admin/product-get] error:', err);
    res.status(500).json({ ok: false, message: 'Error al buscar producto' });
  }
});

const rules = [
  body('name').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Nombre requerido'),
  body('description').optional({ nullable: true, checkFalsy: true }).isString(),
  body('price').custom((v) => {
    if (!Number.isFinite(Number(v)) || Number(v) < 0) throw Error('Precio inválido');
    return true;
  }),
  body('sizes').optional({ nullable: true, checkFalsy: true }).isString(),
  body('size_guide').optional({ nullable: true, checkFalsy: true }).isString(),
  body('stock').custom((v) => {
    if (!Number.isInteger(Number(v)) || Number(v) < 0) throw Error('Stock inválido');
    return true;
  }),
  body('category').optional().isString().trim().notEmpty().withMessage('Categoría inválida'),
  body('subcategory').custom((v) => v === null || v === undefined || typeof v === 'string'),
  body('subcategory_id').custom((v) => v === null || v === undefined || typeof v === 'string'),
  body('active').optional({ nullable: true, checkFalsy: true }).isBoolean(),
  body('featured').optional({ nullable: true, checkFalsy: true }).isBoolean(),
  body('direct_purchase').optional({ nullable: true, checkFalsy: true }).isBoolean(),
  body('allowed_payment_methods').optional({ nullable: true, checkFalsy: true }).isArray(),
  body('allowed_installments').optional({ nullable: true, checkFalsy: true }).isArray(),
  body('direct_discount_percent').optional({ nullable: true, checkFalsy: true }),
  body('direct_discount_text').optional({ nullable: true, checkFalsy: true }).isString(),
  body('direct_show_promo_badge').optional({ nullable: true, checkFalsy: true }).isBoolean(),
  body('direct_promo_badge_text').optional({ nullable: true, checkFalsy: true }).isString(),
  body('direct_installments_count').optional({ nullable: true, checkFalsy: true }),
  body('direct_installments_text').optional({ nullable: true, checkFalsy: true }).isString(),
  body('direct_custom_transfer_price').optional({ nullable: true, checkFalsy: true }),
  body('direct_transfer_text').optional({ nullable: true, checkFalsy: true }).isString(),
  body('cash_discount_percent').optional({ nullable: true, checkFalsy: true }),
  body('cash_discount_text').optional({ nullable: true, checkFalsy: true }).isString(),
  body('cash_custom_price').optional({ nullable: true, checkFalsy: true }),
  body('cash_text').optional({ nullable: true, checkFalsy: true }).isString(),
  body('size_stock').optional().isArray(),
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

    const directPurchase = req.body.direct_purchase === true;
    const allowedPaymentMethods = Array.isArray(req.body.allowed_payment_methods) && req.body.allowed_payment_methods.length > 0
      ? JSON.stringify(req.body.allowed_payment_methods)
      : JSON.stringify(['tarjeta_credito', 'tarjeta_debito', 'transferencia', 'efectivo']);
    const allowedInstallments = Array.isArray(req.body.allowed_installments) && req.body.allowed_installments.length > 0
      ? JSON.stringify(req.body.allowed_installments.map(Number).filter((n) => Number.isInteger(n) && n > 0))
      : JSON.stringify([1, 3, 6]);

    const directDiscountPercent = req.body.direct_discount_percent !== undefined && req.body.direct_discount_percent !== '' && req.body.direct_discount_percent !== null
      ? Math.min(100, Math.max(0, Number(req.body.direct_discount_percent)))
      : 25.00;
    const directDiscountText = req.body.direct_discount_text ? String(req.body.direct_discount_text).trim() : 'con transferencia';
    const directShowPromoBadge = req.body.direct_show_promo_badge !== false;
    const directPromoBadgeText = req.body.direct_promo_badge_text ? String(req.body.direct_promo_badge_text).trim() : 'PROMO ACTIVA';
    const directInstallmentsCount = Number(req.body.direct_installments_count) > 0 ? Number(req.body.direct_installments_count) : 6;
    const directInstallmentsText = req.body.direct_installments_text ? String(req.body.direct_installments_text).trim() : 'sin interés';
    const directCustomTransferPrice = req.body.direct_custom_transfer_price !== undefined && req.body.direct_custom_transfer_price !== '' && req.body.direct_custom_transfer_price !== null && Number(req.body.direct_custom_transfer_price) > 0
      ? Number(req.body.direct_custom_transfer_price)
      : null;
    const directTransferText = req.body.direct_transfer_text ? String(req.body.direct_transfer_text).trim() : 'con Transferencia';

    const cashDiscountPercent = req.body.cash_discount_percent !== undefined && req.body.cash_discount_percent !== '' && req.body.cash_discount_percent !== null
      ? Math.min(100, Math.max(0, Number(req.body.cash_discount_percent)))
      : 15.00;
    const cashDiscountText = req.body.cash_discount_text ? String(req.body.cash_discount_text).trim() : 'en efectivo';
    const cashCustomPrice = req.body.cash_custom_price !== undefined && req.body.cash_custom_price !== '' && req.body.cash_custom_price !== null && Number(req.body.cash_custom_price) > 0
      ? Number(req.body.cash_custom_price)
      : null;
    const cashText = req.body.cash_text ? String(req.body.cash_text).trim() : 'en Efectivo';

    let images = [];
    if (Array.isArray(req.body.images)) {
      images = req.body.images.filter(Boolean);
    } else if (typeof req.body.images === 'string' && req.body.images.trim()) {
      try {
        const parsed = JSON.parse(req.body.images);
        if (Array.isArray(parsed)) images = parsed.filter(Boolean);
      } catch (_) {
        images = [req.body.images.trim()];
      }
    }
    const mainImageUrl = (req.body.image_url && typeof req.body.image_url === 'string' && req.body.image_url.trim())
      ? req.body.image_url.trim()
      : (images[0] || null);
    if (mainImageUrl && !images.includes(mainImageUrl)) {
      images.unshift(mainImageUrl);
    }

    const sizeGuide = req.body.size_guide ? String(req.body.size_guide).trim() : null;

    const r = await query(
      `INSERT INTO products(name,description,price,sizes,size_guide,stock,image_url,images,category,subcategory,subcategory_id,active,featured,direct_purchase,allowed_payment_methods,allowed_installments,direct_discount_percent,direct_discount_text,direct_show_promo_badge,direct_promo_badge_text,direct_installments_count,direct_installments_text,direct_custom_transfer_price,direct_transfer_text,cash_discount_percent,cash_discount_text,cash_custom_price,cash_text) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING ${fields}`,
      [
        req.body.name.trim(),
        req.body.description || '',
        Number(req.body.price),
        req.body.sizes || '',
        sizeGuide,
        Number(req.body.stock),
        mainImageUrl,
        JSON.stringify(images),
        categorySlug,
        subcategorySlug,
        subcategoryId,
        req.body.active !== false,
        req.body.featured === true,
        directPurchase,
        allowedPaymentMethods,
        allowedInstallments,
        directDiscountPercent,
        directDiscountText,
        directShowPromoBadge,
        directPromoBadgeText,
        directInstallmentsCount,
        directInstallmentsText,
        directCustomTransferPrice,
        directTransferText,
        cashDiscountPercent,
        cashDiscountText,
        cashCustomPrice,
        cashText,
      ]
    );
    const createdProduct = r.rows[0];

    // Save custom size stock array if passed, otherwise fall back to legacy/global size configuration
    let sizeStockPayload = req.body.size_stock;
    if (!sizeStockPayload || !sizeStockPayload.length) {
      const rawSizes = req.body.sizes ? String(req.body.sizes).trim() : 'Único';
      const parsedSizes = rawSizes.split(/\s*[-|/,]\s*/).map(s => s.trim()).filter(Boolean);
      const isSingleSize = parsedSizes.length <= 1;
      
      sizeStockPayload = parsedSizes.map((s) => ({
        size_name: s,
        stock: isSingleSize ? Number(req.body.stock || 0) : 0
      }));
    }

    const { totalStock, sizesString } = await saveProductSizeStock(createdProduct.id, sizeStockPayload);
    createdProduct.stock = totalStock;
    createdProduct.sizes = sizesString;
    createdProduct.size_stock = sizeStockPayload;

    if (images.length > 0) {
      try {
        const synced = await syncProductImages(createdProduct.id, images);
        createdProduct.product_images = synced;
        createdProduct.images = synced.map((img) => img.image_url);
        createdProduct.image_url = synced[0]?.image_url || null;
      } catch (imgErr) {
        console.warn('[admin/product-create] syncProductImages warn:', imgErr.message);
      }
    } else {
      createdProduct.product_images = [];
    }

    res.status(201).json({ ok: true, message: 'Producto creado correctamente', data: createdProduct });
  } catch (err) {
    console.error('[admin/product-create] error:', err);
    res.status(500).json({ ok: false, message: 'Error al crear producto' });
  }
});

router.put('/:id', [param('id').isUUID(), ...rules], async (req, res) => {
  if (fail(req, res)) return;
  try {
    const existing = await query('SELECT id, category, subcategory, subcategory_id, image_url, images, direct_purchase, allowed_payment_methods, allowed_installments, direct_discount_percent, direct_discount_text, direct_show_promo_badge, direct_promo_badge_text, direct_installments_count, direct_installments_text, direct_custom_transfer_price, direct_transfer_text, cash_discount_percent, cash_discount_text, cash_custom_price, cash_text FROM products WHERE id=$1', [req.params.id]);
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

    const directPurchase = req.body.direct_purchase !== undefined ? (req.body.direct_purchase === true) : Boolean(currentProd.direct_purchase);
    const allowedPaymentMethods = req.body.allowed_payment_methods !== undefined
      ? (Array.isArray(req.body.allowed_payment_methods) && req.body.allowed_payment_methods.length > 0
          ? JSON.stringify(req.body.allowed_payment_methods)
          : JSON.stringify(['tarjeta_credito', 'tarjeta_debito', 'transferencia', 'efectivo']))
      : (currentProd.allowed_payment_methods ? JSON.stringify(currentProd.allowed_payment_methods) : JSON.stringify(['tarjeta_credito', 'tarjeta_debito', 'transferencia', 'efectivo']));
    const allowedInstallments = req.body.allowed_installments !== undefined
      ? (Array.isArray(req.body.allowed_installments) && req.body.allowed_installments.length > 0
          ? JSON.stringify(req.body.allowed_installments.map(Number).filter((n) => Number.isInteger(n) && n > 0))
          : JSON.stringify([1, 3, 6]))
      : (currentProd.allowed_installments ? JSON.stringify(currentProd.allowed_installments) : JSON.stringify([1, 3, 6]));

    const directDiscountPercent = req.body.direct_discount_percent !== undefined && req.body.direct_discount_percent !== '' && req.body.direct_discount_percent !== null
      ? Math.min(100, Math.max(0, Number(req.body.direct_discount_percent)))
      : (currentProd.direct_discount_percent !== undefined && currentProd.direct_discount_percent !== null ? Number(currentProd.direct_discount_percent) : 25.00);
    const directDiscountText = req.body.direct_discount_text !== undefined
      ? String(req.body.direct_discount_text).trim()
      : (currentProd.direct_discount_text || 'con transferencia');
    const directShowPromoBadge = req.body.direct_show_promo_badge !== undefined
      ? req.body.direct_show_promo_badge === true
      : (currentProd.direct_show_promo_badge !== false);
    const directPromoBadgeText = req.body.direct_promo_badge_text !== undefined
      ? String(req.body.direct_promo_badge_text).trim()
      : (currentProd.direct_promo_badge_text || 'PROMO ACTIVA');
    const directInstallmentsCount = req.body.direct_installments_count !== undefined && Number(req.body.direct_installments_count) > 0
      ? Number(req.body.direct_installments_count)
      : (Number(currentProd.direct_installments_count) || 6);
    const directInstallmentsText = req.body.direct_installments_text !== undefined
      ? String(req.body.direct_installments_text).trim()
      : (currentProd.direct_installments_text || 'sin interés');
    const directCustomTransferPrice = req.body.direct_custom_transfer_price !== undefined
      ? (req.body.direct_custom_transfer_price !== '' && req.body.direct_custom_transfer_price !== null && Number(req.body.direct_custom_transfer_price) > 0 ? Number(req.body.direct_custom_transfer_price) : null)
      : (currentProd.direct_custom_transfer_price ? Number(currentProd.direct_custom_transfer_price) : null);
    const directTransferText = req.body.direct_transfer_text !== undefined
      ? String(req.body.direct_transfer_text).trim()
      : (currentProd.direct_transfer_text || 'con Transferencia');

    const cashDiscountPercent = req.body.cash_discount_percent !== undefined && req.body.cash_discount_percent !== '' && req.body.cash_discount_percent !== null
      ? Math.min(100, Math.max(0, Number(req.body.cash_discount_percent)))
      : (currentProd.cash_discount_percent !== undefined && currentProd.cash_discount_percent !== null ? Number(currentProd.cash_discount_percent) : 15.00);
    const cashDiscountText = req.body.cash_discount_text !== undefined
      ? String(req.body.cash_discount_text).trim()
      : (currentProd.cash_discount_text || 'en efectivo');
    const cashCustomPrice = req.body.cash_custom_price !== undefined
      ? (req.body.cash_custom_price !== '' && req.body.cash_custom_price !== null && Number(req.body.cash_custom_price) > 0 ? Number(req.body.cash_custom_price) : null)
      : (currentProd.cash_custom_price ? Number(currentProd.cash_custom_price) : null);
    const cashText = req.body.cash_text !== undefined
      ? String(req.body.cash_text).trim()
      : (currentProd.cash_text || 'en Efectivo');

    const sizeGuide = req.body.size_guide !== undefined ? (req.body.size_guide ? String(req.body.size_guide).trim() : null) : (currentProd.size_guide || null);

    let imagesJson = null;
    let mainImageUrl = req.body.image_url !== undefined ? req.body.image_url : currentProd.image_url;

    if (req.body.images !== undefined) {
      let imagesList = [];
      if (Array.isArray(req.body.images)) {
        imagesList = req.body.images.filter(Boolean);
      } else if (typeof req.body.images === 'string' && req.body.images.trim()) {
        try {
          const parsed = JSON.parse(req.body.images);
          if (Array.isArray(parsed)) imagesList = parsed.filter(Boolean);
        } catch (_) {
          imagesList = [req.body.images.trim()];
        }
      }
      if (mainImageUrl && !imagesList.includes(mainImageUrl)) {
        imagesList.unshift(mainImageUrl);
      }
      if (!mainImageUrl && imagesList.length > 0) {
        mainImageUrl = imagesList[0];
      }
      imagesJson = JSON.stringify(imagesList);
    }

    const r = await query(
      `UPDATE products SET name=$1,description=$2,price=$3,sizes=$4,size_guide=$5,stock=$6,image_url=$7,images=COALESCE($8::jsonb,images),category=$9,subcategory=$10,subcategory_id=$11,active=COALESCE($12,active),featured=COALESCE($13,featured),direct_purchase=$14,allowed_payment_methods=$15,allowed_installments=$16,direct_discount_percent=$17,direct_discount_text=$18,direct_show_promo_badge=$19,direct_promo_badge_text=$20,direct_installments_count=$21,direct_installments_text=$22,direct_custom_transfer_price=$23,direct_transfer_text=$24,cash_discount_percent=$25,cash_discount_text=$26,cash_custom_price=$27,cash_text=$28,updated_at=now() WHERE id=$29 RETURNING ${fields}`,
      [
        req.body.name.trim(),
        req.body.description || '',
        Number(req.body.price),
        req.body.sizes || '',
        sizeGuide,
        Number(req.body.stock),
        mainImageUrl,
        imagesJson,
        categorySlug,
        subcategorySlug,
        subcategoryId,
        req.body.active === undefined ? null : req.body.active,
        req.body.featured === undefined ? null : req.body.featured,
        directPurchase,
        allowedPaymentMethods,
        allowedInstallments,
        directDiscountPercent,
        directDiscountText,
        directShowPromoBadge,
        directPromoBadgeText,
        directInstallmentsCount,
        directInstallmentsText,
        directCustomTransferPrice,
        directTransferText,
        cashDiscountPercent,
        cashDiscountText,
        cashCustomPrice,
        cashText,
        req.params.id,
      ]
    );

    const updatedProd = r.rows[0];

    // Save custom size stock array if passed, otherwise fall back to legacy/global sizes
    let sizeStockPayload = req.body.size_stock;
    if (sizeStockPayload !== undefined) {
      if (!sizeStockPayload || !sizeStockPayload.length) {
        const rawSizes = req.body.sizes ? String(req.body.sizes).trim() : 'Único';
        const parsedSizes = rawSizes.split(/\s*[-|/,]\s*/).map(s => s.trim()).filter(Boolean);
        const isSingleSize = parsedSizes.length <= 1;

        sizeStockPayload = parsedSizes.map((s) => ({
          size_name: s,
          stock: isSingleSize ? Number(req.body.stock || 0) : 0
        }));
      }

      const { totalStock, sizesString } = await saveProductSizeStock(req.params.id, sizeStockPayload);
      updatedProd.stock = totalStock;
      updatedProd.sizes = sizesString;
      updatedProd.size_stock = sizeStockPayload;
    } else {
      try {
        const sizeStockRes = await query(
          'SELECT size_name, stock FROM product_size_stock WHERE product_id = $1 ORDER BY size_name ASC',
          [req.params.id]
        );
        updatedProd.size_stock = sizeStockRes.rows || [];
      } catch (ssErr) {
        updatedProd.size_stock = [];
      }
    }

    // Synchronize persistent product_images table if images provided
    if (req.body.images !== undefined || req.body.product_images !== undefined) {
      const targetImages = req.body.product_images !== undefined
        ? req.body.product_images
        : (imagesJson ? JSON.parse(imagesJson) : []);
      try {
        const synced = await syncProductImages(req.params.id, targetImages);
        updatedProd.product_images = synced;
        updatedProd.images = synced.map((img) => img.image_url);
        updatedProd.image_url = synced[0]?.image_url || null;
      } catch (imgErr) {
        console.warn('[admin/product-update] syncProductImages warn:', imgErr.message);
      }
    } else {
      try {
        updatedProd.product_images = await getProductImages(req.params.id);
      } catch (_) {
        updatedProd.product_images = [];
      }
    }

    res.json({ ok: true, message: 'Producto actualizado correctamente', data: updatedProd });
  } catch (err) {
    console.error('[admin/product-update] error:', err);
    res.status(500).json({ ok: false, message: 'Error al actualizar producto' });
  }
});

router.delete('/:id', [param('id').isUUID()], async (req, res) => {
  if (fail(req, res)) return;
  try {
    // Clean up physical images from disk before product row deletion
    await deleteProductImagesForProduct(req.params.id);

    const r = await query('DELETE FROM products WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ ok: false, message: 'Producto no encontrado' });
    res.json({ ok: true, message: 'Producto eliminado correctamente' });
  } catch (err) {
    console.error('[admin/product-delete] error:', err);
    res.status(500).json({ ok: false, message: 'Error al eliminar producto' });
  }
});

// ================= PRODUCT IMAGES DIRECT CRUD =================
router.get('/:id/images', [param('id').isUUID()], async (req, res) => {
  if (fail(req, res)) return;
  try {
    const images = await getProductImages(req.params.id);
    res.json({ ok: true, data: images });
  } catch (err) {
    console.error('[admin/product-images-get] error:', err);
    res.status(500).json({ ok: false, message: 'Error al obtener imágenes del producto' });
  }
});

router.post('/:id/images', [param('id').isUUID()], async (req, res) => {
  if (fail(req, res)) return;
  try {
    const newImages = req.body.images || req.body.image_url || req.body.url;
    if (!newImages) return res.status(400).json({ ok: false, message: 'Faltan imágenes' });
    const updated = await addProductImages(req.params.id, newImages);
    res.json({ ok: true, message: 'Imágenes agregadas correctamente', data: updated });
  } catch (err) {
    console.error('[admin/product-images-add] error:', err);
    res.status(500).json({ ok: false, message: 'Error al agregar imágenes' });
  }
});

router.delete('/:id/images/:imageId', [param('id').isUUID()], async (req, res) => {
  if (fail(req, res)) return;
  try {
    const result = await deleteProductImage(req.params.id, req.params.imageId);
    res.json({ ok: true, message: 'Imagen eliminada correctamente', data: result.remaining });
  } catch (err) {
    console.error('[admin/product-images-delete] error:', err);
    res.status(500).json({ ok: false, message: 'Error al eliminar imagen' });
  }
});

router.put(
  '/:id/images/reorder',
  [
    param('id').isUUID(),
    body().custom((_, { req }) => {
      const list = req.body.order || req.body.ordered_image_ids || req.body.images;
      if (!Array.isArray(list)) {
        throw new Error('Debe proporcionar un array en order, ordered_image_ids o images');
      }
      return true;
    }),
  ],
  async (req, res) => {
    if (fail(req, res)) return;
    try {
      const orderList = req.body.order || req.body.ordered_image_ids || req.body.images;
      const updated = await reorderProductImages(req.params.id, orderList);
      res.json({ ok: true, message: 'Orden de imágenes actualizado', images: updated, data: updated });
    } catch (err) {
      console.error('[admin/product-images-reorder] error:', err);
      res.status(500).json({ ok: false, message: 'Error al reordenar imágenes' });
    }
  }
);

module.exports = router;

