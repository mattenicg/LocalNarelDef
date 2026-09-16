'use strict';

/**
 * Servicio de integración con Correo Argentino y multilogística para cotización de envíos.
 */

const logger = require('../utils/logger');

// Variables de entorno para Correo Argentino
const CORREO_ARGENTINO_API_KEY = process.env.CORREO_ARGENTINO_API_KEY || '';
const CORREO_ARGENTINO_CUSTOMER_ID = process.env.CORREO_ARGENTINO_CUSTOMER_ID || '';
const CORREO_ARGENTINO_ORIGIN_CP = process.env.CORREO_ARGENTINO_ORIGIN_CP || '3000'; // Default Santa Fe Capital
const CORREO_ARGENTINO_API_URL = process.env.CORREO_ARGENTINO_API_URL || 'https://api.correoargentino.com.ar';

/**
 * Valida un código postal argentino.
 */
function isValidArgentinePostalCode(cp) {
  if (!cp || typeof cp !== 'string') return false;
  const clean = cp.trim().toUpperCase();
  return /^\d{4}$/.test(clean) || /^[A-Z]\d{4}[A-Z]{3}$/.test(clean);
}

/**
 * Normaliza dígitos del código postal.
 */
function normalizePostalCode(cp) {
  if (!cp) return '';
  const clean = String(cp).trim().toUpperCase();
  if (/^\d{4}$/.test(clean)) return clean;
  const match = /^[A-Z](\d{4})[A-Z]{3}$/.exec(clean);
  if (match) return match[1];
  return clean;
}

/**
 * Obtiene todas las opciones de entrega disponibles (Envío a domicilio y Retiro)
 * para el código postal indicado.
 */
async function getDeliveryOptions({ postalCode, items = [] }) {
  if (!isValidArgentinePostalCode(postalCode)) {
    return {
      ok: false,
      error: 'INVALID_POSTAL_CODE',
      message: 'Ingresá un código postal argentino válido (ej: 2300 o 3000).',
    };
  }

  const destinationCP = normalizePostalCode(postalCode);
  const originCP = normalizePostalCode(CORREO_ARGENTINO_ORIGIN_CP);

  // Estimación de peso total en gramos
  let totalWeightGrams = 0;
  if (Array.isArray(items) && items.length > 0) {
    totalWeightGrams = items.reduce((sum, item) => {
      const weight = Number(item.weight) || 350;
      const qty = Number(item.qty || item.quantity) || 1;
      return sum + (weight * qty);
    }, 0);
  } else {
    totalWeightGrams = 350;
  }

  // Opción siempre disponible: Retiro en Local propio
  const options = [
    {
      id: 'local_pickup',
      name: 'Retiro en Local NAREL',
      provider: 'Narel Store',
      type: 'retiro', // 'domicilio' | 'retiro'
      price: 0,
      estimatedDays: 'Inmediato (Horarios de atención)',
      description: 'Av. Santa Fe 1234, Local 4 - Santa Fe Capital',
      available: true,
    },
  ];

  // Si no hay credenciales de Correo Argentino configuradas en las variables de entorno
  if (!CORREO_ARGENTINO_API_KEY && !CORREO_ARGENTINO_CUSTOMER_ID) {
    logger.warn('[CorreoArgentino] No hay credenciales configuradas en las variables de entorno (CORREO_ARGENTINO_API_KEY).');
    return {
      ok: true,
      postalCode: destinationCP,
      options,
      notice: 'No pudimos calcular las tarifas a domicilio de Correo Argentino porque faltan configurar las credenciales API en el servidor.',
    };
  }

  // Si existen credenciales, realizamos las consultas a la API oficial de Correo Argentino
  try {
    const servicesToQuery = [
      { id: 'correo_clasico', service_type: 'paqar_clasico', name: 'Correo Argentino - PAQ.AR Clásico', type: 'domicilio', desc: 'Entrega directa en tu domicilio', defaultDays: '3 a 6 días hábiles' },
      { id: 'correo_expreso', service_type: 'paqar_expreso', name: 'Correo Argentino - PAQ.AR Expreso', type: 'domicilio', desc: 'Envío prioritario a domicilio', defaultDays: '1 a 3 días hábiles' },
      { id: 'correo_sucursal', service_type: 'paqar_sucursal', name: 'Correo Argentino - Retiro en Sucursal', type: 'retiro', desc: 'Retiro en la sucursal de Correo Argentino más cercana a tu CP', defaultDays: '2 a 4 días hábiles' },
    ];

    for (const srv of servicesToQuery) {
      try {
        const response = await fetch(`${CORREO_ARGENTINO_API_URL}/v1/rates/calculate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CORREO_ARGENTINO_API_KEY}`,
            'X-Customer-Id': CORREO_ARGENTINO_CUSTOMER_ID,
          },
          body: JSON.stringify({
            origin_postal_code: originCP,
            destination_postal_code: destinationCP,
            weight_grams: totalWeightGrams,
            service_type: srv.service_type,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data && (data.rate || data.price || data.total)) {
            const realCost = Number(data.rate || data.price || data.total);
            options.push({
              id: srv.id,
              name: srv.name,
              provider: 'Correo Argentino',
              type: srv.type,
              price: realCost,
              estimatedDays: data.estimated_days || srv.defaultDays,
              description: srv.desc,
              available: true,
            });
          }
        }
      } catch (err) {
        logger.error(`[CorreoArgentino] Error consultando servicio ${srv.service_type}:`, err.message);
      }
    }

    return {
      ok: true,
      postalCode: destinationCP,
      options,
    };
  } catch (err) {
    logger.error('[CorreoArgentino] Error al consultar opciones de envío:', err.message);
    return {
      ok: true,
      postalCode: destinationCP,
      options,
      notice: 'Ocurrió un error de red al conectar con Correo Argentino. Se muestran las opciones disponibles.',
    };
  }
}

/**
 * Mantiene compatibilidad con calculateShippingCost
 */
async function calculateShippingCost({ postalCode, items = [] }) {
  const res = await getDeliveryOptions({ postalCode, items });
  if (!res.ok) return res;

  const clasico = res.options.find((o) => o.id === 'correo_clasico') || res.options[0];
  if (clasico) {
    return {
      ok: true,
      carrier: clasico.provider,
      serviceName: clasico.name,
      cost: clasico.price,
      postalCode: res.postalCode,
      estimatedDays: clasico.estimatedDays,
    };
  }
  return {
    ok: false,
    error: 'NO_RATES',
    message: 'No pudimos calcular el costo de envío para este destino.',
  };
}

module.exports = {
  isValidArgentinePostalCode,
  calculateShippingCost,
  getDeliveryOptions,
};
