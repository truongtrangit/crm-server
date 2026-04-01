const mongoose = require("mongoose");

const staffFunctionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    desc: { type: String, default: "" },
    type: { type: String, default: "tech", trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("StaffFunction", staffFunctionSchema);
