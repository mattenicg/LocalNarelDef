(function () {
  'use strict';

  let selectedFile = null;
  let localPreviewUrl = null;
  let categoriesList = [];

  window.addEventListener('DOMContentLoaded', init);

  async function init() {
    const user = await window.auth.requireAuth({ requireAdmin: true });
    if (!user) return;

    if (typeof window.initSupabaseBrowser === 'function') {
      window.initSupabaseBrowser().catch(() => {});
    }

    bindImage();
    bindForm();
    bindDirectPurchase();
    await loadCategories();
    bindCategoryEvents();
  }

  function bindDirectPurchase() {
    const chk = document.getElementById('direct_purchase');
    const box = document.getElementById('directPurchaseConfigBox');
    if (!chk || !box) return;
    chk.addEventListener('change', () => {
      box.style.display = chk.checked ? 'block' : 'none';
    });
  }

  const DEFAULT_CATEGORIES = [
    { slug: 'pantalones', name: 'Pantalones', subcategories: [{ name: 'Cargo', slug: 'cargo' }, { name: 'Jeans', slug: 'jeans' }, { name: 'Joggers', slug: 'joggers' }] },
    { slug: 'camperas', name: 'Camperas', subcategories: [{ name: 'Bomber', slug: 'bomber' }, { name: 'Puffer', slug: 'puffer' }] },
    { slug: 'buzos', name: 'Buzos', subcategories: [{ name: 'Hoodies', slug: 'hoodies' }] },
    { slug: 'remeras', name: 'Remeras', subcategories: [{ name: 'Oversized', slug: 'oversized' }] },
    { slug: 'accesorios', name: 'Accesorios', subcategories: [{ name: 'Gorras', slug: 'gorras' }] },
  ];

  async function loadCategories(selectedCatSlug = null, selectedSubSlug = null) {
    const categoryEl = document.getElementById('category');
    categoriesList = [];

    // 1. Try authenticated admin endpoint
    try {
      const res = await window.auth.apiFetch('/api/admin/products/categories');
      if (res && res.ok && Array.isArray(res.data) && res.data.length > 0) {
        categoriesList = res.data;
      }
    } catch (_err) {
      // ignore and try next
    }

    // 2. Try alias endpoint if first didn't return
    if (!categoriesList.length) {
      try {
        const res = await window.auth.apiFetch('/api/products/categories');
        if (res && res.ok && Array.isArray(res.data) && res.data.length > 0) {
          categoriesList = res.data;
        }
      } catch (_err) {
        // ignore and try next
      }
    }

    // 3. Try public categories endpoint
    if (!categoriesList.length) {
      try {
        const pubRes = await fetch('/api/categories/public', { headers: { Accept: 'application/json' } });
        if (pubRes.ok) {
          const pubJson = await pubRes.json();
          if (pubJson && pubJson.ok && Array.isArray(pubJson.data) && pubJson.data.length > 0) {
            categoriesList = pubJson.data;
          }
        }
      } catch (_err) {
        // ignore and fallback
      }
    }

    // 4. Fallback if empty to ensure dropdown is NEVER blank
    if (!categoriesList.length) {
      categoriesList = DEFAULT_CATEGORIES;
    }

    if (!categoryEl) return;

    categoryEl.innerHTML = '';
    const defOpt = document.createElement('option');
    defOpt.value = '';
    defOpt.textContent = 'Elegí una sección...';
    defOpt.disabled = true;
    if (!selectedCatSlug) defOpt.selected = true;
    categoryEl.appendChild(defOpt);

    categoriesList.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.slug;
      opt.textContent = (cat.name || cat.slug).toUpperCase();
      if (selectedCatSlug && cat.slug.toLowerCase() === selectedCatSlug.toLowerCase()) {
        opt.selected = true;
      }
      categoryEl.appendChild(opt);
    });

    renderSubcategories(selectedCatSlug || categoryEl.value, selectedSubSlug);
  }

  function renderSubcategories(catSlug, selectedSubSlug = null) {
    const subcatEl = document.getElementById('subcategory');
    const newBox = document.getElementById('newSubcategoryBox');
    if (!subcatEl) return;

    if (newBox) newBox.style.display = 'none';

    subcatEl.innerHTML = '';
    const generalOpt = document.createElement('option');
    generalOpt.value = '';
    generalOpt.textContent = 'Sin subcategoría (General)';
    if (!selectedSubSlug) generalOpt.selected = true;
    subcatEl.appendChild(generalOpt);

    if (!catSlug) return;

    const cat = categoriesList.find((c) => c.slug.toLowerCase() === catSlug.toLowerCase());
    if (cat && Array.isArray(cat.subcategories)) {
      cat.subcategories.forEach((sub) => {
        const opt = document.createElement('option');
        opt.value = sub.slug;
        opt.dataset.id = sub.id || '';
        opt.textContent = sub.name;
        if (selectedSubSlug && sub.slug.toLowerCase() === selectedSubSlug.toLowerCase()) {
          opt.selected = true;
        }
        subcatEl.appendChild(opt);
      });
    }
  }

  function bindCategoryEvents() {
    const categoryEl = document.getElementById('category');
    const openNewBtn = document.getElementById('openNewSubcategoryBtn');
    const newBox = document.getElementById('newSubcategoryBox');
    const parentLabel = document.getElementById('newSubcatParentLabel');
    const input = document.getElementById('newSubcategoryInput');
    const saveBtn = document.getElementById('saveSubcategoryBtn');
    const cancelBtn = document.getElementById('cancelSubcategoryBtn');
    const errEl = document.getElementById('newSubcategoryError');

    categoryEl.addEventListener('change', () => {
      renderSubcategories(categoryEl.value);
    });

    if (openNewBtn && newBox) {
      openNewBtn.addEventListener('click', () => {
        const catSlug = categoryEl.value;
        if (!catSlug) {
          alert('Primero seleccioná una categoría para poder agregarle una subcategoría.');
          categoryEl.focus();
          return;
        }
        const cat = categoriesList.find((c) => c.slug.toLowerCase() === catSlug.toLowerCase());
        if (parentLabel) parentLabel.textContent = cat ? cat.name : catSlug.toUpperCase();
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        if (input) input.value = '';
        newBox.style.display = 'block';
        if (input) input.focus();
      });
    }

    if (cancelBtn && newBox) {
      cancelBtn.addEventListener('click', () => {
        newBox.style.display = 'none';
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      });
    }

    if (saveBtn && input) {
      saveBtn.addEventListener('click', async () => {
        const name = (input.value || '').trim();
        const catSlug = categoryEl.value;
        if (!name) {
          if (errEl) {
            errEl.textContent = 'Ingresá el nombre de la subcategoría.';
            errEl.style.display = 'block';
          }
          input.focus();
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'CREANDO...';
        if (errEl) errEl.style.display = 'none';

        try {
          let res = await window.auth.apiFetch('/api/admin/products/subcategories', {
            method: 'POST',
            body: { category_slug: catSlug, name },
          });

          if (!res || !res.ok) {
            res = await window.auth.apiFetch('/api/products/subcategories', {
              method: 'POST',
              body: { category_slug: catSlug, name },
            });
          }

          if (!res || !res.ok) {
            throw new Error((res && res.message) || 'Error al crear la subcategoría');
          }

          const createdSub = res.data;
          // Reload categories and select the new subcategory
          await loadCategories(catSlug, createdSub.slug);
          newBox.style.display = 'none';
          input.value = '';
        } catch (err) {
          if (errEl) {
            errEl.textContent = err.message || 'Error al guardar la subcategoría';
            errEl.style.display = 'block';
          }
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'CREAR Y ASIGNAR';
        }
      });
    }
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
    const subcatEl = document.getElementById('subcategory');
    const activeEl = document.getElementById('active');
    const featuredEl = document.getElementById('featured');
    const directPurchaseEl = document.getElementById('direct_purchase');

    const name = (nameEl.value || '').trim();
    const description = (descEl.value || '').trim();
    const priceRaw = priceEl.value;
    const stockRaw = stockEl.value;
    const sizes = (sizesEl.value || '').trim();
    const category = (categoryEl.value || '').toLowerCase().trim();
    const subcategory = (subcatEl && subcatEl.value || '').toLowerCase().trim() || null;
    const subcatSelectedOpt = subcatEl && subcatEl.options[subcatEl.selectedIndex];
    const subcategory_id = subcatSelectedOpt && subcatSelectedOpt.dataset.id ? subcatSelectedOpt.dataset.id : null;
    const active = !!(activeEl && activeEl.checked);
    const featured = !!(featuredEl && featuredEl.checked);
    const direct_purchase = !!(directPurchaseEl && directPurchaseEl.checked);

    const allowed_payment_methods = Array.from(document.querySelectorAll('.direct-pay-method:checked')).map((c) => c.value);
    const allowed_installments = Array.from(document.querySelectorAll('.direct-installment:checked')).map((c) => parseInt(c.value, 10)).filter(Boolean);

    if (direct_purchase && allowed_payment_methods.length === 0) {
      window.auth.setMessage(msgId, 'Para compra directa, debés seleccionar al menos un método de pago permitido.', 'error');
      return;
    }

    if (!name) {
      window.auth.setMessage(msgId, 'El nombre es requerido', 'error');
      nameEl.focus();
      return;
    }
    if (!category) {
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
          subcategory,
          subcategory_id,
          active,
          featured,
          direct_purchase,
          allowed_payment_methods,
          allowed_installments,
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
