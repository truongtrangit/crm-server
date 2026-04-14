const mongoose = require("mongoose");

const actionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["call", "send_block_automation", "review", "manual_order", "email", "sms", "meeting", "other"],
      default: "call",
    },
    reasonIds: [{ type: String, ref: "Reason", default: [] }],
    description: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("Action", actionSchema);
