(function () {
  'use strict';

  let promosAll = [];
  let deleteTargetId = null;

  window.addEventListener('DOMContentLoaded', init);

  async function init() {
    const user = await window.auth.requireAuth({ requireAdmin: true });
    if (!user) return;
    if (typeof window.initSupabaseBrowser === 'function') {
      window.initSupabaseBrowser().catch(() => {});
    }
    bindSearch();
    bindModal();
    await cargarPromos();
  }

  function bindSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    let t;
    input.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(() => renderPromos(input.value || ''), 180);
    });
  }

  function bindModal() {
    const modal = document.getElementById('deleteModal');
    const cancel = document.getElementById('deleteCancelBtn');
    const confirm = document.getElementById('deleteConfirmBtn');
    cancel.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });
    confirm.addEventListener('click', confirmarEliminar);
  }

  function openModal(id, title) {
    deleteTargetId = id;
    const modal = document.getElementById('deleteModal');
    const text = document.getElementById('deleteModalText');
    text.textContent = `¿Estás seguro que deseas eliminar la promoción "${title || 'seleccionada'}"? Esta acción no se puede deshacer.`;
    modal.classList.add('open');
  }

  function closeModal() {
    deleteTargetId = null;
    document.getElementById('deleteModal').classList.remove('open');
  }

  async function confirmarEliminar() {
    if (!deleteTargetId) return;
    const msgId = 'pageMessage';
    const btn = document.getElementById('deleteConfirmBtn');
    window.auth.setButtonLoading(btn.id || 'deleteConfirmBtn', true, 'ELIMINANDO...');
    const res = await window.auth.apiFetch(`/api/admin/promotions/${deleteTargetId}`, { method: 'DELETE' });
    window.auth.setButtonLoading(btn.id || 'deleteConfirmBtn', false);
    if (!res.ok) {
      window.auth.setMessage(msgId, res.message || 'Error al eliminar la promoción', 'error');
      return;
    }
    closeModal();
    window.auth.setMessage(msgId, 'Promoción eliminada correctamente', 'success');
    await cargarPromos();
  }

  async function cargarPromos() {
    const msgId = 'pageMessage';
    const grid = document.getElementById('promosGrid');
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--grey);font-family:\'DM Mono\',monospace;letter-spacing:.1em;">Cargando promociones...</div>';

    const res = await window.auth.apiFetch('/api/admin/promotions?limit=200&include_products=1', { method: 'GET' });
    if (!res.ok) {
      grid.innerHTML = `<div style="text-align:center;padding:40px;color:#f5f5f5;font-family:'DM Mono',monospace;letter-spacing:.08em;">${escapeHtml(res.message || 'Error al cargar promociones')}</div>`;
      window.auth.setMessage(msgId, res.message || 'Error al cargar promociones', 'error');
      return;
    }

    promosAll = Array.isArray(res.data) ? res.data : [];
    renderPromos(document.getElementById('searchInput')?.value || '');

    if (!promosAll.length) {
      window.auth.setMessage(msgId, 'No hay promociones cargadas aún. Crea la primera con "Nueva Promoción".', 'info');
    } else {
      window.auth.setMessage(msgId, `${promosAll.length} promocione${promosAll.length === 1 ? '' : 's'} encontrada${promosAll.length === 1 ? '' : 's'}`, 'success');
      setTimeout(() => window.auth.setMessage(msgId, '', 'info'), 2200);
    }
  }

  function promoStatus(p) {
    const now = Date.now();
    const start = p.start_date ? new Date(p.start_date).getTime() : now;
    const end = p.end_date ? new Date(p.end_date).getTime() : null;
    if (!p.active) return { cls: 'inactive', label: 'INACTIVA' };
    if (start > now) return { cls: 'upcoming', label: 'PROXIMAMENTE' };
    if (end && end <= now) return { cls: 'expired', label: 'VENCIDA' };
    return { cls: 'active', label: 'ACTIVA' };
  }

  function discountLabel(p) {
    const type = p.discount_type || 'override_products';
    const val = Number(p.discount_value || 0);
    const map = {
      percentage: val ? `-${val}% GLOBAL` : '% por producto',
      fixed_amount: val ? `-$${Math.round(val)}` : '$ off',
      combo_price: val ? `PACK: $${Math.round(val)}` : 'Precio combo',
      override_products: 'Precio por producto'
    };
    return map[type] || type;
  }

  function formatDate(iso) {
    if (!iso) return 'Sin límite';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso).slice(0, 16);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}hs`;
    } catch (_e) { return String(iso).slice(0, 16); }
  }

  function renderPromos(query) {
    const grid = document.getElementById('promosGrid');
    const q = (query || '').trim().toLowerCase();
    const list = q
      ? promosAll.filter((p) =>
          ((p.title || '') + ' ' + (p.short_description || '') + ' ' + (p.description || '')).toLowerCase().includes(q)
        )
      : promosAll;

    if (!list.length) {
      grid.innerHTML = `<div style="text-align:center;padding:40px;color:var(--grey);font-family:'DM Mono',monospace;letter-spacing:.1em;">${q ? 'Sin resultados para tu búsqueda' : 'Sin promociones'}</div>`;
      return;
    }

    grid.innerHTML = '';
    const frag = document.createDocumentFragment();

    list.forEach((p) => {
      const st = promoStatus(p);
      const itemsCount = Array.isArray(p.promotion_products) ? p.promotion_products.length : 0;

      const card = document.createElement('div');
      card.className = 'promo-card';

      const imgWrap = document.createElement('div');
      imgWrap.className = 'promo-card-img';
      if (p.banner_image_url) {
        const img = document.createElement('img');
        img.src = p.banner_image_url;
        img.alt = escapeHtml(p.title || '');
        img.onerror = function () { this.style.display = 'none'; };
        imgWrap.appendChild(img);
      }
      card.appendChild(imgWrap);

      const body = document.createElement('div');
      body.className = 'promo-card-body';

      const topline = document.createElement('div');
      topline.className = 'topline';
      const statusBadge = document.createElement('span');
      statusBadge.className = `badge-chip ${st.cls}`;
      statusBadge.textContent = st.label;
      topline.appendChild(statusBadge);
      if (p.featured) {
        const feat = document.createElement('span');
        feat.className = 'badge-chip featured';
        feat.textContent = 'DESTACADA';
        topline.appendChild(feat);
      }
      const dt = document.createElement('span');
      dt.className = 'discount-type';
      dt.textContent = discountLabel(p);
      topline.appendChild(dt);

      body.appendChild(topline);

      const titleEl = document.createElement('div');
      titleEl.className = 'promo-title';
      titleEl.style.fontSize = '18px';
      titleEl.textContent = p.title || '(Sin título)';
      body.appendChild(titleEl);

      const meta = document.createElement('div');
      meta.className = 'promo-meta';
      meta.innerHTML = `
        ${escapeHtml(p.short_description || '')}
        <div style="margin-top:6px;">
          📅 Desde: <strong style="color:#ddd;">${formatDate(p.start_date)}</strong>
          &nbsp;·&nbsp; Hasta: <strong style="color:${p.end_date ? (promoStatus(p).cls === 'expired' ? '#ef4444' : '#ddd') : '#999'};">${formatDate(p.end_date)}</strong>
          <span class="items-count" style="margin-left:10px;">· ${itemsCount} producto${itemsCount === 1 ? '' : 's'}</span>
        </div>
      `;
      body.appendChild(meta);

      card.appendChild(body);

      const actions = document.createElement('div');
      actions.className = 'promo-card-actions';
      actions.innerHTML = `
        <button class="button primary" data-action="edit" data-id="${p.id}">EDITAR</button>
        <button class="button secondary" data-action="toggle-active" data-id="${p.id}" data-active="${p.active ? '1' : '0'}">
          ${p.active ? 'DESACTIVAR' : 'ACTIVAR'}
        </button>
        <button class="button secondary" data-action="toggle-featured" data-id="${p.id}" data-featured="${p.featured ? '1' : '0'}">
          ${p.featured ? 'QUITAR DESTACADA' : 'DESTACAR'}
        </button>
        <button class="button secondary" data-action="delete" data-id="${p.id}" data-title="${escapeAttr(p.title || '')}" style="border-color:#552424;color:#fca5a5;">
          ELIMINAR
        </button>
      `;
      card.appendChild(actions);

      frag.appendChild(card);
    });

    grid.appendChild(frag);

    grid.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', handleAction);
    });
  }

  async function handleAction(e) {
    const btn = e.currentTarget;
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    if (!action || !id) return;

    if (action === 'edit') {
      window.location.href = `/admin/promo-edit.html?id=${encodeURIComponent(id)}`;
      return;
    }

    if (action === 'delete') {
      openModal(id, btn.getAttribute('data-title') || '');
      return;
    }

    const msgId = 'pageMessage';
    window.auth.setButtonLoading(btn, true, '...');
    try {
      const endpoint = action === 'toggle-active'
        ? `/api/admin/promotions/${id}/toggle-active`
        : `/api/admin/promotions/${id}/toggle-featured`;
      const res = await window.auth.apiFetch(endpoint, { method: 'POST', body: {} });
      if (!res.ok) throw new Error(res.message || 'Error');
      window.auth.setMessage(msgId, res.message || 'Actualizado correctamente', 'success');
      await cargarPromos();
    } catch (err) {
      window.auth.setMessage(msgId, err.message || 'Error al actualizar', 'error');
    } finally {
      window.auth.setButtonLoading(btn, false);
    }
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();

async function logout() {
  try { await window.auth.apiFetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
  window.location.replace('/login.html');
}
