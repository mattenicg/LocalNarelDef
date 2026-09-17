'use strict';

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const logger = require('../services/logger');
const { initMemoryDb, executeMemoryQuery } = require('./memoryStore');

let useMock = false;

// If neither DATABASE_URL nor an explicit POSTGRES_HOST is set, immediately default to in-memory store
if (!env.DATABASE_URL && !process.env.POSTGRES_HOST) {
  useMock = true;
  initMemoryDb(env.ADMIN_DEFAULT_EMAIL, env.ADMIN_DEFAULT_PASSWORD);
}

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

async function migrateLegacyProducts() {
  try {
    const prods = await pool.query('SELECT id, sizes, stock FROM products');
    logger.info(`[migration] Checking ${prods.rows.length} products for legacy sizes/stock migration...`);

    for (const p of prods.rows) {
      const existing = await pool.query('SELECT 1 FROM product_size_stock WHERE product_id = $1 LIMIT 1', [p.id]);
      if (existing.rows.length > 0) {
        continue;
      }

      logger.info(`[migration] Migrating product ${p.id} with sizes: "${p.sizes}" and stock: ${p.stock}`);
      const rawSizes = p.sizes ? String(p.sizes).trim() : 'Único';
      const parsedSizes = rawSizes.split(/\s*[-|/,]\s*/).map(s => s.trim()).filter(Boolean);
      const isSingleSize = parsedSizes.length <= 1;

      for (const sizeName of parsedSizes) {
        const sizeStock = isSingleSize ? Number(p.stock || 0) : 0;
        
        await pool.query(
          'INSERT INTO product_size_stock (product_id, size_name, stock) VALUES ($1, $2, $3) ON CONFLICT (product_id, size_name) DO NOTHING',
          [p.id, sizeName, sizeStock]
        );

        try {
          const existing = await pool.query('SELECT id FROM sizes_master WHERE LOWER(name) = LOWER($1)', [sizeName]);
          if (!existing.rows || existing.rows.length === 0) {
            await pool.query(
              'INSERT INTO sizes_master (name, active) VALUES ($1, true) ON CONFLICT (name) DO NOTHING',
              [sizeName]
            );
          }
        } catch (_) {}
      }
    }
    logger.info('[migration] Legacy products migration completed successfully.');
  } catch (err) {
    logger.error('[migration] Error running legacy products migration:', err.message);
  }
}

async function initPostgres() {
  console.log('[PG TEST] initPostgres comenzó');

  if (useMock) {
    console.log('[PG TEST] useMock ya estaba activo');
    logger.info('[postgres] Almacenamiento en memoria activo.');
    return;
  }

  try {
    console.log('[PG TEST] intentando pool.connect()');

    const client = await pool.connect();

    console.log('[PG TEST] pool.connect() OK');

    client.release();

    console.log('[PG TEST] leyendo postgres-schema.sql');

    const schemaPath = path.join(__dirname, 'postgres-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('[PG TEST] schema leído. Ejecutando pool.query(schema)');

    await pool.query(schema);

    console.log('[PG TEST] schema ejecutado OK');

    logger.info('[postgres] Esquema PostgreSQL verificado correctamente en base de datos externa.');

    console.log('[PG TEST] comenzando migrateLegacyProducts');

    await migrateLegacyProducts();

    console.log('[PG TEST] migrateLegacyProducts OK');

  } catch (err) {
    console.log('[PG TEST] ERROR:', err.message);

    logger.warn(
      `[postgres] PostgreSQL no disponible (${err.message}). Activando almacenamiento en memoria para vista previa.`
    );

    useMock = true;

    initMemoryDb(
      env.ADMIN_DEFAULT_EMAIL,
      env.ADMIN_DEFAULT_PASSWORD
    );

    logger.info(
      '[postgres] Almacenamiento en memoria inicializado con catálogo y usuario admin.'
    );

    console.log('[PG TEST] fallback a memoria completado');
  }
}
module.exports = { pool, query, withTransaction, initPostgres };
