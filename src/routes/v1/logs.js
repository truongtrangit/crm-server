const { Router } = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const LogController = require("../../controllers/LogController");
const { requirePermission } = require("../../middleware/auth");
const { PERMISSIONS } = require("../../constants/rbac");

const router = Router();

// All log endpoints require LOGS_READ — only OWNER / ADMIN
router.get(
  "/webhook",
  requirePermission(PERMISSIONS.LOGS_READ),
  asyncHandler(LogController.getWebhookLogs),
);

router.get(
  "/system",
  requirePermission(PERMISSIONS.LOGS_READ),
  asyncHandler(LogController.getSystemLogs),
);

router.get(
  "/automation",
  requirePermission(PERMISSIONS.LOGS_READ),
  asyncHandler(LogController.getAutomationLogs),
);

module.exports = router;
