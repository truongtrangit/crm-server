const mongoose = require("mongoose");
const { softDeletePlugin } = require("../utils/softDelete");
const { EVENT_GROUP_IDS } = require("../constants/eventGroups");

const timelineEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["phone", "email", "event", "note"],
      default: "event",
    },
    title: { type: String, required: true, trim: true },
    time: { type: String, default: "" },
    content: { type: String, default: null },
    duration: { type: String, default: null },
    createdBy: { type: String, default: "" },
  },
  { _id: true, timestamps: true },
);

const eventSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    sub: { type: String, default: "" },
    group: {
      type: String,
      enum: EVENT_GROUP_IDS,
      required: true,
    },
    customerId: { type: String, ref: "Customer", default: null },
    customer: {
      name: { type: String, required: true, trim: true },
      avatar: { type: String, default: "" },
      role: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      source: { type: String, default: "" },
      address: { type: String, default: "" },
    },
    biz: {
      id: { type: String, default: "" },
      tags: [{ type: String }],
    },
    assigneeId: { type: String, ref: "User", default: null },
    assignee: {
      name: { type: String, default: "" },
      avatar: { type: String, default: "" },
      role: { type: String, default: "" },
      department: [{ type: String }],
      group: [{ type: String }],
    },
    stage: { type: String, default: "" },
    source: { type: String, default: "CRM" },
    tags: [{ type: String }],
    plan: {
      name: { type: String, default: "TRIAL" },
      cycle: { type: String, default: "Thanh toán theo tháng" },
      price: { type: String, default: "0 đ" },
      daysLeft: { type: Number, default: 30 },
      expiryDate: { type: String, default: "" },
    },
    services: [
      {
        name: { type: String, required: true },
        active: { type: Boolean, default: true },
      },
    ],
    quotas: [
      {
        name: { type: String, required: true },
        used: { type: Number, default: 0 },
        total: { type: mongoose.Schema.Types.Mixed, default: 10 },
        color: { type: String, default: "blue" },
      },
    ],
    timeline: [timelineEntrySchema],
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

eventSchema.plugin(softDeletePlugin);

module.exports = mongoose.model("Event", eventSchema);
