const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: "" },
    timeAgo: { type: String, default: "Vừa xong" },
    tags: { type: [String], default: [] },
    assignee: {
      name: { type: String, default: "" },
      avatar: { type: String, default: "" },
    },
    status: { type: String, required: true, trim: true },
    actionNeeded: { type: String, default: "" },
    actionType: {
      type: String,
      enum: ["green", "orange", "blue", ""],
      default: "",
    },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    source: { type: String, default: "" },
    address: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("Lead", leadSchema);
