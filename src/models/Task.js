const mongoose = require("mongoose");
const { softDeletePlugin } = require("../utils/softDelete");

/** Mỗi nhân sự phụ trách — gắn 1 chức năng (StaffFunction) */
const assigneeSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true },
    userName: { type: String, default: "" },
    userAvatar: { type: String, default: "" },
    functionId: { type: String, ref: "StaffFunction", default: null },
    functionTitle: { type: String, default: "" },
  },
  { _id: false },
);

/** Liên kết tới Event */
const linkedEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, ref: "Event", required: true },
    eventName: { type: String, default: "" },
  },
  { _id: false },
);

/** Liên kết tới Lead */
const linkedLeadSchema = new mongoose.Schema(
  {
    leadId: { type: String, ref: "Lead", required: true },
    leadName: { type: String, default: "" },
  },
  { _id: false },
);

/** Lịch sử thao tác trong tác vụ */
const taskLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true }, // create, update, close, link, unlink...
    description: { type: String, required: true },
    user: {
      id: { type: String },
      name: { type: String },
      email: { type: String },
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },

    /** Trạng thái tác vụ */
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },

    /** Trạng thái lưu trữ */
    isArchived: { type: Boolean, default: false },

    /** Người tạo task — dùng cho resource-level access control */
    createdBy: { type: String, ref: "User", default: null, index: true },

    /** Nhiều nhân sự phụ trách, mỗi người 1 chức năng */
    assignees: [assigneeSchema],

    tags: [{ type: String }],

    /** Liên kết tới Event / Lead */
    linkedEvents: [linkedEventSchema],
    linkedLeads: [linkedLeadSchema],

    /** Ghi chú */
    note: { type: String, default: "" },

    /** Lịch sử hoạt động */
    logs: [taskLogSchema],
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

taskSchema.plugin(softDeletePlugin);

// ─── Indexes for Performance ───
taskSchema.index({ status: 1, createdAt: -1 });
taskSchema.index({ "assignees.userId": 1, status: 1 });

module.exports = mongoose.model("Task", taskSchema);
