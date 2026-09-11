'use strict';

const express = require('express');
const { param, body, validationResult } = require('express-validator');
const { query, withTransaction } = require('../db/postgres');
const { authenticate, requireAdmin } = require('../middleware/postgresAuth');

const router = express.Router();
router.use(authenticate, requireAdmin);

const BANNER_TYPES = ['oferta', 'combo'];
const DEFAULT_DURATION_DAYS = 7;
const MAX_ITEMS_PER_BANNER = 24;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const bannerRules = [
  body('title').isString().trim().isLength({ min: 1, max: 120 }).withMessage('El título es requerido.'),
  body('subtitle').optional({ nullable: true }).isString().isLength({ max: 280 }).withMessage('Subtítulo inválido.'),
  body('cta_text').optional({ nullable: true }).isString().isLength({ max: 60 }).withMessage('Texto del botón inválido.'),
  body('link').optional({ nullable: true }).isString().isLength({ max: 500 }).withMessage('Link inválido.'),
  body('image_url').optional({ nullable: true }).isString().isLength({ max: 1000 }).withMessage('URL de imagen inválida.'),
  body('active').optional().isBoolean().withMessage('Estado inválido.'),
  body('banner_type').optional().isIn(BANNER_TYPES).withMessage('El tipo debe ser OFERTA o COMBO.'),
  body('duration_days').optional({ nullable: true }).isFloat({ min: 0.02, max: 365 }).withMessage('Duración inválida.'),
  body('end_date').optional({ nullable: true }).custom((value) => !value || Number.isFinite(new Date(value).getTime())).withMessage('Fecha de vencimiento inválida.'),
  body('sort_order').optional().isInt().withMessage('Orden inválido.'),
  body('items').optional({ nullable: true }).isArray({ max: MAX_ITEMS_PER_BANNER }).withMessage(`Máximo ${MAX_ITEMS_PER_BANNER} productos por banner.`),
  body('items.*.product_id').isUUID().withMessage('Producto inválido.'),
  body('items.*.promo_price').isFloat({ min: 0 }).withMessage('El precio promocional debe ser un número mayor o igual a 0.'),
  body('items.*.sort_order').optional({ nullable: true }).isInt().withMessage('Orden del producto inválido.'),
];

function bad(req, res) {
  const errors = validationResult(req);
  return errors.isEmpty() ? null : res.status(400).json({ ok: false, message: errors.array()[0].msg });
}

// El countdown de la tienda usa end_date, por eso siempre debe quedar una fecha válida:
// si el admin no eligió fecha exacta, se calcula a partir de la duración en días.
function resolveEndDate(payload) {
  const explicit = payload.end_date ? new Date(payload.end_date) : null;
  if (explicit && Number.isFinite(explicit.getTime())) return explicit.toISOString();
  const days = Number(payload.duration_days);
  const span = Number.isFinite(days) && days > 0 ? days : DEFAULT_DURATION_DAYS;
  return new Date(Date.now() + span * DAY_IN_MS).toISOString();
}

function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems)) return null;
  const seen = new Set();
  const items = [];
  rawItems.forEach((item, index) => {
    const productId = item && String(item.product_id || '').trim();
    if (!productId || seen.has(productId)) return;
    seen.add(productId);
    items.push({
      product_id: productId,
      promo_price: Math.max(0, Number(item.promo_price) || 0),
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : index,
    });
  });
  return items;
}

async function replaceItems(client, bannerId, items) {
  await client.query('DELETE FROM promo_banner_items WHERE banner_id=$1', [bannerId]);
  for (const item of items) {
    await client.query(
      `INSERT INTO promo_banner_items(banner_id, product_id, promo_price, sort_order)
       VALUES($1,$2,$3,$4)
       ON CONFLICT (banner_id, product_id)
       DO UPDATE SET promo_price=EXCLUDED.promo_price, sort_order=EXCLUDED.sort_order`,
      [bannerId, item.product_id, item.promo_price, item.sort_order],
    );
  }
}

async function attachItems(executor, banners) {
  if (!banners.length) return banners;
  const result = await executor.query(
    `SELECT bi.id, bi.banner_id, bi.product_id, bi.promo_price, bi.sort_order,
            p.name, p.price AS list_price, p.image_url, p.sizes, p.stock, p.active
     FROM promo_banner_items bi
     JOIN products p ON p.id = bi.product_id
     WHERE bi.banner_id = ANY($1::uuid[])
     ORDER BY bi.sort_order, p.name`,
    [banners.map((banner) => banner.id)],
  );
  const grouped = new Map(banners.map((banner) => [banner.id, []]));
  result.rows.forEach((row) => {
    const list = grouped.get(row.banner_id);
    if (list) list.push(row);
  });
  return banners.map((banner) => ({ ...banner, items: grouped.get(banner.id) || [] }));
}

function bannerValues(payload) {
  return [
    payload.title.trim(),
    payload.subtitle || null,
    payload.cta_text || null,
    payload.link || null,
    payload.image_url || null,
    payload.active !== false,
    resolveEndDate(payload),
    Number(payload.sort_order) || 0,
    BANNER_TYPES.includes(payload.banner_type) ? payload.banner_type : 'oferta',
  ];
}

router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const result = await query('SELECT * FROM promo_banners ORDER BY sort_order,created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
  const total = await query('SELECT count(*)::int count FROM promo_banners');
  res.json({ ok: true, data: await attachItems({ query }, result.rows), count: total.rows[0].count });
});

router.get('/:id', [param('id').isUUID().withMessage('Banner inválido.')], async (req, res) => {
  if (bad(req, res)) return;
  const result = await query('SELECT * FROM promo_banners WHERE id=$1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Banner no encontrado' });
  const [banner] = await attachItems({ query }, result.rows);
  res.json({ ok: true, data: banner });
});

router.post('/', bannerRules, async (req, res) => {
  if (bad(req, res)) return;
  const items = normalizeItems(req.body.items) || [];
  const banner = await withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO promo_banners(title,subtitle,cta_text,link,image_url,active,end_date,sort_order,banner_type)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      bannerValues(req.body),
    );
    const created = result.rows[0];
    await replaceItems(client, created.id, items);
    const [withItems] = await attachItems(client, [created]);
    return withItems;
  });
  res.status(201).json({ ok: true, message: 'Banner creado correctamente', data: banner });
});

router.put('/:id', [param('id').isUUID().withMessage('Banner inválido.'), ...bannerRules], async (req, res) => {
  if (bad(req, res)) return;
  const items = normalizeItems(req.body.items);
  const banner = await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE promo_banners
       SET title=$1,subtitle=$2,cta_text=$3,link=$4,image_url=$5,active=$6,end_date=$7,sort_order=$8,banner_type=$9
       WHERE id=$10 RETURNING *`,
      [...bannerValues(req.body), req.params.id],
    );
    const updated = result.rows[0];
    if (!updated) return null;
    if (items) await replaceItems(client, updated.id, items);
    const [withItems] = await attachItems(client, [updated]);
    return withItems;
  });
  if (!banner) return res.status(404).json({ ok: false, message: 'Banner no encontrado' });
  res.json({ ok: true, message: 'Banner actualizado correctamente', data: banner });
});

router.delete('/:id', [param('id').isUUID().withMessage('Banner inválido.')], async (req, res) => {
  if (bad(req, res)) return;
  await query('DELETE FROM promo_banners WHERE id=$1', [req.params.id]);
  res.json({ ok: true, message: 'Banner eliminado correctamente' });
});

router.post('/:id/toggle-active', [param('id').isUUID().withMessage('Banner inválido.')], async (req, res) => {
  if (bad(req, res)) return;
  const result = await query('UPDATE promo_banners SET active=NOT active WHERE id=$1 RETURNING id,active,updated_at', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Banner no encontrado' });
  res.json({ ok: true, message: 'Estado actualizado', data: result.rows[0] });
});

module.exports = router;
