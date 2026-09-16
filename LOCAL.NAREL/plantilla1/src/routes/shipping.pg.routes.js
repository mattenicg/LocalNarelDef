'use strict';

const express = require('express');
const router = express.Router();
const {
  calculateShippingCost,
  getDeliveryOptions,
  isValidArgentinePostalCode,
} = require('../services/correoArgentino.service');

/**
 * POST /api/shipping/options
 * Consulta todas las modalidades de entrega disponibles (domicilio y retiro) para un código postal.
 * Body: { postalCode: "2300", items: [...] }
 */
router.post('/options', async (req, res) => {
  try {
    const { postalCode, items } = req.body || {};

    if (!postalCode || typeof postalCode !== 'string' || !postalCode.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'EMPTY_POSTAL_CODE',
        message: 'Por favor ingresá tu código postal para consultar las opciones de entrega.',
      });
    }

    if (!isValidArgentinePostalCode(postalCode)) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_POSTAL_CODE',
        message: 'Ingresá un código postal argentino válido (ej: 2300 o 3000).',
      });
    }

    const result = await getDeliveryOptions({ postalCode: postalCode.trim(), items });

    if (!result.ok) {
      return res.status(200).json(result);
    }

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (err) {
    console.error('[shipping.routes] Error consultando opciones de entrega:', err);
    return res.status(500).json({
      ok: false,
      error: 'SERVER_ERROR',
      message: 'No pudimos obtener las opciones de entrega. Intentá nuevamente.',
    });
  }
});

/**
 * POST /api/shipping/calculate
 * Mantiene compatibilidad
 */
router.post('/calculate', async (req, res) => {
  try {
    const { postalCode, items } = req.body || {};

    if (!postalCode || typeof postalCode !== 'string' || !postalCode.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'EMPTY_POSTAL_CODE',
        message: 'Por favor ingresá tu código postal para calcular el envío.',
      });
    }

    if (!isValidArgentinePostalCode(postalCode)) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_POSTAL_CODE',
        message: 'Ingresá un código postal argentino válido (ej: 2300 o 3000).',
      });
    }

    const result = await calculateShippingCost({ postalCode: postalCode.trim(), items });

    if (!result.ok) {
      return res.status(200).json(result);
    }

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (err) {
    console.error('[shipping.routes] Error en cálculo de envío:', err);
    return res.status(500).json({
      ok: false,
      error: 'SERVER_ERROR',
      message: 'No pudimos calcular el costo de envío para este destino.',
    });
  }
});

module.exports = router;
