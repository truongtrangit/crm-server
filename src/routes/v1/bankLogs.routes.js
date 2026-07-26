const express = require('express');
const BankLogController = require('../../modules/bankLog/bankLog.controller');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');

const router = express.Router();

// ─── Stats ──────────────────────────────────────────────────────────────────

router.get(
  '/stats',
  requirePermission(PERMISSIONS.BANK_LOGS_READ),
  BankLogController.getStats,
);

// ─── Transactions ───────────────────────────────────────────────────────────

router.get(
  '/transactions',
  requirePermission(PERMISSIONS.BANK_LOGS_READ),
  BankLogController.getTransactions,
);

router.get(
  '/transactions/:id',
  requirePermission(PERMISSIONS.BANK_LOGS_READ),
  BankLogController.getTransactionById,
);

router.post(
  '/transactions/:id/retry',
  requirePermission(PERMISSIONS.BANK_LOGS_UPDATE),
  BankLogController.retryTransaction,
);

// ─── Routing Rules ──────────────────────────────────────────────────────────

router.get(
  '/rules',
  requirePermission(PERMISSIONS.BANK_LOG_RULES_CONFIG),
  BankLogController.getRules,
);

router.post(
  '/rules',
  requirePermission(PERMISSIONS.BANK_LOG_RULES_CONFIG),
  BankLogController.createRule,
);

router.put(
  '/rules/:id',
  requirePermission(PERMISSIONS.BANK_LOG_RULES_CONFIG),
  BankLogController.updateRule,
);

router.delete(
  '/rules/:id',
  requirePermission(PERMISSIONS.BANK_LOG_RULES_CONFIG),
  BankLogController.deleteRule,
);

module.exports = router;
