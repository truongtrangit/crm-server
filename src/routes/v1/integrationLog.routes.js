const express = require('express');
const router = express.Router();
const IntegrationLogController = require('../../modules/system/integrationConfig/integrationLog.controller');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');

router.get(
  '/',
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  IntegrationLogController.getLogs
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.INTEGRATION_CONFIG),
  IntegrationLogController.getLogById
);

module.exports = router;
