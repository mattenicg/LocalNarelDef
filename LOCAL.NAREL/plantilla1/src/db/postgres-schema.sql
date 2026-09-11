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

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  sizes TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'remeras',
  active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured DESC);

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
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('transferencia','efectivo','whatsapp','mercadopago_card'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_external_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_idempotency_key TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_status_detail TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_payment_method_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_installments INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_mp_payment_id ON orders(mp_payment_id) WHERE mp_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_mp_external_reference ON orders(mp_external_reference) WHERE mp_external_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_mp_idempotency_key ON orders(mp_idempotency_key) WHERE mp_idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
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
