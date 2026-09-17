CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  reset_token_hash TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  invalidated_at TIMESTAMPTZ,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_address INET
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);

-- Tablas dinámicas de Categorías y Subcategorías
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subtitle TEXT NOT NULL DEFAULT 'CARGADO DESDE PANEL ADMIN',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS subtitle TEXT NOT NULL DEFAULT 'CARGADO DESDE PANEL ADMIN';

INSERT INTO categories (name, slug, subtitle, sort_order) VALUES
  ('Pantalones', 'pantalones', 'CARGADO DESDE PANEL ADMIN', 1),
  ('Camperas', 'camperas', 'CARGADO DESDE PANEL ADMIN', 2),
  ('Buzos', 'buzos', 'CARGADO DESDE PANEL ADMIN', 3),
  ('Remeras', 'remeras', 'CARGADO DESDE PANEL ADMIN', 4),
  ('Accesorios', 'accesorios', 'CARGADO DESDE PANEL ADMIN', 5)
ON CONFLICT (slug) DO UPDATE SET subtitle = EXCLUDED.subtitle WHERE categories.subtitle IS NULL;

CREATE TABLE IF NOT EXISTS subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  category_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_category_subcategory_slug UNIQUE (category_slug, slug)
);
CREATE INDEX IF NOT EXISTS idx_subcategories_category_slug ON subcategories(category_slug);
CREATE INDEX IF NOT EXISTS idx_subcategories_slug ON subcategories(slug);

INSERT INTO subcategories (category_id, category_slug, name, slug)
SELECT c.id, c.slug, s.name, s.slug
FROM categories c
CROSS JOIN (VALUES
  ('pantalones', 'Cargo', 'cargo'),
  ('pantalones', 'Jeans', 'jeans'),
  ('pantalones', 'Joggers', 'joggers'),
  ('camperas', 'Bomber', 'bomber'),
  ('camperas', 'Puffer', 'puffer'),
  ('buzos', 'Hoodies', 'hoodies'),
  ('remeras', 'Oversized', 'oversized'),
  ('accesorios', 'Gorras', 'gorras')
) AS s(cat_slug, name, slug)
WHERE c.slug = s.cat_slug
ON CONFLICT (category_slug, slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  sizes TEXT NOT NULL DEFAULT '',
  size_guide TEXT DEFAULT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  category TEXT NOT NULL DEFAULT 'remeras',
  subcategory TEXT DEFAULT NULL,
  subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  direct_purchase BOOLEAN NOT NULL DEFAULT false,
  allowed_payment_methods JSONB NOT NULL DEFAULT '["tarjeta_credito","tarjeta_debito","transferencia","efectivo"]'::jsonb,
  allowed_installments JSONB NOT NULL DEFAULT '[1,3,6]'::jsonb,
  direct_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 25.00,
  direct_discount_text VARCHAR(100) NOT NULL DEFAULT 'con transferencia',
  direct_show_promo_badge BOOLEAN NOT NULL DEFAULT true,
  direct_promo_badge_text VARCHAR(60) NOT NULL DEFAULT 'PROMO ACTIVA',
  direct_installments_count INTEGER NOT NULL DEFAULT 6,
  direct_installments_text VARCHAR(60) NOT NULL DEFAULT 'sin interés',
  direct_custom_transfer_price NUMERIC(12,2) DEFAULT NULL,
  direct_transfer_text VARCHAR(60) NOT NULL DEFAULT 'con Transferencia',
  cash_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  cash_discount_text VARCHAR(100) NOT NULL DEFAULT 'en efectivo',
  cash_custom_price NUMERIC(12,2) DEFAULT NULL,
  cash_text VARCHAR(60) NOT NULL DEFAULT 'en Efectivo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS direct_purchase BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS allowed_payment_methods JSONB NOT NULL DEFAULT '["tarjeta_credito","tarjeta_debito","transferencia","efectivo"]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS allowed_installments JSONB NOT NULL DEFAULT '[1,3,6]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS direct_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 25.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS direct_discount_text VARCHAR(100) NOT NULL DEFAULT 'con transferencia';
ALTER TABLE products ADD COLUMN IF NOT EXISTS direct_show_promo_badge BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS direct_promo_badge_text VARCHAR(60) NOT NULL DEFAULT 'PROMO ACTIVA';
ALTER TABLE products ADD COLUMN IF NOT EXISTS direct_installments_count INTEGER NOT NULL DEFAULT 6;
ALTER TABLE products ADD COLUMN IF NOT EXISTS direct_installments_text VARCHAR(60) NOT NULL DEFAULT 'sin interés';
ALTER TABLE products ADD COLUMN IF NOT EXISTS direct_custom_transfer_price NUMERIC(12,2) DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS direct_transfer_text VARCHAR(60) NOT NULL DEFAULT 'con Transferencia';
ALTER TABLE products ADD COLUMN IF NOT EXISTS cash_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cash_discount_text VARCHAR(100) NOT NULL DEFAULT 'en efectivo';
ALTER TABLE products ADD COLUMN IF NOT EXISTS cash_custom_price NUMERIC(12,2) DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cash_text VARCHAR(60) NOT NULL DEFAULT 'en Efectivo';
ALTER TABLE products ADD COLUMN IF NOT EXISTS size_guide TEXT DEFAULT NULL;
UPDATE products SET images = jsonb_build_array(image_url) WHERE (images IS NULL OR images = '[]'::jsonb) AND image_url IS NOT NULL AND image_url <> '';
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_cat_subcat ON products(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured DESC);

-- ================= PRODUCT IMAGES (Relación 1 a N) =================
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT,
  alt_text VARCHAR(255) DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_position ON product_images(product_id, position ASC);

-- Migración segura de imágenes existentes de products a product_images si no existen
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_images') THEN
    INSERT INTO product_images (product_id, image_url, storage_path, position)
    SELECT p.id, img.url, img.url, (img.pos - 1)::integer
    FROM products p,
    LATERAL jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(p.images) = 'array' AND jsonb_array_length(p.images) > 0 THEN p.images
        WHEN p.image_url IS NOT NULL AND p.image_url <> '' THEN jsonb_build_array(p.image_url)
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS img(url, pos)
    WHERE NOT EXISTS (
      SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
    ) AND img.url IS NOT NULL AND img.url <> '';
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS promo_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(120) NOT NULL DEFAULT 'PROMOS EXCLUSIVAS',
  subtitle VARCHAR(280),
  cta_text VARCHAR(60) DEFAULT 'VER LAS PROMOS',
  link VARCHAR(500) DEFAULT '#pantalones',
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  end_date TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promo_banners_active ON promo_banners(active, end_date, sort_order);

-- Tipo de banner: 'oferta' (se compra cada producto por separado) o 'combo' (todos juntos)
ALTER TABLE promo_banners ADD COLUMN IF NOT EXISTS banner_type VARCHAR(10) NOT NULL DEFAULT 'oferta';
DO $$
BEGIN
  ALTER TABLE promo_banners ADD CONSTRAINT promo_banners_banner_type_check CHECK (banner_type IN ('oferta','combo'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Campos extra migrados desde el sistema de promotions (consolidado en banners)
ALTER TABLE promo_banners ADD COLUMN IF NOT EXISTS short_description VARCHAR(300);
ALTER TABLE promo_banners ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE promo_banners ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
ALTER TABLE promo_banners ADD COLUMN IF NOT EXISTS discount_type VARCHAR(30) NOT NULL DEFAULT 'override_products';
DO $$
BEGIN
  ALTER TABLE promo_banners ADD CONSTRAINT promo_banners_discount_type_check CHECK (discount_type IN ('percentage','fixed_amount','combo_price','override_products'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
ALTER TABLE promo_banners ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE promo_banners ADD COLUMN IF NOT EXISTS badge_label VARCHAR(60);
ALTER TABLE promo_banners ADD COLUMN IF NOT EXISTS badge_color VARCHAR(20);
ALTER TABLE promo_banners ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE promo_banners ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_promo_banners_featured ON promo_banners(featured);

-- Productos incluidos en un banner promocional.
-- El precio "tachado" es products.price y promo_price es el precio exclusivo de la oferta.
CREATE TABLE IF NOT EXISTS promo_banner_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_id UUID NOT NULL REFERENCES promo_banners(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  promo_price NUMERIC(12,2) NOT NULL CHECK (promo_price >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (banner_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_promo_banner_items_banner ON promo_banner_items(banner_id, sort_order);

CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(220),
  short_description VARCHAR(300),
  description TEXT,
  terms_and_conditions TEXT,
  discount_type VARCHAR(30) NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage','fixed_amount','combo_price','override_products')),
  discount_value NUMERIC(12,2) DEFAULT 0,
  banner_image_url TEXT,
  cta_text VARCHAR(80) DEFAULT 'VER PROMO',
  cta_link VARCHAR(500) DEFAULT '#promociones',
  badge_label VARCHAR(60) DEFAULT 'OFERTA',
  badge_color VARCHAR(20) DEFAULT '#ef4444',
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotions_active_dates ON promotions(active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_featured ON promotions(featured);

CREATE TABLE IF NOT EXISTS promotion_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  override_price NUMERIC(12,2),
  discount_percentage NUMERIC(5,2),
  product_note VARCHAR(300),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (promotion_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_promotion_products_promo ON promotion_products(promotion_id);

CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1;
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  shipping_method TEXT NOT NULL DEFAULT 'retiro' CHECK (shipping_method IN ('retiro','envio')),
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_postal_code TEXT,
  notes TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('transferencia','efectivo','whatsapp','mercadopago_card')),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','confirmado','preparando','enviado','entregado','cancelado')),
  payment_status TEXT NOT NULL DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente','comprobante_enviado','pagado','rechazado')),
  mp_payment_id TEXT,
  mp_external_reference TEXT,
  mp_idempotency_key TEXT,
  mp_status TEXT,
  mp_status_detail TEXT,
  mp_payment_method_id TEXT,
  mp_installments INTEGER,
  mp_updated_at TIMESTAMPTZ,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_image_url TEXT,
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  size TEXT,
  line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('order','cancel','adjustment')),
  quantity_delta INTEGER NOT NULL,
  stock_before INTEGER NOT NULL CHECK (stock_before >= 0),
  stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('transferencia','efectivo','whatsapp','mercadopago_card','mercadopago'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_external_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_idempotency_key TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_status_detail TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_payment_method_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_payment_type_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_ticket_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_installments INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_mp_payment_id ON orders(mp_payment_id) WHERE mp_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_mp_external_reference ON orders(mp_external_reference) WHERE mp_external_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_mp_idempotency_key ON orders(mp_idempotency_key) WHERE mp_idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS store_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  order_number VARCHAR(100),
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON notification_logs(created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS store_settings_updated_at ON store_settings;
CREATE TRIGGER store_settings_updated_at BEFORE UPDATE ON store_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS banners_updated_at ON promo_banners;
CREATE TRIGGER banners_updated_at BEFORE UPDATE ON promo_banners FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS promo_banner_items_updated_at ON promo_banner_items;
CREATE TRIGGER promo_banner_items_updated_at BEFORE UPDATE ON promo_banner_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS promotions_updated_at ON promotions;
CREATE TRIGGER promotions_updated_at BEFORE UPDATE ON promotions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS promotion_products_updated_at ON promotion_products;
CREATE TRIGGER promotion_products_updated_at BEFORE UPDATE ON promotion_products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ================= SYSTEM CUSTOM SIZES & VARIANT STOCK =================
CREATE TABLE IF NOT EXISTS sizes_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sizes_master_lower_name ON sizes_master (LOWER(name));

INSERT INTO sizes_master (name) VALUES 
  ('XS'), ('S'), ('M'), ('L'), ('XL'), ('XXL'), ('Único')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS product_size_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_name TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, size_name)
);

DROP TRIGGER IF EXISTS product_size_stock_updated_at ON product_size_stock;
CREATE TRIGGER product_size_stock_updated_at BEFORE UPDATE ON product_size_stock FOR EACH ROW EXECUTE FUNCTION set_updated_at();

