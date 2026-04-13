const mongoose = require("mongoose");

const actionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["call", "email", "meeting", "task", "sms", "other"],
      default: "call",
    },
    resultIds: [{ type: String, ref: "Result" }],
    description: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("Action", actionSchema);
