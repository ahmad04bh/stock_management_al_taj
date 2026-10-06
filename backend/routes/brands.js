const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/brandsController');
const { uploadBrandLogo } = require('../middleware/upload');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

// Brand logo upload/delete
router.post('/:id/logo', uploadBrandLogo.single('logo'), ctrl.uploadLogo);
router.delete('/:id/logo', ctrl.deleteLogo);

module.exports = router;
