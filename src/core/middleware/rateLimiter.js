const rateLimit = require('express-rate-limit');

/**
 * Limit requests to endpoints to prevent brute-force and DDoS
 */
const voucherRedeemLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per `window` (here, per 15 minutes)
  message: {
    success: false,
    message:
      'Too many attempts to redeem vouchers. Please try again after 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const qrGenerateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Max 5 QR generations per minute per IP
  message: {
    success: false,
    message: 'Bạn đã tạo quá nhiều mã QR. Vui lòng thử lại sau 1 phút.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const qrStatusLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Max 30 status checks per minute per IP
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const videoAccessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Max 60 video URL requests per 15 min per user
  keyGenerator: (req) => req.user?.id || req.ip,
  validate: { keyGeneratorIpFallback: false }, // Suppress IPv6 warning — user ID is primary key
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu xem video. Vui lòng thử lại sau.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const zcodeRedeemLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Max 30 redeem requests per minute per IP
  message: {
    success: false,
    message: 'Too many redeem requests. Please try again after 1 minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const acbWebhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // Max 300 webhook requests per minute per IP
  message: {
    success: false,
    message: 'Too many webhook requests. Please try again after 1 minute.',
    code: 'ACB_TOO_MANY_REQUESTS',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  voucherRedeemLimiter,
  qrGenerateLimiter,
  qrStatusLimiter,
  videoAccessLimiter,
  zcodeRedeemLimiter,
  acbWebhookLimiter,
};
