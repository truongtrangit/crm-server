const mongoose = require("mongoose");

const jobStatusConfigSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // JSC...
    name: { type: String, required: true, trim: true },
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
