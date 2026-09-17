(function () {
  'use strict';

  let productId = null;
  let currentProduct = null;
  let allImages = []; // Array of { type: 'existing' | 'new', url: string, file?: File, id: string }
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

    bindImages();
    bindSizeStockManager();
    bindForm();
    bindDirectPurchase();
    await loadCategories();
    bindCategoryEvents();
    await cargarProducto();
  }

  let sizeStockItems = [];

  function bindSizeStockManager() {
    renderSizeStockList();

    const addBtn = document.getElementById('addNewSizeBtn');
    const nameInput = document.getElementById('newSizeNameInput');
    const stockInput = document.getElementById('newSizeStockInput');

    if (addBtn && nameInput) {
      addBtn.addEventListener('click', () => {
        const rawName = (nameInput.value || '').trim();
        const rawStock = Math.max(0, parseInt(stockInput?.value, 10) || 0);
        if (!rawName) {
          nameInput.focus();
          return;
        }

        const existing = sizeStockItems.find((s) => s.size_name.toLowerCase() === rawName.toLowerCase());
        if (existing) {
          existing.stock += rawStock;
        } else {
          sizeStockItems.push({ size_name: rawName, stock: rawStock });
        }

        nameInput.value = '';
        if (stockInput) stockInput.value = '5';
        renderSizeStockList();
      });

      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addBtn.click();
        }
      });
    }

    document.querySelectorAll('.size-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        if (preset === 's_m_l_xl') {
          sizeStockItems = [
            { size_name: 'S', stock: 5 },
            { size_name: 'M', stock: 5 },
            { size_name: 'L', stock: 5 },
            { size_name: 'XL', stock: 5 },
          ];
        } else if (preset === 'xs_s_m_l_xl_xxl') {
          sizeStockItems = [
            { size_name: 'XS', stock: 3 },
            { size_name: 'S', stock: 5 },
            { size_name: 'M', stock: 8 },
            { size_name: 'L', stock: 8 },
            { size_name: 'XL', stock: 5 },
            { size_name: 'XXL', stock: 2 },
          ];
        } else if (preset === 'jeans_38_46') {
          sizeStockItems = [
            { size_name: '38', stock: 4 },
            { size_name: '40', stock: 6 },
            { size_name: '42', stock: 6 },
            { size_name: '44', stock: 4 },
            { size_name: '46', stock: 2 },
          ];
        } else if (preset === 'unico') {
          sizeStockItems = [
            { size_name: 'Único', stock: 10 },
          ];
        }
        renderSizeStockList();
      });
    });
  }

  function renderSizeStockList() {
    const listEl = document.getElementById('sizeStockList');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (sizeStockItems.length === 0) {
      listEl.innerHTML = '<div style="padding:10px;text-align:center;color:#666;font-size:12px;font-family:\'DM Mono\',monospace;border:1px dashed #333;border-radius:4px;">No hay talles configurados. Agregá uno abajo o seleccioná una plantilla.</div>';
    }

    let total = 0;
    const sizeNames = [];

    sizeStockItems.forEach((item, idx) => {
      const stockNum = Math.max(0, parseInt(item.stock, 10) || 0);
      total += stockNum;
      if (item.size_name && item.size_name.trim()) {
        sizeNames.push(item.size_name.trim());
      }

      const row = document.createElement('div');
      row.className = 'size-stock-row';
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;background:#18181b;padding:8px 12px;border:1px solid #27272a;border-radius:6px;flex-wrap:wrap;';

      const isOut = stockNum === 0;

      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:140px;">
          <input type="text" class="size-name-input form-control" data-idx="${idx}" value="${escapeHtml(item.size_name || '')}" placeholder="Talle" maxlength="20" style="width:110px;background:#09090b;border-color:#3f3f46;color:#fff;font-weight:700;font-size:13px;padding:6px 10px;height:34px;">
          <span style="font-size:11px;font-family:'DM Mono',monospace;color:${isOut ? '#ef4444' : '#22c55e'};padding:2px 8px;border-radius:3px;background:${isOut ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)'};border:1px solid ${isOut ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'};">
            ${isOut ? 'AGOTADO (0 u.)' : `${stockNum} disp.`}
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:11px;font-family:'DM Mono',monospace;color:#aaa;margin:0;">Stock:</label>
          <input type="number" class="size-stock-input form-control" data-idx="${idx}" min="0" step="1" value="${stockNum}" style="width:90px;background:#09090b;border-color:#3f3f46;color:#fff;font-size:13px;padding:6px 8px;height:34px;">
          <button type="button" class="remove-size-btn button secondary" data-idx="${idx}" title="Eliminar talle" style="width:34px;height:34px;padding:0;display:flex;align-items:center;justify-content:center;color:#ef4444;border-color:#450a0a;background:#18181b;font-size:14px;cursor:pointer;">✕</button>
        </div>
      `;

      listEl.appendChild(row);
    });

    const totalDisplay = document.getElementById('totalStockDisplay');
    const sizesInput = document.getElementById('sizes');
    const stockInput = document.getElementById('stock');
    if (totalDisplay) totalDisplay.textContent = total;
    if (sizesInput) sizesInput.value = sizeNames.join(' · ');
    if (stockInput) stockInput.value = total;

    listEl.querySelectorAll('.size-name-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        if (sizeStockItems[idx]) {
          sizeStockItems[idx].size_name = e.target.value.trim();
          updateHiddenFields();
        }
      });
    });

    listEl.querySelectorAll('.size-stock-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        if (sizeStockItems[idx]) {
          sizeStockItems[idx].stock = Math.max(0, parseInt(e.target.value, 10) || 0);
          updateHiddenFields();
        }
      });
      input.addEventListener('change', () => {
        renderSizeStockList();
      });
    });

    listEl.querySelectorAll('.remove-size-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        if (!isNaN(idx) && sizeStockItems[idx]) {
          sizeStockItems.splice(idx, 1);
          renderSizeStockList();
        }
      });
    });
  }

  function updateHiddenFields() {
    let total = 0;
    const sizeNames = [];
    sizeStockItems.forEach((item) => {
      const stockNum = Math.max(0, parseInt(item.stock, 10) || 0);
      total += stockNum;
      if (item.size_name && item.size_name.trim()) {
        sizeNames.push(item.size_name.trim());
      }
    });
    const totalDisplay = document.getElementById('totalStockDisplay');
    const sizesInput = document.getElementById('sizes');
    const stockInput = document.getElementById('stock');
    if (totalDisplay) totalDisplay.textContent = total;
    if (sizesInput) sizesInput.value = sizeNames.join(' · ');
    if (stockInput) stockInput.value = total;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function bindDirectPurchase() {
    const chk = document.getElementById('direct_purchase');
    const box = document.getElementById('directPurchaseConfigBox');
    if (!box) return;
    
    function updateVisibility() {
      box.style.display = 'block';
      updateDirectPreview();
    }

    if (chk) {
      chk.addEventListener('change', updateVisibility);
    }

    // Bind inputs for live preview
    const inputsToWatch = [
      'name', 'price',
      'direct_purchase',
      'direct_discount_enabled',
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
  }

  function fmtPriceAR(num) {
    const n = Number(num) || 0;
    return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function updateDirectPreview() {
    const nameEl = document.getElementById('name');
    const priceEl = document.getElementById('price');
    const directChk = document.getElementById('direct_purchase');
    const discEnabledEl = document.getElementById('direct_discount_enabled');
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
    const prevBtn = document.getElementById('previewActionBtn');

    if (!prevPrice) return;

    const isDirect = directChk ? directChk.checked : false;
    const isDiscEnabled = discEnabledEl ? discEnabledEl.checked : true;
    const basePrice = Number(priceEl?.value) || 0;
    const name = (nameEl?.value || '').trim() || 'PANTALON BAGGY IGOR PINK';
    const discPct = isDiscEnabled && discPctEl ? Number(discPctEl.value) || 0 : 0;
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
      if (isDiscEnabled && discPct > 0) {
        prevDisc.style.display = 'block';
        prevDisc.textContent = `${discPct}% OFF ${discTxt}`;
      } else {
        prevDisc.style.display = 'none';
      }
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

    if (prevBtn) {
      if (isDirect) {
        prevBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          <span>COMPRAR</span>
        `;
        prevBtn.style.background = '#ffffff';
        prevBtn.style.color = '#000000';
      } else {
        prevBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
          <span>AGREGAR</span>
        `;
        prevBtn.style.background = '#232733';
        prevBtn.style.color = '#ffffff';
      }
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

    // Load Size Stock
    if (Array.isArray(p.size_stock) && p.size_stock.length > 0) {
      sizeStockItems = p.size_stock.map((s) => ({
        size_name: s.size_name || '',
        stock: Math.max(0, parseInt(s.stock, 10) || 0)
      }));
    } else if (p.sizes && p.sizes.trim()) {
      const parsed = p.sizes.split(/\s*[-|/,·]\s*/).map((s) => s.trim()).filter(Boolean);
      const isSingle = parsed.length <= 1;
      sizeStockItems = parsed.map((s) => ({
        size_name: s,
        stock: isSingle ? (parseInt(p.stock, 10) || 0) : 5
      }));
    } else {
      sizeStockItems = [
        { size_name: 'Único', stock: parseInt(p.stock, 10) || 0 }
      ];
    }
    renderSizeStockList();

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

    const isDirect = !!(p.direct_purchase === true || p.direct_purchase === 1 || p.direct_purchase === 'true');
    const directEl = document.getElementById('direct_purchase');
    const boxEl = document.getElementById('directPurchaseConfigBox');
    if (directEl) directEl.checked = isDirect;
    if (boxEl) boxEl.style.display = 'block';

    const discEnabledEl = document.getElementById('direct_discount_enabled');
    const hasDiscount = p.direct_discount_percent !== undefined && p.direct_discount_percent !== null ? Number(p.direct_discount_percent) > 0 : true;
    if (discEnabledEl) discEnabledEl.checked = hasDiscount;

    const discPctEl = document.getElementById('direct_discount_percent');
    if (discPctEl) {
      discPctEl.value = p.direct_discount_percent !== undefined && p.direct_discount_percent !== null ? p.direct_discount_percent : 25;
    }
    const discTxtEl = document.getElementById('direct_discount_text');
    if (discTxtEl) {
      discTxtEl.value = p.direct_discount_text || 'con transferencia';
    }
    const showPromoEl = document.getElementById('direct_show_promo_badge');
    if (showPromoEl) {
      showPromoEl.checked = p.direct_show_promo_badge !== false && String(p.direct_show_promo_badge) !== 'false';
    }
    const promoTxtEl = document.getElementById('direct_promo_badge_text');
    if (promoTxtEl) {
      promoTxtEl.value = p.direct_promo_badge_text || 'PROMO ACTIVA';
    }
    const instCountEl = document.getElementById('direct_installments_count');
    if (instCountEl) {
      instCountEl.value = p.direct_installments_count !== undefined && p.direct_installments_count !== null ? p.direct_installments_count : 6;
    }
    const instTxtEl = document.getElementById('direct_installments_text');
    if (instTxtEl) {
      instTxtEl.value = p.direct_installments_text || 'sin interés';
    }
    const custTransEl = document.getElementById('direct_custom_transfer_price');
    if (custTransEl) {
      custTransEl.value = p.direct_custom_transfer_price !== undefined && p.direct_custom_transfer_price !== null ? p.direct_custom_transfer_price : '';
    }
    const transTxtEl = document.getElementById('direct_transfer_text');
    if (transTxtEl) {
      transTxtEl.value = p.direct_transfer_text || 'con Transferencia';
    }

    updateDirectPreview();

    const allowedMethods = Array.isArray(p.allowed_payment_methods)
      ? p.allowed_payment_methods
      : (typeof p.allowed_payment_methods === 'string'
          ? (p.allowed_payment_methods.startsWith('[') ? JSON.parse(p.allowed_payment_methods) : [p.allowed_payment_methods])
          : ['tarjeta_debito', 'tarjeta_credito', 'transferencia', 'efectivo']);

    document.querySelectorAll('.direct-pay-method').forEach((chk) => {
      chk.checked = allowedMethods.includes(chk.value);
    });

    const allowedInst = Array.isArray(p.allowed_installments)
      ? p.allowed_installments.map(Number)
      : (typeof p.allowed_installments === 'string'
          ? (p.allowed_installments.startsWith('[') ? JSON.parse(p.allowed_installments).map(Number) : [1, 3, 6])
          : [1, 3, 6]);

    document.querySelectorAll('.direct-installment').forEach((chk) => {
      chk.checked = allowedInst.includes(Number(chk.value));
    });

    let initialImages = [];
    if (Array.isArray(p.images)) {
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
    window.auth.setMessage(msgId, '', 'info');
  }

  function renderGallery() {
    const container = document.getElementById('imagesGalleryContainer');
    const grid = document.getElementById('imagesGrid');
    const countText = document.getElementById('galleryCountText');
    const delAllBtn = document.getElementById('deleteAllImagesBtn');
    const input = document.getElementById('imagesInput');

    if (!container || !grid) return;

    if (allImages.length === 0) {
      container.style.display = 'none';
      grid.innerHTML = '';
      if (delAllBtn) delAllBtn.style.display = 'none';
      return;
    }

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
          <img src="${item.url}" alt="Foto ${index + 1}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.src='/assets/img/logo-ngl-diamond.jpeg';">
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

      // Events
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
    form.addEventListener('submit', handleSubmit);
  }
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
    const category = (categoryEl && categoryEl.value || '').toLowerCase().trim();
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
      const direct_discount_percent = isDiscEnabled && discPctEl && discPctEl.value !== '' ? Number(discPctEl.value) : (isDiscEnabled ? 25 : 0);
      const direct_discount_text = discTxtEl && discTxtEl.value ? discTxtEl.value.trim() : 'con transferencia';
      const direct_show_promo_badge = showPromoEl ? showPromoEl.checked : true;
      const direct_promo_badge_text = promoTxtEl && promoTxtEl.value ? promoTxtEl.value.trim() : 'PROMO ACTIVA';
      const direct_installments_count = instCountEl && instCountEl.value !== '' ? Number(instCountEl.value) : 6;
      const direct_installments_text = instTxtEl && instTxtEl.value ? instTxtEl.value.trim() : 'sin interés';
      const direct_custom_transfer_price = custTransEl && custTransEl.value !== '' ? Number(custTransEl.value) : null;
      const direct_transfer_text = transTxtEl && transTxtEl.value ? transTxtEl.value.trim() : 'con Transferencia';

      const payload = {
        name,
        description,
        price,
        sizes,
        stock,
        size_stock: sizeStockItems,
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
      };
      // Upload any new images and build final ordered URLs
      const newItems = allImages.filter((item) => item.type === 'new' && item.file);
      let uploadedUrlsMap = new Map();

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

      const finalImageUrls = allImages.map((item) => {
        if (item.type === 'existing') return item.url;
        return uploadedUrlsMap.get(item.id) || item.url;
      }).filter(Boolean);

      const primaryImageUrl = finalImageUrls[0] || null;

      payload.images = finalImageUrls;
      payload.image_url = primaryImageUrl;

      const updRes = await window.auth.apiFetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
        method: 'PUT',
        body: payload,
      });

      if (!updRes.ok) throw new Error(updRes.message || 'Error al actualizar el producto');

      if (currentProduct && updRes.data) currentProduct = { ...currentProduct, ...updRes.data };

      window.auth.setMessage(msgId, 'Producto actualizado correctamente con todas sus fotos. Redirigiendo...', 'success');
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
