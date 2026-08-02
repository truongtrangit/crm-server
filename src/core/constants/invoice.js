/**
 * ─── Invoice Constants ──────────────────────────────────────────────────────
 * Statuses, provider types, payment methods, tax rates, BKAV command types
 * for the Invoice (Hoá Đơn Điện Tử) module.
 */

const INVOICE_STATUSES = Object.freeze({
  DRAFT: 'draft',           // Nháp — chưa gửi lên provider
  PENDING: 'pending',       // Đang gửi lên provider / chờ xử lý
  ISSUED: 'issued',         // Đã phát hành thành công trên CQT
  ERROR: 'error',           // Lỗi phát hành
  CANCELLED: 'cancelled',   // Đã huỷ bỏ / xoá bỏ
  REPLACED: 'replaced',     // Đã bị thay thế bởi HĐ khác
  ADJUSTED: 'adjusted',     // Đã bị điều chỉnh bởi HĐ khác
});

const INVOICE_PROVIDER_TYPES = Object.freeze({
  BKAV: 'bkav',
  SEPAY: 'sepay',
});

const PAYMENT_METHODS = Object.freeze({
  CASH: 'TM',               // Tiền mặt
  TRANSFER: 'CK',           // Chuyển khoản
  CASH_TRANSFER: 'TM/CK',   // Tiền mặt / Chuyển khoản
});

// BKAV InvoiceTypeID mapping
const BKAV_INVOICE_TYPES = Object.freeze({
  GTGT: 1,                  // Hoá đơn Giá trị gia tăng
  BAN_HANG: 2,              // Hoá đơn Bán hàng
  XUAT_KHAU: 3,             // Hoá đơn Xuất khẩu
  PHU_LUC: 4,               // Bảng kê / Phụ lục
  PXK_VCNB: 5,              // Phiếu xuất kho kiêm vận chuyển nội bộ
});

// BKAV Command Types (CmdType)
// Reference: FAQ_WebServices_Bkav.docx.pdf, Question 3
const BKAV_CMD_TYPES = Object.freeze({
  // ─── Tạo Hoá đơn ─────────────────────────────────────────────────────
  CREATE_100: 100,           // Mẫu số + Ký hiệu do Bkav, Số HĐ=0 → "Hoá đơn mới tạo"
  CREATE_101: 101,           // Mẫu số + Ký hiệu do Bkav, Số HĐ do Bkav cấp → "Hoá đơn chờ"
  CREATE_110: 110,           // Mẫu số + Ký hiệu do PMKT, Số HĐ=0 → "Hoá đơn mới tạo"
  CREATE_111: 111,           // Mẫu số + Ký hiệu do PMKT, Số HĐ do PMKT → "Hoá đơn chờ"
  CREATE_112: 112,           // Mẫu số + Ký hiệu do PMKT, Số HĐ do Bkav cấp → "Hoá đơn chờ"

  // ─── Điều chỉnh / Thay thế ───────────────────────────────────────────
  ADJUST_121: 121,           // Tạo HĐ điều chỉnh (PMKT quản lý mẫu/ký hiệu)
  ADJUST_124: 124,           // Tạo HĐ điều chỉnh (Bkav quản lý mẫu/ký hiệu)

  // ─── Huỷ bỏ ──────────────────────────────────────────────────────────
  CANCEL_200: 200,           // Huỷ bỏ Hoá đơn

  // ─── Lấy thông tin ────────────────────────────────────────────────────
  GET_INFO_800: 800,         // Lấy thông tin Hoá đơn theo InvoiceGUID/PartnerInvoiceID
  GET_RANGE_810: 810,        // Lấy thông tin Hoá đơn theo mẫu số + ký hiệu + khoảng số
});

// BKAV TaxRateID mapping
// Reference: FAQ_WebServices_Bkav.docx.pdf, câu 2a
const BKAV_TAX_RATE_IDS = Object.freeze({
  TAX_0: 1,                 // Thuế suất 0%
  TAX_5: 2,                 // Thuế suất 5%
  TAX_10: 3,                // Thuế suất 10% (VAT chuẩn)
  TAX_8: 4,                 // Thuế suất 8%
  TAX_KCT: 5,               // Không chịu thuế
  TAX_KKK: 6,               // Không kê khai
});

// BKAV PayMethodID mapping
const BKAV_PAY_METHOD_IDS = Object.freeze({
  CASH: 1,                  // Tiền mặt
  TRANSFER: 2,              // Chuyển khoản
  CASH_TRANSFER: 3,         // Tiền mặt / Chuyển khoản
});

// BKAV ReceiveTypeID (hình thức nhận hoá đơn)
const BKAV_RECEIVE_TYPES = Object.freeze({
  EMAIL: 1,
  SMS: 2,
  EMAIL_SMS: 3,
  COURIER: 4,               // Chuyển phát nhanh
});

// Relation types cho HĐ thay thế / điều chỉnh
const INVOICE_RELATION_TYPES = Object.freeze({
  REPLACEMENT: 'replacement',  // Thay thế
  ADJUSTMENT: 'adjustment',    // Điều chỉnh
});

// Default max invoices per BKAV request
const BKAV_MAX_INVOICES_PER_REQUEST = 30;

module.exports = {
  INVOICE_STATUSES,
  INVOICE_PROVIDER_TYPES,
  PAYMENT_METHODS,
  BKAV_INVOICE_TYPES,
  BKAV_CMD_TYPES,
  BKAV_TAX_RATE_IDS,
  BKAV_PAY_METHOD_IDS,
  BKAV_RECEIVE_TYPES,
  INVOICE_RELATION_TYPES,
  BKAV_MAX_INVOICES_PER_REQUEST,
};
