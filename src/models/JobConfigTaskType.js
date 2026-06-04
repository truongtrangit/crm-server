const mongoose = require("mongoose");

const jobTaskTypeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // JTT...
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    icon: { type: String, default: "fa-solid fa-tasks" },
    color: { type: String, default: "#1f2937" },
    isSystem: { type: Boolean, default: false }, // Cannot be deleted if true
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  }
);

module.exports = mongoose.model("JobConfigTaskType", jobTaskTypeSchema);
