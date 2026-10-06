const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directories exist
const uploadDir = path.join(__dirname, '..', 'uploads', 'variants');
const brandUploadDir = path.join(__dirname, '..', 'uploads', 'brands');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(brandUploadDir)) fs.mkdirSync(brandUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // variant_<id>_<timestamp>.<ext>  e.g. variant_3_1727216400000.jpg
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `variant_${req.params.id}_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpg, .jpeg, .png, .webp files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// ── Brand logo upload config ────────────────────────────
const brandStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, brandUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `brand_${req.params.id}_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const uploadBrandLogo = multer({
  storage: brandStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = { upload, uploadBrandLogo };
