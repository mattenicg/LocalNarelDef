(function () {
  'use strict';

  // mercadoPagoCardBrick brick integration
  const STORAGE_KEY = 'narel_cart_v1';
  const state = {
    items: loadCart(),
    submitting: false,
    cardPaymentIdempotencyKey: null,
    cardPaymentEl: null,
    publicConfig: {
      PAYMENT_PROVIDER: 'manual',
      MERCADO_PAGO_ENABLED: false,
      MERCADO_PAGO_PUBLIC_KEY: '',
      MERCADO_PAGO_LOCALE: 'es-AR',
      ORDER_WHATSAPP_NUMBER: '',
      ORDER_PICKUP_ADDRESS: 'San Martín 2029',
      ORDER_SHIPPING_NOTE: 'Costo de envío a coordinar por WhatsApp.',
    },
  };

  // El nodo vacío se guarda en memoria: renderCart() limpia el contenedor con
  // innerHTML y el elemento original desaparece del DOM en el primer render.
  let cartEmptyNode = null;

  const get = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const formatCurrency = (value) => {
    const num = Number(value) || 0;
    if (Math.abs(num % 1) > 0.001) {
      return '$ ' + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return '$ ' + Math.round(num).toLocaleString('es-AR');
  };
  const formatPhone = (value) => String(value || '').replace(/\D/g, '');

  function createIdempotencyKey() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `narel-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

  async function loadPublicConfig() {
    try {
      const response = await fetch('/api/config/public', { credentials: 'same-origin', cache: 'no-store' });
      const json = await response.json();
      if (json && json.ok) state.publicConfig = { ...state.publicConfig, ...json };
    } catch (_error) {
      // El checkout sigue intentando mostrar la pasarela aunque la config opcional no responda.
    }
  }

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.map(normalizeItem).filter((item) => item.id && item.qty > 0);
    } catch (_error) {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch (_error) {
      // El carrito sigue funcionando en memoria si el navegador bloquea storage.
    }
  }

  function getEmptyNode() {
    if (!cartEmptyNode) cartEmptyNode = get('cartEmpty');
    return cartEmptyNode;
  }

  function normalizeItem(item) {
    const rawStock = item && item.stock;
    const stock = rawStock === null || rawStock === undefined || rawStock === '' ? null : Number(rawStock);
    const id = String(item && (item.id || item.product_id) || '');
    const bannerId = String(item && (item.banner_id || item.bannerId) || '').trim();
    const listPrice = Number(item && (item.list_price || item.listPrice)) || 0;
    const price = Math.max(0, Number(item && item.price) || 0);
    const promoType = String(item && (item.promo_type || item.promoType) || '').toLowerCase();
    return {
      key: bannerId ? `${bannerId}::${id}` : id,
      id,
      banner_id: bannerId,
      promo_type: promoType === 'combo' ? 'combo' : promoType === 'oferta' ? 'oferta' : '',
      promo_label: String(item && (item.promo_label || item.promoLabel) || '').trim().slice(0, 20),
      name: String(item && item.name || 'Producto'),
      price,
      list_price: listPrice > price ? listPrice : 0,
      image: String(item && (item.image || item.image_url) || ''),
      sizes: String(item && item.sizes || '').trim(),
      stock: Number.isFinite(stock) ? Math.max(0, stock) : null,
      qty: Math.max(1, Math.min(99, Number(item && (item.qty || item.quantity)) || 1)),
      size: String(item && item.size || '').trim().slice(0, 40),
      direct_purchase: !!(item && (item.direct_purchase === true || item.direct_purchase === 1 || item.direct_purchase === 'true' || item.directPurchase)),
      direct_discount_percent: item && item.direct_discount_percent !== undefined && item.direct_discount_percent !== null ? Number(item.direct_discount_percent) : 25,
      direct_discount_text: (item && (item.direct_discount_text || item.directDiscountText)) || 'con transferencia',
      direct_custom_transfer_price: item && item.direct_custom_transfer_price !== undefined && item.direct_custom_transfer_price !== null && Number(item.direct_custom_transfer_price) > 0 ? Number(item.direct_custom_transfer_price) : null,
      direct_transfer_price: item && item.direct_transfer_price !== undefined && item.direct_transfer_price !== null && Number(item.direct_transfer_price) > 0 ? Number(item.direct_transfer_price) : null,
      direct_installments_count: item && item.direct_installments_count ? Number(item.direct_installments_count) : 6,
      direct_installments_text: (item && (item.direct_installments_text || item.directInstallmentsText)) || 'sin interés',
      direct_show_promo_badge: item && item.direct_show_promo_badge !== undefined ? Boolean(item.direct_show_promo_badge) : true,
      direct_promo_badge_text: (item && item.direct_promo_badge_text) || 'PROMO ACTIVA',
      allowed_payment_methods: (item && (item.allowed_payment_methods || item.allowedPaymentMethods)) || null,
      allowed_installments: (item && (item.allowed_installments || item.allowedInstallments)) || null,
    };
  }

  function getItemTransferPrice(item) {
    if (!item) return 0;
    if (item.direct_custom_transfer_price !== null && item.direct_custom_transfer_price !== undefined && Number(item.direct_custom_transfer_price) > 0) {
      return Number(item.direct_custom_transfer_price);
    }
    if (item.direct_transfer_price !== null && item.direct_transfer_price !== undefined && Number(item.direct_transfer_price) > 0) {
      return Number(item.direct_transfer_price);
    }
    const discountPercent = item.direct_discount_percent !== null && item.direct_discount_percent !== undefined ? Number(item.direct_discount_percent) : 25;
    if (discountPercent > 0) {
      return Math.round(item.price * (1 - (discountPercent / 100)) * 100) / 100;
    }
    return item.price;
  }

  function totalQuantity() {
    return state.items.reduce((sum, item) => sum + item.qty, 0);
  }

  function totalPrice(method) {
    const effectiveMethod = method || state.selectedPaymentMethod || 'tarjeta';
    return state.items.reduce((sum, item) => {
      let p = item.price;
      if (effectiveMethod === 'transferencia' && (item.direct_purchase || state.isDirectPurchase || item.direct_discount_percent !== undefined)) {
        p = getItemTransferPrice(item);
      }
      return sum + item.qty * p;
    }, 0);
  }

  function replaceWithFreshElement(id) {
    const original = get(id);
    if (!original) return null;
    const fresh = original.cloneNode(true);
    original.replaceWith(fresh);
    return fresh;
  }

  function setCartOpen(open) {
    const overlay = get('cartOverlay');
    const panel = get('cartPanel');
    if (!overlay || !panel) return;
    overlay.classList.toggle('open', open);
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (!open) get('openCartBtn')?.focus({ preventScroll: true });
  }

  async function setPaymentOpen(open) {
    const modal = get('paymentModal');
    if (!modal) return;
    modal.classList.toggle('open', open);
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (!open) {
      if (state.cardPaymentEl && typeof state.cardPaymentEl.unmount === 'function') {
        try { await state.cardPaymentEl.unmount(); } catch (_error) { /* ya desmontado */ }
      }
      state.cardPaymentEl = null;
      return;
    }
    setTimeout(() => get('checkoutName')?.focus(), 50);
  }

  function renderCart() {
    const container = get('cartItems');
    const count = get('cartCount');
    const total = get('cartTotal');
    const checkoutButton = get('checkoutBtn');
    if (!container) return;

    if (count) count.textContent = String(totalQuantity());
    if (total) total.textContent = formatCurrency(totalPrice());
    if (checkoutButton) checkoutButton.disabled = state.items.length === 0;
    container.innerHTML = '';

    if (!state.items.length) {
      const empty = getEmptyNode();
      if (empty) {
        container.appendChild(empty);
        empty.style.display = '';
      }
      renderCartCrossSell([]);
      return;
    }

    state.items.forEach((item) => {
      const sizeText = item.size ? ` · Talle ${escapeHtml(item.size)}` : '';
      const sizeOptions = String(item.sizes || '').split(/\s*[-|/,]\s*/).map((size) => size.trim()).filter(Boolean);
      const sizeControl = sizeOptions.length
        ? `<label class="cart-size">TALLE<select data-shop-size="${escapeHtml(item.key)}" aria-label="Talle de ${escapeHtml(item.name)}"><option value="">Elegir</option>${sizeOptions.map((size) => `<option value="${escapeHtml(size)}" ${item.size === size ? 'selected' : ''}>${escapeHtml(size)}</option>`).join('')}</select></label>`
        : '';
      const image = item.image
        ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy">`
        : escapeHtml(item.id.slice(0, 2).toUpperCase());
      const promoTag = item.promo_label
        ? `<span class="cart-item-tag">${escapeHtml(item.promo_label)}</span>`
        : '';
      const priceLine = item.list_price
        ? `<s>${formatCurrency(item.list_price)}</s> <b>${formatCurrency(item.price)}</b>${sizeText}`
        : `${formatCurrency(item.price)}${sizeText}`;
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div class="cart-item-img">${image}</div>
        <div class="cart-item-info">
          <h4>${escapeHtml(item.name)}${promoTag}</h4>
          <small>${priceLine}</small>
          ${sizeControl}
          <div class="qty" aria-label="Cantidad de ${escapeHtml(item.name)}">
            <button type="button" data-shop-dec="${escapeHtml(item.key)}" aria-label="Disminuir cantidad">−</button>
            <span aria-live="polite">${item.qty}</span>
            <button type="button" data-shop-inc="${escapeHtml(item.key)}" aria-label="Aumentar cantidad">+</button>
          </div>
        </div>
        <div class="cart-item-right">
          <span class="cart-item-price">${formatCurrency(item.qty * item.price)}</span>
          <button type="button" class="remove-item" data-shop-rm="${escapeHtml(item.key)}" title="Quitar ${escapeHtml(item.name)}" aria-label="Quitar ${escapeHtml(item.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>`;
      container.appendChild(row);
    });

    renderCartCrossSell(state.items);
  }

  function guessProductCategory(name, desc) {
    const s = (String(name || '') + ' ' + String(desc || '')).toLowerCase();
    if (/(pantalon|jogger|baggy|cargo|wide|chino|bermuda|short)/i.test(s)) return 'pantalones';
    if (/(campera|chaqueta|parka|camperita|puffer|rompeviento)/i.test(s)) return 'camperas';
    if (/(buzo|hoodie|sudadera|canguro|crewneck)/i.test(s)) return 'buzos';
    if (/(remera|tee|t-shirt|playera|musculosa|top)/i.test(s)) return 'remeras';
    if (/(accesorio|gorra|cap|bufanda|cinturon|media|medias|mochila|llavero|piluso|cadena|collar|anillo|reloj|riñonera|bolso|beanie)/i.test(s)) return 'accesorios';
    const m = /\[CAT:\s*([a-z_]+)\]/i.exec(String(desc || ''));
    if (m) return m[1].toLowerCase();
    return 'remeras';
  }

  function getCartCrossSellItems(cartItems, maxCount = 3) {
    const catalog = window.__CATALOG_PRODUCTS__ || [];
    if (!catalog.length || !cartItems.length) return [];

    const inCartIds = new Set(cartItems.map((it) => String(it.id)));
    const inCartCategories = new Set(
      cartItems.map((it) => String(it.category || guessProductCategory(it.name, it.description) || '').toLowerCase())
    );

    const targetComplementary = new Set();
    inCartCategories.forEach((cat) => {
      if (['remeras', 'buzos', 'camperas'].includes(cat)) {
        targetComplementary.add('pantalones');
        targetComplementary.add('accesorios');
      } else if (cat === 'pantalones') {
        targetComplementary.add('remeras');
        targetComplementary.add('buzos');
        targetComplementary.add('camperas');
        targetComplementary.add('accesorios');
      } else if (cat === 'accesorios') {
        targetComplementary.add('remeras');
        targetComplementary.add('buzos');
        targetComplementary.add('pantalones');
      }
    });

    const candidates = catalog.filter((p) => {
      if (!p || !p.id) return false;
      if (p.direct_purchase) return false;
      if (inCartIds.has(String(p.id))) return false;
      const stock = p.stock == null ? 99 : Number(p.stock);
      return stock > 0;
    });

    const scored = candidates.map((p) => {
      const pCat = String(p.category || guessProductCategory(p.name, p.description) || 'remeras').toLowerCase();
      let score = 0;
      if (targetComplementary.has(pCat)) score += 10;
      if (!inCartCategories.has(pCat)) score += 5;
      if (p.featured) score += 3;
      if (p.image_url) score += 2;
      return { product: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxCount).map((s) => s.product);
  }

  function renderCartCrossSell(cartItems) {
    const csRoot = get('cartCrossSell');
    const csItems = get('cartCrossSellItems');
    if (!csRoot || !csItems) return;

    if (!cartItems || !cartItems.length || cartItems.some((it) => it.direct_purchase)) {
      csRoot.style.display = 'none';
      csItems.innerHTML = '';
      return;
    }

    const recs = getCartCrossSellItems(cartItems, 3);
    if (!recs.length) {
      csRoot.style.display = 'none';
      csItems.innerHTML = '';
      return;
    }

    csRoot.style.display = 'block';
    csItems.innerHTML = recs.map((p) => {
      const img = p.image_url
        ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy">`
        : `<span>${escapeHtml(String(p.id || 'NL').slice(0, 2).toUpperCase())}</span>`;
      return `
        <div class="cart-cs-item" data-rec-id="${escapeHtml(p.id)}">
          <div class="cart-cs-img">${img}</div>
          <div class="cart-cs-info">
            <h5 title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h5>
            <span class="cart-cs-price">${formatCurrency(p.price)}</span>
          </div>
          <button type="button" class="cart-cs-add-btn" data-cart-cs-add="${escapeHtml(p.id)}" aria-label="Agregar ${escapeHtml(p.name)} al carrito">
            + AGREGAR
          </button>
        </div>`;
    }).join('');

    csItems.querySelectorAll('[data-cart-cs-add]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.cartCsAdd;
        const prod = (window.__CATALOG_PRODUCTS__ || []).find((p) => String(p.id) === String(id));
        if (!prod) return;
        addToCart({
          id: prod.id,
          name: prod.name,
          price: Number(prod.price) || 0,
          image: prod.image_url || '',
          stock: Number(prod.stock) || 0,
          sizes: prod.sizes || '',
          qty: 1,
        });
      });
    });
  }

  function pushItem(item) {
    const normalized = normalizeItem(item);
    if (!normalized.id || normalized.stock === 0) return false;

    // Si es compra directa, no puede agregarse al carrito junto a otros productos
    if (normalized.direct_purchase) {
      startDirectCheckout(normalized);
      return false;
    }

    // Si el carrito tenía un producto de compra directa, se limpia para no mezclar
    if (state.items.some((it) => it.direct_purchase)) {
      state.items = [];
    }

    const current = state.items.find((entry) => entry.key === normalized.key);
    if (current) {
      const requested = current.qty + normalized.qty;
      current.qty = current.stock == null ? Math.min(99, requested) : Math.min(current.stock, requested);
      current.stock = normalized.stock == null ? current.stock : normalized.stock;
      current.price = normalized.price;
      current.list_price = normalized.list_price;
      current.promo_label = normalized.promo_label;
      current.promo_type = normalized.promo_type;
    } else {
      state.items.push(normalized);
    }
    return true;
  }

  function startDirectCheckout(item) {
    const normalized = normalizeItem(item);
    if (!normalized.id || normalized.stock === 0) return false;
    normalized.direct_purchase = true;
    // La compra directa es de ese único producto y cantidad (aislado)
    state.items = [normalized];
    state.isDirectPurchase = true;
    saveCart();
    renderCart();
    setCartOpen(false);
    setPaymentOpen(true);
    renderCheckout();
    return true;
  }

  function addToCart(item) {
    if (!pushItem(item)) return;
    saveCart();
    renderCart();
    setCartOpen(true);
  }

  // Los combos se agregan completos en una sola operación para no re-renderizar
  // el carrito una vez por producto.
  function addManyToCart(items) {
    const added = (Array.isArray(items) ? items : []).map(pushItem).filter(Boolean).length;
    if (!added) return 0;
    saveCart();
    renderCart();
    setCartOpen(true);
    return added;
  }

  function comboSiblings(item) {
    return item.promo_type === 'combo' && item.banner_id
      ? state.items.filter((entry) => entry.banner_id === item.banner_id && entry.promo_type === 'combo')
      : [item];
  }

  function updateQuantity(key, delta) {
    const item = state.items.find((entry) => entry.key === key);
    if (!item) return;
    // En un combo todos los productos se compran juntos: la cantidad se sincroniza.
    const group = comboSiblings(item);
    const nextQty = item.qty + delta;
    if (nextQty <= 0) {
      removeFromCart(key);
      return;
    }
    group.forEach((entry) => {
      const max = entry.stock == null ? 99 : entry.stock;
      entry.qty = Math.max(1, Math.min(max, nextQty));
    });
    saveCart();
    renderCart();
  }

  function removeFromCart(key) {
    const item = state.items.find((entry) => entry.key === key);
    if (!item) return;
    state.items = item.promo_type === 'combo' && item.banner_id
      ? state.items.filter((entry) => !(entry.banner_id === item.banner_id && entry.promo_type === 'combo'))
      : state.items.filter((entry) => entry.key !== key);
    saveCart();
    renderCart();
  }

  function showAlert(message) {
    const alert = get('checkoutAlert');
    if (!alert) return;
    alert.textContent = message;
    alert.classList.add('show');
  }

  function clearAlert() {
    const alert = get('checkoutAlert');
    if (!alert) return;
    alert.textContent = '';
    alert.classList.remove('show');
  }

  function fieldError(field, message) {
    const inputIds = {
      name: 'checkoutName',
      email: 'checkoutEmail',
      phone: 'checkoutPhone',
      address: 'checkoutAddress',
      city: 'checkoutCity',
      postal_code: 'checkoutPostalCode',
    };
    const input = get(inputIds[field] || '');
    const error = get(`checkoutError-${field}`);
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (error) error.textContent = message || '';
    return !message;
  }

  function validateCheckoutField(field, form) {
    const value = String(form.elements[field]?.value || '').trim();
    let message = '';
    if (field === 'name' && value.length < 2) message = 'Ingresá tu nombre y apellido.';
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = 'Ingresá un email válido.';
    if (field === 'phone' && formatPhone(value).length < 6) message = 'Ingresá un teléfono válido.';
    if (field === 'address' && get('shippingMethodEnvio')?.checked && value.length < 3) message = 'Ingresá la dirección de entrega.';
    if (field === 'city' && get('shippingMethodEnvio')?.checked && value.length < 2) message = 'Ingresá la ciudad.';
    if (field === 'postal_code' && get('shippingMethodEnvio')?.checked && value.length < 3) message = 'Ingresá el código postal.';
    return fieldError(field, message);
  }

  function validateCheckoutForm(form) {
    const fields = ['name', 'email', 'phone'];
    if (get('shippingMethodEnvio')?.checked) fields.push('address', 'city', 'postal_code');
    return fields.map((field) => validateCheckoutField(field, form)).every(Boolean);
  }

  function mercadoPagoEnabled() {
    return Boolean(state.publicConfig.MERCADO_PAGO_ENABLED && state.publicConfig.MERCADO_PAGO_PUBLIC_KEY);
  }

  function cartHasMissingSizes() {
    return state.items.some((item) => {
      const options = String(item.sizes || '').split(/\s*[-|/,]\s*/).map((size) => size.trim()).filter(Boolean);
      return options.length > 0 && !item.size;
    });
  }

  function promoSavings() {
    return state.items.reduce((sum, item) => sum + (item.list_price ? (item.list_price - item.price) * item.qty : 0), 0);
  }

  function isSantaFeCapital(cityName) {
    if (!cityName) return false;
    const clean = String(cityName).trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return /^(santa\s*fe(\s*capital|\s*de\s*la\s*vera\s*cruz)?|sta\.?\s*fe(\s*capital)?)$/i.test(clean) ||
           clean.includes('santa fe capital') ||
           clean === 'santa fe';
  }

  function isEligibleForFreeShipping(subtotal, city, isDelivery) {
    if (!isDelivery) return false;
    return (Number(subtotal) || 0) >= 40000 && isSantaFeCapital(city);
  }

  function renderCheckoutSummary() {
    const summary = get('checkoutSummary');
    if (!summary) return;
    const directItem = state.items.find((i) => i.direct_purchase) || (state.isDirectPurchase ? state.items[0] : null);
    const method = state.selectedPaymentMethod || 'tarjeta';
    const baseSubtotal = state.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const effectiveTotal = totalPrice(method);
    const savings = promoSavings();
    const isDelivery = get('shippingMethodEnvio')?.checked;
    const cityInput = get('checkoutCity');
    const city = cityInput ? cityInput.value : '';
    const eligible = isEligibleForFreeShipping(effectiveTotal, city, isDelivery);
    const isSfe = isSantaFeCapital(city);

    let discountRows = '';
    if (savings > 0) {
      discountRows += `<div class="row"><span>Descuento promos</span><strong>- ${formatCurrency(savings)}</strong></div>`;
    }
    if (method === 'transferencia') {
      let totalTransferDiscount = 0;
      state.items.forEach(it => {
        const disc = (it.price - getItemTransferPrice(it)) * it.qty;
        if (disc > 0) totalTransferDiscount += disc;
      });
      if (totalTransferDiscount > 0) {
        discountRows += `<div class="row" style="color:#f43f5e;font-weight:700;"><span>Descuento Transferencia</span><strong>- ${formatCurrency(totalTransferDiscount)}</strong></div>`;
      }
    }

    let shippingRowHtml = '';
    let promoCalloutHtml = '';

    if (!isDelivery) {
      shippingRowHtml = `<div class="row"><span>Envío</span><strong>Sin costo (Retiro en local)</strong></div>`;
    } else if (eligible) {
      shippingRowHtml = `<div class="row"><span>Envío</span><strong style="color:var(--yellow);">¡GRATIS! (Promo Santa Fe Capital)</strong></div>`;
      promoCalloutHtml = `
        <div class="checkout-promo-box checkout-promo-box-applied">
          <div class="checkout-promo-box-head">
            <span class="checkout-promo-badge">⚡ ENVÍO GRATIS APLICADO</span>
            <small>EXCLUSIVA SANTA FE CAPITAL</small>
          </div>
          <p>Tu compra es a partir de $40.000 con entrega en Santa Fe Capital. ¡El costo de envío es $0!</p>
        </div>`;
    } else if (isSfe && effectiveTotal < 40000) {
      shippingRowHtml = `<div class="row"><span>Envío</span><strong>A coordinar</strong></div>`;
      const diff = 40000 - effectiveTotal;
      promoCalloutHtml = `
        <div class="checkout-promo-box">
          <div class="checkout-promo-box-head">
            <span class="checkout-promo-badge">PROMOCIÓN DISPONIBLE</span>
            <small>SANTA FE CAPITAL</small>
          </div>
          <p>Agregá <strong>${formatCurrency(diff)}</strong> para acceder al <strong>ENVÍO GRATIS</strong> exclusivo para Santa Fe Capital.</p>
        </div>`;
    } else {
      shippingRowHtml = `<div class="row"><span>Envío</span><strong>A coordinar</strong></div>`;
    }

    const methodLabel = method === 'transferencia' ? 'TRANSFERENCIA' : method === 'efectivo' ? 'EFECTIVO' : 'TARJETA';
    const totalColor = method === 'transferencia' ? '#f43f5e' : 'var(--yellow,#fff)';

    summary.innerHTML = `
      <div class="row"><span>Productos</span><strong>${totalQuantity()}</strong></div>
      <div class="row"><span>Subtotal base</span><strong>${formatCurrency(baseSubtotal)}</strong></div>
      ${discountRows}
      ${shippingRowHtml}
      ${promoCalloutHtml}
      <div class="row total-row"><span>TOTAL A PAGAR (${methodLabel})</span><strong style="font-size:19px;color:${totalColor};">${formatCurrency(effectiveTotal)}</strong></div>`;
  }

  function buildOrderPayload(form) {
    const method = state.selectedPaymentMethod || 'tarjeta';
    const subtotal = totalPrice(method);
    const city = form.elements.city?.value.trim() || '';
    const isDelivery = form.elements.shipping_method?.value === 'envio';
    const isFree = isEligibleForFreeShipping(subtotal, city, isDelivery);
    let notes = form.elements.notes?.value.trim() || '';
    if (isFree) {
      notes = (notes ? notes + ' | ' : '') + 'PROMO ENVÍO GRATIS: Santa Fe Capital ($40.000+)';
    }

    return {
      items: state.items.map((item) => ({
        product_id: item.id,
        quantity: item.qty,
        size: item.size || null,
        banner_id: item.banner_id || null,
      })),
      customer: {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        phone: form.elements.phone.value.trim(),
      },
      shipping: {
        method: form.elements.shipping_method.value,
        address: form.elements.address?.value.trim() || '',
        city: city,
        postal_code: form.elements.postal_code?.value.trim() || '',
        notes: notes,
      },
      payment_method: method === 'transferencia' ? 'transferencia' : method === 'efectivo' ? 'efectivo' : 'mercadopago_card',
    };
  }

  // handleSubmit local: recibe el pago ya procesado o tokenizado por narel-card-payment
  // (nunca el número de tarjeta ni el CVV) y lo envía al endpoint existente.
  async function processCardPayment(form, detail) {
    if (state.submitting) throw new Error('Ya estamos procesando tu pago.');
    clearAlert();
    if (!validateCheckoutForm(form)) {
      showAlert('Revisá los datos del comprador y la entrega antes de pagar.');
      throw new Error('Datos del comprador incompletos.');
    }
    if (!state.items.length) {
      showAlert('El carrito está vacío.');
      throw new Error('El carrito está vacío.');
    }
    if (cartHasMissingSizes()) {
      showAlert('Elegí un talle para cada producto que lo requiere.');
      throw new Error('Falta elegir un talle.');
    }

    const cardFormData = (detail && detail.payment) ? detail.payment : (detail || {});
    const selectedMethod = (detail && detail.selectedPaymentMethod) || (cardFormData && cardFormData.payment_type_id) || 'credit_card';

    // Si el usuario abona mediante la billetera de Mercado Pago ("wallet_purchase")
    if (selectedMethod === 'wallet_purchase') {
      state.items = [];
      saveCart();
      renderCart();
      return { ok: true };
    }

    state.submitting = true;
    const payload = buildOrderPayload(form);
    const payment = {
      token: cardFormData.token || undefined,
      issuer_id: cardFormData.issuer_id || undefined,
      payment_method_id: cardFormData.payment_method_id,
      installments: Number(cardFormData.installments) || 1,
      payer: cardFormData.payer?.identification
        ? { identification: cardFormData.payer.identification, email: cardFormData.payer?.email }
        : (cardFormData.payer || undefined),
    };

    try {
      const response = await fetch('/api/payments/mercadopago/process', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Idempotency-Key': state.cardPaymentIdempotencyKey || (state.cardPaymentIdempotencyKey = createIdempotencyKey()),
        },
        body: JSON.stringify({ ...payload, payment }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) {
        const error = new Error(json.message || 'Mercado Pago no aprobó el pago.');
        error.status = response.status;
        error.data = json.data;
        throw error;
      }

      const order = json.data || {};
      const status = String(order.mp_status || '').toLowerCase();
      if (status === 'approved' || order.payment_status === 'pagado') {
        state.items = [];
        saveCart();
        renderCart();
        renderConfirmation(order, 'approved');
      } else {
        renderConfirmation(order, 'pending');
      }
      return json;
    } catch (error) {
      if (error.status === 402) state.cardPaymentIdempotencyKey = null;
      showAlert(error.message || 'No se pudo procesar el pago. Probá nuevamente.');
      throw error;
    } finally {
      state.submitting = false;
    }
  }

  async function processManualPayment(form, method) {
    if (state.submitting) return;
    clearAlert();
    if (!validateCheckoutForm(form)) {
      showAlert('Revisá los datos del comprador y la entrega antes de continuar.');
      return;
    }
    if (!state.items.length) {
      showAlert('El carrito está vacío.');
      return;
    }
    if (cartHasMissingSizes()) {
      showAlert('Elegí un talle para cada producto que lo requiere.');
      return;
    }

    state.submitting = true;
    const btn = method === 'transferencia' ? get('btnConfirmTransfer') : get('btnConfirmEfectivo');
    const oldText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'PROCESANDO PEDIDO…';
    }

    try {
      const payload = buildOrderPayload(form);
      payload.payment_method = method;

      const response = await fetch('/api/orders', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) {
        throw new Error(json.message || 'No pudimos registrar tu pedido. Probá nuevamente.');
      }

      const order = json.data || {};
      state.items = [];
      saveCart();
      renderCart();
      renderConfirmation(order, 'pending');
    } catch (error) {
      showAlert(error.message || 'No se pudo crear el pedido.');
    } finally {
      state.submitting = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  }

  async function processWalletPayment(form) {
    if (state.submitting) return;
    clearAlert();
    if (!validateCheckoutForm(form)) {
      showAlert('Revisá los datos del comprador y la entrega antes de continuar.');
      return;
    }
    if (!state.items.length) {
      showAlert('El carrito está vacío.');
      return;
    }
    if (cartHasMissingSizes()) {
      showAlert('Elegí un talle para cada producto que lo requiere.');
      return;
    }

    state.submitting = true;
    const btn = get('btnPayWithWallet');
    const oldText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'CONECTANDO CON MERCADO PAGO…';
    }

    try {
      const payload = buildOrderPayload(form);
      const prefResponse = await fetch('/api/payments/mercadopago/preference', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          items: payload.items.map((i) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
          customer: payload.customer,
          shipping: payload.shipping,
          total: Number(totalPrice().toFixed(2)),
        }),
      });
      const prefJson = await prefResponse.json().catch(() => ({}));
      if (!prefResponse.ok || !prefJson.ok || !prefJson.data?.init_point) {
        throw new Error(prefJson.message || 'No se pudo generar la orden de pago en Mercado Pago.');
      }

      // Redirigir a la pantalla de pago de Mercado Pago
      window.location.href = prefJson.data.init_point;
    } catch (error) {
      showAlert(error.message || 'Error al conectar con Mercado Pago.');
    } finally {
      state.submitting = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  }

  function renderConfirmation(order, paymentState = 'approved') {
    const paymentContent = get('paymentContent');
    if (!paymentContent) return;
    const pending = paymentState === 'pending';
    const ticketUrl = order.ticket_url || order.mp_ticket_url;
    const ticketAction = ticketUrl
      ? `<a class="btn confirm" href="${escapeHtml(ticketUrl)}" target="_blank" rel="noopener">DESCARGAR / VER CUPÓN DE PAGO</a>`
      : '';
    const whatsapp = order.whatsapp_url
      ? `<a class="btn confirm" href="${escapeHtml(order.whatsapp_url)}" target="_blank" rel="noopener">ENVIAR DETALLE POR WHATSAPP</a>`
      : '';
    let title = pending ? 'PEDIDO PENDIENTE' : 'PEDIDO RECIBIDO';
    let copy = pending
      ? 'Recibimos tu pedido, pero Mercado Pago todavía no confirmó el cobro. No vuelvas a pagar; te avisaremos cuando cambie el estado.'
      : 'El pago fue aprobado por Mercado Pago y registramos tu pedido correctamente.';

    if (order.payment_method === 'transferencia') {
      title = 'PEDIDO RECIBIDO - TRANSFERENCIA';
      copy = 'Tu pedido fue registrado. Realizá la transferencia a los datos bancarios y envianos el comprobante por WhatsApp para despachar tus prendas.';
    } else if (order.payment_method === 'efectivo') {
      title = 'PEDIDO RECIBIDO - EFECTIVO';
      copy = 'Tus prendas y talles ya están reservados. Te esperamos en nuestro local físico de LA PEATONAL San Martín 2029 para abonar al retirar.';
    } else if (ticketUrl) {
      title = 'CUPÓN DE PAGO GENERADO';
      copy = 'Tu pedido fue registrado. Podés pagar con tu cupón en cualquier sucursal antes del vencimiento.';
    }

    paymentContent.innerHTML = `
      <div class="checkout-confirmation ${pending ? 'is-pending' : ''}">
        <div class="success-circle" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div>
        <h3>${title}</h3>
        <div class="order-code">${escapeHtml(order.order_number || 'NL')}</div>
        <p>${copy} El total es <strong style="color:var(--yellow)">${formatCurrency(order.total)}</strong>.</p>
        <div class="confirmation-actions">
          ${ticketAction}
          ${whatsapp}
          <button type="button" class="btn ghost" id="closeSuccessBtn">CERRAR</button>
        </div>
      </div>`;
    state.cardPaymentEl = null;
    get('closeSuccessBtn')?.addEventListener('click', () => setPaymentOpen(false));
  }

  const processOfflineOrder = processManualPayment;

  function renderCheckout() {
    const paymentContent = get('paymentContent');
    if (!paymentContent) return;
    clearAlert();
    state.cardPaymentIdempotencyKey = null;
    state.cardPaymentEl = null;

    const directItem = state.items.find((i) => i.direct_purchase) || (state.isDirectPurchase ? state.items[0] : null);
    const configuredItem = state.items.find((i) => (i.allowed_payment_methods && i.allowed_payment_methods.length) || (i.direct_discount_percent !== undefined && i.direct_discount_percent !== null)) || directItem || state.items[0];
    let allowedMethods = ['tarjeta_debito', 'tarjeta_credito', 'transferencia', 'efectivo'];
    let allowedInstallments = [1, 3, 6];

    if (configuredItem) {
      if (configuredItem.allowed_payment_methods) {
        allowedMethods = Array.isArray(configuredItem.allowed_payment_methods)
          ? configuredItem.allowed_payment_methods
          : (typeof configuredItem.allowed_payment_methods === 'string'
              ? (configuredItem.allowed_payment_methods.startsWith('[') ? JSON.parse(configuredItem.allowed_payment_methods) : configuredItem.allowed_payment_methods.split(','))
              : allowedMethods);
      }
      if (configuredItem.allowed_installments) {
        allowedInstallments = Array.isArray(configuredItem.allowed_installments)
          ? configuredItem.allowed_installments.map(Number)
          : (typeof configuredItem.allowed_installments === 'string'
              ? (configuredItem.allowed_installments.startsWith('[') ? JSON.parse(configuredItem.allowed_installments).map(Number) : configuredItem.allowed_installments.split(',').map(Number))
              : allowedInstallments);
      }
    }

    const allowsCard = allowedMethods.includes('tarjeta_credito') || allowedMethods.includes('tarjeta_debito');
    const allowsTransfer = allowedMethods.includes('transferencia');
    const allowsCash = allowedMethods.includes('efectivo');

    // Inicializar método de pago por defecto si no es válido
    if (!state.selectedPaymentMethod || (state.selectedPaymentMethod === 'tarjeta' && !allowsCard) || (state.selectedPaymentMethod === 'transferencia' && !allowsTransfer) || (state.selectedPaymentMethod === 'efectivo' && !allowsCash)) {
      if (allowsTransfer) {
        state.selectedPaymentMethod = 'transferencia';
      } else if (allowsCard) {
        state.selectedPaymentMethod = 'tarjeta';
      } else if (allowsCash) {
        state.selectedPaymentMethod = 'efectivo';
      }
    }

    let directCalloutHTML = '';
    if (directItem) {
      directCalloutHTML = `
        <div class="checkout-direct-callout" style="margin-bottom:14px;padding:12px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.18);border-radius:6px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--yellow,#fff);margin-bottom:4px;">⚡ COMPRA DIRECTA</div>
          <p style="font-size:12px;color:#fff;margin:0;line-height:1.4;">Estás adquiriendo individualmente <strong>${escapeHtml(directItem.name)}</strong>${directItem.size ? ' (Talle ' + escapeHtml(directItem.size) + ')' : ''}.</p>
        </div>`;
    }

    let paymentSubtitle = 'Cuotas disponibles según tarjeta y banco · Procesado de forma segura por Mercado Pago';
    if (configuredItem && allowedInstallments.length) {
      paymentSubtitle = `Cuotas habilitadas por el comercio: ${allowedInstallments.join(', ')} cuota${allowedInstallments.length > 1 ? 's' : ''} · Mercado Pago`;
    }

    const cardPriceFormatted = formatCurrency(totalPrice('tarjeta'));
    const transferPriceFormatted = formatCurrency(totalPrice('transferencia'));
    const cashPriceFormatted = formatCurrency(totalPrice('efectivo'));

    const tabCardActive = state.selectedPaymentMethod === 'tarjeta';
    const tabTransferActive = state.selectedPaymentMethod === 'transferencia';
    const tabCashActive = state.selectedPaymentMethod === 'efectivo';

    // Tabs selector
    const tabsHTML = `
      <div class="checkout-pay-tabs" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px;margin-bottom:16px;">
        ${allowsTransfer ? `
          <button type="button" class="btn-pay-tab ${tabTransferActive ? 'active' : ''}" data-method="transferencia" style="padding:10px 8px;border-radius:8px;border:2px solid ${tabTransferActive ? '#f43f5e' : '#333'};background:${tabTransferActive ? 'rgba(244,63,94,0.15)' : '#18181b'};color:${tabTransferActive ? '#fff' : '#aaa'};cursor:pointer;text-align:center;transition:all .15s ease;">
            <div style="font-size:12px;font-weight:800;color:${tabTransferActive ? '#fff' : '#eee'};">🏦 TRANSFERENCIA</div>
            <div style="font-size:13px;font-weight:800;color:#f43f5e;margin-top:2px;">${transferPriceFormatted}</div>
            ${configuredItem && configuredItem.direct_discount_percent > 0 ? `<div style="font-size:10px;font-weight:700;color:#f43f5e;margin-top:1px;">${configuredItem.direct_discount_percent}% OFF</div>` : ''}
          </button>
        ` : ''}
        ${allowsCard ? `
          <button type="button" class="btn-pay-tab ${tabCardActive ? 'active' : ''}" data-method="tarjeta" style="padding:10px 8px;border-radius:8px;border:2px solid ${tabCardActive ? '#fff' : '#333'};background:${tabCardActive ? '#27272a' : '#18181b'};color:${tabCardActive ? '#fff' : '#aaa'};cursor:pointer;text-align:center;transition:all .15s ease;">
            <div style="font-size:12px;font-weight:800;color:${tabCardActive ? '#fff' : '#eee'};">💳 TARJETA</div>
            <div style="font-size:13px;font-weight:800;color:#fff;margin-top:2px;">${cardPriceFormatted}</div>
            ${configuredItem && configuredItem.direct_installments_count ? `<div style="font-size:10px;color:#9ca3af;margin-top:1px;">${configuredItem.direct_installments_count} cuotas</div>` : ''}
          </button>
        ` : ''}
        ${allowsCash ? `
          <button type="button" class="btn-pay-tab ${tabCashActive ? 'active' : ''}" data-method="efectivo" style="padding:10px 8px;border-radius:8px;border:2px solid ${tabCashActive ? '#fff' : '#333'};background:${tabCashActive ? '#27272a' : '#18181b'};color:${tabCashActive ? '#fff' : '#aaa'};cursor:pointer;text-align:center;transition:all .15s ease;">
            <div style="font-size:12px;font-weight:800;color:${tabCashActive ? '#fff' : '#eee'};">💵 EFECTIVO</div>
            <div style="font-size:13px;font-weight:800;color:#fff;margin-top:2px;">${cashPriceFormatted}</div>
            <div style="font-size:10px;color:#9ca3af;margin-top:1px;">en local</div>
          </button>
        ` : ''}
      </div>`;

    let cardSectionHTML = '';
    if (allowsCard) {
      const cardGatewayMarkup = mercadoPagoEnabled()
        ? '<div class="checkout-card-mount" id="checkoutCardMount"></div>'
        : '<p class="checkout-instructions">El pago con tarjeta no está disponible en este momento. Podés optar por los otros medios habilitados.</p>';

      cardSectionHTML = `
        <div id="payMethodCardBox" class="checkout-pay-box ${tabCardActive ? '' : 'checkout-hidden'}" style="${tabCardActive ? '' : 'display:none;'}">
          <div class="checkout-payment-info-banner" aria-label="Información de medios de pago soportados">
            <div class="checkout-payment-info-text">
              <span class="checkout-payment-info-title">Pagá con tarjeta ${allowedMethods.includes('tarjeta_credito') ? 'de crédito' : ''}${allowedMethods.includes('tarjeta_credito') && allowedMethods.includes('tarjeta_debito') ? ', débito y prepagas' : allowedMethods.includes('tarjeta_debito') ? 'de débito y prepagas' : ''}</span>
              <span class="checkout-payment-info-subtitle">${escapeHtml(paymentSubtitle)}</span>
            </div>
            <div class="checkout-payment-badges" aria-hidden="true">
              <span class="checkout-pay-badge"><svg class="badge-icon" viewBox="0 0 32 20"><rect width="32" height="20" rx="3" fill="#1A1F71"/><text x="16" y="14" fill="#FFFFFF" font-family="sans-serif" font-size="9" font-weight="800" text-anchor="middle" font-style="italic">VISA</text></svg><span>Visa</span></span>
              <span class="checkout-pay-badge"><svg class="badge-icon" viewBox="0 0 32 20"><rect width="32" height="20" rx="3" fill="#1e1e1e"/><circle cx="12" cy="10" r="6" fill="#EB001B"/><circle cx="20" cy="10" r="6" fill="#F79E1B" fill-opacity="0.85"/></svg><span>Mastercard</span></span>
              <span class="checkout-pay-badge"><svg class="badge-icon" viewBox="0 0 32 20"><rect width="32" height="20" rx="3" fill="#006FCF"/><text x="16" y="13" fill="#FFFFFF" font-family="sans-serif" font-size="7" font-weight="900" text-anchor="middle">AMEX</text></svg><span>American Express</span></span>
              <span class="checkout-pay-badge"><svg class="badge-icon" viewBox="0 0 32 20"><rect width="32" height="20" rx="3" fill="#009EE3"/><path d="M10 11.5c.8-1 2.2-1 3 0l3 3c.8 1 2.2 1 3 0l3-3" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Mercado Pago</span></span>
            </div>
          </div>
          ${cardGatewayMarkup}
        </div>`;
    }

    let offlineSectionHTML = '';
    if (allowsTransfer) {
      offlineSectionHTML += `
        <div id="payMethodTransferBox" class="checkout-pay-box ${tabTransferActive ? '' : 'checkout-hidden'}" style="padding:14px;background:rgba(244,63,94,0.06);border:1px solid rgba(244,63,94,0.3);border-radius:8px;margin-top:6px;${tabTransferActive ? '' : 'display:none;'}">
          <div style="font-weight:800;font-size:13px;letter-spacing:.04em;color:#f43f5e;margin-bottom:4px;">TRANSFERENCIA BANCARIA DIRECTA</div>
          <p style="font-size:12.5px;color:#eee;margin-bottom:8px;line-height:1.4;">Abonás el precio promocional con descuento de <strong style="color:#f43f5e;">${transferPriceFormatted}</strong>. Al confirmar te enviamos los datos de CBU/Alias y verificamos tu pago inmediatamente por WhatsApp.</p>
          <button type="button" class="btn" id="btnConfirmTransfer" style="width:100%;font-weight:800;background:#f43f5e;border-color:#f43f5e;color:#fff;padding:12px;font-size:13.5px;letter-spacing:.02em;">CONFIRMAR POR TRANSFERENCIA (${transferPriceFormatted})</button>
        </div>`;
    }
    if (allowsCash) {
      offlineSectionHTML += `
        <div id="payMethodCashBox" class="checkout-pay-box ${tabCashActive ? '' : 'checkout-hidden'}" style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.18);border-radius:8px;margin-top:6px;${tabCashActive ? '' : 'display:none;'}">
          <div style="font-weight:800;font-size:13px;letter-spacing:.04em;color:#fff;margin-bottom:4px;">PAGO EN EFECTIVO EN EL LOCAL</div>
          <p style="font-size:12.5px;color:#aaa;margin-bottom:8px;line-height:1.4;">Total a abonar: <strong style="color:#fff;">${cashPriceFormatted}</strong>. Reservá tu prenda y aboná en efectivo al retirar en LA PEATONAL San Martín 2029.</p>
          <button type="button" class="btn" id="btnConfirmEfectivo" style="width:100%;font-weight:800;padding:12px;font-size:13.5px;">CONFIRMAR PAGO EN EFECTIVO (${cashPriceFormatted})</button>
        </div>`;
    }

    paymentContent.innerHTML = `
      <form id="checkoutForm" class="checkout-form" novalidate>
        <div id="checkoutAlert" class="checkout-alert" role="alert" aria-live="assertive"></div>
        ${directCalloutHTML}
        <fieldset class="checkout-fieldset">
          <legend>DATOS DEL COMPRADOR</legend>
          <div class="checkout-grid">
            <div class="checkout-field full">
              <label for="checkoutName">Nombre y apellido <span>*</span></label>
              <input id="checkoutName" name="name" type="text" autocomplete="name" required aria-describedby="checkoutError-name">
              <span class="checkout-error" id="checkoutError-name"></span>
            </div>
            <div class="checkout-field">
              <label for="checkoutEmail">Correo electrónico <span>*</span></label>
              <input id="checkoutEmail" name="email" type="email" autocomplete="email" required aria-describedby="checkoutError-email">
              <span class="checkout-error" id="checkoutError-email"></span>
            </div>
            <div class="checkout-field">
              <label for="checkoutPhone">Teléfono / WhatsApp <span>*</span></label>
              <input id="checkoutPhone" name="phone" type="tel" autocomplete="tel" required aria-describedby="checkoutError-phone">
              <span class="checkout-error" id="checkoutError-phone"></span>
            </div>
          </div>
        </fieldset>

        <fieldset class="checkout-fieldset">
          <legend>ENTREGA</legend>
          <div class="checkout-choice-grid">
            <label class="checkout-choice">
              <input id="shippingMethodRetiro" type="radio" name="shipping_method" value="retiro" checked>
              <span><strong>Retiro en local</strong><small data-checkout-pickup>San Martín 2029 · coordinamos por WhatsApp.</small></span>
            </label>
            <label class="checkout-choice">
              <input id="shippingMethodEnvio" type="radio" name="shipping_method" value="envio">
              <span><strong>Envío a domicilio</strong><small data-checkout-shipping-note>Costo de envío a coordinar por WhatsApp.</small></span>
            </label>
          </div>
          <div id="shippingFields" class="checkout-grid checkout-hidden" style="margin-top:14px;">
            <div class="checkout-field full">
              <label for="checkoutAddress">Dirección <span>*</span></label>
              <input id="checkoutAddress" name="address" type="text" autocomplete="street-address" aria-describedby="checkoutError-address">
              <span class="checkout-error" id="checkoutError-address"></span>
            </div>
            <div class="checkout-field">
              <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
                <label for="checkoutCity">Ciudad <span>*</span></label>
                <button type="button" id="btnSantaFeHelper" class="btn-sfe-helper" title="Seleccionar Santa Fe Capital para aplicar a la promo">Santa Fe Capital</button>
              </div>
              <input id="checkoutCity" name="city" type="text" autocomplete="address-level2" placeholder="Ej. Santa Fe Capital" aria-describedby="checkoutError-city">
              <span class="checkout-error" id="checkoutError-city"></span>
            </div>
            <div class="checkout-field">
              <label for="checkoutPostalCode">Código postal <span>*</span></label>
              <input id="checkoutPostalCode" name="postal_code" type="text" autocomplete="postal-code" aria-describedby="checkoutError-postal_code">
              <span class="checkout-error" id="checkoutError-postal_code"></span>
            </div>
          </div>
          <div class="checkout-field" style="margin-top:14px;">
            <label for="checkoutNotes">Notas del pedido (opcional)</label>
            <textarea id="checkoutNotes" name="notes" maxlength="500" placeholder="Talles, referencias o indicaciones especiales"></textarea>
          </div>
        </fieldset>

        <fieldset class="checkout-fieldset">
          <legend>MÉTODO DE PAGO</legend>
          ${tabsHTML}
          ${cardSectionHTML}
          ${offlineSectionHTML}
        </fieldset>

        <div class="checkout-summary" id="checkoutSummary"></div>
        <div class="checkout-actions checkout-actions-single">
          <button type="button" class="btn ghost" id="cancelCheckoutBtn">CANCELAR</button>
        </div>
      </form>`;

    const form = get('checkoutForm');
    const shippingFields = get('shippingFields');
    const pickupAddress = state.publicConfig.ORDER_PICKUP_ADDRESS || 'San Martín 2029';
    const shippingNote = state.publicConfig.ORDER_SHIPPING_NOTE || 'Costo de envío a coordinar por WhatsApp.';
    const pickupCopy = form.querySelector('[data-checkout-pickup]');
    const shippingCopy = form.querySelector('[data-checkout-shipping-note]');
    if (pickupCopy) pickupCopy.textContent = `${pickupAddress} · coordinamos por WhatsApp.`;
    if (shippingCopy) shippingCopy.textContent = shippingNote;

    const updateShippingCopy = () => {
      const delivery = get('shippingMethodEnvio')?.checked;
      const city = form.elements.city?.value.trim() || '';
      const subtotal = totalPrice();
      const eligible = isEligibleForFreeShipping(subtotal, city, delivery);
      const isSfe = isSantaFeCapital(city);

      if (shippingCopy) {
        if (delivery && eligible) {
          shippingCopy.innerHTML = '<strong style="color:var(--yellow)">¡ENVÍO GRATIS APLICADO!</strong> Exclusivo Santa Fe Capital.';
        } else if (delivery && isSfe && subtotal < 40000) {
          shippingCopy.innerHTML = `${shippingNote} <span style="color:var(--yellow);display:block;margin-top:2px;">(Envío gratis en compras desde $40.000)</span>`;
        } else {
          shippingCopy.textContent = shippingNote;
        }
      }
    };

    const toggleShipping = () => {
      const delivery = get('shippingMethodEnvio')?.checked;
      shippingFields?.classList.toggle('checkout-hidden', !delivery);
      ['address', 'city', 'postal_code'].forEach((field) => {
        const input = form.elements[field];
        if (input) input.required = delivery;
      });
      updateShippingCopy();
      renderCheckoutSummary();
    };

    // Control de tabs de métodos de pago
    form.querySelectorAll('.btn-pay-tab').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const method = tabBtn.dataset.method;
        if (!method) return;
        state.selectedPaymentMethod = method;

        // Actualizar estados visuales de los botones de tab
        form.querySelectorAll('.btn-pay-tab').forEach((b) => {
          const isAct = b.dataset.method === method;
          b.classList.toggle('active', isAct);
          if (b.dataset.method === 'transferencia') {
            b.style.border = isAct ? '2px solid #f43f5e' : '2px solid #333';
            b.style.background = isAct ? 'rgba(244,63,94,0.15)' : '#18181b';
            b.style.color = isAct ? '#fff' : '#aaa';
          } else {
            b.style.border = isAct ? '2px solid #fff' : '2px solid #333';
            b.style.background = isAct ? '#27272a' : '#18181b';
            b.style.color = isAct ? '#fff' : '#aaa';
          }
        });

        // Mostrar / ocultar secciones
        const cardBox = get('payMethodCardBox');
        const transferBox = get('payMethodTransferBox');
        const cashBox = get('payMethodCashBox');

        if (cardBox) {
          cardBox.style.display = method === 'tarjeta' ? '' : 'none';
          cardBox.classList.toggle('checkout-hidden', method !== 'tarjeta');
        }
        if (transferBox) {
          transferBox.style.display = method === 'transferencia' ? '' : 'none';
          transferBox.classList.toggle('checkout-hidden', method !== 'transferencia');
        }
        if (cashBox) {
          cashBox.style.display = method === 'efectivo' ? '' : 'none';
          cashBox.classList.toggle('checkout-hidden', method !== 'efectivo');
        }

        renderCheckoutSummary();
      });
    });

    form.querySelectorAll('input[name="shipping_method"]').forEach((input) => input.addEventListener('change', toggleShipping));
    ['name', 'email', 'phone', 'address', 'city', 'postal_code'].forEach((field) => {
      form.elements[field]?.addEventListener('blur', () => validateCheckoutField(field, form));
    });

    form.elements.city?.addEventListener('input', () => {
      updateShippingCopy();
      renderCheckoutSummary();
    });

    get('btnSantaFeHelper')?.addEventListener('click', () => {
      if (form.elements.city) {
        form.elements.city.value = 'Santa Fe Capital';
        validateCheckoutField('city', form);
        updateShippingCopy();
        renderCheckoutSummary();
      }
    });

    get('btnConfirmTransfer')?.addEventListener('click', () => processManualPayment(form, 'transferencia'));
    get('btnConfirmEfectivo')?.addEventListener('click', () => processManualPayment(form, 'efectivo'));

    get('cancelCheckoutBtn')?.addEventListener('click', () => setPaymentOpen(false));
    toggleShipping();
    renderCheckoutSummary();
    if (allowsCard) {
      mountCardPaymentGateway(form);
    }
  }

  async function mountCardPaymentGateway(form) {
    const mount = get('checkoutCardMount');
    if (!mount) return;
    mount.innerHTML = '';

    const cardEl = document.createElement('narel-card-payment');
    cardEl.setAttribute('amount', String(Number(totalPrice().toFixed(2))));
    cardEl.setAttribute('locale', state.publicConfig.MERCADO_PAGO_LOCALE || 'es-AR');
    cardEl.setAttribute('max-installments', '24');

    const configuredItem = state.items.find((i) => i.direct_purchase) || state.items.find((i) => i.allowed_payment_methods || i.allowed_installments) || (state.isDirectPurchase ? state.items[0] : null);
    if (configuredItem) {
      if (configuredItem.allowed_payment_methods) {
        const methodsStr = Array.isArray(configuredItem.allowed_payment_methods)
          ? configuredItem.allowed_payment_methods.join(',')
          : String(configuredItem.allowed_payment_methods);
        cardEl.setAttribute('allowed-methods', methodsStr);
      }
      if (configuredItem.allowed_installments) {
        const instList = Array.isArray(configuredItem.allowed_installments)
          ? configuredItem.allowed_installments
          : (typeof configuredItem.allowed_installments === 'string'
              ? (configuredItem.allowed_installments.startsWith('[') ? JSON.parse(configuredItem.allowed_installments) : configuredItem.allowed_installments.split(','))
              : [1, 3, 6]);
        cardEl.setAttribute('allowed-installments', instList.join(','));
        const maxI = Math.max(...instList.map(Number).filter(n => Number.isInteger(n) && n > 0));
        if (Number.isFinite(maxI) && maxI > 0) {
          cardEl.setAttribute('max-installments', String(maxI));
        }
      }
    }

    // Intentamos obtener una preferencia para habilitar Dinero en cuenta / Billetera MP
    try {
      const prefResponse = await fetch('/api/payments/mercadopago/preference', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: state.items.map((i) => ({
            product_id: i.id,
            product_name: i.name,
            quantity: i.qty,
            unit_price: i.price,
          })),
          total: Number(totalPrice().toFixed(2)),
        }),
      });
      if (prefResponse.ok) {
        const prefData = await prefResponse.json();
        if (prefData.data && prefData.data.preference_id) {
          cardEl.setAttribute('preference-id', prefData.data.preference_id);
        }
      }
    } catch (_e) {
      // Si la preferencia falla o no hay credenciales en local, continúa con tarjetas y tickets
    }

    // Gate: si el comprador o el carrito no están listos, cancelamos el envío del Brick
    cardEl.addEventListener('narel-payment-submit', (event) => {
      if (state.submitting) { event.preventDefault(); return; }
      if (!validateCheckoutForm(form)) {
        event.preventDefault();
        showAlert('Revisá los datos del comprador y la entrega antes de pagar.');
        return;
      }
      if (!state.items.length) {
        event.preventDefault();
        showAlert('El carrito está vacío.');
        return;
      }
      if (cartHasMissingSizes()) {
        event.preventDefault();
        showAlert('Elegí un talle para cada producto que lo requiere.');
        return;
      }
    });

    cardEl.onSubmit = (detail) => processCardPayment(form, detail);
    cardEl.onError = (error) => {
      console.warn('[narel-card-payment]', error);
    };

    mount.appendChild(cardEl);
    state.cardPaymentEl = cardEl;
  }

  async function init() {
    getEmptyNode();
    await loadPublicConfig();
    const openCartButton = replaceWithFreshElement('openCartBtn');
    const closeCartButton = replaceWithFreshElement('closeCartBtn');
    const closePaymentButton = replaceWithFreshElement('closePaymentBtn');
    const checkoutButton = replaceWithFreshElement('checkoutBtn');
    const overlay = get('cartOverlay');
    const itemsContainer = get('cartItems');
    const paymentModal = get('paymentModal');

    openCartButton?.addEventListener('click', () => setCartOpen(true));
    closeCartButton?.addEventListener('click', () => setCartOpen(false));
    closePaymentButton?.addEventListener('click', () => setPaymentOpen(false));
    checkoutButton?.addEventListener('click', () => {
      if (!state.items.length) return;
      setCartOpen(false);
      setPaymentOpen(true);
      renderCheckout();
    });
    overlay?.addEventListener('click', () => setCartOpen(false));
    paymentModal?.addEventListener('click', (event) => {
      if (event.target === paymentModal) setPaymentOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (paymentModal?.classList.contains('open')) setPaymentOpen(false);
      else if (get('cartPanel')?.classList.contains('open')) setCartOpen(false);
    });
    itemsContainer?.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-shop-rm]');
      if (remove) {
        removeFromCart(remove.dataset.shopRm);
        return;
      }
      const decrease = event.target.closest('[data-shop-dec]');
      if (decrease) {
        updateQuantity(decrease.dataset.shopDec, -1);
        return;
      }
      const increase = event.target.closest('[data-shop-inc]');
      if (increase) updateQuantity(increase.dataset.shopInc, 1);
    });
    itemsContainer?.addEventListener('change', (event) => {
      const select = event.target.closest('[data-shop-size]');
      if (!select) return;
      const item = state.items.find((entry) => entry.key === select.dataset.shopSize);
      if (!item) return;
      item.size = select.value;
      saveCart();
      renderCart();
    });

    window.shop = Object.assign(window.shop || {}, {
      addToCart,
      addManyToCart,
      startDirectCheckout,
      renderCart,
      openCart: () => setCartOpen(true),
      openCheckout: () => {
        if (!state.items.length) return;
        setCartOpen(false);
        setPaymentOpen(true);
        renderCheckout();
      },
    });
    window.addEventListener('catalog:loaded', () => {
      renderCart();
    });
    renderCart();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
