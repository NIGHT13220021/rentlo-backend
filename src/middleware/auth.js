const { supabase } = require('../config/supabase');

/**
 * Verify Supabase JWT from Authorization header.
 * Attaches req.user = { id, email, ... } on success.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  req.user = data.user;
  next();
}

/**
 * Optional auth - attaches user if token present, otherwise continues.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const { data } = await supabase.auth.getUser(token);
    if (data?.user) req.user = data.user;
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
