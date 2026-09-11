const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PUERTO: parseInt(process.env.PUERTO, 10) || 3000,
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'app.db'),
  JWT_SECRET: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-change-jwt-secret'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ADMIN_DEFAULT_EMAIL: process.env.ADMIN_DEFAULT_EMAIL || '',
  ADMIN_DEFAULT_PASSWORD: process.env.ADMIN_DEFAULT_PASSWORD || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  IA_MAX_TOKENS: parseInt(process.env.IA_MAX_TOKENS, 10) || 500,
  IA_MAX_MENSAJES_POR_HORA: parseInt(process.env.IA_MAX_MENSAJES_POR_HORA, 10) || 20,
  ORIGIN_PERMITIDO: process.env.ORIGIN_PERMITIDO || 'http://localhost:3000',
  RUTA_PUBLICA: path.join(__dirname, '..', '..', 'public'),
  RUTA_ADMIN: path.join(__dirname, '..', '..', 'admin'),
  RUTA_LOGS: path.join(__dirname, '..', '..', 'logs'),
  RUTA_UPLOADS: path.join(__dirname, '..', '..', 'uploads'),

  // === POSTGRESQL ===
  POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
  POSTGRES_PORT: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
  POSTGRES_USER: process.env.POSTGRES_USER || 'narel',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || '',
  POSTGRES_DB: process.env.POSTGRES_DB || 'narel_local',
  POSTGRES_SSL: String(process.env.POSTGRES_SSL || 'false').toLowerCase() === 'true',
  DATABASE_URL: process.env.DATABASE_URL || '',
  SESSION_COOKIE_MAX_AGE_DAYS: parseInt(process.env.SESSION_COOKIE_MAX_AGE_DAYS, 10) || 7,
  PASSWORD_RESET_URL: process.env.PASSWORD_RESET_URL || 'http://localhost:3000/reset-password.html',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
  SMTP_FROM: process.env.SMTP_FROM || '',
  UPLOADS_DIR: process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads'),
  UPLOADS_PUBLIC_PATH: process.env.UPLOADS_PUBLIC_PATH || '/uploads',

  // === PAGOS ===
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || 'manual',
  MERCADO_PAGO_PUBLIC_KEY: process.env.MERCADO_PAGO_PUBLIC_KEY || '',
  MERCADO_PAGO_ACCESS_TOKEN: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
  MERCADO_PAGO_WEBHOOK_SECRET: process.env.MERCADO_PAGO_WEBHOOK_SECRET || '',
  MERCADO_PAGO_LOCALE: process.env.MERCADO_PAGO_LOCALE || 'es-AR',
  MERCADO_PAGO_STATEMENT_DESCRIPTOR: process.env.MERCADO_PAGO_STATEMENT_DESCRIPTOR || 'NAREL LOCAL',
  NARANJA_X_API_URL: process.env.NARANJA_X_API_URL || '',
  NARANJA_X_CLIENT_ID: process.env.NARANJA_X_CLIENT_ID || '',
  NARANJA_X_CLIENT_SECRET: process.env.NARANJA_X_CLIENT_SECRET || '',
  NARANJA_X_WEBHOOK_SECRET: process.env.NARANJA_X_WEBHOOK_SECRET || '',
  ORDER_WHATSAPP_NUMBER: process.env.ORDER_WHATSAPP_NUMBER || '',
  ORDER_PAYMENT_ALIAS: process.env.ORDER_PAYMENT_ALIAS || '',
  ORDER_PAYMENT_CBU: process.env.ORDER_PAYMENT_CBU || '',
  ORDER_PICKUP_ADDRESS: process.env.ORDER_PICKUP_ADDRESS || 'San Martín 2029',
  ORDER_SHIPPING_NOTE: process.env.ORDER_SHIPPING_NOTE || 'Costo de envío a coordinar por WhatsApp.',
};

module.exports = env;
