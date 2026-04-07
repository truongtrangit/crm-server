const Joi = require("joi");

const createRoleSchema = Joi.object({
  id: Joi.string().required().messages({
    "any.required": "id is required",
  }),
  name: Joi.string().required().messages({
    "any.required": "name is required",
  }),
  description: Joi.string().allow("").optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
  level: Joi.number().integer().optional(),
});

const updateRoleSchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().allow("").optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
  level: Joi.number().integer().optional(),
}).min(1).messages({
  "object.min": "At least one field is required to update",
});

module.exports = {
  createRoleSchema,
  updateRoleSchema,
};
