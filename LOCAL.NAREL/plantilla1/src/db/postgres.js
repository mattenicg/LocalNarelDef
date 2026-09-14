'use strict';

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const logger = require('../services/logger');
const { initMemoryDb, executeMemoryQuery } = require('./memoryStore');

let useMock = false;

const connection = env.DATABASE_URL
  ? { connectionString: env.DATABASE_URL, ssl: env.POSTGRES_SSL ? { rejectUnauthorized: false } : false }
  : {
      host: env.POSTGRES_HOST || 'localhost',
      port: env.POSTGRES_PORT || 5432,
      user: env.POSTGRES_USER || 'narel',
      password: env.POSTGRES_PASSWORD || '',
      database: env.POSTGRES_DB || 'narel_local',
      ssl: env.POSTGRES_SSL ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 1500,
    };

const pool = new Pool({ ...connection, max: Number(process.env.POSTGRES_POOL_MAX || 10) });

// Prevent unhandled errors from breaking the process if pool has an idle connection error
pool.on('error', (err) => {
  logger.warn(`[postgres] Pool error (no fatal): ${err.message}`);
});

async function query(text, params) {
  if (useMock) {
    return executeMemoryQuery(text, params);
  }
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (!useMock && (err.code === 'ECONNREFUSED' || err.message.includes('timeout') || err.message.includes('Connection terminated'))) {
      logger.warn(`[postgres] Conexión caída (${err.message}) — conmutando a almacenamiento en memoria.`);
      useMock = true;
      initMemoryDb(env.ADMIN_DEFAULT_EMAIL, env.ADMIN_DEFAULT_PASSWORD);
      return executeMemoryQuery(text, params);
    }
    throw err;
  }
}

async function withTransaction(callback) {
  if (useMock) {
    const mockClient = {
      query: (text, params) => Promise.resolve(executeMemoryQuery(text, params)),
      release: () => {},
    };
    return callback(mockClient);
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
      client.release();
    }
    // If connection failed to obtain client
    if (!client) {
      logger.warn(`[postgres] Error al abrir transacción (${error.message}) — usando almacenamiento en memoria.`);
      useMock = true;
      initMemoryDb(env.ADMIN_DEFAULT_EMAIL, env.ADMIN_DEFAULT_PASSWORD);
      const mockClient = {
        query: (text, params) => Promise.resolve(executeMemoryQuery(text, params)),
        release: () => {},
      };
      return callback(mockClient);
    }
    throw error;
  } finally {
    if (client) client.release();
  }
}

async function initPostgres() {
  try {
    // Probe database connection with a fast test
    const client = await pool.connect();
    client.release();

    const schemaPath = path.join(__dirname, 'postgres-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    logger.info('[postgres] Esquema PostgreSQL verificado correctamente en base de datos externa.');
  } catch (err) {
    logger.warn(`[postgres] PostgreSQL no disponible (${err.message}). Activando almacenamiento en memoria para vista previa.`);
    useMock = true;
    initMemoryDb(env.ADMIN_DEFAULT_EMAIL, env.ADMIN_DEFAULT_PASSWORD);
    logger.info('[postgres] Almacenamiento en memoria inicializado con catálogo y usuario admin.');
  }
}

module.exports = { pool, query, withTransaction, initPostgres };
