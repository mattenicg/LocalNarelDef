const express = require('express');
const multer = require('multer');
const { param, validationResult } = require('express-validator');
const { authenticate, requireAdmin } = require('../middleware/postgresAuth');
const { query } = require('../db/postgres');
const { MAX_BYTES, MIME_ALLOWED, uploadProductImage, uploadProductImages, deleteObjectByPublicUrl } = require('../services/localStorage');
const { deleteProductImage, syncProductImages } = require('../services/productImages.service');

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
    const result = await deleteProductImage(req.params.id, targetUrl);
    const remainingUrls = result.remaining.map((img) => img.image_url);
    const newMain = remainingUrls[0] || null;
    return res.json({
      ok: true,
      message: 'Imagen eliminada correctamente',
      images: remainingUrls,
      image_url: newMain,
      product_images: result.remaining,
    });
  }

  // Delete all images
  const remaining = await syncProductImages(req.params.id, []);
  res.json({ ok: true, message: 'Imágenes eliminadas correctamente', images: [], image_url: null, product_images: remaining });
});

module.exports = router;

