const { supabase } = require('../config/supabase');
const { ok, fail } = require('../utils/response');

const TWO_FACTOR_KEY = process.env.TWO_FACTOR_KEY;
const TEMPLATE_NAME  = 'Rentloo%20OTP';

// ── Normalize Indian phone ────────────────────────────────────────────────────
function normalizePhone(raw) {
  let phone = (raw || '').replace(/\s/g, '');
  if (phone.startsWith('+91')) phone = phone.slice(3);
  else if (phone.startsWith('91') && phone.length === 12) phone = phone.slice(2);
  return phone; // 10 digits
}

// ── POST /auth/send-otp ───────────────────────────────────────────────────────
exports.sendOtp = async (req, res) => {
  const { phone: rawPhone } = req.body;
  if (!rawPhone) return fail(res, 'phone is required');

  const phone10   = normalizePhone(rawPhone);
  const fullPhone = '+91' + phone10;

  if (!/^\d{10}$/.test(phone10)) {
    return fail(res, 'Enter a valid 10-digit Indian mobile number');
  }

  // ── Rate limit: max 3 per 10 min ──────────────────────────────────────────
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('otp_requests')
    .select('id', { count: 'exact', head: true })
    .eq('phone', fullPhone)
    .gte('last_sent', tenMinAgo);

  if ((count || 0) >= 3) {
    return fail(res, 'Too many OTP requests. Please wait 10 minutes.', 429);
  }

  // ── Call 2Factor API ──────────────────────────────────────────────────────
  const url = `https://2factor.in/API/V1/${TWO_FACTOR_KEY}/SMS/${phone10}/AUTOGEN/${TEMPLATE_NAME}`;
  let tfRes, tfJson;
  try {
    tfRes  = await fetch(url);
    tfJson = await tfRes.json();
  } catch (err) {
    return fail(res, 'OTP service unreachable. Try again.');
  }

  if (tfJson.Status !== 'Success') {
    return fail(res, `Could not send OTP: ${tfJson.Details || 'Unknown error'}`);
  }

  const sessionId = tfJson.Details;

  // ── Store session ─────────────────────────────────────────────────────────
  await supabase.from('otp_requests').insert({
    phone:      fullPhone,
    session_id: sessionId,
    last_sent:  new Date().toISOString(),
  });

  return ok(res, null, 'OTP sent successfully');
};

// ── POST /auth/verify-otp ─────────────────────────────────────────────────────
exports.verifyOtp = async (req, res) => {
  const { phone: rawPhone, otp } = req.body;
  if (!rawPhone || !otp) return fail(res, 'phone and otp are required');

  const phone10   = normalizePhone(rawPhone);
  const fullPhone = '+91' + phone10;

  if (!/^\d{4,6}$/.test(otp)) return fail(res, 'Invalid OTP format');

  // ── Get latest session_id ─────────────────────────────────────────────────
  const { data: otpRecord } = await supabase
    .from('otp_requests')
    .select('session_id, last_sent')
    .eq('phone', fullPhone)
    .order('last_sent', { ascending: false })
    .limit(1)
    .single();

  if (!otpRecord?.session_id) {
    return fail(res, 'No OTP request found. Please request a new OTP first.', 400);
  }

  // ── Check 5-min expiry ────────────────────────────────────────────────────
  const sentAt = new Date(otpRecord.last_sent).getTime();
  if (Date.now() - sentAt > 5 * 60 * 1000) {
    return fail(res, 'OTP has expired. Please request a new one.', 400);
  }

  // ── Verify with 2Factor ───────────────────────────────────────────────────
  const url = `https://2factor.in/API/V1/${TWO_FACTOR_KEY}/SMS/VERIFY/${otpRecord.session_id}/${otp}`;
  let tfJson;
  try {
    const tfRes = await fetch(url);
    tfJson = await tfRes.json();
  } catch (err) {
    return fail(res, 'OTP service unreachable. Try again.');
  }

  if (tfJson.Status !== 'Success') {
    return fail(res, 'Invalid OTP. Please check and try again.', 400);
  }

  // ── Clean up used OTP records ─────────────────────────────────────────────
  await supabase.from('otp_requests').delete().eq('phone', fullPhone);

  // ── Create or get Supabase user ───────────────────────────────────────────
  const email = `${phone10}@phone.rentloo.app`;

  const { error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    phone:         fullPhone,
    phone_confirm: true,
    user_metadata: { phone: fullPhone },
  });

  // Ignore "already registered" error — user exists, that's fine
  if (createErr && !createErr.message?.toLowerCase().includes('already')) {
    return fail(res, 'Account creation failed: ' + createErr.message);
  }

  // ── Generate one-time magic link token ────────────────────────────────────
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type:  'magiclink',
    email,
  });

  if (linkErr) return fail(res, 'Auth token error: ' + linkErr.message);

  const token_hash = linkData.properties.hashed_token;

  return ok(res, { token_hash, email, phone: fullPhone });
};
