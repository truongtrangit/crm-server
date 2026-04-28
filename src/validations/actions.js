const Joi = require("joi");
const {
  ALL_ACTION_TYPES,
  ACTION_CATEGORY_VALUES,
  ALL_RESULT_TYPES,
  ALL_NEXT_STEP_TYPES,
  ALL_CLOSE_OUTCOMES,
  ALL_BRANCH_DELAY_UNITS,
} = require("../constants/actionConfig");

const CHAIN_DELAY_UNITS = ['immediate', 'minute', 'hour', 'day', 'week'];

// ─── Result ───
const createResultSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  type: Joi.string()
    .valid(...ALL_RESULT_TYPES)
    .optional()
    .default("neutral"),
  description: Joi.string().allow("").optional(),
});

const updateResultSchema = Joi.object({
  name: Joi.string().trim().optional(),
  type: Joi.string().valid(...ALL_RESULT_TYPES).optional(),
  description: Joi.string().allow("").optional(),
}).min(1);

// ─── Reason ───
const createReasonSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  description: Joi.string().allow("").optional(),
});

const updateReasonSchema = Joi.object({
  name: Joi.string().trim().optional(),
  description: Joi.string().allow("").optional(),
}).min(1);

// ─── Action ───
const createActionSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  type: Joi.string()
    .valid(...ALL_ACTION_TYPES)
    .optional()
    .default("call"),
  category: Joi.string()
    .valid(...Object.values(ACTION_CATEGORY_VALUES))
    .optional(), // Sẽ được tự động suy ra từ type ở pre-save hook nếu không truyền
  reasonIds: Joi.array().items(Joi.string()).optional().default([]),
  blockAutomationId: Joi.string().allow(null, "").optional().default(null),
  description: Joi.string().allow("").optional(),
});

const updateActionSchema = Joi.object({
  name: Joi.string().trim().optional(),
  type: Joi.string().valid(...ALL_ACTION_TYPES).optional(),
  category: Joi.string().valid(...Object.values(ACTION_CATEGORY_VALUES)).optional(),
  reasonIds: Joi.array().items(Joi.string()).optional(),
  blockAutomationId: Joi.string().allow(null, "").optional(),
  description: Joi.string().allow("").optional(),
}).min(1);

// ─── Action Chain ───
const branchSchema = Joi.object({
  resultId: Joi.string().required(),
  order: Joi.number().integer().min(0).optional().default(0),
  nextStepType: Joi.string().valid(...ALL_NEXT_STEP_TYPES).optional().default("close_task"),
  // nextActionId bắt buộc khi nextStepType === "next_in_chain"
  nextActionId: Joi.when('nextStepType', {
    is: 'next_in_chain',
    then: Joi.string().required().messages({
      'any.required': 'nextActionId là bắt buộc khi nextStepType là next_in_chain',
      'string.empty': 'nextActionId không được để trống khi nextStepType là next_in_chain',
    }),
    otherwise: Joi.string().allow(null, '').optional().default(null),
  }),
  closeOutcome: Joi.string().valid(...ALL_CLOSE_OUTCOMES).allow(null).optional().default(null),
  delayUnit: Joi.string().valid(...ALL_BRANCH_DELAY_UNITS).allow(null).optional().default(null),
  // delayValue: 0 khi immediate, >= 1 khi có đơn vị thời gian
  delayValue: Joi.when('delayUnit', {
    is: Joi.string().valid('immediate'),
    then: Joi.number().integer().min(0).allow(null).optional().default(0),
    otherwise: Joi.number().integer().min(1).allow(null).optional().default(null),
  }),
});

const chainStepSchema = Joi.object({
  order: Joi.number().integer().min(1).required(),
  actionId: Joi.string().required(),
  branches: Joi.array().items(branchSchema).optional().default([]),
});

const createActionChainSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  description: Joi.string().allow("").optional(),
  delayUnit: Joi.string().valid(...CHAIN_DELAY_UNITS).optional().default("immediate"),
  delayValue: Joi.when('delayUnit', {
    is: Joi.string().valid('immediate'),
    then: Joi.number().integer().min(0).allow(null).optional().default(null),
    otherwise: Joi.number().integer().min(1).allow(null).optional().default(1),
  }),
  active: Joi.boolean().optional().default(true),
  steps: Joi.array().items(chainStepSchema).optional().default([]),
});

const updateActionChainSchema = Joi.object({
  name: Joi.string().trim().optional(),
  description: Joi.string().allow("").optional(),
  delayUnit: Joi.string().valid(...CHAIN_DELAY_UNITS).optional(),
  delayValue: Joi.number().integer().min(1).allow(null).optional(),
  active: Joi.boolean().optional(),
  steps: Joi.array().items(chainStepSchema).optional(),
}).min(1);

// Dedicated endpoint: save full chain rule config (steps + branches)
const saveChainRuleSchema = Joi.object({
  steps: Joi.array().items(chainStepSchema).required(),
  active: Joi.boolean().optional(),
});

const BLOCK_AUTOMATION_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// Custom Joi validator: must be a valid JSON string
const jsonStringValidator = Joi.string().custom((value, helpers) => {
  try {
    JSON.parse(value);
    return value;
  } catch {
    return helpers.error("string.invalidJson");
  }
}).messages({
  "string.invalidJson": "payloadTemplate phải là JSON hợp lệ",
});

// ─── Block Automation ───
const createBlockAutomationSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  url: Joi.string().trim().uri().required().messages({
    "any.required": "url is required",
    "string.uri": "url phải là URL hợp lệ",
  }),
  authToken: Joi.string().allow("").optional().default(""),
  method: Joi.string()
    .valid(...BLOCK_AUTOMATION_METHODS)
    .optional()
    .default("POST"),
  payloadTemplate: jsonStringValidator.optional().default("{}"),
  description: Joi.string().allow("").optional(),
  isActive: Joi.boolean().optional().default(true),
});

const updateBlockAutomationSchema = Joi.object({
  name: Joi.string().trim().optional(),
  url: Joi.string().trim().uri().optional().messages({
    "string.uri": "url phải là URL hợp lệ",
  }),
  authToken: Joi.string().allow("").optional(),
  method: Joi.string().valid(...BLOCK_AUTOMATION_METHODS).optional(),
  payloadTemplate: jsonStringValidator.optional(),
  description: Joi.string().allow("").optional(),
  isActive: Joi.boolean().optional(),
}).min(1);



// ─── List Query ───
const listQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
});

module.exports = {
  createResultSchema,
  updateResultSchema,
  createReasonSchema,
  updateReasonSchema,
  createActionSchema,
  updateActionSchema,
  createActionChainSchema,
  updateActionChainSchema,
  saveChainRuleSchema,
  createBlockAutomationSchema,
  updateBlockAutomationSchema,
  listQuerySchema,
};
