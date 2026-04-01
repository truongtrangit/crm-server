const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    action: { type: String, required: true, trim: true },
    time: { type: String, default: "Sắp tới" },
    timeType: {
      type: String,
      enum: ["soon", "late", "future"],
      default: "future",
    },
    customer: {
      name: { type: String, required: true, trim: true },
      avatar: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    platform: { type: String, default: "SmaxAi" },
    assignee: {
      name: { type: String, default: "" },
      avatar: { type: String, default: "" },
    },
    status: { type: String, default: "Đang thực hiện" },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("Task", taskSchema);
