'use strict';

const crypto = require('crypto');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const env = require('../config/env');

let paymentClient = null;

function isMercadoPagoProvider() {
  return ['mercadopago', 'mercado_pago'].includes(String(env.PAYMENT_PROVIDER || '').toLowerCase());
}

function isConfigured() {
  return isMercadoPagoProvider()
    && Boolean(env.MERCADO_PAGO_PUBLIC_KEY)
    && Boolean(env.MERCADO_PAGO_ACCESS_TOKEN);
}

function getPaymentClient() {
  if (!isConfigured()) {
    const error = new Error('Mercado Pago no está configurado');
    error.code = 'MERCADO_PAGO_NOT_CONFIGURED';
    throw error;
  }
  if (!paymentClient) {
    const config = new MercadoPagoConfig({
      accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
      options: { timeout: 10000 },
    });
    paymentClient = new Payment(config);
  }
  return paymentClient;
}

async function createCardPayment({
  amount,
  externalReference,
  payerEmail,
  token,
  paymentMethodId,
  issuerId,
  installments,
  payerIdentification,
  idempotencyKey,
}) {
  const body = {
    transaction_amount: Number(amount),
    token: String(token),
    description: `${env.MERCADO_PAGO_STATEMENT_DESCRIPTOR || 'Narel Local'} - ${externalReference}`.slice(0, 250),
    installments: Number(installments) || 1,
    payment_method_id: String(paymentMethodId),
    payer: { email: String(payerEmail).trim().toLowerCase() },
    external_reference: String(externalReference),
  };
  if (payerIdentification && payerIdentification.type && payerIdentification.number) {
    body.payer.identification = {
      type: String(payerIdentification.type),
      number: String(payerIdentification.number),
    };
  }
  if (issuerId !== undefined && issuerId !== null && issuerId !== '') {
    body.issuer_id = Number(issuerId);
  }

  return getPaymentClient().create({
    body,
    requestOptions: { idempotencyKey },
  });
}

async function getPayment(paymentId) {
  return getPaymentClient().get({ id: String(paymentId) });
}

function verifyWebhookSignature({ signatureHeader, requestId, dataId }) {
  const secret = String(env.MERCADO_PAGO_WEBHOOK_SECRET || '');
  if (!secret || !signatureHeader || !requestId || !dataId) return false;

  const parts = String(signatureHeader).split(',').reduce((result, part) => {
    const [key, value] = part.trim().split('=');
    if (key && value) result[key] = value;
    return result;
  }, {});
  if (!parts.ts || !parts.v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const received = String(parts.v1).toLowerCase();
  if (expected.length !== received.length) return false;

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

module.exports = {
  createCardPayment,
  getPayment,
  isConfigured,
  verifyWebhookSignature,
};
