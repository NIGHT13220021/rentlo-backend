const express = require('express');
const router = express.Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/requestController');

router.get('/',         optionalAuth, ctrl.listRequests);
router.get('/my',       requireAuth,  ctrl.myRequests);
router.get('/:id',      optionalAuth, ctrl.getRequest);
router.post('/',        requireAuth,  ctrl.createRequest);
router.patch('/:id',    requireAuth,  ctrl.updateRequest);
router.delete('/:id',   requireAuth,  ctrl.deleteRequest);

module.exports = router;
