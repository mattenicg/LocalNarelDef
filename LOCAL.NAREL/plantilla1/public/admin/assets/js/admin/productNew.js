(function () {
  'use strict';

  let selectedFile = null;
  let localPreviewUrl = null;

  window.addEventListener('DOMContentLoaded', init);

  async function init() {
    const user = await window.auth.requireAuth({ requireAdmin: true });
    if (!user) return;

    if (typeof window.initSupabaseBrowser === 'function') {
      window.initSupabaseBrowser().catch(() => {});
    }

    bindImage();
    bindForm();
  }

  function bindImage() {
    const input = document.getElementById('image');
    const wrap = document.getElementById('imagePreviewWrap');
    const img = document.getElementById('imagePreviewImg');
    const info = document.getElementById('imageInfoText');
    const removeBtn = document.getElementById('removeImageBtn');

    function clearPreview() {
      selectedFile = null;
      if (localPreviewUrl) {
        try { URL.revokeObjectURL(localPreviewUrl); } catch (_e) {}
        localPreviewUrl = null;
      }
      input.value = '';
      wrap.style.display = 'none';
      img.removeAttribute('src');
      info.textContent = '—';
    }

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

    removeBtn.addEventListener('click', clearPreview);
  }

  function bindForm() {
    const form = document.getElementById('productForm');
    form.addEventListener('submit', handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const msgId = 'formMessage';
    const btnId = 'submitBtn';

    const nameEl = document.getElementById('name');
    const descEl = document.getElementById('description');
    const priceEl = document.getElementById('price');
    const stockEl = document.getElementById('stock');
    const sizesEl = document.getElementById('sizes');
    const categoryEl = document.getElementById('category');
    const activeEl = document.getElementById('active');
    const featuredEl = document.getElementById('featured');

    const name = (nameEl.value || '').trim();
    const description = (descEl.value || '').trim();
    const priceRaw = priceEl.value;
    const stockRaw = stockEl.value;
    const sizes = (sizesEl.value || '').trim();
    const VALID_CATEGORIES = ['pantalones','camperas','buzos','remeras','accesorios'];
    const category = (categoryEl.value || '').toLowerCase().trim();
    const active = !!(activeEl && activeEl.checked);
    const featured = !!(featuredEl && featuredEl.checked);

    if (!name) {
      window.auth.setMessage(msgId, 'El nombre es requerido', 'error');
      nameEl.focus();
      return;
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      window.auth.setMessage(msgId, 'Elegí la categoría (sección) a la que va el producto', 'error');
      if (categoryEl) categoryEl.focus();
      return;
    }
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      window.auth.setMessage(msgId, 'Precio inválido', 'error');
      priceEl.focus();
      return;
    }
    const stock = parseInt(stockRaw, 10);
    if (!Number.isInteger(stock) || stock < 0) {
      window.auth.setMessage(msgId, 'Stock inválido', 'error');
      stockEl.focus();
      return;
    }

    window.auth.setButtonLoading(btnId, true, 'GUARDANDO...');
    window.auth.setMessage(msgId, 'Procesando...', 'info');

    try {
      let image_url = null;
      if (selectedFile) {
        window.auth.setMessage(msgId, 'Subiendo imagen...', 'info');
        const fd = new FormData();
        fd.append('image', selectedFile);
        const upRes = await window.auth.apiFetch('/api/admin/products/upload-image', {
          method: 'POST',
          body: fd,
        });
        if (!upRes.ok) {
          throw new Error(upRes.message || 'Error al subir la imagen');
        }
        image_url = upRes.image_url || (upRes.data && upRes.data.image_url) || null;
        if (!image_url) throw new Error('No se obtuvo la URL de la imagen');
      }

      const createRes = await window.auth.apiFetch('/api/admin/products', {
        method: 'POST',
        body: {
          name,
          description,
          price,
          sizes,
          stock,
          image_url,
          category,
          active,
          featured,
        },
      });

      if (!createRes.ok) {
        throw new Error(createRes.message || 'Error al crear el producto');
      }

      window.auth.setMessage(msgId, 'Producto creado correctamente. Redirigiendo...', 'success');
      setTimeout(() => {
        window.location.replace('/admin/products.html');
      }, 900);
    } catch (err) {
      window.auth.setMessage(msgId, err.message || 'Error inesperado', 'error');
    } finally {
      window.auth.setButtonLoading(btnId, false);
    }
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();

async function logout() {
  try {
    await window.auth.apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  window.location.replace('/login.html');
}
