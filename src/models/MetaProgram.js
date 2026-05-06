const mongoose = require("mongoose");
const { softDeletePlugin } = require("../utils/softDelete");

const kpiTargetSchema = new mongoose.Schema(
  {
    metricName: { type: String, required: true, trim: true },
    unit: { type: String, default: "", trim: true },
    target: { type: Number, required: true, min: 0 },
    current: { type: Number, default: 0, min: 0 },
  },
  { _id: true },
);

const milestoneSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    metricName: { type: String, required: true },
    valueAdded: { type: Number, default: 0 },
    totalCurrent: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
    note: { type: String, default: "" },
    createdBy: { type: String, default: "" },
  },
  { _id: true, timestamps: true },
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    picId: { type: String, default: null },
    picName: { type: String, default: "" },
    description: { type: String, default: "" },
    deadline: { type: Date, default: null },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { _id: true, timestamps: true },
);

const attachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    createdBy: { type: String, default: "" },
  },
  { _id: true, timestamps: true },
);

const metaProgramSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    typeId: { type: String, ref: "MetaConfig", required: true },
    /** Budget type: 'fixed' or 'range' */
    budgetType: {
      type: String,
      enum: ["fixed", "range"],
      default: "fixed",
    },
    budget: { type: Number, default: 0, min: 0 },
    budgetMin: { type: Number, default: 0, min: 0 },
    budgetMax: { type: Number, default: 0, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    picIds: { type: [String], default: [] },
    description: { type: String, default: "" },
    descriptionHtml: { type: String, default: "" },
    /** KPI targets — only used when the linked MetaConfig.kpiType = 'metric' */
    kpiTargets: { type: [kpiTargetSchema], default: [] },
    /** Computed progress percentage (0–100+) */
    progressPercent: { type: Number, default: 0, min: 0 },
    /** Milestone history for metric updates */
    milestones: { type: [milestoneSchema], default: [] },
    /** Checklist tasks */
    tasks: { type: [taskSchema], default: [] },
    /** Attached links */
    attachments: { type: [attachmentSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

metaProgramSchema.plugin(softDeletePlugin);

module.exports = mongoose.model("MetaProgram", metaProgramSchema);
