const { Router } = require('express');
const {
  verifyWebhookToken,
  checkIpAllowlist,
  checkIdempotency,
} = require('../../core/middleware/webhookAuth');
const WebhookController = require('../../modules/system/webhook/webhook.controller');

const router = Router();

// ─── ACB Bank Webhook (own security — completely separate from CRM webhooks) ─
router.use('/acb', require('./acbWebhook.routes'));

// ─── CRM Webhook Security (áp dụng cho các route bên dưới) ─────────────────
// 1. IP allowlist check (optional)
// 2. Bearer token verification
// 3. Idempotency check
router.use(checkIpAllowlist, verifyWebhookToken, checkIdempotency);

// ─── CRM Webhook Endpoints — 1 API riêng cho mỗi loại event ────────────────
// Bên thứ 3 chỉ cần gọi đúng API + gửi payload, không cần gửi eventType.

// POST /api/v1/webhooks/new-login                → User đăng nhập
router.post('/new-login', WebhookController.ingest);

// POST /api/v1/webhooks/new-registration       → Khách hàng đăng ký mới
router.post('/new-registration', WebhookController.ingest);

// POST /api/v1/webhooks/new-business            → Khách hàng tạo biz mới
router.post('/new-business', WebhookController.ingest);

// POST /api/v1/webhooks/expiring-subscription   → Biz cần gia hạn
router.post('/expiring-subscription', WebhookController.ingest);

// POST /api/v1/webhooks/order-create             → Đơn hàng / subscription mới
router.post('/order-create', WebhookController.ingest);

// POST /api/v1/webhooks/order-active             → Kích hoạt đơn hàng (PAID)
router.post('/order-active', WebhookController.ingest);

// POST /api/v1/webhooks/upgrade-required        → Biz cần nâng cấp
router.post('/upgrade-required', WebhookController.ingest);

module.exports = router;
