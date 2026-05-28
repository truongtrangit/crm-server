const mongoose = require("mongoose");
const { EXPENSE_STATUSES } = require("../constants/finance");

const expenseSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true }, // e.g., EPC-2605-01
    recordDate: { type: Date, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "ExpenseCategory", default: null },
    description: { type: String, default: "", trim: true },
    amount: { type: Number, required: true, min: 0 },
    assigneeId: { type: String, ref: "User", default: null }, // Mapped to User id (string)
    status: {
      type: String,
      enum: Object.values(EXPENSE_STATUSES),
      required: true,
      default: EXPENSE_STATUSES.PENDING
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Expense", expenseSchema);
