const pool = require('../db');

// GET /api/clients — list all (optionally filter by is_active)
exports.getAll = async (req, res, next) => {
  try {
    let sql = 'SELECT * FROM clients';
    const params = [];

    // ?active=true or ?active=false
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

// GET /api/clients/:id — get one client
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/clients — create a client
exports.create = async (req, res, next) => {
  try {
    const { name, phone, address, matricule_fiscal } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO clients (name, phone, address, matricule_fiscal)
       VALUES (?, ?, ?, ?)`,
      [name.trim(), phone || null, address || null, matricule_fiscal || null]
    );

    const [created] = await pool.query('SELECT * FROM clients WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: created[0] });
  } catch (err) {
    next(err);
  }
};

// PUT /api/clients/:id — update a client
exports.update = async (req, res, next) => {
  try {
    const { name, phone, address, matricule_fiscal, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const [result] = await pool.query(
      `UPDATE clients SET name = ?, phone = ?, address = ?, matricule_fiscal = ?,
       is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name.trim(), phone || null, address || null, matricule_fiscal || null,
       is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const [updated] = await pool.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/clients/:id — soft-delete (set is_active = false)
exports.remove = async (req, res, next) => {
  try {
    const [result] = await pool.query(
      'UPDATE clients SET is_active = FALSE WHERE id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }
    res.json({ success: true, message: 'Client deactivated' });
  } catch (err) {
    next(err);
  }
};
