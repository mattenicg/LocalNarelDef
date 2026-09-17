
    (function () {
      'use strict';

      const PLACEHOLDER_IMG_SVG =
        '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none" preserveAspectRatio="xMidYMid meet"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

      const CAT_LABEL = {
        pantalones: 'NUEVO',
        camperas: 'TOP',
        buzos: 'NUEVO',
        remeras: 'NEW',
        accesorios: 'TOP',
      };

      function fmtPrice(n) {
        try {
          const num = Number(n);
          if (!Number.isFinite(num) || num < 0) return '';
          const intPart = Math.floor(num).toLocaleString('es-AR', { useGrouping: true }).replace(/\./g, '.');
          const dec = num % 1 === 0 ? '000' : String(num).split(',')[1] || '';
          return '$ ' + intPart + (dec ? ',' + dec : '');
        } catch (e) { return ''; }
      }

      function fmtPriceClean(n) {
        const num = Number(n);
        if (!Number.isFinite(num) || num < 0) return '';
        return '$ ' + Math.round(num).toLocaleString('es-AR').replace(/,/g, '.');
      }

      function htmlEscape(str) {
        return String(str == null ? '' : str)
          .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      function guessCategory(name, description) {
        const haystack = (String(name || '') + ' ' + String(description || '')).toLowerCase();
        if (/(pantalon|jogger|baggy|cargo|wide|chino|bermuda|short)/i.test(haystack)) return 'pantalones';
        if (/(campera|chaqueta|parka|camperita|puffer|rompeviento)/i.test(haystack)) return 'camperas';
        if (/(buzo|hoodie|sudadera|canguro|crewneck)/i.test(haystack)) return 'buzos';
        if (/(remera|tee|t-shirt|playera|musculosa|top)/i.test(haystack)) return 'remeras';
        if (/(accesorio|gorra|cap|bufanda|cinturon|media|medias|mochila|llavero|piluso|cadena|collar|anillo|reloj|riñonera|bolso|beanie)/i.test(haystack)) return 'accesorios';
        // Fallback: parsear tag [CAT:x] en description
        const m = /\[CAT:\s*([a-z_]+)\]/i.exec(String(description || ''));
        if (m) return m[1].toLowerCase();
        return 'remeras';
      }

      function fmtPriceAR(n) {
        const num = Number(n);
        if (!Number.isFinite(num) || num < 0) return '$ 0,00';
        return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      // Single source of truth for product pricing, discounts, installments, and promo calculation
      function getProductPricing(p) {
        const basePrice = Number(p.price) || 0;
        const discountPercent = (p.direct_discount_percent !== undefined && p.direct_discount_percent !== null && p.direct_discount_percent !== '')
          ? Number(p.direct_discount_percent)
          : 0;
        const hasDiscount = discountPercent > 0;
        const discountText = htmlEscape(p.direct_discount_text || 'con transferencia');
        const showPromoBadge = p.direct_show_promo_badge !== false && String(p.direct_show_promo_badge) !== 'false';
        const promoBadgeText = htmlEscape(p.direct_promo_badge_text || 'PROMO ACTIVA');
        const installmentsCount = Number(p.direct_installments_count) > 0 ? Number(p.direct_installments_count) : 6;
        const installmentsText = htmlEscape(p.direct_installments_text || 'sin interés');
        const installmentPrice = installmentsCount > 0 ? (basePrice / installmentsCount) : basePrice;

        let transferPrice = hasDiscount ? (basePrice * (1 - (discountPercent / 100))) : basePrice;
        if (p.direct_custom_transfer_price !== undefined && p.direct_custom_transfer_price !== null && p.direct_custom_transfer_price !== '' && Number(p.direct_custom_transfer_price) > 0) {
          transferPrice = Number(p.direct_custom_transfer_price);
        }
        const transferText = htmlEscape(p.direct_transfer_text || 'con Transferencia');

        const cashDiscountPercent = (p.cash_discount_percent !== undefined && p.cash_discount_percent !== null && p.cash_discount_percent !== '')
          ? Number(p.cash_discount_percent)
          : 0;
        const hasCashDiscount = cashDiscountPercent > 0;
        const cashDiscountText = htmlEscape(p.cash_discount_text || 'en efectivo');
        let cashPrice = hasCashDiscount ? (basePrice * (1 - (cashDiscountPercent / 100))) : basePrice;
        if (p.cash_custom_price !== undefined && p.cash_custom_price !== null && p.cash_custom_price !== '' && Number(p.cash_custom_price) > 0) {
          cashPrice = Number(p.cash_custom_price);
        }
        const cashText = htmlEscape(p.cash_text || 'en Efectivo');

        return {
          basePrice,
          priceFormatted: fmtPriceAR(basePrice),
          discountPercent,
          hasDiscount,
          discountText,
          showPromoBadge,
          promoBadgeText,
          installmentsCount,
          installmentsText,
          installmentPrice,
          installmentPriceStr: fmtPriceAR(installmentPrice),
          transferPrice,
          transferPriceStr: fmtPriceAR(transferPrice),
          transferText,
          cashDiscountPercent,
          hasCashDiscount,
          cashDiscountText,
          cashPrice,
          cashPriceStr: fmtPriceAR(cashPrice),
          cashText,
        };
      }

      function productCardHTML(p) {
        const cat = (p.category || guessCategory(p.name, p.description) || 'remeras').toLowerCase();
        const badge = CAT_LABEL[cat] || 'NUEVO';
        const badgeStyle = '';
        const name = htmlEscape(p.name || 'Producto');
        const desc = htmlEscape(p.description || '').replace(/\[CAT:\s*[a-z_]+\]/gi, '').trim() || 'Prenda · Stock Disponible';
        const sizes = htmlEscape(p.sizes || '');
        const stock = Number(p.stock) || 0;
        const disabledBtn = stock <= 0 ? ' disabled' : '';
        const imgUrl = (p.image_url && typeof p.image_url === 'string' && p.image_url.trim()) ? p.image_url.trim() : '';
        const innerImg = imgUrl
          ? `<img src="${htmlEscape(imgUrl)}" alt="${name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;" onerror="var p=this.parentElement; this.remove(); if(p){var pl=p.querySelector('.placeholder'); if(pl) pl.style.display='flex';}">
             <div class="placeholder" style="display:none;">${PLACEHOLDER_IMG_SVG}<span>IMAGEN</span></div>`
          : `<div class="placeholder">${PLACEHOLDER_IMG_SVG}<span>IMAGEN</span></div>`;

        const pricing = getProductPricing(p);

        const directAttrs = ` data-direct="0" data-allowed-methods="${htmlEscape(JSON.stringify(p.allowed_payment_methods || []))}" data-allowed-installments="${htmlEscape(JSON.stringify(p.allowed_installments || []))}" data-discount-percent="${pricing.discountPercent}" data-discount-text="${pricing.discountText}" data-custom-transfer="${p.direct_custom_transfer_price || ''}" data-cash-discount-percent="${pricing.cashDiscountPercent}" data-cash-discount-text="${pricing.cashDiscountText}" data-custom-cash="${p.cash_custom_price || ''}" data-installments-count="${pricing.installmentsCount}" data-installments-text="${pricing.installmentsText}"`;

        const promoBadgeHTML = (pricing.showPromoBadge && pricing.promoBadgeText)
          ? `<div class="direct-promo-pill" style="background:#e50914;color:#fff;font-size:10px;font-weight:800;padding:4px 9px;border-radius:12px;letter-spacing:.05em;text-transform:uppercase;line-height:1.1;text-align:center;box-shadow:0 2px 8px rgba(229,9,20,0.3);white-space:nowrap;">${pricing.promoBadgeText}</div>`
          : '';

        const discountBadgeHTML = pricing.hasDiscount
          ? `<div class="direct-discount-box" style="background:#141414;border:1px solid #2e2e2e;color:#eee;font-size:12px;font-weight:600;padding:6px 10px;border-radius:6px;letter-spacing:.02em;">${pricing.discountPercent}% OFF ${pricing.discountText}</div>`
          : '';

        const buttonHTML = `<button type="button" class="btn-add"${disabledBtn} data-action="add" aria-label="Agregar ${name} al carrito" style="width:100%;background:#232733;color:#fff;border:1px solid #3d4354;border-radius:20px;padding:10px 16px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s ease;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
              <span>${stock <= 0 ? 'SIN STOCK' : 'AGREGAR'}</span>
            </button>`;

        return (
          `<article class="product product-direct" data-id="${htmlEscape(p.id || '')}" data-price="${pricing.basePrice}" data-stock="${stock}" data-name="${name}" data-image="${htmlEscape(imgUrl)}" data-sizes="${sizes}"${directAttrs} style="cursor:pointer;" title="Click para ver detalle">` +
          `<span class="product-shine" aria-hidden="true"></span>` +
          `<span class="product-badge"${badgeStyle}>${badge}</span>` +
          `<div class="product-image">${innerImg}</div>` +
          `<div class="product-body" style="padding:14px 16px 16px;display:flex;flex-direction:column;gap:6px;">` +
          `<h4 class="product-name" style="font-size:14px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#fff;margin:0;line-height:1.3;">${name}</h4>` +
          `<div class="product-sizes" style="font-size:11px;font-weight:600;color:#f43f5e;letter-spacing:.05em;text-transform:uppercase;margin-top:2px;">Talles: ${sizes || 'Único'}</div>` +
          `<div class="direct-price-main" style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#fff;margin-top:2px;">${pricing.priceFormatted}</div>` +
          `<div class="direct-promo-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px;">` +
          discountBadgeHTML +
          promoBadgeHTML +
          `</div>` +
          `<div class="direct-installments-line" style="font-size:12.5px;color:#9ca3af;letter-spacing:.01em;margin-top:2px;">${pricing.installmentsCount} x ${pricing.installmentPriceStr} ${pricing.installmentsText}</div>` +
          ((pricing.hasCashDiscount || pricing.cashPrice < pricing.basePrice) ? `<div class="direct-cash-line" style="font-size:14px;font-weight:700;color:#f43f5e;letter-spacing:.01em;margin-top:1px;">${pricing.cashPriceStr} ${pricing.cashText}</div>` : '') +
          `<div class="direct-transfer-line" style="font-size:14px;font-weight:700;color:#f43f5e;letter-spacing:.01em;margin-top:1px;">${pricing.transferPriceStr} ${pricing.transferText}</div>` +
          `<div class="product-bottom" style="margin-top:8px;padding-top:4px;border:none;">` +
          buttonHTML +
          `</div>` +
          `</div>` +
          `</article>`
        );
      }

      // ===== INTELLIGENT CROSS-SELLING ALGORITHM =====
      function getCrossSellProducts(catalog, targetItemOrList, maxCount) {
        if (!maxCount) maxCount = 4;
        if (!Array.isArray(catalog) || !catalog.length) return [];
        const sourceList = Array.isArray(targetItemOrList) ? targetItemOrList : [targetItemOrList];
        // All products can participate in cross-selling
        const excludedIds = new Set();
        const currentCategories = new Set();

        sourceList.forEach(item => {
          if (!item) return;
          const id = String(item.id || item.product_id || '');
          if (id) excludedIds.add(id);
          const cat = String(item.category || guessCategory(item.name, item.description) || '').toLowerCase();
          if (cat) currentCategories.add(cat);
        });

        // Always exclude items that are currently in the cart
        if (window.shop && typeof window.shop.getItems === 'function') {
          const cartItems = window.shop.getItems();
          cartItems.forEach(ci => {
            if (ci && ci.id) {
              excludedIds.add(String(ci.id));
              const cCat = String(ci.category || guessCategory(ci.name, ci.description) || '').toLowerCase();
              if (cCat) currentCategories.add(cCat);
            }
          });
        }

        // Complementary logic
        const targetComplementary = new Set();
        currentCategories.forEach(cat => {
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

        // Filter eligible candidates: not excluded, in stock, and NOT direct purchase
        const candidates = catalog.filter(p => {
          if (!p || !p.id) return false;
          if (p.direct_purchase) return false;
          if (excludedIds.has(String(p.id))) return false;
          const stock = p.stock == null ? 99 : Number(p.stock);
          return stock > 0;
        });

        // Score candidates
        const scored = candidates.map(p => {
          const pCat = String(p.category || guessCategory(p.name, p.description) || 'remeras').toLowerCase();
          let score = 0;
          if (targetComplementary.has(pCat)) score += 10;
          if (!currentCategories.has(pCat)) score += 5;
          if (p.featured) score += 3;
          if (p.image_url) score += 2;
          score += (p.id ? String(p.id).charCodeAt(0) % 3 : 0);
          return { product: p, score };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, Math.max(2, Math.min(4, maxCount))).map(s => s.product);
      }

      // ===== PRODUCT DETAIL MODAL & CROSS-SELLING =====
      let currentModalProduct = null;
      let selectedModalSize = '';

      function openProductModal(prod) {
        if (!prod) return;
        currentModalProduct = prod;
        selectedModalSize = '';
        const modal = document.getElementById('productModal');
        const body = document.getElementById('productModalBody');
        if (!modal || !body) return;

        renderProductModalContent();
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        if (prod.id) {
          try {
            history.replaceState(null, '', '#producto-' + encodeURIComponent(prod.id));
          } catch (_e) {}
        }
      }

      function closeProductModal() {
        const modal = document.getElementById('productModal');
        if (!modal) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        currentModalProduct = null;
        try {
          if (window.location.hash.startsWith('#producto-')) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        } catch (_e) {}
      }

      function renderModalCrossSellGridHTML(recs) {
        return recs.map(rec => {
          const recCat = (rec.category || guessCategory(rec.name, rec.description) || 'remeras').toUpperCase();
          const recImg = rec.image_url
            ? `<img src="${htmlEscape(rec.image_url)}" alt="${htmlEscape(rec.name)}" loading="lazy">`
            : `<span>${htmlEscape((rec.id || 'NL').slice(0, 2).toUpperCase())}</span>`;
          return (
            `<div class="pm-rec-card" data-rec-id="${htmlEscape(rec.id)}">` +
            `<div class="pm-rec-img">${recImg}</div>` +
            `<span class="pm-rec-cat">${htmlEscape(recCat)}</span>` +
            `<h5 class="pm-rec-name" title="${htmlEscape(rec.name)}">${htmlEscape(rec.name)}</h5>` +
            `<div class="pm-rec-bottom">` +
            `<span class="pm-rec-price">${fmtPriceClean(rec.price)}</span>` +
            `<button type="button" class="pm-rec-add-btn" data-pm-rec-add="${htmlEscape(rec.id)}" aria-label="Agregar ${htmlEscape(rec.name)} al carrito">` +
            `+ AGREGAR` +
            `</button>` +
            `</div>` +
            `</div>`
          );
        }).join('');
      }

      function renderProductModalContent() {
        const body = document.getElementById('productModalBody');
        if (!body || !currentModalProduct) return;
        const p = currentModalProduct;
        const cat = (p.category || guessCategory(p.name, p.description) || 'remeras').toLowerCase();
        const badge = CAT_LABEL[cat] || 'NUEVO';
        const badgeStyle = '';
        const priceStr = fmtPriceClean(p.price) || '';
        const name = htmlEscape(p.name || 'Producto');
        const desc = htmlEscape(p.description || '').replace(/\[CAT:\s*[a-z_]+\]/gi, '').trim() || 'Prenda de alta calidad confeccionada con diseño urbano y corte contemporáneo.';
        const stock = Number(p.stock) || 0;
        const stockText = stock > 0 ? (stock <= 5 ? `ÚLTIMAS ${stock} UNIDADES` : `EN STOCK (${stock})`) : 'SIN STOCK';
        const imgUrl = (p.image_url && typeof p.image_url === 'string') ? p.image_url.trim() : '';

        let productImages = [];
        if (Array.isArray(p.images) && p.images.length > 0) {
          productImages = p.images.filter(Boolean);
        } else if (typeof p.images === 'string' && p.images.startsWith('[')) {
          try { productImages = JSON.parse(p.images).filter(Boolean); } catch (_) {}
        }
        if (imgUrl && !productImages.includes(imgUrl)) {
          productImages.unshift(imgUrl);
        }
        if (productImages.length === 0 && imgUrl) {
          productImages = [imgUrl];
        }

        // Sizes chips
        const rawSizes = String(p.sizes || '').trim();
        const sizeList = rawSizes.split(/\s*[-|/,]\s*/).map(s => s.trim()).filter(Boolean);
        let sizesHTML = '';
        if (sizeList.length) {
          if (!selectedModalSize) selectedModalSize = sizeList[0];
          sizesHTML = `
            <div class="pm-sizes-section">
              <span class="pm-sizes-label">ELEGÍ TU TALLE:</span>
              <div class="pm-size-chips" id="pmSizeChips">
                ${sizeList.map(s => `
                  <button type="button" class="pm-size-btn ${s === selectedModalSize ? 'selected' : ''}" data-pm-size="${htmlEscape(s)}">
                    ${htmlEscape(s)}
                  </button>
                `).join('')}
              </div>
            </div>`;
        }

        let galleryHTML = '';
        if (productImages.length > 0) {
          galleryHTML = `
            <div class="pm-main-img-wrap" style="position:relative;width:100%;aspect-ratio:4/5;background:#080808;border:1px solid rgba(255,255,255,0.12);border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
              <span class="pm-badge"${badgeStyle}>${badge}</span>
              <img id="pmMainImg" src="${htmlEscape(productImages[0])}" alt="${name}" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;">
            </div>`;
          if (productImages.length > 1) {
            galleryHTML += `
              <div class="pm-thumbnails" style="display:flex;gap:8px;margin-top:10px;overflow-x:auto;padding-bottom:4px;width:100%;">
                ${productImages.map((img, idx) => `
                  <button type="button" class="pm-thumb-btn ${idx === 0 ? 'active' : ''}" data-img-src="${htmlEscape(img)}" style="border:2px solid ${idx === 0 ? '#ffffff' : 'rgba(255,255,255,0.18)'};background:#000;padding:0;border-radius:6px;cursor:pointer;overflow:hidden;width:58px;height:58px;flex-shrink:0;transition:all 0.15s ease;">
                    <img src="${htmlEscape(img)}" alt="Foto ${idx+1}" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;">
                  </button>
                `).join('')}
              </div>`;
          }
        } else {
          galleryHTML = `
            <div class="pm-main-img-wrap" style="position:relative;width:100%;aspect-ratio:4/5;background:#080808;border:1px solid rgba(255,255,255,0.12);border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
              <span class="pm-badge"${badgeStyle}>${badge}</span>
              <span style="font-size:24px;font-weight:700;color:#666;">${htmlEscape((p.id || 'NL').slice(0, 2).toUpperCase())}</span>
            </div>`;
        }

        // Cross-selling complementary products
        const recs = getCrossSellProducts(window.__CATALOG_PRODUCTS__ || [], [p], 4);
        let crossSellHTML = '';
        if (recs && recs.length > 0) {
          crossSellHTML = `
            <div class="pm-cross-sell" id="pmCrossSellSection">
              <div class="pm-cross-sell-head">
                <span class="bar-accent"></span>
                <div>
                  <h3 class="pm-cross-sell-title">COMPLETÁ TU COMPRA</h3>
                  <small class="pm-cross-sell-sub">También podés agregar · Prendas que combinan con este estilo</small>
                </div>
              </div>
              <div class="pm-cross-sell-grid" id="pmCrossSellGrid">
                ${renderModalCrossSellGridHTML(recs)}
              </div>
            </div>`;
        }

        const directNoticeHTML = '';

        const mainBtnIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>`;
        const mainBtnText = stock <= 0 ? 'SIN STOCK' : 'AGREGAR AL CARRITO';
        const mainBtnStyle = '';

        const pricing = getProductPricing(p);

        const promoBadgeModalHTML = (pricing.showPromoBadge && pricing.promoBadgeText)
          ? `<div style="background:#e50914;color:#fff;font-size:10px;font-weight:800;padding:4px 9px;border-radius:12px;letter-spacing:.05em;text-transform:uppercase;line-height:1.1;text-align:center;box-shadow:0 2px 8px rgba(229,9,20,0.3);white-space:nowrap;">${pricing.promoBadgeText}</div>`
          : '';

        const discountBadgeModalHTML = pricing.hasDiscount
          ? `<div style="background:#141414;border:1px solid #2e2e2e;color:#eee;font-size:12px;font-weight:600;padding:6px 10px;border-radius:6px;letter-spacing:.02em;">${pricing.discountPercent}% OFF ${pricing.discountText}</div>`
          : '';

        const priceAndPromoHTML = `
          <div style="background:#000;border:1px solid #222;border-radius:8px;padding:16px;margin:12px 0 16px;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;">
              <span style="font-size:26px;font-weight:800;letter-spacing:-0.02em;color:#fff;">${pricing.priceFormatted}</span>
              <span class="pm-stock-pill">${stockText}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;">
              ${discountBadgeModalHTML}
              ${promoBadgeModalHTML}
            </div>
            <div style="font-size:13px;color:#9ca3af;letter-spacing:.01em;margin-top:2px;">${pricing.installmentsCount} x ${pricing.installmentPriceStr} ${pricing.installmentsText}</div>
            ${(pricing.hasCashDiscount || pricing.cashPrice < pricing.basePrice) ? `<div style="font-size:15px;font-weight:700;color:#f43f5e;letter-spacing:.01em;margin-top:2px;">${pricing.cashPriceStr} ${pricing.cashText}</div>` : ''}
            <div style="font-size:15px;font-weight:700;color:#f43f5e;letter-spacing:.01em;margin-top:2px;">${pricing.transferPriceStr} ${pricing.transferText}</div>
          </div>
        `;

        body.innerHTML = `
          <div class="pm-main">
            <div class="pm-gallery">
              ${galleryHTML}
            </div>
            <div class="pm-info">
              <span class="pm-eyebrow">${htmlEscape(cat.toUpperCase())} // CREW N.L.</span>
              <h2 class="pm-title" id="pmTitle">${name}</h2>
              ${priceAndPromoHTML}
              <p class="pm-desc">${desc}</p>
              ${sizesHTML}
              ${directNoticeHTML}
              <button type="button" class="pm-btn-add" id="pmMainAddBtn"${mainBtnStyle} ${stock <= 0 ? 'disabled' : ''}>
                ${mainBtnIcon}
                <span>${mainBtnText}</span>
              </button>
            </div>
          </div>
          ${crossSellHTML}
        `;

        bindProductModalEvents(body);
      }

      function bindProductModalEvents(container) {
        // Thumbnail image selection
        container.querySelectorAll('.pm-thumb-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const src = btn.dataset.imgSrc;
            const mainImg = container.querySelector('#pmMainImg');
            if (mainImg && src) {
              mainImg.src = src;
              container.querySelectorAll('.pm-thumb-btn').forEach(b => {
                b.style.borderColor = 'rgba(255,255,255,0.18)';
                b.classList.remove('active');
              });
              btn.style.borderColor = '#ffffff';
              btn.classList.add('active');
            }
          });
        });

        // Size selection
        container.querySelectorAll('[data-pm-size]').forEach(btn => {
          btn.addEventListener('click', () => {
            selectedModalSize = btn.dataset.pmSize;
            container.querySelectorAll('[data-pm-size]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
          });
        });

        // Main Add to Cart button
        const mainAdd = container.querySelector('#pmMainAddBtn');
        if (mainAdd && currentModalProduct) {
          mainAdd.addEventListener('click', () => {
            try {
              if (window.shop && typeof window.shop.addToCart === 'function') {
                const pricing = getProductPricing(currentModalProduct);
                window.shop.addToCart({
                  ...currentModalProduct,
                  id: currentModalProduct.id,
                  name: currentModalProduct.name,
                  price: Number(currentModalProduct.price) || 0,
                  image: currentModalProduct.image_url || '',
                  stock: Number(currentModalProduct.stock) || 0,
                  sizes: currentModalProduct.sizes || '',
                  size: selectedModalSize || '',
                  qty: 1,
                  direct_purchase: false,
                  allowed_payment_methods: currentModalProduct.allowed_payment_methods,
                  allowed_installments: currentModalProduct.allowed_installments,
                  direct_discount_percent: pricing.discountPercent,
                  direct_discount_text: pricing.discountText,
                  direct_custom_transfer_price: currentModalProduct.direct_custom_transfer_price,
                  direct_transfer_price: pricing.transferPrice,
                  cash_discount_percent: pricing.cashDiscountPercent,
                  cash_discount_text: pricing.cashDiscountText,
                  cash_custom_price: currentModalProduct.cash_custom_price,
                  cash_text: pricing.cashText,
                  direct_installments_count: pricing.installmentsCount,
                  direct_installments_text: pricing.installmentsText,
                });
                mainAdd.classList.add('added-feedback');
                const span = mainAdd.querySelector('span');
                if (span) span.textContent = '✓ AGREGADO AL CARRITO';
                setTimeout(() => {
                  mainAdd.classList.remove('added-feedback');
                  if (span) span.textContent = 'AGREGAR AL CARRITO';
                }, 1400);

                // Re-evaluate modal cross-sell recommendations
                refreshModalCrossSell();
              }
            } catch (err) {
              console.warn('[pm-add]', err);
            }
          });
        }

        // Complementary Cross-Sell "+ AGREGAR" buttons
        container.querySelectorAll('[data-pm-rec-add]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const recId = btn.dataset.pmRecAdd;
            const recProd = (window.__CATALOG_PRODUCTS__ || []).find(p => String(p.id) === String(recId));
            if (!recProd) return;

            try {
              if (window.shop && typeof window.shop.addToCart === 'function') {
                window.shop.addToCart({
                  id: recProd.id,
                  name: recProd.name,
                  price: Number(recProd.price) || 0,
                  image: recProd.image_url || '',
                  stock: Number(recProd.stock) || 0,
                  sizes: recProd.sizes || '',
                  qty: 1
                });

                btn.classList.add('added');
                btn.textContent = '✓ AGREGADO';

                // Automatically refresh cross-sell
                setTimeout(() => {
                  refreshModalCrossSell();
                }, 400);
              }
            } catch (err) {
              console.warn('[pm-rec-add]', err);
            }
          });
        });
      }

      function refreshModalCrossSell() {
        if (!currentModalProduct) return;
        const grid = document.getElementById('pmCrossSellGrid');
        const section = document.getElementById('pmCrossSellSection');
        if (!grid || !section) return;

        const recs = getCrossSellProducts(window.__CATALOG_PRODUCTS__ || [], [currentModalProduct], 4);
        if (!recs || !recs.length) {
          section.style.display = 'none';
          grid.innerHTML = '';
          return;
        }

        section.style.display = 'block';
        grid.innerHTML = renderModalCrossSellGridHTML(recs);
        bindProductModalEvents(document.getElementById('productModalBody'));
      }

      // Close modal bindings
      const closeBtn = document.getElementById('closeProductModalBtn');
      if (closeBtn) closeBtn.addEventListener('click', closeProductModal);

      const modalEl = document.getElementById('productModal');
      if (modalEl) {
        modalEl.addEventListener('click', (e) => {
          if (e.target === modalEl) closeProductModal();
        });
      }

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeProductModal();
      });

      window.addEventListener('hashchange', () => {
        if (window.location.hash.startsWith('#producto-')) {
          const pid = decodeURIComponent(window.location.hash.replace('#producto-', ''));
          const found = (window.__CATALOG_PRODUCTS__ || []).find(p => String(p.id) === String(pid));
          if (found) openProductModal(found);
        } else if (modalEl && modalEl.classList.contains('open')) {
          closeProductModal();
        }
      });

      function mountAddToCart(root) {
        root.querySelectorAll('.btn-add:not([data-mounted="1"])').forEach(btn => {
          btn.dataset.mounted = '1';
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            try {
              const card = btn.closest('.product');
              if (!card) return;
              const rawSizes = card.dataset.sizes || '';
              const sizeList = rawSizes.split(/\s*[-|/,]\s*/).map(s => s.trim()).filter(Boolean);

              let allowedMethods = null;
              let allowedInstallments = null;
              try {
                if (card.dataset.allowedMethods) allowedMethods = JSON.parse(card.dataset.allowedMethods);
                if (card.dataset.allowedInstallments) allowedInstallments = JSON.parse(card.dataset.allowedInstallments);
              } catch (_) {}

              const prod = (window.__CATALOG_PRODUCTS__ || []).find(p => String(p.id) === String(card.dataset.id));
              const item = prod ? {
                ...prod,
                id: prod.id,
                name: prod.name,
                price: Number(prod.price) || 0,
                image: prod.image_url || card.dataset.image || '',
                stock: Number(prod.stock) || 0,
                sizes: prod.sizes || card.dataset.sizes || '',
                qty: 1,
                size: sizeList.length === 1 ? sizeList[0] : '',
                direct_purchase: false,
                direct_discount_percent: prod.direct_discount_percent !== undefined ? prod.direct_discount_percent : 0,
                direct_discount_text: prod.direct_discount_text || 'con transferencia',
                direct_custom_transfer_price: prod.direct_custom_transfer_price || null,
                cash_discount_percent: prod.cash_discount_percent !== undefined ? prod.cash_discount_percent : 0,
                cash_discount_text: prod.cash_discount_text || 'en efectivo',
                cash_custom_price: prod.cash_custom_price || null,
                cash_text: prod.cash_text || 'en Efectivo',
              } : {
                id: card.dataset.id || ('local-' + Math.random().toString(36).slice(2, 10)),
                name: card.dataset.name || 'Producto',
                price: Number(card.dataset.price) || 0,
                image: card.dataset.image || '',
                stock: Number(card.dataset.stock) || 0,
                sizes: card.dataset.sizes || '',
                qty: 1,
                size: sizeList.length === 1 ? sizeList[0] : '',
                direct_purchase: false,
                allowed_payment_methods: allowedMethods,
                allowed_installments: allowedInstallments,
                direct_discount_percent: Number(card.dataset.discountPercent || 25),
                direct_discount_text: card.dataset.discountText || 'con transferencia',
                direct_custom_transfer_price: card.dataset.customTransfer ? Number(card.dataset.customTransfer) : null,
                cash_discount_percent: Number(card.dataset.cashDiscountPercent || 0),
                cash_discount_text: card.dataset.cashDiscountText || 'en efectivo',
                cash_custom_price: card.dataset.customCash ? Number(card.dataset.customCash) : null,
                direct_installments_count: Number(card.dataset.installmentsCount || 6),
                direct_installments_text: card.dataset.installmentsText || 'sin interés',
              };

              if (window.shop && typeof window.shop.addToCart === 'function') {
                window.shop.addToCart(item);
              } else if (window.cart && typeof window.cart.add === 'function') {
                window.cart.add({ ...btn.closest('.product').dataset, qty: 1 });
              }
            } catch (err) { console.warn('[add-cart]', err); }
          });
        });
      }

      function mountProductCardClicks(root) {
        root.querySelectorAll('.product:not([data-click-mounted="1"])').forEach(card => {
          card.dataset.clickMounted = '1';
          card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-add')) return;
            const id = card.dataset.id;
            const prod = (window.__CATALOG_PRODUCTS__ || []).find(p => String(p.id) === String(id));
            if (prod) {
              openProductModal(prod);
            }
          });
        });
      }

      let allCatalogProducts = [];
      let allCategoriesData = [];

      function getActiveRoute(categories) {
        if (window.__DYNAMIC_ROUTE__ && window.__DYNAMIC_ROUTE__.category) {
          return {
            category: String(window.__DYNAMIC_ROUTE__.category).toLowerCase().trim(),
            categoryName: window.__DYNAMIC_ROUTE__.categoryName || null,
            subcategory: window.__DYNAMIC_ROUTE__.subcategory ? String(window.__DYNAMIC_ROUTE__.subcategory).toLowerCase().trim() : null,
            subcategoryName: window.__DYNAMIC_ROUTE__.subcategoryName || null,
          };
        }

        const pathname = window.location.pathname.replace(/^\/|\/$/g, '');
        if (!pathname || pathname === 'index.html') return null;

        const parts = pathname.split('/');
        const first = parts[0] ? parts[0].toLowerCase() : '';
        const second = parts[1] ? parts[1].toLowerCase() : null;

        if (['admin', 'api', 'assets', 'components', 'login', 'register'].includes(first)) return null;

        const catExists = categories.find((c) => c.slug.toLowerCase() === first);
        if (catExists) {
          const subExists = second && catExists.subcategories ? catExists.subcategories.find((s) => s.slug.toLowerCase() === second) : null;
          return {
            category: catExists.slug,
            categoryName: catExists.name,
            subcategory: subExists ? subExists.slug : (second || null),
            subcategoryName: subExists ? subExists.name : null,
          };
        }

        return null;
      }

      function renderDynamicBanner(activeRoute, catObj, catItems, filteredItems) {
        const banner = document.getElementById('dynamicCategoryBanner');
        if (!banner) return;

        const catName = (catObj && catObj.name) || activeRoute.categoryName || activeRoute.category.toUpperCase();
        const catSlug = (catObj && catObj.slug) || activeRoute.category;
        const subSlug = activeRoute.subcategory;

        let subName = activeRoute.subcategoryName;
        if (!subName && subSlug && catObj && Array.isArray(catObj.subcategories)) {
          const foundSub = catObj.subcategories.find((s) => s.slug.toLowerCase() === subSlug);
          if (foundSub) subName = foundSub.name;
        }
        if (!subName && subSlug) subName = subSlug.toUpperCase();

        const countText = `${filteredItems.length} PRODUCTO${filteredItems.length === 1 ? '' : 'S'}`;

        // Build breadcrumbs
        const breadcrumbsHtml = `
          <div class="dynamic-cat-breadcrumbs">
            <a href="/" data-nav-home="true">INICIO</a>
            <span class="sep">/</span>
            <a href="/${htmlEscape(catSlug)}" data-nav-cat="${htmlEscape(catSlug)}" class="${!subSlug ? 'curr' : ''}">${htmlEscape(catName.toUpperCase())}</a>
            ${subSlug ? `<span class="sep">/</span><span class="curr">${htmlEscape(subName.toUpperCase())}</span>` : ''}
          </div>
          <a href="/" data-nav-home="true" class="dynamic-cat-back-link">← VOLVER A LA TIENDA COMPLETA</a>
        `;

        // Build title and badge
        const titleText = subSlug ? `${catName} · ${subName}` : catName;
        const headerHtml = `
          <div class="dynamic-cat-header">
            <h2 class="dynamic-cat-title">${htmlEscape(titleText.toUpperCase())}</h2>
            <span class="dynamic-cat-badge">${countText}</span>
          </div>
        `;

        // Build subcategory pills
        const subcategories = (catObj && Array.isArray(catObj.subcategories)) ? catObj.subcategories : [];
        let pillsHtml = '';
        if (subcategories.length > 0) {
          const allPill = `
            <a href="/${htmlEscape(catSlug)}" data-nav-cat="${htmlEscape(catSlug)}" class="dynamic-subcat-pill ${!subSlug ? 'active' : ''}">
              TODOS <span class="pill-count">(${catItems.length})</span>
            </a>
          `;
          const subPills = subcategories.map((sub) => {
            const subCount = catItems.filter((p) => String(p.subcategory || '').toLowerCase() === sub.slug.toLowerCase()).length;
            const isSubActive = subSlug && subSlug.toLowerCase() === sub.slug.toLowerCase();
            return `
              <a href="/${htmlEscape(catSlug)}/${htmlEscape(sub.slug)}" data-nav-cat="${htmlEscape(catSlug)}" data-nav-sub="${htmlEscape(sub.slug)}" class="dynamic-subcat-pill ${isSubActive ? 'active' : ''}">
                ${htmlEscape(sub.name.toUpperCase())} <span class="pill-count">(${subCount})</span>
              </a>
            `;
          }).join('');
          pillsHtml = `<div class="dynamic-subcat-pills-bar">${allPill}${subPills}</div>`;
        }

        banner.innerHTML = `
          <div class="dynamic-cat-top">${breadcrumbsHtml}</div>
          ${headerHtml}
          ${pillsHtml}
        `;
        banner.style.display = 'block';

        // Bind clicks on banner links for smooth pushState navigation
        banner.querySelectorAll('a[data-nav-cat], a[data-nav-home]').forEach((link) => {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (link.dataset.navHome) {
              window.__DYNAMIC_ROUTE__ = null;
              history.pushState(null, '', href);
              applyRouteView();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              const targetCat = link.dataset.navCat;
              const targetSub = link.dataset.navSub || null;
              window.__DYNAMIC_ROUTE__ = { category: targetCat, subcategory: targetSub };
              history.pushState(null, '', href);
              applyRouteView();
              const bannerEl = document.getElementById('dynamicCategoryBanner');
              if (bannerEl) bannerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        });
      }

      function ensureCategorySection(catSlug, catName, catSubtitle) {
        let sec = document.getElementById(catSlug);
        const rawSub = catSubtitle && String(catSubtitle).trim() ? String(catSubtitle).trim() : 'CARGADO DESDE PANEL ADMIN';
        const formattedSub = rawSub.startsWith('·') ? rawSub : `· ${rawSub}`;

        if (sec) {
          const h3 = sec.querySelector('.section-label h3');
          if (h3 && catName) h3.textContent = catName.toUpperCase();
          const small = sec.querySelector('.section-label small');
          if (small) small.textContent = formattedSub;
          return sec;
        }

        // Si es una categoría nueva agregada dinámicamente, la creamos antes de como-comprar
        sec = document.createElement('section');
        sec.className = 'catalog-section';
        sec.id = catSlug;
        sec.innerHTML = `
          <div class="section-label scroll-reveal">
            <span class="bar"></span>
            <div>
              <h3>${htmlEscape(catName.toUpperCase())}</h3>
              <small>${htmlEscape(formattedSub)}</small>
            </div>
          </div>
          <div class="products" data-category="${htmlEscape(catSlug)}"></div>
        `;
        const refSection = document.getElementById('como-comprar');
        if (refSection && refSection.parentElement) {
          refSection.parentElement.insertBefore(sec, refSection);
        } else {
          const main = document.querySelector('main');
          if (main) main.appendChild(sec);
        }
        return sec;
      }

      function syncCatalogWithCategories(categories) {
        if (!Array.isArray(categories) || !categories.length) return;

        // 1. Sincronizar Header Dropdown
        const navGrid = document.getElementById('navDropdownGrid');
        if (navGrid) {
          navGrid.innerHTML = categories.map((c, idx) => {
            const num = String(idx + 1).padStart(2, '0');
            const desc = c.subtitle && String(c.subtitle).trim() ? String(c.subtitle).trim() : 'Ver productos y colección';
            return `
              <a href="/${htmlEscape(c.slug)}" class="nav-dropdown-item" role="menuitem">
                <span class="nav-dd-badge">${num}</span>
                <div class="nav-dd-info">
                  <span class="nav-dd-name">${htmlEscape(c.name.toUpperCase())}</span>
                  <span class="nav-dd-desc">${htmlEscape(desc)}</span>
                </div>
              </a>
            `;
          }).join('');
        }

        // 2. Sincronizar grilla de Categorías (Acceso Rápido)
        const secGrid = document.getElementById('seccionesGrid');
        if (secGrid) {
          secGrid.innerHTML = categories.map((c, idx) => {
            const num = String(idx + 1).padStart(2, '0');
            return `
              <a href="/${htmlEscape(c.slug)}" class="category scroll-reveal is-visible">
                <span class="num">${num}</span>
                <h3>${htmlEscape(c.name.toUpperCase())}</h3>
                <span class="view">VER MÁS <span>↗</span></span>
              </a>
            `;
          }).join('');
          if (typeof window.initScrollReveal === 'function') {
            window.initScrollReveal(secGrid);
          }
        }

        // 3. Sincronizar menú móvil
        const mobNav = document.getElementById('mobileNavLinks');
        if (mobNav) {
          mobNav.innerHTML = `
            <a href="/" class="active" id="mobileNavInicioLink">INICIO</a>
            ${categories.map(c => `<a href="/${htmlEscape(c.slug)}">${htmlEscape(c.name.toUpperCase())}</a>`).join('')}
            <a href="/#como-comprar">¿CÓMO COMPRAR?</a>
            <a href="/#politicas-cambio">POLÍTICAS DE CAMBIO</a>
            <a href="/#contacto">CONTACTO</a>
          `;
        }

        // 4. Asegurar existencia de secciones del catálogo con sus subtítulos dinámicos
        categories.forEach((c) => {
          ensureCategorySection(c.slug, c.name, c.subtitle);
        });

        // 5. Quitar secciones huérfanas en el DOM que hayan sido eliminadas
        const validSlugs = new Set(categories.map(c => c.slug.toLowerCase()));
        document.querySelectorAll('.catalog-section').forEach((sec) => {
          const id = sec.id.toLowerCase();
          if (id && !validSlugs.has(id)) {
            sec.remove();
          }
        });

        bindCategoryNavigationLinks();
      }

      function bindCategoryNavigationLinks() {
        const catSlugs = new Set(allCategoriesData.map(c => c.slug.toLowerCase()));
        document.querySelectorAll('a[href]').forEach((a) => {
          const href = a.getAttribute('href');
          if (!href || href === '/' || href.startsWith('/#') || href.startsWith('http') || href.startsWith('/admin') || href.startsWith('/api') || href.startsWith('javascript:')) return;
          const slug = href.replace(/^\//, '').split('/')[0].toLowerCase();
          if (catSlugs.has(slug)) {
            if (a.dataset.catNavBound) return;
            a.dataset.catNavBound = 'true';
            a.addEventListener('click', (e) => {
              e.preventDefault();
              const parts = href.replace(/^\//, '').split('/');
              window.__DYNAMIC_ROUTE__ = { category: parts[0].toLowerCase(), subcategory: parts[1] ? parts[1].toLowerCase() : null };
              history.pushState(null, '', href);
              applyRouteView();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            });
          }
        });
      }

      function applyRouteView() {
        const activeRoute = getActiveRoute(allCategoriesData);
        const banner = document.getElementById('dynamicCategoryBanner');
        const heroEl = document.getElementById('inicio');
        const categoriesGrid = document.querySelector('.categories');
        const promoBannerSec = document.getElementById('promo-banner');
        const shippingPromo = document.getElementById('shippingPromoBanner');
        const howToBuy = document.getElementById('como-comprar');
        const returnPolicy = document.getElementById('politicas-cambio');
        const navInicio = document.getElementById('navInicioLink');
        const mobileNavInicio = document.getElementById('mobileNavInicioLink');

        if (activeRoute && activeRoute.category) {
          const catSlug = activeRoute.category.toLowerCase();
          const subSlug = activeRoute.subcategory ? activeRoute.subcategory.toLowerCase() : null;

          const catObj = allCategoriesData.find((c) => c.slug.toLowerCase() === catSlug) || {
            slug: catSlug,
            name: activeRoute.categoryName || catSlug,
            subtitle: activeRoute.categorySubtitle || 'CARGADO DESDE PANEL ADMIN',
            subcategories: [],
          };

          ensureCategorySection(catSlug, catObj.name, catObj.subtitle);

          // Update Document Title
          let pageTitle = catObj.name.toUpperCase();
          if (subSlug) {
            const foundSub = catObj.subcategories ? catObj.subcategories.find((s) => s.slug.toLowerCase() === subSlug) : null;
            const subTitle = foundSub ? foundSub.name : subSlug;
            pageTitle += ` · ${subTitle.toUpperCase()}`;
          }
          document.title = `${pageTitle} | NAREL LOCAL`;

          // Filter items
          const catItems = allCatalogProducts.filter((p) => String(p.category || '').toLowerCase() === catSlug);
          const filteredItems = subSlug
            ? catItems.filter((p) => String(p.subcategory || '').toLowerCase() === subSlug)
            : catItems;

          // Render dynamic banner
          renderDynamicBanner(activeRoute, catObj, catItems, filteredItems);

          // Adapt other page elements for a dedicated individual category page
          document.body.classList.add('is-category-page');
          if (heroEl) heroEl.style.display = 'none';
          if (categoriesGrid) categoriesGrid.style.display = 'none';
          if (promoBannerSec) promoBannerSec.style.display = 'none';
          if (shippingPromo) shippingPromo.style.display = 'none';
          if (howToBuy) howToBuy.style.display = 'block';
          if (returnPolicy) returnPolicy.style.display = 'block';

          if (navInicio) navInicio.classList.remove('active');
          if (mobileNavInicio) mobileNavInicio.classList.remove('active');

          // Highlight category in navigation
          document.querySelectorAll('.nav-dropdown-item, .mobile-nav-links a').forEach((el) => {
            const href = el.getAttribute('href') || '';
            if (href === `/${catSlug}` || href.startsWith(`/${catSlug}/`)) {
              el.classList.add('active');
            } else if (href !== '/' && !href.startsWith('/#')) {
              el.classList.remove('active');
            }
          });

          // Show target category section and general sections
          document.querySelectorAll('.catalog-section').forEach((sec) => {
            const secId = sec.id.toLowerCase();
            if (secId === catSlug || secId === 'como-comprar' || secId === 'politicas-cambio') {
              sec.style.display = 'block';
              if (secId === catSlug) {
                const label = sec.querySelector('.section-label');
                if (label) label.style.display = 'none'; // Header already in banner
              }

              const container = sec.querySelector('.products[data-category]');
              if (container) {
                if (filteredItems.length === 0) {
                  const subLabel = activeRoute.subcategoryName || (subSlug ? subSlug.toUpperCase() : 'esta sección');
                  container.innerHTML = `
                    <div class="dynamic-empty-subcat">
                      <h4>No hay productos disponibles en ${htmlEscape(subLabel)}</h4>
                      <p>Podés explorar todos los modelos de ${htmlEscape(catObj.name)} o escribirnos para consultar ingresos.</p>
                      <a href="/${htmlEscape(catSlug)}" data-nav-cat="${htmlEscape(catSlug)}">VER TODOS LOS ${htmlEscape(catObj.name).toUpperCase()}</a>
                    </div>
                  `;
                  const backBtn = container.querySelector('a[data-nav-cat]');
                  if (backBtn) {
                    backBtn.addEventListener('click', (e) => {
                      e.preventDefault();
                      window.__DYNAMIC_ROUTE__ = { category: catSlug, subcategory: null };
                      history.pushState(null, '', `/${catSlug}`);
                      applyRouteView();
                    });
                  }
                } else {
                  container.innerHTML = filteredItems.map(productCardHTML).join('');
                  mountAddToCart(container);
                  mountProductCardClicks(container);
                }
              }
            } else {
              sec.style.display = 'none';
            }
          });
        } else {
          // Home / Full store view
          document.title = 'NAREL LOCAL | STREETWEAR & CULTURE';
          document.body.classList.remove('is-category-page');
          if (banner) banner.style.display = 'none';
          if (heroEl) heroEl.style.display = '';
          if (categoriesGrid) categoriesGrid.style.display = '';
          if (shippingPromo) shippingPromo.style.display = '';
          if (howToBuy) howToBuy.style.display = '';
          if (returnPolicy) returnPolicy.style.display = '';

          if (navInicio) navInicio.classList.add('active');
          if (mobileNavInicio) mobileNavInicio.classList.add('active');

          document.querySelectorAll('.nav-dropdown-item, .mobile-nav-links a').forEach((el) => {
            if (el.getAttribute('href') !== '/') {
              el.classList.remove('active');
            }
          });

          allCategoriesData.forEach((c) => {
            ensureCategorySection(c.slug, c.name, c.subtitle);
          });

          document.querySelectorAll('.catalog-section').forEach((sec) => {
            sec.style.display = '';
            const label = sec.querySelector('.section-label');
            if (label) label.style.display = '';

            const cat = sec.id.toLowerCase();
            const container = sec.querySelector('.products[data-category]');
            if (container) {
              const items = allCatalogProducts.filter((p) => String(p.category || '').toLowerCase() === cat);
              if (!items.length) {
                container.innerHTML = '';
              } else {
                container.innerHTML = items.map(productCardHTML).join('');
                mountAddToCart(container);
                mountProductCardClicks(container);
              }
            }
          });
        }
      }

      async function renderProducts() {
        try {
          // Fetch categories hierarchy
          try {
            const catRes = await fetch('/api/categories/public', {
              headers: { 'Accept': 'application/json' },
            });
            if (catRes.ok) {
              const catJson = await catRes.json();
              if (catJson && catJson.ok && Array.isArray(catJson.data)) {
                allCategoriesData = catJson.data;
                syncCatalogWithCategories(allCategoriesData);
              }
            }
          } catch (_catErr) {
            console.warn('No se pudieron cargar categorías dinámicas:', _catErr);
          }

          // Fetch products
          const res = await fetch('/api/products/public?limit=200', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json' }
          });
          if (!res.ok) throw new Error('status=' + res.status);
          const json = await res.json();
          if (!json || !json.ok) throw new Error(json && json.message ? json.message : 'error');
          const list = Array.isArray(json.data) ? json.data : [];

          list.forEach(p => { if (!p.category) p.category = guessCategory(p.name, p.description); });

          allCatalogProducts = list;
          window.__CATALOG_PRODUCTS__ = list;
          window.dispatchEvent(new CustomEvent('catalog:loaded', { detail: list }));

          // Render view according to current route
          applyRouteView();

          // Intercept category navigation links
          bindCategoryNavigationLinks();

          // Intercept INICIO link to navigate back to home
          document.querySelectorAll('a[href="/"], a.logo').forEach((a) => {
            a.addEventListener('click', (e) => {
              if (window.__DYNAMIC_ROUTE__ || window.location.pathname !== '/') {
                e.preventDefault();
                window.__DYNAMIC_ROUTE__ = null;
                history.pushState(null, '', '/');
                applyRouteView();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            });
          });

          // Bind smooth scroll for hash section links (como-comprar, politicas-cambio)
          document.querySelectorAll('a[href*="#como-comprar"], a[href*="#politicas-cambio"]').forEach((a) => {
            a.addEventListener('click', (e) => {
              const href = a.getAttribute('href') || '';
              const hashMatch = href.match(/#(como-comprar|politicas-cambio)/);
              if (hashMatch && hashMatch[1]) {
                const targetId = hashMatch[1];
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                  e.preventDefault();
                  targetEl.style.display = 'block';
                  targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }
            });
          });

          // Check if URL opened with a product hash
          if (window.location.hash.startsWith('#producto-')) {
            const pid = decodeURIComponent(window.location.hash.replace('#producto-', ''));
            const found = list.find(p => String(p.id) === String(pid));
            if (found) openProductModal(found);
          }
        } catch (err) {
          console.warn('[render-products] No se pudieron cargar productos:', err.message || err);
        }
      }

      window.addEventListener('popstate', () => {
        const path = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
        const parts = path.split('/');
        if (parts.length >= 1 && parts[0] && !parts[0].includes('.')) {
          window.__DYNAMIC_ROUTE__ = {
            category: parts[0],
            subcategory: parts[1] || null,
          };
        } else {
          window.__DYNAMIC_ROUTE__ = null;
        }
        applyRouteView();
      });

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderProducts);
      } else {
        renderProducts();
      }
    })();
  