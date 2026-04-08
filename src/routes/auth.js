const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/authController');
const { otpSendLimiter } = require('../middleware/rateLimit');

router.post('/send-otp',   otpSendLimiter, ctrl.sendOtp);
router.post('/verify-otp', ctrl.verifyOtp);

module.exports = router;
