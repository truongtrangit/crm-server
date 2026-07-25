const express = require('express');
const ZCodeController = require('../../../modules/zcode/zcode.controller');
const env = require('../../../core/config/env');
const { requireApiKey } = require('../../../core/middleware/externalAuth');
const { EXTERNAL_SYSTEMS } = require('../../../core/constants/externalSystems');
const {
  checkZcodeIpAllowlist,
} = require('../../../core/middleware/zcodeAuth');
const {
  zcodeRedeemLimiter,
} = require('../../../core/middleware/rateLimiter');
const {
  verifyIdempotency,
} = require('../../../core/middleware/zcodeSecurityAuth');
const {
  externalApiLogger,
} = require('../../../core/middleware/externalApiLogger');

const router = express.Router();

// POST /api/external/v1/zcodes/redeem
//
// Middleware chain:
// 1. requireApiKey     — Validate X-API-Key
// 2. checkIpAllowlist  — IP whitelist check
// 3. verifyIdempotency — Return cached response if idempotent
// 4. rateLimiter       — 30 req/min per IP
// 5. externalApiLogger — Audit trail
// 6. redeemCode        — Business logic
router.post(
  '/redeem',
  requireApiKey(env.zcodeApiKey, EXTERNAL_SYSTEMS.ZCODE),
  checkZcodeIpAllowlist,
  verifyIdempotency,
  zcodeRedeemLimiter,
  externalApiLogger(EXTERNAL_SYSTEMS.ZCODE),
  ZCodeController.redeemCode,
);

module.exports = router;
