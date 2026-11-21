const express = require('express');
const InvoiceController = require('../../modules/invoice/invoice.controller');
const {
  publicInvoiceLookupLimiter,
} = require('../../core/middleware/rateLimiter');

const router = express.Router();

// Public Invoice Lookup & File Preview (No authentication required — for end-customers)
// Protected by rate limiter (30 req/min/IP) and high-entropy lookupCode / providerInvoiceGUID
router.use(publicInvoiceLookupLimiter);

// GET /api/v1/public/invoices/:code — Lấy thông tin tóm tắt hoá đơn theo Mã tra cứu (MTC) hoặc InvoiceGUID
router.get('/:code', InvoiceController.getPublicInvoiceByCode);

// GET /api/v1/public/invoices/:code/file?format=pdf|xml&inline=true|false — Xem trực tiếp hoặc tải PDF/XML
router.get('/:code/file', InvoiceController.downloadPublicInvoiceByCode);

module.exports = router;
