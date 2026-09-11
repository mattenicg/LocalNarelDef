#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const strict = process.argv.includes('--strict');
const failures = [];
const warnings = [];

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  const result = fs.existsSync(absolute(relativePath));
  if (!result) failures.push(`Falta ${relativePath}`);
  return result;
}

function read(relativePath) {
  return fs.readFileSync(absolute(relativePath), 'utf8');
}

function has(relativePath, markers) {
  if (!exists(relativePath)) return false;
  const content = read(relativePath);
  const missing = markers.filter((marker) => !content.includes(marker));
  if (missing.length) failures.push(`${relativePath} no contiene: ${missing.join(', ')}`);
  return missing.length === 0;
}

console.log(`\nNAREL LOCAL PREFLIGHT${strict ? ' — STRICT' : ''}`);
console.log('='.repeat(42));

[
  'src/server.js',
  'src/config/env.js',
  'src/db/postgres-schema.sql',
  'src/routes/orders.pg.routes.js',
  'src/routes/payments.pg.routes.js',
  'src/services/order.service.js',
  'src/services/mercadopago.service.js',
  'public/assets/js/storefrontCheckout.js',
  'public/assets/css/storefront-checkout.css',
  'public/admin/orders.html',
  'public/admin/assets/js/admin/orders.js',
  '.env.example',
].forEach(exists);

has('src/server.js', [
  "app.use('/api/orders', supabaseOrdersPublicRoutes)",
  "app.use('/api/payments', paymentsRoutes)",
  "app.get('/api/health'",
]);
has('src/db/postgres-schema.sql', [
  "'mercadopago_card'",
  'mp_payment_id TEXT',
  'idx_orders_mp_payment_id',
]);
has('src/routes/payments.pg.routes.js', [
  "router.post('/mercadopago/card'",
  "router.post('/mercadopago/webhook'",
  "Idempotency-Key",
]);
has('public/assets/js/storefrontCheckout.js', [
  'mercadoPagoCardBrick',
  '/api/payments/mercadopago/card',
  'Idempotency-Key',
]);
has('.env.example', [
  'MERCADO_PAGO_PUBLIC_KEY=',
  'MERCADO_PAGO_ACCESS_TOKEN=',
  'MERCADO_PAGO_WEBHOOK_SECRET=',
]);

const envPath = absolute('.env');
if (!fs.existsSync(envPath)) {
  warnings.push('No existe .env: se omiten las comprobaciones de credenciales.');
} else {
  const envText = fs.readFileSync(envPath, 'utf8');
  const values = {};
  envText.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  });
  if (!values.POSTGRES_HOST && !values.DATABASE_URL) warnings.push('POSTGRES_HOST o DATABASE_URL no configurado.');
  if (String(values.PAYMENT_PROVIDER || 'manual').toLowerCase() === 'mercadopago') {
    ['MERCADO_PAGO_PUBLIC_KEY', 'MERCADO_PAGO_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET'].forEach((key) => {
      if (!values[key] || /CHANGE|REPLACE|TU_/i.test(values[key])) failures.push(`.env requiere ${key} para Mercado Pago`);
    });
  }
  if (values.NODE_ENV === 'production') {
    if (!values.ORIGIN_PERMITIDO || values.ORIGIN_PERMITIDO === '*') failures.push('En producción ORIGIN_PERMITIDO debe ser un dominio explícito.');
    if (!values.ORDER_WHATSAPP_NUMBER) warnings.push('ORDER_WHATSAPP_NUMBER no configurado: no habrá enlace automático de WhatsApp.');
  }
}

const htmlFiles = [];
function collectHtml(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) collectHtml(full);
    else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}
collectHtml(root);
const missingRefs = [];
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const reference = match[1].split('?')[0];
    if (!reference.startsWith('/assets/') && !reference.startsWith('/admin/')) continue;
    const target = absolute(path.join('public', reference.replace(/^\//, '')));
    if (!fs.existsSync(target)) missingRefs.push(`${path.relative(root, file)} -> ${reference}`);
  }
}
if (missingRefs.length) failures.push(`Referencias rotas: ${missingRefs.join('; ')}`);

if (warnings.length) {
  console.log('\nAdvertencias:');
  warnings.forEach((item) => console.log(`- ${item}`));
}
if (failures.length) {
  console.log('\nFallos:');
  failures.forEach((item) => console.log(`- ${item}`));
  console.log(`\nResultado: FALLÓ (${failures.length})`);
  process.exitCode = 1;
} else {
  console.log(`\nResultado: OK${strict ? ' — configuración estricta' : ' — estructura y contratos'}`);
}
