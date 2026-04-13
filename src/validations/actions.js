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
  resultId: Joi.string().required().messages({
    "any.required": "resultId is required",
  }),
  description: Joi.string().allow("").optional(),
});

const updateReasonSchema = Joi.object({
  name: Joi.string().trim().optional(),
  resultId: Joi.string().optional(),
  description: Joi.string().allow("").optional(),
}).min(1);

// ─── Action ───
const createActionSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  type: Joi.string()
    .valid("call", "email", "meeting", "task", "sms", "other")
    .optional()
    .default("call"),
  resultIds: Joi.array().items(Joi.string()).optional().default([]),
  description: Joi.string().allow("").optional(),
});

const updateActionSchema = Joi.object({
  name: Joi.string().trim().optional(),
  type: Joi.string()
    .valid("call", "email", "meeting", "task", "sms", "other")
    .optional(),
  resultIds: Joi.array().items(Joi.string()).optional(),
  description: Joi.string().allow("").optional(),
}).min(1);

// ─── Action Chain ───
const branchSchema = Joi.object({
  resultId: Joi.string().required(),
  nextStep: Joi.string().valid("action", "close").default("close"),
  nextActionId: Joi.string().allow(null).optional().default(null),
  closeStatus: Joi.string()
    .valid("success", "failure")
    .allow(null)
    .optional()
    .default(null),
  delay: Joi.string()
    .valid("immediate", "1h", "4h", "1d", "3d", "7d")
    .optional()
    .default("immediate"),
});

const stepSchema = Joi.object({
  order: Joi.number().integer().min(1).required(),
  actionId: Joi.string().required(),
  branches: Joi.array().items(branchSchema).optional().default([]),
});

const createActionChainSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  active: Joi.boolean().optional().default(true),
  delay: Joi.string()
    .valid("immediate", "1h", "4h", "1d", "3d", "7d")
    .optional()
    .default("immediate"),
  description: Joi.string().allow("").optional(),
  steps: Joi.array().items(stepSchema).optional().default([]),
});

const updateActionChainSchema = Joi.object({
  name: Joi.string().trim().optional(),
  active: Joi.boolean().optional(),
  delay: Joi.string()
    .valid("immediate", "1h", "4h", "1d", "3d", "7d")
    .optional(),
  description: Joi.string().allow("").optional(),
  steps: Joi.array().items(stepSchema).optional(),
}).min(1);

// ─── List Query ───
const listQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
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
  listQuerySchema,
};
