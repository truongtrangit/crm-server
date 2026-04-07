const Joi = require("joi");

const createLeadSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  avatar: Joi.string().allow("").optional(),
  timeAgo: Joi.string().allow("").optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  assignee: Joi.object({
    name: Joi.string().allow("").optional(),
    avatar: Joi.string().allow("").optional(),
  }).optional(),
  status: Joi.string().trim().optional(),
  actionNeeded: Joi.string().allow("").optional(),
  actionType: Joi.string().valid("green", "orange", "blue", "").optional(),
  email: Joi.string().allow("").optional(),
  phone: Joi.string().allow("").optional(),
  source: Joi.string().allow("").optional(),
  address: Joi.string().allow("").optional(),
});

const updateLeadSchema = Joi.object({
  name: Joi.string().trim().optional(),
  avatar: Joi.string().allow("").optional(),
  timeAgo: Joi.string().allow("").optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  assignee: Joi.object({
    name: Joi.string().allow("").optional(),
    avatar: Joi.string().allow("").optional(),
  }).optional(),
  status: Joi.string().trim().optional(),
  actionNeeded: Joi.string().allow("").optional(),
  actionType: Joi.string().valid("green", "orange", "blue", "").optional(),
  email: Joi.string().allow("").optional(),
  phone: Joi.string().allow("").optional(),
  source: Joi.string().allow("").optional(),
  address: Joi.string().allow("").optional(),
}).min(1).messages({
  "object.min": "At least one field is required to update",
});

const updateLeadStatusSchema = Joi.object({
  status: Joi.string().trim().required().messages({
    "any.required": "status is required",
  }),
});

const listLeadsQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  status: Joi.string().allow("").optional(),
  assignee: Joi.string().allow("").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

module.exports = {
  createLeadSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
  listLeadsQuerySchema,
};
