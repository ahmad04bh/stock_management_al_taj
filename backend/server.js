const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = 3000;

// ── Middleware ───────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Frontend Static Files ────────────────────────────────
const frontendDist = path.join(__dirname, '../web/dist');
app.use(express.static(frontendDist));

app.get('/api/db-test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    res.json({ success: true, result: rows[0].result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── API Routes ──────────────────────────────────────────
app.use('/api/categories', require('./routes/categories'));
app.use('/api/brands', require('./routes/brands'));
app.use('/api/products', require('./routes/products'));
app.use('/api/products/:productId/variants', require('./routes/productVariants'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/fournisseurs', require('./routes/fournisseurs'));
app.use('/api/factures-vente', require('./routes/facturesVente'));
app.use('/api/factures-achat', require('./routes/facturesAchat'));

// ── SPA Fallback (Serve React Frontend for any other GET page) ──
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  const indexPath = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).send('Frontend not built. Please run "npm run build" in web directory.');
});

// ── Global Error Handler (must be last) ─────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});