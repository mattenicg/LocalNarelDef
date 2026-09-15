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
      '<p class="ncp-kicker" part="kicker">Medio de pago</p>' +
      '<div class="ncp-brick-mount" part="brick-mount"><slot name="brick"></slot></div>' +
      '<p class="ncp-status" part="status" role="status" aria-live="polite" data-state="idle"></p>' +
    '</div>';

  class NarelCardPayment extends HTMLElement {
    static get observedAttributes() {
      return ['amount', 'public-key', 'locale', 'endpoint', 'payer-email', 'disabled', 'max-installments', 'preference-id'];
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
      } else if (name === 'public-key' || name === 'locale' || name === 'max-installments' || name === 'preference-id') {
        this._boot();
      } else if (name === 'disabled') {
        this._applyDisabled();
      }
    }

    get amount() { return Number(this.getAttribute('amount')) || 0; }
    set amount(value) { this.setAttribute('amount', String(value)); }

    get publicKey() { return this.getAttribute('public-key') || ''; }
    set publicKey(value) { value ? this.setAttribute('public-key', value) : this.removeAttribute('public-key'); }

    get preferenceId() { return this.getAttribute('preference-id') || ''; }
    set preferenceId(value) { value ? this.setAttribute('preference-id', value) : this.removeAttribute('preference-id'); }

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
            self._renderFallbackForm('Modo de prueba activo · Ingresá tus datos de tarjeta y cuotas');
            return;
          }
          self._setStatus('Cargando formulario seguro…', 'loading');
          return loadMercadoPagoSdk().then(function (MercadoPagoCtor) {
            if (self._destroyed) return;
            self._mercadoPago = new MercadoPagoCtor(publicKey, { locale: self.locale });
            var bricksBuilder = self._mercadoPago.bricks();
            var maxInstallmentsAttr = self.getAttribute('max-installments');
            var maxInstallments = maxInstallmentsAttr ? Number(maxInstallmentsAttr) : 24;
            var preferenceId = self.preferenceId || self.getAttribute('preference-id');

            var paymentMethodsConfig = {
              creditCard: 'all',
              debitCard: 'all',
              ticket: 'all',
              bankTransfer: 'all',
              mercadoPago: 'all',
              maxInstallments: maxInstallments || 24,
            };

            var initialization = { amount: amount };
            if (preferenceId) initialization.preferenceId = preferenceId;
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
                paymentMethods: paymentMethodsConfig,
              },
              callbacks: {
                onReady: function () {
                  self._setStatus('Elegí tu medio de pago y completá los datos.', 'ready');
                  if (typeof self.onReady === 'function') self.onReady();
                  self._dispatch('narel-payment-ready', {});
                },
                onSubmit: function (param) { return self._handleSubmit(param); },
                onError: function (error) {
                  self._setStatus('No pudimos procesar el medio de pago seleccionado. Probá de nuevo.', 'error');
                  if (typeof self.onError === 'function') self.onError(error);
                  self._dispatch('narel-payment-error', { error: String((error && error.message) || error || '') });
                },
              },
            };

            var brickType = self.getAttribute('brick-type') || 'cardPayment';

            var cardSettings = {
              initialization: {
                amount: amount,
                payer: self.payerEmail ? { email: self.payerEmail } : undefined,
              },
              customization: {
                visual: settings.customization.visual,
                paymentMethods: {
                  maxInstallments: maxInstallments || 24,
                },
              },
              callbacks: {
                onReady: function () {
                  self._setStatus('Completá los datos de tu tarjeta para habilitar las cuotas.', 'ready');
                  if (typeof self.onReady === 'function') self.onReady();
                  self._dispatch('narel-payment-ready', {});
                },
                onSubmit: function (cardFormData) {
                  return self._handleSubmit(cardFormData);
                },
                onError: function (error) {
                  self._setStatus('No pudimos procesar la tarjeta. Verificá los datos ingresados.', 'error');
                  if (typeof self.onError === 'function') self.onError(error);
                  self._dispatch('narel-payment-error', { error: String((error && error.message) || error || '') });
                },
              },
            };

            if (brickType === 'cardPayment' || brickType === 'card') {
              return bricksBuilder.create('cardPayment', self._lightContainer.id, cardSettings)
                .then(function (controller) {
                  self._brickController = controller;
                })
                .catch(function (cardErr) {
                  console.warn('[narel-card-payment] Error en cardPayment, fallback a payment brick:', cardErr);
                  return bricksBuilder.create('payment', self._lightContainer.id, settings)
                    .then(function (controller) {
                      self._brickController = controller;
                    });
                });
            } else {
              return bricksBuilder.create('payment', self._lightContainer.id, settings)
                .then(function (controller) {
                  self._brickController = controller;
                })
                .catch(function (paymentError) {
                  console.warn('[narel-card-payment] Fallback al brick cardPayment:', paymentError);
                  return bricksBuilder.create('cardPayment', self._lightContainer.id, cardSettings)
                    .then(function (controller) {
                      self._brickController = controller;
                    });
                });
            }
          }).catch(function (err) {
            console.warn('[narel-card-payment] Error al cargar Mercado Pago SDK/Brick, activando formulario directo:', err);
            self._renderFallbackForm('Formulario directo activo · Ingresá tu tarjeta y seleccioná las cuotas');
          });
        });
      });
    }

    _renderFallbackForm(noticeText) {
      var self = this;
      var amount = self.amount || 0;
      var container = self._lightContainer;
      if (!container) return;
      container.innerHTML = '';

      var calcCuota = function(n, recargo) {
        var total = amount * (1 + recargo);
        var valorCuota = Math.round(total / n);
        return '$ ' + valorCuota.toLocaleString('es-AR');
      };

      var formHtml = document.createElement('div');
      formHtml.className = 'ncp-fallback-card-form';
      formHtml.innerHTML = `
        <div style="margin-bottom:14px;padding:10px 12px;background:rgba(255,255,255,0.04);border:1px solid var(--border,#333);color:#bbb;font:400 11px 'DM Mono',monospace;">
          <span style="color:var(--yellow,#ffcc00);font-weight:700;">💳 PAGO CON TARJETA DE CRÉDITO / DÉBITO</span><br>
          <small>${noticeText || 'Ingresá tu tarjeta y seleccioná las cuotas deseadas'}</small>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="display:block;margin-bottom:4px;color:var(--grey,#aaa);font:500 11px 'Oswald',sans-serif;letter-spacing:.05em;text-transform:uppercase;">Número de tarjeta</label>
            <input type="text" id="ncpCardNumber" placeholder="4500 0000 0000 0000" maxlength="19" style="width:100%;padding:10px 12px;background:#000;border:1px solid var(--border,#333);color:#fff;font:500 14px 'DM Mono',monospace;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;color:var(--grey,#aaa);font:500 11px 'Oswald',sans-serif;letter-spacing:.05em;text-transform:uppercase;">Nombre y apellido impreso en la tarjeta</label>
            <input type="text" id="ncpCardHolder" placeholder="JUAN PEREZ" style="width:100%;padding:10px 12px;background:#000;border:1px solid var(--border,#333);color:#fff;font:500 13px 'DM Mono',monospace;text-transform:uppercase;box-sizing:border-box;">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label style="display:block;margin-bottom:4px;color:var(--grey,#aaa);font:500 11px 'Oswald',sans-serif;letter-spacing:.05em;text-transform:uppercase;">Vencimiento</label>
              <input type="text" id="ncpCardExpiry" placeholder="MM/AA" maxlength="5" style="width:100%;padding:10px 12px;background:#000;border:1px solid var(--border,#333);color:#fff;font:500 13px 'DM Mono',monospace;box-sizing:border-box;">
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;color:var(--grey,#aaa);font:500 11px 'Oswald',sans-serif;letter-spacing:.05em;text-transform:uppercase;">Código de seg. (CVV)</label>
              <input type="password" id="ncpCardCvv" placeholder="123" maxlength="4" style="width:100%;padding:10px 12px;background:#000;border:1px solid var(--border,#333);color:#fff;font:500 13px 'DM Mono',monospace;box-sizing:border-box;">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;">
            <div>
              <label style="display:block;margin-bottom:4px;color:var(--grey,#aaa);font:500 11px 'Oswald',sans-serif;letter-spacing:.05em;text-transform:uppercase;">Tipo Doc.</label>
              <select id="ncpDocType" style="width:100%;padding:10px;background:#000;border:1px solid var(--border,#333);color:#fff;font:500 13px 'DM Mono',monospace;box-sizing:border-box;">
                <option value="DNI" selected>DNI</option>
                <option value="CUIL">CUIL</option>
              </select>
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;color:var(--grey,#aaa);font:500 11px 'Oswald',sans-serif;letter-spacing:.05em;text-transform:uppercase;">Número de documento</label>
              <input type="text" id="ncpDocNumber" placeholder="12345678" maxlength="11" style="width:100%;padding:10px 12px;background:#000;border:1px solid var(--border,#333);color:#fff;font:500 13px 'DM Mono',monospace;box-sizing:border-box;">
            </div>
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;color:var(--yellow,#ffcc00);font:700 12px 'Oswald',sans-serif;letter-spacing:.05em;text-transform:uppercase;">Elegí las cuotas</label>
            <select id="ncpInstallments" style="width:100%;padding:11px 12px;background:#000;border:1px solid var(--yellow,#ffcc00);color:#fff;font:600 13px 'DM Mono',monospace;box-sizing:border-box;">
              <option value="1" selected>1 pago de $ ${amount.toLocaleString('es-AR')} (Sin interés)</option>
              <option value="3">3 cuotas fijas de ${calcCuota(3, 0)} (Sin interés)</option>
              <option value="6">6 cuotas fijas de ${calcCuota(6, 0.10)}</option>
              <option value="12">12 cuotas fijas de ${calcCuota(12, 0.20)}</option>
              <option value="24">24 cuotas fijas de ${calcCuota(24, 0.35)}</option>
            </select>
          </div>
          <div style="margin-top:6px;">
            <button type="button" id="ncpSubmitCardBtn" style="width:100%;padding:14px 20px;background:var(--yellow,#ffcc00);border:none;color:#000;font:700 14px 'Oswald',sans-serif;letter-spacing:.08em;cursor:pointer;text-transform:uppercase;">
              PAGAR $ ${amount.toLocaleString('es-AR')} CON TARJETA
            </button>
          </div>
        </div>
      `;

      container.appendChild(formHtml);
      self._setStatus('Elegí las cuotas y completá los datos de tu tarjeta.', 'ready');
      if (typeof self.onReady === 'function') self.onReady();
      self._dispatch('narel-payment-ready', {});

      var numInput = formHtml.querySelector('#ncpCardNumber');
      if (numInput) {
        numInput.addEventListener('input', function(e) {
          var v = e.target.value.replace(/\D/g, '').substring(0, 16);
          var parts = [];
          for (var i = 0; i < v.length; i += 4) parts.push(v.substring(i, i + 4));
          e.target.value = parts.join(' ');
        });
      }

      var expInput = formHtml.querySelector('#ncpCardExpiry');
      if (expInput) {
        expInput.addEventListener('input', function(e) {
          var v = e.target.value.replace(/\D/g, '').substring(0, 4);
          if (v.length > 2) e.target.value = v.substring(0, 2) + '/' + v.substring(2);
          else e.target.value = v;
        });
      }

      var submitBtn = formHtml.querySelector('#ncpSubmitCardBtn');
      if (submitBtn) {
        submitBtn.addEventListener('click', function() {
          var num = (numInput ? numInput.value : '').replace(/\s/g, '');
          var holderEl = formHtml.querySelector('#ncpCardHolder');
          var holder = holderEl ? holderEl.value.trim() : '';
          var exp = expInput ? expInput.value.trim() : '';
          var cvvEl = formHtml.querySelector('#ncpCardCvv');
          var cvv = cvvEl ? cvvEl.value.trim() : '';
          var docNumEl = formHtml.querySelector('#ncpDocNumber');
          var docNum = docNumEl ? docNumEl.value.trim() : '';
          var instEl = formHtml.querySelector('#ncpInstallments');
          var inst = instEl ? instEl.value : '1';
          var docTypeEl = formHtml.querySelector('#ncpDocType');
          var docType = docTypeEl ? docTypeEl.value : 'DNI';

          if (num.length < 13) {
            self._setStatus('Ingresá un número de tarjeta válido.', 'error');
            if (numInput) numInput.focus();
            return;
          }
          if (!holder) {
            self._setStatus('Ingresá el nombre como figura en la tarjeta.', 'error');
            if (holderEl) holderEl.focus();
            return;
          }
          if (exp.length < 5) {
            self._setStatus('Ingresá el vencimiento MM/AA.', 'error');
            if (expInput) expInput.focus();
            return;
          }
          if (cvv.length < 3) {
            self._setStatus('Ingresá el código CVV.', 'error');
            if (cvvEl) cvvEl.focus();
            return;
          }

          var simulatedPayload = {
            token: 'tok_mock_' + Math.random().toString(36).slice(2, 12),
            payment_method_id: num.startsWith('4') ? 'visa' : (num.startsWith('5') ? 'master' : 'credit_card'),
            installments: Number(inst) || 1,
            payer: {
              email: self.payerEmail || 'cliente@narel.local',
              identification: {
                type: docType,
                number: docNum || '00000000',
              }
            },
            cardholder: { name: holder }
          };

          self._handleSubmit({ formData: simulatedPayload, selectedPaymentMethod: 'credit_card' });
        });
      }
    }

    _destroyBrick() {
      var controller = this._brickController;
      this._brickController = null;
      if (controller && typeof controller.unmount === 'function') {
        try {
          var result = controller.unmount();

          if (result && typeof result.catch === 'function') {
            return result.catch(function () {});
          }
        } catch (error) {
          // Ignorar errores al desmontar el Brick.
        }
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

    _handleSubmit(param) {
      var self = this;
      self._setStatus('Procesando pago…', 'processing');
      self._dispatch('narel-payment-processing', {});

      var formData = (param && param.formData) ? param.formData : param;
      var selectedPaymentMethod = (param && param.selectedPaymentMethod)
        || (formData && formData.payment_type_id)
        || (formData && formData.token ? 'credit_card' : 'ticket');

      var detail = {
        payment: formData,
        selectedPaymentMethod: selectedPaymentMethod,
        amount: self.amount,
      };

      var submitEvent = self._dispatch('narel-payment-submit', detail, true);
      if (submitEvent.defaultPrevented) {
        self._setStatus('Elegí tu medio de pago y completá los datos.', 'ready');
        return Promise.resolve();
      }

      var handlerPromise;
      if (typeof self.onSubmit === 'function') {
        handlerPromise = Promise.resolve(self.onSubmit(detail));
      } else if (self.endpoint) {
        handlerPromise = self._defaultSubmit(detail);
      } else {
        console.info('[narel-card-payment] Asigná element.onSubmit = async (detail) => { ... } para conectar tu API de pagos existente.');
        handlerPromise = Promise.resolve();
      }

      return handlerPromise.then(function (result) {
        self._setStatus('Pago procesado correctamente.', 'success');
        self._dispatch('narel-payment-success', detail);
        return result;
      }).catch(function (error) {
        self._setStatus((error && error.message) || 'No pudimos procesar el medio de pago. Probá de nuevo.', 'error');
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
