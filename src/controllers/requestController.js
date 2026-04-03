const { supabase } = require('../config/supabase');
const { ok, created, fail, paginated } = require('../utils/response');

// GET /requests
exports.listRequests = async (req, res) => {
  const { city, category, status = 'open', q, limit = 20, page = 1 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabase
    .from('requests')
    .select('*, poster:user_id(id, name, avatar_url, rating, city)', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (city)     query = query.ilike('city', `%${city}%`);
  if (category) query = query.eq('category', category);
  if (q)        query = query.ilike('title', `%${q}%`);

  const { data, error, count } = await query;
  if (error) return fail(res, error.message);
  return paginated(res, data, count, page, limit);
};

// GET /requests/:id
exports.getRequest = async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('requests')
    .select('*, poster:user_id(id, name, avatar_url, rating, rating_count, city, phone)')
    .eq('id', id)
    .single();

  if (error) return fail(res, 'Request not found', 404);

  // Increment view count
  supabase.from('requests').update({ views: data.views + 1 }).eq('id', id).then(() => {});

  return ok(res, data);
};

// POST /requests
exports.createRequest = async (req, res) => {
  const { title, description, category, budget, duration, location, city } = req.body;

  if (!title || !category || !city) {
    return fail(res, 'title, category, and city are required');
  }

  const { data, error } = await supabase
    .from('requests')
    .insert({
      user_id: req.user.id,
      title,
      description,
      category,
      budget,
      duration,
      location,
      city,
    })
    .select()
    .single();

  if (error) return fail(res, error.message);
  return created(res, data, 'Request posted successfully');
};

// PATCH /requests/:id
exports.updateRequest = async (req, res) => {
  const { id } = req.params;
  const allowed = ['title', 'description', 'category', 'budget', 'duration', 'location', 'city', 'status'];
  const updates = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const { data, error } = await supabase
    .from('requests')
    .update(updates)
    .eq('id', id)
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error) return fail(res, error.message);
  if (!data) return fail(res, 'Not found or unauthorized', 403);
  return ok(res, data);
};

// DELETE /requests/:id
exports.deleteRequest = async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('requests')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id);

  if (error) return fail(res, error.message);
  return ok(res, null, 'Request deleted');
};

// GET /requests/my
exports.myRequests = async (req, res) => {
  const { data, error } = await supabase
    .from('requests')
    .select('*, applications(count)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return fail(res, error.message);
  return ok(res, data);
};
