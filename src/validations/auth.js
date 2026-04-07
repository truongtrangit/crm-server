const Joi = require("joi");
const { DEFAULT_PASSWORD_STRENGTH } = require("../constants/appData");

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "email must be a valid email address",
    "any.required": "email is required",
  }),
  password: Joi.string().required().messages({
    "any.required": "password is required",
  }),
});

const refreshSchema = Joi.object({
  sessionId: Joi.string().optional(),
  refreshToken: Joi.string().optional(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "email must be a valid email address",
    "any.required": "email is required",
  }),
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "email must be a valid email address",
    "any.required": "email is required",
  }),
  resetToken: Joi.string().trim().required().messages({
    "any.required": "resetToken is required",
  }),
  newPassword: Joi.string().min(DEFAULT_PASSWORD_STRENGTH).required().messages({
    "string.min": `newPassword must be at least ${DEFAULT_PASSWORD_STRENGTH} characters`,
    "any.required": "newPassword is required",
  }),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "any.required": "currentPassword is required",
  }),
  newPassword: Joi.string().min(DEFAULT_PASSWORD_STRENGTH).required().messages({
    "string.min": `newPassword must be at least ${DEFAULT_PASSWORD_STRENGTH} characters`,
    "any.required": "newPassword is required",
  }),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().optional(),
  email: Joi.string().email().optional(),
  avatar: Joi.string().allow("").optional(),
  phone: Joi.string().allow("").optional(),
  password: Joi.string().min(DEFAULT_PASSWORD_STRENGTH).optional().messages({
    "string.min": `password must be at least ${DEFAULT_PASSWORD_STRENGTH} characters`,
  }),
  department: Joi.array().items(Joi.string()).optional(),
  departmentAliases: Joi.array().items(Joi.string()).optional(),
  departmentIds: Joi.array().items(Joi.string()).optional(),
  group: Joi.array().items(Joi.string()).optional(),
  groupAliases: Joi.array().items(Joi.string()).optional(),
  groupIds: Joi.array().items(Joi.string()).optional(),
}).min(1).messages({
  "object.min": "At least one field is required to update",
});

const registerSchema = Joi.object({
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

module.exports = {
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  registerSchema,
};
