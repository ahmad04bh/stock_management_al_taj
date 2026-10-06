const pool = require('../db');

// GET /api/categories — list all categories
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/categories/:id — get one category
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/categories — create a category
exports.create = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    const [result] = await pool.query('INSERT INTO categories (name) VALUES (?)', [name.trim()]);
    res.status(201).json({ success: true, data: { id: result.insertId, name: name.trim() } });
  } catch (err) {
    // Duplicate entry (UNIQUE constraint on name)
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Category name already exists' });
    }
    next(err);
  }
};

// PUT /api/categories/:id — update a category
exports.update = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    const [result] = await pool.query('UPDATE categories SET name = ? WHERE id = ?', [name.trim(), req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    res.json({ success: true, data: { id: Number(req.params.id), name: name.trim() } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Category name already exists' });
    }
    next(err);
  }
};

// DELETE /api/categories/:id — delete a category (only if no products reference it)
exports.remove = async (req, res, next) => {
  try {
    // Check if any products use this category
    const [products] = await pool.query('SELECT COUNT(*) AS count FROM products WHERE category_id = ?', [req.params.id]);
    if (products[0].count > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete: ${products[0].count} product(s) still use this category`,
      });
    }
    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
};
