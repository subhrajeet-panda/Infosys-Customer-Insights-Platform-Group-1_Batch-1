const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, attachVendor, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  listProducts, listCategories, listMyProducts, createProduct, updateProduct, deleteProduct, logView,
} = require('../controllers/productController');

router.get('/', listProducts);
router.get('/categories', listCategories);
router.post('/:id/view', optionalAuth, logView);

router.get('/mine', requireAuth, requireRole('vendor'), attachVendor, listMyProducts);
router.post('/', requireAuth, requireRole('vendor'), attachVendor, upload.single('image'), createProduct);
router.put('/:id', requireAuth, requireRole('vendor'), attachVendor, upload.single('image'), updateProduct);
router.delete('/:id', requireAuth, requireRole('vendor'), attachVendor, deleteProduct);

module.exports = router;
