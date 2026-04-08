const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/userController');

router.get('/',           ctrl.listUsers);
router.get('/me',              requireAuth, ctrl.getMe);
router.post('/profile',        requireAuth, ctrl.upsertProfile);
router.patch('/me',            requireAuth, ctrl.updateMe);
router.patch('/me/location',   requireAuth, ctrl.updateLocation);
router.get('/:id',        ctrl.getUser);
router.get('/:id/reviews', ctrl.getUserReviews);
router.post('/:id/report', requireAuth, ctrl.reportUser);

module.exports = router;
