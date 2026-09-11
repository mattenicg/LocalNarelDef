const { body, param, query } = require('express-validator');

const schemas = {
  contacto: [
    body('nombre').isString().trim().isLength({ max: 60 }).withMessage('Nombre máximo 60 caracteres'),
    body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
    body('telefono').optional().isString().trim().isLength({ max: 40 }).withMessage('Teléfono máximo 40 caracteres'),
    body('mensaje').isString().trim().isLength({ max: 2000 }).withMessage('Mensaje máximo 2000 caracteres'),
    body('servicio_solicitado').optional().isString().trim().isLength({ max: 200 }),
    body('fecha_solicitada').optional().isString().trim(),
    body('datos_json').optional(),
  ],

  iaChat: [
    body('sesion').optional().isString().trim().isLength({ max: 100 }),
    body('mensaje').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Mensaje entre 1 y 1000 caracteres'),
  ],

  adminLogin: [
    body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
    body('password').isString().isLength({ min: 6 }).withMessage('Contraseña mínimo 6 caracteres'),
  ],

  cambioPassword: [
    body('password_actual').isString().isLength({ min: 6 }).withMessage('Contraseña actual inválida'),
    body('password_nueva').isString().isLength({ min: 8 }).withMessage('Nueva contraseña mínimo 8 caracteres'),
  ],

  negocio: [
    body('nombre').optional().isString().trim().isLength({ max: 200 }),
    body('descripcion').optional().isString().trim(),
    body('tagline').optional().isString().trim().isLength({ max: 300 }),
    body('whatsapp').optional().isString().trim().isLength({ max: 40 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('telefono').optional().isString().trim().isLength({ max: 40 }),
    body('direccion').optional().isString().trim().isLength({ max: 500 }),
    body('ciudad').optional().isString().trim().isLength({ max: 100 }),
    body('horario_json').optional(),
    body('logo_url').optional().isString().trim().isLength({ max: 500 }),
    body('color_primario').optional().isString().trim().isLength({ max: 20 }),
    body('color_secundario').optional().isString().trim().isLength({ max: 20 }),
    body('color_terciario').optional().isString().trim().isLength({ max: 20 }),
    body('dominio').optional().isString().trim().isLength({ max: 200 }),
    body('meta_title').optional().isString().trim().isLength({ max: 200 }),
    body('meta_desc').optional().isString().trim().isLength({ max: 500 }),
    body('og_image').optional().isString().trim().isLength({ max: 500 }),
    body('schema_org_json').optional(),
    body('ia_conocimiento').optional().isString().trim(),
  ],

  servicio: [
    body('nombre').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Nombre requerido (max 200)'),
    body('descripcion').optional().isString().trim(),
    body('precio').optional().isNumeric().toFloat(),
    body('moneda').optional().isString().trim().isLength({ max: 10 }),
    body('categoria').optional().isString().trim().isLength({ max: 100 }),
    body('destacado').optional().isInt({ min: 0, max: 1 }).toInt(),
    body('orden').optional().isInt().toInt(),
    body('activo').optional().isInt({ min: 0, max: 1 }).toInt(),
  ],

  galeria: [
    body('url').isString().trim().isLength({ min: 1, max: 500 }).withMessage('URL requerida'),
    body('titulo').optional().isString().trim().isLength({ max: 200 }),
    body('orden').optional().isInt().toInt(),
  ],

  faq: [
    body('pregunta').isString().trim().isLength({ min: 1, max: 500 }).withMessage('Pregunta requerida'),
    body('respuesta').isString().trim().isLength({ min: 1, max: 5000 }).withMessage('Respuesta requerida'),
    body('orden').optional().isInt().toInt(),
  ],

  idParam: [
    param('id').isInt({ min: 1 }).toInt().withMessage('ID inválido'),
  ],

  formulariosQuery: [
    query('leido').optional().isIn(['0', '1', 'todos']),
    query('pagina').optional().isInt({ min: 1 }).toInt(),
    query('por_pagina').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
};

module.exports = {
  ...require('express-validator'),
  schemas,
};
