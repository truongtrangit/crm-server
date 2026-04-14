const mongoose = require("mongoose");

/**
 * ActionRule: "Cấu hình quy tắc" - The automation workflow editor.
 * 
 * A rule defines a named workflow with:
 * - A list of steps (from a chain or custom)
 * - For each step: multiple branches (result → next action / close)
 * 
 * Example rule "Chăm khách hàng đăng ký":
 *   Step #1: Gọi điện hỏi thăm lần 1
 *     → Kết quả "Khách ko quan tâm"       → Đóng tác vụ → Thất bại   (ngay lập tức)
 *     → Kết quả "Khách hứng thú đang mơ mộng" → Hành động tiếp      → Gửi tài liệu  (ngay lập tức)
 *     → Kết quả "Khách đang tìm hiểu thêm" → Hành động tiếp          → Gọi điện lần 2 (3 ngày)
 *   Step #2: Gửi tài liệu qua Email
 *     → Kết quả "Thành công" → Hành động tiếp trong chuỗi → Gọi lần 2 (3 ngày)
 *   Step #3: Gọi điện lần 2
 */

const branchSchema = new mongoose.Schema(
  {
    resultId: { type: String, ref: "Result", required: true },
    // What happens next
    nextStepType: {
      type: String,
      enum: ["next_in_chain", "specific_action", "close"],
      default: "close",
    },
    // Only for nextStepType === "specific_action": which actionId to jump to
    nextActionId: { type: String, ref: "Action", default: null },
    // Only for nextStepType === "close": how it ends
    closeStatus: {
      type: String,
      enum: ["success", "failure", null],
      default: null,
    },
    // delay before executing next step
    delayUnit: {
      type: String,
      enum: ["immediate", "hour", "day", "week"],
      default: "immediate",
    },
    delayValue: { type: Number, default: 0 },
  },
  { _id: false }
);

const ruleStepSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true, min: 1 },
    actionId: { type: String, ref: "Action", required: true },
    branches: { type: [branchSchema], default: [] },
  },
  { _id: false }
);

const actionRuleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    active: { type: Boolean, default: true },
    // Reference to a chain (optional - can build custom steps without chain)
    chainId: { type: String, ref: "ActionChain", default: null },
    // Delay between chain trigger and first step
    delay: {
      type: String,
      enum: ["immediate", "1h", "4h", "1d", "3d", "7d"],
      default: "immediate",
    },
    steps: { type: [ruleStepSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  }
);

module.exports = mongoose.model("ActionRule", actionRuleSchema);
