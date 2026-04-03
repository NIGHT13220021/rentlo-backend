const { supabase } = require('../config/supabase');
const { ok, fail } = require('../utils/response');

const PLANS = {
  free:    { apply_credits: 5,    message_credits: 20,  post_credits: 3,  is_premium: false },
  basic:   { apply_credits: 30,   message_credits: 100, post_credits: 10, is_premium: false },
  premium: { apply_credits: 9999, message_credits: 9999, post_credits: 9999, is_premium: true },
};

// GET /subscriptions/me
exports.getMySubscription = async (req, res) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', req.user.id)
    .single();

  if (error) return fail(res, error.message);
  return ok(res, { ...data, plans: PLANS });
};

// GET /subscriptions/plans  — public plan listing
exports.getPlans = async (req, res) => {
  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      features: ['5 applications/month', '20 messages/day', '3 listings/month'],
      ...PLANS.free,
    },
    {
      id: 'basic',
      name: 'Basic',
      price: 99,
      features: ['30 applications/month', '100 messages/day', '10 listings/month', 'Priority listing'],
      ...PLANS.basic,
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 299,
      features: ['Unlimited applications', 'Unlimited messages', 'Unlimited listings', 'Featured badge', 'Top search placement'],
      ...PLANS.premium,
    },
  ];
  return ok(res, plans);
};

// POST /subscriptions/upgrade  — mock upgrade (no payment)
exports.upgradePlan = async (req, res) => {
  const { plan_type } = req.body;
  if (!PLANS[plan_type]) return fail(res, 'Invalid plan type');

  const planConfig = PLANS[plan_type];
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      plan_type,
      apply_credits: planConfig.apply_credits,
      message_credits: planConfig.message_credits,
      post_credits: planConfig.post_credits,
      expires_at: expiresAt.toISOString(),
    })
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error) return fail(res, error.message);

  // Update premium flag on user
  await supabase
    .from('users')
    .update({ is_premium: planConfig.is_premium })
    .eq('id', req.user.id);

  return ok(res, data, `Upgraded to ${plan_type} plan`);
};

// POST /subscriptions/reset-credits  — admin/mock: reset monthly credits
exports.resetCredits = async (req, res) => {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan_type')
    .eq('user_id', req.user.id)
    .single();

  if (!sub) return fail(res, 'Subscription not found');

  const planConfig = PLANS[sub.plan_type];

  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      apply_credits: planConfig.apply_credits,
      message_credits: planConfig.message_credits,
      post_credits: planConfig.post_credits,
    })
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error) return fail(res, error.message);
  return ok(res, data, 'Credits reset');
};
