const express = require('express');
const InvoiceController = require('../../modules/invoice/invoice.controller');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');

const router = express.Router();

// ─── Stats ──────────────────────────────────────────────────────────────────

router.get(
  '/stats',
  requirePermission(PERMISSIONS.INVOICES_READ),
  InvoiceController.getStats,
);

// ─── Providers (MUST be before /:id to avoid route conflict) ────────────────

router.get(
  '/providers',
  requirePermission(PERMISSIONS.INVOICE_PROVIDERS_CONFIG),
  InvoiceController.getProviders,
);

router.get(
  '/providers/:id',
  requirePermission(PERMISSIONS.INVOICE_PROVIDERS_CONFIG),
  InvoiceController.getProviderById,
);

router.post(
  '/providers',
  requirePermission(PERMISSIONS.INVOICE_PROVIDERS_CONFIG),
  InvoiceController.createProvider,
);

router.put(
  '/providers/:id',
  requirePermission(PERMISSIONS.INVOICE_PROVIDERS_CONFIG),
  InvoiceController.updateProvider,
);

router.delete(
  '/providers/:id',
  requirePermission(PERMISSIONS.INVOICE_PROVIDERS_CONFIG),
  InvoiceController.deleteProvider,
);

router.post(
  '/providers/:id/test',
  requirePermission(PERMISSIONS.INVOICE_PROVIDERS_CONFIG),
  InvoiceController.testProviderConnection,
);

// ─── Invoices ───────────────────────────────────────────────────────────────

router.get(
  '/',
  requirePermission(PERMISSIONS.INVOICES_READ),
  InvoiceController.getInvoices,
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.INVOICES_READ),
  InvoiceController.getInvoiceById,
);

router.post(
  '/',
  requirePermission(PERMISSIONS.INVOICES_CREATE),
  InvoiceController.createInvoice,
);

router.put(
  '/:id',
  requirePermission(PERMISSIONS.INVOICES_UPDATE),
  InvoiceController.updateInvoice,
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.INVOICES_DELETE),
  InvoiceController.deleteInvoice,
);

router.post(
  '/:id/issue',
  requirePermission(PERMISSIONS.INVOICES_UPDATE),
  InvoiceController.issueInvoice,
);

router.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.INVOICES_UPDATE),
  InvoiceController.cancelInvoice,
);

router.post(
  '/:id/retry',
  requirePermission(PERMISSIONS.INVOICES_UPDATE),
  InvoiceController.retryInvoice,
);

module.exports = router;
