const mongoose = require('mongoose');

const { INVOICE_PROVIDER_TYPES } = require('../../core/constants/invoice');

const invoiceProviderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    providerType: {
      type: String,
      enum: Object.values(INVOICE_PROVIDER_TYPES),
      required: true,
    },
    invoiceForm: { type: String, default: null, trim: true },     // Mẫu số: "1"
    invoiceSerial: { type: String, default: null, trim: true },   // Ký hiệu: "K26MAA"
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },                 // Provider mặc định

    // ─── Cấu hình gửi email/SMS tra cứu HĐ ──────────────────────────────
    emailNotification: {
      enabled: { type: Boolean, default: false },                 // Admin config: tự gửi email từ CRM?
      // Nếu false → để nhà cung cấp tự gửi (BKAV ReceiveTypeID)
    },

    // ─── BKAV-specific ────────────────────────────────────────────────────
    bkav: {
      partnerGUID: { type: String, default: null, trim: true },
      // PartnerToken lưu encrypted — Key:IV format (AES-256)
      partnerToken: { type: String, default: null, trim: true },
      cmdType: { type: Number, default: 111 },                   // CmdType mặc định: 111
      endpoint: {
        type: String,
        default: null,
        trim: true,
        // Dev: https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx
        // Prod: https://ws.ehoadon.vn/WSPublicEHoaDon.asmx
      },
      invoiceTypeId: { type: Number, default: 1 },               // 1=GTGT, 2=Bán hàng
      receiveTypeId: { type: Number, default: 3 },                // 3=Email & SMS
      autoSign: { type: Boolean, default: false },                // HSM auto-sign (cấu hình trên server BKAV)
    },

    // ─── SePay-specific ───────────────────────────────────────────────────
    sepay: {
      bearerToken: { type: String, default: null, trim: true },
      providerAccountId: { type: String, default: null, trim: true },
      templateCode: { type: String, default: null, trim: true },
      endpoint: {
        type: String,
        default: null,
        trim: true,
        // https://einvoice-api.sepay.vn
      },
    },

    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

invoiceProviderSchema.index({ providerType: 1 });
invoiceProviderSchema.index({ isActive: 1, isDefault: 1 });

module.exports = mongoose.model('InvoiceProvider', invoiceProviderSchema);
