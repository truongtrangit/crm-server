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

router.get(
  '/quota',
  requirePermission(PERMISSIONS.INVOICES_READ),
  InvoiceController.getQuota,
);

router.get(
  '/lookup-tax',
  requirePermission(PERMISSIONS.INVOICES_READ),
  InvoiceController.lookupTaxCode,
);

router.get(
  '/export',
  requirePermission(PERMISSIONS.INVOICES_READ),
  InvoiceController.exportInvoices,
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

router.post(
  '/',
  requirePermission(PERMISSIONS.INVOICES_CREATE),
  InvoiceController.createInvoice,
);

// ─── Batch Operations (MUST be before /:id to avoid route conflict) ─────────

router.post(
  '/batch-issue',
  requirePermission(PERMISSIONS.INVOICES_UPDATE),
  InvoiceController.batchIssueInvoices,
);

router.post(
  '/batch-sign-hsm',
  requirePermission(PERMISSIONS.INVOICES_UPDATE),
  InvoiceController.batchSignWithHSM,
);

// ─── Single Invoice Operations ──────────────────────────────────────────────

router.get(
  '/:id',
  requirePermission(PERMISSIONS.INVOICES_READ),
  InvoiceController.getInvoiceById,
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
  '/:id/sync-tax-status',
  requirePermission(PERMISSIONS.INVOICES_READ),
  InvoiceController.syncTaxStatus,
);

router.post(
  '/:id/resend-email',
  requirePermission(PERMISSIONS.INVOICES_UPDATE),
  InvoiceController.resendEmail,
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

router.post(
  '/:id/replace',
  requirePermission(PERMISSIONS.INVOICES_UPDATE),
  InvoiceController.replaceInvoice,
);

router.post(
  '/:id/adjust',
  requirePermission(PERMISSIONS.INVOICES_UPDATE),
  InvoiceController.adjustInvoice,
);

router.post(
  '/:id/sign-hsm',
  requirePermission(PERMISSIONS.INVOICES_UPDATE),
  InvoiceController.signInvoiceWithHSM,
);


router.post(
  '/:id/explain-cqt',
  requirePermission(PERMISSIONS.INVOICES_UPDATE),
  InvoiceController.explainToCQT,
);

router.post(
  '/:id/explain-replaced-cqt',
  requirePermission(PERMISSIONS.INVOICES_UPDATE),
  InvoiceController.explainReplacedToCQT,
);

router.get(
  '/:id/download/pdf',
  requirePermission(PERMISSIONS.INVOICES_READ),
  InvoiceController.downloadPdf,
);

router.get(
  '/:id/download/xml',
  requirePermission(PERMISSIONS.INVOICES_READ),
  InvoiceController.downloadXml,
);

module.exports = router;
