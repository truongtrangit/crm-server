const mongoose = require("mongoose");

const expectedRevenueSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // e.g., RVE1
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "RevenueCategory", required: true },
    amount: { type: Number, required: true, min: 0 },
    expectedDate: { type: Date, required: true },
    allocatedMonths: { 
      type: [Number], 
      validate: {
        validator: function(v) {
          return v.every(month => month >= 1 && month <= 12);
        },
        message: 'Tháng phân bổ phải từ 1 đến 12'
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
