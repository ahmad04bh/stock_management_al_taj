const pool = require('../db');
const path = require('path');
const fs = require('fs');

// GET /api/brands — list all brands
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM brands ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/brands/:id — get one brand
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM brands WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/brands — create a brand
exports.create = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    const [result] = await pool.query('INSERT INTO brands (name) VALUES (?)', [name.trim()]);
    const [created] = await pool.query('SELECT * FROM brands WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Brand name already exists' });
    }
    next(err);
  }
};

// PUT /api/brands/:id — update a brand
exports.update = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    const [result] = await pool.query('UPDATE brands SET name = ? WHERE id = ?', [name.trim(), req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }
    const [updated] = await pool.query('SELECT * FROM brands WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Brand name already exists' });
    }
    next(err);
  }
};

// DELETE /api/brands/:id — delete (only if no products reference it)
exports.remove = async (req, res, next) => {
  try {
    const [products] = await pool.query('SELECT COUNT(*) AS count FROM products WHERE brand_id = ?', [req.params.id]);
    if (products[0].count > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete: ${products[0].count} product(s) still use this brand`,
      });
    }
    const [result] = await pool.query('DELETE FROM brands WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }
    res.json({ success: true, message: 'Brand deleted' });
  } catch (err) {
    next(err);
  }
};

// POST /api/brands/:id/logo — upload or replace brand logo
exports.uploadLogo = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const [rows] = await pool.query('SELECT id, logo_path FROM brands WHERE id = ?', [id]);
    if (rows.length === 0) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Delete old logo file if one exists
    if (rows[0].logo_path) {
      const oldPath = path.join(__dirname, '..', rows[0].logo_path);
      fs.unlink(oldPath, () => {});
    }

    const relativePath = path.join('uploads', 'brands', req.file.filename).replace(/\\/g, '/');
    await pool.query('UPDATE brands SET logo_path = ? WHERE id = ?', [relativePath, id]);

    const [updated] = await pool.query('SELECT * FROM brands WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(err);
  }
};

// DELETE /api/brands/:id/logo — remove brand logo
exports.deleteLogo = async (req, res, next) => {
  try {
    const id = req.params.id;
    const [rows] = await pool.query('SELECT id, logo_path FROM brands WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Brand not found' });
    if (!rows[0].logo_path) return res.status(404).json({ success: false, error: 'No logo to remove' });

    const filePath = path.join(__dirname, '..', rows[0].logo_path);
    fs.unlink(filePath, () => {});
    await pool.query('UPDATE brands SET logo_path = NULL WHERE id = ?', [id]);
    res.json({ success: true, message: 'Logo removed' });
  } catch (err) {
    next(err);
  }
};
