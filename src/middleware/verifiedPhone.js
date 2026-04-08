const { supabase } = require('../config/supabase');

/**
 * Middleware: only allow users with a verified phone number.
 * Supabase sets phone_confirmed_at when phone OTP is verified.
 * Falls back to checking the users table is_phone_verified flag.
 */
async function requireVerifiedPhone(req, res, next) {
  // Supabase phone auth sets phone_confirmed_at on the auth user
  if (req.user?.phone_confirmed_at) return next();

  // Fallback: check our users table
  const { data } = await supabase
    .from('users')
    .select('is_phone_verified')
    .eq('id', req.user.id)
    .single();

  if (data?.is_phone_verified) return next();

  return res.status(403).json({
    success: false,
    message: 'Phone verification required. Please verify your phone number to post listings.',
    code: 'PHONE_NOT_VERIFIED',
  });
}

module.exports = { requireVerifiedPhone };
