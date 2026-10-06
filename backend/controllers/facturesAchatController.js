const pool = require('../db');

// ─── POST /api/factures-achat — Create a purchase invoice ───────────
exports.create = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { fournisseur_id, payment_status, amount_paid, lines, tva_active } = req.body;
    const isTvaActive = tva_active !== false;

    if (!fournisseur_id) return res.status(400).json({ success: false, error: 'fournisseur_id is required' });
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one line is required' });
    }

    await conn.beginTransaction();

    // Process each line — NO stock check needed (purchases add stock)
    const processedLines = [];
    for (const line of lines) {
      if (!line.variant_id || !line.quantity || line.quantity <= 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, error: 'Each line needs variant_id and quantity > 0' });
      }

      const [variants] = await conn.query(
        'SELECT id, purchase_price_ht, tax_rate FROM product_variants WHERE id = ? FOR UPDATE',
        [line.variant_id]
      );
      if (variants.length === 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, error: `Variant ${line.variant_id} not found` });
      }

      const variant = variants[0];
      const unit_price_ht = line.unit_price_ht !== undefined ? Number(line.unit_price_ht) : Number(variant.purchase_price_ht);
      const tax_rate = isTvaActive ? Number(variant.tax_rate) : 0;
      const line_total_ht = line.quantity * unit_price_ht;
      const line_total_ttc = line_total_ht * (1 + tax_rate / 100);

      processedLines.push({
        variant_id: line.variant_id,
        quantity: line.quantity,
        unit_price_ht,
        tax_rate,
        line_total_ht: Math.round(line_total_ht * 100) / 100,
        line_total_ttc: Math.round(line_total_ttc * 100) / 100,
      });
    }

    // Calculate header totals
    const total_ht = processedLines.reduce((sum, l) => sum + l.line_total_ht, 0);
    const total_ttc = processedLines.reduce((sum, l) => sum + l.line_total_ttc, 0);
    const total_tax = Math.round((total_ttc - total_ht) * 100) / 100;

    // Insert invoice header
    const [headerResult] = await conn.query(
      `INSERT INTO factures_achat (fournisseur_id, total_ht, total_tax, total_ttc, payment_status, amount_paid, tva_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [fournisseur_id, total_ht, total_tax, total_ttc, payment_status || 'unpaid', amount_paid || 0, isTvaActive]
    );
    const factureId = headerResult.insertId;

    // Insert lines and INCREMENT stock
    for (const pl of processedLines) {
      await conn.query(
        `INSERT INTO facture_achat_lignes (facture_id, variant_id, quantity, unit_price_ht, tax_rate, line_total_ht, line_total_ttc)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [factureId, pl.variant_id, pl.quantity, pl.unit_price_ht, pl.tax_rate, pl.line_total_ht, pl.line_total_ttc]
      );
      await conn.query(
        'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
        [pl.quantity, pl.variant_id]
      );
    }

    await conn.commit();

    const invoice = await getFullInvoice(factureId);
    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, error: 'Invalid fournisseur_id' });
    }
    next(err);
  } finally {
    conn.release();
  }
};

// ─── GET /api/factures-achat — List all purchase invoices ───────────
exports.getAll = async (req, res, next) => {
  try {
    let sql = `SELECT fa.*, f.name AS fournisseur_name
               FROM factures_achat fa
               JOIN fournisseurs f ON fa.fournisseur_id = f.id`;
    const conditions = [];
    const params = [];

    if (req.query.fournisseur_id) {
      conditions.push('fa.fournisseur_id = ?');
      params.push(req.query.fournisseur_id);
    }
    if (req.query.payment_status) {
      conditions.push('fa.payment_status = ?');
      params.push(req.query.payment_status);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY fa.date DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/factures-achat/:id — Get one invoice with lines ───────
exports.getOne = async (req, res, next) => {
  try {
    const invoice = await getFullInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/factures-achat/:id — Full edit (restore → re-apply) ───
exports.update = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { fournisseur_id, payment_status, amount_paid, lines, tva_active } = req.body;
    const isTvaActive = tva_active !== false;
    const factureId = req.params.id;

    await conn.beginTransaction();

    // Verify invoice exists
    const [existing] = await conn.query('SELECT id, fournisseur_id FROM factures_achat WHERE id = ? FOR UPDATE', [factureId]);
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Fetch existing lines and REVERSE stock (decrease, since purchase originally increased)
    const [oldLines] = await conn.query('SELECT variant_id, quantity FROM facture_achat_lignes WHERE facture_id = ?', [factureId]);

    // Before reversing, check that no variant would go below zero
    for (const ol of oldLines) {
      const [variants] = await conn.query(
        'SELECT stock_quantity FROM product_variants WHERE id = ? FOR UPDATE',
        [ol.variant_id]
      );
      if (variants.length > 0 && variants[0].stock_quantity < ol.quantity) {
        await conn.rollback();
        return res.status(409).json({
          success: false,
          error: `Cannot edit: reversing variant ${ol.variant_id} would cause negative stock (current: ${variants[0].stock_quantity}, need to remove: ${ol.quantity})`,
        });
      }
    }

    for (const ol of oldLines) {
      await conn.query(
        'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [ol.quantity, ol.variant_id]
      );
    }

    // Delete old lines
    await conn.query('DELETE FROM facture_achat_lignes WHERE facture_id = ?', [factureId]);

    // If new lines are provided, insert them and increment stock
    if (lines && Array.isArray(lines) && lines.length > 0) {
      const processedLines = [];
      for (const line of lines) {
        if (!line.variant_id || !line.quantity || line.quantity <= 0) {
          await conn.rollback();
          return res.status(400).json({ success: false, error: 'Each line needs variant_id and quantity > 0' });
        }

        const [variants] = await conn.query(
          'SELECT id, purchase_price_ht, tax_rate FROM product_variants WHERE id = ? FOR UPDATE',
          [line.variant_id]
        );
        if (variants.length === 0) {
          await conn.rollback();
          return res.status(400).json({ success: false, error: `Variant ${line.variant_id} not found` });
        }

        const variant = variants[0];
        const unit_price_ht = line.unit_price_ht !== undefined ? Number(line.unit_price_ht) : Number(variant.purchase_price_ht);
        const tax_rate = isTvaActive ? Number(variant.tax_rate) : 0;
        const line_total_ht = line.quantity * unit_price_ht;
        const line_total_ttc = line_total_ht * (1 + tax_rate / 100);

        processedLines.push({
          variant_id: line.variant_id,
          quantity: line.quantity,
          unit_price_ht,
          tax_rate,
          line_total_ht: Math.round(line_total_ht * 100) / 100,
          line_total_ttc: Math.round(line_total_ttc * 100) / 100,
        });
      }

      const total_ht = processedLines.reduce((sum, l) => sum + l.line_total_ht, 0);
      const total_ttc = processedLines.reduce((sum, l) => sum + l.line_total_ttc, 0);
      const total_tax = Math.round((total_ttc - total_ht) * 100) / 100;

      for (const pl of processedLines) {
        await conn.query(
          `INSERT INTO facture_achat_lignes (facture_id, variant_id, quantity, unit_price_ht, tax_rate, line_total_ht, line_total_ttc)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [factureId, pl.variant_id, pl.quantity, pl.unit_price_ht, pl.tax_rate, pl.line_total_ht, pl.line_total_ttc]
        );
        await conn.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
          [pl.quantity, pl.variant_id]
        );
      }

      await conn.query(
        `UPDATE factures_achat SET fournisseur_id = ?, total_ht = ?, total_tax = ?, total_ttc = ?,
         payment_status = ?, amount_paid = ?, tva_active = ? WHERE id = ?`,
        [fournisseur_id || existing[0].fournisseur_id, total_ht, total_tax, total_ttc,
         payment_status || 'unpaid', amount_paid || 0, isTvaActive, factureId]
      );
    } else {
      await conn.query(
        `UPDATE factures_achat SET fournisseur_id = COALESCE(?, fournisseur_id),
         payment_status = COALESCE(?, payment_status), amount_paid = COALESCE(?, amount_paid),
         tva_active = COALESCE(?, tva_active)
         WHERE id = ?`,
        [fournisseur_id || null, payment_status || null, amount_paid !== undefined ? amount_paid : null,
         tva_active !== undefined ? tva_active : null, factureId]
      );
    }

    await conn.commit();

    const invoice = await getFullInvoice(factureId);
    res.json({ success: true, data: invoice });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ─── DELETE /api/factures-achat/:id — Delete and reverse stock ──────
exports.remove = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const factureId = req.params.id;

    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM factures_achat WHERE id = ? FOR UPDATE', [factureId]);
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Check that reversing stock won't go negative for any variant
    const [lines] = await conn.query('SELECT variant_id, quantity FROM facture_achat_lignes WHERE facture_id = ?', [factureId]);
    for (const line of lines) {
      const [variants] = await conn.query(
        'SELECT stock_quantity FROM product_variants WHERE id = ? FOR UPDATE',
        [line.variant_id]
      );
      if (variants.length > 0 && variants[0].stock_quantity < line.quantity) {
        await conn.rollback();
        return res.status(409).json({
          success: false,
          error: `Cannot delete: variant ${line.variant_id} stock would go negative (current: ${variants[0].stock_quantity}, would remove: ${line.quantity})`,
        });
      }
    }

    // Decrease stock (reverse the purchase)
    for (const line of lines) {
      await conn.query(
        'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [line.quantity, line.variant_id]
      );
    }

    // Delete invoice (lines cascade)
    await conn.query('DELETE FROM factures_achat WHERE id = ?', [factureId]);

    await conn.commit();
    res.json({ success: true, message: 'Purchase invoice deleted, stock reversed' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ─── Helper: fetch full invoice with nested lines ───────────────────
async function getFullInvoice(factureId) {
  const [headers] = await pool.query(
    `SELECT fa.*, f.name AS fournisseur_name
     FROM factures_achat fa
     JOIN fournisseurs f ON fa.fournisseur_id = f.id
     WHERE fa.id = ?`,
    [factureId]
  );
  if (headers.length === 0) return null;

  const [lines] = await pool.query(
    `SELECT fal.*, p.name AS product_name, pv.size_value, pv.size_unit
     FROM facture_achat_lignes fal
     JOIN product_variants pv ON fal.variant_id = pv.id
     JOIN products p ON pv.product_id = p.id
     WHERE fal.facture_id = ?
     ORDER BY fal.id`,
    [factureId]
  );

  return { ...headers[0], lines };
}
