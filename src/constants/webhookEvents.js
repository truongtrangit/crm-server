/**
 * Webhook Event Types — nguồn sự thật duy nhất cho các loại event từ bên thứ 3.
 *
 * Khi bên thứ 3 thêm event mới → thêm vào đây + tạo processor trong WebhookService.
 * Mapping trực tiếp với EVENT_GROUP_IDS trong eventGroups.js.
 */

const WEBHOOK_EVENT_TYPES = Object.freeze({
  NEW_REGISTRATION: "user_moi", // user mới
  NEW_BUSINESS: "biz_moi", // business mới
  PLAN_EXPIRED: "sap_het_han", // sắp hết hạn
  PLAN_UPGRADE: "can_nang_cap", // cần nâng cấp
});

/** Mảng các event type — dùng làm enum cho validation */
const WEBHOOK_EVENT_TYPE_LIST = Object.values(WEBHOOK_EVENT_TYPES);

module.exports = { WEBHOOK_EVENT_TYPES, WEBHOOK_EVENT_TYPE_LIST };
