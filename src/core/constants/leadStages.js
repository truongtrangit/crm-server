/**
 * LEAD_STAGES — 4 giai đoạn cố định cho Lead pipeline.
 *
 * Thứ tự từ trái → phải, user confirm stage hiện tại → tự chuyển sang stage tiếp.
 * - BE: Lead.js schema import LEAD_STAGE_IDS để làm enum.
 * - FE: src/constants/leadStages.ts dùng cùng cấu trúc (maintain thủ công).
 */

const LEAD_STAGES = Object.freeze([
  { id: "lead_moi", label: "Lead mới", color: "#3b82f6", bg: "#eff6ff", order: 0 },
  { id: "dang_lien_he", label: "Đang liên hệ", color: "#f97316", bg: "#fff7ed", order: 1 },
  { id: "dang_tu_van", label: "Đang tư vấn", color: "#eab308", bg: "#fefce8", order: 2 },
  { id: "chot_hop_dong", label: "Chốt hợp đồng", color: "#22c55e", bg: "#f0fdf4", order: 3 },
]);

/** Mảng các id — dùng làm enum cho Mongoose schema */
const LEAD_STAGE_IDS = LEAD_STAGES.map((s) => s.id);

/** Map id → config — dùng để lookup nhanh */
const LEAD_STAGE_MAP = Object.fromEntries(LEAD_STAGES.map((s) => [s.id, s]));

/** Hàm lấy stage tiếp theo (return null nếu đã ở stage cuối) */
function getNextStage(currentStageId) {
  const current = LEAD_STAGE_MAP[currentStageId];
  if (!current) return null;
  return LEAD_STAGES.find((s) => s.order === current.order + 1) || null;
}

module.exports = { LEAD_STAGES, LEAD_STAGE_IDS, LEAD_STAGE_MAP, getNextStage };
