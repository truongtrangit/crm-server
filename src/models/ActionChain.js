const mongoose = require("mongoose");

/**
 * ActionChain: "Chuỗi hành động" - A named, ordered sequence of Actions.
 * Used as a template that ActionRules reference.
 * 
 * Example: "Chăm khách hàng đăng ký"
 *   Step #1 → Gọi điện hỏi thăm lần 1
 *   Step #2 → Gửi tài liệu qua Email
 *   Step #3 → Gọi điện lần 2
 */
const stepSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true, min: 1 },
    actionId: { type: String, ref: "Action", required: true },
    // Optional: sub-actions (hành động phụ) within a step
    subActions: [{ type: String, ref: "Action" }],
  },
  { _id: false }
);

const actionChainSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    delay: {
      type: String,
      enum: ["immediate", "1h", "4h", "1d", "3d", "7d"],
      default: "immediate",
    },
    steps: { type: [stepSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  }
);

module.exports = mongoose.model("ActionChain", actionChainSchema);
