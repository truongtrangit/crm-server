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
  extraInfo: Joi.any().optional(),
  isActive: Joi.boolean().optional(),
  mainType: Joi.string().valid("user", "biz").optional(),
  subType: Joi.string().allow("").optional(),
  alias: Joi.string().allow("").optional(),
  botvnPassword: Joi.string().pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/).optional().messages({
    "string.pattern.base": "Mật khẩu phải dài ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt",
  }),
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
  extraInfo: Joi.any().optional(),
  isActive: Joi.boolean().optional(),
  mainType: Joi.string().valid("user", "biz").optional(),
  subType: Joi.string().allow("").optional(),
  alias: Joi.string().allow("").optional(),
}).min(1).messages({
  "object.min": "At least one field is required to update",
});

const listCustomersQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  type: Joi.string().allow("").optional(),
  group: Joi.string().allow("").optional(),
  platform: Joi.string().allow("").optional(),
  includeDeleted: Joi.string().valid("true", "false").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

const setBotvnPasswordSchema = Joi.object({
  botvnPassword: Joi.string().pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/).required().messages({
    "string.pattern.base": "Mật khẩu phải dài ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt",
    "any.required": "botvnPassword is required",
  }),
});

module.exports = {
  createCustomerSchema,
  updateCustomerSchema,
  setBotvnPasswordSchema,
  listCustomersQuerySchema,
};
