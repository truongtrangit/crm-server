const mongoose = require("mongoose");

/**
 * Branch: Defines what happens for a specific result in a step.
 *   - resultId: The result that triggers this branch
 *   - nextStep: "action" (continue to another step) | "close" (end the chain)
 *   - nextActionId: If nextStep === "action", which action to go to next
 *   - closeStatus: If nextStep === "close", the final status ("success" | "failure")
 *   - delay: How long to wait before executing the next step
 */
const branchSchema = new mongoose.Schema(
  {
    resultId: { type: String, ref: "Result", required: true },
    nextStep: {
      type: String,
      enum: ["action", "close"],
      default: "close",
    },
    nextActionId: { type: String, ref: "Action", default: null },
    closeStatus: {
      type: String,
      enum: ["success", "failure", null],
      default: null,
    },
    delay: {
      type: String,
      enum: ["immediate", "1h", "4h", "1d", "3d", "7d"],
      default: "immediate",
    },
  },
  { _id: false },
);

/**
 * Step: One action in the chain with its branching logic.
 */
const stepSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    actionId: { type: String, ref: "Action", required: true },
    branches: [branchSchema],
  },
  { _id: true },
);

/**
 * ActionChain: A workflow connecting multiple actions with result-based branching.
 * Example: "Chăm khách mới đăng ký"
 *   Step 1: Gọi hỏi thăm lần 1
 *     → Kết quả "Quan tâm" → Step 2
 *     → Kết quả "Thất bại" → Close (failure)
 *   Step 2: Gửi email báo giá
 *     → Kết quả "Đã gửi" → Close (success)
 */
const actionChainSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    delay: {
      type: String,
      enum: ["immediate", "1h", "4h", "1d", "3d", "7d"],
      default: "immediate",
    },
    description: { type: String, default: "" },
    steps: [stepSchema],
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("ActionChain", actionChainSchema);
