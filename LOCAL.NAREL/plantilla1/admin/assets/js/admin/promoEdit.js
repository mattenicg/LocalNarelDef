(function () {
  'use strict';

  window.addEventListener('DOMContentLoaded', init);

  async function init() {
    const user = await window.auth.requireAuth({ requireAdmin: true });
    if (!user) return;
    if (typeof window.initSupabaseBrowser === 'function') {
      window.initSupabaseBrowser().catch(() => {});
    }

    const params = new URLSearchParams(window.location.search);
    const promoId = params.get('id');
    if (!promoId) {
      window.auth.setMessage('formMessage', 'Falta el ID de la promoción', 'error');
      return;
    }
    document.getElementById('promoId').value = promoId;

    const shared = window.__PromoFormShared;
    if (!shared) {
      window.auth.setMessage('formMessage', 'Error al cargar el módulo de promociones', 'error');
      return;
    }

    shared.setDefaultDates();
    shared.bindImage();
    shared.bindBadgePreview();
    shared.bindDiscountTypeHelp();
    shared.bindProductSearch();

    const msgId = 'formMessage';
    window.auth.setMessage(msgId, 'Cargando promoción...', 'info');

    try {
      const [promoRes] = await Promise.all([
        window.auth.apiFetch(`/api/admin/promotions/${encodeURIComponent(promoId)}`, { method: 'GET' }),
        shared.cargarProductosCatalogo(),
      ]);

      if (!promoRes.ok) throw new Error(promoRes.message || 'Promoción no encontrada');
      const p = promoRes.data || {};
      populateForm(p);

      const items = Array.isArray(p.promotion_products) ? p.promotion_products : [];
      const selMap = new Map();
      const productsAll = shared.getProductsAll() || [];
      items.forEach((it, idx) => {
        const product_ref = it.product || productsAll.find((x) => x.id === it.product_id) || { id: it.product_id, name: 'Producto' };
        selMap.set(it.product_id, {
          product_id: it.product_id,
          product_ref,
          override_price: it.override_price != null ? Number(it.override_price) : null,
          discount_percentage: it.discount_percentage != null ? Number(it.discount_percentage) : null,
          product_note: it.product_note || '',
          sort_order: Number.isInteger(Number(it.sort_order)) ? Number(it.sort_order) : idx,
          active: it.active !== false,
        });
      });
      shared.setSelectedProductsMap(selMap);
      shared.renderProductsList(document.getElementById('productSearch')?.value || '');
      shared.renderSelectedProducts();

      window.auth.setMessage(msgId, 'Promoción cargada. Editá los campos y guardá los cambios.', 'success');
      setTimeout(() => window.auth.setMessage(msgId, '', 'info'), 2500);
    } catch (err) {
      window.auth.setMessage(msgId, err.message || 'Error al cargar la promoción', 'error');
    }

    bindForm(promoId);
  }

  function populateForm(p) {
    if (p.title != null) document.getElementById('title').value = p.title;
    if (p.short_description != null) document.getElementById('short_description').value = p.short_description || '';
    if (p.description != null) document.getElementById('description').value = p.description || '';
    if (p.terms_and_conditions != null) document.getElementById('terms_and_conditions').value = p.terms_and_conditions || '';
    if (p.discount_type) document.getElementById('discount_type').value = p.discount_type;
    if (p.discount_value != null) document.getElementById('discount_value').value = Number(p.discount_value || 0);
    if (p.start_date) {
      const d = new Date(p.start_date);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      document.getElementById('start_date').value = d.toISOString().slice(0, 16);
    }
    if (p.end_date) {
      const d = new Date(p.end_date);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      document.getElementById('end_date').value = d.toISOString().slice(0, 16);
    }
    if (p.badge_label) document.getElementById('badge_label').value = p.badge_label;
    if (p.badge_color) document.getElementById('badge_color').value = p.badge_color;
    if (p.cta_text) document.getElementById('cta_text').value = p.cta_text;
    if (p.cta_link) document.getElementById('cta_link').value = p.cta_link;
    if (p.sort_order != null) document.getElementById('sort_order').value = Number(p.sort_order || 0);
    const activeEl = document.getElementById('active');
    const featuredEl = document.getElementById('featured');
    if (activeEl) activeEl.checked = p.active !== false;
    if (featuredEl) featuredEl.checked = !!p.featured;
    if (p.title) document.getElementById('pageTitle').textContent = 'Editar: ' + p.title;

    const currentBanner = document.getElementById('currentBannerInfo');
    if (currentBanner && p.banner_image_url) {
      currentBanner.innerHTML = `Banner actual: <a href="${escapeAttr(p.banner_image_url)}" target="_blank" rel="noopener" style="color:#93c5fd;">ver imagen</a>. Subir una nueva la reemplazará.`;
    } else if (currentBanner) {
      currentBanner.innerHTML = 'Sin banner todavía. Podés subir uno arriba.';
    }

    const previewEl = document.getElementById('badgePreview');
    if (previewEl) {
      const label = (p.badge_label || 'OFERTA').toUpperCase();
      const color = p.badge_color || '#ef4444';
      previewEl.textContent = label;
      previewEl.style.background = color;
      const h = String(color).replace('#', '');
      let lum = 0;
      if (h.length === 6) {
        lum = 0.299 * (parseInt(h.substring(0, 2), 16) / 255) + 0.587 * (parseInt(h.substring(2, 4), 16) / 255) + 0.114 * (parseInt(h.substring(4, 6), 16) / 255);
      }
      previewEl.style.color = lum > 0.5 ? '#000' : '#fff';
    }

    if (p.banner_image_url) {
      const wrap = document.getElementById('imagePreviewWrap');
      const img = document.getElementById('imagePreviewImg');
      const info = document.getElementById('imageInfoText');
      if (wrap && img) {
        img.src = p.banner_image_url;
        info.innerHTML = `Banner previo · <span style="color:#888;">se reemplazará si subís uno nuevo</span>`;
        wrap.style.display = 'flex';
      }
    }
  }

  function bindForm(promoId) {
    const form = document.getElementById('promoForm');
    if (!form) return;
    form.addEventListener('submit', async function (e) {
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

      if (!title) { window.auth.setMessage(msgId, 'El título es requerido', 'error'); document.getElementById('title').focus(); return; }
      if (!start_date) { window.auth.setMessage(msgId, 'Fecha de inicio requerida', 'error'); document.getElementById('start_date').focus(); return; }
      if (end_date && new Date(end_date).getTime() <= new Date(start_date).getTime()) {
        window.auth.setMessage(msgId, 'La fecha de fin debe ser posterior al inicio', 'error');
        document.getElementById('end_date').focus();
        return;
      }

      const shared = window.__PromoFormShared;
      const selectedProducts = shared ? shared.getSelectedProductsMap() : new Map();
      if (selectedProducts.size === 0) {
        window.auth.setMessage(msgId, 'Agregá al menos UN producto a la promoción', 'error');
        return;
      }

      const discount_value = (discount_value_raw === '' || discount_value_raw == null) ? 0 : Number(discount_value_raw);
      const sort_order = Number.isInteger(Number(sort_order_raw)) ? Number(sort_order_raw) : 0;

      window.auth.setButtonLoading(btnId, true, 'GUARDANDO...');
      window.auth.setMessage(msgId, 'Procesando cambios...', 'info');

      try {
        let banner_image_url = null;
        const selectedFile = shared ? shared.getSelectedFile() : null;
        if (selectedFile) {
          window.auth.setMessage(msgId, 'Subiendo imagen del banner...', 'info');
          const fd = new FormData();
          fd.append('image', selectedFile);
          const upRes = await window.auth.apiFetch('/api/admin/products/upload-image', { method: 'POST', body: fd });
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
            active: item.active !== false,
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
          badge_label: badge_label || null,
          badge_color,
          cta_text: cta_text || null,
          cta_link: cta_link || null,
          sort_order,
          active,
          featured,
          products: products_payload,
        };
        if (banner_image_url) body.banner_image_url = banner_image_url;

        const res = await window.auth.apiFetch(`/api/admin/promotions/${encodeURIComponent(promoId)}`, {
          method: 'PUT',
          body,
        });
        if (!res.ok) throw new Error(res.message || 'Error al guardar cambios');

        window.auth.setMessage(msgId, 'Promoción actualizada correctamente. Redirigiendo...', 'success');
        setTimeout(() => { window.location.replace('/admin/promos.html'); }, 900);
      } catch (err) {
        window.auth.setMessage(msgId, err.message || 'Error inesperado', 'error');
      } finally {
        window.auth.setButtonLoading(btnId, false);
      }
    });
  }

  function escapeAttr(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
})();
