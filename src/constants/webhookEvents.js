/**
 * Webhook Event Types — nguồn sự thật duy nhất cho các loại event từ bên thứ 3.
 *
 * Khi bên thứ 3 thêm event mới → thêm vào đây + tạo processor trong WebhookService.
 * Mapping trực tiếp với EVENT_GROUP_IDS trong eventGroups.js.
 */

const WEBHOOK_EVENT_TYPES = Object.freeze({
  USER_MOI: "user_moi", // Khách hàng đăng ký mới
  BIZ_MOI: "biz_moi", // Khách hàng tạo biz mới
  SAP_HET_HAN: "sap_het_han", // Biz cần gia hạn
  CAN_NANG_CAP: "can_nang_cap", // Biz cần nâng cấp
});

/** Mảng các event type — dùng làm enum cho validation */
const WEBHOOK_EVENT_TYPE_LIST = Object.values(WEBHOOK_EVENT_TYPES);

module.exports = { WEBHOOK_EVENT_TYPES, WEBHOOK_EVENT_TYPE_LIST };
