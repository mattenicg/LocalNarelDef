const path = require('path');
const winston = require('winston');
const env = require('../config/env');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const formatoConsola = printf(({ level, message, timestamp, stack }) => {
  if (stack) return `[${timestamp}] ${level}: ${message}\n${stack}`;
  return `[${timestamp}] ${level}: ${message}`;
});

const formatoArchivo = printf(({ level, message, timestamp, stack, ...meta }) => {
  const entrada = {
    timestamp,
    level,
    message,
    ...(Object.keys(meta).length ? meta : {}),
    ...(stack ? { stack } : {}),
  };
  return JSON.stringify(entrada);
});

const transportes = [
  new winston.transports.Console({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), formatoConsola),
  }),
];

if (env.NODE_ENV !== 'test') {
  transportes.push(
    new winston.transports.File({
      filename: path.join(env.RUTA_LOGS, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
      format: combine(timestamp(), errors({ stack: true }), formatoArchivo),
    })
  );
  transportes.push(
    new winston.transports.File({
      filename: path.join(env.RUTA_LOGS, 'combined.log'),
      maxsize: 10485760,
      maxFiles: 10,
      format: combine(timestamp(), errors({ stack: true }), formatoArchivo),
    })
  );
}

const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: transportes,
  exitOnError: false,
});

logger.stream = {
  write: (mensaje) => logger.info(mensaje.trim()),
};

module.exports = logger;
