const mongoose = require('mongoose');
const {
  TOPUP_REQUEST_STATUS,
  BUSINESS_TYPES,
  CREDIT_TYPES,
} = require('../../../core/constants/appData');
const { softDeletePlugin } = require('../../../core/utils/softDelete');

const topupRequestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    customerId: {
      type: String,
      required: true,
      ref: 'Customer',
      index: true,
    },

    // Thông tin nạp
    amount: { type: Number, required: true },
    creditAmount: { type: Number, required: true },
    creditType: {
      type: String,
      enum: Object.values(CREDIT_TYPES),
      default: CREDIT_TYPES.MAIN,
    },

    // Thông tin chuyển khoản (snapshot từ config tại thời điểm tạo)
    bankInfo: {
      bankName: { type: String, default: '' },
      bankCode: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      accountHolder: { type: String, default: '' },
      transferContent: { type: String, default: '' },
    },

    // QR Code
    qrDataUrl: { type: String, default: '' },

    // Trạng thái
    status: {
      type: String,
      enum: Object.values(TOPUP_REQUEST_STATUS),
      default: TOPUP_REQUEST_STATUS.PENDING,
    },

    // VAT Invoice
    requestInvoice: { type: Boolean, default: false },
    invoiceInfo: {
      businessType: {
        type: String,
        enum: Object.values(BUSINESS_TYPES),
      },
      taxCode: { type: String, trim: true },
      companyName: { type: String, trim: true },
      address: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
    },

    // Admin processing
    processedBy: { type: String, default: null },
    processedAt: { type: Date, default: null },
    adminNote: { type: String, default: '' },
    matchedBankLogTxId: { type: String, default: null },

    // User confirmation
    userConfirmedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

topupRequestSchema.index({ customerId: 1, status: 1 });
topupRequestSchema.index({ status: 1, createdAt: -1 });
topupRequestSchema.index({ 'bankInfo.transferContent': 1 });

topupRequestSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('TopupRequest', topupRequestSchema);
