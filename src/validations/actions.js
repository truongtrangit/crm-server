const Joi = require("joi");

// ─── Result ───
const createResultSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  type: Joi.string()
    .valid("success", "failure", "neutral", "skip")
    .optional()
    .default("neutral"),
  description: Joi.string().allow("").optional(),
});

const updateResultSchema = Joi.object({
  name: Joi.string().trim().optional(),
  type: Joi.string().valid("success", "failure", "neutral", "skip").optional(),
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
    .valid("call", "send_block_automation", "review", "manual_order", "email", "sms", "meeting", "other")
    .optional()
    .default("call"),
  reasonIds: Joi.array().items(Joi.string()).optional().default([]),
  description: Joi.string().allow("").optional(),
});

const updateActionSchema = Joi.object({
  name: Joi.string().trim().optional(),
  type: Joi.string()
    .valid("call", "send_block_automation", "review", "manual_order", "email", "sms", "meeting", "other")
    .optional(),
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
    .valid("immediate", "1h", "4h", "1d", "3d", "7d")
    .optional()
    .default("immediate"),
  steps: Joi.array().items(chainStepSchema).optional().default([]),
});

const updateActionChainSchema = Joi.object({
  name: Joi.string().trim().optional(),
  description: Joi.string().allow("").optional(),
  delay: Joi.string()
    .valid("immediate", "1h", "4h", "1d", "3d", "7d")
    .optional(),
  steps: Joi.array().items(chainStepSchema).optional(),
}).min(1);

// ─── Action Rule ───
const branchSchema = Joi.object({
  resultId: Joi.string().required(),
  nextStepType: Joi.string()
    .valid("next_in_chain", "specific_action", "close")
    .default("close"),
  nextActionId: Joi.string().allow(null, "").optional().default(null),
  closeStatus: Joi.string()
    .valid("success", "failure")
    .allow(null)
    .optional()
    .default(null),
  delayUnit: Joi.string()
    .valid("immediate", "hour", "day", "week")
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
    .valid("immediate", "1h", "4h", "1d", "3d", "7d")
    .optional()
    .default("immediate"),
  steps: Joi.array().items(ruleStepSchema).optional().default([]),
});

const updateActionRuleSchema = Joi.object({
  name: Joi.string().trim().optional(),
  description: Joi.string().allow("").optional(),
  active: Joi.boolean().optional(),
  chainId: Joi.string().allow(null, "").optional(),
  delay: Joi.string()
    .valid("immediate", "1h", "4h", "1d", "3d", "7d")
    .optional(),
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
