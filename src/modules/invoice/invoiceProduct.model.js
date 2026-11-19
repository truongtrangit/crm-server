const mongoose = require('mongoose');

const invoiceProductSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // IVP-YYYYMMDD-XXXX
    code: { type: String, required: true, trim: true, uppercase: true }, // SKU / Mã hàng hoá (Unique per tenant)
    name: { type: String, required: true, trim: true }, // Tên hàng hoá, dịch vụ
    unitName: { type: String, default: 'Lần', trim: true }, // Đơn vị tính (Khóa, Lần, Chiếc, Gói, Tháng...)
    unitPrice: { type: Number, default: 0, min: 0 }, // Đơn giá mặc định (chưa thuế)
    taxRateId: { type: Number, default: 3 }, // BKAV TaxRateID: 1=0%, 2=5%, 3=10%, 4=KCT, 5=KKK, 9=8%
    taxRate: { type: Number, default: 10 }, // Thuế suất %: 0, 5, 8, 10, -1, -2
    itemTypeId: { type: Number, default: 0 }, // BKAV ItemTypeID: 0=HHDV, 1=Khuyến mại, 2=Chiết khấu, 3=Ghi chú
    description: { type: String, default: '', trim: true }, // Mô tả chi tiết sản phẩm / ghi chú
    userDefineDetails: { type: String, default: '' }, // Thông tin mở rộng mẫu (UserDefineDetails cho BKAV)
    isActive: { type: Boolean, default: true }, // Trạng thái kích hoạt
    isDeleted: { type: Boolean, default: false }, // Soft-delete
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

invoiceProductSchema.index({ code: 1, isDeleted: 1 });
invoiceProductSchema.index({ name: 1 });
invoiceProductSchema.index({ isActive: 1, isDeleted: 1 });

module.exports = mongoose.model('InvoiceProduct', invoiceProductSchema);
