/**
 * ─── Invoice Constants ──────────────────────────────────────────────────────
 * Statuses, provider types, payment methods, tax rates, BKAV command types
 * for the Invoice (Hoá Đơn Điện Tử) module.
 */

const INVOICE_STATUSES = Object.freeze({
  DRAFT: 'draft', // Nháp — chưa gửi lên provider
  PENDING_SIGN: 'pending_sign', // Chờ ký — đã tạo/cấp số trên BKAV, chờ ký HSM
  PENDING: 'pending', // Đang gửi lên provider / chờ xử lý
  ISSUED: 'issued', // Đã phát hành thành công trên CQT
  ERROR: 'error', // Lỗi phát hành
  CANCELLED: 'cancelled', // Đã huỷ bỏ / xoá bỏ
  REPLACED: 'replaced', // Đã bị thay thế bởi HĐ khác
  ADJUSTED: 'adjusted', // Đã bị điều chỉnh bởi HĐ khác
});

const INVOICE_PROVIDER_TYPES = Object.freeze({
  BKAV: 'bkav',
  SEPAY: 'sepay',
});

const PAYMENT_METHODS = Object.freeze({
  CASH: 'TM', // Tiền mặt
  TRANSFER: 'CK', // Chuyển khoản
  CASH_TRANSFER: 'TM/CK', // Tiền mặt / Chuyển khoản
});

// BKAV InvoiceTypeID mapping
const BKAV_INVOICE_TYPES = Object.freeze({
  GTGT: 1, // Hoá đơn Giá trị gia tăng
  BAN_HANG: 2, // Hoá đơn Bán hàng
  XUAT_KHAU: 3, // Hoá đơn Xuất khẩu
  PHU_LUC: 4, // Bảng kê / Phụ lục
  PXK_VCNB: 5, // Phiếu xuất kho kiêm vận chuyển nội bộ
});

// BKAV Command Types (CmdType)
// Reference: FAQ_WebServices_Bkav.docx.pdf
const BKAV_CMD_TYPES = Object.freeze({
  // ─── Tạo Hoá đơn ─────────────────────────────────────────────────────
  CREATE_100: 100, // Mẫu số + Ký hiệu do Bkav, Số HĐ=0 → "Hoá đơn mới tạo"
  CREATE_101: 101, // Mẫu số + Ký hiệu do Bkav, Số HĐ do Bkav cấp → "Hoá đơn chờ"
  CREATE_110: 110, // Mẫu số + Ký hiệu do PMKT, Số HĐ=0 → "Hoá đơn mới tạo"
  CREATE_111: 111, // Mẫu số + Ký hiệu do PMKT, Số HĐ do PMKT → "Hoá đơn chờ"
  CREATE_112: 112, // Mẫu số + Ký hiệu do PMKT, Số HĐ do Bkav cấp → "Hoá đơn chờ"

  // ─── Thay thế Hoá đơn ────────────────────────────────────────────────
  REPLACE_120: 120, // Thay thế — Bkav quản lý mẫu/ký hiệu
  REPLACE_122: 122, // Thay thế — PMKT mẫu/ký hiệu, Bkav cấp số
  REPLACE_123: 123, // Thay thế — PMKT quản lý mẫu/ký hiệu + số HĐ
  REPLACE_125: 125, // Thay thế variant (PMKT)
  REPLACE_126: 126, // Thay thế variant
  REPLACE_127: 127, // Thay thế variant

  // ─── Điều chỉnh Hoá đơn ──────────────────────────────────────────────
  ADJUST_121: 121, // Điều chỉnh — PMKT quản lý mẫu/ký hiệu
  ADJUST_124: 124, // Điều chỉnh — Bkav quản lý mẫu/ký hiệu

  // ─── Cập nhật HĐ chưa ký phát hành ───────────────────────────────────
  UPDATE_200: 200, // Cập nhật HĐ bằng PartnerInvoiceID
  UPDATE_203: 203, // Cập nhật HĐ bằng mẫu số + ký hiệu
  UPDATE_204: 204, // Cập nhật HĐ bằng InvoiceGUID

  // ─── Huỷ HĐ đã phát hành ─────────────────────────────────────────────
  CANCEL_201: 201, // Huỷ HĐ bằng InvoiceGUID
  CANCEL_202: 202, // Huỷ HĐ bằng PartnerInvoiceID

  // ─── Ký Hoá đơn bằng HSM ─────────────────────────────────────────────
  SIGN_HSM_205: 205, // Ký 1 HĐ bằng HSM
  SIGN_HSM_206: 206, // Ký nhiều HĐ bằng HSM

  // ─── Giải trình với CQT ──────────────────────────────────────────────
  EXPLAIN_300: 300, // Giải trình HĐ sai sót (không cần TT/ĐC)
  EXPLAIN_304: 304, // Giải trình HĐ bị thay thế / bị điều chỉnh

  // ─── Xoá bỏ HĐ chưa phát hành ────────────────────────────────────────
  DELETE_DRAFT_301: 301, // Xoá bỏ HĐ chưa PH bằng PartnerInvoiceID
  DELETE_DRAFT_303: 303, // Xoá bỏ HĐ chưa PH bằng InvoiceGUID

  // ─── Đính kèm file ───────────────────────────────────────────────────
  ATTACH_FILE_502: 502, // Đính kèm file bằng PartnerInvoiceID
  ATTACH_FILE_503: 503, // Đính kèm file bằng InvoiceGUID

  // ─── Lấy thông tin ────────────────────────────────────────────────────
  GET_INFO_800: 800, // Lấy thông tin HĐ theo InvoiceGUID/PartnerInvoiceID
  GET_RANGE_810: 810, // Lấy thông tin HĐ theo mẫu số + ký hiệu + khoảng số
  GET_TAX_STATUS_850: 850, // Lấy trạng thái và mã cơ quan thuế

  // ─── Khác ─────────────────────────────────────────────────────────────
  RESEND_EMAIL_901: 901, // Gửi lại email mã tra cứu
  LOOKUP_TAX_904: 904, // Tra cứu thông tin doanh nghiệp (MST)
});

// BKAV TaxRateID mapping
// Reference: FAQ_WebServices_Bkav.docx.pdf, câu 2a
const BKAV_TAX_RATE_IDS = Object.freeze({
  TAX_0: 1, // Thuế suất 0%
  TAX_5: 2, // Thuế suất 5%
  TAX_10: 3, // Thuế suất 10% (VAT chuẩn)
  TAX_8: 9, // Thuế suất 8%
  TAX_KCT: -1, // Không chịu thuế
  TAX_KKK: -2, // Không kê khai
});

// BKAV PayMethodID mapping
const BKAV_PAY_METHOD_IDS = Object.freeze({
  CASH: 1, // Tiền mặt
  TRANSFER: 2, // Chuyển khoản
  CASH_TRANSFER: 3, // Tiền mặt / Chuyển khoản
});

// BKAV ReceiveTypeID (hình thức nhận hoá đơn)
const BKAV_RECEIVE_TYPES = Object.freeze({
  EMAIL: 1,
  SMS: 2,
  EMAIL_SMS: 3,
  COURIER: 4, // Chuyển phát nhanh
});

// Relation types cho HĐ thay thế / điều chỉnh
const INVOICE_RELATION_TYPES = Object.freeze({
  REPLACEMENT: 'replacement', // Thay thế
  ADJUSTMENT: 'adjustment', // Điều chỉnh
});

// Các nguồn phát sinh hóa đơn (Source Modules)
const INVOICE_SOURCE_MODULES = Object.freeze({
  COURSE_CREDIT: 'course_credit', // Nạp credit khóa học
  DIRECT_SALE: 'direct_sale', // Bán hàng trực tiếp / Tạo thủ công
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
  INVOICE_SOURCE_MODULES,
  BKAV_MAX_INVOICES_PER_REQUEST,
};
