const { Router } = require("express");
const LogController = require("../../controllers/LogController");
const { requirePermission } = require("../../middleware/auth");
const { PERMISSIONS } = require("../../constants/rbac");

const router = Router();

// All log endpoints require LOGS_READ — only OWNER / ADMIN
router.get(
  "/webhook",
  requirePermission(PERMISSIONS.LOGS_READ),
  LogController.getWebhookLogs,
);

router.post(
  "/webhook/:id/retry",
  requirePermission(PERMISSIONS.LOGS_READ),
  LogController.retryWebhook,
);

router.get(
  "/system",
  requirePermission(PERMISSIONS.LOGS_READ),
  LogController.getSystemLogs,
);

router.get(
  "/automation",
  requirePermission(PERMISSIONS.LOGS_READ),
  LogController.getAutomationLogs,
);

module.exports = router;
