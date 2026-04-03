const { supabase } = require('../config/supabase');
const { ok, created, fail } = require('../utils/response');

// GET /applications/request/:requestId  — list applicants for a request (owner only)
exports.getRequestApplications = async (req, res) => {
  const { requestId } = req.params;

  // Verify ownership
  const { data: req_data } = await supabase
    .from('requests')
    .select('user_id')
    .eq('id', requestId)
    .single();

  if (!req_data) return fail(res, 'Request not found', 404);
  if (req_data.user_id !== req.user.id) return fail(res, 'Unauthorized', 403);

  const { data, error } = await supabase
    .from('applications')
    .select('*, provider:provider_id(id, name, avatar_url, rating, rating_count, city)')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });

  if (error) return fail(res, error.message);
  return ok(res, data);
};

// GET /applications/my  — provider's own applications
exports.myApplications = async (req, res) => {
  const { data, error } = await supabase
    .from('applications')
    .select('*, request:request_id(id, title, category, budget, city, status)')
    .eq('provider_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return fail(res, error.message);
  return ok(res, data);
};

// POST /applications  — apply to a request
exports.apply = async (req, res) => {
  const { request_id, message, offer_price } = req.body;
  if (!request_id) return fail(res, 'request_id is required');

  // Verify request is still open
  const { data: reqData } = await supabase
    .from('requests')
    .select('status, user_id')
    .eq('id', request_id)
    .single();

  if (!reqData) return fail(res, 'Request not found', 404);
  if (reqData.status !== 'open') return fail(res, 'This request is no longer open');
  if (reqData.user_id === req.user.id) return fail(res, 'Cannot apply to your own request');

  // Check subscription apply credits
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('apply_credits, plan_type')
    .eq('user_id', req.user.id)
    .single();

  if (sub && sub.apply_credits <= 0 && sub.plan_type === 'free') {
    return fail(res, 'You have used all your free applications. Upgrade to apply more.', 403);
  }

  const { data, error } = await supabase
    .from('applications')
    .insert({ request_id, provider_id: req.user.id, message, offer_price })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return fail(res, 'You have already applied to this request');
    return fail(res, error.message);
  }

  // Deduct apply credit for free tier
  if (sub && sub.plan_type === 'free' && sub.apply_credits > 0) {
    await supabase
      .from('subscriptions')
      .update({ apply_credits: sub.apply_credits - 1 })
      .eq('user_id', req.user.id);
  }

  return created(res, data, 'Application submitted');
};

// PATCH /applications/:id/accept  — request owner accepts provider
exports.acceptApplication = async (req, res) => {
  const { id } = req.params;

  const { data: app } = await supabase
    .from('applications')
    .select('*, request:request_id(user_id)')
    .eq('id', id)
    .single();

  if (!app) return fail(res, 'Application not found', 404);
  if (app.request.user_id !== req.user.id) return fail(res, 'Unauthorized', 403);

  // Accept this application
  await supabase.from('applications').update({ status: 'accepted' }).eq('id', id);

  // Reject all others for the same request
  await supabase
    .from('applications')
    .update({ status: 'rejected' })
    .eq('request_id', app.request_id)
    .neq('id', id);

  // Mark request as assigned
  await supabase
    .from('requests')
    .update({ status: 'assigned', assigned_provider_id: app.provider_id })
    .eq('id', app.request_id);

  return ok(res, null, 'Provider accepted');
};

// PATCH /applications/:id/reject
exports.rejectApplication = async (req, res) => {
  const { id } = req.params;

  const { data: app } = await supabase
    .from('applications')
    .select('*, request:request_id(user_id)')
    .eq('id', id)
    .single();

  if (!app) return fail(res, 'Application not found', 404);
  if (app.request.user_id !== req.user.id) return fail(res, 'Unauthorized', 403);

  await supabase.from('applications').update({ status: 'rejected' }).eq('id', id);
  return ok(res, null, 'Application rejected');
};

// DELETE /applications/:id  — provider withdraws
exports.withdraw = async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('applications')
    .delete()
    .eq('id', id)
    .eq('provider_id', req.user.id);

  if (error) return fail(res, error.message);
  return ok(res, null, 'Application withdrawn');
};
