const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, attachVendor } = require('../middleware/auth');
const { vendorAnalytics } = require('../controllers/analyticsController');

router.get('/vendor', requireAuth, requireRole('vendor'), attachVendor, vendorAnalytics);

module.exports = router;
