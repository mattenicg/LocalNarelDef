(function () {
  'use strict';

  let selectedFiles = []; // Array of { file: File, previewUrl: string, id: string }
  let categoriesList = [];

  window.addEventListener('DOMContentLoaded', init);

  async function init() {
    const user = await window.auth.requireAuth({ requireAdmin: true });
    if (!user) return;

    if (typeof window.initSupabaseBrowser === 'function') {
      window.initSupabaseBrowser().catch(() => {});
    }

    bindImages();
    bindForm();
    bindDirectPurchase();
    await loadCategories();
    bindCategoryEvents();
  }

  function bindDirectPurchase() {
    const chk = document.getElementById('direct_purchase');
    const box = document.getElementById('directPurchaseConfigBox');
    if (!chk || !box) return;

    function updateVisibility() {
      box.style.display = chk.checked ? 'block' : 'none';
      updateDirectPreview();
    }

    chk.addEventListener('change', updateVisibility);

    // Bind inputs for live preview
    const inputsToWatch = [
      'name', 'price',
      'direct_discount_percent', 'direct_discount_text',
      'direct_show_promo_badge', 'direct_promo_badge_text',
      'direct_installments_count', 'direct_installments_text',
      'direct_custom_transfer_price', 'direct_transfer_text'
    ];

    inputsToWatch.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateDirectPreview);
        el.addEventListener('change', updateDirectPreview);
      }
    });

    updateDirectPreview();
  }

  function fmtPriceAR(num) {
    const n = Number(num) || 0;
    return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function updateDirectPreview() {
    const nameEl = document.getElementById('name');
    const priceEl = document.getElementById('price');
    const discPctEl = document.getElementById('direct_discount_percent');
    const discTxtEl = document.getElementById('direct_discount_text');
    const showPromoEl = document.getElementById('direct_show_promo_badge');
    const promoTxtEl = document.getElementById('direct_promo_badge_text');
    const instCountEl = document.getElementById('direct_installments_count');
    const instTxtEl = document.getElementById('direct_installments_text');
    const custTransEl = document.getElementById('direct_custom_transfer_price');
    const transTxtEl = document.getElementById('direct_transfer_text');

    const prevName = document.getElementById('previewProdName');
    const prevPrice = document.getElementById('previewProdPrice');
    const prevDisc = document.getElementById('previewDiscountBadge');
    const prevPromo = document.getElementById('previewPromoBadge');
    const prevInst = document.getElementById('previewInstallmentsLine');
    const prevTrans = document.getElementById('previewTransferLine');

    if (!prevPrice) return;

    const basePrice = Number(priceEl?.value) || 0;
    const name = (nameEl?.value || '').trim() || 'NOMBRE DEL PRODUCTO';
    const discPct = discPctEl ? Number(discPctEl.value) || 0 : 25;
    const discTxt = (discTxtEl?.value || 'con transferencia').trim();
    const showPromo = showPromoEl ? showPromoEl.checked : true;
    const promoTxt = (promoTxtEl?.value || 'PROMO ACTIVA').trim();
    const instCount = instCountEl ? (Number(instCountEl.value) || 6) : 6;
    const instTxt = (instTxtEl?.value || 'sin interés').trim();
    const customTrans = custTransEl && custTransEl.value !== '' ? Number(custTransEl.value) : null;
    const transTxt = (transTxtEl?.value || 'con Transferencia').trim();

    if (prevName) prevName.textContent = name.toUpperCase();
    if (prevPrice) prevPrice.textContent = fmtPriceAR(basePrice);

    if (prevDisc) {
      prevDisc.textContent = `${discPct}% OFF ${discTxt}`;
    }

    if (prevPromo) {
      prevPromo.style.display = showPromo ? 'block' : 'none';
      prevPromo.textContent = promoTxt;
    }

    if (prevInst) {
      const instVal = instCount > 0 ? (basePrice / instCount) : basePrice;
      prevInst.textContent = `${instCount} x ${fmtPriceAR(instVal)} ${instTxt}`;
    }

    if (prevTrans) {
      const finalTransVal = (customTrans !== null && !isNaN(customTrans) && customTrans > 0)
        ? customTrans
        : (basePrice * (1 - (discPct / 100)));
      prevTrans.textContent = `${fmtPriceAR(finalTransVal)} ${transTxt}`;
    }
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

  function bindImages() {
    const input = document.getElementById('imagesInput');
    const container = document.getElementById('imagesGalleryContainer');
    const grid = document.getElementById('imagesGrid');
    const countText = document.getElementById('galleryCountText');

    function renderGallery() {
      if (!container || !grid) return;
      if (selectedFiles.length === 0) {
        container.style.display = 'none';
        grid.innerHTML = '';
        if (input) input.value = '';
        return;
      }

      container.style.display = 'block';
      if (countText) {
        countText.textContent = `${selectedFiles.length} foto${selectedFiles.length > 1 ? 's' : ''} seleccionada${selectedFiles.length > 1 ? 's' : ''} (La 1ra es la portada principal)`;
      }

      grid.innerHTML = '';
      selectedFiles.forEach((item, index) => {
        const card = document.createElement('div');
        card.style.cssText = 'position:relative;background:#111;border:1px solid #333;border-radius:6px;overflow:hidden;display:flex;flex-direction:column;';
        
        const isPrimary = index === 0;

        card.innerHTML = `
          <div style="position:relative;width:100%;height:120px;background:#050505;">
            <img src="${item.previewUrl}" alt="Preview" style="width:100%;height:100%;object-fit:cover;display:block;">
            ${isPrimary ? '<span style="position:absolute;top:6px;left:6px;background:#e50914;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;font-family:\'DM Mono\',monospace;letter-spacing:.05em;">PORTADA</span>' : ''}
            <span style="position:absolute;bottom:6px;left:6px;background:rgba(0,0,0,0.7);color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;font-family:\'DM Mono\',monospace;">#${index + 1}</span>
          </div>
          <div style="padding:6px;display:flex;gap:4px;align-items:center;justify-content:space-between;background:#181818;border-top:1px solid #282828;">
            <div style="display:flex;gap:2px;">
              <button type="button" class="btn-move-left" style="background:#222;color:#fff;border:1px solid #444;border-radius:3px;padding:2px 6px;font-size:11px;cursor:pointer;" ${index === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''} title="Mover a la izquierda">◀</button>
              <button type="button" class="btn-move-right" style="background:#222;color:#fff;border:1px solid #444;border-radius:3px;padding:2px 6px;font-size:11px;cursor:pointer;" ${index === selectedFiles.length - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''} title="Mover a la derecha">▶</button>
            </div>
            <button type="button" class="btn-remove-img" style="background:#3a0000;color:#ff6666;border:1px solid #770000;border-radius:3px;padding:2px 6px;font-size:10px;font-weight:700;cursor:pointer;" title="Eliminar foto">✕</button>
          </div>
        `;

        // Events
        const btnLeft = card.querySelector('.btn-move-left');
        const btnRight = card.querySelector('.btn-move-right');
        const btnDel = card.querySelector('.btn-remove-img');

        if (btnLeft && index > 0) {
          btnLeft.addEventListener('click', () => {
            const temp = selectedFiles[index - 1];
            selectedFiles[index - 1] = selectedFiles[index];
            selectedFiles[index] = temp;
            renderGallery();
          });
        }

        if (btnRight && index < selectedFiles.length - 1) {
          btnRight.addEventListener('click', () => {
            const temp = selectedFiles[index + 1];
            selectedFiles[index + 1] = selectedFiles[index];
            selectedFiles[index] = temp;
            renderGallery();
          });
        }

        if (btnDel) {
          btnDel.addEventListener('click', () => {
            try { URL.revokeObjectURL(item.previewUrl); } catch (_) {}
            selectedFiles.splice(index, 1);
            renderGallery();
          });
        }

        grid.appendChild(card);
      });
    }

    if (input) {
      input.addEventListener('change', function () {
        const files = Array.from(input.files || []);
        if (!files.length) return;

        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        let errorMsg = '';

        for (const file of files) {
          if (!allowed.includes(file.type || '')) {
            errorMsg = `Formato no permitido en ${file.name}. Solo JPG, JPEG, PNG y WEBP.`;
            break;
          }
          if (file.size > 5 * 1024 * 1024) {
            errorMsg = `El archivo ${file.name} supera el tamaño máximo permitido (5 MB).`;
            break;
          }
          selectedFiles.push({
            file,
            previewUrl: URL.createObjectURL(file),
            id: 'file_' + Math.random().toString(36).substring(2, 9),
          });
        }

        if (errorMsg) {
          window.auth.setMessage('formMessage', errorMsg, 'error');
        } else {
          window.auth.setMessage('formMessage', '', 'info');
        }

        input.value = ''; // Reset input so user can add more files consecutively
        renderGallery();
      });
    }
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
      let uploadedImageUrls = [];
      if (selectedFiles.length > 0) {
        window.auth.setMessage(msgId, `Subiendo ${selectedFiles.length} imagen${selectedFiles.length > 1 ? 'es' : ''}...`, 'info');
        const fd = new FormData();
        selectedFiles.forEach((item) => {
          fd.append('images', item.file);
        });

        const upRes = await window.auth.apiFetch('/api/admin/products/upload-images', {
          method: 'POST',
          body: fd,
        });

        if (!upRes.ok) {
          throw new Error(upRes.message || 'Error al subir las imágenes');
        }

        if (Array.isArray(upRes.images)) {
          uploadedImageUrls = upRes.images;
        } else if (Array.isArray(upRes.data?.images)) {
          uploadedImageUrls = upRes.data.images;
        } else if (upRes.image_url) {
          uploadedImageUrls = [upRes.image_url];
        } else if (upRes.data?.image_url) {
          uploadedImageUrls = [upRes.data.image_url];
        }
      }

      const primaryImageUrl = uploadedImageUrls[0] || null;

      const discPctEl = document.getElementById('direct_discount_percent');
      const discTxtEl = document.getElementById('direct_discount_text');
      const showPromoEl = document.getElementById('direct_show_promo_badge');
      const promoTxtEl = document.getElementById('direct_promo_badge_text');
      const instCountEl = document.getElementById('direct_installments_count');
      const instTxtEl = document.getElementById('direct_installments_text');
      const custTransEl = document.getElementById('direct_custom_transfer_price');
      const transTxtEl = document.getElementById('direct_transfer_text');

      const direct_discount_percent = discPctEl && discPctEl.value !== '' ? Number(discPctEl.value) : 25;
      const direct_discount_text = discTxtEl && discTxtEl.value ? discTxtEl.value.trim() : 'con transferencia';
      const direct_show_promo_badge = showPromoEl ? showPromoEl.checked : true;
      const direct_promo_badge_text = promoTxtEl && promoTxtEl.value ? promoTxtEl.value.trim() : 'PROMO ACTIVA';
      const direct_installments_count = instCountEl && instCountEl.value !== '' ? Number(instCountEl.value) : 6;
      const direct_installments_text = instTxtEl && instTxtEl.value ? instTxtEl.value.trim() : 'sin interés';
      const direct_custom_transfer_price = custTransEl && custTransEl.value !== '' ? Number(custTransEl.value) : null;
      const direct_transfer_text = transTxtEl && transTxtEl.value ? transTxtEl.value.trim() : 'con Transferencia';

      const createRes = await window.auth.apiFetch('/api/admin/products', {
        method: 'POST',
        body: {
          name,
          description,
          price,
          sizes,
          stock,
          image_url: primaryImageUrl,
          images: uploadedImageUrls,
          category,
          subcategory,
          subcategory_id,
          active,
          featured,
          direct_purchase,
          allowed_payment_methods,
          allowed_installments,
          direct_discount_percent,
          direct_discount_text,
          direct_show_promo_badge,
          direct_promo_badge_text,
          direct_installments_count,
          direct_installments_text,
          direct_custom_transfer_price,
          direct_transfer_text,
        },
      });

      if (!createRes.ok) {
        throw new Error(createRes.message || 'Error al crear el producto');
      }

      window.auth.setMessage(msgId, 'Producto creado correctamente con sus fotos. Redirigiendo...', 'success');
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
