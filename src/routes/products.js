const express = require('express');
const router  = express.Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requireVerifiedPhone }      = require('../middleware/verifiedPhone');
const { postListingLimiter }        = require('../middleware/rateLimit');
const ctrl = require('../controllers/productController');

router.get('/',         optionalAuth, ctrl.listProducts);
router.get('/my',       requireAuth,  ctrl.myProducts);
router.get('/:id',      optionalAuth, ctrl.getProduct);
router.post('/',        requireAuth, requireVerifiedPhone, postListingLimiter, ctrl.createProduct);
router.patch('/:id',    requireAuth,  ctrl.updateProduct);
router.delete('/:id',   requireAuth,  ctrl.deleteProduct);
router.post('/:id/report', requireAuth, ctrl.reportProduct);

module.exports = router;
