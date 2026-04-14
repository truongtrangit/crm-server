const Joi = require("joi");
const {
  ALL_ACTION_TYPES,
  ACTION_CATEGORY_VALUES,
  ALL_RESULT_TYPES,
  ALL_CHAIN_DELAYS,
  ALL_NEXT_STEP_TYPES,
  ALL_CLOSE_STATUSES,
  ALL_BRANCH_DELAY_UNITS,
} = require("../constants/actionConfig");

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
  description: Joi.string().allow("").optional(),
});

const updateActionSchema = Joi.object({
  name: Joi.string().trim().optional(),
  type: Joi.string().valid(...ALL_ACTION_TYPES).optional(),
  category: Joi.string().valid(...Object.values(ACTION_CATEGORY_VALUES)).optional(),
  reasonIds: Joi.array().items(Joi.string()).optional(),
  description: Joi.string().allow("").optional(),
}).min(1);

// ─── Action Chain ───
const chainStepSchema = Joi.object({
  order: Joi.number().integer().min(1).required(),
  actionId: Joi.string().required(),
  subActions: Joi.array().items(Joi.string()).optional().default([]),
});

const createActionChainSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  description: Joi.string().allow("").optional(),
  delay: Joi.string()
    .valid(...ALL_CHAIN_DELAYS)
    .optional()
    .default("immediate"),
  steps: Joi.array().items(chainStepSchema).optional().default([]),
});

const updateActionChainSchema = Joi.object({
  name: Joi.string().trim().optional(),
  description: Joi.string().allow("").optional(),
  delay: Joi.string().valid(...ALL_CHAIN_DELAYS).optional(),
  steps: Joi.array().items(chainStepSchema).optional(),
}).min(1);

// ─── Action Rule ───
const branchSchema = Joi.object({
  resultId: Joi.string().required(),
  nextStepType: Joi.string()
    .valid(...ALL_NEXT_STEP_TYPES)
    .default("close"),
  nextActionId: Joi.string().allow(null, "").optional().default(null),
  closeStatus: Joi.string()
    .valid(...ALL_CLOSE_STATUSES)
    .allow(null)
    .optional()
    .default(null),
  delayUnit: Joi.string()
    .valid(...ALL_BRANCH_DELAY_UNITS)
    .optional()
    .default("immediate"),
  delayValue: Joi.number().integer().min(0).optional().default(0),
});

const ruleStepSchema = Joi.object({
  order: Joi.number().integer().min(1).required(),
  actionId: Joi.string().required(),
  branches: Joi.array().items(branchSchema).optional().default([]),
});

const createActionRuleSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  description: Joi.string().allow("").optional(),
  active: Joi.boolean().optional().default(true),
  chainId: Joi.string().allow(null, "").optional().default(null),
  delay: Joi.string()
    .valid(...ALL_CHAIN_DELAYS)
    .optional()
    .default("immediate"),
  steps: Joi.array().items(ruleStepSchema).optional().default([]),
});

const updateActionRuleSchema = Joi.object({
  name: Joi.string().trim().optional(),
  description: Joi.string().allow("").optional(),
  active: Joi.boolean().optional(),
  chainId: Joi.string().allow(null, "").optional(),
  delay: Joi.string().valid(...ALL_CHAIN_DELAYS).optional(),
  steps: Joi.array().items(ruleStepSchema).optional(),
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
  createActionRuleSchema,
  updateActionRuleSchema,
  listQuerySchema,
};
