const express = require('express');
const router = express.Router({ mergeParams: true }); // access :productId from parent
const ctrl = require('../controllers/productVariantsController');
const { upload } = require('../middleware/upload');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

// Photo upload/delete — scoped to a specific variant
router.post('/:id/photo', upload.single('photo'), ctrl.uploadPhoto);
router.delete('/:id/photo', ctrl.deletePhoto);

module.exports = router;
