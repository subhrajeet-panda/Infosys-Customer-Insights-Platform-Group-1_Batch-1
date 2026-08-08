const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  listVendors, updateVendorStatus, updateCommission, platformAnalytics,
} = require('../controllers/adminController');

router.use(requireAuth, requireRole('admin'));

router.get('/vendors', listVendors);
router.patch('/vendors/:id/status', updateVendorStatus);
router.patch('/vendors/:id/commission', updateCommission);
router.get('/analytics', platformAnalytics);

module.exports = router;
