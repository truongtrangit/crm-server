const mongoose = require("mongoose");

const CompanyProportionSchema = new mongoose.Schema(
  {
    company: { type: String, required: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const expectedRevenueSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // e.g., RVE1
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "RevenueCategory", required: true },
    companyProportions: [CompanyProportionSchema],
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ["single", "allocated"], default: "single" },
    expectedDate: { type: Date },
    allocatedMonths: { 
      type: [String], // Array of "MM/YYYY"
      validate: {
        validator: function(v) {
          if (this.type === 'single') return true;
          return v.length > 0 && v.every(m => /^(0[1-9]|1[0-2])\/\d{4}$/.test(m));
        },
        message: 'Tháng phân bổ không hợp lệ (định dạng MM/YYYY)'
      },
      default: []
    }
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("ExpectedRevenue", expectedRevenueSchema);
