const { supabase } = require('../config/supabase');
const { ok, created, fail } = require('../utils/response');

// POST /reviews
exports.createReview = async (req, res) => {
  const { reviewee_id, rating, comment, reference_id, reference_type } = req.body;

  if (!reviewee_id || !rating) return fail(res, 'reviewee_id and rating are required');
  if (reviewee_id === req.user.id) return fail(res, 'Cannot review yourself');
  if (rating < 1 || rating > 5) return fail(res, 'Rating must be between 1 and 5');

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      reviewer_id: req.user.id,
      reviewee_id,
      rating,
      comment,
      reference_id,
      reference_type,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return fail(res, 'You have already reviewed this');
    return fail(res, error.message);
  }

  return created(res, data, 'Review submitted');
};

// GET /reviews/user/:userId
exports.getUserReviews = async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabase
    .from('reviews')
    .select('*, reviewer:reviewer_id(id, name, avatar_url)')
    .eq('reviewee_id', userId)
    .order('created_at', { ascending: false });

  if (error) return fail(res, error.message);
  return ok(res, data);
};

// DELETE /reviews/:id
exports.deleteReview = async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', id)
    .eq('reviewer_id', req.user.id);

  if (error) return fail(res, error.message);
  return ok(res, null, 'Review deleted');
};
