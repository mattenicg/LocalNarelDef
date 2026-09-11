'use strict';

const { query, withTransaction } = require('../db/postgres');

function toOrderItems(order, items) {
  return {
    ...order,
    items: items.map((item) => ({
      product_id: item.product_id || item.id,
      name: item.product_name || item.name,
      image_url: item.product_image_url || item.image_url || null,
      price: item.unit_price ?? item.price,
      quantity: item.quantity,
      size: item.size || null,
      line_total: item.line_total,
    })),
  };
}

async function attachOrderItems(executor, order) {
  if (!order) return null;
  const result = await executor.query(
    'SELECT * FROM order_items WHERE order_id=$1 ORDER BY created_at',
    [order.id],
  );
  return toOrderItems(order, result.rows);
}

function orderError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// El precio promocional nunca se toma del cliente: se resuelve contra el banner
// activo y vigente para evitar que se manipulen los precios desde el navegador.
async function resolvePromoPrice(client, bannerId, productId) {
  if (!bannerId || !UUID_PATTERN.test(String(bannerId))) return null;
  const result = await client.query(
    `SELECT bi.promo_price
     FROM promo_banner_items bi
     JOIN promo_banners b ON b.id = bi.banner_id
     WHERE bi.banner_id=$1 AND bi.product_id=$2
       AND b.active=true AND (b.end_date IS NULL OR b.end_date > now())`,
    [bannerId, productId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const price = Number(row.promo_price);
  return Number.isFinite(price) ? Math.max(0, price) : null;
}

async function createOrderWithStock(payload, options = {}) {
  const customer = payload.customer || {};
  const shipping = payload.shipping || {};
  const paymentMethod = options.paymentMethod || payload.payment_method;
  const externalReference = options.externalReference || null;
  const idempotencyKey = options.idempotencyKey || null;

  return withTransaction(async (client) => {
    let subtotal = 0;
    const rows = [];

    for (const item of payload.items || []) {
      const quantity = Number(item.quantity);
      const productResult = await client.query(
        'SELECT * FROM products WHERE id=$1 AND active=true FOR UPDATE',
        [item.product_id],
      );
      const product = productResult.rows[0];
      if (!product) throw orderError('Producto no disponible', 409);
      if (product.stock < quantity) {
        throw orderError(`Stock insuficiente para: ${product.name}`, 409);
      }

      const promoPrice = await resolvePromoPrice(client, item.banner_id, item.product_id);
      const unitPrice = promoPrice == null ? Number(product.price) : promoPrice;
      subtotal += unitPrice * quantity;
      rows.push({ product, item, quantity, unitPrice });
    }

    const sequence = await client.query("SELECT nextval('order_number_seq') AS n");
    const orderNumber = `NL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(sequence.rows[0].n).padStart(5, '0')}`;
    const mpReference = externalReference || (paymentMethod === 'mercadopago_card' ? orderNumber : null);

    const orderResult = await client.query(
      `INSERT INTO orders(
        order_number, customer_name, customer_email, customer_phone,
        shipping_method, shipping_address, shipping_city, shipping_postal_code,
        notes, payment_method, mp_external_reference, mp_idempotency_key,
        subtotal, total
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
      RETURNING *`,
      [
        orderNumber,
        String(customer.name || '').trim(),
        String(customer.email || '').trim().toLowerCase(),
        String(customer.phone || '').trim(),
        shipping.method,
        shipping.address || null,
        shipping.city || null,
        shipping.postal_code || null,
        shipping.notes || null,
        paymentMethod,
        mpReference,
        idempotencyKey,
        subtotal,
      ],
    );

    const order = orderResult.rows[0];
    for (const { product, item, quantity, unitPrice } of rows) {
      const lineTotal = unitPrice * quantity;
      await client.query(
        `INSERT INTO order_items(
          order_id, product_id, product_name, product_image_url,
          unit_price, quantity, size, line_total
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [order.id, product.id, product.name, product.image_url, unitPrice, quantity, item.size || null, lineTotal],
      );
      await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2', [quantity, product.id]);
      await client.query(
        `INSERT INTO stock_movements(
          product_id, order_id, movement_type, quantity_delta,
          stock_before, stock_after, reason
        ) VALUES($1,$2,'order',$3,$4,$5,$6)`,
        [product.id, order.id, -quantity, product.stock, product.stock - quantity, `Pedido ${orderNumber}`],
      );
    }

    return attachOrderItems(client, order);
  });
}

async function findOrderByIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) return null;
  const result = await query('SELECT * FROM orders WHERE mp_idempotency_key=$1', [idempotencyKey]);
  return attachOrderItems({ query }, result.rows[0]);
}

async function findOrderByExternalReference(externalReference) {
  if (!externalReference) return null;
  const result = await query('SELECT * FROM orders WHERE mp_external_reference=$1', [externalReference]);
  return attachOrderItems({ query }, result.rows[0]);
}

async function getOrderById(id) {
  const result = await query('SELECT * FROM orders WHERE id=$1', [id]);
  return attachOrderItems({ query }, result.rows[0]);
}

function normalizedPaymentStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'approved') return 'approved';
  if (['rejected', 'cancelled', 'cancelado'].includes(value)) return 'rejected';
  return 'pending';
}

async function updatePaymentResult(orderId, payment = {}) {
  const mpStatus = normalizedPaymentStatus(payment.status);
  const paymentStatus = mpStatus === 'approved' ? 'pagado' : mpStatus === 'rejected' ? 'rechazado' : 'pendiente';
  const paymentId = payment.id == null ? null : String(payment.id);
  const externalReference = payment.external_reference ? String(payment.external_reference) : null;
  const paymentMethodId = payment.payment_method_id ? String(payment.payment_method_id) : null;
  const installments = Number.isInteger(Number(payment.installments)) ? Number(payment.installments) : null;
  const statusDetail = String(payment.status_detail || '').slice(0, 160) || null;

  const result = await query(
    `UPDATE orders
     SET mp_payment_id=COALESCE($2,mp_payment_id),
         mp_external_reference=COALESCE($3,mp_external_reference),
         mp_status=$4,
         mp_status_detail=$5,
         mp_payment_method_id=COALESCE($6,mp_payment_method_id),
         mp_installments=COALESCE($7,mp_installments),
         mp_updated_at=now(),
         payment_status=CASE WHEN status IN ('cancelado','entregado') THEN payment_status ELSE $8 END,
         status=CASE
           WHEN status IN ('cancelado','entregado') THEN status
           WHEN $9='approved' THEN 'confirmado'
           WHEN $9='rejected' THEN 'cancelado'
           ELSE status
         END
     WHERE id=$1
     RETURNING *`,
    [orderId, paymentId, externalReference, String(payment.status || 'pending'), statusDetail, paymentMethodId, installments, paymentStatus, mpStatus],
  );
  return attachOrderItems({ query }, result.rows[0]);
}

async function releaseOrderStock(orderId, paymentStatus = 'rechazado') {
  return withTransaction(async (client) => {
    const orderResult = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
    const order = orderResult.rows[0];
    if (!order) return null;
    if (order.payment_status === 'pagado') return attachOrderItems(client, order);

    const cancellationResult = await client.query(
      "SELECT 1 FROM stock_movements WHERE order_id=$1 AND movement_type='cancel' LIMIT 1",
      [orderId],
    );
    if (!cancellationResult.rows.length) {
      const itemsResult = await client.query('SELECT * FROM order_items WHERE order_id=$1', [orderId]);
      for (const item of itemsResult.rows) {
        const productResult = await client.query('SELECT * FROM products WHERE id=$1 FOR UPDATE', [item.product_id]);
        const product = productResult.rows[0];
        if (!product) continue;
        const stockBefore = Number(product.stock);
        const stockAfter = stockBefore + Number(item.quantity);
        await client.query('UPDATE products SET stock=$1 WHERE id=$2', [stockAfter, product.id]);
        await client.query(
          `INSERT INTO stock_movements(
            product_id, order_id, movement_type, quantity_delta,
            stock_before, stock_after, reason
          ) VALUES($1,$2,'cancel',$3,$4,$5,$6)`,
          [product.id, orderId, Number(item.quantity), stockBefore, stockAfter, `Liberación de pago rechazado ${order.order_number}`],
        );
      }
    }

    const updated = await client.query(
      `UPDATE orders
       SET status='cancelado', payment_status=CASE WHEN payment_status='pagado' THEN payment_status ELSE $2 END
       WHERE id=$1
       RETURNING *`,
      [orderId, paymentStatus],
    );
    return attachOrderItems(client, updated.rows[0]);
  });
}

module.exports = {
  createOrderWithStock,
  findOrderByIdempotencyKey,
  findOrderByExternalReference,
  getOrderById,
  updatePaymentResult,
  releaseOrderStock,
};
