const { supabase } = require('../config/supabase');
const { ok, created, fail } = require('../utils/response');

function getConversationId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// GET /chats/conversations  — list all conversations for current user
exports.getConversations = async (req, res) => {
  const userId = req.user.id;

  // Get latest message per conversation
  const { data, error } = await supabase
    .from('chats')
    .select('*, sender:sender_id(id, name, avatar_url), receiver:receiver_id(id, name, avatar_url)')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) return fail(res, error.message);

  // Deduplicate by conversation_id (keep only latest per convo)
  const seen = new Set();
  const conversations = [];
  for (const msg of data) {
    if (!seen.has(msg.conversation_id)) {
      seen.add(msg.conversation_id);
      conversations.push(msg);
    }
  }

  return ok(res, conversations);
};

// GET /chats/:otherUserId  — get message thread with another user
exports.getMessages = async (req, res) => {
  const { otherUserId } = req.params;
  const { limit = 50, before } = req.query;
  const conversationId = getConversationId(req.user.id, otherUserId);

  let query = supabase
    .from('chats')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(Number(limit));

  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) return fail(res, error.message);

  // Mark received messages as read
  supabase
    .from('chats')
    .update({ is_read: true })
    .eq('receiver_id', req.user.id)
    .eq('conversation_id', conversationId)
    .eq('is_read', false)
    .then(() => {});

  return ok(res, data.reverse()); // chronological order
};

// POST /chats/:otherUserId  — send a message
exports.sendMessage = async (req, res) => {
  const { otherUserId } = req.params;
  const { message, message_type = 'text', reference_id, reference_type } = req.body;

  if (!message) return fail(res, 'message is required');
  if (otherUserId === req.user.id) return fail(res, 'Cannot message yourself');

  const conversationId = getConversationId(req.user.id, otherUserId);

  // Check message credits (free tier)
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('message_credits, plan_type')
    .eq('user_id', req.user.id)
    .single();

  if (sub && sub.message_credits <= 0 && sub.plan_type === 'free') {
    return fail(res, 'Daily message limit reached. Upgrade for unlimited messaging.', 403);
  }

  const { data, error } = await supabase
    .from('chats')
    .insert({
      conversation_id: conversationId,
      sender_id: req.user.id,
      receiver_id: otherUserId,
      message,
      message_type,
      reference_id,
      reference_type,
    })
    .select()
    .single();

  if (error) return fail(res, error.message);

  // Deduct message credit for free tier
  if (sub && sub.plan_type === 'free' && sub.message_credits > 0) {
    await supabase
      .from('subscriptions')
      .update({ message_credits: sub.message_credits - 1 })
      .eq('user_id', req.user.id);
  }

  return created(res, data, 'Message sent');
};

// GET /chats/unread-count
exports.getUnreadCount = async (req, res) => {
  const { count, error } = await supabase
    .from('chats')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', req.user.id)
    .eq('is_read', false);

  if (error) return fail(res, error.message);
  return ok(res, { unread_count: count });
};
