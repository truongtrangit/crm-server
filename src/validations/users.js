const Joi = require("joi");
const { DEFAULT_PASSWORD_STRENGTH } = require("../constants/appData");

const createUserSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "email must be a valid email address",
    "any.required": "email is required",
  }),
  password: Joi.string().min(DEFAULT_PASSWORD_STRENGTH).optional().messages({
    "string.min": `password must be at least ${DEFAULT_PASSWORD_STRENGTH} characters`,
  }),
  avatar: Joi.string().allow("").optional(),
  phone: Joi.string().allow("").optional(),
  role: Joi.string().optional(),
  roleId: Joi.string().optional(),
  department: Joi.array().items(Joi.string()).optional(),
  departmentAliases: Joi.array().items(Joi.string()).optional(),
  departmentIds: Joi.array().items(Joi.string()).optional(),
  group: Joi.array().items(Joi.string()).optional(),
  groupAliases: Joi.array().items(Joi.string()).optional(),
  groupIds: Joi.array().items(Joi.string()).optional(),
  managerId: Joi.string().allow("", null).optional(),
});

const updateUserSchema = Joi.object({
  name: Joi.string().trim().optional(),
  email: Joi.string().email().optional().messages({
    "string.email": "email must be a valid email address",
  }),
  password: Joi.string().min(DEFAULT_PASSWORD_STRENGTH).optional().messages({
    "string.min": `password must be at least ${DEFAULT_PASSWORD_STRENGTH} characters`,
  }),
  avatar: Joi.string().allow("").optional(),
  phone: Joi.string().allow("").optional(),
  role: Joi.string().optional(),
  roleId: Joi.string().optional(),
  department: Joi.array().items(Joi.string()).optional(),
  departmentAliases: Joi.array().items(Joi.string()).optional(),
  departmentIds: Joi.array().items(Joi.string()).optional(),
  group: Joi.array().items(Joi.string()).optional(),
  groupAliases: Joi.array().items(Joi.string()).optional(),
  groupIds: Joi.array().items(Joi.string()).optional(),
  managerId: Joi.string().allow("", null).optional(),
}).min(1).messages({
  "object.min": "At least one field is required to update",
});

const listUsersQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  department: Joi.string().allow("").optional(),
  role: Joi.string().allow("").optional(),
  managerId: Joi.string().allow("").optional(),
  includeDeleted: Joi.string().valid("true", "false").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
};
