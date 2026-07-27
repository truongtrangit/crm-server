const { Router } = require('express');
const {
  enforceJsonContentType,
  checkAcbIpAllowlist,
  checkAcbBruteForce,
  verifyAcbApiKey,
  verifyAcbWebhookSignature,
} = require('../../core/middleware/acbWebhookAuth');
const { acbWebhookLimiter } = require('../../core/middleware/rateLimiter');
const {
  externalApiLogger,
} = require('../../core/middleware/externalApiLogger');
const { EXTERNAL_SYSTEMS } = require('../../core/constants/externalSystems');
const BankLogController = require('../../modules/bankLog/bankLog.controller');

const router = Router();

// POST /api/v1/webhooks/acb/transaction
//
// Security middleware chain (8 layers):
// 1. enforceJsonContentType    — Reject non-JSON Content-Type
// 2. checkAcbIpAllowlist       — IP whitelist (skip only if 0.0.0.0)
// 3. checkAcbBruteForce        — Auto-block after 5 auth failures in 10min
// 4. verifyAcbApiKey           — X-API-Key (timing-safe + brute-force aware)
// 5. verifyAcbWebhookSignature — HMAC-SHA256 + timestamp + replay nonce
// 6. acbWebhookLimiter         — 300 req/min
// 7. externalApiLogger         — Audit trail
// 8. ingestAcbTransaction      — Validate + save + async process
router.post(
  '/transaction',
  enforceJsonContentType,
  checkAcbIpAllowlist,
  checkAcbBruteForce,
  verifyAcbApiKey,
  verifyAcbWebhookSignature,
  acbWebhookLimiter,
  externalApiLogger(EXTERNAL_SYSTEMS.ACB),
  BankLogController.ingestAcbTransaction,
);

module.exports = router;
