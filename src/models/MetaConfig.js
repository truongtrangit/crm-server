const mongoose = require("mongoose");

const metricDefinitionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    unit: { type: String, default: "", trim: true },
  },
  { _id: true },
);

const metaConfigSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    badgeColor: { type: String, default: "#0668e1" },
    icon: { type: String, default: "Target" },
    /** 'metric' = theo chỉ số, 'task' = hoàn thành công việc */
    kpiType: {
      type: String,
      enum: ["metric", "task"],
      default: "metric",
    },
    /** Danh sách chỉ số mẫu (chỉ dùng khi kpiType = 'metric') */
    metrics: { type: [metricDefinitionSchema], default: [] },
    description: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

module.exports = mongoose.model("MetaConfig", metaConfigSchema);
