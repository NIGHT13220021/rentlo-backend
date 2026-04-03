const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/applicationController');

router.get('/my',                           requireAuth, ctrl.myApplications);
router.get('/request/:requestId',           requireAuth, ctrl.getRequestApplications);
router.post('/',                            requireAuth, ctrl.apply);
router.patch('/:id/accept',                 requireAuth, ctrl.acceptApplication);
router.patch('/:id/reject',                 requireAuth, ctrl.rejectApplication);
router.delete('/:id',                       requireAuth, ctrl.withdraw);

module.exports = router;
