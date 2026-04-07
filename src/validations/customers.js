const Joi = require("joi");

const createCustomerSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "email must be a valid email address",
    "any.required": "email is required",
  }),
  avatar: Joi.string().allow("").optional(),
  type: Joi.string().trim().optional(),
  phone: Joi.string().allow("").optional(),
  biz: Joi.array().items(Joi.string()).optional(),
  platforms: Joi.array().items(Joi.string()).optional(),
  group: Joi.string().allow("").optional(),
  registeredAt: Joi.string().allow("").optional(),
  lastLoginAt: Joi.string().allow("").optional(),
  tags: Joi.array().items(Joi.string()).optional(),
});

const updateCustomerSchema = Joi.object({
  name: Joi.string().trim().optional(),
  email: Joi.string().email().optional().messages({
    "string.email": "email must be a valid email address",
  }),
  avatar: Joi.string().allow("").optional(),
  type: Joi.string().trim().optional(),
  phone: Joi.string().allow("").optional(),
  biz: Joi.array().items(Joi.string()).optional(),
  platforms: Joi.array().items(Joi.string()).optional(),
  group: Joi.string().allow("").optional(),
  registeredAt: Joi.string().allow("").optional(),
  lastLoginAt: Joi.string().allow("").optional(),
  tags: Joi.array().items(Joi.string()).optional(),
}).min(1).messages({
  "object.min": "At least one field is required to update",
});

const assignCustomerSchema = Joi.object({
  userId: Joi.string().required().messages({
    "any.required": "userId is required",
  }),
  role: Joi.string().required().messages({
    "any.required": "role is required",
  }),
});

const unassignCustomerQuerySchema = Joi.object({
  role: Joi.string().required().messages({
    "any.required": "role query param is required",
  }),
});

const listCustomersQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  type: Joi.string().allow("").optional(),
  group: Joi.string().allow("").optional(),
  platform: Joi.string().allow("").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

module.exports = {
  createCustomerSchema,
  updateCustomerSchema,
  assignCustomerSchema,
  unassignCustomerQuerySchema,
  listCustomersQuerySchema,
};
