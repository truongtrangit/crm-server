const mongoose = require('mongoose');

const { BANK_LOG_TX_STATUSES } = require('../../core/constants/bankLog');

const bankLogTransactionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    txId: { type: String, required: true, unique: true, trim: true },
    bank: { type: String, required: true, trim: true },
    sender: { type: String, default: null, trim: true },
    amount: { type: Number, required: true },
    content: { type: String, default: null, trim: true },
    transactionDate: { type: Date, default: null },
    status: {
      type: String,
      enum: Object.values(BANK_LOG_TX_STATUSES),
      default: BANK_LOG_TX_STATUSES.PENDING,
    },
    matchedRuleName: { type: String, default: null },
    matchedRuleId: { type: String, default: null },
    targetApiUrl: { type: String, default: null },
    apiResponseCode: { type: Number, default: null },
    apiResponseBody: { type: mongoose.Schema.Types.Mixed, default: null },
    retryCount: { type: Number, default: 0 },
    lastRetryAt: { type: Date, default: null },
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    processingDurationMs: { type: Number, default: null },
    createdBy: { type: String, default: 'system' },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

bankLogTransactionSchema.index({ bank: 1, status: 1 });
bankLogTransactionSchema.index({ transactionDate: -1 });
bankLogTransactionSchema.index({ status: 1 });

module.exports = mongoose.model('BankLogTransaction', bankLogTransactionSchema);
