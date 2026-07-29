const express = require('express');
const ZCodeController = require('../../modules/zcode/zcode.controller');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');

const router = express.Router();

// SKU Prices
router.get(
  '/sku-prices',
  requirePermission(PERMISSIONS.ZCODES_READ),
  ZCodeController.getSkuPrices,
);

// Stats
router.get(
  '/stats',
  requirePermission(PERMISSIONS.ZCODES_READ),
  ZCodeController.getStats,
);

// Duplicate scan (admin)
router.get(
  '/duplicates',
  requirePermission(PERMISSIONS.ZCODES_READ),
  ZCodeController.findDuplicateGroups,
);

// Mark duplicates (admin)
router.post(
  '/mark-duplicates',
  requirePermission(PERMISSIONS.ZCODES_UPDATE),
  ZCodeController.markDuplicates,
);

// Export
router.get(
  '/export',
  requirePermission(PERMISSIONS.ZCODES_READ),
  ZCodeController.exportZCodes,
);

// List Batches
router.get(
  '/batches',
  requirePermission(PERMISSIONS.ZCODES_READ),
  ZCodeController.getZCodeBatches,
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
