const express = require('express');
const router = express.Router();

router.use('/auth',          require('./auth'));
router.use('/users',         require('./users'));
router.use('/products',      require('./products'));
router.use('/requests',      require('./requests'));
router.use('/applications',  require('./applications'));
router.use('/chats',         require('./chats'));
router.use('/subscriptions', require('./subscriptions'));
router.use('/reviews',       require('./reviews'));

module.exports = router;
