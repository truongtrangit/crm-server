const mongoose = require("mongoose");

const CompanyProportionSchema = new mongoose.Schema(
  {
    company: { type: String, required: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const expectedExpenseSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // e.g., EPE1
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "ExpenseCategory", required: true },
    companyProportions: [CompanyProportionSchema],
    type: { type: String, enum: ["monthly", "yearly"], required: true },
    amount: { type: Number, required: true, min: 0 },
    allocatedMonths: {
      type: [String], // Array of "MM/YYYY"
      required: true,
      validate: {
        validator: function(v) {
          return v.length > 0 && v.every(m => /^(0[1-9]|1[0-2])\/\d{4}$/.test(m));
        },
        message: 'Tháng phân bổ không hợp lệ (định dạng MM/YYYY)'
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
