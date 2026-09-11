(function () {
  'use strict';

  let productsAll = [];
  let deleteTargetId = null;
  let deleteTargetRow = null;

  window.addEventListener('DOMContentLoaded', init);

  async function init() {
    const user = await window.auth.requireAuth({ requireAdmin: true });
    if (!user) return;

    if (typeof window.initSupabaseBrowser === 'function') {
      window.initSupabaseBrowser().catch(() => {});
    }

    bindSearch();
    bindModal();
    await cargarProductos();
  }

  function bindSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    let t;
    input.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(() => renderProducts(input.value || ''), 180);
    });
  }

  function bindModal() {
    const modal = document.getElementById('deleteModal');
    const cancel = document.getElementById('deleteCancelBtn');
    const confirm = document.getElementById('deleteConfirmBtn');

    cancel.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });
    confirm.addEventListener('click', confirmarEliminar);
  }

  function openModal(id, name) {
    deleteTargetId = id;
    const modal = document.getElementById('deleteModal');
    const text = document.getElementById('deleteModalText');
    text.textContent = `¿Estás seguro que deseas eliminar el producto "${name || 'seleccionado'}"? Esta acción no se puede deshacer.`;
    modal.classList.add('open');
  }

  function closeModal() {
    deleteTargetId = null;
    deleteTargetRow = null;
    document.getElementById('deleteModal').classList.remove('open');
  }

  async function confirmarEliminar() {
    if (!deleteTargetId) return;
    const msgId = 'pageMessage';
    const btn = document.getElementById('deleteConfirmBtn');
    window.auth.setButtonLoading(btn.id || 'deleteConfirmBtn', true, 'ELIMINANDO...');

    const res = await window.auth.apiFetch(`/api/admin/products/${deleteTargetId}`, { method: 'DELETE' });
    window.auth.setButtonLoading(btn.id || 'deleteConfirmBtn', false);

    if (!res.ok) {
      window.auth.setMessage(msgId, res.message || 'Error al eliminar el producto', 'error');
      return;
    }

    closeModal();
    window.auth.setMessage(msgId, 'Producto eliminado correctamente', 'success');
    await cargarProductos();
  }

  async function cargarProductos() {
    const msgId = 'pageMessage';
    const tbody = document.getElementById('productsTbody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--grey);font-family:\'DM Mono\',monospace;letter-spacing:.1em;">Cargando productos...</td></tr>';

    const res = await window.auth.apiFetch('/api/admin/products?limit=200&order=updated_at&desc=1', { method: 'GET' });

    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#f5f5f5;font-family:'DM Mono',monospace;letter-spacing:.08em;">${escapeHtml(res.message || 'Error al cargar productos')}</td></tr>`;
      window.auth.setMessage(msgId, res.message || 'Error al cargar productos', 'error');
      return;
    }

    productsAll = Array.isArray(res.data) ? res.data : [];
    renderProducts(document.getElementById('searchInput')?.value || '');

    if (!productsAll.length) {
      window.auth.setMessage(msgId, 'No hay productos cargados aún. Crea el primero con el botón "Nuevo Producto".', 'info');
    } else {
      window.auth.setMessage(msgId, `${productsAll.length} producto${productsAll.length === 1 ? '' : 's'} encontrado${productsAll.length === 1 ? '' : 's'}`, 'success');
      setTimeout(() => window.auth.setMessage(msgId, '', 'info'), 2200);
    }
  }

  function renderProducts(query) {
    const tbody = document.getElementById('productsTbody');
    const q = (query || '').trim().toLowerCase();
    const list = q
      ? productsAll.filter((p) =>
          ((p.name || '') + ' ' + (p.description || '') + ' ' + (p.sizes || '')).toLowerCase().includes(q)
        )
      : productsAll;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--grey);font-family:'DM Mono',monospace;letter-spacing:.1em;">${q ? 'Sin resultados para tu búsqueda' : 'Sin productos'}</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    const frag = document.createDocumentFragment();

    list.forEach((p) => {
      const tr = document.createElement('tr');
      tr.dataset.id = p.id || '';

      const stockN = Number(p.stock) || 0;
      let stockClass = 'stock-ok';
      let stockText = `${stockN} UNID.`;
      if (stockN <= 0) { stockClass = 'stock-empty'; stockText = 'SIN STOCK'; }
      else if (stockN <= 5) { stockClass = 'stock-low'; }

      const priceN = Number(p.price) || 0;
      const priceStr = priceN.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });

      const imgCell = document.createElement('td');
      if (p.image_url) {
        const img = document.createElement('img');
        img.src = p.image_url;
        img.alt = escapeHtml(p.name || 'imagen');
        img.className = 'admin-img-preview';
        img.onerror = () => { img.removeAttribute('src'); img.style.background = 'var(--dark2)'; img.style.visibility = 'hidden'; };
        imgCell.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'admin-img-preview';
        ph.style.display = 'flex';
        ph.style.alignItems = 'center';
        ph.style.justifyContent = 'center';
        ph.style.fontFamily = "'DM Mono',monospace";
        ph.style.fontSize = '10px';
        ph.style.color = 'var(--grey)';
        ph.style.letterSpacing = '.12em';
        ph.style.textTransform = 'uppercase';
        ph.textContent = 'SIN IMG';
        imgCell.appendChild(ph);
      }

      const nameCell = document.createElement('td');
      nameCell.innerHTML = `<div class="td-name">${escapeHtml(p.name || '(Sin nombre)')}</div><div class="td-meta">${escapeHtml((p.description || '').slice(0, 90))}${p.description && p.description.length > 90 ? '…' : ''}</div>`;

      const priceCell = document.createElement('td');
      priceCell.innerHTML = `<span class="td-price">${escapeHtml(priceStr)}</span>`;

      const sizesCell = document.createElement('td');
      sizesCell.innerHTML = `<span class="td-meta" style="margin-top:0;">${escapeHtml(p.sizes || '—')}</span>`;

      const stockCell = document.createElement('td');
      stockCell.innerHTML = `<span class="td-stock ${stockClass}">${stockText}</span>`;

      const actionsCell = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'row-actions';

      const editA = document.createElement('a');
      editA.href = `/admin/product-edit.html?id=${encodeURIComponent(p.id || '')}`;
      editA.textContent = 'EDITAR';

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-danger';
      delBtn.textContent = 'ELIMINAR';
      delBtn.addEventListener('click', () => openModal(p.id, p.name));

      actions.appendChild(editA);
      actions.appendChild(delBtn);
      actionsCell.appendChild(actions);

      tr.appendChild(imgCell);
      tr.appendChild(nameCell);
      tr.appendChild(priceCell);
      tr.appendChild(sizesCell);
      tr.appendChild(stockCell);
      tr.appendChild(actionsCell);

      frag.appendChild(tr);
    });

    tbody.appendChild(frag);
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
