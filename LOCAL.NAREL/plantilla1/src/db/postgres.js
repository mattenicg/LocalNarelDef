const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const logger = require('../services/logger');

const connection = env.DATABASE_URL
  ? { connectionString: env.DATABASE_URL, ssl: env.POSTGRES_SSL ? { rejectUnauthorized: false } : false }
  : {
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      database: env.POSTGRES_DB,
      ssl: env.POSTGRES_SSL ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool({ ...connection, max: Number(process.env.POSTGRES_POOL_MAX || 10) });

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function initPostgres() {
  const schemaPath = path.join(__dirname, 'postgres-schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  logger.info('[postgres] Esquema verificado correctamente');
}

module.exports = { pool, query, withTransaction, initPostgres };
