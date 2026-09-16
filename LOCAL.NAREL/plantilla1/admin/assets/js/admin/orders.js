(function () {
  'use strict';

  const ORDER_STATUS = ['pendiente', 'confirmado', 'preparando', 'enviado', 'entregado', 'cancelado'];
  const PAYMENT_STATUS = ['pendiente', 'comprobante_enviado', 'pagado', 'rechazado'];
  const state = { orders: [], search: '', status: '' };
  const $ = (id) => document.getElementById(id);

  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const money = (value) => '$ ' + Math.round(Number(value) || 0).toLocaleString('es-AR');
  const date = (value) => value ? new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
  const statusLabel = (value) => ({
    pendiente: 'Pendiente', confirmado: 'Confirmado', preparando: 'Preparando',
    enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado',
    comprobante_enviado: 'Comprobante enviado', pagado: 'Pagado', rechazado: 'Rechazado'
  }[value] || value || '-');
  const paymentMethodLabel = (value) => ({
    transferencia: 'Transferencia', efectivo: 'Efectivo', whatsapp: 'WhatsApp', mercadopago_card: 'Mercado Pago · Tarjeta'
  }[value] || value || '-');

  async function init() {
    const user = await window.auth.requireAuth({ requireAdmin: true });
    if (!user) return;
    $('searchInput')?.addEventListener('input', debounce(() => {
      state.search = $('searchInput').value.trim();
      loadOrders();
    }, 220));
    $('orderStatusFilter')?.addEventListener('change', () => {
      state.status = $('orderStatusFilter').value;
      loadOrders();
    });
    $('refreshOrders')?.addEventListener('click', loadOrders);
    $('closeOrderDetail')?.addEventListener('click', closeDetail);
    $('orderDetailModal')?.addEventListener('click', (event) => {
      if (event.target === $('orderDetailModal')) closeDetail();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && $('orderDetailModal')?.classList.contains('open')) closeDetail();
    });
    $('ordersTbody')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-order-action]');
      if (!button) return;
      const order = state.orders.find((item) => item.id === button.dataset.id);
      if (order) openDetail(order);
    });
    await loadOrders();
  }

  function debounce(fn, wait) {
    let timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  async function loadOrders() {
    const tbody = $('ordersTbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--grey);font-family:\'DM Mono\',monospace;">Cargando pedidos...</td></tr>';
    const params = new URLSearchParams({ limit: '100' });
    if (state.status) params.set('status', state.status);
    if (state.search) params.set('search', state.search);

    const response = await window.auth.apiFetch(`/api/admin/orders?${params.toString()}`, { method: 'GET' });
    if (!response.ok) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#fff;font-family:'DM Mono',monospace;">${escapeHtml(response.message || 'No se pudieron cargar los pedidos')}</td></tr>`;
      window.auth.setMessage('pageMessage', response.message || 'No se pudieron cargar los pedidos', 'error');
      return;
    }
    state.orders = Array.isArray(response.data) ? response.data : [];
    renderTable();
    window.auth.setMessage('pageMessage', state.orders.length ? `${state.orders.length} pedido${state.orders.length === 1 ? '' : 's'} encontrado${state.orders.length === 1 ? '' : 's'}` : 'No hay pedidos para mostrar', state.orders.length ? 'success' : 'info');
  }

  function renderTable() {
    const tbody = $('ordersTbody');
    if (!state.orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:50px;color:var(--grey);font-family:\'DM Mono\',monospace;">Todavía no hay pedidos.</td></tr>';
      return;
    }
    tbody.innerHTML = state.orders.map((order) => `
      <tr>
        <td><span class="order-number">${escapeHtml(order.order_number)}</span><span class="order-meta">${order.items?.length || 0} producto(s)</span></td>
        <td><strong>${escapeHtml(order.customer_name)}</strong><span class="order-meta">${escapeHtml(order.customer_email)} · ${escapeHtml(order.customer_phone)}</span></td>
        <td><span class="order-total">${money(order.total)}</span></td>
        <td><span class="order-status ${escapeHtml(order.payment_status)}">${escapeHtml(statusLabel(order.payment_status))}</span></td>
        <td><span class="order-status ${escapeHtml(order.status)}">${escapeHtml(statusLabel(order.status))}</span></td>
        <td class="td-meta">${escapeHtml(date(order.created_at))}</td>
        <td><button type="button" class="button secondary" data-order-action="detail" data-id="${escapeHtml(order.id)}" style="width:auto;padding:9px 13px;">VER</button></td>
      </tr>`).join('');
  }

  function openDetail(order) {
    const modal = $('orderDetailModal');
    const body = $('orderDetailBody');
    if (!modal || !body) return;
    const items = Array.isArray(order.items) ? order.items : [];
    body.innerHTML = `
      <div class="order-detail">
        <div class="order-detail-grid">
          <div class="order-detail-block"><h3>Comprador</h3><p>${escapeHtml(order.customer_name)}\n${escapeHtml(order.customer_email)}\n${escapeHtml(order.customer_phone)}</p></div>
          <div class="order-detail-block"><h3>Entrega</h3><p>${escapeHtml(order.shipping_method === 'envio' ? 'Envío a domicilio' : 'Retiro en local')}\n${escapeHtml(order.shipping_address || 'San Martín 2029')}\n${escapeHtml(order.shipping_city || '')} ${escapeHtml(order.shipping_postal_code || '')}\n${escapeHtml(order.notes || '')}</p></div>
        </div>
        <div class="order-detail-block"><h3>Productos</h3><div class="order-items-list">${items.map((item) => `<div class="order-item-row"><span><strong>${escapeHtml(item.product_name)}</strong><br>${item.quantity} × ${money(item.unit_price)}${item.size ? ` · Talle ${escapeHtml(item.size)}` : ''}</span><strong>${money(item.line_total)}</strong></div>`).join('')}</div></div>
        <div class="order-detail-block"><h3>Resumen</h3><p>Orden: ${escapeHtml(order.order_number)}\nMétodo: ${escapeHtml(paymentMethodLabel(order.payment_method))}\nSubtotal: ${money(order.subtotal)}\nEnvío: ${money(order.shipping_cost)}\nTotal: ${money(order.total)}\n${order.mp_payment_id ? `ID Mercado Pago: ${escapeHtml(order.mp_payment_id)}\nEstado MP: ${escapeHtml(order.mp_status || '-')}` : ''}Creado: ${escapeHtml(date(order.created_at))}</p></div>
        <div class="order-controls">
          <div class="form-group"><label for="detailOrderStatus">Estado del pedido</label><select class="form-control" id="detailOrderStatus">${ORDER_STATUS.map((status) => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('')}</select></div>
          <div class="form-group"><label for="detailPaymentStatus">Estado del pago</label><select class="form-control" id="detailPaymentStatus">${PAYMENT_STATUS.map((status) => `<option value="${status}" ${order.payment_status === status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('')}</select></div>
          <button type="button" class="button primary" id="saveOrderStatus" style="width:auto;padding:13px 18px;">GUARDAR ESTADO</button>
        </div>
      </div>`;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    $('saveOrderStatus')?.addEventListener('click', () => updateStatus(order.id));
  }

  function closeDetail() {
    const modal = $('orderDetailModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  async function updateStatus(id) {
    const status = $('detailOrderStatus')?.value;
    const paymentStatus = $('detailPaymentStatus')?.value;
    if (!status || !paymentStatus) return;
    if (status === 'cancelado' && !window.confirm('¿Cancelar el pedido y devolver el stock?')) return;
    const button = $('saveOrderStatus');
    if (button) window.auth.setButtonLoading(button.id, true, 'GUARDANDO...');
    const response = await window.auth.apiFetch(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: { status, payment_status: paymentStatus },
    });
    if (button) window.auth.setButtonLoading(button.id, false);
    if (!response.ok) {
      window.auth.setMessage('pageMessage', response.message || 'No se pudo actualizar el estado', 'error');
      return;
    }
    closeDetail();
    window.auth.setMessage('pageMessage', 'Estado actualizado correctamente', 'success');
    await loadOrders();
  }

  async function logout() {
    try { await window.auth.apiFetch('/api/auth/logout', { method: 'POST' }); } catch (_error) {}
    window.location.replace('/login.html');
  }
  window.logout = logout;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
