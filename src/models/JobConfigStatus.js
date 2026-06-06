const mongoose = require("mongoose");
const { JOB_STATUS_TYPES } = require("../constants/jobConfig");

const jobStatusConfigSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // JSC...
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: JOB_STATUS_TYPES, default: 'new' },
    description: { type: String, default: "", trim: true },
    icon: { type: String, default: "fa-solid fa-circle" },
    color: { type: String, default: "#1f2937" },
    order: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  }
);

module.exports = mongoose.model("JobConfigStatus", jobStatusConfigSchema);
