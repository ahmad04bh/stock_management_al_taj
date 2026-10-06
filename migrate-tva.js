const pool = require('./backend/db');

async function migrate() {
  try {
    console.log('Adding tva_active column...');
    await pool.query('ALTER TABLE factures_achat ADD COLUMN tva_active BOOLEAN DEFAULT TRUE AFTER amount_paid');
    await pool.query('ALTER TABLE factures_vente ADD COLUMN tva_active BOOLEAN DEFAULT TRUE AFTER amount_paid');
    console.log('Migration successful');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column already exists');
    } else {
      console.error(err);
    }
  } finally {
    process.exit();
  }
}

migrate();
