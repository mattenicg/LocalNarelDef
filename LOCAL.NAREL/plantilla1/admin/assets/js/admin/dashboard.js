(function () {
  'use strict';

  window.addEventListener('DOMContentLoaded', init);

  async function init() {
    const user = await window.auth.requireAuth({ requireAdmin: true });
    if (!user) return;

    if (typeof window.initSupabaseBrowser === 'function') {
      window.initSupabaseBrowser().catch(() => {});
    }

    cargarStats();
  }

  async function cargarStats() {
    const msgId = 'pageMessage';
    window.auth.setMessage(msgId, 'Cargando estadísticas...', 'info');

    const res = await window.auth.apiFetch('/api/admin/products/stats', { method: 'GET' });

    if (!res.ok) {
      window.auth.setMessage(msgId, res.message || 'Error al cargar estadísticas', 'error');
      return;
    }

    const d = res.data || {};
    const totalProducts = typeof d.total_products === 'number' ? d.total_products : 0;
    const totalStock = typeof d.total_stock === 'number' ? d.total_stock : 0;
    const outOfStock = typeof d.out_of_stock === 'number' ? d.out_of_stock : 0;

    document.getElementById('statProducts').textContent = totalProducts.toLocaleString('es-AR');
    document.getElementById('statStock').textContent = totalStock.toLocaleString('es-AR');
    document.getElementById('statOut').textContent = outOfStock.toLocaleString('es-AR');

    window.auth.setMessage(msgId, '', 'info');
  }
})();

async function logout() {
  try {
    await window.auth.apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  window.location.replace('/login.html');
}
