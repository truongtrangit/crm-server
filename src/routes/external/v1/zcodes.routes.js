const express = require('express');
const ZCodeController = require('../../../modules/zcode/zcode.controller');
const env = require('../../../core/config/env');
const { requireApiKey } = require('../../../core/middleware/externalAuth');
const { EXTERNAL_SYSTEMS } = require('../../../core/constants/externalSystems');
const { checkZcodeIpAllowlist } = require('../../../core/middleware/zcodeAuth');
const { zcodeRedeemLimiter } = require('../../../core/middleware/rateLimiter');
const {
  verifyIdempotency,
} = require('../../../core/middleware/zcodeSecurityAuth');
const {
  externalApiLogger,
} = require('../../../core/middleware/externalApiLogger');

const router = express.Router();

// POST /api/external/v1/zcodes/redeem
//
// Middleware chain (same ordering principle as the ACB webhook):
// 1. checkIpAllowlist  — IP whitelist check
// 2. rateLimiter       — 30 req/min per IP
// 3. externalApiLogger — Audit trail (placed after IP/rate-limit so untrusted
//                        traffic can't flood the log collection, but before
//                        API key / idempotency so those outcomes are recorded)
// 4. requireApiKey     — Validate X-API-Key
// 5. verifyIdempotency — Return cached response if idempotent
// 6. redeemCode        — Business logic
router.post(
  '/redeem',
  checkZcodeIpAllowlist,
  zcodeRedeemLimiter,
  externalApiLogger(EXTERNAL_SYSTEMS.ZCODE),
  requireApiKey(env.zcodeApiKey, EXTERNAL_SYSTEMS.ZCODE),
  verifyIdempotency,
  ZCodeController.redeemCode,
);

module.exports = router;
