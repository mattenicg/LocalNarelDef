'use strict';

const { query } = require('../db/postgres');
const { deleteObjectByPublicUrl } = require('./localStorage');

/**
 * Servicio unificado para la gestión y persistencia de imágenes de productos.
 * Fuente única de verdad: tabla PostgreSQL `product_images`.
 */

/**
 * Obtiene todas las imágenes de un producto ordenadas por posición ascendente.
 * @param {string} productId
 * @returns {Promise<Array<{id: string, product_id: string, image_url: string, storage_path: string, alt_text: string, position: number, created_at: string, updated_at: string}>>}
 */
async function getProductImages(productId) {
  if (!productId) return [];

  const res = await query(
    'SELECT id, product_id, image_url, storage_path, alt_text, position, created_at, updated_at FROM product_images WHERE product_id = $1 ORDER BY position ASC, created_at ASC',
    [productId]
  );

  if (res.rows && res.rows.length > 0) {
    return res.rows;
  }

  // Fallback / Auto-sync: si product_images está vacío pero products tiene image_url o images, migrarlo
  try {
    const prodRes = await query('SELECT id, image_url, images FROM products WHERE id = $1', [productId]);
    if (prodRes.rows[0]) {
      const p = prodRes.rows[0];
      let urls = [];
      if (Array.isArray(p.images)) {
        urls = p.images.filter(Boolean);
      } else if (typeof p.images === 'string' && p.images.trim()) {
        try {
          const parsed = JSON.parse(p.images);
          if (Array.isArray(parsed)) urls = parsed.filter(Boolean);
        } catch (_) {
          urls = [p.images.trim()];
        }
      }
      if (p.image_url && !urls.includes(p.image_url)) {
        urls.unshift(p.image_url);
      }

      if (urls.length > 0) {
        const created = [];
        for (let i = 0; i < urls.length; i++) {
          const u = urls[i];
          const insRes = await query(
            'INSERT INTO product_images (product_id, image_url, storage_path, alt_text, position) VALUES ($1, $2, $3, $4, $5) RETURNING id, product_id, image_url, storage_path, alt_text, position, created_at, updated_at',
            [productId, u, u, '', i]
          );
          if (insRes.rows[0]) created.push(insRes.rows[0]);
        }
        return created;
      }
    }
  } catch (err) {
    console.warn('[productImagesService] auto-sync fallback warning:', err.message);
  }

  return [];
}

/**
 * Sincroniza la lista completa de imágenes de un producto.
 * Inserta las nuevas, actualiza posiciones de las existentes y elimina/borra del disco las descartadas.
 * @param {string} productId
 * @param {Array<string|object>} imagesInput
 * @returns {Promise<Array<object>>} Lista actualizada de product_images
 */
async function syncProductImages(productId, imagesInput) {
  if (!productId) return [];

  // Normalizar array de entrada
  let normalizedList = [];
  if (Array.isArray(imagesInput)) {
    normalizedList = imagesInput.map((item) => {
      if (typeof item === 'string') {
        const url = item.trim();
        return url ? { image_url: url, storage_path: url, alt_text: '' } : null;
      }
      if (item && typeof item === 'object') {
        const url = String(item.image_url || item.url || '').trim();
        return url ? {
          id: item.id || null,
          image_url: url,
          storage_path: item.storage_path || url,
          alt_text: item.alt_text ? String(item.alt_text).trim() : '',
        } : null;
      }
      return null;
    }).filter(Boolean);
  } else if (typeof imagesInput === 'string' && imagesInput.trim()) {
    try {
      const parsed = JSON.parse(imagesInput);
      return syncProductImages(productId, parsed);
    } catch (_) {
      normalizedList = [{ image_url: imagesInput.trim(), storage_path: imagesInput.trim(), alt_text: '' }];
    }
  }

  // Obtener imágenes actuales en base de datos
  const currentRes = await query('SELECT id, image_url, storage_path FROM product_images WHERE product_id = $1', [productId]);
  const currentImages = currentRes.rows || [];

  const newUrlsSet = new Set(normalizedList.map((item) => item.image_url));

  // 1. Detectar y eliminar del disco y de la BD las imágenes removidas
  for (const curr of currentImages) {
    if (!newUrlsSet.has(curr.image_url)) {
      try {
        deleteObjectByPublicUrl(curr.image_url);
      } catch (delErr) {
        console.warn('[productImagesService] error eliminando archivo físico:', delErr.message);
      }
      await query('DELETE FROM product_images WHERE id = $1', [curr.id]);
    }
  }

  // 2. Eliminar todas las asociaciones previas para insertar la secuencia en orden exacto
  await query('DELETE FROM product_images WHERE product_id = $1', [productId]);

  const finalSaved = [];
  for (let idx = 0; idx < normalizedList.length; idx++) {
    const item = normalizedList[idx];
    const insRes = await query(
      'INSERT INTO product_images (product_id, image_url, storage_path, alt_text, position) VALUES ($1, $2, $3, $4, $5) RETURNING id, product_id, image_url, storage_path, alt_text, position, created_at, updated_at',
      [productId, item.image_url, item.storage_path || item.image_url, item.alt_text || '', idx]
    );
    if (insRes.rows[0]) {
      finalSaved.push(insRes.rows[0]);
    }
  }

  // 3. Sincronizar columnas de caché en la tabla products
  const primaryUrl = finalSaved[0]?.image_url || null;
  const urlsJson = JSON.stringify(finalSaved.map((img) => img.image_url));
  await query(
    'UPDATE products SET image_url = $1, images = $2::jsonb, updated_at = now() WHERE id = $3',
    [primaryUrl, urlsJson, productId]
  );

  return finalSaved;
}

/**
 * Agrega imágenes adicionales a un producto existente al final de la galería.
 * @param {string} productId
 * @param {Array<string|object>} newImages
 * @returns {Promise<Array<object>>}
 */
async function addProductImages(productId, newImages) {
  const current = await getProductImages(productId);
  const combined = [...current, ...(Array.isArray(newImages) ? newImages : [newImages])];
  return syncProductImages(productId, combined);
}

/**
 * Elimina una imagen específica por su ID o por su URL.
 * @param {string} productId
 * @param {string} imageIdOrUrl
 * @returns {Promise<{ok: boolean, remaining: Array<object>}>}
 */
async function deleteProductImage(productId, imageIdOrUrl) {
  if (!productId || !imageIdOrUrl) return { ok: false, remaining: [] };

  const current = await getProductImages(productId);
  const toDelete = current.find((img) => img.id === imageIdOrUrl || img.image_url === imageIdOrUrl);

  if (toDelete) {
    try {
      deleteObjectByPublicUrl(toDelete.image_url);
    } catch (delErr) {
      console.warn('[productImagesService] error eliminando archivo:', delErr.message);
    }
    await query('DELETE FROM product_images WHERE id = $1', [toDelete.id]);
  }

  const remaining = current.filter((img) => img.id !== imageIdOrUrl && img.image_url !== imageIdOrUrl);
  return { ok: true, remaining: await syncProductImages(productId, remaining) };
}

/**
 * Reordena las imágenes de un producto según una lista de IDs o URLs.
 * @param {string} productId
 * @param {Array<string>} orderedIdsOrUrls
 * @returns {Promise<Array<object>>}
 */
async function reorderProductImages(productId, orderedIdsOrUrls) {
  if (!productId || !Array.isArray(orderedIdsOrUrls)) return [];
  const current = await getProductImages(productId);
  const byId = new Map(current.map((img) => [img.id, img]));
  const byUrl = new Map(current.map((img) => [img.image_url, img]));

  const reordered = [];
  const seen = new Set();

  for (const ref of orderedIdsOrUrls) {
    const found = byId.get(ref) || byUrl.get(ref);
    if (found && !seen.has(found.id)) {
      seen.add(found.id);
      reordered.push(found);
    }
  }

  // Agregar cualquier imagen restante que no haya estado en la lista
  for (const img of current) {
    if (!seen.has(img.id)) {
      seen.add(img.id);
      reordered.push(img);
    }
  }

  return syncProductImages(productId, reordered);
}

/**
 * Elimina todos los archivos e imágenes asociadas a un producto cuando este se elimina.
 * @param {string} productId
 */
async function deleteProductImagesForProduct(productId) {
  if (!productId) return;
  try {
    const res = await query('SELECT image_url FROM product_images WHERE product_id = $1', [productId]);
    const images = res.rows || [];
    for (const img of images) {
      try {
        deleteObjectByPublicUrl(img.image_url);
      } catch (_) {}
    }
    // También verificar si products tenía alguna imagen fuera de product_images
    const prodRes = await query('SELECT image_url, images FROM products WHERE id = $1', [productId]);
    if (prodRes.rows[0]) {
      const p = prodRes.rows[0];
      if (p.image_url) deleteObjectByPublicUrl(p.image_url);
      if (Array.isArray(p.images)) {
        p.images.forEach((u) => deleteObjectByPublicUrl(u));
      }
    }
    // Eliminar registros de la base de datos
    await query('DELETE FROM product_images WHERE product_id = $1', [productId]);
  } catch (err) {
    console.warn('[productImagesService] error eliminando imágenes del producto:', err.message);
  }
}

module.exports = {
  getProductImages,
  syncProductImages,
  addProductImages,
  deleteProductImage,
  reorderProductImages,
  deleteProductImagesForProduct,
};
