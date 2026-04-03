const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/subscriptionController');

router.get('/plans',          ctrl.getPlans);
router.get('/me',             requireAuth, ctrl.getMySubscription);
router.post('/upgrade',       requireAuth, ctrl.upgradePlan);
router.post('/reset-credits', requireAuth, ctrl.resetCredits);

module.exports = router;
