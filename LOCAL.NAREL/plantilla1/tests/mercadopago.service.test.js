'use strict';

process.env.MERCADO_PAGO_WEBHOOK_SECRET = 'test-webhook-secret';
const crypto = require('crypto');
const { verifyWebhookSignature, isConfigured } = require('../src/services/mercadopago.service');

describe('Mercado Pago service', () => {
  test('verifica una firma de webhook válida', () => {
    const dataId = '123456789';
    const requestId = 'request-123';
    const ts = '1710000000';
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', process.env.MERCADO_PAGO_WEBHOOK_SECRET).update(manifest).digest('hex');

    expect(verifyWebhookSignature({
      signatureHeader: `ts=${ts},v1=${v1}`,
      requestId,
      dataId,
    })).toBe(true);
  });

  test('rechaza una firma de webhook inválida', () => {
    expect(verifyWebhookSignature({
      signatureHeader: 'ts=1710000000,v1=invalid',
      requestId: 'request-123',
      dataId: '123456789',
    })).toBe(false);
  });

  test('no considera configurado Mercado Pago sin provider y credenciales', () => {
    expect(isConfigured()).toBe(false);
  });
});
