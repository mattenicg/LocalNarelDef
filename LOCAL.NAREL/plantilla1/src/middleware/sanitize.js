const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const logger = require('../services/logger');

let DOMPurify;
try {
  const window = new JSDOM('').window;
  DOMPurify = createDOMPurify(window);
} catch (err) {
  logger.warn('DOMPurify no inicializado, usando sanitizado básico');
  DOMPurify = null;
}

function limpiarString(str) {
  if (typeof str !== 'string') return str;
  let s = str;
  if (DOMPurify) {
    s = DOMPurify.sanitize(s, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  } else {
    s = s.replace(/<[^>]*>/g, '').trim();
  }
  return s.replace(/\0/g, '');
}

function limpiarObjeto(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return limpiarString(obj);
  if (Array.isArray(obj)) return obj.map(limpiarObjeto);
  const salida = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      salida[k] = v;
    } else if (typeof v === 'string') {
      salida[k] = limpiarString(v);
    } else if (typeof v === 'object') {
      if (v instanceof Date) salida[k] = v;
      else salida[k] = limpiarObjeto(v);
    } else {
      salida[k] = v;
    }
  }
  return salida;
}

function middlewareSanitize(req, res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = limpiarObjeto(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = limpiarObjeto(req.query);
    }
    if (req.params && typeof req.params === 'object') {
      req.params = limpiarObjeto(req.params);
    }
    next();
  } catch (err) {
    logger.error('Error sanitizando entrada:', err);
    next(err);
  }
}

module.exports = middlewareSanitize;
module.exports.limpiarString = limpiarString;
module.exports.limpiarObjeto = limpiarObjeto;
