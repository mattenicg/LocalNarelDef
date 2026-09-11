const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

module.exports = {
  PORT: process.env.PUERTO || 3000,
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'app.db'),
  JWT_SECRET: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-change-jwt-secret'),
  JWT_EXPIRES: process.env.JWT_EXPIRES || '7d',
  NODE_ENV: process.env.NODE_ENV || 'development',
  ORIGIN_PERMITIDO: process.env.ORIGIN_PERMITIDO || 'http://localhost:3000',
  ADMIN_DEFAULT_EMAIL: process.env.ADMIN_DEFAULT_EMAIL || '',
  ADMIN_DEFAULT_PASSWORD: process.env.ADMIN_DEFAULT_PASSWORD || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  IA_MAX_TOKENS: parseInt(process.env.IA_MAX_TOKENS || '500', 10),
  IA_MAX_MENSAJES_POR_HORA: parseInt(process.env.IA_MAX_MENSAJES_POR_HORA || '20', 10)
};
