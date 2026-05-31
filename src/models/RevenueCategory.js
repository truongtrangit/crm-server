const mongoose = require("mongoose");

const revenueCategorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // e.g., RVC001
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false, // Prevent mongoose from creating a virtual id getter
  }
);


module.exports = mongoose.model("RevenueCategory", revenueCategorySchema);
