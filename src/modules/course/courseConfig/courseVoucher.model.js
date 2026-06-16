const mongoose = require("mongoose");
const {
  VOUCHER_TYPES,
  VOUCHER_STATUSES,
} = require("../../../core/constants/appData");

const courseVoucherSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(VOUCHER_TYPES),
      required: true,
      default: VOUCHER_TYPES.SINGLE,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    rewardPoints: {
      type: Number,
      required: true,
      min: 0,
    },
    maxUses: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    currentUses: {
      type: Number,
      default: 0,
      min: 0,
    },
    usagePerUser: {
      type: Number,
      default: 1,
      min: 0, // 0 means unlimited
    },
    batch: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(VOUCHER_STATUSES),
      default: VOUCHER_STATUSES.INACTIVE,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    deleteAt: {
      type: Date,
      default: null,
      // A TTL index will be created on this field
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  { timestamps: true, versionKey: false, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

courseVoucherSchema.virtual("creator", {
  ref: "User",
  localField: "createdBy",
  foreignField: "id",
  justOne: true,
});

// Create TTL Index for auto-cleanup of unused, expired single-use vouchers
// The index will delete the document when the current time is greater than or equal to deleteAt.
courseVoucherSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("CourseVoucher", courseVoucherSchema);
