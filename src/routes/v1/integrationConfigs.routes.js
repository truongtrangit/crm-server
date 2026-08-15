const express = require("express");
const { requirePermission } = require("../../core/middleware/auth");
const { PERMISSIONS } = require("../../core/constants/rbac");
const validate = require("../../core/middleware/validate");
const IntegrationConfigController = require("../../modules/system/integrationConfig/integrationConfig.controller");
const {
  createIntegrationConfigSchema,
  updateIntegrationConfigSchema,
} = require("../../modules/system/integrationConfig/integrationConfig.validation");

const router = express.Router();

// GET /api/v1/integration-configs — Danh sách config
router.get(
  "/",
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  IntegrationConfigController.listConfigs,
);

// GET /api/v1/integration-configs/sources — Danh sách unique sources
router.get(
  "/sources",
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  IntegrationConfigController.getSources,
);

// GET /api/v1/integration-configs/metadata/system-events — Danh sách các event hệ thống được định nghĩa sẵn
router.get(
  "/metadata/system-events",
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  IntegrationConfigController.getSystemEvents,
);

// POST /api/v1/integration-configs/test-trigger — Kiểm thử bắn event
router.post(
  "/test-trigger",
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  IntegrationConfigController.testTrigger,
);

// GET /api/v1/integration-configs/variables/preview?source=...&eventType=... — Biến predefined
router.get(
  "/variables/preview",
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  IntegrationConfigController.getVariablesPreview,
);

// GET /api/v1/integration-configs/:id/variables — Biến merged (predefined + discovered)
router.get(
  "/:id/variables",
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  IntegrationConfigController.getVariables,
);

// GET /api/v1/integration-configs/:id — Chi tiết config
router.get(
  "/:id",
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  IntegrationConfigController.getConfigById,
);

// POST /api/v1/integration-configs — Tạo config mới
router.post(
  "/",
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  validate(createIntegrationConfigSchema),
  IntegrationConfigController.createConfig,
);

// PUT /api/v1/integration-configs/:id — Cập nhật config
router.put(
  "/:id",
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  validate(updateIntegrationConfigSchema),
  IntegrationConfigController.updateConfig,
);

// DELETE /api/v1/integration-configs/:id — Xóa config
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  IntegrationConfigController.deleteConfig,
);

module.exports = router;
