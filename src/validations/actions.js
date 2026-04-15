const Joi = require("joi");
const {
  ALL_ACTION_TYPES,
  ACTION_CATEGORY_VALUES,
  ALL_RESULT_TYPES,
  ALL_CHAIN_DELAYS,
  ALL_NEXT_STEP_TYPES,
  ALL_CLOSE_OUTCOMES,
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
const branchSchema = Joi.object({
  resultId:     Joi.string().required(),
  order:        Joi.number().integer().min(0).optional().default(0),
  nextStepType: Joi.string().valid(...ALL_NEXT_STEP_TYPES).optional().default("close_task"),
  nextActionId: Joi.string().allow(null, "").optional().default(null),
  closeOutcome: Joi.string().valid(...ALL_CLOSE_OUTCOMES).allow(null).optional().default(null),
  delayUnit:    Joi.string().valid(...ALL_BRANCH_DELAY_UNITS).allow(null).optional().default(null),
  delayValue:   Joi.number().integer().min(1).allow(null).optional().default(null),
});

const chainStepSchema = Joi.object({
  order:    Joi.number().integer().min(1).required(),
  actionId: Joi.string().required(),
  branches: Joi.array().items(branchSchema).optional().default([]),
});

const createActionChainSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  description: Joi.string().allow("").optional(),
  delay:  Joi.string().valid(...ALL_CHAIN_DELAYS).optional().default("immediate"),
  active: Joi.boolean().optional().default(true),
  steps:  Joi.array().items(chainStepSchema).optional().default([]),
});

const updateActionChainSchema = Joi.object({
  name:        Joi.string().trim().optional(),
  description: Joi.string().allow("").optional(),
  delay:       Joi.string().valid(...ALL_CHAIN_DELAYS).optional(),
  active:      Joi.boolean().optional(),
  steps:       Joi.array().items(chainStepSchema).optional(),
}).min(1);

// Dedicated endpoint: save full chain rule config (steps + branches)
const saveChainRuleSchema = Joi.object({
  steps: Joi.array().items(chainStepSchema).required(),
});

// (ActionRule schemas removed — rule configuration is now embedded in ActionChain.steps.branches)

// ─── List Query ───
const listQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  page:   Joi.number().integer().min(1).optional(),
  limit:  Joi.number().integer().min(1).max(200).optional(),
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
  listQuerySchema,
};
