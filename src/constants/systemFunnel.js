/**
 * System Funnel — Dữ liệu phễu hệ thống mặc định.
 *
 * Các entity này được seed tự động khi khởi tạo hệ thống
 * và KHÔNG cho phép xoá.
 */

/** IDs cố định cho các entity hệ thống */
const SYSTEM_IDS = Object.freeze({
  FOLDER:       "SYS_FFOL",
  GROUP:        "SYS_FGRP",
  FUNNEL:       "SYS_FNL",
  STATUS_GROUP: "SYS_LSG",
});

/** 4 trạng thái chuẩn của phễu hệ thống */
const SYSTEM_STATUSES = [
  { id: "SYS_LS1", name: "Lead mới",       type: "Chưa liên hệ", color: "#3b82f6", isDefault: true,  isActive: true },
  { id: "SYS_LS2", name: "Đang liên hệ",   type: "Đã liên hệ",   color: "#f97316", isDefault: false, isActive: true },
  { id: "SYS_LS3", name: "Đang tư vấn",    type: "Thương lượng",  color: "#eab308", isDefault: false, isActive: true },
  { id: "SYS_LS4", name: "Chốt hợp đồng",  type: "Thành công",    color: "#22c55e", isDefault: false, isActive: true },
];

const SYSTEM_STATUS_IDS = SYSTEM_STATUSES.map(s => s.id);

/**
 * Kiểm tra 1 ID có phải entity hệ thống không.
 * @param {string} id
 * @returns {boolean}
 */
function isSystemEntity(id) {
  if (!id) return false;
  return (
    Object.values(SYSTEM_IDS).includes(id) ||
    SYSTEM_STATUS_IDS.includes(id)
  );
}

module.exports = {
  SYSTEM_IDS,
  SYSTEM_STATUSES,
  SYSTEM_STATUS_IDS,
  isSystemEntity,
};
