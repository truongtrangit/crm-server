const Joi = require('joi');

const {
  BANK_LOG_CONDITION_PARAMS,
  BANK_LOG_OPERATORS,
  BANK_LOG_AUTH_TYPES,
} = require('../../core/constants/bankLog');

// ─── Shared sub-schemas ─────────────────────────────────────────────────────

const conditionSchema = Joi.object({
  parameter: Joi.string()
    .valid(...Object.values(BANK_LOG_CONDITION_PARAMS))
    .required()
    .messages({
      'any.only': 'Parameter phải là amount, content, hoặc sender',
      'any.required': 'Parameter là bắt buộc',
    }),
  operator: Joi.string()
    .valid(...Object.values(BANK_LOG_OPERATORS))
    .required()
    .messages({
      'any.only': 'Operator không hợp lệ',
      'any.required': 'Operator là bắt buộc',
    }),
  value: Joi.string().trim().required().messages({
    'string.empty': 'Giá trị so sánh không được để trống',
    'any.required': 'Giá trị so sánh là bắt buộc',
  }),
});

const targetApiSchema = Joi.object({
  url: Joi.string().uri().required().messages({
    'string.uri': 'URL API đích phải là URL hợp lệ',
    'any.required': 'URL API đích là bắt buộc',
  }),
  method: Joi.string().valid('POST', 'PUT', 'PATCH').default('POST'),
  authType: Joi.string()
    .valid(...Object.values(BANK_LOG_AUTH_TYPES))
    .default(BANK_LOG_AUTH_TYPES.NONE),
  authToken: Joi.string().trim().allow(null, '').default(null).when('authType', {
    is: Joi.string().valid(
      BANK_LOG_AUTH_TYPES.BEARER,
      BANK_LOG_AUTH_TYPES.API_KEY,
      BANK_LOG_AUTH_TYPES.BASIC,
    ),
    then: Joi.string().trim().required().messages({
      'any.required': 'Auth token là bắt buộc khi chọn auth type',
    }),
  }),
  headers: Joi.object().pattern(Joi.string(), Joi.string()).default({}),
  timeout: Joi.number().integer().min(1).max(60).allow(null).default(null),
});

// ─── Routing Rule Schemas ────────────────────────────────────────────────────

const createRuleSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'string.empty': 'Tên quy tắc không được để trống',
    'any.required': 'Tên quy tắc là bắt buộc',
  }),
  targetApi: targetApiSchema.required().messages({
    'any.required': 'Cấu hình API đích là bắt buộc',
  }),
  priority: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
  conditions: Joi.array().items(conditionSchema).min(1).required().messages({
    'array.min': 'Phải có ít nhất 1 điều kiện',
    'any.required': 'Điều kiện là bắt buộc',
  }),
});

const updateRuleSchema = Joi.object({
  name: Joi.string().trim(),
  targetApi: targetApiSchema,
  priority: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
  conditions: Joi.array().items(conditionSchema).min(1).messages({
    'array.min': 'Phải có ít nhất 1 điều kiện',
  }),
}).min(1);

// ─── Webhook Ingestion Schema ────────────────────────────────────────────────

const ingestTransactionSchema = Joi.object({
  txId: Joi.string().trim().required().messages({
    'string.empty': 'Mã giao dịch không được để trống',
    'any.required': 'Mã giao dịch là bắt buộc',
  }),
  bank: Joi.string().trim().required().messages({
    'string.empty': 'Tên ngân hàng không được để trống',
    'any.required': 'Tên ngân hàng là bắt buộc',
  }),
  sender: Joi.string().trim().allow(null, '').default(null),
  amount: Joi.number().required().messages({
    'number.base': 'Số tiền phải là số',
    'any.required': 'Số tiền là bắt buộc',
  }),
  content: Joi.string().trim().allow(null, '').default(null),
  transactionDate: Joi.date().allow(null).default(null),
}).options({ stripUnknown: false });

// ─── ACB Webhook Transaction Schema ──────────────────────────────────────────

const acbTransactionSchema = Joi.object({
  txId: Joi.string().trim().required().messages({
    'string.empty': 'Transaction ID không được để trống',
    'any.required': 'Transaction ID là bắt buộc',
  }),
  amount: Joi.number().required().min(0).messages({
    'number.base': 'Số tiền phải là số',
    'number.min': 'Số tiền không được âm',
    'any.required': 'Số tiền là bắt buộc',
  }),
  sender: Joi.string().trim().allow(null, '').default(null),
  content: Joi.string().trim().allow(null, '').default(null),
  transactionDate: Joi.date().allow(null).default(null),
}).options({ stripUnknown: false });

module.exports = {
  createRuleSchema,
  updateRuleSchema,
  ingestTransactionSchema,
  acbTransactionSchema,
};
