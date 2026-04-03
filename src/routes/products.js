const express = require('express');
const router = express.Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/productController');

router.get('/',         optionalAuth, ctrl.listProducts);
router.get('/my',       requireAuth,  ctrl.myProducts);
router.get('/:id',      optionalAuth, ctrl.getProduct);
router.post('/',        requireAuth,  ctrl.createProduct);
router.patch('/:id',    requireAuth,  ctrl.updateProduct);
router.delete('/:id',   requireAuth,  ctrl.deleteProduct);

module.exports = router;
