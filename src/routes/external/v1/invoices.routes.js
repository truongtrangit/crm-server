const express = require('express');
const InvoiceController = require('../../../modules/invoice/invoice.controller');
const { EXTERNAL_SYSTEMS } = require('../../../core/constants/externalSystems');
const { externalInvoiceLimiter } = require('../../../core/middleware/rateLimiter');
const { externalApiLogger } = require('../../../core/middleware/externalApiLogger');
const {
  authenticateExternalInvoicePartner,
  verifyExternalInvoiceIdempotency,
} = require('../../../core/middleware/externalInvoiceAuth');

const router = express.Router();

// Middleware chung cho toàn bộ External Invoice API (/api/external/v1/invoices)
// 1. Rate Limiter (60 req/phút/IP)
// 2. Audit Log (ExternalApiLog)
// 3. Multi-Partner Auth + Per-Partner IP Allowlist (cô lập cấu hình key & IP theo từng đối tác; xem docs/INVOICE_EXTERNAL_PARTNER_ONBOARDING.md)
router.use(
  externalInvoiceLimiter,
  externalApiLogger(EXTERNAL_SYSTEMS.INVOICE_EXTERNAL),
  authenticateExternalInvoicePartner,
);

// GET /api/external/v1/invoices/template — Lấy template payload, danh sách enum & ví dụ mẫu
router.get('/template', InvoiceController.getExternalTemplate);

// GET /api/external/v1/invoices/products — Lấy danh mục sản phẩm (SKU) đang kích hoạt
router.get('/products', InvoiceController.getExternalProducts);

// GET /api/external/v1/invoices/:id — Tra cứu trạng thái & thông tin HĐ theo id / sourceId / billCode
router.get('/:id', InvoiceController.getExternalInvoiceByRef);

// POST /api/external/v1/invoices — Tạo 1 hoá đơn (object) hoặc nhiều hoá đơn riêng lẻ (array / { invoices: [...] })
router.post(
  '/',
  verifyExternalInvoiceIdempotency,
  InvoiceController.createExternalInvoices,
);

module.exports = router;
