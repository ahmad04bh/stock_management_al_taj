const pool = require('../db');

// GET /api/products — list all products (with category + brand names)
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS category_name, b.name AS brand_name
       FROM products p
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       ORDER BY p.name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:id — get one product (with its variants)
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS category_name, b.name AS brand_name
       FROM products p
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Also fetch variants for this product
    const [variants] = await pool.query(
      'SELECT * FROM product_variants WHERE product_id = ? ORDER BY id',
      [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], variants } });
  } catch (err) {
    next(err);
  }
};

// POST /api/products — create a product
exports.create = async (req, res, next) => {
  try {
    const { name, category_id, brand_id, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    if (!category_id) {
      return res.status(400).json({ success: false, error: 'category_id is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO products (name, category_id, brand_id, description)
       VALUES (?, ?, ?, ?)`,
      [name.trim(), category_id, brand_id || null, description || null]
    );

    const [created] = await pool.query(
      `SELECT p.*, c.name AS category_name, b.name AS brand_name
       FROM products p
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, error: 'Invalid category_id or brand_id' });
    }
    next(err);
  }
};

// PUT /api/products/:id — update a product
exports.update = async (req, res, next) => {
  try {
    const { name, category_id, brand_id, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    if (!category_id) {
      return res.status(400).json({ success: false, error: 'category_id is required' });
    }

    const [result] = await pool.query(
      `UPDATE products SET name = ?, category_id = ?, brand_id = ?, description = ?
       WHERE id = ?`,
      [name.trim(), category_id, brand_id || null, description || null, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const [updated] = await pool.query(
      `SELECT p.*, c.name AS category_name, b.name AS brand_name
       FROM products p
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.id = ?`,
      [req.params.id]
    );

    res.json({ success: true, data: updated[0] });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, error: 'Invalid category_id or brand_id' });
    }
    next(err);
  }
};

// DELETE /api/products/:id — delete (cascades to variants, but blocked if variants are in invoices)
exports.remove = async (req, res, next) => {
  try {
    const id = req.params.id;

    // Check if any variants of this product are referenced in invoice lines
    const [salesLines] = await pool.query(
      `SELECT COUNT(*) AS count FROM facture_vente_lignes fvl
       JOIN product_variants pv ON fvl.variant_id = pv.id
       WHERE pv.product_id = ?`, [id]
    );
    const [purchaseLines] = await pool.query(
      `SELECT COUNT(*) AS count FROM facture_achat_lignes fal
       JOIN product_variants pv ON fal.variant_id = pv.id
       WHERE pv.product_id = ?`, [id]
    );

    const total = salesLines[0].count + purchaseLines[0].count;
    if (total > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete: product variants are referenced in ${total} invoice line(s)`,
      });
    }

    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, message: 'Product and its variants deleted' });
  } catch (err) {
    next(err);
  }
};
