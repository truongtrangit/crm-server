const mongoose = require("mongoose");

const checklistItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    assignees: [{ type: String, ref: "User" }], // Array of User IDs
    isCompleted: { type: Boolean, default: false },
    dueDate: { type: Date, default: null },
  },
  { _id: false }
);

const logSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    description: { type: String },
    user: {
      id: { type: String },
      name: { type: String },
      email: { type: String },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const jobTaskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // JBT...
    name: { type: String, required: true, trim: true },
    folderId: { type: String, ref: "JobFolder", default: null },
    jobChannelIds: [{ type: String, ref: "JobConfigChannel" }], // Multiple channels support
    jobTaskTypeId: { type: String, ref: "JobConfigTaskType", default: null },
    statusId: { type: String, ref: "JobConfigStatus", required: true },
    assignees: [{ type: String, ref: "User" }],

    scheduledDate: { type: Date, default: null }, // Ngày làm việc theo kế hoạch
    dueDate: { type: Date, default: null }, // Hạn chót

    sourceRuleId: { type: String, ref: "JobConfigRepeatRule", default: null }, // Nếu tạo từ quy tắc

    details: { type: String, default: "" }, // Mô tả công việc (Rich Text)
    shortDescription: { type: String, default: "" },
    allowDirectLinkAccess: { type: Boolean, default: false }, // Cho phép ai có link trực tiếp đều xem được
    linkAccessUsers: [{ type: String, ref: "User" }], // Specific users allowed to view via link

    checklists: [checklistItemSchema],
    logs: [logSchema],

    createdBy: { type: String, ref: "User", default: null }, // null = SYSTEM (Cron)
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  }
);

// Indexes để query nhanh trên Kanban
jobTaskSchema.index({ statusId: 1 });
jobTaskSchema.index({ folderId: 1 });
jobTaskSchema.index({ scheduledDate: 1 });
jobTaskSchema.index({ assignees: 1 });

module.exports = mongoose.model("JobTask", jobTaskSchema);
