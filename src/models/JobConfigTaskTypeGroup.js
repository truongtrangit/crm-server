const mongoose = require("mongoose");

const jobTaskTypeGroupSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // JTG...
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  }
);

module.exports = mongoose.model("JobConfigTaskTypeGroup", jobTaskTypeGroupSchema);
