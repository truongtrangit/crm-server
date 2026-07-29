const mongoose = require('mongoose');

const {
  BANK_LOG_CONDITION_PARAMS,
  BANK_LOG_OPERATORS,
  BANK_LOG_AUTH_TYPES,
} = require('../../core/constants/bankLog');

const conditionSchema = new mongoose.Schema(
  {
    parameter: {
      type: String,
      enum: Object.values(BANK_LOG_CONDITION_PARAMS),
      required: true,
    },
    operator: {
      type: String,
      enum: Object.values(BANK_LOG_OPERATORS),
      required: true,
    },
    value: { type: String, required: true },
  },
  { _id: false },
);

const targetApiSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    method: { type: String, default: 'POST', enum: ['POST', 'PUT', 'PATCH'] },
    authType: {
      type: String,
      enum: Object.values(BANK_LOG_AUTH_TYPES),
      default: BANK_LOG_AUTH_TYPES.NONE,
    },
    authToken: { type: String, default: null },
    headers: { type: Map, of: String, default: {} },
    timeout: { type: Number, default: null, min: 1, max: 60 },
  },
  { _id: false },
);

const bankLogRoutingRuleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    priority: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true },
    targetApi: { type: targetApiSchema, required: true },
    conditions: { type: [conditionSchema], required: true, validate: v => v.length > 0 },
    createdBy: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

bankLogRoutingRuleSchema.index({ priority: 1 });
bankLogRoutingRuleSchema.index({ isActive: 1 });

module.exports = mongoose.model('BankLogRoutingRule', bankLogRoutingRuleSchema);
