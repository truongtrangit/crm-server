const { Router } = require("express");
const LogController = require('../../modules/system/log/log.controller');
const { requirePermission, requireRole } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');

const router = Router();

// Log endpoints require specific permissions
router.get(
  "/webhook",
  requirePermission(PERMISSIONS.LOGS_WEBHOOK_READ),
  LogController.getWebhookLogs,
);

router.post(
  "/webhook/:id/retry",
  requireRole(["OWNER", "ADMIN"]),
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
