const Joi = require("joi");

const createFunctionSchema = Joi.object({
  title: Joi.string().trim().required().messages({
    "any.required": "title is required",
  }),
  desc: Joi.string().allow("").optional(),
  type: Joi.string().allow("").optional(),
  icon: Joi.string().allow("").optional(),
  color: Joi.string().allow("").optional(),
});

const updateFunctionSchema = Joi.object({
  title: Joi.string().trim().optional(),
  desc: Joi.string().allow("").optional(),
  type: Joi.string().allow("").optional(),
  icon: Joi.string().allow("").optional(),
  color: Joi.string().allow("").optional(),
}).min(1).messages({
  "object.min": "At least one field is required to update",
});

module.exports = {
  createFunctionSchema,
  updateFunctionSchema,
};
