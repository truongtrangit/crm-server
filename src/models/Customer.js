const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: "" },
    type: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: "" },
    biz: { type: [String], default: [] },
    platforms: { type: [String], default: [] },
    group: { type: String, default: "" },
    registeredAt: { type: String, default: "" },
    lastLoginAt: { type: String, default: "" },
    tags: { type: [String], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("Customer", customerSchema);
