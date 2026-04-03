const { supabase } = require('../config/supabase');
const { ok, created, fail, paginated } = require('../utils/response');

// GET /products
exports.listProducts = async (req, res) => {
  const { city, category, q, min_price, max_price, limit = 20, page = 1 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabase
    .from('products')
    .select('*, owner:user_id(id, name, avatar_url, rating, city)', { count: 'exact' })
    .eq('is_available', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (city)      query = query.ilike('city', `%${city}%`);
  if (category)  query = query.eq('category', category);
  if (q)         query = query.ilike('title', `%${q}%`);
  if (min_price) query = query.gte('price_per_day', min_price);
  if (max_price) query = query.lte('price_per_day', max_price);

  const { data, error, count } = await query;
  if (error) return fail(res, error.message);
  return paginated(res, data, count, page, limit);
};

// GET /products/:id
exports.getProduct = async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('products')
    .select('*, owner:user_id(id, name, avatar_url, rating, rating_count, city, phone)')
    .eq('id', id)
    .single();

  if (error) return fail(res, 'Product not found', 404);

  // Increment view count (fire and forget)
  supabase.from('products').update({ views: data.views + 1 }).eq('id', id).then(() => {});

  return ok(res, data);
};

// POST /products
exports.createProduct = async (req, res) => {
  const { title, description, price_per_day, category, location, city, images } = req.body;

  if (!title || !price_per_day || !category || !city) {
    return fail(res, 'title, price_per_day, category, and city are required');
  }

  // Check subscription post credits
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('post_credits, plan_type')
    .eq('user_id', req.user.id)
    .single();

  if (sub && sub.post_credits <= 0 && sub.plan_type === 'free') {
    return fail(res, 'You have reached your free listing limit. Upgrade to post more.', 403);
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      user_id: req.user.id,
      title,
      description,
      price_per_day,
      category,
      location,
      city,
      images: images || [],
    })
    .select()
    .single();

  if (error) return fail(res, error.message);

  // Deduct post credit if free tier
  if (sub && sub.plan_type === 'free' && sub.post_credits > 0) {
    await supabase
      .from('subscriptions')
      .update({ post_credits: sub.post_credits - 1 })
      .eq('user_id', req.user.id);
  }

  return created(res, data, 'Product listed successfully');
};

// PATCH /products/:id
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const allowed = ['title', 'description', 'price_per_day', 'category', 'location', 'city', 'images', 'is_available'];
  const updates = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error) return fail(res, error.message);
  if (!data) return fail(res, 'Product not found or unauthorized', 403);
  return ok(res, data);
};

// DELETE /products/:id
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id);

  if (error) return fail(res, error.message);
  return ok(res, null, 'Product deleted');
};

// GET /products/my
exports.myProducts = async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return fail(res, error.message);
  return ok(res, data);
};
