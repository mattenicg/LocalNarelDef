const express = require('express');
const multer = require('multer');
const { param, validationResult } = require('express-validator');
const { authenticate, requireAdmin } = require('../middleware/postgresAuth');
const { query } = require('../db/postgres');
const { MAX_BYTES, MIME_ALLOWED, uploadProductImage, uploadProductImages, deleteObjectByPublicUrl } = require('../services/localStorage');

const router = express.Router();
router.use(authenticate, requireAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 15 },
  fileFilter: (req, file, cb) => (MIME_ALLOWED.has(file.mimetype) ? cb(null, true) : cb(new Error('Formato no permitido. Solo JPG, JPEG, PNG y WEBP'))),
});

const handleMulterUpload = (req, res, next) => {
  upload.any()(req, res, (e) => {
    if (e) {
      return res.status(400).json({
        ok: false,
        message: e.code === 'LIMIT_FILE_SIZE' ? 'Una de las imágenes supera el límite de 5 MB' : (e.message || 'Error al procesar archivo'),
      });
    }
    next();
  });
};

router.post(['/upload-image', '/upload-images'], handleMulterUpload, async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (!files || files.length === 0) {
    return res.status(400).json({ ok: false, message: 'Debe adjuntar al menos una imagen' });
  }

  if (files.length === 1) {
    const result = await uploadProductImage(req.user.id, files[0]);
    if (!result.ok) return res.status(400).json(result);
    return res.status(200).json({
      ok: true,
      message: 'Imagen subida correctamente',
      image_url: result.data.image_url,
      images: [result.data.image_url],
      data: {
        ...result.data,
        images: [result.data.image_url],
      },
    });
  }

  const result = await uploadProductImages(req.user.id, files);
  return res.status(result.ok ? 200 : 400).json(result);
});

router.delete('/:id/image', [param('id').isUUID()], async (req, res) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ ok: false, message: 'Producto inválido' });
  const { rows } = await query('SELECT image_url, images FROM products WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ ok: false, message: 'Producto no encontrado' });

  const targetUrl = typeof req.query.url === 'string' && req.query.url.trim() ? req.query.url.trim() : null;

  if (targetUrl) {
    deleteObjectByPublicUrl(targetUrl);
    let currentImages = [];
    if (Array.isArray(rows[0].images)) currentImages = rows[0].images;
    else if (typeof rows[0].images === 'string' && rows[0].images.startsWith('[')) {
      try { currentImages = JSON.parse(rows[0].images); } catch (_) {}
    } else if (rows[0].image_url) {
      currentImages = [rows[0].image_url];
    }
    const filtered = currentImages.filter((u) => u !== targetUrl);
    const newMain = filtered[0] || null;
    await query('UPDATE products SET image_url=$1, images=$2, updated_at=now() WHERE id=$3', [newMain, JSON.stringify(filtered), req.params.id]);
    return res.json({ ok: true, message: 'Imagen eliminada correctamente', images: filtered, image_url: newMain });
  }

  // Delete all images
  if (rows[0].image_url) deleteObjectByPublicUrl(rows[0].image_url);
  if (Array.isArray(rows[0].images)) {
    rows[0].images.forEach((u) => deleteObjectByPublicUrl(u));
  } else if (typeof rows[0].images === 'string' && rows[0].images.startsWith('[')) {
    try { JSON.parse(rows[0].images).forEach((u) => deleteObjectByPublicUrl(u)); } catch (_) {}
  }

  await query('UPDATE products SET image_url=NULL, images=\'[]\'::jsonb, updated_at=now() WHERE id=$1', [req.params.id]);
  res.json({ ok: true, message: 'Imágenes eliminadas correctamente', images: [], image_url: null });
});

module.exports = router;

