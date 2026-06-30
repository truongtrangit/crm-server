const mongoose = require("mongoose");

const voucherRedemptionSchema = new mongoose.Schema(
  {
    code: { 
      type: String, 
      required: true, 
      trim: true,
      index: true
    },
    userId: { 
      type: String, 
      required: true, 
      ref: "Customer",
      index: true
    },
    mainCredit: { 
      type: Number, 
      default: 0 
    },
    rewardCredit: { 
      type: Number, 
      default: 0 
    },
    eduCredit: { 
      type: Number, 
      default: 0 
    },
  },
  { 
    timestamps: { createdAt: 'redeemedAt', updatedAt: false }, 
    versionKey: false 
  }
);

module.exports = mongoose.model("VoucherRedemption", voucherRedemptionSchema);
