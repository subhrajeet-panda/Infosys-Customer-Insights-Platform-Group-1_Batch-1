const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, attachVendor } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getMyProfile, updateMyProfile, uploadLogo, listApprovedVendors, getVendorPublic,
} = require('../controllers/vendorController');

router.get('/', listApprovedVendors);
router.get('/:id', getVendorPublic);

router.get('/me/profile', requireAuth, requireRole('vendor'), attachVendor, getMyProfile);
router.put('/me/profile', requireAuth, requireRole('vendor'), attachVendor, updateMyProfile);
router.post('/me/logo', requireAuth, requireRole('vendor'), attachVendor, upload.single('logo'), uploadLogo);

module.exports = router;
