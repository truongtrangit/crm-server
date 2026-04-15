const mongoose = require("mongoose");
const { ALL_CHAIN_DELAYS, ALL_NEXT_STEP_TYPES, ALL_CLOSE_OUTCOMES, ALL_BRANCH_DELAY_UNITS } = require("../constants/actionConfig");

/**
 * ActionChain: "Chuỗi hành động"
 *
 * Mỗi step trong chuỗi có:
 *   - order: thứ tự
 *   - actionId: hành động được thực hiện
 *   - branches: danh sách kết quả → bước tiếp theo
 *
 * Branch schema:
 *   - resultId: kết quả (ref Result)
 *   - order: thứ tự hiển thị của nhánh (drag-drop)
 *   - nextStepType: loại bước tiếp theo
 *   - nextActionId: chỉ khi nextStepType === "next_in_chain"
 *   - closeOutcome: chỉ khi nextStepType === "close_task" (success / failure)
 */

const branchSchema = new mongoose.Schema(
  {
    resultId:    { type: String, ref: "Result", required: true },
    order:       { type: Number, default: 0 },
    nextStepType: {
      type: String,
      enum: ALL_NEXT_STEP_TYPES,
      default: "close_task",
    },
    // Only for nextStepType === "next_in_chain"
    nextActionId: { type: String, ref: "Action", default: null },
    // Only for nextStepType === "close_task"
    closeOutcome: {
      type: String,
      enum: [...ALL_CLOSE_OUTCOMES, null],
      default: null,
    },
    // Optional per-branch delay
    delayUnit:  { type: String, enum: [...ALL_BRANCH_DELAY_UNITS, null], default: null },
    delayValue: { type: Number, default: null },
  },
  { _id: false }
);

const stepSchema = new mongoose.Schema(
  {
    order:     { type: Number, required: true, min: 1 },
    actionId:  { type: String, ref: "Action", required: true },
    branches:  { type: [branchSchema], default: [] },
  },
  { _id: false }
);

const actionChainSchema = new mongoose.Schema(
  {
    id:          { type: String, required: true, unique: true },
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    delay: {
      type: String,
      enum: ALL_CHAIN_DELAYS,
      default: "immediate",
    },
    active: { type: Boolean, default: true },
    steps: { type: [stepSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  }
);

module.exports = mongoose.model("ActionChain", actionChainSchema);
