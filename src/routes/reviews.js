const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/reviewController');

router.post('/',              requireAuth, ctrl.createReview);
router.get('/user/:userId',   ctrl.getUserReviews);
router.delete('/:id',         requireAuth, ctrl.deleteReview);

module.exports = router;
