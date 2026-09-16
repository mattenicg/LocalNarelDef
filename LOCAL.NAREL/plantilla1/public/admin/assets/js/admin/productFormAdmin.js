(function () {
  'use strict';

  window._productFormAdminLoaded = true;

  let productId = null;
  let isEditMode = false;
  let currentProduct = null;
  let categoriesList = [];
  let allImages = []; // Array of { type: 'existing' | 'new', url: string, file?: File, id: string }

  const DEFAULT_CATEGORIES = [
    { name: 'Remeras', slug: 'remeras', subcategories: [] },
    { name: 'Pantalones', slug: 'pantalones', subcategories: [] },
    { name: 'Buzos', slug: 'buzos', subcategories: [] },
    { name: 'Camperas', slug: 'camperas', subcategories: [] },
    { name: 'Accesorios', slug: 'accesorios', subcategories: [] },
  ];

  window.addEventListener('DOMContentLoaded', init);

  async function init() {
    const user = await window.auth.requireAuth({ requireAdmin: true });
    if (!user) return;

    if (typeof window.initSupabaseBrowser === 'function') {
      window.initSupabaseBrowser().catch(() => {});
    }

    const params = new URLSearchParams(window.location.search);
    productId = params.get('id');
    isEditMode = !!productId;

    // Adjust UI labels if in Edit Mode
    const kickerEl = document.getElementById('kickerText');
    const headingEl = document.getElementById('pageHeading');
    const submitBtnEl = document.getElementById('submitBtn');

    if (isEditMode) {
      if (kickerEl) kickerEl.textContent = '[ ADMIN — EDITAR PRODUCTO ]';
      if (headingEl) headingEl.textContent = 'Editar Producto';
      if (submitBtnEl) submitBtnEl.textContent = 'GUARDAR CAMBIOS';
      document.title = 'Editar Producto — Panel Admin';
    } else {
      if (kickerEl) kickerEl.textContent = '[ ADMIN — CREAR PRODUCTO ]';
      if (headingEl) headingEl.textContent = 'Nuevo Producto';
      if (submitBtnEl) submitBtnEl.textContent = 'GUARDAR PRODUCTO';
      document.title = 'Nuevo Producto — Panel Admin';
    }

    bindImages();
    bindForm();
    bindDirectPurchase();
    bindPresets();
    await loadCategories();
    bindCategoryEvents();

    if (isEditMode) {
      await cargarProducto();
    } else {
      updateDirectPreview();
    }
  }

  async function loadCategories(selectedCatSlug, selectedSubSlug, selectedSubId) {
    const categoryEl = document.getElementById('category');
    if (!categoryEl) return;

    try {
      const res = await window.auth.apiFetch('/api/admin/products/categories');
      if (res && res.ok && Array.isArray(res.data) && res.data.length > 0) {
        categoriesList = res.data;
      } else {
        const publicRes = await window.auth.apiFetch('/api/products/categories');
        if (publicRes && publicRes.ok && Array.isArray(publicRes.data) && publicRes.data.length > 0) {
          categoriesList = publicRes.data;
        } else {
          categoriesList = DEFAULT_CATEGORIES;
        }
      }
    } catch (_) {
      categoriesList = DEFAULT_CATEGORIES;
    }

    categoryEl.innerHTML = '<option value="">Elegí una sección...</option>';
    categoriesList.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.slug;
      opt.textContent = cat.name.toUpperCase();
      if (selectedCatSlug && cat.slug.toLowerCase() === selectedCatSlug.toLowerCase()) {
        opt.selected = true;
      }
      categoryEl.appendChild(opt);
    });

    renderSubcategories(selectedCatSlug || categoryEl.value, selectedSubSlug, selectedSubId);
  }

  function renderSubcategories(catSlug, selectedSubSlug, selectedSubId) {
    const subcatEl = document.getElementById('subcategory');
    if (!subcatEl) return;

    subcatEl.innerHTML = '<option value="">Sin subcategoría (Opcional)</option>';
    if (!catSlug) return;

    const cat = categoriesList.find((c) => String(c.slug).toLowerCase() === String(catSlug).toLowerCase());
    if (cat && Array.isArray(cat.subcategories)) {
      cat.subcategories.forEach((sub) => {
        const opt = document.createElement('option');
        opt.value = sub.slug;
        opt.dataset.id = sub.id || '';
        opt.textContent = sub.name;

        const isMatch =
          (selectedSubSlug && (sub.slug.toLowerCase() === selectedSubSlug.toLowerCase() || sub.name.toLowerCase() === selectedSubSlug.toLowerCase())) ||
          (selectedSubId && sub.id && String(sub.id) === String(selectedSubId));

        if (isMatch) {
          opt.selected = true;
        }
        subcatEl.appendChild(opt);
      });
    }
  }

  function bindPresets() {
    const guideEl = document.getElementById('size_guide');
    const btnRemeras = document.getElementById('btnPresetRemeras');
    const btnPantalones = document.getElementById('btnPresetPantalones');
    const btnBuzos = document.getElementById('btnPresetBuzos');

    if (!guideEl) return;

    if (btnRemeras) {
      btnRemeras.addEventListener('click', () => {
        guideEl.value = 'Talle | Pecho | Sisa | Largo\nS | 48 cm | 22 cm | 68 cm\nM | 51 cm | 23 cm | 71 cm\nL | 54 cm | 24 cm | 74 cm\nXL | 57 cm | 25 cm | 77 cm\nXXL | 60 cm | 26 cm | 80 cm';
      });
    }
    if (btnPantalones) {
      btnPantalones.addEventListener('click', () => {
        guideEl.value = 'Talle | Cintura | Cadera | Largo\n38 | 38 cm | 48 cm | 100 cm\n40 | 40 cm | 50 cm | 102 cm\n42 | 42 cm | 52 cm | 104 cm\n44 | 44 cm | 54 cm | 106 cm\n46 | 46 cm | 56 cm | 108 cm';
      });
    }
    if (btnBuzos) {
      btnBuzos.addEventListener('click', () => {
        guideEl.value = 'Talle | Pecho | Hombros | Largo | Manga\nS | 54 cm | 46 cm | 66 cm | 62 cm\nM | 57 cm | 48 cm | 69 cm | 64 cm\nL | 60 cm | 50 cm | 72 cm | 66 cm\nXL | 63 cm | 52 cm | 75 cm | 68 cm';
      });
    }
  }

  function bindCategoryEvents() {
    const categoryEl = document.getElementById('category');
    const openBtn = document.getElementById('openNewSubcategoryBtn');
    const box = document.getElementById('newSubcategoryBox');
    const saveBtn = document.getElementById('saveSubcategoryBtn');
    const cancelBtn = document.getElementById('cancelSubcategoryBtn');
    const input = document.getElementById('newSubcategoryInput');
    const errEl = document.getElementById('newSubcategoryError');

    if (categoryEl) {
      categoryEl.addEventListener('change', () => {
        renderSubcategories(categoryEl.value);
      });
    }

    if (openBtn && box && input) {
      openBtn.addEventListener('click', () => {
        if (!categoryEl || !categoryEl.value) {
          alert('Seleccioná primero una categoría para agregar una subcategoría.');
          return;
        }
        box.style.display = 'block';
        input.value = '';
        if (errEl) errEl.style.display = 'none';
        input.focus();
      });
    }

    if (cancelBtn && box) {
      cancelBtn.addEventListener('click', () => {
        box.style.display = 'none';
        if (errEl) errEl.style.display = 'none';
      });
    }

    if (saveBtn && input && box) {
      saveBtn.addEventListener('click', async () => {
        const name = (input.value || '').trim();
        const catSlug = categoryEl ? categoryEl.value : '';
        if (!catSlug) {
          if (errEl) { errEl.textContent = 'Seleccioná una categoría'; errEl.style.display = 'block'; }
          return;
        }
        if (name.length < 2) {
          if (errEl) { errEl.textContent = 'Nombre de subcategoría muy corto'; errEl.style.display = 'block'; }
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'GUARDANDO...';

        try {
          const res = await window.auth.apiFetch('/api/admin/products/subcategories', {
            method: 'POST',
            body: { category_slug: catSlug, name },
          });

          if (!res.ok) throw new Error(res.message || 'Error al guardar subcategoría');

          const newSub = res.data;
          await loadCategories(catSlug, newSub ? newSub.slug : name, newSub ? newSub.id : null);

          box.style.display = 'none';
          input.value = '';
          if (errEl) errEl.style.display = 'none';
        } catch (err) {
          if (errEl) {
            errEl.textContent = err.message || 'Error al guardar';
            errEl.style.display = 'block';
          }
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'GUARDAR';
        }
      });
    }
  }

  function bindDirectPurchase() {
    const chk = document.getElementById('direct_purchase');
    const box = document.getElementById('directPurchaseBox');

    const inputsToWatch = [
      'name', 'price', 'description', 'direct_purchase',
      'direct_discount_enabled', 'direct_discount_percent', 'direct_discount_text',
      'direct_show_promo_badge', 'direct_promo_badge_text',
      'direct_installments_count', 'direct_installments_text',
      'direct_custom_transfer_price', 'direct_transfer_text'
    ];

    function toggleBox() {
      if (!box) return;
      box.style.display = chk && chk.checked ? 'block' : 'none';
      updateDirectPreview();
    }

    if (chk) chk.addEventListener('change', toggleBox);
    toggleBox();

    inputsToWatch.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateDirectPreview);
        el.addEventListener('change', updateDirectPreview);
        el.addEventListener('keyup', updateDirectPreview);
      }
    });
  }

  function formatMoney(num) {
    if (!Number.isFinite(num) || num <= 0) return '$0,00';
    return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function updateDirectPreview() {
    // 0. Image Preview
    const prevImg = document.getElementById('previewProdImage');
    const prevPlaceholder = document.getElementById('previewImagePlaceholder');

    let imageUrl = null;
    if (allImages && allImages.length > 0 && allImages[0] && allImages[0].url) {
      imageUrl = allImages[0].url;
    } else if (currentProduct && currentProduct.image_url) {
      imageUrl = currentProduct.image_url;
    }

    if (prevImg && prevPlaceholder) {
      if (imageUrl) {
        prevImg.src = imageUrl;
        prevImg.style.display = 'block';
        prevPlaceholder.style.display = 'none';
      } else {
        prevImg.src = '';
        prevImg.style.display = 'none';
        prevPlaceholder.style.display = 'flex';
      }
    }

    // Read input values
    const nameVal = (document.getElementById('name')?.value || '').trim() || 'NOMBRE DEL PRODUCTO';
    const priceVal = Number(document.getElementById('price')?.value) || 0;

    const discEnabledEl = document.getElementById('direct_discount_enabled');
    const discEnabled = discEnabledEl ? discEnabledEl.checked : true;
    const discPctVal = document.getElementById('direct_discount_percent')?.value;
    const discPct = discEnabled && discPctVal !== '' && discPctVal !== null && !isNaN(discPctVal) ? Number(discPctVal) : 0;
    const discTxtInput = document.getElementById('direct_discount_text')?.value;
    const discTxt = discTxtInput !== undefined && discTxtInput !== null ? discTxtInput.trim() : 'con transferencia';

    const showPromoEl = document.getElementById('direct_show_promo_badge');
    const showPromo = showPromoEl ? showPromoEl.checked : true;
    const promoTxtInput = document.getElementById('direct_promo_badge_text')?.value;
    const promoTxt = promoTxtInput !== undefined && promoTxtInput !== null ? promoTxtInput.trim() : 'PROMO ACTIVA';

    const instCountVal = document.getElementById('direct_installments_count')?.value;
    const instCount = instCountVal !== '' && instCountVal !== null && !isNaN(instCountVal) ? Number(instCountVal) : 6;
    const instTxtInput = document.getElementById('direct_installments_text')?.value;
    const instTxt = instTxtInput !== undefined && instTxtInput !== null ? instTxtInput.trim() : 'sin interés';

    const custTransVal = document.getElementById('direct_custom_transfer_price')?.value;
    const custTransPrice = custTransVal !== '' && custTransVal !== null && !isNaN(custTransVal) && Number(custTransVal) > 0 ? Number(custTransVal) : null;
    const transTxtInput = document.getElementById('direct_transfer_text')?.value;
    const transTxt = transTxtInput !== undefined && transTxtInput !== null ? transTxtInput.trim() : 'con Transferencia';

    // 1. Name
    const prevName = document.getElementById('previewProdName') || document.getElementById('prev_name');
    if (prevName) prevName.textContent = nameVal.toUpperCase();

    // 2. Base price
    const prevPrice = document.getElementById('previewProdPrice') || document.getElementById('prev_base_price');
    if (prevPrice) prevPrice.textContent = formatMoney(priceVal);

    // 3. Discount badge
    const prevDiscBadge = document.getElementById('previewDiscountBadge');
    if (prevDiscBadge) {
      if (discEnabled && (discPct > 0 || discTxt)) {
        prevDiscBadge.style.display = 'inline-block';
        if (discPct > 0) {
          if (discTxt) {
            if (/OFF/i.test(discTxt) || /%/i.test(discTxt)) {
              prevDiscBadge.textContent = discTxt;
            } else {
              prevDiscBadge.textContent = `${discPct}% OFF ${discTxt}`;
            }
          } else {
            prevDiscBadge.textContent = `${discPct}% OFF`;
          }
        } else {
          prevDiscBadge.textContent = discTxt || 'con transferencia';
        }
      } else {
        prevDiscBadge.style.display = 'none';
      }
    }

    // 4. Promo badge
    const prevPromoBadge = document.getElementById('previewPromoBadge') || document.getElementById('prev_promo_badge');
    if (prevPromoBadge) {
      if (showPromo && promoTxt) {
        prevPromoBadge.style.display = 'inline-block';
        prevPromoBadge.textContent = promoTxt.toUpperCase();
      } else {
        prevPromoBadge.style.display = 'none';
      }
    }

    // 5. Installments line
    const prevInstLine = document.getElementById('previewInstallmentsLine') || document.getElementById('prev_installments_text');
    if (prevInstLine) {
      const perInst = instCount > 0 ? (priceVal > 0 ? priceVal / instCount : 0) : priceVal;
      prevInstLine.textContent = `${instCount} x ${formatMoney(perInst)} ${instTxt}`;
    }

    // 6. Transfer line
    const prevTransLine = document.getElementById('previewTransferLine') || document.getElementById('prev_transfer_price');
    if (prevTransLine) {
      let transferPrice = priceVal;
      if (custTransPrice !== null && custTransPrice > 0) {
        transferPrice = custTransPrice;
      } else if (discEnabled && discPct > 0) {
        transferPrice = priceVal * (1 - discPct / 100);
      }
      prevTransLine.textContent = `${formatMoney(transferPrice)} ${transTxt || 'con Transferencia'}`;
    }
  }

  async function cargarProducto() {
    const msgId = 'formMessage';
    window.auth.setMessage(msgId, 'Cargando datos del producto...', 'info');

    try {
      const res = await window.auth.apiFetch(`/api/admin/products/${encodeURIComponent(productId)}`);
      if (!res.ok || !res.data) {
        throw new Error(res.message || 'No se pudo cargar la información del producto');
      }

      const p = res.data;
      currentProduct = p;

      // Populate input fields
      const nameEl = document.getElementById('name');
      if (nameEl) nameEl.value = p.name || '';

      const descEl = document.getElementById('description');
      if (descEl) descEl.value = p.description || '';

      const priceEl = document.getElementById('price');
      if (priceEl) priceEl.value = p.price !== undefined && p.price !== null ? p.price : 0;

      const stockEl = document.getElementById('stock');
      if (stockEl) stockEl.value = p.stock !== undefined && p.stock !== null ? p.stock : 0;

      const sizesEl = document.getElementById('sizes');
      if (sizesEl) sizesEl.value = p.sizes || '';

      const sizeGuideEl = document.getElementById('size_guide');
      if (sizeGuideEl) sizeGuideEl.value = p.size_guide || '';

      const activeEl = document.getElementById('active');
      if (activeEl) activeEl.checked = p.active !== false && String(p.active) !== 'false';

      const featEl = document.getElementById('featured');
      if (featEl) featEl.checked = p.featured === true || String(p.featured) === 'true';

      const dirEl = document.getElementById('direct_purchase');
      if (dirEl) {
        dirEl.checked = p.direct_purchase === true || String(p.direct_purchase) === 'true';
        const box = document.getElementById('directPurchaseBox');
        if (box) box.style.display = dirEl.checked ? 'block' : 'none';
      }

      // Categories & Subcategories
      const catVal = String(p.category || 'remeras').toLowerCase().trim();
      const subVal = p.subcategory ? String(p.subcategory).toLowerCase().trim() : null;
      const subId = p.subcategory_id || null;

      await loadCategories(catVal, subVal, subId);

      // Discount & Direct Purchase Settings
      const hasDiscount = p.direct_discount_percent !== undefined && p.direct_discount_percent !== null ? Number(p.direct_discount_percent) > 0 : true;
      const discEnabledEl = document.getElementById('direct_discount_enabled');
      if (discEnabledEl) discEnabledEl.checked = hasDiscount;

      const discPctEl = document.getElementById('direct_discount_percent');
      if (discPctEl) {
        discPctEl.value = p.direct_discount_percent !== undefined && p.direct_discount_percent !== null ? p.direct_discount_percent : 25;
      }

      const discTxtEl = document.getElementById('direct_discount_text');
      if (discTxtEl) discTxtEl.value = p.direct_discount_text || 'con transferencia';

      const showPromoEl = document.getElementById('direct_show_promo_badge');
      if (showPromoEl) {
        showPromoEl.checked = p.direct_show_promo_badge !== false && String(p.direct_show_promo_badge) !== 'false';
      }

      const promoTxtEl = document.getElementById('direct_promo_badge_text');
      if (promoTxtEl) promoTxtEl.value = p.direct_promo_badge_text || 'PROMO ACTIVA';

      const instCountEl = document.getElementById('direct_installments_count');
      if (instCountEl) instCountEl.value = p.direct_installments_count !== undefined && p.direct_installments_count !== null ? p.direct_installments_count : 6;

      const instTxtEl = document.getElementById('direct_installments_text');
      if (instTxtEl) instTxtEl.value = p.direct_installments_text || 'sin interés';

      const custTransEl = document.getElementById('direct_custom_transfer_price');
      if (custTransEl) custTransEl.value = p.direct_custom_transfer_price !== undefined && p.direct_custom_transfer_price !== null ? p.direct_custom_transfer_price : '';

      const transTxtEl = document.getElementById('direct_transfer_text');
      if (transTxtEl) transTxtEl.value = p.direct_transfer_text || 'con Transferencia';

      // Payment Methods
      let allowedMethods = ['tarjeta_debito', 'tarjeta_credito', 'transferencia', 'efectivo'];
      if (Array.isArray(p.allowed_payment_methods) && p.allowed_payment_methods.length > 0) {
        allowedMethods = p.allowed_payment_methods;
      } else if (typeof p.allowed_payment_methods === 'string' && p.allowed_payment_methods.trim()) {
        try {
          const parsed = JSON.parse(p.allowed_payment_methods);
          if (Array.isArray(parsed)) allowedMethods = parsed;
        } catch (_) {}
      }

      document.querySelectorAll('.direct-pay-method').forEach((chk) => {
        chk.checked = allowedMethods.includes(chk.value);
      });

      // Installment Options
      let allowedInst = [1, 3, 6];
      if (Array.isArray(p.allowed_installments) && p.allowed_installments.length > 0) {
        allowedInst = p.allowed_installments.map(Number);
      } else if (typeof p.allowed_installments === 'string' && p.allowed_installments.trim()) {
        try {
          const parsed = JSON.parse(p.allowed_installments);
          if (Array.isArray(parsed)) allowedInst = parsed.map(Number);
        } catch (_) {}
      }

      document.querySelectorAll('.direct-installment').forEach((chk) => {
        chk.checked = allowedInst.includes(Number(chk.value));
      });

      // Images Gallery
      let initialImages = [];
      if (Array.isArray(p.product_images) && p.product_images.length > 0) {
        initialImages = p.product_images
          .slice()
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((img) => (typeof img === 'string' ? img : img.image_url))
          .filter(Boolean);
      } else if (Array.isArray(p.images) && p.images.length > 0) {
        initialImages = p.images.filter(Boolean);
      } else if (typeof p.images === 'string' && p.images.trim()) {
        try {
          const parsed = JSON.parse(p.images);
          if (Array.isArray(parsed)) initialImages = parsed.filter(Boolean);
        } catch (_) {
          initialImages = [p.images.trim()];
        }
      }

      if (p.image_url && !initialImages.includes(p.image_url)) {
        initialImages.unshift(p.image_url);
      }

      allImages = initialImages.map((url, idx) => ({
        type: 'existing',
        url,
        id: 'exist_' + idx + '_' + Math.random().toString(36).substring(2, 6),
      }));

      renderGallery();
      updateDirectPreview();
      window.auth.setMessage(msgId, '', 'info');
    } catch (err) {
      window.auth.setMessage(msgId, err.message || 'Error al cargar el producto', 'error');
    }
  }

  function renderGallery() {
    const container = document.getElementById('imagesGalleryContainer');
    const grid = document.getElementById('imagesGrid');
    const countText = document.getElementById('galleryCountText');
    const delAllBtn = document.getElementById('deleteAllImagesBtn');

    if (container && grid) {
      if (allImages.length === 0) {
        container.style.display = 'none';
        grid.innerHTML = '';
        if (delAllBtn) delAllBtn.style.display = 'none';
      } else {
        container.style.display = 'block';
        if (delAllBtn) delAllBtn.style.display = 'inline-flex';
        if (countText) {
          countText.textContent = `${allImages.length} foto${allImages.length > 1 ? 's' : ''} (La 1ra es la portada principal)`;
        }

        grid.innerHTML = '';
        allImages.forEach((item, index) => {
          const card = document.createElement('div');
          card.style.cssText = 'position:relative;background:#111;border:1px solid #333;border-radius:6px;overflow:hidden;display:flex;flex-direction:column;';

          const isPrimary = index === 0;
          const isNew = item.type === 'new';

          card.innerHTML = `
            <div style="position:relative;width:100%;height:120px;background:#050505;">
              <img src="${escapeHtml(item.url)}" alt="Foto ${index + 1}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.src='/assets/img/logo-ngl-diamond.jpeg';">
              ${isPrimary ? '<span style="position:absolute;top:6px;left:6px;background:#e50914;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;font-family:\'DM Mono\',monospace;letter-spacing:.05em;">PORTADA</span>' : ''}
              ${isNew ? '<span style="position:absolute;top:6px;right:6px;background:#0066cc;color:#fff;font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;font-family:\'DM Mono\',monospace;">NUEVA</span>' : ''}
              <span style="position:absolute;bottom:6px;left:6px;background:rgba(0,0,0,0.7);color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;font-family:\'DM Mono\',monospace;">#${index + 1}</span>
            </div>
            <div style="padding:6px;display:flex;gap:4px;align-items:center;justify-content:space-between;background:#181818;border-top:1px solid #282828;">
              <div style="display:flex;gap:2px;">
                <button type="button" class="btn-move-left" style="background:#222;color:#fff;border:1px solid #444;border-radius:3px;padding:2px 6px;font-size:11px;cursor:pointer;" ${index === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''} title="Mover a la izquierda">◀</button>
                <button type="button" class="btn-move-right" style="background:#222;color:#fff;border:1px solid #444;border-radius:3px;padding:2px 6px;font-size:11px;cursor:pointer;" ${index === allImages.length - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''} title="Mover a la derecha">▶</button>
              </div>
              <button type="button" class="btn-remove-img" style="background:#3a0000;color:#ff6666;border:1px solid #770000;border-radius:3px;padding:2px 6px;font-size:10px;font-weight:700;cursor:pointer;" title="Eliminar foto">✕</button>
            </div>
          `;

          const btnLeft = card.querySelector('.btn-move-left');
          const btnRight = card.querySelector('.btn-move-right');
          const btnDel = card.querySelector('.btn-remove-img');

          if (btnLeft && index > 0) {
            btnLeft.addEventListener('click', () => {
              const temp = allImages[index - 1];
              allImages[index - 1] = allImages[index];
              allImages[index] = temp;
              renderGallery();
            });
          }

          if (btnRight && index < allImages.length - 1) {
            btnRight.addEventListener('click', () => {
              const temp = allImages[index + 1];
              allImages[index + 1] = allImages[index];
              allImages[index] = temp;
              renderGallery();
            });
          }

          if (btnDel) {
            btnDel.addEventListener('click', () => {
              if (item.type === 'new' && item.file) {
                try { URL.revokeObjectURL(item.url); } catch (_) {}
              }
              allImages.splice(index, 1);
              renderGallery();
            });
          }

          grid.appendChild(card);
        });
      }
    }

    updateDirectPreview();
  }

  function bindImages() {
    const input = document.getElementById('imagesInput');
    const delAllBtn = document.getElementById('deleteAllImagesBtn');

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
          allImages.push({
            type: 'new',
            file,
            url: URL.createObjectURL(file),
            id: 'file_' + Math.random().toString(36).substring(2, 9),
          });
        }

        if (errorMsg) {
          window.auth.setMessage('formMessage', errorMsg, 'error');
        } else {
          window.auth.setMessage('formMessage', '', 'info');
        }

        input.value = '';
        renderGallery();
      });
    }

    if (delAllBtn) {
      delAllBtn.addEventListener('click', function () {
        if (!confirm('¿Seguro que deseas quitar todas las fotos del producto?')) return;
        allImages.forEach((img) => {
          if (img.type === 'new') {
            try { URL.revokeObjectURL(img.url); } catch (_) {}
          }
        });
        allImages = [];
        renderGallery();
      });
    }
  }

  function bindForm() {
    const form = document.getElementById('productForm');
    if (form) {
      form.addEventListener('submit', handleSubmit);
    }
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
    const sizeGuideEl = document.getElementById('size_guide');
    const categoryEl = document.getElementById('category');
    const subcatEl = document.getElementById('subcategory');
    const activeEl = document.getElementById('active');
    const featuredEl = document.getElementById('featured');
    const directPurchaseEl = document.getElementById('direct_purchase');

    const name = (nameEl ? nameEl.value : '').trim();
    const description = (descEl ? descEl.value : '').trim();
    const priceRaw = priceEl ? priceEl.value : '';
    const stockRaw = stockEl ? stockEl.value : '';
    const sizes = (sizesEl ? sizesEl.value : '').trim();
    const size_guide = (sizeGuideEl ? sizeGuideEl.value : '').trim() || null;
    const category = (categoryEl && categoryEl.value ? categoryEl.value : '').toLowerCase().trim();
    const subcategory = (subcatEl && subcatEl.value ? subcatEl.value : '').toLowerCase().trim() || null;
    const subcatSelectedOpt = subcatEl && subcatEl.selectedIndex >= 0 ? subcatEl.options[subcatEl.selectedIndex] : null;
    const subcategory_id = subcatSelectedOpt && subcatSelectedOpt.dataset.id ? subcatSelectedOpt.dataset.id : null;

    const active = !!(activeEl && activeEl.checked);
    const featured = !!(featuredEl && featuredEl.checked);
    const direct_purchase = !!(directPurchaseEl && directPurchaseEl.checked);

    const allowed_payment_methods = Array.from(document.querySelectorAll('.direct-pay-method:checked')).map((c) => c.value);
    const allowed_installments = Array.from(document.querySelectorAll('.direct-installment:checked')).map((c) => parseInt(c.value, 10)).filter(Boolean);

    if (!name) {
      window.auth.setMessage(msgId, 'El nombre del producto es obligatorio', 'error');
      if (nameEl) nameEl.focus();
      return;
    }

    if (!category) {
      window.auth.setMessage(msgId, 'Seleccioná la categoría del producto', 'error');
      if (categoryEl) categoryEl.focus();
      return;
    }

    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      window.auth.setMessage(msgId, 'Precio inválido', 'error');
      if (priceEl) priceEl.focus();
      return;
    }

    const stock = parseInt(stockRaw, 10);
    if (!Number.isInteger(stock) || stock < 0) {
      window.auth.setMessage(msgId, 'Stock inválido', 'error');
      if (stockEl) stockEl.focus();
      return;
    }

    if (direct_purchase && allowed_payment_methods.length === 0) {
      window.auth.setMessage(msgId, 'Para compra directa, debés seleccionar al menos un método de pago permitido.', 'error');
      return;
    }

    window.auth.setButtonLoading(btnId, true, 'GUARDANDO...');
    window.auth.setMessage(msgId, 'Procesando...', 'info');

    try {
      const discEnabledEl = document.getElementById('direct_discount_enabled');
      const discPctEl = document.getElementById('direct_discount_percent');
      const discTxtEl = document.getElementById('direct_discount_text');
      const showPromoEl = document.getElementById('direct_show_promo_badge');
      const promoTxtEl = document.getElementById('direct_promo_badge_text');
      const instCountEl = document.getElementById('direct_installments_count');
      const instTxtEl = document.getElementById('direct_installments_text');
      const custTransEl = document.getElementById('direct_custom_transfer_price');
      const transTxtEl = document.getElementById('direct_transfer_text');

      const isDiscEnabled = discEnabledEl ? discEnabledEl.checked : true;
      const direct_discount_percent = isDiscEnabled && discPctEl && discPctEl.value !== '' ? Number(discPctEl.value) : 0;
      const direct_discount_text = discTxtEl && discTxtEl.value ? discTxtEl.value.trim() : 'con transferencia';
      const direct_show_promo_badge = showPromoEl ? showPromoEl.checked : true;
      const direct_promo_badge_text = promoTxtEl && promoTxtEl.value ? promoTxtEl.value.trim() : 'PROMO ACTIVA';
      const direct_installments_count = instCountEl && instCountEl.value !== '' ? Number(instCountEl.value) : 6;
      const direct_installments_text = instTxtEl && instTxtEl.value ? instTxtEl.value.trim() : 'sin interés';
      const direct_custom_transfer_price = custTransEl && custTransEl.value !== '' && custTransEl.value !== null ? Number(custTransEl.value) : null;
      const direct_transfer_text = transTxtEl && transTxtEl.value ? transTxtEl.value.trim() : 'con Transferencia';

      // 1. Upload new image files if any
      const newItems = allImages.filter((item) => item.type === 'new' && item.file);
      const uploadedUrlsMap = new Map();

      if (newItems.length > 0) {
        window.auth.setMessage(msgId, `Subiendo ${newItems.length} imagen${newItems.length > 1 ? 'es' : ''} nueva${newItems.length > 1 ? 's' : ''}...`, 'info');
        const fd = new FormData();
        newItems.forEach((item) => {
          fd.append('images', item.file);
        });

        const upRes = await window.auth.apiFetch('/api/admin/products/upload-images', {
          method: 'POST',
          body: fd,
        });

        if (!upRes.ok) throw new Error(upRes.message || 'Error al subir las nuevas imágenes');

        let returnedUrls = [];
        if (Array.isArray(upRes.images)) {
          returnedUrls = upRes.images;
        } else if (Array.isArray(upRes.data?.images)) {
          returnedUrls = upRes.data.images;
        } else if (upRes.image_url) {
          returnedUrls = [upRes.image_url];
        } else if (upRes.data?.image_url) {
          returnedUrls = [upRes.data.image_url];
        }

        newItems.forEach((item, idx) => {
          if (returnedUrls[idx]) {
            uploadedUrlsMap.set(item.id, returnedUrls[idx]);
          }
        });
      }

      // 2. Compute final image URLs array preserving precise gallery order
      const finalImageUrls = allImages.map((item) => {
        if (item.type === 'existing') return item.url;
        return uploadedUrlsMap.get(item.id) || item.url;
      }).filter(Boolean);

      const primaryImageUrl = finalImageUrls[0] || null;

      const payload = {
        name,
        description,
        price,
        sizes,
        size_guide,
        stock,
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
        image_url: primaryImageUrl,
        images: finalImageUrls,
        product_images: finalImageUrls,
      };

      let saveRes;
      if (isEditMode) {
        saveRes = await window.auth.apiFetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
          method: 'PUT',
          body: payload,
        });
      } else {
        saveRes = await window.auth.apiFetch('/api/admin/products', {
          method: 'POST',
          body: payload,
        });
      }

      if (!saveRes.ok) throw new Error(saveRes.message || 'Error al guardar el producto');

      const actionText = isEditMode ? 'actualizado' : 'creado';
      window.auth.setMessage(msgId, `Producto ${actionText} correctamente. Redirigiendo...`, 'success');
      setTimeout(() => window.location.replace('/admin/products.html'), 800);
    } catch (err) {
      window.auth.setMessage(msgId, err.message || 'Error inesperado al guardar', 'error');
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
