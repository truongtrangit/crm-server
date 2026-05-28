const mongoose = require("mongoose");

const { REVENUE_STATUSES } = require("../constants/finance");

const revenueSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true }, // e.g., RVC-2605-01
    customerName: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "RevenueCategory", required: true },
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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);


module.exports = mongoose.model("Revenue", revenueSchema);
