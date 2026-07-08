const mongoose = require("mongoose");

const expenseCategorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // e.g., EPC1
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "ExpenseCategory", default: null }
  },
  {
    timestamps: true,
    versionKey: false,
    id: false, // Prevent mongoose from creating a virtual id getter
  }
);

module.exports = mongoose.model("ExpenseCategory", expenseCategorySchema);
