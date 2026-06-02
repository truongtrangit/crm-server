const mongoose = require("mongoose");

const staffFunctionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    desc: { type: String, default: "" },
    type: { type: String, default: "tech", trim: true },
    icon: { type: String, default: "Zap", trim: true },
    color: { type: String, default: "#3b82f6", trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("StaffFunction", staffFunctionSchema);
