const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');

const MAX_BYTES = 5 * 1024 * 1024;
const MIME_ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function validate(file) {
  if (!file) return { ok: false, message: 'Archivo faltante' };
  if (!MIME_ALLOWED.has(file.mimetype)) {
    return { ok: false, message: 'Formato no permitido. Solo JPG, JPEG, PNG y WEBP' };
  }
  if (!file.buffer?.length || file.size > MAX_BYTES) {
    return { ok: false, message: 'Archivo demasiado grande. Tamaño máximo 5 MB' };
  }
  return { ok: true };
}

async function uploadProductImage(userId, file) {
  const v = validate(file);
  if (!v.ok) return v;

  const safeUserId = String(userId || 'admin').trim();
  const folder = path.join(env.UPLOADS_DIR, 'products', safeUserId);
  ensureDir(folder);

  const extension = EXT[file.mimetype] || 'jpg';
  const name = `${crypto.randomUUID()}.${extension}`;
  const full = path.join(folder, name);
  fs.writeFileSync(full, file.buffer);

  const relPath = path.relative(env.UPLOADS_DIR, full).replace(/\\/g, '/');
  const publicBase = (env.UPLOADS_PUBLIC_PATH || '/uploads').replace(/\/$/, '');
  const publicUrl = `${publicBase}/${relPath.replace(/^\//, '')}`;

  return {
    ok: true,
    message: 'Imagen subida correctamente',
    data: {
      path: relPath,
      image_url: publicUrl,
      size_bytes: file.size,
      mime: file.mimetype,
    },
    image_url: publicUrl,
  };
}

async function uploadProductImages(userId, files) {
  if (!Array.isArray(files) || files.length === 0) {
    return { ok: false, message: 'Archivos faltantes' };
  }

  const uploaded = [];
  for (const file of files) {
    const res = await uploadProductImage(userId, file);
    if (!res.ok) return res;
    uploaded.push(res.data);
  }

  const urls = uploaded.map((u) => u.image_url);
  return {
    ok: true,
    message: 'Imágenes subidas correctamente',
    data: {
      images: urls,
      image_url: urls[0] || null,
      items: uploaded,
    },
    images: urls,
    image_url: urls[0] || null,
  };
}

function deleteObjectByPublicUrl(url) {
  const publicBase = (env.UPLOADS_PUBLIC_PATH || '/uploads').replace(/\/$/, '');
  const prefix = `${publicBase}/`;
  if (!url || !url.startsWith(prefix)) return { ok: true, skipped: true };
  const full = path.join(env.UPLOADS_DIR, url.slice(prefix.length));
  if (fs.existsSync(full)) {
    try {
      fs.unlinkSync(full);
    } catch (_) {}
  }
  return { ok: true, removed: true };
}

module.exports = {
  MAX_BYTES,
  MIME_ALLOWED,
  validate,
  uploadProductImage,
  uploadProductImages,
  deleteObjectByPublicUrl,
};
