const { Router } = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const {
  verifyWebhookToken,
  checkIpAllowlist,
  checkIdempotency,
} = require("../../middleware/webhookAuth");
const WebhookController = require("../../controllers/WebhookController");

const router = Router();

// ─── Security middleware (áp dụng cho tất cả webhook routes) ────────────────
// 1. IP allowlist check (optional)
// 2. Bearer token verification
// 3. Idempotency check (optional delivery ID — auto-generate if missing)
router.use(checkIpAllowlist, verifyWebhookToken, asyncHandler(checkIdempotency));

// ─── Webhook Endpoints — 1 API riêng cho mỗi loại event ────────────────────
// Bên thứ 3 chỉ cần gọi đúng API + gửi payload, không cần gửi eventType.

// POST /api/v1/webhooks/new-registration       → Khách hàng đăng ký mới
router.post("/new-registration", asyncHandler(WebhookController.ingest));

// POST /api/v1/webhooks/new-business            → Khách hàng tạo biz mới
router.post("/new-business", asyncHandler(WebhookController.ingest));

// POST /api/v1/webhooks/expiring-subscription   → Biz cần gia hạn
router.post("/expiring-subscription", asyncHandler(WebhookController.ingest));

// POST /api/v1/webhooks/upgrade-required        → Biz cần nâng cấp
router.post("/upgrade-required", asyncHandler(WebhookController.ingest));

module.exports = router;
