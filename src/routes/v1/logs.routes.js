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

router.get(
  "/external",
  requirePermission(PERMISSIONS.LOGS_EXTERNAL_READ),
  LogController.getExternalLogs,
);

router.post(
  "/external/:id/replay",
  requirePermission(PERMISSIONS.LOGS_EXTERNAL_REPLAY),
  LogController.replayExternalLog,
);

module.exports = router;
