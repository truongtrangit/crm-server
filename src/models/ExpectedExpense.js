const mongoose = require("mongoose");

const expectedExpenseSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // e.g., EPE1
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "ExpenseCategory", required: true },
    type: { type: String, enum: ["monthly", "yearly"], required: true },
    amount: { type: Number, required: true, min: 0 },
    allocatedMonths: {
      type: [Number],
      required: true,
      validate: {
        validator: function(v) {
          return v.length > 0 && v.every(m => m >= 1 && m <= 12);
        },
        message: "allocatedMonths must contain valid month numbers (1-12) and cannot be empty."
      }
    }
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  }
);

module.exports = mongoose.model("ExpectedExpense", expectedExpenseSchema);
