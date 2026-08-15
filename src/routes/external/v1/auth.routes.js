const express = require('express');
const BotvnAuthController = require('../../../modules/customer/botvnAuth/botvnAuth.controller');

const validate = require('../../../core/middleware/validate');
const {
  verifyBotvnQrLoginWebhookToken,
} = require('../../../core/middleware/webhookAuth');
const {
  qrGenerateLimiter,
  qrStatusLimiter,
  otpVerifyLimiter,
  otpResendLimiter,
} = require('../../../core/middleware/rateLimiter');
const {
  loginSchema,
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  forgotPasswordVerifyOtpSchema,
  resetPasswordSchema,
} = require('../../../modules/customer/botvnAuth/botvnAuth.validation');

const router = express.Router();

router.post('/login', validate(loginSchema), BotvnAuthController.login);
router.post(
  '/register',
  validate(registerSchema),
  BotvnAuthController.register,
);
router.post('/logout', BotvnAuthController.logout);

// OTP Verification
router.post(
  '/otp/verify',
  otpVerifyLimiter,
  validate(verifyOtpSchema),
  BotvnAuthController.verifyOtp,
);
router.post(
  '/otp/resend',
  otpResendLimiter,
  validate(resendOtpSchema),
  BotvnAuthController.resendOtp,
);

// Forgot Password
router.post(
  '/password/forgot',
  otpResendLimiter,
  validate(forgotPasswordSchema),
  BotvnAuthController.forgotPassword,
);
router.post(
  '/password/verify-otp',
  otpVerifyLimiter,
  validate(forgotPasswordVerifyOtpSchema),
  BotvnAuthController.forgotPasswordVerifyOtp,
);
router.post(
  '/password/reset',
  validate(resetPasswordSchema),
  BotvnAuthController.resetPassword,
);

// Zalo QR Login
router.post('/qr/generate', qrGenerateLimiter, BotvnAuthController.generateQr);
router.get('/qr/status/:token', qrStatusLimiter, BotvnAuthController.getQrStatus);
router.get('/qr/scan/:token', BotvnAuthController.scanQr);
router.post(
  '/qr/verify',
  verifyBotvnQrLoginWebhookToken,
  BotvnAuthController.verifyQr,
);

module.exports = router;
