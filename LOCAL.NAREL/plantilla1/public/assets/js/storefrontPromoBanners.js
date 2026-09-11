/* ==========================================================================
   Promo banners de la tienda (ofertas y combos creados desde el panel admin).
   - Renderiza N banners activos con su propio countdown.
   - OFERTA: cada producto se agrega al carrito por separado.
   - COMBO:  se agregan todos los productos juntos.
   El precio promocional se re-valida en el servidor al crear el pedido.
   ========================================================================== */
(function () {
  'use strict';

  const ROOT_ID = 'promoBannersRoot';
  const SECTION_ID = 'promo-banner';
  const API_URL = '/api/banners/public?limit=10';
  const DEFAULT_TITLE_IMAGE = '/assets/img/promo-title-promos-exclusivas-removebg.png';
  const DEFAULT_DURATION_DAYS = 7;
  const DAY_IN_MS = 24 * 60 * 60 * 1000;

  const PLACEHOLDER_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  const CART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>';
  const ARROW_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  // Banner por defecto: mantiene el diseño de la home si todavía no se creó
  // ningún banner en el panel o si la API no responde.
  const DEFAULT_BANNER = {
    id: '',
    title: 'PROMOS EXCLUSIVAS',
    subtitle: '🚨 MÁS REGALADO QUE ESQUINA DE BARRIO  ✦',
    cta_text: 'VER LAS PROMOS',
    link: '#pantalones',
    image_url: DEFAULT_TITLE_IMAGE,
    banner_type: 'oferta',
    end_date: null,
    items: [],
  };

  let banners = [];
  let countdownTimer = null;

  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const formatCurrency = (value) => '$ ' + Math.round(Number(value) || 0).toLocaleString('es-AR');
  const pad = (value) => String(value).padStart(2, '0');

  function safeUrl(value, allowHash) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (allowHash && raw.startsWith('#')) return raw;
    try {
      const parsed = new URL(raw, window.location.origin);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch (_error) {
      return '';
    }
  }

  function resolveEndDate(banner) {
    const parsed = banner.end_date ? new Date(banner.end_date) : null;
    if (parsed && Number.isFinite(parsed.getTime())) return parsed;
    return new Date(Date.now() + DEFAULT_DURATION_DAYS * DAY_IN_MS);
  }

  function normalizeBanner(raw) {
    const type = String(raw && raw.banner_type || 'oferta').toLowerCase() === 'combo' ? 'combo' : 'oferta';
    const items = (Array.isArray(raw && raw.items) ? raw.items : []).map((item) => {
      const listPrice = Number(item.list_price) || 0;
      const promoPrice = Math.max(0, Number(item.promo_price) || 0);
      return {
        product_id: String(item.product_id || ''),
        name: String(item.name || 'Producto'),
        image_url: safeUrl(item.image_url, false),
        sizes: String(item.sizes || '').trim(),
        stock: Number(item.stock) || 0,
        list_price: listPrice,
        promo_price: promoPrice,
        discount: listPrice > promoPrice ? Math.round(((listPrice - promoPrice) / listPrice) * 100) : 0,
      };
    }).filter((item) => item.product_id);

    return {
      id: String(raw && raw.id || ''),
      title: String(raw && raw.title || DEFAULT_BANNER.title),
      subtitle: String(raw && raw.subtitle || ''),
      cta_text: String(raw && raw.cta_text || DEFAULT_BANNER.cta_text),
      link: safeUrl(raw && raw.link, true) || DEFAULT_BANNER.link,
      image_url: safeUrl(raw && raw.image_url, false),
      banner_type: type,
      end_date: resolveEndDate(raw || {}),
      items,
    };
  }

  function titleMarkup(banner) {
    const titleLines = String(banner.title).split(/\r?\n|\\n|<br\s*\/?>/i).filter(Boolean);
    if (banner.image_url) {
      return `<img class="promo-title-image" src="${escapeHtml(banner.image_url)}" alt="${escapeHtml(titleLines.join(' '))}" loading="lazy">
            <h2 class="promo-title visually-hidden">${escapeHtml(titleLines.join(' '))}</h2>`;
    }
    const spans = titleLines
      .map((line, index) => `<span${index === titleLines.length - 1 && titleLines.length > 1 ? ' class="promo-accent"' : ''}>${escapeHtml(line)}</span>`)
      .join('<br>');
    return `<h2 class="promo-title">${spans}</h2>`;
  }

  function productMediaMarkup(item) {
    const badge = item.discount > 0 ? `<span class="promo-product-off">-${item.discount}%</span>` : '';
    const media = item.image_url
      ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="lazy">`
      : `<div class="promo-product-placeholder">${PLACEHOLDER_SVG}</div>`;
    return `<div class="promo-product-media">${media}${badge}</div>`;
  }

  function productMarkup(banner, item, bannerIndex, itemIndex) {
    const outOfStock = item.stock <= 0;
    const oldPrice = item.list_price > item.promo_price
      ? `<s class="promo-price-old">${formatCurrency(item.list_price)}</s>`
      : '';
    const sizes = item.sizes ? `<span class="promo-product-sizes">Talles: ${escapeHtml(item.sizes)}</span>` : '';
    const addButton = banner.banner_type === 'oferta'
      ? `<button type="button" class="promo-product-add" data-promo-add data-banner-index="${bannerIndex}" data-item-index="${itemIndex}"${outOfStock ? ' disabled' : ''}>${CART_SVG}<span>${outOfStock ? 'SIN STOCK' : 'AGREGAR'}</span></button>`
      : '';

    return `<article class="promo-product">
              ${productMediaMarkup(item)}
              <div class="promo-product-body">
                <h4 class="promo-product-name">${escapeHtml(item.name)}</h4>
                ${sizes}
                <div class="promo-price-row">
                  ${oldPrice}
                  <b class="promo-price-new">${formatCurrency(item.promo_price)}</b>
                </div>
                ${addButton}
              </div>
            </article>`;
  }

  function comboBarMarkup(banner, bannerIndex) {
    const listTotal = banner.items.reduce((sum, item) => sum + item.list_price, 0);
    const promoTotal = banner.items.reduce((sum, item) => sum + item.promo_price, 0);
    const soldOut = banner.items.some((item) => item.stock <= 0);
    const oldTotal = listTotal > promoTotal ? `<s class="promo-price-old">${formatCurrency(listTotal)}</s>` : '';
    const note = soldOut
      ? '<p class="promo-combo-note">Este combo no está disponible: alguno de sus productos está sin stock.</p>'
      : '<p class="promo-combo-note">El combo se compra completo: se agregan todos los productos al carrito.</p>';

    return `<div class="promo-combo-bar">
              <div class="promo-combo-total">
                <span>Precio del combo</span>
                <div class="promo-combo-prices">${oldTotal}<b>${formatCurrency(promoTotal)}</b></div>
              </div>
              <button type="button" class="promo-combo-add" data-promo-add-combo data-banner-index="${bannerIndex}"${soldOut ? ' disabled' : ''}>
                ${CART_SVG}<span>${soldOut ? 'COMBO SIN STOCK' : 'AGREGAR COMBO AL CARRITO'}</span>
              </button>
              ${note}
            </div>`;
  }

  function productsMarkup(banner, bannerIndex) {
    if (!banner.items.length) return '';
    const isCombo = banner.banner_type === 'combo';
    const heading = isCombo ? 'EL COMBO INCLUYE' : 'PRODUCTOS EN OFERTA';
    const hint = isCombo ? 'Todos los productos juntos' : 'Elegí los que quieras';
    const cards = banner.items.map((item, index) => productMarkup(banner, item, bannerIndex, index)).join('');

    return `<div class="promo-products${isCombo ? ' is-combo' : ''}">
              <div class="promo-products-head">
                <h3>${heading}</h3>
                <span>${hint}</span>
              </div>
              <div class="promo-products-grid">${cards}</div>
              ${isCombo ? comboBarMarkup(banner, bannerIndex) : ''}
            </div>`;
  }

  function bannerMarkup(banner, bannerIndex) {
    const subtitle = banner.subtitle
      ? `<p class="promo-subtitle">${escapeHtml(banner.subtitle)}</p>`
      : '';
    return `<article class="promo-banner" data-banner-id="${escapeHtml(banner.id)}" data-banner-type="${banner.banner_type}">
      <div class="promo-banner-glow"></div>
      <div class="promo-banner-bg"></div>

      <div class="promo-banner-left">
        <div class="promo-urgent-pill">
          <span class="flash-dot"></span>
          <span>¡POR TIEMPO LIMITADO!</span>
        </div>
        <span class="promo-type-pill" data-type="${banner.banner_type}">${banner.banner_type === 'combo' ? 'COMBO' : 'OFERTA'}</span>
        ${titleMarkup(banner)}
        ${subtitle}
        <a href="${escapeHtml(banner.link)}" class="promo-cta">
          <span>${escapeHtml(banner.cta_text)}</span>
          ${ARROW_SVG}
        </a>
      </div>

      <div class="promo-banner-right">
        <div class="promo-countdown" data-countdown-end="${banner.end_date.toISOString()}">
          <div class="countdown-label">TERMINA EN</div>
          <div class="countdown-grid">
            <div class="countdown-item"><b data-cd="days">00</b><span>DIAS</span></div>
            <div class="countdown-sep">:</div>
            <div class="countdown-item"><b data-cd="hours">00</b><span>HORAS</span></div>
            <div class="countdown-sep">:</div>
            <div class="countdown-item"><b data-cd="mins">00</b><span>MIN</span></div>
            <div class="countdown-sep">:</div>
            <div class="countdown-item"><b data-cd="secs">00</b><span>SEG</span></div>
          </div>
        </div>
        <div class="promo-stripes" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
      </div>

      ${productsMarkup(banner, bannerIndex)}
    </article>`;
  }

  function tickCountdowns(root) {
    root.querySelectorAll('[data-countdown-end]').forEach((node) => {
      const end = new Date(node.dataset.countdownEnd).getTime();
      const diff = Math.max(0, end - Date.now());
      const values = {
        days: Math.floor(diff / DAY_IN_MS),
        hours: Math.floor((diff / (60 * 60 * 1000)) % 24),
        mins: Math.floor((diff / (60 * 1000)) % 60),
        secs: Math.floor((diff / 1000) % 60),
      };
      Object.keys(values).forEach((unit) => {
        const target = node.querySelector(`[data-cd="${unit}"]`);
        if (target) target.textContent = pad(values[unit]);
      });
    });
  }

  function startCountdowns(root) {
    if (countdownTimer) window.clearInterval(countdownTimer);
    tickCountdowns(root);
    countdownTimer = window.setInterval(() => tickCountdowns(root), 1000);
  }

  function toast(message) {
    const previous = document.getElementById('__promo_toast__');
    if (previous) previous.remove();
    const node = document.createElement('div');
    node.id = '__promo_toast__';
    node.setAttribute('role', 'status');
    node.textContent = message;
    Object.assign(node.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#0a0a0a', color: '#fff', border: '1px solid #2a2a2a',
      padding: '12px 18px', fontFamily: "'Oswald', sans-serif", letterSpacing: '.08em',
      zIndex: '999999', boxShadow: '0 20px 40px rgba(0,0,0,.6)',
    });
    document.body.appendChild(node);
    window.setTimeout(() => node.remove(), 2200);
  }

  function toCartItem(banner, item) {
    return {
      id: item.product_id,
      banner_id: banner.id,
      promo_type: banner.banner_type,
      promo_label: banner.banner_type === 'combo' ? 'COMBO' : 'OFERTA',
      name: item.name,
      price: item.promo_price,
      list_price: item.list_price,
      image: item.image_url,
      sizes: item.sizes,
      stock: item.stock,
      qty: 1,
    };
  }

  function handleAdd(event) {
    const single = event.target.closest('[data-promo-add]');
    const combo = event.target.closest('[data-promo-add-combo]');
    const trigger = single || combo;
    if (!trigger || trigger.disabled) return;

    const banner = banners[Number(trigger.dataset.bannerIndex)];
    if (!banner) return;

    const shop = window.shop;
    if (!shop || typeof shop.addToCart !== 'function') {
      toast('El carrito todavía se está cargando. Probá de nuevo.');
      return;
    }

    if (combo) {
      const items = banner.items.map((item) => toCartItem(banner, item));
      const added = typeof shop.addManyToCart === 'function'
        ? shop.addManyToCart(items)
        : items.filter((item) => shop.addToCart(item) !== false).length;
      if (!added) toast('El combo no está disponible en este momento.');
      return;
    }

    const item = banner.items[Number(single.dataset.itemIndex)];
    if (!item) return;
    shop.addToCart(toCartItem(banner, item));
  }

  function render(list) {
    const root = document.getElementById(ROOT_ID);
    const section = document.getElementById(SECTION_ID);
    if (!root) return;

    banners = list;
    if (!banners.length) {
      root.innerHTML = '';
      if (section) section.hidden = true;
      return;
    }

    root.innerHTML = banners.map(bannerMarkup).join('');
    if (section) section.hidden = false;
    startCountdowns(root);
  }

  async function load() {
    try {
      const response = await fetch(API_URL, { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('status=' + response.status);
      const json = await response.json();
      const list = json && json.ok && Array.isArray(json.data) ? json.data : [];
      render(list.length ? list.map(normalizeBanner) : [normalizeBanner(DEFAULT_BANNER)]);
    } catch (error) {
      console.warn('[promo-banners] No se pudieron cargar los banners:', error.message || error);
      render([normalizeBanner(DEFAULT_BANNER)]);
    }
  }

  function init() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.addEventListener('click', handleAdd);
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
