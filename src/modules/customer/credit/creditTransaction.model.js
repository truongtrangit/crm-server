const mongoose = require("mongoose");
const { softDeletePlugin } = require("../../../core/utils/softDelete");
const {
  CREDIT_TRANSACTION_TYPES,
  CREDIT_TYPES,
  CREDIT_SOURCES,
  CREDIT_TRANSACTION_STATUS,
} = require("../../../core/constants/appData");

const creditTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      ref: "Customer",
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    creditType: {
      type: String,
      enum: Object.values(CREDIT_TYPES),
      required: true,
    },
    transactionType: {
      type: String,
      enum: Object.values(CREDIT_TRANSACTION_TYPES),
      required: true,
    },
    source: {
      type: String,
      required: true,
      enum: Object.values(CREDIT_SOURCES),
    },
    reference: {
      type: String,
      required: true,
      trim: true,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
    },
    transactionGroupId: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(CREDIT_TRANSACTION_STATUS),
      default: CREDIT_TRANSACTION_STATUS.SUCCESS,
    },
    description: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Prevent double processing of the exact same request
creditTransactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true }
);

// Prevent double spending of the same voucher/code (smaxai codes are uniquely one-time use globally)
creditTransactionSchema.index(
  { source: 1, reference: 1 },
  { unique: true, partialFilterExpression: { source: CREDIT_SOURCES.SMAXAI } }
);

creditTransactionSchema.plugin(softDeletePlugin);

module.exports = mongoose.model("CreditTransaction", creditTransactionSchema);
