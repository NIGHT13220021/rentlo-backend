const rateLimit = require('express-rate-limit');

// General API rate limit — 100 req/15min per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Auth endpoints — stricter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, please wait 15 minutes.' },
});

// OTP send — very strict: 3 per 10 min per IP
const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.phone || req.ip,
  message: { success: false, message: 'Too many OTP requests. Please wait 10 minutes before trying again.' },
});

// Post listing — 5 per minute per user
const postListingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { success: false, message: 'Slow down — too many listing requests.' },
});

module.exports = { apiLimiter, authLimiter, otpSendLimiter, postListingLimiter };
