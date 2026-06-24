const mongoose = require("mongoose");

const { REVENUE_STATUSES } = require('../../../core/constants/finance');

const CompanyProportionSchema = new mongoose.Schema(
  {
    company: { type: String, required: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const revenueSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true }, // e.g., RVC-2605-01
    customerName: { type: String, required: true, trim: true },
    companyProportions: [CompanyProportionSchema],
    category: { type: mongoose.Schema.Types.ObjectId, ref: "RevenueCategory", default: null },
    details: { type: String, default: "", trim: true },
    amount: { type: Number, required: true, min: 0 },
    recordDate: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(REVENUE_STATUSES),
      required: true,
      default: REVENUE_STATUSES.PENDING
    },
    notes: { type: String, default: "", trim: true },
    expectedRevenueId: { type: mongoose.Schema.Types.ObjectId, ref: "ExpectedRevenue", default: null },
    isExpected: { type: Boolean, default: false }
  },
  {
    timestamps: true,
    versionKey: false,
  }
);


module.exports = mongoose.model("Revenue", revenueSchema);
