const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, attachVendor } = require('../middleware/auth');
const {
  checkout, myOrders, cancelOrder, vendorOrders, updateOrderStatus,
} = require('../controllers/orderController');

router.post('/checkout', requireAuth, requireRole('customer'), checkout);
router.get('/mine', requireAuth, requireRole('customer'), myOrders);
router.patch('/:id/cancel', requireAuth, requireRole('customer'), cancelOrder);

router.get('/vendor', requireAuth, requireRole('vendor'), attachVendor, vendorOrders);
router.patch('/:id/status', requireAuth, requireRole('vendor'), attachVendor, updateOrderStatus);

module.exports = router;
