const express = require('express');
const ZCodeController = require('../../modules/zcode/zcode.controller');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');

const router = express.Router();

// Stats
router.get(
  '/stats',
  requirePermission(PERMISSIONS.ZCODES_READ),
  ZCodeController.getStats,
);

// Export
router.get(
  '/export',
  requirePermission(PERMISSIONS.ZCODES_READ),
  ZCodeController.exportZCodes,
);

// List
router.get(
  '/',
  requirePermission(PERMISSIONS.ZCODES_READ),
  ZCodeController.getZCodes,
);

// Detail
router.get(
  '/:id',
  requirePermission(PERMISSIONS.ZCODES_READ),
  ZCodeController.getZCodeById,
);

// Check duplicates
router.post(
  '/check-duplicates',
  requirePermission(PERMISSIONS.ZCODES_CREATE),
  ZCodeController.checkDuplicates,
);

// Batch create
router.post(
  '/',
  requirePermission(PERMISSIONS.ZCODES_CREATE),
  ZCodeController.createZCodes,
);

// Update status
router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.ZCODES_UPDATE),
  ZCodeController.updateStatus,
);

// Retry
router.post(
  '/:id/retry',
  requirePermission(PERMISSIONS.ZCODES_UPDATE),
  ZCodeController.retryZCode,
);

module.exports = router;
