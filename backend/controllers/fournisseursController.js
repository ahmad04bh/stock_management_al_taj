const pool = require('../db');

// GET /api/fournisseurs — list all (optionally filter by is_active)
exports.getAll = async (req, res, next) => {
  try {
    let sql = 'SELECT * FROM fournisseurs';
    const params = [];

    if (req.query.active !== undefined) {
      sql += ' WHERE is_active = ?';
      params.push(req.query.active === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY name';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/fournisseurs/:id — get one fournisseur
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM fournisseurs WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fournisseur not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/fournisseurs — create a fournisseur
exports.create = async (req, res, next) => {
  try {
    const { name, phone, address, matricule_fiscal } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO fournisseurs (name, phone, address, matricule_fiscal)
       VALUES (?, ?, ?, ?)`,
      [name.trim(), phone || null, address || null, matricule_fiscal || null]
    );

    const [created] = await pool.query('SELECT * FROM fournisseurs WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    next(err);
  }
};

// PUT /api/fournisseurs/:id — update a fournisseur
exports.update = async (req, res, next) => {
  try {
    const { name, phone, address, matricule_fiscal, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const [result] = await pool.query(
      `UPDATE fournisseurs SET name = ?, phone = ?, address = ?, matricule_fiscal = ?,
       is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name.trim(), phone || null, address || null, matricule_fiscal || null,
       is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Fournisseur not found' });
    }

    const [updated] = await pool.query('SELECT * FROM fournisseurs WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/fournisseurs/:id — soft-delete (set is_active = false)
exports.remove = async (req, res, next) => {
  try {
    const [result] = await pool.query(
      'UPDATE fournisseurs SET is_active = FALSE WHERE id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Fournisseur not found' });
    }
    res.json({ success: true, message: 'Fournisseur deactivated' });
  } catch (err) {
    next(err);
  }
};
