const mongoose = require('mongoose');

const { ZCODE_STATUSES, ZCODE_ERROR_REASONS } = require('../../core/constants/zcode');

const zcodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    batchDate: { type: Date, required: true },
    importedAt: { type: Date, required: true },
    sku: { type: String, required: true },
    keyCode: { type: String, required: true, unique: true, trim: true },
    partA: { type: String, required: true, trim: true },
    partB: { type: String, required: true, trim: true },
    partC: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(ZCODE_STATUSES),
      default: ZCODE_STATUSES.AVAILABLE,
    },
    errorReason: {
      type: String,
      enum: [...Object.values(ZCODE_ERROR_REASONS), null],
      default: null,
    },
    calledAt: { type: Date, default: null },
    respondedAt: { type: Date, default: null },
    responseTime: { type: String, default: null },
    callerIp: { type: String, default: null },
    createdBy: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Compound index for fast redeem lookups
zcodeSchema.index({ sku: 1, partialCode: 1, status: 1 });

module.exports = mongoose.model('ZCode', zcodeSchema);
