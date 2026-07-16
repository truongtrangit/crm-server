const express = require('express');
const BotvnAuthController = require('../../../modules/customer/botvnAuth/botvnAuth.controller');

const validate = require('../../../core/middleware/validate');
const {
  verifyBotvnQrLoginWebhookToken,
} = require('../../../core/middleware/webhookAuth');
const {
  qrGenerateLimiter,
  qrStatusLimiter,
} = require('../../../core/middleware/rateLimiter');
const {
  loginSchema,
  registerSchema,
} = require('../../../modules/customer/botvnAuth/botvnAuth.validation');

const router = express.Router();

router.post('/login', validate(loginSchema), BotvnAuthController.login);
router.post(
  '/register',
  validate(registerSchema),
  BotvnAuthController.register,
);
router.post('/logout', BotvnAuthController.logout);

// Zalo QR Login
router.post('/qr/generate', qrGenerateLimiter, BotvnAuthController.generateQr);
router.get('/qr/status/:token', qrStatusLimiter, BotvnAuthController.getQrStatus);
router.post(
  '/qr/verify',
  verifyBotvnQrLoginWebhookToken,
  BotvnAuthController.verifyQr,
);

module.exports = router;
