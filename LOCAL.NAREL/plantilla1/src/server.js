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
const supabaseProductsRoutes = require('./routes/products.pg.routes');
const supabaseBannersRoutes = require('./routes/banners.pg.routes');
const supabasePromotionsRoutes = require('./routes/promotions.pg.routes');
const supabaseStorageRoutes = require('./routes/storage.pg.routes');
const { publicRouter: supabaseOrdersPublicRoutes, adminRouter: supabaseOrdersAdminRoutes } = require('./routes/orders.pg.routes');
const paymentsRoutes = require('./routes/payments.pg.routes');
const env = require('./config/env');

const app = express();

app.set('trust proxy', 1);
app.use(cookieParser());

let dbIsReady = false;
const dbReady = initPostgres().then(() => { dbIsReady = true; }).catch((err) => { logger.error('PostgreSQL no disponible:', err.message); throw err; });
app.use(async (_req, _res, next) => { try { await dbReady; next(); } catch (err) { next(err); } });

app.use(
  helmet({
    // La tienda y el admin usan JS inline; CSP estricto las deja en blanco.
    contentSecurityPolicy: false
  })
);

const allowedOrigins = String(ORIGIN_PERMITIDO || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || (NODE_ENV !== 'production' && allowedOrigins.includes('*'))) {
        return callback(null, true);
      }
      const error = new Error('Origen no permitido por CORS');
      error.status = 403;
      return callback(error);
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
app.use('/uploads', express.static(env.UPLOADS_DIR));
app.use(express.static(publicDir, { index: false }));

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
    const category = typeof req.query.category === 'string' ? req.query.category : null;
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const params = category ? [String(category).toLowerCase(), limit] : [limit];
    const condition = category ? 'AND category=$1' : '';
    const result = await query(`SELECT id,name,description,price,sizes,stock,image_url,category,active,featured,created_at,updated_at FROM products WHERE active=true ${condition} ORDER BY featured DESC,updated_at DESC LIMIT $${category ? 2 : 1}`, params);
    const mapped = result.rows.map(p => ({
      ...p,
      category: String(p.category || guessCategoryFallback(p.name, p.description) || 'remeras').toLowerCase()
    }));

    return res.status(200).json({ ok: true, count: mapped.length, data: mapped });
  } catch (err) {
    console.error('[products-public] error:', err.message || err);
    return res.status(500).json({ ok: false, message: 'Error al listar productos' });
  }
});

// ================= BANNERS PÚBLICO (tienda - sin login) =================
app.get('/api/banners/public', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const result = await query('SELECT id,title,subtitle,cta_text,link,image_url,banner_type,active,end_date,sort_order,created_at FROM promo_banners WHERE active=true AND (end_date IS NULL OR end_date>now()) ORDER BY sort_order,created_at DESC LIMIT $1',[limit]);
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
  if (/(pantalon|jogger|baggy|cargo|wide|chino)/i.test(haystack)) return 'pantalones';
  if (/(campera|chaqueta|parka|camperita)/i.test(haystack)) return 'camperas';
  if (/(buzo|hoodie|sudadera|canguro)/i.test(haystack)) return 'buzos';
  if (/(remera|tee|t-shirt|playera|musculosa)/i.test(haystack)) return 'remeras';
  if (/(accesorio|gorra|cap|bufanda|cinturon|media|medias|mochila|llavero)/i.test(haystack)) return 'accesorios';
  const m = /\[CAT:\s*([a-z_]+)\]/i.exec(String(description || ''));
  if (m) return m[1].toLowerCase();
  return 'remeras';
}
// Auth
app.use('/api/auth', supabaseAuthRoutes);
// Products (admin) - CRUD + imagen
app.use('/api/admin/products', supabaseProductsRoutes);
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
function servirTienda(_req, res) {
  if (!fs.existsSync(storefrontFile)) {
    return res.status(404).send('Tienda no disponible');
  }
  return res.sendFile(storefrontFile);
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
