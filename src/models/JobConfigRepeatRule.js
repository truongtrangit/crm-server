const mongoose = require("mongoose");

const checklistItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    assignees: [{ type: String, ref: "User" }], // Array of User IDs (String)
    isCompleted: { type: Boolean, default: false },
    dueOffsetHours: { type: Number, default: null }, // Mặc định + vào 7h sáng ngày sinh task
  },
  { _id: false },
);

const jobRepeatRuleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // JRR...
    name: { type: String, required: true, trim: true },
    channelIds: [{ type: String, ref: "JobConfigChannel" }], // Multiple channels support
    taskTypeId: { type: String, ref: "JobConfigTaskType", required: true },
    assignees: [{ type: String, ref: "User" }], // Array of User IDs
    cycleType: { type: String, enum: ["weekly", "monthly"], required: true },
    cycleValues: [{ type: Number }], // 0-6 for weekly, 1-31 for monthly
    details: { type: String, default: "" }, // Mô tả chi tiết/Rich text
    shortDescription: { type: String, default: "" }, // Mô tả ngắn
    folderId: { type: String, ref: "JobFolder", default: null },
    checklists: [checklistItemSchema],
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("JobConfigRepeatRule", jobRepeatRuleSchema);
