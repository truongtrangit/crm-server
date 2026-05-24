const { Router } = require("express");
const LogController = require("../../controllers/LogController");
const { requirePermission } = require("../../middleware/auth");
const { PERMISSIONS } = require("../../constants/rbac");

const router = Router();

// Log endpoints require specific permissions
router.get(
  "/webhook",
  requirePermission(PERMISSIONS.LOGS_WEBHOOK_READ),
  LogController.getWebhookLogs,
);

router.post(
  "/webhook/:id/retry",
  requirePermission(PERMISSIONS.LOGS_WEBHOOK_READ),
  LogController.retryWebhook,
);

router.get(
  "/system",
  requirePermission(PERMISSIONS.LOGS_SYSTEM_READ),
  LogController.getSystemLogs,
);

router.get(
  "/automation",
  requirePermission(PERMISSIONS.LOGS_AUTOMATION_READ),
  LogController.getAutomationLogs,
);

module.exports = router;
