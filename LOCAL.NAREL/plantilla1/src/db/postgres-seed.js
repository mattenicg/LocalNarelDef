const env = require('../config/env');
const { initPostgres, query, pool } = require('./postgres');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    await initPostgres();
    if (env.ADMIN_DEFAULT_EMAIL && env.ADMIN_DEFAULT_PASSWORD) {
      const hash = await bcrypt.hash(env.ADMIN_DEFAULT_PASSWORD, 12);
      await query(`INSERT INTO profiles(first_name,last_name,email,password_hash,role)
        VALUES($1,$2,$3,$4,'admin') ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash, role='admin'`,
        ['Administrador', '', env.ADMIN_DEFAULT_EMAIL.toLowerCase(), hash]);
      console.log(`Administrador PostgreSQL listo: ${env.ADMIN_DEFAULT_EMAIL}`);
    } else {
      console.log('Esquema PostgreSQL listo. Definí ADMIN_DEFAULT_EMAIL y ADMIN_DEFAULT_PASSWORD para crear un admin.');
    }
  } catch (error) {
    console.error('No se pudo ejecutar el seed PostgreSQL:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
