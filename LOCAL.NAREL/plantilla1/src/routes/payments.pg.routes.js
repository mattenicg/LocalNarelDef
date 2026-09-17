'use strict';

const crypto = require('crypto');
const express = require('express');
const { body, validationResult } = require('express-validator');
const env = require('../config/env');
const logger = require('../services/logger');
const { query } = require('../db/postgres');
const {
  processPayment,
  createPreference,
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
const { notifyNewOrder } = require('../services/notification.service');

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

function safeOrder(order, extra = {}) {
  if (!order) return null;
  const publicOrder = { ...order, ...extra };
  delete publicOrder.mp_idempotency_key;
  if (order.mp_ticket_url && !publicOrder.ticket_url) {
    publicOrder.ticket_url = order.mp_ticket_url;
  }
  return { ...publicOrder, whatsapp_url: whatsappUrl(order) };
}

function paymentMessage(status, detail, paymentMethodId) {
  if (status === 'approved') return 'Pago aprobado y pedido confirmado.';
  if (status === 'pending' || status === 'in_process') {
    if (['rapipago', 'pagofacil', 'ticket', 'bolbradesco'].includes(String(paymentMethodId || '').toLowerCase())) {
      return 'Pedido registrado. Podés pagar con tu cupón en cualquier sucursal antes de su vencimiento.';
    }
    return 'El pago quedó pendiente de confirmación. Te avisaremos cuando Mercado Pago lo actualice.';
  }
  if (detail === 'cc_rejected_other_reason') return 'Mercado Pago rechazó el pago. Probá con otro medio de pago.';
  return 'El pago fue rechazado. Revisá los datos o probá con otro medio de pago.';
}

// Endpoint de Preferencia para Mercado Pago (habilita Dinero en cuenta / Billetera MP)
router.post('/mercadopago/preference', async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ ok: false, message: 'Mercado Pago no está disponible en este momento.' });
  }

  try {
    const { items, customer, shipping, total, externalReference } = req.body || {};
    const subtotal = Number(total) || 0;
    if (subtotal <= 0 && (!items || !items.length)) {
      return res.status(400).json({ ok: false, message: 'Monto o productos inválidos.' });
    }

    const host = req.get('host') || 'localhost:3000';
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const origin = req.get('origin') || `${proto}://${host}`;

    const backUrls = {
      success: `${origin}/?mp_status=approved`,
      pending: `${origin}/?mp_status=pending`,
      failure: `${origin}/?mp_status=failure`,
    };

    const preference = await createPreference({
      items,
      customer,
      shipping,
      total: subtotal,
      externalReference: externalReference || `NL-PREF-${Date.now()}`,
      backUrls,
    });

    return res.status(200).json({
      ok: true,
      data: {
        preference_id: preference.id,
        init_point: preference.init_point,
      },
    });
  } catch (error) {
    logger.error('[mercadopago] error creando preferencia:', error);
    return res.status(500).json({ ok: false, message: error.message || 'Error al inicializar Mercado Pago.' });
  }
});

const paymentRules = [
  body('items').isArray({ min: 1, max: 50 }).withMessage('El carrito está vacío.'),
  body('items.*.product_id').isUUID().withMessage('Producto inválido.'),
  body('items.*.quantity').isInt({ min: 1, max: 99 }).withMessage('Cantidad inválida.'),
  body('items.*.size').optional({ nullable: true }).isString().trim(),
  body('items.*.banner_id').optional({ nullable: true }).isUUID().withMessage('Promoción inválida.'),
  body('customer.name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Nombre inválido.'),
  body('customer.email').isEmail().normalizeEmail().withMessage('Email inválido.'),
  body('customer.phone').isString().trim().isLength({ min: 6, max: 40 }).withMessage('Teléfono inválido.'),
  body('shipping.method').isIn(['retiro', 'envio']).withMessage('Método de entrega inválido.'),
  body('shipping.address').optional({ nullable: true }).isString().isLength({ max: 240 }).withMessage('Dirección inválida.'),
  body('shipping.city').optional({ nullable: true }).isString().isLength({ max: 120 }).withMessage('Ciudad inválida.'),
  body('shipping.postal_code').optional({ nullable: true }).isString().isLength({ max: 30 }).withMessage('Código postal inválido.'),
  body('shipping.notes').optional({ nullable: true }).isString().isLength({ max: 500 }).withMessage('Notas inválidas.'),
  body('payment.token').optional({ nullable: true }).isString().trim().isLength({ min: 10, max: 500 }).withMessage('Token de tarjeta inválido.'),
  body('payment.payment_method_id').isString().trim().isLength({ min: 1, max: 60 }).withMessage('Método de pago inválido.'),
  body('payment.installments').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1, max: 24 }).withMessage('Cantidad de cuotas inválida.'),
  body('payment.issuer_id').optional({ nullable: true, checkFalsy: true }).custom((val) => {
    if (val === undefined || val === null || val === '') return true;
    if (!isNaN(Number(val))) return true;
    throw new Error('Emisor de tarjeta inválido.');
  }),
  body('payment.payer').optional({ nullable: true }).isObject().withMessage('Datos del pagador inválidos.'),
  body('payment.payer.identification').optional({ nullable: true }).isObject().withMessage('Identificación inválida.'),
  body('payment.payer.identification.type').optional({ nullable: true }).isString().isLength({ min: 1, max: 20 }).withMessage('Tipo de identificación inválido.'),
  body('payment.payer.identification.number').optional({ nullable: true }).isString().isLength({ min: 3, max: 40 }).withMessage('Número de identificación inválido.'),
];

async function handleMercadoPagoProcess(req, res) {
  if (validationError(req, res)) return;
  if (!isConfigured()) {
    return res.status(503).json({ ok: false, message: 'El pago con Mercado Pago no está disponible en este momento.' });
  }

  const idempotencyKey = String(req.get('Idempotency-Key') || crypto.randomUUID()).trim().slice(0, 200);
  const payload = { ...req.body, payment_method: 'mercadopago_card' };
  const paymentData = req.body.payment;

  // Verificación defensiva contra Go Cuotas
  if (String(paymentData.payment_method_id || '').toLowerCase().includes('gocuotas')) {
    return res.status(400).json({ ok: false, message: 'Método de pago no admitido.' });
  }

  // Validar restricciones (cuotas y métodos) antes de procesar el pago
  for (const item of payload.items || []) {
    try {
      const prodRes = await query('SELECT name, direct_purchase, allowed_payment_methods, allowed_installments FROM products WHERE id=$1', [item.product_id]);
      const prod = prodRes.rows[0];
      if (prod) {
        const allowedMethods = Array.isArray(prod.allowed_payment_methods)
          ? prod.allowed_payment_methods
          : (typeof prod.allowed_payment_methods === 'string' ? JSON.parse(prod.allowed_payment_methods) : []);

        if (allowedMethods.length > 0) {
          const cardAllowed = allowedMethods.includes('tarjeta_credito') || allowedMethods.includes('tarjeta_debito');
          if (!cardAllowed) {
            return res.status(400).json({
              ok: false,
              message: `El producto "${prod.name}" no admite pago con tarjeta.`,
            });
          }
        }

        const allowedInst = Array.isArray(prod.allowed_installments)
          ? prod.allowed_installments.map(Number)
          : (typeof prod.allowed_installments === 'string' ? JSON.parse(prod.allowed_installments).map(Number) : []);

        const selectedInst = Number(paymentData.installments) || 1;
        if (allowedInst.length > 0 && !allowedInst.includes(selectedInst)) {
          return res.status(400).json({
            ok: false,
            message: `La cantidad de cuotas seleccionada (${selectedInst}) no está permitida para "${prod.name}". Cuotas permitidas: ${allowedInst.join(', ')}.`,
          });
        }
      }
    } catch (err) {
      logger.error('[mercadopago] error validando producto:', err);
    }
  }

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
      payment = await processPayment({
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
          message: 'Mercado Pago no pudo aprobar el pago. Revisá los datos o probá con otro medio de pago.',
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

    const ticketUrl = payment.point_of_interaction?.transaction_data?.ticket_url || null;
    const paymentResultData = {
      ...payment,
      ticket_url: ticketUrl,
    };

    const updated = await updatePaymentResult(order.id, paymentResultData);
    const status = String(payment.status || '').toLowerCase();
    if (['rejected', 'cancelled'].includes(status)) {
      const rejected = await releaseOrderStock(order.id, 'rechazado');
      return res.status(402).json({
        ok: false,
        message: paymentMessage(status, payment.status_detail, paymentData.payment_method_id),
        data: safeOrder(rejected),
      });
    }

    const responseStatus = status === 'approved' ? 201 : 202;
    notifyNewOrder(updated || order).catch((err) => {
      logger.error('[payments.pg.routes] Error enviando notificaciones:', err);
    });
    return res.status(responseStatus).json({
      ok: true,
      message: paymentMessage(status, payment.status_detail, paymentData.payment_method_id),
      data: safeOrder(updated, { ticket_url: ticketUrl }),
    });
  } catch (error) {
    if (error && error.code === '23505') {
      const existing = await findOrderByIdempotencyKey(idempotencyKey);
      if (existing) {
        return res.status(409).json({ ok: false, message: 'Este intento de pago ya está siendo procesado. Esperá unos segundos e intentá nuevamente.' });
      }
    }
    logger.error('[mercadopago] error procesando pago:', error);
    return res.status(error.status || 500).json({ ok: false, message: error.message || 'No se pudo procesar el pago.' });
  }
}

router.post('/mercadopago/card', paymentRules, handleMercadoPagoProcess);
router.post('/mercadopago/process', paymentRules, handleMercadoPagoProcess);

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
