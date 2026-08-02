const mongoose = require('mongoose');

const { INVOICE_STATUSES, INVOICE_PROVIDER_TYPES, INVOICE_RELATION_TYPES } = require('../../core/constants/invoice');

const invoiceItemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true, trim: true },
    unitName: { type: String, default: '', trim: true },
    quantity: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },              // qty × price
    taxRateId: { type: Number, default: 3 },            // BKAV TaxRateID (3=10%)
    taxRate: { type: Number, default: 10 },             // Phần trăm thuế
    taxAmount: { type: Number, default: 0 },
    discountRate: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    isDiscount: { type: Boolean, default: false },      // true = dòng chiết khấu toàn đơn
    itemTypeId: { type: Number, default: 0 },           // 0=HHDV, 4=Ghi chú
    userDefineDetails: { type: String, default: '' },   // Thông tin đặc biệt hàng hoá
    isIncrease: { type: Boolean, default: null },       // Chỉ dùng cho HĐ điều chỉnh
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    providerId: { type: String, required: true },       // ref → InvoiceProvider.id
    providerType: {
      type: String,
      enum: Object.values(INVOICE_PROVIDER_TYPES),
      required: true,
    },

    // ─── Thông tin Hoá đơn ──────────────────────────────────────────────
    invoiceForm: { type: String, default: null, trim: true },     // Mẫu số
    invoiceSerial: { type: String, default: null, trim: true },   // Ký hiệu (MAA, MVK)
    invoiceNo: { type: Number, default: 0 },                     // Số HĐ (CQT cấp)
    invoiceDate: { type: Date, default: null },

    // ─── Thông tin người mua ────────────────────────────────────────────
    buyer: {
      type: { type: String, enum: ['company', 'personal'], default: 'company' },
      name: { type: String, default: '', trim: true },
      taxCode: { type: String, default: '', trim: true },
      unitName: { type: String, default: '', trim: true },
      address: { type: String, default: '', trim: true },
      email: { type: String, default: '', trim: true },
      phone: { type: String, default: '', trim: true },
      bankAccount: { type: String, default: '', trim: true },
      cccd: { type: String, default: '', trim: true },           // Căn cước công dân (HĐ MTT)
    },

    // ─── Cấu hình HĐ ───────────────────────────────────────────────────
    paymentMethod: {
      type: String,
      enum: ['TM', 'CK', 'TM/CK'],
      default: 'TM/CK',
    },
    currency: { type: String, default: 'VND', trim: true },
    exchangeRate: { type: Number, default: 1 },
    note: { type: String, default: '', trim: true },
    billCode: { type: String, default: '', trim: true },          // Mã chứng từ nội bộ CRM
    userDefine: { type: String, default: '' },                    // Thông tin đặc biệt tiêu đề HĐ

    // ─── Chi tiết hàng hoá ──────────────────────────────────────────────
    items: [invoiceItemSchema],

    // ─── Tổng hợp ───────────────────────────────────────────────────────
    totalAmountBeforeTax: { type: Number, default: 0 },
    totalTaxAmount: { type: Number, default: 0 },
    totalDiscountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    // ─── Trạng thái ─────────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUSES),
      default: INVOICE_STATUSES.DRAFT,
    },

    // ─── Provider response ──────────────────────────────────────────────
    providerInvoiceGUID: { type: String, default: null },         // InvoiceGUID (BKAV)
    providerTrackingCode: { type: String, default: null },        // tracking_code (SePay)
    providerResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    providerErrorCode: { type: String, default: null },
    providerErrorMessage: { type: String, default: null },
    lookupCode: { type: String, default: null },                  // MTC — Mã tra cứu
    pdfUrl: { type: String, default: null },
    xmlUrl: { type: String, default: null },

    // ─── Liên kết (thay thế / điều chỉnh) ───────────────────────────────
    relatedInvoiceId: { type: String, default: null },            // HĐ gốc
    relationType: {
      type: String,
      enum: [...Object.values(INVOICE_RELATION_TYPES), null],
      default: null,
    },

    // ─── Retry & Tracking ───────────────────────────────────────────────
    retryCount: { type: Number, default: 0 },
    lastRetryAt: { type: Date, default: null },
    issuedAt: { type: Date, default: null },

    // ─── Liên kết module khác (future) ──────────────────────────────────
    // revenueId: { type: String, default: null },
    // bankLogTxId: { type: String, default: null },

    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

invoiceSchema.index({ status: 1 });
invoiceSchema.index({ providerId: 1, status: 1 });
invoiceSchema.index({ invoiceDate: -1, createdAt: -1 });
invoiceSchema.index({ providerInvoiceGUID: 1 }, { sparse: true });
invoiceSchema.index({ 'buyer.taxCode': 1 }, { sparse: true });
invoiceSchema.index({ billCode: 1 }, { sparse: true });
invoiceSchema.index({ relatedInvoiceId: 1 }, { sparse: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
