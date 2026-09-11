(function () {
  'use strict';

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
  const formatCurrency = (value) => '$ ' + Math.round(Number(value) || 0).toLocaleString('es-AR');
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
      // Un mismo producto puede estar en el catálogo y en una promo con otro precio:
      // la clave compuesta mantiene esas líneas separadas en el carrito.
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
    };
  }

  function totalQuantity() {
    return state.items.reduce((sum, item) => sum + item.qty, 0);
  }

  function totalPrice() {
    return state.items.reduce((sum, item) => sum + item.qty * item.price, 0);
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
  }

  function pushItem(item) {
    const normalized = normalizeItem(item);
    if (!normalized.id || normalized.stock === 0) return false;
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

  function renderCheckoutSummary() {
    const summary = get('checkoutSummary');
    if (!summary) return;
    const savings = promoSavings();
    const savingsRow = savings > 0
      ? `<div class="row"><span>Descuento promos</span><strong>- ${formatCurrency(savings)}</strong></div>`
      : '';
    summary.innerHTML = `
      <div class="row"><span>Productos</span><strong>${totalQuantity()}</strong></div>
      <div class="row"><span>Subtotal</span><strong>${formatCurrency(totalPrice())}</strong></div>
      ${savingsRow}
      <div class="row"><span>Envío</span><strong>A coordinar</strong></div>
      <div class="row total-row"><span>TOTAL A PAGAR</span><strong>${formatCurrency(totalPrice())}</strong></div>`;
  }

  function buildOrderPayload(form) {
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
        city: form.elements.city?.value.trim() || '',
        postal_code: form.elements.postal_code?.value.trim() || '',
        notes: form.elements.notes?.value.trim() || '',
      },
      payment_method: 'mercadopago_card',
    };
  }

  // handleSubmit local: recibe el pago ya tokenizado por narel-card-payment
  // (nunca el número de tarjeta ni el CVV) y lo envía al endpoint existente.
  async function processCardPayment(form, cardFormData) {
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

    state.submitting = true;
    const payload = buildOrderPayload(form);
    const payment = {
      token: cardFormData.token,
      issuer_id: cardFormData.issuer_id,
      payment_method_id: cardFormData.payment_method_id,
      installments: Number(cardFormData.installments) || 1,
      payer: cardFormData.payer?.identification ? { identification: cardFormData.payer.identification } : undefined,
    };

    try {
      const response = await fetch('/api/payments/mercadopago/card', {
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

  function renderConfirmation(order, paymentState = 'approved') {
    const paymentContent = get('paymentContent');
    if (!paymentContent) return;
    const pending = paymentState === 'pending';
    const whatsapp = order.whatsapp_url
      ? `<a class="btn confirm" href="${escapeHtml(order.whatsapp_url)}" target="_blank" rel="noopener">ENVIAR DETALLE POR WHATSAPP</a>`
      : '';
    const title = pending ? 'PEDIDO PENDIENTE' : 'PEDIDO RECIBIDO';
    const copy = pending
      ? 'Recibimos tu pedido, pero Mercado Pago todavía no confirmó el cobro. No vuelvas a pagar; te avisaremos cuando cambie el estado.'
      : 'El pago fue aprobado por Mercado Pago y registramos tu pedido correctamente.';

    // Al reemplazar este HTML, narel-card-payment (si estaba montado) se
    // desconecta del DOM y limpia su propio Brick automáticamente.
    paymentContent.innerHTML = `
      <div class="checkout-confirmation ${pending ? 'is-pending' : ''}">
        <div class="success-circle" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div>
        <h3>${title}</h3>
        <div class="order-code">${escapeHtml(order.order_number || 'NL')}</div>
        <p>${copy} El total es <strong style="color:var(--yellow)">${formatCurrency(order.total)}</strong>.</p>
        <div class="confirmation-actions">
          ${whatsapp}
          <button type="button" class="btn ghost" id="closeSuccessBtn">CERRAR</button>
        </div>
      </div>`;
    state.cardPaymentEl = null;
    get('closeSuccessBtn')?.addEventListener('click', () => setPaymentOpen(false));
  }

  function renderCheckout() {
    const paymentContent = get('paymentContent');
    if (!paymentContent) return;
    clearAlert();
    state.cardPaymentIdempotencyKey = null;
    state.cardPaymentEl = null;

    const cardGatewayMarkup = mercadoPagoEnabled()
      ? '<div class="checkout-card-mount" id="checkoutCardMount"></div>'
      : '<p class="checkout-instructions">El pago con tarjeta no está disponible en este momento. Volvé a intentarlo más tarde.</p>';

    paymentContent.innerHTML = `
      <form id="checkoutForm" class="checkout-form" novalidate>
        <div id="checkoutAlert" class="checkout-alert" role="alert" aria-live="assertive"></div>
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
              <label for="checkoutCity">Ciudad <span>*</span></label>
              <input id="checkoutCity" name="city" type="text" autocomplete="address-level2" aria-describedby="checkoutError-city">
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
          ${cardGatewayMarkup}
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

    const toggleShipping = () => {
      const delivery = get('shippingMethodEnvio')?.checked;
      shippingFields?.classList.toggle('checkout-hidden', !delivery);
      ['address', 'city', 'postal_code'].forEach((field) => {
        const input = form.elements[field];
        if (input) input.required = delivery;
      });
    };

    form.querySelectorAll('input[name="shipping_method"]').forEach((input) => input.addEventListener('change', toggleShipping));
    ['name', 'email', 'phone', 'address', 'city', 'postal_code'].forEach((field) => {
      form.elements[field]?.addEventListener('blur', () => validateCheckoutField(field, form));
    });
    get('cancelCheckoutBtn')?.addEventListener('click', () => setPaymentOpen(false));
    toggleShipping();
    renderCheckoutSummary();
    mountCardPaymentGateway(form);
  }

  function mountCardPaymentGateway(form) {
    const mount = get('checkoutCardMount');
    if (!mount) return;

    const cardEl = document.createElement('narel-card-payment');
    cardEl.setAttribute('amount', String(Number(totalPrice().toFixed(2))));
    cardEl.setAttribute('locale', state.publicConfig.MERCADO_PAGO_LOCALE || 'es-AR');
    cardEl.setAttribute('max-installments', '1');

    // Gate: si el comprador o el carrito no están listos, cancelamos el
    // envío del Brick antes de tokenizar (handleSubmit local pedido).
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
      }
    });

    cardEl.onSubmit = (detail) => processCardPayment(form, detail.payment);
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
      renderCart,
      openCart: () => setCartOpen(true),
    });
    renderCart();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
