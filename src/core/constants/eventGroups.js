/**
 * EVENT_GROUPS — nguồn sự thật duy nhất cho danh sách nhóm sự kiện.
 *
 * Khi cần thêm / đổi / xoá nhóm → chỉ sửa ở đây.
 * - BE: Event.js schema import EVENT_GROUP_IDS để làm enum.
 * - FE: src/constants/eventGroups.ts dùng cùng cấu trúc (maintain thủ công).
 */

const EVENT_GROUPS = Object.freeze([
  { id: 'user_moi',     label: 'User mới',      color: '#3b82f6', bg: '#eff6ff' },
  { id: 'biz_moi',      label: 'Biz Mới',       color: '#9333ea', bg: '#f5f3ff' },
  { id: 'can_nang_cap', label: 'Cần nâng cấp',  color: '#22c55e', bg: '#f0fdf4' },
  { id: 'sap_het_han',  label: 'Sắp hết hạn',   color: '#f97316', bg: '#fff7ed' },
  { id: 'chuyen_khoan', label: 'Chuyển khoản',  color: '#eab308', bg: '#fefce8' },
]);

/** Mảng các id — dùng làm enum cho Mongoose schema */
const EVENT_GROUP_IDS = EVENT_GROUPS.map((g) => g.id);

/** Map id → config — dùng để lookup nhanh */
const EVENT_GROUP_MAP = Object.fromEntries(EVENT_GROUPS.map((g) => [g.id, g]));

module.exports = { EVENT_GROUPS, EVENT_GROUP_IDS, EVENT_GROUP_MAP };
