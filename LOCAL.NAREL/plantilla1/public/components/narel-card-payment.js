/**
 * <narel-card-payment>
 * ---------------------------------------------------------------------------
 * Componente aislado (Web Component nativo) para el panel de pago con
 * tarjeta. NO forma parte de storefrontCheckout.js ni de ningún archivo
 * global existente: es una pieza independiente que se importa una sola vez
 * y se inserta donde el host lo necesite, sin alterar rutas ni arquitectura.
 *
 * Renderiza únicamente: nombre del titular, número de tarjeta, vencimiento
 * (MM/AA) y CVV, con un estado inline y un botón de pago — usando el Card
 * Payment Brick oficial de Mercado Pago para tokenizar la tarjeta de forma
 * segura (PCI DSS). El PAN y el CVV nunca pasan por el estado ni por los
 * eventos de este componente: el Brick los captura en campos propios y
 * sólo entrega un token opaco.
 *
 * SEGURIDAD
 * ---------------------------------------------------------------------------
 * - Este archivo NUNCA debe recibir ni contener el Access Token de Mercado
 *   Pago. Sólo la Public Key llega al navegador (es pública por diseño).
 * - Si en algún momento pegaste un Access Token en el frontend o en un
 *   chat, considéralo comprometido: revocalo/rotalo desde el panel de
 *   Mercado Pago y configurá el nuevo valor únicamente en el backend
 *   (variable de entorno MERCADO_PAGO_ACCESS_TOKEN), nunca en este archivo.
 *
 * NOTA TÉCNICA IMPORTANTE
 * ---------------------------------------------------------------------------
 * El SDK de Mercado Pago monta el Brick usando `bricksBuilder.create(
 * 'cardPayment', containerId, settings)`, donde `containerId` debe ser
 * localizable por el navegador como un elemento real del documento. Por eso
 * el nodo donde se monta el Brick vive en el DOM "claro" (light DOM) del
 * propio custom element —posicionado visualmente dentro del shell mediante
 * un <slot>— mientras que la decoración (bordes, tipografía, espaciado) se
 * mantiene encapsulada en Shadow DOM y no puede filtrarse ni ser afectada
 * por el CSS global del sitio.
 * Como el Brick es PCI-compliant, sus campos internos (número y CVV) los
 * dibuja Mercado Pago; este componente sólo puede afinar su apariencia con
 * las variables de tema que el propio Brick expone (customVariables), no
 * con selectores CSS arbitrarios.
 *
 * USO MÍNIMO (no requiere build ni framework)
 * ---------------------------------------------------------------------------
 *   <script src="/components/narel-card-payment.js"></script>
 *   <narel-card-payment amount="15000" payer-email="cliente@mail.com"></narel-card-payment>
 *   <script>
 *     const el = document.querySelector('narel-card-payment');
 *     // Dejá acá tu propia integración (handleSubmit local):
 *     el.onSubmit = async ({ payment, amount }) => {
 *       // payment = { token, payment_method_id, issuer_id, installments, payer }
 *       // Armá el payload completo (items/customer/shipping) de tu checkout
 *       // y llamá a tu endpoint existente, por ejemplo:
 *       // await fetch('/api/payments/mercadopago/card', { ... body: JSON.stringify({ ...tuPedido, payment }) });
 *     };
 *   </script>
 *
 * Atributos: amount, public-key, locale, endpoint, payer-email, disabled,
 *            max-installments, idempotency-key
 * Propiedades: amount, publicKey, locale, endpoint, payerEmail, disabled,
 *              onSubmit(detail), onReady(), onError(error), buildPayload(detail)
 * Eventos: narel-payment-ready, narel-payment-processing,
 *          narel-payment-submit (cancelable), narel-payment-success,
 *          narel-payment-error
 * Métodos: reset(), unmount()
 */
(function () {
  'use strict';

  if (customElements.get('narel-card-payment')) return;

  var SDK_URL = 'https://sdk.mercadopago.com/js/v2';
  var sdkPromise = null;
  var instanceCounter = 0;

  function readHostToken(name, fallback) {
    try {
      var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return value || fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function loadMercadoPagoSdk() {
    if (window.MercadoPago) return Promise.resolve(window.MercadoPago);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + SDK_URL + '"]');
      if (existing) {
        if (window.MercadoPago) { resolve(window.MercadoPago); return; }
        existing.addEventListener('load', function () { resolve(window.MercadoPago); });
        existing.addEventListener('error', function () { reject(new Error('sdk_load_failed')); });
        return;
      }
      var script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = function () { resolve(window.MercadoPago); };
      script.onerror = function () { reject(new Error('sdk_load_failed')); };
      document.head.appendChild(script);
    });
    return sdkPromise;
  }

  var TEMPLATE = document.createElement('template');
  TEMPLATE.innerHTML =
    '<style>' +
    ':host{' +
      'display:block;' +
      'width:min(100%,520px);' +
      'box-sizing:border-box;' +
      '--ncp-bg:var(--black,#0a0a0a);' +
      '--ncp-text:var(--white,#ffffff);' +
      '--ncp-muted:var(--grey,#b0b0b0);' +
      '--ncp-border:var(--border,#2a2a2a);' +
      '--ncp-accent:var(--yellow,#ffffff);' +
      '--ncp-danger:var(--danger,#c0392b);' +
      '--ncp-success:var(--success,#2ea75b);' +
      '--ncp-focus:var(--focus-ring,rgba(255,255,255,.55));' +
      'font-family:\'Oswald\',\'Arial Narrow\',sans-serif;' +
    '}' +
    '*{box-sizing:border-box;}' +
    '.ncp-shell{' +
      'background:var(--ncp-bg);' +
      'border:1px solid var(--ncp-border);' +
      'border-radius:0;' +
      'padding:24px 26px 22px;' +
      'transition:opacity .2s;' +
    '}' +
    '.ncp-shell[aria-disabled="true"]{opacity:.5;pointer-events:none;}' +
    '.ncp-kicker{' +
      'margin:0 0 16px;' +
      'color:var(--ncp-muted);' +
      'font:600 10px \'Oswald\',sans-serif;' +
      'letter-spacing:.16em;' +
      'text-transform:uppercase;' +
    '}' +
    '.ncp-brick-mount{min-height:224px;}' +
    '.ncp-brick-mount ::slotted(.narel-card-payment-brick-container){display:block;width:100%;}' +
    '.ncp-status{' +
      'min-height:18px;' +
      'margin:14px 0 0;' +
      'color:var(--ncp-muted);' +
      'font-family:\'DM Mono\',monospace;' +
      'font-size:10px;' +
      'letter-spacing:.02em;' +
      'line-height:1.5;' +
    '}' +
    '.ncp-status[data-state="error"]{color:#ffb3b3;}' +
    '.ncp-status[data-state="success"]{color:var(--ncp-success);}' +
    '@media(max-width:600px){.ncp-shell{padding:20px;}}' +
    '</style>' +
    '<div class="ncp-shell" part="shell">' +
      '<p class="ncp-kicker" part="kicker">Datos de la tarjeta</p>' +
      '<div class="ncp-brick-mount" part="brick-mount"><slot name="brick"></slot></div>' +
      '<p class="ncp-status" part="status" role="status" aria-live="polite" data-state="idle"></p>' +
    '</div>';

  class NarelCardPayment extends HTMLElement {
    static get observedAttributes() {
      return ['amount', 'public-key', 'locale', 'endpoint', 'payer-email', 'disabled', 'max-installments'];
    }

    constructor() {
      super();
      this._shadow = this.attachShadow({ mode: 'open' });
      this._shadow.appendChild(TEMPLATE.content.cloneNode(true));
      this._shellEl = this._shadow.querySelector('.ncp-shell');
      this._statusEl = this._shadow.querySelector('.ncp-status');
      this._brickController = null;
      this._mercadoPago = null;
      this._booting = false;
      this._pendingBoot = false;
      this._destroyed = false;
      this._connected = false;
      this._lightContainer = null;
      this._instanceId = null;
      this.onSubmit = null;
      this.onReady = null;
      this.onError = null;
      this.buildPayload = null;
    }

    connectedCallback() {
      if (this.hasAttribute('access-token') || this.hasAttribute('accessToken')) {
        console.error('[narel-card-payment] Nunca pases un Access Token al frontend. Remové ese atributo; sólo la public-key es segura en el navegador.');
        this.removeAttribute('access-token');
      }
      this._destroyed = false;
      this._ensureLightContainer();
      this._applyDisabled();
      this._connected = true;
      this._boot();
    }

    disconnectedCallback() {
      this._destroyed = true;
      this._connected = false;
      this._destroyBrick();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue || !this._connected) return;
      if (name === 'amount') {
        this._updateAmount();
      } else if (name === 'public-key' || name === 'locale' || name === 'max-installments') {
        this._boot();
      } else if (name === 'disabled') {
        this._applyDisabled();
      }
    }

    get amount() { return Number(this.getAttribute('amount')) || 0; }
    set amount(value) { this.setAttribute('amount', String(value)); }

    get publicKey() { return this.getAttribute('public-key') || ''; }
    set publicKey(value) { value ? this.setAttribute('public-key', value) : this.removeAttribute('public-key'); }

    get locale() { return this.getAttribute('locale') || 'es-AR'; }
    set locale(value) { this.setAttribute('locale', value); }

    get endpoint() { return this.getAttribute('endpoint') || ''; }
    set endpoint(value) { value ? this.setAttribute('endpoint', value) : this.removeAttribute('endpoint'); }

    get payerEmail() { return this.getAttribute('payer-email') || ''; }
    set payerEmail(value) { value ? this.setAttribute('payer-email', value) : this.removeAttribute('payer-email'); }

    get disabled() { return this.hasAttribute('disabled'); }
    set disabled(value) { value ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

    _ensureLightContainer() {
      if (this._lightContainer && this._lightContainer.isConnected) return;
      if (!this._instanceId) {
        instanceCounter += 1;
        this._instanceId = 'ncp-brick-' + instanceCounter + '-' + Math.random().toString(36).slice(2, 8);
      }
      var container = document.createElement('div');
      container.id = this._instanceId;
      container.className = 'narel-card-payment-brick-container';
      container.setAttribute('slot', 'brick');
      this.appendChild(container);
      this._lightContainer = container;
    }

    _applyDisabled() {
      if (!this._shellEl) return;
      if (this.disabled) this._shellEl.setAttribute('aria-disabled', 'true');
      else this._shellEl.removeAttribute('aria-disabled');
    }

    _setStatus(message, state) {
      if (!this._statusEl) return;
      this._statusEl.textContent = message || '';
      this._statusEl.dataset.state = state || 'idle';
    }

    _resolvePublicKey() {
      var attr = this.publicKey;
      if (attr) return Promise.resolve(attr);
      return fetch('/api/config/public', { credentials: 'same-origin' })
        .then(function (response) { return response.json(); })
        .then(function (json) { return (json && json.MERCADO_PAGO_PUBLIC_KEY) || ''; })
        .catch(function () { return ''; });
    }

    _boot() {
      var self = this;
      if (self._booting) { self._pendingBoot = true; return; }
      self._booting = true;
      self._mountBrick().then(function () {
        self._booting = false;
        if (self._pendingBoot) {
          self._pendingBoot = false;
          self._boot();
        }
      });
    }

    _mountBrick() {
      var self = this;
      return self._destroyBrick().then(function () {
        if (self._destroyed) return;
        var amount = self.amount;
        if (!amount || amount <= 0) {
          self._setStatus('Configurá un monto válido para continuar.', 'error');
          return;
        }
        return self._resolvePublicKey().then(function (publicKey) {
          if (self._destroyed) return;
          if (!publicKey) {
            self._setStatus('Mercado Pago no está disponible en este momento.', 'error');
            self._dispatch('narel-payment-error', { message: 'missing_public_key' });
            return;
          }
          self._setStatus('Cargando formulario seguro…', 'loading');
          return loadMercadoPagoSdk().then(function (MercadoPagoCtor) {
            if (self._destroyed) return;
            self._mercadoPago = new MercadoPagoCtor(publicKey, { locale: self.locale });
            var bricksBuilder = self._mercadoPago.bricks();
            var maxInstallments = Number(self.getAttribute('max-installments')) || 1;
            var initialization = { amount: amount };
            if (self.payerEmail) initialization.payer = { email: self.payerEmail };
            var accentToken = readHostToken('--yellow', '#ffffff');
            var bgToken = readHostToken('--black', '#0a0a0a');
            var textToken = readHostToken('--white', '#ffffff');
            var mutedToken = readHostToken('--grey', '#b0b0b0');
            var borderToken = readHostToken('--border', '#2a2a2a');
            var settings = {
              initialization: initialization,
              customization: {
                visual: {
                  style: {
                    theme: 'dark',
                    customVariables: {
                      baseColor: accentToken,
                      textColorPrimary: textToken,
                      textColorSecondary: mutedToken,
                      formBackgroundColor: bgToken,
                      inputBackgroundColor: bgToken,
                      inputBorderColor: borderToken,
                      inputFocusedBorderColor: accentToken,
                      buttonTextColor: bgToken,
                      borderRadiusSmall: '0px',
                      borderRadiusMedium: '0px',
                      borderRadiusLarge: '0px',
                    },
                  },
                },
                paymentMethods: { maxInstallments: maxInstallments },
              },
              callbacks: {
                onReady: function () {
                  self._setStatus('Completá los datos de tu tarjeta.', 'ready');
                  if (typeof self.onReady === 'function') self.onReady();
                  self._dispatch('narel-payment-ready', {});
                },
                onSubmit: function (formData) { return self._handleSubmit(formData); },
                onError: function (error) {
                  self._setStatus('No pudimos procesar la tarjeta. Probá de nuevo.', 'error');
                  if (typeof self.onError === 'function') self.onError(error);
                  self._dispatch('narel-payment-error', { error: String((error && error.message) || error || '') });
                },
              },
            };
            return bricksBuilder.create('cardPayment', self._lightContainer.id, settings).then(function (controller) {
              self._brickController = controller;
            });
          }).catch(function () {
            self._setStatus('No pudimos cargar Mercado Pago. Probá de nuevo.', 'error');
            self._dispatch('narel-payment-error', { message: 'sdk_or_brick_failed' });
          });
        });
      });
    }

    _destroyBrick() {
      var controller = this._brickController;
      this._brickController = null;
      if (controller && typeof controller.unmount === 'function') {
        return controller.unmount().catch(function () {});
      }
      return Promise.resolve();
    }

    _updateAmount() {
      var self = this;
      var amount = self.amount;
      if (self._brickController && typeof self._brickController.update === 'function') {
        self._brickController.update({ amount: amount }).catch(function () { self._boot(); });
        return;
      }
      self._boot();
    }

    _handleSubmit(formData) {
      // Este es el "handleSubmit" local pedido: no envía nada a ningún backend
      // por sí mismo salvo que asignes onSubmit / endpoint. formData ya viene
      // tokenizado por el Brick (token, payment_method_id, issuer_id,
      // installments, payer.identification) — nunca contiene el PAN ni el CVV.
      var self = this;
      self._setStatus('Procesando pago…', 'processing');
      self._dispatch('narel-payment-processing', {});
      var detail = { payment: formData, amount: self.amount };
      var submitEvent = self._dispatch('narel-payment-submit', detail, true);
      if (submitEvent.defaultPrevented) {
        self._setStatus('Completá los datos de tu tarjeta.', 'ready');
        return Promise.resolve();
      }

      var handlerPromise;
      if (typeof self.onSubmit === 'function') {
        handlerPromise = Promise.resolve(self.onSubmit(detail));
      } else if (self.endpoint) {
        handlerPromise = self._defaultSubmit(detail);
      } else {
        console.info('[narel-card-payment] Asigná element.onSubmit = async (detail) => { ... } (o el atributo endpoint) para conectar tu API de pagos existente.');
        handlerPromise = Promise.resolve();
      }

      return handlerPromise.then(function (result) {
        self._setStatus('Datos de tarjeta completos.', 'success');
        self._dispatch('narel-payment-success', detail);
        return result;
      }).catch(function (error) {
        self._setStatus((error && error.message) || 'No pudimos procesar la tarjeta. Probá de nuevo.', 'error');
        self._dispatch('narel-payment-error', { error: String((error && error.message) || error || '') });
        throw error;
      });
    }

    _defaultSubmit(detail) {
      var self = this;
      var payload = typeof self.buildPayload === 'function'
        ? self.buildPayload(detail)
        : { payment: detail.payment };
      var idempotencyKey = self.getAttribute('idempotency-key')
        || (window.crypto && typeof window.crypto.randomUUID === 'function' ? window.crypto.randomUUID() : ('narel-' + Date.now()));
      return fetch(self.endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (json) {
          if (!response.ok || json.ok === false) {
            var error = new Error(json.message || 'No pudimos procesar la tarjeta. Probá de nuevo.');
            error.status = response.status;
            error.data = json;
            throw error;
          }
          return json;
        });
      });
    }

    _dispatch(name, detail, cancelable) {
      var event = new CustomEvent(name, { detail: detail, bubbles: true, composed: true, cancelable: Boolean(cancelable) });
      this.dispatchEvent(event);
      return event;
    }

    reset() {
      this._boot();
    }

    unmount() {
      return this._destroyBrick();
    }
  }

  customElements.define('narel-card-payment', NarelCardPayment);
})();
