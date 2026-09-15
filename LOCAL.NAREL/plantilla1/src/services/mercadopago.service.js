'use strict';

const crypto = require('crypto');
const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');
const env = require('../config/env');

let paymentClient = null;
let preferenceClient = null;

function isMercadoPagoProvider() {
  return ['mercadopago', 'mercado_pago'].includes(
    String(env.PAYMENT_PROVIDER || '').toLowerCase()
  );
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
      options: {
        timeout: 10000,
      },
    });

    paymentClient = new Payment(config);
  }

  return paymentClient;
}

function getPreferenceClient() {
  if (!isConfigured()) {
    const error = new Error('Mercado Pago no está configurado');
    error.code = 'MERCADO_PAGO_NOT_CONFIGURED';
    throw error;
  }

  if (!preferenceClient) {
    const config = new MercadoPagoConfig({
      accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
      options: {
        timeout: 10000,
      },
    });

    preferenceClient = new Preference(config);
  }

  return preferenceClient;
}

async function createPreference({
  items,
  customer,
  shipping,
  total,
  externalReference,
  backUrls,
}) {
  const client = getPreferenceClient();

  const prefItems = (items && items.length > 0)
    ? items.map((item, idx) => ({
        id: String(item.product_id || item.id || `item-${idx}`),
        title: String(item.product_name || item.name || item.title || 'Producto Narel').slice(0, 250),
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || item.unitPrice || item.price || total),
        currency_id: 'ARS',
      }))
    : [
        {
          id: 'narel-cart',
          title: 'Compra en Narel Local',
          quantity: 1,
          unit_price: Number(total),
          currency_id: 'ARS',
        },
      ];

  const body = {
    items: prefItems,
    payer: customer ? {
      name: String(customer.name || '').slice(0, 100),
      email: String(customer.email || '').trim().toLowerCase(),
      phone: customer.phone ? { number: String(customer.phone) } : undefined,
    } : undefined,
    external_reference: String(externalReference),
    payment_methods: {
      excluded_payment_methods: [], // NO excluimos ningún medio soportado por MP
      excluded_payment_types: [],   // Permitimos todos los tipos de pago soportados
      installments: 24,             // Habilitamos hasta 24 cuotas
    },
    back_urls: backUrls || undefined,
    auto_return: backUrls ? 'approved' : undefined,
    statement_descriptor: env.MERCADO_PAGO_STATEMENT_DESCRIPTOR || 'Narel Local',
  };

  try {
    return await client.create({ body });
  } catch (error) {
    console.error('Mercado Pago createPreference error:', {
      responseData: error.response?.data,
      cause: error.cause,
      status: error.status,
      message: error.message,
    });
    throw error;
  }
}

async function processPayment({
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
  // Verificación defensiva: Go Cuotas está estrictamente excluido
  if (String(paymentMethodId || '').toLowerCase().includes('gocuotas')) {
    const error = new Error('Método de pago no admitido.');
    error.status = 400;
    throw error;
  }

  const body = {
    transaction_amount: Number(amount),
    description: `${env.MERCADO_PAGO_STATEMENT_DESCRIPTOR || 'Narel Local'} - ${externalReference}`.slice(0, 250),
    payment_method_id: String(paymentMethodId),
    payer: {
      email: String(payerEmail).trim().toLowerCase(),
    },
    external_reference: String(externalReference),
  };

  if (token) {
    body.token = String(token);
    body.installments = Number(installments) || 1;
    if (
      issuerId !== undefined
      && issuerId !== null
      && issuerId !== ''
    ) {
      body.issuer_id = Number(issuerId);
    }
  }

  if (
    payerIdentification
    && payerIdentification.type
    && payerIdentification.number
  ) {
    body.payer.identification = {
      type: String(payerIdentification.type),
      number: String(payerIdentification.number),
    };
  }

  try {
    return await getPaymentClient().create({
      body,
      requestOptions: {
        idempotencyKey,
      },
    });
  } catch (error) {
    console.error('Mercado Pago processPayment error:', {
      responseData: error.response?.data,
      cause: error.cause,
      status: error.status,
      message: error.message,
    });

    throw error;
  }
}

async function createCardPayment(params) {
  return processPayment(params);
}

async function getPayment(paymentId) {
  try {
    return await getPaymentClient().get({
      id: String(paymentId),
    });
  } catch (error) {
    console.error('Mercado Pago get payment error:', {
      responseData: error.response?.data,
      cause: error.cause,
      status: error.status,
      message: error.message,
    });

    throw error;
  }
}

function verifyWebhookSignature({
  signatureHeader,
  requestId,
  dataId,
}) {
  const secret = String(env.MERCADO_PAGO_WEBHOOK_SECRET || '');

  if (!secret || !signatureHeader || !requestId || !dataId) {
    return false;
  }

  const parts = String(signatureHeader)
    .split(',')
    .reduce((result, part) => {
      const [key, value] = part.trim().split('=');

      if (key && value) {
        result[key] = value;
      }

      return result;
    }, {});

  if (!parts.ts || !parts.v1) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  const received = String(parts.v1).toLowerCase();

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(received)
  );
}

module.exports = {
  createCardPayment,
  processPayment,
  createPreference,
  getPayment,
  isConfigured,
  verifyWebhookSignature,
};
