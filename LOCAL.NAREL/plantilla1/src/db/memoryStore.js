'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

let initialized = false;

const data = {
  profiles: [],
  user_sessions: [],
  categories: [],
  subcategories: [],
  products: [],
  product_images: [],
  promo_banners: [],
  promo_banner_items: [],
  promotions: [],
  promotion_products: [],
  orders: [],
  order_items: [],
  stock_movements: [],
  store_settings: {},
  notification_logs: [],
  orderSequence: 1,
};

function uuid() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function nowIso() {
  return new Date().toISOString();
}

const dbStoreFile = path.join(__dirname, '..', '..', 'data', 'memory-store.json');

function saveMemoryDbToFile() {
  try {
    const dir = path.dirname(dbStoreFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = {
      products: data.products,
      product_images: data.product_images,
      categories: data.categories,
      subcategories: data.subcategories,
      promotions: data.promotions,
      promotion_products: data.promotion_products,
      promo_banners: data.promo_banners,
      promo_banner_items: data.promo_banner_items,
      orders: data.orders,
      order_items: data.order_items,
      profiles: data.profiles,
      orderSequence: data.orderSequence,
    };
    fs.writeFileSync(dbStoreFile, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.error('[memoryStore] Error al guardar memoria a disco:', err.message);
  }
}

function loadMemoryDbFromFile() {
  if (!fs.existsSync(dbStoreFile)) return false;
  try {
    const content = fs.readFileSync(dbStoreFile, 'utf8');
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.products) && parsed.products.length > 0) data.products = parsed.products;
      if (Array.isArray(parsed.product_images)) data.product_images = parsed.product_images;
      if (Array.isArray(parsed.categories) && parsed.categories.length > 0) data.categories = parsed.categories;
      if (Array.isArray(parsed.subcategories) && parsed.subcategories.length > 0) data.subcategories = parsed.subcategories;
      if (Array.isArray(parsed.promotions)) data.promotions = parsed.promotions;
      if (Array.isArray(parsed.promotion_products)) data.promotion_products = parsed.promotion_products;
      if (Array.isArray(parsed.promo_banners)) data.promo_banners = parsed.promo_banners;
      if (Array.isArray(parsed.promo_banner_items)) data.promo_banner_items = parsed.promo_banner_items;
      if (Array.isArray(parsed.orders)) data.orders = parsed.orders;
      if (Array.isArray(parsed.order_items)) data.order_items = parsed.order_items;
      if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) data.profiles = parsed.profiles;
      if (parsed.orderSequence) data.orderSequence = parsed.orderSequence;
      return true;
    }
  } catch (err) {
    console.error('[memoryStore] Error al cargar memoria desde disco:', err.message);
  }
  return false;
}

function initMemoryDb(adminEmail = 'admin@narel.local', adminPassword = 'Admin1234!') {
  if (initialized) return;

  const loadedFromDisk = loadMemoryDbFromFile();
  const now = nowIso();
  const future7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const future14d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  // Admin Profile
  const adminHash = bcrypt.hashSync(adminPassword || 'Admin1234!', 10);
  const existingAdmin = data.profiles.find(p => p.role === 'admin');
  if (!existingAdmin) {
    data.profiles.push({
      id: 'b8c4d29e-47f2-4e08-9b87-4e782d2f7a01',
      first_name: 'Administrador',
      last_name: '',
      email: (adminEmail || 'admin@narel.local').toLowerCase(),
      password_hash: adminHash,
      role: 'admin',
      reset_token_hash: null,
      reset_token_expires_at: null,
      created_at: now,
      updated_at: now,
    });
  }

  if (!loadedFromDisk || data.categories.length === 0) {
    // Seed Categories & Subcategories
    const seedCategories = [
      { id: 'c1111111-1111-4111-8111-111111111111', name: 'Pantalones', slug: 'pantalones', subtitle: 'CARGADO DESDE PANEL ADMIN', sort_order: 1, created_at: now, updated_at: now },
      { id: 'c2222222-2222-4222-8222-222222222222', name: 'Camperas', slug: 'camperas', subtitle: 'CARGADO DESDE PANEL ADMIN', sort_order: 2, created_at: now, updated_at: now },
      { id: 'c3333333-3333-4333-8333-333333333333', name: 'Buzos', slug: 'buzos', subtitle: 'CARGADO DESDE PANEL ADMIN', sort_order: 3, created_at: now, updated_at: now },
      { id: 'c4444444-4444-4444-8444-444444444444', name: 'Remeras', slug: 'remeras', subtitle: 'CARGADO DESDE PANEL ADMIN', sort_order: 4, created_at: now, updated_at: now },
      { id: 'c5555555-5555-4555-8555-555555555555', name: 'Accesorios', slug: 'accesorios', subtitle: 'CARGADO DESDE PANEL ADMIN', sort_order: 5, created_at: now, updated_at: now },
    ];
    data.categories.push(...seedCategories);

    const seedSubcategories = [
      { id: 's1111111-1111-4111-8111-111111111111', category_id: 'c1111111-1111-4111-8111-111111111111', category_slug: 'pantalones', name: 'Cargo', slug: 'cargo', created_at: now, updated_at: now },
      { id: 's1111111-1111-4111-8111-222222222222', category_id: 'c1111111-1111-4111-8111-111111111111', category_slug: 'pantalones', name: 'Jeans', slug: 'jeans', created_at: now, updated_at: now },
      { id: 's1111111-1111-4111-8111-333333333333', category_id: 'c1111111-1111-4111-8111-111111111111', category_slug: 'pantalones', name: 'Joggers', slug: 'joggers', created_at: now, updated_at: now },
      { id: 's2222222-2222-4222-8222-111111111111', category_id: 'c2222222-2222-4222-8222-222222222222', category_slug: 'camperas', name: 'Bomber', slug: 'bomber', created_at: now, updated_at: now },
      { id: 's2222222-2222-4222-8222-222222222222', category_id: 'c2222222-2222-4222-8222-222222222222', category_slug: 'camperas', name: 'Puffer', slug: 'puffer', created_at: now, updated_at: now },
      { id: 's3333333-3333-4333-8333-111111111111', category_id: 'c3333333-3333-4333-8333-333333333333', category_slug: 'buzos', name: 'Hoodies', slug: 'hoodies', created_at: now, updated_at: now },
      { id: 's4444444-4444-4444-8444-111111111111', category_id: 'c4444444-4444-4444-8444-444444444444', category_slug: 'remeras', name: 'Oversized', slug: 'oversized', created_at: now, updated_at: now },
      { id: 's5555555-5555-4555-8555-111111111111', category_id: 'c5555555-5555-4555-8555-555555555555', category_slug: 'accesorios', name: 'Gorras', slug: 'gorras', created_at: now, updated_at: now },
    ];
    data.subcategories.push(...seedSubcategories);

    // Seed Products
    const seedProducts = [
      {
        id: 'a1111111-1111-4111-8111-111111111111',
        name: 'Remera Oversized NGL Diamond',
        description: 'Remera corte oversized de algodón premium 24/1 peinado con estampa frontal en serigrafía.',
        price: 28500,
        sizes: 'S,M,L,XL',
        stock: 25,
        image_url: '/assets/img/logo-ngl-diamond.jpeg',
        images: ['/assets/img/logo-ngl-diamond.jpeg', '/assets/img/bg-remeras.png'],
        category: 'remeras',
        subcategory: 'oversized',
        subcategory_id: 's4444444-4444-4444-8444-111111111111',
        active: true,
        featured: true,
        direct_purchase: false,
        allowed_payment_methods: ['tarjeta_credito', 'tarjeta_debito', 'transferencia', 'efectivo'],
        allowed_installments: [1, 3, 6],
        created_at: now,
        updated_at: now,
      },
      {
        id: 'a2222222-2222-4222-8222-222222222222',
        name: 'Buzo Hoodie Gothic Heavyweight',
        description: 'Buzo hoodie con friza pesada, bordado gótico en pecho y capucha forrada doble.',
        price: 49900,
        sizes: 'M,L,XL,XXL',
        stock: 15,
        image_url: '/assets/img/logo-ngl-diamond.jpeg',
        images: ['/assets/img/logo-ngl-diamond.jpeg', '/assets/img/bg-buzos.png'],
        category: 'buzos',
        subcategory: 'hoodies',
        subcategory_id: 's3333333-3333-4333-8333-111111111111',
        active: true,
        featured: true,
        direct_purchase: false,
        allowed_payment_methods: ['tarjeta_credito', 'tarjeta_debito', 'transferencia', 'efectivo'],
        allowed_installments: [1, 3, 6],
        created_at: now,
        updated_at: now,
      },
      {
        id: 'a3333333-3333-4333-8333-333333333333',
        name: 'Pantalón Cargo Tactical Black',
        description: 'Pantalón cargo ripstop técnico con 6 bolsillos funcionales y ajuste regulable en tobillos.',
        price: 42000,
        sizes: '38,40,42,44',
        stock: 18,
        image_url: '/assets/img/logo-ngl-diamond.jpeg',
        images: ['/assets/img/logo-ngl-diamond.jpeg', '/assets/img/bg-pantalones.png'],
        category: 'pantalones',
        subcategory: 'cargo',
        subcategory_id: 's1111111-1111-4111-8111-111111111111',
        active: true,
        featured: true,
        direct_purchase: false,
        allowed_payment_methods: ['tarjeta_credito', 'tarjeta_debito', 'transferencia', 'efectivo'],
        allowed_installments: [1, 3, 6],
        created_at: now,
        updated_at: now,
      },
      {
        id: 'a4444444-4444-4444-8444-444444444444',
        name: 'Campera Bomber Oversized Leather',
        description: 'Campera bomber de ecocuero importado con forrería matelasseada y cierre metálico YKK.',
        price: 68000,
        sizes: 'M,L,XL',
        stock: 8,
        image_url: '/assets/img/logo-ngl-diamond.jpeg',
        images: ['/assets/img/logo-ngl-diamond.jpeg', '/assets/img/bg-camperas.png'],
        category: 'camperas',
        subcategory: 'bomber',
        subcategory_id: 's2222222-2222-4222-8222-111111111111',
        active: true,
        featured: false,
        direct_purchase: false,
        allowed_payment_methods: ['tarjeta_credito', 'tarjeta_debito', 'transferencia', 'efectivo'],
        allowed_installments: [1, 3, 6],
        created_at: now,
        updated_at: now,
      },
      {
        id: 'a5555555-5555-4555-8555-555555555555',
        name: 'Gorra Trucker Gothic Patch',
        description: 'Gorra trucker con frente de gabardina, parche en relieve y red microperforada trasera.',
        price: 16500,
        sizes: 'Único',
        stock: 30,
        image_url: '/assets/img/logo-ngl-diamond.jpeg',
        images: ['/assets/img/logo-ngl-diamond.jpeg', '/assets/img/bg-accesorios.png'],
        category: 'accesorios',
        subcategory: 'gorras',
        subcategory_id: 's5555555-5555-4555-8555-111111111111',
        active: true,
        featured: true,
        direct_purchase: false,
        allowed_payment_methods: ['tarjeta_credito', 'tarjeta_debito', 'transferencia', 'efectivo'],
        allowed_installments: [1, 3, 6],
        created_at: now,
        updated_at: now,
      },
      {
        id: 'a6666666-6666-4666-8666-666666666666',
        name: 'Remera Acid Wash Raw Cut',
        description: 'Remera con proceso acid wash artesanal, terminaciones al corte y corte boxy fit.',
        price: 31000,
        sizes: 'S,M,L,XL',
        stock: 20,
        image_url: '/assets/img/logo-ngl-diamond.jpeg',
        images: ['/assets/img/logo-ngl-diamond.jpeg'],
        category: 'remeras',
        subcategory: null,
        subcategory_id: null,
        active: true,
        featured: false,
        direct_purchase: false,
        allowed_payment_methods: ['tarjeta_credito', 'tarjeta_debito', 'transferencia', 'efectivo'],
        allowed_installments: [1, 3, 6],
        created_at: now,
        updated_at: now,
      },
    ];

    data.products.push(...seedProducts);

    // Seed Banner
    const bannerId = 'b1111111-1111-4111-8111-111111111111';
    data.promo_banners.push({
      id: bannerId,
      title: 'PROMOS EXCLUSIVAS',
      subtitle: 'Prendas seleccionadas con descuento especial por tiempo limitado.',
      cta_text: 'VER LAS PROMOS',
      link: '#pantalones',
      image_url: '/assets/img/promo-title-promos-exclusivas-removebg.png',
      active: true,
      banner_type: 'oferta',
      short_description: 'Prendas urbanas con precio exclusivo',
      description: 'Promoción válida en catálogo online hasta agotar stock.',
      terms_and_conditions: 'No acumulable con otros cupones.',
      discount_type: 'override_products',
      discount_value: 20,
      badge_label: 'OFERTA',
      badge_color: '#ef4444',
      start_date: now,
      end_date: future14d,
      sort_order: 0,
      featured: true,
      created_at: now,
      updated_at: now,
    });

    data.promo_banner_items.push({
      id: uuid(),
      banner_id: bannerId,
      product_id: seedProducts[0].id,
      promo_price: 24200,
      sort_order: 0,
      created_at: now,
      updated_at: now,
    });

    data.promo_banner_items.push({
      id: uuid(),
      banner_id: bannerId,
      product_id: seedProducts[1].id,
      promo_price: 42400,
      sort_order: 1,
      created_at: now,
      updated_at: now,
    });

    // Seed Promotion
    const promoId = 'p1111111-1111-4111-8111-111111111111';
    data.promotions.push({
      id: promoId,
      title: 'COMBO STREETWEAR TEMPORADA',
      slug: 'combo-streetwear-temporada',
      short_description: 'Precios especiales llevando conjuntos',
      description: 'Llevate remera y buzo con descuento directo en el checkout.',
      terms_and_conditions: 'Hasta agotar stock de talles disponibles.',
      discount_type: 'override_products',
      discount_value: 15,
      banner_image_url: '/assets/img/promo-title-promos-exclusivas-removebg.png',
      cta_text: 'APROVECHAR',
      cta_link: '#remeras',
      badge_label: 'COMBO',
      badge_color: '#6366f1',
      start_date: now,
      end_date: future7d,
      active: true,
      featured: true,
      sort_order: 0,
      created_by: data.profiles[0].id,
      created_at: now,
      updated_at: now,
    });

    data.promotion_products.push({
      id: uuid(),
      promotion_id: promoId,
      product_id: seedProducts[0].id,
      override_price: null,
      discount_percentage: 15,
      product_note: 'Descuento especial combo',
      sort_order: 0,
      active: true,
      created_at: now,
      updated_at: now,
    });

    data.promotion_products.push({
      id: uuid(),
      promotion_id: promoId,
      product_id: seedProducts[1].id,
      override_price: null,
      discount_percentage: 15,
      product_note: 'Descuento especial combo',
      sort_order: 1,
      active: true,
      created_at: now,
      updated_at: now,
    });

    saveMemoryDbToFile();
  }

  // Auto-sync product_images from products if empty
  if (data.product_images.length === 0 && data.products.length > 0) {
    data.products.forEach((p) => {
      let urls = [];
      if (Array.isArray(p.images)) urls = p.images.filter(Boolean);
      else if (p.image_url) urls = [p.image_url];
      urls.forEach((u, idx) => {
        data.product_images.push({
          id: uuid(),
          product_id: p.id,
          image_url: u,
          storage_path: u,
          alt_text: '',
          position: idx,
          created_at: p.created_at || now,
          updated_at: p.updated_at || now,
        });
      });
    });
    saveMemoryDbToFile();
  }

  // Default Store Settings (Shipping Promo Countdown)
  const promoFile = path.join(__dirname, '..', '..', 'data', 'shipping-promo.json');
  let defaultShippingPromo = {
    enabled: true,
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    minAmount: 40000,
    city: 'Santa Fe Capital',
    mainText: 'ENVÍOS GRATIS SOLO POR ESTA SEMANA, ¿QUÉ ESPERÁS? ¡ASÍ SE INAUGURA UNA WEB! ⚡',
    exclusiveLabel: 'EXCLUSIVA PARA SANTA FE CAPITAL',
    subText: 'Envíos por compras a partir de $40.000.',
    updatedAt: now,
  };
  if (fs.existsSync(promoFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(promoFile, 'utf8'));
      defaultShippingPromo = Object.assign(defaultShippingPromo, parsed);
    } catch (_) {}
  } else {
    try {
      const dir = path.dirname(promoFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(promoFile, JSON.stringify(defaultShippingPromo, null, 2), 'utf8');
    } catch (_) {}
  }
  data.store_settings['shipping_promo'] = defaultShippingPromo;

  initialized = true;
}

function executeMemoryQuery(rawText, params = []) {
  const sql = String(rawText || '').trim();
  const lowerSql = sql.toLowerCase();

  // 0. STORE SETTINGS
  if (lowerSql.includes('from store_settings') && lowerSql.includes('where key=$1')) {
    const key = params[0];
    const val = data.store_settings[key];
    return { rows: val ? [{ key, value: val, updated_at: nowIso() }] : [], rowCount: val ? 1 : 0 };
  }

  if (lowerSql.includes('store_settings') && (lowerSql.startsWith('insert') || lowerSql.startsWith('update'))) {
    const key = params[0];
    let val = params[1];
    if (typeof val === 'string') {
      try { val = JSON.parse(val); } catch (_) {}
    }
    data.store_settings[key] = val;
    if (key === 'shipping_promo') {
      try {
        const promoFile = path.join(__dirname, '..', '..', 'data', 'shipping-promo.json');
        const dir = path.dirname(promoFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(promoFile, JSON.stringify(val, null, 2), 'utf8');
      } catch (_) {}
    }
    return { rows: [{ key, value: val, updated_at: nowIso() }], rowCount: 1 };
  }

  // 0.1 NOTIFICATION LOGS
  if (lowerSql.includes('from notification_logs')) {
    const sorted = [...data.notification_logs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const limit = Number(params[0]) || 50;
    return { rows: sorted.slice(0, limit), rowCount: sorted.length };
  }

  if (lowerSql.startsWith('insert into notification_logs')) {
    const id = uuid();
    const now = nowIso();
    const newLog = {
      id,
      type: params[0] || 'order_notification',
      recipient: params[1] || '',
      subject: params[2] || '',
      order_number: params[3] || null,
      status: params[4] || 'sent',
      error_message: params[5] || null,
      payload: typeof params[6] === 'string' ? JSON.parse(params[6]) : params[6],
      created_at: now,
    };
    data.notification_logs.push(newLog);
    return { rows: [newLog], rowCount: 1 };
  }

  // 1. PROFILES (Auth)
  if (lowerSql.includes('from profiles') && lowerSql.includes('where id=$1')) {
    const user = data.profiles.find((p) => p.id === params[0]);
    return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
  }

  if (lowerSql.includes('from profiles') && lowerSql.includes('lower(email)=lower($1)')) {
    const email = String(params[0] || '').toLowerCase();
    const user = data.profiles.find((p) => p.email.toLowerCase() === email);
    return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
  }

  if (lowerSql.startsWith('insert into profiles')) {
    const id = uuid();
    const now = nowIso();
    // INSERT INTO profiles(first_name,last_name,email,password_hash,role) VALUES(...) ON CONFLICT...
    if (lowerSql.includes('on conflict(email)')) {
      const existingIndex = data.profiles.findIndex((p) => p.email.toLowerCase() === String(params[2] || '').toLowerCase());
      if (existingIndex >= 0) {
        data.profiles[existingIndex].password_hash = params[3];
        data.profiles[existingIndex].role = 'admin';
        data.profiles[existingIndex].updated_at = now;
        return { rows: [{ ...data.profiles[existingIndex] }], rowCount: 1 };
      }
      const newAdmin = {
        id,
        first_name: params[0] || 'Administrador',
        last_name: params[1] || '',
        email: String(params[2]).toLowerCase(),
        password_hash: params[3],
        role: 'admin',
        reset_token_hash: null,
        reset_token_expires_at: null,
        created_at: now,
        updated_at: now,
      };
      data.profiles.push(newAdmin);
      return { rows: [{ ...newAdmin }], rowCount: 1 };
    }

    const newUser = {
      id,
      first_name: params[0] || '',
      last_name: params[1] || '',
      email: String(params[2]).toLowerCase(),
      password_hash: params[3],
      role: 'user',
      reset_token_hash: null,
      reset_token_expires_at: null,
      created_at: now,
      updated_at: now,
    };
    data.profiles.push(newUser);
    return { rows: [{ ...newUser }], rowCount: 1 };
  }

  if (lowerSql.startsWith('update profiles')) {
    if (lowerSql.includes('reset_token_hash=$1')) {
      const user = data.profiles.find((p) => p.id === params[1]);
      if (user) {
        user.reset_token_hash = params[0];
        user.reset_token_expires_at = new Date(Date.now() + 3600000).toISOString();
        user.updated_at = nowIso();
        return { rows: [{ ...user }], rowCount: 1 };
      }
    } else if (lowerSql.includes('password_hash=$1')) {
      const user = data.profiles.find((p) => p.reset_token_hash === params[1] && new Date(p.reset_token_expires_at) > new Date());
      if (user) {
        user.password_hash = params[0];
        user.reset_token_hash = null;
        user.reset_token_expires_at = null;
        user.updated_at = nowIso();
        return { rows: [{ id: user.id }], rowCount: 1 };
      }
    }
    return { rows: [], rowCount: 0 };
  }

  // 2. USER SESSIONS
  if (lowerSql.startsWith('update user_sessions')) {
    if (lowerSql.includes('user_id=$1 and active=true')) {
      data.user_sessions.forEach((s) => {
        if (s.user_id === params[0] && s.active) {
          s.active = false;
          s.invalidated_at = nowIso();
        }
      });
      return { rows: [], rowCount: 1 };
    }
    if (lowerSql.includes('session_id=$1 and active=true')) {
      const s = data.user_sessions.find((x) => x.session_id === params[0]);
      if (s) s.last_seen = nowIso();
      return { rows: [], rowCount: s ? 1 : 0 };
    }
    if (lowerSql.includes('session_id=$1')) {
      const s = data.user_sessions.find((x) => x.session_id === params[0]);
      if (s) {
        s.active = false;
        s.invalidated_at = nowIso();
      }
      return { rows: [], rowCount: s ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (lowerSql.startsWith('insert into user_sessions')) {
    const id = uuid();
    const now = nowIso();
    const session = {
      id,
      user_id: params[0],
      session_id: params[1],
      token_hash: params[2],
      user_agent: params[3] || null,
      ip_address: params[4] || null,
      active: true,
      created_at: now,
      last_seen: now,
    };
    data.user_sessions.push(session);
    return { rows: [{ ...session }], rowCount: 1 };
  }

  if (lowerSql.includes('from user_sessions s join profiles p')) {
    const tokenHash = params[0];
    const sessionId = params[1];
    const session = data.user_sessions.find((s) => s.token_hash === tokenHash && s.session_id === sessionId && s.active);
    if (!session) return { rows: [], rowCount: 0 };
    const profile = data.profiles.find((p) => p.id === session.user_id);
    if (!profile) return { rows: [], rowCount: 0 };
    return {
      rows: [
        {
          ...session,
          profile_id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          role: profile.role,
          profile_created_at: profile.created_at,
        },
      ],
      rowCount: 1,
    };
  }

  // 2b. CATEGORIES & SUBCATEGORIES
  if (lowerSql.startsWith('select') && lowerSql.includes('from categories')) {
    let list = [...data.categories];
    if (lowerSql.includes('count(*)')) {
      return { rows: [{ count: list.length }], rowCount: 1 };
    }
    if (/where\s+slug\s*=\s*\$1/.test(lowerSql)) {
      const cat = list.find((c) => String(c.slug).toLowerCase() === String(params[0] || '').toLowerCase().trim());
      return { rows: cat ? [{ ...cat, subtitle: cat.subtitle || 'CARGADO DESDE PANEL ADMIN' }] : [], rowCount: cat ? 1 : 0 };
    }
    if (/where\s+id\s*=\s*\$1/.test(lowerSql) || /where\s+id::text\s*=\s*\$1/.test(lowerSql)) {
      const cat = list.find((c) => String(c.id) === String(params[0] || '').trim() || String(c.slug).toLowerCase() === String(params[0] || '').toLowerCase().trim());
      return { rows: cat ? [{ ...cat, subtitle: cat.subtitle || 'CARGADO DESDE PANEL ADMIN' }] : [], rowCount: cat ? 1 : 0 };
    }
    list.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
    return { rows: list.map((c) => ({ ...c, subtitle: c.subtitle || 'CARGADO DESDE PANEL ADMIN' })), rowCount: list.length };
  }

  if (lowerSql.startsWith('insert into categories')) {
    const id = uuid();
    const now = nowIso();
    const name = String(params[0] || '').trim();
    const slug = String(params[1] || '').toLowerCase().trim();
    let subtitle = 'CARGADO DESDE PANEL ADMIN';
    let sort_order = 0;
    if (params.length >= 4) {
      if (typeof params[2] === 'string' && isNaN(Number(params[2]))) {
        subtitle = params[2].trim() || 'CARGADO DESDE PANEL ADMIN';
        sort_order = Number(params[3]) || 0;
      } else {
        sort_order = Number(params[2]) || 0;
        subtitle = params[3] ? String(params[3]).trim() || 'CARGADO DESDE PANEL ADMIN' : subtitle;
      }
    } else if (params.length === 3) {
      if (typeof params[2] === 'number' || !isNaN(Number(params[2]))) {
        sort_order = Number(params[2]) || 0;
      } else {
        subtitle = String(params[2]).trim() || subtitle;
      }
    }
    const existing = data.categories.find((c) => c.slug === slug);
    if (existing) {
      return { rows: [{ ...existing, subtitle: existing.subtitle || 'CARGADO DESDE PANEL ADMIN' }], rowCount: 1 };
    }
    const newCat = { id, name, slug, subtitle, sort_order, created_at: now, updated_at: now };
    data.categories.push(newCat);
    saveMemoryDbToFile();
    return { rows: [{ ...newCat }], rowCount: 1 };
  }

  if (lowerSql.startsWith('update categories')) {
    const now = nowIso();
    const id = String(params[params.length - 1] || '');
    const cat = data.categories.find((c) => c.id === id || c.slug === id);
    if (!cat) return { rows: [], rowCount: 0 };
    if (params.length >= 4) {
      cat.name = String(params[0] || cat.name).trim();
      cat.slug = String(params[1] || cat.slug).toLowerCase().trim();
      cat.subtitle = params[2] !== undefined ? String(params[2]).trim() || 'CARGADO DESDE PANEL ADMIN' : (cat.subtitle || 'CARGADO DESDE PANEL ADMIN');
      cat.sort_order = Number(params[3]) !== undefined && !isNaN(Number(params[3])) ? Number(params[3]) : cat.sort_order;
    }
    cat.updated_at = now;
    saveMemoryDbToFile();
    return { rows: [{ ...cat }], rowCount: 1 };
  }

  if (lowerSql.startsWith('delete from categories')) {
    const id = String(params[0] || '');
    const idx = data.categories.findIndex((c) => c.id === id || c.slug === id);
    if (idx >= 0) {
      const removed = data.categories.splice(idx, 1)[0];
      // Cascade delete subcategories
      data.subcategories = data.subcategories.filter((s) => s.category_id !== removed.id && s.category_slug.toLowerCase() !== removed.slug.toLowerCase());
      // Unlink products
      data.products.forEach((p) => {
        if (p.category && (p.category.toLowerCase() === removed.slug.toLowerCase() || p.category.toLowerCase() === removed.name.toLowerCase())) {
          p.category = '';
          p.subcategory = null;
          p.subcategory_id = null;
        }
      });
      saveMemoryDbToFile();
      return { rows: [{ id: removed.id }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (lowerSql.startsWith('update subcategories')) {
    if (lowerSql.includes('set category_slug = $1') || lowerSql.includes('set category_slug=$1')) {
      const newSlug = String(params[0] || '').toLowerCase().trim();
      const oldSlug = String(params[1] || '').toLowerCase().trim();
      const catId = params[2] ? String(params[2]) : null;
      let count = 0;
      data.subcategories.forEach((s) => {
        if (s.category_slug.toLowerCase() === oldSlug || (catId && s.category_id === catId)) {
          s.category_slug = newSlug;
          s.updated_at = nowIso();
          count++;
        }
      });
      saveMemoryDbToFile();
      return { rows: [], rowCount: count };
    }
    if (lowerSql.includes('set name = $1') || lowerSql.includes('set name=$1')) {
      const newName = String(params[0] || '').trim();
      const newSlug = String(params[1] || '').toLowerCase().trim();
      const subId = String(params[2] || '');
      const sub = data.subcategories.find((s) => s.id === subId);
      if (sub) {
        sub.name = newName;
        sub.slug = newSlug;
        sub.updated_at = nowIso();
        saveMemoryDbToFile();
        return { rows: [{ ...sub }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
  }

  if (lowerSql.startsWith('delete from subcategories')) {
    const idOrSlug = String(params[0] || '').toLowerCase().trim();
    const beforeLen = data.subcategories.length;
    data.subcategories = data.subcategories.filter((s) => {
      const matches = s.category_id === params[0] || s.category_slug.toLowerCase() === idOrSlug || s.id === params[0];
      return !matches;
    });
    saveMemoryDbToFile();
    return { rows: [], rowCount: beforeLen - data.subcategories.length };
  }

  if (lowerSql.startsWith('select') && lowerSql.includes('from subcategories')) {
    let list = [...data.subcategories];
    if (/where\s+id\s*=\s*\$1/.test(lowerSql)) {
      const id = String(params[0] || '');
      const found = list.find((s) => s.id === id);
      return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
    }
    if (/where\s+category_id\s*=\s*\$1\s+and\s+slug\s*=\s*\$2/.test(lowerSql)) {
      const catId = String(params[0] || '');
      const subSlug = String(params[1] || '').toLowerCase().trim();
      const found = list.find((s) => s.category_id === catId && s.slug.toLowerCase() === subSlug);
      return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
    }
    if (/where\s+category_slug\s*=\s*\$1\s+and\s+slug\s*=\s*\$2/.test(lowerSql)) {
      const catSlug = String(params[0] || '').toLowerCase().trim();
      const subSlug = String(params[1] || '').toLowerCase().trim();
      const found = list.find((s) => s.category_slug.toLowerCase() === catSlug && s.slug.toLowerCase() === subSlug);
      return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
    }
    if (/where\s+category_slug\s*=\s*\$1/.test(lowerSql)) {
      const catSlug = String(params[0] || '').toLowerCase().trim();
      list = list.filter((s) => s.category_slug.toLowerCase() === catSlug);
      return { rows: list.map((s) => ({ ...s })), rowCount: list.length };
    }
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return { rows: list.map((s) => ({ ...s })), rowCount: list.length };
  }

  if (lowerSql.startsWith('insert into subcategories')) {
    const id = uuid();
    const now = nowIso();
    const category_id = params[0] || null;
    const category_slug = String(params[1] || '').toLowerCase().trim();
    const name = String(params[2] || '').trim();
    const slug = String(params[3] || '').toLowerCase().trim();

    const existing = data.subcategories.find(
      (s) => s.category_slug === category_slug && (s.slug === slug || s.name.toLowerCase() === name.toLowerCase())
    );
    if (existing) {
      return { rows: [{ ...existing }], rowCount: 1 };
    }

    const newSub = {
      id,
      category_id,
      category_slug,
      name,
      slug,
      created_at: now,
      updated_at: now,
    };
    data.subcategories.push(newSub);
    return { rows: [{ ...newSub }], rowCount: 1 };
  }

  // 3. PRODUCTS (Public & Admin)
  if (lowerSql.includes('from products') && lowerSql.includes('count(*) filter')) {
    const total = data.products.length;
    const totalStock = data.products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
    const outOfStock = data.products.filter((p) => Number(p.stock) <= 0).length;
    return {
      rows: [{ total_products: total, total_stock: totalStock, out_of_stock: outOfStock }],
      rowCount: 1,
    };
  }

  if (lowerSql.includes('select count(*)::int as count from products') || lowerSql === 'select count(*)::int count from products') {
    return { rows: [{ count: data.products.length }], rowCount: 1 };
  }

  if (lowerSql.startsWith('select') && lowerSql.includes('from products') && lowerSql.includes('where id=$1')) {
    const product = data.products.find((p) => p.id === params[0]);
    return { rows: product ? [{ ...product }] : [], rowCount: product ? 1 : 0 };
  }

  if (lowerSql.startsWith('select') && lowerSql.includes('from products') && lowerSql.includes('active=true')) {
    let list = data.products.filter((p) => p.active);
    if (lowerSql.includes('category=$1') || lowerSql.includes('category = $1')) {
      const cat = String(params[0] || '').toLowerCase();
      list = list.filter((p) => String(p.category || '').toLowerCase() === cat);
      if (lowerSql.includes('subcategory=$2') || lowerSql.includes('subcategory = $2')) {
        const sub = String(params[1] || '').toLowerCase();
        list = list.filter((p) => String(p.subcategory || '').toLowerCase() === sub);
      }
    } else if (lowerSql.includes('subcategory=$1') || lowerSql.includes('subcategory = $1')) {
      const sub = String(params[0] || '').toLowerCase();
      list = list.filter((p) => String(p.subcategory || '').toLowerCase() === sub);
    }
    // order by featured desc, updated_at desc
    list.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
    const limit = Number(params[params.length - 1]) || 100;
    const sliced = list.slice(0, limit);
    return { rows: sliced.map((p) => ({ ...p })), rowCount: sliced.length };
  }

  if (lowerSql.startsWith('select') && lowerSql.includes('from products') && lowerSql.includes('order by')) {
    let list = [...data.products];
    // Admin list
    list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    const limit = Number(params[0]) || 100;
    const offset = Number(params[1]) || 0;
    const sliced = list.slice(offset, offset + limit);
    return { rows: sliced.map((p) => ({ ...p })), rowCount: sliced.length };
  }

  if (lowerSql.includes('from products') && lowerSql.includes('group by category')) {
    const counts = new Map();
    data.products.forEach((p) => {
      const c = String(p.category || '').toLowerCase().trim();
      if (c) {
        counts.set(c, (counts.get(c) || 0) + 1);
      }
    });
    const rows = [];
    counts.forEach((count, category) => {
      rows.push({ category, count: Number(count) });
    });
    return { rows, rowCount: rows.length };
  }

  if (lowerSql.startsWith('insert into products')) {
    const id = uuid();
    const now = nowIso();
    const hasSizeGuide = lowerSql.includes('size_guide');
    const hasImagesCol = lowerSql.includes('images');
    const isExtended = lowerSql.includes('subcategory');
    const hasDirect = lowerSql.includes('direct_purchase');

    const sgOffset = hasSizeGuide ? 1 : 0;
    const name = params[0];
    const description = params[1] || '';
    const price = Number(params[2]) || 0;
    const sizes = params[3] || '';
    const size_guide = hasSizeGuide ? (params[4] || null) : null;
    const stock = Number(params[4 + sgOffset]) || 0;

    let rawImages = hasImagesCol ? params[6 + sgOffset] : null;
    let imagesList = [];
    if (Array.isArray(rawImages)) imagesList = rawImages;
    else if (typeof rawImages === 'string' && rawImages.startsWith('[')) {
      try { imagesList = JSON.parse(rawImages); } catch (_) {}
    } else if (rawImages) imagesList = [rawImages];

    const imgOffset = (hasImagesCol ? 1 : 0) + sgOffset;
    const imageUrl = params[5 + sgOffset] || (imagesList[0] || null);
    if (imageUrl && !imagesList.includes(imageUrl)) imagesList.unshift(imageUrl);

    const newProduct = {
      id,
      name,
      description,
      price,
      sizes,
      size_guide,
      stock,
      image_url: imageUrl,
      images: imagesList,
      category: params[6 + imgOffset] || 'remeras',
      subcategory: isExtended ? (params[7 + imgOffset] || null) : null,
      subcategory_id: isExtended ? (params[8 + imgOffset] || null) : null,
      active: (isExtended ? params[9 + imgOffset] : params[7 + imgOffset]) !== false,
      featured: (isExtended ? params[10 + imgOffset] : params[8 + imgOffset]) === true,
      direct_purchase: hasDirect ? params[11 + imgOffset] === true : false,
      allowed_payment_methods: hasDirect && params[12 + imgOffset] ? (typeof params[12 + imgOffset] === 'string' ? JSON.parse(params[12 + imgOffset]) : params[12 + imgOffset]) : ['tarjeta_credito', 'tarjeta_debito', 'transferencia', 'efectivo'],
      allowed_installments: hasDirect && params[13 + imgOffset] ? (typeof params[13 + imgOffset] === 'string' ? JSON.parse(params[13 + imgOffset]) : params[13 + imgOffset]) : [1, 3, 6],
      direct_discount_percent: hasDirect && params[14 + imgOffset] !== undefined && params[14 + imgOffset] !== null ? Number(params[14 + imgOffset]) : 25,
      direct_discount_text: hasDirect && params[15 + imgOffset] ? String(params[15 + imgOffset]) : 'con transferencia',
      direct_show_promo_badge: hasDirect && params[16 + imgOffset] !== undefined ? params[16 + imgOffset] === true : true,
      direct_promo_badge_text: hasDirect && params[17 + imgOffset] ? String(params[17 + imgOffset]) : 'PROMO ACTIVA',
      direct_installments_count: hasDirect && params[18 + imgOffset] ? Number(params[18 + imgOffset]) : 6,
      direct_installments_text: hasDirect && params[19 + imgOffset] ? String(params[19 + imgOffset]) : 'sin interés',
      direct_custom_transfer_price: hasDirect && params[20 + imgOffset] !== undefined && params[20 + imgOffset] !== null && params[20 + imgOffset] !== '' ? Number(params[20 + imgOffset]) : null,
      direct_transfer_text: hasDirect && params[21 + imgOffset] ? String(params[21 + imgOffset]) : 'con Transferencia',
      created_at: now,
      updated_at: now,
    };
    data.products.unshift(newProduct);
    saveMemoryDbToFile();
    return { rows: [{ ...newProduct }], rowCount: 1 };
  }

  // PRODUCT_IMAGES (Relación 1 a N con products)
  if (lowerSql.startsWith('select') && lowerSql.includes('from product_images')) {
    let list = [...data.product_images];
    if (lowerSql.includes('product_id = any') || lowerSql.includes('product_id=any')) {
      const ids = Array.isArray(params[0]) ? params[0].map(String) : [String(params[0])];
      list = list.filter((img) => ids.includes(img.product_id));
      list.sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
      return { rows: list.map((img) => ({ ...img })), rowCount: list.length };
    }
    if (lowerSql.includes('where product_id = $1') || lowerSql.includes('where product_id=$1')) {
      const pId = String(params[0] || '');
      list = list.filter((img) => img.product_id === pId);
      list.sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
      return { rows: list.map((img) => ({ ...img })), rowCount: list.length };
    }
    if (lowerSql.includes('where id = $1') || lowerSql.includes('where id=$1')) {
      const imgId = String(params[0] || '');
      const found = list.find((img) => img.id === imgId);
      return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
    }
    return { rows: list.map((img) => ({ ...img })), rowCount: list.length };
  }

  if (lowerSql.startsWith('insert into product_images')) {
    const id = uuid();
    const now = nowIso();
    const product_id = String(params[0] || '');
    const image_url = String(params[1] || '');
    const storage_path = params[2] ? String(params[2]) : image_url;
    const alt_text = params[3] ? String(params[3]) : '';
    const position = params[4] !== undefined && !isNaN(Number(params[4])) ? Number(params[4]) : 0;

    const newImg = {
      id,
      product_id,
      image_url,
      storage_path,
      alt_text,
      position,
      created_at: now,
      updated_at: now,
    };
    data.product_images.push(newImg);
    saveMemoryDbToFile();
    return { rows: [{ ...newImg }], rowCount: 1 };
  }

  if (lowerSql.startsWith('delete from product_images')) {
    const beforeLen = data.product_images.length;
    if (lowerSql.includes('where product_id = $1') || lowerSql.includes('where product_id=$1')) {
      const pId = String(params[0] || '');
      data.product_images = data.product_images.filter((img) => img.product_id !== pId);
    } else if (lowerSql.includes('where id = $1') || lowerSql.includes('where id=$1')) {
      const imgId = String(params[0] || '');
      data.product_images = data.product_images.filter((img) => img.id !== imgId);
    }
    saveMemoryDbToFile();
    return { rows: [], rowCount: beforeLen - data.product_images.length };
  }

  if (lowerSql.startsWith('update product_images')) {
    const now = nowIso();
    if (lowerSql.includes('where id = $') || lowerSql.includes('where id=$')) {
      const imgId = String(params[params.length - 1] || '');
      const found = data.product_images.find((img) => img.id === imgId);
      if (found) {
        if (lowerSql.includes('position')) {
          found.position = Number(params[0]) || 0;
        }
        if (lowerSql.includes('alt_text')) {
          found.alt_text = String(params[1] || '');
        }
        found.updated_at = now;
        saveMemoryDbToFile();
        return { rows: [{ ...found }], rowCount: 1 };
      }
    }
    return { rows: [], rowCount: 0 };
  }

  if (lowerSql.startsWith('update products')) {
    if (lowerSql.includes('where id=$25')) {
      const p = data.products.find((x) => x.id === params[24]);
      if (!p) return { rows: [], rowCount: 0 };
      p.name = params[0];
      p.description = params[1] || '';
      p.price = Number(params[2]) || 0;
      p.sizes = params[3] || '';
      p.size_guide = params[4] || null;
      p.stock = Number(params[5]) || 0;
      if (params[6] !== null && params[6] !== undefined) p.image_url = params[6];
      if (params[7] !== null && params[7] !== undefined) {
        try { p.images = typeof params[7] === 'string' ? JSON.parse(params[7]) : params[7]; } catch (_) { p.images = [params[7]]; }
      }
      if (params[8]) p.category = params[8];
      p.subcategory = params[9] || null;
      p.subcategory_id = params[10] || null;
      if (params[11] !== null && params[11] !== undefined) p.active = params[11];
      if (params[12] !== null && params[12] !== undefined) p.featured = params[12];
      if (params[13] !== null && params[13] !== undefined) p.direct_purchase = params[13] === true;
      if (params[14]) p.allowed_payment_methods = typeof params[14] === 'string' ? JSON.parse(params[14]) : params[14];
      if (params[15]) p.allowed_installments = typeof params[15] === 'string' ? JSON.parse(params[15]) : params[15];
      if (params[16] !== undefined && params[16] !== null) p.direct_discount_percent = Number(params[16]);
      if (params[17] !== undefined) p.direct_discount_text = String(params[17] || 'con transferencia');
      if (params[18] !== undefined) p.direct_show_promo_badge = params[18] === true;
      if (params[19] !== undefined) p.direct_promo_badge_text = String(params[19] || 'PROMO ACTIVA');
      if (params[20] !== undefined) p.direct_installments_count = Number(params[20]) || 6;
      if (params[21] !== undefined) p.direct_installments_text = String(params[21] || 'sin interés');
      if (params[22] !== undefined) p.direct_custom_transfer_price = params[22] ? Number(params[22]) : null;
      if (params[23] !== undefined) p.direct_transfer_text = String(params[23] || 'con Transferencia');
      p.updated_at = nowIso();
      saveMemoryDbToFile();
      return { rows: [{ ...p }], rowCount: 1 };
    }
    if ((lowerSql.includes('set image_url') && lowerSql.includes('images')) && !lowerSql.includes('set name')) {
      const prodId = params[2];
      const p = data.products.find((x) => x.id === prodId);
      if (p) {
        p.image_url = params[0] || null;
        try {
          p.images = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1];
        } catch (_) {
          p.images = params[1] ? [params[1]] : [];
        }
        p.updated_at = nowIso();
        saveMemoryDbToFile();
        return { rows: [{ ...p }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (lowerSql.includes('where id=$24')) {
      const p = data.products.find((x) => x.id === params[23]);
      if (!p) return { rows: [], rowCount: 0 };
      p.name = params[0];
      p.description = params[1] || '';
      p.price = Number(params[2]) || 0;
      p.sizes = params[3] || '';
      p.stock = Number(params[4]) || 0;
      if (params[5] !== null && params[5] !== undefined) p.image_url = params[5];
      if (params[6] !== null && params[6] !== undefined) {
        try { p.images = typeof params[6] === 'string' ? JSON.parse(params[6]) : params[6]; } catch (_) { p.images = [params[6]]; }
      }
      if (params[7]) p.category = params[7];
      p.subcategory = params[8] || null;
      p.subcategory_id = params[9] || null;
      if (params[10] !== null && params[10] !== undefined) p.active = params[10];
      if (params[11] !== null && params[11] !== undefined) p.featured = params[11];
      if (params[12] !== null && params[12] !== undefined) p.direct_purchase = params[12] === true;
      if (params[13]) p.allowed_payment_methods = typeof params[13] === 'string' ? JSON.parse(params[13]) : params[13];
      if (params[14]) p.allowed_installments = typeof params[14] === 'string' ? JSON.parse(params[14]) : params[14];
      if (params[15] !== undefined && params[15] !== null) p.direct_discount_percent = Number(params[15]);
      if (params[16] !== undefined) p.direct_discount_text = String(params[16] || 'con transferencia');
      if (params[17] !== undefined) p.direct_show_promo_badge = params[17] === true;
      if (params[18] !== undefined) p.direct_promo_badge_text = String(params[18] || 'PROMO ACTIVA');
      if (params[19] !== undefined) p.direct_installments_count = Number(params[19]) || 6;
      if (params[20] !== undefined) p.direct_installments_text = String(params[20] || 'sin interés');
      if (params[21] !== undefined) p.direct_custom_transfer_price = params[21] ? Number(params[21]) : null;
      if (params[22] !== undefined) p.direct_transfer_text = String(params[22] || 'con Transferencia');
      p.updated_at = nowIso();
      saveMemoryDbToFile();
      return { rows: [{ ...p }], rowCount: 1 };
    }
    if (lowerSql.includes('where id=$23')) {
      const p = data.products.find((x) => x.id === params[22]);
      if (!p) return { rows: [], rowCount: 0 };
      p.name = params[0];
      p.description = params[1] || '';
      p.price = Number(params[2]) || 0;
      p.sizes = params[3] || '';
      p.stock = Number(params[4]) || 0;
      if (params[5] !== null && params[5] !== undefined) p.image_url = params[5];
      if (params[6]) p.category = params[6];
      p.subcategory = params[7] || null;
      p.subcategory_id = params[8] || null;
      if (params[9] !== null && params[9] !== undefined) p.active = params[9];
      if (params[10] !== null && params[10] !== undefined) p.featured = params[10];
      if (params[11] !== null && params[11] !== undefined) p.direct_purchase = params[11] === true;
      if (params[12]) p.allowed_payment_methods = typeof params[12] === 'string' ? JSON.parse(params[12]) : params[12];
      if (params[13]) p.allowed_installments = typeof params[13] === 'string' ? JSON.parse(params[13]) : params[13];
      if (params[14] !== undefined && params[14] !== null) p.direct_discount_percent = Number(params[14]);
      if (params[15] !== undefined) p.direct_discount_text = String(params[15] || 'con transferencia');
      if (params[16] !== undefined) p.direct_show_promo_badge = params[16] === true;
      if (params[17] !== undefined) p.direct_promo_badge_text = String(params[17] || 'PROMO ACTIVA');
      if (params[18] !== undefined) p.direct_installments_count = Number(params[18]) || 6;
      if (params[19] !== undefined) p.direct_installments_text = String(params[19] || 'sin interés');
      if (params[20] !== undefined) p.direct_custom_transfer_price = params[20] ? Number(params[20]) : null;
      if (params[21] !== undefined) p.direct_transfer_text = String(params[21] || 'con Transferencia');
      p.updated_at = nowIso();
      saveMemoryDbToFile();
      return { rows: [{ ...p }], rowCount: 1 };
    }
    if (lowerSql.includes('set category = $1') || lowerSql.includes('set category=$1')) {
      const newCat = String(params[0] || '').toLowerCase().trim();
      const oldCat = String(params[1] || '').toLowerCase().trim();
      const altOldCat = params[2] ? String(params[2] || '').toLowerCase().trim() : '';
      let updatedCount = 0;
      data.products.forEach((p) => {
        const pCat = String(p.category || '').toLowerCase().trim();
        if (pCat === oldCat || (altOldCat && pCat === altOldCat)) {
          p.category = newCat;
          p.updated_at = nowIso();
          updatedCount++;
        }
      });
      saveMemoryDbToFile();
      return { rows: [], rowCount: updatedCount };
    }
    if (lowerSql.includes('stock=stock-$1')) {
      const delta = Number(params[0]);
      const p = data.products.find((x) => x.id === params[1]);
      if (p) {
        p.stock = Math.max(0, p.stock - delta);
        p.updated_at = nowIso();
        saveMemoryDbToFile();
        return { rows: [{ ...p }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (lowerSql.includes('where id=$15')) {
      const p = data.products.find((x) => x.id === params[14]);
      if (!p) return { rows: [], rowCount: 0 };
      p.name = params[0];
      p.description = params[1] || '';
      p.price = Number(params[2]) || 0;
      p.sizes = params[3] || '';
      p.stock = Number(params[4]) || 0;
      if (params[5] !== null && params[5] !== undefined) p.image_url = params[5];
      if (params[6]) p.category = params[6];
      p.subcategory = params[7] || null;
      p.subcategory_id = params[8] || null;
      if (params[9] !== null && params[9] !== undefined) p.active = params[9];
      if (params[10] !== null && params[10] !== undefined) p.featured = params[10];
      if (params[11] !== null && params[11] !== undefined) p.direct_purchase = params[11] === true;
      if (params[12]) p.allowed_payment_methods = typeof params[12] === 'string' ? JSON.parse(params[12]) : params[12];
      if (params[13]) p.allowed_installments = typeof params[13] === 'string' ? JSON.parse(params[13]) : params[13];
      p.updated_at = nowIso();
      saveMemoryDbToFile();
      return { rows: [{ ...p }], rowCount: 1 };
    }
    if (lowerSql.includes('where id=$12')) {
      const p = data.products.find((x) => x.id === params[11]);
      if (!p) return { rows: [], rowCount: 0 };
      p.name = params[0];
      p.description = params[1] || '';
      p.price = Number(params[2]) || 0;
      p.sizes = params[3] || '';
      p.stock = Number(params[4]) || 0;
      if (params[5] !== null && params[5] !== undefined) p.image_url = params[5];
      if (params[6]) p.category = params[6];
      p.subcategory = params[7] || null;
      p.subcategory_id = params[8] || null;
      if (params[9] !== null && params[9] !== undefined) p.active = params[9];
      if (params[10] !== null && params[10] !== undefined) p.featured = params[10];
      p.updated_at = nowIso();
      saveMemoryDbToFile();
      return { rows: [{ ...p }], rowCount: 1 };
    }
    if (lowerSql.includes('where id=$10')) {
      const p = data.products.find((x) => x.id === params[9]);
      if (!p) return { rows: [], rowCount: 0 };
      p.name = params[0];
      p.description = params[1] || '';
      p.price = Number(params[2]) || 0;
      p.sizes = params[3] || '';
      p.stock = Number(params[4]) || 0;
      if (params[5] !== null && params[5] !== undefined) p.image_url = params[5];
      if (params[6]) p.category = params[6];
      if (params[7] !== null && params[7] !== undefined) p.active = params[7];
      if (params[8] !== null && params[8] !== undefined) p.featured = params[8];
      p.updated_at = nowIso();
      saveMemoryDbToFile();
      return { rows: [{ ...p }], rowCount: 1 };
    }
    if (lowerSql.includes('image_url=null where id=$1')) {
      const p = data.products.find((x) => x.id === params[0]);
      if (p) {
        p.image_url = null;
        saveMemoryDbToFile();
      }
      return { rows: [], rowCount: p ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (lowerSql.startsWith('delete from products where id=$1')) {
    const pId = params[0];
    const idx = data.products.findIndex((p) => p.id === pId);
    if (idx >= 0) {
      const removed = data.products.splice(idx, 1)[0];
      data.product_images = data.product_images.filter((img) => img.product_id !== pId);
      saveMemoryDbToFile();
      return { rows: [{ id: removed.id }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // 4. PROMO BANNERS & ITEMS
  if (lowerSql.includes('from promo_banners') && lowerSql.includes('count(*)')) {
    return { rows: [{ count: data.promo_banners.length }], rowCount: 1 };
  }

  if (lowerSql.startsWith('select') && lowerSql.includes('from promo_banners') && lowerSql.includes('where id=$1')) {
    const b = data.promo_banners.find((x) => x.id === params[0]);
    return { rows: b ? [{ ...b }] : [], rowCount: b ? 1 : 0 };
  }

  if (lowerSql.startsWith('select') && lowerSql.includes('from promo_banners')) {
    let banners = [...data.promo_banners];
    if (lowerSql.includes('active=true')) {
      banners = banners.filter((b) => b.active);
    }
    banners.sort((a, b) => a.sort_order - b.sort_order || new Date(b.created_at) - new Date(a.created_at));
    const limit = Number(params[0]) || 20;
    const sliced = banners.slice(0, limit);
    return { rows: sliced.map((b) => ({ ...b })), rowCount: sliced.length };
  }

  if (lowerSql.includes('from promo_banner_items bi') && lowerSql.includes('join products p')) {
    const bannerIds = Array.isArray(params[0]) ? params[0] : [params[0]];
    const items = data.promo_banner_items
      .filter((bi) => bannerIds.includes(bi.banner_id))
      .map((bi) => {
        const prod = data.products.find((p) => p.id === bi.product_id) || {};
        return {
          id: bi.id,
          banner_id: bi.banner_id,
          product_id: bi.product_id,
          promo_price: bi.promo_price,
          sort_order: bi.sort_order,
          name: prod.name,
          list_price: prod.price,
          image_url: prod.image_url,
          sizes: prod.sizes,
          stock: prod.stock,
          category: prod.category,
          active: prod.active,
        };
      });
    items.sort((a, b) => a.sort_order - b.sort_order);
    return { rows: items, rowCount: items.length };
  }

  if (lowerSql.startsWith('delete from promo_banner_items where banner_id=$1')) {
    const before = data.promo_banner_items.length;
    data.promo_banner_items = data.promo_banner_items.filter((bi) => bi.banner_id !== params[0]);
    saveMemoryDbToFile();
    return { rows: [], rowCount: before - data.promo_banner_items.length };
  }

  if (lowerSql.startsWith('insert into promo_banner_items')) {
    const id = uuid();
    const item = {
      id,
      banner_id: params[0],
      product_id: params[1],
      promo_price: Number(params[2]) || 0,
      sort_order: Number(params[3]) || 0,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    data.promo_banner_items.push(item);
    saveMemoryDbToFile();
    return { rows: [{ ...item }], rowCount: 1 };
  }

  if (lowerSql.startsWith('insert into promo_banners')) {
    const id = uuid();
    const now = nowIso();
    const banner = {
      id,
      title: params[0],
      subtitle: params[1] || null,
      cta_text: params[2] || 'VER LAS PROMOS',
      link: params[3] || '#promos',
      image_url: params[4] || null,
      active: params[5] !== false,
      banner_type: params[6] || 'oferta',
      start_date: params[7] || now,
      end_date: params[8] || null,
      sort_order: Number(params[9]) || 0,
      short_description: params[10] || null,
      description: params[11] || null,
      terms_and_conditions: params[12] || null,
      discount_type: params[13] || 'override_products',
      discount_value: Number(params[14]) || 0,
      badge_label: params[15] || null,
      badge_color: params[16] || null,
      featured: params[17] === true,
      created_at: now,
      updated_at: now,
    };
    data.promo_banners.unshift(banner);
    saveMemoryDbToFile();
    return { rows: [{ ...banner }], rowCount: 1 };
  }

  if (lowerSql.startsWith('update promo_banners')) {
    if (lowerSql.includes('active=not active')) {
      const b = data.promo_banners.find((x) => x.id === params[0]);
      if (b) {
        b.active = !b.active;
        b.updated_at = nowIso();
        saveMemoryDbToFile();
        return { rows: [{ id: b.id, active: b.active, updated_at: b.updated_at }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    const id = params[params.length - 1];
    const b = data.promo_banners.find((x) => x.id === id);
    if (!b) return { rows: [], rowCount: 0 };
    b.title = params[0];
    b.subtitle = params[1] || null;
    b.cta_text = params[2] || null;
    b.link = params[3] || null;
    b.image_url = params[4] || null;
    b.active = params[5] !== false;
    b.banner_type = params[6] || 'oferta';
    b.start_date = params[7] || b.start_date;
    b.end_date = params[8] || null;
    b.sort_order = Number(params[9]) || 0;
    b.short_description = params[10] || null;
    b.description = params[11] || null;
    b.terms_and_conditions = params[12] || null;
    b.discount_type = params[13] || 'override_products';
    b.discount_value = Number(params[14]) || 0;
    b.badge_label = params[15] || null;
    b.badge_color = params[16] || null;
    b.featured = params[17] === true;
    b.updated_at = nowIso();
    saveMemoryDbToFile();
    return { rows: [{ ...b }], rowCount: 1 };
  }

  if (lowerSql.startsWith('delete from promo_banners where id=$1')) {
    const idx = data.promo_banners.findIndex((b) => b.id === params[0]);
    if (idx >= 0) {
      data.promo_banners.splice(idx, 1);
      data.promo_banner_items = data.promo_banner_items.filter((bi) => bi.banner_id !== params[0]);
      saveMemoryDbToFile();
      return { rows: [{ id: params[0] }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // 5. PROMOTIONS & PRODUCTS
  if (lowerSql.includes('from promotions') && lowerSql.includes('count(*)')) {
    return { rows: [{ count: data.promotions.length }], rowCount: 1 };
  }

  if (lowerSql.startsWith('select') && lowerSql.includes('from promotions') && lowerSql.includes('where id=$1')) {
    const p = data.promotions.find((x) => x.id === params[0]);
    return { rows: p ? [{ ...p }] : [], rowCount: p ? 1 : 0 };
  }

  if (lowerSql.startsWith('select') && lowerSql.includes('from promotions')) {
    let promos = [...data.promotions];
    if (lowerSql.includes('active=true')) {
      promos = promos.filter((p) => p.active);
    }
    promos.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.sort_order - b.sort_order;
    });
    const limit = Number(params[0]) || 50;
    const sliced = promos.slice(0, limit);
    return { rows: sliced.map((p) => ({ ...p })), rowCount: sliced.length };
  }

  if (lowerSql.includes('from promotion_products pp') && lowerSql.includes('join products p')) {
    const promoId = params[0];
    const items = data.promotion_products
      .filter((pp) => pp.promotion_id === promoId && pp.active)
      .map((pp) => {
        const prod = data.products.find((p) => p.id === pp.product_id) || {};
        return {
          id: pp.id,
          promotion_id: pp.promotion_id,
          product_id: pp.product_id,
          name: prod.name,
          price: prod.price,
          image_url: prod.image_url,
          category: prod.category,
          stock: prod.stock,
          sizes: prod.sizes,
          active: prod.active,
          override_price: pp.override_price,
          discount_percentage: pp.discount_percentage,
          product_note: pp.product_note,
          sort_order: pp.sort_order,
        };
      });
    items.sort((a, b) => a.sort_order - b.sort_order);
    return { rows: items, rowCount: items.length };
  }

  // 6. ORDERS, ORDER ITEMS, STOCK MOVEMENTS
  if (lowerSql.includes('nextval')) {
    const seq = data.orderSequence++;
    return { rows: [{ n: seq }], rowCount: 1 };
  }

  if (lowerSql.includes('from orders') && lowerSql.includes('count(*)')) {
    return { rows: [{ count: data.orders.length }], rowCount: 1 };
  }

  if (lowerSql.startsWith('select') && lowerSql.includes('from orders') && lowerSql.includes('where id=$1')) {
    const order = data.orders.find((o) => o.id === params[0]);
    return { rows: order ? [{ ...order }] : [], rowCount: order ? 1 : 0 };
  }

  if (lowerSql.startsWith('select') && lowerSql.includes('from orders') && lowerSql.includes('order by created_at desc')) {
    const limit = Number(params[0]) || 50;
    const offset = Number(params[1]) || 0;
    const sorted = [...data.orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const sliced = sorted.slice(offset, offset + limit);
    return { rows: sliced.map((o) => ({ ...o })), rowCount: sliced.length };
  }

  if (lowerSql.startsWith('select') && lowerSql.includes('from order_items where order_id=$1')) {
    const items = data.order_items.filter((oi) => oi.order_id === params[0]);
    return { rows: items.map((i) => ({ ...i })), rowCount: items.length };
  }

  if (lowerSql.startsWith('insert into orders')) {
    const id = uuid();
    const now = nowIso();
    let orderNum = params[0];
    let offset = 0;
    if (!orderNum || !String(orderNum).startsWith('NL-')) {
      orderNum = `NL-${String(data.orderSequence++).padStart(4, '0')}`;
    } else {
      offset = 1;
    }

    const newOrder = {
      id,
      order_number: orderNum,
      customer_name: params[offset] || 'Cliente',
      customer_email: params[offset + 1] || 'cliente@narel.local',
      customer_phone: params[offset + 2] || '',
      shipping_method: params[offset + 3] || 'retiro',
      shipping_address: params[offset + 4] || null,
      shipping_city: params[offset + 5] || null,
      shipping_postal_code: params[offset + 6] || null,
      notes: params[offset + 7] || null,
      payment_method: params[offset + 8] || 'transferencia',
      status: 'pendiente',
      payment_status: 'pendiente',
      mp_external_reference: params[offset + 9] || null,
      mp_idempotency_key: params[offset + 10] || null,
      subtotal: Number(params[offset + 11]) || 0,
      shipping_cost: 0,
      total: Number(params[offset + 11]) || 0,
      created_at: now,
      updated_at: now,
    };
    data.orders.unshift(newOrder);
    saveMemoryDbToFile();
    return { rows: [{ ...newOrder }], rowCount: 1 };
  }

  if (lowerSql.startsWith('insert into order_items')) {
    const id = uuid();
    const item = {
      id,
      order_id: params[0],
      product_id: params[1],
      product_name: params[2],
      product_image_url: params[3] || null,
      unit_price: Number(params[4]) || 0,
      quantity: Number(params[5]) || 1,
      size: params[6] || null,
      line_total: Number(params[7]) || 0,
      created_at: nowIso(),
    };
    data.order_items.push(item);
    saveMemoryDbToFile();
    return { rows: [{ ...item }], rowCount: 1 };
  }

  if (lowerSql.startsWith('insert into stock_movements')) {
    const movement = {
      id: uuid(),
      product_id: params[0],
      order_id: params[1],
      movement_type: params[2],
      quantity_delta: params[3],
      stock_before: params[4],
      stock_after: params[5],
      reason: params[6] || null,
      created_at: nowIso(),
    };
    data.stock_movements.push(movement);
    saveMemoryDbToFile();
    return { rows: [{ ...movement }], rowCount: 1 };
  }

  if (lowerSql.startsWith('update orders')) {
    const id = params[params.length - 1];
    const order = data.orders.find((o) => o.id === id);
    if (order) {
      if (params[0]) order.status = params[0];
      if (params[1]) order.payment_status = params[1];
      order.updated_at = nowIso();
      saveMemoryDbToFile();
      return { rows: [{ ...order }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // Default fallback for unhandled queries
  return { rows: [], rowCount: 0 };
}

module.exports = {
  initMemoryDb,
  executeMemoryQuery,
  data,
};
