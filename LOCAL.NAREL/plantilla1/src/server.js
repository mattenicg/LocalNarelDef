require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss-clean');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const { PORT, ORIGIN_PERMITIDO, NODE_ENV } = require('./config');
const logger = require('./utils/logger');
const { limiterGeneral } = require('./middleware/rateLimit');

const { initPostgres, query } = require('./db/postgres');
// SQLite y sus rutas legacy quedan deshabilitadas.
const LEGACY_SQLITE_ENABLED = String(process.env.LEGACY_SQLITE_ENABLED || 'false').toLowerCase() === 'true';
let initDB = Promise.resolve();
let fetchOne = () => null;
let publicRoutes = null;
let iaRoutes = null;
let adminRoutes = null;
if (LEGACY_SQLITE_ENABLED) {
  ({ initDB, fetchOne } = require('./db'));
  publicRoutes = require('./routes/public.routes');
  iaRoutes = require('./routes/ia.routes');
  adminRoutes = require('./routes/admin.routes');
}

// ============================================================
// NUEVAS RUTAS SUPABASE (auth + admin products + storage)
// ============================================================
const supabaseAuthRoutes = require('./routes/auth.pg.routes');
const supabaseCategoriesRoutes = require('./routes/categories.pg.routes');
const supabaseProductsRoutes = require('./routes/products.pg.routes');
const supabaseBannersRoutes = require('./routes/banners.pg.routes');
const supabasePromotionsRoutes = require('./routes/promotions.pg.routes');
const supabaseStorageRoutes = require('./routes/storage.pg.routes');
const { publicRouter: supabaseOrdersPublicRoutes, adminRouter: supabaseOrdersAdminRoutes } = require('./routes/orders.pg.routes');
const paymentsRoutes = require('./routes/payments.pg.routes');
const {
  shippingPromoPublicRoutes,
  shippingPromoAdminRoutes,
  getShippingPromoConfig,
} = require('./routes/shippingPromo.pg.routes');
const shippingRoutes = require('./routes/shipping.pg.routes');
const notificationsAdminRoutes = require('./routes/notifications.pg.routes');
const env = require('./config/env');

const app = express();

app.set('trust proxy', 1);
app.use(cookieParser());

let dbIsReady = false;
const dbReady = initPostgres().then(() => { dbIsReady = true; }).catch((err) => { logger.error('PostgreSQL no disponible:', err.message); throw err; });
app.use(async (_req, _res, next) => { try { await dbReady; next(); } catch (err) { next(err); } });

app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  })
);

const allowedOrigins = String(ORIGIN_PERMITIDO || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes('*') ||
        NODE_ENV !== 'production' ||
        origin.includes('.run.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.includes('ai.studio') ||
        origin.includes('google.com')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(xss());

app.use(
  morgan(NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: {
      write: (mensaje) => logger.info(mensaje.trim())
    }
  })
);

// Límite general para APIs; los formularios sensibles tienen límites específicos.
app.use('/api', limiterGeneral);

const publicDir = path.join(__dirname, '..', 'public');
app.use('/assets', express.static(path.join(publicDir, 'assets')));
app.use('/admin/assets', express.static(path.join(publicDir, 'admin', 'assets')));
try {
  if (!fs.existsSync(env.UPLOADS_DIR)) {
    fs.mkdirSync(env.UPLOADS_DIR, { recursive: true });
  }
} catch (_) {}
app.use('/uploads', express.static(env.UPLOADS_DIR));
app.use(express.static(publicDir, { index: false, extensions: ['html', 'htm'] }));

if (LEGACY_SQLITE_ENABLED) {
  app.use('/api/public', publicRoutes);
  app.use('/api/ia', iaRoutes);
}

// ============================================================
// ENDPOINTS SUPABASE - NUEVO (IMPORTANTE:
//   Deben estar ANTES que app.use('/api/admin', adminRoutes) LEGACY
//   para que /api/admin/products NO sea capturado por el legacy middleware
//   authAdmin (bearer token SQLite) y sí por el authenticate cookie Supabase.
// ============================================================
// Config Pública (solo URL y anon key; NUNCA service role)
app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'narel-local', time: new Date().toISOString() });
});

app.get('/api/config/public', (req, res) => {
  res.status(200).json({
    ok: true,
    POSTGRES_ENABLED: true,
    PAYMENT_PROVIDER: env.PAYMENT_PROVIDER || 'manual',
    MERCADO_PAGO_ENABLED: ['mercadopago', 'mercado_pago'].includes(String(env.PAYMENT_PROVIDER || '').toLowerCase()) && Boolean(env.MERCADO_PAGO_PUBLIC_KEY && env.MERCADO_PAGO_ACCESS_TOKEN),
    MERCADO_PAGO_PUBLIC_KEY: env.MERCADO_PAGO_PUBLIC_KEY || '',
    MERCADO_PAGO_LOCALE: env.MERCADO_PAGO_LOCALE || 'es-AR',
    NARANJA_X_ENABLED: Boolean(env.NARANJA_X_API_URL && env.NARANJA_X_CLIENT_ID && env.NARANJA_X_CLIENT_SECRET),
    ORDER_WHATSAPP_NUMBER: env.ORDER_WHATSAPP_NUMBER || '',
    ORDER_PAYMENT_ALIAS: env.ORDER_PAYMENT_ALIAS || '',
    ORDER_PAYMENT_CBU: env.ORDER_PAYMENT_CBU || '',
    ORDER_PICKUP_ADDRESS: env.ORDER_PICKUP_ADDRESS || '',
    ORDER_SHIPPING_NOTE: env.ORDER_SHIPPING_NOTE || '',
  });
});

// ================= PRODUCTS PÚBLICO (tienda - sin login) =================
app.get('/api/products/public', async (req, res) => {
  try {
    const category = typeof req.query.category === 'string' && req.query.category.trim() ? req.query.category.trim().toLowerCase() : null;
    const subcategory = typeof req.query.subcategory === 'string' && req.query.subcategory.trim() ? req.query.subcategory.trim().toLowerCase() : null;
    const limit = Math.min(Number(req.query.limit) || 100, 200);

    const params = [];
    let conditions = 'WHERE active=true';

    if (category) {
      params.push(category);
      conditions += ` AND category=$${params.length}`;
    }

    if (subcategory) {
      params.push(subcategory);
      conditions += ` AND (subcategory=$${params.length} OR subcategory_id::text=$${params.length})`;
    }

    params.push(limit);
    const querySql = `SELECT id,name,description,price,sizes,size_guide,stock,image_url,images,category,subcategory,subcategory_id,active,featured,direct_purchase,allowed_payment_methods,allowed_installments,direct_discount_percent,direct_discount_text,direct_show_promo_badge,direct_promo_badge_text,direct_installments_count,direct_installments_text,direct_custom_transfer_price,direct_transfer_text,created_at,updated_at FROM products ${conditions} ORDER BY featured DESC,updated_at DESC LIMIT $${params.length}`;

    const result = await query(querySql, params);

    const productIds = result.rows.map((r) => r.id);
    const imagesByProduct = new Map();
    if (productIds.length > 0) {
      try {
        const imgRes = await query(
          'SELECT id, product_id, image_url, storage_path, alt_text, position FROM product_images WHERE product_id = ANY($1) ORDER BY position ASC, created_at ASC',
          [productIds]
        );
        (imgRes.rows || []).forEach((img) => {
          if (!imagesByProduct.has(img.product_id)) {
            imagesByProduct.set(img.product_id, []);
          }
          imagesByProduct.get(img.product_id).push(img);
        });
      } catch (imgErr) {
        console.warn('[products-public] fallback imágenes:', imgErr.message);
      }
    }

    const mapped = result.rows.map((p) => {
      const dedicatedImages = imagesByProduct.get(p.id) || [];
      let imagesList = [];
      if (dedicatedImages.length > 0) {
        imagesList = dedicatedImages.map((img) => img.image_url).filter(Boolean);
      } else if (Array.isArray(p.images)) {
        imagesList = p.images.filter(Boolean);
      } else if (typeof p.images === 'string' && p.images.startsWith('[')) {
        try { imagesList = JSON.parse(p.images).filter(Boolean); } catch (_) {}
      } else if (p.images && typeof p.images === 'string') {
        imagesList = [p.images];
      }
      if (p.image_url && !imagesList.includes(p.image_url)) {
        imagesList.unshift(p.image_url);
      }
      const mainImageUrl = imagesList[0] || p.image_url || null;

      return {
        ...p,
        image_url: mainImageUrl,
        images: imagesList,
        product_images: dedicatedImages,
        direct_purchase: Boolean(p.direct_purchase),
        allowed_payment_methods: typeof p.allowed_payment_methods === 'string'
          ? JSON.parse(p.allowed_payment_methods)
          : (p.allowed_payment_methods || ['tarjeta_credito', 'tarjeta_debito', 'transferencia', 'efectivo']),
        allowed_installments: typeof p.allowed_installments === 'string'
          ? JSON.parse(p.allowed_installments)
          : (p.allowed_installments || [1, 3, 6]),
        direct_discount_percent: p.direct_discount_percent !== undefined && p.direct_discount_percent !== null ? Number(p.direct_discount_percent) : 25,
        direct_discount_text: p.direct_discount_text || 'con transferencia',
        direct_show_promo_badge: p.direct_show_promo_badge !== false,
        direct_promo_badge_text: p.direct_promo_badge_text || 'PROMO ACTIVA',
        direct_installments_count: Number(p.direct_installments_count) || 6,
        direct_installments_text: p.direct_installments_text || 'sin interés',
        direct_custom_transfer_price: p.direct_custom_transfer_price ? Number(p.direct_custom_transfer_price) : null,
        direct_transfer_text: p.direct_transfer_text || 'con Transferencia',
        category: String(p.category || guessCategoryFallback(p.name, p.description) || 'remeras').toLowerCase(),
        subcategory: p.subcategory ? String(p.subcategory).toLowerCase() : null,
      };
    });

    return res.status(200).json({ ok: true, count: mapped.length, data: mapped });
  } catch (err) {
    console.error('[products-public] error:', err.message || err);
    return res.status(500).json({ ok: false, message: 'Error al listar productos' });
  }
});

// ================= CATEGORIAS PÚBLICO (tienda - sin login) =================
async function getCategoriesHierarchy() {
  const catsRes = await query('SELECT id, name, slug, sort_order, COALESCE(subtitle, \'CARGADO DESDE PANEL ADMIN\') AS subtitle FROM categories ORDER BY sort_order ASC, name ASC');
  const subcatsRes = await query('SELECT id, category_id, category_slug, name, slug FROM subcategories ORDER BY name ASC');

  const subcatsByCat = new Map();
  catsRes.rows.forEach((c) => subcatsByCat.set(c.slug, []));
  subcatsRes.rows.forEach((s) => {
    const list = subcatsByCat.get(s.category_slug);
    if (list) list.push(s);
  });

  return catsRes.rows.map((c) => ({
    ...c,
    subtitle: c.subtitle || 'CARGADO DESDE PANEL ADMIN',
    subcategories: subcatsByCat.get(c.slug) || [],
  }));
}

app.get(['/api/categories/public', '/api/products/categories'], async (_req, res) => {
  try {
    const data = await getCategoriesHierarchy();
    return res.status(200).json({ ok: true, count: data.length, data });
  } catch (err) {
    console.error('[categories] error:', err.message || err);
    return res.status(500).json({ ok: false, message: 'Error al listar categorías' });
  }
});

// ================= BANNERS PÚBLICO (tienda - sin login) =================
app.get('/api/banners/public', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const result = await query('SELECT id,title,subtitle,short_description,description,terms_and_conditions,discount_type,discount_value,badge_label,badge_color,cta_text,link,image_url,banner_type,active,start_date,end_date,sort_order,featured,created_at FROM promo_banners WHERE active=true AND (end_date IS NULL OR end_date>now()) ORDER BY sort_order,created_at DESC LIMIT $1',[limit]);
    const banners = result.rows;
    if (banners.length) {
      const items = await query(
        `SELECT bi.banner_id, bi.product_id, bi.promo_price, bi.sort_order,
                p.name, p.price AS list_price, p.image_url, p.sizes, p.stock, p.category
         FROM promo_banner_items bi
         JOIN products p ON p.id = bi.product_id
         WHERE bi.banner_id = ANY($1::uuid[]) AND p.active=true
         ORDER BY bi.sort_order, p.name`,
        [banners.map((banner) => banner.id)],
      );
      const grouped = new Map(banners.map((banner) => [banner.id, []]));
      items.rows.forEach((row) => {
        const list = grouped.get(row.banner_id);
        if (list) list.push(row);
      });
      banners.forEach((banner) => { banner.items = grouped.get(banner.id) || []; });
    }
    return res.status(200).json({ ok: true, count: banners.length, data: banners });
  } catch (err) {
    console.error('[banners-public] error:', err.message || err);
    return res.status(500).json({ ok: false, message: 'Error al listar banners' });
  }
});

// ================= PROMOCIONES PÚBLICO (tienda - sin login) =================
app.get('/api/promotions/public', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const featuredOnly = req.query.featured === '1';
    const withProducts = req.query.include_products !== '0';
    const result = await query(`SELECT * FROM promotions WHERE active=true AND start_date<=now() AND (end_date IS NULL OR end_date>now()) ${featuredOnly?'AND featured=true':''} ORDER BY featured DESC,sort_order,end_date NULLS LAST LIMIT $1`,[limit]);
    for (const promo of result.rows) { const items=await query(`SELECT pp.*,p.id AS product_id,p.name,p.price,p.image_url,p.category,p.stock,p.sizes,p.active FROM promotion_products pp JOIN products p ON p.id=pp.product_id WHERE pp.promotion_id=$1 AND pp.active=true`,[promo.id]); promo.promotion_products=withProducts?items.rows:[]; }
    return res.status(200).json({ ok: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('[promotions-public] error:', err.message || err);
    return res.status(500).json({ ok: false, message: 'Error al listar promociones' });
  }
});

function guessCategoryFallback(name, description){
  const haystack = (String(name || '') + ' ' + String(description || '')).toLowerCase();
  if (/(pantalon|jogger|baggy|cargo|wide|chino|bermuda|short)/i.test(haystack)) return 'pantalones';
  if (/(campera|chaqueta|parka|camperita|puffer|rompeviento)/i.test(haystack)) return 'camperas';
  if (/(buzo|hoodie|sudadera|canguro|crewneck)/i.test(haystack)) return 'buzos';
  if (/(remera|tee|t-shirt|playera|musculosa|top)/i.test(haystack)) return 'remeras';
  if (/(accesorio|gorra|cap|bufanda|cinturon|media|medias|mochila|llavero|piluso|cadena|collar|anillo|reloj|riñonera|bolso|beanie)/i.test(haystack)) return 'accesorios';
  const m = /\[CAT:\s*([a-z_]+)\]/i.exec(String(description || ''));
  if (m) return m[1].toLowerCase();
  return 'remeras';
}
// Auth
app.use('/api/auth', supabaseAuthRoutes);
// Categories / Sections (admin) - CRUD
app.use('/api/admin/categories', supabaseCategoriesRoutes);
// Banners (admin) - CRUD
app.use('/api/admin/banners', supabaseBannersRoutes);
// Promotions (admin) - CRUD + productos
app.use('/api/admin/promotions', supabasePromotionsRoutes);
// Checkout público y pagos; los pagos se registran después del checkout manual.
app.use('/api/orders', supabaseOrdersPublicRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/admin/orders', supabaseOrdersAdminRoutes);
// upload imagen y delete imagen producto
app.use('/api/admin/products', supabaseStorageRoutes);
// Products (admin) - CRUD
app.use('/api/admin/products', supabaseProductsRoutes);
// Promoción de envíos gratis y contador (público y admin)
app.use('/api/shipping-promo', shippingPromoPublicRoutes);
app.use('/api/admin/shipping-promo', shippingPromoAdminRoutes);
// Cálculo de costos de envío con Correo Argentino
app.use('/api/shipping', shippingRoutes);
// Notificaciones de pedidos (admin)
app.use('/api/admin/notifications', notificationsAdminRoutes);

// LEGACY routes (SQLite). Se mantienen opt-in para no cargar la dependencia antigua
// ni interceptar rutas Supabase en el despliegue actual.
if (LEGACY_SQLITE_ENABLED) {
  app.use('/api/admin', adminRoutes);
}

app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: 'Endpoint no encontrado', path: req.originalUrl });
});

function extraerTenantSlug(req) {
  const partes = req.path.split('/').filter(Boolean);
  if (partes.length >= 1) {
    const candidato = partes[0];
    if (candidato && candidato !== 'admin' && !candidato.includes('.')) {
      return candidato;
    }
  }
  return null;
}

function inyectarMetaIndex(html, tenant, config) {
  if (!html) return html;
  const titulo = config?.meta_title || tenant?.nombre || 'Sitio Web';
  const descripcion = config?.meta_description || '';
  const ogImage = config?.og_image_url || '';
  const colorPrincipal = config?.color_principal || '#2563eb';
  const favicon = config?.favicon_url || '/assets/img/favicon.ico';
  const logo = config?.logo_url || '';
  const redes = config?.redes || {};
  const horarios = config?.horarios || [];
  const direccion = config?.direccion || '';
  const whatsapp = tenant?.whatsapp || '';
  const email = tenant?.email_contacto || '';

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(titulo)}</title>`)
    .replace(
      /(<meta[^>]*name=["']description["'][^>]*>)/gi,
      ''
    )
    .replace(
      /(<meta[^>]*property=["']og:title["'][^>]*>)/gi,
      ''
    )
    .replace(
      /(<meta[^>]*property=["']og:description["'][^>]*>)/gi,
      ''
    )
    .replace(
      /(<meta[^>]*property=["']og:image["'][^>]*>)/gi,
      ''
    )
    .replace(
      /(<meta[^>]*name=["']theme-color["'][^>]*>)/gi,
      ''
    )
    .replace(
      /(<link[^>]*rel=["']icon["'][^>]*>)/gi,
      ''
    )
    .replace(
      '</head>',
      `<meta name="description" content="${escapeHtml(descripcion)}">
<meta property="og:title" content="${escapeHtml(titulo)}">
<meta property="og:description" content="${escapeHtml(descripcion)}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta name="theme-color" content="${escapeHtml(colorPrincipal)}">
<link rel="icon" href="${escapeHtml(favicon)}">
<script>
window.__TENANT__ = ${JSON.stringify({
  slug: tenant?.slug || '',
  nombre: tenant?.nombre || '',
  dominio: tenant?.dominio || '',
  whatsapp,
  email_contacto: email,
  config: {
    color_principal: config?.color_principal || '',
    color_secundario: config?.color_secundario || '',
    color_acento: config?.color_acento || '',
    logo_url: logo,
    meta_title: titulo,
    meta_description: descripcion,
    og_image_url: ogImage,
    horarios,
    direccion,
    ubicacion_url: config?.ubicacion_url || '',
    redes
  }
})};
</script>
</head>`
    );
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// fetchOne ya importado al principio del archivo junto con initDB. No re-declarar.

const storefrontFile = path.join(__dirname, '..', 'plantilla 1.html');
async function servirTienda(_req, res) {
  if (!fs.existsSync(storefrontFile)) {
    return res.status(404).send('Tienda no disponible');
  }
  try {
    const promoConfig = await getShippingPromoConfig();
    let html = fs.readFileSync(storefrontFile, 'utf8');



    const safeConfig = JSON.stringify(promoConfig).replace(/<\/script/gi, '<\\/script');
    const injection = `<script id="__promo_config_injected">window.__SHIPPING_PROMO_CONFIG__ = ${safeConfig};</script>`;
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${injection}\n</head>`);
    } else {
      html = injection + html;
    }
    return res.type('html').send(html);
  } catch (err) {
    logger.warn(`[servirTienda] Error injecting promo config: ${err.message}`);
    return res.sendFile(storefrontFile);
  }
}

app.get('/', servirTienda);
app.get('/index.html', servirTienda);
app.get('/plantilla 1.html', servirTienda);
app.get('/plantilla-1.html', (_req, res) => res.redirect(301, '/'));

app.get('/admin*', (req, res) => {
  // 1) Si pide /admin/dashboard.html, /admin/products.html, etc.: servir desde public/admin/<archivo>
  const urlPath = req.path.replace(/^\/admin\/?/, '');
  const safePath = urlPath.split('/').filter(Boolean).join(path.sep) || '';
  let candidateFile;
  if (safePath && !safePath.includes('..')) {
    candidateFile = path.join(publicDir, 'admin', safePath);
    if (fs.existsSync(candidateFile) && fs.statSync(candidateFile).isFile()) {
      return res.sendFile(candidateFile);
    }
  }
  // 2) Si no encontró: servir dashboard.html (nuevo admin Supabase) o bien index.html legacy
  const newDashboard = path.join(publicDir, 'admin', 'dashboard.html');
  if (fs.existsSync(newDashboard)) return res.sendFile(newDashboard);
  const oldIndex = path.join(publicDir, 'admin', 'index.html');
  if (fs.existsSync(oldIndex)) return res.sendFile(oldIndex);
  return res.status(404).send('Admin no disponible');
});

// ================= CATEGORÍAS Y SUBCATEGORÍAS DINÁMICAS (Storefront) =================
const DEFAULT_CATEGORIES_MAP = {
  pantalones: 'Pantalones',
  camperas: 'Camperas',
  buzos: 'Buzos',
  remeras: 'Remeras',
  accesorios: 'Accesorios',
};

async function servirCategoriaOTienda(req, res, next) {
  let categoryParam = (req.params.category || '').toLowerCase().trim();
  let subcategoryParam = (req.params.subcategory || '').toLowerCase().trim();

  if (categoryParam.endsWith('.html')) {
    categoryParam = categoryParam.slice(0, -5);
  }
  if (subcategoryParam.endsWith('.html')) {
    subcategoryParam = subcategoryParam.slice(0, -5);
  }

  // Evitar interceptar archivos con extensión o rutas reservadas
  if (
    !categoryParam ||
    categoryParam.includes('.') ||
    ['api', 'admin', 'assets', 'components', 'dashboard', 'login', 'register', 'forgot-password', 'reset-password'].includes(categoryParam)
  ) {
    return next();
  }

  try {
    let cat = null;
    try {
      const catRes = await query('SELECT id, name, slug, COALESCE(subtitle, \'CARGADO DESDE PANEL ADMIN\') AS subtitle FROM categories WHERE slug = $1', [categoryParam]);
      if (catRes && catRes.rows && catRes.rows[0]) {
        cat = catRes.rows[0];
      }
    } catch (_dbErr) {
      // Ignorar error de DB si está en fallback
    }

    if (!cat) {
      if (DEFAULT_CATEGORIES_MAP[categoryParam]) {
        cat = { id: 0, slug: categoryParam, name: DEFAULT_CATEGORIES_MAP[categoryParam], subtitle: 'CARGADO DESDE PANEL ADMIN' };
      } else {
        return next();
      }
    }

    let sub = null;
    if (subcategoryParam) {
      if (subcategoryParam.includes('.')) return next();
      try {
        const subRes = await query('SELECT id, name, slug FROM subcategories WHERE category_slug = $1 AND slug = $2', [cat.slug, subcategoryParam]);
        if (subRes && subRes.rows && subRes.rows[0]) {
          sub = subRes.rows[0];
        }
      } catch (_dbErr) {}

      if (!sub) {
        sub = { id: 0, slug: subcategoryParam, name: subcategoryParam.charAt(0).toUpperCase() + subcategoryParam.slice(1) };
      }
    }

    if (!fs.existsSync(storefrontFile)) {
      return res.status(404).send('Tienda no disponible');
    }

    const promoConfig = await getShippingPromoConfig();
    let html = fs.readFileSync(storefrontFile, 'utf8');
    const safeConfig = JSON.stringify(promoConfig).replace(/<\/script/gi, '<\\/script');
    const routeState = JSON.stringify({
      category: cat.slug,
      categoryName: cat.name,
      categorySubtitle: cat.subtitle || 'CARGADO DESDE PANEL ADMIN',
      subcategory: sub ? sub.slug : null,
      subcategoryName: sub ? sub.name : null,
    }).replace(/<\/script/gi, '<\\/script');

    const pageTitle = sub
      ? `${cat.name.toUpperCase()} · ${sub.name.toUpperCase()} | NAREL LOCAL`
      : `${cat.name.toUpperCase()} | NAREL LOCAL`;

    html = html.replace(/<title>.*?<\/title>/i, `<title>${pageTitle}</title>`);

    // Inyectar clase en body para que el renderizado de la sección sea instantáneo sin parpadeos
    if (/<body[^>]*class=["']/i.test(html)) {
      html = html.replace(/<body([^>]*)class=["']([^"']*)["']/i, `<body$1class="$2 is-category-page is-cat-${cat.slug}" data-category="${cat.slug}" data-subcategory="${sub ? sub.slug : ''}"`);
    } else {
      html = html.replace(/<body([^>]*)>/i, `<body$1 class="is-category-page is-cat-${cat.slug}" data-category="${cat.slug}" data-subcategory="${sub ? sub.slug : ''}">`);
    }

    const categoryPageCss = `
    <style id="__category_page_css">
      body.is-category-page #inicio,
      body.is-category-page #shippingPromoBanner,
      body.is-category-page .categories,
      body.is-category-page #secciones-grid {
        display: none !important;
      }
      body.is-category-page .catalog-section:not(#${cat.slug}) {
        display: none !important;
      }
      body.is-category-page #${cat.slug} {
        display: block !important;
      }
      body.is-category-page #como-comprar,
      body.is-category-page #politicas-cambio {
        display: block !important;
      }
      body.is-category-page #como-comprar .scroll-reveal,
      body.is-category-page #politicas-cambio .scroll-reveal {
        opacity: 1 !important;
        transform: none !important;
        transition: none !important;
      }
      body.is-category-page #${cat.slug} .section-label {
        display: none !important;
      }
    </style>`;

    const injection = `
    ${categoryPageCss}
    <script id="__promo_config_injected">window.__SHIPPING_PROMO_CONFIG__ = ${safeConfig};</script>
    <script id="__route_state_injected">window.__DYNAMIC_ROUTE__ = ${routeState};</script>`;

    if (html.includes('</head>')) {
      html = html.replace('</head>', `${injection}\n</head>`);
    } else {
      html = injection + html;
    }

    return res.type('html').send(html);
  } catch (err) {
    logger.error('[servirCategoriaOTienda] error:', err);
    return next();
  }
}

app.get('/:category.html', servirCategoriaOTienda);
app.get('/:category/:subcategory.html', servirCategoriaOTienda);
app.get('/:category', servirCategoriaOTienda);
app.get('/:category/:subcategory', servirCategoriaOTienda);

function servirFrontendTenant(req, res) {
  try {
    const slug = req.params.tenant;
    let tenant = null;
    let config = null;
    if (slug && !slug.includes('.')) {
      tenant = fetchOne('SELECT * FROM tenants WHERE slug = ?', [slug]);
      if (tenant) {
        const row = fetchOne('SELECT json FROM tenant_config WHERE tenant_id = ?', [tenant.id]);
        config = row ? JSON.parse(row.json || '{}') : {};
      }
    }
    if (!tenant) {
      return res.status(404).send('Cliente no encontrado');
    }
    if (!fs.existsSync(storefrontFile)) {
      return res.status(404).send('Tienda no disponible');
    }
    let html = fs.readFileSync(storefrontFile, 'utf8');
    html = inyectarMetaIndex(html, tenant, config);
    res.type('html').send(html);
  } catch (err) {
    logger.error('Frontend render error:', err);
    res.status(500).send('Error interno al cargar el sitio');
  }
}

app.get('/:tenant', (req, res, next) => {
  if (!req.params.tenant || req.params.tenant.includes('.')) return next();
  return servirFrontendTenant(req, res);
});
app.get('/:tenant/*', (req, res, next) => {
  if (!req.params.tenant || req.params.tenant.includes('.')) return next();
  return servirFrontendTenant(req, res);
});

app.use((err, req, res, _next) => {
  logger.error('Unhandled error:', err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({
    ok: false,
    error: NODE_ENV === 'production' ? 'Error interno del servidor' : (err.message || 'Error interno')
  });
});

async function startServer() {
  await dbReady;
  const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT} - Entorno: ${NODE_ENV}`);
  console.log('===========================================================');
  console.log(`🛍️  TIENDA:                  http://localhost:${PORT}/`);
  console.log(`👤 REGISTRO:                http://localhost:${PORT}/register.html`);
  console.log(`🔑 LOGIN:                   http://localhost:${PORT}/login.html`);
  console.log(`🏠 DASHBOARD USUARIO:       http://localhost:${PORT}/dashboard.html`);
  console.log(`👕 PANEL ADMIN PRODUCTOS:   http://localhost:${PORT}/admin/products.html`);
  console.log(`🔥 PANEL ADMIN PROMOCIONES: http://localhost:${PORT}/admin/promos.html`);
  console.log(`🔧 CONFIG PUBLIC API:       http://localhost:${PORT}/api/config/public`);
  console.log(`🎁 PROMOS PUBLIC API:       http://localhost:${PORT}/api/promotions/public`);
  console.log('===========================================================');
  logger.info(`🚀 Servidor iniciado en puerto ${PORT} - Entorno: ${NODE_ENV}`);
  logger.info(`🛡️  PostgreSQL Auth:           http://0.0.0.0:${PORT}/api/auth/login`);
  logger.info(`👕 Admin Panel Productos:     http://localhost:${PORT}/admin/products.html`);
  logger.info(`🔥 Admin Panel Promociones:   http://localhost:${PORT}/admin/promos.html`);
  logger.info(`🛍️  Tienda Plantilla Narel:   http://localhost:${PORT}/`);
  logger.info('===========================================================');
  });
  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.error('No se pudo iniciar el servidor:', error);
    process.exit(1);
  });
}

module.exports = app;
module.exports.startServer = startServer;
