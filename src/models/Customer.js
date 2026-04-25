const mongoose = require("mongoose");
const { softDeletePlugin } = require("../utils/softDelete");

const assigneeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    userName: { type: String, default: "" },
    userAvatar: { type: String, default: "" },
    role: { type: String, required: true, trim: true },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: String, default: null },
  },
  { _id: false, id: false },
);

const customerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: "" },
    type: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true, unique: true },
    phone: { type: String, default: "", index: true, unique: true, sparse: true },
    biz: { type: [String], default: [] },
    platforms: { type: [String], default: [] },
    group: { type: String, default: "" },
    registeredAt: { type: String, default: "" },
    lastLoginAt: { type: String, default: "" },
    tags: { type: [String], default: [] },
    assignees: { type: [assigneeSchema], default: [] },
    extraInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

customerSchema.plugin(softDeletePlugin);
module.exports = mongoose.model("Customer", customerSchema);
