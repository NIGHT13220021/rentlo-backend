const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/chatController');

router.get('/conversations',    requireAuth, ctrl.getConversations);
router.get('/unread-count',     requireAuth, ctrl.getUnreadCount);
router.get('/:otherUserId',     requireAuth, ctrl.getMessages);
router.post('/:otherUserId',    requireAuth, ctrl.sendMessage);

module.exports = router;
