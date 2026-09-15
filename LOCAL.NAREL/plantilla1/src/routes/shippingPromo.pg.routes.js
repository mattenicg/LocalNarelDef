'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { query } = require('../db/postgres');
const { authenticate, requireAdmin } = require('../middleware/postgresAuth');

const promoFile = path.join(__dirname, '..', '..', 'data', 'shipping-promo.json');

const DEFAULT_CONFIG = {
  enabled: true,
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  minAmount: 40000,
  city: 'Santa Fe Capital',
  mainText: 'ENVÍOS GRATIS SOLO POR ESTA SEMANA, ¿QUÉ ESPERÁS? ¡ASÍ SE INAUGURA UNA WEB! ⚡',
  exclusiveLabel: 'EXCLUSIVA PARA SANTA FE CAPITAL',
  subText: 'Envíos por compras a partir de $40.000.',
  updatedAt: new Date().toISOString(),
};

function readFallbackFileSync() {
  try {
    if (fs.existsSync(promoFile)) {
      const raw = fs.readFileSync(promoFile, 'utf8');
      return Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw));
    }
  } catch (err) {
    console.warn('[shippingPromo] Error reading fallback file:', err.message);
  }
  return { ...DEFAULT_CONFIG };
}

function writeFallbackFileSync(cfg) {
  try {
    const dir = path.dirname(promoFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(promoFile, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err) {
    console.warn('[shippingPromo] Error writing fallback file:', err.message);
  }
}

async function getShippingPromoConfig() {
  try {
    const res = await query('SELECT value FROM store_settings WHERE key = $1', ['shipping_promo']);
    if (res && res.rows && res.rows.length > 0 && res.rows[0].value) {
      const dbVal = res.rows[0].value;
      const parsed = typeof dbVal === 'string' ? JSON.parse(dbVal) : dbVal;
      return Object.assign({}, DEFAULT_CONFIG, parsed);
    }
  } catch (err) {
    console.warn('[shippingPromo] Error querying store_settings:', err.message);
  }
  return readFallbackFileSync();
}

async function saveShippingPromoConfig(updates) {
  const current = await getShippingPromoConfig();
  const nextConfig = {
    enabled: typeof updates.enabled === 'boolean' ? updates.enabled : current.enabled,
    endDate: updates.endDate !== undefined ? (updates.endDate ? new Date(updates.endDate).toISOString() : null) : current.endDate,
    minAmount: typeof updates.minAmount === 'number' && !isNaN(updates.minAmount) ? Math.max(0, updates.minAmount) : current.minAmount,
    city: typeof updates.city === 'string' ? updates.city.trim() : current.city,
    mainText: typeof updates.mainText === 'string' && updates.mainText.trim() ? updates.mainText.trim() : current.mainText,
    exclusiveLabel: typeof updates.exclusiveLabel === 'string' && updates.exclusiveLabel.trim() ? updates.exclusiveLabel.trim() : current.exclusiveLabel,
    subText: typeof updates.subText === 'string' ? updates.subText.trim() : current.subText,
    updatedAt: new Date().toISOString(),
  };

  try {
    await query(
      `INSERT INTO store_settings (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      ['shipping_promo', JSON.stringify(nextConfig)]
    );
  } catch (err) {
    console.warn('[shippingPromo] Error writing to store_settings table:', err.message);
  }

  writeFallbackFileSync(nextConfig);
  return nextConfig;
}

// Router público (para storefront)
const publicRouter = express.Router();
publicRouter.get('/public', async (_req, res) => {
  try {
    const config = await getShippingPromoConfig();
    return res.status(200).json({ ok: true, data: config });
  } catch (err) {
    console.error('[shippingPromo-public] Error:', err);
    return res.status(500).json({ ok: false, message: 'Error al obtener configuración de promoción' });
  }
});

// Router admin (requiere login y rol admin)
const adminRouter = express.Router();
adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/', async (_req, res) => {
  try {
    const config = await getShippingPromoConfig();
    return res.status(200).json({ ok: true, data: config });
  } catch (err) {
    console.error('[shippingPromo-admin-get] Error:', err);
    return res.status(500).json({ ok: false, message: 'Error al obtener configuración' });
  }
});

const handleSave = async (req, res) => {
  try {
    const updates = req.body || {};
    if (updates.endDate && isNaN(new Date(updates.endDate).getTime())) {
      return res.status(400).json({ ok: false, message: 'Fecha de finalización inválida' });
    }
    const updated = await saveShippingPromoConfig(updates);
    return res.status(200).json({
      ok: true,
      message: 'Configuración de promoción guardada con éxito',
      data: updated,
    });
  } catch (err) {
    console.error('[shippingPromo-admin-save] Error:', err);
    return res.status(500).json({ ok: false, message: 'Error al guardar la configuración' });
  }
};

adminRouter.put('/', handleSave);
adminRouter.post('/', handleSave);

module.exports = {
  shippingPromoPublicRoutes: publicRouter,
  shippingPromoAdminRoutes: adminRouter,
  getShippingPromoConfig,
  readFallbackFileSync,
};
