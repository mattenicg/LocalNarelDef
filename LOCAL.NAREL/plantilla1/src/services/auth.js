const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const logger = require('./logger');

function generateJWT(payload, expiresIn = env.JWT_EXPIRES_IN) {
  try {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
  } catch (err) {
    logger.error('Error generando JWT:', err);
    throw err;
  }
}

function verifyJWT(token) {
  try {
    if (!token) return null;
    return jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    logger.warn('Token JWT inválido o expirado:', err.message);
    return null;
  }
}

function hashPassword(password, rounds = 12) {
  try {
    return bcrypt.hashSync(password, rounds);
  } catch (err) {
    logger.error('Error hasheando contraseña:', err);
    throw err;
  }
}

function verifyPassword(password, hash) {
  try {
    if (!password || !hash) return false;
    return bcrypt.compareSync(password, hash);
  } catch (err) {
    logger.error('Error verificando contraseña:', err);
    return false;
  }
}

function extraerTokenBearer(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

module.exports = {
  generateJWT,
  verifyJWT,
  hashPassword,
  verifyPassword,
  extraerTokenBearer,
};
