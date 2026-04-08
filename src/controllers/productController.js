const { supabase } = require('../config/supabase');
const { ok, created, fail, paginated } = require('../utils/response');

// ── Geo helpers ───────────────────────────────────────────────────────────────

/** Haversine distance in km */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Bounding box for a radius (degrees offset) */
function getBBox(lat, lng, radiusKm) {
  const R = 6371;
  const dLat = (radiusKm / R) * (180 / Math.PI);
  const dLng = (radiusKm / (R * Math.cos(lat * Math.PI / 180))) * (180 / Math.PI);
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

// ── GET /products ─────────────────────────────────────────────────────────────
exports.listProducts = async (req, res) => {
  const {
    city, category, q, min_price, max_price,
    limit = 20, page = 1,
    lat, lng, radius = 25, show_all,
  } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabase
    .from('products')
    .select('*, owner:user_id(id, name, avatar_url, rating, rating_count, city, is_premium)', { count: 'exact' })
    .eq('is_available', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (city)      query = query.ilike('city', `%${city}%`);
  if (category)  query = query.eq('category', category);
  if (q)         query = query.ilike('title', `%${q}%`);
  if (min_price) query = query.gte('price_per_day', min_price);
  if (max_price) query = query.lte('price_per_day', max_price);

  // ── Geo bounding box filter ──
  const userLat = lat ? Number(lat) : null;
  const userLng = lng ? Number(lng) : null;
  const useGeo  = userLat && userLng && !show_all;

  if (useGeo) {
    const bbox = getBBox(userLat, userLng, Number(radius));
    query = query
      .gte('latitude', bbox.minLat)
      .lte('latitude', bbox.maxLat)
      .gte('longitude', bbox.minLng)
      .lte('longitude', bbox.maxLng);
  }

  let { data, error, count } = await query;
  if (error) return fail(res, error.message);

  let results = data || [];

  // ── Attach distance + sort nearest first ──
  if (useGeo) {
    results = results
      .map(p => ({
        ...p,
        distance_km: p.latitude && p.longitude
          ? Math.round(haversineKm(userLat, userLng, Number(p.latitude), Number(p.longitude)) * 10) / 10
          : null,
      }))
      .sort((a, b) => {
        if (a.distance_km == null && b.distance_km == null) return 0;
        if (a.distance_km == null) return 1;
        if (b.distance_km == null) return -1;
        return a.distance_km - b.distance_km;
      });

    // ── Fallback: if < 5 results expand radius to 100km ──
    if (results.length < 5 && !city && !q) {
      const wide = getBBox(userLat, userLng, 100);
      const { data: fallback } = await supabase
        .from('products')
        .select('*, owner:user_id(id, name, avatar_url, rating, rating_count, city, is_premium)')
        .eq('is_available', true)
        .gte('latitude', wide.minLat).lte('latitude', wide.maxLat)
        .gte('longitude', wide.minLng).lte('longitude', wide.maxLng)
        .order('created_at', { ascending: false })
        .limit(20);

      if ((fallback || []).length > results.length) {
        results = (fallback || []).map(p => ({
          ...p,
          distance_km: p.latitude && p.longitude
            ? Math.round(haversineKm(userLat, userLng, Number(p.latitude), Number(p.longitude)) * 10) / 10
            : null,
          _expanded: true,
        })).sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));
        count = results.length;
      }
    }
  }

  return paginated(res, results, count, page, limit);
};

// ── GET /products/:id ─────────────────────────────────────────────────────────
exports.getProduct = async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('products')
    .select('*, owner:user_id(id, name, avatar_url, rating, rating_count, city, phone, is_premium, bio)')
    .eq('id', id)
    .single();

  if (error) return fail(res, 'Product not found', 404);

  supabase.from('products').update({ views: (data.views || 0) + 1 }).eq('id', id).then(() => {});

  return ok(res, data);
};

// ── POST /products ────────────────────────────────────────────────────────────
exports.createProduct = async (req, res) => {
  const { title, description, price_per_day, category, location, location_text, city, images, latitude, longitude } = req.body;

  if (!title || !price_per_day || !category || !city) {
    return fail(res, 'title, price_per_day, category, and city are required');
  }

  // ── Anti-spam: max active listings ──────────────────────────────────────────
  const { count: activeCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
    .eq('is_available', true);

  // Check subscription for limits
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('post_credits, plan_type')
    .eq('user_id', req.user.id)
    .single();

  const maxListings = sub?.plan_type === 'free' ? 5 : 50;
  if ((activeCount || 0) >= maxListings) {
    return fail(res, `You can have at most ${maxListings} active listings. Remove an existing listing to post a new one.`, 403);
  }

  if (sub && sub.post_credits <= 0 && sub.plan_type === 'free') {
    return fail(res, 'You have used all free listing credits. Upgrade to post more.', 403);
  }

  // ── Duplicate title check (anti-spam) ────────────────────────────────────────
  const { data: dup } = await supabase
    .from('products')
    .select('id')
    .eq('user_id', req.user.id)
    .ilike('title', title.trim())
    .eq('is_available', true)
    .limit(1);

  if (dup && dup.length > 0) {
    return fail(res, 'You already have an active listing with this title.', 409);
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      user_id: req.user.id,
      title: title.trim(),
      description,
      price_per_day,
      category,
      location,
      location_text,
      city,
      images: images || [],
      latitude:  latitude  ? Number(latitude)  : null,
      longitude: longitude ? Number(longitude) : null,
    })
    .select()
    .single();

  if (error) return fail(res, error.message);

  if (sub && sub.plan_type === 'free' && sub.post_credits > 0) {
    await supabase
      .from('subscriptions')
      .update({ post_credits: sub.post_credits - 1 })
      .eq('user_id', req.user.id);
  }

  return created(res, data, 'Product listed successfully');
};

// ── PATCH /products/:id ───────────────────────────────────────────────────────
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const allowed = ['title', 'description', 'price_per_day', 'category', 'location', 'location_text', 'city', 'images', 'is_available', 'latitude', 'longitude'];
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
  if (!data)  return fail(res, 'Product not found or unauthorized', 403);
  return ok(res, data);
};

// ── DELETE /products/:id ──────────────────────────────────────────────────────
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

// ── GET /products/my ──────────────────────────────────────────────────────────
exports.myProducts = async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return fail(res, error.message);
  return ok(res, data);
};

// ── POST /products/:id/report ─────────────────────────────────────────────────
exports.reportProduct = async (req, res) => {
  const { id: reported_item_id } = req.params;
  const { reason, details } = req.body;

  if (!reason) return fail(res, 'reason is required');

  // Use existing reports table (reported_item_id + reported_item_type='product')
  const { error } = await supabase
    .from('reports')
    .insert({
      reporter_id:        req.user.id,
      reported_user_id:   req.user.id, // placeholder — actual product owner could be fetched
      reported_item_id,
      reported_item_type: 'product',
      reason,
      details: details || '',
    });

  if (error) return fail(res, error.message);
  return ok(res, null, 'Report submitted. We will review this listing.', 201);
};
