const { supabase } = require('../config/supabase');
const { ok, fail } = require('../utils/response');

// GET /users/:id
exports.getUser = async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('users')
    .select('id, name, avatar_url, city, bio, role, rating, rating_count, is_premium, created_at')
    .eq('id', id)
    .single();

  if (error) return fail(res, 'User not found', 404);
  return ok(res, data);
};

// GET /users/me
exports.getMe = async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*, subscriptions(*)')
    .eq('id', req.user.id)
    .single();

  if (error) return fail(res, 'Profile not found', 404);
  return ok(res, data);
};

// POST /users/profile  (create or update own profile)
exports.upsertProfile = async (req, res) => {
  const { name, phone, bio, city, avatar_url } = req.body;

  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: req.user.id,
      email: req.user.email,
      name,
      phone,
      bio,
      city,
      avatar_url,
    })
    .select()
    .single();

  if (error) return fail(res, error.message);
  return ok(res, data);
};

// PATCH /users/me/location
exports.updateLocation = async (req, res) => {
  const { city, latitude, longitude } = req.body;
  if (!city && !latitude) return fail(res, 'city or coordinates required');

  const updates = { location_updated_at: new Date().toISOString() };
  if (city)      updates.city      = city;
  if (latitude)  updates.latitude  = Number(latitude);
  if (longitude) updates.longitude = Number(longitude);

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) return fail(res, error.message);
  return ok(res, data, 'Location updated');
};

// PATCH /users/me
exports.updateMe = async (req, res) => {
  const allowed = ['name', 'phone', 'bio', 'city', 'avatar_url', 'role', 'latitude', 'longitude'];
  const updates = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) return fail(res, error.message);
  return ok(res, data);
};

// GET /users/:id/reviews
exports.getUserReviews = async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('reviews')
    .select('*, reviewer:reviewer_id(id, name, avatar_url)')
    .eq('reviewee_id', id)
    .order('created_at', { ascending: false });

  if (error) return fail(res, error.message);
  return ok(res, data);
};

// POST /users/:id/report
exports.reportUser = async (req, res) => {
  const { reason, details } = req.body;
  const { id: reported_user_id } = req.params;

  if (reported_user_id === req.user.id) return fail(res, 'Cannot report yourself');

  const { data, error } = await supabase
    .from('reports')
    .insert({ reporter_id: req.user.id, reported_user_id, reason, details })
    .select()
    .single();

  if (error) return fail(res, error.message);
  return ok(res, data, 'Report submitted', 201);
};

// GET /users (search/list users)
exports.listUsers = async (req, res) => {
  const { city, q, limit = 20, offset = 0 } = req.query;
  let query = supabase
    .from('users')
    .select('id, name, avatar_url, city, role, rating, rating_count, is_premium')
    .eq('is_blocked', false)
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (city) query = query.ilike('city', `%${city}%`);
  if (q) query = query.ilike('name', `%${q}%`);

  const { data, error } = await query;
  if (error) return fail(res, error.message);
  return ok(res, data);
};
