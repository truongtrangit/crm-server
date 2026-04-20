/**
 * Constants dùng chung cho Action Config (Action, Chain, Rule, Result, Reason)
 * Tất cả enum BE nên import từ đây thay vì hardcode inline.
 */

// ─── Action Types ───
const ACTION_TYPE_VALUES = Object.freeze({
  CALL:                  "call",
  SEND_BLOCK_AUTOMATION: "send_block_automation",
  OTHER:                 "other",
  // Hành động phụ
  REVIEW:                "review",
  MANUAL_ORDER:          "manual_order",
  CREATE_BOOKING:        "create_booking",
  // ── Để thêm type mới: đận đây một dòng + thêm vào nhóm bên dưới ──
});

/** Nhóm loại hành động: chính / phụ */
const ACTION_CATEGORY_VALUES = Object.freeze({
  PRIMARY:   "primary",   // Hành động chính
  SECONDARY: "secondary", // Hành động phụ
});

const PRIMARY_ACTION_TYPES = [
  ACTION_TYPE_VALUES.CALL,
  ACTION_TYPE_VALUES.SEND_BLOCK_AUTOMATION,
  ACTION_TYPE_VALUES.OTHER,
];

const SECONDARY_ACTION_TYPES = [
  ACTION_TYPE_VALUES.REVIEW,
  ACTION_TYPE_VALUES.MANUAL_ORDER,
  ACTION_TYPE_VALUES.CREATE_BOOKING,
  // Để thêm hành động phụ mới: thêm key vào ACTION_TYPE_VALUES bên trên và append vào đây
];

const ALL_ACTION_TYPES = [...PRIMARY_ACTION_TYPES, ...SECONDARY_ACTION_TYPES];

/** Map type → category để tự động suy ra category khi không truyền */
const ACTION_TYPE_CATEGORY_MAP = Object.freeze(
  Object.fromEntries([
    ...PRIMARY_ACTION_TYPES.map(t => [t, ACTION_CATEGORY_VALUES.PRIMARY]),
    ...SECONDARY_ACTION_TYPES.map(t => [t, ACTION_CATEGORY_VALUES.SECONDARY]),
  ])
);

// ─── Result Types ───
const RESULT_TYPE_VALUES = Object.freeze({
  SUCCESS:    "success",
  FAILURE:    "failure",
  NEUTRAL:    "neutral",      // Hoàn thành
  INCOMPLETE: "incomplete",   // Chưa hoàn thành
  SKIP:       "skip",
});

const ALL_RESULT_TYPES = Object.values(RESULT_TYPE_VALUES);

// ─── Branch / Next Step Types ───
/**
 * Các loại bước tiếp theo trong nhánh kết quả:
 *  next_in_chain          → Hành động tiếp theo trong chuỗi (chọn action cụ thể trong chain)
 *  close_task             → Đóng tác vụ (rồi chọn thành công / thất bại)
 *  close_chain            → Đóng chuỗi HĐ
 *  close_chain_clone_task → Đóng chuỗi HĐ và tạo bản sao Tác vụ
 *  create_order           → Tạo đơn hàng
 *  call_block_automation  → Gọi Block Automation
 *  add_from_other_chain   → Thêm HĐ từ chuỗi khác
 *  close_task_success     → Đóng tác vụ (thành công) — shorthand
 *  close_task_failure     → Đóng tác vụ (thất bại) — shorthand
 */
const NEXT_STEP_TYPE_VALUES = Object.freeze({
  NEXT_IN_CHAIN:          "next_in_chain",
  CLOSE_TASK:             "close_task",
  CLOSE_CHAIN:            "close_chain",
  CLOSE_CHAIN_CLONE_TASK: "close_chain_clone_task",
  CREATE_ORDER:           "create_order",
  CALL_BLOCK_AUTOMATION:  "call_block_automation",
  ADD_FROM_OTHER_CHAIN:   "add_from_other_chain",
});

const ALL_NEXT_STEP_TYPES = Object.values(NEXT_STEP_TYPE_VALUES);

/** Outcome khi đóng tác vụ */
const CLOSE_OUTCOME_VALUES = Object.freeze({
  SUCCESS: "success",
  FAILURE: "failure",
});

const ALL_CLOSE_OUTCOMES = Object.values(CLOSE_OUTCOME_VALUES);

const BRANCH_DELAY_UNIT_VALUES = Object.freeze({
  IMMEDIATE: "immediate",
  MINUTE:    "minute",
  HOUR:      "hour",
  DAY:       "day",
  WEEK:      "week",
});

const ALL_BRANCH_DELAY_UNITS = Object.values(BRANCH_DELAY_UNIT_VALUES);

module.exports = {
  // Action types
  ACTION_TYPE_VALUES,
  ACTION_CATEGORY_VALUES,
  PRIMARY_ACTION_TYPES,
  SECONDARY_ACTION_TYPES,
  ALL_ACTION_TYPES,
  ACTION_TYPE_CATEGORY_MAP,
  // Result types
  RESULT_TYPE_VALUES,
  ALL_RESULT_TYPES,
  // Next step / Branch
  NEXT_STEP_TYPE_VALUES,
  ALL_NEXT_STEP_TYPES,
  CLOSE_OUTCOME_VALUES,
  ALL_CLOSE_OUTCOMES,
  BRANCH_DELAY_UNIT_VALUES,
  ALL_BRANCH_DELAY_UNITS,
};
