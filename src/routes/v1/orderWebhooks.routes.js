const express = require('express');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');
const validate = require('../../core/middleware/validate');
const OrderWebhookController = require('../../modules/course/orderWebhook/orderWebhook.controller');
const {
  createRuleSchema,
  updateRuleSchema,
} = require('../../modules/course/orderWebhook/orderWebhook.validation');

const router = express.Router();

// ─── Sample Payload (trước /:id để tránh match nhầm) ───────────────────────
router.get(
  '/sample',
  requirePermission(PERMISSIONS.COURSES_ORDER_WEBHOOKS_READ),
  OrderWebhookController.getSamplePayload,
);

// ─── Delivery Logs ──────────────────────────────────────────────────────────
router.get(
  '/logs',
  requirePermission(PERMISSIONS.COURSES_ORDER_WEBHOOKS_READ),
  OrderWebhookController.getDeliveryLogs,
);

// ─── Rules CRUD ─────────────────────────────────────────────────────────────
router.get(
  '/',
  requirePermission(PERMISSIONS.COURSES_ORDER_WEBHOOKS_READ),
  OrderWebhookController.getRules,
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.COURSES_ORDER_WEBHOOKS_READ),
  OrderWebhookController.getRuleById,
);

router.post(
  '/',
  requirePermission(PERMISSIONS.COURSES_ORDER_WEBHOOKS_CREATE),
  validate(createRuleSchema),
  OrderWebhookController.createRule,
);

router.put(
  '/:id',
  requirePermission(PERMISSIONS.COURSES_ORDER_WEBHOOKS_UPDATE),
  validate(updateRuleSchema),
  OrderWebhookController.updateRule,
);

router.patch(
  '/:id/toggle',
  requirePermission(PERMISSIONS.COURSES_ORDER_WEBHOOKS_UPDATE),
  OrderWebhookController.toggleRule,
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.COURSES_ORDER_WEBHOOKS_DELETE),
  OrderWebhookController.deleteRule,
);

module.exports = router;
