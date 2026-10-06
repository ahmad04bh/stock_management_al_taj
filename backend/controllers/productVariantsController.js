const pool = require('../db');
const path = require('path');
const fs = require('fs');

// GET /api/products/:productId/variants — list all variants for a product
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM product_variants WHERE product_id = ? ORDER BY id',
      [req.params.productId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:productId/variants/:id — get one variant
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM product_variants WHERE id = ? AND product_id = ?',
      [req.params.id, req.params.productId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Variant not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/products/:productId/variants — create a variant
exports.create = async (req, res, next) => {
  try {
    const { size_value, size_unit, purchase_price_ht, selling_price_ht, tax_rate, stock_quantity, photo_path } = req.body;
    const product_id = req.params.productId;

    // Verify the product exists
    const [product] = await pool.query('SELECT id FROM products WHERE id = ?', [product_id]);
    if (product.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const [result] = await pool.query(
      `INSERT INTO product_variants
       (product_id, size_value, size_unit, purchase_price_ht, selling_price_ht, tax_rate, stock_quantity, photo_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product_id,
        size_value || null,
        size_unit || null,
        purchase_price_ht || 0,
        selling_price_ht || 0,
        tax_rate !== undefined ? tax_rate : 19.00,
        stock_quantity || 0,
        photo_path || null,
      ]
    );

    const [created] = await pool.query('SELECT * FROM product_variants WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    next(err);
  }
};

// PUT /api/products/:productId/variants/:id — update a variant
exports.update = async (req, res, next) => {
  try {
    const { size_value, size_unit, purchase_price_ht, selling_price_ht, tax_rate, stock_quantity, photo_path } = req.body;

    const [result] = await pool.query(
      `UPDATE product_variants
       SET size_value = ?, size_unit = ?, purchase_price_ht = ?, selling_price_ht = ?,
           tax_rate = ?, stock_quantity = ?, photo_path = ?
       WHERE id = ? AND product_id = ?`,
      [
        size_value || null,
        size_unit || null,
        purchase_price_ht || 0,
        selling_price_ht || 0,
        tax_rate !== undefined ? tax_rate : 19.00,
        stock_quantity || 0,
        photo_path || null,
        req.params.id,
        req.params.productId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Variant not found' });
    }

    const [updated] = await pool.query('SELECT * FROM product_variants WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/products/:productId/variants/:id — delete (only if not in any invoice line)
exports.remove = async (req, res, next) => {
  try {
    const id = req.params.id;

    const [salesLines] = await pool.query(
      'SELECT COUNT(*) AS count FROM facture_vente_lignes WHERE variant_id = ?', [id]
    );
    const [purchaseLines] = await pool.query(
      'SELECT COUNT(*) AS count FROM facture_achat_lignes WHERE variant_id = ?', [id]
    );

    const total = salesLines[0].count + purchaseLines[0].count;
    if (total > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete: variant is referenced in ${total} invoice line(s)`,
      });
    }

    const [result] = await pool.query(
      'DELETE FROM product_variants WHERE id = ? AND product_id = ?',
      [id, req.params.productId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Variant not found' });
    }
    res.json({ success: true, message: 'Variant deleted' });
  } catch (err) {
    next(err);
  }
};

// POST /api/products/:productId/variants/:id/photo — upload or replace a variant photo
exports.uploadPhoto = async (req, res, next) => {
  try {
    const id = req.params.id;

    // Verify variant belongs to this product
    const [rows] = await pool.query(
      'SELECT id, photo_path FROM product_variants WHERE id = ? AND product_id = ?',
      [id, req.params.productId]
    );
    if (rows.length === 0) {
      // multer already saved the file — clean it up before returning 404
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ success: false, error: 'Variant not found' });
    }

    // Delete old photo file from disk if one exists
    if (rows[0].photo_path) {
      const oldPath = path.join(__dirname, '..', rows[0].photo_path);
      fs.unlink(oldPath, () => {}); // silent — file may have been manually removed
    }

    // Store relative path (e.g. uploads/variants/variant_3_....jpg)
    const relativePath = path.join('uploads', 'variants', req.file.filename).replace(/\\/g, '/');

    await pool.query(
      'UPDATE product_variants SET photo_path = ? WHERE id = ?',
      [relativePath, id]
    );

    const [updated] = await pool.query('SELECT * FROM product_variants WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(err);
  }
};

// DELETE /api/products/:productId/variants/:id/photo — remove a variant photo
exports.deletePhoto = async (req, res, next) => {
  try {
    const id = req.params.id;

    const [rows] = await pool.query(
      'SELECT id, photo_path FROM product_variants WHERE id = ? AND product_id = ?',
      [id, req.params.productId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Variant not found' });
    }
    if (!rows[0].photo_path) {
      return res.status(404).json({ success: false, error: 'This variant has no photo' });
    }

    // Remove file from disk
    const filePath = path.join(__dirname, '..', rows[0].photo_path);
    fs.unlink(filePath, () => {});

    // Clear photo_path in DB
    await pool.query('UPDATE product_variants SET photo_path = NULL WHERE id = ?', [id]);

    res.json({ success: true, message: 'Photo removed' });
  } catch (err) {
    next(err);
  }
};
