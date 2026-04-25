const mongoose = require("mongoose");
const { softDeletePlugin } = require("../utils/softDelete");
const {
  ALL_NEXT_STEP_TYPES,
  ALL_CLOSE_OUTCOMES,
  ALL_BRANCH_DELAY_UNITS,
} = require("../constants/actionConfig");

/**
 * EventActionChain — "Chuỗi hành động trong sự kiện"
 *
 * Thiết kế:
 *  - Clone toàn bộ steps + branches từ ActionChain template vào đây
 *  - User thao tác trên bản clone, KHÔNG ảnh hưởng template gốc
 *  - Mỗi step có scheduledAt (thời điểm cần thực hiện) để phục vụ "Task Queue" tab
 *  - Step lần lượt từng cái: step tiếp theo chỉ unlock sau khi step trước được Save
 */

// ─── Branch clone schema (cho mỗi step trong event chain) ───
const eventBranchSchema = new mongoose.Schema(
  {
    resultId:    { type: String, ref: "Result", required: true },
    order:       { type: Number, default: 0 },
    nextStepType: {
      type: String,
      enum: ALL_NEXT_STEP_TYPES,
      default: "close_task",
    },
    nextActionId:  { type: String, default: null },
    closeOutcome: {
      type: String,
      enum: [...ALL_CLOSE_OUTCOMES, null],
      default: null,
    },
    // Delay có thể do user chỉnh trong event (độc lập với template)
    delayUnit:  { type: String, enum: ['immediate', 'minute', 'hour', 'day', 'week', null], default: null },
    delayValue: { type: Number, default: null },
  },
  { _id: false }
);

// ─── Step schema ───
const eventChainStepSchema = new mongoose.Schema(
  {
    order:         { type: Number, required: true, min: 1 },

    // Snapshot thông tin action tại thời điểm clone
    actionId:      { type: String, ref: "Action", required: true },
    actionName:    { type: String, default: "" },
    actionType:    { type: String, default: "" },   // call | email | send_block_automation | ...
    actionCategory:{ type: String, default: "" },   // primary | secondary
    actionReasonIds: [{ type: String }],            // để filter reasons

    // Branches cloned từ template (user có thể xem, nhưng không sửa — chỉ sửa note)
    branches:      { type: [eventBranchSchema], default: [] },

    // ─── Runtime: user chọn trong event ───
    selectedResultId:  { type: String, default: null },
    selectedReasonId:  { type: String, default: null },
    note:              { type: String, default: "" },

    // ─── Delay scheduling ───
    /**
     * Delay được clone từ branch được chọn (quy tắc).
     * User có thể chỉnh sửa delayUnit / delayValue trong event.
     * scheduledAt = activatedAt + delay → dùng cho Task Queue.
     */
    delayUnit:   { type: String, enum: ['immediate', 'minute', 'hour', 'day', 'week', null], default: null },
    delayValue:  { type: Number, default: null },
    // Bắt đầu đếm từ thời điểm step được activate (step trước được Save)
    activatedAt: { type: Date, default: null },
    // scheduledAt = activatedAt + delay, tính tự động khi save
    scheduledAt: { type: Date, default: null },
    // Thời điểm user thực sự bấm Lưu (hoàn thành step)
    completedAt: { type: Date, default: null },

    delayEditNote: { type: String, default: "" }, // lý do chỉnh sửa delay

    // ─── Status ───
    /**
     * pending   → chưa tới lượt (step sau step hiện tại)
     * active    → đang xử lý (step hiện tại)
     * done      → đã Lưu kết quả
     * skipped   → bỏ qua (close_chain, etc.)
     */
    status: {
      type: String,
      enum: ["pending", "active", "done", "skipped"],
      default: "pending",
    },

    // Step đã lock (sau khi Save lần đầu, chỉ sửa được note)
    isLocked: { type: Boolean, default: false },

    /**
     * Step thực sự được activate tiếp theo sau khi step này done.
     * Lưu lại để hiển thị đúng "Bước tiếp theo" kể cả khi user đã override.
     */
    activatedNextStepOrder: { type: Number, default: null },
  },
  { _id: false }
);

// ─── Main schema ───
const eventActionChainSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },

    // Reference tới event
    eventId: { type: String, ref: "Event", required: true, index: true },

    // Reference tới template gốc (để trace / không cho duplicate)
    chainId: { type: String, ref: "ActionChain", required: true },
    name:    { type: String, required: true, trim: true },

    /**
     * active  → đang hoạt động
     * closed  → đã đóng (không thể mở lại)
     */
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },

    // Thứ tự hiển thị trong list (01, 02, 03...)
    order: { type: Number, default: 1 },

    // Index step đang active (0-based)
    currentStepIndex: { type: Number, default: 0 },

    steps: { type: [eventChainStepSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  }
);

// ─── Compound index: không cho 2 chain cùng chainId trên 1 event ───
eventActionChainSchema.index({ eventId: 1, chainId: 1 }, { unique: true });

// ─── Index cho Task Queue tab (query steps cần làm theo scheduledAt) ───
eventActionChainSchema.index({ "steps.scheduledAt": 1, "steps.status": 1 });

eventActionChainSchema.plugin(softDeletePlugin);

module.exports = mongoose.model("EventActionChain", eventActionChainSchema);
