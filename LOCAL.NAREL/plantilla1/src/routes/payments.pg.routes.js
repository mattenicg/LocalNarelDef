'use strict';

const crypto = require('crypto');
const express = require('express');
const { body, validationResult } = require('express-validator');
const env = require('../config/env');
const logger = require('../services/logger');
const {
  createCardPayment,
  getPayment,
  isConfigured,
  verifyWebhookSignature,
} = require('../services/mercadopago.service');
const {
  createOrderWithStock,
  findOrderByExternalReference,
  findOrderByIdempotencyKey,
  releaseOrderStock,
  updatePaymentResult,
} = require('../services/order.service');

const router = express.Router();

function validationError(req, res) {
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

function paymentMessage(status, detail) {
  if (status === 'approved') return 'Pago aprobado y pedido confirmado.';
  if (status === 'pending' || status === 'in_process') return 'El pago quedó pendiente de confirmación. Te avisaremos cuando Mercado Pago lo actualice.';
  if (detail === 'cc_rejected_other_reason') return 'Mercado Pago rechazó la tarjeta. Probá con otra tarjeta o medio de pago.';
  return 'El pago fue rechazado. Revisá los datos o probá con otra tarjeta.';
}

const cardRules = [
  body('items').isArray({ min: 1, max: 50 }).withMessage('El carrito está vacío.'),
  body('items.*.product_id').isUUID().withMessage('Producto inválido.'),
  body('items.*.quantity').isInt({ min: 1, max: 99 }).withMessage('Cantidad inválida.'),
  body('items.*.banner_id').optional({ nullable: true }).isUUID().withMessage('Promoción inválida.'),
  body('customer.name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Nombre inválido.'),
  body('customer.email').isEmail().normalizeEmail().withMessage('Email inválido.'),
  body('customer.phone').isString().trim().isLength({ min: 6, max: 40 }).withMessage('Teléfono inválido.'),
  body('shipping.method').isIn(['retiro', 'envio']).withMessage('Método de entrega inválido.'),
  body('shipping.address').optional({ nullable: true }).isString().isLength({ max: 240 }).withMessage('Dirección inválida.'),
  body('shipping.city').optional({ nullable: true }).isString().isLength({ max: 120 }).withMessage('Ciudad inválida.'),
  body('shipping.postal_code').optional({ nullable: true }).isString().isLength({ max: 30 }).withMessage('Código postal inválido.'),
  body('shipping.notes').optional({ nullable: true }).isString().isLength({ max: 500 }).withMessage('Notas inválidas.'),
  body('payment.token').isString().trim().isLength({ min: 10, max: 500 }).withMessage('Token de tarjeta inválido.'),
  body('payment.payment_method_id').isString().trim().isLength({ min: 1, max: 60 }).withMessage('Método de tarjeta inválido.'),
  body('payment.installments').isInt({ min: 1, max: 24 }).withMessage('Cantidad de cuotas inválida.'),
  body('payment.issuer_id').optional({ nullable: true }).isInt().withMessage('Emisor de tarjeta inválido.'),
  body('payment.payer').optional({ nullable: true }).isObject().withMessage('Datos del pagador inválidos.'),
  body('payment.payer.identification').optional({ nullable: true }).isObject().withMessage('Identificación inválida.'),
  body('payment.payer.identification.type').optional({ nullable: true }).isString().isLength({ min: 1, max: 20 }).withMessage('Tipo de identificación inválido.'),
  body('payment.payer.identification.number').optional({ nullable: true }).isString().isLength({ min: 3, max: 40 }).withMessage('Número de identificación inválido.'),
];

router.post('/mercadopago/card', cardRules, async (req, res) => {
  if (validationError(req, res)) return;
  if (!isConfigured()) {
    return res.status(503).json({ ok: false, message: 'El pago con Mercado Pago no está disponible en este momento.' });
  }

  const idempotencyKey = String(req.get('Idempotency-Key') || crypto.randomUUID()).trim().slice(0, 200);
  const payload = { ...req.body, payment_method: 'mercadopago_card' };
  const paymentData = req.body.payment;

  try {
    let order = await findOrderByIdempotencyKey(idempotencyKey);
    if (order && order.mp_payment_id) {
      return res.status(200).json({
        ok: order.payment_status === 'pagado',
        message: order.payment_status === 'pagado' ? 'Pago aprobado y pedido confirmado.' : 'Este intento de pago ya fue procesado.',
        data: safeOrder(order),
      });
    }
    if (order && order.status === 'cancelado') {
      return res.status(409).json({ ok: false, message: 'Este intento de pago ya finalizó. Volvé a intentarlo.' });
    }

    order = order || await createOrderWithStock(payload, {
      paymentMethod: 'mercadopago_card',
      idempotencyKey,
    });

    let payment;
    try {
      payment = await createCardPayment({
        amount: order.total,
        externalReference: order.mp_external_reference || order.order_number,
        payerEmail: order.customer_email,
        token: paymentData.token,
        paymentMethodId: paymentData.payment_method_id,
        issuerId: paymentData.issuer_id,
        installments: paymentData.installments,
        payerIdentification: paymentData.payer?.identification,
        idempotencyKey,
      });
    } catch (error) {
      const providerStatus = Number(error && error.status);
      if ([400, 402, 422].includes(providerStatus)) {
        await updatePaymentResult(order.id, {
          status: 'rejected',
          status_detail: 'provider_validation_error',
          payment_method_id: paymentData.payment_method_id,
          installments: paymentData.installments,
          external_reference: order.mp_external_reference,
        });
        const rejected = await releaseOrderStock(order.id, 'rechazado');
        return res.status(402).json({
          ok: false,
          message: 'Mercado Pago no pudo aprobar la tarjeta. Revisá los datos e intentá nuevamente.',
          data: safeOrder(rejected),
        });
      }

      await updatePaymentResult(order.id, {
        status: 'pending',
        status_detail: 'provider_unavailable',
        payment_method_id: paymentData.payment_method_id,
        installments: paymentData.installments,
        external_reference: order.mp_external_reference,
      });
      logger.error(`[mercadopago] proveedor no disponible; orden=${order.order_number} status=${providerStatus || 'connection'}`);
      const pending = await findOrderByIdempotencyKey(idempotencyKey);
      return res.status(202).json({
        ok: true,
        message: 'Mercado Pago no respondió todavía. El intento quedó pendiente y se puede reanudar con la misma clave.',
        data: safeOrder(pending),
      });
    }

    const updated = await updatePaymentResult(order.id, payment);
    const status = String(payment.status || '').toLowerCase();
    if (['rejected', 'cancelled'].includes(status)) {
      const rejected = await releaseOrderStock(order.id, 'rechazado');
      return res.status(402).json({
        ok: false,
        message: paymentMessage(status, payment.status_detail),
        data: safeOrder(rejected),
      });
    }

    const responseStatus = status === 'approved' ? 201 : 202;
    return res.status(responseStatus).json({
      ok: true,
      message: paymentMessage(status),
      data: safeOrder(updated),
    });
  } catch (error) {
    if (error && error.code === '23505') {
      const existing = await findOrderByIdempotencyKey(idempotencyKey);
      if (existing) {
        return res.status(409).json({ ok: false, message: 'Este intento de pago ya está siendo procesado. Esperá unos segundos e intentá nuevamente.' });
      }
    }
    logger.error('[mercadopago] error procesando tarjeta:', error);
    return res.status(error.status || 500).json({ ok: false, message: error.message || 'No se pudo procesar el pago.' });
  }
});

router.post('/mercadopago/webhook', async (req, res) => {
  const dataId = String(req.query['data.id'] || req.query.id || req.body?.data?.id || req.body?.id || '').trim();
  const requestId = String(req.get('x-request-id') || '').trim();
  const signature = req.get('x-signature');

  if (!verifyWebhookSignature({ signatureHeader: signature, requestId, dataId })) {
    return res.status(401).json({ ok: false, message: 'Firma de webhook inválida.' });
  }
  if (!dataId) return res.status(200).json({ ok: true, ignored: true });

  try {
    const payment = await getPayment(dataId);
    const order = await findOrderByExternalReference(payment.external_reference);
    if (!order) return res.status(200).json({ ok: true, ignored: true });

    const updated = await updatePaymentResult(order.id, payment);
    let finalOrder = updated;
    if (['rejected', 'cancelled'].includes(String(payment.status || '').toLowerCase())) {
      finalOrder = await releaseOrderStock(order.id, 'rechazado');
    }
    return res.status(200).json({ ok: true, data: safeOrder(finalOrder) });
  } catch (error) {
    logger.error('[mercadopago] webhook error:', error);
    return res.status(500).json({ ok: false, message: 'No se pudo actualizar el pago.' });
  }
});

module.exports = router;
