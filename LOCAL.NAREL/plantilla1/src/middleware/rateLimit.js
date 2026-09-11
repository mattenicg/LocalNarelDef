const rateLimit = require('express-rate-limit');
const env = require('../config/env');

function keyGeneradoraGeneral(req) {
  const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0] || req.ip || req.socket?.remoteAddress || 'sin_ip';
  return ip.trim();
}

const limiterGeneral = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGeneradoraGeneral,
  message: { ok: false, error: 'Demasiadas solicitudes. Intenta nuevamente en un minuto.' },
});

const limiterFormularios = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGeneradoraGeneral,
  message: { ok: false, error: 'Límite de formularios alcanzado. Intenta nuevamente en una hora.' },
});

function crearLimiterIA() {
  const contadores = new Map();

  return function limiterIA(req, res, next) {
    const sesion = (req.body?.sesion || req.query?.sesion || keyGeneradoraGeneral(req) || 'global').toString();
    const ahora = Date.now();
    const ventanaMs = 60 * 60 * 1000;
    const maxPorSesion = env.IA_MAX_MENSAJES_POR_HORA;

    let registro = contadores.get(sesion);
    if (!registro || ahora - registro.inicio > ventanaMs) {
      registro = { inicio: ahora, cuenta: 0 };
    }
    registro.cuenta += 1;
    contadores.set(sesion, registro);

    if (registro.cuenta > maxPorSesion) {
      return res.status(429).json({
        ok: false,
        error: `Límite de mensajes por hora alcanzado (${maxPorSesion}). Intenta nuevamente más tarde.`,
      });
    }

    const restantes = maxPorSesion - registro.cuenta;
    res.setHeader('X-RateLimit-Limit', maxPorSesion);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, restantes));
    next();
  };
}

const limiterIA = crearLimiterIA();

const limiterLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGeneradoraGeneral,
  message: { ok: false, error: 'Demasiados intentos de inicio de sesión. Intenta nuevamente en 15 minutos.' },
});

module.exports = {
  limiterGeneral,
  limiterFormularios,
  limiterIA,
  limiterLogin,
};
