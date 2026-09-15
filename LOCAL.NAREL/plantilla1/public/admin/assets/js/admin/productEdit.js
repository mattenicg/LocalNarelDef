(function () {
  'use strict';

  let productId = null;
  let currentProduct = null;
  let selectedFile = null;
  let localPreviewUrl = null;
  let currentImageRemoved = false;
  let categoriesList = [];

  window.addEventListener('DOMContentLoaded', init);

  async function init() {
    const user = await window.auth.requireAuth({ requireAdmin: true });
    if (!user) return;

    if (typeof window.initSupabaseBrowser === 'function') {
      window.initSupabaseBrowser().catch(() => {});
    }

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
      window.auth.setMessage('formMessage', 'Falta el ID del producto', 'error');
      return;
    }
    productId = id;

    bindImage();
    bindForm();
    await loadCategories();
    bindCategoryEvents();
    await cargarProducto();
  }

  async function loadCategories(selectedCatSlug = null, selectedSubSlug = null) {
    const categoryEl = document.getElementById('category');
    try {
      const res = await window.auth.apiFetch('/api/products/categories');
      if (res && res.ok && Array.isArray(res.data)) {
        categoriesList = res.data;
      } else {
        categoriesList = [];
      }
    } catch (err) {
      console.warn('Error loading categories:', err);
      categoriesList = [];
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
          const res = await window.auth.apiFetch('/api/products/subcategories', {
            method: 'POST',
            body: { category_slug: catSlug, name },
          });

          if (!res || !res.ok) {
            throw new Error((res && res.message) || 'Error al crear la subcategoría');
          }

          const createdSub = res.data;
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

  async function cargarProducto() {
    const msgId = 'formMessage';
    window.auth.setMessage(msgId, 'Cargando datos del producto...', 'info');

    const res = await window.auth.apiFetch(`/api/admin/products/${encodeURIComponent(productId)}`, { method: 'GET' });

    if (!res.ok) {
      window.auth.setMessage(msgId, res.message || 'Error al cargar el producto', 'error');
      return;
    }

    currentProduct = res.data || {};
    const p = currentProduct;

    document.getElementById('name').value = p.name || '';
    document.getElementById('description').value = p.description || '';
    document.getElementById('price').value = Number(p.price) || 0;
    document.getElementById('stock').value = Number.isFinite(parseInt(p.stock, 10)) ? parseInt(p.stock, 10) : 0;
    document.getElementById('sizes').value = p.sizes || '';

    const catEl = document.getElementById('category');
    const catVal = String(p.category || 'remeras').toLowerCase().trim();
    const subVal = p.subcategory ? String(p.subcategory).toLowerCase().trim() : null;

    if (catEl) {
      Array.from(catEl.options).forEach((o) => {
        if (o.value.toLowerCase() === catVal) {
          o.selected = true;
        }
      });
      renderSubcategories(catVal, subVal);
    }
    const actEl = document.getElementById('active');
    if (actEl) { actEl.checked = !(p.active === false || p.active === 0 || p.active === 'false'); }
    const featEl = document.getElementById('featured');
    if (featEl) { featEl.checked = !!(p.featured === true || p.featured === 1 || p.featured === 'true'); }

    if (p.image_url) {
      const wrap = document.getElementById('imagePreviewWrap');
      const img = document.getElementById('imagePreviewImg');
      const info = document.getElementById('imageInfoText');
      const delBtn = document.getElementById('deleteCurrentImageBtn');

      img.src = p.image_url;
      img.onerror = () => { info.textContent = '(Imagen no disponible)'; };
      info.textContent = 'Imagen actual asignada';
      delBtn.style.display = 'inline-flex';
      wrap.style.display = 'flex';
    }

    window.auth.setMessage(msgId, '', 'info');
  }

  function bindImage() {
    const input = document.getElementById('image');
    const wrap = document.getElementById('imagePreviewWrap');
    const img = document.getElementById('imagePreviewImg');
    const info = document.getElementById('imageInfoText');
    const removeBtn = document.getElementById('removeImageBtn');
    const delCurrentBtn = document.getElementById('deleteCurrentImageBtn');

    function restoreCurrentOrHide() {
      selectedFile = null;
      if (localPreviewUrl) { try { URL.revokeObjectURL(localPreviewUrl); } catch (_e) {} localPreviewUrl = null; }
      input.value = '';

      if (currentProduct && currentProduct.image_url && !currentImageRemoved) {
        img.src = currentProduct.image_url;
        info.textContent = 'Imagen actual asignada';
        delCurrentBtn.style.display = 'inline-flex';
        wrap.style.display = 'flex';
      } else {
        wrap.style.display = 'none';
        img.removeAttribute('src');
        info.textContent = '—';
        delCurrentBtn.style.display = 'none';
      }
    }

    input.addEventListener('change', function () {
      const file = input.files && input.files[0];
      if (!file) { restoreCurrentOrHide(); return; }

      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type || '')) {
        window.auth.setMessage('formMessage', 'Formato no permitido. Solo JPG, JPEG, PNG y WEBP.', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        window.auth.setMessage('formMessage', 'La imagen supera el tamaño máximo permitido (5 MB).', 'error');
        return;
      }

      selectedFile = file;
      if (localPreviewUrl) { try { URL.revokeObjectURL(localPreviewUrl); } catch (_e) {} }
      localPreviewUrl = URL.createObjectURL(file);
      img.src = localPreviewUrl;

      const kb = Math.round(file.size / 1024);
      const sizeStr = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
      info.textContent = `Nueva imagen: ${escapeHtml(file.name)} · ${sizeStr} · ${escapeHtml(file.type || '')}`;
      delCurrentBtn.style.display = 'none';
      wrap.style.display = 'flex';
      window.auth.setMessage('formMessage', '', 'info');
    });

    removeBtn.addEventListener('click', restoreCurrentOrHide);
    delCurrentBtn.addEventListener('click', eliminarImagenActual);
  }

  async function eliminarImagenActual() {
    if (!currentProduct || !currentProduct.image_url) return;
    const msgId = 'formMessage';
    const ok = window.confirm('¿Eliminar la imagen actual del producto? Esta acción no se puede deshacer.');
    if (!ok) return;

    const btn = document.getElementById('deleteCurrentImageBtn');
    const prevText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'ELIMINANDO...';

    const res = await window.auth.apiFetch(`/api/admin/products/${encodeURIComponent(productId)}/image`, { method: 'DELETE' });

    btn.disabled = false;
    btn.textContent = prevText;

    if (!res.ok) {
      window.auth.setMessage(msgId, res.message || 'Error al eliminar la imagen', 'error');
      return;
    }

    currentProduct.image_url = null;
    currentImageRemoved = true;

    const wrap = document.getElementById('imagePreviewWrap');
    const img = document.getElementById('imagePreviewImg');
    const info = document.getElementById('imageInfoText');
    const delBtn = document.getElementById('deleteCurrentImageBtn');

    if (selectedFile) {
      info.textContent = info.textContent;
    } else {
      wrap.style.display = 'none';
      img.removeAttribute('src');
      info.textContent = '—';
    }
    delBtn.style.display = 'none';

    window.auth.setMessage(msgId, 'Imagen eliminada correctamente', 'success');
    setTimeout(() => window.auth.setMessage(msgId, '', 'info'), 1800);
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

    const name = (nameEl.value || '').trim();
    const description = (descEl.value || '').trim();
    const priceRaw = priceEl.value;
    const stockRaw = stockEl.value;
    const sizes = (sizesEl.value || '').trim();
    const category = (categoryEl && categoryEl.value || '').toLowerCase().trim();
    const subcategory = (subcatEl && subcatEl.value || '').toLowerCase().trim() || null;
    const subcatSelectedOpt = subcatEl && subcatEl.options[subcatEl.selectedIndex];
    const subcategory_id = subcatSelectedOpt && subcatSelectedOpt.dataset.id ? subcatSelectedOpt.dataset.id : null;
    const active = !!(activeEl && activeEl.checked);
    const featured = !!(featuredEl && featuredEl.checked);

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
      const payload = {
        name,
        description,
        price,
        sizes,
        stock,
        category,
        subcategory,
        subcategory_id,
        active,
        featured,
      };
      const prevImageUrl = currentProduct.image_url || null;

      if (selectedFile) {
        window.auth.setMessage(msgId, 'Subiendo nueva imagen...', 'info');
        const fd = new FormData();
        fd.append('image', selectedFile);
        const upRes = await window.auth.apiFetch('/api/admin/products/upload-image', {
          method: 'POST',
          body: fd,
        });
        if (!upRes.ok) throw new Error(upRes.message || 'Error al subir la imagen');

        const newImageUrl = upRes.image_url || (upRes.data && upRes.data.image_url) || null;
        if (!newImageUrl) throw new Error('No se obtuvo la URL de la nueva imagen');
        payload.image_url = newImageUrl;
      }

      const updRes = await window.auth.apiFetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
        method: 'PUT',
        body: payload,
      });

      if (!updRes.ok) throw new Error(updRes.message || 'Error al actualizar el producto');

      if (currentProduct && updRes.data) currentProduct = { ...currentProduct, ...updRes.data };

      window.auth.setMessage(msgId, 'Producto actualizado correctamente. Redirigiendo...', 'success');
      setTimeout(() => window.location.replace('/admin/products.html'), 900);
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

  function guessCategory(name, description){
    const haystack = (String(name || '') + ' ' + String(description || '')).toLowerCase();
    if (/(pantalon|jogger|baggy|cargo|wide|chino)/i.test(haystack)) return 'pantalones';
    if (/(campera|chaqueta|parka|camperita)/i.test(haystack)) return 'camperas';
    if (/(buzo|hoodie|sudadera|canguro)/i.test(haystack)) return 'buzos';
    if (/(remera|tee|t-shirt|playera|musculosa)/i.test(haystack)) return 'remeras';
    if (/(accesorio|gorra|cap|bufanda|cinturon|media|medias|mochila|llavero)/i.test(haystack)) return 'accesorios';
    return 'remeras';
  }
})();

async function logout() {
  try {
    await window.auth.apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  window.location.replace('/login.html');
}
