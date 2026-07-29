const { Router } = require('express');
const {
  enforceJsonContentType,
  checkAcbIpAllowlist,
  checkAcbBruteForce,
  verifyAcbApiKey,
  verifyAcbChecksum,
  checkAcbRequestIdDedup,
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
// 2. checkAcbIpAllowlist       — IP whitelist with CIDR support
// 3. checkAcbBruteForce        — Auto-block after 5 auth failures in 10min
// 4. acbWebhookLimiter         — 300 req/min
// 5. externalApiLogger         — Audit trail (captures body before security drops it)
// 6. verifyAcbApiKey           — X-API-Key (timing-safe + brute-force aware)
// 7. verifyAcbChecksum         — SHA256 Checksum (body + secretKey + bankKey)
// 8. checkAcbRequestIdDedup    — clientRequestId dedup (replay protection)
// 9. ingestAcbTransaction      — Validate ACB payload + save + async process
router.post(
  '/transaction',
  enforceJsonContentType,
  checkAcbIpAllowlist,
  checkAcbBruteForce,
  acbWebhookLimiter,
  externalApiLogger(EXTERNAL_SYSTEMS.ACB),
  verifyAcbApiKey,
  verifyAcbChecksum,
  checkAcbRequestIdDedup,
  BankLogController.ingestAcbTransaction,
);

module.exports = router;
