// Admin: banners promocionales (ofertas y combos) con productos y precio promocional
(function () {
  'use strict';

  const DAY_IN_MS = 24 * 60 * 60 * 1000;
  const DURATION_PRESETS = ['0.5', '1', '3', '7', '15', '30'];

  let allBanners = [];
  let allProducts = [];
  let deleteId = null;
  let editingId = null;
  // product_id -> { selected, promo_price }
  const picked = new Map();

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const formatCurrency = (value) => '$ ' + Math.round(Number(value) || 0).toLocaleString('es-AR');
  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  };
  const localDateValue = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  };

  async function init() {
    const user = await window.auth.requireAuth({ requireAdmin: true });
    if (!user) return;
    $('searchInput')?.addEventListener('input', applyFilter);
    $('syncBtn')?.addEventListener('click', loadBanners);
    $('newBannerBtn')?.addEventListener('click', () => openForm(null));
    $('bannerFormCancel')?.addEventListener('click', closeForm);
    $('bannerForm')?.addEventListener('submit', saveBanner);
    $('deleteCancelBtn')?.addEventListener('click', closeDelete);
    $('deleteConfirmBtn')?.addEventListener('click', confirmDelete);
    $('deleteModal')?.addEventListener('click', (event) => { if (event.target === $('deleteModal')) closeDelete(); });
    $('bannerFormModal')?.addEventListener('click', (event) => { if (event.target === $('bannerFormModal')) closeForm(); });
    $('bannersTbody')?.addEventListener('click', handleTableAction);
    $('bannerDuration')?.addEventListener('change', toggleCustomEndDate);
    $('bannerType')?.addEventListener('change', renderPickerSummary);
    $('bannerProductSearch')?.addEventListener('input', renderPicker);
    $('bannerProductsList')?.addEventListener('change', handlePickerChange);
    $('bannerProductsList')?.addEventListener('input', handlePickerChange);
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      closeDelete();
      closeForm();
    });
    await Promise.all([loadBanners(), loadProducts()]);
  }

  async function loadProducts() {
    try {
      const response = await fetch('/api/products/public?limit=200', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const json = await response.json();
      allProducts = json && json.ok && Array.isArray(json.data) ? json.data : [];
    } catch (_error) {
      allProducts = [];
    }
    renderPicker();
  }

  async function loadBanners() {
    const tbody = $('bannersTbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--grey);font-family:\'DM Mono\',monospace;">Cargando banners...</td></tr>';
    const response = await window.auth.apiFetch('/api/admin/banners?limit=100', { method: 'GET' });
    if (!response.ok) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:#fff;font-family:'DM Mono',monospace;">${escapeHtml(response.message || 'No se pudieron cargar los banners')}</td></tr>`;
      window.auth.setMessage('pageMessage', response.message || 'No se pudieron cargar los banners', 'error');
      return;
    }
    allBanners = Array.isArray(response.data) ? response.data : [];
    applyFilter();
  }

  function applyFilter() {
    const query = String($('searchInput')?.value || '').trim().toLowerCase();
    const filtered = query
      ? allBanners.filter((banner) => [banner.title, banner.subtitle, banner.cta_text, banner.link, banner.banner_type].some((value) => String(value || '').toLowerCase().includes(query)))
      : allBanners;
    renderTable(filtered);
  }

  function renderTable(list) {
    const tbody = $('bannersTbody');
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--grey);font-family:\'DM Mono\',monospace;">No hay banners creados.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((banner) => {
      const title = escapeHtml(banner.title || '').replace(/\n/g, '<br>');
      const active = banner.active && (!banner.end_date || new Date(banner.end_date).getTime() > Date.now());
      const isCombo = String(banner.banner_type || 'oferta') === 'combo';
      const items = Array.isArray(banner.items) ? banner.items : [];
      const promoTotal = items.reduce((sum, item) => sum + (Number(item.promo_price) || 0), 0);
      const image = banner.image_url
        ? `<img src="${escapeHtml(banner.image_url)}" alt="" style="width:64px;height:40px;object-fit:contain;border:1px solid var(--border);display:block;margin:0 auto;background:#000;">`
        : '<div style="width:64px;height:40px;background:var(--dark2);margin:0 auto;border:1px dashed var(--border);"></div>';
      return `<tr data-id="${escapeHtml(banner.id)}">
        <td>${image}</td>
        <td><div style="font-family:'Cinzel',serif;font-weight:600;font-size:15px;line-height:1.2;">${title}</div><div style="margin-top:6px;font-size:11px;color:var(--grey);">${escapeHtml(banner.subtitle || '')}</div></td>
        <td><span class="type-pill ${isCombo ? 'type-combo' : ''}">${isCombo ? 'COMBO' : 'OFERTA'}</span><div style="margin-top:6px;font-size:10px;color:var(--grey);font-family:'DM Mono',monospace;">${items.length} prod.${items.length ? ` · ${escapeHtml(formatCurrency(promoTotal))}` : ''}</div></td>
        <td><div style="font-weight:600;font-size:11px;letter-spacing:.15em;">${escapeHtml(banner.cta_text || 'VER PROMOS')}</div><div style="margin-top:4px;font-size:10px;color:var(--grey);word-break:break-all;">${escapeHtml(banner.link || '')}</div></td>
        <td style="font-family:'DM Mono',monospace;font-size:11px;">${escapeHtml(formatDate(banner.end_date))}</td>
        <td style="font-family:'DM Mono',monospace;font-size:12px;">${Number(banner.sort_order) || 0}</td>
        <td><span class="status-pill ${active ? 'status-on' : 'status-off'}"><span></span>${active ? 'ACTIVO' : 'INACTIVO'}</span></td>
        <td><div style="display:flex;flex-wrap:wrap;gap:6px;"><button type="button" class="btn-mini" data-action="edit" data-id="${escapeHtml(banner.id)}">EDITAR</button><button type="button" class="btn-mini" data-action="toggle" data-id="${escapeHtml(banner.id)}">TOGGLE</button><button type="button" class="btn-mini btn-delete" data-action="delete" data-id="${escapeHtml(banner.id)}">ELIMINAR</button></div></td>
      </tr>`;
    }).join('');
  }

  function handleTableAction(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const banner = allBanners.find((item) => item.id === button.dataset.id);
    if (!banner) return;
    if (button.dataset.action === 'edit') openForm(banner);
    if (button.dataset.action === 'toggle') toggleActive(banner);
    if (button.dataset.action === 'delete') openDelete(banner);
  }

  // ===================== Selector de productos =====================

  function productById(id) {
    return allProducts.find((product) => String(product.id) === String(id)) || null;
  }

  function pickedEntries() {
    return Array.from(picked.entries())
      .filter(([, value]) => value && value.selected)
      .map(([productId, value]) => ({ productId, promo_price: value.promo_price }));
  }

  function renderPicker() {
    const list = $('bannerProductsList');
    if (!list) return;
    const query = String($('bannerProductSearch')?.value || '').trim().toLowerCase();
    const visible = query
      ? allProducts.filter((product) => String(product.name || '').toLowerCase().includes(query))
      : allProducts;

    if (!allProducts.length) {
      list.innerHTML = '<div style="padding:18px;text-align:center;font:400 11px \'DM Mono\',monospace;color:var(--grey);">No hay productos cargados todavía.</div>';
      renderPickerSummary();
      return;
    }
    if (!visible.length) {
      list.innerHTML = '<div style="padding:18px;text-align:center;font:400 11px \'DM Mono\',monospace;color:var(--grey);">Sin resultados para esa búsqueda.</div>';
      renderPickerSummary();
      return;
    }

    list.innerHTML = visible.map((product) => {
      const entry = picked.get(String(product.id)) || { selected: false, promo_price: '' };
      const listPrice = Number(product.price) || 0;
      const promoPrice = Number(entry.promo_price);
      const off = entry.selected && listPrice > 0 && Number.isFinite(promoPrice) && promoPrice < listPrice
        ? `-${Math.round(((listPrice - promoPrice) / listPrice) * 100)}%`
        : '';
      const thumb = product.image_url
        ? `<span class="promo-pick-thumb"><img src="${escapeHtml(product.image_url)}" alt=""></span>`
        : '<span class="promo-pick-thumb"></span>';
      return `<div class="promo-pick${entry.selected ? ' is-picked' : ''}" data-product-id="${escapeHtml(product.id)}">
        <input type="checkbox" data-pick ${entry.selected ? 'checked' : ''} aria-label="Incluir ${escapeHtml(product.name || '')}">
        ${thumb}
        <span class="promo-pick-info">
          <b>${escapeHtml(product.name || 'Producto')}</b>
          <small>Normal ${escapeHtml(formatCurrency(listPrice))} · Stock ${Number(product.stock) || 0}</small>
        </span>
        <input class="form-control promo-pick-price" type="number" min="0" step="1" data-price value="${escapeHtml(entry.promo_price)}" placeholder="Precio promo" aria-label="Precio promocional de ${escapeHtml(product.name || '')}">
        <span class="promo-pick-off">${off}</span>
      </div>`;
    }).join('');
    renderPickerSummary();
  }

  function handlePickerChange(event) {
    const row = event.target.closest('.promo-pick');
    if (!row) return;
    const productId = row.dataset.productId;
    const checkbox = row.querySelector('[data-pick]');
    const priceInput = row.querySelector('[data-price]');
    const product = productById(productId);
    const entry = picked.get(productId) || { selected: false, promo_price: '' };

    if (event.target === checkbox) {
      entry.selected = checkbox.checked;
      // Prefill con el precio normal para que el admin sólo tenga que bajarlo.
      if (entry.selected && !String(entry.promo_price).trim() && product) {
        entry.promo_price = String(Math.round(Number(product.price) || 0));
        if (priceInput) priceInput.value = entry.promo_price;
      }
    }
    if (event.target === priceInput) entry.promo_price = priceInput.value;

    picked.set(productId, entry);
    row.classList.toggle('is-picked', Boolean(entry.selected));

    const listPrice = Number(product && product.price) || 0;
    const promoPrice = Number(entry.promo_price);
    const offNode = row.querySelector('.promo-pick-off');
    if (offNode) {
      offNode.textContent = entry.selected && listPrice > 0 && Number.isFinite(promoPrice) && promoPrice < listPrice
        ? `-${Math.round(((listPrice - promoPrice) / listPrice) * 100)}%`
        : '';
    }
    renderPickerSummary();
  }

  function renderPickerSummary() {
    const summary = $('bannerProductsSummary');
    if (!summary) return;
    const entries = pickedEntries();
    if (!entries.length) {
      summary.innerHTML = 'Sin productos seleccionados. El banner se muestra sólo con título, subtítulo y contador.';
      return;
    }
    const isCombo = String($('bannerType')?.value || 'oferta') === 'combo';
    let listTotal = 0;
    let promoTotal = 0;
    entries.forEach((entry) => {
      const product = productById(entry.productId);
      listTotal += Number(product && product.price) || 0;
      promoTotal += Number(entry.promo_price) || 0;
    });
    const off = listTotal > 0 && promoTotal < listTotal ? Math.round(((listTotal - promoTotal) / listTotal) * 100) : 0;
    summary.innerHTML = `<b>${entries.length}</b> producto(s) seleccionado(s).<br>`
      + `Precio normal sumado: <b>${escapeHtml(formatCurrency(listTotal))}</b> · `
      + `${isCombo ? 'Precio del combo' : 'Total promocional'}: <b>${escapeHtml(formatCurrency(promoTotal))}</b>`
      + (off > 0 ? ` · Ahorro <b>${off}%</b>` : '');
  }

  function toggleCustomEndDate() {
    const isCustom = String($('bannerDuration')?.value || '') === 'custom';
    const group = $('bannerEndDateGroup');
    if (group) group.style.display = isCustom ? '' : 'none';
  }

  // ===================== Formulario =====================

  function openForm(banner) {
    editingId = banner?.id || null;
    $('bannerFormTitle').textContent = editingId ? 'Editar Banner' : 'Nuevo Banner';
    $('bannerTitle').value = banner?.title || '';
    $('bannerSubtitle').value = banner?.subtitle || '';
    $('bannerCta').value = banner?.cta_text || 'VER LAS PROMOS';
    $('bannerSort').value = Number(banner?.sort_order) || 0;
    $('bannerLink').value = banner?.link || '#pantalones';
    $('bannerImage').value = banner?.image_url || '';
    $('bannerType').value = String(banner?.banner_type || 'oferta') === 'combo' ? 'combo' : 'oferta';
    $('bannerEndDate').value = localDateValue(banner?.end_date);
    $('bannerActive').checked = banner ? banner.active !== false : true;
    $('bannerDuration').value = editingId ? 'custom' : '7';
    $('bannerProductSearch').value = '';
    toggleCustomEndDate();

    picked.clear();
    (Array.isArray(banner?.items) ? banner.items : []).forEach((item) => {
      picked.set(String(item.product_id), {
        selected: true,
        promo_price: String(Math.round(Number(item.promo_price) || 0)),
      });
    });
    renderPicker();

    $('bannerFormMessage').style.display = 'none';
    $('bannerFormModal').classList.add('open');
    $('bannerFormModal').setAttribute('aria-hidden', 'false');
    setTimeout(() => $('bannerTitle')?.focus(), 0);
  }

  function closeForm() {
    const modal = $('bannerFormModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    editingId = null;
  }

  function resolveEndDate() {
    const duration = String($('bannerDuration')?.value || '7');
    if (duration === 'custom') {
      const value = $('bannerEndDate').value;
      return value ? new Date(value).toISOString() : null;
    }
    const days = DURATION_PRESETS.includes(duration) ? Number(duration) : 7;
    return new Date(Date.now() + days * DAY_IN_MS).toISOString();
  }

  function collectItems() {
    const entries = pickedEntries();
    const invalid = entries.find((entry) => {
      const price = Number(entry.promo_price);
      return !String(entry.promo_price).trim() || !Number.isFinite(price) || price < 0;
    });
    if (invalid) {
      const product = productById(invalid.productId);
      return { error: `Ingresá un precio promocional válido para "${(product && product.name) || 'el producto'}".` };
    }
    return {
      items: entries.map((entry, index) => ({
        product_id: entry.productId,
        promo_price: Number(entry.promo_price),
        sort_order: index,
      })),
    };
  }

  async function saveBanner(event) {
    event.preventDefault();
    const title = $('bannerTitle').value.trim();
    if (!title) {
      showFormMessage('El título es requerido.');
      $('bannerTitle').focus();
      return;
    }

    const collected = collectItems();
    if (collected.error) {
      showFormMessage(collected.error);
      return;
    }
    const bannerType = $('bannerType').value === 'combo' ? 'combo' : 'oferta';
    if (bannerType === 'combo' && collected.items.length < 2) {
      showFormMessage('Un combo necesita al menos 2 productos.');
      return;
    }

    const endDate = resolveEndDate();
    if (String($('bannerDuration').value) === 'custom' && !endDate) {
      showFormMessage('Elegí la fecha y hora de vencimiento.');
      return;
    }

    const body = {
      title,
      subtitle: $('bannerSubtitle').value.trim(),
      cta_text: $('bannerCta').value.trim(),
      sort_order: Number($('bannerSort').value) || 0,
      link: $('bannerLink').value.trim(),
      image_url: $('bannerImage').value.trim(),
      banner_type: bannerType,
      end_date: endDate,
      active: $('bannerActive').checked,
      items: collected.items,
    };

    const button = $('bannerFormSave');
    window.auth.setButtonLoading(button.id, true, 'GUARDANDO...');
    const response = await window.auth.apiFetch(editingId ? `/api/admin/banners/${encodeURIComponent(editingId)}` : '/api/admin/banners', {
      method: editingId ? 'PUT' : 'POST',
      body,
    });
    window.auth.setButtonLoading(button.id, false);
    if (!response.ok) {
      showFormMessage(response.message || 'No se pudo guardar el banner.');
      return;
    }
    closeForm();
    window.auth.setMessage('pageMessage', 'Banner guardado correctamente', 'success');
    await loadBanners();
  }

  function showFormMessage(message) {
    const element = $('bannerFormMessage');
    if (!element) return;
    element.textContent = message;
    element.className = 'form-message form-message-error';
    element.style.display = 'block';
  }

  async function toggleActive(banner) {
    const response = await window.auth.apiFetch(`/api/admin/banners/${encodeURIComponent(banner.id)}/toggle-active`, { method: 'POST', body: {} });
    if (!response.ok) {
      window.auth.setMessage('pageMessage', response.message || 'No se pudo actualizar el banner', 'error');
      return;
    }
    await loadBanners();
    window.auth.setMessage('pageMessage', 'Estado actualizado', 'success');
  }

  function openDelete(banner) {
    deleteId = banner.id;
    $('deleteModalText').textContent = `¿Eliminar el banner "${banner.title || '(sin título)'}"? Esta acción no se puede deshacer.`;
    $('deleteModal').classList.add('open');
    $('deleteModal').setAttribute('aria-hidden', 'false');
  }

  function closeDelete() {
    deleteId = null;
    $('deleteModal')?.classList.remove('open');
    $('deleteModal')?.setAttribute('aria-hidden', 'true');
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    closeDelete();
    const response = await window.auth.apiFetch(`/api/admin/banners/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) {
      window.auth.setMessage('pageMessage', response.message || 'No se pudo eliminar el banner', 'error');
      return;
    }
    window.auth.setMessage('pageMessage', 'Banner eliminado correctamente', 'success');
    await loadBanners();
  }

  async function logout() {
    try { await window.auth.apiFetch('/api/auth/logout', { method: 'POST' }); } catch (_error) {}
    window.location.replace('/login.html');
  }
  window.logout = logout;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
