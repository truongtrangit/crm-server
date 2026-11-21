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
// Reference: FAQ_WebServices_Bkav.docx.pdf, Phụ lục 5 (trang 71)
const BKAV_INVOICE_TYPES = Object.freeze({
  GTGT: 1, // Hóa đơn Giá trị gia tăng
  BAN_HANG: 2, // Hóa đơn bán hàng
  BAN_HANG_PTQ: 4, // Hóa đơn bán hàng (dành cho Tổ chức, Cá nhân trong khu PTQ)
  PXK_VCNB: 5, // Phiếu xuất kho & vận chuyển nội bộ
  PXK_DAI_LY: 6, // Phiếu xuất kho gửi bán hàng đại lý
});

// BKAV Command Types (CmdType)
// Reference: eHoaDon_WebService_Interface.docx (source of truth), Bkav_eHoadon_Layer.cs
// NOTE: CmdType 112 = documented in root docx (eHD cấp InvoiceNo) but NOT in demo docx.
//       203, 204 (update variants), 205, 206 (HSM signing), 300, 304 (CQT explain),
//       803, 805, 810-813, 850 are extension commands BKAV supports in practice.
const BKAV_CMD_TYPES = Object.freeze({
  // ─── Tạo Hoá đơn ─────────────────────────────────────────────────────
  CREATE_100: 100, // Mẫu số + Ký hiệu do Bkav, Số HĐ=0 → "Hoá đơn mới tạo"
  CREATE_101: 101, // Mẫu số + Ký hiệu do Bkav, Số HĐ do Bkav cấp → "Hoá đơn chờ"
  CREATE_110: 110, // Mẫu số + Ký hiệu do PMKT, Số HĐ=0 → "Hoá đơn mới tạo"
  CREATE_111: 111, // Mẫu số + Ký hiệu do PMKT, Số HĐ do PMKT tự cấp → "Hoá đơn chờ"
                   // CRM không hỗ trợ tự cấp InvoiceNo → backend tự động chuyển sang 112
  CREATE_112: 112, // [Extension] Mẫu số + Ký hiệu do PMKT, Số HĐ do Bkav cấp → "Hoá đơn chờ"

  // ─── Thay thế Hoá đơn ────────────────────────────────────────────────
  REPLACE_120: 120, // Thay thế — Bkav quản lý mẫu/ký hiệu, InvoiceNo=0
  REPLACE_123: 123, // Thay thế — PMKT quản lý mẫu/ký hiệu + Bkav cấp số HĐ

  // ─── Điều chỉnh Hoá đơn ──────────────────────────────────────────────
  ADJUST_121: 121, // Điều chỉnh — Bkav quản lý mẫu/ký hiệu, InvoiceNo=0
  ADJUST_124: 124, // Điều chỉnh — PMKT quản lý mẫu/ký hiệu + Bkav cấp số HĐ

  // ─── Điều chỉnh chiết khấu ───────────────────────────────────────────
  ADJUST_DISCOUNT_122: 122, // Điều chỉnh chiết khấu — PMKT quản lý mẫu/ký hiệu, InvoiceNo=0
  ADJUST_DISCOUNT_126: 126, // Điều chỉnh chiết khấu — PMKT quản lý mẫu/ký hiệu, Bkav cấp số HĐ

  // ─── Cập nhật HĐ chưa ký phát hành ───────────────────────────────────
  UPDATE_200: 200, // Cập nhật HĐ bằng PartnerInvoiceID
  UPDATE_203: 203, // Cập nhật HĐ bằng mẫu số + ký hiệu
  UPDATE_204: 204, // Cập nhật HĐ bằng InvoiceGUID

  // ─── Huỷ HĐ đã phát hành ─────────────────────────────────────────────
  CANCEL_201: 201, // Huỷ HĐ bằng InvoiceGUID
  CANCEL_202: 202, // Huỷ HĐ bằng PartnerInvoiceID

  // ─── Ký Hoá đơn bằng HSM ─────────────────────────────────────────────
  // [Extension] Không có trong tài liệu gốc nhưng được BKAV hỗ trợ
  SIGN_HSM_205: 205, // Ký 1 HĐ bằng HSM
  SIGN_HSM_206: 206, // Ký nhiều HĐ bằng HSM

  // ─── Giải trình với CQT ──────────────────────────────────────────────
  // [Extension] Không có trong tài liệu gốc nhưng được BKAV hỗ trợ
  EXPLAIN_300: 300, // Giải trình HĐ sai sót (không cần TT/ĐC)
  EXPLAIN_304: 304, // Giải trình HĐ bị thay thế / bị điều chỉnh

  // ─── Xoá bỏ HĐ chưa phát hành ────────────────────────────────────────
  DELETE_DRAFT_301: 301, // Xoá bỏ HĐ chưa PH bằng PartnerInvoiceID
  DELETE_DRAFT_303: 303, // Xoá bỏ HĐ chưa PH bằng InvoiceGUID

  // ─── Upload file Excel ────────────────────────────────────────────────
  UPLOAD_FILE_500: 500, // Upload file Excel danh sách HĐ

  // ─── Lấy thông tin ────────────────────────────────────────────────────
  GET_INFO_800: 800,     // Lấy thông tin HĐ theo InvoiceGUID/PartnerInvoiceID
  GET_STATUS_801: 801,   // Lấy trạng thái HĐ theo InvoiceGUID
  GET_HISTORY_802: 802,  // Lấy lịch sử thao tác HĐ
  GET_PDF_803: 803,      // [Extension] Lấy file PDF HĐ theo InvoiceGUID
  GET_LINK_804: 804,     // Lấy link tải hoá đơn chuyển đổi (PartnerInvoiceID/InvoiceGUID)
  GET_XML_805: 805,      // [Extension] Lấy file XML HĐ theo InvoiceGUID
  GET_PDF_808: 808,      // Lấy PDF base64 theo PartnerInvoiceID/PartnerInvoiceStringID
  GET_XML_809: 809,      // Lấy XML base64 theo PartnerInvoiceID/PartnerInvoiceStringID
  // [Extension] Các cmd sau không có trong tài liệu gốc:
  GET_RANGE_810: 810,            // Lấy thông tin HĐ theo mẫu số + ký hiệu + khoảng số
  GET_PDF_BY_MTC_811: 811,       // Lấy PDF bản thể hiện base64 theo Mã tra cứu
  GET_CONVERTED_PDF_BY_MTC_812: 812, // Lấy PDF bản chuyển đổi base64 theo Mã tra cứu
  GET_XML_BY_MTC_813: 813,       // Lấy XML base64 theo Mã tra cứu
  GET_TAX_STATUS_850: 850,       // Lấy trạng thái và mã cơ quan thuế

  // ─── Khác ─────────────────────────────────────────────────────────────
  RESEND_EMAIL_901: 901, // Gửi lại email mã tra cứu (ReSend)
  LOOKUP_TAX_904: 904,   // Tra cứu thông tin doanh nghiệp theo MST
});

// BKAV TaxRateID mapping
// Reference: FAQ_WebServices_Bkav.docx.pdf, câu 2a
const BKAV_TAX_RATE_IDS = Object.freeze({
  TAX_0: 1, // Thuế suất 0%
  TAX_5: 2, // Thuế suất 5%
  TAX_10: 3, // Thuế suất 10% (VAT chuẩn)
  TAX_8: 9, // Thuế suất 8%
  TAX_KCT: 4, // Không chịu thuế (TaxRate = -1)
  TAX_KKK: 5, // Không kê khai nộp thuế (TaxRate = -2)
  TAX_OTHER: 6, // Thuế suất khác (TaxRate = -4)
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
  REPLACEMENT: 'replacement',           // Thay thế
  ADJUSTMENT: 'adjustment',             // Điều chỉnh thông tin / số tiền
  ADJUSTMENT_DISCOUNT: 'adjustment_discount', // Điều chỉnh giảm (chiết khấu, CmdType 122/126)
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
