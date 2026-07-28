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
    // ─── ACB-specific fields ──────────────────────────────────────────────
    debitOrCredit: { type: String, enum: ['credit', 'debit'], default: null },
    accountNumber: { type: String, default: null, trim: true },
    transactionChannel: {
      type: String,
      enum: [
        'BAT', 'VRU', 'WWW', 'ATM', 'ONLI', 'ACH', 'FSC', 'CCM', 'API', 'MG',
        'SECU', 'MAPP', 'SMS', 'ACHS', 'CCAT', 'AAP', 'IBFT', 'CLMS', 'REMI',
        'TB', 'SOBA', 'BIZ',
      ],
      default: null,
    },
    acbTransactionCode: { type: mongoose.Schema.Types.Mixed, default: null },
    acbClientId: { type: String, default: null, trim: true },
    acbClientRequestId: { type: String, default: null, trim: true },
    acbRequestCode: { type: String, enum: ['TRANSACTION_UPDATE', 'TRANSACTION_HISTORY'], default: null },
    acbTransactionStatus: { type: String, enum: ['COMPLETED', 'ERRORCORRECTED'], default: null },
    effectiveDate: { type: Date, default: null },
    // ─── Processing fields ────────────────────────────────────────────────
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
bankLogTransactionSchema.index({ transactionDate: -1, createdAt: -1 });
bankLogTransactionSchema.index({ status: 1 });
bankLogTransactionSchema.index({ matchedRuleId: 1 });

module.exports = mongoose.model('BankLogTransaction', bankLogTransactionSchema);
