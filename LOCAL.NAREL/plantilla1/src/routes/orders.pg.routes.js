'use strict';

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../db/postgres');
const { authenticate, requireAdmin } = require('../middleware/postgresAuth');
const env = require('../config/env');
const { createOrderWithStock } = require('../services/order.service');

const statuses = ['pendiente', 'confirmado', 'preparando', 'enviado', 'entregado', 'cancelado'];
const manualPayments = ['transferencia', 'efectivo', 'whatsapp'];
const shipping = ['retiro', 'envio'];

function bad(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ ok: false, message: errors.array()[0].msg });
  return true;
}

function whatsappUrl(order) {
  const phone = String(env.ORDER_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  if (!phone || !order) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Hola Narel Local, quiero confirmar mi pedido.\nOrden: ${order.order_number}\nTotal: $ ${Number(order.total).toLocaleString('es-AR')}`)}`;
}

function safeOrder(order) {
  if (!order) return null;
  const publicOrder = { ...order };
  delete publicOrder.mp_idempotency_key;
  return { ...publicOrder, whatsapp_url: whatsappUrl(order) };
}

const publicRouter = express.Router();
publicRouter.post('/', [
  body('items').isArray({ min: 1, max: 50 }).withMessage('El carrito está vacío.'),
  body('items.*.product_id').isUUID().withMessage('Producto inválido.'),
  body('items.*.quantity').isInt({ min: 1, max: 99 }).withMessage('Cantidad inválida.'),
  body('items.*.banner_id').optional({ nullable: true }).isUUID().withMessage('Promoción inválida.'),
  body('customer.name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Nombre inválido.'),
  body('customer.email').isEmail().normalizeEmail().withMessage('Email inválido.'),
  body('customer.phone').isString().trim().isLength({ min: 6, max: 40 }).withMessage('Teléfono inválido.'),
  body('shipping.method').isIn(shipping).withMessage('Método de entrega inválido.'),
  body('payment_method').isIn(manualPayments).withMessage('Método de pago inválido.'),
], async (req, res) => {
  if (bad(req, res)) return;
  try {
    const bodyData = req.body;
    if (bodyData.shipping.method === 'envio' && (!bodyData.shipping.address || !bodyData.shipping.city || !bodyData.shipping.postal_code)) {
      return res.status(400).json({ ok: false, message: 'Completá la dirección, ciudad y código postal.' });
    }

    const order = await createOrderWithStock(bodyData, { paymentMethod: bodyData.payment_method });
    return res.status(201).json({
      ok: true,
      message: 'Pedido creado correctamente.',
      data: safeOrder(order),
    });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, message: error.message || 'Error interno al procesar el pedido.' });
  }
});

const adminRouter = express.Router();
adminRouter.use(authenticate, requireAdmin);
adminRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const params = [];
  const conditions = [];
  if (req.query.status && statuses.includes(req.query.status)) {
    params.push(req.query.status);
    conditions.push(`status=$${params.length}`);
  }
  if (req.query.search) {
    params.push(`%${String(req.query.search).trim()}%`);
    conditions.push(`(order_number ILIKE $${params.length} OR customer_name ILIKE $${params.length} OR customer_email ILIKE $${params.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]);
  for (const order of result.rows) {
    order.items = (await query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY created_at', [order.id])).rows;
  }
  const count = await query(`SELECT count(*)::int AS count FROM orders ${where}`, params);
  return res.json({ ok: true, data: result.rows, count: count.rows[0].count, limit, offset });
});

adminRouter.get('/:id', [param('id').isUUID()], async (req, res) => {
  if (bad(req, res)) return;
  const result = await query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
  result.rows[0].items = (await query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id])).rows;
  return res.json({ ok: true, data: result.rows[0] });
});

adminRouter.patch('/:id/status', [
  param('id').isUUID(),
  body('status').optional().isIn(statuses),
  body('payment_status').optional().isIn(['pendiente', 'comprobante_enviado', 'pagado', 'rechazado']),
], async (req, res) => {
  if (bad(req, res)) return;
  const result = await query(
    'UPDATE orders SET status=COALESCE($1,status), payment_status=COALESCE($2,payment_status) WHERE id=$3 RETURNING *',
    [req.body.status || null, req.body.payment_status || null, req.params.id],
  );
  if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Pedido no encontrado.' });
  return res.json({ ok: true, message: 'Estado actualizado.', data: result.rows[0] });
});

module.exports = { publicRouter, adminRouter };
