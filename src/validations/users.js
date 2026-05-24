const Joi = require("joi");
const { DEFAULT_PASSWORD_STRENGTH, COMPANIES } = require("../constants/appData");

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
  companies: Joi.array().items(Joi.string().valid(...COMPANIES)).optional(),
  functions: Joi.array().items(Joi.string()).optional(),
  department: Joi.array().items(Joi.string()).optional(),
  departmentRoles: Joi.object().pattern(Joi.string(), Joi.string().valid("lead", "member")).optional(),
  group: Joi.array().items(Joi.string()).optional(),
  groupRoles: Joi.object().pattern(Joi.string(), Joi.string().valid("lead", "member")).optional(),

  departments: Joi.array().items(
    Joi.object({
      deptAlias: Joi.string().required(),
      role: Joi.string().valid("lead", "member").default("member"),
    })
  ).optional(),
  groups: Joi.array().items(
    Joi.object({
      groupAlias: Joi.string().required(),
      role: Joi.string().valid("lead", "member").default("member"),
    })
  ).optional(),
  moduleAccess: Joi.array().items(
    Joi.object({
      moduleId: Joi.string().required(),
      isEnabled: Joi.boolean().default(true),
      customPermissions: Joi.array().items(Joi.string()).allow(null).default(null),
    })
  ).optional(),
  isActive: Joi.boolean().optional(),
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
  companies: Joi.array().items(Joi.string()).optional(),
  functions: Joi.array().items(Joi.string()).optional(),
  department: Joi.array().items(Joi.string()).optional(),
  departmentRoles: Joi.object().pattern(Joi.string(), Joi.string().valid("lead", "member")).optional(),
  group: Joi.array().items(Joi.string()).optional(),
  groupRoles: Joi.object().pattern(Joi.string(), Joi.string().valid("lead", "member")).optional(),

  departments: Joi.array().items(
    Joi.object({
      deptAlias: Joi.string().required(),
      role: Joi.string().valid("lead", "member").default("member"),
    })
  ).optional(),
  groups: Joi.array().items(
    Joi.object({
      groupAlias: Joi.string().required(),
      role: Joi.string().valid("lead", "member").default("member"),
    })
  ).optional(),
  moduleAccess: Joi.array().items(
    Joi.object({
      moduleId: Joi.string().required(),
      isEnabled: Joi.boolean().default(true),
      customPermissions: Joi.array().items(Joi.string()).allow(null).default(null),
    })
  ).optional(),
  isActive: Joi.boolean().optional(),
}).min(1).messages({
  "object.min": "At least one field is required to update",
});

const listUsersQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  department: Joi.string().allow("").optional(),
  role: Joi.string().allow("").optional(),
  functionId: Joi.string().allow("").optional(),
  includeDeleted: Joi.string().valid("true", "false").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  assignmentScope: Joi.string().valid("true", "false").optional(),
  scopedUserIds: Joi.array().items(Joi.string()).optional(),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
};
