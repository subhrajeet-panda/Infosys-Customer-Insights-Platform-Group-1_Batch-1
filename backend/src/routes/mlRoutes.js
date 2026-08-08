const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { runModel, runAll, getResult, getMyRecommendations } = require('../controllers/mlController');

router.get('/recommendations/mine', requireAuth, requireRole('customer'), getMyRecommendations);

router.get('/run-all', requireAuth, requireRole('admin'), runAll);
router.post('/run-all', requireAuth, requireRole('admin'), runAll);
router.post('/run/:model', requireAuth, requireRole('admin', 'vendor'), runModel);
router.get('/:model', requireAuth, requireRole('admin', 'vendor'), getResult);

module.exports = router;
