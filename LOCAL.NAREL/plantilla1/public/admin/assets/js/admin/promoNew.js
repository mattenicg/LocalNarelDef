(function () {
  'use strict';

  let selectedFile = null;
  let localPreviewUrl = null;
  let productsAll = [];
  let selectedProducts = new Map();

  window.addEventListener('DOMContentLoaded', init);

  async function init() {
    const user = await window.auth.requireAuth({ requireAdmin: true });
    if (!user) return;
    if (typeof window.initSupabaseBrowser === 'function') {
      window.initSupabaseBrowser().catch(() => {});
    }

    setDefaultDates();
    bindImage();
    bindBadgePreview();
    bindDiscountTypeHelp();
    bindForm();
    await cargarProductosCatalogo();
    bindProductSearch();
  }

  function setDefaultDates() {
    const startEl = document.getElementById('start_date');
    if (startEl && !startEl.value) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      startEl.value = now.toISOString().slice(0, 16);
    }
  }

  function bindImage() {
    const input = document.getElementById('banner_image');
    const wrap = document.getElementById('imagePreviewWrap');
    const img = document.getElementById('imagePreviewImg');
    const info = document.getElementById('imageInfoText');
    const removeBtn = document.getElementById('removeImageBtn');

    function clearPreview() {
      selectedFile = null;
      if (localPreviewUrl) { try { URL.revokeObjectURL(localPreviewUrl); } catch (_e) {} localPreviewUrl = null; }
      if (input) input.value = '';
      if (wrap) wrap.style.display = 'none';
      if (img) img.removeAttribute('src');
      if (info) info.textContent = '—';
    }

    if (input) {
      input.addEventListener('change', function () {
        const file = input.files && input.files[0];
        if (!file) { clearPreview(); return; }
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.type || '')) {
          window.auth.setMessage('formMessage', 'Formato no permitido. Solo JPG, JPEG, PNG y WEBP.', 'error');
          clearPreview();
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          window.auth.setMessage('formMessage', 'La imagen supera el tamaño máximo permitido (5 MB).', 'error');
          clearPreview();
          return;
        }
        selectedFile = file;
        if (localPreviewUrl) { try { URL.revokeObjectURL(localPreviewUrl); } catch (_e) {} }
        localPreviewUrl = URL.createObjectURL(file);
        img.src = localPreviewUrl;
        const kb = Math.round(file.size / 1024);
        const sizeStr = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
        info.textContent = `${escapeHtml(file.name)} · ${sizeStr} · ${escapeHtml(file.type || '')}`;
        wrap.style.display = 'flex';
        window.auth.setMessage('formMessage', '', 'info');
      });
    }
    if (removeBtn) removeBtn.addEventListener('click', clearPreview);
  }

  function bindBadgePreview() {
    const labelEl = document.getElementById('badge_label');
    const colorEl = document.getElementById('badge_color');
    const preview = document.getElementById('badgePreview');
    if (!preview) return;
    function update() {
      const label = (labelEl?.value || '').trim() || 'OFERTA';
      const color = colorEl?.value || '#ef4444';
      preview.textContent = label.toUpperCase();
      preview.style.background = color;
      const luminance = getLuminance(color);
      preview.style.color = luminance > 0.5 ? '#000' : '#fff';
    }
    if (labelEl) labelEl.addEventListener('input', update);
    if (colorEl) colorEl.addEventListener('input', update);
    update();
  }

  function getLuminance(hex) {
    const h = String(hex || '').replace('#', '');
    if (h.length !== 6) return 0;
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  function bindDiscountTypeHelp() {
    const typeEl = document.getElementById('discount_type');
    const helpEl = document.getElementById('discountValueHelp');
    const valEl = document.getElementById('discount_value');
    if (!typeEl || !helpEl) return;
    function update() {
      const v = typeEl.value || 'override_products';
      if (v === 'override_products') {
        helpEl.textContent = 'El precio lo definís en cada producto de abajo';
        if (valEl) valEl.placeholder = 'No aplica para este tipo';
      } else if (v === 'percentage') {
        helpEl.textContent = 'Porcentaje global a todos los productos. Ej: 30 → 30% off';
        if (valEl) valEl.placeholder = '30';
      } else if (v === 'fixed_amount') {
        helpEl.textContent = 'Monto fijo a descontar a cada producto. Ej: 5000 → -$5000';
        if (valEl) valEl.placeholder = '5000';
      } else if (v === 'combo_price') {
        helpEl.textContent = 'Precio final para TODO el combo/pack completo. Ej: 19990';
        if (valEl) valEl.placeholder = '19990';
      }
    }
    typeEl.addEventListener('change', update);
    update();
  }

  function bindProductSearch() {
    const input = document.getElementById('productSearch');
    if (!input) return;
    let t;
    input.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(() => renderProductsList(input.value || ''), 150);
    });
  }

  async function cargarProductosCatalogo() {
    const listEl = document.getElementById('productsList');
    try {
      const res = await window.auth.apiFetch('/api/admin/products?limit=500', { method: 'GET' });
      if (!res.ok) throw new Error(res.message || 'Error al cargar catálogo');
      productsAll = Array.isArray(res.data) ? res.data : [];
      renderProductsList('');
    } catch (err) {
      if (listEl) listEl.innerHTML = `<div style="padding:20px;color:#ef4444;font-family:'DM Mono',monospace;font-size:12px;">${escapeHtml(err.message || 'Error al cargar productos')}</div>`;
    }
  }

  function renderProductsList(query) {
    const listEl = document.getElementById('productsList');
    if (!listEl) return;
    const q = (query || '').trim().toLowerCase();
    const list = q
      ? productsAll.filter((p) => ((p.name || '') + ' ' + (p.description || '') + ' ' + (p.category || '')).toLowerCase().includes(q))
      : productsAll;

    if (!list.length) {
      listEl.innerHTML = `<div style="padding:20px;text-align:center;color:#555;font-family:'DM Mono',monospace;font-size:12px;">${q ? 'Sin resultados' : 'No hay productos cargados'}</div>`;
      return;
    }

    listEl.innerHTML = '';
    const frag = document.createDocumentFragment();

    list.forEach((p) => {
      const isSel = selectedProducts.has(p.id);
      const row = document.createElement('div');
      row.className = 'product-row' + (isSel ? ' selected' : '');
      row.innerHTML = `
        <div class="product-row-img">
          ${p.image_url ? `<img src="${escapeAttr(p.image_url)}" alt="" onerror="this.style.display='none';">` : ''}
        </div>
        <div style="text-align:center;">
          <input type="checkbox" class="product-toggle" data-id="${escapeAttr(p.id)}" ${isSel ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;">
        </div>
        <div>
          <div class="product-row-name">${escapeHtml(p.name || '(Sin nombre)')}</div>
          <div class="product-row-meta">${escapeHtml((p.category || '').toUpperCase())} · Stock ${p.stock ?? 0} · Precio $${Math.round(Number(p.price || 0))}</div>
        </div>
        <div style="text-align:right;color:#888;font-family:'DM Mono',monospace;font-size:11px;">
          $${Math.round(Number(p.price || 0))}
        </div>
      `;
      frag.appendChild(row);
    });
    listEl.appendChild(frag);

    listEl.querySelectorAll('.product-row').forEach((row) => {
      row.addEventListener('click', function (e) {
        if (e.target.tagName === 'INPUT') return;
        const cb = row.querySelector('input.product-toggle');
        if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); }
      });
    });
    listEl.querySelectorAll('input.product-toggle').forEach((cb) => {
      cb.addEventListener('change', function () {
        const pid = cb.getAttribute('data-id');
        if (!pid) return;
        const product = productsAll.find((x) => x.id === pid);
        if (cb.checked) {
          if (!selectedProducts.has(pid)) {
            selectedProducts.set(pid, {
              product_id: pid,
              product_ref: product,
              override_price: null,
              discount_percentage: null,
              product_note: '',
              sort_order: selectedProducts.size,
              active: true,
            });
          }
        } else {
          selectedProducts.delete(pid);
        }
        renderProductsList(document.getElementById('productSearch')?.value || '');
        renderSelectedProducts();
      });
    });
  }

  function renderSelectedProducts() {
    const wrap = document.getElementById('selectedProducts');
    if (!wrap) return;

    if (selectedProducts.size === 0) {
      wrap.innerHTML = `<div style="padding:30px;border:1px dashed #222;border-radius:8px;text-align:center;color:#555;font-family:'DM Mono',monospace;font-size:12px;">Todavía no agregaste ningún producto. Buscá y agregalos arriba.</div>`;
      return;
    }

    wrap.innerHTML = '';
    const frag = document.createDocumentFragment();
    let sortIdx = 0;

    selectedProducts.forEach((item, pid) => {
      const p = item.product_ref || {};
      const origPrice = Number(p.price || 0);
      item.sort_order = sortIdx++;
      const card = document.createElement('div');
      card.className = 'selected-product-card';
      card.dataset.productId = pid;
      card.innerHTML = `
        <div class="spc-header">
          <div class="spc-img">${p.image_url ? `<img src="${escapeAttr(p.image_url)}" alt="" onerror="this.style.display='none';">` : ''}</div>
          <div>
            <div class="spc-name">${escapeHtml(p.name || '(Producto)')}</div>
            <div class="spc-orig">Precio original: <span style="text-decoration:line-through;">$${Math.round(origPrice)}</span> · Categoría ${escapeHtml((p.category || '').toUpperCase())}</div>
          </div>
          <button type="button" class="spc-remove" data-remove="${escapeAttr(pid)}" title="Quitar">✕</button>
        </div>
        <div class="spc-fields">
          <div class="form-group">
            <div class="mini-label">Precio en Oferta ($)</div>
            <input type="number" min="0" step="0.01" class="form-control spc-override" placeholder="Dejar vacío = usar original" value="${item.override_price != null ? item.override_price : ''}">
          </div>
          <div class="form-group">
            <div class="mini-label">% Descuento (0-100)</div>
            <input type="number" min="0" max="100" step="0.01" class="form-control spc-pct" placeholder="Opcional" value="${item.discount_percentage != null ? item.discount_percentage : ''}">
          </div>
          <div class="form-group">
            <div class="mini-label">Nota / Info del producto en la promo</div>
            <input type="text" maxlength="300" class="form-control spc-note" placeholder="Ej: Solo color negro, talle S al L..." value="${escapeAttr(item.product_note || '')}">
          </div>
        </div>
      `;
      frag.appendChild(card);
    });
    wrap.appendChild(frag);

    wrap.querySelectorAll('.spc-remove').forEach((btn) => {
      btn.addEventListener('click', function () {
        const pid = btn.getAttribute('data-remove');
        if (!pid) return;
        selectedProducts.delete(pid);
        renderProductsList(document.getElementById('productSearch')?.value || '');
        renderSelectedProducts();
      });
    });

    wrap.querySelectorAll('.selected-product-card').forEach((card) => {
      const pid = card.dataset.productId;
      const item = selectedProducts.get(pid);
      if (!item) return;
      const ov = card.querySelector('.spc-override');
      const pct = card.querySelector('.spc-pct');
      const note = card.querySelector('.spc-note');
      if (ov) ov.addEventListener('input', () => {
        const v = ov.value.trim();
        item.override_price = (v === '') ? null : Number(v);
      });
      if (pct) pct.addEventListener('input', () => {
        const v = pct.value.trim();
        item.discount_percentage = (v === '') ? null : Number(v);
      });
      if (note) note.addEventListener('input', () => { item.product_note = (note.value || '').trim(); });
    });
  }

  function bindForm() {
    const form = document.getElementById('promoForm');
    if (form) form.addEventListener('submit', handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const msgId = 'formMessage';
    const btnId = 'submitBtn';

    const title = (document.getElementById('title')?.value || '').trim();
    const short_description = (document.getElementById('short_description')?.value || '').trim();
    const description = (document.getElementById('description')?.value || '').trim();
    const terms_and_conditions = (document.getElementById('terms_and_conditions')?.value || '').trim();
    const discount_type = document.getElementById('discount_type')?.value || 'override_products';
    const discount_value_raw = document.getElementById('discount_value')?.value;
    const start_date = document.getElementById('start_date')?.value;
    const end_date = document.getElementById('end_date')?.value;
    const badge_label = (document.getElementById('badge_label')?.value || '').trim();
    const badge_color = document.getElementById('badge_color')?.value || '#ef4444';
    const cta_text = (document.getElementById('cta_text')?.value || '').trim();
    const cta_link = (document.getElementById('cta_link')?.value || '').trim();
    const sort_order_raw = document.getElementById('sort_order')?.value;
    const active = !!document.getElementById('active')?.checked;
    const featured = !!document.getElementById('featured')?.checked;

    if (!title) {
      window.auth.setMessage(msgId, 'El título de la promoción es requerido', 'error');
      document.getElementById('title').focus();
      return;
    }
    if (!start_date) {
      window.auth.setMessage(msgId, 'La fecha de inicio es requerida', 'error');
      document.getElementById('start_date').focus();
      return;
    }
    if (end_date && new Date(end_date).getTime() <= new Date(start_date).getTime()) {
      window.auth.setMessage(msgId, 'La fecha de fin debe ser posterior al inicio', 'error');
      document.getElementById('end_date').focus();
      return;
    }
    if (selectedProducts.size === 0) {
      window.auth.setMessage(msgId, 'Agregá al menos UN producto a la promoción', 'error');
      return;
    }

    const discount_value = (discount_value_raw === '' || discount_value_raw == null) ? 0 : Number(discount_value_raw);
    const sort_order = Number.isInteger(Number(sort_order_raw)) ? Number(sort_order_raw) : 0;

    window.auth.setButtonLoading(btnId, true, 'GUARDANDO...');
    window.auth.setMessage(msgId, 'Procesando...', 'info');

    try {
      let banner_image_url = null;
      if (selectedFile) {
        window.auth.setMessage(msgId, 'Subiendo imagen del banner...', 'info');
        const fd = new FormData();
        fd.append('image', selectedFile);
        const upRes = await window.auth.apiFetch('/api/admin/products/upload-image', {
          method: 'POST',
          body: fd,
        });
        if (!upRes.ok) throw new Error(upRes.message || 'Error al subir la imagen');
        banner_image_url = upRes.image_url || (upRes.data && upRes.data.image_url) || null;
      }

      const products_payload = [];
      selectedProducts.forEach((item) => {
        products_payload.push({
          product_id: item.product_id,
          override_price: item.override_price,
          discount_percentage: item.discount_percentage,
          product_note: (item.product_note || '').trim() || null,
          sort_order: item.sort_order,
          active: true,
        });
      });

      const body = {
        title,
        short_description: short_description || null,
        description: description || null,
        terms_and_conditions: terms_and_conditions || null,
        discount_type,
        discount_value,
        start_date: new Date(start_date).toISOString(),
        end_date: end_date ? new Date(end_date).toISOString() : null,
        banner_image_url,
        badge_label: badge_label || null,
        badge_color,
        cta_text: cta_text || null,
        cta_link: cta_link || null,
        sort_order,
        active,
        featured,
        products: products_payload,
      };

      await submitRequest(body);

      window.auth.setMessage(msgId, 'Promoción guardada correctamente. Redirigiendo...', 'success');
      setTimeout(() => { window.location.replace('/admin/promos.html'); }, 900);
    } catch (err) {
      window.auth.setMessage(msgId, err.message || 'Error inesperado', 'error');
    } finally {
      window.auth.setButtonLoading(btnId, false);
    }
  }

  async function submitRequest(body) {
    const res = await window.auth.apiFetch('/api/admin/promotions', {
      method: 'POST',
      body,
    });
    if (!res.ok) throw new Error(res.message || 'Error al crear la promoción');
    return res;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  window.__PromoFormShared = {
    init,
    setDefaultDates,
    bindImage,
    bindBadgePreview,
    bindDiscountTypeHelp,
    bindProductSearch,
    cargarProductosCatalogo,
    renderProductsList,
    renderSelectedProducts,
    bindForm,
    getSelectedProductsMap: () => selectedProducts,
    setSelectedProductsMap: (m) => { selectedProducts = m || new Map(); },
    getSelectedFile: () => selectedFile,
    setSelectedFile: (f) => { selectedFile = f; },
    getLocalPreviewUrl: () => localPreviewUrl,
    setLocalPreviewUrl: (u) => { localPreviewUrl = u; },
    getProductsAll: () => productsAll,
    setProductsAll: (a) => { productsAll = a || []; },
  };
})();

async function logout() {
  try { await window.auth.apiFetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
  window.location.replace('/login.html');
}
