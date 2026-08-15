const Joi = require("joi");

const createEventGroupSchema = Joi.object({
  id: Joi.string()
    .trim()
    .pattern(/^[a-z0-9_]+$/)
    .required()
    .messages({
      "string.pattern.base": "id chỉ chấp nhận chữ thường, số và dấu gạch dưới",
      "any.required": "id is required",
    }),
  label: Joi.string().trim().required().messages({
    "any.required": "label is required",
  }),
  color: Joi.string().trim().optional(),
  bg: Joi.string().trim().optional(),
  source: Joi.string().trim().allow("").optional(),
});

const updateEventGroupSchema = Joi.object({
  label: Joi.string().trim().optional(),
  color: Joi.string().trim().optional(),
  bg: Joi.string().trim().optional(),
  source: Joi.string().trim().allow("").optional(),
  isActive: Joi.boolean().optional(),
});

module.exports = {
  createEventGroupSchema,
  updateEventGroupSchema,
};
