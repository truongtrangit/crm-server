/**
 * Constants dùng chung cho Action Config (Action, Chain, Rule, Result, Reason)
 * Tất cả enum BE nên import từ đây thay vì hardcode inline.
 */

// ─── Action Types ───
const ACTION_TYPE_VALUES = Object.freeze({
  CALL:                  "call",
  EMAIL:                 "email",
  MEETING:               "meeting",
  SMS:                   "sms",
  SEND_BLOCK_AUTOMATION: "send_block_automation",
  REVIEW:                "review",
  MANUAL_ORDER:          "manual_order",
  OTHER:                 "other",
});

/** Nhóm loại hành động: chính / phụ */
const ACTION_CATEGORY_VALUES = Object.freeze({
  PRIMARY:   "primary",   // Hành động chính
  SECONDARY: "secondary", // Hành động phụ
});

const PRIMARY_ACTION_TYPES   = [
  ACTION_TYPE_VALUES.CALL,
  ACTION_TYPE_VALUES.SEND_BLOCK_AUTOMATION,
  ACTION_TYPE_VALUES.OTHER,
];

const SECONDARY_ACTION_TYPES = [
  ACTION_TYPE_VALUES.REVIEW,
  ACTION_TYPE_VALUES.MANUAL_ORDER,
  ACTION_TYPE_VALUES.EMAIL,
  ACTION_TYPE_VALUES.SMS,
  ACTION_TYPE_VALUES.MEETING,
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

// ─── Chain Delays ───
const CHAIN_DELAY_VALUES = Object.freeze({
  IMMEDIATE: "immediate",
  ONE_HOUR:  "1h",
  FOUR_HOURS: "4h",
  ONE_DAY:   "1d",
  THREE_DAYS: "3d",
  SEVEN_DAYS: "7d",
});

const ALL_CHAIN_DELAYS = Object.values(CHAIN_DELAY_VALUES);

// ─── Rule / Branch ───
const NEXT_STEP_TYPE_VALUES = Object.freeze({
  NEXT_IN_CHAIN:   "next_in_chain",
  SPECIFIC_ACTION: "specific_action",
  CLOSE:           "close",
});

const ALL_NEXT_STEP_TYPES = Object.values(NEXT_STEP_TYPE_VALUES);

const CLOSE_STATUS_VALUES = Object.freeze({
  SUCCESS: "success",
  FAILURE: "failure",
});

const ALL_CLOSE_STATUSES = Object.values(CLOSE_STATUS_VALUES);

const BRANCH_DELAY_UNIT_VALUES = Object.freeze({
  IMMEDIATE: "immediate",
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
  // Chain delays
  CHAIN_DELAY_VALUES,
  ALL_CHAIN_DELAYS,
  // Rule / Branch
  NEXT_STEP_TYPE_VALUES,
  ALL_NEXT_STEP_TYPES,
  CLOSE_STATUS_VALUES,
  ALL_CLOSE_STATUSES,
  BRANCH_DELAY_UNIT_VALUES,
  ALL_BRANCH_DELAY_UNITS,
};
