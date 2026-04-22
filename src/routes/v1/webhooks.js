const { Router } = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const validate = require("../../middleware/validate");
const {
  verifyWebhookToken,
  verifyWebhookSignature,
  checkIpAllowlist,
  checkIdempotency,
} = require("../../middleware/webhookAuth");
const { webhookIngestSchema } = require("../../validations/webhook");
const WebhookController = require("../../controllers/WebhookController");

const router = Router();

// ─── Webhook Ingest Endpoint ──────────────────────────────────────────────────
// POST /api/v1/webhooks/ingest
//
// Security chain:
//   1. IP allowlist check (optional)
//   2. Bearer token verification
//   3. HMAC signature verification
//   4. Idempotency check (duplicate delivery rejection)
//   5. Joi validation
//   6. Process
router.post(
  "/ingest",
  checkIpAllowlist,
  verifyWebhookToken,
  verifyWebhookSignature,
  asyncHandler(checkIdempotency),
  validate(webhookIngestSchema),
  asyncHandler(WebhookController.ingest),
);

module.exports = router;
